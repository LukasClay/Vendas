import { trpc, type RouterOutputs } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  Search,
  Loader2,
  Package,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { CompanyBadge } from "@/components/CompanySwitch";

type DeletedSale = RouterOutputs["sales"]["listDeleted"][number];

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function daysRemaining(deletedAt: string | Date | null): number {
  if (!deletedAt) return 30;
  const deleted = new Date(deletedAt);
  const expiry = new Date(deleted);
  expiry.setDate(expiry.getDate() + 30);
  const now = new Date();
  const diff = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

function getDaysColor(days: number): string {
  if (days <= 3) return "#ef4444";
  if (days <= 7) return "#f59e0b";
  if (days <= 14) return "#eab308";
  return "var(--muted-foreground)";
}

export default function AdminLixeira() {
  const utils = trpc.useUtils();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const { data: deletedSales = [], isLoading } =
    trpc.sales.listDeleted.useQuery();

  const restoreMutation = trpc.sales.restore.useMutation({
    onSuccess: () => {
      toast.success("Venda restaurada com sucesso!");
      utils.sales.listDeleted.invalidate();
      utils.sales.list.invalidate();
      utils.reports.summary.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const permanentDeleteMutation = trpc.sales.permanentDelete.useMutation({
    onSuccess: () => {
      toast.success("Venda excluída permanentemente.");
      utils.sales.listDeleted.invalidate();
      setConfirmDelete(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cleanupMutation = trpc.sales.cleanupTrash.useMutation({
    onSuccess: data => {
      toast.success(`${data.deletedCount} venda(s) expirada(s) removida(s).`);
      utils.sales.listDeleted.invalidate();
      setConfirmCleanup(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = deletedSales.filter((item: DeletedSale) => {
    const sale = item.sale ?? item;
    const term = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      sale.clientName?.toLowerCase().includes(term) ||
      sale.productName?.toLowerCase().includes(term) ||
      (item.sellerDisplayName || item.sellerName || "")
        .toLowerCase()
        .includes(term)
    );
  });

  const expiredCount = deletedSales.filter((item: DeletedSale) => {
    const sale = item.sale ?? item;
    return daysRemaining(sale.deletedAt) === 0;
  }).length;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-bold flex items-center gap-3"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  color: "var(--foreground)",
                }}
              >
                <Trash2
                  className="w-7 h-7"
                  style={{ color: "var(--primary)" }}
                />
                Lixeira
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Vendas excluídas ficam aqui por 30 dias antes da exclusão
                permanente
              </p>
            </div>
            {expiredCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setConfirmCleanup(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "#ef4444" }}
              >
                <Trash2 className="w-4 h-4" />
                Limpar Expiradas ({expiredCount})
              </motion.button>
            )}
          </div>
        </FadeIn>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            placeholder="Buscar por cliente, trabalho ou vendedor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            style={{
              border: "1.5px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <FadeIn>
            <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--secondary)]">
                <Trash2
                  className="w-8 h-8"
                  style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
                />
              </div>
              <p
                className="text-lg font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {searchTerm ? "Nenhum resultado encontrado" : "Lixeira vazia"}
              </p>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {searchTerm
                  ? "Tente buscar por outro termo."
                  : "Vendas excluídas aparecerão aqui."}
              </p>
            </div>
          </FadeIn>
        ) : (
          <StaggerList>
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
            >
              {filtered.length} venda{filtered.length !== 1 ? "s" : ""} na
              lixeira
            </p>
            {filtered.map((item: DeletedSale) => {
              const sale = item.sale ?? item;
              const days = daysRemaining(sale.deletedAt);
              const daysColor = getDaysColor(days);
              const sellerName =
                item.sellerDisplayName || item.sellerName || "—";

              return (
                <StaggerItem key={sale.id}>
                  <motion.div
                    layout
                    className="rounded-2xl p-5 shadow-xl border border-[var(--border)] bg-[var(--card)]"
                    style={{ opacity: days === 0 ? 0.6 : 1 }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3
                            className="font-bold text-base"
                            style={{ color: "var(--foreground)" }}
                          >
                            {sale.clientName}
                          </h3>
                          <CompanyBadge company={sale.company} />
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {sale.productName}
                          </span>
                          <span>Vendedor: {sellerName}</span>
                          <span>Data: {formatDate(sale.saleDate)}</span>
                          <span
                            className="font-bold"
                            style={{ color: "var(--primary)" }}
                          >
                            {formatCurrency(sale.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock
                            className="w-3 h-3"
                            style={{ color: daysColor }}
                          />
                          <span
                            className="text-xs font-bold"
                            style={{ color: daysColor }}
                          >
                            {days === 0
                              ? "Expirada — será excluída permanentemente"
                              : `${days} dia${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                        {sale.deletedAt && (
                          <p
                            className="text-[10px]"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            Excluída em{" "}
                            {new Date(sale.deletedAt).toLocaleDateString(
                              "pt-BR"
                            )}{" "}
                            às{" "}
                            {new Date(sale.deletedAt).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {confirmRestore === sale.id ? (
                          <div className="flex items-center gap-2">
                            <motion.button
                              initial={{ scale: 0.9 }}
                              animate={{ scale: 1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                restoreMutation.mutate({ id: sale.id });
                                setConfirmRestore(null);
                              }}
                              disabled={restoreMutation.isPending}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                              style={{ background: "#22c55e", color: "white" }}
                            >
                              {restoreMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              Confirmar
                            </motion.button>
                            <button
                              onClick={() => setConfirmRestore(null)}
                              className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                              style={{
                                background: "var(--secondary)",
                                color: "var(--foreground)",
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setConfirmRestore(sale.id);
                              setConfirmDelete(null);
                            }}
                            disabled={restoreMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                            style={{
                              background: "rgba(34, 197, 94, 0.1)",
                              color: "#22c55e",
                              border: "1px solid rgba(34, 197, 94, 0.3)",
                            }}
                          >
                            {restoreMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                            Restaurar
                          </motion.button>
                        )}

                        {confirmDelete === sale.id ? (
                          <div className="flex items-center gap-2">
                            <motion.button
                              initial={{ scale: 0.9 }}
                              animate={{ scale: 1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                permanentDeleteMutation.mutate({ id: sale.id })
                              }
                              disabled={permanentDeleteMutation.isPending}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                              style={{ background: "#ef4444" }}
                            >
                              {permanentDeleteMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                              Confirmar
                            </motion.button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                              style={{
                                background: "var(--secondary)",
                                color: "var(--foreground)",
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setConfirmDelete(sale.id)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "#ef4444",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}

        {/* Cleanup Confirmation Modal */}
        <AnimatePresence>
          {confirmCleanup && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={e => {
                if (e.target === e.currentTarget) setConfirmCleanup(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md rounded-2xl p-6 shadow-2xl border border-[var(--border)]"
                style={{ background: "var(--card)" }}
              >
                <div className="text-center mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(239, 68, 68, 0.1)" }}
                  >
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3
                    className="text-xl font-bold mb-2"
                    style={{
                      color: "var(--foreground)",
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    Limpar Vendas Expiradas
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Isso vai excluir permanentemente{" "}
                    <strong style={{ color: "#ef4444" }}>
                      {expiredCount} venda{expiredCount !== 1 ? "s" : ""}
                    </strong>{" "}
                    que já passaram dos 30 dias.
                    <br />
                    <br />
                    <strong style={{ color: "var(--foreground)" }}>
                      Essa ação não pode ser desfeita.
                    </strong>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmCleanup(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: "var(--secondary)",
                      color: "var(--foreground)",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => cleanupMutation.mutate()}
                    disabled={cleanupMutation.isPending}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: "#ef4444" }}
                  >
                    {cleanupMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Excluir Permanentemente
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
