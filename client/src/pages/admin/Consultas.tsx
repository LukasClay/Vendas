import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  Calendar, Clock, Plus, Trash2, Loader2, User, Phone,
  CalendarDays, CheckCircle2, ClipboardList, XCircle, RotateCcw, Ban, Unlock,
} from "lucide-react";

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

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SlotItem = {
  id: number;
  consultationDate: string | Date | null;
  consultationTime: string;
  clientName?: string | null;
  clientPhone?: string | null;
  clientBirthDate?: string | Date | null;
  notes?: string | null;
  saleDate?: string | Date | null;
  sold?: boolean;
  sellerName?: string | null;
  sellerUsername?: string | null;
  cancelledAt?: Date | null;
  effectiveStatus?: string;
};

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
}: {
  slot: SlotItem;
  showDate?: boolean;
  onCancel?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  cancelling?: boolean;
  restoring?: boolean;
  deleting?: boolean;
}) {
  const sellerDisplay = slot.sellerName || slot.sellerUsername || null;
  const isCancelled = slot.effectiveStatus === "cancelada";

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isCancelled ? "oklch(0.97 0.005 25)" : "oklch(0.97 0.006 65)",
        border: `1px solid ${isCancelled ? "oklch(0.88 0.015 25)" : "oklch(0.90 0.010 65)"}`,
        opacity: isCancelled ? 0.85 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: isCancelled ? "oklch(0.92 0.04 25)" : "oklch(0.92 0.04 280)" }}
          >
            <Clock className="w-4 h-4" style={{ color: isCancelled ? "oklch(0.55 0.18 25)" : "oklch(0.55 0.18 280)" }} />
          </div>
          <div>
            {showDate && (
              <p className="text-xs font-semibold" style={{ color: isCancelled ? "oklch(0.55 0.18 25)" : "oklch(0.55 0.18 280)" }}>
                {fmtDate(slot.consultationDate)}
              </p>
            )}
            <p className="text-base font-bold" style={{ color: "oklch(0.15 0.02 260)" }}>
              {slot.consultationTime}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {slot.saleDate && (
            <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
              Venda: {fmtDate(slot.saleDate)}
            </span>
          )}
          {/* Botão Cancelar (apenas para pendentes com venda) */}
          {onCancel && slot.sold && !isCancelled && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "oklch(0.94 0.04 25)", color: "oklch(0.50 0.20 25)", border: "1px solid oklch(0.85 0.08 25)" }}
              title="Cancelar consulta"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
              Cancelar
            </button>
          )}
          {/* Botão Restaurar (apenas para canceladas — ADM) */}
          {onRestore && isCancelled && (
            <button
              onClick={onRestore}
              disabled={restoring}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "oklch(0.94 0.04 160)", color: "oklch(0.40 0.15 160)", border: "1px solid oklch(0.85 0.08 160)" }}
              title="Restaurar consulta"
            >
              {restoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Restaurar
            </button>
          )}
          {/* Botão Liberar Horário (apenas para canceladas — ADM) */}
          {onDelete && isCancelled && (
            <button
              onClick={onDelete}
              disabled={deleting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.015 260)", border: "1px solid oklch(0.85 0.012 65)" }}
              title="Liberar horário (apagar permanentemente)"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
              Liberar
            </button>
          )}
        </div>
      </div>

      {slot.clientName && (
        <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid oklch(0.92 0.008 65)" }}>
          {sellerDisplay && (
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.55 0.18 280)" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.55 0.18 280)" }}>Vendedor:</span>
              <span className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{sellerDisplay}</span>
            </div>
          )}
          {sellerDisplay && (
            <div style={{ height: "1px", background: "oklch(0.92 0.008 65)", margin: "4px 0" }} />
          )}
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.60 0.01 260)" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.60 0.01 260)" }}>Cliente:</span>
            <span className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{slot.clientName}</span>
          </div>
          {slot.clientBirthDate && (
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.60 0.01 260)" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.60 0.01 260)" }}>Nasc.:</span>
              <span className="text-sm" style={{ color: "oklch(0.45 0.015 260)" }}>{fmtDate(slot.clientBirthDate)}</span>
            </div>
          )}
          {slot.clientPhone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.60 0.01 260)" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "oklch(0.60 0.01 260)" }}>Tel.:</span>
              <span className="text-sm" style={{ color: "oklch(0.45 0.015 260)" }}>{slot.clientPhone}</span>
            </div>
          )}
          {slot.notes && (
            <p className="text-xs mt-1 italic" style={{ color: "oklch(0.52 0.015 260)" }}>
              Obs: {slot.notes}
            </p>
          )}
          {/* Informação de cancelamento */}
          {isCancelled && slot.cancelledAt && (
            <p className="text-xs mt-1 font-medium" style={{ color: "oklch(0.55 0.18 25)" }}>
              Cancelada em: {fmtDate(slot.cancelledAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = "pendentes" | "realizadas" | "canceladas" | "gerenciar";

export default function AdminConsultas() {
  const [activeTab, setActiveTab] = useState<Tab>("pendentes");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: pending = [], isLoading: loadingPending } = trpc.consultationSlots.listPending.useQuery();
  const { data: done = [], isLoading: loadingDone } = trpc.consultationSlots.listDone.useQuery();
  const { data: cancelled = [], isLoading: loadingCancelled } = trpc.consultationSlots.listCancelled.useQuery();
  const { data: allSlots = [], isLoading: loadingAll } = trpc.consultationSlots.listAll.useQuery();

  const invalidateAll = () => {
    utils.consultationSlots.listPending.invalidate();
    utils.consultationSlots.listDone.invalidate();
    utils.consultationSlots.listCancelled.invalidate();
    utils.consultationSlots.listAll.invalidate();
    utils.consultationSlots.listAvailable.invalidate();
  };

  const createSlot = trpc.consultationSlots.create.useMutation({
    onSuccess: () => {
      toast.success("Horário adicionado com sucesso!");
      setNewDate("");
      setNewTime("");
      invalidateAll();
    },
    onError: (err) => toast.error(err.message || "Erro ao adicionar horário."),
  });

  const deleteSlot = trpc.consultationSlots.delete.useMutation({
    onSuccess: () => {
      toast.success("Horário removido.");
      invalidateAll();
    },
    onError: (err) => toast.error(err.message || "Erro ao remover horário."),
  });

  const cancelSlot = trpc.consultationSlots.cancel.useMutation({
    onSuccess: () => {
      toast.success("Consulta cancelada.");
      setCancellingId(null);
      invalidateAll();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cancelar consulta.");
      setCancellingId(null);
    },
  });

  const deleteCancelledSlot = trpc.consultationSlots.deleteCancelled.useMutation({
    onSuccess: () => {
      toast.success("Horário liberado. Pode ser recadastrado agora.");
      setDeletingId(null);
      invalidateAll();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao liberar horário.");
      setDeletingId(null);
    },
  });

  const restoreSlot = trpc.consultationSlots.restore.useMutation({
    onSuccess: () => {
      toast.success("Consulta restaurada para pendente.");
      setRestoringId(null);
      invalidateAll();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao restaurar consulta.");
      setRestoringId(null);
    },
  });

  const handleAddSlot = () => {
    if (!newDate) { toast.error("Selecione a data."); return; }
    if (!newTime) { toast.error("Selecione o horário."); return; }
    createSlot.mutate({ consultationDate: newDate, consultationTime: newTime });
  };

  const handleCancel = (id: number) => {
    if (!window.confirm("Tem certeza que deseja cancelar esta consulta?")) return;
    setCancellingId(id);
    cancelSlot.mutate({ id });
  };

  const handleRestore = (id: number) => {
    if (!window.confirm("Restaurar esta consulta para pendente?")) return;
    setRestoringId(id);
    restoreSlot.mutate({ id });
  };

  const handleDeleteCancelled = (id: number) => {
    if (!window.confirm("Liberar este horário permanentemente?\nO slot será apagado e poderá ser recadastrado depois.")) return;
    setDeletingId(id);
    deleteCancelledSlot.mutate({ id });
  };

  // Agrupa por data
  function groupByDate<T extends { consultationDate: string | Date | null }>(items: T[]) {
    return items.reduce<Record<string, T[]>>((acc, s) => {
      const key = String(s.consultationDate).slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
  }

  const pendingByDate = groupByDate(pending);
  const doneByDate = groupByDate(done);
  const cancelledByDate = groupByDate(cancelled);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.15s",
    background: activeTab === t ? "oklch(0.55 0.18 280)" : "transparent",
    color: activeTab === t ? "white" : "oklch(0.45 0.015 260)",
    border: "none",
    whiteSpace: "nowrap" as const,
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.65 0.20 290))" }}
          >
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Consultas
            </h1>
            <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>
              Gerenciamento de Consulta Cartas
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl overflow-x-auto" style={{ background: "oklch(0.94 0.008 65)" }}>
          <button style={tabStyle("pendentes")} onClick={() => setActiveTab("pendentes")}>
            <ClipboardList className="w-4 h-4 inline mr-1" />
            Pendentes {pending.length > 0 && `(${pending.length})`}
          </button>
          <button style={tabStyle("realizadas")} onClick={() => setActiveTab("realizadas")}>
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            Realizadas {done.length > 0 && `(${done.length})`}
          </button>
          <button style={tabStyle("canceladas")} onClick={() => setActiveTab("canceladas")}>
            <XCircle className="w-4 h-4 inline mr-1" />
            Canceladas {cancelled.length > 0 && `(${cancelled.length})`}
          </button>
          <button style={tabStyle("gerenciar")} onClick={() => setActiveTab("gerenciar")}>
            <Plus className="w-4 h-4 inline mr-1" />
            Gerenciar
          </button>
        </div>

        {/* ── Consultas Pendentes ── */}
        {activeTab === "pendentes" && (
          <div>
            {loadingPending ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.55 0.18 280)" }} />
              </div>
            ) : Object.keys(pendingByDate).length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="w-10 h-10 mx-auto mb-3" style={{ color: "oklch(0.75 0.01 260)" }} />
                <p className="font-medium" style={{ color: "oklch(0.40 0.02 260)" }}>Nenhuma consulta pendente</p>
                <p className="text-sm mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>
                  As consultas agendadas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(pendingByDate).map(([dateKey, slots]) => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4" style={{ color: "oklch(0.50 0.18 280)" }} />
                      <h3 className="font-bold text-base tracking-wide" style={{ color: "oklch(0.25 0.05 260)", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.02em" }}>
                        {fmtDate(dateKey)}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.45 0.18 280)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                        {slots.length} consulta{slots.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {slots.map(slot => (
                        <ConsultaCard
                          key={slot.id}
                          slot={{ ...slot, effectiveStatus: "pendente" }}
                          showDate={false}
                          onCancel={() => handleCancel(slot.id)}
                          cancelling={cancellingId === slot.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Consultas Realizadas ── */}
        {activeTab === "realizadas" && (
          <div>
            {loadingDone ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.55 0.18 280)" }} />
              </div>
            ) : Object.keys(doneByDate).length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: "oklch(0.75 0.01 260)" }} />
                <p className="font-medium" style={{ color: "oklch(0.40 0.02 260)" }}>Nenhuma consulta realizada ainda</p>
                <p className="text-sm mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>
                  O histórico de consultas passadas aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(doneByDate).map(([dateKey, slots]) => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.50 0.15 160)" }} />
                      <h3 className="font-bold text-base tracking-wide" style={{ color: "oklch(0.25 0.05 260)", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.02em" }}>
                        {fmtDate(dateKey)}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {slots.map(slot => (
                        <ConsultaCard key={slot.id} slot={slot} showDate={false} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Consultas Canceladas ── */}
        {activeTab === "canceladas" && (
          <div>
            {loadingCancelled ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.55 0.18 280)" }} />
              </div>
            ) : Object.keys(cancelledByDate).length === 0 ? (
              <div className="text-center py-16">
                <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "oklch(0.75 0.01 260)" }} />
                <p className="font-medium" style={{ color: "oklch(0.40 0.02 260)" }}>Nenhuma consulta cancelada</p>
                <p className="text-sm mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>
                  Consultas canceladas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(cancelledByDate).map(([dateKey, slots]) => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="w-4 h-4" style={{ color: "oklch(0.55 0.18 25)" }} />
                      <h3 className="font-bold text-base tracking-wide" style={{ color: "oklch(0.25 0.05 260)", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.02em" }}>
                        {fmtDate(dateKey)}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "oklch(0.92 0.04 25)", color: "oklch(0.50 0.18 25)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                        {slots.length} cancelada{slots.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {slots.map(slot => (
                        <ConsultaCard
                          key={slot.id}
                          slot={{ ...slot, effectiveStatus: "cancelada" }}
                          showDate={false}
                          onRestore={() => handleRestore(slot.id)}
                          restoring={restoringId === slot.id}
                          onDelete={() => handleDeleteCancelled(slot.id)}
                          deleting={deletingId === slot.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Gerenciar Horários ── */}
        {activeTab === "gerenciar" && (
          <div className="space-y-5">

            {/* Formulário de adicionar */}
            <div className="rounded-2xl p-5 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.15 0.02 260)" }}>
                Adicionar Novo Horário de Consulta
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.40 0.02 260)" }}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                    style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.40 0.02 260)" }}>
                    Horário
                  </label>
                  <select
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none cursor-pointer"
                    style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: newTime ? "oklch(0.15 0.02 260)" : "oklch(0.60 0.01 260)" }}
                  >
                    <option value="" disabled>Selecionar...</option>
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddSlot}
                disabled={createSlot.isPending || !newDate || !newTime}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.65 0.20 290))" }}
              >
                {createSlot.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Adicionando...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Adicionar Horário</>
                )}
              </button>
            </div>

            {/* Lista de todos os slots (não cancelados) */}
            <div className="rounded-2xl p-5 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.15 0.02 260)" }}>
                Todos os Horários Cadastrados
              </h2>

              {loadingAll ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "oklch(0.55 0.18 280)" }} />
                </div>
              ) : allSlots.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "oklch(0.60 0.01 260)" }}>
                  Nenhum horário cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {allSlots.map(slot => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                      style={{
                        background: slot.sold ? "oklch(0.96 0.01 160)" : "oklch(0.97 0.008 65)",
                        border: `1px solid ${slot.sold ? "oklch(0.85 0.05 160)" : "oklch(0.90 0.010 65)"}`,
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>
                          {fmtDate(slot.consultationDate)} — {slot.consultationTime}
                        </p>
                        {slot.sold && slot.clientName && (
                          <div className="mt-0.5 space-y-0.5">
                            <p className="text-xs" style={{ color: "oklch(0.45 0.12 160)" }}>
                              ✓ <span className="font-medium">{slot.clientName}</span>
                            </p>
                            {(slot.sellerName || slot.sellerUsername) && (
                              <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>
                                Vendedor: {slot.sellerName || slot.sellerUsername}
                              </p>
                            )}
                            {slot.clientPhone && (
                              <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>
                                Tel: {slot.clientPhone}
                              </p>
                            )}
                            {slot.clientBirthDate && (
                              <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>
                                Nasc: {fmtDate(slot.clientBirthDate)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {slot.sold ? (
                          <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "oklch(0.88 0.08 160)", color: "oklch(0.35 0.15 160)" }}>
                            Vendido
                          </span>
                        ) : (
                          <button
                            onClick={() => deleteSlot.mutate({ id: slot.id })}
                            disabled={deleteSlot.isPending}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: "oklch(0.58 0.22 25)" }}
                            title="Remover horário"
                          >
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
        )}
      </div>
    </DashboardLayout>
  );
}
