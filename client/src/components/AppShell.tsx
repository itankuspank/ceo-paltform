import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, WifiOff } from "lucide-react";
import clsx from "clsx";
import { NAV } from "@/lib/nav";
import { useAuth } from "@/lib/auth";
import { ROLES } from "@shared/schema";
import { ROLE_LABELS } from "@shared/rbac";

export const PLATFORM_NAME_AR = "منصة متابعة الأعمال والمهام للرئيس التنفيذي";
export const PLATFORM_NAME_EN = "CEO Work & Task Tracking Platform";
export const OWNER_AR = "برنامج تطوير وزارة الداخلية";

function Sidebar() {
  const { user } = useAuth();
  const role = user ? ROLE_LABELS[user.role] : null;
  return (
    <aside className="w-[250px] shrink-0 bg-brand text-white flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <span className="inline-flex items-center justify-center rounded-full bg-white p-0.5 shadow-sm shrink-0"><img src="/emblem.png" alt="شعار وزارة الداخلية" className="h-10 w-10 rounded-full" /></span>
        <div>
          <div className="text-[14px] font-bold leading-tight">وزارة الداخلية</div>
          <div className="text-[10.5px] text-white/60 leading-tight mt-0.5">{OWNER_AR}</div>
        </div>
      </div>
      {role && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="text-[10px] text-white/50">الدور الحالي</div>
          <div className="text-[13px] font-semibold text-brand-goldSoft leading-tight">{role.ar}</div>
          <div className="text-[10px] text-white/60 leading-snug mt-0.5">{role.scopeAr}</div>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV.map((g) => (
          <div key={g.labelAr} className="mt-2">
            <div className="px-3 pt-2 pb-1 text-[10px] text-white/45">{g.labelAr}</div>
            {g.items.map((it) => (
              <NavLink key={it.path} to={it.path} className={({ isActive }) => clsx(
                "flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[12.5px] leading-tight transition-colors",
                isActive ? "bg-brand-soft text-white font-semibold shadow-inner" : "text-white/80 hover:bg-white/[0.07] hover:text-white",
              )}>
                <it.icon className="h-[15px] w-[15px] shrink-0 opacity-90" />
                <span className="truncate">{it.labelAr}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-[10px] text-white/50 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-goldSoft" /> بيئة داخلية معزولة · النسخة التجريبية 0.1
      </div>
    </aside>
  );
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  return online;
}

function TopBar() {
  const { user, switchRole, logout, demoMode } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  return (
    <header className="sticky top-0 z-20 h-14 bg-white border-b border-brand-border flex items-center justify-between px-5 gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight truncate">{PLATFORM_NAME_AR}</div>
          <div className="text-[10px] text-brand-muted leading-tight">{PLATFORM_NAME_EN}</div>
        </div>
        <span className="chip bg-rag-greenBg text-rag-green shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-rag-green" /> بيئة داخلية معزولة — Air-Gapped</span>
        {!online && <span className="chip bg-rag-amberBg text-[#9A6B0F] shrink-0"><WifiOff className="h-3 w-3" /> دون اتصال — تُعرض آخر نسخة محفوظة</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!demoMode && user && <span className="text-[11px] text-brand-muted">{user.fullName} · {ROLE_LABELS[user.role].ar}</span>}
        {demoMode && <div className="flex items-center gap-0.5 rounded-lg border border-brand-border bg-brand-cream p-0.5">
          {ROLES.map((r) => (
            <button key={r} onClick={() => switchRole(r)} className={clsx(
              "rounded-md px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors",
              user?.role === r ? "bg-brand text-white font-semibold" : "text-brand-muted hover:text-brand-text",
            )}>{ROLE_LABELS[r].ar}</button>
          ))}
        </div>}
        <button onClick={async () => { await logout(); navigate("/"); }} title="تسجيل الخروج" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-brand-muted hover:bg-brand-cream">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 py-5 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
