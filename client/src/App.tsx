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
