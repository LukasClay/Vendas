import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { searchAccessibleClients } from "../clientAccess";
import { getDb } from "../db";
import { createFixedWindowRateLimiter } from "../clientSearchRateLimit";

const clientSearchRateLimiter = createFixedWindowRateLimiter({
  limit: 60,
  windowMs: 60_000,
});

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
});
