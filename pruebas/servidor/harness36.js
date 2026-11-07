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

{ const f0=global.fetch; const KW=global.__KW={calls:[],good:'GOOD.tok|1234567890abcdef',vips:['amigo_manual'],dead:false};
  global.fetch=async (url,opts={})=>{ url=String(url); const m=(opts.method||'GET').toUpperCase();
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    if (url.startsWith('https://kick.com/api/')){ const auth=((opts.headers||{}).Authorization||''), ua=((opts.headers||{})['User-Agent']||'');
      KW.calls.push({m,path:url.slice(16),auth,ua,body:opts.body?JSON.parse(opts.body):null});
      if (auth!=='Bearer '+KW.good || KW.dead) return J({message:'Unauthenticated.'},401);
      const p=url.slice(16);
      if (/\/community\/vips$/.test(p) && m==='GET') return J(KW.vips.map(u=>({username:u})));
      if (/\/community\/vips$/.test(p) && m==='POST'){ const u=JSON.parse(opts.body).username.toLowerCase(); if (KW.vips.indexOf(u)<0) KW.vips.push(u); return J({},201); }
      let mm=p.match(/\/community\/vips\/([^/]+)$/); if (mm && m==='DELETE'){ KW.vips=KW.vips.filter(x=>x!==decodeURIComponent(mm[1]).toLowerCase()); return J({},204); }
      if (/\/chatroom$/.test(p) && m==='PUT'){ KW.emo=JSON.parse(opts.body).emotes_mode; return J({emotes_mode:{enabled:KW.emo}}); }
      if (/\/redemptions\/(accept|reject)$/.test(p)) return J({data:[]});
      if (/\/rewards\/[^/]+$/.test(p)) return m==='DELETE'?J({},204):J({data:{id:'x'}});
      return J({message:'no mock'},404); }
    if (url.startsWith('https://api.kick.com/public/v1/channels/rewards/redemptions/')) { const b=JSON.parse(opts.body||'{}'); return J({data:(b.ids||[]).map(id=>({id,reason:'NOT_OWNED'}))}); }
    if (url.startsWith('https://api.kick.com/public/v1/channels/rewards/') && (m==='PATCH'||m==='DELETE')) return J({message:'Forbidden'},403);
    return f0(url,opts); }; }

{ const f0=global.fetch; const KP=global.__KP={poll:null,pred:null,calls:[]};
  global.fetch=async (url,opts={})=>{ url=String(url); const m=(opts.method||'GET').toUpperCase();
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    const mm=url.match(/^https:\/\/kick\.com\/api\/v2\/channels\/mariotq\/(polls|predictions)(\/.*)?$/);
    if (mm){ const KW=global.__KW, auth=((opts.headers||{}).Authorization||''), b=opts.body?JSON.parse(opts.body):null; KP.calls.push({m,p:mm[1]+(mm[2]||''),b});
      if (mm[1]==='polls' && m==='GET') return KP.poll ? J({status:{code:200},data:{poll:KP.poll}}) : J({status:{code:404,message:'Poll not found',error:true},data:null});
      if (mm[1]==='predictions' && mm[2]==='/latest' && m==='GET') return J({data:{prediction:KP.pred},message:'Success'});
      if (auth!=='Bearer '+KW.good || KW.dead) return J({message:'Unauthenticated.'},401);
      if (mm[1]==='polls' && m==='POST'){ KP.poll={title:b.title,duration:b.duration,remaining:b.duration,result_display_duration:b.result_display_duration,has_voted:false,options:b.options.map((l,i)=>({id:i+1,label:l,votes:i}))}; return J({status:{code:201},data:{poll:KP.poll}}); }
      if (mm[1]==='polls' && m==='DELETE'){ KP.poll=null; return J({status:{code:200}}); }
      if (mm[1]==='predictions' && !mm[2] && m==='POST'){ KP.pred={id:'01PRED0000000001',title:b.title,state:'ACTIVE',duration:b.duration,created_at:new Date().toISOString(),outcomes:b.outcomes.map((t,i)=>({id:'01OUT000000000'+i,title:t,total_vote_amount:100*(i+1),vote_count:i+1}))}; return J({data:{prediction:KP.pred},message:'Created'},201); }
      const pid=(mm[2]||'').slice(1);
      if (mm[1]==='predictions' && m==='PATCH' && KP.pred && pid===KP.pred.id){ KP.pred.state=b.state; if (b.winning_outcome_id) KP.pred.winning_outcome_id=b.winning_outcome_id; return J({data:{prediction:KP.pred}}); }
      return J({message:'no'},404); }
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
process.env.ABLY_API_KEY='abc123.def456:SeCrEtAbLy_xyz'; process.env.VERCEL_PROJECT_PRODUCTION_URL='kick-feed-mariotq.vercel.app'; process.env.VIP_SWEEP_MS='1'; process.env.KW_WATCH_MS='1'; process.env.KV_REST_API_URL='http://localhost:7701'; process.env.KV_REST_API_TOKEN='x';
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



  const KW=global.__KW, KP=global.__KP;
  const P=(b)=>fetch('http://localhost:7702/api/kpoll',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  r=await (await fetch('http://localhost:7702/api/kpoll?a=now&key=mala')).json(); ok2(r.ok===false, 'sin tu clave no hay nada');
  r=await P({a:'now'}); ok2(!r.ok && /Falta tu sesión/.test(r.error), 'sin sesión de Kick lo dice: '+r.error);
  r=await fetch('http://localhost:7702/api/kweb',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key,a:'set',token:KW.good})}).then(r=>r.json()); ok2(r.ok, 'con tu sesión puesta');
  r=await P({a:'now'}); ok2(r.ok && r.poll===null && r.pred===null, 'sin encuesta ni predicción');
  r=await P({a:'poll',title:'¿A dónde vamos?',options:['Centro','Playa',''],duration:100});
  ok2(r.ok && r.poll && r.poll.t==='¿A dónde vamos?' && r.poll.opts.length===2, 'crear encuesta en Kick');
  const pc=KP.calls.find(c=>c.m==='POST' && c.p==='polls'); ok2(pc && pc.b.duration===120 && pc.b.options.join()==='Centro,Playa' && pc.b.result_display_duration===15, 'con lo que Kick acepta (duración 2 min, opciones sin vacías): '+JSON.stringify(pc && pc.b));
  r=await P({a:'pollEnd'}); ok2(r.ok && r.poll===null && KP.calls.some(c=>c.m==='DELETE'), 'terminar la encuesta');
  r=await P({a:'poll',title:'x',options:['solo una']}); ok2(!r.ok, 'con una sola opción no deja');
  r=await P({a:'pred',title:'¿Llego antes de las 8?',outcomes:['Sí','No'],window:300});
  ok2(r.ok && r.pred && r.pred.st==='ACTIVE' && r.pred.outs.length===2 && KP.calls.some(c=>c.m==='POST' && c.p==='predictions' && c.b.duration===300), 'crear predicción en Kick (5 min para apostar)');
  const id=r.pred.id, w=r.pred.outs[1].id;
  r=await P({a:'lock',id}); ok2(r.ok && r.pred.st==='LOCKED', 'cerrar apuestas');
  r=await P({a:'win',id,win:w}); ok2(r.ok && r.pred.st==='RESOLVED' && KP.pred.winning_outcome_id===w, 'elegir quién ganó');
  KP.pred=null; r=await P({a:'pred',title:'Otra',outcomes:['A','B']}); r=await P({a:'cancel',id:r.pred.id}); ok2(r.ok && r.pred.st==='CANCELLED', 'cancelar (Kick devuelve los puntos)');
  KW.dead=true; r=await P({a:'poll',title:'¿Y?',options:['a','b']}); ok2(!r.ok && /venció/.test(r.error), 'si la sesión se venció, lo dice: '+r.error);
  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(0);
});
