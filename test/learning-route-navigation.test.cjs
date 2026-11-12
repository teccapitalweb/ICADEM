'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const panel=fs.readFileSync(path.join(ROOT,'vip-panel.html'),'utf8');
function between(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}

// Execute the actual panel router with a minimal DOM and an actual history stack.
// The route UI and remote APIs have separate browser coverage.
function fixture(url='https://www.icademx.com/vip-panel.html#cursos'){
  const events={},documentEvents={},frames=[],timers=[],renders=[],storage=new Map(),location=new URL(url);
  const node=()=>({style:{},scrollTop:0,isConnected:true,dataset:{},classList:{add(){},remove(){}},querySelector(){return null;},querySelectorAll(){return[];},contains(){return false;},matches(){return false;}});
  const main=node(),dynamic=node(),home=node(),controls={'cur-search':{value:'Nómina'},'cur-area':{value:'Legal'},'cur-level':{value:'Intermedio'},'cur-sort':{value:'nombre'}};
  const tab={dataset:{courseFilter:'bloqueados'}},tabs={scrollLeft:93};
  const courses={isConnected:true,querySelector(selector){return selector==='.courses-status-filters'?tabs:selector==='[data-course-filter][aria-pressed="true"]'?tab:controls[selector.slice(1)]||null;}};
  const document={documentElement:node(),body:node(),scrollingElement:node(),activeElement:null,
    getElementById(id){return id==='dynamic-section'?dynamic:id==='inicio-content'?home:controls[id]||node();},
    querySelector(selector){return selector==='main.main'?main:selector==='.courses-page--premium'?courses:null;},querySelectorAll(){return[];},
    addEventListener(type,fn){(documentEvents[type]||=[]).push(fn);}};
  let cursor=0;const entries=[{url:location.href,state:null}];
  const history={get state(){return entries[cursor].state;},get length(){return entries.length;},
    pushState(state,_,next){entries.splice(cursor+1);entries.push({state,url:new URL(next,location.href).href});cursor++;location.href=entries[cursor].url;},
    replaceState(state,_,next){entries[cursor]={state,url:new URL(next,location.href).href};location.href=entries[cursor].url;},
    go(delta){const next=cursor+delta;assert.ok(next>=0&&next<entries.length);cursor=next;location.href=entries[cursor].url;for(const type of ['popstate','hashchange'])for(const fn of events[type]||[])fn();},back(){this.go(-1);},forward(){this.go(1);}};
  const route={dirty:false,busy:false,pending:null,isDirty(){return this.dirty;},isBusy(){return this.busy;},requestLeave(proceed){if(this.busy)return false;if(this.dirty){this.pending=proceed;return false;}return true;},reset(){this.dirty=false;this.busy=false;this.pending=null;},discard(){const next=this.pending;this.pending=null;this.dirty=false;next?.();}};
  const window={history,location,UserState:{uid:'viewer-a'},__auth:{currentUser:{uid:'viewer-a'}},scrollY:0,
    scrollTo(value){this.scrollY=typeof value==='object'?value.top:value;},
    addEventListener(type,fn){(events[type]||=[]).push(fn);},dispatchEvent(event){for(const fn of events[event.type]||[])fn(event);},
    ICADEMLearningRoute:route};
  const ctx={window,document,history,location,URL,URLSearchParams,Date,Promise,console,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>timers.push(fn),clearTimeout(){},clearInterval(){},
    SECCION_DEFAULT_VIP:'inicio',__seccionActualVIP:null};
  ctx.Sections={renderers:{inicio(){},cursos(){renders.push('cursos');dynamic.innerHTML='Mis cursos';},'ruta-aprendizaje'(){renders.push('ruta-aprendizaje');dynamic.innerHTML='Mi ruta';},suscripcion(){renders.push('suscripcion');dynamic.innerHTML='VIP';}}};
  for(const view of ['disponibles','progreso','completados','bloqueados','proximamente','regalo'])ctx.Sections.renderers['cursos-'+view]=()=>renders.push('cursos-'+view);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/icadem-professional-navigation.js'),'utf8'),ctx);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/icadem-learning-navigation.js'),'utf8'),ctx);
  vm.runInNewContext(between(panel,'function __seccionesValidasVIP(){','function sectionPlaceholder('),ctx);
  window.navigateToSection=ctx.navigateToSection;
  return {ctx,window,document,history,location,route,frames,timers,renders,storage,controls,main,dynamic,courses,tabs,tab,
    flush(){while(frames.length)frames.shift()();while(timers.length)timers.shift()();},
    emit(type){for(const fn of documentEvents[type]||[])fn();for(const fn of events[type]||[])fn();}};
}

test('the organizer is an internal route using the real panel renderer and browser history',()=>{
  const f=fixture();
  assert.match(panel,/'ruta-aprendizaje'\s*:/);
  f.ctx.navigateToSection('cursos',{reemplazar:true});f.flush();f.ctx.navigateToSection('ruta-aprendizaje');f.flush();
  assert.equal(f.location.hash,'#ruta-aprendizaje');assert.equal(f.history.length,2);assert.equal(f.renders.at(-1),'ruta-aprendizaje');
  f.history.back();f.flush();assert.equal(f.location.hash,'#cursos');assert.equal(f.renders.at(-1),'cursos');
  f.history.forward();f.flush();assert.equal(f.location.hash,'#ruta-aprendizaje');assert.equal(f.history.length,2);
});

for(const view of ['disponibles','progreso','completados','bloqueados','proximamente','regalo'])test('category '+view+' retains the parent context and uses actual indexed browser history',()=>{
  const f=fixture();f.ctx.navigateToSection('cursos',{reemplazar:true});f.flush();
  f.window.scrollY=377;f.main.scrollTop=188;f.ctx.navigateToSection('cursos-'+view);f.flush();
  assert.equal(f.location.hash,'#cursos-'+view);assert.equal(f.renders.at(-1),'cursos-'+view);
  f.window.ICADEMLearningNavigation.backToCourses();f.flush();
  assert.equal(f.location.hash,'#cursos');assert.equal(f.window.ICADEMLearningNavigation.coursesState().search,'Nómina');
  f.window.ICADEMLearningNavigation.coursesReady(f.courses);f.flush();assert.equal(f.window.scrollY,377);assert.equal(f.main.scrollTop,188);
  f.history.forward();f.flush();assert.equal(f.location.hash,'#cursos-'+view);
  f.window.ICADEMLearningNavigation.backToCourses();f.flush();assert.equal(f.location.hash,'#cursos');assert.equal(f.history.length,2);
});

test('a direct category link returns safely without trusting a foreign account marker',()=>{
  const f=fixture('https://www.icademx.com/vip-panel.html#cursos-bloqueados');f.ctx.__sincronizarDesdeURLVIP();f.flush();
  assert.equal(f.renders.at(-1),'cursos-bloqueados');f.history.state.icademCourseViewReturn={uid:'another-user',index:0};
  f.window.ICADEMLearningNavigation.backToCourses();f.flush();assert.equal(f.location.hash,'#cursos');assert.equal(f.history.length,1);
});

test('dirty sidebar navigation waits for explicit discard and cancellation leaves URL and history intact',()=>{
  const f=fixture();f.ctx.navigateToSection('cursos',{reemplazar:true});f.ctx.navigateToSection('ruta-aprendizaje');f.route.dirty=true;
  const current=f.location.href,length=f.history.length;
  f.ctx.navigateToSection('suscripcion');assert.equal(f.location.href,current);assert.equal(f.history.length,length);assert.equal(typeof f.route.pending,'function');
  f.route.pending=null;assert.equal(f.location.href,current);assert.equal(f.route.dirty,true);
  f.ctx.navigateToSection('suscripcion');f.route.discard();assert.equal(f.location.hash,'#suscripcion');assert.equal(f.history.length,length+1);
});

test('dirty browser Back and Forward preserve their exact history step until discard',()=>{
  const f=fixture();f.ctx.navigateToSection('cursos',{reemplazar:true});f.ctx.navigateToSection('ruta-aprendizaje');f.route.dirty=true;
  const current=f.location.href,length=f.history.length;f.history.back();
  assert.equal(f.location.href,current);assert.equal(f.history.length,length);assert.equal(typeof f.route.pending,'function');
  f.route.pending=null;f.history.back();assert.equal(f.location.href,current);f.route.discard();assert.equal(f.location.hash,'#cursos');assert.equal(f.history.length,length);
  f.history.forward();assert.equal(f.location.hash,'#ruta-aprendizaje');
  f.route.dirty=false;f.ctx.navigateToSection('suscripcion');f.history.back();f.route.dirty=true;const before=f.location.href;f.history.forward();
  assert.equal(f.location.href,before);assert.equal(typeof f.route.pending,'function');f.route.discard();assert.equal(f.location.hash,'#suscripcion');
});

test('a pending save blocks section navigation and history without inventing entries',()=>{
  const f=fixture();f.ctx.navigateToSection('cursos',{reemplazar:true});f.ctx.navigateToSection('ruta-aprendizaje');f.route.busy=true;
  const current=f.location.href,length=f.history.length;f.ctx.navigateToSection('suscripcion');assert.equal(f.location.href,current);assert.equal(f.route.pending,null);
  f.history.back();assert.equal(f.location.href,current);assert.equal(f.history.length,length);assert.equal(f.route.pending,null);
});

test('direct and reloaded organizer links remain inside the panel',()=>{
  for(let i=0;i<2;i++){
    const f=fixture('https://www.icademx.com/vip-panel.html#ruta-aprendizaje');f.ctx.__sincronizarDesdeURLVIP();f.flush();
    assert.equal(f.location.hash,'#ruta-aprendizaje');assert.equal(f.renders.at(-1),'ruta-aprendizaje');assert.equal(f.history.length,1);
  }
});

test('return context retains query, filters, tab position and all scrolling surfaces until courses are ready',()=>{
  const f=fixture();f.ctx.navigateToSection('cursos',{reemplazar:true});f.flush();
  f.window.scrollY=880;f.document.documentElement.scrollTop=310;f.document.body.scrollTop=320;f.document.scrollingElement.scrollTop=330;f.main.scrollTop=340;f.dynamic.scrollTop=350;
  f.ctx.navigateToSection('ruta-aprendizaje');f.flush();f.window.__backToCoursesFromRoute();
  const state=JSON.parse(JSON.stringify(f.window.ICADEMLearningNavigation.coursesState()));
  assert.deepEqual(state,{search:'Nómina',area:'Legal',nivel:'Intermedio',orden:'nombre',estado:'bloqueados',tabs:93,scroll:{window:880,document:310,body:320,scrolling:330,main:340,dynamic:350}});
  f.flush();assert.notEqual(f.window.scrollY,880,'wait for the actual course list, not navigation skeleton');
  f.window.ICADEMLearningNavigation.coursesReady(f.courses);f.flush();
  assert.deepEqual([f.window.scrollY,f.document.documentElement.scrollTop,f.document.body.scrollTop,f.document.scrollingElement.scrollTop,f.main.scrollTop,f.dynamic.scrollTop],[880,310,320,330,340,350]);
  assert.equal(f.tabs.scrollLeft,93);assert.equal(f.window.ICADEMLearningNavigation.coursesState(),null);
});

test('a queued course return cannot scroll another route or another signed-in account',()=>{
  for(const action of ['navigate','session']){
    const f=fixture();f.ctx.navigateToSection('cursos',{reemplazar:true});f.flush();f.window.scrollY=980;
    f.ctx.navigateToSection('ruta-aprendizaje');f.flush();f.window.__backToCoursesFromRoute();f.window.ICADEMLearningNavigation.coursesReady(f.courses);
    if(action==='navigate')f.ctx.navigateToSection('suscripcion');else{f.emit('icadem:session-ending');f.window.__auth.currentUser.uid='viewer-b';f.window.UserState.uid='viewer-b';f.emit('icadem:user-ready');}
    f.window.scrollY=0;f.flush();assert.equal(f.window.scrollY,0,action);assert.equal(f.window.ICADEMLearningNavigation.coursesState(),null,action);
  }
});

test('direct organizer back falls safely to courses without adopting another owner history marker',()=>{
  for(const marker of [null,{uid:'other',index:0},{uid:'viewer-a',index:999}]){
    const f=fixture('https://www.icademx.com/vip-panel.html#ruta-aprendizaje');f.ctx.__sincronizarDesdeURLVIP();
    f.history.replaceState({...f.history.state,icademLearningReturn:marker},'',f.location.href);f.window.__backToCoursesFromRoute();
    assert.equal(f.location.hash,'#cursos');assert.equal(f.history.length,1);
  }
});
