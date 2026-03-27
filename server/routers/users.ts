import { z } from "zod";
import { deleteUser, getAllUsers, getUserById, updateUser } from "../db";
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
});
