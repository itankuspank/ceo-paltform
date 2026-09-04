import express, { type Router, type Request } from "express";
import { db } from "../db";
import { requirePermission } from "../auth";
import { can, type Permission } from "../../shared/rbac";
import { DataRepository, HttpError } from "../repositories/data";

export const dataRouter: Router = express.Router();
const repo = new DataRepository(db);
const actor = (req: Request) => ({ userId: req.session.userId!, role: req.session.role, modules: req.session.modules, can: (p: Permission) => can(req.session.role, p) });
const wrap = (fn: (req: Request, res: express.Response) => Promise<unknown>) => async (req: Request, res: express.Response, next: express.NextFunction) => {
  try { const out = await fn(req, res); if (out !== undefined) res.json(out); } catch (e) { if (e instanceof HttpError) return res.status(e.status).json({ error: e.message }); next(e); }
};

dataRouter.get("/entities", requirePermission("view:data"), wrap(async () => repo.metadata()));
dataRouter.get("/changelog", requirePermission("view:data"), wrap(async (req) => repo.changeLog(req.query.entity ? String(req.query.entity) : undefined)));
dataRouter.post("/changelog/:id/revert", requirePermission("view:data"), wrap(async (req) => repo.revert(Number(req.params.id), actor(req))));
dataRouter.get("/requests", requirePermission("view:data"), wrap(async (req) => repo.requests(req.query.status ? String(req.query.status) : undefined)));
dataRouter.post("/requests/:id/decide", requirePermission("view:data"), wrap(async (req) => {
  const st = req.body?.status; if (st !== "approved" && st !== "rejected") throw new HttpError(400, "الحالة غير صحيحة");
  return repo.decideRequest(Number(req.params.id), st, actor(req));
}));
dataRouter.get("/relations/:projectId", requirePermission("view:data"), wrap(async (req) => repo.relations(Number(req.params.projectId))));
dataRouter.put("/relations/:projectId", requirePermission("view:data"), wrap(async (req) => repo.saveRelations(Number(req.params.projectId), (req.body?.regionIds ?? []).map(Number), (req.body?.kpiIds ?? []).map(Number), actor(req))));
dataRouter.get("/quality", requirePermission("view:data"), wrap(async () => repo.quality()));
dataRouter.get("/users", requirePermission("users:manage"), wrap(async () => repo.users()));
dataRouter.patch("/users/:id", requirePermission("users:manage"), wrap(async (req) => repo.updateUser(Number(req.params.id), { isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined, modules: Array.isArray(req.body?.modules) ? req.body.modules : undefined }, actor(req))));

dataRouter.get("/:entity/options", requirePermission("view:data"), wrap(async (req) => repo.fkOptions(req.params.entity as string)));
dataRouter.get("/:entity/export.csv", requirePermission("view:data"), wrap(async (req, res) => {
  const csv = await repo.exportCsv(req.params.entity as string);
  res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", `attachment; filename="${req.params.entity}.csv"`); res.send(csv);
}));
dataRouter.post("/:entity/import", requirePermission("data:import"), wrap(async (req) => {
  const rows = req.body?.rows; if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, "لا توجد صفوف للاستيراد");
  if (rows.length > 5000) throw new HttpError(400, "الحد الأقصى 5000 صف لكل عملية استيراد");
  return repo.importRows(req.params.entity as string, rows, actor(req));
}));
dataRouter.get("/:entity", requirePermission("view:data"), wrap(async (req) => repo.list(req.params.entity as string, req.query.q ? String(req.query.q) : undefined, req.query.archived === "1")));
dataRouter.post("/:entity", requirePermission("data:edit"), wrap(async (req) => repo.create(req.params.entity as string, req.body ?? {}, actor(req))));
dataRouter.patch("/:entity/:id", requirePermission("data:edit"), wrap(async (req) => repo.update(req.params.entity as string, Number(req.params.id), req.body?.changes ?? {}, typeof req.body?.reasonAr === "string" ? req.body.reasonAr : undefined, actor(req))));
dataRouter.post("/:entity/:id/archive", requirePermission("data:edit"), wrap(async (req) => repo.archive(req.params.entity as string, Number(req.params.id), true, actor(req))));
dataRouter.post("/:entity/:id/restore", requirePermission("data:edit"), wrap(async (req) => repo.archive(req.params.entity as string, Number(req.params.id), false, actor(req))));

export const systemHandler = wrap(async () => repo.system());
