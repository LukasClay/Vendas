import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { searchAccessibleClients } from "../clientAccess";
import { getDb } from "../db";
import { createFixedWindowRateLimiter } from "../clientSearchRateLimit";
import {
  ClientAdminConflictError,
  ClientAdminNotFoundError,
  getAdminClientDetail,
  getDuplicateGroups,
  listAdminClients,
  updateAdminClient,
} from "../clientAdmin";

const clientSearchRateLimiter = createFixedWindowRateLimiter({
  limit: 60,
  windowMs: 60_000,
});

function throwClientAdminError(error: unknown): never {
  if (error instanceof ClientAdminNotFoundError) {
    throw new TRPCError({ code: "NOT_FOUND", message: error.message });
  }
  if (error instanceof ClientAdminConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof TypeError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }

  console.error(
    "[clients.admin] Falha na opera\u00e7\u00e3o administrativa:",
    error
  );
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "N\u00e3o foi poss\u00edvel processar o cadastro do cliente.",
  });
}

export const clientsRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = clientSearchRateLimiter.consume(ctx.user.id);
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Muitas buscas em pouco tempo. Aguarde alguns segundos.",
        });
      }
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Banco de dados indispon\u00edvel.",
        });
      }

      return searchAccessibleClients(
        db,
        { id: ctx.user.id, role: ctx.user.role },
        input.query
      );
    }),

  adminList: adminProcedure
    .input(
      z
        .object({
          query: z.string().trim().max(100).optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(25),
        })
        .optional()
    )
    .query(async ({ input }) => {
      try {
        return await listAdminClients({
          query: input?.query,
          page: input?.page ?? 1,
          pageSize: input?.pageSize ?? 25,
        });
      } catch (error) {
        throwClientAdminError(error);
      }
    }),

  adminDetail: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await getAdminClientDetail(input.id);
      } catch (error) {
        throwClientAdminError(error);
      }
    }),

  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        fullName: z.string().trim().min(1).max(256),
        birthDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        phone: z.string().trim().max(32).nullable(),
        expectedUpdatedAt: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      try {
        return await updateAdminClient(input, {
          userId: ctx.user.id,
          userName,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      } catch (error) {
        throwClientAdminError(error);
      }
    }),

  duplicateGroups: adminProcedure.query(async () => {
    try {
      return await getDuplicateGroups();
    } catch (error) {
      throwClientAdminError(error);
    }
  }),
});
