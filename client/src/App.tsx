import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect, lazy, Suspense } from "react";

// Lazy-loaded pages — each page is a separate JS chunk loaded on demand
const Login = lazy(() => import("./pages/Login"));
const NovaVenda = lazy(() => import("./pages/NovaVenda"));
const MinhasVendas = lazy(() => import("./pages/MinhasVendas"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminRelatorios = lazy(() => import("./pages/admin/Relatorios"));
const AdminVendas = lazy(() => import("./pages/admin/Vendas"));
const AdminProdutos = lazy(() => import("./pages/admin/Produtos"));
const AdminVendedores = lazy(() => import("./pages/admin/Vendedores"));
const AdminConfiguracoes = lazy(() => import("./pages/admin/Configuracoes"));
const AdminConsultas = lazy(() => import("./pages/admin/Consultas"));
const AdminTrabalhos = lazy(() => import("./pages/admin/Trabalhos"));
const AdminAlertas = lazy(() => import("./pages/admin/Alertas"));
const AdminLixeira = lazy(() => import("./pages/admin/Lixeira"));
const AdminSeguranca = lazy(() => import("./pages/admin/Seguranca"));
const ConsultoraPage = lazy(() => import("./pages/Consultora"));
const ConsultasPage = lazy(() => import("./pages/Consultas"));

// Minimal loading fallback — just a blank screen, avoids flash
function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "oklch(0.97 0.005 65)" }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{
          borderColor: "oklch(0.60 0.13 65)",
          borderTopColor: "transparent",
        }}
      />
    </div>
  );
}

// Route guard: redirects unauthenticated users to login
function AuthGuard({
  children,
  adminOnly = false,
  consultoraOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  consultoraOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (adminOnly && user.role !== "admin") {
      if (user.role === "consultora") navigate("/consultora");
      else navigate("/venda");
      return;
    }
    if (consultoraOnly && user.role !== "consultora" && user.role !== "admin") {
      navigate("/venda");
    }
  }, [user, loading, adminOnly, consultoraOnly, navigate]);

  if (loading) return null;
  if (!user) return null;
  if (adminOnly && user.role !== "admin") return null;
  if (consultoraOnly && user.role !== "consultora" && user.role !== "admin")
    return null;

  return <>{children}</>;
}

// Home redirect based on role
function HomeRedirect() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role === "admin") {
      navigate("/admin");
    } else if (user.role === "consultora") {
      navigate("/consultora");
    } else {
      navigate("/venda");
    }
  }, [user, loading, navigate]);

  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/login" component={Login} />

        {/* Seller routes */}
        <Route path="/venda">
          <AuthGuard>
            <NovaVenda />
          </AuthGuard>
        </Route>
        <Route path="/minhas-vendas">
          <AuthGuard>
            <MinhasVendas />
          </AuthGuard>
        </Route>

        {/* Consultora routes */}
        <Route path="/consultora">
          <AuthGuard consultoraOnly>
            <ConsultoraPage />
          </AuthGuard>
        </Route>
        <Route path="/consultora/venda">
          <AuthGuard consultoraOnly>
            <NovaVenda />
          </AuthGuard>
        </Route>
        <Route path="/consultora/minhas-vendas">
          <AuthGuard consultoraOnly>
            <MinhasVendas />
          </AuthGuard>
        </Route>
        <Route path="/consultora/consultas">
          <AuthGuard consultoraOnly>
            <ConsultasPage />
          </AuthGuard>
        </Route>

        {/* Admin routes */}
        <Route path="/admin">
          <AuthGuard adminOnly>
            <AdminDashboard />
          </AuthGuard>
        </Route>
        <Route path="/admin/relatorios">
          <AuthGuard adminOnly>
            <AdminRelatorios />
          </AuthGuard>
        </Route>
        <Route path="/admin/vendas">
          <AuthGuard adminOnly>
            <AdminVendas />
          </AuthGuard>
        </Route>
        <Route path="/admin/produtos">
          <AuthGuard adminOnly>
            <AdminProdutos />
          </AuthGuard>
        </Route>
        <Route path="/admin/vendedores">
          <AuthGuard adminOnly>
            <AdminVendedores />
          </AuthGuard>
        </Route>
        <Route path="/admin/configuracoes">
          <AuthGuard adminOnly>
            <AdminConfiguracoes />
          </AuthGuard>
        </Route>
        <Route path="/admin/consultas">
          <AuthGuard adminOnly>
            <AdminConsultas />
          </AuthGuard>
        </Route>
        <Route path="/admin/trabalhos">
          <AuthGuard adminOnly>
            <AdminTrabalhos />
          </AuthGuard>
        </Route>
        <Route path="/admin/nova-venda">
          <AuthGuard adminOnly>
            <NovaVenda />
          </AuthGuard>
        </Route>
        <Route path="/admin/alertas">
          <AuthGuard adminOnly>
            <AdminAlertas />
          </AuthGuard>
        </Route>
        <Route path="/admin/lixeira">
          <AuthGuard adminOnly>
            <AdminLixeira />
          </AuthGuard>
        </Route>
        <Route path="/admin/seguranca">
          <AuthGuard adminOnly>
            <AdminSeguranca />
          </AuthGuard>
        </Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
