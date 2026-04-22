import { trpc, type RouterOutputs } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Download,
  Mail,
  Plus,
  Trash2,
  BarChart3,
  Loader2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Building2,
  CalendarDays,
  TrendingUp,
  Users,
  Package,
  AlertTriangle,
  Send,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Hash,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";
import { getCompanyInfo } from "@/components/CompanySwitch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

type ExportRow = RouterOutputs["reports"]["exportData"][number];
type ReportSummary = RouterOutputs["reports"]["summary"];
type SummaryByCompany = ReportSummary["summaryByCompany"][number];
type TopSeller = ReportSummary["topSellers"][number];
type TopClient = ReportSummary["topClients"][number];
type TopProduct = ReportSummary["topProducts"][number];
type MonthlyTotalRow = RouterOutputs["reports"]["salesByMonth"][number];
type MonthlyByCompanyRow =
  RouterOutputs["reports"]["salesByMonthByCompany"][number];

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
  const [scheduleForm, setScheduleForm] = useState({
    frequency: "daily" as "daily" | "weekly" | "monthly",
    recipientEmail: "",
  });
  const [confirmDeleteScheduleId, setConfirmDeleteScheduleId] = useState<
    number | null
  >(null);
  const [confirmToggleScheduleId, setConfirmToggleScheduleId] = useState<
    number | null
  >(null);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMode, setChartMode] = useState<"value" | "count">("value");

  const summaryInput = useMemo(
    () => (dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined),
    [dateFilter.startDate, dateFilter.endDate]
  );

  const { data: reportData, isLoading } =
    trpc.reports.summary.useQuery(summaryInput);
  const { data: exportData = [] } =
    trpc.reports.exportData.useQuery(dateFilter);
  const { data: schedules = [], isLoading: loadingSchedules } =
    trpc.reports.schedules.useQuery();
  const { data: monthlyTotal = [] } = trpc.reports.salesByMonth.useQuery({
    year: chartYear,
  });
  const { data: monthlyByCompany = [] } =
    trpc.reports.salesByMonthByCompany.useQuery({ year: chartYear });

  const createSchedule = trpc.reports.createSchedule.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      utils.reports.schedules.invalidate();
      setShowScheduleForm(false);
      setScheduleForm({ frequency: "daily", recipientEmail: "" });
    },
    onError: err => toast.error(err.message),
  });

  const deleteSchedule = trpc.reports.deleteSchedule.useMutation({
    onSuccess: () => {
      toast.success("Agendamento removido.");
      utils.reports.schedules.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const sendTestEmail = trpc.reports.sendTestEmail.useMutation({
    onSuccess: () =>
      toast.success("Email de teste enviado! Verifique sua caixa de entrada."),
    onError: err => toast.error(err.message),
  });

  const toggleSchedule = trpc.reports.updateSchedule.useMutation({
    onSuccess: () => utils.reports.schedules.invalidate(),
    onError: err => toast.error(err.message),
  });

  const handleExportExcel = async () => {
    if (exportData.length === 0) {
      toast.error("Nenhuma venda para exportar.");
      return;
    }
    setExportLoading(true);
    try {
      const XLSX = await import("xlsx");
      const rows = exportData.map((item: ExportRow) => {
        const sale = item.sale ?? item;
        const seller = item.seller;
        return {
          "Data da Venda": formatDate(sale.saleDate),
          Cliente: sale.clientName,
          Telefone: sale.clientPhone ?? "",
          "Data Nascimento": sale.clientBirthDate
            ? formatDate(sale.clientBirthDate)
            : "",
          Trabalho: sale.productName,
          Vendedor: seller?.displayName || seller?.name || "",
          "Valor (R$)": Number(sale.amount),
          Observações: sale.notes ?? "",
          Comprovante: sale.attachmentUrl ?? "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendas");
      const colWidths = Object.keys(rows[0] ?? {}).map(k => ({
        wch: Math.max(k.length, 15),
      }));
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
    if (exportData.length === 0) {
      toast.error("Nenhuma venda para exportar.");
      return;
    }
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text("Relatório de Vendas", 14, 15);
      if (dateFilter.startDate || dateFilter.endDate) {
        doc.setFontSize(10);
        doc.text(
          `Período: ${dateFilter.startDate || "início"} até ${dateFilter.endDate || "hoje"}`,
          14,
          23
        );
      }

      const summary = reportData?.summary;
      if (summary) {
        doc.setFontSize(11);
        doc.text(
          `Total vendido: ${formatCurrency(summary.totalAmount ?? 0)}   |   Nº de vendas: ${summary.totalSales ?? 0}`,
          14,
          30
        );
      }

      const rows = exportData.map((item: ExportRow) => {
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
        head: [
          ["Data", "Cliente", "Telefone", "Trabalho", "Vendedor", "Valor"],
        ],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: isDark ? [50, 50, 50] : [153, 102, 51],
          textColor: 255,
        },
        alternateRowStyles: {
          fillColor: isDark ? [30, 30, 30] : [252, 249, 245],
        },
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
  const summaryByCompany: SummaryByCompany[] =
    reportData?.summaryByCompany ?? [];
  const magiaData = summaryByCompany.find(c => c.company === "mundo_da_magia");
  const ciganoData = summaryByCompany.find(c => c.company === "mundo_cigano");

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1
                className="text-3xl font-bold"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  color: "var(--foreground)",
                }}
              >
                Relatórios
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Análise detalhada de performance e exportação de dados
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleExportExcel}
                disabled={exportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-60 active:scale-95 shadow-lg shadow-green-500/10"
                style={{ background: "#10b981", color: "white" }}
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-60 active:scale-95 shadow-lg shadow-red-500/10"
                style={{ background: "#ef4444", color: "white" }}
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                PDF
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Filtro de período */}
        <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
            <h2
              className="font-bold text-sm uppercase tracking-wider"
              style={{ color: "var(--foreground)" }}
            >
              Período de Análise
            </h2>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={e =>
                  setDateFilter(f => ({ ...f, startDate: e.target.value }))
                }
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                style={{
                  border: "1.5px solid var(--border)",
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                }}
              />
              <span className="text-xs font-bold uppercase text-[var(--muted-foreground)]">
                até
              </span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={e =>
                  setDateFilter(f => ({ ...f, endDate: e.target.value }))
                }
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                style={{
                  border: "1.5px solid var(--border)",
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(dateFilter.startDate || dateFilter.endDate) && (
                <button
                  onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
              {[
                {
                  label: "Hoje",
                  fn: () => {
                    const d = new Date().toISOString().split("T")[0];
                    setDateFilter({ startDate: d, endDate: d });
                  },
                },
                {
                  label: "Esta semana",
                  fn: () => {
                    const now = new Date();
                    const mon = new Date(now);
                    mon.setDate(now.getDate() - now.getDay() + 1);
                    setDateFilter({
                      startDate: mon.toISOString().split("T")[0],
                      endDate: now.toISOString().split("T")[0],
                    });
                  },
                },
                {
                  label: "Este mês",
                  fn: () => {
                    const now = new Date();
                    const first = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      1
                    );
                    setDateFilter({
                      startDate: first.toISOString().split("T")[0],
                      endDate: now.toISOString().split("T")[0],
                    });
                  },
                },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.fn}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--border)] active:scale-95"
                >
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
            <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Processando dados...
            </p>
          </div>
        ) : (
          <StaggerList className="space-y-10">
            <StaggerItem>
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Visão Geral
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <p className="text-xs font-bold uppercase mb-2 text-[var(--muted-foreground)] tracking-wider">
                      Total Vendido
                    </p>
                    <p
                      className="text-4xl font-bold"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        color: "var(--primary)",
                      }}
                    >
                      {formatCurrency(summary?.totalAmount ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <p className="text-xs font-bold uppercase mb-2 text-[var(--muted-foreground)] tracking-wider">
                      Total de Vendas
                    </p>
                    <p
                      className="text-4xl font-bold"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        color: "var(--foreground)",
                      }}
                    >
                      {summary?.totalSales ?? 0}
                    </p>
                  </div>
                  <div className="rounded-3xl p-8 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <p className="text-xs font-bold uppercase mb-2 text-[var(--muted-foreground)] tracking-wider">
                      Média por Venda
                    </p>
                    <p
                      className="text-4xl font-bold"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        color: "var(--foreground)",
                      }}
                    >
                      {formatCurrency(
                        summary && summary.totalSales > 0
                          ? summary.totalAmount / summary.totalSales
                          : 0
                      )}
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
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Performance por Empresa
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { info: getCompanyInfo("mundo_da_magia"), data: magiaData },
                    { info: getCompanyInfo("mundo_cigano"), data: ciganoData },
                  ].map(({ info, data }) => (
                    <div
                      key={info.short}
                      className="rounded-3xl p-6 shadow-xl border-2 transition-all hover:shadow-2xl"
                      style={{
                        background: "var(--card)",
                        borderColor: info.border,
                      }}
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner"
                          style={{ background: info.bg }}
                        >
                          <Building2
                            className="w-6 h-6"
                            style={{ color: info.color }}
                          />
                        </div>
                        <div>
                          <p
                            className="text-lg font-bold"
                            style={{ color: info.color }}
                          >
                            {info.short}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Indicadores de Performance
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className="p-5 rounded-2xl shadow-inner"
                          style={{ background: info.bg }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60">
                            Vendido
                          </p>
                          <p
                            className="text-2xl font-bold"
                            style={{
                              color: info.color,
                              fontFamily: "'Playfair Display', serif",
                            }}
                          >
                            {formatCurrency(data?.totalAmount ?? 0)}
                          </p>
                        </div>
                        <div
                          className="p-5 rounded-2xl shadow-inner"
                          style={{ background: info.bg }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60">
                            Vendas
                          </p>
                          <p
                            className="text-2xl font-bold"
                            style={{
                              color: info.color,
                              fontFamily: "'Playfair Display', serif",
                            }}
                          >
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
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Rankings de Performance
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Top Vendedores */}
                  <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center gap-2 mb-6">
                      <Users className="w-4 h-4 text-blue-500" />
                      <h2
                        className="font-bold text-sm uppercase tracking-wider"
                        style={{ color: "var(--foreground)" }}
                      >
                        Top Vendedores
                      </h2>
                    </div>
                    <ul className="space-y-4">
                      {topSellers.length === 0 ? (
                        <li className="text-sm text-[var(--muted-foreground)] italic py-4 text-center">
                          Nenhum dado disponível.
                        </li>
                      ) : (
                        topSellers.map((seller: TopSeller, index: number) => (
                          <li
                            key={seller.sellerId}
                            className="flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                                {index + 1}
                              </span>
                              <p
                                className="text-sm font-bold"
                                style={{ color: "var(--foreground)" }}
                              >
                                {seller.sellerDisplayName || seller.sellerName}
                              </p>
                            </div>
                            <p
                              className="text-sm font-bold"
                              style={{ color: "var(--primary)" }}
                            >
                              {formatCurrency(seller.totalAmount)}
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Top Clientes */}
                  <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center gap-2 mb-6">
                      <Users className="w-4 h-4 text-purple-500" />
                      <h2
                        className="font-bold text-sm uppercase tracking-wider"
                        style={{ color: "var(--foreground)" }}
                      >
                        Top Clientes
                      </h2>
                    </div>
                    <ul className="space-y-4">
                      {topClients.length === 0 ? (
                        <li className="text-sm text-[var(--muted-foreground)] italic py-4 text-center">
                          Nenhum dado disponível.
                        </li>
                      ) : (
                        topClients.map((client: TopClient, index: number) => (
                          <li
                            key={`${client.clientName}|${client.clientPhone ?? ""}`}
                            className="flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                                {index + 1}
                              </span>
                              <p
                                className="text-sm font-bold"
                                style={{ color: "var(--foreground)" }}
                              >
                                {client.clientName}
                              </p>
                            </div>
                            <p
                              className="text-sm font-bold"
                              style={{ color: "var(--primary)" }}
                            >
                              {formatCurrency(client.totalAmount)}
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Top Trabalhos */}
                  <div className="rounded-3xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                    <div className="flex items-center gap-2 mb-6">
                      <Package className="w-4 h-4 text-orange-500" />
                      <h2
                        className="font-bold text-sm uppercase tracking-wider"
                        style={{ color: "var(--foreground)" }}
                      >
                        Top Trabalhos
                      </h2>
                    </div>
                    <ul className="space-y-4">
                      {topProducts.length === 0 ? (
                        <li className="text-sm text-[var(--muted-foreground)] italic py-4 text-center">
                          Nenhum dado disponível.
                        </li>
                      ) : (
                        topProducts.map(
                          (product: TopProduct, index: number) => (
                            <li
                              key={product.productName}
                              className="flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                                  {index + 1}
                                </span>
                                <p
                                  className="text-sm font-bold"
                                  style={{ color: "var(--foreground)" }}
                                >
                                  {product.productName}
                                </p>
                              </div>
                              <p
                                className="text-sm font-bold"
                                style={{ color: "var(--primary)" }}
                              >
                                {formatCurrency(product.totalAmount)}
                              </p>
                            </li>
                          )
                        )
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
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Gráficos de Vendas
            </h2>
          </div>

          {/* Filtros do gráfico */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Seletor de ano */}
            <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setChartYear(y => y - 1)}
                className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors active:scale-90"
              >
                <ChevronLeft
                  className="w-4 h-4"
                  style={{ color: "var(--foreground)" }}
                />
              </button>
              <span
                className="px-3 text-sm font-bold"
                style={{
                  color: "var(--foreground)",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {chartYear}
              </span>
              <button
                onClick={() => setChartYear(y => y + 1)}
                disabled={chartYear >= new Date().getFullYear()}
                className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors active:scale-90 disabled:opacity-30"
              >
                <ChevronRight
                  className="w-4 h-4"
                  style={{ color: "var(--foreground)" }}
                />
              </button>
            </div>

            {/* Toggle valor/quantidade */}
            <div className="flex items-center bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setChartMode("value")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  chartMode === "value"
                    ? "bg-[var(--primary)] text-white shadow-md"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" /> Valor (R$)
              </button>
              <button
                onClick={() => setChartMode("count")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  chartMode === "count"
                    ? "bg-[var(--primary)] text-white shadow-md"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                <Hash className="w-3.5 h-3.5" /> Quantidade
              </button>
            </div>
          </div>

          {/* Gráfico Total */}
          {(() => {
            const MONTHS = [
              "Jan",
              "Fev",
              "Mar",
              "Abr",
              "Mai",
              "Jun",
              "Jul",
              "Ago",
              "Set",
              "Out",
              "Nov",
              "Dez",
            ];
            const totalChartData = MONTHS.map((name, i) => {
              const found = monthlyTotal.find(
                (m: MonthlyTotalRow) => Number(m.month) === i + 1
              );
              return {
                name,
                value: found
                  ? Number(
                      chartMode === "value"
                        ? found.totalAmount
                        : found.totalSales
                    )
                  : 0,
              };
            });

            const magiaInfo = getCompanyInfo("mundo_da_magia");
            const ciganoInfo = getCompanyInfo("mundo_cigano");

            const magiaChartData = MONTHS.map((name, i) => {
              const found = monthlyByCompany.find(
                (m: MonthlyByCompanyRow) =>
                  Number(m.month) === i + 1 && m.company === "mundo_da_magia"
              );
              return {
                name,
                value: found
                  ? Number(
                      chartMode === "value"
                        ? found.totalAmount
                        : found.totalSales
                    )
                  : 0,
              };
            });

            const ciganoChartData = MONTHS.map((name, i) => {
              const found = monthlyByCompany.find(
                (m: MonthlyByCompanyRow) =>
                  Number(m.month) === i + 1 && m.company === "mundo_cigano"
              );
              return {
                name,
                value: found
                  ? Number(
                      chartMode === "value"
                        ? found.totalAmount
                        : found.totalSales
                    )
                  : 0,
              };
            });

            const formatValue = (v: number) =>
              chartMode === "value" ? formatCurrency(v) : String(v);
            const formatTick = (v: number) =>
              chartMode === "value"
                ? v >= 1000
                  ? `${(v / 1000).toFixed(0)}k`
                  : String(v)
                : String(v);

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
                      <h3
                        className="font-bold text-base"
                        style={{ color: "var(--foreground)" }}
                      >
                        {chartMode === "value"
                          ? "Faturamento Total"
                          : "Quantidade de Vendas"}{" "}
                        — {chartYear}
                      </h3>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--secondary)] text-[var(--primary)]">
                      {chartMode === "value"
                        ? formatCurrency(
                            totalChartData.reduce((s, d) => s + d.value, 0)
                          )
                        : `${totalChartData.reduce((s, d) => s + d.value, 0)} vendas`}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={totalChartData}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="totalGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--primary)"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--primary)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatTick}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatValue(value),
                          chartMode === "value" ? "Faturamento" : "Vendas",
                        ]}
                        contentStyle={chartTooltipStyle}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        fill="url(#totalGradient)"
                        dot={{
                          r: 4,
                          fill: "var(--primary)",
                          strokeWidth: 2,
                          stroke: "var(--card)",
                        }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráficos por Empresa */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Mundo Da Magia */}
                  <div
                    className="rounded-3xl p-6 shadow-xl border-2 transition-all hover:shadow-2xl"
                    style={{
                      background: "var(--card)",
                      borderColor: magiaInfo.border,
                    }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: magiaInfo.bg }}
                        >
                          <Building2
                            className="w-4 h-4"
                            style={{ color: magiaInfo.color }}
                          />
                        </div>
                        <h3
                          className="font-bold text-sm"
                          style={{ color: magiaInfo.color }}
                        >
                          {magiaInfo.short}
                        </h3>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-full"
                        style={{
                          background: magiaInfo.bg,
                          color: magiaInfo.color,
                        }}
                      >
                        {chartMode === "value"
                          ? formatCurrency(
                              magiaChartData.reduce((s, d) => s + d.value, 0)
                            )
                          : `${magiaChartData.reduce((s, d) => s + d.value, 0)} vendas`}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={magiaChartData}
                        margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatTick}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatValue(value),
                            magiaInfo.short,
                          ]}
                          contentStyle={chartTooltipStyle}
                        />
                        <Bar
                          dataKey="value"
                          fill={magiaInfo.color}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Mundo Cigano */}
                  <div
                    className="rounded-3xl p-6 shadow-xl border-2 transition-all hover:shadow-2xl"
                    style={{
                      background: "var(--card)",
                      borderColor: ciganoInfo.border,
                    }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: ciganoInfo.bg }}
                        >
                          <Building2
                            className="w-4 h-4"
                            style={{ color: ciganoInfo.color }}
                          />
                        </div>
                        <h3
                          className="font-bold text-sm"
                          style={{ color: ciganoInfo.color }}
                        >
                          {ciganoInfo.short}
                        </h3>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-full"
                        style={{
                          background: ciganoInfo.bg,
                          color: ciganoInfo.color,
                        }}
                      >
                        {chartMode === "value"
                          ? formatCurrency(
                              ciganoChartData.reduce((s, d) => s + d.value, 0)
                            )
                          : `${ciganoChartData.reduce((s, d) => s + d.value, 0)} vendas`}
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={ciganoChartData}
                        margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatTick}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatValue(value),
                            ciganoInfo.short,
                          ]}
                          contentStyle={chartTooltipStyle}
                        />
                        <Bar
                          dataKey="value"
                          fill={ciganoInfo.color}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </DashboardLayout>
  );
}
