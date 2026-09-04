import { useQuery } from "@tanstack/react-query";
import { NavLink, Link, Route, Routes } from "react-router-dom";
import clsx from "clsx";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip } from "@/components/ui";
import EnglishPage from "./learning/English";
import { PostgraduatePage, LeadershipPage, ShortTrainingPage } from "./learning/Tracks";
import { EmployeesPage, EmployeeProfilePage, ProvidersPage, CalendarPage } from "./learning/People";
import { AnalysisPage, ReportsPage } from "./learning/Analysis";

export const TRACK_LABEL: Record<string, string> = { english: "اللغة الإنجليزية", postgraduate: "الدراسات العليا", leadership: "تطوير القادة", short: "التدريب القصير" };
export const TRACK_TONE: Record<string, "blue" | "gold" | "on_track" | "neutral"> = { english: "blue", postgraduate: "gold", leadership: "on_track", short: "neutral" };

const TABS = [["", "اللوحة التنفيذية"], ["english", "اللغة الإنجليزية"], ["postgraduate", "الدراسات العليا"], ["leadership", "تطوير القادة"], ["short-training", "التدريب القصير"], ["employees", "المستفيدون"], ["providers", "الجهات التعليمية"], ["calendar", "تقويم البرامج"], ["analysis", "تحليل القدرات"], ["reports", "التقارير"]] as const;

export function ModuleNav() {
  return (
    <div className="card px-2 py-1.5 mb-4 flex flex-wrap gap-1">
      {TABS.map(([path, label]) => <NavLink key={path} to={`/learning${path ? `/${path}` : ""}`} end={path === ""} className={({ isActive }) => clsx("rounded-md px-3 py-1.5 text-[11.5px] whitespace-nowrap", isActive ? "bg-brand text-white font-semibold" : "text-brand-muted hover:text-brand-text hover:bg-brand-cream")}>{label}</NavLink>)}
    </div>
  );
}

type Dash = {
  totals: { beneficiaries: number; programs: number; spend: number; avgCompletion: number; active: number; learningImpact: number };
  readiness: { index: number; status: string; criticalGaps: number };
  tracks: { track: string; participants: number; programs: number; completion: number; completed: number }[];
  impact: { reaction: number | null; learning: number | null; behavior: number | null; results: number | null };
  upcoming: { id: number; nameAr: string; track: string; kind: string; startDate: string; capacity: number; provider: string | null }[];
  bySector: { sectorId: number; sectorName: string; readiness: number; skills: number }[];
  english: { participants: number; b2plus: number; improved: number };
};
const LEVELS = [["reaction", "المستوى 1 · التفاعل والرضا"], ["learning", "المستوى 2 · التعلّم"], ["behavior", "المستوى 3 · السلوك"], ["results", "المستوى 4 · النتائج والأثر"]] as const;

function LearningDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-dashboard"], queryFn: () => api<Dash>("/api/learning/dashboard") });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل لوحة التطوير"} />;
  const t = data.totals; const rd = data.readiness;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="المستفيدون من برامج التطوير" value={t.beneficiaries} sub="موظفاً — مرتبطون بسجل الموارد" />
        <KpiCard label="الإنفاق التدريبي" value={`${t.spend} مليون ريال`} sub={`${t.programs} برنامجاً · ${t.active} جارٍ`} />
        <KpiCard label="أثر التعلم" value={`${t.learningImpact}%`} tone="green" sub="متوسط المستويات الأربعة" />
        <KpiCard label="مؤشر جاهزية القدرات" value={`${rd.index}%`} tone={rd.status === "on_track" ? "green" : rd.status === "at_risk" ? "amber" : "red"} sub={`${rd.criticalGaps} فجوات حرجة`} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {data.tracks.map((tr) => (
          <Link key={tr.track} to={`/learning/${tr.track === "short" ? "short-training" : tr.track}`} className="card px-4 py-3 hover:border-brand-green/50">
            <div className="flex items-center justify-between"><div className="text-[13px] font-bold">{TRACK_LABEL[tr.track]}</div><Chip tone={TRACK_TONE[tr.track]}>{tr.programs} برامج</Chip></div>
            <div className="mt-2 text-[20px] font-bold num">{tr.participants} <span className="text-[11px] font-normal text-brand-muted">مشاركاً</span></div>
            <div className="flex items-center gap-2 mt-1.5"><ProgressBar value={tr.completion} tone="brand" className="flex-1" /><span className="text-[10.5px] num">{tr.completion}%</span></div>
            <div className="text-[10px] text-brand-muted mt-1">{tr.completed} إتمام</div>
          </Link>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-2" title="نموذج قياس أثر التعلم" subtitle="Four-level impact model — متوسط جميع البرامج">
          <div className="space-y-3">{LEVELS.map(([k, l]) => (
            <div key={k}><div className="flex justify-between text-[11.5px]"><span>{l}</span><span className="font-bold num">{data.impact[k] ?? "—"}{data.impact[k] !== null ? "%" : ""}</span></div><ProgressBar value={data.impact[k] ?? 0} tone={k === "results" ? "gold" : "green"} className="mt-1" /></div>
          ))}</div>
          <div className="mt-3 text-[10px] text-brand-muted">المستويان 3 و4 يُقاسان بعد الإتمام بفترة؛ لذا تكون قيمهما أقل بطبيعتها.</div>
        </Panel>
        <Panel className="col-span-3" title="جاهزية القدرات حسب القطاع" subtitle="Capability readiness by sector — جاهزية المهارة = التغطية × 60% + إغلاق الفجوة × 40%" actions={<Link to="/learning/analysis" className="text-[11px] font-semibold text-brand-green">تحليل القدرات</Link>}>
          <ul className="space-y-2">{data.bySector.map((sct) => (
            <li key={sct.sectorId}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{sct.sectorName} <span className="text-brand-muted font-normal">· {sct.skills} مهارات</span></span><span className="num font-bold">{sct.readiness}%</span></div><ProgressBar value={sct.readiness} className="mt-1" /></li>
          ))}</ul>
        </Panel>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="البرامج القادمة" subtitle="Upcoming programmes" actions={<Link to="/learning/calendar" className="text-[11px] font-semibold text-brand-green">تقويم البرامج</Link>}>
          <ul className="divide-y divide-brand-border">{data.upcoming.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2"><div><div className="text-[12px] font-semibold">{p.nameAr}</div><div className="text-[10px] text-brand-muted">{p.kind} · {p.provider ?? "—"} · يبدأ {p.startDate} · {p.capacity} مقعداً</div></div><Chip tone={TRACK_TONE[p.track]}>{TRACK_LABEL[p.track]}</Chip></li>
          ))}</ul>
        </Panel>
        <Panel className="col-span-2" title="اللغة الإنجليزية — نظرة سريعة" subtitle="English track snapshot" actions={<Link to="/learning/english" className="text-[11px] font-semibold text-brand-green">اللوحة الكاملة</Link>}>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["المشاركون", data.english.participants], ["B2 فأعلى", data.english.b2plus], ["المتحسنون", data.english.improved]].map(([l, v]) => <div key={l as string} className="rounded-lg border border-brand-border bg-brand-cream px-2 py-2"><div className="text-[18px] font-bold num">{v as number}</div><div className="text-[10px] text-brand-muted">{l as string}</div></div>)}
          </div>
          <div className="mt-3"><div className="flex justify-between text-[11px]"><span className="text-brand-muted">نسبة المستوفين لمستوى B2 فأعلى</span><span className="font-bold num">{Math.round((data.english.b2plus / data.english.participants) * 100)}%</span></div><ProgressBar value={(data.english.b2plus / data.english.participants) * 100} tone="brand" className="mt-1" /></div>
        </Panel>
      </div>
    </div>
  );
}

export default function LearningRouter() {
  return (
    <div>
      <PageHeader title="تطوير وبناء القدرات" subtitle="Capability Development — Learning & Impact" description="إدارة منظومة التطوير وربط الاستثمار التدريبي بالأثر المحقق على مستوى المبادرات والأهداف." />
      <ModuleNav />
      <Routes>
        <Route index element={<LearningDashboard />} />
        <Route path="english" element={<EnglishPage />} />
        <Route path="postgraduate" element={<PostgraduatePage />} />
        <Route path="leadership" element={<LeadershipPage />} />
        <Route path="short-training" element={<ShortTrainingPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Routes>
      <SourcesFooter />
    </div>
  );
}
export { StatusChip };
