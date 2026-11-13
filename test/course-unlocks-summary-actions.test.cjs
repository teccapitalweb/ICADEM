'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/icadem-course-unlocks.js'),'utf8');
function fixture(overrides={},freeCourseId=''){
  const calls=[],routes=[],nodes=new Map(),data={ok:true,enabled:true,active:true,isAdmin:false,available:0,nextUnlockAt:'2026-11-17T18:00:00Z',priorities:['first'],eligibleCourseIds:['first'],selectedCourseIds:[],revision:3,...overrides};
  const host={isConnected:true,hidden:true,_html:'',replaceChildren(){this.innerHTML='';},set innerHTML(value){this._html=value;nodes.clear();for(const name of ['choose','organize','explore','vip','priority'])if(value.includes('data-unlock-'+name))nodes.set('[data-unlock-'+name+']',{hidden:true,dataset:{},attributes:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});},get innerHTML(){return this._html;},querySelector(selector){return nodes.get(selector)||null;}};
  const window={__currentUser:{uid:'summary-user'},UserState:{freeCourseId},addEventListener(){},__getCourseUnlockCatalog:async()=>[{id:'first',titulo:'Inversiones y mercados financieros',access:{unlocked:false}}],__openLearningRoute:id=>routes.push(id),ICADEMPlatform:{request:async(path,options)=>{calls.push({path,options});return data;}}};
  const document={querySelectorAll:selector=>selector==='[data-course-unlocks]'?[host]:[],querySelector:()=>null,addEventListener(){},dispatchEvent(){}};
  vm.runInNewContext(source,{window,document,Map,Set,Date,setTimeout,clearTimeout,CustomEvent:function(){}});
  return {host,data,nodes,calls,routes,window,api:window.ICADEMCourseUnlocks,async mount(){await window.ICADEMCourseUnlocks.mount(host);await Promise.resolve();}};
}
test('waiting summary retains date, first priority and organizer without a dead choose button',async()=>{
  const f=fixture();await f.mount();assert.equal(f.host.hidden,false);assert.match(f.host.innerHTML,/course-unlocks--waiting/);assert.match(f.host.innerHTML,/Próximo cupo:/);assert.equal(f.nodes.has('[data-unlock-choose]'),false);
  const hint=f.nodes.get('[data-unlock-priority]');assert.equal(hint.hidden,false);assert.equal(hint.dataset.priorityCourse,'first');assert.match(hint.attributes['aria-label'],/Inversiones y mercados financieros/);
  f.nodes.get('[data-unlock-organize]').listeners.click();assert.equal(f.routes.length,1);assert.ok(f.calls.every(call=>!call.options),'organizing and rendering cannot consume a slot');assert.equal(f.data.available,0);
});
test('one or multiple available rights retain the existing enabled choose action and count',async()=>{
  for(const available of [1,4]){const f=fixture({available});await f.mount();assert.ok(!f.host.innerHTML.includes('course-unlocks--waiting'));assert.match(f.host.innerHTML,new RegExp(available+' curso'+(available===1?'':'s')+' por elegir'));assert.match(f.host.innerHTML,/data-unlock-choose>Elegir cursos/);assert.ok(f.nodes.has('[data-unlock-organize]'));assert.ok(f.calls.every(call=>!call.options));assert.equal(f.api.getSummary().available,available);}
});
test('inactive, free and administrative summaries retain their own actions and rights',async()=>{
  const expired=fixture({active:false,vipSlots:2,available:2});await expired.mount();assert.match(expired.host.innerHTML,/Desbloqueos guardados/);assert.ok(expired.nodes.has('[data-unlock-vip]'));assert.ok(!expired.nodes.has('[data-unlock-choose]'));
  const free=fixture({active:false},'gift-course');await free.mount();assert.match(free.host.innerHTML,/Tu curso gratuito sigue disponible/);assert.ok(free.nodes.has('[data-unlock-organize]'));
  const admin=fixture({isAdmin:true});await admin.mount();assert.match(admin.host.innerHTML,/Acceso a todos los cursos/);assert.ok(admin.nodes.has('[data-unlock-explore]'));assert.ok(!admin.nodes.has('[data-unlock-organize]'));assert.ok(!admin.host.innerHTML.includes('course-unlocks--waiting'));
  for(const f of [expired,free,admin])assert.ok(f.calls.every(call=>!call.options),'summary presentation never writes academic data');
});

test('a free course identity change refreshes its headline even when the server summary is identical',async()=>{
  const f=fixture({active:false,available:0});await f.mount();assert.match(f.host.innerHTML,/Elige tu curso gratuito/);
  const summary=JSON.stringify(f.api.getSummary());
  f.window.UserState.freeCourseId='gift-course';await f.api.refresh();assert.match(f.host.innerHTML,/Tu curso gratuito sigue disponible/);
  assert.equal(JSON.stringify(f.api.getSummary()),summary,'presentation changes do not modify rights or the confirmed summary');
  f.window.UserState.freeCourseId='';await f.api.refresh();assert.match(f.host.innerHTML,/Elige tu curso gratuito/);
  assert.ok(f.calls.every(call=>!call.options),'changing the headline cannot select or unlock a course');
});

test('catalog changes update the first priority title and access using the confirmed summary without another GET',async()=>{
  const f=fixture();f.window.ICADEMCourseSync={};let catalog=[{id:'first',titulo:'Título original',access:{unlocked:false}}];
  f.window.__getCourseUnlockCatalog=async()=>catalog;await f.mount();assert.match(f.nodes.get('[data-unlock-priority]').attributes['title'],/Título original/);
  const calls=f.calls.length,summary=JSON.stringify(f.api.getSummary());catalog=[{...catalog[0],titulo:'Título actualizado'}];
  await f.mount();assert.match(f.nodes.get('[data-unlock-priority]').attributes['title'],/Título actualizado/);
  catalog=[{...catalog[0],access:{unlocked:true}}];await f.mount();assert.equal(f.nodes.get('[data-unlock-priority]').hidden,true);
  assert.equal(f.calls.length,calls,'catalog presentation refresh reuses the UID-scoped summary');assert.equal(JSON.stringify(f.api.getSummary()),summary);
});

test('an equivalent summary received while the first-priority catalog is pending does not discard its hint',async()=>{
  const f=fixture();f.window.ICADEMCourseSync={};let release;
  const request=f.window.ICADEMPlatform.request;f.window.ICADEMPlatform.request=async(...args)=>JSON.parse(JSON.stringify(await request(...args)));
  f.window.__getCourseUnlockCatalog=()=>new Promise(resolve=>{release=resolve;});await f.mount();
  const hint=f.nodes.get('[data-unlock-priority]');assert.equal(hint.hidden,true);await f.api.refresh();assert.equal(f.nodes.get('[data-unlock-priority]'),hint);
  release([{id:'first',titulo:'Prioridad confirmada',access:{unlocked:false}}]);await Promise.resolve();await Promise.resolve();
  assert.equal(hint.hidden,false);assert.match(hint.attributes['title'],/Prioridad confirmada/);
});

test('a late priority callback cannot overwrite the hint created by a newer paint',async()=>{
  const f=fixture();f.window.ICADEMCourseSync={};const releases=[];
  f.window.__getCourseUnlockCatalog=()=>new Promise(resolve=>releases.push(resolve));await f.mount();await f.mount();assert.equal(releases.length,2);
  const hint=f.nodes.get('[data-unlock-priority]');releases[1]([{id:'first',titulo:'Catálogo actual',access:{unlocked:false}}]);await Promise.resolve();await Promise.resolve();
  releases[0]([{id:'first',titulo:'Catálogo anterior',access:{unlocked:false}}]);await Promise.resolve();await Promise.resolve();
  assert.match(hint.attributes['title'],/Catálogo actual/);assert.doesNotMatch(hint.attributes['title'],/Catálogo anterior/);
});
