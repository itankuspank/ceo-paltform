/**
 * مولّد البيانات المؤسسية — deterministic (same seed → same world on every run).
 * Figures mirror the approved prototype: 32.7B SAR, 8 portfolios, 25 programs, 100 initiatives,
 * 15 KPIs, 13 regions, 10 sectors, 42 risks, 7 executive decisions, 14 dependencies, 220 resources.
 */
import type { Rag } from "../../shared/schema";

// ---------------------------------------------------------------- PRNG (mulberry32)
export function rng(seed = 20260901) {
  let a = seed >>> 0;
  const next = () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    round: (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d,
  };
}
const R = rng();
const rag = (p: number): Rag => (p >= 70 ? "on_track" : p >= 50 ? "at_risk" : "off_track");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

// ---------------------------------------------------------------- reference pools
export const GOALS = [
  { code: "G1", nameAr: "تعزيز الأمن الوطني", nameEn: "National Security", targetImpact: 100, achievedImpact: 88, investment: 9800, sortOrder: 1 },
  { code: "G2", nameAr: "رفع مستوى السلامة العامة", nameEn: "Public Safety", targetImpact: 100, achievedImpact: 79, investment: 6400, sortOrder: 2 },
  { code: "G3", nameAr: "الارتقاء بجودة الخدمات", nameEn: "Service Quality", targetImpact: 100, achievedImpact: 85, investment: 7300, sortOrder: 3 },
  { code: "G4", nameAr: "رفع الكفاءة التشغيلية", nameEn: "Operational Efficiency", targetImpact: 100, achievedImpact: 76, investment: 5500, sortOrder: 4 },
  { code: "G5", nameAr: "تعزيز الجاهزية المستقبلية", nameEn: "Future Readiness", targetImpact: 100, achievedImpact: 74, investment: 3700, sortOrder: 5 },
];

export const OBJECTIVES: Record<string, string[]> = {
  G1: ["تعزيز أمن الحدود", "رفع جاهزية القيادة والسيطرة", "تطوير الاستدلال الجنائي الرقمي"],
  G2: ["خفض الحوادث المرورية", "رفع كفاءة الاستجابة للطوارئ", "سلامة التجمعات الكبرى"],
  G3: ["تحسين تجربة المستفيد", "الوصول الرقمي للخدمات", "تقليص زمن إنجاز المعاملات"],
  G4: ["أتمتة العمليات الإدارية", "رفع كفاءة الإنفاق", "تحسين إنتاجية الموارد"],
  G5: ["تبني الذكاء الاصطناعي", "بناء الكفاءات الرقمية", "تعزيز الجاهزية السيبرانية"],
};

export const SECTORS = [
  { code: "SEC-PS", nameAr: "الأمن العام", nameEn: "Public Security" },
  { code: "SEC-CD", nameAr: "الدفاع المدني", nameEn: "Civil Defense" },
  { code: "SEC-911", nameAr: "مركز العمليات الأمنية الموحد 911", nameEn: "Security Operations 911" },
  { code: "SEC-PP", nameAr: "الجوازات", nameEn: "Passports" },
  { code: "SEC-CS", nameAr: "الأحوال المدنية", nameEn: "Civil Status" },
  { code: "SEC-DW", nameAr: "ديوان وزارة الداخلية", nameEn: "MOI Diwan" },
  { code: "SEC-TR", nameAr: "المرور", nameEn: "Traffic" },
  { code: "SEC-BG", nameAr: "حرس الحدود", nameEn: "Border Guard" },
  { code: "SEC-RS", nameAr: "أمن الطرق", nameEn: "Road Security" },
  { code: "SEC-EM", nameAr: "الإمارات والمناطق", nameEn: "Emirates & Provinces" },
];

export const REGIONS = [
  { code: "RUH", nameAr: "منطقة الرياض", nameEn: "Riyadh", lat: 24.71, lng: 46.68 },
  { code: "MKK", nameAr: "منطقة مكة المكرمة", nameEn: "Makkah", lat: 21.42, lng: 39.83 },
  { code: "MDN", nameAr: "منطقة المدينة المنورة", nameEn: "Madinah", lat: 24.47, lng: 39.61 },
  { code: "QSM", nameAr: "منطقة القصيم", nameEn: "Qassim", lat: 26.33, lng: 43.97 },
  { code: "EST", nameAr: "المنطقة الشرقية", nameEn: "Eastern Province", lat: 26.43, lng: 50.10 },
  { code: "ASR", nameAr: "منطقة عسير", nameEn: "Asir", lat: 18.22, lng: 42.50 },
  { code: "TBK", nameAr: "منطقة تبوك", nameEn: "Tabuk", lat: 28.38, lng: 36.57 },
  { code: "HAL", nameAr: "منطقة حائل", nameEn: "Hail", lat: 27.52, lng: 41.69 },
  { code: "NBR", nameAr: "منطقة الحدود الشمالية", nameEn: "Northern Borders", lat: 30.98, lng: 41.02 },
  { code: "JZN", nameAr: "منطقة جازان", nameEn: "Jazan", lat: 16.89, lng: 42.55 },
  { code: "NJR", nameAr: "منطقة نجران", nameEn: "Najran", lat: 17.49, lng: 44.13 },
  { code: "BAH", nameAr: "منطقة الباحة", nameEn: "Al Bahah", lat: 20.01, lng: 41.47 },
  { code: "JWF", nameAr: "منطقة الجوف", nameEn: "Al Jawf", lat: 29.97, lng: 40.20 },
];

export const PORTFOLIOS = [
  { code: "PF-1", nameAr: "محفظة التحول الرقمي", nameEn: "Digital Transformation", managerName: "م. فهد القحطاني", value: 2000, goal: "G3" },
  { code: "PF-2", nameAr: "محفظة الأمن الوطني", nameEn: "National Security", managerName: "د. هند العتيبي", value: 3300, goal: "G1" },
  { code: "PF-3", nameAr: "محفظة السلامة المرورية", nameEn: "Road Safety", managerName: "أ. سارة العمري", value: 2200, goal: "G2" },
  { code: "PF-4", nameAr: "محفظة أمن الحدود", nameEn: "Border Security", managerName: "م. ماجد السبيعي", value: 5500, goal: "G1" },
  { code: "PF-5", nameAr: "محفظة الخدمات والمستفيدين", nameEn: "Services & Beneficiaries", managerName: "د. ريم الزهراني", value: 5100, goal: "G3" },
  { code: "PF-6", nameAr: "محفظة البنية التحتية التقنية", nameEn: "Technology Infrastructure", managerName: "م. عبدالله الحربي", value: 5900, goal: "G4" },
  { code: "PF-7", nameAr: "محفظة رأس المال البشري", nameEn: "Human Capital", managerName: "أ. نورة الشهري", value: 4400, goal: "G5" },
  { code: "PF-8", nameAr: "محفظة الحوكمة والامتثال", nameEn: "Governance & Compliance", managerName: "د. بدر الرشيد", value: 4300, goal: "G4" },
];

export const PROGRAMS: { nameAr: string; pf: string }[] = [
  { nameAr: "برنامج التحول الرقمي للخدمات الأمنية", pf: "PF-1" }, { nameAr: "برنامج الرؤية الرقمية الموحدة", pf: "PF-1" }, { nameAr: "برنامج تطوير الخدمات الإلكترونية", pf: "PF-1" },
  { nameAr: "برنامج الشرطة الذكية", pf: "PF-2" }, { nameAr: "برنامج القيادة والسيطرة المتكاملة", pf: "PF-2" }, { nameAr: "برنامج منظومة الأدلة الجنائية", pf: "PF-2" },
  { nameAr: "برنامج إدارة المرور الذكي", pf: "PF-3" }, { nameAr: "برنامج الاستجابة للطوارئ", pf: "PF-3" }, { nameAr: "برنامج سلامة المنشآت والتجمعات", pf: "PF-3" },
  { nameAr: "برنامج المراقبة الذكية للحدود", pf: "PF-4" }, { nameAr: "برنامج الطائرات بدون طيار للمراقبة", pf: "PF-4" }, { nameAr: "برنامج المنافذ الذكية", pf: "PF-4" },
  { nameAr: "برنامج منصة الخدمات الموحدة", pf: "PF-5" }, { nameAr: "برنامج تجربة المستفيد", pf: "PF-5" }, { nameAr: "برنامج الترخيص الرقمي", pf: "PF-5" },
  { nameAr: "برنامج تطوير مراكز البيانات", pf: "PF-6" }, { nameAr: "برنامج تحديث شبكات الاتصالات", pf: "PF-6" }, { nameAr: "برنامج الأمن السيبراني المؤسسي", pf: "PF-6" }, { nameAr: "برنامج منصة البيانات الوطنية الأمنية", pf: "PF-6" },
  { nameAr: "برنامج تمكين الكفاءات الوطنية", pf: "PF-7" }, { nameAr: "برنامج التدريب والتأهيل النوعي", pf: "PF-7" }, { nameAr: "برنامج الذكاء الاصطناعي التشغيلي", pf: "PF-7" },
  { nameAr: "برنامج حوكمة البيانات والامتثال", pf: "PF-8" }, { nameAr: "برنامج أتمتة العمليات الإدارية", pf: "PF-8" }, { nameAr: "برنامج الاستدامة وكفاءة الإنفاق", pf: "PF-8" },
];

const PROJECT_TEMPLATES = [
  "مبادرة إدارة الحركة المرورية الذكية", "مشروع منصة الخدمات الموحدة", "مبادرة المراقبة بالذكاء الاصطناعي", "مشروع تحديث مركز العمليات",
  "مبادرة الرؤية الرقمية", "مشروع الأرشفة الإلكترونية", "مبادرة تحليلات البيانات الأمنية", "مشروع شبكة الاتصالات المؤمنة",
  "مبادرة الاستجابة الميدانية السريعة", "مشروع مراكز البيانات المتقدمة", "مبادرة التدريب النوعي", "مشروع منصة إدارة المخاطر",
  "مبادرة الدوريات الذكية", "مشروع البوابة الموحدة للمستفيدين", "مبادرة الأمن السيبراني المتقدم", "مشروع التكامل مع الجهات الحكومية",
  "مشروع الطائرات المسيّرة للمراقبة", "مبادرة أتمتة الموارد البشرية", "مبادرة قياس تجربة المستفيد", "مبادرة منظومة الأدلة الرقمية",
];
const MANAGERS = ["م. فهد القحطاني", "د. ريم الزهراني", "أ. سارة العمري", "أ. نورة الشهري", "م. ماجد السبيعي", "د. هند العتيبي", "أ. منال الأحمدي", "د. بدر الرشيد", "أ. عبدالله الحربي", "أ. لمياء الغامدي", "م. خالد الدوسري", "أ. عبير الشمري", "د. أمل العنزي", "م. تركي المطيري"];

const RISK_TITLES: Record<string, string[]> = {
  "أمن معلومات": ["مخاطر أمن المعلومات", "نقص الحماية السيبرانية للمنظومة", "تسرب بيانات حساسة"],
  "تنظيمي": ["تغير المتطلبات التنظيمية", "تعقيد إجراءات الموافقات", "تعارض الصلاحيات بين الجهات"],
  "موارد": ["نقص الكفاءات الفنية المتخصصة", "اعتمادية على مورد وحيد", "ضعف جاهزية البنية التحتية"],
  "مالي": ["تجاوز الميزانية المعتمدة", "تأخر صرف الدفعات", "ارتفاع تكلفة التشغيل"],
  "تقني": ["تأخر توريد الأجهزة والمعدات", "عدم توافق الأنظمة القديمة", "مقاومة التغيير التشغيلي"],
  "تعاقدي": ["تعثر التكامل مع الأنظمة الثالثة", "تأخر استكمال العقود", "جودة البيانات في الأنظمة المصدرية"],
};
const RESPONSES = ["تجنب", "قبول", "نقل", "تخفيف"] as const;
const RISK_STATUS = ["مفتوح", "قيد المعالجة", "تحت المراقبة"] as const;

export const KPIS = [
  { code: "KPI-01", nameAr: "مؤشر كفاءة الاستجابة للحوادث", nameEn: "Incident Response Efficiency", goal: "G2", sector: "SEC-CD", unit: "دقيقة", baseline: 14, target: 8, current: 9.4, lowerIsBetter: true, status: "at_risk" as Rag, rootCauseAr: "تأخر تسليم معدات التكامل في المبادرة الرئيسية، وفجوة في الكفاءات الفنية المتخصصة في قطاع الدفاع المدني." },
  { code: "KPI-02", nameAr: "مؤشر رضا المستفيدين", nameEn: "Beneficiary Satisfaction", goal: "G3", sector: "SEC-CS", unit: "%", baseline: 71, target: 90, current: 84, lowerIsBetter: false, status: "at_risk" as Rag },
  { code: "KPI-03", nameAr: "مؤشر جودة وكفاءة الخدمات", nameEn: "Service Quality Index", goal: "G3", sector: "SEC-PP", unit: "%", baseline: 58, target: 90, current: 88, lowerIsBetter: false, status: "at_risk" as Rag },
  { code: "KPI-04", nameAr: "مؤشر كفاءة الاستجابة للتبليغات", nameEn: "Report Response Efficiency", goal: "G2", sector: "SEC-911", unit: "%", baseline: 54, target: 95, current: 85, lowerIsBetter: false, status: "at_risk" as Rag },
  { code: "KPI-05", nameAr: "مؤشر تغطية الحدود بالمراقبة الذكية", nameEn: "Smart Border Coverage", goal: "G1", sector: "SEC-BG", unit: "%", baseline: 55, target: 95, current: 89, lowerIsBetter: false, status: "on_track" as Rag },
  { code: "KPI-06", nameAr: "مؤشر جاهزية القيادة والسيطرة", nameEn: "Command & Control Readiness", goal: "G1", sector: "SEC-PS", unit: "%", baseline: 60, target: 90, current: 84, lowerIsBetter: false, status: "at_risk" as Rag },
  { code: "KPI-07", nameAr: "مؤشر خفض الحوادث المرورية", nameEn: "Traffic Accident Reduction", goal: "G2", sector: "SEC-TR", unit: "%", baseline: 0, target: 25, current: 16, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-08", nameAr: "مؤشر زمن إنجاز المعاملات", nameEn: "Transaction Turnaround", goal: "G3", sector: "SEC-CS", unit: "يوم", baseline: 6, target: 1.8, current: 2.5, lowerIsBetter: true, status: "at_risk" as Rag },
  { code: "KPI-09", nameAr: "مؤشر أتمتة العمليات", nameEn: "Process Automation", goal: "G4", sector: "SEC-DW", unit: "%", baseline: 30, target: 80, current: 56, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-10", nameAr: "مؤشر كفاءة الإنفاق التشغيلي", nameEn: "Operational Spending Efficiency", goal: "G4", sector: "SEC-DW", unit: "%", baseline: 0, target: 12, current: 6, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-11", nameAr: "مؤشر إنتاجية الموارد البشرية", nameEn: "Workforce Productivity", goal: "G4", sector: "SEC-EM", unit: "%", baseline: 62, target: 85, current: 71, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-12", nameAr: "مؤشر التحقق السيبراني", nameEn: "Cyber Verification", goal: "G5", sector: "SEC-DW", unit: "%", baseline: 40, target: 90, current: 74, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-13", nameAr: "مؤشر تبني الذكاء الاصطناعي", nameEn: "AI Adoption", goal: "G5", sector: "SEC-PS", unit: "%", baseline: 12, target: 60, current: 34, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-14", nameAr: "مؤشر جاهزية الكفاءات الرقمية", nameEn: "Digital Talent Readiness", goal: "G5", sector: "SEC-EM", unit: "%", baseline: 45, target: 80, current: 62, lowerIsBetter: false, status: "off_track" as Rag },
  { code: "KPI-15", nameAr: "مؤشر سلامة التجمعات الكبرى", nameEn: "Mass Gathering Safety", goal: "G2", sector: "SEC-CD", unit: "%", baseline: 80, target: 98, current: 94, lowerIsBetter: false, status: "at_risk" as Rag },
];

export const DECISIONS = [
  { code: "DEC-001", titleAr: "اعتماد ميزانية إضافية لتوسعة منظومة المراقبة الذكية", type: "اعتماد مالي", priority: "عاجلة", amount: 240, ownerAr: "قطاع الأمن العام", dueDate: "2026-09-10", impactNoteAr: "+3.4% على مؤشر تغطية الحدود بالمراقبة الذكية", proj: 6 },
  { code: "DEC-002", titleAr: "اعتماد إعادة توزيع مخصصات محفظة التحول الرقمي", type: "اعتماد مالي", priority: "مرتفعة", amount: 180, ownerAr: "برنامج تطوير وزارة الداخلية", dueDate: "2026-09-18", impactNoteAr: "رفع الأثر المحقق للمحفظة بمقدار 4 نقاط", proj: 2 },
  { code: "DEC-003", titleAr: "تقليص نطاق المرحلة الثالثة من منصة الخدمات الموحدة", type: "قرار نطاق", priority: "مرتفعة", amount: 95, ownerAr: "قطاع الأحوال المدنية", dueDate: "2026-09-22", impactNoteAr: "تسريع الإطلاق 4 أشهر مع خفض الأثر 1.2%", proj: 4 },
  { code: "DEC-004", titleAr: "توحيد نطاق مشروعي الرؤية الرقمية والبوابة الموحدة", type: "قرار نطاق", priority: "مرتفعة", amount: 60, ownerAr: "قطاع الجوازات", dueDate: "2026-10-01", impactNoteAr: "تجنّب ازدواجية بمقدار 60 مليون ريال", proj: 9 },
  { code: "DEC-005", titleAr: "تصعيد استراتيجي: تعثر مؤشر أتمتة العمليات", type: "تصعيد استراتيجي", priority: "عاجلة", amount: null, ownerAr: "قطاع العمليات", dueDate: "2026-09-08", impactNoteAr: "استعادة 12 نقطة على مؤشر أتمتة العمليات", proj: 22 },
  { code: "DEC-006", titleAr: "اعتماد إعادة توزيع الموارد الفنية بين المحافظ", type: "قرار موارد", priority: "مرتفعة", amount: null, ownerAr: "قطاع الموارد البشرية", dueDate: "2026-09-25", impactNoteAr: "معالجة 41 مورداً محمّلاً فوق طاقته", proj: 31 },
  { code: "DEC-007", titleAr: "قبول مخاطرة استراتيجية على مشروع شبكة الاتصالات المؤمنة", type: "قبول مخاطرة", priority: "مرتفعة", amount: 130, ownerAr: "قطاع البنية التحتية", dueDate: "2026-10-05", impactNoteAr: "الحفاظ على الجدول الزمني مقابل مخاطرة متوسطة", proj: 8 },
];

// ---------------------------------------------------------------- generation
export type World = ReturnType<typeof generateWorld>;

export function generateWorld() {
  const today = new Date("2026-09-01");

  const objectives = GOALS.flatMap((g) => OBJECTIVES[g.code].map((n, i) => ({ goalCode: g.code, code: `${g.code}-0${i + 1}`, nameAr: n })));

  const programs = PROGRAMS.map((p, i) => ({
    code: `PRG-${String(i + 1).padStart(2, "0")}`, nameAr: p.nameAr, pf: p.pf, managerName: R.pick(MANAGERS),
    scheduleStatus: "on_track" as Rag, financialStatus: "on_track" as Rag, status: "on_track" as Rag,
  }));

  // 100 projects: 4 per program. Status mix targets the prototype (33 / 29 / 38).
  const statusPool: Rag[] = [...Array(33).fill("on_track"), ...Array(29).fill("at_risk"), ...Array(38).fill("off_track")];
  for (let i = statusPool.length - 1; i > 0; i--) { const j = R.int(0, i); [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]]; }

  const projects = programs.flatMap((prg, pi) => Array.from({ length: 4 }, (_, k) => {
    const idx = pi * 4 + k;
    const pf = PORTFOLIOS.find((p) => p.code === prg.pf)!;
    const status = statusPool[idx];
    const progress = status === "on_track" ? R.int(60, 96) : status === "at_risk" ? R.int(35, 80) : R.int(20, 60);
    const tmpl = PROJECT_TEMPLATES[idx % PROJECT_TEMPLATES.length];
    const suffix = Math.floor(idx / PROJECT_TEMPLATES.length) + 1;
    const budget = R.round((pf.value / 12.5) * (0.5 + R.next()), 0);   // portfolio value ≈ sum of its ~12.5 projects
    const start = addDays(today, -R.int(200, 700));
    const end = addDays(start, R.int(300, 720));
    const impactTarget = R.round(4 + R.next() * 6, 1);
    const ratio = status === "on_track" ? 0.85 + R.next() * 0.3 : status === "at_risk" ? 0.55 + R.next() * 0.3 : 0.3 + R.next() * 0.3;
    return {
      code: `PRJ-${String(idx + 1).padStart(3, "0")}`,
      nameAr: suffix === 1 && idx < PROJECT_TEMPLATES.length ? tmpl : `${tmpl} ${suffix}`,
      programCode: prg.code, pf: prg.pf, sector: SECTORS[R.int(0, SECTORS.length - 1)].code, goal: pf.goal,
      managerName: R.pick(MANAGERS), phase: progress >= 95 ? "الإغلاق" : progress >= 25 ? "التنفيذ" : progress >= 10 ? "التخطيط" : "المفهوم",
      progress, status,
      scheduleStatus: (status === "on_track" ? "on_track" : R.next() < 0.6 ? status : "on_track") as Rag,
      financialStatus: (status === "off_track" && R.next() < 0.5 ? "off_track" : R.next() < 0.25 ? "at_risk" : "on_track") as Rag,
      impactTarget, impactAchieved: R.round(impactTarget * ratio, 1),
      impactContribution: impactTarget >= 8 ? "عالية" : impactTarget >= 5.5 ? "متوسطة" : "منخفضة",
      priorityScore: R.round(55 + R.next() * 41, 1),
      startDate: iso(start), endDate: iso(end),
      regions: Array.from(new Set(Array.from({ length: R.int(1, 3) }, () => REGIONS[R.int(0, 12)].code))),
      budget, committed: R.round(budget * (0.45 + R.next() * 0.45), 0), actual: 0, eac: 0,
    };
  }));
  for (const p of projects) {
    p.actual = R.round(Math.min(p.committed, p.budget * p.progress / 100 * (0.8 + R.next() * 0.4)), 0);
    p.eac = R.round(p.financialStatus === "off_track" ? p.budget * (1.05 + R.next() * 0.15) : p.financialStatus === "at_risk" ? p.budget * (0.98 + R.next() * 0.07) : p.budget * (0.9 + R.next() * 0.08), 0);
  }
  // normalise budgets so each portfolio sums to its declared value (total 32,700M)
  for (const pf of PORTFOLIOS) {
    const own = projects.filter((p) => p.pf === pf.code);
    const sum = own.reduce((a, p) => a + p.budget, 0);
    for (const p of own) {
      const f = pf.value / sum;
      p.budget = R.round(p.budget * f, 0); p.committed = R.round(p.committed * f, 0); p.actual = R.round(p.actual * f, 0); p.eac = R.round(p.eac * f, 0);
    }
  }
  // program statuses derived from their projects
  for (const prg of programs) {
    const own = projects.filter((p) => p.programCode === prg.code);
    const avg = own.reduce((a, p) => a + p.progress, 0) / own.length;
    prg.status = own.some((p) => p.status === "off_track") ? (own.filter((p) => p.status === "off_track").length >= 2 ? "off_track" : "at_risk") : "on_track";
    prg.scheduleStatus = rag(avg);
    prg.financialStatus = own.some((p) => p.financialStatus === "off_track") ? "at_risk" : "on_track";
  }

  const milestones = projects.flatMap((p) => {
    const phases = ["المتطلبات", "التصميم", "التطوير", "الاختبار", "الإطلاق"];
    const start = new Date(p.startDate); const total = (new Date(p.endDate).getTime() - start.getTime()) / 86400000;
    let cursor = 0;
    return phases.map((ph, i) => {
      const len = Math.round(total * [0.15, 0.2, 0.35, 0.2, 0.1][i]);
      const ps = addDays(start, cursor); const pe = addDays(ps, len); cursor += len;
      const done = p.progress >= [15, 35, 70, 90, 100][i];
      const active = !done && p.progress >= [0, 15, 35, 70, 90][i];
      const delay = !active ? 0 : p.status === "off_track" ? R.int(10, 45) : p.status === "at_risk" ? R.int(0, 12) : 0;
      return { projectCode: p.code, nameAr: ph, plannedStart: iso(ps), plannedEnd: iso(pe), actualStart: done || active ? iso(ps) : null, actualEnd: done ? iso(addDays(pe, delay)) : null, delayDays: delay, status: done ? "مكتمل" : active ? (delay > 0 ? "متأخر" : "قيد التنفيذ") : "لم يبدأ", isCritical: i === 2 };
    });
  });

  const deliverables = projects.flatMap((p) => ["وثيقة المتطلبات المعتمدة", "التصميم الفني للمنظومة", "بيئة التشغيل الداخلية", "تشغيل تجريبي في مدينتين"].map((d, i) => ({
    projectCode: p.code, nameAr: d, status: p.progress >= [15, 35, 70, 95][i] ? "مكتمل" : p.progress >= [0, 15, 35, 70][i] ? (p.status === "off_track" ? "متأخر" : "قيد التنفيذ") : "قيد التسليم",
  })));

  // 42 risks
  const cats = Object.keys(RISK_TITLES);
  const risks = Array.from({ length: 42 }, (_, i) => {
    const cat = cats[i % cats.length]; const p = projects[(i * 7) % projects.length];
    const prob = R.int(1, 5); const imp = i < 8 ? 5 : R.int(1, 5);
    return { code: `RSK-${String(i + 1).padStart(3, "0")}`, projectCode: p.code, titleAr: R.pick(RISK_TITLES[cat]), category: cat, probability: i < 8 ? R.int(4, 5) : prob, impact: imp, response: R.pick(RESPONSES), status: R.pick(RISK_STATUS), ownerAr: R.pick(["قطاع الأمن العام", "قطاع البنية التحتية", "قطاع الموارد البشرية", "قطاع المالية", "برنامج تطوير وزارة الداخلية", "قطاع العمليات"]) };
  });

  const issues = Array.from({ length: 26 }, (_, i) => ({
    projectCode: projects[(i * 11 + 3) % projects.length].code,
    titleAr: R.pick(["عطل في التكامل", "تأخر صرف دفعة", "تأخر تسليم مخرج", "توقف بيئة الاختبار", "نقص في الموارد الفنية", "تعارض في المتطلبات"]),
    severity: i < 8 ? "حرجة" : i < 18 ? "مرتفعة" : "متوسطة", status: i % 5 === 0 ? "قيد المعالجة" : "مفتوحة", openedDays: R.int(5, 120),
  }));

  const DEP_TYPES = ["بنية تحتية", "تعاقدي", "موارد", "بيانات", "مخرج"];
  const DEP_NOTES: Record<string, string> = { "بنية تحتية": "يعتمد على جاهزية مركز البيانات", "تعاقدي": "بانتظار تسليم مخرج التكامل", "موارد": "تعارض في تخصيص الموارد", "بيانات": "بانتظار اعتماد نموذج البيانات", "مخرج": "بانتظار اعتماد الأثر المشترك" };
  const depStatus: Rag[] = [...Array(1).fill("on_track"), ...Array(8).fill("at_risk"), ...Array(5).fill("off_track")];
  const dependencies = Array.from({ length: 14 }, (_, i) => {
    const t = DEP_TYPES[i % DEP_TYPES.length];
    return { fromCode: projects[(i * 13) % 100].code, toCode: projects[(i * 13 + 7) % 100].code, type: t, status: depStatus[i], noteAr: DEP_NOTES[t] };
  });

  const escalations = [
    { proj: 2, titleAr: "عطل في التكامل", ownerAr: "قطاع العمليات", openedDays: 90 },
    { proj: 15, titleAr: "تأخر صرف دفعة", ownerAr: "قطاع العمليات", openedDays: 21 },
    { proj: 6, titleAr: "عطل في التكامل", ownerAr: "برنامج تطوير وزارة الداخلية", openedDays: 90 },
    { proj: 30, titleAr: "تأخر تسليم مخرج", ownerAr: "برنامج تطوير وزارة الداخلية", openedDays: 78 },
  ].map((e) => ({ projectCode: projects[e.proj].code, titleAr: e.titleAr, ownerAr: e.ownerAr, openedDays: e.openedDays, status: "مفتوحة" }));

  const changeRequestsGov = [
    { code: "CR-014", proj: 1, titleAr: "توسعة نطاق منصة الخدمات الموحدة لتشمل 12 خدمة إضافية", impactAr: "الأثر: +3 أشهر · +45 مليون ريال", status: "بانتظار لجنة التغيير" },
    { code: "CR-021", proj: 7, titleAr: "تغيير معمارية التكامل مع Odoo", impactAr: "الأثر: لا تغيير في المدة · +8 مليون ريال", status: "معتمد" },
    { code: "CR-027", proj: 12, titleAr: "تأجيل المرحلة الثالثة لمنظومة المراقبة", impactAr: "الأثر: +5 أشهر · بدون أثر مالي", status: "مرفوع للجنة" },
    { code: "CR-030", proj: 19, titleAr: "زيادة عدد الكوادر الفنية للمشروع", impactAr: "الأثر: +18 مورداً · +22 مليون ريال", status: "قيد الدراسة" },
  ].map((c) => ({ code: c.code, projectCode: projects[c.proj].code, titleAr: c.titleAr, impactAr: c.impactAr, status: c.status }));

  const decisions = DECISIONS.map((d) => ({ ...d, projectCode: projects[d.proj].code, status: "معلق" }));

  // KPI readings: 12 months converging from baseline toward current
  const kpiReadings = KPIS.flatMap((k) => Array.from({ length: 12 }, (_, m) => {
    const t = (m + 1) / 12;
    const actual = k.baseline + (k.current - k.baseline) * t * (0.9 + R.next() * 0.2);
    const target = k.baseline + (k.target - k.baseline) * t;
    return { kpiCode: k.code, month: `2026-${String(m + 1).padStart(2, "0")}-01`, actual: R.round(actual, 1), target: R.round(target, 1) };
  }));

  const projectKpis = projects.flatMap((p) => {
    const goalKpis = KPIS.filter((k) => k.goal === p.goal);
    const chosen = [goalKpis[R.int(0, goalKpis.length - 1)]];
    return chosen.map((k) => ({ projectCode: p.code, kpiCode: k.code, contributionTarget: p.impactTarget, contributionActual: p.impactAchieved }));
  });

  const FIRST = ["أحمد", "محمد", "سارة", "نورة", "خالد", "فهد", "ريم", "عبدالله", "منال", "لمياء", "تركي", "هند", "عبير", "بدر", "أمل", "ماجد", "دلال", "سلطان", "غادة", "فيصل"];
  const LAST = ["العتيبي", "الشمري", "المطيري", "الزهراني", "القحطاني", "الحربي", "الدوسري", "العمري", "الغامدي", "السبيعي", "الرشيد", "العنزي", "الشهري", "الأحمدي", "البقمي"];
  const ROLES_AR = ["مهندس نظم", "محلل أعمال", "مهندس تكامل", "مدير مشروع", "مطور", "محلل بيانات", "مهندس شبكات", "أخصائي أمن سيبراني", "مشرف تنفيذ", "مهندس اختبار"];
  const DEPTS = ["الإدارة العامة لتقنية المعلومات", "الأمن السيبراني", "المشتريات", "المالية", "الموارد البشرية", "برنامج تطوير وزارة الداخلية", "العمليات"];
  const resources = Array.from({ length: 220 }, (_, i) => ({
    nameAr: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`, roleAr: ROLES_AR[i % ROLES_AR.length], departmentAr: DEPTS[i % DEPTS.length],
    capacityHours: 160, leaveHours: R.pick([0, 0, 8, 16, 24, 40]), trainingHours: R.pick([0, 0, 8, 16]), hourlyCost: R.int(150, 320),
    assignments: Array.from({ length: R.int(1, 3) }, () => ({ projectCode: projects[R.int(0, 99)].code, hours: R.int(25, 90) })),
  }));
  // make exactly 14 over-allocated
  resources.slice(0, 14).forEach((r) => { r.assignments = [{ projectCode: projects[R.int(0, 99)].code, hours: 60 }, { projectCode: projects[R.int(0, 99)].code, hours: 45 }, { projectCode: projects[R.int(0, 99)].code, hours: 35 }]; r.leaveHours = 24; r.trainingHours = 16; });

  const now = new Date("2026-08-28T06:35:00");
  const dataSources = [
    { nameAr: "Microsoft Project Server", system: "project_server", recordCount: 128450, quality: 97.4, lastSyncAt: now, status: "on_track" as Rag },
    { nameAr: "Odoo ERP — المالية", system: "odoo_finance", recordCount: 86230, quality: 95.1, lastSyncAt: now, status: "on_track" as Rag },
    { nameAr: "Odoo ERP — الموارد البشرية", system: "odoo_hr", recordCount: 41870, quality: 91.2, lastSyncAt: now, status: "at_risk" as Rag },
    { nameAr: "بيانات الاستراتيجية والمؤشرات", system: "manual", recordCount: 3120, quality: 99, lastSyncAt: now, status: "on_track" as Rag },
    { nameAr: "SQL Server EPM Data Warehouse", system: "dwh", recordCount: 259670, quality: 96.6, lastSyncAt: now, status: "on_track" as Rag },
  ];
  const syncJobs = [
    { nameAr: "استخراج بيانات المشاريع (ETL)", scheduleAr: "كل ساعة · آخر تنفيذ 06:30", lastRunAt: now, status: "ناجحة" },
    { nameAr: "استخراج البيانات المالية", scheduleAr: "يومياً 05:45", lastRunAt: now, status: "ناجحة" },
    { nameAr: "استخراج بيانات الموارد البشرية", scheduleAr: "يومياً 05:45", lastRunAt: now, status: "جارٍ" },
    { nameAr: "تحقق جودة البيانات وقواعد العمل", scheduleAr: "بعد كل مزامنة", lastRunAt: now, status: "ناجحة" },
    { nameAr: "تحميل مستودع بيانات EPM", scheduleAr: "يومياً 06:15", lastRunAt: now, status: "ناجحة" },
  ];

  return { objectives, programs, projects, milestones, deliverables, risks, issues, dependencies, escalations, changeRequestsGov, decisions, kpiReadings, projectKpis, resources, dataSources, syncJobs };
}
