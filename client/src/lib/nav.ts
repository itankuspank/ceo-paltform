import {
  Gauge, Target, Gavel, GitBranch, LineChart, LayoutGrid, Briefcase, Layers, ListChecks, Map, Building2,
  Wallet, Users, AlertTriangle, Link2, Scale, BarChart3, GraduationCap, Database, Activity, Network, Landmark, type LucideIcon,
} from "lucide-react";

export type NavItem = { path: string; labelAr: string; labelEn: string; icon: LucideIcon; sprint?: number };
export type NavGroup = { labelAr: string; items: NavItem[] };

/** Sidebar structure — the prototype's seven groups plus the capability-development module. */
export const NAV: NavGroup[] = [
  { labelAr: "القيادة التنفيذية", items: [
    { path: "/overview", labelAr: "النظرة التنفيذية", labelEn: "Executive Overview", icon: Gauge },
    { path: "/impact", labelAr: "الأثر الاستراتيجي", labelEn: "Strategic Impact", icon: Target },
    { path: "/decisions", labelAr: "القرارات التنفيذية", labelEn: "Executive Decisions", icon: Gavel },
  ]},
  { labelAr: "الاستراتيجية", items: [
    { path: "/strategy", labelAr: "الغايات والأهداف", labelEn: "Goals & Objectives", icon: GitBranch },
    { path: "/kpis", labelAr: "مؤشرات الأداء", labelEn: "KPI Library", icon: LineChart },
  ]},
  { labelAr: "المحافظ والمبادرات", items: [
    { path: "/pmo", labelAr: "مركز التحكم بالمحافظ", labelEn: "PMO Control Center", icon: LayoutGrid },
    { path: "/portfolios", labelAr: "المحافظ", labelEn: "Portfolios", icon: Briefcase },
    { path: "/programs", labelAr: "البرامج", labelEn: "Programs", icon: Layers },
    { path: "/projects", labelAr: "المبادرات والمشاريع", labelEn: "Initiatives & Projects", icon: ListChecks },
  ]},
  { labelAr: "التوزيع الجغرافي", items: [
    { path: "/regions", labelAr: "مناطق المملكة", labelEn: "Regions", icon: Map },
    { path: "/sectors", labelAr: "قطاعات الوزارة", labelEn: "Sectors", icon: Building2 },
  ]},
  { labelAr: "الأداء", items: [
    { path: "/finance", labelAr: "الأداء المالي", labelEn: "Financial Performance", icon: Wallet },
    { path: "/resources", labelAr: "الموارد", labelEn: "Resources", icon: Users },
    { path: "/risks", labelAr: "المخاطر والمشكلات", labelEn: "Risks & Issues", icon: AlertTriangle },
    { path: "/dependencies", labelAr: "الاعتماديات", labelEn: "Dependencies", icon: Link2 },
  ]},
  { labelAr: "الحوكمة والتحليلات", items: [
    { path: "/governance", labelAr: "الحوكمة والتصعيدات", labelEn: "Governance", icon: Scale },
    { path: "/analytics", labelAr: "تحليل المحافظ والأولويات", labelEn: "Portfolio Analytics", icon: BarChart3 },
  ]},
  { labelAr: "الميزانية", items: [
    { path: "/budget", labelAr: "الميزانية التشغيلية والمبادرات", labelEn: "Budgets", icon: Landmark },
  ]},
  { labelAr: "تطوير وبناء القدرات", items: [
    { path: "/learning", labelAr: "لوحة التطوير التنفيذية", labelEn: "Capability Development", icon: GraduationCap },
  ]},
  { labelAr: "إدارة النظام", items: [
    { path: "/data", labelAr: "إدارة البيانات", labelEn: "Data Administration", icon: Database },
    { path: "/system", labelAr: "جودة البيانات والتكامل", labelEn: "Data Quality & Integration", icon: Activity },
    { path: "/architecture", labelAr: "معمارية المنظومة", labelEn: "Solution Architecture", icon: Network },
  ]},
];
export const ALL_ITEMS = NAV.flatMap((g) => g.items);
