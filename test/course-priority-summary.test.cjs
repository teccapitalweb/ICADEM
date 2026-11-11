'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/icadem-course-unlocks.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
  let response={ok:true,enabled:true,revision:1,priorities:['missing','already-open','pending'],available:2};
  const listeners=new Map(),sent=[],window={__auth:{currentUser:{uid:'one'}},UserState:{uid:'one'},addEventListener(){},ICADEMPlatform:{request:async()=>response}};
  const document={querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>sent.push(event)};
  vm.runInNewContext(source,{window,document,Map,Set,Date,setTimeout,clearTimeout,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}});
  return {window,api:window.ICADEMCourseUnlocks,sent,set:value=>{response=value;},emit:name=>listeners.get(name)?.()};
}
test('priority positions expose only the confirmed backend order and return independent copies',async()=>{
  const f=fixture();assert.deepEqual(plain(f.api.getPriorities()),[]);await f.api.refresh();
  assert.deepEqual(plain(f.api.getPriorities()),['missing','already-open','pending']);
  const copy=f.api.getPriorities();copy.reverse();copy.push('local-draft');
  assert.deepEqual(plain(f.api.getPriorities()),['missing','already-open','pending']);
});
test('a confirmed order change emits the catalog refresh signal, while other summary changes do not',async()=>{
  const f=fixture();await f.api.refresh();assert.equal(f.sent.at(-1).detail.prioritiesChanged,true);
  f.set({ok:true,enabled:true,revision:2,priorities:['missing','already-open','pending'],available:9});await f.api.refresh();assert.equal(f.sent.at(-1).detail.prioritiesChanged,false);
  f.set({ok:true,enabled:true,revision:3,priorities:['pending','missing','already-open'],available:9});await f.api.refresh();
  assert.equal(f.sent.at(-1).detail.prioritiesChanged,true);assert.equal(f.sent.at(-1).detail.revision,3);assert.equal(f.sent.at(-1).detail.available,9);
});
test('a lower-revision response cannot replace current priority badges or request a stale resort',async()=>{
  const f=fixture();await f.api.refresh();f.set({ok:true,enabled:true,revision:5,priorities:['pending']});await f.api.refresh();const events=f.sent.length;
  f.set({ok:true,enabled:true,revision:4,priorities:['already-open','missing']});await f.api.refresh();
  assert.deepEqual(plain(f.api.getPriorities()),['pending']);assert.equal(f.sent.length,events);
});
test('demo, anonymous, switched and ending sessions cannot expose another session priorities',async()=>{
  const f=fixture();await f.api.refresh();
  f.window.__isDemoMode=true;assert.deepEqual(plain(f.api.getPriorities()),[]);f.window.__isDemoMode=false;
  f.window.__auth.currentUser=null;assert.deepEqual(plain(f.api.getPriorities()),[]);
  f.window.__auth.currentUser={uid:'two'};assert.deepEqual(plain(f.api.getPriorities()),[]);
  f.window.__auth.currentUser={uid:'one'};f.window.__sessionEnding=true;assert.deepEqual(plain(f.api.getPriorities()),[]);
  f.emit('icadem:session-ending');f.window.__sessionEnding=false;
  assert.deepEqual(plain(f.api.getPriorities()),[]);assert.equal(f.sent.at(-1).detail.reset,true);assert.equal(f.sent.at(-1).detail.prioritiesChanged,true);
});
test('feature-off responses clear effective priorities and signal the same safe catalog refresh',async()=>{
  const f=fixture();await f.api.refresh();f.set({ok:true,enabled:false,revision:2,priorities:['must-stay-hidden']});assert.equal(await f.api.refresh(),null);
  assert.deepEqual(plain(f.api.getPriorities()),[]);assert.equal(f.sent.at(-1).detail.prioritiesChanged,true);
});
test('a confirmed PUT acknowledgement updates priorities even if the follow-up GET fails',async()=>{
  const f=fixture();await f.api.refresh();
  assert.equal(f.api.adoptConfirmed({ok:true,enabled:true,revision:2,available:2,priorities:['pending','missing']},'one'),true);
  f.window.ICADEMPlatform.request=async()=>{throw new Error('No hay conexión');};await assert.rejects(f.api.refresh(),/conexión/);
  assert.deepEqual(plain(f.api.getPriorities()),['pending','missing']);assert.equal(f.sent.at(-1).detail.prioritiesChanged,true);
});
test('acknowledgements reject lower revisions, malformed confirmations and another or ending session',async()=>{
  const f=fixture();await f.api.refresh();f.api.adoptConfirmed({ok:true,revision:8,priorities:['pending']},'one');const events=f.sent.length;
  for(const data of [{ok:true,revision:7,priorities:['old']},{ok:false,revision:9,priorities:['invalid']},{ok:true,revision:-1,priorities:['invalid']},{ok:true,revision:8.5,priorities:['invalid']},{ok:true,revision:9}])assert.equal(f.api.adoptConfirmed(data,'one'),false);
  assert.equal(f.api.adoptConfirmed({ok:true,revision:9,priorities:['other']},'two'),false);
  f.window.__sessionEnding=true;assert.equal(f.api.adoptConfirmed({ok:true,revision:9,priorities:['ending']},'one'),false);f.window.__sessionEnding=false;
  assert.deepEqual(plain(f.api.getPriorities()),['pending']);assert.equal(f.sent.length,events);
  f.window.__auth.currentUser={uid:'two'};assert.equal(f.api.adoptConfirmed({ok:true,revision:9,priorities:['old-owner']},'one'),false);assert.deepEqual(plain(f.api.getPriorities()),[]);
});
