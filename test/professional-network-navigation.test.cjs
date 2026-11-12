'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-professional-navigation.js','utf8');
function fixture(options={}){
 const location=new URL(options.url||'https://www.icademx.com/vip-panel.html#directorio'),events={},frames=[],storage=new Map(),main={scrollTop:220},dynamic={scrollTop:330};
 const document={documentElement:{scrollTop:10},body:{scrollTop:20},scrollingElement:{scrollTop:30},querySelector:s=>s==='main.main'?main:null,getElementById:id=>id==='dynamic-section'?dynamic:null,addEventListener(name,fn){(events[name]||=[]).push(fn);}};
 let cursor=0;const entries=[{url:location.href,state:options.state||{}}];
 const window={UserState:{uid:options.viewer||'viewer'},scrollY:440,scrollTo(value){this.scrollY=value.top;}};
 const history={get state(){return entries[cursor].state;},get length(){return entries.length;},pushState(state,_,url){entries.splice(cursor+1);entries.push({state,url:new URL(url,location).href});cursor++;location.href=entries[cursor].url;},replaceState(state,_,url){entries[cursor]={state,url:new URL(url,location).href};location.href=entries[cursor].url;},go(n){cursor+=n;assert(cursor>=0&&cursor<entries.length);location.href=entries[cursor].url;window.navigateToSection(location.hash.slice(1),{reemplazar:true,fromHistory:true});}};
 vm.runInNewContext(source,{window,document,history,location,URL,Date,requestAnimationFrame:fn=>frames.push(fn),sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
 const api=window.ICADEMProfessionalNavigation;
 window.navigateToSection=(section,config={})=>{const p=api.prepare(section,config);history[config.reemplazar?'replaceState':'pushState'](p.historyState,'',p.url);};
 return {api,location,window,history,document,main,dynamic,emit(name){for(const fn of events[name]||[])fn();},flush(){while(frames.length)frames.shift()();}};
}
test('direct network routes preserve explicit owner and two allowed tabs, clear editor intent and reject malformed owner IDs',()=>{
 const f=fixture({url:'https://www.icademx.com/vip-panel.html?profesional=owner-A&red=mutual&editar=basicos#directorio-red'});
 f.window.navigateToSection('directorio-red',{reemplazar:true});assert.equal(f.api.currentProfileId(),'owner-A');assert.equal(f.api.networkTab(),'mutual');assert(!f.location.searchParams.has('editar'));
 for(const owner of ['',null,'../owner','owner&other=x','x'.repeat(129)])assert.equal(f.api.openNetwork(owner),false);
 const safe=fixture();safe.api.openNetwork('owner-B');assert.equal(safe.api.currentProfileId(),'owner-B');assert.equal(safe.location.hash,'#directorio-red');assert.equal(safe.api.networkTab(),'connections');
 safe.window.navigateToSection('directorio-red',{profileUid:'owner-B',networkTab:'injected'});assert.equal(safe.api.networkTab(),'connections');
});

test('an old own-network mutual link becomes the connections route and history state',()=>{
 const f=fixture({url:'https://www.icademx.com/vip-panel.html?profesional=viewer&red=mutual#directorio-red'});
 assert.equal(f.api.networkTab(),'connections');
 f.window.navigateToSection('directorio-red',{reemplazar:true});
 assert.equal(f.location.searchParams.get('red'),'connections');assert.equal(f.history.state.icademNetwork.tab,'connections');
 assert.equal(f.api.currentProfileId(),'viewer');
});

test('explicit own mutual requests are canonicalized while another profile keeps its mutual tab',()=>{
 const f=fixture();f.window.navigateToSection('directorio-red',{profileUid:'viewer',networkTab:'mutual'});
 assert.equal(f.api.networkTab(),'connections');assert.equal(f.location.searchParams.get('red'),'connections');
 f.window.navigateToSection('directorio-red',{profileUid:'owner-B',networkTab:'mutual'});
 assert.equal(f.api.networkTab(),'mutual');assert.equal(f.history.state.icademNetwork.tab,'mutual');
});

test('returning through a legacy own-network context restores connections instead of duplicated mutuals',()=>{
 const f=fixture({url:'https://www.icademx.com/vip-panel.html?profesional=owner-B#directorio-perfil',state:{icademNetwork:{owner:'viewer',viewer:'viewer',tab:'mutual',at:Date.now()}}});
 assert.equal(f.api.backToNetwork(),true);assert.equal(f.api.currentProfileId(),'viewer');
 assert.equal(f.location.hash,'#directorio-red');assert.equal(f.location.searchParams.get('red'),'connections');
 assert.equal(f.history.state.icademNetwork.tab,'connections');
});
test('nested network exploration returns to each source owner, original mutual tab and captured scroll without replacing profile identity',()=>{
 const f=fixture();f.api.openProfile('owner-A');const ownerProfile=f.location.href;
 f.api.openNetwork('owner-A');f.window.navigateToSection('directorio-red',{profileUid:'owner-A',networkTab:'mutual',reemplazar:true});
 f.window.scrollY=801;f.document.body.scrollTop=533;f.main.scrollTop=239;f.api.openNetworkProfile('owner-B');assert.equal(f.api.currentProfileId(),'owner-B');assert.equal(f.api.backLabel(),'Volver a la red');
 f.api.openNetwork('owner-B');f.api.openNetworkProfile('owner-C');assert.equal(f.api.currentProfileId(),'owner-C');f.api.backToNetwork();assert.equal(f.location.hash,'#directorio-red');assert.equal(f.api.currentProfileId(),'owner-B');
 f.api.networkOwnerBack();assert.equal(f.location.hash,'#directorio-perfil');assert.equal(f.api.currentProfileId(),'owner-B');f.api.backToDirectory();assert.equal(f.location.hash,'#directorio-red');assert.equal(f.api.currentProfileId(),'owner-A');assert.equal(f.api.networkTab(),'mutual');
 f.window.scrollY=0;f.document.body.scrollTop=0;f.main.scrollTop=0;f.api.networkReady({isConnected:true});f.flush();assert.equal(f.window.scrollY,801);assert.equal(f.document.body.scrollTop,533);assert.equal(f.main.scrollTop,239);
 f.api.networkOwnerBack();assert.equal(f.location.href,ownerProfile);
});
test('unrelated navigation drops network return context and pending scroll cannot affect another view',()=>{
 const f=fixture();f.api.openProfile('owner-A');f.api.openNetwork('owner-A');f.api.openNetworkProfile('owner-B');f.api.backToNetwork();f.api.networkReady({isConnected:true});
 f.window.navigateToSection('cursos');f.window.scrollY=7;f.document.body.scrollTop=9;f.flush();assert.equal(f.window.scrollY,7);assert.equal(f.document.body.scrollTop,9);assert.equal(f.api.backToNetwork(),false);assert.equal(f.history.state.icademNetwork,undefined);
});
test('another viewer, expired history or session ending cannot restore a previous network owner',()=>{
 const f=fixture();f.api.openNetwork('owner-A');f.api.openNetworkProfile('owner-B');
 for(const changed of [{...f.history.state.icademNetwork,viewer:'someone-else'},{...f.history.state.icademNetwork,at:Date.now()-5*3600000}]){
   const next=fixture({url:f.location.href,state:{...f.history.state,icademNetwork:changed}});next.window.navigateToSection('directorio-perfil',{reemplazar:true});assert.equal(next.api.backToNetwork(),false);assert.notEqual(next.api.backLabel(),'Volver a la red');
 }
 f.emit('icadem:session-ending');assert.equal(f.api.backToNetwork(),false);
});
test('sign-in redirects whitelist network owner and tab while dropping foreign, malformed and injected destinations',()=>{
 const html=fs.readFileSync(__dirname+'/../vip-auth.html','utf8'),start=html.indexOf('function destinoSeguro('),end=html.indexOf('async function syncCentralIdentity(',start),code=html.slice(start,end);
 const redirect=(target,admin=false)=>{const ctx={window:{location:{origin:'https://www.icademx.com',search:'?redirect='+encodeURIComponent(target)}},URL,URLSearchParams};vm.runInNewContext(code,ctx);return ctx.destinoSeguro(admin);};
 const safe='vip-panel.html?profesional=owner-A&red=mutual#directorio-red';for(const admin of [false,true])assert.equal(redirect(safe,admin),safe);
 assert.equal(redirect('vip-panel.html?profesional=owner-A&red=invalid&editar=basicos&secret=hidden#directorio-red'),'vip-panel.html?profesional=owner-A&red=connections#directorio-red');
 for(const target of ['https://evil.example/'+safe,'vip-panel.html?profesional=../owner&red=mutual#directorio-red','vip-panel.html#directorio-red','vip-panel.html?profesional=owner-A#foro'])assert.equal(redirect(target),'vip-panel.html');
});
