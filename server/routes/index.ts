import express, { type Router } from "express";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import * as s from "../../shared/schema";
import { requirePermission } from "../auth";
import { OverviewRepository } from "../repositories/overview";
import { StrategyRepository } from "../repositories/strategy";
import { PortfolioRepository } from "../repositories/portfolio";
import { GeoRepository } from "../repositories/geo";
import { PerformanceRepository } from "../repositories/performance";
import { dataRouter, systemHandler } from "./data";
import { LearningRepository } from "../repositories/learning";
import { WorkflowEngine, WorkflowError } from "../workflow";
import { BudgetRepository } from "../repositories/budget";
import { OrgRepository } from "../repositories/org";
import { TalentRepository } from "../repositories/talent";
import { inScope, type Module } from "../../shared/rbac";

export const apiRouter: Router = express.Router();
export const publicRouter: Router = express.Router();
const overviewRepo = new OverviewRepository(db);
const strategyRepo = new StrategyRepository(db);
const portfolioRepo = new PortfolioRepository(db);
const geoRepo = new GeoRepository(db);
const perfRepo = new PerformanceRepository(db);
apiRouter.use("/data", dataRouter);
const learningRepo = new LearningRepository(db);
const wf = new WorkflowEngine(db);
const budgetRepo = new BudgetRepository(db, wf);
const orgRepo = new OrgRepository(db, wf);
const talentRepo = new TalentRepository(db, wf);
const actorFull = (req: express.Request) => ({ userId: req.session.userId!, role: req.session.role!, modules: req.session.modules });
const actorOf = (req: express.Request) => ({ userId: req.session.userId!, role: req.session.role! });
const W = (fn: (req: express.Request) => Promise<unknown>) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try { res.json(await fn(req)); } catch (e: any) { if (e instanceof WorkflowError || e?.status) return res.status(e.status ?? 500).json({ error: e.message }); next(e); }
};
const scoped = (module: Module) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!inScope(req.session.role, req.session.modules, module)) return res.status(403).json({ error: "هذا النطاق خارج صلاحياتك المسندة" });
  next();
};

// ---------------------------------------------------------------- workflow engine
apiRouter.get("/workflow/definitions", requirePermission("view:data"), W(() => wf.definitions()));
apiRouter.put("/workflow/definitions/:key", requirePermission("users:manage"), W((req) => wf.updateDefinition(req.params.key as string, req.body ?? {}, actorOf(req))));
apiRouter.get("/workflow/inbox", requirePermission("view:executive"), W((req) => wf.inbox(req.session.role!)));
apiRouter.get("/workflow/pipeline/:key", requirePermission("view:executive"), W((req) => wf.pipeline(req.params.key as string)));
apiRouter.get("/workflow/status/:entity/:id", requirePermission("view:executive"), W((req) => wf.status(req.params.entity as string, Number(req.params.id))));
apiRouter.post("/workflow/:instanceId/act", requirePermission("view:executive"), W(async (req) => {
  const cur = await wf.byInstance(Number(req.params.instanceId));
  if (cur && cur.entity === "candidates" && req.body?.action === "approve" && cur.stageIndex === cur.stages.length - 1) await talentRepo.assertCanOnboard(cur.entityId);
  const r = await wf.act(Number(req.params.instanceId), req.body?.action, actorOf(req), typeof req.body?.noteAr === "string" ? req.body.noteAr : undefined);
  if (r.instance.entity === "budget_transfers" && r.outcome !== "active") await budgetRepo.applyTransferOutcome(r.instance.entityId, r.outcome as "completed" | "rejected", actorOf(req));
  if (r.instance.entity === "org_requests" && r.outcome !== "active") await orgRepo.applyOutcome(r.instance.entityId, r.outcome as "completed" | "rejected", actorOf(req));
  if (r.instance.entity === "candidates" && r.outcome !== "active") await talentRepo.applyOutcome(r.instance.entityId, r.outcome as "completed" | "rejected", actorOf(req));
  return r;
}));

// ---------------------------------------------------------------- talent acquisition
apiRouter.get("/talent/dashboard", requirePermission("view:talent"), W((req) => talentRepo.dashboard(actorFull(req))));
apiRouter.get("/talent/pipeline", requirePermission("view:talent"), W((req) => talentRepo.pipeline(actorFull(req))));
apiRouter.get("/talent/requisitions", requirePermission("view:talent"), W(() => talentRepo.requisitions()));
apiRouter.post("/talent/requisitions", requirePermission("data:edit"), scoped("talent"), W((req) => talentRepo.createRequisition(req.body ?? {}, actorFull(req))));
apiRouter.post("/talent/candidates", requirePermission("data:edit"), scoped("talent"), W((req) => talentRepo.createCandidate(req.body ?? {}, actorFull(req))));
apiRouter.put("/talent/candidates/:id/clearance", requirePermission("data:edit"), scoped("talent"), W((req) => talentRepo.setClearance(Number(req.params.id), String(req.body?.status ?? ""), actorFull(req))));

// ---------------------------------------------------------------- organizational structures
apiRouter.get("/org/center", requirePermission("view:org"), W(() => orgRepo.center()));
apiRouter.get("/org/tree", requirePermission("view:org"), W(() => orgRepo.tree()));
apiRouter.get("/org/units/:id", requirePermission("view:org"), W(async (req) => { const d = await orgRepo.unit(Number(req.params.id)); if (!d) throw Object.assign(new Error("الوحدة غير موجودة"), { status: 404 }); return d; }));
apiRouter.get("/org/requests", requirePermission("view:org"), W(() => orgRepo.requests()));
apiRouter.get("/org/requests/:id", requirePermission("view:org"), W(async (req) => { const d = await orgRepo.request(Number(req.params.id)); if (!d) throw Object.assign(new Error("الطلب غير موجود"), { status: 404 }); return d; }));
apiRouter.post("/org/requests", requirePermission("data:edit"), scoped("org"), W((req) => orgRepo.createRequest(req.body ?? {}, actorOf(req))));
apiRouter.put("/org/requests/:id/checklist", requirePermission("data:edit"), scoped("org"), W((req) => orgRepo.setChecklist(Number(req.params.id), Array.isArray(req.body?.checklist) ? req.body.checklist : [], actorOf(req))));

// ---------------------------------------------------------------- budgets
apiRouter.get("/budget/overview", requirePermission("view:budget"), W(() => budgetRepo.overview()));
apiRouter.get("/budget/opex", requirePermission("view:budget"), W(() => budgetRepo.opex()));
apiRouter.get("/budget/initiatives", requirePermission("view:budget"), W(() => budgetRepo.initiatives()));
apiRouter.get("/budget/transfers", requirePermission("view:budget"), W(() => budgetRepo.transfers()));
apiRouter.post("/budget/transfers", requirePermission("data:edit"), scoped("budget"), W((req) => budgetRepo.createTransfer({ fromLineId: Number(req.body?.fromLineId), toLineId: Number(req.body?.toLineId), amount: Number(req.body?.amount), justificationAr: String(req.body?.justificationAr ?? "") }, actorOf(req))));
const L = (fn: (req: express.Request) => Promise<unknown>) => async (req: express.Request, res: express.Response, next: express.NextFunction) => { try { res.json(await fn(req)); } catch (e) { next(e); } };
apiRouter.get("/learning/dashboard", requirePermission("view:learning"), L(() => learningRepo.dashboard()));
apiRouter.get("/learning/english", requirePermission("view:learning"), L(() => learningRepo.english()));
apiRouter.get("/learning/track/:track", requirePermission("view:learning"), L((req) => { const t = req.params.track as string; if (!s.LEARNING_TRACKS.includes(t as any)) throw Object.assign(new Error("مسار غير معروف"), { status: 404 }); return learningRepo.track(t as s.LearningTrack); }));
apiRouter.get("/learning/employees", requirePermission("view:learning"), L(() => learningRepo.employees()));
apiRouter.get("/learning/employees/:id", requirePermission("view:learning"), L(async (req) => { const d = await learningRepo.employee(Number(req.params.id)); if (!d) throw Object.assign(new Error("المستفيد غير موجود"), { status: 404 }); return d; }));
apiRouter.get("/learning/providers", requirePermission("view:learning"), L(() => learningRepo.providers()));
apiRouter.get("/learning/calendar", requirePermission("view:learning"), L(() => learningRepo.calendar()));
apiRouter.get("/learning/analysis", requirePermission("view:learning"), L(() => learningRepo.analysis()));
apiRouter.get("/learning/reports/:key.csv", requirePermission("view:learning"), async (req, res, next) => {
  try { const r = await learningRepo.reportCsv(req.params.key as string); if (!r) return res.status(404).json({ error: "التقرير غير موجود" }); res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", `attachment; filename="${r.name}.csv"`); res.send(r.csv); } catch (e) { next(e); }
});
apiRouter.get("/system", requirePermission("view:system"), systemHandler);

// Entry screen figures (aggregates only). In production the whole platform sits behind AD/SSO.
publicRouter.get("/landing", async (_req, res, next) => {
  try { res.json(await overviewRepo.landingSummary()); } catch (e) { next(e); }
});

// ---------------------------------------------------------------- executive
apiRouter.get("/overview", requirePermission("view:executive"), async (_req, res, next) => {
  try { res.json(await overviewRepo.executiveOverview()); } catch (e) { next(e); }
});

// ---------------------------------------------------------------- reference lists (used across screens)
apiRouter.get("/goals", requirePermission("view:strategy"), async (_req, res, next) => {
  try { res.json(await db.select().from(s.goals).orderBy(asc(s.goals.sortOrder))); } catch (e) { next(e); }
});
apiRouter.get("/kpis", requirePermission("view:strategy"), async (_req, res, next) => {
  try { res.json(await strategyRepo.kpiList()); } catch (e) { next(e); }
});
apiRouter.get("/kpis/:id", requirePermission("view:strategy"), async (req, res, next) => {
  try {
    const d = await strategyRepo.kpiDetail(Number(req.params.id));
    if (!d) return res.status(404).json({ error: "المؤشر غير موجود" });
    res.json(d);
  } catch (e) { next(e); }
});
apiRouter.get("/impact", requirePermission("view:executive"), async (_req, res, next) => {
  try { res.json(await strategyRepo.impact()); } catch (e) { next(e); }
});
apiRouter.get("/strategy", requirePermission("view:strategy"), async (_req, res, next) => {
  try { res.json(await strategyRepo.strategyMap()); } catch (e) { next(e); }
});
apiRouter.get("/portfolios", requirePermission("view:portfolio"), async (_req, res, next) => {
  try {
    const rows = await db.select({
      id: s.portfolios.id, code: s.portfolios.code, nameAr: s.portfolios.nameAr, nameEn: s.portfolios.nameEn, managerName: s.portfolios.managerName, status: s.portfolios.status,
      value: sql<number>`coalesce(sum(${s.financials.budget}), 0)`, projectCount: sql<number>`count(distinct ${s.projects.id})`,
      programCount: sql<number>`count(distinct ${s.projects.programId})`,
      achievedImpact: sql<number>`coalesce(avg(${s.projects.impactAchieved} / nullif(${s.projects.impactTarget}, 0)) * 100, 0)`,
      onTrack: sql<number>`count(*) filter (where ${s.projects.status} = 'on_track')`,
      atRisk: sql<number>`count(*) filter (where ${s.projects.status} = 'at_risk')`,
      offTrack: sql<number>`count(*) filter (where ${s.projects.status} = 'off_track')`,
    }).from(s.portfolios).leftJoin(s.projects, eq(s.projects.portfolioId, s.portfolios.id)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id))
      .groupBy(s.portfolios.id).orderBy(asc(s.portfolios.code));
    res.json(rows);
  } catch (e) { next(e); }
});
apiRouter.get("/programs", requirePermission("view:portfolio"), async (_req, res, next) => {
  try { res.json(await portfolioRepo.programs()); } catch (e) { next(e); }
});
apiRouter.get("/pmo", requirePermission("view:portfolio"), async (_req, res, next) => {
  try { res.json(await portfolioRepo.pmoCenter()); } catch (e) { next(e); }
});
apiRouter.get("/portfolios/:id", requirePermission("view:portfolio"), async (req, res, next) => {
  try {
    const d = await portfolioRepo.portfolioDetail(Number(req.params.id));
    if (!d) return res.status(404).json({ error: "المحفظة غير موجودة" });
    res.json(d);
  } catch (e) { next(e); }
});
apiRouter.get("/projects/:id", requirePermission("view:portfolio"), async (req, res, next) => {
  try {
    const d = await portfolioRepo.projectDetail(Number(req.params.id));
    if (!d) return res.status(404).json({ error: "المبادرة غير موجودة" });
    res.json(d);
  } catch (e) { next(e); }
});
apiRouter.get("/projects", requirePermission("view:portfolio"), async (_req, res, next) => {
  try {
    const rows = await db.select({
      id: s.projects.id, code: s.projects.code, nameAr: s.projects.nameAr, programId: s.projects.programId, portfolioId: s.projects.portfolioId, sectorId: s.projects.sectorId,
      goalId: s.projects.goalId, managerName: s.projects.managerName, phase: s.projects.phase, progress: s.projects.progress, scheduleStatus: s.projects.scheduleStatus,
      financialStatus: s.projects.financialStatus, status: s.projects.status, impactTarget: s.projects.impactTarget, impactAchieved: s.projects.impactAchieved,
      priorityScore: s.projects.priorityScore, startDate: s.projects.startDate, endDate: s.projects.endDate,
      budget: s.financials.budget, committed: s.financials.committed, actual: s.financials.actual, eac: s.financials.eac,
      programName: s.programs.nameAr, portfolioName: s.portfolios.nameAr, sectorCode: s.sectors.code, sectorName: s.sectors.nameAr,
    }).from(s.projects).innerJoin(s.programs, eq(s.programs.id, s.projects.programId)).innerJoin(s.portfolios, eq(s.portfolios.id, s.projects.portfolioId))
      .innerJoin(s.sectors, eq(s.sectors.id, s.projects.sectorId)).leftJoin(s.financials, eq(s.financials.projectId, s.projects.id))
      .where(eq(s.projects.isArchived, false)).orderBy(asc(s.projects.code));
    res.json(rows);
  } catch (e) { next(e); }
});
apiRouter.get("/regions", requirePermission("view:geo"), async (req, res, next) => {
  try { res.json(await geoRepo.regions(req.query.sector ? Number(req.query.sector) : undefined)); } catch (e) { next(e); }
});
apiRouter.get("/sectors", requirePermission("view:geo"), async (req, res, next) => {
  try { res.json(await geoRepo.sectors(req.query.region ? Number(req.query.region) : undefined)); } catch (e) { next(e); }
});
apiRouter.get("/reference/sectors", requirePermission("view:geo"), async (_req, res, next) => {
  try { res.json(await db.select().from(s.sectors).orderBy(asc(s.sectors.id))); } catch (e) { next(e); }
});
apiRouter.get("/reference/regions", requirePermission("view:geo"), async (_req, res, next) => {
  try { res.json(await db.select().from(s.regions).orderBy(asc(s.regions.id))); } catch (e) { next(e); }
});
apiRouter.get("/decisions", requirePermission("view:executive"), async (req, res, next) => {
  try {
    const d = await strategyRepo.decisions();
    const inbox = await wf.inbox(req.session.role!);
    const items = [] as any[];
    for (const it of inbox) {
      if (it.entity === "budget_transfers") { const t = (await budgetRepo.transfers()).find((x) => x.id === it.entityId); if (t) items.push({ ...it, titleAr: `مناقلة ${t.code}: ${t.from?.cc} — ${t.from?.category} ← ${t.to?.category}`, amount: t.amount, detailAr: t.justificationAr, link: "/budget/opex" }); }
      else if (it.entity === "org_requests") { const r = await orgRepo.request(it.entityId); if (r) items.push({ ...it, titleAr: `${r.request.code}: ${r.request.titleAr}`, amount: null, detailAr: `${r.request.type} · ${r.request.requestingUnit} · أثر ${r.request.impactHeadcount >= 0 ? "+" : ""}${r.request.impactHeadcount} وظيفة · ${r.request.impactBudget} مليون/سنة · جهة القرار: ${r.request.decisionAuthority}`, link: `/org/requests/${r.request.id}` }); }
      else if (it.entity === "candidates") { const c = (await talentRepo.pipeline(actorFull(req))).find((x) => x.id === it.entityId); if (c) items.push({ ...it, titleAr: `${it.definitionName}: ${c.roleAr} — ${c.nameAr}`, amount: null, detailAr: `${c.sectorName}${c.projectName ? ` · ${c.projectName}` : ""} · ${c.sourceAr ?? ""} · الفحص الأمني: ${c.clearanceStatus}${c.isSenior ? " · وظيفة قيادية" : ""}`, link: "/talent/pipeline" }); }
      else items.push({ ...it, titleAr: `${it.definitionName} #${it.entityId}`, amount: null, detailAr: null, link: null });
    }
    res.json({ ...d, workflowItems: items });
  } catch (e) { next(e); }
});
/** CEO decision workflow — status change is audited in change_log (FR-E-05, FR-D-04). */
apiRouter.post("/decisions/:id/decide", requirePermission("decisions:decide"), async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!["معتمد", "مرفوض", "مؤجل"].includes(status)) return res.status(400).json({ error: "حالة القرار غير صحيحة" });
    const d = await strategyRepo.decide(Number(req.params.id), status, req.session.userId!, typeof req.body?.noteAr === "string" ? req.body.noteAr : undefined);
    if (!d) return res.status(404).json({ error: "القرار غير موجود" });
    res.json(d);
  } catch (e) { next(e); }
});
apiRouter.get("/risks", requirePermission("view:performance"), async (_req, res, next) => {
  try { res.json(await perfRepo.risks()); } catch (e) { next(e); }
});
apiRouter.get("/finance", requirePermission("view:performance"), async (_req, res, next) => {
  try { res.json(await perfRepo.finance()); } catch (e) { next(e); }
});
apiRouter.get("/resources", requirePermission("view:performance"), async (_req, res, next) => {
  try { res.json(await perfRepo.resources()); } catch (e) { next(e); }
});
apiRouter.get("/dependencies", requirePermission("view:performance"), async (_req, res, next) => {
  try { res.json(await perfRepo.dependencies()); } catch (e) { next(e); }
});
apiRouter.get("/governance", requirePermission("view:governance"), async (_req, res, next) => {
  try { res.json(await perfRepo.governance()); } catch (e) { next(e); }
});
apiRouter.get("/analytics", requirePermission("view:governance"), async (_req, res, next) => {
  try { res.json(await perfRepo.analytics()); } catch (e) { next(e); }
});
