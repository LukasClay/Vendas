import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { FileText, ExternalLink, Filter, X } from "lucide-react";

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function AdminVendas() {
  const { data: sellers = [] } = trpc.users.listAll.useQuery();
  const { data: products = [] } = trpc.products.listAll.useQuery();

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    sellerId: "",
    productName: "",
  });

  const queryFilters = useMemo(() => ({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sellerId: filters.sellerId ? Number(filters.sellerId) : undefined,
    productName: filters.productName || undefined,
    limit: 200,
  }), [filters]);

  const { data: salesData = [], isLoading } = trpc.sales.list.useQuery(queryFilters);

  const totalAmount = salesData.reduce((acc: number, item: any) => {
    const sale = item.sale ?? item;
    return acc + Number(sale.amount);
  }, 0);

  const hasFilters = filters.startDate || filters.endDate || filters.sellerId || filters.productName;

  const clearFilters = () => setFilters({ startDate: "", endDate: "", sellerId: "", productName: "" });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              Todas as Vendas
            </h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.52 0.015 260)" }}>
              {salesData.length} venda{salesData.length !== 1 ? "s" : ""} encontrada{salesData.length !== 1 ? "s" : ""}
              {totalAmount > 0 && ` · Total: ${formatCurrency(totalAmount)}`}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl p-5 mb-6 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4" style={{ color: "oklch(0.60 0.13 65)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>Filtros</h2>
            {hasFilters && (
              <button onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Data início</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Data fim</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Vendedor</label>
              <select
                value={filters.sellerId}
                onChange={e => setFilters(f => ({ ...f, sellerId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer"
                style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}>
                <option value="">Todos</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.displayName || s.name || s.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.40 0.02 260)" }}>Trabalho</label>
              <select
                value={filters.productName}
                onChange={e => setFilters(f => ({ ...f, productName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer"
                style={{ border: "1.5px solid oklch(0.88 0.012 65)", background: "oklch(0.98 0.006 65)", color: "oklch(0.15 0.02 260)" }}>
                <option value="">Todos</option>
                {products.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "oklch(0.60 0.13 65)", borderTopColor: "transparent" }} />
            </div>
          ) : salesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FileText className="w-10 h-10 mb-3" style={{ color: "oklch(0.75 0.06 65)" }} />
              <p className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 260)" }}>Nenhuma venda encontrada</p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs mt-2 underline" style={{ color: "oklch(0.60 0.13 65)" }}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(0.88 0.012 65)" }}>
                      {["Data", "Cliente", "Trabalho", "Vendedor", "Valor", "Comprovante"].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.52 0.015 260)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((item: any) => {
                      const sale = item.sale ?? item;
                      const seller = item.seller;
                      return (
                        <tr key={sale.id} className="transition-colors"
                          style={{ borderBottom: "1px solid oklch(0.94 0.006 65)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td className="px-5 py-3.5 text-sm whitespace-nowrap" style={{ color: "oklch(0.52 0.015 260)" }}>
                            {formatDate(sale.saleDate)}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium" style={{ color: "oklch(0.15 0.02 260)" }}>{sale.clientName}</p>
                            {sale.clientPhone && (
                              <p className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>{sale.clientPhone}</p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm" style={{ color: "oklch(0.30 0.02 260)" }}>
                            {sale.productName}
                          </td>
                          <td className="px-5 py-3.5 text-sm" style={{ color: "oklch(0.30 0.02 260)" }}>
                            {seller?.displayName || seller?.name || "-"}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: "oklch(0.45 0.12 65)" }}>
                            {formatCurrency(sale.amount)}
                          </td>
                          <td className="px-5 py-3.5">
                            {sale.attachmentUrl ? (
                              <a href={sale.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg w-fit transition-colors"
                                style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                                <ExternalLink className="w-3 h-3" />
                                Ver
                              </a>
                            ) : (
                              <span className="text-xs" style={{ color: "oklch(0.70 0.01 260)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
                {salesData.map((item: any) => {
                  const sale = item.sale ?? item;
                  const seller = item.seller;
                  return (
                    <div key={sale.id} className="px-4 py-4">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-sm" style={{ color: "oklch(0.15 0.02 260)" }}>{sale.clientName}</p>
                        <p className="font-semibold text-sm" style={{ color: "oklch(0.45 0.12 65)" }}>{formatCurrency(sale.amount)}</p>
                      </div>
                      <p className="text-xs" style={{ color: "oklch(0.52 0.015 260)" }}>
                        {sale.productName} · {seller?.displayName || seller?.name || ""} · {formatDate(sale.saleDate)}
                      </p>
                      {sale.attachmentUrl && (
                        <a href={sale.attachmentUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-lg"
                          style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.45 0.10 65)" }}>
                          <ExternalLink className="w-3 h-3" />
                          Comprovante
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
