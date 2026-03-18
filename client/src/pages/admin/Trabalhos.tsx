import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle2, Clock, AlertTriangle, Search, Copy, Check,
  ChevronDown, ChevronUp, Phone, Calendar, FileText,
  X, Pencil, Hourglass, BookCheck, ClipboardList,
  RotateCcw, UserCog
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

type Tab = "para_escrever" | "pendente" | "feito";
type Seller = { id: number; name: string | null };

function formatBirthDate(d: Date | string | null | undefined): string {
  return formatDate(d);
}

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

// ─── Edição inline de vendedor (somente ADM) ──────────────────────────────────
function SellerEditInline({ saleId, currentSellerName, sellers, onUpdated }: {
  saleId: number;
  currentSellerName: string | null | undefined;
  sellers: Seller[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const utils = trpc.useUtils();

  const updateSeller = trpc.consultora.updateSeller.useMutation({
    onSuccess: () => {
      toast.success("Vendedor atualizado!");
      utils.consultora.toWrite.invalidate();
      utils.consultora.pending.invalidate();
      utils.consultora.done.invalidate();
      setEditing(false);
      setSelectedId("");
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedId(""); // sempre começa sem seleção ao abrir
    setEditing(true);
  }

  function handleCancel() {
    setSelectedId("");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button onClick={handleOpen}
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all active:scale-95"
        style={{ background: "oklch(0.93 0.015 260)", color: "oklch(0.45 0.08 260)" }}>
        <UserCog className="w-3 h-3" />
        {currentSellerName || "Sem vendedor"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="text-xs px-2 py-1 rounded-lg outline-none"
        style={{ background: "white", border: "1.5px solid oklch(0.88 0.012 65)", color: "oklch(0.15 0.02 260)" }}>
        <option value="">Selecionar...</option>
        {sellers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
      </select>
      <button onClick={() => {
        if (!selectedId) { toast.error("Selecione um vendedor"); return; }
        const seller = sellers.find(s => s.id === Number(selectedId));
        if (!seller) return;
        updateSeller.mutate({ saleId, sellerId: seller.id, sellerName: seller.name ?? "" });
      }} disabled={updateSeller.isPending}
        className="text-xs px-2 py-1 rounded-lg font-semibold active:scale-95 text-white"
        style={{ background: "oklch(0.55 0.16 65)" }}>
        {updateSeller.isPending ? "..." : "Salvar"}
      </button>
      <button onClick={handleCancel}
        className="text-xs px-2 py-1 rounded-lg active:scale-95"
        style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Card: Para Escrever ──────────────────────────────────────────────────────
function ToWriteCard({ item, onMarkWritten, sellers }: {
  item: { id: number; clientName: string; clientBirthDate: Date | string | null; clientPhone: string | null; productName: string; productCategory?: string | null; saleDate: Date | string | null; notes: string | null; sellerName?: string | null };
  onMarkWritten: (id: number) => void;
  sellers: Seller[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { copy, copiedKey } = useCopy();

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button onClick={() => copy(text, `${item.id}-${field}`)}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all"
      style={{ background: copiedKey === `${item.id}-${field}` ? "oklch(0.92 0.06 160)" : "oklch(0.92 0.008 65)", color: copiedKey === `${item.id}-${field}` ? "oklch(0.40 0.14 160)" : "oklch(0.45 0.10 65)" }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1.5px solid oklch(0.90 0.012 65)", boxShadow: "0 1px 4px oklch(0 0 0 / 0.05)" }}>
      {/* Cabeçalho clicavel para expandir */}
      <div className="px-4 pt-4 pb-3 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
              <span className="font-semibold text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</span>
              <SellerEditInline saleId={item.id} currentSellerName={item.sellerName} sellers={sellers} onUpdated={() => {}} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs font-medium" style={{ color: "oklch(0.55 0.12 65)" }}>{item.productName}</p>
              {item.productCategory === "promocao" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.95 0.05 25)", color: "oklch(0.50 0.18 25)", border: "1px solid oklch(0.88 0.08 25)" }}>⭐ Promoção</span>}
              {item.productCategory === "coletivo" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.94 0.03 260)", color: "oklch(0.45 0.15 260)", border: "1px solid oklch(0.86 0.06 260)" }}>👥 Coletivo</span>}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.01 260)" }}>Venda: {formatDate(item.saleDate)}</p>
          </div>
          <div className="p-1 rounded-lg shrink-0 mt-0.5" style={{ color: "oklch(0.60 0.01 260)" }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "oklch(0.93 0.008 65)" }}>
          <div className="space-y-2 pt-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
              <span className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>Nasc: {formatBirthDate(item.clientBirthDate)}</span>
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <span className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientPhone}</span>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2">
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

          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.16 65), oklch(0.62 0.17 70))" }}>
              <Pencil className="w-5 h-5" /> Marcar como Escrito
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-center font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Confirmar que foi escrito?</p>
              <div className="flex gap-2">
                <button onClick={() => { onMarkWritten(item.id); setConfirming(false); }}
                  className="flex-1 py-3 rounded-xl text-white font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "oklch(0.55 0.16 65)" }}>
                  <Check className="w-4 h-4" /> Sim
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
function PendingCard({ item, onMarkDone, sellers }: {
  item: { id: number; clientName: string; clientBirthDate: Date | string | null; clientPhone: string | null; productName: string; productCategory?: string | null; saleDate: Date | string | null; notes: string | null; writtenAt: Date | string | null; daysRemaining: number; isOverdue: boolean; isUrgent: boolean; sellerName?: string | null };
  onMarkDone: (id: number) => void;
  sellers: Seller[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { copy, copiedKey } = useCopy();

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button onClick={() => copy(text, `${item.id}-${field}`)}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all"
      style={{ background: copiedKey === `${item.id}-${field}` ? "oklch(0.92 0.06 160)" : "oklch(0.92 0.008 65)", color: copiedKey === `${item.id}-${field}` ? "oklch(0.40 0.14 160)" : "oklch(0.45 0.10 65)" }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: `1.5px solid ${item.isOverdue ? "oklch(0.85 0.08 25)" : item.isUrgent ? "oklch(0.88 0.08 60)" : "oklch(0.90 0.012 65)"}`, boxShadow: "0 1px 4px oklch(0 0 0 / 0.05)" }}>
      {/* Cabeçalho clicavel para expandir */}
      <div className="px-4 pt-4 pb-3 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <UrgencyBadge daysRemaining={item.daysRemaining} isOverdue={item.isOverdue} />
            </div>
            <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
              <span className="font-semibold text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</span>
              <SellerEditInline saleId={item.id} currentSellerName={item.sellerName} sellers={sellers} onUpdated={() => {}} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <p className="text-xs font-medium" style={{ color: "oklch(0.55 0.12 65)" }}>{item.productName}</p>
              {item.productCategory === "promocao" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.95 0.05 25)", color: "oklch(0.50 0.18 25)", border: "1px solid oklch(0.88 0.08 25)" }}>⭐ Promoção</span>}
              {item.productCategory === "coletivo" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.94 0.03 260)", color: "oklch(0.45 0.15 260)", border: "1px solid oklch(0.86 0.06 260)" }}>👥 Coletivo</span>}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.01 260)" }}>Venda: {formatDate(item.saleDate)}</p>
          </div>
          <div className="p-1 rounded-lg shrink-0 mt-0.5" style={{ color: "oklch(0.60 0.01 260)" }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "oklch(0.93 0.008 65)" }}>
          <div className="space-y-2 pt-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
              <span className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>Nasc: {formatBirthDate(item.clientBirthDate)}</span>
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <span className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientPhone}</span>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <p className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.notes}</p>
                </div>
                <CopyBtn text={item.notes} field="notes" />
              </div>
            )}
          </div>

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
                  <Check className="w-4 h-4" /> Sim
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
function DoneCard({ item, onUndo, sellers }: {
  item: { id: number; clientName: string; productName: string; productCategory?: string | null; saleDate: Date | string | null; completedAt: Date | string | null; sellerName?: string | null };
  onUndo: (id: number) => void;
  sellers: Seller[];
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-2xl p-4" style={{ background: "white", border: "1.5px solid oklch(0.90 0.012 65)", boxShadow: "0 1px 4px oklch(0 0 0 / 0.05)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</span>
            <SellerEditInline saleId={item.id} currentSellerName={item.sellerName} sellers={sellers} onUpdated={() => {}} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <p className="text-xs font-medium" style={{ color: "oklch(0.55 0.12 65)" }}>{item.productName}</p>
            {item.productCategory === "promocao" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.95 0.05 25)", color: "oklch(0.50 0.18 25)", border: "1px solid oklch(0.88 0.08 25)" }}>⭐ Promoção</span>}
            {item.productCategory === "coletivo" && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.94 0.03 260)", color: "oklch(0.45 0.15 260)", border: "1px solid oklch(0.86 0.06 260)" }}>👥 Coletivo</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.01 260)" }}>
            Venda: {formatDate(item.saleDate)} · Feito: {formatDate(item.completedAt)}
          </p>
        </div>
        <span className="shrink-0 px-2 py-1 rounded-full text-xs font-semibold" style={{ background: "oklch(0.92 0.06 160)", color: "oklch(0.35 0.14 160)" }}>
          <CheckCircle2 className="w-3 h-3 inline mr-1" />Feito
        </span>
      </div>

      {!confirming ? (
        <button onClick={() => setConfirming(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.08 65)" }}>
          <RotateCcw className="w-3.5 h-3.5" /> Desfazer
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={() => { onUndo(item.id); setConfirming(false); }}
            className="flex-1 py-2 rounded-xl text-white text-sm font-semibold active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: "oklch(0.55 0.16 65)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Confirmar
          </button>
          <button onClick={() => setConfirming(false)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: "oklch(0.92 0.008 65)", color: "oklch(0.30 0.02 260)" }}>
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminTrabalhos() {
  const [activeTab, setActiveTab] = useState<Tab>("para_escrever");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Debounce simples
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 300);
  };

  const utils = trpc.useUtils();

  // Vendedores ativos para o select de edição
  const { data: sellers = [] } = trpc.consultora.listActiveSellers.useQuery();

  const { data: counts } = trpc.consultora.statusCounts.useQuery();
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
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const markDone = trpc.consultora.markDone.useMutation({
    onSuccess: () => {
      toast.success("Trabalho marcado como feito!");
      invalidateAll();
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const undoDone = trpc.consultora.undoDone.useMutation({
    onSuccess: () => { toast.success("Voltou para Pendentes!"); invalidateAll(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const tabs = [
    { id: "para_escrever" as Tab, label: "Para Escrever", icon: <Pencil className="w-4 h-4" />, count: counts?.para_escrever ?? 0 },
    { id: "pendente" as Tab, label: "Pendentes", icon: <Hourglass className="w-4 h-4" />, count: counts?.pendente ?? 0 },
    { id: "feito" as Tab, label: "Feitos", icon: <BookCheck className="w-4 h-4" />, count: counts?.feito ?? 0 },
  ];

  const isLoading = activeTab === "para_escrever" ? loadingWrite : activeTab === "pendente" ? loadingPending : loadingDone;

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

  function handleTabChange(tab: Tab) { setActiveTab(tab); setSearch(""); setDebouncedSearch(""); setSelectedType(null); setSelectedCategory(null); }

  return (
    <DashboardLayout>
      <div ref={topRef} className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Trabalhos
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
            Visão geral de todos os trabalhos espirituais
          </p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: "oklch(0.92 0.008 65)" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
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
                    ? { background: "oklch(0.45 0.15 260)", color: "white" }
                    : { background: "oklch(0.94 0.03 260)", color: "oklch(0.45 0.15 260)" }}>
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
                ? { background: "oklch(0.60 0.13 65)", color: "white" }
                : { background: "oklch(0.92 0.008 65)", color: "oklch(0.40 0.05 65)" }}>
              Todos ({activeItems.length})
            </button>
            {uniqueTypes.map(type => {
              const count = (activeItems as Array<{ productName: string }>).filter(i => i.productName === type).length;
              return (
                <button key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  style={selectedType === type
                    ? { background: "oklch(0.60 0.13 65)", color: "white" }
                    : { background: "oklch(0.92 0.008 65)", color: "oklch(0.40 0.05 65)" }}>
                  {type} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "oklch(0.60 0.01 260)" }} />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou trabalho..."
            className="w-full pl-10 pr-10 py-3.5 rounded-xl outline-none text-sm"
            style={{ background: "white", border: "1.5px solid oklch(0.88 0.012 65)", color: "oklch(0.15 0.02 260)", fontSize: "16px" }} />
          {search && (
            <button onClick={() => { setSearch(""); setDebouncedSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg" style={{ color: "oklch(0.60 0.01 260)" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "oklch(0.88 0.012 65)", borderTopColor: "oklch(0.60 0.13 65)" }} />
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === "para_escrever" && (
              filteredToWrite.length === 0
                ? <p className="text-center py-12 text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>{selectedType ? `Nenhum "${selectedType}" para escrever` : "Nenhum trabalho para escrever"}</p>
                : filteredToWrite.map((item: any) => (
                  <ToWriteCard key={item.id} item={item} sellers={sellers} onMarkWritten={(id) => markWritten.mutate({ id })} />
                ))
            )}
            {activeTab === "pendente" && (
              filteredPending.length === 0
                ? <p className="text-center py-12 text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>{selectedType ? `Nenhum "${selectedType}" pendente` : "Nenhum trabalho pendente"}</p>
                : filteredPending.map((item: any) => (
                  <PendingCard key={item.id} item={item} sellers={sellers} onMarkDone={(id) => markDone.mutate({ id })} />
                ))
            )}
            {activeTab === "feito" && (
              filteredDone.length === 0
                ? <p className="text-center py-12 text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>{selectedType ? `Nenhum "${selectedType}" feito` : "Nenhum trabalho feito ainda"}</p>
                : filteredDone.map((item: any) => (
                  <DoneCard key={item.id} item={item} sellers={sellers} onUndo={(id) => undoDone.mutate({ id })} />
                ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
