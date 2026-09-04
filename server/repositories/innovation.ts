import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { maturityOverall } from "../../shared/schema";
import { WorkflowEngine } from "../workflow";

const DAY = 86400000;
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
type Actor = { userId: number; role: s.Role };
export const CURRENT_CYCLE = "2026-H2"; const PREVIOUS_CYCLE = "2026-H1";
const levelStatus = (lvl: number) => (lvl >= 4 ? "on_track" : lvl >= 3 ? "at_risk" : "off_track");

export class InnovationRepository {
  constructor(private db: Db, private wf: WorkflowEngine) {}

  async dimensions() { return this.db.select().from(s.innovationDimensions).orderBy(asc(s.innovationDimensions.sortOrder)); }

  private async subjects() {
    const sectors = await this.db.select({ id: s.sectors.id, nameAr: s.sectors.nameAr }).from(s.sectors);
    const regions = await this.db.select({ id: s.regions.id, code: s.regions.code, nameAr: s.regions.nameAr }).from(s.regions);
    return { sectors, regions };
  }

  private async published(cycle: string) { return this.db.select().from(s.innovationAssessments).where(and(eq(s.innovationAssessments.cycle, cycle), eq(s.innovationAssessments.status, "منشور"))); }

  private async withTrend(type: "sector" | "region") {
    const cur = (await this.published(CURRENT_CYCLE)).filter((a) => a.subjectType === type);
    const prev = (await this.published(PREVIOUS_CYCLE)).filter((a) => a.subjectType === type);
    const targets = await this.db.select().from(s.innovationTargets).where(and(eq(s.innovationTargets.cycle, CURRENT_CYCLE), eq(s.innovationTargets.subjectType, type)));
    return cur.map((a) => { const p = prev.find((x) => x.subjectId === a.subjectId); const t = targets.find((x) => x.subjectId === a.subjectId); return { ...a, previous: p?.overall ?? null, delta: p ? r2(a.overall - p.overall) : null, target: t?.targetLevel ?? null, gap: t ? r2(t.targetLevel - a.overall) : null, status: levelStatus(a.overall) }; });
  }

  async map() {
    const { sectors, regions } = await this.subjects();
    const rs = await this.withTrend("region"); const ss = await this.withTrend("sector");
    const kingdom = r2(rs.reduce((a, x) => a + x.overall, 0) / (rs.length || 1)); const kingdomPrev = r2(rs.reduce((a, x) => a + (x.previous ?? x.overall), 0) / (rs.length || 1));
    const dims = await this.dimensions();
    const ideas = await this.db.select({ id: s.innovationIdeas.id, sourceType: s.innovationIdeas.sourceType, sourceId: s.innovationIdeas.sourceId, status: s.innovationIdeas.status }).from(s.innovationIdeas);
    return {
      cycle: CURRENT_CYCLE, previousCycle: PREVIOUS_CYCLE, dims,
      kingdom: { index: kingdom, previous: kingdomPrev, delta: r2(kingdom - kingdomPrev), level: Math.round(kingdom), status: levelStatus(kingdom), byLevel: [1, 2, 3, 4, 5].map((l) => ({ level: l, regions: rs.filter((x) => Math.round(x.overall) === l).length, sectors: ss.filter((x) => Math.round(x.overall) === l).length })) },
      regions: rs.map((a) => { const r = regions.find((x) => x.id === a.subjectId)!; return { id: r.id, code: r.code, nameAr: r.nameAr, overall: a.overall, level: Math.round(a.overall), status: a.status, previous: a.previous, delta: a.delta, target: a.target, gap: a.gap, scores: a.scores, evidenceAr: a.evidenceAr, ideas: ideas.filter((i) => i.sourceType === "region" && i.sourceId === r.id).length }; }),
      sectors: ss.map((a) => { const sc = sectors.find((x) => x.id === a.subjectId)!; return { id: sc.id, nameAr: sc.nameAr, overall: a.overall, level: Math.round(a.overall), status: a.status, delta: a.delta, gap: a.gap }; }).sort((a, b) => b.overall - a.overall),
    };
  }

  async matrix() {
    const { sectors, regions } = await this.subjects(); const dims = await this.dimensions();
    const ss = await this.withTrend("sector"); const rs = await this.withTrend("region");
    const prevAll = await this.published(PREVIOUS_CYCLE);
    const drafts = await this.db.select().from(s.innovationAssessments).where(and(eq(s.innovationAssessments.cycle, CURRENT_CYCLE), eq(s.innovationAssessments.status, "مسودة")));
    const row = (a: typeof ss[number], nameAr: string) => { const p = prevAll.find((x) => x.subjectType === a.subjectType && x.subjectId === a.subjectId); return { subjectType: a.subjectType, subjectId: a.subjectId, nameAr, overall: a.overall, level: Math.round(a.overall), status: a.status, previous: a.previous, delta: a.delta, target: a.target, gap: a.gap, evidenceAr: a.evidenceAr, assessedAt: a.assessedAt, scores: dims.map((d) => ({ key: d.key, score: a.scores[d.key] ?? 0, previous: p?.scores[d.key] ?? null })) }; };
    const dimAvg = dims.map((d) => ({ key: d.key, nameAr: d.nameAr, weight: d.weight, sectors: r2(ss.reduce((a, x) => a + (x.scores[d.key] ?? 0), 0) / (ss.length || 1)), regions: r2(rs.reduce((a, x) => a + (x.scores[d.key] ?? 0), 0) / (rs.length || 1)) }));
    return { cycle: CURRENT_CYCLE, dims, sectors: ss.map((a) => row(a, sectors.find((x) => x.id === a.subjectId)!.nameAr)).sort((a, b) => b.overall - a.overall), regions: rs.map((a) => row(a, regions.find((x) => x.id === a.subjectId)!.nameAr)).sort((a, b) => b.overall - a.overall), dimAvg, drafts: drafts.map((d) => ({ id: d.id, subjectType: d.subjectType, subjectId: d.subjectId, nameAr: d.subjectType === "sector" ? sectors.find((x) => x.id === d.subjectId)?.nameAr : regions.find((x) => x.id === d.subjectId)?.nameAr, overall: d.overall, assessorAr: d.assessorAr, assessedAt: d.assessedAt })), weakest: dimAvg.slice().sort((a, b) => (a.sectors + a.regions) - (b.sectors + b.regions)).slice(0, 2) };
  }

  async ideas() {
    const { sectors, regions } = await this.subjects();
    const rows = await this.db.select({ id: s.innovationIdeas.id, code: s.innovationIdeas.code, titleAr: s.innovationIdeas.titleAr, descriptionAr: s.innovationIdeas.descriptionAr, category: s.innovationIdeas.category, sourceType: s.innovationIdeas.sourceType, sourceId: s.innovationIdeas.sourceId, submittedByAr: s.innovationIdeas.submittedByAr, submittedAt: s.innovationIdeas.submittedAt, impactValue: s.innovationIdeas.impactValue, impactNoteAr: s.innovationIdeas.impactNoteAr, status: s.innovationIdeas.status, linkedProjectId: s.innovationIdeas.linkedProjectId, linkedProject: s.projects.nameAr })
      .from(s.innovationIdeas).leftJoin(s.projects, eq(s.projects.id, s.innovationIdeas.linkedProjectId)).orderBy(desc(s.innovationIdeas.id));
    const pipeline = await this.wf.pipeline("innovation_idea"); const byEntity = Object.fromEntries(pipeline.map((p) => [p.entityId, p])); const def = await this.wf.definition("innovation_idea");
    const list = rows.map((i) => { const w = byEntity[i.id]; return { ...i, sourceName: i.sourceType === "sector" ? sectors.find((x) => x.id === i.sourceId)?.nameAr : regions.find((x) => x.id === i.sourceId)?.nameAr, ageDays: Math.floor((Date.now() - new Date(i.submittedAt).getTime()) / DAY), workflow: w ? { instanceId: w.id, stage: w.stage, stageIndex: w.stageIndex, stages: def.stages, status: w.status, daysInStage: w.daysInStage, slaBreached: w.slaBreached } : null }; });
    const counts = await this.wf.counts("innovation_idea");
    const [emp] = await this.db.select({ n: sql<number>`count(*)` }).from(s.resources);
    const piloted = list.filter((i) => (i.workflow?.stageIndex ?? 0) >= 3 || i.status === "موسّعة");
    const hist = await this.db.select({ instanceId: s.workflowHistory.instanceId, toStage: s.workflowHistory.toStage, createdAt: s.workflowHistory.createdAt }).from(s.workflowHistory).where(eq(s.workflowHistory.toStage, "pilot"));
    const ideaToPilot = hist.length ? r1(hist.reduce((a, h) => { const inst = pipeline.find((p) => p.id === h.instanceId); const idea = inst ? list.find((i) => i.id === inst.entityId) : null; return a + (idea ? (new Date(h.createdAt).getTime() - new Date(idea.submittedAt).getTime()) / DAY : 0); }, 0) / hist.length) : 0;
    const tagged = await this.db.select({ id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, progress: s.projects.progress, portfolio: s.portfolios.nameAr }).from(s.projects).innerJoin(s.portfolios, eq(s.portfolios.id, s.projects.portfolioId)).where(sql`'ابتكار' = any(${s.projects.tags})`);
    return {
      ideas: list, funnel: counts.byStage, completed: counts.completed, rejected: counts.rejected,
      kpis: { total: list.length, per100: r1((list.length / Math.max(1, Number(emp.n))) * 100), implementedPct: list.length ? r1((list.filter((i) => i.status === "موسّعة").length / list.length) * 100) : 0, ideaToPilotDays: ideaToPilot, realisedImpact: r1(list.filter((i) => i.status === "موسّعة").reduce((a, i) => a + i.impactValue, 0)), pipelineImpact: r1(list.filter((i) => i.status === "قيد الإجراء").reduce((a, i) => a + i.impactValue, 0)), piloted: piloted.length, awaitingCeo: list.filter((i) => i.workflow?.status === "active" && i.workflow.stage.requiresDecision).length },
      byCategory: s.IDEA_CATEGORIES.map((c) => ({ category: c, n: list.filter((i) => i.category === c).length })), tagged,
    };
  }

  async submitAssessment(input: any, actor: Actor) {
    const type = String(input.subjectType); const id = Number(input.subjectId); if (!["sector", "region"].includes(type) || !id) throw Object.assign(new Error("الجهة المقيَّمة غير صحيحة"), { status: 400 });
    const dims = await this.dimensions(); const scores: Record<string, number> = {};
    for (const d of dims) { const v = Number(input.scores?.[d.key]); if (!(v >= 1 && v <= 5)) throw Object.assign(new Error(`درجة «${d.nameAr}» يجب أن تكون بين 1 و 5`), { status: 400 }); scores[d.key] = Math.round(v); }
    const overall = maturityOverall(scores, dims);
    const existing = await this.db.select().from(s.innovationAssessments).where(and(eq(s.innovationAssessments.cycle, CURRENT_CYCLE), eq(s.innovationAssessments.subjectType, type), eq(s.innovationAssessments.subjectId, id))).limit(1);
    const values = { scores, overall, level: Math.round(overall), assessorAr: String(input.assessorAr ?? "منسق الابتكار"), evidenceAr: input.evidenceAr ? String(input.evidenceAr) : null, status: "مسودة", assessedAt: new Date().toISOString().slice(0, 10) };
    let row: any;
    if (existing[0]) { [row] = await this.db.update(s.innovationAssessments).set(values).where(eq(s.innovationAssessments.id, existing[0].id)).returning(); }
    else { [row] = await this.db.insert(s.innovationAssessments).values({ cycle: CURRENT_CYCLE, subjectType: type, subjectId: id, ...values }).returning(); }
    await this.db.insert(s.changeLog).values({ entity: "innovation_assessments", entityId: row.id, field: "scores", oldValue: existing[0] ? JSON.stringify(existing[0].scores) : null, newValue: JSON.stringify(scores), reasonAr: "تقييم نضج الابتكار — مسودة بانتظار النشر", userId: actor.userId });
    return row;
  }

  async publishAssessment(id: number, actor: Actor) {
    const [a] = await this.db.select().from(s.innovationAssessments).where(eq(s.innovationAssessments.id, id)).limit(1); if (!a) throw Object.assign(new Error("التقييم غير موجود"), { status: 404 });
    await this.db.update(s.innovationAssessments).set({ status: "منشور" }).where(eq(s.innovationAssessments.id, id));
    await this.db.insert(s.changeLog).values({ entity: "innovation_assessments", entityId: id, field: "status", oldValue: "مسودة", newValue: "منشور", userId: actor.userId });
    return { ok: true };
  }

  async createIdea(input: any, actor: Actor) {
    if (!String(input.titleAr ?? "").trim() || !String(input.descriptionAr ?? "").trim()) throw Object.assign(new Error("عنوان الفكرة ووصفها مطلوبان"), { status: 400 });
    if (!s.IDEA_CATEGORIES.includes(String(input.category) as any)) throw Object.assign(new Error("تصنيف الفكرة غير صحيح"), { status: 400 });
    const [n] = await this.db.select({ n: sql<number>`count(*)` }).from(s.innovationIdeas);
    const [row] = await this.db.insert(s.innovationIdeas).values({ code: `IDEA-${String(Number(n.n) + 1).padStart(3, "0")}`, titleAr: String(input.titleAr).trim(), descriptionAr: String(input.descriptionAr).trim(), category: String(input.category), sourceType: input.sourceType === "region" ? "region" : "sector", sourceId: Number(input.sourceId), submittedByAr: String(input.submittedByAr ?? "موظف مبادر"), submittedAt: new Date().toISOString().slice(0, 10), impactValue: Number(input.impactValue ?? 0), impactNoteAr: input.impactNoteAr ? String(input.impactNoteAr) : null }).returning();
    await this.wf.start("innovation_idea", "innovation_ideas", row.id, actor);
    await this.db.insert(s.changeLog).values({ entity: "innovation_ideas", entityId: row.id, field: "*", oldValue: null, newValue: `تسجيل فكرة ${row.code}`, userId: actor.userId });
    return row;
  }

  /** Scale-up decision completes the workflow: the idea becomes موسّعة and its estimated impact becomes realised. */
  async applyOutcome(ideaId: number, outcome: "completed" | "rejected", actor: { userId: number }) {
    const [i] = await this.db.select().from(s.innovationIdeas).where(eq(s.innovationIdeas.id, ideaId)).limit(1);
    if (!i || i.status !== "قيد الإجراء") return;
    await this.db.update(s.innovationIdeas).set({ status: outcome === "completed" ? "موسّعة" : "مستبعدة" }).where(eq(s.innovationIdeas.id, ideaId));
    await this.db.insert(s.changeLog).values({ entity: "innovation_ideas", entityId: ideaId, field: "status", oldValue: "قيد الإجراء", newValue: outcome === "completed" ? "موسّعة" : "مستبعدة", userId: actor.userId });
  }
}
