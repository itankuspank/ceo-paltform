import express from "express";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { authRouter, requireAuth } from "./auth";
import { apiRouter, publicRouter } from "./routes";
import { setupClient } from "./vite";

const app = express();
const server = createServer(app);
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

/**
 * Air-gap enforcement at the browser level (on-prem: SECURITY_HEADERS=strict).
 * The CSP allows only same-origin requests — any accidental external call is blocked by the browser itself.
 * Off by default in the Replit pilot because its preview runs inside an iframe.
 */
if (process.env.SECURITY_HEADERS === "strict") {
  app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    if (process.env.COOKIE_SECURE !== "false") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
}

/** Health check for the reverse proxy / monitoring (public, no data). */
app.get("/api/health", async (_req, res) => {
  try { await pool.query("select 1"); res.json({ ok: true, db: true, version: process.env.APP_VERSION ?? "0.1.0", mode: process.env.NODE_ENV ?? "development" }); }
  catch { res.status(503).json({ ok: false, db: false }); }
});

const PgStore = connectPgSimple(session);
app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  name: "sid",
  secret: process.env.SESSION_SECRET ?? "dev-only-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// Minimal request log for the API only
app.use("/api", (req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - t0}ms)`));
  next();
});

app.use("/api/auth", authRouter);
app.use("/api", publicRouter);
app.use("/api", requireAuth, apiRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "المسار غير موجود" }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "خطأ داخلي" });
});

const port = Number(process.env.PORT ?? 5000);
setupClient(app, server).then(() => {
  server.listen(port, "0.0.0.0", () => console.log(`✓ المنصة تعمل على المنفذ ${port} (${process.env.NODE_ENV ?? "development"})`));
});
