import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Empty } from "@/components/ui";
import { fmtMoney, fmtPct } from "@shared/format";

type PfRow = { id: number; code: string; nameAr: string; nameEn: string; managerName: string; status: string; value: number; projectCount: number; programCount: number; achievedImpact: number; onTrack: number; atRisk: number; offTrack: number };
const tick = { fontSize: 10, fill: "#6B7672" };

function PortfolioList() {
  const { data, isLoading, error } = useQuery({ queryKey: ["portfolios"], queryFn: () => api<PfRow[]>("/api/portfolios") });
  const [q, setQ] = useState("");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المحافظ"} />;
  const rows = data.map((p) => ({ ...p, value: Number(p.value), achievedImpact: Math.round(Number(p.achievedImpact)), projectCount: Number(p.projectCount), programCount: Number(p.programCount), onTrack: Number(p.onTrack), atRisk: Number(p.atRisk), offTrack: Number(p.offTrack) }));
  const list = rows.filter((p) => !q || p.nameAr.includes(q));
  const total = rows.reduce((a, p) => a + p.value, 0);
  const avgImpact = Math.round(rows.reduce((a, p) => a + p.achievedImpact, 0) / rows.length);
  return (
    <div>
      <PageHeader title="المحافظ الاستراتيجية" subtitle="Portfolio Performance" description="أداء المحافظ: البرامج والمشاريع والأداء المالي والأثر." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي المحافظ" value={rows.length} sub="محفظة استراتيجية" />
        <KpiCard label="إجمالي الاستثمار" value={fmtMoney(total)} />
        <KpiCard label="متوسط الأثر المحقق" value={fmtPct(avgImpact)} tone="green" />
        <KpiCard label="محافظ معرضة للخطر" value={rows.filter((p) => p.status !== "on_track").length} tone="amber" sub="تتطلب متابعة" />
      </div>
      <div className="card mt-4 px-4 py-3 relative">
        <Search className="absolute right-6 top-5 h-3.5 w-3.5 text-brand-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المحافظ…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {list.map((p) => (
          <Link key={p.id} to={`/portfolios/${p.id}`} className="card px-4 py-3.5 hover:border-brand-green/50 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-[13.5px] font-bold">{p.nameAr}</div><div className="text-[10.5px] text-brand-muted">مدير المحفظة: {p.managerName}</div></div>
              <StatusChip status={p.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[14px] font-bold num">{fmtMoney(p.value)}</div><div className="text-[10px] text-brand-muted">قيمة المحفظة</div></div>
              <div><div className="text-[14px] font-bold num">{p.programCount}</div><div className="text-[10px] text-brand-muted">برامج</div></div>
              <div><div className="text-[14px] font-bold num">{p.projectCount}</div><div className="text-[10px] text-brand-muted">مشاريع</div></div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10.5px] text-brand-muted"><span>الأثر المحقق مقابل المستهدف</span><span className="font-bold num text-brand-text">{p.achievedImpact}%</span></div>
            <ProgressBar value={p.achievedImpact} className="mt-1" />
            <div className="mt-2 flex items-center gap-3 text-[10.5px]">
              <span className="text-rag-green">● على المسار {p.onTrack}</span><span className="text-[#9A6B0F]">● معرض للخطر {p.atRisk}</span><span className="text-rag-red">● خارج المسار {p.offTrack}</span>
            </div>
          </Link>
        ))}
      </div>
      <SourcesFooter />
    </div>
  );
}

type Detail = {
  portfolio: { id: number; nameAr: string; nameEn: string; managerName: string; status: string; targetImpact: number };
  finance: { budget: number; committed: number; actual: number; eac: number; variance: number };
  programs: { id: number; code: string; nameAr: string; managerName: string; budget: number; actual: number; eac: number; progress: number; impact: number; projectCount: number; scheduleStatus: string; financialStatus: string; status: string }[];
  projects: { id: number; code: string; nameAr: string; status: string; progress: number; impactTarget: number; impactAchieved: number; programName: string; budget: number | null }[];
  metrics: { impact: number; onTrack: number; atRisk: number; offTrack: number; spendPct: number; commitPct: number; onTrackPct: number };
};

function PortfolioDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["portfolio", id], queryFn: () => api<Detail>(`/api/portfolios/${id}`) });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المحفظة"} />;
  const pf = data.portfolio; const m = data.metrics; const f = data.finance;
  const chart = data.programs.map((p) => ({ name: p.nameAr.replace("برنامج ", ""), المعتمدة: p.budget, المصروف: p.actual, EAC: p.eac }));
  return (
    <div>
      <PageHeader title={pf.nameAr} subtitle="Portfolio Performance"
        breadcrumb={<span><Link to="/portfolios" className="hover:text-brand-green">المحافظ</Link> ← {pf.nameAr}</span>}
        description={<span className="flex items-center gap-2">مدير المحفظة: {pf.managerName} <StatusChip status={pf.status} /></span>} />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="قيمة المحفظة" value={fmtMoney(f.budget)} />
        <KpiCard label="البرامج / المشاريع" value={`${data.programs.length} / ${data.projects.length}`} />
        <KpiCard label="الأثر المستهدف" value={fmtPct(pf.targetImpact)} />
        <KpiCard label="الأثر المحقق" value={fmtPct(m.impact)} tone={m.impact >= 85 ? "green" : "amber"} />
        <KpiCard label="على المسار" value={m.onTrack} tone="green" />
        <KpiCard label="معرض للخطر" value={m.atRisk} tone="amber" />
        <KpiCard label="خارج المسار" value={m.offTrack} tone="red" />
        <KpiCard label="الانحراف المتوقع" value={f.variance > 0 ? fmtMoney(f.variance) : `وفر ${fmtMoney(-f.variance)}`} tone={f.variance > 0 ? "red" : "green"} sub="التوقع عند الإكمال مقابل المعتمد" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="التحليل المالي" subtitle="حسب البرنامج · المصدر: Odoo ERP">
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={14}>
                <CartesianGrid vertical={false} stroke="#EEF0EC" />
                <XAxis dataKey="name" reversed tick={{ fontSize: 9, fill: "#6B7672" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [fmtMoney(Number(v)), ""]} />
                <Legend wrapperStyle={{ fontSize: 10.5 }} />
                <Bar dataKey="المعتمدة" fill="#0E3F36" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="المصروف" fill="#0F7A4E" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="EAC" fill="#C9A227" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="col-span-2" title="مؤشرات المحفظة" subtitle="Portfolio Metrics">
          <div className="space-y-3">
            {[["نسبة الصرف", m.spendPct, "brand"], ["نسبة الالتزام", m.commitPct, "brand"], ["الأثر المحقق", m.impact, undefined], ["مشاريع على المسار", m.onTrackPct, undefined]].map(([l, v, t]) => (
              <div key={l as string}>
                <div className="flex justify-between text-[11.5px]"><span className="text-brand-muted">{l as string}</span><span className="font-bold num">{v as number}%</span></div>
                <ProgressBar value={v as number} tone={t as any} className="mt-1" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel className="mt-4" title="أداء البرامج" subtitle="Program Performance">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">
            {["البرنامج", "مدير البرنامج", "الميزانية", "الإنجاز", "الجدول", "الأداء المالي", "الأثر", "المشاريع", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {data.programs.map((p) => (
              <tr key={p.id} className="border-b border-brand-border/70 last:border-0">
                <td className="py-2 font-semibold">{p.nameAr}</td><td className="py-2 text-center text-brand-muted">{p.managerName}</td><td className="py-2 text-center num">{fmtMoney(p.budget)}</td>
                <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={p.progress} tone="brand" className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-8">{p.progress}%</span></div></td>
                <td className="py-2 text-center"><StatusChip status={p.scheduleStatus} /></td><td className="py-2 text-center"><StatusChip status={p.financialStatus} /></td>
                <td className="py-2 text-center num font-semibold">{p.impact}%</td><td className="py-2 text-center num">{p.projectCount}</td><td className="py-2 text-center"><StatusChip status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel className="mt-4" title="مشاريع المحفظة" subtitle={`${data.projects.length} مشروعاً ومبادرة`}>
        {data.projects.length === 0 ? <Empty label="لا توجد مشاريع" /> : (
          <div className="grid grid-cols-3 gap-2.5">
            {data.projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="rounded-lg border border-brand-border px-3 py-2.5 hover:bg-brand-cream">
                <div className="flex items-start justify-between gap-2"><div className="text-[12px] font-semibold leading-snug">{p.nameAr}</div><StatusChip status={p.status} /></div>
                <div className="text-[10px] text-brand-muted mt-1.5 num">ميزانية {fmtMoney(p.budget ?? 0)} · إنجاز {p.progress}% · أثر {p.impactTarget ? Math.round((p.impactAchieved / p.impactTarget) * 100) : 0}%</div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
      <SourcesFooter />
    </div>
  );
}

export default function PortfoliosRouter() {
  return <Routes><Route index element={<PortfolioList />} /><Route path=":id" element={<PortfolioDetail />} /></Routes>;
}
