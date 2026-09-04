import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip } from "@/components/ui";
import { fmtMoney, fmtPct } from "@shared/format";

type Pmo = {
  counts: { portfolios: number; programs: number; projects: number; onTrack: number; atRisk: number; offTrack: number; impact: number };
  finance: { budget: number; committed: number; actual: number; eac: number; variance: number; spendPct: number };
  governance: { pendingDecisions: number; criticalIssues: number; blockedDeps: number; scheduledApprovals: number; openEscalations: number };
  heatmap: number[][];
  topRisks: { id: number; titleAr: string; ownerAr: string; probability: number; impact: number; projectName: string }[];
  dependencies: { id: number; type: string; status: string; noteAr: string; fromName: string; toName: string }[];
  scorecard: { id: number; nameAr: string; status: string; investment: number; spent: number; eac: number; programs: number; projects: number; impact: number }[];
};
const tick = { fontSize: 10, fill: "#6B7672" };

/** 5×5 probability × impact heatmap — count of risks per cell, colored by score. */
export function RiskHeatmap({ grid, compact }: { grid: number[][]; compact?: boolean }) {
  const cellColor = (p: number, i: number) => { const sc = p * i; return sc >= 15 ? "#C63B3B" : sc >= 8 ? "#D99B2B" : "#0F7A4E"; };
  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between text-[9px] text-brand-muted py-1 text-center w-4">{[5, 4, 3, 2, 1].map((p) => <span key={p}>{p}</span>)}</div>
      <div className="flex-1">
        <div className={`grid grid-cols-5 gap-1 ${compact ? "" : "min-h-[190px]"}`}>
          {[5, 4, 3, 2, 1].map((p) => [1, 2, 3, 4, 5].map((i) => (
            <div key={`${p}-${i}`} className="rounded-md flex items-center justify-center text-[11px] font-bold text-white num" style={{ background: cellColor(p, i), opacity: grid[p - 1][i - 1] ? 1 : 0.35, minHeight: compact ? 26 : 34 }}>
              {grid[p - 1][i - 1] || ""}
            </div>
          )))}
        </div>
        <div className="grid grid-cols-5 text-[9px] text-brand-muted text-center mt-1">{[1, 2, 3, 4, 5].map((i) => <span key={i}>{i}</span>)}</div>
        <div className="text-[9.5px] text-brand-muted text-center">المحور الأفقي: الأثر · المحور الرأسي: الاحتمالية</div>
      </div>
    </div>
  );
}

export default function PmoPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["pmo"], queryFn: () => api<Pmo>("/api/pmo") });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل مركز التحكم"} />;
  const c = data.counts; const f = data.finance; const g = data.governance;
  const finData = [{ name: "المعتمدة", value: f.budget, fill: "#0E3F36" }, { name: "الملتزم به", value: f.committed, fill: "#0F6B4B" }, { name: "المصروف", value: f.actual, fill: "#0F7A4E" }, { name: "EAC", value: f.eac, fill: "#C9A227" }];

  return (
    <div>
      <PageHeader title="مركز التحكم بالمحافظ والمبادرات" subtitle="Portfolio Control Center — Executive PMO"
        description="متابعة أداء المحافظ والبرامج والمبادرات والاستثمارات والأثر والاعتماديات والتصعيدات." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="المحافظ" value={c.portfolios} sub="محفظة استراتيجية" />
        <KpiCard label="البرامج" value={c.programs} sub="برنامجاً" />
        <KpiCard label="المشاريع" value={c.projects} sub="مبادرة ومشروع" />
        <KpiCard label="إجمالي الاستثمار" value={fmtMoney(f.budget)} />
        <KpiCard label="الأثر المحقق" value={fmtPct(c.impact)} tone="green" />
        <KpiCard label="على المسار" value={c.onTrack} tone="green" sub="مبادرة" />
        <KpiCard label="معرضة للخطر" value={c.atRisk} tone="amber" sub="مبادرة" />
        <KpiCard label="خارج المسار" value={c.offTrack} tone="red" sub="مبادرة" />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="التحليل المالي للمنظومة" subtitle="الميزانية ← الملتزم ← المصروف ← التوقع عند الإكمال · المصدر: Odoo ERP">
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={finData} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={54}>
                <CartesianGrid vertical={false} stroke="#EEF0EC" />
                <XAxis dataKey="name" reversed tick={tick} axisLine={false} tickLine={false} />
                <YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}B`} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [fmtMoney(Number(v)), ""]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>{finData.map((d) => <Cell key={d.name} fill={d.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="col-span-2" title="ملخص الانحراف" subtitle="Variance Summary">
          <dl className="text-[12px] space-y-2">
            {[["الميزانية المعتمدة", f.budget], ["الملتزم به", f.committed], ["المصروف الفعلي", f.actual], ["التوقع عند الإكمال", f.eac]].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-brand-border pb-1.5"><dt className="text-brand-muted">{l}</dt><dd className="font-bold num">{fmtMoney(v as number)}</dd></div>
            ))}
            <div className="flex justify-between pb-1.5"><dt className="text-brand-muted">الانحراف المتوقع</dt><dd className={`font-bold num ${f.variance > 0 ? "text-rag-red" : "text-rag-green"}`}>{f.variance > 0 ? `تجاوز ${fmtMoney(f.variance)}` : `وفر ${fmtMoney(-f.variance)}`}</dd></div>
          </dl>
          <div className="mt-3 text-[10.5px] text-brand-muted flex justify-between"><span>نسبة الصرف من الميزانية</span><span className="num font-semibold">{f.spendPct}%</span></div>
          <ProgressBar value={f.spendPct} tone="brand" className="mt-1" />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Panel title="خريطة المخاطر المؤسسية" subtitle="Enterprise Risk Heatmap — الاحتمالية × الأثر">
          <RiskHeatmap grid={data.heatmap} />
          <ul className="mt-3 space-y-1.5">
            {data.topRisks.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-brand-border px-2.5 py-1.5">
                <div className="min-w-0"><div className="text-[11.5px] font-semibold truncate">{r.titleAr}</div><div className="text-[10px] text-brand-muted truncate">{r.projectName} · {r.ownerAr}</div></div>
                <Chip tone={r.probability * r.impact >= 15 ? "off_track" : "at_risk"}>{r.probability * r.impact}/25</Chip>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-4">
          <Panel title="الاعتماديات بين البرامج" subtitle="Cross-Program Dependencies" actions={<Link to="/dependencies" className="text-[11px] font-semibold text-brand-green">الكل</Link>}>
            <ul className="space-y-1.5">
              {data.dependencies.map((d) => (
                <li key={d.id} className="rounded-md border border-brand-border px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2"><div className="text-[11.5px] font-semibold truncate">{d.fromName} ← {d.toName}</div><StatusChip status={d.status} /></div>
                  <div className="text-[10px] text-brand-muted">{d.type} · {d.noteAr}</div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="التصعيدات والقرارات المعلقة" subtitle="الحوكمة" actions={<Link to="/governance" className="text-[11px] font-semibold text-brand-green">الحوكمة</Link>}>
            <div className="grid grid-cols-2 gap-2">
              {[["قرارات معلقة", g.pendingDecisions, "text-rag-red"], ["مشكلات حرجة", g.criticalIssues, "text-[#9A6B0F]"], ["اعتماديات متعثرة", g.blockedDeps, "text-brand-text"], ["موافقات مجدولة", g.scheduledApprovals, "text-brand-text"]].map(([l, v, cls]) => (
                <div key={l as string} className="rounded-lg border border-brand-border bg-brand-cream px-3 py-2"><div className={`text-[20px] font-bold num ${cls}`}>{v as number}</div><div className="text-[10.5px] text-brand-muted">{l as string}</div></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-4" title="أداء المحافظ" subtitle="Portfolio Scorecard">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">
            {["المحفظة", "الاستثمار", "المصروف", "EAC", "البرامج", "المشاريع", "الأثر", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {data.scorecard.map((r) => (
              <tr key={r.id} className="border-b border-brand-border/70 last:border-0">
                <td className="py-2"><Link to={`/portfolios/${r.id}`} className="font-semibold hover:text-brand-green">{r.nameAr}</Link></td>
                <td className="py-2 text-center num">{fmtMoney(r.investment)}</td><td className="py-2 text-center num">{fmtMoney(r.spent)}</td><td className="py-2 text-center num">{fmtMoney(r.eac)}</td>
                <td className="py-2 text-center num">{r.programs}</td><td className="py-2 text-center num">{r.projects}</td><td className="py-2 text-center num font-semibold">{r.impact}%</td>
                <td className="py-2 text-center"><StatusChip status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <SourcesFooter />
    </div>
  );
}
