import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, Clock } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, BarChart, Bar, LabelList,
} from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, Chip, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox } from "@/components/ui";
import { fmtMoney, fmtPct, MONTHS_AR } from "@shared/format";

type Overview = {
  kpis: { investment: number; impact: number; portfolios: number; projects: number; kpiCount: number; kpisAtRisk: number; pendingDecisions: number; forecastImpact: number; targetImpact: number; programs: number; lastSync: string | null };
  impactSeries: { month: number; actual: number; target: number }[];
  portfolioHealth: { status: "on_track" | "at_risk" | "off_track"; value: number }[];
  impactByGoal: { code: string; nameAr: string; nameEn: string; achieved: number; target: number; investment: number }[];
  topInitiatives: { id: number; code: string; nameAr: string; impactAchieved: number; budget: number | null; status: string; share: number }[];
  attention: { id: number; code: string; titleAr: string; type: string; priority: string; amount: number | null; ownerAr: string; dueDate: string; impactNoteAr: string | null; projectName: string | null }[];
  kpisAtRisk: { id: number; code: string; nameAr: string; status: string; current: number; target: number; unit: string }[];
};

const HEALTH_COLORS = { on_track: "#0F7A4E", at_risk: "#D99B2B", off_track: "#C63B3B" } as const;
const HEALTH_LABEL = { on_track: "على المسار", at_risk: "معرض للخطر", off_track: "خارج المسار" } as const;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function OverviewPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/api/overview") });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل النظرة التنفيذية"} />;
  const k = data.kpis;
  const series = data.impactSeries.map((p) => ({ ...p, name: MONTHS_AR[p.month - 1] }));

  return (
    <div>
      <PageHeader
        title="النظرة التنفيذية" subtitle="CEO Executive Overview"
        description="ما هو الأثر الاستراتيجي الذي نحققه مقابل الاستثمارات والمبادرات التي تنفذها الوزارة؟"
        actions={
          <div className="flex items-center gap-2">
            <Chip tone="gold"><Clock className="h-3 w-3" /> آخر تحديث للبيانات: {fmtDate(k.lastSync)}</Chip>
            <Chip>{fmtTime(k.lastSync)}</Chip>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي الاستثمارات الاستراتيجية" value={fmtMoney(k.investment)} sub={`عبر ${k.portfolios} محافظ و${k.programs} برنامجاً`} />
        <KpiCard label="نسبة الأثر المحقق" value={fmtPct(k.impact)} sub={`مقابل مستهدف ${k.targetImpact}% نهاية العام`} tone="green" />
        <KpiCard label="المحافظ الاستراتيجية" value={k.portfolios} sub={`${k.programs} برنامجاً`} />
        <KpiCard label="المبادرات والمشاريع" value={k.projects} sub="مبادرة ومشروع" />
        <KpiCard label="مؤشرات الأداء الاستراتيجية" value={k.kpiCount} sub="مؤشراً" />
        <KpiCard label="مؤشرات خارج المسار" value={k.kpisAtRisk} sub="تتطلب تدخلاً" tone="red" />
        <KpiCard label="القرارات المعلقة" value={k.pendingDecisions} sub="بانتظار اعتماد القيادة" tone="amber" />
        <KpiCard label="الأثر المتوقع عند الإكمال" value={fmtPct(k.forecastImpact)} sub="Forecast at completion" tone="green" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Panel className="col-span-2" title="الأثر المحقق مقابل المستهدف" subtitle="Actual Impact vs Target Impact — 2026">
          <div className="h-[230px]">
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="impactFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F6B4B" stopOpacity={0.22} /><stop offset="100%" stopColor="#0F6B4B" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF0EC" />
                <XAxis dataKey="name" reversed tick={{ fontSize: 10, fill: "#6B7672" }} axisLine={false} tickLine={false} />
                <YAxis orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#6B7672" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [`${v}%`, ""]} />
                <Area type="monotone" dataKey="actual" stroke="none" fill="url(#impactFill)" isAnimationActive={false} />
                <Line type="monotone" dataKey="actual" name="الأثر المحقق" stroke="#0E3F36" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="target" name="المستهدف" stroke="#C9A227" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[10.5px] text-brand-muted mt-1">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand" /> الأثر المحقق</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-brand-gold" /> المستهدف</span>
          </div>
        </Panel>

        <Panel title="صحة المحفظة" subtitle="Portfolio Health">
          <div className="flex items-center gap-4">
            <div className="h-[170px] w-[170px] shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.portfolioHealth} dataKey="value" nameKey="status" innerRadius={52} outerRadius={78} startAngle={90} endAngle={-270} paddingAngle={2} isAnimationActive={false}>
                    {data.portfolioHealth.map((h) => <Cell key={h.status} fill={HEALTH_COLORS[h.status]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-[12px]">
              {data.portfolioHealth.map((h) => (
                <li key={h.status} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH_COLORS[h.status] }} />
                  <span className="font-bold num w-9">{h.value}%</span>
                  <span className="text-brand-muted">{HEALTH_LABEL[h.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Panel title="الأثر حسب الهدف الاستراتيجي" subtitle="Impact by Strategic Goal">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={data.impactByGoal} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={16}>
                <CartesianGrid horizontal={false} stroke="#EEF0EC" />
                <XAxis type="number" domain={[0, 100]} reversed tick={{ fontSize: 10, fill: "#6B7672" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nameAr" orientation="right" width={120} tick={{ fontSize: 10.5, fill: "#1F2A26" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [`${v}%`, "الأثر المحقق"]} />
                <Bar dataKey="achieved" radius={[3, 3, 3, 3]} isAnimationActive={false}>
                  {data.impactByGoal.map((g) => <Cell key={g.code} fill={g.achieved >= 85 ? "#0F7A4E" : g.achieved >= 75 ? "#C9A227" : "#D99B2B"} />)}
                  <LabelList dataKey="achieved" position="insideLeft" formatter={(v) => `${v}%`} style={{ fontSize: 10, fill: "#fff", fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="أهم المبادرات من حيث الأثر" subtitle="Top Initiatives by Impact Contribution">
          <ol className="space-y-2.5">
            {data.topInitiatives.map((p, i) => (
              <li key={p.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold truncate">{i + 1}. {p.nameAr}</div>
                  <span className="text-[12px] font-bold num text-brand-green">{p.share}%</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <ProgressBar value={p.share * 4} tone="brand" className="flex-1" />
                  <span className="text-[10px] text-brand-muted whitespace-nowrap">استثمار: {fmtMoney(p.budget ?? 0)}</span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel className="mt-4" accent="red" title="يتطلب تدخل القيادة — CEO ATTENTION REQUIRED"
        subtitle={`${k.pendingDecisions} قرارات مطلوبة: اعتمادات مالية، قرارات نطاق، تصعيد استراتيجي، قرار موارد، وقبول مخاطرة`}
        actions={<Link to="/decisions" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green">فتح مركز القرارات <ChevronLeft className="h-3 w-3" /></Link>}>
        <ul className="divide-y divide-brand-border">
          {data.attention.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold truncate">{d.titleAr}</div>
                <div className="text-[10.5px] text-brand-muted truncate">{d.type} · الجهة المالكة: {d.ownerAr}{d.projectName ? ` · ${d.projectName}` : ""} · الموعد: {d.dueDate}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Chip tone={d.priority === "عاجلة" ? "off_track" : "at_risk"}>أولوية {d.priority}</Chip>
                <span className="text-[12px] font-bold num w-28 text-left">{d.amount ? fmtMoney(d.amount) : "—"}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-4" title="مؤشرات الأداء المعرضة للخطر" subtitle="اضغط على المؤشر لعرض المبادرات المساهمة فيه">
        <div className="flex flex-wrap gap-2">
          {data.kpisAtRisk.map((kp) => (
            <Link key={kp.id} to={`/kpis/${kp.id}`} className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-cream px-3 py-1.5 hover:bg-white">
              <span className="text-[12px] font-medium">{kp.nameAr}</span>
              <StatusChip status={kp.status} />
            </Link>
          ))}
        </div>
      </Panel>

      <SourcesFooter />
    </div>
  );
}
