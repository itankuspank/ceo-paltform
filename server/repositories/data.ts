import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { ENTITY_MAP, ENTITIES, coerce, fieldSource, isSensitive, type Entity } from "../data/registry";
import { type Permission } from "../../shared/rbac";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
type Actor = { userId: number; can: (p: Permission) => boolean };

export class DataRepository {
  constructor(private db: Db) {}

  entity(key: string): Entity { const e = ENTITY_MAP[key]; if (!e) throw new HttpError(404, "الكيان غير معروف"); return e; }

  /** Metadata for the console: entities + column info incl. source & sensitivity, and date/end validation hints. */
  metadata() {
    return ENTITIES.map((e) => ({
      key: e.key, labelAr: e.labelAr, labelEn: e.labelEn, group: e.group, sourceAr: e.sourceAr, archivable: !!e.archivable,
      columns: e.columns.map((c) => ({ ...c, options: c.options ? [...c.options] : undefined, source: fieldSource(e, c.key), sensitive: isSensitive(e, c.key) })),
    }));
  }

  private async fkLabels(e: Entity) {
    const out: Record<string, Record<number, string>> = {};
    for (const c of e.columns.filter((x) => x.type === "fk" && x.fk)) {
      const t = this.entity(c.fk!); const rows = (await this.db.select().from(t.table)) as any[];
      out[c.key] = Object.fromEntries(rows.map((r: any) => [r.id, r[t.labelField] ?? String(r.id)]));
    }
    return out;
  }

  async list(key: string, q?: string, includeArchived = false) {
    const e = this.entity(key);
    let rows = (await this.db.select().from(e.table).orderBy(asc(e.table.id))) as any[];
    if (e.archivable && !includeArchived) rows = rows.filter((r) => !r.isArchived);
    if (q) { const needle = q.toLowerCase(); rows = rows.filter((r) => e.columns.some((c) => c.type === "text" && String(r[c.key] ?? "").toLowerCase().includes(needle))); }
    const labels = await this.fkLabels(e);
    const pick = (r: any) => { const o: Record<string, unknown> = { id: r.id }; for (const c of e.columns) o[c.key] = r[c.key]; return o; };
    return { rows: rows.map(pick), fkLabels: labels, total: rows.length };
  }

  async fkOptions(key: string) {
    const e = this.entity(key); const rows = (await this.db.select().from(e.table).orderBy(asc(e.table.id))) as any[];
    return rows.filter((r) => !r.isArchived).map((r) => ({ id: r.id, label: r[e.labelField] ?? String(r.id) }));
  }

  /**
   * Update: per field — ownership check (FR-D-06), sensitivity → change request (FR-D-05), else apply + audit (FR-D-04).
   * Returns { applied: string[], queued: string[] }.
   */
  async update(key: string, id: number, changes: Record<string, unknown>, reasonAr: string | undefined, actor: Actor) {
    const e = this.entity(key);
    if (!actor.can("data:edit")) throw new HttpError(403, "لا تملك صلاحية تعديل البيانات");
    const found = (await this.db.select().from(e.table).where(eq(e.table.id, id)).limit(1)) as any[];
    const before = found[0]; if (!before) throw new HttpError(404, "السجل غير موجود");
    const applied: Record<string, unknown> = {}; const queued: string[] = [];
    for (const [k, raw] of Object.entries(changes)) {
      const c = e.columns.find((x) => x.key === k); if (!c || c.readOnly) throw new HttpError(400, `الحقل «${k}» غير قابل للتعديل`);
      const src = fieldSource(e, k);
      if ((src === "project_server" || src === "odoo") && !actor.can("data:override")) throw new HttpError(403, `الحقل «${c.labelAr}» مملوك لنظام ${src === "odoo" ? "Odoo ERP" : "Microsoft Project Server"} ويتطلب صلاحية التجاوز`);
      if (src === "computed" && !actor.can("data:override")) throw new HttpError(403, `الحقل «${c.labelAr}» محتسب آلياً ولا يُعدَّل يدوياً`);
      let value: unknown; try { value = coerce(c, raw); } catch (err: any) { throw new HttpError(400, err.message); }
      if (String(value ?? "") === String((before as any)[k] ?? "")) continue;
      if (isSensitive(e, k) && !actor.can("data:approve")) {
        await this.db.insert(s.changeRequests).values({ entity: e.tableName, entityId: id, field: k, currentValue: String((before as any)[k] ?? ""), proposedValue: String(value ?? ""), reasonAr: reasonAr ?? null, requestedByUserId: actor.userId });
        queued.push(c.labelAr); continue;
      }
      applied[k] = value;
    }
    if (Object.keys(applied).length) {
      await this.db.update(e.table).set(applied).where(eq(e.table.id, id));
      await this.db.insert(s.changeLog).values(Object.entries(applied).map(([k, v]) => ({ entity: e.tableName, entityId: id, field: k, oldValue: String((before as any)[k] ?? ""), newValue: String(v ?? ""), reasonAr: reasonAr ?? null, userId: actor.userId })));
    }
    return { applied: Object.keys(applied), queued };
  }

  async create(key: string, values: Record<string, unknown>, actor: Actor) {
    const e = this.entity(key);
    if (!actor.can("data:edit")) throw new HttpError(403, "لا تملك صلاحية إضافة البيانات");
    if (key === "impact") throw new HttpError(400, "الأثر يُدار من سجل المبادرة");
    const row: Record<string, unknown> = {};
    for (const c of e.columns) { if (c.readOnly) continue; try { const v = coerce(c, values[c.key]); if (v !== null) row[c.key] = v; } catch (err: any) { throw new HttpError(400, err.message); } }
    // duplicate prevention on code / name (FR-D-03)
    const dupCol = e.columns.find((c) => c.key === "code") ? "code" : e.labelField;
    if (row[dupCol] !== undefined) { const dups = (await this.db.select().from(e.table).where(eq(e.table[dupCol], row[dupCol] as any)).limit(1)) as any[]; if (dups.length) throw new HttpError(409, `يوجد سجل بنفس «${e.columns.find((c) => c.key === dupCol)?.labelAr}»`); }
    if (row.startDate && row.endDate && String(row.endDate) < String(row.startDate)) throw new HttpError(400, "تاريخ الانتهاء يسبق تاريخ البدء");
    const created = ((await this.db.insert(e.table).values(row as any).returning()) as any[])[0];
    await this.db.insert(s.changeLog).values({ entity: e.tableName, entityId: (created as any).id, field: "*", oldValue: null, newValue: "إنشاء سجل", userId: actor.userId });
    return created;
  }

  async archive(key: string, id: number, archived: boolean, actor: Actor) {
    const e = this.entity(key);
    if (!e.archivable) throw new HttpError(400, "هذا الكيان لا يدعم الأرشفة");
    if (!actor.can("data:approve")) throw new HttpError(403, "الأرشفة والاسترجاع تتطلبان صلاحية الاعتماد");
    await this.db.update(e.table).set({ isArchived: archived }).where(eq(e.table.id, id));
    await this.db.insert(s.changeLog).values({ entity: e.tableName, entityId: id, field: "isArchived", oldValue: String(!archived), newValue: String(archived), userId: actor.userId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- change log
  async changeLog(entity?: string, limit = 200) {
    const rows = await this.db.select({ id: s.changeLog.id, entity: s.changeLog.entity, entityId: s.changeLog.entityId, field: s.changeLog.field, oldValue: s.changeLog.oldValue, newValue: s.changeLog.newValue, reasonAr: s.changeLog.reasonAr, createdAt: s.changeLog.createdAt, revertedAt: s.changeLog.revertedAt, userName: s.users.fullName, role: s.users.role })
      .from(s.changeLog).leftJoin(s.users, eq(s.users.id, s.changeLog.userId)).where(entity ? eq(s.changeLog.entity, entity) : sql`true`).orderBy(desc(s.changeLog.id)).limit(limit);
    return rows;
  }

  async revert(logId: number, actor: Actor) {
    if (!actor.can("data:approve")) throw new HttpError(403, "الاسترجاع يتطلب صلاحية الاعتماد");
    const [row] = await this.db.select().from(s.changeLog).where(eq(s.changeLog.id, logId)).limit(1);
    if (!row) throw new HttpError(404, "السجل غير موجود");
    if (row.revertedAt) throw new HttpError(400, "تم استرجاع هذا التغيير مسبقاً");
    if (row.field === "*") throw new HttpError(400, "لا يمكن استرجاع عملية إنشاء");
    const e = ENTITIES.find((x) => x.tableName === row.entity && x.columns.some((c) => c.key === row.field)); if (!e) throw new HttpError(400, "تعذر تحديد الكيان");
    const c = e.columns.find((x) => x.key === row.field)!;
    const value = coerce(c, row.oldValue === "" ? null : row.oldValue);
    await this.db.update(e.table).set({ [row.field]: value }).where(eq(e.table.id, row.entityId));
    await this.db.update(s.changeLog).set({ revertedAt: new Date() }).where(eq(s.changeLog.id, logId));
    await this.db.insert(s.changeLog).values({ entity: row.entity, entityId: row.entityId, field: row.field, oldValue: row.newValue, newValue: row.oldValue, reasonAr: `استرجاع التغيير رقم ${logId}`, userId: actor.userId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- change requests (approvals)
  async requests(status?: string) {
    return this.db.select({ id: s.changeRequests.id, entity: s.changeRequests.entity, entityId: s.changeRequests.entityId, field: s.changeRequests.field, currentValue: s.changeRequests.currentValue, proposedValue: s.changeRequests.proposedValue, reasonAr: s.changeRequests.reasonAr, status: s.changeRequests.status, createdAt: s.changeRequests.createdAt, decidedAt: s.changeRequests.decidedAt, requestedBy: s.users.fullName })
      .from(s.changeRequests).leftJoin(s.users, eq(s.users.id, s.changeRequests.requestedByUserId)).where(status ? eq(s.changeRequests.status, status) : sql`true`).orderBy(desc(s.changeRequests.id));
  }

  async decideRequest(id: number, status: "approved" | "rejected", actor: Actor) {
    if (!actor.can("data:approve")) throw new HttpError(403, "اعتماد التغييرات يتطلب صلاحية الاعتماد");
    const [r] = await this.db.select().from(s.changeRequests).where(eq(s.changeRequests.id, id)).limit(1);
    if (!r) throw new HttpError(404, "الطلب غير موجود"); if (r.status !== "pending") throw new HttpError(400, "تم البت في هذا الطلب مسبقاً");
    if (status === "approved") {
      const e = ENTITIES.find((x) => x.tableName === r.entity && x.columns.some((c) => c.key === r.field))!; const c = e.columns.find((x) => x.key === r.field)!;
      const value = coerce(c, r.proposedValue);
      await this.db.update(e.table).set({ [r.field]: value }).where(eq(e.table.id, r.entityId));
      await this.db.insert(s.changeLog).values({ entity: r.entity, entityId: r.entityId, field: r.field, oldValue: r.currentValue, newValue: r.proposedValue, reasonAr: `اعتماد طلب التغيير رقم ${id}${r.reasonAr ? ` — ${r.reasonAr}` : ""}`, userId: actor.userId });
    }
    await this.db.update(s.changeRequests).set({ status, decidedByUserId: actor.userId, decidedAt: new Date() }).where(eq(s.changeRequests.id, id));
    return { ok: true };
  }

  // ---------------------------------------------------------------- relations (project ↔ regions / KPIs)
  async relations(projectId: number) {
    const [p] = await this.db.select({ id: s.projects.id, nameAr: s.projects.nameAr }).from(s.projects).where(eq(s.projects.id, projectId)).limit(1);
    if (!p) throw new HttpError(404, "المبادرة غير موجودة");
    const regionIds = (await this.db.select({ id: s.projectRegions.regionId }).from(s.projectRegions).where(eq(s.projectRegions.projectId, projectId))).map((x) => x.id);
    const kpiIds = (await this.db.select({ id: s.projectKpis.kpiId }).from(s.projectKpis).where(eq(s.projectKpis.projectId, projectId))).map((x) => x.id);
    return { project: p, regionIds, kpiIds };
  }

  async saveRelations(projectId: number, regionIds: number[], kpiIds: number[], actor: Actor) {
    if (!actor.can("data:edit")) throw new HttpError(403, "لا تملك صلاحية تعديل العلاقات");
    if (!regionIds.length) throw new HttpError(400, "يجب ربط المبادرة بمنطقة واحدة على الأقل");
    const before = await this.relations(projectId);
    const [p] = await this.db.select().from(s.projects).where(eq(s.projects.id, projectId)).limit(1);
    if (!p) throw new HttpError(404, "المبادرة غير موجودة");
    await this.db.delete(s.projectRegions).where(eq(s.projectRegions.projectId, projectId));
    await this.db.insert(s.projectRegions).values(regionIds.map((r) => ({ projectId, regionId: r })));
    const existing = await this.db.select().from(s.projectKpis).where(eq(s.projectKpis.projectId, projectId));
    await this.db.delete(s.projectKpis).where(and(eq(s.projectKpis.projectId, projectId), kpiIds.length ? sql`${s.projectKpis.kpiId} not in (${sql.join(kpiIds.map((k) => sql`${k}`), sql`, `)})` : sql`true`));
    const toAdd = kpiIds.filter((k) => !existing.some((x) => x.kpiId === k));
    if (toAdd.length) await this.db.insert(s.projectKpis).values(toAdd.map((k) => ({ projectId, kpiId: k, contributionTarget: p.impactTarget, contributionActual: p.impactAchieved })));
    await this.db.insert(s.changeLog).values([
      { entity: "projects", entityId: projectId, field: "regions", oldValue: before.regionIds.join(","), newValue: regionIds.join(","), userId: actor.userId },
      { entity: "projects", entityId: projectId, field: "kpis", oldValue: before.kpiIds.join(","), newValue: kpiIds.join(","), userId: actor.userId },
    ]);
    return { ok: true };
  }

  // ---------------------------------------------------------------- data quality (FR-D-07)
  async quality() {
    const per = [] as { key: string; labelAr: string; completeness: number; missing: number; records: number }[];
    for (const e of ENTITIES.filter((x) => x.key !== "impact")) {
      const rows = (await this.db.select().from(e.table)) as any[];
      const cols = e.columns.filter((c) => !c.readOnly);
      const cells = rows.length * cols.length || 1;
      const missing = rows.reduce((a, r) => a + cols.filter((c) => r[c.key] === null || r[c.key] === undefined || r[c.key] === "").length, 0);
      per.push({ key: e.key, labelAr: e.labelAr, completeness: Math.round(((cells - missing) / cells) * 1000) / 10, missing, records: rows.length });
    }
    const [links] = (await this.db.execute(sql`
      select (select count(*) from projects p where p.is_archived = false and not exists (select 1 from project_regions x where x.project_id = p.id))::int as "noRegion",
             (select count(*) from projects p where p.is_archived = false and not exists (select 1 from project_kpis x where x.project_id = p.id))::int as "noKpi",
             (select count(*) from projects p where p.is_archived = false and not exists (select 1 from financials f where f.project_id = p.id))::int as "noFinance",
             (select count(*) from (select name_ar from projects group by name_ar having count(*) > 1) d)::int as "dupProjects",
             (select count(*) from (select name_ar from resources group by name_ar having count(*) > 1) d)::int as "dupResources"`)).rows as any[];
    const overall = Math.round((per.reduce((a, x) => a + x.completeness, 0) / per.length) * 10) / 10;
    const actions = [
      ...(links.noRegion ? [{ labelAr: `${links.noRegion} مبادرة غير مرتبطة بمنطقة`, entity: "relations" }] : []),
      ...(links.noKpi ? [{ labelAr: `${links.noKpi} مبادرة غير مرتبطة بمؤشر أداء`, entity: "relations" }] : []),
      ...(links.noFinance ? [{ labelAr: `${links.noFinance} مبادرة بدون سجل مالي`, entity: "financials" }] : []),
      ...(links.dupProjects ? [{ labelAr: `${links.dupProjects} أسماء مبادرات مكررة`, entity: "projects" }] : []),
      ...(links.dupResources ? [{ labelAr: `${links.dupResources} أسماء موارد مكررة`, entity: "resources" }] : []),
      ...per.filter((x) => x.missing > 0).map((x) => ({ labelAr: `${x.missing} حقول ناقصة في ${x.labelAr}`, entity: x.key })),
    ];
    return { overall, entities: per, brokenLinks: links.noRegion + links.noKpi + links.noFinance, duplicates: links.dupProjects + links.dupResources, actions };
  }

  // ---------------------------------------------------------------- CSV
  async exportCsv(key: string) {
    const e = this.entity(key); const { rows, fkLabels } = await this.list(key, undefined, true);
    const esc = (v: unknown) => { const t = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const head = ["id", ...e.columns.map((c) => c.key)].join(",");
    const body = rows.map((r) => ["id", ...e.columns.map((c) => c.key)].map((k) => { const c = e.columns.find((x) => x.key === k); const v = r[k]; return esc(c?.type === "fk" ? `${v}` : v); }).join(",")).join("\n");
    return "\uFEFF" + head + "\n" + body; // BOM so Excel opens Arabic correctly
  }

  /** Import rows (parsed client-side). Upsert by `code` when the entity has one, else insert. Validated per column; all-or-nothing. */
  async importRows(key: string, rows: Record<string, unknown>[], actor: Actor) {
    const e = this.entity(key);
    if (!actor.can("data:import")) throw new HttpError(403, "الاستيراد يتطلب صلاحية الاستيراد");
    if (key === "impact") throw new HttpError(400, "الأثر يُدار من سجل المبادرة");
    const hasCode = e.columns.some((c) => c.key === "code");
    const prepared: { code?: string; row: Record<string, unknown> }[] = [];
    rows.forEach((raw, i) => {
      const row: Record<string, unknown> = {};
      for (const c of e.columns) { if (c.readOnly) continue; try { const v = coerce(c, raw[c.key]); if (v !== null) row[c.key] = v; } catch (err: any) { throw new HttpError(400, `السطر ${i + 2}: ${err.message}`); } }
      prepared.push({ code: hasCode ? String(raw.code ?? "") : undefined, row });
    });
    let inserted = 0, updated = 0;
    await this.db.transaction(async (tx) => {
      for (const p of prepared) {
        const existing = hasCode && p.code ? ((await tx.select().from(e.table).where(eq(e.table.code, p.code)).limit(1)) as any[])[0] : undefined;
        if (existing) { await tx.update(e.table).set(p.row).where(eq(e.table.id, (existing as any).id)); updated++; await tx.insert(s.changeLog).values({ entity: e.tableName, entityId: (existing as any).id, field: "*", oldValue: null, newValue: "تحديث عبر استيراد CSV", userId: actor.userId }); }
        else { const c = ((await tx.insert(e.table).values(p.row as any).returning()) as any[])[0]; inserted++; await tx.insert(s.changeLog).values({ entity: e.tableName, entityId: (c as any).id, field: "*", oldValue: null, newValue: "إنشاء عبر استيراد CSV", userId: actor.userId }); }
      }
    });
    return { inserted, updated };
  }

  // ---------------------------------------------------------------- users
  async users() {
    return this.db.select({ id: s.users.id, username: s.users.username, fullName: s.users.fullName, role: s.users.role, isActive: s.users.isActive, createdAt: s.users.createdAt }).from(s.users).orderBy(asc(s.users.id));
  }
  async setUserActive(id: number, active: boolean, actor: Actor) {
    if (!actor.can("users:manage")) throw new HttpError(403, "إدارة المستخدمين تتطلب صلاحية مدير النظام");
    if (id === actor.userId) throw new HttpError(400, "لا يمكن تعطيل حسابك الحالي");
    await this.db.update(s.users).set({ isActive: active }).where(eq(s.users.id, id));
    await this.db.insert(s.changeLog).values({ entity: "users", entityId: id, field: "isActive", oldValue: String(!active), newValue: String(active), userId: actor.userId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- system (screen 23)
  async system() {
    const sources = await this.db.select().from(s.dataSources).orderBy(asc(s.dataSources.id));
    const jobs = await this.db.select().from(s.syncJobs).orderBy(asc(s.syncJobs.id));
    const roleCounts = await this.db.select({ role: s.users.role, n: sql<number>`count(*)` }).from(s.users).groupBy(s.users.role);
    const [ops] = await this.db.select({ n: sql<number>`count(*)` }).from(s.changeLog);
    return {
      summary: { sources: sources.length, avgQuality: Math.round((sources.reduce((a, x) => a + x.quality, 0) / sources.length) * 10) / 10, syncsToday: jobs.reduce((a, j) => a + (j.scheduleAr.includes("كل ساعة") ? 24 : 1), 0), alerts: sources.filter((x) => x.status !== "on_track" || x.quality < 95).length, operations: Number(ops.n) },
      sources, jobs, roles: roleCounts.map((r) => ({ role: r.role, users: Number(r.n) })),
      environment: [["نوع البيئة", "داخلية معزولة"], ["الاتصال بالإنترنت", "غير مفعّل"], ["خدمات سحابية خارجية", "لا يوجد"], ["External APIs", "لا يوجد"], ["قواعد البيانات", "داخل البيئة الداخلية"], ["سجلات التدقيق", "مفعّلة"]],
    };
  }
}
export { inArray };
