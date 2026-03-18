import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { savePushSubscription, removePushSubscription, VAPID_PUBLIC_KEY } from "../webpush";

export const pushRouter = router({
  // Retornar a chave pública VAPID para o frontend
  getVapidKey: protectedProcedure.query(() => {
    return { publicKey: VAPID_PUBLIC_KEY || "" };
  }),

  // Salvar subscription do usuário logado
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string(),
      auth: z.string(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await savePushSubscription(
        ctx.user.id,
        { endpoint: input.endpoint, keys: { p256dh: input.p256dh, auth: input.auth } },
        input.userAgent
      );
      return { ok: true };
    }),

  // Remover subscription do usuário logado
  unsubscribe: protectedProcedure.mutation(async ({ ctx }) => {
    await removePushSubscription(ctx.user.id);
    return { ok: true };
  }),
});
