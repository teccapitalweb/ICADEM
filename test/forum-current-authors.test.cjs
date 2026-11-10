'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-forum-authors.js','utf8'),flush=()=>new Promise(setImmediate);
function app(){
  const events=new Map(),requests=[],links=[],navigations=[],timers=[];
  const document={visibilityState:'visible',querySelectorAll:()=>links,addEventListener(name,fn){events.set(name,fn);}};
  const window={__auth:{currentUser:{uid:'viewer'}},UserState:{uid:'viewer',identityReady:false},ICADEMProfessionalNavigation:{profileHref:uid=>'https://www.icademx.com/vip-panel.html?profesional='+uid+'#directorio-perfil',openProfile(uid){navigations.push(uid);return true;}},
    ICADEMPlatform:{request(path){return new Promise((resolve,reject)=>requests.push({path,resolve,reject}));}}};
  const context={window,document,location:{hash:'#foro'},Date,setInterval(fn){timers.push(fn);}};vm.runInNewContext(source,context);
  function link(uid,kind){const node={dataset:{foroAuthor:uid,foroAuthorKind:kind},innerHTML:'',textContent:'',attributes:{},handlers:{},classList:{toggle(name,on){node.hasPhoto=on;}},setAttribute(name,value){this.attributes[name]=value;},addEventListener(name,fn){this.handlers[name]=fn;}};links.push(node);return node;}
  return{window,document,api:window.ICADEMForumAuthors,requests,links,navigations,timers,link,emit(name,detail){events.get(name)?.({detail});}};
}
const old={uid:'writer',nombre:'Nombre al publicar',iniciales:'NP',foto:'https://images.test/obsolete.jpg'};
const current={uid:'writer',nombre:'Nombre actual',iniciales:'NA',foto:'https://images.test/current-token.jpg',photoSource:'custom',photoVersion:'2026-11-10T19:00:00Z'};

test('old posts and comments use the current public author photo, never their historical snapshot',async()=>{
  const a=app(),postAvatar=a.link('writer','avatar'),commentAvatar=a.link('writer','avatar'),name=a.link('writer','name');
  assert.doesNotMatch(a.api.markup(old,'avatar'),/obsolete/);assert.doesNotMatch(a.api.markup(old,'comment-avatar'),/obsolete/);
  const loading=a.api.hydrate([old,{...old,id:'old-comment'}]);assert.equal(a.requests.length,1);assert.match(a.requests[0].path,/\/api\/community\/authors\?uids=writer$/);
  a.requests[0].resolve({ok:true,authors:[current]});await loading;
  for(const node of[postAvatar,commentAvatar]){assert.match(node.innerHTML,/current-token/);assert.doesNotMatch(node.innerHTML,/obsolete/);}
  assert.equal(name.textContent,'Nombre actual');assert.match(a.api.markup(old,'name'),/Nombre actual/);
  assert.match(a.api.markup(old,'comment-avatar'),/profesional=writer#directorio-perfil/);
});

test('author hydration replaces only identity content and preserves comment controls and drafts',async()=>{
  const a=app(),avatar=a.link('writer','avatar'),name=a.link('writer','name'),draft={value:'Mi respuesta sin guardar'},card={avatar,name,draft};
  const root={querySelectorAll:()=>[avatar,name]};a.api.bind(root);let prevented=false;
  avatar.handlers.click({button:0,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.deepEqual(a.navigations,['writer']);
  name.handlers.click({button:0,ctrlKey:true,preventDefault(){throw Error('native modified navigation must remain available');}});assert.equal(a.navigations.length,1);
  const pending=a.api.hydrate([old]);a.requests[0].resolve({ok:true,authors:[current]});await pending;
  assert.equal(card.avatar,avatar);assert.equal(card.name,name);assert.equal(card.draft,draft);assert.equal(draft.value,'Mi respuesta sin guardar');
});

test('canonical own photo updates all old author nodes after identity acknowledgement',()=>{
  const a=app(),post=a.link('viewer','avatar'),comment=a.link('viewer','avatar');
  a.window.UserState={uid:'viewer',identityReady:true,photoURL:'https://images.test/custom.jpg',photoSource:'custom',displayName:'Mi nombre'};
  a.emit('icadem:identity-ready',{profile:{uid:'viewer'}});assert.match(post.innerHTML,/custom/);assert.match(comment.innerHTML,/custom/);
  a.window.UserState.photoURL='https://googleusercontent.com/new.jpg';a.window.UserState.photoSource='google';a.emit('icadem:identity-ready',{profile:{uid:'viewer'}});
  assert.match(post.innerHTML,/new\.jpg/);assert.match(comment.innerHTML,/new\.jpg/);assert.doesNotMatch(post.innerHTML,/custom/);
});

test('late responses cannot repopulate identity data after logout or an account change',async()=>{
  const a=app();const pending=a.api.hydrate([old]);a.window.__sessionEnding=true;a.emit('icadem:session-ending');
  a.window.__auth.currentUser={uid:'second-viewer'};a.window.UserState={uid:'second-viewer',identityReady:false};a.window.__sessionEnding=false;a.emit('icadem:user-ready');
  a.requests[0].resolve({ok:true,authors:[current]});await pending;
  assert.doesNotMatch(a.api.markup(old,'avatar'),/current-token/);
  const fresh=a.api.hydrate([old]);assert.equal(a.requests.length,2);a.requests[1].resolve({ok:true,authors:[{...current,foto:'https://images.test/latest.jpg'}]});await fresh;
  assert.match(a.api.markup(old,'avatar'),/latest/);
});

test('batching deduplicates authors, caps each request at 100 and a network failure retains confirmed photos',async()=>{
  const a=app(),items=Array.from({length:201},(_,i)=>({uid:'author-'+i}));
  const loading=a.api.hydrate(items.concat(items));assert.equal(a.requests.length,3);
  for(const request of a.requests){const ids=decodeURIComponent(request.path.split('uids=')[1]).split(',');assert.ok(ids.length<=100);request.resolve({ok:true,authors:ids.map(uid=>({...current,uid}))});}await loading;
  const refresh=a.api.hydrate([{uid:'author-0'}],true);a.requests.at(-1).reject(new Error('offline'));await refresh;
  assert.match(a.api.markup({uid:'author-0'},'avatar'),/current-token/);
});

test('invalid author targets and unsafe images cannot become executable links',async()=>{
  const a=app();for(const uid of['','../private','bad&contact=email','https://evil.test'])assert.doesNotMatch(a.api.markup({uid,nombre:'<script>'},'name'),/href=|data-foro-author=/);
  const pending=a.api.hydrate([old]);a.requests[0].resolve({ok:true,authors:[{...current,nombre:'<img onerror=alert(1)>',foto:'javascript:alert(1)'}]});await pending;
  assert.doesNotMatch(a.api.markup(old,'avatar'),/javascript:/);assert.match(a.api.markup(old,'name'),/&lt;img onerror=alert\(1\)&gt;/);
});

test('visibility refresh reads current server authors without writing historical posts or comments',async()=>{
  const a=app();a.link('writer','avatar');const pending=a.api.hydrate([old]);a.requests[0].resolve({ok:true,authors:[current]});await pending;
  a.document.visibilityState='hidden';a.emit('visibilitychange');assert.equal(a.requests.length,1);
  a.document.visibilityState='visible';a.emit('visibilitychange');assert.equal(a.requests.length,2);a.requests[1].resolve({ok:true,authors:[{...current,foto:'https://images.test/fresh.jpg'}]});await flush();
  assert.match(a.api.markup(old,'comment-avatar'),/fresh/);assert.ok(a.requests.every(item=>item.path.startsWith('/api/community/authors?')));
});

test('user-ready immediately recovers authors rendered during the prior loading generation after platform handlers finish',async()=>{
  const a=app(),avatar=a.link('writer','avatar'),name=a.link('writer','name');name.textContent=old.nombre;
  const first=a.api.hydrate([old]);assert.equal(a.requests.length,1);
  const request=a.window.ICADEMPlatform.request;let platformReady=false;
  a.window.ICADEMPlatform.request=path=>{assert.equal(platformReady,true,'new reads must use the post-ready platform request scope');return request(path);};
  a.emit('icadem:user-ready');assert.equal(a.requests.length,1);platformReady=true;await flush();assert.equal(a.requests.length,2);
  a.requests[1].resolve({ok:true,authors:[current]});await flush();assert.equal(name.textContent,'Nombre actual');assert.match(avatar.innerHTML,/current-token/);
  a.requests[0].resolve({ok:true,authors:[{...current,nombre:'Respuesta obsoleta',foto:old.foto}]});await first;
  assert.equal(name.textContent,'Nombre actual');assert.doesNotMatch(avatar.innerHTML,/obsolete/);assert.match(a.api.markup(old,'name'),/Nombre actual/);
});

test('a queued user-ready author recovery cannot run after another session-ending signal',async()=>{
  const a=app();a.link('writer','avatar');a.emit('icadem:user-ready');a.window.__sessionEnding=true;a.emit('icadem:session-ending');await flush();assert.equal(a.requests.length,0);
});
