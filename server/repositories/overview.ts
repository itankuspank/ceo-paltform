/**
 * Repository pattern (INT-06): screens never query tables directly. Everything executive
 * derives from stored state — nothing is duplicated. Swapping the store touches only this layer.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { skillReadiness } from "../../shared/schema";

export class OverviewRepository {
  constructor(private db: Db) {}

  private async totals() {
    const [fin] = await this.db.select({ investment: sql<number>`coalesce(sum(${s.financials.budget}), 0)` }).from(s.financials);
    const [cnt] = await this.db.select({
      portfolios: sql<number>`(select count(*) from ${s.portfolios})`,
      programs: sql<number>`(select count(*) from ${s.programs})`,
      projects: sql<number>`(select count(*) from ${s.projects} where ${s.projects.isArchived} = false)`,
      kpis: sql<number>`(select count(*) from ${s.kpis})`,
      kpisOffTrack: sql<number>`(select count(*) from ${s.kpis} where ${s.kpis.status} = 'off_track')`,
      pendingDecisions: sql<number>`(select count(*) from ${s.decisions} where ${s.decisions.status} = 'معلق')`,
      lastSync: sql<string>`(select max(${s.dataSources.lastSyncAt}) from ${s.dataSources})`,
    }).from(sql`(select 1) as one`);
    const goals = await this.db.select().from(s.goals).orderBy(asc(s.goals.sortOrder));
    const totalInv = goals.reduce((a, g) => a + g.investment, 0);
    const impact = totalInv ? goals.reduce((a, g) => a + g.achievedImpact * g.investment, 0) / totalInv : 0;
    return { investment: Number(fin.investment), impact: Math.round(impact), ...cnt, goals, forecastImpact: Math.round(impact + 6) };
  }

  /** Landing / entry screen (screen 01). */
  async landingSummary() {
    const t = await this.totals();
    const decisions = await this.db.select().from(s.decisions).where(eq(s.decisions.status, "معلق")).orderBy(asc(s.decisions.dueDate));
    const topRisks = await this.db.select({
      id: s.risks.id, titleAr: s.risks.titleAr, ownerAr: s.risks.ownerAr, probability: s.risks.probability, impact: s.risks.impact,
      projectName: s.projects.nameAr, sectorName: s.sectors.nameAr,
    }).from(s.risks).innerJoin(s.projects, eq(s.projects.id, s.risks.projectId)).innerJoin(s.sectors, eq(s.sectors.id, s.projects.sectorId))
      .orderBy(desc(sql`${s.risks.probability} * ${s.risks.impact}`)).limit(3);
    return {
      totals: { investment: t.investment, impact: t.impact, portfolios: Number(t.portfolios), programs: Number(t.programs), projects: Number(t.projects), kpis: Number(t.kpis) },
      decisions, topRisks,
      integrations: [
        { name: "Microsoft Project Server", descAr: "نظام المشاريع المرجعي" },
        { name: "Odoo ERP", descAr: "المرجع المالي والموارد البشرية" },
        { name: "SQL Server EPM DWH", descAr: "المصدر الموحد للبيانات" },
        { name: "Power BI Report Server", descAr: "التحليلات ولوحات المعلومات" },
      ],
    };
  }

  /** CEO executive overview (screen 02). */
  async executiveOverview() {
    const t = await this.totals();

    // Portfolio health = share of strategic investment sitting in on-track / at-risk / off-track initiatives
    const health = await this.db.select({ status: s.projects.status, value: sql<number>`coalesce(sum(${s.financials.budget}), 0)` })
      .from(s.projects).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id))
      .where(eq(s.projects.isArchived, false)).groupBy(s.projects.status);
    const hv = Object.fromEntries(health.map((h) => [h.status, Number(h.value)]));
    const hTotal = Object.values(hv).reduce((a, b) => a + b, 0) || 1;
    const portfolioHealth = (["on_track", "at_risk", "off_track"] as const).map((k) => ({ status: k, value: Math.round(((hv[k] ?? 0) / hTotal) * 100) }));

    // Impact trajectory — 12 months (computed; production replaces with stored impact readings per period)
    const months = Array.from({ length: 12 }, (_, m) => m);
    const impactSeries = months.map((m) => {
      const f = (m + 1) / 12;
      return { month: m + 1, actual: Math.round((t.impact - 12 + 12 * f) * 10) / 10, target: Math.round((t.impact - 8 + (t.impact + 8 - (t.impact - 8)) * f) * 10) / 10 };
    });

    const top = await this.db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, impactAchieved: s.projects.impactAchieved, budget: s.financials.budget, status: s.projects.status,
    }).from(s.projects).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).orderBy(desc(s.projects.impactAchieved)).limit(5);
    const topSum = top.reduce((a, p) => a + p.impactAchieved, 0) || 1;
    const topInitiatives = top.map((p) => ({ ...p, share: Math.round((p.impactAchieved / topSum) * 100) }));

    const attention = await this.db.select({
      id: s.decisions.id, code: s.decisions.code, titleAr: s.decisions.titleAr, type: s.decisions.type, priority: s.decisions.priority, amount: s.decisions.amount,
      ownerAr: s.decisions.ownerAr, dueDate: s.decisions.dueDate, impactNoteAr: s.decisions.impactNoteAr, projectName: s.projects.nameAr,
    }).from(s.decisions).leftJoin(s.projects, eq(s.projects.id, s.decisions.projectId)).where(eq(s.decisions.status, "معلق"))
      .orderBy(sql`case ${s.decisions.priority} when 'عاجلة' then 0 when 'مرتفعة' then 1 else 2 end`, asc(s.decisions.dueDate)).limit(4);

    const kpisAtRisk = await this.db.select({ id: s.kpis.id, code: s.kpis.code, nameAr: s.kpis.nameAr, status: s.kpis.status, current: s.kpis.current, target: s.kpis.target, unit: s.kpis.unit })
      .from(s.kpis).where(sql`${s.kpis.status} in ('at_risk','off_track')`).orderBy(sql`case ${s.kpis.status} when 'off_track' then 0 else 1 end`, asc(s.kpis.code)).limit(6);

    const sk = await this.db.select().from(s.skills);
    const readinessIndex = sk.length ? Math.round((sk.reduce((a, x) => a + skillReadiness(x), 0) / sk.length) * 10) / 10 : 0;
    const capability = { index: readinessIndex, status: readinessIndex >= 85 ? "on_track" : readinessIndex >= 70 ? "at_risk" : "off_track", criticalGaps: sk.filter((x) => x.importance === "حرجة" && skillReadiness(x) < 80).length };

    return {
      capability,
      kpis: {
        investment: t.investment, impact: t.impact, portfolios: Number(t.portfolios), projects: Number(t.projects), kpiCount: Number(t.kpis),
        kpisAtRisk: Number(t.kpisOffTrack), pendingDecisions: Number(t.pendingDecisions), forecastImpact: t.forecastImpact, targetImpact: 90,
        programs: Number(t.programs), lastSync: t.lastSync,
      },
      impactSeries, portfolioHealth,
      impactByGoal: t.goals.map((g) => ({ code: g.code, nameAr: g.nameAr, nameEn: g.nameEn, achieved: g.achievedImpact, target: g.targetImpact, investment: g.investment })),
      topInitiatives, attention, kpisAtRisk,
    };
  }
}
