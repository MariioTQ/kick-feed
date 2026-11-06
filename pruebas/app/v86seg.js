const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v86 · 🔐 seguridad: un link con otro ?api= NO debe robarse tu clave 🔑
const {chromium}=require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
const EVIL='https://evil-robaclave.test';
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const H={'access-control-allow-origin':'*'};
async function mk(url){
  const ctx=await b.newContext({viewport:{width:390,height:820},deviceScaleFactor:1,timezoneId:'America/Mexico_City'});
  const evilHits=[];   // todo lo que le llegue al servidor malo
  await ctx.addInitScript(()=>{
    window.__said=[];
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(){},cancel(){},getVoices(){return[];}}});
    window.SpeechSynthesisUtterance=function(t){ this.text=t; };
    window.WebSocket=function(u){ const w={readyState:0,url:u,send(){},close(){ w.readyState=3; }}; return w; };
    window.WebSocket.OPEN=1;
    localStorage.clear();
    localStorage.setItem('kickfeed.key','MI-CLAVE-SECRETA');   // como si ya la hubieras abierto una vez
  });
  // el servidor MALO: apunta todo lo que reciba
  await ctx.route(EVIL+'/**', r=>{ evilHits.push({url:r.request().url(), body:r.request().postData()||''}); return r.fulfill({status:200,headers:H,contentType:'application/json',body:'{"ok":true}'}); });
  // tu servidor de verdad y todo lo demás: respuestas vacías/válidas
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{ const u=new URL(r.request().url());
    if (u.pathname==='/api/events') return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,cursor:Date.now(),events:[],live:{is_live:false}})});
    return r.fulfill({status:200,headers:H,contentType:'application/json',body:'{"ok":true}'}); });
  for (const h of ['https://kick.com/**','https://web.kick.com/**','https://7tv.io/**','https://api.betterttv.net/**','https://cdn.7tv.app/**','https://files.kick.com/**','https://static-cdn.jtvnw.net/**','https://rest.ably.io/**','https://main.realtime.ably.net/**','https://cdn.jsdelivr.net/**','https://unpkg.com/**']) await ctx.route(h, r=>r.fulfill({status:404,headers:H,body:''}));
  const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(url); await W(1500);
  try{ await page.evaluate(()=>window.kickfeed && window.kickfeed.apiPoll && window.kickfeed.apiPoll()); }catch(e){}
  await W(1200);
  const cfg=await page.evaluate(()=>window.kickfeed ? {api:window.kickfeed.cfg.api, key:window.kickfeed.cfg.key} : null);
  const urlNow=await page.evaluate(()=>location.href);
  return {ctx, page, errs, evilHits, cfg, urlNow};
}

// 1) link MALO: ?api= apunta a otro servidor para robar la clave
let t=await mk('file://'+RAIZ+'/index.html?api='+encodeURIComponent(EVIL)+'&keep=0');
ok(t.cfg && t.cfg.api==='https://kick-feed-mariotq.vercel.app', 'con un ?api= de otro, la app usa TU servidor de siempre (no el del atacante): '+(t.cfg&&t.cfg.api));
ok(t.cfg && t.cfg.key==='', 'y NO carga tu clave en memoria: key='+JSON.stringify(t.cfg&&t.cfg.key));
ok(t.evilHits.length===0, 'el servidor del atacante no recibió NINGUNA llamada ('+t.evilHits.length+')');
ok(!t.evilHits.some(h=>/MI-CLAVE-SECRETA/.test(h.url+h.body)), 'y tu clave nunca salió hacia él');
ok(t.errs.length===0, 'sin errores (link malo): '+t.errs.join(' | '));
await t.ctx.close();

// 2) link BUENO: tu clave por la URL. Debe guardarse, usarse con tu servidor y salir de la barra de direcciones
t=await mk('file://'+RAIZ+'/index.html?key=K3y-BUENA&keep=0');
ok(t.cfg && t.cfg.key==='K3y-BUENA', 'tu link bueno sí carga tu clave: '+(t.cfg&&t.cfg.key));
ok(t.cfg && t.cfg.api==='https://kick-feed-mariotq.vercel.app', 'contra tu servidor de siempre');
ok(!/key=/.test(t.urlNow), 'la clave ya no se queda en la barra de direcciones: '+t.urlNow.replace('file://'+RAIZ,''));
ok(t.errs.length===0, 'sin errores (link bueno): '+t.errs.join(' | '));
await t.ctx.close();

// 3) link MALO que además trae una clave basura: no debe ensuciar tu clave guardada
t=await mk('file://'+RAIZ+'/index.html?api='+encodeURIComponent(EVIL)+'&key=BASURA&keep=0');
const stored=await t.page.evaluate(()=>{ try{ return localStorage.getItem('kickfeed.key'); }catch(e){ return null; } });
ok(stored==='MI-CLAVE-SECRETA', 'un ?api= malo con clave basura no sobreescribe tu clave guardada: '+stored);
ok(t.evilHits.length===0 && t.cfg.key==='', 'y tampoco manda nada al atacante');
await t.ctx.close();

console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(fails?1:0);
})();
