import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "../_core/context";
import { getDb, getSaleById } from "../db";
import { sales, users, consultationSlots } from "../../drizzle/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { emitSseEvent } from "../_core/sse";
import { getSaleUrgency } from "../../shared/businessDays";
import type { ProductCategory } from "../../shared/types";
import { createAuditLog } from "../db";
import {
  findSalePhotoForDownload,
  getSaleClientPhotos,
  LEGACY_PHOTO_IDS,
} from "../saleMedia";

// Apenas consultoras e admins podem acessar estes endpoints
const consultoraProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "consultora" && ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito à consultora.",
    });
  }
  return next({ ctx });
});

function assertConsultoraDownloadAccess(
  user: TrpcContext["user"]
): asserts user is NonNullable<TrpcContext["user"]> {
  if (!user || (user.role !== "consultora" && user.role !== "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso restrito à consultora.",
    });
  }
}

function getPhotoFileExtension(key: string): string {
  const match = key.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? "";
}

export async function resolveConsultoraPhotoDownload(
  user: TrpcContext["user"],
  input: { saleId: number; photoId: string }
) {
  assertConsultoraDownloadAccess(user);

  const sale = await getSaleById(input.saleId);
  if (!sale) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Venda não encontrada.",
    });
  }

  const photo = findSalePhotoForDownload(sale, input.photoId);
  if (!photo) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Foto não encontrada.",
    });
  }

  return {
    key: photo.key,
    filename: `foto-cliente-${sale.id}-${
      input.photoId === LEGACY_PHOTO_IDS[1]
        ? "1"
        : input.photoId === LEGACY_PHOTO_IDS[2]
          ? "2"
          : input.photoId
    }${getPhotoFileExtension(photo.key)}`,
  };
}

export const consultoraRouter = router({
  statusCounts: consultoraProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // GROUP BY no banco é muito mais eficiente que SELECT * + contar em JS
    const rows = await db
      .select({ workStatus: sales.workStatus, total: count() })
      .from(sales)
      .where(
        and(ne(sales.productName, "Consulta Cartas"), isNull(sales.deletedAt))
      )
      .groupBy(sales.workStatus);
    const counts = { para_escrever: 0, pendente: 0, feito: 0 };
    for (const row of rows) {
      if (row.workStatus in counts)
        counts[row.workStatus as keyof typeof counts] = Number(row.total);
    }
    return counts;
  }),

  // Aba 1: Para Escrever
  toWrite: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [
        eq(sales.workStatus, "para_escrever"),
        ne(sales.productName, "Consulta Cartas"),
        isNull(sales.deletedAt),
      ];
      if (input?.search) {
        const escaped = input.search.replace(/[%_\\]/g, "\\$&");
        const like = "%" + escaped + "%";
        const fields =
          ctx.user.role === "admin"
            ? [
                sql`${sales.productName} ILIKE ${like} ESCAPE '\\'`,
                sql`${sales.clientName} ILIKE ${like} ESCAPE '\\'`,
                sql`${sales.notes} ILIKE ${like} ESCAPE '\\'`,
              ]
            : [
                sql`${sales.productName} LIKE ${like} ESCAPE '\\'`,
                sql`${sales.clientName} LIKE ${like} ESCAPE '\\'`,
              ];
        conditions.push(or(...fields)!);
      }

      const rows = await db
        .select({
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
          photo1Url: sales.photo1Url,
          photo2Url: sales.photo2Url,
          photoExtras: sales.photoExtras,
        })
        .from(sales)
        .where(and(...conditions))
        .orderBy(asc(sales.saleDate), asc(sales.createdAt))
        .limit(500);

      return rows.map(s => {
        const category: ProductCategory = s.productCategory ?? "individual";
        const urgency = getSaleUrgency(s.saleDate, category);
        return {
          id: s.id,
          clientName: s.clientName,
          clientBirthDate: s.clientBirthDate,
          clientPhone: s.clientPhone,
          productName: s.productName,
          productCategory: category,
          saleDate: s.saleDate,
          notes: s.notes,
          createdAt: s.createdAt,
          sellerName: s.sellerName,
          photo1Url: s.photo1Url ?? null,
          photo2Url: s.photo2Url ?? null,
          clientPhotos: getSaleClientPhotos(s),
          ...urgency,
        };
      });
    }),

  // Aba 2: Pendentes (com prazo e urgência)
  pending: consultoraProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [
        eq(sales.workStatus, "pendente"),
        ne(sales.productName, "Consulta Cartas"),
        isNull(sales.deletedAt),
      ];
      if (input?.search) {
        const escaped = input.search.replace(/[%_\\]/g, "\\$&");
        const like = "%" + escaped + "%";
        const fields =
          ctx.user.role === "admin"
            ? [
                sql`${sales.productName} ILIKE ${like} ESCAPE '\\'`,
                sql`${sales.clientName} ILIKE ${like} ESCAPE '\\'`,
                sql`${sales.notes} ILIKE ${like} ESCAPE '\\'`,
              ]
            : [
                sql`${sales.productName} LIKE ${like} ESCAPE '\\'`,
                sql`${sales.clientName} LIKE ${like} ESCAPE '\\'`,
              ];
        conditions.push(or(...fields)!);
      }

      const rows = await db
        .select({
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
          photo1Url: sales.photo1Url,
          photo2Url: sales.photo2Url,
          photoExtras: sales.photoExtras,
        })
        .from(sales)
        .where(and(...conditions))
        .orderBy(asc(sales.saleDate))
        .limit(500);

      return rows
        .map(s => {
          const category: ProductCategory = s.productCategory ?? "individual";
          const urgency = getSaleUrgency(s.saleDate, category);
          return {
            id: s.id,
            clientName: s.clientName,
            clientBirthDate: s.clientBirthDate,
            clientPhone: s.clientPhone,
            productName: s.productName,
            productCategory: category,
            saleDate: s.saleDate,
            notes: s.notes,
            writtenAt: s.writtenAt,
            sellerName: s.sellerName,
            photo1Url: s.photo1Url ?? null,
            photo2Url: s.photo2Url ?? null,
            clientPhotos: getSaleClientPhotos(s),
            ...urgency,
          };
        })
        .sort((a: any, b: any) => b.urgencyScore - a.urgencyScore);
    }),

  // Aba 3: Feitos — filtrado por mês/ano (padrão: mês atual)
  done: consultoraProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          month: z.number().int().min(1).max(12).optional(),
          year: z.number().int().min(2020).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      const month = input?.month ?? now.getMonth() + 1;
      const year = input?.year ?? now.getFullYear();
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 1);

      const conditions = [
        eq(sales.workStatus, "feito"),
        ne(sales.productName, "Consulta Cartas"),
        isNull(sales.deletedAt),
        gte(sales.completedAt, periodStart),
        lt(sales.completedAt, periodEnd),
      ];
      if (input?.search) {
        const escaped = input.search.replace(/[%_\\]/g, "\\$&");
        const like = "%" + escaped + "%";
        const fields =
          ctx.user.role === "admin"
            ? [
                sql`${sales.productName} ILIKE ${like} ESCAPE '\\'`,
                sql`${sales.clientName} ILIKE ${like} ESCAPE '\\'`,
                sql`${sales.notes} ILIKE ${like} ESCAPE '\\'`,
              ]
            : [
                sql`${sales.productName} LIKE ${like} ESCAPE '\\'`,
                sql`${sales.clientName} LIKE ${like} ESCAPE '\\'`,
              ];
        conditions.push(or(...fields)!);
      }

      const rows = await db
        .select({
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
          photo1Url: sales.photo1Url,
          photo2Url: sales.photo2Url,
          photoExtras: sales.photoExtras,
        })
        .from(sales)
        .where(and(...conditions))
        .orderBy(desc(sales.completedAt))
        .limit(500);

      return rows.map(s => ({
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
        photo1Url: s.photo1Url ?? null,
        photo2Url: s.photo2Url ?? null,
        clientPhotos: getSaleClientPhotos(s),
      }));
    }),

  // Meses disponíveis na aba Feitos (para montar o seletor)
  doneMonths: consultoraProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select({
        month: sql<number>`EXTRACT(MONTH FROM ${sales.completedAt})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${sales.completedAt})::int`,
        total: count(),
      })
      .from(sales)
      .where(
        and(
          eq(sales.workStatus, "feito"),
          ne(sales.productName, "Consulta Cartas"),
          isNull(sales.deletedAt),
          isNotNull(sales.completedAt)
        )
      )
      .groupBy(
        sql`EXTRACT(YEAR FROM ${sales.completedAt})`,
        sql`EXTRACT(MONTH FROM ${sales.completedAt})`
      )
      .orderBy(
        desc(sql`EXTRACT(YEAR FROM ${sales.completedAt})`),
        desc(sql`EXTRACT(MONTH FROM ${sales.completedAt})`)
      );

    return rows.map(r => ({
      month: r.month,
      year: r.year,
      count: Number(r.total),
    }));
  }),

  // Transições de status

  // Para Escrever → Pendente
  markWritten: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(sales)
        .set({ workStatus: "pendente", writtenAt: new Date() })
        .where(
          and(eq(sales.id, input.id), eq(sales.workStatus, "para_escrever"))
        );
      emitSseEvent("consultora");
      return { success: true };
    }),

  // Pendente → Feito
  markDone: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(sales)
        .set({ workStatus: "feito", completedAt: new Date() })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "pendente")));
      emitSseEvent("consultora");
      return { success: true };
    }),

  // Feito → Pendente (reversão de erro)
  undoDone: consultoraProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(sales)
        .set({ workStatus: "pendente", completedAt: null })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "feito")));
      emitSseEvent("consultora");
      return { success: true };
    }),

  // ADM: Pendente → Para Escrever (reversão de erro)
  undoWritten: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(sales)
        .set({ workStatus: "para_escrever", writtenAt: null })
        .where(and(eq(sales.id, input.id), eq(sales.workStatus, "pendente")));
      emitSseEvent("consultora");
      return { success: true };
    }),

  // ADM: alterar vendedor de um trabalho
  updateSeller: adminProcedure
    .input(
      z.object({
        saleId: z.number(),
        sellerId: z.number(),
        sellerName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(sales)
        .set({ sellerId: input.sellerId, sellerName: input.sellerName })
        .where(eq(sales.id, input.saleId));
      return { success: true };
    }),

  // ADM: listar vendedores ativos para o select
  listActiveSellers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.active, true), isNull(users.deletedAt)))
      .orderBy(asc(users.name));
    return rows.map(u => ({
      id: u.id,
      name: u.displayName || u.name || u.role,
    }));
  }),

  // Histórico de compras do cliente (sem valores)
  clientHistory: consultoraProcedure
    .input(z.object({ clientName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Trabalhos normais (excluindo Consulta Cartas)
      const rows = await db
        .select({
          id: sales.id,
          productName: sales.productName,
          saleDate: sales.saleDate,
          workStatus: sales.workStatus,
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
        .limit(50);

      // Consultas Cartas desta cliente (via consultation_slots) — correspondência exata
      const consultaRows = await db
        .select({
          id: consultationSlots.id,
          consultationDate: consultationSlots.consultationDate,
          consultationTime: consultationSlots.consultationTime,
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
      db
        .select({
          id: sales.id,
          clientName: sales.clientName,
          productName: sales.productName,
          productCategory: sales.productCategory,
          saleDate: sales.saleDate,
          sellerName: sales.sellerName,
        })
        .from(sales)
        .where(
          and(
            eq(sales.workStatus, "para_escrever"),
            ne(sales.productName, "Consulta Cartas"),
            isNull(sales.deletedAt)
          )
        )
        .orderBy(asc(sales.saleDate)),
      db
        .select({
          id: sales.id,
          clientName: sales.clientName,
          productName: sales.productName,
          productCategory: sales.productCategory,
          saleDate: sales.saleDate,
          sellerName: sales.sellerName,
        })
        .from(sales)
        .where(
          and(
            eq(sales.workStatus, "pendente"),
            ne(sales.productName, "Consulta Cartas"),
            isNull(sales.deletedAt)
          )
        )
        .orderBy(asc(sales.saleDate)),
    ]);
    const mapUrgency = (s: (typeof toWriteRows)[number]) => {
      const category: ProductCategory = s.productCategory ?? "individual";
      const urgency = getSaleUrgency(s.saleDate, category);
      return {
        ...s,
        productCategory: category,
        ...urgency,
      };
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
    const rows = await db
      .select({
        id: sales.id,
        clientName: sales.clientName,
        clientPhone: sales.clientPhone,
        productName: sales.productName,
        productCategory: sales.productCategory,
        saleDate: sales.saleDate,
        workStatus: sales.workStatus,
        sellerName: sales.sellerName,
      })
      .from(sales)
      .where(
        and(
          or(
            eq(sales.workStatus, "para_escrever"),
            eq(sales.workStatus, "pendente")
          ),
          ne(sales.productName, "Consulta Cartas"),
          isNull(sales.deletedAt)
        )
      )
      .orderBy(asc(sales.saleDate))
      .limit(500);

    const withUrgency = rows.map(s => {
      const category: ProductCategory = s.productCategory ?? "individual";
      const urgency = getSaleUrgency(s.saleDate, category);
      return {
        id: s.id,
        clientName: s.clientName,
        clientPhone: s.clientPhone,
        productName: s.productName,
        productCategory: category,
        saleDate: s.saleDate,
        workStatus: s.workStatus as "para_escrever" | "pendente",
        sellerName: s.sellerName,
        ...urgency,
      };
    });

    type AlertItem = Extract<
      (typeof withUrgency)[number],
      { hasDeadline: true }
    >;

    // Itens sem prazo automático (ex.: coletivos) não são alertas:
    // hasDeadline=false curto-circuita antes de acessar isOverdue/isUrgent.
    return withUrgency
      .filter(
        (item): item is AlertItem =>
          item.hasDeadline && (item.isOverdue || item.isUrgent)
      )
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }),

  // ── ADM: Ações em massa ──────────────────────────────────────────────

  // Lista produtos distintos com contagem para um status (e categoria opcional)
  distinctProducts: adminProcedure
    .input(
      z.object({
        workStatus: z.enum(["para_escrever", "pendente", "feito"]),
        productCategory: z
          .enum(["individual", "promocao", "coletivo"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [
        eq(sales.workStatus, input.workStatus),
        ne(sales.productName, "Consulta Cartas"),
        isNull(sales.deletedAt),
      ];
      if (input.productCategory) {
        conditions.push(eq(sales.productCategory, input.productCategory));
      }
      const rows = await db
        .select({ productName: sales.productName, total: count() })
        .from(sales)
        .where(and(...conditions))
        .groupBy(sales.productName)
        .orderBy(asc(sales.productName));
      return rows.map(r => ({
        productName: r.productName,
        count: Number(r.total),
      }));
    }),

  // Preview: contagem real de trabalhos que serão movidos
  bulkUpdatePreview: adminProcedure
    .input(
      z.object({
        fromStatus: z.enum(["para_escrever", "pendente", "feito"]),
        productNames: z.array(z.string()).min(1),
        productCategory: z
          .enum(["individual", "promocao", "coletivo"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [
        eq(sales.workStatus, input.fromStatus),
        inArray(sales.productName, input.productNames),
        ne(sales.productName, "Consulta Cartas"),
        isNull(sales.deletedAt),
      ];
      if (input.productCategory) {
        conditions.push(eq(sales.productCategory, input.productCategory));
      }
      const [row] = await db
        .select({ total: count() })
        .from(sales)
        .where(and(...conditions));
      return { count: Number(row?.total ?? 0) };
    }),

  // Mover trabalhos em massa
  bulkUpdateStatus: adminProcedure
    .input(
      z.object({
        fromStatus: z.enum(["para_escrever", "pendente", "feito"]),
        toStatus: z.enum(["para_escrever", "pendente", "feito"]),
        productNames: z.array(z.string()).min(1),
        productCategory: z
          .enum(["individual", "promocao", "coletivo"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromStatus === input.toStatus) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Status de origem e destino devem ser diferentes.",
        });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [
        eq(sales.workStatus, input.fromStatus),
        inArray(sales.productName, input.productNames),
        ne(sales.productName, "Consulta Cartas"),
        isNull(sales.deletedAt),
      ];
      if (input.productCategory) {
        conditions.push(eq(sales.productCategory, input.productCategory));
      }

      // Contagem antes do update
      const [countRow] = await db
        .select({ total: count() })
        .from(sales)
        .where(and(...conditions));
      const total = Number(countRow?.total ?? 0);
      if (total === 0) {
        return { success: true, updatedCount: 0 };
      }

      // Timestamps conforme o destino
      const now = new Date();
      let setData: Record<string, any> = { workStatus: input.toStatus };
      if (input.toStatus === "para_escrever") {
        setData.writtenAt = null;
        setData.completedAt = null;
      } else if (input.toStatus === "pendente") {
        setData.writtenAt = now;
        setData.completedAt = null;
      } else if (input.toStatus === "feito") {
        // Se vem de para_escrever, preenche writtenAt também
        if (input.fromStatus === "para_escrever") {
          setData.writtenAt = now;
        }
        setData.completedAt = now;
      }

      await db
        .update(sales)
        .set(setData)
        .where(and(...conditions));

      // Audit log
      const statusLabels: Record<string, string> = {
        para_escrever: "Para Escrever",
        pendente: "Pendente",
        feito: "Feito",
      };
      const adminName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName: adminName,
        action: "Bulk Update Trabalhos",
        details: JSON.stringify({
          fromStatus: statusLabels[input.fromStatus],
          toStatus: statusLabels[input.toStatus],
          productNames: input.productNames,
          productCategory: input.productCategory ?? "todos",
          updatedCount: total,
        }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      emitSseEvent("consultora");
      return { success: true, updatedCount: total };
    }),
});
