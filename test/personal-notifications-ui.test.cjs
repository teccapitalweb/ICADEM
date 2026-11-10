'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname+'/../js/icadem-notifications.js','utf8');
const flush = async () => { for(let n=0;n<4;n++)await new Promise(resolve=>setImmediate(resolve)); };
const DAYS=15*86400000, NOW=1800000000000;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function event(id='event-1',extra={}){const kind=extra.source||'personal';return {id:kind+'-'+id,serverId:id,source:kind,personal:kind==='personal',tipo:'connection_request',titulo:'Nueva solicitud de conexión',descripcion:'Ana quiere conectar contigo.',createdAtMs:NOW-1000,expiresAtMs:NOW-1000+DAYS,read:false,target:{section:'directorio',view:'requests',profileUid:'ana'},...extra};}
function inbox(items=[],now=NOW){return {ok:true,items,serverNowMs:now,retentionDays:15,unreadCount:items.filter(n=>!n.read).length};}
function app(options={}){
  const listeners={},timeouts=new Map(),intervals=new Map(),calls=[],errors=[],routes=[],callbacks=[],storage=new Map(Object.entries(options.storage||{}));
  let next=0,elapsed=0,wall=options.wall||NOW,implementation=options.request|| (async()=>inbox()),badgeUpdates=0,closed=0,refreshed=0;
  const document={visibilityState:'visible',addEventListener(name,fn){(listeners[name]||=[]).push(fn);},getElementById(){return null;}};
  const window={__notifsState:{items:[],generalItems:[],personalItems:[]},__currentUser:options.uid?{uid:options.uid}:null,UserState:{uid:options.uid||''},__isDemoMode:!!options.demo,
    ICADEMPlatform:{request(path,config){calls.push({path,config});return implementation(path,config);}},
    actualizarBadgeNotif(){badgeUpdates++;},cerrarNotifDropdown(){closed++;},refreshNotifDropdown(){refreshed++;},navigateToSection(section){routes.push(section);},
    ICADEMCommunity:{openNotificationTarget(){callbacks.push('directorio');}},ICADEMAmbassadors:{openNotificationTarget(){callbacks.push('embajadores');}},Toast:{error(...args){errors.push(args);}}};
  const context={window,document,performance:{now:()=>elapsed},Date:class extends Date{static now(){return wall;}},
    localStorage:{getItem:key=>storage.get(key)||null,removeItem:key=>storage.delete(key)},
    setTimeout(fn,ms=0){const id=++next;timeouts.set(id,{fn,at:elapsed+ms});return id;},clearTimeout:id=>timeouts.delete(id),
    setInterval(fn){const id=++next;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)};
  vm.runInNewContext(source,context);
  return {window,document,calls,errors,routes,callbacks,intervals,storage,api:window.ICADEMNotifications,
    setRequest(fn){implementation=fn;},async boot(){const [id,t]=timeouts.entries().next().value;timeouts.delete(id);t.fn();await flush();},
    async emit(name){for(const fn of listeners[name]||[])fn();await flush();},
    async user(uid){window.__currentUser=uid?{uid}:null;window.UserState.uid=uid||'';await this.emit('icadem:user-ready');},
    async advance(ms){elapsed+=ms;wall+=ms;for(const [id,t] of [...timeouts])if(t.at<=elapsed){timeouts.delete(id);t.fn();}await flush();},
    wall(value){wall=value;},badges:()=>badgeUpdates,closes:()=>closed,refreshes:()=>refreshed};
}

test('one authenticated inbox contains distinct general and personal notices; direct snapshots cannot supply rows',async()=>{
  const items=[event('same-id'),event('same-id',{source:'general'})];
  const ui=app({request:async()=>inbox(items)});await ui.boot();assert.equal(ui.calls.length,0);
  await ui.user('alice');
  assert.equal(ui.calls[0].path,'/api/notifications');
  assert.deepEqual(Array.from(ui.window.__notifsState.items,n=>n.id),['general-same-id','personal-same-id']);
  ui.api.setGeneral([event('untrusted',{source:'general'})]);await flush();
  assert.equal(ui.api.visibleItems().some(n=>n.serverId==='untrusted'),false);
});

test('read and dismiss persist for both sources before the UI changes',async()=>{
  const ui=app({uid:'alice',request:async()=>inbox([event(),event('global',{source:'general'})])});await ui.boot();
  let response=deferred();ui.setRequest(()=>response.promise);
  const reading=ui.api.mark(['personal-event-1','general-global'],false);
  assert.equal(ui.api.visibleItems().every(n=>n.read===false),true);
  assert.equal(ui.calls.at(-1).path,'/api/notifications/read');
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls.at(-1).config.body)),{items:[{source:'general',id:'global'},{source:'personal',id:'event-1'}]});
  response.resolve({ok:true});assert.equal(await reading,true);assert.equal(ui.api.visibleItems().every(n=>n.read),true);
  response=deferred();const removing=ui.api.mark(['general-global'],true);assert.equal(ui.api.visibleItems().length,2);
  response.resolve({ok:true});assert.equal(await removing,true);assert.equal(ui.api.visibleItems().length,1);
});

test('read and dismiss survive another device with no browser preferences',async()=>{
  const read=new Set(),dismissed=new Set();
  const request=async(path,config)=>{
    if(config){for(const item of config.body.items)(path.endsWith('/read')?read:dismissed).add(item.source+'-'+item.id);return {ok:true};}
    return inbox([event(),event('global',{source:'general'})].filter(n=>!dismissed.has(n.id)).map(n=>({...n,read:read.has(n.id)})));
  };
  const first=app({uid:'alice',request});await first.boot();await first.api.mark(['personal-event-1'],false);await first.api.mark(['general-global'],true);
  const second=app({uid:'alice',request});await second.boot();
  assert.deepEqual(Array.from(second.api.visibleItems(),n=>[n.id,n.read]),[['personal-event-1',true]]);
});

test('failed mutations never claim success or lose the last confirmed rows',async()=>{
  const ui=app({uid:'alice',request:async()=>inbox([event()])});await ui.boot();
  ui.setRequest(async()=>{throw new Error('Offline');});
  assert.equal(await ui.api.mark(['personal-event-1'],false),false);assert.equal(ui.api.visibleItems()[0].read,false);
  assert.equal(await ui.api.mark(['personal-event-1'],true),false);assert.equal(ui.api.visibleItems().length,1);
  await ui.api.sync();assert.equal(ui.window.__notifsState.error,true);assert.equal(ui.api.visibleItems().length,1);assert.equal(ui.errors.length,2);
});

test('deadline uses server time and monotonic elapsed time; expired rows and unread count disappear at the boundary',async()=>{
  const near=event('near',{createdAtMs:NOW-DAYS+10,expiresAtMs:NOW+10});
  const ui=app({uid:'alice',wall:1,request:async()=>inbox([near])});await ui.boot();assert.equal(ui.api.visibleItems().length,1);
  ui.wall(NOW+999999999999);assert.equal(ui.api.visibleItems().length,1);
  await ui.advance(9);assert.equal(ui.api.visibleItems().length,1);
  await ui.advance(1);assert.equal(ui.api.visibleItems().length,0);assert.equal(ui.window.__notifsState.items.length,0);assert.ok(ui.refreshes()>0);
});

test('invalid, future and expired server dates fail closed without resurrecting rows',async()=>{
  for(const extra of [{createdAtMs:NaN},{createdAtMs:NOW+1},{expiresAtMs:NOW},{expiresAtMs:NOW+DAYS+1}]){
    const ui=app({uid:'alice',request:async()=>inbox([event('bad',extra)])});await ui.boot();assert.equal(ui.api.visibleItems().length,0);assert.equal(ui.window.__notifsState.error,true);
  }
});

test('late requests and mutation acknowledgements from previous sessions cannot leak or alter the next account',async()=>{
  const alice=deferred(),bob=deferred();const ui=app({uid:'alice',request:()=>alice.promise});await ui.boot();
  ui.setRequest(()=>bob.promise);await ui.user('bob');bob.resolve(inbox([event('bob')]));await flush();alice.resolve(inbox([event('alice')]));await flush();
  assert.deepEqual(Array.from(ui.api.visibleItems(),n=>n.serverId),['bob']);
  const ack=deferred();ui.setRequest(()=>ack.promise);const removing=ui.api.mark(['personal-bob'],true);
  ui.setRequest(async()=>inbox([event('bob',{titulo:'Carol notice'})]));await ui.user('carol');ack.resolve({ok:true});await removing;
  assert.equal(ui.api.visibleItems()[0].titulo,'Carol notice');
});

test('a stale GET cannot restore a notice dismissed while it was pending',async()=>{
  const ui=app({uid:'alice',request:async()=>inbox([event()])});await ui.boot();
  const stale=deferred();let get=0;
  ui.setRequest((path,config)=>config?Promise.resolve({ok:true}):++get===1?stale.promise:Promise.resolve(inbox()));
  const syncing=ui.api.sync();await ui.api.mark(['personal-event-1'],true);stale.resolve(inbox([event()]));await syncing;await flush();
  assert.equal(ui.api.visibleItems().length,0);assert.equal(get,2);
});

test('legacy migration intersects only the authenticated user and server-confirmed general IDs',async()=>{
  const items=[event('read',{source:'general'}),event('dismiss',{source:'general'}),event('personal')];
  const storage={icadem_notif_read_alice:JSON.stringify(['read','invented','personal']),icadem_notif_deleted_alice:JSON.stringify(['dismiss']),icadem_notif_read_bob:JSON.stringify(['dismiss'])};
  const persisted=new Set(),ui=app({uid:'alice',storage,request:async(path,config)=>{
    if(config){for(const n of config.body.items)persisted.add(path+':'+n.id);return {ok:true};}
    return inbox(items.filter(n=>!persisted.has('/api/notifications/dismiss:'+n.serverId)).map(n=>({...n,read:persisted.has('/api/notifications/read:'+n.serverId)})));
  }});await ui.boot();
  assert.deepEqual([...persisted],['/api/notifications/read:read','/api/notifications/dismiss:dismiss']);
  assert.equal(ui.storage.has('icadem_notif_read_alice'),false);assert.equal(ui.storage.has('icadem_notif_read_bob'),true);
});

test('legacy preference remains local after failed migration and never hides an unconfirmed notice',async()=>{
  const ui=app({uid:'alice',storage:{icadem_notif_deleted_alice:'["global"]'},request:async(path,config)=>{
    if(config)throw new Error('Offline');return inbox([event('global',{source:'general'})]);
  }});await ui.boot();assert.equal(ui.api.visibleItems().length,1);assert.equal(ui.storage.has('icadem_notif_deleted_alice'),true);
});

test('batch dismissal chunks the unified inbox to the server limit',async()=>{
  const items=Array.from({length:200},(_,i)=>event('notice'+i,{source:i<100?'personal':'general'}));
  const ui=app({uid:'alice',request:async(path,config)=>config?{ok:true}:inbox(items)});await ui.boot();await ui.api.mark(items.map(n=>n.id),true);
  assert.deepEqual(ui.calls.filter(n=>n.config).map(n=>n.config.body.items.length),[100,100]);assert.equal(ui.api.visibleItems().length,0);
});

test('navigation retains existing connection and withdrawal destinations',async()=>{
  const ui=app({uid:'alice',request:async(path,config)=>config?{ok:true}:inbox([event()])});await ui.boot();
  ui.api.open(ui.api.visibleItems()[0]);assert.deepEqual(ui.routes,['directorio']);assert.equal(ui.api.consume('directorio').profileUid,'ana');assert.equal(ui.api.consume('directorio'),null);
  ui.api.open(event('transfer',{target:{section:'embajadores',view:'withdrawals',withdrawalId:'request-1'}}));assert.equal(ui.routes.at(-1),'embajadores');assert.equal(ui.api.consume('embajadores').withdrawalId,'request-1');
  ui.api.open(event('webinar',{source:'general',target:{section:'webinars'}}));assert.equal(ui.routes.at(-1),'webinars');await flush();
});

test('session ending clears all account rows and pending destinations immediately',async()=>{
  const ui=app({uid:'alice',request:async(path,config)=>config?{ok:true}:inbox([event(),event('global',{source:'general'})])});await ui.boot();
  ui.api.open(ui.api.visibleItems()[0]);await flush();const late=deferred();ui.setRequest(()=>late.promise);const syncing=ui.api.sync();
  await ui.emit('icadem:session-ending');assert.equal(ui.api.visibleItems().length,0);assert.equal(ui.api.consume('directorio'),null);assert.equal(ui.intervals.size,0);
  late.resolve(inbox([event('private-late')]));await syncing;assert.equal(ui.api.visibleItems().length,0);
});

test('hidden tabs do not poll and demo never calls real endpoints',async()=>{
  const ui=app({uid:'alice',request:async()=>inbox()});await ui.boot();const initial=ui.calls.length;
  ui.document.visibilityState='hidden';await ui.emit('visibilitychange');for(const tick of ui.intervals.values())tick();await flush();assert.equal(ui.calls.length,initial);
  ui.document.visibilityState='visible';await ui.emit('visibilitychange');assert.equal(ui.calls.length,initial+1);
  const demo=app({uid:'demo',demo:true});await demo.boot();demo.api.setGeneral([{id:'demo',read:false}]);await demo.api.mark(['demo'],false);assert.equal(demo.calls.length,0);assert.equal(demo.api.visibleItems()[0].read,true);
});

test('bell helper uses only confirmed server reads and source listener only invalidates the unified inbox',()=>{
  const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8'),start=html.indexOf('function getNotifsLeidas() {'),end=html.indexOf('// Marca un array de IDs como leídos',start);
  const context={window:{ICADEMNotifications:{visibleItems:()=>[{id:'general-read',read:true},{id:'personal-unread',read:false}]}}};
  vm.runInNewContext(html.slice(start,end),context);assert.deepEqual(Array.from(context.getNotifsLeidas()),['general-read']);
  const setup=html.slice(html.indexOf('function setupNotificacionesListener('),start);assert.doesNotMatch(setup,/snap\.docs|createdAt.*Date\.now|setGeneralNotifs\(items\)/);assert.match(setup,/ICADEMNotifications\?\.sync/);
  const actions=html.slice(start,html.indexOf('// Helper de formato relativo',start));assert.doesNotMatch(actions,/localStorage/);
});

test('the actual bell row template escapes notification titles, descriptions, IDs and status',()=>{
  const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8'),helper=html.match(/^function escapeNotif\([^\r\n]+/m)?.[0];assert(helper);
  const start=html.indexOf('bodyHTML = notifs.map(n => {'),end=html.indexOf("}).join('');",start);assert(start>=0&&end>start);
  const expression=html.slice(start+'bodyHTML = '.length,end+"}).join('')".length);
  const context={notifs:[event('bad',{id:'personal-\"><img src=x>',titulo:'<img src=x onerror="bad()">',descripcion:'<script>bad()</script> & data',status:'\"><svg onload="bad()">',icono:'i-users',color:'#0B2F73'})],leidas:new Set(),formatNotifTime:()=> 'Ahora'};
  vm.runInNewContext(helper,context);const result=vm.runInNewContext(expression,context);assert.doesNotMatch(result,/<img|<script|<svg onload/);assert.match(result,/&lt;img/);assert.match(result,/&lt;script&gt;/);assert.match(result,/&quot;&gt;&lt;svg/);
});

test('explicit bell opening refreshes cross-device changes once, while internal repaint never loops into another sync',()=>{
  const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8'),start=html.indexOf('function toggleNotifDropdown(skipSync=false){'),end=html.indexOf('  const notifUid =',start);
  assert(start>=0&&end>start);
  let existing=null,syncs=0,closes=0;
  const context={document:{getElementById:()=>existing},window:{ICADEMNotifications:{sync(){syncs++;}}},cerrarNotifDropdown(){closes++;}};
  vm.runInNewContext(html.slice(start,end)+'}',context);
  context.toggleNotifDropdown();assert.equal(syncs,1);
  context.toggleNotifDropdown(true);assert.equal(syncs,1);
  existing={};context.toggleNotifDropdown();assert.equal(syncs,1);assert.equal(closes,1);
  const refreshStart=html.indexOf('window.refreshNotifDropdown = function(){'),refreshEnd=html.indexOf('// Helper global para que admins',refreshStart),repaints=[];
  const refreshContext={document:{getElementById:()=>({scrollTop:42})},window:{},cerrarNotifDropdown(){},toggleNotifDropdown:skip=>repaints.push(skip)};
  vm.runInNewContext(html.slice(refreshStart,refreshEnd),refreshContext);refreshContext.window.refreshNotifDropdown();assert.deepEqual(repaints,[true]);
  assert.match(html,/const repintarNotifDropdown = \(\) => \{ cerrarNotifDropdown\(\); toggleNotifDropdown\(true\); \}/);
});
