import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingBag, Users, TrendingUp, Crown, Star, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { motion } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem, AnimatedCard } from "@/components/Animations";
import { useTheme } from "@/contexts/ThemeContext";

function formatDeadline(deadline: string | Date | undefined): string {
  if (!deadline) return "—";
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  return d.toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CURRENT_YEAR = new Date().getFullYear();
const RECENT_SALES_INPUT = { limit: 8 } as const;
const MONTHLY_INPUT = { year: CURRENT_YEAR } as const;

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const summaryInput = useMemo(
    () => (dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined),
    [dateFilter.startDate, dateFilter.endDate]
  );

  const { data: reportData, isLoading } = trpc.reports.summary.useQuery(summaryInput);
  const { data: monthlyData = [] } = trpc.reports.salesByMonth.useQuery(MONTHLY_INPUT);
  const { data: recentSales = [] } = trpc.sales.list.useQuery(RECENT_SALES_INPUT);

  const chartData = MONTHS.map((name, i) => {
    const found = monthlyData.find((m: any) => Number(m.month) === i + 1);
    return { name, total: found ? Number(found.totalAmount) : 0, vendas: found ? Number(found.totalSales) : 0 };
  });

  const summary = reportData?.summary;
  const topSellers = reportData?.topSellers ?? [];
  const topClients = reportData?.topClients ?? [];

  const { data: worksSummary } = trpc.consultora.worksSummary.useQuery(undefined, { staleTime: 3 * 60 * 1000 });
  const pendingWorks: any[] = worksSummary?.pending ?? [];
  const toWriteWorks: any[] = worksSummary?.toWrite ?? [];

  const overdueWorks = pendingWorks.filter(w => w.isOverdue);
  const urgentWorks = pendingWorks.filter(w => w.isUrgent);
  const onTrackWorks = pendingWorks.filter(w => !w.isOverdue && !w.isUrgent);

  // Cores do gráfico que funcionam em ambos os temas
  const chartBarColor = isDark ? "oklch(0.68 0.14 65)" : "oklch(0.60 0.13 65)";
  const chartGridColor = isDark ? "oklch(0.25 0.01 265)" : "oklch(0.92 0.008 65)";
  const chartTickColor = isDark ? "oklch(0.55 0.01 265)" : "oklch(0.52 0.015 260)";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                Dashboard
              </h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Visão geral das vendas e performance
              </p>
            </div>
            {/* Filtro de datas */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {([
                  { label: 'Hoje', fn: () => { const t = new Date().toISOString().slice(0,10); setDateFilter({ startDate: t, endDate: t }); } },
                  { label: 'Esta semana', fn: () => { const now = new Date(); const day = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); setDateFilter({ startDate: mon.toISOString().slice(0,10), endDate: sun.toISOString().slice(0,10) }); } },
                  { label: 'Este mês', fn: () => { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); const last = new Date(now.getFullYear(), now.getMonth() + 1, 0); setDateFilter({ startDate: first.toISOString().slice(0,10), endDate: last.toISOString().slice(0,10) }); } },
                  { label: 'Mês passado', fn: () => { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth() - 1, 1); const last = new Date(now.getFullYear(), now.getMonth(), 0); setDateFilter({ startDate: first.toISOString().slice(0,10), endDate: last.toISOString().slice(0,10) }); } },
                ] as { label: string; fn: () => void }[]).map(({ label, fn }) => (
                  <motion.button key={label} onClick={fn}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: "var(--secondary)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                    {label}
                  </motion.button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={dateFilter.startDate}
                  onChange={e => setDateFilter(f => ({ ...f, startDate: e.target.value }))}
                  className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                />
                <span className="text-sm shrink-0" style={{ color: "var(--muted-foreground)" }}>até</span>
                <input type="date" value={dateFilter.endDate}
                  onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
                  className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                />
                {(dateFilter.startDate || dateFilter.endDate) && (
                  <motion.button
                    onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium shrink-0"
                    style={{ background: "var(--secondary)", color: "var(--primary)" }}>
                    Limpar
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* KPI Cards */}
        <StaggerList className="grid grid-cols-2 gap-3">
          {[
            { icon: DollarSign, label: "Total Vendido", value: isLoading ? "..." : formatCurrency(summary?.totalAmount ?? 0), color: "var(--primary)", bg: "var(--secondary)" },
            { icon: ShoppingBag, label: "Nº de Vendas", value: isLoading ? "..." : String(summary?.totalSales ?? 0), color: isDark ? "oklch(0.65 0.18 160)" : "oklch(0.55 0.15 160)", bg: isDark ? "oklch(0.20 0.03 160)" : "oklch(0.92 0.04 160)" },
            { icon: Users, label: "Melhores Clientes", value: isLoading ? "..." : String(topClients.length), color: isDark ? "oklch(0.60 0.18 250)" : "oklch(0.50 0.18 250)", bg: isDark ? "oklch(0.20 0.03 250)" : "oklch(0.92 0.04 250)" },
            { icon: TrendingUp, label: "Melhores Vendedores", value: isLoading ? "..." : String(topSellers.length), color: isDark ? "oklch(0.65 0.20 30)" : "oklch(0.55 0.20 30)", bg: isDark ? "oklch(0.20 0.03 30)" : "oklch(0.93 0.04 30)" },
          ].map((card, i) => (
            <StaggerItem key={i}>
              <AnimatedCard className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: card.bg }}>
                    <card.icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                  <span className="text-xs font-medium leading-tight" style={{ color: "var(--muted-foreground)" }}>{card.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                  {card.value}
                </p>
              </AnimatedCard>
            </StaggerItem>
          ))}
        </StaggerList>

        {/* Gráfico + Ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <FadeIn delay={0.2} className="xl:col-span-2">
            <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-5 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Vendas por Mês — {CURRENT_YEAR}
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      background: isDark ? "#1c1c28" : "white",
                      color: isDark ? "#e8e4dc" : "#1a1a2e",
                    }}
                  />
                  <Bar dataKey="total" fill={chartBarColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>

          {/* Top Vendedores */}
          <FadeIn delay={0.3}>
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Crown className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Top Vendedores
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />
                  ))}
                </div>
              ) : topSellers.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>Nenhum dado ainda</p>
              ) : (
                <StaggerList className="space-y-3">
                  {topSellers.slice(0, 5).map((seller: any, i: number) => (
                    <StaggerItem key={i}>
                      <div className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: i === 0 ? "var(--secondary)" : "var(--muted)" }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: i === 0 ? "var(--primary)" : "var(--border)",
                            color: i === 0 ? "white" : "var(--muted-foreground)",
                          }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                            {seller.sellerDisplayName || seller.sellerName || "Vendedor"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {seller.totalSales} venda{Number(seller.totalSales) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                          {formatCurrency(seller.totalAmount)}
                        </span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </div>
          </FadeIn>
        </div>

        {/* Painel de Urgência dos Trabalhos */}
        <FadeIn delay={0.4}>
          <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2 sm:mb-0">
                <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <Clock className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  Status dos Trabalhos
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                {toWriteWorks.length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                    style={{ background: isDark ? "oklch(0.20 0.03 250)" : "oklch(0.92 0.04 250)", color: isDark ? "oklch(0.70 0.15 250)" : "oklch(0.35 0.15 250)" }}>
                    <Clock className="w-3 h-3" /> {toWriteWorks.length} para escrever
                  </span>
                )}
                {overdueWorks.length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                    style={{ background: isDark ? "oklch(0.20 0.04 25)" : "oklch(0.93 0.06 25)", color: isDark ? "oklch(0.75 0.18 25)" : "oklch(0.40 0.18 25)" }}>
                    <AlertTriangle className="w-3 h-3" /> {overdueWorks.length} atrasado{overdueWorks.length !== 1 ? "s" : ""}
                  </span>
                )}
                {urgentWorks.length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                    style={{ background: isDark ? "oklch(0.20 0.04 55)" : "oklch(0.94 0.06 55)", color: isDark ? "oklch(0.75 0.14 55)" : "oklch(0.45 0.14 55)" }}>
                    <AlertTriangle className="w-3 h-3" /> {urgentWorks.length} urgente{urgentWorks.length !== 1 ? "s" : ""}
                  </span>
                )}
                {onTrackWorks.length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                    style={{ background: isDark ? "oklch(0.20 0.03 160)" : "oklch(0.92 0.04 160)", color: isDark ? "oklch(0.70 0.15 160)" : "oklch(0.35 0.15 160)" }}>
                    <CheckCircle2 className="w-3 h-3" /> {onTrackWorks.length} no prazo
                  </span>
                )}
              </div>
            </div>
            {pendingWorks.length === 0 && toWriteWorks.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum trabalho pendente no momento</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "var(--muted)" }}>
                        {["Status", "Cliente", "Trabalho", "Data da Venda", "Prazo", "Dias Restantes"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...(toWriteWorks as any[]).slice(0, 3), ...[...overdueWorks, ...urgentWorks, ...onTrackWorks].slice(0, 10)].map((w: any) => {
                        const daysRemaining: number = w.daysRemaining ?? 7;
                        const isOverdue: boolean = w.isOverdue ?? false;
                        const isUrgent: boolean = w.isUrgent ?? false;
                        const deadlineDate = formatDeadline(w.deadline);
                        const isParaEscrever = w.writtenAt === undefined && w.createdAt !== undefined;
                        return (
                          <tr key={`${isParaEscrever ? 'write' : 'pend'}-${w.id}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={isParaEscrever
                                  ? { background: isDark ? "oklch(0.20 0.03 250)" : "oklch(0.92 0.04 250)", color: isDark ? "oklch(0.70 0.15 250)" : "oklch(0.35 0.15 250)" }
                                  : isOverdue
                                  ? { background: isDark ? "oklch(0.20 0.04 25)" : "oklch(0.93 0.06 25)", color: isDark ? "oklch(0.75 0.18 25)" : "oklch(0.40 0.18 25)" }
                                  : isUrgent
                                  ? { background: isDark ? "oklch(0.20 0.04 55)" : "oklch(0.94 0.06 55)", color: isDark ? "oklch(0.75 0.14 55)" : "oklch(0.45 0.14 55)" }
                                  : { background: isDark ? "oklch(0.20 0.03 160)" : "oklch(0.92 0.04 160)", color: isDark ? "oklch(0.70 0.15 160)" : "oklch(0.35 0.15 160)" }}>
                                {isParaEscrever ? "Para Escrever" : isOverdue ? "Atrasado" : isUrgent ? "Urgente" : "No Prazo"}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{w.clientName}</td>
                            <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{w.productName}</td>
                            <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{formatDate(w.saleDate)}</td>
                            <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{deadlineDate}</td>
                            <td className="px-4 py-3">
                              <span className="font-semibold" style={{
                                color: isParaEscrever
                                  ? (isDark ? "oklch(0.70 0.15 250)" : "oklch(0.35 0.15 250)")
                                  : isOverdue ? (isDark ? "oklch(0.75 0.18 25)" : "oklch(0.45 0.18 25)")
                                  : isUrgent ? (isDark ? "oklch(0.75 0.14 55)" : "oklch(0.50 0.14 55)")
                                  : (isDark ? "oklch(0.70 0.15 160)" : "oklch(0.40 0.15 160)")
                              }}>
                                {isOverdue ? `${Math.abs(daysRemaining)}d atrasado` : `${daysRemaining}d restante${daysRemaining !== 1 ? "s" : ""}`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y" style={{ borderColor: "var(--border)" }}>
                  {[...(toWriteWorks as any[]).slice(0, 3), ...[...overdueWorks, ...urgentWorks, ...onTrackWorks].slice(0, 10)].map((w: any) => {
                    const isParaEscrever = w.writtenAt === undefined && w.createdAt !== undefined;
                    const daysRemaining: number = w.daysRemaining ?? 7;
                    const isOverdue: boolean = w.isOverdue ?? false;
                    const isUrgent: boolean = w.isUrgent ?? false;
                    const deadlineDate = formatDeadline(w.deadline);
                    return (
                      <div key={`m-${isParaEscrever ? 'write' : 'pend'}-${w.id}`} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={isParaEscrever
                              ? { background: isDark ? "oklch(0.20 0.03 250)" : "oklch(0.92 0.04 250)", color: isDark ? "oklch(0.70 0.15 250)" : "oklch(0.35 0.15 250)" }
                              : isOverdue
                              ? { background: isDark ? "oklch(0.20 0.04 25)" : "oklch(0.93 0.06 25)", color: isDark ? "oklch(0.75 0.18 25)" : "oklch(0.40 0.18 25)" }
                              : isUrgent
                              ? { background: isDark ? "oklch(0.20 0.04 55)" : "oklch(0.94 0.06 55)", color: isDark ? "oklch(0.75 0.14 55)" : "oklch(0.45 0.14 55)" }
                              : { background: isDark ? "oklch(0.20 0.03 160)" : "oklch(0.92 0.04 160)", color: isDark ? "oklch(0.70 0.15 160)" : "oklch(0.35 0.15 160)" }}>
                            {isParaEscrever ? "Para Escrever" : isOverdue ? "Atrasado" : isUrgent ? "Urgente" : "No Prazo"}
                          </span>
                          <span className="font-semibold text-xs" style={{
                            color: isParaEscrever
                              ? (isDark ? "oklch(0.70 0.15 250)" : "oklch(0.35 0.15 250)")
                              : isOverdue ? (isDark ? "oklch(0.75 0.18 25)" : "oklch(0.45 0.18 25)")
                              : isUrgent ? (isDark ? "oklch(0.75 0.14 55)" : "oklch(0.50 0.14 55)")
                              : (isDark ? "oklch(0.70 0.15 160)" : "oklch(0.40 0.15 160)")
                          }}>
                            {isOverdue ? `${Math.abs(daysRemaining)}d atrasado` : `${daysRemaining}d restante${daysRemaining !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{w.clientName}</p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {w.productName} · Prazo: {deadlineDate}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {(pendingWorks as any[]).length > 10 && (
                  <div className="px-4 sm:px-6 py-3 text-center border-t" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      Mostrando 10 de {(pendingWorks as any[]).length} trabalhos pendentes. Veja todos em <a href="/admin/vendas" className="underline" style={{ color: "var(--primary)" }}>Todas as Vendas</a>.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </FadeIn>

        {/* Top Clientes + Vendas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FadeIn delay={0.5}>
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Star className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Melhores Clientes
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />)}
                </div>
              ) : topClients.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>Nenhum dado ainda</p>
              ) : (
                <StaggerList className="space-y-2">
                  {topClients.slice(0, 6).map((client: any, i: number) => (
                    <StaggerItem key={i}>
                      <div className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: "var(--muted)" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--primary)" }}>
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{client.clientName}</p>
                            {client.clientPhone && (
                              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{client.clientPhone}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                            {formatCurrency(client.totalAmount)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {client.totalSales} venda{Number(client.totalSales) !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={0.6}>
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Vendas Recentes</h2>
              {recentSales.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>Nenhuma venda ainda</p>
              ) : (
                <StaggerList className="space-y-2">
                  {recentSales.slice(0, 6).map((item: any) => {
                    const sale = item.sale ?? item;
                    const seller = item.seller;
                    return (
                      <StaggerItem key={sale.id}>
                        <div className="flex items-center justify-between p-3 rounded-xl"
                          style={{ background: "var(--muted)" }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{sale.clientName}</p>
                            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                              {sale.productName} · {seller?.displayName || seller?.name || ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                              {formatCurrency(sale.amount)}
                            </p>
                            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                              {formatDate(sale.saleDate)}
                            </p>
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </StaggerList>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </DashboardLayout>
  );
}
