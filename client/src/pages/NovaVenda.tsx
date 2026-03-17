import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CheckCircle2, Upload, X, FileText, Loader2, Star, Camera, Calendar, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

const CONSULTA_CARTAS = "Consulta Cartas";

// Formata string "YYYY-MM-DD" para "DD/MM/AAAA"
function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const match = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(d);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parseCurrencyToNumber(formatted: string): number {
  const clean = formatted.replace(/[R$\s.]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

const inputStyle = {
  border: "1.5px solid oklch(0.88 0.012 65)",
  background: "oklch(0.98 0.006 65)",
  color: "oklch(0.15 0.02 260)",
};

const labelStyle = { color: "oklch(0.30 0.02 260)" };
const requiredStar = <span style={{ color: "oklch(0.58 0.22 25)" }}>*</span>;

export default function NovaVenda() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const { data: products = [], isLoading: loadingProducts } = trpc.products.list.useQuery();

  const [form, setForm] = useState({
    clientName: "",
    clientBirthDate: "",
    clientPhone: "",
    productName: "",
    saleDate: new Date().toISOString().split("T")[0],
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
  const slotsByDate = availableSlots.reduce<Record<string, typeof availableSlots>>((acc, slot) => {
    const key = String(slot.consultationDate).slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) { toast.error("Nome do cliente é obrigatório."); return; }
    if (!form.clientBirthDate) { toast.error("Data de nascimento é obrigatória."); return; }
    if (!form.clientPhone.replace(/\D/g, "")) { toast.error("Telefone é obrigatório."); return; }
    if (!form.productName) { toast.error("Selecione o trabalho espiritual."); return; }
    if (!form.amountFormatted) { toast.error("Informe o valor do trabalho."); return; }

    let attachmentBase64: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentName: string | undefined;

    if (file) {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      attachmentBase64 = btoa(binary);
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
      saleDate: new Date().toISOString().split("T")[0],
      amountFormatted: "",
      notes: "",
    });
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
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.15 160), oklch(0.65 0.18 160))" }}>
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Venda Registrada!
            </h2>
            <p className="text-base mb-2" style={{ color: "oklch(0.52 0.015 260)" }}>
              A venda foi salva com sucesso no sistema.
            </p>
            <p className="text-sm mb-8" style={{ color: "oklch(0.65 0.01 260)" }}>
              O administrador poderá visualizá-la no painel.
            </p>
            <button
              onClick={resetForm}
              className="w-full py-5 px-8 rounded-2xl text-white font-semibold text-lg transition-all active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
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
  const cardStyle = { background: "white", border: "1px solid oklch(0.88 0.012 65)" };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Nova Venda
            </h1>
            <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>
              Olá, <strong>{user?.name?.split(" ")[0] || "Vendedor"}</strong>! Preencha os dados abaixo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Card 1: Dados do Cliente ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "oklch(0.60 0.13 65)" }}>1</span>
              Dados do Cliente
            </h2>
            <div className="space-y-4">

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
                  Nome Completo {requiredStar}
                </label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                  placeholder="Ex: Maria da Silva"
                  className={inputClass}
                  style={inputStyle}
                  autoComplete="off"
                  required
                />
              </div>

              {/* Data de nascimento — campo inteiro em coluna única no mobile */}
              <div>
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
                  Data de Nascimento {requiredStar}
                </label>
                <input
                  type="date"
                  value={form.clientBirthDate}
                  onChange={e => setForm(f => ({ ...f, clientBirthDate: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
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
                  style={inputStyle}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Card 2: Dados do Trabalho ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "oklch(0.60 0.13 65)" }}>2</span>
              Dados do Trabalho
            </h2>
            <div className="space-y-4">

              {/* Trabalho Espiritual */}
              <div>
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
                  Trabalho Espiritual {requiredStar}
                </label>
                <select
                  value={form.productName}
                  onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
                  className={`${inputClass} cursor-pointer`}
                  style={{ ...inputStyle, color: form.productName ? "oklch(0.15 0.02 260)" : "oklch(0.60 0.01 260)" }}
                  required>
                  <option value="" disabled>Selecione o trabalho...</option>
                  {loadingProducts ? (
                    <option disabled>Carregando...</option>
                  ) : products.length === 0 ? (
                    <option disabled>Nenhum trabalho cadastrado</option>
                  ) : (
                    products.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Data da Venda */}
              <div>
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
                  Data da Venda {requiredStar}
                </label>
                <input
                  type="date"
                  value={form.saleDate}
                  onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Horário da Consulta — exibido apenas para Consulta Cartas */}
              {isConsultaCartas && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={labelStyle}>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" style={{ color: "oklch(0.55 0.18 280)" }} />
                      Horário da Consulta {requiredStar}
                    </span>
                  </label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 py-3" style={{ color: "oklch(0.52 0.015 260)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Carregando horários...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-xl p-4 text-center" style={{ background: "oklch(0.96 0.01 65)", border: "1.5px solid oklch(0.88 0.012 65)" }}>
                      <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: "oklch(0.60 0.01 260)" }} />
                      <p className="text-sm font-medium" style={{ color: "oklch(0.40 0.02 260)" }}>Nenhum horário disponível</p>
                      <p className="text-xs mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>Aguarde o administrador ou a consultora adicionar novos horários.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(slotsByDate).map(([dateKey, slots]) => (
                        <div key={dateKey}>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: "oklch(0.55 0.18 280)" }}>
                            <Calendar className="w-3.5 h-3.5" />
                            {fmtDate(dateKey)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {slots.map(slot => (
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
                                  ? { background: "oklch(0.55 0.18 280)", color: "white" }
                                  : { background: "oklch(0.94 0.02 280)", color: "oklch(0.35 0.15 280)", border: "1.5px solid oklch(0.80 0.08 280)" }
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
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
                  Valor do Trabalho {requiredStar}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amountFormatted}
                  onChange={handleAmountChange}
                  placeholder="R$ 0,00"
                  className={`${inputClass} font-semibold text-lg`}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium mb-2" style={labelStyle}>
                  Observações <span className="font-normal text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>(opcional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Alguma observação sobre a venda..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* ── Card 3: Comprovante ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "oklch(0.60 0.13 65)" }}>3</span>
              Comprovante
              <span className="text-xs font-normal ml-1" style={{ color: "oklch(0.60 0.01 260)" }}>(opcional)</span>
            </h2>

            {file ? (
              /* Arquivo selecionado */
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "oklch(0.95 0.008 65)", border: "1.5px solid oklch(0.88 0.012 65)" }}>
                {filePreview ? (
                  <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "oklch(0.88 0.012 65)" }}>
                    <FileText className="w-8 h-8" style={{ color: "oklch(0.60 0.13 65)" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{file.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button type="button" onClick={() => { setFile(null); setFilePreview(null); }}
                  className="p-2 rounded-lg"
                  style={{ color: "oklch(0.58 0.22 25)" }}>
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
                  style={{ background: "oklch(0.94 0.02 65)", border: "1.5px solid oklch(0.88 0.012 65)" }}>
                  <Camera className="w-7 h-7" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <span className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Tirar Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: "oklch(0.94 0.02 65)", border: "1.5px solid oklch(0.88 0.012 65)" }}>
                  <Upload className="w-7 h-7" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <span className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Galeria / PDF</span>
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
                  borderColor: isDragging ? "oklch(0.60 0.13 65)" : "oklch(0.82 0.015 65)",
                  background: isDragging ? "oklch(0.94 0.02 65)" : "oklch(0.98 0.006 65)",
                }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "oklch(0.94 0.02 65)" }}>
                    <Upload className="w-6 h-6" style={{ color: "oklch(0.60 0.13 65)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>
                      Clique ou arraste o comprovante aqui
                    </p>
                    <p className="text-xs mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>
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
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
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
