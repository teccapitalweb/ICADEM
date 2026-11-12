'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {browser,flush}=require('./helpers/reward-browser.cjs');
const platform=fs.readFileSync(__dirname+'/../js/icadem-platform-v2.js','utf8');
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
const between=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
function session(shared={revision:1,priorities:['a','b'],available:2}){
  const f=browser(['icadem-course-unlocks.js','icadem-course-sync.js']),calls=[];
  f.window.navigator={onLine:true};f.document.visibilityState='visible';f.window.epoch=0;
  const note=new f.Element('p');note.dataset.courseSync='';note.hidden=true;f.document.body.append(note);
  f.window.ICADEMPlatform.request=async path=>{calls.push(path);return {ok:true,enabled:true,...structuredClone(shared)};};
  f.window.__refreshAcademicCourseCatalog=async()=>{calls.push('catalog');return true;};
  f.window.identity=async()=>{calls.push('identity');return {profile:{uid:f.window.__auth.currentUser?.uid}};};
  f.window.progress=async()=>{calls.push('progress');return {courses:{}};};
  f.window.wallet=async()=>{calls.push('wallet');return {};};
  f.run(`let criticalRefreshPromise=null,lastCriticalRefresh=0;
    function platformSession(){return {uid:window.__auth.currentUser?.uid,generation:window.epoch};}
    function currentPlatformSession(s){return !window.__sessionEnding&&s.uid===window.__auth.currentUser?.uid&&s.generation===window.epoch;}
    const syncIdentity=()=>window.identity(),loadLearningProgress=()=>window.progress(),loadCreditWallet=()=>window.wallet();
    ${between(platform,'  function refreshCriticalData() {','  function startCriticalRefresh() {')}
    window.ICADEMPlatform.refreshCriticalData=refreshCriticalData;`);
  return {...f,note,calls,shared,async ready(){f.signin('owner-a');await flush();await f.window.ICADEMPlatform.refreshCriticalData();},
    async refresh(){await f.window.emit('focus');await flush();await f.window.ICADEMPlatform.refreshCriticalData();}};
}
test('two independent contexts read the same server priorities in both directions; no browser copy is authoritative',async()=>{
  const shared={revision:1,priorities:['a','b'],available:2},a=session(shared),b=session(shared);
  await a.ready();await b.ready();assert.deepEqual(Array.from(a.window.ICADEMCourseUnlocks.getPriorities()),['a','b']);
  shared.priorities=['b','a'];shared.revision++;a.location.hash='#cursos-bloqueados';await a.refresh();
  assert.deepEqual(Array.from(a.window.ICADEMCourseUnlocks.getPriorities()),['b','a']);
  shared.priorities=['a','b','c'];shared.revision++;b.location.hash='#cursos-progreso';await b.refresh();await a.refresh();
  for(const f of [a,b]){assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b','c']);assert.equal(f.window.ICADEMCourseUnlocks.getSummary().available,2);assert.equal(f.storage.size,0);assert.equal(f.note.hidden,true);}
});
test('every category and the organizer refresh access and priorities with identity and progress',async()=>{
  const f=session();await f.ready();
  for(const route of ['cursos','cursos-disponibles','cursos-progreso','cursos-completados','cursos-bloqueados','cursos-proximamente','cursos-regalo','ruta-aprendizaje']){
    f.location.hash='#'+route;f.calls.length=0;await f.refresh();
    for(const call of ['identity','progress','catalog','/api/courses/unlocks'])assert.ok(f.calls.includes(call),route+': '+call);
    assert.equal(f.note.hidden,true);
  }
});
test('catalog and summary failures are explicit; old confirmed data is never labelled current',async()=>{
  const f=session();await f.ready();f.window.__refreshAcademicCourseCatalog=async()=>{throw Error('offline');};await f.refresh();
  assert.equal(f.note.hidden,false);assert.match(f.note.textContent,/última información/);assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b']);
  f.window.__refreshAcademicCourseCatalog=async()=>true;f.window.progress=async()=>{throw Error('progress offline');};await f.refresh();assert.equal(f.note.hidden,false);
  f.window.progress=async()=>({courses:{}});await f.refresh();assert.equal(f.note.hidden,true);
});
test('focus events share an in-flight cycle and a route entered during a generic refresh is still hydrated',async()=>{
  const f=session();await f.ready();let release;f.window.identity=()=>new Promise(resolve=>{release=resolve;});f.location.hash='#inicio';
  const generic=f.window.ICADEMPlatform.refreshCriticalData();await flush();f.location.hash='#cursos-bloqueados';f.calls.length=0;
  const after=f.window.ICADEMPlatform.refreshCriticalData();f.window.identity=async()=>({profile:{}});release({profile:{}});await generic;await after;
  assert.ok(f.calls.includes('catalog'));assert.ok(f.calls.includes('/api/courses/unlocks'));assert.equal(f.note.hidden,true);
});
test('offline and unrelated modules do not start academic requests; logout clears both confirmed copies',async()=>{
  const f=session();await f.ready();f.calls.length=0;f.location.hash='#ciudad';await f.window.emit('focus');await flush();assert.equal(f.calls.length,0);
  f.location.hash='#cursos';f.window.navigator.onLine=false;await f.window.emit('focus');assert.equal(f.calls.length,0);assert.equal(f.note.hidden,false);
  f.ending();assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),[]);assert.equal(f.window.ICADEMCourseUnlocks.getSummary(),null);assert.equal(f.note.hidden,true);
});
test('late reads cannot repaint another session, including a subsequent sign-in with the same UID',async()=>{
  const f=session();await f.ready();let release;f.window.__refreshAcademicCourseCatalog=()=>new Promise(resolve=>{release=resolve;});
  const old=f.window.ICADEMPlatform.refreshCriticalData();await flush();f.ending();f.window.epoch++;
  f.window.__refreshAcademicCourseCatalog=async()=>true;f.signin('owner-a');await flush();await f.window.ICADEMPlatform.refreshCriticalData();
  release(true);await old;assert.equal(f.note.hidden,true);assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b']);
});

function catalogSession(){
  const documentEvents={},requests=[];
  const ctx={window:{__isDemoMode:false,__auth:{currentUser:{uid:'a'}}},document:{addEventListener:(n,fn)=>documentEvents[n]=fn,getElementById:()=>null},
    cursos:[],_cursosLoaded:false,_cursosLoading:false,_cursosLoadPromise:null,console:{warn(){}},
    pedirCatalogoCursos:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),catalogoCursosPublicoDeRespaldo:()=>[],getProgresoCurso:()=>({clasesVistas:[]}),getPortadaCurso:c=>c.portada,actualizarInicioAprendizaje(){}};
  vm.createContext(ctx);
  const guards=between(panel,'  let _cursosGeneration =','  // ─── Lógica de desbloqueo');
  vm.runInContext(guards+between(panel,'  async function cargarCursosFirestore(force){','  window.__cargarCursosFirestore ='),ctx);
  const response=id=>({ok:true,courses:[{id,titulo:id,access:{unlocked:true},sesiones:[]}],viewer:{}});
  return {ctx,requests,response,reset:()=>documentEvents['icadem:session-ending']()};
}
test('the actual catalog loader discards a previous account response and cannot clear a newer in-flight request',async()=>{
  const f=catalogSession(),old=f.ctx.cargarCursosFirestore(true);f.reset();f.ctx.window.__auth.currentUser.uid='b';
  const fresh=f.ctx.cargarCursosFirestore(true);f.requests[0].resolve(f.response('private-a'));await old;assert.equal(f.ctx.cursos.length,0);
  const joined=f.ctx.cargarCursosFirestore();assert.equal(f.requests.length,2);f.requests[1].resolve(f.response('owned-b'));await fresh;await joined;
  assert.equal(f.ctx.cursos[0].id,'owned-b');
});
test('same-UID logout/sign-in starts a new catalog generation and ignores prior data',async()=>{
  const f=catalogSession(),old=f.ctx.cargarCursosFirestore(true);f.reset();const fresh=f.ctx.cargarCursosFirestore(true);
  f.requests[1].resolve(f.response('new-session'));await fresh;f.requests[0].resolve(f.response('old-session'));await old;
  assert.equal(f.ctx.cursos[0].id,'new-session');
});
test('the backend summary accessor returns defensive copies and never returns another owner data',async()=>{
  const f=session();await f.ready();const data=f.window.ICADEMCourseUnlocks.getSummary();data.priorities.reverse();data.available=999;
  assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b']);assert.equal(f.window.ICADEMCourseUnlocks.getSummary().available,2);
  f.window.__auth.currentUser.uid='other';assert.equal(f.window.ICADEMCourseUnlocks.getSummary(),null);
});
