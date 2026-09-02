import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Download, Upload, Plus, X, Archive, RotateCcw, Check, Ban, Lock } from "lucide-react";
import clsx from "clsx";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Panel, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, Empty } from "@/components/ui";
import { SOURCE_LABELS, type FieldSource } from "@shared/fieldSources";
import { ROLE_LABELS } from "@shared/rbac";

type Col = { key: string; labelAr: string; type: string; options?: string[]; fk?: string; required?: boolean; readOnly?: boolean; source: FieldSource; sensitive: boolean };
type Ent = { key: string; labelAr: string; labelEn: string; group: string; sourceAr: string; archivable: boolean; columns: Col[] };
type View = { kind: "entity"; key: string } | { kind: "quality" | "requests" | "changelog" | "archive" | "users" | "relations" };
const GOV_VIEWS = [["quality", "جودة البيانات"], ["requests", "اعتماد التغييرات"], ["changelog", "سجل التغييرات"], ["archive", "الأرشيف"], ["relations", "إدارة العلاقات"], ["users", "المستخدمون والصلاحيات"]] as const;
const SRC_TONE: Record<FieldSource, "blue" | "gold" | "neutral" | "on_track"> = { project_server: "blue", odoo: "gold", manual: "neutral", computed: "on_track" };
const inp = "w-full rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:bg-brand-cream disabled:text-brand-muted";

function parseCsv(text: string): Record<string, string>[] {
  const t = text.replace(/^\uFEFF/, ""); const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}
const fmtCell = (c: Col, v: unknown, fk: Record<string, Record<number, string>>) => v === null || v === undefined ? "—" : c.type === "fk" ? (fk[c.key]?.[v as number] ?? String(v)) : c.type === "boolean" ? (v ? "نعم" : "لا") : String(v);

export default function DataAdminPage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: "entity", key: "projects" });
  const [q, setQ] = useState(""); const [drawer, setDrawer] = useState<{ mode: "edit" | "new"; row?: any } | null>(null); const [toast, setToast] = useState<string | null>(null);
  const { data: entities, isLoading } = useQuery({ queryKey: ["data-entities"], queryFn: () => api<Ent[]>("/api/data/entities"), staleTime: Infinity });
  const { data: log } = useQuery({ queryKey: ["changelog"], queryFn: () => api<any[]>("/api/data/changelog") });
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const groups = useMemo(() => Array.from(new Map((entities ?? []).map((e) => [e.group, (entities ?? []).filter((x) => x.group === e.group)])).entries()), [entities]);
  if (isLoading || !entities) return <Loading />;
  const ent = view.kind === "entity" ? entities.find((e) => e.key === view.key)! : null;
  const capability = can("users:manage") ? "صلاحية كاملة" : can("data:approve") ? "تعديل واعتماد" : can("data:import") ? "تعديل واستيراد ضمن حدود الاعتماد" : can("data:edit") ? "تعديل ضمن حدود الاعتماد" : "اطلاع وإصدار فقط";

  return (
    <div>
      <PageHeader title="إدارة البيانات" subtitle="Data Management & Database Administration"
        description="الواجهة المركزية لإدارة جميع بيانات المنصة؛ أي تعديل معتمد ينعكس مباشرة على لوحات القيادة والمحافظ والمبادرات وخريطة المناطق."
        actions={<div className="flex items-center gap-2"><Chip tone="neutral">الصلاحية الحالية: {user ? ROLE_LABELS[user.role].ar : ""} — {capability}</Chip><Chip tone="gold">عملية مسجلة: {log?.length ?? 0}</Chip></div>} />
      {toast && <div className="mb-3 rounded-md border border-[#CFE6D8] bg-rag-greenBg px-3 py-2 text-[12px] text-rag-green">{toast}</div>}
      <div className="grid grid-cols-5 gap-4">
        <aside className="card px-2 py-2 self-start sticky top-16 max-h-[calc(100vh-90px)] overflow-y-auto">
          {groups.map(([g, list]) => (
            <div key={g} className="mb-2"><div className="px-2 pt-2 pb-1 text-[10px] text-brand-muted">{g}</div>
              {list.map((e) => <button key={e.key} onClick={() => { setView({ kind: "entity", key: e.key }); setQ(""); }} className={clsx("w-full text-right rounded-md px-2.5 py-1.5 text-[11.5px]", view.kind === "entity" && view.key === e.key ? "bg-brand text-white font-semibold" : "hover:bg-brand-cream")}>{e.labelAr}</button>)}
            </div>
          ))}
          <div className="mb-2 border-t border-brand-border pt-2"><div className="px-2 pt-1 pb-1 text-[10px] text-brand-muted">الحوكمة</div>
            {GOV_VIEWS.map(([k, l]) => <button key={k} onClick={() => setView({ kind: k })} className={clsx("w-full text-right rounded-md px-2.5 py-1.5 text-[11.5px]", view.kind === k ? "bg-brand text-white font-semibold" : "hover:bg-brand-cream")}>{l}</button>)}
          </div>
          <div className="px-2 py-2 text-[9.5px] text-brand-muted border-t border-brand-border">طبقة وصول بيانات مستقلة — قابلة للتحويل إلى SQL Server EPM Data Warehouse داخل الشبكة دون تعديل الشاشات.</div>
        </aside>
        <div className="col-span-4">
          {ent && <EntityView ent={ent} q={q} setQ={setQ} onEdit={(row) => setDrawer({ mode: "edit", row })} onNew={() => setDrawer({ mode: "new" })} say={say} canEdit={can("data:edit")} canImport={can("data:import")} />}
          {view.kind === "quality" && <QualityView onGo={(k) => setView(k === "relations" ? { kind: "relations" } : { kind: "entity", key: k })} />}
          {view.kind === "requests" && <RequestsView canApprove={can("data:approve")} say={say} />}
          {view.kind === "changelog" && <ChangeLogView entities={entities} canApprove={can("data:approve")} say={say} />}
          {view.kind === "archive" && <ArchiveView canApprove={can("data:approve")} say={say} />}
          {view.kind === "relations" && <RelationsView canEdit={can("data:edit")} say={say} />}
          {view.kind === "users" && (can("users:manage") ? <UsersView say={say} /> : <Panel title="المستخدمون والصلاحيات"><Empty label="هذه الشاشة متاحة لمدير النظام فقط" /></Panel>)}
        </div>
      </div>
      {drawer && ent && <Drawer ent={ent} mode={drawer.mode} row={drawer.row} onClose={() => setDrawer(null)} say={say} />}
      <SourcesFooter />
    </div>
  );
}

// ---------------------------------------------------------------- entity table
function EntityView({ ent, q, setQ, onEdit, onNew, say, canEdit, canImport }: { ent: Ent; q: string; setQ: (v: string) => void; onEdit: (r: any) => void; onNew: () => void; say: (m: string) => void; canEdit: boolean; canImport: boolean }) {
  const qc = useQueryClient(); const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["data", ent.key, q], queryFn: () => api<{ rows: any[]; fkLabels: Record<string, Record<number, string>>; total: number }>(`/api/data/${ent.key}${q ? `?q=${encodeURIComponent(q)}` : ""}`) });
  const imp = useMutation({ mutationFn: (rows: any[]) => post<{ inserted: number; updated: number }>(`/api/data/${ent.key}/import`, { rows }), onSuccess: (r) => { say(`تم الاستيراد: ${r.inserted} إضافة · ${r.updated} تحديث`); qc.invalidateQueries({ queryKey: ["data", ent.key] }); qc.invalidateQueries({ queryKey: ["changelog"] }); }, onError: (e: any) => say(`تعذر الاستيراد: ${e.message}`) });
  const cols = ent.columns.slice(0, 9);
  return (
    <Panel title={<span className="flex items-center gap-2">{ent.labelAr} <span className="text-[11px] text-brand-muted font-normal">{ent.labelEn} · {data?.total ?? 0}</span></span>} subtitle={`المصدر: ${ent.sourceAr}`}
      actions={<div className="flex items-center gap-1.5">
        <a href={`/api/data/${ent.key}/export.csv`} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-[11px] hover:bg-brand-cream"><Download className="h-3.5 w-3.5" /> تصدير CSV</a>
        {canImport && <><button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-[11px] hover:bg-brand-cream"><Upload className="h-3.5 w-3.5" /> استيراد CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const rows = parseCsv(await f.text()); if (!rows.length) return say("الملف فارغ"); if (confirm(`استيراد ${rows.length} صفاً إلى «${ent.labelAr}»؟`)) imp.mutate(rows); e.target.value = ""; }} /></>}
        {canEdit && ent.key !== "impact" && <button onClick={onNew} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-hover"><Plus className="h-3.5 w-3.5" /> إضافة سجل</button>}
      </div>}>
      <div className="relative mb-2"><Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" /></div>
      {isLoading ? <Loading /> : error ? <ErrorBox message={(error as Error).message} /> : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-[11px] whitespace-nowrap">
            <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10px] border-b border-brand-border">{cols.map((c) => <th key={c.key} className="py-1.5 pl-3 text-right font-medium"><span className="flex items-center gap-1">{c.labelAr}<span className={clsx("h-1.5 w-1.5 rounded-full", c.source === "project_server" ? "bg-rag-blue" : c.source === "odoo" ? "bg-brand-gold" : c.source === "computed" ? "bg-rag-green" : "bg-brand-muted")} title={SOURCE_LABELS[c.source]} /></span></th>)}<th className="py-1.5 text-center font-medium">إجراء</th></tr></thead>
            <tbody>{data!.rows.map((r) => (
              <tr key={r.id} className="border-b border-brand-border/70 last:border-0 hover:bg-brand-cream/60">
                {cols.map((c) => <td key={c.key} className={clsx("py-1.5 pl-3 max-w-[220px] truncate", c.key === "nameAr" || c.key === "titleAr" ? "font-semibold" : "")}>{c.type === "select" && c.options?.includes("on_track") ? <Chip tone={r[c.key]}>{fmtCell(c, r[c.key], data!.fkLabels)}</Chip> : fmtCell(c, r[c.key], data!.fkLabels)}</td>)}
                <td className="py-1.5 text-center"><button onClick={() => onEdit(r)} className="rounded-md border border-brand-border bg-white px-2 py-0.5 text-[10.5px] hover:bg-brand-cream">{canEdit ? "تعديل" : "استعراض"}</button></td>
              </tr>
            ))}</tbody>
          </table>
          {data!.rows.length === 0 && <Empty label="لا توجد سجلات" />}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3 text-[9.5px] text-brand-muted"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rag-blue" /> Project Server</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-gold" /> Odoo ERP</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-muted" /> إدخال يدوي</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rag-green" /> محتسب آلياً</span></div>
    </Panel>
  );
}

// ---------------------------------------------------------------- edit / create drawer
function Drawer({ ent, mode, row, onClose, say }: { ent: Ent; mode: "edit" | "new"; row?: any; onClose: () => void; say: (m: string) => void }) {
  const { can } = useAuth(); const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>(() => Object.fromEntries(ent.columns.map((c) => [c.key, row?.[c.key] ?? (c.type === "boolean" ? false : "")])));
  const [reason, setReason] = useState(""); const [err, setErr] = useState<string | null>(null);
  const fkCols = ent.columns.filter((c) => c.type === "fk");
  const opts = useQuery({ queryKey: ["fk-options", ent.key], queryFn: async () => Object.fromEntries(await Promise.all(fkCols.map(async (c) => [c.key, await api<{ id: number; label: string }[]>(`/api/data/${c.fk}/options`)]))), staleTime: 60_000 });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["data", ent.key] }); qc.invalidateQueries({ queryKey: ["changelog"] }); qc.invalidateQueries({ queryKey: ["requests"] }); qc.invalidateQueries({ queryKey: ["overview"] }); };
  const save = useMutation({
    mutationFn: async () => {
      if (mode === "new") return post(`/api/data/${ent.key}`, form);
      const changes: Record<string, unknown> = {};
      for (const c of ent.columns) if (!c.readOnly && String(form[c.key] ?? "") !== String(row[c.key] ?? "")) changes[c.key] = form[c.key];
      if (!Object.keys(changes).length) throw new Error("لا توجد تغييرات");
      return api<{ applied: string[]; queued: string[] }>(`/api/data/${ent.key}/${row.id}`, { method: "PATCH", body: JSON.stringify({ changes, reasonAr: reason }) });
    },
    onSuccess: (r: any) => { invalidate(); say(mode === "new" ? "تم إنشاء السجل" : `تم الحفظ${r.queued?.length ? ` — أُحيلت ${r.queued.length} حقول حساسة إلى الاعتماد: ${r.queued.join("، ")}` : ""}`); onClose(); },
    onError: (e: any) => setErr(e.message),
  });
  const arch = useMutation({ mutationFn: () => post(`/api/data/${ent.key}/${row.id}/archive`, {}), onSuccess: () => { invalidate(); say("تمت الأرشفة"); onClose(); }, onError: (e: any) => setErr(e.message) });
  const editable = (c: Col) => can("data:edit") && !c.readOnly && ((c.source !== "project_server" && c.source !== "odoo" && c.source !== "computed") || can("data:override"));
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/25" />
      <div className="w-[440px] bg-white h-full shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-brand-border px-4 py-3 flex items-center justify-between"><div><div className="text-[14px] font-bold">{mode === "new" ? `إضافة ${ent.labelAr}` : row[ent.columns.find((c) => c.key === "nameAr" || c.key === "titleAr")?.key ?? "id"] ?? `سجل #${row.id}`}</div><div className="text-[10px] text-brand-muted">{ent.labelEn}</div></div><button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-brand-cream"><X className="h-4 w-4" /></button></div>
        <div className="px-4 py-3 space-y-3">
          {ent.columns.map((c) => (
            <label key={c.key} className="block">
              <span className="flex items-center gap-1.5 text-[11px] font-medium mb-1">{c.labelAr}{c.required && <span className="text-rag-red">*</span>}<Chip tone={SRC_TONE[c.source]}>{SOURCE_LABELS[c.source]}</Chip>{c.sensitive && <Chip tone="off_track"><Lock className="h-2.5 w-2.5" /> يتطلب اعتماد</Chip>}</span>
              {c.type === "select" ? <select disabled={!editable(c)} value={form[c.key] ?? ""} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className={inp}><option value="">—</option>{c.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : c.type === "fk" ? <select disabled={!editable(c)} value={form[c.key] ?? ""} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className={inp}><option value="">—</option>{(opts.data?.[c.key] ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
                : c.type === "boolean" ? <input type="checkbox" disabled={!editable(c)} checked={!!form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.checked })} className="accent-brand-green" />
                : <input type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"} step="any" disabled={!editable(c)} value={form[c.key] ?? ""} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} className={inp} />}
            </label>
          ))}
          {mode === "edit" && can("data:edit") && <label className="block"><span className="text-[11px] font-medium">سبب التعديل</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inp} placeholder="يُحفظ في سجل التغييرات" /></label>}
          {err && <div className="rounded-md bg-rag-redBg px-3 py-2 text-[11.5px] text-rag-red">{err}</div>}
          {can("data:edit") && <div className="flex items-center gap-2 pt-1">
            <button disabled={save.isPending} onClick={() => save.mutate()} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"><Check className="h-3.5 w-3.5" /> حفظ</button>
            {mode === "edit" && ent.archivable && can("data:approve") && <button disabled={arch.isPending} onClick={() => confirm("أرشفة هذا السجل؟ يبقى قابلاً للاسترجاع من الأرشيف.") && arch.mutate()} className="inline-flex items-center gap-1 rounded-md border border-[#F0C9C9] bg-rag-redBg px-3 py-1.5 text-[12px] font-semibold text-rag-red"><Archive className="h-3.5 w-3.5" /> أرشفة</button>}
          </div>}
          {!can("data:edit") && <div className="text-[11px] text-brand-muted">وضع الاطلاع — التعديل يتطلب دور مدير البيانات أو أعلى.</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- governance views
function QualityView({ onGo }: { onGo: (k: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["quality"], queryFn: () => api<any>("/api/data/quality") });
  if (isLoading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[["متوسط اكتمال البيانات", `${data.overall}%`, "green"], ["روابط غير صحيحة", data.brokenLinks, data.brokenLinks ? "red" : "green"], ["سجلات مكررة", data.duplicates, data.duplicates ? "amber" : "green"], ["إجراءات مطلوبة", data.actions.length, data.actions.length ? "amber" : "green"]].map(([l, v, t]) => (
          <div key={l as string} className={clsx("rounded-xl border px-4 py-3 shadow-card", t === "green" ? "bg-rag-greenBg border-[#CFE6D8]" : t === "red" ? "bg-rag-redBg border-[#F0C9C9]" : "bg-rag-amberBg border-[#EEDDB3]")}><div className="text-[11px] text-brand-muted">{l as string}</div><div className="text-[22px] font-bold num">{v as any}</div></div>
        ))}
      </div>
      <Panel title="اكتمال البيانات حسب الكيان" subtitle="Completeness per entity">
        <div className="space-y-2">{data.entities.map((e: any) => (
          <div key={e.key}><div className="flex justify-between text-[11.5px]"><span>{e.labelAr} <span className="text-brand-muted">· {e.records} سجل</span></span><span className="num font-semibold">{e.completeness}%</span></div><ProgressBar value={e.completeness} className="mt-1" /></div>
        ))}</div>
      </Panel>
      <Panel title="قائمة المعالجة" subtitle="Actionable list — اضغط للانتقال إلى الكيان">
        {data.actions.length === 0 ? <Empty label="لا توجد إجراءات مطلوبة — جودة البيانات ممتازة" /> : <ul className="space-y-1.5">{data.actions.map((a: any, i: number) => <li key={i}><button onClick={() => onGo(a.entity)} className="w-full text-right rounded-md border border-brand-border px-3 py-2 text-[11.5px] hover:bg-brand-cream">{a.labelAr}</button></li>)}</ul>}
      </Panel>
    </div>
  );
}

function RequestsView({ canApprove, say }: { canApprove: boolean; say: (m: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["requests"], queryFn: () => api<any[]>("/api/data/requests") });
  const decide = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => post(`/api/data/requests/${id}/decide`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["requests"] }); qc.invalidateQueries({ queryKey: ["changelog"] }); qc.invalidateQueries({ queryKey: ["data"] }); say("تم البت في الطلب"); }, onError: (e: any) => say(e.message) });
  if (isLoading || !data) return <Loading />;
  const st: Record<string, { l: string; t: "at_risk" | "on_track" | "off_track" }> = { pending: { l: "بانتظار الاعتماد", t: "at_risk" }, approved: { l: "معتمد", t: "on_track" }, rejected: { l: "مرفوض", t: "off_track" } };
  return (
    <Panel title="اعتماد التغييرات" subtitle="الحقول الحساسة لا تُنشر إلا بعد اعتماد صاحب الصلاحية">
      {data.length === 0 ? <Empty label="لا توجد طلبات تغيير" /> : <ul className="space-y-2">{data.map((r) => (
        <li key={r.id} className="rounded-lg border border-brand-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2"><div className="text-[12px] font-semibold">{r.entity} #{r.entityId} · {r.field}</div><Chip tone={st[r.status].t}>{st[r.status].l}</Chip></div>
          <div className="text-[11px] mt-1 num">من <span className="font-mono bg-brand-cream px-1 rounded">{r.currentValue || "—"}</span> إلى <span className="font-mono bg-[#FBF6E7] px-1 rounded">{r.proposedValue}</span></div>
          <div className="text-[10px] text-brand-muted mt-0.5">طلب: {r.requestedBy ?? "—"} · {new Date(r.createdAt).toLocaleString("ar-SA")}{r.reasonAr ? ` · السبب: ${r.reasonAr}` : ""}</div>
          {canApprove && r.status === "pending" && <div className="mt-2 flex gap-2"><button onClick={() => decide.mutate({ id: r.id, status: "approved" })} className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white"><Check className="h-3 w-3" /> اعتماد</button><button onClick={() => decide.mutate({ id: r.id, status: "rejected" })} className="inline-flex items-center gap-1 rounded-md border border-[#F0C9C9] bg-rag-redBg px-2.5 py-1 text-[11px] font-semibold text-rag-red"><Ban className="h-3 w-3" /> رفض</button></div>}
        </li>
      ))}</ul>}
    </Panel>
  );
}

function ChangeLogView({ entities, canApprove, say }: { entities: Ent[]; canApprove: boolean; say: (m: string) => void }) {
  const qc = useQueryClient(); const [ent, setEnt] = useState("all");
  const { data, isLoading } = useQuery({ queryKey: ["changelog", ent], queryFn: () => api<any[]>(`/api/data/changelog${ent !== "all" ? `?entity=${ent}` : ""}`) });
  const revert = useMutation({ mutationFn: (id: number) => post(`/api/data/changelog/${id}/revert`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ["changelog"] }); qc.invalidateQueries({ queryKey: ["data"] }); say("تم استرجاع القيمة السابقة"); }, onError: (e: any) => say(e.message) });
  const tables = Array.from(new Set(entities.map((e) => e.key === "impact" ? "projects" : e.key)));
  return (
    <Panel title="سجل التغييرات" subtitle="من · متى · القيمة قبل وبعد · السبب — مع إمكانية الاسترجاع" actions={<select value={ent} onChange={(e) => setEnt(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px]"><option value="all">جميع الكيانات</option>{tables.map((t) => <option key={t} value={t}>{t}</option>)}<option value="users">users</option></select>}>
      {isLoading || !data ? <Loading /> : data.length === 0 ? <Empty label="لا توجد تغييرات مسجلة بعد" /> : (
        <table className="w-full text-[11px]">
          <thead><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["التاريخ", "المستخدم", "الكيان", "الحقل", "قبل", "بعد", "السبب", ""].map((h) => <th key={h} className="py-1.5 text-right font-medium">{h}</th>)}</tr></thead>
          <tbody>{data.map((r) => (
            <tr key={r.id} className={clsx("border-b border-brand-border/70 last:border-0", r.revertedAt && "opacity-50")}>
              <td className="py-1.5 whitespace-nowrap num">{new Date(r.createdAt).toLocaleString("ar-SA")}</td><td className="py-1.5">{r.userName ?? "—"}</td><td className="py-1.5 font-mono">{r.entity}#{r.entityId}</td><td className="py-1.5 font-mono">{r.field}</td>
              <td className="py-1.5 max-w-[140px] truncate">{r.oldValue ?? "—"}</td><td className="py-1.5 max-w-[140px] truncate font-semibold">{r.newValue ?? "—"}</td><td className="py-1.5 max-w-[160px] truncate text-brand-muted">{r.reasonAr ?? ""}</td>
              <td className="py-1.5 text-center">{canApprove && !r.revertedAt && r.field !== "*" && !["regions", "kpis", "isActive"].includes(r.field) && <button onClick={() => confirm("استرجاع القيمة السابقة؟") && revert.mutate(r.id)} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-2 py-0.5 text-[10px] hover:bg-brand-cream"><RotateCcw className="h-3 w-3" /> استرجاع</button>}{r.revertedAt && <span className="text-[10px]">مُسترجَع</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Panel>
  );
}

function ArchiveView({ canApprove, say }: { canApprove: boolean; say: (m: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["data", "projects", "archived"], queryFn: () => api<{ rows: any[] }>("/api/data/projects?archived=1") });
  const restore = useMutation({ mutationFn: (id: number) => post(`/api/data/projects/${id}/restore`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ["data"] }); qc.invalidateQueries({ queryKey: ["changelog"] }); say("تم الاسترجاع من الأرشيف"); }, onError: (e: any) => say(e.message) });
  const rows = (data?.rows ?? []).filter((r) => r.isArchived);
  return (
    <Panel title="الأرشيف" subtitle="الأرشفة بدل الحذف النهائي — السجلات المؤرشفة تُستبعد من اللوحات وتبقى قابلة للاسترجاع">
      {isLoading ? <Loading /> : rows.length === 0 ? <Empty label="لا توجد سجلات مؤرشفة" /> : <ul className="space-y-1.5">{rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between rounded-md border border-brand-border px-3 py-2 text-[11.5px]"><span><span className="font-mono text-brand-muted">{r.code}</span> · <span className="font-semibold">{r.nameAr}</span></span>{canApprove && <button onClick={() => restore.mutate(r.id)} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-2 py-1 text-[10.5px] hover:bg-brand-cream"><RotateCcw className="h-3 w-3" /> استرجاع</button>}</li>
      ))}</ul>}
    </Panel>
  );
}

function RelationsView({ canEdit, say }: { canEdit: boolean; say: (m: string) => void }) {
  const qc = useQueryClient(); const [pid, setPid] = useState<number | null>(null); const [regionIds, setRegionIds] = useState<number[]>([]); const [kpiIds, setKpiIds] = useState<number[]>([]);
  const projects = useQuery({ queryKey: ["fk-options", "projects"], queryFn: () => api<{ id: number; label: string }[]>("/api/data/projects/options") });
  const regions = useQuery({ queryKey: ["fk-options", "regions"], queryFn: () => api<{ id: number; label: string }[]>("/api/data/regions/options") });
  const kpis = useQuery({ queryKey: ["fk-options", "kpis"], queryFn: () => api<{ id: number; label: string }[]>("/api/data/kpis/options") });
  const rel = useQuery({ queryKey: ["relations", pid], queryFn: () => api<{ regionIds: number[]; kpiIds: number[] }>(`/api/data/relations/${pid}`), enabled: pid !== null });
  useEffect(() => { if (rel.data) { setRegionIds(rel.data.regionIds); setKpiIds(rel.data.kpiIds); } }, [rel.data]);
  const save = useMutation({ mutationFn: () => api(`/api/data/relations/${pid}`, { method: "PUT", body: JSON.stringify({ regionIds, kpiIds }) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["regions"] }); qc.invalidateQueries({ queryKey: ["changelog"] }); qc.invalidateQueries({ queryKey: ["relations", pid] }); say("تم حفظ العلاقات"); }, onError: (e: any) => say(e.message) });
  const toggle = (arr: number[], set: (v: number[]) => void, id: number) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  return (
    <Panel title="إدارة العلاقات" subtitle="Many-to-Many — ربط المبادرة بالمناطق ومؤشرات الأداء">
      <select value={pid ?? ""} onChange={(e) => setPid(Number(e.target.value) || null)} className={inp}><option value="">اختر المبادرة…</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
      {pid !== null && rel.data && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div><div className="text-[11.5px] font-semibold mb-2">المناطق ({regionIds.length})</div><div className="space-y-1">{(regions.data ?? []).map((r) => <label key={r.id} className="flex items-center gap-2 text-[11.5px]"><input type="checkbox" disabled={!canEdit} checked={regionIds.includes(r.id)} onChange={() => toggle(regionIds, setRegionIds, r.id)} className="accent-brand-green" />{r.label}</label>)}</div></div>
          <div><div className="text-[11.5px] font-semibold mb-2">مؤشرات الأداء ({kpiIds.length})</div><div className="space-y-1">{(kpis.data ?? []).map((k) => <label key={k.id} className="flex items-center gap-2 text-[11.5px]"><input type="checkbox" disabled={!canEdit} checked={kpiIds.includes(k.id)} onChange={() => toggle(kpiIds, setKpiIds, k.id)} className="accent-brand-green" />{k.label}</label>)}</div></div>
          {canEdit && <div className="col-span-2"><button disabled={save.isPending} onClick={() => save.mutate()} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"><Check className="h-3.5 w-3.5" /> حفظ العلاقات</button></div>}
        </div>
      )}
    </Panel>
  );
}

function UsersView({ say }: { say: (m: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => api<any[]>("/api/data/users") });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api(`/api/data/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["changelog"] }); say("تم تحديث حالة المستخدم"); }, onError: (e: any) => say(e.message) });
  if (isLoading || !data) return <Loading />;
  return (
    <Panel title="المستخدمون والصلاحيات" subtitle="Role-Based Access Control — في البيئة الإنتاجية تُدار الأدوار عبر مجموعات Active Directory">
      <table className="w-full text-[11.5px]">
        <thead><tr className="text-brand-muted text-[10px] border-b border-brand-border">{["المستخدم", "اسم الدخول", "الدور", "نطاق الصلاحية", "الحالة", ""].map((h) => <th key={h} className="py-1.5 text-right font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.map((u) => (
          <tr key={u.id} className="border-b border-brand-border/70 last:border-0">
            <td className="py-2 font-semibold">{u.fullName}</td><td className="py-2 font-mono text-[10.5px]">{u.username}</td><td className="py-2">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]?.ar}</td><td className="py-2 text-brand-muted text-[10.5px]">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]?.scopeAr}</td>
            <td className="py-2"><Chip tone={u.isActive ? "on_track" : "off_track"}>{u.isActive ? "نشط" : "معطل"}</Chip></td>
            <td className="py-2 text-left"><button onClick={() => toggle.mutate({ id: u.id, isActive: !u.isActive })} className="rounded-md border border-brand-border bg-white px-2 py-0.5 text-[10.5px] hover:bg-brand-cream">{u.isActive ? "تعطيل" : "تفعيل"}</button></td>
          </tr>
        ))}</tbody>
      </table>
    </Panel>
  );
}
