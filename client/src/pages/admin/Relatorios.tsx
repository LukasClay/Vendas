import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Download, Mail, Plus, Trash2, BarChart3, Loader2, Check } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { useTheme } from "@/contexts/ThemeContext";

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
        headStyles: { fillColor: [153, 102, 51], textColor: 255 },
        alternateRowStyles: { fillColor: [252, 249, 245] },
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
              style={{ background: "oklch(0.55 0.15 160)", color: "white", fontSize: "16px" }}>
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportLoading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-60 active:scale-95"
              style={{ background: "oklch(0.58 0.22 25)", color: "white", fontSize: "16px" }}>
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </button>
          </div>
        </div>

        {/* Filtro de período */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>Período de Análise</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={e => setDateFilter(f => ({ ...f, startDate: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
            />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>até</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={e => setDateFilter(f => ({ ...f, endDate: e.target.value }))}
              className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
              style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--secondary)", color: "var(--primary)" }}>
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
                className="px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                style={{ background: "var(--secondary)", color: "var(--foreground)" }}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl p-6 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Total Vendido</p>
                <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--primary)" }}>
                  {formatCurrency(summary?.totalAmount ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl p-6 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Número de Vendas</p>
                <p className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "var(--foreground)" }}>
                  {summary?.totalSales ?? 0}
                </p>
              </div>
            </div>

            {/* Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[
                { title: "Top Vendedores", data: topSellers, nameKey: "sellerDisplayName", fallbackKey: "sellerName", valueKey: "totalAmount", countKey: "totalSales" },
                { title: "Top Clientes", data: topClients, nameKey: "clientName", fallbackKey: "clientName", valueKey: "totalAmount", countKey: "totalSales" },
                { title: "Trabalhos Mais Vendidos", data: topProducts, nameKey: "productName", fallbackKey: "productName", valueKey: "totalAmount", countKey: "totalSales" },
              ].map(({ title, data, nameKey, fallbackKey, valueKey, countKey }) => (
                <div key={title} className="rounded-2xl p-5 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                    <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    {title}
                  </h2>
                  {data.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>Sem dados</p>
                  ) : (
                    <div className="space-y-2">
                      {data.slice(0, 5).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                          style={{ background: i === 0 ? "var(--secondary)" : "var(--muted)" }}>
                          <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: "var(--primary)" }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                              {item[nameKey] || item[fallbackKey] || "—"}
                            </p>
                            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                              {item[countKey]} venda{Number(item[countKey]) !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--primary)" }}>
                            {formatCurrency(item[valueKey])}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Relatórios Automáticos por Email */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>Relatórios Automáticos por Email</h2>
            </div>
            <button
              onClick={() => setShowScheduleForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--primary), oklch(0.68 0.14 70))", color: "white" }}>
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {/* Form */}
          {showScheduleForm && (
            <div className="px-4 sm:px-6 py-5 border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Frequência</label>
                  <select
                    value={scheduleForm.frequency}
                    onChange={e => setScheduleForm(f => ({ ...f, frequency: e.target.value as any }))}
                    className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 cursor-pointer"
                    style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}>
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
                <div className="flex-1 min-w-48">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Email do destinatário</label>
                  <input
                    type="email"
                    value={scheduleForm.recipientEmail}
                    onChange={e => setScheduleForm(f => ({ ...f, recipientEmail: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                    style={{ border: "1.5px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (!scheduleForm.recipientEmail) { toast.error("Informe o email."); return; }
                      createSchedule.mutate(scheduleForm);
                    }}
                    disabled={createSchedule.isPending}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl font-medium text-white active:scale-95"
                    style={{ background: "oklch(0.55 0.15 160)", fontSize: "16px" }}>
                    {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Salvar
                  </button>
                  <button
                    onClick={() => setShowScheduleForm(false)}
                    className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl font-medium active:scale-95"
                    style={{ background: "var(--secondary)", color: "var(--foreground)", fontSize: "16px" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de agendamentos */}
          {loadingSchedules ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <Mail className="w-8 h-8 mb-3" style={{ color: "var(--muted-foreground)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Nenhum agendamento configurado</p>
              <p className="text-xs mt-1 text-center" style={{ color: "var(--muted-foreground)" }}>
                Adicione emails para receber relatorios automaticos.<br />
                Diario: todo dia as 7h · Semanal: segunda-feira as 7h · Mensal: dia 1 as 7h
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {schedules.map((schedule: any) => (
                <div key={schedule.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: schedule.active ? "var(--secondary)" : "var(--muted)" }}>
                    <Mail className="w-5 h-5" style={{ color: schedule.active ? "oklch(0.55 0.15 160)" : "var(--muted-foreground)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {schedule.recipientEmail}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {FREQ_LABELS[schedule.frequency]} · {schedule.active ? "Ativo" : "Pausado"}
                      {schedule.lastSentAt && ` · Ultimo envio: ${new Date(schedule.lastSentAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleSchedule.mutate({ id: schedule.id, active: !schedule.active })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
background: schedule.active ? "oklch(0.93 0.04 30)" : "oklch(0.92 0.04 160)",
                         color: schedule.active ? "oklch(0.55 0.20 30)" : "oklch(0.45 0.15 160)",
                      }}>
                      {schedule.active ? "Pausar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => sendTestEmail.mutate({ email: schedule.recipientEmail })}
                      disabled={sendTestEmail.isPending}
                      title="Enviar email de teste agora"
                      className="p-2 rounded-lg transition-colors hover:bg-amber-50"
                      style={{ color: "var(--primary)" }}>
                      {sendTestEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteSchedule.mutate({ id: schedule.id })}
                      className="p-2 rounded-lg transition-colors hover:bg-red-50"
                      style={{ color: "oklch(0.58 0.22 25)" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
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
