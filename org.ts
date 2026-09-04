/**
 * Organizational-structure synthetic data — five levels: وزارة → قطاع → وكالة / إدارة عامة → إدارة → قسم.
 * Requests spread across the org_request workflow, including two awaiting the CEO and one Minister-level case.
 */
import { rng } from "./generator";

const R = rng(20260909);
const HEADS = ["اللواء م. عبدالله السبيعي", "د. سلطان القحطاني", "م. نايف الحربي", "د. مها الدوسري", "أ. فهد الشمري", "م. ريم العتيبي", "د. خالد الغامدي", "أ. نوف المطيري", "م. سعود الزهراني", "د. أمل الشهري", "أ. تركي العنزي", "م. لمياء الرشيد"];

const AGENCIES: Record<string, string[]> = {
  "SEC-PS": ["وكالة العمليات", "الإدارة العامة للمباحث", "الإدارة العامة للدوريات", "الإدارة العامة للتقنية"],
  "SEC-CD": ["الإدارة العامة للعمليات والإطفاء", "الإدارة العامة للوقاية", "الإدارة العامة للتخطيط"],
  "SEC-911": ["الإدارة العامة لغرف العمليات", "الإدارة العامة للتقنية والاتصالات"],
  "SEC-PP": ["الإدارة العامة للمنافذ", "الإدارة العامة للإقامة", "الإدارة العامة للتحول الرقمي"],
  "SEC-CS": ["الإدارة العامة للسجل المدني", "الإدارة العامة للخدمات الإلكترونية", "الإدارة العامة للفروع"],
  "SEC-DW": ["الإدارة العامة للتخطيط والتطوير", "الإدارة العامة للموارد البشرية", "الإدارة العامة للشؤون المالية", "الإدارة العامة لتقنية المعلومات", "برنامج تطوير وزارة الداخلية"],
  "SEC-TR": ["الإدارة العامة للعمليات المرورية", "الإدارة العامة للتراخيص", "الإدارة العامة للسلامة المرورية"],
  "SEC-BG": ["وكالة العمليات البحرية", "وكالة العمليات البرية", "الإدارة العامة للمراقبة الذكية"],
  "SEC-RS": ["الإدارة العامة للعمليات", "الإدارة العامة لدوريات الطرق"],
  "SEC-EM": ["الإدارة العامة لشؤون الإمارات", "الإدارة العامة للتنسيق مع المناطق"],
};
const DEPTS = ["إدارة التخطيط", "إدارة العمليات", "إدارة الجودة", "إدارة الدعم الفني", "إدارة المتابعة", "إدارة الشؤون الإدارية", "إدارة التحليل", "إدارة الخدمات"];
/** Departments referenced by seeded requests must exist deterministically. */
const FORCED_DEPTS: Record<string, string[]> = {
  "الإدارة العامة للدوريات": ["إدارة المتابعة", "إدارة الجودة", "إدارة العمليات"],
  "الإدارة العامة للسلامة المرورية": ["إدارة التحليل", "إدارة التخطيط"],
  "الإدارة العامة للتقنية والاتصالات": ["إدارة الدعم الفني", "إدارة العمليات"],
  "الإدارة العامة للخدمات الإلكترونية": ["إدارة الخدمات", "إدارة الجودة"],
  "الإدارة العامة للإقامة": ["إدارة الشؤون الإدارية", "إدارة العمليات"],
};
const SECTIONS = ["قسم التقارير", "قسم المتابعة", "قسم الدعم", "قسم التنسيق"];

export function generateOrg(sectors: { id: number; code: string; nameAr: string }[], projects: { id: number; nameAr: string; tags?: string[] }[]) {
  const units: any[] = []; let n = 0;
  const add = (u: any) => { units.push({ code: `OU-${String(++n).padStart(3, "0")}`, status: "معتمد", version: 1, effectiveFrom: "2024-01-01", ...u }); return n; }; // n == index+1 == future id (serial)
  const root = add({ nameAr: "وزارة الداخلية", level: "وزارة", parentId: null, headNameAr: "معالي الوزير", positions: 0, headcount: 0, sectorId: null, functionsAr: "الجهة السيادية المعنية بالأمن الداخلي والسلامة العامة" });
  const programUnitRef = { id: 0 };
  sectors.forEach((sct, si) => {
    const sec = add({ nameAr: sct.nameAr, level: "قطاع", parentId: root, headNameAr: HEADS[si % HEADS.length], positions: 0, headcount: 0, sectorId: sct.id, functionsAr: `القطاع المسؤول عن ${sct.nameAr}` });
    (AGENCIES[sct.code] ?? ["الإدارة العامة للعمليات"]).forEach((agName, ai) => {
      const isProgram = agName === "برنامج تطوير وزارة الداخلية";
      const ag = add({ nameAr: agName, level: "وكالة / إدارة عامة", parentId: sec, headNameAr: HEADS[(si + ai + 3) % HEADS.length], positions: 0, headcount: 0, sectorId: sct.id, functionsAr: isProgram ? "قيادة التحول والتطوير المؤسسي ومتابعة الأثر الاستراتيجي" : `${agName} — ${sct.nameAr}` });
      if (isProgram) programUnitRef.id = ag;
      const forced = FORCED_DEPTS[agName];
      const deptCount = isProgram ? 4 : forced ? forced.length : R.int(2, 4);
      for (let d = 0; d < deptCount; d++) {
        const dName = isProgram ? ["إدارة الاستراتيجية والأثر", "إدارة المحافظ والمشاريع", "إدارة البيانات والتحليلات", "إدارة التطوير التنظيمي"][d] : forced ? forced[d] : DEPTS[(si * 3 + ai + d) % DEPTS.length];
        const positions = R.int(18, 60); const headcount = Math.round(positions * (0.72 + R.next() * 0.28));
        const dep = add({ nameAr: dName, level: "إدارة", parentId: ag, headNameAr: HEADS[(si * 2 + d + 5) % HEADS.length], positions, headcount, sectorId: sct.id, functionsAr: `${dName} التابعة لـ${agName}` });
        if (R.next() < 0.5) for (let q = 0; q < R.int(2, 3); q++) { const p = R.int(5, 14); add({ nameAr: SECTIONS[(d + q) % SECTIONS.length], level: "قسم", parentId: dep, headNameAr: null, positions: p, headcount: Math.round(p * (0.7 + R.next() * 0.3)), sectorId: sct.id, functionsAr: null }); }
      }
    });
  });

  const byName = (name: string) => units.findIndex((u) => u.nameAr === name) + 1;
  const orgProjects = projects.filter((p) => (p.tags ?? []).includes("تنظيمي"));
  const rp = (i: number) => orgProjects[i % Math.max(1, orgProjects.length)]?.id ?? null;
  const dwSector = byName("ديوان وزارة الداخلية"); const psSector = byName("الأمن العام"); const pp = byName("الجوازات");
  const requests = [
    { code: "ORG-001", unit: byName("الإدارة العامة للتحول الرقمي"), type: "استحداث", titleAr: "استحداث إدارة الذكاء الاصطناعي بالإدارة العامة للتحول الرقمي", descriptionAr: "إنشاء إدارة متخصصة لتطبيقات الذكاء الاصطناعي في خدمات الجوازات.", justificationAr: "تنامي متطلبات الأتمتة الذكية والتحقق الآلي في المنافذ.", impactHeadcount: 24, impactBudget: 18, duplicationNoteAr: "لا يوجد تداخل — الوظائف لا تؤديها إدارة قائمة", relatedProjectIdx: 0, decisionAuthority: "الرئيس التنفيذي", priority: "مرتفعة", receivedAt: "2026-07-14", stageIndex: 4, units: [{ action: "استحداث", proposedNameAr: "إدارة الذكاء الاصطناعي", proposedParentId: byName("الإدارة العامة للتحول الرقمي"), proposedLevel: "إدارة", proposedPositions: 24 }] },
    { code: "ORG-002", unit: byName("الإدارة العامة للدوريات"), type: "دمج", titleAr: "دمج إدارة المتابعة مع إدارة الجودة بالإدارة العامة للدوريات", descriptionAr: "دمج الإدارتين في إدارة واحدة للجودة والمتابعة.", justificationAr: "تداخل المهام وازدواجية التقارير بين الإدارتين.", impactHeadcount: -6, impactBudget: -2.4, duplicationNoteAr: "تداخل مؤكد في 60% من المهام", relatedProjectIdx: 1, decisionAuthority: "الرئيس التنفيذي", priority: "متوسطة", receivedAt: "2026-06-30", stageIndex: 4, units: [{ action: "إلغاء", unitName: "إدارة المتابعة", parentName: "الإدارة العامة للدوريات" }, { action: "تعديل مسمى", unitName: "إدارة الجودة", parentName: "الإدارة العامة للدوريات", proposedNameAr: "إدارة الجودة والمتابعة" }] },
    { code: "ORG-003", unit: dwSector, type: "استحداث", titleAr: "استحداث وكالة للأمن السيبراني على مستوى الوزارة", descriptionAr: "وكالة مستقلة تتولى الحوكمة السيبرانية لجميع القطاعات.", justificationAr: "توزع المسؤوليات السيبرانية حالياً على أكثر من إدارة عامة.", impactHeadcount: 120, impactBudget: 95, duplicationNoteAr: "يستوعب مهام 3 إدارات قائمة", relatedProjectIdx: 2, decisionAuthority: "الوزير", priority: "عاجلة", receivedAt: "2026-05-20", stageIndex: 3, units: [{ action: "استحداث", proposedNameAr: "وكالة الأمن السيبراني", proposedParentId: dwSector, proposedLevel: "وكالة / إدارة عامة", proposedPositions: 120 }] },
    { code: "ORG-004", unit: byName("الإدارة العامة للسلامة المرورية"), type: "نقل تبعية", titleAr: "نقل إدارة التحليل إلى الإدارة العامة للعمليات المرورية", descriptionAr: "نقل تبعية إدارة التحليل لتقريبها من غرفة العمليات.", justificationAr: "تسريع دورة التحليل والاستجابة.", impactHeadcount: 0, impactBudget: 0, duplicationNoteAr: null, relatedProjectIdx: 0, decisionAuthority: "لجنة الهياكل", priority: "متوسطة", receivedAt: "2026-08-02", stageIndex: 2, units: [{ action: "نقل تبعية", unitName: "إدارة التحليل", parentName: "الإدارة العامة للسلامة المرورية", proposedParentName: "الإدارة العامة للعمليات المرورية" }] },
    { code: "ORG-005", unit: byName("الإدارة العامة للتقنية والاتصالات"), type: "توصيف وظيفي", titleAr: "تحديث التوصيف الوظيفي لوظائف مهندسي الأنظمة", descriptionAr: "تحديث بطاقات الوصف الوظيفي لتشمل مهارات السحابة الخاصة.", justificationAr: "فجوة مهارات مرصودة في تحليل القدرات.", impactHeadcount: 0, impactBudget: 0.6, duplicationNoteAr: null, relatedProjectIdx: 1, decisionAuthority: "لجنة الهياكل", priority: "متوسطة", receivedAt: "2026-08-18", stageIndex: 1, units: [{ action: "تعديل توصيف", unitName: "إدارة الدعم الفني", parentName: "الإدارة العامة للتقنية والاتصالات" }] },
    { code: "ORG-006", unit: byName("الإدارة العامة للمراقبة الذكية"), type: "استحداث", titleAr: "استحداث قسم تحليل صور المراقبة", descriptionAr: "قسم متخصص في تحليل بث الطائرات المسيّرة.", justificationAr: "دخول 40 طائرة جديدة للخدمة خلال 2026.", impactHeadcount: 12, impactBudget: 4.5, duplicationNoteAr: "لا يوجد", relatedProjectIdx: 2, decisionAuthority: "الرئيس التنفيذي", priority: "مرتفعة", receivedAt: "2026-08-25", stageIndex: 0, units: [{ action: "استحداث", proposedNameAr: "قسم تحليل صور المراقبة", proposedParentName: "الإدارة العامة للمراقبة الذكية", proposedLevel: "قسم", proposedPositions: 12 }] },
    { code: "ORG-007", unit: byName("الإدارة العامة للموارد البشرية"), type: "تحديث دليل تنظيمي", titleAr: "تحديث الدليل التنظيمي للإدارة العامة للموارد البشرية", descriptionAr: "مواءمة الدليل مع الهيكل المعتمد 2026.", justificationAr: "الدليل الحالي يعود لعام 2022.", impactHeadcount: 0, impactBudget: 0, duplicationNoteAr: null, relatedProjectIdx: 0, decisionAuthority: "لجنة الهياكل", priority: "متوسطة", receivedAt: "2026-04-10", stageIndex: 5, completed: true, units: [] },
    { code: "ORG-008", unit: byName("الإدارة العامة للإقامة"), type: "إلغاء", titleAr: "إلغاء قسم التقارير بإدارة الشؤون الإدارية", descriptionAr: "إلغاء القسم بعد أتمتة التقارير.", justificationAr: "الأتمتة الكاملة للتقارير الدورية.", impactHeadcount: -5, impactBudget: -1.1, duplicationNoteAr: null, relatedProjectIdx: 1, decisionAuthority: "الرئيس التنفيذي", priority: "متوسطة", receivedAt: "2026-03-05", stageIndex: 5, completed: true, units: [] },
    { code: "ORG-009", unit: psSector, type: "استحداث", titleAr: "استحداث إدارة عامة للطائرات المسيّرة بقطاع الأمن العام", descriptionAr: "إدارة عامة مستقلة لتشغيل الطائرات المسيّرة.", justificationAr: "تشتت التشغيل بين ثلاث إدارات.", impactHeadcount: 65, impactBudget: 40, duplicationNoteAr: "تداخل مع الإدارة العامة للمراقبة الذكية بحرس الحدود", relatedProjectIdx: 2, decisionAuthority: "الرئيس التنفيذي", priority: "مرتفعة", receivedAt: "2026-02-12", stageIndex: 4, rejected: true, units: [] },
    { code: "ORG-010", unit: byName("الإدارة العامة للخدمات الإلكترونية"), type: "تعديل مسمى", titleAr: "تعديل مسمى إدارة الخدمات إلى إدارة تجربة المستفيد", descriptionAr: "تغيير المسمى ليعكس النطاق الجديد.", justificationAr: "توسع المهام لتشمل قياس رضا المستفيد.", impactHeadcount: 0, impactBudget: 0, duplicationNoteAr: null, relatedProjectIdx: 0, decisionAuthority: "الرئيس التنفيذي", priority: "متوسطة", receivedAt: "2026-08-28", stageIndex: 1, units: [{ action: "تعديل مسمى", unitName: "إدارة الخدمات", parentName: "الإدارة العامة للخدمات الإلكترونية", proposedNameAr: "إدارة تجربة المستفيد" }] },
    { code: "ORG-011", unit: pp, type: "نقل تبعية", titleAr: "نقل الإدارة العامة للتحول الرقمي إلى ديوان الوزارة", descriptionAr: "مركزة التحول الرقمي على مستوى الوزارة.", justificationAr: "توحيد جهود التحول الرقمي.", impactHeadcount: 0, impactBudget: 0, duplicationNoteAr: "يتداخل مع مهام الإدارة العامة لتقنية المعلومات", relatedProjectIdx: 1, decisionAuthority: "الوزير", priority: "مرتفعة", receivedAt: "2026-07-01", stageIndex: 2, units: [{ action: "نقل تبعية", unitName: "الإدارة العامة للتحول الرقمي", parentName: "الجوازات", proposedParentName: "ديوان وزارة الداخلية" }] },
    { code: "ORG-012", unit: byName("الإدارة العامة للتخطيط والتطوير"), type: "استحداث", titleAr: "استحداث إدارة إدارة التغيير", descriptionAr: "إدارة تتولى منهجية إدارة التغيير للمبادرات الكبرى.", justificationAr: "توصية تقرير الدروس المستفادة من المرحلة الأولى.", impactHeadcount: 10, impactBudget: 3.2, duplicationNoteAr: "لا يوجد", relatedProjectIdx: 2, decisionAuthority: "الرئيس التنفيذي", priority: "متوسطة", receivedAt: "2026-08-30", stageIndex: 0, units: [{ action: "استحداث", proposedNameAr: "إدارة إدارة التغيير", proposedParentName: "الإدارة العامة للتخطيط والتطوير", proposedLevel: "إدارة", proposedPositions: 10 }] },
  ];
  // resolve names → ids for affected units
  const resolveUnit = (name: string, parentName: string) => { const pid = byName(parentName); const i = units.findIndex((u) => u.nameAr === name && u.parentId === pid); return i >= 0 ? i + 1 : null; };
  const resolved = requests.map((r) => ({
    ...r, relatedProjectId: rp(r.relatedProjectIdx),
    units: r.units.map((u: any) => ({ action: u.action, unitId: u.unitName ? resolveUnit(u.unitName, u.parentName) : null, proposedNameAr: u.proposedNameAr ?? null, proposedParentId: u.proposedParentId ?? (u.proposedParentName ? byName(u.proposedParentName) : null), proposedLevel: u.proposedLevel ?? null, proposedPositions: u.proposedPositions ?? null })),
  }));
  return { units, requests: resolved, programUnitId: programUnitRef.id };
}
