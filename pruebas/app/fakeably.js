(function(){
  window.__ablyN=(window.__ablyN||0)+1;
  window.Ably={Realtime:function(opts){
    var self=this, subs=[], connL=[]; window.__ablyOpts=opts;
    this.connection={state:'connecting', on:function(f){ connL.push(f); }};
    var fire=function(cur, prev){ self.connection.state=cur; connL.forEach(function(l){ l({current:cur, previous:prev}); }); };
    this.channels={get:function(n){ window.__ablyCh=n; return {subscribe:function(f){ subs.push(f); return new Promise(function(ok, bad){ setTimeout(function(){ fire('connected','connecting'); if (window.__subFail){ window.__subFail--; bad(new Error('attach falló')); } else ok(); }, 60); }); }}; }};
    this.close=function(){ window.__closed=(window.__closed||0)+1; fire('closed','connected'); };
    window.__ablyEmit=function(name, data){ subs.forEach(function(f){ f({name:name, data:JSON.stringify(data), encoding:null}); }); };
    window.__ablyDrop=function(){ fire('disconnected','connected'); };
    window.__ablyBack=function(){ fire('connecting','disconnected'); fire('connected','connecting'); };
  }};
})();
