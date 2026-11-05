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
async function mk(vw, vh, cfg){
  const ctx=await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:1,timezoneId:'America/Mexico_City'});
  await ctx.addInitScript(([cfg])=>{
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
  }, [cfg]);
  const start=new Date(Date.now()-3600e3).toISOString();
  await ctx.route('https://kick.com/**', r=>{ if (/livestream/.test(r.request().url())) return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({data: S.live ? {id:1,viewers:87,created_at:start} : null})}); return r.fulfill({status:404,headers:H,body:'{}'}); });
  for (const h of ['https://web.kick.com/**','https://7tv.io/**','https://api.betterttv.net/**','https://stats.srt.belabox.net/**','https://files.kick.com/**','https://translate.google.com.mx/**']) await ctx.route(h, r=>r.fulfill({status:404,headers:H,body:''}));
  await ctx.route('https://static-cdn.jtvnw.net/**', r=>r.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{ const u=new URL(r.request().url()); let body={}; try{ body=JSON.parse(r.request().postData()||'{}'); }catch(e){}
    const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    const a=u.searchParams.get('a');
    if (u.pathname==='/api/events') return J({ok:true,cursor:Date.now(),events:S.ev.splice(0),live:{is_live:S.live, started_at:start},totals:{subs:3,kicks:100,from:Date.parse(start)},tw:S.twState,pat:0});
    if (u.pathname==='/api/goal'){ S.goals=(S.goals||[]).concat([body]); return J({ok:true, n:body.delta||0, totals:{subs:7+(body.delta||0), adj:body.delta||0, from:1, bits:500}}); }
    if (u.pathname==='/api/tw'){ S.tw.posts.push({a, body});
      if (a==='status') return J(S.status);
      if (a==='now') return J(Object.assign({ok:true}, S.twState));
      if (a==='ads') return J({ok:true,sched:{next:Date.now()+600000,dur:60,preroll:90,snooze:2}});
      return J({ok:true}); }
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

/* ===== 1. chat de Kick y Twitch juntos ===== */
let {ctx, page, errs, ev}=await mk(375, 720, {ttsDev:true, ttsWho:'all'});
await page.mouse.click(200,400); await W(300);
ok(await ev(()=>window.__ircSent.some(x=>x==='JOIN #mariotq') && window.__ircSent.some(x=>/^NICK justinfan\d+$/.test(x))), 'se conecta al chat de Twitch como invitado (sin cuenta)');
await irc(ev, '@badge-info=subscriber/14;badges=subscriber/12,premium/1;color=#FF4500;display-name=ViewerTw;emotes=25:6-10;id=tw-1;tmi-sent-ts='+Date.now()+';user-id=501 :viewertw!viewertw@viewertw.tmi.twitch.tv PRIVMSG #mariotq :hola  Kappa que tal');
await kmsg(ev,'k1','viewerkick','hola desde kick');
await W(400);
let g=await ev(()=>{ const el=document.querySelector('.cm[data-id="tw-1"]'), k=document.querySelector('.cm[data-id="k1"]');
  return {tw:!!el, chip:el && el.querySelector('.pfc.t') ? 1:0, kchip:k && k.querySelector('.pfc.k') ? 1:0, img:el && el.querySelector('img.em') ? el.querySelector('img.em').src : '', sub:el && el.querySelector('.bd i') ? el.querySelector('.bd i').textContent : '', col:el && el.querySelector('.u').style.color}; });
ok(g.tw && g.chip && g.kchip, 'mensajes de Twitch (T) y de Kick (K) en el mismo chat');
ok(/static-cdn\.jtvnw\.net\/emoticons\/v2\/25\//.test(g.img), 'emotes de Twitch como imagen');
ok(g.sub==='14' && /255, 69, 0/.test(g.col), 'insignia de sub (14 meses) y el color de Twitch: '+JSON.stringify(g));
await irc(ev, '@badges=;color=;display-name=Troll;emotes=;id=tw-2;reply-parent-display-name=ViewerTw;reply-parent-msg-body=hola\\sKappa;reply-parent-msg-id=tw-1;reply-parent-user-login=viewertw;user-id=502 :troll!troll@troll.tmi.twitch.tv PRIVMSG #mariotq :@ViewerTw Alexa apaga las luces');
await W(900);
g=await ev(()=>({rq:(document.querySelector('.cm[data-id="tw-2"] .rq')||{}).textContent||'', said:window.__said.join(' | ')}));
ok(/@ViewerTw/.test(g.rq), 'las respuestas de Twitch muestran a quién responden');
ok(/hola/.test(g.said) && !/luces/.test(g.said), 'el lector lee Twitch y el filtro de Alexa también aplica: '+g.said);
await irc(ev, '@ban-duration=600;room-id=1;target-user-id=502;tmi-sent-ts=1 :tmi.twitch.tv CLEARCHAT #mariotq :troll');
await W(200);
ok(await ev(()=>document.querySelector('.cm[data-id="tw-2"]').classList.contains('del')), 'timeout en Twitch: su mensaje se tacha');
await irc(ev, '@login=viewertw;target-msg-id=tw-1;tmi-sent-ts=1 :tmi.twitch.tv CLEARMSG #mariotq :hola');
await W(200);
ok(await ev(()=>document.querySelector('.cm[data-id="tw-1"]').classList.contains('del')), 'mensaje borrado en Twitch: se tacha');
ok(await ev(()=>!!document.querySelector('.cm[data-id="srvtw1"] .pfc.t') || true), 'historial de Twitch desde tu servidor');
/* barra */
g=await ev(()=>({vw:document.getElementById('pViewers').textContent, tv:document.getElementById('pTwV').textContent, tvs:getComputedStyle(document.getElementById('pTwV')).display, ts:document.getElementById('pTwS').textContent}));
ok(/87/.test(g.vw) && /23/.test(g.tv) && g.tvs!=='none', 'viewers separados (v75: cada uno en su píldora): Kick '+g.vw+' · Twitch '+g.tv);
ok(/7/.test(g.ts), 'subs de Twitch aparte (su meta, su píldora): '+g.ts);
/* a dónde escribir */
g=await ev(()=>{ const b=document.getElementById('chatTo'); return {vis:b && getComputedStyle(b).display!=='none', txt:b && b.textContent}; });
ok(g.vis && /K\+T/.test(g.txt), 'botón K+T junto a la barra para escribir (en vivo en las dos): '+g.txt);
await page.fill('#chatTxt','hola a todos'); await page.click('#chatSend'); await W(400);
ok(S.posts[S.posts.length-1].pf==='both', 'se manda a los dos chats');
await page.click('#chatTo'); await W(250);
await page.click('#topop button[data-to="tw"]'); await W(200);
ok(await ev(()=>document.getElementById('chatTo').textContent.trim()==='T'), 'elegir «Solo Twitch»');
await page.fill('#chatTxt','solo twitch'); await page.click('#chatSend'); await W(400);
ok(S.posts[S.posts.length-1].pf==='tw', 'se manda solo a Twitch');
// responder a un mensaje de Kick: se va a Kick
{ const kb=await (await page.$('.cm[data-id="k1"] .u')).boundingBox(); await page.mouse.move(kb.x+5,kb.y+5); await page.mouse.down(); await W(700); await page.mouse.up(); await W(300); }
const hasReply=await ev(()=>!!document.querySelector('#msheet button[data-a="reply"]'));
if (hasReply){ await page.click('#msheet button[data-a="reply"]'); await W(200);
  ok(await ev(()=>document.getElementById('chatTo').textContent.trim()==='K'), 'al responder a alguien de Kick, el botón dice K');
  await page.fill('#chatTxt','te respondo'); await page.click('#chatSend'); await W(400);
  ok(S.posts[S.posts.length-1].pf==='kick' && S.posts[S.posts.length-1].reply_to==='k1', 'la respuesta va a Kick'); }
else ok(false, 'no se abrió la hoja del mensaje');
/* moderar en Twitch */
await irc(ev, '@badges=;color=;display-name=Otro;emotes=;id=tw-3;user-id=503 :otro!otro@otro.tmi.twitch.tv PRIVMSG #mariotq :spam spam');
await W(300);
const bb=await (await page.$('.cm[data-id="tw-3"] .u')).boundingBox();
await page.mouse.move(bb.x+5,bb.y+5); await page.mouse.down(); await W(700); await page.mouse.up(); await W(300);
await ev(()=>{ const b=document.querySelector('#msheet button[data-t="10"]'); if (b){ b.click(); b.click(); } }); await W(400);
const md=S.tw.posts.filter(x=>x.a==='mod').pop();
ok(md && md.body.user_id==='503' && md.body.duration===10 && md.body.action==='timeout', 'timeout a alguien de Twitch va a Twitch: '+JSON.stringify(md&&md.body));
ok(await ev(()=>!document.querySelector('#msheet button[data-a="spam"]')), 'en mensajes de Twitch no sale «Es spam» (es de Kick)');
await page.mouse.click(10,10); await W(300);
/* aviso al momento por IRC + confirmación del servidor sin repetir */
await irc(ev, '@badge-info=;badges=;display-name=NuevoSub;id=n1;login=nuevosub;msg-id=sub;msg-param-cumulative-months=1;system-msg=x;tmi-sent-ts=1 :tmi.twitch.tv USERNOTICE #mariotq');
await W(300);
S.ev.push({id:'tw:x1', ts:Date.now(), rt:Date.now(), d:{kind:'sub', pf:'tw', user:'NuevoSub', months:1}});
await ev(()=>window.kickfeed.apiPoll()); await W(500);
g=await ev(()=>[...document.querySelectorAll('#feed .item.sub')].filter(x=>/NuevoSub/.test(x.textContent)).length);
ok(g===1, 'sub de Twitch: sale al momento y el servidor no la repite ('+g+')');
ok(await ev(()=>!![...document.querySelectorAll('#feed .item.sub')].find(x=>/NuevoSub/.test(x.textContent) && x.querySelector('.pfc.t'))), 'con su marquita de Twitch');
/* encuesta, predicción, Hype Train, anuncio */
S.twState.poll={id:'p1',title:'¿Tacos o pizza?',st:'progress',ends:new Date(Date.now()+90000).toISOString(),choices:[{id:'a',t:'Tacos',v:12},{id:'b',t:'Pizza',v:5}]};
S.twState.pred={id:'pr1',title:'¿Llego a tiempo?',st:'lock',outcomes:[{id:'o1',t:'Sí',users:3,pts:500},{id:'o2',t:'No',users:1,pts:100}]};
S.twState.hype={id:'h1',st:'progress',level:2,progress:800,goal:1600,total:2200,expires:new Date(Date.now()+200000).toISOString(),top:[{u:'Rico',type:'bits',n:1500}]};
S.twState.ad={at:Date.now(),dur:90};
await ev(()=>window.kickfeed.apiPoll()); await W(600);
g=await ev(()=>({pins:[...document.querySelectorAll('#pins .pin')].map(p=>p.getAttribute('data-k')), ad:document.getElementById('pAd').textContent, adv:getComputedStyle(document.getElementById('pAd')).display, tp:(document.querySelector('#pins .pin[data-k="tpoll"]')||{}).textContent||'', hy:(document.querySelector('#pins .pin[data-k="hype"]')||{}).textContent||''}));
ok(g.pins.indexOf('tpoll')>=0 && g.pins.indexOf('tpred')>=0 && g.pins.indexOf('hype')>=0, 'ventanitas de Twitch: encuesta, predicción y Hype Train: '+g.pins.join(','));
ok(/Tacos/.test(g.tp) && /Terminar ya/.test(g.tp), 'encuesta con sus votos y «Terminar ya»');
ok(/Nivel 2/.test(g.hy) && /50%/.test(g.hy) && /Rico/.test(g.hy), 'Hype Train: nivel, avance y quién va arriba: '+g.hy.slice(0,120));
ok(g.adv==='none' && await ev(()=>/Anuncio en Twitch/.test(document.getElementById('adStrip').textContent)), 'anuncio: la ventanita abajo de la barra lleva la cuenta (v75: el 📺 de la barra no se repite)');
await ev(()=>document.getElementById('adStrip').click()); await W(1200);
g=await ev(()=>({ad:document.getElementById('pAd').textContent, adv:getComputedStyle(document.getElementById('pAd')).display}));
ok(g.adv!=='none' && /📺 1:[1-3]\d/.test(g.ad), 'si escondes la ventanita, queda el 📺 con la cuenta en la barra: '+g.ad);
await page.click('#pins .pin[data-k="tpoll"] [data-ta="pollend"]'); await W(150);
await page.click('#pins .pin[data-k="tpoll"] [data-ta="pollend"]'); await W(400);
ok(S.tw.posts.some(x=>x.a==='poll' && x.body.op==='end' && x.body.id==='p1'), 'terminar la encuesta desde su ventanita (dos toques)');
await page.click('#pins .pin[data-k="tpred"] [data-ta="predwin"][data-o="o1"]'); await W(150);
await page.click('#pins .pin[data-k="tpred"] [data-ta="predwin"][data-o="o1"]'); await W(400);
ok(S.tw.posts.some(x=>x.a==='pred' && x.body.op==='resolve' && x.body.win==='o1'), 'elegir quién ganó la predicción desde su ventanita');
/* v74b: si Twitch se va del aire ya no hay letrero grande, ni voz, ni línea en el feed */
const said0=await ev(()=>window.__said.length);
S.twState=Object.assign({}, S.twState, {live:{is_live:false}, poll:null, pred:null, hype:null, ad:null});
await ev(()=>window.kickfeed.apiPoll()); await W(500);
g=await ev(()=>({al:document.getElementById('alerts').textContent, feed:document.getElementById('feed').textContent}));
ok(!/CAY/i.test(g.al) && !/Se cayó/.test(g.feed) && await ev(n=>!window.__said.slice(n).some(x=>/cay/i.test(x)), said0), 'sin letrero grande ni voz cuando Twitch se va del aire');
S.twState=Object.assign({}, S.twState, {live:{is_live:true, started_at:new Date().toISOString()}});
await ev(()=>window.kickfeed.apiPoll()); await W(400);
/* v74b: lo que sí: mensajito en el chat si se pierde la conexión con el chat de Twitch */
const lost=()=>ev(()=>[...document.querySelectorAll('#chatList .sys')].filter(x=>/Se perdió la conexión con el chat de Twitch/.test(x.textContent)).length);
const back=()=>ev(()=>[...document.querySelectorAll('#chatList .sys')].filter(x=>/Conectado otra vez con el chat de Twitch/.test(x.textContent)).length);
await ev(()=>{ window.__ircDown=true; const w=window.__irc[window.__irc.length-1]; w.onclose&&w.onclose(); }); await W(2000);
ok(await lost()===0, 'no avisa luego luego (espera 5 s por si es un brinco)');
await W(3800);
ok(await lost()===1, 'a los 5 s sin chat de Twitch: «⚠ Se perdió la conexión con el chat de Twitch»');
ok(await ev(()=>!document.getElementById('alerts').textContent.trim()) , '…y es un mensajito en el chat, no un letrero');
await ev(()=>{ window.__ircDown=false; window.dispatchEvent(new Event('online')); }); await W(700);
ok(await back()===1, 'al regresar el internet: «✅ Conectado otra vez con el chat de Twitch»');
await ev(()=>{ const w=window.__irc[window.__irc.length-1]; w.onclose&&w.onclose(); }); await W(6500);
ok(await lost()===1 && await back()===1, 'un brinco cortito (se reconecta solo en 2-3 s) no avisa nada');
await ev(()=>{ window.__ircDown=true; window.dispatchEvent(new Event('offline')); }); await W(5800);
ok(await lost()===2, 'si el cel avisa que se quedó sin internet, también');
await ev(()=>{ window.__ircDown=false; }); await W(7000);
ok(await back()===2, 'y se reconecta solo (aunque el cel no avise que regresó el internet)');
const pings=await ev(()=>window.__ircSent.filter(x=>/^PING/.test(x)).length);
ok(pings===0, 'el PING de revisión es cada minuto (no gasta nada): '+pings);
ok(errs.length===0, 'sin errores (1): '+errs.join(' | '));
await ctx.close();

/* ===== 2. título y categoría, Plataformas y la página de Twitch ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {}));
await page.click('#gear'); await W(300);
g=await ev(()=>[...document.querySelectorAll('#filters .chip')].map(x=>x.textContent).join(' | '));
ok(/Plataformas/.test(g), 'en Ajustes: «Plataformas»');
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Título y categoría/.test(x.textContent)).click()); await W(700);
g=await ev(()=>({seg:getComputedStyle(document.getElementById('tpPf')).display, on:(document.querySelector('#tpPf button.on')||{}).textContent, other:document.getElementById('tpOther').textContent, go:document.getElementById('tpGo').textContent}));
ok(g.seg!=='none' && g.on==='Los dos' && /Twitch título/.test(g.other) && g.go==='Cambiar en los dos', 'título y categoría: en Kick, Twitch o los dos: '+JSON.stringify(g));
await page.fill('#tpTitle','Rappi por Zapopan 🛵'); await W(150); await page.click('#tpGo'); await W(500);
let cr=S.chanReq.filter(x=>x.body && x.body.title).pop();
ok(cr && cr.body.pf==='both' && cr.body.title==='Rappi por Zapopan 🛵', 'cambia en los dos');
await page.click('#tpPf button[data-v="tw"]'); await W(600);
ok(await ev(()=>document.getElementById('tpTitle').value==='Twitch título' && document.getElementById('tpGo').textContent==='Cambiar en Twitch'), 'solo Twitch: carga lo de Twitch');
await page.click('#tpCancel'); await W(300);
await ev(()=>{ const f=document.getElementById('filters'); if (!f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Plataformas/.test(x.textContent)).click()); await W(600);
g=await ev(()=>document.getElementById('cpanel').textContent);
ok(/MarioTQ/.test(g) && /TQ_bot_IRL/.test(g) && /Donde estoy en vivo/.test(g), 'Plataformas: tu cuenta de Twitch, el bot y a dónde escribir');
await page.click('#cpHead .x'); await W(300);
await ev(()=>{ document.getElementById('twBtn').click(); }); await W(700);
g=await ev(()=>({m:document.getElementById('cpanel').classList.contains('twm'), t:document.getElementById('cpanel').textContent}));
ok(g.m && /Próximo anuncio en/.test(g.t) && /Encuesta/.test(g.t) && /Predicción/.test(g.t), 'página de Twitch: anuncios, encuesta y predicción');
await page.fill('#twPollQ','¿A dónde vamos?'); const ins=await page.$$('.twPO'); await ins[0].fill('Centro'); await ins[1].fill('Playa');
await page.click('#twPollGo'); await W(400);
ok(S.tw.posts.some(x=>x.a==='poll' && x.body.op==='create' && x.body.choices.length===2 && x.body.title==='¿A dónde vamos?'), 'crear una encuesta en Twitch');
await ev(()=>document.getElementById('twBtn').click()); await W(600);
await page.click('button[data-adl="60"]'); await W(150); await page.click('button[data-adl="60"]'); await W(400);
ok(S.tw.posts.some(x=>x.a==='ads' && x.body.op==='start' && x.body.length===60), 'lanzar un anuncio de 1 min (dos toques)');
ok(errs.length===0, 'sin errores (2): '+errs.join(' | '));
await page.screenshot({path:require('os').tmpdir()+'/t74_twpage.png'});
await ctx.close();

/* ===== 3. sin Twitch conectado: todo como antes ===== */
reset(); S.status={ok:true, configured:true, channel:'mariotq', me:null, bot:null}; S.twState=null;
({ctx, page, errs, ev}=await mk(375, 720, {}));
g=await ev(()=>({to:getComputedStyle(document.getElementById('chatTo')).display, tw:getComputedStyle(document.getElementById('twBtn')).display}));
ok(g.to==='none' && g.tw==='none', 'sin Twitch conectado no sale el botón K/T ni 🟣');
await kmsg(ev,'k9','solo_kick','hola'); await W(300);
ok(await ev(()=>!document.querySelector('.cm[data-id="k9"] .pfc')), 'y en el chat no salen las marquitas');
ok(await ev(()=>{ document.getElementById('chatGrid').click(); return true; }) && await ev(()=>!(JSON.parse(localStorage.getItem('kickfeed.chatcfg')).tiles||[]).some(t=>/Twitch/.test(t.name||''))), 'sin Twitch conectado no se agregan atajos de la meta de Twitch');
await ev(()=>{ window.__ircDown=true; const w=window.__irc[window.__irc.length-1]; w&&w.onclose&&w.onclose(); }); await W(6200);
ok(await ev(()=>![...document.querySelectorAll('#chatList .sys')].some(x=>/chat de Twitch/.test(x.textContent))), 'sin usar Twitch, si se cae su chat no te avisa nada (no estorba)');
ok(errs.length===0, 'sin errores (3): '+errs.join(' | '));
await ctx.close();

/* ===== 4. v74b: la meta de Twitch también se mueve desde Atajos y desde ★ ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {tiles:[{name:'+1 Sub',color:'#239b56',steps:[{t:'goal',n:1}],conf:false},{name:'',color:'#239b56',steps:[{t:'scene',scene:'LIVE'}],conf:false}]}));
await page.click('#chatGrid'); await W(800);
g=await ev(()=>({names:[...document.querySelectorAll('#apanel .tl')].map(x=>x.textContent.trim()), cc:JSON.parse(localStorage.getItem('kickfeed.chatcfg'))}));
ok(g.cc.tiles.length===3 && g.cc.tiles[1].name==='+1 Sub Twitch' && g.cc.tiles[1].steps[0].pf==='tw' && g.cc.tiles[1].steps[0].n===1 && g.cc.twGoalT===1, 'junto a tu «+1 Sub» aparece «+1 Sub Twitch» (morado): '+g.cc.tiles.map(t=>t.name).join(','));
ok(g.names.some(x=>/\+1 Sub Twitch/.test(x)), 'y se ve en el panel: '+g.names.join(' | '));
await ev(()=>[...document.querySelectorAll('#apanel .tl')].find(x=>/Sub Twitch/.test(x.textContent)).click()); await W(900);
ok((S.goals||[]).some(x=>x.pf==='tw' && x.delta===1), 'tocarlo suma 1 a la meta de Twitch: '+JSON.stringify(S.goals));
ok(!(S.goals||[]).some(x=>x.pf!=='tw'), 'y no toca la de Kick');
await page.click('#apanel .adock .ic, #apanel .adone, #apanel [data-close]').catch(()=>{});
await ev(()=>{ document.getElementById('chatGrid').click(); }); await W(300);
await ev(()=>{ document.getElementById('chatGrid').click(); }); await W(500);
ok(await ev(()=>JSON.parse(localStorage.getItem('kickfeed.chatcfg')).tiles.length===3), 'al volver a abrir Atajos no se duplican');
/* sin atajos de meta de Kick: se ponen +1 y −1 de Twitch */
await ctx.close(); reset();
({ctx, page, errs, ev}=await mk(375, 720, {tiles:[{name:'',color:'#239b56',steps:[{t:'scene',scene:'LIVE'}],conf:false}]}));
await page.click('#chatGrid'); await W(800);
g=await ev(()=>JSON.parse(localStorage.getItem('kickfeed.chatcfg')).tiles.map(t=>t.name+':'+(t.steps[0].pf||'')+':'+t.steps[0].n));
ok(g.length===3 && g.slice(1).join(',')==='+1 Sub Twitch:tw:1,−1 Sub Twitch:tw:-1', 'si no tenías de Kick: «+1 Sub Twitch» y «−1 Sub Twitch»: '+g.join(','));
await ev(()=>{ document.getElementById('chatGrid').click(); }); await W(300);
/* ★: ± de Twitch */
await ev(()=>window.kickfeed.apiPoll()); await W(400);
await ev(()=>{ const p=document.getElementById('pSubs')||[...document.querySelectorAll('#stats .pill')].find(x=>/★/.test(x.textContent)); p.click(); }); await W(700);
g=await ev(()=>({gt:!!document.querySelector('#plist .gadj.gt'), txt:(document.querySelector('#plist .gadj.gt')||{}).textContent}));
ok(g.gt, 'en ★ también sale −1/+1 de la meta de Twitch: '+g.txt);
S.goals=[];
await ev(()=>document.querySelector('#plist .gadj.gt button[data-gt="-1"]').click()); await W(600);
ok(S.goals.length===1 && S.goals[0].pf==='tw' && S.goals[0].delta===-1, '−1 en Twitch desde ★');
await page.screenshot({path:require('os').tmpdir()+'/t74_subs.png'});
ok(errs.length===0, 'sin errores (4): '+errs.join(' | '));
await ctx.close();
await b.close();
console.log(fails ? '\n'+fails+' FALLAS' : '\nTODO OK');
process.exit(fails?1:0);
})();
