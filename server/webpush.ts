import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Configurar VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@vendas.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export { VAPID_PUBLIC_KEY };

// ─── Salvar subscription de um usuário ───────────────────────────────────────
export async function savePushSubscription(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  const db = await getDb();
  if (!db) return;

  // Verificar se já existe (mesmo endpoint)
  const existing = await (db.select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId)) as any);

  if (existing.length > 0) {
    // Atualizar subscription existente do usuário
    await (db.update(pushSubscriptions)
      .set({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
      })
      .where(eq(pushSubscriptions.userId, userId)) as any);
  } else {
    await (db.insert(pushSubscriptions).values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    }) as any);
  }
}

// ─── Remover subscription de um usuário ──────────────────────────────────────
export async function removePushSubscription(userId: number) {
  const db = await getDb();
  if (!db) return;
  await (db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)) as any);
}

// ─── Enviar notificação para um usuário ──────────────────────────────────────
export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string }
) {
  const db = await getDb();
  if (!db) return;

  const subs = await (db.select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId)) as any);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url ?? "/",
        })
      );
    } catch (err: any) {
      // Subscription expirada ou inválida — remover
      if (err.statusCode === 410 || err.statusCode === 404) {
        await (db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)) as any);
      }
    }
  }
}

// ─── Enviar notificação para todos os admins e consultor--snip--
export async function sendPushToRoles(
  roles: ("admin" | "consultora")[],
  payload: { title: string; body: string; url?: string }
) {
  const db = await getDb();
  if (!db) return;

  // Buscar todos os usuários com as roles especificadas
  const { users } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");

  const targetUsers = await (db.select({ id: users.id })
    .from(users)
    .where(inArray(users.role, roles)) as any);

  for (const user of targetUsers) {
    await sendPushToUser(user.id, payload);
  }
}
