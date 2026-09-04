import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox } from "@/components/ui";
import { fmtMoney, fmtPct } from "@shared/format";

type Sector = { id: number; code: string; nameAr: string; nameEn: string; initiatives: number; investment: number; kpis: number; impact: number; status: string };

export default function SectorsPage() {
  const [region, setRegion] = useState("all"); const [active, setActive] = useState<number | null>(null);
  const { data: regions } = useQuery({ queryKey: ["ref-regions"], queryFn: () => api<{ id: number; nameAr: string }[]>("/api/reference/regions"), staleTime: Infinity });
  const { data, isLoading, error } = useQuery({ queryKey: ["sectors", region], queryFn: () => api<Sector[]>(`/api/sectors${region !== "all" ? `?region=${region}` : ""}`) });
  if (isLoading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل القطاعات"} />;
  const totalInv = data.reduce((a, s) => a + s.investment, 0);
  const avgImpact = totalInv ? Math.round(data.reduce((a, s) => a + s.impact * s.investment, 0) / totalInv) : 0;
  return (
    <div>
      <PageHeader title="قطاعات وزارة الداخلية" subtitle="MOI Sector Performance — Cross-Region"
        breadcrumb={<span><Link to="/overview" className="hover:text-brand-green">الرئيسية</Link> ← قطاعات الوزارة</span>}
        description="أداء القطاعات التشغيلية للوزارة عبر مناطق المملكة، مرتبطاً بالمبادرات ومؤشرات الأداء والأثر المحقق."
        actions={<select className="rounded-md border border-brand-border bg-white px-2 py-1.5 text-[11.5px]" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">جميع المناطق</option>{(regions ?? []).map((r) => <option key={r.id} value={String(r.id)}>{r.nameAr}</option>)}
        </select>} />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="عدد القطاعات" value={data.length} sub="قطاعاً تشغيلياً" />
        <KpiCard label="المبادرات" value={data.reduce((a, s) => a + s.initiatives, 0)} sub="مبادرة" />
        <KpiCard label="الاستثمارات" value={fmtMoney(totalInv)} />
        <KpiCard label="متوسط الأثر المحقق" value={fmtPct(avgImpact)} tone="green" sub="مرجّح بالاستثمار" />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="القطاعات على مستوى المملكة" subtitle="اضغط على القطاع لعرض تفاصيله">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["القطاع", "المبادرات", "الاستثمار", "المؤشرات المدعومة", "الأثر المحقق", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
            <tbody>{data.map((s) => (
              <tr key={s.id} onClick={() => setActive(s.id)} className={clsx("border-b border-brand-border/70 last:border-0 cursor-pointer", active === s.id ? "bg-[#FBF6E7]" : "hover:bg-brand-cream/60")}>
                <td className="py-2 font-semibold">{s.nameAr}</td><td className="py-2 text-center num">{s.initiatives}</td><td className="py-2 text-center num">{fmtMoney(s.investment)}</td><td className="py-2 text-center num">{s.kpis}</td>
                <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={s.impact} className="flex-1 min-w-[70px]" /><span className="num text-[10.5px] w-9">{s.impact}%</span></div></td>
                <td className="py-2 text-center"><StatusChip status={s.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
        <Panel className="col-span-2" title="تفاصيل القطاع" subtitle="اسم القطاع باللغتين ومنفذ الاطلاع على مبادراته">
          <ul className="space-y-1.5">{data.map((s) => (
            <li key={s.id}>
              <button onClick={() => setActive(s.id)} className={clsx("w-full rounded-lg border px-3 py-2 text-right transition-colors", active === s.id ? "border-brand-gold bg-[#FBF6E7]" : "border-brand-border hover:bg-brand-cream")}>
                <div className="flex items-center justify-between"><span className="text-[12px] font-semibold">{s.nameAr}</span><span className="text-[10px] text-brand-muted">{s.nameEn}</span></div>
                {active === s.id && <div className="mt-1.5 text-[10.5px] text-brand-muted num">{s.initiatives} مبادرة · {fmtMoney(s.investment)} · {s.kpis} مؤشرات · الأثر {s.impact}% <Link to="/projects" className="text-brand-green font-semibold mr-1">عرض المبادرات</Link></div>}
              </button>
            </li>
          ))}</ul>
        </Panel>
      </div>
      <SourcesFooter />
    </div>
  );
}
