import {
  Gauge, Target, Gavel, GitBranch, LineChart, LayoutGrid, Briefcase, Layers, ListChecks, Map, Building2,
  Wallet, Users, AlertTriangle, Link2, Scale, BarChart3, GraduationCap, Database, Activity, Network, type LucideIcon,
} from "lucide-react";

export type NavItem = { path: string; labelAr: string; labelEn: string; icon: LucideIcon; sprint?: number };
export type NavGroup = { labelAr: string; items: NavItem[] };

/** Sidebar structure — the prototype's seven groups plus the capability-development module. */
export const NAV: NavGroup[] = [
  { labelAr: "القيادة التنفيذية", items: [
    { path: "/overview", labelAr: "النظرة التنفيذية", labelEn: "Executive Overview", icon: Gauge },
    { path: "/impact", labelAr: "الأثر الاستراتيجي", labelEn: "Strategic Impact", icon: Target, sprint: 2 },
    { path: "/decisions", labelAr: "القرارات التنفيذية", labelEn: "Executive Decisions", icon: Gavel, sprint: 2 },
  ]},
  { labelAr: "الاستراتيجية", items: [
    { path: "/strategy", labelAr: "الغايات والأهداف", labelEn: "Goals & Objectives", icon: GitBranch, sprint: 2 },
    { path: "/kpis", labelAr: "مؤشرات الأداء", labelEn: "KPI Library", icon: LineChart, sprint: 2 },
  ]},
  { labelAr: "المحافظ والمبادرات", items: [
    { path: "/pmo", labelAr: "مركز التحكم بالمحافظ", labelEn: "PMO Control Center", icon: LayoutGrid, sprint: 3 },
    { path: "/portfolios", labelAr: "المحافظ", labelEn: "Portfolios", icon: Briefcase, sprint: 3 },
    { path: "/programs", labelAr: "البرامج", labelEn: "Programs", icon: Layers, sprint: 3 },
    { path: "/projects", labelAr: "المبادرات والمشاريع", labelEn: "Initiatives & Projects", icon: ListChecks, sprint: 3 },
  ]},
  { labelAr: "التوزيع الجغرافي", items: [
    { path: "/regions", labelAr: "مناطق المملكة", labelEn: "Regions", icon: Map, sprint: 4 },
    { path: "/sectors", labelAr: "قطاعات الوزارة", labelEn: "Sectors", icon: Building2, sprint: 4 },
  ]},
  { labelAr: "الأداء", items: [
    { path: "/finance", labelAr: "الأداء المالي", labelEn: "Financial Performance", icon: Wallet, sprint: 5 },
    { path: "/resources", labelAr: "الموارد", labelEn: "Resources", icon: Users, sprint: 5 },
    { path: "/risks", labelAr: "المخاطر والمشكلات", labelEn: "Risks & Issues", icon: AlertTriangle, sprint: 5 },
    { path: "/dependencies", labelAr: "الاعتماديات", labelEn: "Dependencies", icon: Link2, sprint: 5 },
  ]},
  { labelAr: "الحوكمة والتحليلات", items: [
    { path: "/governance", labelAr: "الحوكمة والتصعيدات", labelEn: "Governance", icon: Scale, sprint: 5 },
    { path: "/analytics", labelAr: "تحليل المحافظ والأولويات", labelEn: "Portfolio Analytics", icon: BarChart3, sprint: 5 },
  ]},
  { labelAr: "تطوير وبناء القدرات", items: [
    { path: "/learning", labelAr: "لوحة التطوير التنفيذية", labelEn: "Capability Development", icon: GraduationCap, sprint: 7 },
  ]},
  { labelAr: "إدارة النظام", items: [
    { path: "/data", labelAr: "إدارة البيانات", labelEn: "Data Administration", icon: Database, sprint: 6 },
    { path: "/system", labelAr: "جودة البيانات والتكامل", labelEn: "Data Quality & Integration", icon: Activity, sprint: 6 },
    { path: "/architecture", labelAr: "معمارية المنظومة", labelEn: "Solution Architecture", icon: Network, sprint: 6 },
  ]},
];
export const ALL_ITEMS = NAV.flatMap((g) => g.items);
