import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { Plus, X, ShieldCheck, UserPlus } from "lucide-react";
import clsx from "clsx";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { KpiCard, Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, StatusChip, Empty } from "@/components/ui";
import { StageTracker, WorkflowActions, WorkflowHistory, type WorkflowView } from "@/components/workflow";
import { ENGAGEMENT_TYPES, BANDS, CLEARANCE } from "@shared/schema";
import { ROLE_LABELS } from "@shared/rbac";
import { MONTHS_AR } from "@shared/format";

const KEYS = [["talent-dashboard"], ["talent-pipeline"], ["talent-requisitions"], ["decisions"], ["overview"], ["resources"], ["changelog"]];
const TYPE_TONE: Record<string, "blue" | "on_track" | "gold"> = { "متعاقد": "blue", "مكلّف": "on_track", "معار": "gold" };
const CLR_TONE: Record<string, "neutral" | "at_risk" | "on_track" | "off_track"> = { "لم يبدأ": "neutral", "قيد الفحص": "at_risk", "مجاز": "on_track", "غير مجاز": "off_track" };
const ST_TONE: Record<string, "at_risk" | "on_track" | "off_track"> = { "قيد الإجراء": "at_risk", "مباشر": "on_track", "مستبعد": "off_track" };
const inp = "rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30";

type Cand = { id: number; code: string; nameAr: string; nameMasked: boolean; engagementType: string; roleAr: string; band: string; isSenior: boolean; sectorName: string; projectName: string | null; projectId: number | null; sourceAr: string | null; currentRoleAr: string | null; clearanceStatus: string; monthlyRate: number | null; secondmentMonths: number | null; referenceAr: string | null; status: string; priority: string; targetStart: string; reqCode: string; requisitionId: number; onboardedResourceId: number | null; onboardedAt: string | null; workflow: (WorkflowView & { instanceId: number; definitionKey: string }) | null };

function ModuleNav() {
  const tabs = [["", "لوحة الاستقطاب"], ["pipeline", "خط الاستقطاب"], ["register", "الاحتياجات والمرشحون"]];
  return <div className="card px-2 py-1.5 mb-4 flex gap-1">{tabs.map(([p, l]) => <NavLink key={p} to={`/talent${p ? `/${p}` : ""}`} end={p === ""} className={({ isActive }) => clsx("rounded-md px-3 py-1.5 text-[11.5px]", isActive ? "bg-brand text-white font-semibold" : "text-brand-muted hover:bg-brand-cream")}>{l}</NavLink>)}</div>;
}

// ================================================================ dashboard
function DashboardScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["talent-dashboard"], queryFn: () => api<any>("/api/talent/dashboard") });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const sm = data.summary;
  return (
    <div>
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="الاحتياج المعتمد" value={sm.needed} sub="وظيفة مطلوبة" /><KpiCard label="تم شغلها" value={sm.filled} tone="green" sub={`نسبة الشغل ${sm.fillRate}%`} /><KpiCard label="الفجوة" value={sm.gap} tone={sm.gap ? "amber" : "green"} sub={`${sm.pipeline} مرشحاً في الخط`} />
        <KpiCard label="متوسط زمن الشغل" value={`${sm.timeToFill} يوم`} sub="من الاحتياج إلى المباشرة" /><KpiCard label="تجاوزات SLA" value={sm.slaBreaches} tone={sm.slaBreaches ? "red" : "green"} /><KpiCard label="بانتظار الفحص الأمني" value={sm.clearanceBacklog} tone={sm.clearanceBacklog > 5 ? "amber" : "default"} sub={`${sm.awaitingCeo} بانتظار قرار الرئيس التنفيذي`} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">{data.byType.map((t: any) => (
        <div key={t.type} className="card px-4 py-3"><div className="flex items-center justify-between"><div className="text-[13.5px] font-bold">{t.type}</div><Chip tone={TYPE_TONE[t.type]}>{t.pipeline} في الخط</Chip></div>
          <div className="mt-2 flex items-end gap-2"><span className="text-[22px] font-bold num">{t.filled}</span><span className="text-[11px] text-brand-muted mb-1">من {t.needed} مطلوب</span></div>
          <ProgressBar value={t.needed ? (t.filled / t.needed) * 100 : 0} className="mt-1.5" />
          <div className="text-[10.5px] text-brand-muted mt-1">{t.breached ? <span className="text-rag-red">{t.breached} تجاوز SLA</span> : "ضمن المدد المعتمدة"}</div></div>
      ))}</div>
      <div className="mt-4 grid grid-cols-3 gap-4">{data.funnels.map((f: any) => {
        const max = Math.max(1, ...f.stages.map((st: any) => st.active));
        return <Panel key={f.type} title={`مسار ${f.type}`} subtitle={`${f.completed} مباشرة · ${f.rejected} مستبعد`}><div className="space-y-2">{f.stages.map((st: any) => <div key={st.key}><div className="flex justify-between text-[11px]"><span>{st.nameAr} <span className="text-brand-muted">· {ROLE_LABELS[st.ownerRole as keyof typeof ROLE_LABELS]?.ar} · {st.slaDays} يوم</span></span><span className="num font-bold">{st.active}</span></div><ProgressBar value={(st.active / max) * 100} tone="brand" className="mt-1" /></div>)}</div></Panel>;
      })}</div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="الوظائف الحرجة غير المشغولة" subtitle="أولوية عاجلة — الفجوة والمرشحون في الخط وتجاوز تاريخ المباشرة">
          {data.critical.length === 0 ? <Empty label="لا توجد وظائف حرجة غير مشغولة" /> : <table className="w-full text-[11.5px]"><thead><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["الوظيفة", "النوع", "القطاع / المبادرة", "الفجوة", "في الخط", "المباشرة المستهدفة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i < 3 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
            <tbody>{data.critical.map((r: any) => <tr key={r.id} className="border-b border-brand-border/70 last:border-0"><td className="py-1.5 font-semibold">{r.roleAr}{r.isSenior && <Chip tone="gold" className="mr-1">قيادية</Chip>}</td><td className="py-1.5"><Chip tone={TYPE_TONE[r.engagementType]}>{r.engagementType}</Chip></td><td className="py-1.5 text-[10.5px]">{r.sectorName}{r.projectName ? <div className="text-brand-muted">{r.projectName}</div> : null}</td><td className="py-1.5 text-center num font-bold text-rag-red">{r.gap}</td><td className="py-1.5 text-center num">{r.pipeline}</td><td className="py-1.5 text-center"><Chip tone={r.overdue ? "off_track" : "neutral"}>{r.targetStart}{r.overdue && " · متأخر"}</Chip></td></tr>)}</tbody></table>}
        </Panel>
        <div className="col-span-2 space-y-4">
          <Panel title="المباشرات المتوقعة" subtitle="حسب الشهر — بناءً على المرحلة الحالية ومدد SLA المتبقية"><ul className="space-y-1.5">{data.expectedJoiners.map((j: any) => <li key={j.month}><div className="flex justify-between text-[11.5px]"><span>{MONTHS_AR[Number(j.month.slice(5, 7)) - 1]} {j.month.slice(0, 4)}</span><span className="num font-bold">{j.n}</span></div><ProgressBar value={(j.n / Math.max(1, ...data.expectedJoiners.map((x: any) => x.n))) * 100} tone="brand" className="mt-1" /></li>)}</ul></Panel>
          <Panel title="أحدث المباشرات" subtitle="أُنشئ لكل منهم سجل في الموارد"><ul className="space-y-1">{data.recentJoiners.map((j: any) => <li key={j.id} className="flex items-center justify-between gap-2 text-[11.5px]"><span className={clsx(j.nameMasked && "text-brand-muted")}>{j.nameAr} <span className="text-brand-muted">· {j.roleAr}</span></span><span className="flex items-center gap-1"><Chip tone={TYPE_TONE[j.engagementType]}>{j.engagementType}</Chip>{j.resourceId && <Link to="/resources" className="text-[10px] text-brand-green font-semibold">الموارد</Link>}</span></li>)}</ul></Panel>
        </div>
      </div>
      <Panel className="mt-4" title="الاحتياج مقابل الشغل حسب القطاع" subtitle="Demand vs filled by sector"><div className="space-y-2">{data.bySector.map((x: any) => <div key={x.sector}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{x.sector}</span><span className="num">{x.filled} / {x.needed}</span></div><ProgressBar value={x.needed ? (x.filled / x.needed) * 100 : 0} className="mt-1" /></div>)}</div></Panel>
    </div>
  );
}

// ================================================================ Kanban pipeline
function CandidateDrawer({ c, onClose }: { c: Cand; onClose: () => void }) {
  const { user, can } = useAuth(); const qc = useQueryClient(); const [clr, setClr] = useState(c.clearanceStatus);
  const canEdit = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("talent"));
  const setClearance = useMutation({ mutationFn: () => api(`/api/talent/candidates/${c.id}/clearance`, { method: "PUT", body: JSON.stringify({ status: clr }) }), onSuccess: () => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })) });
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}><div className="flex-1 bg-black/25" />
      <div className="w-[460px] bg-white h-full shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-brand-border px-4 py-3 flex items-center justify-between"><div><div className="text-[14px] font-bold">{c.nameAr}{c.nameMasked && <span className="text-[10px] text-brand-muted mr-2">(الاسم محجوب وفق سياسة الخصوصية)</span>}</div><div className="text-[10.5px] text-brand-muted">{c.code} · {c.roleAr} · {c.band}{c.isSenior && " · وظيفة قيادية"}</div></div><button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-brand-cream"><X className="h-4 w-4" /></button></div>
        <div className="px-4 py-3 space-y-3 text-[11.5px]">
          <div className="flex flex-wrap gap-1.5"><Chip tone={TYPE_TONE[c.engagementType]}>{c.engagementType}</Chip><Chip tone={ST_TONE[c.status]}>{c.status}</Chip><Chip tone={CLR_TONE[c.clearanceStatus]}><ShieldCheck className="h-3 w-3" /> الفحص: {c.clearanceStatus}</Chip><Chip tone={c.priority === "عاجلة" ? "off_track" : "neutral"}>أولوية {c.priority}</Chip></div>
          <dl className="space-y-1.5">{[["الاحتياج", `${c.reqCode} · المباشرة المستهدفة ${c.targetStart}`], ["القطاع", c.sectorName], ["المبادرة", c.projectName ?? "—"], [c.engagementType === "متعاقد" ? "المورد" : c.engagementType === "معار" ? "الجهة المعيرة" : "القطاع المرشِّح", c.sourceAr ?? "—"], ["الوظيفة الحالية", c.currentRoleAr ?? "—"], c.monthlyRate ? ["الأجر الشهري", `${c.monthlyRate} ألف ريال`] : null, c.secondmentMonths ? ["مدة الإعارة", `${c.secondmentMonths} شهراً`] : null, ["المرجع", c.referenceAr ?? "—"]].filter(Boolean).map(([l, v]: any) => <div key={l} className="flex justify-between border-b border-brand-border pb-1"><dt className="text-brand-muted">{l}</dt><dd className="font-semibold text-left">{v}</dd></div>)}</dl>
          {c.onboardedResourceId && <div className="rounded-md bg-rag-greenBg border border-[#CFE6D8] px-3 py-2">مباشر منذ {c.onboardedAt} — <Link to="/resources" className="font-semibold text-brand-green">سجل المورد #{c.onboardedResourceId}</Link> · مؤهل لبرامج تطوير القدرات</div>}
          {c.workflow && <div><div className="text-[10.5px] text-brand-muted mb-1">مسار الاستقطاب</div><StageTracker wf={c.workflow} compact /></div>}
          {canEdit && c.status === "قيد الإجراء" && <div className="flex items-center gap-2"><span className="text-brand-muted">الفحص الأمني:</span><select value={clr} onChange={(e) => setClr(e.target.value)} className={inp}>{CLEARANCE.map((x) => <option key={x} value={x}>{x}</option>)}</select><button disabled={clr === c.clearanceStatus || setClearance.isPending} onClick={() => setClearance.mutate()} className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">تحديث</button></div>}
          {c.workflow && <WorkflowActions wf={c.workflow} invalidate={KEYS} />}
          {c.workflow?.history && <div><div className="text-[10.5px] text-brand-muted mb-1">السجل</div><WorkflowHistory history={c.workflow.history} /></div>}
        </div>
      </div>
    </div>
  );
}

function PipelineScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["talent-pipeline"], queryFn: () => api<Cand[]>("/api/talent/pipeline") });
  const [type, setType] = useState<string>("متعاقد"); const [sector, setSector] = useState("all"); const [sel, setSel] = useState<number | null>(null);
  const sectors = useMemo(() => Array.from(new Set((data ?? []).map((c) => c.sectorName))), [data]);
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const list = data.filter((c) => c.engagementType === type && (sector === "all" || c.sectorName === sector));
  const stages = list.find((c) => c.workflow)?.workflow?.stages ?? [];
  const selected = data.find((c) => c.id === sel);
  return (
    <div>
      <div className="card px-4 py-2.5 flex items-center gap-2 text-[11px] flex-wrap">
        {ENGAGEMENT_TYPES.map((t) => <button key={t} onClick={() => setType(t)} className={clsx("chip border", type === t ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{t} · {data.filter((c) => c.engagementType === t && c.status === "قيد الإجراء").length}</button>)}
        <select value={sector} onChange={(e) => setSector(e.target.value)} className={clsx(inp, "mr-auto")}><option value="all">جميع القطاعات</option>{sectors.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length + 2}, minmax(0, 1fr))` }}>
        {stages.map((st, i) => { const cards = list.filter((c) => c.status === "قيد الإجراء" && c.workflow?.stageIndex === i); return (
          <div key={st.key} className="rounded-xl bg-brand-cream border border-brand-border p-2 min-h-[420px]">
            <div className="px-1 pb-2 border-b border-brand-border mb-2"><div className="flex items-center justify-between"><span className="text-[11.5px] font-bold">{st.nameAr}</span><span className="text-[10.5px] num rounded-full bg-white border border-brand-border px-1.5">{cards.length}</span></div><div className="text-[9.5px] text-brand-muted">{ROLE_LABELS[st.ownerRole]?.ar} · SLA {st.slaDays} يوم{st.requiresDecision ? " · قرار تنفيذي" : ""}</div></div>
            <div className="space-y-1.5">{cards.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)} className={clsx("w-full text-right rounded-lg bg-white border px-2.5 py-2 shadow-card hover:border-brand-green/50", c.workflow?.slaBreached ? "border-[#F0C9C9]" : "border-brand-border")}>
                <div className="text-[11.5px] font-semibold truncate">{c.nameAr}{c.isSenior && <span className="text-[9px] text-[#8A6A12] mr-1">قيادية</span>}</div><div className="text-[10px] text-brand-muted truncate">{c.roleAr}</div><div className="text-[9.5px] text-brand-muted truncate">{c.sectorName}</div>
                <div className="mt-1.5 flex items-center justify-between"><span className={clsx("text-[10px] num", c.workflow?.slaBreached ? "text-rag-red font-bold" : "text-brand-muted")}>{c.workflow?.daysInStage}/{st.slaDays} يوم</span><span className={clsx("h-2 w-2 rounded-full", c.clearanceStatus === "مجاز" ? "bg-rag-green" : c.clearanceStatus === "قيد الفحص" ? "bg-rag-amber" : c.clearanceStatus === "غير مجاز" ? "bg-rag-red" : "bg-brand-border")} title={`الفحص الأمني: ${c.clearanceStatus}`} /></div>
              </button>
            ))}{cards.length === 0 && <div className="text-[10px] text-brand-muted text-center py-4">—</div>}</div>
          </div>); })}
        <div className="rounded-xl bg-rag-greenBg border border-[#CFE6D8] p-2 min-h-[420px]"><div className="px-1 pb-2 border-b border-[#CFE6D8] mb-2 text-[11.5px] font-bold text-rag-green">مباشر · {list.filter((c) => c.status === "مباشر").length}</div><div className="space-y-1.5">{list.filter((c) => c.status === "مباشر").map((c) => <button key={c.id} onClick={() => setSel(c.id)} className="w-full text-right rounded-lg bg-white border border-[#CFE6D8] px-2.5 py-2 text-[11px]"><div className="font-semibold truncate">{c.nameAr}</div><div className="text-[9.5px] text-brand-muted">{c.roleAr} · {c.onboardedAt}</div></button>)}</div></div>
        <div className="rounded-xl bg-rag-redBg border border-[#F0C9C9] p-2 min-h-[420px]"><div className="px-1 pb-2 border-b border-[#F0C9C9] mb-2 text-[11.5px] font-bold text-rag-red">مستبعد · {list.filter((c) => c.status === "مستبعد").length}</div><div className="space-y-1.5">{list.filter((c) => c.status === "مستبعد").map((c) => <button key={c.id} onClick={() => setSel(c.id)} className="w-full text-right rounded-lg bg-white border border-[#F0C9C9] px-2.5 py-2 text-[11px] opacity-80"><div className="font-semibold truncate">{c.nameAr}</div><div className="text-[9.5px] text-brand-muted">{c.roleAr}</div></button>)}</div></div>
      </div>
      <div className="mt-2 text-[10px] text-brand-muted">النقطة الملونة = حالة الفحص الأمني · الإطار الأحمر = تجاوز SLA · الأسماء تظهر لمسؤول الاستقطاب، وللرئيس التنفيذي في الوظائف القيادية فقط</div>
      {selected && <CandidateDrawer c={selected} onClose={() => setSel(null)} />}
    </div>
  );
}

// ================================================================ register
function RegisterScreen() {
  const { user, can } = useAuth(); const qc = useQueryClient();
  const reqs = useQuery({ queryKey: ["talent-requisitions"], queryFn: () => api<any[]>("/api/talent/requisitions") });
  const cands = useQuery({ queryKey: ["talent-pipeline"], queryFn: () => api<Cand[]>("/api/talent/pipeline") });
  const sectors = useQuery({ queryKey: ["ref-sectors"], queryFn: () => api<{ id: number; nameAr: string }[]>("/api/reference/sectors"), staleTime: Infinity });
  const projects = useQuery({ queryKey: ["fk-options", "projects"], queryFn: () => api<{ id: number; label: string }[]>("/api/data/projects/options") });
  const [showReq, setShowReq] = useState(false); const [showCand, setShowCand] = useState(false); const [err, setErr] = useState<string | null>(null); const [q, setQ] = useState("");
  const [rf, setRf] = useState<any>({ roleAr: "", sectorId: "", projectId: "", engagementType: "متعاقد", band: "متخصص", count: 1, priority: "متوسطة", isSenior: false, targetStart: "", justificationAr: "" });
  const [cf, setCf] = useState<any>({ requisitionId: "", nameAr: "", sourceAr: "", currentRoleAr: "", monthlyRate: "", secondmentMonths: "" });
  const canEdit = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("talent"));
  const inv = () => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  const createReq = useMutation({ mutationFn: () => post("/api/talent/requisitions", rf), onSuccess: () => { inv(); setShowReq(false); setErr(null); }, onError: (e: any) => setErr(e.message) });
  const createCand = useMutation({ mutationFn: () => post("/api/talent/candidates", cf), onSuccess: () => { inv(); setShowCand(false); setErr(null); }, onError: (e: any) => setErr(e.message) });
  if (reqs.isLoading || cands.isLoading) return <Loading />; if (reqs.error || !reqs.data || !cands.data) return <ErrorBox message={(reqs.error as Error)?.message ?? "خطأ"} />;
  const openReqs = reqs.data.filter((r) => r.status === "مفتوح"); const selReq = reqs.data.find((r) => String(r.id) === cf.requisitionId);
  const clist = cands.data.filter((c) => !q || c.nameAr.includes(q) || c.roleAr.includes(q) || c.reqCode.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="card px-4 py-2.5 flex items-center gap-2 text-[11px]"><span className="text-brand-muted">{reqs.data.length} احتياجاً · {cands.data.length} مرشحاً</span>{canEdit && <><button onClick={() => { setShowReq((v) => !v); setShowCand(false); }} className="mr-auto inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-2.5 py-1.5 font-semibold hover:bg-brand-cream"><Plus className="h-3.5 w-3.5" /> احتياج جديد</button><button onClick={() => { setShowCand((v) => !v); setShowReq(false); }} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 font-semibold text-white"><UserPlus className="h-3.5 w-3.5" /> ترشيح مرشح</button></>}</div>
      {showReq && <Panel className="mt-3" title="تسجيل احتياج وظيفي" subtitle="Requisition"><div className="grid grid-cols-4 gap-2 text-[11.5px]">
        <input placeholder="المسمى الوظيفي" value={rf.roleAr} onChange={(e) => setRf({ ...rf, roleAr: e.target.value })} className={clsx(inp, "col-span-2")} />
        <select value={rf.sectorId} onChange={(e) => setRf({ ...rf, sectorId: e.target.value })} className={inp}><option value="">القطاع…</option>{(sectors.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nameAr}</option>)}</select>
        <select value={rf.projectId} onChange={(e) => setRf({ ...rf, projectId: e.target.value })} className={inp}><option value="">المبادرة (اختياري)…</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <select value={rf.engagementType} onChange={(e) => setRf({ ...rf, engagementType: e.target.value })} className={inp}>{ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={rf.band} onChange={(e) => setRf({ ...rf, band: e.target.value })} className={inp}>{BANDS.map((b) => <option key={b} value={b}>الفئة: {b}</option>)}</select>
        <input type="number" min={1} placeholder="العدد" value={rf.count} onChange={(e) => setRf({ ...rf, count: e.target.value })} className={inp} />
        <select value={rf.priority} onChange={(e) => setRf({ ...rf, priority: e.target.value })} className={inp}>{["عاجلة", "مرتفعة", "متوسطة"].map((p) => <option key={p} value={p}>الأولوية: {p}</option>)}</select>
        <input type="date" value={rf.targetStart} onChange={(e) => setRf({ ...rf, targetStart: e.target.value })} className={inp} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={rf.isSenior} onChange={(e) => setRf({ ...rf, isSenior: e.target.checked })} className="accent-brand-green" /> وظيفة قيادية (الاسم يظهر للرئيس التنفيذي)</label>
        <input placeholder="المبرر" value={rf.justificationAr} onChange={(e) => setRf({ ...rf, justificationAr: e.target.value })} className={clsx(inp, "col-span-2")} />
      </div>{err && <div className="mt-2 text-[11px] text-rag-red">{err}</div>}<button disabled={createReq.isPending || !rf.roleAr || !rf.sectorId || !rf.targetStart} onClick={() => createReq.mutate()} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">تسجيل الاحتياج</button></Panel>}
      {showCand && <Panel className="mt-3" title="ترشيح مرشح على احتياج مفتوح" subtitle="يبدأ مسار الاستقطاب المناسب لنوع الاحتياج تلقائياً"><div className="grid grid-cols-3 gap-2 text-[11.5px]">
        <select value={cf.requisitionId} onChange={(e) => setCf({ ...cf, requisitionId: e.target.value })} className={clsx(inp, "col-span-3")}><option value="">الاحتياج…</option>{openReqs.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.roleAr} · {r.engagementType} · {r.sectorName} ({r.filled}/{r.count})</option>)}</select>
        <input placeholder="اسم المرشح" value={cf.nameAr} onChange={(e) => setCf({ ...cf, nameAr: e.target.value })} className={inp} />
        <input placeholder={selReq?.engagementType === "متعاقد" ? "المورد / الشركة" : selReq?.engagementType === "معار" ? "الجهة المعيرة" : "القطاع المرشِّح"} value={cf.sourceAr} onChange={(e) => setCf({ ...cf, sourceAr: e.target.value })} className={inp} />
        <input placeholder="الوظيفة الحالية" value={cf.currentRoleAr} onChange={(e) => setCf({ ...cf, currentRoleAr: e.target.value })} className={inp} />
        {selReq?.engagementType === "متعاقد" && <input type="number" placeholder="الأجر الشهري (ألف ريال)" value={cf.monthlyRate} onChange={(e) => setCf({ ...cf, monthlyRate: e.target.value })} className={inp} />}
        {selReq?.engagementType === "معار" && <input type="number" placeholder="مدة الإعارة (شهر)" value={cf.secondmentMonths} onChange={(e) => setCf({ ...cf, secondmentMonths: e.target.value })} className={inp} />}
      </div>{err && <div className="mt-2 text-[11px] text-rag-red">{err}</div>}<button disabled={createCand.isPending || !cf.requisitionId || !cf.nameAr} onClick={() => createCand.mutate()} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">تسجيل الترشيح وبدء المسار</button></Panel>}
      <Panel className="mt-4" title="سجل الاحتياجات" subtitle="Requisitions register">
        <table className="w-full text-[11px]"><thead><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["الاحتياج", "النوع", "القطاع / المبادرة", "الفئة", "المطلوب / المشغول", "في الخط", "الأولوية", "المباشرة المستهدفة", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i < 3 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{reqs.data.map((r) => <tr key={r.id} className="border-b border-brand-border/70 last:border-0"><td className="py-1.5"><span className="font-semibold">{r.roleAr}</span>{r.isSenior && <Chip tone="gold" className="mr-1">قيادية</Chip>}<div className="text-[9.5px] text-brand-muted font-mono">{r.code} · {r.requestedAt}</div></td><td className="py-1.5"><Chip tone={TYPE_TONE[r.engagementType]}>{r.engagementType}</Chip></td><td className="py-1.5 text-[10.5px]">{r.sectorName}{r.projectName && <div className="text-brand-muted">{r.projectName}</div>}</td><td className="py-1.5 text-center">{r.band}</td><td className="py-1.5"><div className="flex items-center gap-2"><ProgressBar value={(r.filled / r.count) * 100} className="flex-1 min-w-[40px]" /><span className="num text-[10px]">{r.filled}/{r.count}</span></div></td><td className="py-1.5 text-center num">{r.pipeline}</td><td className="py-1.5 text-center"><Chip tone={r.priority === "عاجلة" ? "off_track" : r.priority === "مرتفعة" ? "at_risk" : "neutral"}>{r.priority}</Chip></td><td className="py-1.5 text-center"><span className={clsx("num", r.overdue && "text-rag-red font-semibold")}>{r.targetStart}</span></td><td className="py-1.5 text-center"><Chip tone={r.status === "مكتمل" ? "on_track" : r.status === "مفتوح" ? "at_risk" : "neutral"}>{r.status}</Chip></td></tr>)}</tbody></table>
      </Panel>
      <Panel className="mt-4" title="سجل المرشحين" subtitle="Candidates register — الأسماء وفق سياسة الخصوصية" actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className={inp} />}>
        <div className="max-h-[480px] overflow-y-auto"><table className="w-full text-[11px]"><thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["المرشح", "الاحتياج", "النوع", "المصدر", "الفحص الأمني", "المرحلة", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i < 2 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{clist.map((c) => <tr key={c.id} className="border-b border-brand-border/70 last:border-0"><td className="py-1.5"><span className={clsx("font-semibold", c.nameMasked && "text-brand-muted")}>{c.nameAr}</span><div className="text-[9.5px] text-brand-muted font-mono">{c.code}</div></td><td className="py-1.5 text-[10.5px]">{c.roleAr}<div className="text-brand-muted font-mono text-[9.5px]">{c.reqCode}</div></td><td className="py-1.5 text-center"><Chip tone={TYPE_TONE[c.engagementType]}>{c.engagementType}</Chip></td><td className="py-1.5 text-center text-[10.5px]">{c.sourceAr ?? "—"}</td><td className="py-1.5 text-center"><Chip tone={CLR_TONE[c.clearanceStatus]}>{c.clearanceStatus}</Chip></td><td className="py-1.5 text-center">{c.workflow ? <Chip tone={c.workflow.status !== "active" ? "neutral" : c.workflow.slaBreached ? "off_track" : "at_risk"}>{c.workflow.stage.nameAr}</Chip> : "—"}</td><td className="py-1.5 text-center"><Chip tone={ST_TONE[c.status]}>{c.status}</Chip></td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}

export default function TalentRouter() {
  return (
    <div>
      <PageHeader title="مسار الاستقطاب" subtitle="Talent Acquisition — متعاقدون · مكلّفون · معارون" description="الاحتياج مقابل الشغل، وخط الاستقطاب بمراحله ومدده، والمباشرة التي تُنشئ سجل المورد تلقائياً في المنصة." />
      <ModuleNav />
      <Routes><Route index element={<DashboardScreen />} /><Route path="pipeline" element={<PipelineScreen />} /><Route path="register" element={<RegisterScreen />} /></Routes>
      <SourcesFooter />
    </div>
  );
}
export { StatusChip };
