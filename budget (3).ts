import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { WorkflowEngine } from "../workflow";

const r1 = (v: number) => Math.round(v * 10) / 10;
const pct = (a: number, b: number) => (b ? r1((a / b) * 100) : 0);
export const CLOSED_MONTH = 8;

export class BudgetRepository {
  constructor(private db: Db, private wf: WorkflowEngine) {}

  private async kindTotals(fy: number, kind: "opex" | "initiative") {
    const [t] = await this.db.select({ approved: sql<number>`coalesce(sum(${s.budgetLines.approved}),0)`, committed: sql<number>`coalesce(sum(${s.budgetLines.committed}),0)`, actual: sql<number>`coalesce(sum(${s.budgetLines.actual}),0)` })
      .from(s.budgetLines).where(and(eq(s.budgetLines.fiscalYear, fy), eq(s.budgetLines.kind, kind)));
    const months = await this.db.select({ month: s.budgetMonths.month, planned: sql<number>`coalesce(sum(${s.budgetMonths.planned}),0)`, actual: sql<number>`sum(${s.budgetMonths.actual})` })
      .from(s.budgetMonths).innerJoin(s.budgetLines, eq(s.budgetLines.id, s.budgetMonths.lineId)).where(and(eq(s.budgetLines.fiscalYear, fy), eq(s.budgetLines.kind, kind))).groupBy(s.budgetMonths.month).orderBy(asc(s.budgetMonths.month));
    let cp = 0, ca = 0;
    const curve = months.map((m) => { cp += Number(m.planned); if (m.month <= CLOSED_MONTH) ca += Number(m.actual ?? 0); return { month: m.month, planned: r1(cp), actual: m.month <= CLOSED_MONTH ? r1(ca) : null }; });
    const approved = Number(t.approved), actual = Number(t.actual), committed = Number(t.committed);
    const plannedToDate = curve[CLOSED_MONTH - 1]?.planned ?? 0;
    const runRate = plannedToDate ? actual / plannedToDate : 1;
    const forecast = r1(actual + (approved - plannedToDate) * Math.min(1.15, Math.max(0.85, runRate)));
    return { approved: r1(approved), committed: r1(committed), actual, remaining: r1(approved - actual), spendPct: pct(actual, approved), expectedPct: pct(plannedToDate, approved), commitPct: pct(committed, approved), forecast, forecastVariance: r1(forecast - approved), curve };
  }

  async overview(fy = 2026) {
    const opex = await this.kindTotals(fy, "opex");
    const init = await this.kindTotals(fy, "initiative");
    const cc = await this.db.select({ id: s.costCenters.id, nameAr: s.costCenters.nameAr, type: s.costCenters.type, approved: sql<number>`sum(${s.budgetLines.approved})`, actual: sql<number>`sum(${s.budgetLines.actual})` })
      .from(s.budgetLines).innerJoin(s.costCenters, eq(s.costCenters.id, s.budgetLines.costCenterId)).where(and(eq(s.budgetLines.fiscalYear, fy), eq(s.budgetLines.kind, "opex"))).groupBy(s.costCenters.id);
    const ranked = cc.map((c) => ({ ...c, approved: r1(Number(c.approved)), actual: r1(Number(c.actual)), spendPct: pct(Number(c.actual), Number(c.approved)), gap: r1(pct(Number(c.actual), Number(c.approved)) - opex.expectedPct) })).sort((a, b) => a.gap - b.gap);
    const transfers = await this.transfers();
    const alerts = [
      ...ranked.filter((c) => c.gap <= -15).map((c) => ({ tone: "amber", textAr: `${c.nameAr}: نسبة الصرف ${c.spendPct}% أقل من المتوقع (${opex.expectedPct}%) بـ ${Math.abs(c.gap)} نقطة` })),
      ...ranked.filter((c) => c.gap >= 10).map((c) => ({ tone: "red", textAr: `${c.nameAr}: نسبة الصرف ${c.spendPct}% تتجاوز المتوقع بـ ${c.gap} نقطة — خطر تجاوز نهاية العام` })),
      ...(init.forecastVariance > 0 ? [{ tone: "red", textAr: `ميزانية المبادرات: التوقع عند نهاية العام يتجاوز المعتمد بـ ${init.forecastVariance} مليون ريال` }] : []),
    ];
    return { fiscalYear: fy, closedMonth: CLOSED_MONTH, opex, initiatives: init, underSpenders: ranked.slice(0, 5), overSpenders: [...ranked].reverse().slice(0, 5), pendingTransfers: transfers.filter((t) => t.status === "قيد الإجراء"), alerts };
  }

  async opex(fy = 2026) {
    const lines = await this.db.select({
      id: s.budgetLines.id, costCenterId: s.costCenters.id, costCenter: s.costCenters.nameAr, ccType: s.costCenters.type, chapter: s.budgetLines.chapter, category: s.budgetLines.category,
      approved: s.budgetLines.approved, committed: s.budgetLines.committed, actual: s.budgetLines.actual,
    }).from(s.budgetLines).innerJoin(s.costCenters, eq(s.costCenters.id, s.budgetLines.costCenterId)).where(and(eq(s.budgetLines.fiscalYear, fy), eq(s.budgetLines.kind, "opex"))).orderBy(asc(s.costCenters.id), asc(s.budgetLines.id));
    const months = await this.db.select({ lineId: s.budgetMonths.lineId, month: s.budgetMonths.month, planned: s.budgetMonths.planned, actual: s.budgetMonths.actual })
      .from(s.budgetMonths).innerJoin(s.budgetLines, eq(s.budgetLines.id, s.budgetMonths.lineId)).where(and(eq(s.budgetLines.fiscalYear, fy), eq(s.budgetLines.kind, "opex"))).orderBy(asc(s.budgetMonths.month));
    const byLine: Record<number, { month: number; planned: number; actual: number | null }[]> = {};
    for (const m of months) (byLine[m.lineId] ??= []).push({ month: m.month, planned: m.planned, actual: m.actual });
    const expected = (l: typeof lines[number]) => { const ms = byLine[l.id] ?? []; return ms.filter((m) => m.month <= CLOSED_MONTH).reduce((a, m) => a + m.planned, 0); };
    const chapters = Array.from(new Set(lines.map((l) => l.chapter)));
    return {
      lines: lines.map((l) => ({ ...l, spendPct: pct(l.actual, l.approved), expectedPct: pct(expected(l), l.approved), remaining: r1(l.approved - l.actual), months: byLine[l.id] ?? [] })),
      byChapter: chapters.map((ch) => { const ls = lines.filter((l) => l.chapter === ch); const ap = ls.reduce((a, l) => a + l.approved, 0), ac = ls.reduce((a, l) => a + l.actual, 0); return { chapter: ch, approved: r1(ap), committed: r1(ls.reduce((a, l) => a + l.committed, 0)), actual: r1(ac), spendPct: pct(ac, ap) }; }),
      transfers: await this.transfers(),
    };
  }

  async initiatives() {
    const rows = await this.db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, status: s.projects.status, portfolioId: s.portfolios.id, portfolio: s.portfolios.nameAr, program: s.programs.nameAr, sector: s.sectors.nameAr,
    }).from(s.projects).innerJoin(s.portfolios, eq(s.portfolios.id, s.projects.portfolioId)).innerJoin(s.programs, eq(s.programs.id, s.projects.programId)).innerJoin(s.sectors, eq(s.sectors.id, s.projects.sectorId)).where(eq(s.projects.isArchived, false)).orderBy(asc(s.projects.code));
    const years = await this.db.select().from(s.initiativeBudgetYears).orderBy(asc(s.initiativeBudgetYears.fiscalYear));
    const fin = await this.db.select({ projectId: s.financials.projectId, eac: s.financials.eac }).from(s.financials);
    const eac = Object.fromEntries(fin.map((f) => [f.projectId, f.eac]));
    const byP: Record<number, typeof years> = {}; for (const y of years) (byP[y.projectId] ??= []).push(y);
    const list = rows.map((p) => {
      const ys = byP[p.id] ?? []; const y26 = ys.find((y) => y.fiscalYear === 2026); const y27 = ys.find((y) => y.fiscalYear === 2027); const y25 = ys.find((y) => y.fiscalYear === 2025);
      const total = ys.reduce((a, y) => a + (y.approved ?? 0), 0);
      return { ...p, totalApproved: r1(total), y25: y25 ? { approved: y25.approved, actual: y25.actual } : null, y26: y26 ? { requested: y26.requested, approved: y26.approved, committed: y26.committed, actual: y26.actual, eac: eac[p.id] ?? 0, spendPct: pct(y26.actual, y26.approved ?? 0), fundingSource: y26.fundingSource } : null, y27: y27 ? { requested: y27.requested, approved: y27.approved } : null };
    });
    const planning = { requested: r1(list.reduce((a, p) => a + (p.y27?.requested ?? 0), 0)), approved: r1(list.reduce((a, p) => a + (p.y27?.approved ?? 0), 0)), pending: list.filter((p) => p.y27 && p.y27.approved === null).length };
    const byPortfolio = Object.values(list.reduce((acc, p) => { const g = (acc[p.portfolioId] ??= { portfolio: p.portfolio, approved: 0, actual: 0, eac: 0, requested27: 0 }); g.approved += p.y26?.approved ?? 0; g.actual += p.y26?.actual ?? 0; g.eac += p.y26?.eac ?? 0; g.requested27 += p.y27?.requested ?? 0; return acc; }, {} as Record<number, any>)).map((g: any) => ({ ...g, approved: r1(g.approved), actual: r1(g.actual), eac: r1(g.eac), requested27: r1(g.requested27) }));
    return { initiatives: list, planning, byPortfolio, totals: await this.kindTotals(2026, "initiative") };
  }

  async transfers() {
    const rows = await this.db.select({
      id: s.budgetTransfers.id, code: s.budgetTransfers.code, amount: s.budgetTransfers.amount, justificationAr: s.budgetTransfers.justificationAr, status: s.budgetTransfers.status, createdAt: s.budgetTransfers.createdAt, requestedBy: s.users.fullName,
      fromLineId: s.budgetTransfers.fromLineId, toLineId: s.budgetTransfers.toLineId,
    }).from(s.budgetTransfers).leftJoin(s.users, eq(s.users.id, s.budgetTransfers.requestedByUserId)).orderBy(desc(s.budgetTransfers.id));
    const lines = await this.db.select({ id: s.budgetLines.id, cc: s.costCenters.nameAr, category: s.budgetLines.category, approved: s.budgetLines.approved, actual: s.budgetLines.actual }).from(s.budgetLines).leftJoin(s.costCenters, eq(s.costCenters.id, s.budgetLines.costCenterId));
    const L = Object.fromEntries(lines.map((l) => [l.id, l]));
    const out = [] as any[];
    for (const t of rows) { const wf = await this.wf.status("budget_transfers", t.id); out.push({ ...t, from: L[t.fromLineId], to: L[t.toLineId], workflow: wf ? { instanceId: wf.id, stage: wf.stage, stageIndex: wf.stageIndex, stages: wf.stages, status: wf.status, daysInStage: wf.daysInStage, slaBreached: wf.slaBreached, history: wf.history } : null }); }
    return out;
  }

  async createTransfer(input: { fromLineId: number; toLineId: number; amount: number; justificationAr: string }, actor: { userId: number; role: s.Role }) {
    if (!(input.amount > 0)) throw Object.assign(new Error("المبلغ يجب أن يكون أكبر من صفر"), { status: 400 });
    if (input.fromLineId === input.toLineId) throw Object.assign(new Error("لا يمكن المناقلة إلى البند نفسه"), { status: 400 });
    const [from] = await this.db.select().from(s.budgetLines).where(eq(s.budgetLines.id, input.fromLineId)).limit(1);
    const [to] = await this.db.select().from(s.budgetLines).where(eq(s.budgetLines.id, input.toLineId)).limit(1);
    if (!from || !to) throw Object.assign(new Error("بند الميزانية غير موجود"), { status: 404 });
    if (from.approved - from.actual < input.amount) throw Object.assign(new Error(`المتاح في البند المصدر ${r1(from.approved - from.actual)} مليون ريال فقط`), { status: 400 });
    const [n] = await this.db.select({ n: sql<number>`count(*)` }).from(s.budgetTransfers);
    const code = `TRF-${String(Number(n.n) + 1).padStart(3, "0")}`;
    const [tr] = await this.db.insert(s.budgetTransfers).values({ code, fromLineId: input.fromLineId, toLineId: input.toLineId, amount: input.amount, justificationAr: input.justificationAr, requestedByUserId: actor.userId }).returning();
    await this.wf.start("budget_transfer", "budget_transfers", tr.id, actor, input.justificationAr);
    await this.db.insert(s.changeLog).values({ entity: "budget_transfers", entityId: tr.id, field: "*", oldValue: null, newValue: `إنشاء مناقلة ${code}`, userId: actor.userId });
    return tr;
  }

  /** When a transfer completes its workflow, apply it to the lines (audited). Called by the workflow route. */
  async applyTransferOutcome(transferId: number, outcome: "completed" | "rejected", actor: { userId: number }) {
    const [t] = await this.db.select().from(s.budgetTransfers).where(eq(s.budgetTransfers.id, transferId)).limit(1);
    if (!t || t.status !== "قيد الإجراء") return;
    if (outcome === "completed") {
      await this.db.update(s.budgetLines).set({ approved: sql`${s.budgetLines.approved} - ${t.amount}` }).where(eq(s.budgetLines.id, t.fromLineId));
      await this.db.update(s.budgetLines).set({ approved: sql`${s.budgetLines.approved} + ${t.amount}` }).where(eq(s.budgetLines.id, t.toLineId));
      await this.db.update(s.budgetTransfers).set({ status: "معتمد" }).where(eq(s.budgetTransfers.id, transferId));
      await this.db.insert(s.changeLog).values([{ entity: "budget_lines", entityId: t.fromLineId, field: "approved", oldValue: null, newValue: `-${t.amount} (مناقلة ${t.code})`, userId: actor.userId }, { entity: "budget_lines", entityId: t.toLineId, field: "approved", oldValue: null, newValue: `+${t.amount} (مناقلة ${t.code})`, userId: actor.userId }]);
    } else await this.db.update(s.budgetTransfers).set({ status: "مرفوض" }).where(eq(s.budgetTransfers.id, transferId));
  }
}
