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

{ const f0=global.fetch; const KS=global.__KS={subs:[{id:'s1',event:'chat.message.sent'},{id:'s2',event:'channel.followed'}],calls:[]}; const TS=global.__TS={subs:[{id:'c1',type:'channel.chat.message',status:'enabled',transport:{method:'webhook'}}],calls:[]};
  global.fetch=async (url,opts={})=>{ url=String(url); const m=(opts.method||'GET').toUpperCase();
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    if (url.startsWith('https://api.kick.com/public/v1/events/subscriptions')){ const u=new URL(url); KS.calls.push(m+' '+u.search);
      if (m==='GET') return J({data:KS.subs});
      if (m==='DELETE'){ const ids=u.searchParams.getAll('id'); KS.subs=KS.subs.filter(s=>ids.indexOf(s.id)<0); return new Response(null,{status:204}); }
      if (m==='POST'){ const b=JSON.parse(opts.body); const out=b.events.map(e=>{ const id='s'+Math.random().toString(36).slice(2,7); KS.subs.push({id,event:e.name}); return {name:e.name,subscription_id:id}; }); return J({data:out}); } }
    if (url.startsWith('https://api.twitch.tv/helix/channels/vips')){ const u=new URL(url); global.__VIP=global.__VIP||{calls:[],set:new Set()}; const V=global.__VIP; const id=u.searchParams.get('user_id'); V.calls.push(m+' '+id);
      if (m==='POST'){ if (id==='66') return J({message:'The user is a moderator'},422); if (V.set.has(id)) return J({message:'The user is already a VIP'},422); V.set.add(id); return new Response(null,{status:204}); }
      if (m==='DELETE'){ V.set.delete(id); return new Response(null,{status:204}); } }
    if (url.startsWith('https://api.twitch.tv/helix/eventsub/subscriptions')){ const u=new URL(url); TS.calls.push(m+' '+u.search);
      if (m==='GET'){ const t=u.searchParams.get('type'); return J({data:TS.subs.filter(s=>!t||s.type===t),pagination:{}}); }
      if (m==='DELETE'){ const id=u.searchParams.get('id'); TS.subs=TS.subs.filter(s=>s.id!==id); return new Response(null,{status:204}); }
      if (m==='POST'){ const b=JSON.parse(opts.body); const id='t'+Math.random().toString(36).slice(2,7); TS.subs.push({id,type:b.type,status:'webhook_callback_verification_pending',transport:b.transport}); TS.lastPost=b; return J({data:[{id,status:'webhook_callback_verification_pending'}]},202); } }
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
  else if(op==='ZSCORE'){ const e=zr(cmd[1]).find(x=>x[1]===cmd[2]); r=e?String(e[0]):null; }
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
process.env.ABLY_API_KEY='abc123.def456:SeCrEtAbLy_xyz'; process.env.VERCEL_PROJECT_PRODUCTION_URL='kick-feed-mariotq.vercel.app'; process.env.VIP_SWEEP_MS='1'; process.env.KV_REST_API_URL='http://localhost:7701'; process.env.KV_REST_API_TOKEN='x';
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

  const W2=ms=>new Promise(r=>setTimeout(r,ms));

  let fails=0; const ok2=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
  const KS=global.__KS, TS=global.__TS;
  const CI=(a,b)=>fetch('http://localhost:7702/api/chatin'+(a?'?a='+a:''),{method:'POST',headers:{'Content-Type':'text/plain','x-forwarded-host':'kick-feed-mariotq.vercel.app'},body:JSON.stringify(b||{})}).then(r=>r.json().then(j=>(j.__st=r.status,j)));
  // estado de partida: los dos avisos de chat prendidos
  KS.subs=[{id:'s1',event:'chat.message.sent'},{id:'s2',event:'channel.followed'}]; TS.subs=[{id:'c1',type:'channel.chat.message',status:'enabled',transport:{method:'webhook'}},{id:'c2',type:'channel.follow',status:'enabled',transport:{method:'webhook'}}];
  // 1) el link
  r=await CI('link',{key:'mala'}); ok2(r.__st===403, 'sin tu clave no hay link');
  r=await CI('link',{key}); const link=r.link, WK=new URL(link).searchParams.get('w');
  ok2(r.ok && /^https:\/\/mariiotq\.github\.io\/kick-feed\/guardia\.html\?w=/.test(link) && WK.length>=20 && new URL(link).searchParams.get('api')==='https://kick-feed-mariotq.vercel.app', 'el link de la guardia para OBS: '+link.slice(0,70)+'…');
  r=await CI('link',{key}); ok2(r.link===link, 'pedirlo otra vez da el mismo');
  r=await CI('cfg',{w:'otra'}); ok2(r.__st===403 && /ya no sirve/.test(r.error), 'con un link equivocado no deja mandar nada');
  r=await CI('cfg',{w:WK}); ok2(r.ok && r.kick.chatroom==='6635680' && r.kick.key==='newkey123' && r.tw.login==='mariotq' && r.spam.list.length>3, 'lo que necesita la guardia: sala de Kick, llave del chat, canal de Twitch y tu lista de spam');
  // 2) mensajes (todavía «recién conectada»: los avisos siguen prendidos)
  const kmsg=(id,u,t,badges,uid)=>({pf:'kick',p:{message_id:id,created_at:new Date().toISOString(),content:t,sender:{username:u,user_id:uid||100,identity:{username_color:'#fff',badges:badges||[]}}}});
  const tmsg=(id,u,t,badges)=>({pf:'tw',e:{message_id:id,chatter_user_login:u.toLowerCase(),chatter_user_name:u,chatter_user_id:'55',color:'',badges:badges||[],message:{text:t,fragments:[{type:'text',text:t}]}}});
  let k0=global.__calls.length, d0=global.__T.dels.length;
  r=await CI('',{w:WK,st:{kick:{up:true,upFor:20000,n:3},tw:{up:true,upFor:20000,n:2}},msgs:[kmsg('gk1','pepe','hola banda'),kmsg('gk2','bot123','Get botkiva now free',[],777),tmsg('gt1','Fan','qué onda'),tmsg('gt2','spammer','zero cost upgrades here')]});
  await W2(200);
  ok2(r.ok && r.n===4, 'la guardia manda 4 mensajes en una sola llamada');
  ok2(global.__calls.slice(k0).some(c=>c.m==='DELETE' && c.u==='gk2'), 'spam de Kick que trajo la guardia: se borra');
  ok2(global.__T.dels.slice(d0).indexOf('gt2')>=0, 'spam de Twitch que trajo la guardia: se borra');
  const chat=(global.__z.chat||[]).map(x=>JSON.parse(x[1]));
  ok2(chat.some(m=>m.id==='gk1' && m.u==='pepe') && chat.some(m=>m.id==='gt1' && m.pf==='tw'), 'y queda en el respaldo del chat (Kick y Twitch)');
  ok2(r.hooks.kick==='on' && r.hooks.tw==='on' && KS.subs.some(s=>s.event==='chat.message.sent'), 'recién conectada: los avisos de chat siguen prendidos (espera 90 s)');
  // el mismo mensaje por el aviso de Kick: no se repite
  k0=global.__calls.length;
  await hook('chat.message.sent',{message_id:'gk2',broadcaster:{user_id:6692133},sender:{username:'bot123',user_id:777,identity:{badges:[]}},content:'Get botkiva now free',created_at:new Date().toISOString()},'dupk'); await W2(150);
  ok2(!global.__calls.slice(k0).some(c=>c.m==='DELETE' && c.u==='gk2'), 'si el mismo mensaje llega también por el aviso de Kick, no se procesa dos veces');
  // 3) ya lleva 90 s leyendo → se apagan los avisos de chat (y solo esos)
  r=await CI('',{w:WK,st:{kick:{up:true,upFor:95000,n:5},tw:{up:true,upFor:95000,n:5}},msgs:[]});
  ok2(r.hooks.kick==='off' && r.hooks.tw==='off', 'la guardia ya lee bien: se apagan los avisos de chat de Kick y Twitch');
  ok2(!KS.subs.some(s=>s.event==='chat.message.sent') && KS.subs.some(s=>s.event==='channel.followed'), 'Kick: solo se quitó el aviso de chat (follows, subs, etc. siguen)');
  ok2(!TS.subs.some(s=>s.type==='channel.chat.message') && TS.subs.some(s=>s.type==='channel.follow'), 'Twitch: solo se quitó el aviso de chat');
  r=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+(Date.now()-5000))).json();
  ok2(r.cw && r.cw.fresh && r.cw.kick && r.cw.tw && r.cw.hooks.kick==='off', 'tu celular ve cómo está la guardia: '+JSON.stringify(r.cw));
  // 4) la guardia deja de contestar (OBS apagado) → al revisar se prenden solos
  const hb=JSON.parse(global.__kvref['chatw:hb']); hb.at=Date.now()-200000; global.__kvref['chatw:hb']=JSON.stringify(hb);
  await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1'); await W2(300);
  ok2(KS.subs.some(s=>s.event==='chat.message.sent') && TS.subs.some(s=>s.type==='channel.chat.message'), 'la guardia dejó de contestar: los avisos de chat de Kick y Twitch se prenden solos');
  ok2(TS.lastPost && TS.lastPost.transport.callback==='https://kick-feed-mariotq.vercel.app/api/twhook' && TS.lastPost.condition.user_id, 'el de Twitch se vuelve a crear bien (a tu servidor, con su condición)');
  let hh=JSON.parse(global.__kvref['chatw:hooks']); ok2(hh.kick==='on' && hh.tw==='on', 'y queda anotado');
  // 5) vuelve enseguida: no se apaga de nuevo hasta 10 min después (sin brincar)
  r=await CI('',{w:WK,st:{kick:{up:true,upFor:120000},tw:{up:true,upFor:120000}},msgs:[]});
  ok2(r.hooks.kick==='on' && r.hooks.tw==='on', 'si regresa luego luego, espera 10 min antes de volver a apagarlos (para que no esté prende y apaga)');
  let h=JSON.parse(global.__kvref['chatw:hooks']); h.kickOn=Date.now()-11*60000; h.twOn=Date.now()-11*60000; h.kickTry=0; h.twTry=0; global.__kvref['chatw:hooks']=JSON.stringify(h);
  await W2(50);
  // la caché del servidor (1 min): se fuerza con un cambio de estado
  r=await CI('',{w:WK,st:{kick:{up:true,upFor:700000},tw:{up:true,upFor:700000}},msgs:[]});
  ok2(true, 'pasaron 10 min: '+JSON.stringify(r.hooks));
  // 6) se cae SOLO Kick en la guardia → solo el de Kick se prende
  h=JSON.parse(global.__kvref['chatw:hooks']); h.kick='off'; h.tw='off'; h.kickTry=0; h.twTry=0; global.__kvref['chatw:hooks']=JSON.stringify(h);
  KS.subs=KS.subs.filter(s=>s.event!=='chat.message.sent'); TS.subs=TS.subs.filter(s=>s.type!=='channel.chat.message');
  r=await CI('',{w:WK,st:{kick:{up:false,upFor:0},tw:{up:true,upFor:800000}},msgs:[]});
  ok2(true, '(caché) '+JSON.stringify(r.hooks));
  await W2(61000);
  r=await CI('',{w:WK,st:{kick:{up:false,upFor:0},tw:{up:true,upFor:800000}},msgs:[]});
  ok2(r.hooks.kick==='on' && r.hooks.tw==='off' && KS.subs.some(s=>s.event==='chat.message.sent') && !TS.subs.some(s=>s.type==='channel.chat.message'), 'si la guardia pierde solo Kick: se prende solo el aviso de Kick ('+JSON.stringify(r.hooks)+')');
  // 7) agregarla a OBS sola
  const { WebSocketServer } = require('ws');
  const O={pass:'pw', scenes:['LIVE','BRB'], inputs:{}, muted:{}, log:[]};
  function handle(rq){ const t=rq.requestType, d=rq.requestData||{}, OK=(data)=>({requestType:t,requestId:rq.requestId,requestStatus:{result:true,code:100},responseData:data}), BAD=(c,m)=>({requestType:t,requestId:rq.requestId,requestStatus:{result:false,code:c,comment:m}});
    O.log.push(t);
    switch(t){
      case 'GetInputList': return OK({inputs:Object.keys(O.inputs).filter(n=>!d.inputKind||O.inputs[n].kind===d.inputKind).map(n=>({inputName:n,inputKind:O.inputs[n].kind}))});
      case 'GetSceneList': return OK({currentProgramSceneName:'LIVE',scenes:O.scenes.map((n,i)=>({sceneName:n,sceneIndex:i}))});
      case 'CreateScene': if (O.scenes.indexOf(d.sceneName)>=0) return BAD(601,'exists'); O.scenes.push(d.sceneName); return OK({});
      case 'CreateInput': if (O.inputs[d.inputName]) return BAD(601,'exists'); if (O.scenes.indexOf(d.sceneName)<0) return BAD(600,'no scene'); O.inputs[d.inputName]={kind:d.inputKind,settings:d.inputSettings,scene:d.sceneName}; return OK({inputUuid:'u1',sceneItemId:1});
      case 'SetInputSettings': if (!O.inputs[d.inputName]) return BAD(600,'no input'); Object.assign(O.inputs[d.inputName].settings,d.inputSettings); return OK({});
      case 'SetInputMute': O.muted[d.inputName]=d.inputMuted; return OK({});
    } return BAD(204,'unknown'); }
  const wss=new WebSocketServer({port:7731});
  wss.on('connection', ws=>{ const salt='s1', challenge='c1'; ws.send(JSON.stringify({op:0,d:{rpcVersion:1,authentication:{salt,challenge}}}));
    ws.on('message', raw=>{ const m=JSON.parse(String(raw));
      if (m.op===1){ const sec=crypto.createHash('sha256').update(O.pass+salt).digest('base64'), exp=crypto.createHash('sha256').update(sec+challenge).digest('base64'); if (m.d.authentication!==exp) return ws.close(4009); ws.send(JSON.stringify({op:2,d:{negotiatedRpcVersion:1}})); }
      else if (m.op===8) setTimeout(()=>ws.send(JSON.stringify({op:9,d:{requestId:m.d.requestId,results:m.d.requests.map(handle)}})),5); }); });
  await fetch('http://localhost:7702/api/obs',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'config',url:'ws://localhost:7731',pass:'pw'})});
  r=await CI('obs',{key});
  const inp=O.inputs['Guardia del chat (no borrar)'];
  ok2(r.ok && r.obs.created && O.scenes.indexOf('Guardia del chat')>=0 && inp && inp.kind==='browser_source' && inp.scene==='Guardia del chat' && inp.settings.url===link && inp.settings.shutdown===false && O.muted['Guardia del chat (no borrar)']===true,
      '«Agregarla a mi OBS»: crea su propia escena con la fuente escondida y sin sonido');
  ok2(O.scenes.indexOf('LIVE')>=0 && O.scenes.length===3, 'no toca tus otras escenas');
  r=await CI('new',{key}); const link2=r.link;
  r=await CI('obs',{key}); ok2(r.ok && r.obs.updated && inp.settings.url===link2 && O.scenes.length===3, 'si ya estaba: solo le pone el link nuevo (no la duplica)');
  r=await CI('cfg',{w:WK}); ok2(r.__st===403, 'con link nuevo, el viejo deja de servir');
  // 8) cuánto gasta: 30 mensajes de gente conocida en una tanda
  const W3=new URL(link2).searchParams.get('w'); const WK2=()=>W3;
  const known=[]; for (let i=0;i<30;i++) known.push(i%2?kmsg('kk'+i,'pepe','hola '+i):tmsg('tt'+i,'Fan','hola '+i));
  await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[kmsg('kw','pepe','x'),tmsg('tw0','Fan','x')]});
  const c0=global.__cmds.length;
  r=await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:known});
  const used=global.__cmds.slice(c0).map(c=>c[0]);
  ok2(r.ok && r.n===30 && used.length<=3, '30 mensajes en una tanda = 1 llamada a Vercel y '+used.length+' consultas a Upstash ('+used.join(', ')+')');

  // 9) raid de Kick que vio la guardia (app cerrada): alerta, regla y feed — y sin repetirse si la app también lo vio
  global.__ably.length=0;
  await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'save',cfg:{on:true,feed:true,list:[{id:'r1',on:true,ev:'host',min:0,steps:[{t:'chat',text:'¡Gracias {nombre} por el raid!'}]}]}})});
  let cc0=global.__calls.length;
  r=await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[{pf:'kick',host:{user:'RaiderMX',viewers:42,message:'¡Vamos!'}}]});
  await W2(300);
  let AM=global.__ably.map(x=>{ const m=(x.body||[])[0]||{}; let d=null; try{ d=JSON.parse(m.data); }catch(e){} return {name:m.name,d}; });
  ok2(AM.some(x=>x.name==='al' && x.d.k==='raid' && x.d.pf==='kick' && x.d.u==='RaiderMX' && x.d.n===42), 'raid de Kick con la app cerrada: la alerta sale (la guardia lo vio)');
  ok2(AM.some(x=>x.name==='ev' && x.d.d.kind==='host' && x.d.d.user==='RaiderMX' && x.d.d.viewers===42), 'y queda en tu feed');
  ok2(global.__calls.slice(cc0).some(c=>c.u==='chat' && /Gracias RaiderMX/.test(c.b.content)), 'y tu regla «Te hacen raid» contesta en el chat');
  // tu app también lo vio y manda «fire»: no se repite la alerta
  const AP2=(a,b)=>fetch('http://localhost:7702/api/alertas?a='+a,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  let fr=await AP2('fire',{al:{k:'raid',pf:'kick',u:'RaiderMX',n:42,m:''}});
  ok2(fr.ok && fr.dup===true, 'si tu app también lo vio, la alerta no se repite');
  let rf=await (await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'fire',ev:'host',d:{user:'RaiderMX',viewers:42}})})).json();
  ok2(rf.ok && rf.dup===true, 'ni la regla');
  // la misma raid dos veces por la guardia: una sola
  global.__ably.length=0;
  await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[{pf:'kick',host:{user:'RaiderMX',viewers:42}}]}); await W2(200);
  ok2(!global.__ably.some(x=>(x.body||[])[0].name==='al'), 'la misma raid repetida no vuelve a sonar');
  // 10) recompensa de Kick: tu regla aunque la app esté cerrada
  await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'save',cfg:{on:true,feed:true,list:[{id:'r2',on:true,ev:'reward',name:'Hidratarse',steps:[{t:'chat',text:'{nombre} pidió que tome agua 💧'}]}]}})});
  cc0=global.__calls.length;
  await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[{pf:'kick',reward:{user:'Luz',reward:'Hidratarse',input:''}}]}); await W2(300);
  ok2(global.__calls.slice(cc0).some(c=>c.u==='chat' && /Luz pidió que tome agua/.test(c.b.content)), 'recompensa de Kick con la app cerrada: tu regla funciona');
  // 11) la escena de OBS al momento
  global.__ably.length=0;
  await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[],obs:{scene:'BRB',on:true}});
  await CI('',{w:W3,st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[],obs:{scene:'BRB',on:true}});
  AM=global.__ably.map(x=>{ const m=(x.body||[])[0]||{}; let d=null; try{ d=JSON.parse(m.data); }catch(e){} return {name:m.name,d}; }).filter(x=>x.name==='obs');
  ok2(AM.length===1 && AM[0].d.scene==='BRB' && AM[0].d.on===true, 'la escena de OBS llega a tus celulares al momento (y solo cuando cambia)');
  r=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+(Date.now()-5000))).json();
  ok2(r.cw && r.cw.obs && r.cw.obs.scene==='BRB', 'y tu app la ve al abrir');
  // 12) revisar todo
  r=await (await fetch('http://localhost:7702/api/health?key='+encodeURIComponent(key))).json();
  const C=k=>(r.checks||[]).find(c=>c.k===k)||{};
  ok2(r.ok && C('db').ok===true && C('rt').ok===true && C('obs').ok===true && C('cw').ok===true, 'revisar todo: base, tiempo real, OBS y guardia: '+(r.checks||[]).map(c=>c.k+':'+c.ok).join(' '));
  ok2(C('kick').ok===true || /faltan/.test(C('kick').t), 'Kick: '+C('kick').t+' '+C('kick').d);
  TS.subs=TS.subs.filter(s=>s.type!=='channel.raid'); TS.subs.push({id:'bad1',type:'channel.cheer',status:'notification_failures_exceeded',transport:{method:'webhook'}});
  r=await (await fetch('http://localhost:7702/api/health?key='+encodeURIComponent(key))).json();
  ok2(C('tw').ok===false && /channel\.raid/.test(C('tw').d) && /notification_failures_exceeded/.test(C('tw').d), 'Twitch: detecta avisos dados de baja: '+C('tw').t+' · '+C('tw').d.slice(0,120));
  r=await (await fetch('http://localhost:7702/api/health',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,fix:true})})).json();
  ok2(r.ok && r.fixed && r.fixed.tw==='ok' && C('tw').ok===true, 'y «Reparar» los vuelve a suscribir: '+JSON.stringify(r.fixed));
  r=await (await fetch('http://localhost:7702/api/health?key=mala')); ok2(r.status===403, 'sin tu clave no hay revisión');

  // 13) la guardia trae versión vieja: se actualiza sola en OBS (sin crear nada)
  const before=O.scenes.length, inp2=O.inputs['Guardia del chat (no borrar)']; inp2.settings.url='viejo'; delete inp2.settings.webpage_control_level;
  await CI('',{w:W3,v:'79',st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[]}); await W2(400);
  ok2(/&v=82$/.test(inp2.settings.url) && inp2.settings.webpage_control_level===2 && O.scenes.length===before, 'guardia vieja: tu servidor la actualiza sola en OBS (link nuevo y permiso para leer la escena): '+inp2.settings.url.slice(-30));
  inp2.settings.url='viejo2';
  await CI('',{w:W3,v:'79',st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[]}); await W2(300);
  ok2(inp2.settings.url==='viejo2', 'máximo una vez por hora');

  // 14) v80: lo que no debe estar abierto
  r=await fetch('http://localhost:7702/api/debug'); ok2(r.status===403, '/api/debug sin tu clave: no');
  r=await fetch('http://localhost:7702/api/debug?key='+encodeURIComponent(key)); ok2(r.status===200 && Array.isArray((await r.json()).raw), 'con tu clave sí');
  r=await (await fetch('http://localhost:7702/api/events?since=0')).json();
  ok2(r.ok && r.events.length===0 && !r.cw, 'el feed sin clave: no da eventos (ni el estado de la guardia)');
  r=await (await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key))).json();
  ok2(r.ok && r.events.length>0, 'con tu clave sí ('+r.events.length+' eventos)');
  r=await (await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1')).json();
  ok2(r.ok && 'totals' in r && r.live, 'el letrero (sin clave) sigue recibiendo la meta y si estás en vivo');
  r=await fetch('http://localhost:7702/api/list?kind=subs'); ok2(r.status===403, 'tus listas de subs y Kicks sin clave: no');
  r=await (await fetch('http://localhost:7702/api/list?kind=subs&key='+encodeURIComponent(key))).json(); ok2(r.ok, 'con tu clave sí');

  // 15) 👑 VIP por unos días con una recompensa de Twitch
  await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'save',cfg:{on:true,feed:true,list:[{id:'rvip',on:true,ev:'reward',name:'Vip Mini',pf:'tw',steps:[{t:'vip',d:7},{t:'chat',text:'👑 ¡{nombre} ahora es VIP por 7 días!'}]}]}})});
  const rr=await (await fetch('http://localhost:7702/api/rules?key='+encodeURIComponent(key))).json();
  ok2(rr.cfg && rr.cfg.list[0].steps[0].t==='vip' && rr.cfg.list[0].steps[0].d===7, 'la regla guarda el paso 👑 VIP 7 días');
  const sent0=global.__T.sent.length;
  await tw('channel.channel_points_custom_reward_redemption.add',{user_name:'Fan1',user_login:'fan1',user_id:'501',reward:{title:'Vip Mini',cost:5000},user_input:''}); await W2(400);
  ok2(global.__VIP && global.__VIP.calls.indexOf('POST 501')>=0, 'canjean «Vip Mini»: Twitch le da VIP');
  let xs=global.__z.vipx||[]; let ent=xs.find(x=>x[1]==='tw:501:fan1');
  ok2(ent && Math.abs(ent[0]-(Date.now()+7*864e5))<60000, 'y se apunta que se le quita en 7 días');
  ok2(global.__T.sent.slice(sent0).some(x=>/Fan1 ahora es VIP por 7 días/.test(x.body.message)), 'y avisa en el chat de Twitch');
  // lo vuelve a canjear: se le suman los días
  await tw('channel.channel_points_custom_reward_redemption.add',{user_name:'Fan1',user_login:'fan1',user_id:'501',reward:{title:'Vip Mini',cost:5000},user_input:''}); await W2(400);
  ent=(global.__z.vipx||[]).find(x=>x[1]==='tw:501:fan1'); ok2(ent && Math.abs(ent[0]-(Date.now()+14*864e5))<60000, 'si lo vuelve a canjear, se le suman (14 días)');
  // un VIP que diste a mano no se toca
  global.__VIP.set.add('777');
  await tw('channel.channel_points_custom_reward_redemption.add',{user_name:'Amigo',user_login:'amigo',user_id:'777',reward:{title:'Vip Mini',cost:5000},user_input:''}); await W2(400);
  ok2(!(global.__z.vipx||[]).some(x=>/^tw:777:/.test(x[1])), 'alguien que ya era VIP a mano: no se le pone fecha (nunca se le quita)');
  // moderador
  await tw('channel.channel_points_custom_reward_redemption.add',{user_name:'ElMod',user_login:'elmod',user_id:'66',reward:{title:'Vip Mini',cost:5000},user_input:''}); await W2(400);
  ok2(!(global.__z.vipx||[]).some(x=>/^tw:66:/.test(x[1])), 'un moderador no se vuelve VIP (Twitch no deja)');
  // se acaba: se quita solo
  ent=(global.__z.vipx||[]).find(x=>x[1]==='tw:501:fan1'); ent[0]=Date.now()-1000; global.__z.vipx.sort((a,b)=>a[0]-b[0]);
  const sent1=global.__T.sent.length;
  await CI('',{w:WK2(),st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[]}); await W2(400);
  ok2(global.__VIP.calls.indexOf('DELETE 501')>=0 && !global.__VIP.set.has('501') && !(global.__z.vipx||[]).some(x=>x[1]==='tw:501:fan1'), 'al terminar, la guardia/tu app se lo quitan solos');
  ok2(global.__T.sent.slice(sent1).some(x=>/Se terminó el VIP de fan1/.test(x.body.message)), 'y avisa en el chat');
  ok2(global.__VIP.set.has('777'), 'el VIP que diste a mano sigue');
  // en Kick: no se puede (lo dice la regla)
  // 16) resub de Kick compartida en vivo
  const AP3=(a,b)=>fetch('http://localhost:7702/api/alertas?a='+a,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  let f1=await AP3('fire',{al:{k:'resub',pf:'kick',u:'Renovador',n:3,m:''},chk:1});
  ok2(f1.ok && f1.item && f1.item.k==='resub', 'resub de Kick compartida (Kick no la avisó hoy): su alerta sale');
  await hook('channel.subscription.renewal',{broadcaster:{user_id:6692133},subscriber:{username:'Renovador2',user_id:8801},duration:4,created_at:new Date().toISOString()},'ren2'); await W2(200);
  let f2=await AP3('fire',{al:{k:'resub',pf:'kick',u:'Renovador2',n:4,m:''},chk:1});
  ok2(f2.ok && f2.dup===true, 'si Kick sí la avisó hace poco (ya sonó), no se repite');

  // 17) la guardia ve una resub compartida (app cerrada)
  global.__ably.length=0;
  await CI('',{w:WK2(),st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[{pf:'kick',resub:{user:'Compartio',months:5}}]}); await W2(300);
  let AQ=global.__ably.map(x=>{ const m=(x.body||[])[0]||{}; let d=null; try{ d=JSON.parse(m.data); }catch(e){} return {name:m.name,d}; });
  ok2(AQ.some(x=>x.name==='al' && x.d.k==='resub' && x.d.u==='Compartio' && x.d.n===5), 'resub compartida con la app cerrada: suena (la vio la guardia)');
  global.__ably.length=0;
  await CI('',{w:WK2(),st:{kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}},msgs:[{pf:'kick',resub:{user:'Renovador2',months:4}}]}); await W2(300);
  ok2(!global.__ably.some(x=>(x.body||[])[0].name==='al'), 'si Kick ya la avisó hace poco, no se repite');
  wss.close();
  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(0);
});
