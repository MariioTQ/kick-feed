const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// v83: 💬 widget de chat para OBS y 🎨 Chat Studio (/api/chatobs). Base, Kick, Twitch y Ably simulados.
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
process.env.KV_REST_API_URL='http://kv.prueba'; process.env.KV_REST_API_TOKEN='x';
process.env.ABLY_API_KEY='abc123.def456:SeCrEtAbLy_xyz';
process.env.TWITCH_CLIENT_ID='tid'; process.env.TWITCH_CLIENT_SECRET='tsecret';
const kv={ feedkey:'CLAVE', 'tw:tok':JSON.stringify({user_id:'135201683',login:'mariotq'}),
  spam:JSON.stringify({on:true,list:['palabrasecreta']}), rtkey:JSON.stringify({app_key:'llaveKick',cluster:'us2',at:Date.now()}) };
const ably=[]; let redisN=0, helixN=0;
global.fetch=async (url,opts={})=>{ url=String(url);
  const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
  if (url.startsWith('http://kv.prueba')){ redisN++; const c=JSON.parse(opts.body); let r=null;
    if (c[0]==='GET') r=kv[c[1]]===undefined?null:kv[c[1]]; else if (c[0]==='SET'){ kv[c[1]]=c[2]; r='OK'; } else if (c[0]==='MGET') r=c.slice(1).map(k=>kv[k]===undefined?null:kv[k]);
    return J({result:r}); }
  if (/ably/.test(url)){ const b=JSON.parse(opts.body); ably.push({name:b[0].name, data:JSON.parse(b[0].data)}); return J({},201); }
  if (url.startsWith('https://id.twitch.tv/oauth2/token')) return J({access_token:'APP',expires_in:5000000});
  if (url.startsWith('https://api.twitch.tv/helix/chat/badges')){ helixN++;
    return J({data:[{set_id:'vip',versions:[{id:'1',image_url_2x:'vip2',title:'VIP'}]},{set_id:'subscriber',versions:[{id:'0',image_url_2x:'sub2',title:'Sub'}]}]}); }
  return J({},404);
};
const handler=require(RAIZ+'/api/[route].js');
function call(method, a, body){
  return new Promise(res=>{ const r={headers:{},statusCode:0,setHeader(k,v){ this.headers[k.toLowerCase()]=v; },
      end(b){ let j={}; try{ j=JSON.parse(b||'{}'); }catch(e){} res({code:this.statusCode,h:this.headers,j,raw:String(b||'')}); }};
    handler({method, headers:{}, query:Object.assign({route:'chatobs'}, a?{a}:{}), body:body?JSON.stringify(body):undefined}, r); });
}
(async()=>{
  // A) lo público: sin clave, solo lo que necesita el widget
  let r=await call('GET');
  ok(r.code===200 && r.j.ok && r.j.kick.key==='llaveKick' && r.j.kick.chatroom==='6635680', 'el widget recibe la llave pública del chat de Kick');
  ok(r.j.tw.login==='mariotq' && r.j.tw.id==='135201683' && r.j.twb['vip/1']==='vip2' && r.j.twb['subscriber/0']==='sub2', 'y las imágenes de las insignias de Twitch');
  ok(r.j.set && r.j.set.estilo==='linea' && r.j.set.tam===20 && r.j.set.fade===30 && r.j.set.bots.indexOf('botrix')>=0, 'sin ajustes guardados salen los de fábrica');
  ok(!/palabrasecreta|SeCrEt|tsecret|CLAVE|APP"/.test(r.raw), 'no regresa el spam, ni llaves, ni la clave');
  ok(/s-maxage=60/.test(r.h['cache-control']||''), 'Vercel lo guarda 1 min: casi no gasta ('+r.h['cache-control']+')');
  // B) leer, guardar y probar piden la clave
  for (const a of ['get','save','test']){ r=await call('POST', a, {key:'mala', set:{tam:30}}); ok(r.code===403, a+' sin tu clave: no'); }
  r=await call('GET', 'save'); ok(r.code===405, 'guardar solo con POST');
  // C) guardar: se limpia lo que no sirve y se avisa por Ably
  const n0=ably.length;
  r=await call('POST','save',{key:'CLAVE', set:{estilo:'burbuja', tam:999, fuente:'Hack<script>', colTexto:'red', fondo:0.4, sombra:2, peso:900, anim:'lado',
     ocultar:'@Pepe, juan<b>, PEPE', palabras:'feo\n x \nspam total', bots:['NightBot'], arriba:'si', fade:-5, max:200, links:true, cmd:true, pf:'tw', extra:'no'}});
  const s=r.j.set||{};
  ok(r.j.ok && s.estilo==='burbuja' && s.tam===80 && s.fuente==='Segoe UI' && s.colTexto==='#ffffff' && s.fondo===0.4 && s.sombra===2 && s.peso===900 && s.anim==='lado', 'guarda el diseño y corrige lo que no vale (tamaño 999 → 80, letra rara → la de fábrica)');
  ok(JSON.stringify(s.ocultar)==='["pepe","juanb"]' && JSON.stringify(s.palabras)==='["feo","spam total"]' && JSON.stringify(s.bots)==='["nightbot"]', 'las listas quedan limpias, sin repetidos ni @');
  ok(s.arriba===false && s.fade===0 && s.max===60 && s.links===true && s.cmd===true && s.pf==='tw' && s.extra===undefined, 'lo demás se acota');
  ok(ably.length===n0+1 && ably[n0].name==='chatobs' && ably[n0].data.set.estilo==='burbuja' && r.j.live===true, 'le avisa al widget por Ably al momento');
  r=await call('GET'); ok(r.j.set.estilo==='burbuja' && r.j.set.tam===80, 'el widget lo lee al abrir');
  r=await call('POST','get',{key:'CLAVE'}); ok(r.j.ok && r.j.set.pf==='tw' && r.j.rt===true && r.j.fonts.indexOf('Poppins')>=0, 'Chat Studio lee lo guardado');
  // D) «Probar en OBS»
  r=await call('POST','test',{key:'CLAVE'}); ok(r.j.ok && ably.at(-1).name==='chatobs' && ably.at(-1).data.test===1, '«Probar en OBS» manda los mensajes de ejemplo por Ably');
  // E) las insignias de Twitch salen de la caché de la base, no de Twitch cada vez
  const h0=helixN; await call('GET'); await call('GET'); ok(helixN===h0, 'las insignias no se le piden a Twitch cada vez');
  console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
  process.exit(0);
})().catch(e=>{ console.log('FAIL Error '+e.message); process.exit(1); });
