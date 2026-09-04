/**
 * Declarative registry for the data administration console (FR-D-01 … FR-D-08).
 * Each column carries: type, owning source (FR-D-06), sensitivity (FR-D-05), FK target, options.
 * Everything else — listing, validation, editing rules, CSV, audit — is generic and reads this.
 */
import * as s from "../../shared/schema";
import { FIELD_SOURCES, SENSITIVE_FIELDS, type FieldSource } from "../../shared/fieldSources";

export type ColType = "text" | "number" | "date" | "boolean" | "select" | "fk";
export type Column = { key: string; labelAr: string; type: ColType; options?: readonly string[]; fk?: string; required?: boolean; readOnly?: boolean; width?: number };
export type Entity = { key: string; table: any; tableName: string; labelAr: string; labelEn: string; group: string; sourceAr: string; labelField: string; columns: Column[]; archivable?: boolean; module?: "core" | "budget" | "org" | "talent" | "innovation" };

const RAG = s.RAG;
const col = (key: string, labelAr: string, type: ColType, extra: Partial<Column> = {}): Column => ({ key, labelAr, type, ...extra });

export const ENTITIES: Entity[] = [
  { key: "goals", table: s.goals, tableName: "goals", labelAr: "الغايات والأهداف", labelEn: "Goals", group: "الاستراتيجية", sourceAr: "إدخال يدوي", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "الغاية", "text", { required: true }), col("nameEn", "Goal", "text"), col("targetImpact", "الأثر المستهدف %", "number", { required: true }),
    col("achievedImpact", "الأثر المحقق %", "number", { readOnly: true }), col("investment", "الاستثمار (مليون)", "number", { readOnly: true }), col("sortOrder", "الترتيب", "number") ] },
  { key: "objectives", table: s.objectives, tableName: "objectives", labelAr: "الأهداف الفرعية", labelEn: "Objectives", group: "الاستراتيجية", sourceAr: "إدخال يدوي", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "الهدف", "text", { required: true }), col("goalId", "الغاية", "fk", { fk: "goals", required: true }) ] },
  { key: "kpis", table: s.kpis, tableName: "kpis", labelAr: "مؤشرات الأداء", labelEn: "KPIs", group: "الاستراتيجية", sourceAr: "إدخال يدوي / محتسب", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "المؤشر", "text", { required: true }), col("nameEn", "KPI", "text"), col("goalId", "الغاية", "fk", { fk: "goals", required: true }), col("ownerSectorId", "القطاع المالك", "fk", { fk: "sectors" }),
    col("unit", "الوحدة", "text"), col("baseline", "خط الأساس", "number", { required: true }), col("target", "المستهدف", "number", { required: true }), col("current", "القيمة الحالية", "number"),
    col("lowerIsBetter", "الأقل أفضل", "boolean"), col("status", "الحالة", "select", { options: RAG }), col("rootCauseAr", "أسباب الانحراف", "text") ] },
  { key: "portfolios", table: s.portfolios, tableName: "portfolios", labelAr: "المحافظ", labelEn: "Portfolios", group: "المحافظ والمبادرات", sourceAr: "إدخال يدوي", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "المحفظة", "text", { required: true }), col("nameEn", "Portfolio", "text"), col("managerName", "مدير المحفظة", "text", { required: true }), col("targetImpact", "الأثر المستهدف %", "number"), col("status", "الحالة", "select", { options: RAG }) ] },
  { key: "programs", table: s.programs, tableName: "programs", labelAr: "البرامج", labelEn: "Programs", group: "المحافظ والمبادرات", sourceAr: "Microsoft Project Server", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "البرنامج", "text", { required: true }), col("portfolioId", "المحفظة", "fk", { fk: "portfolios", required: true }), col("managerName", "مدير البرنامج", "text", { required: true }),
    col("scheduleStatus", "الجدول", "select", { options: RAG }), col("financialStatus", "المالي", "select", { options: RAG }), col("status", "الحالة", "select", { options: RAG }) ] },
  { key: "projects", table: s.projects, tableName: "projects", labelAr: "المبادرات والمشاريع", labelEn: "Initiatives & Projects", group: "المحافظ والمبادرات", sourceAr: "Microsoft Project Server", labelField: "nameAr", archivable: true, columns: [
    col("code", "معرف المبادرة", "text", { required: true }), col("nameAr", "اسم المبادرة", "text", { required: true }), col("programId", "البرنامج", "fk", { fk: "programs", required: true }), col("portfolioId", "المحفظة", "fk", { fk: "portfolios", required: true }),
    col("sectorId", "القطاع المسؤول", "fk", { fk: "sectors", required: true }), col("goalId", "الغاية", "fk", { fk: "goals", required: true }), col("managerName", "مدير المشروع", "text", { required: true }), col("phase", "المرحلة", "select", { options: s.PHASES }),
    col("progress", "نسبة الإنجاز", "number", { required: true }), col("scheduleStatus", "الجدول", "select", { options: RAG }), col("financialStatus", "المالي", "select", { options: RAG }), col("status", "الحالة", "select", { options: RAG }),
    col("impactTarget", "الأثر المستهدف %", "number"), col("impactAchieved", "الأثر المحقق %", "number"), col("impactContribution", "المساهمة", "select", { options: ["عالية", "متوسطة", "منخفضة"] }),
    col("startDate", "تاريخ البدء", "date", { required: true }), col("endDate", "تاريخ الانتهاء", "date", { required: true }), col("isArchived", "مؤرشف", "boolean", { readOnly: true }) ] },
  { key: "dependencies", table: s.dependencies, tableName: "dependencies", labelAr: "الاعتماديات", labelEn: "Dependencies", group: "المحافظ والمبادرات", sourceAr: "إدخال يدوي", labelField: "noteAr", columns: [
    col("fromProjectId", "المشروع المعتمِد", "fk", { fk: "projects", required: true }), col("toProjectId", "المشروع المعتمَد عليه", "fk", { fk: "projects", required: true }),
    col("type", "النوع", "select", { options: ["بنية تحتية", "تعاقدي", "موارد", "بيانات", "مخرج"] }), col("status", "الحالة", "select", { options: RAG }), col("noteAr", "الوصف", "text", { required: true }) ] },
  { key: "regions", table: s.regions, tableName: "regions", labelAr: "إدارة المناطق", labelEn: "Regions", group: "التوزيع الجغرافي", sourceAr: "بيانات مرجعية", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "المنطقة", "text", { required: true }), col("nameEn", "Region", "text"), col("lat", "خط العرض", "number"), col("lng", "خط الطول", "number") ] },
  { key: "sectors", table: s.sectors, tableName: "sectors", labelAr: "إدارة القطاعات", labelEn: "Sectors", group: "التوزيع الجغرافي", sourceAr: "بيانات مرجعية", labelField: "nameAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "القطاع", "text", { required: true }), col("nameEn", "Sector", "text") ] },
  { key: "resources", table: s.resources, tableName: "resources", labelAr: "الموارد", labelEn: "Resources", group: "التنفيذ", sourceAr: "Odoo HR", labelField: "nameAr", columns: [
    col("nameAr", "المورد", "text", { required: true }), col("roleAr", "الدور", "text"), col("departmentAr", "الإدارة", "text"), col("capacityHours", "الطاقة (ساعة)", "number"), col("leaveHours", "إجازات", "number"), col("trainingHours", "تدريب", "number"), col("hourlyCost", "تكلفة الساعة", "number") ] },
  { key: "financials", table: s.financials, tableName: "financials", labelAr: "البيانات المالية", labelEn: "Financials", group: "التنفيذ", sourceAr: "Odoo ERP", labelField: "projectId", columns: [
    col("projectId", "المشروع", "fk", { fk: "projects", required: true }), col("budget", "الميزانية المعتمدة", "number", { required: true }), col("committed", "الملتزم به", "number"), col("actual", "المصروف الفعلي", "number"), col("eac", "التوقع عند الإكمال", "number"), col("fiscalYear", "السنة المالية", "number") ] },
  { key: "impact", table: s.projects, tableName: "projects", labelAr: "إدارة الأثر", labelEn: "Impact", group: "التنفيذ", sourceAr: "يدوي / محتسب", labelField: "nameAr", columns: [
    col("code", "معرف المبادرة", "text", { readOnly: true }), col("nameAr", "المبادرة", "text", { readOnly: true }), col("impactTarget", "المساهمة المستهدفة %", "number", { required: true }), col("impactAchieved", "المساهمة المتحققة %", "number"), col("impactContribution", "مستوى المساهمة", "select", { options: ["عالية", "متوسطة", "منخفضة"] }) ] },
  { key: "risks", table: s.risks, tableName: "risks", labelAr: "المخاطر", labelEn: "Risks", group: "المخاطر", sourceAr: "Project Server / يدوي", labelField: "titleAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("projectId", "المبادرة", "fk", { fk: "projects", required: true }), col("titleAr", "المخاطرة", "text", { required: true }), col("category", "التصنيف", "select", { options: s.RISK_CATEGORIES }),
    col("probability", "الاحتمالية (1-5)", "number", { required: true }), col("impact", "الأثر (1-5)", "number", { required: true }), col("response", "الاستجابة", "select", { options: ["تجنب", "قبول", "نقل", "تخفيف"] }),
    col("status", "الحالة", "select", { options: ["مفتوح", "قيد المعالجة", "تحت المراقبة", "مغلق"] }), col("ownerAr", "المالك", "text") ] },
  { key: "issues", table: s.issues, tableName: "issues", labelAr: "المشكلات", labelEn: "Issues", group: "المخاطر", sourceAr: "إدخال يدوي", labelField: "titleAr", columns: [
    col("projectId", "المبادرة", "fk", { fk: "projects", required: true }), col("titleAr", "المشكلة", "text", { required: true }), col("severity", "الخطورة", "select", { options: ["حرجة", "مرتفعة", "متوسطة"] }), col("status", "الحالة", "select", { options: ["مفتوحة", "قيد المعالجة", "مغلقة"] }), col("openedDays", "مفتوحة منذ (يوم)", "number") ] },
  { key: "decisions", table: s.decisions, tableName: "decisions", labelAr: "القرارات التنفيذية", labelEn: "Decisions", group: "القرارات التنفيذية", sourceAr: "إدخال يدوي", labelField: "titleAr", columns: [
    col("code", "الرمز", "text", { required: true }), col("titleAr", "القرار", "text", { required: true }), col("type", "النوع", "select", { options: s.DECISION_TYPES }), col("priority", "الأولوية", "select", { options: ["عاجلة", "مرتفعة", "متوسطة"] }),
    col("amount", "المبلغ (مليون)", "number"), col("ownerAr", "الجهة المالكة", "text", { required: true }), col("projectId", "المبادرة", "fk", { fk: "projects" }), col("dueDate", "الموعد", "date", { required: true }),
    col("status", "الحالة", "select", { options: ["معلق", "معتمد", "مرفوض", "مؤجل"] }), col("impactNoteAr", "الأثر المتوقع", "text") ] },
  // ---- budget module
  { key: "costCenters", table: s.costCenters, tableName: "cost_centers", labelAr: "مراكز التكلفة", labelEn: "Cost Centers", group: "الميزانية", sourceAr: "إدخال يدوي", labelField: "nameAr", module: "budget", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "مركز التكلفة", "text", { required: true }), col("type", "النوع", "select", { options: ["قطاع", "إدارة", "برنامج"] }), col("sectorId", "القطاع", "fk", { fk: "sectors" }) ] },
  { key: "budgetLines", table: s.budgetLines, tableName: "budget_lines", labelAr: "بنود الميزانية", labelEn: "Budget Lines", group: "الميزانية", sourceAr: "وزارة المالية / Odoo ERP", labelField: "category", module: "budget", columns: [
    col("fiscalYear", "السنة المالية", "number", { required: true }), col("kind", "النوع", "select", { options: ["opex", "initiative"], required: true }), col("costCenterId", "مركز التكلفة", "fk", { fk: "costCenters" }), col("projectId", "المبادرة", "fk", { fk: "projects" }),
    col("chapter", "الباب", "select", { options: s.BUDGET_CHAPTERS, required: true }), col("category", "البند", "text", { required: true }), col("approved", "المعتمد (مليون)", "number", { required: true }), col("committed", "الملتزم به (مليون)", "number"), col("actual", "المنصرف (مليون)", "number") ] },
  { key: "initiativeBudgetYears", table: s.initiativeBudgetYears, tableName: "initiative_budget_years", labelAr: "ميزانية المبادرات حسب السنة", labelEn: "Initiative Budget Years", group: "الميزانية", sourceAr: "وزارة المالية / Odoo ERP", labelField: "fiscalYear", module: "budget", columns: [
    col("projectId", "المبادرة", "fk", { fk: "projects", required: true }), col("fiscalYear", "السنة المالية", "number", { required: true }), col("requested", "المطلوب (مليون)", "number", { required: true }), col("approved", "المعتمد (مليون)", "number"), col("committed", "الملتزم به", "number"), col("actual", "المنصرف", "number"),
    col("fundingSource", "مصدر التمويل", "select", { options: ["الميزانية العامة", "تمويل البرامج والمبادرات", "تمويل ذاتي"] }) ] },
  // ---- organizational structures
  { key: "orgUnits", table: s.orgUnits, tableName: "org_units", labelAr: "الوحدات التنظيمية", labelEn: "Org Units", group: "الهياكل التنظيمية", sourceAr: "الدليل التنظيمي / Odoo HR", labelField: "nameAr", module: "org", columns: [
    col("code", "الرمز", "text", { required: true }), col("nameAr", "الوحدة", "text", { required: true }), col("level", "المستوى", "select", { options: s.ORG_LEVELS, required: true }), col("parentId", "الوحدة الأم", "fk", { fk: "orgUnits" }), col("headNameAr", "الرئيس", "text"),
    col("positions", "الوظائف المعتمدة", "number"), col("headcount", "المشغولة", "number"), col("sectorId", "القطاع", "fk", { fk: "sectors" }), col("functionsAr", "المهام", "text"), col("status", "الحالة", "select", { options: ["معتمد", "مقترح", "ملغى"] }), col("effectiveFrom", "سارٍ من", "date") ] },
  { key: "orgRequests", table: s.orgRequests, tableName: "org_requests", labelAr: "طلبات الهياكل", labelEn: "Structure Requests", group: "الهياكل التنظيمية", sourceAr: "مسار عمل داخل المنصة", labelField: "titleAr", module: "org", columns: [
    col("code", "الرمز", "text", { readOnly: true }), col("titleAr", "الطلب", "text", { required: true }), col("type", "النوع", "select", { options: s.ORG_REQUEST_TYPES }), col("requestingUnitId", "الجهة الطالبة", "fk", { fk: "orgUnits", required: true }), col("priority", "الأولوية", "select", { options: ["عاجلة", "مرتفعة", "متوسطة"] }),
    col("decisionAuthority", "جهة القرار", "select", { options: s.ORG_AUTHORITIES }), col("impactHeadcount", "أثر الوظائف", "number"), col("impactBudget", "الأثر المالي (مليون/سنة)", "number"), col("relatedProjectId", "المبادرة المرتبطة", "fk", { fk: "projects" }), col("correspondenceRef", "رقم الوارد", "text"), col("receivedAt", "تاريخ الورود", "date"), col("status", "الحالة", "select", { options: ["قيد الإجراء", "منفذ", "مرفوض"], readOnly: true }) ] },
  { key: "budgetTransfers", table: s.budgetTransfers, tableName: "budget_transfers", labelAr: "المناقلات", labelEn: "Budget Transfers", group: "الميزانية", sourceAr: "مسار عمل داخل المنصة", labelField: "code", module: "budget", columns: [
    col("code", "الرمز", "text", { readOnly: true }), col("fromLineId", "من البند", "fk", { fk: "budgetLines", readOnly: true }), col("toLineId", "إلى البند", "fk", { fk: "budgetLines", readOnly: true }), col("amount", "المبلغ (مليون)", "number", { readOnly: true }), col("justificationAr", "المبرر", "text"), col("status", "الحالة", "select", { options: ["قيد الإجراء", "معتمد", "مرفوض"], readOnly: true }) ] },
];

export const ENTITY_MAP = Object.fromEntries(ENTITIES.map((e) => [e.key, e]));

export function fieldSource(e: Entity, key: string): FieldSource {
  return FIELD_SOURCES[e.tableName]?.[key] ?? "manual";
}
export function isSensitive(e: Entity, key: string): boolean {
  return (SENSITIVE_FIELDS[e.tableName] ?? []).includes(key);
}

/** Validate & coerce one field value according to its column metadata. Returns [value] or throws a message. */
export function coerce(c: Column, raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) { if (c.required) throw new Error(`الحقل «${c.labelAr}» مطلوب`); return null; }
  switch (c.type) {
    case "number": { const n = Number(raw); if (!Number.isFinite(n)) throw new Error(`«${c.labelAr}» يجب أن يكون رقماً`); if (/%|نسبة/.test(c.labelAr) && (n < 0 || n > 100)) throw new Error(`«${c.labelAr}» يجب أن يكون بين 0 و 100`); if (/1-5/.test(c.labelAr) && (n < 1 || n > 5)) throw new Error(`«${c.labelAr}» يجب أن يكون بين 1 و 5`); return n; }
    case "date": { const v = String(raw).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) throw new Error(`«${c.labelAr}» تاريخ غير صحيح (YYYY-MM-DD)`); return v; }
    case "boolean": return raw === true || raw === "true" || raw === "1" || raw === "نعم";
    case "select": { const v = String(raw); if (c.options && !c.options.includes(v)) throw new Error(`«${c.labelAr}» قيمة غير مسموحة: ${v}`); return v; }
    case "fk": { const n = Number(raw); if (!Number.isInteger(n)) throw new Error(`«${c.labelAr}» مرجع غير صحيح`); return n; }
    default: return String(raw).trim();
  }
}
