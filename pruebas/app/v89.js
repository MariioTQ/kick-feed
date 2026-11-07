const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v89 · 📊🔮 Encuestas y predicciones de Kick (base: v88 · 📊 Encuestas y anuncios (con los de Kick), sin 🟣 en la barra, atajos de encuesta/predicción/anuncio, 👑 VIP desde el chat, 🔑 cambiar tu clave y Ajustes reacomodados
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
  // v87: un visualViewport de mentira para simular el teclado del celular
  await ctx.addInitScript(()=>{ let kb=0; const vv=new EventTarget();
    Object.defineProperty(vv,'height',{get(){ return innerHeight-kb; }}); Object.defineProperty(vv,'width',{get(){ return innerWidth; }});
    vv.offsetTop=0; vv.offsetLeft=0; vv.scale=1;
    Object.defineProperty(window,'visualViewport',{configurable:true,value:vv});
    window.__kb=px=>{ kb=px; vv.dispatchEvent(new Event('resize')); }; });
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
    if (u.pathname==='/api/kweb') return J(S.kwst||{ok:true,on:false});
    if (u.pathname==='/api/kpoll'){ S.kp=(S.kp||[]).concat([body]); const K=S.kpst=S.kpst||{poll:null,pred:null};
      if (body.a==='poll'){ K.poll={t:body.title,left:120,opts:body.options.map((t,i)=>({id:i+1,t,n:i*3}))}; }
      if (body.a==='pollEnd') K.poll=null;
      if (body.a==='pred'){ K.pred={id:'01PRED0000000001',t:body.title,st:'ACTIVE',outs:body.outcomes.map((t,i)=>({id:'O'+i,t,pts:100*(i+1),n:i+1}))}; }
      if (body.a==='lock') K.pred.st='LOCKED';
      if (body.a==='win'){ K.pred.st='RESOLVED'; K.pred.win=body.win; }
      return J({ok:true, poll:K.poll, pred:K.pred}); }
    const a=u.searchParams.get('a');
    if (u.pathname==='/api/events') return J({ok:true,cursor:Date.now(),events:S.ev.splice(0),live:{is_live:S.live, started_at:start},totals:{subs:3,kicks:100,from:Date.parse(start)},tw:S.twState,pat:0,rwa:S.rwa||0,kad:S.kadEv});
    if (u.pathname==='/api/alertas'){ S.al=(S.al||[]).concat([{a, body}]); return J({ok:true,item:{id:'q1'}}); }
    if (u.pathname==='/api/goal'){ S.goals=(S.goals||[]).concat([body]); return J({ok:true, n:body.delta||0, totals:{subs:7+(body.delta||0), adj:body.delta||0, from:1, bits:500}}); }
    if (u.pathname==='/api/tw'){ S.tw.posts.push({a, body});
      if (a==='status') return J(S.status);
      if (a==='now') return J(Object.assign({ok:true}, S.twState));
      if (a==='ads'){ if (body.op==='snooze') S.snoozed=(S.snoozed||0)+1; return J({ok:true,sched:{next:Date.now()+(body.op==='snooze'?360000:600000),dur:60,preroll:90,snooze:2-(S.snoozed||0)}}); }
      if (a==='badges') return J({ok:true,map:{'subscriber/12':['https://static-cdn.jtvnw.net/badges/v1/sub12/2','1 año'],'moderator/1':['https://static-cdn.jtvnw.net/badges/v1/mod/2','Moderator'],'premium/1':['https://static-cdn.jtvnw.net/badges/v1/prime/2','Prime Gaming']}});
      if (a==='clips') return J({ok:true,list:[{id:'TwClip1',title:'Caída en Twitch',at:Date.now()-3600e3,dur:30,views:12,th:'',by:'FanTw',url:'https://clips.twitch.tv/TwClip1'}]});
      return J({ok:true}); }
    if (u.pathname==='/api/kick'){ S.kickCalls=(S.kickCalls||0)+1; const ka=body.a||a; S.kickA=(S.kickA||[]).concat([Object.assign({a:ka}, body)]);   // v88: anuncios de Kick
      if (ka==='ads') return J({ok:true, ads:S.kads});
      if (ka==='adstart'){ if (S.kadFail) return J({ok:false, error:S.kadFail}); return J({ok:true, ads:Object.assign({}, S.kads, {left:2, run:{at:Date.now(), dur:body.sec, st:'pending', src:'app'}})}); }
      if (ka==='adenroll') return J({ok:true, ads:Object.assign({}, S.kads, {opted:true})});
      return J(S.kst); }
    if (u.pathname==='/api/key'){ S.keyRot=(S.keyRot||[]).concat([body]); return J({ok:true, key:'NuevaK3y_ABCDEFGHIJKLMNOP', at:Date.now(), link:'https://mariiotq.github.io/kick-feed/?key=NuevaK3y_ABCDEFGHIJKLMNOP'}); }
    if (u.pathname==='/api/rewards'){ const a2=body.a||a; S.rwPosts=(S.rwPosts||[]).concat([Object.assign({a:a2}, body)]);   // v87
      const X=()=>({vips:S.rw.vips, prot:S.rw.prot, ttsbl:S.rw.ttsbl});
      if (a2==='list') return J(Object.assign({ok:true,list:S.rw.list,err:S.rw.err||{},pend:S.rw.pend}, X()));
      if (a2==='pend') return J({ok:true,pend:S.rw.pend});
      if (a2==='extra') return J(Object.assign({ok:true}, X()));
      if (a2==='vipdel'){ S.rw.vips=S.rw.vips.filter(v=>v.k!==body.k); return J(Object.assign({ok:true}, X())); }
      if (a2==='vipgive' || a2==='vipoff') return J(Object.assign({ok:true}, X()));   // v88
      if (a2==='prot'){ S.rw.prot={users:body.c.users, mods:body.c.mods!==false}; return J(Object.assign({ok:true}, X())); }
      if (a2==='ttsbl'){ const u2=String(body.u||'').toLowerCase(); S.rw.ttsbl=body.op==='del' ? S.rw.ttsbl.filter(x=>x!==u2) : [u2].concat(S.rw.ttsbl.filter(x=>x!==u2)); return J(Object.assign({ok:true}, X())); }
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


const sheetTap=async (ev,page,id)=>{ const kb=await (await page.$('.cm[data-id="'+id+'"] .u')).boundingBox(); await page.mouse.move(kb.x+5,kb.y+5); await page.mouse.down(); await W(700); await page.mouse.up(); await W(300); };
const openSet=async (ev,re)=>{ await ev(()=>{ const f=document.getElementById('filters'); if (!f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
  await ev(re=>[...document.querySelectorAll('#filters .chip')].find(x=>new RegExp(re).test(x.textContent)).click(), re); await W(700); };
const closeCp=async ev=>{ await ev(()=>{ const x=document.querySelector('#cpHead .x'); if (x) x.click(); }); await W(300); };

reset();
S.kst={ok:true,configured:true,me:{name:'MarioTQ',at:1,missing:[],rw:false}};
S.rw={err:{}, list:[], pend:[], vips:[], prot:{users:[],mods:true}, ttsbl:[]};
S.kads={at:Date.now(), opted:true, blocked:false, auto:false, left:3, max:4, per:3600, run:null};

let {ctx, page, errs, ev}=await mk(390, 900, {});
await ev(()=>window.kickfeed.apiPoll()); await W(600);
// sin sesión: dice cómo ponerla
await openSet(ev,'Encuestas y anuncios'); await W(600);
let g=await ev(()=>document.getElementById('cpanel').textContent);
ok(/Encuestas y 🔮 predicciones de Kick/.test(g) && /pon tu sesión de Kick/.test(g), 'sin sesión de Kick: dice que se pone en Plataformas');
await closeCp(ev);
S.kwst={ok:true,on:true,alive:true,at:Date.now()};
await openSet(ev,'Encuestas y anuncios'); await W(900);
g=await ev(()=>({poll:!!document.getElementById('kpPollGo'), pred:!!document.getElementById('kpPredGo'), now:(S=>0)()}));
ok(g.poll && g.pred && (S.kp||[]).some(x=>x.a==='now'), 'con sesión: formularios de encuesta y predicción en Kick (y pide cómo van)');
await page.fill('#kpPollQ','¿A dónde vamos?'); const po=await page.$$('.kpPO'); await po[0].fill('Centro'); await po[1].fill('Playa');
await ev(()=>document.querySelector('.seg[data-k="kpD"] button[data-v="300"]').click());
await ev(()=>document.getElementById('kpPollGo').click()); await W(600);
const pc=S.kp.find(x=>x.a==='poll'); ok(pc && pc.title==='¿A dónde vamos?' && pc.options.join()==='Centro,Playa' && pc.duration===300, 'manda la encuesta: '+JSON.stringify(pc));
g=await ev(()=>document.getElementById('cpanel').textContent);
ok(/¿A dónde vamos\?/.test(g) && /Playa: 3/.test(g) && /Terminar encuesta/.test(g), 'y se ve cómo va, con «Terminar encuesta»');
await page.fill('#kpPredQ','¿Llego antes de las 8?'); const pd=await page.$$('.kpDO'); await pd[0].fill('Sí'); await pd[1].fill('No');
await ev(()=>document.getElementById('kpPredGo').click()); await W(600);
ok(S.kp.some(x=>x.a==='pred' && x.outcomes.join()==='Sí,No' && x.window===120), 'manda la predicción');
await ev(()=>document.querySelector('button[data-kp="lock"]').click()); await W(500);
ok(S.kp.some(x=>x.a==='lock' && x.id==='01PRED0000000001'), 'cerrar apuestas');
await ev(()=>document.querySelector('button[data-kpw="O1"]').click()); await W(200); await ev(()=>document.querySelector('button[data-kpw="O1"]').click()); await W(500);
ok(S.kp.some(x=>x.a==='win' && x.win==='O1'), 'elegir quién ganó (con confirmación)');
ok(/ganó <b>No<\/b>|ganó No/.test(await ev(()=>document.getElementById('cpanel').innerHTML)) || /ganó/.test(await ev(()=>document.getElementById('cpanel').textContent)), 'y queda la última con quién ganó');
ok(errs.length===0, 'sin errores: '+errs.join(' | '));
await ctx.close();
console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
