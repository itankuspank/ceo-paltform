import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter, Cell, ZAxis } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip } from "@/components/ui";
import { fmtMoney, fmtPct, MONTHS_AR } from "@shared/format";

type Impact = {
  kpis: { impact: number; target: number; forecast: number; investment: number };
  series: { month: number; actual: number; target: number; forecast: number }[];
  scatter: { id: number; nameAr: string; x: number; y: number; quadrant: string }[];
  quadrants: Record<string, number>;
  byGoal: { id: number; code: string; nameAr: string; nameEn: string; achievedImpact: number; investment: number }[];
  example: { nameAr: string; progress: number; impactTarget: number; impactAchieved: number; budget: number | null; actual: number | null; kpiName: string | null; deliverables: { nameAr: string; status: string }[]; forecastImpact: number; attainment: number } | null;
};

const Q_COLOR: Record<string, string> = { hi_hi: "#0F7A4E", hi_lo: "#C63B3B", lo_hi: "#C9A227", lo_lo: "#2F6F8F" };
const Q_LABEL: Record<string, string> = { hi_lo: "استثمار مرتفع + أثر منخفض", hi_hi: "استثمار مرتفع + أثر مرتفع", lo_lo: "استثمار منخفض + أثر منخفض", lo_hi: "استثمار منخفض + أثر مرتفع" };
const STAGES = ["الاستثمار", "المدخلات", "الأنشطة", "المخرجات", "النتائج", "الأثر"];
const tick = { fontSize: 10, fill: "#6B7672" };

export default function ImpactPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["impact"], queryFn: () => api<Impact>("/api/impact") });
  const [goalFilter, setGoalFilter] = useState<string>("all");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل شاشة الأثر"} />;
  const k = data.kpis;
  const series = data.series.map((p) => ({ ...p, name: MONTHS_AR[p.month - 1] }));
  const goals = goalFilter === "all" ? data.byGoal : data.byGoal.filter((g) => g.code === goalFilter);
  const ex = data.example;

  return (
    <div>
      <PageHeader title="الأثر الاستراتيجي" subtitle="Strategic Impact Management"
        description="الأثر المحقق هو القيمة الفعلية للاستثمارات في القطاع الحكومي: مقدار التغير الفعلي على مؤشرات الأداء نتيجة الاستثمارات." />

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="الأثر المحقق" value={fmtPct(k.impact)} tone="green" sub="من إجمالي الأثر المستهدف" />
        <KpiCard label="المستهدف نهاية العام" value={fmtPct(k.target)} sub="2026" />
        <KpiCard label="الأثر المتوقع عند الإكمال" value={fmtPct(k.forecast)} tone="green" sub="Forecast at completion" />
        <KpiCard label="الاستثمار المرتبط بالأثر" value={fmtMoney(k.investment)} sub="عبر جميع المحافظ" />
      </div>

      <Panel className="mt-4" title="الأثر المحقق مقابل المستهدف والتوقع" subtitle="Actual vs Target vs Forecast Impact">
        <div className="h-[240px]">
          <ResponsiveContainer>
            <ComposedChart data={series} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#EEF0EC" />
              <XAxis dataKey="name" reversed tick={tick} axisLine={false} tickLine={false} />
              <YAxis orientation="right" domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [`${v}%`, ""]} />
              <Line type="monotone" dataKey="actual" name="المحقق" stroke="#0E3F36" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="target" name="المستهدف" stroke="#C9A227" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="forecast" name="التوقع" stroke="#0F7A4E" strokeWidth={1.6} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 text-[10.5px] text-brand-muted mt-1">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /> المحقق</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-brand-gold" /> المستهدف</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dotted border-rag-green" /> التوقع</span>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="الاستثمار مقابل الأثر" subtitle="Investment vs Impact — أين تتركز القيمة؟ وأي المبادرات تستهلك استثماراً كبيراً دون أثر يوازيه؟">
          <div className="h-[260px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 10, left: 6, bottom: 4 }}>
                <CartesianGrid stroke="#EEF0EC" />
                <XAxis type="number" dataKey="x" name="الاستثمار" reversed tick={tick} axisLine={false} tickLine={false} unit="" />
                <YAxis type="number" dataKey="y" name="الأثر" orientation="right" domain={[0, 120]} tick={tick} axisLine={false} tickLine={false} width={30} />
                <ZAxis range={[40, 40]} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} cursor={{ strokeDasharray: "3 3" }}
                  formatter={(v, n) => (n === "الاستثمار" ? [fmtMoney(Number(v)), n] : [`${v}%`, "تحقق الأثر"])}
                  labelFormatter={() => ""} />
                <Scatter data={data.scatter} isAnimationActive={false}>
                  {data.scatter.map((p) => <Cell key={p.id} fill={Q_COLOR[p.quadrant]} fillOpacity={0.85} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-[10.5px]">
            {Object.keys(Q_LABEL).map((q) => (
              <div key={q} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: Q_COLOR[q] }} />
                <span className="font-bold num">{data.quadrants[q] ?? 0} مبادرة</span>
                <span className="text-brand-muted">{Q_LABEL[q]}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="col-span-2" title="الأثر حسب الهدف الاستراتيجي" subtitle="اختر الغاية لعرض تفاصيلها"
          actions={
            <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px]">
              <option value="all">جميع الغايات الاستراتيجية</option>
              {data.byGoal.map((g) => <option key={g.code} value={g.code}>{g.nameAr}</option>)}
            </select>
          }>
          <ul className="space-y-3">
            {goals.map((g) => (
              <li key={g.id} className="rounded-lg border border-brand-border px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold">{g.nameAr}</div>
                  <span className="text-[13px] font-bold num text-brand-green">{g.achievedImpact}%</span>
                </div>
                <ProgressBar value={g.achievedImpact} tone={g.achievedImpact >= 85 ? "green" : "gold"} className="mt-1.5" />
                <div className="text-[10px] text-brand-muted mt-1">الاستثمار: {fmtMoney(g.investment)}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {ex && (
        <Panel className="mt-4" title="إطار قياس الأثر — Impact Measurement Framework" subtitle={`مثال: ${ex.nameAr}`}>
          <div className="grid grid-cols-6 gap-2">
            {STAGES.map((st, i) => (
              <div key={st} className={i === STAGES.length - 1 ? "rounded-lg border-2 border-brand-gold bg-[#FBF6E7] px-3 py-2 text-center" : "rounded-lg border border-brand-border bg-brand-cream px-3 py-2 text-center"}>
                <div className="text-[10px] text-brand-muted">{i + 1}</div>
                <div className="text-[12px] font-bold">{st}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2 text-[12px]">
            <Row label="قيمة الاستثمار" value={fmtMoney(ex.budget ?? 0)} />
            <Row label="الأثر المستهدف" value={`+${ex.impactTarget}%`} />
            <Row label="المصروف الفعلي" value={fmtMoney(ex.actual ?? 0)} />
            <Row label="الأثر المحقق" value={`+${ex.impactAchieved}%`} strong />
            <Row label="المخرجات" value={`${ex.deliverables.filter((d) => d.status === "مكتمل").length} من ${ex.deliverables.length} مخرجات مكتملة`} />
            <Row label="الأثر المتوقع عند الاكتمال" value={`+${ex.forecastImpact}%`} strong />
            <Row label="المؤشر المرتبط" value={ex.kpiName ?? "—"} />
            <Row label="نسبة الإنجاز" value={`${ex.progress}%`} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Chip tone="gold">نسبة تحقيق الأثر = المحقق ÷ المستهدف × 100</Chip>
            <ProgressBar value={ex.attainment} tone="gold" className="flex-1" height="h-2.5" />
            <span className="text-[14px] font-bold num text-[#8A6A12]">{ex.attainment}%</span>
          </div>
        </Panel>
      )}
      <SourcesFooter />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-border py-1.5">
      <span className="text-brand-muted">{label}</span>
      <span className={strong ? "font-bold text-brand-green num" : "font-semibold num"}>{value}</span>
    </div>
  );
}
