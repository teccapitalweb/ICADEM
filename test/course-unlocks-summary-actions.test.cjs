'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/icadem-course-unlocks.js'),'utf8');
function fixture(overrides={},freeCourseId=''){
  const calls=[],routes=[],nodes=new Map(),data={ok:true,enabled:true,active:true,isAdmin:false,available:0,nextUnlockAt:'2026-11-17T18:00:00Z',priorities:['first'],eligibleCourseIds:['first'],selectedCourseIds:[],revision:3,...overrides};
  const host={isConnected:true,hidden:true,_html:'',replaceChildren(){this.innerHTML='';},set innerHTML(value){this._html=value;nodes.clear();for(const name of ['choose','organize','explore','vip','priority'])if(value.includes('data-unlock-'+name))nodes.set('[data-unlock-'+name+']',{hidden:true,dataset:{},attributes:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});},get innerHTML(){return this._html;},querySelector(selector){return nodes.get(selector)||null;}};
  const window={__currentUser:{uid:'summary-user'},UserState:{freeCourseId},addEventListener(){},__getCourseUnlockCatalog:async()=>[{id:'first',titulo:'Inversiones y mercados financieros',access:{unlocked:false}}],__openLearningRoute:id=>routes.push(id),ICADEMPlatform:{request:async(path,options)=>{calls.push({path,options});return data;}}};
  const document={querySelectorAll:selector=>selector==='[data-course-unlocks]'?[host]:[],querySelector:()=>null,addEventListener(){},dispatchEvent(){}};
  vm.runInNewContext(source,{window,document,Map,Set,Date,setTimeout,clearTimeout,CustomEvent:function(){}});
  return {host,data,nodes,calls,routes,api:window.ICADEMCourseUnlocks,async mount(){await window.ICADEMCourseUnlocks.mount(host);await Promise.resolve();}};
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
