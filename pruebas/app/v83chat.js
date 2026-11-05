const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v83: 💬 widget de chat para OBS (chat-obs.html) y 🎨 Chat Studio (chat-studio.html), con Ably simulado
const {chromium}=require('playwright');
const {ablyRoutes, rtHandle}=require(__dirname+'/rtcommon.js');
const http=require('http'), fs=require('fs'), path=require('path');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
const H={'access-control-allow-origin':'*'};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
// las páginas se sirven por http (Chat Studio le habla a su vista previa con postMessage, que en file:// no se puede)
const srv=http.createServer((q,s)=>{ const f=path.join(RAIZ, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200,{'content-type':/\.html$/.test(f)?'text/html; charset=utf-8':'application/javascript'}); fs.createReadStream(f).pipe(s); }).listen(7720);
const DEF={estilo:'linea',fuente:'Segoe UI',tam:20,peso:700,colTexto:'#ffffff',sombra:1,fondoCol:'#000000',fondo:0,radio:8,espacio:2,emTam:1.6,fade:30,max:10,arriba:false,anim:'sube',
  nombreArriba:false,insignias:true,colores:true,kt:false,grande:false,extras:true,pf:'ambas',ocultarBots:true,bots:['botrix','nightbot'],cmd:false,links:false,ocultar:[],palabras:[]};
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
async function mk(url, S){
  const ctx=await b.newContext({viewport:{width:450,height:700}}); const PR={};
  await ablyRoutes(ctx, S);
  if (ctx.routeWebSocket) await ctx.routeWebSocket(/pusher|twitch/, ws=>{ S.ws=(S.ws||0)+1; });   // sin internet: Kick y Twitch no contestan
  await ctx.route(/fonts\.googleapis|7tv\.io|betterttv\.net|kick\.com\/api/, r=>r.fulfill({status:200,headers:H,contentType:'application/json',body:'{}'}));
  await ctx.route(/static-cdn|files\.kick\.com|vip\.png/, r=>r.fulfill({status:200,headers:H,contentType:'image/png',body:PNG}));
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{
    const u=new URL(r.request().url()); if (rtHandle(u, r, S, PR)) return;
    const J=(o,st)=>r.fulfill({status:st||200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    S.calls=(S.calls||[]).concat([u.pathname+u.search]);
    if (u.pathname!=='/api/chatobs') return J({ok:true});
    const a=u.searchParams.get('a'), bd=JSON.parse(r.request().postData()||'{}');
    if (!a) return J({ok:true,kick:{slug:'mariotq',chatroom:'6635680',key:'k',cluster:'us2'},tw:{login:'mariotq',id:'1'},twb:{'vip/1':'https://static-cdn.jtvnw.net/badges/v1/vip/2'},set:S.set});
    if (bd.key!=='CLAVE') return J({ok:false,error:'clave'},403);
    if (a==='get') return J({ok:true,set:S.set,rt:true});
    if (a==='save'){ S.saved=bd.set; S.set=Object.assign({},bd.set); return J({ok:true,set:S.set,live:true}); }
    if (a==='test'){ S.tested=(S.tested||0)+1; return J({ok:true}); }
  });
  const page=await ctx.newPage(); PR.p=page; page.errs=[]; page.on('pageerror',e=>page.errs.push(String(e)));
  await page.goto(url); await W(1500);
  return {ctx,page};
}
const kick=(p,id,txt,u,badges)=>p.evaluate(a=>chatObs.kick({event:'App\\Events\\ChatMessageEvent',data:JSON.stringify({id:a[0],content:a[1],sender:{username:a[2],identity:{color:'#00ff00',badges:a[3]||[]}}})}),[id,txt,u,badges]);
const tw=(p,l)=>p.evaluate(l=>chatObs.tw(l),l);
const ids=p=>p.evaluate(()=>[...document.querySelectorAll('#chat .m')].map(d=>d.dataset.id).join(','));

/* ===== 1. el widget ===== */
{ const S={set:Object.assign({},DEF,{fade:2,max:5})};
  const {ctx,page}=await mk('http://localhost:7720/chat-obs.html', S);
  ok(count(S,/\/api\/chatobs$/)===1, 'al abrir le pregunta 1 sola vez a tu servidor');
  await kick(page,'k1','hola [emote:37226:KEKW]','Juan',[{type:'moderator'}]);
  await kick(page,'k1','repetido','Juan');
  await kick(page,'k2','!comando','Pedro'); await kick(page,'k3','soy bot','BotRix');
  await tw(page,'@badges=vip/1;color=#1E90FF;display-name=Ana;emotes=25:5-9;id=t1 :ana!a@a PRIVMSG #mariotq :hola Kappa');
  await tw(page,'@id=t2;display-name=Nightbot :nightbot!a@a PRIVMSG #mariotq :bot');
  ok(await ids(page)==='k1,t1', 'salen Kick y Twitch; se esconden bots, !comandos y repetidos');
  ok(await page.evaluate(()=>!!document.querySelector('[data-id=k1] img.em') && !!document.querySelector('[data-id=t1] img.em') && !!document.querySelector('[data-id=t1] .bd img')), 'con emotes de Kick y Twitch, e insignias');
  await kick(page,'k4','<img src=x onerror=alert(1)>','<b>x</b>');
  ok(await page.evaluate(()=>!document.querySelector('[data-id=k4] img') && !document.querySelector('[data-id=k4] b')), 'nadie puede meter código en un mensaje');
  await page.evaluate(()=>chatObs.kick({event:'App\\Events\\MessageDeletedEvent',data:JSON.stringify({id:'x',message:{id:'k1'}})}));
  await tw(page,'@target-msg-id=t1 :tmi.twitch.tv CLEARMSG #mariotq :hola');
  ok(await ids(page)==='k4', 'lo que borran Kick y Twitch desaparece al momento');
  await kick(page,'k5','a','Malo'); await tw(page,'@id=t5;display-name=Feo :feo!a@a PRIVMSG #mariotq :b');
  await page.evaluate(()=>chatObs.kick({event:'App\\Events\\UserBannedEvent',data:JSON.stringify({user:{username:'Malo'}})}));
  await tw(page,':tmi.twitch.tv CLEARCHAT #mariotq :feo');
  ok(await ids(page)==='k4', 'y los de alguien que banean');
  await W(2800); ok(await ids(page)==='', 'se desvanecen a los segundos que elegiste');
  for (let i=0;i<8;i++) await kick(page,'m'+i,'mensaje '+i,'u'+i);
  ok(await ids(page)==='m3,m4,m5,m6,m7', 'nunca más del máximo en pantalla');
  // 🎨 lo guardado en Chat Studio llega por Ably sin refrescar
  await page.evaluate(s=>window.__ablyEmit('chatobs',{set:s}), Object.assign({},DEF,{estilo:'tarjeta',tam:30,fuente:'Poppins',fade:0,max:10,ocultar:['u7'],palabras:['prohibido'],links:true,pf:'kick'}));
  await W(200);
  ok(await page.evaluate(()=>document.body.classList.contains('tarjeta') && getComputedStyle(document.body).fontSize==='30px' && /Poppins/.test(getComputedStyle(document.body).fontFamily)), 'el diseño cambia al momento por Ably (sin refrescar OBS)');
  ok(await ids(page)==='m3,m4,m5,m6', 'y quien escondes se va de la pantalla al momento');
  await kick(page,'p1','esto está prohibido','zz'); await kick(page,'p2','entra a mipagina.com','zz'); await tw(page,'@id=p3;display-name=T :t!a@a PRIVMSG #mariotq :solo kick');
  await kick(page,'p4','normal','zz');
  ok(await ids(page)==='m3,m4,m5,m6,p4', 'palabras, links y la plataforma apagada se esconden');
  await page.evaluate(()=>window.__ablyEmit('chatobs',{test:1})); await W(3000);
  ok((await ids(page)).split(',').filter(x=>/^demo/.test(x)).length===2, '«Probar en OBS» enseña mensajes de ejemplo (solo los de Kick, porque Twitch está apagado)');
  ok(!page.errs.length, 'sin errores en el widget '+page.errs.join(' | '));
  await ctx.close(); }

/* ===== 2. Chat Studio ===== */
{ const S={set:Object.assign({},DEF)};
  let {ctx,page}=await mk('http://localhost:7720/chat-studio.html?key=MALA', S);
  ok(await page.isVisible('#gate') && /no es la de tu feed/.test(await page.textContent('#gateErr')), 'sin tu clave no entra');
  await ctx.close();
  ({ctx,page}=await mk('http://localhost:7720/chat-studio.html?key=CLAVE', S));
  ok(!/key=/.test(page.url()), 'la clave no se queda en la barra del navegador');
  ok(/Todo guardado/.test(await page.textContent('#st')), 'abre con lo guardado');
  const fr=()=>page.frame({url:/chat-obs/});
  await page.click('.seg[data-k=estilo] button[data-v=burbuja]'); await W(300);
  ok(await fr().evaluate(()=>document.body.classList.contains('burbuja')), 'la vista previa cambia al momento');
  ok(S.saved===undefined && /sin guardar/.test(await page.textContent('#st')), 'y tu OBS no cambia hasta guardar');
  await page.click('#fonts button[data-f=Poppins]'); await page.click('#fadeChips button[data-f="60"]');
  await page.fill('textarea[data-k=ocultar]','@Pepe, Juan'); await page.fill('textarea[data-k=palabras]','feo\nspam total');
  await page.click('.tg[data-k=cmd]'); await page.click('.seg[data-k=peso] button[data-v="900"]');
  await page.click('#save'); await W(400);
  const sv=S.saved||{};
  ok(sv.estilo==='burbuja' && sv.fuente==='Poppins' && sv.fade===60 && sv.fondo===0.55 && sv.cmd===true && sv.peso===900 &&
     JSON.stringify(sv.ocultar)==='["pepe","juan"]' && JSON.stringify(sv.palabras)==='["feo","spam total"]', 'guarda todo lo que cambiaste');
  ok(/tu OBS ya lo tiene/.test(await page.textContent('#st')), 'y dice que tu OBS ya lo tiene');
  await page.click('.seg[data-k=estilo] button[data-v=tarjeta]'); await page.click('#undo');
  ok(await page.evaluate(()=>document.querySelector('.seg[data-k=estilo] .on').dataset.v)==='burbuja', '«Deshacer» regresa a lo guardado');
  await page.click('#test'); await W(300); ok(S.tested===1, '«Probar en OBS» funciona');
  ok(/chat-obs\.html$/.test(await page.textContent('#link')) && !/key/.test(await page.textContent('#link')), 'el link para OBS no lleva tu clave');
  ok(!page.errs.length, 'sin errores en Chat Studio '+page.errs.join(' | '));
  await ctx.close(); }

/* ===== 3. la app: ⚙ → Chat → «Chat para OBS» abre Chat Studio con tu clave ===== */
{ const ctx=await b.newContext({viewport:{width:390,height:800}}); const S={};
  await ablyRoutes(ctx, S);
  await ctx.addInitScript(()=>{ window.WebSocket=function(){ return {readyState:0,send(){},close(){}}; }; window.WebSocket.OPEN=1; });
  await ctx.route(/^https:\/\/(?!kick-feed-mariotq)/, r=>r.fulfill({status:404,headers:H,body:''}));
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>r.fulfill({status:200,headers:H,contentType:'application/json',body:'{"ok":true}'}));
  const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('file://'+RAIZ+'/index.html?keep=0&key=K3y'); await W(2500);
  await page.evaluate(()=>document.getElementById('gear').click()); await W(400);
  const row=await page.evaluate(()=>{ const r=[...document.querySelectorAll('#filters .chip')].find(x=>/Chat para OBS/.test(x.textContent)); return r ? r.textContent : ''; });
  ok(/Chat Studio/.test(row), 'en ⚙ → Chat está «Chat para OBS»');
  const pop=page.waitForEvent('popup',{timeout:5000}).catch(()=>null);
  await page.evaluate(()=>[...document.querySelectorAll('#filters .chip')].find(x=>/Chat para OBS/.test(x.textContent)).click());
  const pp=await pop;
  ok(pp && /chat-studio\.html\?key=K3y$/.test(pp.url()), 'y abre Chat Studio con tu clave: '+(pp && pp.url().replace(/^.*\//,'')));
  ok(!errs.length, 'sin errores en la app '+errs.join(' | '));
  await ctx.close(); }

await b.close(); srv.close();
console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
process.exit(0);
function count(S,re){ return (S.calls||[]).filter(x=>re.test(x)).length; }
})().catch(e=>{ console.log('FAIL Error '+e.message); process.exit(1); });
