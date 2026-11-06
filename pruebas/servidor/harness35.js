const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v88 · 🔐 seguridad (Ably privado, CORS, freno de claves, cambiar la clave), 👑 VIP desde el chat y 📺 anuncios de Kick
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
// v88 · 📺 anuncios de Kick (API oficial) simulados
{ const f0=global.fetch; const KA=global.__KA={calls:[],fail:'',left:3,run:null};
  global.fetch=async (url,opts={})=>{ url=String(url); const m=(opts.method||'GET').toUpperCase();
    const J=(o,st=200)=>new Response(st===204?null:JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
    if (url.startsWith('https://api.kick.com/public/v1/ads/')){ const path=url.split('/public/v1')[1]; let body=null; try{ body=opts.body?JSON.parse(opts.body):null; }catch(e){}
      KA.calls.push({m,path,body,auth:(opts.headers||{}).Authorization});
      if (path==='/ads/ad-break-status') return J({data:{ad_breaks:KA.run?[KA.run]:[],ads_blocked:false,auto_ads_active:false,limits:{max:4,period_seconds:3600},opted_in:!KA.fail,remaining_ad_breaks:KA.left}});
      if (path==='/ads/ad-break'){ if (KA.fail) return J({data:KA.fail,message:'error'},400);
        KA.left--; KA.run={ad_break_id:'ab1',break_duration_seconds:body.break_duration_seconds,created_at:new Date().toISOString(),id:body.id,source:'api',status:'running'};
        return J({data:{ad_break_id:'ab1',id:body.id,remaining_ad_breaks:KA.left},message:'OK'},202); }
      if (path==='/ads/enroll'){ if (KA.enrollFail) return J({data:KA.enrollFail,message:'error'},400); KA.fail=''; return J({data:{},message:'OK'}); }
      return J({message:'no mock'},404); }
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


  let fails=0; const ok2=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
  const W2=ms=>new Promise(r=>setTimeout(r,ms));
  let K=key;
  const P=async (route,b,hdr)=>{ const r=await fetch('http://localhost:7702/api/'+route,{method:'POST',headers:Object.assign({'Content-Type':'text/plain'},hdr||{}),body:JSON.stringify(b||{})}); let j={}; try{ j=await r.json(); }catch(e){} j.__st=r.status; return j; };
  const RT=require(RAIZ+'/api/_rt.js');
  const chOf=x=>(x.url.match(/\/channels\/([^/]+)\/messages/)||[])[1];

  // A) 🔐 Ably: un canal público (letreros de OBS) y uno privado (tus celulares)
  let a0=global.__ably.length;
  await RT.pub('ev',{id:'e1',d:{kind:'sub',pf:'kick',user:'Fan'}});
  let got=global.__ably.slice(a0).map(chOf);
  ok2(got.indexOf('kf')>=0 && got.indexOf('kfp')>=0, 'un sub va a los dos canales (tus letreros lo necesitan): '+got.join(','));
  a0=global.__ably.length;
  await RT.pub('ev',{id:'e2',d:{kind:'mod',pf:'kick',user:'Mod'}});
  got=global.__ably.slice(a0).map(chOf);
  ok2(got.join()==='kfp', 'lo de moderación solo va al canal privado: '+got.join(','));
  for (const n of ['tw','sync','obs','rw','kad']){ a0=global.__ably.length; await RT.pub(n,{x:1}); got=global.__ably.slice(a0).map(chOf); ok2(got.join()==='kfp', '«'+n+'» va solo al canal privado'); }
  for (const n of ['goal','al','alcfg','brb','ping']){ a0=global.__ably.length; await RT.pub(n,{x:1}); got=global.__ably.slice(a0).map(chOf); ok2(got.join()==='kf', '«'+n+'» sigue en el público (letreros de OBS)'); }
  let tr=await (await fetch('http://localhost:7702/api/rt')).json();
  ok2(JSON.stringify(Object.keys(JSON.parse(tr.capability)))==='["kf"]', 'sin clave: el permiso de Ably solo deja escuchar el canal público');
  tr=await (await fetch('http://localhost:7702/api/rt?key=MALA')).json();
  ok2(JSON.stringify(Object.keys(JSON.parse(tr.capability)))==='["kf"]', 'con una clave equivocada, tampoco el privado');
  tr=await (await fetch('http://localhost:7702/api/rt?key='+encodeURIComponent(K))).json();
  let cap=JSON.parse(tr.capability); ok2(cap.kf && cap.kfp && cap.kfp.join()==='subscribe', 'con tu clave: también el privado (solo escuchar)');

  // B) 🔐 CORS: solo tus páginas
  r=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(K),{headers:{Origin:'https://evil.example'}});
  ok2(r.headers.get('access-control-allow-origin')!=='https://evil.example' && r.headers.get('access-control-allow-origin')!=='*', 'a otra página no se le abre la puerta (CORS): '+r.headers.get('access-control-allow-origin'));
  r=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(K),{headers:{Origin:'https://mariiotq.github.io'}});
  ok2(r.headers.get('access-control-allow-origin')==='https://mariiotq.github.io' && /Origin/.test(r.headers.get('vary')||''), 'a tu app de GitHub Pages sí');
  r=await fetch('http://localhost:7702/api/alertas?a=cfg',{headers:{Origin:'https://kick-feed-mariotq-git-v88-tq19.vercel.app'}});
  ok2(r.headers.get('access-control-allow-origin')==='https://kick-feed-mariotq-git-v88-tq19.vercel.app', 'y a tus previews de Vercel (alertas)');
  r=await fetch('http://localhost:7702/api/brb?a=state',{headers:{Origin:'https://kick-feed-mariotq-git-v88-tq19.vercel.app.evil.com'}});
  ok2(r.headers.get('access-control-allow-origin')!=='https://kick-feed-mariotq-git-v88-tq19.vercel.app.evil.com', 'un dominio disfrazado no pasa (BRB)');

  // C) 🔐 freno a quien prueba claves
  const IPA={'x-real-ip':'10.0.0.1'}, IPB={'x-real-ip':'10.0.0.2'};
  for (let i=0;i<20;i++) await P('rewards',{key:'adivina'+i,a:'extra'},IPA);
  r=await P('rewards',{key:K,a:'extra'},IPA);
  ok2(r.__st===403, 'después de 20 claves distintas equivocadas, esa conexión ya no entra ni con la buena (por un rato)');
  r=await P('rewards',{key:K,a:'extra'},IPB);
  ok2(r.ok, 'desde otra conexión, tu clave sigue sirviendo');
  for (let i=0;i<40;i++) await P('rewards',{key:'clave-vieja-del-otro-cel',a:'extra'},IPB);
  r=await P('rewards',{key:K,a:'extra'},IPB);
  ok2(r.ok, 'un celular que se quedó con la clave vieja (siempre la misma) no frena a nadie');
  r=await fetch('http://localhost:7702/api/alertas?a=cfg',{headers:IPA}); let j=await r.json();
  ok2(j.ok, 'lo público (tus letreros sin clave) nunca se frena');

  // D) 🔑 cambiar tu clave desde la app
  r=await P('key',{key:'MALA',a:'rotate'}); ok2(r.__st===403, 'sin tu clave no se puede cambiar');
  r=await fetch('http://localhost:7702/api/key?key='+encodeURIComponent(K)+'&a=rotate'); ok2(r.status===405, 'solo por POST (no con un link)');
  r=await P('key',{key:K,a:'rotate'});
  ok2(r.ok && r.key && r.key!==K && /^[A-Za-z0-9_-]{20,}$/.test(r.key) && r.link==='https://mariiotq.github.io/kick-feed/?key='+encodeURIComponent(r.key), 'clave nueva y su link para tus celulares');
  const OLD=K; K=r.key;
  ok2(global.__kvref.feedkey===K && Number(global.__kvref.feedkeyAt)>0, 'queda guardada (con la fecha)');
  r=await P('rewards',{key:OLD,a:'extra'}); ok2(r.__st===403, 'la clave vieja ya no sirve');
  r=await P('rewards',{key:K,a:'extra'}); ok2(r.ok, 'la nueva sí');
  r=await fetch('http://localhost:7702/api/alertas?a=save',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key:OLD,cfg:{}})}); ok2(r.status===403 || !(await r.json()).ok, 'tampoco en Alertas');

  // E) 👑 dar y quitar VIP desde el chat (hoja del usuario)
  global.__VIP=global.__VIP||{calls:[],set:new Set()};
  let t0=global.__T.sent.length;
  r=await P('rewards',{key:K,a:'vipgive',pf:'tw',u:'Fan9',uid:'4243',days:7});
  ok2(r.ok && global.__VIP.calls.indexOf('POST 4243')>=0 && (r.vips||[]).some(v=>/^tw:4243:/.test(v.k)), 'Dar VIP 7 días en Twitch: se lo pone y sale en tu lista de VIP temporales');
  let vx=(global.__z.vipx||[]).find(x=>/^tw:4243:/.test(x[1]));
  ok2(vx && Math.abs(vx[0]-(Date.now()+7*864e5))<60000, 'con su fecha de fin (7 días)');
  r=await P('rewards',{key:K,a:'vipgive',pf:'tw',u:'Fan9',uid:'',days:7}); ok2(!r.ok && /id de Twitch/.test(r.error), 'sin su id de Twitch avisa');
  r=await P('rewards',{key:K,a:'vipgive',pf:'tw',u:'x; DEL',uid:'1',days:7}); ok2(!r.ok, 'un nombre raro no pasa');
  r=await P('rewards',{key:K,a:'vipoff',pf:'tw',u:'Fan9',uid:'4243'});
  ok2(r.ok && global.__VIP.calls.indexOf('DELETE 4243')>=0 && !(r.vips||[]).some(v=>/^tw:4243:/.test(v.k)), 'Quitar VIP: se lo quita y sale de la lista');
  ok2(!global.__T.sent.slice(t0).some(x=>/Se terminó el VIP/.test(x.body.message)), 'sin anunciar «se terminó tu VIP» (lo quitaste tú)');
  global.__VIP.set.add('5555');
  r=await P('rewards',{key:K,a:'vipoff',pf:'tw',u:'Viejito',uid:'5555'});
  ok2(r.ok && global.__VIP.calls.indexOf('DELETE 5555')>=0, 'también a un VIP que no era temporal (puesto a mano)');
  r=await P('rewards',{key:'MALA',a:'vipgive',pf:'tw',u:'Fan9',uid:'4243'}); ok2(r.__st===403, 'pide tu clave');

  // F) 📺 anuncios de Kick (API oficial)
  const KA=global.__KA;
  r=await fetch('http://localhost:7702/api/login',{redirect:'manual'});
  ok2(/ads:read ads:write/.test(new URL(r.headers.get('location')).searchParams.get('scope')), 'al conectar Kick ya pide los permisos de anuncios');
  r=await P('kick',{key:'MALA',a:'ads'}); ok2(r.__st===403, 'los anuncios piden tu clave');
  r=await P('kick',{key:K,a:'ads',fresh:1});
  ok2(r.ok && r.ads && r.ads.opted && r.ads.left===3 && r.ads.max===4 && r.ads.per===3600 && !r.ads.run, 'cómo están tus anuncios de Kick: inscrito, te quedan 3 de 4 por hora');
  let n0=KA.calls.length; await P('kick',{key:K,a:'ads'}); ok2(KA.calls.length===n0, 'la segunda vez sale de lo guardado (no le pregunta a Kick otra vez)');
  a0=global.__ably.length;
  r=await P('kick',{key:K,a:'adstart',sec:200});
  let ab=KA.calls.filter(c=>c.path==='/ads/ad-break').pop();
  ok2(r.ok && ab && ab.body.break_duration_seconds===90 && /^[0-9a-f-]{36}$/.test(ab.body.id) && ab.m==='POST', 'lanzar un anuncio: máximo 90 s en Kick, con su id único');
  ok2(r.ads && r.ads.run && r.ads.run.dur===90 && r.ads.left===2, 'y la app recibe la cuenta regresiva y cuántos te quedan');
  got=global.__ably.slice(a0).filter(x=>x.body && x.body[0] && x.body[0].name==='kad');
  ok2(got.length===1 && chOf(got[0])==='kfp', 'tus celulares se enteran al momento (canal privado)');
  r=await P('kick',{key:K,a:'adstart',sec:3}); ab=KA.calls.filter(c=>c.path==='/ads/ad-break').pop();
  ok2(ab.body.break_duration_seconds===7, 'mínimo 7 s');
  delete global.__kvref['k:ads'];
  r=await (await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(K))).json();
  ok2(r.ok && r.kad && r.kad.run && r.kad.run.dur>0, 'en vivo en Kick, /api/events trae el anuncio de Kick');
  r=await (await fetch('http://localhost:7702/api/events?since=0')).json();
  ok2(r.ok && !r.kad, 'sin tu clave no lo trae');
  global.__kvref.session=JSON.stringify({live:false}); n0=KA.calls.length;
  r=await (await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(K))).json();
  ok2(r.ok && !r.kad && KA.calls.length===n0, 'sin estar en vivo en Kick no le pregunta nada a Kick');
  global.__kvref.session=JSON.stringify({live:true});
  KA.fail='CHANNEL_NOT_OPTED_IN';
  r=await P('kick',{key:K,a:'adstart',sec:30}); ok2(!r.ok && /no está inscrito/.test(r.error), 'si tu canal no está inscrito, lo dice en español: '+r.error);
  KA.fail='AD_BREAK_ACTIVE';
  r=await P('kick',{key:K,a:'adstart',sec:30}); ok2(!r.ok && /Ya hay un anuncio corriendo/.test(r.error), 'si ya hay uno corriendo, también');
  KA.fail='CHANNEL_NOT_OPTED_IN';
  r=await P('kick',{key:K,a:'adenroll'}); ok2(r.ok && KA.calls.some(c=>c.path==='/ads/enroll' && c.m==='POST') && r.ads && r.ads.opted, 'inscribir tu canal');
  KA.enrollFail='CHANNEL_IS_LIVE';
  r=await P('kick',{key:K,a:'adenroll'}); ok2(!r.ok && /fuera de vivo/.test(r.error), 'inscribirte estando en vivo: lo explica');
  r=await fetch('http://localhost:7702/api/kick?key='+encodeURIComponent(K)+'&a=adstart'); j=await r.json(); ok2(!j.ok, 'lanzar un anuncio solo por POST');

  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(fails?1:0);
});
