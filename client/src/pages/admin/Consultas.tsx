import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  Calendar, Clock, Plus, Trash2, Loader2, User, Phone,
  CalendarDays, CheckCircle2, ClipboardList,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  const [y, m, day] = s.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}
const TIME_OPTIONS = generateTimeOptions();

// ─── Card de Consulta ─────────────────────────────────────────────────────────

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
};

function ConsultaCard({ slot, showDate = true }: { slot: SlotItem; showDate?: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "oklch(0.97 0.006 65)", border: "1px solid oklch(0.90 0.010 65)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.92 0.04 280)" }}>
            <Clock className="w-4 h-4" style={{ color: "oklch(0.55 0.18 280)" }} />
          </div>
          <div>
            {showDate && (
              <p className="text-xs font-semibold" style={{ color: "oklch(0.55 0.18 280)" }}>
                {fmtDate(slot.consultationDate)}
              </p>
            )}
            <p className="text-base font-bold" style={{ color: "oklch(0.15 0.02 260)" }}>
              {slot.consultationTime}
            </p>
          </div>
        </div>
        {slot.saleDate && (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
            Venda: {fmtDate(slot.saleDate)}
          </span>
        )}
      </div>
      {slot.clientName && (
        <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid oklch(0.92 0.008 65)" }}>
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.60 0.01 260)" }} />
            <span className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{slot.clientName}</span>
          </div>
          {slot.clientBirthDate && (
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.60 0.01 260)" }} />
              <span className="text-sm" style={{ color: "oklch(0.45 0.015 260)" }}>{fmtDate(slot.clientBirthDate)}</span>
            </div>
          )}
          {slot.clientPhone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "oklch(0.60 0.01 260)" }} />
              <span className="text-sm" style={{ color: "oklch(0.45 0.015 260)" }}>{slot.clientPhone}</span>
            </div>
          )}
          {slot.notes && (
            <p className="text-xs mt-1 italic" style={{ color: "oklch(0.52 0.015 260)" }}>
              Obs: {slot.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = "pendentes" | "realizadas" | "gerenciar";

export default function AdminConsultas() {
  const [activeTab, setActiveTab] = useState<Tab>("pendentes");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const utils = trpc.useUtils();

  const { data: pending = [], isLoading: loadingPending } = trpc.consultationSlots.listPending.useQuery();
  const { data: done = [], isLoading: loadingDone } = trpc.consultationSlots.listDone.useQuery();
  const { data: allSlots = [], isLoading: loadingAll } = trpc.consultationSlots.listAll.useQuery();

  const createSlot = trpc.consultationSlots.create.useMutation({
    onSuccess: () => {
      toast.success("Horário adicionado com sucesso!");
      setNewDate("");
      setNewTime("");
      utils.consultationSlots.listAll.invalidate();
      utils.consultationSlots.listAvailable.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao adicionar horário."),
  });

  const deleteSlot = trpc.consultationSlots.delete.useMutation({
    onSuccess: () => {
      toast.success("Horário removido.");
      utils.consultationSlots.listAll.invalidate();
      utils.consultationSlots.listAvailable.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao remover horário."),
  });

  const handleAddSlot = () => {
    if (!newDate) { toast.error("Selecione a data."); return; }
    if (!newTime) { toast.error("Selecione o horário."); return; }
    createSlot.mutate({ consultationDate: newDate, consultationTime: newTime });
  };

  // Agrupa por data
  const pendingByDate = pending.reduce<Record<string, typeof pending>>((acc, s) => {
    const key = String(s.consultationDate).slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const doneByDate = done.reduce<Record<string, typeof done>>((acc, s) => {
    const key = String(s.consultationDate).slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.15s",
    background: activeTab === t ? "oklch(0.55 0.18 280)" : "transparent",
    color: activeTab === t ? "white" : "oklch(0.45 0.015 260)",
    border: "none",
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
        <div className="flex gap-1 mb-6 p-1 rounded-2xl" style={{ background: "oklch(0.94 0.008 65)" }}>
          <button style={tabStyle("pendentes")} onClick={() => setActiveTab("pendentes")}>
            <ClipboardList className="w-4 h-4 inline mr-1.5" />
            Pendentes {pending.length > 0 && `(${pending.length})`}
          </button>
          <button style={tabStyle("realizadas")} onClick={() => setActiveTab("realizadas")}>
            <CheckCircle2 className="w-4 h-4 inline mr-1.5" />
            Realizadas {done.length > 0 && `(${done.length})`}
          </button>
          <button style={tabStyle("gerenciar")} onClick={() => setActiveTab("gerenciar")}>
            <Plus className="w-4 h-4 inline mr-1.5" />
            Gerenciar Horários
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
                      <Calendar className="w-4 h-4" style={{ color: "oklch(0.55 0.18 280)" }} />
                      <h3 className="font-semibold text-sm" style={{ color: "oklch(0.55 0.18 280)" }}>
                        {fmtDate(dateKey)}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.45 0.15 280)" }}>
                        {slots.length} {slots.length === 1 ? "consulta" : "consultas"}
                      </span>
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
                      <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.55 0.15 160)" }} />
                      <h3 className="font-semibold text-sm" style={{ color: "oklch(0.45 0.12 160)" }}>
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

            {/* Lista de todos os slots */}
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
                          <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.12 160)" }}>
                            ✓ {slot.clientName}
                          </p>
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
