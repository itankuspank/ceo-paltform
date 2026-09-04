import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, PageHeader, SourcesFooter, Loading, ErrorBox, Chip, Empty } from "@/components/ui";
import { RiskHeatmap } from "@/pages/Pmo";
import { fmtMoney } from "@shared/format";
import { RISK_CATEGORIES } from "@shared/schema";

// ================================================================ Risks & Issues
type Risk = { id: number; code: string; titleAr: string; category: string; probability: number; impact: number; score: number; response: string; status: string; ownerAr: string; projectId: number; projectName: string };
type Issue = { id: number; titleAr: string; severity: string; status: string; openedDays: number; projectId: number; projectName: string };
type RisksPayload = { summary: { total: number; critical: number; medium: number; openIssues: number }; risks: Risk[]; issues: Issue[]; heatmap: number[][] };
const RESP_TONE: Record<string, "off_track" | "gold" | "blue" | "on_track"> = { "تجنب": "off_track", "قبول": "gold", "نقل": "blue", "تخفيف": "on_track" };

export function RisksPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["risks"], queryFn: () => api<RisksPayload>("/api/risks") });
  const [cat, setCat] = useState("all");
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل المخاطر"} />;
  const sm = data.summary; const list = data.risks.filter((r) => cat === "all" || r.category === cat);
  return (
    <div>
      <PageHeader title="المخاطر والمشكلات" subtitle="Risks & Issues" description="المخاطر التي قد تؤثر على تحقيق الأهداف الاستراتيجية والأثر، والمشكلات المفتوحة التي تتطلب معالجة." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي المخاطر" value={sm.total} sub="مخاطرة مسجلة" />
        <KpiCard label="مخاطر حرجة" value={sm.critical} tone="red" sub="درجة 15 فأعلى" />
        <KpiCard label="مخاطر متوسطة" value={sm.medium} tone="amber" sub="درجة 8 – 14" />
        <KpiCard label="مشكلات مفتوحة" value={sm.openIssues} sub="تتطلب معالجة" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="سجل المخاطر" subtitle="مرتب حسب الدرجة (الاحتمالية × الأثر)">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {["all", ...RISK_CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} className={clsx("chip border", cat === c ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{c === "all" ? "الكل" : c}</button>)}
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المخاطرة", "المبادرة", "التصنيف", "الاحتمالية", "الأثر", "الدرجة", "الاستجابة", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i < 2 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
              <tbody>{list.map((r) => (
                <tr key={r.id} className="border-b border-brand-border/70 last:border-0">
                  <td className="py-2"><div className="font-semibold">{r.titleAr}</div><div className="text-[10px] text-brand-muted">{r.ownerAr}</div></td>
                  <td className="py-2 text-[10.5px]"><Link to={`/projects/${r.projectId}`} className="hover:text-brand-green">{r.projectName}</Link></td>
                  <td className="py-2 text-center text-[10.5px] text-brand-muted">{r.category}</td><td className="py-2 text-center num">{r.probability}</td><td className="py-2 text-center num">{r.impact}</td>
                  <td className="py-2 text-center"><Chip tone={r.score >= 15 ? "off_track" : r.score >= 8 ? "at_risk" : "on_track"}>{r.score}/25</Chip></td>
                  <td className="py-2 text-center"><Chip tone={RESP_TONE[r.response]}>{r.response}</Chip></td>
                  <td className="py-2 text-center text-[10.5px]">{r.status}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
        <div className="col-span-2 space-y-4">
          <Panel title="خريطة المخاطر" subtitle="الاحتمالية × الأثر"><RiskHeatmap grid={data.heatmap} compact /></Panel>
          <Panel title="المشكلات المفتوحة" subtitle={`${data.issues.length} مشكلة`}>
            <ul className="space-y-1.5 max-h-[300px] overflow-y-auto">{data.issues.map((i) => (
              <li key={i.id} className={clsx("rounded-md border px-2.5 py-1.5", i.severity === "حرجة" ? "border-[#F0C9C9] bg-rag-redBg" : "border-brand-border")}>
                <div className="flex items-center justify-between gap-2"><div className="text-[11.5px] font-semibold">{i.titleAr}</div><Chip tone={i.severity === "حرجة" ? "off_track" : i.severity === "مرتفعة" ? "at_risk" : "neutral"}>{i.severity}</Chip></div>
                <div className="text-[10px] text-brand-muted"><Link to={`/projects/${i.projectId}`} className="hover:text-brand-green">{i.projectName}</Link> · مفتوحة منذ {i.openedDays} يوم · {i.status}</div>
              </li>
            ))}</ul>
          </Panel>
        </div>
      </div>
      <SourcesFooter />
    </div>
  );
}

// ================================================================ Dependencies
type Dep = { id: number; type: string; status: string; noteAr: string; fromId: number; fromName: string; toId: number; toName: string };
type DepPayload = { summary: { total: number; healthy: number; atRisk: number; blocked: number }; dependencies: Dep[] };

export function DependenciesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dependencies"], queryFn: () => api<DepPayload>("/api/dependencies") });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل الاعتماديات"} />;
  const sm = data.summary;
  return (
    <div>
      <PageHeader title="الاعتماديات" subtitle="Cross-Program Dependencies" description="المشاريع والبرامج التي تعتمد على بعضها في المخرجات أو الموارد أو البنية التحتية." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي الاعتماديات" value={sm.total} /><KpiCard label="سليمة" value={sm.healthy} tone="green" /><KpiCard label="معرضة للخطر" value={sm.atRisk} tone="amber" /><KpiCard label="متعثرة" value={sm.blocked} tone="red" />
      </div>
      <Panel className="mt-4" title="خريطة الاعتماديات" subtitle="المشروع المعتمِد ← المشروع المعتمَد عليه">
        {data.dependencies.length === 0 ? <Empty label="لا توجد اعتماديات" /> : (
          <ul className="space-y-2">{data.dependencies.map((d) => (
            <li key={d.id} className="rounded-lg border border-brand-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-[12px]">
                  <Link to={`/projects/${d.fromId}`} className="chip bg-rag-greenBg text-rag-green font-semibold hover:underline">{d.fromName}</Link>
                  <ChevronLeft className="h-3.5 w-3.5 text-brand-muted" />
                  <Link to={`/projects/${d.toId}`} className="chip bg-brand-cream border border-brand-border font-semibold hover:underline">{d.toName}</Link>
                </div>
                <div className="flex items-center gap-2"><Chip tone="neutral">نوع: {d.type}</Chip><StatusChip status={d.status} /></div>
              </div>
              <div className="text-[10.5px] text-brand-muted mt-1">{d.noteAr}</div>
            </li>
          ))}</ul>
        )}
      </Panel>
      <SourcesFooter />
    </div>
  );
}

// ================================================================ Governance
type Gov = {
  summary: { pendingDecisions: number; openEscalations: number; scheduledApprovals: number; changeRequests: number };
  decisions: { id: number; code: string; titleAr: string; type: string; priority: string; amount: number | null; dueDate: string; ownerAr: string; projectName: string | null }[];
  changeRequests: { id: number; code: string; titleAr: string; impactAr: string; status: string; projectName: string }[];
  escalations: { id: number; titleAr: string; ownerAr: string; openedDays: number; projectName: string }[];
  stageGates: { gate: number; nameAr: string; count: number }[];
};
const CR_TONE: Record<string, "at_risk" | "on_track" | "blue" | "neutral"> = { "بانتظار لجنة التغيير": "at_risk", "معتمد": "on_track", "مرفوع للجنة": "blue", "قيد الدراسة": "neutral" };

export function GovernancePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["governance"], queryFn: () => api<Gov>("/api/governance") });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل الحوكمة"} />;
  const sm = data.summary;
  return (
    <div>
      <PageHeader title="الحوكمة" subtitle="Governance — Decisions, Escalations & Stage Gates" description="إطار الحوكمة لضمان انضباط التنفيذ وسرعة اتخاذ القرار." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="قرارات معلقة" value={sm.pendingDecisions} tone="amber" /><KpiCard label="تصعيدات مفتوحة" value={sm.openEscalations} tone="red" /><KpiCard label="موافقات مجدولة" value={sm.scheduledApprovals} sub="خلال 30 يوماً" /><KpiCard label="طلبات تغيير" value={sm.changeRequests} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Panel title="القرارات المعلقة" subtitle="مركز القرارات" actions={<Link to="/decisions" className="text-[11px] font-semibold text-brand-green">فتح مركز القرارات</Link>}>
          <ul className="divide-y divide-brand-border">{data.decisions.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0"><div className="text-[12px] font-semibold truncate">{d.titleAr}</div><div className="text-[10px] text-brand-muted truncate">{d.type} · {d.projectName ?? "—"}</div></div>
              <div className="text-left shrink-0"><div className="text-[12px] font-bold num">{d.amount ? fmtMoney(d.amount) : "—"}</div><Chip tone={d.priority === "عاجلة" ? "off_track" : "at_risk"}>{d.dueDate}</Chip></div>
            </li>
          ))}</ul>
        </Panel>
        <Panel title="طلبات التغيير" subtitle="Change Requests">
          <ul className="space-y-1.5">{data.changeRequests.map((c) => (
            <li key={c.id} className="rounded-md border border-brand-border px-2.5 py-2">
              <div className="flex items-center justify-between gap-2"><div className="text-[11.5px] font-semibold flex items-center gap-2"><span className="font-mono text-[10px] text-brand-muted">{c.code}</span>{c.titleAr}</div><Chip tone={CR_TONE[c.status]}>{c.status}</Chip></div>
              <div className="text-[10px] text-brand-muted mt-0.5">{c.projectName} · {c.impactAr}</div>
            </li>
          ))}</ul>
        </Panel>
      </div>
      <Panel className="mt-4" title="البوابات المرحلية" subtitle="Stage Gates — توزيع المبادرات على مراحل الحوكمة">
        <div className="grid grid-cols-5 gap-3">{data.stageGates.map((g) => (
          <div key={g.gate} className="rounded-lg border border-brand-border bg-brand-cream px-3 py-3 text-center"><div className="text-[10px] text-brand-muted">البوابة {g.gate} · {g.nameAr}</div><div className="text-[24px] font-bold num text-brand-green">{g.count}</div><div className="text-[10px] text-brand-muted">مبادرة</div></div>
        ))}</div>
      </Panel>
      <Panel className="mt-4" title="التصعيدات المفتوحة" subtitle="Open Escalations">
        {data.escalations.length === 0 ? <Empty label="لا توجد تصعيدات مفتوحة" /> : (
          <ul className="space-y-1.5">{data.escalations.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-md border border-[#F0C9C9] bg-rag-redBg px-3 py-2">
              <div><div className="text-[12px] font-semibold">{e.titleAr}</div><div className="text-[10px] text-brand-muted">{e.projectName} · الجهة: {e.ownerAr}</div></div>
              <Chip tone="off_track">مفتوحة منذ {e.openedDays} يوم</Chip>
            </li>
          ))}</ul>
        )}
      </Panel>
      <SourcesFooter />
    </div>
  );
}
