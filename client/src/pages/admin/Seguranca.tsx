import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Shield, Monitor, Clock, Search, Loader2, History, LogOut,
  User, Smartphone, Globe, Filter, ChevronLeft, ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";

type Tab = "sessions" | "logs";

type AuditLogEntry = {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

const ROLE_LABELS: Record<string, string> = {
  user: "Vendedor",
  consultora: "Consultora",
  admin: "Admin",
};

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: "Desconhecido", browser: "Desconhecido" };
  let device = "Desktop";
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = "Mobile";
  if (/Tablet|iPad/i.test(ua)) device = "Tablet";

  let browser = "Navegador";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  else if (/Edg\//.test(ua)) browser = "Edge";

  return { device, browser };
}

function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d atrás`;
}

function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Aba Sessões Ativas ─────────────────────────────────────────────────────

function SessionsTab() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();

  const { data: sessions = [], isLoading } = trpc.security.getActiveSessions.useQuery(
    undefined,
    { staleTime: 30_000 }
  );

  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const disconnectMutation = trpc.security.disconnectSession.useMutation({
    onSuccess: () => {
      toast.success("Sessão desconectada!");
      utils.security.getActiveSessions.invalidate();
      setDisconnectId(null);
      setMasterPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDisconnect = () => {
    if (!disconnectId || !masterPassword) return;
    disconnectMutation.mutate({ sessionId: disconnectId, masterPassword });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Monitor className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
          {sessions.length} sessão(ões) ativa(s)
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{
          background: isDark ? "var(--card)" : "#ffffff",
          borderColor: "var(--border)",
        }}>
          <Monitor className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhuma sessão ativa no momento</p>
        </div>
      ) : (
        <StaggerList className="space-y-3">
          {sessions.map((session) => {
            const { device, browser } = parseUserAgent(session.userAgent);
            return (
              <StaggerItem key={session.id}>
                <div className="p-4 rounded-xl border transition-all" style={{
                  background: isDark ? "var(--card)" : "#ffffff",
                  borderColor: "var(--border)",
                }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{
                        background: "rgba(var(--primary-rgb, 124,58,237), 0.15)",
                      }}>
                        {device === "Mobile" ? (
                          <Smartphone className="w-5 h-5" style={{ color: "var(--primary)" }} />
                        ) : (
                          <Monitor className="w-5 h-5" style={{ color: "var(--primary)" }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
                          {session.userName || "Usuário desconhecido"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          {ROLE_LABELS[session.userRole ?? "user"] ?? "Vendedor"} · {browser} · {device}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {session.ipAddress && (
                            <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                              <Globe className="w-3 h-3" /> {session.ipAddress}
                            </span>
                          )}
                          <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                            <Clock className="w-3 h-3" /> {timeAgo(session.lastActive)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDisconnectId(session.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
                      style={{
                        background: "rgba(var(--destructive-rgb, 239,68,68), 0.1)",
                        color: "var(--destructive)",
                      }}
                    >
                      <LogOut className="w-3.5 h-3.5 inline mr-1" />
                      Desconectar
                    </button>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}

      {/* Modal de Senha Mestre */}
      {disconnectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl border"
            style={{
              background: isDark ? "var(--card)" : "#ffffff",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5" style={{ color: "var(--destructive)" }} />
              <h3 className="font-bold" style={{ color: "var(--foreground)" }}>Confirmar Desconexão</h3>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
              Digite a <strong>Senha Mestre</strong> para desconectar esta sessão.
            </p>
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Senha Mestre"
                className="w-full px-4 py-3 rounded-xl border text-sm"
                style={{
                  background: isDark ? "var(--input)" : "#f9fafb",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  fontSize: "16px",
                }}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleDisconnect(); }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setDisconnectId(null); setMasterPassword(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDisconnect}
                disabled={!masterPassword || disconnectMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--destructive)" }}
              >
                {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Desconectar"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── Aba Histórico de Atividades ────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  "Login": "#22c55e",
  "Criou Venda": "#3b82f6",
  "Editou Venda": "#f59e0b",
  "Excluiu Venda": "#ef4444",
  "Restaurou Venda": "#8b5cf6",
  "Deletou Venda Permanentemente": "#dc2626",
  "Criou Trabalho": "#3b82f6",
  "Alterou Trabalho": "#f59e0b",
  "Excluiu Trabalho": "#ef4444",
  "Restaurou Trabalho": "#8b5cf6",
  "Criou Funcionário": "#3b82f6",
  "Alterou Funcionário": "#f59e0b",
  "Excluiu Funcionário": "#ef4444",
  "Desativou Funcionário": "#f97316",
  "Desconectou Sessão": "#dc2626",
};

const DETAIL_LABELS: Record<string, string> = {
  saleId: "ID da Venda",
  clientName: "Cliente",
  productName: "Trabalho",
  amount: "Valor",
  productId: "ID do Trabalho",
  name: "Nome",
  username: "Usuário",
  role: "Cargo",
  rememberMe: "Lembrar-me",
  changes: "Alterações",
  categories: "Categorias",
  targetUserId: "ID do Funcionário",
  deletedUserId: "ID do Excluído",
  sessionId: "ID da Sessão",
};

function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "amount") return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (key === "rememberMe") return value ? "Sim" : "Não";
  if (key === "role") {
    const roles: Record<string, string> = { user: "Vendedor", consultora: "Consultora", admin: "Admin" };
    return roles[String(value)] ?? String(value);
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function LogDetailPanel({ details, isDark }: { details: string | null; isDark: boolean }) {
  if (!details) return null;
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(details); } catch { return <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{details}</p>; }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-3 rounded-lg mt-2" style={{
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    }}>
      {Object.entries(parsed).map(([key, val]) => (
        <div key={key} className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            {DETAIL_LABELS[key] ?? key}
          </span>
          <span className="text-xs mt-0.5 break-all" style={{ color: "var(--foreground)" }}>
            {formatDetailValue(key, val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AuditLogsTab() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const PAGE_SIZE = 50;

  // Busca TODOS os logs da página sem filtro server-side — filtro é client-side
  const { data: allLogs = [], isLoading } = trpc.security.getAuditLogs.useQuery(
    { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { staleTime: 30_000 }
  );

  // Filtragem client-side (sem re-fetch)
  const logs = useMemo(() => {
    if (!searchTerm.trim()) return allLogs;
    const term = searchTerm.toLowerCase();
    return (allLogs as AuditLogEntry[]).filter((log) =>
      log.action.toLowerCase().includes(term) ||
      (log.userName ?? "").toLowerCase().includes(term)
    );
  }, [allLogs, searchTerm]);

  const toggleExpand = (id: number) => setExpandedId((prev) => (prev === id ? null : id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro client-side */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por ação ou usuário..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm"
            style={{
              background: isDark ? "var(--input)" : "#f9fafb",
              borderColor: "var(--border)",
              color: "var(--foreground)",
              fontSize: "16px",
            }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <Filter className="w-3.5 h-3.5" />
          <span>{logs.length} registros</span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{
          background: isDark ? "var(--card)" : "#ffffff",
          borderColor: "var(--border)",
        }}>
          <History className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {searchTerm ? "Nenhum registro encontrado para este filtro" : "Nenhum registro de atividade"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: Tabela com linhas expansíveis */}
          <div className="hidden md:block rounded-xl border overflow-hidden" style={{
            background: isDark ? "var(--card)" : "#ffffff",
            borderColor: "var(--border)",
          }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--muted-foreground)" }}>Data/Hora</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--muted-foreground)" }}>Usuário</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--muted-foreground)" }}>Ação</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--muted-foreground)" }}>Detalhes</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--muted-foreground)" }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLogEntry) => {
                  const actionColor = ACTION_COLORS[log.action] ?? "var(--muted-foreground)";
                  const isExpanded = expandedId === log.id;
                  let shortDetails = "";
                  try {
                    const parsed = JSON.parse(log.details || "{}");
                    shortDetails = Object.entries(parsed)
                      .slice(0, 2)
                      .map(([k, v]) => `${DETAIL_LABELS[k] ?? k}: ${typeof v === "object" ? "..." : v}`)
                      .join(", ");
                    if (Object.keys(parsed).length > 2) shortDetails += " ...";
                  } catch { shortDetails = log.details || ""; }

                  return (
                    <tr
                      key={log.id}
                      className="border-t cursor-pointer transition-colors"
                      style={{ borderColor: "var(--border)", background: isExpanded ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)") : undefined }}
                      onClick={() => toggleExpand(log.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap align-top" style={{ color: "var(--foreground)" }}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ color: "var(--foreground)" }}>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                          <span className="truncate max-w-[150px]">{log.userName || "Sistema"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: `${actionColor}20`, color: actionColor }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[350px] align-top">
                        {!isExpanded ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                              {shortDetails || "—"}
                            </span>
                            {log.details && (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                            )}
                          </div>
                        ) : (
                          <LogDetailPanel details={log.details} isDark={isDark} />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs align-top" style={{ color: "var(--muted-foreground)" }}>
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards expansíveis */}
          <div className="md:hidden space-y-3">
            <StaggerList className="space-y-3">
              {logs.map((log: AuditLogEntry) => {
                const actionColor = ACTION_COLORS[log.action] ?? "var(--muted-foreground)";
                const isExpanded = expandedId === log.id;

                return (
                  <StaggerItem key={log.id}>
                    <div
                      className="p-4 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: isDark ? "var(--card)" : "#ffffff",
                        borderColor: isExpanded ? "var(--primary)" : "var(--border)",
                      }}
                      onClick={() => toggleExpand(log.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: `${actionColor}20`, color: actionColor }}>
                          {log.action}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {formatDateTime(log.createdAt)}
                          </span>
                          <ChevronDown
                            className="w-3.5 h-3.5 transition-transform"
                            style={{
                              color: "var(--muted-foreground)",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                        {log.userName || "Sistema"}
                      </p>
                      {log.ipAddress && (
                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                          <Globe className="w-3 h-3" /> {log.ipAddress}
                        </p>
                      )}
                      {isExpanded && <LogDetailPanel details={log.details} isDark={isDark} />}
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { setPage((p) => Math.max(0, p - 1)); setExpandedId(null); }}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Página {page + 1}
            </span>
            <button
              onClick={() => { setPage((p) => p + 1); setExpandedId(null); }}
              disabled={allLogs.length < PAGE_SIZE}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function AdminSeguranca() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [tab, setTab] = useState<Tab>("sessions");

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "sessions", label: "Sessões Ativas", icon: Monitor },
    { id: "logs", label: "Histórico de Atividades", icon: History },
  ];

  return (
    <DashboardLayout>
      <FadeIn>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: "rgba(var(--primary-rgb, 124,58,237), 0.15)",
            }}>
              <Shield className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>
                Segurança
              </h1>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Sessões ativas e histórico de atividades do sistema
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
          }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tab === t.id ? (isDark ? "var(--card)" : "#ffffff") : "transparent",
                  color: tab === t.id ? "var(--primary)" : "var(--muted-foreground)",
                  boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab === "sessions" ? <SessionsTab /> : <AuditLogsTab />}
        </div>
      </FadeIn>
    </DashboardLayout>
  );
}
