import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingBag, Users, TrendingUp, Crown, Star, AlertTriangle, Clock, CheckCircle2, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { motion } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem, AnimatedCard, AnimatedNumber, SkeletonCard, SkeletonPulse } from "@/components/Animations";
import { useTheme } from "@/contexts/ThemeContext";
import CompanySwitch, { getCompanyInfo } from "@/components/CompanySwitch";
import { Building2 } from "lucide-react";

function formatDeadline(deadline: string | Date | undefined): string {
  if (!deadline) return "—";
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  return d.toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const RECENT_SALES_INPUT = { limit: 8 } as const;

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const summaryInput = useMemo(
    () => (dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined),
    [dateFilter.startDate, dateFilter.endDate]
  );

  const { data: reportData, isLoading } = trpc.reports.summary.useQuery(summaryInput);
  const { data: last7DaysData = [] } = trpc.reports.salesLast7Days.useQuery();
  const { data: recentSales = [] } = trpc.sales.list.useQuery(RECENT_SALES_INPUT);

  // Gerar últimos 7 dias
  const chartData = useMemo(() => {
    const days: { name: string; total: number; vendas: number; fullDate: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const found = last7DaysData.find((r: any) => r.day === iso);
      const dayName = i === 0 ? "Hoje" : i === 1 ? "Ontem" : WEEKDAYS_SHORT[d.getDay()];
      days.push({
        name: dayName,
        total: found ? Number(found.totalAmount) : 0,
        vendas: found ? Number(found.totalSales) : 0,
        fullDate: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      });
    }
    return days;
  }, [last7DaysData]);

  const weekTotal = chartData.reduce((s, d) => s + d.total, 0);
  const weekSales = chartData.reduce((s, d) => s + d.vendas, 0);

  const summary = reportData?.summary;
  const topSellers = reportData?.topSellers ?? [];
  const topClients = reportData?.topClients ?? [];
  const summaryByCompany: any[] = reportData?.summaryByCompany ?? [];

  const magiaData = summaryByCompany.find((c: any) => c.company === "mundo_da_magia");
  const ciganoData = summaryByCompany.find((c: any) => c.company === "mundo_cigano");
  const magiaInfo = getCompanyInfo("mundo_da_magia");
  const ciganoInfo = getCompanyInfo("mundo_cigano");

  const { data: worksSummary } = trpc.consultora.worksSummary.useQuery(undefined, { staleTime: 3 * 60 * 1000 });
  const pendingWorks: any[] = worksSummary?.pending ?? [];
  const toWriteWorks: any[] = worksSummary?.toWrite ?? [];

  const overdueWorks = pendingWorks.filter(w => w.isOverdue);
  const urgentWorks = pendingWorks.filter(w => w.isUrgent);
  const onTrackWorks = pendingWorks.filter(w => !w.isOverdue && !w.isUrgent);

  // Cores do gráfico que funcionam em ambos os temas
  const chartGridColor = "var(--border)";
  const chartTickColor = "var(--muted-foreground)";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Company Switch */}
        <CompanySwitch />

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
                  className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                />
                <span className="text-sm shrink-0" style={{ color: "var(--muted-foreground)" }}>até</span>
                <input type="date" value={dateFilter.endDate}
                  onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
                  className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
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

        {/* KPI Cards com Skeleton Loading e Animated Numbers */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <StaggerList className="grid grid-cols-2 gap-3">
            {[
              { icon: DollarSign, label: "Total Vendido", value: Number(summary?.totalAmount ?? 0), prefix: "R$ ", color: "var(--primary)", bg: "var(--secondary)" },
              { icon: ShoppingBag, label: "Nº de Vendas", value: Number(summary?.totalSales ?? 0), prefix: "", color: isDark ? "oklch(0.65 0.18 160)" : "oklch(0.55 0.15 160)", bg: isDark ? "var(--secondary)" : "oklch(0.92 0.04 160)" },
              { icon: Users, label: "Melhores Clientes", value: topClients.length, prefix: "", color: isDark ? "oklch(0.60 0.18 250)" : "oklch(0.50 0.18 250)", bg: isDark ? "var(--secondary)" : "oklch(0.92 0.04 250)" },
              { icon: TrendingUp, label: "Melhores Vendedores", value: topSellers.length, prefix: "", color: isDark ? "oklch(0.65 0.20 30)" : "oklch(0.55 0.20 30)", bg: isDark ? "var(--secondary)" : "oklch(0.93 0.04 30)" },
            ].map((card, i) => (
              <StaggerItem key={i}>
                <AnimatedCard className="rounded-2xl p-4 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <motion.div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: card.bg }}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <card.icon className="w-4 h-4 transition-colors duration-200" style={{ color: card.color }} />
                    </motion.div>
                    <span className="text-xs font-medium leading-tight" style={{ color: "var(--muted-foreground)" }}>{card.label}</span>
                  </div>
                  <p className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                    <AnimatedNumber value={card.value} prefix={card.prefix} duration={1} />
                  </p>
                </AnimatedCard>
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {/* Cards por Empresa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { info: magiaInfo, data: magiaData, key: "mundo_da_magia" },
            { info: ciganoInfo, data: ciganoData, key: "mundo_cigano" },
          ].map(({ info, data, key }) => (
            <FadeIn key={key} delay={0.15}>
              <AnimatedCard className="rounded-2xl p-4 shadow-xl border" style={{ background: "var(--card)", borderColor: info.border }}>
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: info.bg }}
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Building2 className="w-4 h-4" style={{ color: info.color }} />
                  </motion.div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Empresa</p>
                    <p className="text-sm font-bold" style={{ color: info.color }}>{info.short}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: info.bg }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>Vendido</p>
                    <p className="text-lg font-bold" style={{ color: info.color, fontFamily: "'Playfair Display', serif" }}>
                      {isLoading ? <SkeletonPulse width="5em" height="1.4em" /> : (
                        <AnimatedNumber value={Number(data?.totalAmount ?? 0)} prefix="R$ " duration={1} />
                      )}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: info.bg }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>Vendas</p>
                    <p className="text-lg font-bold" style={{ color: info.color, fontFamily: "'Playfair Display', serif" }}>
                      {isLoading ? <SkeletonPulse width="3em" height="1.4em" /> : (
                        <AnimatedNumber value={Number(data?.totalSales ?? 0)} duration={0.8} />
                      )}
                    </p>
                  </div>
                </div>
              </AnimatedCard>
            </FadeIn>
          ))}
        </div>

        {/* Gráfico + Ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <FadeIn delay={0.2} className="xl:col-span-2">
            <AnimatedCard className="rounded-2xl p-4 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <TrendingUp className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  Últimos 7 Dias
                </h2>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Faturamento</p>
                    <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                      <AnimatedNumber value={weekTotal} prefix="R$ " duration={1} />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Vendas</p>
                    <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                      <AnimatedNumber value={weekSales} duration={0.8} />
                    </p>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                    labelFormatter={(label: string, payload: any[]) => {
                      const item = payload?.[0]?.payload;
                      return item?.fullDate ? `${label} (${item.fullDate})` : label;
                    }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      background: "var(--card)",
                      color: "var(--foreground)",
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} fill="url(#colorTotal)" dot={{ r: 4, fill: "var(--primary)", strokeWidth: 2, stroke: "var(--card)" }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </AnimatedCard>
          </FadeIn>

          {/* Top Vendedores */}
          <FadeIn delay={0.3}>
            <AnimatedCard className="rounded-2xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Crown className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Top Vendedores
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]" />
                  ))}
                </div>
              ) : topSellers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">Nenhum vendedor encontrado.</p>
              ) : (
                <ul className="space-y-3">
                  {topSellers.map((seller: any, index: number) => (
                    <li key={seller.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--secondary)] text-[var(--primary)]">{index + 1}</span>
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{seller.sellerDisplayName || seller.sellerName || seller.name}</p>
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)]">{formatCurrency(seller.totalAmount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </FadeIn>
        </div>

        {/* Alertas de Trabalhos */}
        <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StaggerItem>
            <AnimatedCard className="rounded-2xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Trabalhos Para Escrever
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]" />
                  ))}
                </div>
              ) : toWriteWorks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">Nenhum trabalho para escrever.</p>
              ) : (
                <ul className="space-y-3">
                  {toWriteWorks.map(work => (
                    <li key={work.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{work.clientName} - {work.productName}</p>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">Prazo: {formatDeadline(work.deadline)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </StaggerItem>

          <StaggerItem>
            <AnimatedCard className="rounded-2xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Clock className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Trabalhos Pendentes
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]" />
                  ))}
                </div>
              ) : pendingWorks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">Nenhum trabalho pendente.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingWorks.map(work => (
                    <li key={work.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {work.isOverdue ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : work.isUrgent ? (
                          <Clock className="w-4 h-4 text-orange-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{work.clientName} - {work.productName}</p>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">Prazo: {formatDeadline(work.deadline)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </StaggerItem>
        </StaggerList>

        {/* Top Clientes + Vendas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Clientes */}
          <FadeIn delay={0.4}>
            <AnimatedCard className="rounded-2xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Star className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Melhores Clientes
              </h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--secondary)]" />)}
                </div>
              ) : topClients.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>Nenhum dado ainda</p>
              ) : (
                <div className="space-y-2">
                  {topClients.slice(0, 6).map((client: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "var(--secondary)" }}>
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
                  ))}
                </div>
              )}
            </AnimatedCard>
          </FadeIn>

          {/* Vendas Recentes */}
          <FadeIn delay={0.5}>
            <AnimatedCard className="rounded-2xl p-6 shadow-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-bold mb-4" style={{ color: "var(--foreground)" }}>Vendas Recentes</h2>
              {recentSales.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>Nenhuma venda ainda</p>
              ) : (
                <div className="space-y-2">
                  {recentSales.slice(0, 6).map((item: any) => {
                    const sale = item.sale ?? item;
                    const seller = item.seller;
                    return (
                      <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: "var(--secondary)" }}>
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
                    );
                  })}
                </div>
              )}
            </AnimatedCard>
          </FadeIn>
        </div>
      </div>
    </DashboardLayout>
  );
}
