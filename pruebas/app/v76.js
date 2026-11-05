const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
const {chromium}=require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const H={'access-control-allow-origin':'*'};
let S;
function reset(){ S={posts:[], tw:{posts:[]}, ev:[], live:true,
  twState:{on:true, live:{is_live:true, started_at:new Date(Date.now()-1800e3).toISOString()}, session:{live:true}, totals:{subs:7,bits:500,from:1}, vw:{n:23}, poll:null, pred:null, hype:null, ad:null},
  status:{ok:true, configured:true, channel:'mariotq', me:{login:'mariotq', name:'MarioTQ', id:'111', missing:[]}, bot:{login:'tq_bot_irl', name:'TQ_bot_IRL'}}}; }
reset();
async function mk(vw, vh, cfg, bar){
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
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{ const u=new URL(r.request().url()); let body={}; try{ body=JSON.parse(r.request().postData()||'{}'); }catch(e){}
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
  const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('file://'+RAIZ+'/index.html?keep=0&key=K3y'); await W(2600);
  return {ctx, page, errs, ev:(c,a)=>page.evaluate(c,a)};
}
const C='chatrooms.6635680.v2';
const kmsg=(ev,id,u,t)=>ev(([id,u,t,C])=>window.kickfeed.handle('App\\Events\\ChatMessageEvent',{id,content:t,type:'message',sender:{id:id.length,username:u,identity:{color:'#fff',badges:[]}}},C),[id,u,t,C]);
const irc=(ev,line)=>ev(l=>window.irc(l), line);


const kmsgB=(ev,id,u,t,badges)=>ev(([id,u,t,badges,C])=>window.kickfeed.handle('App\\Events\\ChatMessageEvent',{id,content:t,type:'message',sender:{id:id.length,username:u,identity:{color:'#53fc18',badges}}},C),[id,u,t,badges,C]);
const rect=(ev,id)=>ev(id=>{ const e=document.getElementById(id); if (!e || !e.getClientRects().length) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height)}; }, id);


/* ===== 1. marquitas K/T solo en multistream ===== */
reset(); S.live=false;                     // solo en Twitch
let {ctx, page, errs, ev}=await mk(375, 720, {});
await ev(()=>window.kickfeed.apiPoll()); await W(700);
await irc(ev, '@badges=;color=#FF0000;display-name=SoloTw;emotes=;id=s1;user-id=1 :solotw!s@x PRIVMSG #mariotq :hola');
await kmsg(ev,'sk1','kicker','desde kick'); await W(400);
ok(await ev(()=>!document.querySelector('.cm[data-id="s1"] .pfc') && !document.querySelector('.cm[data-id="sk1"] .pfc')), 'en vivo solo en Twitch: sin marquitas K/T en el chat');
S.live=true; await ev(()=>window.kickfeed.apiPoll()); await W(900);
await irc(ev, '@badges=;color=#FF0000;display-name=Ambos;emotes=;id=s2;user-id=2 :ambos!s@x PRIVMSG #mariotq :ya en las dos');
await W(400);
ok(await ev(()=>!!document.querySelector('.cm[data-id="s2"] .pfc.t') && !!document.querySelector('.cm[data-id="s1"] .pfc.t')), 'en multistream sí (y los de antes también se marcan)');
ok(errs.length===0, 'sin errores (1): '+errs.join(' | '));
await ctx.close();

/* ===== 2. ↻ repetir alertas desde el feed y raids de Kick para tus alertas ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {on:false}));
S.ev.push({id:'k:g1',ts:Date.now()-5000,d:{kind:'gift',user:'donmario',count:5}},{id:'tw:b3',ts:Date.now()-3000,d:{kind:'bits',pf:'tw',user:'Bitero',amount:500,message:'Cheer500 vamos'}});
await ev(()=>window.kickfeed.apiPoll()); await W(700);
let g=await ev(()=>[...document.querySelectorAll('#feed .item')].filter(x=>x.querySelector('.rp')).map(x=>x.textContent.slice(0,30)));
ok(g.length>=2, 'las alertas del feed traen ↻: '+g.join(' | '));
await ev(()=>{ const it=[...document.querySelectorAll('#feed .item')].find(x=>/donmario/.test(x.textContent)); it.querySelector('.rp').click(); }); await W(200);
ok(await ev(()=>/Repetir/.test([...document.querySelectorAll('#feed .item')].find(x=>/donmario/.test(x.textContent)).querySelector('.rp').textContent)) && !(S.al||[]).length, 'el primer toque solo pregunta (no sale por accidente)');
await ev(()=>{ const it=[...document.querySelectorAll('#feed .item')].find(x=>/donmario/.test(x.textContent)); it.querySelector('.rp').click(); }); await W(500);
let rq=(S.al||[]).find(x=>/a=replay|replay/.test(x.a||'') || x.body && x.body.al);
ok(rq && rq.body.al.k==='gift' && rq.body.al.pf==='kick' && rq.body.al.u==='donmario' && rq.body.al.n===5, 'el segundo toque la repite: '+JSON.stringify(rq && rq.body.al));
await ev(()=>{ const it=[...document.querySelectorAll('#feed .item')].find(x=>/Bitero/.test(x.textContent)); it.querySelector('.rp').click(); it.querySelector('.rp').click(); }); await W(500);
rq=(S.al||[]).filter(x=>x.body && x.body.al && x.body.al.k==='bits').pop();
ok(rq && rq.body.al.pf==='tw' && rq.body.al.n===500 && rq.body.al.m==='vamos', 'los bits de Twitch también (sin «Cheer500»): '+JSON.stringify(rq && rq.body.al));
S.al=[];
await ev(()=>window.kickfeed.handle('App\\Events\\StreamHostEvent',{host_username:'AmigoKick',number_viewers:25},'channel.6635680')); await W(500);
ok((S.al||[]).some(x=>x.body.al && x.body.al.k==='raid' && x.body.al.u==='AmigoKick' && x.body.al.n===25), 'un raid de Kick (que solo ve la app) se le pasa a tus alertas');
// Ajustes → Alertas
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/^Alertas/.test((x.querySelector('.tx')||x).textContent)).click()); await W(500);
g=await ev(()=>({t:document.getElementById('cpanel').textContent, a:(document.querySelector('#cpanel a.op')||{}).href||''}));
ok(/Abrir Alertas Studio/.test(g.t) && /alertas\.html\?key=K3y/.test(g.a), 'Ajustes → Alertas: abre tu Studio con tu clave');
await page.click('#cpanel .op[data-k="alRp"]'); await W(300);
ok(await ev(()=>!document.querySelector('#feed .item .rp')), 'y el ↻ se puede quitar');
ok(errs.length===0, 'sin errores (2): '+errs.join(' | '));
await ctx.close();

/* ===== 3. Diseño ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {on:false}));
S.ev.push({id:'k:g2',ts:Date.now()-5000,d:{kind:'gift',user:'donmario',count:5}});
await ev(()=>window.kickfeed.apiPoll()); await W(500);
ok(await ev(()=>document.body.classList.contains('th-tarjetas') && document.body.classList.contains('fcard')), 'de entrada: Tarjetas (compactas)');
let hT=await ev(()=>Math.round(document.querySelector('#feed .item.gift').getBoundingClientRect().height));
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/^Diseño/.test((x.querySelector('.tx')||x).textContent)).click()); await W(500);
g=await ev(()=>[...document.querySelectorAll('#cpanel .dsc')].map(x=>x.getAttribute('data-th')+(x.classList.contains('on')?'*':'')));
ok(g.join(',')==='tarjetas*,cristal,clasico,grafito', 'Diseño: Tarjetas, Cristal, Clásico y Grafito: '+g.join(','));
await page.click('#cpanel .dsc[data-th="cristal"]'); await W(400);
ok(await ev(()=>document.body.classList.contains('th-cristal') && !document.body.classList.contains('th-tarjetas') && JSON.parse(localStorage.getItem('kickfeed.chatcfg')).theme==='cristal'), 'elegir Cristal (y se guarda)');
await page.screenshot({path:require('os').tmpdir()+'/t76_diseno.png'});
await page.click('#cpanel .dsc[data-th="clasico"]'); await W(400);
ok(await ev(()=>document.body.classList.contains('th-clasico') && !document.body.classList.contains('fcard') && !document.querySelector('#feed .item .ic svg')), 'Clásico: la lista de siempre');
ok(hT<=56, 'las tarjetas ya son compactas ('+hT+' px)');
ok(errs.length===0, 'sin errores (3): '+errs.join(' | '));
await ctx.close();
// si venías de «la lista de antes», te quedas en Clásico
({ctx, page, errs, ev}=await mk(375, 720, {on:false, fstyle:'list'}));
ok(await ev(()=>document.body.classList.contains('th-clasico')), 'quien tenía «la lista de antes» queda en Clásico');
await ctx.close();
await b.close();
console.log(fails ? '\n'+fails+' FALLAS' : '\nTODO OK');
process.exit(fails?1:0);
})();
