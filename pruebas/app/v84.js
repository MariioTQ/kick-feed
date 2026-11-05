const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v84 · 🎯 Recompensas, canjes pendientes (feed, barra y página) y el botón para volver a conectar Kick
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
    if (u.pathname==='/api/events'){ S.evCalls=(S.evCalls||0)+1; S.evKeys=(S.evKeys||[]).concat([u.searchParams.getAll('key')]); }
    if (u.pathname==='/api/list') S.listKey=u.searchParams.get('key');
    if (u.pathname==='/api/obs' && body.action!=='run'){ S.obsSt=(S.obsSt||0)+1; return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,configured:true,url:'ws://x',scenes:['PC','BRB','LIVE'],current:'PC',stream:{on:false}})}); }
    if (u.pathname==='/api/brb'){ return new Promise(res=>setTimeout(res,300)).then(()=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,scr:{id:'x',pl:'',ctl:{seq:1},cfg:{msgs:['Ya vuelvo','Sin pila','Comiendo']}},now:null,onAir:false,pls:[]})})); }
    if (u.pathname==='/api/obs' && body.action==='run'){ S.runs=(S.runs||0)+1; return new Promise(res=>setTimeout(res,1500)).then(()=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,configured:true,scenes:['LIVE','BRB'],current:'LIVE',stream:{on:true}})})); }
    if (u.pathname==='/api/chat' && r.request().method()==='POST'){ S.sent=(S.sent||[]).concat([body.content]); return new Promise(res=>setTimeout(res,1200)).then(()=>r.fulfill({status:200,headers:H,contentType:'application/json',body:'{"ok":true}'})); }
    if (u.pathname==='/api/health'){ S.hc=(S.hc||[]).concat([r.request().method()+(body.fix?' fix':'')]); return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,at:Date.now(),fixed:body.fix?{kick:'ok',tw:'ok'}:null,checks:[{k:'db',ok:true,t:'Base de datos (Upstash) conectada'},{k:'kick',ok:true,t:'Kick: los 8 avisos activos (el chat lo lee la guardia)'},{k:'tw',ok:body.fix?true:false,t:body.fix?'Twitch: los 23 avisos activos':'Twitch: 1 avisos sin funcionar',d:body.fix?'':'Dados de baja por Twitch: channel.cheer (notification_failures_exceeded)'},{k:'rt',ok:true,t:'Tiempo real (Ably) funcionando'},{k:'obs',ok:null,t:'OBS sin conectar en la app (opcional)'}]})}); }
    if (u.pathname==='/api/chatin'){ S.cw=(S.cw||[]).concat([u.searchParams.get('a')]); return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,link:'https://mariiotq.github.io/kick-feed/guardia.html?w=TOK',st:{on:true,fresh:true,kick:true,tw:true,hooks:{kick:'off',tw:'on'}},obs:{created:true}})}); }
    if (u.pathname==='/api/obs') S.obsCalls=(S.obsCalls||0)+1;
    if (u.pathname==='/api/prefs') S.prefsCalls=(S.prefsCalls||0)+1;
    const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    const a=u.searchParams.get('a');
    if (u.pathname==='/api/events') return J({ok:true,cursor:Date.now(),events:S.ev.splice(0),live:{is_live:S.live, started_at:start},totals:{subs:3,kicks:100,from:Date.parse(start)},tw:S.twState,pat:0,rwa:S.rwa||0});
    if (u.pathname==='/api/alertas'){ S.al=(S.al||[]).concat([{a, body}]); return J({ok:true,item:{id:'q1'}}); }
    if (u.pathname==='/api/goal'){ S.goals=(S.goals||[]).concat([body]); return J({ok:true, n:body.delta||0, totals:{subs:7+(body.delta||0), adj:body.delta||0, from:1, bits:500}}); }
    if (u.pathname==='/api/tw'){ S.tw.posts.push({a, body});
      if (a==='status') return J(S.status);
      if (a==='now') return J(Object.assign({ok:true}, S.twState));
      if (a==='ads'){ if (body.op==='snooze') S.snoozed=(S.snoozed||0)+1; return J({ok:true,sched:{next:Date.now()+(body.op==='snooze'?360000:600000),dur:60,preroll:90,snooze:2-(S.snoozed||0)}}); }
      if (a==='badges') return J({ok:true,map:{'subscriber/12':['https://static-cdn.jtvnw.net/badges/v1/sub12/2','1 año'],'moderator/1':['https://static-cdn.jtvnw.net/badges/v1/mod/2','Moderator'],'premium/1':['https://static-cdn.jtvnw.net/badges/v1/prime/2','Prime Gaming']}});
      if (a==='clips') return J({ok:true,list:[{id:'TwClip1',title:'Caída en Twitch',at:Date.now()-3600e3,dur:30,views:12,th:'',by:'FanTw',url:'https://clips.twitch.tv/TwClip1'}]});
      return J({ok:true}); }
    if (u.pathname==='/api/kick'){ S.kickCalls=(S.kickCalls||0)+1; return J(S.kst); }   // v84
    if (u.pathname==='/api/rewards'){ const a2=body.a||a; S.rwPosts=(S.rwPosts||[]).concat([Object.assign({a:a2}, body)]);   // v84
      if (a2==='list') return J({ok:true,list:S.rw.list,err:S.rw.err||{},pend:S.rw.pend});
      if (a2==='pend') return J({ok:true,pend:S.rw.pend});
      if (a2==='res'){ S.rw.pend=S.rw.pend.filter(x=>!(x.pf===body.pf && x.id===body.id)); return J({ok:true,st:body.ok?'accepted':'rejected'}); }
      if (a2==='save') return J({ok:true,item:Object.assign({pf:body.pf,id:'nuevo1',can:true},body.f)});
      if (a2==='copy') return J({ok:true,item:{pf:body.pf,id:'copia1',t:'Vip Rey (app)',can:true,on:false}});
      if (a2==='del') return J({ok:true});
      return J({ok:false,error:'?'}); }
    if (u.pathname==='/api/rules' && u.searchParams.get('a')==='rewards'){ S.rwCalls=(S.rwCalls||0)+1; return J(S.rewards||{ok:true,list:[],err:{}}); }
    if (u.pathname==='/api/modcmd'){ S.mc=(S.mc||[]).concat([body]); if (body.action==='save') S.mcCfg=body.cfg; if (body.action==='plan') S.plan={t:body.text}; return J({ok:true,cfg:S.mcCfg||{on:true,users:[],cmds:[],bi:{mom:{c:'!momento',on:true,reply:true},plan:{c:'!plan',on:true,word:true}}},log:[],plan:S.plan||{t:'Tacos al final'}}); }
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

reset();
S.kst={ok:true,configured:true,me:{name:'MarioTQ',at:1,missing:[{s:'channel:rewards:read',t:'Ver tus recompensas'},{s:'channel:rewards:write',t:'Crear y cambiar recompensas, y aceptar o rechazar canjes'}],rw:true}};
const T0=Date.now()-60000;
S.rw={err:{}, list:[
  {pf:'kick',id:'01KA',t:'Saludo especial',c:1500,desc:'Te saludo',color:'#00FF88',on:true,paused:false,in:true,skip:false,can:true},
  {pf:'kick',id:'01KB',t:'Vip Mini',c:5000,desc:'',color:'#FF0000',on:true,paused:false,in:false,skip:true,can:false},
  {pf:'tw',id:'twA',t:'Hidratarse',c:500,on:true,paused:true,in:false,skip:false,can:true},
  {pf:'tw',id:'twB',t:'Vip Rey',c:20000,on:false,in:false,skip:true,can:false}],
  pend:[{pf:'kick',id:'redK1',rwid:'01KA',rw:'Saludo especial',c:1500,u:'Pepe',in:'hola mario',at:T0,can:true},
        {pf:'tw',id:'redT1',rwid:'twB',rw:'Vip Rey',c:20000,u:'FanT',in:'',at:T0,can:false}]};
S.rwa=111;
let {ctx, page, errs, ev}=await mk(390, 820, {});
await ev(()=>{ window.__opened=[]; window.open=u=>{ window.__opened.push(u); return null; }; });
await ev(()=>window.kickfeed.apiPoll()); await W(1500);
// la barra: 🎯 con los que sí puedes resolver
let g=await ev(()=>{ const p=document.getElementById('pRwp'); return p && {t:p.textContent, vis:!!p.getClientRects().length}; });
ok(g && g.vis && g.t==='🎯 1', 'en la barra sale 🎯 con los canjes que puedes aceptar o rechazar: '+JSON.stringify(g));
ok((S.rwPosts||[]).some(x=>x.a==='pend'), 'al ver que cambió la lista (rwa), la pide');
// ⚙ → Plataformas: Kick con sus permisos
await page.click('#gear'); await W(300);
g=await ev(()=>{ const c=[...document.querySelectorAll('#filters .chip')].find(x=>/Recompensas/.test(x.textContent)); return c && c.textContent; });
ok(/Recompensas.*1 pendiente/.test(g||''), 'en Ajustes → En vivo sale «Recompensas» con cuántos pendientes: '+g);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Plataformas/.test(x.textContent)).click()); await W(800);
g=await ev(()=>{ const k=document.getElementById('pfKGo'); return {row:k && k.textContent, nt:[...document.querySelectorAll('#cpanel .nt')].map(x=>x.textContent).join(' | ')}; });
ok(S.kickCalls>=1 && /Conectado: MarioTQ/.test(g.row||'') && /Faltan 2 permisos/.test(g.row||''), 'Plataformas: Kick dice cuántos permisos le faltan: '+g.row);
ok(/Ver tus recompensas/.test(g.nt) && /Sin los de recompensas/.test(g.nt) && /Developer/.test(g.nt), 'y cuáles (con su nombre en español) y qué hacer si siguen faltando');
await ev(()=>document.getElementById('pfKGo').click()); await W(300);
g=await ev(()=>window.__opened);
ok(g.length===1 && g[0]==='https://kick-feed-mariotq.vercel.app/api/login', 'el botón abre la página oficial para volver a conectar Kick: '+g.join());
ok(!/key=/.test(g[0]), 'y el link no lleva tu clave');
// ⚙ → Recompensas
await ev(()=>{ const x=document.querySelector('#cpHead .x'); if (x) x.click(); }); await W(300);
await ev(()=>{ const f=document.getElementById('filters'); if (!f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Recompensas/.test(x.textContent)).click()); await W(900);
g=await ev(()=>({pend:[...document.querySelectorAll('#cpanel .rwpi')].map(x=>x.textContent), btn:document.querySelectorAll('#cpanel .rwpi .rwb button').length,
  rows:[...document.querySelectorAll('#cpanel .op[data-rwe]')].map(x=>x.textContent), news:document.querySelectorAll('#cpanel .op[data-rwn]').length}));
ok(g.pend.length===2 && /Pepe.*Saludo especial.*hola mario/.test(g.pend[0]+g.pend[1]) && g.btn===2, 'Recompensas: los canjes pendientes, con ✓ / ✕ solo en el que se puede: '+JSON.stringify(g.pend));
ok(g.pend.some(x=>/FanT.*Vip Rey.*🔒 en Twitch/.test(x)), 'el de una recompensa con candado dice dónde resolverlo');
ok(g.rows.length===4 && /^Saludo especial/.test(g.rows[0]) && /🔒 Vip Mini/.test(g.rows[1]) && /Hidratarse.*Pausada.*queda pendiente/.test(g.rows[2]) && /🔒 Vip Rey.*Apagada.*se acepta sola/.test(g.rows[3]) && g.news===2, 'tus recompensas de Kick y Twitch, con candado y su estado: '+JSON.stringify(g.rows));
// ✓ aceptar el de Kick
await ev(()=>document.querySelector('#cpanel .rwpi .rwb button.ok').click()); await W(700);
g=await ev(()=>({p:document.getElementById('pRwp').getClientRects().length, n:document.querySelectorAll('#cpanel .rwpi').length}));
ok((S.rwPosts||[]).some(x=>x.a==='res' && x.pf==='kick' && x.id==='redK1' && x.ok===true) && g.n===1 && g.p===0, '✓ lo acepta, se quita de la lista y el 🎯 de la barra se esconde: '+JSON.stringify(g));
// nueva en Kick
await ev(()=>document.querySelector('#cpanel .op[data-rwn="kick"]').click()); await W(400);
await page.fill('#rwT','Elige la canción'); await page.fill('#rwC','800'); await page.fill('#rwD','Escribe cuál');
await ev(()=>document.querySelector('#cpanel .op[data-k="in"]').click()); await ev(()=>document.querySelector('#cpanel .op[data-k="skip"]').click());
await ev(()=>document.getElementById('rwSave').click()); await W(700);
let sv=(S.rwPosts||[]).filter(x=>x.a==='save').pop();
ok(sv && sv.pf==='kick' && !sv.id && sv.f.t==='Elige la canción' && sv.f.c===800 && sv.f.desc==='Escribe cuál' && sv.f.in===true && sv.f.skip===false && sv.f.on===true && !('paused' in sv.f), 'crear una recompensa de Kick manda lo que pusiste: '+JSON.stringify(sv && sv.f));
// editar la de Twitch (pausada)
await ev(()=>document.querySelector('#cpanel .op[data-rwe="tw|twA"]').click()); await W(400);
g=await ev(()=>({t:document.getElementById('rwT').value, c:document.getElementById('rwC').value, paused:document.querySelector('#cpanel .op[data-k="paused"] .sw').classList.contains('on'), mx:document.getElementById('rwT').maxLength}));
ok(g.t==='Hidratarse' && g.c==='500' && g.paused && g.mx===45, 'editar: trae lo que tiene (Twitch: hasta 45 letras): '+JSON.stringify(g));
await ev(()=>document.querySelector('#cpanel .op[data-k="paused"]').click()); await ev(()=>document.getElementById('rwSave').click()); await W(700);
sv=(S.rwPosts||[]).filter(x=>x.a==='save').pop();
ok(sv && sv.pf==='tw' && sv.id==='twA' && sv.f.paused===false, 'la despausa: '+JSON.stringify(sv && sv.f));
// con candado: «Pasar esta recompensa a la app»
await ev(()=>document.querySelector('#cpanel .op[data-rwe="tw|twB"]').click()); await W(400);
g=await ev(()=>({copy:!!document.getElementById('rwCopy'), save:!!document.getElementById('rwSave'), nt:[...document.querySelectorAll('#cpanel .nt')].map(x=>x.textContent).join(' | ')}));
ok(g.copy && !g.save && /apagada/.test(g.nt) && /borra la vieja en Twitch/.test(g.nt), 'una con candado no se edita: ofrece «Pasar a la app» y explica los pasos');
await ev(()=>document.getElementById('rwCopy').click()); await W(700);
ok((S.rwPosts||[]).some(x=>x.a==='copy' && x.pf==='tw' && x.id==='twB'), 'la pasa a la app');
await ev(()=>{ const x=document.querySelector('#cpHead .x'); if (x) x.click(); }); await W(300);
// el feed: canje pendiente de Kick con ✓ / ✕
S.ev.push({id:'rwp:k:redK9',ts:Date.now(),d:{kind:'rwpend',pf:'kick',user:'Luis',reward:'Saludo especial',cost:1500,input:'para mi mamá',rid:'redK9',rwid:'01KA',can:true}});
S.rw.pend.push({pf:'kick',id:'redK9',rwid:'01KA',rw:'Saludo especial',c:1500,u:'Luis',in:'para mi mamá',at:Date.now(),can:true});
S.rwa=222;
await ev(()=>window.kickfeed.apiPoll()); await W(1500);
const itemOf=(re)=>ev(re=>{ const it=[...document.querySelectorAll('#feed .item')].find(x=>new RegExp(re).test(x.textContent)); return it && {t:it.textContent, b:it.querySelectorAll('.rwb button').length}; }, re);
g=await itemOf('Luis canjeó');
ok(g && /Saludo especial/.test(g.t) && /pendiente/.test(g.t) && /para mi mamá/.test(g.t) && g.b===2, 'en el feed: el canje pendiente con ✓ / ✕: '+JSON.stringify(g));
g=await ev(()=>document.getElementById('pRwp').textContent); ok(g==='🎯 1', 'y la barra lo cuenta: '+g);
// ✕ pide otro toque
await ev(()=>[...document.querySelectorAll('#feed .item')].find(x=>/Luis canjeó/.test(x.textContent)).querySelector('.rwb .no').click()); await W(300);
ok(!(S.rwPosts||[]).some(x=>x.a==='res' && x.id==='redK9'), '✕ no rechaza con un solo toque');
await ev(()=>[...document.querySelectorAll('#feed .item')].find(x=>/Luis canjeó/.test(x.textContent)).querySelector('.rwb .no').click()); await W(700);
g=await itemOf('Luis canjeó');
ok((S.rwPosts||[]).some(x=>x.a==='res' && x.id==='redK9' && x.ok===false) && /✕ Rechazado/.test(g.t) && g.b===0, 'con el segundo toque lo rechaza y lo marca: '+(g && g.t));
// Twitch: el canje pendiente sale en la misma línea; si lo resuelves en Twitch, se marca
S.ev.push({id:'tw:x9',ts:Date.now()-60000,d:{kind:'reward',pf:'tw',user:'FanT2',reward:'Hidratarse',cost:500,input:'',rid:'redT9',rwid:'twA',pend:1,can:true}});
S.rw.pend.push({pf:'tw',id:'redT9',rwid:'twA',rw:'Hidratarse',c:500,u:'FanT2',in:'',at:Date.now()-60000,can:true}); S.rwa=333;
await ev(()=>window.kickfeed.apiPoll()); await W(1500);
g=await itemOf('FanT2 canjeó'); ok(g && g.b===2 && /pendiente/.test(g.t), 'Twitch: el canje pendiente sale con ✓ / ✕ en su línea: '+(g && g.t));
S.rw.pend=S.rw.pend.filter(x=>x.id!=='redT9'); S.rwa=444;
await ev(()=>window.kickfeed.apiPoll()); await W(1500);
g=await itemOf('FanT2 canjeó'); ok(g && g.b===0 && /Ya se resolvió/.test(g.t), 'lo resolviste en Twitch: en el feed ya no salen los botones: '+(g && g.t));
g=await ev(()=>document.getElementById('pRwp').getClientRects().length); ok(g===0, 'y la barra ya no lo cuenta');
ok(errs.length===0, 'sin errores: '+errs.join(' | '));
await ctx.close();
console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
