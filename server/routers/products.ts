import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createProduct, deleteProduct, findActiveProductByName, findDeletedProductByName, getAllProducts, getProductById, restoreProduct, updateProduct } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

export const productsRouter = router({
  list: protectedProcedure.query(async () => {
    return getAllProducts(false);
  }),

  listAll: adminProcedure.query(async () => {
    return getAllProducts(true);
  }),

  listAllWithDeleted: adminProcedure.query(async () => {
    return getAllProducts(true, true);
  }),

  restore: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await restoreProduct(input.id);
      return { success: true };
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      description: z.string().optional(),
      allowedCategories: z.array(z.enum(["individual", "promocao", "coletivo"])).min(1, "Selecione pelo menos 1 tipo").default(["individual", "promocao", "coletivo"]),
    }))
    .mutation(async ({ input }) => {
      // Verifica se já existe um produto ativo com o mesmo nome (case-insensitive)
      const existingActive = await findActiveProductByName(input.name.trim());
      if (existingActive) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um trabalho ativo com esse nome.",
        });
      }
      // Verifica se existe um produto excluído (soft delete) com o mesmo nome — restaura
      const existingDeleted = await findDeletedProductByName(input.name.trim());
      if (existingDeleted) {
        await restoreProduct(existingDeleted.id);
        return { success: true, restored: true };
      }
      await createProduct({
        name: input.name,
        description: input.description ?? null,
        active: true,
        allowedCategories: input.allowedCategories,
      });
      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
      allowedCategories: z.array(z.enum(["individual", "promocao", "coletivo"])).min(1, "Selecione pelo menos 1 tipo").optional(),
    }))
    .mutation(async ({ input }) => {
      // Bloqueia edição de produtos do sistema
      const product = await getProductById(input.id);
      if (product?.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Este trabalho é gerenciado pelo sistema e não pode ser editado.",
        });
      }
      const { id, ...data } = input;
      await updateProduct(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Bloqueia exclusão de produtos do sistema
      const product = await getProductById(input.id);
      if (product?.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Este trabalho é gerenciado pelo sistema e não pode ser excluído.",
        });
      }
      await deleteProduct(input.id);
      return { success: true };
    }),
});
