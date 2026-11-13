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
test('confirmed academic refresh clears its pending state while the unrelated wallet is still pending',async()=>{
  const f=session();await f.ready();f.calls.length=0;let releaseCatalog,releaseWallet,finished=false;
  f.window.__refreshAcademicCourseCatalog=()=>{f.calls.push('catalog');return new Promise(resolve=>{releaseCatalog=resolve;});};
  f.window.wallet=()=>{f.calls.push('wallet');return new Promise(resolve=>{releaseWallet=resolve;});};
  const first=f.window.ICADEMPlatform.refreshCriticalData(),joined=f.window.ICADEMPlatform.refreshCriticalData();
  first.then(()=>{finished=true;});assert.equal(joined,first,'a repeated refresh joins the same complete cycle');
  await flush();f.runTimers(180);assert.equal(f.note.hidden,false);assert.match(f.note.textContent,/Actualizando/);
  releaseCatalog(true);await flush();await flush();
  assert.equal(f.note.hidden,true,'confirmed courses do not wait for the wallet');assert.equal(finished,false,'the complete refresh still awaits its wallet request');
  assert.deepEqual(f.calls.slice().sort(),['/api/courses/unlocks','catalog','identity','progress','wallet'].sort(),'all original reads occur once');
  releaseWallet({balance:37});const results=await first;assert.equal(await joined,results);
  assert.deepEqual(Array.from(results,r=>r.status),['fulfilled','fulfilled','fulfilled','fulfilled']);
  assert.equal(results[0].value.profile.uid,'owner-a');assert.ok(results[1].value.courses);assert.equal(results[2].value.balance,37);assert.equal(results[3].value,true,'the public result order is unchanged');
  assert.equal(f.note.hidden,true);assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b']);assert.equal(f.shared.available,2);
});
test('an academic failure is marked stale before the unrelated wallet finishes',async()=>{
  const f=session();await f.ready();let releaseWallet,finished=false;
  f.window.wallet=()=>new Promise(resolve=>{releaseWallet=resolve;});
  f.window.__refreshAcademicCourseCatalog=async()=>{throw Error('catalog offline');};
  const refresh=f.window.ICADEMPlatform.refreshCriticalData();refresh.then(()=>{finished=true;});await flush();await flush();
  assert.equal(finished,false);assert.equal(f.note.hidden,false);assert.match(f.note.textContent,/última información/);assert.doesNotMatch(f.note.textContent,/Actualizando/,'a known academic error is never left in the pending state');
  assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b'],'the last confirmed priorities remain available with the stale warning');
  releaseWallet({});const results=await refresh;assert.equal(results.length,4);assert.equal(results[2].status,'fulfilled');assert.equal(results[3].status,'rejected');assert.equal(f.note.hidden,false);assert.match(f.note.textContent,/última información/);
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

test('concurrent forced catalog readers join one authenticated request instead of queuing another',async()=>{
  const f=catalogSession(),first=f.ctx.cargarCursosFirestore(true),second=f.ctx.cargarCursosFirestore(true);
  assert.equal(f.requests.length,1);f.requests[0].resolve(f.response('same-snapshot'));await Promise.all([first,second]);
  assert.equal(f.requests.length,1);assert.equal(f.ctx.cursos[0].id,'same-snapshot');
});

test('a confirmed-write reload waits for an old read and then requests the post-write catalog',async()=>{
  const f=catalogSession();vm.runInContext(between(panel,'  window.__reloadCourseCatalog =','  window.__refreshAcademicCourseCatalog ='),f.ctx);
  const old=f.ctx.cargarCursosFirestore(true),afterWrite=f.ctx.window.__reloadCourseCatalog();assert.equal(f.requests.length,1);
  f.requests[0].resolve(f.response('before-write'));await old;await flush();assert.equal(f.requests.length,2);
  f.requests[1].resolve(f.response('after-write'));await afterWrite;assert.equal(f.ctx.cursos[0].id,'after-write');
});

test('a post-write reload cannot start or repaint in a replacement session',async()=>{
  const f=catalogSession();vm.runInContext(between(panel,'  window.__reloadCourseCatalog =','  window.__refreshAcademicCourseCatalog ='),f.ctx);
  const old=f.ctx.cargarCursosFirestore(true),afterWrite=f.ctx.window.__reloadCourseCatalog();f.reset();f.ctx.window.__auth.currentUser.uid='b';
  f.requests[0].resolve(f.response('private-a'));await old;assert.equal(await afterWrite,null);assert.equal(f.requests.length,1);assert.equal(f.ctx.cursos.length,0);
});

test('the informational hint can reuse its owned snapshot while default catalog readers still await revalidation',async()=>{
  const f=catalogSession();vm.runInContext(between(panel,'  window.__getCourseUnlockCatalog =','  window.__courseCoverICADEM ='),f.ctx);
  const initial=f.ctx.cargarCursosFirestore();f.requests[0].resolve(f.response('confirmed-a'));await initial;
  const refresh=f.ctx.cargarCursosFirestore(true),snapshot=await f.ctx.window.__getCourseUnlockCatalog({snapshot:true});
  assert.equal(snapshot[0].id,'confirmed-a');assert.equal(f.requests.length,2);
  let resolved=false;const canonical=f.ctx.window.__getCourseUnlockCatalog().then(rows=>{resolved=true;return rows;});await flush();assert.equal(resolved,false);
  f.requests[1].resolve(f.response('revalidated-a'));await refresh;assert.equal((await canonical)[0].id,'revalidated-a');assert.equal(f.requests.length,2);
});

test('a hint snapshot never returns the preceding account catalog, including when the next read fails',async()=>{
  const f=catalogSession();vm.runInContext(between(panel,'  window.__getCourseUnlockCatalog =','  window.__courseCoverICADEM ='),f.ctx);
  const initial=f.ctx.cargarCursosFirestore();f.requests[0].resolve(f.response('private-a'));await initial;
  f.ctx.window.__auth.currentUser.uid='b';let resolved=false;
  const snapshot=f.ctx.window.__getCourseUnlockCatalog({snapshot:true}).then(rows=>{resolved=true;return rows;});await flush();assert.equal(resolved,false);assert.equal(f.requests.length,2);
  f.requests[1].reject(Error('offline'));assert.equal((await snapshot).length,0);assert.equal(f.ctx.cursos.length,0);
  f.ctx.window.__sessionEnding=true;assert.equal((await f.ctx.window.__getCourseUnlockCatalog({snapshot:true})).length,0);
});

test('an identical confirmed summary does not replace its DOM; a real server change still repaints it',async()=>{
  const f=session({revision:1,priorities:['a','b'],available:2,active:true}),host=new f.Element('div');host.dataset.courseUnlocks='';let paints=0,markup='';
  Object.defineProperty(host,'innerHTML',{get:()=>markup,set:value=>{paints++;markup=String(value);}});f.document.body.append(host);
  await f.ready();assert.ok(paints>0);paints=0;await f.refresh();assert.equal(paints,0);
  f.shared.available=1;f.shared.revision++;await f.refresh();assert.equal(paints,1);assert.match(markup,/1 curso por elegir/);
});
test('the backend summary accessor returns defensive copies and never returns another owner data',async()=>{
  const f=session();await f.ready();const data=f.window.ICADEMCourseUnlocks.getSummary();data.priorities.reverse();data.available=999;
  assert.deepEqual(Array.from(f.window.ICADEMCourseUnlocks.getPriorities()),['a','b']);assert.equal(f.window.ICADEMCourseUnlocks.getSummary().available,2);
  f.window.__auth.currentUser.uid='other';assert.equal(f.window.ICADEMCourseUnlocks.getSummary(),null);
});

function projectionSession(){
  let markup='',writes=0;
  const list={get innerHTML(){return markup;},set innerHTML(value){writes++;markup=String(value);},querySelectorAll(){return [];}};
  const course={id:'always-visible',titulo:'Curso visible',desc:'Mismo catálogo confirmado',instructor:'ICADEM',area:'Fiscal',nivel:'Intermedio',horas:2,sesiones:[{accessible:true},{accessible:true}],materiales:[],access:{unlocked:true}};
  const ctx={vip:true,freeCourseId:'',rating:'<div class="curso-card__rating">Cargando valoraciones…</div>',cursos:[course],cursosState:{estado:'disponibles'},vistasCursos:{disponibles:{titulo:'Disponibles'}},vistaCursosActual:'disponibles',FREE_CLASS_COUNT:4,
    document:{getElementById:id=>id==='cur-list'?list:{textContent:''},querySelectorAll:()=>[]},
    window:{__courseCoverICADEM:()=>'/cover.webp',ICADEMCourseUnlocks:{decorate(){}}},
    ordenarCursos:items=>items,cursosFiltrados:()=>[course],cursoDesbloqueado:()=>true,diasParaDesbloquear:()=>0,progresoCursoPct:()=>0};
  ctx.toolEsVIP=()=>ctx.vip;ctx.primerCursoGratisId=()=>ctx.freeCourseId;
  ctx.window.ICADEMCourseRatings={cardMarkup:()=>ctx.rating};vm.createContext(ctx);
  vm.runInContext(between(panel,'  function resumenEstadoCurso(c){','  function cursoCoincideEstado')+between(panel,'  function renderCursosList(){','  function openCursoDetalle(id){'),ctx);
  return {ctx,course,render:()=>ctx.renderCursosList(),get markup(){return markup;},get writes(){return writes;}};
}

test('child views update free-course controls when membership or selected gift changes without changing canonical access',()=>{
  const f=projectionSession(),before=JSON.stringify(f.course);f.render();assert.equal(f.writes,1);assert.doesNotMatch(f.markup,/data-free-course-cta/);
  f.ctx.vip=false;f.render();assert.equal(f.writes,2);assert.match(f.markup,/data-free-course-cta/,'free member with no selection can choose the gift');
  f.ctx.freeCourseId='another-course';f.render();assert.equal(f.writes,3);assert.doesNotMatch(f.markup,/data-free-course-cta/,'a confirmed gift elsewhere removes the choose action');
  f.ctx.freeCourseId='';f.render();assert.equal(f.writes,4);assert.match(f.markup,/data-free-course-cta/);
  f.ctx.vip=true;f.render();assert.equal(f.writes,5);assert.doesNotMatch(f.markup,/data-free-course-cta/);
  assert.equal(JSON.stringify(f.course),before,'rendering never changes backend course rights');assert.match(f.markup,/Iniciar curso/);
});

test('rating-only updates keep their own updater while a changed academic course still rerenders',()=>{
  const f=projectionSession();f.render();assert.equal(f.writes,1);
  f.ctx.rating='<div class="curso-card__rating">Valoraciones no disponibles</div>';f.render();assert.equal(f.writes,1,'the asynchronous rating label does not rebuild a course card');
  f.course.titulo='Título confirmado actualizado';f.render();assert.equal(f.writes,2);assert.match(f.markup,/Título confirmado actualizado/);
});
