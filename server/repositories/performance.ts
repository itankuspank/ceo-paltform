import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";

const r0 = (v: number) => Math.round(Number(v));
const r1 = (v: number) => Math.round(Number(v) * 10) / 10;

export class PerformanceRepository {
  constructor(private db: Db) {}

  // ---------------------------------------------------------------- /finance
  async finance() {
    const [t] = await this.db.select({
      budget: sql<number>`coalesce(sum(${s.financials.budget}),0)`, committed: sql<number>`coalesce(sum(${s.financials.committed}),0)`,
      actual: sql<number>`coalesce(sum(${s.financials.actual}),0)`, eac: sql<number>`coalesce(sum(${s.financials.eac}),0)`,
    }).from(s.financials);
    const byPortfolio = await this.db.select({
      id: s.portfolios.id, nameAr: s.portfolios.nameAr, budget: sql<number>`coalesce(sum(${s.financials.budget}),0)`, committed: sql<number>`coalesce(sum(${s.financials.committed}),0)`,
      actual: sql<number>`coalesce(sum(${s.financials.actual}),0)`, eac: sql<number>`coalesce(sum(${s.financials.eac}),0)`,
    }).from(s.portfolios).leftJoin(s.projects, eq(s.projects.portfolioId, s.portfolios.id)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).groupBy(s.portfolios.id).orderBy(asc(s.portfolios.code));
    const overruns = await this.db.select({
      id: s.projects.id, nameAr: s.projects.nameAr, status: s.projects.financialStatus, budget: s.financials.budget, actual: s.financials.actual, eac: s.financials.eac,
      overrun: sql<number>`${s.financials.eac} - ${s.financials.budget}`,
    }).from(s.financials).innerJoin(s.projects, eq(s.projects.id, s.financials.projectId)).where(sql`${s.financials.eac} > ${s.financials.budget}`).orderBy(desc(sql`${s.financials.eac} - ${s.financials.budget}`)).limit(8);
    const totals = { budget: r0(t.budget), committed: r0(t.committed), actual: r0(t.actual), eac: r0(t.eac) };
    return {
      totals: { ...totals, variance: totals.eac - totals.budget, spendPct: r1((totals.actual / totals.budget) * 100), commitPct: r1((totals.committed / totals.budget) * 100) },
      byPortfolio: byPortfolio.map((p) => ({ ...p, budget: r0(p.budget), committed: r0(p.committed), actual: r0(p.actual), eac: r0(p.eac) })),
      overruns: overruns.map((o) => ({ ...o, overrun: r0(o.overrun) })),
    };
  }

  // ---------------------------------------------------------------- /resources
  async resources() {
    const rows = await this.db.select().from(s.resources).orderBy(asc(s.resources.id));
    const asg = await this.db.select({ resourceId: s.resourceAssignments.resourceId, projectId: s.projects.id, projectName: s.projects.nameAr, hours: s.resourceAssignments.hours })
      .from(s.resourceAssignments).innerJoin(s.projects, eq(s.projects.id, s.resourceAssignments.projectId));
    const byRes: Record<number, typeof asg> = {};
    for (const a of asg) (byRes[a.resourceId] ??= []).push(a);
    const list = rows.map((r) => {
      const assignments = byRes[r.id] ?? [];
      const net = r.capacityHours - r.leaveHours - r.trainingHours;
      const demand = assignments.reduce((a, x) => a + x.hours, 0);
      const util = net ? r1((demand / net) * 100) : 0;
      return { ...r, assignments, net, demand, utilization: util, status: util > 100 ? "OVERALLOCATED" : util >= 90 ? "قريب الحد" : "متاح" };
    });
    return {
      summary: { total: 1000, sample: list.length, overallocated: list.filter((r) => r.status === "OVERALLOCATED").length, avgUtilization: r1(list.reduce((a, r) => a + r.utilization, 0) / list.length), standardCapacity: 160 },
      resources: list,
    };
  }

  // ---------------------------------------------------------------- /risks
  async risks() {
    const risks = await this.db.select({
      id: s.risks.id, code: s.risks.code, titleAr: s.risks.titleAr, category: s.risks.category, probability: s.risks.probability, impact: s.risks.impact, response: s.risks.response,
      status: s.risks.status, ownerAr: s.risks.ownerAr, projectId: s.projects.id, projectName: s.projects.nameAr,
    }).from(s.risks).innerJoin(s.projects, eq(s.projects.id, s.risks.projectId)).orderBy(desc(sql`${s.risks.probability} * ${s.risks.impact}`), asc(s.risks.code));
    const issues = await this.db.select({ id: s.issues.id, titleAr: s.issues.titleAr, severity: s.issues.severity, status: s.issues.status, openedDays: s.issues.openedDays, projectId: s.projects.id, projectName: s.projects.nameAr })
      .from(s.issues).innerJoin(s.projects, eq(s.projects.id, s.issues.projectId)).where(sql`${s.issues.status} <> 'مغلقة'`).orderBy(desc(s.issues.openedDays));
    const heat: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    risks.forEach((r) => { heat[r.probability - 1][r.impact - 1]++; });
    return {
      summary: { total: risks.length, critical: risks.filter((r) => r.probability * r.impact >= 15).length, medium: risks.filter((r) => { const x = r.probability * r.impact; return x >= 8 && x < 15; }).length, openIssues: issues.length },
      risks: risks.map((r) => ({ ...r, score: r.probability * r.impact })), issues, heatmap: heat,
    };
  }

  // ---------------------------------------------------------------- /dependencies
  async dependencies() {
    const rows = await this.db.execute(sql`select d.id, d.type, d.status, d.note_ar as "noteAr", a.id as "fromId", a.name_ar as "fromName", b.id as "toId", b.name_ar as "toName"
      from dependencies d join projects a on a.id = d.from_project_id join projects b on b.id = d.to_project_id
      order by case d.status when 'off_track' then 0 when 'at_risk' then 1 else 2 end, d.id`);
    const list = rows.rows as any[];
    return { summary: { total: list.length, healthy: list.filter((d) => d.status === "on_track").length, atRisk: list.filter((d) => d.status === "at_risk").length, blocked: list.filter((d) => d.status === "off_track").length }, dependencies: list };
  }

  // ---------------------------------------------------------------- /governance
  async governance() {
    const decisions = await this.db.select({ id: s.decisions.id, code: s.decisions.code, titleAr: s.decisions.titleAr, type: s.decisions.type, priority: s.decisions.priority, amount: s.decisions.amount, dueDate: s.decisions.dueDate, ownerAr: s.decisions.ownerAr, projectName: s.projects.nameAr })
      .from(s.decisions).leftJoin(s.projects, eq(s.projects.id, s.decisions.projectId)).where(eq(s.decisions.status, "معلق")).orderBy(asc(s.decisions.dueDate));
    const changeRequests = await this.db.select({ id: s.changeRequestsGov.id, code: s.changeRequestsGov.code, titleAr: s.changeRequestsGov.titleAr, impactAr: s.changeRequestsGov.impactAr, status: s.changeRequestsGov.status, projectName: s.projects.nameAr })
      .from(s.changeRequestsGov).innerJoin(s.projects, eq(s.projects.id, s.changeRequestsGov.projectId)).orderBy(asc(s.changeRequestsGov.code));
    const escalations = await this.db.select({ id: s.escalations.id, titleAr: s.escalations.titleAr, ownerAr: s.escalations.ownerAr, openedDays: s.escalations.openedDays, projectName: s.projects.nameAr })
      .from(s.escalations).innerJoin(s.projects, eq(s.projects.id, s.escalations.projectId)).where(eq(s.escalations.status, "مفتوحة")).orderBy(desc(s.escalations.openedDays));
    const gates = await this.db.select({ phase: s.projects.phase, count: sql<number>`count(*)` }).from(s.projects).where(eq(s.projects.isArchived, false)).groupBy(s.projects.phase);
    const gateCount = Object.fromEntries(gates.map((g) => [g.phase, Number(g.count)]));
    const scheduled = decisions.filter((d) => new Date(d.dueDate) <= new Date("2026-10-01")).length;
    return {
      summary: { pendingDecisions: decisions.length, openEscalations: escalations.length, scheduledApprovals: scheduled, changeRequests: changeRequests.length },
      decisions, changeRequests, escalations,
      stageGates: s.PHASES.map((p, i) => ({ gate: i + 1, nameAr: p, count: gateCount[p] ?? 0 })),
    };
  }

  // ---------------------------------------------------------------- /analytics
  /** Prioritization factors (0–100) derived from stored state; the client applies the weight model. */
  async analytics() {
    const rows = await this.db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, progress: s.projects.progress, impactTarget: s.projects.impactTarget, impactAchieved: s.projects.impactAchieved,
      priorityScore: s.projects.priorityScore, budget: s.financials.budget, goalImpact: s.goals.achievedImpact,
    }).from(s.projects).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id)).innerJoin(s.goals, eq(s.goals.id, s.projects.goalId)).where(eq(s.projects.isArchived, false)).orderBy(asc(s.projects.code));
    const maxT = Math.max(...rows.map((r) => r.impactTarget));
    const projects = rows.map((r) => ({
      id: r.id, code: r.code, nameAr: r.nameAr, status: r.status, budget: r0(r.budget ?? 0), impactAttainment: r.impactTarget ? r1((r.impactAchieved / r.impactTarget) * 100) : 0,
      factors: {
        alignment: r0(r.goalImpact), impact: Math.min(100, r.impactTarget ? r0((r.impactAchieved / r.impactTarget) * 100) : 0), benefits: r0((r.impactTarget / maxT) * 100),
        mandate: r0(r.priorityScore), feasibility: r0(r.status === "on_track" ? 70 + r.progress * 0.3 : r.status === "at_risk" ? 45 + r.progress * 0.3 : 25 + r.progress * 0.3),
      },
    }));
    const goals = await this.db.select().from(s.goals);
    const totalInv = goals.reduce((a, g) => a + g.investment, 0);
    const impact = Math.round(goals.reduce((a, g) => a + g.achievedImpact * g.investment, 0) / totalInv);
    const forecast = Array.from({ length: 12 }, (_, m) => { const f = (m + 1) / 12; return { month: m + 1, actual: m < 8 ? r1(impact - 12 + 12 * f) : null, forecast: r1(impact - 12 + 12 * f + (m >= 8 ? (m - 7) * 1.5 : 0)), target: r1(impact - 8 + 16 * f) }; });
    return { projects, forecast, forecastGap: r1(90 - (impact + 6)) };
  }
}
