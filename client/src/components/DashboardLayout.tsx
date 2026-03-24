import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BarChart3, Bell, ClipboardList, FileText, LayoutDashboard, LogOut, Package,
  PlusCircle, User, Users, Menu, X, ChevronRight, Sparkles, Calendar,
  Sun, Moon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { PushNotificationButton } from "./PushNotificationButton";
import { ShimmerText, PulseStar } from "./Animations";

// Cores mapeadas para variáveis CSS
const C = {
  sidebar:        "var(--sidebar)",
  sidebarFg:      "var(--sidebar-foreground)",
  sidebarAccent:  "var(--sidebar-accent)",
  sidebarBorder:  "var(--sidebar-border)",
  primary:        "var(--primary)",
  primaryFg:      "var(--primary-foreground)",
  bg:             "var(--background)",
  mutedFg:        "var(--muted-foreground)",
  textHint:       "#8888a0",
  textFaint:      "#6b6b80",
  roleBadgeAdminBg:   "rgba(193,127,36,0.2)",
  roleBadgeAdminFg:   "#b8860b",
  roleBadgeConsultBg: "rgba(107,79,173,0.2)",
  roleBadgeConsultFg: "#7b5ea7",
  roleBadgeSellerBg:  "rgba(39,174,96,0.2)",
  roleBadgeSellerFg:  "#1e8449",
  logoutFg:       "#c0392b",
  logoutBg:       "rgba(192,57,43,0.08)",
  gradientGold:   "linear-gradient(135deg, #c17f24, #d4932a)",
  gradientDark:   "linear-gradient(135deg, #181824 0%, #1e1e30 100%)",
};

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
  { icon: PlusCircle, label: "Nova Venda", path: "/admin/nova-venda" },
  { icon: Package, label: "Trabalhos", path: "/admin/produtos" },
  { icon: ClipboardList, label: "Painel Trabalhos", path: "/admin/trabalhos" },
  { icon: Calendar, label: "Consultas", path: "/admin/consultas" },
  { icon: Bell, label: "Alertas", path: "/admin/alertas" },
  { icon: Users, label: "Funcionários", path: "/admin/vendedores" },
  { icon: User, label: "Minha Conta", path: "/admin/configuracoes" },
];

// Lógica corrigida para determinar item ativo
function getActiveItem(menuItems: typeof adminMenuItems, location: string) {
  // Primeiro: match exato
  const exact = menuItems.find(item => item.path === location);
  if (exact) return exact;

  // Segundo: match por prefixo (mais longo primeiro para evitar falsos positivos)
  const sorted = [...menuItems]
    .filter(item => item.path !== "/admin" && item.path !== "/") // Evitar que /admin match tudo
    .sort((a, b) => b.path.length - a.path.length);
  const prefix = sorted.find(item => location.startsWith(item.path));
  if (prefix) return prefix;

  // Fallback: se estamos em /admin/algo e nenhum match, não marcar nada
  return null;
}

// Theme toggle button component
function ThemeToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const btnSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  return (
    <motion.button
      onClick={toggleTheme}
      className={`${btnSize} flex items-center justify-center rounded-xl transition-colors`}
      style={{ color: C.mutedFg }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9, rotate: 180 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
    >
      <AnimatePresence mode="wait">
        {resolvedTheme === "dark" ? (
          <motion.div
            key="sun"
            initial={{ opacity: 0, rotate: -90, scale: 0 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className={iconSize} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ opacity: 0, rotate: 90, scale: 0 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className={iconSize} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: C.gradientDark }}>
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: C.gradientGold }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white text-center" style={{ fontFamily: "'Playfair Display', serif" }}>
            Acesso Necessário
          </h1>
          <p className="text-sm text-center" style={{ color: C.textHint }}>
            Faça login para acessar o sistema
          </p>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="w-full py-4 rounded-xl text-base font-semibold text-white"
            style={{ background: C.gradientGold }}>
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
  const activeMenuItem = getActiveItem(menuItems, location);

  const displayName = user?.name || user?.email || "Usuário";
  const firstName = displayName.split(" ")[0];
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  const roleBadgeStyle = {
    background: isAdmin ? C.roleBadgeAdminBg : isConsultora ? C.roleBadgeConsultBg : C.roleBadgeSellerBg,
    color: isAdmin ? C.roleBadgeAdminFg : isConsultora ? C.roleBadgeConsultFg : C.roleBadgeSellerFg,
  };

  const navigate = (path: string) => {
    setLocation(path);
    setMenuOpen(false);
  };

  // Bloqueia scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (!menuOpen) {
      const savedTop = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (savedTop) {
        window.scrollTo(0, -parseInt(savedTop, 10));
      }
      return;
    }
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (top) window.scrollTo(0, -parseInt(top, 10));
    };
  }, [menuOpen]);

  // ─── MOBILE LAYOUT ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>

        {/* Header fixo mobile */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 shadow-sm"
          style={{ background: C.sidebar, borderBottom: `1px solid ${C.sidebarBorder}` }}>
          <div className="flex items-center gap-3">
            <PulseStar className="text-amber-500" />
            <span className="font-semibold text-sm" style={{ color: C.sidebarFg, fontFamily: "'Playfair Display', serif" }}>
              {activeMenuItem?.label ?? "Mundo Da Magia"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle size="md" />
            <div style={{ color: C.mutedFg }}>
              <PushNotificationButton />
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl min-w-[44px] min-h-[44px]"
              style={{ color: C.mutedFg }}
              aria-label="Abrir menu">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Drawer menu mobile */}
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed inset-0 z-50 flex">
              {/* Overlay */}
              <motion.div
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
              />

              {/* Drawer */}
              <motion.div
                className="relative ml-auto w-72 h-full flex flex-col shadow-2xl"
                style={{ background: C.sidebar }}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >

                {/* Drawer header */}
                <div className="flex items-center justify-between px-5 py-4 border-b"
                  style={{ borderColor: C.sidebarBorder }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={{ background: C.gradientGold, color: "white" }}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: C.sidebarFg }}>{firstName}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={roleBadgeStyle}>
                        {isAdmin ? "Administrador" : isConsultora ? "Consultora" : "Vendedor"}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setMenuOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl min-w-[44px] min-h-[44px]"
                    style={{ color: C.textFaint }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Menu items */}
                <nav className="flex-1 overflow-y-auto py-3 px-3">
                  {menuItems.map((item, i) => {
                    const isActive = activeMenuItem?.path === item.path;
                    return (
                      <motion.button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 24 }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1 transition-all text-left min-h-[44px]"
                        style={isActive ? {
                          background: C.sidebarAccent,
                          borderLeft: `3px solid ${C.primary}`,
                          color: C.sidebarFg,
                        } : { color: C.textFaint }}>
                        <item.icon className="w-5 h-5 shrink-0" style={isActive ? { color: C.primary } : {}} />
                        <span className="font-medium text-[15px]">{item.label}</span>
                        {isActive && <ChevronRight className="w-4 h-4 ml-auto" style={{ color: C.primary }} />}
                      </motion.button>
                    );
                  })}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t" style={{ borderColor: C.sidebarBorder }}>
                  <button
                    onClick={() => logoutMutation.mutate()}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[44px]"
                    style={{ color: C.logoutFg, background: C.logoutBg }}>
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium text-sm">Sair do Sistema</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Conteúdo principal mobile */}
        <main className="flex-1 pt-14 pb-4">
          <div className="px-4 py-5">{children}</div>
        </main>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ──────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>

      {/* Sidebar desktop */}
      <aside className="w-72 shrink-0 flex flex-col sticky top-0 h-screen"
        style={{ background: C.sidebar, borderRight: `1px solid ${C.sidebarBorder}` }}>

        {/* Logo com animação */}
        <div className="h-16 flex items-center gap-3 px-5 border-b" style={{ borderColor: C.sidebarBorder }}>
          <PulseStar className="text-amber-500" />
          <ShimmerText className="font-semibold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
            Mundo Da Magia
          </ShimmerText>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={roleBadgeStyle}>
            {isAdmin ? "Administrador" : isConsultora ? "Consultora" : "Vendedor"}
          </span>
        </div>

        {/* Nav - fontes maiores, ícones maiores, melhor contraste */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1 space-y-0.5">
          {menuItems.map((item, i) => {
            const isActive = activeMenuItem?.path === item.path;
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left relative"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 24 }}
                whileHover={{ x: 4 }}
                style={{ color: isActive ? C.sidebarFg : "rgba(200,200,215,0.65)" }}
              >
                {/* Barra lateral ativa com animação */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                    style={{ background: C.primary }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {/* Background ativo */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-bg"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: C.sidebarAccent }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  className="w-5 h-5 shrink-0 relative z-10"
                  style={isActive ? { color: C.primary } : {}}
                />
                <span className="font-medium text-[15px] relative z-10">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t" style={{ borderColor: C.sidebarBorder }}>
          {/* User info */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-2"
            style={{ color: C.sidebarFg }}>
            <motion.div
              className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
              style={{ background: C.gradientGold, color: "white" }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              {initials}
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium truncate" style={{ color: C.sidebarFg }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: "rgba(200,200,215,0.5)" }}>{(user as any)?.username || user?.email || ""}</p>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <div style={{ color: C.mutedFg }}>
                <PushNotificationButton />
              </div>
            </div>
          </div>

          {/* Logout */}
          <motion.button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[15px] font-medium"
            style={{ color: C.logoutFg }}
            whileHover={{ background: "rgba(192,57,43,0.1)", x: 2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </motion.button>
        </div>
      </aside>

      {/* Main content desktop com animação de transição */}
      <main className="flex-1 min-w-0 p-6 overflow-y-auto">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
