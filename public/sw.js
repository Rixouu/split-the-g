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
