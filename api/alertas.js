/* ==================================================================
   ALERTAS · SERVIDOR (Vercel)
   Archivo aparte (como el del BRB): si algo falla aquí, el feed sigue igual.
   Usa la misma base de datos (Upstash) y la misma clave de tus celulares.

   Qué guarda:
     al:cfg        cómo se ve y suena cada alerta (Kick y Twitch)
     al:files      la lista de tus sonidos e imágenes subidos (nombre, tipo, tamaño)
     af:<id>:<n>   el archivo en pedacitos (para no pasar el límite de la base)
     alq           alertas que repetiste, probaste o que vio tu app (raids de Kick, tips)

   Las alertas de verdad salen de lo mismo que ya recibe tu servidor (zset «ev»):
   subs, renovaciones, regaladas, Kicks, bits, raids y follows de Kick y de Twitch.

   Rutas (todas en /api/alertas?a=…):
     cfg     cómo están tus alertas                      (público: el player la lee)
     poll    lo nuevo de los últimos 2 minutos            (público; se comparte 2 s en la CDN)
     f       un archivo tuyo (sonido o imagen)            (público; se guarda en la CDN para siempre)
     save    guardar tus alertas                          (con clave)
     up      subir un sonido o imagen                     (con clave)
     fdel    borrar un archivo                            (con clave)
     replay  repetir una alerta                           (con clave)
     test    probar una alerta                            (con clave)
     fire    una alerta que solo vio tu app (raid de Kick, tip) (con clave)
     skip    saltar la que está sonando                   (con clave)
   ================================================================== */
'use strict';
const crypto = require('crypto');

/* ---------------- Redis (Upstash, por su API web) ---------------- */
function envEnding(suffix, alt) {
  if (process.env[alt]) return process.env[alt];
  const k = Object.keys(process.env).find(n => n.endsWith(suffix) && !/READ_ONLY/.test(n));
  return k ? process.env[k] : '';
}
const R_URL = envEnding('_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
const R_TOK = envEnding('_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
async function redis(...cmd) {
  if (!R_URL || !R_TOK) throw new Error('Falta la base de datos (Upstash for Redis)');
  const r = await fetch(R_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}
// varios comandos en una sola llamada
async function pipe(cmds) {
  if (!R_URL || !R_TOK) throw new Error('Falta la base de datos (Upstash for Redis)');
  const r = await fetch(R_URL.replace(/\/+$/, '') + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j)) throw new Error('Redis: ' + r.status);
  return j.map(x => (x && x.error) ? null : x && x.result);
}
const parse = v => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };

/* ---------------- utilidades ---------------- */
function send(res, code, body, cache) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function readRaw(req) {
  return new Promise((ok, bad) => { const c = []; req.on('data', x => c.push(x)); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); req.on('error', bad); });
}
async function readJSONBody(req) {
  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string' && req.body) return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body) && req.body.length) return JSON.parse(req.body.toString('utf8'));
  } catch (e) { return {}; }
  const raw = await readRaw(req);
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}
const str = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, max) : '';
const num = (v, lo, hi, def) => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? Math.min(hi, Math.max(lo, n)) : def; };
const pick = (v, list, def) => list.indexOf(v) >= 0 ? v : def;
let KEYC = { k: null, at: 0 };
async function checkKey(q) {
  if (!KEYC.k || Date.now() - KEYC.at > 60000) KEYC = { k: await redis('GET', 'feedkey'), at: Date.now() };
  const a = Buffer.from(String(q || '')), b = Buffer.from(String(KEYC.k || ''));
  return !!KEYC.k && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- tus alertas ---------------- */
const TYPES = ['sub', 'resub', 'gift', 'kicks', 'bits', 'raid', 'follow', 'tip', 'reward'];
const ONLY = { kicks: 'kick', tip: 'kick', bits: 'tw', reward: 'tw' };      // lo que solo existe en una plataforma
const SNDS = ['fanfarria', 'campana', 'magia', 'monedas', 'tambor', 'pop', 'caja', 'level', 'cohete', 'nada'];
const IMGS = ['corona', 'estrella', 'regalo', 'rayo', 'gema', 'cohete', 'corazon', 'billete', 'puntos', 'nada'];
const DEF = {
  sub:    { on: true,  text: '{nombre} se suscribió', sub: '¡Bienvenido a la familia! 💚', img: 'corona', snd: 'fanfarria', dur: 7 },
  resub:  { on: true,  text: '{nombre} renovó su sub', sub: '{meses} meses · {mensaje}', img: 'estrella', snd: 'campana', dur: 7, tts: true },
  gift:   { on: true,  text: '{nombre} regaló {cantidad} subs', sub: '¡Gracias por el regalo! 🎁', img: 'regalo', snd: 'magia', dur: 8 },
  kicks:  { on: true,  text: '{nombre} mandó {cantidad} Kicks', sub: '{mensaje}', img: 'rayo', snd: 'monedas', dur: 7, tts: true },
  bits:   { on: true,  text: '{nombre} mandó {cantidad} bits', sub: '{mensaje}', img: 'gema', snd: 'monedas', dur: 7, tts: true },
  raid:   { on: true,  text: '¡Raid de {nombre}!', sub: 'Llegan con {cantidad} viewers 🚀', img: 'cohete', snd: 'tambor', dur: 8 },
  follow: { on: false, text: '{nombre} te sigue', sub: '', img: 'corazon', snd: 'pop', dur: 5 },
  tip:    { on: true,  text: '{nombre} donó {cantidad}', sub: '{mensaje}', img: 'billete', snd: 'caja', dur: 8, tts: true },
  reward: { on: false, text: '{nombre} canjeó {cantidad}', sub: '{mensaje}', img: 'puntos', snd: 'pop', dur: 5 }
};
function media(v, list, files, def) {
  // 'b:monedas' (de la app) · 'f:<id>' (subido) · 'u:https://…' (de internet)
  const s = String(v || '');
  if (/^b:/.test(s) && list.indexOf(s.slice(2)) >= 0) return s;
  if (/^f:[a-f0-9]{16}$/.test(s) && files[s.slice(2)]) return s;
  if (/^u:https:\/\//.test(s) && s.length < 700) { try { const u = new URL(s.slice(2)); if (u.protocol === 'https:') return 'u:' + u.toString(); } catch (e) {} }
  if (list.indexOf(s) >= 0) return 'b:' + s;
  return 'b:' + def;
}
function cleanOne(x, t, files) {
  x = x && typeof x === 'object' ? x : {};
  const d = DEF[t];
  const o = {
    on: typeof x.on === 'boolean' ? x.on : d.on,
    min: Math.round(num(x.min, 0, 1e7, 0)),
    text: x.text != null ? str(x.text, 120) : d.text,
    sub: x.sub != null ? str(x.sub, 160) : d.sub,
    img: media(x.img, IMGS, files, d.img),
    snd: media(x.snd, SNDS, files, d.snd),
    vol: Math.round(num(x.vol, 0, 100, 80)),
    norm: num(x.norm, 0.05, 1, 1),
    dur: num(x.dur, 2, 30, d.dur),
    tts: typeof x.tts === 'boolean' ? x.tts : !!d.tts,
    anim: pick(x.anim, ['pop', 'sube', 'zoom', 'gira'], 'pop'),
    color: /^#[0-9a-f]{6}$/i.test(String(x.color || '')) ? String(x.color) : ''
  };
  // variaciones por cantidad (p. ej. 500 Kicks o más: otra imagen y otro sonido)
  o.vars = (Array.isArray(x.vars) ? x.vars : []).slice(0, 6).map(v => {
    v = v && typeof v === 'object' ? v : {};
    return { min: Math.round(num(v.min, 1, 1e7, 100)), text: v.text != null ? str(v.text, 120) : '', sub: v.sub != null ? str(v.sub, 160) : '',
             img: v.img ? media(v.img, IMGS, files, d.img) : '', snd: v.snd ? media(v.snd, SNDS, files, d.snd) : '',
             vol: v.vol != null ? Math.round(num(v.vol, 0, 100, 80)) : null, norm: num(v.norm, 0.05, 1, 1), dur: v.dur != null ? num(v.dur, 2, 30, d.dur) : null };
  }).sort((a, b) => a.min - b.min);
  return o;
}
function cleanCfg(c, files) {
  c = c && typeof c === 'object' ? c : {};
  const out = {
    on: c.on !== false,
    vol: Math.round(num(c.vol, 0, 100, 80)),
    ttsVol: Math.round(num(c.ttsVol, 0, 100, 80)),
    ttsMax: Math.round(num(c.ttsMax, 20, 300, 140)),
    pos: pick(c.pos, ['arriba', 'centro', 'abajo'], 'centro'),
    size: pick(c.size, ['chica', 'normal', 'grande'], 'normal'),
    look: pick(c.look, ['tarjeta', 'limpio', 'neon'], 'tarjeta'),
    gap: num(c.gap, 0, 10, 1),
    pf: {}
  };
  ['kick', 'tw'].forEach(pf => {
    out.pf[pf] = {};
    TYPES.forEach(t => { if (!ONLY[t] || ONLY[t] === pf) out.pf[pf][t] = cleanOne(c.pf && c.pf[pf] && c.pf[pf][t], t, files); });
  });
  return out;
}
async function files() { return parse(await redis('GET', 'al:files')) || {}; }
async function getCfg() {
  const [c, f] = (await redis('MGET', 'al:cfg', 'al:files')) || [];
  const fl = parse(f) || {};
  return { cfg: cleanCfg(parse(c), fl), files: fl };
}

/* ---------------- archivos (sonidos e imágenes que subes) ---------------- */
const CHUNK = 600000;                     // letras de base64 por pedacito
const MAXF = { audio: 1.2e6, image: 3e6, video: 3e6 };
const MAX_FILES = 60, MAX_TOTAL = 40e6;
const MIMES = { 'audio/mpeg': 'audio', 'audio/mp3': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio', 'audio/ogg': 'audio', 'audio/webm': 'audio', 'audio/aac': 'audio', 'audio/mp4': 'audio', 'audio/x-m4a': 'audio',
                'image/gif': 'image', 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'video/webm': 'video', 'video/mp4': 'video' };
async function upload(res, b) {
  const type = String(b.type || '').toLowerCase(), kind = MIMES[type];
  if (!kind) return send(res, 200, { ok: false, error: 'Ese tipo de archivo no: usa MP3, WAV, OGG, GIF, PNG, JPG, WEBP, WEBM o MP4' });
  const data = String(b.data || '').replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) return send(res, 200, { ok: false, error: 'El archivo llegó mal' });
  const size = Math.floor(data.length * 3 / 4);
  if (size > MAXF[kind]) return send(res, 200, { ok: false, error: 'Muy pesado: ' + (kind === 'audio' ? 'los sonidos hasta 1.2 MB' : 'las imágenes y videos hasta 3 MB') });
  const fl = await files();
  const id = crypto.createHash('sha1').update(data).digest('hex').slice(0, 16);
  if (!fl[id]) {
    const ids = Object.keys(fl), total = ids.reduce((s, k) => s + (fl[k].size || 0), 0);
    if (ids.length >= MAX_FILES || total + size > MAX_TOTAL) return send(res, 200, { ok: false, error: 'Ya no caben más archivos: borra alguno que no uses' });
    const parts = [];
    for (let i = 0; i < data.length; i += CHUNK) parts.push(data.slice(i, i + CHUNK));
    for (let i = 0; i < parts.length; i++) await redis('SET', 'af:' + id + ':' + i, parts[i]);
    fl[id] = { name: str(b.name, 60) || 'archivo', type, kind, size, n: parts.length, at: Date.now(), norm: num(b.norm, 0.05, 1, 1) };
    await redis('SET', 'al:files', JSON.stringify(fl));
  } else if (b.norm != null) { fl[id].norm = num(b.norm, 0.05, 1, fl[id].norm || 1); await redis('SET', 'al:files', JSON.stringify(fl)); }
  return send(res, 200, { ok: true, id, file: fl[id] });
}
async function fileDel(res, b) {
  const id = String(b.id || '');
  const fl = await files();
  if (!fl[id]) return send(res, 200, { ok: true });
  const keys = []; for (let i = 0; i < (fl[id].n || 1); i++) keys.push('af:' + id + ':' + i);
  await redis('DEL', ...keys);
  delete fl[id];
  await redis('SET', 'al:files', JSON.stringify(fl));
  return send(res, 200, { ok: true });
}
async function fileGet(res, q) {
  const id = String(q.id || '');
  if (!/^[a-f0-9]{16}$/.test(id)) return send(res, 404, { ok: false });
  const fl = await files(), f = fl[id];
  if (!f) return send(res, 404, { ok: false, error: 'no está' });
  const keys = []; for (let i = 0; i < (f.n || 1); i++) keys.push('af:' + id + ':' + i);
  const parts = (await redis('MGET', ...keys)) || [];
  if (parts.some(p => !p)) return send(res, 404, { ok: false, error: 'incompleto' });
  const buf = Buffer.from(parts.join(''), 'base64');
  res.statusCode = 200;
  res.setHeader('Content-Type', f.type);
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');   // el id es su huella: nunca cambia
  res.end(buf);
}

/* ---------------- lo que va saliendo ---------------- */
const KINDS = { sub: 'sub', resub: 'resub', gift: 'gift', kicks: 'kicks', bits: 'bits', raid: 'raid', follow: 'follow', reward: 'reward' };
function fromEv(e) {
  const d = e && e.d || {};
  const k = KINDS[d.kind]; if (!k) return null;
  const pf = d.pf === 'tw' ? 'tw' : 'kick';
  const n = k === 'gift' ? (Number(d.count) || 1) : k === 'kicks' || k === 'bits' ? (Number(d.amount) || 0) : k === 'raid' ? (Number(d.viewers) || 0)
          : k === 'resub' ? (Number(d.months) || 0) : k === 'reward' ? str(d.reward, 60) : k === 'sub' ? (Number(d.months) || 1) : 0;
  let m = k === 'reward' ? str(d.input, 300) : str(d.message, 300);
  if (k === 'bits') m = m.split(/\s+/).filter(w => !/^[A-Za-z]+\d+$/.test(w)).join(' ');      // sin «Cheer100»
  return { id: String(e.id || ''), ts: Number(e.rt || e.ts) || 0, k, pf, u: d.anon ? 'Anónimo' : str(d.user, 40), n, m: m.replace(/\[(emote|twe|twg):[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim() };
}
function cleanAl(a) {
  a = a && typeof a === 'object' ? a : {};
  const k = TYPES.indexOf(a.k) >= 0 ? a.k : null; if (!k) return null;
  const pf = a.pf === 'tw' ? 'tw' : 'kick';
  return { k, pf, u: str(a.u, 40), n: typeof a.n === 'number' && isFinite(a.n) ? Math.max(0, Math.min(1e7, a.n)) : str(String(a.n == null ? '' : a.n), 40), m: str(a.m, 300) };
}
async function qPush(item) {
  const now = Date.now();
  item.ts = now; item.id = item.id || ('q' + now.toString(36) + crypto.randomBytes(3).toString('hex'));
  await pipe([['ZADD', 'alq', now, JSON.stringify(item)], ['ZREMRANGEBYSCORE', 'alq', '-inf', now - 10 * 60000], ['ZREMRANGEBYRANK', 'alq', 0, -101]]);
  return item;
}
async function poll(res) {
  const now = Date.now(), from = now - 120000;
  const [evs, q, mg] = await pipe([['ZRANGEBYSCORE', 'ev', from, '+inf', 'LIMIT', 0, 60], ['ZRANGEBYSCORE', 'alq', from, '+inf', 'LIMIT', 0, 60], ['MGET', 'live', 'tw:live', 'al:cfgAt']]);
  const list = [];
  (evs || []).forEach(s => { const a = fromEv(parse(s)); if (a) list.push(a); });
  (q || []).forEach(s => { const x = parse(s); if (x) list.push(x); });
  const [lv, tl, ca] = mg || [];
  const live = { kick: !!(parse(lv) || {}).is_live, tw: !!(parse(tl) || {}).is_live };
  // lo mismo para todos los players en estos 2 segundos (la CDN de Vercel lo comparte: menos llamadas)
  return send(res, 200, { ok: true, now, live, cv: Number(ca) || 0, list }, 'public, max-age=0, s-maxage=2, stale-while-revalidate=2');
}

/* ---------------- entrada ---------------- */
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const q = req.query || {};
  const a = String(q.a || '').toLowerCase();
  try {
    if (a === 'poll') return await poll(res);
    if (a === 'f') return await fileGet(res, q);
    if (a === 'cfg' && req.method !== 'POST') { const c = await getCfg(); return send(res, 200, { ok: true, cfg: c.cfg, files: c.files }); }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'usa POST' });
    const b = await readJSONBody(req);
    if (!(await checkKey(b.key || q.key))) return send(res, 403, { ok: false, error: 'La clave 🔑 no coincide' });
    if (a === 'save') {
      const fl = await files(), cfg = cleanCfg(b.cfg, fl), at = Date.now();
      await pipe([['SET', 'al:cfg', JSON.stringify(cfg)], ['SET', 'al:cfgAt', String(at)]]);
      return send(res, 200, { ok: true, cfg, files: fl, at });
    }
    if (a === 'up') return await upload(res, b);
    if (a === 'fdel') return await fileDel(res, b);
    if (a === 'replay' || a === 'test') {
      const al = cleanAl(b.al); if (!al) return send(res, 400, { ok: false, error: 'alerta rara' });
      const item = Object.assign(al, a === 'test' ? { test: 1, vi: Math.round(num(b.vi, -1, 5, -1)) } : { rp: 1 });
      return send(res, 200, { ok: true, item: await qPush(item) });
    }
    if (a === 'fire') {
      const al = cleanAl(b.al); if (!al || !(al.k === 'raid' || al.k === 'tip')) return send(res, 400, { ok: false, error: 'alerta rara' });
      // si tus dos celulares la vieron, sale una sola vez
      const fp = crypto.createHash('sha1').update(JSON.stringify([al.k, al.pf, al.u.toLowerCase(), String(al.n)])).digest('hex').slice(0, 16);
      if (!(await redis('SET', 'alf:' + fp, '1', 'NX', 'EX', 60))) return send(res, 200, { ok: true, dup: true });
      return send(res, 200, { ok: true, item: await qPush(al) });
    }
    if (a === 'skip') return send(res, 200, { ok: true, item: await qPush({ ctl: 'skip' }) });
    return send(res, 404, { ok: false, error: 'ruta desconocida' });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
};
