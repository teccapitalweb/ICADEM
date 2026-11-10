'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname+'/../js/icadem-notifications.js','utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function event(id='event-1',extra={}){return {id,tipo:'connection_request',titulo:'Nueva solicitud de conexión',descripcion:'Ana quiere conectar contigo.',createdAtMs:200,read:false,target:{section:'directorio',view:'requests',profileUid:'ana'},...extra};}
function app(options={}){
  const listeners={},timeouts=[],intervals=new Map(),calls=[],errors=[],routes=[],callbacks=[];
  let nextInterval=0,implementation=options.request|| (async()=>({items:[]})),badgeUpdates=0,closed=0;
  const document={visibilityState:'visible',addEventListener(name,fn){(listeners[name]||=[]).push(fn);},getElementById(){return null;}};
  const window={__notifsState:{items:[],generalItems:[],personalItems:[]},__currentUser:options.uid?{uid:options.uid}:null,
    ICADEMPlatform:{request(path,config){calls.push({path,config});return implementation(path,config);}},
    actualizarBadgeNotif(){badgeUpdates++;},cerrarNotifDropdown(){closed++;},navigateToSection(section){routes.push(section);},
    ICADEMCommunity:{openNotificationTarget(){callbacks.push('directorio');}},ICADEMAmbassadors:{openNotificationTarget(){callbacks.push('embajadores');}},
    Toast:{error(...args){errors.push(args);}},
  };
  const context={window,document,setTimeout(fn){timeouts.push(fn);return timeouts.length;},setInterval(fn){const id=++nextInterval;intervals.set(id,fn);return id;},clearInterval(id){intervals.delete(id);}};
  vm.runInNewContext(source,context);
  return {window,document,calls,errors,routes,callbacks,intervals,
    api:window.ICADEMNotifications,setRequest(fn){implementation=fn;},
    async boot(){timeouts.shift()?.();await flush();},
    async emit(name){for(const fn of listeners[name]||[])fn();await flush();},
    async user(uid){window.__currentUser=uid?{uid}:null;await this.emit('icadem:user-ready');},
    badges:()=>badgeUpdates,closes:()=>closed,
  };
}

test('personal API enriches the existing general bell only after authentication and keeps announcement IDs distinct',async()=>{
  const ui=app({request:async()=>({items:[event('same-id')]})});
  await ui.boot();assert.equal(ui.calls.length,0);
  const general={id:'same-id',titulo:'Clase existente',createdAtMs:100};
  ui.api.setGeneral([general]);
  await ui.user('alice');
  assert.equal(ui.calls[0].path,'/api/notifications/personal');
  assert.deepEqual(Array.from(ui.window.__notifsState.items,item=>item.id),['personal-same-id','same-id']);
  assert.equal(ui.window.__notifsState.generalItems[0],general);
  assert.equal(ui.window.__notifsState.personalItems[0].serverId,'same-id');
  assert.equal(ui.window.__notifsState.personalItems[0].personal,true);
  assert.ok(ui.badges()>0);
});

test('read and dismiss await server persistence and send server IDs while leaving general notices untouched',async()=>{
  const ui=app({uid:'alice',request:async()=>({items:[event()]})});await ui.boot();
  const general={id:'global',createdAtMs:50};ui.api.setGeneral([general]);
  let response=deferred();ui.setRequest(()=>response.promise);
  const reading=ui.api.mark(['personal-event-1','global'],false);
  assert.equal(ui.window.__notifsState.personalItems[0].read,false);
  assert.equal(ui.calls.at(-1).path,'/api/notifications/personal/read');
  assert.equal(JSON.stringify(ui.calls.at(-1).config.body),JSON.stringify({ids:['event-1']}));
  response.resolve({ok:true});await reading;
  assert.equal(ui.window.__notifsState.personalItems[0].read,true);
  response=deferred();const dismissing=ui.api.mark(['personal-event-1'],true);
  assert.equal(ui.window.__notifsState.personalItems.length,1);
  response.resolve({ok:true});await dismissing;
  assert.equal(ui.window.__notifsState.personalItems.length,0);
  assert.equal(ui.window.__notifsState.items[0],general);
  assert.equal(ui.calls.at(-1).path,'/api/notifications/personal/dismiss');
});

test('failed read/dismiss and offline refresh preserve the last confirmed notification state',async()=>{
  const ui=app({uid:'alice',request:async()=>({items:[event()]})});await ui.boot();
  ui.setRequest(async()=>{throw new Error('Offline');});
  await ui.api.mark(['personal-event-1'],false);
  assert.equal(ui.window.__notifsState.personalItems[0].read,false);
  await ui.api.mark(['personal-event-1'],true);
  assert.equal(ui.window.__notifsState.personalItems.length,1);
  await ui.api.sync();
  assert.equal(ui.window.__notifsState.personalItems[0].id,'personal-event-1');
  assert.equal(ui.errors.length,2);
});

test('late requests from a previous authenticated session cannot leak into the next account',async()=>{
  const alice=deferred(),bob=deferred();
  const ui=app({uid:'alice',request:()=>alice.promise});await ui.boot();
  ui.setRequest(()=>bob.promise);await ui.user('bob');
  bob.resolve({items:[event('bob-event')]});await flush();
  alice.resolve({items:[event('alice-private')]});await flush();
  assert.deepEqual(Array.from(ui.window.__notifsState.personalItems,item=>item.serverId),['bob-event']);
  assert.equal(ui.window.__notifsState.items.some(item=>item.serverId==='alice-private'),false);
});

test('a late mutation acknowledgement from the previous account cannot remove the new account event',async()=>{
  const ui=app({uid:'alice',request:async()=>({items:[event('same')]})});await ui.boot();
  const acknowledgement=deferred();ui.setRequest(()=>acknowledgement.promise);
  const removing=ui.api.mark(['personal-same'],true);
  ui.setRequest(async()=>({items:[event('same',{titulo:'Bob event'})]}));await ui.user('bob');
  acknowledgement.resolve({ok:true});await removing;
  assert.equal(ui.window.__notifsState.personalItems[0].titulo,'Bob event');
});

test('navigation selects the correct existing section and consumes its destination once',async()=>{
  const ui=app({uid:'alice',request:async()=>({items:[event()]})});await ui.boot();
  const connection=ui.window.__notifsState.personalItems[0];
  ui.api.open(connection);
  assert.deepEqual(ui.routes,['directorio']);assert.deepEqual(ui.callbacks,[]);
  assert.equal(ui.api.consume('embajadores'),null);
  assert.equal(ui.api.consume('directorio').profileUid,'ana');
  assert.equal(ui.api.consume('directorio'),null);
  const transfer={...connection,target:{section:'embajadores',view:'withdrawals',withdrawalId:'request-1'}};
  ui.api.open(transfer);
  assert.equal(ui.routes.at(-1),'embajadores');assert.deepEqual(ui.callbacks,[]);
  assert.equal(ui.api.consume('embajadores').withdrawalId,'request-1');
  assert.equal(ui.api.consume('embajadores'),null);
  await flush();
});

test('session ending clears personal events and pending targets immediately and discards late responses',async()=>{
  const ui=app({uid:'alice',request:async()=>({items:[event()]})});await ui.boot();
  ui.api.setGeneral([{id:'global',createdAtMs:50}]);
  ui.api.open(ui.window.__notifsState.personalItems[0]);await flush();
  const late=deferred();ui.setRequest(()=>late.promise);const syncing=ui.api.sync();
  await ui.emit('icadem:session-ending');
  assert.equal(ui.window.__notifsState.personalItems.length,0);
  assert.deepEqual(Array.from(ui.window.__notifsState.items,item=>item.id),['global']);
  assert.equal(ui.api.consume('directorio'),null);assert.equal(ui.intervals.size,0);
  late.resolve({items:[event('private-late')]});await syncing;
  assert.equal(ui.window.__notifsState.personalItems.length,0);
  ui.setRequest(async()=>({items:[event('restored')]}));await ui.emit('icadem:session-exit-failed');
  assert.equal(ui.window.__notifsState.personalItems[0].serverId,'restored');
});

test('existing bell read-state helper honors persisted personal reads alongside the same user general history',()=>{
  const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
  const start=html.indexOf('function getNotifsLeidas() {'),end=html.indexOf('// Marca un array de IDs como leídos',start);
  assert(start>=0&&end>start);
  const keys=[];
  const context={window:{UserState:{uid:'alice'},__notifsState:{personalItems:[{id:'personal-read',read:true},{id:'personal-unread',read:false}]}},localStorage:{getItem(key){keys.push(key);return JSON.stringify(['global-read']);}}};
  vm.runInNewContext(html.slice(start,end),context);
  assert.deepEqual(Array.from(context.getNotifsLeidas()),['global-read','personal-read']);
  assert.deepEqual(keys,['icadem_notif_read_alice']);
});

test('visibility refresh respects hidden tabs and demo sessions without creating another bell',async()=>{
  const ui=app({uid:'alice',request:async()=>({items:[]})});await ui.boot();
  const initial=ui.calls.length;ui.document.visibilityState='hidden';await ui.emit('visibilitychange');
  for(const tick of ui.intervals.values())tick();await flush();assert.equal(ui.calls.length,initial);
  ui.document.visibilityState='visible';await ui.emit('visibilitychange');assert.equal(ui.calls.length,initial+1);
  ui.window.__isDemoMode=true;await ui.api.sync();assert.equal(ui.calls.length,initial+1);
});

test('the actual bell row template escapes personal titles, descriptions, IDs and status text',()=>{
  const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
  const helper=html.match(/^function escapeNotif\([^\r\n]+/m)?.[0];assert(helper);
  const start=html.indexOf('bodyHTML = notifs.map(n => {');assert(start>=0);
  const end=html.indexOf("}).join('');",start);assert(end>start);
  const expression=html.slice(start+'bodyHTML = '.length,end+"}).join('')".length);
  const context={notifs:[event('personal-\"><img src=x>',{personal:true,titulo:'<img src=x onerror="bad()">',descripcion:'<script>bad()</script> & data',status:'\"><svg onload="bad()">',icono:'i-users',color:'#0B2F73'})],leidas:new Set(),formatNotifTime:()=> 'Ahora'};
  vm.runInNewContext(helper,context);
  const result=vm.runInNewContext(expression,context);
  assert.doesNotMatch(result,/<img|<script|<svg onload/);
  assert.match(result,/&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
  assert.match(result,/&lt;script&gt;bad\(\)&lt;\/script&gt; &amp; data/);
  assert.match(result,/&quot;&gt;&lt;svg onload=&quot;bad\(\)&quot;&gt;/);
});
