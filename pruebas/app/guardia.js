const RAIZ=require('path').resolve(__dirname,'../..');   // la carpeta del repo
const {chromium}=require('playwright');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const W=ms=>new Promise(r=>setTimeout(r,ms));
const H={'access-control-allow-origin':'*'};
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
const S={posts:[], cfgN:0, fail:false, forbid:false};
const ctx=await b.newContext({viewport:{width:400,height:200}});
await ctx.addInitScript(()=>{
  window.obsstudio={getCurrentScene(cb){ setTimeout(()=>cb({name:'LIVE',width:1920,height:1080}),10); }, getStatus(cb){ setTimeout(()=>cb({streaming:false,recording:false}),10); }};
  window.__ws=[];
  window.WebSocket=function(u){ const w={url:u,readyState:0,sent:[],send(x){ w.sent.push(x);
      if (/pusher/.test(u)){ const m=JSON.parse(x); if (m.event==='pusher:subscribe') setTimeout(()=>w.onmessage({data:JSON.stringify({event:'pusher_internal:subscription_succeeded',channel:m.data.channel,data:'{}'})}),20); }
      else if (/^JOIN /.test(x)) setTimeout(()=>w.onmessage({data:':justinfan1.tmi.twitch.tv 366 justinfan1 #mariotq :End of /NAMES list\r\n'}),20);
    }, close(){ w.readyState=3; w.onclose&&w.onclose({code:1000}); }};
    window.__ws.push(w);
    setTimeout(()=>{ w.readyState=1; w.onopen&&w.onopen(); if (/pusher/.test(u)) w.onmessage({data:JSON.stringify({event:'pusher:connection_established',data:JSON.stringify({socket_id:'1.1'})})}); },30);
    return w; };
  window.kickEv=(ev,ch,data)=>{ const w=window.__ws.find(x=>/pusher/.test(x.url)); w.onmessage({data:JSON.stringify({event:ev,channel:ch,data:JSON.stringify(data)})}); };
  window.kick=(data)=>{ const w=window.__ws.find(x=>/pusher/.test(x.url)); w.onmessage({data:JSON.stringify({event:'App\\Events\\ChatMessageEvent',channel:'chatrooms.6635680.v2',data:JSON.stringify(data)})}); };
  window.irc=(line)=>{ const w=window.__ws.find(x=>/irc-ws/.test(x.url)); w.onmessage({data:line+'\r\n'}); };
});
await ctx.route('https://kick-feed-mariotq.vercel.app/**', r=>{
  const u=new URL(r.request().url()); let body={}; try{ body=JSON.parse(r.request().postData()||'{}'); }catch(e){}
  const J=(o,st)=>r.fulfill({status:st||200,headers:H,contentType:'application/json',body:JSON.stringify(o)});
  if (S.forbid) return J({ok:false,error:'Este link de la guardia ya no sirve'},403);
  if (u.searchParams.get('a')==='cfg'){ S.cfgN++; return J({ok:true,kick:{chatroom:'6635680',channel:'6692133',key:'abc123',cluster:'us2'},tw:{login:'mariotq'},spam:{on:true,list:['botkiva','zero cost upgrades']}}); }
  if (S.fail) return r.fulfill({status:500,headers:H,body:'x'});
  S.posts.push({at:Date.now(), body}); return J({ok:true,n:(body.msgs||[]).length,want:false,hooks:{kick:'off',tw:'on'}});
});
const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.goto('file://'+RAIZ+'/guardia.html?w=TOKEN123&api=https://kick-feed-mariotq.vercel.app'); await W(4000);
ok(S.cfgN===1, 'pide su configuración a tu servidor (con el link)');
let ws=await page.evaluate(()=>window.__ws.map(w=>({u:w.url,s:w.sent})));
ok(ws.some(w=>/ws-us2\.pusher\.com\/app\/abc123/.test(w.u) && w.s.some(x=>/chatrooms\.6635680\.v2/.test(x))), 'se conecta al chat de Kick (Pusher) con la llave que da tu servidor');
ok(ws.some(w=>/irc-ws\.chat\.twitch\.tv/.test(w.u) && w.s.indexOf('JOIN #mariotq')>=0 && w.s.some(x=>/^NICK justinfan\d+$/.test(x))), 'y al de Twitch sin cuenta (solo lee)');
let st=await page.evaluate(()=>({k:document.getElementById('sk').textContent,t:document.getElementById('st').textContent}));
ok(/leyendo/.test(st.k) && /leyendo/.test(st.t), 'recuadro: '+JSON.stringify(st));
ok(S.posts.length>=1 && S.posts[0].body.w==='TOKEN123' && S.posts[0].body.st.kick.up===true && S.posts[0].body.st.tw.up===true, 'avisa a tu servidor que ya está leyendo las dos');
let p0=S.posts.length;
// normal: espera la tanda
await page.evaluate(()=>window.kick({id:'k1',chatroom_id:6635680,content:'hola banda [emote:123:wave]',type:'message',created_at:'2026-11-02T00:00:00Z',sender:{id:9,username:'pepe',identity:{color:'#ff0',badges:[]}}}));
await W(1500);
ok(S.posts.length===p0, 'un mensaje normal no se manda luego luego (se junta en la tanda)');
// comando de mod: al momento
await page.evaluate(()=>window.kick({id:'k2',content:'!brb',type:'message',created_at:'2026-11-02T00:00:01Z',sender:{id:10,username:'ModGuy',identity:{color:'',badges:[{type:'moderator',text:'Moderator'}]}}}));
await W(900);
let last=S.posts[S.posts.length-1];
ok(S.posts.length===p0+1 && last.body.msgs.length===2 && last.body.msgs[1].p.content==='!brb' && last.body.msgs[1].p.sender.identity.badges[0].type==='moderator', 'comando de un mod: se manda al momento (junto con lo que había)');
ok(last.body.msgs[0].pf==='kick' && last.body.msgs[0].p.message_id==='k1' && last.body.msgs[0].p.sender.username==='pepe' && last.body.msgs[0].p.sender.user_id===9 && /\[emote:123:wave\]/.test(last.body.msgs[0].p.content), 'el mensaje de Kick va igual que el aviso oficial de Kick');
// respuesta en Kick
await page.evaluate(()=>window.kick({id:'k3',content:'@pepe sí',type:'reply',created_at:'2026-11-02T00:00:02Z',sender:{id:11,username:'Ana',identity:{badges:[]}},metadata:{original_sender:{id:9,username:'pepe'},original_message:{id:'k1',content:'hola banda'}}}));
// spam sin insignias: al momento
await page.evaluate(()=>window.kick({id:'k4',content:'Get B0TKIVA now',type:'message',created_at:'2026-11-02T00:00:03Z',sender:{id:12,username:'bot',identity:{badges:[]}}}));
await W(900);
last=S.posts[S.posts.length-1];
ok(last.body.msgs.some(m=>m.p.message_id==='k4'), 'spam (aunque lo disfracen: B0TKIVA): se manda al momento para que tu servidor lo borre');
ok(last.body.msgs.some(m=>m.p.message_id==='k3' && m.p.replies_to && m.p.replies_to.message_id==='k1' && m.p.replies_to.sender.username==='pepe'), 'las respuestas de Kick llevan a quién responden');
// Twitch
await page.evaluate(()=>window.irc('@badge-info=subscriber/14;badges=subscriber/12,moderator/1;color=#00FF7F;display-name=FanTw;emotes=25:0-4,13-17;first-msg=0;id=t1;mod=1;reply-parent-msg-id=t0;reply-parent-display-name=Otro;reply-parent-user-login=otro;reply-parent-msg-body=hola\\sque\\stal;user-id=555 :fantw!fantw@fantw.tmi.twitch.tv PRIVMSG #mariotq :Kappa jaja ñ Kappa'));
await page.evaluate(()=>window.irc('@badges=;color=;display-name=Bitero;emotes=;id=t2;bits=100;user-id=556 :bitero!bitero@bitero.tmi.twitch.tv PRIVMSG #mariotq :Cheer100 vamos'));
await page.evaluate(()=>window.irc('@badges=;display-name=Spam;emotes=;id=t3;user-id=557 :spam!spam@spam.tmi.twitch.tv PRIVMSG #mariotq :ZERO COST upgrades for you'));
await W(900);
last=S.posts[S.posts.length-1];
const t1=(last.body.msgs.find(m=>m.pf==='tw' && m.e.message_id==='t1')||{}).e||{};
ok(t1.chatter_user_name==='FanTw' && t1.chatter_user_login==='fantw' && t1.chatter_user_id==='555' && t1.color==='#00FF7F', 'Twitch: nombre, usuario, id y color');
ok(JSON.stringify(t1.badges)===JSON.stringify([{set_id:'subscriber',id:'12',info:'14'},{set_id:'moderator',id:'1',info:''}]), 'Twitch: insignias igual que el aviso oficial (con los meses de sub): '+JSON.stringify(t1.badges));
ok(JSON.stringify(t1.message && t1.message.fragments)===JSON.stringify([{type:'emote',text:'Kappa',emote:{id:'25'}},{type:'text',text:' jaja ñ '},{type:'emote',text:'Kappa',emote:{id:'25'}}]), 'Twitch: emotes en su lugar: '+JSON.stringify(t1.message&&t1.message.fragments));
ok(t1.reply && t1.reply.parent_message_id==='t0' && t1.reply.parent_message_body==='hola que tal', 'Twitch: respuestas');
const t2=(last.body.msgs.find(m=>m.pf==='tw' && m.e.message_id==='t2')||{}).e||{};
ok(t2.cheer && t2.cheer.bits===100, 'Twitch: bits');
// el servidor falla: no se pierde nada
S.fail=true;
await page.evaluate(()=>window.irc('@badges=moderator/1;display-name=Mod2;emotes=;id=t4;user-id=558 :mod2!m@m PRIVMSG #mariotq :!momento caída'));
await W(1500);
S.fail=false; p0=S.posts.length;
await W(6000);
last=S.posts[S.posts.length-1];
ok(S.posts.length>p0 && S.posts.slice(p0).some(p=>p.body.msgs.some(m=>m.e && m.e.message_id==='t4')), 'si tu servidor no contesta, lo guarda y lo vuelve a mandar');
// reconexión de Kick
await page.evaluate(()=>{ const w=window.__ws.find(x=>/pusher/.test(x.url)); w.close(); });
await W(300);
st=await page.evaluate(()=>document.getElementById('sk').textContent);
ok(/reconectando/.test(st), 'si se corta Kick: '+st);
await W(3000);
st=await page.evaluate(()=>document.getElementById('sk').textContent);
ok(/leyendo/.test(st), 'y se vuelve a conectar sola: '+st);
// la tanda normal
p0=S.posts.length;
await page.evaluate(()=>window.kick({id:'k9',content:'mensaje normal',type:'message',created_at:'2026-11-02T00:00:09Z',sender:{id:20,username:'luz',identity:{badges:[]}}}));
await W(21500);
ok(S.posts.length>p0 && S.posts.slice(p0).some(p=>p.body.msgs.some(m=>m.p && m.p.message_id==='k9')), 'los mensajes normales se mandan en tanda a los ~20 s');
// canales de Kick para raids y recompensas
ws=await page.evaluate(()=>window.__ws.filter(w=>/pusher/.test(w.url)).pop().sent.map(x=>JSON.parse(x)).filter(m=>m.event==='pusher:subscribe').map(m=>m.data.channel));
ok(['chatrooms.6635680.v2','chatrooms.6635680','chatroom_6635680','channel.6692133','channel_6692133'].every(c=>ws.indexOf(c)>=0), 'escucha también los canales de raids y recompensas de Kick: '+ws.join(', '));
// el mismo mensaje por dos canales: una sola vez
p0=S.posts.length;
await page.evaluate(()=>{ window.kickEv('App\\Events\\ChatMessageEvent','chatrooms.6635680',{id:'dupX',content:'!dup',type:'message',sender:{id:5,username:'Mod5',identity:{badges:[{type:'moderator'}]}}}); window.kickEv('App\\Events\\ChatMessageEvent','chatrooms.6635680.v2',{id:'dupX',content:'!dup',type:'message',sender:{id:5,username:'Mod5',identity:{badges:[{type:'moderator'}]}}}); });
await W(900);
ok(S.posts.slice(p0).reduce((n,p)=>n+p.body.msgs.filter(m=>m.p && m.p.message_id==='dupX').length,0)===1, 'si un mensaje llega por dos canales de Kick, se manda una sola vez');
p0=S.posts.length;
await page.evaluate(()=>window.kickEv('App\\Events\\StreamHostEvent','channel.6692133',{host_username:'RaiderMX',number_viewers:42,optional_message:'¡Vamos!'}));
await W(900);
last=S.posts[S.posts.length-1];
ok(S.posts.length>p0 && last.body.msgs.some(m=>m.host && m.host.user==='RaiderMX' && m.host.viewers===42 && m.host.message==='¡Vamos!'), 'raid de Kick: se manda al momento (para la alerta y tu regla aunque la app esté cerrada)');
await page.evaluate(()=>window.kickEv('App\\Events\\StreamHostEvent','chatrooms.6635680.v2',{host_username:'RaiderMX',number_viewers:42}));
await W(900);
ok(S.posts.slice(p0+1).every(p=>!p.body.msgs.some(m=>m.host)), 'la misma raid por otro canal no se repite');
await page.evaluate(()=>window.kickEv('RewardRedeemedEvent','chatroom_6635680',{id:'rw1',username:'Luz',reward_title:'Hidratarse',user_input:''}));
await W(900);
last=S.posts[S.posts.length-1];
ok(last.body.msgs.some(m=>m.reward && m.reward.user==='Luz' && m.reward.reward==='Hidratarse'), 'recompensa de Kick: se manda al momento');
// OBS
ok(S.posts.some(p=>p.body.obs && p.body.obs.scene==='LIVE' && p.body.obs.on===false), 'le dice a tu servidor la escena de OBS y si está transmitiendo');
p0=S.posts.length;
await page.evaluate(()=>{ window.dispatchEvent(new CustomEvent('obsSceneChanged',{detail:{name:'BRB'}})); window.dispatchEvent(new CustomEvent('obsStreamingStarted')); });
await W(1000);
last=S.posts[S.posts.length-1];
ok(S.posts.length>p0 && last.body.obs.scene==='BRB' && last.body.obs.on===true, 'cambias de escena (o NOALBS la cambia): tu servidor lo sabe al momento');
// link viejo
S.forbid=true; await page.evaluate(()=>window.guardia.flush()); await W(800);
st=await page.evaluate(()=>document.getElementById('err').textContent);
ok(/ya no sirve/.test(st), 'con link viejo se detiene y lo dice: '+st);
ok(errs.length===0, 'sin errores: '+errs.join('|'));
await page.screenshot({path:require('os').tmpdir()+'/guardia.png'});
console.log(fails ? fails+' FALLAS' : 'TODO BIEN');
await b.close(); process.exit(0);
})();
