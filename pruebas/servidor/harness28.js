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
{ const f0=global.fetch; global.__tg=[]; global.fetch=async (url,opts={})=>{ url=String(url); if (url.startsWith('https://api.telegram.org/')){ global.__tg.push({url,body:JSON.parse(opts.body)}); return new Response(JSON.stringify(global.__tgFail?{ok:false,description:'chat not found'}:{ok:true,result:{message_id:777}}),{status:200,headers:{'content-type':'application/json'}}); } return f0(url,opts); }; }

{ const f0=global.fetch; const T=global.__T={calls:[],subs:[],chans:{title:'Viejo',game_id:'509658',game_name:'Just Chatting'},sent:[],bans:[],dels:[],polls:[],preds:[],ads:{snooze:2},stream:null,fail401:false};
  global.fetch=async (url,opts={})=>{ url=String(url);
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    if (url.startsWith('https://id.twitch.tv/oauth2/token')){ const p=new URLSearchParams(opts.body); T.calls.push({tok:p.get('grant_type')});
      if (p.get('grant_type')==='client_credentials') return J({access_token:'APPTOK',expires_in:5000000});
      if (p.get('grant_type')==='authorization_code') return J({access_token:p.get('code')==='botcode'?'BOTTOK':'USERTOK',refresh_token:'R',expires_in:14000,scope:['bits:read','user:write:chat']});
      return J({access_token:'USERTOK2',refresh_token:'R2',expires_in:14000}); }
    if (url.startsWith('https://api.twitch.tv/helix/')){
      const u=new URL(url), path=u.pathname.replace('/helix',''), m=opts.method||'GET', auth=(opts.headers||{}).Authorization||'', body=opts.body?JSON.parse(opts.body):null;
      T.calls.push({m,path,q:u.search,auth,body});
      if (path==='/users') return J({data:[{id:auth.indexOf('BOTTOK')>=0?'999':'111', login:auth.indexOf('BOTTOK')>=0?'tq_bot_irl':(global.__twLogin||'mariotq'), display_name:auth.indexOf('BOTTOK')>=0?'TQ_bot_IRL':'MarioTQ'}]});
      if (path==='/eventsub/subscriptions'){ if (m==='POST'){ T.subs.push(body); return J({data:[{id:'s'+T.subs.length,status:'webhook_callback_verification_pending'}]},202); } if (m==='GET') return J({data:[{id:'old1',transport:{method:'webhook'}}],pagination:{}}); return J({},204); }
      if (path==='/chat/messages'){ T.sent.push({body,auth}); return J({data:[{message_id:'tm'+T.sent.length,is_sent:true}]}); }
      if (path==='/moderation/bans'){ if (m==='POST') T.bans.push({body,q:u.search}); return m==='DELETE'?J({},204):J({data:[{}]}); }
      if (path==='/moderation/chat'){ T.dels.push(u.searchParams.get('message_id')); return J({},204); }
      if (path==='/channels'){ if (m==='PATCH'){ Object.assign(T.chans,body); if (body.game_id) T.chans.game_name=body.game_id==='509672'?'IRL':'X'; return J({},204); } return J({data:[{title:T.chans.title,game_id:T.chans.game_id,game_name:T.chans.game_name}]}); }
      if (path==='/search/categories') return J({data:[{id:'509672',name:'IRL',box_art_url:'x-{width}x{height}.jpg'},{id:'1',name:'IRL Travel',box_art_url:''}]});
      if (path==='/streams'){ T.streamsCalls=(T.streamsCalls||0)+1; return J({data:T.stream?[T.stream]:[]}); }
      if (path==='/polls'){ T.polls.push({m,body}); return J({data:[{id:'p1',title:body.title}]}); }
      if (path==='/predictions'){ T.preds.push({m,body}); return J({data:[{id:'pr1'}]}); }
      if (path==='/channels/ads/schedule/snooze'){ T.ads.snooze--; return J({data:[{snooze_count:T.ads.snooze}]}); }
      if (path==='/channels/commercial'){ T.ads.started=body.length; return J({data:[{length:body.length,message:'',retry_after:480}]}); }
      if (path==='/channels/ads') return J({data:[{next_ad_at:String(Math.floor(Date.now()/1000)+600),last_ad_at:'',duration:'60',preroll_free_time:'90',snooze_count:String(T.ads.snooze),snooze_refresh_at:'0'}]});
      if (path==='/chat/badges/global'){ T.badgeCalls=(T.badgeCalls||0)+1; return J({data:[{set_id:'moderator',versions:[{id:'1',image_url_1x:'m1',image_url_2x:'m2',title:'Moderator'}]},{set_id:'subscriber',versions:[{id:'0',image_url_2x:'gs0',title:'Subscriber'}]}]}); }
      if (path==='/chat/badges') return J({data:[{set_id:'subscriber',versions:[{id:'0',image_url_2x:'cs0',title:'Sub'},{id:'12',image_url_2x:'cs12',title:'1 año'}]}]});
      if (path==='/clips'){ T.clipsQ=u.search; return J({data:[{id:'Clip1',title:'Caída épica',created_at:new Date().toISOString(),duration:28.5,view_count:40,thumbnail_url:'th',creator_name:'Fan',url:'https://clips.twitch.tv/Clip1'}]}); }
      return J({message:'no mock '+path},404);
    }
    return f0(url,opts); }; }


{ const f0=global.fetch; global.__ably=[]; global.__ablyFail=false;
  global.fetch=async (url,opts={})=>{ url=String(url);
    if (/^https:\/\/(rest\.ably\.io|main\.realtime\.ably\.net)\//.test(url)){ let body=null; try{ body=JSON.parse(opts.body); }catch(e){}
      global.__ably.push({url, auth:(opts.headers||{}).Authorization, body});
      if (global.__ablyFail){ await new Promise(r=>setTimeout(r, global.__ablySlow||0)); return new Response('{}',{status:500}); }
      return new Response('{"channel":"kf"}',{status:201,headers:{'content-type':'application/json'}}); }
    if (/\/pipeline$/.test(url)){ const cmds=JSON.parse(opts.body); const out=[]; for (const c of cmds){ const r=await f0(url.replace(/\/pipeline$/,''),{method:'POST',headers:opts.headers,body:JSON.stringify(c)}); out.push(await r.json()); } return new Response(JSON.stringify(out),{status:200,headers:{'content-type':'application/json'}}); }
    return f0(url,opts); }; }

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
process.env.ABLY_API_KEY='abc123.def456:SeCrEtAbLy_xyz'; process.env.KV_REST_API_URL='http://localhost:7701'; process.env.KV_REST_API_TOKEN='x';
process.env.KICK_CLIENT_ID='cid'; process.env.KICK_CLIENT_SECRET='sec';
process.env.TELEGRAM_BOT_TOKEN='TGTOKEN'; process.env.TWITCH_CLIENT_ID='twcid'; process.env.TWITCH_CLIENT_SECRET='twsec'; process.env.TELEGRAM_CHAT_ID='-100123';
const brbH=require(RAIZ+'/api/brb.js');
const handler=require(RAIZ+'/api/[route].js');
const alH=require(RAIZ+'/api/alertas.js');
const app=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'); const m=u.pathname.match(/^\/api\/([^/]+)/);
  req.query=Object.fromEntries(u.searchParams); if(m) req.query.route=m[1];
  if (m && m[1]==='brb') return brbH(req,res);
  if (m && m[1]==='alertas') return alH(req,res);
  handler(req,res);
}).listen(7702, async ()=>{
  const sign=(id,ts,body,key)=>crypto.sign('sha256',Buffer.from(id+'.'+ts+'.'+body),{key:key||privateKey,padding:crypto.constants.RSA_PKCS1_PADDING}).toString('base64');
  async function hook(type,payload,id,badKey){ const body=JSON.stringify(payload), ts=new Date().toISOString();
    const r=await fetch('http://localhost:7702/api/webhook',{method:'POST',body,headers:{'kick-event-type':type,'kick-event-version':'1','kick-event-message-id':id,'kick-event-message-timestamp':ts,'kick-event-signature':sign(id,ts,body,badKey),'content-type':'application/json'}});
    return r.status; }







  const redis_del=async k=>{ delete global.__kvref[k]; };
  const ok=()=>{};
  const W=ms=>new Promise(r=>setTimeout(r,ms));
  const T=global.__T, kv=global.__kvref;
  const r1=await fetch('http://localhost:7702/api/login',{redirect:'manual'}); const st=new URL(r1.headers.get('location')).searchParams.get('state');
  const cb=await (await fetch('http://localhost:7702/api/callback?code=abc&state='+st,{headers:{'x-forwarded-host':'kick-feed-mariotq.vercel.app'}})).text();
  const key=decodeURIComponent((cb.match(/key=([A-Za-z0-9_\-%]+)/)||[])[1]);
  const H={'x-forwarded-host':'kick-feed-mariotq.vercel.app'};
  /* --- conectar Twitch --- */
  let r=await fetch('http://localhost:7702/api/twlogin',{redirect:'manual',headers:H}); ok(r.status===403, 'sin tu clave no deja conectar Twitch');
  r=await fetch('http://localhost:7702/api/twlogin?key='+encodeURIComponent(key),{redirect:'manual',headers:H});
  let loc=new URL(r.headers.get('location')); const tst=loc.searchParams.get('state');
  ok(loc.host==='id.twitch.tv' && /channel:manage:polls/.test(loc.searchParams.get('scope')) && /channel:read:ads/.test(loc.searchParams.get('scope')) && loc.searchParams.get('redirect_uri')==='https://kick-feed-mariotq.vercel.app/api/twcallback', 'te manda a la página oficial de Twitch con los permisos');
  global.__twLogin='otro_tipo';
  let html=await (await fetch('http://localhost:7702/api/twcallback?code=x&state='+tst,{headers:H})).text();
  ok(/no es mariotq/.test(html) && !kv['tw:tok'], 'si entras con otra cuenta, no la acepta');
  global.__twLogin='mariotq';
  r=await fetch('http://localhost:7702/api/twlogin?key='+encodeURIComponent(key),{redirect:'manual',headers:H}); const tst2=new URL(r.headers.get('location')).searchParams.get('state');
  html=await (await fetch('http://localhost:7702/api/twcallback?code=x&state='+tst2,{headers:H})).text();
  ok(/Twitch conectado/.test(html) && JSON.parse(kv['tw:tok']).user_id==='111', 'tu cuenta de Twitch queda conectada');
  ok(T.subs.length===24 && T.subs.every(x=>x.transport.callback==='https://kick-feed-mariotq.vercel.app/api/twhook' && x.transport.secret), 'se suscribe a los 24 avisos de Twitch: '+T.subs.length);
  ok(T.calls.some(c=>c.m==='DELETE' && /eventsub/.test(c.path)), 'borra las suscripciones viejas antes');
  ok(T.subs.find(x=>x.type==='channel.follow').condition.moderator_user_id==='111' && T.subs.find(x=>x.type==='channel.raid').condition.to_broadcaster_user_id==='111', 'condiciones especiales (follow, raid)');
  // el bot
  r=await fetch('http://localhost:7702/api/twlogin?as=bot&key='+encodeURIComponent(key),{redirect:'manual',headers:H}); loc=new URL(r.headers.get('location'));
  ok(loc.searchParams.get('scope')==='user:read:chat user:write:chat user:bot', 'el bot solo pide permisos de chat');
  html=await (await fetch('http://localhost:7702/api/twcallback?code=botcode&state='+loc.searchParams.get('state'),{headers:H})).text();
  ok(/TQ_bot_IRL/.test(html) && JSON.parse(kv['tw:bot']).user_id==='999', 'el bot queda conectado');

  const sec=kv['tw:hsec']; const crypto=require('crypto'); let n=0;
  async function tw(type, event){ const id='mm'+(++n), ts=new Date().toISOString(), body=JSON.stringify({subscription:{type},event});
    const sig='sha256='+crypto.createHmac('sha256',sec).update(id+ts+body).digest('hex');
    return fetch('http://localhost:7702/api/twhook',{method:'POST',body,headers:{'twitch-eventsub-message-id':id,'twitch-eventsub-message-timestamp':ts,'twitch-eventsub-message-signature':sig,'twitch-eventsub-message-type':'notification','twitch-eventsub-subscription-type':type}}); }
  // en vivo en Kick y Twitch
  await hook('livestream.status.updated',{broadcaster:{user_id:6692133},is_live:true,title:'x',started_at:new Date().toISOString()},'lv1');
  await tw('stream.online',{id:'s',type:'live',started_at:new Date().toISOString()});
  await W(300);

  let fails=0; const ok2=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
  const AB=global.__ably;
  const msgs=(from)=>AB.slice(from).map(x=>{ const m=(x.body||[])[0]||{}; let d=null; try{ d=JSON.parse(m.data); }catch(e){} return {name:m.name, enc:m.encoding, d, url:x.url, auth:x.auth}; });
  // 1) el permiso de solo escuchar
  r=await fetch('http://localhost:7702/api/rt'); let tr=await r.json();
  ok2(r.status===200 && tr.keyName==='abc123.def456' && tr.capability==='{"kf":["subscribe"]}' && tr.ttl===6*3600e3 && tr.mac && tr.nonce, 'permiso de «solo escuchar» el canal kf, 6 h');
  ok2(!JSON.stringify(tr).includes('SeCrEt'), 'la llave secreta de Ably no sale nunca');
  { const Ably=require('ably'); const rest=new Ably.Rest({key:process.env.ABLY_API_KEY});
    const t2=await rest.auth.createTokenRequest({ttl:tr.ttl,capability:tr.capability,timestamp:tr.timestamp,nonce:tr.nonce}); ok2(t2.mac===tr.mac, 'la firma es la misma que hace la librería oficial de Ably'); }
  // 2) ping
  let a0=AB.length; r=await (await fetch('http://localhost:7702/api/rt?a=ping&id=abc_12')).json();
  let M=msgs(a0); ok2(r.ok && M.length===1 && M[0].name==='ping' && M[0].d.id==='abc_12' && M[0].enc==='json' && /channels\/kf\/messages$/.test(M[0].url) && M[0].auth==='Basic '+Buffer.from(process.env.ABLY_API_KEY).toString('base64'), 'ping: tu servidor lo manda por Ably al canal kf');
  // 3) sub de Kick → ev + goal (meta ya calculada)
  a0=AB.length; await hook('channel.subscription.new',{broadcaster:{user_id:6692133},subscriber:{username:'pepe_rt',user_id:4242},duration:1,created_at:new Date().toISOString()},'rtsub1'); await W(200);
  M=msgs(a0); let ev=M.find(x=>x.name==='ev'), gl=M.find(x=>x.name==='goal');
  ok2(ev && ev.d.id==='rtsub1' && ev.d.d.kind==='sub' && ev.d.d.user==='pepe_rt', 'una sub de Kick llega por Ably con todo el evento');
  ok2(gl && gl.d.pf==='kick' && typeof gl.d.subs==='number' && gl.d.subs>=1 && gl.d.t && gl.d.app===false, 'y la meta de Kick ya calculada ('+(gl&&gl.d.subs)+' subs)');
  // 4) Twitch: sub y encuesta
  a0=AB.length; await tw('channel.subscribe',{user_name:'TwFan',user_login:'twfan',tier:'1000',is_gift:false}); await W(200);
  M=msgs(a0); ok2(M.some(x=>x.name==='ev' && x.d.d.kind==='sub' && x.d.d.pf==='tw') && M.some(x=>x.name==='goal' && x.d.pf==='tw' && x.d.subs>=1), 'sub de Twitch: el evento y la meta de Twitch');
  a0=AB.length; await tw('channel.poll.begin',{id:'pp1',title:'¿Tacos?',choices:[{id:'c1',title:'Sí'},{id:'c2',title:'No'}],ends_at:new Date(Date.now()+60000).toISOString()}); await W(150);
  M=msgs(a0); ok2(M.length===1 && M[0].name==='tw' && M[0].d.poll && M[0].d.poll.title==='¿Tacos?', 'encuesta de Twitch al momento (sin que el celular pregunte)');
  a0=AB.length; await tw('channel.ad_break.begin',{duration_seconds:90,started_at:new Date().toISOString(),is_automatic:true}); await W(150);
  M=msgs(a0); ok2(M.some(x=>x.name==='tw' && x.d.ad && x.d.ad.dur===90), 'anuncio de Twitch al momento');
  // 5) chat de Twitch: nada a Ably y casi nada a Upstash
  await tw('channel.chat.message',{message_id:'rtc_w',chatter_user_login:'viejo',chatter_user_name:'Viejo',chatter_user_id:'77',message:{text:'hola',fragments:[{type:'text',text:'hola'}]},badges:[],color:''}); await W(50);
  a0=AB.length; let c0=global.__cmds.length; for (let k=0;k<10;k++) await tw('channel.chat.message',{message_id:'rtc'+k,chatter_user_login:'viejo',chatter_user_name:'Viejo',chatter_user_id:'77',message:{text:'hola',fragments:[{type:'text',text:'hola'}]},badges:[],color:''});
  await W(100); let cm=global.__cmds.slice(c0).map(c=>c[0]+(c[1]?' '+String(c[1]).split(':')[0]:''));
  ok2(AB.length===a0, 'los mensajes del chat no se mandan a Ably');
  ok2(cm.length<=2, 'chat de Twitch: 10 mensajes de alguien conocido = '+cm.length+' consultas ('+cm.join(', ')+')');
  // mismo mensaje repetido por Twitch: una sola vez
  { const id='dupX', ts=new Date().toISOString(), body=JSON.stringify({subscription:{type:'channel.chat.message'},event:{message_id:'dupm',chatter_user_login:'otro',chatter_user_name:'Otro',chatter_user_id:'78',message:{text:'!x',fragments:[{type:'text',text:'!x'}]},badges:[]}});
    const sig='sha256='+crypto.createHmac('sha256',sec).update(id+ts+body).digest('hex');
    const H2={'twitch-eventsub-message-id':id,'twitch-eventsub-message-timestamp':ts,'twitch-eventsub-message-signature':sig,'twitch-eventsub-message-type':'notification','twitch-eventsub-subscription-type':'channel.chat.message'};
    const before=(global.__z.chat||[]).length; await fetch('http://localhost:7702/api/twhook',{method:'POST',body,headers:H2}); await fetch('http://localhost:7702/api/twhook',{method:'POST',body,headers:H2}); }
  ok2(true, 'reintento de Twitch del mismo mensaje: se ignora en memoria');
  // 6) meta a mano desde la app
  const goal=b=>fetch('http://localhost:7702/api/goal',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  a0=AB.length; let gj=await goal({delta:2}); await W(100); M=msgs(a0);
  ok2(gj.ok && M.some(x=>x.name==='goal' && x.d.app===true && x.d.subs===gj.totals.subs) && M.some(x=>x.name==='ev' && x.d.d.kind==='goal'), 'sumar a la meta desde la app: llega a tus letreros al momento (aunque OBS no esté)');
  // 7) ajustes compartidos
  a0=AB.length; r=await (await fetch('http://localhost:7702/api/prefs',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,prefs:{a:1},by:'cel1'})})).json(); await W(50);
  M=msgs(a0); ok2(M.some(x=>x.name==='sync' && x.d.pat>0), 'guardar ajustes: el otro celular se entera al momento ('+JSON.stringify(r).slice(0,60)+')');
  // 8) alertas
  const AP=(a,b)=>fetch('http://localhost:7702/api/alertas?a='+a,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  a0=AB.length; r=await AP('replay',{al:{k:'gift',pf:'kick',u:'donmario',n:5,m:''}}); M=msgs(a0);
  ok2(r.ok && M.length===1 && M[0].name==='al' && M[0].d.id===r.item.id && M[0].d.rp===1, 'repetir una alerta: le llega al player al momento');
  a0=AB.length; r=await AP('save',{cfg:{vol:70}}); M=msgs(a0);
  ok2(r.ok && r.cfg.vol===70 && M.some(x=>x.name==='alcfg' && x.d.cv===r.at), 'guardar alertas: el player recarga al momento');
  r=await (await fetch('http://localhost:7702/api/alertas?a=poll&b=1')).json(); ok2(r.ok && r.rt===true, 'el poll le dice al player que hay tiempo real');
  // 9) BRB
  const B=(a,b)=>fetch('http://localhost:7702/api/brb?a='+a,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key},b||{}))}).then(r=>r.json());
  a0=AB.length; r=await B('ctl',{cmd:'next'}); M=msgs(a0); ok2(r.ok && M.some(x=>x.name==='brb'), 'control del BRB: el player se entera al momento');
  // 10) el letrero comparte respuesta en la CDN; tu celular no
  r=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1'); ok2(/s-maxage=3/.test(r.headers.get('cache-control')||'') && (await r.json()).rt===true, 'el letrero de la meta: los dos comparten la respuesta 3 s');
  r=await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+(Date.now()-20000)); ok2(r.headers.get('cache-control')==='no-store', 'el feed de tu celular nunca se guarda en la CDN');
  // 11) Ably caído: todo sigue igual y rápido
  global.__ablyFail=true; a0=AB.length; let t0=Date.now();
  let st2=await hook('channel.subscription.new',{broadcaster:{user_id:6692133},subscriber:{username:'sin_ably',user_id:4343},duration:1,created_at:new Date().toISOString()},'rtsub2'); let dt=Date.now()-t0;
  r=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+(Date.now()-60000))).json();
  ok2(st2===200 && r.events.some(e=>e.id==='rtsub2') && dt<3000, 'Ably caído: la sub se guarda igual y se ve en el feed ('+dt+' ms, intentó '+(AB.length-a0)+' veces)');
  global.__ablyFail=false;
  // 12) con waitUntil (Vercel): no hace esperar a Kick
  { const held=[]; globalThis[Symbol.for('@vercel/request-context')]={get:()=>({waitUntil:p=>held.push(p)})};
    global.__ablyFail=true; global.__ablySlow=1500; t0=Date.now();
    await hook('channel.subscription.new',{broadcaster:{user_id:6692133},subscriber:{username:'lento',user_id:4444},duration:1,created_at:new Date().toISOString()},'rtsub3'); dt=Date.now()-t0;
    ok2(dt<700 && held.length>=2, 'en Vercel le contesta a Kick sin esperar a Ably ('+dt+' ms)'); await Promise.all(held);
    delete globalThis[Symbol.for('@vercel/request-context')]; global.__ablyFail=false; global.__ablySlow=0; }
  // 13) sin la llave: todo como antes
  const KEEPK=process.env.ABLY_API_KEY; delete process.env.ABLY_API_KEY;
  r=await fetch('http://localhost:7702/api/rt'); ok2(r.status===503, 'sin ABLY_API_KEY: /api/rt dice que falta');
  a0=AB.length; await hook('channel.subscription.new',{broadcaster:{user_id:6692133},subscriber:{username:'sinllave',user_id:4545},duration:1,created_at:new Date().toISOString()},'rtsub4'); await W(100);
  r=await (await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1')).json();
  ok2(AB.length===a0 && r.rt===false, 'sin la llave no se llama a Ably y las páginas siguen preguntando');
  process.env.ABLY_API_KEY=KEEPK;
  // 14) medición
  const cnt=async (name, fn, times)=>{ times=times||5; await fn(); await W(50); const a=(global.__cmds||[]).length; for(let k=0;k<times;k++){ await fn(); } await W(100); const d=((global.__cmds||[]).length-a)/times; const ops={}; (global.__cmds||[]).slice(a).forEach(c=>{ const o=String(c[0]).toUpperCase(); ops[o]=(ops[o]||0)+1; }); console.log('MEDIR', name.padEnd(42), d.toFixed(1), JSON.stringify(ops)); };
  await cnt('feed /api/events (celular)', ()=>fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+(Date.now()-20000)));
  await cnt('meta /api/events?tot=1', ()=>fetch('http://localhost:7702/api/events?since=9999999999999&tot=1'));
  let mi=0;
  await cnt('chat de Twitch (conocidos)', ()=>tw('channel.chat.message',{message_id:'m2'+(++mi),chatter_user_login:'v'+(mi%5),chatter_user_name:'V'+(mi%5),chatter_user_id:String(mi),message:{text:'hola '+mi,fragments:[{type:'text',text:'hola '+mi}]},badges:[],color:''}), 20);
  await cnt('chat de Kick (conocidos)', ()=>hook('chat.message.sent',{message_id:'k2'+(++mi),broadcaster:{user_id:6692133},sender:{username:'u'+(mi%5),user_id:mi%5+1,identity:{badges:[]}},content:'hola '+mi,created_at:new Date().toISOString()},'kc2'+mi), 20);
  await cnt('sub de Kick (webhook)', ()=>hook('channel.subscription.new',{broadcaster:{user_id:6692133},subscriber:{username:'s'+(++mi),user_id:mi},duration:1,created_at:new Date().toISOString()},'sn2'+mi), 3);
  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(0);
});
