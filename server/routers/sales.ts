import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAuditLog,
  createSale,
  deleteSale,
  getSaleById,
  getSales,
  getSalesBySeller,
  updateSale,
  upsertClient,
  getDb,
  withRetry,
  getDeletedSales,
  restoreSale,
  permanentDeleteSale,
  cleanupExpiredTrash,
} from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { emitSseEvent } from "../_core/sse";
import { storageDelete, storagePut } from "../storage";
import { nanoid } from "nanoid";
import {
  consultationSlots,
  sales,
  products,
  users,
} from "../../drizzle/schema";
import { eq, and, like, ne, desc, isNull } from "drizzle-orm";
import { getProductById } from "../db";
import {
  ATTACHMENT_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_ATTACHMENTS,
  MAX_TOTAL_PHOTOS,
  MAX_UPLOAD_BYTES_PER_REQUEST,
  PHOTO_MIME_TYPES,
  TYPES_WITH_PHOTOS,
} from "../../shared/const";
import {
  getStoredAttachmentExtras,
  getStoredPhotoExtras,
  toPublicSale,
} from "../saleMedia";

const extraAttachmentInput = z.object({
  base64: z.string().max(8000000, "Arquivo extra muito grande (Maximo ~5MB)"),
  mime: z.string(),
  name: z.string().optional(),
});

const extraPhotoInput = z.object({
  base64: z.string().max(8000000, "Foto extra muito grande (Maximo ~5MB)"),
  mime: z.string(),
  name: z.string().optional(),
});

type ExtraAttachmentInput = z.infer<typeof extraAttachmentInput>;
type ExtraPhotoInput = z.infer<typeof extraPhotoInput>;
type StoredMediaRecord = {
  id: string;
  url: string;
  key: string;
  mime: string | null;
  name?: string | null;
};

function assertMime(mime: string, allowed: readonly string[], message: string) {
  if (!allowed.includes(mime)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }
}

function decodeBase64File(base64: string, message: string): Buffer {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_FILE_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }
  return buffer;
}

function ensureRequestUploadBudget(buffers: Buffer[]) {
  const total = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  if (total > MAX_UPLOAD_BYTES_PER_REQUEST) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Muitos arquivos de uma vez. Salve em partes para manter o upload estavel.",
    });
  }
}

function sanitizeMediaExtrasForAudit(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map(item => {
    if (!item || typeof item !== "object") return item;
    const media = item as Record<string, unknown>;
    return {
      id: media.id,
      mime: media.mime ?? null,
      name: media.name ?? null,
    };
  });
}

function sanitizeSaleChangesForAudit(changes: Record<string, unknown>) {
  const safeChanges: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (key === "attachmentKey" || key === "photo1Key" || key === "photo2Key") {
      continue;
    }
    if (key === "attachmentExtras" || key === "photoExtras") {
      safeChanges[key] = sanitizeMediaExtrasForAudit(value);
      continue;
    }
    safeChanges[key] = value;
  }
  return safeChanges;
}

function getAttachmentExtension(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function getPhotoExtension(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function uploadExtraMedia(args: {
  userId: number;
  folder: "comprovantes" | "fotos";
  mime: string;
  buffer: Buffer;
  name?: string;
  uploadedKeysToCleanup: string[];
}): Promise<StoredMediaRecord> {
  const id = nanoid();
  const ext =
    args.folder === "comprovantes"
      ? getAttachmentExtension(args.mime)
      : getPhotoExtension(args.mime);
  const key = `${args.folder}/${args.userId}/${id}.${ext}`;
  const uploaded = await storagePut(key, args.buffer, args.mime);
  args.uploadedKeysToCleanup.push(key);
  return {
    id,
    url: uploaded.url,
    key,
    mime: args.mime,
    name: args.name ?? null,
  };
}

export const salesRouter = router({
  // Vendedor cria uma nova venda
  create: protectedProcedure
    .input(
      z
        .object({
          clientName: z.string().min(1, "Nome do cliente é obrigatório"),
          clientBirthDate: z.string().optional(),
          clientPhone: z.string().optional(),
          productName: z.string().min(1, "Nome do trabalho é obrigatório"),
          productId: z.number().optional(),
          productCategory: z
            .enum(["individual", "promocao", "coletivo"])
            .default("individual"),
          saleDate: z.string().min(1, "Data da venda é obrigatória"),
          amount: z.number().positive("Valor deve ser positivo"),
          notes: z.string().optional(),
          consultationSlotId: z.number().optional(), // Para Consulta Cartas
          // Attachment: base64 encoded file
          attachmentBase64: z
            .string()
            .max(8000000, "Arquivo muito grande (Máximo ~5MB)")
            .optional(),
          attachmentMime: z.string().optional(),
          attachmentName: z.string().optional(),
          // Fotos do cliente (apenas Individual)
          photo1Base64: z
            .string()
            .max(8000000, "Foto 1 muito grande (Máximo ~5MB)")
            .optional(),
          photo1Mime: z.string().optional(),
          photo2Base64: z
            .string()
            .max(8000000, "Foto 2 muito grande (Máximo ~5MB)")
            .optional(),
          photo2Mime: z.string().optional(),
        })
        .strict()
    )
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
        const get = (type: string) =>
          parts.find(p => p.type === type)?.value ?? "0";
        saleDate = `${get("year")}-${get("month")}-${get("day")}`;
      }

      let attachmentUrl: string | null = null;
      let attachmentKey: string | null = null;
      let attachmentMime: string | null = null;

      // Upload comprovante para S3 se fornecido
      if (input.attachmentBase64 && input.attachmentMime) {
        const buffer = Buffer.from(input.attachmentBase64, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Arquivo muito grande. Máximo 5MB.",
          });
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

      const isPhotoType =
        (TYPES_WITH_PHOTOS as readonly string[]).includes(
          input.productCategory
        ) && input.productName !== "Consulta Cartas";

      if (
        input.productName === "Consulta Cartas" &&
        (Boolean(input.photo1Base64 && input.photo1Mime) ||
          Boolean(input.photo2Base64 && input.photo2Mime))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Consulta Cartas não permite fotos do cliente.",
        });
      }

      if (isPhotoType) {
        if (input.photo1Base64 && input.photo1Mime) {
          const buf = Buffer.from(input.photo1Base64, "base64");
          if (buf.length > 5 * 1024 * 1024) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Foto 1 muito grande. Máximo 5MB.",
            });
          }
          const ext = input.photo1Mime.includes("png")
            ? "png"
            : input.photo1Mime.includes("webp")
              ? "webp"
              : "jpg";
          const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
          const r = await storagePut(key, buf, input.photo1Mime);
          photo1Url = r.url;
          photo1Key = key;
        }
        if (input.photo2Base64 && input.photo2Mime) {
          const buf = Buffer.from(input.photo2Base64, "base64");
          if (buf.length > 5 * 1024 * 1024) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Foto 2 muito grande. Máximo 5MB.",
            });
          }
          const ext = input.photo2Mime.includes("png")
            ? "png"
            : input.photo2Mime.includes("webp")
              ? "webp"
              : "jpg";
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
      if (
        input.productName === "Consulta Cartas" &&
        !input.consultationSlotId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Consulta Cartas exige um horário reservado. Selecione um horário disponível.",
        });
      }

      // Se for Consulta Cartas, valida e reserva o slot
      if (input.consultationSlotId) {
        const db = await getDb();
        if (!db)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Banco indisponível.",
          });
        const slot = await withRetry(() =>
          db
            .select()
            .from(consultationSlots)
            .where(
              and(
                eq(consultationSlots.id, input.consultationSlotId!),
                eq(consultationSlots.sold, false)
              )
            )
            .limit(1)
        );
        if (!slot[0]) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este horário já foi reservado ou não existe. Atualize a página e tente novamente.",
          });
        }
      }

      // Snapshot do nome do vendedor para preservar mesmo se o usuário for excluído
      const sellerName =
        ctx.user.displayName ||
        ctx.user.name ||
        ctx.user.username ||
        `Usuário #${ctx.user.id}`;

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
            db
              .update(consultationSlots)
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
              message:
                "Este horário foi reservado por outro vendedor neste exato momento. A venda foi cancelada. Por favor, selecione outro horário.",
            });
          }
        }
      }

      const sellerNameLog =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Usuário";
      await createAuditLog({
        userId: ctx.user.id,
        userName: sellerNameLog,
        action: "Criou Venda",
        details: JSON.stringify({
          saleId,
          clientName: input.clientName,
          productName: input.productName,
          amount: input.amount,
        }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      emitSseEvent("sales");
      return { success: true, saleId };
    }),

  // Vendedor vê suas próprias vendas — apenas do mês corrente (fuso de Brasília).
  // Ao virar o mês (00h Brasília do dia 1º), totais e lista zeram automaticamente.
  // Vendas de meses anteriores continuam no banco e visíveis ao ADM.
  myHistory: protectedProcedure.query(async ({ ctx }) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) =>
      Number(parts.find(p => p.type === t)?.value ?? 0);
    const firstOfMonth = new Date(get("year"), get("month") - 1, 1);
    const rows = await getSalesBySeller(ctx.user.id, firstOfMonth);
    return rows.map(sale => toPublicSale(sale, { includeExtraMedia: false }));
  }),

  // Admin vê todas as vendas com filtros
  list: adminProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          sellerId: z.number().optional(),
          productName: z.string().optional(),
          limit: z.number().min(1).max(200).default(100),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const rows = await getSales({
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        sellerId: input?.sellerId,
        productName: input?.productName,
        limit: input?.limit ?? 100,
        offset: input?.offset ?? 0,
      });
      return rows.map(row => ({
        ...row,
        sale: toPublicSale(row.sale),
      }));
    }),

  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const sale = await getSaleById(input.id);
      return sale ? toPublicSale(sale) : undefined;
    }),

  // Admin edita uma venda
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        clientName: z.string().min(1).optional(),
        clientBirthDate: z.string().optional(),
        clientPhone: z.string().optional(),
        productName: z.string().min(1).optional(),
        productCategory: z
          .enum(["individual", "promocao", "coletivo"])
          .optional(),
        saleDate: z.string().optional(),
        amount: z.number().positive().optional(),
        notes: z.string().optional(),
        sellerId: z.number().optional(),
        company: z.enum(["mundo_da_magia", "mundo_cigano"]).optional(),
        // Troca de comprovante
        attachmentBase64: z
          .string()
          .max(8000000, "Arquivo muito grande (Máximo ~5MB)")
          .optional(),
        attachmentMime: z.string().optional(),
        attachmentName: z.string().optional(),
        extraAttachments: z.array(extraAttachmentInput).max(5).optional(),
        removeAttachmentIds: z.array(z.string().min(1)).max(5).optional(),
        // Alteração do status do trabalho
        workStatus: z.enum(["para_escrever", "pendente", "feito"]).optional(),
        // Troca/remoção de fotos do cliente
        photo1Base64: z
          .string()
          .max(8000000, "Foto 1 muito grande (Máximo ~5MB)")
          .optional(),
        photo1Mime: z.string().optional(),
        removePhoto1: z.boolean().optional(),
        photo2Base64: z
          .string()
          .max(8000000, "Foto 2 muito grande (Máximo ~5MB)")
          .optional(),
        photo2Mime: z.string().optional(),
        removePhoto2: z.boolean().optional(),
        extraPhotos: z.array(extraPhotoInput).max(6).optional(),
        removeExtraPhotoIds: z.array(z.string().min(1)).max(6).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const data: Record<string, unknown> = {};
      const existingSale = await getSaleById(id);
      if (!existingSale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Venda não encontrada.",
        });
      }
      const keysToDeleteAfterUpdate: string[] = [];
      const uploadedKeysToCleanup: string[] = [];
      const queueDeleteAfterUpdate = (key: string | null | undefined) => {
        if (!key) return;
        keysToDeleteAfterUpdate.push(key);
      };
      const safeDeleteAll = async (keys: string[]) => {
        await Promise.all(
          keys.map(key => storageDelete(key).catch(() => undefined))
        );
      };

      try {
        if (fields.clientName !== undefined)
          data.clientName = fields.clientName;
        if (fields.clientBirthDate !== undefined)
          data.clientBirthDate = fields.clientBirthDate ?? null;
        if (fields.clientPhone !== undefined)
          data.clientPhone = fields.clientPhone;
        if (fields.productName !== undefined)
          data.productName = fields.productName;
        if (fields.productCategory !== undefined)
          data.productCategory = fields.productCategory;
        if (fields.saleDate !== undefined) data.saleDate = fields.saleDate;
        if (fields.amount !== undefined) data.amount = String(fields.amount);
        if (fields.notes !== undefined) data.notes = fields.notes;
        if (fields.sellerId !== undefined) {
          const db = await getDb();
          if (!db) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Banco indisponível.",
            });
          }

          const sellerRows = await withRetry(() =>
            db
              .select({
                id: users.id,
                name: users.name,
                displayName: users.displayName,
                username: users.username,
                email: users.email,
              })
              .from(users)
              .where(
                and(eq(users.id, fields.sellerId!), isNull(users.deletedAt))
              )
              .limit(1)
          );
          const nextSeller = sellerRows[0];
          if (!nextSeller) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Vendedor não encontrado.",
            });
          }

          data.sellerId = fields.sellerId;
          data.sellerName =
            nextSeller.displayName ||
            nextSeller.name ||
            nextSeller.username ||
            nextSeller.email ||
            `Usuário #${fields.sellerId}`;
        }
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
            if (!existingSale?.writtenAt) data.writtenAt = new Date();
            data.completedAt = new Date();
          }
        }

        const nextProductName = fields.productName ?? existingSale?.productName;
        const canUploadPhotos = nextProductName !== "Consulta Cartas";
        const existingAttachmentExtras = getStoredAttachmentExtras(
          existingSale ?? {}
        );
        const existingPhotoExtras = getStoredPhotoExtras(existingSale ?? {});
        const uploadBuffers: Buffer[] = [];
        let attachmentBuffer: Buffer | null = null;
        let photo1Buffer: Buffer | null = null;
        let photo2Buffer: Buffer | null = null;
        const extraAttachmentBuffers = (fields.extraAttachments ?? []).map(
          (file: ExtraAttachmentInput) => {
            assertMime(
              file.mime,
              ATTACHMENT_MIME_TYPES,
              "Formato invalido. Use JPG, PNG, WEBP ou PDF."
            );
            const buffer = decodeBase64File(
              file.base64,
              "Arquivo extra muito grande. Maximo 5MB."
            );
            uploadBuffers.push(buffer);
            return { file, buffer };
          }
        );
        const extraPhotoBuffers = (fields.extraPhotos ?? []).map(
          (file: ExtraPhotoInput) => {
            assertMime(
              file.mime,
              PHOTO_MIME_TYPES,
              "Formato invalido. Use JPG, PNG ou WEBP."
            );
            const buffer = decodeBase64File(
              file.base64,
              "Foto extra muito grande. Maximo 5MB."
            );
            uploadBuffers.push(buffer);
            return { file, buffer };
          }
        );

        if (
          !canUploadPhotos &&
          (Boolean(fields.photo1Base64 && fields.photo1Mime) ||
            Boolean(fields.photo2Base64 && fields.photo2Mime) ||
            Boolean(fields.extraPhotos?.length))
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Consulta Cartas não permite fotos do cliente.",
          });
        }

        if (fields.attachmentBase64 && fields.attachmentMime) {
          assertMime(
            fields.attachmentMime,
            ATTACHMENT_MIME_TYPES,
            "Formato invalido. Use JPG, PNG, WEBP ou PDF."
          );
          attachmentBuffer = decodeBase64File(
            fields.attachmentBase64,
            "Arquivo muito grande. Maximo 5MB."
          );
          uploadBuffers.push(attachmentBuffer);
        }

        if (fields.photo1Base64 && fields.photo1Mime) {
          assertMime(
            fields.photo1Mime,
            PHOTO_MIME_TYPES,
            "Formato invalido. Use JPG, PNG ou WEBP."
          );
          photo1Buffer = decodeBase64File(
            fields.photo1Base64,
            "Foto 1 muito grande. Maximo 5MB."
          );
          uploadBuffers.push(photo1Buffer);
        }

        if (fields.photo2Base64 && fields.photo2Mime) {
          assertMime(
            fields.photo2Mime,
            PHOTO_MIME_TYPES,
            "Formato invalido. Use JPG, PNG ou WEBP."
          );
          photo2Buffer = decodeBase64File(
            fields.photo2Base64,
            "Foto 2 muito grande. Maximo 5MB."
          );
          uploadBuffers.push(photo2Buffer);
        }

        ensureRequestUploadBudget(uploadBuffers);

        const removedAttachmentIds = new Set(fields.removeAttachmentIds ?? []);
        let nextAttachmentExtras = existingAttachmentExtras.filter(
          attachment => {
            if (!removedAttachmentIds.has(attachment.id)) return true;
            queueDeleteAfterUpdate(attachment.key);
            return false;
          }
        );

        const removedExtraPhotoIds = new Set(fields.removeExtraPhotoIds ?? []);
        let nextPhotoExtras = existingPhotoExtras.filter(photo => {
          if (!removedExtraPhotoIds.has(photo.id)) return true;
          queueDeleteAfterUpdate(photo.key);
          return false;
        });

        const nextAttachmentTotal =
          (existingSale?.attachmentUrl || attachmentBuffer ? 1 : 0) +
          nextAttachmentExtras.length +
          extraAttachmentBuffers.length;
        if (nextAttachmentTotal > MAX_TOTAL_ATTACHMENTS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `O ADM pode manter no maximo ${MAX_TOTAL_ATTACHMENTS} comprovantes por venda.`,
          });
        }

        const nextPhotoTotal =
          (!fields.removePhoto1 && (existingSale?.photo1Url || photo1Buffer)
            ? 1
            : 0) +
          (!fields.removePhoto2 && (existingSale?.photo2Url || photo2Buffer)
            ? 1
            : 0) +
          nextPhotoExtras.length +
          extraPhotoBuffers.length;
        if (nextPhotoTotal > MAX_TOTAL_PHOTOS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `O ADM pode manter no maximo ${MAX_TOTAL_PHOTOS} fotos por venda.`,
          });
        }

        // Upload de novo comprovante se fornecido
        if (attachmentBuffer && fields.attachmentMime) {
          const ext = getAttachmentExtension(fields.attachmentMime);
          const key = `comprovantes/${ctx.user.id}/${nanoid()}.${ext}`;
          const uploaded = await storagePut(
            key,
            attachmentBuffer,
            fields.attachmentMime
          );
          uploadedKeysToCleanup.push(key);
          data.attachmentUrl = uploaded.url;
          data.attachmentKey = key;
          data.attachmentMime = fields.attachmentMime;
          queueDeleteAfterUpdate(existingSale?.attachmentKey);
        }

        if (extraAttachmentBuffers.length > 0) {
          const uploadedExtras: StoredMediaRecord[] = [];
          for (const entry of extraAttachmentBuffers) {
            uploadedExtras.push(
              await uploadExtraMedia({
                userId: ctx.user.id,
                folder: "comprovantes",
                mime: entry.file.mime,
                buffer: entry.buffer,
                name: entry.file.name,
                uploadedKeysToCleanup,
              })
            );
          }
          nextAttachmentExtras = [...nextAttachmentExtras, ...uploadedExtras];
        }

        if (
          fields.extraAttachments?.length ||
          fields.removeAttachmentIds?.length
        ) {
          data.attachmentExtras = nextAttachmentExtras;
        }

        // Upload/remoção de foto 1
        if (fields.removePhoto1) {
          data.photo1Url = null;
          data.photo1Key = null;
          queueDeleteAfterUpdate(existingSale?.photo1Key);
        } else if (photo1Buffer && fields.photo1Mime) {
          const ext = getPhotoExtension(fields.photo1Mime);
          const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
          const r = await storagePut(key, photo1Buffer, fields.photo1Mime);
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
        } else if (photo2Buffer && fields.photo2Mime) {
          const ext = getPhotoExtension(fields.photo2Mime);
          const key = `fotos/${ctx.user.id}/${nanoid()}.${ext}`;
          const r = await storagePut(key, photo2Buffer, fields.photo2Mime);
          uploadedKeysToCleanup.push(key);
          data.photo2Url = r.url;
          data.photo2Key = key;
          queueDeleteAfterUpdate(existingSale?.photo2Key);
        }

        if (extraPhotoBuffers.length > 0) {
          const uploadedExtras: StoredMediaRecord[] = [];
          for (const entry of extraPhotoBuffers) {
            uploadedExtras.push(
              await uploadExtraMedia({
                userId: ctx.user.id,
                folder: "fotos",
                mime: entry.file.mime,
                buffer: entry.buffer,
                name: entry.file.name,
                uploadedKeysToCleanup,
              })
            );
          }
          nextPhotoExtras = [...nextPhotoExtras, ...uploadedExtras];
        }

        if (fields.extraPhotos?.length || fields.removeExtraPhotoIds?.length) {
          data.photoExtras = nextPhotoExtras;
        }

        await updateSale(id, data as any);
      } catch (error) {
        await safeDeleteAll(uploadedKeysToCleanup);
        throw error;
      }

      await safeDeleteAll(keysToDeleteAfterUpdate);
      emitSseEvent("sales");
      const userName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName,
        action: "Editou Venda",
        details: JSON.stringify({
          saleId: id,
          changes: sanitizeSaleChangesForAudit(data),
        }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { success: true };
    }),

  // Admin exclui uma venda
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sale = await getSaleById(input.id);
      await deleteSale(input.id);
      emitSseEvent("sales");
      const userName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName,
        action: "Excluiu Venda",
        details: JSON.stringify({
          saleId: input.id,
          clientName: sale?.clientName,
          productName: sale?.productName,
        }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { success: true };
    }),

  // Exportar todas as vendas como CSV (ADM)
  exportCsv: adminProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          sellerId: z.number().optional(),
          productName: z.string().optional(),
        })
        .optional()
    )
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

      const header = [
        "ID",
        "Data",
        "Cliente",
        "Nascimento",
        "Telefone",
        "Trabalho",
        "Tipo",
        "Vendedor",
        "Valor (R$)",
        "Status",
        "Observação",
      ];
      const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };
      const lines = [
        header.join(","),
        ...rows.map(({ sale, seller }) =>
          [
            sale.id,
            sale.saleDate,
            sale.clientName,
            sale.clientBirthDate ?? "",
            sale.clientPhone ?? "",
            sale.productName,
            sale.productCategory ?? "individual",
            seller?.name ?? sale.sellerName ?? "",
            Number(sale.amount).toFixed(2).replace(".", ","),
            sale.workStatus,
            sale.notes ?? "",
          ]
            .map(escape)
            .join(",")
        ),
      ];
      return { csv: lines.join("\n"), total: rows.length };
    }),

  // Histórico de uma cliente (ADM) — trabalhos normais + consultas separadas
  clientHistory: adminProcedure
    .input(z.object({ clientName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Trabalhos normais (excluindo Consulta Cartas)
      const purchases = await withRetry(() =>
        db
          .select({
            id: sales.id,
            productName: sales.productName,
            saleDate: sales.saleDate,
            workStatus: sales.workStatus,
            amount: sales.amount,
          })
          .from(sales)
          .where(
            and(
              eq(sales.clientName, input.clientName),
              ne(sales.productName, "Consulta Cartas"),
              isNull(sales.deletedAt)
            )
          )
          .orderBy(desc(sales.saleDate))
          .limit(50)
      );

      // Consultas Cartas desta cliente (via consultation_slots) — correspondência exata
      const consultaRows = await withRetry(() =>
        db
          .select({
            id: consultationSlots.id,
            consultationDate: consultationSlots.consultationDate,
            consultationTime: consultationSlots.consultationTime,
            status: consultationSlots.status,
            saleDate: sales.saleDate,
          })
          .from(consultationSlots)
          .leftJoin(sales, eq(consultationSlots.saleId, sales.id))
          .where(
            and(
              eq(sales.clientName, input.clientName),
              eq(consultationSlots.sold, true),
              isNull(sales.deletedAt)
            )
          )
          .orderBy(
            desc(consultationSlots.consultationDate),
            desc(consultationSlots.consultationTime)
          )
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
      emitSseEvent("sales");
      const userName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName,
        action: "Restaurou Venda",
        details: JSON.stringify({ saleId: input.id }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { success: true };
    }),

  permanentDelete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await permanentDeleteSale(input.id);
      emitSseEvent("sales");
      const userName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName,
        action: "Deletou Venda Permanentemente",
        details: JSON.stringify({ saleId: input.id }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      return { success: true };
    }),

  cleanupTrash: adminProcedure.mutation(async () => {
    const count = await cleanupExpiredTrash(30);
    return { deletedCount: count };
  }),
});
