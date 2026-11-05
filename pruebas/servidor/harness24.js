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
  else if(op==='ZREVRANGE'){ const A=zr(cmd[1]).slice().reverse(), L=A.length; let st=Number(cmd[2]), en=Number(cmd[3]); if(st<0) st=Math.max(0,L+st); if(en<0) en=L+en; r=A.slice(st,en+1).map(x=>x[1]); }
  else if(op==='HSETNX'){ const H=(global.__h=global.__h||{}); const o=(H[cmd[1]]=H[cmd[1]]||{}); if(o[cmd[2]]!==undefined) r=0; else { o[cmd[2]]=String(cmd[3]); r=1; } }
  else if(op==='HGETALL'){ const o=((global.__h||{})[cmd[1]])||{}; r=Object.keys(o).flatMap(k=>[k,o[k]]); }
  else if(op==='EXPIRE'){ (global.__exp=global.__exp||{})[cmd[1]]=Number(cmd[2]); r=1; }
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
const handler=require(RAIZ+'/api/[route].js');
const app=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'); const m=u.pathname.match(/^\/api\/([^/]+)/);
  req.query=Object.fromEntries(u.searchParams); if(m) req.query.route=m[1];
  handler(req,res);
}).listen(7702, async ()=>{
  const sign=(id,ts,body,key)=>crypto.sign('sha256',Buffer.from(id+'.'+ts+'.'+body),{key:key||privateKey,padding:crypto.constants.RSA_PKCS1_PADDING}).toString('base64');
  async function hook(type,payload,id,badKey){ const body=JSON.stringify(payload), ts=new Date().toISOString();
    const r=await fetch('http://localhost:7702/api/webhook',{method:'POST',body,headers:{'kick-event-type':type,'kick-event-version':'1','kick-event-message-id':id,'kick-event-message-timestamp':ts,'kick-event-signature':sign(id,ts,body,badKey),'content-type':'application/json'}});
    return r.status; }





  let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
  const r1=await fetch('http://localhost:7702/api/login',{redirect:'manual'}); const st=new URL(r1.headers.get('location')).searchParams.get('state');
  const cb=await (await fetch('http://localhost:7702/api/callback?code=abc&state='+st,{headers:{'x-forwarded-host':'kick-feed-mariotq.vercel.app'}})).text();
  const key=decodeURIComponent((cb.match(/key=([A-Za-z0-9_\-%]+)/)||[])[1]);

  const api=(path,b)=>fetch('http://localhost:7702/api/'+path+(b?'':'?key='+encodeURIComponent(key)),{method:b?'POST':'GET',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:b?JSON.stringify(Object.assign({key},b)):undefined}).then(r=>r.json().then(j=>(j.__st=r.status,j)));
  const chatHook=(id,u,t,badges)=>hook('chat.message.sent',{message_id:id,content:t,created_at:new Date().toISOString(),sender:{username:u,user_id:id.length+1000,identity:{username_color:'#fff',badges:badges||[]}}},'wh-'+id);
  const W=ms=>new Promise(r=>setTimeout(r,ms));
  const MOD=[{type:'moderator',text:'Moderator'}], ME=[{type:'broadcaster',text:'Broadcaster'}];
  const chats=()=>global.__calls.filter(c=>c.u==='chat');
  const api2=(path,b)=>fetch('http://localhost:7702/api/'+path+(b?'':'?key='+encodeURIComponent(key)),{method:b?'POST':'GET',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:b?JSON.stringify(Object.assign({key},b)):undefined}).then(r=>r.json());
  const chatHook2=(id,u,t,badges,uid)=>hook('chat.message.sent',{message_id:id,content:t,created_at:new Date().toISOString(),sender:{username:u,user_id:uid||777,identity:{username_color:'#fff',badges:badges||[]}}},'wh-'+id);
  /* ===== v69: antispam con timeout ===== */
  let r=await api2('spam');
  ok(r.ok && r.to===1, 'de inicio: borrar + timeout de 1 min');
  const c0=global.__calls.length;
  await chatHook2('sp1','flux_bot77','hq ai stream upgrades botkiva com 🤑zero cost upgrades 🤑',[],555); await W(300);
  const cs=global.__calls.slice(c0);
  ok(cs.some(c=>c.m==='DELETE' && c.u==='sp1') && cs.some(c=>c.u==='bans' && c.m==='POST' && c.b.user_id===555 && c.b.duration===1), 'llega spam: lo borra y le da timeout de 1 min: '+JSON.stringify(cs.map(c=>[c.m,c.u,c.b&&c.b.duration])));
  let ev=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json());
  let sp=ev.events.find(e=>e.d && e.d.kind==='spam');
  ok(sp && sp.d.to===1 && sp.d.uid===555, 'en el feed sale con el timeout');
  await hook('moderation.banned',{banned_user:{username:'flux_bot77',user_id:555},moderator:{username:'mariotq'},metadata:{reason:'Spam',expires_at:new Date(Date.now()+60000).toISOString()}},'ban-sp1'); await W(200);
  ev=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json());
  const bn=ev.events.find(e=>e.id==='ban-sp1');
  ok(bn && bn.d.spam===1, 'el aviso de Kick de ese timeout queda marcado (para no repetirlo en el feed)');
  r=await api2('spam',{action:'to',to:0});
  ok(r.ok && r.to===0, 'se puede dejar en «solo borrar»');
  const c1=global.__calls.length;
  await chatHook2('sp2','flux_bot78','botkiva com',[],556); await W(300);
  ok(!global.__calls.slice(c1).some(c=>c.u==='bans'), 'en «solo borrar» ya no da timeout');
  r=await api2('spam',{action:'to',to:7});
  ok(r.to===1, 'un valor raro regresa a 1 min');
  await api2('spam',{action:'to',to:60});
  await chatHook2('sp3','sub_que_copia','botkiva com',[{type:'subscriber'}],557); await W(300);
  ok(!global.__calls.some(c=>c.u==='bans' && c.b && c.b.user_id===557), 'a subs/VIPs/mods nunca los toca');
  console.log(fails?('\n'+fails+' FALLAS'):'\nTODO BIEN');
  process.exit(fails?1:0);
});
