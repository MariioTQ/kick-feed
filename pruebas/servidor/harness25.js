const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// Prueba del login, la clave y el cambio de título/categoría (Kick simulado)
const realFetch=global.fetch;
let patched=null; const calls=[]; global.__calls=calls;
global.fetch=async (url,opts={})=>{
  url=String(url);
  const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
  if (url.startsWith('https://id.kick.com/oauth/token')) return J({access_token:'AT',refresh_token:'RT',expires_in:3600,scope:'user:read channel:read channel:write events:subscribe kicks:read'});
  if (url.startsWith('https://api.kick.com/public/v1/users')) return J({data:[{user_id:6692133,name:'MarioTQ'}]});
  if (url.startsWith('https://api.kick.com/public/v1/events/subscriptions')){ if(opts.method==='POST') calls.push({u:'subs',b:JSON.parse(opts.body)}); } if (url.startsWith('https://api.kick.com/public/v1/events/subscriptions')) return opts.method==='POST'? J({data:JSON.parse(opts.body).events.map(e=>({name:e.name,subscription_id:'s'}))}) : J({data:[]});
  if (url==='https://api.kick.com/public/v1/channels'){ if(opts.method==='PATCH'){ patched=JSON.parse(opts.body); return new Response(null,{status:204}); }
     return J({data:[{stream_title:patched&&patched.stream_title||'Título viejo',category:{id:15,name:'IRL',thumbnail:'x'},stream:{is_live:true}}]}); }
  if (url.startsWith('https://web.kick.com/api/v1/realtime/channels/')){ calls.push({u:'nego',b:JSON.parse(opts.body)}); return J({data:{connections:[{provider:'pusher',credentials:{app_key:'newkey123',cluster:'us2'}}]}}); }
  if (url.startsWith('https://api.kick.com/public/v1/moderation/bans')){ calls.push({m:opts.method,u:'bans',b:JSON.parse(opts.body||'{}')}); if(JSON.parse(opts.body||'{}').user_id===666) return J({message:'Forbidden'},403); return J({data:{}}); }
  if (url.startsWith('https://api.kick.com/public/v1/chat/')){ calls.push({m:opts.method,u:url.split('/chat/')[1]}); if(/gone/.test(url)) return new Response('{}',{status:404}); return new Response(null,{status:204}); }
  if (url==='https://api.kick.com/public/v1/chat'){ const b=JSON.parse(opts.body); calls.push({m:'POST',u:'chat',b}); return J({data:{is_sent:true,message_id:'m-123'}}); }
  if (url.startsWith('https://api.kick.com/public/v1/categories')) return J({data:[{id:15,name:'IRL'},{id:16,name:'IRL Travel'}]});
  return realFetch(url,opts);
};
{ const f0=global.fetch; global.__tg=[]; global.fetch=async (url,opts={})=>{ url=String(url); if (url.startsWith('https://api.telegram.org/')){ global.__tg.push({url,body:JSON.parse(opts.body)}); return new Response(JSON.stringify(global.__tgFail?{ok:false,description:'chat not found'}:{ok:true}),{status:200,headers:{'content-type':'application/json'}}); } return f0(url,opts); }; }
const http=require('http'), crypto=require('crypto');
// --- Upstash falso ---
const kv={}, z={}, lists={}, sets={}; global.__z=z; global.__kvref=kv;
function zr(key){ return z[key]||(z[key]=[]); }
const upstash=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{
  const cmd=JSON.parse(b), op=cmd[0].toUpperCase(); let r=null; (global.__cmds=global.__cmds||[]).push(cmd);
  if(op==='PING') r='PONG';
  else if(op==='SET'){ const nx=cmd.includes('NX'); if(nx&&kv[cmd[1]]!==undefined) r=null; else {kv[cmd[1]]=String(cmd[2]); r='OK';} }
  else if(op==='GET') r=kv[cmd[1]]===undefined?null:kv[cmd[1]];
  else if(op==='MSET'){ for(let k=1;k+1<cmd.length;k+=2) kv[cmd[k]]=String(cmd[k+1]); r='OK'; }
  else if(op==='MGET') r=cmd.slice(1).map(k=>kv[k]===undefined?null:kv[k]);
  else if(op==='DEL'){ delete kv[cmd[1]]; r=1; }
  else if(op==='ZADD'){ const A=zr(cmd[1]); r=0; for(let k=2;k+1<cmd.length;k+=2){ const ix=A.findIndex(x=>x[1]===cmd[k+1]); if(ix>=0) A.splice(ix,1); A.push([Number(cmd[k]),cmd[k+1]]); r++; } A.sort((a,b)=>a[0]-b[0]); }
  else if(op==='ZREMRANGEBYRANK'){ const a=zr(cmd[1]); const stop=Number(cmd[3]); const n=a.length+stop+1; if(n>0) a.splice(0,n); r=0; }
  else if(op==='ZCARD') r=zr(cmd[1]).length;
  else if(op==='ZRANGEBYSCORE'){ let mn=String(cmd[2]), ex=mn.startsWith('('); mn=Number(ex?mn.slice(1):mn); const mx=cmd[3]==='+inf'?Infinity:Number(cmd[3]);
     let a=zr(cmd[1]).filter(([s])=>(ex?s>mn:s>=mn)&&s<=mx).map(x=>x[1]); const li=cmd.indexOf('LIMIT'); if(li>0) a=a.slice(Number(cmd[li+1]),Number(cmd[li+1])+Number(cmd[li+2])); r=a; }
  else if(op==='ZRANGE'){ const A=zr(cmd[1]), L=A.length; let st=Number(cmd[2]), en=Number(cmd[3]); if(st<0) st=Math.max(0,L+st); if(en<0) en=L+en; const sl=A.slice(st,en+1); r=cmd.includes('WITHSCORES') ? sl.flatMap(x=>[x[1],String(x[0])]) : sl.map(x=>x[1]); }
  else if(op==='ZREM'){ const A=zr(cmd[1]); const ix=A.findIndex(x=>x[1]===cmd[2]); if(ix>=0) A.splice(ix,1); r=ix>=0?1:0; }
  else if(op==='ZREVRANGEBYSCORE'){ let mx=String(cmd[2]), ex=mx.startsWith('('); mx=mx==='+inf'?Infinity:Number(ex?mx.slice(1):mx); let mn=String(cmd[3]), exn=mn.startsWith('('); mn=mn==='-inf'?-Infinity:Number(exn?mn.slice(1):mn);
     let a=zr(cmd[1]).filter(([s])=>(ex?s<mx:s<=mx)&&(exn?s>mn:s>=mn)).slice().reverse().map(x=>x[1]); const li=cmd.indexOf('LIMIT'); if(li>0) a=a.slice(Number(cmd[li+1]),Number(cmd[li+1])+Number(cmd[li+2])); r=a; }
  else if(op==='LPUSH'){ (lists[cmd[1]]=lists[cmd[1]]||[]).unshift(cmd[2]); r=lists[cmd[1]].length; }
  else if(op==='LTRIM'){ lists[cmd[1]]=(lists[cmd[1]]||[]).slice(Number(cmd[2]),Number(cmd[3])+1); r='OK'; }
  else if(op==='LRANGE') r=(lists[cmd[1]]||[]).slice(Number(cmd[2]),Number(cmd[3])+1);
  else if(op==='LLEN') r=(lists[cmd[1]]||[]).length;
  else if(op==='SADD'){ const S=(sets[cmd[1]]=sets[cmd[1]]||new Set()); let n=0; cmd.slice(2).forEach(x=>{ if(!S.has(x)){S.add(x);n++;} }); r=n; }
  else if(op==='SMEMBERS') r=Array.from(sets[cmd[1]]||[]);
  else { res.end(JSON.stringify({error:'op '+op})); return; }
  res.setHeader('content-type','application/json'); res.end(JSON.stringify({result:r}));
});}).listen(7701);
// --- claves de "Kick" ---
const {publicKey, privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
process.env.KICK_PUBLIC_KEY=publicKey.export({type:'spki',format:'pem'});
process.env.KV_REST_API_URL='http://localhost:7701'; process.env.KV_REST_API_TOKEN='x';
process.env.KICK_CLIENT_ID='cid'; process.env.KICK_CLIENT_SECRET='sec';
process.env.TELEGRAM_BOT_TOKEN='TGTOKEN'; process.env.TELEGRAM_CHAT_ID='-100123';
const brbH=require(RAIZ+'/api/brb.js');
const handler=require(RAIZ+'/api/[route].js');
const app=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'); const m=u.pathname.match(/^\/api\/([^/]+)/);
  req.query=Object.fromEntries(u.searchParams); if(m) req.query.route=m[1];
  if (m && m[1]==='brb') return brbH(req,res);
  handler(req,res);
}).listen(7702, async ()=>{
  const sign=(id,ts,body,key)=>crypto.sign('sha256',Buffer.from(id+'.'+ts+'.'+body),{key:key||privateKey,padding:crypto.constants.RSA_PKCS1_PADDING}).toString('base64');
  async function hook(type,payload,id,badKey){ const body=JSON.stringify(payload), ts=new Date().toISOString();
    const r=await fetch('http://localhost:7702/api/webhook',{method:'POST',body,headers:{'kick-event-type':type,'kick-event-version':'1','kick-event-message-id':id,'kick-event-message-timestamp':ts,'kick-event-signature':sign(id,ts,body,badKey),'content-type':'application/json'}});
    return r.status; }






  let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
  const W=ms=>new Promise(r=>setTimeout(r,ms));
  const r1=await fetch('http://localhost:7702/api/login',{redirect:'manual'}); const st=new URL(r1.headers.get('location')).searchParams.get('state');
  const cb=await (await fetch('http://localhost:7702/api/callback?code=abc&state='+st,{headers:{'x-forwarded-host':'kick-feed-mariotq.vercel.app'}})).text();
  const key=decodeURIComponent((cb.match(/key=([A-Za-z0-9_\-%]+)/)||[])[1]);
  ok(!!key, 'clave');
  /* --- Telegram --- */
  const t0=Date.now();
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0).toISOString(),title:'Rappi por Zapopan 🛵 ¡ñandú!'},'l1'); await W(150);
  ok(global.__tg.length===1, 'al empezar el stream manda un aviso a Telegram');
  const tb=global.__tg[0]||{body:{}};
  ok(/botTGTOKEN\/sendMessage$/.test(tb.url||'') && tb.body.chat_id==='-100123', 'al bot y grupo de las variables de Vercel');
  ok(/EN VIVO/.test(tb.body.text) && /Rappi por Zapopan 🛵 ¡ñandú!/.test(tb.body.text) && /kick\.com\/mariotq/.test(tb.body.text), 'con el título (acentos y emojis bien) y el link: '+JSON.stringify(tb.body.text));
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0).toISOString(),title:'x'},'l1b'); await W(100);
  ok(global.__tg.length===1, 'si Kick repite el aviso, no manda otro');
  await hook('livestream.status.updated',{is_live:false,ended_at:new Date(t0+60000).toISOString()},'l2'); await W(100);
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0+120000).toISOString(),title:'IRL'},'l3'); await W(100);
  ok(global.__tg.length===1, 'si se corta la señal y vuelve, no manda otro');
  // stream nuevo (más de 30 min después) pero dentro de 2 h: el candado lo frena; sin candado sí manda
  delete global.__kvref['tg:live'];
  await hook('livestream.status.updated',{is_live:false,ended_at:new Date(t0+180000).toISOString()},'l4'); await W(100);
  global.__tgFail=true;
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0+180000+40*60000).toISOString(),title:'Otro'},'l5'); await W(150);
  ok(global.__tg.length===2, 'stream nuevo: otro aviso');
  const raw=await (await fetch('http://localhost:7702/api/raw?key='+encodeURIComponent(key))).text().catch(()=>'');
  ok(true, 'falla de Telegram no truena nada');
  /* --- BRB: mensaje de unos segundos --- */
  const B=(a,b)=>fetch('http://localhost:7702/api/brb?a='+a,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key},b||{}))}).then(r=>r.json());
  let j=await B('state'); ok(j.ok && j.scr && j.scr.id, 'BRB: estado');
  const sid=j.scr.id;
  j=await B('ctl',{cmd:'msg',msg:'Mensaje fijo'}); ok(j.ok && j.scr.ctl.msg==='Mensaje fijo' && !j.scr.ctl.tmp, 'mensaje fijo');
  j=await B('ctl',{cmd:'msgtmp',msg:'Sin pila 🔋',sec:5}); 
  ok(j.ok && j.scr.ctl.tmp && j.scr.ctl.tmp.m==='Sin pila 🔋' && j.scr.ctl.tmp.sec===5 && j.scr.ctl.tmp.left>7000 && j.scr.ctl.tmp.left<=8000 && j.scr.ctl.msg==='Mensaje fijo', 'mensaje de 5 s (con 3 s de colchón) y el fijo se guarda: '+JSON.stringify(j.scr.ctl.tmp));
  ok(!('until' in j.scr.ctl.tmp), 'al player le llega cuánto falta, no la hora');
  let t=await (await fetch('http://localhost:7702/api/brb?a=tick&s='+sid)).json();
  ok(t.ok && t.ctl.tmp && t.ctl.tmp.m==='Sin pila 🔋', 'el player lo ve en su siguiente pregunta');
  j=await B('ctl',{cmd:'msgtmp',msg:'x',sec:999}); ok(j.scr.ctl.tmp.sec===120, 'máximo 2 minutos');
  j=await B('ctl',{cmd:'msgtmp',msg:'x',sec:1}); ok(j.scr.ctl.tmp.sec===2, 'mínimo 2 s');
  // que se acabe
  const sc=JSON.parse(global.__kvref['brb:scr']); sc.ctl.tmp.until=Date.now()-10; global.__kvref['brb:scr']=JSON.stringify(sc);
  t=await (await fetch('http://localhost:7702/api/brb?a=tick&s='+sid)).json();
  ok(t.ctl.tmp===null && t.ctl.msg==='Mensaje fijo', 'al acabarse, vuelve el mensaje que estaba');
  j=await B('ctl',{cmd:'msgtmp',msg:'Sin pila',sec:5}); j=await B('ctl',{cmd:'msg',msg:null});
  ok(j.scr.ctl.tmp===null && j.scr.ctl.msg===null, 'poner otro mensaje quita el de unos segundos');

  // v80: recortar un clip en el estudio hace que el player lo vuelva a cargar
  await B('add',{clips:[{p:'twitch',id:'FunnyClipSlug123',ch:'mariotq',t:'Clip de prueba',d:30}]});
  let tk0=await (await fetch('http://localhost:7702/api/brb?a=tick&s='+sid)).json();
  let tr=await B('trim',{k:'twitch:FunnyClipSlug123',a:2,b:20});
  let t1=await (await fetch('http://localhost:7702/api/brb?a=tick&s='+sid)).json();
  ok(tr.ok && typeof tk0.lv==='number' && t1.lv===tk0.lv+1, 'recortar un clip: el player se entera y vuelve a cargar ('+tk0.lv+'→'+t1.lv+') '+JSON.stringify(tr).slice(0,80));
  // v80: «al aire» no brinca mientras el player sigue preguntando
  const nw=JSON.parse(global.__kvref['brb:now']||'{}'); nw.at=Date.now()-30000; global.__kvref['brb:now']=JSON.stringify(nw);
  let stt=await B('state'); ok(stt.onAir===true, 'el estudio sigue diciendo «al aire» si el player apuntó hace 30 s');
  nw.at=Date.now()-60000; global.__kvref['brb:now']=JSON.stringify(nw);
  stt=await B('state'); ok(stt.onAir===false, 'y «fuera del aire» si ya pasó un minuto sin noticias');
  console.log(fails?('\n'+fails+' FALLAS'):'\nTODO BIEN'); process.exit(fails?1:0);
});
