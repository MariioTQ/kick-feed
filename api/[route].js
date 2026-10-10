/* ==================================================================
   KICK FEED · SERVIDOR (Vercel)
   Un solo archivo con todas las rutas:
     /api/webhook   Kick avisa aquí cada sub, resub, regalo, Kicks, ban…
     /api/events    el feed pide la lista de eventos (y los totales)
     /api/login     conectar tu cuenta de Kick (una sola vez)
     /api/callback  Kick regresa aquí después de "Autorizar"
     /api/status    página para revisar que todo esté funcionando

   Variables que se configuran en Vercel (Settings → Environment Variables):
     KICK_CLIENT_ID, KICK_CLIENT_SECRET   las dos claves de tu app de Kick
     KICK_CHANNEL                         opcional, por defecto "mariotq"
   La base de datos (Upstash for Redis) agrega sola sus variables.

   No se guarda ninguna contraseña. Solo el permiso que tú autorizas en
   la página oficial de Kick, y únicamente si la cuenta es KICK_CHANNEL.
   ================================================================== */
'use strict';
const crypto = require('crypto');

const CHANNEL = (process.env.KICK_CHANNEL || 'mariotq').toLowerCase();
const CLIENT_ID = process.env.KICK_CLIENT_ID || '';
const CLIENT_SECRET = process.env.KICK_CLIENT_SECRET || '';
const SCOPES = 'user:read channel:read channel:write events:subscribe kicks:read';
const EVENTS = [
  'channel.subscription.new', 'channel.subscription.renewal', 'channel.subscription.gifts',
  'kicks.gifted', 'channel.followed', 'moderation.banned', 'livestream.status.updated'
];
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

/* ---------------- tokens de Kick ---------------- */
async function tokenRequest(params) {
  const r = await fetch('https://id.kick.com/oauth/token', {
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
  const r = await fetch('https://api.kick.com/public/v1' + path, Object.assign({
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
async function kickPublicKey() {
  if (PUBKEY) return PUBKEY;
  const r = await fetch('https://api.kick.com/public/v1/public-key');
  const j = await r.json();
  PUBKEY = (j.data && (j.data.public_key || j.data.publicKey)) || j.public_key || '';
  return PUBKEY;
}
async function verifyKick(req, raw) {
  const id = req.headers['kick-event-message-id'], ts = req.headers['kick-event-message-timestamp'];
  const sig = req.headers['kick-event-signature'];
  if (!id || !ts || !sig) return false;
  const key = await kickPublicKey();
  return crypto.verify('sha256', Buffer.from(id + '.' + ts + '.' + raw), { key, padding: crypto.constants.RSA_PKCS1_PADDING },
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
      return { kind: 'ban', user: uname(p.banned_user), mod: uname(p.moderator), reason: m.reason || '', expires_at: m.expires_at || null };
    }
    case 'livestream.status.updated':
      return { kind: 'live', is_live: !!p.is_live, started_at: p.started_at || null, ended_at: p.ended_at || null, title: p.title || '' };
    default:
      return { kind: 'other' };
  }
}
function evTime(type, p, fallback) {
  const t = Date.parse(p.created_at || (p.metadata && p.metadata.created_at) || (type === 'livestream.status.updated' ? (p.is_live ? p.started_at : p.ended_at) : '') || '');
  return t || fallback;
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
  // Kick puede reintentar el mismo aviso: se guarda una sola vez.
  const fresh = await redis('SET', 'seen:' + msgId, '1', 'NX', 'EX', 7 * 86400);
  if (fresh) {
    const rt = Date.now();                       // cuándo llegó (para que el feed no se salte nada)
    const ts = evTime(type, p, rt);              // cuándo pasó (lo que dice Kick)
    const ev = { id: msgId, type, ts, rt, d: normalize(type, p) };
    await redis('ZADD', 'ev', rt, JSON.stringify(ev));
    await redis('ZREMRANGEBYRANK', 'ev', 0, -(KEEP + 1));
    await addToLists(ev);
    if (type === 'livestream.status.updated') {
      await setJSON('live', Object.assign({ at: rt }, ev.d));
      // "Sesión" = el stream del día. Si el stream se corta y vuelve en
      // menos de 30 min (pasa mucho en IRL), sigue siendo la misma sesión
      // y los contadores no se reinician.
      const se = (await getJSON('session')) || {};
      if (ev.d.is_live) {
        const st = Date.parse(ev.d.started_at) || ts;
        if (!se.start || !se.lastEnd || st - se.lastEnd > 30 * 60000) se.start = st;
        se.live = true;
      } else {
        se.lastEnd = Date.parse(ev.d.ended_at) || ts; se.live = false;
      }
      await setJSON('session', se);
    }
    await redis('SET', 'lastHook', String(Date.now()));
    await logPush('raw', { at: Date.now(), type, body: raw.slice(0, 1500) }, 40);
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
  const before = Number(q.before) || 0;                // para ir cargando hacia atrás
  const limit = Math.min(100, Number(q.limit) || 40);
  const max = before ? '(' + before : '+inf';
  const items = await redis('ZREVRANGEBYSCORE', key, max, '-inf', 'LIMIT', 0, limit);
  const evs = (items || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
  return send(res, 200, { ok: true, kind: q.kind === 'kicks' ? 'kicks' : 'subs', events: evs, more: evs.length === limit });
}

/* ---- cambiar título y categoría (solo con la clave de tus celulares) ---- */
async function checkKey(q) {
  const k = await redis('GET', 'feedkey');
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
    const r = await fetch('https://api.kick.com/public/v1/channels', {
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

async function events(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const q = req.query || {};
  const since = Number(q.since) || 0;                 // cursor: lo que el feed todavía no tiene
  const limit = Math.min(500, Number(q.limit) || 300);
  const list = await redis('ZRANGEBYSCORE', 'ev', '(' + since, '+inf', 'LIMIT', 0, limit);
  const evs = (list || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
  const cursor = evs.reduce((m, e) => Math.max(m, e.rt || e.ts || 0), since);
  const live = await getJSON('live');
  const se = await getJSON('session');
  // Totales exactos de la sesión: desde que empezó el stream del día (lo
  // manda Kick) o, si el servidor todavía no lo sabe, desde ?from= del feed.
  let from = Number(q.from) || 0;
  if (se && se.start && (se.live || (se.lastEnd && Date.now() - se.lastEnd < 30 * 60000))) from = se.start;
  let totals = null;
  if (from) {
    const sess = await redis('ZRANGEBYSCORE', 'ev', from - 3600000, '+inf');
    totals = { from, subs: 0, kicks: 0, newSubs: 0, resubs: 0, gifted: 0 };
    (sess || []).forEach(s => {
      let e; try { e = JSON.parse(s); } catch (x) { return; }
      if ((e.ts || 0) < from - 60000) return;
      const d = e.d || {};
      if (d.kind === 'sub') { totals.subs++; totals.newSubs++; }
      else if (d.kind === 'resub') { totals.subs++; totals.resubs++; }
      else if (d.kind === 'gift') { totals.subs += d.count || 1; totals.gifted += d.count || 1; }
      else if (d.kind === 'kicks') totals.kicks += d.amount || 0;
    });
  }
  const lastHook = Number(await redis('GET', 'lastHook')) || 0;
  return send(res, 200, { ok: true, now: Date.now(), live, session: se, totals, lastHook, cursor, events: evs });
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
    const feedUrl = 'https://mariiotq.github.io/kick-feed/?key=' + encodeURIComponent(fkey);
    const subs = await subscribeAll(tok);
    const lines = subs.map(s => '<li>' + (s.ok ? '<span class="ok">✔</span> ' : '<span class="bad">✘</span> ') + esc(s.name) + (s.error ? ' <small>(' + esc(s.error) + ')</small>' : '') + '</li>').join('');
    const sc = String(tok.scope || '');
    const canWrite = /channel:write/.test(sc);
    return html(200, '<h1 class="ok">✅ Listo, ' + esc(u.name) + '</h1><p>Kick ya le avisa a tu servidor de estos eventos:</p><ul>' + lines + '</ul>' +
      '<p>' + (canWrite ? '<span class="ok">✔</span> Permiso para cambiar título y categoría' : '<span class="bad">✘</span> Falta el permiso <b>Actualizar información del canal</b>: márcalo en tu app de Kick y vuelve a conectar') + '</p>' +
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
