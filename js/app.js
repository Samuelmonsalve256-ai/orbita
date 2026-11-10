/* ════════════════════════════════════════════════════════════════════════════
   CRONOVA · aplicación
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

/* ───────────────────────── Utilidades ───────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseYmd = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const evStart = e => { const d = parseYmd(e.date); const [h, mi] = String(e.time || "00:00").split(":").map(Number); d.setHours(h || 0, mi || 0, 0, 0); return d; };
const evEnd = e => new Date(evStart(e).getTime() + (Number(e.duration) || 60) * 6e4);
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DOWS = ["lun","mar","mié","jue","vie","sáb","dom"];
const fmtDay = d => d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
const fmtDayY = d => d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = d => d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
const fmtTime = t => { if (!t) return "Todo el día"; const [h, m] = t.split(":").map(Number); return ((h % 12) || 12) + ":" + pad(m) + (h >= 12 ? " p. m." : " a. m."); };
const fmtClock = d => { const h = d.getHours(); return ((h % 12) || 12) + ":" + pad(d.getMinutes()); };
const fmtDur = min => { min = Math.round(min); if (min < 60) return min + " min"; const h = Math.floor(min / 60), m = min % 60; return h + " h" + (m ? " " + m + " min" : ""); };
const fmtKm = km => !km ? "0 km" : km < 10 ? km.toFixed(1).replace(".", ",") + " km" : Math.round(km).toLocaleString("es-CO") + " km";
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
function hav(a, b) { const R = 6371, r = x => x * Math.PI / 180; const dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const ico = (id, cls) => `<svg class="ico${cls ? " " + cls : ""}"><use href="#i-${id}"/></svg>`;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches || PREFS.anim === "reducidas";

/* ───────────────────────── Fechas con lógica ─────────────────────────
   Solo se agenda de hoy en adelante, hasta el 31 de diciembre del año siguiente. */
const NOW = () => new Date();
const TODAY = () => ymd(NOW());
const MAXDATE = () => (NOW().getFullYear() + 1) + "-12-31";
const isPastDay = ds => ds < TODAY();
const daysLeftYear = () => { const n = NOW(); const end = new Date(n.getFullYear(), 11, 31); return Math.round((end - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); };
const dayOfYear = () => { const n = NOW(); return Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(n.getFullYear(), 0, 1)) / 864e5) + 1; };
const daysInYear = y => (new Date(y, 1, 29).getMonth() === 1 ? 366 : 365);
const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
const minMonth = () => monthStart(NOW());
const maxMonth = () => new Date(NOW().getFullYear() + 1, 11, 1);
function relDay(ds) { const t = TODAY(); if (ds === t) return "Hoy"; const d1 = parseYmd(t); d1.setDate(d1.getDate() + 1); if (ds === ymd(d1)) return "Mañana"; return null; }

/* ───────────────────────── Tipos de evento ───────────────────────── */
const TYPES = { cita: "Cita", compromiso: "Compromiso", viaje: "Viaje", llamada: "Llamada", personal: "Personal" };

/* ───────────────────────── Preferencias ───────────────────────── */
const COLORS = { indigo: ["#4f46e5", "#7c3aed", "Índigo"], azul: ["#2563eb", "#0ea5e9", "Azul"], esmeralda: ["#059669", "#10b981", "Esmeralda"], turquesa: ["#0d9488", "#06b6d4", "Turquesa"],
  naranja: ["#ea580c", "#f59e0b", "Naranja"], rosa: ["#db2777", "#f43f5e", "Rosa"], violeta: ["#7c3aed", "#c026d3", "Violeta"], grafito: ["#334155", "#64748b", "Grafito"] };
const DOR = { n: "Doradal", d: "05", lat: 5.899, lon: -74.716, sub: "Puerto Triunfo" };
const DEF_PREFS = { nombre: "Samuel Rich", home: { name: "Bogotá D.C.", dept: "11", lat: 4.711, lon: -74.072 }, color: "indigo", fuente: "jakarta", lugares: [DOR],
  texto: "normal", sonido: true, volumen: 0.6, anim: "completas", aviso60: true, aviso15: true, avisoSistema: false, horaResumen: "06:30" };
let PREFS = Object.assign({}, DEF_PREFS, lsGet("cronova.prefs", {}));
if (!PREFS.v21) { delete PREFS.tema; if (PREFS.fuente === "moderna" || PREFS.fuente === "clasica") PREFS.fuente = "jakarta"; PREFS.color = PREFS.color || "indigo";
  if (!(PREFS.lugares || []).some(p => p.n === "Doradal")) PREFS.lugares = [DOR].concat(PREFS.lugares || []); PREFS.v21 = true; lsSet("cronova.prefs", PREFS); }
function applyPrefs() {
  const h = document.documentElement;
  const c = COLORS[PREFS.color] || COLORS.indigo; h.style.setProperty("--acc", c[0]); h.style.setProperty("--acc-2", c[1]);
  h.dataset.fuente = PREFS.fuente; h.dataset.texto = PREFS.texto; h.dataset.anim = PREFS.anim;
  $("#greetName").textContent = PREFS.nombre || "Samuel Rich";
  $("#userName").textContent = PREFS.nombre || "Samuel Rich";
  $("#avatar").textContent = (PREFS.nombre || "SR").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (MAP) MAP.setTheme();
}
let prefsTimer = 0;
function savePrefs(patch, quiet) {
  Object.assign(PREFS, patch); lsSet("cronova.prefs", PREFS); applyPrefs();
  clearTimeout(prefsTimer); prefsTimer = setTimeout(pushPrefs, 600);
  if (!quiet) renderAll();
}

/* ───────────────────────── Sonidos ─────────────────────────
   Sintetizados en el momento (sin archivos). Se activan tras el primer toque. */
const Sfx = (() => {
  let ctx = null;
  function c() { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === "suspended") ctx.resume(); return ctx; }
  function tone(f, t0, dur, type, vol, f2) {
    const a = c(); if (!a) return; const o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, a.currentTime + t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + t0 + dur);
    const v = (vol || .08) * (PREFS.volumen ?? .6);
    g.gain.setValueAtTime(0.0001, a.currentTime + t0); g.gain.exponentialRampToValueAtTime(Math.max(v, .0002), a.currentTime + t0 + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    o.connect(g).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + .02);
  }
  function noise(t0, dur, f1, f2, vol) {
    const a = c(); if (!a) return; const n = a.sampleRate * dur, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(); s.buffer = b; const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f1, a.currentTime + t0); bp.frequency.exponentialRampToValueAtTime(f2, a.currentTime + t0 + dur);
    const g = a.createGain(); const v = (vol || .05) * (PREFS.volumen ?? .6);
    g.gain.setValueAtTime(0.0001, a.currentTime + t0); g.gain.exponentialRampToValueAtTime(v, a.currentTime + t0 + dur * .3); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    s.connect(bp).connect(g).connect(a.destination); s.start(a.currentTime + t0); s.stop(a.currentTime + t0 + dur + .02);
  }
  const S = {
    abrir: () => tone(540, 0, .07, "sine", .045, 760),
    guardar: () => { tone(660, 0, .1, "triangle", .07); tone(990, .08, .2, "triangle", .07); },
    completar: () => { tone(880, 0, .14, "sine", .07); tone(1320, .07, .34, "sine", .06); },
    borrar: () => tone(420, 0, .2, "triangle", .07, 200),
    error: () => { tone(190, 0, .11, "square", .025); tone(160, .13, .13, "square", .025); },
    enviar: () => noise(0, .26, 900, 3200, .05),
    respuesta: () => { tone(740, 0, .1, "sine", .05); tone(988, .07, .16, "sine", .045); },
    alerta: () => { tone(988, 0, 1.1, "sine", .08); tone(1480, 0, .8, "sine", .03); tone(988, .35, 1, "sine", .05); },
    toque: () => tone(1250, 0, .03, "sine", .03),
    casa: () => { tone(523, 0, .12, "triangle", .06); tone(784, .1, .26, "triangle", .06); }
  };
  return { play(n) { if (!PREFS.sonido || !S[n]) return; try { S[n](); } catch (e) {} }, unlock() { try { c(); } catch (e) {} } };
})();
document.addEventListener("pointerdown", () => Sfx.unlock(), { once: true });

/* ───────────────────────── Avisos y hojas ───────────────────────── */
function toast(msg, kind, sound) {
  const t = document.createElement("div"); t.className = "toast " + (kind || "");
  const icon = kind === "ok" ? "check" : kind === "bad" ? "alerta" : kind === "warn" ? "campana" : "info";
  t.innerHTML = `<span class="ti">${ico(icon)}</span><div style="flex:1;min-width:0">${esc(msg)}</div>`;
  $("#toasts").appendChild(t);
  if (sound) Sfx.play(sound);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 180); }, kind === "bad" || kind === "warn" ? 6500 : 3600);
}
let sheetClose = null;
function openSheet(html, opts = {}) {
  closeSheet(true);
  const ov = document.createElement("div"); ov.className = "sheet-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(opts.label || "Ventana")}"><div class="grab"></div>${html}</div>`;
  $("#sheetRoot").appendChild(ov); Sfx.play("abrir");
  const sh = ov.querySelector(".sheet");
  ov.addEventListener("pointerdown", e => { if (e.target === ov) closeSheet(); });
  const onKey = e => { if (e.key === "Escape") closeSheet(); };
  document.addEventListener("keydown", onKey);
  sheetClose = () => { document.removeEventListener("keydown", onKey); opts.onClose && opts.onClose(); };
  sh.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeSheet()));
  setTimeout(() => { const f = sh.querySelector("[autofocus]"); if (f && matchMedia("(min-width:981px)").matches) f.focus(); }, 60);
  return sh;
}
function closeSheet(instant) {
  const ov = $("#sheetRoot .sheet-ov"); if (!ov) return;
  if (sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  if (instant) { ov.remove(); return; }
  ov.classList.add("out"); setTimeout(() => ov.remove(), 170);
}

/* ───────────────────────── Lugares: municipios + pueblos guardados ─────────────────────────
   1.122 municipios del DANE, más los pueblos, corregimientos y veredas que guardes
   (Doradal viene incluido). Lo que no esté, se busca en OpenStreetMap. */
let MUN = [], DEPT = {}, MAPDATA = null;
const ALIAS = { "bogota": "bogota d.c.", "santa fe de bogota": "bogota d.c.", "cartagena": "cartagena de indias", "cucuta": "san jose de cucuta",
  "tumaco": "san andres de tumaco", "mompox": "mompos" };
async function loadGeo() {
  if (MAPDATA) return;
  try {
    const r = await fetch("data/colombia.json"); MAPDATA = await r.json();
    MAPDATA.depts.forEach(d => DEPT[d.c] = d.n);
    MUN = MAPDATA.mun.map(m => ({ n: m[0], d: m[1], lat: m[2], lon: m[3], cap: !!m[4], k: norm(m[0]), raw: m }));
  } catch (e) { console.warn(e); toast("No pude cargar la lista de municipios. Revisa tu conexión.", "bad"); }
}
const placesSaved = () => (PREFS.lugares || []).map(p => Object.assign({ k: norm(p.n), custom: true }, p));
const allPlaces = () => placesSaved().concat(MUN);
const placeSub = p => [p.sub, DEPT[p.d]].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ") + (p.cap ? " · capital" : "");
function searchMuni(q, limit) {
  q = norm(q); if (!q) return [];
  const a = ALIAS[q] ? norm(ALIAS[q]) : q;
  const res = [];
  allPlaces().forEach(m => { let s = -1; if (m.k === a) s = 0; else if (m.k.startsWith(a)) s = 1; else if (m.k.includes(" " + a)) s = 2; else if (m.k.includes(a)) s = 3;
    else if (norm(DEPT[m.d]).startsWith(a) || norm(m.sub).startsWith(a)) s = 4; if (s >= 0) res.push([s - (m.cap ? .5 : 0) - (m.custom ? .6 : 0), m]); });
  return res.sort((x, y) => x[0] - y[0] || x[1].n.localeCompare(y[1].n, "es")).slice(0, limit || 8).map(r => r[1]);
}
function findMuni(name, dept) {
  if (!name) return null; const q = norm(name); const a = ALIAS[q] ? norm(ALIAS[q]) : q;
  const ex = allPlaces().filter(m => m.k === a); if (ex.length) return ex.find(m => m.d === dept) || ex.find(m => m.custom) || ex.find(m => m.cap) || ex[0];
  return searchMuni(name, 1)[0] || null;
}
const muniLabel = m => m ? m.n + (m.sub ? " (" + m.sub + ")" : "") + (DEPT[m.d] && m.d !== "11" ? ", " + DEPT[m.d] : "") : "";
function evLoc(e) {
  if (!e) return null;
  if (e.lat != null && e.lon != null) return { name: e.city, dept: e.dept, lat: Number(e.lat), lon: Number(e.lon), sub: e.sub || "" };
  if (e.city) { const m = findMuni(e.city, e.dept); if (m) return { name: m.n, dept: m.d, lat: m.lat, lon: m.lon, sub: m.sub || "" }; }
  return null;
}
const locLabel = l => l ? l.name + (l.sub ? " (" + l.sub + ")" : "") + (l.dept && DEPT[l.dept] && l.dept !== "11" ? ", " + DEPT[l.dept] : "") : "";
const locOf = p => p ? { city: p.n, dept: p.d, lat: p.lat, lon: p.lon, sub: p.sub || "" } : { city: "", dept: "", lat: null, lon: null, sub: "" };
const homeLoc = () => PREFS.home && PREFS.home.lat != null ? PREFS.home : DEF_PREFS.home;
const sameLoc = (a, b) => a && b && hav(a, b) < 3;
function savePlace(p) {
  const list = (PREFS.lugares || []).slice();
  if (!list.some(x => norm(x.n) === norm(p.n) && Math.abs(x.lat - p.lat) < .02 && Math.abs(x.lon - p.lon) < .02)) {
    list.unshift({ n: p.n, d: p.d || "", lat: +(+p.lat).toFixed(4), lon: +(+p.lon).toFixed(4), sub: p.sub || "" }); savePrefs({ lugares: list.slice(0, 60) }, true);
  }
}
/* Búsqueda en OpenStreetMap para pueblos, corregimientos y veredas */
async function osmSearch(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=co&accept-language=es&q=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { "Accept": "application/json" } }); const j = await r.json();
  const deptOf = st => { const s = norm(st).replace(/^departamento de(l)? /, ""); if (s.includes("bogota")) return "11"; return Object.keys(DEPT).find(c => norm(DEPT[c]) === s || s.includes(norm(DEPT[c]))) || ""; };
  return (j || []).filter(x => x.lat && x.lon).map(x => { const a = x.address || {};
    const n = x.name || a.village || a.hamlet || a.town || a.city || q;
    const sub = a.municipality || a.county || a.city || a.town || "";
    return { n, d: deptOf(a.state || ""), lat: +x.lat, lon: +x.lon, sub: norm(sub) === norm(n) ? "" : sub, k: norm(n), osm: true }; })
    .filter((v, i, arr) => arr.findIndex(w => w.k === v.k && Math.abs(w.lat - v.lat) < .01) === i);
}

/* Buscador reutilizable */
function makeCombo(box, input, onPick) {
  let list = null, items = [], act = -1, tok = 0;
  function close() { if (list) { list.remove(); list = null; } act = -1; }
  function draw(html) { close(); list = document.createElement("div"); list.className = "combo-list"; list.setAttribute("role", "listbox"); list.innerHTML = html; box.appendChild(list);
    list.addEventListener("pointerdown", e => { const b = e.target.closest("button"); if (!b) return; e.preventDefault();
      if (b.dataset.osm != null) return osm(); pick(items[+b.dataset.i]); }); }
  const row = (m, i) => `<button type="button" role="option" data-i="${i}"><span>${esc(m.n)}${m.custom ? ' <span class="badge" style="--c:var(--acc);padding:0 6px;font-size:.66rem">guardado</span>' : ""}</span><span class="d">${esc(placeSub(m))}</span></button>`;
  function render() {
    const q = input.value.trim(); if (!q) return close();
    items = searchMuni(q, 7);
    draw((items.length ? items.map(row).join("") : `<div class="empty">No está en la lista de municipios.</div>`) +
      `<button type="button" class="more" data-osm>${ico("buscar")}Buscar "${esc(q)}" en pueblos y veredas</button>`);
  }
  async function osm() {
    const q = input.value.trim(); if (!q) return; const my = ++tok;
    draw(`<div class="empty">Buscando "${esc(q)}" en OpenStreetMap…</div>`);
    try { const r = await osmSearch(q); if (my !== tok) return; items = r;
      draw(r.length ? r.map(row).join("") : `<div class="empty">No encontré "${esc(q)}". Prueba con otro nombre o usa tu ubicación.</div>`); }
    catch (e) { if (my === tok) draw(`<div class="empty">No pude buscar en internet ahora. Intenta de nuevo.</div>`); }
  }
  function pick(m) { if (!m) return; if (m.osm) { savePlace(m); toast("Guardé " + m.n + " en tus lugares.", "ok", "toque"); } input.value = muniLabel(m); input.dataset.picked = "1"; close(); onPick(m); }
  input.addEventListener("input", () => { input.dataset.picked = ""; tok++; render(); });
  input.addEventListener("focus", () => { if (input.value && !input.dataset.picked) render(); });
  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", e => {
    if (!list) return; const bs = [...list.querySelectorAll("button")];
    if (e.key === "ArrowDown") { e.preventDefault(); act = Math.min(bs.length - 1, act + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, act - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const b = bs[act < 0 ? 0 : act]; if (!b) return; if (b.dataset.osm != null) osm(); else pick(items[+b.dataset.i]); return; }
    else if (e.key === "Escape") { close(); return; } else return;
    bs.forEach((b, i) => b.classList.toggle("act", i === act)); bs[act] && bs[act].scrollIntoView({ block: "nearest" });
  });
  return { set(m) { input.value = m ? muniLabel(m) : ""; input.dataset.picked = m ? "1" : ""; }, close };
}

/* ───────────────────────── Rutas (carretera) ─────────────────────────
   Distancia y tiempo por carretera con OSRM (datos de OpenStreetMap).
   Si no responde, se estima. Islas y lugares sin vía: vuelo. */
const RCACHE = lsGet("cronova.rutas", {});
let rQueue = Promise.resolve();
function rKey(a, b) { return [a.lat, a.lon, b.lat, b.lon].map(x => Number(x).toFixed(3)).join(","); }
function flightEst(km) { return { km, min: 90 + km / 700 * 60 + 60, src: "vuelo", geom: null }; }
function routeInfo(a, b) {
  if (!a || !b) return Promise.resolve(null);
  const straight = hav(a, b);
  if (straight < 1.5) return Promise.resolve({ km: 0, min: 0, src: "local", geom: null });
  const k = rKey(a, b); if (RCACHE[k]) return Promise.resolve(RCACHE[k]);
  if (a.dept === "88" || b.dept === "88" || straight > 1100) { const r = flightEst(straight); RCACHE[k] = r; return Promise.resolve(r); }
  const job = rQueue.then(async () => {
    if (RCACHE[k]) return RCACHE[k];
    let res = null;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`, { signal: ctl.signal });
      clearTimeout(to);
      const j = await r.json();
      if (j.code === "Ok" && j.routes && j.routes[0]) {
        const km = j.routes[0].distance / 1000, min = j.routes[0].duration / 60 * 1.2;
        if (km > straight * 3.2 && straight > 150) res = flightEst(straight);
        else { let g = j.routes[0].geometry.coordinates; if (g.length > 300) { const st = Math.ceil(g.length / 300); g = g.filter((_, i) => i % st === 0).concat([g[g.length - 1]]); }
          res = { km, min, src: "osrm", geom: g.map(p => [+p[0].toFixed(4), +p[1].toFixed(4)]) }; }
      } else if (j.code === "NoRoute") res = flightEst(straight);
    } catch (e) { /* sin conexión o servidor ocupado */ }
    if (!res) return { km: straight * 1.35, min: straight * 1.35 / 50 * 60, src: "aprox", geom: null };
    RCACHE[k] = res; const keys = Object.keys(RCACHE); if (keys.length > 120) delete RCACHE[keys[0]]; lsSet("cronova.rutas", RCACHE);
    await new Promise(r => setTimeout(r, 350));
    return res;
  });
  rQueue = job.catch(() => {});
  return job;
}
const wazeUrl = l => `https://www.waze.com/ul?ll=${l.lat}%2C${l.lon}&navigate=yes`;
const tripText = r => !r ? "" : r.src === "local" ? "Mismo lugar" : r.src === "vuelo" ? `Vuelo · ${fmtKm(r.km)} · ~${fmtDur(r.min)} con aeropuerto` : `${fmtKm(r.km)} · ${r.src === "aprox" ? "≈" : "~"}${fmtDur(r.min)}`;

/* ───────────────────────── Nube (Supabase) ───────────────────────── */
const SUPA_URL = "https://llyovzgwdqoeunvyczcy.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxseW92emd3ZHFvZXVudnljemN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzUzNjcsImV4cCI6MjEwNjAxMTM2N30.g1DgUdTGPHDz8HEI1Kgv4SOJ13zyOwOfcAp8Ak2BRGQ";
const S = { events: [], emails: [], calls: [], mode: "local", prefsNube: null };
const COLLS = ["events", "emails", "calls"];
let supa = null, session = null, channel = null;
const LKEY = "orbita.cache.v1", QKEY = "orbita.pendientes.v1";   // mismas llaves que la versión anterior: no se pierde nada
function loadLocal() { const j = lsGet(LKEY, null); if (j) COLLS.forEach(c => S[c] = j[c] || []); }
function saveLocal() { lsSet(LKEY, { events: S.events, emails: S.emails, calls: S.calls }); }
let queue = lsGet(QKEY, {});
function saveQueue() { lsSet(QKEY, queue); }
let flushing = false;
async function flush() {
  if (!supa || !session || flushing) return;
  const rows = Object.values(queue); if (!rows.length) return;
  flushing = true;
  try {
    const { error } = await supa.from("orb_items").upsert(rows, { onConflict: "user_id,coleccion,id" });
    if (!error) { rows.forEach(r => { const k = r.coleccion + "/" + r.id; if (queue[k] === r) delete queue[k]; }); saveQueue(); } else console.warn(error);
  } catch (e) { console.warn(e); }
  flushing = false; setSync();
}
window.addEventListener("online", flush); setInterval(flush, 60000);
async function push(row) { queue[row.coleccion + "/" + row.id] = row; saveQueue(); setSync(); await flush(); }
function rowFor(coll, item, deleted) { const { id, ...data } = item; return { coleccion: coll, id, data, deleted_at: deleted ? new Date().toISOString() : null }; }
function invalidateMonths(coll) { if (coll === "events") { monthKm = {}; monthWarn = {}; } }
async function addDoc(coll, data) { invalidateMonths(coll); const id = uid(); const item = { id, ...data, createdAt: Date.now() }; S[coll].push(item); saveLocal(); renderAll(); await push(rowFor(coll, item)); return id; }
async function updDoc(coll, id, patch) { invalidateMonths(coll); const it = S[coll].find(x => x.id === id); if (!it) return; Object.assign(it, patch); saveLocal(); renderAll(); await push(rowFor(coll, it)); }
async function delDoc(coll, id) { invalidateMonths(coll); const it = S[coll].find(x => x.id === id); if (!it) return; S[coll] = S[coll].filter(x => x.id !== id); saveLocal(); renderAll(); await push(rowFor(coll, it, true)); }
function applyRow(r) {
  if (r.coleccion === "config") { if (r.id === "prefs" && r.data && !r.deleted_at) { PREFS = Object.assign({}, DEF_PREFS, PREFS, r.data); lsSet("cronova.prefs", PREFS); applyPrefs(); } return; }
  const c = r.coleccion; if (!S[c] || queue[c + "/" + r.id]) return;
  const i = S[c].findIndex(x => x.id === r.id);
  if (r.deleted_at) { if (i >= 0) S[c].splice(i, 1); return; }
  const it = { id: r.id, ...r.data }; if (i >= 0) S[c][i] = it; else S[c].push(it);
}
async function pushPrefs() {
  if (!supa || !session || S.prefsNube === false) return;
  const { error } = await supa.from("orb_items").upsert([{ coleccion: "config", id: "prefs", data: PREFS, deleted_at: null }], { onConflict: "user_id,coleccion,id" });
  if (error) { if (String(error.code) === "23514") S.prefsNube = false; console.warn(error); } else S.prefsNube = true;
  if (current === "ajustes") renderSettings();
}
function setSync() {
  const n = Object.keys(queue).length; const online = S.mode === "db";
  const p = $("#syncPill"); p.dataset.estado = online ? (n ? "pend" : "ok") : "off";
  $("#syncTxt").textContent = online ? (n ? n + " por subir" : "Guardado en la nube") : "Sin conexión";
  $("#userEmail").textContent = session && session.user ? session.user.email : "";
  const rc = S.calls.filter(c => c.status === "ready").length, um = S.emails.filter(m => !m.read).length;
  $("#badgeCalls").hidden = !rc; $("#badgeCalls").textContent = rc; $("#badgeMail").hidden = !um; $("#badgeMail").textContent = um;
}
let gotPrefs = false;
async function loadAll() {
  const out = { events: [], emails: [], calls: [] }; let from = 0;
  for (;;) {
    const { data, error } = await supa.from("orb_items").select("coleccion,id,data,deleted_at").is("deleted_at", null).range(from, from + 999);
    if (error) throw error;
    data.forEach(r => { if (out[r.coleccion]) out[r.coleccion].push({ id: r.id, ...r.data }); else if (r.coleccion === "config") { gotPrefs = true; applyRow(r); } });
    if (data.length < 1000) break; from += 1000;
  }
  COLLS.forEach(c => S[c] = out[c]);
  Object.values(queue).forEach(r => { const c = r.coleccion; if (!S[c]) return; const i = S[c].findIndex(x => x.id === r.id);
    if (r.deleted_at) { if (i >= 0) S[c].splice(i, 1); return; } const it = { id: r.id, ...r.data }; if (i >= 0) S[c][i] = it; else S[c].push(it); });
}
async function onLogin(s) {
  session = s; $("#login").hidden = true;
  try { await flush(); await loadAll(); S.mode = "db"; saveLocal(); if (!gotPrefs) pushPrefs(); }
  catch (e) { console.warn(e); S.mode = "local"; toast("No pude leer la nube. Te muestro la copia guardada en este equipo.", "bad"); }
  renderAll();
  if (channel) supa.removeChannel(channel);
  channel = supa.channel("cronova-" + s.user.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "orb_items", filter: "user_id=eq." + s.user.id }, p => { if (p.new && p.new.coleccion) { applyRow(p.new); saveLocal(); renderAll(); } })
    .subscribe();
}
function showLogin() { session = null; S.mode = "local"; $("#login").hidden = false; setSync(); }
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#lErr").textContent = ""; $("#lBtn").disabled = true;
  const { data, error } = await supa.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
  $("#lBtn").disabled = false;
  if (error) { $("#lErr").textContent = "Correo o contraseña incorrectos."; Sfx.play("error"); return; }
  Sfx.play("guardar"); onLogin(data.session);
});
async function initStore() {
  loadLocal(); renderAll();
  if (!window.supabase) { toast("No se pudo cargar la conexión a la nube.", "bad"); return; }
  supa = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  supa.auth.onAuthStateChange((ev, s) => { if (ev === "SIGNED_OUT") { COLLS.forEach(c => S[c] = []); saveLocal(); showLogin(); renderAll(); } else if (s) session = s; });
  const { data } = await supa.auth.getSession();
  if (data && data.session) await onLogin(data.session); else showLogin();
}

/* ───────────────────────── Navegación y barra superior ───────────────────────── */
const VIEWS = ["inicio", "agenda", "mapa", "asistente", "llamadas", "correo", "ajustes"];
let current = "inicio";
function route() {
  const h = (location.hash || "").slice(1); const prev = current;
  current = VIEWS.includes(h) ? h : "inicio";
  VIEWS.forEach(v => { const el = $("#v-" + v); el.hidden = v !== current; if (v === current && v !== prev) { el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); } });
  $$("[data-v]").forEach(a => a.setAttribute("aria-current", a.dataset.v === current ? "page" : "false"));
  if (current === "mapa") startMap(); else if (MAP) MAP.stop();
  closeSheet(true); renderAll();
  if (prev !== current) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
function greetWord(d) { const h = d.getHours(); return h >= 5 && h < 12 ? "Buenos días" : h >= 12 && h < 19 ? "Buenas tardes" : "Buenas noches"; }
let lastDay = TODAY();
function tickClock() {
  const n = NOW();
  $("#greetWord").textContent = greetWord(n);
  $("#clock").innerHTML = fmtClock(n) + `<small>${pad(n.getSeconds())} ${n.getHours() >= 12 ? "p. m." : "a. m."}</small>`;
  const dl = fmtDayY(n); $("#todayLine").innerHTML = esc(dl[0].toUpperCase() + dl.slice(1)) + `<span class="left"> · quedan ${daysLeftYear()} días del año</span>`;
  if (current === "inicio") updateCountdown();
  if (TODAY() !== lastDay) { lastDay = TODAY(); if (calM < minMonth()) calM = minMonth(); if (isPastDay(selDay)) selDay = TODAY(); renderAll(); }
}
setInterval(tickClock, 1000);
$("#newBtnTop").addEventListener("click", () => openEventSheet());
$("#newBtnTab").addEventListener("click", () => openEventSheet());
$("#moreBtn").addEventListener("click", () => {
  const sh = openSheet(`<div class="sheet-h"><h2>Más</h2><button class="icon-btn" data-close aria-label="Cerrar">${ico("x")}</button></div>
    <div class="more-grid">
      <a href="#llamadas">${ico("llamada")}Llamadas<span>Guiones con IA</span></a>
      <a href="#correo">${ico("correo")}Correo<span>Compromisos en tu bandeja</span></a>
      <a href="#mapa">${ico("mapa")}Mapa y rutas<span>Km y tiempos del mes</span></a>
      <a href="#ajustes">${ico("ajustes")}Ajustes<span>Color, casa, sonidos</span></a>
    </div>`, { label: "Más opciones" });
  sh.querySelectorAll("a").forEach(a => a.addEventListener("click", () => closeSheet(true)));
});

/* ───────────────────────── Selectores ───────────────────────── */
const sorted = () => [...S.events].sort((a, b) => evStart(a) - evStart(b));
const onDay = ds => sorted().filter(e => e.date === ds);
const typeC = t => "c-" + (TYPES[t] ? t : "cita");
const isEx = e => !!e.example;
function findClash(d, skipId) {
  if (!d.time || !d.date) return null; const s = evStart(d), e = new Date(s.getTime() + (Number(d.duration) || 60) * 6e4);
  return S.events.find(x => x.id !== skipId && x.date === d.date && x.time && evStart(x) < e && evEnd(x) > s) || null;
}
function prevLocated(d, skipId) {   // lugar desde donde llegas a esta cita: la cita anterior del mismo día con lugar, o tu casa
  const s = evStart(d);
  const prev = sorted().filter(x => x.id !== skipId && x.date === d.date && x.time && evStart(x) < s && evLoc(x)).pop();
  return prev ? { loc: evLoc(prev), ev: prev } : { loc: homeLoc(), ev: null };
}

/* ───────────────────────── INICIO ───────────────────────── */
let nextEv = null, nextTrip = null, nextTripFor = "";
const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function renderInicio() {
  const now = NOW(); const all = sorted(); const y = now.getFullYear();
  $("#homeTitle").textContent = cap1(fmtDay(now));
  const pct = dayOfYear() / daysInYear(y);
  $("#homeSub").innerHTML = `Quedan <b style="color:var(--text)">${daysLeftYear()} días</b> de ${y} <div class="progress" style="width:min(260px,60vw);margin-top:6px"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>`;
  const up = all.filter(e => !e.done && evEnd(e) >= now);
  nextEv = up[0] || null;
  // Avisos importantes arriba (solo si hay)
  const bn = [];
  up.filter(e => evStart(e) - now < 2 * 36e5 && evStart(e) > now).forEach(e => bn.push(["red", "alerta", `En ${fmtDur((evStart(e) - now) / 6e4)}: ${e.title}`]));
  all.filter(e => !e.done && evEnd(e) < new Date(now - 30 * 6e4) && now - evStart(e) < 7 * 864e5).slice(0, 2).forEach(e => bn.push(["", "info", `¿Asististe a "${e.title}"?`, e.id]));
  (monthWarn[y + "-" + now.getMonth()] || []).slice(0, 2).forEach(w => bn.push(["red", "carro", w]));
  const readyCalls = S.calls.filter(c => c.status === "ready").length;
  if (readyCalls) bn.push(["blue", "llamada", readyCalls === 1 ? "Tienes 1 llamada lista para hacer" : `Tienes ${readyCalls} llamadas listas para hacer`, null, "#llamadas"]);
  $("#banners").innerHTML = bn.map(b => `<div class="banner ${b[0]}">${ico(b[1])}<div class="x">${esc(b[2])}</div>${b[3] ? `<button class="btn sm" data-done="${esc(b[3])}">Sí, asistí</button>` : ""}${b[4] ? `<a class="btn sm" href="${b[4]}">Ver</a>` : ""}</div>`).join("");
  // Indicadores
  const t = TODAY(); const wEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const nHoy = onDay(t).filter(e => !e.done).length, nSem = all.filter(e => e.date >= t && evStart(e) < wEnd).length;
  const K = [["k-azul", "agenda", nHoy, "Hoy", nHoy ? "por cumplir" : "día libre", "#agenda"], ["k-morado", "reloj", nSem, "Próximos 7 días", "compromisos", "#agenda"],
    ["k-naranja", "campana", up.length, "Pendientes", "de hoy en adelante", "#agenda"], ["k-verde", "llamada", readyCalls, "Llamadas", "por hacer", "#llamadas"]];
  $("#kpis").innerHTML = K.map(k => `<a class="card kpi ${k[0]} ${k[2] ? "" : "cero"}" href="${k[5]}"><span class="k-ico">${ico(k[1])}</span><span class="k-num">${k[2]}</span><span class="k-lbl">${k[3]}</span><span class="k-sub">${k[4]}</span></a>`).join("");
  // Próximo compromiso
  const nc = $("#nextCard");
  if (!nextEv) {
    nc.style.removeProperty("--c");
    nc.innerHTML = `<div class="eyebrow">Próximo compromiso</div><div class="next-title">Tu agenda está libre</div><p class="muted" style="margin:0">Agrega una cita o pídele a la IA que te organice.</p>
      <div class="actions"><button class="btn primary" data-new>${ico("plus")}Nueva cita</button><a class="btn" href="#asistente">${ico("ia")}Hablar con la IA</a></div>`;
  } else {
    const L = evLoc(nextEv); nc.style.setProperty("--c", `var(--t-${TYPES[nextEv.type] ? nextEv.type : "cita"})`);
    nc.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="eyebrow">Próximo compromiso</span><span class="badge ${typeC(nextEv.type)}"><i></i>${TYPES[nextEv.type] || "Cita"}</span>${isEx(nextEv) ? '<span class="tag">EJEMPLO</span>' : ""}</div>
      <div class="next-title">${esc(nextEv.title)}</div>
      <div class="meta-row"><span>${ico("agenda")}${esc(cap1(relDay(nextEv.date) || fmtDay(evStart(nextEv))))}</span><span>${ico("reloj")}${fmtTime(nextEv.time)}</span>${L ? `<span>${ico("pin")}${esc(locLabel(L))}${nextEv.place ? " · " + esc(nextEv.place) : ""}</span>` : ""}</div>
      <div class="count" id="countdown"></div>
      <div id="nextTrip"></div>
      <div class="actions">${L ? `<a class="btn sm waze" href="${wazeUrl(L)}" target="_blank" rel="noopener">${ico("nav")}Waze</a>` : ""}<button class="btn sm" data-done="${esc(nextEv.id)}">${ico("check")}Cumplida</button><button class="btn sm ghost" data-edit="${esc(nextEv.id)}">${ico("edit")}Editar</button></div>`;
    updateCountdown();
    if (L && !sameLoc(L, homeLoc())) {
      const key = nextEv.id + rKey(homeLoc(), L);
      const paint = r => { const box = $("#nextTrip"); if (!box || !r) return;
        const leave = new Date(evStart(nextEv).getTime() - (r.min + 15) * 6e4);
        box.innerHTML = `<div class="trip">${ico(r.src === "vuelo" ? "avion" : "carro")}<span>Desde tu casa: <b>${tripText(r)}</b></span>${r.src !== "vuelo" && nextEv.time ? `<span>· sal antes de las <b>${fmtClock(leave)} ${leave.getHours() >= 12 ? "p. m." : "a. m."}</b>${ymd(leave) !== nextEv.date ? " (" + fmtShort(leave) + ")" : ""}</span>` : ""}</div>`; };
      if (nextTripFor === key && nextTrip) paint(nextTrip);
      else { $("#nextTrip").innerHTML = `<div class="trip">${ico("carro")}Calculando el trayecto desde tu casa…</div>`;
        routeInfo(homeLoc(), L).then(r => { nextTrip = r; nextTripFor = key; paint(r); }); }
    }
  }
  // Hoy y próximos días
  const tdy = onDay(t);
  $("#todayCount").textContent = tdy.length ? tdy.length + " en agenda" : "";
  $("#todayTl").innerHTML = tdy.length ? tdy.map(e => tlItem(e)).join("") : `<div class="empty">${ico("agenda")}Hoy no tienes nada agendado.<button class="btn sm" data-new>${ico("plus")}Agregar algo para hoy</button></div>`;
  const wk = all.filter(e => e.date > t && evStart(e) < wEnd);
  $("#weekTl").innerHTML = wk.length ? wk.slice(0, 6).map(e => tlItem(e, true)).join("") + (wk.length > 6 ? `<a class="btn sm ghost" href="#agenda">+${wk.length - 6} más</a>` : "") : `<div class="empty">${ico("reloj")}Semana despejada.</div>`;
  if (!$("#brief").dataset.filled) $("#brief").innerHTML = `<span class="muted">Toca <b>Generar</b> y la IA junta tus citas de hoy, lo de mañana y tus correos sin leer en un solo resumen.</span>`;
  const wkKey = y + "-" + now.getMonth();
  if (monthKm[wkKey] == null && MUN.length && !monthBusy[wkKey]) { monthBusy[wkKey] = 1; computeMonth(y, now.getMonth()).then(() => { delete monthBusy[wkKey]; if (current === "inicio" && (monthWarn[wkKey] || []).length) renderInicio(); }); }
}
function updateCountdown() {
  const box = $("#countdown"); if (!box || !nextEv) return;
  const ms = evStart(nextEv) - NOW();
  if (ms <= 0) { box.innerHTML = `<div><b style="color:var(--ok)">Ahora</b><span>en curso</span></div>`; return; }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  box.innerHTML = (d ? `<div><b>${d}</b><span>${d === 1 ? "día" : "días"}</span></div>` : "") + `<div><b>${pad(h)}</b><span>horas</span></div><div><b>${pad(m)}</b><span>min</span></div><div><b>${pad(s)}</b><span>seg</span></div>`;
}
function tlItem(e, withDate) {
  const L = evLoc(e); const c = `var(--t-${TYPES[e.type] ? e.type : "cita"})`;
  return `<div class="tl-item ${e.done ? "done" : ""}" style="--c:${c}"><div class="tl-time">${e.time || "—"}${withDate ? `<small>${esc(fmtShort(evStart(e)))}</small>` : ""}</div>
    <div class="tl-body"><div class="t">${esc(e.title)} ${isEx(e) ? '<span class="tag">EJEMPLO</span>' : ""}</div><div class="s">${esc(TYPES[e.type] || "")}${L ? " · " + esc(L.name) : ""}${e.place ? " · " + esc(e.place) : ""}</div></div>
    <button class="icon-btn" data-toggle="${esc(e.id)}" aria-label="${e.done ? "Marcar pendiente" : "Marcar cumplida"}" title="${e.done ? "Marcar pendiente" : "Marcar cumplida"}">${ico("check")}</button></div>`;
}

/* Acciones comunes con delegación */
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-toggle],[data-done],[data-edit],[data-del],[data-day],[data-goday],[data-new],[data-mapto],[data-sec]");
  if (!t) return;
  if (t.dataset.toggle) { const e = S.events.find(x => x.id === t.dataset.toggle); if (e) { updDoc("events", e.id, { done: !e.done }); if (!e.done) toast("¡Cumplida! " + e.title, "ok", "completar"); else Sfx.play("toque"); } }
  else if (t.dataset.done) { updDoc("events", t.dataset.done, { done: true }); toast("Marcada como cumplida.", "ok", "completar"); }
  else if (t.dataset.edit) { const e = S.events.find(x => x.id === t.dataset.edit); if (e) openEventSheet(e); }
  else if (t.dataset.del) confirmDelete(t.dataset.del);
  else if (t.dataset.day) { const ds = t.dataset.day; selDay = ds; renderAgenda(); Sfx.play("toque"); if (matchMedia("(max-width:1180px)").matches) $(".side-panel").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); }
  else if (t.dataset.goday) { selDay = t.dataset.goday; calM = monthStart(parseYmd(selDay)); agView = "mes"; location.hash = "#agenda"; }
  else if (t.hasAttribute("data-new")) openEventSheet(null, t.dataset.newdate ? { date: t.dataset.newdate } : null);
  else if (t.dataset.mapto) { const e = S.events.find(x => x.id === t.dataset.mapto); if (e) { mapM = monthStart(parseYmd(e.date)); pendingFly = evLoc(e); location.hash = "#mapa"; } }
  else if (t.dataset.sec) { ev.preventDefault(); const el = document.getElementById(t.dataset.sec); if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); }
});
function confirmDelete(id) {
  const e = S.events.find(x => x.id === id); if (!e) return;
  openSheet(`<div class="sheet-h"><h2>¿Eliminar este evento?</h2><button class="icon-btn" data-close aria-label="Cerrar">${ico("x")}</button></div>
    <p class="muted" style="margin:0"><b style="color:var(--fg)">${esc(e.title)}</b> · ${esc(fmtDay(evStart(e)))} ${fmtTime(e.time)}</p>
    <p class="dim" style="margin:0;font-size:.82rem">Queda guardado en el historial de la nube por si lo necesitas recuperar.</p>
    <div class="sheet-f"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" id="delOk">${ico("trash")}Eliminar</button></div>`, { label: "Eliminar evento" });
  $("#delOk").addEventListener("click", () => { closeSheet(); delDoc("events", id); toast("Evento eliminado.", "", "borrar"); });
}

/* ───────────────────────── AGENDA ───────────────────────── */
let calM = minMonth(), selDay = TODAY(), agView = "mes";
function renderAgenda() {
  if (calM < minMonth()) calM = minMonth(); if (calM > maxMonth()) calM = maxMonth();
  $("#agSub").textContent = "Desde hoy hasta el 31 de diciembre de " + (NOW().getFullYear() + 1) + ".";
  $("#calMonth").textContent = cap1(MONTHS[calM.getMonth()]) + " " + calM.getFullYear();
  $("#calPrev").disabled = calM <= minMonth(); $("#calNext").disabled = calM >= maxMonth();
  $("#vwMes").setAttribute("aria-pressed", agView === "mes"); $("#vwLista").setAttribute("aria-pressed", agView === "lista");
  $("#calWrap").hidden = agView !== "mes"; $("#listWrap").hidden = agView !== "lista";
  if (agView === "lista") return renderUpList();
  const first = new Date(calM), offset = (first.getDay() + 6) % 7, start = new Date(first); start.setDate(1 - offset);
  const today = TODAY();
  let html = DOWS.map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (i >= 35 && d.getMonth() !== calM.getMonth()) break;
    const ds = ymd(d), out = d.getMonth() !== calM.getMonth(), evs = onDay(ds), past = isPastDay(ds);
    html += `<button type="button" class="day ${out ? "out" : ""} ${ds === today ? "today" : ""} ${ds === selDay ? "sel" : ""} ${past ? "past" : ""}" ${out ? 'tabindex="-1" aria-hidden="true"' : `data-day="${ds}"`} aria-label="${esc(fmtDay(d))}${past ? " (ya pasó)" : ""}, ${evs.length} eventos">
      <span class="n"><b>${d.getDate()}</b></span>
      ${evs.slice(0, 3).map(e => `<span class="ev" style="--c:var(--t-${TYPES[e.type] ? e.type : "cita"})">${esc((e.time ? e.time + " " : "") + e.title)}</span>`).join("")}
      ${evs.length > 3 ? `<span class="more">+${evs.length - 3} más</span>` : ""}</button>`;
  }
  $("#cal").innerHTML = html;
  $("#legend").innerHTML = Object.entries(TYPES).map(([k, v]) => `<span class="badge c-${k}"><i></i>${v}</span>`).join("");
  const sd = parseYmd(selDay), rel = relDay(selDay), past = isPastDay(selDay);
  $("#dayBig").innerHTML = `<span class="d">${sd.getDate()}</span><div><div class="t">${esc(rel || cap1(sd.toLocaleDateString("es-CO", { weekday: "long" })))}</div><div class="s">${esc(cap1(fmtDay(sd)))}</div></div>`;
  const list = onDay(selDay);
  $("#dayList").innerHTML = list.length ? list.map(evCard).join("") : `<div class="empty">${ico(past ? "reloj" : "agenda")}${past ? "Este día ya pasó." : "Día libre."}</div>`;
  const add = $("#dayAdd"); add.disabled = past; add.innerHTML = past ? `${ico("info")}Este día ya pasó` : `${ico("plus")}Agregar en este día`;
}
function evCard(e) {
  const L = evLoc(e); const c = `var(--t-${TYPES[e.type] ? e.type : "cita"})`;
  return `<div class="ev-card ${e.done ? "done" : ""}" style="--c:${c}">
    <div class="top"><span class="badge ${typeC(e.type)}"><i></i>${TYPES[e.type] || "Cita"}</span>${e.done ? '<span class="badge" style="--c:var(--ok)">Cumplida</span>' : ""}${isEx(e) ? '<span class="tag">EJEMPLO</span>' : ""}</div>
    <div class="t">${esc(e.title)}</div>
    <div class="s"><b style="color:var(--text)">${fmtTime(e.time)}</b> · ${fmtDur(Number(e.duration) || 60)}${L ? " · " + esc(locLabel(L)) : ""}${e.place ? "<br>" + esc(e.place) : ""}${e.contact ? "<br>Con: " + esc(e.contact) : ""}${e.notes ? `<br><span style="color:var(--text)">${esc(e.notes)}</span>` : ""}</div>
    <div class="acts"><button class="btn sm ${e.done ? "" : "ok"}" data-toggle="${esc(e.id)}">${ico("check")}${e.done ? "Pendiente" : "Cumplida"}</button>${L ? `<a class="btn sm waze" href="${wazeUrl(L)}" target="_blank" rel="noopener">${ico("nav")}Waze</a>` : ""}<button class="btn sm" data-edit="${esc(e.id)}">${ico("edit")}Editar</button><button class="btn sm danger" data-del="${esc(e.id)}" aria-label="Eliminar">${ico("trash")}</button></div></div>`;
}
function renderUpList() {
  const t = TODAY(); const evs = sorted().filter(e => e.date >= t);
  if (!evs.length) { $("#upList").innerHTML = `<div class="empty">${ico("agenda")}No tienes compromisos de hoy en adelante.<button class="btn sm primary" data-new>${ico("plus")}Agendar algo</button></div>`; return; }
  const groups = {}; evs.forEach(e => (groups[e.date] = groups[e.date] || []).push(e));
  $("#upList").innerHTML = Object.entries(groups).map(([ds, list]) => { const d = parseYmd(ds); const rel = relDay(ds); const dl = Math.round((d - parseYmd(t)) / 864e5);
    return `<div class="list-group"><div class="list-h">${rel ? rel + " · " : ""}${esc(fmtDay(d))}${!rel ? ` · en ${dl} días` : ""}</div>${list.map(evCard).join("")}</div>`; }).join("");
}
$("#calPrev").addEventListener("click", () => { calM = new Date(calM.getFullYear(), calM.getMonth() - 1, 1); renderAgenda(); });
$("#calNext").addEventListener("click", () => { calM = new Date(calM.getFullYear(), calM.getMonth() + 1, 1); renderAgenda(); });
$("#calToday").addEventListener("click", () => { calM = minMonth(); selDay = TODAY(); agView = "mes"; renderAgenda(); });
$("#vwMes").addEventListener("click", () => { agView = "mes"; renderAgenda(); });
$("#vwLista").addEventListener("click", () => { agView = "lista"; renderAgenda(); });
$("#dayAdd").addEventListener("click", () => { if (!isPastDay(selDay)) openEventSheet(null, { date: selDay }); });

/* ───────────────────────── Hoja de cita ───────────────────────── */
function openEventSheet(e, preset) {
  const editing = !!e; const d = Object.assign({ title: "", type: "cita", date: TODAY(), time: "09:00", duration: 60, place: "", contact: "", notes: "" }, preset || {}, e || {});
  if (!editing && isPastDay(d.date)) d.date = TODAY();
  let muni = e ? (() => { const l = evLoc(e); return l ? { n: l.name, d: l.dept, lat: l.lat, lon: l.lon, sub: l.sub || "" } : null; })() : (preset && preset.muni) || null;
  const minD = editing && d.date < TODAY() ? d.date : TODAY();
  const tom = parseYmd(TODAY()); tom.setDate(tom.getDate() + 1);
  const nm = parseYmd(TODAY()); nm.setDate(nm.getDate() + ((8 - nm.getDay()) % 7 || 7));
  const sh = openSheet(`<div class="sheet-h"><div><div class="eyebrow">${editing ? "Editar" : "Nueva"}</div><h2>${editing ? "Editar evento" : "Agendar"}</h2></div><button class="icon-btn" data-close aria-label="Cerrar">${ico("x")}</button></div>
    <form id="evForm" style="display:flex;flex-direction:column;gap:14px" autocomplete="off">
      <input class="in big" id="fTitle" required placeholder="¿Qué tienes?" value="${esc(d.title)}" autofocus>
      <div class="seg" role="group" aria-label="Tipo">${Object.entries(TYPES).map(([k, v]) => `<button type="button" class="c-${k}" data-type="${k}" aria-pressed="${d.type === k}">${v}</button>`).join("")}</div>
      <div class="row2">
        <label class="field"><span>Fecha</span><input class="in" id="fDate" type="date" required min="${minD}" max="${MAXDATE()}" value="${esc(d.date)}"></label>
        <label class="field"><span>Hora</span><input class="in" id="fTime" type="time" value="${esc(d.time)}"></label>
      </div>
      <div class="seg" aria-label="Fechas rápidas"><button type="button" data-qd="${TODAY()}">Hoy</button><button type="button" data-qd="${ymd(tom)}">Mañana</button><button type="button" data-qd="${ymd(nm)}">Próximo lunes</button>
        <span style="flex:1"></span>${[30, 60, 120, 240].map(m => `<button type="button" data-dur="${m}" aria-pressed="${Number(d.duration) === m}">${fmtDur(m)}</button>`).join("")}</div>
      <div class="field"><span>¿Dónde?</span><div class="combo" id="fMuniBox"><input class="in" id="fMuni" placeholder="Municipio, pueblo, corregimiento o vereda" autocomplete="off"></div></div>
      <div id="fTrip"></div>
      <label class="field"><span>Lugar o dirección</span><input class="in" id="fPlace" placeholder="Clínica, oficina, dirección…" value="${esc(d.place)}"></label>
      <label class="field"><span>Con quién</span><input class="in" id="fContact" placeholder="Nombre o teléfono" value="${esc(d.contact)}"></label>
      <label class="field"><span>Notas</span><textarea class="in" id="fNotes" placeholder="Qué llevar, qué preparar…">${esc(d.notes)}</textarea></label>
      <div class="sheet-f">${editing ? `<button type="button" class="btn danger" id="fDel" style="margin-right:auto">${ico("trash")}Eliminar</button>` : ""}<button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">${ico("check")}${editing ? "Guardar cambios" : "Agendar"}</button></div>
    </form>`, { label: editing ? "Editar evento" : "Nueva cita" });
  let type = d.type, dur = Number(d.duration) || 60;
  const combo = makeCombo($("#fMuniBox"), $("#fMuni"), m => { muni = m; Sfx.play("toque"); preview(); });
  combo.set(muni);
  sh.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => { type = b.dataset.type; sh.querySelectorAll("[data-type]").forEach(x => x.setAttribute("aria-pressed", x === b)); }));
  sh.querySelectorAll("[data-dur]").forEach(b => b.addEventListener("click", () => { dur = +b.dataset.dur; sh.querySelectorAll("[data-dur]").forEach(x => x.setAttribute("aria-pressed", x === b)); preview(); }));
  sh.querySelectorAll("[data-qd]").forEach(b => b.addEventListener("click", () => { $("#fDate").value = b.dataset.qd; preview(); }));
  ["#fDate", "#fTime"].forEach(s => $(s).addEventListener("change", preview));
  let pv = 0;
  function preview() {
    const box = $("#fTrip"); if (!box) return; const tok = ++pv;
    const draft = { date: $("#fDate").value, time: $("#fTime").value, duration: dur };
    const parts = [];
    const clash = findClash(draft, e && e.id);
    if (clash) parts.push(`<div class="info warn">${ico("alerta")}<div>Se cruza con <b>${esc(clash.title)}</b> a las ${fmtTime(clash.time)}.</div></div>`);
    if (draft.date && draft.date < TODAY()) parts.push(`<div class="info warn">${ico("alerta")}<div>Esa fecha ya pasó. Elige hoy o un día futuro.</div></div>`);
    box.innerHTML = parts.join("") + (muni ? `<div class="info" style="margin-top:${parts.length ? 8 : 0}px">${ico("carro")}<div class="muted">Calculando trayecto…</div></div>` : "");
    if (!muni) return;
    const from = draft.date && draft.time ? prevLocated(draft, e && e.id) : { loc: homeLoc(), ev: null };
    const to = { name: muni.n, dept: muni.d, lat: muni.lat, lon: muni.lon, sub: muni.sub };
    routeInfo(from.loc, to).then(r => {
      if (tok !== pv || !r) return;
      let warn = "";
      if (from.ev && draft.time && r.min) { const gap = (evStart(draft) - evEnd(from.ev)) / 6e4; if (gap < r.min) warn = `<div class="info warn" style="margin-top:8px">${ico("alerta")}<div>No alcanzas a llegar: necesitas ~${fmtDur(r.min)} desde <b>${esc(from.ev.title)}</b> y solo tienes ${fmtDur(Math.max(0, gap))}.</div></div>`; }
      const src = from.ev ? "Desde " + esc(from.ev.title) + " (" + esc(locLabel(from.loc)) + ")" : "Desde tu casa (" + esc(locLabel(from.loc)) + ")";
      box.innerHTML = parts.join("") + `<div class="info" style="margin-top:${parts.length ? 8 : 0}px">${ico(r.src === "vuelo" ? "avion" : "carro")}<div><b>${r.src === "local" ? "Queda en el mismo municipio" : tripText(r)}</b><br><span class="muted">${src}</span></div></div>` + warn;
    });
  }
  preview();
  if (editing) $("#fDel").addEventListener("click", () => { closeSheet(true); confirmDelete(e.id); });
  $("#evForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const data = { title: $("#fTitle").value.trim(), type, date: $("#fDate").value, time: $("#fTime").value, duration: dur,
      ...locOf(muni),
      place: $("#fPlace").value.trim(), contact: $("#fContact").value.trim(), notes: $("#fNotes").value.trim() };
    if (!data.title) { $("#fTitle").focus(); Sfx.play("error"); return; }
    if (!data.date || (data.date < TODAY() && !(editing && data.date === e.date)) || data.date > MAXDATE()) { toast("Elige una fecha desde hoy hasta el 31 de diciembre de " + (NOW().getFullYear() + 1) + ".", "warn", "error"); return; }
    const clash = findClash(data, e && e.id);
    try {
      if (editing) { await updDoc("events", e.id, data); toast("Cambios guardados.", "ok", "guardar"); }
      else { await addDoc("events", { ...data, done: false }); toast("Agendado: " + data.title + " · " + fmtShort(parseYmd(data.date)) + (data.time ? " · " + fmtTime(data.time) : ""), "ok", "guardar"); }
      if (clash) setTimeout(() => toast("Ojo: se cruza con " + clash.title + ".", "warn"), 400);
      selDay = data.date; calM = monthStart(parseYmd(data.date)); closeSheet(); renderAll();
    } catch (err) { toast("No se pudo guardar. Revisa la conexión e intenta de nuevo.", "bad", "error"); }
  });
}

/* ───────────────────────── MAPA (globo) ───────────────────────── */
const monthBusy = {};
let MAP = null, mapFailed = false, mapM = minMonth(), pendingFly = null, monthKm = {}, monthWarn = {}, mapTok = 0, WORLD = null, lastStops = [];
function monthStops(y, m) {
  const evs = sorted().filter(e => { const d = parseYmd(e.date); return d.getFullYear() === y && d.getMonth() === m && evLoc(e); });
  const H = homeLoc(); const stops = [{ home: true, loc: H, events: [] }];
  evs.forEach(e => { const L = evLoc(e), last = stops[stops.length - 1];
    if (sameLoc(last.loc, L)) { last.events.push(e); return; } stops.push({ loc: L, events: [e] }); });
  if (stops.length > 1 && !sameLoc(stops[stops.length - 1].loc, H)) stops.push({ home: true, ret: true, loc: H, events: [] });
  return stops.length > 1 ? stops : [];
}
async function computeMonth(y, m) {
  const stops = monthStops(y, m); const legs = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i]; const r = await routeInfo(a.loc, b.loc);
    let warn = "";
    const prevEnd = a.events.length ? evEnd(a.events[a.events.length - 1]) : null;
    if (prevEnd && b.events.length && r && r.min) { const gap = (evStart(b.events[0]) - prevEnd) / 6e4; if (gap < r.min) warn = `No alcanzas de ${a.loc.name} a ${b.loc.name}: necesitas ~${fmtDur(r.min)} y tienes ${fmtDur(Math.max(0, gap))}.`; }
    legs.push({ a, b, r, warn });
  }
  monthKm[y + "-" + m] = legs.reduce((s, l) => s + (l.r && l.r.src !== "vuelo" ? l.r.km : 0), 0);
  monthWarn[y + "-" + m] = legs.filter(l => l.warn).map(l => l.warn);
  return { stops, legs };
}
async function startMap() {
  if (mapFailed) return renderMapPanel();
  if (!MAP) {
    if (!MAPDATA) await loadGeo();
    if (!WORLD) { try { WORLD = await (await fetch("data/mundo.json")).json(); } catch (e) { WORLD = { mundo: [], colombia: [] }; } }
    if (MAP || current !== "mapa") return;
    try { MAP = window.CronovaMapa.create($("#mapCanvas"), $("#mapOver"), MAPDATA, WORLD); }
    catch (e) { console.warn(e); mapFailed = true; $("#mapBox").insertAdjacentHTML("beforeend", `<div class="map-fallback">Tu dispositivo no pudo abrir el globo 3D. El recorrido de la derecha sigue funcionando.</div>`); return renderMapPanel(); }
    MAP.onPick = (ll, at) => { if (!ll) return closeTip(); const near = nearestPlace(ll); if (!near || near.d > 30) return closeTip(); showTip(near.p, at); };
    MAP.onPin = s => { if (s.home) { const h = homeLoc(); const at = MAP.screenOf(h.lat, h.lon); showTip({ n: h.name, d: h.dept, lat: h.lat, lon: h.lon }, at, true); return; }
      const st = lastStops.find(x => !x.home && x.loc.lat === s.lat && x.loc.lon === s.lon); const at = MAP.screenOf(s.lat, s.lon);
      showTip({ n: s.label, d: st ? st.loc.dept : "", lat: s.lat, lon: s.lon }, at, false, st ? st.events : []); };
    MAP.setHome(homeLoc());
    $("#mzIn").onclick = () => MAP.zoom(.6); $("#mzOut").onclick = () => MAP.zoom(1.6);
    const setV = v => { $("#mvCol").setAttribute("aria-pressed", v === "colombia"); $("#mvMundo").setAttribute("aria-pressed", v === "mundo"); MAP.view(v); closeTip(); };
    $("#mvCol").onclick = () => setV("colombia"); $("#mvMundo").onclick = () => setV("mundo");
    $("#mHome").onclick = () => { const h = homeLoc(); MAP.flyTo(h.lat, h.lon, 1.5); };
    $("#mFit").onclick = () => fitMonth();
    makeCombo($("#mapSearchBox"), $("#mapSearch"), p => { MAP.flyTo(p.lat, p.lon, 1.4); setTimeout(() => showTip(p, MAP.screenOf(p.lat, p.lon)), reduceMotion() ? 30 : 950); });
    MAP.start(); renderMapPanel(true); return;
  }
  MAP.start(); renderMapPanel();
}
function nearestPlace(ll) { let best = null, bd = Infinity; allPlaces().forEach(p => { const d = hav(ll, p); if (d < bd) { bd = d; best = p; } }); return best ? { p: best, d: bd } : null; }
function fitMonth() { const st = monthStops(mapM.getFullYear(), mapM.getMonth()); if (st.length) MAP.fit(st.map(s => s.loc)); else MAP.view("colombia"); }
let lastFitKey = "";
function renderMapPanel(first) {
  if (mapM < minMonth()) mapM = minMonth(); if (mapM > maxMonth()) mapM = maxMonth();
  $("#mapMonth").textContent = MONTHS[mapM.getMonth()] + " " + mapM.getFullYear();
  $("#mapPrev").disabled = mapM <= minMonth(); $("#mapNext").disabled = mapM >= maxMonth();
  const H = homeLoc();
  $("#homeRow").innerHTML = `${ico("casa")}<div class="x"><b>Tu casa</b> · <span class="muted">${esc(locLabel(H))}</span></div><button class="btn sm" id="homeChange">Cambiar</button>`;
  $("#homeChange").onclick = openHomeSheet;
  const y = mapM.getFullYear(), m = mapM.getMonth(), tok = ++mapTok;
  const stops = monthStops(y, m); lastStops = stops;
  if (!stops.length) {
    $("#routeTotal").innerHTML = ""; $("#legs").innerHTML = `<div class="empty">${ico("ruta")}No tienes salidas fuera de casa en ${MONTHS[m]}.<span style="font-size:.84rem">Cuando agendes una cita en otro municipio, aparece aquí.</span></div>`;
    if (MAP) { MAP.setRoute([], []); if (pendingFly) { MAP.flyTo(pendingFly.lat, pendingFly.lon, 1.6); pendingFly = null; } }
    return;
  }
  $("#routeTotal").innerHTML = `<span>Calculando…</span>`;
  computeMonth(y, m).then(({ legs }) => {
    if (tok !== mapTok) return;
    const km = legs.reduce((s, l) => s + (l.r ? l.r.km : 0), 0), min = legs.reduce((s, l) => s + (l.r ? l.r.min : 0), 0), n = stops.filter(s => !s.home).length;
    $("#routeTotal").innerHTML = `<b>${fmtKm(km)}</b><span>${fmtDur(min)} en camino · ${n} ${n === 1 ? "parada" : "paradas"}</span>`;
    let k = 0;
    $("#legs").innerHTML = stops.map((s, i) => {
      if (i === 0) return "";
      const lg = legs[i - 1]; const label = s.home ? "Regreso a casa" : s.loc.name;
      const when = s.events.length ? esc(fmtShort(evStart(s.events[0]))) + (s.events[0].time ? " · " + fmtTime(s.events[0].time) : "") : esc(locLabel(s.loc));
      return `<div class="leg"><span class="n ${s.home ? "h" : ""}">${s.home ? "⌂" : ++k}</span><div style="min-width:0"><div class="c">${esc(label)}</div><div class="m">${when}<br>${esc(tripText(lg.r))}${lg.r && lg.r.src === "aprox" ? " (estimado)" : ""}</div>${lg.warn ? `<div class="w">${esc(lg.warn)}</div>` : ""}</div><a class="wz" href="${wazeUrl(s.loc)}" target="_blank" rel="noopener">${ico("nav")}Waze</a></div>`;
    }).join("");
    if (MAP) {
      let j = 0;
      MAP.setRoute(stops.map(s => ({ lat: s.loc.lat, lon: s.loc.lon, label: s.loc.name, home: s.home, num: s.home ? "" : ++j })), legs.map(l => ({ a: l.a.loc, b: l.b.loc })));
      const fk = y + "-" + m;
      if (pendingFly) { MAP.flyTo(pendingFly.lat, pendingFly.lon, 1.6); pendingFly = null; }
      else if (first || lastFitKey !== fk) fitMonth();
      lastFitKey = fk;
    }
  });
}
$("#mapPrev").addEventListener("click", () => { mapM = new Date(mapM.getFullYear(), mapM.getMonth() - 1, 1); renderMapPanel(); });
$("#mapNext").addEventListener("click", () => { mapM = new Date(mapM.getFullYear(), mapM.getMonth() + 1, 1); renderMapPanel(); });
let tipEl = null;
function closeTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
function showTip(p, at, isHomePin, events) {
  closeTip(); if (!p || !at) return;
  const H = homeLoc(); const L = { name: p.n, dept: p.d, lat: p.lat, lon: p.lon, sub: p.sub };
  const box = $("#mapBox"); const bw = box.clientWidth, bh = box.clientHeight;
  tipEl = document.createElement("div"); tipEl.className = "map-tip";
  tipEl.style.left = Math.max(12, Math.min(bw - 252, at.x - 120)) + "px"; tipEl.style.top = Math.max(60, Math.min(bh - 190, at.y - 175)) + "px";
  const isHome = isHomePin || sameLoc(L, H);
  tipEl.innerHTML = `<div class="t">${esc(p.n)}</div><div class="s">${esc(placeSub(p))}${events && events.length ? "<br>" + events.map(e => esc(fmtShort(evStart(e)) + " · " + e.title)).join("<br>") : ""}<br><span id="tipTrip">${isHome ? "Aquí está tu casa" : "Calculando desde tu casa…"}</span></div>
    <div class="acts"><button class="btn sm primary" id="tipNew">${ico("plus")}Cita aquí</button>${isHome ? "" : `<button class="btn sm" id="tipHome">${ico("casa")}Es mi casa</button>`}<a class="btn sm waze" href="${wazeUrl(L)}" target="_blank" rel="noopener">${ico("nav")}Waze</a></div>`;
  box.appendChild(tipEl);
  $("#tipNew").onclick = () => openEventSheet(null, { muni: p });
  if (!isHome) { $("#tipHome").onclick = () => { setHome(L); closeTip(); }; routeInfo(H, L).then(r => { const t = $("#tipTrip"); if (t && r) t.textContent = "Desde tu casa: " + tripText(r); }); }
}
function setHome(L, exact) {
  savePrefs({ home: { name: L.name, dept: L.dept, lat: L.lat, lon: L.lon, sub: L.sub || "", exacta: !!exact } }, true);
  if (MAP) MAP.setHome(homeLoc());
  nextTripFor = ""; monthKm = {}; monthWarn = {}; renderAll(); toast("Tu casa ahora es " + locLabel(homeLoc()) + ".", "ok", "casa");
}
function openHomeSheet() {
  openSheet(`<div class="sheet-h"><div><div class="eyebrow">Tu casa</div><h2>¿Dónde vives?</h2></div><button class="icon-btn" data-close aria-label="Cerrar">${ico("x")}</button></div>
    <p class="muted" style="margin:0">Desde aquí calculo tus recorridos, los kilómetros y a qué hora salir.</p>
    <div class="combo" id="hBox"><input class="in" id="hIn" placeholder="Municipio, pueblo, corregimiento o vereda" autocomplete="off" autofocus></div>
    <button class="btn" id="hGps">${ico("gps")}Usar mi ubicación actual</button>
    <div id="hMsg" class="muted" style="font-size:.86rem"></div>`, { label: "Elegir casa" });
  makeCombo($("#hBox"), $("#hIn"), p => { closeSheet(); setHome({ name: p.n, dept: p.d, lat: p.lat, lon: p.lon, sub: p.sub }); if (MAP) MAP.flyTo(p.lat, p.lon, 1.4); });
  $("#hGps").onclick = () => {
    if (!navigator.geolocation) { $("#hMsg").textContent = "Este navegador no permite leer la ubicación."; return; }
    $("#hMsg").textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(pos => {
      const ll = { lat: pos.coords.latitude, lon: pos.coords.longitude }; const near = nearestPlace(ll);
      if (!near || near.d > 80) { $("#hMsg").textContent = "Parece que no estás en Colombia. Busca tu lugar arriba."; return; }
      closeSheet(); setHome({ name: near.p.n, dept: near.p.d, lat: ll.lat, lon: ll.lon, sub: near.p.sub }, true); if (MAP) MAP.flyTo(ll.lat, ll.lon, 1.4);
    }, () => { $("#hMsg").textContent = "No diste permiso de ubicación. Busca tu lugar arriba."; Sfx.play("error"); }, { enableHighAccuracy: true, timeout: 12000 });
  };
}

/* ───────────────────────── IA ───────────────────────── */
const AI_URL = SUPA_URL + "/functions/v1/orbita-ia";
const AI = { get ok() { return !!session; } };
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const canSpeak = "speechSynthesis" in window;
async function claudeCall(body, signal) {
  const { data } = await supa.auth.getSession(); const tok = data && data.session ? data.session.access_token : (session && session.access_token);
  const r = await fetch(AI_URL, { method: "POST", signal, headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok, "apikey": SUPA_KEY }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const e = new Error((j && j.error) || ("HTTP " + r.status)); e.code = r.status === 404 ? "not_deployed" : r.status === 429 ? "rate_limited" : r.status === 401 ? "auth" : (j && j.code) || "error"; throw e; }
  return j;
}
const textOf = c => (c || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
async function ask(prompt, signal) { const j = await claudeCall({ messages: [{ role: "user", content: prompt }] }, signal); return textOf(j.content); }
async function askJSON(prompt) { const t = await ask(prompt); const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
function aiErr(e) {
  if (e && e.name === "AbortError") return "Detenido.";
  const c = e && e.code;
  if (c === "not_deployed" || (e instanceof TypeError)) return "La IA todavía no está activada. Ve a Ajustes → Inteligencia artificial para ver cómo activarla.";
  if (c === "auth") return "Tu sesión venció. Cierra sesión y vuelve a entrar.";
  if (c === "rate_limited") return "Demasiadas solicitudes seguidas. Espera un minuto e intenta de nuevo.";
  if (c === "no_key") return "Falta guardar la clave de Anthropic en Supabase (Ajustes → Inteligencia artificial).";
  return "La IA no respondió. Intenta de nuevo en un momento.";
}
function eventsDigest(fromD, toD) {
  return sorted().filter(e => { const d = evStart(e); return d >= fromD && d <= toD; }).map(e => { const L = evLoc(e);
    return { id: e.id, title: e.title, type: e.type, date: e.date, time: e.time, duration: e.duration, municipio: L ? locLabel(L) : "", place: e.place, contact: e.contact, notes: e.notes, done: !!e.done }; });
}
function freeSlots(ds, durMin) {
  const evs = onDay(ds).filter(e => e.time); const out = []; const now = NOW();
  for (let m = 7 * 60; m + durMin <= 20 * 60; m += 30) { const s = new Date(parseYmd(ds).getTime() + m * 6e4), e = new Date(s.getTime() + durMin * 6e4);
    if (s < now) continue; if (!evs.some(x => evStart(x) < e && evEnd(x) > s)) out.push(pad(Math.floor(m / 60)) + ":" + pad(m % 60)); }
  return out;
}
function rules() {
  const n = NOW(); const H = homeLoc();
  return `Eres CRONOVA, el asistente personal de agenda de ${PREFS.nombre}. Llámalo "${PREFS.nombre}". Responde siempre en español de Colombia, claro, cálido y breve.
Fecha y hora actual: ${fmtDayY(n)}, ${fmtClock(n)} ${n.getHours() >= 12 ? "p. m." : "a. m."} (ISO ${TODAY()}). Semana de lunes a domingo.
Su casa queda en ${locLabel(H)}. Lugares que usa seguido (además de los 1.122 municipios): ${(PREFS.lugares || []).map(p => p.n + (p.sub ? " (" + p.sub + ")" : "")).join(", ") || "ninguno"}.
Puedes leer, crear, editar y borrar eventos, buscar huecos libres, calcular trayectos entre municipios y preparar llamadas.
Reglas:
- Solo se puede agendar desde hoy (${TODAY()}) hasta el ${MAXDATE()}. Nunca agendes en fechas pasadas: si lo piden, dilo y propone una fecha válida.
- Antes de crear un evento, revisa la agenda de ese día para detectar cruces; si hay cruce, avisa y propone otra hora.
- Convierte fechas relativas ("el jueves", "mañana", "en 15 días") a fechas exactas YYYY-MM-DD y horas HH:MM de 24 h.
- Tipos válidos: cita, compromiso, viaje, llamada, personal.
- Para el lugar usa el nombre del municipio o pueblo colombiano (incluye corregimientos guardados como Doradal). Si es fuera de su casa, calcula el trayecto con route_info y dile a qué hora salir.
- Para "llama a alguien para agendar" usa schedule_call: tú no marcas todavía, pero dejas la llamada preparada con guion.
- Después de usar herramientas, confirma en 1 a 3 frases qué hiciste, con fecha y hora legibles.`;
}
const TOOLS = [
  { name: "list_events", description: "Lista los eventos entre dos fechas (YYYY-MM-DD, inclusive). Devuelve id, título, tipo, fecha, hora, municipio y estado.",
    inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] },
    execute(i) { const a = parseYmd(String(i.from)); const b = parseYmd(String(i.to)); b.setHours(23, 59, 59); return eventsDigest(a, b); } },
  { name: "create_event", description: "Crea un evento. Fecha entre hoy y el 31 de diciembre del año siguiente. Devuelve el id y un aviso si se cruza con otro evento.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, type: { type: "string", enum: ["cita", "compromiso", "viaje", "llamada", "personal"] }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" }, duration: { type: "number", description: "minutos" }, municipio: { type: "string", description: "Municipio o pueblo de Colombia" }, departamento: { type: "string" }, place: { type: "string" }, contact: { type: "string" }, notes: { type: "string" } }, required: ["title", "date"] },
    async execute(i) {
      const date = String(i.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida, usa YYYY-MM-DD");
      if (date < TODAY()) throw new Error("Esa fecha ya pasó. Solo se agenda desde " + TODAY());
      if (date > MAXDATE()) throw new Error("Solo se agenda hasta " + MAXDATE());
      let m = null; if (i.municipio) { const dc = i.departamento ? Object.keys(DEPT).find(c => norm(DEPT[c]) === norm(i.departamento)) : null; m = findMuni(String(i.municipio), dc); if (!m) throw new Error("No encontré el municipio " + i.municipio); }
      const d = { title: String(i.title), type: TYPES[i.type] ? String(i.type) : "cita", date, time: i.time ? String(i.time) : "", duration: Number(i.duration) || 60,
        ...locOf(m), place: String(i.place || ""), contact: String(i.contact || ""), notes: String(i.notes || ""), done: false };
      const clash = findClash(d); const id = await addDoc("events", d); Sfx.play("guardar");
      toolNote("Agendé: " + d.title + " · " + fmtShort(parseYmd(d.date)) + (d.time ? " " + d.time : "") + (m ? " · " + m.n : ""));
      return { id, municipio: m ? muniLabel(m) : "", clash: clash ? { title: clash.title, time: clash.time } : null };
    } },
  { name: "update_event", description: "Modifica un evento por id (cambiar fecha, hora, municipio o marcar done=true). Devuelve ok.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, type: { type: "string" }, date: { type: "string" }, time: { type: "string" }, duration: { type: "number" }, municipio: { type: "string" }, place: { type: "string" }, contact: { type: "string" }, notes: { type: "string" }, done: { type: "boolean" } }, required: ["id"] },
    async execute(i) { const id = String(i.id); if (!S.events.find(e => e.id === id)) throw new Error("No existe ese id");
      const p = {}; ["title", "type", "date", "time", "place", "contact", "notes"].forEach(k => { if (i[k] != null) p[k] = String(i[k]); });
      if (p.date && (p.date < TODAY() || p.date > MAXDATE())) throw new Error("Fecha fuera del rango permitido");
      if (i.duration != null) p.duration = Number(i.duration); if (i.done != null) p.done = !!i.done;
      if (i.municipio) { const m = findMuni(String(i.municipio)); if (!m) throw new Error("No encontré ese municipio"); Object.assign(p, locOf(m)); }
      await updDoc("events", id, p); toolNote("Actualicé un evento"); return "ok"; } },
  { name: "delete_event", description: "Elimina un evento por id. Úsalo solo cuando el usuario lo pida explícitamente. Devuelve ok.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    async execute(i) { const e = S.events.find(x => x.id === String(i.id)); if (!e) throw new Error("No existe ese id"); await delDoc("events", e.id); Sfx.play("borrar"); toolNote("Eliminé: " + e.title); return "ok"; } },
  { name: "find_free_slots", description: "Busca huecos libres de cierta duración (minutos) en un día YYYY-MM-DD entre 07:00 y 20:00. Devuelve horas de inicio HH:MM.",
    inputSchema: { type: "object", properties: { date: { type: "string" }, duration: { type: "number" } }, required: ["date"] },
    execute(i) { if (String(i.date) < TODAY()) return []; return freeSlots(String(i.date), Number(i.duration) || 60); } },
  { name: "route_info", description: "Calcula distancia (km) y tiempo por carretera entre dos municipios de Colombia. Si 'desde' se omite, sale de la casa del usuario.",
    inputSchema: { type: "object", properties: { desde: { type: "string" }, hasta: { type: "string" } }, required: ["hasta"] },
    async execute(i) { const a = i.desde ? findMuni(String(i.desde)) : null; const b = findMuni(String(i.hasta)); if (!b) throw new Error("No encontré " + i.hasta);
      const A = a ? { name: a.n, dept: a.d, lat: a.lat, lon: a.lon } : homeLoc(); const r = await routeInfo(A, { name: b.n, dept: b.d, lat: b.lat, lon: b.lon });
      return { desde: locLabel(A), hasta: muniLabel(b), km: Math.round(r.km), minutos: Math.round(r.min), modo: r.src === "vuelo" ? "vuelo" : "carretera", estimado: r.src === "aprox" }; } },
  { name: "schedule_call", description: "Prepara una llamada para agendar una cita: guarda nombre, teléfono, objetivo y disponibilidad, y genera el guion. Devuelve el id.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, goal: { type: "string" }, window: { type: "string" }, municipio: { type: "string" } }, required: ["name", "goal"] },
    async execute(i) { const m = i.municipio ? findMuni(String(i.municipio)) : null;
      const id = await createCall({ name: String(i.name), phone: String(i.phone || ""), goal: String(i.goal), window: String(i.window || ""), ...locOf(m) });
      toolNote("Preparé la llamada a " + i.name); return { id }; } }
];
async function agent(system, msgs, signal) {
  const tools = TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  for (let i = 0; i < 8; i++) {
    const j = await claudeCall({ system, messages: msgs, tools }, signal);
    msgs.push({ role: "assistant", content: j.content });
    const uses = (j.content || []).filter(b => b.type === "tool_use");
    if (j.stop_reason !== "tool_use" || !uses.length) return textOf(j.content) || "Listo.";
    const results = await Promise.all(uses.map(async u => { const tool = TOOLS.find(t => t.name === u.name);
      try { if (!tool) throw new Error("Herramienta desconocida"); const out = await tool.execute(u.input || {}); return { type: "tool_result", tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out) }; }
      catch (e) { return { type: "tool_result", tool_use_id: u.id, content: "Error: " + e.message, is_error: true }; } }));
    msgs.push({ role: "user", content: results });
  }
  return "Hice varios pasos. Revisa el calendario.";
}

/* Chat */
let turns = [], busy = false, ctl = null, chatLog = [];
const SUGS = ["¿Qué tengo esta semana?", "Agéndame almuerzo con Laura el viernes a la 1 pm", "¿Cuánto me demoro de mi casa a Doradal?", "Llama al consultorio para una cita la próxima semana"];
function renderChat() {
  const box = $("#msgs");
  if (!chatLog.length) {
    box.innerHTML = `<div class="ai-hello"><span class="tile"><svg viewBox="0 0 64 64"><use href="#logo-w"/></svg></span><h2>${greetWord(NOW())}, ${esc(PREFS.nombre)}</h2>
      <p class="muted" style="margin:0">Dime en tus palabras qué necesitas: agendar, mover o cancelar citas, saber cuánto te demoras a un municipio o preparar una llamada.</p>
      <div class="sugs">${SUGS.map(s => `<button class="sug" type="button">${esc(s)}</button>`).join("")}</div></div>`;
  } else box.innerHTML = chatLog.map(m => `<div class="msg ${m.k}">${esc(m.t)}</div>`).join("");
  box.scrollTop = box.scrollHeight;
}
function toolNote(t) { chatLog.push({ k: "tool", t: "⚙ " + t }); if (current === "asistente") renderChat(); }
$("#msgs").addEventListener("click", e => { const b = e.target.closest(".sug"); if (b) { $("#chatIn").value = b.textContent; send(); } });
$("#chatSend").addEventListener("click", send);
$("#chatIn").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("#chatIn").addEventListener("input", e => { const t = e.target; t.style.height = "auto"; t.style.height = Math.min(150, t.scrollHeight) + "px"; });
$("#chatStop").addEventListener("click", () => ctl && ctl.abort());
$("#chatClear").addEventListener("click", () => { turns = []; chatLog = []; renderChat(); Sfx.play("toque"); });
function trimTurns(t) { if (t.length <= 30) return t; for (let i = t.length - 30; i < t.length; i++) if (t[i].role === "user" && typeof t[i].content === "string") return t.slice(i); return t.slice(-1); }
async function send() {
  const txt = $("#chatIn").value.trim(); if (!txt || busy) return;
  if (!AI.ok) { toast("Entra con tu cuenta para usar la IA.", "warn", "error"); return; }
  $("#chatIn").value = ""; $("#chatIn").style.height = ""; busy = true; $("#chatSend").hidden = true; $("#chatStop").hidden = false;
  chatLog.push({ k: "me", t: txt }); Sfx.play("enviar");
  const bubble = { k: "ai thinking", t: "Pensando" }; chatLog.push(bubble); renderChat();
  ctl = new AbortController();
  const work = trimTurns(turns).concat([{ role: "user", content: txt }]);
  try { const ans = await agent(rules(), work, ctl.signal); bubble.k = "ai"; bubble.t = ans; turns = work; Sfx.play("respuesta"); }
  catch (e) { bubble.k = "ai"; bubble.t = aiErr(e); Sfx.play("error"); }
  busy = false; $("#chatSend").hidden = false; $("#chatStop").hidden = true; renderChat();
}
function setupDictation() {
  if (!SR) return; const mic = $("#mic"); mic.hidden = false; let rec = null, base = "";
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "es-CO"; rec.interimResults = true; rec.continuous = false;
    base = $("#chatIn").value ? $("#chatIn").value + " " : "";
    rec.onresult = ev => { let t = ""; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; $("#chatIn").value = base + t; };
    rec.onend = () => { rec = null; mic.classList.remove("on"); };
    rec.onerror = ev => { if (ev.error === "not-allowed") { mic.hidden = true; toast("Permite el micrófono en los ajustes del navegador para dictar.", "warn"); } };
    mic.classList.add("on"); Sfx.play("toque"); rec.start();
  };
}

/* Resumen de la mañana */
let briefText = "";
$("#genBrief").addEventListener("click", async () => {
  if (!AI.ok) { toast("Entra con tu cuenta para usar la IA.", "warn", "error"); return; }
  const btn = $("#genBrief"); btn.disabled = true; $("#brief").innerHTML = `<span class="msg thinking" style="padding:0;background:none;border:0">Preparando tu resumen</span>`;
  const n = NOW(); const t0 = new Date(TODAY() + "T00:00:00"); const t2 = new Date(t0.getTime() + 2 * 864e5 - 1);
  const unread = S.emails.filter(m => !m.read).slice(0, 15).map(m => ({ de: m.from, asunto: m.subject, texto: String(m.body || "").slice(0, 600) }));
  const prompt = `Escribe el resumen de la mañana para ${PREFS.nombre}, en español de Colombia, tono de asistente ejecutivo cálido. Hoy es ${fmtDayY(n)}. Su casa queda en ${locLabel(homeLoc())}.
Formato: saludo de una línea usando su nombre; "Hoy:" con cada evento en una línea (hora — título — municipio); "Mañana:" breve; "Correos:" los 3 más importantes con la acción sugerida; "Ojo:" riesgos (cruces, trayectos largos, pendientes sin confirmar); cierra con una frase de enfoque. Sin markdown ni asteriscos. Máximo 170 palabras.
Eventos de hoy y mañana: ${JSON.stringify(eventsDigest(t0, t2))}
Correos sin leer: ${JSON.stringify(unread)}
Alertas de ruta: ${JSON.stringify(monthWarn[n.getFullYear() + "-" + n.getMonth()] || [])}`;
  try { const text = await ask(prompt); briefText = text; $("#brief").textContent = text; $("#brief").dataset.filled = "1"; Sfx.play("respuesta"); }
  catch (e) { $("#brief").textContent = aiErr(e); Sfx.play("error"); }
  btn.disabled = false;
});
$("#speakBrief").addEventListener("click", () => {
  if (!canSpeak) return; if (!briefText) { toast("Primero genera el resumen.", "warn"); return; }
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(briefText.slice(0, 4000)); u.lang = "es-CO";
  const vs = speechSynthesis.getVoices(); const v = vs.find(v => /^es(-|_)(CO|MX|US|419)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)); if (v) u.voice = v;
  speechSynthesis.speak(u);
});

/* ───────────────────────── LLAMADAS ───────────────────────── */
let callMuni = null;
async function createCall(c) { const id = await addDoc("calls", { ...c, status: "prep", script: "" }); genScript(id, c); return id; }
async function genScript(id, c) {
  const n = NOW(); const slots = [];
  for (let k = 1; k <= 10 && slots.length < 6; k++) { const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + k); if (d.getDay() === 0) continue;
    const f = freeSlots(ymd(d), 60).filter(t => t >= "08:00" && t <= "17:00"); if (f.length) slots.push(fmtShort(d) + ": " + [f[0], f[Math.floor(f.length / 2)], f[f.length - 1]].filter((v, i, a) => a.indexOf(v) === i).join(", ")); }
  let script = `Hola, buenos días. Llamo de parte de ${PREFS.nombre} para ${c.goal}.\n\nDisponibilidad:\n${slots.join("\n")}\n\nSi alguno sirve, confirmar fecha, hora, dirección y si hay que llevar algo.`;
  if (AI.ok) { try { const text = await ask(`Escribe un guion corto y natural (español de Colombia) para una llamada telefónica a "${c.name}" de parte de ${PREFS.nombre}, con el objetivo: "${c.goal}". Preferencias: "${c.window || "cualquier horario"}". ${c.city ? "La cita es en " + c.city + "." : ""}
Horarios libres reales (ofrece solo estos):\n${slots.join("\n")}
Estructura: saludo y motivo; 2-3 opciones concretas; qué decir si no hay disponibilidad; datos a confirmar al final (fecha, hora, dirección, requisitos). Sin markdown. Máximo 140 palabras.`); if (text) script = text; } catch (e) {} }
  try { await updDoc("calls", id, { script, status: "ready", slots }); } catch (e) {}
}
makeCombo($("#cMuniBox"), $("#cMuni"), m => { callMuni = m; });
$("#callForm").addEventListener("submit", async e => {
  e.preventDefault();
  const c = { name: $("#cName").value.trim(), phone: $("#cPhone").value.trim(), goal: $("#cGoal").value.trim(), window: $("#cWindow").value.trim(),
    ...locOf(callMuni) };
  if (!c.name || !c.goal) return;
  try { await createCall(c); $("#callForm").reset(); callMuni = null; toast("Llamada en cola. Estoy escribiendo el guion.", "ok", "guardar"); } catch (_) { toast("No se pudo guardar la llamada.", "bad", "error"); }
});
let resolving = null;
function renderCalls() {
  const calls = [...S.calls].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("#callCount").textContent = calls.filter(c => c.status === "ready" || c.status === "prep").length + " pendientes";
  const ST = { prep: ["var(--acc-2)", "Preparando guion"], ready: ["var(--acc)", "Lista para llamar"], ok: ["var(--ok)", "Cita confirmada"], fail: ["var(--bad)", "Sin acuerdo"] };
  $("#calls").innerHTML = calls.length ? calls.map(c => { const st = ST[c.status] || ST.ready;
    return `<div class="call"><div class="call-top"><div style="min-width:0"><div style="font-weight:700">${esc(c.name)} ${c.example ? '<span class="tag">EJEMPLO</span>' : ""}</div><div class="muted" style="font-size:.85rem">${esc(c.goal)}${c.window ? " · " + esc(c.window) : ""}${c.city ? " · " + esc(c.city) : ""}</div></div><span class="st" style="--c:${st[0]}">${st[1]}</span></div>
      ${c.phone ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="mono" style="user-select:all;font-size:1.05rem">${esc(c.phone)}</span><button class="btn sm" data-copy="${esc(c.phone)}">${ico("copiar")}Copiar</button><a class="btn sm" href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">${ico("llamada")}Llamar</a></div>` : ""}
      ${c.script ? `<div class="script">${esc(c.script)}</div>` : c.status === "prep" ? `<div class="muted" style="font-size:.85rem">Escribiendo el guion…</div>` : ""}
      ${c.status === "ready" ? (resolving === c.id ? `<form class="fx" data-resolve="${esc(c.id)}" style="display:flex;flex-direction:column;gap:10px"><div class="row2"><label class="field"><span>Fecha acordada</span><input class="in" type="date" name="d" required min="${TODAY()}" max="${MAXDATE()}"></label><label class="field"><span>Hora</span><input class="in" type="time" name="t" required></label></div><label class="field"><span>Lugar</span><input class="in" name="p" placeholder="Dirección"></label><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary sm" type="submit">${ico("check")}Crear cita</button><button class="btn sm ghost" type="button" data-cancelres="1">Cancelar</button></div></form>`
        : `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary sm" data-res="${esc(c.id)}">${ico("check")}Registrar cita confirmada</button><button class="btn sm ghost" data-fail="${esc(c.id)}">No hubo acuerdo</button></div>`) : ""}
      ${(c.status === "ok" || c.status === "fail") ? `<div><button class="btn sm ghost" data-rmcall="${esc(c.id)}">${ico("x")}Quitar de la lista</button></div>` : ""}</div>`; }).join("")
    : `<div class="empty">Sin llamadas en cola. Llena el formulario o dile al asistente "llama a… para agendar…".</div>`;
}
$("#calls").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.copy) navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Número copiado.", "ok", "toque")).catch(() => toast("Mantén presionado el número para copiarlo.", "warn"));
  if (b.dataset.res) { resolving = b.dataset.res; renderCalls(); }
  if (b.dataset.cancelres) { resolving = null; renderCalls(); }
  if (b.dataset.fail) { updDoc("calls", b.dataset.fail, { status: "fail" }); Sfx.play("toque"); }
  if (b.dataset.rmcall) { delDoc("calls", b.dataset.rmcall); Sfx.play("borrar"); }
});
$("#calls").addEventListener("submit", async e => {
  const f = e.target.closest("form[data-resolve]"); if (!f) return; e.preventDefault();
  const c = S.calls.find(x => x.id === f.dataset.resolve); if (!c) return;
  if (f.d.value < TODAY()) { toast("Esa fecha ya pasó.", "warn", "error"); return; }
  const ev = { title: c.goal.replace(/^agendar\s*/i, "").replace(/^./, m => m.toUpperCase()) + " · " + c.name, type: "cita", date: f.d.value, time: f.t.value, duration: 60,
    city: c.city || "", dept: c.dept || "", lat: c.lat ?? null, lon: c.lon ?? null, sub: c.sub || "", place: f.p.value.trim(), contact: c.name + (c.phone ? " " + c.phone : ""), notes: "Agendada por llamada", done: false };
  await addDoc("events", ev); await updDoc("calls", c.id, { status: "ok", result: ev.date + " " + ev.time });
  resolving = null; toast("Cita creada: " + fmtShort(parseYmd(ev.date)) + " · " + fmtTime(ev.time), "ok", "guardar");
});

/* ───────────────────────── CORREO ───────────────────────── */
function renderMail() {
  const ms = [...S.emails].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("#mailCount").textContent = ms.filter(m => !m.read).length + " sin leer";
  $("#mails").innerHTML = ms.length ? ms.map(m => `<div class="mail ${m.read ? "" : "unread"}"><div style="min-width:0"><div class="from">${esc(m.from)} ${m.example ? '<span class="tag">EJEMPLO</span>' : ""}</div><div class="subj">${esc(m.subject)}</div></div>
    <div style="display:flex;gap:4px"><button class="icon-btn" data-read="${esc(m.id)}" aria-label="${m.read ? "Marcar sin leer" : "Marcar leído"}">${ico("check")}</button><button class="icon-btn" data-rmmail="${esc(m.id)}" aria-label="Eliminar">${ico("trash")}</button></div>
    <div class="prev">${esc(m.body)}</div></div>`).join("") : `<div class="empty">La bandeja está vacía. Pega un correo a la izquierda.</div>`;
}
$("#mails").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.read) { const m = S.emails.find(x => x.id === b.dataset.read); if (m) { updDoc("emails", m.id, { read: !m.read }); Sfx.play("toque"); } }
  if (b.dataset.rmmail) { delDoc("emails", b.dataset.rmmail); Sfx.play("borrar"); } });
$("#mailForm").addEventListener("submit", async e => { e.preventDefault();
  await addDoc("emails", { from: $("#mFrom").value.trim(), subject: $("#mSubj").value.trim(), body: $("#mBody").value.trim(), read: false });
  $("#mailForm").reset(); toast("Correo guardado.", "ok", "guardar"); });
let found = [];
$("#mailScan").addEventListener("click", async () => {
  if (!AI.ok) { toast("Entra con tu cuenta para usar la IA.", "warn", "error"); return; }
  const unread = S.emails.filter(m => !m.read).slice(0, 20); if (!unread.length) { toast("No hay correos sin leer.", "warn"); return; }
  const btn = $("#mailScan"); btn.disabled = true; $("#found").innerHTML = '<div class="muted">Leyendo correos…</div>';
  try {
    const r = await askJSON(`Hoy es ${TODAY()} (${fmtDayY(NOW())}). Lee estos correos y extrae cada cita, reunión, vencimiento o compromiso con fecha de hoy en adelante. Devuelve SOLO JSON: {"items":[{"title":string,"type":"cita"|"compromiso"|"viaje"|"llamada"|"personal","date":"YYYY-MM-DD","time":"HH:MM" o "","municipio":municipio colombiano o "","source":remitente}]}. Si no hay ninguno, items vacío.
Correos: ${JSON.stringify(unread.map(m => ({ de: m.from, asunto: m.subject, texto: String(m.body || "").slice(0, 1200) })))}`);
    found = (r && Array.isArray(r.items)) ? r.items.filter(x => x && x.title && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && String(x.date) >= TODAY()) : [];
    Sfx.play("respuesta");
  } catch (e) { found = []; $("#found").innerHTML = `<div class="muted">${esc(aiErr(e))}</div>`; btn.disabled = false; Sfx.play("error"); return; }
  btn.disabled = false; renderFound();
});
function renderFound() {
  $("#found").innerHTML = found.length ? `<h3>Compromisos encontrados</h3>` + found.map((x, i) => `<div class="found"><div style="min-width:0"><div style="font-weight:700">${esc(x.title)}</div><div class="muted" style="font-size:.8rem">${esc(fmtShort(parseYmd(x.date)))} ${x.time ? "· " + fmtTime(x.time) : ""} ${x.municipio ? "· " + esc(x.municipio) : ""} · de ${esc(x.source || "")}</div></div>${x.added ? '<span class="st" style="--c:var(--ok)">Agregado</span>' : `<button class="btn sm primary" data-addfound="${i}">${ico("plus")}Agregar</button>`}</div>`).join("")
    : `<div class="muted">No encontré fechas futuras en los correos sin leer.</div>`;
}
$("#found").addEventListener("click", async e => {
  const b = e.target.closest("[data-addfound]"); if (!b) return; const x = found[+b.dataset.addfound]; const m = x.municipio ? findMuni(x.municipio) : null;
  await addDoc("events", { title: String(x.title), type: TYPES[x.type] ? x.type : "compromiso", date: x.date, time: x.time || "", duration: 60, ...locOf(m), place: "", contact: String(x.source || ""), notes: "Detectado en correo", done: false });
  x.added = true; renderFound(); toast("Agregado al calendario.", "ok", "guardar");
});

/* ───────────────────────── AJUSTES ───────────────────────── */
const FONTS = [["jakarta", "Jakarta", "La misma de Traspasos", "'Plus Jakarta Sans'"], ["moderna", "Moderna", "Sora + Inter", "'Sora'"], ["tecnica", "Técnica", "Space Grotesk + IBM Plex", "'Space Grotesk'"]];
function swatchesHTML(big) { return `<div class="swatches ${big ? "big" : ""}">${Object.entries(COLORS).map(([k, c]) => `<button type="button" class="swatch" data-color="${k}" aria-pressed="${PREFS.color === k}" style="--a:${c[0]};--b:${c[1]}"><i>${PREFS.color === k ? ico("check") : ""}</i>${c[2]}</button>`).join("")}</div>`; }
function bindSwatches(root) { root.querySelectorAll("[data-color]").forEach(b => b.onclick = () => { savePrefs({ color: b.dataset.color }); Sfx.play("toque"); if (!$("#colorPop").hidden) $("#swatchesPop").innerHTML = swatchesHTML(), bindSwatches($("#swatchesPop")); }); }
$("#colorBtn").addEventListener("click", e => { e.stopPropagation(); const p = $("#colorPop"); p.hidden = !p.hidden; if (!p.hidden) { $("#swatchesPop").innerHTML = swatchesHTML(); bindSwatches($("#swatchesPop")); Sfx.play("abrir"); } });
document.addEventListener("click", e => { const p = $("#colorPop"); if (!p.hidden && !p.contains(e.target) && e.target !== $("#colorBtn")) p.hidden = true; });
function renderSettings() {
  const H = homeLoc(); const em = session && session.user ? session.user.email : "";
  const sw = (id, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span></span></label>`;
  const lug = PREFS.lugares || [];
  $("#settings").innerHTML = `
  <div class="card set-sec" id="s-perfil"><div class="card-h"><div class="sec-t">Perfil y lugares</div></div>
    <div class="set-row"><div class="l"><b>¿Cómo te llamo?</b><span>Aparece en el saludo y la IA te llama así.</span></div><div class="r"><input class="in" id="pName" value="${esc(PREFS.nombre)}" style="width:230px" maxlength="40"></div></div>
    <div class="set-row"><div class="l"><b>Tu casa</b><span>${esc(locLabel(H))}${H.exacta ? " · ubicación exacta" : ""}</span></div><div class="r"><button class="btn sm" id="pHome">${ico("casa")}Cambiar casa</button></div></div>
    <div class="set-row" style="align-items:flex-start"><div class="l"><b>Lugares guardados</b><span>Pueblos, corregimientos y veredas que usas seguido.</span>
      <div class="places" style="margin-top:10px">${lug.length ? lug.map((p, i) => `<span class="place">${esc(p.n)}${p.sub ? ` <span class="dim">· ${esc(p.sub)}</span>` : ""}<button type="button" data-rmplace="${i}" aria-label="Quitar ${esc(p.n)}">${ico("x")}</button></span>`).join("") : '<span class="dim">Aún no tienes lugares guardados.</span>'}</div></div>
      <div class="r" style="width:min(300px,100%)"><div class="combo" id="pPlaceBox" style="width:100%"><input class="in" id="pPlace" placeholder="Agregar un lugar…" autocomplete="off"></div></div></div>
  </div>
  <div class="card set-sec" id="s-apariencia"><div class="card-h"><div class="sec-t">Color</div></div>${swatchesHTML(true)}</div>
  <div class="card set-sec" id="s-tipo"><div class="card-h"><div class="sec-t">Tipografía</div></div>
    <div class="fonts">${FONTS.map(([k, n, d, f]) => `<button type="button" class="font-opt" data-fuente="${k}" aria-pressed="${PREFS.fuente === k}"><div class="aa" style="font-family:${f},sans-serif">Aa ${n}</div><span>${d}</span></button>`).join("")}</div>
    <div class="set-row" style="margin-top:10px"><div class="l"><b>Tamaño del texto</b><span>Más grande se lee mejor en el iPhone.</span></div><div class="r"><div class="seg"><button type="button" data-texto="normal" aria-pressed="${PREFS.texto === "normal"}">Normal</button><button type="button" data-texto="grande" aria-pressed="${PREFS.texto === "grande"}">Grande</button></div></div></div>
  </div>
  <div class="card set-sec" id="s-sonido"><div class="card-h"><div class="sec-t">Sonidos y animación</div></div>
    <div class="set-row"><div class="l"><b>Sonidos de acciones</b><span>Al guardar, completar, borrar, recibir respuestas y alertas.</span></div><div class="r">${sw("pSnd", PREFS.sonido)}</div></div>
    <div class="set-row"><div class="l"><b>Volumen</b></div><div class="r" style="min-width:230px"><input type="range" id="pVol" min="0" max="1" step="0.05" value="${PREFS.volumen}"><button class="btn sm" id="pTest">${ico("sonido")}Probar</button></div></div>
    <div class="set-row"><div class="l"><b>Animaciones</b><span>Reducidas: todo aparece al instante.</span></div><div class="r"><div class="seg"><button type="button" data-anim="completas" aria-pressed="${PREFS.anim === "completas"}">Completas</button><button type="button" data-anim="reducidas" aria-pressed="${PREFS.anim === "reducidas"}">Reducidas</button></div></div></div>
  </div>
  <div class="card set-sec" id="s-avisos"><div class="card-h"><div class="sec-t">Recordatorios</div></div>
    <div class="set-row"><div class="l"><b>Aviso 1 hora antes</b></div><div class="r">${sw("pA60", PREFS.aviso60)}</div></div>
    <div class="set-row"><div class="l"><b>Aviso 15 minutos antes</b></div><div class="r">${sw("pA15", PREFS.aviso15)}</div></div>
    <div class="set-row"><div class="l"><b>Avisos del sistema</b><span>Notificación del Mac o del iPhone mientras CRONOVA está abierta.</span></div><div class="r">${sw("pSys", PREFS.avisoSistema)}</div></div>
  </div>
  <div class="card set-sec" id="s-nube"><div class="card-h"><div class="sec-t">Nube</div><span class="badge" style="--c:${S.mode === "db" ? "var(--ok)" : "var(--warn)"}"><i></i>${S.mode === "db" ? "Conectada" : "Sin conexión"}</span></div>
    <dl class="kv"><dt>Cuenta</dt><dd>${esc(em || "—")}</dd><dt>Eventos</dt><dd>${S.events.length}</dd><dt>Correos</dt><dd>${S.emails.length}</dd><dt>Llamadas</dt><dd>${S.calls.length}</dd><dt>Por subir</dt><dd>${Object.keys(queue).length}</dd>
      <dt>Ajustes en la nube</dt><dd>${S.prefsNube === false ? "falta ejecutar supabase/02_cronova.sql" : S.prefsNube ? "sincronizados" : "—"}</dd></dl>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn sm" id="pSync">${ico("recargar")}Sincronizar ahora</button><button class="btn sm" id="pExport">${ico("descarga")}Descargar respaldo</button><button class="btn sm danger" id="pOut">${ico("salir")}Cerrar sesión</button></div>
  </div>
  <div class="card set-sec" id="s-correo"><div class="card-h"><div class="sec-t">Correo</div></div>
    <div class="set-row"><div class="l"><b>Bandeja</b><span>Pegas los correos en Correo y la IA encuentra fechas y compromisos.</span></div><div class="r"><a class="btn sm" href="#correo">${ico("correo")}Abrir correo</a></div></div>
    <div class="set-row"><div class="l"><b>Conectar Gmail</b><span>Próximo paso: leer tu bandeja sola y mandarte el resumen cada mañana.</span></div><div class="r"><span class="badge"><i></i>Próximamente</span></div></div>
    <div class="set-row"><div class="l"><b>Hora del resumen de la mañana</b></div><div class="r"><input class="in" type="time" id="pBrief" value="${esc(PREFS.horaResumen)}" style="width:140px"></div></div>
  </div>
  <div class="card set-sec" id="s-ia"><div class="card-h"><div class="sec-t">Inteligencia artificial</div><span class="badge" id="aiChip"><i></i>Sin probar</span></div>
    <div class="set-row"><div class="l"><b>Estado de la IA</b><span>Usa la función orbita-ia de tu Supabase con tu clave de Anthropic.</span></div><div class="r"><button class="btn sm" id="pAiTest">${ico("ia")}Probar conexión</button></div></div>
    <p class="note" style="margin:8px 0 0">Para activarla: crea una clave en console.anthropic.com, guárdala en Supabase (Edge Functions → Secrets) como ANTHROPIC_API_KEY y despliega la función orbita-ia. Los pasos están en el LEEME del repositorio.</p>
  </div>
  <div class="card set-sec" id="s-sistema"><div class="card-h"><div class="sec-t">Sistema</div></div>
    <dl class="kv"><dt>Versión</dt><dd>CRONOVA 2.1</dd><dt>Hoy</dt><dd>${esc(cap1(fmtDayY(NOW())))}</dd><dt>Agenda permitida</dt><dd>${esc(TODAY())} → ${esc(MAXDATE())}</dd><dt>Lugares</dt><dd>${MUN.length.toLocaleString("es-CO")} municipios (DANE) + ${lug.length} guardados</dd></dl>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn sm" id="pReload">${ico("recargar")}Recargar la app</button><button class="btn sm ghost" id="pRoutes">${ico("ruta")}Borrar rutas guardadas</button></div>
  </div>`;
  const nameIn = $("#pName"); let nt = 0;
  nameIn.addEventListener("input", () => { clearTimeout(nt); nt = setTimeout(() => { const v = nameIn.value.trim(); if (v) savePrefs({ nombre: v }, true); }, 350); });
  nameIn.addEventListener("change", () => { if (nameIn.value.trim()) toast("Listo, te llamaré " + nameIn.value.trim() + ".", "ok", "guardar"); });
  $("#pHome").onclick = openHomeSheet;
  makeCombo($("#pPlaceBox"), $("#pPlace"), p => { savePlace(p); renderSettings(); toast(p.n + " quedó en tus lugares.", "ok", "guardar"); });
  $$("#settings [data-rmplace]").forEach(b => b.onclick = () => { const l = (PREFS.lugares || []).slice(); l.splice(+b.dataset.rmplace, 1); savePrefs({ lugares: l }); Sfx.play("borrar"); });
  bindSwatches($("#settings"));
  $$("#settings [data-fuente]").forEach(b => b.onclick = () => { savePrefs({ fuente: b.dataset.fuente }); Sfx.play("toque"); });
  $$("#settings [data-texto]").forEach(b => b.onclick = () => { savePrefs({ texto: b.dataset.texto }); Sfx.play("toque"); });
  $$("#settings [data-anim]").forEach(b => b.onclick = () => { savePrefs({ anim: b.dataset.anim }); Sfx.play("toque"); });
  $("#pSnd").onchange = e => { savePrefs({ sonido: e.target.checked }, true); if (e.target.checked) Sfx.play("completar"); };
  $("#pVol").oninput = e => savePrefs({ volumen: +e.target.value }, true);
  $("#pVol").onchange = () => Sfx.play("toque");
  $("#pTest").onclick = () => ["guardar", "completar", "alerta"].forEach((s, i) => setTimeout(() => Sfx.play(s), i * 700));
  $("#pA60").onchange = e => savePrefs({ aviso60: e.target.checked }, true);
  $("#pA15").onchange = e => savePrefs({ aviso15: e.target.checked }, true);
  $("#pSys").onchange = async e => {
    if (e.target.checked && "Notification" in window) { const p = await Notification.requestPermission(); if (p !== "granted") { e.target.checked = false; toast("No diste permiso de notificaciones.", "warn"); return; } }
    else if (e.target.checked) { e.target.checked = false; toast("Este navegador no permite notificaciones.", "warn"); return; }
    savePrefs({ avisoSistema: e.target.checked }, true);
  };
  $("#pBrief").onchange = e => savePrefs({ horaResumen: e.target.value }, true);
  $("#pSync").onclick = syncNow;
  $("#pExport").onclick = () => { const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), eventos: S.events, correos: S.emails, llamadas: S.calls, ajustes: PREFS }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "cronova-respaldo-" + TODAY() + ".json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("Respaldo descargado.", "ok", "guardar"); };
  $("#pOut").onclick = async () => { if (supa) await supa.auth.signOut(); };
  $("#pAiTest").onclick = async () => { const chip = $("#aiChip"); chip.style.setProperty("--c", "var(--acc)"); chip.innerHTML = "<i></i>Probando…";
    try { const t = await ask("Responde solo con la palabra: listo"); chip.style.setProperty("--c", "var(--ok)"); chip.innerHTML = "<i></i>Activa"; toast("La IA responde: " + t.slice(0, 40), "ok", "respuesta"); }
    catch (e) { chip.style.setProperty("--c", "var(--bad)"); chip.innerHTML = "<i></i>No activa"; toast(aiErr(e), "bad", "error"); } };
  $("#pReload").onclick = () => location.reload();
  $("#pRoutes").onclick = () => { Object.keys(RCACHE).forEach(k => delete RCACHE[k]); lsSet("cronova.rutas", {}); monthKm = {}; toast("Rutas borradas. Se recalculan solas.", "ok", "borrar"); };
}
async function syncNow() { await flush(); if (session) { try { await loadAll(); saveLocal(); renderAll(); toast("Sincronizado.", "ok", "guardar"); } catch (e) { toast("No se pudo sincronizar.", "bad", "error"); } } else toast("Entra con tu cuenta para sincronizar.", "warn"); }
$("#syncPill").addEventListener("click", syncNow);

/* ───────────────────────── Recordatorios ───────────────────────── */
const warned = new Set(lsGet("cronova.avisados", []));
function tickReminders() {
  const now = NOW();
  S.events.forEach(e => {
    if (e.done || !e.time) return; const m = (evStart(e) - now) / 6e4;
    [[60, PREFS.aviso60], [15, PREFS.aviso15]].forEach(([th, on]) => { const k = e.id + ":" + th + ":" + e.date + e.time;
      if (on && m > 0 && m <= th && !warned.has(k)) { warned.add(k); lsSet("cronova.avisados", [...warned].slice(-200));
        const L = evLoc(e); const msg = `En ${Math.round(m)} min: ${e.title}${L ? " · " + L.name : ""}${e.place ? " · " + e.place : ""}`;
        toast(msg, th === 15 ? "bad" : "warn", "alerta");
        if (PREFS.avisoSistema && "Notification" in window && Notification.permission === "granted") { try { new Notification("CRONOVA", { body: msg, icon: "icono-180.png" }); } catch (_) {} } } });
  });
}
setInterval(tickReminders, 30000);

/* ───────────────────────── Render global ───────────────────────── */
function renderAll() {
  setSync();
  if (current === "inicio") renderInicio();
  if (current === "agenda") renderAgenda();
  if (current === "mapa" && (MAP || mapFailed)) renderMapPanel();
  if (current === "llamadas") renderCalls();
  if (current === "correo") renderMail();
  if (current === "asistente") renderChat();
  if (current === "ajustes") renderSettings();
}

/* ───────────────────────── Arranque ───────────────────────── */
applyPrefs();
tickClock();
if (canSpeak) $("#speakBrief").hidden = false;
setupDictation();
loadGeo().then(() => { route(); renderAll(); });
route();
initStore().then(() => setTimeout(tickReminders, 1500));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
window.matchMedia("(prefers-color-scheme: dark)");
})();
