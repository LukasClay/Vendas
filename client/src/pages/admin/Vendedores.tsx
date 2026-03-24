import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users, Pencil, Check, X, UserCheck, UserX,
  Plus, Eye, EyeOff, KeyRound, Shield, Loader2
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { motion, AnimatePresence } from "framer-motion";

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

function UserCard({ user, onDeactivate, onReactivate }: { user: any; onDeactivate: (id: number) => void; onReactivate: (id: number) => void }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditEmployeeForm>({ name: "", username: "", role: "user", active: true });
  const [isResetting, setIsResetting] = useState(false);
  const [resetForm, setResetForm] = useState<ResetForm>({ newPassword: "" });
  const [showResetPassword, setShowResetPassword] = useState(false);

  const updateUserMutation = trpc.ownAuth.updateUser.useMutation({
    onSuccess: () => {
      toast.success("Funcionário atualizado!");
      utils.users.listAll.invalidate();
      setIsEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.ownAuth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setIsResetting(false);
      setResetForm({ newPassword: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const startEditing = () => {
    setEditForm({
      name: user.name ?? user.displayName ?? "",
      username: user.username ?? "",
      role: user.role as "user" | "consultora" | "admin",
      active: user.active ?? true,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateUserMutation.mutate({
      userId: user.id,
      name: editForm.name || undefined,
      username: editForm.username || undefined,
      role: editForm.role,
    });
  };

  const inputStyle = {
    border: "1.5px solid var(--border)",
    background: "var(--secondary)",
    color: "var(--foreground)",
  };

  return (
    <div className="px-4 sm:px-6 py-4 transition-colors border-b last:border-0 border-[var(--border)]" style={{ opacity: user.active ? 1 : 0.6 }}>
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
          style={{
            background: user.role === "admin" 
              ? "linear-gradient(135deg, var(--primary), oklch(0.75 0.18 75))" 
              : user.role === "consultora"
                ? "linear-gradient(135deg, oklch(0.55 0.20 290), oklch(0.65 0.22 295))"
                : "oklch(0.30 0.05 265)"
          }}>
          {(user.displayName || user.name || "?").charAt(0).toUpperCase()}
        </div>

        {isEditing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <input type="text" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
              placeholder="nome_usuario" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as any }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
              <option value="user">Funcionário</option>
              <option value="consultora">Consultora</option>
              <option value="admin">Administrador</option>
            </select>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={handleSave} disabled={updateUserMutation.isPending}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold text-white bg-[var(--primary)] active:scale-95 disabled:opacity-50">
                {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </button>
              <button onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium bg-[var(--secondary)] text-[var(--foreground)] active:scale-95 border border-[var(--border)]">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-base" style={{ color: "var(--foreground)" }}>{user.displayName || user.name || "Sem nome"}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                style={{ 
                  background: isDark 
                    ? (user.role === "admin" ? "rgba(202, 138, 4, 0.15)" : user.role === "consultora" ? "rgba(139, 92, 246, 0.15)" : "rgba(59, 130, 246, 0.15)")
                    : (ROLE_COLORS[user.role] ?? ROLE_COLORS.user).bg,
                  color: isDark 
                    ? (user.role === "admin" ? "#eab308" : user.role === "consultora" ? "#a78bfa" : "#60a5fa")
                    : (ROLE_COLORS[user.role] ?? ROLE_COLORS.user).text
                }}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <p className="text-xs mt-0.5 text-[var(--muted-foreground)]">@{user.username || "sem-usuario"}</p>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={startEditing} className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-blue-500 border border-[var(--border)]"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => setIsResetting(true)} className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-orange-500 border border-[var(--border)]"><KeyRound className="w-4 h-4" /></button>
            {user.active ? (
              <button onClick={() => onDeactivate(user.id)} className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-red-500 border border-[var(--border)]"><UserX className="w-4 h-4" /></button>
            ) : (
              <button onClick={() => onReactivate(user.id)} className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-green-500 border border-[var(--border)]"><UserCheck className="w-4 h-4" /></button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isResetting && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)] space-y-4">
              <p className="text-sm font-bold text-[var(--foreground)]">Redefinir Senha</p>
              <div className="relative">
                <input type={showResetPassword ? "text" : "password"} value={resetForm.newPassword} onChange={e => setResetForm({ newPassword: e.target.value })}
                  placeholder="Nova senha (mín. 6 caracteres)" className="w-full px-3 py-2 pr-10 rounded-lg outline-none text-sm" style={inputStyle} />
                <button type="button" onClick={() => setShowResetPassword(!showResetPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)]">
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => resetPassword.mutate({ userId: user.id, newPassword: resetForm.newPassword })}
                  disabled={resetForm.newPassword.length < 6 || resetPassword.isPending}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-orange-500 disabled:opacity-50">
                  {resetPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                </button>
                <button onClick={() => setIsResetting(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]">Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Vendedores() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [showResetPassword, setShowResetPassword] = useState(false); // Adicionado para o formulário de novo funcionário
  const { data: users = [], isLoading, refetch } = trpc.users.listAll.useQuery();
  const [isAdding, setIsAdding] = useState(false);
  const [createRole, setCreateRole] = useState<"user" | "consultora" | "admin">("user");
  const [newForm, setNewForm] = useState<NewEmployeeForm>({ name: "", username: "", password: "", phone: "" });

  const createEmployee = trpc.ownAuth.createSeller.useMutation({
    onSuccess: () => {
      const label = ROLE_LABELS[createRole] ?? "Funcionário";
      toast.success(`${label} criado com sucesso!`);
      refetch();
      setIsAdding(false);
      setNewForm({ name: "", username: "", password: "", phone: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUserMutation = trpc.ownAuth.updateUser.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deactivateMutation = {
    mutate: (userId: number) => updateUserMutation.mutate({ userId, active: false }, { onSuccess: () => { toast.success("Acesso desativado"); refetch(); } }),
  };

  const reactivateMutation = {
    mutate: (userId: number) => updateUserMutation.mutate({ userId, active: true }, { onSuccess: () => { toast.success("Acesso reativado"); refetch(); } }),
  };

  const admins = users.filter(u => u.role === "admin");
  const employees = users.filter(u => u.role === "user");
  const consultoras = users.filter(u => u.role === "consultora");

  const inputStyle = { border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>Funcionários</h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Gerencie os acessos do sistema</p>
            </div>
            <motion.button onClick={() => setIsAdding(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
              style={{ background: "var(--primary)" }}>
              <Plus className="w-5 h-5" /> Novo Funcionário
            </motion.button>
          </div>
        </FadeIn>

        <AnimatePresence>
          {isAdding && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="p-6 rounded-2xl shadow-xl border border-[var(--border)] bg-[var(--card)] space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>Cadastrar Novo</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">Cargo *</label>
                  <select value={createRole} onChange={e => setCreateRole(e.target.value as "user" | "consultora" | "admin")}
                    className="w-full px-4 py-2.5 rounded-xl outline-none cursor-pointer" style={inputStyle}>
                    <option value="user">Funcionário (Vendedor)</option>
                    <option value="consultora">Consultora</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">Nome Completo</label>
                  <input type="text" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">Nome de Usuário</label>
                  <input type="text" value={newForm.username} onChange={e => setNewForm(f => ({ ...f, username: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl outline-none" style={inputStyle} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">Senha</label>
                  <div className="relative">
                    <input type={showResetPassword ? "text" : "password"} value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} className="w-full px-4 py-2.5 pr-10 rounded-xl outline-none" placeholder="Mínimo 6 caracteres" style={inputStyle} />
                    <button type="button" onClick={() => setShowResetPassword(!showResetPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted-foreground)]">
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold ml-1 text-[var(--muted-foreground)]">Telefone (opcional)</label>
                  <input type="tel" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl outline-none" style={inputStyle} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => createEmployee.mutate({ ...newForm, role: createRole })} disabled={createEmployee.isPending || newForm.name.length < 3 || newForm.username.length < 3 || newForm.password.length < 6}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-[var(--primary)] shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2">
                  {createEmployee.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
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
        ) : (
          <StaggerList>
            {admins.length > 0 && (
              <StaggerItem>
                <h2 className="text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>Administradores</h2>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl divide-y divide-[var(--border)]">
                  {admins.map((user) => (
                    <UserCard key={user.id} user={user} onDeactivate={deactivateMutation.mutate} onReactivate={reactivateMutation.mutate} />
                  ))}
                </div>
              </StaggerItem>
            )}

            {consultoras.length > 0 && (
              <StaggerItem>
                <h2 className="text-lg font-bold mt-6 mb-3" style={{ color: "var(--foreground)" }}>Consultoras</h2>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl divide-y divide-[var(--border)]">
                  {consultoras.map((user) => (
                    <UserCard key={user.id} user={user} onDeactivate={deactivateMutation.mutate} onReactivate={reactivateMutation.mutate} />
                  ))}
                </div>
              </StaggerItem>
            )}

            {employees.length > 0 && (
              <StaggerItem>
                <h2 className="text-lg font-bold mt-6 mb-3" style={{ color: "var(--foreground)" }}>Funcionários</h2>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl divide-y divide-[var(--border)]">
                  {employees.map((user) => (
                    <UserCard key={user.id} user={user} onDeactivate={deactivateMutation.mutate} onReactivate={reactivateMutation.mutate} />
                  ))}
                </div>
              </StaggerItem>
            )}

            {users.length === 0 && (
              <StaggerItem>
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
                  <Users className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Nenhum funcionário cadastrado.</p>
                </div>
              </StaggerItem>
            )}
          </StaggerList>
        )}
      </div>
    </DashboardLayout>
  );
}
