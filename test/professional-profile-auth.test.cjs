'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sessionSource=fs.readFileSync(__dirname+'/../js/icadem-session.js','utf8');
const authSource=fs.readFileSync(__dirname+'/../vip-auth.html','utf8');
const destinationSource=authSource.slice(authSource.indexOf('function destinoSeguro('),authSource.indexOf('async function syncCentralIdentity('));
const origin='https://www.icademx.com';
const profile='vip-panel.html?profesional=member_ABC-123#directorio-perfil';
function loginRedirect(requested,isAdmin=false,extra='') {
  const search='?redirect='+encodeURIComponent(requested)+extra;
  const ctx={window:{location:{origin,search}},URL,URLSearchParams};
  vm.runInNewContext(destinationSource,ctx);return ctx.destinoSeguro(isAdmin);
}
function sessionAt(url) {
  const routes=[],listeners={},events=[],auth={currentUser:null,authStateReady:async()=>{}};
  const location=new URL(url,origin);
  const window={location:{href:location.href,origin,replace:value=>routes.push(value),reload:()=>routes.push('reload')},addEventListener:(name,fn)=>listeners[name]=fn};
  const document={body:{style:{visibility:'visible'}},querySelectorAll:()=>[],dispatchEvent:e=>events.push(e.type)};
  vm.runInNewContext(sessionSource,{window,document,URL,URLSearchParams,localStorage:{removeItem(){}},CustomEvent:class{constructor(type){this.type=type;}}});
  const session=window.ICADEMCreateSession({auth,signOut:async()=>{auth.currentUser=null;}});
  return {window,auth,routes,listeners,events,session};
}

test('a shared profile survives automatic sign-in redirect with only its target ID',()=>{
  const app=sessionAt('/vip-panel.html?profesional=member_ABC-123&ref=PRIVATE-CODE&email=private@example.test#directorio-perfil');
  app.session.signedOut();
  assert.equal(app.routes.length,1);
  const login=new URL(app.routes[0],origin);
  assert.equal(login.pathname,'/vip-auth.html');
  assert.equal(login.searchParams.get('tab'),'login');
  assert.equal(login.searchParams.get('redirect'),profile);
  assert.ok(!app.routes[0].includes('private'));
  assert.equal(app.window.UserState.uid,null);
  assert.equal(app.window.__currentUser,null);
});

test('profile redirect is available to an authenticated member or administrator without changing default destinations',()=>{
  assert.equal(loginRedirect(profile,false),profile);
  assert.equal(loginRedirect(profile,true),profile);
  assert.equal(loginRedirect('/vip-panel.html?profesional=member_ABC-123&ref=PRIVATE-CODE#directorio-perfil',true),profile);
  assert.equal(loginRedirect('vip-panel.html#suscripcion',false),'vip-panel.html#suscripcion');
  assert.equal(loginRedirect('vip-panel.html#suscripcion',true),'vip-admin.html');
  assert.equal(loginRedirect('https://external.example/path',false),'vip-panel.html');
  assert.equal(loginRedirect('https://external.example/path',true),'vip-admin.html');
});

test('malicious or malformed profile destinations never become open redirects or partial target routes',()=>{
  const bad=[
    'https://external.example/'+profile,
    '//external.example/'+profile,
    'https://user:password@www.icademx.com/'+profile,
    '/nested/'+profile,
    '/vip-panel-old.html?profesional=member_ABC-123#directorio-perfil',
    '/vip-panel.html?profesional=member%2FABC#directorio-perfil',
    '/vip-panel.html?profesional=member%20ABC#directorio-perfil',
    '/vip-panel.html?profesional=member#perfil',
    '/vip-panel.html?profesional=#directorio-perfil',
    '/vip-panel.html#directorio-perfil',
    '/vip-panel.html?profesional='+('a'.repeat(129))+'#directorio-perfil',
    'javascript:alert(1)',
  ];
  for(const target of bad){assert.equal(loginRedirect(target,false),'vip-panel.html',target);assert.equal(loginRedirect(target,true),'vip-admin.html',target);}
  const longest='vip-panel.html?profesional='+('a'.repeat(128))+'#directorio-perfil';
  assert.equal(loginRedirect(longest),longest);
});

test('automatic session loss preserves only a validated profile route, never unrelated or malformed state',()=>{
  for(const target of ['/vip-panel.html?profesional=bad%2Fuid#directorio-perfil','/vip-panel.html?profesional=a#directorio','/vip-admin.html?profesional=a#directorio-perfil','/vip-panel.html#cursos']){
    const app=sessionAt(target);app.session.signedOut();assert.deepEqual(app.routes,['vip-auth.html?tab=login']);
  }
});

test('explicit logout and deleted-account recovery never carry a profile target',async()=>{
  const ordinary=sessionAt('/'+profile);await ordinary.session.logout();assert.deepEqual(ordinary.routes,['vip-auth.html?tab=login']);
  const deleted=sessionAt('/'+profile);await deleted.session.logout({redirect:'vip-auth.html?tab=register&deleted=1'});assert.deepEqual(deleted.routes,['vip-auth.html?tab=register&deleted=1']);
});

test('a restored signed-out profile tab returns through sign-in, while explicitly closed sessions retain their logout destination',async()=>{
  const lost=sessionAt('/'+profile);await lost.listeners.pageshow({persisted:true});
  assert.equal(new URL(lost.routes[0],origin).searchParams.get('redirect'),profile);
  const closed=sessionAt('/'+profile);await closed.session.logout();await closed.listeners.pageshow({persisted:true});
  assert.deepEqual(closed.routes,['vip-auth.html?tab=login','vip-auth.html?tab=login']);
  const active=sessionAt('/'+profile);active.auth.currentUser={uid:'viewer'};await active.listeners.pageshow({persisted:true});assert.deepEqual(active.routes,['reload']);
});
