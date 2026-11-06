const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v87 · ⌨️ teclado, 🎬 regla de escena (a qué chat), 👑 VIP temporales, 🛡 protegidos, 🔊 TTS por recompensa y su lista negra
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
    if (u.pathname==='/api/rewards'){ const a2=body.a||a; S.rwPosts=(S.rwPosts||[]).concat([Object.assign({a:a2}, body)]);   // v87
      const X=()=>({vips:S.rw.vips, prot:S.rw.prot, ttsbl:S.rw.ttsbl});
      if (a2==='list') return J(Object.assign({ok:true,list:S.rw.list,err:S.rw.err||{},pend:S.rw.pend}, X()));
      if (a2==='pend') return J({ok:true,pend:S.rw.pend});
      if (a2==='extra') return J(Object.assign({ok:true}, X()));
      if (a2==='vipdel'){ S.rw.vips=S.rw.vips.filter(v=>v.k!==body.k); return J(Object.assign({ok:true}, X())); }
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

reset();
S.kst={ok:true,configured:true,me:{name:'MarioTQ',at:1,missing:[],rw:false}};
S.rw={err:{}, list:[{pf:'kick',id:'01KA',t:'TTS',c:500,on:true,in:true,skip:true,can:true}], pend:[],
  vips:[{k:'kick:pepe',pf:'kick',u:'pepe',until:Date.now()+(2*864e5+3*3600e3+5*60000)},{k:'tw:4242:fan1',pf:'tw',u:'fan1',until:Date.now()+90*60000}],
  prot:{users:['amigo1'],mods:true}, ttsbl:['troll']};
let {ctx, page, errs, ev}=await mk(390, 820, {tw:false, input:true});
await W(800);

// 1) ⌨️ el teclado ya no tapa la barra para escribir
await page.focus('#chatTxt'); await ev(()=>window.__kb(320)); await W(200);
let g=await ev(()=>{ const r=document.getElementById('chatIn').getBoundingClientRect(); return {cls:document.body.classList.contains('kbopen'), kb:document.body.style.getPropertyValue('--kbB'), bottom:Math.round(r.bottom), top:Math.round(r.top), vis:innerHeight-320}; });
ok(g.cls && g.kb==='320px', 'con el teclado abierto se acomoda la pantalla: '+JSON.stringify(g));
ok(g.bottom<=g.vis+1 && g.top>0, 'la barra para escribir queda justo arriba del teclado (no tapada): abajo en '+g.bottom+', el teclado empieza en '+g.vis);
g=await ev(()=>{ const f=document.getElementById('feed').getBoundingClientRect(), c=document.getElementById('chatList').getBoundingClientRect(); return {feed:Math.round(f.height), chat:Math.round(c.height)}; });
ok(g.chat>=120, 'y se ve el chat mientras escribes (el feed se encoge): '+JSON.stringify(g));
await ev(()=>document.getElementById('chatTxt').blur()); await ev(()=>window.__kb(0)); await W(200);
ok(await ev(()=>!document.body.classList.contains('kbopen') && !document.body.style.getPropertyValue('--kbB')), 'al cerrar el teclado todo regresa como estaba');
await ev(()=>window.__kb(320)); await W(150);
ok(await ev(()=>!document.body.classList.contains('kbopen')), 'si el teclado sale para otra cosa (no para el chat), no se mueve nada');
await ev(()=>window.__kb(0)); await W(100);

// 2) 🎬 regla de escena: a qué chat va el mensaje (aunque Twitch esté apagado en este celular)
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Reglas automáticas/.test(x.textContent)).click()); await W(600);
await page.click('#rlNew'); await W(400);
g=await ev(()=>!!document.getElementById('rlPf'));
ok(g===false, 'con Twitch apagado, en una regla normal no sale «Dónde» (como antes)');
await page.selectOption('#rlEv','scene'); await W(400);
g=await ev(()=>{ const s=document.getElementById('rlTo'); return s ? [...s.options].map(o=>o.value+':'+o.textContent) : null; });
ok(g && g.length===4 && /both:Kick y Twitch/.test(g.join()) && !(await ev(()=>!!document.getElementById('rlPf'))), 'en la de escena sí sale «A qué chat va el mensaje» (4 opciones): '+JSON.stringify(g));
await page.selectOption('#rlTo','both'); await page.fill('#rlName','Offline');
await page.selectOption('#cpanel .tstep[data-si="0"] select[data-f="t"]','chat'); await W(300);
await page.fill('#cpanel .tstep[data-si="0"] input[data-f="text"]','Sin señal, ya regreso 🙏');
await ev(()=>document.getElementById('teSave').click()); await W(600);
let sv=S.rules && S.rules.list && S.rules.list[0];
ok(sv && sv.ev==='scene' && sv.name==='Offline' && sv.to==='both' && !sv.pf, 'se guarda con su chat: '+JSON.stringify(sv && {ev:sv.ev,name:sv.name,to:sv.to,pf:sv.pf}));

// 3) 🔊 paso de TTS en una regla de recompensa
await page.click('#rlNew'); await W(400);
await page.selectOption('#rlEv','reward'); await W(500);
await page.fill('#rlName','TTS');
g=await ev(()=>[...document.querySelectorAll('#cpanel .tstep[data-si="0"] select[data-f="t"] option')].map(o=>o.value));
ok(g.indexOf('rtts')>=0, 'en las recompensas sale el paso «🔊 TTS»');
await page.selectOption('#cpanel .tstep[data-si="0"] select[data-f="t"]','rtts'); await W(300);
g=await ev(()=>({who:!!document.querySelector('#cpanel select[data-f="who"]'), nt:[...document.querySelectorAll('#cpanel .tstep .nt')].map(x=>x.textContent).join(' ')}));
ok(g.who && /lista negra del TTS/.test(g.nt), 'con su opción de decir el nombre y la explicación');
await page.selectOption('#cpanel select[data-f="who"]','1');
await ev(()=>document.getElementById('teSave').click()); await W(600);
sv=S.rules && S.rules.list && S.rules.list.find(r=>r.ev==='reward');
ok(sv && sv.steps[0].t==='rtts' && Number(sv.steps[0].who)===1, 'se guarda: '+JSON.stringify(sv && sv.steps));
g=await ev(()=>[...document.querySelectorAll('#cpanel .rlr small')].map(x=>x.textContent).join(' | '));
ok(/🔊 TTS/.test(g), 'en la lista se lee «🔊 TTS»: '+g);
await ev(()=>{ const x=document.querySelector('#cpHead .x'); if (x) x.click(); }); await W(300);

// 4) 👑 🛡 🔊 en ⚙ → Recompensas
await ev(()=>{ const f=document.getElementById('filters'); if (!f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Recompensas/.test(x.textContent)).click()); await W(900);
g=await ev(()=>({lb:[...document.querySelectorAll('#cpanel .lb2')].map(x=>x.textContent), vips:[...document.querySelectorAll('#cpanel button[data-vd]')].map(b=>b.closest('.op').textContent)}));
ok(g.lb.some(x=>/VIP temporales \(2\)/.test(x)) && g.lb.some(x=>/Protegidos del timeout/.test(x)) && g.lb.some(x=>/Lista negra del TTS \(1\)/.test(x)), 'Recompensas: VIP temporales, protegidos y lista negra del TTS: '+g.lb.join(' | '));
ok(/fan1.*Le queda.*1 h 30 min|fan1.*1 h 29 min/.test(g.vips[0]) && /pepe.*Le quedan 2 días 3 h/.test(g.vips[1]), 'cada VIP dice cuánto le queda (el que vence primero arriba): '+JSON.stringify(g.vips));
await ev(()=>document.querySelector('#cpanel button[data-vd="tw:4242:fan1"]').click()); await W(200);
ok(!(S.rwPosts||[]).some(x=>x.a==='vipdel'), '«Quitar ya» pide otro toque');
await ev(()=>document.querySelector('#cpanel button[data-vd="tw:4242:fan1"]').click()); await W(600);
ok((S.rwPosts||[]).some(x=>x.a==='vipdel' && x.k==='tw:4242:fan1') && !(await ev(()=>!!document.querySelector('#cpanel button[data-vd="tw:4242:fan1"]'))), 'con el segundo toque se lo quita y sale de la lista');
await ev(()=>document.querySelector('#cpanel .op[data-k="protMods"]').click()); await W(500);
ok((S.rwPosts||[]).some(x=>x.a==='prot' && x.c.mods===false && x.c.users.join()==='amigo1'), 'apagar «Mis mods siempre protegidos» se guarda (sin perder tu lista)');
await page.fill('#protIn','@Chinchillas03'); await ev(()=>document.getElementById('protAdd').click()); await W(500);
ok((S.rwPosts||[]).some(x=>x.a==='prot' && x.c.users[0]==='chinchillas03' && x.c.users.indexOf('amigo1')>=0), 'agregar a alguien a los protegidos');
await ev(()=>document.querySelector('#cpanel button[data-pu="amigo1"]').click()); await W(500);
ok(S.rw.prot.users.join()==='chinchillas03', 'y quitar a alguien con su ✕');
await page.fill('#ttsIn','GroseroX'); await ev(()=>document.getElementById('ttsAdd').click()); await W(500);
ok((S.rwPosts||[]).some(x=>x.a==='ttsbl' && x.op==='add' && x.u==='grosero x'.replace(' ','')), 'agregar a la lista negra del TTS');
await ev(()=>document.querySelector('#cpanel button[data-bu="troll"]').click()); await W(500);
ok((S.rwPosts||[]).some(x=>x.a==='ttsbl' && x.op==='del' && x.u==='troll') && S.rw.ttsbl.join()==='groserox', 'y quitar de la lista negra');
await ev(()=>{ const x=document.querySelector('#cpHead .x'); if (x) x.click(); }); await W(300);

// 5) 🔇 desde el chat: tocas su nombre → «Ya no puede usar el TTS»
await kmsgB(ev,'mm1','Malhablado','algo feo',[]); await W(400);
{ const kb=await (await page.$('.cm[data-id="mm1"] .u')).boundingBox(); await page.mouse.move(kb.x+5,kb.y+5); await page.mouse.down(); await W(700); await page.mouse.up(); await W(300); }
g=await ev(()=>{ const b=document.querySelector('#msheet button[data-a="ttsbl"]'); return b && b.textContent; });
ok(/Ya no puede usar el TTS/.test(g||''), 'al tocar su nombre en el chat sale «🔇 Ya no puede usar el TTS»: '+g);
if (g) { await ev(()=>document.querySelector('#msheet button[data-a="ttsbl"]').click()); await W(500); }
ok((S.rwPosts||[]).some(x=>x.a==='ttsbl' && x.op==='add' && x.u==='malhablado'), 'y lo manda a la lista negra');

// 6) el feed dice por qué la regla no mandó el mensaje
S.ev.push({id:'rule:sc1:1',ts:Date.now(),d:{kind:'rule',ev:'scene',rid:'sc1',cat:'Offline',ok:true,note:'sin mensaje: no estabas en vivo (ni OBS transmitiendo)'}});
await ev(()=>window.kickfeed.apiPoll()); await W(500);
g=await ev(()=>[...document.querySelectorAll('#feed .item')].map(x=>x.textContent).find(t=>/Regla/.test(t)));
ok(/no estabas en vivo/.test(g||''), 'en el feed: '+g);
ok(errs.length===0, 'sin errores: '+errs.join(' | '));
await ctx.close();

// 7) 🔊 el player de alertas lee el TTS de la recompensa
{ const S2={}; const ctx2=await b.newContext({viewport:{width:800,height:600}}); const PR={};
  await ablyRoutes(ctx2, S2);
  await ctx2.route('https://fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx2.route('https://kick-feed-mariotq.vercel.app/**', r=>{ const u=new URL(r.request().url()); if (rtHandle(u, r, S2, PR)) return;
    const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    if (u.searchParams.get('a')==='cfg') return J({ok:true,cfg:{on:true,vol:80,ttsVol:80,ttsMax:140,look:'tarjeta',gap:0.2,ttsMotor:'servidor',ttsVoz:'mia',ttsFiltro:true,ttsBl:['feo'],pf:{kick:{},tw:{}}},files:{}});
    if (u.searchParams.get('a')==='tts'){ S2.said=(S2.said||[]).concat([u.searchParams.get('t')]); return r.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.alloc(900)}); }
    if (u.searchParams.get('a')==='poll') return J({ok:true,now:Date.now(),live:{kick:true,tw:false},list:[]});
    return J({ok:true}); });
  await ctx2.addInitScript(()=>{ window.Audio=function(){ return {src:'',volume:1,play(){ setTimeout(()=>this.onended&&this.onended(),50); return Promise.resolve(); },pause(){},addEventListener(n,f){ if(n==='ended') this.onended=f; }}; };
    URL.createObjectURL=()=>'blob:x'; URL.revokeObjectURL=()=>{}; });
  const p2=await ctx2.newPage(); const e2=[]; p2.on('pageerror',e=>e2.push(String(e)));
  await p2.goto('file://'+RAIZ+'/alertas-player.html'); await W(1500);
  await p2.evaluate(()=>window.alertasPlayer.take([{id:'t1',ts:Date.now(),k:'tts',pf:'kick',u:'Pepe',m:'hola mundo eres feo',who:1}])); await W(900);
  g=await p2.evaluate(()=>document.getElementById('st').textContent);
  ok(/Pepe/.test(g) && /hola mundo eres/.test(g) && !/feo/.test(g), 'el player muestra quién y su mensaje (con tu filtro de groserías): '+g);
  ok((S2.said||[]).some(t=>/^Pepe dice: hola mundo eres$/.test(t.trim())), 'y lo dice con la voz de tus alertas: '+JSON.stringify(S2.said));
  ok(e2.length===0, 'sin errores (player): '+e2.join(' | '));
  await ctx2.close(); }

console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
