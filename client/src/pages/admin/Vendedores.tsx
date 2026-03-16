import { trpc } from "@/lib/trpc";
import { Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import {
  Users, Pencil, Check, X, Loader2, UserCheck, UserX,
  Plus, Eye, EyeOff, KeyRound, Shield
} from "lucide-react";

type NewSellerForm = { name: string; email: string; password: string; phone: string; role: "user" | "consultora" };
type ResetForm = { newPassword: string };

export default function AdminVendedores() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.listAll.useQuery();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", phone: "" });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createRole, setCreateRole] = useState<"user" | "consultora">("user");
  const [newSeller, setNewSeller] = useState<NewSellerForm>({ name: "", email: "", password: "", phone: "", role: "user" });
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [resetId, setResetId] = useState<number | null>(null);
  const [resetForm, setResetForm] = useState<ResetForm>({ newPassword: "" });
  const [showResetPassword, setShowResetPassword] = useState(false);

  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => { toast.success("Usuário atualizado!"); utils.users.listAll.invalidate(); setEditingId(null); },
    onError: (err) => toast.error(err.message),
  });

  const deactivateUser = trpc.users.deactivate.useMutation({
    onSuccess: () => { toast.success("Funcionário desativado."); utils.users.listAll.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const createSeller = trpc.ownAuth.createSeller.useMutation({
    onSuccess: () => {
      toast.success("Funcionário criado com sucesso!");
      utils.users.listAll.invalidate();
      setShowCreateForm(false);
      setNewSeller({ name: "", email: "", password: "", phone: "", role: "user" });
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

  const inputStyle = {
    background: "oklch(0.97 0.005 260)",
    border: "2px solid oklch(0.88 0.012 65)",
    color: "oklch(0.15 0.02 260)",
    fontSize: "15px",
  };

  const UserCard = ({ user }: { user: any }) => (
    <div className="px-6 py-4 transition-colors" style={{ opacity: user.active ? 1 : 0.55 }}
      onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
          style={{
            background: user.role === "admin"
              ? "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))"
              : "oklch(0.22 0.03 265)",
            color: "white",
          }}>
          {(user.displayName || user.name || "?").charAt(0).toUpperCase()}
        </div>

        {/* Info / Edit inline */}
        {editingId === user.id ? (
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={editForm.displayName}
              onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="Nome de exibição"
              className="px-3 py-1.5 rounded-lg text-sm outline-none flex-1 min-w-32"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
            />
            <input
              type="tel"
              value={editForm.phone}
              onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Telefone"
              className="px-3 py-1.5 rounded-lg text-sm outline-none w-36"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
            />
            <button onClick={() => updateUser.mutate({ id: user.id, displayName: editForm.displayName || undefined, phone: editForm.phone || undefined })}
              className="p-2 rounded-lg text-white" style={{ background: "oklch(0.55 0.15 160)" }}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditingId(null)} className="p-2 rounded-lg"
              style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>
                {user.displayName || user.name || "Sem nome"}
              </p>
              {user.role === "admin" && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                  <Shield className="w-3 h-3" /> Admin
                </span>
              )}
              {!user.active && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "oklch(0.93 0.04 30)", color: "oklch(0.55 0.20 30)" }}>
                  Inativo
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
              {user.email || "Sem email"}{user.phone && ` · ${user.phone}`}
            </p>
          </div>
        )}

        {/* Actions */}
        {editingId !== user.id && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setEditingId(user.id); setEditForm({ displayName: user.displayName ?? "", phone: user.phone ?? "" }); }}
              className="p-2 rounded-lg hover:bg-blue-50 transition-colors" style={{ color: "oklch(0.50 0.18 250)" }} title="Editar nome">
              <Pencil className="w-4 h-4" />
            </button>
            {user.role === "user" && (
              <button onClick={() => { setResetId(user.id); setResetForm({ newPassword: "" }); }}
                className="p-2 rounded-lg hover:bg-yellow-50 transition-colors" style={{ color: "oklch(0.60 0.13 65)" }} title="Redefinir senha">
                <KeyRound className="w-4 h-4" />
              </button>
            )}
            {user.active ? (
              <button onClick={() => deactivateUser.mutate({ id: user.id })}
                className="p-2 rounded-lg hover:bg-red-50 transition-colors" style={{ color: "oklch(0.58 0.22 25)" }} title="Desativar acesso">
                <UserX className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => updateUser.mutate({ id: user.id, active: true })}
                className="p-2 rounded-lg transition-colors" style={{ color: "oklch(0.55 0.15 160)" }} title="Reativar acesso">
                <UserCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reset password inline */}
      {resetId === user.id && (
        <div className="mt-3 ml-14 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <input
              type={showResetPassword ? "text" : "password"}
              value={resetForm.newPassword}
              onChange={e => setResetForm({ newPassword: e.target.value })}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full px-3 py-2 pr-10 rounded-lg text-sm outline-none"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.97 0.005 260)", color: "oklch(0.15 0.02 260)" }}
            />
            <button type="button" onClick={() => setShowResetPassword(!showResetPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.52 0.015 260)" }}>
              {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={() => resetPassword.mutate({ userId: user.id, newPassword: resetForm.newPassword })}
            disabled={resetForm.newPassword.length < 6 || resetPassword.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "oklch(0.60 0.13 65)" }}>
            {resetPassword.isPending ? "Salvando..." : "Salvar senha"}
          </button>
          <button onClick={() => setResetId(null)} className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Funcionários
            </h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
              Gerencie os funcionários do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setCreateRole("user"); setShowCreateForm(true); setNewSeller({ name: "", email: "", password: "", phone: "", role: "user" }); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-all active:scale-95 text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
              <Plus className="w-4 h-4" />
              Novo Funcionário
            </button>
            <button
              onClick={() => { setCreateRole("consultora"); setShowCreateForm(true); setNewSeller({ name: "", email: "", password: "", phone: "", role: "consultora" }); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-all active:scale-95 text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.18 290), oklch(0.55 0.20 295))" }}>
              <Plus className="w-4 h-4" />
              Nova Consultora
            </button>
          </div>
        </div>

        {/* Formulário de criação */}
        {showCreateForm && (
          <div className="rounded-2xl p-6 mb-6 shadow-sm" style={{ background: "white", border: "2px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-4" style={{ color: "oklch(0.15 0.02 260)" }}>
              {createRole === "consultora" ? "Cadastrar Nova Consultora" : "Cadastrar Novo Funcionário"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Nome completo *</label>
                <input
                  type="text"
                  value={newSeller.name}
                  onChange={e => setNewSeller(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do funcionário"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Email *</label>
                <input
                  type="email"
                  value={newSeller.email}
                  onChange={e => setNewSeller(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Senha *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newSeller.password}
                    onChange={e => setNewSeller(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 pr-12 rounded-xl outline-none"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.52 0.015 260)" }}>
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>Telefone (opcional)</label>
                <input
                  type="tel"
                  value={newSeller.phone}
                  onChange={e => setNewSeller(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => createSeller.mutate({ name: newSeller.name, email: newSeller.email, password: newSeller.password, phone: newSeller.phone || undefined, role: createRole })}
                disabled={!newSeller.name || !newSeller.email || newSeller.password.length < 6 || createSeller.isPending}
                className="px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
                {createSeller.isPending ? "Criando..." : createRole === "consultora" ? "Criar Consultora" : "Criar Funcionário"}
              </button>
              <button onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 rounded-xl font-semibold transition-all"
                style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
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
                  {admins.map(u => <UserCard key={u.id} user={u} />)}
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
                  {sellers.map(u => <UserCard key={u.id} user={u} />)}
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
                    Clique em "Nova Consultora" para cadastrar.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  {consultoras.map(u => <UserCard key={u.id} user={u} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
