# منصة متابعة الأعمال والمهام للرئيس التنفيذي — CEO Work & Task Tracking Platform

**برنامج تطوير وزارة الداخلية** · Air-gapped / on-premises ready · Pilot with synthetic data

> Sprints 1–7 complete: all 36 screens — executive layer, strategy & KPIs, portfolio layer with Gantt, regions map (MapLibre,
> bundled GeoJSON), sectors, finance, resources, risks, dependencies, governance, prioritisation analytics, the data
> administration console (ownership · approvals · audit · revert · relations · archive · CSV · users), data quality & integration,
> architecture, and the capability-development module (11 screens incl. the English CEFR dashboard and the readiness index).

## Stack
React 19 · Vite · TypeScript · Tailwind · Recharts · React Router · TanStack Query — Express 5 · PostgreSQL · Drizzle ORM · express-session (pg-backed) · bcrypt.
Single process, single port (5000). **No external calls anywhere** — fonts, charts, icons all bundled from `node_modules`.

## Run on Replit (pilot)
1. Push this folder to a **private** GitHub repo → Replit → *Create Repl → Import from GitHub*.
2. In Replit: **Tools → Database → PostgreSQL** (sets `DATABASE_URL` automatically).
3. **Tools → Secrets**: add `SESSION_SECRET` (any long random string).
4. Shell: `npm install && npm run db:push && npm run db:seed`  (re-run `db:push` + `db:seed` after any update that changes the schema or the seed)
5. Press **Run** (`npm run dev`). Open the webview → `/` is the entry screen, `/login` to sign in.

Demo accounts (password `Demo@2026`): `ceo` · `epmo` · `portfolio` · `project` · `data` · `admin`.
The top-bar role tabs switch the session server-side (pilot only; set `DISABLE_ROLE_SWITCH=true` on-prem).

## Run on-premises (later)
`npm run build` → `NODE_ENV=production DATABASE_URL=… SESSION_SECRET=… node dist/index.js` behind the internal reverse proxy (HTTPS via internal CA).
A full transfer & deployment guide (`docs/DEPLOYMENT-ONPREM.md`) arrives in the final sprint.

## Scripts
| script | purpose |
|---|---|
| `npm run dev` | dev server with HMR (Vite middleware inside Express) |
| `npm run build` | client bundle + server bundle into `dist/` |
| `npm run start` | production server |
| `npm run check` | TypeScript type-check |
| `npm run db:push` | apply schema to PostgreSQL |
| `npm run db:seed` | load / reload the synthetic world (idempotent) |

## Layout
```
shared/    schema.ts (Drizzle + types) · rbac.ts · fieldSources.ts · format.ts
server/    index.ts · auth.ts · db.ts · vite.ts · routes/ · repositories/ · seed/
client/    src/components (ui.tsx, AppShell.tsx) · src/pages · src/lib (api, auth, nav)
```
Replace `client/public/emblem.svg` with the official emblem (keep the file name).
