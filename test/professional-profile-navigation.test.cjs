'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-professional-navigation.js','utf8');
function fixture(options={}){
  const events={},frames=[],navigations=[],scrolls=[],jumps=[],storage=options.storage||new Map(),clock={now:Date.parse('2026-11-09T20:00:00Z')};
  const location=new URL(options.url||'https://www.icademx.com/vip-panel.html?curso=old&ref=OTHER#directorio');
  const search={value:'José fiscal'},sector={value:'Fiscal y Contable'},tier={dataset:{tier:'vip'}},tab={dataset:{communityTab:'directory'}},main={scrollTop:360},dynamic={scrollTop:420};
  const list={isConnected:true,querySelector(selector){return ({'#dir-search-input':search,'#dir-sector-select':sector,'[data-tier][aria-pressed="true"]':tier,'[data-community-tab][aria-pressed="true"]':tab})[selector]||null;}};
  const document={documentElement:{scrollTop:120},body:{scrollTop:180},scrollingElement:{scrollTop:240},
    querySelector(selector){return selector==='[data-directory-refined]'?list:selector==='main.main'?main:null;},getElementById(id){return id==='dynamic-section'?dynamic:null;},addEventListener(name,fn){(events[name]||=[]).push(fn);}};
  const history={state:options.state||{},length:options.length||8,pushState(state,_,url){this.state=state;this.length++;location.href=new URL(url,location.href).href;},replaceState(state,_,url){this.state=state;location.href=new URL(url,location.href).href;},go(n){jumps.push(n);}};
  const window={UserState:{uid:options.uid===undefined?'viewer-a':options.uid},scrollY:600,scrollTo(value){scrolls.push(value);this.scrollY=value.top;}};
  const ctx={window,document,history,location,URL,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},Date:class extends Date{static now(){return clock.now;}},requestAnimationFrame:fn=>frames.push(fn)};
  vm.runInNewContext(source,ctx);const api=window.ICADEMProfessionalNavigation;
  window.navigateToSection=(section,config={})=>{navigations.push({section,config});const route=api.prepare(section,config);history[config.reemplazar?'replaceState':'pushState'](route.historyState,'',route.url);return route;};
  return {api,window,document,history,location,search,sector,tier,tab,main,dynamic,list,storage,clock,frames,navigations,scrolls,jumps,
    route:(section,config)=>window.navigateToSection(section,config),emit(name){for(const fn of events[name]||[])fn();},flush(){while(frames.length)frames.shift()();}};
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('shared profile links identify only one valid professional and discard unrelated payment/course parameters',()=>{
  const f=fixture();assert.equal(f.api.profileHref('professional_b-1'),'https://www.icademx.com/vip-panel.html?profesional=professional_b-1#directorio-perfil');
  for(const id of ['',null,'../private','x&email=hidden','https://evil.test',' bob','x'.repeat(129)]){assert.equal(f.api.validUid(id),false);assert.equal(f.api.profileHref(id),'');assert.equal(f.api.openProfile(id),false);}
  assert.equal(f.api.validUid('x'.repeat(128)),true);assert.equal(f.navigations.length,0);
});
test('opening profiles saves raw search, both filters, tab and all scroll positions without caching professional data',()=>{
  const f=fixture();f.tab.dataset.communityTab='connections';f.route('directorio');assert.equal(f.api.openProfile('bob'),true);
  assert.equal(f.api.currentProfileId(),'bob');assert.equal(f.location.hash,'#directorio-perfil');assert.equal(f.history.state.icademProfessional.depth,1);
  f.route('directorio');const state=plain(f.api.directoryState());
  assert.deepEqual(state,{search:'José fiscal',sector:'Fiscal y Contable',tier:'vip',tab:'connections',scroll:{window:600,document:120,body:180,scrolling:240,main:360,dynamic:420}});
  const stored=JSON.parse([...f.storage.values()][0]);assert.equal(stored.uid,'viewer-a');assert.equal(stored.search,'José fiscal');assert.deepEqual(Object.keys(stored).sort(),['at','scroll','search','sector','tab','tier','uid']);
});
test('return restoration waits for the saved directory tab, applies once and restores every scrolling surface',()=>{
  const f=fixture();f.tab.dataset.communityTab='requests';f.route('directorio');f.api.openProfile('bob');f.route('directorio');
  f.tab.dataset.communityTab='directory';f.api.directoryReady(f.list);assert.equal(f.frames.length,0);
  f.tab.dataset.communityTab='requests';for(const node of [f.document.documentElement,f.document.body,f.document.scrollingElement,f.main,f.dynamic])node.scrollTop=0;f.window.scrollY=0;
  f.api.directoryReady(f.list);assert.equal(f.frames.length,1);f.flush();
  assert.deepEqual([f.document.documentElement.scrollTop,f.document.body.scrollTop,f.document.scrollingElement.scrollTop,f.main.scrollTop,f.dynamic.scrollTop,f.window.scrollY],[120,180,240,360,420,600]);
  f.api.directoryReady(f.list);assert.equal(f.frames.length,0);assert.equal(f.api.directoryState(),null);
});
test('a queued restoration cannot scroll another route or a detached directory',()=>{
  const f=fixture();f.route('directorio');f.api.openProfile('bob');f.route('directorio');f.api.directoryReady(f.list);f.route('perfil');f.flush();assert.equal(f.scrolls.length,0);
  f.api.openProfile('bob');f.route('directorio');f.list.isConnected=false;f.api.directoryReady(f.list);f.flush();assert.equal(f.scrolls.length,0);
});
test('back to directory uses only this viewer owned navigation depth and falls back safely for a direct link',()=>{
  const f=fixture();f.route('directorio');f.api.openProfile('bob');f.api.openProfile('carol');assert.equal(f.history.state.icademProfessional.depth,2);f.api.backToDirectory();assert.deepEqual(f.jumps,[-2]);
  for(const state of [{},{icademProfessional:{viewer:'other',depth:1}},{icademProfessional:{viewer:'viewer-a',depth:999}},{icademProfessional:{viewer:'viewer-a',depth:0}}]){
    const direct=fixture({url:'https://www.icademx.com/vip-panel.html?profesional=bob#directorio-perfil',state});direct.route('directorio-perfil',{reemplazar:true});direct.api.backToDirectory();assert.equal(direct.jumps.length,0);assert.equal(direct.navigations.at(-1).section,'directorio');assert.equal(direct.navigations.at(-1).config.reemplazar,true);assert.equal(direct.location.search,'');
  }
});
test('direct links and reload retain profile IDs, and browser Back/Forward can change IDs within the same section',()=>{
  const f=fixture({url:'https://www.icademx.com/vip-panel.html?profesional=bob#directorio-perfil'});assert.equal(f.api.currentProfileId(),'bob');f.route('directorio-perfil',{reemplazar:true});assert.equal(f.api.currentProfileId(),'bob');
  f.api.openProfile('carol');assert.equal(f.api.currentProfileId(),'carol');f.location.href='https://www.icademx.com/vip-panel.html?profesional=bob#directorio-perfil';f.route('directorio-perfil',{reemplazar:true});assert.equal(f.api.currentProfileId(),'bob');
  const reloaded=fixture({url:f.location.href,state:f.history.state});reloaded.route('directorio-perfil',{reemplazar:true});assert.equal(reloaded.api.currentProfileId(),'bob');
});
test('saved return context survives a reload only for its owner and expires without restoring private or stale state',()=>{
  const f=fixture();f.route('directorio');f.api.openProfile('bob');const saved=f.storage;
  const reloaded=fixture({storage:saved,url:'https://www.icademx.com/vip-panel.html?profesional=bob#directorio-perfil'});reloaded.route('directorio-perfil',{reemplazar:true});reloaded.route('directorio');assert.equal(reloaded.api.directoryState().search,'José fiscal');
  for(const uid of ['viewer-b','']){const other=fixture({storage:saved,uid});other.route('directorio-perfil',{reemplazar:true});other.route('directorio');assert.equal(other.api.directoryState(),null);}
  for(const delta of [4*60*60*1000+1,-1]){const expired=fixture({storage:saved});expired.clock.now+=delta;expired.route('directorio-perfil',{reemplazar:true});expired.route('directorio');assert.equal(expired.api.directoryState(),null);}
});
test('ending a session removes its saved return context and cancels pending scroll restoration',()=>{
  const f=fixture();f.route('directorio');f.api.openProfile('bob');f.route('directorio');f.api.directoryReady(f.list);assert.equal(f.storage.size,1);f.emit('icadem:session-ending');f.flush();assert.equal(f.storage.size,0);assert.equal(f.api.directoryState(),null);assert.equal(f.scrolls.length,0);
  f.window.UserState.uid='viewer-b';f.emit('icadem:user-ready');f.route('directorio');assert.equal(f.api.directoryState(),null);
});

// Exercise the actual panel router and directory renderer together, rather than
// reimplementing their history/restore hooks in the unit fixture above.
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
function integrated(url='https://www.icademx.com/vip-panel.html#directorio'){
  const listeners={},documentEvents={},frames=[],timers=[],renders=[],historyCalls=[],storage=new Map(),location=new URL(url),counters={};
  function control(value=''){return {value,dataset:{},attributes:{},handlers:{},style:{},classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);},toggle(v,on){if(on)this.values.add(v);else this.values.delete(v);}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.handlers[k]=fn;},focus(){this.focused=true;},querySelectorAll(){return[];}};}
  const search=control(),clear=control(),sector=control('todos'),tierAll=control(),tierVip=control(),selectedTab=control(),main=control(),grid=control(),start=control();
  tierAll.dataset.tier='todos';tierVip.dataset.tier='vip';selectedTab.dataset.communityTab='directory';tierAll.setAttribute('aria-pressed','true');tierVip.setAttribute('aria-pressed','false');
  const root={isConnected:false,querySelector(selector){if(selector==='#dir-search-input')return search;if(selector==='#dir-sector-select')return sector;if(selector==='[data-tier][aria-pressed="true"]')return[tierAll,tierVip].find(n=>n.attributes['aria-pressed']==='true');if(selector==='[data-community-tab][aria-pressed="true"]')return selectedTab;return null;}};
  const ownProfile=control();
  const ids={'dir-search-input':search,'dir-search-clear':clear,'dir-sector-select':sector,'dir-mi-tarjeta':control(),'dir-mi-perfil':ownProfile,'dir-results':grid,'inicio-content':start};
  const dynamic={style:{},scrollTop:0,querySelector(selector){if(selector==='[data-directory-refined]')return root;return ids[selector.slice(1)]||null;},querySelectorAll(selector){return selector==='[data-tier]'?[tierAll,tierVip]:[];}};
  let markup='';Object.defineProperty(dynamic,'innerHTML',{get(){return markup;},set(value){markup=value;root.isConnected=value.includes('data-directory-refined');}});ids['dynamic-section']=dynamic;
  const document={documentElement:{scrollTop:0},body:{scrollTop:0},scrollingElement:{scrollTop:0},
    getElementById(id){return ids[id]||(counters[id]||=control());},querySelector(selector){return selector==='[data-directory-refined]'?(root.isConnected?root:null):selector==='main.main'?main:null;},querySelectorAll(){return[];},addEventListener(type,fn){(documentEvents[type]||=[]).push(fn);}};
  let cursor=0;const entries=[{url:location.href,state:null}];
  const history={get state(){return entries[cursor].state;},get length(){return entries.length;},pushState(state,_,next){historyCalls.push('push');entries.splice(cursor+1);entries.push({state,url:new URL(next,location.href).href});cursor++;location.href=entries[cursor].url;},replaceState(state,_,next){historyCalls.push('replace');entries[cursor]={state,url:new URL(next,location.href).href};location.href=entries[cursor].url;},go(delta){cursor+=delta;if(cursor<0||cursor>=entries.length)throw Error('history out of bounds');location.href=entries[cursor].url;for(const event of ['popstate','hashchange'])for(const fn of listeners[event]||[])fn();},back(){this.go(-1);},forward(){this.go(1);}};
  let pendingLoad=false,modalOpens=0;
  const window={history,location,UserState:{uid:'viewer-a',modo:'gratis'},scrollY:0,scrollTo(value){this.scrollY=typeof value==='object'?value.top:value;},addEventListener(type,fn){(listeners[type]||=[]).push(fn);},dispatchEvent(){},ICADEMCommunity:{attach(node,options){selectedTab.dataset.communityTab=options.directoryState?.tab||'directory';},paintCards(){},openProfile(uid){return window.ICADEMProfessionalNavigation.openProfile(uid);},renderProfilePage(container){renders.push(window.ICADEMProfessionalNavigation.currentProfileId());container.innerHTML='<div data-dedicated-profile></div>';}}};
  const ctx={window,document,history,location,URL,URLSearchParams,Date,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>timers.push(fn),clearInterval(){},SECCION_DEFAULT_VIP:'inicio',__seccionActualVIP:null,
    _dirFiltroSector:'todos',_dirFiltroTier:'todos',_dirBusqueda:'',_dirCards:[],SECTORES:['Fiscal y Contable','Legal'],
    Modal:{open(){modalOpens++;}},Toast:{error(){}},dirEditarMiTarjeta(){},dirSuscribir(){pendingLoad=true;},
    escapeHtml:value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),dirFotoSrc:()=>'',dirInstagramPerfil:()=>''};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-directory.js','utf8'),ctx);
  vm.runInNewContext(source,ctx);
  vm.runInNewContext(between(panel,'  function dirNormalizarBusqueda(','  function dirMostrarErrorCarga('),ctx);
  vm.runInNewContext(between(panel,'  function dirPintar(){','  async function dirEditarMiTarjeta('),ctx);
  ctx.Sections={renderers:{directorio:ctx.renderDirectorio,'directorio-perfil':ctx.renderPerfilProfesional,inicio(){},suscripcion(){dynamic.innerHTML='<div>Suscripción</div>';}}};
  vm.runInNewContext(between(panel,'function __seccionesValidasVIP(){','function sectionPlaceholder('),ctx);window.navigateToSection=ctx.navigateToSection;
  return {ctx,window,document,history,location,search,clear,sector,tierAll,tierVip,selectedTab,main,dynamic,root,grid,ownProfile,renders,historyCalls,storage,
    get modalOpens(){return modalOpens;},flush(){while(frames.length)frames.shift()();while(timers.length)timers.shift()();},
    completeLoad(cards=[{id:'bob',nombre:'José fiscal',sector:'Fiscal y Contable',isVip:true},{id:'free',nombre:'José fiscal',sector:'Fiscal y Contable',isVip:false}]){assert.equal(pendingLoad,true);pendingLoad=false;ctx._dirCards=cards;ctx.dirPintar();}};
}
test('real panel history rerenders a changed professional UID without adding duplicate Back/Forward entries or a popup',()=>{
  const f=integrated();assert.match(panel,/'directorio-perfil':renderPerfilProfesional/);f.ctx.navigateToSection('directorio',{reemplazar:true});f.flush();f.completeLoad();f.window.ICADEMProfessionalNavigation.openProfile('bob');f.flush();f.window.ICADEMProfessionalNavigation.openProfile('carol');f.flush();
  assert.deepEqual(f.renders,['bob','carol']);assert.equal(f.history.length,3);f.history.back();f.flush();assert.equal(f.location.search,'?profesional=bob');f.history.forward();f.flush();assert.equal(f.location.search,'?profesional=carol');assert.deepEqual(f.renders,['bob','carol','bob','carol']);assert.equal(f.history.length,3);assert.equal(f.modalOpens,0);
});
test('real directory renderer restores normalized matching and original form values only after cards load, then defeats old scroll resets',()=>{
  const f=integrated();f.ctx.navigateToSection('directorio',{reemplazar:true});f.flush();f.completeLoad();
  f.search.value='Jósé FISCAL';f.search.handlers.input();f.sector.value='Fiscal y Contable';f.sector.handlers.change({target:f.sector});f.tierVip.handlers.click();
  f.window.scrollY=1320;f.document.documentElement.scrollTop=120;f.document.body.scrollTop=720;f.document.scrollingElement.scrollTop=900;f.main.scrollTop=1050;f.dynamic.scrollTop=1180;
  const before=f.grid.innerHTML;f.ctx.dirVerDetalle('bob'); // Actual card action -> real route, never the old modal.
  f.window.ICADEMProfessionalNavigation.backToDirectory(); // Browser event route executes synchronously in the harness.
  assert.equal(f.location.hash,'#directorio');assert.equal(f.location.search,'');assert.equal(f.search.value,'Jósé FISCAL');assert.equal(f.ctx._dirBusqueda,'jose fiscal');assert.equal(f.ctx._dirFiltroSector,'Fiscal y Contable');assert.equal(f.ctx._dirFiltroTier,'vip');assert.equal(f.tierVip.attributes['aria-pressed'],'true');assert.equal(f.clear.hidden,false);
  f.flush();assert.notEqual(f.window.scrollY,1320); // No restore while the result list is still loading.
  f.completeLoad();f.flush();assert.equal(f.grid.innerHTML,before);assert.match(f.grid.innerHTML,/data-dircard="bob"/);assert.doesNotMatch(f.grid.innerHTML,/data-dircard="free"/);
  assert.deepEqual([f.window.scrollY,f.document.documentElement.scrollTop,f.document.body.scrollTop,f.document.scrollingElement.scrollTop,f.main.scrollTop,f.dynamic.scrollTop],[1320,120,720,900,1050,1180]);assert.equal(f.modalOpens,0);
});
test('actual panel URL reader handles direct/reloaded profile links and clears the target after leaving without changing checkout behavior',()=>{
  const link='https://www.icademx.com/vip-panel.html?profesional=member-123#directorio-perfil';
  for(let n=0;n<2;n++){const f=integrated(link);assert.equal(f.ctx.__leerSeccionURLVIP(),'directorio-perfil');f.ctx.__sincronizarDesdeURLVIP();f.flush();assert.deepEqual(f.renders,['member-123']);assert.equal(f.location.href,link);f.ctx.navigateToSection('suscripcion');f.flush();assert.equal(f.location.hash,'#suscripcion');assert.equal(f.location.search,'');assert.match(f.dynamic.innerHTML,/Suscripción/);}
});
test('the actual login return destination can enter the real panel profile renderer without falling back to home or administration',()=>{
  const target='vip-panel.html?profesional=member_ABC-123#directorio-perfil',auth=fs.readFileSync(__dirname+'/../vip-auth.html','utf8');
  for(const admin of [false,true]){const ctx={window:{location:{origin:'https://www.icademx.com',search:'?redirect='+encodeURIComponent(target)}},URL,URLSearchParams};vm.runInNewContext(between(auth,'function destinoSeguro(','async function syncCentralIdentity('),ctx);const result=ctx.destinoSeguro(admin);assert.equal(result,target);const f=integrated(new URL(result,'https://www.icademx.com').href);f.ctx.__sincronizarDesdeURLVIP();assert.deepEqual(f.renders,['member_ABC-123']);assert.equal(f.location.hash,'#directorio-perfil');}
});
test('the real own-profile button opens the authenticated owner UID and preserves the raw directory selection for return',()=>{
  const f=integrated();f.ctx.navigateToSection('directorio',{reemplazar:true});f.flush();f.completeLoad();
  f.search.value='Jósé FISCAL';f.search.handlers.input();f.sector.value='Fiscal y Contable';f.sector.handlers.change({target:f.sector});f.tierVip.handlers.click();f.window.scrollY=1500;
  f.ownProfile.handlers.click();assert.deepEqual(f.renders,['viewer-a']);assert.equal(f.location.search,'?profesional=viewer-a');assert.equal(f.location.hash,'#directorio-perfil');assert.equal(f.modalOpens,0);
  const saved=JSON.parse([...f.storage.values()][0]);assert.equal(saved.search,'Jósé FISCAL');assert.equal(saved.sector,'Fiscal y Contable');assert.equal(saved.tier,'vip');assert.equal(saved.scroll.window,1500);
  f.window.ICADEMProfessionalNavigation.backToDirectory();f.completeLoad();f.flush();assert.equal(f.search.value,'Jósé FISCAL');assert.equal(f.ctx._dirFiltroSector,'Fiscal y Contable');assert.equal(f.ctx._dirFiltroTier,'vip');assert.equal(f.window.scrollY,1500);
});
