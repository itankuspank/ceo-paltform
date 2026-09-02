import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export class PortfolioRepository {
  constructor(private db: Db) {}

  private async financeTotals(where?: ReturnType<typeof eq>) {
    const q = this.db.select({
      budget: sql<number>`coalesce(sum(${s.financials.budget}),0)`, committed: sql<number>`coalesce(sum(${s.financials.committed}),0)`,
      actual: sql<number>`coalesce(sum(${s.financials.actual}),0)`, eac: sql<number>`coalesce(sum(${s.financials.eac}),0)`,
    }).from(s.financials).innerJoin(s.projects, eq(s.projects.id, s.financials.projectId));
    const [r] = where ? await q.where(where) : await q;
    return { budget: Number(r.budget), committed: Number(r.committed), actual: Number(r.actual), eac: Number(r.eac), variance: Number(r.eac) - Number(r.budget) };
  }

  /** Program rows with aggregates derived from their projects (used by /programs and portfolio detail). */
  private async programRows(portfolioId?: number) {
    const q = this.db.select({
      id: s.programs.id, code: s.programs.code, nameAr: s.programs.nameAr, portfolioId: s.programs.portfolioId, portfolioName: s.portfolios.nameAr, managerName: s.programs.managerName,
      scheduleStatus: s.programs.scheduleStatus, financialStatus: s.programs.financialStatus, status: s.programs.status,
      budget: sql<number>`coalesce(sum(${s.financials.budget}),0)`, actual: sql<number>`coalesce(sum(${s.financials.actual}),0)`, eac: sql<number>`coalesce(sum(${s.financials.eac}),0)`,
      progress: sql<number>`coalesce(avg(${s.projects.progress}),0)`, impact: sql<number>`coalesce(avg(${s.projects.impactAchieved} / nullif(${s.projects.impactTarget},0)) * 100,0)`,
      projectCount: sql<number>`count(${s.projects.id})`,
    }).from(s.programs).innerJoin(s.portfolios, eq(s.portfolios.id, s.programs.portfolioId)).leftJoin(s.projects, eq(s.projects.programId, s.programs.id))
      .leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).groupBy(s.programs.id, s.portfolios.nameAr).orderBy(asc(s.programs.code));
    const rows = portfolioId ? await q.where(eq(s.programs.portfolioId, portfolioId)) : await q;
    return rows.map((r) => ({ ...r, budget: Math.round(Number(r.budget)), actual: Math.round(Number(r.actual)), eac: Math.round(Number(r.eac)), progress: Math.round(Number(r.progress)), impact: Math.round(Number(r.impact)), projectCount: Number(r.projectCount) }));
  }

  async programs() { return this.programRows(); }

  // ---------------------------------------------------------------- /pmo
  async pmoCenter() {
    const fin = await this.financeTotals();
    const [c] = await this.db.select({
      portfolios: sql<number>`(select count(*) from portfolios)`, programs: sql<number>`(select count(*) from programs)`, projects: sql<number>`(select count(*) from projects where is_archived = false)`,
      onTrack: sql<number>`(select count(*) from projects where status='on_track')`, atRisk: sql<number>`(select count(*) from projects where status='at_risk')`, offTrack: sql<number>`(select count(*) from projects where status='off_track')`,
      pendingDecisions: sql<number>`(select count(*) from decisions where status='معلق')`, criticalIssues: sql<number>`(select count(*) from issues where severity='حرجة' and status <> 'مغلقة')`,
      blockedDeps: sql<number>`(select count(*) from dependencies where status='off_track')`, scheduledApprovals: sql<number>`(select count(*) from change_requests_gov where status in ('بانتظار لجنة التغيير','مرفوع للجنة'))`,
      openEscalations: sql<number>`(select count(*) from escalations where status='مفتوحة')`,
    }).from(sql`(select 1) as one`);
    const goals = await this.db.select().from(s.goals);
    const totalInv = goals.reduce((a, g) => a + g.investment, 0);
    const impact = Math.round(goals.reduce((a, g) => a + g.achievedImpact * g.investment, 0) / totalInv);

    const risks = await this.db.select({ probability: s.risks.probability, impact: s.risks.impact }).from(s.risks);
    const heat: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    risks.forEach((r) => { heat[r.probability - 1][r.impact - 1]++; });
    const topRisks = await this.db.select({ id: s.risks.id, titleAr: s.risks.titleAr, ownerAr: s.risks.ownerAr, probability: s.risks.probability, impact: s.risks.impact, projectName: s.projects.nameAr })
      .from(s.risks).innerJoin(s.projects, eq(s.projects.id, s.risks.projectId)).orderBy(desc(sql`${s.risks.probability} * ${s.risks.impact}`)).limit(6);
    const deps = await this.db.execute(sql`select d.id, d.type, d.status, d.note_ar as "noteAr", a.name_ar as "fromName", b.name_ar as "toName"
      from dependencies d join projects a on a.id = d.from_project_id join projects b on b.id = d.to_project_id order by case d.status when 'off_track' then 0 when 'at_risk' then 1 else 2 end, d.id limit 6`);
    const scorecard = await this.db.select({
      id: s.portfolios.id, nameAr: s.portfolios.nameAr, status: s.portfolios.status,
      investment: sql<number>`coalesce(sum(${s.financials.budget}),0)`, spent: sql<number>`coalesce(sum(${s.financials.actual}),0)`, eac: sql<number>`coalesce(sum(${s.financials.eac}),0)`,
      programs: sql<number>`count(distinct ${s.projects.programId})`, projects: sql<number>`count(distinct ${s.projects.id})`,
      impact: sql<number>`coalesce(avg(${s.projects.impactAchieved} / nullif(${s.projects.impactTarget},0)) * 100,0)`,
    }).from(s.portfolios).leftJoin(s.projects, eq(s.projects.portfolioId, s.portfolios.id)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).groupBy(s.portfolios.id).orderBy(asc(s.portfolios.code));

    return {
      counts: { portfolios: Number(c.portfolios), programs: Number(c.programs), projects: Number(c.projects), onTrack: Number(c.onTrack), atRisk: Number(c.atRisk), offTrack: Number(c.offTrack), impact },
      finance: { ...fin, spendPct: pct(fin.actual, fin.budget) },
      governance: { pendingDecisions: Number(c.pendingDecisions), criticalIssues: Number(c.criticalIssues), blockedDeps: Number(c.blockedDeps), scheduledApprovals: Number(c.scheduledApprovals), openEscalations: Number(c.openEscalations) },
      heatmap: heat, topRisks, dependencies: deps.rows as any[],
      scorecard: scorecard.map((r) => ({ ...r, investment: Math.round(Number(r.investment)), spent: Math.round(Number(r.spent)), eac: Math.round(Number(r.eac)), programs: Number(r.programs), projects: Number(r.projects), impact: Math.round(Number(r.impact)) })),
    };
  }

  // ---------------------------------------------------------------- /portfolios/:id
  async portfolioDetail(id: number) {
    const [pf] = await this.db.select().from(s.portfolios).where(eq(s.portfolios.id, id)).limit(1);
    if (!pf) return null;
    const fin = await this.financeTotals(eq(s.projects.portfolioId, id));
    const programs = await this.programRows(id);
    const projects = await this.db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, progress: s.projects.progress, impactTarget: s.projects.impactTarget, impactAchieved: s.projects.impactAchieved,
      programName: s.programs.nameAr, budget: s.financials.budget,
    }).from(s.projects).innerJoin(s.programs, eq(s.programs.id, s.projects.programId)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).where(eq(s.projects.portfolioId, id)).orderBy(asc(s.projects.code));
    const impact = projects.length ? Math.round(projects.reduce((a, p) => a + (p.impactTarget ? p.impactAchieved / p.impactTarget : 0), 0) / projects.length * 100) : 0;
    const on = projects.filter((p) => p.status === "on_track").length;
    return {
      portfolio: pf, finance: fin, programs, projects,
      metrics: {
        impact, onTrack: on, atRisk: projects.filter((p) => p.status === "at_risk").length, offTrack: projects.filter((p) => p.status === "off_track").length,
        spendPct: pct(fin.actual, fin.budget), commitPct: pct(fin.committed, fin.budget), onTrackPct: pct(on, projects.length),
      },
    };
  }

  // ---------------------------------------------------------------- /projects/:id
  async projectDetail(id: number) {
    const [p] = await this.db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, managerName: s.projects.managerName, phase: s.projects.phase, progress: s.projects.progress,
      scheduleStatus: s.projects.scheduleStatus, financialStatus: s.projects.financialStatus, status: s.projects.status, impactTarget: s.projects.impactTarget, impactAchieved: s.projects.impactAchieved,
      impactContribution: s.projects.impactContribution, startDate: s.projects.startDate, endDate: s.projects.endDate,
      programId: s.programs.id, programName: s.programs.nameAr, portfolioId: s.portfolios.id, portfolioName: s.portfolios.nameAr, sectorName: s.sectors.nameAr,
      goalId: s.goals.id, goalName: s.goals.nameAr,
      budget: s.financials.budget, committed: s.financials.committed, actual: s.financials.actual, eac: s.financials.eac,
    }).from(s.projects).innerJoin(s.programs, eq(s.programs.id, s.projects.programId)).innerJoin(s.portfolios, eq(s.portfolios.id, s.projects.portfolioId))
      .innerJoin(s.sectors, eq(s.sectors.id, s.projects.sectorId)).innerJoin(s.goals, eq(s.goals.id, s.projects.goalId)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id))
      .where(eq(s.projects.id, id)).limit(1);
    if (!p) return null;
    const [milestones, deliverables, risks, issues, kpiLink] = await Promise.all([
      this.db.select().from(s.milestones).where(eq(s.milestones.projectId, id)).orderBy(asc(s.milestones.plannedStart)),
      this.db.select().from(s.deliverables).where(eq(s.deliverables.projectId, id)).orderBy(asc(s.deliverables.id)),
      this.db.select().from(s.risks).where(eq(s.risks.projectId, id)).orderBy(desc(sql`${s.risks.probability} * ${s.risks.impact}`)),
      this.db.select().from(s.issues).where(eq(s.issues.projectId, id)).orderBy(desc(s.issues.openedDays)),
      this.db.select({ kpiId: s.kpis.id, kpiName: s.kpis.nameAr, contributionTarget: s.projectKpis.contributionTarget, contributionActual: s.projectKpis.contributionActual })
        .from(s.projectKpis).innerJoin(s.kpis, eq(s.kpis.id, s.projectKpis.kpiId)).where(eq(s.projectKpis.projectId, id)).limit(1),
    ]);
    const budget = p.budget ?? 0;
    return {
      project: p, milestones, deliverables, risks, issues, kpi: kpiLink[0] ?? null,
      finance: { budget, committed: p.committed ?? 0, actual: p.actual ?? 0, eac: p.eac ?? 0, variance: (p.eac ?? 0) - budget, spendPct: pct(p.actual ?? 0, budget), commitPct: pct(p.committed ?? 0, budget) },
      attainment: p.impactTarget ? Math.round((p.impactAchieved / p.impactTarget) * 1000) / 10 : 0,
    };
  }
}
