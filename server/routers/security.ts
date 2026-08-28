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
import { auditLogs, users } from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import crypto from "crypto";

// Senha mestre hasheada (SHA-256) para validação de operações críticas
// Lê de ENV para não expor a senha no código fonte. Fallback hardcoded para compatibilidade.
const MASTER_PASSWORD_HASH =
  process.env.MASTER_PASSWORD_HASH ||
  "2259180d28299fada66242f3c25eb2adc9b8ecfa2c6cce67d219f286fbe47241";

function verifyMasterPassword(password: string): boolean {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(MASTER_PASSWORD_HASH)
  );
}

const SUPER_ADMIN_UPDATED_LOG_ACTION = "Super ADM alterou log";
const SUPER_ADMIN_DELETED_LOG_ACTION = "Super ADM apagou log";
export const SUPER_ADMIN_MAINTENANCE_ACTIONS = [
  SUPER_ADMIN_UPDATED_LOG_ACTION,
  SUPER_ADMIN_DELETED_LOG_ACTION,
] as const;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

export function isSuperAdminUser(user: AuthenticatedUser): boolean {
  if (user.role !== "admin") return false;

  const configuredUserId = process.env.SUPER_ADMIN_USER_ID?.trim();
  if (configuredUserId) {
    return (
      /^\d+$/.test(configuredUserId) && user.id === Number(configuredUserId)
    );
  }

  const ownerOpenId = process.env.OWNER_OPEN_ID?.trim();
  return Boolean(ownerOpenId && user.openId === ownerOpenId);
}

function requireSuperAdmin(user: AuthenticatedUser) {
  if (!isSuperAdminUser(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso exclusivo do Super ADM.",
    });
  }
}

function isProtectedSuperAdminLog(action: string): boolean {
  return SUPER_ADMIN_MAINTENANCE_ACTIONS.some(
    maintenanceAction => action === maintenanceAction
  );
}

export function getHiddenAuditLogActions(user: AuthenticatedUser): string[] {
  return isSuperAdminUser(user) ? [] : [...SUPER_ADMIN_MAINTENANCE_ACTIONS];
}

const editableAuditLogInput = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive().nullable(),
  userName: z.string().trim().max(256).nullable(),
  action: z.string().trim().min(1).max(128),
  details: z.string().max(50_000).nullable(),
  ipAddress: z.string().trim().max(64).nullable(),
  userAgent: z.string().max(2_000).nullable(),
  createdAt: z.date(),
  masterPassword: z.string().min(1, "Senha mestre é obrigatória"),
});

export const securityRouter = router({
  // Confirma a permissão no servidor antes de abrir o painel oculto.
  getSuperAdminAccess: adminProcedure.query(({ ctx }) => {
    requireSuperAdmin(ctx.user);
    return { granted: true as const };
  }),

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
    .query(async ({ input, ctx }) => {
      return getAuditLogs({
        userId: input?.userId,
        action: input?.action,
        excludeActions: getHiddenAuditLogActions(ctx.user),
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),

  // Edita um registro existente. A manutenção é registrada separadamente.
  updateAuditLog: adminProcedure
    .input(editableAuditLogInput)
    .mutation(async ({ input, ctx }) => {
      requireSuperAdmin(ctx.user);
      if (!verifyMasterPassword(input.masterPassword)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Senha mestre incorreta.",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Banco de dados indisponível.",
        });
      }

      const [existing] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Log não encontrado.",
        });
      }
      if (isProtectedSuperAdminLog(existing.action)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "O registro de manutenção do Super ADM é protegido.",
        });
      }
      if (isProtectedSuperAdminLog(input.action)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Essa ação é reservada aos registros de manutenção.",
        });
      }

      const updatedValues = {
        userId: input.userId,
        userName: input.userName || null,
        action: input.action,
        details: input.details || null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        createdAt: input.createdAt,
      };
      const superAdminName =
        ctx.user.displayName ||
        ctx.user.name ||
        ctx.user.username ||
        "Super ADM";

      await db.transaction(async transaction => {
        await transaction
          .update(auditLogs)
          .set(updatedValues)
          .where(eq(auditLogs.id, input.id));
        await transaction.insert(auditLogs).values({
          userId: ctx.user.id,
          userName: superAdminName,
          action: SUPER_ADMIN_UPDATED_LOG_ACTION,
          details: JSON.stringify({
            targetLogId: input.id,
            before: existing,
            after: { ...existing, ...updatedValues },
          }),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      });

      return { success: true as const };
    }),

  // Apaga o registro selecionado e preserva a prova administrativa da operação.
  deleteAuditLog: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        masterPassword: z.string().min(1, "Senha mestre é obrigatória"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireSuperAdmin(ctx.user);
      if (!verifyMasterPassword(input.masterPassword)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Senha mestre incorreta.",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Banco de dados indisponível.",
        });
      }

      const [existing] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Log não encontrado.",
        });
      }
      if (isProtectedSuperAdminLog(existing.action)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "O registro de manutenção do Super ADM é protegido.",
        });
      }

      const superAdminName =
        ctx.user.displayName ||
        ctx.user.name ||
        ctx.user.username ||
        "Super ADM";
      await db.transaction(async transaction => {
        await transaction.delete(auditLogs).where(eq(auditLogs.id, input.id));
        await transaction.insert(auditLogs).values({
          userId: ctx.user.id,
          userName: superAdminName,
          action: SUPER_ADMIN_DELETED_LOG_ACTION,
          details: JSON.stringify({
            targetLogId: input.id,
            deletedLog: existing,
          }),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      });

      return { success: true as const };
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
