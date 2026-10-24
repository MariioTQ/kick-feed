/* ==================================================================
   KICK FEED · SERVIDOR (Vercel)
   Un solo archivo con todas las rutas:
     /api/webhook   Kick avisa aquí cada sub, resub, regalo, Kicks, ban…
     /api/events    el feed pide la lista de eventos (y los totales)
     /api/login     conectar tu cuenta de Kick (una sola vez)
     /api/callback  Kick regresa aquí después de "Autorizar"
     /api/status    página para revisar que todo esté funcionando
     /api/prefs     los mismos ajustes en tus dos celulares
     /api/obs       cambiar de escena en OBS desde el feed
     /api/rules     reglas automáticas: «cuando pase esto, haz esto»
     /api/goal      sumar o restar subs a la meta a mano

   Variables que se configuran en Vercel (Settings → Environment Variables):
     KICK_CLIENT_ID, KICK_CLIENT_SECRET   las dos claves de tu app de Kick
     KICK_CHANNEL                         opcional, por defecto "mariotq"
   La base de datos (Upstash for Redis) agrega sola sus variables.

   No se guarda ninguna contraseña de Kick. Solo el permiso que tú autorizas
   en la página oficial de Kick, y únicamente si la cuenta es KICK_CHANNEL.
   (La de OBS, si la pones, se guarda cifrada y nunca se vuelve a mostrar.)
   ================================================================== */
'use strict';
const crypto = require('crypto');

const CHANNEL = (process.env.KICK_CHANNEL || 'mariotq').toLowerCase();
const CLIENT_ID = process.env.KICK_CLIENT_ID || '';
const CLIENT_SECRET = process.env.KICK_CLIENT_SECRET || '';
const SCOPES = 'user:read channel:read channel:write events:subscribe kicks:read chat:write moderation:ban moderation:chat_message:manage';
const EVENTS = [
  'channel.subscription.new', 'channel.subscription.renewal', 'channel.subscription.gifts',
  'kicks.gifted', 'channel.followed', 'moderation.banned', 'livestream.status.updated',
  'chat.message.sent',         // el chat por la vía oficial (respaldo cuando Kick no deja conectar directo)
  'livestream.metadata.updated' // cambio de título o categoría
];
const SUBS_VER = '4';          // si cambia la lista, el servidor se vuelve a suscribir solo
const KEEP = 4000;          // cuántos eventos se guardan como máximo

/* ---------------- Redis (Upstash, por su API web) ---------------- */
// Funciona con cualquier prefijo que ponga Vercel (KV_, STORAGE_, etc.).
function envEnding(suffix, alt) {
  if (process.env[alt]) return process.env[alt];
  const k = Object.keys(process.env).find(n => n.endsWith(suffix) && !/READ_ONLY/.test(n));
  return k ? process.env[k] : '';
}
const R_URL = envEnding('_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
const R_TOK = envEnding('_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
async function redis(...cmd) {
  if (!R_URL || !R_TOK) throw new Error('Falta la base de datos (Upstash for Redis)');
  const r = await fetch(R_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}
async function getJSON(key) { const v = await redis('GET', key); try { return v ? JSON.parse(v) : null; } catch (e) { return null; } }
async function setJSON(key, val, ex) { return ex ? redis('SET', key, JSON.stringify(val), 'EX', ex) : redis('SET', key, JSON.stringify(val)); }
async function logPush(key, val, max) { await redis('LPUSH', key, JSON.stringify(val)); await redis('LTRIM', key, 0, (max || 30) - 1); }

/* ---------------- utilidades ---------------- */
function send(res, code, body, type) {
  res.statusCode = code;
  res.setHeader('Content-Type', type || 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function readRaw(req) {
  return new Promise((ok, bad) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', bad);
  });
}
function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return 'https://' + host;
}
function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function page(title, body) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title><style>body{margin:0;background:#0e0f13;color:#e8eaee;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    'main{max-width:560px;margin:0 auto;padding:28px 18px}h1{font-size:22px;margin:0 0 14px}.ok{color:#53fc18}.bad{color:#ff5a4f}.warn{color:#ffb020}' +
    'li{margin:6px 0}code{background:#1b1e25;padding:1px 6px;border-radius:5px}a.btn{display:inline-block;margin-top:14px;background:#53fc18;color:#0e0f13;' +
    'font-weight:700;padding:10px 16px;border-radius:10px;text-decoration:none}small{color:#9aa1ad}</style></head><body><main>' + body + '</main></body></html>';
}

/* Si Kick tarda demasiado, mejor avisar que dejar al feed esperando */
async function kfetch(url, opts, ms) {
  try { return await fetch(url, Object.assign({}, opts || {}, { signal: AbortSignal.timeout(ms || 9000) })); }
  catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error('Kick tardó demasiado en contestar, intenta otra vez');
    throw e;
  }
}
/* ---------------- tokens de Kick ---------------- */
async function tokenRequest(params) {
  const r = await kfetch('https://id.kick.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Kick no entregó el permiso (' + r.status + ' ' + (j.error_description || j.error || j.message || '') + ')');
  return j;
}
async function validToken() {
  const t = await getJSON('tok');
  if (!t) return null;
  if (Date.now() < t.expires_at - 120000) return t;
  const j = await tokenRequest({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: t.refresh_token });
  const nt = Object.assign({}, t, { access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000 });
  await setJSON('tok', nt);
  return nt;
}
async function kickApi(path, token, opts) {
  const r = await kfetch('https://api.kick.com/public/v1' + path, Object.assign({
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' }
  }, opts || {}));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Kick API ' + path + ' → ' + r.status + ' ' + (j.message || ''));
  return j;
}
async function subscribeAll(tok) {
  // Quita las suscripciones viejas de esta app y crea las nuevas.
  try {
    const cur = await kickApi('/events/subscriptions', tok.access_token);
    const ids = (cur.data || []).map(s => s.id).filter(Boolean);
    if (ids.length) await kickApi('/events/subscriptions?' + ids.map(i => 'id=' + encodeURIComponent(i)).join('&'), tok.access_token, { method: 'DELETE' });
  } catch (e) { /* si no había, no pasa nada */ }
  const body = { broadcaster_user_id: tok.user_id, method: 'webhook', events: EVENTS.map(n => ({ name: n, version: 1 })) };
  const j = await kickApi('/events/subscriptions', tok.access_token, { method: 'POST', body: JSON.stringify(body) });
  return (j.data || []).map(x => ({ name: x.name, ok: !!x.subscription_id && !x.error, error: x.error || '' }));
}

/* ---------------- verificar que el aviso sí viene de Kick ---------------- */
let PUBKEY = process.env.KICK_PUBLIC_KEY || '';
let PUBOBJ = null;
async function kickPublicKey() {
  if (PUBKEY) return PUBKEY;
  const r = await kfetch('https://api.kick.com/public/v1/public-key');
  const j = await r.json();
  PUBKEY = (j.data && (j.data.public_key || j.data.publicKey)) || j.public_key || '';
  return PUBKEY;
}
async function verifyKick(req, raw) {
  const id = req.headers['kick-event-message-id'], ts = req.headers['kick-event-message-timestamp'];
  const sig = req.headers['kick-event-signature'];
  if (!id || !ts || !sig) return false;
  if (!PUBOBJ) PUBOBJ = crypto.createPublicKey(await kickPublicKey());   // se lee una sola vez
  return crypto.verify('sha256', Buffer.from(id + '.' + ts + '.' + raw), { key: PUBOBJ, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(sig, 'base64'));
}

/* ---------------- convertir el aviso de Kick en un evento sencillo ---------------- */
function uname(u) { return u ? (u.username || u.name || u.slug || '') : ''; }
function normalize(type, p) {
  switch (type) {
    case 'channel.subscription.new':
      return { kind: 'sub', user: uname(p.subscriber), months: Number(p.duration) || 1 };
    case 'channel.subscription.renewal':
      return { kind: 'resub', user: uname(p.subscriber), months: Number(p.duration) || 0 };
    case 'channel.subscription.gifts': {
      const g = (p.giftees || []).map(uname).filter(Boolean);
      return { kind: 'gift', user: p.gifter && !p.gifter.is_anonymous ? uname(p.gifter) : '', anon: !!(p.gifter && p.gifter.is_anonymous),
               giftees: g, count: g.length || 1 };
    }
    case 'kicks.gifted': {
      const gi = p.gift || {};
      return { kind: 'kicks', user: uname(p.sender), amount: Number(gi.amount) || 0, name: gi.name || '', message: gi.message || '' };
    }
    case 'channel.followed':
      return { kind: 'follow', user: uname(p.follower) };
    case 'moderation.banned': {
      const m = p.metadata || {};
      return { kind: 'ban', user: uname(p.banned_user), uid: (p.banned_user || {}).user_id || 0, mod: uname(p.moderator), reason: m.reason || '', expires_at: m.expires_at || null };
    }
    case 'livestream.metadata.updated': {
      const md = p.metadata || {}, c = md.category || null;
      return { kind: 'meta', title: md.title || '', cat: c ? { id: c.id || 0, name: c.name || '' } : null };
    }
    case 'livestream.status.updated':
      return { kind: 'live', is_live: !!p.is_live, started_at: p.started_at || null, ended_at: p.ended_at || null, title: p.title || '' };
    default:
      return { kind: 'other' };
  }
}
// La hora que se usa para ordenar y contar. En las renovaciones Kick manda
// en "created_at" la fecha del periodo anterior (un mes antes), así que ahí
// manda la hora en que llegó el aviso. Igual si la fecha viene muy lejos.
const FIX_WIN = 30 * 60000;
function effTs(e) {
  if (!e) return 0;
  if (e.type === 'channel.subscription.renewal' && e.rt) return e.rt;
  if (e.rt && e.ts && e.type !== 'livestream.status.updated' && Math.abs(e.ts - e.rt) > FIX_WIN) return e.rt;
  return e.ts || e.rt || 0;
}
function fixEv(e) { if (e) e.ts = effTs(e); return e; }
// Una sola vez: corrige las que ya estaban guardadas con la fecha mala.
let FIXED = false;              // ya se corrigieron las horas (se recuerda mientras el servidor sigue despierto)
async function repairTimes() {
  if (FIXED) return;
  if (await redis('GET', 'fixTs1')) { FIXED = true; return; }
  for (const key of ['L:subs', 'L:kicks', 'ev']) {
    const all = await redis('ZRANGE', key, 0, -1, 'WITHSCORES');
    for (let i = 0; i + 1 < (all || []).length; i += 2) {
      let e; try { e = JSON.parse(all[i]); } catch (x) { continue; }
      const t = effTs(e);
      if (t && t !== e.ts) {
        const score = key === 'ev' ? Number(all[i + 1]) : t;
        e.ts = t;
        await redis('ZREM', key, all[i]);
        await redis('ZADD', key, score, JSON.stringify(e));
      }
    }
  }
  await redis('SET', 'fixTs1', '1');
}

function evTime(type, p, fallback) {
  const t = Date.parse(p.created_at || (p.metadata && p.metadata.created_at) || (type === 'livestream.status.updated' ? (p.is_live ? p.started_at : p.ended_at) : '') || '');
  return t || fallback;
}

/* ---------------- antispam ----------------
   Lo que siempre mandan los bots que spamean (Mario las pasó el 14 oct 2026).
   Solo BORRA el mensaje (no banea) y solo a cuentas sin ninguna insignia:
   subs, VIPs, OGs, mods, etc. nunca se tocan. La lista se cambia desde el
   ⚙ del feed (🛡 Antispam). Para que no se escapen con letras raras, puntos
   o espacios, se compara una versión "limpia" de los dos textos. */
const SPAM_DEFAULT = ['botkiva', 'ai stream upgrades', 'zero cost upgrades',
  "Don't work too hard, leave some success for the rest of us",
  'Hey stranger, still running the show'];
// 20 oct 2026: el bot nuevo (flux_neonblaze17388 y parecidos). Se agregan una sola vez a tu lista.
const SPAM_ADD2 = ['AI-powered viewers', 'daily reward drops', 'stays active around the clock',
  'hope your day is full of wins', "Keep grinding, you're killing it"];
const LOOK = (() => {
  const m = {};
  const add = (from, to) => Array.from(from).forEach((c, i) => { m[c] = to[i]; });
  add('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡʏᴢ', 'abcdefghijklmnopqrstuvwyz');
  add('авсеһіјкмнорѕтухԁԛԝүёї', 'abcehijkmhopstyxdqwyei');
  add('αβεικνορτυχ', 'abeikvoptux');
  add('@4$50137', 'aassoiet');
  return m;
})();
function spamNorm(s) {
  s = String(s || '').replace(/\[emote:\d+:[^\]]*\]/g, ' ');
  try { s = s.normalize('NFKC'); } catch (e) {}
  s = s.toLowerCase();
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
  s = Array.from(s).map(c => LOOK[c] || c).join('');
  return s.replace(/[^a-z0-9]+/g, '');
}
function cleanEntry(t) {
  return String(t || '').replace(/\[emote:\d+:([^\]]*)\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
let SPAMC = { at: 0, cfg: null, norm: [] };
function setSpamCache(cfg) { SPAMC = { at: Date.now(), cfg, norm: cfg.list.map(e => [e, spamNorm(e)]).filter(x => x[1].length >= 5) }; return cfg; }
async function spamCfg(fresh) {
  if (!fresh && SPAMC.cfg && Date.now() - SPAMC.at < 300000) return SPAMC.cfg;   // se revisa cada 5 min
  const c = (await getJSON('spam')) || { on: true, list: SPAM_DEFAULT.slice() };
  if (!Array.isArray(c.list)) c.list = [];
  if ((Number(c.seed) || 1) < 2) {                  // las frases del bot nuevo (las puedes quitar en el ⚙)
    SPAM_ADD2.forEach(e => { if (!c.list.some(x => spamNorm(x) === spamNorm(e))) c.list.push(e); });
    c.seed = 2;
    try { await setJSON('spam', c); } catch (e) {}
  }
  return setSpamCache(c);
}
function spamHit(text) {
  const n = spamNorm(text);
  if (n.length < 5) return null;
  for (const [e, ne] of SPAMC.norm) if (n.indexOf(ne) !== -1) return e;
  return null;
}
// v69: además de borrar, timeout (1 min por defecto; tú eliges en ⚙ → Antispam). Kick lo pide en minutos.
const SPAM_TO = [0, 1, 5, 10, 60, 1440];
function spamTo(cfg) { const n = Number(cfg && cfg.to); return SPAM_TO.indexOf(n) >= 0 ? n : 1; }
async function spamDelete(m, rule, manual, cfg) {
  const t = await validToken();
  let r = { ok: false, status: 0, j: {} };
  if (t) r = await kickCall('DELETE', '/chat/' + encodeURIComponent(m.id), t.access_token);
  const ok = r.ok || r.status === 404;                // 404: ya lo había borrado alguien
  const to = spamTo(cfg || SPAMC.cfg);
  let toOk = false, toErr = '';
  if (t && to && m.uid && Number(m.uid) !== Number(t.user_id)) {
    try { await redis('SET', 'spamto:' + m.uid, '1', 'EX', 180); } catch (e) {}   // para que el aviso de Kick no salga repetido
    const b = await kickCall('POST', '/moderation/bans', t.access_token, { broadcaster_user_id: Number(t.user_id), user_id: Number(m.uid), duration: to, reason: 'Spam (antispam automático)' });
    toOk = !!b.ok; if (!b.ok) toErr = kickErr(b.status, b.j, 'Ejecuta acciones de moderación para moderadores');
  }
  const rt = Date.now();
  const ev = { id: 'spam:' + m.id, type: 'antispam', ts: rt, rt,
    d: { kind: 'spam', user: m.u, uid: m.uid || 0, mid: m.id, text: String(m.t || '').slice(0, 300), rule, manual: !!manual, ok, to: toOk ? to : 0, toErr,
         error: ok ? '' : kickErr(r.status, r.j, 'Ejecuta acciones de moderador en mensajes de chat') } };
  await redis('ZADD', 'ev', rt, JSON.stringify(ev));
  await logPush('spamlog', { at: rt, u: m.u, t: ev.d.text.slice(0, 200), rule, ok, manual: !!manual, to: ev.d.to }, 30);
  return ev.d;
}

/* ---------------- quién ya ha escrito en tu chat ----------------
   Para resaltar el primer mensaje de un espectador nuevo. La primera vez se
   llena con lo que ya hay guardado del chat y con quienes te han dado subs o
   Kicks (los seguidores no, para que un seguidor nuevo sí salga resaltado). */
let CHSEED = false;
async function seedChatters() {
  if (CHSEED) return;
  if (await redis('GET', 'chSeed')) { CHSEED = true; return; }
  const names = new Set();
  ((await redis('ZRANGE', 'chat', 0, -1)) || []).forEach(x => { try { const m = JSON.parse(x); if (m.u) names.add(String(m.u).toLowerCase()); } catch (e) {} });
  ((await redis('ZRANGE', 'ev', 0, -1)) || []).forEach(x => { try { const d = (JSON.parse(x) || {}).d || {};
    if (d.user && /^(sub|resub|gift|kicks)$/.test(d.kind || '')) names.add(String(d.user).toLowerCase()); } catch (e) {} });
  const arr = Array.from(names);
  for (let i = 0; i < arr.length; i += 200) await redis('SADD', 'chatters', ...arr.slice(i, i + 200));
  await redis('SET', 'chSeed', '1');
  CHSEED = true;
}
let CBUF = [], CFLUSH = Date.now(), CFLN = 0;
async function chatKeep(m) {
  CBUF.push(m);
  // si un celular está en ámbar (leyendo por aquí) o es spam, se guarda al momento
  if (m.spam || CBUF.length >= 150 || Date.now() - CFLUSH > 20000 || await chatWanted()) await chatFlush();
}
async function chatFlush() {
  if (!CBUF.length) return;
  const items = CBUF; CBUF = []; CFLUSH = Date.now();
  const args = []; items.forEach(x => args.push(x.rt, JSON.stringify(x)));
  await redis('ZADD', 'chat', ...args);                              // todos en una sola consulta
  if (++CFLN % 5 === 0) await redis('ZREMRANGEBYRANK', 'chat', 0, -501);   // se quedan los últimos 500
}
let KNOWN = null;
async function knownLoad() {
  if (KNOWN) return;
  await seedChatters();
  KNOWN = new Set((await redis('SMEMBERS', 'chatters')) || []);
}
// ¿Algún celular está leyendo el chat por aquí (punto ámbar)? Se revisa una vez por minuto.
let WANT = { until: 0, at: 0 };
async function chatWanted() {
  if (Date.now() - WANT.at > 60000) {
    try { WANT = { until: Number(await redis('GET', 'chatWant')) || 0, at: Date.now() }; } catch (e) { WANT.at = Date.now(); }
  }
  return WANT.until > Date.now();
}
async function chatters(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const q = req.query || {};
  if (!(await checkKey(q.key))) return send(res, 403, { ok: false, error: 'clave' });
  await seedChatters();
  const t = await getJSON('tok');
  return send(res, 200, { ok: true, users: (await redis('SMEMBERS', 'chatters')) || [], kick_user_id: (t && t.user_id) || null });
}

/* ---------------- rutas ---------------- */
async function webhook(req, res) {
  if (req.method !== 'POST') return send(res, 200, { ok: true, info: 'Aquí Kick manda los avisos.' });
  const raw = await readRaw(req);
  const type = String(req.headers['kick-event-type'] || '');
  const msgId = String(req.headers['kick-event-message-id'] || '');
  let ok = false;
  try { ok = process.env.KICK_VERIFY === 'off' ? true : await verifyKick(req, raw); } catch (e) { ok = false; }
  if (!ok) {
    try { await logPush('rejected', { at: Date.now(), type, id: msgId, body: raw.slice(0, 300) }, 20); } catch (e) {}
    return send(res, 401, { ok: false });
  }
  let p = {};
  try { p = JSON.parse(raw); } catch (e) {}
  // Mensajes del chat: camino ligero (1 escritura) para no gastar el plan gratis.
  if (type === 'chat.message.sent') {
    const s = p.sender || {}, idt = s.identity || {}, rp = p.replies_to || null;
    const rt = Date.now();
    const m = { id: String(p.message_id || msgId), ts: Date.parse(p.created_at) || rt, rt,
      u: s.username || '', uid: s.user_id || 0, color: idt.username_color || '', badges: idt.badges || [],
      t: String(p.content || '').slice(0, 600) };
    if (rp) m.rq = { id: rp.message_id || '', u: (rp.sender || {}).username || '', t: String(rp.content || '').slice(0, 200) };
    // Tu chat manda miles de mensajes por stream: aquí casi nunca se toca la
    // base de datos (el plan gratis trae 500,000 consultas al mes).
    // Antispam: lo antes posible. Solo usa la base si encuentra spam.
    if (!m.badges.length && m.u) {
      try {
        const cfg = await spamCfg();
        const rule = cfg.on ? spamHit(m.t) : null;
        if (rule) { m.spam = 1; await spamDelete(m, rule, false, cfg); }
      } catch (e) { /* si algo falla, el mensaje sigue su camino */ }
    }
    // ⌨️ Comandos para tus mods (!brb…): cambian OBS desde el chat. Solo se
    // revisa si el mensaje empieza con «!» y lo manda un mod o tú.
    if (m.u && !m.spam && /^\s*!/.test(m.t)) { try { await modCmd(m); } catch (e) {} }
    // ¿Primera vez que escribe en tu canal? Solo se pregunta a la base por
    // nombres que este servidor todavía no conoce.
    if (m.u) {
      try {
        const lu = m.u.toLowerCase();
        await knownLoad();
        if (!KNOWN.has(lu)) { KNOWN.add(lu); if (Number(await redis('SADD', 'chatters', lu)) === 1) m.first = 1; }
      } catch (e) {}
    }
    // Respaldo del chat ("chat proxy"): siempre guarda los últimos 500 mensajes,
    // pero en tandas (una consulta cada ~20 s, no una por mensaje).
    try { await chatKeep(m); } catch (e) {}
    return send(res, 200, { ok: true });
  }
  // Kick puede reintentar el mismo aviso: se guarda una sola vez.
  const fresh = await redis('SET', 'seen:' + msgId, '1', 'NX', 'EX', 7 * 86400);
  if (fresh) {
    const rt = Date.now();                       // cuándo llegó (para que el feed no se salte nada)
    const ts = evTime(type, p, rt);              // cuándo pasó (lo que dice Kick)
    const ev = fixEv({ id: msgId, type, ts, rt, d: normalize(type, p) });
    let skip = false;
    if (ev.d.kind === 'ban' && ev.d.uid) { try { if (await redis('GET', 'spamto:' + ev.d.uid)) ev.d.spam = 1; } catch (e) {} }
    if (type === 'livestream.metadata.updated') {
      // Kick manda todo junto (título, categoría, idioma…): se compara con lo
      // anterior para decir qué cambió de verdad.
      const prev = await getJSON('meta');
      const cur = { title: ev.d.title, cat: ev.d.cat };
      await setJSON('meta', cur);
      const ch = [];
      if (!prev || prev.title !== cur.title) ch.push('title');
      if (!prev || ((prev.cat || {}).id || 0) !== ((cur.cat || {}).id || 0)) ch.push('category');
      ev.d.changed = ch;
      if (prev) { ev.d.oldTitle = prev.title || ''; ev.d.oldCat = (prev.cat || {}).name || ''; }
      skip = !ch.length;
    }
    if (!skip) await redis('ZADD', 'ev', rt, JSON.stringify(ev));
    await redis('ZREMRANGEBYRANK', 'ev', 0, -(KEEP + 1));
    await addToLists(ev);
    let newSess = false;
    if (type === 'livestream.status.updated') {
      await setJSON('live', Object.assign({ at: rt }, ev.d));
      // "Sesión" = el stream del día. Si el stream se corta y vuelve en
      // menos de 30 min (pasa mucho en IRL), sigue siendo la misma sesión
      // y los contadores no se reinician.
      const se = (await getJSON('session')) || {};
      if (ev.d.is_live) {
        const st = Date.parse(ev.d.started_at) || ts;
        if (!se.start || !se.lastEnd || st - se.lastEnd > 30 * 60000) {
          se.prevEnd = se.lastEnd || 0;      // cuándo terminó el stream anterior
          se.start = st;
          newSess = true;                    // para la regla «Empieza el stream» (no cuenta si solo se cortó)
          try { const pa = await getJSON('subAdj'); if (pa && (pa.start === 0 || pa.start === 'off')) await setJSON('subAdj', { start: st, n: 0, s: 0, at: Date.now() }); } catch (e) {}   // v68: cada stream empieza en 0
        }
        se.live = true;
      } else {
        se.lastEnd = Date.parse(ev.d.ended_at) || ts; se.live = false;
      }
      await setJSON('session', se);
    }
    await redis('SET', 'lastHook', String(Date.now()));
    await logPush('raw', { at: Date.now(), type, body: raw.slice(0, 1500) }, 40);
    // ⚙️ reglas automáticas: si alguna le toca a este evento
    const trig = ruleTriggers(ev.d, newSess);
    if (trig.length) {
      const p = Promise.all(trig.map(t => rulesOn(t[0], t[1]))).catch(() => {});
      if (!later(p)) await p;
    }
  }
  return send(res, 200, { ok: true });
}

/* ---- listas para los paneles ★ (subs) y ⚡ (Kicks), ordenadas por hora ---- */
function listOf(kind) { return kind === 'kicks' ? 'L:kicks' : (kind === 'sub' || kind === 'resub' || kind === 'gift') ? 'L:subs' : ''; }
async function addToLists(ev) {
  const key = listOf((ev.d || {}).kind);
  if (!key) return;
  await redis('ZADD', key, ev.ts, JSON.stringify(ev));
  await redis('ZREMRANGEBYRANK', key, 0, -5001);       // las últimas 5,000
}
async function backfillLists() {
  // La primera vez, arma las listas con lo que ya estaba guardado.
  if (await redis('GET', 'listsReady')) return;
  const all = await redis('ZRANGE', 'ev', 0, -1);
  for (const s of (all || [])) { try { await addToLists(JSON.parse(s)); } catch (e) {} }
  await redis('SET', 'listsReady', '1');
}
async function list(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const q = req.query || {};
  const key = q.kind === 'kicks' ? 'L:kicks' : 'L:subs';
  await backfillLists();
  await repairTimes();
  const before = Number(q.before) || 0;                // para ir cargando hacia atrás
  const limit = Math.min(100, Number(q.limit) || 40);
  const max = before ? '(' + before : '+inf';
  const items = await redis('ZREVRANGEBYSCORE', key, max, '-inf', 'LIMIT', 0, limit);
  const evs = (items || []).map(s => { try { return fixEv(JSON.parse(s)); } catch (e) { return null; } }).filter(Boolean)
    .sort((a, b) => b.ts - a.ts);                      // lo más nuevo arriba
  return send(res, 200, { ok: true, kind: q.kind === 'kicks' ? 'kicks' : 'subs', events: evs, more: evs.length === limit });
}

/* ---- cambiar título y categoría (solo con la clave de tus celulares) ---- */
let KEYC = { k: null, at: 0 };
async function checkKey(q) {
  if (!KEYC.k || Date.now() - KEYC.at > 60000) KEYC = { k: await redis('GET', 'feedkey'), at: Date.now() };
  const k = KEYC.k;
  const a = Buffer.from(String(q || '')), b = Buffer.from(String(k || ''));
  return !!k && a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function readJSONBody(req) {
  // Vercel a veces ya trae el cuerpo leído en req.body
  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string' && req.body) return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body) && req.body.length) return JSON.parse(req.body.toString('utf8'));
  } catch (e) { return {}; }
  const raw = await readRaw(req);
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}
async function channel(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const body = req.method === 'POST' ? await readJSONBody(req) : {};
  const key = (req.query && req.query.key) || body.key;
  if (!(await checkKey(key))) return send(res, 403, { ok: false, error: 'clave' });
  const t = await validToken();
  if (!t) return send(res, 409, { ok: false, error: 'Falta conectar tu cuenta' });
  if (req.method === 'POST') {
    const patch = {};
    if (body.title && String(body.title).trim()) patch.stream_title = String(body.title).trim().slice(0, 140);
    if (body.category_id) patch.category_id = Number(body.category_id);
    if (!Object.keys(patch).length) return send(res, 400, { ok: false, error: 'nada que cambiar' });
    const r = await kfetch('https://api.kick.com/public/v1/channels', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const msg = r.status === 401 || r.status === 403 ? 'Kick no dio permiso: vuelve a conectar tu cuenta con "Actualizar información del canal"' : (j.message || ('Kick respondió ' + r.status));
      return send(res, 200, { ok: false, error: msg });
    }
    await logPush('titles', { at: Date.now(), title: patch.stream_title || null, category_id: patch.category_id || null }, 50);
  }
  const j = await kickApi('/channels', t.access_token);
  const c = (j.data || [])[0] || {};
  return send(res, 200, { ok: true, title: c.stream_title || '', category: c.category || null, live: c.stream ? !!c.stream.is_live : null });
}
async function categories(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const q = req.query || {};
  if (!(await checkKey(q.key))) return send(res, 403, { ok: false, error: 'clave' });
  const t = await validToken();
  if (!t) return send(res, 409, { ok: false, error: 'Falta conectar tu cuenta' });
  const term = String(q.q || '').trim();
  if (term.length < 2) return send(res, 200, { ok: true, data: [] });
  let data = [];
  try { data = (await kickApi('/categories?q=' + encodeURIComponent(term), t.access_token)).data || []; } catch (e) {}
  if (!data.length && term.length >= 3) {
    try { data = (await kickApi('/../v2/categories?limit=20&name=' + encodeURIComponent(term), t.access_token)).data || []; } catch (e) {}
  }
  return send(res, 200, { ok: true, data: data.slice(0, 20).map(c => ({ id: c.id, name: c.name, thumbnail: c.thumbnail || '' })) });
}

/* ---- chat: moderar y escribir (solo con la clave de tus celulares) ---- */
function kickErr(status, j, need) {
  const msg = j && (j.message || j.error);
  if (status === 401 || (status === 403 && (!msg || /scope|permission|unauthori|^forbidden$/i.test(msg))))
    return 'Kick no dio permiso: palomea "' + need + '" en tu app de Kick y vuelve a autorizar';
  if (status === 403) return 'Kick no dejó: ' + msg;
  if (status === 429) return 'Kick pidió esperar un momento, intenta otra vez';
  return (j && (j.message || j.error)) || ('Kick respondió ' + status);
}
async function kickCall(method, path, token, body) {
  const r = await kfetch('https://api.kick.com/public/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function mod(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'usa POST' });
  const b = await readJSONBody(req);
  if (!(await checkKey(b.key))) return send(res, 403, { ok: false, error: 'clave' });
  const t = await validToken();
  if (!t) return send(res, 409, { ok: false, error: 'Falta conectar tu cuenta' });
  const me = Number(t.user_id), uid = Number(b.user_id);
  const act = String(b.action || '');
  let r, need = 'Ejecuta acciones de moderación para moderadores';
  if (act === 'delete') {
    if (!b.message_id) return send(res, 400, { ok: false, error: 'falta el mensaje' });
    need = 'Ejecuta acciones de moderador en mensajes de chat';
    r = await kickCall('DELETE', '/chat/' + encodeURIComponent(String(b.message_id)), t.access_token);
  } else {
    if (!uid) return send(res, 400, { ok: false, error: 'falta la persona' });
    if (uid === me) return send(res, 400, { ok: false, error: 'No te puedes silenciar a ti mismo' });
    if (act === 'unban') {
      r = await kickCall('DELETE', '/moderation/bans', t.access_token, { broadcaster_user_id: me, user_id: uid });
    } else if (act === 'timeout' || act === 'ban') {
      const body = { broadcaster_user_id: me, user_id: uid };
      if (act === 'timeout') body.duration = Math.max(1, Math.min(10080, Math.round(Number(b.duration) || 10)));
      if (b.reason) body.reason = String(b.reason).slice(0, 100);
      r = await kickCall('POST', '/moderation/bans', t.access_token, body);
    } else return send(res, 400, { ok: false, error: 'acción rara' });
  }
  await logPush('modlog', { at: Date.now(), act, user: b.username || uid, ok: r.ok, status: r.status, duration: b.duration || null }, 100);
  if (!r.ok) return send(res, 200, { ok: false, error: kickErr(r.status, r.j, need) });
  return send(res, 200, { ok: true });
}
/* ---- la llave actual del chat en vivo de Kick (si al celular no le contesta) ---- */
async function realtimeKey(req, res) {
  cors(res);
  const q = req.query || {};
  // ?pub=1: la llave pública del chat de Kick (la misma que usa kick.com) para la página
  // de chat compartido de un amigo, que no tiene tu clave. Solo lee la guardada (1 h).
  const pub = q.pub === '1';
  if (!pub && !(await checkKey(q.key))) return send(res, 403, { ok: false, error: 'clave' });
  const cached = await getJSON('rtkey');
  if (cached && Date.now() - cached.at < 3600e3 && (pub || q.fresh !== '1')) return send(res, 200, { ok: true, cached: true, app_key: cached.app_key, cluster: cached.cluster, at: cached.at });
  const chId = Number(q.channel) || 6692133;
  const body = { client: { id: 'kf' + crypto.randomBytes(6).toString('hex'), type: 'web' }, capabilities: { accepted_providers: [{ provider: 'pusher' }] } };
  try {
    const r = await kfetch('https://web.kick.com/api/v1/realtime/channels/' + chId + '/chat/connection', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    const cs = (j.data && j.data.connections) || [];
    const p = cs.find(c => c && c.provider === 'pusher' && c.credentials && /^[a-z0-9]+$/i.test(c.credentials.app_key || ''));
    if (!p) return send(res, 200, { ok: false, error: 'Kick no dio llave (' + r.status + ')', providers: cs.map(c => c && c.provider) });
    const out = { app_key: p.credentials.app_key, cluster: p.credentials.cluster || 'us2', at: Date.now() };
    await setJSON('rtkey', out);
    return send(res, 200, Object.assign({ ok: true }, out));
  } catch (e) { return send(res, 200, { ok: false, error: e.message }); }
}
let WANTSET = 0;
async function chatRead(req, res) {
  const q = req.query || {};
  if (!(await checkKey(q.key))) return send(res, 403, { ok: false, error: 'clave' });
  try { await chatFlush(); } catch (e) {}          // lo que este servidor tenga pendiente
  // avisa que hay un celular usando el respaldo en vivo: el chat se guarda al momento los próximos 3 minutos
  // (rec=1 es solo para recuperar lo perdido o cargar los últimos mensajes: no hace falta)
  if (q.rec !== '1' && Date.now() - WANTSET > 30000) {
    WANTSET = Date.now(); const until = Date.now() + 180000;
    await redis('SET', 'chatWant', String(until)); WANT = { until, at: Date.now() };
  }
  const since = Number(q.since) || 0;
  let list;
  if (since && q.rec === '1') list = ((await redis('ZREVRANGEBYSCORE', 'chat', '+inf', '(' + since, 'LIMIT', 0, 300)) || []).reverse();   // lo más reciente de lo perdido
  else if (since) list = await redis('ZRANGEBYSCORE', 'chat', '(' + since, '+inf', 'LIMIT', 0, 150);
  else list = ((await redis('ZRANGE', 'chat', -100, -1)) || []);   // los últimos 100
  const msgs = (list || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  const cursor = msgs.reduce((mx, m) => Math.max(mx, m.rt || 0), since);
  return send(res, 200, { ok: true, cursor, msgs });
}
async function chatSend(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET') return chatRead(req, res);
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'usa POST' });
  const b = await readJSONBody(req);
  if (!(await checkKey(b.key))) return send(res, 403, { ok: false, error: 'clave' });
  const t = await validToken();
  if (!t) return send(res, 409, { ok: false, error: 'Falta conectar tu cuenta' });
  const content = String(b.content || '').trim().slice(0, 500);
  if (!content) return send(res, 400, { ok: false, error: 'mensaje vacío' });
  // v67: avisos automáticos (p. ej. «TTS activado»): si tus dos celulares lo mandan, sale una sola vez
  if (b.once) {
    const ok1 = await redis('SET', 'conce:' + crypto.createHash('sha1').update(String(b.once)).digest('hex').slice(0, 20), '1', 'NX', 'EX', Math.max(10, Math.min(600, Number(b.ttl) || 60)));
    if (!ok1) return send(res, 200, { ok: true, dup: true });
  }
  const body = { type: 'user', broadcaster_user_id: Number(t.user_id), content };
  if (b.reply_to) body.reply_to_message_id = String(b.reply_to);
  const r = await kickCall('POST', '/chat', t.access_token, body);
  if (!r.ok) return send(res, 200, { ok: false, error: kickErr(r.status, r.j, 'Escribir en el feed del chat') });
  const d = r.j.data || r.j;
  return send(res, 200, { ok: !!(d.is_sent !== false), message_id: d.message_id || null });
}

/* ---------------- comandos para mods ----------------
   Tú eliges el comando (!brb), qué pasa en OBS (lo mismo que tus atajos) y
   qué mods lo pueden usar. Funciona aunque el feed esté cerrado: lo recibe
   tu servidor con el chat. Solo mods (o tú) que estén en tu lista. */
const CMD_STEPS = { scene: 1, item: 1, filter: 1, mute: 1, refresh: 1, stream: 1, record: 1, replay: 1, text: 1, wait: 1, chat: 1, goal: 1 };
const CMD_RX = /^![a-z0-9_ñáéíóúü]{1,24}$/;
let MCC = { at: 0, cfg: null };
async function modCfg(fresh) {
  if (!fresh && MCC.cfg && Date.now() - MCC.at < 15000) return MCC.cfg;
  const c = (await getJSON('modcmds')) || { on: false, users: [], cmds: [], del: false };
  MCC = { at: Date.now(), cfg: c };
  return c;
}
function cmdStep(s) {
  const o = { t: String(s.t) };
  ['scene', 'source', 'filter', 'input', 'mode'].forEach(k => { if (s[k] != null && s[k] !== '') o[k] = String(s[k]).slice(0, 200); });
  if (s.text != null) o.text = String(s.text).slice(0, 500);
  if (s.id != null && isFinite(Number(s.id))) o.id = Number(s.id);
  if (s.s != null && isFinite(Number(s.s))) o.s = Math.max(0.5, Math.min(10, Number(s.s)));
  if (s.n != null && isFinite(Number(s.n))) o.n = Math.max(-50, Math.min(50, Math.round(Number(s.n))));   // 🎯 meta: +1, −1… (0 = quitar el ajuste)
  return o;
}
function cleanModCfg(c) {
  c = c || {};
  const users = (Array.isArray(c.users) ? c.users : []).map(u => String(u || '').trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.\-]/g, ''))
    .filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 40);
  const seen = {};
  const cmds = (Array.isArray(c.cmds) ? c.cmds : []).map(x => {
    const cc = String((x && x.c) || '').trim().toLowerCase();
    if (!CMD_RX.test(cc) || seen[cc]) return null;
    const steps = (Array.isArray(x.steps) ? x.steps : []).filter(s => s && typeof s === 'object' && CMD_STEPS[s.t]).slice(0, 10).map(cmdStep);
    if (!steps.length) return null;
    seen[cc] = 1;
    return { c: cc, steps, name: String(x.name || '').slice(0, 40) };
  }).filter(Boolean).slice(0, 40);
  return { on: c.on !== false, users, cmds, del: !!c.del, bi: { mom: biMom(c) }, at: Date.now() };
}
// v67: comandos que ya trae la app. !momento (mods y tú): tú le cambias el nombre
const MOM_DEF = '!momento';
function biMom(cfg) {
  const b = (cfg && cfg.bi && cfg.bi.mom) || {}, c = String(b.c || '').trim().toLowerCase();
  return { c: CMD_RX.test(c) ? c : MOM_DEF, on: b.on !== false, reply: b.reply !== false };
}
const isModOrMe = b => (b || []).some(x => /^(moderator|broadcaster)$/i.test(String((x && (x.type || x.text)) || '')));
const isMe = b => (b || []).some(x => /^broadcaster$/i.test(String((x && (x.type || x.text)) || '')));
async function modCmd(m) {
  const word = String(m.t).trim().split(/\s+/)[0].toLowerCase();
  if (!CMD_RX.test(word) || !isModOrMe(m.badges)) return;       // de los demás ni se pregunta a la base
  const cfg = await modCfg();
  const mom = biMom(cfg);
  if (mom.on && word === mom.c) return momentCmd(m, mom);        // 📍 cualquier mod (o tú), aunque los otros comandos estén apagados
  if (!cfg.on) return;
  const cmd = (cfg.cmds || []).find(c => c.c === word);
  if (!cmd) return;
  const u = String(m.u).toLowerCase();
  if (!isMe(m.badges) && (cfg.users || []).indexOf(u) < 0) return;  // ese mod no está en tu lista
  // una sola vez por mensaje (Kick puede repetir el aviso) y no más de una vez cada 3 s
  if (!(await redis('SET', 'cmd:' + m.id, '1', 'NX', 'EX', 3600))) return;
  if (!(await redis('SET', 'cmdcd:' + word, '1', 'NX', 'EX', 3))) return;
  const obsSteps = cmd.steps.filter(s => s.t !== 'chat' && s.t !== 'goal'), chats = cmd.steps.filter(s => s.t === 'chat' && s.text);
  for (const g of cmd.steps.filter(s => s.t === 'goal')) { try { await goalAdjust(g.n || 0, !g.n); } catch (e) {} }
  let ok = true, err = '', scene = '';
  if (obsSteps.length) {
    const oc = await obsCfg();
    if (!oc) { ok = false; err = 'OBS sin conectar'; }
    else {
      let pass = '';
      try { pass = obsOpen(oc.p); } catch (e) { ok = false; err = 'Vuelve a escribir la contraseña de OBS'; }
      if (ok) {
        try { const out = await obsSession(oc.url, pass, b => obsWork(b, oc, 'run', obsSteps, [], false), 9000);
              ok = out.ok !== false; err = out.error || ''; scene = out.current || ''; }
        catch (e) { ok = false; err = e.message; }
      }
    }
  }
  const tk = (chats.length || cfg.del) ? await validToken() : null;
  if (tk) {
    for (const s of chats) {
      const r = await kickCall('POST', '/chat', tk.access_token, { type: 'user', broadcaster_user_id: Number(tk.user_id), content: String(s.text).slice(0, 500) });
      if (!r.ok && ok) { ok = false; err = kickErr(r.status, r.j, 'Escribir en el feed del chat'); }
    }
    if (cfg.del) await kickCall('DELETE', '/chat/' + encodeURIComponent(m.id), tk.access_token);
  }
  const rt = Date.now();
  const ev = { id: 'cmd:' + m.id, type: 'modcmd', ts: rt, rt, d: { kind: 'cmd', user: m.u, cmd: word, ok, error: err, scene } };
  await redis('ZADD', 'ev', rt, JSON.stringify(ev));
  await logPush('cmdlog', { at: rt, u: m.u, c: word, ok, e: err }, 20);
}
/* ---- 📍 momentos: «!momento nota» guarda el minuto del stream para encontrarlo después ----
   Se guardan los últimos 500 (cada uno es un renglón chiquito). Solo se toca la base cuando
   alguien marca uno o cuando abres la lista. */
function hms(ms) { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60;
  return (h ? h + ':' + String(mi).padStart(2, '0') : String(mi)) + ':' + String(se).padStart(2, '0'); }
async function momentAdd(u, note, src, hint) {
  const at = Date.now();
  const lv = (await getJSON('live')) || {};
  let vs = lv.is_live ? (Date.parse(lv.started_at) || 0) : 0;      // cuándo empezó ESTE stream (lo mismo que el VOD)
  const h = Number(hint) || 0;
  if (!vs && h > at - 36 * 3600e3 && h <= at) vs = h;                // lo que ve la app, por si Kick no avisó
  const it = { id: at.toString(36) + crypto.randomBytes(3).toString('hex'), at, vs, t: vs ? Math.max(0, at - vs) : null,
    u: String(u || '').slice(0, 40), note: String(note || '').replace(/\s+/g, ' ').trim().slice(0, 140), src };
  await redis('ZADD', 'moms', at, JSON.stringify(it));
  await redis('ZREMRANGEBYRANK', 'moms', 0, -501);
  const ev = { id: 'mom:' + it.id, type: 'moment', ts: at, rt: at, d: { kind: 'moment', user: it.u, mid: it.id, t: it.t, note: it.note, src } };
  await redis('ZADD', 'ev', at, JSON.stringify(ev));
  return it;
}
async function momentCmd(m, mom) {
  if (!(await redis('SET', 'cmd:' + m.id, '1', 'NX', 'EX', 3600))) return;              // Kick puede repetir el aviso
  if (!(await redis('SET', 'momcd:' + String(m.u).toLowerCase(), '1', 'NX', 'EX', 5))) return;   // uno cada 5 s por persona
  const it = await momentAdd(m.u, String(m.t).trim().replace(/^\S+\s*/, ''), 'chat');
  let ok = true, err = '';
  if (mom.reply) {
    const tk = await validToken();
    if (tk) {
      const txt = '📍 Momento guardado' + (it.t != null ? ' en el ' + hms(it.t) : '') + (it.note ? ': ' + it.note : '');
      const r = await kickCall('POST', '/chat', tk.access_token, { type: 'user', broadcaster_user_id: Number(tk.user_id), content: txt.slice(0, 500) });
      if (!r.ok) { ok = false; err = kickErr(r.status, r.j, 'Escribir en el feed del chat'); }
    }
  }
  await logPush('cmdlog', { at: it.at, u: m.u, c: mom.c, ok, e: err }, 20);
}
async function momentsApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const b = req.method === 'POST' ? await readJSONBody(req) : {};
  if (!(await checkKey((req.query && req.query.key) || b.key))) return send(res, 403, { ok: false, error: 'clave' });
  if (req.method === 'POST') {
    if (b.action === 'add') return send(res, 200, { ok: true, item: await momentAdd(String(b.by || CHANNEL), b.note, 'app', b.from) });
    if (b.action === 'del' || b.action === 'note') {
      const all = (await redis('ZRANGE', 'moms', 0, -1)) || [];
      const raw = all.find(x => { try { return JSON.parse(x).id === String(b.id || ''); } catch (e) { return false; } });
      if (!raw) return send(res, 200, { ok: false, error: 'Ese momento ya no está' });
      await redis('ZREM', 'moms', raw);
      let it = null;
      if (b.action === 'note') { it = JSON.parse(raw); it.note = String(b.note || '').replace(/\s+/g, ' ').trim().slice(0, 140); await redis('ZADD', 'moms', it.at, JSON.stringify(it)); }
      return send(res, 200, { ok: true, item: it });
    }
    return send(res, 400, { ok: false, error: 'acción desconocida' });
  }
  const list = ((await redis('ZREVRANGE', 'moms', 0, 299)) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  return send(res, 200, { ok: true, list });
}

// ver y cambiar los comandos (solo con la clave de tus celulares)
async function modCmdApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const b = req.method === 'POST' ? await readJSONBody(req) : {};
  const key = (req.query && req.query.key) || b.key;
  if (!(await checkKey(key))) return send(res, 403, { ok: false, error: 'clave' });
  let cfg = await modCfg(true);
  if (req.method === 'POST' && b.action === 'save') {
    cfg = cleanModCfg(b.cfg);
    await setJSON('modcmds', cfg);
    MCC = { at: Date.now(), cfg };
  }
  const log = ((await redis('LRANGE', 'cmdlog', 0, 19)) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  return send(res, 200, { ok: true, cfg, log });
}

/* ---------------- reglas automáticas: «cuando pase esto, haz esto» ----------------
   Tú eliges el evento (sub, Kicks, follow, que empiece el stream, que cambies
   de categoría…) y qué pasa: los mismos pasos de tus atajos. Las que llegan a
   tu servidor por Kick funcionan con la app cerrada; las de recompensas y
   raids las avisa la app abierta (Kick no se las manda al servidor). Solo se
   pregunta a la base cuando llega un evento (no con cada mensaje del chat). */
const RULE_EV = { sub: 1, resub: 1, gift: 1, kicks: 1, follow: 1, live: 1, off: 1, cat: 1, catoff: 1, reward: 1, host: 1 };
const RULE_APP = { reward: 1, host: 1 };
let RLC = { at: 0, cfg: null };
async function ruleCfg(fresh) {
  if (!fresh && RLC.cfg && Date.now() - RLC.at < 15000) return RLC.cfg;
  const c = (await getJSON('rules')) || { on: true, feed: true, list: [] };
  RLC = { at: Date.now(), cfg: c };
  return c;
}
function cleanRule(x, i) {
  if (!x || typeof x !== 'object' || !RULE_EV[x.ev]) return null;
  const steps = (Array.isArray(x.steps) ? x.steps : []).filter(s => s && typeof s === 'object' && CMD_STEPS[s.t]).slice(0, 10).map(s => {
    const o = cmdStep(s);
    if (o.t === 'wait') o.s = Math.max(0.5, Math.min(30, Number(s.s) || 1));      // en las reglas se puede esperar hasta 30 s
    return o;
  });
  if (!steps.length) return null;
  let tw = 0;
  steps.forEach(s => { if (s.t === 'wait') { if (tw + s.s > 60) s.s = Math.max(0.5, 60 - tw); tw += s.s; } });  // 1 minuto en total, máximo
  const id = /^[a-z0-9]{3,20}$/.test(String(x.id || '')) ? String(x.id) : 'r' + Date.now().toString(36) + (i || 0);
  return { id, on: x.on !== false, ev: x.ev, min: Math.max(0, Math.min(1e6, Math.round(Number(x.min) || 0))),
           name: String(x.name || '').trim().slice(0, 80), cd: Math.max(0, Math.min(3600, Math.round(Number(x.cd) || 0))), steps };
}
function cleanRuleCfg(c) {
  c = c || {};
  const seen = {};
  const list = (Array.isArray(c.list) ? c.list : []).map(cleanRule).filter(r => r && !seen[r.id] && (seen[r.id] = 1)).slice(0, 30);
  return { on: c.on !== false, feed: c.feed !== false, list, at: Date.now() };
}
const rlow = s => String(s == null ? '' : s).trim().toLowerCase();
// lo que se puede poner en los mensajes: {nombre} {cantidad} {meses} {recompensa} {mensaje} {categoria} {titulo}
function ruleVars(kind, d) {
  d = d || {};
  const v = { nombre: d.user || '', cantidad: '', meses: '', recompensa: '', mensaje: '', categoria: '', titulo: '' };
  if (kind === 'gift') { v.nombre = d.user || 'Anónimo'; v.cantidad = String(d.count || 1); }
  else if (kind === 'kicks') { v.cantidad = String(d.amount || 0); v.mensaje = d.message || ''; }
  else if (kind === 'sub' || kind === 'resub') v.meses = String(d.months || 1);
  else if (kind === 'reward') { v.recompensa = d.reward || ''; v.mensaje = d.input || ''; }
  else if (kind === 'host') v.cantidad = String(d.viewers || 0);
  else if (kind === 'cat' || kind === 'catoff') { v.categoria = d.cat || ''; v.titulo = d.title || ''; }
  else if (kind === 'live') v.titulo = d.title || '';
  return v;
}
function ruleHit(r, kind, d) {
  if (!r || r.on === false || r.ev !== kind) return false;
  d = d || {};
  if (kind === 'gift') return (Number(d.count) || 1) >= (r.min || 1);
  if (kind === 'kicks') return (Number(d.amount) || 0) >= (r.min || 1);
  if (kind === 'host') return (Number(d.viewers) || 0) >= (r.min || 0);
  if (kind === 'reward') return !r.name || rlow(r.name) === rlow(d.reward);
  if (kind === 'cat') return !r.name || rlow(r.name) === rlow(d.cat);
  if (kind === 'catoff') return !!r.name && rlow(r.name) === rlow(d.oldCat) && rlow(d.cat) !== rlow(r.name);
  return true;
}
function fillVars(t, v, chat) {
  return String(t == null ? '' : t).replace(/\{(nombre|cantidad|meses|recompensa|mensaje|categor[ií]a|t[ií]tulo)\}/gi, (m, k) => {
    k = k.toLowerCase().replace('í', 'i');
    if (chat && k === 'mensaje') return '';      // lo que escribe la gente nunca se repite con tu cuenta en el chat
    return String(v[k] == null ? '' : v[k]).slice(0, 120);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Hace los pasos en orden: los de OBS por una sola conexión, los mensajes en
// su lugar y las esperas aquí mismo. Si OBS falla, los mensajes igual se mandan.
// test: no manda nada al chat (solo dice qué mandaría).
async function ruleExec(steps, v, test) {
  const res = { ok: true, error: '', scene: '', chats: [] };
  const fail = e => { if (res.ok) { res.ok = false; res.error = String(e || 'No se pudo'); } };
  const S = steps.map(s => {
    const o = Object.assign({}, s);
    if (o.t === 'text') o.text = fillVars(o.text, v, false).slice(0, 500);
    if (o.t === 'chat') o.text = fillVars(o.text, v, true).replace(/\s{2,}/g, ' ').trim().slice(0, 500);
    return o;
  });
  const needObs = S.some(s => s.t !== 'chat' && s.t !== 'wait' && s.t !== 'goal');
  const needChat = !test && S.some(s => s.t === 'chat' && s.text);
  const tk = needChat ? await validToken() : null;
  if (needChat && !tk) fail('Falta conectar tu cuenta de Kick');
  let k = 0, gen = 0, oc = null;
  const sendChat = async s => {
    if (!s.text) return;
    if (test) { res.chats.push(s.text); return; }
    if (!tk) return;
    const r = await kickCall('POST', '/chat', tk.access_token, { type: 'user', broadcaster_user_id: Number(tk.user_id), content: s.text });
    if (!r.ok) fail(kickErr(r.status, r.j, 'Escribir en el feed del chat'));
  };
  const run = async batch => {
    const my = ++gen;
    let buf = [];
    const flush = async () => {
      if (!buf.length) return;
      const g = buf; buf = [];
      const out = await obsWork(batch, oc, 'run', g, [], false);
      if (out.ok === false) fail(out.error || 'OBS no pudo');
      if (out.current) res.scene = out.current;
    };
    while (k < S.length && my === gen) {
      const s = S[k++];                            // se cuenta antes: si OBS se cae a medias, nada se manda dos veces
      if (s.t === 'chat') { await flush(); if (my === gen) await sendChat(s); }
      else if (s.t === 'goal') { await flush(); if (my === gen && !test) { try { await goalAdjust(s.n || 0, !s.n); } catch (e) {} } }
      else if (s.t === 'wait') { await flush(); if (batch || (!needObs && !test)) await sleep(s.s * 1000); }
      else if (batch) buf.push(s);
    }
    if (my === gen) await flush();
  };
  if (needObs) {
    oc = await obsCfg();
    let pass = null;
    if (!oc) fail('OBS sin conectar');
    else { try { pass = obsOpen(oc.p); } catch (e) { fail('Vuelve a escribir la contraseña de OBS'); } }
    if (oc && pass != null) {
      const waits = S.reduce((a, s) => a + (s.t === 'wait' ? s.s : 0), 0);
      try { await obsSession(oc.url, pass, b => run(b), Math.round(waits * 1000) + 12000); }
      catch (e) { fail(e.message); }
    }
  }
  if (k < S.length) await run(null);           // lo que faltó (o todo, si no hubo OBS): solo los mensajes
  return res;
}
// Llegó un evento: se hacen las reglas que le tocan (cada una con su espera entre una y otra)
async function rulesOn(kind, d) {
  let cfg;
  try { cfg = await ruleCfg(); } catch (e) { return; }
  if (!cfg || cfg.on === false) return;
  const hits = (cfg.list || []).filter(r => ruleHit(r, kind, d));
  if (!hits.length) return;
  const v = ruleVars(kind, d);
  await Promise.all(hits.map(async r => {
    if (r.cd && !(await redis('SET', 'rcd:' + r.id, '1', 'NX', 'EX', r.cd))) return;   // todavía está en su espera
    let out;
    try { out = await ruleExec(r.steps, v, false); } catch (e) { out = { ok: false, error: e.message }; }
    const rt = Date.now();
    if (cfg.feed !== false || !out.ok) {
      const ev = { id: 'rule:' + r.id + ':' + rt, type: 'rule', ts: rt, rt,
        d: { kind: 'rule', ev: kind, rid: r.id, user: v.nombre, n: v.cantidad, rw: v.recompensa, cat: v.categoria, ok: out.ok, error: out.error || '', scene: out.scene || '' } };
      await redis('ZADD', 'ev', rt, JSON.stringify(ev));
    }
    await logPush('rulelog', { at: rt, ev: kind, rid: r.id, u: v.nombre, ok: out.ok, e: out.error || '' }, 20);
  }));
}
// qué reglas despierta cada aviso de Kick
function ruleTriggers(d, newSess) {
  switch ((d || {}).kind) {
    case 'sub': case 'resub': case 'gift': case 'kicks': case 'follow': return [[d.kind, d]];
    case 'live': return d.is_live ? (newSess ? [['live', d]] : []) : [['off', d]];
    case 'meta':
      if ((d.changed || []).indexOf('category') >= 0 && d.oldCat != null) {
        const x = { cat: (d.cat || {}).name || '', oldCat: d.oldCat || '', title: d.title || '' };
        return [['cat', x], ['catoff', x]];
      }
  }
  return [];
}
// En Vercel, contesta a Kick al momento y la regla sigue trabajando (si tiene esperas).
function later(p) {
  try {
    const c = globalThis[Symbol.for('@vercel/request-context')];
    const ctx = c && typeof c.get === 'function' ? c.get() : null;
    if (ctx && typeof ctx.waitUntil === 'function') { ctx.waitUntil(p); return true; }
  } catch (e) {}
  return false;
}
const RULE_SAMPLE = { nombre: 'Prueba', cantidad: '100', meses: '3', recompensa: 'CLIPS', mensaje: 'mensaje de prueba', categoria: 'Slots & Casino', titulo: 'Título de prueba' };
async function rulesApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const b = req.method === 'POST' ? await readJSONBody(req) : {};
  const key = (req.query && req.query.key) || b.key;
  if (!(await checkKey(key))) return send(res, 403, { ok: false, error: 'clave' });
  const act = req.method === 'POST' ? String(b.action || '') : '';
  if (act === 'fire') {                             // una recompensa o un raid que vio la app
    const kind = String(b.ev || '');
    if (!RULE_APP[kind]) return send(res, 400, { ok: false, error: 'evento raro' });
    const d = b.d || {};
    const dd = kind === 'reward' ? { user: str(d.user).slice(0, 40), reward: str(d.reward).slice(0, 80), input: str(d.input) }
                                 : { user: str(d.user).slice(0, 40), viewers: Math.max(0, Math.round(Number(d.viewers) || 0)) };
    // si tus dos celulares lo vieron, solo cuenta una vez
    const fp = crypto.createHash('sha1').update(kind + '|' + JSON.stringify(dd)).digest('hex').slice(0, 16);
    if (!(await redis('SET', 'rf:' + fp, '1', 'NX', 'EX', 20))) return send(res, 200, { ok: true, dup: true });
    const p = rulesOn(kind, dd).catch(() => {});
    if (!later(p)) await p;
    return send(res, 200, { ok: true });
  }
  if (act === 'test') {                             // ▶ Probar: hace lo de OBS y dice qué mensajes mandaría
    const r = cleanRule(Object.assign({}, b.rule || {}, { on: true }), 0);
    if (!r) return send(res, 200, { ok: false, error: 'La regla no tiene pasos' });
    const v = Object.assign({}, RULE_SAMPLE);
    if (r.min && /^(gift|kicks|host)$/.test(r.ev)) v.cantidad = String(r.min);
    if (r.name && r.ev === 'reward') v.recompensa = r.name;
    if (r.name && (r.ev === 'cat' || r.ev === 'catoff')) v.categoria = r.ev === 'cat' ? r.name : 'IRL';
    let out;
    try { out = await ruleExec(r.steps, v, true); } catch (e) { out = { ok: false, error: e.message, chats: [] }; }
    return send(res, 200, out);
  }
  let cfg = await ruleCfg(true);
  if (act === 'save') { cfg = cleanRuleCfg(b.cfg); await setJSON('rules', cfg); await redis('SET', 'rulesAt', String(cfg.at)); RLC = { at: Date.now(), cfg }; }
  else if (act) return send(res, 400, { ok: false, error: 'acción rara' });
  const log = ((await redis('LRANGE', 'rulelog', 0, 19)) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  return send(res, 200, { ok: true, cfg, log });
}

/* ---- antispam: ver y cambiar la lista (solo con la clave de tus celulares) ---- */
async function spamApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const b = req.method === 'POST' ? await readJSONBody(req) : {};
  const key = (req.query && req.query.key) || b.key;
  if (!(await checkKey(key))) return send(res, 403, { ok: false, error: 'clave' });
  const cfg = await spamCfg(true);
  let done = null;
  if (req.method === 'POST') {
    const act = String(b.action || '');
    if (act === 'on') cfg.on = !!b.on;
    else if (act === 'to') cfg.to = SPAM_TO.indexOf(Number(b.to)) >= 0 ? Number(b.to) : 1;
    else if (act === 'add' || act === 'mark') {
      const txt = cleanEntry(b.text);
      if (spamNorm(txt).length < 5) return send(res, 200, { ok: false, error: 'Muy corto: pon al menos 5 letras' });
      if (!cfg.list.some(e => spamNorm(e) === spamNorm(txt))) cfg.list.unshift(txt);
      cfg.list = cfg.list.slice(0, 200);
      if (act === 'mark' && b.message_id)
        done = await spamDelete({ id: String(b.message_id), u: String(b.username || ''), uid: Number(b.user_id) || 0, t: String(b.text || '') }, txt, true, cfg);
    } else if (act === 'remove') cfg.list = cfg.list.filter(e => e !== String(b.text || ''));
    else return send(res, 400, { ok: false, error: 'acción rara' });
    await setJSON('spam', cfg);
    setSpamCache(cfg);
  }
  const log = ((await redis('LRANGE', 'spamlog', 0, 19)) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  const out = { ok: true, on: cfg.on !== false, to: spamTo(cfg), list: cfg.list, log };
  if (done) { out.deleted = done.ok; if (!done.ok) out.error = done.error; }
  return send(res, 200, out);
}

let SUBS_OK = false;
async function ensureSubs() {
  if (SUBS_OK) return;
  if ((await redis('GET', 'subsVer')) === SUBS_VER) { SUBS_OK = true; return; }
  const t = await validToken(); if (!t) return;
  await redis('SET', 'subsVer', SUBS_VER);          // primero, para no repetirlo si tarda
  try { const r = await subscribeAll(t); await logPush('raw', { at: Date.now(), type: 'resubscribe', body: JSON.stringify(r).slice(0, 800) }, 40); }
  catch (e) { await redis('DEL', 'subsVer'); }
}
// La sesión del stream: desde que empezó (lo manda Kick) o, si el servidor todavía no lo sabe, desde ?from= del feed.
function sessFrom(se, hint) {
  if (se && se.start && (se.live || (se.lastEnd && Date.now() - se.lastEnd < 30 * 60000))) return se.start;
  return Number(hint) || 0;
}
// Totales exactos de la sesión. v65: solo cuenta lo que pasó con el stream en vivo
// (una renovación de madrugada ya no se suma al stream de la tarde) + lo que
// sumaste o restaste a mano a la meta. Se calculan una sola vez por cambio:
// si no llegó nada nuevo, se reusan (así revisar seguido casi no gasta).
let TOTC = { k: '', v: null, at: 0 };
async function sessTotals(from, lastHook, adjS, fresh) {
  let adj = null; try { adj = adjS ? JSON.parse(adjS) : null; } catch (e) { adj = null; }
  const an = adj && adj.start === from ? Number(adj.n) || 0 : 0;      // v68: solo el ajuste de ESTE stream (cada stream empieza en 0)
  const sh = adj && adj.start === from ? Number(adj.s) || 0 : 0;      // renovaciones de la madrugada que la persona compartió ya en vivo
  const k = from + '|' + (lastHook || 0) + '|' + an + '|' + sh;
  if (!fresh && TOTC.k === k && TOTC.v && Date.now() - TOTC.at < 120000) return TOTC.v;   // llegó algo nuevo: se recalcula sí o sí
  const sess = await redis('ZRANGEBYSCORE', 'ev', from - 3600000, '+inf');
  const totals = { from, subs: 0, kicks: 0, newSubs: 0, resubs: 0, gifted: 0, offFrom: 0, offSubs: 0, offKicks: 0, adj: an, shared: sh };
  (sess || []).forEach(s => {
    let e; try { e = fixEv(JSON.parse(s)); } catch (x) { return; }
    const t = e.ts || 0, d = e.d || {};
    if (t < from - 60000) return;
    if (d.kind === 'sub') { totals.subs++; totals.newSubs++; }
    else if (d.kind === 'resub') { totals.subs++; totals.resubs++; }
    else if (d.kind === 'gift') { totals.subs += d.count || 1; totals.gifted += d.count || 1; }
    else if (d.kind === 'kicks') totals.kicks += d.amount || 0;
  });
  totals.resubs += sh;
  totals.real = totals.subs + sh;
  totals.subs = Math.max(0, totals.real + an);
  TOTC = { k, v: totals, at: Date.now() };
  return totals;
}
async function events(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  try { await ensureSubs(); } catch (e) {}
  const q = req.query || {};
  const since = Number(q.since) || 0;                 // cursor: lo que el feed todavía no tiene
  // v69: 👁 un punto por minuto para la gráfica de viewers (lo mandan tus celulares con esta misma revisión)
  if (q.vw != null && q.vf) { try { await vwSave(q); } catch (e) {} }
  const limit = Math.min(500, Number(q.limit) || 300);
  await repairTimes();
  // since en el futuro (el letrero de la meta solo quiere los totales): ni se busca
  const list = since > Date.now() + 60000 ? [] : await redis('ZRANGEBYSCORE', 'ev', '(' + since, '+inf', 'LIMIT', 0, limit);
  const evs = (list || []).map(s => { try { return fixEv(JSON.parse(s)); } catch (e) { return null; } }).filter(Boolean);
  const cursor = evs.reduce((m, e) => Math.max(m, e.rt || e.ts || 0), since);
  // varios datos en una sola consulta: en vivo, sesión, último aviso, ajustes compartidos,
  // reglas y lo que sumaste o restaste a mano a la meta
  const [liveS, seS, lhS, paS, raS, adjS] = (await redis('MGET', 'live', 'session', 'lastHook', 'prefsAt', 'rulesAt', 'subAdj')) || [];
  const pj = v => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const live = pj(liveS), se = pj(seS);
  const from = sessFrom(se, q.from);
  let totals = null;
  // Los totales: cuando llegó algo nuevo o el feed los pide (tot=1); si nada cambió, salen de lo ya calculado
  if (from && (evs.length || q.tot === '1' || !since)) totals = await sessTotals(from, Number(lhS) || 0, adjS, evs.length > 0);
  else if (!from) { const a = pj(adjS); if (a && (a.start === 'off' || a.start === 0)) totals = offTotals(a); }   // v68: sin stream, lo que sumaste para probar
  const lastHook = Number(lhS) || 0;
  return send(res, 200, { ok: true, now: Date.now(), live, session: se, totals, lastHook, cursor, events: evs, pat: Number(paS) || 0, rat: Number(raS) || 0 });
}

/* ---- 👁 gráfica de viewers ----
   Kick no guarda el historial de viewers: tus celulares, mientras estás en vivo, mandan
   el número una vez por minuto junto con la revisión que ya hacen (no es una consulta
   aparte). Si los dos lo mandan, se queda el primero. Cada stream se borra solo a los 3 días. */
async function vwSave(q) {
  const now = Date.now(), vf = Math.floor(Number(q.vf)) || 0, vm = Math.floor(Number(q.vm)), vw = Math.floor(Number(q.vw));
  if (!(vf > now - 2 * 864e5 && vf <= now + 60000) || !(vm >= 0 && vm <= 2880) || !(vw >= 0 && vw < 1e7)) return;
  if (!(await checkKey(q.key))) return;
  await redis('HSETNX', 'vw:' + vf, String(vm), String(vw));
  if (vm % 10 === 0) await redis('EXPIRE', 'vw:' + vf, 3 * 86400);
}
async function viewersApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const q = req.query || {};
  if (!(await checkKey(q.key))) return send(res, 403, { ok: false, error: 'clave' });
  const vf = Math.floor(Number(q.from)) || 0;
  if (!vf) return send(res, 200, { ok: true, from: 0, pts: {} });
  const a = (await redis('HGETALL', 'vw:' + vf)) || [];
  const pts = {};
  if (Array.isArray(a)) for (let i = 0; i + 1 < a.length; i += 2) pts[a[i]] = Number(a[i + 1]) || 0;
  else Object.keys(a).forEach(k => { pts[k] = Number(a[k]) || 0; });
  return send(res, 200, { ok: true, from: vf, pts });
}

/* ---- 🎯 la meta de subs: sumar o restar a mano (por si algo falló) ----
   Solo cuenta para el stream de ahora: el siguiente empieza sin ajuste. */
// v68: con el stream apagado la meta también se mueve al momento (para probar el letrero):
// ese ajuste es «fuera de vivo» y al empezar tu stream todo vuelve a 0.
function offTotals(adj) {
  const n = adj && (adj.start === 'off' || adj.start === 0) ? Number(adj.n) || 0 : 0;
  return { from: 0, off: true, subs: Math.max(0, n), real: 0, kicks: 0, newSubs: 0, resubs: 0, gifted: 0, offFrom: 0, offSubs: 0, offKicks: 0, adj: n, shared: 0 };
}
async function goalAdjust(delta, reset, hint, share) {
  const se = await getJSON('session');
  const from = sessFrom(se, hint);
  const cur = (await getJSON('subAdj')) || {};
  if (!from) {
    if (share) return { ok: false, error: 'Solo durante el stream' };
    let pn = cur.start === 'off' || cur.start === 0 ? Number(cur.n) || 0 : 0;
    pn = reset ? 0 : Math.max(-500, Math.min(500, pn + Math.round(Number(delta) || 0)));
    const adj = { start: 'off', n: pn, s: 0, at: Date.now() };
    await setJSON('subAdj', adj);
    return { ok: true, off: true, n: pn, totals: offTotals(adj) };
  }
  let n = cur.start === from ? Number(cur.n) || 0 : 0, sh = cur.start === from ? Number(cur.s) || 0 : 0;
  if (share) sh = Math.min(500, sh + 1);              // la renovación de la madrugada se cuenta ahora (no es «a mano»)
  else n = reset ? 0 : Math.max(-500, Math.min(500, n + Math.round(Number(delta) || 0)));
  const adj = { start: from, n, s: sh, at: Date.now() };
  await setJSON('subAdj', adj);
  return { ok: true, n, from, totals: await sessTotals(from, Number(await redis('GET', 'lastHook')) || 0, JSON.stringify(adj)) };
}
// Le avisa al letrero de la meta (subgoal.html, fuente de navegador en OBS) por la misma
// conexión de OBS de tus atajos: OBS se lo pasa a sus fuentes de navegador (evento «kickfeedGoal»).
async function goalPush(t) {
  const oc = await obsCfg(); if (!oc || !oc.url) return;
  let pass = ''; try { pass = obsOpen(oc.p); } catch (e) { return; }
  const d = { subs: t.subs, adj: t.adj || 0, real: t.real || 0, newSubs: t.newSubs || 0, resubs: t.resubs || 0, gifted: t.gifted || 0, off: !!t.off };
  await obsRun(oc.url, pass, [['CallVendorRequest', { vendorName: 'obs-browser', requestType: 'emit_event', requestData: { event_name: 'kickfeedGoal', event_data: d } }]], 6000);
}
async function goalApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'usa POST' });
  const b = await readJSONBody(req);
  if (!(await checkKey(b.key))) return send(res, 403, { ok: false, error: 'clave' });
  // una renovación compartida en vivo la avisan tus dos celulares: solo cuenta una vez
  if (b.once && !(await redis('SET', 'gonce:' + String(b.once).slice(0, 120), '1', 'NX', 'EX', 172800))) {
    const se = await getJSON('session'), from = sessFrom(se, b.from);
    const [lh, adjS] = (await redis('MGET', 'lastHook', 'subAdj')) || [];
    let ad = null; try { ad = adjS ? JSON.parse(adjS) : null; } catch (e) {}
    return send(res, 200, { ok: true, dup: true, totals: from ? await sessTotals(from, Number(lh) || 0, adjS) : offTotals(ad) });
  }
  const out = await goalAdjust(b.delta, !!b.reset, b.from, !!b.share);
  // v68: el letrero de OBS se entera AL MOMENTO (con o sin stream), sin preguntarle más seguido al servidor
  if (out.ok && out.totals) { const p = goalPush(out.totals).catch(() => {}); if (!later(p)) await p; }
  if (out.ok && !b.share) {
    const rt = Date.now();
    await redis('ZADD', 'ev', rt, JSON.stringify({ id: 'goal:' + rt, type: 'goal', ts: rt, rt, d: { kind: 'goal', delta: b.reset ? 0 : Math.round(Number(b.delta) || 0), reset: !!b.reset, n: out.n, subs: out.totals ? out.totals.subs : null, off: !!out.off, by: String(b.by || '').slice(0, 40) } }));
  }
  return send(res, 200, out);
}

/* ---- los mismos ajustes en tus dos celulares ----
   Se guardan juntos en 'prefs'. Cada celular ve en /api/events si cambiaron
   ('pat') y solo entonces los pide. Guardar = 1 consulta; leer = 1 consulta. */
let PREFC = { at: 0, by: '', v: null, t: 0 };
async function prefsApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const b = req.method === 'POST' ? await readJSONBody(req) : {};
  const q = req.query || {};
  if (!(await checkKey(q.key || b.key))) return send(res, 403, { ok: false, error: 'clave' });
  if (req.method === 'POST') {
    const p = b.prefs;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return send(res, 400, { ok: false, error: 'faltan los ajustes' });
    const s = JSON.stringify(p);
    if (s.length > 30000) return send(res, 400, { ok: false, error: 'demasiado grande' });
    const at = Date.now(), by = String(b.by || '').slice(0, 40);
    await redis('MSET', 'prefs', JSON.stringify({ at, by, v: p }), 'prefsAt', String(at));
    PREFC = { at, by, v: p, t: Date.now() };
    return send(res, 200, { ok: true, at, by });
  }
  if (Date.now() - PREFC.t > 15000) {
    const v = await getJSON('prefs');
    PREFC = { at: (v && v.at) || 0, by: (v && v.by) || '', v: (v && v.v) || null, t: Date.now() };
  }
  return send(res, 200, { ok: true, at: PREFC.at, by: PREFC.by, prefs: PREFC.v });
}

/* ---- control de OBS (obs-websocket 5) ----
   El celular no puede abrir ws:// desde una página https (el navegador lo
   bloquea), así que tu servidor habla con OBS por él. La contraseña de OBS se
   guarda cifrada en tu base de datos: nunca está en GitHub ni en el celular,
   y nunca se vuelve a mostrar. Cada consulta abre la conexión, pide lo
   necesario en un solo paquete y la cierra. */
function obsKey() { return crypto.createHash('sha256').update('obs:' + (CLIENT_SECRET || R_TOK || 'kick-feed')).digest(); }
function obsSeal(s) {
  if (!s) return '';
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', obsKey(), iv);
  const enc = Buffer.concat([c.update(String(s), 'utf8'), c.final()]);
  return 'g1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function obsOpen(s) {
  if (!s) return '';
  if (!String(s).startsWith('g1:')) return String(s);
  const b = Buffer.from(String(s).slice(3), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', obsKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
function obsUrl(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^wss?:\/\//i.test(s)) s = 'ws://' + s;
  try { const x = new URL(s); if (!/^wss?:$/.test(x.protocol) || !x.hostname) return ''; return x.protocol + '//' + x.host + (x.pathname && x.pathname !== '/' ? x.pathname : ''); }
  catch (e) { return ''; }
}
let OBSC = { v: null, t: 0 };
async function obsCfg() {
  if (Date.now() - OBSC.t > 5 * 60000) OBSC = { v: await getJSON('obs'), t: Date.now() };
  return OBSC.v;
}
// Abre la conexión con OBS, entra con la contraseña y deja mandar uno o
// varios paquetes de peticiones (cada paquete es un solo viaje de ida y vuelta).
function obsSession(url, pass, work, ms) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') return reject(new Error('Tu servidor necesita Node 22 o más nuevo (Vercel → Settings → Node.js Version)'));
    let ws = null, done = false, tm = null, n = 0;
    const pending = {};
    const fin = (err, val) => {
      if (done) return; done = true; clearTimeout(tm);
      try { if (ws && ws.readyState <= 1) ws.close(1000); } catch (e) {}
      if (err) reject(err); else resolve(val);
    };
    tm = setTimeout(() => fin(new Error('OBS no contestó: revisa la dirección y que OBS esté prendido')), ms || 8000);
    try { ws = new WebSocket(url); } catch (e) { return fin(new Error('La dirección de OBS no es válida')); }
    ws.onerror = () => fin(new Error('No se pudo conectar con OBS: revisa la dirección y que OBS esté prendido'));
    ws.onclose = ev => fin(new Error(ev && ev.code === 4009 ? 'La contraseña de OBS no coincide'
      : 'OBS cerró la conexión' + (ev && ev.code && ev.code !== 1000 && ev.code !== 1005 ? ' (código ' + ev.code + ')' : '')));
    const batch = reqs => new Promise(res2 => {
      if (!reqs.length) return res2([]);
      const id = 'kf' + (++n); pending[id] = res2;
      ws.send(JSON.stringify({ op: 8, d: { requestId: id, haltOnFailure: false, executionType: 0,
        requests: reqs.map((r, i) => ({ requestType: r[0], requestId: String(i), requestData: r[1] || {} })) } }));
    });
    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch (e) { return; }
      if (m.op === 0) {                                    // Hello: OBS dice si pide contraseña
        const d = { rpcVersion: 1, eventSubscriptions: 0 };
        const a = m.d && m.d.authentication;
        if (a) {
          if (!pass) return fin(new Error('OBS pide contraseña: escríbela en Conexión con OBS'));
          const secret = crypto.createHash('sha256').update(pass + a.salt).digest('base64');
          d.authentication = crypto.createHash('sha256').update(secret + a.challenge).digest('base64');
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) {                             // Identified: ya se puede pedir
        Promise.resolve().then(() => work(batch)).then(v => fin(null, v), e => fin(e));
      } else if (m.op === 9) {
        const cb = m.d && pending[m.d.requestId];
        if (cb) { delete pending[m.d.requestId]; cb((m.d && m.d.results) || []); }
      }
    };
  });
}
function obsRun(url, pass, reqs, ms) { return obsSession(url, pass, b => b(reqs), ms); }
let OBSB = null;          // para calcular el bitrate de salida entre una consulta y otra
function obsOut(cfg, results, act) {
  const by = t => results.find(x => x.requestType === t) || {};
  const sl = by('GetSceneList').responseData || {}, st = by('GetStreamStatus').responseData || {};
  const out = {
    ok: true, configured: true, url: cfg.url, hasPass: !!cfg.p,
    scenes: (sl.scenes || []).slice().sort((a, b) => (b.sceneIndex || 0) - (a.sceneIndex || 0)).map(s => s.sceneName),  // como se ven en OBS, de arriba a abajo
    current: sl.currentProgramSceneName || '',
    stream: { on: !!st.outputActive, reconnecting: !!st.outputReconnecting, dur: Number(st.outputDuration) || 0,
              cong: Number(st.outputCongestion) || 0, skip: Number(st.outputSkippedFrames) || 0, total: Number(st.outputTotalFrames) || 0 }
  };
  const now = Date.now(), bytes = Number(st.outputBytes) || 0;
  if (OBSB && st.outputActive && bytes >= OBSB.bytes && now - OBSB.at > 1500 && now - OBSB.at < 30000)
    out.stream.kbps = Math.round((bytes - OBSB.bytes) * 8 / (now - OBSB.at));
  OBSB = st.outputActive ? { bytes, at: now } : null;
  if (act === 'scene') {
    const s = by('SetCurrentProgramScene').requestStatus || {};
    if (!s.result) { out.ok = false; out.error = 'OBS no cambió la escena' + (s.comment ? ': ' + s.comment : ''); }
  }
  return out;
}
async function obsApi(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const b = req.method === 'POST' ? await readJSONBody(req) : {};
  const q = req.query || {};
  if (!(await checkKey(q.key || b.key))) return send(res, 403, { ok: false, error: 'clave' });
  const act = String(b.action || q.action || 'status');
  if (act === 'forget') { await redis('DEL', 'obs'); OBSC = { v: null, t: Date.now() }; OBSB = null; return send(res, 200, { ok: true, configured: false }); }
  if (act === 'config') {
    const url = obsUrl(b.url);
    if (!url) return send(res, 200, { ok: false, error: 'Pon la dirección así: ws://IP:puerto' });
    const old = await getJSON('obs');
    // contraseña vacía = se queda la que ya estaba
    const p = b.pass ? obsSeal(String(b.pass)) : (b.nopass ? '' : (old && old.p) || '');
    const cfg = { url, p, at: Date.now() };
    await setJSON('obs', cfg);
    OBSC = { v: cfg, t: Date.now() }; OBSB = null;
  }
  const cfg = await obsCfg();
  if (!cfg) return send(res, 200, { ok: true, configured: false });
  let pass = '';
  try { pass = obsOpen(cfg.p); } catch (e) { return send(res, 200, { ok: false, configured: true, url: cfg.url, hasPass: true, error: 'Vuelve a escribir la contraseña de OBS' }); }
  if (act === 'catalog') {
    try { return send(res, 200, Object.assign({ ok: true, configured: true, url: cfg.url, hasPass: !!cfg.p }, await obsSession(cfg.url, pass, obsCatalog, 12000))); }
    catch (e) { return send(res, 200, { ok: false, configured: true, url: cfg.url, hasPass: !!cfg.p, error: e.message }); }
  }
  if (act === 'now') {
    try {
      const r = await obsRun(cfg.url, pass, [['GetCurrentProgramScene'], ['GetStreamStatus']], 6000);
      const sc = dataOf(r[0]), st = dataOf(r[1]);
      return send(res, 200, { ok: true, configured: true, current: sc.sceneName || sc.currentProgramSceneName || '',
                              stream: { on: !!st.outputActive, reconnecting: !!st.outputReconnecting } });
    } catch (e) { return send(res, 200, { ok: false, configured: true, error: e.message }); }
  }
  let steps = [];
  if (act === 'scene') {
    const sc = String(b.scene || '').slice(0, 200);
    if (!sc) return send(res, 400, { ok: false, error: 'falta la escena' });
    steps = [{ t: 'scene', scene: sc }];
  } else if (act === 'run') {
    steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 20).filter(x => x && typeof x === 'object' && OBS_STEPS[x.t]);
    if (!steps.length) return send(res, 400, { ok: false, error: 'no hay nada que hacer' });
  } else if (act !== 'status' && act !== 'config') return send(res, 400, { ok: false, error: 'acción rara' });
  const probes = (Array.isArray(b.q) ? b.q : []).slice(0, 40).filter(x => x && typeof x === 'object' && x.k);
  try { return send(res, 200, await obsSession(cfg.url, pass, batch => obsWork(batch, cfg, act, steps, probes, !!b.shot), 10000)); }
  catch (e) { return send(res, 200, { ok: false, configured: true, url: cfg.url, hasPass: !!cfg.p, error: e.message }); }
}

/* ---- atajos: lo que se puede hacer en OBS desde el feed ----
   El feed manda "pasos" sencillos y aquí se convierten en peticiones de OBS.
   Solo existen estos; nada más se puede pedir. */
const OBS_STEPS = { scene: 1, item: 1, filter: 1, mute: 1, vol: 1, refresh: 1, stream: 1, record: 1, replay: 1, text: 1, wait: 1 };
const str = v => String(v == null ? '' : v).slice(0, 200);
const okOf = r => !!(r && r.requestStatus && r.requestStatus.result);
const dataOf = r => (r && r.responseData) || {};
async function obsWork(batch, cfg, act, steps, probes, shot) {
  // 1) ¿qué número tiene cada fuente en su escena? (por nombre: aunque la borres y la vuelvas a poner, sigue sirviendo)
  //    y cómo están ahora los filtros y volúmenes que se van a cambiar
  const pre = [], preIdx = [];
  const addPre = (key, r) => { preIdx.push(key); pre.push(r); };
  steps.forEach((st, i) => {
    if (st.t === 'item') addPre('id:' + i, ['GetSceneItemId', { sceneName: str(st.scene), sourceName: str(st.source) }]);
    if (st.t === 'filter' && (st.mode || 'toggle') === 'toggle') addPre('f:' + i, ['GetSourceFilter', { sourceName: str(st.source), filterName: str(st.filter) }]);
    if (st.t === 'vol' && st.step != null) addPre('v:' + i, ['GetInputVolume', { inputName: str(st.input) }]);
  });
  probes.forEach((p, i) => { if (p.t === 'item') addPre('pid:' + i, ['GetSceneItemId', { sceneName: str(p.scene), sourceName: str(p.source) }]); });
  const preR = {}; (await batch(pre)).forEach((r, i) => { preR[preIdx[i]] = r; });
  const itemId = (key, fallback) => { const r = preR[key]; return okOf(r) ? dataOf(r).sceneItemId : (Number(fallback) || null); };
  // 2) las fuentes que se alternan: ¿están visibles ahora?
  const en = [], enIdx = [];
  steps.forEach((st, i) => {
    if (st.t === 'item' && (st.mode || 'toggle') === 'toggle') {
      const id = itemId('id:' + i, st.id);
      if (id != null) { enIdx.push(i); en.push(['GetSceneItemEnabled', { sceneName: str(st.scene), sceneItemId: id }]); }
    }
  });
  const enR = {}; (await batch(en)).forEach((r, i) => { enR[enIdx[i]] = r; });
  // 3) hacer los pasos en orden (con sus esperas) y luego ver cómo quedó todo
  const reqs = [], kinds = [];
  const push = (kind, r) => { kinds.push(kind); reqs.push(r); };
  const flip = (mode, cur) => mode === 'on' ? true : mode === 'off' ? false : !cur;
  steps.forEach((st, i) => {
    const mode = st.mode || 'toggle';
    if (st.t === 'scene') push('do', ['SetCurrentProgramScene', { sceneName: str(st.scene) }]);
    else if (st.t === 'item') {
      const id = itemId('id:' + i, st.id); if (id == null) return push('miss', null);
      const cur = enR[i] ? !!dataOf(enR[i]).sceneItemEnabled : false;
      push('do', ['SetSceneItemEnabled', { sceneName: str(st.scene), sceneItemId: id, sceneItemEnabled: flip(mode, cur) }]);
    } else if (st.t === 'filter') {
      const cur = preR['f:' + i] ? !!dataOf(preR['f:' + i]).filterEnabled : false;
      push('do', ['SetSourceFilterEnabled', { sourceName: str(st.source), filterName: str(st.filter), filterEnabled: flip(mode, cur) }]);
    } else if (st.t === 'mute') {
      if (mode === 'toggle') push('do', ['ToggleInputMute', { inputName: str(st.input) }]);
      else push('do', ['SetInputMute', { inputName: str(st.input), inputMuted: mode === 'on' }]);
    } else if (st.t === 'vol') {
      let db = Number(st.db);
      if (st.step != null) { const cur = Number(dataOf(preR['v:' + i]).inputVolumeDb); db = (isFinite(cur) ? Math.max(cur, -60) : -60) + Number(st.step || 0); }
      if (!isFinite(db)) return;
      db = Math.round(Math.max(-60, Math.min(0, db)) * 10) / 10;
      push('do', ['SetInputVolume', { inputName: str(st.input), inputVolumeDb: db <= -60 ? -100 : db }]);
    } else if (st.t === 'refresh') push('do', ['PressInputPropertiesButton', { inputName: str(st.input), propertyName: 'refreshnocache' }]);
    else if (st.t === 'stream') push('do', [mode === 'on' ? 'StartStream' : mode === 'off' ? 'StopStream' : 'ToggleStream']);
    else if (st.t === 'record') push('do', [mode === 'on' ? 'StartRecord' : mode === 'off' ? 'StopRecord' : mode === 'pause' ? 'ToggleRecordPause' : 'ToggleRecord']);
    else if (st.t === 'replay') push('do', ['SaveReplayBuffer']);
    else if (st.t === 'text') push('do', ['SetInputSettings', { inputName: str(st.input), inputSettings: { text: String(st.text == null ? '' : st.text).slice(0, 500) }, overlay: true }]);
    else if (st.t === 'wait') push('wait', ['Sleep', { sleepMillis: Math.max(100, Math.min(10000, Math.round(Number(st.s || 1) * 1000))) }]);
  });
  const doReqs = reqs.filter(Boolean);
  const nDo = doReqs.length;
  doReqs.push(['GetSceneList'], ['GetStreamStatus'], ['GetRecordStatus']);
  const pIdx = [];
  probes.forEach((p, i) => {
    let r = null;
    if (p.t === 'item') { const id = itemId('pid:' + i, p.id); if (id != null) r = ['GetSceneItemEnabled', { sceneName: str(p.scene), sceneItemId: id }]; }
    else if (p.t === 'filter') r = ['GetSourceFilter', { sourceName: str(p.source), filterName: str(p.filter) }];
    else if (p.t === 'mute') r = ['GetInputMute', { inputName: str(p.input) }];
    else if (p.t === 'vol') r = ['GetInputVolume', { inputName: str(p.input) }];
    if (r) { pIdx.push(i); doReqs.push(r); }
  });
  const R = await batch(doReqs);
  const out = obsOut(cfg, R.slice(nDo, nDo + 3), act === 'scene' ? '' : act);
  const rec = dataOf(R[nDo + 2]); out.record = { on: !!rec.outputActive, paused: !!rec.outputPaused };
  // cómo están los atajos que se ven en pantalla
  out.state = {};
  pIdx.forEach((i, j) => {
    const p = probes[i], r = R[nDo + 3 + j]; if (!okOf(r)) return;
    const d = dataOf(r), k = String(p.k).slice(0, 80);
    if (p.t === 'item') out.state[k] = !!d.sceneItemEnabled;
    else if (p.t === 'filter') out.state[k] = !!d.filterEnabled;
    else if (p.t === 'mute') out.state[k] = !!d.inputMuted;
    else if (p.t === 'vol') { const v = Number(d.inputVolumeDb); out.state[k] = Math.round(Math.max(-100, isFinite(v) ? v : -100) * 10) / 10; }
  });
  // ¿salió bien lo que se pidió?
  if (nDo || kinds.includes('miss')) {
    const bad = [];
    let j = 0;
    kinds.forEach(k => { if (k === 'miss') { bad.push('No encontré esa fuente en la escena'); return; }
      const r = R[j++]; if (k === 'do' && !okOf(r)) bad.push(r && r.requestType === 'SaveReplayBuffer' ? 'el replay buffer de OBS está apagado'
        : (r && r.requestStatus && r.requestStatus.comment) || (r && r.requestType) || 'falló'); });
    if (bad.length) { out.ok = false; out.error = (act === 'scene' ? 'OBS no cambió la escena: ' : 'OBS no pudo: ') + bad.join(' · '); }
  }
  // 4) foto de lo que está saliendo (solo si la pidieron)
  if (shot && out.current) {
    const [r] = await batch([['GetSourceScreenshot', { sourceName: out.current, imageFormat: 'jpg', imageWidth: 480, imageCompressionQuality: 55 }]]);
    if (okOf(r)) out.shot = dataOf(r).imageData;
  }
  return out;
}
// Todo lo que hay en tu OBS, para armar los atajos (escenas, fuentes, audios, filtros)
async function obsCatalog(batch) {
  const [sl, il] = await batch([['GetSceneList'], ['GetInputList']]);
  const scenes = (dataOf(sl).scenes || []).slice().sort((a, b) => (b.sceneIndex || 0) - (a.sceneIndex || 0)).map(x => x.sceneName);
  const inputs = (dataOf(il).inputs || []).map(x => ({ name: x.inputName, kind: x.unversionedInputKind || x.inputKind || '' }));
  const r2 = [], idx = [];
  scenes.forEach(n => { idx.push(['items', n]); r2.push(['GetSceneItemList', { sceneName: n }]); });
  inputs.forEach(x => { idx.push(['mute', x.name]); r2.push(['GetInputMute', { inputName: x.name }]);
                        idx.push(['vol', x.name]); r2.push(['GetInputVolume', { inputName: x.name }]); });
  scenes.concat(inputs.map(x => x.name)).forEach(n => { idx.push(['filters', n]); r2.push(['GetSourceFilterList', { sourceName: n }]); });
  const R2 = await batch(r2);
  const items = {}, filters = {}, groups = [], audio = {};
  R2.forEach((r, i) => {
    const [k, n] = idx[i]; if (!okOf(r)) return; const d = dataOf(r);
    if (k === 'items') items[n] = (d.sceneItems || []).slice().sort((a, b) => (b.sceneItemIndex || 0) - (a.sceneItemIndex || 0))
      .map(x => { if (x.isGroup && groups.indexOf(x.sourceName) < 0) groups.push(x.sourceName); return { id: x.sceneItemId, name: x.sourceName, on: !!x.sceneItemEnabled, group: !!x.isGroup }; });
    else if (k === 'mute') audio[n] = Object.assign(audio[n] || {}, { muted: !!d.inputMuted });
    else if (k === 'vol') { const v = Number(d.inputVolumeDb); audio[n] = Object.assign(audio[n] || {}, { db: Math.round(Math.max(-100, isFinite(v) ? v : -100) * 10) / 10 }); }
    else if (k === 'filters' && (d.filters || []).length) filters[n] = d.filters.map(f => ({ name: f.filterName, on: !!f.filterEnabled, kind: String(f.filterKind || '') }));
  });
  if (groups.length) {
    const R3 = await batch(groups.map(g => ['GetGroupSceneItemList', { sceneName: g }]));
    R3.forEach((r, i) => { if (okOf(r)) items[groups[i]] = (dataOf(r).sceneItems || []).slice().sort((a, b) => (b.sceneItemIndex || 0) - (a.sceneItemIndex || 0))
      .map(x => ({ id: x.sceneItemId, name: x.sourceName, on: !!x.sceneItemEnabled, group: false })); });
  }
  inputs.forEach(x => { if (audio[x.name] && 'muted' in audio[x.name]) { x.audio = true; x.muted = audio[x.name].muted; x.db = audio[x.name].db; } });
  return { scenes, groups, items, inputs, filters };
}

async function login(req, res) {
  if (!CLIENT_ID || !CLIENT_SECRET) return send(res, 500, page('Falta configurar', '<h1 class="bad">Faltan las claves de Kick</h1><p>Agrega <code>KICK_CLIENT_ID</code> y <code>KICK_CLIENT_SECRET</code> en Vercel → Settings → Environment Variables y vuelve a publicar.</p>'), 'text/html; charset=utf-8');
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  await redis('SET', 'pkce:' + state, verifier, 'EX', 900);
  // /api/login?nueva=1 → al terminar de autorizar se crea una clave 🔑 nueva
  if ((req.query || {}).nueva === '1') await redis('SET', 'newkey:' + state, '1', 'EX', 900);
  const qs = { client_id: CLIENT_ID, response_type: 'code', redirect_uri: baseUrl(req) + '/api/callback',
               scope: SCOPES, state, code_challenge: challenge, code_challenge_method: 'S256' };
  const url = 'https://id.kick.com/oauth/authorize?' +
    Object.keys(qs).map(k => k + '=' + encodeURIComponent(qs[k])).join('&');
  res.statusCode = 302; res.setHeader('Location', url); res.end();
}

async function callback(req, res) {
  const q = req.query || {};
  const html = (code, b) => send(res, code, page('Kick Feed', b), 'text/html; charset=utf-8');
  if (q.error) return html(400, '<h1 class="bad">No se autorizó</h1><p>' + esc(q.error_description || q.error) + '</p><a class="btn" href="/api/login">Intentar otra vez</a>');
  const verifier = q.state ? await redis('GET', 'pkce:' + q.state) : null;
  if (!q.code || !verifier) return html(400, '<h1 class="bad">El enlace ya caducó</h1><a class="btn" href="/api/login">Empezar otra vez</a>');
  await redis('DEL', 'pkce:' + q.state);
  try {
    const j = await tokenRequest({ grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: baseUrl(req) + '/api/callback', code_verifier: verifier, code: q.code });
    const me = await kickApi('/users', j.access_token);
    const u = (me.data || [])[0] || {};
    const name = String(u.name || u.username || '').toLowerCase();
    // Solo se acepta tu cuenta: nadie más puede "secuestrar" el servidor.
    if (name !== CHANNEL) return html(403, '<h1 class="bad">Esa cuenta no es ' + esc(CHANNEL) + '</h1><p>Entraste como <b>' + esc(u.name) + '</b>. Cierra sesión en Kick, entra con tu cuenta y vuelve a intentarlo.</p><a class="btn" href="/api/login">Intentar otra vez</a>');
    const tok = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000,
                  user_id: u.user_id, username: u.name, scope: j.scope || SCOPES, at: Date.now() };
    await setJSON('tok', tok);
    // Clave para que solo tus celulares puedan cambiar cosas en tu canal.
    let fkey = await redis('GET', 'feedkey');
    const rotate = await redis('GET', 'newkey:' + q.state);
    if (rotate) { await redis('DEL', 'newkey:' + q.state); fkey = null; }
    if (!fkey) { fkey = b64url(crypto.randomBytes(18)); await redis('SET', 'feedkey', fkey); }
    KEYC = { k: fkey, at: Date.now() };
    const feedUrl = 'https://mariiotq.github.io/kick-feed/?key=' + encodeURIComponent(fkey);
    const subs = await subscribeAll(tok);
    await redis('SET', 'subsVer', SUBS_VER);
    const lines = subs.map(s => '<li>' + (s.ok ? '<span class="ok">✔</span> ' : '<span class="bad">✘</span> ') + esc(s.name) + (s.error ? ' <small>(' + esc(s.error) + ')</small>' : '') + '</li>').join('');
    const sc = String(tok.scope || '');
    const canWrite = /channel:write/.test(sc);
    const perm = (re, ok, label) => '<p>' + (re.test(sc) ? '<span class="ok">✔</span> ' + ok : '<span class="bad">✘</span> Falta <b>' + label + '</b>: márcalo en tu app de Kick y vuelve a conectar') + '</p>';
    return html(200, '<h1 class="ok">✅ Listo, ' + esc(u.name) + '</h1><p>Kick ya le avisa a tu servidor de estos eventos:</p><ul>' + lines + '</ul>' +
      '<p>' + (canWrite ? '<span class="ok">✔</span> Permiso para cambiar título y categoría' : '<span class="bad">✘</span> Falta el permiso <b>Actualizar información del canal</b>: márcalo en tu app de Kick y vuelve a conectar') + '</p>' +
      perm(/moderation:ban/, 'Permiso para silenciar y banear desde el chat', 'Ejecuta acciones de moderación para moderadores') +
      perm(/moderation:chat_message:manage/, 'Permiso para borrar mensajes', 'Ejecuta acciones de moderador en mensajes de chat') +
      perm(/chat:write/, 'Permiso para escribir en el chat', 'Escribir en el feed del chat') +
      '<h1 style="margin-top:22px">🔑 Enlace para tus celulares</h1><p>Ábrelo <b>una vez</b> en cada celular (o pégalo en IRL Plus Chat). Así el feed puede cambiar tu título y categoría. <b>No lo compartas.</b></p>' +
      '<p><code id="fu" style="word-break:break-all">' + esc(feedUrl) + '</code></p>' +
      '<a class="btn" href="#" onclick="navigator.clipboard.writeText(document.getElementById(\'fu\').textContent);this.textContent=\'✅ Copiado\';return false">Copiar enlace</a> ' +
      '<a class="btn" style="background:#2a2f3a;color:#e8eaee" href="/api/status">Ver estado</a>' +
      '<p style="margin-top:18px"><small>' + (rotate ? '✔ Clave nueva creada: la anterior ya no sirve, abre este enlace otra vez en tus celulares.'
        : '¿Se te filtró el enlace? Abre <code>/api/login?nueva=1</code>, autoriza y te doy una clave nueva (la anterior deja de servir).') + '</small></p>');
  } catch (e) {
    return html(500, '<h1 class="bad">Algo falló</h1><p>' + esc(e.message) + '</p><a class="btn" href="/api/login">Intentar otra vez</a>');
  }
}

async function status(req, res) {
  const row = (ok, txt) => '<li>' + (ok === true ? '<span class="ok">✔</span> ' : ok === false ? '<span class="bad">✘</span> ' : '<span class="warn">•</span> ') + txt + '</li>';
  let out = '';
  out += row(!!(CLIENT_ID && CLIENT_SECRET), 'Claves de la app de Kick ' + (CLIENT_ID && CLIENT_SECRET ? 'configuradas' : '<b>faltan</b> (KICK_CLIENT_ID / KICK_CLIENT_SECRET)'));
  let dbOk = false;
  try { await redis('PING'); dbOk = true; } catch (e) {}
  out += row(dbOk, dbOk ? 'Base de datos conectada' : '<b>Falta la base de datos</b> (Upstash for Redis)');
  if (dbOk) {
    const tok = await getJSON('tok');
    out += row(!!tok, tok ? 'Cuenta conectada: <b>' + esc(tok.username) + '</b>' : '<b>Falta conectar tu cuenta</b>: <a href="/api/login">conectar</a>');
    if (tok && CLIENT_ID) {
      try {
        const t = await validToken();
        const s = await kickApi('/events/subscriptions', t.access_token);
        const names = (s.data || []).map(x => x.event || x.name);
        EVENTS.forEach(n => { out += row(names.indexOf(n) !== -1, 'Aviso de Kick: <code>' + n + '</code>'); });
      } catch (e) { out += row(false, 'No pude revisar las suscripciones: ' + esc(e.message)); }
    }
    const lastHook = Number(await redis('GET', 'lastHook')) || 0;
    const n = await redis('ZCARD', 'ev');
    out += row(lastHook ? true : null, lastHook ? 'Último aviso recibido: ' + new Date(lastHook).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) + ' · ' + n + ' eventos guardados' : 'Todavía no llega ningún aviso de Kick (es normal hasta que haya una sub, Kicks, follow o empiece el stream)');
    const rej = await redis('LLEN', 'rejected');
    if (rej) out += row(false, rej + ' avisos rechazados porque la firma no era de Kick');
  }
  return send(res, 200, page('Estado · Kick Feed', '<h1>Estado del servidor</h1><ul>' + out + '</ul><a class="btn" href="/api/login">Volver a conectar mi cuenta</a>'), 'text/html; charset=utf-8');
}

async function debug(req, res) {
  // Para revisar con Claude: los últimos avisos crudos (sin datos privados).
  cors(res);
  const raw = await redis('LRANGE', 'raw', 0, 39);
  const rej = await redis('LRANGE', 'rejected', 0, 19);
  return send(res, 200, { raw: (raw || []).map(x => JSON.parse(x)), rejected: (rej || []).map(x => JSON.parse(x)) });
}

module.exports = async function handler(req, res) {
  const route = String((req.query && req.query.route) || '').toLowerCase();
  try {
    if (route === 'webhook') return await webhook(req, res);
    if (route === 'events') return await events(req, res);
    if (route === 'list') return await list(req, res);
    if (route === 'channel') return await channel(req, res);
    if (route === 'categories') return await categories(req, res);
    if (route === 'mod') return await mod(req, res);
    if (route === 'realtime') return await realtimeKey(req, res);
    if (route === 'spam') return await spamApi(req, res);
    if (route === 'modcmd') return await modCmdApi(req, res);
    if (route === 'moments') return await momentsApi(req, res);
    if (route === 'viewers') return await viewersApi(req, res);
    if (route === 'rules') return await rulesApi(req, res);
    if (route === 'goal') return await goalApi(req, res);
    if (route === 'chatters') return await chatters(req, res);
    if (route === 'prefs') return await prefsApi(req, res);
    if (route === 'obs') return await obsApi(req, res);
    if (route === 'chat') return await chatSend(req, res);
    if (route === 'login') return await login(req, res);
    if (route === 'callback') return await callback(req, res);
    if (route === 'status') return await status(req, res);
    if (route === 'debug') return await debug(req, res);
    return send(res, 404, { ok: false, error: 'ruta desconocida' });
  } catch (e) {
    cors(res);
    return send(res, 500, { ok: false, error: e.message });
  }
};
