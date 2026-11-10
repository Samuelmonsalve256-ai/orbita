// CRONOVA · service worker
// Guarda la app (no tus datos) para que abra rápido y funcione sin internet.
// Los datos viven en Supabase y en la copia local del navegador.
const CACHE = "cronova-v6";
const SHELL = ["./", "index.html", "css/cronova.css", "js/app.js", "js/mapa.js", "js/vendor/supabase.js", "js/vendor/three.min.js",
  "js/vendor/OrbitControls.js", "data/colombia.json", "data/colombia-hex.json", "manifest.webmanifest", "icono-180.png", "icono-512.png", "img/cronova-logo.svg", "img/favicon-32.png"];

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
  if (url.origin === location.origin) {
    // Primero la red (siempre la versión nueva); si no hay internet, la copia guardada.
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
  }
  // Todo lo demás (Supabase, rutas, IA) va directo a la red y nunca se guarda aquí.
});

// ── Notificaciones (Web Push): llegan aunque CRONOVA esté cerrada ──
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "CRONOVA", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "CRONOVA", {
    body: d.body || "", tag: d.tag || "cronova", renotify: true, icon: "icono-180.png", badge: "img/favicon-32.png",
    data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if (w.url.startsWith(self.registration.scope)) { w.navigate(destino).catch(() => {}); return w.focus(); } }
    return clients.openWindow(destino);
  }));
});
