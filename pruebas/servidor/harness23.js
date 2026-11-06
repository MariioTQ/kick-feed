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
  const post=(b)=>fetch('http://localhost:7702/api/obs',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json().then(j=>(j.__st=r.status,j)));
  const { WebSocketServer } = require('ws');
  // OBS falso con escenas, fuentes, grupos, audios, filtros
  const O={pass:'pw', cur:'LIVE', stream:false, rec:false, sleeps:[], batches:[],
    scenes:{LIVE:[{id:1,name:'Camara',on:true},{id:2,name:'SubGoal',on:true},{id:3,name:'Alertas',on:true},{id:9,name:'Extras',on:true,group:true}],
            BRB:[{id:1,name:'Video BRB',on:true}], STARTING:[]},
    groups:{Extras:[{id:10,name:'Clima',on:false}]},
    inputs:{'Mochila Audio':{kind:'ffmpeg_source',audio:true,muted:false,db:-6},'Moblin Audio':{kind:'ffmpeg_source',audio:true,muted:true,db:-12},
            'Alertas':{kind:'browser_source',audio:true,muted:false,db:0},'Camara':{kind:'ffmpeg_source',audio:false},'SubGoal':{kind:'browser_source',audio:false},'Estado':{kind:'text_ft2_source_v2',audio:false,text:''}},
    filters:{Camara:[{name:'Blur',on:false,kind:'gpu_delay'}],LIVE:[{name:'Color',on:true,kind:'color_filter_v2'}],'Mochila Audio':[{name:'Gain 2',on:false,kind:'gain_filter'}]}, refreshed:[]};
  const order=['LIVE','BRB','STARTING'];
  function allItems(scene){ return O.scenes[scene]||O.groups[scene]; }
  function handle(r){
    const t=r.requestType, d=r.requestData||{}, OK=(data)=>({requestType:t,requestId:r.requestId,requestStatus:{result:true,code:100},responseData:data});
    const BAD=(c,m)=>({requestType:t,requestId:r.requestId,requestStatus:{result:false,code:c,comment:m}});
    switch(t){
      case 'GetSceneList': return OK({currentProgramSceneName:O.cur,scenes:order.map((n,i)=>({sceneName:n,sceneIndex:order.length-1-i})).reverse()});
      case 'GetStreamStatus': return OK({outputActive:O.stream,outputBytes:0,outputDuration:0});
      case 'GetRecordStatus': return OK({outputActive:O.rec,outputPaused:false});
      case 'GetInputList': return OK({inputs:Object.keys(O.inputs).map(n=>({inputName:n,unversionedInputKind:O.inputs[n].kind}))});
      case 'GetSceneItemList': { const a=O.scenes[d.sceneName]; if(!a) return BAD(600,'no scene'); return OK({sceneItems:a.map((x,i)=>({sceneItemId:x.id,sourceName:x.name,sceneItemEnabled:x.on,isGroup:!!x.group,sceneItemIndex:a.length-1-i}))}); }
      case 'GetGroupSceneItemList': { const a=O.groups[d.sceneName]; if(!a) return BAD(600,'no group'); return OK({sceneItems:a.map((x,i)=>({sceneItemId:x.id,sourceName:x.name,sceneItemEnabled:x.on,sceneItemIndex:i}))}); }
      case 'GetInputMute': { const x=O.inputs[d.inputName]; if(!x||!x.audio) return BAD(604,'no audio'); return OK({inputMuted:x.muted}); }
      case 'GetInputVolume': { const x=O.inputs[d.inputName]; if(!x||!x.audio) return BAD(604,'no audio'); return OK({inputVolumeDb:x.db,inputVolumeMul:Math.pow(10,x.db/20)}); }
      case 'GetSourceFilterList': return OK({filters:(O.filters[d.sourceName]||[]).map((f,i)=>({filterName:f.name,filterEnabled:f.on,filterIndex:i,filterKind:f.kind}))});
      case 'GetSourceFilter': { const f=(O.filters[d.sourceName]||[]).find(f=>f.name===d.filterName); if(!f) return BAD(600,'no filter'); return OK({filterEnabled:f.on}); }
      case 'SetSourceFilterEnabled': { const f=(O.filters[d.sourceName]||[]).find(f=>f.name===d.filterName); if(!f) return BAD(600,'no filter'); f.on=d.filterEnabled; return OK({}); }
      case 'GetSceneItemId': { const x=(allItems(d.sceneName)||[]).find(x=>x.name===d.sourceName); if(!x) return BAD(600,'No scene items were found'); return OK({sceneItemId:x.id}); }
      case 'GetSceneItemEnabled': { const x=(allItems(d.sceneName)||[]).find(x=>x.id===d.sceneItemId); if(!x) return BAD(600,'no item'); return OK({sceneItemEnabled:x.on}); }
      case 'SetSceneItemEnabled': { const x=(allItems(d.sceneName)||[]).find(x=>x.id===d.sceneItemId); if(!x) return BAD(600,'no item'); x.on=d.sceneItemEnabled; return OK({}); }
      case 'SetCurrentProgramScene': if(!O.scenes[d.sceneName]) return BAD(600,'No source was found'); O.cur=d.sceneName; return OK({});
      case 'ToggleInputMute': { const x=O.inputs[d.inputName]; if(!x||!x.audio) return BAD(604,'no audio'); x.muted=!x.muted; return OK({inputMuted:x.muted}); }
      case 'SetInputMute': { const x=O.inputs[d.inputName]; if(!x||!x.audio) return BAD(604,'no audio'); x.muted=d.inputMuted; return OK({}); }
      case 'SetInputVolume': { const x=O.inputs[d.inputName]; if(!x||!x.audio) return BAD(604,'no audio'); x.db=d.inputVolumeDb; return OK({}); }
      case 'PressInputPropertiesButton': { const x=O.inputs[d.inputName]; if(!x||x.kind!=='browser_source') return BAD(604,'not browser'); O.refreshed.push(d.inputName); return OK({}); }
      case 'StartStream': O.stream=true; return OK({}); case 'StopStream': O.stream=false; return OK({}); case 'ToggleStream': O.stream=!O.stream; return OK({outputActive:O.stream});
      case 'StartRecord': O.rec=true; return OK({}); case 'StopRecord': O.rec=false; return OK({}); case 'ToggleRecord': O.rec=!O.rec; return OK({});
      case 'Sleep': O.sleeps.push(d.sleepMillis); return OK({});
      case 'GetSourceScreenshot': return OK({imageData:'data:image/jpg;base64,QUJD'+d.sourceName});
      case 'GetCurrentProgramScene': return OK({currentProgramSceneName:O.cur, sceneName:O.cur});
      case 'SetInputSettings': { const x=O.inputs[d.inputName]; if(!x||!/text/.test(x.kind)) return BAD(604,'not text'); x.text=d.inputSettings.text; return OK({}); }
      case 'SaveReplayBuffer': if(!O.replay) return BAD(501,'Replay buffer is not active.'); O.saved=(O.saved||0)+1; return OK({});
      case 'ToggleRecordPause': O.paused=!O.paused; return OK({});
      case 'CallVendorRequest': (O.vendor=O.vendor||[]).push(d); return OK({vendorName:d.vendorName,requestType:d.requestType,responseData:{}});
    }
    return BAD(204,'unknown '+t);
  }
  const wss=new WebSocketServer({port:7720});
  wss.on('connection', ws=>{
    const salt='s'+Math.random(), challenge='c'+Math.random();
    ws.send(JSON.stringify({op:0,d:{rpcVersion:1,authentication:{salt,challenge}}}));
    ws.on('message', raw=>{ const m=JSON.parse(String(raw));
      if (m.op===1){ const sec=crypto.createHash('sha256').update(O.pass+salt).digest('base64'), exp=crypto.createHash('sha256').update(sec+challenge).digest('base64');
        if (m.d.authentication!==exp) return ws.close(4009); ws.send(JSON.stringify({op:2,d:{negotiatedRpcVersion:1}})); }
      else if (m.op===8){ O.batches.push(m.d.requests.map(r=>r.requestType)); setTimeout(()=>ws.send(JSON.stringify({op:9,d:{requestId:m.d.requestId,results:m.d.requests.map(handle)}})), 5); }
    });
  });

  let o=await post({action:'config',url:'ws://localhost:7720',pass:'pw'});
  ok(o.ok, 'OBS conectado');
  const goal=b=>fetch('http://localhost:7702/api/goal',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json());
  /* ===== v68: la meta le avisa al letrero de OBS al momento ===== */
  let gq=await goal({delta:1}); await W(400);
  let v=(O.vendor||[]).slice(-1)[0];
  ok(gq.ok && gq.off && v && v.vendorName==='obs-browser' && v.requestType==='emit_event' && v.requestData.event_name==='kickfeedGoal' && v.requestData.event_data.subs===1,
     'sin stream: +1 → OBS le pasa al letrero «kickfeedGoal» con 1: '+JSON.stringify(v));
  gq=await goal({delta:-1}); await W(400);
  v=(O.vendor||[]).slice(-1)[0];
  ok(v.requestData.event_data.subs===0 && O.vendor.length===2, '−1 → 0, también al momento');
  // con OBS apagado no truena la meta
  O.pass='otra';
  gq=await goal({delta:1});
  ok(gq.ok && gq.totals.subs===1, 'si OBS no contesta, la meta igual se guarda');
  /* ===== v69: 👁 un punto por minuto ===== */
  const vf=Date.now()-90*60000;
  const ev=(qs)=>fetch('http://localhost:7702/api/events?since=9999999999999'+qs).then(r=>r.json());
  const k0=global.__cmds.length;
  await ev('&vf='+vf+'&vm=0&vw=20&key='+encodeURIComponent(key));
  await ev('&vf='+vf+'&vm=1&vw=25&key='+encodeURIComponent(key));
  await ev('&vf='+vf+'&vm=1&vw=99&key='+encodeURIComponent(key));      // el otro celular, mismo minuto
  await ev('&vf='+vf+'&vm=2&vw=30&key=mala');                         // sin tu clave: no
  await ev('&vf=123&vm=3&vw=40&key='+encodeURIComponent(key));        // stream viejísimo: no
  await ev('&vf='+vf+'&vm=9999&vw=40&key='+encodeURIComponent(key));  // minuto imposible: no
  let r=await fetch('http://localhost:7702/api/viewers?key='+encodeURIComponent(key)+'&from='+vf).then(x=>x.json());
  ok(r.ok && JSON.stringify(r.pts)==='{"0":20,"1":25}', 'se guarda un punto por minuto (el primero que llega gana; sin clave o raros no): '+JSON.stringify(r.pts));
  ok(global.__exp && global.__exp['vw:'+vf]===259200, 'se borra solo a los 3 días');
  r=await fetch('http://localhost:7702/api/viewers?key=mala&from='+vf).then(x=>x.status);
  ok(r===403, 'leerla necesita tu clave');
  const per=global.__cmds.slice(k0).filter(c=>/^(HSETNX|EXPIRE)$/.test(c[0])).length;
  ok(per<=4, 'cada punto es 1 consulta (más el «se borra solo» cada 10 min): '+per);
  console.log(fails?('\n'+fails+' FALLAS'):'\nTODO BIEN');
  process.exit(fails?1:0);
});
