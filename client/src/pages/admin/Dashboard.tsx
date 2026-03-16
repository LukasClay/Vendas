import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingBag, Users, TrendingUp, Crown, Star } from "lucide-react";

function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
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

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Dashboard
            </h1>
            <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>
              Visão geral das vendas e performance
            </p>
          </div>
          {/* Filtro de datas */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={e => setDateFilter(f => ({ ...f, startDate: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "white", color: "oklch(0.15 0.02 260)" }}
            />
            <span className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>até</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "white", color: "oklch(0.15 0.02 260)" }}
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button
                onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                className="px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div key={i} className="rounded-2xl p-5 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>{card.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Gráfico + Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gráfico mensal */}
          <div className="lg:col-span-2 rounded-2xl p-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold mb-5 flex items-center gap-2" style={{ color: "oklch(0.15 0.02 260)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
              Vendas por Mês — {currentYear}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
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

        {/* Top Clientes + Vendas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
