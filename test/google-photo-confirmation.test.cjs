'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
const start=panel.indexOf('window.__syncGoogleAccount = async function(){'),end=panel.indexOf('window.__linkGoogleAccount =',start),source=panel.slice(start,end);
const flush=()=>new Promise(setImmediate);
function app(){
  let confirm,identityCalls=0,applies=0;
  const user={uid:'a',photoURL:'https://googleusercontent.com/new.jpg',providerData:[{providerId:'google.com',photoURL:'https://googleusercontent.com/new.jpg'}],async getIdToken(){return 'test';}};
  const auth={currentUser:user},window={UserState:{uid:'a',photoURL:'https://images.test/custom.jpg',photoSource:'custom'},__applyUserState(){applies++;},
    ICADEMPlatform:{syncIdentity(force,options){identityCalls++;assert.equal(force,true);assert.equal(options.photoPreference,'google');return new Promise(resolve=>{confirm=resolve;});}}};
  const context={window,auth,GoogleAuthProvider:class{setCustomParameters(){}},reauthenticateWithPopup:async()=>({user}),linkWithPopup:async()=>({user}),reload:async()=>{}};
  vm.runInNewContext(source,context);return{window,auth,user,context,confirm(data){confirm(data);},get calls(){return identityCalls;},get applies(){return applies;}};
}
test('the actual Google photo action keeps the current photograph until the backend confirms its preference',async()=>{
  const a=app(),sync=a.window.__syncGoogleAccount();await flush();assert.equal(a.calls,1);assert.equal(a.window.UserState.photoURL,'https://images.test/custom.jpg');assert.equal(a.applies,0);
  a.window.UserState.photoURL=a.user.photoURL;a.window.UserState.photoSource='google';a.confirm({profile:{uid:'a',photoSource:'google',photoURL:a.user.photoURL}});assert.equal(await sync,a.user);assert.equal(a.applies,1);
});
test('a failed acknowledgement never claims success or replaces a custom photograph',async()=>{
  const a=app(),sync=a.window.__syncGoogleAccount();await flush();a.confirm(null);await assert.rejects(sync,/confirmar/);assert.equal(a.window.UserState.photoURL,'https://images.test/custom.jpg');assert.equal(a.applies,0);
});
test('a Google popup for another account is discarded before any identity preference request',async()=>{
  const a=app();a.context.reauthenticateWithPopup=async()=>({user:{...a.user,uid:'b'}});await assert.rejects(a.window.__syncGoogleAccount(),/sesión cambió/);assert.equal(a.calls,0);assert.equal(a.window.UserState.photoURL,'https://images.test/custom.jpg');
});
test('the real avatar helper versions Google photos by their author while preserving signed custom asset URLs',()=>{
  const begin=panel.indexOf('let avatarCacheVersion ='),end=panel.indexOf('window.__syncGoogleAccount =',begin),context={window:{location:{origin:'https://www.icademx.com'}},URL,Date};
  vm.runInNewContext(panel.slice(begin,end),context);const url='https://lh3.googleusercontent.com/photo=s96-c';
  const first=context.window.__avatarSrc(url,'author-photo-1'),next=context.window.__avatarSrc(url,'author-photo-2');
  assert.equal(new URL(first).searchParams.get('icadem_avatar'),'author-photo-1');assert.equal(new URL(next).searchParams.get('icadem_avatar'),'author-photo-2');assert.notEqual(first,next);
  const custom='https://storage.example.test/avatar?token=unique-signature';assert.equal(context.window.__avatarSrc(custom,'photo-version'),custom);
});
