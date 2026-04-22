import { trpc, type RouterOutputs } from "@/lib/trpc";
import { AlertTriangle, Clock, RefreshCw, Phone, User } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { useTheme } from "@/contexts/ThemeContext";

type AlertItem = RouterOutputs["consultora"]["alerts"][number];

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("pt-BR");
}

function StatusBadge({
  status,
  isDark,
}: {
  status: "para_escrever" | "pendente";
  isDark: boolean;
}) {
  if (status === "para_escrever")
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          background: isDark ? "var(--secondary)" : "oklch(0.94 0.02 260)",
          color: isDark ? "var(--primary)" : "oklch(0.40 0.10 260)",
        }}
      >
        Para Escrever
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: isDark ? "var(--secondary)" : "oklch(0.94 0.04 55)",
        color: isDark ? "var(--primary)" : "oklch(0.45 0.12 55)",
      }}
    >
      Pendente
    </span>
  );
}

function UrgencyChip({
  daysRemaining,
  isOverdue,
  isDark,
}: {
  daysRemaining: number;
  isOverdue: boolean;
  isDark: boolean;
}) {
  if (isOverdue)
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{
          background: isDark ? "oklch(0.20 0.04 25)" : "oklch(0.96 0.04 25)",
          color: isDark ? "oklch(0.75 0.18 25)" : "oklch(0.50 0.20 25)",
          border: `1.5px solid ${isDark ? "oklch(0.30 0.08 25)" : "oklch(0.88 0.10 25)"}`,
        }}
      >
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(daysRemaining)}d atrasado
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{
        background: isDark ? "oklch(0.20 0.04 55)" : "oklch(0.97 0.04 55)",
        color: isDark ? "oklch(0.75 0.14 55)" : "oklch(0.45 0.18 55)",
        border: `1.5px solid ${isDark ? "oklch(0.30 0.08 55)" : "oklch(0.88 0.10 55)"}`,
      }}
    >
      <Clock className="w-3 h-3" />
      {daysRemaining}d restante{daysRemaining !== 1 ? "s" : ""}
    </span>
  );
}

export default function AdminAlertas() {
  const {
    data: alerts = [],
    isLoading,
    refetch,
    isFetching,
  } = trpc.consultora.alerts.useQuery(undefined, {
    staleTime: 3 * 60 * 1000,
    refetchOnMount: "always",
  });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const overdueCount = alerts.filter((a: AlertItem) => a.isOverdue).length;
  const urgentCount = alerts.filter(
    (a: AlertItem) => !a.isOverdue && a.isUrgent
  ).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  color: "var(--foreground)",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                Alertas
              </h1>
              <p
                className="text-sm mt-0.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                Trabalhos com prazo crítico — Para Escrever e Pendentes
              </p>
            </div>
            <motion.button
              onClick={() => refetch()}
              disabled={isFetching}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "var(--secondary)",
                color: "var(--primary)",
              }}
            >
              <RefreshCw
                className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </motion.button>
          </div>
        </FadeIn>

        {/* Resumo */}
        <StaggerList className="grid grid-cols-2 gap-3">
          <StaggerItem>
            <div className="rounded-2xl p-4 shadow-xl border border-[var(--border)] bg-[var(--card)]">
              <p className="text-xs font-bold uppercase mb-1 text-[var(--muted-foreground)]">
                Atrasados
              </p>
              <p
                className="text-3xl font-bold"
                style={{
                  color: isDark ? "oklch(0.75 0.18 25)" : "oklch(0.50 0.20 25)",
                }}
              >
                {overdueCount}
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-2xl p-4 shadow-xl border border-[var(--border)] bg-[var(--card)]">
              <p className="text-xs font-bold uppercase mb-1 text-[var(--muted-foreground)]">
                Urgentes (≤2 dias)
              </p>
              <p
                className="text-3xl font-bold"
                style={{
                  color: isDark ? "oklch(0.75 0.16 55)" : "oklch(0.50 0.18 55)",
                }}
              >
                {urgentCount}
              </p>
            </div>
          </StaggerItem>
        </StaggerList>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-24 rounded-2xl animate-pulse bg-[var(--card)]"
              />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <FadeIn>
            <div className="rounded-2xl p-10 text-center border border-dashed border-[var(--border)] bg-[var(--card)] shadow-xl">
              <p className="text-4xl mb-3">✅</p>
              <p
                className="font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Nenhum alerta no momento
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Todos os trabalhos estão dentro do prazo
              </p>
            </div>
          </FadeIn>
        ) : (
          <StaggerList className="space-y-3">
            {alerts.map((item: AlertItem) => {
              const borderColor = item.isOverdue
                ? isDark
                  ? "oklch(0.30 0.10 25)"
                  : "oklch(0.80 0.12 25)"
                : isDark
                  ? "oklch(0.30 0.08 55)"
                  : "oklch(0.82 0.10 55)";
              const bgColor = item.isOverdue
                ? isDark
                  ? "oklch(0.16 0.02 25)"
                  : "oklch(0.99 0.015 25)"
                : isDark
                  ? "oklch(0.16 0.02 55)"
                  : "oklch(0.99 0.010 55)";
              return (
                <StaggerItem key={item.id}>
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: bgColor,
                      border: `1.5px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <UrgencyChip
                            daysRemaining={item.daysRemaining}
                            isOverdue={item.isOverdue}
                            isDark={isDark}
                          />
                          <StatusBadge
                            status={item.workStatus}
                            isDark={isDark}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <User
                            className="w-4 h-4 shrink-0"
                            style={{ color: "var(--primary)" }}
                          />
                          <span
                            className="font-semibold text-sm"
                            style={{ color: "var(--foreground)" }}
                          >
                            {item.clientName}
                          </span>
                          {item.sellerName && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
                              {item.sellerName}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          {item.productName}
                          {item.productCategory === "promocao" && " ⭐"}
                          {item.productCategory === "coletivo" && " 👥"}
                        </p>
                        {item.clientPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone
                              className="w-3.5 h-3.5"
                              style={{ color: "var(--muted-foreground)" }}
                            />
                            <span
                              className="text-xs"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              {item.clientPhone}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className="text-xs"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          Venda
                        </p>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {formatDate(item.saleDate)}
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          Prazo
                        </p>
                        <p
                          className="text-sm font-semibold"
                          style={{
                            color: item.isOverdue
                              ? isDark
                                ? "oklch(0.75 0.18 25)"
                                : "oklch(0.50 0.20 25)"
                              : isDark
                                ? "oklch(0.75 0.14 55)"
                                : "oklch(0.45 0.18 55)",
                          }}
                        >
                          {formatDate(item.deadline)}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </div>
    </DashboardLayout>
  );
}
