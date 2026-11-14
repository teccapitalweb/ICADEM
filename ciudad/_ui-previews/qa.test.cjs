'use strict';
// Local composition tests, not persistence or permission checks against a backend.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{JSDOM}=require(process.argv[2]||path.resolve(__dirname,'../../../mundo-ui-tools/node_modules/jsdom'));
test('changing composition clears a previous action error without changing the confirmed sample model',async t=>{
  const dom=new JSDOM('<main id="lab"></main>');global.document=dom.window.document;
  const {createVisualLab}=await import(pathToFileURL(path.join(__dirname,'views.js')).href),f=await import(pathToFileURL(path.join(__dirname,'fixtures.js')).href);
  const controller=f.createFixtureController({failNext:true}),host=document.getElementById('lab'),api=createVisualLab(host,{model:controller.model,catalogs:{pets:f.PETS,products:f.PRODUCTS,flavors:f.FLAVORS,gameTitles:f.GAME_TITLES},dispatch:action=>controller.dispatch(action)});
  t.after(()=>{api.destroy();dom.window.close();delete global.document;});
  const before=api.model;[...host.querySelectorAll('button')].find(b=>b.textContent==='Acompañarme · ensayo').click();await new Promise(r=>setImmediate(r));
  assert(host.querySelector('[role="alert"]'));api.show('inventory');assert.equal(host.querySelector('[role="alert"]'),null);assert(host.querySelector('[role="status"]'));assert.deepEqual(api.model,before);
  assert.throws(()=>api.show('unknown'),/Composición desconocida/);assert.equal(api.currentView,'inventory');
});
