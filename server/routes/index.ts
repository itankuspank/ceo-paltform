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

export const apiRouter: Router = express.Router();
export const publicRouter: Router = express.Router();
const overviewRepo = new OverviewRepository(db);
const strategyRepo = new StrategyRepository(db);
const portfolioRepo = new PortfolioRepository(db);
const geoRepo = new GeoRepository(db);
const perfRepo = new PerformanceRepository(db);

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
apiRouter.get("/decisions", requirePermission("view:executive"), async (_req, res, next) => {
  try { res.json(await strategyRepo.decisions()); } catch (e) { next(e); }
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
