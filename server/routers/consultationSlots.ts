import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, withRetry } from "../db";
import { consultationSlots, sales, users } from "../../drizzle/schema";
import { eq, and, gte, asc, desc } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const consultationSlotsRouter = router({

  // Lista horários disponíveis (não vendidos, data >= hoje) — para o formulário de venda
  listAvailable: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select()
        .from(consultationSlots)
        .where(
          and(
            eq(consultationSlots.sold, false),
            gte(consultationSlots.consultationDate, todayStr() as any)
          )
        )
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );
    return rows;
  }),

  // Lista todos os slots (ADM e consultora) — para gerenciamento
  listAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    // Busca slots com dados da venda (cliente) e nome do vendedor
    const rows = await withRetry(() =>
      db.select({
        id: consultationSlots.id,
        consultationDate: consultationSlots.consultationDate,
        consultationTime: consultationSlots.consultationTime,
        sold: consultationSlots.sold,
        saleId: consultationSlots.saleId,
        createdBy: consultationSlots.createdBy,
        createdAt: consultationSlots.createdAt,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        clientBirthDate: sales.clientBirthDate,
        notes: sales.notes,
        saleDate: sales.saleDate,
        sellerName: users.displayName,
        sellerUsername: users.username,
      })
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );
    return rows;
  }),

  // Cria novo slot de consulta (ADM ou consultora)
  create: protectedProcedure
    .input(z.object({
      consultationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
      consultationTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para criar horários." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Verifica se já existe esse slot
      const existing = await withRetry(() =>
        db.select().from(consultationSlots)
          .where(
            and(
              eq(consultationSlots.consultationDate, input.consultationDate as any),
              eq(consultationSlots.consultationTime, input.consultationTime)
            )
          ).limit(1)
      );
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um horário cadastrado para essa data e hora." });
      }

      await withRetry(() =>
        db.insert(consultationSlots).values({
          consultationDate: input.consultationDate as any,
          consultationTime: input.consultationTime,
          sold: false,
          createdBy: ctx.user.id,
        })
      );
      return { success: true };
    }),

  // Remove slot (apenas se não vendido)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const slot = await withRetry(() =>
        db.select().from(consultationSlots).where(eq(consultationSlots.id, input.id)).limit(1)
      );
      if (!slot[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Horário não encontrado." });
      if (slot[0].sold) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível remover um horário já vendido." });

      await withRetry(() =>
        db.delete(consultationSlots).where(eq(consultationSlots.id, input.id))
      );
      return { success: true };
    }),

  // Consultas pendentes (data >= hoje, sold = true)
  listPending: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select({
        id: consultationSlots.id,
        consultationDate: consultationSlots.consultationDate,
        consultationTime: consultationSlots.consultationTime,
        saleId: consultationSlots.saleId,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        clientBirthDate: sales.clientBirthDate,
        notes: sales.notes,
        saleDate: sales.saleDate,
        sellerName: users.displayName,
        sellerUsername: users.username,
      })
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(
          and(
            eq(consultationSlots.sold, true),
            gte(consultationSlots.consultationDate, todayStr() as any)
          )
        )
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );
    return rows;
  }),

  // Consultas realizadas (data < hoje, sold = true)
  listDone: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select({
        id: consultationSlots.id,
        consultationDate: consultationSlots.consultationDate,
        consultationTime: consultationSlots.consultationTime,
        saleId: consultationSlots.saleId,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        clientBirthDate: sales.clientBirthDate,
        notes: sales.notes,
        saleDate: sales.saleDate,
        sellerName: users.displayName,
        sellerUsername: users.username,
      })
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(eq(consultationSlots.sold, true))
        .orderBy(desc(consultationSlots.consultationDate), desc(consultationSlots.consultationTime))
    );
    // Filtra no JS para datas passadas (MySQL date comparison)
    return rows.filter(r => String(r.consultationDate) < todayStr());
  }),
});
