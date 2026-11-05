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
  // v61: llave pública del chat de Kick para la página de chat compartido (sin clave)
  { let calls0=global.__calls.filter(c=>c.u==='nego').length;
    let r=await fetch('http://localhost:7702/api/realtime?pub=1'); let j=await r.json();
    ok(r.status===200 && j.ok && j.app_key==='newkey123' && !('key' in j), 'realtime ?pub=1 sin clave: da la llave pública');
    let calls1=global.__calls.filter(c=>c.u==='nego').length;
    r=await fetch('http://localhost:7702/api/realtime?pub=1'); j=await r.json();
    ok(j.ok && j.cached && global.__calls.filter(c=>c.u==='nego').length===calls1, 'la segunda vez sale de lo guardado (no le vuelve a preguntar a Kick)');
    r=await fetch('http://localhost:7702/api/realtime'); 
    ok(r.status===403, 'sin ?pub=1 y sin clave: 403 como siempre');
    r=await fetch('http://localhost:7702/api/realtime?pub=1&fresh=1'); j=await r.json();
    ok(j.cached && global.__calls.filter(c=>c.u==='nego').length===calls1, 'con ?pub=1 no se puede forzar que pregunte a Kick');
  }
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
  ok(o.ok && o.current==='LIVE' && o.record && o.record.on===false, 'conectado; también trae la grabación');
  // catálogo
  o=await post({action:'catalog'});
  ok(o.ok && JSON.stringify(o.scenes)==='["LIVE","BRB","STARTING"]', 'catálogo: escenas en orden');
  ok(o.items.LIVE.map(x=>x.name).join(',')==='Camara,SubGoal,Alertas,Extras' && o.items.LIVE[1].id===2, 'catálogo: fuentes de LIVE en el orden de OBS con su número');
  ok(o.groups.join()==='Extras' && o.items.Extras && o.items.Extras[0].name==='Clima', 'catálogo: grupos y lo que tienen adentro');
  const aud=o.inputs.filter(x=>x.audio).map(x=>x.name+':'+x.muted+':'+x.db).join(',');
  ok(aud==='Mochila Audio:false:-6,Moblin Audio:true:-12,Alertas:false:0', 'catálogo: audios con su estado: '+aud);
  ok(o.inputs.find(x=>x.name==='SubGoal').kind==='browser_source', 'catálogo: sabe cuáles son de navegador');
  ok(o.filters.Camara[0].name==='Blur' && o.filters.LIVE[0].on===true, 'catálogo: filtros de fuentes y de escenas');
  ok(o.filters['Mochila Audio'] && o.filters['Mochila Audio'][0].kind==='gain_filter' && o.filters.Camara[0].kind==='gpu_delay', 'v60 catálogo: cada filtro dice de qué tipo es (gain_filter)');
  // ejecutar pasos
  o=await post({action:'run',steps:[{t:'item',scene:'LIVE',source:'SubGoal',id:2}],q:[{k:'sg',t:'item',scene:'LIVE',source:'SubGoal',id:2}]});
  ok(o.ok && O.scenes.LIVE[1].on===false && o.state.sg===false, 'alternar fuente: SubGoal se oculta y el estado regresa');
  o=await post({action:'run',steps:[{t:'item',scene:'LIVE',source:'SubGoal',id:99}],q:[{k:'sg',t:'item',scene:'LIVE',source:'SubGoal',id:99}]});
  ok(o.ok && O.scenes.LIVE[1].on===true && o.state.sg===true, 'aunque el número guardado ya no sirva, la encuentra por nombre');
  o=await post({action:'run',steps:[{t:'item',scene:'Extras',source:'Clima',mode:'on'}]});
  ok(o.ok && O.groups.Extras[0].on===true, 'mostrar una fuente dentro de un grupo');
  o=await post({action:'run',steps:[{t:'item',scene:'LIVE',source:'NoExiste'}]});
  ok(o.ok===false && /No encontré esa fuente/.test(o.error), 'fuente que no existe: error claro');
  o=await post({action:'run',steps:[{t:'filter',source:'Camara',filter:'Blur'}],q:[{k:'bl',t:'filter',source:'Camara',filter:'Blur'}]});
  ok(o.ok && O.filters.Camara[0].on===true && o.state.bl===true, 'alternar filtro Blur');
  o=await post({action:'run',steps:[{t:'mute',input:'Mochila Audio'}],q:[{k:'m',t:'mute',input:'Mochila Audio'}]});
  ok(o.ok && O.inputs['Mochila Audio'].muted===true && o.state.m===true, 'silenciar Mochila Audio');
  o=await post({action:'run',steps:[{t:'mute',input:'Moblin Audio',mode:'off'}]});
  ok(o.ok && O.inputs['Moblin Audio'].muted===false, 'activar Moblin Audio');
  o=await post({action:'run',steps:[{t:'vol',input:'Mochila Audio',step:3}],q:[{k:'v',t:'vol',input:'Mochila Audio'}]});
  ok(o.ok && O.inputs['Mochila Audio'].db===-3 && o.state.v===-3, 'subir volumen 3 dB: '+o.state.v);
  o=await post({action:'run',steps:[{t:'vol',input:'Mochila Audio',step:6}]});
  ok(O.inputs['Mochila Audio'].db===0, 'no pasa de 0 dB');
  o=await post({action:'run',steps:[{t:'vol',input:'Alertas',db:-80}]});
  ok(O.inputs['Alertas'].db===-100, 'hasta abajo = silencio total (-100)');
  o=await post({action:'run',steps:[{t:'refresh',input:'SubGoal'}]});
  ok(o.ok && O.refreshed.includes('SubGoal'), 'refrescar fuente de navegador');
  o=await post({action:'run',steps:[{t:'refresh',input:'Camara'}]});
  ok(o.ok===false, 'refrescar algo que no es de navegador: error');
  o=await post({action:'run',steps:[{t:'stream',mode:'on'}]});
  ok(o.ok && O.stream===true && o.stream.on===true, 'iniciar transmisión');
  o=await post({action:'run',steps:[{t:'record'}]});
  ok(o.ok && O.rec===true && o.record.on===true, 'grabar');
  // multi-acción: escena + esperar + mute + filtro en orden
  O.batches=[];
  o=await post({action:'run',steps:[{t:'scene',scene:'BRB'},{t:'wait',s:1.5},{t:'mute',input:'Mochila Audio',mode:'on'},{t:'filter',source:'Camara',filter:'Blur',mode:'off'}]});
  const last=O.batches[O.batches.length-1];
  ok(o.ok && O.cur==='BRB' && O.sleeps.pop()===1500 && O.filters.Camara[0].on===false, 'multi-acción en orden con espera');
  ok(last.slice(0,4).join()==='SetCurrentProgramScene,Sleep,SetInputMute,SetSourceFilterEnabled', 'los pasos van en orden en un solo paquete: '+last.slice(0,4).join());
  ok(O.batches.length===1, 'sin alternar no hace viajes extra: '+O.batches.length);
  o=await post({action:'run',steps:[{t:'wait',s:99}]});
  ok(O.sleeps.pop()===10000, 'la espera máxima es 10 s');
  o=await post({action:'run',steps:[{t:'otra'}]});
  ok(o.__st===400, 'pasos desconocidos no se aceptan');
  o=await post({action:'run',steps:[{t:'scene',scene:'X'}]});
  ok(o.ok===false && /OBS no pudo/.test(o.error), 'escena que no existe dentro de atajo: error');
  // estado con foto
  o=await post({action:'status',shot:1,q:[{k:'a',t:'mute',input:'Moblin Audio'},{k:'b',t:'vol',input:'Moblin Audio'},{k:'c',t:'item',scene:'LIVE',source:'Camara'}]});
  ok(o.ok && o.shot==='data:image/jpg;base64,QUJDBRB', 'foto de lo que sale (de la escena actual)');
  ok(o.state.a===false && o.state.b===-12 && o.state.c===true, 'estado de los atajos: '+JSON.stringify(o.state));
  o=await post({action:'status'});
  ok(o.ok && !('shot' in o), 'sin pedir foto no la manda');
  o=await post({action:'scene',scene:'LIVE'});
  ok(o.ok && o.current==='LIVE', 'el cambio de escena de antes sigue funcionando');
  // v57: texto, repetición, pausa, escena actual
  o=await post({action:'run',steps:[{t:'text',input:'Estado',text:'Comiendo 🍔'}]});
  ok(o.ok && O.inputs.Estado.text==='Comiendo 🍔', 'cambiar el texto de una fuente de texto');
  o=await post({action:'run',steps:[{t:'replay'}]});
  ok(o.ok===false && /replay buffer de OBS está apagado/.test(o.error), 'repetición con el replay buffer apagado: '+o.error);
  O.replay=true; o=await post({action:'run',steps:[{t:'replay'}]});
  ok(o.ok && O.saved===1, 'guardar repetición');
  o=await post({action:'run',steps:[{t:'record',mode:'pause'}]});
  ok(o.ok && O.paused===true, 'pausar grabación');
  O.cur='BRB'; O.stream=true; O.batches=[];
  o=await post({action:'now'});
  ok(o.ok && o.current==='BRB' && o.stream.on===true && O.batches.length===1 && O.batches[0].join()==='GetCurrentProgramScene,GetStreamStatus', 'escena actual (ligero, un solo paquete): '+JSON.stringify(o));
  o=await post({key:'mala',action:'now'});
  ok(o.__st===403, 'escena actual sin clave = 403');

  /* ===== v63: comandos para mods y el spam nuevo ===== */
  const api=(path,b)=>fetch('http://localhost:7702/api/'+path,{method:b?'POST':'GET',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:b?JSON.stringify(Object.assign({key},b)):undefined}).then(r=>r.json().then(j=>(j.__st=r.status,j)));
  const chatHook=(id,u,t,badges)=>hook('chat.message.sent',{message_id:id,content:t,created_at:new Date().toISOString(),sender:{username:u,user_id:id.length+1000,identity:{username_color:'#fff',badges:badges||[]}}},'wh-'+id);
  const W=ms=>new Promise(r=>setTimeout(r,ms));
  let rr=await api('modcmd?key='+encodeURIComponent(key)); let r=rr;
  ok(r.ok && r.cfg && r.cfg.cmds.length===0, 'comandos: empieza sin ninguno');
  r=await fetch('http://localhost:7702/api/modcmd?key=mala').then(x=>x.status);
  ok(r===403, 'sin la clave no se ven ni se cambian');
  r=await api('modcmd',{action:'save',cfg:{on:true,users:['@CrisRiios16','crisriios16','mal nombre!'],del:true,
     cmds:[{c:'!BRB',steps:[{t:'scene',scene:'BRB'},{t:'chat',text:'Ahorita regresa 🛵'},{t:'mix'},{t:'nope'}]},{c:'!live',steps:[{t:'scene',scene:'LIVE'}]},{c:'mal',steps:[{t:'scene',scene:'X'}]},{c:'!vacio',steps:[]}]}});
  ok(r.ok && r.cfg.users.join()==='crisriios16,malnombre' && r.cfg.cmds.map(x=>x.c).join()==='!brb,!live' && r.cfg.cmds[0].steps.map(x=>x.t).join()==='scene,chat', 'se guardan limpios: '+JSON.stringify(r.cfg.users)+' '+r.cfg.cmds.map(x=>x.c+':'+x.steps.map(y=>y.t)).join(' '));
  O.cur='LIVE'; const before=global.__calls.length;
  let st2=await chatHook('m1','CrisRiios16','!brb ya',[{type:'moderator',text:'Moderator'}]);
  await W(150);
  const nc=global.__calls.slice(before);
  ok(st2===200 && O.cur==='BRB', 'un mod de tu lista escribe !brb y OBS cambia a BRB');
  ok(nc.some(c=>c.u==='chat' && c.b.content==='Ahorita regresa 🛵') && nc.some(c=>c.m==='DELETE' && c.u==='m1'), 'manda su mensaje al chat y borra el «!brb»');
  r=await api('modcmd?key='+encodeURIComponent(key));
  ok(r.log.length===1 && r.log[0].u==='CrisRiios16' && r.log[0].c==='!brb' && r.log[0].ok, 'queda en «Últimos usados»');
  let ev=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json());
  ok((ev.events||[]).some(e=>e.d && e.d.kind==='cmd' && e.d.cmd==='!brb' && e.d.scene==='BRB'), 'y llega al feed: '+JSON.stringify((ev.events||[]).filter(e=>e.d&&e.d.kind==='cmd').map(e=>e.d)));
  O.cur='LIVE';
  await chatHook('m1','CrisRiios16','!brb',[{type:'moderator'}]); await W(100);
  ok(O.cur==='LIVE', 'el mismo aviso repetido por Kick no lo vuelve a hacer');
  await chatHook('m2','CrisRiios16','!brb',[{type:'moderator'}]); await W(100);
  ok(O.cur==='LIVE', 'dos veces seguidas en menos de 3 s: solo la primera');
  await chatHook('m3','OtroMod','!brb',[{type:'moderator'}]); await W(100);
  ok(O.cur==='LIVE', 'un mod que no está en tu lista: no hace nada');
  await chatHook('m4','crisriios16','!brb',[]); await W(100);
  ok(O.cur==='LIVE', 'si ya no es mod (sin insignia): no hace nada');
  await chatHook('m5','viewer1','!live',[{type:'subscriber',count:3}]); await W(100);
  ok(O.cur==='LIVE' && (await api('modcmd?key='+encodeURIComponent(key))).log.length===1, 'un viewer cualquiera: nada (y ni se anota)');
  O.cur='BRB';
  await chatHook('m6','MarioTQ','!live',[{type:'broadcaster'}]); await W(150);
  ok(O.cur==='LIVE', 'tú siempre puedes usarlos');
  await W(3100);
  r=await api('modcmd',{action:'save',cfg:Object.assign({}, r.cfg, {on:false})});
  await chatHook('m7','CrisRiios16','!brb',[{type:'moderator'}]); await W(100);
  ok(O.cur==='LIVE', 'apagados: no hacen nada');
  // spam nuevo: se agrega una vez a tu lista guardada
  await fetch('http://localhost:7702/api/spam',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({key,action:'on',on:true})});
  global.__kvref['spam']=JSON.stringify({on:true,list:['botkiva','mi frase']});
  r=await fetch('http://localhost:7702/api/spam?key='+encodeURIComponent(key)).then(x=>x.json());
  ok(r.list.indexOf('AI-powered viewers')>=0 && r.list.indexOf('mi frase')>=0 && r.list.indexOf('botkiva')>=0, 'el spam nuevo se agrega a tu lista (sin quitarte nada): '+r.list.join(' | '));
  const kvSeed=JSON.parse(global.__kvref['spam']).seed;
  ok(kvSeed===2, 'y solo una vez (luego lo puedes quitar)');
  const b2=global.__calls.length;
  await chatHook('s1','flux_neonblaze17388','With AI-powered viewers, new supporters, highlight reach, and daily reward drops on the house, your channel stays active around the clock.',[]);
  await chatHook('s2','flux_neonblaze17388','Wsup boss, hope your day is full of wins because you deserve them 🔥',[]);
  await chatHook('s3','flux_neonblaze17388',"Keep grinding, you're killing it! ✨",[]);
  await W(150);
  const dels=global.__calls.slice(b2).filter(c=>c.m==='DELETE').map(c=>c.u);
  ok(dels.join()==='s1,s2,s3', 'los mensajes del bot nuevo se borran: '+dels.join());

  /* ===== v64: reglas automáticas ===== */
  O.pass='pw'; await post({action:'config',url:'ws://localhost:7720',pass:'pw'});
  const RK='rules?key='+encodeURIComponent(key);
  r=await api(RK);
  ok(r.ok && r.cfg.on!==false && r.cfg.list.length===0, 'reglas: empieza sin ninguna');
  ok((await fetch('http://localhost:7702/api/rules?key=mala')).status===403, 'reglas: sin clave, 403');
  r=await api('rules',{action:'save',cfg:{on:true,feed:true,list:[
    {id:'kk1',ev:'kicks',min:100,cd:0,steps:[{t:'item',scene:'LIVE',source:'SubGoal',mode:'on'},{t:'chat',text:'¡Gracias {nombre} por los {cantidad} Kicks! {mensaje}'}]},
    {id:'cas1',ev:'cat',name:'Slots & Casino',steps:[{t:'item',scene:'LIVE',source:'Camara',mode:'off'},{t:'chat',text:'Casino: {categoría}'}]},
    {id:'cas2',ev:'catoff',name:'Slots & Casino',steps:[{t:'item',scene:'LIVE',source:'Camara',mode:'on'}]},
    {id:'fol1',ev:'follow',cd:30,steps:[{t:'chat',text:'Gracias por el follow {nombre}'}]},
    {id:'liv1',ev:'live',steps:[{t:'chat',text:'!redes'}]},
    {id:'rw1',ev:'reward',name:'clips',steps:[{t:'text',input:'Estado',text:'{nombre}: {mensaje}'},{t:'chat',text:'{nombre} canjeó {recompensa} {mensaje}'}]},
    {id:'ho1',ev:'host',min:10,steps:[{t:'scene',scene:'BRB'}]},
    {id:'gf1',ev:'gift',min:5,steps:[{t:'chat',text:'{nombre} regaló {cantidad}'}]},
    {id:'big1',ev:'kicks',min:5000,steps:[{t:'item',scene:'LIVE',source:'Alertas',mode:'off'},{t:'wait',s:1},{t:'item',scene:'LIVE',source:'Alertas',mode:'on'}]},
    {id:'wt1',ev:'resub',steps:[{t:'wait',s:99},{t:'wait',s:40},{t:'wait',s:30}]},
    {id:'bad1',ev:'nope',steps:[{t:'chat',text:'x'}]},
    {id:'bad2',ev:'sub',steps:[]},
    {id:'bad3',ev:'sub',steps:[{t:'mix'},{t:'title',text:'x'}]}
  ]}});
  ok(r.ok && r.cfg.list.map(x=>x.id).join()==='kk1,cas1,cas2,fol1,liv1,rw1,ho1,gf1,big1,wt1', 'se guardan solo las que sirven: '+r.cfg.list.map(x=>x.id).join());
  const wt=r.cfg.list.find(x=>x.id==='wt1');
  ok(wt.steps.map(s=>s.s).join()==='30,30,0.5', 'esperas: 30 s cada una y 1 minuto en total: '+wt.steps.map(s=>s.s).join());
  // Kicks
  let b0=global.__calls.length; O.scenes.LIVE[1].on=false;
  await hook('kicks.gifted',{sender:{username:'pepe'},gift:{amount:50,name:'Hola',message:'hola'}},'k1'); await W(80);
  ok(O.scenes.LIVE[1].on===false && !global.__calls.slice(b0).some(c=>c.u==='chat'), 'Kicks de menos (50 < 100): no hace nada');
  await hook('kicks.gifted',{sender:{username:'pepe'},gift:{amount:500,name:'Cohete',message:'te quiero 🛵 {nombre}'}},'k2'); await W(120);
  let ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  ok(O.scenes.LIVE[1].on===true, '500 Kicks: muestra la fuente');
  ok(ch.length===1 && ch[0]==='¡Gracias pepe por los 500 Kicks!', 'y manda el mensaje con su nombre y cantidad (sin repetir lo que escribió la persona): '+JSON.stringify(ch));
  ev=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json());
  let re=(ev.events||[]).filter(e=>e.d && e.d.kind==='rule');
  ok(re.length===1 && re[0].d.ev==='kicks' && re[0].d.user==='pepe' && re[0].d.ok, 'y llega al feed: '+JSON.stringify(re.map(e=>e.d)));
  r=await api(RK);
  ok(r.log.length===1 && r.log[0].rid==='kk1' && r.log[0].ok, 'queda en «Últimas que se activaron»');
  // follow con espera de 30 s
  b0=global.__calls.length;
  await hook('channel.followed',{follower:{username:'ana'}},'f1'); await hook('channel.followed',{follower:{username:'luis'}},'f2'); await W(80);
  ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  ok(ch.join('|')==='Gracias por el follow ana', 'follow: con su espera de 30 s solo sale la primera: '+ch.join('|'));
  await hook('channel.followed',{follower:{username:'ana'}},'f1'); await W(50);
  ok(global.__calls.slice(b0).filter(c=>c.u==='chat').length===1, 'el mismo aviso repetido por Kick no cuenta dos veces');
  // regalo de subs
  b0=global.__calls.length;
  await hook('channel.subscription.gifts',{gifter:{username:'don'},giftees:[{username:'a'},{username:'b'},{username:'c'}]},'g1');
  await hook('channel.subscription.gifts',{gifter:{username:'don'},giftees:[1,2,3,4,5,6].map(i=>({username:'u'+i}))},'g2');
  await hook('channel.subscription.gifts',{gifter:{is_anonymous:true},giftees:[1,2,3,4,5].map(i=>({username:'x'+i}))},'g3'); await W(80);
  ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  ok(ch.join('|')==='don regaló 6|Anónimo regaló 5', 'regalos: solo desde 5 subs (y anónimo dice Anónimo): '+ch.join('|'));
  // categoría (casino)
  O.scenes.LIVE[0].on=true; b0=global.__calls.length;
  await hook('livestream.metadata.updated',{metadata:{title:'IRL',category:{id:15,name:'IRL'}}},'mt1'); await W(60);
  ok(O.scenes.LIVE[0].on===true, 'el primer aviso de título/categoría (sin saber la anterior) no dispara nada');
  await hook('livestream.metadata.updated',{metadata:{title:'Casino 🎰',category:{id:28,name:'Slots & Casino'}}},'mt2'); await W(100);
  ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  ok(O.scenes.LIVE[0].on===false && ch.join()==='Casino: Slots & Casino', 'cambias a Slots & Casino: hace lo del casino ('+ch.join()+')');
  await hook('livestream.metadata.updated',{metadata:{title:'Casino 2',category:{id:28,name:'Slots & Casino'}}},'mt3'); await W(60);
  ok(global.__calls.slice(b0).filter(c=>c.u==='chat').length===1, 'solo cambiar el título no lo repite');
  await hook('livestream.metadata.updated',{metadata:{title:'IRL',category:{id:15,name:'IRL'}}},'mt4'); await W(100);
  ok(O.scenes.LIVE[0].on===true, 'sales del casino: lo regresa');
  // empieza el stream (y un corte no cuenta)
  b0=global.__calls.length; const t0=Date.now();
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0).toISOString(),title:'IRL'},'l1'); await W(60);
  await hook('livestream.status.updated',{is_live:false,ended_at:new Date(t0+60000).toISOString()},'l2'); await W(60);
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(t0+120000).toISOString(),title:'IRL'},'l3'); await W(60);
  ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  ok(ch.join('|')==='!redes', 'empieza el stream: !redes una vez (el corte de 1 min no cuenta como otro stream): '+ch.join('|'));
  // recompensas y raids (los avisa la app)
  b0=global.__calls.length;
  r=await api('rules',{action:'fire',ev:'reward',d:{user:'moto_gdl',reward:'CLIPS',input:'se cayó la señal'}});
  ok(r.ok && !r.dup && O.inputs.Estado.text==='moto_gdl: se cayó la señal', 'recompensa CLIPS: cambia el texto en OBS ('+O.inputs.Estado.text+')');
  ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  ok(ch.join()==='moto_gdl canjeó CLIPS', 'y en el chat no repite lo que escribió: '+ch.join());
  r=await api('rules',{action:'fire',ev:'reward',d:{user:'moto_gdl',reward:'CLIPS',input:'se cayó la señal'}});
  ok(r.dup && global.__calls.slice(b0).filter(c=>c.u==='chat').length===1, 'si tus dos celulares la avisan, solo cuenta una vez');
  O.inputs.Estado.text='';
  r=await api('rules',{action:'fire',ev:'reward',d:{user:'otro',reward:'Hidratarse',input:''}});
  ok(r.ok && O.inputs.Estado.text==='', 'otra recompensa: nada');
  O.cur='LIVE';
  r=await api('rules',{action:'fire',ev:'host',d:{user:'chico',viewers:5}});
  ok(O.cur==='LIVE', 'raid chico (5 < 10): nada');
  r=await api('rules',{action:'fire',ev:'host',d:{user:'amigo',viewers:42}});
  ok(O.cur==='BRB', 'raid de 42: cambia la escena');
  r=await api('rules',{action:'fire',ev:'sub',d:{user:'x'}});
  ok(r.__st===400, 'la app solo puede avisar recompensas y raids');
  r=await fetch('http://localhost:7702/api/rules',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({key:'mala',action:'fire',ev:'host',d:{viewers:99}})});
  ok(r.status===403, 'sin clave no se puede disparar');
  // esperas de verdad (mostrar y ocultar)
  O.cur='LIVE'; O.scenes.LIVE[2].on=true; const seen=[]; const iv=setInterval(()=>seen.push(O.scenes.LIVE[2].on),100);
  let tt=Date.now();
  await hook('kicks.gifted',{sender:{username:'rico'},gift:{amount:5000,name:'Yate'}},'k3');
  clearInterval(iv); const took=Date.now()-tt;
  ok(seen.includes(false) && O.scenes.LIVE[2].on===true && took>=950, 'esconde, espera 1 s y la vuelve a mostrar (tardó '+took+' ms)');
  // ▶ Probar: hace lo de OBS y NO manda mensajes
  b0=global.__calls.length; O.scenes.LIVE[1].on=false;
  r=await api('rules',{action:'test',rule:{ev:'kicks',min:200,steps:[{t:'item',scene:'LIVE',source:'SubGoal',mode:'on'},{t:'chat',text:'Gracias {nombre} por {cantidad} {mensaje}'}]}});
  ok(r.ok && O.scenes.LIVE[1].on===true && r.chats.join()==='Gracias Prueba por 200' && !global.__calls.slice(b0).some(c=>c.u==='chat'), 'Probar: hace lo de OBS y solo dice qué mensaje mandaría: '+JSON.stringify(r));
  r=await api('rules',{action:'test',rule:{ev:'kicks',steps:[]}});
  ok(r.ok===false, 'Probar sin pasos: error');
  // OBS apagado: los mensajes igual salen
  await post({action:'config',url:'ws://localhost:7799',pass:'pw'});
  b0=global.__calls.length;
  await hook('kicks.gifted',{sender:{username:'luz'},gift:{amount:150}},'k4'); await W(150);
  ch=global.__calls.slice(b0).filter(c=>c.u==='chat').map(c=>c.b.content);
  r=await api(RK);
  ok(ch.join()==='¡Gracias luz por los 150 Kicks!' && r.log[0].ok===false && /conectar con OBS/.test(r.log[0].e), 'OBS apagado: el mensaje sí sale y avisa el error ('+r.log[0].e+')');
  await post({action:'config',url:'ws://localhost:7720',pass:'pw'});
  // en Vercel: contesta a Kick al momento y la regla sigue
  const held=[]; globalThis[Symbol.for('@vercel/request-context')]={get:()=>({waitUntil:p=>held.push(p)})};
  O.scenes.LIVE[2].on=true; tt=Date.now();
  await hook('kicks.gifted',{sender:{username:'rico2'},gift:{amount:6000}},'k5');
  const fast=Date.now()-tt;
  ok(fast<700 && held.length===1, 'con waitUntil le contesta a Kick sin esperar ('+fast+' ms)');
  await Promise.all(held); delete globalThis[Symbol.for('@vercel/request-context')];
  ok(O.scenes.LIVE[2].on===true, 'y la regla terminó después');
  // apagadas
  r=await api(RK); r=await api('rules',{action:'save',cfg:Object.assign({},r.cfg,{on:false})});
  b0=global.__calls.length;
  await hook('kicks.gifted',{sender:{username:'zz'},gift:{amount:900}},'k6'); await W(80);
  ok(!global.__calls.slice(b0).some(c=>c.u==='chat'), 'reglas apagadas: nada');
  // la regla de mostrar en el feed apagada: el feed no se llena (pero los errores sí salen)
  r=await api('rules',{action:'save',cfg:Object.assign({},r.cfg,{on:true,feed:false})});
  const nBefore=(await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json())).events.filter(e=>e.d&&e.d.kind==='rule').length;
  await hook('kicks.gifted',{sender:{username:'zz2'},gift:{amount:900}},'k7'); await W(80);
  const nAfter=(await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json())).events.filter(e=>e.d&&e.d.kind==='rule').length;
  ok(nAfter===nBefore, 'sin avisos en el feed (si así lo eliges)');
  // el chat normal no pregunta por las reglas
  const cmdsB=(global.__cmds||[]).length;
  await chatHook('c9','viewer9','hola que tal',[]); await W(60);
  ok(!(global.__cmds||[]).slice(cmdsB).some(c=>c[1]==='rules'), 'los mensajes del chat no consultan las reglas');
  ok(dels.join()==='s1,s2,s3', 'los mensajes del bot nuevo se borran: '+dels.join());

  /* ===== v65: subs solo en vivo, meta a mano y totales que casi no gastan ===== */
  for (const k of Object.keys(global.__kvref)) if (/^(session|live|subAdj)$/.test(k)) delete global.__kvref[k];
  global.__z.ev=[];
  const T0=Date.now();
  // una renovación de madrugada (stream apagado)…
  await hook('channel.subscription.renewal',{subscriber:{username:'madrugador'},duration:5,created_at:new Date(T0-30*86400e3).toISOString()},'rn1'); await W(50);
  // (llegó hace 10 horas: se mueve su hora en la base de prueba)
  global.__z.ev=global.__z.ev.map(([sc,v])=>{ const e=JSON.parse(v); if (e.id==='rn1'){ e.rt=T0-10*3600e3; e.ts=e.rt; return [e.rt, JSON.stringify(e)]; } return [sc,v]; }).sort((a,b)=>a[0]-b[0]);
  // …y en la tarde empieza el stream
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(T0+1000).toISOString(),title:'IRL'},'lv1'); await W(50);
  let ev2=await fetch('http://localhost:7702/api/events?since=0&tot=1&key='+encodeURIComponent(key)).then(x=>x.json());
  ok(ev2.totals && ev2.totals.subs===0 && ev2.totals.offSubs===0, 'la renovación de la madrugada ya NO cuenta en el stream: '+JSON.stringify(ev2.totals));
  await W(1100);
  await hook('channel.subscription.new',{subscriber:{username:'nuevo1'},duration:1,created_at:new Date().toISOString()},'sn1');
  await hook('channel.subscription.renewal',{subscriber:{username:'resub1'},duration:3,created_at:new Date(Date.now()-30*86400e3).toISOString()},'rn2');
  ev2=await fetch('http://localhost:7702/api/events?since=0&tot=1&key='+encodeURIComponent(key)).then(x=>x.json());
  ok(ev2.totals.subs===2 && ev2.totals.newSubs===1 && ev2.totals.resubs===1, 'en vivo sí: 1 nueva + 1 renovación = 2: '+JSON.stringify(ev2.totals));
  // meta a mano
  const goal=b=>fetch('http://localhost:7702/api/goal',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({key},b))}).then(r=>r.json().then(j=>(j.__st=r.status,j)));
  let gq=await goal({delta:1});
  ok(gq.ok && gq.n===1 && gq.totals.subs===3 && gq.totals.real===2 && gq.totals.adj===1, '+1 a mano: la meta va en 3 (el real sigue en 2)');
  gq=await goal({delta:-2});
  ok(gq.ok && gq.n===-1 && gq.totals.subs===1, '−2: queda en 1');
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals.subs===1 && ev2.totals.adj===-1, 'el letrero de la meta (OBS) lo ve: '+ev2.totals.subs);
  gq=await goal({reset:true});
  ok(gq.ok && gq.n===0 && gq.totals.subs===2, '«quitar el ajuste»: vuelve al conteo real');
  ok((await goal({key:'mala',delta:1})).__st===403, 'sin clave no se puede');
  ev2=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json());
  ok(ev2.events.some(e=>e.d && e.d.kind==='goal' && e.d.delta===1 && e.d.subs===3), 'cada ajuste sale en el feed');
  // los totales ya calculados se reusan (el letrero cada 5 s casi no gasta)
  let c0=(global.__cmds||[]).length;
  await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  let used=(global.__cmds||[]).slice(c0).map(c=>c[0]);
  ok(used.join()==='MGET', 'el letrero de la meta: 1 sola consulta si no llegó nada nuevo ('+used.join()+')');
  // y si llega una sub, se recalcula al momento
  await hook('channel.subscription.new',{subscriber:{username:'nuevo2'},duration:1,created_at:new Date().toISOString()},'sn2');
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals.subs===3, 'llega otra sub: el total se pone al día al momento ('+ev2.totals.subs+')');
  // si llega un evento y el feed lo pide en ese mismo instante, no sale el total viejo
  const sinceNow=Date.now();
  await hook('channel.subscription.new',{subscriber:{username:'nuevo3'},duration:1,created_at:new Date().toISOString()},'sn3');
  ev2=await fetch('http://localhost:7702/api/events?key='+encodeURIComponent(key)+'&since='+sinceNow).then(x=>x.json());
  ok(ev2.events.length>=1 && ev2.totals && ev2.totals.subs===4, 'el feed recibe la sub nueva junto con el total correcto ('+(ev2.totals&&ev2.totals.subs)+')');
  // comando de mod con paso de meta
  r=await api('modcmd',{action:'save',cfg:{on:true,users:['crisriios16'],del:false,cmds:[{c:'!sub',steps:[{t:'goal',n:1}]},{c:'!nosub',steps:[{t:'goal',n:-1}]}]}});
  ok(r.cfg.cmds[0].steps[0].t==='goal' && r.cfg.cmds[0].steps[0].n===1, 'los comandos aceptan el paso «meta»');
  await W(3100);
  await chatHook('g1','CrisRiios16','!sub',[{type:'moderator'}]); await W(150);
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals.subs===5 && ev2.totals.adj===1, 'un mod escribe !sub y la meta sube 1 ('+ev2.totals.subs+')');
  // regla con paso de meta
  r=await api('rules',{action:'save',cfg:{on:true,feed:true,list:[{id:'gol1',ev:'follow',steps:[{t:'goal',n:1}]}]}});
  ok(r.cfg.list[0].steps[0].t==='goal', 'las reglas aceptan el paso «meta»');
  await hook('channel.followed',{follower:{username:'fx'}},'fg1'); await W(150);
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals.subs===6, 'regla: un follow suma 1 a la meta ('+ev2.totals.subs+')');
  r=await api('rules',{action:'test',rule:{ev:'follow',steps:[{t:'goal',n:5}]}});
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(r.ok && ev2.totals.subs===6, '▶ Probar no mueve la meta');
  // stream nuevo: el ajuste no pasa al siguiente
  await hook('livestream.status.updated',{is_live:false,ended_at:new Date().toISOString()},'lv2');
  global.__kvref['session']=JSON.stringify(Object.assign(JSON.parse(global.__kvref['session']),{lastEnd:Date.now()-40*60000}));
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(Date.now()+500).toISOString(),title:'IRL'},'lv3'); await W(700);
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals.adj===0 && ev2.totals.subs===ev2.totals.real && ev2.totals.from>T0+60000, 'el siguiente stream empieza sin el ajuste de antes: '+JSON.stringify(ev2.totals));

  /* ===== v68: con el stream apagado la meta se mueve al momento; cada stream empieza en 0 ===== */
  await hook('livestream.status.updated',{is_live:false,ended_at:new Date().toISOString()},'lv4');
  global.__kvref['session']=JSON.stringify(Object.assign(JSON.parse(global.__kvref['session']),{lastEnd:Date.now()-40*60000,live:false}));
  delete global.__kvref['subAdj'];
  gq=await goal({delta:1});
  ok(gq.ok && gq.off && gq.n===1 && gq.totals && gq.totals.subs===1, 'stream apagado: +1 se mueve al momento: '+JSON.stringify(gq));
  gq=await goal({delta:1});
  ok(gq.ok && gq.off && gq.totals.subs===2, 'otro +1: va en 2');
  let ov=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ov.totals && ov.totals.subs===2 && ov.totals.off, 'el letrero de OBS lo ve sin stream (2)');
  gq=await goal({delta:-1});
  ok(gq.ok && gq.totals.subs===1, 'y también se resta: 1');
  gq=await goal({delta:-5});
  ok(gq.ok && gq.totals.subs===0 && gq.n===-4, 'nunca baja de 0');
  gq=await goal({reset:true});
  ok(gq.ok && gq.totals.subs===0 && gq.n===0, '↺ vuelve a 0');
  gq=await goal({delta:3});
  ev2=await fetch('http://localhost:7702/api/events?since=0&key='+encodeURIComponent(key)).then(x=>x.json());
  ok(ev2.events.some(e=>e.d && e.d.kind==='goal' && e.d.off && e.d.subs===3), 'sale en el feed («sin stream»)');
  await W(50);
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(Date.now()+500).toISOString(),title:'IRL'},'lv5'); await W(700);
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals && ev2.totals.adj===0 && ev2.totals.subs===ev2.totals.real && !ev2.totals.off, 'empieza el stream: arranca en 0 (lo de prueba no pasa): '+JSON.stringify(ev2.totals));
  const real0=ev2.totals.real; gq=await goal({delta:1});
  ok(gq.ok && !gq.off && gq.n===1 && gq.totals.subs===real0+1, 'en vivo: +1 sobre lo real');
  await hook('livestream.status.updated',{is_live:false,ended_at:new Date().toISOString()},'lv6');
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals && ev2.totals.subs===real0+1, 'recién terminado (menos de 30 min): sigue mostrando lo del stream');
  global.__kvref['session']=JSON.stringify(Object.assign(JSON.parse(global.__kvref['session']),{lastEnd:Date.now()-40*60000,live:false}));
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(!ev2.totals || ev2.totals.subs===0, 'ya apagado: el letrero en 0');
  await hook('livestream.status.updated',{is_live:true,started_at:new Date(Date.now()+500).toISOString(),title:'IRL'},'lv7'); await W(700);
  ev2=await fetch('http://localhost:7702/api/events?since=9999999999999&tot=1').then(x=>x.json());
  ok(ev2.totals && ev2.totals.adj===0, 'el stream siguiente empieza en 0');
  console.log(fails?('\n'+fails+' FALLAS'):'\nTODO BIEN');
  process.exit(fails?1:0);
});
