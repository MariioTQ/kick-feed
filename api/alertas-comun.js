/* ==================================================================
   ALERTAS · lo que comparten el Studio (alertas.html) y el player (alertas-player.html)
   - Sonidos de la app: se arman aquí mismo (sin archivos) y todos con el mismo volumen.
   - Dibujos de la app: íconos animados por tipo de alerta.
   - Cómo se arma y se ve una alerta, y cómo suena (con el volumen parejo).
   ================================================================== */
(function () {
'use strict';
var API = 'https://kick-feed-mariotq.vercel.app/api/alertas';
var TYPES = ['sub', 'resub', 'gift', 'kicks', 'bits', 'raid', 'follow', 'tip', 'reward'];
var ONLY = { kicks: 'kick', tip: 'kick', bits: 'tw', reward: 'tw' };
var NAMES = { sub: 'Sub nueva', resub: 'Renovación', gift: 'Subs de regalo', kicks: 'Kicks', bits: 'Bits', raid: 'Raid', follow: 'Follow', tip: 'Donación', reward: 'Recompensa' };
var EMO = { sub: '⭐', resub: '🔁', gift: '🎁', kicks: '⚡', bits: '💎', raid: '🚀', follow: '💚', tip: '💵', reward: '🎯' };
var VARS = { sub: ['nombre', 'plataforma'], resub: ['nombre', 'meses', 'mensaje', 'plataforma'], gift: ['nombre', 'cantidad', 'plataforma'],
             kicks: ['nombre', 'cantidad', 'mensaje'], bits: ['nombre', 'cantidad', 'mensaje'], raid: ['nombre', 'cantidad', 'plataforma'],
             follow: ['nombre', 'plataforma'], tip: ['nombre', 'cantidad', 'mensaje'], reward: ['nombre', 'cantidad', 'mensaje'] };
var PFC = { kick: '#53fc18', tw: '#9146ff' };
var TARGET = 0.09;          // el «volumen parejo»: todos los sonidos a este nivel (RMS)

/* ---------------- sonidos de la app (se arman con el navegador) ---------------- */
var SND_NAMES = { fanfarria: 'Fanfarria', campana: 'Campanitas', magia: 'Magia', monedas: 'Monedas', tambor: 'Redoble', pop: 'Pop', caja: 'Caja registradora', level: 'Subir de nivel', cohete: 'Cohete', nada: 'Sin sonido' };
function noise(ctx, len) { var b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function tone(ctx, type, f, t, dur, vol, f2) {
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.05);
}
function bell(ctx, f, t, dur, vol) { [[1, 1], [2.76, .45], [5.4, .22], [8.9, .1]].forEach(function (p) { tone(ctx, 'sine', f * p[0], t, dur / p[0] * 1.6, vol * p[1]); }); }
function noiseHit(ctx, t, dur, vol, type, f, q, f2) {
  var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(ctx, dur + 0.1); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || 1;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(ctx.destination); s.start(t); s.stop(t + dur + 0.05);
}
var SYN = {
  fanfarria: { len: 2.2, f: function (c) { var n = [523.25, 659.25, 783.99, 1046.5]; n.forEach(function (f, i) { tone(c, 'sawtooth', f, 0.02 + i * 0.11, 0.22, 0.18); });
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { tone(c, 'sawtooth', f, 0.5, 1.5, 0.11); tone(c, 'triangle', f / 2, 0.5, 1.5, 0.1); }); } },
  campana: { len: 2.4, f: function (c) { bell(c, 1318.5, 0.02, 1.2, 0.3); bell(c, 1760, 0.22, 1.6, 0.3); bell(c, 2093, 0.42, 1.8, 0.25); } },
  magia: { len: 2.0, f: function (c) { for (var i = 0; i < 14; i++) tone(c, 'sine', 900 + i * 140 + Math.random() * 60, 0.02 + i * 0.07, 0.35, 0.12);
    noiseHit(c, 0.05, 1.4, 0.05, 'highpass', 7000, 0.7); } },
  monedas: { len: 1.6, f: function (c) { [0, 0.22, 0.44].forEach(function (t) { tone(c, 'square', 987.77, 0.02 + t, 0.07, 0.14); tone(c, 'square', 1318.5, 0.09 + t, 0.32, 0.14); }); } },
  tambor: { len: 2.6, f: function (c) { for (var i = 0; i < 22; i++) noiseHit(c, 0.02 + i * 0.055, 0.06, 0.08 + i * 0.012, 'bandpass', 1800, 0.8);
    tone(c, 'sine', 130, 1.25, 0.6, 0.6, 50); noiseHit(c, 1.25, 1.2, 0.35, 'highpass', 5000, 0.5); } },
  pop: { len: 0.6, f: function (c) { tone(c, 'sine', 880, 0.01, 0.18, 0.5, 220); tone(c, 'sine', 1320, 0.12, 0.2, 0.35, 440); } },
  caja: { len: 1.8, f: function (c) { noiseHit(c, 0.01, 0.08, 0.5, 'highpass', 2500, 0.8); noiseHit(c, 0.14, 0.06, 0.4, 'highpass', 3000, 0.8); bell(c, 2637, 0.26, 1.3, 0.35); bell(c, 3520, 0.3, 1.1, 0.2); } },
  level: { len: 1.4, f: function (c) { [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach(function (f, i) { tone(c, 'square', f, 0.02 + i * 0.075, 0.12, 0.12); }); tone(c, 'square', 2093, 0.5, 0.6, 0.11); } },
  cohete: { len: 2.0, f: function (c) { noiseHit(c, 0.02, 1.4, 0.4, 'bandpass', 300, 1.2, 4000); tone(c, 'sawtooth', 200, 0.05, 1.3, 0.06, 1600); noiseHit(c, 1.35, 0.5, 0.3, 'lowpass', 900, 0.7); } }
};
function wav(buf) {
  var d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab), sr = buf.sampleRate;
  function w(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (var i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([ab], { type: 'audio/wav' });
}
// qué tan fuerte se oye: el pedazo de 0.4 s más fuerte (RMS)
function loud(data, sr) {
  var win = Math.max(1, Math.floor(sr * 0.4)), sum = 0, best = 0, i;
  for (i = 0; i < data.length; i++) { sum += data[i] * data[i]; if (i >= win) sum -= data[i - win] * data[i - win]; if (i >= win - 1) best = Math.max(best, sum / win); }
  if (data.length < win) best = sum / Math.max(1, data.length);
  return Math.sqrt(Math.max(0, best));
}
var SYNC = {};
function synthUrl(name) {
  if (!SYN[name]) return Promise.resolve('');
  if (SYNC[name]) return SYNC[name];
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return Promise.resolve('');
  var sr = 32000, c = new OAC(1, Math.ceil(sr * SYN[name].len), sr);
  SYN[name].f(c);
  SYNC[name] = c.startRendering().then(function (buf) {
    var d = buf.getChannelData(0), l = loud(d, sr), pk = 0, i;
    for (i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
    var k = Math.min(TARGET / Math.max(1e-4, l), 0.97 / Math.max(1e-4, pk));
    for (i = 0; i < d.length; i++) d[i] *= k;
    return URL.createObjectURL(wav(buf));
  }).catch(function () { return ''; });
  return SYNC[name];
}
// para tus archivos: cuánto bajarle para que suene igual que los demás (0.05 a 1)
function measure(arrayBuffer) {
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return Promise.resolve(1);
  var c = new AC();
  return new Promise(function (ok) {
    var done = function (buf) { try { c.close(); } catch (e) {}
      if (!buf) return ok(1);
      var d = buf.getChannelData(0); if (buf.numberOfChannels > 1) { var d2 = buf.getChannelData(1), m = new Float32Array(d.length); for (var i = 0; i < d.length; i++) m[i] = (d[i] + d2[i]) / 2; d = m; }
      ok(Math.max(0.05, Math.min(1, TARGET / Math.max(1e-4, loud(d, buf.sampleRate))))); };
    try { var p = c.decodeAudioData(arrayBuffer, done, function () { done(null); }); if (p && p.catch) p.catch(function () { done(null); }); } catch (e) { done(null); }
  });
}

/* ---------------- dibujos de la app ---------------- */
var IMG_NAMES = { corona: 'Corona', estrella: 'Estrella', regalo: 'Regalo', rayo: 'Rayo', gema: 'Gema', cohete: 'Cohete', corazon: 'Corazón', billete: 'Billete', puntos: 'Puntos', nada: 'Sin imagen' };
var IMG = {
  corona: '<path d="m3 8 4.5 6L12 5l4.5 9L21 8l-2 11H5z"/><rect x="5" y="20" width="14" height="2.2" rx="1.1"/>',
  estrella: '<path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.4l-6.1 3.5 1.5-6.8L2.2 9.5l6.9-.7z"/>',
  regalo: '<path d="M3 9h18v4H3zM4.5 13h15v8h-15z"/><path d="M12 9v12" stroke="rgba(0,0,0,.25)" stroke-width="2"/><path d="M12 9C9 9 6.5 7.8 6.5 5.8 6.5 4 8.6 3.3 10 4.6 11.2 5.7 12 9 12 9zm0 0c3 0 5.5-1.2 5.5-3.2 0-1.8-2.1-2.5-3.5-1.2C12.8 5.7 12 9 12 9z"/>',
  rayo: '<path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/>',
  gema: '<path d="M7 3h10l4.5 6L12 21.5 2.5 9z"/><path d="M2.5 9h19M9 3l3 18.5M15 3l-3 18.5" stroke="rgba(0,0,0,.18)" stroke-width="1.2" fill="none"/>',
  cohete: '<path d="M14.5 3.5c3-.9 5.4-.6 6 0 .6.6.9 3-.1 6-1 3-3.4 5.6-6.4 7.4l-1.8 3.6-2.2-2.2-1.6 1.6-2.4-2.4 1.6-1.6-2.2-2.2 3.6-1.8C10.8 6.9 11.5 4.5 14.5 3.5z"/><circle cx="16" cy="8" r="1.8" fill="rgba(0,0,0,.3)"/><path d="M5 15c-2 1-2.5 3.5-2.5 6.5 3 0 5.5-.5 6.5-2.5z" fill="#ffb020"/>',
  corazon: '<path d="M12 21s-8.5-5.3-8.5-11.2C3.5 6.6 5.8 4.5 8.5 4.5c1.6 0 2.8.8 3.5 2 .7-1.2 1.9-2 3.5-2 2.7 0 5 2.1 5 5.3C20.5 15.7 12 21 12 21z"/>',
  billete: '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><circle cx="12" cy="12" r="3.2" fill="rgba(0,0,0,.22)"/><path d="M5 9h1.5M17.5 15H19" stroke="rgba(0,0,0,.22)" stroke-width="1.6"/>',
  puntos: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M8.5 9.5h5a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h5" stroke="rgba(0,0,0,.3)" stroke-width="1.8" fill="none"/>'
};
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nfmt(n) { return typeof n === 'number' ? n.toLocaleString('es-MX') : String(n == null ? '' : n); }
function iconSvg(name) { return IMG[name] ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + IMG[name] + '</svg>' : ''; }

/* ---------------- armar una alerta ---------------- */
function mediaUrl(v, api) {
  v = String(v || '');
  if (/^f:/.test(v)) return (api || API) + '?a=f&id=' + v.slice(2);
  if (/^u:/.test(v)) return v.slice(2);
  return '';
}
function isVideo(v, files) { if (/^f:/.test(v)) { var f = files && files[v.slice(2)]; return !!(f && f.kind === 'video'); } return /^u:.*\.(webm|mp4)(\?|$)/i.test(v); }
// la alerta que toca (y su variación por cantidad: «500 Kicks o más»)
function spec(cfg, al, vi) {
  var pf = al.pf === 'tw' ? 'tw' : 'kick', t = cfg && cfg.pf && cfg.pf[pf] && cfg.pf[pf][al.k];
  if (!t) return null;
  var o = { on: t.on, min: t.min, text: t.text, sub: t.sub, img: t.img, snd: t.snd, vol: t.vol, norm: t.norm, dur: t.dur, tts: t.tts, anim: t.anim, color: t.color || PFC[pf], pf: pf, k: al.k };
  var n = typeof al.n === 'number' ? al.n : 0, v = null;
  if (vi !== -1) (t.vars || []).forEach(function (x, i) { if (vi != null && vi >= 0 ? i === vi : n >= x.min) v = x; });   // -1 = la normal (sin variación)
  if (v) { ['text', 'sub', 'img', 'snd'].forEach(function (k) { if (v[k]) o[k] = v[k]; }); if (v.img || v.snd) o.norm = v.snd ? (v.norm || 1) : o.norm; if (v.vol != null) o.vol = v.vol; if (v.dur != null) o.dur = v.dur; }
  return o;
}
function fill(tpl, al, html) {
  var n = al.n, map = { nombre: al.u || 'Anónimo', cantidad: nfmt(n), meses: nfmt(n), mensaje: al.m || '', recompensa: typeof n === 'string' ? n : '', plataforma: al.pf === 'tw' ? 'Twitch' : 'Kick' };
  return String(tpl || '').replace(/\{(nombre|cantidad|meses|mensaje|recompensa|plataforma)\}/g, function (m, k) {
    var v = map[k]; if (!html) return v;
    return k === 'nombre' ? '<b class="nm">' + esc(v) + '</b>' : (k === 'cantidad' || k === 'meses') ? '<b class="am">' + esc(v) + '</b>' : esc(v);
  }).replace(/\s*·\s*$/, '').replace(/^\s*·\s*/, '');
}
function build(sp, al, cfg, files, api) {
  var el = document.createElement('div');
  el.className = 'alc look-' + ((cfg && cfg.look) || 'tarjeta') + ' anim-' + (sp.anim || 'pop') + ' t-' + sp.k + ' pf-' + sp.pf;
  el.style.setProperty('--ac', sp.color || PFC[sp.pf]);
  var m = '', img = String(sp.img || '');
  if (/^b:/.test(img) && img !== 'b:nada') {
    var conf = ''; for (var i = 0; i < 14; i++) conf += '<i style="--i:' + i + ';--x:' + (Math.round(Math.random() * 200 - 100)) + ';--r:' + (Math.round(Math.random() * 720 - 360)) + 'deg"></i>';
    m = '<div class="alc-ic"><span class="alc-glow"></span><span class="alc-tile">' + iconSvg(img.slice(2)) + '</span><span class="alc-conf">' + conf + '</span></div>';
  } else if (/^[fu]:/.test(img)) {
    var u = esc(mediaUrl(img, api));
    m = '<div class="alc-md">' + (isVideo(img, files) ? '<video src="' + u + '" autoplay muted loop playsinline></video>' : '<img src="' + u + '" alt="">') + '</div>';
  }
  var t = fill(sp.text, al, true), s = fill(sp.sub, al, true);
  el.innerHTML = m + '<div class="alc-tx"><div class="alc-t">' + t + '</div>' + (s ? '<div class="alc-s">' + s + '</div>' : '') + '</div>';
  return el;
}

/* ---------------- que suene ---------------- */
function sndUrl(v, api) { v = String(v || ''); if (/^b:/.test(v)) return synthUrl(v.slice(2)); return Promise.resolve(mediaUrl(v, api)); }
function playUrl(url, vol) {
  return new Promise(function (ok) {
    if (!url || vol <= 0) return ok(0);
    var a = new Audio(); a.preload = 'auto'; a.src = url; a.volume = Math.max(0, Math.min(1, vol));
    var t0 = Date.now(), fin = function () { ok((Date.now() - t0) / 1000); };
    a.onended = fin; a.onerror = fin;
    var p = a.play(); if (p && p.catch) p.catch(fin);
    setTimeout(fin, 20000);
  });
}
function playSnd(sp, cfg, mult, api) {
  var vol = ((cfg && cfg.vol != null ? cfg.vol : 80) / 100) * ((sp.vol != null ? sp.vol : 80) / 100) * (sp.norm || 1) * (mult == null ? 1 : mult);
  return sndUrl(sp.snd, api).then(function (u) { return playUrl(u, vol); });
}
var TTS_URL = 'https://translate.google.com.mx/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=';
function say(text, cfg, mult) {
  text = String(text || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, (cfg && cfg.ttsMax) || 140);
  if (!text) return Promise.resolve(0);
  return playUrl(TTS_URL + encodeURIComponent(text), ((cfg && cfg.ttsVol != null ? cfg.ttsVol : 80) / 100) * (mult == null ? 1 : mult));
}

/* ---------------- cómo se ve (lo usan el Studio y el player) ---------------- */
var CSS = [
'.alc{--ac:#53fc18;position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;max-width:min(92vw,760px);margin:0 auto;font-family:Onest,"Inter","Segoe UI",Roboto,system-ui,sans-serif;color:#fff;text-align:center}',
'.alc-ic{position:relative;width:150px;height:150px;display:grid;place-items:center}',
'.alc-tile{position:relative;z-index:2;width:118px;height:118px;border-radius:32px;display:grid;place-items:center;color:#fff;background:var(--ac);background-image:linear-gradient(150deg,rgba(255,255,255,.38),rgba(255,255,255,0) 55%,rgba(0,0,0,.22));box-shadow:0 14px 34px -10px var(--ac),inset 0 1px 0 rgba(255,255,255,.35);animation:alcBob 2.4s ease-in-out infinite}',
'.pf-kick .alc-tile{color:#0e0f13}',
'.alc-tile svg{width:62%;height:62%;filter:drop-shadow(0 3px 4px rgba(0,0,0,.25))}',
'.alc-glow{position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(closest-side,var(--ac),transparent);opacity:.55;filter:blur(8px);animation:alcPulse 1.6s ease-in-out infinite}',
'.alc-conf{position:absolute;inset:0;z-index:3;pointer-events:none}',
'.alc-conf i{position:absolute;left:50%;top:50%;width:8px;height:12px;border-radius:2px;background:var(--ac);opacity:0;animation:alcConf 1.4s cubic-bezier(.2,.7,.3,1) forwards;animation-delay:calc(var(--i) * 25ms)}',
'.alc-conf i:nth-child(3n){background:#ffd23f}.alc-conf i:nth-child(3n+1){background:#fff}',
'.alc-md img,.alc-md video{display:block;max-width:min(80vw,420px);max-height:44vh;border-radius:14px}',
'.alc-tx{display:flex;flex-direction:column;align-items:center;gap:6px}',
'.alc-t{font-weight:800;font-size:38px;line-height:1.12;letter-spacing:-.01em;text-shadow:0 2px 0 rgba(0,0,0,.45),0 4px 18px rgba(0,0,0,.55);padding:0 10px}',
'.alc-t .nm{color:var(--ac);font-weight:900}',
'.alc-t .am{color:#ffd23f;font-weight:900}',
'.alc-s{font-weight:600;font-size:22px;line-height:1.3;max-width:640px;color:rgba(255,255,255,.92);text-shadow:0 2px 8px rgba(0,0,0,.7)}',
'.look-tarjeta .alc-tx{background:rgba(12,14,19,.82);border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:16px 22px 18px;box-shadow:0 16px 40px rgba(0,0,0,.5);position:relative;overflow:hidden}',
'.look-tarjeta .alc-tx::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--ac)}',
'.look-tarjeta .alc-t{font-size:32px;text-shadow:none}',
'.look-tarjeta .alc-s{font-size:19px;text-shadow:none;color:rgba(255,255,255,.82)}',
'.look-neon .alc-t{font-size:40px;-webkit-text-stroke:1px rgba(0,0,0,.35);text-shadow:0 0 8px var(--ac),0 0 22px var(--ac),0 3px 0 rgba(0,0,0,.5)}',
'.look-neon .alc-t .nm{color:#fff}',
'.look-neon .alc-tile{box-shadow:0 0 0 3px #fff,0 0 30px var(--ac),0 0 60px var(--ac)}',
'.alc.anim-pop{animation:alcPop .7s cubic-bezier(.2,1.5,.4,1) both}',
'.alc.anim-sube{animation:alcUp .7s cubic-bezier(.2,1.1,.3,1) both}',
'.alc.anim-zoom{animation:alcZoom .8s cubic-bezier(.2,1,.3,1) both}',
'.alc.anim-gira{animation:alcSpin .9s cubic-bezier(.2,1.2,.3,1) both}',
'.alc.out{animation:alcOut .5s ease-in both!important}',
'@keyframes alcPop{0%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:none}}',
'@keyframes alcUp{0%{opacity:0;transform:translateY(60px)}100%{opacity:1;transform:none}}',
'@keyframes alcZoom{0%{opacity:0;transform:scale(2.2);filter:blur(10px)}100%{opacity:1;transform:none;filter:none}}',
'@keyframes alcSpin{0%{opacity:0;transform:rotate(-200deg) scale(.3)}100%{opacity:1;transform:none}}',
'@keyframes alcOut{to{opacity:0;transform:scale(.85) translateY(20px)}}',
'@keyframes alcBob{50%{transform:translateY(-6px) rotate(-3deg)}}',
'@keyframes alcPulse{50%{opacity:.25;transform:scale(1.12)}}',
'@keyframes alcConf{0%{opacity:1;transform:translate(-50%,-50%) rotate(0)}100%{opacity:0;transform:translate(calc(-50% + var(--x) * 1.3px),calc(-50% - 120px + var(--i) * 9px)) rotate(var(--r))}}',
'.sz-chica .alc{transform-origin:center;zoom:.72}.sz-grande .alc{zoom:1.25}'
].join('\n');
function injectCss() { if (document.getElementById('alcCss')) return; var st = document.createElement('style'); st.id = 'alcCss'; st.textContent = CSS; document.head.appendChild(st); }

window.ALC = { API: API, TYPES: TYPES, ONLY: ONLY, NAMES: NAMES, EMO: EMO, VARS: VARS, PFC: PFC, SND_NAMES: SND_NAMES, IMG_NAMES: IMG_NAMES,
  synthUrl: synthUrl, measure: measure, iconSvg: iconSvg, spec: spec, fill: fill, build: build, playSnd: playSnd, playUrl: playUrl, say: say,
  mediaUrl: mediaUrl, injectCss: injectCss, esc: esc, nfmt: nfmt };
})();
