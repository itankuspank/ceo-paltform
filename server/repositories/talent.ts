import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { WorkflowEngine } from "../workflow";
import { canSeeCandidateName } from "../../shared/rbac";

const DAY = 86400000;
const r1 = (v: number) => Math.round(v * 10) / 10;
type Actor = { userId: number; role: s.Role; modules?: string[] };
const mask = (name: string) => { const p = name.split(" "); return `${p[0]} ${"•".repeat(4)}`; };
const HOURLY_BY_BAND: Record<string, number> = { "قيادي": 320, "خبير": 260, "أول": 210, "متخصص": 170 };

export class TalentRepository {
  constructor(private db: Db, private wf: WorkflowEngine) {}

  private async base() {
    const rows = await this.db.select({
      id: s.candidates.id, code: s.candidates.code, nameAr: s.candidates.nameAr, engagementType: s.candidates.engagementType, sourceAr: s.candidates.sourceAr, currentRoleAr: s.candidates.currentRoleAr,
      clearanceStatus: s.candidates.clearanceStatus, monthlyRate: s.candidates.monthlyRate, secondmentMonths: s.candidates.secondmentMonths, referenceAr: s.candidates.referenceAr, onboardedResourceId: s.candidates.onboardedResourceId,
      onboardedAt: s.candidates.onboardedAt, status: s.candidates.status, createdAt: s.candidates.createdAt,
      requisitionId: s.requisitions.id, reqCode: s.requisitions.code, roleAr: s.requisitions.roleAr, band: s.requisitions.band, isSenior: s.requisitions.isSenior, priority: s.requisitions.priority, targetStart: s.requisitions.targetStart, requestedAt: s.requisitions.requestedAt,
      sectorId: s.sectors.id, sectorName: s.sectors.nameAr, projectId: s.projects.id, projectName: s.projects.nameAr,
    }).from(s.candidates).innerJoin(s.requisitions, eq(s.requisitions.id, s.candidates.requisitionId)).innerJoin(s.sectors, eq(s.sectors.id, s.requisitions.sectorId)).leftJoin(s.projects, eq(s.projects.id, s.requisitions.projectId)).orderBy(asc(s.candidates.id));
    const defs = await this.wf.definitions();
    const insts = await this.db.select().from(s.workflowInstances).where(eq(s.workflowInstances.entity, "candidates"));
    const byEntity = Object.fromEntries(insts.map((i) => [i.entityId, i]));
    return rows.map((c) => {
      const inst = byEntity[c.id]; const d = inst ? defs.find((x) => x.id === inst.definitionId)! : null; const idx = d ? d.stages.findIndex((x) => x.key === inst!.currentStage) : -1; const stage = d ? d.stages[idx] : null;
      const days = inst ? Math.floor((Date.now() - new Date(inst.stageEnteredAt).getTime()) / DAY) : 0;
      return { ...c, workflow: inst && d && stage ? { instanceId: inst.id, definitionKey: d.key, stages: d.stages, stage, stageIndex: idx, status: inst.status, daysInStage: days, slaBreached: inst.status === "active" && stage.slaDays > 0 && days > stage.slaDays } : null };
    });
  }

  private applyPrivacy<T extends { nameAr: string; isSenior: boolean }>(rows: T[], actor: Actor) {
    return rows.map((r) => ({ ...r, nameAr: canSeeCandidateName(actor.role, actor.modules, r.isSenior) ? r.nameAr : mask(r.nameAr), nameMasked: !canSeeCandidateName(actor.role, actor.modules, r.isSenior) }));
  }

  async dashboard(actor: Actor) {
    const cands = await this.base(); const reqs = await this.db.select({ id: s.requisitions.id, code: s.requisitions.code, roleAr: s.requisitions.roleAr, engagementType: s.requisitions.engagementType, count: s.requisitions.count, filled: s.requisitions.filled, priority: s.requisitions.priority, status: s.requisitions.status, targetStart: s.requisitions.targetStart, requestedAt: s.requisitions.requestedAt, isSenior: s.requisitions.isSenior, sectorName: s.sectors.nameAr, projectName: s.projects.nameAr, projectId: s.projects.id })
      .from(s.requisitions).innerJoin(s.sectors, eq(s.sectors.id, s.requisitions.sectorId)).leftJoin(s.projects, eq(s.projects.id, s.requisitions.projectId));
    const open = reqs.filter((r) => r.status !== "ملغى");
    const needed = open.reduce((a, r) => a + r.count, 0), filled = open.reduce((a, r) => a + r.filled, 0);
    const active = cands.filter((c) => c.status === "قيد الإجراء");
    const byType = s.ENGAGEMENT_TYPES.map((t) => { const rq = open.filter((r) => r.engagementType === t); const ac = active.filter((c) => c.engagementType === t); return { type: t, needed: rq.reduce((a, r) => a + r.count, 0), filled: rq.reduce((a, r) => a + r.filled, 0), pipeline: ac.length, breached: ac.filter((c) => c.workflow?.slaBreached).length }; });
    const bySector = Object.values(open.reduce((acc, r) => { const g = (acc[r.sectorName] ??= { sector: r.sectorName, needed: 0, filled: 0 }); g.needed += r.count; g.filled += r.filled; return acc; }, {} as Record<string, { sector: string; needed: number; filled: number }>)).sort((a, b) => (b.needed - b.filled) - (a.needed - a.filled));
    const funnels = [] as any[];
    for (const t of s.ENGAGEMENT_TYPES) { const c = await this.wf.counts(s.ENGAGEMENT_WORKFLOW[t]); funnels.push({ type: t, stages: c.byStage.map((st) => ({ key: st.key, nameAr: st.nameAr, ownerRole: st.ownerRole, slaDays: st.slaDays, active: st.active })), completed: c.completed, rejected: c.rejected }); }
    const onboarded = cands.filter((c) => c.status === "مباشر" && c.onboardedAt);
    const ttf = onboarded.length ? r1(onboarded.reduce((a, c) => a + (new Date(c.onboardedAt!).getTime() - new Date(c.requestedAt).getTime()) / DAY, 0) / onboarded.length) : 0;
    const critical = open.filter((r) => r.priority === "عاجلة" && r.filled < r.count).map((r) => ({ ...r, gap: r.count - r.filled, pipeline: active.filter((c) => c.requisitionId === r.id).length, overdue: new Date(r.targetStart) < new Date() }));
    // expected joiners by month: candidates in the last two stages → estimated by remaining SLA
    const joiners: Record<string, number> = {};
    for (const c of active) { if (!c.workflow) continue; const remaining = c.workflow.stages.slice(c.workflow.stageIndex).reduce((a, st) => a + st.slaDays, 0) - c.workflow.daysInStage; const eta = new Date(Date.now() + Math.max(3, remaining) * DAY); const k = `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, "0")}`; joiners[k] = (joiners[k] ?? 0) + 1; }
    const expectedJoiners = Object.entries(joiners).sort(([a], [b]) => a.localeCompare(b)).slice(0, 6).map(([month, n]) => ({ month, n }));
    const clearanceBacklog = active.filter((c) => c.clearanceStatus === "قيد الفحص").length;
    return {
      summary: { needed, filled, gap: needed - filled, pipeline: active.length, fillRate: needed ? r1((filled / needed) * 100) : 0, timeToFill: ttf, slaBreaches: active.filter((c) => c.workflow?.slaBreached).length, clearanceBacklog, awaitingCeo: active.filter((c) => c.workflow?.stage.requiresDecision).length },
      byType, bySector, funnels, critical: this.applyPrivacy(critical.map((c) => ({ ...c, nameAr: "" })), actor).map(({ nameAr: _n, nameMasked: _m, ...rest }) => rest), expectedJoiners,
      recentJoiners: this.applyPrivacy(onboarded.sort((a, b) => (b.onboardedAt! > a.onboardedAt! ? 1 : -1)).slice(0, 6), actor).map((c) => ({ id: c.id, nameAr: c.nameAr, nameMasked: c.nameMasked, roleAr: c.roleAr, engagementType: c.engagementType, onboardedAt: c.onboardedAt, resourceId: c.onboardedResourceId })),
    };
  }

  async pipeline(actor: Actor) {
    const cands = await this.base();
    return this.applyPrivacy(cands, actor).map((c) => ({ id: c.id, code: c.code, nameAr: c.nameAr, nameMasked: c.nameMasked, engagementType: c.engagementType, roleAr: c.roleAr, band: c.band, isSenior: c.isSenior, sectorName: c.sectorName, projectName: c.projectName, projectId: c.projectId, sourceAr: c.sourceAr, currentRoleAr: c.currentRoleAr, clearanceStatus: c.clearanceStatus, monthlyRate: c.monthlyRate, secondmentMonths: c.secondmentMonths, referenceAr: c.referenceAr, status: c.status, priority: c.priority, targetStart: c.targetStart, reqCode: c.reqCode, requisitionId: c.requisitionId, onboardedResourceId: c.onboardedResourceId, onboardedAt: c.onboardedAt, workflow: c.workflow }));
  }

  async requisitions() {
    const reqs = await this.db.select({ id: s.requisitions.id, code: s.requisitions.code, roleAr: s.requisitions.roleAr, engagementType: s.requisitions.engagementType, band: s.requisitions.band, count: s.requisitions.count, filled: s.requisitions.filled, priority: s.requisitions.priority, isSenior: s.requisitions.isSenior, requestedAt: s.requisitions.requestedAt, targetStart: s.requisitions.targetStart, status: s.requisitions.status, justificationAr: s.requisitions.justificationAr, sectorId: s.sectors.id, sectorName: s.sectors.nameAr, projectId: s.projects.id, projectName: s.projects.nameAr })
      .from(s.requisitions).innerJoin(s.sectors, eq(s.sectors.id, s.requisitions.sectorId)).leftJoin(s.projects, eq(s.projects.id, s.requisitions.projectId)).orderBy(desc(s.requisitions.id));
    const cands = await this.base();
    return reqs.map((r) => ({ ...r, pipeline: cands.filter((c) => c.requisitionId === r.id && c.status === "قيد الإجراء").length, dropped: cands.filter((c) => c.requisitionId === r.id && c.status === "مستبعد").length, ageDays: Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / DAY), overdue: r.status === "مفتوح" && new Date(r.targetStart) < new Date() }));
  }

  async createRequisition(input: any, actor: Actor) {
    const type = String(input.engagementType ?? ""); if (!s.ENGAGEMENT_TYPES.includes(type as any)) throw Object.assign(new Error("نوع الاستقطاب غير صحيح"), { status: 400 });
    if (!String(input.roleAr ?? "").trim()) throw Object.assign(new Error("المسمى الوظيفي مطلوب"), { status: 400 });
    if (!s.BANDS.includes(String(input.band) as any)) throw Object.assign(new Error("الفئة غير صحيحة"), { status: 400 });
    const [n] = await this.db.select({ n: sql<number>`count(*)` }).from(s.requisitions);
    const [created] = await this.db.insert(s.requisitions).values({ code: `REQ-${String(Number(n.n) + 1).padStart(3, "0")}`, roleAr: String(input.roleAr).trim(), sectorId: Number(input.sectorId), projectId: input.projectId ? Number(input.projectId) : null, engagementType: type as s.EngagementType, band: String(input.band), count: Math.max(1, Number(input.count ?? 1)), priority: String(input.priority ?? "متوسطة"), isSenior: !!input.isSenior, requestedAt: new Date().toISOString().slice(0, 10), targetStart: String(input.targetStart ?? new Date().toISOString().slice(0, 10)), justificationAr: input.justificationAr ? String(input.justificationAr) : null }).returning();
    await this.db.insert(s.changeLog).values({ entity: "requisitions", entityId: created.id, field: "*", oldValue: null, newValue: `تسجيل احتياج ${created.code}`, userId: actor.userId });
    return created;
  }

  async createCandidate(input: any, actor: Actor) {
    const [rq] = await this.db.select().from(s.requisitions).where(eq(s.requisitions.id, Number(input.requisitionId))).limit(1);
    if (!rq) throw Object.assign(new Error("الاحتياج غير موجود"), { status: 404 });
    if (rq.status !== "مفتوح") throw Object.assign(new Error("الاحتياج غير مفتوح للترشيح"), { status: 400 });
    if (!String(input.nameAr ?? "").trim()) throw Object.assign(new Error("اسم المرشح مطلوب"), { status: 400 });
    const [n] = await this.db.select({ n: sql<number>`count(*)` }).from(s.candidates);
    const [cand] = await this.db.insert(s.candidates).values({ code: `CND-${String(Number(n.n) + 1).padStart(3, "0")}`, nameAr: String(input.nameAr).trim(), requisitionId: rq.id, engagementType: rq.engagementType, sourceAr: input.sourceAr ? String(input.sourceAr) : null, currentRoleAr: input.currentRoleAr ? String(input.currentRoleAr) : null, monthlyRate: input.monthlyRate ? Number(input.monthlyRate) : null, secondmentMonths: input.secondmentMonths ? Number(input.secondmentMonths) : null }).returning();
    await this.wf.start(s.ENGAGEMENT_WORKFLOW[rq.engagementType], "candidates", cand.id, actor, `ترشيح على الاحتياج ${rq.code}`);
    await this.db.insert(s.changeLog).values({ entity: "candidates", entityId: cand.id, field: "*", oldValue: null, newValue: `تسجيل مرشح ${cand.code}`, userId: actor.userId });
    return cand;
  }

  async setClearance(id: number, status: string, actor: Actor) {
    if (!s.CLEARANCE.includes(status as any)) throw Object.assign(new Error("حالة الفحص غير صحيحة"), { status: 400 });
    const [c] = await this.db.select().from(s.candidates).where(eq(s.candidates.id, id)).limit(1); if (!c) throw Object.assign(new Error("المرشح غير موجود"), { status: 404 });
    await this.db.update(s.candidates).set({ clearanceStatus: status }).where(eq(s.candidates.id, id));
    await this.db.insert(s.changeLog).values({ entity: "candidates", entityId: id, field: "clearanceStatus", oldValue: c.clearanceStatus, newValue: status, userId: actor.userId });
    return { ok: true };
  }

  /** Pre-condition for the final stage: contractors must hold a security clearance before onboarding. */
  async assertCanOnboard(candidateId: number) {
    const [c] = await this.db.select().from(s.candidates).where(eq(s.candidates.id, candidateId)).limit(1);
    if (c && c.status === "قيد الإجراء" && c.engagementType === "متعاقد" && c.clearanceStatus !== "مجاز") throw Object.assign(new Error("لا يمكن المباشرة قبل اجتياز الفحص الأمني"), { status: 400 });
  }

  /** Workflow completion = onboarding: create the HR resource record, link it, fill the requisition. Rejection = dropped. */
  async applyOutcome(candidateId: number, outcome: "completed" | "rejected", actor: { userId: number }) {
    const [c] = await this.db.select().from(s.candidates).where(eq(s.candidates.id, candidateId)).limit(1);
    if (!c || c.status !== "قيد الإجراء") return;
    if (outcome === "rejected") { await this.db.update(s.candidates).set({ status: "مستبعد" }).where(eq(s.candidates.id, candidateId)); return; }
    const [rq] = await this.db.select().from(s.requisitions).where(eq(s.requisitions.id, c.requisitionId)).limit(1);
    const [sector] = await this.db.select().from(s.sectors).where(eq(s.sectors.id, rq!.sectorId)).limit(1);
    const [res] = await this.db.insert(s.resources).values({ nameAr: c.nameAr, roleAr: rq!.roleAr, departmentAr: sector?.nameAr ?? "برنامج تطوير وزارة الداخلية", capacityHours: 160, leaveHours: 0, trainingHours: 0, hourlyCost: c.monthlyRate ? Math.round((c.monthlyRate * 1000) / 160) : HOURLY_BY_BAND[rq!.band] ?? 200 }).returning();
    const today = new Date().toISOString().slice(0, 10);
    await this.db.update(s.candidates).set({ status: "مباشر", onboardedResourceId: res.id, onboardedAt: today }).where(eq(s.candidates.id, candidateId));
    const filled = rq!.filled + 1;
    await this.db.update(s.requisitions).set({ filled, status: filled >= rq!.count ? "مكتمل" : "مفتوح" }).where(eq(s.requisitions.id, rq!.id));
    await this.db.insert(s.changeLog).values([
      { entity: "resources", entityId: res.id, field: "*", oldValue: null, newValue: `إنشاء سجل مورد عند مباشرة ${c.code}`, userId: actor.userId },
      { entity: "candidates", entityId: candidateId, field: "status", oldValue: "قيد الإجراء", newValue: "مباشر", userId: actor.userId },
    ]);
  }
}
