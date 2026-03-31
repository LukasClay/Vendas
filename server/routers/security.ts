import { TRPCError } from "@trpc/server";
import { z, eq } from "zod";
import { createAuditLog, deleteUserSession, getAllUserSessions, getAuditLogs, getDb, users } from "../db";
import { sql } from "drizzle-orm";

import { adminProcedure, router } from "../_core/trpc";
import crypto from "crypto";

// Senha mestre hasheada (SHA-256) para validação de operações críticas
// A senha nunca é armazenada em texto puro no código
const MASTER_PASSWORD_HASH = crypto
  .createHash("sha256")
  .update("^i~YTE_}-~shA0Pp~boiB),s}xFCa]L10DmPEFgoJv.mgCc)U}8a7)Z!H.::-5@M6pf1}~!9eN8r!N3YDMNno2-}#Fs.5*Ri_6Wv")
  .digest("hex");

function verifyMasterPassword(password: string): boolean {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(MASTER_PASSWORD_HASH));
}

export const securityRouter = router({
  // Lista todas as sessões ativas com dados do usuário
  getActiveSessions: adminProcedure.query(async () => {
    const sessions = await getAllUserSessions();
    return sessions.map((s) => ({
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
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      limit: z.number().min(1).max(500).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      return getAuditLogs({
        userId: input?.userId,
        action: input?.action,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),

  // Desconecta uma sessão (requer senha mestre)
  disconnectSession: adminProcedure
    .input(z.object({
      sessionId: z.number(),
      masterPassword: z.string().min(1, "Senha mestre é obrigatória"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Valida senha mestre
      if (!verifyMasterPassword(input.masterPassword)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Senha mestre incorreta.",
        });
      }

      // Busca a sessão para obter userId e invalidar JWTs
      const allSessions = await getAllUserSessions();
      const targetSession = allSessions.find(s => s.session.id === input.sessionId);
      if (targetSession?.session.userId) {
        const db = await getDb();
        if (db) {
          await db.update(users)
            .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
            .where(eq(users.id, targetSession.session.userId));
        }
      }


      await deleteUserSession(input.sessionId);

      // Registra no audit log com targetUserId
      const adminName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({
        userId: ctx.user.id,
        userName: adminName,
        action: "Desconectou Sessão",
        details: JSON.stringify({ 
          sessionId: input.sessionId,
          targetUserId: targetSession?.session.userId || null 
        }),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { success: true };
    }),

});
