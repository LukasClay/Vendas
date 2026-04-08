import { trpc } from "@/lib/trpc";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle2, Clock, AlertTriangle, Search, Copy, Check,
  ChevronDown, ChevronUp, User, Phone, Calendar, FileText,
  ShoppingBag, X, Pencil, Hourglass, BookCheck, ClipboardList,
  RotateCcw, Loader2, Bell, RefreshCw, Download
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

type Tab = "para_escrever" | "pendente" | "feito" | "alertas";

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
      style={{ background: "#fde8e8", color: "#c0392b" }}>
      <AlertTriangle className="w-3 h-3" />
      {Math.abs(daysRemaining)}d atrasado
    </span>
  );
  if (daysRemaining <= 1) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "#fef3e2", color: "#b7770d" }}>
      <Clock className="w-3 h-3" />
      Urgente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "#ede8de", color: "#7a5a20" }}>
      <Clock className="w-3 h-3" />
      {daysRemaining}d restantes
    </span>
  );
}

// ─── Card: Para Escrever ──────────────────────────────────────────────────────
function ToWriteCard({ item, onMarkWritten }: {
  item: { id: number; clientName: string; clientBirthDate: Date | string | null; clientPhone: string | null; productName: string; productCategory?: string | null; saleDate: Date | string | null; notes: string | null; sellerName?: string | null; daysRemaining?: number; isOverdue?: boolean; isUrgent?: boolean; photo1Url?: string | null; photo2Url?: string | null };
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
      style={{ background: copiedKey === `${item.id}-${field}` ? "#d4f5e9" : "#ddd5c4", color: copiedKey === `${item.id}-${field}` ? "#1a7a4a" : "#7a5518" }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const isOverdue = item.isOverdue ?? false;
  const isUrgent = item.isUrgent ?? false;
  const daysRemaining = item.daysRemaining ?? 7;
  const borderColor = isOverdue ? "#e88080" : isUrgent ? "#e8b060" : "#ddd5c4";
  const avatarBg = isOverdue ? "#c0392b" : isUrgent ? "#d4850a" : "linear-gradient(135deg, #c17f24, #d4932a)";

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "white", border: `1.5px solid ${borderColor}` }}>
      <button className="w-full flex items-center gap-3 px-4 py-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
          style={{ background: avatarBg }}>
          {item.clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "#1a1a2e" }}>{item.clientName}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <p className="text-xs" style={{ color: "#737390" }}>{item.productName}{item.sellerName ? ` • ${item.sellerName}` : ""}</p>
            {item.productCategory === "promocao" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ background: "#fde8e8", color: "#c0392b", border: "1px solid #f0b0b0" }}>⭐ Promoção</span>}
            {item.productCategory === "coletivo" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ background: "#e8e8f8", color: "#4040b0", border: "1px solid #c0c0e8" }}>👥 Coletivo</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#ede8de", color: "#8a6520" }}>
              {formatDate(item.saleDate)}
            </span>
            <UrgencyBadge daysRemaining={daysRemaining} isOverdue={isOverdue} />
          </div>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "#737390" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#737390" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #ddd5c4" }}>
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 shrink-0" style={{ color: "#c17f24" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "#737390" }}>Nome</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "#1a1a2e" }}>{item.clientName}</p>
                </div>
              </div>
              <CopyBtn text={item.clientName} field="name" />
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "#c17f24" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "#737390" }}>Nascimento</p>
                  <p className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>{formatBirthDate(item.clientBirthDate)}</p>
                </div>
              </div>
              <CopyBtn text={formatBirthDate(item.clientBirthDate)} field="birth" />
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "#c17f24" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "#737390" }}>Telefone</p>
                    <p className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>{item.clientPhone}</p>
                  </div>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#c17f24" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "#737390" }}>Observação</p>
                    <p className="text-sm" style={{ color: "#1a1a2e" }}>{item.notes}</p>
                  </div>
                </div>
                <CopyBtn text={item.notes} field="notes" />
              </div>
            )}
            {/* Fotos do cliente */}
            {(item.photo1Url || item.photo2Url) && (
              <div className="p-3 rounded-xl" style={{ background: "#f2ede3" }}>
                <p className="text-xs mb-2" style={{ color: "#737390" }}>Fotos do Cliente</p>
                <div className="flex gap-3">
                  {[item.photo1Url, item.photo2Url].filter(Boolean).map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url!} alt={`Foto ${i + 1}`}
                        className="w-20 h-28 object-cover rounded-xl shadow-sm" />
                      <a href={url!} download
                        className="absolute bottom-1.5 right-1.5 p-1.5 rounded-full shadow"
                        style={{ background: "rgba(0,0,0,0.6)" }}
                        onClick={e => e.stopPropagation()}>
                        <Download className="w-3.5 h-3.5 text-white" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Copiar tudo */}
            <button onClick={() => {
              const all = [`Nome: ${item.clientName}`, `Nascimento: ${formatBirthDate(item.clientBirthDate)}`, item.clientPhone ? `Telefone: ${item.clientPhone}` : null, item.notes ? `Obs: ${item.notes}` : null].filter(Boolean).join("\n");
              copy(all, `${item.id}-all`);
            }} className="w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: copiedKey === `${item.id}-all` ? "#d4f5e9" : "#ede8de", color: copiedKey === `${item.id}-all` ? "#1a7a4a" : "#6b4c18", border: "1px solid #ddd5c4" }}>
              {copiedKey === `${item.id}-all` ? <><Check className="w-4 h-4" /> Copiado!</> : <><ClipboardList className="w-4 h-4" /> Copiar Todos os Dados</>}
            </button>
          </div>

          {/* Histórico */}
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 text-sm font-medium py-1" style={{ color: "#8a6520" }}>
            <ShoppingBag className="w-4 h-4" />
            {showHistory ? "Ocultar histórico" : "Ver histórico de compras"}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHistory && history && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e0d8cc" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "#f7f3ec", borderBottom: "1px solid #e0d8cc" }}>
                  <span className="text-xs font-semibold" style={{ color: "#2a2a40" }}>{history.totalPurchases} trabalho{history.totalPurchases !== 1 ? "s" : ""} no total</span>
                </div>
                {history.purchases.length === 0 && <p className="px-4 py-3 text-xs" style={{ color: "#737390" }}>Nenhum trabalho registrado</p>}
                {history.purchases.slice(0, 5).map((p: { id: number; productName: string; saleDate: Date | string | null; workStatus: string }) => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #ede8e0" }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "#1a1a2e" }}>{p.productName}</p>
                      <p className="text-xs" style={{ color: "#737390" }}>{formatDate(p.saleDate)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: p.workStatus === "feito" ? "#d4f5e9" : "#ede8de", color: p.workStatus === "feito" ? "#1a7a4a" : "#8a6520" }}>
                      {p.workStatus === "feito" ? "Feito" : p.workStatus === "pendente" ? "Pendente" : "Escrever"}
                    </span>
                  </div>
                ))}
              </div>
              {(history as any).totalConsultas > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #d0d0e8" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "#eaeaf8", borderBottom: "1px solid #d0d0e8" }}>
                    <span className="text-xs font-semibold" style={{ color: "#3a3a9a" }}>📅 {(history as any).totalConsultas} consulta{(history as any).totalConsultas !== 1 ? "s" : ""} de cartas</span>
                  </div>
                  {(history as any).consultas.map((c: { id: number; consultationDate: string; consultationTime: string }) => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #e4e4f4" }}>
                      <p className="text-xs font-medium" style={{ color: "#1a1a2e" }}>Consulta Cartas</p>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "#e0e0f8", color: "#4040b0" }}>
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
              style={{ background: "linear-gradient(135deg, #2060c0, #2878d0)" }}>
              <Pencil className="w-5 h-5" /> Marcar como Escrito
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-center font-medium" style={{ color: "#2a2a40" }}>Confirmar que foi escrito?</p>
              <div className="flex gap-2">
                <button onClick={() => { onMarkWritten(item.id); setConfirming(false); }}
                  className="flex-1 py-3 rounded-xl text-white font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "#1a8a50" }}>
                  <Check className="w-4 h-4" /> Sim, confirmar
                </button>
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "#ddd5c4", color: "#2a2a40" }}>
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
  item: { id: number; clientName: string; clientBirthDate: Date | string | null; clientPhone: string | null; productName: string; productCategory?: string | null; saleDate: Date | string | null; notes: string | null; daysRemaining: number; isOverdue: boolean; isUrgent: boolean; sellerName?: string | null; photo1Url?: string | null; photo2Url?: string | null };
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
      style={{ background: copiedKey === `${item.id}-${field}` ? "#d4f5e9" : "#ddd5c4", color: copiedKey === `${item.id}-${field}` ? "#1a7a4a" : "#7a5518" }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const cardBg = item.isOverdue ? "#fff5f5" : item.isUrgent ? "#fffbf0" : "white";
  const borderColor = item.isOverdue ? "#f0a0a0" : item.isUrgent ? "#f0d090" : "#ddd5c4";

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: cardBg, border: `1.5px solid ${borderColor}` }}>
      <button className="w-full flex items-start gap-3 px-4 py-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm mt-0.5"
          style={{ background: item.isOverdue ? "#c0392b" : item.isUrgent ? "#d4850a" : "linear-gradient(135deg, #c17f24, #d4932a)" }}>
          {item.clientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <UrgencyBadge daysRemaining={item.daysRemaining} isOverdue={item.isOverdue} />
          </div>
          <p className="font-semibold text-sm truncate" style={{ color: "#1a1a2e" }}>{item.clientName}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <p className="text-xs truncate" style={{ color: "#737390" }}>{item.productName}{item.sellerName ? ` • ${item.sellerName}` : ""}</p>
            {item.productCategory === "promocao" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ background: "#fde8e8", color: "#c0392b", border: "1px solid #f0b0b0" }}>⭐ Promoção</span>}
            {item.productCategory === "coletivo" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ background: "#e8e8f8", color: "#4040b0", border: "1px solid #c0c0e8" }}>👥 Coletivo</span>}
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "#737390" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#737390" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #ddd5c4" }}>
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 shrink-0" style={{ color: "#c17f24" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "#737390" }}>Nome</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "#1a1a2e" }}>{item.clientName}</p>
                </div>
              </div>
              <CopyBtn text={item.clientName} field="name" />
            </div>
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "#c17f24" }} />
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: "#737390" }}>Nascimento</p>
                  <p className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>{formatBirthDate(item.clientBirthDate)}</p>
                </div>
              </div>
              <CopyBtn text={formatBirthDate(item.clientBirthDate)} field="birth" />
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "#c17f24" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "#737390" }}>Telefone</p>
                    <p className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>{item.clientPhone}</p>
                  </div>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2 p-3 rounded-xl" style={{ background: "#f2ede3" }}>
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#c17f24" }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "#737390" }}>Observação</p>
                    <p className="text-sm" style={{ color: "#1a1a2e" }}>{item.notes}</p>
                  </div>
                </div>
                <CopyBtn text={item.notes} field="notes" />
              </div>
            )}
            {/* Fotos do cliente */}
            {(item.photo1Url || item.photo2Url) && (
              <div className="p-3 rounded-xl" style={{ background: "#f2ede3" }}>
                <p className="text-xs mb-2" style={{ color: "#737390" }}>Fotos do Cliente</p>
                <div className="flex gap-3">
                  {[item.photo1Url, item.photo2Url].filter(Boolean).map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url!} alt={`Foto ${i + 1}`}
                        className="w-20 h-28 object-cover rounded-xl shadow-sm" />
                      <a href={url!} download
                        className="absolute bottom-1.5 right-1.5 p-1.5 rounded-full shadow"
                        style={{ background: "rgba(0,0,0,0.6)" }}
                        onClick={e => e.stopPropagation()}>
                        <Download className="w-3.5 h-3.5 text-white" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => {
              const all = [`Nome: ${item.clientName}`, `Nascimento: ${formatBirthDate(item.clientBirthDate)}`, item.clientPhone ? `Telefone: ${item.clientPhone}` : null, item.notes ? `Obs: ${item.notes}` : null].filter(Boolean).join("\n");
              copy(all, `${item.id}-all`);
            }} className="w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: copiedKey === `${item.id}-all` ? "#d4f5e9" : "#ede8de", color: copiedKey === `${item.id}-all` ? "#1a7a4a" : "#6b4c18", border: "1px solid #ddd5c4" }}>
              {copiedKey === `${item.id}-all` ? <><Check className="w-4 h-4" /> Copiado!</> : <><ClipboardList className="w-4 h-4" /> Copiar Todos os Dados</>}
            </button>
          </div>

          {/* Histórico */}
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 text-sm font-medium py-1" style={{ color: "#8a6520" }}>
            <ShoppingBag className="w-4 h-4" />
            {showHistory ? "Ocultar histórico" : "Ver histórico de compras"}
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHistory && history && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e0d8cc" }}>
                <div className="px-4 py-2.5" style={{ background: "#f7f3ec", borderBottom: "1px solid #e0d8cc" }}>
                  <span className="text-xs font-semibold" style={{ color: "#2a2a40" }}>{history.totalPurchases} trabalho{history.totalPurchases !== 1 ? "s" : ""} no total</span>
                </div>
                {history.purchases.length === 0 && <p className="px-4 py-3 text-xs" style={{ color: "#737390" }}>Nenhum trabalho registrado</p>}
                {history.purchases.slice(0, 5).map((p: { id: number; productName: string; saleDate: Date | string | null; workStatus: string }) => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #ede8e0" }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "#1a1a2e" }}>{p.productName}</p>
                      <p className="text-xs" style={{ color: "#737390" }}>{formatDate(p.saleDate)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: p.workStatus === "feito" ? "#d4f5e9" : "#ede8de", color: p.workStatus === "feito" ? "#1a7a4a" : "#8a6520" }}>
                      {p.workStatus === "feito" ? "Feito" : p.workStatus === "pendente" ? "Pendente" : "Escrever"}
                    </span>
                  </div>
                ))}
              </div>
              {(history as any).totalConsultas > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #d0d0e8" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "#eaeaf8", borderBottom: "1px solid #d0d0e8" }}>
                    <span className="text-xs font-semibold" style={{ color: "#3a3a9a" }}>📅 {(history as any).totalConsultas} consulta{(history as any).totalConsultas !== 1 ? "s" : ""} de cartas</span>
                  </div>
                  {(history as any).consultas.map((c: { id: number; consultationDate: string; consultationTime: string }) => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #e4e4f4" }}>
                      <p className="text-xs font-medium" style={{ color: "#1a1a2e" }}>Consulta Cartas</p>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "#e0e0f8", color: "#4040b0" }}>
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
              style={{ background: "linear-gradient(135deg, #1a7a4a, #22924f)" }}>
              <CheckCircle2 className="w-5 h-5" /> Marcar como Feito
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-center font-medium" style={{ color: "#2a2a40" }}>Confirmar que o trabalho foi feito?</p>
              <div className="flex gap-2">
                <button onClick={() => { onMarkDone(item.id); setConfirming(false); }}
                  className="flex-1 py-3 rounded-xl text-white font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "#1a8a50" }}>
                  <Check className="w-4 h-4" /> Sim, confirmar
                </button>
                <button onClick={() => setConfirming(false)}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "#ddd5c4", color: "#2a2a40" }}>
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
  item: { id: number; clientName: string; productName: string; productCategory?: string | null; saleDate: Date | string | null; completedAt: Date | string | null; sellerName?: string | null };
  onUndo: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "white", border: "1.5px solid #c0e8d0" }}>
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
            style={{ background: "linear-gradient(135deg, #1a7a4a, #22924f)" }}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: "#1a1a2e" }}>{item.clientName}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs" style={{ color: "#737390" }}>{item.productName}{item.sellerName ? ` • ${item.sellerName}` : ""}</p>
              {item.productCategory === "promocao" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ background: "#fde8e8", color: "#c0392b", border: "1px solid #f0b0b0" }}>⭐ Promoção</span>}
              {item.productCategory === "coletivo" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ background: "#e8e8f8", color: "#4040b0", border: "1px solid #c0c0e8" }}>👥 Coletivo</span>}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#8888a0" }}>Feito em {formatDate(item.completedAt)}</p>
          </div>
          {!confirming ? (
          <button onClick={() => setConfirming(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 shrink-0"
            style={{ background: "#fde8d8", color: "#c0522a" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Desfazer
          </button>
        ) : (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => { onUndo(item.id); setConfirming(false); }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white active:scale-95"
              style={{ background: "#c0522a" }}>Sim</button>
            <button onClick={() => setConfirming(false)}
              className="px-3 py-2 rounded-xl text-xs font-semibold active:scale-95"
              style={{ background: "#ddd5c4", color: "#2a2a40" }}>Não</button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ConsultoraPage() {
  const [activeTab, setActiveTab] = useState<Tab>("para_escrever");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Cache seguro do input para evitar re-render loops no tRPC
  const queryInput = useMemo(
    () => ({ search: debouncedSearch || undefined }),
    [debouncedSearch]
  );

  const { data: counts } = trpc.consultora.statusCounts.useQuery(undefined, { staleTime: 2 * 60 * 1000 });

  const { data: toWriteItems = [], isLoading: loadingWrite } = trpc.consultora.toWrite.useQuery(
    queryInput, { enabled: activeTab === "para_escrever" }
  );
  const { data: pendingItems = [], isLoading: loadingPending } = trpc.consultora.pending.useQuery(
    queryInput, { enabled: activeTab === "pendente" }
  );
  const { data: doneItems = [], isLoading: loadingDone } = trpc.consultora.done.useQuery(
    queryInput, { enabled: activeTab === "feito" }
  );
  const { data: alertItems = [], isLoading: loadingAlerts, refetch: refetchAlerts, isFetching: isFetchingAlerts } = trpc.consultora.alerts.useQuery(
    undefined, { enabled: activeTab === "alertas", staleTime: 3 * 60 * 1000 }
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

  // Derivar tipos únicos da aba ativa
  const activeItems = activeTab === "para_escrever" ? toWriteItems : activeTab === "pendente" ? pendingItems : doneItems;
  // Sub-filtro por categoria
  const categoryFilteredItems = selectedCategory ? (activeItems as any[]).filter(i => (i.productCategory ?? "individual") === selectedCategory) : activeItems;
  const uniqueTypes = Array.from(new Set((categoryFilteredItems as Array<{ productName: string }>).map(i => i.productName))).sort();

  // Filtrar por tipo e categoria
  const applyFilters = (items: any[]) => {
    let result = items;
    if (selectedCategory) result = result.filter(i => (i.productCategory ?? "individual") === selectedCategory);
    if (selectedType) result = result.filter(i => i.productName === selectedType);
    return result;
  };
  const filteredToWrite = applyFilters(toWriteItems);
  const filteredPending = applyFilters(pendingItems);
  const filteredDone = applyFilters(doneItems);

  const alertCount = (alertItems as any[]).length;
  const tabs = [
    { id: "para_escrever" as Tab, label: "Para Escrever", icon: <Pencil className="w-4 h-4" />, count: counts?.para_escrever ?? 0 },
    { id: "pendente" as Tab, label: "Pendentes", icon: <Hourglass className="w-4 h-4" />, count: counts?.pendente ?? 0 },
    { id: "feito" as Tab, label: "Feitos", icon: <BookCheck className="w-4 h-4" />, count: counts?.feito ?? 0 },
    { id: "alertas" as Tab, label: "Alertas", icon: <Bell className="w-4 h-4" />, count: alertCount },
  ];

  const isLoading = activeTab === "para_escrever" ? loadingWrite : activeTab === "pendente" ? loadingPending : activeTab === "feito" ? loadingDone : loadingAlerts;

  // Reset tipo ao trocar aba
  function handleTabChange(tab: Tab) { setActiveTab(tab); setSearch(""); setSelectedType(null); }

  return (
    <DashboardLayout>
      <div ref={topRef} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a2e" }}>
            Trabalhos
          </h1>
          <p className="text-sm mt-1" style={{ color: "#737390" }}>
            Gerencie os trabalhos espirituais
          </p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: "#ddd5c4" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={activeTab === tab.id
                ? { background: "white", color: "#1a1a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }
                : { color: "#737390" }
              }>
              <div className="flex items-center gap-1">
                {tab.icon}
                {tab.count > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-xs flex items-center justify-center font-bold px-1"
                    style={{ background: activeTab === tab.id ? (tab.id === "para_escrever" ? "#c17f24" : tab.id === "pendente" ? "#c0392b" : "#1a7a4a") : "#b8962e", color: "white" }}>
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-tight text-center">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-filtro por categoria */}
        {!isLoading && (activeItems as any[]).some(i => (i.productCategory ?? "individual") !== "individual") && (
          <div className="flex gap-2 flex-wrap mb-2">
            {[{ key: null, label: "Todos" }, { key: "individual", label: "Individuais" }, { key: "promocao", label: "⭐ Promoção" }, { key: "coletivo", label: "👥 Coletivos" }].map(cat => {
              const count = cat.key ? (activeItems as any[]).filter(i => (i.productCategory ?? "individual") === cat.key).length : activeItems.length;
              if (cat.key && count === 0) return null;
              return (
                <button key={String(cat.key)}
                  onClick={() => { setSelectedCategory(cat.key); setSelectedType(null); }}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95"
                  style={selectedCategory === cat.key
                    ? { background: "#4040b0", color: "white" }
                    : { background: "#e8e8f8", color: "#4040b0" }}>
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Filtro por tipo de trabalho (chips dinâmicos) */}
        {!isLoading && uniqueTypes.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            <button
              onClick={() => setSelectedType(null)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={selectedType === null
                ? { background: "#c17f24", color: "white" }
                : { background: "#ddd5c4", color: "#6b5020" }}>
              Todos ({categoryFilteredItems.length})
            </button>
            {uniqueTypes.map(type => {
              const count = (categoryFilteredItems as Array<{ productName: string }>).filter(i => i.productName === type).length;
              return (
                <button key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  style={selectedType === type
                    ? { background: "#c17f24", color: "white" }
                    : { background: "#ddd5c4", color: "#6b5020" }}>
                  {type} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#737390" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou trabalho..."
            autoComplete="off"
            className="w-full pl-10 pr-10 py-3.5 rounded-xl outline-none text-sm"
            style={{ background: "white", border: "1.5px solid #ddd5c4", color: "#1a1a2e", fontSize: "16px" }} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg" style={{ color: "#737390" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Conteúdo */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#c17f24" }} />
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {activeTab === "para_escrever" && (
              filteredToWrite.length === 0
                ? <EmptyState icon={<Pencil className="w-10 h-10" />} text={selectedType ? `Nenhum "${selectedType}" para escrever` : "Nenhum trabalho para escrever"} sub={selectedType ? "Tente outro filtro" : "Novos trabalhos vendidos aparecerão aqui"} />
                : filteredToWrite.map((item: any) => <ToWriteCard key={item.id} item={item} onMarkWritten={id => markWritten.mutate({ id })} />)
            )}
            {activeTab === "pendente" && (
              filteredPending.length === 0
                ? <EmptyState icon={<Hourglass className="w-10 h-10" />} text={selectedType ? `Nenhum "${selectedType}" pendente` : "Nenhum trabalho pendente"} sub={selectedType ? "Tente outro filtro" : "Trabalhos marcados como escritos aparecerão aqui"} />
                : filteredPending.map((item: any) => <PendingCard key={item.id} item={item} onMarkDone={id => markDone.mutate({ id })} />)
            )}
            {activeTab === "feito" && (
              filteredDone.length === 0
                ? <EmptyState icon={<BookCheck className="w-10 h-10" />} text={selectedType ? `Nenhum "${selectedType}" feito` : "Nenhum trabalho feito ainda"} sub={selectedType ? "Tente outro filtro" : "Trabalhos concluídos aparecerão aqui"} />
                : filteredDone.map((item: any) => <DoneCard key={item.id} item={item} onUndo={id => undoDone.mutate({ id })} />)
            )}
            {activeTab === "alertas" && (
              (alertItems as any[]).length === 0
                ? <EmptyState icon={<Bell className="w-10 h-10" />} text="Nenhum alerta no momento" sub="Todos os trabalhos estão dentro do prazo" />
                : <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs" style={{ color: "#737390" }}>{(alertItems as any[]).filter((a: any) => a.isOverdue).length} atrasados • {(alertItems as any[]).filter((a: any) => !a.isOverdue).length} urgentes</p>
                      <button onClick={() => refetchAlerts()} disabled={isFetchingAlerts}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs active:scale-95"
                        style={{ background: "#ede8de", color: "#7a5518" }}>
                        <RefreshCw className={`w-3 h-3 ${isFetchingAlerts ? "animate-spin" : ""}`} />
                        Atualizar
                      </button>
                    </div>
                    {(alertItems as any[]).map((item: any) => {
                      const borderColor = item.isOverdue ? "#e88080" : "#e8b060";
                      const bgColor = item.isOverdue ? "#fff8f8" : "#fffdf0";
                      return (
                        <div key={item.id} className="rounded-2xl p-4" style={{ background: bgColor, border: `1.5px solid ${borderColor}` }}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.isOverdue
                                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#fde8e8", color: "#c0392b", border: "1px solid #f0a0a0" }}><AlertTriangle className="w-3 h-3" />{Math.abs(item.daysRemaining)}d atrasado</span>
                                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#fef8e0", color: "#b7770d", border: "1px solid #f0d090" }}><Clock className="w-3 h-3" />{item.daysRemaining}d restante{item.daysRemaining !== 1 ? "s" : ""}</span>
                                }
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: item.workStatus === "para_escrever" ? "#e8e8f8" : "#f8f0d8", color: item.workStatus === "para_escrever" ? "#4040b0" : "#b7770d" }}>
                                  {item.workStatus === "para_escrever" ? "✏️ Para Escrever" : "⏳ Pendente"}
                                </span>
                              </div>
                              <p className="font-semibold text-sm" style={{ color: "#1a1a2e" }}>{item.clientName}</p>
                              <p className="text-xs" style={{ color: "#8a6520" }}>{item.productName}{item.productCategory === "promocao" ? " ⭐" : item.productCategory === "coletivo" ? " 👥" : ""}</p>
                              {item.clientPhone && <p className="text-xs" style={{ color: "#737390" }}>📞 {item.clientPhone}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs" style={{ color: "#7070a0" }}>Prazo</p>
                              <p className="text-sm font-bold" style={{ color: item.isOverdue ? "#c0392b" : "#b7770d" }}>{formatDate(item.deadline)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
      <div className="mb-3" style={{ color: "#c4a96a" }}>{icon}</div>
      <p className="text-sm font-medium" style={{ color: "#2a2a40" }}>{text}</p>
      <p className="text-xs mt-1 text-center" style={{ color: "#737390" }}>{sub}</p>
    </div>
  );
}
