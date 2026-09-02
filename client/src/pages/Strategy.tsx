import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox } from "@/components/ui";
import { fmtMoney } from "@shared/format";

type Goal = {
  id: number; code: string; nameAr: string; nameEn: string; achievedImpact: number; targetImpact: number; investment: number;
  objectives: { id: number; code: string; nameAr: string }[];
  kpis: { id: number; code: string; nameAr: string; baseline: number; target: number; current: number; unit: string; status: string; attainment: number }[];
  portfolios: { id: number; nameAr: string; status: string; investment: number; achieved: number }[];
};

export default function StrategyPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["strategy"], queryFn: () => api<{ goals: Goal[] }>("/api/strategy") });
  const [sel, setSel] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل شجرة الاستراتيجية"} />;
  const goal = data.goals.find((g) => g.code === sel) ?? data.goals[0];

  return (
    <div>
      <PageHeader title="الغايات والأهداف الاستراتيجية" subtitle="Strategy Map — Goals, Objectives & KPIs"
        description="الغايات ← الأهداف ← مؤشرات الأداء ← المبادرات ← المخرجات ← النتائج ← الأثر المحقق" />

      <div className="grid grid-cols-5 gap-3">
        {data.goals.map((g) => (
          <button key={g.id} onClick={() => setSel(g.code)} className={clsx("text-right rounded-xl border px-4 py-3 shadow-card transition-colors", goal.code === g.code ? "border-brand-gold bg-[#FBF6E7] ring-1 ring-brand-gold" : "bg-white border-brand-border hover:border-brand-green/40")}>
            <div className="text-[12.5px] font-bold leading-tight">{g.nameAr}</div>
            <div className="text-[10px] text-brand-muted">{g.nameEn}</div>
            <div className="mt-2 text-[22px] font-bold num text-brand-green">{g.achievedImpact}%</div>
            <ProgressBar value={g.achievedImpact} tone={g.achievedImpact >= 85 ? "green" : "gold"} className="mt-1" />
            <div className="text-[10px] text-brand-muted mt-1">{fmtMoney(g.investment)}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <KpiCard label="الغاية المختارة" value={<span className="text-[16px]">{goal.nameAr}</span>} sub={goal.nameEn} />
        <KpiCard label="الأهداف المرتبطة" value={goal.objectives.length} sub="هدفاً فرعياً" />
        <KpiCard label="مؤشرات الأداء" value={goal.kpis.length} sub={`${goal.kpis.filter((k) => k.status === "on_track").length} على المسار`} />
        <KpiCard label="الاستثمار" value={fmtMoney(goal.investment)} tone="green" sub="المرتبط بالغاية" />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-2" title="الأهداف الاستراتيجية" subtitle={goal.nameAr}>
          <ul className="space-y-2">
            {goal.objectives.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-lg border border-brand-border px-3 py-2">
                <span className="chip bg-brand-cream border border-brand-border font-mono text-brand-muted">{o.code}</span>
                <span className="text-[12.5px] font-medium">{o.nameAr}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="col-span-3" title="مؤشرات الأداء المرتبطة" subtitle="اضغط على المؤشر للاطلاع على المبادرات المساهمة">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">
              <th className="py-1.5 text-right font-medium">المؤشر</th><th className="py-1.5 font-medium">خط الأساس</th><th className="py-1.5 font-medium">المستهدف</th><th className="py-1.5 font-medium">الحالي</th><th className="py-1.5 font-medium">الإنجاز</th><th className="py-1.5 font-medium">الحالة</th>
            </tr></thead>
            <tbody>
              {goal.kpis.map((k) => (
                <tr key={k.id} className="border-b border-brand-border/70 last:border-0">
                  <td className="py-2"><Link to={`/kpis/${k.id}`} className="font-semibold hover:text-brand-green">{k.nameAr}</Link></td>
                  <td className="py-2 text-center num">{k.baseline}</td><td className="py-2 text-center num">{k.target}</td><td className="py-2 text-center num font-semibold">{k.current}</td>
                  <td className="py-2 text-center num">{k.attainment}%</td>
                  <td className="py-2 text-center"><StatusChip status={k.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="mt-4" title="المحافظ المساهمة في الغاية" subtitle="Many-to-Many — علاقة متعددة الأطراف بين المحافظ والغايات">
        <div className="grid grid-cols-3 gap-3">
          {goal.portfolios.length === 0 && <div className="text-[12px] text-brand-muted">لا توجد محافظ مرتبطة</div>}
          {goal.portfolios.map((p) => (
            <Link key={p.id} to={`/portfolios/${p.id}`} className="rounded-lg border border-brand-border px-3 py-2.5 hover:bg-brand-cream">
              <div className="flex items-center justify-between"><div className="text-[12.5px] font-semibold">{p.nameAr}</div><StatusChip status={p.status} /></div>
              <div className="text-[10.5px] text-brand-muted mt-1">{fmtMoney(p.investment)}</div>
              <div className="flex items-center gap-2 mt-1.5"><ProgressBar value={p.achieved} className="flex-1" /><span className="text-[11px] font-bold num">{p.achieved}%</span></div>
              <div className="text-[10px] text-brand-muted mt-0.5">الأثر المحقق</div>
            </Link>
          ))}
        </div>
      </Panel>
      <SourcesFooter />
    </div>
  );
}
