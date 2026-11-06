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

/* ===== 1. barra: 👁 y ★ de Twitch aparte, y en dos renglones ===== */
let {ctx, page, errs, ev}=await mk(375, 720, {}, {rows:2});
await ev(()=>window.kickfeed.apiPoll()); await W(700);
let g=await ev(()=>({kv:document.getElementById('pViewers').textContent, tv:document.getElementById('pTwV').textContent, ks:document.getElementById('pSubs').textContent, ts:document.getElementById('pTwS').textContent,
  r2:[...document.getElementById('stats2').children].filter(e=>e.getClientRects().length).map(e=>e.id)}));
ok(g.kv==='👁 87' && g.tv==='👁 23' && g.ks==='★ 3' && g.ts==='★ 7', 'Kick y Twitch en sus propias píldoras (Twitch en morado): '+JSON.stringify(g));
ok(g.r2.indexOf('gear')===g.r2.length-1 && g.r2.indexOf('chatBtn')>=0 && g.r2.indexOf('pTwV')<0, 'dos renglones: abajo los botones (⚙ al final); arriba los números: '+g.r2.join(','));
let a=await rect(ev,'pViewers'), b2=await rect(ev,'chatBtn'), be=await rect(ev,'pBela');
ok(a && b2 && Math.abs(a.h-b2.h)<=1 && b2.t>a.b, 'los dos renglones del mismo alto ('+a.h+' y '+b2.h+' px) y uno abajo del otro');
g=await ev(()=>{ const s=document.getElementById('stats').getBoundingClientRect(), s2=document.getElementById('stats2').getBoundingClientRect();
  const k=[...document.getElementById('stats').children,...document.getElementById('stats2').children].filter(e=>e.getClientRects().length);
  return {over:k.filter(e=>{ const r=e.getBoundingClientRect(); return r.right>Math.max(s.right,s2.right)+1; }).map(e=>e.id), w:innerWidth, page:document.documentElement.scrollWidth}; });
ok(!g.over.length && g.page<=g.w, 'nada se sale de la barra: '+g.over.join(','));
await ev(()=>{ const el=document.getElementById('pBela'); el.style.display=''; el.className='pill ok'; el.textContent='📶 5840 Kbps'; dispatchEvent(new Event('resize')); }); await W(400);
g=await ev(()=>{ const c=e=>{ const r=document.getElementById(e).getBoundingClientRect(); return Math.round((r.top+r.bottom)/2); }; const bb=document.getElementById('bar').getBoundingClientRect(), br=document.getElementById('pBela').getBoundingClientRect();
  return {v:c('pViewers'), b:c('pBela'), g:c('gear'), right:Math.round(bb.right-br.right), up:document.getElementById('pUptime') ? document.getElementById('pUptime').parentNode.id : ''}; });
ok(Math.abs(g.v-g.b)<=3 && g.g>g.b+10 && g.right<=12, 'el bitrate hasta la derecha del renglón de arriba (nunca un tercer renglón): '+JSON.stringify(g));
// Ajustes → Barra de arriba: «Arriba / Abajo»
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Barra de arriba/.test(x.textContent)).click()); await W(500);
g=await ev(()=>({w:[...document.querySelectorAll('#cpanel .op[data-b="tws"] .w3 b')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')), names:[...document.querySelectorAll('#cpanel .op[data-b] .bn')].map(x=>x.textContent)}));
ok(g.w.join(',')==='Arriba*,Abajo,⋯,No sale' && g.names.indexOf('Subs de Twitch')>=0 && g.names.indexOf('Viewers de Twitch')>=0, 'en Ajustes: «Subs de Twitch» y «Viewers de Twitch», cada uno Arriba/Abajo/⋯/No sale: '+g.w.join(','));
ok(g.names.indexOf('Viewers de Twitch')===g.names.indexOf('Viewers')+1 && g.names.indexOf('Subs de Twitch')===g.names.indexOf('Subs del stream')+1, 'y quedan junto a los de Kick en el orden');
await page.click('#cpanel .op[data-b="tws"] .w3 b[data-w="r2"]'); await W(400);
g=await ev(()=>({p:document.getElementById('pTwS').parentNode.id, st:JSON.parse(localStorage.getItem('kickfeed.bar')).r2}));
ok(g.p==='stats2' && g.st.tws===true, 'mandar ★ de Twitch al renglón de abajo');
await page.click('#cpanel .op[data-b="chat"] .w3 b[data-w="r1"]'); await W(400);
ok(await ev(()=>document.getElementById('chatBtn').parentNode.id==='stats'), 'y el botón del chat arriba');
await page.screenshot({path:require('os').tmpdir()+'/t75_barcfg.png'});
await page.click('#cpanel .seg[data-k="brows"] button[data-v="1"]'); await W(400);
g=await ev(()=>({two:document.body.classList.contains('bar2'), p:document.getElementById('pTwS').parentNode.id, w:[...document.querySelectorAll('#cpanel .op[data-b="tws"] .w3 b')].map(b=>b.textContent).join(',')}));
ok(!g.two && g.p==='stats' && g.w==='Barra,⋯,No sale', 'con un renglón todo regresa a la barra de siempre');
await page.click('#cpHead .x'); await W(300);
ok(errs.length===0, 'sin errores (1): '+errs.join(' | '));
await ctx.close();

/* ===== 2. ventanita del anuncio ===== */
reset(); S.twState.ad={at:Date.now()-10000, dur:60, auto:true};
({ctx, page, errs, ev}=await mk(375, 720, {}));
await ev(()=>window.kickfeed.apiPoll()); await W(700);
g=await ev(()=>{ const s=document.getElementById('adStrip'); return {cls:s.className, t:s.textContent, top:Math.round(s.getBoundingClientRect().top), bar:Math.round(document.getElementById('bar').getBoundingClientRect().bottom)}; });
ok(/show/.test(g.cls) && /run/.test(g.cls) && /Anuncio en Twitch/.test(g.t) && /0:(4\d|5\d)/.test(g.t) && Math.abs(g.top-g.bar)<=2, 'mientras corre: ventanita abajo de la barra con la cuenta regresiva: '+g.t);
await page.screenshot({path:require('os').tmpdir()+'/t75_ad1.png'});
ok(await ev(()=>document.getElementById('adStrip').getBoundingClientRect().height<=40), 'v76: compacta (un renglón)');
await page.click('#adStrip button[data-ads="x"]'); await W(300);
ok(await ev(()=>!document.getElementById('adStrip').classList.contains('show')), 'la ✕ la cierra cuando quieras');
S.twState=Object.assign({}, S.twState, {ad:null, adsch:{next:Date.now()+60000, dur:90, snooze:2}});
await ev(()=>window.kickfeed.apiPoll()); await W(700);
g=await ev(()=>{ const s=document.getElementById('adStrip'); return {cls:s.className, t:s.textContent}; });
ok(/soon/.test(g.cls) && /Anuncio en/.test(g.t) && /\+5 min/.test(g.t), '90 s antes de uno automático: aviso con «+5 min»: '+g.t);
await page.screenshot({path:require('os').tmpdir()+'/t75_ad2.png'});
await page.click('#adStrip button[data-ads="snooze"]'); await W(600);
ok(S.tw.posts.some(x=>x.a==='ads' && x.body.op==='snooze'), 'posponer desde la ventanita');
ok(await ev(()=>!document.getElementById('adStrip').classList.contains('show')), 'y como ya faltan 6 min, se quita');
ok(errs.length===0, 'sin errores (2): '+errs.join(' | '));
await ctx.close();

/* ===== 3. chat de Twitch como en Twitch ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {ttsDev:true, ttsWho:'all'}));
await page.mouse.click(200,400); await W(300);
await irc(ev, '@emote-only=0;followers-only=-1;r9k=0;room-id=111;slow=30;subs-only=0 :tmi.twitch.tv ROOMSTATE #mariotq'); await W(1200);
await irc(ev, '@badge-info=subscriber/14;badges=subscriber/12,premium/1;color=;display-name=SinColor;emotes=;id=t1;tmi-sent-ts='+Date.now()+';user-id=501 :sincolor!sincolor@x PRIVMSG #mariotq :hola catJAM');
await irc(ev, '@badges=moderator/1;color=#0000FF;display-name=Azulito;emotes=;id=t2;user-id=502 :azulito!a@x PRIVMSG #mariotq :azul oscuro');
await irc(ev, '@badges=;color=#FF0000;display-name=Gifero;emotes=;gifs=0-17|abc|https://media4.giphy.com/media/abc/giphy.gif?cid=1&ct=g;id=t3;user-id=503 :gifero!g@x PRIVMSG #mariotq :[YAY GIF by alguien]');
await irc(ev, '@badges=;bits=100;color=;display-name=Bitero;emotes=;id=t4;user-id=504 :bitero!b@x PRIVMSG #mariotq :Cheer100 vamos');
await irc(ev, '@badges=;color=;display-name=Destacado;emotes=;id=t5;msg-id=highlighted-message;user-id=505 :destacado!d@x PRIVMSG #mariotq :mírame');
await irc(ev, '@badges=moderator/1;color=;display-name=ElMod;emotes=;id=t6;login=elmod;msg-id=announcement;msg-param-color=GREEN;user-id=506 :tmi.twitch.tv USERNOTICE #mariotq :Recuerden seguir las reglas');
await irc(ev, '@badges=;color=;display-name=Fiel;emotes=;id=t7;login=fiel;msg-id=viewermilestone;msg-param-category=watch-streak;msg-param-value=5;user-id=507 :tmi.twitch.tv USERNOTICE #mariotq :');
await irc(ev, '@badges=;color=;display-name=Respondon;emotes=25:13-17;id=t8;reply-parent-display-name=SinColor;reply-parent-msg-body=hola;reply-parent-msg-id=t1;reply-parent-user-login=sincolor;user-id=508 :respondon!r@x PRIVMSG #mariotq :@SinColor ok Kappa');
await irc(ev, '@badges=;color=;display-name=Nuevo;emotes=;first-msg=1;id=t9;user-id=509 :nuevo!n@x PRIVMSG #mariotq :hola primera vez');
await kmsgB(ev,'k1','unmodkick','hola desde kick',[{type:'moderator'},{type:'sub_gifter',count:60}]);
await W(1500);
g=await ev(()=>{ const q=id=>document.querySelector('.cm[data-id="'+id+'"]');
  return {b1:[...q('t1').querySelectorAll('.bd img')].map(i=>i.title), c1:getComputedStyle(q('t1').querySelector('.u')).color, c2:getComputedStyle(q('t2').querySelector('.u')).color,
    tp:!!q('t1').querySelector('img.em.tp'), gif:q('t3') && q('t3').querySelector('img.gif') ? q('t3').querySelector('img.gif').src : '', gift:q('t3') ? q('t3').textContent : '',
    cheer:q('t4') && q('t4').querySelector('.cheer') ? q('t4').querySelector('.cheer').textContent : '', hl:q('t5').classList.contains('hlm') && /destacado/i.test(q('t5').textContent),
    ann:q('t6') && q('t6').classList.contains('ann-green') && /Anuncio/.test(q('t6').textContent), streak:[...document.querySelectorAll('#chatList .sys')].some(x=>/5<\/b> streams seguidos|5 streams seguidos/.test(x.innerHTML.replace(/<b>/g,''))),
    rp:q('t8') ? q('t8').querySelector('.c').innerHTML : '', rx:document.getElementById('chatRx').textContent,
    kb:[...q('k1').querySelectorAll('.bd img')].map(i=>i.src.slice(0,26)+'|'+i.title)}; });
ok(await ev(()=>!document.querySelector('.cm[data-id="t1"]').classList.contains('first') && document.querySelector('.cm[data-id="t9"]').classList.contains('first')), 'en Twitch «primer mensaje» solo cuando Twitch lo dice (no a todos los de Twitch)');
ok(g.b1.join(',')==='1 año,Prime Gaming', 'insignias de Twitch como en Twitch (sub de tu canal y Prime): '+g.b1.join(','));
ok(g.c1!=='rgb(201, 206, 214)' && g.c1!=='', 'quien no eligió color tiene el que le pone Twitch: '+g.c1);
ok(g.c2!=='rgb(0, 0, 255)', 'el azul oscuro se aclara para que se lea (como Twitch): '+g.c2);
ok(g.tp, 'emotes de 7TV de tu canal de Twitch en el chat de Twitch');
ok(/media4\.giphy\.com\/media\/abc\/giphy\.gif/.test(g.gif) && !/YAY GIF/.test(g.gift), 'los GIFs de Twitch se ven (en lugar del texto)');
ok(g.cheer==='💎100', 'Cheer100 sale como 💎100');
ok(await ev(()=>document.querySelector('.cm[data-id="t4"]').classList.contains('bitsm') && !document.querySelector('#chatList .cm.evt.bits')), 'el Cheer sale una vez en el chat, resaltado (sin repetirlo como evento)');
ok(g.hl, 'mensaje destacado (puntos del canal) resaltado');
ok(g.ann, 'anuncio (/announce) con su color');
ok(g.streak, 'racha de streams seguidos');
ok(/emoticons\/v2\/25\//.test(g.rp) && !/@SinColor/.test(g.rp) && /ok/.test(g.rp), 'respuesta con emote: bien acomodado aunque traiga @ al principio: '+g.rp.replace(/<img[^>]+>/,'[img]'));
ok(/Modo lento 30 s/.test(g.rx), 'modos del chat de Twitch arriba del chat: '+g.rx);
ok(g.kb.length===2 && g.kb.every(x=>/^data:image\/svg\+xml/.test(x)) && /Moderador/.test(g.kb[0]) && /Ha regalado 60/.test(g.kb[1]), 'insignias de Kick con sus dibujos de Kick: '+g.kb.map(x=>x.split('|')[1]).join(','));
ok(await ev(()=>{ const L=[...document.querySelectorAll('.cm[data-id="k1"] .bd img')]; return L.length===2 && L.every(i=>i.complete && i.naturalWidth>0); }), 'las insignias de Kick sí se dibujan (no quedan en blanco)');
g=await ev(()=>window.__said.join(' | '));
ok(!/twe|twg|catJAM|Cheer100/.test(g), 'el lector no lee emotes, GIFs ni Cheer100: '+g);
await page.screenshot({path:require('os').tmpdir()+'/t75_chat.png'});
await irc(ev, '@room-id=111;tmi-sent-ts=1 :tmi.twitch.tv CLEARCHAT #mariotq'); await W(300);
g=await ev(()=>({del:document.querySelector('.cm[data-id="t2"]').classList.contains('del'), k:document.querySelector('.cm[data-id="k1"]').classList.contains('del'), sys:[...document.querySelectorAll('#chatList .sys')].some(x=>/Limpiaron el chat de Twitch/.test(x.textContent))}));
ok(g.del && !g.k && g.sys, 'si limpian el chat de Twitch, solo se tachan los de Twitch');
ok(errs.length===0, 'sin errores (3): '+errs.join(' | '));
await ctx.close();

/* ===== 4. reglas por plataforma y Eventos de Twitch ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {}));
await ev(()=>window.kickfeed.apiPoll()); await W(500);
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Reglas automáticas/.test(x.textContent)).click()); await W(600);
await page.click('#rlNew'); await W(500);
g=await ev(()=>({evs:[...document.querySelectorAll('#rlEv option')].map(o=>o.value), pf:!!document.getElementById('rlPf')}));
ok(['bits','hype','adstart'].every(k=>g.evs.indexOf(k)>=0) && !g.pf, 'eventos de Twitch en las reglas (bits, Hype Train, anuncio); «Mandan Kicks» no pregunta dónde: '+g.evs.join(','));
await page.selectOption('#rlEv','cat'); await W(300);
g=await ev(()=>({pf:[...document.querySelectorAll('#rlPf option')].map(o=>o.textContent), nt:document.querySelector('#cpanel .grp .nt').textContent}));
ok(g.pf.join(',')==='Kick o Twitch (las dos),Solo Kick,Solo Twitch', 'cambio de categoría: «Dónde» Kick, Twitch o las dos: '+g.pf.join(','));
await page.selectOption('#rlPf','tw'); await W(300);
await page.fill('#rlName','Slots & Casino');
g=await ev(()=>document.querySelector('#cpanel .grp .nt').textContent);
ok(/Solo cuando pase en Twitch/.test(g), 'explica que es solo de Twitch: '+g);
await page.screenshot({path:require('os').tmpdir()+'/t75_regla.png'});
await page.selectOption('#rlEv','bits'); await W(300);
ok(await ev(()=>!document.getElementById('rlPf') && /Solo existe en Twitch/.test(document.querySelector('#cpanel .grp .nt').textContent)), 'bits: solo existe en Twitch');
await page.click('#cpHead .x').catch(()=>{}); await W(300);
// Eventos: Twitch aparte
await ev(()=>{ const f=document.getElementById('filters'); if (!f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Eventos/.test(x.textContent)).click()); await W(500);
g=await ev(()=>({lb:[...document.querySelectorAll('#cpanel .lb2')].map(x=>x.textContent), tw:[...document.querySelectorAll('#cpanel .sw[data-p="tw"][data-f]')].map(x=>x.closest('.evt').textContent)}));
ok(g.lb.some(x=>/Twitch/.test(x)) && g.tw.indexOf('Bits')>=0 && g.tw.indexOf('Subs y resubs')>=0 && g.tw.indexOf('Raids')>=0, 'Eventos: Kick y Twitch por separado (Bits, Subs, Raids…): '+g.tw.join(','));
await page.screenshot({path:require('os').tmpdir()+'/t75_eventos.png'});
S.ev.push({id:'tw:s1',ts:Date.now(),d:{kind:'sub',pf:'tw',user:'SubTw',tier:'1000'}});
await ev(()=>window.kickfeed.apiPoll()); await W(400);
await kmsg(ev,'k9','x','y'); await ev(()=>window.kickfeed.handle('App\\Events\\SubscriptionEvent',{username:'SubKick',months:1},'channel.6635680'));
await W(400);
await page.click('#cpanel .sw[data-p="tw"][data-f="sub"]'); await W(300);
g=await ev(()=>({tw:[...document.querySelectorAll('#feed .item.sub')].filter(e=>/SubTw/.test(e.textContent)).map(e=>e.style.display), k:[...document.querySelectorAll('#feed .item.sub')].filter(e=>/SubKick/.test(e.textContent)).map(e=>e.style.display)}));
ok(g.tw.length && g.tw.every(x=>x==='none') && (!g.k.length || g.k.every(x=>x!=='none')), 'apagar «Subs» de Twitch esconde solo las de Twitch: '+JSON.stringify(g));
ok(errs.length===0, 'sin errores (4): '+errs.join(' | '));
await ctx.close();

/* ===== 5. feed en tarjetas y clips de Twitch ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {on:false}));
S.ev.push({id:'tw:s2',ts:Date.now()-5000,d:{kind:'sub',pf:'tw',user:'Lupita',tier:'1000'}},{id:'tw:g2',ts:Date.now()-4000,d:{kind:'gift',pf:'tw',user:'Rico',count:5}},
          {id:'tw:b2',ts:Date.now()-3000,d:{kind:'bits',pf:'tw',user:'Bitero',amount:500,message:'Cheer500 vamos'}},{id:'tw:r2',ts:Date.now()-2000,d:{kind:'raid',pf:'tw',user:'Amigo',viewers:34}});
await ev(()=>window.kickfeed.apiPoll()); await W(600);
g=await ev(()=>({card:document.body.classList.contains('fcard'), svg:[...document.querySelectorAll('#feed .item .ic')].filter(x=>x.querySelector('svg')).length, n:document.querySelectorAll('#feed .item').length}));
ok(g.card && g.svg>=4, 'el feed en tarjetas con íconos de color: '+JSON.stringify(g));
await page.screenshot({path:require('os').tmpdir()+'/t75_feed.png'});
await page.click('#gear'); await W(300);
await ev(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/^Diseño/.test(x.querySelector('.tx') ? x.querySelector('.tx').textContent : x.textContent)).click()); await W(500);
await ev(()=>document.querySelector('#cpanel .dsc[data-th="clasico"]').click()); await W(500);
ok(await ev(()=>!document.body.classList.contains('fcard') && !document.querySelector('#feed .item .ic svg')), 'y se puede regresar a la lista de antes');
await ev(()=>{ const f=document.getElementById('filters'); if (f.classList.contains('open')) document.getElementById('gear').click(); }); await W(300);
await ev(()=>window.kickfeed.openList && window.kickfeed.openList('clips'));
ok(errs.length===0, 'sin errores (5): '+errs.join(' | '));
await ctx.close();

/* ===== 6. atajos: mensaje y título en Kick, Twitch o donde estés en vivo ===== */
reset();
({ctx, page, errs, ev}=await mk(375, 720, {tiles:[{name:'Redes',color:'#239b56',steps:[{t:'chat',text:'!redes'}],conf:false},
  {name:'SoloTw',color:'#772ce8',steps:[{t:'chat',text:'hola twitch',pf:'tw'}],conf:false},
  {name:'Casino',color:'#239b56',steps:[{t:'title',text:'Casino 🎰',cat:{id:28,name:'Slots & Casino'},pf:'both'}],conf:false}], twGoalT:1}));
await page.click('#chatGrid'); await W(800);
const tap=n=>ev(n=>[...document.querySelectorAll('#apanel .tl')].find(x=>x.textContent.trim()===n).click(), n);
await tap('Redes'); await W(700); await tap('SoloTw'); await W(700); await tap('Casino'); await W(700);
g=S.posts.map(x=>x.content+'→'+x.pf);
ok(g[0]==='!redes→both', 'un atajo de siempre (sin elegir) va a donde estás en vivo: las dos: '+g.join(' | '));
ok(g[1]==='hola twitch→tw', 'uno de «Solo Twitch» va solo a Twitch');
const cr6=(S.chanReq||[]).filter(x=>x.body && x.body.title).pop();
ok(cr6 && cr6.body.pf==='both' && cr6.body.cat_name==='Slots & Casino', 'título y categoría en las dos (con el nombre de la categoría para Twitch): '+JSON.stringify(cr6 && cr6.body));
await ev(()=>{ const t=[...document.querySelectorAll('#apanel .tl')].find(x=>x.textContent.trim()==='Redes'); t.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true})); });
ok(errs.length===0, 'sin errores (6): '+errs.join(' | '));
await ctx.close();
await b.close();
console.log(fails ? '\n'+fails+' FALLAS' : '\nTODO OK');
process.exit(fails?1:0);
})();
