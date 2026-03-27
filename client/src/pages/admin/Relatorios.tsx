import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Download, Mail, Plus, Trash2, BarChart3, Loader2, Check, X, ToggleLeft, ToggleRight, Building2, CalendarDays, TrendingUp, Users, Package, AlertTriangle, Send, ChevronLeft, ChevronRight, DollarSign, Hash } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { getCompanyInfo } from "@/components/CompanySwitch";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export default function AdminRelatorios() {
  const utils = trpc.useUtils();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });
  const [exportLoading, setExportLoading] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ frequency: "daily" as "daily" | "weekly" | "monthly", recipientEmail: "" });
  const [confirmDeleteScheduleId, setConfirmDeleteScheduleId] = useState<number | null>(null);
  const [confirmToggleScheduleId, setConfirmToggleScheduleId] = useState<number | null>(null);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMode, setChartMode] = useState<"value" | "count">("value");

  const summaryInput = useMemo(
    () => (dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined),
    [dateFilter.startDate, dateFilter.endDate]
  );

  const { data: reportData, isLoading } = trpc.reports.summary.useQuery(summaryInput);
  const { data: exportData = [] } = trpc.reports.exportData.useQuery(dateFilter);
  const { data: schedules = [], isLoading: loadingSchedules } = trpc.reports.schedules.useQuery();
  const { data: monthlyTotal = [] } = trpc.reports.salesByMonth.useQuery({ year: chartYear });
  const { data: monthlyByCompany = [] } = trpc.reports.salesByMonthByCompany.useQuery({ year: chartYear });

  const createSchedule = trpc.reports.createSchedule.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      utils.reports.schedules.invalidate();
      setShowScheduleForm(false);
      setScheduleForm({ frequency: "daily", recipientEmail: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSchedule = trpc.reports.deleteSchedule.useMutation({
    onSuccess: () => {
      toast.success("Agendamento removido.");
      utils.reports.schedules.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendTestEmail = trpc.reports.sendTestEmail.useMutation({
    onSuccess: () => toast.success("Email de teste enviado! Verifique sua caixa de entrada."),
    onError: (err) => toast.error(err.message),
  });

  const toggleSchedule = trpc.reports.updateSchedule.useMutation({
    onSuccess: () => utils.reports.schedules.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const handleExportExcel = async () => {
    if (exportData.length === 0) { toast.error("Nenhuma venda para exportar."); return; }
    setExportLoading(true);
    try {
      const XLSX = await import("xlsx");
      const rows = exportData.map((item: any) => {
        const sale = item.sale ?? item;
        const seller = item.seller;
        return {
          "Data da Venda": formatDate(sale.saleDate),
          "Cliente": sale.clientName,
          "Telefone": sale.clientPhone ?? "",
          "Data Nascimento": sale.clientBirthDate ? formatDate(sale.clientBirthDate) : "",
          "Trabalho": sale.productName,
          "Vendedor": seller?.displayName || seller?.name || "",
          "Valor (R$)": Number(sale.amount),
          "Observações": sale.notes ?? "",
          "Comprovante": sale.attachmentUrl ?? "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendas");
      const colWidths = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length, 15) }));
      ws["!cols"] = colWidths;
      const filename = `vendas_${dateFilter.startDate || "all"}_${dateFilter.endDate || "all"}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success("Excel exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar Excel.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (exportData.length === 0) { toast.error("Nenhuma venda para exportar."); return; }
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text("Relatório de Vendas", 14, 15);
      if (dateFilter.startDate || dateFilter.endDate) {
        doc.setFontSize(10);
        doc.text(`Período: ${dateFilter.startDate || "início"} até ${dateFilter.endDate || "hoje"}`, 14, 23);
      }

      const summary = reportData?.summary;
      if (summary) {
        doc.setFontSize(11);
        doc.text(`Total vendido: ${formatCurrency(summary.totalAmount ?? 0)}   |   Nº de vendas: ${summary.totalSales ?? 0}`, 14, 30);
      }

      const rows = exportData.map((item: any) => {
        const sale = item.sale ?? item;
        const seller = item.seller;
        return [
          formatDate(sale.saleDate),
          sale.clientName,
          sale.clientPhone ?? "",
          sale.productName,
          seller?.displayName || seller?.name || "",
          formatCurrency(sale.amount),
        ];
      });

      autoTable(doc, {
        startY: 36,
        head: [["Data", "Cliente", "Telefone", "Trabalho", "Vendedor", "Valor"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: isDark ? [50, 50, 50] : [153, 102, 51], textColor: 255 },
        alternateRowStyles: { fillColor: isDark ? [30, 30, 30] : [252, 249, 245] },
      });

      const filename = `relatorio_vendas_${dateFilter.startDate || "all"}_${dateFilter.endDate || "all"}.pdf`;
      doc.save(filename);
      toast.success("PDF exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExportLoading(false);
    }
  };

  const summary = reportData?.summary;
  const topSellers = reportData?.topSellers ?? [];
  const topClients = reportData?.topClients ?? [];
  const topProducts = reportData?.topProducts ?? [];
  const summaryByCompany: any[] = reportData?.summaryByCompany ?? [];
  const magiaData = summaryByCompany.find((c: any) => c.company === "mundo_da_magia");
  const ciganoData = summaryByCompany.find((c: any) => c.company === "mundo_cigano");

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                Relatórios
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                Análise detalhada de performance e exportação de dados
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleExportExcel}
                disabled={exportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-60 active:scale-95 shadow-lg shadow-green-500/10"
                style={{ background: "#10b981", color: "white" }}>
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-60 active:scale-95 shadow-lg shadow-red-500/10"
                style={{ background: "#ef4444", color: "white" }}>
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Filtro de período */}
        <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Período de Análise</h2>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={e => setDateFilter(f => ({ ...f, startDate: e.target.value }))}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                style={{ border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
              />
              <span className="text-xs font-bold uppercase text-[var(--muted-foreground)]">até</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                style={{ border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(dateFilter.startDate || dateFilter.endDate) && (
                <button onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                  Limpar Filtros
                </button>
              )}
              {[
                { label: "Hoje", fn: () => { const d = new Date().toISOString().split("T")[0]; setDateFilter({ startDate: d, endDate: d }); } },
                { label: "Esta semana", fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); setDateFilter({ startDate: mon.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] }); } },
                { label: "Este mês", fn: () => { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); setDateFilter({ startDate: first.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] }); } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.fn}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--border)] active:scale-95">
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resumo Geral */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
            <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">Processando dados...</p>
          </div>
        ) : (
          <StaggerList className="space-y-10">
            <StaggerItem>
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Visão Geral</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <p className="text-xs font-bold uppercase mb-2 text-[var(--muted-foreground)] tracking-wider">Total Vendido</p>
                    <p className="text-4xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--primary)" }}>
                      {formatCurrency(summary?.totalAmount ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <p className="text-xs font-bold uppercase mb-2 text-[var(--muted-foreground)] tracking-wider">Total de Vendas</p>
                    <p className="text-4xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                      {summary?.totalSales ?? 0}
                    </p>
                  </div>
                  <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <p className="text-xs font-bold uppercase mb-2 text-[var(--muted-foreground)] tracking-wider">Média por Venda</p>
                    <p className="text-4xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                      {formatCurrency(summary?.averageSale ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Resumo por Empresa */}
            <StaggerItem>
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <Building2 className="w-4 h-4 text-[var(--primary)]" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Performance por Empresa</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { info: getCompanyInfo("mundo_da_magia"), data: magiaData },
                    { info: getCompanyInfo("mundo_cigano"), data: ciganoData },
                  ].map(({ info, data }) => (
                    <div key={info.short} className="rounded-3xl p-6 shadow-xl border-2 transition-all hover:shadow-2xl" style={{ background: "var(--card)", borderColor: info.border }}>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: info.bg }}>
                          <Building2 className="w-6 h-6" style={{ color: info.color }} />
                        </div>
                        <div>
                          <p className="text-lg font-bold" style={{ color: info.color }}>{info.short}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Indicadores de Performance</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl shadow-inner" style={{ background: info.bg }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60">Vendido</p>
                          <p className="text-2xl font-bold" style={{ color: info.color, fontFamily: "'Playfair Display', serif" }}>
                            {formatCurrency(data?.totalAmount ?? 0)}
                          </p>
                        </div>
                        <div className="p-5 rounded-2xl shadow-inner" style={{ background: info.bg }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60">Vendas</p>
                          <p className="text-2xl font-bold" style={{ color: info.color, fontFamily: "'Playfair Display', serif" }}>
                            {String(data?.totalSales ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>

            {/* Rankings */}
            <StaggerItem>
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Rankings de Performance</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Top Vendedores */}
                  <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center gap-2 mb-6">
                      <Users className="w-4 h-4 text-blue-500" />
                      <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Top Vendedores</h2>
                    </div>
                    <ul className="space-y-4">
                      {topSellers.length === 0 ? (
                        <li className="text-sm text-[var(--muted-foreground)] italic py-4 text-center">Nenhum dado disponível.</li>
                      ) : (
                        topSellers.map((seller: any, index: number) => (
                          <li key={seller.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">{index + 1}</span>
                              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{seller.sellerDisplayName || seller.sellerName || seller.name}</p>
                            </div>
                            <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>{formatCurrency(seller.totalAmount)}</p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Top Clientes */}
                  <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center gap-2 mb-6">
                      <Users className="w-4 h-4 text-purple-500" />
                      <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Top Clientes</h2>
                    </div>
                    <ul className="space-y-4">
                      {topClients.length === 0 ? (
                        <li className="text-sm text-[var(--muted-foreground)] italic py-4 text-center">Nenhum dado disponível.</li>
                      ) : (
                        topClients.map((client: any, index: number) => (
                          <li key={client.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">{index + 1}</span>
                              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{client.clientName || client.name}</p>
                            </div>
                            <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>{formatCurrency(client.totalAmount)}</p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Top Trabalhos */}
                  <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center gap-2 mb-6">
                      <Package className="w-4 h-4 text-orange-500" />
                      <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Top Trabalhos</h2>
                    </div>
                    <ul className="space-y-4">
                      {topProducts.length === 0 ? (
                        <li className="text-sm text-[var(--muted-foreground)] italic py-4 text-center">Nenhum dado disponível.</li>
                      ) : (
                        topProducts.map((product: any, index: number) => (
                          <li key={product.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">{index + 1}</span>
                              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{product.productName || product.name}</p>
                            </div>
                            <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>{formatCurrency(product.totalAmount)}</p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerList>
        )}

        {/* Gráficos de Vendas */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Gráficos de Vendas</h2>
          </div>

          {/* Filtros do gráfico */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Seletor de ano */}
            <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 shadow-sm">
              <button onClick={() => setChartYear(y => y - 1)}
                className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors active:scale-90">
                <ChevronLeft className="w-4 h-4" style={{ color: "var(--foreground)" }} />
              </button>
              <span className="px-3 text-sm font-bold" style={{ color: "var(--foreground)", fontFamily: "'Playfair Display', serif" }}>{chartYear}</span>
              <button onClick={() => setChartYear(y => y + 1)}
                disabled={chartYear >= new Date().getFullYear()}
                className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors active:scale-90 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" style={{ color: "var(--foreground)" }} />
              </button>
            </div>

            {/* Toggle valor/quantidade */}
            <div className="flex items-center bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 shadow-sm">
              <button onClick={() => setChartMode("value")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  chartMode === "value" ? "bg-[var(--primary)] text-white shadow-md" : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}>
                <DollarSign className="w-3.5 h-3.5" /> Valor (R$)
              </button>
              <button onClick={() => setChartMode("count")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  chartMode === "count" ? "bg-[var(--primary)] text-white shadow-md" : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}>
                <Hash className="w-3.5 h-3.5" /> Quantidade
              </button>
            </div>
          </div>

          {/* Gráfico Total */}
          {(() => {
            const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const totalChartData = MONTHS.map((name, i) => {
              const found = (monthlyTotal as any[]).find((m: any) => Number(m.month) === i + 1);
              return { name, value: found ? Number(chartMode === "value" ? found.totalAmount : found.totalSales) : 0 };
            });

            const magiaInfo = getCompanyInfo("mundo_da_magia");
            const ciganoInfo = getCompanyInfo("mundo_cigano");

            const magiaChartData = MONTHS.map((name, i) => {
              const found = (monthlyByCompany as any[]).find((m: any) => Number(m.month) === i + 1 && m.company === "mundo_da_magia");
              return { name, value: found ? Number(chartMode === "value" ? found.totalAmount : found.totalSales) : 0 };
            });

            const ciganoChartData = MONTHS.map((name, i) => {
              const found = (monthlyByCompany as any[]).find((m: any) => Number(m.month) === i + 1 && m.company === "mundo_cigano");
              return { name, value: found ? Number(chartMode === "value" ? found.totalAmount : found.totalSales) : 0 };
            });

            const formatValue = (v: number) => chartMode === "value" ? formatCurrency(v) : String(v);
            const formatTick = (v: number) => chartMode === "value" ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)) : String(v);

            const chartTooltipStyle = {
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              background: "var(--card)",
              color: "var(--foreground)",
              fontSize: "12px",
              fontWeight: "bold" as const,
            };

            return (
              <div className="space-y-6">
                {/* Gráfico Total */}
                <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
                      <h3 className="font-bold text-base" style={{ color: "var(--foreground)" }}>
                        {chartMode === "value" ? "Faturamento Total" : "Quantidade de Vendas"} — {chartYear}
                      </h3>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--secondary)] text-[var(--primary)]">
                      {chartMode === "value" ? formatCurrency(totalChartData.reduce((s, d) => s + d.value, 0)) : `${totalChartData.reduce((s, d) => s + d.value, 0)} vendas`}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={totalChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={formatTick} />
                      <Tooltip formatter={(value: number) => [formatValue(value), chartMode === "value" ? "Faturamento" : "Vendas"]} contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#totalGradient)" dot={{ r: 4, fill: "var(--primary)", strokeWidth: 2, stroke: "var(--card)" }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráficos por Empresa */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Mundo Da Magia */}
                  <div className="rounded-3xl p-6 shadow-xl border-2 transition-all hover:shadow-2xl" style={{ background: "var(--card)", borderColor: magiaInfo.border }}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: magiaInfo.bg }}>
                          <Building2 className="w-4 h-4" style={{ color: magiaInfo.color }} />
                        </div>
                        <h3 className="font-bold text-sm" style={{ color: magiaInfo.color }}>{magiaInfo.short}</h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: magiaInfo.bg, color: magiaInfo.color }}>
                        {chartMode === "value" ? formatCurrency(magiaChartData.reduce((s, d) => s + d.value, 0)) : `${magiaChartData.reduce((s, d) => s + d.value, 0)} vendas`}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={magiaChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={formatTick} />
                        <Tooltip formatter={(value: number) => [formatValue(value), magiaInfo.short]} contentStyle={chartTooltipStyle} />
                        <Bar dataKey="value" fill={magiaInfo.color} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Mundo Cigano */}
                  <div className="rounded-3xl p-6 shadow-xl border-2 transition-all hover:shadow-2xl" style={{ background: "var(--card)", borderColor: ciganoInfo.border }}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ciganoInfo.bg }}>
                          <Building2 className="w-4 h-4" style={{ color: ciganoInfo.color }} />
                        </div>
                        <h3 className="font-bold text-sm" style={{ color: ciganoInfo.color }}>{ciganoInfo.short}</h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: ciganoInfo.bg, color: ciganoInfo.color }}>
                        {chartMode === "value" ? formatCurrency(ciganoChartData.reduce((s, d) => s + d.value, 0)) : `${ciganoChartData.reduce((s, d) => s + d.value, 0)} vendas`}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={ciganoChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={formatTick} />
                        <Tooltip formatter={(value: number) => [formatValue(value), ciganoInfo.short]} contentStyle={chartTooltipStyle} />
                        <Bar dataKey="value" fill={ciganoInfo.color} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Agendamentos de Relatórios */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Mail className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Automação de Relatórios</h2>
          </div>
          <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="font-bold text-xl" style={{ color: "var(--foreground)" }}>Agendamentos de Relatórios</h2>
                <p className="text-sm text-[var(--muted-foreground)]">Receba relatórios automáticos diretamente no seu e-mail</p>
              </div>
              <button onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Novo Agendamento
              </button>
            </div>

            <AnimatePresence>
              {showScheduleForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-8">
                  <div className="p-6 rounded-2xl border-2 border-[var(--primary)]/20 bg-[var(--secondary)]/30 space-y-6">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[var(--primary)]" />
                      <h3 className="font-bold text-base" style={{ color: "var(--foreground)" }}>Configurar Novo Agendamento</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Frequência de Envio</label>
                        <select value={scheduleForm.frequency} onChange={e => setScheduleForm(f => ({ ...f, frequency: e.target.value as any }))}
                          className="w-full px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}>
                          <option value="daily">Diário (Todo dia às 07:00)</option>
                          <option value="weekly">Semanal (Toda segunda às 07:00)</option>
                          <option value="monthly">Mensal (Todo dia 1º às 07:00)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Email do Destinatário</label>
                        <input type="email" value={scheduleForm.recipientEmail} onChange={e => setScheduleForm(f => ({ ...f, recipientEmail: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }} placeholder="exemplo@email.com" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={() => setShowScheduleForm(false)}
                        className="px-6 py-3 rounded-xl text-sm font-bold bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors">
                        Cancelar
                      </button>
                      <button onClick={() => createSchedule.mutate(scheduleForm)} disabled={createSchedule.isPending || !scheduleForm.recipientEmail}
                        className="px-8 py-3 rounded-xl text-sm font-bold bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
                        {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Confirmar Agendamento
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {loadingSchedules ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Carregando agendamentos...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary)]/10">
                <div className="w-16 h-16 rounded-full bg-[var(--secondary)] flex items-center justify-center">
                  <Mail className="w-8 h-8 text-[var(--muted-foreground)] opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-[var(--foreground)]">Nenhum agendamento ativo</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">Crie um agendamento para receber relatórios automáticos.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--secondary)]/50">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Frequência</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Destinatário</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {schedules.map(schedule => (
                      <tr key={schedule.id} className="hover:bg-[var(--secondary)]/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span className="text-sm font-bold text-[var(--foreground)]">{FREQ_LABELS[schedule.frequency]}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-[var(--muted-foreground)]">{schedule.recipientEmail}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            {confirmToggleScheduleId === schedule.id ? (
                              <div className="flex items-center gap-2 bg-amber-500/10 p-1 rounded-lg border border-amber-500/20">
                                <span className="text-[10px] font-bold text-amber-600 px-1 uppercase">{schedule.active ? "Desativar?" : "Ativar?"}</span>
                                <button onClick={() => { toggleSchedule.mutate({ id: schedule.id, active: !schedule.active }); setConfirmToggleScheduleId(null); }}
                                  className="p-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-90">
                                  <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => setConfirmToggleScheduleId(null)}
                                  className="p-1 rounded-md bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] active:scale-90">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmToggleScheduleId(schedule.id)}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${schedule.active ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                                {schedule.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                {schedule.active ? "Ativo" : "Inativo"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => sendTestEmail.mutate({ id: schedule.id })} disabled={sendTestEmail.isPending}
                              className="p-2 rounded-xl text-blue-500 hover:bg-blue-500/10 transition-all active:scale-90" title="Enviar email de teste">
                              {sendTestEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                            {confirmDeleteScheduleId === schedule.id ? (
                              <div className="flex items-center gap-1 bg-red-500/10 p-1 rounded-lg border border-red-500/20">
                                <button onClick={() => { deleteSchedule.mutate({ id: schedule.id }); setConfirmDeleteScheduleId(null); }}
                                  className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-all active:scale-90">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setConfirmDeleteScheduleId(null)}
                                  className="p-1.5 rounded-md bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] active:scale-90">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteScheduleId(schedule.id)}
                                className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all active:scale-90" title="Excluir agendamento">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
