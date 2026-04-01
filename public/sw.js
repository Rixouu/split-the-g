self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first pass-through to satisfy installability requirements.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const title = payload?.title ?? "Split the G";
  const options = {
    body: payload?.body ?? "",
    icon: payload?.icon ?? "/web-app-manifest-192x192.png",
    badge: payload?.badge ?? "/favicon-96x96.png",
    data: {
      path: payload?.path ?? "/",
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification?.data?.path ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(targetPath);
        return existing.focus();
      }
      return self.clients.openWindow(targetPath);
    }),
  );
});
