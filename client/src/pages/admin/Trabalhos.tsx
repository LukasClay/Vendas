import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CheckCircle2, Clock, AlertTriangle, Search, Copy, Check,
  ChevronDown, ChevronUp, Phone, Calendar, FileText,
  X, Pencil, Hourglass, BookCheck, ClipboardList,
  RotateCcw, UserCog, Loader2
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  if (isOverdue) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ 
        background: isDark ? "rgba(239, 68, 68, 0.15)" : "#fde8e8", 
        color: isDark ? "#f87171" : "#c0392b",
        border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.3)" : "#f0b0b0"}`
      }}>
      <AlertTriangle className="w-3 h-3" />
      {Math.abs(daysRemaining)}d atrasado
    </span>
  );
  
  if (daysRemaining <= 1) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ 
        background: isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3e2", 
        color: isDark ? "#fbbf24" : "#b7770d",
        border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.3)" : "#f0d0a0"}`
      }}>
      <Clock className="w-3 h-3" />
      Urgente
    </span>
  );
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ 
        background: isDark ? "rgba(202, 138, 4, 0.15)" : "var(--accent)", 
        color: isDark ? "#eab308" : "#7a5a20",
        border: `1px solid ${isDark ? "rgba(202, 138, 4, 0.3)" : "rgba(202, 138, 4, 0.2)"}`
      }}>
      <Clock className="w-3 h-3" />
      {daysRemaining}d restantes
    </span>
  );
}

function SellerEditInline({ saleId, currentSellerName, sellers, onUpdated }: {
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

  if (!editing) {
    return (
      <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all active:scale-95 font-bold uppercase tracking-wider"
        style={{ 
          background: isDark ? "rgba(139, 92, 246, 0.15)" : "#eaeaf8", 
          color: isDark ? "#a78bfa" : "#4a4a80",
          border: `1px solid ${isDark ? "rgba(139, 92, 246, 0.3)" : "#c0c0e8"}`
        }}>
        <UserCog className="w-3 h-3" />
        {currentSellerName || "Sem vendedor"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        className="text-[10px] px-2 py-1 rounded-lg outline-none font-bold uppercase"
        style={{ background: "var(--secondary)", border: "1.5px solid var(--border)", color: "var(--foreground)" }}>
        <option value="">Selecionar...</option>
        {sellers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
      </select>
      <button onClick={() => {
        if (!selectedId) { toast.error("Selecione um vendedor"); return; }
        const seller = sellers.find(s => s.id === Number(selectedId));
        if (!seller) return;
        updateSeller.mutate({ saleId, sellerId: seller.id, sellerName: seller.name ?? "" });
      }} disabled={updateSeller.isPending}
        className="text-[10px] px-2 py-1 rounded-lg font-bold active:scale-95 text-white bg-[var(--primary)] uppercase tracking-wider">
        {updateSeller.isPending ? "..." : "Salvar"}
      </button>
      <button onClick={() => setEditing(false)}
        className="text-[10px] px-2 py-1 rounded-lg active:scale-95 bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function ToWriteCard({ item, onMarkWritten, sellers }: {
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
    <button onClick={(e) => { e.stopPropagation(); copy(text, `${item.id}-${field}`); }}
      className="p-2 rounded-lg active:scale-95 shrink-0 transition-all border border-[var(--border)]"
      style={{ 
        background: copiedKey === `${item.id}-${field}` ? "rgba(34, 197, 94, 0.15)" : "var(--secondary)", 
        color: copiedKey === `${item.id}-${field}` ? "#22c55e" : "var(--primary)" 
      }}>
      {copiedKey === `${item.id}-${field}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const isOverdue = item.isOverdue ?? false;
  const isUrgent = item.isUrgent ?? false;
  const daysRemaining = item.daysRemaining ?? 7;
  
  const borderColor = isOverdue 
    ? (isDark ? "#f87171" : "#e88080") 
    : isUrgent 
      ? (isDark ? "#fbbf24" : "#e8b060") 
      : "var(--border)";

  return (
    <div className="rounded-2xl overflow-hidden transition-all border shadow-sm" 
      style={{ background: "var(--card)", borderColor: borderColor }}>
      <div className="px-4 pt-4 pb-3 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <UrgencyBadge daysRemaining={daysRemaining} isOverdue={isOverdue} />
            </div>
            <div className="flex items-center gap-2 flex-wrap" >
              <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{item.clientName}</span>
              <SellerEditInline saleId={item.id} currentSellerName={item.sellerName} sellers={sellers} onUpdated={() => {}} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--primary)" }}>{item.productName}</p>
              {item.productCategory === "promocao" && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">⭐ PROMOÇÃO</span>}
              {item.productCategory === "coletivo" && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">👥 COLETIVO</span>}
            </div>
            <p className="text-[10px] mt-1 font-bold uppercase tracking-tighter" style={{ color: "var(--muted-foreground)" }}>Venda: {formatDate(item.saleDate)}</p>
          </div>
          <div className="p-1 rounded-lg shrink-0 mt-0.5 text-[var(--muted-foreground)]">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)] pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-2 rounded-xl bg-[var(--secondary)]/30 border border-[var(--border)]/50">
                  <Calendar className="w-4 h-4 shrink-0 text-orange-500" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">Nascimento</p>
                    <p className="text-sm font-bold text-[var(--foreground)]">{formatBirthDate(item.clientBirthDate)}</p>
                  </div>
                </div>
                {item.clientPhone && (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--secondary)]/30 border border-[var(--border)]/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Phone className="w-4 h-4 shrink-0 text-green-500" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">Telefone</p>
                        <p className="text-sm font-bold text-[var(--foreground)]">{item.clientPhone}</p>
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
                    <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">Observação</p>
                  </div>
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}

              <div className="pt-2">
                {!confirming ? (
                  <button onClick={() => setConfirming(true)}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-[oklch(0.55_0.15_160)] shadow-lg shadow-green-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                    <BookCheck className="w-4 h-4" /> Marcar como Escrito
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => onMarkWritten(item.id)}
                      className="flex-1 py-3.5 rounded-xl font-bold text-white bg-green-600 active:scale-95 uppercase tracking-widest text-[10px]">
                      Confirmar
                    </button>
                    <button onClick={() => setConfirming(false)}
                      className="flex-1 py-3.5 rounded-xl font-bold bg-[var(--secondary)] text-[var(--foreground)] active:scale-95 uppercase tracking-widest text-[10px] border border-[var(--border)]">
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
function PendingCard({ item, onMarkDone }: { item: any; onMarkDone: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="rounded-2xl p-4 border transition-all shadow-sm" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold" style={{ color: "var(--foreground)" }}>{item.clientName}</p>
          <p className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: "var(--primary)" }}>{item.productName}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--muted-foreground)] bg-[var(--secondary)] px-2 py-0.5 rounded-lg">
              Venda: {formatDate(item.saleDate)}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800">
              Escrito: {formatDate(item.writtenAt)}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--secondary)] text-green-500 border border-[var(--border)] active:scale-95" title="Concluir trabalho">
              <CheckCircle2 className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex flex-col gap-1">
              <button onClick={() => onMarkDone(item.id)} className="w-10 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center active:scale-95"><Check className="w-4 h-4" /></button>
              <button onClick={() => setConfirming(false)} className="w-10 h-8 rounded-lg bg-[var(--secondary)] text-[var(--foreground)] flex items-center justify-center border border-[var(--border)] active:scale-95"><X className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Card: Feito (Trabalhos concluídos)
function DoneCard({ item, onRestore }: { item: any; onRestore: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="rounded-2xl p-4 border transition-all shadow-sm opacity-80" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{item.clientName}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--muted-foreground)" }}>{item.productName}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
             <span className="text-[10px] font-bold uppercase tracking-tighter text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-lg border border-green-100 dark:border-green-800">
              Feito: {formatDate(item.doneAt)}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)] active:scale-95" title="Mover para pendentes">
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex flex-col gap-1">
              <button onClick={() => onRestore(item.id)} className="w-8 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center active:scale-95"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setConfirming(false)} className="w-8 h-7 rounded-lg bg-[var(--secondary)] text-[var(--foreground)] flex items-center justify-center border border-[var(--border)] active:scale-95"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Trabalhos() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [activeTab, setActiveTab] = useState<Tab>("para_escrever");
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: toWrite = [], isLoading: load1 } = trpc.consultora.toWrite.useQuery();
  const { data: pending = [], isLoading: load2 } = trpc.consultora.pending.useQuery();
  const { data: done = [], isLoading: load3 } = trpc.consultora.done.useQuery();
  const { data: sellers = [] } = trpc.users.listSellers.useQuery();

  const markWritten = trpc.consultora.markWritten.useMutation({
    onSuccess: () => { toast.success("Movido para Pendentes!"); utils.consultora.toWrite.invalidate(); utils.consultora.pending.invalidate(); },
    onError: (e) => toast.error(e.message)
  });

  const markDone = trpc.consultora.markDone.useMutation({
    onSuccess: () => { toast.success("Trabalho concluído!"); utils.consultora.pending.invalidate(); utils.consultora.done.invalidate(); },
    onError: (e) => toast.error(e.message)
  });

  const restoreToPending = trpc.consultora.restoreToPending.useMutation({
    onSuccess: () => { toast.success("Restaurado para Pendentes!"); utils.consultora.done.invalidate(); utils.consultora.pending.invalidate(); },
    onError: (e) => toast.error(e.message)
  });

  const list = activeTab === "para_escrever" ? toWrite : activeTab === "pendente" ? pending : done;
  const filtered = list.filter(i => 
    i.clientName.toLowerCase().includes(search.toLowerCase()) || 
    i.productName.toLowerCase().includes(search.toLowerCase())
  );

  const isLoading = load1 || load2 || load3;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>Painel de Trabalhos</h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Gerenciamento de fluxo de produção</p>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente ou trabalho..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl outline-none border border-[var(--border)] text-sm transition-all focus:ring-2 focus:ring-[var(--primary)]/20"
                style={{ background: "var(--card)", color: "var(--foreground)" }} />
            </div>
          </div>
        </FadeIn>

        {/* Tabs */}
        <div className="flex p-1 rounded-2xl bg-[var(--secondary)]/50 border border-[var(--border)] overflow-x-auto no-scrollbar">
          {[
            { id: "para_escrever", label: "Para Escrever", count: toWrite.length, icon: Pencil },
            { id: "pendente", label: "Pendentes", count: pending.length, icon: Hourglass },
            { id: "feito", label: "Feitos", count: done.length, icon: CheckCircle2 }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-[var(--card)] text-[var(--primary)] shadow-sm border border-[var(--border)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted-foreground)]">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
              <p className="text-sm font-medium">Carregando trabalhos...</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
              <ClipboardList className="w-12 h-12 text-[var(--muted-foreground)] opacity-20" />
              <p className="text-sm font-medium text-[var(--muted-foreground)]">Nenhum trabalho encontrado nesta categoria.</p>
            </motion.div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className={activeTab === "para_escrever" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
                {filtered.map(item => (
                  activeTab === "para_escrever" ? (
                    <ToWriteCard key={item.id} item={item} sellers={sellers} onMarkWritten={id => markWritten.mutate({ saleId: id })} />
                  ) : activeTab === "pendente" ? (
                    <PendingCard key={item.id} item={item} onMarkDone={id => markDone.mutate({ saleId: id })} />
                  ) : (
                    <DoneCard key={item.id} item={item} onRestore={id => restoreToPending.mutate({ saleId: id })} />
                  )
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
