import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock } from "lucide-react";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { KpiCard, Panel, Chip, PageHeader, SourcesFooter, Loading, ErrorBox, Empty } from "@/components/ui";
import { fmtMoney } from "@shared/format";
import { DECISION_TYPES } from "@shared/schema";

type Decision = {
  id: number; code: string; titleAr: string; type: string; priority: string; amount: number | null; ownerAr: string; dueDate: string; status: string;
  impactNoteAr: string | null; decidedAt: string | null; projectName: string | null; portfolioName: string | null;
};
type Payload = { summary: { total: number; financial: number; financialAmount: number; scope: number; other: number }; decisions: Decision[] };

const STATUS_TONE: Record<string, "on_track" | "off_track" | "gold" | "at_risk"> = { "معتمد": "on_track", "مرفوض": "off_track", "مؤجل": "gold", "معلق": "at_risk" };

export default function DecisionsPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const { data, isLoading, error } = useQuery({ queryKey: ["decisions"], queryFn: () => api<Payload>("/api/decisions") });
  const decide = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => post(`/api/decisions/${id}/decide`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions"] }); qc.invalidateQueries({ queryKey: ["overview"] }); qc.invalidateQueries({ queryKey: ["landing"] }); },
  });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل القرارات"} />;
  const sm = data.summary;
  const list = data.decisions.filter((d) => filter === "all" || d.type === filter);
  const canDecide = can("decisions:decide");

  return (
    <div>
      <PageHeader title="القرارات التنفيذية" subtitle="CEO ATTENTION REQUIRED — Executive Decisions"
        description="القرارات التي تتطلب تدخل القيادة، مرتبة حسب الأولوية والموعد المطلوب." />

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي القرارات المطلوبة" value={sm.total} tone="amber" sub="بانتظار اعتماد القيادة" />
        <KpiCard label="اعتمادات مالية" value={sm.financial} sub={`${fmtMoney(sm.financialAmount)}`} />
        <KpiCard label="قرارات نطاق" value={sm.scope} sub="تغيير في نطاق المبادرات" />
        <KpiCard label="تصعيد / موارد / مخاطرة" value={sm.other} tone="red" sub="قرارات غير مالية" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {["all", ...DECISION_TYPES].map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`chip ${filter === t ? "bg-brand text-white" : "bg-white border border-brand-border text-brand-muted hover:text-brand-text"}`}>
            {t === "all" ? "الكل" : t}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {list.length === 0 && <Empty label="لا توجد قرارات ضمن هذا التصنيف" />}
        {list.map((d) => (
          <Panel key={d.id} title={
            <span className="flex items-center gap-2 flex-wrap">
              <Chip tone="neutral" className="font-mono">{d.code}</Chip>
              <Chip tone={d.priority === "عاجلة" ? "off_track" : "at_risk"}>أولوية {d.priority}</Chip>
              <Chip tone="blue">{d.type}</Chip>
              {d.status !== "معلق" && <Chip tone={STATUS_TONE[d.status]}>{d.status}</Chip>}
            </span>
          } subtitle={<span className="text-[13px] font-bold text-brand-text">{d.titleAr}</span>}
            actions={
              <div className="text-left">
                <div className="text-[15px] font-bold num">{d.amount ? fmtMoney(d.amount) : "—"}</div>
                <div className="text-[10.5px] text-brand-muted flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> الموعد: {d.dueDate}</div>
              </div>
            }>
            <div className="text-[11px] text-brand-muted">المبادرة: {d.projectName ?? "—"}{d.portfolioName ? ` · ${d.portfolioName}` : ""} · الجهة المالكة: {d.ownerAr}</div>
            {d.impactNoteAr && <div className="mt-1 text-[11.5px] font-semibold text-brand-green">{d.impactNoteAr}</div>}
            {canDecide && d.status === "معلق" && (
              <div className="mt-3 flex items-center gap-2">
                <button disabled={decide.isPending} onClick={() => decide.mutate({ id: d.id, status: "معتمد" })} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"><Check className="h-3.5 w-3.5" /> اعتماد</button>
                <button disabled={decide.isPending} onClick={() => decide.mutate({ id: d.id, status: "مؤجل" })} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-white px-3 py-1.5 text-[11.5px] font-semibold hover:bg-brand-cream disabled:opacity-60"><Clock className="h-3.5 w-3.5" /> تأجيل</button>
                <button disabled={decide.isPending} onClick={() => decide.mutate({ id: d.id, status: "مرفوض" })} className="inline-flex items-center gap-1 rounded-md border border-[#F0C9C9] bg-rag-redBg px-3 py-1.5 text-[11.5px] font-semibold text-rag-red hover:bg-[#F6DADA] disabled:opacity-60"><X className="h-3.5 w-3.5" /> رفض</button>
                <span className="text-[10px] text-brand-muted mr-2">يُسجَّل القرار في سجل التغييرات باسم صاحب الصلاحية</span>
              </div>
            )}
          </Panel>
        ))}
      </div>
      <SourcesFooter />
    </div>
  );
}
