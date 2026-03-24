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
import { ShimmerText, PulseStar, FadeIn } from "./Animations";

// Cores clássicas (v1.8.x)
const CLASSIC_COLORS = {
  sidebar:        "#111111",
  sidebarFg:      "#ffffff",
  sidebarAccent:  "rgba(255,255,255,0.05)",
  sidebarBorder:  "rgba(255,255,255,0.1)",
  primary:        "#c17f24",
  primaryFg:      "#ffffff",
  bg:             "#faf8f4",
  mutedFg:        "#8888a0",
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

// Cores modernas (Dark Mode / Admin)
const MODERN_COLORS = {
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

function getActiveItem(menuItems: typeof adminMenuItems, location: string) {
  const exact = menuItems.find(item => item.path === location);
  if (exact) return exact;
  const sorted = [...menuItems]
    .filter(item => item.path !== "/admin" && item.path !== "/")
    .sort((a, b) => b.path.length - a.path.length);
  const prefix = sorted.find(item => location.startsWith(item.path));
  if (prefix) return prefix;
  return null;
}

function ThemeToggle({ size = "sm", colors }: { size?: "sm" | "md", colors: typeof MODERN_COLORS }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const btnSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";

  return (
    <motion.button
      onClick={toggleTheme}
      className={`${btnSize} flex items-center justify-center rounded-xl transition-colors`}
      style={{ color: colors.mutedFg }}
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
  const isAdmin = user?.role === "admin";
  const C = isAdmin ? MODERN_COLORS : CLASSIC_COLORS;

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: C.gradientDark }}>
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full rounded-3xl shadow-2xl border border-[var(--border)]"
          style={{ background: isAdmin ? "var(--card)" : "#ffffff" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: C.gradientGold }}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center" style={{ fontFamily: "'Playfair Display', serif", color: isAdmin ? "var(--foreground)" : "#111111" }}>
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
  const C = isAdmin ? MODERN_COLORS : CLASSIC_COLORS;
  const menuItems = isAdmin ? adminMenuItems : isConsultora ? consultoraMenuItems : sellerMenuItems;
  const activeMenuItem = getActiveItem(menuItems, location);

  const displayName = user?.name || user?.email || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  const navigate = (path: string) => {
    setLocation(path);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) {
      const savedTop = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (savedTop) window.scrollTo(0, -parseInt(savedTop, 10));
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

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 shadow-sm"
          style={{ background: C.sidebar, borderBottom: `1px solid ${C.sidebarBorder}` }}>
          <div className="flex items-center gap-3">
            <PulseStar className="text-amber-500" />
            <span className="font-semibold text-sm" style={{ color: C.sidebarFg, fontFamily: "'Playfair Display', serif" }}>
              {activeMenuItem?.label ?? "Mundo Da Magia"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && <ThemeToggle size="md" colors={C} />}
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

        <AnimatePresence>
          {menuOpen && (
            <div className="fixed inset-0 z-50 flex">
              <motion.div
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
              />
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
                    <PulseStar className="text-amber-500" />
                    <span className="font-bold text-lg" style={{ color: C.sidebarFg, fontFamily: "'Playfair Display', serif" }}>Mundo Da Magia</span>
                  </div>
                  <button onClick={() => setMenuOpen(false)} className="p-2" style={{ color: C.sidebarFg }}><X className="w-6 h-6" /></button>
                </div>

                <div className="flex flex-col items-center p-6 border-b" style={{ borderColor: C.sidebarBorder }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-4xl font-bold mb-3"
                    style={{ background: C.gradientGold }}>{initials}</div>
                  <p className="font-bold text-lg" style={{ color: C.sidebarFg }}>{displayName}</p>
                  <div className="mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: isAdmin ? "rgba(193,127,36,0.2)" : isConsultora ? "rgba(107,79,173,0.2)" : "rgba(39,174,96,0.2)", color: isAdmin ? "#b8860b" : isConsultora ? "#7b5ea7" : "#27ae60" }}>
                    {isAdmin ? "Admin" : isConsultora ? "Consultora" : "Vendedor"}
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                  {menuItems.map((item) => {
                    const isActive = activeMenuItem?.path === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: isActive ? (isAdmin ? "var(--sidebar-accent)" : "rgba(255,255,255,0.1)") : "transparent",
                          color: isActive ? (isAdmin ? "var(--primary)" : "#ffffff") : C.sidebarFg,
                          opacity: isActive ? 1 : 0.7
                        }}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>

                <div className="p-4 border-t" style={{ borderColor: C.sidebarBorder }}>
                  <button
                    onClick={() => logoutMutation.mutate()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors"
                    style={{ background: C.logoutBg, color: C.logoutFg }}>
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className="flex-1 p-4 pt-16">
          {isAdmin ? <FadeIn>{children}</FadeIn> : children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>
      <aside className="w-64 shrink-0 flex flex-col border-r shadow-lg sticky top-0 h-screen"
        style={{ background: C.sidebar, borderColor: C.sidebarBorder }}>
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: C.sidebarBorder }}>
          <PulseStar className="text-amber-500" />
          <span className="font-bold text-lg" style={{ color: C.sidebarFg, fontFamily: "'Playfair Display', serif" }}>Mundo Da Magia</span>
        </div>

        <div className="flex flex-col items-center p-4 border-b" style={{ borderColor: C.sidebarBorder }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-2"
            style={{ background: C.gradientGold }}>{initials}</div>
          <p className="font-bold text-sm text-center" style={{ color: C.sidebarFg }}>{displayName}</p>
          <div className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{ background: isAdmin ? "rgba(193,127,36,0.2)" : isConsultora ? "rgba(107,79,173,0.2)" : "rgba(39,174,96,0.2)", color: isAdmin ? "#b8860b" : isConsultora ? "#7b5ea7" : "#27ae60" }}>
            {isAdmin ? "Admin" : isConsultora ? "Consultora" : "Vendedor"}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeMenuItem?.path === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isActive ? (isAdmin ? "var(--sidebar-accent)" : "rgba(255,255,255,0.1)") : "transparent",
                  color: isActive ? (isAdmin ? "var(--primary)" : "#ffffff") : C.sidebarFg,
                  opacity: isActive ? 1 : 0.7
                }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t flex flex-col gap-2" style={{ borderColor: C.sidebarBorder }}>
          {isAdmin && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <ThemeToggle size="sm" colors={C} />
              <div style={{ color: C.mutedFg }}><PushNotificationButton /></div>
            </div>
          )}
          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            style={{ background: C.logoutBg, color: C.logoutFg }}>
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {isAdmin ? <FadeIn>{children}</FadeIn> : children}
      </main>
    </div>
  );
}
