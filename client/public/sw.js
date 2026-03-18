// Service Worker para Web Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Nova notificação", body: event.data.text() };
  }

  const title = data.title || "Alerta de Trabalho";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-72.png",
    tag: "alerta-trabalho",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "Ver Alertas" },
      { action: "close", title: "Fechar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma janela aberta, focar nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Caso contrário, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Ativar imediatamente sem esperar reload
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
