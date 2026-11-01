/* ==================================================================
   TIEMPO REAL (Ably) · lo comparten [route].js, alertas.js y brb.js
   El nombre empieza con «_»: Vercel no lo convierte en una ruta.

   Tu servidor avisa UNA vez a Ably cuando pasa algo (sub, Kicks, raid,
   alerta repetida, encuesta de Twitch…) y Ably se lo entrega al momento a
   tus celulares, al player de alertas, al letrero de la meta y al BRB.
   Así ya nadie tiene que estar preguntando cada pocos segundos.

   La llave de Ably vive SOLO en Vercel (variable ABLY_API_KEY): nunca
   en GitHub ni en la app. Las páginas reciben un permiso de «solo
   escuchar» que firma tu servidor (no puede publicar nada).
   Sin la variable, todo sigue funcionando como antes (preguntando).
   ================================================================== */
'use strict';
const crypto = require('crypto');

const CH = 'kf';                                   // un solo canal para todo
function key() {
  const k = String(process.env.ABLY_API_KEY || '').trim();
  return /^[\w-]+\.[\w-]+:[\w+/=-]+$/.test(k) ? k : '';
}
function on() { return !!key(); }

// avisar a Ably (nunca tarda más de ~2.5 s ni rompe lo demás si Ably falla)
const HOSTS = ['https://rest.ably.io', 'https://main.realtime.ably.net'];
async function pub(name, data) {
  const k = key(); if (!k) return false;
  const body = JSON.stringify([{ name: String(name), data: JSON.stringify(data == null ? {} : data), encoding: 'json' }]);   // igual que lo manda la librería de Ably
  if (body.length > 60000) return false;          // Ably acepta hasta 64 KB por mensaje
  const auth = 'Basic ' + Buffer.from(k).toString('base64');
  for (const h of HOSTS) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 2000);
    try {
      const r = await fetch(h + '/channels/' + CH + '/messages', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body, signal: ac.signal });
      clearTimeout(t);
      if (r.ok) return true;
      if (r.status < 500) return false;           // 4xx: el otro host diría lo mismo
    } catch (e) { clearTimeout(t); }
  }
  return false;
}
// varios avisos en paralelo (por si un webhook trae más de una cosa)
function pubSafe(name, data) { return pub(name, data).catch(() => false); }

// permiso de «solo escuchar» el canal (lo firma tu servidor: no se llama a Ably)
function tokenRequest(ttlMs) {
  const k = key(); if (!k) return null;
  const i = k.indexOf(':'), keyName = k.slice(0, i), secret = k.slice(i + 1);
  const ttl = Math.round(ttlMs || 6 * 3600e3);
  const capability = JSON.stringify({ [CH]: ['subscribe'] });
  const timestamp = Date.now(), nonce = crypto.randomBytes(12).toString('hex'), clientId = '';
  const text = keyName + '\n' + ttl + '\n' + capability + '\n' + clientId + '\n' + timestamp + '\n' + nonce + '\n';
  const mac = crypto.createHmac('sha256', secret).update(text).digest('base64');
  return { keyName, ttl, capability, timestamp, nonce, mac };
}

module.exports = { CH, on, pub: pubSafe, tokenRequest };
