import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users,
  Pencil,
  X,
  UserCheck,
  UserX,
  XCircle,
  Plus,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { motion, AnimatePresence } from "framer-motion";

type NewEmployeeForm = {
  name: string;
  username: string;
  password: string;
  phone: string;
};
type EditEmployeeForm = {
  name: string;
  username: string;
  role: "user" | "consultora" | "admin";
  active: boolean;
  monthlyGoal: string;
};
type ResetForm = { newPassword: string };
type LocalLoginHealth =
  | "ok"
  | "missing_username"
  | "missing_password_hash"
  | "inactive"
  | "deleted";
type AdminUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "consultora" | "admin";
  displayName: string | null;
  phone: string | null;
  active: boolean;
  username: string | null;
  monthlyGoal: string | null;
  createdAt: Date | string;
  lastSignedIn: Date | string;
  canUseLocalLogin: boolean;
  localLoginHealth: LocalLoginHealth;
  localLoginMessage: string;
};

const MIN_PASSWORD_LENGTH = 8;

const ROLE_LABELS: Record<string, string> = {
  user: "Funcionário",
  consultora: "Consultora",
  admin: "Administrador",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  user: { bg: "oklch(0.92 0.04 250)", text: "oklch(0.35 0.15 250)" },
  consultora: { bg: "oklch(0.93 0.04 290)", text: "oklch(0.40 0.18 290)" },
  admin: { bg: "oklch(0.94 0.02 65)", text: "oklch(0.45 0.10 65)" },
};

const LOCAL_LOGIN_BADGES: Record<
  LocalLoginHealth,
  { label: string; className: string }
> = {
  ok: { label: "Login OK", className: "bg-emerald-500/10 text-emerald-600" },
  missing_username: {
    label: "Sem usuário",
    className: "bg-amber-500/10 text-amber-600",
  },
  missing_password_hash: {
    label: "Sem senha",
    className: "bg-red-500/10 text-red-500",
  },
  inactive: {
    label: "Desativado",
    className: "bg-slate-500/10 text-slate-500",
  },
  deleted: { label: "Excluído", className: "bg-slate-500/10 text-slate-500" },
};

function UserCard({
  user,
  onDeactivate,
  onReactivate,
  isDeactivatedTab,
}: {
  user: AdminUser;
  onDeactivate: (id: number) => void;
  onReactivate: (id: number) => void;
  isDeactivatedTab?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditEmployeeForm>({
    name: "",
    username: "",
    role: "user",
    active: true,
    monthlyGoal: "",
  });
  const [isResetting, setIsResetting] = useState(false);
  const [resetForm, setResetForm] = useState<ResetForm>({ newPassword: "" });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "deactivate" | "reactivate" | null
  >(null);

  const updateUserMutation = trpc.ownAuth.updateUser.useMutation({
    onSuccess: () => {
      toast.success("Funcionário atualizado!");
      utils.users.listAll.invalidate();
      setIsEditing(false);
    },
    onError: err => toast.error(err.message),
  });

  const resetPassword = trpc.ownAuth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      utils.users.listAll.invalidate();
      setIsResetting(false);
      setResetForm({ newPassword: "" });
    },
    onError: err => toast.error(err.message),
  });

  const startEditing = () => {
    setEditForm({
      name: user.name ?? user.displayName ?? "",
      username: user.username ?? "",
      role: user.role,
      active: user.active ?? true,
      monthlyGoal: user.monthlyGoal ? String(Number(user.monthlyGoal)) : "",
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    const goalVal = editForm.monthlyGoal.trim();
    const monthlyGoal = goalVal === "" ? null : Number(goalVal);
    updateUserMutation.mutate({
      userId: user.id,
      name: editForm.name || undefined,
      username: editForm.username || undefined,
      role: editForm.role,
      monthlyGoal: isNaN(monthlyGoal as number) ? null : monthlyGoal,
    });
  };

  const inputStyle = {
    border: "1.5px solid var(--border)",
    background: "var(--secondary)",
    color: "var(--foreground)",
  };
  const localLoginBadge = LOCAL_LOGIN_BADGES[user.localLoginHealth];
  const showLocalLoginMessage = user.localLoginHealth !== "ok";
  const isResetPasswordTooShort =
    resetForm.newPassword.length > 0 &&
    resetForm.newPassword.length < MIN_PASSWORD_LENGTH;

  return (
    <div
      className="px-4 sm:px-6 py-4 transition-colors border-b last:border-0 border-[var(--border)]"
      style={{ opacity: isDeactivatedTab ? 0.7 : 1 }}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
          style={{
            background: isDeactivatedTab
              ? "oklch(0.50 0.02 265)"
              : user.role === "admin"
                ? "linear-gradient(135deg, var(--primary), oklch(0.75 0.18 75))"
                : user.role === "consultora"
                  ? "linear-gradient(135deg, oklch(0.55 0.20 290), oklch(0.65 0.22 295))"
                  : "oklch(0.30 0.05 265)",
          }}
        >
          {(user.displayName || user.name || "?").charAt(0).toUpperCase()}
        </div>

        {isEditing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input
              type="text"
              value={editForm.name}
              onChange={e =>
                setEditForm(form => ({ ...form, name: e.target.value }))
              }
              placeholder="Nome completo"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <input
              type="text"
              value={editForm.username}
              onChange={e =>
                setEditForm(form => ({ ...form, username: e.target.value }))
              }
              placeholder="nome_usuario"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <select
              value={editForm.role}
              onChange={e =>
                setEditForm(form => ({
                  ...form,
                  role: e.target.value as EditEmployeeForm["role"],
                }))
              }
              className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="user">Funcionário</option>
              <option value="consultora">Consultora</option>
              <option value="admin">Administrador</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editForm.monthlyGoal}
              onChange={e =>
                setEditForm(form => ({ ...form, monthlyGoal: e.target.value }))
              }
              placeholder="Meta mensal (R$) — opcional"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleSave}
                disabled={updateUserMutation.isPending}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold text-white bg-[var(--primary)] active:scale-95 disabled:opacity-50"
              >
                {updateUserMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium bg-[var(--secondary)] text-[var(--foreground)] active:scale-95 border border-[var(--border)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="font-bold text-base"
                style={{ color: "var(--foreground)" }}
              >
                {user.displayName || user.name || "Sem nome"}
              </p>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                style={{
                  background: isDark
                    ? user.role === "admin"
                      ? "rgba(202, 138, 4, 0.15)"
                      : user.role === "consultora"
                        ? "rgba(139, 92, 246, 0.15)"
                        : "rgba(59, 130, 246, 0.15)"
                    : (ROLE_COLORS[user.role] ?? ROLE_COLORS.user).bg,
                  color: isDark
                    ? user.role === "admin"
                      ? "#eab308"
                      : user.role === "consultora"
                        ? "#a78bfa"
                        : "#60a5fa"
                    : (ROLE_COLORS[user.role] ?? ROLE_COLORS.user).text,
                }}
              >
                {ROLE_LABELS[user.role] || user.role}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${localLoginBadge.className}`}
              >
                {localLoginBadge.label}
              </span>
            </div>
            <p className="text-xs mt-0.5 text-[var(--muted-foreground)]">
              @{user.username || "sem-usuario"}
            </p>
            {user.monthlyGoal && Number(user.monthlyGoal) > 0 && (
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                Meta:{" "}
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                  {Number(user.monthlyGoal).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                /mês
              </p>
            )}
            {showLocalLoginMessage && (
              <p
                className="text-xs mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                {user.localLoginMessage}
              </p>
            )}
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            {!isDeactivatedTab && (
              <>
                <button
                  onClick={startEditing}
                  className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-blue-500 border border-[var(--border)]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsResetting(true)}
                  className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-orange-500 border border-[var(--border)]"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              </>
            )}
            {user.active ? (
              confirmAction === "deactivate" ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-red-500">
                    Desativar?
                  </span>
                  <button
                    onClick={() => {
                      onDeactivate(user.id);
                      setConfirmAction(null);
                    }}
                    className="p-2 rounded-lg bg-red-500 text-white border border-red-600 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)] transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmAction("deactivate")}
                  className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-red-500 border border-[var(--border)]"
                >
                  <UserX className="w-4 h-4" />
                </button>
              )
            ) : confirmAction === "reactivate" ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-green-500">
                  Reativar?
                </span>
                <button
                  onClick={() => {
                    onReactivate(user.id);
                    setConfirmAction(null);
                  }}
                  className="p-2 rounded-lg bg-green-500 text-white border border-green-600 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)] transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("reactivate")}
                className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-green-500 border border-[var(--border)]"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isResetting && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)] space-y-4">
              <p className="text-sm font-bold text-[var(--foreground)]">
                Redefinir Senha
              </p>
              <div className="relative">
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={resetForm.newPassword}
                  onChange={e => setResetForm({ newPassword: e.target.value })}
                  placeholder="Nova senha (mín. 8 caracteres)"
                  className="w-full px-3 py-2 pr-10 rounded-lg outline-none text-sm"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)]"
                >
                  {showResetPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {isResetPasswordTooShort && (
                <p className="text-xs text-red-500">
                  A senha deve ter no mínimo 8 caracteres.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    resetPassword.mutate({
                      userId: user.id,
                      newPassword: resetForm.newPassword,
                    })
                  }
                  disabled={
                    resetForm.newPassword.length < MIN_PASSWORD_LENGTH ||
                    resetPassword.isPending
                  }
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-orange-500 disabled:opacity-50"
                >
                  {resetPassword.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Confirmar"
                  )}
                </button>
                <button
                  onClick={() => setIsResetting(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Vendedores() {
  const [showResetPassword, setShowResetPassword] = useState(false);
  const usersQuery = trpc.users.listAll.useQuery();
  const users = (usersQuery.data ?? []) as AdminUser[];
  const { isLoading, refetch } = usersQuery;
  const [isAdding, setIsAdding] = useState(false);
  const [createRole, setCreateRole] = useState<"user" | "consultora" | "admin">(
    "user"
  );
  const [newForm, setNewForm] = useState<NewEmployeeForm>({
    name: "",
    username: "",
    password: "",
    phone: "",
  });
  const [activeTab, setActiveTab] = useState<"active" | "deactivated">(
    "active"
  );

  const createEmployee = trpc.ownAuth.createSeller.useMutation({
    onSuccess: () => {
      const label = ROLE_LABELS[createRole] || "Funcionário";
      toast.success(`${label} criado com sucesso!`);
      refetch();
      setIsAdding(false);
      setNewForm({ name: "", username: "", password: "", phone: "" });
    },
    onError: err => toast.error(err.message),
  });

  const updateUserMutation = trpc.ownAuth.updateUser.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: err => toast.error(err.message),
  });

  const deactivateMutation = {
    mutate: (userId: number) =>
      updateUserMutation.mutate(
        { userId, active: false },
        {
          onSuccess: () => {
            toast.success("Acesso desativado");
            refetch();
          },
        }
      ),
  };

  const reactivateMutation = {
    mutate: (userId: number) =>
      updateUserMutation.mutate(
        { userId, active: true },
        {
          onSuccess: () => {
            toast.success("Acesso reativado");
            refetch();
          },
        }
      ),
  };

  const activeUsers = users.filter(user => user.active);
  const deactivatedUsers = users.filter(user => !user.active);
  const loginRiskCount = activeUsers.filter(
    user => user.localLoginHealth !== "ok"
  ).length;
  const createPasswordTooShort =
    newForm.password.length > 0 &&
    newForm.password.length < MIN_PASSWORD_LENGTH;

  const groupByRole = (list: AdminUser[]) => ({
    admins: list.filter(user => user.role === "admin"),
    consultoras: list.filter(user => user.role === "consultora"),
    employees: list.filter(user => user.role === "user"),
  });

  const activeGroups = groupByRole(activeUsers);
  const deactivatedGroups = groupByRole(deactivatedUsers);

  const inputStyle = {
    border: "1.5px solid var(--border)",
    background: "var(--secondary)",
    color: "var(--foreground)",
  };

  const renderUserGroup = (
    title: string,
    userList: AdminUser[],
    isDeactivatedTab: boolean
  ) => {
    if (userList.length === 0) return null;
    return (
      <StaggerItem key={title}>
        <h2
          className="text-lg font-bold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl divide-y divide-[var(--border)]">
          {userList.map(user => (
            <UserCard
              key={user.id}
              user={user}
              onDeactivate={deactivateMutation.mutate}
              onReactivate={reactivateMutation.mutate}
              isDeactivatedTab={isDeactivatedTab}
            />
          ))}
        </div>
      </StaggerItem>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  color: "var(--foreground)",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                Funcionários
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Gerencie os acessos do sistema
              </p>
              <p
                className="text-sm mt-2 font-medium"
                style={{
                  color:
                    loginRiskCount > 0
                      ? "oklch(0.58 0.18 25)"
                      : "oklch(0.45 0.12 145)",
                }}
              >
                {loginRiskCount === 0
                  ? "0 contas com risco de login"
                  : `${loginRiskCount} contas com risco de login`}
              </p>
            </div>
            <motion.button
              onClick={() => setIsAdding(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
              style={{ background: "var(--primary)" }}
            >
              <Plus className="w-5 h-5" /> Novo Funcionário
            </motion.button>
          </div>
        </FadeIn>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--secondary)] border border-[var(--border)] w-fit">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "active"
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Ativos
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-bold">
                {activeUsers.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab("deactivated")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "deactivated"
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <UserX className="w-4 h-4" />
              Desativados
              {deactivatedUsers.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold">
                  {deactivatedUsers.length}
                </span>
              )}
            </span>
          </button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 rounded-2xl shadow-xl border border-[var(--border)] bg-[var(--card)] space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2
                  className="font-bold text-lg"
                  style={{ color: "var(--foreground)" }}
                >
                  Cadastrar Novo
                </h2>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-2 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">
                    Cargo *
                  </label>
                  <select
                    value={createRole}
                    onChange={e =>
                      setCreateRole(
                        e.target.value as "user" | "consultora" | "admin"
                      )
                    }
                    className="w-full px-4 py-2.5 rounded-xl outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="user">Funcionário (Vendedor)</option>
                    <option value="consultora">Consultora</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={newForm.name}
                    onChange={e =>
                      setNewForm(form => ({ ...form, name: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl outline-none"
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={newForm.username}
                    onChange={e =>
                      setNewForm(form => ({
                        ...form,
                        username: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl outline-none"
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={newForm.password}
                      onChange={e =>
                        setNewForm(form => ({
                          ...form,
                          password: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 pr-10 rounded-xl outline-none"
                      placeholder="Mínimo 8 caracteres"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)]"
                    >
                      {showResetPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {createPasswordTooShort && (
                    <p className="text-xs text-red-500">
                      A senha deve ter no mínimo 8 caracteres.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">
                    Telefone (opcional)
                  </label>
                  <input
                    type="tel"
                    value={newForm.phone}
                    onChange={e =>
                      setNewForm(form => ({ ...form, phone: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() =>
                    createEmployee.mutate({ ...newForm, role: createRole })
                  }
                  disabled={
                    createEmployee.isPending ||
                    newForm.name.length < 3 ||
                    newForm.username.length < 3 ||
                    newForm.password.length < MIN_PASSWORD_LENGTH
                  }
                  className="px-6 py-3 rounded-xl font-bold text-white bg-[var(--primary)] shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {createEmployee.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  Criar {ROLE_LABELS[createRole]}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted-foreground)]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            <p className="text-sm font-medium">Carregando funcionários...</p>
          </div>
        ) : activeTab === "active" ? (
          <StaggerList>
            {renderUserGroup("Administradores", activeGroups.admins, false)}
            {activeGroups.consultoras.length > 0 && <div className="mt-6" />}
            {renderUserGroup("Consultoras", activeGroups.consultoras, false)}
            {activeGroups.employees.length > 0 && <div className="mt-6" />}
            {renderUserGroup("Funcionários", activeGroups.employees, false)}
            {activeUsers.length === 0 && (
              <StaggerItem>
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
                  <Users className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">
                    Nenhum funcionário ativo.
                  </p>
                </div>
              </StaggerItem>
            )}
          </StaggerList>
        ) : (
          <StaggerList>
            {deactivatedUsers.length === 0 ? (
              <StaggerItem>
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
                  <UserX className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--muted-foreground)]">
                      Nenhum funcionário desativado.
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1 opacity-60">
                      Funcionários desativados aparecerão aqui.
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ) : (
              <>
                {renderUserGroup(
                  "Administradores",
                  deactivatedGroups.admins,
                  true
                )}
                {deactivatedGroups.consultoras.length > 0 && (
                  <div className="mt-6" />
                )}
                {renderUserGroup(
                  "Consultoras",
                  deactivatedGroups.consultoras,
                  true
                )}
                {deactivatedGroups.employees.length > 0 && (
                  <div className="mt-6" />
                )}
                {renderUserGroup(
                  "Funcionários",
                  deactivatedGroups.employees,
                  true
                )}
              </>
            )}
          </StaggerList>
        )}
      </div>
    </DashboardLayout>
  );
}
