import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeft,
  PlusCircle,
  Settings,
  Users,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// Menu items por role
const sellerMenuItems = [
  { icon: PlusCircle, label: "Nova Venda", path: "/venda" },
  { icon: FileText, label: "Minhas Vendas", path: "/minhas-vendas" },
];

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: BarChart3, label: "Relatórios", path: "/admin/relatorios" },
  { icon: FileText, label: "Todas as Vendas", path: "/admin/vendas" },
  { icon: Package, label: "Trabalhos", path: "/admin/produtos" },
  { icon: Users, label: "Vendedores", path: "/admin/vendedores" },
  { icon: Settings, label: "Configurações", path: "/admin/configuracoes" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full py-4 text-base font-semibold"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))", color: "white" }}>
            Entrar no Sistema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "admin";
  const menuItems = isAdmin ? adminMenuItems : sellerMenuItems;
  const activeMenuItem = menuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const displayName = user?.name || user?.email || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b" style={{ borderColor: "oklch(0.22 0.03 265)" }}>
            <div className="flex items-center gap-3 px-3">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors focus:outline-none shrink-0"
                style={{ color: "oklch(0.70 0.06 65)" }}
                aria-label="Toggle navigation">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
                    <svg width="12" height="12" viewBox="0 0 40 40" fill="none">
                      <path d="M20 4L24 14H36L26 21L30 32L20 25L10 32L14 21L4 14H16L20 4Z" fill="white" />
                    </svg>
                  </div>
                  <span className="font-semibold text-sm truncate" style={{ color: "oklch(0.92 0.01 65)", fontFamily: "'Playfair Display', serif" }}>
                    Gestão de Vendas
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Role badge */}
          {!isCollapsed && (
            <div className="px-4 py-3">
              <span className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  background: isAdmin ? "oklch(0.60 0.13 65 / 0.2)" : "oklch(0.55 0.15 160 / 0.2)",
                  color: isAdmin ? "oklch(0.75 0.10 65)" : "oklch(0.65 0.12 160)",
                }}>
                {isAdmin ? "Administrador" : "Vendedor"}
              </span>
            </div>
          )}

          {/* Menu */}
          <SidebarContent className="gap-0 pt-1">
            <SidebarMenu className="px-2 gap-1">
              {menuItems.map(item => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-11 transition-all rounded-xl"
                      style={isActive ? {
                        background: "oklch(0.22 0.03 265)",
                        borderLeft: "3px solid oklch(0.60 0.13 65)",
                        color: "oklch(0.92 0.01 65)",
                      } : { color: "oklch(0.70 0.01 65)" }}>
                      <item.icon className="h-4 w-4 shrink-0" style={isActive ? { color: "oklch(0.60 0.13 65)" } : {}} />
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t" style={{ borderColor: "oklch(0.22 0.03 265)" }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors w-full text-left focus:outline-none"
                  style={{ color: "oklch(0.80 0.01 65)" }}>
                  <Avatar className="h-9 w-9 shrink-0" style={{ border: "2px solid oklch(0.60 0.13 65 / 0.5)" }}>
                    <AvatarFallback className="text-xs font-semibold"
                      style={{ background: "oklch(0.22 0.03 265)", color: "oklch(0.75 0.10 65)" }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none" style={{ color: "oklch(0.92 0.01 65)" }}>
                        {displayName}
                      </p>
                      <p className="text-xs truncate mt-1" style={{ color: "oklch(0.55 0.01 65)" }}>
                        {user?.email || ""}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors hover:bg-primary/30 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between px-4 sticky top-0 z-40"
            style={{ background: "oklch(0.98 0.006 65)", borderColor: "oklch(0.88 0.012 65)" }}>
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-sm">{activeMenuItem?.label ?? "Menu"}</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
