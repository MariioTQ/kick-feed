/* ==================================================================
   BRB · SERVIDOR (Vercel)
   Archivo aparte del servidor del feed ([route].js): si algo falla aquí,
   el feed sigue igual. Usa la misma base de datos (Upstash) y la misma
   clave de tus celulares («Enlace para tus celulares»).

   Qué guarda (solo texto, nunca video):
     brb:lib   tu biblioteca de clips (título, quién lo sacó, duración…)
     brb:pls   tus playlists y sus ajustes
     brb:scr   la «pantalla» de OBS: qué playlist suena y los controles
     brb:now   qué está sonando ahorita (lo avisa el player)

   Los videos salen directo de Kick y de Twitch hacia OBS: tu servidor
   no los toca, así que no gasta transferencia del plan gratis.

   Rutas (todas en /api/brb?a=…):
     play   el player de OBS pide su playlist        (público, con el id de pantalla)
     tick   el player pregunta cada 3 s si cambió algo (público, con el id de pantalla)
     lib    el estudio lee todo                        (con clave)
     add    agregar clips a la biblioteca               (con clave)
     del    quitar clips de la biblioteca               (con clave)
     pl     crear o guardar una playlist                (con clave)
     pldel  borrar una playlist                         (con clave)
     ctl    controles: siguiente, pausa, silencio…      (con clave)
     state  qué está sonando (para el estudio y el feed) (con clave)
     obs    crear la escena y la fuente en tu OBS       (con clave)
     newscreen  cambiar el link del player si se filtró (con clave)
   ================================================================== */
'use strict';
const crypto = require('crypto');

const CLIENT_SECRET = process.env.KICK_CLIENT_SECRET || '';
const LIB_MAX = 3000;          // clips en la biblioteca
const PL_MAX = 20;             // playlists
const PL_CLIPS = 500;          // clips por playlist
const MSG_MAX = 80;            // letras del mensaje en pantalla

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
  const r = await fetch(R_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}
const parse = v => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
async function getMany(...keys) { return ((await redis('MGET', ...keys)) || []).map(parse); }
async function setJSON(key, val) { return redis('SET', key, JSON.stringify(val)); }

/* ---------------- utilidades ---------------- */
function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
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
async function readJSONBody(req) {
  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string' && req.body) return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body) && req.body.length) return JSON.parse(req.body.toString('utf8'));
  } catch (e) { return {}; }
  const raw = await readRaw(req);
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}
const rid = n => crypto.randomBytes(n || 9).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const str = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, max) : '';
const num = (v, lo, hi, def) => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : def;
const bool = (v, def) => typeof v === 'boolean' ? v : def;
const pick = (v, list, def) => list.indexOf(v) >= 0 ? v : def;

/* ---- la misma clave de tus celulares que usa el feed ---- */
let KEYC = { k: null, at: 0 };
async function checkKey(q) {
  if (!KEYC.k || Date.now() - KEYC.at > 60000) KEYC = { k: await redis('GET', 'feedkey'), at: Date.now() };
  const a = Buffer.from(String(q || '')), b = Buffer.from(String(KEYC.k || ''));
  return !!KEYC.k && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- clips: solo se guarda lo que sirve ---------------- */
const KICK_ID = /^clip_[A-Za-z0-9]{10,40}$/;
const TW_ID = /^[A-Za-z0-9_-]{1,100}$/;
const SLUG = /^[A-Za-z0-9_-]{1,40}$/;
function httpsUrl(v, hosts) {
  if (typeof v !== 'string' || v.length > 600) return '';
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return '';
    if (hosts && !hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return '';
    return u.toString();
  } catch (e) { return ''; }
}
function cleanClip(c) {
  if (!c || typeof c !== 'object') return null;
  const p = c.p === 'kick' || c.p === 'twitch' ? c.p : '';
  const id = String(c.id || '');
  if (!p || !(p === 'kick' ? KICK_ID : TW_ID).test(id)) return null;
  const ch = String(c.ch || '').toLowerCase();
  const out = {
    p, id,
    ch: SLUG.test(ch) ? ch : '',
    chd: str(c.chd, 40) || ch,
    t: str(c.t, 200),
    cr: str(c.cr, 40),
    cat: str(c.cat, 60),
    lang: str(c.lang, 12),
    v: Math.round(num(c.v, 0, 1e10, 0)),
    d: Math.round(num(c.d, 0, 3600, 0) * 10) / 10,
    at: Math.round(num(c.at, 0, 4102444800000, 0)),
    th: httpsUrl(c.th, ['kick.com', 'jtvnw.net', 'twitch.tv', 'twitchcdn.net', 'cloudfront.net']),
    f: c.f ? 1 : 0
  };
  if (p === 'kick') out.u = httpsUrl(c.u, ['kick.com']);   // el .m3u8 de Kick
  return out;
}
const ckey = c => c.p + ':' + c.id;

/* ---------------- ajustes de una playlist ---------------- */
const POS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
function cleanSet(s) {
  s = s && typeof s === 'object' ? s : {};
  const c = s.card && typeof s.card === 'object' ? s.card : {};
  const maxSec = num(s.maxSec, 0, 600, 0);
  return {
    shuffle: bool(s.shuffle, true),
    loop: bool(s.loop, true),
    sound: bool(s.sound, true),
    volume: Math.round(num(s.volume, 0, 100, 100)),
    normalize: bool(s.normalize, true),
    maxSec: [0, 15, 30, 45, 60, 90].indexOf(maxSec) >= 0 ? maxSec : 0,
    fit: pick(s.fit, ['contain', 'cover'], 'contain'),
    progress: bool(s.progress, false),
    msg: str(s.msg, MSG_MAX),
    card: {
      title: bool(c.title, true), channel: bool(c.channel, true), platform: bool(c.platform, true),
      creator: bool(c.creator, true), pos: pick(c.pos, POS, 'bottom-right'), by: pick(c.by, ['en', 'es'], 'en')
    }
  };
}
function cleanPl(p, old) {
  const seen = new Set(), clips = [];
  (Array.isArray(p.clips) ? p.clips : []).forEach(k => {
    k = String(k || '');
    const i = k.indexOf(':'), pf = k.slice(0, i), id = k.slice(i + 1);
    if ((pf === 'kick' && KICK_ID.test(id)) || (pf === 'twitch' && TW_ID.test(id))) {
      if (!seen.has(k) && clips.length < PL_CLIPS) { seen.add(k); clips.push(k); }
    }
  });
  return {
    id: old ? old.id : rid(8),
    name: str(p.name, 40) || (old && old.name) || 'Mi BRB',
    clips,
    set: cleanSet(p.set || (old && old.set)),
    rev: old ? (old.rev || 0) + 1 : 1,
    at: Date.now()
  };
}

/* ---------------- la pantalla (el player de OBS) ---------------- */
function newCtl(old) {
  return Object.assign({ seq: 0, cmd: '', at: 0, paused: false, muted: false, msg: null }, old || {});
}
async function screen(write) {
  let scr = parse(await redis('GET', 'brb:scr'));
  if (!scr || !scr.id) {
    scr = { id: rid(12), pl: '', revs: {}, ctl: newCtl() };
    if (write !== false) await setJSON('brb:scr', scr);
  }
  scr.ctl = newCtl(scr.ctl); scr.revs = scr.revs || {};
  return scr;
}
function pubScr(scr) { return { id: scr.id, pl: scr.pl, ctl: scr.ctl }; }
function syncRevs(scr, list) {
  const revs = {};
  list.forEach(p => { revs[p.id] = p.rev; });
  scr.revs = revs;
  if (!scr.pl || !revs[scr.pl]) scr.pl = list.length ? list[0].id : '';
}

/* ---------------- lo que pide el player ---------------- */
// Manifiesto: la playlist que suena (o la que pida la vista previa del estudio).
async function play(req, res, q) {
  const [scr, pls, lib] = await getMany('brb:scr', 'brb:pls', 'brb:lib');
  if (!scr || !scr.id || String(q.s || '') !== scr.id) return send(res, 404, { ok: false, error: 'Este link del BRB ya no sirve' });
  const list = (pls && pls.list) || [];
  const want = String(q.pl || '') || scr.pl;
  const pl = list.find(p => p.id === want) || list.find(p => p.id === scr.pl) || list[0] || null;
  const by = new Map(((lib && lib.clips) || []).map(c => [ckey(c), c]));
  const clips = pl ? pl.clips.map(k => by.get(k)).filter(Boolean) : [];
  return send(res, 200, { ok: true, pl: pl ? { id: pl.id, name: pl.name, rev: pl.rev, set: cleanSet(pl.set) } : null,
                          clips, ctl: newCtl(scr.ctl), active: scr.pl });
}
// Cada 3 s mientras la escena está al aire: una sola lectura de la base.
// De paso el player cuenta qué está sonando (solo se escribe cuando cambia).
let NOWC = { c: null, at: 0 };
async function tick(req, res, q) {
  const scr = parse(await redis('GET', 'brb:scr'));
  if (!scr || !scr.id || String(q.s || '') !== scr.id) return send(res, 404, { ok: false, error: 'Este link del BRB ya no sirve' });
  const c = str(q.c, 140), st = pick(q.st, ['play', 'pause', 'idle', 'load'], 'idle');
  const sig = c + '|' + st;
  if (sig !== NOWC.c || Date.now() - NOWC.at > 60000) {
    NOWC = { c: sig, at: Date.now() };
    try { await setJSON('brb:now', { c, st, pl: str(q.pl, 20), t: str(q.t, 200), at: Date.now() }); } catch (e) {}
  }
  return send(res, 200, { ok: true, pl: scr.pl || '', rev: (scr.revs || {})[scr.pl] || 0, ctl: newCtl(scr.ctl) });
}

/* ---------------- lo que pide el estudio ---------------- */
async function lib(req, res) {
  const [l, pls, scr0, now] = await getMany('brb:lib', 'brb:pls', 'brb:scr', 'brb:now');
  const scr = scr0 && scr0.id ? scr0 : await screen();
  return send(res, 200, { ok: true, clips: (l && l.clips) || [], pls: ((pls && pls.list) || []).map(p => Object.assign({}, p, { set: cleanSet(p.set) })),
                          scr: pubScr(Object.assign({ ctl: newCtl() }, scr, { ctl: newCtl(scr.ctl) })), now: now || null,
                          limits: { lib: LIB_MAX, pls: PL_MAX, clips: PL_CLIPS, msg: MSG_MAX } });
}
async function add(req, res, b) {
  const incoming = (Array.isArray(b.clips) ? b.clips : []).slice(0, 1000).map(cleanClip).filter(Boolean);
  const [l] = await getMany('brb:lib');
  const clips = (l && l.clips) || [];
  const idx = new Map(clips.map((c, i) => [ckey(c), i]));
  let added = 0, updated = 0, full = 0;
  const keys = [];
  incoming.forEach(c => {
    const k = ckey(c);
    if (idx.has(k)) {
      const old = clips[idx.get(k)];
      clips[idx.get(k)] = Object.assign({}, old, c, { u: c.u || old.u, th: c.th || old.th });
      updated++; keys.push(k);
    } else if (clips.length < LIB_MAX) {
      idx.set(k, clips.length); clips.push(c); added++; keys.push(k);
    } else full++;
  });
  if (added || updated) await setJSON('brb:lib', { v: 1, clips });
  // «Agregar también a la playlist»
  let pl = null;
  if (b.to && keys.length) {
    const [pls] = await getMany('brb:pls');
    const list = (pls && pls.list) || [];
    const old = list.find(p => p.id === String(b.to));
    if (old) {
      pl = cleanPl({ name: old.name, set: old.set, clips: old.clips.concat(keys.filter(k => old.clips.indexOf(k) < 0)) }, old);
      list[list.indexOf(old)] = pl;
      await setJSON('brb:pls', { v: 1, list });
      const scr = await screen(false); syncRevs(scr, list); await setJSON('brb:scr', scr);
    }
  }
  return send(res, 200, { ok: true, added, updated, full, total: clips.length, keys, pl });
}
async function del(req, res, b) {
  const [l] = await getMany('brb:lib');
  const clips = (l && l.clips) || [];
  const drop = new Set((Array.isArray(b.keys) ? b.keys : []).map(String));
  const chP = b.channel && b.channel.p, chN = b.channel && String(b.channel.ch || '').toLowerCase();
  const keep = clips.filter(c => !(drop.has(ckey(c)) || (chP && c.p === chP && (c.ch || '') === chN)));
  const removed = clips.length - keep.length;
  if (removed) await setJSON('brb:lib', { v: 1, clips: keep });
  return send(res, 200, { ok: true, removed, total: keep.length });
}
async function savePl(req, res, b) {
  const p = b.pl && typeof b.pl === 'object' ? b.pl : null;
  if (!p) return send(res, 400, { ok: false, error: 'falta la playlist' });
  const [pls] = await getMany('brb:pls');
  const list = (pls && pls.list) || [];
  let old = p.id ? list.find(x => x.id === String(p.id)) : null;
  if (p.id && !old) return send(res, 409, { ok: false, gone: true, error: 'Esa playlist ya no existe (la borraron desde otro lado)' });
  if (old && typeof b.rev === 'number' && b.rev !== old.rev)
    return send(res, 409, { ok: false, pl: old, error: 'La cambiaste desde otro celular o pestaña. Se cargó la versión más nueva.' });
  if (!old && list.length >= PL_MAX) return send(res, 400, { ok: false, error: 'Ya tienes ' + PL_MAX + ' playlists, el máximo. Borra una que no uses.' });
  const pl = cleanPl(p, old);
  if (old) list[list.indexOf(old)] = pl; else list.push(pl);
  await setJSON('brb:pls', { v: 1, list });
  const scr = await screen(false); syncRevs(scr, list); await setJSON('brb:scr', scr);
  return send(res, 200, { ok: true, pl, active: scr.pl });
}
async function delPl(req, res, b) {
  const [pls] = await getMany('brb:pls');
  const list = ((pls && pls.list) || []).filter(p => p.id !== String(b.id || ''));
  await setJSON('brb:pls', { v: 1, list });
  const scr = await screen(false); syncRevs(scr, list); await setJSON('brb:scr', scr);
  return send(res, 200, { ok: true, active: scr.pl });
}
// Controles (estudio y atajos del feed). El player los ve en su siguiente pregunta (≤ 3 s).
async function ctl(req, res, b) {
  const scr = await screen(false);
  const c = scr.ctl, cmd = String(b.cmd || '');
  const bump = name => { c.seq = (c.seq || 0) + 1; c.cmd = name; c.at = Date.now(); };
  if (cmd === 'next') bump('next');
  else if (cmd === 'prev') bump('prev');
  else if (cmd === 'pause') { c.paused = true; bump('pause'); }
  else if (cmd === 'play') { c.paused = false; bump('play'); }
  else if (cmd === 'pausetoggle') { c.paused = !c.paused; bump(c.paused ? 'pause' : 'play'); }
  else if (cmd === 'mute') { c.muted = true; bump('mute'); }
  else if (cmd === 'unmute') { c.muted = false; bump('unmute'); }
  else if (cmd === 'mutetoggle') { c.muted = !c.muted; bump(c.muted ? 'mute' : 'unmute'); }
  else if (cmd === 'msg') { c.msg = b.msg == null ? null : str(String(b.msg), MSG_MAX); bump('msg'); }
  else if (cmd === 'pl') {
    const [pls] = await getMany('brb:pls');
    const list = (pls && pls.list) || [];
    const id = String(b.pl || '');
    if (!list.some(p => p.id === id)) return send(res, 400, { ok: false, error: 'Esa playlist no existe' });
    scr.pl = id; syncRevs(scr, list); c.paused = false; bump('pl');
  } else if (cmd === 'reset') { scr.ctl = newCtl({ seq: (c.seq || 0) + 1, cmd: 'reset', at: Date.now() }); }
  else return send(res, 400, { ok: false, error: 'control desconocido' });
  await setJSON('brb:scr', scr);
  return send(res, 200, { ok: true, scr: pubScr(scr) });
}
async function state(req, res) {
  const [scr0, now, pls] = await getMany('brb:scr', 'brb:now', 'brb:pls');
  const scr = scr0 && scr0.id ? scr0 : await screen();
  const fresh = now && Date.now() - (now.at || 0) < 15000;   // el player avisa cada 3 s mientras está al aire
  return send(res, 200, { ok: true, scr: pubScr(Object.assign({}, scr, { ctl: newCtl(scr.ctl) })), now: now || null, onAir: !!fresh,
                          pls: ((pls && pls.list) || []).map(p => ({ id: p.id, name: p.name, n: p.clips.length })) });
}
async function newScreen(req, res) {
  const scr = await screen(false);
  scr.id = rid(12);
  await setJSON('brb:scr', scr);
  return send(res, 200, { ok: true, scr: pubScr(scr) });
}

/* ---------------- OBS: crear la escena y la fuente ---------------- */
// La conexión con OBS es la misma que ya configuraste en el feed
// (⚙ → Conexión con OBS); su contraseña está guardada cifrada.
function obsKey() { return crypto.createHash('sha256').update('obs:' + (CLIENT_SECRET || R_TOK || 'kick-feed')).digest(); }
function obsOpen(s) {
  if (!s) return '';
  if (!String(s).startsWith('g1:')) return String(s);
  const b = Buffer.from(String(s).slice(3), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', obsKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
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
    tm = setTimeout(() => fin(new Error('OBS no contestó: revisa que esté prendido')), ms || 10000);
    try { ws = new WebSocket(url); } catch (e) { return fin(new Error('La dirección de OBS no es válida')); }
    ws.onerror = () => fin(new Error('No se pudo conectar con OBS: revisa que esté prendido'));
    ws.onclose = ev => fin(new Error(ev && ev.code === 4009 ? 'La contraseña de OBS no coincide' : 'OBS cerró la conexión'));
    const batch = reqs => new Promise(ok => {
      if (!reqs.length) return ok([]);
      const id = 'brb' + (++n); pending[id] = ok;
      ws.send(JSON.stringify({ op: 8, d: { requestId: id, haltOnFailure: false, executionType: 0,
        requests: reqs.map((r, i) => ({ requestType: r[0], requestId: String(i), requestData: r[1] || {} })) } }));
    });
    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); } catch (e) { return; }
      if (m.op === 0) {
        const d = { rpcVersion: 1, eventSubscriptions: 0 };
        const a = m.d && m.d.authentication;
        if (a) {
          if (!pass) return fin(new Error('OBS pide contraseña: escríbela en el feed (⚙ → Conexión con OBS)'));
          const secret = crypto.createHash('sha256').update(pass + a.salt).digest('base64');
          d.authentication = crypto.createHash('sha256').update(secret + a.challenge).digest('base64');
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (m.op === 2) {
        Promise.resolve().then(() => work(batch)).then(v => fin(null, v), e => fin(e));
      } else if (m.op === 9) {
        const cb = m.d && pending[m.d.requestId];
        if (cb) { delete pending[m.d.requestId]; cb((m.d && m.d.results) || []); }
      }
    };
  });
}
const okOf = r => !!(r && r.requestStatus && r.requestStatus.result);
const dataOf = r => (r && r.responseData) || {};
const errOf = r => (r && r.requestStatus && (r.requestStatus.comment || ('código ' + r.requestStatus.code))) || 'OBS no pudo';
async function obs(req, res, b) {
  const cfg = parse(await redis('GET', 'obs'));
  if (!cfg || !cfg.url) return send(res, 200, { ok: false, configured: false, error: 'Primero conecta tu OBS en el feed (⚙ → Conexión con OBS)' });
  let pass = '';
  try { pass = obsOpen(cfg.p); } catch (e) { return send(res, 200, { ok: false, error: 'Vuelve a escribir la contraseña de OBS en el feed (⚙ → Conexión con OBS)' }); }
  const act = String(b.act || 'scenes');
  if (act === 'scenes') {
    try {
      const out = await obsSession(cfg.url, pass, async batch => {
        const [sl, il] = await batch([['GetSceneList'], ['GetInputList', { inputKind: 'browser_source' }]]);
        return { scenes: (dataOf(sl).scenes || []).slice().sort((x, y) => (y.sceneIndex || 0) - (x.sceneIndex || 0)).map(s => s.sceneName),
                 current: dataOf(sl).currentProgramSceneName || '', browsers: (dataOf(il).inputs || []).map(i => i.inputName) };
      });
      return send(res, 200, Object.assign({ ok: true }, out));
    } catch (e) { return send(res, 200, { ok: false, error: e.message }); }
  }
  if (act !== 'add') return send(res, 400, { ok: false, error: 'acción rara' });
  const scene = str(b.scene, 80) || 'BRB Clips';
  const name = str(b.name, 80) || 'BRB Clips TQ';
  const url = httpsUrl(b.url) || (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/.test(String(b.url || '')) ? String(b.url) : '');   // localhost: solo para pruebas
  if (!url) return send(res, 400, { ok: false, error: 'falta el link del player' });
  const settings = { url, width: 1920, height: 1080, fps_custom: false, reroute_audio: true, shutdown: true, restart_when_active: true, css: '' };
  try {
    const out = await obsSession(cfg.url, pass, async batch => {
      const [sl, il, vs] = await batch([['GetSceneList'], ['GetInputList'], ['GetVideoSettings']]);
      const scenes = (dataOf(sl).scenes || []).map(s => s.sceneName);
      const inputs = (dataOf(il).inputs || []);
      const steps = [];
      let madeScene = false, madeSource = false;
      if (scenes.indexOf(scene) < 0) {
        const [r] = await batch([['CreateScene', { sceneName: scene }]]);
        if (!okOf(r)) throw new Error('No se pudo crear la escena: ' + errOf(r));
        madeScene = true; steps.push('Escena «' + scene + '» creada');
      }
      const exists = inputs.find(i => i.inputName === name);
      if (exists && exists.inputKind !== 'browser_source') throw new Error('Ya tienes una fuente llamada «' + name + '» que no es de navegador. Usa otro nombre.');
      let itemId = null;
      if (!exists) {
        const [r] = await batch([['CreateInput', { sceneName: scene, inputName: name, inputKind: 'browser_source', inputSettings: settings, sceneItemEnabled: true }]]);
        if (!okOf(r)) throw new Error('No se pudo crear la fuente: ' + errOf(r));
        itemId = dataOf(r).sceneItemId; madeSource = true; steps.push('Fuente «' + name + '» creada');
      } else {
        const [r1, r2] = await batch([['SetInputSettings', { inputName: name, inputSettings: settings, overlay: true }],
                                      ['GetSceneItemId', { sceneName: scene, sourceName: name }]]);
        if (!okOf(r1)) throw new Error('No se pudo actualizar la fuente: ' + errOf(r1));
        steps.push('Fuente «' + name + '» actualizada con el link nuevo');
        if (okOf(r2)) itemId = dataOf(r2).sceneItemId;
        else {
          const [r3] = await batch([['CreateSceneItem', { sceneName: scene, sourceName: name, sceneItemEnabled: true }]]);
          if (!okOf(r3)) throw new Error('No se pudo poner la fuente en la escena: ' + errOf(r3));
          itemId = dataOf(r3).sceneItemId; steps.push('Puesta en «' + scene + '»');
        }
      }
      // que llene toda la pantalla de OBS, sea del tamaño que sea
      const v = dataOf(vs);
      if (itemId != null && v.baseWidth && v.baseHeight) {
        await batch([
          ['SetSceneItemTransform', { sceneName: scene, sceneItemId: itemId, sceneItemTransform: {
            positionX: 0, positionY: 0, rotation: 0, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0,
            boundsWidth: v.baseWidth, boundsHeight: v.baseHeight, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 } }],
          ['SetSceneItemEnabled', { sceneName: scene, sceneItemId: itemId, sceneItemEnabled: true }]
        ]);
      }
      return { scene, name, madeScene, madeSource, steps };
    }, 15000);
    return send(res, 200, Object.assign({ ok: true }, out));
  } catch (e) { return send(res, 200, { ok: false, error: e.message }); }
}

/* ---------------- entrada ---------------- */
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const q = req.query || {};
  const a = String(q.a || '').toLowerCase();
  try {
    if (a === 'play') return await play(req, res, q);
    if (a === 'tick') return await tick(req, res, q);
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'usa POST' });
    const b = await readJSONBody(req);
    if (!(await checkKey(b.key || q.key))) return send(res, 403, { ok: false, error: 'La clave 🔑 no coincide' });
    if (a === 'lib') return await lib(req, res);
    if (a === 'add') return await add(req, res, b);
    if (a === 'del') return await del(req, res, b);
    if (a === 'pl') return await savePl(req, res, b);
    if (a === 'pldel') return await delPl(req, res, b);
    if (a === 'ctl') return await ctl(req, res, b);
    if (a === 'state') return await state(req, res);
    if (a === 'obs') return await obs(req, res, b);
    if (a === 'newscreen') return await newScreen(req, res);
    return send(res, 404, { ok: false, error: 'ruta desconocida' });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
};
