/**
 * Data model — منصة متابعة الأعمال والمهام للرئيس التنفيذي
 * Single source of truth for both server (Drizzle) and client (types).
 *
 * Money is stored in SAR millions (real). Percentages 0–100 (real).
 * RAG status: on_track | at_risk | off_track.
 * Field ownership (Project Server / Odoo / manual / computed) lives in shared/fieldSources.ts.
 */
import {
  pgTable, serial, text, integer, real, boolean, timestamp, date, primaryKey, index, varchar, json,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const ROLES = ["ceo", "epmo", "portfolio_manager", "project_manager", "data_manager", "system_admin"] as const;
export type Role = (typeof ROLES)[number];

export const RAG = ["on_track", "at_risk", "off_track"] as const;
export type Rag = (typeof RAG)[number];

// ---------------------------------------------------------------- auth
/** Session store table used by connect-pg-simple — declared so drizzle-kit never mistakes new tables for a rename of it. */
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (t) => [index("IDX_session_expire").on(t.expire)]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").$type<Role>().notNull(),
  modules: text("modules").array().notNull().default(sql`'{core}'::text[]`), // data-manager scope: core | budget | org | talent | innovation
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- strategy
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // G1..G5
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  targetImpact: real("target_impact").notNull(),   // %
  achievedImpact: real("achieved_impact").notNull(),
  investment: real("investment").notNull(),        // SAR millions
  sortOrder: integer("sort_order").notNull().default(0),
});

export const objectives = pgTable("objectives", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goals.id),
  code: text("code").notNull().unique(),          // G1-01
  nameAr: text("name_ar").notNull(),
});

export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // KPI-01
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  goalId: integer("goal_id").notNull().references(() => goals.id),
  ownerSectorId: integer("owner_sector_id").references(() => sectors.id),
  unit: text("unit").notNull().default("%"),
  baseline: real("baseline").notNull(),
  target: real("target").notNull(),
  current: real("current").notNull(),
  lowerIsBetter: boolean("lower_is_better").notNull().default(false),
  status: text("status").$type<Rag>().notNull(),
  source: text("source").notNull().default("manual"),
  rootCauseAr: text("root_cause_ar"),
});

export const kpiReadings = pgTable("kpi_readings", {
  id: serial("id").primaryKey(),
  kpiId: integer("kpi_id").notNull().references(() => kpis.id),
  month: date("month").notNull(),                 // first day of month
  actual: real("actual").notNull(),
  target: real("target").notNull(),
}, (t) => [index("kpi_readings_kpi_idx").on(t.kpiId)]);

// ---------------------------------------------------------------- reference data
export const regions = pgTable("regions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
});

export const sectors = pgTable("sectors", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // SEC-PS
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
});

// ---------------------------------------------------------------- portfolio hierarchy
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // PF-1
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  managerName: text("manager_name").notNull(),
  targetImpact: real("target_impact").notNull().default(100),
  status: text("status").$type<Rag>().notNull(),
});

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // PRG-01
  nameAr: text("name_ar").notNull(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
  managerName: text("manager_name").notNull(),
  scheduleStatus: text("schedule_status").$type<Rag>().notNull(),
  financialStatus: text("financial_status").$type<Rag>().notNull(),
  status: text("status").$type<Rag>().notNull(),
});

export const PHASES = ["المفهوم", "التخطيط", "التنفيذ", "الإغلاق", "المنافع"] as const;

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // PRJ-001
  nameAr: text("name_ar").notNull(),
  programId: integer("program_id").notNull().references(() => programs.id),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
  sectorId: integer("sector_id").notNull().references(() => sectors.id),
  goalId: integer("goal_id").notNull().references(() => goals.id),
  managerName: text("manager_name").notNull(),
  phase: text("phase").notNull(),
  progress: real("progress").notNull(),           // %
  scheduleStatus: text("schedule_status").$type<Rag>().notNull(),
  financialStatus: text("financial_status").$type<Rag>().notNull(),
  status: text("status").$type<Rag>().notNull(),
  impactTarget: real("impact_target").notNull(),  // contribution % target
  impactAchieved: real("impact_achieved").notNull(),
  impactContribution: text("impact_contribution").notNull().default("متوسطة"), // عالية/متوسطة/منخفضة
  priorityScore: real("priority_score").notNull().default(70),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),   // e.g. تنظيمي · ابتكار
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
}, (t) => [index("projects_portfolio_idx").on(t.portfolioId), index("projects_program_idx").on(t.programId)]);

export const projectRegions = pgTable("project_regions", {
  projectId: integer("project_id").notNull().references(() => projects.id),
  regionId: integer("region_id").notNull().references(() => regions.id),
}, (t) => [primaryKey({ columns: [t.projectId, t.regionId] })]);

export const projectKpis = pgTable("project_kpis", {
  projectId: integer("project_id").notNull().references(() => projects.id),
  kpiId: integer("kpi_id").notNull().references(() => kpis.id),
  contributionTarget: real("contribution_target").notNull(),
  contributionActual: real("contribution_actual").notNull(),
}, (t) => [primaryKey({ columns: [t.projectId, t.kpiId] })]);

export const portfolioGoals = pgTable("portfolio_goals", {
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id),
  goalId: integer("goal_id").notNull().references(() => goals.id),
}, (t) => [primaryKey({ columns: [t.portfolioId, t.goalId] })]);

// ---------------------------------------------------------------- finance (Odoo-owned)
export const financials = pgTable("financials", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id).unique(),
  budget: real("budget").notNull(),               // SAR millions
  committed: real("committed").notNull(),
  actual: real("actual").notNull(),
  eac: real("eac").notNull(),
  fiscalYear: integer("fiscal_year").notNull().default(2026),
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  nameAr: text("name_ar").notNull(),
  plannedStart: date("planned_start").notNull(),
  plannedEnd: date("planned_end").notNull(),
  actualStart: date("actual_start"),
  actualEnd: date("actual_end"),
  delayDays: integer("delay_days").notNull().default(0),
  status: text("status").notNull(),               // مكتمل | قيد التنفيذ | متأخر | لم يبدأ
  isCritical: boolean("is_critical").notNull().default(false),
}, (t) => [index("milestones_project_idx").on(t.projectId)]);

export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  nameAr: text("name_ar").notNull(),
  status: text("status").notNull(),               // مكتمل | قيد التنفيذ | متأخر | قيد التسليم
});

// ---------------------------------------------------------------- risk, issues, dependencies
export const RISK_CATEGORIES = ["تعاقدي", "أمن معلومات", "مالي", "موارد", "تقني", "تنظيمي"] as const;

export const risks = pgTable("risks", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  titleAr: text("title_ar").notNull(),
  category: text("category").notNull(),
  probability: integer("probability").notNull(),  // 1-5
  impact: integer("impact").notNull(),            // 1-5
  response: text("response").notNull(),           // تجنب | قبول | نقل | تخفيف
  status: text("status").notNull(),               // مفتوح | قيد المعالجة | تحت المراقبة | مغلق
  ownerAr: text("owner_ar").notNull(),
});

export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  titleAr: text("title_ar").notNull(),
  severity: text("severity").notNull(),           // حرجة | مرتفعة | متوسطة
  status: text("status").notNull(),               // مفتوحة | قيد المعالجة | مغلقة
  openedDays: integer("opened_days").notNull().default(0),
});

export const dependencies = pgTable("dependencies", {
  id: serial("id").primaryKey(),
  fromProjectId: integer("from_project_id").notNull().references(() => projects.id),
  toProjectId: integer("to_project_id").notNull().references(() => projects.id),
  type: text("type").notNull(),                   // بنية تحتية | تعاقدي | موارد | بيانات | مخرج
  status: text("status").$type<Rag>().notNull(),
  noteAr: text("note_ar").notNull(),
});

// ---------------------------------------------------------------- executive decisions & governance
export const DECISION_TYPES = ["اعتماد مالي", "قرار نطاق", "تصعيد استراتيجي", "قرار موارد", "قبول مخاطرة"] as const;

export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // DEC-001
  titleAr: text("title_ar").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull(),           // عاجلة | مرتفعة | متوسطة
  amount: real("amount"),                         // SAR millions, nullable
  ownerAr: text("owner_ar").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull(),               // معلق | معتمد | مرفوض | مؤجل
  impactNoteAr: text("impact_note_ar"),
  decidedAt: timestamp("decided_at"),
  decidedByUserId: integer("decided_by_user_id").references(() => users.id),
});

export const escalations = pgTable("escalations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  titleAr: text("title_ar").notNull(),
  ownerAr: text("owner_ar").notNull(),
  openedDays: integer("opened_days").notNull(),
  status: text("status").notNull(),               // مفتوحة | مغلقة
});

export const changeRequestsGov = pgTable("change_requests_gov", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),          // CR-014
  projectId: integer("project_id").notNull().references(() => projects.id),
  titleAr: text("title_ar").notNull(),
  impactAr: text("impact_ar").notNull(),
  status: text("status").notNull(),               // بانتظار لجنة التغيير | معتمد | مرفوع للجنة | قيد الدراسة
});

// ---------------------------------------------------------------- resources (Odoo HR + Project Server)
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  roleAr: text("role_ar").notNull(),
  departmentAr: text("department_ar").notNull(),
  capacityHours: integer("capacity_hours").notNull().default(160),
  leaveHours: integer("leave_hours").notNull().default(0),
  trainingHours: integer("training_hours").notNull().default(0),
  hourlyCost: real("hourly_cost").notNull(),
});

export const resourceAssignments = pgTable("resource_assignments", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull().references(() => resources.id),
  projectId: integer("project_id").notNull().references(() => projects.id),
  hours: integer("hours").notNull(),
}, (t) => [index("ra_resource_idx").on(t.resourceId)]);

// ---------------------------------------------------------------- data governance
export const changeLog = pgTable("change_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reasonAr: text("reason_ar"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revertedAt: timestamp("reverted_at"),
}, (t) => [index("change_log_entity_idx").on(t.entity, t.entityId)]);

export const changeRequests = pgTable("change_requests", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  field: text("field").notNull(),
  currentValue: text("current_value"),
  proposedValue: text("proposed_value").notNull(),
  reasonAr: text("reason_ar"),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  decidedByUserId: integer("decided_by_user_id").references(() => users.id),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  system: text("system").notNull(),               // project_server | odoo_finance | odoo_hr | manual | dwh
  recordCount: integer("record_count").notNull(),
  quality: real("quality").notNull(),             // %
  lastSyncAt: timestamp("last_sync_at").notNull(),
  status: text("status").$type<Rag>().notNull(),
});

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  scheduleAr: text("schedule_ar").notNull(),
  lastRunAt: timestamp("last_run_at").notNull(),
  status: text("status").notNull(),               // ناجحة | جارٍ | فاشلة
});

// ---------------------------------------------------------------- relations (for query API)
export const projectsRelations = relations(projects, ({ one, many }) => ({
  program: one(programs, { fields: [projects.programId], references: [programs.id] }),
  portfolio: one(portfolios, { fields: [projects.portfolioId], references: [portfolios.id] }),
  sector: one(sectors, { fields: [projects.sectorId], references: [sectors.id] }),
  goal: one(goals, { fields: [projects.goalId], references: [goals.id] }),
  financial: one(financials, { fields: [projects.id], references: [financials.projectId] }),
  risks: many(risks),
  regions: many(projectRegions),
  kpis: many(projectKpis),
}));
export const programsRelations = relations(programs, ({ one, many }) => ({
  portfolio: one(portfolios, { fields: [programs.portfolioId], references: [portfolios.id] }),
  projects: many(projects),
}));
export const portfoliosRelations = relations(portfolios, ({ many }) => ({ programs: many(programs), projects: many(projects) }));
export const projectRegionsRelations = relations(projectRegions, ({ one }) => ({
  project: one(projects, { fields: [projectRegions.projectId], references: [projects.id] }),
  region: one(regions, { fields: [projectRegions.regionId], references: [regions.id] }),
}));
export const projectKpisRelations = relations(projectKpis, ({ one }) => ({
  project: one(projects, { fields: [projectKpis.projectId], references: [projects.id] }),
  kpi: one(kpis, { fields: [projectKpis.kpiId], references: [kpis.id] }),
}));
export const risksRelations = relations(risks, ({ one }) => ({ project: one(projects, { fields: [risks.projectId], references: [projects.id] }) }));
export const kpisRelations = relations(kpis, ({ one, many }) => ({
  goal: one(goals, { fields: [kpis.goalId], references: [goals.id] }),
  readings: many(kpiReadings),
  projects: many(projectKpis),
}));
export const kpiReadingsRelations = relations(kpiReadings, ({ one }) => ({ kpi: one(kpis, { fields: [kpiReadings.kpiId], references: [kpis.id] }) }));

// ---------------------------------------------------------------- types
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;
export type Goal = typeof goals.$inferSelect;
export type Objective = typeof objectives.$inferSelect;
export type Kpi = typeof kpis.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type Sector = typeof sectors.$inferSelect;
export type Financial = typeof financials.$inferSelect;
export type Risk = typeof risks.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type Dependency = typeof dependencies.$inferSelect;
export type OrgUnitRow = typeof orgUnits.$inferSelect;

// ================================================================ capability development module (FR-L-01 … FR-L-14)
export const LEARNING_TRACKS = ["english", "postgraduate", "leadership", "short"] as const;
export type LearningTrack = (typeof LEARNING_TRACKS)[number];
export const CEFR = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export const learningProviders = pgTable("learning_providers", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  type: text("type").notNull(),                   // جامعة | مركز تدريب | منصة إلكترونية
  countryAr: text("country_ar").notNull(),
  accredited: boolean("accredited").notNull().default(true),
  costIndex: integer("cost_index").notNull().default(3), // 1-5
  qualityScore: real("quality_score").notNull(),  // 0-100
});

export const learningPrograms = pgTable("learning_programs", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  track: text("track").$type<LearningTrack>().notNull(),
  providerId: integer("provider_id").references(() => learningProviders.id),
  kind: text("kind").notNull(),                   // دورة | ورشة | شهادة احترافية | ماجستير | دكتوراه | برنامج قيادي | مسار لغوي
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  cost: real("cost").notNull(),                   // SAR thousands per participant
  capacity: integer("capacity").notNull(),
  status: text("status").notNull(),               // مخطط | جارٍ | مكتمل
  sectorId: integer("sector_id").references(() => sectors.id),
});

export const learningEnrollments = pgTable("learning_enrollments", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => learningPrograms.id),
  resourceId: integer("resource_id").notNull().references(() => resources.id), // beneficiary = HR record (FR-L-07)
  status: text("status").notNull(),               // مسجل | جارٍ | مكتمل | منسحب
  completion: real("completion").notNull().default(0),
  placementLevel: text("placement_level"),        // english: CEFR at placement test
  currentLevel: text("current_level"),            // english: current CEFR
  platform: text("platform"),                     // english: learning platform
  specializationAr: text("specialization_ar"),    // postgraduate
  reaction: real("reaction"), learning: real("learning"), behavior: real("behavior"), results: real("results"), // 4-level impact 0-100
}, (t) => [index("le_program_idx").on(t.programId), index("le_resource_idx").on(t.resourceId)]);

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  sectorId: integer("sector_id").notNull().references(() => sectors.id),
  importance: text("importance").notNull(),       // حرجة | عالية | متوسطة
  required: integer("required").notNull(),
  covered: integer("covered").notNull(),
  gapClosure: real("gap_closure").notNull(),      // % of the gap-closure plan achieved
});

export const successionPlans = pgTable("succession_plans", {
  id: serial("id").primaryKey(),
  positionAr: text("position_ar").notNull(),
  sectorId: integer("sector_id").notNull().references(() => sectors.id),
  incumbentAr: text("incumbent_ar").notNull(),
  successorResourceId: integer("successor_resource_id").references(() => resources.id),
  readiness: text("readiness").notNull(),         // جاهز الآن | خلال سنة | خلال سنتين
  readinessPct: real("readiness_pct").notNull(),
});

/** مؤشر جاهزية القدرات — FR-L-12: readiness = coverage × 60% + gap-closure × 40% */
export function skillReadiness(s: { required: number; covered: number; gapClosure: number }): number {
  const coverage = s.required ? Math.min(100, (s.covered / s.required) * 100) : 100;
  return Math.round((coverage * 0.6 + s.gapClosure * 0.4) * 10) / 10;
}

// ================================================================ dynamic workflow engine (shared by budgets, org structures, talent, innovation)
export const WORKFLOW_ACTIONS = ["approve", "reject", "return"] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];
export type WorkflowStage = { key: string; nameAr: string; ownerRole: Role; slaDays: number; requiresDecision?: boolean; decisionRole?: Role };

export const workflowDefinitions = pgTable("workflow_definitions", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),              // budget_transfer | org_request | recruit_contractor | …
  nameAr: text("name_ar").notNull(),
  entity: text("entity").notNull(),                 // table the workflow governs
  stages: json("stages").$type<WorkflowStage[]>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  version: integer("version").notNull().default(1),
});

export const workflowInstances = pgTable("workflow_instances", {
  id: serial("id").primaryKey(),
  definitionId: integer("definition_id").notNull().references(() => workflowDefinitions.id),
  entity: text("entity").notNull(),
  entityId: integer("entity_id").notNull(),
  currentStage: text("current_stage").notNull(),
  stageEnteredAt: timestamp("stage_entered_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"), // active | completed | rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [index("wf_inst_entity_idx").on(t.entity, t.entityId), index("wf_inst_stage_idx").on(t.currentStage, t.status)]);

export const workflowHistory = pgTable("workflow_history", {
  id: serial("id").primaryKey(),
  instanceId: integer("instance_id").notNull().references(() => workflowInstances.id),
  fromStage: text("from_stage"),
  toStage: text("to_stage"),
  action: text("action").notNull(),                 // start | approve | reject | return
  noteAr: text("note_ar"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("wf_hist_inst_idx").on(t.instanceId)]);

// ================================================================ budgets — الميزانية التشغيلية وميزانية المبادرات
export const BUDGET_CHAPTERS = ["الباب الأول — تعويضات العاملين", "الباب الثاني — السلع والخدمات", "الباب الثالث — النفقات الأخرى", "الباب الرابع — الأصول غير المالية"] as const;

export const costCenters = pgTable("cost_centers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  type: text("type").notNull(),                     // قطاع | إدارة | برنامج
  sectorId: integer("sector_id").references(() => sectors.id),
});

export const budgetLines = pgTable("budget_lines", {
  id: serial("id").primaryKey(),
  fiscalYear: integer("fiscal_year").notNull(),
  kind: text("kind").notNull(),                     // opex | initiative
  costCenterId: integer("cost_center_id").references(() => costCenters.id),
  projectId: integer("project_id").references(() => projects.id),
  chapter: text("chapter").notNull(),
  category: text("category").notNull(),
  approved: real("approved").notNull(),             // SAR millions
  committed: real("committed").notNull().default(0),
  actual: real("actual").notNull().default(0),
}, (t) => [index("budget_lines_fy_idx").on(t.fiscalYear, t.kind)]);

export const budgetMonths = pgTable("budget_months", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").notNull().references(() => budgetLines.id),
  month: integer("month").notNull(),                // 1-12
  planned: real("planned").notNull(),
  actual: real("actual"),                           // null = not yet closed
}, (t) => [index("budget_months_line_idx").on(t.lineId)]);

export const budgetTransfers = pgTable("budget_transfers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),            // TRF-001
  fromLineId: integer("from_line_id").notNull().references(() => budgetLines.id),
  toLineId: integer("to_line_id").notNull().references(() => budgetLines.id),
  amount: real("amount").notNull(),                 // SAR millions
  justificationAr: text("justification_ar").notNull(),
  requestedByUserId: integer("requested_by_user_id").references(() => users.id),
  status: text("status").notNull().default("قيد الإجراء"), // قيد الإجراء | معتمد | مرفوض
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const initiativeBudgetYears = pgTable("initiative_budget_years", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  fiscalYear: integer("fiscal_year").notNull(),
  requested: real("requested").notNull(),
  approved: real("approved"),                       // null = planning cycle not closed
  committed: real("committed").notNull().default(0),
  actual: real("actual").notNull().default(0),
  fundingSource: text("funding_source").notNull().default("الميزانية العامة"),
}, (t) => [index("iby_project_idx").on(t.projectId, t.fiscalYear)]);

// ================================================================ organizational structures — الهياكل التنظيمية
export const ORG_LEVELS = ["وزارة", "قطاع", "وكالة / إدارة عامة", "إدارة", "قسم"] as const;
export const ORG_REQUEST_TYPES = ["استحداث", "دمج", "إلغاء", "نقل تبعية", "تعديل مسمى", "تحديث دليل تنظيمي", "توصيف وظيفي"] as const;
export const ORG_AUTHORITIES = ["الرئيس التنفيذي", "الوزير", "لجنة الهياكل"] as const;

export const orgUnits = pgTable("org_units", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  level: text("level").notNull(),                   // one of ORG_LEVELS
  parentId: integer("parent_id"),
  headNameAr: text("head_name_ar"),
  positions: integer("positions").notNull().default(0),
  headcount: integer("headcount").notNull().default(0),
  sectorId: integer("sector_id").references(() => sectors.id),
  regionId: integer("region_id").references(() => regions.id),
  functionsAr: text("functions_ar"),
  status: text("status").notNull().default("معتمد"), // معتمد | مقترح | ملغى
  effectiveFrom: date("effective_from"),
  version: integer("version").notNull().default(1),
}, (t) => [index("org_units_parent_idx").on(t.parentId)]);

export const orgRequests = pgTable("org_requests", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),            // ORG-001
  requestingUnitId: integer("requesting_unit_id").notNull().references(() => orgUnits.id),
  type: text("type").notNull(),
  titleAr: text("title_ar").notNull(),
  descriptionAr: text("description_ar").notNull(),
  justificationAr: text("justification_ar").notNull(),
  impactHeadcount: integer("impact_headcount").notNull().default(0),
  impactBudget: real("impact_budget").notNull().default(0), // SAR millions / year
  duplicationNoteAr: text("duplication_note_ar"),
  relatedProjectId: integer("related_project_id").references(() => projects.id),
  decisionAuthority: text("decision_authority").notNull().default("الرئيس التنفيذي"),
  priority: text("priority").notNull().default("متوسطة"), // عاجلة | مرتفعة | متوسطة
  correspondenceRef: text("correspondence_ref"),
  receivedAt: date("received_at").notNull(),
  status: text("status").notNull().default("قيد الإجراء"), // قيد الإجراء | منفذ | مرفوض
  checklist: json("checklist").$type<{ item: string; done: boolean }[]>().notNull().default([]),
});

export const orgRequestUnits = pgTable("org_request_units", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => orgRequests.id),
  unitId: integer("unit_id").references(() => orgUnits.id),   // existing unit affected (null for a brand-new unit)
  action: text("action").notNull(),                 // استحداث | تعديل مسمى | نقل تبعية | إلغاء | تعديل توصيف
  proposedNameAr: text("proposed_name_ar"),
  proposedParentId: integer("proposed_parent_id"),
  proposedLevel: text("proposed_level"),
  proposedPositions: integer("proposed_positions"),
}, (t) => [index("oru_request_idx").on(t.requestId)]);

// ================================================================ talent acquisition — مسار الاستقطاب
export const ENGAGEMENT_TYPES = ["متعاقد", "مكلّف", "معار"] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];
export const ENGAGEMENT_WORKFLOW: Record<EngagementType, string> = { "متعاقد": "recruit_contractor", "مكلّف": "recruit_assigned", "معار": "recruit_seconded" };
export const BANDS = ["قيادي", "خبير", "أول", "متخصص"] as const;
export const CLEARANCE = ["لم يبدأ", "قيد الفحص", "مجاز", "غير مجاز"] as const;

export const requisitions = pgTable("requisitions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),            // REQ-001
  roleAr: text("role_ar").notNull(),
  sectorId: integer("sector_id").notNull().references(() => sectors.id),
  projectId: integer("project_id").references(() => projects.id),
  engagementType: text("engagement_type").$type<EngagementType>().notNull(),
  band: text("band").notNull(),
  count: integer("count").notNull().default(1),
  filled: integer("filled").notNull().default(0),
  priority: text("priority").notNull().default("متوسطة"), // عاجلة | مرتفعة | متوسطة
  isSenior: boolean("is_senior").notNull().default(false), // senior roles: names visible to the CEO
  requestedAt: date("requested_at").notNull(),
  targetStart: date("target_start").notNull(),
  status: text("status").notNull().default("مفتوح"),  // مفتوح | مكتمل | ملغى
  justificationAr: text("justification_ar"),
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),            // CND-001
  nameAr: text("name_ar").notNull(),
  requisitionId: integer("requisition_id").notNull().references(() => requisitions.id),
  engagementType: text("engagement_type").$type<EngagementType>().notNull(),
  sourceAr: text("source_ar"),                      // vendor / nominating sector / lending entity
  currentRoleAr: text("current_role_ar"),
  clearanceStatus: text("clearance_status").notNull().default("لم يبدأ"),
  monthlyRate: real("monthly_rate"),                // contractors: SAR thousands / month
  secondmentMonths: integer("secondment_months"),   // seconded
  referenceAr: text("reference_ar"),                // assignment letter / secondment decision / contract no.
  onboardedResourceId: integer("onboarded_resource_id").references(() => resources.id),
  onboardedAt: date("onboarded_at"),
  status: text("status").notNull().default("قيد الإجراء"), // قيد الإجراء | مباشر | مستبعد
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("candidates_req_idx").on(t.requisitionId)]);
