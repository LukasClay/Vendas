/**
 * Job automático de alertas de prazo
 * Roda a cada hora e envia push notifications para ADM e Consultora
 * quando há trabalhos urgentes (≤2 dias úteis) ou atrasados.
 *
 * Railway-ready: usa apenas setInterval + web-push, sem dependência do Manus.
 */
import { getDb } from "../db";
import { sales } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";
import { calcBusinessDaysFromSale } from "../../shared/businessDays";
import { sendPushToRoles } from "../webpush";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

// Controle para evitar notificações duplicadas na mesma hora
const notifiedThisHour = new Set<string>();

async function checkAndNotify() {
  const db = await getDb();
  if (!db) return;

  try {
    // Buscar trabalhos Para Escrever e Pendentes
    const activeSales = await (db.select({
      id: sales.id,
      clientName: sales.clientName,
      productName: sales.productName,
      saleDate: sales.saleDate,
      workStatus: sales.workStatus,
    })
      .from(sales)
      .where(inArray(sales.workStatus, ["para_escrever", "pendente"])) as any);

    const urgent: string[] = [];
    const overdue: string[] = [];

    for (const sale of activeSales) {
      const { daysRemaining, isOverdue, isUrgent } = calcBusinessDaysFromSale(sale.saleDate);

      if (isOverdue) {
        const key = `overdue-${sale.id}`;
        if (!notifiedThisHour.has(key)) {
          overdue.push(`• ${sale.clientName} — ${sale.productName} (${Math.abs(daysRemaining)}d atrasado)`);
          notifiedThisHour.add(key);
        }
      } else if (isUrgent) {
        const key = `urgent-${sale.id}`;
        if (!notifiedThisHour.has(key)) {
          urgent.push(`• ${sale.clientName} — ${sale.productName} (${daysRemaining}d restante${daysRemaining !== 1 ? "s" : ""})`);
          notifiedThisHour.add(key);
        }
      }
    }

    if (overdue.length === 0 && urgent.length === 0) return;

    // Montar mensagem consolidada
    let title = "";
    let body = "";

    if (overdue.length > 0 && urgent.length > 0) {
      title = `⚠️ ${overdue.length} atrasado(s) e ${urgent.length} urgente(s)`;
      body = `ATRASADOS:\n${overdue.join("\n")}\n\nURGENTES:\n${urgent.join("\n")}`;
    } else if (overdue.length > 0) {
      title = `🔴 ${overdue.length} trabalho(s) atrasado(s)`;
      body = overdue.join("\n");
    } else {
      title = `🟠 ${urgent.length} trabalho(s) urgente(s)`;
      body = urgent.join("\n");
    }

    // Enviar para ADM e Consultora
    await sendPushToRoles(["admin", "consultora"], {
      title,
      body,
      url: "/admin/alertas",
    });

    console.log(`[AlertsJob] Notificação enviada: ${title}`);
  } catch (err) {
    console.error("[AlertsJob] Erro ao verificar alertas:", err);
  }
}

export function startAlertsJob() {
  console.log("[AlertsJob] Iniciado — verificando a cada hora");

  // Executar após 30s (aguardar servidor estar pronto)
  setTimeout(() => {
    notifiedThisHour.clear();
    checkAndNotify();
  }, 30_000);

  // Repetir a cada hora
  setInterval(() => {
    notifiedThisHour.clear();
    checkAndNotify();
  }, INTERVAL_MS);
}
