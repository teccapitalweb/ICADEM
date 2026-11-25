'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(read){
 const timers=new Map(),events={window:new Map(),document:new Map(),box:new Map(),root:new Map()},requests=[],results=[];let next=0;
 function surface(scope){return{addEventListener(name,fn){if(!events[scope].has(name))events[scope].set(name,new Set());events[scope].get(name).add(fn);},removeEventListener(name,fn){events[scope].get(name)?.delete(fn);}};}
 const model={focus:true,active:true,visible:true,occluded:false,connected:true,nodes:[]};
 const box={...surface('box'),getClientRects(){return model.visible?[this.getBoundingClientRect()]:[];},getBoundingClientRect(){return{top:100,bottom:700,left:0,right:450,width:450,height:600};},querySelectorAll(selector){return selector==='[data-support-incoming]'?model.nodes.filter(n=>n.incoming):model.nodes;}};
 const root={...surface('root'),get isConnected(){return model.connected;},querySelector(){return box;}};
 const document={...surface('document'),visibilityState:'visible',hasFocus:()=>model.focus,elementFromPoint(x,y){if(model.occluded)return {};return model.nodes.find(n=>n.marker.top<=y&&n.marker.bottom>=y)?.marker||null;}};
 const window={...surface('window'),innerWidth:500,innerHeight:800,ICADEMSupportUI:{icon(){return'';}}};
 const setTimeout=fn=>{timers.set(++next,fn);return next;},clearTimeout=id=>timers.delete(id);
 vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-support-messages.js','utf8'),{window,document,setTimeout,clearTimeout,requestAnimationFrame:setTimeout,cancelAnimationFrame:clearTimeout});
 function node(id,version=0,incoming=true,top=180){
  const attributes={'data-support-id':id,'data-support-revision':String(version)},marker={top,bottom:top+1,getBoundingClientRect(){return{top:this.top,bottom:this.bottom,left:30,right:130,width:100,height:1};}};
  const element={id,incoming,marker,getAttribute:key=>attributes[key],setAttribute(key,value){attributes[key]=String(value);},hasAttribute(){return false;},querySelector(selector){return selector==='[data-support-read-marker]'?marker:null;},contains(other){return other===marker;}};model.nodes.push(element);return element;
 }
 const tools=window.ICADEMSupportMessages.bind(root,{box:'#thread',active:()=>model.active,read:async body=>{const value=JSON.parse(JSON.stringify(body));requests.push(value);return read?read(value):{read:value.messages.map(item=>({...item,seenAt:'2026-11-25T00:00:00.000Z'}))};},readResult:value=>results.push(value)});
 function fire(scope,name){for(const fn of events[scope].get(name)||[])fn();}
 async function flush(){for(let step=0;step<8;step++){const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());await Promise.resolve();await Promise.resolve();}}
 return{model,document,node,tools,requests,results,fire,flush,timers,render:window.ICADEMSupportMessages};
}
const record=(id='incoming',revision=0)=>({id,revision,text:'Mensaje de prueba',seenAt:null,seenRevision:null});

test('a blurred window never acknowledges a message until actual focus policy becomes true',async()=>{
 const app=fixture();app.node('incoming');app.model.focus=false;app.tools.update([record()]);await app.flush();assert.equal(app.requests.length,0);
 app.model.focus=true;app.fire('window','focus');await app.flush();assert.deepEqual(app.requests,[{messages:[{id:'incoming',revision:0}]}]);
 app.fire('window','focus');await app.flush();assert.equal(app.requests.length,1,'the acknowledged version is not submitted twice');app.tools.dispose();
});

test('hidden, inactive, detached, offscreen and covered message markers cannot be marked seen',async()=>{
 const guards=[
  app=>{app.document.visibilityState='hidden';},
  app=>{app.model.active=false;},
  app=>{app.model.connected=false;},
  app=>{app.model.visible=false;},
  app=>{app.model.nodes[0].marker.top=710;app.model.nodes[0].marker.bottom=711;},
  app=>{app.model.occluded=true;}
 ];
 for(const guard of guards){const app=fixture();app.node('incoming');guard(app);app.tools.update([record()]);await app.flush();assert.equal(app.requests.length,0,guard.toString());app.tools.dispose();}
 const app=fixture();app.node('incoming');app.document.visibilityState='hidden';app.tools.update([record()]);await app.flush();app.document.visibilityState='visible';app.fire('document','visibilitychange');await app.flush();assert.equal(app.requests.length,1);app.tools.dispose();
});

test('only incoming DOM markers and the currently rendered revision are acknowledged',async()=>{
 const app=fixture();app.node('incoming',1,true,180);app.node('outgoing',0,false,210);
 app.tools.update([{...record('incoming',1),seenAt:'2026-11-24T00:00:00.000Z',seenRevision:0},record('outgoing')]);await app.flush();assert.deepEqual(app.requests,[{messages:[{id:'incoming',revision:1}]}]);app.tools.dispose();
});

test('withdrawal keeps a stale snapshot hidden and a restored revision gets a separate receipt',async()=>{
 const app=fixture();app.node('incoming');
 const withdrawn={...record('incoming',1),withdrawn:true,canRestore:true};
 app.tools.update([withdrawn]);await app.flush();assert.equal(app.requests.length,0);
 const stale=app.tools.reconcile([record()])[0];assert.equal(stale.withdrawn,true);
 assert.equal(app.render.bodyText(withdrawn),'Mensaje retirado');
 assert.doesNotMatch(app.render.meta(withdrawn,false,'12:00'),/data-support-read-marker|data-support-restore/);
 assert.match(app.render.meta(withdrawn,true,'12:00'),/data-support-restore/);
 app.tools.update([record('incoming',2)]);await app.flush();
 assert.deepEqual(app.requests,[{messages:[{id:'incoming',revision:2}]}]);
 app.tools.dispose();
});

test('an empty stale read response has no retry loop, and a later revision remains eligible',async()=>{
 let accept=false;const app=fixture(body=>({read:accept?body.messages.map(item=>({...item,seenAt:'2026-11-25T00:00:00.000Z'})):[]}));app.node('incoming');app.tools.update([record()]);await app.flush();await app.flush();assert.equal(app.requests.length,1,'no repeated stale POST without another update/event');
 accept=true;app.tools.update([record('incoming',1)]);await app.flush();assert.deepEqual(app.requests[1],{messages:[{id:'incoming',revision:1}]});app.fire('window','focus');await app.flush();assert.equal(app.requests.length,2);app.tools.dispose();
});

test('disposing a thread clears scheduled reads and ignores an in-flight acknowledgement',async()=>{
 let release;const app=fixture(()=>new Promise(resolve=>{release=resolve;}));app.node('incoming');app.tools.update([record()]);await app.flush();assert.equal(app.requests.length,1);app.tools.dispose();release({read:[{id:'incoming',revision:0,seenAt:'2026-11-25T00:00:00.000Z'}]});await app.flush();assert.equal(app.results.length,0);app.fire('window','focus');await app.flush();assert.equal(app.requests.length,1);
 const pending=fixture();pending.node('incoming');pending.tools.update([record()]);pending.tools.dispose();await pending.flush();assert.equal(pending.requests.length,0);
});
