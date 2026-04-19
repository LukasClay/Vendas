import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import type { ProductCategory } from "@shared/types";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Calendar,
  FileText,
  X,
  Pencil,
  Hourglass,
  BookCheck,
  ClipboardList,
  RotateCcw,
  UserCog,
  Loader2,
  Settings2,
  ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { motion, AnimatePresence } from "framer-motion";

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
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedKey(key);
          toast.success("Copiado!");
          setTimeout(() => setCopiedKey(null), 2000);
        })
        .catch(doFallback);
    } else {
      doFallback();
    }
  }, []);
  return { copy, copiedKey };
}

function UrgencyBadge({
  daysRemaining,
  isOverdue,
}: {
  daysRemaining: number;
  isOverdue: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (isOverdue)
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{
          background: isDark ? "rgba(239, 68, 68, 0.15)" : "#fde8e8",
          color: isDark ? "#f87171" : "#c0392b",
          border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.3)" : "#f0b0b0"}`,
        }}
      >
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(daysRemaining)}d atrasado
      </span>
    );

  if (daysRemaining <= 1)
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{
          background: isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3e2",
          color: isDark ? "#fbbf24" : "#b7770d",
          border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.3)" : "#f0d0a0"}`,
        }}
      >
        <Clock className="w-3 h-3" />
        Urgente
      </span>
    );

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: isDark ? "rgba(202, 138, 4, 0.15)" : "var(--accent)",
        color: isDark ? "#eab308" : "#7a5a20",
        border: `1px solid ${isDark ? "rgba(202, 138, 4, 0.3)" : "rgba(202, 138, 4, 0.2)"}`,
      }}
    >
      <Clock className="w-3 h-3" />
      {daysRemaining}d restantes
    </span>
  );
}

function SellerEditInline({
  saleId,
  currentSellerName,
  sellers,
  onUpdated,
}: {
  saleId: number;
  currentSellerName: string | null | undefined;
  sellers: Seller[];
  onUpdated: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const utils = trpc.useUtils();
  const invalidateWorkQueries = () => {
    utils.consultora.toWrite.invalidate();
    utils.consultora.pending.invalidate();
    utils.consultora.done.invalidate();
    utils.consultora.statusCounts.invalidate();
    utils.consultora.alerts.invalidate();
  };

  const updateSeller = trpc.consultora.updateSeller.useMutation({
    onSuccess: () => {
      toast.success("Vendedor atualizado!");
      invalidateWorkQueries();
      setEditing(false);
      setSelectedId("");
      onUpdated();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!editing) {
    return (
      <button
        onClick={e => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all active:scale-95 font-semibold max-w-full"
        style={{
          background: isDark ? "rgba(139, 92, 246, 0.15)" : "#eaeaf8",
          color: isDark ? "#a78bfa" : "#4a4a80",
          border: `1px solid ${isDark ? "rgba(139, 92, 246, 0.3)" : "#c0c0e8"}`,
        }}
      >
        <UserCog className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{currentSellerName || "Sem vendedor"}</span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      onClick={e => e.stopPropagation()}
    >
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="text-[10px] px-2 py-1 rounded-lg outline-none font-bold uppercase"
        style={{
          background: "var(--secondary)",
          border: "1.5px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <option value="">Selecionar...</option>
        {sellers.map(s => (
          <option key={s.id} value={String(s.id)}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!selectedId) {
            toast.error("Selecione um vendedor");
            return;
          }
          const seller = sellers.find(s => s.id === Number(selectedId));
          if (!seller) return;
          updateSeller.mutate({
            saleId,
            sellerId: seller.id,
            sellerName: seller.name ?? "",
          });
        }}
        disabled={updateSeller.isPending}
        className="text-[10px] px-2 py-1 rounded-lg font-bold active:scale-95 text-white bg-[var(--primary)] uppercase tracking-wider"
      >
        {updateSeller.isPending ? "..." : "Salvar"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-[10px] px-2 py-1 rounded-lg active:scale-95 bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function ToWriteCard({
  item,
  onMarkWritten,
  sellers,
}: {
  item: any;
  onMarkWritten: (id: number) => void;
  sellers: Seller[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { copy, copiedKey } = useCopy();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={e => {
        e.stopPropagation();
        copy(text, `${item.id}-${field}`);
      }}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all border border-[var(--border)]"
      style={{
        background:
          copiedKey === `${item.id}-${field}`
            ? "rgba(34, 197, 94, 0.15)"
            : "var(--secondary)",
        color:
          copiedKey === `${item.id}-${field}` ? "#22c55e" : "var(--primary)",
      }}
    >
      {copiedKey === `${item.id}-${field}` ? (
        <Check className="w-4 h-4" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );

  const hasDeadline = item.hasDeadline ?? true;
  const isOverdue = hasDeadline ? (item.isOverdue ?? false) : false;
  const isUrgent = hasDeadline ? (item.isUrgent ?? false) : false;
  const daysRemaining = item.daysRemaining ?? 7;

  const borderColor = isOverdue
    ? isDark
      ? "#f87171"
      : "#e88080"
    : isUrgent
      ? isDark
        ? "#fbbf24"
        : "#e8b060"
      : "var(--border)";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all border shadow-sm"
      style={{ background: "var(--card)", borderColor: borderColor }}
    >
      <div
        className="px-4 pt-4 pb-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {hasDeadline && (
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <UrgencyBadge
                  daysRemaining={daysRemaining}
                  isOverdue={isOverdue}
                />
              </div>
            )}
            <span
              className="font-bold text-base"
              style={{ color: "var(--foreground)" }}
            >
              {item.clientName}
            </span>
            <div className="mt-1">
              <SellerEditInline
                saleId={item.id}
                currentSellerName={item.sellerName}
                sellers={sellers}
                onUpdated={() => {}}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--primary)" }}
              >
                {item.productName}
              </p>
              {item.productCategory === "promocao" && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  ⭐ PROMOÇÃO
                </span>
              )}
              {item.productCategory === "coletivo" && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  👥 COLETIVO
                </span>
              )}
            </div>
            <p
              className="text-[10px] mt-1 font-bold uppercase tracking-tighter"
              style={{ color: "var(--muted-foreground)" }}
            >
              Venda: {formatDate(item.saleDate)}
            </p>
          </div>
          <div className="p-1 rounded-lg shrink-0 mt-0.5 text-[var(--muted-foreground)]">
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)] pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-2 rounded-xl bg-[var(--secondary)]/30 border border-[var(--border)]/50">
                  <Calendar className="w-4 h-4 shrink-0 text-orange-500" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                      Nascimento
                    </p>
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {formatBirthDate(item.clientBirthDate)}
                    </p>
                  </div>
                </div>
                {item.clientPhone && (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--secondary)]/30 border border-[var(--border)]/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Phone className="w-4 h-4 shrink-0 text-green-500" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                          Telefone
                        </p>
                        <p className="text-sm font-bold text-[var(--foreground)]">
                          {item.clientPhone}
                        </p>
                      </div>
                    </div>
                    <CopyBtn text={item.clientPhone} field="phone" />
                  </div>
                )}
              </div>

              {item.notes && (
                <div className="p-3 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                      Observação
                    </p>
                  </div>
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                    {item.notes}
                  </p>
                </div>
              )}

              <div className="pt-2">
                {!confirming ? (
                  <button
                    onClick={() => setConfirming(true)}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-[oklch(0.55_0.15_160)] shadow-lg shadow-green-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    <BookCheck className="w-4 h-4" /> Marcar como Escrito
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onMarkWritten(item.id)}
                      className="flex-1 py-3.5 rounded-xl font-bold text-white bg-green-600 active:scale-95 uppercase tracking-widest text-[10px]"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="flex-1 py-3.5 rounded-xl font-bold bg-[var(--secondary)] text-[var(--foreground)] active:scale-95 uppercase tracking-widest text-[10px] border border-[var(--border)]"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Card: Pendente (Trabalhos a fazer/pendentes)
function PendingCard({
  item,
  onMarkDone,
  onUndoWritten,
  sellers,
}: {
  item: any;
  onMarkDone: (id: number) => void;
  onUndoWritten: (id: number) => void;
  sellers: Seller[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { copy, copiedKey } = useCopy();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={e => {
        e.stopPropagation();
        copy(text, `${item.id}-${field}`);
      }}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all border border-[var(--border)]"
      style={{
        background:
          copiedKey === `${item.id}-${field}`
            ? "rgba(34, 197, 94, 0.15)"
            : "var(--secondary)",
        color:
          copiedKey === `${item.id}-${field}` ? "#22c55e" : "var(--primary)",
      }}
    >
      {copiedKey === `${item.id}-${field}` ? (
        <Check className="w-4 h-4" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );

  const hasDeadline = item.hasDeadline ?? true;
  const isOverdue = hasDeadline ? item.isOverdue : false;
  const isUrgent = hasDeadline ? item.isUrgent : false;

  return (
    <div
      className="rounded-2xl overflow-hidden border transition-all shadow-sm"
      style={{
        background: "var(--card)",
        borderColor: isOverdue
          ? isDark
            ? "#f87171"
            : "#f0a0a0"
          : isUrgent
            ? isDark
              ? "#fbbf24"
              : "#f0d090"
            : "var(--border)",
      }}
    >
      <div
        className="px-4 pt-4 pb-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {hasDeadline && (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <UrgencyBadge
                  daysRemaining={item.daysRemaining}
                  isOverdue={item.isOverdue}
                />
              </div>
            )}
            <span
              className="font-bold text-base"
              style={{ color: "var(--foreground)" }}
            >
              {item.clientName}
            </span>
            <div className="mt-1">
              <SellerEditInline
                saleId={item.id}
                currentSellerName={item.sellerName}
                sellers={sellers}
                onUpdated={() => {}}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--primary)" }}
              >
                {item.productName}
              </p>
              {item.productCategory === "promocao" && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  ⭐ PROMOÇÃO
                </span>
              )}
              {item.productCategory === "coletivo" && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  👥 COLETIVO
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-lg">
                Venda: {formatDate(item.saleDate)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800">
                Escrito: {formatDate(item.writtenAt)}
              </span>
            </div>
          </div>
          <div className="p-1 rounded-lg shrink-0 mt-0.5 text-[var(--muted-foreground)]">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)] pt-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--primary)" }}
              />
              <span className="text-sm" style={{ color: "var(--foreground)" }}>
                Nasc: {formatBirthDate(item.clientBirthDate)}
              </span>
            </div>
            {item.clientPhone && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--primary)" }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    {item.clientPhone}
                  </span>
                </div>
                <CopyBtn text={item.clientPhone} field="phone" />
              </div>
            )}
            {item.notes && (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText
                    className="w-4 h-4 shrink-0 mt-0.5"
                    style={{ color: "var(--primary)" }}
                  />
                  <p className="text-sm" style={{ color: "var(--foreground)" }}>
                    {item.notes}
                  </p>
                </div>
                <CopyBtn text={item.notes} field="notes" />
              </div>
            )}
          </div>
          {!confirming ? (
            <div className="space-y-2">
              <button
                onClick={() => setConfirming(true)}
                className="w-full py-4 rounded-2xl text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #1a7a4a, #22924f)",
                }}
              >
                <CheckCircle2 className="w-5 h-5" /> Marcar como Feito
              </button>
              <button
                onClick={() => onUndoWritten(item.id)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                style={{
                  background: "var(--secondary)",
                  color: "var(--primary)",
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Voltar para Para Escrever
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p
                className="text-sm text-center font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Confirmar que o trabalho foi feito?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onMarkDone(item.id);
                    setConfirming(false);
                  }}
                  className="flex-1 py-3 rounded-xl text-white font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "#1a8a50" }}
                >
                  <Check className="w-4 h-4" /> Sim
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 py-3 rounded-xl font-semibold active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
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

// Card: Feito (Trabalhos concluídos)
function DoneCard({
  item,
  onUndo,
  sellers,
}: {
  item: {
    id: number;
    clientName: string;
    productName: string;
    productCategory?: ProductCategory | null;
    saleDate: Date | string | null;
    completedAt: Date | string | null;
    sellerName?: string | null;
    doneAt?: Date | string | null;
  };
  onUndo: (id: number) => void;
  sellers: Seller[];
}) {
  const [confirming, setConfirming] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className="rounded-2xl p-4 border transition-all shadow-sm"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className="font-semibold text-sm"
            style={{ color: "var(--foreground)" }}
          >
            {item.clientName}
          </span>
          <div className="mt-1">
            <SellerEditInline
              saleId={item.id}
              currentSellerName={item.sellerName}
              sellers={sellers}
              onUpdated={() => {}}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <p
              className="text-xs font-medium"
              style={{ color: "var(--primary)" }}
            >
              {item.productName}
            </p>
            {item.productCategory === "promocao" && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                ⭐ Promoção
              </span>
            )}
            {item.productCategory === "coletivo" && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                👥 Coletivo
              </span>
            )}
          </div>
          <p
            className="text-xs mt-0.5 whitespace-normal"
            style={{ color: "var(--muted-foreground)" }}
          >
            Venda: {formatDate(item.saleDate)} · Feito:{" "}
            {formatDate(item.completedAt || item.doneAt)}
          </p>
        </div>
        <span
          className="shrink-0 px-2 py-1 rounded-full text-xs font-semibold"
          style={{
            background: isDark ? "rgba(34, 197, 94, 0.15)" : "#d4f5e9",
            color: isDark ? "#4ade80" : "#1a7a4a",
          }}
        >
          <CheckCircle2 className="w-3 h-3 inline mr-1" />
          Feito
        </span>
      </div>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Desfazer
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              onUndo(item.id);
              setConfirming(false);
            }}
            className="flex-1 py-2 rounded-xl text-white text-sm font-semibold active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: "var(--primary)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Confirmar
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: "var(--border)", color: "var(--foreground)" }}
          >
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  para_escrever: "Para Escrever",
  pendente: "Pendente",
  feito: "Feito",
};

const CATEGORY_OPTIONS = [
  { key: null, label: "Todos" },
  { key: "individual", label: "Individuais" },
  { key: "promocao", label: "Promoção" },
  { key: "coletivo", label: "Coletivos" },
] as const;

function BulkActionPanel() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const utils = trpc.useUtils();
  const invalidateWorkQueries = () => {
    utils.consultora.toWrite.invalidate();
    utils.consultora.pending.invalidate();
    utils.consultora.done.invalidate();
    utils.consultora.statusCounts.invalidate();
    utils.consultora.distinctProducts.invalidate();
    utils.consultora.alerts.invalidate();
  };

  const [open, setOpen] = useState(false);
  const [fromStatus, setFromStatus] = useState<
    "para_escrever" | "pendente" | "feito"
  >("para_escrever");
  const [category, setCategory] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const [toStatus, setToStatus] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const distinctInput = useMemo(
    () => ({
      workStatus: fromStatus as "para_escrever" | "pendente" | "feito",
      productCategory: category as ProductCategory | undefined,
    }),
    [fromStatus, category]
  );

  const { data: products = [], isLoading: productsLoading } =
    trpc.consultora.distinctProducts.useQuery(distinctInput, { enabled: open });

  // Auto-selecionar todos os produtos quando a lista carrega
  useEffect(() => {
    if (products.length > 0) {
      setSelectedProducts(new Set(products.map(p => p.productName)));
    }
  }, [products]);

  // Reset toStatus ao mudar fromStatus
  useEffect(() => {
    setToStatus("");
  }, [fromStatus]);

  const toggleProduct = (name: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.productName)));
    }
  };

  const selectedCount = products
    .filter(p => selectedProducts.has(p.productName))
    .reduce((sum, p) => sum + p.count, 0);

  const canSubmit =
    selectedProducts.size > 0 && toStatus && toStatus !== fromStatus;

  // Preview query - only when confirm dialog is open
  const previewInput = useMemo(
    () => ({
      fromStatus: fromStatus as "para_escrever" | "pendente" | "feito",
      productNames: Array.from(selectedProducts),
      productCategory: category as ProductCategory | undefined,
    }),
    [fromStatus, selectedProducts, category]
  );

  const { data: preview, isLoading: previewLoading } =
    trpc.consultora.bulkUpdatePreview.useQuery(previewInput, {
      enabled: confirmOpen && selectedProducts.size > 0,
    });

  const bulkUpdate = trpc.consultora.bulkUpdateStatus.useMutation({
    onSuccess: data => {
      toast.success(
        `${data.updatedCount} trabalhos movidos para ${STATUS_LABELS[toStatus] ?? toStatus}!`
      );
      invalidateWorkQueries();
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleConfirm = () => {
    bulkUpdate.mutate({
      fromStatus: fromStatus as "para_escrever" | "pendente" | "feito",
      toStatus: toStatus as "para_escrever" | "pendente" | "feito",
      productNames: Array.from(selectedProducts),
      productCategory: category as ProductCategory | undefined,
    });
  };

  const targetOptions = (
    ["para_escrever", "pendente", "feito"] as const
  ).filter(s => s !== fromStatus);

  return (
    <>
      <div
        className="rounded-2xl border overflow-hidden transition-all"
        style={{
          background: isDark
            ? "rgba(139, 92, 246, 0.05)"
            : "rgba(139, 92, 246, 0.03)",
          borderColor: isDark
            ? "rgba(139, 92, 246, 0.2)"
            : "rgba(139, 92, 246, 0.15)",
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 transition-all active:scale-[0.995]"
          style={{ color: isDark ? "#a78bfa" : "#6d28d9" }}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wider">
              Ações em Massa
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
              style={{
                background: isDark
                  ? "rgba(139, 92, 246, 0.15)"
                  : "rgba(139, 92, 246, 0.1)",
                color: isDark ? "#c4b5fd" : "#7c3aed",
              }}
            >
              Admin
            </span>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-4 space-y-4 border-t"
                style={{
                  borderColor: isDark
                    ? "rgba(139, 92, 246, 0.15)"
                    : "rgba(139, 92, 246, 0.1)",
                }}
              >
                {/* Status origem */}
                <div className="pt-4">
                  <label
                    className="text-[10px] font-bold uppercase tracking-wider block mb-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Status de Origem
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(["para_escrever", "pendente", "feito"] as const).map(
                      s => (
                        <button
                          key={s}
                          onClick={() => {
                            setFromStatus(s);
                            setCategory(null);
                            setSelectedProducts(new Set());
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={
                            fromStatus === s
                              ? {
                                  background: isDark
                                    ? "rgba(139, 92, 246, 0.3)"
                                    : "rgba(139, 92, 246, 0.15)",
                                  color: isDark ? "#c4b5fd" : "#6d28d9",
                                  border: `1.5px solid ${isDark ? "#a78bfa" : "#8b5cf6"}`,
                                }
                              : {
                                  background: "var(--secondary)",
                                  color: "var(--muted-foreground)",
                                  border: "1.5px solid var(--border)",
                                }
                          }
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Filtro categoria */}
                <div>
                  <label
                    className="text-[10px] font-bold uppercase tracking-wider block mb-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Filtro de Categoria
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORY_OPTIONS.map(cat => (
                      <button
                        key={String(cat.key)}
                        onClick={() => {
                          setCategory(cat.key);
                          setSelectedProducts(new Set());
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                        style={
                          category === cat.key
                            ? {
                                background: isDark
                                  ? "rgba(139, 92, 246, 0.3)"
                                  : "rgba(139, 92, 246, 0.15)",
                                color: isDark ? "#c4b5fd" : "#6d28d9",
                                border: `1.5px solid ${isDark ? "#a78bfa" : "#8b5cf6"}`,
                              }
                            : {
                                background: "var(--secondary)",
                                color: "var(--muted-foreground)",
                                border: "1.5px solid var(--border)",
                              }
                        }
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkboxes de produtos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Produtos
                    </label>
                    {products.length > 0 && (
                      <button
                        onClick={toggleAll}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg transition-all active:scale-95"
                        style={{
                          color: isDark ? "#a78bfa" : "#7c3aed",
                          background: isDark
                            ? "rgba(139, 92, 246, 0.1)"
                            : "rgba(139, 92, 246, 0.05)",
                        }}
                      >
                        {selectedProducts.size === products.length
                          ? "Desmarcar todos"
                          : "Selecionar todos"}
                      </button>
                    )}
                  </div>
                  {productsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-[var(--muted-foreground)]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Carregando...</span>
                    </div>
                  ) : products.length === 0 ? (
                    <p
                      className="text-xs py-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Nenhum trabalho encontrado neste status.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {products.map(p => (
                        <label
                          key={p.productName}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-sm"
                          style={{
                            background: selectedProducts.has(p.productName)
                              ? isDark
                                ? "rgba(139, 92, 246, 0.1)"
                                : "rgba(139, 92, 246, 0.05)"
                              : "var(--secondary)",
                            border: `1px solid ${selectedProducts.has(p.productName) ? (isDark ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.15)") : "var(--border)"}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(p.productName)}
                            onChange={() => toggleProduct(p.productName)}
                            className="rounded accent-purple-600"
                          />
                          <span
                            className="font-medium text-xs truncate"
                            style={{ color: "var(--foreground)" }}
                          >
                            {p.productName}
                          </span>
                          <span
                            className="ml-auto text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full"
                            style={{
                              background: isDark
                                ? "rgba(139, 92, 246, 0.15)"
                                : "rgba(139, 92, 246, 0.1)",
                              color: isDark ? "#c4b5fd" : "#7c3aed",
                            }}
                          >
                            {p.count}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status destino + botão */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-2">
                  <div className="flex-1">
                    <label
                      className="text-[10px] font-bold uppercase tracking-wider block mb-2"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Mover Para
                    </label>
                    <select
                      value={toStatus}
                      onChange={e => setToStatus(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
                      style={{
                        background: "var(--secondary)",
                        border: "1.5px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      <option value="">Selecionar destino...</option>
                      {targetOptions.map(s => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canSubmit}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: canSubmit
                        ? isDark
                          ? "#7c3aed"
                          : "#6d28d9"
                        : "var(--secondary)",
                      color: canSubmit ? "white" : "var(--muted-foreground)",
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Mover {selectedCount} trabalhos
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de confirmação */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => {
              if (!bulkUpdate.isPending) setConfirmOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-6 shadow-xl border"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3
                className="text-lg font-bold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Confirmar Ação em Massa
              </h3>

              <div className="space-y-3 mb-6">
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  <span
                    className="px-2 py-1 rounded-lg text-xs font-bold"
                    style={{
                      background: "var(--secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {STATUS_LABELS[fromStatus]}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <span
                    className="px-2 py-1 rounded-lg text-xs font-bold"
                    style={{
                      background: isDark
                        ? "rgba(139, 92, 246, 0.15)"
                        : "rgba(139, 92, 246, 0.1)",
                      color: isDark ? "#c4b5fd" : "#7c3aed",
                    }}
                  >
                    {STATUS_LABELS[toStatus] ?? "—"}
                  </span>
                </div>

                {category && (
                  <p
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Categoria:{" "}
                    <strong>
                      {CATEGORY_OPTIONS.find(c => c.key === category)?.label}
                    </strong>
                  </p>
                )}

                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Produtos selecionados ({selectedProducts.size}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedProducts).map(name => (
                      <span
                        key={name}
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: "var(--secondary)",
                          color: "var(--foreground)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className="p-3 rounded-xl text-center"
                  style={{
                    background: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
                    border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.2)" : "#fecaca"}`,
                  }}
                >
                  {previewLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        style={{ color: isDark ? "#f87171" : "#dc2626" }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: isDark ? "#f87171" : "#dc2626" }}
                      >
                        Contando...
                      </span>
                    </div>
                  ) : (
                    <p
                      className="text-sm font-bold"
                      style={{ color: isDark ? "#f87171" : "#dc2626" }}
                    >
                      {preview?.count ?? 0} trabalhos serão movidos
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={
                    bulkUpdate.isPending || previewLoading || !preview?.count
                  }
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: isDark ? "#7c3aed" : "#6d28d9" }}
                >
                  {bulkUpdate.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Movendo...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={bulkUpdate.isPending}
                  className="flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
                  style={{
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Trabalhos() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
  const { data: sellers = [] } = trpc.consultora.listActiveSellers.useQuery();
  const queryInput = useMemo(
    () => ({ search: debouncedSearch || undefined }),
    [debouncedSearch]
  );
  const { data: toWrite = [], isLoading: load1 } =
    trpc.consultora.toWrite.useQuery(queryInput);
  const { data: pending = [], isLoading: load2 } =
    trpc.consultora.pending.useQuery(queryInput);
  const { data: done = [], isLoading: load3 } =
    trpc.consultora.done.useQuery(queryInput);
  const invalidateWorkQueries = () => {
    utils.consultora.toWrite.invalidate();
    utils.consultora.pending.invalidate();
    utils.consultora.done.invalidate();
    utils.consultora.statusCounts.invalidate();
    utils.consultora.distinctProducts.invalidate();
    utils.consultora.alerts.invalidate();
  };

  const markWritten = trpc.consultora.markWritten.useMutation({
    onSuccess: () => {
      toast.success("Movido para Pendentes!");
      invalidateWorkQueries();
    },
    onError: e => toast.error(e.message),
  });

  const markDone = trpc.consultora.markDone.useMutation({
    onSuccess: () => {
      toast.success("Trabalho concluído!");
      invalidateWorkQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restoreToPending = trpc.consultora.undoDone.useMutation({
    onSuccess: () => {
      toast.success("Restaurado para Pendentes!");
      invalidateWorkQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const undoWritten = trpc.consultora.undoWritten.useMutation({
    onSuccess: () => {
      toast.success("Voltou para 'Para Escrever'!");
      invalidateWorkQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isLoading =
    activeTab === "para_escrever"
      ? load1
      : activeTab === "pendente"
        ? load2
        : load3;
  // Derivar tipos únicos da aba ativa
  const activeItems =
    activeTab === "para_escrever"
      ? toWrite
      : activeTab === "pendente"
        ? pending
        : done;
  // Sub-filtro por categoria
  const categoryFilteredItems = selectedCategory
    ? (activeItems as any[]).filter(
        i => (i.productCategory ?? "individual") === selectedCategory
      )
    : activeItems;
  const uniqueTypes = Array.from(
    new Set(
      (categoryFilteredItems as Array<{ productName: string }>).map(
        i => i.productName
      )
    )
  ).sort();
  // Filtrar por tipo e categoria
  const applyFilters = (items: any[]) => {
    let result = items;
    if (selectedCategory)
      result = result.filter(
        i => (i.productCategory ?? "individual") === selectedCategory
      );
    if (selectedType)
      result = result.filter(i => i.productName === selectedType);
    return result;
  };
  const filteredToWrite = applyFilters(toWrite);
  const filteredPending = applyFilters(pending);
  const filteredDone = applyFilters(done);
  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setSearch("");
    setDebouncedSearch("");
    setSelectedType(null);
    setSelectedCategory(null);
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  color: "var(--foreground)",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                Painel de Trabalhos
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Gerenciamento de fluxo de produção
              </p>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar cliente ou trabalho..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl outline-none border border-[var(--border)] text-sm transition-all focus:ring-2 focus:ring-[var(--primary)]/20"
                style={{
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          </div>
        </FadeIn>

        {/* Painel de ações em massa — somente admin */}
        {isAdmin && <BulkActionPanel />}

        {/* Tabs */}
        <div className="flex p-1 rounded-2xl bg-[var(--secondary)]/50 border border-[var(--border)] overflow-x-auto no-scrollbar">
          {[
            {
              id: "para_escrever",
              label: "Para Escrever",
              count: toWrite.length,
              icon: Pencil,
            },
            {
              id: "pendente",
              label: "Pendentes",
              count: pending.length,
              icon: Hourglass,
            },
            {
              id: "feito",
              label: "Feitos",
              count: done.length,
              icon: CheckCircle2,
            },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--card)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sub-filtro por categoria */}
        {!isLoading &&
          (activeItems as any[]).some(
            i => (i.productCategory ?? "individual") !== "individual"
          ) && (
            <div className="flex gap-2 flex-wrap">
              {[
                { key: null, label: "Todos" },
                { key: "individual", label: "Individuais" },
                { key: "promocao", label: "⭐ Promoção" },
                { key: "coletivo", label: "👥 Coletivos" },
              ].map(cat => {
                const count = cat.key
                  ? (activeItems as any[]).filter(
                      i => (i.productCategory ?? "individual") === cat.key
                    ).length
                  : activeItems.length;
                if (cat.key && count === 0) return null;
                return (
                  <button
                    key={String(cat.key)}
                    onClick={() => {
                      setSelectedCategory(cat.key);
                      setSelectedType(null);
                    }}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95"
                    style={
                      selectedCategory === cat.key
                        ? { background: "var(--primary)", color: "white" }
                        : {
                            background: "var(--border)",
                            color: "var(--foreground)",
                          }
                    }
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>
          )}
        {/* Filtro por tipo de trabalho (chips dinâmicos) */}
        {!isLoading && uniqueTypes.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedType(null)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={
                selectedType === null
                  ? { background: "var(--primary)", color: "white" }
                  : { background: "var(--border)", color: "var(--foreground)" }
              }
            >
              Todos ({categoryFilteredItems.length})
            </button>
            {uniqueTypes.map(type => {
              const count = (
                categoryFilteredItems as Array<{ productName: string }>
              ).filter(i => i.productName === type).length;
              return (
                <button
                  key={type}
                  onClick={() =>
                    setSelectedType(selectedType === type ? null : type)
                  }
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  style={
                    selectedType === type
                      ? { background: "var(--primary)", color: "white" }
                      : {
                          background: "var(--border)",
                          color: "var(--foreground)",
                        }
                  }
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted-foreground)]"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
              <p className="text-sm font-medium">Carregando trabalhos...</p>
            </motion.div>
          ) : (activeTab === "para_escrever"
              ? filteredToWrite
              : activeTab === "pendente"
                ? filteredPending
                : filteredDone
            ).length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20"
            >
              <ClipboardList className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                {selectedType
                  ? `Nenhum "${selectedType}" encontrado`
                  : "Nenhum trabalho encontrado nesta categoria."}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={
                  activeTab === "para_escrever"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                }
              >
                {(activeTab === "para_escrever"
                  ? filteredToWrite
                  : activeTab === "pendente"
                    ? filteredPending
                    : filteredDone
                ).map(item =>
                  activeTab === "para_escrever" ? (
                    <ToWriteCard
                      key={item.id}
                      item={item}
                      sellers={sellers}
                      onMarkWritten={id => markWritten.mutate({ id })}
                    />
                  ) : activeTab === "pendente" ? (
                    <PendingCard
                      key={item.id}
                      item={item}
                      onMarkDone={id => markDone.mutate({ id })}
                      onUndoWritten={id => undoWritten.mutate({ id })}
                      sellers={sellers}
                    />
                  ) : (
                    <DoneCard
                      key={item.id}
                      item={item}
                      onUndo={id => restoreToPending.mutate({ id })}
                      sellers={sellers}
                    />
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
