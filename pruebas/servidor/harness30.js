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


{ const f0=global.fetch; const X=global.__X={kick:[],tw:[],rewardsKick:[{id:'01K1',title:'Vip Mini',cost:5000,is_enabled:true,is_paused:false,is_user_input_required:false},{id:'01K2',title:'Timeout a alguien',cost:3000,is_enabled:true,is_user_input_required:true},{id:'01K3',title:'Vieja',cost:10,is_enabled:false}],kickRwFail:0};
  global.fetch=async (url,opts={})=>{ url=String(url); const m=(opts.method||'GET').toUpperCase();
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    if (url.startsWith('https://api.kick.com/public/v1/channels/rewards')){ X.kick.push(m+' '+url.split('/v1')[1]+' '+(opts.body||''));
      if (url.indexOf('redemptions/reject')>0) return J({data:{failed:[]}});
      if (X.kickRwFail) return J({message:'Unauthorized'},403);
      return J({data:X.rewardsKick}); }
    if (url.startsWith('https://api.kick.com/public/v1/channels?slug=')){ X.kick.push('slug '+url.split('slug=')[1]); return J({data:[{broadcaster_user_id: url.indexOf('nadie')>0?null:9090, slug:url.split('slug=')[1]}]}); }
    if (url.startsWith('https://api.twitch.tv/helix/channel_points/custom_rewards')){ X.tw.push(m+' '+url.split('/helix')[1]+' '+(opts.body||''));
      if (m==='PATCH') return J({message:'The ID in the Client-Id header must match the client ID used to create the custom reward.'},403);
      return J({data:[{id:'tw1',title:'Vip Rey',cost:20000,is_enabled:true,is_paused:false},{id:'tw2',title:'Solo emotes',cost:2000,is_enabled:true}]}); }
    if (url.startsWith('https://api.twitch.tv/helix/chat/settings')){ X.tw.push(m+' /chat/settings '+(opts.body||'')); return J({data:[{}]}); }
    if (url.startsWith('https://api.twitch.tv/helix/users?login=')){ const l=url.split('login=')[1]; X.tw.push('user '+l); return J({data:l==='nadie'?[]:[{id:'4242',login:l}]}); }
    return f0(url,opts); }; }
const http=require('http'), crypto=require('crypto');
// --- Upstash falso ---
const kv={}, z={}, lists={}, sets={}; global.__z=z; global.__kvref=kv;
function zr(key){ return z[key]||(z[key]=[]); }
const upstash=http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{
  const cmd=JSON.parse(b), op=cmd[0].toUpperCase(); let r=null; (global.__cmds=global.__cmds||[]).push(cmd);
  if(op==='PING') r='PONG';
  else if(op==='SET'){ const nx=cmd.includes('NX'), g=cmd.includes('GET'), old=kv[cmd[1]]===undefined?null:kv[cmd[1]]; if(nx&&kv[cmd[1]]!==undefined) r=null; else {kv[cmd[1]]=String(cmd[2]); r=g?old:'OK';} }
  else if(op==='GET') r=kv[cmd[1]]===undefined?null:kv[cmd[1]];
  else if(op==='MSET'){ for(let k=1;k+1<cmd.length;k+=2) kv[cmd[k]]=String(cmd[k+1]); r='OK'; }
  else if(op==='MGET') r=cmd.slice(1).map(k=>kv[k]===undefined?null:kv[k]);
  else if(op==='DEL'){ r=kv[cmd[1]]!==undefined?1:0; delete kv[cmd[1]]; }
  else if(op==='EXPIRE') r=1;
  else if(op==='RPUSH'){ const L=(lists[cmd[1]]=lists[cmd[1]]||[]); cmd.slice(2).forEach(x=>L.push(x)); r=L.length; }
  else if(op==='LPOP'){ const L=lists[cmd[1]]||[]; if (cmd[2]!=null){ const n=Number(cmd[2]); r=L.length?L.splice(0,n):null; } else r=L.length?L.shift():null; }
  else if(op==='ZREVRANGE'){ const A=zr(cmd[1]).slice().reverse(); r=A.slice(Number(cmd[2]),Number(cmd[3])+1).map(x=>x[1]); }
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
  else if(op==='LTRIM'){ const L=lists[cmd[1]]||[], n=L.length; let a=Number(cmd[2]), e=Number(cmd[3]); if(a<0) a=Math.max(0,n+a); if(e<0) e=n+e; lists[cmd[1]]=L.slice(a,e+1); r='OK'; }
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

  r=await CI('link',{key}); const link=r.link, WK=new URL(link).searchParams.get('w');
  const kmsg=(id,u,t,badges,uid)=>({pf:'kick',p:{message_id:id,created_at:new Date().toISOString(),content:t,sender:{username:u,user_id:uid||100,identity:{username_color:'#fff',badges:badges||[]}}}});

  const RS=async cfg=>(await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'save',cfg})})).json();
  const X=global.__X;
  const sentK=()=>global.__calls.filter(c=>c.u==='chat' && c.m==='POST').map(c=>c.b.content);
  const sentT=()=>global.__T.sent.map(x=>x.body.message);
  // la guardia ya «lleva rato» y con Streamer.bot conectado
  const ST={kick:{up:true,upFor:900000},tw:{up:true,upFor:900000},sb:{up:true}};
  r=await CI('',{w:WK,st:ST,msgs:[]});
  ok2(r.ok && !r.sb, 'sin trabajos: no manda nada para Streamer.bot');

  // A) 🎯 lista de recompensas de Kick y de Twitch
  r=await (await fetch('http://localhost:7702/api/rules?a=rewards')).json(); ok2(r.ok===false, 'la lista de recompensas pide tu clave');
  r=await (await fetch('http://localhost:7702/api/rules?a=rewards&key='+encodeURIComponent(key))).json();
  ok2(r.ok && r.list.filter(x=>x.pf==='kick').length===3 && r.list.filter(x=>x.pf==='tw').length===2 && r.list[0].pf==='kick', 'tus recompensas de Kick y de Twitch, cada una con su plataforma: '+r.list.map(x=>x.pf+':'+x.t).join(', '));
  ok2(r.list.find(x=>x.t==='Vieja').on===false && r.list.find(x=>x.t==='Timeout a alguien').in===true, 'sabe cuáles están apagadas y cuáles piden texto');
  X.kickRwFail=1; r=await (await fetch('http://localhost:7702/api/rules?a=rewards&key='+encodeURIComponent(key))).json(); X.kickRwFail=0;
  ok2(r.ok && /vuelve a conectar Kick/.test(r.err.kick||'') && r.list.length===2, 'sin el permiso nuevo de Kick: lo dice y de todos modos salen las de Twitch');

  // B) 👑 VIP en Kick (con Streamer.bot) y su fecha
  await RS({on:true,feed:true,list:[{id:'kvip',on:true,ev:'reward',name:'Vip Mini',pf:'kick',steps:[{t:'vip',d:7},{t:'chat',text:'👑 ¡{nombre} ahora es VIP por 7 días!'}]}]});
  let r0=await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Pepe',reward:'Vip Mini',input:'',rid:'01RED1'}}]}); await W2(300);
  const SBJ=x=>((x&&x.sb)||[]);
  let ent=(global.__z.vipx||[]).find(x=>x[1]==='kick:pepe');
  ok2(ent && Math.abs(ent[0]-(Date.now()+7*864e5))<60000, 'canjean «Vip Mini» en Kick: queda apuntado 7 días');
  ok2(sentK().some(t=>/Pepe ahora es VIP/.test(t)), 'y avisa en el chat de Kick');
  r=await CI('',{w:WK,st:ST,msgs:[]}); let jj=SBJ(r0).concat(SBJ(r));
  ok2(jj.length===1 && jj[0].a==='KF VIP Kick dar' && jj[0].args.user==='Pepe', 'la guardia recibe el trabajo para Streamer.bot: '+JSON.stringify(jj));
  r=await CI('',{w:WK,st:ST,msgs:[]}); ok2(!r.sb, 'y no se lo vuelve a dar');
  // sin Streamer.bot: queda en fila y lo dice
  r=await CI('',{w:WK,st:Object.assign({},ST,{sb:{up:false}}),msgs:[{pf:'kick',reward:{user:'Luis',reward:'Vip Mini',input:''}}]}); await W2(300);
  const evs=(global.__z.ev||[]).map(x=>JSON.parse(x[1]).d).filter(d=>d.kind==='rule');
  ok2(evs.some(d=>!d.ok && /Quedó en fila/.test(d.error)), 'si Streamer.bot no está conectado, tu feed lo dice (y queda en fila)');
  ok2(!r.sb, 'mientras no esté conectado, la guardia no recibe trabajos');
  r=await CI('',{w:WK,st:ST,msgs:[]}); ok2(r.sb && r.sb.some(j=>j.args.user==='Luis'), 'en cuanto se conecta, le llega el VIP pendiente');
  // se acaba
  ent=(global.__z.vipx||[]).find(x=>x[1]==='kick:pepe'); ent[0]=Date.now()-1000; global.__z.vipx.sort((a,b)=>a[0]-b[0]);
  r0=await CI('',{w:WK,st:ST,msgs:[]}); await W2(300); r=await CI('',{w:WK,st:ST,msgs:[]}); r={sb:SBJ(r0).concat(SBJ(r))};
  ok2(r.sb && r.sb.some(j=>j.a==='KF VIP Kick quitar' && j.args.user==='pepe') && !(global.__z.vipx||[]).some(x=>x[1]==='kick:pepe'), 'al terminar, Streamer.bot se lo quita');
  ok2(sentK().some(t=>/Se terminó el VIP de pepe/.test(t)), 'y avisa en el chat de Kick');
  // lo que falló en Streamer.bot sale en el feed
  await CI('',{w:WK,st:ST,msgs:[],sbr:[{id:'j1',a:'KF VIP Kick dar',user:'Pepe',ok:false,e:'Action not found'}]}); await W2(100);
  ok2((global.__z.ev||[]).map(x=>JSON.parse(x[1]).d).some(d=>d.kind==='sb' && /not found/.test(d.error) && d.act==='KF VIP Kick dar'), 'si Streamer.bot no pudo, sale en tu feed');

  // C) ⏱ timeout con contra ataque (Kick)
  await RS({on:true,feed:true,list:[{id:'kto',on:true,ev:'reward',name:'Timeout a alguien',pf:'kick',steps:[{t:'to',m:15,w:2,p:'karen_nares, chinchillas03'}]},{id:'kca',on:true,ev:'reward',name:'Contra Ataque',pf:'kick',steps:[{t:'ca'}]}]});
  let rr=await (await fetch('http://localhost:7702/api/rules?key='+encodeURIComponent(key))).json();
  ok2(rr.cfg.list[0].steps[0].m===15 && rr.cfg.list[0].steps[0].w===2 && /karen_nares/.test(rr.cfg.list[0].steps[0].p), 'la regla guarda minutos, segundos para contraatacar y protegidos');
  // la víctima escribió en el chat (de ahí sale su id)
  await CI('',{w:WK,st:ST,msgs:[kmsg('vk1','Victima','hola',[],3131)]});
  let b0=global.__calls.filter(c=>c.u==='bans').length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Atacante',reward:'Timeout a alguien',input:'dale a @Victima jaja'}}]}); await W2(300);
  ok2(sentK().some(t=>/Atacante le mandó 15 min de timeout a victima.*2 s para canjear «Contra Ataque»/.test(t)), 'avisa del ataque y da tiempo para contraatacar');
  ok2(global.__calls.filter(c=>c.u==='bans').length===b0, 'todavía no lo silencia');
  await W2(2600);
  let bans=global.__calls.filter(c=>c.u==='bans').slice(b0);
  ok2(bans.length===1 && bans[0].b.user_id===3131 && bans[0].b.duration===15, 'nadie contraatacó: la víctima se come 15 min (con su id del chat)');
  ok2(sentK().some(t=>/Muy lento! victima/.test(t)), 'y lo dice en el chat');
  // ahora sí contraataca
  b0=global.__calls.filter(c=>c.u==='bans').length;
  await CI('',{w:WK,st:ST,msgs:[kmsg('vk2','Atacante','jaja',[],5151)]});
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Atacante',reward:'Timeout a alguien',input:'Victima'}}]}); await W2(300);
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Victima',reward:'Contra Ataque',input:''}}]}); await W2(300);
  bans=global.__calls.filter(c=>c.u==='bans').slice(b0);
  ok2(bans.length===1 && bans[0].b.user_id===5151, 'contraataque a tiempo: el timeout se lo come el atacante');
  ok2(sentK().some(t=>/CONTRA ATAQUE! Victima esquivó el golpe y se lo regresó a Atacante/.test(t)), 'y lo festeja en el chat');
  await W2(2500);
  ok2(global.__calls.filter(c=>c.u==='bans').slice(b0).length===1, 'y a la víctima ya no le cae nada');
  // contraataque sin ataque: devuelve los puntos
  const kr0=X.kick.length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Nadie2',reward:'Contra Ataque',input:'',rid:'01REDX'}}]}); await W2(300);
  ok2(X.kick.slice(kr0).some(x=>/redemptions\/reject.*01REDX/.test(x)) && sentK().some(t=>/Nadie2 no tienes ningún ataque en camino 🤷 Te devolví tus puntos/.test(t)), 'contraataque sin ataque: le devuelve sus puntos y le explica');
  // protegido y sin nombre
  b0=global.__calls.filter(c=>c.u==='bans').length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll',reward:'Timeout a alguien',input:'@Karen_Nares'}}]}); await W2(200);
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll2',reward:'Timeout a alguien',input:'dale porfa'}}]}); await W2(200);
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll3',reward:'Timeout a alguien',input:'@mariotq'}}]}); await W2(2600);
  ok2(global.__calls.filter(c=>c.u==='bans').length===b0, 'a los protegidos (y a ti) no se les silencia');
  ok2(sentK().some(t=>/karen_nares está protegido/.test(t)) && sentK().some(t=>/Troll2 no escribiste a quién/.test(t)), 'y lo explica en el chat');
  // alguien que no estaba en el chat: se busca en Kick
  b0=global.__calls.filter(c=>c.u==='bans').length;
  await RS({on:true,feed:true,list:[{id:'kto2',on:true,ev:'reward',name:'Timeout a alguien',pf:'kick',steps:[{t:'to',m:5,w:0}]}]});
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Atacante',reward:'Timeout a alguien',input:'@nuevo_user'}}]}); await W2(300);
  bans=global.__calls.filter(c=>c.u==='bans').slice(b0);
  ok2(X.kick.some(x=>x==='slug nuevo-user') && bans.length===1 && bans[0].b.user_id===9090 && bans[0].b.duration===5, 'sin contra ataque: al momento, y si no estaba en el chat lo busca en Kick');

  // D) Twitch: timeout, solo emotes y destacar
  await RS({on:true,feed:true,list:[
    {id:'tto',on:true,ev:'reward',name:'Timeout',pf:'tw',steps:[{t:'to',m:10,w:0}]},
    {id:'temo',on:true,ev:'reward',name:'Solo emotes',pf:'tw',steps:[{t:'emo',sec:15}]},
    {id:'thl',on:true,ev:'reward',name:'Destaca mi mensaje',pf:'tw',steps:[{t:'hl'}]},
    {id:'kemo',on:true,ev:'reward',name:'Solo emotes',pf:'kick',steps:[{t:'emo',sec:15}]}]});
  let tb0=global.__T.bans.length;
  await tw('channel.channel_points_custom_reward_redemption.add',{id:'red9',user_name:'FanT',user_login:'fant',user_id:'700',reward:{id:'rw9',title:'Timeout',cost:100},user_input:'@OtroFan'}); await W2(400);
  ok2(global.__T.bans.length===tb0+1 && global.__T.bans[tb0].body.data.user_id==='4242' && global.__T.bans[tb0].body.data.duration===600, 'Twitch: timeout de 10 min a quien escribieron (lo busca en Twitch)');
  await tw('channel.channel_points_custom_reward_redemption.add',{id:'red10',user_name:'FanT',user_login:'fant',user_id:'700',reward:{id:'rw10',title:'Solo emotes',cost:100},user_input:''}); await W2(400);
  ok2(X.tw.some(x=>/PATCH \/chat\/settings \{"emote_mode":true\}/.test(x)) && sentT().some(t=>/FanT activó el modo SOLO EMOTES por 15 s/.test(t)), 'Twitch: solo emotes se prende y lo avisa');
  await tw('channel.channel_points_custom_reward_redemption.add',{id:'red11',user_name:'FanT',user_login:'fant',user_id:'700',reward:{id:'rw11',title:'Destaca mi mensaje',cost:100},user_input:'saludos a todos visiten www.spam.com !ban'}); await W2(400);
  ok2(sentT().some(t=>/^🔴 DESTACADO FanT: saludos a todos visiten !ban$/.test(t.trim()) || /^🔴 DESTACADO FanT: saludos a todos visiten/.test(t)) && !sentT().some(t=>/spam\.com/.test(t)), 'destaca el mensaje sin links: '+sentT().filter(t=>/DESTACADO/.test(t)).join(' | '));
  // Kick solo emotes (Streamer.bot)
  r0=await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'FanK',reward:'Solo emotes',input:''}}]}); await W2(300);
  r=await CI('',{w:WK,st:ST,msgs:[]}); r={sb:SBJ(r0).concat(SBJ(r))};
  ok2(r.sb && r.sb.some(j=>j.a==='KF Solo emotes Kick' && j.args.enable===true), 'Kick: solo emotes se lo pide a Streamer.bot');
  await W2(15600);
  ok2(X.tw.some(x=>/PATCH \/chat\/settings \{"emote_mode":false\}/.test(x)) && sentT().some(t=>/Se acabó el modo emotes/.test(t)), 'a los 15 s se apaga en Twitch y lo avisa');
  r=await CI('',{w:WK,st:ST,msgs:[]});
  ok2(r.sb && r.sb.some(j=>j.a==='KF Solo emotes Kick' && j.args.enable===false) && sentK().some(t=>/Se acabó el modo emotes/.test(t)), 'y en Kick también (Streamer.bot)');

  // E) 🎬 OBS cambia de escena → mensaje en los dos chats
  await RS({on:true,feed:true,list:[{id:'sc1',on:true,ev:'scene',name:'Offline',steps:[{t:'chat',text:'Sin señal por el momento, aguanten! ({escena})'}]}]});
  rr=await (await fetch('http://localhost:7702/api/rules?key='+encodeURIComponent(key))).json();
  ok2(rr.cfg.list[0].ev==='scene' && rr.cfg.list[0].name==='Offline', 'la regla de escena se guarda');
  global.__kvref['session']=JSON.stringify({live:true}); global.__kvref['tw:session']=JSON.stringify({live:true});
  let k1=sentK().length, t1=sentT().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:true},msgs:[]}); await W2(200);
  await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:true},msgs:[]}); await W2(400);
  ok2(sentK().slice(k1).some(t=>/Sin señal por el momento, aguanten! \(Offline\)/.test(t)) && sentT().slice(t1).some(t=>/Sin señal/.test(t)), 'NOALBS cambia a «Offline»: el mensaje sale en Kick y en Twitch');
  k1=sentK().length;
  await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:true},msgs:[]}); await W2(300);
  ok2(sentK().length===k1, 'la misma escena otra vez: no se repite');
  global.__kvref['tw:session']=JSON.stringify({live:false}); k1=sentK().length; t1=sentT().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:true},msgs:[]}); await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:true},msgs:[]}); await W2(400);
  ok2(sentK().length===k1+1 && sentT().length===t1, 'si solo estás en vivo en Kick, solo sale en Kick');
  global.__kvref['session']=JSON.stringify({live:false}); k1=sentK().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:true},msgs:[]}); await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:true},msgs:[]}); await W2(400);
  ok2(sentK().length===k1, 'sin estar en vivo no manda nada');

  // F) 📋 plan del día
  k1=sentK().length;
  await CI('',{w:WK,st:ST,msgs:[kmsg('pl1','Fan','cuál es el plan de hoy?')]}); await W2(200);
  ok2(sentK().slice(k1).some(t=>/Todavía no hay plan/.test(t))===false, 'sin plan, a «plan» suelto no contesta nada');
  await CI('',{w:WK,st:ST,msgs:[kmsg('pl2','ModX','!plan Ir al centro y luego tacos',[{type:'moderator'}])]}); await W2(200);
  ok2(JSON.parse(global.__kvref.plan).t==='Ir al centro y luego tacos' && sentK().slice(k1).some(t=>/Ya quedó el plan actualizado/.test(t)), 'un mod pone el plan con «!plan texto»');
  k1=sentK().length;
  await CI('',{w:WK,st:ST,msgs:[kmsg('pl3','Fan2','!plan Hackeado')]}); await W2(200);
  ok2(JSON.parse(global.__kvref.plan).t==='Ir al centro y luego tacos' && sentK().slice(k1).some(t=>/El plan para hoy es: Ir al centro y luego tacos/.test(t)), 'alguien que no es mod no lo cambia: solo se lo dice');
  k1=sentK().length; delete global.__kvref['plancd:k'];
  await CI('',{w:WK,st:ST,msgs:[kmsg('pl4','Fan3','oye y el plan?'),kmsg('pl5','Fan4','plan plan plan')]}); await W2(200);
  ok2(sentK().slice(k1).filter(t=>/El plan para hoy es/.test(t)).length===1, 'escribir «plan» lo contesta una vez (no a cada rato)');
  k1=sentK().length;
  await CI('',{w:WK,st:ST,msgs:[kmsg('pl6','Fan5','planeta tierra')]}); await W2(200);
  ok2(sentK().length===k1, '«planeta» no cuenta');
  r=await (await fetch('http://localhost:7702/api/modcmd',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'plan',text:'Desde la app'})})).json();
  ok2(r.ok && r.plan.t==='Desde la app' && JSON.parse(global.__kvref.plan).t==='Desde la app', 'el plan también se cambia desde la app');
  // G) 🩺 revisión: Streamer.bot
  global.__kvref['chatw:hb']=JSON.stringify({at:Date.now(),kick:{up:true},tw:{up:true},sb:{up:true,on:true}});
  r=await (await fetch('http://localhost:7702/api/health?key='+encodeURIComponent(key))).json();
  const sbc=(r.checks||[]).find(c=>c.k==='sb');
  ok2(sbc && sbc.ok===true && /Streamer.bot conectado/.test(sbc.t), 'en «Revisar todo» sale Streamer.bot: '+(sbc&&sbc.t));
  // H) el ▶ Probar de una regla de timeout no silencia a nadie
  b0=global.__calls.filter(c=>c.u==='bans').length;
  r=await (await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'test',rule:{ev:'reward',name:'Timeout',pf:'kick',steps:[{t:'to',m:15,w:25},{t:'vip',d:7},{t:'sb',a:'Mi acción'}]}})})).json();
  ok2(r.ok && r.chats.length===3 && global.__calls.filter(c=>c.u==='bans').length===b0, '▶ Probar dice qué haría sin silenciar a nadie: '+r.chats.join(' | '));
  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(0);
});
