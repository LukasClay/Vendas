import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

  // Verificar suporte e estado atual
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    // Registrar service worker
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    }).catch(() => {
      setPermission("unsupported");
    });
  }, []);

  // Solicitar permissão e se inscrever
  async function subscribe() {
    if (!("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== "granted") {
        setIsLoading(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Cancelar inscrição
  async function unsubscribe() {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await unsubscribeMutation.mutateAsync();
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
