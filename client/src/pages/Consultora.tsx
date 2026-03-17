import { trpc } from "@/lib/trpc";
import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle2, Clock, AlertTriangle, Search, Copy, Check,
  ChevronDown, ChevronUp, User, Phone, Calendar, FileText,
  ShoppingBag, X, Pencil, Hourglass, BookCheck, ClipboardList,
  RotateCcw, Loader2
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

type Tab = "para_escrever" | "pendente" | "feito";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBirthDate(d: Date | string | null | undefined): string {
  return formatDate(d);
}

// Hook de cópia com fallback para celulares antigos
function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    const doFallback = () => {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopiedKey(key);
        toast.success("Copiado!");
        setTimeout(() => setCopiedKey(null), 2000);
      } catch {
        toast.error("Não foi possível copiar");
      }
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key);
        toast.success("Copiado!");
        setTimeout(() => setCopiedKey(null), 2000);
      }).catch(doFallback);
    } else {
      doFallback();
    }
  }, []);
  return { copy, copiedKey };
}

// ─── Badge de urgência ────────────────────────────────────────────────────────
function UrgencyBadge({ daysRemaining, isOverdue }: { daysRemaining: number; isOverdue: boolean }) {
  if (isOverdue) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.95 0.04 25)", color: "oklch(0.45 0.22 25)" }}>
      <AlertTriangle className="w-3 h-3" />
      {Math.abs(daysRemaining)}d atrasado
    </span>
  );
  if (daysRemaining <= 1) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.96 0.05 60)", color: "oklch(0.50 0.18 60)" }}>
      <Clock className="w-3 h-3" />
      Urgente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.08 65)" }}>
      <Clock className="w-3 h-3" />
      {daysRemaining}d restantes
    </span>
  );
}

// ─── Card: Para Escrever ──────────────────────────────────────────────────────
function ToWriteCard({ item, onMarkWritten }: {
  item: { id: number; clientName: string; clientBirthDate: Date | string | null; clientPhone: string | null; productName: string; saleDate: Date | string | null; notes: string | null };
  onMarkWritten: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { copy, copiedKey } = useCopy();

  const { data: history } = trpc.consultora.clientHistory.useQuery(
    { clientName: item.clientName }, { enabled: showHistory }
  );

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button onClick={() => copy(text, `${item.id}-${field}`)}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all"
      style={{ background: copiedKey === `${item.id}-${field}` ? "oklch(0.92 0.06 160)" : "oklch(0.92 0.008 65)", color: copiedKey === `${item.id}-${field}` ? "oklch(0.40 0.14 160)" : "oklch(0.45 0.10 65)" }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "white", border: "1.5px solid oklch(0.88 0.012 65)" }}>
      <button className="w-full flex items-center gap-3 px-4 py-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
          {item.clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>{item.productName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.50 0.12 65)" }}>
            {formatDate(item.saleDate)}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "oklch(0.52 0.015 260)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.52 0.015 260)" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid oklch(0.92 0.008 65)" }}>
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Nome</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</p>
                </div>
              </div>
              <CopyBtn text={item.clientName} field="name" />
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Nascimento</p>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>{formatBirthDate(item.clientBirthDate)}</p>
                </div>
              </div>
              <CopyBtn text={formatBirthDate(item.clientBirthDate)} field="birth" />
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Telefone</p>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientPhone}</p>
                  </div>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Observação</p>
                    <p className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.notes}</p>
                  </div>
                </div>
                <CopyBtn text={item.notes} field="notes" />
              </div>
            )}
            {/* Copiar tudo */}
            <button onClick={() => {
              const all = [`Nome: ${item.clientName}`, `Nascimento: ${formatBirthDate(item.clientBirthDate)}`, item.clientPhone ? `Telefone: ${item.clientPhone}` : null, item.notes ? `Obs: ${item.notes}` : null].filter(Boolean).join("\n");
              copy(all, `${item.id}-all`);
            }} className="w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: copiedKey === `${item.id}-all` ? "oklch(0.92 0.06 160)" : "oklch(0.94 0.02 65)", color: copiedKey === `${item.id}-all` ? "oklch(0.40 0.14 160)" : "oklch(0.35 0.05 65)", border: "1px solid oklch(0.88 0.012 65)" }}>
              {copiedKey === `${item.id}-all` ? <><Check className="w-4 h-4" /> Copiado!</> : <><ClipboardList className="w-4 h-4" /> Copiar Todos os Dados</>}
            </button>
          </div>

          {/* Histórico */}
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 text-sm font-medium py-1" style={{ color: "oklch(0.50 0.10 65)" }}>
            <ShoppingBag className="w-4 h-4" />
            {showHistory ? "Ocultar histórico" : "Ver histórico de compras"}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHistory && history && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.90 0.008 65)" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "oklch(0.96 0.015 65)", borderBottom: "1px solid oklch(0.90 0.008 65)" }}>
                  <span className="text-xs font-semibold" style={{ color: "oklch(0.30 0.02 260)" }}>{history.totalPurchases} trabalho{history.totalPurchases !== 1 ? "s" : ""} no total</span>
                </div>
                {history.purchases.length === 0 && <p className="px-4 py-3 text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhum trabalho registrado</p>}
                {history.purchases.slice(0, 5).map((p: { id: number; productName: string; saleDate: Date | string | null; workStatus: string }) => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid oklch(0.94 0.005 65)" }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "oklch(0.20 0.02 260)" }}>{p.productName}</p>
                      <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{formatDate(p.saleDate)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: p.workStatus === "feito" ? "oklch(0.92 0.06 160)" : "oklch(0.94 0.02 65)", color: p.workStatus === "feito" ? "oklch(0.40 0.14 160)" : "oklch(0.50 0.10 65)" }}>
                      {p.workStatus === "feito" ? "Feito" : p.workStatus === "pendente" ? "Pendente" : "Escrever"}
                    </span>
                  </div>
                ))}
              </div>
              {(history as any).totalConsultas > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.88 0.015 280)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "oklch(0.94 0.02 280)", borderBottom: "1px solid oklch(0.88 0.015 280)" }}>
                    <span className="text-xs font-semibold" style={{ color: "oklch(0.35 0.12 280)" }}>📅 {(history as any).totalConsultas} consulta{(history as any).totalConsultas !== 1 ? "s" : ""} de cartas</span>
                  </div>
                  {(history as any).consultas.map((c: { id: number; consultationDate: string; consultationTime: string }) => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid oklch(0.92 0.01 280)" }}>
                      <p className="text-xs font-medium" style={{ color: "oklch(0.20 0.02 260)" }}>Consulta Cartas</p>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.40 0.14 280)" }}>
                        {c.consultationDate ? c.consultationDate.slice(8,10)+"/"+c.consultationDate.slice(5,7)+"/"+c.consultationDate.slice(0,4) : ""} às {c.consultationTime}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botão marcar escrito */}
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.50 0.18 250), oklch(0.58 0.20 255))" }}>
              <Pencil className="w-5 h-5" /> Marcar como Escrito
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-center font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Confirmar que foi escrito?</p>
              <div className="flex gap-2">
                <button onClick={() => { onMarkWritten(item.id); setConfirming(false); }}
                  className="flex-1 py-3 rounded-xl text-white font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "oklch(0.50 0.18 160)" }}>
                  <Check className="w-4 h-4" /> Sim, confirmar
                </button>
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card: Pendente ───────────────────────────────────────────────────────────
function PendingCard({ item, onMarkDone }: {
  item: { id: number; clientName: string; clientBirthDate: Date | string | null; clientPhone: string | null; productName: string; saleDate: Date | string | null; notes: string | null; daysRemaining: number; isOverdue: boolean; isUrgent: boolean };
  onMarkDone: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { copy, copiedKey } = useCopy();

  const { data: history } = trpc.consultora.clientHistory.useQuery(
    { clientName: item.clientName }, { enabled: showHistory }
  );

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button onClick={() => copy(text, `${item.id}-${field}`)}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all"
      style={{ background: copiedKey === `${item.id}-${field}` ? "oklch(0.92 0.06 160)" : "oklch(0.92 0.008 65)", color: copiedKey === `${item.id}-${field}` ? "oklch(0.40 0.14 160)" : "oklch(0.45 0.10 65)" }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const cardBg = item.isOverdue ? "oklch(0.98 0.015 25)" : item.isUrgent ? "oklch(0.99 0.01 60)" : "white";
  const borderColor = item.isOverdue ? "oklch(0.85 0.06 25)" : item.isUrgent ? "oklch(0.88 0.04 60)" : "oklch(0.88 0.012 65)";

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: cardBg, border: `1.5px solid ${borderColor}` }}>
      <button className="w-full flex items-start gap-3 px-4 py-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm mt-0.5"
          style={{ background: item.isOverdue ? "oklch(0.58 0.22 25)" : item.isUrgent ? "oklch(0.60 0.18 55)" : "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.72 0.15 75))" }}>
          {item.clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <UrgencyBadge daysRemaining={item.daysRemaining} isOverdue={item.isOverdue} />
          </div>
          <p className="font-semibold text-sm truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>{item.productName}</p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "oklch(0.52 0.015 260)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.52 0.015 260)" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid oklch(0.92 0.008 65)" }}>
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Nome</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</p>
                </div>
              </div>
              <CopyBtn text={item.clientName} field="name" />
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Nascimento</p>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>{formatBirthDate(item.clientBirthDate)}</p>
                </div>
              </div>
              <CopyBtn text={formatBirthDate(item.clientBirthDate)} field="birth" />
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Telefone</p>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientPhone}</p>
                  </div>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2 p-3 rounded-xl" style={{ background: "oklch(0.97 0.005 260)" }}>
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>Observação</p>
                    <p className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.notes}</p>
                  </div>
                </div>
                <CopyBtn text={item.notes} field="notes" />
              </div>
            )}
            <button onClick={() => {
              const all = [`Nome: ${item.clientName}`, `Nascimento: ${formatBirthDate(item.clientBirthDate)}`, item.clientPhone ? `Telefone: ${item.clientPhone}` : null, item.notes ? `Obs: ${item.notes}` : null].filter(Boolean).join("\n");
              copy(all, `${item.id}-all`);
            }} className="w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: copiedKey === `${item.id}-all` ? "oklch(0.92 0.06 160)" : "oklch(0.94 0.02 65)", color: copiedKey === `${item.id}-all` ? "oklch(0.40 0.14 160)" : "oklch(0.35 0.05 65)", border: "1px solid oklch(0.88 0.012 65)" }}>
              {copiedKey === `${item.id}-all` ? <><Check className="w-4 h-4" /> Copiado!</> : <><ClipboardList className="w-4 h-4" /> Copiar Todos os Dados</>}
            </button>
          </div>

          {/* Histórico */}
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 text-sm font-medium py-1" style={{ color: "oklch(0.50 0.10 65)" }}>
            <ShoppingBag className="w-4 h-4" />
            {showHistory ? "Ocultar histórico" : "Ver histórico de compras"}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHistory && history && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.90 0.008 65)" }}>
                <div className="px-4 py-2.5" style={{ background: "oklch(0.96 0.015 65)", borderBottom: "1px solid oklch(0.90 0.008 65)" }}>
                  <span className="text-xs font-semibold" style={{ color: "oklch(0.30 0.02 260)" }}>{history.totalPurchases} trabalho{history.totalPurchases !== 1 ? "s" : ""} no total</span>
                </div>
                {history.purchases.length === 0 && <p className="px-4 py-3 text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhum trabalho registrado</p>}
                {history.purchases.slice(0, 5).map((p: { id: number; productName: string; saleDate: Date | string | null; workStatus: string }) => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid oklch(0.94 0.005 65)" }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "oklch(0.20 0.02 260)" }}>{p.productName}</p>
                      <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{formatDate(p.saleDate)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: p.workStatus === "feito" ? "oklch(0.92 0.06 160)" : "oklch(0.94 0.02 65)", color: p.workStatus === "feito" ? "oklch(0.40 0.14 160)" : "oklch(0.50 0.10 65)" }}>
                      {p.workStatus === "feito" ? "Feito" : p.workStatus === "pendente" ? "Pendente" : "Escrever"}
                    </span>
                  </div>
                ))}
              </div>
              {(history as any).totalConsultas > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.88 0.015 280)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "oklch(0.94 0.02 280)", borderBottom: "1px solid oklch(0.88 0.015 280)" }}>
                    <span className="text-xs font-semibold" style={{ color: "oklch(0.35 0.12 280)" }}>📅 {(history as any).totalConsultas} consulta{(history as any).totalConsultas !== 1 ? "s" : ""} de cartas</span>
                  </div>
                  {(history as any).consultas.map((c: { id: number; consultationDate: string; consultationTime: string }) => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid oklch(0.92 0.01 280)" }}>
                      <p className="text-xs font-medium" style={{ color: "oklch(0.20 0.02 260)" }}>Consulta Cartas</p>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "oklch(0.92 0.04 280)", color: "oklch(0.40 0.14 280)" }}>
                        {c.consultationDate ? c.consultationDate.slice(8,10)+"/"+c.consultationDate.slice(5,7)+"/"+c.consultationDate.slice(0,4) : ""} às {c.consultationTime}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botão marcar feito */}
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.45 0.18 160), oklch(0.55 0.20 165))" }}>
              <CheckCircle2 className="w-5 h-5" /> Marcar como Feito
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-center font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Confirmar que o trabalho foi feito?</p>
              <div className="flex gap-2">
                <button onClick={() => { onMarkDone(item.id); setConfirming(false); }}
                  className="flex-1 py-3 rounded-xl text-white font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "oklch(0.50 0.18 160)" }}>
                  <Check className="w-4 h-4" /> Sim, confirmar
                </button>
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card: Feito ──────────────────────────────────────────────────────────────
function DoneCard({ item, onUndo }: {
  item: { id: number; clientName: string; productName: string; saleDate: Date | string | null; completedAt: Date | string | null };
  onUndo: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "white", border: "1.5px solid oklch(0.90 0.02 160)" }}>
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
          style={{ background: "linear-gradient(135deg, oklch(0.45 0.18 160), oklch(0.55 0.20 165))" }}>
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>{item.productName}</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.01 260)" }}>Feito em {formatDate(item.completedAt)}</p>
        </div>
        {!confirming ? (
          <button onClick={() => setConfirming(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 shrink-0"
            style={{ background: "oklch(0.93 0.04 30)", color: "oklch(0.55 0.20 30)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Desfazer
          </button>
        ) : (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => { onUndo(item.id); setConfirming(false); }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white active:scale-95"
              style={{ background: "oklch(0.55 0.20 30)" }}>Sim</button>
            <button onClick={() => setConfirming(false)}
              className="px-3 py-2 rounded-xl text-xs font-semibold active:scale-95"
              style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>Não</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ConsultoraPage() {
  const [activeTab, setActiveTab] = useState<Tab>("para_escrever");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: counts } = trpc.consultora.statusCounts.useQuery(undefined, { refetchInterval: 30000 });

  const { data: toWriteItems = [], isLoading: loadingWrite } = trpc.consultora.toWrite.useQuery(
    { search: debouncedSearch || undefined }, { enabled: activeTab === "para_escrever" }
  );
  const { data: pendingItems = [], isLoading: loadingPending } = trpc.consultora.pending.useQuery(
    { search: debouncedSearch || undefined }, { enabled: activeTab === "pendente" }
  );
  const { data: doneItems = [], isLoading: loadingDone } = trpc.consultora.done.useQuery(
    { search: debouncedSearch || undefined }, { enabled: activeTab === "feito" }
  );

  const invalidateAll = () => {
    utils.consultora.toWrite.invalidate();
    utils.consultora.pending.invalidate();
    utils.consultora.done.invalidate();
    utils.consultora.statusCounts.invalidate();
  };

  const markWritten = trpc.consultora.markWritten.useMutation({
    onSuccess: () => { toast.success("Marcado como escrito! Movido para Pendentes."); invalidateAll(); },
    onError: (e) => toast.error(e.message),
  });

  const markDone = trpc.consultora.markDone.useMutation({
    onSuccess: () => {
      toast.success("Trabalho marcado como feito!");
      invalidateAll();
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e) => toast.error(e.message),
  });

  const undoDone = trpc.consultora.undoDone.useMutation({
    onSuccess: () => { toast.success("Voltou para Pendentes!"); invalidateAll(); },
    onError: (e) => toast.error(e.message),
  });

  function handleCopyAllToWrite() {
    if (toWriteItems.length === 0) { toast.error("Nenhum item para copiar"); return; }
    const text = toWriteItems.map((item, i) =>
      `${i + 1}. ${item.productName}\n   Nome: ${item.clientName}\n   Nasc: ${formatBirthDate(item.clientBirthDate)}${item.clientPhone ? `\n   Tel: ${item.clientPhone}` : ""}${item.notes ? `\n   Obs: ${item.notes}` : ""}`
    ).join("\n\n");
    const doFallback = () => {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success(`${toWriteItems.length} trabalhos copiados!`);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast.success(`${toWriteItems.length} trabalhos copiados!`)).catch(doFallback);
    } else {
      doFallback();
    }
  }

  const tabs = [
    { id: "para_escrever" as Tab, label: "Para Escrever", icon: <Pencil className="w-4 h-4" />, count: counts?.para_escrever ?? 0 },
    { id: "pendente" as Tab, label: "Pendentes", icon: <Hourglass className="w-4 h-4" />, count: counts?.pendente ?? 0 },
    { id: "feito" as Tab, label: "Feitos", icon: <BookCheck className="w-4 h-4" />, count: counts?.feito ?? 0 },
  ];

  const isLoading = activeTab === "para_escrever" ? loadingWrite : activeTab === "pendente" ? loadingPending : loadingDone;

  return (
    <DashboardLayout>
      <div ref={topRef} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Trabalhos
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
            Gerencie os trabalhos espirituais
          </p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: "oklch(0.92 0.008 65)" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); }}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={activeTab === tab.id
                ? { background: "white", color: "oklch(0.15 0.02 260)", boxShadow: "0 1px 4px oklch(0 0 0 / 0.10)" }
                : { color: "oklch(0.52 0.015 260)" }
              }>
              <div className="flex items-center gap-1">
                {tab.icon}
                {tab.count > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-xs flex items-center justify-center font-bold px-1"
                    style={{ background: activeTab === tab.id ? (tab.id === "para_escrever" ? "oklch(0.60 0.13 65)" : tab.id === "pendente" ? "oklch(0.55 0.20 25)" : "oklch(0.45 0.18 160)") : "oklch(0.75 0.05 65)", color: "white" }}>
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-tight text-center">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "oklch(0.60 0.01 260)" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou trabalho..."
            className="w-full pl-10 pr-10 py-3.5 rounded-xl outline-none text-sm"
            style={{ background: "white", border: "1.5px solid oklch(0.88 0.012 65)", color: "oklch(0.15 0.02 260)", fontSize: "16px" }} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg" style={{ color: "oklch(0.60 0.01 260)" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Botão Copiar Todos (só na aba Para Escrever) */}
        {activeTab === "para_escrever" && toWriteItems.length > 0 && (
          <button onClick={handleCopyAllToWrite}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mb-4 active:scale-95 transition-transform text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.60 0.13 65), oklch(0.68 0.14 70))" }}>
            <ClipboardList className="w-4 h-4" />
            Copiar Todos os {toWriteItems.length} Trabalhos
          </button>
        )}

        {/* Conteúdo */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.60 0.13 65)" }} />
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {activeTab === "para_escrever" && (
              toWriteItems.length === 0
                ? <EmptyState icon={<Pencil className="w-10 h-10" />} text="Nenhum trabalho para escrever" sub="Novos trabalhos vendidos aparecerão aqui" />
                : toWriteItems.map(item => <ToWriteCard key={item.id} item={item} onMarkWritten={id => markWritten.mutate({ id })} />)
            )}
            {activeTab === "pendente" && (
              pendingItems.length === 0
                ? <EmptyState icon={<Hourglass className="w-10 h-10" />} text="Nenhum trabalho pendente" sub="Trabalhos marcados como escritos aparecerão aqui" />
                : pendingItems.map(item => <PendingCard key={item.id} item={item} onMarkDone={id => markDone.mutate({ id })} />)
            )}
            {activeTab === "feito" && (
              doneItems.length === 0
                ? <EmptyState icon={<BookCheck className="w-10 h-10" />} text="Nenhum trabalho feito ainda" sub="Trabalhos concluídos aparecerão aqui" />
                : doneItems.map(item => <DoneCard key={item.id} item={item} onUndo={id => undoDone.mutate({ id })} />)
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-3" style={{ color: "oklch(0.75 0.06 65)" }}>{icon}</div>
      <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>{text}</p>
      <p className="text-xs mt-1 text-center" style={{ color: "oklch(0.60 0.01 260)" }}>{sub}</p>
    </div>
  );
}
