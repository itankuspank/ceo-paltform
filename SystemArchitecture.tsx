import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard, Panel, StatusChip, ProgressBar, PageHeader, SourcesFooter, Loading, ErrorBox, Chip } from "@/components/ui";
import { ROLE_LABELS } from "@shared/rbac";
import { MONTHS_AR } from "@shared/format";

// ================================================================ Data Quality & Integration
type Sys = {
  summary: { sources: number; avgQuality: number; syncsToday: number; alerts: number; operations: number };
  sources: { id: number; nameAr: string; system: string; recordCount: number; quality: number; lastSyncAt: string; status: string }[];
  jobs: { id: number; nameAr: string; scheduleAr: string; lastRunAt: string; status: string }[];
  roles: { role: string; users: number }[];
  environment: [string, string][];
};
const fmtSync = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function SystemPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["system"], queryFn: () => api<Sys>("/api/system") });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={(error as Error)?.message ?? "تعذر تحميل حالة النظام"} />;
  const sm = data.summary;
  return (
    <div>
      <PageHeader title="جودة البيانات وحالة التكامل" subtitle="Data Quality, Integration & Access" description="طبقة تكامل داخلية معزولة بالكامل — بدون اتصال بالإنترنت أو خدمات سحابية خارجية." />
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="مصادر البيانات" value={sm.sources} /><KpiCard label="متوسط جودة البيانات" value={`${sm.avgQuality}%`} tone="green" /><KpiCard label="عمليات مزامنة اليوم" value={sm.syncsToday} sub="مجدولة" /><KpiCard label="تنبيهات جودة" value={sm.alerts} tone={sm.alerts ? "amber" : "green"} />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="مصادر البيانات وجودتها" subtitle="Master Data & Data Quality">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border">{["المصدر", "السجلات", "الجودة", "آخر مزامنة", "الحالة"].map((h, i) => <th key={h} className={`py-1.5 font-medium ${i === 0 ? "text-right" : "text-center"}`}>{h}</th>)}</tr></thead>
            <tbody>{data.sources.map((x) => (
              <tr key={x.id} className="border-b border-brand-border/70 last:border-0">
                <td className="py-2 font-semibold">{x.nameAr}</td><td className="py-2 text-center num">{x.recordCount.toLocaleString("en-US")}</td>
                <td className="py-2"><div className="flex items-center gap-2"><ProgressBar value={x.quality} tone={x.quality >= 95 ? "green" : "amber"} className="flex-1 min-w-[70px]" /><span className="num text-[10.5px] w-12">{x.quality}%</span></div></td>
                <td className="py-2 text-center num text-[10.5px]">{fmtSync(x.lastSyncAt)}</td><td className="py-2 text-center"><StatusChip status={x.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
        <Panel className="col-span-2" title="خطوط المعالجة والمزامنة المجدولة" subtitle="ETL & Scheduled Synchronization">
          <ul className="space-y-1.5">{data.jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2 rounded-md border border-brand-border px-2.5 py-1.5"><div><div className="text-[11.5px] font-semibold">{j.nameAr}</div><div className="text-[10px] text-brand-muted">{j.scheduleAr}</div></div><Chip tone={j.status === "ناجحة" ? "on_track" : j.status === "جارٍ" ? "gold" : "off_track"}>{j.status}</Chip></li>
          ))}</ul>
          <div className="mt-3 rounded-md bg-brand-cream border border-brand-border px-3 py-2 text-[10px] text-brand-muted">Internal APIs · ETL · Data Validation · Master Data Mapping · Business Rules · Audit Logs</div>
        </Panel>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <Panel className="col-span-3" title="المستخدمون والصلاحيات" subtitle="Role-Based Access Control">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-brand-muted text-[10.5px] border-b border-brand-border"><th className="py-1.5 text-right font-medium">الدور</th><th className="py-1.5 text-center font-medium">عدد المستخدمين</th><th className="py-1.5 text-right font-medium">نطاق الصلاحية</th></tr></thead>
            <tbody>{data.roles.map((r) => <tr key={r.role} className="border-b border-brand-border/70 last:border-0"><td className="py-2 font-semibold">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS]?.ar}</td><td className="py-2 text-center num">{r.users}</td><td className="py-2 text-brand-muted">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS]?.scopeAr}</td></tr>)}</tbody>
          </table>
        </Panel>
        <Panel className="col-span-2" title="حالة البيئة" subtitle="On-Premises / Air-Gapped">
          <dl className="text-[11.5px] space-y-1.5">{data.environment.map(([k, v]) => <div key={k} className="flex justify-between border-b border-brand-border pb-1"><dt className="text-brand-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
            <div className="flex justify-between pb-1"><dt className="text-brand-muted">عمليات مسجلة في سجل التدقيق</dt><dd className="font-semibold num">{sm.operations}</dd></div></dl>
        </Panel>
      </div>
      <SourcesFooter />
    </div>
  );
}

// ================================================================ Solution Architecture (static)
const CHAIN = ["الغايات الاستراتيجية", "الأهداف الاستراتيجية", "مؤشرات الأداء KPIs", "المستهدفات", "المحافظ", "البرامج", "المشاريع والمبادرات", "المخرجات والمعالم", "النتائج", "الأثر المحقق"];
const FLOW = [["1", "Microsoft Project Server + Odoo ERP", "بيانات الاستراتيجية"], ["2", "طبقة التكامل الداخلية", ""], ["3", "SQL Server EPM Data Warehouse", ""], ["4", "Power BI Report Server", ""], ["5", "لوحات معلومات حسب الدور", ""]];
const LAYERS: { title: string; sub: string; items: string[]; tone?: "gold" | "green" | "blue" }[] = [
  { title: "الطبقة الأولى: الاستراتيجية والأداء", sub: "Strategy & Performance Layer", tone: "gold", items: ["إدارة الغايات والأهداف", "مؤشرات الأداء والمستهدفات", "ربط المبادرات بالمؤشرات (Many-to-Many)", "إطار قياس الأثر"] },
  { title: "Microsoft Project Server", sub: "Project Delivery System of Record", items: ["المحافظ والبرامج والمشاريع", "الجداول الزمنية والمهام والمعالم", "المخرجات ونسب الإنجاز", "إسناد الموارد والاحتياجات", "الاعتماديات والمخاطر والتصعيدات"] },
  { title: "Odoo ERP", sub: "ERP System of Record", items: ["الميزانية والمصروفات والالتزامات", "أوامر الشراء والعقود والفواتير", "مراكز التكلفة و EAC", "الموظفون والمهارات والإجازات والتدريب", "Timesheets وتكلفة ساعة الموارد"] },
  { title: "طبقة التكامل الآمنة", sub: "Secure Air-Gapped Integration Layer", tone: "green", items: ["Internal APIs", "Data Pipelines و ETL", "Data Quality و Data Validation", "Business Rules و Master Data Mapping", "Scheduled Synchronization و Audit Logs"] },
  { title: "مستودع بيانات EPM المركزي", sub: "Microsoft SQL Server — EPM Data Warehouse (Single Source of Truth)", tone: "blue", items: ["بيانات الاستراتيجية والمؤشرات", "بيانات المحافظ والبرامج والمشاريع", "البيانات المالية وبيانات الموارد", "المخاطر والمشكلات والاعتماديات والقرارات", "المخرجات والنتائج وبيانات الأثر المحقق"] },
  { title: "طبقة التحليلات", sub: "Power BI Report Server — On-Premises", items: ["لوحات معلومات حسب الدور", "تقارير الأداء والمالية والموارد", "تحليل الأثر والاستثمار", "لا ترتبط بأي خدمة سحابية"] },
];
const LEVELS = [["المستوى 1", "الرئيس التنفيذي", "الاستراتيجية · الأثر · الاستثمارات · القرارات"], ["المستوى 2", "المكتب التنفيذي للمشاريع", "المحافظ · الأداء · المخاطر · الحوكمة"], ["المستوى 3", "مدير المحفظة", "البرامج · الميزانيات · الموارد · الأثر"], ["المستوى 4", "مدير المشروع", "الجدول · المهام · المخرجات · المخاطر"]];

export function ArchitecturePage() {
  return (
    <div>
      <PageHeader title="معمارية المنظومة" subtitle="System Architecture — On-Premises / Air-Gapped" description="لا يوجد اتصال مباشر بالإنترنت ولا خدمات سحابية أو واجهات برمجية خارجية؛ جميع البيانات والتطبيقات داخل الشبكة الداخلية للوزارة." />
      <Panel title="سلسلة القيمة الاستراتيجية" subtitle="Strategy → KPIs → Investments → Portfolios → Programs → Initiatives → Outputs → Outcomes → Impact">
        <div className="flex flex-wrap items-center gap-1.5">{CHAIN.map((c, i) => <span key={c} className="flex items-center gap-1.5"><span className={i === CHAIN.length - 1 ? "chip bg-[#FBF6E7] border border-brand-gold text-[#8A6A12] font-semibold" : "chip bg-brand-cream border border-brand-border"}>{c}</span>{i < CHAIN.length - 1 && <ChevronLeft className="h-3 w-3 text-brand-muted" />}</span>)}</div>
      </Panel>
      <Panel className="mt-4" title="تدفق البيانات" subtitle="Data Flow">
        <div className="grid grid-cols-5 gap-2">{FLOW.map(([n, t, sub]) => <div key={n} className="rounded-lg border border-brand-border bg-brand-cream px-3 py-3 text-center"><div className="text-[10px] text-brand-muted">المرحلة {n}</div><div className="text-[12px] font-bold leading-snug mt-0.5">{t}</div>{sub && <div className="text-[10px] text-brand-muted">{sub}</div>}</div>)}</div>
      </Panel>
      <div className="mt-4 grid grid-cols-2 gap-4">{LAYERS.map((l) => (
        <section key={l.title} className={`rounded-xl border px-4 py-3.5 shadow-card ${l.tone === "gold" ? "bg-[#FBF6E7] border-[#EBDCA8]" : l.tone === "green" ? "bg-rag-greenBg border-[#CFE6D8]" : l.tone === "blue" ? "bg-rag-blueBg border-[#C9DCE6]" : "bg-white border-brand-border"}`}>
          <div className="text-[13.5px] font-bold">{l.title}</div><div className="text-[10px] text-brand-muted">{l.sub}</div>
          <ul className="mt-2 space-y-1 text-[11.5px]">{l.items.map((it) => <li key={it} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />{it}</li>)}</ul>
        </section>
      ))}</div>
      <Panel className="mt-4" title="مستويات الإدارة" subtitle="Management Levels">
        <div className="grid grid-cols-4 gap-3">{LEVELS.map(([n, t, s]) => <div key={n} className="rounded-lg border border-brand-border px-3 py-3 text-center"><div className="text-[10px] text-brand-muted">{n}</div><div className="text-[13px] font-bold mt-0.5">{t}</div><div className="text-[10px] text-brand-muted mt-1">{s}</div></div>)}</div>
      </Panel>
      <div className="mt-4 text-[10.5px] text-brand-muted text-center">آخر تحديث للمعمارية: {MONTHS_AR[7]} 2026 · الإصدار التجريبي 0.1</div>
    </div>
  );
}
