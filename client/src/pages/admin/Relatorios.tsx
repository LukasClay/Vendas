import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Download, Mail, Plus, Trash2, BarChart3, Loader2, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerList, StaggerItem } from "@/components/Animations";

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

  const summaryInput = useMemo(
    () => (dateFilter.startDate || dateFilter.endDate ? dateFilter : undefined),
    [dateFilter.startDate, dateFilter.endDate]
  );

  const { data: reportData, isLoading } = trpc.reports.summary.useQuery(summaryInput);
  const { data: exportData = [] } = trpc.reports.exportData.useQuery(dateFilter);
  const { data: schedules = [], isLoading: loadingSchedules } = trpc.reports.schedules.useQuery();

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
      // Auto column widths
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

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                Relatórios
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                Análise detalhada de performance e exportação de dados
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportExcel}
                disabled={exportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-60 active:scale-95"
                style={{ background: "var(--primary)", color: "white", fontSize: "16px" }}>
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-60 active:scale-95"
                style={{ background: "var(--primary)", color: "white", fontSize: "16px" }}>
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Filtro de período */}
        <div className="rounded-2xl p-5 shadow-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}>Período de Análise</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={e => setDateFilter(f => ({ ...f, startDate: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              style={{ border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
            />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>até</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              style={{ border: "1.5px solid var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                className="px-3 py-2 rounded-xl text-sm bg-[var(--secondary)] text-[var(--primary)] hover:bg-[var(--secondary)]/70 transition-colors">
                Limpar
              </button>
            )}
            {/* Quick filters */}
            {[
              { label: "Hoje", fn: () => { const d = new Date().toISOString().split("T")[0]; setDateFilter({ startDate: d, endDate: d }); } },
              { label: "Esta semana", fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); setDateFilter({ startDate: mon.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] }); } },
              { label: "Este mês", fn: () => { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); setDateFilter({ startDate: first.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] }); } },
            ].map(btn => (
              <button key={btn.label} onClick={btn.fn}
                className="px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/70">
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <StaggerList>
            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <p className="text-xs font-bold uppercase mb-1 text-[var(--muted-foreground)]">Total Vendido</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--primary)" }}>
                    {formatCurrency(summary?.totalAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <p className="text-xs font-bold uppercase mb-1 text-[var(--muted-foreground)]">Total de Vendas</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                    {summary?.totalSales ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <p className="text-xs font-bold uppercase mb-1 text-[var(--muted-foreground)]">Média por Venda</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                    {formatCurrency(summary?.averageSale ?? 0)}
                  </p>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <h2 className="font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}>Top Vendedores</h2>
                  <ul className="space-y-2">
                    {topSellers.length === 0 ? (
                      <li className="text-sm text-[var(--muted-foreground)]">Nenhum dado.</li>
                    ) : (
                      topSellers.map((seller, index) => (
                        <li key={seller.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--secondary)] text-[var(--primary)]">{index + 1}</span>
                            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{seller.name}</p>
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)]">{formatCurrency(seller.totalAmount)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <h2 className="font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}>Top Clientes</h2>
                  <ul className="space-y-2">
                    {topClients.length === 0 ? (
                      <li className="text-sm text-[var(--muted-foreground)]">Nenhum dado.</li>
                    ) : (
                      topClients.map((client, index) => (
                        <li key={client.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--secondary)] text-[var(--primary)]">{index + 1}</span>
                            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{client.name}</p>
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)]">{formatCurrency(client.totalAmount)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl p-6 shadow-xl border border-[var(--border)] bg-[var(--card)]">
                  <h2 className="font-bold text-sm mb-3" style={{ color: "var(--foreground)" }}>Top Trabalhos</h2>
                  <ul className="space-y-2">
                    {topProducts.length === 0 ? (
                      <li className="text-sm text-[var(--muted-foreground)]">Nenhum dado.</li>
                    ) : (
                      topProducts.map((product, index) => (
                        <li key={product.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--secondary)] text-[var(--primary)]">{index + 1}</span>
                            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{product.name}</p>
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)]">{formatCurrency(product.totalAmount)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </StaggerItem>
          </StaggerList>
        )}

        {/* Agendamentos de Relatórios */}
        <StaggerList>
          <StaggerItem>
            <div className="rounded-2xl p-5 shadow-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>Agendamentos de Relatórios</h2>
                <button onClick={() => setShowScheduleForm(!showScheduleForm)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Novo Agendamento
                </button>
              </div>

              <AnimatePresence>
                {showScheduleForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)] space-y-3">
                      <h3 className="font-bold text-base" style={{ color: "var(--foreground)" }}>Criar Novo Agendamento</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-[var(--muted-foreground)]">Frequência</label>
                          <select value={scheduleForm.frequency} onChange={e => setScheduleForm(f => ({ ...f, frequency: e.target.value as any }))}
                            className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}>
                            <option value="daily">Diário</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-[var(--muted-foreground)]">Email do Destinatário</label>
                          <input type="email" value={scheduleForm.recipientEmail} onChange={e => setScheduleForm(f => ({ ...f, recipientEmail: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }} placeholder="email@exemplo.com" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => createSchedule.mutate(scheduleForm)} disabled={createSchedule.isPending || !scheduleForm.recipientEmail}
                          className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2">
                          {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Agendar
                        </button>
                        <button onClick={() => setShowScheduleForm(false)}
                          className="px-5 py-2 rounded-xl text-sm font-medium bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loadingSchedules ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--secondary)]/20">
                  <Mail className="w-10 h-10 text-[var(--muted-foreground)] opacity-20" />
                  <p className="text-sm font-medium text-[var(--muted-foreground)]">Nenhum agendamento de relatório.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {schedules.map(schedule => (
                    <li key={schedule.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Relatório {FREQ_LABELS[schedule.frequency]}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Para: {schedule.recipientEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => sendTestEmail.mutate({ scheduleId: schedule.id })} disabled={sendTestEmail.isPending}
                          className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-blue-500 border border-[var(--border)]">
                          {sendTestEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        </button>
                        <button onClick={() => toggleSchedule.mutate({ id: schedule.id, active: !schedule.active })}
                          className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-green-500 border border-[var(--border)]">
                          {schedule.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button onClick={() => deleteSchedule.mutate({ id: schedule.id })}
                          className="p-2 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondary)]/70 transition-colors text-red-500 border border-[var(--border)]">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </StaggerItem>
        </StaggerList>
      </div>
    </DashboardLayout>
  );
}
