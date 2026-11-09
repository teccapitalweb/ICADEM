'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-session.js','utf8');
function app(signOut=async()=>{},demo=false){
 const events=[],listeners={},routes=[],removed=[],auth={currentUser:{uid:'a'},authStateReady:async()=>{}};
 const window={__isDemoMode:demo,__currentUser:{uid:'a'},UserState:{uid:'a',modo:'vip'},memberData:{nombre:'A'},location:{replace:url=>routes.push(url),reload:()=>routes.push('reload')},addEventListener:(name,fn)=>listeners[name]=fn};
 const document={body:{style:{visibility:'visible'}},dispatchEvent:event=>events.push(event.type),querySelectorAll:()=>[]};
 vm.runInNewContext(source,{window,document,CustomEvent:class{constructor(type){this.type=type;}},localStorage:{removeItem:key=>removed.push(key)}});
 const session=window.ICADEMCreateSession({auth,signOut});return{session,window,document,events,listeners,routes,removed,auth};
}
test('double tapping logout performs one sign-out and discards in-flight hydration',async()=>{
 let finish,calls=0;const a=app(()=>{calls++;return new Promise(r=>finish=r);});const ticket=a.session.begin(a.auth.currentUser);
 assert.equal(a.session.current(ticket),true);const first=a.session.logout(),second=a.session.logout();assert.equal(first,second);assert.equal(a.session.current(ticket),false);
 await Promise.resolve();assert.equal(calls,1);a.auth.currentUser=null;a.session.signedOut();assert.equal(a.routes.length,0);
 finish();await first;assert.deepEqual(a.routes,['vip-auth.html?tab=login']);assert.equal(a.window.__currentUser,null);assert.equal(a.window.UserState.uid,null);
 assert.equal(a.document.body.style.visibility,'hidden');assert.deepEqual(a.removed,['icadem_profile','icadem_last_user']);
});
test('a failed logout keeps the account intact and permits a real retry',async()=>{
 let calls=0;const a=app(async()=>{if(++calls===1)throw Error('storage denied');});
 await assert.rejects(a.session.logout(),/storage denied/);assert.equal(a.window.__sessionEnding,false);assert.equal(a.window.UserState.uid,'a');assert.deepEqual(a.routes,[]);
 await a.session.logout();assert.equal(calls,2);assert.deepEqual(a.routes,['vip-auth.html?tab=login']);
});
test('demo exit never signs out the real account and arbitrary redirect URLs are refused',async()=>{
 let calls=0;const a=app(async()=>calls++,true);await a.session.logout({redirect:'https://other.example'});assert.equal(calls,0);assert.deepEqual(a.routes,['vip-auth.html?tab=login']);
});
test('deleted-account recovery has one destination even when Firebase emits null during signout',async()=>{
 let a;a=app(async()=>{a.auth.currentUser=null;a.session.signedOut();});await a.session.logout({redirect:'vip-auth.html?tab=register&deleted=1'});
 assert.deepEqual(a.routes,['vip-auth.html?tab=register&deleted=1']);
});
test('back/forward restored mobile pages cannot revive signed-out or switched identities',async()=>{
 const a=app();await a.session.logout();await a.listeners.pageshow({persisted:true});assert.equal(a.routes.at(-1),'vip-auth.html?tab=login');
 const b=app();b.auth.currentUser=null;await b.listeners.pageshow({persisted:true});assert.equal(b.routes.at(-1),'vip-auth.html?tab=login');
 const c=app();await c.listeners.pageshow({persisted:true});assert.equal(c.routes.at(-1),'reload');
});
test('an auth change invalidates prior hydration tickets',()=>{
 const a=app(),old=a.session.begin(a.auth.currentUser);a.auth.currentUser={uid:'b'};const next=a.session.begin(a.auth.currentUser);
 assert.equal(a.session.current(old),false);assert.equal(a.session.current(next),true);
});
test('responses arriving after logout cannot return private identity data to renderers',async()=>{
 const platform=fs.readFileSync(__dirname+'/../js/icadem-platform-v2.js','utf8');
 const snippet=platform.slice(platform.indexOf('  async function token()'),platform.indexOf('  function announce('));
 let finish;const window={__auth:{currentUser:{uid:'a',getIdToken:async()=>'test-token'}}};
 const context={window,API:'https://test.invalid',fetch:()=>new Promise(resolve=>finish=resolve),document:{querySelector(){return null;}}};
 vm.runInNewContext(snippet+';window.request=request;',context);
 const pending=window.request('/api/identity/sync');await new Promise(r=>setImmediate(r));window.__sessionEnding=true;
 finish({ok:true,json:async()=>({profile:{uid:'a'}})});await assert.rejects(pending,{code:'session-ended'});
});
test('closing two modals quickly releases scrolling without stale stack indexes',()=>{
 const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');let modal=panel.slice(panel.indexOf('const Modal=(function(){'),panel.indexOf('function openToolPlaceholder'));
 modal=modal.replace('return{open,close};','window.stack=stack;return{open,close};')+';window.Modal=Modal;';
 const timers=[],style={paddingRight:'',overflow:'auto'};
 function element(){return{classList:{add(){},remove(){}},dataset:{},setAttribute(){},appendChild(){},addEventListener(){},remove(){}};}
 const window={innerWidth:390},document={body:{style,appendChild(){}},documentElement:{clientWidth:390},addEventListener(){},createElement:element};
 vm.runInNewContext(modal,{window,document,Node:class{},requestAnimationFrame:fn=>fn(),setTimeout:fn=>timers.push(fn)});
 window.Modal.open({id:'one',title:'One'});window.Modal.open({id:'two',title:'Two'});window.Modal.close('one');window.Modal.close('one');window.Modal.close('two');
 timers.splice(0).forEach(fn=>fn());assert.equal(window.stack.length,0);assert.equal(style.overflow,'auto');
 window.Modal.open({id:'same',title:'Old'});window.Modal.close('same');window.Modal.open({id:'same',title:'New'});
 assert.equal(window.stack.length,1);timers.splice(0).forEach(fn=>fn());assert.equal(window.stack.length,1);
 window.Modal.close('same');timers.forEach(fn=>fn());assert.equal(window.stack.length,0);assert.equal(style.overflow,'auto');
});
