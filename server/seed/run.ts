/**
 * npm run db:seed — loads the deterministic synthetic world.
 * Safe to re-run: truncates platform tables first (never touches the session table).
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import * as s from "../../shared/schema";
import { generateWorld, GOALS, SECTORS, REGIONS, PORTFOLIOS, KPIS } from "./generator";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@2026";

const DEMO_USERS: { username: string; fullName: string; role: s.Role }[] = [
  { username: "ceo", fullName: "الرئيس التنفيذي", role: "ceo" },
  { username: "epmo", fullName: "مدير المكتب التنفيذي للمشاريع", role: "epmo" },
  { username: "portfolio", fullName: "م. فهد القحطاني — مدير محفظة", role: "portfolio_manager" },
  { username: "project", fullName: "م. ماجد السبيعي — مدير مشروع", role: "project_manager" },
  { username: "data", fullName: "مدير البيانات", role: "data_manager" },
  { username: "admin", fullName: "مدير النظام", role: "system_admin" },
];

async function main() {
  console.log("⏳ تهيئة البيانات التجريبية…");
  const w = generateWorld();

  await db.execute(sql`TRUNCATE TABLE
    change_requests, change_log, resource_assignments, resources, change_requests_gov, escalations, decisions,
    dependencies, issues, risks, deliverables, milestones, financials, portfolio_goals, project_kpis, project_regions,
    projects, programs, portfolios, kpi_readings, kpis, objectives, goals, sectors, regions, sync_jobs, data_sources, users
    RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db.insert(s.users).values(DEMO_USERS.map((u) => ({ ...u, passwordHash: hash })));

  const goalRows = await db.insert(s.goals).values(GOALS).returning();
  const goalId = Object.fromEntries(goalRows.map((g) => [g.code, g.id]));
  await db.insert(s.objectives).values(w.objectives.map((o) => ({ goalId: goalId[o.goalCode], code: o.code, nameAr: o.nameAr })));

  const sectorRows = await db.insert(s.sectors).values(SECTORS).returning();
  const sectorId = Object.fromEntries(sectorRows.map((x) => [x.code, x.id]));
  const regionRows = await db.insert(s.regions).values(REGIONS).returning();
  const regionId = Object.fromEntries(regionRows.map((x) => [x.code, x.id]));

  const kpiRows = await db.insert(s.kpis).values(KPIS.map((k) => ({
    code: k.code, nameAr: k.nameAr, nameEn: k.nameEn, goalId: goalId[k.goal], ownerSectorId: sectorId[k.sector],
    unit: k.unit, baseline: k.baseline, target: k.target, current: k.current, lowerIsBetter: k.lowerIsBetter, status: k.status,
    source: "manual", rootCauseAr: (k as any).rootCauseAr ?? null,
  }))).returning();
  const kpiId = Object.fromEntries(kpiRows.map((x) => [x.code, x.id]));
  await db.insert(s.kpiReadings).values(w.kpiReadings.map((r) => ({ kpiId: kpiId[r.kpiCode], month: r.month, actual: r.actual, target: r.target })));

  const pfRows = await db.insert(s.portfolios).values(PORTFOLIOS.map((p) => {
    const own = w.projects.filter((x) => x.pf === p.code);
    const off = own.filter((x) => x.status === "off_track").length;
    return { code: p.code, nameAr: p.nameAr, nameEn: p.nameEn, managerName: p.managerName, targetImpact: 100, status: (off >= 6 ? "off_track" : off >= 2 ? "at_risk" : "on_track") as s.Rag };
  })).returning();
  const pfId = Object.fromEntries(pfRows.map((x) => [x.code, x.id]));
  await db.insert(s.portfolioGoals).values(PORTFOLIOS.map((p) => ({ portfolioId: pfId[p.code], goalId: goalId[p.goal] })));

  const prgRows = await db.insert(s.programs).values(w.programs.map((p) => ({
    code: p.code, nameAr: p.nameAr, portfolioId: pfId[p.pf], managerName: p.managerName, scheduleStatus: p.scheduleStatus, financialStatus: p.financialStatus, status: p.status,
  }))).returning();
  const prgId = Object.fromEntries(prgRows.map((x) => [x.code, x.id]));

  const prjRows = await db.insert(s.projects).values(w.projects.map((p) => ({
    code: p.code, nameAr: p.nameAr, programId: prgId[p.programCode], portfolioId: pfId[p.pf], sectorId: sectorId[p.sector], goalId: goalId[p.goal],
    managerName: p.managerName, phase: p.phase, progress: p.progress, scheduleStatus: p.scheduleStatus, financialStatus: p.financialStatus, status: p.status,
    impactTarget: p.impactTarget, impactAchieved: p.impactAchieved, impactContribution: p.impactContribution, priorityScore: p.priorityScore,
    startDate: p.startDate, endDate: p.endDate,
  }))).returning();
  const prjId = Object.fromEntries(prjRows.map((x) => [x.code, x.id]));

  await db.insert(s.financials).values(w.projects.map((p) => ({ projectId: prjId[p.code], budget: p.budget, committed: p.committed, actual: p.actual, eac: p.eac })));
  await db.insert(s.projectRegions).values(w.projects.flatMap((p) => p.regions.map((r) => ({ projectId: prjId[p.code], regionId: regionId[r] }))));
  await db.insert(s.projectKpis).values(w.projectKpis.map((x) => ({ projectId: prjId[x.projectCode], kpiId: kpiId[x.kpiCode], contributionTarget: x.contributionTarget, contributionActual: x.contributionActual })));
  await db.insert(s.milestones).values(w.milestones.map((m) => ({ ...m, projectId: prjId[m.projectCode], projectCode: undefined })));
  await db.insert(s.deliverables).values(w.deliverables.map((d) => ({ projectId: prjId[d.projectCode], nameAr: d.nameAr, status: d.status })));
  await db.insert(s.risks).values(w.risks.map((r) => ({ code: r.code, projectId: prjId[r.projectCode], titleAr: r.titleAr, category: r.category, probability: r.probability, impact: r.impact, response: r.response, status: r.status, ownerAr: r.ownerAr })));
  await db.insert(s.issues).values(w.issues.map((i) => ({ projectId: prjId[i.projectCode], titleAr: i.titleAr, severity: i.severity, status: i.status, openedDays: i.openedDays })));
  await db.insert(s.dependencies).values(w.dependencies.map((d) => ({ fromProjectId: prjId[d.fromCode], toProjectId: prjId[d.toCode], type: d.type, status: d.status, noteAr: d.noteAr })));
  await db.insert(s.escalations).values(w.escalations.map((e) => ({ projectId: prjId[e.projectCode], titleAr: e.titleAr, ownerAr: e.ownerAr, openedDays: e.openedDays, status: e.status })));
  await db.insert(s.changeRequestsGov).values(w.changeRequestsGov.map((c) => ({ code: c.code, projectId: prjId[c.projectCode], titleAr: c.titleAr, impactAr: c.impactAr, status: c.status })));
  await db.insert(s.decisions).values(w.decisions.map((d) => ({ code: d.code, titleAr: d.titleAr, type: d.type, priority: d.priority, amount: d.amount, ownerAr: d.ownerAr, projectId: prjId[d.projectCode], dueDate: d.dueDate, status: d.status, impactNoteAr: d.impactNoteAr })));

  const resRows = await db.insert(s.resources).values(w.resources.map(({ assignments: _a, ...r }) => r)).returning();
  await db.insert(s.resourceAssignments).values(w.resources.flatMap((r, i) => r.assignments.map((a) => ({ resourceId: resRows[i].id, projectId: prjId[a.projectCode], hours: a.hours }))));

  await db.insert(s.dataSources).values(w.dataSources);
  await db.insert(s.syncJobs).values(w.syncJobs);

  console.log(`✓ تم التحميل: ${GOALS.length} غايات · ${KPIS.length} مؤشراً · ${PORTFOLIOS.length} محافظ · ${w.programs.length} برنامجاً · ${w.projects.length} مبادرة · ${REGIONS.length} منطقة · ${w.risks.length} مخاطرة · ${w.decisions.length} قرارات · ${w.resources.length} مورداً`);
  console.log(`✓ حسابات تجريبية (كلمة المرور: ${DEMO_PASSWORD}): ${DEMO_USERS.map((u) => u.username).join(" · ")}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
