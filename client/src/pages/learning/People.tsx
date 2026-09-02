import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { KpiCard, Panel, ProgressBar, Loading, ErrorBox, Chip, Empty } from "@/components/ui";
import { TRACK_LABEL, TRACK_TONE } from "@/pages/Learning";
import { MONTHS_AR } from "@shared/format";

// ================================================================ beneficiaries
type Emp = { resourceId: number; nameAr: string; roleAr: string; departmentAr: string; enrollments: number; completed: number; tracks: string[]; englishLevel: string | null; completion: number };

export function EmployeesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-employees"], queryFn: () => api<Emp[]>("/api/learning/employees") });
  const [q, setQ] = useState(""); const [dept, setDept] = useState("all");
  const depts = useMemo(() => Array.from(new Set((data ?? []).map((e) => e.departmentAr))), [data]);
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const list = data.filter((e) => (dept === "all" || e.departmentAr === dept) && (!q || e.nameAr.includes(q) || e.roleAr.includes(q)));
  return (
    <div>
      <div className="grid grid-cols-4 gap-3"><KpiCard label="المستفيدون" value={data.length} sub="مستمدون من سجل الموارد دون تكرار" /><KpiCard label="إجمالي التسجيلات" value={data.reduce((a, e) => a + e.enrollments, 0)} /><KpiCard label="حالات الإتمام" value={data.reduce((a, e) => a + e.completed, 0)} tone="green" /><KpiCard label="متوسط الإنجاز" value={`${Math.round(data.reduce((a, e) => a + e.completion, 0) / data.length)}%`} /></div>
      <Panel className="mt-4" title="سجل المستفيدين" subtitle="Beneficiary registry — اضغط على الاسم لعرض الملف التطويري" actions={<select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px]"><option value="all">جميع الإدارات</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>}>
        <div className="relative mb-2"><Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الدور…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" /></div>
        <div className="max-h-[560px] overflow-y-auto"><table className="w-full text-[11.5px]">
          <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المستفيد", "الإدارة", "المسارات", "التسجيلات", "الإتمام", "الإنجاز", "الإنجليزية"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{list.map((e) => (
            <tr key={e.resourceId} className="border-b border-brand-border/70 last:border-0 hover:bg-brand-cream/60">
              <td className="py-1.5"><Link to={`/learning/employees/${e.resourceId}`} className="font-semibold hover:text-brand-green">{e.nameAr}</Link><div className="text-[10px] text-brand-muted">{e.roleAr}</div></td><td className="py-1.5 text-center text-brand-muted text-[10.5px]">{e.departmentAr}</td>
              <td className="py-1.5 text-center"><span className="flex flex-wrap gap-1 justify-center">{e.tracks.map((t) => <Chip key={t} tone={TRACK_TONE[t]}>{TRACK_LABEL[t]}</Chip>)}</span></td>
              <td className="py-1.5 text-center num">{e.enrollments}</td><td className="py-1.5 text-center num">{e.completed}</td>
              <td className="py-1.5"><div className="flex items-center gap-2"><ProgressBar value={e.completion} tone="brand" className="flex-1 min-w-[50px]" /><span className="num text-[10.5px] w-8">{e.completion}%</span></div></td>
              <td className="py-1.5 text-center num font-bold">{e.englishLevel ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}

// ================================================================ profile
type Profile = {
  resource: { id: number; nameAr: string; roleAr: string; departmentAr: string; capacityHours: number; hourlyCost: number };
  enrollments: { id: number; programName: string; track: string; kind: string; status: string; completion: number; placementLevel: string | null; currentLevel: string | null; platform: string | null; specializationAr: string | null; reaction: number | null; learning: number | null; behavior: number | null; results: number | null }[];
  succession: { positionAr: string; readiness: string; readinessPct: number }[];
  gaps: string[];
  impact: { reaction: number | null; learning: number | null; behavior: number | null; results: number | null };
};

export function EmployeeProfilePage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-employee", id], queryFn: () => api<Profile>(`/api/learning/employees/${id}`) });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const r = data.resource; const eng = data.enrollments.find((e) => e.track === "english");
  return (
    <div>
      <Link to="/learning/employees" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green mb-3"><ArrowRight className="h-3 w-3" /> سجل المستفيدين</Link>
      <div className="card px-5 py-4 flex items-start justify-between">
        <div><div className="text-[18px] font-bold">{r.nameAr}</div><div className="text-[11.5px] text-brand-muted">{r.roleAr} · {r.departmentAr} · مرتبط بسجل الموارد #{r.id}</div>
          <div className="mt-2 flex flex-wrap gap-1">{Array.from(new Set(data.enrollments.map((e) => e.track))).map((t) => <Chip key={t} tone={TRACK_TONE[t]}>{TRACK_LABEL[t]}</Chip>)}{data.succession.map((s) => <Chip key={s.positionAr} tone="gold">مرشح إحلال: {s.positionAr} · {s.readinessPct}%</Chip>)}</div></div>
        {eng && <div className="text-center rounded-lg border border-brand-border bg-brand-cream px-4 py-2"><div className="text-[10px] text-brand-muted">اللغة الإنجليزية</div><div className="text-[18px] font-bold num">{eng.placementLevel ?? "—"} ← {eng.currentLevel}</div><div className="text-[10px] text-brand-muted">{eng.platform}</div></div>}
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="المسارات التدريبية" subtitle="Development journey">
          {data.enrollments.length === 0 ? <Empty label="لا توجد تسجيلات" /> : <ul className="space-y-2">{data.enrollments.map((e) => (
            <li key={e.id} className="rounded-lg border border-brand-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-2"><div className="text-[12px] font-semibold">{e.programName}</div><Chip tone={e.status === "مكتمل" ? "on_track" : e.status === "جارٍ" ? "gold" : "neutral"}>{e.status}</Chip></div>
              <div className="text-[10px] text-brand-muted mt-0.5">{e.kind}{e.specializationAr ? ` · ${e.specializationAr}` : ""}{e.currentLevel ? ` · المستوى ${e.currentLevel}` : ""}</div>
              <div className="flex items-center gap-2 mt-1.5"><ProgressBar value={e.completion} tone="brand" className="flex-1" /><span className="num text-[10.5px]">{e.completion}%</span></div>
            </li>
          ))}</ul>}
        </Panel>
        <div className="col-span-2 space-y-4">
          <Panel title="الأثر المقاس" subtitle="Four-level impact">
            {[["التفاعل والرضا", data.impact.reaction], ["التعلّم", data.impact.learning], ["السلوك", data.impact.behavior], ["النتائج والأثر", data.impact.results]].map(([l, v]) => (
              <div key={l as string} className="mb-2"><div className="flex justify-between text-[11px]"><span>{l as string}</span><span className="num font-bold">{v === null ? "لم يُقَس بعد" : `${v}%`}</span></div><ProgressBar value={(v as number) ?? 0} className="mt-1" /></div>
            ))}
          </Panel>
          <Panel title="الفجوات التطويرية" subtitle="Gaps">{data.gaps.length === 0 ? <Empty label="لا توجد فجوات مرصودة" /> : <ul className="space-y-1">{data.gaps.map((g) => <li key={g} className="rounded-md border border-[#EEDDB3] bg-rag-amberBg px-2.5 py-1.5 text-[11.5px]">{g}</li>)}</ul>}</Panel>
        </div>
      </div>
    </div>
  );
}

// ================================================================ providers
type Provider = { id: number; nameAr: string; type: string; countryAr: string; accredited: boolean; costIndex: number; qualityScore: number; programs: number; participants: number; spend: number; completion: number; satisfaction: number | null };

export function ProvidersPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-providers"], queryFn: () => api<Provider[]>("/api/learning/providers") });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3"><KpiCard label="الجهات التعليمية" value={data.length} /><KpiCard label="جامعات" value={data.filter((p) => p.type === "جامعة").length} /><KpiCard label="مراكز ومنصات" value={data.filter((p) => p.type !== "جامعة").length} /><KpiCard label="متوسط تقييم الجودة" value={`${Math.round(data.reduce((a, p) => a + p.qualityScore, 0) / data.length)}%`} tone="green" /></div>
      <Panel className="mt-4" title="الجهات التعليمية والتدريبية" subtitle="Universities, training centres, learning platforms — cost & quality">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["الجهة", "النوع", "الدولة", "الاعتماد", "التكلفة", "الجودة", "البرامج", "المشاركون", "الإنفاق", "الرضا"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{data.map((p) => (
            <tr key={p.id} className="border-b border-brand-border/70 last:border-0">
              <td className="py-2 font-semibold">{p.nameAr}</td><td className="py-2 text-center">{p.type}</td><td className="py-2 text-center text-brand-muted text-[10.5px]">{p.countryAr}</td><td className="py-2 text-center"><Chip tone={p.accredited ? "on_track" : "at_risk"}>{p.accredited ? "معتمدة" : "غير معتمدة"}</Chip></td>
              <td className="py-2 text-center">{"●".repeat(p.costIndex)}<span className="text-brand-border">{"●".repeat(5 - p.costIndex)}</span></td>
              <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={p.qualityScore} className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-8">{p.qualityScore}%</span></div></td>
              <td className="py-2 text-center num">{p.programs}</td><td className="py-2 text-center num">{p.participants}</td><td className="py-2 text-center num">{p.spend} مليون</td><td className="py-2 text-center num">{p.satisfaction ?? "—"}{p.satisfaction ? "%" : ""}</td>
            </tr>
          ))}</tbody>
        </table>
      </Panel>
    </div>
  );
}

// ================================================================ calendar
type Cal = { id: number; nameAr: string; track: string; kind: string; startDate: string; endDate: string; capacity: number; status: string; provider: string | null; enrolled: number; registrationOpen: boolean };

export function CalendarPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-calendar"], queryFn: () => api<Cal[]>("/api/learning/calendar") });
  const [track, setTrack] = useState("all");
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const list = data.filter((p) => track === "all" || p.track === track);
  const months = Array.from(list.reduce((m, p) => { const k = p.startDate.slice(0, 7); (m.get(k) ?? m.set(k, []).get(k)!).push(p); return m; }, new Map<string, Cal[]>())).sort(([a], [b]) => a.localeCompare(b));
  const label = (ym: string) => `${MONTHS_AR[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3"><KpiCard label="البرامج المجدولة" value={data.length} /><KpiCard label="جارية الآن" value={data.filter((p) => p.status === "جارٍ").length} tone="green" /><KpiCard label="قادمة" value={data.filter((p) => p.status === "مخطط").length} tone="gold" /><KpiCard label="التسجيل مفتوح" value={data.filter((p) => p.registrationOpen).length} /></div>
      <div className="card mt-4 px-4 py-2 flex items-center gap-1.5">{["all", "english", "postgraduate", "leadership", "short"].map((t) => <button key={t} onClick={() => setTrack(t)} className={clsx("chip border", track === t ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{t === "all" ? "الكل" : TRACK_LABEL[t]}</button>)}</div>
      <div className="mt-4 space-y-4">{months.map(([ym, ps]) => (
        <Panel key={ym} title={label(ym)} subtitle={`${ps.length} برامج`}>
          <ul className="space-y-1.5">{ps.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-brand-border px-3 py-2">
              <div className="min-w-0"><div className="text-[12px] font-semibold truncate">{p.nameAr}</div><div className="text-[10px] text-brand-muted">{p.kind} · {p.provider ?? "—"} · {p.startDate} → {p.endDate}</div></div>
              <div className="flex items-center gap-2 shrink-0"><Chip tone={TRACK_TONE[p.track]}>{TRACK_LABEL[p.track]}</Chip><span className="text-[10.5px] num text-brand-muted">{p.enrolled}/{p.capacity} مقعداً</span><Chip tone={p.status === "مكتمل" ? "on_track" : p.status === "جارٍ" ? "gold" : "neutral"}>{p.status}</Chip>{p.registrationOpen && <Chip tone="blue">التسجيل مفتوح</Chip>}</div>
            </li>
          ))}</ul>
        </Panel>
      ))}</div>
    </div>
  );
}
