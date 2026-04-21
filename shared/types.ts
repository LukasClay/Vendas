/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

import type { productCategoryEnum } from "../drizzle/schema";

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * Categoria da venda (snapshot em `sales.productCategory`).
 * Derivada do enum do schema — fonte única da verdade.
 */
export type ProductCategory = (typeof productCategoryEnum.enumValues)[number];
