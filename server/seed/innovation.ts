/**
 * Innovation-maturity synthetic data. Two cycles (2026-H1 → 2026-H2) so trend and gap-to-target are real.
 * Model: six ISO 56002-aligned dimensions, scored 1–5, weighted to an overall maturity.
 */
import { rng } from "./generator";
import { maturityOverall } from "../../shared/schema";

const R = rng(20260912);
export const DIMENSIONS = [
  { key: "leadership", nameAr: "القيادة والاستراتيجية", nameEn: "Leadership & Strategy", weight: 20, descriptionAr: "وضوح التوجه، الرعاية التنفيذية، وأهداف الابتكار المعتمدة", sortOrder: 1 },
  { key: "culture", nameAr: "الثقافة والقدرات", nameEn: "Culture & Capabilities", weight: 15, descriptionAr: "المهارات، الحوافز، والمشاركة في توليد الأفكار", sortOrder: 2 },
  { key: "process", nameAr: "العمليات والحوكمة", nameEn: "Process & Governance", weight: 20, descriptionAr: "استقبال الأفكار وتقييمها وتجربتها وتوسيعها وفق مسار معتمد", sortOrder: 3 },
  { key: "resources", nameAr: "الموارد والتمويل", nameEn: "Resources & Funding", weight: 15, descriptionAr: "ميزانية مخصصة، وقت، ومختبرات للتجربة", sortOrder: 4 },
  { key: "technology", nameAr: "التقنية والبيانات", nameEn: "Technology & Data", weight: 15, descriptionAr: "الأدوات الممكّنة وتوافر البيانات ومنصات التجربة", sortOrder: 5 },
  { key: "results", nameAr: "النتائج والأثر", nameEn: "Results & Impact", weight: 15, descriptionAr: "الأفكار المنفذة، الأثر المتحقق، وسرعة الانتقال من الفكرة إلى التجربة", sortOrder: 6 },
];

const IDEAS: [string, string, string, number][] = [
  ["التحقق البيومتري في المنافذ عبر الهاتف", "خدمة", "تقليص زمن الإجراء في المنافذ البرية باستخدام التحقق الذاتي", 42],
  ["مساعد ذكي للتحقيقات الجنائية الرقمية", "تقنية", "توليد ملخصات الأدلة الرقمية آلياً", 18],
  ["جدولة الدوريات بالتحليلات التنبؤية", "عملية", "توزيع الدوريات وفق خرائط الحوادث المتوقعة", 27],
  ["منصة الإبلاغ المجتمعي الموحدة", "خدمة", "قناة واحدة للبلاغات غير الطارئة", 12],
  ["أتمتة إصدار التراخيص المرورية", "عملية", "إلغاء الخطوات الورقية للتراخيص المتجددة", 9],
  ["توائم رقمية لمراكز القيادة", "تقنية", "محاكاة سيناريوهات الاستجابة قبل التنفيذ", 35],
  ["نموذج تشغيل الخدمات المشتركة للمناطق", "نموذج تشغيل", "دمج الخدمات الإدارية على مستوى المنطقة", 22],
  ["سياسة البيانات المفتوحة للسلامة", "سياسة", "نشر مؤشرات السلامة لتعزيز الشراكة المجتمعية", 4],
  ["طائرات مسيّرة للإنذار المبكر من الحرائق", "تقنية", "رصد بؤر الحرائق في المواقع الصناعية", 30],
  ["الاعتماد الذاتي للوثائق المدنية", "خدمة", "استخراج الوثائق دون مراجعة", 15],
  ["مؤشر رضا لحظي في مراكز الخدمة", "عملية", "قياس التجربة عند كل معاملة", 3],
  ["تحليل صوتي لمكالمات 911", "تقنية", "تصنيف الحالة وأولويتها آلياً", 21],
  ["مختبر ابتكار إقليمي متنقل", "نموذج تشغيل", "وحدة متنقلة لتجارب الابتكار في المناطق", 6],
  ["بطاقة الموظف الرقمية الموحدة", "خدمة", "هوية واحدة لجميع الأنظمة الداخلية", 8],
  ["نظام إنذار مروري تنبؤي", "تقنية", "تنبيه السائقين قبل نقاط الازدحام", 19],
];

export function generateInnovation(sectors: { id: number }[], regions: { id: number }[]) {
  const dims = DIMENSIONS.map((d) => ({ key: d.key, weight: d.weight }));
  const assessments: any[] = []; const targets: any[] = [];
  const subjects = [...sectors.map((s) => ({ type: "sector", id: s.id })), ...regions.map((r) => ({ type: "region", id: r.id }))];
  subjects.forEach((sub, i) => {
    const base = 1.8 + R.next() * 2.2;                                  // H1 centre
    const h1: Record<string, number> = {}; const h2: Record<string, number> = {};
    for (const d of DIMENSIONS) { const v = Math.max(1, Math.min(5, Math.round(base + (R.next() - 0.5) * 1.6))); h1[d.key] = v; h2[d.key] = Math.max(1, Math.min(5, v + (R.next() < 0.45 ? 1 : R.next() < 0.08 ? -1 : 0))); }
    const o1 = maturityOverall(h1, dims), o2 = maturityOverall(h2, dims);
    assessments.push({ cycle: "2026-H1", subjectType: sub.type, subjectId: sub.id, scores: h1, overall: o1, level: Math.round(o1), assessorAr: "مكتب الابتكار", evidenceAr: "تقييم ذاتي مُراجع مركزياً", status: "منشور", assessedAt: "2026-03-15" });
    assessments.push({ cycle: "2026-H2", subjectType: sub.type, subjectId: sub.id, scores: h2, overall: o2, level: Math.round(o2), assessorAr: "مكتب الابتكار", evidenceAr: R.pick(["ورش عمل وشواهد موثقة", "تقييم ذاتي مع أدلة", "زيارة ميدانية وتقييم مستقل"]), status: i % 9 === 8 ? "مسودة" : "منشور", assessedAt: "2026-08-20" });
    targets.push({ cycle: "2026-H2", subjectType: sub.type, subjectId: sub.id, targetLevel: Math.min(5, Math.round((o1 + 0.8) * 10) / 10) });
  });
  const ideas = Array.from({ length: 30 }, (_, i) => {
    const [titleAr, category, descriptionAr, impact] = IDEAS[i % IDEAS.length]; const fromSector = R.next() < 0.7;
    const stageIndex = [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4][i % 12]; const scaled = i % 12 === 4; const dropped = i % 12 === 7;   // i % 12 === 11 stays active at قرار التوسع → CEO inbox
    return { code: `IDEA-${String(i + 1).padStart(3, "0")}`, titleAr: i >= IDEAS.length ? `${titleAr} — مرحلة ${Math.floor(i / IDEAS.length) + 1}` : titleAr, descriptionAr, category, sourceType: fromSector ? "sector" : "region", sourceId: fromSector ? sectors[i % sectors.length].id : regions[i % regions.length].id, submittedByAr: R.pick(["فريق الابتكار — القطاع", "منسق الابتكار — المنطقة", "موظف مبادر", "لجنة التحسين"]), submittedAt: new Date(Date.now() - 86400000 * R.int(15, 220)).toISOString().slice(0, 10), impactValue: impact, impactNoteAr: `أثر تقديري ${impact} مليون ريال/سنة`, status: scaled ? "موسّعة" : dropped ? "مستبعدة" : "قيد الإجراء", stageIndex: scaled ? 4 : stageIndex, scaled, dropped, daysAgoStage: R.int(0, 12) };
  });
  return { assessments, targets, ideas };
}
