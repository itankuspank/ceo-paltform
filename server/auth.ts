import type { Request, Response, NextFunction, Router } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type Role, ROLES, type SafeUser } from "../shared/schema";
import { can, type Permission } from "../shared/rbac";

declare module "express-session" {
  interface SessionData { userId?: number; role?: Role; modules?: string[]; }
}

function safe(u: typeof users.$inferSelect): SafeUser {
  const { passwordHash: _p, ...rest } = u;
  return rest;
}

/** Deny by default: every /api route except auth requires a session. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح — يلزم تسجيل الدخول" });
  next();
}

export function requirePermission(p: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "غير مصرح" });
    if (!can(req.session.role, p)) return res.status(403).json({ error: "لا تملك صلاحية تنفيذ هذا الإجراء" });
    next();
  };
}

export const authRouter: Router = express.Router();

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ error: "بيانات الدخول غير مكتملة" });
  const [u] = await db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).limit(1);
  if (!u || !u.isActive || !(await bcrypt.compare(password, u.passwordHash))) {
    return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "تعذر إنشاء الجلسة" });
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.modules = u.modules;
    res.json({ user: safe(u) });
  });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => { res.clearCookie("sid"); res.json({ ok: true }); });
});

const demoMode = () => process.env.DISABLE_ROLE_SWITCH !== "true";

authRouter.get("/me", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ user: null, demoMode: demoMode() });
  const [u] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
  if (!u) return res.status(401).json({ user: null, demoMode: demoMode() });
  res.json({ user: safe(u), demoMode: demoMode() });
});
authRouter.get("/config", (_req, res) => res.json({ demoMode: demoMode() }));

/**
 * Demo role switcher (pilot only). Swaps the session to the demo account of the chosen role,
 * exactly like the prototype's top-bar tabs. Server-side, so RBAC stays authoritative.
 * In production this endpoint is removed and roles come from Active Directory groups.
 */
authRouter.post("/switch-role", requireAuth, async (req, res) => {
  const role = req.body?.role as Role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: "دور غير معروف" });
  if (process.env.DISABLE_ROLE_SWITCH === "true") return res.status(403).json({ error: "مبدل الأدوار معطل في البيئة الإنتاجية" });
  const [u] = await db.select().from(users).where(eq(users.role, role)).limit(1);
  if (!u) return res.status(404).json({ error: "لا يوجد حساب تجريبي لهذا الدور" });
  req.session.userId = u.id;
  req.session.role = u.role;
  req.session.modules = u.modules;
  res.json({ user: safe(u) });
});
