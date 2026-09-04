import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { WorkflowEngine } from "../workflow";

const DAY = 86400000;
const r1 = (v: number) => Math.round(v * 10) / 10;
type Actor = { userId: number; role: s.Role };

export class OrgRepository {
  constructor(private db: Db, private wf: WorkflowEngine) {}

  private async unitsAll() { return this.db.select().from(s.orgUnits).orderBy(asc(s.orgUnits.id)); }

  /** Structural health — layers, span of control, unit size, vacancy — against reference ranges. */
  private health(units: s.OrgUnitRow[]) {
    const active = units.filter((u) => u.status === "معتمد");
    const byParent: Record<number, s.OrgUnitRow[]> = {}; for (const u of active) if (u.parentId) (byParent[u.parentId] ??= []).push(u);
    const spans = active.filter((u) => (byParent[u.id] ?? []).length > 0).map((u) => byParent[u.id].length);
    const depth = (u: s.OrgUnitRow): number => { const p = u.parentId ? active.find((x) => x.id === u.parentId) : undefined; return p ? 1 + depth(p) : 1; };
    const layers = Math.max(...active.map(depth));
    const depts = active.filter((u) => u.level === "إدارة");
    const positions = active.reduce((a, u) => a + u.positions, 0), headcount = active.reduce((a, u) => a + u.headcount, 0);
    const avgSpan = r1(spans.reduce((a, b) => a + b, 0) / (spans.length || 1));
    const avgDept = r1(depts.reduce((a, u) => a + u.positions, 0) / (depts.length || 1));
    const vacancy = positions ? r1(((positions - headcount) / positions) * 100) : 0;
    const wideSpan = active.filter((u) => (byParent[u.id] ?? []).length > 8).length;
    const narrowSpan = active.filter((u) => (byParent[u.id] ?? []).length === 1).length;
    return {
      indicators: [
        { key: "layers", labelAr: "عدد الطبقات الإدارية", value: layers, refAr: "المرجع: 4 – 6", status: layers <= 6 ? "on_track" : "at_risk" },
        { key: "span", labelAr: "متوسط نطاق الإشراف", value: avgSpan, refAr: "المرجع: 4 – 8 وحدات لكل مدير", status: avgSpan >= 4 && avgSpan <= 8 ? "on_track" : "at_risk" },
        { key: "deptSize", labelAr: "متوسط حجم الإدارة (وظيفة)", value: avgDept, refAr: "المرجع: 20 – 60", status: avgDept >= 20 && avgDept <= 60 ? "on_track" : "at_risk" },
        { key: "vacancy", labelAr: "نسبة الشواغر", value: `${vacancy}%`, refAr: "المرجع: أقل من 15%", status: vacancy < 15 ? "on_track" : vacancy < 25 ? "at_risk" : "off_track" },
        { key: "wide", labelAr: "وحدات بنطاق إشراف واسع (> 8)", value: wideSpan, refAr: "تحتاج مراجعة", status: wideSpan === 0 ? "on_track" : "at_risk" },
        { key: "narrow", labelAr: "وحدات بتابع واحد فقط", value: narrowSpan, refAr: "مرشحة للدمج", status: narrowSpan <= 3 ? "on_track" : "at_risk" },
      ],
      totals: { units: active.length, positions, headcount, vacancies: positions - headcount, byLevel: s.ORG_LEVELS.map((l) => ({ level: l, count: active.filter((u) => u.level === l).length })) },
    };
  }

  private async requestsBase() {
    const rows = await this.db.select({
      id: s.orgRequests.id, code: s.orgRequests.code, type: s.orgRequests.type, titleAr: s.orgRequests.titleAr, priority: s.orgRequests.priority, decisionAuthority: s.orgRequests.decisionAuthority, receivedAt: s.orgRequests.receivedAt, status: s.orgRequests.status,
      impactHeadcount: s.orgRequests.impactHeadcount, impactBudget: s.orgRequests.impactBudget, requestingUnitId: s.orgRequests.requestingUnitId, requestingUnit: s.orgUnits.nameAr, sectorId: s.orgUnits.sectorId, relatedProjectId: s.orgRequests.relatedProjectId,
    }).from(s.orgRequests).innerJoin(s.orgUnits, eq(s.orgUnits.id, s.orgRequests.requestingUnitId)).orderBy(desc(s.orgRequests.id));
    const pipeline = await this.wf.pipeline("org_request");
    const byEntity = Object.fromEntries(pipeline.map((p) => [p.entityId, p]));
    const sectors = await this.db.select().from(s.sectors);
    return rows.map((r) => { const wfi = byEntity[r.id]; return { ...r, sectorName: sectors.find((x) => x.id === r.sectorId)?.nameAr ?? "—", ageDays: Math.floor((Date.now() - new Date(r.receivedAt).getTime()) / DAY), workflow: wfi ? { instanceId: wfi.id, stage: wfi.stage, stageIndex: wfi.stageIndex, status: wfi.status, daysInStage: wfi.daysInStage, slaBreached: wfi.slaBreached } : null }; });
  }

  async center() {
    const units = await this.unitsAll(); const reqs = await this.requestsBase();
    const active = reqs.filter((r) => r.status === "قيد الإجراء");
    const counts = await this.wf.counts("org_request");
    const done = await this.db.select({ createdAt: s.workflowInstances.createdAt, completedAt: s.workflowInstances.completedAt }).from(s.workflowInstances).where(and(eq(s.workflowInstances.entity, "org_requests"), eq(s.workflowInstances.status, "completed")));
    const cycle = done.length ? r1(done.reduce((a, d) => a + (new Date(d.completedAt!).getTime() - new Date(d.createdAt).getTime()) / DAY, 0) / done.length) : 0;
    const byType = s.ORG_REQUEST_TYPES.map((t) => ({ type: t, count: reqs.filter((r) => r.type === t).length, active: active.filter((r) => r.type === t).length }));
    const bySector = Object.values(active.reduce((acc, r) => { (acc[r.sectorName] ??= { sector: r.sectorName, count: 0 }).count++; return acc; }, {} as Record<string, { sector: string; count: number }>)).sort((a, b) => b.count - a.count);
    const roadmap = await this.db.select({ id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, progress: s.projects.progress, portfolio: s.portfolios.nameAr }).from(s.projects).innerJoin(s.portfolios, eq(s.portfolios.id, s.projects.portfolioId)).where(sql`'تنظيمي' = any(${s.projects.tags})`);
    return {
      summary: { units: units.filter((u) => u.status === "معتمد").length, pending: active.length, awaitingCeo: active.filter((r) => r.workflow?.stage.requiresDecision).length, avgCycleDays: cycle, slaBreaches: active.filter((r) => r.workflow?.slaBreached).length, completed: counts.completed, rejected: counts.rejected },
      funnel: counts.byStage, byType, bySector, aging: [...active].sort((a, b) => b.ageDays - a.ageDays).slice(0, 8), awaitingDecision: active.filter((r) => r.workflow?.stage.requiresDecision),
      health: this.health(units), roadmap,
    };
  }

  async tree() {
    const units = await this.unitsAll();
    const pending = await this.db.select({ unitId: s.orgRequestUnits.unitId, proposedParentId: s.orgRequestUnits.proposedParentId, requestId: s.orgRequests.id, code: s.orgRequests.code, action: s.orgRequestUnits.action, proposedNameAr: s.orgRequestUnits.proposedNameAr, proposedLevel: s.orgRequestUnits.proposedLevel, proposedPositions: s.orgRequestUnits.proposedPositions })
      .from(s.orgRequestUnits).innerJoin(s.orgRequests, eq(s.orgRequests.id, s.orgRequestUnits.requestId)).where(eq(s.orgRequests.status, "قيد الإجراء"));
    return { units: units.map((u) => ({ ...u, pendingRequests: pending.filter((p) => p.unitId === u.id).map((p) => ({ requestId: p.requestId, code: p.code, action: p.action })) })), proposed: pending.filter((p) => p.action === "استحداث").map((p) => ({ requestId: p.requestId, code: p.code, parentId: p.proposedParentId, nameAr: p.proposedNameAr, level: p.proposedLevel, positions: p.proposedPositions })) };
  }

  async unit(id: number) {
    const units = await this.unitsAll(); const u = units.find((x) => x.id === id); if (!u) return null;
    const lineage: s.OrgUnitRow[] = []; let cur: s.OrgUnitRow | undefined = u; while (cur?.parentId) { cur = units.find((x) => x.id === cur!.parentId); if (cur) lineage.unshift(cur); }
    const subtreeIds = (root: number): number[] => [root, ...units.filter((x) => x.parentId === root && x.status === "معتمد").flatMap((c) => subtreeIds(c.id))];
    const ids = subtreeIds(id); const sub = units.filter((x) => ids.includes(x.id));
    const children = units.filter((x) => x.parentId === id && x.status === "معتمد");
    const requests = (await this.requestsBase()).filter((r) => r.requestingUnitId === id || false);
    const affected = await this.db.select({ requestId: s.orgRequestUnits.requestId, action: s.orgRequestUnits.action, code: s.orgRequests.code, titleAr: s.orgRequests.titleAr, status: s.orgRequests.status }).from(s.orgRequestUnits).innerJoin(s.orgRequests, eq(s.orgRequests.id, s.orgRequestUnits.requestId)).where(eq(s.orgRequestUnits.unitId, id));
    const initiatives = u.sectorId ? await this.db.select({ id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, progress: s.projects.progress, tags: s.projects.tags }).from(s.projects).where(and(eq(s.projects.sectorId, u.sectorId), eq(s.projects.isArchived, false))).orderBy(desc(s.projects.progress)).limit(8) : [];
    const kpis = u.sectorId ? await this.db.select({ id: s.kpis.id, code: s.kpis.code, nameAr: s.kpis.nameAr, status: s.kpis.status }).from(s.kpis).where(eq(s.kpis.ownerSectorId, u.sectorId)) : [];
    const history = await this.db.select({ id: s.changeLog.id, field: s.changeLog.field, oldValue: s.changeLog.oldValue, newValue: s.changeLog.newValue, reasonAr: s.changeLog.reasonAr, createdAt: s.changeLog.createdAt, userName: s.users.fullName }).from(s.changeLog).leftJoin(s.users, eq(s.users.id, s.changeLog.userId)).where(and(eq(s.changeLog.entity, "org_units"), eq(s.changeLog.entityId, id))).orderBy(desc(s.changeLog.id)).limit(20);
    return { unit: u, lineage, children, subtree: { units: sub.length - 1, positions: sub.reduce((a, x) => a + x.positions, 0), headcount: sub.reduce((a, x) => a + x.headcount, 0) }, requests, affectedBy: affected, initiatives, kpis, history };
  }

  async requests() { return this.requestsBase(); }

  async request(id: number) {
    const [r] = await this.db.select().from(s.orgRequests).where(eq(s.orgRequests.id, id)).limit(1); if (!r) return null;
    const units = await this.unitsAll(); const name = (uid: number | null) => units.find((u) => u.id === uid)?.nameAr ?? null;
    const changes = await this.db.select().from(s.orgRequestUnits).where(eq(s.orgRequestUnits.requestId, id));
    const wf = await this.wf.status("org_requests", id);
    const project = r.relatedProjectId ? (await this.db.select({ id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, progress: s.projects.progress }).from(s.projects).where(eq(s.projects.id, r.relatedProjectId)))[0] : null;
    // as-is / to-be: the affected parent subtree today, and after the proposed changes
    const parentIds = Array.from(new Set(changes.map((c) => (c.unitId ? units.find((u) => u.id === c.unitId)?.parentId : c.proposedParentId)).filter((x): x is number => !!x)));
    const scopes = parentIds.map((pid) => {
      const parent = units.find((u) => u.id === pid)!; const kids = units.filter((u) => u.parentId === pid && u.status === "معتمد");
      const toBe = kids.map((k) => { const c = changes.find((x) => x.unitId === k.id); return { id: k.id, nameAr: c?.action === "تعديل مسمى" ? c.proposedNameAr! : k.nameAr, level: k.level, positions: k.positions, change: c?.action ?? null, removed: c?.action === "إلغاء" || (c?.action === "نقل تبعية" && c.proposedParentId !== pid) }; })
        .concat(changes.filter((c) => c.action === "استحداث" && c.proposedParentId === pid).map((c) => ({ id: -c.id, nameAr: c.proposedNameAr!, level: c.proposedLevel!, positions: c.proposedPositions ?? 0, change: "استحداث", removed: false })))
        .concat(changes.filter((c) => c.action === "نقل تبعية" && c.proposedParentId === pid && c.unitId).map((c) => { const u = units.find((x) => x.id === c.unitId)!; return { id: u.id, nameAr: u.nameAr, level: u.level, positions: u.positions, change: "نقل تبعية (وارد)", removed: false }; }));
      return { parent: { id: parent.id, nameAr: parent.nameAr, level: parent.level }, asIs: kids.map((k) => ({ id: k.id, nameAr: k.nameAr, level: k.level, positions: k.positions })), toBe };
    });
    return { request: { ...r, requestingUnit: name(r.requestingUnitId) }, changes: changes.map((c) => ({ ...c, unitName: name(c.unitId), proposedParentName: name(c.proposedParentId) })), workflow: wf ? { instanceId: wf.id, stage: wf.stage, stageIndex: wf.stageIndex, stages: wf.stages, status: wf.status, daysInStage: wf.daysInStage, slaBreached: wf.slaBreached, history: wf.history } : null, project, scopes };
  }

  async createRequest(input: any, actor: Actor) {
    const req = { requestingUnitId: Number(input.requestingUnitId), type: String(input.type ?? ""), titleAr: String(input.titleAr ?? "").trim(), descriptionAr: String(input.descriptionAr ?? "").trim(), justificationAr: String(input.justificationAr ?? "").trim(), impactHeadcount: Number(input.impactHeadcount ?? 0), impactBudget: Number(input.impactBudget ?? 0), decisionAuthority: String(input.decisionAuthority ?? "الرئيس التنفيذي"), priority: String(input.priority ?? "متوسطة"), relatedProjectId: input.relatedProjectId ? Number(input.relatedProjectId) : null, correspondenceRef: input.correspondenceRef ? String(input.correspondenceRef) : null, duplicationNoteAr: input.duplicationNoteAr ? String(input.duplicationNoteAr) : null };
    if (!s.ORG_REQUEST_TYPES.includes(req.type as any)) throw Object.assign(new Error("نوع الطلب غير صحيح"), { status: 400 });
    if (!req.titleAr || !req.descriptionAr || !req.justificationAr) throw Object.assign(new Error("العنوان والوصف والمبرر مطلوبة"), { status: 400 });
    if (!s.ORG_AUTHORITIES.includes(req.decisionAuthority as any)) throw Object.assign(new Error("جهة القرار غير صحيحة"), { status: 400 });
    const [n] = await this.db.select({ n: sql<number>`count(*)` }).from(s.orgRequests);
    const [created] = await this.db.insert(s.orgRequests).values({ ...req, code: `ORG-${String(Number(n.n) + 1).padStart(3, "0")}`, receivedAt: new Date().toISOString().slice(0, 10), checklist: [{ item: "تحديث الهيكل المعتمد", done: false }, { item: "تحديث الدليل التنظيمي", done: false }, { item: "تحديث نظام الموارد البشرية", done: false }] }).returning();
    const changes = Array.isArray(input.changes) ? input.changes : [];
    if (changes.length) await this.db.insert(s.orgRequestUnits).values(changes.map((c: any) => ({ requestId: created.id, unitId: c.unitId ? Number(c.unitId) : null, action: String(c.action), proposedNameAr: c.proposedNameAr ?? null, proposedParentId: c.proposedParentId ? Number(c.proposedParentId) : null, proposedLevel: c.proposedLevel ?? null, proposedPositions: c.proposedPositions ? Number(c.proposedPositions) : null })));
    await this.wf.start("org_request", "org_requests", created.id, actor, req.correspondenceRef ? `وارد برقم ${req.correspondenceRef}` : undefined);
    await this.db.insert(s.changeLog).values({ entity: "org_requests", entityId: created.id, field: "*", oldValue: null, newValue: `تسجيل طلب ${created.code}`, userId: actor.userId });
    return created;
  }

  /** On workflow completion the structure changes are applied (units created / renamed / moved / retired), versioned and audited. */
  async applyOutcome(requestId: number, outcome: "completed" | "rejected", actor: { userId: number }) {
    const [r] = await this.db.select().from(s.orgRequests).where(eq(s.orgRequests.id, requestId)).limit(1);
    if (!r || r.status !== "قيد الإجراء") return;
    if (outcome === "rejected") { await this.db.update(s.orgRequests).set({ status: "مرفوض" }).where(eq(s.orgRequests.id, requestId)); return; }
    const changes = await this.db.select().from(s.orgRequestUnits).where(eq(s.orgRequestUnits.requestId, requestId));
    const [cnt] = await this.db.select({ n: sql<number>`count(*)` }).from(s.orgUnits); let n = Number(cnt.n);
    for (const c of changes) {
      if (c.action === "استحداث" && c.proposedNameAr && c.proposedParentId) {
        const [parent] = await this.db.select().from(s.orgUnits).where(eq(s.orgUnits.id, c.proposedParentId)).limit(1);
        const [u] = await this.db.insert(s.orgUnits).values({ code: `OU-${String(++n).padStart(3, "0")}`, nameAr: c.proposedNameAr, level: c.proposedLevel ?? "إدارة", parentId: c.proposedParentId, positions: c.proposedPositions ?? 0, headcount: 0, sectorId: parent?.sectorId ?? null, status: "معتمد", effectiveFrom: new Date().toISOString().slice(0, 10) }).returning();
        await this.db.insert(s.changeLog).values({ entity: "org_units", entityId: u.id, field: "*", oldValue: null, newValue: `استحداث بموجب ${r.code}`, userId: actor.userId });
      } else if (c.unitId) {
        const [u] = await this.db.select().from(s.orgUnits).where(eq(s.orgUnits.id, c.unitId)).limit(1); if (!u) continue;
        const set: Record<string, unknown> = { version: u.version + 1 }; const log: { field: string; oldValue: string | null; newValue: string | null }[] = [];
        if (c.action === "تعديل مسمى" && c.proposedNameAr) { set.nameAr = c.proposedNameAr; log.push({ field: "nameAr", oldValue: u.nameAr, newValue: c.proposedNameAr }); }
        if (c.action === "نقل تبعية" && c.proposedParentId) { set.parentId = c.proposedParentId; log.push({ field: "parentId", oldValue: String(u.parentId), newValue: String(c.proposedParentId) }); }
        if (c.action === "إلغاء") { set.status = "ملغى"; log.push({ field: "status", oldValue: u.status, newValue: "ملغى" }); }
        if (c.action === "تعديل توصيف") log.push({ field: "functionsAr", oldValue: u.functionsAr, newValue: `تحديث التوصيف بموجب ${r.code}` });
        await this.db.update(s.orgUnits).set(set).where(eq(s.orgUnits.id, u.id));
        if (log.length) await this.db.insert(s.changeLog).values(log.map((l) => ({ entity: "org_units", entityId: u.id, ...l, reasonAr: `تنفيذ ${r.code}`, userId: actor.userId })));
      }
    }
    await this.db.update(s.orgRequests).set({ status: "منفذ", checklist: r.checklist.map((x) => ({ ...x, done: x.item === "تحديث الهيكل المعتمد" ? true : x.done })) }).where(eq(s.orgRequests.id, requestId));
  }

  async setChecklist(requestId: number, checklist: { item: string; done: boolean }[], actor: Actor) {
    await this.db.update(s.orgRequests).set({ checklist }).where(eq(s.orgRequests.id, requestId));
    await this.db.insert(s.changeLog).values({ entity: "org_requests", entityId: requestId, field: "checklist", oldValue: null, newValue: checklist.filter((c) => c.done).map((c) => c.item).join("، "), userId: actor.userId });
    return { ok: true };
  }
}
export { inArray };
