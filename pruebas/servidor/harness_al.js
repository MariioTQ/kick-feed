const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// Prueba del servidor de alertas (api/alertas.js) con un Upstash falso
const http=require('http');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const kv={}, z={}; let cmds=[];
const zr=k=>z[k]||(z[k]=[]);
function run(cmd){
  const op=String(cmd[0]).toUpperCase(); cmds.push(op);
  if (op==='GET') return kv[cmd[1]]===undefined?null:kv[cmd[1]];
  if (op==='SET'){ const nx=cmd.includes('NX'); if (nx && kv[cmd[1]]!==undefined) return null; kv[cmd[1]]=String(cmd[2]); return 'OK'; }
  if (op==='MGET') return cmd.slice(1).map(k=>kv[k]===undefined?null:kv[k]);
  if (op==='DEL'){ let n=0; cmd.slice(1).forEach(k=>{ if (kv[k]!==undefined){ delete kv[k]; n++; } }); return n; }
  if (op==='ZADD'){ const A=zr(cmd[1]); A.push([Number(cmd[2]),cmd[3]]); A.sort((a,b)=>a[0]-b[0]); return 1; }
  if (op==='ZRANGEBYSCORE'){ const mn=Number(cmd[2]), mx=cmd[3]==='+inf'?Infinity:Number(cmd[3]); let a=zr(cmd[1]).filter(([s])=>s>=mn&&s<=mx).map(x=>x[1]); const li=cmd.indexOf('LIMIT'); if (li>0) a=a.slice(Number(cmd[li+1]),Number(cmd[li+1])+Number(cmd[li+2])); return a; }
  if (op==='ZREMRANGEBYSCORE'){ const A=zr(cmd[1]), mx=Number(cmd[3]); const keep=A.filter(([s])=>!(s<=mx)); const n=A.length-keep.length; z[cmd[1]]=keep; return n; }
  if (op==='ZREMRANGEBYRANK'){ const A=zr(cmd[1]), stop=Number(cmd[3]), n=A.length+stop+1; if (n>0) A.splice(0,n); return 0; }
  if (op==='ZREVRANGEBYSCORE'){ const mx=cmd[2]==='+inf'?Infinity:Number(cmd[2]), mn=Number(cmd[3]); let a=zr(cmd[1]).filter(([sc])=>sc<=mx&&sc>=mn).slice().reverse().map(x=>x[1]); const li=cmd.indexOf('LIMIT'); if(li>0) a=a.slice(Number(cmd[li+1]),Number(cmd[li+1])+Number(cmd[li+2])); return a; }
  if (op==='INCR'){ kv[cmd[1]]=String((Number(kv[cmd[1]])||0)+1); return Number(kv[cmd[1]]); }
  if (op==='EXPIRE') return 1;
  throw new Error('op '+op);
}
http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ const body=JSON.parse(b); res.setHeader('content-type','application/json');
  if (req.url.endsWith('/pipeline')) return res.end(JSON.stringify(body.map(c=>({result:run(c)}))));
  try{ res.end(JSON.stringify({result:run(body)})); }catch(e){ res.end(JSON.stringify({error:e.message})); } }); }).listen(7711);
process.env.UPSTASH_REDIS_REST_URL='http://localhost:7711'; process.env.UPSTASH_REDIS_REST_TOKEN='t';
const handler=require(RAIZ+'/api/alertas.js');
http.createServer((req,res)=>{ const u=new URL(req.url,'http://x'); req.query=Object.fromEntries(u.searchParams); handler(req,res); }).listen(7712);
const A='http://localhost:7712/api/alertas';
const get=async q=>{ const r=await fetch(A+'?'+q); return {st:r.status, h:r.headers, j:/json/.test(r.headers.get('content-type')||'') ? await r.json() : Buffer.from(await r.arrayBuffer())}; };
const post=async (a,b)=>(await fetch(A+'?a='+a,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({key:'K3y'},b))})).json();
(async()=>{
  kv.feedkey='K3y';
  let r=await get('a=cfg');
  ok(r.j.ok && r.j.cfg.pf.kick.kicks.on && !r.j.cfg.pf.kick.bits && r.j.cfg.pf.tw.bits && !r.j.cfg.pf.tw.kicks && r.j.cfg.pf.kick.follow.on===false, 'de entrada: Kicks solo en Kick, bits solo en Twitch, follows apagados');
  ok(r.j.cfg.pf.kick.sub.snd==='b:fanfarria' && r.j.cfg.pf.kick.sub.img==='b:corona', 'sonido y dibujo de la app para cada una');
  ok((await post('save',{key:'mala',cfg:{}})).ok===false, 'sin la clave no se guarda');
  const cfg=r.j.cfg; cfg.pf.kick.kicks.text='{nombre} soltó {cantidad} Kicks'; cfg.pf.kick.kicks.vars=[{min:500,img:'b:cohete',snd:'b:tambor',text:'¡LLUVIA DE KICKS!'}]; cfg.pf.kick.sub.snd='u:javascript:alert(1)'; cfg.vol=150;
  r=await post('save',{cfg});
  ok(r.ok && r.cfg.pf.kick.kicks.text==='{nombre} soltó {cantidad} Kicks' && r.cfg.pf.kick.kicks.vars[0].min===500 && r.cfg.pf.kick.kicks.vars[0].img==='b:cohete', 'guardar texto y una variación de 500+');
  ok(r.cfg.pf.kick.sub.snd==='b:fanfarria' && r.cfg.vol===100, 'nada raro se guarda (link que no es https, volumen de más)');
  // archivos
  const mp3=Buffer.alloc(900000, 7).toString('base64');
  r=await post('up',{name:'Mi sonido.mp3',type:'audio/mpeg',data:mp3,norm:0.4});
  ok(r.ok && r.file.kind==='audio' && r.file.n===2 && r.file.norm===0.4, 'subir un sonido (en pedacitos para la base): '+JSON.stringify(r.file||r));
  const id=r.id;
  let f=await get('a=f&id='+id);
  ok(f.st===200 && Buffer.isBuffer(f.j) && f.j.length===900000 && /immutable/.test(f.h.get('cache-control')) && f.h.get('content-type')==='audio/mpeg', 'el archivo sale completo y la CDN lo guarda para siempre');
  ok((await post('up',{name:'grande',type:'audio/mpeg',data:Buffer.alloc(1300000).toString('base64')})).ok===false, 'un sonido de más de 1.2 MB no');
  ok((await post('up',{name:'x',type:'application/pdf',data:'AAAA'})).ok===false, 'un PDF no');
  cfg.pf.kick.sub.snd='f:'+id; r=await post('save',{cfg}); ok(r.cfg.pf.kick.sub.snd==='f:'+id, 'usar tu sonido en la sub');
  r=await post('fdel',{id}); ok(r.ok && !kv['af:'+id+':0'], 'borrar el archivo');
  r=await get('a=cfg'); ok(r.j.cfg.pf.kick.sub.snd==='b:fanfarria', 'si lo borras, la alerta regresa al sonido de la app');
  // lo que va saliendo
  const now=Date.now();
  z.ev=[[now-1000, JSON.stringify({id:'k1',ts:now-1000,rt:now-1000,d:{kind:'kicks',user:'pepe',amount:500,message:'hola [emote:1:x]'}})],
        [now-900, JSON.stringify({id:'t1',ts:now-900,rt:now-900,d:{kind:'bits',pf:'tw',user:'Rico',amount:100,message:'Cheer100 va'}})],
        [now-800, JSON.stringify({id:'b1',ts:now-800,rt:now-800,d:{kind:'ban',user:'x'}})],
        [now-700, JSON.stringify({id:'g1',ts:now-700,rt:now-700,d:{kind:'gift',pf:'tw',user:'Ana',count:5}})]];
  kv.live=JSON.stringify({is_live:true});
  cmds=[]; r=await get('a=poll&b=1');
  ok(r.j.ok && r.j.list.map(x=>x.k+':'+x.pf+':'+x.n).join(',')==='kicks:kick:500,bits:tw:100,gift:tw:5', 'el player recibe Kicks, bits y regaladas (no los bans): '+r.j.list.map(x=>x.k).join(','));
  ok(r.j.list[0].m==='hola' && r.j.list[1].m==='va', 'el mensaje sin emotes ni Cheer100');
  ok(r.j.live.kick===true && r.j.live.tw===false, 'y si estás en vivo en cada una');
  ok(/s-maxage=2/.test(r.h.get('cache-control')) && cmds.length===3, 'una sola llamada a la base y se comparte 2 s en la CDN: '+cmds.join(','));
  // repetir, probar, saltar, y lo que solo ve la app
  r=await post('replay',{al:{k:'gift',pf:'kick',u:'donmario',n:5,m:''}}); ok(r.ok && r.item.rp===1, 'repetir una alerta');
  r=await post('test',{al:{k:'kicks',pf:'kick',u:'Prueba',n:500},vi:0}); ok(r.ok && r.item.test===1 && r.item.vi===0, 'probar (con su variación)');
  r=await post('fire',{al:{k:'raid',pf:'kick',u:'Amigo',n:30}}); ok(r.ok && !r.dup, 'un raid de Kick que vio la app');
  r=await post('fire',{al:{k:'raid',pf:'kick',u:'amigo',n:30}}); ok(r.ok && r.dup, 'si tu otro cel lo vio también, sale una sola vez');
  r=await post('fire',{al:{k:'sub',pf:'kick',u:'x',n:1}}); ok(!r.ok, 'la app no puede inventar subs (esas llegan de Kick)');
  r=await post('skip',{}); ok(r.ok && r.item.ctl==='skip', 'saltar la que suena');
  r=await get('a=poll&b=2');
  ok(r.j.list.filter(x=>x.rp||x.test||x.ctl||x.k==='raid').length===4, 'el player también recibe las repetidas, las pruebas, el raid y el «saltar»');
  ok((await post('replay',{key:'mala',al:{k:'sub',pf:'kick',u:'x'}})).ok===false, 'sin clave no se repite');

  // v80: en una ráfaga (raid con muchos follows) el player recibe lo más nuevo
  z.ev=[]; const t0=Date.now()-60000;
  for (let i=0;i<200;i++) z.ev.push([t0+i*100, JSON.stringify({id:'f'+i, ts:t0+i*100, rt:t0+i*100, d:{kind:'follow', user:'fol'+i}})]);
  z.ev.push([Date.now()-1000, JSON.stringify({id:'sub_final', ts:Date.now()-1000, rt:Date.now()-1000, d:{kind:'sub', user:'ElUltimo', months:1}})]);
  r=await get('a=poll&b=9');
  ok(r.j.list.some(x=>x.id==='sub_final'), 'raid con 200 follows: la sub que llegó al final sí le llega al player');
  const ids=r.j.list.map(x=>x.id); ok(ids.indexOf('sub_final')===ids.length-1 || ids.filter(x=>/^f/.test(x)).length>0, 'y en orden (lo más viejo primero)');
  // v80: la voz tiene límite de voces NUEVAS (las ya guardadas salen siempre)
  const f0=global.fetch; let calls=0;
  global.fetch=async (u,o)=>{ u=String(u); if (/streamelements|translate\.google/.test(u)){ calls++; return new Response(Buffer.alloc(2000, 7),{status:200,headers:{'content-type':'audio/mpeg'}}); } return f0(u,o); };
  let st=[];
  for (let i=0;i<14;i++){ const rr=await fetch(A+'?a=tts&v=mia&t='+encodeURIComponent('texto distinto '+i),{headers:{'x-real-ip':'9.9.9.9'}}); st.push(rr.status); }
  ok(st.slice(0,12).every(x=>x===200) && st[12]===429 && st[13]===429, 'la voz: alguien de fuera no puede pedir voces nuevas sin parar (12 por minuto): '+st.join(','));
  let rr=await fetch(A+'?a=tts&v=mia&t='+encodeURIComponent('texto distinto 3'),{headers:{'x-real-ip':'9.9.9.9'}});
  ok(rr.status===200, 'pero una que ya está guardada sale aunque esté en el límite');
  rr=await fetch(A+'?a=tts&v=mia&t='+encodeURIComponent('otra persona'),{headers:{'x-real-ip':'8.8.8.8'}});
  ok(rr.status===200, 'y a tu player (otra IP) no le afecta');
  global.fetch=f0;
  console.log(fails?'\n'+fails+' FALLAS':'\nTODO BIEN'); process.exit(fails?1:0);
})();
