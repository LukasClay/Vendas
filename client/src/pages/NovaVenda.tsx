import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle2, Upload, X, FileText, Loader2, Star, Camera, Calendar, Clock, ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
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

export default function NovaVenda() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const { resolvedTheme } = useTheme();
  const isDark = isAdmin && resolvedTheme === "dark";
  const { data: products = [], isLoading: loadingProducts } = trpc.products.list.useQuery();

  // Estilos baseados no perfil
  const inputStyle = {
    border: isAdmin ? "1.5px solid var(--border)" : "1.5px solid #e0e0e0",
    background: isAdmin ? "var(--secondary)" : "#faf8f4",
    color: isAdmin ? "var(--foreground)" : "#111111",
  };

  const cardStyle = {
    background: isAdmin ? "var(--card)" : "#ffffff",
    border: isAdmin ? "1.5px solid var(--border)" : "1.5px solid #e0e0e0",
    color: isAdmin ? "var(--foreground)" : "#111111",
  };

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

  const Content = (
    <div className="max-w-2xl mx-auto px-2 py-4 sm:py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>
          <PlusCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: isAdmin ? "var(--foreground)" : "#111111" }}>Nova Venda</h1>
          <p className="text-xs" style={{ color: isAdmin ? "var(--muted-foreground)" : "#8888a0" }}>Registre uma nova venda no sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl p-4 sm:p-6 shadow-xl" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4" style={{ color: "#c17f24" }} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Informações do Cliente</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase ml-1" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Nome Completo *</label>
              <input type="text" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Ex: Maria Oliveira" className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all"
                style={inputStyle} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold uppercase ml-1" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Data de Nascimento *</label>
                <div className="relative">
                  <input type="text" ref={birthDateInputRef} value={birthDateMasked} onChange={handleBirthDateInput}
                    placeholder="DD/MM/AAAA" className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all pr-10"
                    style={inputStyle} />
                  <button type="button" onClick={() => birthDateNativeRef.current?.showPicker()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-black/5" style={{ color: "#c17f24" }}>
                    <Calendar className="w-4 h-4" />
                  </button>
                  <input type="date" ref={birthDateNativeRef} className="absolute inset-0 opacity-0 pointer-events-none"
                    value={form.clientBirthDate} onChange={handleBirthDateNative} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase ml-1" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>WhatsApp/Telefone *</label>
                <input type="text" value={form.clientPhone} onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000" className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all"
                  style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-6 shadow-xl" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4" style={{ color: "#c17f24" }} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Trabalho Espiritual</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold uppercase ml-1" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Trabalho Espiritual *</label>
              <div className="relative">
                <input type="text" ref={productInputRef} value={productQuery || form.productName}
                  onChange={e => { setProductQuery(e.target.value); setProductDropdownOpen(true); }}
                  onFocus={() => setProductDropdownOpen(true)}
                  placeholder="Selecione ou digite o trabalho..."
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all pr-10"
                  style={inputStyle} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#c17f24" }}>
                  {productDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>

                <AnimatePresence>
                  {productDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setProductDropdownOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 top-full mt-2 z-20 max-h-60 overflow-y-auto rounded-xl shadow-2xl border border-[#e0e0e0] py-2"
                        style={{ background: isAdmin ? "var(--card)" : "#ffffff" }}>
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map(p => (
                            <button key={p.id} type="button" className="w-full px-4 py-3 text-left text-sm hover:bg-[#c17f24]/5 transition-colors"
                              onClick={() => {
                                setForm(f => ({ ...f, productName: p.name, productId: p.id, productCategory: p.category as any }));
                                setProductQuery("");
                                setProductDropdownOpen(false);
                              }}>
                              <p className="font-bold" style={{ color: isAdmin ? "var(--foreground)" : "#111111" }}>{p.name}</p>
                              <p className="text-[10px] uppercase tracking-wider opacity-60" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>{p.category}</p>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm italic opacity-60" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Nenhum trabalho encontrado.</div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase ml-1" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Data da Venda *</label>
                <input type="date" value={form.saleDate} onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all"
                  style={inputStyle} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase ml-1" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Valor do Trabalho *</label>
                <input type="text" value={form.amountFormatted} onChange={handleAmountChange}
                  placeholder="R$ 0,00" className="w-full px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all"
                  style={inputStyle} />
              </div>
            </div>

            {isConsultaCartas && (
              <div className="space-y-1.5 p-4 rounded-xl border-2 border-dashed border-[#c17f24]/20 bg-[#c17f24]/5">
                <label className="text-xs font-bold uppercase flex items-center gap-2" style={{ color: "#c17f24" }}>
                  <Calendar className="w-3 h-3" /> Selecione o Horário da Consulta *
                </label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-2 text-xs opacity-60"><Loader2 className="w-3 h-3 animate-spin" /> Carregando horários...</div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs italic py-2 opacity-60">Nenhum horário disponível para os próximos dias.</p>
                ) : (
                  <div className="space-y-4 mt-3 max-h-60 overflow-y-auto pr-2">
                    {Object.entries(slotsByDate).map(([date, slots]) => (
                      <div key={date} className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{fmtDate(date)}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {slots.map(slot => (
                            <button key={slot.id} type="button" onClick={() => setConsultationSlotId(slot.id)}
                              className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${consultationSlotId === slot.id ? "bg-[#c17f24] text-white border-[#c17f24] shadow-md" : "bg-white text-[#c17f24] border-[#c17f24]/30 hover:bg-[#c17f24]/10"}`}>
                              {slot.startTime}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-6 shadow-xl" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-4 h-4" style={{ color: "#c17f24" }} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Comprovante de Pagamento</h2>
          </div>

          <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-6 transition-all text-center ${isDragging ? "border-[#c17f24] bg-[#c17f24]/10" : "border-[#e0e0e0] hover:border-[#c17f24]/40"}`}
            style={{ background: isAdmin ? "var(--secondary)" : "#faf8f4" }}>
            <input type="file" ref={fileInputRef} onChange={e => handleFileChange(e.target.files?.[0] || null)} className="hidden" accept="image/*,application/pdf" />
            <input type="file" ref={cameraInputRef} onChange={e => handleFileChange(e.target.files?.[0] || null)} className="hidden" accept="image/*" capture="environment" />

            {file ? (
              <div className="space-y-4">
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="w-32 h-32 object-cover rounded-xl mx-auto shadow-md border-2 border-white" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center mx-auto shadow-sm border border-[#e0e0e0]">
                    <FileText className="w-8 h-8 text-[#c17f24]" />
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm font-bold" style={{ color: isAdmin ? "var(--foreground)" : "#111111" }}>{file.name}</p>
                  <p className="text-[10px] uppercase opacity-60" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button type="button" onClick={() => { setFile(null); setFilePreview(null); }} className="text-xs font-bold text-red-500 uppercase hover:underline">Remover Arquivo</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto shadow-sm border border-[#e0e0e0]">
                  <Upload className="w-6 h-6 text-[#c17f24]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold" style={{ color: isAdmin ? "var(--foreground)" : "#111111" }}>Arraste o comprovante aqui</p>
                  <p className="text-xs opacity-60" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>ou clique para selecionar</p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-[#e0e0e0] shadow-sm hover:bg-gray-50 transition-colors">Galeria</button>
                  {isMobile && <button type="button" onClick={() => cameraInputRef.current?.click()} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#c17f24] text-white shadow-md hover:opacity-90 transition-all">Tirar Foto</button>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-6 shadow-xl" style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4" style={{ color: "#c17f24" }} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Observações (Opcional)</h2>
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Alguma informação adicional importante?" className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20 transition-all min-h-[100px]"
            style={inputStyle} />
        </div>

        <button type="submit" disabled={createSale.isLoading}
          className="w-full py-4 rounded-2xl text-base font-bold text-white shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>
          {createSale.isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</> : <><CheckCircle2 className="w-5 h-5" /> Registrar Venda</>}
        </button>
      </form>
    </div>
  );

  if (success) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center max-w-sm mx-auto px-4 py-8 rounded-3xl border border-[#e0e0e0] bg-white shadow-xl">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: "#111111" }}>Venda Registrada!</h2>
            <p className="text-base mb-6 text-[#8888a0]">A venda foi salva com sucesso no sistema.</p>
            <button onClick={resetForm} className="w-full py-4 rounded-2xl text-base font-bold text-white shadow-lg transition-all"
              style={{ background: "linear-gradient(135deg, #c17f24, #d4932a)" }}>Fazer Nova Venda</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {isAdmin ? <FadeIn>{Content}</FadeIn> : Content}
    </DashboardLayout>
  );
}
