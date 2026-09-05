import { useState, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PLATFORM_NAME_AR, PLATFORM_NAME_EN, OWNER_AR } from "@/components/AppShell";
import { ROLE_LABELS } from "@shared/rbac";
import type { Role } from "@shared/schema";

const DEMO: { username: string; role: Role }[] = [
  { username: "ceo", role: "ceo" }, { username: "epmo", role: "epmo" }, { username: "portfolio", role: "portfolio_manager" },
  { username: "project", role: "project_manager" }, { username: "data", role: "data_manager" }, { username: "admin", role: "system_admin" },
];

export default function LoginPage() {
  const { user, login, demoMode } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("ceo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/overview" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await login(username, password); navigate("/overview"); }
    catch (err: any) { setError(err.message ?? "تعذر تسجيل الدخول"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid grid-cols-[1.1fr_1fr]">
      <div className="bg-brand text-white flex flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full bg-white p-0.5 shadow-sm shrink-0"><img src="/emblem.png" alt="شعار وزارة الداخلية" className="h-12 w-12 rounded-full" /></span>
          <div>
            <div className="text-[15px] font-bold">وزارة الداخلية</div>
            <div className="text-[11px] text-white/60">{OWNER_AR}</div>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] tracking-[0.25em] text-brand-goldSoft font-semibold">STRATEGIC EXECUTION PLATFORM</div>
          <h1 className="mt-2 text-[32px] font-bold leading-tight">{PLATFORM_NAME_AR}</h1>
          <div className="text-[13px] text-white/70 mt-1">{PLATFORM_NAME_EN}</div>
          <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-white/80">
            مصدر حقيقة واحد يربط الاستراتيجية بالأهداف ومؤشرات الأداء والمحافظ والبرامج والمبادرات وصولاً إلى الأثر المحقق — داخل بيئة داخلية معزولة بالكامل.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/60"><ShieldCheck className="h-4 w-4 text-brand-goldSoft" /> بيئة داخلية معزولة — Air-Gapped / On-Premises</div>
      </div>

      <div className="flex items-center justify-center p-10 bg-brand-cream">
        <div className="w-full max-w-sm">
          <h2 className="text-[22px] font-bold">تسجيل الدخول</h2>
          <p className="text-[12px] text-brand-muted mt-1">أدخل بيانات حسابك للوصول إلى المنصة</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[12px] font-medium">اسم المستخدم</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="mt-1 w-full rounded-md border border-brand-border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-green/40" />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium">كلمة المرور</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-md border border-brand-border bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-green/40" />
            </label>
            {error && <div className="rounded-md bg-rag-redBg px-3 py-2 text-[12px] text-rag-red">{error}</div>}
            <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-[13px] font-bold text-white hover:bg-brand-hover disabled:opacity-60">
              <LogIn className="h-4 w-4" /> {busy ? "جارٍ الدخول…" : "الدخول إلى المنصة"}
            </button>
          </form>

          {demoMode && <div className="mt-6 card px-4 py-3">
            <div className="text-[11px] font-semibold text-brand-muted">حسابات النسخة التجريبية — كلمة المرور الموحدة: <span className="font-mono">Demo@2026</span></div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {DEMO.map((d) => (
                <button key={d.username} type="button" onClick={() => setUsername(d.username)} className="text-right rounded-md border border-brand-border px-2 py-1.5 text-[11px] hover:bg-brand-cream">
                  <div className="font-semibold">{ROLE_LABELS[d.role].ar}</div>
                  <div className="text-brand-muted font-mono text-[10px]">{d.username}</div>
                </button>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
