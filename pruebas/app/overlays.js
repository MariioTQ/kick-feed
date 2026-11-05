const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
const {chromium}=require('playwright');
const {ablyRoutes, rtHandle}=require(__dirname+'/rtcommon.js');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
const H={'access-control-allow-origin':'*'};
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
function defCfg(){ const one=(t,img,snd,on,tts)=>({on:on!==false,min:0,text:t,sub:'',img:'b:'+img,snd:'b:'+snd,vol:80,norm:1,dur:3,tts:!!tts,ttsWhat:'msg',anim:'pop',color:'',vars:[]});
  return {on:true,vol:80,ttsVol:80,ttsMax:140,pos:'centro',size:'normal',look:'tarjeta',gap:0.2,ttsMotor:'servidor',ttsVoz:'mia',ttsFiltro:true,ttsBl:['feo'],pf:{
    kick:{sub:one('{nombre} se suscribió','corona','fanfarria'),resub:one('{nombre} renovó','estrella','campana'),gift:one('{nombre} regaló {cantidad} subs','regalo','magia'),kicks:one('{nombre} mandó {cantidad} Kicks','rayo','monedas',true,true),raid:one('Raid de {nombre}','cohete','tambor'),follow:one('{nombre} te sigue','corazon','pop',false),tip:one('{nombre} donó {cantidad}','billete','caja')},
    tw:{sub:one('{nombre} se suscribió','corona','fanfarria'),resub:one('{nombre} renovó','estrella','campana'),gift:one('{nombre} regaló {cantidad} subs','regalo','magia'),bits:one('{nombre} mandó {cantidad} bits','gema','monedas',true,true),raid:one('Raid de {nombre}','cohete','tambor'),follow:one('{nombre} te sigue','corazon','pop',false),reward:one('{nombre} canjeó {cantidad}','puntos','pop',false)}}}; }
async function mk(url, S, extra){
  const ctx=await b.newContext({viewport:{width:800,height:600}}); const PR={};
  await ablyRoutes(ctx, S);
  await ctx.route('https://fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://translate.google.com.mx/**', r=>{ S.tts=(S.tts||[]).concat([decodeURIComponent(new URL(r.request().url()).searchParams.get('q'))]); r.fulfill({status:404,body:''}); });
  await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{
    const u=new URL(r.request().url()); if (rtHandle(u, r, S, PR)) return;
    const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
    S.calls=(S.calls||[]).concat([u.pathname+u.search]);
    if (extra){ const x=extra(u, r, J); if (x!==undefined) return; }
    return J({ok:true});
  });
  await ctx.addInitScript(()=>{ window.__aud=[]; window.Audio=function(){ return {src:'',volume:1,play(){ window.__aud.push({src:this.src,vol:this.volume}); setTimeout(()=>this.onended&&this.onended(),120); return Promise.resolve(); }, pause(){}}; }; });
  const page=await ctx.newPage(); PR.p=page; page.errs=[]; page.on('pageerror',e=>page.errs.push(String(e)));
  await page.goto(url); await W(1500);
  return {ctx,page};
}
const count=(S,re)=>(S.calls||[]).filter(x=>re.test(x)).length;

/* ===== 1. player de alertas ===== */
{ const S={cfg:defCfg(), cv:5};
  const {ctx,page}=await mk('file://'+RAIZ+'/alertas-player.html', S, (u,r,J)=>{
    const a=u.searchParams.get('a');
    if (a==='cfg'){ S.cfgLoads=(S.cfgLoads||0)+1; return J({ok:true,cfg:S.cfg,files:{}}); }
    if (a==='poll') return J({ok:true,now:Date.now(),live:{kick:true,tw:false},cv:S.cv,list:[],rt:true});
    if (a==='tts'){ S.said=(S.said||[]).concat([u.searchParams.get('t')]); r.fulfill({status:200,headers:H,contentType:'audio/mpeg',body:Buffer.from('ID3')}); return true; }
  });
  await W(1200);
  ok(await page.evaluate(()=>window.__ablyCh==='kf'), 'player: se conecta a Ably (el poll dijo que hay tiempo real)');
  const p0=count(S,/a=poll/);
  await page.evaluate(()=>window.__ablyEmit('ev',{id:'rtA1',type:'kicks.gifted',ts:Date.now(),rt:Date.now(),d:{kind:'kicks',user:'pepe_gdl',amount:100,message:'hola feo jefe'}}));
  await W(700);
  let t=await page.evaluate(()=>(document.querySelector('.alc .alc-t')||{}).textContent);
  ok(t==='pepe_gdl mandó 100 Kicks', 'player: la alerta de Kicks sale al momento por Ably: '+t);
  await W(3500);
  const said=S.said||[];
  ok(said.length===1 && said[0]==='hola jefe', 'la voz lee el mensaje tal cual, sin «fulano dice» y sin la palabra bloqueada: '+JSON.stringify(said));
  await page.evaluate(()=>window.__ablyEmit('ev',{id:'rtA1',type:'kicks.gifted',ts:Date.now(),rt:Date.now(),d:{kind:'kicks',user:'pepe_gdl',amount:100,message:''}}));
  await page.evaluate(()=>window.__ablyEmit('al',{id:'q77',ts:Date.now(),k:'gift',pf:'kick',u:'donmario',n:5,m:'',rp:1}));
  await W(900);
  t=await page.evaluate(()=>(document.querySelector('.alc .alc-t')||{}).textContent);
  ok(t==='donmario regaló 5 subs', 'repetir desde la app llega al momento (y la de antes no se repite): '+t);
  const c0=S.cfgLoads; await page.evaluate(()=>window.__ablyEmit('alcfg',{cv:999})); await W(500);
  ok(S.cfgLoads===c0+1, 'guardaste en el Studio: el player recarga tus alertas al momento');
  await W(14000);
  const pn=count(S,/a=poll/)-p0;
  ok(pn<=1, 'player en vivo: '+pn+' revisiones en ~19 s (antes ~9, cada 2 s)');
  await page.evaluate(()=>window.__ablyDrop()); await W(2500);
  ok(count(S,/a=poll/)-p0-pn>=1, 'si Ably se cae, vuelve a revisar seguido');
  ok(page.errs.length===0, 'player sin errores: '+page.errs.join('|'));
  await ctx.close(); }

/* ===== 2. player sin tiempo real en el servidor: como antes ===== */
{ const S={cfg:defCfg(), cv:5};
  const {ctx,page}=await mk('file://'+RAIZ+'/alertas-player.html', S, (u,r,J)=>{
    const a=u.searchParams.get('a');
    if (a==='cfg') return J({ok:true,cfg:S.cfg,files:{}});
    if (a==='poll') return J({ok:true,now:Date.now(),live:{kick:true,tw:false},cv:5,list:[]});
  });
  const p0=count(S,/a=poll/); await W(6200);
  ok(count(S,/a=poll/)-p0>=2 && !(S.sdkLoads), 'servidor sin Ably: el player ni carga Ably y pregunta como antes');
  ok(page.errs.length===0, 'sin errores: '+page.errs.join('|'));
  await ctx.close(); }

/* ===== 3. letrero de la meta ===== */
for (const pf of ['kick','tw']) {
  const S={};
  const {ctx,page}=await mk('file://'+RAIZ+'/subgoal.html?estilo=bloques&meta=10'+(pf==='tw'?'&pf=tw':''), S, (u,r,J)=>{
    if (u.pathname==='/api/events') return J({ok:true,live:{is_live:pf==='kick'},session:{live:pf==='kick'},totals:{subs:2},tw:{live:{is_live:pf==='tw'},totals:{subs:3}},rt:true});
  });
  await W(1000);
  const e0=count(S,/\/api\/events/);
  await page.evaluate(pf=>window.__ablyEmit('goal',{pf:pf==='tw'?'kick':'tw',subs:8,t:{subs:8}}), pf); await W(300);
  let n=await page.evaluate(()=>document.getElementById('kn').textContent);
  ok(/^[23]/.test(n), 'letrero '+pf+': la meta de la otra plataforma no lo mueve ('+n+')');
  await page.evaluate(pf=>window.__ablyEmit('goal',{pf:pf,subs:6,t:{subs:6,newSubs:6}}), pf); await W(400);
  n=await page.evaluate(()=>document.getElementById('kn').textContent);
  ok(/^6/.test(n), 'letrero '+pf+': la meta llega al momento por Ably ('+n+')');
  await W(16000);
  const en=count(S,/\/api\/events/)-e0;
  ok(en<=1, 'letrero '+pf+' en vivo: '+en+' revisiones en ~17 s (antes 3-4, cada 5 s)');
  ok(page.errs.length===0, 'letrero sin errores: '+page.errs.join('|'));
  await ctx.close();
}

/* ===== 4. BRB: tus controles al momento ===== */
{ const S={};
  const {ctx,page}=await mk('file://'+RAIZ+'/brb-player.html?s=abc123&api=https://kick-feed-mariotq.vercel.app', S, (u,r,J)=>{
    const a=u.searchParams.get('a');
    if (u.pathname==='/api/brb' && a==='tick') return J({ok:true,pl:'p1',rev:1,ctl:{seq:1},cfg:{}});
    if (u.pathname==='/api/brb') return J({ok:true,pl:{id:'p1',rev:1,name:'x',clips:[]},active:'p1',clips:[]});
  });
  await W(3500);
  const t0=count(S,/a=tick/);
  await page.evaluate(()=>window.__ablyEmit && window.__ablyEmit('brb',{seq:2})); await W(700);
  ok(count(S,/a=tick/)>t0, 'BRB: un control desde la app hace que el player pregunte al momento');
  const t1=count(S,/a=tick/); await W(9000);
  ok(count(S,/a=tick/)-t1<=1, 'BRB con Ably: respaldo cada 12 s ('+(count(S,/a=tick/)-t1)+' en 9 s; antes 3)');
  ok(page.errs.length===0, 'BRB sin errores: '+page.errs.join('|'));
  await ctx.close(); }

console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
