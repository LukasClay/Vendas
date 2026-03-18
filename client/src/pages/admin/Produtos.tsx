import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Check, X, Loader2, ToggleLeft, ToggleRight, Star, Users } from "lucide-react";

type Category = "individual" | "promocao" | "coletivo";

const CATEGORY_TABS: { key: Category; label: string; color: string; bg: string; icon?: React.ReactNode }[] = [
  { key: "individual", label: "Individuais", color: "oklch(0.55 0.12 65)", bg: "oklch(0.94 0.02 65)" },
  { key: "promocao",   label: "Promoção",    color: "oklch(0.50 0.18 25)",  bg: "oklch(0.95 0.05 25)" },
  { key: "coletivo",   label: "Coletivos",   color: "oklch(0.45 0.15 260)", bg: "oklch(0.94 0.03 260)" },
];

function CategoryBadge({ category }: { category: Category }) {
  if (category === "individual") return null;
  if (category === "promocao") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: "oklch(0.95 0.05 25)", color: "oklch(0.50 0.18 25)", border: "1px solid oklch(0.88 0.08 25)" }}>
      <Star className="w-3 h-3" /> Promoção
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: "oklch(0.94 0.03 260)", color: "oklch(0.45 0.15 260)", border: "1px solid oklch(0.86 0.06 260)" }}>
      <Users className="w-3 h-3" /> Coletivo
    </span>
  );
}

export default function AdminProdutos() {
  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.products.listAll.useQuery();

  const [activeTab, setActiveTab] = useState<Category>("individual");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "individual" as Category });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Trabalho adicionado com sucesso!");
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setShowForm(false);
      setForm({ name: "", description: "", category: activeTab });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Trabalho atualizado!");
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setEditingId(null);
      setShowForm(false);
      setForm({ name: "", description: "", category: activeTab });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Trabalho removido.");
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setDeletingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
    if (editingId) {
      updateProduct.mutate({ id: editingId, name: form.name.trim(), description: form.description || undefined, category: form.category });
    } else {
      createProduct.mutate({ name: form.name.trim(), description: form.description || undefined, category: form.category });
    }
  };

  const startEdit = (product: any) => {
    setEditingId(product.id);
    setForm({ name: product.name, description: product.description ?? "", category: product.category ?? "individual" });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", description: "", category: activeTab });
  };

  const openNewForm = () => {
    setEditingId(null);
    setForm({ name: "", description: "", category: activeTab });
    setShowForm(true);
  };

  // Filtra por aba ativa, excluindo Consulta Cartas
  const filtered = products.filter(p => p.name !== "Consulta Cartas" && (p.category ?? "individual") === activeTab);
  const activeTab_ = CATEGORY_TABS.find(t => t.key === activeTab)!;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Trabalhos Espirituais
            </h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
              Gerencie os trabalhos disponíveis no formulário de vendas
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-95 shadow-md"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))", fontSize: "16px" }}>
            <Plus className="w-4 h-4" />
            Novo Trabalho
          </button>
        </div>

        {/* Abas de categoria */}
        <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: "oklch(0.94 0.012 65)" }}>
          {CATEGORY_TABS.map(tab => {
            const count = products.filter(p => p.name !== "Consulta Cartas" && (p.category ?? "individual") === tab.key).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setShowForm(false); setEditingId(null); }}
                className="flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: isActive ? "white" : "transparent",
                  color: isActive ? tab.color : "oklch(0.52 0.015 260)",
                  boxShadow: isActive ? "0 1px 4px oklch(0 0 0 / 0.08)" : "none",
                }}>
                {tab.label}
                <span className="ml-1.5 text-xs font-normal opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="rounded-2xl p-4 sm:p-6 mb-5 shadow-sm" style={{ background: "white", border: `1.5px solid ${activeTab_.color}40` }}>
            <h2 className="font-semibold mb-4" style={{ color: "oklch(0.15 0.02 260)" }}>
              {editingId ? "Editar Trabalho" : "Adicionar Novo Trabalho"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                  Nome do Trabalho <span style={{ color: "oklch(0.58 0.22 25)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Trabalho de Amor, Limpeza Espiritual..."
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2"
                  style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                  Categoria
                </label>
                <div className="flex gap-2">
                  {CATEGORY_TABS.map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: tab.key }))}
                      className="flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all border"
                      style={{
                        background: form.category === tab.key ? tab.bg : "white",
                        color: form.category === tab.key ? tab.color : "oklch(0.52 0.015 260)",
                        borderColor: form.category === tab.key ? tab.color + "60" : "oklch(0.88 0.012 65)",
                        fontWeight: form.category === tab.key ? 600 : 400,
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "oklch(0.30 0.02 260)" }}>
                  Descrição (opcional)
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição breve do trabalho..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none"
                  style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createProduct.isPending || updateProduct.isPending}
                  className="flex-1 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
                  {(createProduct.isPending || updateProduct.isPending) ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      {editingId ? "Salvar Alterações" : "Adicionar"}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-5 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
                  style={{ background: "oklch(0.94 0.012 65)", color: "oklch(0.30 0.02 260)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista filtrada por aba */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <span>Trabalhos — {activeTab_.label}</span>
              <CategoryBadge category={activeTab} />
            </h2>
            <span className="text-sm px-3 py-1 rounded-full" style={{ background: activeTab_.bg, color: activeTab_.color }}>
              {filtered.filter(p => p.active).length} ativos
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.60 0.13 65)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "oklch(0.95 0.008 65)" }}>
                <Package className="w-8 h-8" style={{ color: "oklch(0.75 0.06 65)" }} />
              </div>
              <p className="text-base font-medium mb-1" style={{ color: "oklch(0.30 0.02 260)" }}>
                Nenhum trabalho {activeTab_.label.toLowerCase()} cadastrado
              </p>
              <p className="text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>
                Clique em "Novo Trabalho" para adicionar.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
              {filtered.map(product => (
                <div key={product.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 transition-colors"
                  style={{ opacity: product.active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: product.active ? activeTab_.bg : "oklch(0.92 0.008 65)" }}>
                    <Package className="w-5 h-5" style={{ color: product.active ? activeTab_.color : "oklch(0.65 0.01 260)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{product.name}</p>
                    {product.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "oklch(0.52 0.015 260)" }}>{product.description}</p>
                    )}
                    {!product.active && (
                      <span className="text-xs" style={{ color: "oklch(0.58 0.22 25)" }}>Inativo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button
                      onClick={() => updateProduct.mutate({ id: product.id, active: !product.active })}
                      className="p-2 rounded-lg transition-colors"
                      title={product.active ? "Desativar" : "Ativar"}
                      style={{ color: product.active ? "oklch(0.55 0.15 160)" : "oklch(0.60 0.01 260)" }}>
                      {product.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => startEdit(product)}
                      className="p-2 rounded-lg transition-colors hover:bg-blue-50"
                      style={{ color: "oklch(0.50 0.18 250)" }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    {deletingId === product.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteProduct.mutate({ id: product.id })}
                          className="p-2 rounded-lg text-white text-xs font-medium"
                          style={{ background: "oklch(0.58 0.22 25)" }}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-2 rounded-lg text-xs font-medium"
                          style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(product.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50"
                        style={{ color: "oklch(0.58 0.22 25)" }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
