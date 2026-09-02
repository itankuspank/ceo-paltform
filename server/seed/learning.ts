/**
 * Capability-development synthetic data — derived from the HR resources (beneficiaries are never duplicated).
 * English figures mirror the Power BI reference: 240 participants · 141 at B2+ · 91 at B1 or below · ~59 improved.
 */
import { rng } from "./generator";
import { CEFR } from "../../shared/schema";

const R = rng(20260907);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const T0 = new Date("2026-09-01");

export const PROVIDERS = [
  { nameAr: "جامعة الملك سعود", type: "جامعة", countryAr: "المملكة العربية السعودية", accredited: true, costIndex: 3, qualityScore: 92 },
  { nameAr: "جامعة الملك فهد للبترول والمعادن", type: "جامعة", countryAr: "المملكة العربية السعودية", accredited: true, costIndex: 3, qualityScore: 94 },
  { nameAr: "جامعة نايف العربية للعلوم الأمنية", type: "جامعة", countryAr: "المملكة العربية السعودية", accredited: true, costIndex: 2, qualityScore: 90 },
  { nameAr: "University College London", type: "جامعة", countryAr: "المملكة المتحدة", accredited: true, costIndex: 5, qualityScore: 95 },
  { nameAr: "Carnegie Mellon University", type: "جامعة", countryAr: "الولايات المتحدة", accredited: true, costIndex: 5, qualityScore: 96 },
  { nameAr: "معهد الإدارة العامة", type: "مركز تدريب", countryAr: "المملكة العربية السعودية", accredited: true, costIndex: 2, qualityScore: 88 },
  { nameAr: "الأكاديمية الوطنية للأمن السيبراني", type: "مركز تدريب", countryAr: "المملكة العربية السعودية", accredited: true, costIndex: 3, qualityScore: 91 },
  { nameAr: "أكاديمية مسك للقيادة", type: "مركز تدريب", countryAr: "المملكة العربية السعودية", accredited: true, costIndex: 4, qualityScore: 89 },
  { nameAr: "Kaplan International", type: "منصة إلكترونية", countryAr: "المملكة المتحدة", accredited: true, costIndex: 2, qualityScore: 84 },
  { nameAr: "Duolingo English", type: "منصة إلكترونية", countryAr: "الولايات المتحدة", accredited: false, costIndex: 1, qualityScore: 74 },
  { nameAr: "EF SET", type: "منصة إلكترونية", countryAr: "سويسرا", accredited: true, costIndex: 2, qualityScore: 82 },
  { nameAr: "PMI — Project Management Institute", type: "مركز تدريب", countryAr: "الولايات المتحدة", accredited: true, costIndex: 3, qualityScore: 90 },
];

const PLATFORMS = ["Kaplan", "Duolingo", "EF SET", "Grammarly", "Praktika"];
const SPECS = ["الأمن السيبراني", "علوم البيانات", "إدارة الأعمال التنفيذية", "الذكاء الاصطناعي", "إدارة المشاريع", "السياسات العامة", "الهندسة الأمنية", "إدارة الأزمات"];

export function generateLearning(resourceCount: number, sectorCount: number) {
  const programs: any[] = []; const enrollments: any[] = [];
  const prog = (p: any) => { programs.push({ code: `LP-${String(programs.length + 1).padStart(3, "0")}`, ...p }); return programs.length; };
  const used = new Set<number>(); const pickResource = () => { let r = R.int(1, resourceCount); while (used.has(r) && used.size < resourceCount) r = R.int(1, resourceCount); used.add(r); return r; };

  // ---- English track: one programme, 240 participants
  const englishId = prog({ nameAr: "مسار تحسين مهارات اللغة الإنجليزية", track: "english", providerId: 9, kind: "مسار لغوي", startDate: "2026-01-15", endDate: "2026-12-15", cost: 6.5, capacity: 260, status: "جارٍ", sectorId: null });
  const englishResources = Array.from({ length: Math.min(240, resourceCount) }, (_, i) => i + 1);
  englishResources.forEach((rid, i) => {
    // target mix: 8 without placement, 91 B1-or-below, 141 B2-or-above (current level)
    const noTest = i < 8;
    let placement: string | null; let current: string;
    if (noTest) { placement = null; current = R.pick(["A1", "A2", "B1"]); }
    else if (i < 8 + 91) { placement = R.pick(["A0", "A0", "A1", "A1", "A2", "A2", "B1"]); const pi = CEFR.indexOf(placement as any); const gain = R.next() < 0.22 ? R.int(1, 2) : 0; current = CEFR[Math.min(3, pi + gain)]; }
    else { placement = R.pick(["B1", "B2", "B2", "B2", "C1", "C2"]); const pi = CEFR.indexOf(placement as any); const gain = R.next() < 0.28 ? R.int(1, 2) : 0; current = CEFR[Math.max(4, Math.min(6, pi + gain))]; }
    enrollments.push({ programId: englishId, resourceId: rid, status: "جارٍ", completion: R.int(20, 95), placementLevel: placement, currentLevel: current, platform: R.pick(PLATFORMS), reaction: R.int(70, 95), learning: R.int(55, 90), behavior: null, results: null });
  });

  // ---- Postgraduate: 24 scholars
  const pg = [
    prog({ nameAr: "برنامج الابتعاث — ماجستير الأمن السيبراني", track: "postgraduate", providerId: 4, kind: "ماجستير", startDate: "2025-09-01", endDate: "2027-06-30", cost: 320, capacity: 8, status: "جارٍ", sectorId: 1 }),
    prog({ nameAr: "برنامج الابتعاث — ماجستير علوم البيانات", track: "postgraduate", providerId: 5, kind: "ماجستير", startDate: "2025-09-01", endDate: "2027-06-30", cost: 340, capacity: 8, status: "جارٍ", sectorId: 6 }),
    prog({ nameAr: "الماجستير التنفيذي في إدارة الأعمال", track: "postgraduate", providerId: 2, kind: "ماجستير", startDate: "2026-01-15", endDate: "2027-12-15", cost: 180, capacity: 10, status: "جارٍ", sectorId: 6 }),
    prog({ nameAr: "برنامج الدكتوراه — العلوم الأمنية", track: "postgraduate", providerId: 3, kind: "دكتوراه", startDate: "2024-09-01", endDate: "2028-06-30", cost: 260, capacity: 6, status: "جارٍ", sectorId: 1 }),
  ];
  for (let i = 0; i < 24; i++) enrollments.push({ programId: pg[i % 4], resourceId: pickResource(), status: i % 9 === 8 ? "مكتمل" : "جارٍ", completion: i % 9 === 8 ? 100 : R.int(15, 85), specializationAr: SPECS[i % SPECS.length], reaction: R.int(75, 95), learning: R.int(65, 92), behavior: R.int(55, 85), results: i % 9 === 8 ? R.int(60, 88) : null });

  // ---- Leadership: 3 programmes
  const ld = [
    prog({ nameAr: "برنامج إعداد القيادات التنفيذية", track: "leadership", providerId: 8, kind: "برنامج قيادي", startDate: "2026-03-01", endDate: "2026-11-30", cost: 95, capacity: 16, status: "جارٍ", sectorId: 6 }),
    prog({ nameAr: "برنامج القيادات الوسطى", track: "leadership", providerId: 6, kind: "برنامج قيادي", startDate: "2026-02-01", endDate: "2026-09-30", cost: 48, capacity: 24, status: "جارٍ", sectorId: 6 }),
    prog({ nameAr: "برنامج تأهيل الصف الثاني", track: "leadership", providerId: 8, kind: "برنامج قيادي", startDate: "2025-10-01", endDate: "2026-06-30", cost: 62, capacity: 20, status: "مكتمل", sectorId: 6 }),
  ];
  for (let i = 0; i < 44; i++) { const p = ld[i % 3]; const done = p === ld[2]; enrollments.push({ programId: p, resourceId: pickResource(), status: done ? "مكتمل" : "جارٍ", completion: done ? 100 : R.int(30, 90), reaction: R.int(80, 97), learning: R.int(65, 92), behavior: done ? R.int(60, 90) : R.int(40, 75), results: done ? R.int(55, 85) : null }); }

  // ---- Short training: 14 courses / workshops / certifications
  const shortDefs = [["إدارة المشاريع الاحترافية PMP", "شهادة احترافية", 12, 18], ["تحليل البيانات باستخدام Power BI", "دورة", 7, 4], ["أساسيات الأمن السيبراني", "دورة", 7, 3], ["إدارة المخاطر المؤسسية", "ورشة", 6, 2], ["قيادة التغيير", "ورشة", 8, 3], ["حوكمة البيانات", "دورة", 7, 4], ["التخطيط الاستراتيجي وبطاقة الأداء", "دورة", 6, 5], ["شهادة ITIL 4", "شهادة احترافية", 7, 9], ["إدارة الأزمات والطوارئ", "ورشة", 2, 3], ["الذكاء الاصطناعي للقيادات", "ورشة", 7, 6], ["إدارة الموارد البشرية الاستراتيجية", "دورة", 6, 4], ["شهادة CISSP", "شهادة احترافية", 7, 15], ["مهارات العرض والإقناع", "ورشة", 6, 2], ["إدارة محافظ المشاريع PfMP", "شهادة احترافية", 12, 20]];
  const sd = shortDefs.map(([n, k, prov, cost], i) => { const st = addDays(T0, R.int(-200, 90)); const status = st > T0 ? "مخطط" : addDays(st, 30) < T0 ? "مكتمل" : "جارٍ"; return prog({ nameAr: n, track: "short", providerId: prov, kind: k, startDate: iso(st), endDate: iso(addDays(st, k === "ورشة" ? 3 : k === "دورة" ? 10 : 30)), cost, capacity: R.int(15, 30), status, sectorId: R.int(1, sectorCount) }); });
  sd.forEach((pid) => { const p = programs[pid - 1]; const n = R.int(8, p.capacity); for (let i = 0; i < n; i++) { const done = p.status === "مكتمل"; enrollments.push({ programId: pid, resourceId: R.int(1, resourceCount), status: p.status === "مخطط" ? "مسجل" : done ? "مكتمل" : "جارٍ", completion: p.status === "مخطط" ? 0 : done ? 100 : R.int(20, 90), reaction: done ? R.int(70, 96) : null, learning: done ? R.int(60, 92) : null, behavior: done && R.next() < 0.6 ? R.int(45, 85) : null, results: done && R.next() < 0.35 ? R.int(40, 80) : null }); } });

  // ---- Skills matrix (20 skills across sectors)
  const skillNames = ["الأمن السيبراني التشغيلي", "تحليل البيانات الأمنية", "إدارة المشاريع", "الذكاء الاصطناعي التطبيقي", "إدارة الأزمات", "التحقيق الجنائي الرقمي", "هندسة الشبكات المؤمنة", "إدارة الحشود", "حوكمة البيانات", "التخطيط الاستراتيجي", "التفاوض والتواصل", "إدارة الطوارئ الميدانية", "تحليل المخاطر", "تطوير الخدمات الرقمية", "اللغة الإنجليزية المهنية", "القيادة التنفيذية", "إدارة العقود", "المراقبة الذكية", "تصميم تجربة المستفيد", "إدارة الأداء المؤسسي"];
  const skills = skillNames.map((nameAr, i) => { const required = R.int(20, 80); const covered = Math.round(required * (0.55 + R.next() * 0.5)); return { nameAr, sectorId: (i % sectorCount) + 1, importance: i % 4 === 0 ? "حرجة" : i % 3 === 0 ? "عالية" : "متوسطة", required, covered: Math.min(required, covered), gapClosure: R.int(35, 95) }; });

  const positions = ["مدير عام العمليات", "مدير إدارة الأمن السيبراني", "مدير مركز البيانات", "مدير إدارة المشاريع", "مدير إدارة التخطيط", "مدير الجودة والامتثال", "مدير التحول الرقمي", "مدير الموارد البشرية", "مدير المراقبة الذكية", "مدير التدريب والتطوير", "مدير العمليات الميدانية", "مدير إدارة البيانات"];
  const succession = positions.map((positionAr, i) => { const pct = R.int(40, 96); return { positionAr, sectorId: (i % sectorCount) + 1, incumbentAr: R.pick(["م. خالد الدوسري", "د. أمل العنزي", "أ. عبير الشمري", "م. تركي المطيري", "د. بدر الرشيد", "أ. لمياء الغامدي"]), successorResourceId: pickResource(), readiness: pct >= 85 ? "جاهز الآن" : pct >= 65 ? "خلال سنة" : "خلال سنتين", readinessPct: pct }; });

  return { programs, enrollments, skills, succession };
}
