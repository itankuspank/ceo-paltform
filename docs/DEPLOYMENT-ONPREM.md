# دليل النقل والنشر في البيئة الداخلية — On-Premises Transfer & Deployment Guide

**منصة متابعة الأعمال والمهام للرئيس التنفيذي · برنامج تطوير وزارة الداخلية**
Version 1.0 — for الإدارة العامة لتقنية المعلومات. Applies to the pilot codebase (Sprints 1–12).

---

## 1. ما الذي يُنقل — What moves

| Component | Pilot (Replit) | On-premises target |
|---|---|---|
| Application | Node 22 process (Express + built React client), port 5000 | Same process behind an internal reverse proxy (TLS from the ministry CA) |
| Database | Replit PostgreSQL | **PostgreSQL 16** on an internal server (SQL Server EPM DWH remains the analytical store; see §9) |
| Source of truth | Private GitHub repository | Internal Git (or a sealed release bundle) — GitHub is not reachable from the air-gapped network |
| Data | Synthetic seed | Reference data only (`--reference-only`), then real data via console / CSV / connectors |
| Identity | Demo accounts + role switcher | Real accounts; role switcher disabled (`DISABLE_ROLE_SWITCH=true`); AD/SSO in a later phase (§8) |

The application makes **no external calls**: fonts, map boundaries, charts, icons, and the offline service worker are all served from the app itself. `npm run audit:airgap` proves this on every build (§6).

---

## 2. المتطلبات — Prerequisites (internal network)

- **Application server:** Linux (Ubuntu 22.04/24.04 or RHEL 9) or Windows Server 2022; 2 vCPU / 4 GB RAM is ample for the executive audience; Node.js **22 LTS** installed from the ministry's approved package mirror.
- **Database server:** PostgreSQL **16**, UTF-8, timezone Asia/Riyadh; a dedicated database `ceo_platform` and role `ceo_app` with rights on that database only.
- **Reverse proxy:** nginx (or IIS/ARR) terminating HTTPS with a certificate from the internal CA. The PWA (offline mode, installable app) requires HTTPS.
- **DNS:** an internal name such as `ceo-platform.moi.local`.
- **Transfer medium:** approved removable media or the internal file-transfer gateway for the release bundle (§3).

---

## 3. بناء حزمة النقل — Building the transfer bundle (on a connected staging machine)

```bash
git clone <repo> ceo-platform && cd ceo-platform
npm ci                                   # exact versions from package-lock.json
npm run check                            # TypeScript
npm run build                            # dist/public (client) + dist/index.js (server)
npm run audit:airgap                     # must print "No external fetch targets found"
npm prune --omit=dev                     # keep only runtime dependencies
tar -czf ceo-platform-release-$(date +%Y%m%d).tgz \
  dist migrations client/public/fonts package.json package-lock.json node_modules .env.example docs
sha256sum ceo-platform-release-*.tgz > ceo-platform-release.sha256
```

Transfer the `.tgz` and `.sha256` through the approved channel. Verify the hash on arrival.

---

## 4. قاعدة البيانات — Database

```bash
sudo -u postgres psql -c "CREATE ROLE ceo_app LOGIN PASSWORD '<strong-password>';"
sudo -u postgres psql -c "CREATE DATABASE ceo_platform OWNER ceo_app ENCODING 'UTF8';"
psql "postgresql://ceo_app:<pw>@db.moi.local:5432/ceo_platform" -f migrations/0000_initial_schema.sql
```

`migrations/` contains the full schema as plain SQL (generated from the code, no tooling needed on-prem). Future releases ship additional numbered files; apply them in order.

The `session` table is created automatically by the application on first start.

---

## 5. التطبيق — Application service

```bash
sudo mkdir -p /opt/ceo-platform && sudo tar -xzf ceo-platform-release-*.tgz -C /opt/ceo-platform
sudo useradd --system --home /opt/ceo-platform ceoapp && sudo chown -R ceoapp:ceoapp /opt/ceo-platform
sudo cp /opt/ceo-platform/.env.example /opt/ceo-platform/.env   # then edit:
```

`.env` (production values):
```
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://ceo_app:<pw>@db.moi.local:5432/ceo_platform
SESSION_SECRET=<64 random characters>
DISABLE_ROLE_SWITCH=true       # hides the demo role tabs and demo accounts
SECURITY_HEADERS=strict        # CSP: browser blocks anything that is not same-origin
COOKIE_SECURE=true             # HTTPS only
APP_VERSION=1.0.0
```

Reference data + the first admin account (no synthetic data):
```bash
cd /opt/ceo-platform && ADMIN_USERNAME=admin ADMIN_PASSWORD='<12+ chars>' \
  node --env-file=.env node_modules/tsx/dist/cli.mjs server/seed/run.ts --reference-only
```
*(If `tsx` was pruned, run the reference seed on the staging machine against the on-prem database over an approved tunnel, or keep `tsx` in the bundle by skipping `npm prune` — it is small.)*

systemd unit `/etc/systemd/system/ceo-platform.service`:
```ini
[Unit]
Description=CEO Work & Task Tracking Platform
After=network.target postgresql.service

[Service]
User=ceoapp
WorkingDirectory=/opt/ceo-platform
EnvironmentFile=/opt/ceo-platform/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now ceo-platform
curl -s http://127.0.0.1:5000/api/health      # {"ok":true,"db":true,...}
```

---

## 6. الوكيل العكسي والأمن — Reverse proxy & security

nginx `/etc/nginx/conf.d/ceo-platform.conf`:
```nginx
server {
  listen 443 ssl http2;
  server_name ceo-platform.moi.local;
  ssl_certificate     /etc/ssl/moi/ceo-platform.crt;   # internal CA
  ssl_certificate_key /etc/ssl/moi/ceo-platform.key;
  client_max_body_size 5m;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
server { listen 80; server_name ceo-platform.moi.local; return 301 https://$host$request_uri; }
```

What the platform enforces by itself in this mode: same-origin-only Content-Security-Policy, `X-Frame-Options`, `nosniff`, HSTS, secure/httpOnly/sameSite cookies with 8-hour sessions, deny-by-default authorization on every API route, field-ownership and sensitivity rules in the data console, and a full audit trail (`change_log`, `workflow_history`).

Air-gap proof: `npm run audit:airgap` scans the built client for any external URL; the only matches are library documentation links that are never fetched. The service worker caches everything locally, so the app keeps working during network interruptions (last data shown, banner "دون اتصال").

---

## 7. النسخ الاحتياطي والتشغيل — Backups & operations

- Nightly `pg_dump -Fc ceo_platform > /backup/ceo_platform_$(date +%F).dump`, retained per the ministry policy (BRD GAP-10).
- Logs: the service writes to journald (`journalctl -u ceo-platform`); the API logs method, path, status and latency only — no personal data.
- Upgrades: stop service → apply new `migrations/*.sql` → replace `dist/` and `node_modules` → start → check `/api/health`. Rollback = previous bundle + database restore.
- Health monitoring: poll `/api/health` (503 when the database is unreachable).

---

## 8. الهوية والتكامل — Identity & integration seams (next phase)

- **Active Directory / SSO:** `server/auth.ts` is the only file that knows how users authenticate. Replace the password check with Kerberos/IWA or ADFS/SAML validation and map AD groups to the six roles + module scopes; the session, RBAC and audit layers stay unchanged.
- **Odoo ERP / Microsoft Project Server connectors:** each screen reads through a repository (`server/repositories/*`). Connectors populate the same tables on a schedule (ETL into `financials`, `resources`, `projects`, `budget_lines`, `org_units`, `candidates`…), and the field-ownership map (`shared/fieldSources.ts`) already declares which system owns which field. Source status appears in جودة البيانات والتكامل.
- **SQL Server EPM DWH:** the platform's PostgreSQL is the operational store; a nightly extract to the DWH (or a read replica) feeds Power BI Report Server without touching the application.

---

## 9. قائمة الاعتماد للتشغيل — Go-live checklist

1. Release bundle hash verified; `npm run audit:airgap` passed on the exact build.
2. Database created, `migrations/0000_initial_schema.sql` applied, reference seed loaded, admin password stored in the vault.
3. `.env` reviewed: `DISABLE_ROLE_SWITCH=true`, `SECURITY_HEADERS=strict`, `COOKIE_SECURE=true`, strong `SESSION_SECRET`.
4. HTTPS certificate from the internal CA installed; PWA installs on a ministry Windows device (Sakkal Majalla renders locally; the bundled font covers iPad/Mac).
5. `/api/health` returns `ok:true`; login works; the CEO overview renders with reference data only (empty KPIs are expected until data is loaded).
6. Real users created in إدارة البيانات → المستخدمون والصلاحيات with module scopes; demo accounts absent.
7. Initial data loaded: goals/KPIs/portfolios via CSV templates from the console; org structure from the org manual; budgets from the MoF extract; connectors scheduled.
8. Backup job verified with a restore test.
9. Sign-off recorded by المكتب التنفيذي per the SOW RACI.
