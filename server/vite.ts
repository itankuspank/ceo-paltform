import type { Express } from "express";
import type { Server } from "http";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Dev: Vite middleware with HMR. Prod: serve the built client. Single process, single port. */
export async function setupClient(app: Express, httpServer: Server) {
  if (process.env.NODE_ENV === "production") {
    const dist = path.resolve(here, "public");
    if (!fs.existsSync(dist)) throw new Error(`Client build not found at ${dist}. Run: npm run build`);
    app.use(express.static(dist, { maxAge: "1h", index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
    return;
  }
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.resolve(here, "..", "vite.config.ts"),
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.get(/^(?!\/api\/).*/, async (req, res, next) => {
    try {
      const indexPath = path.resolve(here, "..", "client", "index.html");
      const html = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(indexPath, "utf-8"));
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) { vite.ssrFixStacktrace(e as Error); next(e); }
  });
}
