import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { Plus } from "lucide-react";
import clsx from "clsx";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from "recharts";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { KpiCard, Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, StatusChip, Empty } from "@/components/ui";
import { StageTracker, WorkflowActions, WorkflowHistory, type WorkflowView } from "@/components/workflow";
import { fmtMoney, MONTHS_AR } from "@shared/format";

const tick = { fontSize: 10, fill: "#6B7672" };
type Totals = { approved: number; committed: number; actual: number; remaining: number; spendPct: number; expectedPct: number; commitPct: number; forecast: number; forecastVariance: number; curve: { month: number; planned: number; actual: number | null }[] };
type Transfer = { id: number; code: string; amount: number; justificationAr: string; status: string; createdAt: string; requestedBy: string | null; from: { cc: string | null; category: string; approved: number; actual: number }; to: { cc: string | null; category: string }; workflow: (WorkflowView & { instanceId: number }) | null };
const KEYS = [["overview"], ["budget-overview"], ["budget-opex"], ["budget-transfers"], ["decisions"], ["changelog"]];

function ModuleNav() {
  const tabs = [["", "نظرة الميزانية"], ["opex", "الميزانية التشغيلية"], ["initiatives", "ميزانية المبادرات"]];
  return <div className="card px-2 py-1.5 mb-4 flex gap-1">{tabs.map(([p, l]) => <NavLink key={p} to={`/budget${p ? `/${p}` : ""}`} end={p === ""} className={({ isActive }) => clsx("rounded-md px-3 py-1.5 text-[11.5px]", isActive ? "bg-brand text-white font-semibold" : "text-brand-muted hover:bg-brand-cream")}>{l}</NavLink>)}</div>;
}

/** Utilisation gauge: spend vs expected-to-date, with the tone driven by the gap. */
function Gauge({ title, t }: { title: string; t: Totals }) {
  const gap = t.spendPct - t.expectedPct; const tone = gap <= -15 ? "amber" : gap >= 10 ? "red" : "green";
  return (
    <Panel title={title} subtitle={`المعتمد ${fmtMoney(t.approved)} · المتوقع حتى تاريخه ${t.expectedPct}%`}>
      <div className="flex items-end gap-4">
        <div><div className={clsx("text-[38px] font-bold num leading-none", tone === "green" ? "text-rag-green" : tone === "amber" ? "text-[#9A6B0F]" : "text-rag-red")}>{t.spendPct}%</div><div className="text-[10.5px] text-brand-muted mt-1">نسبة الصرف</div></div>
        <div className="flex-1 space-y-2 text-[11px]">
          <div><div className="flex justify-between"><span className="text-brand-muted">المنصرف</span><span className="num font-semibold">{fmtMoney(t.actual)}</span></div><ProgressBar value={t.spendPct} tone={tone as any} className="mt-1" height="h-2.5" /></div>
          <div><div className="flex justify-between"><span className="text-brand-muted">الملتزم به</span><span className="num font-semibold">{fmtMoney(t.committed)} · {t.commitPct}%</span></div><ProgressBar value={t.commitPct} tone="brand" className="mt-1" /></div>
          <div className="flex justify-between"><span className="text-brand-muted">المتبقي</span><span className="num font-semibold">{fmtMoney(t.remaining)}</span></div>
          <div className="flex justify-between"><span className="text-brand-muted">التوقع نهاية العام</span><span className={clsx("num font-bold", t.forecastVariance > 0 ? "text-rag-red" : "text-rag-green")}>{fmtMoney(t.forecast)} ({t.forecastVariance > 0 ? "+" : ""}{t.forecastVariance})</span></div>
        </div>
      </div>
    </Panel>
  );
}

function SCurve({ t, title }: { t: Totals; title: string }) {
  const data = t.curve.map((c) => ({ ...c, name: MONTHS_AR[c.month - 1] }));
  return (
    <Panel title={title} subtitle="المخطط التراكمي مقابل المنصرف التراكمي (S-Curve) · مليون ريال">
      <div className="h-[220px]"><ResponsiveContainer><ComposedChart data={data} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#EEF0EC" /><XAxis dataKey="name" reversed tick={tick} axisLine={false} tickLine={false} /><YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}B`} />
        <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [fmtMoney(Number(v)), ""]} />
        <Area type="monotone" dataKey="planned" name="المخطط" stroke="#C9A227" fill="#FBF6E7" strokeDasharray="5 4" isAnimationActive={false} />
        <Line type="monotone" dataKey="actual" name="المنصرف" stroke="#0E3F36" strokeWidth={2.2} dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer></div>
    </Panel>
  );
}

function TransferCard({ t, showActions }: { t: Transfer; showActions?: boolean }) {
  const st: Record<string, "at_risk" | "on_track" | "off_track"> = { "قيد الإجراء": "at_risk", "معتمد": "on_track", "مرفوض": "off_track" };
  return (
    <div className="rounded-lg border border-brand-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap"><div className="text-[12px] font-semibold"><span className="font-mono text-[10.5px] text-brand-muted ml-1">{t.code}</span>{t.from.cc}: {t.from.category} ← {t.to.category}</div><div className="flex items-center gap-2"><span className="text-[13px] font-bold num">{fmtMoney(t.amount)}</span><Chip tone={st[t.status]}>{t.status}</Chip></div></div>
      <div className="text-[10.5px] text-brand-muted mt-0.5">{t.justificationAr} · طلب: {t.requestedBy ?? "—"}</div>
      {t.workflow && <div className="mt-2"><StageTracker wf={t.workflow} compact /></div>}
      {t.workflow && showActions && <div className="mt-2"><WorkflowActions wf={t.workflow} invalidate={KEYS} /></div>}
    </div>
  );
}

function OverviewScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["budget-overview"], queryFn: () => api<any>("/api/budget/overview") });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="الميزانية التشغيلية المعتمدة" value={fmtMoney(data.opex.approved)} sub={`السنة المالية ${data.fiscalYear} · مغلقة حتى ${MONTHS_AR[data.closedMonth - 1]}`} />
        <KpiCard label="نسبة صرف التشغيلية" value={`${data.opex.spendPct}%`} tone={Math.abs(data.opex.spendPct - data.opex.expectedPct) < 10 ? "green" : "amber"} sub={`المتوقع ${data.opex.expectedPct}%`} />
        <KpiCard label="ميزانية المبادرات المعتمدة" value={fmtMoney(data.initiatives.approved)} sub="الباب الرابع + تمويل البرامج" />
        <KpiCard label="نسبة صرف المبادرات" value={`${data.initiatives.spendPct}%`} tone={Math.abs(data.initiatives.spendPct - data.initiatives.expectedPct) < 10 ? "green" : "amber"} sub={`المتوقع ${data.initiatives.expectedPct}%`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4"><Gauge title="الميزانية التشغيلية" t={data.opex} /><Gauge title="ميزانية المبادرات" t={data.initiatives} /></div>
      <div className="mt-4 grid grid-cols-2 gap-4"><SCurve t={data.opex} title="منحنى الصرف — التشغيلية" /><SCurve t={data.initiatives} title="منحنى الصرف — المبادرات" /></div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Panel title="أقل مراكز التكلفة صرفاً" subtitle="نسبة الصرف مقابل المتوقع حتى تاريخه"><ul className="space-y-2">{data.underSpenders.map((c: any) => <li key={c.id}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{c.nameAr}</span><span className="num">{c.spendPct}% <span className="text-[#9A6B0F]">({c.gap})</span></span></div><ProgressBar value={c.spendPct} tone="amber" className="mt-1" /></li>)}</ul></Panel>
        <Panel title="أعلى مراكز التكلفة صرفاً" subtitle="خطر التجاوز قبل نهاية العام"><ul className="space-y-2">{data.overSpenders.map((c: any) => <li key={c.id}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{c.nameAr}</span><span className="num">{c.spendPct}% <span className={c.gap >= 10 ? "text-rag-red" : "text-brand-muted"}>(+{c.gap})</span></span></div><ProgressBar value={c.spendPct} tone={c.gap >= 10 ? "red" : "green"} className="mt-1" /></li>)}</ul></Panel>
        <Panel title="التنبيهات" subtitle={`${data.alerts.length} تنبيهات`}>{data.alerts.length === 0 ? <Empty label="لا توجد تنبيهات" /> : <ul className="space-y-1.5">{data.alerts.map((a: any, i: number) => <li key={i} className={clsx("rounded-md border px-2.5 py-1.5 text-[11px]", a.tone === "red" ? "border-[#F0C9C9] bg-rag-redBg" : "border-[#EEDDB3] bg-rag-amberBg")}>{a.textAr}</li>)}</ul>}</Panel>
      </div>
      <Panel className="mt-4" title="المناقلات قيد الإجراء" subtitle="Budget transfers in the workflow — من يملك المرحلة يرى أزرار الإجراء" actions={<Link to="/budget/opex" className="text-[11px] font-semibold text-brand-green">كل المناقلات</Link>}>
        {data.pendingTransfers.length === 0 ? <Empty label="لا توجد مناقلات قيد الإجراء" /> : <div className="space-y-2">{data.pendingTransfers.map((t: Transfer) => <TransferCard key={t.id} t={t} showActions />)}</div>}
      </Panel>
    </div>
  );
}

function OpexScreen() {
  const { user, can } = useAuth(); const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["budget-opex"], queryFn: () => api<any>("/api/budget/opex") });
  const [cc, setCc] = useState("all"); const [chapter, setChapter] = useState("all"); const [sel, setSel] = useState<number | null>(null); const [form, setForm] = useState({ fromLineId: "", toLineId: "", amount: "", justificationAr: "" }); const [showForm, setShowForm] = useState(false); const [err, setErr] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => post("/api/budget/transfers", form), onSuccess: () => { KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); setShowForm(false); setForm({ fromLineId: "", toLineId: "", amount: "", justificationAr: "" }); setErr(null); }, onError: (e: any) => setErr(e.message) });
  const ccs = useMemo(() => Array.from(new Map((data?.lines ?? []).map((l: any) => [l.costCenterId, l.costCenter])).entries()), [data]);
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const lines = data.lines.filter((l: any) => (cc === "all" || String(l.costCenterId) === cc) && (chapter === "all" || l.chapter === chapter));
  const selected = data.lines.find((l: any) => l.id === sel) ?? lines[0];
  const canRequest = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("budget"));
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">{data.byChapter.map((c: any) => <KpiCard key={c.chapter} label={c.chapter} value={fmtMoney(c.approved)} sub={`منصرف ${fmtMoney(c.actual)} · ${c.spendPct}%`} tone={c.spendPct >= 80 ? "red" : "default"} />)}</div>
      <div className="card mt-4 px-4 py-2.5 flex items-center gap-2 text-[11px]">
        <select value={cc} onChange={(e) => setCc(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1.5"><option value="all">جميع مراكز التكلفة</option>{ccs.map(([id, n]: any) => <option key={id} value={String(id)}>{n}</option>)}</select>
        <select value={chapter} onChange={(e) => setChapter(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1.5"><option value="all">جميع الأبواب</option>{data.byChapter.map((c: any) => <option key={c.chapter} value={c.chapter}>{c.chapter}</option>)}</select>
        <span className="text-brand-muted mr-auto">{lines.length} بنداً</span>
        {canRequest && <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> طلب مناقلة</button>}
      </div>
      {showForm && (
        <Panel className="mt-3" title="طلب مناقلة جديد" subtitle="يبدأ مسار العمل: تسجيل ← المراجعة المالية ← اعتماد الرئيس التنفيذي ← التنفيذ">
          <div className="grid grid-cols-4 gap-2 text-[11.5px]">
            <select value={form.fromLineId} onChange={(e) => setForm({ ...form, fromLineId: e.target.value })} className="rounded-md border border-brand-border bg-white px-2 py-1.5"><option value="">من البند…</option>{data.lines.map((l: any) => <option key={l.id} value={l.id}>{l.costCenter} — {l.category} (متاح {Math.round(l.remaining)})</option>)}</select>
            <select value={form.toLineId} onChange={(e) => setForm({ ...form, toLineId: e.target.value })} className="rounded-md border border-brand-border bg-white px-2 py-1.5"><option value="">إلى البند…</option>{data.lines.map((l: any) => <option key={l.id} value={l.id}>{l.costCenter} — {l.category}</option>)}</select>
            <input type="number" placeholder="المبلغ (مليون ريال)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-md border border-brand-border bg-white px-2 py-1.5" />
            <input placeholder="المبرر" value={form.justificationAr} onChange={(e) => setForm({ ...form, justificationAr: e.target.value })} className="rounded-md border border-brand-border bg-white px-2 py-1.5" />
          </div>
          {err && <div className="mt-2 text-[11px] text-rag-red">{err}</div>}
          <button disabled={create.isPending || !form.fromLineId || !form.toLineId || !form.amount || !form.justificationAr} onClick={() => create.mutate()} className="mt-2 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">تسجيل الطلب</button>
        </Panel>
      )}
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="بنود الميزانية التشغيلية" subtitle="مركز التكلفة × الباب × البند — اضغط على البند لعرض اتجاهه الشهري">
          <div className="max-h-[520px] overflow-y-auto"><table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["مركز التكلفة", "البند", "المعتمد", "الملتزم", "المنصرف", "نسبة الصرف", "المتوقع"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i < 2 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
            <tbody>{lines.map((l: any) => (
              <tr key={l.id} onClick={() => setSel(l.id)} className={clsx("border-b border-brand-border/70 last:border-0 cursor-pointer", selected?.id === l.id ? "bg-[#FBF6E7]" : "hover:bg-brand-cream/60")}>
                <td className="py-1.5 font-semibold">{l.costCenter}</td><td className="py-1.5"><div>{l.category}</div><div className="text-[9.5px] text-brand-muted">{l.chapter}</div></td>
                <td className="py-1.5 text-center num">{l.approved}</td><td className="py-1.5 text-center num">{l.committed}</td><td className="py-1.5 text-center num">{l.actual}</td>
                <td className="py-1.5"><div className="flex items-center gap-2"><ProgressBar value={l.spendPct} tone={l.spendPct - l.expectedPct <= -15 ? "amber" : l.spendPct - l.expectedPct >= 10 ? "red" : "green"} className="flex-1 min-w-[50px]" /><span className="num w-10">{l.spendPct}%</span></div></td>
                <td className="py-1.5 text-center num text-brand-muted">{l.expectedPct}%</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Panel>
        <Panel className="col-span-2" title={selected ? `${selected.costCenter} — ${selected.category}` : "الاتجاه الشهري"} subtitle="المخطط مقابل المنصرف الشهري · مليون ريال">
          {selected && <div className="h-[260px]"><ResponsiveContainer><BarChart data={selected.months.map((m: any) => ({ name: MONTHS_AR[m.month - 1], المخطط: m.planned, المنصرف: m.actual }))} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={9}>
            <CartesianGrid vertical={false} stroke="#EEF0EC" /><XAxis dataKey="name" reversed tick={{ fontSize: 9, fill: "#6B7672" }} axisLine={false} tickLine={false} interval={0} /><YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={34} />
            <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} /><Legend wrapperStyle={{ fontSize: 10.5 }} /><Bar dataKey="المخطط" fill="#C9A227" radius={[2, 2, 0, 0]} isAnimationActive={false} /><Bar dataKey="المنصرف" fill="#0E3F36" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart></ResponsiveContainer></div>}
        </Panel>
      </div>
      <Panel className="mt-4" title="المناقلات" subtitle="Budget transfers — كل طلب يمر بمسار العمل المعتمد">
        {data.transfers.length === 0 ? <Empty label="لا توجد مناقلات" /> : <div className="space-y-2">{data.transfers.map((t: Transfer) => <div key={t.id}><TransferCard t={t} showActions />{t.workflow?.history && <div className="mr-3 mt-1"><WorkflowHistory history={t.workflow.history} /></div>}</div>)}</div>}
      </Panel>
    </div>
  );
}

function InitiativesScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["budget-initiatives"], queryFn: () => api<any>("/api/budget/initiatives") });
  const [pf, setPf] = useState("all"); const [q, setQ] = useState("");
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const pfs = Array.from(new Map(data.initiatives.map((p: any) => [p.portfolioId, p.portfolio])).entries());
  const list = data.initiatives.filter((p: any) => (pf === "all" || String(p.portfolioId) === pf) && (!q || p.nameAr.includes(q)));
  const t = data.totals;
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="المعتمد 2026" value={fmtMoney(t.approved)} sub={`منصرف ${fmtMoney(t.actual)} · ${t.spendPct}%`} />
        <KpiCard label="التوقع نهاية العام" value={fmtMoney(t.forecast)} tone={t.forecastVariance > 0 ? "red" : "green"} sub={t.forecastVariance > 0 ? `تجاوز ${fmtMoney(t.forecastVariance)}` : `وفر ${fmtMoney(-t.forecastVariance)}`} />
        <KpiCard label="طلبات 2027" value={fmtMoney(data.planning.requested)} sub="دورة إعداد الميزانية" />
        <KpiCard label="المعتمد مبدئياً 2027" value={fmtMoney(data.planning.approved)} tone="gold" sub={`${data.planning.pending} مبادرة بانتظار الاعتماد`} />
      </div>
      <Panel className="mt-4" title="ميزانية المبادرات حسب المحفظة" subtitle="المعتمد 2026 · المنصرف · التوقع عند الإكمال · المطلوب 2027">
        <div className="h-[240px]"><ResponsiveContainer><BarChart data={data.byPortfolio.map((p: any) => ({ name: p.portfolio.replace("محفظة ", ""), "المعتمد 2026": p.approved, المنصرف: p.actual, EAC: p.eac, "المطلوب 2027": p.requested27 }))} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={11}>
          <CartesianGrid vertical={false} stroke="#EEF0EC" /><XAxis dataKey="name" reversed tick={{ fontSize: 9.5, fill: "#6B7672" }} axisLine={false} tickLine={false} interval={0} /><YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [fmtMoney(Number(v)), ""]} /><Legend wrapperStyle={{ fontSize: 10.5 }} />
          <Bar dataKey="المعتمد 2026" fill="#0E3F36" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="المنصرف" fill="#0F7A4E" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="EAC" fill="#C9A227" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="المطلوب 2027" fill="#2F6F8F" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer></div>
      </Panel>
      <div className="card mt-4 px-4 py-2.5 flex items-center gap-2 text-[11px]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المبادرات…" className="flex-1 rounded-md border border-brand-border bg-brand-cream px-3 py-1.5" />
        <select value={pf} onChange={(e) => setPf(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1.5"><option value="all">جميع المحافظ</option>{pfs.map(([id, n]: any) => <option key={id} value={String(id)}>{n}</option>)}</select>
      </div>
      <Panel className="mt-4" title={`المبادرات (${list.length})`} subtitle="ميزانية متعددة السنوات — 2025 فعلي · 2026 معتمد ومنصرف · 2027 مطلوب ومعتمد مبدئياً">
        <div className="max-h-[560px] overflow-y-auto"><table className="w-full text-[11px] whitespace-nowrap">
          <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["المبادرة", "المحفظة", "الإجمالي المعتمد", "2025 فعلي", "2026 معتمد", "2026 منصرف", "نسبة الصرف", "EAC", "2027 مطلوب", "2027 معتمد", "التمويل"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{list.map((p: any) => (
            <tr key={p.id} className="border-b border-brand-border/70 last:border-0 hover:bg-brand-cream/60">
              <td className="py-1.5"><Link to={`/projects/${p.id}`} className="font-semibold hover:text-brand-green">{p.nameAr}</Link><div className="text-[9.5px] text-brand-muted">{p.code} · {p.sector}</div></td><td className="py-1.5 text-center text-brand-muted text-[10px]">{p.portfolio.replace("محفظة ", "")}</td>
              <td className="py-1.5 text-center num font-semibold">{p.totalApproved}</td><td className="py-1.5 text-center num">{p.y25?.actual ?? "—"}</td><td className="py-1.5 text-center num">{p.y26?.approved ?? "—"}</td><td className="py-1.5 text-center num">{p.y26?.actual ?? "—"}</td>
              <td className="py-1.5"><div className="flex items-center gap-2"><ProgressBar value={p.y26?.spendPct ?? 0} tone="brand" className="flex-1 min-w-[40px]" /><span className="num w-9">{p.y26?.spendPct ?? 0}%</span></div></td>
              <td className={clsx("py-1.5 text-center num", (p.y26?.eac ?? 0) > (p.y26?.approved ?? 0) ? "text-rag-red font-semibold" : "")}>{p.y26?.eac ?? "—"}</td><td className="py-1.5 text-center num">{p.y27?.requested ?? "—"}</td>
              <td className="py-1.5 text-center">{p.y27?.approved === null ? <Chip tone="at_risk">بانتظار الاعتماد</Chip> : <span className="num">{p.y27?.approved ?? "—"}</span>}</td><td className="py-1.5 text-center text-[10px] text-brand-muted">{p.y26?.fundingSource ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}

export default function BudgetRouter() {
  return (
    <div>
      <PageHeader title="الميزانية" subtitle="Operating Budget & Initiatives Budget — السنة المالية 2026" description="المصدر: وزارة المالية (الاعتمادات) · Odoo ERP (الالتزامات والمنصرف) · المناقلات عبر مسار العمل داخل المنصة." />
      <ModuleNav />
      <Routes><Route index element={<OverviewScreen />} /><Route path="opex" element={<OpexScreen />} /><Route path="initiatives" element={<InitiativesScreen />} /></Routes>
      <SourcesFooter />
    </div>
  );
}
export { StatusChip };
