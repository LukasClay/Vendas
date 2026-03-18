import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createProduct, deleteProduct, getAllProducts, updateProduct } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  return next({ ctx });
});

export const productsRouter = router({
  list: protectedProcedure.query(async () => {
    return getAllProducts(false);
  }),

  listAll: adminProcedure.query(async () => {
    return getAllProducts(true);
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await createProduct({
        name: input.name,
        description: input.description ?? null,
        active: true,
      });
      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateProduct(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProduct(input.id);
      return { success: true };
    }),
});
