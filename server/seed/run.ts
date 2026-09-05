/**
 * npm run db:seed — loads the deterministic synthetic world.
 * Safe to re-run: truncates platform tables first (never touches the session table).
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "../db";
import * as s from "../../shared/schema";
import { generateWorld, GOALS, SECTORS, REGIONS, PORTFOLIOS, KPIS, rng } from "./generator";
import { generateLearning, PROVIDERS } from "./learning";
import { generateBudget, WORKFLOW_DEFINITIONS, CLOSED_MONTH } from "./budget";
import { generateOrg } from "./org";
import { generateTalent } from "./talent";
import { generateInnovation, DIMENSIONS } from "./innovation";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@2026";
const R = rng(20260911);

const DEMO_USERS: { username: string; fullName: string; role: s.Role; modules?: string[] }[] = [
  { username: "ceo", fullName: "الرئيس التنفيذي", role: "ceo" },
  { username: "epmo", fullName: "مدير المكتب التنفيذي للمشاريع", role: "epmo" },
  { username: "portfolio", fullName: "م. فهد القحطاني — مدير محفظة", role: "portfolio_manager" },
  { username: "project", fullName: "م. ماجد السبيعي — مدير مشروع", role: "project_manager" },
  { username: "data", fullName: "مدير البيانات", role: "data_manager", modules: ["core", "budget"] },
  { username: "admin", fullName: "مدير النظام", role: "system_admin" },
];

/**
 * Production mode: `npm run db:seed -- --reference-only`
 * Loads ONLY reference data (regions, sectors, workflow definitions, innovation dimensions) and one admin account
 * (ADMIN_USERNAME / ADMIN_PASSWORD from the environment). No synthetic business data — real data enters through
 * the console, CSV import, or the Odoo / Project Server connectors.
 */
async function referenceOnly() {
  console.log("⏳ تحميل البيانات المرجعية فقط (بيئة إنتاجية)…");
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase(); const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error("ADMIN_PASSWORD must be set (10+ characters) for a production seed");
  const [existingAdmin] = await db.select().from(s.users).where(sql`username = ${username}`);
  if (!existingAdmin) await db.insert(s.users).values({ username, fullName: "مدير النظام", role: "system_admin", passwordHash: await bcrypt.hash(password, 12), modules: ["core", "budget", "org", "talent", "innovation"] });
  const [rc] = await db.select({ n: sql<number>`count(*)` }).from(s.regions); if (Number(rc.n) === 0) await db.insert(s.regions).values(REGIONS);
  const [sc] = await db.select({ n: sql<number>`count(*)` }).from(s.sectors); if (Number(sc.n) === 0) await db.insert(s.sectors).values(SECTORS);
  const [wc] = await db.select({ n: sql<number>`count(*)` }).from(s.workflowDefinitions); if (Number(wc.n) === 0) await db.insert(s.workflowDefinitions).values(WORKFLOW_DEFINITIONS);
  const [dc] = await db.select({ n: sql<number>`count(*)` }).from(s.innovationDimensions); if (Number(dc.n) === 0) await db.insert(s.innovationDimensions).values(DIMENSIONS);
  console.log(`✓ البيانات المرجعية جاهزة — الحساب الإداري: ${username}`);
  await pool.end();
}

async function main() {
  if (process.argv.includes("--reference-only")) return referenceOnly();
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Refusing to load synthetic demo data in production. Use --reference-only, or set ALLOW_DEMO_SEED=true deliberately.");
  console.log("⏳ تهيئة البيانات التجريبية…");
  const w = generateWorld();

  await db.execute(sql`TRUNCATE TABLE
    innovation_ideas, innovation_targets, innovation_assessments, innovation_dimensions,
    candidates, requisitions,
    org_request_units, org_requests, org_units,
    workflow_history, workflow_instances, workflow_definitions, budget_transfers, budget_months, budget_lines, initiative_budget_years, cost_centers,
    succession_plans, skills, learning_enrollments, learning_programs, learning_providers,
    change_requests, change_log, resource_assignments, resources, change_requests_gov, escalations, decisions,
    dependencies, issues, risks, deliverables, milestones, financials, portfolio_goals, project_kpis, project_regions,
    projects, programs, portfolios, kpi_readings, kpis, objectives, goals, sectors, regions, sync_jobs, data_sources, users
    RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db.insert(s.users).values(DEMO_USERS.map((u) => ({ username: u.username, fullName: u.fullName, role: u.role, passwordHash: hash, modules: u.modules ?? (u.role === "data_manager" ? ["core"] : ["core", "budget", "org", "talent", "innovation"]) })));

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
    startDate: p.startDate, endDate: p.endDate, tags: [7, 18, 33, 52, 71, 90].includes(Number(p.code.slice(4))) ? ["تنظيمي"] : [3, 11, 24, 40, 57, 63, 78, 95].includes(Number(p.code.slice(4))) ? ["ابتكار"] : [],
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

  // capability development module
  const L = generateLearning(resRows.length, sectorRows.length);
  await db.insert(s.learningProviders).values(PROVIDERS);
  const lpRows = await db.insert(s.learningPrograms).values(L.programs.map((p: any) => ({ ...p, providerId: p.providerId ?? null, sectorId: p.sectorId ?? null }))).returning();
  await db.insert(s.learningEnrollments).values(L.enrollments.map((e: any) => ({ ...e, programId: lpRows[e.programId - 1].id })));
  await db.insert(s.skills).values(L.skills);
  await db.insert(s.successionPlans).values(L.succession);
  console.log(`✓ وحدة التطوير: ${L.programs.length} برنامجاً · ${L.enrollments.length} تسجيلاً · ${L.skills.length} مهارة · ${L.succession.length} خطة إحلال`);

  // workflow engine definitions + budgets
  const defRows = await db.insert(s.workflowDefinitions).values(WORKFLOW_DEFINITIONS).returning();
  const B = generateBudget(sectorRows, prjRows.map((p, i) => ({ id: p.id, code: p.code, budget: w.projects[i].budget, committed: w.projects[i].committed, actual: w.projects[i].actual, status: p.status })));
  const ccRows = await db.insert(s.costCenters).values(B.costCenters).returning();
  const ccId = Object.fromEntries(ccRows.map((c) => [c.code, c.id]));
  const lineRows = await db.insert(s.budgetLines).values(B.lines.map((l: any) => ({ fiscalYear: l.fiscalYear, kind: l.kind, costCenterId: l.ccCode ? ccId[l.ccCode] : null, projectId: l.projectId, chapter: l.chapter, category: l.category, approved: l.approved, committed: l.committed, actual: l.actual }))).returning();
  await db.insert(s.budgetMonths).values(B.lines.flatMap((l: any, i: number) => l._plan.map((planned: number, m: number) => ({ lineId: lineRows[i].id, month: m + 1, planned, actual: l._actuals ? l._actuals[m] : (m < CLOSED_MONTH ? Math.round(l.actual / CLOSED_MONTH * 10) / 10 : null) }))));
  await db.insert(s.initiativeBudgetYears).values(B.initiativeYears);
  const findLine = (cc: string, cat: string) => lineRows.find((l, i) => B.lines[i].ccCode === cc && B.lines[i].category === cat)!;
  const dataUser = (await db.select().from(s.users).where(sql`username = 'data'`))[0];
  const def = defRows.find((d) => d.key === "budget_transfer")!;
  for (const t of B.transfers) {
    const [tr] = await db.insert(s.budgetTransfers).values({ code: t.code, fromLineId: findLine(t.from[0], t.from[1]).id, toLineId: findLine(t.to[0], t.to[1]).id, amount: t.amount, justificationAr: t.justificationAr, requestedByUserId: dataUser.id, status: t.status }).returning();
    const stageKey = def.stages[t.stageIndex].key; const entered = new Date(Date.now() - 86400000 * (t.stageIndex === 2 ? 6 : 2));
    const [inst] = await db.insert(s.workflowInstances).values({ definitionId: def.id, entity: "budget_transfers", entityId: tr.id, currentStage: stageKey, stageEnteredAt: entered, status: (t as any).completed ? "completed" : (t as any).rejected ? "rejected" : "active", completedAt: (t as any).completed || (t as any).rejected ? new Date() : null }).returning();
    const hist = [{ instanceId: inst.id, fromStage: null as string | null, toStage: def.stages[0].key, action: "start", noteAr: null as string | null, userId: dataUser.id }];
    for (let i = 0; i < t.stageIndex; i++) hist.push({ instanceId: inst.id, fromStage: def.stages[i].key, toStage: def.stages[i + 1].key, action: "approve", noteAr: null, userId: dataUser.id });
    if ((t as any).completed) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "approve", noteAr: "تم التنفيذ", userId: dataUser.id });
    if ((t as any).rejected) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "reject", noteAr: "لا يوجد وفر كافٍ في بند الرواتب", userId: dataUser.id });
    await db.insert(s.workflowHistory).values(hist);
  }
  // organizational structures
  const O = generateOrg(sectorRows, prjRows.map((p) => ({ id: p.id, nameAr: p.nameAr, tags: p.tags })));
  const ouRows = await db.insert(s.orgUnits).values(O.units.map(({ ...u }) => u)).returning();
  const orgDef = defRows.find((d) => d.key === "org_request")!;
  for (const r of O.requests) {
    const [req] = await db.insert(s.orgRequests).values({ code: r.code, requestingUnitId: ouRows[r.unit - 1].id, type: r.type, titleAr: r.titleAr, descriptionAr: r.descriptionAr, justificationAr: r.justificationAr, impactHeadcount: r.impactHeadcount, impactBudget: r.impactBudget, duplicationNoteAr: r.duplicationNoteAr ?? null, relatedProjectId: r.relatedProjectId, decisionAuthority: r.decisionAuthority, priority: r.priority, correspondenceRef: `م/${r.code.slice(4)}/2026`, receivedAt: r.receivedAt, status: (r as any).completed ? "منفذ" : (r as any).rejected ? "مرفوض" : "قيد الإجراء", checklist: (r as any).completed ? [{ item: "تحديث الهيكل المعتمد", done: true }, { item: "تحديث الدليل التنظيمي", done: true }, { item: "تحديث نظام الموارد البشرية", done: true }] : [{ item: "تحديث الهيكل المعتمد", done: false }, { item: "تحديث الدليل التنظيمي", done: false }, { item: "تحديث نظام الموارد البشرية", done: false }] }).returning();
    if (r.units.length) await db.insert(s.orgRequestUnits).values(r.units.map((u: any) => ({ requestId: req.id, unitId: u.unitId ? ouRows[u.unitId - 1].id : null, action: u.action, proposedNameAr: u.proposedNameAr, proposedParentId: u.proposedParentId ? ouRows[u.proposedParentId - 1].id : null, proposedLevel: u.proposedLevel, proposedPositions: u.proposedPositions })));
    const stageKey = orgDef.stages[r.stageIndex].key; const entered = new Date(new Date(r.receivedAt).getTime() + 86400000 * (r.stageIndex * 4 + 3));
    const [inst] = await db.insert(s.workflowInstances).values({ definitionId: orgDef.id, entity: "org_requests", entityId: req.id, currentStage: stageKey, stageEnteredAt: (r as any).completed || (r as any).rejected ? entered : new Date(Math.min(entered.getTime(), Date.now() - 86400000 * (r.stageIndex === 4 ? 4 : 1))), status: (r as any).completed ? "completed" : (r as any).rejected ? "rejected" : "active", completedAt: (r as any).completed || (r as any).rejected ? new Date(entered.getTime() + 86400000 * 5) : null, createdAt: new Date(r.receivedAt) }).returning();
    const hist = [{ instanceId: inst.id, fromStage: null as string | null, toStage: orgDef.stages[0].key, action: "start", noteAr: `وارد برقم م/${r.code.slice(4)}/2026` as string | null, userId: dataUser.id, createdAt: new Date(r.receivedAt) }];
    for (let i = 0; i < r.stageIndex; i++) hist.push({ instanceId: inst.id, fromStage: orgDef.stages[i].key, toStage: orgDef.stages[i + 1].key, action: "approve", noteAr: null, userId: dataUser.id, createdAt: new Date(new Date(r.receivedAt).getTime() + 86400000 * (i * 4 + 3)) });
    if ((r as any).completed) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "approve", noteAr: "تم التنفيذ وتحديث الأنظمة", userId: dataUser.id, createdAt: new Date(entered.getTime() + 86400000 * 5) });
    if ((r as any).rejected) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "reject", noteAr: "تداخل مع الإدارة العامة للمراقبة الذكية — يُعاد الطرح ضمن مبادرة توحيد المراقبة", userId: dataUser.id, createdAt: new Date(entered.getTime() + 86400000 * 5) });
    await db.insert(s.workflowHistory).values(hist);
  }
  // talent acquisition
  const Tl = generateTalent(sectorRows, prjRows, resRows.length);
  const rqRows = await db.insert(s.requisitions).values(Tl.requisitions.map((r) => ({ ...r, engagementType: r.engagementType as s.EngagementType }))).returning();
  for (const c of Tl.candidates) {
    const rq = rqRows[c.requisitionId - 1]; const def = defRows.find((d) => d.key === s.ENGAGEMENT_WORKFLOW[c.engagementType as s.EngagementType])!;
    const [cand] = await db.insert(s.candidates).values({ code: c.code, nameAr: c.nameAr, requisitionId: rq.id, engagementType: c.engagementType, sourceAr: c.sourceAr, currentRoleAr: c.currentRoleAr, clearanceStatus: c.clearanceStatus, monthlyRate: c.monthlyRate, secondmentMonths: c.secondmentMonths, referenceAr: c.referenceAr, onboardedResourceId: c.onboardedResourceId ? resRows[c.onboardedResourceId - 1].id : null, onboardedAt: c.onboardedAt, status: c.status, createdAt: new Date(rq.requestedAt) }).returning();
    const stageKey = def.stages[c.stageIndex].key; const entered = new Date(Date.now() - 86400000 * c.daysAgoStage);
    const [inst] = await db.insert(s.workflowInstances).values({ definitionId: def.id, entity: "candidates", entityId: cand.id, currentStage: stageKey, stageEnteredAt: entered, status: c.onboarded ? "completed" : c.dropped ? "rejected" : "active", completedAt: c.onboarded || c.dropped ? entered : null, createdAt: new Date(rq.requestedAt) }).returning();
    const hist = [{ instanceId: inst.id, fromStage: null as string | null, toStage: def.stages[0].key, action: "start", noteAr: null as string | null, userId: dataUser.id, createdAt: new Date(rq.requestedAt) }];
    for (let i = 0; i < c.stageIndex; i++) hist.push({ instanceId: inst.id, fromStage: def.stages[i].key, toStage: def.stages[i + 1].key, action: "approve", noteAr: null, userId: dataUser.id, createdAt: new Date(new Date(rq.requestedAt).getTime() + 86400000 * (i * 6 + 4)) });
    if (c.onboarded) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "approve", noteAr: "تمت المباشرة", userId: dataUser.id, createdAt: entered });
    if (c.dropped) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "reject", noteAr: R.pick(["اعتذار المرشح", "عدم اجتياز المقابلة", "عدم موافقة الجهة"]), userId: dataUser.id, createdAt: entered });
    await db.insert(s.workflowHistory).values(hist);
  }
  // innovation maturity
  await db.insert(s.innovationDimensions).values(DIMENSIONS);
  const Inn = generateInnovation(sectorRows, regionRows);
  await db.insert(s.innovationAssessments).values(Inn.assessments);
  await db.insert(s.innovationTargets).values(Inn.targets);
  const ideaDef = defRows.find((d) => d.key === "innovation_idea")!;
  const innovProjects = prjRows.filter((p) => p.tags.includes("ابتكار"));
  for (const [i, idea] of Inn.ideas.entries()) {
    const [row] = await db.insert(s.innovationIdeas).values({ code: idea.code, titleAr: idea.titleAr, descriptionAr: idea.descriptionAr, category: idea.category, sourceType: idea.sourceType, sourceId: idea.sourceId, submittedByAr: idea.submittedByAr, submittedAt: idea.submittedAt, impactValue: idea.impactValue, impactNoteAr: idea.impactNoteAr, linkedProjectId: idea.scaled ? innovProjects[i % innovProjects.length]?.id ?? null : null, status: idea.status }).returning();
    const stageKey = ideaDef.stages[idea.stageIndex].key; const entered = new Date(Date.now() - 86400000 * idea.daysAgoStage);
    const [inst] = await db.insert(s.workflowInstances).values({ definitionId: ideaDef.id, entity: "innovation_ideas", entityId: row.id, currentStage: stageKey, stageEnteredAt: entered, status: idea.scaled ? "completed" : idea.dropped ? "rejected" : "active", completedAt: idea.scaled || idea.dropped ? entered : null, createdAt: new Date(idea.submittedAt) }).returning();
    const hist = [{ instanceId: inst.id, fromStage: null as string | null, toStage: ideaDef.stages[0].key, action: "start", noteAr: null as string | null, userId: dataUser.id, createdAt: new Date(idea.submittedAt) }];
    for (let k = 0; k < idea.stageIndex; k++) hist.push({ instanceId: inst.id, fromStage: ideaDef.stages[k].key, toStage: ideaDef.stages[k + 1].key, action: "approve", noteAr: null, userId: dataUser.id, createdAt: new Date(new Date(idea.submittedAt).getTime() + 86400000 * (k * 12 + 6)) });
    if (idea.scaled) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "approve", noteAr: "اعتماد التوسع على مستوى الوزارة", userId: dataUser.id, createdAt: entered });
    if (idea.dropped) hist.push({ instanceId: inst.id, fromStage: stageKey, toStage: stageKey, action: "reject", noteAr: "نتائج التجربة دون المستهدف", userId: dataUser.id, createdAt: entered });
    await db.insert(s.workflowHistory).values(hist);
  }
  console.log(`✓ الابتكار: ${DIMENSIONS.length} أبعاد · ${Inn.assessments.length} تقييماً · ${Inn.ideas.length} فكرة`);

  console.log(`✓ الاستقطاب: ${rqRows.length} احتياجاً · ${Tl.candidates.length} مرشحاً · ${Tl.candidates.filter((c) => c.onboarded).length} مباشرة`);

  console.log(`✓ الهياكل التنظيمية: ${ouRows.length} وحدة تنظيمية · ${O.requests.length} طلباً`);

  console.log(`✓ الميزانية ومسارات العمل: ${ccRows.length} مراكز تكلفة · ${lineRows.length} بنداً · ${B.transfers.length} مناقلات · ${defRows.length} مسارات عمل`);

  await db.insert(s.dataSources).values(w.dataSources);
  await db.insert(s.syncJobs).values(w.syncJobs);

  console.log(`✓ تم التحميل: ${GOALS.length} غايات · ${KPIS.length} مؤشراً · ${PORTFOLIOS.length} محافظ · ${w.programs.length} برنامجاً · ${w.projects.length} مبادرة · ${REGIONS.length} منطقة · ${w.risks.length} مخاطرة · ${w.decisions.length} قرارات · ${w.resources.length} مورداً`);
  console.log(`✓ حسابات تجريبية (كلمة المرور: ${DEMO_PASSWORD}): ${DEMO_USERS.map((u) => u.username).join(" · ")}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
