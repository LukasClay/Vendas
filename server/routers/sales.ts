import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAuditLog, createSale, deleteSale, getSaleById, getSales, getSalesBySeller, updateSale, upsertClient, getDb, withRetry, getDeletedSales, restoreSale, permanentDeleteSale, cleanupExpiredTrash } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { storageDelete, storagePut } from "../storage";
import { nanoid } from "nanoid";
import { consultationSlots, sales, products } from "../../drizzle/schema";
import { eq, and, like, ne, desc, isNull } from "drizzle-orm";
import { getProductById } from "../db";
import { TYPES_WITH_PHOTOS } from "../../shared/const";

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
      // Fotos do cliente (apenas Individual)
      photo1Base64: z.string().max(8000000, "Foto 1 muito grande (Máximo ~5MB)").optional(),
      photo1Mime: z.string().optional(),
      photo2Base64: z.string().max(8000000, "Foto 2 muito grande (Máximo ~5MB)").optional(),
      photo2Mime: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // A1: vendedor/consultora não pode escolher a data — servidor força hoje (fuso Brasil)
      let saleDate = input.saleDate;
      if (ctx.user.role !== "admin") {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour12: false,
        }).formatToParts(now);
        const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
        saleDate = `${get("year")}-${get("month")}-${get("day")}`;
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

      // Upload fotos do cliente para S3 (apenas para tipos permitidos)
      let photo1Url: string | null = null;
      let photo1Key: string | null = null;
      let photo2Url: string | null = null;
      let photo2Key: string | null = null;

      const isPhotoType = (TYPES_WITH_PHOTOS as readonly string[]).includes(input.productCategory);

      if (isPhotoType) {
        if (input.photo1Base64 && input.photo1Mime) {
          const buf = Buffer.from(input.photo1Base64, "base64");
          if (buf.length > 5 * 1024 * 1024) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Foto 1 muito grande. Máximo 5MB." });
          }
          const ext = input.photo1Mime.includes("png") ? "png" : input.photo1Mime.includes("webp") ? "webp" : "jpg";
          const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
          const r = await storagePut(key, buf, input.photo1Mime);
          photo1Url = r.url;
          photo1Key = key;
        }
        if (input.photo2Base64 && input.photo2Mime) {
          const buf = Buffer.from(input.photo2Base64, "base64");
          if (buf.length > 5 * 1024 * 1024) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Foto 2 muito grande. Máximo 5MB." });
          }
          const ext = input.photo2Mime.includes("png") ? "png" : input.photo2Mime.includes("webp") ? "webp" : "jpg";
          const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
          const r = await storagePut(key, buf, input.photo2Mime);
          photo2Url = r.url;
          photo2Key = key;
        }
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
        // Passar strings diretamente para evitar conversão de timezone pelo PostgreSQL
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
        photo1Url,
        photo1Key,
        photo2Url,
        photo2Key,
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

      const sellerNameLog = ctx.user.displayName || ctx.user.name || ctx.user.username || "Usuário";
      await createAuditLog({ userId: ctx.user.id, userName: sellerNameLog, action: "Criou Venda", details: JSON.stringify({ saleId, clientName: input.clientName, productName: input.productName, amount: input.amount }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
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
      productCategory: z.enum(["individual", "promocao", "coletivo"]).optional(),
      saleDate: z.string().optional(),
      amount: z.number().positive().optional(),
      notes: z.string().optional(),
      sellerId: z.number().optional(),
      company: z.enum(["mundo_da_magia", "mundo_cigano"]).optional(),
      // Troca de comprovante
      attachmentBase64: z.string().max(8000000, "Arquivo muito grande (Máximo ~5MB)").optional(),
      attachmentMime: z.string().optional(),
      attachmentName: z.string().optional(),
      // Alteração do status do trabalho
      workStatus: z.enum(["para_escrever", "pendente", "feito"]).optional(),
      // Troca/remoção de fotos do cliente
      photo1Base64: z.string().max(8000000, "Foto 1 muito grande (Máximo ~5MB)").optional(),
      photo1Mime: z.string().optional(),
      removePhoto1: z.boolean().optional(),
      photo2Base64: z.string().max(8000000, "Foto 2 muito grande (Máximo ~5MB)").optional(),
      photo2Mime: z.string().optional(),
      removePhoto2: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const data: Record<string, unknown> = {};
      const shouldLoadExistingFiles =
        Boolean(fields.attachmentBase64 && fields.attachmentMime) ||
        Boolean(fields.removePhoto1) ||
        Boolean(fields.removePhoto2) ||
        Boolean(fields.photo1Base64 && fields.photo1Mime) ||
        Boolean(fields.photo2Base64 && fields.photo2Mime);
      const existingSale = shouldLoadExistingFiles ? await getSaleById(id) : undefined;
      const keysToDeleteAfterUpdate: string[] = [];
      const uploadedKeysToCleanup: string[] = [];
      const queueDeleteAfterUpdate = (key: string | null | undefined) => {
        if (!key) return;
        keysToDeleteAfterUpdate.push(key);
      };
      const safeDeleteAll = async (keys: string[]) => {
        await Promise.all(keys.map((key) => storageDelete(key).catch(() => undefined)));
      };

      if (fields.clientName !== undefined) data.clientName = fields.clientName;
      if (fields.clientBirthDate !== undefined) data.clientBirthDate = fields.clientBirthDate ?? null;
      if (fields.clientPhone !== undefined) data.clientPhone = fields.clientPhone;
      if (fields.productName !== undefined) data.productName = fields.productName;
      if (fields.productCategory !== undefined) data.productCategory = fields.productCategory;
      if (fields.saleDate !== undefined) data.saleDate = fields.saleDate;
      if (fields.amount !== undefined) data.amount = String(fields.amount);
      if (fields.notes !== undefined) data.notes = fields.notes;
      if (fields.sellerId !== undefined) data.sellerId = fields.sellerId;
      if (fields.company !== undefined) data.company = fields.company;

      // Atualização do status do trabalho com timestamps
      if (fields.workStatus !== undefined) {
        data.workStatus = fields.workStatus;
        if (fields.workStatus === "para_escrever") {
          data.writtenAt = null;
          data.completedAt = null;
        } else if (fields.workStatus === "pendente") {
          data.writtenAt = new Date();
          data.completedAt = null;
        } else if (fields.workStatus === "feito") {
          if (!data.writtenAt) data.writtenAt = new Date();
          data.completedAt = new Date();
        }
      }

      // Upload de novo comprovante se fornecido
      if (fields.attachmentBase64 && fields.attachmentMime) {
        const buffer = Buffer.from(fields.attachmentBase64, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo muito grande. Máximo 5MB." });
        }
        const ext = fields.attachmentMime.includes("pdf") ? "pdf" : "jpg";
        const key = `comprovantes/${ctx.user.id}/${nanoid()}.${ext}`;
        const uploaded = await storagePut(key, buffer, fields.attachmentMime);
        uploadedKeysToCleanup.push(key);
        data.attachmentUrl = uploaded.url;
        data.attachmentKey = key;
        data.attachmentMime = fields.attachmentMime;
        queueDeleteAfterUpdate(existingSale?.attachmentKey);
      }

      // Upload/remoção de foto 1
      if (fields.removePhoto1) {
        data.photo1Url = null;
        data.photo1Key = null;
        queueDeleteAfterUpdate(existingSale?.photo1Key);
      } else if (fields.photo1Base64 && fields.photo1Mime) {
        const buf = Buffer.from(fields.photo1Base64, "base64");
        if (buf.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Foto 1 muito grande. Máximo 5MB." });
        }
        const ext = fields.photo1Mime.includes("png") ? "png" : fields.photo1Mime.includes("webp") ? "webp" : "jpg";
        const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
        const r = await storagePut(key, buf, fields.photo1Mime);
        uploadedKeysToCleanup.push(key);
        data.photo1Url = r.url;
        data.photo1Key = key;
        queueDeleteAfterUpdate(existingSale?.photo1Key);
      }

      // Upload/remoção de foto 2
      if (fields.removePhoto2) {
        data.photo2Url = null;
        data.photo2Key = null;
        queueDeleteAfterUpdate(existingSale?.photo2Key);
      } else if (fields.photo2Base64 && fields.photo2Mime) {
        const buf = Buffer.from(fields.photo2Base64, "base64");
        if (buf.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Foto 2 muito grande. Máximo 5MB." });
        }
        const ext = fields.photo2Mime.includes("png") ? "png" : fields.photo2Mime.includes("webp") ? "webp" : "jpg";
        const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
        const r = await storagePut(key, buf, fields.photo2Mime);
        uploadedKeysToCleanup.push(key);
        data.photo2Url = r.url;
        data.photo2Key = key;
        queueDeleteAfterUpdate(existingSale?.photo2Key);
      }

      try {
        await updateSale(id, data as any);
      } catch (error) {
        await safeDeleteAll(uploadedKeysToCleanup);
        throw error;
      }

      await safeDeleteAll(keysToDeleteAfterUpdate);
      const userName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({ userId: ctx.user.id, userName, action: "Editou Venda", details: JSON.stringify({ saleId: id, changes: data }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
      return { success: true };
    }),

  // Admin exclui uma venda
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sale = await getSaleById(input.id);
      await deleteSale(input.id);
      const userName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({ userId: ctx.user.id, userName, action: "Excluiu Venda", details: JSON.stringify({ saleId: input.id, clientName: sale?.clientName, productName: sale?.productName }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
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
    .mutation(async ({ ctx, input }) => {
      await restoreSale(input.id);
      const userName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({ userId: ctx.user.id, userName, action: "Restaurou Venda", details: JSON.stringify({ saleId: input.id }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
      return { success: true };
    }),

  permanentDelete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await permanentDeleteSale(input.id);
      const userName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({ userId: ctx.user.id, userName, action: "Deletou Venda Permanentemente", details: JSON.stringify({ saleId: input.id }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
      return { success: true };
    }),

  cleanupTrash: adminProcedure.mutation(async () => {
    const count = await cleanupExpiredTrash(30);
    return { deletedCount: count };
  }),
});
