import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

// Pages
import Login from "./pages/Login";
import NovaVenda from "./pages/NovaVenda";
import MinhasVendas from "./pages/MinhasVendas";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminRelatorios from "./pages/admin/Relatorios";
import AdminVendas from "./pages/admin/Vendas";
import AdminProdutos from "./pages/admin/Produtos";
import AdminVendedores from "./pages/admin/Vendedores";
import AdminConfiguracoes from "./pages/admin/Configuracoes";
import AdminConsultas from "./pages/admin/Consultas";
import ConsultoraPage from "./pages/Consultora";
import ConsultasPage from "./pages/Consultas";

// Route guard: redirects unauthenticated users to login
function AuthGuard({ children, adminOnly = false, consultoraOnly = false }: { children: React.ReactNode; adminOnly?: boolean; consultoraOnly?: boolean }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login"); return; }
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
  if (consultoraOnly && user.role !== "consultora" && user.role !== "admin") return null;

  return <>{children}</>;
}

// Home redirect based on role
function HomeRedirect() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login"); return; }
    if (user.role === "admin") { navigate("/admin"); }
    else if (user.role === "consultora") { navigate("/consultora"); }
    else { navigate("/venda"); }
  }, [user, loading, navigate]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/login" component={Login} />

      {/* Seller routes */}
      <Route path="/venda">
        <AuthGuard><NovaVenda /></AuthGuard>
      </Route>
      <Route path="/minhas-vendas">
        <AuthGuard><MinhasVendas /></AuthGuard>
      </Route>

      {/* Consultora routes */}
      <Route path="/consultora">
        <AuthGuard consultoraOnly><ConsultoraPage /></AuthGuard>
      </Route>
      {/* Consultora also has access to sales form and history */}
      <Route path="/consultora/venda">
        <AuthGuard consultoraOnly><NovaVenda /></AuthGuard>
      </Route>
      <Route path="/consultora/minhas-vendas">
        <AuthGuard consultoraOnly><MinhasVendas /></AuthGuard>
      </Route>
      <Route path="/consultora/consultas">
        <AuthGuard consultoraOnly><ConsultasPage /></AuthGuard>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <AuthGuard adminOnly><AdminDashboard /></AuthGuard>
      </Route>
      <Route path="/admin/relatorios">
        <AuthGuard adminOnly><AdminRelatorios /></AuthGuard>
      </Route>
      <Route path="/admin/vendas">
        <AuthGuard adminOnly><AdminVendas /></AuthGuard>
      </Route>
      <Route path="/admin/produtos">
        <AuthGuard adminOnly><AdminProdutos /></AuthGuard>
      </Route>
      <Route path="/admin/vendedores">
        <AuthGuard adminOnly><AdminVendedores /></AuthGuard>
      </Route>
      <Route path="/admin/configuracoes">
        <AuthGuard adminOnly><AdminConfiguracoes /></AuthGuard>
      </Route>
      <Route path="/admin/consultas">
        <AuthGuard adminOnly><AdminConsultas /></AuthGuard>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
