import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { deleteUser, getAllUsers, getUserById, updateUser } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});

export const usersRouter = router({
  listSellers: adminProcedure.query(async () => {
    const all = await getAllUsers();
    return all.filter(u => u.role === "user");
  }),

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
      role: z.enum(["user", "admin"]).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateUser(id, data);
      return { success: true };
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteUser(input.id);
      return { success: true };
    }),

  promoteToAdmin: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateUser(input.id, { role: "admin" });
      return { success: true };
    }),
});
