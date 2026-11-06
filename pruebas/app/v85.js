const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v85 · 🔐 Sesión de Kick en ⚙ → Plataformas (antes: v84 · 🎯 Recompensas, canjes pendientes (feed, barra y página) y el botón para volver a conectar Kick
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
    if (u.pathname==='/api/kweb'){ S.kw=(S.kw||[]).concat([body]);
      if (body.a==='set'){ if (body.token==='BUENA_SESION_1234567890') { S.kwst={ok:true,on:true,at:Date.now(),alive:true}; return J(S.kwst); } return J({ok:false,error:'Kick no reconoce esa sesión'}); }
      if (body.a==='del'){ S.kwst={ok:true,on:false}; return J(S.kwst); }
      if (body.a==='test') return J(Object.assign({}, S.kwst, {check:{ok:true}}));
      return J(S.kwst||{ok:true,on:false}); }
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

let {ctx, page, errs, ev}=await mk(390, 900, {});
await ev(()=>window.kickfeed.apiPoll()); await W(800);
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Plataformas/.test(x.textContent)).click()); await W(800);
let g=await ev(()=>({h:document.getElementById('kwHead') && document.getElementById('kwHead').textContent, inp:!!document.getElementById('kwTok'), nt:[...document.querySelectorAll('#cpanel .nt')].map(x=>x.textContent).join(' | ')}));
ok(/Poner mi sesión de Kick/.test(g.h||'') && g.inp && /F12/.test(g.nt) && /session_token/.test(g.nt), 'Plataformas: sección «Sesión de Kick» con dónde copiarla: '+g.h);
ok(await ev(()=>document.getElementById('kwTok').type==='password'), 'el campo no enseña la sesión (tipo contraseña)');
await page.fill('#kwTok','mala'); await ev(()=>document.getElementById('kwSave').click()); await W(500);
g=await ev(()=>[...document.querySelectorAll('#cpanel .nt')].map(x=>x.textContent).join(' | '));
ok(/no reconoce/.test(g), 'si Kick no la reconoce, lo dice');
await page.fill('#kwTok','BUENA_SESION_1234567890'); await ev(()=>document.getElementById('kwSave').click()); await W(500);
g=await ev(()=>({h:document.getElementById('kwHead').textContent, inp:!!document.getElementById('kwTok'), body:document.getElementById('cpanel').innerHTML}));
ok(/Sesión puesta/.test(g.h) && !g.inp && /Kick reconoció tu sesión/.test(g.body), 'la guarda y queda «Sesión puesta»: '+g.h);
ok(!/BUENA_SESION/.test(g.body), 'y la sesión ya no se ve en ningún lado');
await ev(()=>document.getElementById('kwTest').click()); await W(400);
ok(/Tu sesión funciona/.test(await ev(()=>document.getElementById('cpanel').textContent)), '«Probar ahora»');
S.kwst={ok:true,on:true,at:Date.now(),alive:false};
await ev(()=>{ const x=document.querySelector('#cpHead .x'); if (x) x.click(); }); await W(200);
await ev(()=>{ const f=document.getElementById('filters'); if (!f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Plataformas/.test(x.textContent)).click()); await W(800);
g=await ev(()=>({h:document.getElementById('kwHead').textContent, inp:!!document.getElementById('kwTok')}));
ok(/se venció/.test(g.h) && g.inp, 'si se venció, lo dice y deja pegarla otra vez: '+g.h);
await ev(()=>document.getElementById('kwDel').click()); await W(100); await ev(()=>document.getElementById('kwDel').click()); await W(400);
ok(S.kw.some(x=>x.a==='del') && /Poner mi sesión/.test(await ev(()=>document.getElementById('kwHead').textContent)), 'quitar la sesión (con doble toque)');
// el feed avisa si se vence
S.ev.push({id:'kweb:1',ts:Date.now(),d:{kind:'kweb',ok:false,error:'Tu sesión de Kick se venció: vuelve a pegarla en ⚙ → Plataformas'}});
await ev(()=>window.kickfeed.apiPoll()); await W(500);
g=await ev(()=>[...document.querySelectorAll('#feed .item')].map(x=>x.textContent).find(t=>/sesión de Kick se venció/i.test(t)));
ok(!!g, 'en el feed sale el aviso de sesión vencida: '+g);
ok(errs.length===0, 'sin errores: '+errs.join(' | '));
await ctx.close();
console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
