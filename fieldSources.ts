/**
 * Field ownership — which system owns each field (FR-D-06).
 * Editing a field owned by another system requires the data:override permission.
 */
export type FieldSource = "project_server" | "odoo" | "manual" | "computed";

export const SOURCE_LABELS: Record<FieldSource, string> = {
  project_server: "Microsoft Project Server",
  odoo: "Odoo ERP",
  manual: "إدخال يدوي",
  computed: "محتسب آلياً",
};

export const FIELD_SOURCES: Record<string, Record<string, FieldSource>> = {
  projects: {
    nameAr: "project_server", managerName: "project_server", phase: "project_server",
    progress: "project_server", startDate: "project_server", endDate: "project_server",
    scheduleStatus: "computed", financialStatus: "computed", status: "computed",
    impactTarget: "manual", impactAchieved: "computed", priorityScore: "computed",
    sectorId: "manual", goalId: "manual", programId: "project_server",
  },
  financials: { budget: "odoo", committed: "odoo", actual: "odoo", eac: "computed" },
  resources: { capacityHours: "odoo", leaveHours: "odoo", trainingHours: "odoo", hourlyCost: "odoo" },
  resourceAssignments: { hours: "project_server" },
  kpis: { baseline: "manual", target: "manual", current: "computed", status: "computed" },
  goals: { targetImpact: "manual", achievedImpact: "computed", investment: "computed" },
  portfolios: { managerName: "manual", status: "computed" },
  programs: { managerName: "project_server", status: "computed" },
  risks: { probability: "project_server", impact: "project_server", response: "manual", status: "manual" },
  decisions: { titleAr: "manual", amount: "manual", status: "manual" },
  cost_centers: { code: "manual", nameAr: "manual", type: "manual", sectorId: "manual" },
  budget_lines: { approved: "manual", committed: "odoo", actual: "odoo", chapter: "manual", category: "manual" },
  initiative_budget_years: { requested: "manual", approved: "manual", committed: "odoo", actual: "odoo", fundingSource: "manual" },
  budget_transfers: { amount: "manual", justificationAr: "manual", status: "computed" },
  org_units: { nameAr: "manual", level: "manual", parentId: "manual", headNameAr: "odoo", positions: "odoo", headcount: "odoo", status: "manual" },
  org_requests: { titleAr: "manual", type: "manual", priority: "manual", status: "computed" },
};

/** Fields that require an approval workflow before publishing (FR-D-05). */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  goals: ["targetImpact"],
  kpis: ["baseline", "target"],
  projects: ["impactTarget", "goalId"],
  financials: ["budget"],
  decisions: ["status"],
  budget_lines: ["approved"],
  initiative_budget_years: ["approved"],
  org_units: ["parentId", "status", "level"],
};
