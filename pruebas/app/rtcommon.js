const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
// rutas comunes: el SDK falso de Ably y el ping que contesta por «Ably»
const fs=require('fs');
const FAKE=fs.readFileSync(__dirname+'/fakeably.js','utf8');
async function ablyRoutes(ctx, S){
  S.rtCalls=S.rtCalls||[]; if (S.pingWorks===undefined) S.pingWorks=true;
  await ctx.route('https://cdn.jsdelivr.net/npm/ably@2.29.0/**', r=>{ S.sdkLoads=(S.sdkLoads||0)+1; if (S.noSdk) return r.fulfill({status:404,body:''}); return r.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:FAKE}); });
  await ctx.route('https://unpkg.com/**', r=>{ S.unpkg=(S.unpkg||0)+1; return r.fulfill({status:404,body:''}); });
}
// /api/rt dentro de la ruta del servidor
function rtHandle(u, r, S, pageRef){
  const H={'access-control-allow-origin':'*'};
  if (u.pathname!=='/api/rt') return false;
  S.rtCalls.push(u.search);
  if (u.searchParams.get('a')==='ping'){
    const id=u.searchParams.get('id');
    if (S.pingWorks) setTimeout(()=>{ pageRef.p && pageRef.p.evaluate(id=>window.__ablyEmit && window.__ablyEmit('ping',{id}), id).catch(()=>{}); }, 120);
    r.fulfill({status:200,headers:H,contentType:'application/json',body:'{"ok":true}'}); return true;
  }
  r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({keyName:'a.b',ttl:1,capability:'{"kf":["subscribe"]}',timestamp:1,nonce:'n',mac:'m'})}); return true;
}
module.exports={ablyRoutes, rtHandle};
