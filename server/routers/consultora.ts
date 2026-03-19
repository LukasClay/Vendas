import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "../db";
import { sales, users, consultationSlots } from "../../drizzle/schema";
import { and, asc, count, desc, eq, isNull, like, ne, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { calcBusinessDaysFromSale, calcDeadline } from "../../shared/businessDays";

// Apenas consultoras e admins podem acessar estes endpoints
const consultoraProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "consultora" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à consultora." });
  }
  return next({ ctx });
});

// Apenas admins
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});

export const consultoraRouter = router({

  statusCounts: consultoraProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // GROUP BY no banco é muito mais eficiente que SELECT * + contar em JS
      const rows = await db.select({ workStatus: sales.workStatus, total: count() })
        .from(sales)
        .where(and(ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)))
        .groupBy(sales.workStatus);
      const counts = { para_escrever: 0, pendente: 0, feito: 0 };
      for (const row of rows) {
        if (row.workStatus in counts) counts[row.workStatus as keyof typeof counts] = Number(row.total);
      }
      return counts;
    }),

  // Aba 1: Para Escrever
  toWrite: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(sales.workStatus, "para_escrever"), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)];
      if (input?.search) {
        conditions.push(
          or(
            like(sales.productName, `%${input.search}%`),
            like(sales.clientName, `%${input.search}%`)
          )!
        );
      }

      const rows = await (db.select({
        id: sales.id,
        clientName: sales.clientName,
        clientBirthDate: sales.clientBirthDate,
        clientPhone: sales.clientPhone,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        notes: sales.notes,
        createdAt: sales.createdAt,
        sellerName: sales.sellerName,
      }).from(sales) as any)
        .where(and(...conditions))
        .orderBy(asc(sales.saleDate), asc(sales.createdAt))
        .limit(500);

      return rows.map((s: any) => {
        const saleDateStr = s.saleDate instanceof Date ? s.saleDate.toISOString().split('T')[0] : String(s.saleDate);
        const urgency = calcBusinessDaysFromSale(saleDateStr);
        return {
          id: s.id,
          clientName: s.clientName,
          clientBirthDate: s.clientBirthDate,
          clientPhone: s.clientPhone,
          productName: s.productName,
          productCategory: s.productCategory ?? "individual",
          saleDate: s.saleDate,
          notes: s.notes,
          createdAt: s.createdAt,
          sellerName: s.sellerName,
          daysRemaining: urgency.daysRemaining,
          deadline: urgency.deadline,
          isOverdue: urgency.isOverdue,
          isUrgent: urgency.isUrgent,
          urgencyScore: urgency.urgencyScore,
        };
      });
    }),

  // Aba 2: Pendentes (com prazo e urgência)
  pending: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(sales.workStatus, "pendente"), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)];
      if (input?.search) {
        conditions.push(
          or(
            like(sales.productName, `%${input.search}%`),
            like(sales.clientName, `%${input.search}%`)
          )!
        );
      }

      const rows = await (db.select({
        id: sales.id,
        clientName: sales.clientName,
        clientBirthDate: sales.clientBirthDate,
        clientPhone: sales.clientPhone,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        notes: sales.notes,
        writtenAt: sales.writtenAt,
        sellerName: sales.sellerName,
      }).from(sales) as any)
        .where(and(...conditions))
        .orderBy(asc(sales.saleDate))
        .limit(500);

      return rows.map((s: any) => {
          const urgency = calcBusinessDaysFromSale(s.saleDate instanceof Date ? s.saleDate.toISOString().split('T')[0] : String(s.saleDate));
          return {
            id: s.id,
            clientName: s.clientName,
            clientBirthDate: s.clientBirthDate,
            clientPhone: s.clientPhone,
            productName: s.productName,
            productCategory: s.productCategory ?? "individual",
            saleDate: s.saleDate,
            notes: s.notes,
            writtenAt: s.writtenAt,
            sellerName: s.sellerName,
            daysRemaining: urgency.daysRemaining,
            deadline: urgency.deadline,
            isOverdue: urgency.isOverdue,
            isUrgent: urgency.isUrgent,
            urgencyScore: urgency.urgencyScore,
          };
        }).sort((a: any, b: any) => b.urgencyScore - a.urgencyScore);
    }),

  // Aba 3: Feitos (mais recentes no topo para fácil reversão)
  done: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(sales.workStatus, "feito"), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)];
      if (input?.search) {
        conditions.push(
          or(
            like(sales.productName, `%${input.search}%`),
            like(sales.clientName, `%${input.search}%`)
          )!
        );
      }

      const rows = await (db.select({
        id: sales.id,
        clientName: sales.clientName,
        clientBirthDate: sales.clientBirthDate,
        clientPhone: sales.clientPhone,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        notes: sales.notes,
        completedAt: sales.completedAt,
        sellerName: sales.sellerName,
      }).from(sales) as any)
        .where(and(...conditions))
        .orderBy(desc(sales.completedAt)) // mais recentes no topo
        .limit(500);

      return rows.map((s: any) => ({
        id: s.id,
        clientName: s.clientName,
        clientBirthDate: s.clientBirthDate,
        clientPhone: s.clientPhone,
        productName: s.productName,
        productCategory: s.productCategory ?? "individual",
        saleDate: s.saleDate,
        notes: s.notes,
        completedAt: s.completedAt,
        sellerName: s.sellerName,
      }));
    }),

  // Transições de status

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

  // ADM: Pendente → Para Escrever (reversão de erro)
  undoWritten: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(sales)
        .set({ workStatus: "para_escrever", writtenAt: undefined })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "pendente")));
      return { success: true };
    }),

  // ADM: alterar vendedor de um trabalho
  updateSeller: adminProcedure
    .input(z.object({ saleId: z.number(), sellerId: z.number(), sellerName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(sales)
        .set({ sellerId: input.sellerId, sellerName: input.sellerName })
        .where(eq(sales.id, input.saleId));
      return { success: true };
    }),

  // ADM: listar vendedores ativos para o select
  listActiveSellers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({ id: users.id, name: users.name, displayName: users.displayName, role: users.role })
      .from(users)
      .where(and(eq(users.active, true), isNull(users.deletedAt)))
      .orderBy(asc(users.name));
    return rows.map(u => ({ id: u.id, name: u.displayName || u.name || u.role }));
  }),

  // Histórico de compras do cliente (sem valores)
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
        .where(and(eq(sales.clientName, input.clientName), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)))
        .orderBy(desc(sales.saleDate))
        .limit(50);

      // Consultas Cartas desta cliente (via consultation_slots) — correspondência exata
      const consultaRows = await db.select({
        id: consultationSlots.id,
        consultationDate: consultationSlots.consultationDate,
        consultationTime: consultationSlots.consultationTime,
        saleDate: sales.saleDate,
      }).from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .where(and(eq(sales.clientName, input.clientName), eq(consultationSlots.sold, true), isNull(sales.deletedAt)))
        .orderBy(desc(consultationSlots.consultationDate), desc(consultationSlots.consultationTime))
        .limit(20);

      return {
        totalPurchases: rows.length,
        totalConsultas: consultaRows.length,
        purchases: rows,
        consultas: consultaRows,
      };
    }),

  // Resumo de trabalhos para o Dashboard (toWrite + pending em paralelo)
  worksSummary: consultoraProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [toWriteRows, pendingRows] = await Promise.all([
      (db.select({
        id: sales.id,
        clientName: sales.clientName,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        sellerName: sales.sellerName,
      }).from(sales) as any)
        .where(and(eq(sales.workStatus, "para_escrever"), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)))
        .orderBy(asc(sales.saleDate)),
      (db.select({
        id: sales.id,
        clientName: sales.clientName,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        sellerName: sales.sellerName,
      }).from(sales) as any)
        .where(and(eq(sales.workStatus, "pendente"), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)))
        .orderBy(asc(sales.saleDate)),
    ]);
    const mapUrgency = (s: any) => {
      const saleDateStr = s.saleDate instanceof Date ? s.saleDate.toISOString().split('T')[0] : String(s.saleDate);
      const urgency = calcBusinessDaysFromSale(saleDateStr);
      return { ...s, productCategory: s.productCategory ?? "individual", ...urgency };
    };
    return {
      toWrite: toWriteRows.map(mapUrgency),
      pending: pendingRows.map(mapUrgency),
    };
  }),

  // Aba Alertas: trabalhos urgentes e atrasados (Para Escrever + Pendentes)
   alerts: consultoraProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await (db.select({
      id: sales.id,
      clientName: sales.clientName,
      clientPhone: sales.clientPhone,
      productName: sales.productName,
      productCategory: sales.productCategory,
      saleDate: sales.saleDate,
      workStatus: sales.workStatus,
      sellerName: sales.sellerName,
    }).from(sales) as any)
      .where(
        and(
          or(eq(sales.workStatus, "para_escrever"), eq(sales.workStatus, "pendente")),
          ne(sales.productName, "Consulta Cartas"),
          isNull(sales.deletedAt)
        )
      )
      .orderBy(asc(sales.saleDate))
      .limit(500);

    const withUrgency = rows.map((s: any) => {
      const saleDateStr = s.saleDate instanceof Date ? s.saleDate.toISOString().split("T")[0] : String(s.saleDate);
      const urgency = calcBusinessDaysFromSale(saleDateStr);
      return {
        id: s.id,
        clientName: s.clientName,
        clientPhone: s.clientPhone,
        productName: s.productName,
        productCategory: s.productCategory ?? "individual",
        saleDate: s.saleDate,
        workStatus: s.workStatus as "para_escrever" | "pendente",
        sellerName: s.sellerName,
        daysRemaining: urgency.daysRemaining,
        deadline: urgency.deadline,
        isOverdue: urgency.isOverdue,
        isUrgent: urgency.isUrgent,
        urgencyScore: urgency.urgencyScore,
      };
    });

    return withUrgency
      .filter((item: any) => item.isOverdue || item.isUrgent)
      .sort((a: any, b: any) => b.urgencyScore - a.urgencyScore);
  }),

});
