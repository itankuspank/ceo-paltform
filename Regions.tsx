import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import RegionMap, { type MapMode, type RegionMetric } from "@/components/RegionMap";
import { KpiCard, Panel, StatusChip, PageHeader, SourcesFooter, Loading, ErrorBox, Chip } from "@/components/ui";
import { fmtMoney, fmtPct } from "@shared/format";

type Region = RegionMetric & { id: number; nameEn: string; kpis: number; sectors: string[]; projects: { id: number; code: string; nameAr: string; status: string; budget: number | null; sectorName: string; impactAchieved: number; impactTarget: number }[] };
type Payload = { totals: { initiatives: number; investment: number; impact: number; kpis: number; onTrack: number; atRisk: number; offTrack: number }; regions: Region[] };

const MODES: { value: MapMode; label: string }[] = [{ value: "impact", label: "الأثر المحقق" }, { value: "investment", label: "الاستثمار" }, { value: "initiatives", label: "عدد المبادرات" }, { value: "risks", label: "المخاطر" }];
const LEGEND = [["#0F6B4B", "≥ 85% ممتاز"], ["#C9A227", "75% – 84% جيد"], ["#E2792C", "60% – 74% يحتاج متابعة"], ["#C63B3B", "أقل من 60% حرجة"]];
const sel = "rounded-md border border-brand-border bg-white px-2 py-1.5 text-[11.5px]";

export default function RegionsPage() {
  const [sector, setSector] = useState("all"); const [status, setStatus] = useState("all"); const [mode, setMode] = useState<MapMode>("impact");
  const [selected, setSelected] = useState<string | null>(null); const [compare, setCompare] = useState<string[]>(["RUH", "MKK", "EST"]);
  const { data: geojson } = useQuery({ queryKey: ["geojson"], queryFn: () => fetch("/geo/saudi-regions.geojson").then((r) => r.json()), staleTime: Infinity });
  const { data: sectors } = useQuery({ queryKey: ["ref-sectors"], queryFn: () => api<{ id: number; nameAr: string }[]>("/api/reference/sectors"), staleTime: Infinity });
  const { data, isLoading, error } = useQuery({ queryKey: ["regions", sector], queryFn: () => api<Payload>(`/api/regions${sector !== "all" ? `?sector=${sector}` : ""}`) });
  const metrics = useMemo(() => Object.fromEntries((data?.regions ?? []).map((r) => [r.code, r])), [data]);
  if (isLoading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل بيانات المناطق"} />;
  const t = data.totals;
  const list = data.regions.filter((r) => status === "all" || r.status === status);
  const region = selected ? data.regions.find((r) => r.code === selected) : null;
  const cmp = data.regions.filter((r) => compare.includes(r.code));

  return (
    <div>
      <PageHeader title="مناطق المملكة العربية السعودية" subtitle="Saudi Regions — Executive Geographic Intelligence"
        breadcrumb={<span><Link to="/overview" className="hover:text-brand-green">الرئيسية</Link> ← المملكة العربية السعودية</span>}
        description="أين تتركز المبادرات والاستثمارات؟ وأي منطقة تحقق الأثر الاستراتيجي المستهدف وأيها تحتاج تدخلاً؟" />
      <div className="card px-4 py-2.5 flex items-center gap-2 flex-wrap text-[11px]">
        <span className="text-brand-muted">التصفية:</span>
        <select className={sel} value="2026" onChange={() => undefined}><option>السنة: 2026</option></select>
        <select className={sel} value={selected ?? "all"} onChange={(e) => setSelected(e.target.value === "all" ? null : e.target.value)}>
          <option value="all">جميع المناطق</option>{data.regions.map((r) => <option key={r.code} value={r.code}>{r.nameAr}</option>)}
        </select>
        <select className={sel} value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="all">جميع القطاعات</option>{(sectors ?? []).map((s) => <option key={s.id} value={String(s.id)}>{s.nameAr}</option>)}
        </select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">جميع الحالات</option><option value="on_track">على المسار</option><option value="at_risk">معرض للخطر</option><option value="off_track">خارج المسار</option>
        </select>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-3">
        <KpiCard label="المبادرات المرتبطة بالمناطق" value={t.initiatives} />
        <KpiCard label="إجمالي الاستثمارات" value={fmtMoney(t.investment)} />
        <KpiCard label="الأثر المحقق" value={fmtPct(t.impact)} tone="green" />
        <KpiCard label="مؤشرات الأداء المرصودة" value={t.kpis} />
        <KpiCard label="مناطق على المسار" value={t.onTrack} tone="green" />
        <KpiCard label="مناطق معرضة للخطر" value={t.atRisk} tone="amber" />
        <KpiCard label="مناطق خارج المسار" value={t.offTrack} tone="red" />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="الخريطة التنفيذية للمملكة" subtitle="MapLibre GL JS + GeoJSON محلي — تعمل بالكامل داخل البيئة المعزولة"
          actions={<select className={sel} value={mode} onChange={(e) => setMode(e.target.value as MapMode)}>{MODES.map((m) => <option key={m.value} value={m.value}>عرض: {m.label}</option>)}</select>}>
          <div className="h-[460px]">{geojson ? <RegionMap geojson={geojson} metrics={metrics as any} mode={mode} selected={selected} onSelect={setSelected} /> : <Loading />}</div>
          {mode === "impact" && (
            <div className="mt-2 flex items-center gap-4 text-[10.5px] text-brand-muted">{LEGEND.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {l}</span>)}</div>
          )}
          <div className="text-[10px] text-brand-muted mt-1">اضغط على أي منطقة لعرض تفاصيلها — الضغط على الخريطة خارج المناطق يعيد عرض المملكة كاملة.</div>
        </Panel>

        <Panel className="col-span-2" title={region ? region.nameAr : "المملكة العربية السعودية"} subtitle={region ? `${region.nameEn} — تفاصيل المنطقة` : "Kingdom-wide view — اضغط على منطقة لعرض تفاصيلها"}
          actions={region && <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green"><ArrowRight className="h-3 w-3" /> المملكة</button>}>
          {!region ? (
            <ul className="divide-y divide-brand-border max-h-[470px] overflow-y-auto">
              {list.map((r) => (
                <li key={r.code}><button onClick={() => setSelected(r.code)} className="w-full flex items-center justify-between gap-2 py-2 text-right hover:bg-brand-cream px-1 rounded">
                  <div><div className="text-[12px] font-semibold">{r.nameAr}</div><div className="text-[10px] text-brand-muted num">{r.initiatives} مبادرة · {fmtMoney(r.investment)}</div></div>
                  <Chip tone={r.status}>{r.impact}%</Chip>
                </button></li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[["المبادرات", region.initiatives], ["الاستثمار", fmtMoney(region.investment)], ["الأثر المحقق", `${region.impact}%`], ["مؤشرات الأداء", region.kpis], ["المخاطر", region.risks], ["الحالة", <StatusChip key="s" status={region.status} />]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg border border-brand-border bg-brand-cream px-3 py-2"><div className="text-[10px] text-brand-muted">{l as string}</div><div className="text-[14px] font-bold num">{v as any}</div></div>
                ))}
              </div>
              <div><div className="text-[10.5px] text-brand-muted mb-1">القطاعات العاملة في المنطقة</div><div className="flex flex-wrap gap-1">{region.sectors.map((s) => <Chip key={s}>{s}</Chip>)}</div></div>
              <div><div className="text-[10.5px] text-brand-muted mb-1">أبرز المبادرات</div>
                <ul className="divide-y divide-brand-border">{region.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1.5"><Link to={`/projects/${p.id}`} className="text-[11.5px] font-semibold hover:text-brand-green truncate">{p.nameAr}</Link><span className="text-[10px] text-brand-muted num whitespace-nowrap">{fmtMoney(p.budget ?? 0)}</span><StatusChip status={p.status} /></li>
                ))}</ul>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="مقارنة المناطق" subtitle="Region Comparison — اختر المناطق للمقارنة">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.regions.map((r) => (
            <button key={r.code} onClick={() => setCompare((c) => c.includes(r.code) ? c.filter((x) => x !== r.code) : [...c, r.code])} className={clsx("chip border", compare.includes(r.code) ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{r.nameAr}</button>
          ))}
        </div>
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المنطقة", "المبادرات", "الاستثمار", "الأثر المحقق", "مؤشرات الأداء", "المخاطر", "القطاعات", "حالة المنطقة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
          <tbody>{cmp.map((r) => (
            <tr key={r.code} className="border-b border-brand-border/70 last:border-0">
              <td className="py-2 font-semibold">{r.nameAr}</td><td className="py-2 text-center num">{r.initiatives}</td><td className="py-2 text-center num">{fmtMoney(r.investment)}</td>
              <td className="py-2 text-center num font-semibold">{r.impact}%</td><td className="py-2 text-center num">{r.kpis}</td><td className="py-2 text-center num">{r.risks}</td><td className="py-2 text-center num">{r.sectors.length}</td>
              <td className="py-2 text-center"><StatusChip status={r.status} /></td>
            </tr>
          ))}</tbody>
        </table>
      </Panel>
      <SourcesFooter />
    </div>
  );
}
