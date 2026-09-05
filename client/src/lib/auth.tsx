import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, post } from "./api";
import type { SafeUser, Role } from "@shared/schema";
import { can, type Permission } from "@shared/rbac";

type AuthCtx = {
  user: SafeUser | null; loading: boolean; demoMode: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  can: (p: Permission) => boolean;
};
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" }).then(async (r) => { const j = await r.json().catch(() => ({})); setDemoMode(j.demoMode ?? true); setUser(r.ok ? j.user : null); }).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  const value: AuthCtx = {
    user, loading, demoMode,
    login: async (username, password) => { const r = await post<{ user: SafeUser }>("/api/auth/login", { username, password }); setUser(r.user); },
    logout: async () => { await post("/api/auth/logout", {}); setUser(null); },
    switchRole: async (role) => { const r = await post<{ user: SafeUser }>("/api/auth/switch-role", { role }); setUser(r.user); },
    can: (p) => can(user?.role, p),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth() { const c = useContext(Ctx); if (!c) throw new Error("useAuth outside AuthProvider"); return c; }
