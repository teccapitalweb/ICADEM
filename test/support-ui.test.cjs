'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(send){
  function element(){return{value:'',innerHTML:'',textContent:'',scrollHeight:50,style:{},isConnected:true,events:{},attributes:{},addEventListener(n,f){this.events[n]=f;},setAttribute(n,v){this.attributes[n]=v;},removeAttribute(n){delete this.attributes[n];},focus(){}};}
  const text=element(),button=element(),count=element(),form=element();form.querySelector=s=>s==='textarea'?text:s==='button[type="submit"]'?button:count;form.appendChild=x=>{form.feedback=x;};form.requestSubmit=()=>form.events.submit({preventDefault(){}});
  let ids=0;const context={window:{},document:{createElement:element},crypto:{randomUUID:()=>String(++ids).padStart(32,'0')}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-support-ui.js','utf8'),context);
  context.window.ICADEMSupportUI.bindComposer(form,{send,topic:()=> 'cobros'});
  return{text,button,count,form,ui:context.window.ICADEMSupportUI};
}
test('rapid Enter/click sends once, clears only sent text and restores accessible state',async()=>{
  let finish,calls=0;const pending=new Promise(r=>finish=r),app=setup(async()=>{calls++;await pending;});
  app.text.value='Consulta';const first=app.form.requestSubmit();await app.form.requestSubmit();assert.equal(calls,1);assert.equal(app.button.disabled,true);
  app.text.value='Nuevo borrador';finish();await first;
  assert.equal(app.text.value,'Nuevo borrador');assert.equal(app.button.disabled,false);assert.equal(app.form.attributes['aria-busy'],undefined);
});
test('network retry preserves text and request identity after an ambiguous response',async()=>{
  const requests=[];let fail=true;const app=setup(async body=>{requests.push(body);if(fail)throw Error('Network');});
  app.text.value='Consulta\nSegundo párrafo';await app.form.requestSubmit();assert.match(app.form.feedback.textContent,/Se conservó/);assert.equal(app.text.value,'Consulta\nSegundo párrafo');
  fail=false;await app.form.requestSubmit();assert.equal(requests[0].clientRequestId,requests[1].clientRequestId);assert.equal(app.text.value,'');assert.equal(app.count.textContent,'0 / 3000');assert.equal(app.button.disabled,true);
  app.text.value='Otra consulta';await app.form.requestSubmit();assert.notEqual(requests[1].clientRequestId,requests[2].clientRequestId);
});
test('Shift+Enter and composition preserve typing; unchanged polling preserves DOM and scroll',()=>{
  const app=setup(async()=>{});for(const extra of [{shiftKey:true},{isComposing:true}]){let prevented=false;app.text.events.keydown({key:'Enter',...extra,preventDefault(){prevented=true;}});assert.equal(prevented,false);}
  const box={innerHTML:'old',scrollTop:20,scrollHeight:800,clientHeight:300};app.ui.syncMessages(box,'new');assert.equal(box.scrollTop,20);box.scrollTop=490;app.ui.syncMessages(box,'newer');assert.equal(box.scrollTop,800);
  let writes=0;Object.defineProperty(box,'innerHTML',{get:()=> 'same',set(){writes++;}});app.ui.syncMessages(box,'same');assert.equal(writes,0);
});

test('admin authentication and page polling refresh the selected conversation with the same timer',async()=>{
  const requests=[],events={};let timer,interval;
  const context={window:{addEventListener(n,f){events[n]=f;}},Pages:{_getAuthToken:async()=> 'test',_webhookUrl:''},document:{getElementById(){return null;}},__seccionActual:'soporte',Toast:{error(){}},setInterval(f,ms){timer=f;interval=ms;return 1;},clearInterval(){},setTimeout(){},fetch:async path=>{requests.push(path);return{ok:true,json:async()=>({conversations:[],conversation:{uid:'alice'},messages:[]})};}};
  const source=fs.readFileSync(__dirname+'/../js/icadem-support-admin.js','utf8').replace(/\}\)\(\);\s*$/, 'window.__supportState=state;})();');
  vm.runInNewContext(source,context);events.adminready();await new Promise(setImmediate);assert.equal(interval,20000);
  context.window.__supportState.selected='alice';requests.length=0;timer();await new Promise(setImmediate);
  assert.ok(requests.includes('/admin/support/conversations'));assert.ok(requests.includes('/admin/support/conversations/alice'));
  context.__seccionActual='otra';requests.length=0;timer();await new Promise(setImmediate);assert.deepEqual(requests,['/admin/support/conversations']);
});
