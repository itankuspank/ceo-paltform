import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Empty } from "@/components/ui";
import { fmtMoney, fmtPct } from "@shared/format";

type Program = { id: number; code: string; nameAr: string; portfolioId: number; portfolioName: string; managerName: string; budget: number; actual: number; eac: number; progress: number; impact: number; projectCount: number; scheduleStatus: string; financialStatus: string; status: string };

export default function ProgramsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["programs"], queryFn: () => api<Program[]>("/api/programs") });
  const [q, setQ] = useState(""); const [pf, setPf] = useState("all");
  const portfolios = useMemo(() => Array.from(new Map((data ?? []).map((p) => [p.portfolioId, p.portfolioName])).entries()), [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل البرامج"} />;
  const list = data.filter((p) => (pf === "all" || String(p.portfolioId) === pf) && (!q || p.nameAr.includes(q) || p.managerName.includes(q)));
  const totalBudget = data.reduce((a, p) => a + p.budget, 0);
  const avgProgress = Math.round((data.reduce((a, p) => a + p.progress, 0) / data.length) * 10) / 10;

  return (
    <div>
      <PageHeader title="البرامج" subtitle="Programs" description="البرامج تجمع المبادرات المترابطة تحت مظلة محفظة استراتيجية واحدة." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="إجمالي البرامج" value={data.length} sub="برنامجاً" />
        <KpiCard label="إجمالي الميزانيات" value={fmtMoney(totalBudget)} />
        <KpiCard label="متوسط الإنجاز" value={fmtPct(avgProgress, 1)} />
        <KpiCard label="برامج معرضة للخطر" value={data.filter((p) => p.status !== "on_track").length} tone="amber" sub="تتطلب متابعة" />
      </div>
      <div className="card mt-4 px-4 py-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-brand-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في البرامج…" className="w-full rounded-md border border-brand-border bg-brand-cream pr-8 pl-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
        </div>
        <select value={pf} onChange={(e) => setPf(e.target.value)} className="rounded-md border border-brand-border bg-white px-2 py-1.5 text-[11.5px]">
          <option value="all">جميع المحافظ</option>
          {portfolios.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
        </select>
      </div>
      <Panel className="mt-4" title={`البرامج (${list.length})`} subtitle="Program Performance">
        {list.length === 0 ? <Empty label="لا توجد برامج مطابقة" /> : (
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">
              {["البرنامج", "المحفظة", "المدير", "الميزانية", "المصروف", "الإنجاز", "الجدول", "المالي", "الأثر", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/70 last:border-0">
                  <td className="py-2"><div className="font-semibold">{p.nameAr}</div><div className="text-[10px] text-brand-muted font-mono">{p.code} · {p.projectCount} مشاريع</div></td>
                  <td className="py-2 text-center text-brand-muted">{p.portfolioName}</td>
                  <td className="py-2 text-center text-brand-muted">{p.managerName}</td>
                  <td className="py-2 text-center num">{fmtMoney(p.budget)}</td>
                  <td className="py-2 text-center num">{fmtMoney(p.actual)}</td>
                  <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={p.progress} tone="brand" className="flex-1 min-w-[60px]" /><span className="num text-[10.5px] w-8">{p.progress}%</span></div></td>
                  <td className="py-2 text-center"><StatusChip status={p.scheduleStatus} /></td>
                  <td className="py-2 text-center"><StatusChip status={p.financialStatus} /></td>
                  <td className="py-2 text-center num font-semibold">{p.impact}%</td>
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
