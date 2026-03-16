import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { completeSale, getClientPurchaseHistory, getPendingSales } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

// Apenas consultoras e admins podem acessar estes endpoints
const consultoraProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "consultora" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à consultora." });
  }
  return next({ ctx });
});

/**
 * Calcula quantos dias úteis se passaram desde a data de venda.
 * Dias úteis = dias da semana excluindo sábado e domingo.
 */
function businessDaysSince(saleDate: Date): number {
  const now = new Date();
  let count = 0;
  const cursor = new Date(saleDate);
  cursor.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  while (cursor < today) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay(); // 0=Dom, 6=Sab
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export const consultoraRouter = router({
  // Lista trabalhos pendentes ordenados por urgência (mais antigos primeiro)
  pendingWork: consultoraProcedure
    .input(z.object({
      productName: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const raw = await getPendingSales(input?.productName);

      return raw.map(sale => {
        const daysPassed = businessDaysSince(new Date(sale.saleDate));
        const daysRemaining = 7 - daysPassed;
        const isOverdue = daysRemaining < 0;
        const isUrgent = daysRemaining <= 1 && daysRemaining >= 0;

        return {
          ...sale,
          daysPassed,
          daysRemaining,
          isOverdue,
          isUrgent,
          // Urgency score: overdue first, then by days remaining ascending
          urgencyScore: isOverdue ? -daysRemaining + 1000 : (7 - daysRemaining),
        };
      }).sort((a, b) => b.urgencyScore - a.urgencyScore);
    }),

  // Marca um trabalho como concluído
  complete: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await completeSale(input.id);
      return { success: true };
    }),

  // Histórico de compras de um cliente pelo nome (sem valores)
  clientHistory: consultoraProcedure
    .input(z.object({ clientName: z.string().min(1) }))
    .query(async ({ input }) => {
      return getClientPurchaseHistory(input.clientName);
    }),
});
