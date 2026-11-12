'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-professional-navigation.js','utf8');
function fixture(options={}){
 const location=new URL(options.url||'https://www.icademx.com/vip-panel.html#directorio'),events={},frames=[],storage=new Map(),main={scrollTop:220},dynamic={scrollTop:330};
 const document={documentElement:{scrollTop:10},body:{scrollTop:20},scrollingElement:{scrollTop:30},querySelector:s=>s==='main.main'?main:null,getElementById:id=>id==='dynamic-section'?dynamic:null,addEventListener(name,fn){(events[name]||=[]).push(fn);}};
 let cursor=0;const entries=[{url:location.href,state:options.state||{}}],navigations=[];
 const window={UserState:{uid:options.viewer||'viewer'},scrollY:440,scrollTo(value){this.scrollY=value.top;}};
 const history={get state(){return entries[cursor].state;},get length(){return entries.length;},pushState(state,_,url){entries.splice(cursor+1);entries.push({state,url:new URL(url,location).href});cursor++;location.href=entries[cursor].url;},replaceState(state,_,url){entries[cursor]={state,url:new URL(url,location).href};location.href=entries[cursor].url;},go(n){cursor+=n;assert(cursor>=0&&cursor<entries.length);location.href=entries[cursor].url;window.navigateToSection(location.hash.slice(1),{reemplazar:true,fromHistory:true});}};
 const context={window,document,history,location,URL,Date,requestAnimationFrame:fn=>frames.push(fn),sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 vm.runInNewContext(source,context);const api=window.ICADEMProfessionalNavigation;
 window.navigateToSection=(section,config={})=>{navigations.push({section,config});const prepared=api.prepare(section,config);history[config.reemplazar?'replaceState':'pushState'](prepared.historyState,'',prepared.url);};
 return {api,location,window,history,document,main,dynamic,entries,navigations,emit(name){for(const fn of events[name]||[])fn();},flush(){while(frames.length)frames.shift()();}};
}
test('activity links and navigation use the visited owner UID, reject malformed owners, and never substitute the viewer',()=>{
 const f=fixture();assert.equal(f.api.activityHref('owner-B'),'https://www.icademx.com/vip-panel.html?profesional=owner-B#directorio-actividad');
 for(const id of ['',null,'../private','javascript:bad','owner&secret=x','x'.repeat(129)]){assert.equal(f.api.openActivity(id),false);assert.equal(f.api.activityHref(id),'');}
 f.api.openActivity('owner-B');assert.equal(f.api.currentProfileId(),'owner-B');assert.equal(f.location.hash,'#directorio-actividad');assert.equal(f.location.search,'?profesional=owner-B');assert.equal(f.api.openActivityPost('../post'),false);
});
test('profile -> activity -> original forum post -> activity -> profile preserves originating profile and Back context',()=>{
 const f=fixture();f.window.navigateToSection('directorio-conexiones');f.api.openProfile('owner-B');const profile=f.location.href,profileContext=JSON.stringify(f.history.state.icademProfessional);
 f.api.openActivity('owner-B');assert.equal(JSON.stringify(f.history.state.icademProfessional),profileContext);f.window.scrollY=920;f.main.scrollTop=640;
 f.api.openActivityPost('post-123');assert.equal(f.location.hash,'#foro');assert.equal(new URL(f.location).searchParams.get('publicacion'),'post-123');assert.equal(f.api.activityReturn().owner,'owner-B');
 f.api.backToActivity();assert.equal(f.location.hash,'#directorio-actividad');assert.equal(f.api.currentProfileId(),'owner-B');f.window.scrollY=0;f.main.scrollTop=0;f.api.activityReady({isConnected:true});f.flush();assert.equal(f.window.scrollY,920);assert.equal(f.main.scrollTop,640);
 f.api.backToProfile();assert.equal(f.location.href,profile);assert.equal(JSON.stringify(f.history.state.icademProfessional),profileContext);assert.equal(f.api.backLabel(),'Volver a Mis conexiones');
});
test('direct activity links and reloads retain the explicit owner, remove editor intent, and return safely to that profile',()=>{
 const url='https://www.icademx.com/vip-panel.html?profesional=owner-B&editar=basicos#directorio-actividad';const f=fixture({url});f.window.navigateToSection('directorio-actividad',{reemplazar:true});
 assert.equal(f.location.search,'?profesional=owner-B');assert.equal(f.api.currentEditorSection(),'');const reload=fixture({url:f.location.href,state:f.history.state});reload.window.navigateToSection('directorio-actividad',{reemplazar:true});reload.api.backToProfile();
 assert.equal(reload.location.hash,'#directorio-perfil');assert.equal(reload.api.currentProfileId(),'owner-B');assert.equal(reload.history.length,1);
});
test('forum reload preserves an owner-scoped activity return and falls back to the activity URL without a matching history index',()=>{
 const f=fixture();f.api.openProfile('owner-B');f.api.openActivity('owner-B');f.api.openActivityPost('post-123');
 const reload=fixture({url:f.location.href,state:f.history.state});reload.window.navigateToSection('foro',{reemplazar:true});assert.equal(reload.api.activityReturn().owner,'owner-B');reload.api.backToActivity();assert.equal(reload.location.hash,'#directorio-actividad');assert.equal(reload.api.currentProfileId(),'owner-B');
});
test('another session, expired routing state, or session ending cannot restore the former owner context',()=>{
 const f=fixture();f.api.openActivity('owner-B');f.api.openActivityPost('post-123');
 for(const state of [{...f.history.state,icademActivity:{...f.history.state.icademActivity,viewer:'other'}},{...f.history.state,icademActivity:{...f.history.state.icademActivity,at:Date.now()-5*60*60*1000}}]){
   const next=fixture({url:f.location.href,state});next.window.navigateToSection('foro',{reemplazar:true});assert.equal(next.api.activityReturn(),null);assert.equal(next.api.backToActivity(),false);
 }
 f.emit('icadem:session-ending');assert.equal(f.api.activityReturn(),null);
});
test('activity scroll restoration cannot affect another route or run more than once',()=>{
 const f=fixture();f.api.openActivity('owner-B');f.api.openActivityPost('post-123');f.api.backToActivity();const root={isConnected:true};f.api.activityReady(root);f.window.navigateToSection('cursos');f.window.scrollY=11;f.flush();assert.equal(f.window.scrollY,11);
});
test('the actual sign-in return preserves safe activity links and rejects malformed, foreign or editor-injected targets',()=>{
 const html=fs.readFileSync(__dirname+'/../vip-auth.html','utf8'),start=html.indexOf('function destinoSeguro('),end=html.indexOf('async function syncCentralIdentity(',start),code=html.slice(start,end),safe='vip-panel.html?profesional=owner-B#directorio-actividad';
 for(const admin of [false,true]){
   const context={window:{location:{origin:'https://www.icademx.com',search:'?redirect='+encodeURIComponent(safe)}},URL,URLSearchParams};vm.runInNewContext(code,context);assert.equal(context.destinoSeguro(admin),safe);
 }
 for(const target of ['https://evil.example/'+safe,'vip-panel.html?profesional=../owner#directorio-actividad','vip-panel.html?profesional=owner-B#foro','vip-panel.html#directorio-actividad']){
   const context={window:{location:{origin:'https://www.icademx.com',search:'?redirect='+encodeURIComponent(target)}},URL,URLSearchParams};vm.runInNewContext(code,context);assert.equal(context.destinoSeguro(false),'vip-panel.html');
 }
 const context={window:{location:{origin:'https://www.icademx.com',search:'?redirect='+encodeURIComponent('vip-panel.html?profesional=owner-B&editar=basicos&secret=hide#directorio-actividad')}},URL,URLSearchParams};vm.runInNewContext(code,context);assert.equal(context.destinoSeguro(false),safe);
});
