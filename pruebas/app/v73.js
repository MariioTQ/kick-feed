const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
const {chromium}=require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const H={'access-control-allow-origin':'*'};
const TILES=[{name:'',color:'#239b56',steps:[{t:'scene',scene:'LIVE'}],conf:false},{name:'+1 Sub',color:'#239b56',steps:[{t:'goal',n:1}],conf:false}];
let S;
function reset(){ S={brb:[], B:{scr:{id:'x',pl:'p1',ctl:{seq:0,paused:false,muted:false,msg:null,tmp:null},cfg:{msgs:['¡Ahorita regreso!','Sin señal, ya vuelvo 📶']}}}, ev:[], spamPosts:[], momPosts:[], chats:[], goals:[], gtts:[], tot:{from:Date.now()-3600e3,subs:4,real:4,adj:0}, live:false, goalFail:false}; }
reset();
async function mk(vw, vh, cfg, opt){
  opt=opt||{};
  const ctx=await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:1,timezoneId:'America/Mexico_City',
    userAgent: opt.android ? 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36' : undefined});
  await ctx.addInitScript(([cfg,TILES,noVoice,BAR])=>{
    window.__said=[]; window.__cancel=0;
    if (noVoice){ try{ delete window.speechSynthesis; }catch(e){} Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true}); window.SpeechSynthesisUtterance=undefined; }
    else {
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){ window.__said.push(u.text); setTimeout(()=>u.onend&&u.onend(), 120); }, cancel(){ window.__cancel++; },
        getVoices(){ return [{name:'Paulina',lang:'es-MX',voiceURI:'Paulina'},{name:'Mónica',lang:'es-ES',voiceURI:'Monica'},{name:'Samantha',lang:'en-US',voiceURI:'Sam'}]; }}});
      window.SpeechSynthesisUtterance=function(t){ this.text=t; };
    }
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init','1'); localStorage.clear();
    localStorage.setItem('kickfeed.chatcfg', JSON.stringify(Object.assign({on:true,fs:16,apH:'c',tiles:TILES,obsLive:false}, cfg)));
    localStorage.setItem('kickfeed.obson','1'); if (BAR) localStorage.setItem('kickfeed.bar', JSON.stringify(BAR));
    window.WebSocket=function(u){ const w={readyState:0,send(){},close(){}}; setTimeout(()=>{ w.readyState=1; w.onopen&&w.onopen(); w.onmessage&&w.onmessage({data:JSON.stringify({event:'pusher:connection_established',data:JSON.stringify({socket_id:'1.2'})})}); },50); return w; }; window.WebSocket.OPEN=1; }, [cfg,TILES,!!opt.noVoice,opt.bar||null]);
  const start=new Date(Date.now()-3600e3).toISOString();
  await ctx.route('https://kick.com/**', r=>{ if (/livestream/.test(r.request().url())) return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({data: S.live ? {id:1,viewers:5,created_at:start} : null})}); return r.fulfill({status:404,headers:H,body:'{}'}); });
  await ctx.route('https://translate.google.com.mx/**', r=>{ S.gtts.push(decodeURIComponent(new URL(r.request().url()).searchParams.get('q'))); return r.fulfill({status:404,body:''}); });
  for (const h of ['https://web.kick.com/**','https://7tv.io/**','https://api.betterttv.net/**','https://stats.srt.belabox.net/**']) await ctx.route(h, r=>r.fulfill({status:404,headers:H,body:'{}'}));
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{ const u=new URL(r.request().url()); let body={}; try{ body=JSON.parse(r.request().postData()||'{}'); }catch(e){}
    const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    if (u.pathname==='/api/goal'){ S.goals.push(body); if (S.goalFail) return J({ok:false,error:'Falla de prueba'}); const n=S.goals.reduce((a,g)=>a+(g.delta||0),0); return J({ok:true,off:true,n,totals:{from:0,off:true,subs:Math.max(0,n),real:0,adj:n,kicks:0,newSubs:0,resubs:0,gifted:0}}); }
    if (u.pathname==='/api/obs') return J({ok:true,configured:true,scenes:['LIVE','BRB'],current:'LIVE',stream:{on:false},record:{on:false},state:{}});
    if (u.pathname==='/api/events') return J({ok:true,cursor:Date.now(),events:S.ev.splice(0),pat:0});
    if (u.pathname==='/api/spam'){ if (r.request().method()==='POST'){ S.spamPosts.push(body); if (body.action==='to') S.spamTo=body.to; } return J({ok:true,on:true,to:S.spamTo==null?1:S.spamTo,list:['botkiva'],log:[]}); }
    if (u.pathname==='/api/moments'){ if (r.request().method()==='POST'){ S.momPosts.push(body); return J({ok:true,item:{id:'x'+S.momPosts.length,at:Date.now(),vs:body.from||0,t:body.from?Date.now()-body.from:null,u:'mariotq',note:body.note||'',src:'app'}}); } return J({ok:true,list:[]}); }
    if (u.pathname==='/api/chat' && r.request().method()==='POST'){ S.chats.push(body); return J({ok:true}); }
    if (u.pathname==='/api/chat' && r.request().method()==='GET') return J({ok:true,cursor:Date.now(),msgs:[{id:'s1',u:'viejo1',t:'hola de antes',ts:Date.now()-120000,rt:Date.now()-120000,badges:[]}]});
    if (u.pathname==='/api/brb'){ S.brb.push({a:u.searchParams.get('a'), b:body}); const B=S.B;
      if (u.searchParams.get('a')==='ctl'){ const c=B.scr.ctl; if (body.cmd==='msgtmp') c.tmp={m:body.msg,left:body.sec*1000,sec:body.sec,id:++c.seq}; else if (body.cmd==='msg'){ c.msg=body.msg; c.tmp=null; } else if (body.cmd==='pausetoggle') c.paused=!c.paused; else if (body.cmd==='mutetoggle') c.muted=!c.muted; else if (body.cmd==='pl') B.scr.pl=body.pl; return J({ok:true,scr:B.scr}); }
      return J({ok:true,scr:B.scr,now:{t:'Clip chistoso de prueba',st:'play'},onAir:true,pls:[{id:'p1',name:'Mis clips',n:42},{id:'p2',name:'Moto',n:12}]}); }
    return J({ok:true,users:[],msgs:[]}); });
  const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('file://'+RAIZ+'/index.html?keep=0&key=K3y'); await W(2300);
  return {ctx, page, errs, ev:(c,a)=>page.evaluate(c,a)};
}
const C='chatrooms.6635680.v2';
const msg=(ev,id,u,t,badges)=>ev(([id,u,t,badges,C])=>window.kickfeed.handle('App\\Events\\ChatMessageEvent',{id,content:t,type:'message',sender:{id:id.length,username:u,identity:{color:'#fff',badges:badges||[]}}},C),[id,u,t,badges,C]);
const noSide=ev=>ev(()=>{ const bad=[]; document.querySelectorAll('body *').forEach(el=>{ const cs=getComputedStyle(el); if (!el.getClientRects().length) return;
  if ((cs.overflowX==='auto'||cs.overflowX==='scroll') && el.scrollWidth>el.clientWidth+2) bad.push((el.id||el.className||el.tagName)+':'+el.scrollWidth+'>'+el.clientWidth); });
  if (document.documentElement.scrollWidth>innerWidth+1) bad.push('página:'+document.documentElement.scrollWidth); return bad; });





const vis=(ev,id)=>ev(id=>{ const e=document.getElementById(id); return !!e && e.getClientRects().length>0; }, id);
/* ===== 1. 🎞 en ⋯ y la página del BRB ===== */
reset(); S.live=true;
let {ctx, page, errs, ev}=await mk(375, 667, {ttsDev:false, qr:['Sin pila 🔋','!redes','¡Gracias por el apoyo! 💚'], qrMode:'send'});
ok(await vis(ev,'moreBtn') && !(await vis(ev,'brbBtn')), '🎞 llega en los puntitos ⋯ (no le quita espacio a la barra)');
await page.click('#moreBtn'); await W(250);
ok(await ev(()=>!!document.querySelector('#bpop button[data-ov="brb"]')), 'en ⋯ sale «BRB»');
await page.click('#bpop button[data-ov="brb"]'); await W(700);
let g=await ev(()=>({m:document.getElementById('cpanel').classList.contains('brbm'), st:document.querySelector('#cpanel .brbst').textContent, pl:[...document.querySelectorAll('#cpanel .bpls .op')].map(o=>o.textContent).join('|'), ms:[...document.querySelectorAll('#cpanel .bmsgs button[data-bm]')].map(b=>b.textContent)}));
ok(g.m && /Al aire/.test(g.st) && /Clip chistoso/.test(g.st), 'página del BRB: al aire y qué clip suena: '+g.st);
ok(/Mis clips/.test(g.pl) && /Moto/.test(g.pl) && g.ms.length===2, 'playlists y tus mensajes guardados');
await page.click('#cpanel .brbc button[data-bc="next"]'); await W(300);
ok(S.brb.some(x=>x.a==='ctl' && x.b.cmd==='next'), '⏭ siguiente clip');
await page.click('#cpanel .brbc button[data-bc="pausetoggle"]'); await W(300);
ok(await ev(()=>/Seguir/.test(document.querySelector('#cpanel .brbc button[data-bc="pausetoggle"]').textContent)), '⏸ pausa (y el botón dice Seguir)');
await page.click('#cpanel .bmsgs button[data-bm="1"]'); await W(400);
let last=S.brb.filter(x=>x.a==='ctl').pop();
ok(last.b.cmd==='msgtmp' && last.b.msg==='Sin señal, ya vuelvo 📶' && last.b.sec===5, 'tocar un mensaje: sale 5 s sobre los clips: '+JSON.stringify(last.b));
ok(await ev(()=>/por unos segundos/.test(document.querySelector('#cpanel .bcur').textContent)), 'dice que está por unos segundos');
await page.click('#cpanel .tvol button[data-bs="1"]'); await W(150); await page.click('#cpanel .tvol button[data-bs="1"]'); await W(150);
ok(await ev(()=>document.getElementById('brbSecN').textContent==='10 s'), '+ sube los segundos (10 s)');
for (let i=0;i<8;i++){ await page.click('#cpanel .tvol button[data-bs="1"]'); await W(80); }
ok(await ev(()=>document.getElementById('brbSecN').textContent==='Se queda'), 'hasta el final: «Se queda»');
await page.fill('#brbIn','Ya casi llego 🛵'); await page.click('#brbPut'); await W(400);
last=S.brb.filter(x=>x.a==='ctl').pop();
ok(last.b.cmd==='msg' && last.b.msg==='Ya casi llego 🛵', 'con «Se queda» el mensaje escrito se queda fijo');
await page.click('#cpanel .bmsgs button[data-bx="pl"]'); await W(300);
last=S.brb.filter(x=>x.a==='ctl').pop(); ok(last.b.cmd==='msg' && last.b.msg===null, '↩️ vuelve el mensaje de la playlist');
await page.click('#cpanel .bpls .op[data-bp="p2"]'); await W(300);
last=S.brb.filter(x=>x.a==='ctl').pop(); ok(last.b.cmd==='pl' && last.b.pl==='p2', 'cambiar de playlist con un toque');
for (let i=0;i<7;i++){ await page.click('#cpanel .tvol button[data-bs="-1"]'); await W(60); }
ok(await ev(()=>document.getElementById('brbSecN').textContent==='5 s'), 'regresar a 5 s');
// respuestas rápidas → BRB
await page.click('#brbQr'); await W(400);
g=await ev(()=>[...document.querySelectorAll('#cpanel .qrr')].map(r=>!!r.querySelector('b[data-qb]')));
ok(g[0] && !g[1] && g[2], 'el 🎞 sale en cada respuesta (menos en comandos como !redes)');
await page.click('#cpanel .qrr b[data-qb="0"]'); await W(200);
ok(await ev(()=>JSON.parse(localStorage.getItem('kickfeed.chatcfg')).qrBrb['Sin pila 🔋']===1), 'se guarda que «Sin pila» también va al BRB');
await page.click('#cpHead .x'); await W(300);
await page.reload(); await W(2500);
ok(await ev(()=>{ const c=JSON.parse(localStorage.getItem('kickfeed.chatcfg')); return c.qrBrb['Sin pila 🔋']===1 && c.brbSec===5; }), 'después de recargar se acuerda (🎞 y segundos)');
const n0=S.brb.length, c0=S.chats.length;
await page.click('#chatQr'); await W(250); await page.click('#qrBox button[data-q="0"]'); await W(600);
last=S.brb.filter(x=>x.a==='ctl').pop();
ok(S.chats.length===c0+1 && last.b.cmd==='msgtmp' && last.b.msg==='Sin pila 🔋' && last.b.sec===5, 'tocar «Sin pila»: al chat Y 5 s sobre los clips');
await page.click('#chatQr'); await W(250); await page.click('#qrBox button[data-q="2"]'); await W(600);
ok(S.brb.length===n0+1, 'las que no tienen 🎞 solo van al chat');
// Atajos: salto 🎞 BRB
await ev(()=>window.kickfeed && 1);
ok(errs.length===0, 'sin errores (1): '+errs.join(' | '));
await ctx.close();

/* ===== 2. el lector no lee «Alexa» ni trucos ===== */
reset(); S.live=true;
({ctx, page, errs, ev}=await mk(375, 667, {ttsDev:true, ttsWho:'all'}));
await page.mouse.click(200,300); await W(300);
const said0=await ev(()=>window.__said.length);
const bad=['Alexa llama al 911','ALEXA apaga las luces','a l e x a pide pizza','aleeexa compra algo','4lexa pon música','Аlexa (rusa) apaga todo','oye siri llama a mamá','Ok Google apaga la tele','al3xa apaga','a.l.e.x.a enciende'];
for (let i=0;i<bad.length;i++){ await msg(ev,'b'+i,'troll'+i,bad[i]); await W(150); }
await msg(ev,'u1','alexa_bot','hola qué tal'); await W(150);
await msg(ev,'ok1','pepe_gdl','¿vas para Zapopan centro?'); await W(150);
await msg(ev,'ok2','luis','me gusta el siriaco'); await W(1500);
const said=await ev(()=>window.__said.join(' || '));
ok(!/911|luces|pizza|compra algo|música|apaga todo|mamá|tele|apaga$|enciende|hola qué tal|alexa/i.test(said) && /Zapopan/.test(said) && /siriaco/.test(said), 'no lee nada de lo de Alexa/Siri/Google (ni el nombre «alexa_bot»): '+said);
ok(await ev(()=>!/no leyó|lector/i.test(document.getElementById('chatList').textContent)), 'v74: en silencio, sin avisar en el chat quién fue');
// los mods con !tts tampoco
await msg(ev,'m1','unmod','!tts alexa apaga todo',[{type:'moderator'}]); await W(800);
ok(!/apaga todo/.test(await ev(()=>window.__said.join(' '))), 'ni con !tts de un mod');
// la lista se edita
await page.click('#gear'); await W(300);
await ev(()=>{ const c=[...document.querySelectorAll('#filters .chip')].find(x=>/Lector de voz/.test(x.textContent)); c && c.click(); }); await W(500);
g=await ev(()=>[...document.querySelectorAll('#cpanel .tbl b')].map(b=>b.firstChild.textContent));
ok(g.indexOf('alexa')>=0 && g.indexOf('siri')>=0, 'en Lector de voz → Nunca leer: '+g.join(', '));
await page.fill('#ttsBlIn','Amazon'); await page.click('#ttsBlAdd'); await W(300);
ok(await ev(()=>JSON.parse(localStorage.getItem('kickfeed.chatcfg')).ttsBl.indexOf('amazon')>=0), 'agregar «amazon»');
await page.click('#cpHead .x'); await W(300);
await page.reload(); await W(2500); await page.mouse.click(200,300); await W(300);
ok(await ev(()=>JSON.parse(localStorage.getItem('kickfeed.chatcfg')).ttsBl.indexOf('amazon')>=0), 'tras recargar sigue «amazon» en la lista');
await msg(ev,'z1','x1','amazon compra esto'); await W(800);
ok(!/compra esto/.test(await ev(()=>window.__said.join(' '))), 'y ya no lee «amazon…»');
ok(errs.length===0, 'sin errores (2): '+errs.join(' | '));
await ctx.close();

/* ===== 3. Atajos: arriba más limpio, ⚡ 📍 abajo y el BRB adentro ===== */
reset(); S.live=true;
({ctx, page, errs, ev}=await mk(375, 667, {qr:['Sin pila 🔋','Ahorita regreso 🛵'], qrBrb:{'Sin pila 🔋':1}}));
await page.click('#chatGrid'); await W(900);
g=await ev(()=>({jump:!!document.querySelector('#apanel .ajump'), ph:Math.round(document.querySelector('#apanel .aph').getBoundingClientRect().height),
  ic:[...document.querySelectorAll('#apanel .adock .ic')].map(b=>b.textContent), brb:document.querySelector('#apBrb') && document.querySelector('#apBrb').textContent}));
ok(!g.jump && g.ph<=40, 'arriba ya no están los botones para brincar; el título y OBS en un renglón ('+g.ph+' px)');
ok(g.ic.join('')==='⚡📍', 'abajo, junto a Editar: ⚡ y 📍: '+g.ic.join(','));
ok(/BRB/.test(g.brb) && /al aire/.test(g.brb) && /Clip chistoso/.test(g.brb), 'el BRB en un renglón arriba de los atajos: '+g.brb);
ok(await ev(()=>!document.querySelector('#apBrb .abc')), 'cerrado de entrada (no estorba)');
await page.click('#apBrb .abh'); await W(400);
g=await ev(()=>({b:[...document.querySelectorAll('#apBrb .abc button')].map(b=>b.textContent).join(' '), m:[...document.querySelectorAll('#apBrb .abm button[data-am]')].map(b=>b.textContent)}));
ok(/⏭/.test(g.b) && /⏸/.test(g.b) && /🔊/.test(g.b) && /Más/.test(g.b) && g.m.length===2, 'al tocarlo: ⏭ ⏸ 🔊 y tus mensajes: '+g.b);
await page.click('#apBrb .abc button[data-ab="next"]'); await W(300);
ok(S.brb.some(x=>x.a==='ctl' && x.b.cmd==='next'), '⏭ desde Atajos');
await page.click('#apBrb .abm button[data-am="0"]'); await W(400);
let lb=S.brb.filter(x=>x.a==='ctl').pop(); ok(lb.b.cmd==='msgtmp' && lb.b.msg==='¡Ahorita regreso!', 'un mensaje desde Atajos');
ok(await ev(()=>!!document.querySelector('#apanel.show, #apanel') && document.getElementById('apBrb') && !!document.querySelector('#apBrb .abc')), 'el panel sigue abierto');
await page.click('#apanel .adock #apQrGo'); await W(600);
ok(await ev(()=>{ const t=document.querySelector('#apanel .aqrs'), bd=document.querySelector('#apanel .abody'); const r=t.getBoundingClientRect(), q=bd.getBoundingClientRect(); return t && r.top>=q.top-2 && r.top<q.bottom-40; }), '⚡ te lleva a tus respuestas (quedan a la vista)');
await page.click('#apanel .aqrg button[data-qa="0"]'); await W(600);
lb=S.brb.filter(x=>x.a==='ctl').pop(); ok(lb.b.cmd==='msgtmp' && lb.b.msg==='Sin pila 🔋', 'y «Sin pila» desde Atajos también sale en el BRB');
await page.click('#apBrb .abc button[data-ab="page"]'); await W(600);
ok(await ev(()=>document.getElementById('cpanel').classList.contains('brbm')), '«Más ›» abre la página del BRB');
await page.screenshot({path:require('os').tmpdir()+'/t73_brbpage.png'});
ok(errs.length===0, 'sin errores (3): '+errs.join(' | '));
await ctx.close();

await b.close();
console.log(fails ? '\n'+fails+' FALLAS' : '\nTODO OK');
process.exit(fails?1:0);
})();
