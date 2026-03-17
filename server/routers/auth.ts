import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, withRetry } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";

const REMEMBER_ME_MS = ONE_YEAR_MS; // 1 ano
const SESSION_MS = 1000 * 60 * 60 * 8; // 8 horas

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin")
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});

export const ownAuthRouter = router({
  // Login com email e senha
  login: publicProcedure
    .input(z.object({
      email: z.string().email("Email inválido"),
      password: z.string().min(1, "Senha obrigatória"),
      rememberMe: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      // Busca usuário pelo email com retry automático (para reconexão após hibernação)
      const result = await withRetry(() =>
        db.select().from(users).where(eq(users.email, input.email)).limit(1)
      );
      const user = result[0];

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
      }

      if (!user.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário desativado. Entre em contato com o administrador." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
      }

      // Gera JWT de sessão usando o SDK existente
      const expiresInMs = input.rememberMe ? REMEMBER_ME_MS : SESSION_MS;
      const token = await sdk.signSession(
        { openId: user.openId, appId: ENV.appId, name: user.name ?? user.email ?? "" },
        { expiresInMs }
      );

      // Atualiza lastSignedIn
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: expiresInMs,
      });

      return { success: true, role: user.role };
    }),

  // Admin cria novo vendedor ou consultora com senha
  createSeller: adminProcedure
    .input(z.object({
      name: z.string().min(1, "Nome obrigatório"),
      email: z.string().email("Email inválido"),
      password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      phone: z.string().optional(),
      role: z.enum(["user", "consultora", "admin"]).default("user"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      // Verifica se email já existe
      const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este email." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      // openId único para usuários locais
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        loginMethod: "email_password",
        role: input.role,
        active: true,
        phone: input.phone ?? null,
        passwordHash,
        lastSignedIn: new Date(),
      });

      return { success: true };
    }),

  // Admin reseta senha de um vendedor
  resetPassword: adminProcedure
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.update(users).set({ passwordHash }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
