import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Dispatches a project-owner notification.
 *
 * No Manus, usa o Notification Service interno (BUILT_IN_FORGE_API_URL).
 * No Railway (sem essas variáveis), faz fallback silencioso — as notificações
 * de cancelamento de consulta continuam funcionando via Web Push (sendPushToRoles),
 * então este canal é apenas complementar.
 *
 * Retorna `true` se enviou, `false` se não estava configurado ou falhou.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const title = (payload.title ?? "").trim();
  const content = (payload.content ?? "").trim();

  if (!title || !content) {
    console.warn("[Notification] Payload vazio, ignorando.");
    return false;
  }

  // Sem o proxy do Manus configurado → fallback silencioso (não quebra o sistema)
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.log(`[Notification] Serviço não configurado (Railway). Notificação ignorada: "${title}"`);
    return false;
  }

  const normalizedBase = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const endpoint = new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Falha ao notificar (${response.status})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Erro ao chamar serviço:", error);
    return false;
  }
}
