import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
  createAuditLog,
  deleteUserSession,
  deleteUserSessionsByUser,
  getAllUserSessions,
  getAuditLogs,
  getDb,
} from "../db";
import { users } from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import crypto from "crypto";

// Senha mestre hasheada (SHA-256) para validação de operações críticas.
// A env `MASTER_PASSWORD_HASH` é obrigatória — sem fallback. Se faltar ou
// estiver em formato inválido, o servidor falha no boot (ver
// `assertMasterPasswordConfigured`).
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

function getMasterPasswordHash(): string {
  const hash = process.env.MASTER_PASSWORD_HASH;
  if (!hash) {
    throw new Error(
      "MASTER_PASSWORD_HASH não configurada. Defina a env var antes de iniciar o servidor."
    );
  }
  if (!SHA256_HEX_REGEX.test(hash)) {
    throw new Error(
      "MASTER_PASSWORD_HASH deve ser um hash SHA-256 hexadecimal de 64 caracteres."
    );
  }
  return hash;
}

// Chamada no startup (`server/_core/index.ts`) para falhar cedo em caso de
// misconfiguração, antes de aceitar requests.
export function assertMasterPasswordConfigured(): void {
  getMasterPasswordHash();
}

function verifyMasterPassword(password: string): boolean {
  const expected = getMasterPasswordHash();
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  // Comparar 32 bytes binarios e idiomatico e mais barato que 64 bytes ASCII.
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(expected, "hex")
  );
}

export const securityRouter = router({
  // Lista todas as sessões ativas com dados do usuário
  getActiveSessions: adminProcedure.query(async () => {
    const sessions = await getAllUserSessions();
    return sessions.map(s => ({
      id: s.session.id,
      userId: s.session.userId,
      userName: s.userName,
      userRole: s.userRole,
      ipAddress: s.session.ipAddress,
      userAgent: s.session.userAgent,
      location: s.session.location,
      lastActive: s.session.lastActive,
      createdAt: s.session.createdAt,
    }));
  }),

  // Lista audit logs com paginação e filtros
  getAuditLogs: adminProcedure
    .input(
      z
        .object({
          userId: z.number().optional(),
          action: z.string().optional(),
          limit: z.number().min(1).max(500).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getAuditLogs({
        userId: input?.userId,
        action: input?.action,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),

  // Desconecta uma sessão individual (requer senha mestre)
  disconnectSession: adminProcedure
    .input(
      z.object({
        sessionId: z.number(),
        masterPassword: z.string().min(1, "Senha mestre é obrigatória"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!verifyMasterPassword(input.masterPassword)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Senha mestre incorreta.",
        });
      }

      const allSessions = await getAllUserSessions();
      const targetSession = allSessions.find(
        s => s.session.id === input.sessionId
      );
      if (targetSession?.session.userId) {
        const db = await getDb();
        if (db) {
          await db
            .update(users)
            .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
            .where(eq(users.id, targetSession.session.userId));
        }
      }

      await deleteUserSession(input.sessionId);

      const adminName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName: adminName,
        action: "Desconectou Sessão",
        details: JSON.stringify({
          sessionId: input.sessionId,
          targetUserId: targetSession?.session.userId || null,
        }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { success: true };
    }),

  // Desconecta TODAS as sessões de um usuário (requer senha mestre)
  disconnectUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        masterPassword: z.string().min(1, "Senha mestre é obrigatória"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!verifyMasterPassword(input.masterPassword)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Senha mestre incorreta.",
        });
      }

      // Incrementa sessionVersion para invalidar todos os JWTs do usuário
      const db = await getDb();
      if (db) {
        await db
          .update(users)
          .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
          .where(eq(users.id, input.userId));
      }

      // Remove todas as sessões do usuário
      await deleteUserSessionsByUser(input.userId);

      const adminName =
        ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName: adminName,
        action: "Desconectou Usuário",
        details: JSON.stringify({ targetUserId: input.userId }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { success: true };
    }),
});
