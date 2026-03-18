import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingBag, Users, TrendingUp, Crown, Star, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

// Formata a data limite recebida do backend
function formatDeadline(deadline: string | Date | undefined): string {
  if (!deadline) return "—";
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  return d.toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function AdminDashboard() {
  const currentYear = new Date().getFullYear();
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });

  const { data: reportData, isLoading } = trpc.reports.summary.useQuery(
    dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined
  );
  const { data: monthlyData = [] } = trpc.reports.salesByMonth.useQuery({ year: currentYear });
  const { data: recentSales = [] } = trpc.sales.list.useQuery({ limit: 8 });

  const chartData = MONTHS.map((name, i) => {
    const found = monthlyData.find((m: any) => Number(m.month) === i + 1);
    return { name, total: found ? Number(found.totalAmount) : 0, vendas: found ? Number(found.totalSales) : 0 };
  });

  const summary = reportData?.summary;
  const topSellers = reportData?.topSellers ?? [];
  const topClients = reportData?.topClients ?? [];

  // Trabalhos pendentes para o painel de urgência (1 query em vez de 2)
  const { data: worksSummary } = trpc.consultora.worksSummary.useQuery(undefined, { refetchInterval: 60000 });
  const pendingWorks: any[] = worksSummary?.pending ?? [];
  const toWriteWorks: any[] = worksSummary?.toWrite ?? [];

  const overdueWorks = pendingWorks.filter(w => w.isOverdue);
  const urgentWorks = pendingWorks.filter(w => w.isUrgent);
  const onTrackWorks = pendingWorks.filter(w => !w.isOverdue && !w.isUrgent);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Dashboard
            </h1>
            <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>
              Visão geral das vendas e performance
            </p>
          </div>
          {/* Filtro de datas */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={e => setDateFilter(f => ({ ...f, startDate: e.target.value }))}
              className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "white", color: "oklch(0.15 0.02 260)" }}
            />
            <span className="text-sm shrink-0" style={{ color: "oklch(0.52 0.015 260)" }}>até</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
              className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "white", color: "oklch(0.15 0.02 260)" }}
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button
                onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                className="px-3 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: DollarSign,
              label: "Total Vendido",
              value: isLoading ? "..." : formatCurrency(summary?.totalAmount ?? 0),
              color: "oklch(0.60 0.13 65)",
              bg: "oklch(0.94 0.02 65)",
            },
            {
              icon: ShoppingBag,
              label: "Nº de Vendas",
              value: isLoading ? "..." : String(summary?.totalSales ?? 0),
              color: "oklch(0.55 0.15 160)",
              bg: "oklch(0.92 0.04 160)",
            },
            {
              icon: Users,
              label: "Melhores Clientes",
              value: isLoading ? "..." : String(topClients.length),
              color: "oklch(0.50 0.18 250)",
              bg: "oklch(0.92 0.04 250)",
            },
            {
              icon: TrendingUp,
              label: "Melhores Vendedores",
              value: isLoading ? "..." : String(topSellers.length),
              color: "oklch(0.55 0.20 30)",
              bg: "oklch(0.93 0.04 30)",
            },
          ].map((card, i) => (
            <div key={i} className="rounded-2xl p-4 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: card.bg }}>
                  <card.icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
                <span className="text-xs font-medium leading-tight" style={{ color: "oklch(0.52 0.015 260)" }}>{card.label}</span>
              </div>
              <p className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Gráfico + Ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Gráfico mensal */}
          <div className="xl:col-span-2 rounded-2xl p-4 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-5 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
              Vendas por Mês — {currentYear}
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.008 65)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.52 0.015 260)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.015 260)" }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Total"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid oklch(0.88 0.012 65)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                />
                <Bar dataKey="total" fill="oklch(0.60 0.13 65)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Vendedores */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <Crown className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
              Top Vendedores
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "oklch(0.95 0.008 65)" }} />
                ))}
              </div>
            ) : topSellers.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhum dado ainda</p>
            ) : (
              <div className="space-y-3">
                {topSellers.slice(0, 5).map((seller: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: i === 0 ? "oklch(0.96 0.02 65)" : "oklch(0.98 0.006 65)" }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: i === 0 ? "oklch(0.60 0.13 65)" : "oklch(0.88 0.012 65)",
                        color: i === 0 ? "white" : "oklch(0.45 0.02 260)",
                      }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "oklch(0.15 0.02 260)" }}>
                        {seller.sellerDisplayName || seller.sellerName || "Vendedor"}
                      </p>
                      <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>
                        {seller.totalSales} venda{Number(seller.totalSales) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 65)" }}>
                      {formatCurrency(seller.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Painel de Urgência dos Trabalhos */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
            <div className="flex items-center justify-between mb-2 sm:mb-0">
              <h2 className="font-semibold flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
                <Clock className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
                Status dos Trabalhos
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
              {toWriteWorks.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "oklch(0.92 0.04 250)", color: "oklch(0.35 0.15 250)" }}>
                  <Clock className="w-3 h-3" /> {toWriteWorks.length} para escrever
                </span>
              )}
              {overdueWorks.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "oklch(0.93 0.06 25)", color: "oklch(0.40 0.18 25)" }}>
                  <AlertTriangle className="w-3 h-3" /> {overdueWorks.length} atrasado{overdueWorks.length !== 1 ? "s" : ""}
                </span>
              )}
              {urgentWorks.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "oklch(0.94 0.06 55)", color: "oklch(0.45 0.14 55)" }}>
                  <AlertTriangle className="w-3 h-3" /> {urgentWorks.length} urgente{urgentWorks.length !== 1 ? "s" : ""}
                </span>
              )}
              {onTrackWorks.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "oklch(0.92 0.04 160)", color: "oklch(0.35 0.15 160)" }}>
                  <CheckCircle2 className="w-3 h-3" /> {onTrackWorks.length} no prazo
                </span>
              )}
            </div>
          </div>
          {pendingWorks.length === 0 && toWriteWorks.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhum trabalho pendente no momento</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "oklch(0.97 0.006 65)" }}>
                      {["Status", "Cliente", "Trabalho", "Data da Venda", "Prazo", "Dias Restantes"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "oklch(0.45 0.02 260)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...(toWriteWorks as any[]).slice(0, 3), ...[...overdueWorks, ...urgentWorks, ...onTrackWorks].slice(0, 10)].map((w: any) => {
                      const isWrite = w.urgencyScore === undefined && !w.isOverdue && !w.isUrgent && w.daysRemaining !== undefined
                        ? false : (w.writtenAt === undefined && w.createdAt !== undefined);
                      // Usar dados do backend diretamente
                      const daysRemaining: number = w.daysRemaining ?? 7;
                      const isOverdue: boolean = w.isOverdue ?? false;
                      const isUrgent: boolean = w.isUrgent ?? false;
                      const deadlineDate = formatDeadline(w.deadline);
                      const isParaEscrever = w.writtenAt === undefined && w.createdAt !== undefined;
                      return (
                        <tr key={`${isParaEscrever ? 'write' : 'pend'}-${w.id}`} className="border-t" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={isParaEscrever
                                ? { background: "oklch(0.92 0.04 250)", color: "oklch(0.35 0.15 250)" }
                                : isOverdue
                                ? { background: "oklch(0.93 0.06 25)", color: "oklch(0.40 0.18 25)" }
                                : isUrgent
                                ? { background: "oklch(0.94 0.06 55)", color: "oklch(0.45 0.14 55)" }
                                : { background: "oklch(0.92 0.04 160)", color: "oklch(0.35 0.15 160)" }}>
                              {isParaEscrever ? "Para Escrever" : isOverdue ? "Atrasado" : isUrgent ? "Urgente" : "No Prazo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{w.clientName}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(0.40 0.02 260)" }}>{w.productName}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(0.52 0.015 260)" }}>{formatDate(w.saleDate)}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(0.52 0.015 260)" }}>{deadlineDate}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold" style={{ color: isParaEscrever ? "oklch(0.35 0.15 250)" : isOverdue ? "oklch(0.45 0.18 25)" : isUrgent ? "oklch(0.50 0.14 55)" : "oklch(0.40 0.15 160)" }}>
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
              <div className="md:hidden divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
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
                            ? { background: "oklch(0.92 0.04 250)", color: "oklch(0.35 0.15 250)" }
                            : isOverdue
                            ? { background: "oklch(0.93 0.06 25)", color: "oklch(0.40 0.18 25)" }
                            : isUrgent
                            ? { background: "oklch(0.94 0.06 55)", color: "oklch(0.45 0.14 55)" }
                            : { background: "oklch(0.92 0.04 160)", color: "oklch(0.35 0.15 160)" }}>
                          {isParaEscrever ? "Para Escrever" : isOverdue ? "Atrasado" : isUrgent ? "Urgente" : "No Prazo"}
                        </span>
                        <span className="font-semibold text-xs" style={{ color: isParaEscrever ? "oklch(0.35 0.15 250)" : isOverdue ? "oklch(0.45 0.18 25)" : isUrgent ? "oklch(0.50 0.14 55)" : "oklch(0.40 0.15 160)" }}>
                          {isOverdue ? `${Math.abs(daysRemaining)}d atrasado` : `${daysRemaining}d restante${daysRemaining !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{w.clientName}</p>
                      <p className="text-xs" style={{ color: "oklch(0.40 0.02 260)" }}>
                        {w.productName} · Prazo: {deadlineDate}
                      </p>
                    </div>
                  );
                })}
              </div>

              {(pendingWorks as any[]).length > 10 && (
                <div className="px-4 sm:px-6 py-3 text-center border-t" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                  <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>
                    Mostrando 10 de {(pendingWorks as any[]).length} trabalhos pendentes. Veja todos em <a href="/admin/vendas" className="underline" style={{ color: "oklch(0.50 0.13 65)" }}>Todas as Vendas</a>.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Top Clientes + Vendas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Clientes */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <Star className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
              Melhores Clientes
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "oklch(0.95 0.008 65)" }} />)}
              </div>
            ) : topClients.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhum dado ainda</p>
            ) : (
              <div className="space-y-2">
                {topClients.slice(0, 6).map((client: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: "oklch(0.98 0.006 65)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold w-5 text-center" style={{ color: "oklch(0.60 0.13 65)" }}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{client.clientName}</p>
                        {client.clientPhone && (
                          <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{client.clientPhone}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 65)" }}>
                        {formatCurrency(client.totalAmount)}
                      </p>
                      <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>
                        {client.totalSales} venda{Number(client.totalSales) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vendas Recentes */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-4" style={{ color: "oklch(0.15 0.02 260)" }}>Vendas Recentes</h2>
            {recentSales.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "oklch(0.60 0.01 260)" }}>Nenhuma venda ainda</p>
            ) : (
              <div className="space-y-2">
                {recentSales.slice(0, 6).map((item: any) => {
                  const sale = item.sale ?? item;
                  const seller = item.seller;
                  return (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "oklch(0.98 0.006 65)" }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "oklch(0.15 0.02 260)" }}>{sale.clientName}</p>
                        <p className="text-xs truncate" style={{ color: "oklch(0.52 0.015 260)" }}>
                          {sale.productName} · {seller?.displayName || seller?.name || ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 65)" }}>
                          {formatCurrency(sale.amount)}
                        </p>
                        <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>
                          {formatDate(sale.saleDate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
