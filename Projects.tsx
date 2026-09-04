import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { Search, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Empty, Chip } from "@/components/ui";
import { fmtMoney, RAG_LABEL } from "@shared/format";

type ProjectRow = { id: number; code: string; nameAr: string; programId: number; programName: string; portfolioId: number; portfolioName: string; managerName: string; phase: string; progress: number; scheduleStatus: string; financialStatus: string; status: string; impactTarget: number; impactAchieved: number; budget: number | null };

function ProjectList() {
  const { data, isLoading, error } = useQuery({ queryKey: ["projects"], queryFn: () => api<ProjectRow[]>("/api/projects") });
  const [q, setQ] = useState(""); const [pf, setPf] = useState("all"); const [prg, setPrg] = useState("all"); const [st, setSt] = useState("all");
  const portfolios = useMemo(() => Array.from(new Map((data ?? []).map((p) => [p.portfolioId, p.portfolioName])).entries()), [data]);
  const programs = useMemo(() => Array.from(new Map((data ?? []).filter((p) => pf === "all" || String(p.portfolioId) === pf).map((p) => [p.programId, p.programName])).entries()), [data, pf]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المبادرات"} />;
  const list = data.filter((p) => (pf === "all" || String(p.portfolioId) === pf) && (prg === "all" || String(p.programId) === prg) && (st === "all" || p.status === st) && (!q || p.nameAr.includes(q) || p.code.toLowerCase().includes(q.toLowerCase()) || p.managerName.includes(q)));
  const count = (s: string) => data.filter((p) => p.status === s).length;
  return (
    <div>
      <PageHeader title="المبادرات والمشاريع" subtitle="Initiatives & Projects" description="مصدر بيانات التنفيذ: Microsoft Project Server." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي المبادرات" value={data.length} sub="مبادرة ومشروع" />
        <KpiCard label="على المسار" value={count("on_track")} tone="green" />
        <KpiCard label="معرضة للخطر" value={count("at_risk")} tone="amber" />
        <KpiCard label="خارج المسار" value={count("off_track")} tone="red" />
      </div>
      <div className="card mt-4 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المبادرات…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
        </div>
        <select value={pf} onChange={(e) => { setPf(e.target.value); setPrg("all"); }} className="rounded-md border border-brand-border bg-white px-2 py-1.5 text-[11.5px]">
          <option value="all">جميع المحافظ</option>{portfolios.map(([id, n]) => <option key={id} value={String(id)}>{n}</option>)}
        </select>
        <select value={prg} onChange={(e) => setPrg(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1.5 text-[11.5px]">
          <option value="all">جميع البرامج</option>{programs.map(([id, n]) => <option key={id} value={String(id)}>{n}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {[["all", "الكل"], ["on_track", "أخضر"], ["at_risk", "برتقالي"], ["off_track", "أحمر"]].map(([v, l]) => (
            <button key={v} onClick={() => setSt(v)} className={`chip ${st === v ? "bg-brand text-white" : "bg-white border border-brand-border text-brand-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <Panel className="mt-4" title={`المبادرات (${list.length})`} subtitle="عدد النتائج بعد التصفية">
        {list.length === 0 ? <Empty label="لا توجد مبادرات مطابقة" /> : (
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">
              {["المبادرة", "البرنامج", "مدير المشروع", "الميزانية", "الإنجاز", "الجدول", "المالي", "نسبة تحقق الأثر", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/70 last:border-0 hover:bg-brand-cream/60">
                  <td className="py-2"><Link to={`/projects/${p.id}`} className="font-semibold hover:text-brand-green">{p.nameAr}</Link><div className="text-[10px] text-brand-muted font-mono">{p.code}</div></td>
                  <td className="py-2 text-center text-brand-muted">{p.programName}</td>
                  <td className="py-2 text-center text-brand-muted">{p.managerName}</td>
                  <td className="py-2 text-center num">{fmtMoney(p.budget ?? 0)}</td>
                  <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={p.progress} tone="brand" className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-8">{p.progress}%</span></div></td>
                  <td className="py-2 text-center"><StatusChip status={p.scheduleStatus} /></td>
                  <td className="py-2 text-center"><StatusChip status={p.financialStatus} /></td>
                  <td className="py-2 text-center num font-semibold">{p.impactTarget ? Math.round((p.impactAchieved / p.impactTarget) * 1000) / 10 : 0}%</td>
                  <td className="py-2 text-center"><StatusChip status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <SourcesFooter />
    </div>
  );
}

// ---------------------------------------------------------------- detail
type Detail = {
  project: { id: number; code: string; nameAr: string; managerName: string; phase: string; progress: number; scheduleStatus: string; financialStatus: string; status: string; impactTarget: number; impactAchieved: number; impactContribution: string; startDate: string; endDate: string; programId: number; programName: string; portfolioId: number; portfolioName: string; sectorName: string; goalId: number; goalName: string };
  milestones: { id: number; nameAr: string; plannedStart: string; plannedEnd: string; actualStart: string | null; actualEnd: string | null; delayDays: number; status: string; isCritical: boolean }[];
  deliverables: { id: number; nameAr: string; status: string }[];
  risks: { id: number; titleAr: string; category: string; probability: number; impact: number; response: string; status: string; ownerAr: string }[];
  issues: { id: number; titleAr: string; severity: string; status: string; openedDays: number }[];
  kpi: { kpiId: number; kpiName: string; contributionTarget: number; contributionActual: number } | null;
  finance: { budget: number; committed: number; actual: number; eac: number; variance: number; spendPct: number; commitPct: number };
  attainment: number;
};
const MS_TONE: Record<string, string> = { "مكتمل": "bg-rag-green", "قيد التنفيذ": "bg-brand-gold", "متأخر": "bg-rag-orange", "لم يبدأ": "bg-[#C9CFCA]" };
const MS_CHIP: Record<string, "on_track" | "gold" | "off_track" | "neutral"> = { "مكتمل": "on_track", "قيد التنفيذ": "gold", "متأخر": "off_track", "لم يبدأ": "neutral" };
const DEL_CHIP: Record<string, "on_track" | "gold" | "off_track" | "neutral"> = { "مكتمل": "on_track", "قيد التنفيذ": "gold", "متأخر": "off_track", "قيد التسليم": "neutral" };

/** Simplified Gantt — planned bar (grey) with actual/forecast bar overlaid, delay shown in orange; critical path marked. Time flows right → left. */
function Gantt({ milestones, start, end }: { milestones: Detail["milestones"]; start: string; end: string }) {
  const t0 = new Date(start).getTime(); const t1 = new Date(end).getTime(); const span = Math.max(1, t1 - t0);
  const pos = (d: string) => Math.min(100, Math.max(0, ((new Date(d).getTime() - t0) / span) * 100));
  return (
    <div className="space-y-2.5">
      {milestones.map((m) => {
        const ps = pos(m.plannedStart); const pe = pos(m.plannedEnd);
        const as = m.actualStart ? pos(m.actualStart) : null; const ae = m.actualEnd ? pos(m.actualEnd) : m.actualStart ? Math.min(100, pe + (m.delayDays / (span / 86400000)) * 100) : null;
        return (
          <div key={m.id} className="grid grid-cols-[130px_1fr_150px] items-center gap-3">
            <div className="text-[11.5px] font-semibold flex items-center gap-1.5">{m.isCritical && <span className="h-1.5 w-1.5 rounded-full bg-rag-red" title="المسار الحرج" />}{m.nameAr}</div>
            <div className="relative h-5 rounded bg-[#F0F2EE]">
              <div className="absolute top-1 h-3 rounded bg-[#C9CFCA]" style={{ right: `${ps}%`, width: `${Math.max(1, pe - ps)}%` }} />
              {as !== null && ae !== null && <div className={clsx("absolute top-0.5 h-4 rounded", MS_TONE[m.status])} style={{ right: `${as}%`, width: `${Math.max(1, ae - as)}%` }} />}
            </div>
            <div className="flex items-center gap-2 text-[10.5px]"><Chip tone={MS_CHIP[m.status]}>{m.status}</Chip>{m.delayDays > 0 && <span className="text-rag-orange num">تأخر {m.delayDays} يوم</span>}</div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 text-[10px] text-brand-muted pt-1">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-[#C9CFCA]" /> المخطط</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-rag-green" /> الفعلي</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-brand-gold" /> قيد التنفيذ</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-rag-orange" /> التأخر</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rag-red" /> المسار الحرج</span>
      </div>
    </div>
  );
}

function ProjectDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["project", id], queryFn: () => api<Detail>(`/api/projects/${id}`) });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المبادرة"} />;
  const p = data.project; const f = data.finance;
  const chain = [["المبادرة", p.nameAr, `/projects/${p.id}`], ["البرنامج", p.programName, "/programs"], ["المحفظة", p.portfolioName, `/portfolios/${p.portfolioId}`], ["الهدف الاستراتيجي", p.goalName, "/strategy"], ["مؤشر الأداء", data.kpi?.kpiName ?? "—", data.kpi ? `/kpis/${data.kpi.kpiId}` : "/kpis"]];
  return (
    <div>
      <PageHeader title={p.nameAr} subtitle={`${p.code} · Project Performance Dashboard`}
        breadcrumb={<span><Link to="/portfolios" className="hover:text-brand-green">المحافظ</Link> ← <Link to={`/portfolios/${p.portfolioId}`} className="hover:text-brand-green">{p.portfolioName}</Link> ← <Link to="/projects" className="hover:text-brand-green">المبادرات</Link> ← {p.nameAr}</span>}
        description={<span className="flex items-center gap-2 flex-wrap"><StatusChip status={p.status} /> البرنامج: {p.programName} · مدير المشروع: {p.managerName} · القطاع: {p.sectorName} · المرحلة: {p.phase}</span>} />
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="نسبة الإنجاز" value={`${p.progress}%`} />
        <KpiCard label="الجدول الزمني" value={<span className="text-[15px]">{RAG_LABEL[p.scheduleStatus]}</span>} tone={p.scheduleStatus === "on_track" ? "green" : p.scheduleStatus === "at_risk" ? "amber" : "red"} />
        <KpiCard label="الميزانية" value={<span className="text-[15px]">{RAG_LABEL[p.financialStatus]}</span>} tone={p.financialStatus === "on_track" ? "green" : p.financialStatus === "at_risk" ? "amber" : "red"} />
        <KpiCard label="المساهمة في الأثر" value={<span className="text-[15px]">{p.impactContribution}</span>} tone="green" />
        <KpiCard label="المخاطر" value={data.risks.length} tone={data.risks.some((r) => r.probability * r.impact >= 15) ? "amber" : "default"} />
        <KpiCard label="المشكلات" value={data.issues.length} tone={data.issues.length ? "red" : "default"} />
      </div>

      <Panel className="mt-4" title="الجدول الزمني — Gantt مبسّط" subtitle="المصدر: Microsoft Project Server · Planned · Actual · Forecast · Delay · Critical Path">
        <Gantt milestones={data.milestones} start={p.startDate} end={p.endDate} />
      </Panel>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Panel title="الأداء المالي للمشروع" subtitle="المصدر: Odoo ERP">
          <dl className="text-[12px] space-y-2">
            {[["الميزانية المعتمدة", f.budget], ["المصروف الفعلي", f.actual], ["الالتزامات المالية", f.committed], ["التوقع عند الإكمال (EAC)", f.eac]].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-brand-border pb-1.5"><dt className="text-brand-muted">{l}</dt><dd className="font-bold num">{fmtMoney(v as number)}</dd></div>
            ))}
            <div className="flex justify-between pb-1"><dt className="text-brand-muted">الانحراف المتوقع</dt><dd className={`font-bold num ${f.variance > 0 ? "text-rag-red" : "text-rag-green"}`}>{f.variance > 0 ? `تجاوز ${fmtMoney(f.variance)}` : `وفر ${fmtMoney(-f.variance)}`}</dd></div>
          </dl>
          <div className="mt-3 space-y-2.5">
            {[["نسبة الصرف", f.spendPct], ["نسبة الالتزام", f.commitPct]].map(([l, v]) => (
              <div key={l as string}><div className="flex justify-between text-[11px]"><span className="text-brand-muted">{l}</span><span className="num font-semibold">{v}%</span></div><ProgressBar value={v as number} tone="brand" className="mt-1" /></div>
            ))}
          </div>
        </Panel>
        <Panel title="ربط المشروع بالاستراتيجية" subtitle="Initiative → Program → Portfolio → Goal → KPI → Impact">
          <ol className="space-y-1.5">
            {chain.map(([l, v, to], i) => (
              <li key={l} className="flex items-center gap-2 rounded-md border border-brand-border px-2.5 py-1.5 text-[11.5px]">
                <span className="h-5 w-5 rounded-full bg-brand text-white text-[10px] inline-flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-brand-muted shrink-0">{l}:</span><Link to={to} className="font-semibold truncate hover:text-brand-green">{v}</Link>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-lg bg-brand-cream border border-brand-border px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[14px] font-bold num">+{p.impactTarget}%</div><div className="text-[10px] text-brand-muted">المساهمة المستهدفة</div></div>
            <div><div className="text-[14px] font-bold num text-brand-green">+{p.impactAchieved}%</div><div className="text-[10px] text-brand-muted">المساهمة المتحققة</div></div>
            <div><div className="text-[14px] font-bold num">{data.attainment}%</div><div className="text-[10px] text-brand-muted">نسبة تحقيق الأثر</div></div>
          </div>
          {data.kpi && <Link to={`/kpis/${data.kpi.kpiId}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green">فتح بطاقة المؤشر المرتبط <ChevronLeft className="h-3 w-3" /></Link>}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Panel title="المخاطر" subtitle={`${data.risks.length} مخاطرة مسجلة`}>
          {data.risks.length === 0 ? <Empty label="لا توجد مخاطر مسجلة" /> : (
            <ul className="space-y-1.5">
              {data.risks.map((r) => (
                <li key={r.id} className="rounded-md border border-brand-border px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2"><div className="text-[11.5px] font-semibold">{r.titleAr}</div><Chip tone={r.probability * r.impact >= 15 ? "off_track" : "at_risk"}>{r.probability}×{r.impact}</Chip></div>
                  <div className="text-[10px] text-brand-muted">{r.category} · الاستجابة: {r.response} · {r.status} · {r.ownerAr}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="المشكلات والمخرجات" subtitle="Issues & Deliverables">
          {data.issues.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border border-[#F0C9C9] bg-rag-redBg px-2.5 py-1.5 mb-1.5">
              <div className="text-[11.5px] font-semibold">{i.titleAr}</div><Chip tone="off_track">{i.severity} · {i.openedDays} يوم</Chip>
            </div>
          ))}
          <div className="text-[10.5px] text-brand-muted mt-2 mb-1">المخرجات الرئيسية</div>
          <ul className="space-y-1.5">
            {data.deliverables.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-brand-border px-2.5 py-1.5"><span className="text-[11.5px]">{d.nameAr}</span><Chip tone={DEL_CHIP[d.status]}>{d.status}</Chip></li>
            ))}
          </ul>
        </Panel>
      </div>
      <SourcesFooter />
    </div>
  );
}

export default function ProjectsRouter() {
  return <Routes><Route index element={<ProjectList />} /><Route path=":id" element={<ProjectDetail />} /></Routes>;
}
