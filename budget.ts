/**
 * Budget & workflow synthetic data — fiscal year 2026 (Jan–Dec), actuals closed through August.
 * Operating budget ≈ 6.4B SAR across sectors, support departments and the programme; initiatives budget = the portfolio (32.7B).
 */
import { rng } from "./generator";
import type { WorkflowStage } from "../../shared/schema";

const R = rng(20260908);
export const CLOSED_MONTH = 8; // Jan–Aug closed as of 1 Sept 2026

const stage = (key: string, nameAr: string, ownerRole: WorkflowStage["ownerRole"], slaDays: number, decision?: WorkflowStage["decisionRole"]): WorkflowStage =>
  decision ? { key, nameAr, ownerRole, slaDays, requiresDecision: true, decisionRole: decision } : { key, nameAr, ownerRole, slaDays };

/** Definitions for all four processes — later sprints only add screens, the engine already knows the flows. */
export const WORKFLOW_DEFINITIONS = [
  { key: "budget_transfer", nameAr: "مناقلة ميزانية", entity: "budget_transfers", stages: [
    stage("submitted", "تسجيل الطلب", "data_manager", 2), stage("finance_review", "المراجعة المالية", "epmo", 5), stage("ceo_approval", "اعتماد الرئيس التنفيذي", "ceo", 5, "ceo"), stage("execute", "التنفيذ في Odoo", "data_manager", 3) ] },
  { key: "org_request", nameAr: "طلب هيكل تنظيمي", entity: "org_requests", stages: [
    stage("registered", "تسجيل الطلب", "data_manager", 2), stage("completeness", "التحقق من الاكتمال", "data_manager", 3), stage("study", "الدراسة التنظيمية وتحليل الأثر", "epmo", 10), stage("committee", "لجنة الهياكل", "epmo", 7), stage("ceo_approval", "اعتماد الرئيس التنفيذي", "ceo", 5, "ceo"), stage("implement", "التنفيذ وتحديث الأنظمة", "data_manager", 10) ] },
  { key: "recruit_contractor", nameAr: "استقطاب — متعاقد", entity: "candidates", stages: [
    stage("sourcing", "الفرز الأولي", "data_manager", 7), stage("interview", "المقابلة والتقييم", "portfolio_manager", 7), stage("offer", "العرض والتعاقد", "epmo", 5), stage("clearance", "الفحص الأمني", "data_manager", 14), stage("onboarding", "المباشرة", "data_manager", 5) ] },
  { key: "recruit_assigned", nameAr: "استقطاب — مكلّف", entity: "candidates", stages: [
    stage("nomination", "ترشيح القطاع", "portfolio_manager", 5), stage("approval", "الموافقة التنفيذية", "ceo", 5, "ceo"), stage("assignment", "خطاب التكليف", "data_manager", 5), stage("onboarding", "المباشرة", "data_manager", 5) ] },
  { key: "recruit_seconded", nameAr: "استقطاب — معار", entity: "candidates", stages: [
    stage("request", "مخاطبة الجهة", "data_manager", 7), stage("entity_approval", "موافقة الجهة", "epmo", 14), stage("decision", "قرار الإعارة", "ceo", 5, "ceo"), stage("onboarding", "المباشرة", "data_manager", 5) ] },
  { key: "innovation_idea", nameAr: "فكرة ابتكارية", entity: "innovation_ideas", stages: [
    stage("submitted", "فكرة مقدّمة", "data_manager", 5), stage("evaluated", "التقييم", "epmo", 10), stage("prototype", "نموذج أولي", "portfolio_manager", 30), stage("pilot", "تجربة", "portfolio_manager", 60), stage("scale", "قرار التوسع", "ceo", 10, "ceo") ] },
];

const OPEX_CATEGORIES = [
  ["الباب الأول — تعويضات العاملين", "الرواتب والبدلات", 0.55, "flat"],
  ["الباب الثاني — السلع والخدمات", "عقود التشغيل والصيانة", 0.22, "scurve"],
  ["الباب الثاني — السلع والخدمات", "الخدمات الاستشارية والتدريب", 0.13, "scurve"],
  ["الباب الثالث — النفقات الأخرى", "نفقات أخرى", 0.10, "backloaded"],
] as const;

function monthlyPlan(total: number, profile: string): number[] {
  const w = profile === "flat" ? Array(12).fill(1) : profile === "scurve" ? [0.4, 0.6, 0.8, 1, 1.2, 1.3, 1.3, 1.2, 1, 0.8, 0.7, 0.7] : [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.0];
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => Math.round((total * x) / sum * 10) / 10);
}

export function generateBudget(sectors: { id: number; nameAr: string; code: string }[], projects: { id: number; code: string; budget: number; committed: number; actual: number; status: string }[]) {
  const costCenters = [
    ...sectors.map((sct) => ({ code: `CC-${sct.code.replace("SEC-", "")}`, nameAr: sct.nameAr, type: "قطاع", sectorId: sct.id })),
    { code: "CC-PRG", nameAr: "برنامج تطوير وزارة الداخلية", type: "برنامج", sectorId: null as number | null },
    { code: "CC-IT", nameAr: "الإدارة العامة لتقنية المعلومات", type: "إدارة", sectorId: null },
    { code: "CC-HR", nameAr: "الإدارة العامة للموارد البشرية", type: "إدارة", sectorId: null },
    { code: "CC-FIN", nameAr: "الإدارة العامة للشؤون المالية", type: "إدارة", sectorId: null },
  ];
  // spending behaviour per cost centre: 0.85 = under-spending, 1.0 on plan, 1.12 over
  const behaviour = costCenters.map((_, i) => [0.72, 1.0, 1.05, 0.88, 1.12, 0.95, 1.0, 0.8, 1.08, 0.97, 1.0, 0.9, 1.03, 0.78][i % 14]);
  const sizes = costCenters.map((c) => (c.type === "قطاع" ? R.int(320, 780) : c.type === "برنامج" ? 240 : R.int(140, 260)));

  const lines: any[] = []; const months: any[] = [];
  costCenters.forEach((cc, ci) => {
    OPEX_CATEGORIES.forEach(([chapter, category, share, profile]) => {
      const approved = Math.round(sizes[ci] * share);
      const plan = monthlyPlan(approved, profile);
      const b = behaviour[ci] * (0.95 + R.next() * 0.1);
      const actuals = plan.map((p, m) => (m < CLOSED_MONTH ? Math.round(p * b * (0.9 + R.next() * 0.2) * 10) / 10 : null));
      const actual = Math.round(actuals.reduce((a: number, x) => a + (x ?? 0), 0) * 10) / 10;
      const committed = Math.round(Math.min(approved, actual + plan.slice(CLOSED_MONTH, CLOSED_MONTH + 2).reduce((a, x) => a + x, 0) * (0.6 + R.next() * 0.5)) * 10) / 10;
      lines.push({ fiscalYear: 2026, kind: "opex", ccCode: cc.code, projectId: null, chapter, category, approved, committed, actual, _plan: plan, _actuals: actuals });
    });
  });
  // initiative lines mirror the portfolio financials (chapter 4), one line per initiative
  projects.forEach((p) => lines.push({ fiscalYear: 2026, kind: "initiative", ccCode: null, projectId: p.id, chapter: "الباب الرابع — الأصول غير المالية", category: "مشاريع ومبادرات", approved: p.budget, committed: p.committed, actual: p.actual, _plan: monthlyPlan(p.budget, "scurve"), _actuals: null }));

  const initiativeYears = projects.flatMap((p) => {
    const req27 = Math.round(p.budget * (0.35 + R.next() * 0.35));
    const pending = R.next() < 0.3;
    return [
      { projectId: p.id, fiscalYear: 2025, requested: Math.round(p.budget * 0.4), approved: Math.round(p.budget * 0.36), committed: Math.round(p.budget * 0.36), actual: Math.round(p.budget * 0.34), fundingSource: "الميزانية العامة" },
      { projectId: p.id, fiscalYear: 2026, requested: Math.round(p.budget * 1.08), approved: p.budget, committed: p.committed, actual: p.actual, fundingSource: R.pick(["الميزانية العامة", "الميزانية العامة", "تمويل البرامج والمبادرات"]) },
      { projectId: p.id, fiscalYear: 2027, requested: req27, approved: pending ? null : Math.round(req27 * (0.6 + R.next() * 0.4)), committed: 0, actual: 0, fundingSource: "الميزانية العامة" },
    ];
  });

  const transfers = [
    { code: "TRF-001", from: ["CC-TR", "الخدمات الاستشارية والتدريب"], to: ["CC-TR", "عقود التشغيل والصيانة"], amount: 12, justificationAr: "تغطية عقد صيانة أنظمة المراقبة المرورية بعد تأخر برامج التدريب", stageIndex: 2, status: "قيد الإجراء" },
    { code: "TRF-002", from: ["CC-PS", "نفقات أخرى"], to: ["CC-PS", "عقود التشغيل والمحافظة".replace("المحافظة", "الصيانة")], amount: 8.5, justificationAr: "دعم تشغيل مركز القيادة والسيطرة خلال موسم الحج", stageIndex: 1, status: "قيد الإجراء" },
    { code: "TRF-003", from: ["CC-HR", "الرواتب والبدلات"], to: ["CC-HR", "الخدمات الاستشارية والتدريب"], amount: 4, justificationAr: "برنامج تأهيل القيادات الوسطى — دفعة إضافية", stageIndex: 0, status: "قيد الإجراء" },
    { code: "TRF-004", from: ["CC-IT", "نفقات أخرى"], to: ["CC-IT", "عقود التشغيل والصيانة"], amount: 15, justificationAr: "تجديد تراخيص أنظمة الحماية السيبرانية", stageIndex: 3, status: "معتمد", completed: true },
    { code: "TRF-005", from: ["CC-CD", "الرواتب والبدلات"], to: ["CC-CD", "نفقات أخرى"], amount: 6, justificationAr: "نفقات طارئة لمعدات الإطفاء", stageIndex: 1, status: "مرفوض", rejected: true },
  ];
  return { costCenters, lines, initiativeYears, transfers };
}
