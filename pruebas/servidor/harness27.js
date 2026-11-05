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
process.env.TELEGRAM_BOT_TOKEN='TGTOKEN'; process.env.TWITCH_CLIENT_ID='twcid'; process.env.TWITCH_CLIENT_SECRET='twsec'; process.env.TELEGRAM_CHAT_ID='-100123';
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







  const redis_del=async k=>{ delete global.__kvref[k]; };
  let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
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
  /* --- avisos de Twitch --- */
  const sec=kv['tw:hsec']; const crypto=require('crypto');
  let n=0;
  async function tw(type, event, mt, rid){ const id=rid||('m'+(++n)), ts=new Date().toISOString(), body=JSON.stringify(mt==='verif'?{challenge:'abc123',subscription:{type}}:{subscription:{type},event});
    const sig='sha256='+crypto.createHmac('sha256',sec).update(id+ts+body).digest('hex');
    const r=await fetch('http://localhost:7702/api/twhook',{method:'POST',body,headers:{'twitch-eventsub-message-id':id,'twitch-eventsub-message-timestamp':ts,'twitch-eventsub-message-signature':sig,'twitch-eventsub-message-type':mt==='verif'?'webhook_callback_verification':'notification','content-type':'application/json'}});
    return {st:r.status, txt:await r.text(), id}; }
  let x=await tw('channel.follow',{},'verif'); ok(x.st===200 && x.txt==='abc123', 'contesta la verificación de Twitch');
  r=await fetch('http://localhost:7702/api/twhook',{method:'POST',body:'{}',headers:{'twitch-eventsub-message-id':'z','twitch-eventsub-message-timestamp':'t','twitch-eventsub-message-signature':'sha256=00','twitch-eventsub-message-type':'notification'}});
  ok(r.status===403, 'rechaza avisos con firma falsa');
  // Kick ya estaba en vivo (Telegram con Kick) y luego Twitch: el mensaje se edita con los dos links
  const t0=Date.now();
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0).toISOString(),title:'Rappi 🛵'},'l1'); await W(150);
  ok(global.__tg.length===1 && /kick\.com\/mariotq/.test(global.__tg[0].body.text) && !/twitch/.test(global.__tg[0].body.text), 'Kick en vivo: aviso con el link de Kick');
  T.stream={viewer_count:23,started_at:new Date(t0).toISOString(),title:'Rappi',game_name:'IRL'};
  await tw('channel.update',{title:'Rappi 🛵',category_id:'509672',category_name:'IRL'});
  await tw('stream.online',{started_at:new Date(t0+5000).toISOString(),type:'live'}); await W(200);
  const ed=global.__tg[1]||{url:'',body:{}};
  ok(/editMessageText/.test(ed.url) && ed.body.message_id===777 && /Kick: https:\/\/kick\.com\/mariotq/.test(ed.body.text) && /Twitch: https:\/\/twitch\.tv\/mariotq/.test(ed.body.text), 'Twitch en vivo: el mismo mensaje ahora trae los dos links: '+JSON.stringify(ed.body.text));
  await tw('stream.online',{started_at:new Date(t0+5000).toISOString()}); await W(100);
  ok(global.__tg.length===2, 'no repite');
  ok(JSON.parse(kv['tw:live']).is_live && JSON.parse(kv['tw:session']).live, 'Twitch: en vivo y su sesión');
  // eventos
  await tw('channel.subscribe',{user_name:'Pepe',tier:'1000',is_gift:false});
  await tw('channel.subscribe',{user_name:'Regalado',tier:'1000',is_gift:true});
  await tw('channel.subscription.message',{user_name:'Ana',tier:'1000',cumulative_months:7,message:{text:'hola Kappa',fragments:[{type:'text',text:'hola '},{type:'emote',text:'Kappa',emote:{id:'25'}}]}});
  await tw('channel.subscription.gift',{user_name:'Rico',total:5,tier:'1000',is_anonymous:false});
  const ch1=await tw('channel.cheer',{user_name:'Bitero',bits:500,message:'cheer500 vamos',is_anonymous:false});
  await tw('channel.raid',{from_broadcaster_user_name:'Amigo',viewers:42});
  await tw('channel.follow',{user_name:'Nuevo'});
  await tw('channel.channel_points_custom_reward_redemption.add',{user_name:'Fan',user_input:'hola',reward:{title:'Hidratarse',cost:500}});
  const dup=await tw('channel.cheer',{user_name:'Bitero',bits:500,message:'cheer500 vamos'},null,ch1.id);   // Twitch repite el mismo aviso
  let ev=await (await fetch('http://localhost:7702/api/events?since=0&tot=1&key='+encodeURIComponent(key))).json();
  const tws=ev.events.filter(e=>e.d && e.d.pf==='tw').map(e=>e.d.kind);
  ok(['sub','resub','gift','bits','raid','follow','reward','meta','live'].every(k=>tws.indexOf(k)>=0) && tws.filter(k=>k==='sub').length===1, 'los avisos de Twitch llegan al feed (sin contar dos veces la sub regalada): '+tws.join(','));
  const rs=ev.events.find(e=>e.d && e.d.kind==='resub' && e.d.pf==='tw');
  ok(rs.d.months===7 && rs.d.message==='hola [twe:25:Kappa]', 'resub con meses y emotes de Twitch');
  ok(ev.tw && ev.tw.totals && ev.tw.totals.subs===7 && ev.tw.totals.bits===500, 'meta de Twitch aparte: 7 subs (1+1+5), 500 bits: '+JSON.stringify(ev.tw&&ev.tw.totals));
  ok(ev.totals && ev.totals.subs===0, 'y la de Kick no se mezcla: '+(ev.totals&&ev.totals.subs));
  ev=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now())).json();
  ok(ev.tw.vw && ev.tw.vw.n===23, 'viewers de Twitch: '+JSON.stringify(ev.tw.vw));
  const sc0=T.streamsCalls; await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now()); await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now());
  ok(T.streamsCalls===sc0, 'no le pregunta a Twitch los viewers en cada revisión (1 por minuto)');
  // encuesta, predicción, hype train, anuncio
  await tw('channel.poll.begin',{id:'p1',title:'¿Tacos o pizza?',choices:[{id:'a',title:'Tacos',votes:0},{id:'b',title:'Pizza',votes:0}],ends_at:new Date(Date.now()+60000).toISOString()});
  await tw('channel.poll.progress',{id:'p1',title:'¿Tacos o pizza?',choices:[{id:'a',title:'Tacos',votes:12},{id:'b',title:'Pizza',votes:5}],ends_at:new Date(Date.now()+60000).toISOString()});
  await tw('channel.hype_train.begin',{id:'h1',level:1,total:300,progress:300,goal:1600,expires_at:new Date(Date.now()+300000).toISOString(),top_contributions:[{user_name:'Rico',type:'subscription',total:2500}]});
  await tw('channel.ad_break.begin',{duration_seconds:90,started_at:new Date().toISOString(),is_automatic:true});
  await tw('channel.prediction.begin',{id:'pr1',title:'¿Llega a tiempo?',outcomes:[{id:'o1',title:'Sí',color:'blue',users:3,channel_points:500},{id:'o2',title:'No',color:'pink',users:1,channel_points:100}],locks_at:new Date(Date.now()+60000).toISOString()});
  ev=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now())).json();
  ok(ev.tw.poll && ev.tw.poll.st==='progress' && ev.tw.poll.choices[0].v===12, 'encuesta en vivo: '+JSON.stringify(ev.tw.poll&&ev.tw.poll.choices));
  ok(ev.tw.hype && ev.tw.hype.level===1 && ev.tw.hype.goal===1600 && ev.tw.hype.top[0].u==='Rico', 'Hype Train: nivel, meta y quién va arriba');
  ok(ev.tw.ad && ev.tw.ad.dur===90, 'anuncio: dura 90 s');
  ok(ev.tw.pred && ev.tw.pred.outcomes.length===2 && ev.tw.pred.outcomes[0].pts===500, 'predicción en vivo');
  await tw('channel.poll.end',{id:'p1',title:'¿Tacos o pizza?',status:'COMPLETED',choices:[{id:'a',title:'Tacos',votes:20},{id:'b',title:'Pizza',votes:9}]});
  ev=await (await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key))).json();
  ok(ev.events.some(e=>e.d && e.d.kind==='poll' && e.d.pf==='tw' && e.d.st==='end'), 'el resultado de la encuesta queda en el feed');
  /* --- chat de Twitch por el servidor --- */
  await tw('channel.chat.message',{message_id:'c1',chatter_user_name:'Viewer1',chatter_user_login:'viewer1',chatter_user_id:'501',color:'#FF0000',badges:[{set_id:'subscriber',id:'12',info:'14'}],message:{text:'hola',fragments:[{type:'text',text:'hola'}]}});
  await tw('channel.chat.message',{message_id:'c2',chatter_user_name:'spambot22',chatter_user_login:'spambot22',chatter_user_id:'502',color:'',badges:[],message:{text:'get hq ai stream upgrades at botkiva com',fragments:[{type:'text',text:'get hq ai stream upgrades at botkiva com'}]}});
  await W(200);
  ok(T.dels.indexOf('c2')>=0 && T.bans.some(b=>b.body.data.user_id==='502' && b.body.data.duration===60), 'antispam en Twitch: borra y da timeout (60 s)');
  r=await (await fetch('http://localhost:7702/api/chat?key='+encodeURIComponent(key)+'&since=0&rec=1')).json();
  const c1=r.msgs.find(m=>m.id==='c1');
  ok(c1 && c1.pf==='tw' && c1.badges[0].type==='subscriber' && c1.badges[0].count===14 && c1.color==='#FF0000', 'el chat de Twitch queda en el respaldo con sus insignias');
  // comando de un mod en Twitch: contesta en Twitch
  await fetch('http://localhost:7702/api/modcmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key,action:'save',cfg:{on:true,users:['elmod'],cmds:[{c:'!hola',steps:[{t:'chat',text:'¡Hola desde el comando!'}]}],del:false}})});
  const s0=T.sent.length;
  await tw('channel.chat.message',{message_id:'c3',chatter_user_name:'ElMod',chatter_user_login:'elmod',chatter_user_id:'503',badges:[{set_id:'moderator',id:'1',info:''}],message:{text:'!hola',fragments:[{type:'text',text:'!hola'}]}});
  await W(200);
  ok(T.sent.length===s0+1 && T.sent[s0].body.message==='¡Hola desde el comando!' && T.sent[s0].body.sender_id==='999', 'comando de un mod en Twitch: contesta en Twitch (con tu bot)');
  await tw('channel.chat.message',{message_id:'c4',chatter_user_name:'ElMod',chatter_user_login:'elmod',chatter_user_id:'503',badges:[{set_id:'moderator',id:'1',info:''}],message:{text:'!momento caída épica',fragments:[{type:'text',text:'!momento caída épica'}]}});
  await W(200);
  ok(T.sent.length===s0+2 && /Momento guardado/.test(T.sent[s0+1].body.message), '!momento desde Twitch también contesta allá');
  /* --- escribir y moderar --- */
  const P=(p,b)=>fetch('http://localhost:7702'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  const kick0=global.__calls.filter(c=>c.u==='chat').length;
  let j=await P('/api/chat',{content:'hola a los dos [emote:123:mariotqLOVE]',pf:'both'});
  ok(j.ok && global.__calls.filter(c=>c.u==='chat').length===kick0+1 && T.sent[T.sent.length-1].body.message==='hola a los dos mariotqLOVE', 'mandar a los dos chats (en Twitch el emote de Kick va como nombre)');
  j=await P('/api/chat',{content:'solo twitch',pf:'tw',as:'me'});
  ok(j.ok && T.sent[T.sent.length-1].body.sender_id==='111' && global.__calls.filter(c=>c.u==='chat').length===kick0+1, 'solo a Twitch, como tú');
  j=await P('/api/tw?a=mod',{action:'timeout',user_id:'501',duration:10,username:'Viewer1'});
  ok(j.ok && T.bans[T.bans.length-1].body.data.duration===600, 'timeout en Twitch: 10 min = 600 s');
  j=await P('/api/tw?a=mod',{action:'delete',message_id:'c1'}); ok(j.ok && T.dels.indexOf('c1')>=0, 'borrar mensaje en Twitch');
  j=await P('/api/tw?a=poll',{op:'create',title:'¿A dónde vamos?',choices:['Centro','Playa',''],duration:90});
  ok(j.ok && T.polls[0].body.choices.length===2 && T.polls[0].body.duration===90, 'crear encuesta');
  j=await P('/api/tw?a=pred',{op:'resolve',id:'pr1',win:'o1'}); ok(j.ok && T.preds[0].body.status==='RESOLVED' && T.preds[0].body.winning_outcome_id==='o1', 'elegir el resultado de la predicción');
  j=await P('/api/tw?a=ads',{op:'get'}); ok(j.ok && j.sched && j.sched.next>Date.now() && j.sched.snooze===2, 'cuándo es el próximo anuncio: '+JSON.stringify(j.sched));
  j=await P('/api/tw?a=ads',{op:'snooze'}); ok(j.ok && j.sched.snooze===1, 'posponer el anuncio');
  j=await P('/api/tw?a=ads',{op:'start',length:60}); ok(j.ok && T.ads.started===60 && JSON.parse(kv['tw:ad']).dur===60, 'lanzar un anuncio de 60 s');
  // título y categoría para los dos
  j=await P('/api/channel',{title:'Nuevo título 🛵',category_id:15,cat_name:'IRL',pf:'both'});
  ok(j.ok && T.chans.title==='Nuevo título 🛵' && T.chans.game_id==='509672' && j.tw && j.tw.category.name==='IRL', 'título y categoría en Kick y Twitch (IRL → IRL): '+JSON.stringify(j.tw));
  j=await (await fetch('http://localhost:7702/api/categories?key='+encodeURIComponent(key)+'&pf=tw&q=irl')).json();
  ok(j.ok && j.data[0].name==='IRL', 'buscar categorías de Twitch');
  // meta de Twitch a mano
  j=await P('/api/goal',{pf:'tw',delta:2});
  ok(j.ok && j.totals.subs===9, 'meta de Twitch +2 → 9');
  j=await P('/api/tw?a=status',{});
  ok(j.ok && j.me.login==='mariotq' && j.bot.login==='tq_bot_irl', 'estado de Twitch para el feed');
  // regla en Twitch: sub → mensaje al chat de Twitch
  await P('/api/rules',{action:'save',cfg:{on:true,feed:true,list:[{id:'r1',ev:'sub',steps:[{t:'chat',text:'¡Gracias {nombre}!'}]}]}});
  const s1=T.sent.length; await tw('channel.subscribe',{user_name:'Lupita',tier:'1000',is_gift:false}); await W(300);
  ok(T.sent.length===s1+1 && T.sent[s1].body.message==='¡Gracias Lupita!', 'regla con sub de Twitch: da las gracias en Twitch');
  // offline de Twitch con Kick en vivo
  await tw('stream.offline',{}); await W(100);
  ev=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now())).json();
  ok(ev.tw.live.is_live===false && ev.live.is_live===true, 'Twitch se cayó y Kick sigue (el feed lo puede avisar)');
  /* ===================== v75 ===================== */
  // reglas por plataforma
  const kc=()=>global.__calls.filter(c=>c.u==='chat').map(c=>c.b.content);
  const tc=()=>T.sent.map(x=>x.body.message);
  await P('/api/rules',{action:'save',cfg:{on:true,feed:true,list:[
    {id:'rany',ev:'sub',steps:[{t:'chat',text:'Ambas {nombre} {plataforma}'}]},
    {id:'rkic',ev:'sub',pf:'kick',steps:[{t:'chat',text:'SoloKick {nombre}'}]},
    {id:'rtwi',ev:'sub',pf:'tw',steps:[{t:'chat',text:'SoloTw {nombre}'}]},
    {id:'rbit',ev:'bits',min:100,steps:[{t:'chat',text:'Bits {nombre} {cantidad}'}]},
    {id:'rct',ev:'cat',pf:'tw',name:'Slots & Casino',steps:[{t:'chat',text:'CasinoTw'}]},
    {id:'rck',ev:'cat',pf:'kick',name:'Slots & Casino',steps:[{t:'chat',text:'CasinoKick'}]},
    {id:'rad',ev:'adstart',steps:[{t:'chat',text:'Anuncio {cantidad}'}]},
    {id:'rhy',ev:'hype',steps:[{t:'chat',text:'Tren {cantidad}'}]},
    {id:'rkis',ev:'kicks',pf:'tw',min:1,steps:[{t:'chat',text:'Kicks {cantidad}'}]},
    {id:'rla',ev:'live',steps:[{t:'chat',text:'LiveAny'}]},
    {id:'rlt',ev:'live',pf:'tw',steps:[{t:'chat',text:'LiveTw'}]}]}});
  let rc=await (await fetch('http://localhost:7702/api/rules?key='+encodeURIComponent(key))).json();
  const byId=id=>rc.cfg.list.find(r=>r.id===id);
  ok(byId('rkis').pf==='kick' && byId('rbit').pf==='tw' && byId('rad').pf==='tw' && !byId('rany').pf && byId('rtwi').pf==='tw', 'se guardan con su plataforma (Kicks siempre Kick, bits/anuncio/Hype siempre Twitch)');
  let k0=kc().length, t0b=tc().length;
  await tw('channel.subscribe',{user_name:'Lupita2',tier:'1000',is_gift:false}); await W(300);
  let tn=tc().slice(t0b), kn=kc().slice(k0);
  ok(tn.indexOf('Ambas Lupita2 Twitch')>=0 && tn.indexOf('SoloTw Lupita2')>=0 && !tn.some(x=>/SoloKick/.test(x)) && !kn.length, 'sub en Twitch: la de las dos y la de «Solo Twitch» (en Twitch), no la de Kick: '+tn.join(' | '));
  k0=kc().length; t0b=tc().length;
  await hook('channel.subscription.new',{broadcaster:{user_id:6692133,username:'mariotq'},subscriber:{username:'pepito'},duration:1,created_at:new Date().toISOString()},'ksub75'); await W(300);
  tn=tc().slice(t0b); kn=kc().slice(k0);
  ok(kn.indexOf('Ambas pepito Kick')>=0 && kn.indexOf('SoloKick pepito')>=0 && !kn.some(x=>/SoloTw/.test(x)) && !tn.length, 'sub en Kick: la de las dos y la de «Solo Kick» (en Kick): '+kn.join(' | '));
  t0b=tc().length;
  await tw('channel.cheer',{user_name:'Poquito',bits:50,message:'cheer50'}); await tw('channel.cheer',{user_name:'Bitero2',bits:250,message:'cheer250 vamos'}); await W(300);
  tn=tc().slice(t0b);
  ok(tn.length===1 && tn[0]==='Bits Bitero2 250', 'bits: solo la de 100 o más: '+tn.join(' | '));
  t0b=tc().length; k0=kc().length;
  await tw('channel.update',{title:'Casino 🎰',category_id:'498566',category_name:'Slots & Casino'}); await W(300);
  tn=tc().slice(t0b); kn=kc().slice(k0);
  ok(tn.indexOf('CasinoTw')>=0 && !tn.some(x=>x==='CasinoKick') && !kn.length, 'cambiar a Slots en Twitch: solo la regla de Twitch: '+tn.join(' | '));
  t0b=tc().length;
  await tw('channel.ad_break.begin',{duration_seconds:90,started_at:new Date().toISOString(),is_automatic:true});
  await tw('channel.hype_train.begin',{id:'h75',level:1,total:100,progress:100,goal:1600,expires_at:new Date(Date.now()+300000).toISOString(),top_contributions:[]}); await W(300);
  tn=tc().slice(t0b);
  ok(tn.indexOf('Anuncio 90')>=0 && tn.indexOf('Tren 1')>=0, 'anuncio y Hype Train despiertan sus reglas: '+tn.join(' | '));
  // Twitch arranca (sesión nueva) con Kick al aire: solo «Solo Twitch»
  kv['tw:session']=JSON.stringify({start:Date.now()-7200e3,lastEnd:Date.now()-3600e3,live:false});
  t0b=tc().length;
  await tw('stream.online',{started_at:new Date().toISOString(),type:'live'}); await W(300);
  tn=tc().slice(t0b);
  ok(tn.indexOf('LiveTw')>=0 && tn.indexOf('LiveAny')<0, 'Twitch empieza con Kick al aire: la de «Solo Twitch» sí, la de las dos no (ya contó con Kick): '+tn.join(' | '));
  // feed: la regla de Twitch con su pf
  ev=await (await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key))).json();
  ok(ev.events.some(e=>e.d && e.d.kind==='rule' && e.d.pf==='tw' && e.d.rid==='rtwi'), 'en el feed la regla dice que fue en Twitch');
  // insignias de Twitch
  let b1=await (await fetch('http://localhost:7702/api/tw?a=badges&bid=111&key='+encodeURIComponent(key))).json();
  ok(b1.ok && b1.map['moderator/1'][0]==='m2' && b1.map['subscriber/12'][0]==='cs12' && b1.map['subscriber/0'][0]==='cs0', 'insignias de Twitch: globales y las de tu canal (las de tu canal ganan)');
  const bc=T.badgeCalls;
  b1=await (await fetch('http://localhost:7702/api/tw?a=badges&bid=111&key='+encodeURIComponent(key))).json();
  ok(T.badgeCalls===bc && b1.map['subscriber/12'], 'la segunda vez salen de la base (no le pregunta a Twitch)');
  b1=await (await fetch('http://localhost:7702/api/tw?a=badges&bid=111')).json();
  ok(!b1.ok, 'sin clave no');
  // GIF y las insignias tal cual en el respaldo del chat
  await tw('channel.chat.message',{message_id:'g1',chatter_user_name:'Gifero',chatter_user_login:'gifero',chatter_user_id:'601',color:'',badges:[{set_id:'subscriber',id:'12',info:'14'},{set_id:'premium',id:'1',info:''}],
    message:{text:'[YAY GIF] jaja',fragments:[{type:'gif',text:'[YAY GIF]',gif:{gif_id:'abc',url:'https://media4.giphy.com/media/abc/giphy.gif?cid=1&ct=g'}},{type:'text',text:' jaja'}]}});
  await tw('channel.chat.message',{message_id:'g2',chatter_user_name:'Malo',chatter_user_login:'malo',chatter_user_id:'602',badges:[],
    message:{text:'[x]',fragments:[{type:'gif',text:'[x]',gif:{gif_id:'z',url:'https://evil.example.com/a.gif'}}]}});
  await W(200);
  r=await (await fetch('http://localhost:7702/api/chat?key='+encodeURIComponent(key)+'&since=0&rec=1')).json();
  const g1=r.msgs.find(m=>m.id==='g1'), g2=r.msgs.find(m=>m.id==='g2');
  ok(g1 && g1.t==='[twg:https://media4.giphy.com/media/abc/giphy.gif?cid=1&ct=g] jaja' && g1.tb.join(',')==='subscriber/12,premium/1', 'GIF de Twitch y sus insignias tal cual: '+(g1&&g1.t)+' · '+(g1&&g1.tb));
  ok(g2 && !/twg/.test(g2.t), 'un GIF que no es de GIPHY no se pinta');
  // clips de Twitch
  let cl=await (await fetch('http://localhost:7702/api/tw?a=clips&from='+(Date.now()-864e5)+'&key='+encodeURIComponent(key))).json();
  ok(!cl.ok && !T.clipsQ, 'v76: ya no se piden los clips de Twitch (en Twitch se ven por fecha)');
  // cuándo es el próximo anuncio, en la revisión (y no le pregunta a Twitch cada vez)
  await redis_del('tw:adsch');
  const adc=()=>T.calls.filter(c=>c.path==='/channels/ads').length, a0=adc();
  ev=await (await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now())).json();
  await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+Date.now());
  ok(ev.tw.adsch && ev.tw.adsch.next>Date.now() && adc()===a0+1, 'en vivo: cuándo es el próximo anuncio (1 pregunta y luego guardado): '+JSON.stringify(ev.tw.adsch));
  console.log(fails?('\n'+fails+' FALLAS'):'\nTODO BIEN'); process.exit(fails?1:0);
});
