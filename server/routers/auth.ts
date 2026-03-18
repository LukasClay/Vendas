import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, withRetry } from "../db";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";
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
  // Login com username e senha (sem email)
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1, "Usuário obrigatório"),
      password: z.string().min(1, "Senha obrigatória"),
      rememberMe: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      // Busca por username OU email (compatibilidade com contas antigas)
      const result = await withRetry(() =>
        db.select().from(users).where(
          or(
            eq(users.username, input.username),
            eq(users.email, input.username)
          )
        ).limit(1)
      );
      const user = result[0];

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha incorretos." });
      }

      if (!user.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário desativado. Entre em contato com o administrador." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha incorretos." });
      }

      // Gera JWT de sessão usando o SDK existente
      const expiresInMs = input.rememberMe ? REMEMBER_ME_MS : SESSION_MS;
      const token = await sdk.signSession(
        { openId: user.openId, appId: ENV.appId, name: user.name ?? user.username ?? user.email ?? "" },
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

  // Admin cria novo funcionário (vendedor, consultora ou admin) com username e senha
  createSeller: adminProcedure
    .input(z.object({
      name: z.string().min(1, "Nome obrigatório"),
      username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Usuário só pode conter letras, números e _"),
      password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      phone: z.string().optional(),
      role: z.enum(["user", "consultora", "admin"]).default("user"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      // Verifica se username já existe
      const existing = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este nome de usuário." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      await db.insert(users).values({
        openId,
        name: input.name,
        username: input.username,
        loginMethod: "username_password",
        role: input.role,
        active: true,
        phone: input.phone ?? null,
        passwordHash,
        lastSignedIn: new Date(),
      });

      return { success: true };
    }),

  // Admin edita dados de qualquer funcionário
  updateUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      name: z.string().min(1).optional(),
      username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/).optional(),
      role: z.enum(["user", "consultora", "admin"]).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verifica conflito de username
      if (input.username) {
        const existing = await db.select().from(users)
          .where(eq(users.username, input.username)).limit(1);
        if (existing.length > 0 && existing[0].id !== input.userId) {
          throw new TRPCError({ code: "CONFLICT", message: "Este nome de usuário já está em uso." });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.username !== undefined) updateData.username = input.username;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.active !== undefined) updateData.active = input.active;

      await db.update(users).set(updateData).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Admin reseta senha de qualquer funcionário
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

  // Admin lista todos os funcionários
  listUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const result = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    }).from(users).orderBy(users.createdAt);

    return result;
  }),

  // Admin exclui funcionário (Soft Delete Seguro — preserva histórico de vendas)
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const { deleteUser } = await import("../db");
      await deleteUser(input.userId);
      return { success: true };
    }),
});
