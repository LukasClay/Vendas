import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3, FileText, LayoutDashboard, LogOut, Package,
  PlusCircle, Settings, Users, Menu, X, ChevronRight, Sparkles, Calendar,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const sellerMenuItems = [
  { icon: PlusCircle, label: "Nova Venda", path: "/venda" },
  { icon: FileText, label: "Minhas Vendas", path: "/minhas-vendas" },
];

const consultoraMenuItems = [
  { icon: Sparkles, label: "Trabalhos", path: "/consultora" },
  { icon: PlusCircle, label: "Nova Venda", path: "/consultora/venda" },
  { icon: FileText, label: "Minhas Vendas", path: "/consultora/minhas-vendas" },
  { icon: Calendar, label: "Consultas", path: "/consultora/consultas" },
];

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: BarChart3, label: "Relatórios", path: "/admin/relatorios" },
  { icon: FileText, label: "Todas as Vendas", path: "/admin/vendas" },
  { icon: Package, label: "Trabalhos", path: "/admin/produtos" },
  { icon: Calendar, label: "Consultas", path: "/admin/consultas" },
  { icon: Users, label: "Funcionários", path: "/admin/vendedores" },
  { icon: Settings, label: "Configurações", path: "/admin/configuracoes" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: "linear-gradient(135deg, oklch(0.14 0.025 265) 0%, oklch(0.20 0.04 265) 100%)" }}>
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
            Acesso Necessário
          </h1>
          <p className="text-sm text-center" style={{ color: "oklch(0.75 0.01 65)" }}>
            Faça login para acessar o sistema
          </p>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="w-full py-4 rounded-xl text-base font-semibold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
            Entrar no Sistema
          </button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "admin";
  const isConsultora = user?.role === "consultora";
  const menuItems = isAdmin ? adminMenuItems : isConsultora ? consultoraMenuItems : sellerMenuItems;
  const activeMenuItem = menuItems.find(item =>
    item.path === location || (item.path !== "/" && location.startsWith(item.path))
  );

  const displayName = user?.name || user?.email || "Usuário";
  const firstName = displayName.split(" ")[0];
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  // Fecha menu ao navegar
  const navigate = (path: string) => {
    setLocation(path);
    setMenuOpen(false);
  };

  // Bloqueia scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // ─── MOBILE LAYOUT ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.97 0.006 65)" }}>

        {/* Header fixo mobile */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 shadow-sm"
          style={{ background: "oklch(0.14 0.025 265)", borderBottom: "1px solid oklch(0.22 0.03 265)" }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
              <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-sm" style={{ color: "oklch(0.92 0.01 65)", fontFamily: "'Playfair Display', serif" }}>
              {activeMenuItem?.label ?? "Mundo Da Magia"}
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ color: "oklch(0.75 0.06 65)" }}
            aria-label="Abrir menu">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Drawer menu mobile */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />

            {/* Drawer */}
            <div className="relative ml-auto w-72 h-full flex flex-col shadow-2xl"
              style={{ background: "oklch(0.14 0.025 265)" }}>

              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "oklch(0.22 0.03 265)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                    style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))", color: "white" }}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.01 65)" }}>{firstName}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: isAdmin ? "oklch(0.60 0.13 65 / 0.2)" : isConsultora ? "oklch(0.55 0.15 280 / 0.2)" : "oklch(0.55 0.15 160 / 0.2)",
                        color: isAdmin ? "oklch(0.75 0.10 65)" : isConsultora ? "oklch(0.65 0.12 280)" : "oklch(0.65 0.12 160)",
                      }}>
                      {isAdmin ? "Administrador" : isConsultora ? "Consultora" : "Vendedor"}
                    </span>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ color: "oklch(0.60 0.01 65)" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu items */}
              <nav className="flex-1 overflow-y-auto py-3 px-3">
                {menuItems.map(item => {
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1 transition-all text-left"
                      style={isActive ? {
                        background: "oklch(0.22 0.03 265)",
                        borderLeft: "3px solid oklch(0.60 0.13 65)",
                        color: "oklch(0.92 0.01 65)",
                      } : { color: "oklch(0.65 0.01 65)" }}>
                      <item.icon className="w-5 h-5 shrink-0" style={isActive ? { color: "oklch(0.60 0.13 65)" } : {}} />
                      <span className="font-medium text-sm">{item.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto" style={{ color: "oklch(0.60 0.13 65)" }} />}
                    </button>
                  );
                })}
              </nav>

              {/* Logout */}
              <div className="p-4 border-t" style={{ borderColor: "oklch(0.22 0.03 265)" }}>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                  style={{ color: "oklch(0.65 0.18 25)", background: "oklch(0.65 0.18 25 / 0.08)" }}>
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium text-sm">Sair do Sistema</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo principal mobile */}
        <main className="flex-1 pt-14 pb-4">
          <div className="px-4 py-5">{children}</div>
        </main>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ──────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: "oklch(0.97 0.006 65)" }}>

      {/* Sidebar desktop */}
      <aside className="w-64 shrink-0 flex flex-col sticky top-0 h-screen"
        style={{ background: "oklch(0.14 0.025 265)", borderRight: "1px solid oklch(0.22 0.03 265)" }}>

        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b" style={{ borderColor: "oklch(0.22 0.03 265)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
            <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-sm" style={{ color: "oklch(0.92 0.01 65)", fontFamily: "'Playfair Display', serif" }}>
            Mundo Da Magia
          </span>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full"
            style={{
              background: isAdmin ? "oklch(0.60 0.13 65 / 0.2)" : isConsultora ? "oklch(0.55 0.15 280 / 0.2)" : "oklch(0.55 0.15 160 / 0.2)",
              color: isAdmin ? "oklch(0.75 0.10 65)" : isConsultora ? "oklch(0.65 0.12 280)" : "oklch(0.65 0.12 160)",
            }}>
            {isAdmin ? "Administrador" : isConsultora ? "Consultora" : "Vendedor"}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {menuItems.map(item => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                style={isActive ? {
                  background: "oklch(0.22 0.03 265)",
                  borderLeft: "3px solid oklch(0.60 0.13 65)",
                  color: "oklch(0.92 0.01 65)",
                } : { color: "oklch(0.65 0.01 65)" }}>
                <item.icon className="w-4 h-4 shrink-0" style={isActive ? { color: "oklch(0.60 0.13 65)" } : {}} />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t" style={{ borderColor: "oklch(0.22 0.03 265)" }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1"
            style={{ color: "oklch(0.80 0.01 65)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
              style={{ background: "oklch(0.22 0.03 265)", color: "oklch(0.75 0.10 65)", border: "2px solid oklch(0.60 0.13 65 / 0.5)" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "oklch(0.92 0.01 65)" }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: "oklch(0.55 0.01 65)" }}>{(user as any)?.username || user?.email || ""}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm"
            style={{ color: "oklch(0.65 0.18 25)" }}>
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content desktop */}
      <main className="flex-1 min-w-0 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
