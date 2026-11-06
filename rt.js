/* ==================================================================
   TIEMPO REAL · rt.js (lo usan tu app, el player de alertas, el letrero
   de la meta y el BRB)

   Antes cada página le preguntaba a tu servidor cada 2, 3, 5 o 15 s
   «¿hay algo nuevo?», aunque no hubiera nada. Eso es lo que gastaba
   Vercel y Upstash. Ahora tu servidor avisa UNA vez a Ably cuando pasa
   algo y Ably se lo entrega al momento a todas tus páginas.

   Seguro: antes de dejar de preguntar seguido, cada página comprueba que
   de verdad le llegan los avisos (un «ping» que manda tu servidor por
   Ably). Si Ably no carga, se cae o no contesta, la página vuelve sola a
   preguntar como antes. Nunca se queda sin avisos.

   La llave de Ably NO está aquí: tu servidor da un permiso de «solo
   escuchar» que dura 6 h y la librería lo renueva sola.
   ================================================================== */
(function () {
  'use strict';
  if (window.KFRT) return;
  var SDK = ['https://cdn.jsdelivr.net/npm/ably@2.29.0/build/ably.min.js',
             'https://unpkg.com/ably@2.29.0/build/ably.min.js'];
  var loading = null;
  function loadSdk() {
    if (window.Ably && window.Ably.Realtime) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(function (ok) {
      var i = 0;
      (function next() {
        if (i >= SDK.length) { loading = null; return ok(false); }
        var s = document.createElement('script');
        s.src = SDK[i++]; s.async = true;
        s.onload = function () { if (window.Ably && window.Ably.Realtime) ok(true); else next(); };
        s.onerror = function () { try { s.remove(); } catch (e) {} next(); };
        (document.head || document.documentElement).appendChild(s);
      })();
    });
    return loading;
  }
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // opt: { api: 'https://…vercel.app', on: function(nombre, datos){}, state: function(sirve){}, log: function(txt){}, key: 'tu clave' }
  // v88: con «key» (solo tu app) también escucha el canal privado «kfp» (bans, spam, escena, canjes, ajustes…).
  // Los letreros de OBS no llevan clave: solo el canal público «kf», como siempre.
  function start(opt) {
    var api = String(opt.api || '').replace(/\/+$/, '');
    var R = { ok: false, down: false, client: null, ch: null, pingId: '', pingT: 0, reT: 0, tries: 0, last: 0, dead: false, got: 0 };
    function log(t) { try { if (opt.log) opt.log(t); } catch (e) {} }
    function setOk(v) {
      if (R.ok === v) return;
      R.ok = v;
      try { if (opt.state) opt.state(v); } catch (e) {}
    }
    // ¿de verdad llegan los avisos? tu servidor manda un ping por Ably y se espera que llegue
    function ping() {
      clearTimeout(R.pingT);
      if (R.dead || !R.client || R.client.connection.state !== 'connected') return;
      var id = rid(); R.pingId = id;
      fetch(api + '/api/rt?a=ping&id=' + id, { cache: 'no-store', credentials: 'omit' }).catch(function () {});
      R.pingT = setTimeout(function () {
        if (R.pingId !== id) return;
        R.pingId = ''; R.tries++;
        setOk(false);
        log('tiempo real: el aviso de prueba no llegó (se sigue preguntando como antes)');
        R.reT = setTimeout(ping, Math.min(15, R.tries * 2) * 60000);      // reintenta: 2, 4, 6… hasta cada 15 min
      }, 10000);
    }
    function onMsg(m) {
      var d = m && m.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) {} }
      R.last = Date.now();
      if (m.name === 'ping') {
        if (d && d.id && d.id === R.pingId) {
          clearTimeout(R.pingT); R.pingId = ''; R.tries = 0; R.fails = 0;
          if (!R.ok) log('tiempo real: conectado ✓');
          setOk(true);
          clearTimeout(R.reT); R.reT = setTimeout(ping, 30 * 60000);       // y se vuelve a comprobar cada 30 min
        }
        return;
      }
      R.got++;
      try { opt.on(m.name, d || {}); } catch (e) {}
    }
    function boot() {
      loadSdk().then(function (ok) {
        if (R.dead) return;
        if (!ok) { log('tiempo real: no cargó Ably (se sigue preguntando como antes)'); setOk(false); R.reT = setTimeout(boot, 5 * 60000); return; }
        var me;
        try {
          var ao = { authUrl: api + '/api/rt', authMethod: 'GET', echoMessages: false, closeOnUnload: true };
          if (opt.key) ao.authParams = { key: String(opt.key) };   // v88: tu clave va aparte (no en la dirección)
          me = R.client = new window.Ably.Realtime(ao);
        } catch (e) { return restart(e && e.message); }
        if (opt.key) {                                              // v88: el privado; si falla, el público sigue igual
          try { var pv = R.client.channels.get('kfp').subscribe(onMsg); if (pv && pv.then) pv.then(null, function (e) { log('tiempo real: el canal privado no se pudo escuchar (' + ((e && e.message) || 'sin permiso') + ')'); }); } catch (e) {}
        }
        R.ch = R.client.channels.get('kf');
        var sub = R.ch.subscribe(onMsg);
        if (sub && sub.then) sub.then(function () { if (R.client === me) ping(); }, function (e) { if (R.client === me) restart(e && e.message); });
        R.client.connection.on(function (st) {
          if (R.client !== me) return;                   // una conexión vieja que ya se cerró
          var s = st && st.current;
          if (s === 'failed') return restart('la conexión falló');   // de «failed» Ably no se recupera solo: se arma de nuevo
          if (s === 'connected') { if (R.down) { R.down = false; clearTimeout(R.reT); R.reT = setTimeout(ping, 1500); } }     // volvió: se comprueba otra vez
          else if (s === 'disconnected' || s === 'suspended' || s === 'failed' || s === 'closed') { R.down = true; clearTimeout(R.pingT); R.pingId = ''; setOk(false); }
        });
      });
    }
    // v80: si no se pudo escuchar el canal o la conexión quedó en «failed», se vuelve a armar sola (2, 5, 10 y luego cada 15 min)
    function restart(why) {
      if (R.dead) return;
      log('tiempo real: ' + (why || 'se cayó') + ' (se reintenta solo; mientras, se pregunta como antes)');
      clearTimeout(R.pingT); R.pingId = ''; setOk(false);
      var old = R.client; R.client = null; R.ch = null;
      try { if (old) old.close(); } catch (e) {}
      R.fails = (R.fails || 0) + 1;
      clearTimeout(R.reT); R.reT = setTimeout(boot, [2, 5, 10, 15][Math.min(3, R.fails - 1)] * 60000);
    }
    boot();
    return {
      ok: function () { return R.ok; },
      stats: function () { return { ok: R.ok, last: R.last, got: R.got, state: R.client ? R.client.connection.state : 'sin cargar' }; },
      stop: function () { R.dead = true; clearTimeout(R.pingT); clearTimeout(R.reT); setOk(false); try { if (R.client) R.client.close(); } catch (e) {} }
    };
  }
  window.KFRT = { start: start, loadSdk: loadSdk };
})();
