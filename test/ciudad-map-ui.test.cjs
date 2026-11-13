'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const load=rel=>import(pathToFileURL(path.join(__dirname,'../ciudad/js',rel)).href);

test('premium map projects only existing buildings and the existing outdoor destinations (park, fountain and, since 1.3, the Distrito del Saber), with the same waypoints',async()=>{
  const {mapDestinations}=await load('ui/city-map.js'),{BUILDINGS,doorPoint}=await load('world/buildings.js');
  const api={store:{state:{missions:{},xp:90,economy:{balance:25},avatarId:'explorador'}},missions:{}};
  const before=JSON.stringify(api),items=mapDestinations(api);
  assert.deepEqual(items.map(it=>it.id),[...BUILDINGS.map(b=>b.id),'parque','fuente','distrito']);
  for(const b of BUILDINGS){const item=items.find(it=>it.id===b.id);assert.equal(item.name,b.name);assert.equal(item.x,b.x);assert.equal(item.z,b.z);assert.equal(item.open,b.status==='open');assert.deepEqual(item.way,doorPoint(b,2.2));}
  assert.deepEqual(items.find(it=>it.id==='parque').way,{x:0,z:34.5});assert.deepEqual(items.find(it=>it.id==='fuente').way,{x:0,z:6});
  const {DISTRICT_GATE}=await load('world/plaza.js');assert.deepEqual(items.find(it=>it.id==='distrito').way,{x:DISTRICT_GATE.arrival.x,z:DISTRICT_GATE.arrival.z},'the district waypoint is the real arrival of its gate');
  assert.equal(JSON.stringify(api),before,'render projection does not write inventory, missions, XP, appearance or economy');
});

test('map completion reflects the mission actually loaded for the building, without invented progress',async()=>{
  const {mapDestinations}=await load('ui/city-map.js');
  const state={missions:{'current-bank':{completed:true,bestScore:93},'old-court':{completed:true},'current-vet':{completed:false,bestScore:99}}};
  const api={store:{state},missions:{bank:{def:{id:'current-bank'}},court:{def:{id:'current-court'}},vet:{def:{id:'current-vet'}}}},before=JSON.stringify(state);
  const items=mapDestinations(api);assert.equal(items.find(it=>it.id==='banco').done,true);assert.equal(items.find(it=>it.id==='tribunal').done,false);assert.equal(items.find(it=>it.id==='veterinaria').done,false);assert.equal(items.find(it=>it.id==='casa').done,false);
  assert.equal(items.filter(it=>it.done).length,1);assert.equal(JSON.stringify(state),before);
});
