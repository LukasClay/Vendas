import { z } from "zod";
import { createAuditLog, deleteUser, getAllUsers, getUserById, updateUser } from "../db";
import { adminProcedure, router } from "../_core/trpc";


export const usersRouter = router({
  listAll: adminProcedure.query(async () => {
    return getAllUsers();
  }),

  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getUserById(input.id);
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      displayName: z.string().optional(),
      phone: z.string().optional(),
      role: z.enum(["user", "consultora", "admin"]).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateUser(id, data);
      const userName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({ userId: ctx.user.id, userName, action: "Alterou Funcionário", details: JSON.stringify({ targetUserId: id, changes: data }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
      return { success: true };
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteUser(input.id);
      const userName = ctx.user.displayName || ctx.user.name || ctx.user.username || "Admin";
      await createAuditLog({ userId: ctx.user.id, userName, action: "Desativou Funcionário", details: JSON.stringify({ targetUserId: input.id }), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
      return { success: true };
    }),
});
