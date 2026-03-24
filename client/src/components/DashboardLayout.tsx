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
  textHint:       "var(--muted-foreground)",
  textFaint:      "var(--muted-foreground)",
  roleBadgeAdminBg:   "rgba(var(--primary-rgb), 0.2)",
  roleBadgeAdminFg:   "var(--primary)",
  roleBadgeConsultBg: "rgba(var(--accent-rgb), 0.2)",
  roleBadgeConsultFg: "var(--accent)",
  roleBadgeSellerBg:  "rgba(var(--success-rgb), 0.2)",
  roleBadgeSellerFg:  "var(--success)",
  logoutFg:       "var(--destructive)",
  logoutBg:       "rgba(var(--destructive-rgb), 0.08)",
  gradientGold:   "linear-gradient(135deg, var(--primary), var(--primary-darker))",
  gradientDark:   "linear-gradient(135deg, var(--background-start), var(--background-end))",
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
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full rounded-3xl shadow-2xl border border-[var(--border)]"
          style={{ background: "var(--card)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: C.gradientGold }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
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
                <div className="flex items-center justify-between p-4 border-b"
                  style={{ borderColor: C.sidebarBorder }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                      style={{ background: C.gradientGold }}>
                      {initials}
                    </div>
                    <div>
                      <ShimmerText className="font-bold text-sm" style={{ color: C.sidebarFg }}>{firstName}</ShimmerText>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase"
                        style={roleBadgeStyle}>
                        {user?.role === "admin" ? "Admin" : user?.role === "consultora" ? "Consultora" : "Vendedor"}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setMenuOpen(false)} className="p-2 rounded-xl text-white hover:bg-white/10">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                  {menuItems.map((item, index) => (
                    <motion.button
                      key={index}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors
                        ${activeMenuItem?.path === item.path ? "bg-[var(--sidebar-accent)] text-[var(--primary-foreground)]" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)]"}`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </motion.button>
                  ))}
                </nav>

                <div className="p-4 border-t flex items-center justify-between"
                  style={{ borderColor: C.sidebarBorder }}>
                  <ThemeToggle size="md" />
                  <button
                    onClick={() => logoutMutation.mutate()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    style={{ background: C.logoutBg, color: C.logoutFg }}>
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Conteúdo principal mobile */}
        <main className="flex-1 p-4 pt-16">
          {children}
        </main>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ──────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-64 shrink-0 flex flex-col border-r shadow-lg"
        style={{ background: C.sidebar, borderColor: C.sidebarBorder }}>
        <div className="flex items-center gap-3 p-4 border-b"
          style={{ borderColor: C.sidebarBorder }}>
          <PulseStar className="text-amber-500" />
          <span className="font-bold text-lg" style={{ color: C.sidebarFg, fontFamily: "'Playfair Display', serif" }}>
            Mundo Da Magia
          </span>
        </div>

        <div className="flex flex-col items-center p-4 border-b"
          style={{ borderColor: C.sidebarBorder }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-2"
            style={{ background: C.gradientGold }}>
            {initials}
          </div>
          <ShimmerText className="font-bold text-base" style={{ color: C.sidebarFg }}>{displayName}</ShimmerText>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase mt-1"
            style={roleBadgeStyle}>
            {user?.role === "admin" ? "Administrador" : user?.role === "consultora" ? "Consultora" : "Vendedor"}
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item, index) => (
            <motion.button
              key={index}
              onClick={() => navigate(item.path)}
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${activeMenuItem?.path === item.path ? "bg-[var(--sidebar-accent)] text-[var(--primary-foreground)] shadow-sm" : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)]"}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {activeMenuItem?.path === item.path && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute right-2 w-1 h-5 rounded-full bg-[var(--primary)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </motion.button>
          ))}
        </nav>

        <div className="p-4 border-t flex items-center justify-between"
          style={{ borderColor: C.sidebarBorder }}>
          <ThemeToggle size="md" />
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            style={{ background: C.logoutBg, color: C.logoutFg }}>
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </motion.aside>

      {/* Conteúdo principal desktop */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}
