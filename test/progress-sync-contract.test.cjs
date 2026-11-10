'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
function fixture(){
  const timers=[];let renders=0,reads=0;
  const host={isConnected:true};
  const context={window:{__auth:{currentUser:{uid:'a'}},UserState:{uid:'a'}},localStorage:{getItem(){reads++;return '{"forged":{"completado":true}}';},setItem(){}},
    document:{getElementById:()=>host,querySelector:()=>null},location:{hash:'#cursos'},__entradaAprendizajeActiva:()=>false,
    cursos:[{id:'course',sesiones:[1,2]}],_cursosLoaded:true,actualizarInicioAprendizaje(){},
    renderCursos(){renders++;},renderCursoDetalle(){renders++;},renderClaseDetalle(){renders++;},
    setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},console};
  vm.createContext(context);
  const functions=panel.slice(panel.indexOf('  function getProgresoKey()'),panel.indexOf('  // El servidor conserva el avance por UID.'));
  const merge=panel.slice(panel.indexOf('  window.__mergeServerProgress = function'),panel.indexOf('  if (window.__pendingServerProgress)'));
  vm.runInContext(functions+merge,context);
  return {context,get renders(){return renders;},get reads(){return reads;},flush(){while(timers.length)timers.shift()();}};
}
test('real academic progress ignores a forged browser copy and is isolated by account',()=>{
  const f=fixture();assert.equal(JSON.stringify(f.context.getProgreso()),'{}');assert.equal(f.reads,0);
  f.context.window.__mergeServerProgress({course:{completedLessons:[1],courseCompleted:false}});
  assert.deepEqual(JSON.parse(JSON.stringify(f.context.getProgreso())).course.clasesVistas,[1]);
  f.context.window.__auth.currentUser.uid='b';assert.equal(JSON.stringify(f.context.getProgreso()),'{}');
});
test('unchanged server polling does not rebuild the class and focused edits survive new progress',()=>{
  const f=fixture(),first={course:{completedLessons:[1],courseCompleted:false}};
  f.context.window.__mergeServerProgress(first);f.flush();assert.equal(f.renders,1);
  f.context.window.__mergeServerProgress(first);f.flush();assert.equal(f.renders,1);
  f.context.__entradaAprendizajeActiva=()=>true;
  f.context.window.__mergeServerProgress({course:{completedLessons:[1,2],courseCompleted:true}});f.flush();
  assert.equal(f.renders,1);assert.equal(f.context.getProgreso().course.completado,true);
});
test('service worker bypasses authenticated and same-origin API responses',()=>{
  const handlers={};let answered=0;
  const context={self:{addEventListener:(name,fn)=>handlers[name]=fn},URL,location:{origin:'https://www.icademx.com'}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../sw.js','utf8'),context);
  for(const [path,authorized] of [['/api/credits/wallet',false],['/admin/payout',false],['/private-alias',true]]){
    handlers.fetch({request:{method:'GET',url:'https://www.icademx.com'+path,headers:{has:()=>authorized}},respondWith(){answered++;}});
  }
  assert.equal(answered,0,'protected responses must never be handled by the PWA cache');
});
