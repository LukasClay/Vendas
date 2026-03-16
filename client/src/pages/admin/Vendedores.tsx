import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Pencil, Check, X, Loader2, Crown, UserCheck, UserX } from "lucide-react";

export default function AdminVendedores() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.listAll.useQuery();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", phone: "" });

  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado!");
      utils.users.listAll.invalidate();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateUser = trpc.users.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Usuário desativado.");
      utils.users.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const promoteUser = trpc.users.promoteToAdmin.useMutation({
    onSuccess: () => {
      toast.success("Usuário promovido a administrador!");
      utils.users.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ displayName: user.displayName ?? "", phone: user.phone ?? "" });
  };

  const sellers = users.filter(u => u.role === "user");
  const admins = users.filter(u => u.role === "admin");

  const UserCard = ({ user }: { user: any }) => (
    <div className="flex items-center gap-4 px-6 py-4 transition-colors"
      style={{ opacity: user.active ? 1 : 0.5 }}
      onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
        style={{
          background: user.role === "admin" ? "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" : "oklch(0.22 0.03 265)",
          color: "white",
        }}>
        {(user.displayName || user.name || "?").charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      {editingId === user.id ? (
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={editForm.displayName}
            onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder="Nome de exibição"
            className="px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 flex-1 min-w-32"
            style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
          />
          <input
            type="tel"
            value={editForm.phone}
            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Telefone"
            className="px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 w-36"
            style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
          />
          <button
            onClick={() => updateUser.mutate({ id: user.id, displayName: editForm.displayName || undefined, phone: editForm.phone || undefined })}
            className="p-2 rounded-lg text-white"
            style={{ background: "oklch(0.55 0.15 160)" }}>
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="p-2 rounded-lg"
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
                <Crown className="w-3 h-3" />
                Admin
              </span>
            )}
            {!user.active && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.93 0.04 30)", color: "oklch(0.55 0.20 30)" }}>
                Inativo
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
            {user.email || "Sem email"}
            {user.phone && ` · ${user.phone}`}
          </p>
        </div>
      )}

      {/* Actions */}
      {editingId !== user.id && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => startEdit(user)}
            className="p-2 rounded-lg transition-colors hover:bg-blue-50"
            style={{ color: "oklch(0.50 0.18 250)" }}
            title="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          {user.role === "user" && user.active && (
            <button
              onClick={() => promoteUser.mutate({ id: user.id })}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "oklch(0.60 0.13 65)" }}
              title="Promover a Admin">
              <Crown className="w-4 h-4" />
            </button>
          )}
          {user.active ? (
            <button
              onClick={() => deactivateUser.mutate({ id: user.id })}
              className="p-2 rounded-lg transition-colors hover:bg-red-50"
              style={{ color: "oklch(0.58 0.22 25)" }}
              title="Desativar">
              <UserX className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => updateUser.mutate({ id: user.id, active: true })}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "oklch(0.55 0.15 160)" }}
              title="Reativar">
              <UserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Gestão de Usuários
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
            Gerencie vendedores e administradores do sistema
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
          style={{ background: "oklch(0.94 0.02 65)", border: "1px solid oklch(0.88 0.012 65)" }}>
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "oklch(0.60 0.13 65)" }}>
            <span className="text-white text-xs font-bold">i</span>
          </div>
          <p className="text-sm" style={{ color: "oklch(0.35 0.02 260)" }}>
            Os vendedores são adicionados automaticamente ao sistema quando fazem login pela primeira vez.
            Aqui você pode editar o nome de exibição, promover a administrador ou desativar o acesso.
          </p>
        </div>

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
                  <Crown className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Administradores</h2>
                  <span className="ml-auto text-sm px-3 py-1 rounded-full"
                    style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                    {admins.length}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  {admins.map(user => <UserCard key={user.id} user={user} />)}
                </div>
              </div>
            )}

            {/* Vendedores */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
                <Users className="w-4 h-4" style={{ color: "oklch(0.50 0.18 250)" }} />
                <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Vendedores</h2>
                <span className="ml-auto text-sm px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.92 0.04 250)", color: "oklch(0.35 0.15 250)" }}>
                  {sellers.length}
                </span>
              </div>
              {sellers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <Users className="w-10 h-10 mb-3" style={{ color: "oklch(0.75 0.06 65)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Nenhum vendedor cadastrado</p>
                  <p className="text-xs mt-1 text-center" style={{ color: "oklch(0.60 0.01 260)" }}>
                    Os vendedores aparecem aqui após fazerem login pela primeira vez.
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  {sellers.map(user => <UserCard key={user.id} user={user} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
