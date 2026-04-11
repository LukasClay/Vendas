import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Check,
  X,
  Loader2,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Search,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function AdminProdutos() {
  const utils = trpc.useUtils();
  const { data: allProducts = [], isLoading } =
    trpc.products.listAllWithDeleted.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    allowedCategories: ["individual", "promocao", "coletivo"] as string[],
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "inactive" | "trash">(
    "active"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Normaliza texto removendo acentos para busca mais intuitiva
  const normalize = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // Filtrar produtos do sistema (ex: Consulta Cartas)
  const displayProducts = allProducts.filter(p => !(p as any).isSystem);

  // Aplicar busca
  const searchedProducts = searchQuery.trim()
    ? displayProducts.filter(p =>
        normalize(p.name).includes(normalize(searchQuery))
      )
    : displayProducts;

  // Separar por estado
  const activeProducts = searchedProducts.filter(p => p.active && !p.deletedAt);
  const inactiveProducts = searchedProducts.filter(
    p => !p.active && !p.deletedAt
  );
  const deletedProducts = searchedProducts.filter(p => p.deletedAt);

  const createProduct = trpc.products.create.useMutation({
    onSuccess: data => {
      if ((data as any).restored) {
        toast.success("Trabalho restaurado com sucesso!");
      } else {
        toast.success("Trabalho adicionado com sucesso!");
      }
      utils.products.listAllWithDeleted.invalidate();
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setShowForm(false);
      setForm({
        name: "",
        description: "",
        allowedCategories: ["individual", "promocao", "coletivo"],
      });
    },
    onError: err => toast.error(err.message),
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Trabalho atualizado!");
      utils.products.listAllWithDeleted.invalidate();
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setEditingId(null);
      setShowForm(false);
      setForm({
        name: "",
        description: "",
        allowedCategories: ["individual", "promocao", "coletivo"],
      });
    },
    onError: err => toast.error(err.message),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Trabalho removido.");
      utils.products.listAllWithDeleted.invalidate();
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setDeletingId(null);
    },
    onError: err => toast.error(err.message),
  });

  const restoreProduct = trpc.products.restore.useMutation({
    onSuccess: () => {
      toast.success("Trabalho restaurado!");
      utils.products.listAllWithDeleted.invalidate();
      utils.products.listAll.invalidate();
      utils.products.list.invalidate();
      setRestoringId(null);
    },
    onError: err => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (form.allowedCategories.length === 0) {
      toast.error("Selecione pelo menos 1 tipo permitido.");
      return;
    }
    if (editingId) {
      updateProduct.mutate({
        id: editingId,
        name: form.name.trim(),
        description: form.description || undefined,
        allowedCategories: form.allowedCategories as (
          | "individual"
          | "promocao"
          | "coletivo"
        )[],
      });
    } else {
      createProduct.mutate({
        name: form.name.trim(),
        description: form.description || undefined,
        allowedCategories: form.allowedCategories as (
          | "individual"
          | "promocao"
          | "coletivo"
        )[],
      });
    }
  };

  const startEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? "",
      allowedCategories: product.allowedCategories ?? [
        "individual",
        "promocao",
        "coletivo",
      ],
    });
    setShowForm(true);
    setActiveTab("active");
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      allowedCategories: ["individual", "promocao", "coletivo"],
    });
  };

  const currentProducts =
    activeTab === "active"
      ? activeProducts
      : activeTab === "inactive"
        ? inactiveProducts
        : deletedProducts;

  const emptyMessages: Record<string, { title: string; subtitle: string }> = {
    active: {
      title: "Nenhum trabalho ativo",
      subtitle: 'Clique em "Novo Trabalho" para adicionar.',
    },
    inactive: {
      title: "Nenhum trabalho inativo",
      subtitle: "Trabalhos desativados aparecerão aqui.",
    },
    trash: {
      title: "Lixeira vazia",
      subtitle: "Trabalhos excluídos aparecerão aqui.",
    },
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "var(--foreground)",
              }}
            >
              Trabalhos Espirituais
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Gerencie os trabalhos disponíveis no formulário de vendas
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({
                name: "",
                description: "",
                allowedCategories: ["individual", "promocao", "coletivo"],
              });
              setShowForm(true);
              setActiveTab("active");
            }}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-95 shadow-md"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))",
              fontSize: "16px",
            }}
          >
            <Plus className="w-4 h-4" />
            Novo Trabalho
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div
            className="rounded-2xl p-4 sm:p-6 mb-5 shadow-sm"
            style={{
              background: "var(--card)",
              border: "1.5px solid var(--border)",
            }}
          >
            <h2
              className="font-semibold mb-4"
              style={{ color: "var(--foreground)" }}
            >
              {editingId ? "Editar Trabalho" : "Adicionar Novo Trabalho"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--foreground)" }}
                >
                  Nome do Trabalho{" "}
                  <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Amarração, Limpeza, Broxamento..."
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2"
                  style={{
                    border: "1.5px solid var(--border)",
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                  }}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--foreground)" }}
                >
                  Descrição (opcional)
                </label>
                <textarea
                  value={form.description}
                  onChange={e =>
                    setForm(f => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Descrição breve do trabalho..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 resize-none"
                  style={{
                    border: "1.5px solid var(--border)",
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Tipos Permitidos{" "}
                  <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { value: "individual", label: "Individual", icon: "" },
                      { value: "promocao", label: "Promoção", icon: "⭐ " },
                      { value: "coletivo", label: "Coletivo", icon: "👥 " },
                    ] as const
                  ).map(opt => {
                    const checked = form.allowedCategories.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setForm(f => {
                            const cats = checked
                              ? f.allowedCategories.filter(c => c !== opt.value)
                              : [...f.allowedCategories, opt.value];
                            return { ...f, allowedCategories: cats };
                          });
                        }}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 border-2"
                        style={
                          checked
                            ? {
                                background:
                                  opt.value === "promocao"
                                    ? "#ede8de"
                                    : opt.value === "coletivo"
                                      ? "#e0e0f8"
                                      : "#ddd5c4",
                                color:
                                  opt.value === "promocao"
                                    ? "#7a5518"
                                    : opt.value === "coletivo"
                                      ? "#4040b0"
                                      : "#2a2a40",
                                borderColor:
                                  opt.value === "promocao"
                                    ? "#c4a030"
                                    : opt.value === "coletivo"
                                      ? "#4a70c0"
                                      : "#737390",
                              }
                            : {
                                background: "var(--secondary)",
                                color: "var(--muted-foreground)",
                                borderColor: "var(--border)",
                              }
                        }
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {form.allowedCategories.length === 0 && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--destructive)" }}
                  >
                    Selecione pelo menos 1 tipo.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createProduct.isPending || updateProduct.isPending}
                  className="flex-1 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))",
                  }}
                >
                  {createProduct.isPending || updateProduct.isPending ? (
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
                  style={{
                    background: "var(--muted)",
                    color: "var(--foreground)",
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Barra de busca */}
        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar trabalho..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
            style={{
              border: "1.5px solid var(--border)",
              background: "var(--secondary)",
              color: "var(--foreground)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl mb-5"
          style={{
            background: "var(--secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "active" ? "shadow-sm" : "hover:opacity-80"
            }`}
            style={
              activeTab === "active"
                ? { background: "var(--card)", color: "var(--foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Ativos
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: "oklch(0.55 0.15 160 / 0.1)",
                  color: "oklch(0.55 0.15 160)",
                }}
              >
                {activeProducts.length}
              </span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab("inactive")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "inactive" ? "shadow-sm" : "hover:opacity-80"
            }`}
            style={
              activeTab === "inactive"
                ? { background: "var(--card)", color: "var(--foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            <span className="flex items-center gap-2">
              <ToggleLeft className="w-4 h-4" />
              Inativos
              {inactiveProducts.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: "oklch(0.60 0.18 65 / 0.1)",
                    color: "oklch(0.55 0.18 65)",
                  }}
                >
                  {inactiveProducts.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("trash")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "trash" ? "shadow-sm" : "hover:opacity-80"
            }`}
            style={
              activeTab === "trash"
                ? { background: "var(--card)", color: "var(--foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Lixeira
              {deletedProducts.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: "oklch(0.58 0.22 25 / 0.1)",
                    color: "oklch(0.58 0.22 25)",
                  }}
                >
                  {deletedProducts.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Lista de trabalhos */}
        <div
          className="rounded-2xl shadow-sm overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            <h2
              className="font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {activeTab === "active"
                ? "Trabalhos Ativos"
                : activeTab === "inactive"
                  ? "Trabalhos Inativos"
                  : "Trabalhos Excluídos"}
            </h2>
            <span
              className="text-sm px-3 py-1 rounded-full"
              style={{
                background: "var(--secondary)",
                color: "var(--primary)",
              }}
            >
              {currentProducts.length}{" "}
              {currentProducts.length === 1 ? "trabalho" : "trabalhos"}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "oklch(0.60 0.13 65)" }}
              />
            </div>
          ) : currentProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "var(--secondary)" }}
              >
                <Package
                  className="w-8 h-8"
                  style={{ color: "var(--muted-foreground)" }}
                />
              </div>
              <p
                className="text-base font-medium mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {emptyMessages[activeTab].title}
              </p>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {emptyMessages[activeTab].subtitle}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {currentProducts.map(product => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 transition-colors"
                  style={{ opacity: activeTab === "active" ? 1 : 0.7 }}
                  onMouseEnter={e =>
                    (e.currentTarget.style.background = isDark
                      ? "var(--secondary)"
                      : "oklch(0.98 0.006 65)")
                  }
                  onMouseLeave={e =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background:
                        activeTab === "active"
                          ? "var(--secondary)"
                          : "var(--muted)",
                    }}
                  >
                    <Package
                      className="w-5 h-5"
                      style={{
                        color:
                          activeTab === "active"
                            ? "var(--primary)"
                            : "var(--muted-foreground)",
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm"
                      style={{ color: "var(--foreground)" }}
                    >
                      {product.name}
                    </p>
                    {product.description && (
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {product.description}
                      </p>
                    )}
                    {activeTab === "inactive" && (
                      <span
                        className="text-xs font-bold"
                        style={{ color: "oklch(0.55 0.18 65)" }}
                      >
                        Inativo
                      </span>
                    )}
                    {activeTab === "trash" && (
                      <span
                        className="text-xs font-bold"
                        style={{ color: "oklch(0.58 0.22 25)" }}
                      >
                        Excluído
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {/* Aba Ativos: toggle + editar + excluir */}
                    {activeTab === "active" && (
                      <>
                        {togglingId === product.id ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: "oklch(0.55 0.18 65)" }}
                            >
                              Desativar?
                            </span>
                            <button
                              onClick={() => {
                                updateProduct.mutate({
                                  id: product.id,
                                  active: false,
                                });
                                setTogglingId(null);
                              }}
                              className="p-2 rounded-lg text-white"
                              style={{ background: "oklch(0.55 0.18 65)" }}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setTogglingId(null)}
                              className="p-2 rounded-lg"
                              style={{
                                background: "var(--muted)",
                                color: "var(--foreground)",
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setTogglingId(product.id)}
                            className="p-2 rounded-lg transition-colors"
                            title="Desativar"
                            style={{ color: "oklch(0.55 0.15 160)" }}
                          >
                            <ToggleRight className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(product)}
                          className="p-2 rounded-lg transition-colors hover:bg-blue-50"
                          style={{ color: "oklch(0.50 0.18 250)" }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deletingId === product.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                deleteProduct.mutate({ id: product.id })
                              }
                              className="p-2 rounded-lg text-white text-xs font-medium"
                              style={{ background: "oklch(0.58 0.22 25)" }}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="p-2 rounded-lg text-xs font-medium"
                              style={{
                                background: "var(--muted)",
                                color: "var(--foreground)",
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(product.id)}
                            className="p-2 rounded-lg transition-colors hover:bg-red-50"
                            style={{ color: "oklch(0.58 0.22 25)" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}

                    {/* Aba Inativos: reativar + excluir */}
                    {activeTab === "inactive" && (
                      <>
                        {togglingId === product.id ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: "oklch(0.55 0.15 160)" }}
                            >
                              Ativar?
                            </span>
                            <button
                              onClick={() => {
                                updateProduct.mutate({
                                  id: product.id,
                                  active: true,
                                });
                                setTogglingId(null);
                              }}
                              className="p-2 rounded-lg text-white"
                              style={{ background: "oklch(0.55 0.15 160)" }}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setTogglingId(null)}
                              className="p-2 rounded-lg"
                              style={{
                                background: "var(--muted)",
                                color: "var(--foreground)",
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setTogglingId(product.id)}
                            className="p-2 rounded-lg transition-colors"
                            title="Reativar"
                            style={{ color: "oklch(0.55 0.15 160)" }}
                          >
                            <ToggleLeft className="w-5 h-5" />
                          </button>
                        )}
                        {deletingId === product.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                deleteProduct.mutate({ id: product.id })
                              }
                              className="p-2 rounded-lg text-white text-xs font-medium"
                              style={{ background: "oklch(0.58 0.22 25)" }}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="p-2 rounded-lg text-xs font-medium"
                              style={{
                                background: "var(--muted)",
                                color: "var(--foreground)",
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(product.id)}
                            className="p-2 rounded-lg transition-colors hover:bg-red-50"
                            style={{ color: "oklch(0.58 0.22 25)" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}

                    {/* Aba Lixeira: restaurar */}
                    {activeTab === "trash" && (
                      <>
                        {restoringId === product.id ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: "oklch(0.55 0.15 160)" }}
                            >
                              Restaurar?
                            </span>
                            <button
                              onClick={() => {
                                restoreProduct.mutate({ id: product.id });
                                setRestoringId(null);
                              }}
                              className="p-2 rounded-lg text-white"
                              style={{ background: "oklch(0.55 0.15 160)" }}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setRestoringId(null)}
                              className="p-2 rounded-lg"
                              style={{
                                background: "var(--muted)",
                                color: "var(--foreground)",
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRestoringId(product.id)}
                            className="p-2 rounded-lg transition-colors"
                            title="Restaurar"
                            style={{ color: "oklch(0.55 0.15 160)" }}
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        )}
                      </>
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
