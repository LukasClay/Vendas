import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText, TrendingUp, DollarSign, ShoppingBag, ExternalLink } from "lucide-react";

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR");
}

export default function MinhasVendas() {
  const { data: sales = [], isLoading } = trpc.sales.myHistory.useQuery();

  const totalAmount = sales.reduce((acc, s) => acc + Number(s.amount), 0);
  const totalSales = sales.length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
            Minhas Vendas
          </h1>
          <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>
            Histórico completo das suas vendas registradas
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl p-5 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.94 0.02 65)" }}>
                <DollarSign className="w-5 h-5" style={{ color: "oklch(0.60 0.13 65)" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>Total Vendido</span>
            </div>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="rounded-2xl p-5 shadow-sm" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.94 0.02 65)" }}>
                <ShoppingBag className="w-5 h-5" style={{ color: "oklch(0.60 0.13 65)" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "oklch(0.52 0.015 260)" }}>Vendas Realizadas</span>
            </div>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "oklch(0.15 0.02 260)" }}>
              {totalSales}
            </p>
          </div>
        </div>

        {/* Sales list */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.88 0.012 65)" }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: "oklch(0.88 0.012 65)" }}>
            <h2 className="font-semibold" style={{ color: "oklch(0.15 0.02 260)" }}>Histórico</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "oklch(0.60 0.13 65)", borderTopColor: "transparent" }} />
                <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>Carregando...</p>
              </div>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "oklch(0.95 0.008 65)" }}>
                <FileText className="w-8 h-8" style={{ color: "oklch(0.75 0.06 65)" }} />
              </div>
              <p className="text-base font-medium mb-1" style={{ color: "oklch(0.30 0.02 260)" }}>
                Nenhuma venda registrada
              </p>
              <p className="text-sm text-center" style={{ color: "oklch(0.60 0.01 260)" }}>
                Suas vendas aparecerão aqui após serem registradas.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "oklch(0.92 0.008 65)" }}>
              {sales.map(sale => (
                <div key={sale.id} className="px-6 py-4 hover:bg-opacity-50 transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.98 0.006 65)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm truncate" style={{ color: "oklch(0.15 0.02 260)" }}>
                          {sale.clientName}
                        </p>
                        {sale.attachmentUrl && (
                          <a href={sale.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors"
                            style={{ background: "oklch(0.94 0.02 65)", color: "oklch(0.50 0.10 65)" }}>
                            <ExternalLink className="w-3 h-3" />
                            Comprovante
                          </a>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: "oklch(0.52 0.015 260)" }}>{sale.productName}</p>
                      {sale.clientPhone && (
                        <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.01 260)" }}>
                          Tel: {sale.clientPhone}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-base" style={{ color: "oklch(0.45 0.12 65)" }}>
                        {formatCurrency(sale.amount)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.01 260)" }}>
                        {formatDate(sale.saleDate)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
