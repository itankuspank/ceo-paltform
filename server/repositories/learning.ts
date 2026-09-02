import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import * as s from "../../shared/schema";
import { skillReadiness, CEFR } from "../../shared/schema";

const r1 = (v: number) => Math.round(v * 10) / 10;
const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === "number"); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };
const lvl = (l: string | null) => (l ? CEFR.indexOf(l as any) : -1);

export class LearningRepository {
  constructor(private db: Db) {}

  private enrollmentsBase() {
    return this.db.select({
      id: s.learningEnrollments.id, programId: s.learningEnrollments.programId, resourceId: s.learningEnrollments.resourceId, status: s.learningEnrollments.status, completion: s.learningEnrollments.completion,
      placementLevel: s.learningEnrollments.placementLevel, currentLevel: s.learningEnrollments.currentLevel, platform: s.learningEnrollments.platform, specializationAr: s.learningEnrollments.specializationAr,
      reaction: s.learningEnrollments.reaction, learning: s.learningEnrollments.learning, behavior: s.learningEnrollments.behavior, results: s.learningEnrollments.results,
      programName: s.learningPrograms.nameAr, track: s.learningPrograms.track, kind: s.learningPrograms.kind, cost: s.learningPrograms.cost, programStatus: s.learningPrograms.status,
      resourceName: s.resources.nameAr, roleAr: s.resources.roleAr, departmentAr: s.resources.departmentAr,
    }).from(s.learningEnrollments).innerJoin(s.learningPrograms, eq(s.learningPrograms.id, s.learningEnrollments.programId)).innerJoin(s.resources, eq(s.resources.id, s.learningEnrollments.resourceId));
  }

  async readiness() {
    const sk = await this.db.select({ id: s.skills.id, nameAr: s.skills.nameAr, sectorId: s.skills.sectorId, sectorName: s.sectors.nameAr, importance: s.skills.importance, required: s.skills.required, covered: s.skills.covered, gapClosure: s.skills.gapClosure })
      .from(s.skills).innerJoin(s.sectors, eq(s.sectors.id, s.skills.sectorId)).orderBy(asc(s.skills.id));
    const rows = sk.map((x) => ({ ...x, coverage: x.required ? r1(Math.min(100, (x.covered / x.required) * 100)) : 100, readiness: skillReadiness(x) }));
    const index = r1(rows.reduce((a, x) => a + x.readiness, 0) / (rows.length || 1));
    const status = index >= 85 ? "on_track" : index >= 70 ? "at_risk" : "off_track";
    const critical = rows.filter((x) => x.importance === "حرجة" && x.readiness < 80);
    const bySector = Object.values(rows.reduce((acc, x) => { (acc[x.sectorId] ??= { sectorId: x.sectorId, sectorName: x.sectorName, items: [] as number[] }).items.push(x.readiness); return acc; }, {} as Record<number, { sectorId: number; sectorName: string; items: number[] }>))
      .map((g) => ({ sectorId: g.sectorId, sectorName: g.sectorName, readiness: r1(g.items.reduce((a, b) => a + b, 0) / g.items.length), skills: g.items.length })).sort((a, b) => b.readiness - a.readiness);
    return { index, status, criticalGaps: critical.length, critical, skills: rows, bySector };
  }

  async dashboard() {
    const en = await this.enrollmentsBase();
    const programs = await this.db.select().from(s.learningPrograms);
    const beneficiaries = new Set(en.map((e) => e.resourceId)).size;
    const spend = r1(en.reduce((a, e) => a + e.cost, 0) / 1000); // SAR thousands → millions
    const tracks = (["english", "postgraduate", "leadership", "short"] as const).map((t) => { const te = en.filter((e) => e.track === t); return { track: t, participants: new Set(te.map((e) => e.resourceId)).size, programs: programs.filter((p) => p.track === t).length, completion: avg(te.map((e) => e.completion)) ?? 0, completed: te.filter((e) => e.status === "مكتمل").length }; });
    const impact = { reaction: avg(en.map((e) => e.reaction)), learning: avg(en.map((e) => e.learning)), behavior: avg(en.map((e) => e.behavior)), results: avg(en.map((e) => e.results)) };
    const rd = await this.readiness();
    const upcoming = await this.db.select({ id: s.learningPrograms.id, nameAr: s.learningPrograms.nameAr, track: s.learningPrograms.track, kind: s.learningPrograms.kind, startDate: s.learningPrograms.startDate, capacity: s.learningPrograms.capacity, provider: s.learningProviders.nameAr })
      .from(s.learningPrograms).leftJoin(s.learningProviders, eq(s.learningProviders.id, s.learningPrograms.providerId)).where(eq(s.learningPrograms.status, "مخطط")).orderBy(asc(s.learningPrograms.startDate)).limit(5);
    const eng = en.filter((e) => e.track === "english");
    return {
      totals: { beneficiaries, programs: programs.length, spend, avgCompletion: avg(en.map((e) => e.completion)) ?? 0, active: programs.filter((p) => p.status === "جارٍ").length, learningImpact: avg([impact.reaction, impact.learning, impact.behavior, impact.results]) ?? 0 },
      readiness: { index: rd.index, status: rd.status, criticalGaps: rd.criticalGaps }, tracks, impact, upcoming, bySector: rd.bySector.slice(0, 6),
      english: { participants: eng.length, b2plus: eng.filter((e) => lvl(e.currentLevel) >= 4).length, improved: eng.filter((e) => e.placementLevel && lvl(e.currentLevel) > lvl(e.placementLevel)).length },
    };
  }

  async english() {
    const en = (await this.enrollmentsBase()).filter((e) => e.track === "english");
    return en.map((e) => ({ id: e.id, resourceId: e.resourceId, nameAr: e.resourceName, departmentAr: e.departmentAr, placementLevel: e.placementLevel, currentLevel: e.currentLevel, platform: e.platform, completion: e.completion,
      improvement: e.placementLevel ? Math.max(0, lvl(e.currentLevel) - lvl(e.placementLevel)) : 0 }));
  }

  async track(track: s.LearningTrack) {
    const programs = await this.db.select({ id: s.learningPrograms.id, code: s.learningPrograms.code, nameAr: s.learningPrograms.nameAr, kind: s.learningPrograms.kind, startDate: s.learningPrograms.startDate, endDate: s.learningPrograms.endDate, cost: s.learningPrograms.cost, capacity: s.learningPrograms.capacity, status: s.learningPrograms.status, provider: s.learningProviders.nameAr, providerCountry: s.learningProviders.countryAr, sectorName: s.sectors.nameAr })
      .from(s.learningPrograms).leftJoin(s.learningProviders, eq(s.learningProviders.id, s.learningPrograms.providerId)).leftJoin(s.sectors, eq(s.sectors.id, s.learningPrograms.sectorId)).where(eq(s.learningPrograms.track, track)).orderBy(asc(s.learningPrograms.startDate));
    const en = (await this.enrollmentsBase()).filter((e) => e.track === track);
    const progs = programs.map((p) => { const pe = en.filter((e) => e.programId === p.id); return { ...p, enrolled: pe.length, completed: pe.filter((e) => e.status === "مكتمل").length, completion: avg(pe.map((e) => e.completion)) ?? 0, totalCost: r1((p.cost * pe.length) / 1000), impact: avg(pe.flatMap((e) => [e.reaction, e.learning, e.behavior, e.results])) }; });
    const succession = track === "leadership" ? await this.db.select({ id: s.successionPlans.id, positionAr: s.successionPlans.positionAr, sectorName: s.sectors.nameAr, incumbentAr: s.successionPlans.incumbentAr, successor: s.resources.nameAr, successorId: s.resources.id, readiness: s.successionPlans.readiness, readinessPct: s.successionPlans.readinessPct })
      .from(s.successionPlans).innerJoin(s.sectors, eq(s.sectors.id, s.successionPlans.sectorId)).leftJoin(s.resources, eq(s.resources.id, s.successionPlans.successorResourceId)).orderBy(desc(s.successionPlans.readinessPct)) : [];
    return { programs: progs, enrollments: en.map((e) => ({ id: e.id, resourceId: e.resourceId, nameAr: e.resourceName, roleAr: e.roleAr, departmentAr: e.departmentAr, programName: e.programName, kind: e.kind, status: e.status, completion: e.completion, specializationAr: e.specializationAr, reaction: e.reaction, learning: e.learning, behavior: e.behavior, results: e.results })), succession,
      summary: { programs: programs.length, participants: new Set(en.map((e) => e.resourceId)).size, completed: en.filter((e) => e.status === "مكتمل").length, spend: r1(en.reduce((a, e) => a + e.cost, 0) / 1000), completion: avg(en.map((e) => e.completion)) ?? 0 } };
  }

  async employees() {
    const en = await this.enrollmentsBase();
    const by: Record<number, any> = {};
    for (const e of en) {
      const b = (by[e.resourceId] ??= { resourceId: e.resourceId, nameAr: e.resourceName, roleAr: e.roleAr, departmentAr: e.departmentAr, enrollments: 0, completed: 0, tracks: new Set<string>(), englishLevel: null as string | null, completion: [] as number[] });
      b.enrollments++; if (e.status === "مكتمل") b.completed++; b.tracks.add(e.track); if (e.track === "english") b.englishLevel = e.currentLevel; b.completion.push(e.completion);
    }
    return Object.values(by).map((b) => ({ ...b, tracks: Array.from(b.tracks), completion: avg(b.completion) ?? 0 })).sort((a, b) => b.enrollments - a.enrollments);
  }

  async employee(resourceId: number) {
    const [r] = await this.db.select().from(s.resources).where(eq(s.resources.id, resourceId)).limit(1);
    if (!r) return null;
    const en = (await this.enrollmentsBase()).filter((e) => e.resourceId === resourceId);
    const succ = await this.db.select({ positionAr: s.successionPlans.positionAr, readiness: s.successionPlans.readiness, readinessPct: s.successionPlans.readinessPct }).from(s.successionPlans).where(eq(s.successionPlans.successorResourceId, resourceId));
    const gaps = en.filter((e) => e.track === "english" && lvl(e.currentLevel) < 4).map(() => "اللغة الإنجليزية المهنية — دون مستوى B2");
    return { resource: r, enrollments: en, succession: succ, gaps, impact: { reaction: avg(en.map((e) => e.reaction)), learning: avg(en.map((e) => e.learning)), behavior: avg(en.map((e) => e.behavior)), results: avg(en.map((e) => e.results)) } };
  }

  async providers() {
    const pv = await this.db.select().from(s.learningProviders).orderBy(desc(s.learningProviders.qualityScore));
    const en = await this.enrollmentsBase(); const programs = await this.db.select().from(s.learningPrograms);
    return pv.map((p) => { const pp = programs.filter((x) => x.providerId === p.id); const pe = en.filter((e) => pp.some((x) => x.id === e.programId)); return { ...p, programs: pp.length, participants: pe.length, spend: r1(pe.reduce((a, e) => a + e.cost, 0) / 1000), completion: avg(pe.map((e) => e.completion)) ?? 0, satisfaction: avg(pe.map((e) => e.reaction)) }; });
  }

  async calendar() {
    const programs = await this.db.select({ id: s.learningPrograms.id, nameAr: s.learningPrograms.nameAr, track: s.learningPrograms.track, kind: s.learningPrograms.kind, startDate: s.learningPrograms.startDate, endDate: s.learningPrograms.endDate, capacity: s.learningPrograms.capacity, status: s.learningPrograms.status, provider: s.learningProviders.nameAr })
      .from(s.learningPrograms).leftJoin(s.learningProviders, eq(s.learningProviders.id, s.learningPrograms.providerId)).orderBy(asc(s.learningPrograms.startDate));
    const counts = await this.db.select({ programId: s.learningEnrollments.programId, n: sql<number>`count(*)` }).from(s.learningEnrollments).groupBy(s.learningEnrollments.programId);
    const c = Object.fromEntries(counts.map((x) => [x.programId, Number(x.n)]));
    return programs.map((p) => ({ ...p, enrolled: c[p.id] ?? 0, registrationOpen: p.status !== "مكتمل" && (c[p.id] ?? 0) < p.capacity }));
  }

  async analysis() {
    const rd = await this.readiness();
    const en = await this.enrollmentsBase();
    const byTrack = (["english", "postgraduate", "leadership", "short"] as const).map((t) => { const te = en.filter((e) => e.track === t); return { track: t, reaction: avg(te.map((e) => e.reaction)), learning: avg(te.map((e) => e.learning)), behavior: avg(te.map((e) => e.behavior)), results: avg(te.map((e) => e.results)) }; });
    return { ...rd, impactByTrack: byTrack };
  }

  async reportCsv(key: string): Promise<{ name: string; csv: string } | null> {
    const esc = (v: unknown) => { const t = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const table = (head: string[], rows: unknown[][]) => "\uFEFF" + head.join(",") + "\n" + rows.map((r) => r.map(esc).join(",")).join("\n");
    switch (key) {
      case "executive": { const d = await this.dashboard(); return { name: "learning-executive", csv: table(["المؤشر", "القيمة"], [["المستفيدون", d.totals.beneficiaries], ["البرامج", d.totals.programs], ["الإنفاق التدريبي (مليون)", d.totals.spend], ["متوسط الإنجاز %", d.totals.avgCompletion], ["أثر التعلم %", d.totals.learningImpact], ["مؤشر جاهزية القدرات %", d.readiness.index], ["الفجوات الحرجة", d.readiness.criticalGaps]]) }; }
      case "english": { const d = await this.english(); return { name: "learning-english", csv: table(["الاسم", "الإدارة", "اختبار تحديد المستوى", "المستوى الحالي", "منصة التعلم", "مقدار التحسن", "نسبة الإنجاز"], d.map((e) => [e.nameAr, e.departmentAr, e.placementLevel ?? "لايوجد", e.currentLevel, e.platform, e.improvement, e.completion])) }; }
      case "postgraduate": { const d = await this.track("postgraduate"); return { name: "learning-postgraduate", csv: table(["الاسم", "الإدارة", "البرنامج", "الدرجة", "التخصص", "الحالة", "نسبة الإنجاز"], d.enrollments.map((e) => [e.nameAr, e.departmentAr, e.programName, e.kind, e.specializationAr, e.status, e.completion])) }; }
      case "leadership": { const d = await this.track("leadership"); return { name: "learning-leadership", csv: table(["المنصب", "القطاع", "الشاغل الحالي", "المرشح", "الجاهزية", "نسبة الجاهزية"], d.succession.map((x) => [x.positionAr, x.sectorName, x.incumbentAr, x.successor, x.readiness, x.readinessPct])) }; }
      case "providers": { const d = await this.providers(); return { name: "learning-providers", csv: table(["الجهة", "النوع", "الدولة", "معتمدة", "مؤشر التكلفة", "تقييم الجودة", "البرامج", "المشاركون", "الإنفاق (مليون)"], d.map((p) => [p.nameAr, p.type, p.countryAr, p.accredited ? "نعم" : "لا", p.costIndex, p.qualityScore, p.programs, p.participants, p.spend])) }; }
      case "skills": { const d = await this.readiness(); return { name: "learning-skills", csv: table(["المهارة", "القطاع", "الأهمية", "المطلوب", "المتوفر", "التغطية %", "إغلاق الفجوة %", "الجاهزية %"], d.skills.map((x) => [x.nameAr, x.sectorName, x.importance, x.required, x.covered, x.coverage, x.gapClosure, x.readiness])) }; }
      default: return null;
    }
  }
}
