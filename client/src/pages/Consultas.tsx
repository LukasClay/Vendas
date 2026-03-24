import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  Calendar, Clock, Plus, Trash2, Loader2, User, Phone,
  CalendarDays, CheckCircle2, ClipboardList, XCircle, Ban,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "@/components/Animations";

// ─── Componente isolado: CancelModal (evita re-render em cascata) ────────────
function CancelModal({ modalData, onClose, onConfirm, isAdmin }: {
  modalData: { id: number; clientName?: string | null };
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isAdmin: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-xl" style={{ background: isAdmin ? "var(--card)" : "white" }}>
        <h3 className="text-base font-bold mb-1" style={{ color: isAdmin ? "var(--foreground)" : "#111111", fontFamily: "'Playfair Display', serif" }}>
          Cancelar Consulta
        </h3>
        {modalData.clientName && (
          <p className="text-sm mb-4" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>
            Cliente: <span className="font-semibold">{modalData.clientName}</span>
          </p>
        )}
        <label className="block text-xs font-semibold mb-1.5" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>
          Motivo do cancelamento <span style={{ color: isAdmin ? "var(--muted-foreground)" : "#8888a0" }}>(opcional)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: cliente desmarcou, conflito de agenda..."
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
          style={{
            background: isAdmin ? "var(--secondary)" : "#faf8f4",
            border: isAdmin ? "1px solid var(--border)" : "1px solid #e0e0e0",
            color: isAdmin ? "var(--foreground)" : "#111111",
          }}
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: isAdmin ? "var(--secondary)" : "#f0f0f0", color: isAdmin ? "var(--foreground)" : "#6b6b80" }}
          >
            Voltar
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "#c0392b" }}
          >
            Confirmar Cancelamento
          </button>
        </div>
      </div>
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
  cancelReason?: string | null;
  effectiveStatus?: string;
};

// ─── Card de Consulta ─────────────────────────────────────────────────────────

function ConsultaCard({
  slot,
  showDate = true,
  onCancel,
  cancelling = false,
  isAdmin = false,
}: {
  slot: SlotItem;
  showDate?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
  isAdmin?: boolean;
}) {
  const sellerDisplay = slot.sellerName || slot.sellerUsername || null;
  const isCancelled = slot.effectiveStatus === "cancelada";

  const cardStyle = {
    background: isCancelled ? (isAdmin ? "rgba(var(--destructive-rgb), 0.1)" : "#fff5f5") : (isAdmin ? "var(--card)" : "white"),
    border: `1px solid ${isCancelled ? (isAdmin ? "var(--destructive)" : "#feb2b2") : (isAdmin ? "var(--border)" : "#e0e0e0")}`,
    opacity: isCancelled ? 0.85 : 1,
  };

  return (
    <div className="rounded-2xl p-4 shadow-sm" style={cardStyle}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: isCancelled ? (isAdmin ? "rgba(var(--destructive-rgb), 0.2)" : "#fed7d7") : (isAdmin ? "var(--secondary)" : "#f0f7ff") }}>
            <Clock className="w-5 h-5" style={{ color: isCancelled ? (isAdmin ? "var(--destructive)" : "#c53030") : (isAdmin ? "var(--primary)" : "#3182ce") }} />
          </div>
          <div>
            {showDate && (
              <p className="text-xs font-semibold mb-0.5" style={{ color: isCancelled ? (isAdmin ? "var(--destructive)" : "#c53030") : (isAdmin ? "var(--primary)" : "#3182ce") }}>
                {fmtDate(slot.consultationDate)}
              </p>
            )}
            <p className="text-lg font-bold" style={{ color: isAdmin ? "var(--foreground)" : "#111111" }}>
              {slot.consultationTime}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {slot.saleDate && (
            <span className="text-xs px-2 py-1 rounded-lg" style={{ background: isAdmin ? "var(--secondary)" : "#f7fafc", color: isAdmin ? "var(--muted-foreground)" : "#4a5568" }}>
              Venda: {fmtDate(slot.saleDate)}
            </span>
          )}
          {onCancel && slot.sold && !isCancelled && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: "#fff5f5", color: "#c53030", border: "1px solid #feb2b2" }}
              title="Cancelar consulta"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
              Cancelar
            </button>
          )}
        </div>
      </div>

      {slot.clientName && (
        <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: `1px solid ${isAdmin ? "var(--border)" : "#f0f0f0"}` }}>
          {sellerDisplay && (
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 shrink-0" style={{ color: "#3182ce" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#3182ce" }}>Vendedor:</span>
              <span className="text-sm font-medium" style={{ color: isAdmin ? "var(--foreground)" : "#111111" }}>{sellerDisplay}</span>
            </div>
          )}
          {sellerDisplay && (
            <div style={{ height: "1px", background: isAdmin ? "var(--border)" : "#f0f0f0", margin: "4px 0" }} />
          )}
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 shrink-0" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Cliente:</span>
            <span className="text-sm font-medium" style={{ color: isAdmin ? "var(--foreground)" : "#111111" }}>{slot.clientName}</span>
          </div>
          {slot.clientBirthDate && (
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Nasc.:</span>
              <span className="text-sm" style={{ color: isAdmin ? "var(--muted-foreground)" : "#4a5568" }}>{fmtDate(slot.clientBirthDate)}</span>
            </div>
          )}
          {slot.clientPhone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: isAdmin ? "var(--muted-foreground)" : "#6b6b80" }}>Tel.:</span>
              <span className="text-sm" style={{ color: isAdmin ? "var(--muted-foreground)" : "#4a5568" }}>{slot.clientPhone}</span>
            </div>
          )}
          {slot.notes && (
            <p className="text-xs mt-1 italic" style={{ color: isAdmin ? "var(--muted-foreground)" : "#718096" }}>
              Obs: {slot.notes}
            </p>
          )}
          {isCancelled && slot.cancelledAt && (
            <p className="text-xs mt-1 font-medium" style={{ color: "#c53030" }}>
              Cancelada em: {fmtDate(slot.cancelledAt)}
            </p>
          )}
          {isCancelled && slot.cancelReason && (
            <p className="text-xs mt-0.5 italic" style={{ color: "#c53030" }}>
              Motivo: {slot.cancelReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = "pendentes" | "realizadas" | "canceladas" | "gerenciar";

export default function Consultas() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { resolvedTheme } = useTheme();
  const isDark = isAdmin && resolvedTheme === "dark";

  const [activeTab, setActiveTab] = useState<Tab>("pendentes");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelModal, setCancelModal] = useState<{ id: number; clientName?: string | null } | null>(null);

  const utils = trpc.useUtils();

  const { data: pending = [], isLoading: loadingPending } = trpc.consultationSlots.listPending.useQuery();
  const { data: done = [], isLoading: loadingDone } = trpc.consultationSlots.listDone.useQuery();
  const { data: cancelled = [], isLoading: loadingCancelled } = trpc.consultationSlots.listCancelled.useQuery();
  const { data: allSlots = [], isLoading: loadingAll } = trpc.consultationSlots.listAll.useQuery();

  const createSlot = trpc.consultationSlots.create.useMutation({
    onSuccess: () => {
      toast.success("Horário criado com sucesso!");
      setNewDate("");
      setNewTime("");
      utils.consultationSlots.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSlot = trpc.consultationSlots.delete.useMutation({
    onSuccess: () => {
      toast.success("Horário excluído!");
      utils.consultationSlots.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmCancelMutation = trpc.consultationSlots.cancel.useMutation({
    onSuccess: () => {
      toast.success("Consulta cancelada!");
      setCancelModal(null);
      utils.consultationSlots.listPending.invalidate();
      utils.consultationSlots.listCancelled.invalidate();
    },
    onSettled: () => setCancellingId(null),
    onError: (err) => toast.error(err.message),
  });

  const handleCancel = (id: number, reason: string) => {
    setCancellingId(id);
    confirmCancelMutation.mutate({ id, cancelReason: reason });
  };

  const Content = (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: isAdmin ? "var(--foreground)" : "#111111" }}>
            Consultas
          </h1>
          <p className="text-sm" style={{ color: isAdmin ? "var(--muted-foreground)" : "#8888a0" }}>
            Gerencie horários e atendimentos de cartomancia
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("gerenciar")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "gerenciar" ? "bg-[#c17f24] text-white shadow-lg" : "bg-white text-[#c17f24] border border-[#c17f24]/30"}`}
            >
              <Plus className="w-4 h-4" /> Criar Horários
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 p-1 rounded-2xl overflow-x-auto no-scrollbar" style={{ background: isAdmin ? "var(--secondary)" : "#f0f0f0" }}>
        {[
          { id: "pendentes", label: "Pendentes", icon: Clock, count: pending.length },
          { id: "realizadas", label: "Realizadas", icon: CheckCircle2, count: done.length },
          { id: "canceladas", label: "Canceladas", icon: XCircle, count: cancelled.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${activeTab === tab.id ? (isAdmin ? "bg-var(--card) text-var(--primary) shadow-sm" : "bg-white text-[#c17f24] shadow-sm") : "text-[#8888a0] hover:text-[#c17f24]"}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#c17f24]/10 text-[10px]">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {activeTab === "pendentes" && (
          loadingPending ? (
            <div className="col-span-full py-12 flex flex-col items-center gap-3 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Carregando consultas pendentes...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-3xl border-2 border-dashed border-[#e0e0e0] opacity-50">
              <p className="text-sm italic">Nenhuma consulta pendente.</p>
            </div>
          ) : (
            pending.map(slot => (
              <ConsultaCard
                key={slot.id}
                slot={slot}
                isAdmin={isAdmin}
                onCancel={() => setCancelModal({ id: slot.id, clientName: slot.clientName })}
                cancelling={cancellingId === slot.id}
              />
            ))
          )
        )}

        {activeTab === "realizadas" && (
          loadingDone ? (
            <div className="col-span-full py-12 flex flex-col items-center gap-3 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Carregando consultas realizadas...</p>
            </div>
          ) : done.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-3xl border-2 border-dashed border-[#e0e0e0] opacity-50">
              <p className="text-sm italic">Nenhuma consulta realizada.</p>
            </div>
          ) : (
            done.map(slot => <ConsultaCard key={slot.id} slot={slot} isAdmin={isAdmin} />)
          )
        )}

        {activeTab === "canceladas" && (
          loadingCancelled ? (
            <div className="col-span-full py-12 flex flex-col items-center gap-3 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Carregando consultas canceladas...</p>
            </div>
          ) : cancelled.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-3xl border-2 border-dashed border-[#e0e0e0] opacity-50">
              <p className="text-sm italic">Nenhuma consulta cancelada.</p>
            </div>
          ) : (
            cancelled.map(slot => <ConsultaCard key={slot.id} slot={slot} isAdmin={isAdmin} />)
          )
        )}

        {activeTab === "gerenciar" && isAdmin && (
          <div className="col-span-full space-y-6">
            <div className="rounded-3xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Plus className="w-4 h-4 text-[#c17f24]" /> Novo Horário
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase ml-1" style={{ color: "var(--muted-foreground)" }}>Data</label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20"
                    style={{ border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase ml-1" style={{ color: "var(--muted-foreground)" }}>Horário</label>
                  <select value={newTime} onChange={e => setNewTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c17f24]/20"
                    style={{ border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}>
                    <option value="">Selecione...</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button
                  disabled={!newDate || !newTime || createSlot.isLoading}
                  onClick={() => createSlot.mutate({ consultationDate: newDate, consultationTime: newTime })}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all disabled:opacity-50"
                  style={{ background: "#c17f24" }}
                >
                  {createSlot.isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Criar Horário"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <ClipboardList className="w-4 h-4 text-[#c17f24]" /> Todos os Horários
              </h2>
              {loadingAll ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin opacity-30" /></div>
              ) : allSlots.length === 0 ? (
                <p className="text-center py-8 text-sm italic opacity-50">Nenhum horário criado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b" style={{ borderColor: "var(--border)" }}>
                        <th className="pb-3 font-bold uppercase text-[10px]" style={{ color: "var(--muted-foreground)" }}>Data/Hora</th>
                        <th className="pb-3 font-bold uppercase text-[10px]" style={{ color: "var(--muted-foreground)" }}>Status</th>
                        <th className="pb-3 font-bold uppercase text-[10px]" style={{ color: "var(--muted-foreground)" }}>Cliente</th>
                        <th className="pb-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {allSlots.map(slot => (
                        <tr key={slot.id}>
                          <td className="py-3">
                            <p className="font-bold">{fmtDate(slot.consultationDate)}</p>
                            <p className="text-xs opacity-60">{slot.consultationTime}</p>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${slot.sold ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                              {slot.sold ? "Vendido" : "Disponível"}
                            </span>
                          </td>
                          <td className="py-3">
                            <p className="text-xs font-medium">{slot.clientName || "—"}</p>
                            {slot.sellerName && <p className="text-[10px] opacity-60">Por: {slot.sellerName}</p>}
                          </td>
                          <td className="py-3 text-right">
                            {!slot.sold && (
                              <button
                                onClick={() => { if (confirm("Excluir este horário?")) deleteSlot.mutate(slot.id); }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {cancelModal && (
        <CancelModal
          modalData={cancelModal}
          isAdmin={isAdmin}
          onClose={() => setCancelModal(null)}
          onConfirm={(reason) => handleCancel(cancelModal.id, reason)}
        />
      )}
    </div>
  );

  return (
    <DashboardLayout>
      {isAdmin ? <FadeIn>{Content}</FadeIn> : Content}
    </DashboardLayout>
  );
}
