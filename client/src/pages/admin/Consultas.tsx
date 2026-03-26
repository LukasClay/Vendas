import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  Calendar, Clock, Plus, Trash2, Loader2, User, Phone,
  CalendarDays, CheckCircle2, ClipboardList, XCircle, RotateCcw, Ban, Unlock,
  DollarSign, ThumbsUp, ThumbsDown, AlertTriangle, Package,
} from "lucide-react";
import { CompanyBadge } from "@/components/CompanySwitch";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { motion, AnimatePresence } from "framer-motion";

// ─── Componente isolado: CancelModal ──────────────────────────────────────────
function CancelModal({ modalData, onClose, onConfirm }: {
  modalData: { id: number; clientName?: string | null; sold?: boolean };
  onClose: () => void;
  onConfirm: (reason: string, requestRefund: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [requestRefund, setRequestRefund] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-[var(--border)]" 
        style={{ background: "var(--card)" }}
      >
        <h3 className="text-xl font-bold mb-1" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>
          Cancelar Consulta
        </h3>
        {modalData.clientName && (
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
            Cliente: <span className="font-bold text-[var(--foreground)]">{modalData.clientName}</span>
          </p>
        )}
        <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Motivo do cancelamento <span className="opacity-50">(opcional)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: cliente desmarcou, conflito de agenda..."
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none border border-[var(--border)]"
          style={{
            background: "var(--secondary)",
            color: "var(--foreground)",
          }}
          autoFocus
        />

        {/* Checkbox de Reembolso (apenas se já foi vendida) */}
        {modalData.sold && (
          <label
            className="flex items-center gap-3 mt-4 p-3 rounded-xl cursor-pointer transition-all border-2"
            style={{
              background: requestRefund ? "rgba(34, 197, 94, 0.1)" : "var(--secondary)",
              borderColor: requestRefund ? "#22c55e" : "var(--border)",
            }}
          >
            <input
              type="checkbox"
              checked={requestRefund}
              onChange={(e) => setRequestRefund(e.target.checked)}
              className="w-4 h-4 rounded accent-green-600"
            />
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                Dinheiro Reembolsado
              </p>
              <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                Solicita aprovação de reembolso ao administrador
              </p>
            </div>
          </label>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all bg-[var(--secondary)] text-[var(--foreground)] active:scale-95"
          >
            Voltar
          </button>
          <button
            onClick={() => onConfirm(reason, requestRefund)}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: requestRefund ? "#22c55e" : "#ef4444" }}
          >
            {requestRefund ? "Cancelar + Reembolso" : "Confirmar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (d instanceof Date) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const match = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(d);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 7; h < 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}
const TIME_OPTIONS = generateTimeOptions();

// ─── Card de Consulta ─────────────────────────────────────────────────────────
function ConsultaCard({
  slot,
  showDate = true,
  onCancel,
  onRestore,
  onDelete,
  cancelling = false,
  restoring = false,
  deleting = false,
  confirmingRestore = false,
  confirmingDelete = false,
}: {
  slot: any;
  showDate?: boolean;
  onCancel?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  cancelling?: boolean;
  restoring?: boolean;
  deleting?: boolean;
  confirmingRestore?: boolean;
  confirmingDelete?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const sellerDisplay = slot.sellerName || slot.sellerUsername || null;
  const isCancelled = slot.effectiveStatus === "cancelada";

  return (
    <div
      className="rounded-2xl p-4 border transition-all"
      style={{
        background: isCancelled 
          ? (isDark ? "rgba(239, 68, 68, 0.05)" : "oklch(0.98 0.01 25)") 
          : "var(--card)",
        borderColor: isCancelled 
          ? (isDark ? "rgba(239, 68, 68, 0.2)" : "oklch(0.92 0.04 25)") 
          : "var(--border)",
        opacity: isCancelled ? 0.8 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ 
              background: isCancelled ? "oklch(0.92 0.04 25)" : "oklch(0.92 0.04 280)",
              opacity: isDark ? 0.8 : 1
            }}
          >
            <Clock className="w-5 h-5" style={{ color: isCancelled ? "oklch(0.55 0.18 25)" : "oklch(0.55 0.18 280)" }} />
          </div>
          <div>
            {showDate && (
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isCancelled ? "oklch(0.55 0.18 25)" : "oklch(0.55 0.18 280)" }}>
                {fmtDate(slot.consultationDate)}
              </p>
            )}
            <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
              {slot.consultationTime}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {slot.saleDate && (
            <span className="text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-tighter" 
              style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
              Venda: {fmtDate(slot.saleDate)}
            </span>
          )}
          {onCancel && slot.sold && !isCancelled && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 active:scale-95"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
              Cancelar
            </button>
          )}
          {onRestore && isCancelled && (
            <button
              onClick={onRestore}
              disabled={restoring}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 active:scale-95"
            >
              {restoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              {confirmingRestore ? "Confirmar?" : "Restaurar"}
            </button>
          )}
          {onDelete && isCancelled && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] active:scale-95"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
              {confirmingDelete ? "Confirmar?" : "Liberar"}
            </button>
          )}
        </div>
      </div>

      {slot.clientName && (
        <div className="mt-4 pt-4 space-y-2 border-t border-[var(--border)]">
          {sellerDisplay && (
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 shrink-0 text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Vendedor:</span>
              <span className="text-sm font-bold text-[var(--foreground)]">{sellerDisplay}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 shrink-0 text-purple-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Cliente:</span>
            <span className="text-sm font-bold text-[var(--foreground)]">{slot.clientName}</span>
          </div>
          {slot.clientBirthDate && (
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-orange-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Nasc.:</span>
              <span className="text-sm text-[var(--foreground)]">{fmtDate(slot.clientBirthDate)}</span>
            </div>
          )}
          {slot.clientPhone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0 text-green-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Tel.:</span>
              <span className="text-sm text-[var(--foreground)]">{slot.clientPhone}</span>
            </div>
          )}
          {slot.notes && (
            <div className="mt-2 p-2 rounded-lg bg-[var(--secondary)]/50 text-xs italic text-[var(--muted-foreground)] border border-[var(--border)]/50">
              Obs: {slot.notes}
            </div>
          )}
          {isCancelled && slot.cancelReason && (
            <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs italic text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
              Motivo: {slot.cancelReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Consultas() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"pendentes" | "realizadas" | "canceladas" | "reembolsos" | "gerenciar">("pendentes");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTime, setSelectedTime] = useState("");
  const [cancelModal, setCancelModal] = useState<{ id: number; clientName?: string | null; sold?: boolean } | null>(null);
  const [confirmDeleteSlotId, setConfirmDeleteSlotId] = useState<number | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);
  const [confirmDeleteCancelledId, setConfirmDeleteCancelledId] = useState<number | null>(null);
  const [confirmApproveRefundId, setConfirmApproveRefundId] = useState<number | null>(null);
  const [confirmRejectRefundId, setConfirmRejectRefundId] = useState<number | null>(null);

  // Queries separadas para cada aba
  const { data: slots = [], isLoading: loadingAll } = trpc.consultationSlots.listAll.useQuery();
  const { data: pendentes = [], isLoading: loadingPendentes } = trpc.consultationSlots.listPending.useQuery();
  const { data: realizadas = [], isLoading: loadingRealizadas } = trpc.consultationSlots.listDone.useQuery();
  const { data: canceladas = [], isLoading: loadingCanceladas } = trpc.consultationSlots.listCancelled.useQuery();
  const { data: refunds = [], isLoading: loadingRefunds } = trpc.consultationSlots.listRefunds.useQuery();

  const invalidateAll = () => {
    utils.consultationSlots.listAll.invalidate();
    utils.consultationSlots.listPending.invalidate();
    utils.consultationSlots.listDone.invalidate();
    utils.consultationSlots.listCancelled.invalidate();
    utils.consultationSlots.listRefunds.invalidate();
    utils.sales.listDeleted.invalidate();
    utils.sales.list.invalidate();
    utils.reports.summary.invalidate();
  };

  const cancelMutation = trpc.consultationSlots.cancel.useMutation({
    onSuccess: () => { toast.success("Consulta cancelada!"); setCancelModal(null); invalidateAll(); },
    onError: (err: any) => toast.error(err.message),
  });

  const restoreMutation = trpc.consultationSlots.restore.useMutation({
    onSuccess: () => { toast.success("Consulta restaurada!"); invalidateAll(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.consultationSlots.deleteCancelled.useMutation({
    onSuccess: () => { toast.success("Horário liberado!"); invalidateAll(); },
    onError: (err: any) => toast.error(err.message),
  });

  const approveRefundMutation = trpc.consultationSlots.approveRefund.useMutation({
    onSuccess: () => { toast.success("Reembolso aprovado! Venda movida para a lixeira."); invalidateAll(); },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectRefundMutation = trpc.consultationSlots.rejectRefund.useMutation({
    onSuccess: () => { toast.success("Reembolso rejeitado. Venda restaurada e consulta voltou para pendente."); invalidateAll(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSlotMutation = trpc.consultationSlots.delete.useMutation({
    onSuccess: () => { toast.success("Horário removido!"); invalidateAll(); },
    onError: (err: any) => toast.error(err.message),
  });

  const [creatingSlots, setCreatingSlots] = useState(false);
  const createSlotMutation = trpc.consultationSlots.create.useMutation();
  const createSlotsMutation = { isPending: creatingSlots };

  const handleCreateSingleSlot = async () => {
    if (!selectedTime) { toast.error("Selecione um horário."); return; }
    setCreatingSlots(true);
    try {
      await createSlotMutation.mutateAsync({ consultationDate: selectedDate, consultationTime: selectedTime });
      toast.success(`Horário ${selectedTime} criado para ${fmtDate(selectedDate)}!`);
      invalidateAll();
      setSelectedTime("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar horário.");
    }
    setCreatingSlots(false);
  };

  const isLoading = activeTab === "pendentes" ? loadingPendentes : activeTab === "realizadas" ? loadingRealizadas : activeTab === "canceladas" ? loadingCanceladas : activeTab === "reembolsos" ? loadingRefunds : loadingAll;

  const listToRender = activeTab === "pendentes" ? pendentes : activeTab === "realizadas" ? realizadas : canceladas;

  const grouped = listToRender.reduce((acc, s) => {
    const d = fmtDate(s.consultationDate);
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const da = a.split("/").reverse().join("");
    const db = b.split("/").reverse().join("");
    return activeTab === "pendentes" ? da.localeCompare(db) : db.localeCompare(da);
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>Gerenciamento de Consultas</h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Controle de agenda e atendimentos</p>
            </div>
          </div>
        </FadeIn>

        {/* Tabs */}
        <div className="flex p-1 rounded-2xl bg-[var(--secondary)]/50 border border-[var(--border)] overflow-x-auto no-scrollbar">
          {[
            { id: "pendentes", label: "Pendentes", count: pendentes.length, icon: Clock },
            { id: "realizadas", label: "Realizadas", count: realizadas.length, icon: CheckCircle2 },
            { id: "canceladas", label: "Canceladas", count: canceladas.length, icon: XCircle },
            { id: "reembolsos", label: "Reembolsos", count: refunds.filter((r: any) => r.refundStatus === "pending").length, icon: DollarSign },
            { id: "gerenciar", label: "Gerenciar Agenda", icon: Calendar }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? "bg-[var(--card)] text-[var(--primary)] shadow-sm border border-[var(--border)]" 
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {"count" in tab && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "reembolsos" ? (
            <motion.div key="reembolsos" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {loadingRefunds ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted-foreground)]">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                  <p className="text-sm font-medium">Carregando reembolsos...</p>
                </div>
              ) : refunds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
                  <DollarSign className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Nenhuma solicitação de reembolso.</p>
                </div>
              ) : (
                <>
                  {/* Pendentes */}
                  {(() => {
                    const pending = refunds.filter((r: any) => r.refundStatus === "pending");
                    if (pending.length === 0) return null;
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                          <div className="h-px flex-1 bg-[var(--border)]" />
                          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Aguardando Aprovação ({pending.length})</span>
                          </div>
                          <div className="h-px flex-1 bg-[var(--border)]" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {pending.map((r: any) => (
                            <motion.div key={r.id} layout className="rounded-2xl p-5 border-2 border-amber-300 dark:border-amber-700 bg-[var(--card)] shadow-xl">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                    <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-[var(--foreground)]">{r.clientName || "Cliente"}</p>
                                    <p className="text-[10px] text-[var(--muted-foreground)]">{fmtDate(r.consultationDate)} às {r.consultationTime}</p>
                                  </div>
                                </div>
                                <CompanyBadge company={r.company} />
                              </div>
                              <div className="space-y-1.5 mb-4">
                                {r.clientPhone && (
                                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                    <Phone className="w-3 h-3 text-green-500" />
                                    {r.clientPhone}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                  <Package className="w-3 h-3 text-purple-500" />
                                  {r.productName || "Consulta"}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                  <User className="w-3 h-3 text-blue-500" />
                                  Vendedor: {r.sellerName || r.sellerUsername || "—"}
                                </div>
                                {r.amount && (
                                  <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--primary)" }}>
                                    <DollarSign className="w-3.5 h-3.5" />
                                    {Number(r.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                  </div>
                                )}
                                {r.cancelReason && (
                                  <div className="mt-2 p-2 rounded-lg bg-[var(--secondary)] text-xs italic text-[var(--muted-foreground)] border border-[var(--border)]">
                                    Motivo: {r.cancelReason}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    if (confirmApproveRefundId === r.id) {
                                      approveRefundMutation.mutate({ id: r.id });
                                      setConfirmApproveRefundId(null);
                                    } else {
                                      setConfirmApproveRefundId(r.id);
                                      setConfirmRejectRefundId(null);
                                    }
                                  }}
                                  disabled={approveRefundMutation.isPending}
                                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                                  style={{ background: "#22c55e" }}
                                >
                                  {approveRefundMutation.isPending && approveRefundMutation.variables?.id === r.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <ThumbsUp className="w-4 h-4" />}
                                  {confirmApproveRefundId === r.id ? "Confirmar Aprovação" : "Aprovar"}
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    if (confirmRejectRefundId === r.id) {
                                      rejectRefundMutation.mutate({ id: r.id });
                                      setConfirmRejectRefundId(null);
                                    } else {
                                      setConfirmRejectRefundId(r.id);
                                      setConfirmApproveRefundId(null);
                                    }
                                  }}
                                  disabled={rejectRefundMutation.isPending}
                                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                                  style={{ background: "#ef4444" }}
                                >
                                  {rejectRefundMutation.isPending && rejectRefundMutation.variables?.id === r.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <ThumbsDown className="w-4 h-4" />}
                                  {confirmRejectRefundId === r.id ? "Confirmar Rejeição" : "Rejeitar"}
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Histórico (aprovados/rejeitados) */}
                  {(() => {
                    const resolved = refunds.filter((r: any) => r.refundStatus === "approved" || r.refundStatus === "rejected");
                    if (resolved.length === 0) return null;
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                          <div className="h-px flex-1 bg-[var(--border)]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Histórico</span>
                          <div className="h-px flex-1 bg-[var(--border)]" />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {resolved.map((r: any) => {
                            const isApproved = r.refundStatus === "approved";
                            return (
                              <div key={r.id} className="rounded-2xl p-4 border border-[var(--border)] bg-[var(--card)] opacity-70">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isApproved ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                                      {isApproved ? <ThumbsUp className="w-3 h-3 text-green-600" /> : <ThumbsDown className="w-3 h-3 text-red-600" />}
                                    </div>
                                    <p className="text-sm font-bold text-[var(--foreground)]">{r.clientName || "Cliente"}</p>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isApproved ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                    {isApproved ? "Aprovado" : "Rejeitado"}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                                  <span>{fmtDate(r.consultationDate)} às {r.consultationTime}</span>
                                  {r.amount && <span className="font-bold">{Number(r.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                                  <span>Vendedor: {r.sellerName || r.sellerUsername || "—"}</span>
                                  <CompanyBadge company={r.company} />
                                </div>
                                {r.refundResolvedAt && (
                                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                                    Resolvido em {new Date(r.refundResolvedAt).toLocaleDateString("pt-BR")}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </motion.div>
          ) : activeTab === "gerenciar" ? (
            <motion.div key="gerenciar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-xl space-y-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Gerenciar Agenda</h2>
                <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Crie e gerencie horários de consulta</p>
              </div>

              <div className="max-w-md mx-auto">
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>Data</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl outline-none border border-[var(--border)] font-bold"
                  style={{ background: "var(--secondary)", color: "var(--foreground)" }}
                />
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Horário Específico</label>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                  {TIME_OPTIONS.map(time => {
                    const alreadyExists = slots.some(s => s.consultationDate === selectedDate && s.consultationTime === time);
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(isSelected ? "" : time)}
                        disabled={alreadyExists || createSlotsMutation.isPending}
                        className={`px-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          alreadyExists
                            ? "opacity-30 cursor-not-allowed line-through"
                            : isSelected
                              ? "ring-2 ring-[var(--primary)] scale-105"
                              : "hover:scale-105 active:scale-95"
                        }`}
                        style={{
                          background: isSelected ? "var(--primary)" : "var(--secondary)",
                          color: isSelected ? "white" : "var(--foreground)",
                          border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                        }}
                        title={alreadyExists ? "Já cadastrado" : ""}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
                <button 
                  onClick={handleCreateSingleSlot} 
                  disabled={createSlotsMutation.isPending || !selectedTime}
                  className="w-full py-3 rounded-xl font-bold text-white bg-[var(--primary)] shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createSlotsMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  {selectedTime ? `Criar ${selectedTime} em ${fmtDate(selectedDate)}` : "Selecione um horário"}
                </button>
              </div>

              <div className="max-w-2xl mx-auto rounded-2xl p-5 border border-[var(--border)]" style={{ background: "var(--card)" }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: "var(--foreground)" }}>
                  Todos os Horários
                </h2>
                {loadingAll ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
                    Nenhum horário cadastrado ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...slots]
                      .sort((a: any, b: any) => {
                        const dateComp = String(a.consultationDate).localeCompare(String(b.consultationDate));
                        return dateComp !== 0 ? dateComp : a.consultationTime.localeCompare(b.consultationTime);
                      })
                      .map((s: any) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all"
                          style={{
                            background: s.sold ? (isDark ? "rgba(34, 197, 94, 0.05)" : "oklch(0.96 0.01 160)") : "var(--secondary)",
                            borderColor: s.sold ? (isDark ? "rgba(34, 197, 94, 0.2)" : "oklch(0.85 0.05 160)") : "var(--border)",
                          }}
                        >
                          <div>
                            <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                              {fmtDate(s.consultationDate)} — {s.consultationTime}
                            </p>
                            {s.sold && s.clientName && (
                              <p className="text-xs mt-0.5" style={{ color: isDark ? "#4ade80" : "oklch(0.45 0.12 160)" }}>
                                ✓ {s.clientName}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {s.sold ? (
                              <span className="text-xs px-2 py-1 rounded-lg font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Vendido
                              </span>
                            ) : confirmDeleteSlotId === s.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-red-500 mr-1">Confirmar?</span>
                                <button
                                  onClick={() => { deleteSlotMutation.mutate({ id: s.id }); setConfirmDeleteSlotId(null); }}
                                  disabled={deleteSlotMutation.isPending && deleteSlotMutation.variables?.id === s.id}
                                  className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all active:scale-90 disabled:opacity-50"
                                  title="Confirmar exclusão"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteSlotId(null)}
                                  className="p-1.5 rounded-lg bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] active:scale-90"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteSlotId(s.id)}
                                className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
                                title="Excluir horário"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                {!loadingAll && slots.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center mt-4" style={{ color: "var(--muted-foreground)" }}>
                    {slots.length} horário{slots.length !== 1 ? "s" : ""} no total
                    {" • "}{slots.filter((s: any) => s.sold).length} vendido{slots.filter((s: any) => s.sold).length !== 1 ? "s" : ""}
                    {" • "}{slots.filter((s: any) => !s.sold).length} disponíve{slots.filter((s: any) => !s.sold).length !== 1 ? "is" : "l"}
                  </p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted-foreground)]">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                  <p className="text-sm font-medium">Carregando consultas...</p>
                </div>
              ) : sortedDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
                  <ClipboardList className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Nenhuma consulta encontrada nesta categoria.</p>
                </div>
              ) : (
                sortedDates.map(date => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <div className="h-px flex-1 bg-[var(--border)]" />
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
                        <CalendarDays className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span className="text-xs font-bold text-[var(--foreground)]">{date}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--card)] text-[var(--muted-foreground)]">
                          {grouped[date].length}
                        </span>
                      </div>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {grouped[date].map(slot => (
                        <ConsultaCard 
                          key={slot.id} 
                          slot={slot} 
                          showDate={false}
                          onCancel={activeTab === "pendentes" ? () => setCancelModal({ id: slot.id, clientName: slot.clientName, sold: slot.sold }) : undefined}
                          onRestore={activeTab === "canceladas" ? () => {
                            if (confirmRestoreId === slot.id) {
                              restoreMutation.mutate({ id: slot.id });
                              setConfirmRestoreId(null);
                            } else {
                              setConfirmRestoreId(slot.id);
                              setConfirmDeleteCancelledId(null);
                            }
                          } : undefined}
                          onDelete={activeTab === "canceladas" ? () => {
                            if (confirmDeleteCancelledId === slot.id) {
                              deleteMutation.mutate({ id: slot.id });
                              setConfirmDeleteCancelledId(null);
                            } else {
                              setConfirmDeleteCancelledId(slot.id);
                              setConfirmRestoreId(null);
                            }
                          } : undefined}
                          cancelling={cancelMutation.isPending && cancelMutation.variables?.id === slot.id}
                          restoring={restoreMutation.isPending && restoreMutation.variables?.id === slot.id}
                          deleting={deleteMutation.isPending && deleteMutation.variables?.id === slot.id}
                          confirmingRestore={confirmRestoreId === slot.id}
                          confirmingDelete={confirmDeleteCancelledId === slot.id}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {cancelModal && (
            <CancelModal
              modalData={cancelModal}
              onClose={() => setCancelModal(null)}
              onConfirm={(reason, requestRefund) => {
                cancelMutation.mutate({ id: cancelModal.id, reason, requestRefund: !!requestRefund });
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
