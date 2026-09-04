import clsx from "clsx";
import type { ReactNode } from "react";
import { RAG_LABEL } from "@shared/format";

export type Tone = "default" | "green" | "amber" | "red" | "blue" | "gold";

const toneCard: Record<Tone, string> = {
  default: "bg-white border-brand-border",
  green: "bg-rag-greenBg border-[#CFE6D8]",
  amber: "bg-rag-amberBg border-[#EEDDB3]",
  red: "bg-rag-redBg border-[#F0C9C9]",
  blue: "bg-rag-blueBg border-[#C9DCE6]",
  gold: "bg-[#FBF6E7] border-[#EBDCA8]",
};
const toneText: Record<Tone, string> = { default: "text-brand-text", green: "text-rag-green", amber: "text-[#9A6B0F]", red: "text-rag-red", blue: "text-rag-blue", gold: "text-[#8A6A12]" };

/** KPI card — label on top, big number, small caption. Tint variants mirror the prototype. */
export function KpiCard({ label, value, sub, tone = "default", badge, className }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; badge?: ReactNode; className?: string;
}) {
  return (
    <div className={clsx("relative rounded-xl border px-4 py-3.5 shadow-card min-h-[86px]", toneCard[tone], className)}>
      {badge !== undefined && (
        <span className="absolute top-2 left-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white px-1.5 num">{badge}</span>
      )}
      <div className="text-[11px] text-brand-muted leading-snug">{label}</div>
      <div className={clsx("mt-1 text-[22px] font-bold leading-tight num", toneText[tone])}>{value}</div>
      {sub && <div className="mt-1 text-[10.5px] text-brand-muted leading-snug">{sub}</div>}
    </div>
  );
}

const chipTone: Record<string, string> = {
  on_track: "bg-rag-greenBg text-rag-green", at_risk: "bg-rag-amberBg text-[#9A6B0F]", off_track: "bg-rag-redBg text-rag-red",
  neutral: "bg-brand-cream text-brand-muted border border-brand-border", gold: "bg-[#FBF3E1] text-[#8A6A12]", blue: "bg-rag-blueBg text-rag-blue",
};
const dotTone: Record<string, string> = { on_track: "bg-rag-green", at_risk: "bg-rag-amber", off_track: "bg-rag-red", neutral: "bg-brand-muted", gold: "bg-brand-gold", blue: "bg-rag-blue" };

/** RAG status chip with a leading dot — used everywhere. */
export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span className={clsx("chip", chipTone[status] ?? chipTone.neutral, className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", dotTone[status] ?? dotTone.neutral)} />
      {label ?? RAG_LABEL[status] ?? status}
    </span>
  );
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof chipTone; className?: string }) {
  return <span className={clsx("chip", chipTone[tone], className)}>{children}</span>;
}

/** Thin progress bar. Color follows a RAG tone or an explicit color. */
export function ProgressBar({ value, tone, className, height = "h-1.5" }: { value: number; tone?: "green" | "amber" | "red" | "gold" | "brand"; className?: string; height?: string }) {
  const color = { green: "bg-rag-green", amber: "bg-rag-amber", red: "bg-rag-red", gold: "bg-brand-gold", brand: "bg-brand-green" }[tone ?? (value >= 70 ? "green" : value >= 50 ? "amber" : "red")];
  return (
    <div className={clsx("w-full rounded-full bg-[#ECEEEA] overflow-hidden", height, className)}>
      <div className={clsx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** White panel with bilingual header — the prototype's standard content block. */
export function Panel({ title, subtitle, actions, children, className, bodyClass, accent }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; accent?: "red" | "amber" | "gold";
}) {
  const accentCls = accent === "red" ? "border-r-4 border-r-rag-red" : accent === "amber" ? "border-r-4 border-r-rag-orange" : accent === "gold" ? "border-r-4 border-r-brand-gold" : "";
  return (
    <section className={clsx("card", accentCls, className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle && <div className="section-subtitle mt-0.5">{subtitle}</div>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className={clsx("px-4 pb-4", bodyClass)}>{children}</div>
    </section>
  );
}

/** Page header: Arabic title, English subtitle, description, optional right-side actions. */
export function PageHeader({ title, subtitle, description, actions, breadcrumb }: {
  title: string; subtitle?: string; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-4">
      {breadcrumb && <div className="text-[10.5px] text-brand-muted mb-1">{breadcrumb}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <div className="page-subtitle mt-0.5">{subtitle}</div>}
          {description && <div className="text-[12px] text-brand-muted mt-1.5">{description}</div>}
        </div>
        {actions && <div className="shrink-0 pt-1">{actions}</div>}
      </div>
    </div>
  );
}

export function SourcesFooter() {
  return (
    <div className="mt-6 text-[10px] text-brand-muted text-center">
      مصادر البيانات: Microsoft Project Server · Odoo ERP · SQL Server EPM Data Warehouse · Power BI Report Server — جميع العمليات داخل الشبكة الداخلية للوزارة
    </div>
  );
}

export function Loading({ label = "جارٍ تحميل البيانات…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-brand-muted text-[13px] gap-3">
      <span className="h-4 w-4 rounded-full border-2 border-brand-green border-t-transparent animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="card px-4 py-3 text-[13px] text-rag-red bg-rag-redBg border-[#F0C9C9]">{message}</div>;
}

export function Empty({ label }: { label: string }) {
  return <div className="text-[12px] text-brand-muted py-6 text-center">{label}</div>;
}
