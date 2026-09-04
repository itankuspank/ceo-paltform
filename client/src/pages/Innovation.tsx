import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ArrowRight, Plus, Lightbulb, Check } from "lucide-react";
import clsx from "clsx";
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from "recharts";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import RegionMap from "@/components/RegionMap";
import { KpiCard, Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, StatusChip, Empty } from "@/components/ui";
import { StageTracker, WorkflowActions, type WorkflowView } from "@/components/workflow";
import { MATURITY_LEVELS, IDEA_CATEGORIES } from "@shared/schema";
import { ROLE_LABELS } from "@shared/rbac";
import { fmtMoney } from "@shared/format";

const KEYS = [["innovation-map"], ["innovation-matrix"], ["innovation-ideas"], ["decisions"], ["overview"], ["changelog"]];
const LEVEL_COLOR = ["", "#C63B3B", "#E2792C", "#C9A227", "#3E8E5E", "#0E3F36"];
const inp = "rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const lvlName = (v: number) => MATURITY_LEVELS[Math.max(0, Math.min(4, Math.round(v) - 1))];
const Level = ({ v }: { v: number }) => <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-white num" style={{ background: LEVEL_COLOR[Math.max(1, Math.min(5, Math.round(v)))] }}>{Math.round(v)} · {lvlName(v)}</span>;

function ModuleNav() {
  const tabs = [["", "خريطة النضج"], ["matrix", "مصفوفة النضج"], ["ideas", "خط الأفكار"]];
  return <div className="card px-2 py-1.5 mb-4 flex gap-1">{tabs.map(([p, l]) => <NavLink key={p} to={`/innovation${p ? `/${p}` : ""}`} end={p === ""} className={({ isActive }) => clsx("rounded-md px-3 py-1.5 text-[11.5px]", isActive ? "bg-brand text-white font-semibold" : "text-brand-muted hover:bg-brand-cream")}>{l}</NavLink>)}</div>;
}
const Delta = ({ v }: { v: number | null }) => v === null ? <span className="text-brand-muted">—</span> : <span className={clsx("num font-semibold", v > 0 ? "text-rag-green" : v < 0 ? "text-rag-red" : "text-brand-muted")}>{v > 0 ? "+" : ""}{v}</span>;

// ================================================================ map
function MapScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["innovation-map"], queryFn: () => api<any>("/api/innovation/map") });
  const { data: geojson } = useQuery({ queryKey: ["geojson"], queryFn: () => fetch("/geo/saudi-regions.geojson").then((r) => r.json()), staleTime: Infinity });
  const [sel, setSel] = useState<string | null>(null);
  const metrics = useMemo(() => Object.fromEntries((data?.regions ?? []).map((r: any) => [r.code, { code: r.code, nameAr: r.nameAr, impact: 0, investment: 0, initiatives: 0, risks: 0, status: r.status, maturity: r.overall }])), [data]);
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const k = data.kingdom; const region = sel ? data.regions.find((r: any) => r.code === sel) : null;
  const radar = region ? data.dims.map((d: any) => ({ dim: d.nameAr, value: region.scores[d.key] ?? 0 })) : [];
  return (
    <div>
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label={`مؤشر نضج الابتكار — المملكة (${data.cycle})`} value={`${k.index} / 5`} tone={k.status === "on_track" ? "green" : k.status === "at_risk" ? "amber" : "red"} sub={<span>المستوى: <b>{lvlName(k.index)}</b> · مقابل {k.previous} في {data.previousCycle} (<Delta v={k.delta} />)</span>} />
        {[1, 2, 3, 4, 5].map((l) => { const row = k.byLevel.find((x: any) => x.level === l); return <KpiCard key={l} label={`المستوى ${l} · ${MATURITY_LEVELS[l - 1]}`} value={<span style={{ color: LEVEL_COLOR[l] }}>{row.regions}</span>} sub={`منطقة · ${row.sectors} قطاعات`} />; }).slice(0, 4)}
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="خريطة نضج الابتكار" subtitle={`دورة ${data.cycle} — اضغط على منطقة لعرض أبعادها الستة`}>
          <div className="h-[440px]">{geojson ? <RegionMap geojson={geojson} metrics={metrics as any} mode="maturity" selected={sel} onSelect={setSel} /> : <Loading />}</div>
          <div className="mt-2 flex items-center gap-3 text-[10.5px] text-brand-muted flex-wrap">{[1, 2, 3, 4, 5].map((l) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_COLOR[l] }} /> {l} {MATURITY_LEVELS[l - 1]}</span>)}</div>
        </Panel>
        <Panel className="col-span-2" title={region ? region.nameAr : "المملكة — المناطق"} subtitle={region ? `نضج ${region.overall} / 5 · الهدف ${region.target ?? "—"} · فجوة ${region.gap ?? "—"}` : "مرتبة حسب النضج — مع التغير عن الدورة السابقة"} actions={region && <button onClick={() => setSel(null)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green"><ArrowRight className="h-3 w-3" /> المملكة</button>}>
          {!region ? (
            <ul className="divide-y divide-brand-border max-h-[460px] overflow-y-auto">{[...data.regions].sort((a: any, b: any) => b.overall - a.overall).map((r: any) => <li key={r.code}><button onClick={() => setSel(r.code)} className="w-full flex items-center justify-between gap-2 py-2 px-1 text-right hover:bg-brand-cream rounded"><div><div className="text-[12px] font-semibold">{r.nameAr}</div><div className="text-[10px] text-brand-muted">{r.ideas} فكرة · هدف {r.target ?? "—"}</div></div><div className="flex items-center gap-2"><Delta v={r.delta} /><Level v={r.overall} /></div></button></li>)}</ul>
          ) : (
            <div>
              <div className="h-[230px]"><ResponsiveContainer><RadarChart data={radar} outerRadius={85}><PolarGrid stroke="#E4E6E1" /><PolarAngleAxis dataKey="dim" tick={{ fontSize: 9.5, fill: "#1F2A26" }} /><PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 8 }} axisLine={false} /><Radar dataKey="value" stroke="#0E3F36" fill="#0F6B4B" fillOpacity={0.35} isAnimationActive={false} /><Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} /></RadarChart></ResponsiveContainer></div>
              <div className="grid grid-cols-3 gap-2 text-center mt-1">{[["النضج", region.overall], ["الدورة السابقة", region.previous ?? "—"], ["الأفكار", region.ideas]].map(([l, v]) => <div key={l as string} className="rounded-lg border border-brand-border bg-brand-cream px-2 py-1.5"><div className="text-[14px] font-bold num">{v as any}</div><div className="text-[10px] text-brand-muted">{l as string}</div></div>)}</div>
              <div className="mt-2 text-[10.5px] text-brand-muted">الشواهد: {region.evidenceAr ?? "—"}</div>
              <Link to="/innovation/matrix" className="mt-2 inline-block text-[11px] font-semibold text-brand-green">التفاصيل في المصفوفة</Link>
            </div>
          )}
        </Panel>
      </div>
      <Panel className="mt-4" title="نضج القطاعات" subtitle="مرتبة من الأعلى — التغير عن الدورة السابقة والفجوة عن الهدف">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">{data.sectors.map((sc: any) => <div key={sc.id} className="flex items-center justify-between gap-3 border-b border-brand-border/70 pb-1.5"><span className="text-[11.5px] font-semibold">{sc.nameAr}</span><span className="flex items-center gap-2 text-[10.5px]"><span className="text-brand-muted">فجوة {sc.gap ?? "—"}</span><Delta v={sc.delta} /><Level v={sc.overall} /></span></div>)}</div>
      </Panel>
    </div>
  );
}

// ================================================================ matrix
function MatrixScreen() {
  const { user, can } = useAuth(); const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["innovation-matrix"], queryFn: () => api<any>("/api/innovation/matrix") });
  const [view, setView] = useState<"sectors" | "regions">("sectors"); const [show, setShow] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<any>({ subjectType: "sector", subjectId: "", assessorAr: "", evidenceAr: "", scores: {} });
  const submit = useMutation({ mutationFn: () => post("/api/innovation/assessments", f), onSuccess: () => { KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); setShow(false); setErr(null); }, onError: (e: any) => setErr(e.message) });
  const publish = useMutation({ mutationFn: (id: number) => post(`/api/innovation/assessments/${id}/publish`, {}), onSuccess: () => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })) });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const rows = view === "sectors" ? data.sectors : data.regions; const canAssess = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("innovation"));
  const subjects = view === "sectors" ? data.sectors : data.regions;
  return (
    <div>
      <div className="card px-4 py-2.5 text-[11px] text-brand-muted">النموذج: ستة أبعاد متوائمة مع ISO 56002 · خمسة مستويات (1 مبتدئ → 5 رائد) · النضج العام = متوسط مرجّح بأوزان الأبعاد · الأضعف حالياً: <b className="text-brand-text">{data.weakest.map((d: any) => d.nameAr).join(" و")}</b></div>
      <div className="mt-3 grid grid-cols-6 gap-2">{data.dimAvg.map((d: any) => <div key={d.key} className="card px-3 py-2"><div className="text-[10.5px] font-semibold">{d.nameAr}</div><div className="text-[9.5px] text-brand-muted">الوزن {d.weight}%</div><div className="mt-1 flex items-baseline gap-2"><span className="text-[16px] font-bold num">{d.sectors}</span><span className="text-[9.5px] text-brand-muted">قطاعات</span><span className="text-[16px] font-bold num">{d.regions}</span><span className="text-[9.5px] text-brand-muted">مناطق</span></div></div>)}</div>
      <div className="card mt-4 px-4 py-2.5 flex items-center gap-2 text-[11px]">{[["sectors", "القطاعات"], ["regions", "المناطق"]].map(([v, l]) => <button key={v} onClick={() => setView(v as any)} className={clsx("chip border", view === v ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{l}</button>)}{canAssess && <button onClick={() => setShow((x) => !x)} className="mr-auto inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> تقييم جديد ({data.cycle})</button>}</div>
      {show && <Panel className="mt-3" title="تقييم نضج الابتكار" subtitle="يُحفظ مسودة ثم يُنشر بعد مراجعة مكتب الابتكار"><div className="grid grid-cols-4 gap-2 text-[11.5px]">
        <select value={f.subjectType} onChange={(e) => setF({ ...f, subjectType: e.target.value, subjectId: "" })} className={inp}><option value="sector">قطاع</option><option value="region">منطقة</option></select>
        <select value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} className={inp}><option value="">الجهة…</option>{(f.subjectType === "sector" ? data.sectors : data.regions).map((x: any) => <option key={x.subjectId} value={x.subjectId}>{x.nameAr}</option>)}</select>
        <input placeholder="المقيّم" value={f.assessorAr} onChange={(e) => setF({ ...f, assessorAr: e.target.value })} className={inp} /><input placeholder="الشواهد" value={f.evidenceAr} onChange={(e) => setF({ ...f, evidenceAr: e.target.value })} className={inp} />
        {data.dims.map((d: any) => <label key={d.key} className="flex items-center justify-between gap-2 rounded-md border border-brand-border px-2.5 py-1.5"><span>{d.nameAr} <span className="text-brand-muted text-[10px]">({d.weight}%)</span></span><select value={f.scores[d.key] ?? ""} onChange={(e) => setF({ ...f, scores: { ...f.scores, [d.key]: e.target.value } })} className={inp}><option value="">—</option>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} · {MATURITY_LEVELS[v - 1]}</option>)}</select></label>)}
      </div>{err && <div className="mt-2 text-[11px] text-rag-red">{err}</div>}<button disabled={submit.isPending || !f.subjectId || data.dims.some((d: any) => !f.scores[d.key])} onClick={() => submit.mutate()} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">حفظ التقييم (مسودة)</button></Panel>}
      {data.drafts.length > 0 && <Panel className="mt-4" title="تقييمات بانتظار النشر" subtitle="مسودات مكتب الابتكار"><ul className="space-y-1.5">{data.drafts.map((d: any) => <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border border-[#EEDDB3] bg-rag-amberBg px-3 py-1.5 text-[11.5px]"><span><b>{d.nameAr}</b> · نضج {d.overall} · {d.assessorAr} · {d.assessedAt}</span>{can("data:approve") && <button onClick={() => publish.mutate(d.id)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white"><Check className="h-3 w-3" /> نشر</button>}</li>)}</ul></Panel>}
      <Panel className="mt-4" title={`مصفوفة النضج — ${view === "sectors" ? "القطاعات" : "المناطق"} × الأبعاد`} subtitle="اللون = المستوى · السهم = التغير عن الدورة السابقة · الهدف والفجوة لدورة الحالية">
        <div className="overflow-x-auto"><table className="w-full text-[11px]">
          <thead><tr className="text-brand-muted text-[10px] border-b border-brand-border"><th className="py-1.5 text-right font-medium">الجهة</th>{data.dims.map((d: any) => <th key={d.key} className="py-1.5 text-center font-medium">{d.nameAr}</th>)}<th className="py-1.5 text-center font-medium">النضج</th><th className="py-1.5 text-center font-medium">التغير</th><th className="py-1.5 text-center font-medium">الهدف / الفجوة</th></tr></thead>
          <tbody>{rows.map((r: any) => (
            <tr key={`${r.subjectType}${r.subjectId}`} className="border-b border-brand-border/70 last:border-0">
              <td className="py-1.5 font-semibold">{r.nameAr}<div className="text-[9.5px] text-brand-muted">{r.evidenceAr ?? ""}</div></td>
              {r.scores.map((sc: any) => <td key={sc.key} className="py-1.5 text-center"><span className="inline-flex h-7 w-10 items-center justify-center rounded-md text-white text-[11px] font-bold num" style={{ background: LEVEL_COLOR[sc.score] }}>{sc.score}{sc.previous !== null && sc.score !== sc.previous && <span className="text-[9px] mr-0.5">{sc.score > sc.previous ? "▲" : "▼"}</span>}</span></td>)}
              <td className="py-1.5 text-center"><Level v={r.overall} /></td><td className="py-1.5 text-center"><Delta v={r.delta} /></td><td className="py-1.5 text-center num">{r.target ?? "—"} / <span className={clsx((r.gap ?? 0) > 0.5 ? "text-rag-red font-semibold" : "text-rag-green")}>{r.gap ?? "—"}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}

// ================================================================ ideas
function IdeasScreen() {
  const { user, can } = useAuth(); const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["innovation-ideas"], queryFn: () => api<any>("/api/innovation/ideas") });
  const sectors = useQuery({ queryKey: ["ref-sectors"], queryFn: () => api<{ id: number; nameAr: string }[]>("/api/reference/sectors"), staleTime: Infinity });
  const regions = useQuery({ queryKey: ["ref-regions"], queryFn: () => api<{ id: number; nameAr: string }[]>("/api/reference/regions"), staleTime: Infinity });
  const [st, setSt] = useState("all"); const [show, setShow] = useState(false); const [err, setErr] = useState<string | null>(null); const [open, setOpen] = useState<number | null>(null);
  const [f, setF] = useState<any>({ titleAr: "", descriptionAr: "", category: "خدمة", sourceType: "sector", sourceId: "", submittedByAr: "", impactValue: "", impactNoteAr: "" });
  const create = useMutation({ mutationFn: () => post("/api/innovation/ideas", f), onSuccess: () => { KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); setShow(false); setErr(null); }, onError: (e: any) => setErr(e.message) });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const k = data.kpis; const list = data.ideas.filter((i: any) => st === "all" || i.status === st); const canSubmit = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("innovation"));
  const maxStage = Math.max(1, ...data.funnel.map((x: any) => x.active));
  return (
    <div>
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="الأفكار المقدّمة" value={k.total} sub={`${k.per100} لكل 100 موظف`} /><KpiCard label="نسبة التوسع" value={`${k.implementedPct}%`} tone="green" sub="أفكار وُسّعت على مستوى الوزارة" /><KpiCard label="من الفكرة إلى التجربة" value={`${k.ideaToPilotDays} يوم`} sub="متوسط" />
        <KpiCard label="الأثر المتحقق" value={fmtMoney(k.realisedImpact)} tone="green" sub="سنوياً — أفكار موسّعة" /><KpiCard label="أثر في الخط" value={fmtMoney(k.pipelineImpact)} sub="تقديري — قيد الإجراء" /><KpiCard label="بانتظار قرار التوسع" value={k.awaitingCeo} tone={k.awaitingCeo ? "amber" : "default"} sub="قرار الرئيس التنفيذي" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="خط الأفكار الابتكارية" subtitle={`فكرة مقدّمة ← التقييم ← نموذج أولي ← تجربة ← قرار التوسع · ${data.completed} موسّعة · ${data.rejected} مستبعدة`}><div className="space-y-2">{data.funnel.map((x: any) => <div key={x.key}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{x.nameAr} <span className="text-brand-muted font-normal">· {ROLE_LABELS[x.ownerRole as keyof typeof ROLE_LABELS]?.ar} · SLA {x.slaDays} يوم{x.requiresDecision ? " · قرار تنفيذي" : ""}</span></span><span className="num font-bold">{x.active}</span></div><ProgressBar value={(x.active / maxStage) * 100} tone={x.requiresDecision ? "gold" : "brand"} className="mt-1" /></div>)}</div></Panel>
        <div className="col-span-2 space-y-4">
          <Panel title="الأفكار حسب التصنيف" subtitle="Categories"><ul className="space-y-1.5">{data.byCategory.map((c: any) => <li key={c.category}><div className="flex justify-between text-[11.5px]"><span>{c.category}</span><span className="num font-bold">{c.n}</span></div><ProgressBar value={(c.n / Math.max(1, ...data.byCategory.map((x: any) => x.n))) * 100} tone="brand" className="mt-1" /></li>)}</ul></Panel>
          <Panel title="المبادرات الابتكارية في خارطة الطريق" subtitle="Initiatives tagged ابتكار">{data.tagged.length === 0 ? <Empty label="—" /> : <ul className="space-y-1">{data.tagged.map((p: any) => <li key={p.id}><Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-2 text-[11px] hover:text-brand-green"><span className="truncate">{p.nameAr}</span><span className="flex items-center gap-1.5"><span className="num text-brand-muted">{p.progress}%</span><StatusChip status={p.status} /></span></Link></li>)}</ul>}</Panel>
        </div>
      </div>
      <div className="card mt-4 px-4 py-2.5 flex items-center gap-2 text-[11px]">{[["all", "الكل"], ["قيد الإجراء", "قيد الإجراء"], ["موسّعة", "موسّعة"], ["مستبعدة", "مستبعدة"]].map(([v, l]) => <button key={v} onClick={() => setSt(v)} className={clsx("chip border", st === v ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{l}</button>)}{canSubmit && <button onClick={() => setShow((x) => !x)} className="mr-auto inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 font-semibold text-white"><Lightbulb className="h-3.5 w-3.5" /> تقديم فكرة</button>}</div>
      {show && <Panel className="mt-3" title="تقديم فكرة ابتكارية" subtitle="تدخل مسار الأفكار وتبدأ بمرحلة التقييم"><div className="grid grid-cols-4 gap-2 text-[11.5px]">
        <input placeholder="عنوان الفكرة" value={f.titleAr} onChange={(e) => setF({ ...f, titleAr: e.target.value })} className={clsx(inp, "col-span-2")} /><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inp}>{IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select><input placeholder="مقدّم الفكرة" value={f.submittedByAr} onChange={(e) => setF({ ...f, submittedByAr: e.target.value })} className={inp} />
        <input placeholder="الوصف" value={f.descriptionAr} onChange={(e) => setF({ ...f, descriptionAr: e.target.value })} className={clsx(inp, "col-span-4")} />
        <select value={f.sourceType} onChange={(e) => setF({ ...f, sourceType: e.target.value, sourceId: "" })} className={inp}><option value="sector">من قطاع</option><option value="region">من منطقة</option></select><select value={f.sourceId} onChange={(e) => setF({ ...f, sourceId: e.target.value })} className={inp}><option value="">الجهة…</option>{(f.sourceType === "sector" ? sectors.data ?? [] : regions.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nameAr}</option>)}</select>
        <input type="number" placeholder="الأثر التقديري (مليون/سنة)" value={f.impactValue} onChange={(e) => setF({ ...f, impactValue: e.target.value })} className={inp} /><input placeholder="وصف الأثر" value={f.impactNoteAr} onChange={(e) => setF({ ...f, impactNoteAr: e.target.value })} className={inp} />
      </div>{err && <div className="mt-2 text-[11px] text-rag-red">{err}</div>}<button disabled={create.isPending || !f.titleAr || !f.descriptionAr || !f.sourceId} onClick={() => create.mutate()} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">تقديم الفكرة</button></Panel>}
      <Panel className="mt-4" title={`الأفكار (${list.length})`} subtitle="اضغط على الفكرة لعرض مسارها والإجراءات">
        <div className="space-y-2">{list.map((i: any) => (
          <div key={i.id} className="rounded-lg border border-brand-border px-3 py-2.5">
            <button onClick={() => setOpen(open === i.id ? null : i.id)} className="w-full text-right"><div className="flex items-center justify-between gap-2 flex-wrap"><div className="text-[12px] font-semibold"><span className="font-mono text-[10px] text-brand-muted ml-1">{i.code}</span>{i.titleAr}</div><div className="flex items-center gap-2"><Chip tone="neutral">{i.category}</Chip>{i.workflow && i.status === "قيد الإجراء" && <Chip tone={i.workflow.slaBreached ? "off_track" : i.workflow.stage.requiresDecision ? "gold" : "at_risk"}>{i.workflow.stage.nameAr} · {i.workflow.daysInStage}/{i.workflow.stage.slaDays}</Chip>}<Chip tone={i.status === "موسّعة" ? "on_track" : i.status === "مستبعدة" ? "off_track" : "at_risk"}>{i.status}</Chip><span className="text-[12px] font-bold num">{fmtMoney(i.impactValue)}/سنة</span></div></div><div className="text-[10.5px] text-brand-muted mt-0.5">{i.descriptionAr} · المصدر: {i.sourceName} · {i.submittedByAr} · قُدمت منذ {i.ageDays} يوم{i.linkedProject ? ` · مرتبطة بـ ${i.linkedProject}` : ""}</div></button>
            {open === i.id && i.workflow && <div className="mt-2 space-y-2"><StageTracker wf={i.workflow as WorkflowView} compact /><WorkflowActions wf={i.workflow as WorkflowView & { instanceId: number }} invalidate={KEYS} /></div>}
          </div>
        ))}{list.length === 0 && <Empty label="لا توجد أفكار" />}</div>
      </Panel>
    </div>
  );
}

export default function InnovationRouter() {
  return (
    <div>
      <PageHeader title="مسار الابتكار" subtitle="Innovation Maturity — Sectors · Regions · Ideas" description="نضج الابتكار عبر قطاعات الوزارة ومناطق المملكة وفق نموذج من ستة أبعاد وخمسة مستويات، وخط الأفكار من التقديم إلى قرار التوسع." />
      <ModuleNav />
      <Routes><Route index element={<MapScreen />} /><Route path="matrix" element={<MatrixScreen />} /><Route path="ideas" element={<IdeasScreen />} /></Routes>
      <SourcesFooter />
    </div>
  );
}
