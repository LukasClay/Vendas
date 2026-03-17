import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, withRetry } from "../db";
import { consultationSlots, sales, users } from "../../drizzle/schema";
import { eq, and, gte, ne, asc, desc, lt } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Determina o status efetivo de um slot com base na lógica híbrida:
 * - "cancelada" → se status = cancelada
 * - "realizada" → se status = pendente E o horário já passou há mais de 50 minutos
 * - "pendente" → caso contrário
 */
function effectiveStatus(slot: {
  status: string;
  consultationDate: string;
  consultationTime: string;
}): "pendente" | "realizada" | "cancelada" {
  if (slot.status === "cancelada") return "cancelada";

  // Monta datetime do slot: "2026-03-24T10:00:00"
  const slotDatetime = new Date(`${slot.consultationDate}T${slot.consultationTime}:00`);
  const now = new Date();
  const diffMs = now.getTime() - slotDatetime.getTime();
  const diffMinutes = diffMs / 60000;

  if (diffMinutes >= 50) return "realizada";
  return "pendente";
}

// Campos comuns retornados nas queries com JOIN
const slotFields = (cs: typeof consultationSlots, s: typeof sales, u: typeof users) => ({
  id: cs.id,
  consultationDate: cs.consultationDate,
  consultationTime: cs.consultationTime,
  sold: cs.sold,
  saleId: cs.saleId,
  status: cs.status,
  cancelledBy: cs.cancelledBy,
  cancelledAt: cs.cancelledAt,
  createdBy: cs.createdBy,
  createdAt: cs.createdAt,
  clientName: s.clientName,
  clientPhone: s.clientPhone,
  clientBirthDate: s.clientBirthDate,
  notes: s.notes,
  saleDate: s.saleDate,
  sellerName: u.displayName,
  sellerUsername: u.username,
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const consultationSlotsRouter = router({

  // Lista horários disponíveis (não vendidos, não cancelados, data >= hoje) — para o formulário de venda
  listAvailable: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select()
        .from(consultationSlots)
        .where(
          and(
            eq(consultationSlots.sold, false),
            ne(consultationSlots.status, "cancelada"),
            gte(consultationSlots.consultationDate, todayStr() as any)
          )
        )
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );
    return rows;
  }),

  // Lista todos os slots (ADM e consultora) — para gerenciamento (aba Gerenciar)
  listAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select(slotFields(consultationSlots, sales, users))
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(ne(consultationSlots.status, "cancelada"))
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );
    return rows.map(r => ({ ...r, effectiveStatus: effectiveStatus(r as any) }));
  }),

  // Consultas pendentes (sold = true, status != cancelada, horário não passou +50min)
  listPending: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select(slotFields(consultationSlots, sales, users))
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(
          and(
            eq(consultationSlots.sold, true),
            ne(consultationSlots.status, "cancelada")
          )
        )
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );

    // Filtra apenas os que ainda são "pendente" pela lógica de +50min
    return rows
      .filter(r => effectiveStatus(r as any) === "pendente")
      .map(r => ({ ...r, effectiveStatus: "pendente" as const }));
  }),

  // Consultas realizadas (sold = true, status != cancelada, horário passou +50min)
  listDone: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select(slotFields(consultationSlots, sales, users))
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(
          and(
            eq(consultationSlots.sold, true),
            ne(consultationSlots.status, "cancelada")
          )
        )
        .orderBy(desc(consultationSlots.consultationDate), desc(consultationSlots.consultationTime))
    );

    // Filtra apenas os que já são "realizada" pela lógica de +50min
    return rows
      .filter(r => effectiveStatus(r as any) === "realizada")
      .map(r => ({ ...r, effectiveStatus: "realizada" as const }));
  }),

  // Consultas canceladas (ADM e consultora podem ver, só ADM pode restaurar)
  listCancelled: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await withRetry(() =>
      db.select({
        ...slotFields(consultationSlots, sales, users),
        cancelledAt: consultationSlots.cancelledAt,
        cancelledBy: consultationSlots.cancelledBy,
      })
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(eq(consultationSlots.status, "cancelada"))
        .orderBy(desc(consultationSlots.cancelledAt))
    );
    return rows.map(r => ({ ...r, effectiveStatus: "cancelada" as const }));
  }),

  // Cancela um slot (ADM ou consultora)
  cancel: protectedProcedure
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
      if (slot[0].status === "cancelada") throw new TRPCError({ code: "BAD_REQUEST", message: "Consulta já está cancelada." });

      await withRetry(() =>
        db.update(consultationSlots)
          .set({
            status: "cancelada",
            cancelledBy: ctx.user.id,
            cancelledAt: new Date(),
          })
          .where(eq(consultationSlots.id, input.id))
      );
      return { success: true };
    }),

  // Restaura um slot cancelado para pendente (somente ADM)
  restore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem restaurar consultas canceladas." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const slot = await withRetry(() =>
        db.select().from(consultationSlots).where(eq(consultationSlots.id, input.id)).limit(1)
      );
      if (!slot[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Horário não encontrado." });
      if (slot[0].status !== "cancelada") throw new TRPCError({ code: "BAD_REQUEST", message: "Consulta não está cancelada." });

      await withRetry(() =>
        db.update(consultationSlots)
          .set({
            status: "pendente",
            cancelledBy: null,
            cancelledAt: null,
          })
          .where(eq(consultationSlots.id, input.id))
      );
      return { success: true };
    }),

  // Apaga permanentemente um slot cancelado, liberando o horário para recadastro (somente ADM)
  deleteCancelled: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem liberar horários cancelados." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const slot = await withRetry(() =>
        db.select().from(consultationSlots).where(eq(consultationSlots.id, input.id)).limit(1)
      );
      if (!slot[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Horário não encontrado." });
      if (slot[0].status !== "cancelada") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas horários cancelados podem ser liberados." });
      }

      await withRetry(() =>
        db.delete(consultationSlots).where(eq(consultationSlots.id, input.id))
      );
      return { success: true };
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

      // Verifica se já existe esse slot (mesmo que cancelado)
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
          status: "pendente",
          createdBy: ctx.user.id,
        })
      );
      return { success: true };
    }),

  // Remove slot (apenas se não vendido e não cancelado com venda)
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
      if (slot[0].sold) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível remover um horário já vendido. Use 'Cancelar' em vez disso." });

      await withRetry(() =>
        db.delete(consultationSlots).where(eq(consultationSlots.id, input.id))
      );
      return { success: true };
    }),
});
