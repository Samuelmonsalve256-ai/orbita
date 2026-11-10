// CRONOVA · service worker
// Guarda la app (no tus datos) para que abra rápido y funcione sin internet.
// Los datos viven en Supabase y en la copia local del navegador.
const CACHE = "cronova-v3";
const SHELL = ["./", "index.html", "css/cronova.css", "js/app.js", "js/mapa.js", "js/vendor/supabase.js", "js/vendor/three.min.js",
  "js/vendor/OrbitControls.js", "data/colombia.json", "data/mundo.json", "manifest.webmanifest", "icono-180.png", "icono-512.png", "img/cronova-logo.svg", "img/favicon-32.png"];

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
