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
import { relations } from "drizzle-orm";

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
