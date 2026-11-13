'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const panel=fs.readFileSync(path.join(__dirname,'../vip-panel.html'),'utf8');
function between(start,end){const first=panel.indexOf(start),last=panel.indexOf(end,first);assert.ok(first>=0&&last>first,start);return panel.slice(first,last);}
const ids=items=>Array.from(items,item=>item.id);
function fixture(){
  const catalog=[
    {id:'a',titulo:'Álgebra práctica',area:'Ciencias',nivel:'Básico',orden:3,info:{clave:'bloqueado',dias:null,desbloqueado:false,progreso:0}},
    {id:'b',titulo:'Contabilidad',area:'Finanzas',nivel:'Avanzado',orden:1,info:{clave:'disponible',dias:0,desbloqueado:true,progreso:0}},
    {id:'c',titulo:'Derecho',area:'Legal',nivel:'Básico',orden:2,info:{clave:'progreso',dias:0,desbloqueado:true,progreso:40}},
    {id:'d',titulo:'Estrategia',area:'Finanzas',nivel:'Básico',orden:4,info:{clave:'bloqueado',dias:6,desbloqueado:false,progreso:0}},
    {id:'e',titulo:'Fiscal',area:'Legal',nivel:'Avanzado',orden:5,info:{clave:'bloqueado',dias:12,desbloqueado:false,progreso:0}}
  ];
  let priorities=[];
  const context={cursos:catalog,cursosState:{estado:'todos',area:'todas',nivel:'todos',search:'',orden:'prioridades'},
    window:{ICADEMCourseUnlocks:{getPriorities:()=>[...priorities]}},
    resumenEstadoCurso:course=>course.info,cursoCoincideEstado:(course,state)=>state==='todos'||state===course.info.clave,
    normalizarBusquedaCurso:text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),Map,Set};
  vm.createContext(context);vm.runInContext(between('  function cursosFiltrados(){','  function cursosSkeleton(){'),context);
  return{context,catalog,setPriorities:value=>{priorities=[...value];},priorities:()=>[...priorities],run:()=>ids(context.ordenarCursos(context.cursosFiltrados().slice()))};
}
test('priority ordering uses the confirmed saved order and keeps a stable standard order for the remainder',()=>{
  const f=fixture();f.setPriorities(['e','a','d']);const before=JSON.stringify(f.catalog),saved=f.priorities();
  assert.deepEqual(f.run(),['c','b','e','a','d']);assert.deepEqual(f.run(),f.run());
  assert.deepEqual(f.priorities(),saved);assert.equal(JSON.stringify(f.catalog),before);
});
test('empty priorities fall back to the existing next-unlock order without changing any academic state',()=>{
  const f=fixture();const priority=f.run();f.context.cursosState.orden='proximos';assert.deepEqual(priority,f.run());
  assert.deepEqual(f.priorities(),[]);assert.equal(f.catalog.find(c=>c.id==='c').info.progreso,40);
});
test('search, category, level and access filters apply before priority ordering and never renumber the saved list',()=>{
  const f=fixture();f.setPriorities(['missing','c','e','a','d']);const saved=f.priorities();
  f.context.cursosState.area='Legal';assert.deepEqual(f.run(),['c','e']);
  f.context.cursosState.nivel='Avanzado';assert.deepEqual(f.run(),['e']);
  f.context.cursosState.area='todas';f.context.cursosState.nivel='todos';f.context.cursosState.search='algebra';assert.deepEqual(f.run(),['a']);
  f.context.cursosState.search='';f.context.cursosState.estado='progreso';assert.deepEqual(f.run(),['c']);
  assert.deepEqual(f.priorities(),saved);
});
test('unknown saved IDs do not remove courses or mutate the saved list',()=>{
  const f=fixture();f.setPriorities(['removed','d','unknown','a']);assert.deepEqual(f.run(),['c','b','d','a','e']);
  assert.equal(new Set(f.run()).size,5);assert.deepEqual(f.priorities(),['removed','d','unknown','a']);
});

test('an academically unlocked priority moves to the open group without mutating its saved rank or consuming anything',()=>{
  const f=fixture();f.setPriorities(['e','a','d']);
  f.catalog.find(c=>c.id==='a').info={clave:'disponible',dias:0,desbloqueado:true,progreso:0};
  assert.deepEqual(f.run(),['c','b','a','e','d']);assert.deepEqual(f.priorities(),['e','a','d']);
});

test('completed courses retain their existing academic access and are not inferred to be blocked',()=>{
  const f=fixture();f.setPriorities(['e','b']);f.catalog.find(c=>c.id==='b').info.clave='completado';
  assert.deepEqual(f.run(),['c','b','e','d','a']);assert.equal(f.catalog[1].info.clave,'completado');
});
test('manual name, progress and recent criteria retain their existing behavior',()=>{
  const f=fixture();f.setPriorities(['e','a']);
  f.context.cursosState.orden='nombre';assert.deepEqual(f.run(),['a','b','c','d','e']);
  f.context.cursosState.orden='progreso';assert.deepEqual(f.run(),['c','b','a','d','e']);
  f.context.cursosState.orden='recientes';assert.deepEqual(f.run(),['e','d','a','c','b']);
});

test('next-unlock view shows opened courses first, then every locked saved priority, then the remainder',()=>{
  const f=fixture();f.context.cursosState.orden='proximos';f.setPriorities(['e','a']);
  const catalog=JSON.stringify(f.catalog),saved=f.priorities();
  assert.deepEqual(f.run(),['c','b','e','a','d']);
  assert.equal(JSON.stringify(f.catalog),catalog);assert.deepEqual(f.priorities(),saved);
  f.context.cursosState.orden='prioridades';assert.deepEqual(f.run(),['c','b','e','a','d']);
});

test('open, completed and gift courses keep their previous relative order regardless of their saved rank',()=>{
  const f=fixture();f.context.cursosState.orden='proximos';
  f.catalog.push({id:'gift',titulo:'Regalo',orden:9,info:{clave:'regalo',regalo:true,dias:0,desbloqueado:true,progreso:0}},
    {id:'done',titulo:'Completado',orden:7,info:{clave:'completado',dias:0,desbloqueado:true,progreso:100}});
  const opened=f.run().filter(id=>f.catalog.find(c=>c.id===id).info.desbloqueado);
  f.setPriorities(['done','b','e','gift','c','a']);const original=JSON.stringify(f.catalog);
  assert.deepEqual(f.run(),[...opened,'e','a','d']);assert.equal(JSON.stringify(f.catalog),original);
});

test('next-unlock priorities tolerate deleted, duplicated and already-open entries without altering saved data',()=>{
  const f=fixture();f.context.cursosState.orden='proximos';f.setPriorities(['missing','b','e','e','c','a']);
  assert.deepEqual(f.run(),['c','b','e','a','d']);assert.equal(new Set(f.run()).size,5);
  assert.deepEqual(f.priorities(),['missing','b','e','e','c','a']);
  f.context.cursosState.area='Legal';assert.deepEqual(f.run(),['c','e']);
});
