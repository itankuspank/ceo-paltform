import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ZAxis, ComposedChart, Line } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip } from "@/components/ui";
import { fmtMoney, MONTHS_AR } from "@shared/format";

type Factors = { alignment: number; impact: number; benefits: number; mandate: number; feasibility: number };
type Proj = { id: number; code: string; nameAr: string; status: string; budget: number; impactAttainment: number; factors: Factors };
type Payload = { projects: Proj[]; forecast: { month: number; actual: number | null; forecast: number; target: number }[]; forecastGap: number };

const WEIGHTS: { key: keyof Factors; label: string; def: number }[] = [
  { key: "alignment", label: "الموائمة الاستراتيجية", def: 30 }, { key: "impact", label: "المساهمة في الأثر", def: 25 }, { key: "benefits", label: "المنافع المتوقعة", def: 20 },
  { key: "mandate", label: "الإلزام والأولوية", def: 15 }, { key: "feasibility", label: "قابلية التنفيذ", def: 10 },
];
const tick = { fontSize: 10, fill: "#6B7672" };
const COLOR: Record<string, string> = { on_track: "#0F7A4E", at_risk: "#C9A227", off_track: "#C63B3B" };

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["analytics"], queryFn: () => api<Payload>("/api/analytics") });
  const [w, setW] = useState<Record<keyof Factors, number>>(Object.fromEntries(WEIGHTS.map((x) => [x.key, x.def])) as any);
  const total = WEIGHTS.reduce((a, x) => a + w[x.key], 0);
  const scored = useMemo(() => (data?.projects ?? []).map((p) => ({ ...p, score: Math.round((WEIGHTS.reduce((a, x) => a + p.factors[x.key] * w[x.key], 0) / Math.max(total, 1)) * 10) / 10 })).sort((a, b) => b.score - a.score), [data, w, total]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل التحليلات"} />;
  const avg = Math.round((scored.reduce((a, p) => a + p.score, 0) / scored.length) * 10) / 10;
  const high = scored.filter((p) => p.score >= 85).length; const review = scored.filter((p) => p.score < 60).length;
  const maxBudget = Math.max(...scored.map((p) => p.budget), 1);
  const scatter = scored.map((p) => ({ ...p, effort: Math.round((p.budget / maxBudget) * 100), value: p.score }));
  const series = data.forecast.map((f) => ({ ...f, name: MONTHS_AR[f.month - 1] }));

  return (
    <div>
      <PageHeader title="تحليل المحافظ والأولويات" subtitle="Portfolio Analytics & Prioritization" description="نموذج تقييم المبادرات الجديدة وترتيبها وفق أوزان استراتيجية معتمدة." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="مبادرات مقيّمة" value={scored.length} />
        <KpiCard label="متوسط درجة الأولوية" value={`${avg}%`} />
        <KpiCard label="مبادرات عالية الأولوية" value={high} tone="green" sub="درجة 85 فأعلى" />
        <KpiCard label="مبادرات مرشحة لإعادة النظر" value={review} tone="red" sub="درجة أقل من 60" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-2" title="نموذج الأوزان" subtitle="حرّك الأوزان لإعادة احتساب الدرجات فورياً">
          <div className="space-y-3">{WEIGHTS.map((x) => (
            <div key={x.key}>
              <div className="flex justify-between text-[11.5px]"><span>{x.label}</span><span className="font-bold num">{w[x.key]}%</span></div>
              <input type="range" min={0} max={50} value={w[x.key]} onChange={(e) => setW({ ...w, [x.key]: Number(e.target.value) })} className="w-full accent-brand-green" />
            </div>
          ))}</div>
          <div className={`mt-2 text-[10.5px] ${total === 100 ? "text-brand-muted" : "text-rag-red"}`}>مجموع الأوزان = {total}% {total !== 100 && "— يُحتسب التطبيع تلقائياً"} · الدرجة = Σ (العامل × الوزن) ÷ مجموع الأوزان</div>
          <button onClick={() => setW(Object.fromEntries(WEIGHTS.map((x) => [x.key, x.def])) as any)} className="mt-2 text-[11px] font-semibold text-brand-green">إعادة الأوزان المعتمدة</button>
        </Panel>
        <Panel className="col-span-3" title="مصفوفة المقارنة بين المبادرات" subtitle="القيمة الاستراتيجية (الدرجة) مقابل الجهد (الاستثمار النسبي)">
          <div className="h-[280px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 10, left: 6, bottom: 4 }}>
                <CartesianGrid stroke="#EEF0EC" />
                <XAxis type="number" dataKey="effort" name="الجهد" reversed domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="value" name="الدرجة" orientation="right" domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} width={30} />
                <ZAxis range={[36, 36]} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [`${v}%`, n === "الجهد" ? "الاستثمار النسبي" : "درجة الأولوية"]} labelFormatter={() => ""} />
                <Scatter data={scatter} isAnimationActive={false}>{scatter.map((p) => <Cell key={p.id} fill={COLOR[p.status]} fillOpacity={0.85} />)}</Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="أعلى المبادرات في درجة الأولوية الاستراتيجية" subtitle="Strategic Priority Score / 100">
          <ol className="space-y-2">{scored.slice(0, 10).map((p, i) => (
            <li key={p.id}>
              <div className="flex items-center justify-between gap-3"><Link to={`/projects/${p.id}`} className="text-[12px] font-semibold truncate hover:text-brand-green">{i + 1}. {p.nameAr}</Link><span className="text-[12.5px] font-bold num">{p.score}</span></div>
              <div className="flex items-center gap-3 mt-0.5"><ProgressBar value={p.score} tone="gold" className="flex-1" /><span className="text-[10px] text-brand-muted whitespace-nowrap num">{fmtMoney(p.budget)} · تحقق الأثر {p.impactAttainment}%</span></div>
            </li>
          ))}</ol>
        </Panel>
        <Panel className="col-span-2" title="التوقعات" subtitle="Forecast — الأثر المتوقع حتى نهاية العام">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EEF0EC" />
                <XAxis dataKey="name" reversed tick={{ fontSize: 9, fill: "#6B7672" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis orientation="right" domain={[60, 100]} tick={tick} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                <Line type="monotone" dataKey="actual" name="المحقق" stroke="#0E3F36" strokeWidth={2.2} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" name="التوقع" stroke="#0F7A4E" strokeWidth={1.6} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="target" name="المستهدف" stroke="#C9A227" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1"><Chip tone="gold">فجوة متوقعة {data.forecastGap} نقطة عن المستهدف نهاية العام</Chip></div>
        </Panel>
      </div>
      <SourcesFooter />
    </div>
  );
}
