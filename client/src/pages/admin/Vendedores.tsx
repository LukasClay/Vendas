import { trpc } from "@/lib/trpc";
import { Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import {
  Users, Pencil, Check, X, Loader2, UserCheck, UserX,
  Plus, Eye, EyeOff, KeyRound, Shield
} from "lucide-react";

type NewEmployeeForm = { name: string; username: string; password: string; phone: string };
type EditEmployeeForm = { name: string; username: string; role: "user" | "consultora" | "admin"; active: boolean };
type ResetForm = { newPassword: string };

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

const inputStyle = {
  border: "1.5px solid oklch(0.88 0.012 65)",
  background: "oklch(0.98 0.006 65)",
  color: "oklch(0.15 0.02 260)",
  fontSize: "16px",
};

// ─── UserCard definido FORA do componente principal para evitar re-criação a cada render ───
type UserCardProps = {
  user: any;
  editingId: number | null;
  editForm: EditEmployeeForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditEmployeeForm>>;
  setEditingId: (id: number | null) => void;
  onSave: (userId: number) => void;
  isSaving: boolean;
  resetId: number | null;
  resetForm: ResetForm;
  setResetForm: React.Dispatch<React.SetStateAction<ResetForm>>;
  setResetId: (id: number | null) => void;
  showResetPassword: boolean;
  setShowResetPassword: (v: boolean) => void;
  onReset: (userId: number) => void;
  isResetting: boolean;
  onDeactivate: (id: number) => void;
  onReactivate: (id: number) => void;
};

function UserCard({
  user,
  editingId,
  editForm,
  setEditForm,
  setEditingId,
  onSave,
  isSaving,
  resetId,
  resetForm,
  setResetForm,
  setResetId,
  showResetPassword,
  setShowResetPassword,
  onReset,
  isResetting,
  onDeactivate,
  onReactivate,
}: UserCardProps) {
  const roleColor = ROLE_COLORS[user.role] ?? ROLE_COLORS.user;
  const isEditing = editingId === user.id;
  const isResettingThis = resetId === user.id;

  return (
    <div
      className="px-4 sm:px-6 py-4 transition-colors"
      style={{ opacity: user.active ? 1 : 0.55 }}
      onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
          style={{
            background:
              user.role === "admin"
                ? "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))"
                : user.role === "consultora"
                  ? "linear-gradient(135deg, oklch(0.50 0.18 290), oklch(0.60 0.20 295))"
                  : "oklch(0.22 0.03 265)",
            color: "white",
          }}
        >
          {(user.displayName || user.name || "?").charAt(0).toUpperCase()}
        </div>

        {/* Info / Edit inline */}
        {isEditing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <input
              type="text"
              value={editForm.username}
              onChange={e => setEditForm(f => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }))}
              placeholder="nome_usuario"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <select
              value={editForm.role}
              onChange={e => setEditForm(f => ({ ...f, role: e.target.value as "user" | "consultora" | "admin" }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              <option value="user">Funcionário</option>
              <option value="consultora">Consultora</option>
              <option value="admin">Administrador</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSave(user.id)}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50 active:scale-95"
                style={{ background: "oklch(0.55 0.15 160)", fontSize: "16px" }}
              >
                <Check className="w-3.5 h-3.5" /> Salvar
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm active:scale-95"
                style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)", fontSize: "16px" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>
                {user.displayName || user.name || "Sem nome"}
              </p>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: roleColor.bg, color: roleColor.text }}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {!user.active && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "oklch(0.93 0.04 30)", color: "oklch(0.55 0.20 30)" }}
                >
                  Inativo
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
              @{user.username || user.email || "sem-usuario"}
            </p>
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              onClick={() => {
                setEditingId(user.id);
                setEditForm({
                  name: user.name ?? user.displayName ?? "",
                  username: user.username ?? "",
                  role: user.role as "user" | "consultora" | "admin",
                  active: user.active ?? true,
                });
              }}
              className="p-2.5 sm:p-2 rounded-lg hover:bg-blue-50 transition-colors"
              style={{ color: "oklch(0.50 0.18 250)" }}
              title="Editar funcionário"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setResetId(user.id); setResetForm({ newPassword: "" }); }}
              className="p-2.5 sm:p-2 rounded-lg hover:bg-yellow-50 transition-colors"
              style={{ color: "oklch(0.60 0.13 65)" }}
              title="Redefinir senha"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            {user.active ? (
              <button
                onClick={() => onDeactivate(user.id)}
                className="p-2.5 sm:p-2 rounded-lg hover:bg-red-50 transition-colors"
                style={{ color: "oklch(0.58 0.22 25)" }}
                title="Desativar acesso"
              >
                <UserX className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onReactivate(user.id)}
                className="p-2.5 sm:p-2 rounded-lg transition-colors"
                style={{ color: "oklch(0.55 0.15 160)" }}
                title="Reativar acesso"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reset password inline */}
      {isResettingThis && (
        <div className="mt-3 ml-0 sm:ml-14 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showResetPassword ? "text" : "password"}
              value={resetForm.newPassword}
              onChange={e => setResetForm({ newPassword: e.target.value })}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full px-3 py-2.5 pr-10 rounded-lg outline-none"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowResetPassword(!showResetPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "oklch(0.52 0.015 260)" }}
            >
              {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReset(user.id)}
              disabled={resetForm.newPassword.length < 6 || isResetting}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-semibold text-white transition-all disabled:opacity-50 active:scale-95"
              style={{ background: "oklch(0.60 0.13 65)", fontSize: "16px" }}
            >
              {isResetting ? "Salvando..." : "Salvar senha"}
            </button>
            <button
              onClick={() => setResetId(null)}
              className="flex-1 sm:flex-none px-3 py-2.5 rounded-lg active:scale-95"
              style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)", fontSize: "16px" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function AdminVendedores() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.listAll.useQuery();

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditEmployeeForm>({ name: "", username: "", role: "user", active: true });

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createRole, setCreateRole] = useState<"user" | "consultora" | "admin">("user");
  const [newEmployee, setNewEmployee] = useState<NewEmployeeForm>({ name: "", username: "", password: "", phone: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Reset password state
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetForm, setResetForm] = useState<ResetForm>({ newPassword: "" });
  const [showResetPassword, setShowResetPassword] = useState(false);

  const updateUserMutation = trpc.ownAuth.updateUser.useMutation({
    onSuccess: () => {
      toast.success("Funcionário atualizado!");
      utils.users.listAll.invalidate();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateUser = trpc.users.deactivate.useMutation({
    onSuccess: () => { toast.success("Funcionário desativado."); utils.users.listAll.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const reactivateUser = trpc.users.update.useMutation({
    onSuccess: () => { toast.success("Funcionário reativado."); utils.users.listAll.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const createEmployee = trpc.ownAuth.createSeller.useMutation({
    onSuccess: () => {
      const label = ROLE_LABELS[createRole] ?? "Funcionário";
      toast.success(`${label} criado com sucesso!`);
      utils.users.listAll.invalidate();
      setShowCreateForm(false);
      setNewEmployee({ name: "", username: "", password: "", phone: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.ownAuth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setResetId(null);
      setResetForm({ newPassword: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const sellers = users.filter(u => u.role === "user");
  const consultoras = users.filter(u => u.role === "consultora");
  const admins = users.filter(u => u.role === "admin");

  const cardProps = {
    editingId,
    editForm,
    setEditForm,
    setEditingId,
    onSave: (userId: number) =>
      updateUserMutation.mutate({
        userId,
        name: editForm.name || undefined,
        username: editForm.username || undefined,
        role: editForm.role,
      }),
    isSaving: updateUserMutation.isPending,
    resetId,
    resetForm,
    setResetForm,
    setResetId,
    showResetPassword,
    setShowResetPassword,
    onReset: (userId: number) =>
      resetPassword.mutate({ userId, newPassword: resetForm.newPassword }),
    isResetting: resetPassword.isPending,
    onDeactivate: (id: number) => deactivateUser.mutate({ id }),
    onReactivate: (id: number) => reactivateUser.mutate({ id, active: true }),
  };

  const selectStyle = {
    ...inputStyle,
    cursor: "pointer",
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}
            >
              Funcionários
            </h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
              Gerencie os funcionários do sistema
            </p>
          </div>
          <button
            onClick={() => {
              setCreateRole("user");
              setShowCreateForm(true);
              setNewEmployee({ name: "", username: "", password: "", phone: "" });
            }}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-semibold text-white transition-all active:scale-95 text-sm"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))", fontSize: "16px" }}
          >
            <Plus className="w-4 h-4" />
            Novo Funcionário
          </button>
        </div>

        {/* Formulário de criação */}
        {showCreateForm && (
          <div className="rounded-2xl p-4 sm:p-6 mb-6 shadow-sm" style={{ background: "white", border: "2px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-4" style={{ color: "oklch(0.15 0.02 260)" }}>
              Novo Funcionário
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Cargo *</label>
                <select
                  value={createRole}
                  onChange={e => setCreateRole(e.target.value as "user" | "consultora" | "admin")}
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={selectStyle}
                >
                  <option value="user">Funcionário (Vendedor)</option>
                  <option value="consultora">Consultora</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Nome completo *</label>
                <input
                  type="text"
                  value={newEmployee.name}
                  onChange={e => setNewEmployee(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do funcionário"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                  Nome de usuário *
                  <span className="ml-1 text-xs font-normal" style={{ color: "oklch(0.55 0.01 260)" }}>(para fazer login)</span>
                </label>
                <input
                  type="text"
                  value={newEmployee.username}
                  onChange={e => setNewEmployee(f => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() }))}
                  placeholder="ex: joao_silva"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={inputStyle}
                />
                <p className="text-xs mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>
                  Apenas letras, números e _ (sem espaços)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Senha *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newEmployee.password}
                    onChange={e => setNewEmployee(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 pr-12 rounded-xl outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "oklch(0.52 0.015 260)" }}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Telefone (opcional)</label>
                <input
                  type="tel"
                  value={newEmployee.phone}
                  onChange={e => setNewEmployee(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                onClick={() =>
                  createEmployee.mutate({
                    name: newEmployee.name,
                    username: newEmployee.username,
                    password: newEmployee.password,
                    phone: newEmployee.phone || undefined,
                    role: createRole,
                  })
                }
                disabled={
                  !newEmployee.name ||
                  newEmployee.username.length < 3 ||
                  newEmployee.password.length < 6 ||
                  createEmployee.isPending
                }
                className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 active:scale-95"
                style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))", fontSize: "16px" }}
              >
                {createEmployee.isPending ? "Criando..." : `Criar ${ROLE_LABELS[createRole]}`}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)", fontSize: "16px" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.60 0.13 65)" }} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Administradores */}
            {admins.length > 0 && (
              <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
                <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
                  <Shield className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Administradores</h2>
                  <span className="ml-auto text-sm px-3 py-1 rounded-full"
                    style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                    {admins.length}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  {admins.map(u => <UserCard key={u.id} user={u} {...cardProps} />)}
                </div>
              </div>
            )}

            {/* Funcionários */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
                <Users className="w-4 h-4" style={{ color: "oklch(0.50 0.18 250)" }} />
                <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Funcionários</h2>
                <span className="ml-auto text-sm px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.92 0.04 250)", color: "oklch(0.35 0.15 250)" }}>
                  {sellers.length}
                </span>
              </div>
              {sellers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <Users className="w-10 h-10 mb-3" style={{ color: "oklch(0.75 0.06 65)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Nenhum funcionário cadastrado</p>
                  <p className="text-xs mt-1 text-center" style={{ color: "oklch(0.60 0.01 260)" }}>
                    Clique em "Novo Funcionário" para cadastrar o primeiro funcionário.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  {sellers.map(u => <UserCard key={u.id} user={u} {...cardProps} />)}
                </div>
              )}
            </div>

            {/* Consultoras */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "oklch(0.50 0.18 290)" }} />
                <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Consultoras</h2>
                <span className="ml-auto text-sm px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.93 0.04 290)", color: "oklch(0.40 0.18 290)" }}>
                  {consultoras.length}
                </span>
              </div>
              {consultoras.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <Sparkles className="w-10 h-10 mb-3" style={{ color: "oklch(0.75 0.06 290)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Nenhuma consultora cadastrada</p>
                  <p className="text-xs mt-1 text-center" style={{ color: "oklch(0.60 0.01 260)" }}>
                    Clique em "Novo Funcionário" e selecione o cargo "Consultora".
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  {consultoras.map(u => <UserCard key={u.id} user={u} {...cardProps} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
