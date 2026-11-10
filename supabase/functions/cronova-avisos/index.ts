// @ts-nocheck
// ════════════════════════════════════════════════════════════════════════════
// CRONOVA · Edge Function "cronova-avisos"
// Envía notificaciones al iPhone y al Mac (Web Push), aunque la app esté cerrada.
//
//   accion "clave"   : (con tu sesión) entrega la clave pública para activar avisos.
//   accion "prueba"  : (con tu sesión) envía una notificación de prueba a tus dispositivos.
//   accion "revisar" : (la llama Supabase Cron cada 5 minutos)
//        · Resumen del día con todas tus citas, a la hora elegida (por defecto 10:00 a. m.).
//        · Aviso antes de cada cita (por defecto 30 minutos antes).
//     Cada aviso se envía una sola vez (tabla orb_push_envios).
//
// Sin librerías externas: el cifrado de Web Push (RFC 8291) y la firma VAPID
// (RFC 8292) se hacen con WebCrypto, igual que en Mis Deudores.
// ════════════════════════════════════════════════════════════════════════════

const URL_APP = 'https://samuelmonsalve256-ai.github.io/orbita/';
const ZONA = -5;                       // Colombia (UTC-5, sin horario de verano)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cr-cron',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Bytes ────────────────────────────────────────────────────────────────────
const te = new TextEncoder();
export function b64url(buf) { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function deB64url(str) { const s = String(str).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '='.repeat((4 - s.length % 4) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function unir(...p) { const t = p.reduce((n, x) => n + x.length, 0); const o = new Uint8Array(t); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; }
async function hkdf(salt, ikm, info, bytes) { const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8)); }

// ── VAPID ────────────────────────────────────────────────────────────────────
async function generarClavesVapid() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { publica: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))), privada: await crypto.subtle.exportKey('jwk', par.privateKey) };
}
async function firmaVapid(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const cab = b64url(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64url(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: URL_APP })));
  const clave = await crypto.subtle.importKey('jwk', vapid.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, te.encode(cab + '.' + cuerpo)));
  return 'vapid t=' + cab + '.' + cuerpo + '.' + b64url(firma) + ', k=' + vapid.publica;
}
async function cifrar(p256dh, authSecret, texto) {
  const uaPublica = deB64url(p256dh), auth = deB64url(authSecret);
  const ef = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', ef.publicKey));
  const uaClave = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaClave }, ef.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, unir(te.encode('WebPush: info\0'), uaPublica, asPublica), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, unir(te.encode(texto), new Uint8Array([2]))));
  return unir(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublica.length]), asPublica, cifrado);
}
async function enviarPush(s, vapid, mensaje) {
  const r = await fetch(s.endpoint, { method: 'POST', body: await cifrar(s.p256dh, s.auth, JSON.stringify(mensaje)),
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'TTL': '3600', 'Urgency': 'high', 'Authorization': await firmaVapid(s.endpoint, vapid) } });
  return r.status;
}

// ── Fechas en hora de Colombia ───────────────────────────────────────────────
const ahoraCol = () => new Date(Date.now() + ZONA * 3600e3);        // los campos UTC de esta fecha son la hora de Colombia
const fechaCol = (d = ahoraCol()) => d.toISOString().slice(0, 10);
const minutosDelDia = (d = ahoraCol()) => d.getUTCHours() * 60 + d.getUTCMinutes();
const inicioMs = e => Date.parse(e.date + 'T' + (e.time || '00:00') + ':00Z') - ZONA * 3600e3;   // instante real (UTC)
function hora12(t) { if (!t) return 'Todo el día'; const [h, m] = t.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' p. m.' : ' a. m.'); }
const lugar = e => [e.place, e.city].filter(Boolean).join(', ');

/* Ajustes del usuario (se guardan desde CRONOVA → Ajustes → Recordatorios) */
export function ajustesAvisos(prefs) {
  const p = prefs || {};
  const [h, m] = String(p.horaResumen || '10:00').split(':').map(Number);
  return { diario: p.pushDiario !== false, horaMin: (h || 10) * 60 + (m || 0), antes: p.pushAntes !== false, minutos: Number(p.avisoAntes) || 30, nombre: p.nombre || '' };
}
/* Mensaje del resumen diario */
export function mensajeDiario(eventos, hoy, a) {
  const deHoy = eventos.filter(e => e.date === hoy && !e.done).sort((x, y) => String(x.time || '').localeCompare(String(y.time || '')));
  const saludo = a.nombre ? a.nombre.split(' ')[0] + ', ' : '';
  if (!deHoy.length) {
    const prox = eventos.filter(e => e.date > hoy && !e.done).sort((x, y) => (x.date + (x.time || '')).localeCompare(y.date + (y.time || '')))[0];
    return { title: '☀️ Hoy tienes el día libre', body: saludo + 'no tienes citas hoy.' + (prox ? ' Próxima: ' + prox.title + ' el ' + prox.date.slice(8) + '/' + prox.date.slice(5, 7) + (prox.time ? ' a las ' + hora12(prox.time) : '') : ''), tag: 'cr-diario', url: URL_APP + '#inicio' };
  }
  const lineas = deHoy.slice(0, 6).map(e => (e.time ? hora12(e.time) : 'Todo el día') + ' · ' + e.title + (lugar(e) ? ' (' + lugar(e) + ')' : ''));
  if (deHoy.length > 6) lineas.push('y ' + (deHoy.length - 6) + ' más');
  return { title: '📅 Tu agenda de hoy · ' + deHoy.length + (deHoy.length === 1 ? ' cita' : ' citas'), body: lineas.join('\n'), tag: 'cr-diario', url: URL_APP + '#agenda' };
}
/* Citas que empiezan dentro de los próximos "minutos" */
export function citasProximas(eventos, ahoraMs, minutos) {
  return eventos.filter(e => e.time && !e.done && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map(e => ({ e, falta: Math.round((inicioMs(e) - ahoraMs) / 60000) }))
    .filter(x => x.falta > 0 && x.falta <= minutos);
}
export function mensajeCita(e, falta) {
  return { title: '⏰ En ' + falta + ' min: ' + e.title, body: hora12(e.time) + (lugar(e) ? ' · ' + lugar(e) : '') + (e.contact ? '\nCon: ' + e.contact : '') + '\nToca para ver la cita.', tag: 'cr-cita-' + e.id, url: URL_APP + '#agenda' };
}

// ── Base de datos (clave de servicio, solo dentro de Supabase) ───────────────
const ENV = k => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined);
const SB_URL = ENV('SUPABASE_URL'), SB_SERVICE = ENV('SUPABASE_SERVICE_ROLE_KEY'), SB_ANON = ENV('SUPABASE_ANON_KEY');
async function db(ruta, op = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + ruta, { ...op, headers: { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE, 'Content-Type': 'application/json', ...(op.headers || {}) } });
  if (!r.ok) throw new Error('BD ' + r.status + ': ' + await r.text());
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function config() {
  const f = await db('orb_push_config?id=eq.1&select=*'); let c = f && f[0];
  if (!c) throw new Error('Falta ejecutar supabase/03_cronova_avisos.sql');
  if (!c.vapid_publica || !c.vapid_privada) { const k = await generarClavesVapid(); await db('orb_push_config?id=eq.1', { method: 'PATCH', body: JSON.stringify({ vapid_publica: k.publica, vapid_privada: k.privada }) }); c = { ...c, vapid_publica: k.publica, vapid_privada: k.privada }; }
  return c;
}
async function usuarioDeToken(req) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''); if (!token) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON || SB_SERVICE, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null; const u = await r.json(); return u && u.id ? u : null;
}
async function marcar(uid, clave) {   // true solo la primera vez
  const r = await db('orb_push_envios', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ user_id: uid, clave }) });
  return !!(r && r.length);
}
async function enviarAUsuario(uid, mensajes, vapid) {
  const subs = await db('orb_push_suscripciones?user_id=eq.' + uid + '&select=*'); let ok = 0;
  for (const s of subs || []) {
    for (const m of mensajes) {
      try { const st = await enviarPush(s, vapid, m);
        if (st === 404 || st === 410) { await db('orb_push_suscripciones?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE' }); break; }
        if (st >= 200 && st < 300) ok++; } catch (e) { console.log('push falló', e); }
    }
    await db('orb_push_suscripciones?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'PATCH', body: JSON.stringify({ ultimo_envio: new Date().toISOString() }) }).catch(() => {});
  }
  return ok;
}
const resp = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const cuerpo = await req.json().catch(() => ({})); const accion = cuerpo.accion;
    const cfg = await config(); const vapid = { publica: cfg.vapid_publica, privada: cfg.vapid_privada };
    if (accion === 'clave') { if (!await usuarioDeToken(req)) return resp({ error: 'Inicia sesión' }, 401); return resp({ publica: vapid.publica }); }
    if (accion === 'prueba') {
      const u = await usuarioDeToken(req); if (!u) return resp({ error: 'Inicia sesión' }, 401);
      const n = await enviarAUsuario(u.id, [{ title: '✅ CRONOVA', body: 'Las notificaciones funcionan en este dispositivo. Aquí te llegarán tus citas del día y el aviso antes de cada una.', tag: 'cr-prueba', url: URL_APP }], vapid);
      return resp({ enviadas: n });
    }
    if (accion === 'revisar') {
      if (req.headers.get('x-cr-cron') !== cfg.secreto_cron) return resp({ error: 'No autorizado' }, 401);
      const hoy = fechaCol(), min = minutosDelDia(), ahora = Date.now();
      const subs = await db('orb_push_suscripciones?select=user_id');
      const usuarios = [...new Set((subs || []).map(s => s.user_id))]; const resultado = [];
      for (const uid of usuarios) {
        const filas = await db('orb_items?user_id=eq.' + uid + '&coleccion=in.(events,config)&deleted_at=is.null&select=coleccion,id,data');
        const eventos = filas.filter(f => f.coleccion === 'events').map(f => ({ id: f.id, ...f.data }));
        const prefs = (filas.find(f => f.coleccion === 'config' && f.id === 'prefs') || {}).data || {};
        const a = ajustesAvisos(prefs); const msgs = [];
        // Resumen del día: desde la hora elegida y hasta 3 horas después (por si el servicio estuvo ocupado)
        if (a.diario && min >= a.horaMin && min < a.horaMin + 180 && await marcar(uid, 'diario-' + hoy)) msgs.push(mensajeDiario(eventos, hoy, a));
        // Aviso antes de cada cita
        if (a.antes) for (const x of citasProximas(eventos, ahora, a.minutos)) {
          if (await marcar(uid, 'cita-' + x.e.id + '-' + x.e.date + 'T' + x.e.time)) msgs.push(mensajeCita(x.e, x.falta));
        }
        resultado.push({ usuario: uid, mensajes: msgs.length, enviadas: msgs.length ? await enviarAUsuario(uid, msgs, vapid) : 0 });
      }
      return resp({ hoy, hora: Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0'), resultado });
    }
    return resp({ error: 'Acción desconocida' }, 400);
  } catch (e) { console.log('Error:', e); return resp({ error: String(e && e.message || e) }, 500); }
});
