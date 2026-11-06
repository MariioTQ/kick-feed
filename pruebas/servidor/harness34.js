const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v87 · 🎬 regla de escena (a qué chat va), 👑 VIP temporales, 🛡 protegidos del timeout y 🔊 TTS por recompensa
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
// v84 · 🎯 recompensas y canjes (Kick oficial y Twitch Helix) simulados
{ const f0=global.fetch; const KR=global.__KR={list:[{id:'01KOLD1',title:'Vip Mini',cost:5000,description:'7 días',background_color:'#FF0000',is_enabled:true,is_paused:false,is_user_input_required:false,should_redemptions_skip_request_queue:true},{id:'01KOLD2',title:'Timeout a alguien',cost:3000,is_enabled:true,is_user_input_required:true}],owned:new Set(),calls:[],n:0};
  const TR=global.__TR={list:[{id:'twold',title:'Vip Rey',cost:20000,prompt:'',is_enabled:true,is_paused:false},{id:'twmio',title:'Hidratarse',cost:500,is_enabled:true,is_paused:false}],mine:new Set(['twmio']),calls:[],n:0};
  global.fetch=async (url,opts={})=>{ url=String(url); const m=(opts.method||'GET').toUpperCase(); let body=null; if (/channel_points\/custom_rewards|channels\/rewards/.test(url)) try{ body=opts.body?JSON.parse(opts.body):null; }catch(e){}
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    if (url.startsWith('https://api.kick.com/public/v1/channels/rewards')){ const path=url.split('/channels/rewards')[1]; KR.calls.push(m+' '+path+' '+(opts.body||''));
      if (/^\/redemptions\/(accept|reject)/.test(path)){ const failed=(body.ids||[]).filter(i=>!/^own/.test(i)).map(i=>({id:i,reason:/^gone/.test(i)?'NOT_PENDING':'NOT_OWNED'})); return J({data:failed,message:'OK'}); }
      if (m==='GET' && !path) return J({data:KR.list});
      if (m==='POST' && !path){ const o=Object.assign({id:'01KNEW'+(++KR.n),is_paused:false,is_enabled:true},body); KR.list.push(o); KR.owned.add(o.id); return J({data:o}); }
      const id=decodeURIComponent(path.slice(1)), o=KR.list.find(x=>x.id===id);
      if (!o) return J({message:'Not found'},404);
      if (!KR.owned.has(id)) return J({message:'Forbidden'},403);
      if (m==='PATCH'){ Object.assign(o,body); return J({data:o}); }
      if (m==='DELETE'){ KR.list=KR.list.filter(x=>x.id!==id); return new Response(null,{status:204}); } }
    if (url.startsWith('https://api.twitch.tv/helix/channel_points/custom_rewards')){ const u=new URL(url); TR.calls.push(m+' '+u.pathname.replace('/helix/channel_points/custom_rewards','')+u.search+' '+(opts.body||''));
      if (/\/redemptions$/.test(u.pathname)){ const rw=u.searchParams.get('reward_id'); if (!TR.mine.has(rw)) return J({message:'The ID in the Client-Id header must match the client ID used to create the custom reward.'},403); return J({data:[{id:u.searchParams.get('id'),status:body.status}]}); }
      if (m==='GET') return J({data:u.searchParams.get('only_manageable_rewards')==='true'?TR.list.filter(x=>TR.mine.has(x.id)):TR.list});
      if (m==='POST'){ if (TR.list.some(x=>x.title.toLowerCase()===String(body.title).toLowerCase())) return J({message:'CREATE_CUSTOM_REWARD_DUPLICATE_REWARD'},400);
        const o=Object.assign({id:'twnew'+(++TR.n),is_paused:false,is_enabled:true},body); TR.list.push(o); TR.mine.add(o.id); return J({data:[o]}); }
      const id=u.searchParams.get('id'), o=TR.list.find(x=>x.id===id);
      if (!o) return J({message:'Not found'},404);
      if (!TR.mine.has(id)) return J({message:'The ID in the Client-Id header must match the client ID used to create the custom reward.'},403);
      if (m==='PATCH'){ Object.assign(o,body); return J({data:[o]}); }
      if (m==='DELETE'){ TR.list=TR.list.filter(x=>x.id!==id); return new Response(null,{status:204}); } }
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
  const KR=global.__KR, TR=global.__TR;
  const RW=async (a,b)=>(await fetch('http://localhost:7702/api/rewards',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key,a},b||{}))})).json();
  const RS=async cfg=>(await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'save',cfg})})).json();
  const sentK=()=>global.__calls.filter(c=>c.u==='chat' && c.m==='POST').map(c=>c.b.content);
  const evs=()=>(global.__z.ev||[]).map(x=>JSON.parse(x[1]));
  const ably=n=>global.__ably.filter(x=>x.body && x.body[0] && x.body[0].name===n);
  const sentT=()=>global.__T.sent.map(x=>x.body.message);
  const CI=(a,b)=>fetch('http://localhost:7702/api/chatin'+(a?'?a='+a:''),{method:'POST',headers:{'Content-Type':'text/plain','x-forwarded-host':'kick-feed-mariotq.vercel.app'},body:JSON.stringify(b||{})}).then(r=>r.json());
  const lnk=await CI('link',{key}); const WK=new URL(lnk.link).searchParams.get('w');
  const ST={kick:{up:true,upFor:900000},tw:{up:true,upFor:900000}};
  const kmsg=(id,u,t,badges,uid)=>({pf:'kick',p:{message_id:id,created_at:new Date().toISOString(),content:t,sender:{username:u,user_id:uid||100,identity:{username_color:'#fff',badges:badges||[]}}}});
  const ruleEvs=()=>evs().filter(e=>e.d.kind==='rule');

  // A) 🎬 regla de escena
  r=await RS({on:true,feed:true,list:[{id:'sc1',on:true,ev:'scene',name:'Offline',to:'both',steps:[{t:'chat',text:'Sin señal, aguanten 🙏'}]}]});
  ok2(r.cfg.list[0].to==='both' && !r.cfg.list[0].pf, 'la regla de escena guarda a qué chat va el mensaje (los dos)');
  r=await RS({on:true,feed:true,list:[{id:'sc1',on:true,ev:'scene',name:'Offline',to:'otro',steps:[{t:'chat',text:'x'}]}]});
  ok2(!r.cfg.list[0].to, 'un valor raro no se guarda');
  await RS({on:true,feed:true,list:[{id:'sc1',on:true,ev:'scene',name:'Offline',to:'both',steps:[{t:'chat',text:'Sin señal, aguanten 🙏'}]}]});
  kv['session']=JSON.stringify({live:false}); kv['tw:session']=JSON.stringify({live:false});
  let k0=sentK().length, t0=sentT().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:true},msgs:[]}); await W2(200);
  await CI('',{w:WK,st:ST,obs:{scene:'OFFLINE 📵',on:true},msgs:[]}); await W2(400);
  ok2(sentK().slice(k0).some(t=>/Sin señal, aguanten/.test(t)) && sentT().slice(t0).some(t=>/Sin señal, aguanten/.test(t)),
      'OBS transmitiendo (aunque Kick no haya avisado que estás en vivo) y la escena «OFFLINE 📵» = «Offline»: sale en Kick y en Twitch');
  // OBS sin transmitir y sin estar en vivo: no se manda, y el feed dice por qué
  k0=sentK().length; t0=sentT().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:false},msgs:[]}); await W2(200);
  await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:false},msgs:[]}); await W2(400);
  ok2(sentK().length===k0 && sentT().length===t0, 'sin estar en vivo ni transmitir: no manda nada');
  let re=ruleEvs().pop();
  ok2(re && re.d.ok && /no estabas en vivo/.test(re.d.note||''), 'y el feed dice por qué no salió: '+(re && re.d.note));
  // sin elegir («donde estés en vivo»): con OBS transmitiendo y sin aviso de Kick, va a Kick
  await RS({on:true,feed:true,list:[{id:'sc2',on:true,ev:'scene',name:'Offline',steps:[{t:'chat',text:'Se cayó la señal'}]}]});
  k0=sentK().length; t0=sentT().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:true},msgs:[]}); await W2(200);
  await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:true},msgs:[]}); await W2(400);
  ok2(sentK().slice(k0).some(t=>/Se cayó la señal/.test(t)) && sentT().length===t0, '«Donde estés en vivo» con OBS transmitiendo: va a Kick');
  // en vivo solo en Twitch y la regla dice «Kick»: igual va a Kick (lo elegiste tú)
  await RS({on:true,feed:true,list:[{id:'sc3',on:true,ev:'scene',name:'Offline',to:'kick',steps:[{t:'chat',text:'Solo Kick aquí'}]}]});
  kv['tw:session']=JSON.stringify({live:true}); k0=sentK().length; t0=sentT().length;
  await CI('',{w:WK,st:ST,obs:{scene:'LIVE',on:false},msgs:[]}); await W2(200);
  await CI('',{w:WK,st:ST,obs:{scene:'Offline',on:false},msgs:[]}); await W2(400);
  ok2(sentK().slice(k0).some(t=>/Solo Kick aquí/.test(t)) && sentT().length===t0, 'eligiendo «Kick»: sale en Kick aunque estés en vivo solo en Twitch');
  kv['tw:session']=JSON.stringify({live:false});

  // B) 👑 VIP temporales
  const now=Date.now();
  global.__z.vipx=[[now+3*864e5,'tw:4242:fan1'],[now+864e5,'kick:pepe']];
  r=await RW('extra');
  ok2(r.ok && r.vips.length===2 && r.vips[0].k==='kick:pepe' && r.vips[0].pf==='kick' && r.vips[0].u==='pepe' && r.vips[1].u==='fan1' && Math.abs(r.vips[1].until-(now+3*864e5))<5, 'lista de VIP temporales: quién, plataforma y cuándo se les acaba (el que vence primero arriba)');
  r=await (await fetch('http://localhost:7702/api/rewards?a=extra')).json(); ok2(r.ok===false, 'la lista de VIP pide tu clave');
  global.__VIP=global.__VIP||{calls:[],set:new Set()}; global.__VIP.set.add('4242');
  t0=sentT().length;
  r=await RW('vipdel',{k:'tw:4242:fan1'});
  ok2(r.ok && global.__VIP.calls.some(c=>c==='DELETE 4242') && !r.vips.some(v=>v.k==='tw:4242:fan1'), '«Quitar ya» en Twitch: se lo quita al momento y sale de la lista');
  ok2(!sentT().slice(t0).some(t=>/Se terminó el VIP/.test(t)), 'y no anuncia «se terminó tu VIP» (lo quitaste tú)');
  k0=sentK().length;
  r=await RW('vipdel',{k:'kick:pepe'});
  ok2(r.ok && !r.vips.length && !sentK().slice(k0).some(t=>/Se terminó el VIP/.test(t)), '«Quitar ya» en Kick: sale de la lista, sin anuncio');
  r=await RW('vipdel',{k:'kick:pepe'}); ok2(r.ok && r.gone, 'si ya no estaba, no truena');
  r=await RW('vipdel',{k:'algo raro; DEL'}); ok2(!r.ok, 'un VIP inválido no se toca');
  // el que vence solo sí se anuncia
  global.__z.vipx=[[Date.now()-1000,'tw:4242:fan2']]; global.__VIP.set.add('4242'); t0=sentT().length;
  await CI('',{w:WK,st:ST,msgs:[]}); await W2(400);
  ok2(sentT().slice(t0).some(t=>/Se terminó el VIP de fan2/.test(t)), 'el que se vence solo sí se anuncia, como siempre');

  // C) 🛡 protegidos del timeout
  r=await RW('prot',{c:{users:['@Amigo1','amigo1','x','Otro.Amigo'],mods:true}});
  ok2(r.ok && r.prot.users.join()==='amigo1,otro.amigo' && r.prot.mods===true, 'tu lista de protegidos se guarda limpia (sin @, sin repetidos)');
  await RS({on:true,feed:true,list:[{id:'kto',on:true,ev:'reward',name:'Timeout a alguien',pf:'kick',steps:[{t:'to',m:5,w:0}]}]});
  await CI('',{w:WK,st:ST,msgs:[kmsg('pm1','ModMan','hola',[{type:'moderator'}],7777), kmsg('pm2','Normalito','hola',[],8888)]});
  let b0=global.__calls.filter(c=>c.u==='bans').length, kr0=KR.calls.length; k0=sentK().length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll',reward:'Timeout a alguien',input:'@ModMan',rid:'own0001aaaa'}}]}); await W2(400);
  ok2(global.__calls.filter(c=>c.u==='bans').length===b0 && sentK().slice(k0).some(t=>/modman está protegido.*Te devolví tus puntos, @Troll/.test(t)), 'a un mod no le cae el timeout: lo explica y le devuelve sus puntos a quien canjeó');
  ok2(KR.calls.slice(kr0).some(c=>/redemptions\/reject.*own0001aaaa/.test(c)), 'y sí se devolvieron (Kick)');
  k0=sentK().length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll2',reward:'Timeout a alguien',input:'@Amigo1 jaja'}}]}); await W2(400);
  ok2(global.__calls.filter(c=>c.u==='bans').length===b0 && sentK().slice(k0).some(t=>/amigo1 está protegido/.test(t)), 'a alguien de tu lista tampoco');
  await RW('prot',{c:{users:['amigo1'],mods:false}});
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll3',reward:'Timeout a alguien',input:'@ModMan'}}]}); await W2(400);
  let bans=global.__calls.filter(c=>c.u==='bans').slice(b0);
  ok2(bans.length===1 && bans[0].b.user_id===7777, 'si apagas «mods protegidos», al mod sí le cae');
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll4',reward:'Timeout a alguien',input:'@Normalito'}}]}); await W2(400);
  ok2(global.__calls.filter(c=>c.u==='bans').slice(b0).some(c=>c.b.user_id===8888), 'a alguien que no está protegido sí le cae');
  await RW('prot',{c:{users:[],mods:true}});

  // D) 🔊 TTS por recompensa
  r=await RS({on:true,feed:true,list:[{id:'ktts',on:true,ev:'reward',name:'TTS',pf:'kick',steps:[{t:'rtts',who:'1'}]},{id:'ktts0',on:true,ev:'reward',name:'TTS corto',pf:'kick',steps:[{t:'rtts',who:'0'}]}]});
  ok2(r.cfg.list[0].steps[0].t==='rtts' && r.cfg.list[0].steps[0].who===1 && r.cfg.list[1].steps[0].who===0, 'el paso 🔊 TTS se guarda (con o sin decir el nombre)');
  let al0=(global.__z.alq||[]).length, ab0=ably('al').length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Pepe',reward:'TTS',input:'hola a todos visiten https://spam.com',rid:'own0002bbbb'}}]}); await W2(400);
  let it=(global.__z.alq||[]).slice(al0).map(x=>JSON.parse(x[1])).find(x=>x.k==='tts');
  ok2(it && it.u==='Pepe' && it.m==='hola a todos visiten' && it.who===1 && it.pf==='kick', 'canjean el TTS: va al player de alertas lo que escribieron (sin links): '+JSON.stringify(it));
  ok2(ably('al').length>ab0, 'y le llega al player al momento (Ably)');
  r=await RW('ttsbl',{op:'add',u:'@Troll'}); ok2(r.ok && r.ttsbl.join()==='troll', 'agregar a alguien a la lista negra del TTS');
  r=await RW('ttsbl',{op:'add',u:''}); ok2(!r.ok, 'sin nombre no agrega');
  al0=(global.__z.alq||[]).length; k0=sentK().length; kr0=KR.calls.length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Troll',reward:'TTS',input:'algo feo',rid:'own0003cccc'}}]}); await W2(400);
  ok2(!(global.__z.alq||[]).slice(al0).some(x=>JSON.parse(x[1]).k==='tts'), 'alguien de la lista negra: no suena');
  ok2(sentK().slice(k0).some(t=>/@Troll por ahora no puedes usar el TTS por mal uso\. Te devolví tus puntos\./.test(t)) && KR.calls.slice(kr0).some(c=>/reject.*own0003cccc/.test(c)), 'se le avisa en el chat y se le devuelven sus puntos');
  re=ruleEvs().pop(); ok2(re && /lista negra/.test(re.d.note||''), 'y en tu feed dice que estaba en la lista negra');
  k0=sentK().length;
  await CI('',{w:WK,st:ST,msgs:[{pf:'kick',reward:{user:'Callado',reward:'TTS',input:'   '}}]}); await W2(300);
  ok2(sentK().slice(k0).some(t=>/@Callado escribe tu mensaje/.test(t)), 'si no escribió nada, se lo dice');
  r=await RW('ttsbl',{op:'del',u:'troll'}); ok2(r.ok && !r.ttsbl.length, 'quitar de la lista negra');
  // ▶ Probar no manda nada al player
  al0=(global.__z.alq||[]).length;
  r=await (await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,action:'test',rule:{ev:'reward',name:'TTS',pf:'kick',steps:[{t:'rtts'}]}})})).json();
  ok2(r.ok && r.chats.some(t=>/TTS en tu OBS/.test(t)) && (global.__z.alq||[]).length===al0, '▶ Probar dice qué leería sin mandarlo a tu OBS');

  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(0);
});
