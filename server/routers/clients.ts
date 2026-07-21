import { TRPCError } from "@trpc/server";
import { asc, or, sql } from "drizzle-orm";
import { z } from "zod";
import { clients } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

export const clientsRouter = router({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(100),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Banco de dados indispon\u00edvel.",
        });
      }

      const escapedQuery = input.query.replace(/[%_\\]/g, "\\$&");
      const like = `%${escapedQuery}%`;

      return db
        .select({
          id: clients.id,
          fullName: clients.fullName,
          birthDate: clients.birthDate,
          phone: clients.phone,
        })
        .from(clients)
        .where(
          or(
            sql`${clients.fullName} ILIKE ${like} ESCAPE '\\'`,
            sql`${clients.phone} ILIKE ${like} ESCAPE '\\'`
          )
        )
        .orderBy(asc(clients.fullName))
        .limit(8);
    }),
});
