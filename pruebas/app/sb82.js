const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
const {chromium}=require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
const H={'access-control-allow-origin':'*'};
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const S={posts:[], jobs:[]};
const ctx=await b.newContext({viewport:{width:400,height:300}});
await ctx.addInitScript(()=>{
  window.obsstudio={getCurrentScene(cb){ setTimeout(()=>cb({name:'LIVE'}),10); }, getStatus(cb){ setTimeout(()=>cb({streaming:true}),10); }};
  window.__ws=[]; window.__sbDo=[]; window.__sbFail={};
  window.WebSocket=function(u){ const w={url:u,readyState:0,sent:[],send(x){ w.sent.push(x);
      if (/pusher/.test(u)){ const m=JSON.parse(x); if (m.event==='pusher:subscribe') setTimeout(()=>w.onmessage({data:JSON.stringify({event:'pusher_internal:subscription_succeeded',channel:m.data.channel,data:'{}'})}),20); }
      else if (/^JOIN /.test(x)) setTimeout(()=>w.onmessage({data:':justinfan1.tmi.twitch.tv 366 justinfan1 #mariotq :End\r\n'}),20);
      else if (/127\.0\.0\.1:8080/.test(u)){ const m=JSON.parse(x); window.__sbDo.push(m); setTimeout(()=>w.onmessage({data:JSON.stringify(window.__sbFail[m.action.name] ? {id:m.id,status:'error',error:'Action not found'} : {id:m.id,status:'ok'})}),30); }
    }, close(){ w.readyState=3; w.onclose&&w.onclose({code:1000}); }};
    window.__ws.push(w);
    setTimeout(()=>{ w.readyState=1; w.onopen&&w.onopen();
      if (/pusher/.test(u)) w.onmessage({data:JSON.stringify({event:'pusher:connection_established',data:JSON.stringify({socket_id:'1.1'})})});
      if (/127\.0\.0\.1:8080/.test(u)) setTimeout(()=>w.onmessage({data:JSON.stringify({request:'Hello',info:{instanceId:'x',name:'SB'}})}),20);
    },30);
    return w; };
  window.kickEv=(ev,ch,data)=>{ const w=window.__ws.find(x=>/pusher/.test(x.url)); w.onmessage({data:JSON.stringify({event:ev,channel:ch,data:JSON.stringify(data)})}); };
});
await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{
  const u=new URL(r.request().url()); let body={}; try{ body=JSON.parse(r.request().postData()||'{}'); }catch(e){}
  const J=o=>r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
  if (u.searchParams.get('a')==='cfg') return J({ok:true,kick:{chatroom:'6635680',channel:'6692133',key:'abc123',cluster:'us2'},tw:{login:'mariotq'},spam:{on:true,list:[]}});
  S.posts.push({at:Date.now(), body});
  const o={ok:true,n:0,want:false,hooks:{kick:'off',tw:'off'}}; if (S.jobs.length) o.sb=S.jobs.splice(0);
  return J(o);
});
const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.goto('file://'+RAIZ+'/guardia.html?w=TOK&api=https://kick-feed-mariotq.vercel.app'); await W(4500);
const last=()=>S.posts[S.posts.length-1].body;
ok(last().st && last().st.sb && last().st.sb.up===true, 'le dice a tu servidor que Streamer.bot está conectado: '+JSON.stringify(last().st.sb));
ok(await page.evaluate(()=>document.getElementById('sb').textContent).then(t=>/conectado/.test(t)), 'en la guardia se ve «Streamer.bot ✓ conectado»');
// una recompensa de Kick: se manda con el id del canje y a los 4 s vuelve a preguntar (para recoger el VIP)
const n0=S.posts.length;
S.jobs.push({id:'j1',a:'KF VIP Kick dar',args:{user:'Pepe'},exp:Date.now()+3600e3});
await page.evaluate(()=>window.kickEv('RewardRedeemedEvent','channel.6692133',{id:'01RED',reward_title:'Vip Mini',username:'Pepe',user_input:''}));
await W(1200);
const rw=S.posts.slice(n0).map(p=>p.body.msgs||[]).flat().find(m=>m.reward);
ok(rw && rw.reward.rid==='01RED', 'la recompensa lleva el id del canje (para devolver puntos): '+JSON.stringify(rw && rw.reward));
await W(600);
const doVip=await page.evaluate(()=>window.__sbDo.slice());
ok(doVip.length===1 && doVip[0].request==='DoAction' && doVip[0].action.name==='KF VIP Kick dar' && doVip[0].args.user==='Pepe', 'le pide a Streamer.bot la acción con el usuario: '+JSON.stringify(doVip));
// otra sin recompensa: se recoge con el siguiente envío (al 4 s del nudge)
S.jobs.push({id:'j2',a:'KF Solo emotes Kick',args:{enable:true},exp:Date.now()+90000},{id:'j3',a:'No existe',args:{},exp:Date.now()+90000},{id:'j4',a:'Vieja',args:{},exp:Date.now()-1000});
await W(4500);
const all=await page.evaluate(()=>window.__sbDo.map(x=>x.action.name));
ok(all.indexOf('KF Solo emotes Kick')>0 && all.indexOf('No existe')>0 && all.indexOf('Vieja')<0, 'hace las que siguen en orden y no hace la caducada: '+JSON.stringify(all));
await page.evaluate(()=>{ window.__sbFail['No existe']=1; });
S.jobs.push({id:'j5',a:'No existe',args:{user:'X'},exp:Date.now()+90000});
await page.evaluate(()=>window.guardia.flush()); await W(800); await page.evaluate(()=>window.guardia.flush()); await W(3000);
const sbr=S.posts.map(p=>p.body.sbr||[]).flat();
ok(sbr.some(x=>x.id==='j5' && x.ok===false && /not found/i.test(x.e)) && sbr.some(x=>x.id==='j4' && /tardó/.test(x.e)), 'lo que falló regresa a tu servidor (sale en el feed): '+JSON.stringify(sbr));
// se cae Streamer.bot: lo avisa y los trabajos esperan
await page.evaluate(()=>{ const w=window.__ws.filter(x=>/127\.0\.0\.1/.test(x.url)).pop(); w.close(); });
await W(800);
ok(last().st.sb.up===false, 'si Streamer.bot se cierra, la guardia lo dice al momento');
ok(errs.length===0, 'sin errores: '+errs.join(' | '));
// ?sb=0 apaga
const p2=await ctx.newPage(); await p2.goto('file://'+RAIZ+'/guardia.html?w=TOK&sb=0&api=https://kick-feed-mariotq.vercel.app'); await W(3500);
const sbWs=await p2.evaluate(()=>window.__ws.filter(x=>/8080/.test(x.url)).length);
ok(sbWs===0 && await p2.evaluate(()=>document.getElementById('sb').textContent)==='apagado', 'con ?sb=0 ni lo busca');
await ctx.close(); console.log(fails ? fails+' FALLAS' : 'TODO BIEN'); await b.close(); process.exit(0);
})();
