// Órbita · service worker
// Guarda la app (no tus datos) para que abra rápido y sin internet.
// Los datos viven en Supabase y en la copia local del navegador.
const CACHE = "orbita-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icono-180.png", "icono-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // nunca guardar datos ni sesiones
  if (req.mode === "navigate" || url.origin === location.origin) {
    // Primero la red (para recibir siempre la versión nueva); si no hay, la copia guardada.
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  // Librerías de CDN (versiones fijas): copia guardada primero.
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
});
