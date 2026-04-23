/**
 * Job automático de alertas de prazo
 * Roda às 8h e às 18h e envia push notifications para ADM e Consultora
 * quando há trabalhos urgentes (≤2 dias úteis) ou atrasados.
 */
import { getDb } from "../db";
import { sales } from "../../drizzle/schema";
import { and, inArray, isNull, ne } from "drizzle-orm";
import { getSaleUrgency } from "../../shared/businessDays";
import { sendPushToRoles } from "../webpush";

// Horários de disparo (hora local do servidor, formato 24h)
const TRIGGER_HOURS = [8, 18];

async function checkAndNotify() {
  const db = await getDb();
  if (!db) return;

  try {
    // Buscar trabalhos Para Escrever e Pendentes
    const activeSales = await (db
      .select({
        id: sales.id,
        clientName: sales.clientName,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        workStatus: sales.workStatus,
      })
      .from(sales)
      .where(
        and(
          inArray(sales.workStatus, ["para_escrever", "pendente"]),
          // Consulta Cartas tem regra própria (50min pós-horário → realizada via
          // consultationSlots.effectiveStatus) e já é excluída em consultora.alerts.
          ne(sales.productName, "Consulta Cartas"),
          isNull(sales.deletedAt) // Garante que não enviará alerta de vendas deletadas
        )
      ) as any);

    const urgent: string[] = [];
    const overdue: string[] = [];

    for (const sale of activeSales) {
      const urgency = getSaleUrgency(sale.saleDate, sale.productCategory);
      // Coletivos (hasDeadline=false) não geram alerta nem push automático.
      if (!urgency.hasDeadline) continue;
      const { daysRemaining, isOverdue, isUrgent } = urgency;
      if (isOverdue) {
        overdue.push(
          `• ${sale.clientName} — ${sale.productName} (${Math.abs(daysRemaining)}d atrasado)`
        );
      } else if (isUrgent) {
        urgent.push(
          `• ${sale.clientName} — ${sale.productName} (${daysRemaining}d restante${daysRemaining !== 1 ? "s" : ""})`
        );
      }
    }

    if (overdue.length === 0 && urgent.length === 0) {
      return;
    }

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

/**
 * Calcula quantos ms faltam até o próximo horário de disparo (8h ou 18h).
 */
function msUntilNextTrigger(): number {
  const now = new Date();
  const candidates = TRIGGER_HOURS.map(h => {
    const t = new Date(now);
    t.setHours(h, 0, 0, 0);
    if (t.getTime() <= now.getTime()) {
      // Já passou hoje — agendar para amanhã
      t.setDate(t.getDate() + 1);
    }
    return t.getTime() - now.getTime();
  });
  return Math.min(...candidates);
}

/**
 * Agenda recursivamente o próximo disparo.
 */
function scheduleNext() {
  const delay = msUntilNextTrigger();
  setTimeout(async () => {
    await checkAndNotify();
    scheduleNext(); // agendar o próximo após executar
  }, delay);
}

export function startAlertsJob() {
  console.log(
    `[AlertsJob] Iniciado — disparos às ${TRIGGER_HOURS.map(h => `${h}h`).join(" e ")}`
  );
  scheduleNext();
}
