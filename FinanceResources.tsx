import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import clsx from "clsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from "recharts";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, Empty } from "@/components/ui";
import { fmtMoney } from "@shared/format";

const tick = { fontSize: 10, fill: "#6B7672" };

// ================================================================ Finance
type Finance = {
  totals: { budget: number; committed: number; actual: number; eac: number; variance: number; spendPct: number; commitPct: number };
  byPortfolio: { id: number; nameAr: string; budget: number; committed: number; actual: number; eac: number }[];
  overruns: { id: number; nameAr: string; status: string; budget: number; actual: number; eac: number; overrun: number }[];
};

export function FinancePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["finance"], queryFn: () => api<Finance>("/api/finance") });
  const [pf, setPf] = useState("all");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل الأداء المالي"} />;
  const t = data.totals;
  const chart = data.byPortfolio.filter((p) => pf === "all" || String(p.id) === pf).map((p) => ({ name: p.nameAr.replace("محفظة ", ""), المعتمدة: p.budget, "الملتزم به": p.committed, المصروف: p.actual, EAC: p.eac }));
  const dist = data.byPortfolio.map((p) => ({ name: p.nameAr.replace("محفظة ", ""), value: p.budget }));
  return (
    <div>
      <PageHeader title="الأداء المالي" subtitle="Financial Performance" description="المصدر المرجعي للبيانات المالية: Odoo ERP عبر مستودع بيانات EPM." />
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="الميزانية المعتمدة" value={fmtMoney(t.budget)} />
        <KpiCard label="الملتزم به" value={fmtMoney(t.committed)} sub={`${t.commitPct}% من الميزانية`} />
        <KpiCard label="المصروف الفعلي" value={fmtMoney(t.actual)} sub={`${t.spendPct}% من الميزانية`} />
        <KpiCard label="التوقع عند الإكمال" value={fmtMoney(t.eac)} />
        <KpiCard label="الانحراف المتوقع" value={t.variance > 0 ? `تجاوز ${fmtMoney(t.variance)}` : `وفر ${fmtMoney(-t.variance)}`} tone={t.variance > 0 ? "red" : "green"} />
      </div>
      <Panel className="mt-4" title="الأداء المالي حسب المحفظة" subtitle="المعتمدة · الملتزم به · المصروف · التوقع عند الإكمال"
        actions={<select value={pf} onChange={(e) => setPf(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px]"><option value="all">جميع المحافظ</option>{data.byPortfolio.map((p) => <option key={p.id} value={String(p.id)}>{p.nameAr}</option>)}</select>}>
        <div className="h-[260px]">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={12}>
              <CartesianGrid vertical={false} stroke="#EEF0EC" />
              <XAxis dataKey="name" reversed tick={{ fontSize: 9.5, fill: "#6B7672" }} axisLine={false} tickLine={false} interval={0} />
              <YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [fmtMoney(Number(v)), ""]} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              <Bar dataKey="المعتمدة" fill="#0E3F36" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="الملتزم به" fill="#2F6F8F" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="المصروف" fill="#C9A227" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="EAC" fill="#0F7A4E" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="أعلى المشاريع تجاوزاً للميزانية" subtitle="Forecast Overruns — التوقع عند الإكمال مقابل المعتمد">
          {data.overruns.length === 0 ? <Empty label="لا توجد تجاوزات متوقعة" /> : (
            <table className="w-full text-[11.5px]">
              <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المشروع", "الميزانية", "المصروف", "EAC", "التجاوز", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
              <tbody>{data.overruns.map((o) => (
                <tr key={o.id} className="border-b border-brand-border/70 last:border-0">
                  <td className="py-2"><Link to={`/projects/${o.id}`} className="font-semibold hover:text-brand-green">{o.nameAr}</Link></td>
                  <td className="py-2 text-center num">{fmtMoney(o.budget)}</td><td className="py-2 text-center num">{fmtMoney(o.actual)}</td><td className="py-2 text-center num">{fmtMoney(o.eac)}</td>
                  <td className="py-2 text-center num font-bold text-rag-red">+{fmtMoney(o.overrun)}</td><td className="py-2 text-center"><StatusChip status={o.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Panel>
        <Panel className="col-span-2" title="سلسلة القيمة المالية" subtitle="Budget → Committed → Actual → EAC → Variance">
          <dl className="text-[12px] space-y-2">
            {[["الميزانية المعتمدة", fmtMoney(t.budget)], ["الالتزامات (عقود وأوامر شراء)", fmtMoney(t.committed)], ["المصروف الفعلي (فواتير)", fmtMoney(t.actual)], ["المصروف المتوقع المتبقي", fmtMoney(t.eac - t.actual)], ["EAC", fmtMoney(t.eac)]].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-brand-border pb-1.5"><dt className="text-brand-muted">{l}</dt><dd className="font-bold num">{v}</dd></div>
            ))}
            <div className="flex justify-between"><dt className="text-brand-muted">الانحراف</dt><dd className={clsx("font-bold num", t.variance > 0 ? "text-rag-red" : "text-rag-green")}>{t.variance > 0 ? "+" : "-"}{fmtMoney(Math.abs(t.variance))}</dd></div>
          </dl>
        </Panel>
      </div>
      <Panel className="mt-4" title="توزيع الاستثمار حسب المحفظة" subtitle="Investment Distribution">
        <div className="h-[240px]">
          <ResponsiveContainer>
            <BarChart data={dist} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={14}>
              <CartesianGrid horizontal={false} stroke="#EEF0EC" />
              <XAxis type="number" reversed tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}B`} />
              <YAxis type="category" dataKey="name" orientation="right" width={120} tick={{ fontSize: 10.5, fill: "#1F2A26" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v) => [fmtMoney(Number(v)), "الاستثمار"]} />
              <Bar dataKey="value" fill="#0E3F36" radius={[3, 3, 3, 3]} isAnimationActive={false}><LabelList dataKey="value" position="insideLeft" formatter={(v) => fmtMoney(Number(v))} style={{ fontSize: 10, fill: "#fff" }} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <SourcesFooter />
    </div>
  );
}

// ================================================================ Resources
type Resource = { id: number; nameAr: string; roleAr: string; departmentAr: string; capacityHours: number; leaveHours: number; trainingHours: number; hourlyCost: number; assignments: { projectId: number; projectName: string; hours: number }[]; net: number; demand: number; utilization: number; status: string };
type ResPayload = { summary: { total: number; sample: number; overallocated: number; avgUtilization: number; standardCapacity: number }; resources: Resource[] };
const RS_CHIP: Record<string, "on_track" | "at_risk" | "off_track"> = { "متاح": "on_track", "قريب الحد": "at_risk", "OVERALLOCATED": "off_track" };

export function ResourcesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["resources"], queryFn: () => api<ResPayload>("/api/resources") });
  const [q, setQ] = useState(""); const [st, setSt] = useState("all"); const [sel, setSel] = useState<number | null>(null);
  const list = useMemo(() => (data?.resources ?? []).filter((r) => (st === "all" || r.status === st) && (!q || r.nameAr.includes(q) || r.roleAr.includes(q) || r.departmentAr.includes(q))), [data, q, st]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل الموارد"} />;
  const sm = data.summary; const r = data.resources.find((x) => x.id === sel) ?? list[0];
  return (
    <div>
      <PageHeader title="إدارة الموارد" subtitle="Resource Management" description="الطاقة التشغيلية من Odoo HR – الإجازات والتدريب = صافي الطاقة المتاحة مقابل الطلب من تكليفات Microsoft Project Server." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي الموارد" value={sm.total.toLocaleString("en-US")} sub={`عرض عينة من ${sm.sample} مورداً`} />
        <KpiCard label="موارد محمّلة فوق الطاقة" value={sm.overallocated} tone="red" sub="Overallocated" />
        <KpiCard label="متوسط نسبة الاستخدام" value={`${sm.avgUtilization}%`} tone="amber" />
        <KpiCard label="الطاقة الشهرية المعيارية" value={`${sm.standardCapacity} ساعة`} sub="لكل مورد" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="سجل الموارد" subtitle="اضغط على المورد لعرض التفاصيل والتكليفات"
          actions={<select value={st} onChange={(e) => setSt(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px]"><option value="all">جميع الحالات</option><option value="متاح">متاح</option><option value="قريب الحد">قريب الحد</option><option value="OVERALLOCATED">محمّل فوق الطاقة</option></select>}>
          <div className="relative mb-2"><Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" /></div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المورد", "الإدارة", "صافي الطاقة", "الطلب", "الاستخدام", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
              <tbody>{list.map((x) => (
                <tr key={x.id} onClick={() => setSel(x.id)} className={clsx("border-b border-brand-border/70 last:border-0 cursor-pointer", r?.id === x.id ? "bg-[#FBF6E7]" : "hover:bg-brand-cream/60")}>
                  <td className="py-2"><div className="font-semibold">{x.nameAr}</div><div className="text-[10px] text-brand-muted">{x.roleAr}</div></td>
                  <td className="py-2 text-center text-brand-muted text-[10.5px]">{x.departmentAr}</td><td className="py-2 text-center num">{x.net} س</td><td className="py-2 text-center num">{x.demand} س</td>
                  <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={Math.min(100, x.utilization)} tone={x.utilization > 100 ? "red" : x.utilization >= 90 ? "amber" : "green"} className="flex-1 min-w-[50px]" /><span className="num text-[10.5px] w-12">{x.utilization}%</span></div></td>
                  <td className="py-2 text-center"><Chip tone={RS_CHIP[x.status]}>{x.status}</Chip></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
        <Panel className="col-span-2" title="بطاقة المورد" subtitle="Project Server + Odoo HR">
          {!r ? <Empty label="اختر مورداً" /> : (
            <div>
              <div className="text-[14px] font-bold">{r.nameAr}</div><div className="text-[10.5px] text-brand-muted">{r.roleAr} · {r.departmentAr}</div>
              <dl className="mt-3 text-[11.5px] space-y-1.5">
                {[["الطاقة الشهرية", `${r.capacityHours} ساعة`], ["إجازات (Odoo)", `${r.leaveHours} ساعة`], ["تدريب (Odoo)", `${r.trainingHours} ساعة`], ["صافي الطاقة المتاحة", `${r.net} ساعة`]].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-brand-border pb-1"><dt className="text-brand-muted">{l}</dt><dd className="font-semibold num">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-3 text-[10.5px] text-brand-muted">تكليفات Microsoft Project Server</div>
              <ul className="mt-1 space-y-1">{r.assignments.map((a, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-brand-border px-2.5 py-1.5 text-[11.5px]"><Link to={`/projects/${a.projectId}`} className="font-medium truncate hover:text-brand-green">{a.projectName}</Link><span className="num text-brand-muted">{a.hours} ساعة</span></li>
              ))}</ul>
              <div className="mt-1.5 flex justify-between text-[11.5px]"><span className="text-brand-muted">إجمالي الطلب</span><span className="font-bold num">{r.demand} ساعة</span></div>
              <div className="mt-3"><div className="flex justify-between text-[11px]"><span className="text-brand-muted">نسبة الاستخدام</span><span className={clsx("font-bold num", r.utilization > 100 ? "text-rag-red" : "")}>{r.utilization}%</span></div><ProgressBar value={Math.min(100, r.utilization)} tone={r.utilization > 100 ? "red" : r.utilization >= 90 ? "amber" : "green"} className="mt-1" height="h-2.5" /></div>
              <div className="mt-2"><Chip tone={RS_CHIP[r.status]}>{r.status === "OVERALLOCATED" ? "مورد محمّل بأعلى من طاقته" : r.status}</Chip></div>
              <div className="mt-3 flex justify-between text-[11.5px] border-t border-brand-border pt-2"><span className="text-brand-muted">تكلفة الساعة</span><span className="font-bold num">{r.hourlyCost} ريال</span></div>
            </div>
          )}
        </Panel>
      </div>
      <SourcesFooter />
    </div>
  );
}
