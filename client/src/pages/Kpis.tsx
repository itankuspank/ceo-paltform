import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, Empty } from "@/components/ui";
import { fmtMoney, MONTHS_AR, RAG_LABEL } from "@shared/format";

type KpiRow = { id: number; code: string; nameAr: string; nameEn: string; goalId: number; goalName: string; unit: string; baseline: number; target: number; current: number; status: string; ownerSector: string | null; projectCount: number; attainment: number };
const tick = { fontSize: 10, fill: "#6B7672" };
const barTone = (st: string) => (st === "on_track" ? "green" : st === "at_risk" ? "amber" : "red") as "green" | "amber" | "red";

function KpiLibrary() {
  const { data, isLoading, error } = useQuery({ queryKey: ["kpis"], queryFn: () => api<KpiRow[]>("/api/kpis") });
  const [q, setQ] = useState(""); const [goal, setGoal] = useState("all"); const [st, setSt] = useState("all");
  const goals = useMemo(() => Array.from(new Map((data ?? []).map((k) => [k.goalId, k.goalName])).entries()), [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المؤشرات"} />;
  const list = data.filter((k) => (goal === "all" || String(k.goalId) === goal) && (st === "all" || k.status === st) && (!q || k.nameAr.includes(q) || k.code.toLowerCase().includes(q.toLowerCase())));
  const count = (s: string) => data.filter((k) => k.status === s).length;

  return (
    <div>
      <PageHeader title="مؤشرات الأداء" subtitle="Strategic KPIs" description="اضغط على أي مؤشر لعرض المبادرات المساهمة فيه وأسباب الانحراف." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي المؤشرات" value={data.length} sub="مؤشراً استراتيجياً" />
        <KpiCard label="مستقرة" value={count("on_track")} tone="green" sub="على المسار" />
        <KpiCard label="معرضة للخطر" value={count("at_risk")} tone="amber" sub="تتطلب متابعة" />
        <KpiCard label="متعثرة" value={count("off_track")} tone="red" sub="خارج المسار" />
      </div>
      <div className="card mt-4 px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المؤشرات…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
        </div>
        <select value={goal} onChange={(e) => setGoal(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1.5 text-[11.5px]">
          <option value="all">جميع الغايات</option>
          {goals.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {[["all", "الكل"], ["on_track", "أخضر"], ["at_risk", "برتقالي"], ["off_track", "أحمر"]].map(([v, l]) => (
            <button key={v} onClick={() => setSt(v)} className={`chip ${st === v ? "bg-brand text-white" : "bg-white border border-brand-border text-brand-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {list.length === 0 && <div className="col-span-3"><Empty label="لا توجد مؤشرات مطابقة" /></div>}
        {list.map((k) => (
          <Link key={k.id} to={`/kpis/${k.id}`} className="card px-4 py-3 hover:border-brand-green/50 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12.5px] font-bold leading-snug">{k.nameAr}</div>
              <StatusChip status={k.status} />
            </div>
            <div className="mt-2 text-[24px] font-bold num leading-none">{k.attainment}%</div>
            <div className="mt-1 text-[10.5px] text-brand-muted num">الأساس {k.baseline} · الحالي {k.current} · المستهدف {k.target} {k.unit !== "%" ? k.unit : ""}</div>
            <ProgressBar value={k.attainment} tone={barTone(k.status)} className="mt-2" />
            <div className="mt-1.5 text-[10.5px] text-brand-muted">{k.projectCount} مبادرة مساهمة · المالك: {k.ownerSector ?? "—"}</div>
          </Link>
        ))}
      </div>
      <SourcesFooter />
    </div>
  );
}

type Detail = {
  kpi: KpiRow & { goalNameEn: string; rootCauseAr: string | null };
  readings: { month: number; actual: number; target: number }[];
  projects: { id: number; code: string; nameAr: string; progress: number; status: string; budget: number | null; contributionTarget: number; contributionActual: number; attainment: number }[];
  gap: { toTarget: number; delayed: number; overBudget: number; investment: number };
};

function KpiDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["kpi", id], queryFn: () => api<Detail>(`/api/kpis/${id}`) });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المؤشر"} />;
  const k = data.kpi; const u = k.unit === "%" ? "%" : ` ${k.unit}`;
  const series = data.readings.map((r) => ({ ...r, name: MONTHS_AR[r.month - 1] }));
  return (
    <div>
      <PageHeader title={k.nameAr} subtitle={`${k.code} · ${k.goalNameEn}`}
        breadcrumb={<span><Link to="/strategy" className="hover:text-brand-green">الاستراتيجية</Link> ← <Link to="/kpis" className="hover:text-brand-green">مؤشرات الأداء</Link> ← {k.nameAr}</span>}
        description={<span className="flex items-center gap-2"><StatusChip status={k.status} /> الغاية الاستراتيجية: {k.goalName} · الجهة المالكة: {k.ownerSector ?? "—"}</span>} />
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="خط الأساس" value={`${k.baseline}${u}`} />
        <KpiCard label="المستهدف" value={`${k.target}${u}`} />
        <KpiCard label="القيمة الحالية" value={`${k.current}${u}`} tone="green" />
        <KpiCard label="نسبة التحقق" value={`${k.attainment}%`} tone={k.status === "on_track" ? "green" : k.status === "at_risk" ? "amber" : "red"} />
        <KpiCard label="المبادرات المساهمة" value={data.projects.length} sub="مبادرة" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="اتجاه الأداء الشهري" subtitle="المحقق مقابل المستهدف">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EEF0EC" />
                <XAxis dataKey="name" reversed tick={tick} axisLine={false} tickLine={false} />
                <YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                <Line type="monotone" dataKey="actual" name="المحقق" stroke="#0E3F36" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="target" name="المستهدف" stroke="#C9A227" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="col-span-2" title="تحليل الانحراف" subtitle="لماذا لم يتحقق المؤشر؟">
          <dl className="text-[12px] space-y-2">
            <div className="flex justify-between border-b border-brand-border pb-1.5"><dt className="text-brand-muted">الفجوة عن المستهدف</dt><dd className="font-bold text-rag-red num">{data.gap.toTarget}%</dd></div>
            <div className="flex justify-between border-b border-brand-border pb-1.5"><dt className="text-brand-muted">مبادرات متأخرة</dt><dd className="font-bold num">{data.gap.delayed}</dd></div>
            <div className="flex justify-between border-b border-brand-border pb-1.5"><dt className="text-brand-muted">مبادرات متجاوزة للميزانية</dt><dd className="font-bold num">{data.gap.overBudget}</dd></div>
            <div className="flex justify-between pb-1.5"><dt className="text-brand-muted">إجمالي الاستثمار المرتبط</dt><dd className="font-bold num">{fmtMoney(data.gap.investment)}</dd></div>
          </dl>
          {k.rootCauseAr && <div className="mt-3 rounded-md border border-[#EEDDB3] bg-rag-amberBg px-3 py-2 text-[11.5px] leading-relaxed"><span className="font-bold">الأسباب الرئيسية:</span> {k.rootCauseAr}</div>}
        </Panel>
      </div>
      <Panel className="mt-4" title="المبادرات المساهمة في المؤشر" subtitle="Drill-Down — من المؤشر إلى المبادرة إلى الأثر">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">
            <th className="py-1.5 text-right font-medium">المبادرة</th><th className="py-1.5 font-medium">الاستثمار</th><th className="py-1.5 font-medium w-40">الإنجاز</th><th className="py-1.5 font-medium">الحالة</th><th className="py-1.5 font-medium">المساهمة المستهدفة</th><th className="py-1.5 font-medium">الفعلية</th><th className="py-1.5 font-medium">نسبة تحقق الأثر</th>
          </tr></thead>
          <tbody>
            {data.projects.map((p) => (
              <tr key={p.id} className="border-b border-brand-border/70 last:border-0">
                <td className="py-2"><Link to={`/projects/${p.id}`} className="font-semibold hover:text-brand-green">{p.nameAr}</Link><div className="text-[10px] text-brand-muted font-mono">{p.code}</div></td>
                <td className="py-2 text-center num">{fmtMoney(p.budget ?? 0)}</td>
                <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={p.progress} tone="brand" className="flex-1" /><span className="num text-[10.5px] w-8">{p.progress}%</span></div></td>
                <td className="py-2 text-center"><Chip tone={p.status as any}>{RAG_LABEL[p.status]}</Chip></td>
                <td className="py-2 text-center num">+{p.contributionTarget}%</td>
                <td className="py-2 text-center num font-semibold">+{p.contributionActual}%</td>
                <td className="py-2 text-center num font-bold">{p.attainment}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <SourcesFooter />
    </div>
  );
}

export default function KpisRouter() {
  return (
    <Routes>
      <Route index element={<KpiLibrary />} />
      <Route path=":id" element={<KpiDetail />} />
    </Routes>
  );
}
