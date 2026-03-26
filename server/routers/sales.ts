import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createSale, deleteSale, getSaleById, getSales, getSalesBySeller, updateSale, upsertClient, getDb, withRetry, getDeletedSales, restoreSale, permanentDeleteSale, cleanupExpiredTrash } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { consultationSlots, sales, products } from "../../drizzle/schema";
import { eq, and, like, ne, desc, isNull } from "drizzle-orm";
import { getProductById } from "../db";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});

export const salesRouter = router({
  // Vendedor cria uma nova venda
  create: protectedProcedure
    .input(z.object({
      clientName: z.string().min(1, "Nome do cliente é obrigatório"),
      clientBirthDate: z.string().optional(),
      clientPhone: z.string().optional(),
      productName: z.string().min(1, "Nome do trabalho é obrigatório"),
      productId: z.number().optional(),
      productCategory: z.enum(["individual", "promocao", "coletivo"]).default("individual"),
      saleDate: z.string().min(1, "Data da venda é obrigatória"),
      amount: z.number().positive("Valor deve ser positivo"),
      notes: z.string().optional(),
      consultationSlotId: z.number().optional(), // Para Consulta Cartas
      // Attachment: base64 encoded file
      attachmentBase64: z.string().max(8000000, "Arquivo muito grande (Máximo ~5MB)").optional(),
      attachmentMime: z.string().optional(),
      attachmentName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // A1: vendedor/consultora não pode escolher a data — servidor força hoje (fuso Brasil)
      let saleDate = input.saleDate;
      if (ctx.user.role !== "admin") {
        const now = new Date();
        const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        saleDate = `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}-${String(br.getDate()).padStart(2, "0")}`;
      }

      let attachmentUrl: string | null = null;
      let attachmentKey: string | null = null;
      let attachmentMime: string | null = null;

      // Upload comprovante para S3 se fornecido
      if (input.attachmentBase64 && input.attachmentMime) {
        const buffer = Buffer.from(input.attachmentBase64, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo muito grande. Máximo 5MB." });
        }
        const ext = input.attachmentMime.includes("pdf") ? "pdf" : "jpg";
        const key = `comprovantes/${ctx.user.id}/${nanoid()}.${ext}`;
        const uploaded = await storagePut(key, buffer, input.attachmentMime);
        attachmentUrl = uploaded.url;
        attachmentKey = key;
        attachmentMime = input.attachmentMime;
      }

      // Upsert client
      let clientId: number | null = null;
      try {
        clientId = await upsertClient({
          fullName: input.clientName,
          phone: input.clientPhone ?? null,
          birthDate: (input.clientBirthDate ?? null) as any,
        });
      } catch (e) {
        // Non-critical: continue without clientId
      }

      // Regra de negócio: Consulta Cartas OBRIGA horário reservado
      if (input.productName === "Consulta Cartas" && !input.consultationSlotId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Consulta Cartas exige um horário reservado. Selecione um horário disponível." });
      }

      // Se for Consulta Cartas, valida e reserva o slot
      if (input.consultationSlotId) {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const slot = await withRetry(() =>
          db.select().from(consultationSlots)
            .where(and(eq(consultationSlots.id, input.consultationSlotId!), eq(consultationSlots.sold, false)))
            .limit(1)
        );
        if (!slot[0]) {
          throw new TRPCError({ code: "CONFLICT", message: "Este horário já foi reservado ou não existe. Atualize a página e tente novamente." });
        }
      }

      // Snapshot do nome do vendedor para preservar mesmo se o usuário for excluído
      const sellerName = ctx.user.displayName || ctx.user.name || ctx.user.username || `Usuário #${ctx.user.id}`;

      // Categoria vem diretamente do formulário (não mais do produto)
      const productCategory = input.productCategory;

      const saleId = await createSale({
        sellerId: ctx.user.id,
        sellerName,
        clientId: clientId ?? undefined,
        clientName: input.clientName,
        // Passar strings diretamente para evitar conversão de timezone pelo MySQL
        clientBirthDate: (input.clientBirthDate ?? null) as any,
        clientPhone: input.clientPhone ?? null,
        productId: input.productId ?? undefined,
        productName: input.productName,
        productCategory,
        saleDate: saleDate as any,
        amount: String(input.amount),
        notes: input.notes ?? null,
        attachmentUrl,
        attachmentKey,
        attachmentMime,
      });

      // MARCA O SLOT COMO VENDIDO DE FORMA ATÔMICA E SEGURA
      if (input.consultationSlotId) {
        const db = await getDb();
        if (db) {
          const updatedSlot = await withRetry(() =>
            db.update(consultationSlots)
              .set({ sold: true, saleId })
              .where(
                and(
                  eq(consultationSlots.id, input.consultationSlotId!),
                  eq(consultationSlots.sold, false) // Garante que não foi vendido nestes milissegundos
                )
              )
              .returning({ id: consultationSlots.id })
          );

          // Se retornou vazio, alguém pegou a vaga no mesmo milissegundo.
          if (updatedSlot.length === 0) {
            // Rollback (Hard Delete) da venda que acabamos de criar, pois não tem horário
            await withRetry(() => db.delete(sales).where(eq(sales.id, saleId)));
            throw new TRPCError({ 
              code: "CONFLICT", 
              message: "Este horário foi reservado por outro vendedor neste exato momento. A venda foi cancelada. Por favor, selecione outro horário." 
            });
          }
        }
      }

      return { success: true, saleId };
    }),

  // Vendedor vê suas próprias vendas
  myHistory: protectedProcedure.query(async ({ ctx }) => {
    return getSalesBySeller(ctx.user.id);
  }),

  // Admin vê todas as vendas com filtros
  list: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sellerId: z.number().optional(),
      productName: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      return getSales({
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        sellerId: input?.sellerId,
        productName: input?.productName,
        limit: input?.limit ?? 100,
        offset: input?.offset ?? 0,
      });
    }),

  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getSaleById(input.id);
    }),

  // Admin edita uma venda
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      clientName: z.string().min(1).optional(),
      clientBirthDate: z.string().optional(),
      clientPhone: z.string().optional(),
      productName: z.string().min(1).optional(),
      saleDate: z.string().optional(),
      amount: z.number().positive().optional(),
      notes: z.string().optional(),
      sellerId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const data: Record<string, unknown> = {};
      if (fields.clientName !== undefined) data.clientName = fields.clientName;
      if (fields.clientBirthDate !== undefined) data.clientBirthDate = fields.clientBirthDate ?? null;
      if (fields.clientPhone !== undefined) data.clientPhone = fields.clientPhone;
      if (fields.productName !== undefined) data.productName = fields.productName;
      if (fields.saleDate !== undefined) data.saleDate = fields.saleDate;
      if (fields.amount !== undefined) data.amount = String(fields.amount);
      if (fields.notes !== undefined) data.notes = fields.notes;
      if (fields.sellerId !== undefined) data.sellerId = fields.sellerId;
      await updateSale(id, data as any);
      return { success: true };
    }),

  // Admin exclui uma venda
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSale(input.id);
      return { success: true };
    }),

  // Exportar todas as vendas como CSV (ADM)
  exportCsv: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sellerId: z.number().optional(),
      productName: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const rows = await getSales({
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        sellerId: input?.sellerId,
        productName: input?.productName,
        limit: 5000,
        offset: 0,
      });

      if (rows.length >= 5000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A exportação retornou ${rows.length}+ registros. Refine os filtros de data ou vendedor para no máximo 5.000 registros por exportação.`,
        });
      }

      const header = ['ID', 'Data', 'Cliente', 'Nascimento', 'Telefone', 'Trabalho', 'Tipo', 'Vendedor', 'Valor (R$)', 'Status', 'Observação'];
      const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        header.join(','),
        ...rows.map((r: typeof rows[number]) => [
          r.id,
          r.saleDate,
          r.clientName,
          r.clientBirthDate ?? '',
          r.clientPhone ?? '',
          r.productName,
          r.productCategory ?? 'individual',
          r.sellerName ?? '',
          Number(r.amount).toFixed(2).replace('.', ','),
          r.workStatus,
          r.notes ?? '',
        ].map(escape).join(',')),
      ];
      return { csv: lines.join('\n'), total: rows.length };
    }),

  // Histórico de uma cliente (ADM) — trabalhos normais + consultas separadas
  clientHistory: adminProcedure
    .input(z.object({ clientName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Trabalhos normais (excluindo Consulta Cartas)
      const purchases = await withRetry(() =>
        db.select({
          id: sales.id,
          productName: sales.productName,
          saleDate: sales.saleDate,
          workStatus: sales.workStatus,
          amount: sales.amount,
        }).from(sales)
          .where(and(eq(sales.clientName, input.clientName), ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt)))
          .orderBy(desc(sales.saleDate))
          .limit(50)
      );

      // Consultas Cartas desta cliente (via consultation_slots) — correspondência exata
      const consultaRows = await withRetry(() =>
        db.select({
          id: consultationSlots.id,
          consultationDate: consultationSlots.consultationDate,
          consultationTime: consultationSlots.consultationTime,
          status: consultationSlots.status,
          saleDate: sales.saleDate,
        }).from(consultationSlots)
          .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
          .where(and(eq(sales.clientName, input.clientName), eq(consultationSlots.sold, true), isNull(sales.deletedAt)))
          .orderBy(desc(consultationSlots.consultationDate), desc(consultationSlots.consultationTime))
          .limit(20)
      );

      return {
        totalPurchases: purchases.length,
        totalConsultas: consultaRows.length,
        purchases,
        consultas: consultaRows,
      };
    }),

  // ─── Lixeira (Trash) ──────────────────────────────────────────────────────────
  listDeleted: adminProcedure.query(async () => {
    return getDeletedSales();
  }),

  restore: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await restoreSale(input.id);
      return { success: true };
    }),

  permanentDelete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await permanentDeleteSale(input.id);
      return { success: true };
    }),

  cleanupTrash: adminProcedure.mutation(async () => {
    const count = await cleanupExpiredTrash(30);
    return { deletedCount: count };
  }),
});
