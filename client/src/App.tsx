import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ALL_ITEMS } from "@/lib/nav";
import AppShell from "@/components/AppShell";
import { Loading } from "@/components/ui";
import LandingPage from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import OverviewPage from "@/pages/Overview";
import PlaceholderPage from "@/pages/Placeholder";
import ImpactPage from "@/pages/Impact";
import DecisionsPage from "@/pages/Decisions";
import StrategyPage from "@/pages/Strategy";
import KpisRouter from "@/pages/Kpis";
import PmoPage from "@/pages/Pmo";
import PortfoliosRouter from "@/pages/Portfolios";
import ProgramsPage from "@/pages/Programs";
import ProjectsRouter from "@/pages/Projects";
import RegionsPage from "@/pages/Regions";
import SectorsPage from "@/pages/Sectors";
import { FinancePage, ResourcesPage } from "@/pages/FinanceResources";
import { RisksPage, DependenciesPage, GovernancePage } from "@/pages/RisksGovernance";
import AnalyticsPage from "@/pages/Analytics";
import DataAdminPage from "@/pages/DataAdmin";
import { SystemPage, ArchitecturePage } from "@/pages/SystemArchitecture";
import LearningRouter from "@/pages/Learning";
import BudgetRouter from "@/pages/Budget";
import OrgRouter from "@/pages/Org";
import TalentRouter from "@/pages/Talent";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

/** Screens already built — everything else falls back to the placeholder until its sprint lands. */
const BUILT: Record<string, React.ComponentType> = {
  "/overview": OverviewPage,
  "/impact": ImpactPage,
  "/decisions": DecisionsPage,
  "/strategy": StrategyPage,
  "/kpis": KpisRouter,
  "/pmo": PmoPage,
  "/portfolios": PortfoliosRouter,
  "/programs": ProgramsPage,
  "/projects": ProjectsRouter,
  "/regions": RegionsPage,
  "/sectors": SectorsPage,
  "/finance": FinancePage,
  "/resources": ResourcesPage,
  "/risks": RisksPage,
  "/dependencies": DependenciesPage,
  "/governance": GovernancePage,
  "/analytics": AnalyticsPage,
  "/data": DataAdminPage,
  "/system": SystemPage,
  "/architecture": ArchitecturePage,
  "/learning": LearningRouter,
  "/budget": BudgetRouter,
  "/org": OrgRouter,
  "/talent": TalentRouter,
};

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Protected><AppShell /></Protected>}>
              {ALL_ITEMS.map((it) => {
                const Page = BUILT[it.path] ?? PlaceholderPage;
                return <Route key={it.path} path={`${it.path}/*`} element={<Page />} />;
              })}
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
