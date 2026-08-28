import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Shield,
  Monitor,
  Search,
  Loader2,
  History,
  LogOut,
  User,
  Globe,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Users,
  Pencil,
  Trash2,
  Save,
  LockKeyhole,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const ROLE_COLORS: Record<string, string> = {
  admin: "#8b5cf6",
  consultora: "#f59e0b",
  user: "#3b82f6",
};

function parseUserAgent(ua: string | null): {
  device: string;
  browser: string;
} {
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

// ─── Aba Sessões (Funcionários com status) ──────────────────────────────────

type UserWithStatus = {
  id: number;
  name: string;
  role: string;
  isOnline: boolean;
  lastActive: Date | null;
  sessionCount: number;
  latestDevice: string;
  latestBrowser: string;
  latestIp: string | null;
};

function SessionsTab() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();

  const { data: allUsers = [], isLoading: loadingUsers } =
    trpc.users.listAll.useQuery(undefined, { staleTime: 30_000 });
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    isFetching,
    refetch,
  } = trpc.security.getActiveSessions.useQuery(undefined, {
    staleTime: 30_000,
  });

  const [disconnectUserId, setDisconnectUserId] = useState<number | null>(null);
  const [disconnectUserName, setDisconnectUserName] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const disconnectMutation = trpc.security.disconnectUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário desconectado com sucesso!");
      utils.security.getActiveSessions.invalidate();
      setDisconnectUserId(null);
      setMasterPassword("");
      setDisconnectUserName("");
    },
    onError: err => toast.error(err.message),
  });

  const handleDisconnect = () => {
    if (!disconnectUserId || !masterPassword) return;
    disconnectMutation.mutate({ userId: disconnectUserId, masterPassword });
  };

  const usersWithStatus: UserWithStatus[] = useMemo(() => {
    const sessionsByUser = new Map<number, typeof sessions>();
    for (const s of sessions) {
      const existing = sessionsByUser.get(s.userId) || [];
      existing.push(s);
      sessionsByUser.set(s.userId, existing);
    }
    return allUsers
      .map(user => {
        const userSessions = sessionsByUser.get(user.id) || [];
        const latestSession =
          userSessions.length > 0
            ? userSessions.reduce((a, b) =>
                new Date(a.lastActive) > new Date(b.lastActive) ? a : b
              )
            : null;
        const { device, browser } = latestSession
          ? parseUserAgent(latestSession.userAgent)
          : { device: "—", browser: "—" };
        return {
          id: user.id,
          name:
            (user as any).displayName ||
            user.name ||
            (user as any).username ||
            "Sem nome",
          role: user.role ?? "user",
          isOnline: userSessions.length > 0,
          lastActive: latestSession
            ? new Date(latestSession.lastActive)
            : user.lastSignedIn
              ? new Date(user.lastSignedIn)
              : null,
          sessionCount: userSessions.length,
          latestDevice: device,
          latestBrowser: browser,
          latestIp: latestSession?.ipAddress ?? null,
        };
      })
      .sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allUsers, sessions]);

  const onlineCount = usersWithStatus.filter(u => u.isOnline).length;
  const isLoading = loadingUsers || loadingSessions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--primary)" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {usersWithStatus.length} funcionário(s)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#22c55e" }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {onlineCount} online
            </span>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
          style={{
            borderColor: "var(--border)",
            color: "var(--muted-foreground)",
          }}
          title="Recarregar"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          {isFetching ? "Carregando..." : "Recarregar"}
        </button>
      </div>

      {usersWithStatus.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl border"
          style={{
            background: isDark ? "var(--card)" : "#ffffff",
            borderColor: "var(--border)",
          }}
        >
          <Users
            className="w-12 h-12 mx-auto mb-3"
            style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Nenhum funcionário cadastrado
          </p>
        </div>
      ) : (
        <StaggerList className="space-y-2">
          {usersWithStatus.map(user => {
            const roleColor = ROLE_COLORS[user.role] ?? "#6b7280";
            return (
              <StaggerItem key={user.id}>
                <div
                  className="p-4 rounded-xl border transition-all"
                  style={{
                    background: isDark ? "var(--card)" : "#ffffff",
                    borderColor: user.isOnline ? "#22c55e40" : "var(--border)",
                    borderLeftWidth: "3px",
                    borderLeftColor: user.isOnline
                      ? "#22c55e"
                      : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.08)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ background: `${roleColor}18` }}
                        >
                          <User
                            className="w-5 h-5"
                            style={{ color: roleColor }}
                          />
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                          style={{
                            background: user.isOnline ? "#22c55e" : "#9ca3af",
                            borderColor: isDark ? "var(--card)" : "#ffffff",
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="font-semibold text-sm truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {user.name}
                          </p>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: `${roleColor}18`,
                              color: roleColor,
                            }}
                          >
                            {ROLE_LABELS[user.role] ?? "Vendedor"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {user.isOnline ? (
                            <>
                              <span
                                className="text-xs flex items-center gap-1"
                                style={{ color: "#22c55e" }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: "#22c55e" }}
                                />
                                Online
                                {user.sessionCount > 1 && (
                                  <span
                                    style={{ color: "var(--muted-foreground)" }}
                                  >
                                    ({user.sessionCount} sessões)
                                  </span>
                                )}
                              </span>
                              <span
                                className="text-xs"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                {user.latestBrowser} · {user.latestDevice}
                              </span>
                              {user.latestIp && (
                                <span
                                  className="text-xs flex items-center gap-1"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  <Globe className="w-3 h-3" /> {user.latestIp}
                                </span>
                              )}
                            </>
                          ) : (
                            <span
                              className="text-xs flex items-center gap-1"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: "#9ca3af" }}
                              />
                              Offline
                              {user.lastActive && (
                                <span>
                                  {" "}
                                  · Último acesso {timeAgo(user.lastActive)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {user.isOnline && (
                      <button
                        onClick={() => {
                          setDisconnectUserId(user.id);
                          setDisconnectUserName(user.name);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
                        style={{
                          background:
                            "rgba(var(--destructive-rgb, 239,68,68), 0.1)",
                          color: "var(--destructive)",
                        }}
                      >
                        <LogOut className="w-3.5 h-3.5 inline mr-1" />
                        Desconectar
                      </button>
                    )}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}

      {/* Modal de Senha Mestre */}
      {disconnectUserId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
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
              <Shield
                className="w-5 h-5"
                style={{ color: "var(--destructive)" }}
              />
              <h3 className="font-bold" style={{ color: "var(--foreground)" }}>
                Desconectar Usuário
              </h3>
            </div>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              Todas as sessões de <strong>{disconnectUserName}</strong> serão
              encerradas. Digite a <strong>Senha Mestre</strong> para confirmar.
            </p>
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                placeholder="Senha Mestre"
                className="w-full px-4 py-3 rounded-xl border text-sm"
                style={{
                  background: isDark ? "var(--input)" : "#f9fafb",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  fontSize: "16px",
                }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") handleDisconnect();
                }}
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
                onClick={() => {
                  setDisconnectUserId(null);
                  setMasterPassword("");
                  setDisconnectUserName("");
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDisconnect}
                disabled={!masterPassword || disconnectMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--destructive)" }}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Desconectar"
                )}
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
  Login: "#22c55e",
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
  "Desconectou Usuário": "#dc2626",
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
  if (key === "amount")
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  if (key === "rememberMe") return value ? "Sim" : "Não";
  if (key === "role") {
    const roles: Record<string, string> = {
      user: "Vendedor",
      consultora: "Consultora",
      admin: "Admin",
    };
    return roles[String(value)] ?? String(value);
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function LogDetailPanel({
  details,
  isDark,
}: {
  details: string | null;
  isDark: boolean;
}) {
  if (!details) return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(details);
  } catch {
    return (
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        {details}
      </p>
    );
  }
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-3 rounded-lg mt-2"
      style={{
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      }}
    >
      {Object.entries(parsed).map(([key, val]) => (
        <div key={key} className="flex flex-col">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            {DETAIL_LABELS[key] ?? key}
          </span>
          <span
            className="text-xs mt-0.5 break-all"
            style={{ color: "var(--foreground)" }}
          >
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

  const {
    data: allLogs = [],
    isLoading,
    isFetching,
    refetch,
  } = trpc.security.getAuditLogs.useQuery(
    { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { staleTime: 30_000 }
  );

  const logs = useMemo(() => {
    if (!searchTerm.trim()) return allLogs;
    const term = searchTerm.toLowerCase();
    return (allLogs as AuditLogEntry[]).filter(
      log =>
        log.action.toLowerCase().includes(term) ||
        (log.userName ?? "").toLowerCase().includes(term)
    );
  }, [allLogs, searchTerm]);

  const toggleExpand = (id: number) =>
    setExpandedId(prev => (prev === id ? null : id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "var(--primary)" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
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
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{logs.length} registros</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
          style={{
            borderColor: "var(--border)",
            color: "var(--muted-foreground)",
          }}
          title="Recarregar"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          {isFetching ? "Carregando..." : "Recarregar"}
        </button>
      </div>

      {logs.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl border"
          style={{
            background: isDark ? "var(--card)" : "#ffffff",
            borderColor: "var(--border)",
          }}
        >
          <History
            className="w-12 h-12 mx-auto mb-3"
            style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {searchTerm
              ? "Nenhum registro encontrado para este filtro"
              : "Nenhum registro de atividade"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: Tabela */}
          <div
            className="hidden md:block rounded-xl border overflow-hidden"
            style={{
              background: isDark ? "var(--card)" : "#ffffff",
              borderColor: "var(--border)",
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    background: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  }}
                >
                  <th
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Data/Hora
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Usuário
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Ação
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Detalhes
                  </th>
                  <th
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLogEntry) => {
                  const actionColor =
                    ACTION_COLORS[log.action] ?? "var(--muted-foreground)";
                  const isExpanded = expandedId === log.id;
                  let shortDetails = "";
                  try {
                    const parsed = JSON.parse(log.details || "{}");
                    shortDetails = Object.entries(parsed)
                      .slice(0, 2)
                      .map(
                        ([k, v]) =>
                          `${DETAIL_LABELS[k] ?? k}: ${typeof v === "object" ? "..." : v}`
                      )
                      .join(", ");
                    if (Object.keys(parsed).length > 2) shortDetails += " ...";
                  } catch {
                    shortDetails = log.details || "";
                  }
                  return (
                    <tr
                      key={log.id}
                      className="border-t cursor-pointer transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        background: isExpanded
                          ? isDark
                            ? "rgba(255,255,255,0.02)"
                            : "rgba(0,0,0,0.01)"
                          : undefined,
                      }}
                      onClick={() => toggleExpand(log.id)}
                    >
                      <td
                        className="px-4 py-3 whitespace-nowrap align-top"
                        style={{ color: "var(--foreground)" }}
                      >
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td
                        className="px-4 py-3 align-top"
                        style={{ color: "var(--foreground)" }}
                      >
                        <div className="flex items-center gap-2">
                          <User
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: "var(--muted-foreground)" }}
                          />
                          <span className="truncate max-w-[150px]">
                            {log.userName || "Sistema"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: `${actionColor}20`,
                            color: actionColor,
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[350px] align-top">
                        {!isExpanded ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="text-xs truncate"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              {shortDetails || "—"}
                            </span>
                            {log.details && (
                              <ChevronDown
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: "var(--muted-foreground)" }}
                              />
                            )}
                          </div>
                        ) : (
                          <LogDetailPanel
                            details={log.details}
                            isDark={isDark}
                          />
                        )}
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-xs align-top"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            <StaggerList className="space-y-3">
              {logs.map((log: AuditLogEntry) => {
                const actionColor =
                  ACTION_COLORS[log.action] ?? "var(--muted-foreground)";
                const isExpanded = expandedId === log.id;
                return (
                  <StaggerItem key={log.id}>
                    <div
                      className="p-4 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: isDark ? "var(--card)" : "#ffffff",
                        borderColor: isExpanded
                          ? "var(--primary)"
                          : "var(--border)",
                      }}
                      onClick={() => toggleExpand(log.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: `${actionColor}20`,
                            color: actionColor,
                          }}
                        >
                          {log.action}
                        </span>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {formatDateTime(log.createdAt)}
                          </span>
                          <ChevronDown
                            className="w-3.5 h-3.5 transition-transform"
                            style={{
                              color: "var(--muted-foreground)",
                              transform: isExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                            }}
                          />
                        </div>
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {log.userName || "Sistema"}
                      </p>
                      {log.ipAddress && (
                        <p
                          className="text-xs mt-1 flex items-center gap-1"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <Globe className="w-3 h-3" /> {log.ipAddress}
                        </p>
                      )}
                      {isExpanded && (
                        <LogDetailPanel details={log.details} isDark={isDark} />
                      )}
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                setPage(p => Math.max(0, p - 1));
                setExpandedId(null);
              }}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border disabled:opacity-30"
              style={{
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              Página {page + 1}
            </span>
            <button
              onClick={() => {
                setPage(p => p + 1);
                setExpandedId(null);
              }}
              disabled={allLogs.length < PAGE_SIZE}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border disabled:opacity-30"
              style={{
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Painel oculto do Super ADM ─────────────────────────────────────────────

type EditableAuditLog = {
  id: number;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
};

const PROTECTED_SUPER_ADMIN_ACTIONS = new Set([
  "Super ADM alterou log",
  "Super ADM apagou log",
]);

function toDateTimeLocal(date: string | Date): string {
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function createEditableLog(log: AuditLogEntry): EditableAuditLog {
  return {
    id: log.id,
    userId: log.userId?.toString() ?? "",
    userName: log.userName ?? "",
    action: log.action,
    details: log.details ?? "",
    ipAddress: log.ipAddress ?? "",
    userAgent: log.userAgent ?? "",
    createdAt: toDateTimeLocal(log.createdAt),
  };
}

function SuperAdminLogsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [masterPassword, setMasterPassword] = useState("");
  const [editing, setEditing] = useState<EditableAuditLog | null>(null);
  const {
    data: logs = [],
    isLoading,
    isFetching,
    refetch,
  } = trpc.security.getAuditLogs.useQuery(
    { limit: 100, offset: 0 },
    { enabled: open, staleTime: 0 }
  );

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setMasterPassword("");
    }
  }, [open]);

  const updateMutation = trpc.security.updateAuditLog.useMutation({
    onSuccess: async () => {
      toast.success("Log alterado com sucesso.");
      setEditing(null);
      await utils.security.getAuditLogs.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.security.deleteAuditLog.useMutation({
    onSuccess: async () => {
      toast.success("Log apagado com sucesso.");
      await utils.security.getAuditLogs.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const saveEdit = () => {
    if (!editing || !editing.action.trim()) return;
    if (!masterPassword) {
      toast.error("Informe a senha mestre.");
      return;
    }
    const createdAt = new Date(editing.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      toast.error("Data e hora inválidas.");
      return;
    }
    const userId = editing.userId.trim() ? Number(editing.userId.trim()) : null;
    if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
      toast.error("O ID do usuário deve ser um número inteiro positivo.");
      return;
    }

    updateMutation.mutate({
      id: editing.id,
      userId,
      userName: editing.userName.trim() || null,
      action: editing.action.trim(),
      details: editing.details || null,
      ipAddress: editing.ipAddress.trim() || null,
      userAgent: editing.userAgent || null,
      createdAt,
      masterPassword,
    });
  };

  const deleteLog = (log: AuditLogEntry) => {
    if (!masterPassword) {
      toast.error("Informe a senha mestre.");
      return;
    }
    if (!window.confirm(`Apagar definitivamente o log #${log.id}?`)) return;
    deleteMutation.mutate({ id: log.id, masterPassword });
  };

  const fieldClass =
    "w-full rounded-lg border px-3 py-2 text-sm bg-[var(--input)] text-[var(--foreground)] border-[var(--border)]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-[var(--primary)]" />
            Painel do Super ADM
          </DialogTitle>
          <DialogDescription>
            Edite ou apague registros de atividade. As operações de manutenção
            ficam protegidas para preservar a rastreabilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-semibold text-[var(--muted-foreground)]">
              Senha mestre
              <input
                type="password"
                value={masterPassword}
                onChange={event => setMasterPassword(event.target.value)}
                className={`${fieldClass} mt-1`}
                autoComplete="current-password"
              />
            </label>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>

          <div className="overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              </div>
            ) : logs.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
                Nenhum log encontrado.
              </p>
            ) : (
              <div className="space-y-3">
                {(logs as AuditLogEntry[]).map(log => {
                  const isProtected = PROTECTED_SUPER_ADMIN_ACTIONS.has(
                    log.action
                  );
                  const isEditing = editing?.id === log.id;

                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {isEditing && editing ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                              ID do usuário
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={editing.userId}
                                onChange={event =>
                                  setEditing({
                                    ...editing,
                                    userId: event.target.value,
                                  })
                                }
                                className={`${fieldClass} mt-1`}
                              />
                            </label>
                            <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                              Usuário
                              <input
                                value={editing.userName}
                                onChange={event =>
                                  setEditing({
                                    ...editing,
                                    userName: event.target.value,
                                  })
                                }
                                className={`${fieldClass} mt-1`}
                                maxLength={256}
                              />
                            </label>
                            <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                              Ação
                              <input
                                value={editing.action}
                                onChange={event =>
                                  setEditing({
                                    ...editing,
                                    action: event.target.value,
                                  })
                                }
                                className={`${fieldClass} mt-1`}
                                maxLength={128}
                              />
                            </label>
                            <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                              Data e hora
                              <input
                                type="datetime-local"
                                value={editing.createdAt}
                                onChange={event =>
                                  setEditing({
                                    ...editing,
                                    createdAt: event.target.value,
                                  })
                                }
                                className={`${fieldClass} mt-1`}
                              />
                            </label>
                            <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                              Endereço IP
                              <input
                                value={editing.ipAddress}
                                onChange={event =>
                                  setEditing({
                                    ...editing,
                                    ipAddress: event.target.value,
                                  })
                                }
                                className={`${fieldClass} mt-1`}
                                maxLength={64}
                              />
                            </label>
                          </div>
                          <label className="block text-xs font-semibold text-[var(--muted-foreground)]">
                            Detalhes
                            <textarea
                              value={editing.details}
                              onChange={event =>
                                setEditing({
                                  ...editing,
                                  details: event.target.value,
                                })
                              }
                              className={`${fieldClass} mt-1 min-h-24 resize-y font-mono`}
                              maxLength={50_000}
                            />
                          </label>
                          <label className="block text-xs font-semibold text-[var(--muted-foreground)]">
                            User-Agent
                            <textarea
                              value={editing.userAgent}
                              onChange={event =>
                                setEditing({
                                  ...editing,
                                  userAgent: event.target.value,
                                })
                              }
                              className={`${fieldClass} mt-1 min-h-16 resize-y`}
                              maxLength={2_000}
                            />
                          </label>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="rounded-lg border px-3 py-2 text-sm font-semibold"
                              style={{ borderColor: "var(--border)" }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              style={{ background: "var(--primary)" }}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-[var(--muted-foreground)]">
                                #{log.id}
                              </span>
                              <strong className="text-sm text-[var(--foreground)]">
                                {log.action}
                              </strong>
                              {isProtected && (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                  Protegido
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                              {log.userName || "Sistema"} ·{" "}
                              {formatDateTime(log.createdAt)}
                              {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(createEditableLog(log))}
                              disabled={isProtected}
                              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLog(log)}
                              disabled={isProtected || deleteMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Apagar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function AdminSeguranca() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [tab, setTab] = useState<Tab>("sessions");
  const [superAdminOpen, setSuperAdminOpen] = useState(false);
  const { refetch: checkSuperAdminAccess } =
    trpc.security.getSuperAdminAccess.useQuery(undefined, {
      enabled: false,
      retry: false,
    });

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.ctrlKey ||
        !event.shiftKey ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      event.preventDefault();
      void checkSuperAdminAccess().then(result => {
        if (result.data?.granted) {
          setSuperAdminOpen(true);
        } else {
          toast.error("Acesso restrito ao Super ADM.");
        }
      });
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [checkSuperAdminAccess]);

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "sessions", label: "Sessões", icon: Monitor },
    { id: "logs", label: "Histórico de Atividades", icon: History },
  ];

  return (
    <DashboardLayout>
      <FadeIn>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(var(--primary-rgb, 124,58,237), 0.15)",
              }}
            >
              <Shield className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{
                  color: "var(--foreground)",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                Segurança
              </h1>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Sessões e histórico de atividades do sistema
              </p>
            </div>
          </div>

          <div
            className="flex gap-1 mb-6 p-1 rounded-xl"
            style={{
              background: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.04)",
            }}
          >
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background:
                    tab === t.id
                      ? isDark
                        ? "var(--card)"
                        : "#ffffff"
                      : "transparent",
                  color:
                    tab === t.id ? "var(--primary)" : "var(--muted-foreground)",
                  boxShadow:
                    tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "sessions" ? <SessionsTab /> : <AuditLogsTab />}
        </div>
      </FadeIn>
      <SuperAdminLogsPanel
        open={superAdminOpen}
        onOpenChange={setSuperAdminOpen}
      />
    </DashboardLayout>
  );
}
