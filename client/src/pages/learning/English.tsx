import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LabelList, Legend } from "recharts";
import { api } from "@/lib/api";
import { Panel, Loading, ErrorBox, Chip } from "@/components/ui";
import { CEFR } from "@shared/schema";

type Row = { id: number; resourceId: number; nameAr: string; departmentAr: string; placementLevel: string | null; currentLevel: string; platform: string | null; completion: number; improvement: number };
const LEVEL_COLORS: Record<string, string> = { A0: "#BFC7C2", A1: "#8FB9A8", A2: "#0F7A4E", B1: "#0E3F36", B2: "#1B5E4A", C1: "#C9A227", C2: "#E6C765", "لايوجد": "#D9D9D9" };
const ALL_LEVELS = [...CEFR, "لايوجد"];
const tick = { fontSize: 10, fill: "#6B7672" };
const count = <T,>(arr: T[], key: (x: T) => string) => { const m = new Map<string, number>(); arr.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1)); return m; };

/** Green-header stat card in the Power BI reference style */
function Stat({ label, value, chip }: { label: string; value: number; chip?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-brand-border shadow-card">
      <div className="bg-brand text-white text-[11.5px] font-semibold px-3 py-1.5 text-center">{label}</div>
      <div className="bg-white px-3 py-3 flex items-center justify-center gap-3"><span className="text-[28px] font-bold num text-brand">{value}</span>{chip && <span className="rounded-full border-2 border-brand-gold px-2.5 py-1 text-[11px] font-bold text-[#8A6A12] num">{chip}</span>}</div>
    </div>
  );
}

export default function EnglishPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["learning-english"], queryFn: () => api<Row[]>("/api/learning/english") });
  const [imp, setImp] = useState<number[]>([]);
  const filtered = useMemo(() => (data ?? []).filter((r) => imp.length === 0 || imp.includes(r.improvement)), [data, imp]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل بيانات اللغة الإنجليزية"} />;

  const tested = data.filter((r) => r.placementLevel).length;
  const b2plus = data.filter((r) => CEFR.indexOf(r.currentLevel as any) >= 4).length;
  const b1minus = data.filter((r) => r.placementLevel && CEFR.indexOf(r.currentLevel as any) <= 3).length;
  const improved = data.filter((r) => r.improvement > 0).length;
  const byDept = Array.from(count(filtered, (r) => r.departmentAr)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const byPlacement = ALL_LEVELS.map((l) => ({ name: l, value: filtered.filter((r) => (r.placementLevel ?? "لايوجد") === l).length })).filter((x) => x.value).sort((a, b) => b.value - a.value);
  const byCurrent = CEFR.map((l) => ({ name: l, value: filtered.filter((r) => r.currentLevel === l).length })).filter((x) => x.value);
  const improversByDept = Array.from(count(filtered.filter((r) => r.improvement > 0), (r) => r.departmentAr)).map(([name, value]) => ({ name, value }));
  const journey = ALL_LEVELS.map((start) => { const rows = filtered.filter((r) => (r.placementLevel ?? "لايوجد") === start); const tot = rows.length || 1; const o: any = { name: start, total: rows.length }; CEFR.forEach((cur) => { o[cur] = Math.round((rows.filter((r) => r.currentLevel === cur).length / tot) * 100); }); return o; }).filter((x) => x.total);
  const DEPT_COLORS = ["#0E3F36", "#0F7A4E", "#C9A227", "#1B5E4A", "#8FB9A8", "#E6C765", "#2F6F8F"];

  return (
    <div>
      <div className="rounded-xl bg-brand text-white px-5 py-3 flex items-center justify-between mb-4"><div><div className="text-[15px] font-bold">بناء وتطوير القدرات</div><div className="text-[11px] text-white/70">متابعة تحسن مهارات اللغة الإنجليزية — وفق الإطار الأوروبي المرجعي CEFR</div></div><Chip tone="gold">{data.length} مشاركاً</Chip></div>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="عدد الموظفين" value={data.length} chip={`${tested}`} />
        <Stat label="الموظفون المستوفون لمستوى B2 فأعلى" value={b2plus} />
        <Stat label="الموظفون المستوفون لمستوى B1 فأقل" value={b1minus} />
        <Stat label="عدد الموظفين المتحسنين" value={improved} chip={`نسبة التحسن ${Math.round((improved / tested) * 100)}%`} />
      </div>
      <div className="card mt-4 px-4 py-2.5 flex items-center gap-3"><span className="text-[11.5px] font-semibold">مقدار التحسن</span>
        {[0, 1, 2, 3, 4].map((n) => <button key={n} onClick={() => setImp((c) => c.includes(n) ? c.filter((x) => x !== n) : [...c, n])} className={clsx("h-8 min-w-12 rounded-md border text-[12px] font-bold num", imp.includes(n) ? "bg-brand text-white border-brand" : "bg-white border-brand-border text-brand-muted")}>{n}</button>)}
        {imp.length > 0 && <button onClick={() => setImp([])} className="text-[11px] text-brand-green font-semibold">إلغاء التصفية</button>}
        <span className="text-[10px] text-brand-muted mr-auto">يؤثر على جميع الرسوم فوراً · جدول المشاركين يبقى كاملاً</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Panel title="التوزيع حسب الإدارات" subtitle="Participants by department">
          <div className="h-[260px]"><ResponsiveContainer><BarChart data={byDept} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={14}>
            <CartesianGrid horizontal={false} stroke="#EEF0EC" /><XAxis type="number" reversed tick={tick} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" orientation="right" width={130} tick={{ fontSize: 9.5, fill: "#1F2A26" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} /><Bar dataKey="value" name="الموظفون" fill="#0E3F36" radius={[3, 3, 3, 3]} isAnimationActive={false}><LabelList dataKey="value" position="insideLeft" style={{ fontSize: 10, fill: "#fff" }} /></Bar>
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="توزيع الموظفين حسب اختبار تحديد المستوى" subtitle="By placement test level">
          <div className="h-[260px]"><ResponsiveContainer><BarChart data={byPlacement} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={16}>
            <CartesianGrid horizontal={false} stroke="#EEF0EC" /><XAxis type="number" reversed tick={tick} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" orientation="right" width={52} tick={{ fontSize: 10.5, fill: "#1F2A26" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} /><Bar dataKey="value" name="الموظفون" radius={[3, 3, 3, 3]} isAnimationActive={false}>{byPlacement.map((x) => <Cell key={x.name} fill={LEVEL_COLORS[x.name]} />)}<LabelList dataKey="value" position="insideLeft" style={{ fontSize: 10, fill: "#fff" }} /></Bar>
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="عدد المتحسنين حسب الإدارة" subtitle="Improvers by department">
          <div className="h-[260px]"><ResponsiveContainer><PieChart><Pie data={improversByDept} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} isAnimationActive={false}>{improversByDept.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} /><Legend wrapperStyle={{ fontSize: 9.5 }} /></PieChart></ResponsiveContainer></div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-2" title="أعداد ونسب الموظفين حسب المستوى الحالي" subtitle="Current CEFR level">
          <div className="h-[280px]"><ResponsiveContainer><PieChart><Pie data={byCurrent} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} paddingAngle={2} isAnimationActive={false} label={({ name, value, percent }) => `${name} ${value} (${Math.round((percent ?? 0) * 100)}%)`} labelLine={false}>{byCurrent.map((x) => <Cell key={x.name} fill={LEVEL_COLORS[x.name]} />)}</Pie><Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} /></PieChart></ResponsiveContainer></div>
        </Panel>
        <Panel className="col-span-3" title="رحلة الموظفين من مستوى البداية إلى المستوى الحالي" subtitle="100% stacked — المحور: مستوى اختبار تحديد المستوى · الألوان: المستوى الحالي">
          <div className="h-[280px]"><ResponsiveContainer><BarChart data={journey} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barSize={34} stackOffset="expand">
            <CartesianGrid vertical={false} stroke="#EEF0EC" /><XAxis dataKey="name" reversed tick={tick} axisLine={false} tickLine={false} /><YAxis orientation="right" tick={tick} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} formatter={(v, n) => [`${v}%`, n]} /><Legend wrapperStyle={{ fontSize: 10 }} />
            {CEFR.map((l) => <Bar key={l} dataKey={l} stackId="a" fill={LEVEL_COLORS[l]} isAnimationActive={false} />)}
          </BarChart></ResponsiveContainer></div>
        </Panel>
      </div>

      <Panel className="mt-4" title="سجل المشاركين" subtitle={`${data.length} مشاركاً — يُعرض كاملاً بغض النظر عن تصفية مقدار التحسن`}>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-white"><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["الاسم", "اختبار تحديد المستوى", "المستوى الحالي", "الإدارة", "منصة التعلم", "مقدار التحسن"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.id} className="border-b border-brand-border/70 last:border-0">
                <td className="py-1.5"><Link to={`/learning/employees/${r.resourceId}`} className="font-semibold hover:text-brand-green">{r.nameAr}</Link></td>
                <td className="py-1.5 text-center"><span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold text-white" style={{ background: LEVEL_COLORS[r.placementLevel ?? "لايوجد"], color: r.placementLevel ? "#fff" : "#1F2A26" }}>{r.placementLevel ?? "لايوجد"}</span></td>
                <td className="py-1.5 text-center"><span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold text-white" style={{ background: LEVEL_COLORS[r.currentLevel] }}>{r.currentLevel}</span></td>
                <td className="py-1.5 text-center text-brand-muted">{r.departmentAr}</td><td className="py-1.5 text-center">{r.platform ?? "—"}</td><td className="py-1.5 text-center num font-bold">{r.improvement}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
