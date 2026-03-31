import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle2, Upload, X, FileText, Loader2, Star, Camera, Calendar, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";

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
  border: "1.5px solid #ddd5c4",
  background: "#faf8f4",
  color: "#1a1a2e",
};

const labelStyle = { color: "#2a2a40" };
const requiredStar = <span style={{ color: "#c0392b" }}>*</span>;

export default function NovaVenda() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const isAdmin = user?.role === "admin";
  const isDark = isAdmin && resolvedTheme === "dark";
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
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center max-w-sm mx-auto px-4">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{ background: "linear-gradient(135deg, #1a7a4a, #22924f)" }}>
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: isDark ? "var(--foreground)" : "#1a1a2e" }}>
              Venda Registrada!
            </h2>
            <p className="text-base mb-2" style={{ color: isDark ? "var(--muted-foreground)" : "#737390" }}>
              A venda foi salva com sucesso no sistema.
            </p>
            <p className="text-sm mb-8" style={{ color: isDark ? "var(--muted-foreground)" : "#8888a0" }}>
              O administrador poderá visualizá-la no painel.
            </p>
            <button
              onClick={resetForm}
              className="w-full py-5 px-8 rounded-2xl text-white font-semibold text-lg transition-all active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>
              Registrar Nova Venda
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Classe base dos inputs ─────────────────────────────────────
  const inputClass = `w-full px-4 rounded-xl text-base transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${isMobile ? "py-4 text-[16px]" : "py-3"}`;
  const cardClass = "rounded-2xl p-5 shadow-sm";
  const cardStyle = isDark
    ? { background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }
    : { background: "white", border: "1px solid #ddd5c4" };
  const dynInputStyle = isDark
    ? { border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }
    : inputStyle;
  const dynLabelStyle = isDark ? { color: "var(--foreground)" } : labelStyle;
  const dynHeadingColor = isDark ? "var(--foreground)" : "#1a1a2e";
  const dynSubColor = isDark ? "var(--muted-foreground)" : "#737390";

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: dynHeadingColor }}>
              Nova Venda
            </h1>
            <p className="text-sm" style={{ color: dynSubColor }}>
              Olá, <strong>{user?.name?.split(" ")[0] || "Vendedor"}</strong>! Preencha os dados abaixo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Card 1: Dados do Cliente ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: dynHeadingColor }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#c17f24" }}>1</span>
              Dados do Cliente
            </h2>
            <div className="space-y-4">

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Nome Completo {requiredStar}
                </label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                  placeholder="Ex: Maria da Silva"
                  className={inputClass}
                  style={dynInputStyle}
                  autoComplete="off"
                  required
                />
              </div>

              {/* Data de Nascimento — input text com máscara dd/mm/aaaa + botão calendário */}
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Data de Nascimento {requiredStar}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={birthDateInputRef}
                    type="text"
                    inputMode="numeric"
                    value={birthDateMasked}
                    onChange={handleBirthDateInput}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className={inputClass}
                    style={dynInputStyle}
                    autoComplete="off"
                  />
                  {/* Botão calendário — abre o input nativo oculto */}
                  <button
                    type="button"
                    onClick={() => birthDateNativeRef.current?.showPicker?.()}
                    className="shrink-0 flex items-center justify-center rounded-xl transition-all active:scale-95"
                    style={{
                      width: isMobile ? 52 : 44,
                      height: isMobile ? 52 : 44,
                      background: isDark ? "var(--secondary)" : "#faf8f4",
                      border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4",
                      color: "#c17f24",
                    }}
                    aria-label="Abrir calendário"
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                  {/* Input nativo oculto — usado apenas pelo botão calendário */}
                  <input
                    ref={birthDateNativeRef}
                    type="date"
                    value={form.clientBirthDate}
                    onChange={handleBirthDateNative}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Telefone {requiredStar}
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.clientPhone}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className={inputClass}
                  style={dynInputStyle}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Card 2: Dados do Trabalho ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: dynHeadingColor }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#c17f24" }}>2</span>
              Dados do Trabalho
            </h2>
            <div className="space-y-4">

              {/* Trabalho Espiritual — input único com autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Trabalho Espiritual {requiredStar}
                </label>
                <div className="relative">
                  <input
                    ref={productInputRef}
                    type="text"
                    value={productDropdownOpen ? productQuery : form.productName}
                    onChange={e => {
                      setProductQuery(e.target.value);
                      setProductDropdownOpen(true);
                      // Se o utilizador apagar tudo, limpa a seleção
                      if (!e.target.value) {
                        setForm(f => ({ ...f, productName: "", productId: null }));
                      }
                    }}
                    onFocus={() => {
                      setProductQuery("");
                      setProductDropdownOpen(true);
                    }}
                    onBlur={() => {
                      // Pequeno delay para permitir o click no item da lista
                      setTimeout(() => setProductDropdownOpen(false), 150);
                    }}
                    placeholder={loadingProducts ? "Carregando..." : "Digite ou selecione o trabalho..."}
                    readOnly={loadingProducts}
                    className={inputClass}
                    style={{
                      ...dynInputStyle,
                      paddingRight: "2.5rem",
                    }}
                    autoComplete="off"
                  />
                  {/* Botão de seta para abrir dropdown ao clicar */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      if (productDropdownOpen) {
                        setProductDropdownOpen(false);
                      } else {
                        setProductQuery("");
                        setProductDropdownOpen(true);
                        productInputRef.current?.focus();
                      }
                    }}
                    className="absolute right-3 top-1/2 p-1 rounded transition-transform"
                    style={{ color: isDark ? "var(--muted-foreground)" : "#737390", transform: productDropdownOpen ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)" }}
                    aria-label="Abrir lista de trabalhos">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Dropdown de sugestões */}
                {productDropdownOpen && !loadingProducts && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
                    style={{
                      background: isDark ? "var(--card)" : "white",
                      border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4",
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm" style={{ color: dynSubColor }}>
                        Nenhum trabalho encontrado.
                      </div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()} // evita blur antes do click
                          onClick={() => {
                            const allowed = (p as any).allowedCategories ?? ["individual", "promocao", "coletivo"];
                            setForm(f => {
                              const newCategory = allowed.includes(f.productCategory) ? f.productCategory : allowed[0];
                              return { ...f, productName: p.name, productId: p.id, productCategory: newCategory };
                            });
                            setProductQuery("");
                            setProductDropdownOpen(false);
                            productInputRef.current?.blur();
                          }}
                          className="w-full text-left transition-colors"
                          style={{
                            padding: isMobile ? "14px 16px" : "10px 16px",
                            fontSize: isMobile ? 16 : 14,
                            background: form.productName === p.name ? (isDark ? "var(--accent)" : "#ede8de") : (isDark ? "var(--card)" : "white"),
                            color: isDark ? "var(--foreground)" : "#1a1a2e",
                            borderBottom: isDark ? "1px solid var(--border)" : "1px solid #ddd5c4",
                          }}
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Tipo (categoria da venda) — oculto para Consulta Cartas */}
              {!isConsultaCartas && (() => {
                const selectedProduct = safeProducts.find(p => p.id === form.productId);
                const allowed: string[] = (selectedProduct as any)?.allowedCategories ?? ["individual", "promocao", "coletivo"];
                const allOptions = [
                  { value: "individual", label: "Individual", icon: "" },
                  { value: "promocao", label: "Promoção", icon: "⭐ " },
                  { value: "coletivo", label: "Coletivo", icon: "👥 " },
                ] as const;
                const visibleOptions = allOptions.filter(opt => allowed.includes(opt.value));
                return (
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Tipo {requiredStar}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {visibleOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, productCategory: opt.value }))}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 border-2"
                      style={form.productCategory === opt.value
                        ? { background: opt.value === "promocao" ? "#ede8de" : opt.value === "coletivo" ? "#e0e0f8" : "#ddd5c4",
                            color: opt.value === "promocao" ? "#7a5518" : opt.value === "coletivo" ? "#4040b0" : "#2a2a40",
                            borderColor: opt.value === "promocao" ? "#c4a030" : opt.value === "coletivo" ? "#4a70c0" : "#737390" }
                        : { background: isDark ? "var(--secondary)" : "white", color: isDark ? "var(--muted-foreground)" : "#737390", borderColor: isDark ? "var(--border)" : "#ddd5c4" }
                      }>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>
                );
              })()}

              {/* Data da Venda */}
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Data da Venda {user?.role === "admin" ? requiredStar : null}
                </label>
                {user?.role === "admin" ? (
                  <input
                    type="date"
                    value={form.saleDate}
                    onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))}
                    className={inputClass}
                    style={dynInputStyle}
                    required
                  />
                ) : (
                  <div
                    className={inputClass}
                    style={{ ...dynInputStyle, background: isDark ? "var(--muted)" : "#f5f0e8", color: isDark ? "var(--muted-foreground)" : "#4a4a60", cursor: "not-allowed" }}
                  >
                    {fmtDate(form.saleDate)}
                  </div>
                )}
              </div>

              {/* Horário da Consulta — exibido apenas para Consulta Cartas */}
              {isConsultaCartas && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" style={{ color: "#5050c0" }} />
                      Horário da Consulta {requiredStar}
                    </span>
                  </label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 py-3" style={{ color: dynSubColor }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Carregando horários...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-xl p-4 text-center" style={{ background: isDark ? "var(--secondary)" : "#f5f0e8", border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4" }}>
                      <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: dynSubColor }} />
                      <p className="text-sm font-medium" style={{ color: isDark ? "var(--foreground)" : "#3a3a50" }}>Nenhum horário disponível</p>
                      <p className="text-xs mt-1" style={{ color: dynSubColor }}>Aguarde o administrador ou a consultora adicionar novos horários.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(slotsByDate).map(([dateKey, slots]) => (
                        <div key={dateKey}>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: "#5050c0" }}>
                            <Calendar className="w-3.5 h-3.5" />
                            {fmtDate(dateKey)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(slots ?? []).map(slot => (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setConsultationSlotId(consultationSlotId === slot.id ? null : slot.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                                  consultationSlotId === slot.id
                                    ? "text-white border-transparent"
                                    : "border-transparent"
                                }`}
                                style={consultationSlotId === slot.id
                                  ? { background: "#5050c0", color: "white" }
                                  : { background: "#eaeaf8", color: "#3a3a9a", border: "1.5px solid #c0c0e8" }
                                }>
                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                {slot.consultationTime}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Valor */}
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Valor do Trabalho {requiredStar}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amountFormatted}
                  onChange={handleAmountChange}
                  placeholder="R$ 0,00"
                  className={`${inputClass} font-semibold text-lg`}
                  style={dynInputStyle}
                  required
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium mb-2" style={dynLabelStyle}>
                  Observações <span className="font-normal text-xs" style={{ color: dynSubColor }}>(opcional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Alguma observação sobre a venda..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                  style={dynInputStyle}
                />
              </div>
            </div>
          </div>

          {/* ── Card 3: Comprovante ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: dynHeadingColor }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "#c17f24" }}>3</span>
              Comprovante
              <span className="text-xs font-normal ml-1" style={{ color: dynSubColor }}>(opcional)</span>
            </h2>

            {file ? (
              /* Arquivo selecionado */
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: isDark ? "var(--secondary)" : "#f5f0e8", border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4" }}>
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "#ddd5c4" }}>
                    <FileText className="w-8 h-8" style={{ color: "#c17f24" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: isDark ? "var(--foreground)" : "#1a1a2e" }}>{file.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: dynSubColor }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button type="button" onClick={() => { setFile(null); setFilePreview(null); }}
                  className="p-2 rounded-lg"
                  style={{ color: "#c0392b" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : isMobile ? (
              /* Upload mobile: dois botões grandes (câmera + galeria) */
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: isDark ? "var(--secondary)" : "#ede8de", border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4" }}>
                  <Camera className="w-7 h-7" style={{ color: "#c17f24" }} />
                  <span className="text-sm font-medium" style={{ color: isDark ? "var(--foreground)" : "#2a2a40" }}>Tirar Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: isDark ? "var(--secondary)" : "#ede8de", border: isDark ? "1.5px solid var(--border)" : "1.5px solid #ddd5c4" }}>
                  <Upload className="w-7 h-7" style={{ color: "#c17f24" }} />
                  <span className="text-sm font-medium" style={{ color: isDark ? "var(--foreground)" : "#2a2a40" }}>Galeria / PDF</span>
                </button>
              </div>
            ) : (
              /* Upload desktop: drag & drop */
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
                style={{
                  borderColor: isDragging ? "#c17f24" : (isDark ? "var(--border)" : "#ddd5c4"),
                  background: isDragging ? (isDark ? "var(--accent)" : "#ede8de") : (isDark ? "var(--secondary)" : "#faf8f4"),
                }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "#ede8de" }}>
                    <Upload className="w-6 h-6" style={{ color: "#c17f24" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: isDark ? "var(--foreground)" : "#2a2a40" }}>
                      Clique ou arraste o comprovante aqui
                    </p>
                    <p className="text-xs mt-1" style={{ color: dynSubColor }}>
                      JPG, PNG, WEBP ou PDF — máx. 5MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Input câmera (mobile, capture=camera) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {/* Input galeria/arquivo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* ── Botão Registrar ── */}
          <button
            type="submit"
            disabled={createSale.isPending}
            className={`w-full rounded-2xl text-white font-semibold transition-all active:scale-[0.98] shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${isMobile ? "py-5 text-lg" : "py-4 text-base"}`}
            style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>
            {createSale.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrando venda...
              </span>
            ) : (
              "✓  Registrar Venda"
            )}
          </button>

        </form>
      </div>
    </DashboardLayout>
  );
}
