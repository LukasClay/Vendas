import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { clients, sales, users } from "../../drizzle/schema";
import { and, desc, isNull, or, sql } from "drizzle-orm";

export const searchRouter = router({
  query: adminProcedure
    .input(z.object({ q: z.string().min(2).max(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const term = input.q.replace(/[%_\\]/g, "\\$&");
      const like = `%${term}%`;

      const [clientRows, saleRows, userRows] = await Promise.all([
        db
          .select({
            id: clients.id,
            fullName: clients.fullName,
            phone: clients.phone,
          })
          .from(clients)
          .where(
            or(
              sql`${clients.fullName} ILIKE ${like}`,
              sql`${clients.phone} ILIKE ${like}`
            )
          )
          .limit(6),

        db
          .select({
            id: sales.id,
            clientName: sales.clientName,
            productName: sales.productName,
            amount: sales.amount,
            saleDate: sales.saleDate,
          })
          .from(sales)
          .where(
            and(
              isNull(sales.deletedAt),
              or(
                sql`${sales.clientName} ILIKE ${like}`,
                sql`${sales.productName} ILIKE ${like}`
              )
            )
          )
          .orderBy(desc(sales.saleDate))
          .limit(6),

        db
          .select({
            id: users.id,
            name: users.name,
            displayName: users.displayName,
            username: users.username,
            role: users.role,
          })
          .from(users)
          .where(
            and(
              isNull(users.deletedAt),
              or(
                sql`${users.name} ILIKE ${like}`,
                sql`${users.displayName} ILIKE ${like}`,
                sql`${users.username} ILIKE ${like}`
              )
            )
          )
          .limit(4),
      ]);

      return {
        clients: clientRows,
        sales: saleRows.map(s => ({
          ...s,
          amount: Number(s.amount),
        })),
        users: userRows,
      };
    }),
});
