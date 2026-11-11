const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../js/icadem-learning-route.js'),'utf8');
function fixture() {
  const events = new Map(), body = {innerHTML:'',querySelector:() => null}, back = {addEventListener(){}};
  const host = {isConnected:true,innerHTML:'',querySelector:selector => selector === '[data-route-back]' ? back : selector === '[data-route-body]' ? body : null,querySelectorAll:() => [],replaceChildren(){this.innerHTML = '';body.innerHTML = '';}};
  let reads = 0, finish;
  const window = {__currentUser:{uid:'one'},addEventListener:(type,fn) => events.set(type,fn),ICADEMCourseUnlocks:{refresh:() => {reads++;return new Promise(resolve => {finish = resolve;});}},__getCourseUnlockCatalog:async () => []};
  const document = {addEventListener:(type,fn) => events.set(type,fn)};
  vm.runInNewContext(source,{window,document,setTimeout,clearTimeout,Map,Set,Date});
  return {window,host,body,events,get reads(){return reads;},finish:value => finish(value),api:window.ICADEMLearningRoute};
}
test('learning-route loading never queries rights for anonymous or demo visitors',async () => {
  const f = fixture(); f.window.__currentUser = null; await f.api.render(f.host); assert.equal(f.reads,0); assert.match(f.body.innerHTML,/Inicia sesión/);
  f.window.__currentUser = {uid:'one'}; f.window.__isDemoMode = true; await f.api.render(f.host); assert.equal(f.reads,0);
});
test('a late loading response cannot repaint after the current uid changes',async () => {
  const f = fixture(), pending = f.api.render(f.host); f.window.__currentUser = {uid:'two'}; f.finish({enabled:true,priorities:['private']}); await pending;
  assert.match(f.body.innerHTML,/Cargando tu ruta/); assert.equal(f.api.isDirty(),false);
});
test('logging out invalidates an in-flight read even after the same uid returns',async () => {
  const f = fixture(), pending = f.api.render(f.host); f.events.get('icadem:session-ending')(); f.window.__currentUser = {uid:'one'}; f.finish({enabled:true,priorities:['private']}); await pending;
  assert.equal(f.host.innerHTML,''); assert.equal(f.api.isDirty(),false); assert.equal(f.api.isBusy(),false);
});
test('an unmodified route permits native navigation without showing a dialog',() => {
  const f = fixture(); let called = false; assert.equal(f.api.requestLeave(() => {called = true;}),true); assert.equal(called,false);
});
