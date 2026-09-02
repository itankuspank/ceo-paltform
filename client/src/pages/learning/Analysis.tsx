import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import clsx from "clsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, ProgressBar, Loading, ErrorBox, Chip, StatusChip } from "@/components/ui";
import { TRACK_LABEL } from "@/pages/Learning";

type Analysis = {
  index: number; status: string; criticalGaps: number;
  critical: { id: number; nameAr: string; sectorName: string; readiness: number }[];
  skills: { id: number; nameAr: string; sectorName: string; importance: string; required: number; covered: number; coverage: number; gapClosure: number; readiness: number }[];
  bySector: { sectorId: number; sectorName: string; readiness: number; skills: number }[];
  impactByTrack: { track: string; reaction: number | null; learning: number | null; behavior: number | null; results: number | null }[];
};
const IMP_TONE: Record<string, "off_track" | "at_risk" | "neutral"> = { "حرجة": "off_track", "عالية": "at_risk", "متوسطة": "neutral" };
const tick = { fontSize: 10, fill: "#6B7672" };

export function AnalysisPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-analysis"], queryFn: () => api<Analysis>("/api/learning/analysis") });
  const [imp, setImp] = useState("all");
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const skills = data.skills.filter((s) => imp === "all" || s.importance === imp).sort((a, b) => a.readiness - b.readiness);
  const chart = data.impactByTrack.map((t) => ({ name: TRACK_LABEL[t.track], التفاعل: t.reaction ?? 0, التعلّم: t.learning ?? 0, السلوك: t.behavior ?? 0, النتائج: t.results ?? 0 }));
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="مؤشر جاهزية القدرات" value={`${data.index}%`} tone={data.status === "on_track" ? "green" : data.status === "at_risk" ? "amber" : "red"} sub={<StatusChip status={data.status} />} />
        <KpiCard label="الفجوات الحرجة" value={data.criticalGaps} tone={data.criticalGaps ? "red" : "green"} sub="مهارات حرجة بجاهزية أقل من 80%" />
        <KpiCard label="المهارات المرصودة" value={data.skills.length} sub={`عبر ${data.bySector.length} قطاعات`} />
        <KpiCard label="متوسط إغلاق الفجوات" value={`${Math.round(data.skills.reduce((a, s) => a + s.gapClosure, 0) / data.skills.length)}%`} />
      </div>
      <div className="card mt-4 px-4 py-2.5 text-[11px] text-brand-muted">المعادلة المعتمدة: <span className="font-semibold text-brand-text">جاهزية المهارة = (نسبة التغطية × 60%) + (نسبة إغلاق الفجوة × 40%)</span> · المؤشر العام = متوسط جاهزية جميع المهارات · الفجوة الحرجة = مهارة بأهمية «حرجة» وجاهزية أقل من 80%</div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="مصفوفة المهارات والفجوات" subtitle="Skills matrix — مرتبة من الأقل جاهزية" actions={<select value={imp} onChange={(e) => setImp(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px]"><option value="all">جميع الأهميات</option><option value="حرجة">حرجة</option><option value="عالية">عالية</option><option value="متوسطة">متوسطة</option></select>}>
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المهارة", "القطاع", "الأهمية", "المطلوب/المتوفر", "التغطية", "إغلاق الفجوة", "الجاهزية"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
            <tbody>{skills.map((s) => (
              <tr key={s.id} className={clsx("border-b border-brand-border/70 last:border-0", s.importance === "حرجة" && s.readiness < 80 && "bg-rag-redBg/60")}>
                <td className="py-2 font-semibold">{s.nameAr}</td><td className="py-2 text-center text-brand-muted text-[10.5px]">{s.sectorName}</td><td className="py-2 text-center"><Chip tone={IMP_TONE[s.importance]}>{s.importance}</Chip></td>
                <td className="py-2 text-center num">{s.covered} / {s.required}</td><td className="py-2 text-center num">{s.coverage}%</td><td className="py-2 text-center num">{s.gapClosure}%</td>
                <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={s.readiness} className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-10 font-bold">{s.readiness}%</span></div></td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
        <div className="col-span-2 space-y-4">
          <Panel title="الجاهزية حسب القطاع" subtitle="Sector readiness">
            <ul className="space-y-2">{data.bySector.map((s) => <li key={s.sectorId}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{s.sectorName}</span><span className="num font-bold">{s.readiness}%</span></div><ProgressBar value={s.readiness} className="mt-1" /></li>)}</ul>
          </Panel>
          <Panel title="الفجوات الحرجة" subtitle="Critical gaps">{data.critical.length === 0 ? <div className="text-[11.5px] text-brand-muted">لا توجد فجوات حرجة</div> : <ul className="space-y-1">{data.critical.map((c) => <li key={c.id} className="flex items-center justify-between rounded-md border border-[#F0C9C9] bg-rag-redBg px-2.5 py-1.5 text-[11.5px]"><span className="font-semibold">{c.nameAr}</span><span className="num">{c.readiness}%</span></li>)}</ul>}</Panel>
        </div>
      </div>
      <Panel className="mt-4" title="قياس أثر التعلم حسب المسار" subtitle="Four-level impact by track — التفاعل · التعلّم · السلوك · النتائج">
        <div className="h-[240px]"><ResponsiveContainer><BarChart data={chart} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={16}>
          <CartesianGrid vertical={false} stroke="#EEF0EC" /><XAxis dataKey="name" reversed tick={tick} axisLine={false} tickLine={false} /><YAxis orientation="right" domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [`${v}%`, ""]} /><Legend wrapperStyle={{ fontSize: 10.5 }} />
          <Bar dataKey="التفاعل" fill="#8FB9A8" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="التعلّم" fill="#0F7A4E" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="السلوك" fill="#0E3F36" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="النتائج" fill="#C9A227" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer></div>
      </Panel>
    </div>
  );
}

const REPORTS = [
  { key: "executive", title: "الملخص التنفيذي للتطوير وبناء القدرات", desc: "المستفيدون، الإنفاق، أثر التعلم، ومؤشر جاهزية القدرات." },
  { key: "english", title: "تقرير مهارات اللغة الإنجليزية", desc: "سجل المشاركين بمستويات الاختبار والمستوى الحالي ومقدار التحسن." },
  { key: "postgraduate", title: "تقرير الابتعاث والدراسات العليا", desc: "المبتعثون وبرامجهم وتخصصاتهم ونسب الإنجاز." },
  { key: "leadership", title: "تقرير جاهزية القيادات والإحلال الوظيفي", desc: "خطط الإحلال والمرشحون ونسب الجاهزية." },
  { key: "providers", title: "تقرير الجهات التعليمية", desc: "الجهات والاعتماد والتكلفة وتقييم الجودة والإنفاق." },
  { key: "skills", title: "تقرير مصفوفة المهارات والفجوات", desc: "المهارات والتغطية وإغلاق الفجوات والجاهزية." },
];

export function ReportsPage() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">{REPORTS.map((r) => (
        <div key={r.key} className="card px-4 py-3.5 flex items-start justify-between gap-3">
          <div><div className="text-[13px] font-bold">{r.title}</div><div className="text-[11px] text-brand-muted mt-0.5">{r.desc}</div></div>
          <a href={`/api/learning/reports/${r.key}.csv`} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-hover shrink-0"><Download className="h-3.5 w-3.5" /> تصدير</a>
        </div>
      ))}</div>
      <div className="mt-4 card px-4 py-3 flex items-center justify-between"><div className="text-[12px]">طباعة الشاشة الحالية كتقرير تنفيذي (PDF عبر نافذة الطباعة)</div><button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-3 py-1.5 text-[11px] font-semibold hover:bg-brand-cream"><Printer className="h-3.5 w-3.5" /> طباعة</button></div>
      <div className="mt-2 text-[10px] text-brand-muted">التقارير تُصدَّر بترميز UTF-8 مع علامة BOM لتُفتح صحيحة في Excel داخل البيئة المعزولة.</div>
    </div>
  );
}
