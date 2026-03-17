import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { productsRouter } from "./routers/products";
import { usersRouter } from "./routers/users";
import { salesRouter } from "./routers/sales";
import { reportsRouter } from "./routers/reports";
import { ownAuthRouter } from "./routers/auth";
import { consultoraRouter } from "./routers/consultora";
import { consultationSlotsRouter } from "./routers/consultationSlots";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  products: productsRouter,
  users: usersRouter,
  sales: salesRouter,
  reports: reportsRouter,
  ownAuth: ownAuthRouter,
  consultora: consultoraRouter,
  consultationSlots: consultationSlotsRouter,
});

export type AppRouter = typeof appRouter;
