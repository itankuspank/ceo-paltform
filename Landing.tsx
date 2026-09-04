import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { KpiCard, Panel, Chip, ProgressBar, Loading } from "@/components/ui";
import { PLATFORM_NAME_AR, PLATFORM_NAME_EN, OWNER_AR } from "@/components/AppShell";
import { fmtMoney, fmtPct } from "@shared/format";

type Landing = {
  totals: { investment: number; impact: number; portfolios: number; programs: number; projects: number; kpis: number };
  decisions: { id: number; code: string; titleAr: string; priority: string; amount: number | null; ownerAr: string; dueDate: string }[];
  topRisks: { id: number; titleAr: string; ownerAr: string; probability: number; impact: number; projectName: string; sectorName: string }[];
  integrations: { name: string; descAr: string }[];
};

const CHAIN = ["الاستثمار", "تنفيذ المبادرة", "المخرجات", "النتائج", "الأثر الاستراتيجي المحقق"];

export default function LandingPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["landing"], queryFn: () => api<Landing>("/api/landing") });
  const t = data?.totals;

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Hero band */}
      <div className="bg-brand text-white">
        <div className="max-w-[1400px] mx-auto px-8 pt-5 pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center rounded-full bg-white p-0.5 shadow-sm shrink-0"><img src="/emblem.png" alt="شعار وزارة الداخلية" className="h-11 w-11 rounded-full" /></span>
              <div>
                <div className="text-[14px] font-bold leading-tight">وزارة الداخلية — {OWNER_AR}</div>
                <div className="text-[10.5px] text-white/60">Ministry of Interior — MOI Development Program</div>
              </div>
            </div>
            <Link to={user ? "/overview" : "/login"} className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-4 py-2 text-[12.5px] font-bold text-brand-deep hover:bg-brand-goldSoft">
              {user ? "الانتقال إلى لوحة القيادة" : "الدخول إلى المنصة"} <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8">
            <div className="text-[10.5px] tracking-[0.25em] text-brand-goldSoft font-semibold">STRATEGIC EXECUTION PLATFORM</div>
            <h1 className="mt-2 text-[34px] font-bold leading-tight">{PLATFORM_NAME_AR}</h1>
            <div className="text-[13px] text-white/70 mt-1">{PLATFORM_NAME_EN}</div>
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-white/80">
              نجاح المحفظة لا يقاس بحجم الإنفاق أو عدد المشاريع المنجزة، وإنما بمقدار الأثر الاستراتيجي المحقق من الاستثمارات — من الاستراتيجية إلى الأهداف والمؤشرات، ومن المحافظ والبرامج إلى المبادرات والمخرجات والنتائج.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-6">
        {isLoading || !t ? <Loading /> : (
          <>
            <div className="grid grid-cols-6 gap-3">
              <KpiCard badge={1} label="إجمالي الاستثمارات الاستراتيجية" value={fmtMoney(t.investment)} />
              <KpiCard badge={2} label="محافظ استراتيجية" value={t.portfolios} sub="محفظة" />
              <KpiCard badge={3} label="برامج" value={t.programs} sub="برنامجاً" />
              <KpiCard badge={4} label="مبادرة ومشروع استراتيجي" value={t.projects} sub="مبادرة" />
              <KpiCard badge={5} label="مؤشر أداء استراتيجي" value={t.kpis} sub="مؤشراً" />
              <KpiCard badge={6} label="الأثر المحقق" value={fmtPct(t.impact)} tone="green" />
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-brand-muted">
              {CHAIN.map((c, i) => (
                <span key={c} className="flex items-center gap-2">
                  <span className={i === CHAIN.length - 1 ? "font-semibold text-brand-green" : ""}>{c}</span>
                  {i < CHAIN.length - 1 && <ChevronLeft className="h-3 w-3" />}
                </span>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <Panel accent="red" title={`${data!.decisions.length} قرارات تنفيذية تتطلب تدخل القيادة`} subtitle="Executive decisions pending CEO attention">
                <ul className="divide-y divide-brand-border">
                  {data!.decisions.slice(0, 4).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold truncate">{d.titleAr}</div>
                        <div className="text-[10.5px] text-brand-muted">{d.amount ? `اعتماد مالي · ${fmtMoney(d.amount)}` : "تصعيد استراتيجي"} · {d.ownerAr}</div>
                      </div>
                      <Chip tone={d.priority === "عاجلة" ? "off_track" : "at_risk"}>{d.priority === "عاجلة" ? "عاجل" : "مرتفع"}</Chip>
                    </li>
                  ))}
                </ul>
                <Link to={user ? "/decisions" : "/login"} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green">عرض جميع القرارات <ChevronLeft className="h-3 w-3" /></Link>
              </Panel>
              <Panel accent="amber" title="أهم 3 مخاطر استراتيجية" subtitle="Top strategic risks by score">
                <ul className="divide-y divide-brand-border">
                  {data!.topRisks.map((r) => {
                    const score = r.probability * r.impact;
                    return (
                      <li key={r.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[12.5px] font-semibold truncate">{r.titleAr}</div>
                          <Chip tone="off_track">{score}/25</Chip>
                        </div>
                        <div className="text-[10.5px] text-brand-muted mt-0.5 truncate">{r.projectName} · المالك: {r.sectorName}</div>
                        <ProgressBar value={(score / 25) * 100} tone="red" className="mt-1.5" />
                      </li>
                    );
                  })}
                </ul>
                <Link to={user ? "/risks" : "/login"} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green">خريطة المخاطر المؤسسية <ChevronLeft className="h-3 w-3" /></Link>
              </Panel>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {data!.integrations.map((i) => (
                <div key={i.name} className="card px-4 py-3">
                  <div className="text-[13px] font-bold">{i.name}</div>
                  <div className="text-[10.5px] text-brand-muted mt-0.5">{i.descAr}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-left">
              <Link to={user ? "/architecture" : "/login"} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green">استعراض معمارية المنظومة <ChevronLeft className="h-3 w-3" /></Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
