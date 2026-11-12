const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
function setup(){
 const stored=new Map(),events={},location=new URL('https://www.icademx.com/vip-panel.html?ordenCursos=nombre#ruta-aprendizaje'),writes=[];
 const window={__auth:{currentUser:{uid:'one'}}},cursosState={orden:'nombre'};
 const ctx={window,cursosState,location,URL,URLSearchParams,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},history:{state:{},replaceState(state,_,url){writes.push(url);location.href=new URL(url,location.href).href;}},document:{addEventListener:(type,fn)=>events[type]=fn}};
 vm.createContext(ctx);vm.runInContext(panel.slice(panel.indexOf('  const ordenesCatalogo='),panel.indexOf("  document.addEventListener('icadem:unlocks-updated'")),ctx);
 return{ctx,stored,events,window,cursosState,location,writes};
}
test('only the current account confirmed-save signal selects priorities without changing organizer history',()=>{
 const f=setup();f.events['icadem:priorities-saved']({detail:{uid:'other'}});assert.equal(f.stored.size,0);
 f.events['icadem:priorities-saved']({detail:{uid:'one'}});assert.equal(f.cursosState.orden,'prioridades');assert.equal(f.ctx.leerOrdenCatalogo(),'prioridades');assert.equal(f.writes.length,0);
 assert.deepEqual([...f.stored.values()],['prioridades']);
});
test('manual preferences remain authoritative over old return URLs and are isolated by account',()=>{
 const f=setup();f.ctx.guardarOrdenCatalogo('recientes');assert.equal(f.ctx.leerOrdenCatalogo(),'recientes');
 f.location.search='?ordenCursos=nombre';assert.equal(f.ctx.leerOrdenCatalogo(),'recientes');
 f.window.__auth.currentUser.uid='two';assert.equal(f.ctx.leerOrdenCatalogo(),'nombre');
 f.ctx.guardarOrdenCatalogo('bogus');assert.equal(f.stored.size,1);
});
test('demo and ending sessions cannot set another account preference through save signals',()=>{
 const f=setup();f.window.__sessionEnding=true;f.events['icadem:priorities-saved']({detail:{uid:'one'}});assert.equal(f.stored.size,0);
 f.window.__sessionEnding=false;f.window.__isDemoMode=true;f.ctx.guardarOrdenCatalogo('prioridades');assert.equal(f.stored.size,0);
});
