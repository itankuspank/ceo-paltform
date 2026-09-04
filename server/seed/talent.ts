/**
 * Talent-acquisition synthetic data — three engagement routes on the workflow engine.
 * Onboarded candidates are linked to existing HR resource records (the last 20 resources represent this year's joiners).
 */
import { rng } from "./generator";
import type { EngagementType } from "../../shared/schema";

const R = rng(20260910);
const ROLES: [string, string, boolean][] = [
  ["مهندس أمن سيبراني أول", "خبير", false], ["محلل بيانات", "متخصص", false], ["مدير مشروع تحول رقمي", "أول", false], ["مهندس تكامل أنظمة", "خبير", false], ["مستشار تخطيط استراتيجي", "قيادي", true],
  ["مطور تطبيقات", "متخصص", false], ["مهندس شبكات", "أول", false], ["أخصائي إدارة تغيير", "متخصص", false], ["مدير برنامج", "قيادي", true], ["محلل أعمال", "متخصص", false],
  ["مهندس ذكاء اصطناعي", "خبير", false], ["أخصائي حوكمة بيانات", "أول", false], ["مدير إدارة المحافظ", "قيادي", true], ["مهندس اختبار", "متخصص", false], ["أخصائي تجربة مستفيد", "متخصص", false],
];
const FIRST = ["أحمد", "محمد", "سارة", "نورة", "خالد", "فهد", "ريم", "عبدالله", "منال", "لمياء", "تركي", "هند", "عبير", "بدر", "أمل", "ماجد", "دلال", "سلطان", "غادة", "فيصل", "يوسف", "مها"];
const LAST = ["العتيبي", "الشمري", "المطيري", "الزهراني", "القحطاني", "الحربي", "الدوسري", "العمري", "الغامدي", "السبيعي", "الرشيد", "العنزي", "الشهري", "الأحمدي", "البقمي", "المالكي"];
const VENDORS = ["شركة حلول التقنية المتقدمة", "شركة ديار للاستشارات", "الشركة الوطنية للأنظمة", "شركة مسار للتقنية"];
const ENTITIES = ["وزارة الاتصالات وتقنية المعلومات", "هيئة الحكومة الرقمية", "الهيئة السعودية للبيانات والذكاء الاصطناعي", "وزارة المالية", "هيئة تقويم التعليم", "الهيئة الوطنية للأمن السيبراني"];
const TYPES: EngagementType[] = ["متعاقد", "مكلّف", "معار"];
const STAGES: Record<EngagementType, number> = { "متعاقد": 5, "مكلّف": 4, "معار": 4 };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const T0 = new Date("2026-09-01");

export function generateTalent(sectors: { id: number; nameAr: string }[], projects: { id: number; nameAr: string }[], resourceCount: number) {
  const requisitions = Array.from({ length: 28 }, (_, i) => {
    const [roleAr, band, isSenior] = ROLES[i % ROLES.length]; const type = TYPES[i % 3]; const sector = sectors[(i * 3) % sectors.length];
    const requested = new Date(T0.getTime() - 86400000 * R.int(20, 160));
    return { code: `REQ-${String(i + 1).padStart(3, "0")}`, roleAr, sectorId: sector.id, projectId: projects[(i * 7) % projects.length].id, engagementType: type, band, count: isSenior ? 1 : R.int(1, 4), filled: 0, priority: i % 5 === 0 ? "عاجلة" : i % 3 === 0 ? "مرتفعة" : "متوسطة", isSenior, requestedAt: iso(requested), targetStart: iso(new Date(requested.getTime() + 86400000 * R.int(45, 120))), status: "مفتوح", justificationAr: "احتياج معتمد ضمن خطة الموارد للمبادرة" };
  });
  const candidates: any[] = []; let joiner = resourceCount - 20;
  requisitions.forEach((rq, ri) => {
    const n = rq.count + R.int(0, 2);
    for (let c = 0; c < n; c++) {
      const idx = candidates.length; const stages = STAGES[rq.engagementType];
      // distribute: ~20% onboarded, ~10% dropped, rest spread over stages
      const roll = R.next(); const onboarded = roll < 0.2 && rq.filled < rq.count; const dropped = !onboarded && roll < 0.3;
      const stageIndex = onboarded ? stages - 1 : dropped ? R.int(0, stages - 2) : R.int(0, stages - 1);
      if (onboarded) rq.filled++;
      candidates.push({
        code: `CND-${String(idx + 1).padStart(3, "0")}`, nameAr: `${FIRST[idx % FIRST.length]} ${LAST[(idx * 5) % LAST.length]}`, requisitionId: ri + 1, engagementType: rq.engagementType,
        sourceAr: rq.engagementType === "متعاقد" ? R.pick(VENDORS) : rq.engagementType === "معار" ? R.pick(ENTITIES) : sectors[(ri + c) % sectors.length].nameAr,
        currentRoleAr: rq.engagementType === "مكلّف" ? R.pick(["ضابط", "أخصائي", "مهندس", "محلل"]) + " — " + sectors[(ri + c) % sectors.length].nameAr : null,
        clearanceStatus: onboarded ? "مجاز" : stageIndex >= stages - 2 ? R.pick(["قيد الفحص", "مجاز"]) : "لم يبدأ",
        monthlyRate: rq.engagementType === "متعاقد" ? R.int(18, 45) : null, secondmentMonths: rq.engagementType === "معار" ? R.pick([12, 24, 36]) : null,
        referenceAr: onboarded ? `${rq.engagementType === "متعاقد" ? "عقد" : rq.engagementType === "مكلّف" ? "تكليف" : "قرار إعارة"} رقم ${R.int(100, 999)}/2026` : null,
        onboardedResourceId: onboarded ? ++joiner : null, onboardedAt: onboarded ? iso(new Date(T0.getTime() - 86400000 * R.int(5, 60))) : null,
        status: onboarded ? "مباشر" : dropped ? "مستبعد" : "قيد الإجراء", stageIndex, dropped, onboarded,
        daysAgoStage: onboarded || dropped ? 0 : R.int(0, 8),
      });
    }
    if (rq.filled >= rq.count) rq.status = "مكتمل";
  });
  return { requisitions, candidates };
}
