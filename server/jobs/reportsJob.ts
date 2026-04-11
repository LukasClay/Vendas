/**
 * Job automatico de envio de relatorios por email
 * Verifica a cada hora se ha agendamentos pendentes e envia os relatorios.
 *
 * Frequencias:
 * - daily: envia todo dia as 7h
 * - weekly: envia toda segunda-feira as 7h
 * - monthly: envia no dia 1 de cada mes as 7h
 */
import { getDb } from "../db";
import { reportSchedules, sales } from "../../drizzle/schema";
import { and, eq, isNull, sql, desc, asc } from "drizzle-orm";
import { sendEmail, isEmailConfigured } from "../email";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

/** Escapa HTML para prevenir XSS em templates de email */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Determina o periodo do relatorio com base na frequencia.
 */
function getReportPeriod(frequency: string): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (frequency === "daily") {
    // Ontem
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    const end = new Date(startDate);
    end.setHours(23, 59, 59, 999);
    return {
      startDate,
      endDate: end,
      label: `Relatorio Diario - ${formatDate(startDate)}`,
    };
  }

  if (frequency === "weekly") {
    // Ultimos 7 dias
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    return {
      startDate,
      endDate,
      label: `Relatorio Semanal - ${formatDate(startDate)} a ${formatDate(now)}`,
    };
  }

  // monthly - mes anterior
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const monthName = startDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return { startDate, endDate: end, label: `Relatorio Mensal - ${monthName}` };
}

/**
 * Verifica se o agendamento deve ser disparado agora.
 */
function shouldSendNow(frequency: string, lastSentAt: Date | null): boolean {
  const now = new Date();
  const hour = now.getHours();

  // So envia entre 7h e 8h
  if (hour < 7 || hour >= 8) return false;

  if (!lastSentAt) return true; // Nunca enviou

  const lastSent = new Date(lastSentAt);
  const diffMs = now.getTime() - lastSent.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (frequency === "daily") {
    return diffHours >= 20; // Pelo menos 20h desde o ultimo envio
  }

  if (frequency === "weekly") {
    const dayOfWeek = now.getDay();
    return dayOfWeek === 1 && diffHours >= 144; // Segunda-feira, pelo menos 6 dias
  }

  if (frequency === "monthly") {
    const dayOfMonth = now.getDate();
    return dayOfMonth === 1 && diffHours >= 600; // Dia 1, pelo menos 25 dias
  }

  return false;
}

/**
 * Busca dados de vendas do periodo e gera o HTML do relatorio.
 */
async function generateReportHtml(
  frequency: string
): Promise<{ html: string; subject: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const { startDate, endDate, label } = getReportPeriod(frequency);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Buscar vendas do periodo
  const periodSales = await (db
    .select({
      id: sales.id,
      clientName: sales.clientName,
      productName: sales.productName,
      amount: sales.amount,
      saleDate: sales.saleDate,
      sellerName: sales.sellerName,
      productCategory: sales.productCategory,
    })
    .from(sales)
    .where(
      and(
        isNull(sales.deletedAt),
        sql`${sales.saleDate} >= ${startStr}`,
        sql`${sales.saleDate} <= ${endStr}`
      )
    )
    .orderBy(desc(sales.saleDate)) as any);

  const totalAmount = periodSales.reduce(
    (sum: number, s: any) => sum + Number(s.amount || 0),
    0
  );
  const totalSales = periodSales.length;

  // Top vendedores
  const sellerMap = new Map<string, { count: number; total: number }>();
  for (const s of periodSales) {
    const name = s.sellerName || "Desconhecido";
    const current = sellerMap.get(name) || { count: 0, total: 0 };
    current.count++;
    current.total += Number(s.amount || 0);
    sellerMap.set(name, current);
  }
  const topSellers = Array.from(sellerMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  // Top produtos
  const productMap = new Map<string, { count: number; total: number }>();
  for (const s of periodSales) {
    const name = s.productName || "Desconhecido";
    const current = productMap.get(name) || { count: 0, total: 0 };
    current.count++;
    current.total += Number(s.amount || 0);
    productMap.set(name, current);
  }
  const topProducts = Array.from(productMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const subject = `Mundo Da Magia - ${label}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fdf8f0; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #c17f24, #a0651a); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-family: 'Playfair Display', Georgia, serif; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
    .content { background: white; padding: 24px; border: 1px solid #e8dcc8; border-top: none; border-radius: 0 0 12px 12px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary-card { flex: 1; background: #fdf8f0; border: 1px solid #e8dcc8; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .number { font-size: 28px; font-weight: bold; color: #c17f24; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    h2 { font-size: 16px; color: #333; border-bottom: 2px solid #c17f24; padding-bottom: 8px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #fdf8f0; color: #666; font-size: 11px; text-transform: uppercase; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e8dcc8; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0e8d8; font-size: 14px; }
    tr:hover td { background: #fdf8f0; }
    .footer { text-align: center; padding: 16px; font-size: 12px; color: #999; }
    .no-data { text-align: center; padding: 24px; color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Mundo Da Magia LTDA</h1>
      <p>${label}</p>
    </div>
    <div class="content">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
          <td width="50%" style="padding: 8px;">
            <div style="background: #fdf8f0; border: 1px solid #e8dcc8; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #c17f24;">${totalSales}</div>
              <div style="font-size: 12px; color: #666; margin-top: 4px;">Vendas</div>
            </div>
          </td>
          <td width="50%" style="padding: 8px;">
            <div style="background: #fdf8f0; border: 1px solid #e8dcc8; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #c17f24;">${formatCurrency(totalAmount)}</div>
              <div style="font-size: 12px; color: #666; margin-top: 4px;">Faturamento</div>
            </div>
          </td>
        </tr>
      </table>

      ${
        topSellers.length > 0
          ? `
      <h2>Top Vendedores</h2>
      <table>
        <thead><tr><th>Vendedor</th><th>Vendas</th><th>Total</th></tr></thead>
        <tbody>
          ${topSellers
            .map(
              ([name, data]) => `
            <tr><td>${escapeHtml(name)}</td><td>${data.count}</td><td>${formatCurrency(data.total)}</td></tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      `
          : ""
      }

      ${
        topProducts.length > 0
          ? `
      <h2>Top Trabalhos</h2>
      <table>
        <thead><tr><th>Trabalho</th><th>Vendas</th><th>Total</th></tr></thead>
        <tbody>
          ${topProducts
            .map(
              ([name, data]) => `
            <tr><td>${escapeHtml(name)}</td><td>${data.count}</td><td>${formatCurrency(data.total)}</td></tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      `
          : ""
      }

      ${totalSales === 0 ? '<div class="no-data">Nenhuma venda registrada neste periodo.</div>' : ""}

      ${
        periodSales.length > 0
          ? `
      <h2>Ultimas Vendas</h2>
      <table>
        <thead><tr><th>Cliente</th><th>Trabalho</th><th>Valor</th></tr></thead>
        <tbody>
          ${periodSales
            .slice(0, 15)
            .map(
              (s: any) => `
            <tr><td>${escapeHtml(s.clientName)}</td><td>${escapeHtml(s.productName)}</td><td>${formatCurrency(Number(s.amount || 0))}</td></tr>
          `
            )
            .join("")}
          ${periodSales.length > 15 ? `<tr><td colspan="3" style="text-align: center; color: #999; font-style: italic;">... e mais ${periodSales.length - 15} vendas</td></tr>` : ""}
        </tbody>
      </table>
      `
          : ""
      }
    </div>
    <div class="footer">
      Mundo Da Magia LTDA - Relatorio automatico<br>
      Este email foi enviado automaticamente pelo sistema.
    </div>
  </div>
</body>
</html>`;

  return { html, subject };
}

/**
 * Verifica todos os agendamentos e envia os que estao pendentes.
 */
async function processSchedules() {
  if (!isEmailConfigured()) return;

  const db = await getDb();
  if (!db) return;

  try {
    const schedules = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.active, true));

    for (const schedule of schedules) {
      if (!shouldSendNow(schedule.frequency, schedule.lastSentAt)) continue;

      const report = await generateReportHtml(schedule.frequency);
      if (!report) continue;

      const sent = await sendEmail({
        to: schedule.recipientEmail,
        subject: report.subject,
        html: report.html,
      });

      if (sent) {
        // Atualizar lastSentAt
        await db
          .update(reportSchedules)
          .set({ lastSentAt: new Date() })
          .where(eq(reportSchedules.id, schedule.id));

        console.log(
          `[ReportsJob] Relatorio ${schedule.frequency} enviado para ${schedule.recipientEmail}`
        );
      }
    }
  } catch (err) {
    console.error("[ReportsJob] Erro ao processar agendamentos:", err);
  }
}

/**
 * Inicia o job de relatorios — verifica a cada hora.
 */
export function startReportsJob() {
  if (!isEmailConfigured()) {
    console.log("[ReportsJob] Desabilitado — RESEND_API_KEY nao configurada");
    return;
  }

  console.log("[ReportsJob] Iniciado — verificacao a cada hora, envio as 7h");

  // Verificar imediatamente na inicializacao
  setTimeout(() => processSchedules(), 10_000);

  // Verificar a cada hora
  setInterval(() => processSchedules(), CHECK_INTERVAL_MS);
}
