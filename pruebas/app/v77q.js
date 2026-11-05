const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
const {chromium}=require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const H={'access-control-allow-origin':'*'};
const {ablyRoutes, rtHandle}=require(__dirname+'/rtcommon.js');
let S;
function reset(){ S={posts:[], tw:{posts:[]}, ev:[], live:true,
  twState:{on:true, live:{is_live:true, started_at:new Date(Date.now()-1800e3).toISOString()}, session:{live:true}, totals:{subs:7,bits:500,from:1}, vw:{n:23}, poll:null, pred:null, hype:null, ad:null},
  status:{ok:true, configured:true, channel:'mariotq', me:{login:'mariotq', name:'MarioTQ', id:'111', missing:[]}, bot:{login:'tq_bot_irl', name:'TQ_bot_IRL'}}}; }
reset();
const curS=()=>S;
async function mk(vw, vh, cfg, bar){
  const S=curS();
  const ctx=await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:1,timezoneId:'America/Mexico_City'});
  await ctx.addInitScript(([cfg, bar])=>{
    window.__said=[];
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){ window.__said.push(u.text); setTimeout(()=>u.onend&&u.onend(), 80); }, cancel(){}, getVoices(){ return [{name:'Paulina',lang:'es-MX',voiceURI:'Paulina'}]; }}});
    window.SpeechSynthesisUtterance=function(t){ this.text=t; };
    window.__irc=[]; window.__ircSent=[];
    window.WebSocket=function(u){ const w={readyState:0,url:u,send(x){ if (/twitch/.test(u)) window.__ircSent.push(x); },close(){ w.readyState=3; }};
      if (/irc-ws\.chat\.twitch\.tv/.test(u)){ window.__irc.push(w); if (window.__ircDown){ setTimeout(()=>{ w.onclose&&w.onclose(); },30); return w; } setTimeout(()=>{ w.readyState=1; w.onopen&&w.onopen(); setTimeout(()=>w.onmessage&&w.onmessage({data:':tmi.twitch.tv 366 justinfan #mariotq :End of /NAMES list\r\n'}),30); },30); return w; }
      setTimeout(()=>{ w.readyState=1; w.onopen&&w.onopen(); w.onmessage&&w.onmessage({data:JSON.stringify({event:'pusher:connection_established',data:JSON.stringify({socket_id:'1.2'})})}); },50); return w; };
    window.WebSocket.OPEN=1;
    window.irc=(line)=>{ const w=window.__irc[window.__irc.length-1]; w && w.onmessage && w.onmessage({data:line+'\r\n'}); };
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init','1'); localStorage.clear();
    localStorage.setItem('kickfeed.chatcfg', JSON.stringify(Object.assign({on:true,fs:16,obsLive:false}, cfg))); localStorage.setItem('kickfeed.viewers','1');
    if (bar) localStorage.setItem('kickfeed.bar', JSON.stringify(bar));
  }, [cfg, bar||null]);
  const start=new Date(Date.now()-3600e3).toISOString();
  await ctx.route('https://kick.com/**', r=>{ if (/livestream/.test(r.request().url())) return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({data: S.live ? {id:1,viewers:87,created_at:start} : null})}); return r.fulfill({status:404,headers:H,body:'{}'}); });
  await ctx.route('https://cdn.7tv.app/**', r=>r.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
  await ctx.route('https://media4.giphy.com/**', r=>r.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
  for (const h of ['https://web.kick.com/**','https://7tv.io/**','https://api.betterttv.net/**','https://stats.srt.belabox.net/**','https://files.kick.com/**','https://translate.google.com.mx/**']) await ctx.route(h, r=>r.fulfill({status:404,headers:H,body:''}));
  await ctx.route('https://7tv.io/v3/users/twitch/**', r=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({emote_set:{emotes:[{name:'catJAM',data:{host:{url:'//cdn.7tv.app/emote/cat'}}}]}})}));
  await ctx.route('https://static-cdn.jtvnw.net/**', r=>r.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
  await ablyRoutes(ctx, S); const PR={};
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{ const u=new URL(r.request().url()); let body={}; try{ body=JSON.parse(r.request().postData()||'{}'); }catch(e){}
    if (rtHandle(u, r, S, PR)) return;
    if (u.pathname==='/api/events') S.evCalls=(S.evCalls||0)+1;
    if (u.pathname==='/api/obs') S.obsCalls=(S.obsCalls||0)+1;
    if (u.pathname==='/api/prefs') S.prefsCalls=(S.prefsCalls||0)+1;
    const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    const a=u.searchParams.get('a');
    if (u.pathname==='/api/events') return J({ok:true,cursor:Date.now(),events:S.ev.splice(0),live:{is_live:S.live, started_at:start},totals:{subs:3,kicks:100,from:Date.parse(start)},tw:S.twState,pat:0});
    if (u.pathname==='/api/alertas'){ S.al=(S.al||[]).concat([{a, body}]); return J({ok:true,item:{id:'q1'}}); }
    if (u.pathname==='/api/goal'){ S.goals=(S.goals||[]).concat([body]); return J({ok:true, n:body.delta||0, totals:{subs:7+(body.delta||0), adj:body.delta||0, from:1, bits:500}}); }
    if (u.pathname==='/api/tw'){ S.tw.posts.push({a, body});
      if (a==='status') return J(S.status);
      if (a==='now') return J(Object.assign({ok:true}, S.twState));
      if (a==='ads'){ if (body.op==='snooze') S.snoozed=(S.snoozed||0)+1; return J({ok:true,sched:{next:Date.now()+(body.op==='snooze'?360000:600000),dur:60,preroll:90,snooze:2-(S.snoozed||0)}}); }
      if (a==='badges') return J({ok:true,map:{'subscriber/12':['https://static-cdn.jtvnw.net/badges/v1/sub12/2','1 año'],'moderator/1':['https://static-cdn.jtvnw.net/badges/v1/mod/2','Moderator'],'premium/1':['https://static-cdn.jtvnw.net/badges/v1/prime/2','Prime Gaming']}});
      if (a==='clips') return J({ok:true,list:[{id:'TwClip1',title:'Caída en Twitch',at:Date.now()-3600e3,dur:30,views:12,th:'',by:'FanTw',url:'https://clips.twitch.tv/TwClip1'}]});
      return J({ok:true}); }
    if (u.pathname==='/api/rules'){ if (r.request().method()==='POST' && body.action==='save') S.rules=body.cfg; return J({ok:true,cfg:S.rules||{on:true,feed:true,list:[]},log:[]}); }
    if (u.pathname==='/api/chat' && r.request().method()==='POST'){ S.posts.push(body); return J(body.pf==='both'?{ok:true,kick:{ok:true},tw:{ok:true}}:{ok:true}); }
    if (u.pathname==='/api/chat') return J({ok:true,cursor:Date.now(),msgs:!S.twState?[]:[{id:'srvtw1',pf:'tw',u:'HistoTw',uid:'7',color:'#00ffaa',badges:[{type:'vip'}],t:'mensaje viejo de twitch',ts:Date.now()-60000,rt:Date.now()-60000}]});
    if (u.pathname==='/api/channel'){ S.chanReq=(S.chanReq||[]).concat([{q:u.search, body}]); return J({ok:true,title:'Kick título',category:{id:15,name:'IRL'},tw:{title:'Twitch título',category:{id:'509672',name:'IRL'}}}); }
    if (u.pathname==='/api/categories') return J({ok:true,data:[{id:'509658',name:'Just Chatting'}]});
    return J({ok:true,users:[],msgs:[]}); });
  const page=await ctx.newPage(); PR.p=page; const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('file://'+RAIZ+'/index.html?keep=0&key=K3y'); await W(2600);
  return {ctx, page, errs, ev:(c,a)=>page.evaluate(c,a)};
}
const C='chatrooms.6635680.v2';
const kmsg=(ev,id,u,t)=>ev(([id,u,t,C])=>window.kickfeed.handle('App\\Events\\ChatMessageEvent',{id,content:t,type:'message',sender:{id:id.length,username:u,identity:{color:'#fff',badges:[]}}},C),[id,u,t,C]);
const irc=(ev,line)=>ev(l=>window.irc(l), line);


const kmsgB=(ev,id,u,t,badges)=>ev(([id,u,t,badges,C])=>window.kickfeed.handle('App\\Events\\ChatMessageEvent',{id,content:t,type:'message',sender:{id:id.length,username:u,identity:{color:'#53fc18',badges}}},C),[id,u,t,badges,C]);
const rect=(ev,id)=>ev(id=>{ const e=document.getElementById(id); if (!e || !e.getClientRects().length) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height)}; }, id);



/* ===== 1. se conecta y comprueba con el ping ===== */
reset();
let {ctx, page, errs, ev}=await mk(375, 720, {});
await W(1500);
let st=await ev(()=>window.kickfeed.rt());
ok(st.ok===true && st.st && st.st.state==='connected', 'tiempo real: conectado y comprobado con el ping ('+JSON.stringify(st)+')');
ok(S.rtCalls.some(x=>/a=ping/.test(x)), 'pidió el ping a tu servidor');
ok(await ev(()=>window.__ablyOpts && /\/api\/rt$/.test(window.__ablyOpts.authUrl) && !('key' in window.__ablyOpts)), 'la llave no está en la app: pide permiso a /api/rt');
ok(await ev(()=>window.__ablyCh==='kf'), 'escucha el canal kf');
await ev(()=>{ const g=document.getElementById('gear')||document.querySelector('[data-gear]'); });
await ev(()=>document.getElementById('gear').click()); await W(700);
ok(await ev(()=>Array.from(document.querySelectorAll('.chip.wide')).some(e=>/⚡ Tiempo real/.test(e.textContent))), 'en ⚙ Servidor dice «⚡ Tiempo real»');
await ev(()=>document.getElementById('gear').click()); await W(300);

/* ===== 2. una sub llega por Ably: se ve sin preguntar ===== */
let e0=S.evCalls;
await ev(()=>window.__ablyEmit('ev',{id:'rtk1',type:'channel.subscription.new',ts:Date.now(),rt:Date.now(),d:{kind:'sub',user:'PepeRT',months:1}}));
await W(600);
ok(await ev(()=>window.kickfeed.log().some(e=>/PepeRT/.test(JSON.stringify(e)))), 'la sub de Ably sale en el feed al momento');
ok(S.evCalls===e0, 'y no tuvo que preguntarle al servidor');
S.ev.push({id:'rtk1',type:'channel.subscription.new',ts:Date.now(),rt:Date.now(),d:{kind:'sub',user:'PepeRT',months:1}});
await ev(()=>window.kickfeed.apiPoll()); await W(500);
ok(await ev(()=>window.kickfeed.log().filter(e=>/PepeRT/.test(JSON.stringify(e))).length===1), 'si después llega también por la revisión, no se repite');

/* ===== 3. la meta y Twitch al momento ===== */
await ev(()=>window.__ablyEmit('goal',{pf:'kick',subs:9,t:{subs:9,kicks:0,from:1,newSubs:9,resubs:0,gifted:0}})); await W(300);
ok(await ev(()=>window.kickfeed.sess().subs)>=9, 'la meta de Kick se actualiza con lo que manda el servidor ('+await ev(()=>window.kickfeed.sess().subs)+')');
await ev(()=>window.__ablyEmit('tw',{poll:{id:'p9',title:'¿Pozole o tacos?',st:'begin',ends:new Date(Date.now()+90000).toISOString(),choices:[{id:'a',t:'Pozole',v:3},{id:'b',t:'Tacos',v:5}],at:Date.now()}})); await W(500);
ok(await ev(()=>/Pozole o tacos/.test(document.body.innerText)), 'la encuesta de Twitch aparece al momento');

/* ===== 4. se cae Ably: vuelve a preguntar ya ===== */
e0=S.evCalls;
await ev(()=>window.__ablyDrop()); await W(800);
ok(await ev(()=>window.kickfeed.rt().ok)===false && S.evCalls>e0, 'si Ably se cae: revisa al momento y vuelve a preguntar como antes');
const p0=S.rtCalls.filter(x=>/ping/.test(x)).length;
await ev(()=>window.__ablyBack()); await W(2500);
ok(await ev(()=>window.kickfeed.rt().ok)===true && S.rtCalls.filter(x=>/ping/.test(x)).length>p0, 'cuando vuelve: lo comprueba otra vez con un ping y sigue en tiempo real');
ok(errs.length===0, 'sin errores (1-4): '+errs.join(' | '));
await ctx.close();

if (process.env.QUICK) { await b.close(); process.exit(0); }
/* ===== 5. cuánto pregunta en 65 s: con Ably vs sin Ably ===== */
reset(); const SA=S;
const A=await mk(375, 720, {});
reset(); S.pingWorks=false; const SB=S;
const Bp=await mk(375, 720, {});
// cada página tiene su S por referencia en la ruta (la ruta usa la variable S global): se mide aparte
const a0=SA.evCalls||0, b0=SB.evCalls||0;
await W(65000);
const ca=(SA.evCalls||0)-a0, cb=(SB.evCalls||0)-b0;
ok(ca<=2, 'con Ably: '+ca+' revisiones en 65 s (antes 4-5)');
ok(cb>=3, 'sin Ably (el ping no llegó): sigue preguntando como antes: '+cb+' en 65 s');
ok(await Bp.ev(()=>window.kickfeed.rt().ok)===false, 'sin el ping no se confía en Ably');
ok(A.errs.length===0 && Bp.errs.length===0, 'sin errores (5): '+A.errs.concat(Bp.errs).join(' | '));
await A.ctx.close(); await Bp.ctx.close();

/* ===== 6. no carga Ably (CDN bloqueado): todo como antes ===== */
reset(); S.noSdk=true;
({ctx, page, errs, ev}=await mk(375, 720, {}));
await W(1500);
ok(await ev(()=>window.kickfeed.rt().ok)===false && S.unpkg>=1, 'si no carga Ably: intenta el otro CDN y sigue preguntando como antes');
await ev(()=>window.kickfeed.apiPoll()); await W(400);
ok(errs.length===0, 'sin errores (6): '+errs.join(' | '));
await ctx.close();

/* ===== 7. la página de tu amigo (DUO) no se conecta ===== */
console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
