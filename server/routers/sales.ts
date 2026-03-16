import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createSale, deleteSale, getSaleById, getSales, getSalesBySeller, updateSale, upsertClient } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

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
      saleDate: z.string().min(1, "Data da venda é obrigatória"),
      amount: z.number().positive("Valor deve ser positivo"),
      notes: z.string().optional(),
      // Attachment: base64 encoded file
      attachmentBase64: z.string().optional(),
      attachmentMime: z.string().optional(),
      attachmentName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
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
          birthDate: input.clientBirthDate ? new Date(input.clientBirthDate) : null,
        });
      } catch (e) {
        // Non-critical: continue without clientId
      }

      const saleId = await createSale({
        sellerId: ctx.user.id,
        clientId: clientId ?? undefined,
        clientName: input.clientName,
        clientBirthDate: input.clientBirthDate ? new Date(input.clientBirthDate) : null,
        clientPhone: input.clientPhone ?? null,
        productName: input.productName,
        saleDate: new Date(input.saleDate),
        amount: String(input.amount),
        notes: input.notes ?? null,
        attachmentUrl,
        attachmentKey,
        attachmentMime,
      });

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
      limit: z.number().optional(),
      offset: z.number().optional(),
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
      if (fields.clientBirthDate !== undefined) data.clientBirthDate = fields.clientBirthDate ? new Date(fields.clientBirthDate) : null;
      if (fields.clientPhone !== undefined) data.clientPhone = fields.clientPhone;
      if (fields.productName !== undefined) data.productName = fields.productName;
      if (fields.saleDate !== undefined) data.saleDate = new Date(fields.saleDate);
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
});
