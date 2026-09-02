/**
 * Role-based access control — enforced server-side (deny by default).
 * The client only uses this to hide what the user cannot do; the server is the authority.
 */
import type { Role } from "./schema";

export const ROLE_LABELS: Record<Role, { ar: string; en: string; scopeAr: string }> = {
  ceo:               { ar: "الرئيس التنفيذي",              en: "CEO",                scopeAr: "الاستراتيجية · الأثر · الاستثمارات · القرارات" },
  epmo:              { ar: "المكتب التنفيذي للمشاريع",     en: "EPMO",               scopeAr: "المحافظ · الأداء · الحوكمة" },
  portfolio_manager: { ar: "مدير المحفظة",                 en: "Portfolio Manager",  scopeAr: "البرامج · الميزانيات · الأثر داخل المحفظة" },
  project_manager:   { ar: "مدير المشروع",                 en: "Project Manager",    scopeAr: "الجدول · المخرجات · المخاطر" },
  data_manager:      { ar: "مدير البيانات",                en: "Data Manager",       scopeAr: "إدارة البيانات ضمن حدود الاعتماد" },
  system_admin:      { ar: "مدير النظام",                  en: "System Admin",       scopeAr: "صلاحية كاملة" },
};

export type Permission =
  | "view:executive" | "view:strategy" | "view:portfolio" | "view:geo" | "view:performance"
  | "view:governance" | "view:data" | "view:system" | "view:learning"
  | "data:edit" | "data:approve" | "data:override" | "data:import" | "decisions:decide" | "users:manage";

const ALL_VIEWS: Permission[] = [
  "view:executive", "view:strategy", "view:portfolio", "view:geo", "view:performance",
  "view:governance", "view:data", "view:system", "view:learning",
];

export const PERMISSIONS: Record<Role, Permission[]> = {
  ceo:               [...ALL_VIEWS, "decisions:decide"],
  epmo:              [...ALL_VIEWS, "data:edit", "data:approve"],
  portfolio_manager: [...ALL_VIEWS, "data:edit"],
  project_manager:   [...ALL_VIEWS, "data:edit"],
  data_manager:      [...ALL_VIEWS, "data:edit", "data:import"],
  system_admin:      [...ALL_VIEWS, "data:edit", "data:approve", "data:override", "data:import", "decisions:decide", "users:manage"],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}
