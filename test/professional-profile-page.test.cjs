'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(__dirname+'/../js/'+name,'utf8');
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(respond,initial='professional'){
  const profiles=[],calls=[],opened=[],closed=[],notices=[],copied=[],navigations=[],timers=[],listeners={};
  let document;
  class Element{
    constructor(tag='div'){this.tagName=tag;this.dataset={};this.attrs={};this.handlers={};this.children=[];this.buttons=[];this.isConnected=true;this.disabled=false;this.style={};this._html='';this.focused=0;}
    set innerHTML(value){
      this._html=String(value);this.buttons=[];
      for(const match of this._html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
        const button=new Element('button');button._html=match[2];
        for(const attr of match[1].matchAll(/(data-[\w-]+)(?:="([^"]*)")?/g))button.dataset[attr[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attr[2]||'';
        button.disabled=/\bdisabled\b/.test(match[1]);button.attrs.type=(match[1].match(/type="([^"]*)"/)||[])[1]||'';this.buttons.push(button);
      }
      if(this._html.includes('class="professional-profile-shell"')){
        if(this.profile)this.profile.isConnected=false;
        this.profile=new Element();this.profile.host=this;this.profile._html='Cargando perfil profesional…';profiles.push(this.profile);
      }
    }
    get innerHTML(){return this._html;}
    set textContent(value){this._html=String(value);}
    get textContent(){return this._html.replace(/<[^>]*>/g,'');}
    querySelector(selector){
      if(selector==='.community-profile')return this.profile||null;
      if(selector==='h1'&&this._html.includes('<h1')){this.heading=this.heading||new Element('h1');return this.heading;}
      if(selector==='button')return this.buttons[0]||null;
      if(selector==='[type=submit]')return this.buttons.find(button=>button.attrs.type==='submit')||null;
      return this.querySelectorAll(selector)[0]||null;
    }
    querySelectorAll(selector){
      const key=(selector.match(/^\[data-([\w-]+)\]$/)||[])[1];
      if(key){const name=key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return this.buttons.filter(button=>Object.hasOwn(button.dataset,name));}
      return [];
    }
    closest(selector){return selector==='[data-professional-view]'?this.host:null;}
    setAttribute(key,value){this.attrs[key]=value;}
    removeAttribute(key){delete this.attrs[key];}
    addEventListener(name,fn){(this.handlers[name]||=[]).push(fn);}
    click(){if(this.disabled)return;for(const fn of this.handlers.click||[])fn({currentTarget:this,stopPropagation(){},preventDefault(){}});}
    appendChild(node){this.children.push(node);}
    append(node){this.children.push(node);}
    replaceChildren(){if(this.profile)this.profile.isConnected=false;this.profile=null;this.buttons=[];this._html='';}
    focus(){this.focused++;document.activeElement=this;}
    remove(){this.isConnected=false;}
    select(){}
  }
  const container=new Element();
  document={title:'ICADEM · Panel VIP',activeElement:null,body:new Element('body'),documentElement:{},scrollingElement:{},
    addEventListener(name,fn){(listeners[name]||=[]).push(fn);},createElement:tag=>new Element(tag),getElementById(){return null;},querySelector(){return null;},
    querySelectorAll(selector){return selector.startsWith('.community-profile')?profiles.filter(node=>node.isConnected&&(!selector.includes('[data-profile-uid]')||node.dataset.profileUid)):[];}};
  const location=new URL('https://www.icademx.com/vip-panel.html?curso=private-course&profesional='+encodeURIComponent(initial)+'&ref=private-code#directorio-perfil');
  const window={UserState:{uid:'viewer'},__currentUser:{uid:'viewer'},ICADEMDirectory:{appearance:(p,vip)=>({color:vip?'#e9bc43':'#244b61',image:vip?p.portadaUrl||'':''})},
    ICADEMPlatform:{request:(path,options)=>{calls.push({path,options});return respond(path,options);}},navigateToSection:(section,options)=>navigations.push({section,options}),scrollTo(){}};
  const context={window,document,location,history:{state:null,length:1,go(){}},sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    navigator:{clipboard:{writeText:async value=>copied.push(value)}},URL,URLSearchParams,console,
    setTimeout:fn=>timers.push(fn),clearInterval(){},setInterval(){},requestAnimationFrame:fn=>fn()};
  vm.runInNewContext(read('icadem-professional-navigation.js'),context);
  vm.runInNewContext(read('icadem-professional-profile.js'),context);
  vm.runInNewContext(read('icadem-community.js'),context);
  const options={modal:{close:id=>closed.push(id),open:value=>{opened.push(value);return{close:()=>closed.push(value.id)};}},toast:{success:(...args)=>notices.push(['success',...args]),error:(...args)=>notices.push(['error',...args])},editCard:()=>notices.push(['edit-card'])};
  return{api:window.ICADEMCommunity,window,document,container,calls,opened,closed,notices,copied,navigations,timers,
    render(uid=initial){location.search='?curso=private-course&profesional='+encodeURIComponent(uid)+'&ref=private-code';location.hash='#directorio-perfil';window.ICADEMCommunity.renderProfilePage(container,options);return container.profile;},
    flushTimers(){while(timers.length)timers.shift()();},emit(name){for(const fn of listeners[name]||[])fn();}};
}
function professional(extra={}){return{uid:'professional',nombre:'Profesional de prueba',connection:'none',isVip:true,contacts:{},cv:{},...extra};}

test('the actual community page renders a dedicated profile through the existing API with no profile modal',async()=>{
  const f=fixture(async()=>({profile:professional()}));const node=f.render();
  assert.match(f.container.innerHTML,/data-professional-view/);assert.equal(f.container.querySelector('[data-professional-copy]').disabled,true);
  await settle();
  assert.deepEqual(plain(f.calls),[{path:'/api/community/profiles/professional'}]);
  assert.equal(node.dataset.profileUid,'professional');assert.match(node.innerHTML,/professional-profile-page/);
  assert.equal(f.opened.length,0);assert.ok(!node.innerHTML.includes('aria-modal'));
  assert.equal(f.container.querySelector('[data-professional-copy]').disabled,false);assert.equal(node.heading.focused,1);
  assert.equal(f.document.title,'Profesional de prueba · Perfil profesional | ICADEM');
});

test('a failed target has a compact retry, keeps sharing disabled and replaces the error only after a successful retry',async()=>{
  let attempt=0;const f=fixture(async()=>{if(++attempt===1)throw Error('<img src=x onerror=alert(1)>');return{profile:professional()};});
  const node=f.render();await settle();
  assert.match(node.innerHTML,/&lt;img/);assert.ok(!node.innerHTML.includes('<img src=x'));
  assert.equal(f.container.querySelector('[data-professional-copy]').disabled,true);
  node.querySelector('button').click();await settle();
  assert.equal(f.calls.length,2);assert.equal(node.dataset.profileUid,'professional');assert.match(node.innerHTML,/Profesional de prueba/);
  assert.equal(f.container.querySelector('[data-professional-copy]').disabled,false);
});

test('unknown or malformed profile IDs do not make a lookup or invent a professional',async()=>{
  const f=fixture(async()=>{throw Error('unexpected request');});
  for(const id of ['', '../private', 'other/uid','x'.repeat(129)]){
    const node=f.render(id);await settle();assert.match(node.innerHTML,/Perfil no disponible/);assert.equal(node.dataset.profileUid,undefined);
  }
  assert.equal(f.calls.length,0);assert.equal(f.opened.length,0);
});

test('late success or failure from a previous profile cannot replace the current target',async()=>{
  let resolveA,rejectA;
  const f=fixture(path=>path.endsWith('/alice')?new Promise((resolve,reject)=>{resolveA=resolve;rejectA=reject;}):Promise.resolve({profile:professional({uid:'bob',nombre:'Bob'})}));
  const old=f.render('alice');const current=f.render('bob');await settle();
  resolveA({profile:professional({uid:'alice',nombre:'Private Alice'})});await settle();
  assert.equal(old.dataset.profileUid,undefined);assert.equal(current.dataset.profileUid,'bob');assert.ok(!current.innerHTML.includes('Private Alice'));
  assert.equal(f.document.title,'Bob · Perfil profesional | ICADEM');
  const stale=f.render('alice');f.render('bob');await settle();rejectA(Error('Private stale error'));await settle();assert.ok(!stale.innerHTML.includes('Private stale error'));
});

test('a response arriving after the viewer changes never renders the prior session profile',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));const node=f.render();
  f.window.UserState={uid:'different-viewer'};f.window.__currentUser={uid:'different-viewer'};
  finish({profile:professional({nombre:'Prior session private result'})});await settle();
  assert.equal(node.dataset.profileUid,undefined);assert.ok(!node.innerHTML.includes('Prior session'));assert.equal(f.container.querySelector('[data-professional-copy]').disabled,true);
});

test('copying a loaded profile shares only its clean stable URL, never course, referral or contact data',async()=>{
  const f=fixture(async()=>({profile:professional({contacts:{email:'private@example.test',whatsapp:'+525555555555'}})}));f.render();await settle();
  f.container.querySelector('[data-professional-copy]').click();await settle();
  assert.deepEqual(f.copied,['https://www.icademx.com/vip-panel.html?profesional=professional#directorio-perfil']);
  assert.equal(f.notices.at(-1)[0],'success');
  assert.ok(!f.copied[0].includes('private'));assert.equal(f.opened.length,0);
});

test('Connect reuses the existing endpoint, sends once while pending and refreshes the current page state',async()=>{
  let connection='none',complete;
  const f=fixture((path,options)=>{
    if(options?.method==='POST')return new Promise(resolve=>{complete=()=>{connection='sent';resolve({connection});};});
    return Promise.resolve({profile:professional({connection})});
  });
  const node=f.render();await settle();const button=node.querySelector('[data-connect]');button.click();button.click();
  assert.equal(f.calls.filter(item=>item.options?.method==='POST').length,1);
  assert.deepEqual(plain(f.calls[1]),{path:'/api/community/connections',options:{method:'POST',body:{targetUid:'professional'}}});
  assert.equal(button.disabled,true);complete();await settle();
  assert.match(node.innerHTML,/Solicitud pendiente/);assert.equal(f.calls.length,3);assert.equal(f.opened.length,0);
});

test('accepting or rejecting on the page reuses the connection APIs and renders only freshly authorized contacts',async()=>{
  for(const action of ['accept','reject']){
    let connection='received';
    const f=fixture(async(path,options)=>{
      if(options?.method==='POST'){connection=action==='accept'?'connected':'none';return{connection};}
      return{profile:professional({connection,contacts:connection==='connected'?{email:'allowed@example.test'}:{}})};
    });
    const node=f.render();await settle();
    const button=node.querySelectorAll('[data-network-action]').find(button=>button.dataset.networkAction===action);assert.ok(button);button.click();await settle();
    assert.equal(f.calls[1].path,'/api/community/connections/professional/'+action);
    assert.equal(f.calls[1].options.method,'POST');assert.equal(f.calls[2].path,'/api/community/profiles/professional');
    assert.equal(node.innerHTML.includes('mailto:allowed@example.test'),action==='accept');assert.equal(f.opened.length,0);
  }
});

test('owned profile edit actions open sections of the same owner editor without creating either old modal',async()=>{
  const f=fixture(async()=>({profile:professional({uid:'viewer',own:true,connection:'self',contactScopes:{}})}),'viewer');
  const node=f.render('viewer');await settle();
  node.querySelector('[data-edit-cv]').click();assert.equal(f.opened.length,0);assert.equal(f.navigations.at(-1).options.editSection,'basicos');assert.equal(f.navigations.at(-1).options.profileUid,'viewer');
  node.querySelector('[data-edit-card]').click();assert.equal(f.navigations.at(-1).options.editSection,'apariencia');assert.equal(f.navigations.at(-1).options.profileUid,'viewer');assert.equal(f.opened.length,0);
});

test('the successful card-save refresh hook reloads an owned page photo, cover and identity from the current API',async()=>{
  let saved=false;
  const f=fixture(async()=>({profile:professional({uid:'viewer',own:true,connection:'self',nombre:saved?'Nombre actualizado':'Nombre anterior',foto:'https://example.test/'+(saved?'new-photo':'old-photo')+'.jpg',portadaUrl:'https://example.test/'+(saved?'new-cover':'old-cover')+'.jpg',contactScopes:{}})}),'viewer');
  const node=f.render('viewer');await settle();assert.match(node.innerHTML,/old-photo/);assert.match(node.innerHTML,/old-cover/);
  saved=true;await f.api.refreshCurrentProfile();
  assert.equal(f.calls.length,2);assert.equal(f.calls[1].path,'/api/community/profiles/viewer');
  assert.match(node.innerHTML,/Nombre actualizado/);assert.match(node.innerHTML,/new-photo/);assert.match(node.innerHTML,/new-cover/);
  assert.ok(!node.innerHTML.includes('old-photo'));assert.ok(!node.innerHTML.includes('old-cover'));assert.equal(f.opened.length,0);
  f.window.UserState={uid:'other-session'};await f.api.refreshCurrentProfile();assert.equal(f.calls.length,2);
});

test('the owned card-save refresh hook does not reload an unrelated, detached or already exited profile page',async()=>{
  const f=fixture(async()=>({profile:professional()}));f.render();await settle();await f.api.refreshCurrentProfile();assert.equal(f.calls.length,1);
  const own=fixture(async()=>({profile:professional({uid:'viewer',own:true,connection:'self',contactScopes:{}})}),'viewer');
  own.render('viewer');await settle();own.container.isConnected=false;await own.api.refreshCurrentProfile();assert.equal(own.calls.length,1);
  own.container.isConnected=true;own.api.cleanup();await own.api.refreshCurrentProfile();assert.equal(own.calls.length,1);
});

test('missing owner cards reuse identity bootstrap before opening the unified editor; foreign missing cards never expose editing',async()=>{
  let created=false;
  const own=fixture(async()=>{if(!created)throw Object.assign(Error('Este perfil no está disponible.'),{status:404});return{profile:professional({uid:'viewer',own:true,connection:'self',contactScopes:{}})};},'viewer');
  const node=own.render('viewer');await settle();
  assert.match(node.innerHTML,/Completa tu perfil profesional/);assert.equal(node.dataset.profileUid,'viewer');
  assert.equal(own.container.querySelector('[data-professional-copy]').disabled,true);
  let identityCalls=0;own.window.ICADEMPlatform.syncIdentity=async()=>{identityCalls++;created=true;};
  node.querySelector('[data-create-own-profile]').click();await settle();assert.equal(identityCalls,1);assert.equal(own.navigations.at(-1).options.editSection,'basicos');assert.equal(own.navigations.at(-1).options.profileUid,'viewer');assert.equal(own.opened.length,0);
  created=true;await own.api.refreshCurrentProfile();assert.match(node.innerHTML,/professional-profile-page/);assert.equal(own.container.querySelector('[data-professional-copy]').disabled,false);
  const foreign=fixture(async()=>{throw Object.assign(Error('Este perfil no está disponible.'),{status:404});});const unavailable=foreign.render();await settle();
  assert.match(unavailable.innerHTML,/Perfil no disponible/);assert.equal(unavailable.querySelector('[data-create-own-profile]'),null);assert.equal(unavailable.querySelector('[data-edit-card]'),null);
  assert.equal(foreign.container.querySelector('[data-professional-copy]').disabled,true);assert.equal(foreign.opened.length,0);
});

test('session ending clears the dedicated profile immediately and cannot revive it with a late owned refresh',async()=>{
  let resolveRefresh,count=0;
  const f=fixture(async()=>{if(++count===1)return{profile:professional({uid:'viewer',own:true,connection:'self',contactScopes:{}})};return new Promise(resolve=>{resolveRefresh=resolve;});},'viewer');
  const node=f.render('viewer');await settle();const refresh=f.api.refreshCurrentProfile();
  f.emit('icadem:session-ending');assert.equal(f.container.innerHTML,'');assert.equal(node.isConnected,false);
  resolveRefresh({profile:professional({uid:'viewer',own:true,nombre:'Private stale refresh',contactScopes:{}})});await refresh;await settle();
  assert.equal(f.container.innerHTML,'');assert.ok(!node.innerHTML.includes('Private stale refresh'));
});
