import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { KpiCard, Panel, ProgressBar, Loading, ErrorBox, Chip, Empty } from "@/components/ui";

type Track = {
  programs: { id: number; code: string; nameAr: string; kind: string; startDate: string; endDate: string; cost: number; capacity: number; status: string; provider: string | null; providerCountry: string | null; sectorName: string | null; enrolled: number; completed: number; completion: number; totalCost: number; impact: number | null }[];
  enrollments: { id: number; resourceId: number; nameAr: string; roleAr: string; departmentAr: string; programName: string; kind: string; status: string; completion: number; specializationAr: string | null; reaction: number | null; learning: number | null; behavior: number | null; results: number | null }[];
  succession: { id: number; positionAr: string; sectorName: string; incumbentAr: string; successor: string | null; successorId: number | null; readiness: string; readinessPct: number }[];
  summary: { programs: number; participants: number; completed: number; spend: number; completion: number };
};
const ST: Record<string, "on_track" | "gold" | "neutral" | "off_track"> = { "مكتمل": "on_track", "جارٍ": "gold", "مسجل": "neutral", "مخطط": "neutral", "منسحب": "off_track" };
const useTrack = (t: string) => useQuery({ queryKey: ["learning-track", t], queryFn: () => api<Track>(`/api/learning/track/${t}`) });

function Summary({ d, spendLabel = "الإنفاق" }: { d: Track; spendLabel?: string }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <KpiCard label="البرامج" value={d.summary.programs} /><KpiCard label="المشاركون" value={d.summary.participants} sub="مستفيداً" /><KpiCard label="حالات الإتمام" value={d.summary.completed} tone="green" /><KpiCard label={spendLabel} value={`${d.summary.spend} مليون ريال`} sub={`متوسط الإنجاز ${d.summary.completion}%`} />
    </div>
  );
}
function ProgramsTable({ d, degree }: { d: Track; degree?: boolean }) {
  return (
    <Panel className="mt-4" title="البرامج" subtitle="Programmes">
      <table className="w-full text-[11.5px]">
        <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["البرنامج", degree ? "الدرجة" : "النوع", "الجهة", "الفترة", "المسجلون", "الإنجاز", "التكلفة", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
        <tbody>{d.programs.map((p) => (
          <tr key={p.id} className="border-b border-brand-border/70 last:border-0">
            <td className="py-2"><div className="font-semibold">{p.nameAr}</div><div className="text-[10px] text-brand-muted font-mono">{p.code}{p.sectorName ? ` · ${p.sectorName}` : ""}</div></td><td className="py-2 text-center">{p.kind}</td>
            <td className="py-2 text-center text-brand-muted text-[10.5px]">{p.provider ?? "—"}{p.providerCountry ? ` · ${p.providerCountry}` : ""}</td><td className="py-2 text-center num text-[10.5px]">{p.startDate} → {p.endDate}</td>
            <td className="py-2 text-center num">{p.enrolled} / {p.capacity}</td><td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={p.completion} tone="brand" className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-8">{p.completion}%</span></div></td>
            <td className="py-2 text-center num">{p.totalCost} مليون</td><td className="py-2 text-center"><Chip tone={ST[p.status]}>{p.status}</Chip></td>
          </tr>
        ))}</tbody>
      </table>
    </Panel>
  );
}
function ParticipantsTable({ d, spec }: { d: Track; spec?: boolean }) {
  return (
    <Panel className="mt-4" title="المشاركون" subtitle={`${d.enrollments.length} تسجيلاً — كل مستفيد مرتبط بسجله في الموارد`}>
      <div className="max-h-[420px] overflow-y-auto"><table className="w-full text-[11.5px]">
        <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المستفيد", "الإدارة", "البرنامج", spec ? "التخصص" : "النوع", "الإنجاز", "الأثر (4 مستويات)", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
        <tbody>{d.enrollments.map((e) => (
          <tr key={e.id} className="border-b border-brand-border/70 last:border-0">
            <td className="py-1.5"><Link to={`/learning/employees/${e.resourceId}`} className="font-semibold hover:text-brand-green">{e.nameAr}</Link><div className="text-[10px] text-brand-muted">{e.roleAr}</div></td><td className="py-1.5 text-center text-brand-muted text-[10.5px]">{e.departmentAr}</td>
            <td className="py-1.5 text-center text-[10.5px]">{e.programName}</td><td className="py-1.5 text-center">{spec ? e.specializationAr ?? "—" : e.kind}</td>
            <td className="py-1.5"><div className="flex items-center gap-2"><ProgressBar value={e.completion} tone="brand" className="flex-1 min-w-[50px]" /><span className="num text-[10.5px] w-8">{e.completion}%</span></div></td>
            <td className="py-1.5 text-center num text-[10.5px]">{[e.reaction, e.learning, e.behavior, e.results].map((v) => v ?? "—").join(" · ")}</td><td className="py-1.5 text-center"><Chip tone={ST[e.status]}>{e.status}</Chip></td>
          </tr>
        ))}</tbody>
      </table></div>
    </Panel>
  );
}

export function PostgraduatePage() {
  const { data, isLoading, error } = useTrack("postgraduate");
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const masters = data.enrollments.filter((e) => e.kind === "ماجستير").length; const phd = data.enrollments.filter((e) => e.kind === "دكتوراه").length;
  const specs = Array.from(data.enrollments.reduce((m, e) => m.set(e.specializationAr ?? "—", (m.get(e.specializationAr ?? "—") ?? 0) + 1), new Map<string, number>()));
  return (
    <div>
      <div className="grid grid-cols-4 gap-3"><KpiCard label="المبتعثون" value={data.summary.participants} sub="مبتعثاً" /><KpiCard label="ماجستير" value={masters} /><KpiCard label="دكتوراه" value={phd} tone="gold" /><KpiCard label="الإنفاق على الابتعاث" value={`${data.summary.spend} مليون ريال`} sub={`متوسط الإنجاز ${data.summary.completion}%`} /></div>
      <Panel className="mt-4" title="التخصصات" subtitle="Specialisations"><div className="flex flex-wrap gap-2">{specs.map(([s, n]) => <Chip key={s} tone="neutral">{s} · {n}</Chip>)}</div></Panel>
      <ProgramsTable d={data} degree /><ParticipantsTable d={data} spec />
    </div>
  );
}

export function LeadershipPage() {
  const { data, isLoading, error } = useTrack("leadership");
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const ready = data.succession.filter((x) => x.readiness === "جاهز الآن").length;
  const RT: Record<string, "on_track" | "gold" | "off_track"> = { "جاهز الآن": "on_track", "خلال سنة": "gold", "خلال سنتين": "off_track" };
  return (
    <div>
      <div className="grid grid-cols-4 gap-3"><KpiCard label="برامج إعداد القيادات" value={data.summary.programs} /><KpiCard label="القيادات المشاركة" value={data.summary.participants} /><KpiCard label="خطط الإحلال" value={data.succession.length} sub={`${ready} مرشح جاهز الآن`} tone="green" /><KpiCard label="جاهزية الصف الثاني" value={`${Math.round(data.succession.reduce((a, x) => a + x.readinessPct, 0) / (data.succession.length || 1))}%`} tone="gold" /></div>
      <Panel className="mt-4" title="خطط الإحلال الوظيفي وجاهزية الصف الثاني" subtitle="Succession plans — second-row readiness">
        {data.succession.length === 0 ? <Empty label="لا توجد خطط إحلال" /> : <table className="w-full text-[11.5px]">
          <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المنصب", "القطاع", "الشاغل الحالي", "المرشح", "الجاهزية", "نسبة الجاهزية"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{data.succession.map((x) => (
            <tr key={x.id} className="border-b border-brand-border/70 last:border-0">
              <td className="py-2 font-semibold">{x.positionAr}</td><td className="py-2 text-center text-brand-muted">{x.sectorName}</td><td className="py-2 text-center">{x.incumbentAr}</td>
              <td className="py-2 text-center">{x.successorId ? <Link to={`/learning/employees/${x.successorId}`} className="hover:text-brand-green font-semibold">{x.successor}</Link> : "—"}</td>
              <td className="py-2 text-center"><Chip tone={RT[x.readiness]}>{x.readiness}</Chip></td><td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={x.readinessPct} className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-8">{x.readinessPct}%</span></div></td>
            </tr>
          ))}</tbody>
        </table>}
      </Panel>
      <ProgramsTable d={data} /><ParticipantsTable d={data} />
    </div>
  );
}

export function ShortTrainingPage() {
  const { data, isLoading, error } = useTrack("short");
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const kinds = ["دورة", "ورشة", "شهادة احترافية"].map((k) => ({ k, n: data.programs.filter((p) => p.kind === k).length, e: data.enrollments.filter((x) => x.kind === k).length }));
  return (
    <div>
      <Summary d={data} />
      <div className="mt-4 grid grid-cols-3 gap-3">{kinds.map((x) => <div key={x.k} className="card px-4 py-3"><div className="text-[13px] font-bold">{x.k}</div><div className="text-[20px] font-bold num mt-1">{x.n} <span className="text-[11px] font-normal text-brand-muted">برنامجاً</span></div><div className="text-[10.5px] text-brand-muted">{x.e} تسجيلاً</div></div>)}</div>
      <ProgramsTable d={data} /><ParticipantsTable d={data} />
    </div>
  );
}
