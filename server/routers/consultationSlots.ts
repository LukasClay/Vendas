import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, withRetry } from "../db";
import { consultationSlots, sales, users } from "../../drizzle/schema";
import { eq, and, gte, ne, asc, desc, lt } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converte a data do servidor (seja qual for o fuso) para o horário do Brasil.
 * Essencial para Railway/produção que roda em UTC.
 */
function getBrazilTime() {
  const now = new Date();
  const tzString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(tzString);
}

function todayStr() {
  const d = getBrazilTime();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Retorna o horário atual no formato "HH:MM" no fuso de São Paulo.
 * Usado para filtrar slots que já passaram no dia de hoje.
 */
function nowTimeStr() {
  const d = getBrazilTime();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

  // Monta datetime do slot no fuso de São Paulo (servidor roda em UTC no Railway)
  const slotDatetime = new Date(`${slot.consultationDate}T${slot.consultationTime}:00`);
  const now = getBrazilTime();
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
  cancelReason: cs.cancelReason,
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

  // Lista horários disponíveis (não vendidos, não cancelados, data+hora >= agora) — para o formulário de venda
  listAvailable: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const today = todayStr();
    const nowTime = nowTimeStr();

    const rows = await withRetry(() =>
      db.select()
        .from(consultationSlots)
        .where(
          and(
            eq(consultationSlots.sold, false),
            ne(consultationSlots.status, "cancelada"),
            gte(consultationSlots.consultationDate, today as any)
          )
        )
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );

    // Filtra no JS: remove slots de hoje cujo horário já passou
    return rows.filter(r => {
      if (r.consultationDate === today) {
        return r.consultationTime > nowTime;
      }
      return true;
    });
  }),

  // Lista todos os slots (ADM e consultora) — para gerenciamento (aba Gerenciar)
  listAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const today = todayStr();
    const nowTime = nowTimeStr();

    const rows = await withRetry(() =>
      db.select(slotFields(consultationSlots, sales, users))
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(ne(consultationSlots.status, "cancelada"))
        .orderBy(asc(consultationSlots.consultationDate), asc(consultationSlots.consultationTime))
    );

    // Oculta slots não vendidos cujo horário já passou (mantém vendidos para histórico)
    return rows
      .filter(r => {
        if (r.sold) return true; // vendidos sempre aparecem
        if (r.consultationDate === today) return r.consultationTime > nowTime;
        if (r.consultationDate < today) return false; // dias passados sem venda: oculta
        return true;
      })
      .map(r => ({ ...r, effectiveStatus: effectiveStatus(r as any) }));
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
    .input(z.object({
      id: z.number(),
      reason: z.string().optional(), // Motivo opcional do cancelamento
      requestRefund: z.boolean().optional(), // Se true, solicita reembolso ao admin
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "consultora") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Busca slot com dados da venda e do vendedor para a notificação
      const slotRows = await withRetry(() =>
        db.select({
          id: consultationSlots.id,
          status: consultationSlots.status,
          consultationDate: consultationSlots.consultationDate,
          consultationTime: consultationSlots.consultationTime,
          saleId: consultationSlots.saleId,
          clientName: sales.clientName,
          sellerName: users.displayName,
          sellerUsername: users.username,
        })
          .from(consultationSlots)
          .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
          .leftJoin(users, eq(sales.sellerId, users.id))
          .where(eq(consultationSlots.id, input.id))
          .limit(1)
      );
      const slot = slotRows[0];
      if (!slot) throw new TRPCError({ code: "NOT_FOUND", message: "Horário não encontrado." });
      if (slot.status === "cancelada") throw new TRPCError({ code: "BAD_REQUEST", message: "Consulta já está cancelada." });

      const refundFields = input.requestRefund ? {
        refundStatus: "pending" as const,
        refundRequestedAt: new Date(),
        refundRequestedBy: ctx.user.id,
      } : {};

      await withRetry(() =>
        db.update(consultationSlots)
          .set({
            status: "cancelada",
            cancelledBy: ctx.user.id,
            cancelledAt: new Date(),
            cancelReason: input.reason ?? null,
            ...refundFields,
          })
          .where(eq(consultationSlots.id, input.id))
      );

      // Se pediu reembolso, move a venda para a lixeira (soft delete)
      if (input.requestRefund && slot.saleId) {
        await withRetry(() =>
          db.update(sales)
            .set({ deletedAt: new Date() })
            .where(eq(sales.id, slot.saleId!))
        );
      }

      // Envia notificação ao dono do projeto informando o cancelamento
      if (slot.saleId) {
        const cancelledBy = ctx.user.displayName || ctx.user.name || ctx.user.username || "Usuário";
        const sellerInfo = slot.sellerName || slot.sellerUsername || "vendedor desconhecido";
        const clientInfo = slot.clientName || "cliente desconhecido";
        const dateInfo = `${slot.consultationDate} às ${slot.consultationTime}`;
        const reasonInfo = input.reason ? `\nMotivo: ${input.reason}` : "";
        await notifyOwner({
          title: `Consulta cancelada por ${cancelledBy}`,
          content: `A consulta de ${clientInfo} (vendida por ${sellerInfo}) agendada para ${dateInfo} foi cancelada por ${cancelledBy}.${reasonInfo}`,
        }).catch(() => {}); // Não bloqueia se a notificação falhar
      }

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

      // A3: impedir criação de slots em datas passadas (considerando fuso do Brasil)
      const today = todayStr();
      if (input.consultationDate < today) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível criar horários em datas passadas.",
        });
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

  // ─── Reembolsos ────────────────────────────────────────────────────────────────
  listRefunds: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];

    const rows = await withRetry(() =>
      db.select({
        id: consultationSlots.id,
        consultationDate: consultationSlots.consultationDate,
        consultationTime: consultationSlots.consultationTime,
        saleId: consultationSlots.saleId,
        refundStatus: consultationSlots.refundStatus,
        refundRequestedAt: consultationSlots.refundRequestedAt,
        refundRequestedBy: consultationSlots.refundRequestedBy,
        refundResolvedAt: consultationSlots.refundResolvedAt,
        cancelReason: consultationSlots.cancelReason,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        amount: sales.amount,
        company: sales.company,
        productName: sales.productName,
        sellerName: users.displayName,
        sellerUsername: users.username,
      })
        .from(consultationSlots)
        .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
        .leftJoin(users, eq(sales.sellerId, users.id))
        .where(ne(consultationSlots.refundStatus, "none"))
        .orderBy(desc(consultationSlots.refundRequestedAt))
    );
    return rows;
  }),

  approveRefund: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const slot = await withRetry(() =>
        db.select().from(consultationSlots).where(eq(consultationSlots.id, input.id)).limit(1)
      );
      if (!slot[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (slot[0].refundStatus !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Reembolso não está pendente." });

      // Aprova: venda permanece na lixeira (será excluída em 30 dias), slot liberado
      await withRetry(() =>
        db.update(consultationSlots)
          .set({
            refundStatus: "approved",
            refundResolvedAt: new Date(),
            refundResolvedBy: ctx.user.id,
            // Libera o slot para recadastro
            sold: false,
            saleId: null,
          })
          .where(eq(consultationSlots.id, input.id))
      );

      return { success: true };
    }),

  rejectRefund: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const slot = await withRetry(() =>
        db.select().from(consultationSlots).where(eq(consultationSlots.id, input.id)).limit(1)
      );
      if (!slot[0]) throw new TRPCError({ code: "NOT_FOUND" });
      if (slot[0].refundStatus !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Reembolso não está pendente." });

      // Rejeita: restaura a venda da lixeira, consulta volta para pendente
      if (slot[0].saleId) {
        await withRetry(() =>
          db.update(sales)
            .set({ deletedAt: null })
            .where(eq(sales.id, slot[0].saleId!))
        );
      }

      await withRetry(() =>
        db.update(consultationSlots)
          .set({
            refundStatus: "rejected",
            refundResolvedAt: new Date(),
            refundResolvedBy: ctx.user.id,
            // Restaura a consulta
            status: "pendente",
            cancelledBy: null,
            cancelledAt: null,
            cancelReason: null,
          })
          .where(eq(consultationSlots.id, input.id))
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
