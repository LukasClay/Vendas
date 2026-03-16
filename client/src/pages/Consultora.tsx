import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle2, Clock, AlertTriangle, Search, Copy, Check,
  ChevronDown, ChevronUp, User, Phone, Calendar, FileText, ShoppingBag, X
} from "lucide-react";

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatBirthDate(d: Date | string | null) {
  if (!d) return "—";
  const date = new Date(d);
  // Corrige timezone offset
  const local = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return local.toLocaleDateString("pt-BR");
}

// Hook para copiar texto com feedback visual
function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      toast.success("Copiado!");
      setTimeout(() => setCopiedKey(null), 2000);
    }).catch(() => {
      // Fallback para celulares antigos sem clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedKey(key);
      toast.success("Copiado!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);
  return { copy, copiedKey };
}

// Urgency badge
function UrgencyBadge({ daysRemaining, isOverdue }: { daysRemaining: number; isOverdue: boolean }) {
  if (isOverdue) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.95 0.04 25)", color: "oklch(0.45 0.22 25)" }}>
      <AlertTriangle className="w-3 h-3" />
      Atrasado {Math.abs(daysRemaining)}d
    </span>
  );
  if (daysRemaining <= 1) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.96 0.05 60)", color: "oklch(0.50 0.18 60)" }}>
      <Clock className="w-3 h-3" />
      Urgente
    </span>
  );
  if (daysRemaining <= 3) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.96 0.04 80)", color: "oklch(0.50 0.15 80)" }}>
      <Clock className="w-3 h-3" />
      {daysRemaining}d restantes
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.08 65)" }}>
      <Clock className="w-3 h-3" />
      {daysRemaining}d restantes
    </span>
  );
}

// Card de trabalho individual
function WorkCard({
  item,
  onComplete,
  completing,
}: {
  item: any;
  onComplete: (id: number) => void;
  completing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { copy, copiedKey } = useCopy();

  const { data: history, isLoading: loadingHistory } = trpc.consultora.clientHistory.useQuery(
    { clientName: item.clientName },
    { enabled: showHistory }
  );

  const CopyBtn = ({ text, field, label }: { text: string; field: string; label: string }) => (
    <button
      onClick={() => copy(text, `${item.id}-${field}`)}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
      style={{
        background: copiedKey === `${item.id}-${field}` ? "oklch(0.92 0.06 160)" : "oklch(0.94 0.02 65)",
        color: copiedKey === `${item.id}-${field}` ? "oklch(0.40 0.14 160)" : "oklch(0.35 0.05 65)",
        border: "1px solid oklch(0.88 0.012 65)",
      }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {label}
    </button>
  );

  const cardBg = item.isOverdue
    ? "oklch(0.98 0.015 25)"
    : item.isUrgent
      ? "oklch(0.99 0.01 60)"
      : "white";

  const borderColor = item.isOverdue
    ? "oklch(0.85 0.06 25)"
    : item.isUrgent
      ? "oklch(0.88 0.04 60)"
      : "oklch(0.88 0.012 65)";

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm transition-all"
      style={{ background: cardBg, border: `1.5px solid ${borderColor}` }}>

      {/* Header do card — sempre visível */}
      <button
        className="w-full text-left px-4 py-4"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <UrgencyBadge daysRemaining={item.daysRemaining} isOverdue={item.isOverdue} />
            </div>
            <p className="font-semibold text-base leading-tight" style={{ color: "oklch(0.15 0.02 260)" }}>
              {item.clientName}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
              {item.productName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.01 260)" }}>
              Venda: {formatDate(item.saleDate)}
            </p>
          </div>
          <div className="shrink-0 mt-1">
            {expanded
              ? <ChevronUp className="w-5 h-5" style={{ color: "oklch(0.60 0.01 260)" }} />
              : <ChevronDown className="w-5 h-5" style={{ color: "oklch(0.60 0.01 260)" }} />}
          </div>
        </div>
      </button>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid oklch(0.92 0.008 65)" }}>

          {/* Dados do cliente */}
          <div className="pt-3 space-y-3">
            {/* Nome */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>Nome completo</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{item.clientName}</p>
                </div>
              </div>
              <CopyBtn text={item.clientName} field="name" label="Copiar" />
            </div>

            {/* Data de nascimento */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>Data de nascimento</p>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>
                    {formatBirthDate(item.clientBirthDate)}
                  </p>
                </div>
              </div>
              {item.clientBirthDate && (
                <CopyBtn text={formatBirthDate(item.clientBirthDate)} field="birth" label="Copiar" />
              )}
            </div>

            {/* Telefone */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-4 h-4 shrink-0" style={{ color: "oklch(0.60 0.13 65)" }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>Telefone</p>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>
                    {item.clientPhone || "—"}
                  </p>
                </div>
              </div>
              {item.clientPhone && (
                <CopyBtn text={item.clientPhone} field="phone" label="Copiar" />
              )}
            </div>

            {/* Observação */}
            {item.notes && (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "oklch(0.60 0.13 65)" }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>Observação</p>
                    <p className="text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{item.notes}</p>
                  </div>
                </div>
                <CopyBtn text={item.notes} field="notes" label="Copiar" />
              </div>
            )}

            {/* Copiar tudo */}
            <button
              onClick={() => {
                const all = [
                  `Nome: ${item.clientName}`,
                  `Nascimento: ${formatBirthDate(item.clientBirthDate)}`,
                  item.clientPhone ? `Telefone: ${item.clientPhone}` : null,
                  item.notes ? `Obs: ${item.notes}` : null,
                ].filter(Boolean).join("\n");
                copy(all, `${item.id}-all`);
              }}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: copiedKey === `${item.id}-all` ? "oklch(0.92 0.06 160)" : "oklch(0.94 0.02 65)",
                color: copiedKey === `${item.id}-all` ? "oklch(0.40 0.14 160)" : "oklch(0.35 0.05 65)",
                border: "1px solid oklch(0.88 0.012 65)",
              }}>
              {copiedKey === `${item.id}-all`
                ? <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Copiado!</span>
                : <span className="flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> Copiar Todos os Dados</span>}
            </button>
          </div>

          {/* Histórico do cliente */}
          <div>
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-2 text-sm font-medium py-2"
              style={{ color: "oklch(0.50 0.10 65)" }}>
              <ShoppingBag className="w-4 h-4" />
              {showHistory ? "Ocultar histórico" : "Ver histórico de compras"}
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showHistory && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.90 0.008 65)" }}>
                {loadingHistory ? (
                  <div className="p-4 text-center text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>Carregando...</div>
                ) : !history || history.totalPurchases === 0 ? (
                  <div className="p-4 text-center text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhuma compra anterior</div>
                ) : (
                  <div>
                    <div className="px-4 py-2.5 flex items-center gap-2"
                      style={{ background: "oklch(0.96 0.015 65)", borderBottom: "1px solid oklch(0.90 0.008 65)" }}>
                      <ShoppingBag className="w-3.5 h-3.5" style={{ color: "oklch(0.60 0.13 65)" }} />
                      <span className="text-xs font-semibold" style={{ color: "oklch(0.30 0.02 260)" }}>
                        {history.totalPurchases} compra{history.totalPurchases !== 1 ? "s" : ""} no total
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                      {history.purchases.slice(0, 10).map((p: any) => (
                        <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "oklch(0.20 0.02 260)" }}>{p.productName}</p>
                            <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{formatDate(p.saleDate)}</p>
                          </div>
                          {p.completedAt ? (
                            <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: "oklch(0.92 0.06 160)", color: "oklch(0.40 0.14 160)" }}>
                              Feito
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.50 0.10 65)" }}>
                              Pendente
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão Marcar como Feito */}
          <button
            onClick={() => onComplete(item.id)}
            disabled={completing}
            className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, oklch(0.50 0.15 160), oklch(0.60 0.18 160))" }}>
            {completing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Marcando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Marcar como Feito
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ConsultoraPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [completingId, setCompletingId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // Debounce da busca para não sobrecarregar celulares antigos
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const { data: items = [], isLoading } = trpc.consultora.pendingWork.useQuery(
    debouncedSearch ? { productName: debouncedSearch } : undefined,
    { refetchInterval: 60_000 } // Atualiza a cada 1 min sem sobrecarregar
  );

  const complete = trpc.consultora.complete.useMutation({
    onSuccess: () => {
      utils.consultora.pendingWork.invalidate();
      toast.success("Trabalho marcado como feito!");
    },
    onError: () => toast.error("Erro ao marcar como feito."),
    onSettled: () => setCompletingId(null),
  });

  const handleComplete = (id: number) => {
    setCompletingId(id);
    complete.mutate({ id });
  };

  const overdueCount = items.filter((i: any) => i.isOverdue).length;
  const urgentCount = items.filter((i: any) => i.isUrgent && !i.isOverdue).length;

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Trabalhos Pendentes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.015 260)" }}>
            {items.length} trabalho{items.length !== 1 ? "s" : ""} aguardando
            {overdueCount > 0 && <span style={{ color: "oklch(0.45 0.22 25)" }}> · {overdueCount} atrasado{overdueCount !== 1 ? "s" : ""}</span>}
            {urgentCount > 0 && <span style={{ color: "oklch(0.50 0.18 60)" }}> · {urgentCount} urgente{urgentCount !== 1 ? "s" : ""}</span>}
          </p>
        </div>

        {/* Busca por nome do trabalho */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "oklch(0.60 0.01 260)" }} />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome do trabalho..."
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            style={{
              border: "1.5px solid oklch(0.88 0.012 65)",
              background: "white",
              color: "oklch(0.15 0.02 260)",
              fontSize: "16px", // Evita zoom no iOS
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setDebouncedSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg"
              style={{ color: "oklch(0.60 0.01 260)" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista de trabalhos */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "oklch(0.95 0.008 65)" }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "oklch(0.95 0.008 65)" }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: "oklch(0.55 0.15 160)" }} />
            </div>
            <p className="font-semibold text-base" style={{ color: "oklch(0.30 0.02 260)" }}>
              {debouncedSearch ? "Nenhum trabalho encontrado" : "Tudo em dia!"}
            </p>
            <p className="text-sm mt-1" style={{ color: "oklch(0.60 0.01 260)" }}>
              {debouncedSearch ? `Sem pendências para "${debouncedSearch}"` : "Não há trabalhos pendentes no momento."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <WorkCard
                key={item.id}
                item={item}
                onComplete={handleComplete}
                completing={completingId === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
