import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { authRouter, requireAuth } from "./auth";
import { apiRouter, publicRouter } from "./routes";
import { setupClient } from "./vite";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

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
setupClient(app).then(() => {
  app.listen(port, "0.0.0.0", () => console.log(`✓ المنصة تعمل على المنفذ ${port} (${process.env.NODE_ENV ?? "development"})`));
});
