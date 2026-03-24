import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle2, Upload, X, FileText, Loader2, Star, Camera, Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

const CONSULTA_CARTAS = "Consulta Cartas";

// Retorna a data de hoje no fuso local (evita bug das 21h com UTC)
function getLocalToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Formata string "YYYY-MM-DD" para "DD/MM/AAAA"
function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const match = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(d);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

// Converte "DD/MM/AAAA" → "YYYY-MM-DD" para salvar no estado interno
function parseDateMask(masked: string): string {
  const m = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Aplica máscara dd/mm/aaaa a partir de dígitos puros
function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseCurrencyToNumber(formatted: string): number {
  const clean = formatted.replace(/[R$\s.]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

const inputStyle = {
  border: "1.5px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--foreground)",
};

export default function NovaVenda() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { data: products = [], isLoading: loadingProducts } = trpc.products.list.useQuery();

  // Estado do campo de data de nascimento como texto mascarado
  const [birthDateMasked, setBirthDateMasked] = useState("");
  const birthDateInputRef = useRef<HTMLInputElement>(null);
  const birthDateNativeRef = useRef<HTMLInputElement>(null);

  // Estado do combobox de produtos
  const [productQuery, setProductQuery] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    clientName: "",
    clientBirthDate: "",
    clientPhone: "",
    productName: "",
    productId: null as number | null,
    productCategory: "individual" as "individual" | "promocao" | "coletivo",
    saleDate: getLocalToday(),
    amountFormatted: "",
    notes: "",
  });
  const [consultationSlotId, setConsultationSlotId] = useState<number | null>(null);

  const isConsultaCartas = form.productName === CONSULTA_CARTAS;

  // Busca slots disponíveis apenas quando Consulta Cartas estiver selecionado
  const { data: availableSlots = [], isLoading: loadingSlots } = trpc.consultationSlots.listAvailable.useQuery(
    undefined,
    { enabled: isConsultaCartas }
  );

  // Agrupa slots por data (consultationDate é string "YYYY-MM-DD")
  const slotsByDate = (availableSlots ?? []).reduce<Record<string, typeof availableSlots>>((acc, slot) => {
    const key = String(slot.consultationDate).slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  // Lista filtrada de produtos para o combobox
  const safeProducts = products ?? [];
  const filteredProducts = productQuery.trim()
    ? safeProducts.filter(p => p.name.toLowerCase().includes(productQuery.toLowerCase()))
    : safeProducts;

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const createSale = trpc.sales.create.useMutation({
    onSuccess: () => {
      setSuccess(true);
      utils.sales.myHistory.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar venda. Tente novamente.");
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(selectedFile.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WEBP ou PDF.");
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  }, []);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setForm(f => ({ ...f, amountFormatted: "" })); return; }
    const cents = parseInt(raw, 10);
    const formatted = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    setForm(f => ({ ...f, amountFormatted: formatted }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length <= 11) {
      v = v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    }
    setForm(f => ({ ...f, clientPhone: v }));
  };

  // Handler da máscara de data de nascimento
  const handleBirthDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyDateMask(e.target.value);
    setBirthDateMasked(masked);
    const iso = parseDateMask(masked);
    setForm(f => ({ ...f, clientBirthDate: iso }));
  };

  // Quando o input nativo (calendário) muda, sincroniza a máscara
  const handleBirthDateNative = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // "YYYY-MM-DD"
    setForm(f => ({ ...f, clientBirthDate: iso }));
    if (iso) {
      const [y, mo, d] = iso.split("-");
      setBirthDateMasked(`${d}/${mo}/${y}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) { toast.error("Nome do cliente é obrigatório."); return; }
    if (!form.clientBirthDate) { toast.error("Data de nascimento é obrigatória."); return; }
    {
      const birth = new Date(form.clientBirthDate + "T12:00:00");
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear() - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      if (age < 18) { toast.error("O cliente deve ter pelo menos 18 anos."); return; }
    }
    if (!form.clientPhone.replace(/\D/g, "")) { toast.error("Telefone é obrigatório."); return; }
    if (!form.productName) { toast.error("Selecione o trabalho espiritual."); return; }
    if (!form.amountFormatted) { toast.error("Informe o valor do trabalho."); return; }

    let attachmentBase64: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentName: string | undefined;

    if (file) {
      attachmentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      attachmentMime = file.type;
      attachmentName = file.name;
    }

    if (isConsultaCartas && !consultationSlotId) {
      toast.error("Selecione o horário da consulta.");
      return;
    }

    await createSale.mutateAsync({
      clientName: form.clientName.trim(),
      clientBirthDate: form.clientBirthDate || undefined,
      clientPhone: form.clientPhone.replace(/\D/g, "") || undefined,
      productName: form.productName,
      productId: form.productId ?? undefined,
      productCategory: form.productCategory,
      saleDate: form.saleDate,
      amount: parseCurrencyToNumber(form.amountFormatted),
      notes: form.notes || undefined,
      consultationSlotId: consultationSlotId ?? undefined,
      attachmentBase64,
      attachmentMime,
      attachmentName,
    });
  };

  const resetForm = () => {
    setForm({
      clientName: "",
      clientBirthDate: "",
      clientPhone: "",
      productName: "",
      productId: null,
      productCategory: "individual",
      saleDate: getLocalToday(),
      amountFormatted: "",
      notes: "",
    });
    setBirthDateMasked("");
    setProductQuery("");
    setProductDropdownOpen(false);
    setFile(null);
    setFilePreview(null);
    setConsultationSlotId(null);
    setSuccess(false);
  };

  // ── Tela de sucesso ────────────────────────────────────────────
  if (success) {
    return (
      <DashboardLayout>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center max-w-sm mx-auto px-4 py-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--primary), oklch(0.68 0.14 70))" }}>
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
              Venda Registrada!
            </h2>
            <p className="text-base mb-2" style={{ color: "var(--muted-foreground)" }}>
              A venda foi salva com sucesso no sistema.
            </p>
            <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
              Você pode visualizar o histórico de vendas na seção "Vendas".
            </p>
            <button onClick={resetForm}
              className="px-8 py-4 rounded-xl font-bold text-white bg-[var(--primary)] shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto">
              <Plus className="w-5 h-5" /> Registrar Nova Venda
            </button>
          </div>
        </motion.div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6 pb-20">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
            Nova Venda
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Registre uma nova venda no sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Nome do Cliente <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Data de Nascimento <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="text" value={birthDateMasked} onChange={handleBirthDateInput} ref={birthDateInputRef}
                  placeholder="DD/MM/AAAA" maxLength={10}
                  className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required />
                <input type="date" value={form.clientBirthDate} onChange={handleBirthDateNative} ref={birthDateNativeRef}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)] pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Telefone <span className="text-red-500">*</span>
              </label>
              <input type="tel" value={form.clientPhone} onChange={handlePhoneChange}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required />
            </div>

            <div className="sm:col-span-2 relative">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Trabalho Espiritual <span className="text-red-500">*</span>
              </label>
              <input type="text" value={productQuery || form.productName} onChange={e => {
                setProductQuery(e.target.value);
                setProductDropdownOpen(true);
                setForm(f => ({ ...f, productName: e.target.value, productId: null, productCategory: "individual" }));
              }} onFocus={() => setProductDropdownOpen(true)} ref={productInputRef}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required
                placeholder="Selecione ou digite o trabalho..." />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-4 text-[var(--muted-foreground)]">
                {productDropdownOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              <AnimatePresence>
                {productDropdownOpen && filteredProducts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 w-full mt-1 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredProducts.map(product => (
                      <div key={product.id} onClick={() => {
                        setForm(f => ({ ...f, productName: product.name, productId: product.id, productCategory: product.category as any }));
                        setProductQuery(product.name);
                        setProductDropdownOpen(false);
                      }} className="px-4 py-2 cursor-pointer hover:bg-[var(--secondary)] transition-colors text-[var(--foreground)] text-sm">
                        {product.name}
                        {product.category === "promocao" && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">⭐ PROMOÇÃO</span>}
                        {product.category === "coletivo" && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">👥 COLETIVO</span>}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isConsultaCartas && (
              <div className="sm:col-span-2 relative">
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                  Horário da Consulta <span className="text-red-500">*</span>
                </label>
                <select value={consultationSlotId ?? ""} onChange={e => setConsultationSlotId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required>
                  <option value="">Selecione um horário</option>
                  {loadingSlots ? (
                    <option disabled>Carregando horários...</option>
                  ) : Object.keys(slotsByDate).length === 0 ? (
                    <option disabled>Nenhum horário disponível</option>
                  ) : (
                    Object.keys(slotsByDate).map(date => (
                      <optgroup key={date} label={fmtDate(date)}>
                        {slotsByDate[date].map(slot => (
                          <option key={slot.id} value={slot.id}>
                            {slot.consultationTime} ({slot.sellerName || "Vendedor não atribuído"})
                          </option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 mt-4 w-5 h-5 text-[var(--muted-foreground)] pointer-events-none" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Data da Venda <span className="text-red-500">*</span>
              </label>
              <input type="date" value={form.saleDate} onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.amountFormatted} onChange={handleAmountChange}
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={inputStyle} required />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Observações (opcional)
              </label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Detalhes adicionais sobre a venda..."
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all resize-none" style={inputStyle} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-[var(--muted-foreground)]">
                Anexo (opcional, máx 5MB)
              </label>
              <div className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer
                ${isDragging ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-[var(--secondary)]"}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}>
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="max-h-40 rounded-lg mb-3" />
                ) : file ? (
                  <FileText className="w-12 h-12 text-[var(--primary)] mb-3" />
                ) : (
                  <Upload className="w-12 h-12 text-[var(--muted-foreground)] opacity-50 mb-3" />
                )}
                <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                  {file ? file.name : "Arraste e solte um arquivo aqui ou clique para selecionar"}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  JPG, PNG, WEBP ou PDF (máx. 5MB)
                </p>
                <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleFileChange(e.target.files?.[0] || null)} />
                <button type="button" onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                  className="mt-3 px-4 py-2 rounded-lg text-xs font-bold bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Tirar Foto
                </button>
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={e => handleFileChange(e.target.files?.[0] || null)} />
                {file && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setFilePreview(null); }}
                    className="mt-2 text-red-500 text-xs font-bold flex items-center gap-1">
                    <X className="w-3 h-3" /> Remover Anexo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={createSale.isPending || loadingProducts || loadingSlots}
              className="px-8 py-4 rounded-xl font-bold text-white bg-[var(--primary)] shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              {createSale.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className="w-5 h-5" />}
              Registrar Venda
            </button>
          </div>
        </form>
      </motion.div>
    </DashboardLayout>
  );
}
