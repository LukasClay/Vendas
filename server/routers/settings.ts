import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, withRetry } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const ACTIVE_COMPANY_KEY = "active_company";
const DEFAULT_COMPANY = "mundo_da_magia";

export const settingsRouter = router({
  // Retorna a empresa ativa — acessível por todos (vendedores precisam saber para carimbar a venda)
  getActiveCompany: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return DEFAULT_COMPANY;
    const rows = await withRetry(() =>
      db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, ACTIVE_COMPANY_KEY))
        .limit(1)
    );
    if (rows.length === 0) return DEFAULT_COMPANY;
    return rows[0].value as "mundo_da_magia" | "mundo_cigano";
  }),

  // Troca a empresa ativa — somente ADM
  switchCompany: protectedProcedure
    .input(
      z.object({
        company: z.enum(["mundo_da_magia", "mundo_cigano"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas administradores podem trocar a empresa ativa.",
        });
      }
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Banco indisponível.",
        });

      // Upsert: insere se não existe, atualiza se já existe
      const existing = await withRetry(() =>
        db
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, ACTIVE_COMPANY_KEY))
          .limit(1)
      );

      if (existing.length === 0) {
        await withRetry(() =>
          db
            .insert(appSettings)
            .values({ key: ACTIVE_COMPANY_KEY, value: input.company })
        );
      } else {
        await withRetry(() =>
          db
            .update(appSettings)
            .set({ value: input.company })
            .where(eq(appSettings.key, ACTIVE_COMPANY_KEY))
        );
      }

      return { success: true, company: input.company };
    }),
});
