import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { sales } from "../../drizzle/schema";
import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";

// Apenas consultoras e admins podem acessar estes endpoints
const consultoraProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "consultora" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à consultora." });
  }
  return next({ ctx });
});

/**
 * Calcula dias úteis (seg-sex) a partir do dia SEGUINTE à venda.
 * Ex: venda dia 16 → prazo começa dia 17, conta 7 dias úteis.
 */
function calcBusinessDaysFromSale(saleDateStr: string): { daysPassed: number; daysRemaining: number; isOverdue: boolean; isUrgent: boolean; urgencyScore: number } {
  const saleDate = new Date(saleDateStr + "T00:00:00");
  // Prazo começa no dia seguinte à venda
  const startDate = new Date(saleDate);
  startDate.setDate(startDate.getDate() + 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Conta dias úteis passados desde startDate até hoje
  let daysPassed = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= today) {
    const day = cursor.getDay(); // 0=Dom, 6=Sab
    if (day !== 0 && day !== 6) daysPassed++;
    cursor.setDate(cursor.getDate() + 1);
  }
  // Não contar o dia de hoje se ainda não chegou
  const todayDay = today.getDay();
  if (todayDay !== 0 && todayDay !== 6 && today >= startDate) daysPassed = Math.max(0, daysPassed - 1);

  const daysRemaining = 7 - daysPassed;
  const isOverdue = daysRemaining < 0;
  const isUrgent = daysRemaining <= 1 && daysRemaining >= 0;
  // Score: atrasados primeiro (maior score = mais urgente), depois por dias restantes crescente
  const urgencyScore = isOverdue ? 10000 + Math.abs(daysRemaining) : (7 - daysRemaining);

  return { daysPassed, daysRemaining, isOverdue, isUrgent, urgencyScore };
}

export const consultoraRouter = router({
  // ─── Contagem de badges por status ───────────────────────────────────────────
  statusCounts: consultoraProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const all = await db.select({ workStatus: sales.workStatus, productName: sales.productName }).from(sales);
      const counts = { para_escrever: 0, pendente: 0, feito: 0 };
      for (const row of all) {
        if (row.productName === "Consulta Cartas") continue; // Consultas ficam na aba própria
        if (row.workStatus in counts) counts[row.workStatus as keyof typeof counts]++;
      }
      return counts;
    }),

  // ─── Aba 1: Para Escrever ─────────────────────────────────────────────────────
  toWrite: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(sales.workStatus, "para_escrever"), ne(sales.productName, "Consulta Cartas")];
      if (input?.search) {
        conditions.push(
          or(
            like(sales.productName, `%${input.search}%`),
            like(sales.clientName, `%${input.search}%`)
          )!
        );
      }

      const rows = await db.select().from(sales)
        .where(and(...conditions))
        .orderBy(asc(sales.saleDate), asc(sales.createdAt));

      return rows.map(s => ({
        id: s.id,
        clientName: s.clientName,
        clientBirthDate: s.clientBirthDate,
        clientPhone: s.clientPhone,
        productName: s.productName,
        saleDate: s.saleDate,
        notes: s.notes,
        createdAt: s.createdAt,
        sellerName: s.sellerName,
      }));
    }),

  // ─── Aba 2: Pendentes (com prazo e urgência) ────────────────────────────────────────────────────────────────────────────────────
  pending: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(sales.workStatus, "pendente"), ne(sales.productName, "Consulta Cartas")];
      if (input?.search) {
        conditions.push(
          or(
            like(sales.productName, `%${input.search}%`),
            like(sales.clientName, `%${input.search}%`)
          )!
        );
      }

      const rows = await db.select().from(sales)
        .where(and(...conditions))
        .orderBy(asc(sales.saleDate));

      return rows.map(s => {
        const saleDateStr = s.saleDate instanceof Date ? s.saleDate.toISOString().slice(0, 10) : String(s.saleDate);
        const urgency = calcBusinessDaysFromSale(saleDateStr);
        return {
          id: s.id,
          clientName: s.clientName,
          clientBirthDate: s.clientBirthDate,
          clientPhone: s.clientPhone,
          productName: s.productName,
          saleDate: s.saleDate,
          notes: s.notes,
          writtenAt: s.writtenAt,
          sellerName: s.sellerName,
          ...urgency,
        };
      }).sort((a, b) => b.urgencyScore - a.urgencyScore);
    }),

  // ─── Aba 3: Feitos (mais recentes no topo para fácil reversão) ────────────────
  done: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(sales.workStatus, "feito"), ne(sales.productName, "Consulta Cartas")];
      if (input?.search) {
        conditions.push(
          or(
            like(sales.productName, `%${input.search}%`),
            like(sales.clientName, `%${input.search}%`)
          )!
        );
      }

      const rows = await db.select().from(sales)
        .where(and(...conditions))
        .orderBy(desc(sales.completedAt)); // mais recentes no topo

      return rows.map(s => ({
        id: s.id,
        clientName: s.clientName,
        clientBirthDate: s.clientBirthDate,
        clientPhone: s.clientPhone,
        productName: s.productName,
        saleDate: s.saleDate,
        notes: s.notes,
        completedAt: s.completedAt,
        sellerName: s.sellerName,
      }));
    }),

  // ─── Transições de status ─────────────────────────────────────────────────────

  // Para Escrever → Pendente
  markWritten: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(sales)
        .set({ workStatus: "pendente", writtenAt: new Date() })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "para_escrever")));
      return { success: true };
    }),

  // Pendente → Feito
  markDone: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(sales)
        .set({ workStatus: "feito", completedAt: new Date() })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "pendente")));
      return { success: true };
    }),

  // Feito → Pendente (reversão de erro)
  undoDone: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(sales)
        .set({ workStatus: "pendente", completedAt: undefined })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "feito")));
      return { success: true };
    }),

  // ─── Histórico de compras do cliente (sem valores) ────────────────────────────
  clientHistory: consultoraProcedure
    .input(z.object({ clientName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Trabalhos normais (excluindo Consulta Cartas)
      const rows = await db.select({
        id: sales.id,
        productName: sales.productName,
        saleDate: sales.saleDate,
        workStatus: sales.workStatus,
      }).from(sales)
        .where(and(like(sales.clientName, `%${input.clientName}%`), ne(sales.productName, "Consulta Cartas")))
        .orderBy(desc(sales.saleDate))
        .limit(50);

      // Consultas Cartas desta cliente (via consultation_slots)
      const { consultationSlots: csTable } = await import("../../drizzle/schema");
      const consultaRows = await db.select({
        id: csTable.id,
        consultationDate: csTable.consultationDate,
        consultationTime: csTable.consultationTime,
        saleDate: sales.saleDate,
      }).from(csTable)
        .leftJoin(sales, eq(csTable.saleId, sales.id))
        .where(and(like(sales.clientName, `%${input.clientName}%`), eq(csTable.sold, true)))
        .orderBy(desc(csTable.consultationDate), desc(csTable.consultationTime))
        .limit(20);

      return {
        totalPurchases: rows.length,
        totalConsultas: consultaRows.length,
        purchases: rows,
        consultas: consultaRows,
      };
    }),
});
