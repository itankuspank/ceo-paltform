import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { Search, ChevronLeft, ChevronDown, ChevronRight, Plus, ArrowRight } from "lucide-react";
import clsx from "clsx";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { KpiCard, Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, StatusChip, Empty } from "@/components/ui";
import { StageTracker, WorkflowActions, WorkflowHistory, type WorkflowView } from "@/components/workflow";
import { ORG_LEVELS, ORG_REQUEST_TYPES, ORG_AUTHORITIES } from "@shared/schema";

const KEYS = [["org-center"], ["org-requests"], ["org-request"], ["org-tree"], ["org-unit"], ["decisions"], ["changelog"]];
const LEVEL_TONE: Record<string, string> = { "وزارة": "bg-brand text-white", "قطاع": "bg-brand-soft text-white", "وكالة / إدارة عامة": "bg-[#FBF6E7] text-[#8A6A12] border border-brand-gold", "إدارة": "bg-rag-greenBg text-rag-green", "قسم": "bg-brand-cream text-brand-muted border border-brand-border" };
const REQ_TONE: Record<string, "at_risk" | "on_track" | "off_track"> = { "قيد الإجراء": "at_risk", "منفذ": "on_track", "مرفوض": "off_track" };
const inp = "rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30";

function ModuleNav() {
  const tabs = [["", "مركز الهياكل"], ["explorer", "مستكشف الهيكل"], ["requests", "طلبات الهياكل"]];
  return <div className="card px-2 py-1.5 mb-4 flex gap-1">{tabs.map(([p, l]) => <NavLink key={p} to={`/org${p ? `/${p}` : ""}`} end={p === ""} className={({ isActive }) => clsx("rounded-md px-3 py-1.5 text-[11.5px]", isActive ? "bg-brand text-white font-semibold" : "text-brand-muted hover:bg-brand-cream")}>{l}</NavLink>)}</div>;
}

// ================================================================ center
function CenterScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["org-center"], queryFn: () => api<any>("/api/org/center") });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const sm = data.summary; const maxStage = Math.max(1, ...data.funnel.map((f: any) => f.active));
  return (
    <div>
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="الوحدات التنظيمية المعتمدة" value={sm.units} sub={data.health.totals.byLevel.map((l: any) => `${l.count} ${l.level}`).slice(1, 4).join(" · ")} />
        <KpiCard label="طلبات قيد الإجراء" value={sm.pending} tone="amber" sub={`${sm.completed} منفذ · ${sm.rejected} مرفوض`} />
        <KpiCard label="بانتظار قرار الرئيس التنفيذي" value={sm.awaitingCeo} tone={sm.awaitingCeo ? "red" : "green"} />
        <KpiCard label="متوسط دورة الطلب" value={`${sm.avgCycleDays} يوم`} sub="من الورود إلى التنفيذ" />
        <KpiCard label="تجاوزات SLA" value={sm.slaBreaches} tone={sm.slaBreaches ? "red" : "green"} />
        <KpiCard label="الوظائف المعتمدة" value={data.health.totals.positions.toLocaleString("en-US")} sub={`شاغرة ${data.health.totals.vacancies.toLocaleString("en-US")}`} />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="مسار طلبات الهياكل" subtitle="عدد الطلبات النشطة في كل مرحلة — SLA لكل مرحلة">
          <div className="space-y-2">{data.funnel.map((f: any) => (
            <div key={f.key}><div className="flex justify-between text-[11.5px]"><span className="font-semibold">{f.nameAr} <span className="text-brand-muted font-normal">· SLA {f.slaDays} يوم{f.requiresDecision ? " · قرار تنفيذي" : ""}</span></span><span className="num font-bold">{f.active}</span></div><ProgressBar value={(f.active / maxStage) * 100} tone={f.requiresDecision ? "gold" : "brand"} className="mt-1" /></div>
          ))}</div>
        </Panel>
        <Panel className="col-span-2" title="بانتظار قرار الرئيس التنفيذي" subtitle="Decision inbox" actions={<Link to="/decisions" className="text-[11px] font-semibold text-brand-green">مركز القرارات</Link>}>
          {data.awaitingDecision.length === 0 ? <Empty label="لا توجد طلبات بانتظار القرار" /> : <ul className="space-y-1.5">{data.awaitingDecision.map((r: any) => (
            <li key={r.id}><Link to={`/org/requests/${r.id}`} className="block rounded-md border border-brand-border px-2.5 py-2 hover:bg-brand-cream"><div className="flex items-center justify-between gap-2"><span className="text-[11.5px] font-semibold truncate">{r.code}: {r.titleAr}</span><Chip tone={r.workflow.slaBreached ? "off_track" : "at_risk"}>{r.workflow.daysInStage} يوم</Chip></div><div className="text-[10px] text-brand-muted">{r.type} · {r.requestingUnit}</div></Link></li>
          ))}</ul>}
        </Panel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Panel title="الطلبات حسب النوع" subtitle="الإجمالي · النشط"><ul className="space-y-1.5 text-[11.5px]">{data.byType.filter((t: any) => t.count).map((t: any) => <li key={t.type} className="flex justify-between border-b border-brand-border/70 pb-1"><span>{t.type}</span><span className="num"><b>{t.count}</b> <span className="text-brand-muted">· نشط {t.active}</span></span></li>)}</ul></Panel>
        <Panel title="الطلبات النشطة حسب القطاع" subtitle="Requests by sector"><ul className="space-y-1.5 text-[11.5px]">{data.bySector.map((x: any) => <li key={x.sector}><div className="flex justify-between"><span>{x.sector}</span><span className="num font-bold">{x.count}</span></div><ProgressBar value={(x.count / (data.bySector[0]?.count || 1)) * 100} tone="brand" className="mt-1" /></li>)}</ul></Panel>
        <Panel title="الطلبات الأقدم" subtitle="Aging — من تاريخ الورود"><ul className="space-y-1.5">{data.aging.map((r: any) => <li key={r.id}><Link to={`/org/requests/${r.id}`} className="flex items-center justify-between gap-2 text-[11.5px] hover:text-brand-green"><span className="truncate"><span className="font-mono text-[10px] text-brand-muted">{r.code}</span> {r.titleAr}</span><Chip tone={r.ageDays > 60 ? "off_track" : r.ageDays > 30 ? "at_risk" : "neutral"}>{r.ageDays} يوم</Chip></Link></li>)}</ul></Panel>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="مؤشرات صحة الهيكل" subtitle="Structural health — مقابل النطاقات المرجعية للتصميم التنظيمي">
          <div className="grid grid-cols-2 gap-2">{data.health.indicators.map((i: any) => (
            <div key={i.key} className="rounded-lg border border-brand-border px-3 py-2 flex items-center justify-between"><div><div className="text-[11.5px] font-semibold">{i.labelAr}</div><div className="text-[10px] text-brand-muted">{i.refAr}</div></div><div className="flex items-center gap-2"><span className="text-[18px] font-bold num">{i.value}</span><StatusChip status={i.status} label={i.status === "on_track" ? "ضمن المرجع" : i.status === "at_risk" ? "يحتاج مراجعة" : "خارج المرجع"} /></div></div>
          ))}</div>
        </Panel>
        <Panel className="col-span-2" title="مبادرات خارطة الطريق المرتبطة بالهياكل" subtitle="Initiatives tagged تنظيمي">
          {data.roadmap.length === 0 ? <Empty label="لا توجد مبادرات موسومة" /> : <ul className="space-y-1.5">{data.roadmap.map((p: any) => <li key={p.id}><Link to={`/projects/${p.id}`} className="block rounded-md border border-brand-border px-2.5 py-1.5 hover:bg-brand-cream"><div className="flex items-center justify-between gap-2"><span className="text-[11.5px] font-semibold truncate">{p.nameAr}</span><StatusChip status={p.status} /></div><div className="flex items-center gap-2 mt-1"><ProgressBar value={p.progress} tone="brand" className="flex-1" /><span className="text-[10px] num">{p.progress}%</span></div></Link></li>)}</ul>}
        </Panel>
      </div>
    </div>
  );
}

// ================================================================ explorer
type Unit = { id: number; code: string; nameAr: string; level: string; parentId: number | null; headNameAr: string | null; positions: number; headcount: number; status: string; pendingRequests: { requestId: number; code: string; action: string }[] };
type Proposed = { requestId: number; code: string; parentId: number | null; nameAr: string; level: string; positions: number };

function TreeNode({ u, byParent, proposed, depth, open, toggle, select, selected, match }: { u: Unit; byParent: Record<number, Unit[]>; proposed: Proposed[]; depth: number; open: Set<number>; toggle: (id: number) => void; select: (id: number) => void; selected: number | null; match: (u: Unit) => boolean }) {
  const kids = byParent[u.id] ?? []; const props = proposed.filter((p) => p.parentId === u.id); const isOpen = open.has(u.id);
  return (
    <div>
      <div className={clsx("flex items-center gap-1.5 rounded-md px-1.5 py-1 cursor-pointer", selected === u.id ? "bg-[#FBF6E7]" : "hover:bg-brand-cream", match(u) && "ring-1 ring-brand-gold")} style={{ marginRight: depth * 14 }} onClick={() => select(u.id)}>
        <button onClick={(e) => { e.stopPropagation(); toggle(u.id); }} className="h-4 w-4 inline-flex items-center justify-center text-brand-muted">{kids.length + props.length > 0 ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-180" />) : <span className="h-1 w-1 rounded-full bg-brand-border" />}</button>
        <span className={clsx("rounded px-1 text-[9px] whitespace-nowrap", LEVEL_TONE[u.level])}>{u.level}</span>
        <span className={clsx("text-[11.5px] truncate", u.status === "ملغى" && "line-through text-brand-muted")}>{u.nameAr}</span>
        {u.positions > 0 && <span className="text-[9.5px] text-brand-muted num mr-auto">{u.headcount}/{u.positions}</span>}
        {u.pendingRequests.length > 0 && <Chip tone="at_risk">{u.pendingRequests.length} طلب</Chip>}
      </div>
      {isOpen && kids.map((k) => <TreeNode key={k.id} u={k} byParent={byParent} proposed={proposed} depth={depth + 1} open={open} toggle={toggle} select={select} selected={selected} match={match} />)}
      {isOpen && props.map((p) => <div key={`p${p.requestId}${p.nameAr}`} className="flex items-center gap-1.5 px-1.5 py-1 text-[11.5px] text-[#8A6A12] border border-dashed border-brand-gold rounded-md" style={{ marginRight: (depth + 1) * 14 }}><span className="rounded px-1 text-[9px] bg-[#FBF6E7]">{p.level}</span>{p.nameAr}<Chip tone="gold">مقترح — {p.code}</Chip></div>)}
    </div>
  );
}

function ExplorerScreen() {
  const { data, isLoading, error } = useQuery({ queryKey: ["org-tree"], queryFn: () => api<{ units: Unit[]; proposed: Proposed[] }>("/api/org/tree") });
  const [q, setQ] = useState(""); const [sel, setSel] = useState<number | null>(null); const [open, setOpen] = useState<Set<number>>(new Set());
  const units = data?.units ?? []; const byParent = useMemo(() => { const m: Record<number, Unit[]> = {}; units.filter((u) => u.status !== "ملغى").forEach((u) => { if (u.parentId) (m[u.parentId] ??= []).push(u); }); return m; }, [units]);
  const root = units.find((u) => !u.parentId);
  const matches = useMemo(() => (q.trim() ? units.filter((u) => u.nameAr.includes(q.trim()) || u.code.toLowerCase().includes(q.trim().toLowerCase()) || (u.headNameAr ?? "").includes(q.trim())) : []), [units, q]);
  const profile = useQuery({ queryKey: ["org-unit", sel], queryFn: () => api<any>(`/api/org/units/${sel}`), enabled: sel !== null });
  if (isLoading) return <Loading />; if (error || !data || !root) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const expandTo = (id: number) => { const s = new Set(open); let cur = units.find((u) => u.id === id); while (cur?.parentId) { s.add(cur.parentId); cur = units.find((u) => u.id === cur!.parentId); } setOpen(s); setSel(id); };
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const p = profile.data;
  return (
    <div className="grid grid-cols-5 gap-4">
      <Panel className="col-span-2" title="الهيكل التنظيمي" subtitle="ابحث عن أي وحدة أو مسؤول — ثم اضغط للاطلاع على ملفها" actions={<button onClick={() => setOpen(new Set(units.filter((u) => u.level !== "إدارة" && u.level !== "قسم").map((u) => u.id)))} className="text-[10.5px] text-brand-green font-semibold">توسيع الكل</button>}>
        <div className="relative mb-2"><Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسأل عن أي وحدة: الاسم، الرمز، أو اسم المسؤول…" className={clsx(inp, "w-full pr-8 bg-brand-cream")} /></div>
        {q.trim() && <div className="mb-2 max-h-40 overflow-y-auto rounded-md border border-brand-border">{matches.length === 0 ? <div className="px-2 py-1.5 text-[11px] text-brand-muted">لا توجد نتائج</div> : matches.slice(0, 12).map((m) => <button key={m.id} onClick={() => expandTo(m.id)} className="w-full text-right px-2 py-1.5 text-[11.5px] hover:bg-brand-cream flex items-center gap-2"><span className={clsx("rounded px-1 text-[9px]", LEVEL_TONE[m.level])}>{m.level}</span>{m.nameAr}{m.headNameAr && <span className="text-[10px] text-brand-muted mr-auto">{m.headNameAr}</span>}</button>)}</div>}
        <div className="max-h-[640px] overflow-y-auto"><TreeNode u={root} byParent={byParent} proposed={data.proposed} depth={0} open={open} toggle={toggle} select={setSel} selected={sel} match={(u) => !!q.trim() && matches.some((m) => m.id === u.id)} /></div>
        <div className="mt-2 text-[10px] text-brand-muted">الإطار المتقطع الذهبي = وحدة مقترحة في طلب قيد الإجراء (الوضع المستقبلي)</div>
      </Panel>
      <div className="col-span-3">
        {sel === null ? <Panel title="ملف الوحدة" subtitle="اختر وحدة من الهيكل"><Empty label="اضغط على أي وحدة في الشجرة أو ابحث عنها لعرض ملفها الكامل: التسلسل، المسؤول، الوظائف، الطلبات المعلقة، المبادرات، والتاريخ" /></Panel>
        : profile.isLoading || !p ? <Loading /> : (
          <div className="space-y-4">
            <div className="card px-5 py-4">
              <div className="text-[10.5px] text-brand-muted flex items-center gap-1 flex-wrap">{p.lineage.map((l: any) => <span key={l.id} className="flex items-center gap-1"><button onClick={() => setSel(l.id)} className="hover:text-brand-green">{l.nameAr}</button><ChevronLeft className="h-3 w-3" /></span>)}<span className="font-semibold text-brand-text">{p.unit.nameAr}</span></div>
              <div className="mt-1 flex items-start justify-between gap-3"><div><div className="text-[18px] font-bold">{p.unit.nameAr}</div><div className="text-[11px] text-brand-muted">{p.unit.code} · <span className={clsx("rounded px-1 text-[10px]", LEVEL_TONE[p.unit.level])}>{p.unit.level}</span> · الرئيس: {p.unit.headNameAr ?? "—"} · الإصدار {p.unit.version}{p.unit.effectiveFrom ? ` · سارٍ من ${p.unit.effectiveFrom}` : ""}</div>{p.unit.functionsAr && <div className="text-[11.5px] mt-1.5">{p.unit.functionsAr}</div>}</div><StatusChip status={p.unit.status === "معتمد" ? "on_track" : p.unit.status === "مقترح" ? "at_risk" : "off_track"} label={p.unit.status} /></div>
              <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                {[["الوظائف المعتمدة", p.unit.positions], ["المشغولة", p.unit.headcount], ["الشواغر", p.unit.positions - p.unit.headcount], ["الوحدات التابعة", p.subtree.units], ["وظائف الفرع كاملاً", p.subtree.positions]].map(([l, v]) => <div key={l as string} className="rounded-lg border border-brand-border bg-brand-cream px-2 py-2"><div className="text-[16px] font-bold num">{v as number}</div><div className="text-[10px] text-brand-muted">{l as string}</div></div>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Panel title="الوحدات التابعة مباشرة" subtitle={`${p.children.length} وحدة`}>{p.children.length === 0 ? <Empty label="لا توجد وحدات تابعة" /> : <ul className="space-y-1">{p.children.map((c: any) => <li key={c.id}><button onClick={() => expandTo(c.id)} className="w-full text-right flex items-center gap-2 rounded-md px-2 py-1 hover:bg-brand-cream text-[11.5px]"><span className={clsx("rounded px-1 text-[9px]", LEVEL_TONE[c.level])}>{c.level}</span>{c.nameAr}<span className="text-[10px] text-brand-muted num mr-auto">{c.headcount}/{c.positions}</span></button></li>)}</ul>}</Panel>
              <Panel title="الطلبات المرتبطة بالوحدة" subtitle="مقدمة منها أو مؤثرة فيها">
                {p.requests.length + p.affectedBy.length === 0 ? <Empty label="لا توجد طلبات" /> : <ul className="space-y-1">{p.requests.map((r: any) => <li key={`r${r.id}`}><Link to={`/org/requests/${r.id}`} className="flex items-center justify-between gap-2 rounded-md border border-brand-border px-2 py-1.5 text-[11px] hover:bg-brand-cream"><span className="truncate"><span className="font-mono text-brand-muted">{r.code}</span> {r.titleAr}</span><Chip tone={REQ_TONE[r.status]}>{r.status}</Chip></Link></li>)}{p.affectedBy.map((r: any) => <li key={`a${r.requestId}`}><Link to={`/org/requests/${r.requestId}`} className="flex items-center justify-between gap-2 rounded-md border border-brand-border px-2 py-1.5 text-[11px] hover:bg-brand-cream"><span className="truncate"><span className="font-mono text-brand-muted">{r.code}</span> {r.titleAr}</span><Chip tone="gold">{r.action}</Chip></Link></li>)}</ul>}
              </Panel>
              <Panel title="المبادرات المرتبطة بالقطاع" subtitle="من خارطة الطريق">{p.initiatives.length === 0 ? <Empty label="—" /> : <ul className="space-y-1">{p.initiatives.map((i: any) => <li key={i.id}><Link to={`/projects/${i.id}`} className="flex items-center justify-between gap-2 text-[11px] hover:text-brand-green"><span className="truncate">{i.nameAr}{i.tags?.includes("تنظيمي") && <Chip tone="gold" className="mr-1">تنظيمي</Chip>}</span><StatusChip status={i.status} /></Link></li>)}</ul>}</Panel>
              <Panel title="مؤشرات الأداء المملوكة" subtitle="حسب القطاع">{p.kpis.length === 0 ? <Empty label="—" /> : <ul className="space-y-1">{p.kpis.map((k: any) => <li key={k.id}><Link to={`/kpis/${k.id}`} className="flex items-center justify-between gap-2 text-[11px] hover:text-brand-green"><span>{k.nameAr}</span><StatusChip status={k.status} /></Link></li>)}</ul>}</Panel>
            </div>
            <Panel title="تاريخ التغييرات على الوحدة" subtitle="Change history">{p.history.length === 0 ? <Empty label="لا توجد تغييرات مسجلة — الإصدار الأول" /> : <ul className="space-y-1 text-[10.5px]">{p.history.map((h: any) => <li key={h.id} className="text-brand-muted"><span className="num">{new Date(h.createdAt).toLocaleDateString("ar-SA")}</span> · <span className="font-semibold text-brand-text">{h.field}</span>: {h.oldValue ?? "—"} → {h.newValue ?? "—"}{h.reasonAr ? ` · ${h.reasonAr}` : ""} · {h.userName ?? ""}</li>)}</ul>}</Panel>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================ requests
function RequestsScreen() {
  const { user, can } = useAuth(); const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["org-requests"], queryFn: () => api<any[]>("/api/org/requests") });
  const tree = useQuery({ queryKey: ["org-tree"], queryFn: () => api<{ units: Unit[] }>("/api/org/tree") });
  const projects = useQuery({ queryKey: ["fk-options", "projects"], queryFn: () => api<{ id: number; label: string }[]>("/api/data/projects/options") });
  const [st, setSt] = useState("all"); const [type, setType] = useState("all"); const [show, setShow] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<any>({ requestingUnitId: "", type: "استحداث", titleAr: "", descriptionAr: "", justificationAr: "", impactHeadcount: 0, impactBudget: 0, decisionAuthority: "الرئيس التنفيذي", priority: "متوسطة", relatedProjectId: "", correspondenceRef: "", duplicationNoteAr: "", changes: [{ action: "استحداث", unitId: "", proposedNameAr: "", proposedParentId: "", proposedLevel: "إدارة", proposedPositions: "" }] });
  const create = useMutation({ mutationFn: () => post("/api/org/requests", f), onSuccess: () => { KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); setShow(false); setErr(null); }, onError: (e: any) => setErr(e.message) });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const list = data.filter((r) => (st === "all" || r.status === st) && (type === "all" || r.type === type));
  const canCreate = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("org"));
  const units = (tree.data?.units ?? []).filter((u) => u.status !== "ملغى");
  const setChange = (patch: any) => setF({ ...f, changes: [{ ...f.changes[0], ...patch }] });
  return (
    <div>
      <div className="grid grid-cols-4 gap-3"><KpiCard label="إجمالي الطلبات" value={data.length} /><KpiCard label="قيد الإجراء" value={data.filter((r) => r.status === "قيد الإجراء").length} tone="amber" /><KpiCard label="منفذة" value={data.filter((r) => r.status === "منفذ").length} tone="green" /><KpiCard label="مرفوضة" value={data.filter((r) => r.status === "مرفوض").length} tone="red" /></div>
      <div className="card mt-4 px-4 py-2.5 flex items-center gap-2 text-[11px] flex-wrap">
        <select value={st} onChange={(e) => setSt(e.target.value)} className={inp}><option value="all">جميع الحالات</option><option value="قيد الإجراء">قيد الإجراء</option><option value="منفذ">منفذ</option><option value="مرفوض">مرفوض</option></select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inp}><option value="all">جميع الأنواع</option>{ORG_REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <span className="text-brand-muted mr-auto">{list.length} طلباً</span>
        {canCreate && <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> تسجيل طلب</button>}
      </div>
      {show && (
        <Panel className="mt-3" title="تسجيل طلب هيكل تنظيمي" subtitle="يدخل مسار العمل: تسجيل ← التحقق ← الدراسة التنظيمية ← لجنة الهياكل ← الاعتماد ← التنفيذ">
          <div className="grid grid-cols-3 gap-2 text-[11.5px]">
            <select value={f.requestingUnitId} onChange={(e) => setF({ ...f, requestingUnitId: e.target.value })} className={inp}><option value="">الجهة الطالبة…</option>{units.map((u) => <option key={u.id} value={u.id}>{u.level} — {u.nameAr}</option>)}</select>
            <select value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value }); setChange({ action: e.target.value === "استحداث" ? "استحداث" : e.target.value === "دمج" || e.target.value === "إلغاء" ? "إلغاء" : e.target.value === "توصيف وظيفي" || e.target.value === "تحديث دليل تنظيمي" ? "تعديل توصيف" : e.target.value }); }} className={inp}>{ORG_REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <select value={f.decisionAuthority} onChange={(e) => setF({ ...f, decisionAuthority: e.target.value })} className={inp}>{ORG_AUTHORITIES.map((a) => <option key={a} value={a}>جهة القرار: {a}</option>)}</select>
            <input placeholder="عنوان الطلب" value={f.titleAr} onChange={(e) => setF({ ...f, titleAr: e.target.value })} className={clsx(inp, "col-span-3")} />
            <input placeholder="الوصف" value={f.descriptionAr} onChange={(e) => setF({ ...f, descriptionAr: e.target.value })} className={clsx(inp, "col-span-3")} />
            <input placeholder="المبرر" value={f.justificationAr} onChange={(e) => setF({ ...f, justificationAr: e.target.value })} className={clsx(inp, "col-span-3")} />
            <input type="number" placeholder="أثر الوظائف (+/-)" value={f.impactHeadcount} onChange={(e) => setF({ ...f, impactHeadcount: e.target.value })} className={inp} />
            <input type="number" placeholder="الأثر المالي (مليون/سنة)" value={f.impactBudget} onChange={(e) => setF({ ...f, impactBudget: e.target.value })} className={inp} />
            <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={inp}>{["عاجلة", "مرتفعة", "متوسطة"].map((p) => <option key={p} value={p}>الأولوية: {p}</option>)}</select>
            <select value={f.relatedProjectId} onChange={(e) => setF({ ...f, relatedProjectId: e.target.value })} className={inp}><option value="">مبادرة مرتبطة (اختياري)…</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <input placeholder="رقم الوارد (المراسلات)" value={f.correspondenceRef} onChange={(e) => setF({ ...f, correspondenceRef: e.target.value })} className={inp} />
            <input placeholder="ملاحظة التحقق من الازدواجية" value={f.duplicationNoteAr} onChange={(e) => setF({ ...f, duplicationNoteAr: e.target.value })} className={inp} />
          </div>
          <div className="mt-3 rounded-lg border border-dashed border-brand-gold bg-[#FBF6E7]/50 px-3 py-2.5">
            <div className="text-[11px] font-semibold mb-1.5">التغيير المقترح على الهيكل</div>
            <div className="grid grid-cols-4 gap-2 text-[11.5px]">
              {f.changes[0].action !== "استحداث" && <select value={f.changes[0].unitId} onChange={(e) => setChange({ unitId: e.target.value })} className={inp}><option value="">الوحدة المتأثرة…</option>{units.map((u) => <option key={u.id} value={u.id}>{u.level} — {u.nameAr}</option>)}</select>}
              {(f.changes[0].action === "استحداث" || f.changes[0].action === "تعديل مسمى") && <input placeholder={f.changes[0].action === "استحداث" ? "اسم الوحدة الجديدة" : "المسمى الجديد"} value={f.changes[0].proposedNameAr} onChange={(e) => setChange({ proposedNameAr: e.target.value })} className={inp} />}
              {(f.changes[0].action === "استحداث" || f.changes[0].action === "نقل تبعية") && <select value={f.changes[0].proposedParentId} onChange={(e) => setChange({ proposedParentId: e.target.value })} className={inp}><option value="">{f.changes[0].action === "استحداث" ? "الوحدة الأم…" : "الوحدة الأم الجديدة…"}</option>{units.map((u) => <option key={u.id} value={u.id}>{u.level} — {u.nameAr}</option>)}</select>}
              {f.changes[0].action === "استحداث" && <><select value={f.changes[0].proposedLevel} onChange={(e) => setChange({ proposedLevel: e.target.value })} className={inp}>{ORG_LEVELS.slice(2).map((l) => <option key={l} value={l}>{l}</option>)}</select><input type="number" placeholder="الوظائف المقترحة" value={f.changes[0].proposedPositions} onChange={(e) => setChange({ proposedPositions: e.target.value })} className={inp} /></>}
            </div>
          </div>
          {err && <div className="mt-2 text-[11px] text-rag-red">{err}</div>}
          <button disabled={create.isPending || !f.requestingUnitId || !f.titleAr} onClick={() => create.mutate()} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">تسجيل الطلب وبدء المسار</button>
        </Panel>
      )}
      <Panel className="mt-4" title="سجل طلبات الهياكل" subtitle="Requests register — اضغط على الطلب لعرض التفاصيل والوضع الحالي والمقترح">
        <table className="w-full text-[11px]">
          <thead><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["الطلب", "النوع", "الجهة الطالبة", "الأثر", "جهة القرار", "المرحلة الحالية", "العمر", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i < 3 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id} className="border-b border-brand-border/70 last:border-0 hover:bg-brand-cream/60">
              <td className="py-2"><Link to={`/org/requests/${r.id}`} className="font-semibold hover:text-brand-green">{r.titleAr}</Link><div className="text-[9.5px] text-brand-muted font-mono">{r.code} · ورد {r.receivedAt}</div></td>
              <td className="py-2">{r.type}</td><td className="py-2 text-[10.5px]">{r.requestingUnit}<div className="text-[9.5px] text-brand-muted">{r.sectorName}</div></td>
              <td className="py-2 text-center num text-[10.5px]">{r.impactHeadcount >= 0 ? "+" : ""}{r.impactHeadcount} وظيفة<div className="text-brand-muted">{r.impactBudget} م/سنة</div></td>
              <td className="py-2 text-center text-[10.5px]">{r.decisionAuthority}</td>
              <td className="py-2 text-center">{r.workflow ? <Chip tone={r.workflow.status !== "active" ? "neutral" : r.workflow.slaBreached ? "off_track" : r.workflow.stage.requiresDecision ? "gold" : "at_risk"}>{r.workflow.stage.nameAr}{r.workflow.status === "active" && ` · ${r.workflow.daysInStage}/${r.workflow.stage.slaDays}`}</Chip> : "—"}</td>
              <td className="py-2 text-center num">{r.ageDays} يوم</td><td className="py-2 text-center"><Chip tone={REQ_TONE[r.status]}>{r.status}</Chip></td>
            </tr>
          ))}</tbody>
        </table>
      </Panel>
    </div>
  );
}

// ================================================================ request detail
function RequestDetailScreen() {
  const { id } = useParams(); const qc = useQueryClient(); const { user, can } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ["org-request", id], queryFn: () => api<any>(`/api/org/requests/${id}`) });
  const checklist = useMutation({ mutationFn: (c: any[]) => api(`/api/org/requests/${id}/checklist`, { method: "PUT", body: JSON.stringify({ checklist: c }) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["org-request", id] }) });
  if (isLoading) return <Loading />; if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "خطأ"} />;
  const r = data.request; const wf: (WorkflowView & { instanceId: number }) | null = data.workflow;
  const canEdit = can("data:edit") && (user?.role !== "data_manager" || (user?.modules ?? []).includes("org"));
  return (
    <div>
      <Link to="/org/requests" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green mb-3"><ArrowRight className="h-3 w-3" /> سجل الطلبات</Link>
      <div className="card px-5 py-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[10.5px] text-brand-muted font-mono">{r.code} · ورد {r.receivedAt}{r.correspondenceRef ? ` · ${r.correspondenceRef}` : ""}</div><div className="text-[18px] font-bold mt-0.5">{r.titleAr}</div><div className="text-[11.5px] text-brand-muted mt-1">{r.type} · الجهة الطالبة: {r.requestingUnit} · جهة القرار: <b>{r.decisionAuthority}</b> · الأولوية: {r.priority}</div></div><Chip tone={REQ_TONE[r.status]}>{r.status}</Chip></div>
        {wf && <div className="mt-3"><StageTracker wf={wf} /></div>}
        {wf && <div className="mt-2"><WorkflowActions wf={wf} invalidate={KEYS} size="md" /></div>}
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-4">
          <Panel title="الوصف والمبرر" subtitle="Request narrative"><div className="text-[12px] leading-relaxed">{r.descriptionAr}</div><div className="mt-2 text-[11.5px] text-brand-muted"><b>المبرر:</b> {r.justificationAr}</div>{r.duplicationNoteAr && <div className="mt-2 rounded-md bg-rag-amberBg border border-[#EEDDB3] px-3 py-1.5 text-[11px]"><b>التحقق من الازدواجية:</b> {r.duplicationNoteAr}</div>}</Panel>
          {data.scopes.map((sc: any) => (
            <Panel key={sc.parent.id} title={`الوضع الحالي والمقترح — ${sc.parent.nameAr}`} subtitle={`As-is / To-be · ${sc.parent.level}`}>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-[10.5px] font-semibold text-brand-muted mb-1.5">الوضع الحالي</div><ul className="space-y-1">{sc.asIs.map((u: any) => <li key={u.id} className="flex items-center gap-2 rounded-md border border-brand-border px-2 py-1.5 text-[11px]"><span className={clsx("rounded px-1 text-[9px]", LEVEL_TONE[u.level])}>{u.level}</span>{u.nameAr}<span className="text-[10px] text-brand-muted num mr-auto">{u.positions}</span></li>)}</ul></div>
                <div><div className="text-[10.5px] font-semibold text-[#8A6A12] mb-1.5">الوضع المقترح</div><ul className="space-y-1">{sc.toBe.map((u: any) => <li key={u.id} className={clsx("flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]", u.removed ? "border-[#F0C9C9] bg-rag-redBg line-through text-brand-muted" : u.change ? "border-brand-gold bg-[#FBF6E7]" : "border-brand-border")}><span className={clsx("rounded px-1 text-[9px]", LEVEL_TONE[u.level])}>{u.level}</span>{u.nameAr}{u.change && <Chip tone={u.removed ? "off_track" : "gold"}>{u.removed && u.change === "نقل تبعية" ? "ينتقل خارجاً" : u.change}</Chip>}<span className="text-[10px] text-brand-muted num mr-auto">{u.positions}</span></li>)}</ul></div>
              </div>
            </Panel>
          ))}
          {data.scopes.length === 0 && <Panel title="التغيير المقترح" subtitle="لا يتضمن الطلب تغييراً على شجرة الوحدات (دليل تنظيمي / توصيف)"><ul className="space-y-1">{data.changes.map((c: any) => <li key={c.id} className="text-[11.5px]"><Chip tone="gold">{c.action}</Chip> {c.unitName ?? c.proposedNameAr}</li>)}{data.changes.length === 0 && <Empty label="—" />}</ul></Panel>}
        </div>
        <div className="col-span-2 space-y-4">
          <Panel title="ملخص الأثر" subtitle="Impact summary">
            <div className="grid grid-cols-2 gap-2 text-center">{[["أثر الوظائف", `${r.impactHeadcount >= 0 ? "+" : ""}${r.impactHeadcount}`], ["الأثر المالي / سنة", `${r.impactBudget} مليون`], ["الوحدات المتأثرة", data.changes.length], ["جهة القرار", r.decisionAuthority]].map(([l, v]) => <div key={l as string} className="rounded-lg border border-brand-border bg-brand-cream px-2 py-2"><div className="text-[15px] font-bold num">{v as any}</div><div className="text-[10px] text-brand-muted">{l as string}</div></div>)}</div>
            {data.project && <div className="mt-3 text-[11px]"><span className="text-brand-muted">المبادرة المرتبطة:</span> <Link to={`/projects/${data.project.id}`} className="font-semibold hover:text-brand-green">{data.project.nameAr}</Link> <StatusChip status={data.project.status} /></div>}
          </Panel>
          <Panel title="قائمة التنفيذ" subtitle="تُستكمل بعد الاعتماد">
            <ul className="space-y-1.5">{r.checklist.map((c: any, i: number) => <li key={i} className="flex items-center gap-2 text-[11.5px]"><input type="checkbox" disabled={!canEdit || r.status !== "منفذ"} checked={c.done} onChange={(e) => checklist.mutate(r.checklist.map((x: any, j: number) => (j === i ? { ...x, done: e.target.checked } : x)))} className="accent-brand-green" /><span className={clsx(c.done && "line-through text-brand-muted")}>{c.item}</span></li>)}</ul>
          </Panel>
          {wf?.history && <Panel title="سجل المسار" subtitle="Workflow history"><WorkflowHistory history={wf.history} /></Panel>}
        </div>
      </div>
    </div>
  );
}

export default function OrgRouter() {
  return (
    <div>
      <PageHeader title="الهياكل التنظيمية" subtitle="Organizational Structures — Registry · Requests · Explorer" description="الهيكل المعتمد للوزارة، وطلبات التغيير التنظيمي عبر مسار الحوكمة، ومؤشرات صحة الهيكل — بما يجيب عن أي سؤال حول أي وحدة." />
      <ModuleNav />
      <Routes><Route index element={<CenterScreen />} /><Route path="explorer" element={<ExplorerScreen />} /><Route path="requests" element={<RequestsScreen />} /><Route path="requests/:id" element={<RequestDetailScreen />} /></Routes>
      <SourcesFooter />
    </div>
  );
}
