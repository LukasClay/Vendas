import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo, useRef, useEffect } from "react";
import { FileText, ExternalLink, Filter, X, Pencil, Trash2, Check, History, Calendar, Loader2, Download, Search, FileSpreadsheet, Paperclip, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { motion, AnimatePresence } from "framer-motion";
import { CompanyBadge } from "@/components/CompanySwitch";

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toInputDate(date: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

const inputStyle = {
  border: "1.5px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--foreground)",
  fontSize: "14px",
};

// ─── Modal de edição ──────────────────────────────────────────────────────────
function EditSaleModal({ sale, sellers, onClose }: { sale: any; sellers: any[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const products = trpc.products.list.useQuery();

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductForm, setAddProductForm] = useState({
    name: "",
    description: "",
    allowedCategories: ["individual", "promocao", "coletivo"] as string[],
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Trabalho adicionado à lista!");
      utils.products.list.invalidate();
      setShowAddProduct(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const [editForm, setEditForm] = useState({
    clientName: sale.clientName ?? "",
    clientBirthDate: toInputDate(sale.clientBirthDate),
    clientPhone: sale.clientPhone ?? "",
    productName: sale.productName ?? "",
    productCategory: (sale.productCategory ?? "individual") as "individual" | "promocao" | "coletivo",
    saleDate: toInputDate(sale.saleDate),
    amount: sale.amount ? String(Number(sale.amount)) : "",
    notes: sale.notes ?? "",
    sellerId: sale.sellerId ? String(sale.sellerId) : "",
  });

  const isNameMissing = !!editForm.productName && !!products.data && !products.data.find(p => p.name === editForm.productName);

  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products.data) return [];
    const q = editForm.productName.toLowerCase();
    return products.data.filter(p => p.name.toLowerCase().includes(q));
  }, [products.data, editForm.productName]);

  const openAddProduct = () => {
    setAddProductForm({ name: editForm.productName, description: "", allowedCategories: ["individual", "promocao", "coletivo"] });
    setShowAddProduct(true);
  };

  // Estado do upload de comprovante
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande. Máximo 5MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(f.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WEBP ou PDF.");
      return;
    }
    setFile(f);
  };

  const updateSale = trpc.sales.update.useMutation({
    onSuccess: () => {
      toast.success("Venda atualizada com sucesso!");
      utils.sales.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpdate = async () => {
    let attachmentBase64: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentName: string | undefined;

    if (file) {
      attachmentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      attachmentMime = file.type;
      attachmentName = file.name;
    }

    updateSale.mutate({
      id: sale.id,
      clientName: editForm.clientName || undefined,
      clientBirthDate: editForm.clientBirthDate || undefined,
      clientPhone: editForm.clientPhone || undefined,
      productName: editForm.productName || undefined,
      productCategory: editForm.productCategory,
      saleDate: editForm.saleDate || undefined,
      amount: editForm.amount ? Number(editForm.amount) : undefined,
      notes: editForm.notes || undefined,
      sellerId: editForm.sellerId ? Number(editForm.sellerId) : undefined,
      attachmentBase64,
      attachmentMime,
      attachmentName,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]"
        style={{ background: "var(--card)" }}>
        
        <div className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}>
          <h2 className="font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
            Editar Venda
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Nome do cliente</label>
              <input type="text" value={editForm.clientName} onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Nascimento</label>
              <input type="date" value={editForm.clientBirthDate} onChange={e => setEditForm(f => ({ ...f, clientBirthDate: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Telefone</label>
              <input type="tel" value={editForm.clientPhone} onChange={e => setEditForm(f => ({ ...f, clientPhone: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} />
            </div>
            <div ref={comboboxRef} className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Trabalho</label>
              <input
                type="text"
                value={editForm.productName}
                onChange={e => { setEditForm(f => ({ ...f, productName: e.target.value })); setShowProductDropdown(true); }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="Digite ou selecione um trabalho..."
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                style={{ ...inputStyle, borderColor: isNameMissing ? "#ef4444" : "var(--border)" }}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 rounded-xl shadow-lg border border-[var(--border)] overflow-hidden max-h-48 overflow-y-auto"
                  style={{ background: "var(--card)" }}>
                  {filteredProducts.map(p => (
                    <li key={p.id}
                      onMouseDown={() => { setEditForm(f => ({ ...f, productName: p.name })); setShowProductDropdown(false); }}
                      className="px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--secondary)] transition-colors"
                      style={{ color: "var(--foreground)" }}>
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
              {isNameMissing && (
                <div className="mt-2 p-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                      Este trabalho não está na lista de produtos. Deseja atualizar a venda mesmo assim?
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, productName: sale.productName ?? "" }))}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                      Cancelar
                    </button>
                    <button type="button" onClick={openAddProduct}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
                      Adicionar esse trabalho
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Tipo de Trabalho</label>
              <select value={editForm.productCategory} onChange={e => setEditForm(f => ({ ...f, productCategory: e.target.value as "individual" | "promocao" | "coletivo" }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all cursor-pointer" style={inputStyle}>
                <option value="individual">Individual</option>
                <option value="promocao">Promoção ⭐</option>
                <option value="coletivo">Coletivo 👥</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Data da venda</label>
              <input type="date" value={editForm.saleDate} onChange={e => setEditForm(f => ({ ...f, saleDate: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Vendedor</label>
              <select value={editForm.sellerId} onChange={e => setEditForm(f => ({ ...f, sellerId: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all cursor-pointer" style={inputStyle}>
                <option value="">Manter atual</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.displayName || s.name || s.email}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Observações</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Observações opcionais..."
                className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all resize-none" style={inputStyle} />
            </div>

            {/* ── Comprovante ── */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">Comprovante</label>

              {/* Comprovante atual (se existir e nenhum novo foi selecionado) */}
              {sale.attachmentUrl && !file && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] mb-2">
                  <Paperclip className="w-4 h-4 shrink-0 text-amber-500" />
                  <span className="text-xs text-[var(--muted-foreground)] flex-1 truncate">Comprovante atual</span>
                  <a href={sale.attachmentUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold hover:underline shrink-0" style={{ color: "var(--primary)" }}>
                    Ver
                  </a>
                </div>
              )}

              {/* Novo arquivo selecionado */}
              {file ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10">
                  <FileText className="w-4 h-4 shrink-0 text-amber-500" />
                  <span className="text-xs font-medium text-[var(--foreground)] flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-[var(--muted-foreground)] shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button type="button" onClick={() => setFile(null)}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--primary)] transition-all text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                  <Upload className="w-4 h-4" />
                  {sale.attachmentUrl ? "Trocar comprovante" : "Adicionar comprovante"}
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-6 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold transition-all bg-[var(--secondary)] text-[var(--foreground)] active:scale-95 uppercase tracking-widest text-xs">
            Cancelar
          </button>
          <button onClick={handleUpdate} disabled={updateSale.isPending}
            className="flex-[2] py-4 rounded-2xl font-bold text-white transition-all bg-[var(--primary)] shadow-lg shadow-orange-500/20 active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
            {updateSale.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </motion.div>

      {/* Sub-modal: Adicionar Novo Trabalho */}
      {showAddProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddProduct(false); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]"
            style={{ background: "var(--card)" }}>
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                Adicionar Novo Trabalho
              </h2>
              <button onClick={() => setShowAddProduct(false)} className="p-2 rounded-xl bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  Nome do Trabalho <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <input type="text" value={addProductForm.name}
                  onChange={e => setAddProductForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Amarração, Limpeza, Broxamento..."
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  style={{ border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
                  autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  Descrição (opcional)
                </label>
                <textarea value={addProductForm.description}
                  onChange={e => setAddProductForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição breve do trabalho..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                  style={{ border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Tipos Permitidos <span style={{ color: "var(--destructive)" }}>*</span>
                </label>
                <div className="flex gap-2">
                  {([
                    { value: "individual", label: "Individual", icon: "" },
                    { value: "promocao", label: "Promoção", icon: "⭐ " },
                    { value: "coletivo", label: "Coletivo", icon: "👥 " },
                  ] as const).map(opt => {
                    const checked = addProductForm.allowedCategories.includes(opt.value);
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setAddProductForm(f => ({
                          ...f,
                          allowedCategories: checked
                            ? f.allowedCategories.filter(c => c !== opt.value)
                            : [...f.allowedCategories, opt.value],
                        }))}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 border-2"
                        style={checked
                          ? { background: opt.value === "promocao" ? "#ede8de" : opt.value === "coletivo" ? "#e0e0f8" : "#ddd5c4",
                              color: opt.value === "promocao" ? "#7a5518" : opt.value === "coletivo" ? "#4040b0" : "#2a2a40",
                              borderColor: opt.value === "promocao" ? "#c4a030" : opt.value === "coletivo" ? "#4a70c0" : "#737390" }
                          : { background: "var(--secondary)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
                        }>
                        {opt.icon}{opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-5 border-t" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setShowAddProduct(false)}
                className="px-5 py-3 rounded-xl font-bold transition-all bg-[var(--secondary)] text-[var(--foreground)] active:scale-95">
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (!addProductForm.name.trim()) { toast.error("Nome é obrigatório."); return; }
                  if (addProductForm.allowedCategories.length === 0) { toast.error("Selecione pelo menos 1 tipo."); return; }
                  createProduct.mutate({
                    name: addProductForm.name.trim(),
                    description: addProductForm.description || undefined,
                    allowedCategories: addProductForm.allowedCategories as ("individual" | "promocao" | "coletivo")[],
                  });
                }}
                disabled={createProduct.isPending}
                className="flex-1 py-3 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
                {createProduct.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function AdminVendas() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();
  const { data: sellers = [] } = trpc.users.listAll.useQuery();
  const { data: products = [] } = trpc.products.listAll.useQuery();

  const [filters, setFilters] = useState({ startDate: "", endDate: "", sellerId: "", productName: "", category: "" });
  const [showFilters, setShowFilters] = useState(false);
  
  const queryFilters = useMemo(() => ({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sellerId: filters.sellerId ? Number(filters.sellerId) : undefined,
    productName: filters.productName || undefined,
    limit: 200,
  }), [filters.startDate, filters.endDate, filters.sellerId, filters.productName]);

  const { data: rawSalesData = [], isLoading } = trpc.sales.list.useQuery(queryFilters);

  const salesData = useMemo(() => {
    if (!filters.category) return rawSalesData;
    return rawSalesData.filter((item: any) => {
      const sale = item.sale ?? item;
      return (sale.productCategory ?? "individual") === filters.category;
    });
  }, [rawSalesData, filters.category]);

  // Exportar Excel e PDF
  const [exportLoading, setExportLoading] = useState(false);

  async function handleExportExcel() {
    if (salesData.length === 0) { toast.error("Nenhuma venda para exportar."); return; }
    setExportLoading(true);
    try {
      const XLSX = await import("xlsx");
      const rows = salesData.map((item: any) => {
        const sale = item.sale ?? item;
        const seller = item.seller;
        return {
          "Data da Venda": formatDate(sale.saleDate),
          "Cliente": sale.clientName ?? "",
          "Telefone": sale.clientPhone ?? "",
          "Data Nascimento": sale.clientBirthDate ? formatDate(sale.clientBirthDate) : "",
          "Trabalho": sale.productName ?? "",
          "Categoria": sale.productCategory ?? "individual",
          "Vendedor": seller?.displayName || seller?.name || sale.sellerName || "",
          "Empresa": sale.company === "mundo_cigano" ? "Mundo Cigano" : "Mundo Da Magia",
          "Valor (R$)": Number(sale.amount) || 0,
          "Observações": sale.notes ?? "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendas");
      const colWidths = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length, 15) }));
      ws["!cols"] = colWidths;
      XLSX.writeFile(wb, `vendas_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} vendas exportadas para Excel!`);
    } catch { toast.error("Erro ao exportar Excel."); }
    finally { setExportLoading(false); }
  }

  async function handleExportPDF() {
    if (salesData.length === 0) { toast.error("Nenhuma venda para exportar."); return; }
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text("Relatório de Vendas", 14, 15);
      const period = [filters.startDate, filters.endDate].filter(Boolean).join(" até ");
      if (period) { doc.setFontSize(10); doc.text(`Período: ${period}`, 14, 23); }

      const total = salesData.reduce((acc: number, item: any) => acc + Number((item.sale ?? item).amount), 0);
      doc.setFontSize(11);
      doc.text(`Total: ${formatCurrency(total)}   |   Vendas: ${salesData.length}`, 14, period ? 30 : 23);

      const rows = salesData.map((item: any) => {
        const sale = item.sale ?? item;
        const seller = item.seller;
        return [
          formatDate(sale.saleDate),
          sale.clientName ?? "",
          sale.clientPhone ?? "",
          sale.productName ?? "",
          seller?.displayName || seller?.name || sale.sellerName || "",
          sale.company === "mundo_cigano" ? "M. Cigano" : "M. Magia",
          formatCurrency(sale.amount),
        ];
      });

      autoTable(doc, {
        startY: period ? 36 : 29,
        head: [["Data", "Cliente", "Telefone", "Trabalho", "Vendedor", "Empresa", "Valor"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [153, 102, 51], textColor: 255 },
        alternateRowStyles: { fillColor: [252, 249, 245] },
      });

      doc.save(`vendas_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`${rows.length} vendas exportadas para PDF!`);
    } catch { toast.error("Erro ao exportar PDF."); }
    finally { setExportLoading(false); }
  }
  const [editSale, setEditSale] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Estado do modal de histórico de cliente
  const [historyClientName, setHistoryClientName] = useState<string | null>(null);
  const { data: clientHistory, isLoading: loadingHistory } = trpc.sales.clientHistory.useQuery(
    { clientName: historyClientName! },
    { enabled: !!historyClientName }
  );

  const deleteSale = trpc.sales.delete.useMutation({
    onSuccess: () => { toast.success("Venda excluída"); utils.sales.list.invalidate(); setDeleteConfirmId(null); },
    onError: (err) => toast.error(err.message)
  });

  const openEdit = (item: any) => {
    const sale = item.sale ?? item;
    setEditSale(sale);
  };

  const totalAmount = salesData.reduce((acc: number, item: any) => {
    const sale = item.sale ?? item;
    return acc + Number(sale.amount);
  }, 0);

  const hasFilters = filters.startDate || filters.endDate || filters.sellerId || filters.productName || filters.category;
  const clearFilters = () => setFilters({ startDate: "", endDate: "", sellerId: "", productName: "", category: "" });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <FadeIn>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>Histórico de Vendas</h1>
              <p className="text-sm mt-1 text-[var(--muted-foreground)]">Gerencie e filtre todos os registros do sistema</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters(!showFilters)} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${showFilters ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)]'}`}>
                <Filter className="w-4 h-4" />
                Filtros
              </button>
              <button onClick={handleExportExcel} disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all bg-green-600 text-white shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50">
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Excel
              </button>
              <button onClick={handleExportPDF} disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all bg-red-600 text-white shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50">
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </button>
            </div>
          </div>
        </FadeIn>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Início</label>
                  <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl outline-none border border-[var(--border)] bg-[var(--secondary)] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Fim</label>
                  <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl outline-none border border-[var(--border)] bg-[var(--secondary)] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Vendedor</label>
                  <select value={filters.sellerId} onChange={e => setFilters(f => ({ ...f, sellerId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl outline-none border border-[var(--border)] bg-[var(--secondary)] text-sm cursor-pointer">
                    <option value="">Todos</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.displayName || s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Categoria</label>
                  <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl outline-none border border-[var(--border)] bg-[var(--secondary)] text-sm cursor-pointer">
                    <option value="">Todas</option>
                    <option value="individual">Individual</option>
                    <option value="promocao">Promoção</option>
                    <option value="coletivo">Coletivo</option>
                  </select>
                </div>
                <div className="lg:col-span-4 flex justify-end pt-2">
                  <button onClick={clearFilters}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest">
                    Limpar Filtros
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/30">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Data</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Cliente</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Trabalho</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Vendedor</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Empresa</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Comprovante</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                        <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Carregando vendas...</p>
                      </div>
                    </td>
                  </tr>
                ) : salesData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <FileText className="w-12 h-12 text-[var(--muted-foreground)]" />
                        <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Nenhuma venda encontrada</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  salesData.map((item: any) => {
                    const sale = item.sale ?? item;
                    return (
                      <tr key={sale.id} className="hover:bg-[var(--secondary)]/20 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--foreground)]">{formatDate(sale.saleDate)}</span>
                            <span className="text-[10px] text-[var(--muted-foreground)]">{new Date(sale.saleDate).getFullYear()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <button onClick={() => setHistoryClientName(sale.clientName)}
                              className="text-left hover:underline text-sm font-bold text-[var(--primary)]" title="Ver histórico desta cliente">
                              {sale.clientName}
                            </button>
                            <span className="text-[10px] text-[var(--muted-foreground)]">{sale.clientPhone || "Sem telefone"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--primary)]">{sale.productName}</span>
                            <span className="text-[10px] uppercase font-bold tracking-tighter text-[var(--muted-foreground)]">{sale.productCategory || "individual"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(sale.amount)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-[var(--foreground)] bg-[var(--secondary)] px-2.5 py-1 rounded-lg border border-[var(--border)] whitespace-nowrap">
                            {sale.sellerName || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <CompanyBadge company={sale.company} />
                        </td>
                        <td className="px-6 py-4">
                          {sale.attachmentUrl ? (
                            <a
                              href={sale.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border"
                              style={{
                                background: "oklch(0.94 0.02 65)",
                                color: "oklch(0.50 0.10 65)",
                                borderColor: "oklch(0.88 0.04 65)",
                              }}
                            >
                              <Paperclip className="w-3 h-3" />
                              Ver
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setEditSale(sale)} className="p-2 rounded-xl bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95 border border-[var(--border)]">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {sale.attachmentUrl && (
                              <a
                                href={sale.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95 border border-[var(--border)]"
                                title="Ver comprovante"
                              >
                                <Paperclip className="w-4 h-4" />
                              </a>
                            )}
                            <button onClick={() => setDeleteConfirmId(sale.id)} className="p-2 rounded-xl bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95 border border-[var(--border)]">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-[var(--secondary)]/10 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Total de registros: {salesData.length}</p>
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Soma: </span>
               <span className="text-sm font-bold text-green-600 dark:text-green-400">
                 {formatCurrency(salesData.reduce((acc: number, item: any) => acc + Number((item.sale ?? item).amount), 0))}
               </span>
            </div>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : salesData.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 opacity-20">
              <FileText className="w-12 h-12 text-[var(--muted-foreground)]" />
              <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Nenhuma venda encontrada</p>
            </div>
          ) : (
            <>
              {salesData.map((item: any) => {
                const sale = item.sale ?? item;
                return (
                  <motion.div key={sale.id} className="rounded-2xl p-4 border border-[var(--border)] bg-[var(--card)] shadow-lg">
                    <div className="space-y-3">
                      {/* Valor em destaque */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Valor</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {formatCurrency(sale.amount)}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => setEditSale(sale)} className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-blue-500 transition-all active:scale-95">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {sale.attachmentUrl && (
                            <a
                              href={sale.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-all active:scale-95"
                              title="Ver comprovante"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button onClick={() => setDeleteConfirmId(sale.id)} className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-red-500 transition-all active:scale-95">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="h-px bg-[var(--border)]" />

                      {/* Informações principais */}
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Cliente</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setHistoryClientName(sale.clientName)} className="text-sm font-bold text-[var(--primary)] hover:underline text-left">
                              {sale.clientName}
                            </button>
                            {sale.attachmentUrl && (
                              <a
                                href={sale.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold transition-colors"
                                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.50 0.10 65)" }}
                              >
                                <Paperclip className="w-3 h-3" />
                                Comprovante
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Vendedor</p>
                            <p className="text-sm font-bold text-[var(--foreground)] truncate">
                              {sale.sellerName || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Empresa</p>
                            <div className="flex-shrink-0">
                              <CompanyBadge company={sale.company} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Data</p>
                            <p className="text-sm font-bold text-[var(--foreground)]">{formatDate(sale.saleDate)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Trabalho</p>
                            <p className="text-sm font-bold text-[var(--primary)] truncate">{sale.productName}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div className="rounded-2xl p-4 border border-[var(--border)] bg-[var(--secondary)]/10">
                <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-3">Total de registros: {salesData.length}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Soma: </span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(salesData.reduce((acc: number, item: any) => acc + Number((item.sale ?? item).amount), 0))}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editSale && <EditSaleModal sale={editSale} sellers={sellers} onClose={() => setEditSale(null)} />}

        {historyClientName && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setHistoryClientName(null); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]" style={{ background: "var(--card)" }}>
              <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>Histórico da Cliente</h2>
                  <p className="text-sm text-[var(--muted-foreground)]">{historyClientName}</p>
                </div>
                <button onClick={() => setHistoryClientName(null)} className="p-2 rounded-xl bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-6 max-h-[60vh] overflow-y-auto space-y-4">
                {loadingHistory ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>
                ) : (
                  <>
                    {clientHistory && clientHistory.totalPurchases > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[var(--muted-foreground)]">
                          Trabalhos ({clientHistory.totalPurchases})
                        </h3>
                        <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                          {clientHistory.purchases.map((p: any, i: number) => (
                            <div key={i} className="px-4 py-3 flex items-center justify-between gap-2"
                              style={{ borderBottom: i < clientHistory.purchases.length - 1 ? "1px solid var(--border)" : "none" }}>
                              <div>
                                <p className="text-sm font-bold text-[var(--foreground)]">{p.productName}</p>
                                <p className="text-xs text-[var(--muted-foreground)]">{formatDate(p.saleDate)}</p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                                background: p.workStatus === "feito" ? "oklch(0.92 0.04 160)" : p.workStatus === "pendente" ? "oklch(0.94 0.03 65)" : "oklch(0.92 0.04 250)",
                                color: p.workStatus === "feito" ? "oklch(0.40 0.14 160)" : p.workStatus === "pendente" ? "oklch(0.45 0.10 65)" : "oklch(0.40 0.14 250)",
                              }}>
                                {p.workStatus === "feito" ? "Feito" : p.workStatus === "pendente" ? "Pendente" : "Escrever"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {clientHistory && clientHistory.totalConsultas > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-[var(--muted-foreground)]">
                          Consultas de Cartas ({clientHistory.totalConsultas})
                        </h3>
                        <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                          {clientHistory.consultas.map((c: any, i: number) => (
                            <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-2"
                              style={{ borderBottom: i < clientHistory.consultas.length - 1 ? "1px solid var(--border)" : "none" }}>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 shrink-0 text-[var(--primary)]" />
                                <p className="text-sm font-bold text-[var(--foreground)]">Consulta Cartas</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.40 0.14 280)" }}>
                                  {c.consultationDate ? c.consultationDate.slice(8,10)+"/"+c.consultationDate.slice(5,7)+"/"+c.consultationDate.slice(0,4) : ""} às {c.consultationTime}
                                </span>
                                {c.status === "cancelada" && (
                                  <p className="text-xs mt-0.5 text-red-500">Cancelada</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {clientHistory && clientHistory.totalPurchases === 0 && clientHistory.totalConsultas === 0 && (
                      <p className="text-sm text-center py-6 text-[var(--muted-foreground)]">Nenhum histórico encontrado.</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
        
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[var(--border)]" style={{ background: "var(--card)" }}>
              <h3 className="text-xl font-bold mb-2 text-[var(--foreground)]" style={{ fontFamily: "'Playfair Display', serif" }}>Excluir Venda?</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-6">A venda será movida para a Lixeira e poderá ser restaurada em até 30 dias.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl font-bold bg-[var(--secondary)] text-[var(--foreground)] active:scale-95 uppercase tracking-widest text-[10px]">Cancelar</button>
                <button onClick={() => deleteSale.mutate({ id: deleteConfirmId })} disabled={deleteSale.isPending} className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white active:scale-95 uppercase tracking-widest text-[10px]">
                  {deleteSale.isPending ? "Excluindo..." : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
