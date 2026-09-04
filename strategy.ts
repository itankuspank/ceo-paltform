import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";

/** KPI attainment % — direction-aware (lower-is-better KPIs invert the scale). */
export function attainment(k: { baseline: number; target: number; current: number; lowerIsBetter: boolean }): number {
  const span = k.lowerIsBetter ? k.baseline - k.target : k.target - k.baseline;
  if (span === 0) return 100;
  const done = k.lowerIsBetter ? k.baseline - k.current : k.current - k.baseline;
  return Math.round((done / span) * 1000) / 10;
}

export class StrategyRepository {
  constructor(private db: Db) {}

  // ---------------------------------------------------------------- /impact
  async impact() {
    const goals = await this.db.select().from(s.goals).orderBy(asc(s.goals.sortOrder));
    const totalInv = goals.reduce((a, g) => a + g.investment, 0);
    const impact = Math.round(goals.reduce((a, g) => a + g.achievedImpact * g.investment, 0) / totalInv);
    const forecast = impact + 6;
    const series = Array.from({ length: 12 }, (_, m) => {
      const f = (m + 1) / 12;
      return { month: m + 1, actual: Math.round((impact - 12 + 12 * f) * 10) / 10, target: Math.round((impact - 8 + 16 * f) * 10) / 10, forecast: Math.round((impact - 11 + (forecast - impact + 11) * f) * 10) / 10 };
    });

    const rows = await this.db.select({
      id: s.projects.id, nameAr: s.projects.nameAr, budget: s.financials.budget, impactTarget: s.projects.impactTarget, impactAchieved: s.projects.impactAchieved, status: s.projects.status,
    }).from(s.projects).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).where(eq(s.projects.isArchived, false));
    const medInv = [...rows].sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0))[Math.floor(rows.length / 2)]?.budget ?? 0;
    const scatter = rows.map((r) => {
      const attain = r.impactTarget ? (r.impactAchieved / r.impactTarget) * 100 : 0;
      const hiInv = (r.budget ?? 0) >= medInv; const hiImp = attain >= 70;
      return { id: r.id, nameAr: r.nameAr, x: Math.round(r.budget ?? 0), y: Math.round(attain), quadrant: hiInv && hiImp ? "hi_hi" : hiInv ? "hi_lo" : hiImp ? "lo_hi" : "lo_lo" };
    });
    const quadrants = { hi_hi: 0, hi_lo: 0, lo_hi: 0, lo_lo: 0 } as Record<string, number>;
    scatter.forEach((p) => { quadrants[p.quadrant]++; });

    // Framework example — the first initiative, end-to-end through the results chain
    const [ex] = await this.db.select({
      id: s.projects.id, nameAr: s.projects.nameAr, progress: s.projects.progress, impactTarget: s.projects.impactTarget, impactAchieved: s.projects.impactAchieved,
      budget: s.financials.budget, actual: s.financials.actual, kpiName: s.kpis.nameAr, kpiId: s.kpis.id,
    }).from(s.projects).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).leftJoin(s.projectKpis, eq(s.projectKpis.projectId, s.projects.id))
      .leftJoin(s.kpis, eq(s.kpis.id, s.projectKpis.kpiId)).orderBy(asc(s.projects.code)).limit(1);
    const dels = ex ? await this.db.select().from(s.deliverables).where(eq(s.deliverables.projectId, ex.id)) : [];
    const example = ex ? {
      ...ex, deliverables: dels, forecastImpact: Math.round(Math.min(ex.impactTarget * 1.05, ex.impactAchieved * (100 / Math.max(ex.progress, 1))) * 10) / 10,
      attainment: ex.impactTarget ? Math.round((ex.impactAchieved / ex.impactTarget) * 1000) / 10 : 0,
    } : null;

    return { kpis: { impact, target: 90, forecast, investment: Math.round(totalInv) }, series, scatter, quadrants, byGoal: goals, example };
  }

  // ---------------------------------------------------------------- /decisions
  async decisions() {
    const rows = await this.db.select({
      id: s.decisions.id, code: s.decisions.code, titleAr: s.decisions.titleAr, type: s.decisions.type, priority: s.decisions.priority, amount: s.decisions.amount,
      ownerAr: s.decisions.ownerAr, dueDate: s.decisions.dueDate, status: s.decisions.status, impactNoteAr: s.decisions.impactNoteAr, decidedAt: s.decisions.decidedAt,
      projectId: s.decisions.projectId, projectName: s.projects.nameAr, portfolioName: s.portfolios.nameAr,
    }).from(s.decisions).leftJoin(s.projects, eq(s.projects.id, s.decisions.projectId)).leftJoin(s.portfolios, eq(s.portfolios.id, s.projects.portfolioId))
      .orderBy(sql`case ${s.decisions.status} when 'معلق' then 0 else 1 end`, sql`case ${s.decisions.priority} when 'عاجلة' then 0 when 'مرتفعة' then 1 else 2 end`, asc(s.decisions.dueDate));
    const pending = rows.filter((r) => r.status === "معلق");
    const financial = pending.filter((r) => r.type === "اعتماد مالي");
    return {
      summary: {
        total: pending.length, financial: financial.length, financialAmount: financial.reduce((a, r) => a + (r.amount ?? 0), 0),
        scope: pending.filter((r) => r.type === "قرار نطاق").length,
        other: pending.filter((r) => ["تصعيد استراتيجي", "قرار موارد", "قبول مخاطرة"].includes(r.type)).length,
      },
      decisions: rows,
    };
  }

  async decide(id: number, status: "معتمد" | "مرفوض" | "مؤجل", userId: number, noteAr?: string) {
    const [before] = await this.db.select().from(s.decisions).where(eq(s.decisions.id, id)).limit(1);
    if (!before) return null;
    const [after] = await this.db.update(s.decisions).set({ status, decidedAt: new Date(), decidedByUserId: userId }).where(eq(s.decisions.id, id)).returning();
    await this.db.insert(s.changeLog).values({ entity: "decisions", entityId: id, field: "status", oldValue: before.status, newValue: status, reasonAr: noteAr ?? null, userId });
    return after;
  }

  // ---------------------------------------------------------------- /strategy
  async strategyMap() {
    const goals = await this.db.select().from(s.goals).orderBy(asc(s.goals.sortOrder));
    const objectives = await this.db.select().from(s.objectives).orderBy(asc(s.objectives.code));
    const kpis = await this.db.select({
      id: s.kpis.id, code: s.kpis.code, nameAr: s.kpis.nameAr, goalId: s.kpis.goalId, baseline: s.kpis.baseline, target: s.kpis.target, current: s.kpis.current,
      lowerIsBetter: s.kpis.lowerIsBetter, status: s.kpis.status, unit: s.kpis.unit,
    }).from(s.kpis).orderBy(asc(s.kpis.code));
    const pfs = await this.db.select({
      goalId: s.portfolioGoals.goalId, id: s.portfolios.id, nameAr: s.portfolios.nameAr, status: s.portfolios.status,
      investment: sql<number>`(select coalesce(sum(f.budget),0) from financials f join projects p on p.id = f.project_id where p.portfolio_id = ${s.portfolios.id})`,
      achieved: sql<number>`(select coalesce(avg(p.impact_achieved / nullif(p.impact_target,0)) * 100, 0) from projects p where p.portfolio_id = ${s.portfolios.id})`,
    }).from(s.portfolioGoals).innerJoin(s.portfolios, eq(s.portfolios.id, s.portfolioGoals.portfolioId));
    return {
      goals: goals.map((g) => ({
        ...g,
        objectives: objectives.filter((o) => o.goalId === g.id),
        kpis: kpis.filter((k) => k.goalId === g.id).map((k) => ({ ...k, attainment: attainment(k) })),
        portfolios: pfs.filter((p) => p.goalId === g.id).map((p) => ({ ...p, investment: Number(p.investment), achieved: Math.round(Number(p.achieved)) })),
      })),
    };
  }

  // ---------------------------------------------------------------- /kpis
  async kpiList() {
    const rows = await this.db.select({
      id: s.kpis.id, code: s.kpis.code, nameAr: s.kpis.nameAr, nameEn: s.kpis.nameEn, goalId: s.kpis.goalId, goalName: s.goals.nameAr, unit: s.kpis.unit,
      baseline: s.kpis.baseline, target: s.kpis.target, current: s.kpis.current, lowerIsBetter: s.kpis.lowerIsBetter, status: s.kpis.status,
      ownerSector: s.sectors.nameAr, projectCount: sql<number>`(select count(*) from project_kpis pk where pk.kpi_id = ${s.kpis.id})`,
    }).from(s.kpis).innerJoin(s.goals, eq(s.goals.id, s.kpis.goalId)).leftJoin(s.sectors, eq(s.sectors.id, s.kpis.ownerSectorId)).orderBy(asc(s.kpis.code));
    return rows.map((k) => ({ ...k, projectCount: Number(k.projectCount), attainment: attainment(k) }));
  }

  async kpiDetail(id: number) {
    const [k] = await this.db.select({
      id: s.kpis.id, code: s.kpis.code, nameAr: s.kpis.nameAr, nameEn: s.kpis.nameEn, goalName: s.goals.nameAr, goalNameEn: s.goals.nameEn, unit: s.kpis.unit,
      baseline: s.kpis.baseline, target: s.kpis.target, current: s.kpis.current, lowerIsBetter: s.kpis.lowerIsBetter, status: s.kpis.status,
      ownerSector: s.sectors.nameAr, rootCauseAr: s.kpis.rootCauseAr,
    }).from(s.kpis).innerJoin(s.goals, eq(s.goals.id, s.kpis.goalId)).leftJoin(s.sectors, eq(s.sectors.id, s.kpis.ownerSectorId)).where(eq(s.kpis.id, id)).limit(1);
    if (!k) return null;
    const readings = await this.db.select().from(s.kpiReadings).where(eq(s.kpiReadings.kpiId, id)).orderBy(asc(s.kpiReadings.month));
    const projects = await this.db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, progress: s.projects.progress, status: s.projects.status, scheduleStatus: s.projects.scheduleStatus,
      financialStatus: s.projects.financialStatus, budget: s.financials.budget, contributionTarget: s.projectKpis.contributionTarget, contributionActual: s.projectKpis.contributionActual,
    }).from(s.projectKpis).innerJoin(s.projects, eq(s.projects.id, s.projectKpis.projectId)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id))
      .where(eq(s.projectKpis.kpiId, id)).orderBy(desc(s.projectKpis.contributionActual));
    const att = attainment(k);
    return {
      kpi: { ...k, attainment: att },
      readings: readings.map((r) => ({ month: Number(String(r.month).slice(5, 7)), actual: r.actual, target: r.target })),
      projects: projects.map((p) => ({ ...p, attainment: p.contributionTarget ? Math.round((p.contributionActual / p.contributionTarget) * 1000) / 10 : 0 })),
      gap: {
        toTarget: Math.round((100 - att) * 10) / 10,
        delayed: projects.filter((p) => p.scheduleStatus !== "on_track").length,
        overBudget: projects.filter((p) => p.financialStatus !== "on_track").length,
        investment: Math.round(projects.reduce((a, p) => a + (p.budget ?? 0), 0)),
      },
    };
  }
}
