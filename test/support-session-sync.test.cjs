'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-support-member.js','utf8');
const tick=()=>new Promise(setImmediate);
function fixture(){
  const events={},windowEvents={},requests=[],paints=[],statuses=[],timers=new Map();let timerId=0;
  const dot={hidden:false},box={},premium={getBoundingClientRect:()=>({width:1100})},form={};
  const root={isConnected:true,html:'',draft:'',querySelector(selector){
    if(selector==='[data-support-premium]')return this.html?premium:null;
    if(selector==='#support-messages')return box;if(selector==='#support-form')return form;
    return null;
  },replaceChildren(){this.html='';this.draft='';}};
  Object.defineProperty(root,'innerHTML',{get(){return this.html;},set(value){this.html=value;this.draft='';}});
  const ui={icon:()=>'',hero:()=>'',categoriesMarkup:()=>'',composerMarkup:()=>'',bindThread(){},
    bindCategories(){return{revision:()=>0,set(){},value:()=> 'membresia'};},
    bindComposer(){},syncMessages(_box,html){paints.push(html);},setCaseStatus(_root,status){statuses.push(status);}};
  const document={visibilityState:'visible',getElementById:id=>id==='support-unread-dot'?dot:null,addEventListener:(name,fn)=>events[name]=fn};
  const window={__auth:{currentUser:{uid:'a',getIdToken:async()=>'token-a'}},ICADEMSupportUI:ui,addEventListener:(name,fn)=>windowEvents[name]=fn};
  const context={window,document,Sections:{renderers:{}},location:{hash:'#soporte'},navigateToSection(){},
    setTimeout(){},setInterval(fn){timers.set(++timerId,fn);return timerId;},clearInterval(id){timers.delete(id);},
    fetch:(url,config)=>new Promise(resolve=>requests.push({url,config,finish:data=>resolve({ok:true,json:async()=>data})}))};
  const instrumented=source.replace(/\}\)\(\);\s*$/,'window.__supportAudit={request:request,ready:ready,refreshVisible:refreshVisible};})();');
  vm.runInNewContext(instrumented,context);
  return{...context,root,requests,paints,statuses,events,windowEvents,timers,dot,api:window.__supportAudit};
}

test('a support response from another UID is discarded and authenticated fetch disables caching',async()=>{
  const f=fixture(),pending=f.api.request('/support/me');await tick();
  assert.equal(f.requests[0].config.cache,'no-store');assert.equal(f.requests[0].config.headers.Authorization,'Bearer token-a');
  f.window.__auth.currentUser={uid:'b',getIdToken:async()=>'token-b'};
  f.requests[0].finish({messages:[{text:'Private A'}]});
  await assert.rejects(pending,{code:'session-ended'});assert.equal(f.paints.length,0);
});

test('switching identity while token renewal is pending never starts an old support fetch',async()=>{
  const f=fixture();let finishToken;
  f.window.__auth.currentUser.getIdToken=()=>new Promise(resolve=>finishToken=resolve);
  const pending=f.api.request('/support/me');f.window.__auth.currentUser={uid:'b',getIdToken:async()=>'token-b'};finishToken('old-token');
  await assert.rejects(pending,{code:'session-ended'});assert.equal(f.requests.length,0);
});

test('logout clears the visible private thread and polling; its late response cannot repaint it',async()=>{
  const f=fixture();f.Sections.renderers.soporte(f.root);await tick();assert.equal(f.timers.size,1);assert.ok(f.root.html);
  f.root.draft='Private draft A';f.window.__sessionEnding=true;f.events['icadem:session-ending']();
  assert.equal(f.timers.size,0);assert.equal(f.root.html,'');assert.equal(f.root.draft,'');assert.equal(f.dot.hidden,true);
  f.requests[0].finish({messages:[{id:'a',sender:'member',text:'Private A'}]});await tick();
  assert.equal(f.paints.length,0);assert.equal(f.root.html,'');
});

test('a switched account receives only its thread and previous badge responses cannot leak unread status',async()=>{
  const f=fixture();f.Sections.renderers.soporte(f.root);await tick();
  f.events['icadem:identity-ready']();await tick();
  const old=f.requests.slice();f.window.__auth.currentUser={uid:'b',getIdToken:async()=>'token-b'};
  f.events['icadem:user-ready']();await tick();
  old.forEach(request=>request.finish({messages:[{id:'a',sender:'member',text:'Private A'}],conversation:{unreadUser:9}}));await tick();
  assert.equal(f.paints.length,0);assert.equal(f.dot.hidden,true);
  const newReads=f.requests.filter(request=>!old.includes(request));
  for(const request of newReads)request.finish({messages:[{id:'b',sender:'member',text:'Private B'}],conversation:{unreadUser:0}});
  await tick();assert.equal(f.paints.length,1);assert.match(f.paints[0],/Private B/);assert.doesNotMatch(f.paints[0],/Private A/);
});

test('same-account identity refresh preserves composer text and reconnection reloads the confirmed thread',async()=>{
  const f=fixture();f.Sections.renderers.soporte(f.root);await tick();
  f.requests[0].finish({messages:[],conversation:{topic:'membresia'}});await tick();
  f.root.draft='My unsent text';f.events['icadem:identity-ready']();await tick();
  assert.equal(f.root.draft,'My unsent text');
  const before=f.requests.length;f.windowEvents.online();await tick();
  assert.equal(f.requests.length,before+1);assert.equal(f.root.draft,'My unsent text');
  assert.equal(f.requests.at(-1).url.endsWith('/support/me'),true);
  f.document.visibilityState='hidden';const hiddenBefore=f.requests.length;f.windowEvents.online();await tick();assert.equal(f.requests.length,hiddenBefore);
});
