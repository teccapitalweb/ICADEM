'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
function fixture(extra={}){return {registered:true,category:'free',ambassador:{active:true,code:'TES-ABCDE',whatsapp:{registered:false}},wallet:{availableCents:15000},config:{minimumWithdrawalCents:10000},analytics:{},referrals:[],commissions:[],withdrawals:[],...extra};}
function app(request=async()=>fixture()){
 const documentEvents={},windowEvents={},timers=[],rendered=[],root={isConnected:true,dataset:{},dirty:false,innerHTML:'private A',querySelector(selector){return selector==='[data-amb-dirty="true"]'&&this.dirty?{}:null;},querySelectorAll(){return [];},setAttribute(){},removeAttribute(){},contains(){return this.focused||false;}};
 const document={visibilityState:'visible',activeElement:null,body:{classList:{toggle(){},remove(){}}},querySelector(){return document.modal?{}:null;},querySelectorAll(){return [];},addEventListener(name,fn){documentEvents[name]=fn;}};
 const window={__currentUser:{uid:'owner-a'},ICADEMPlatform:{request},addEventListener(name,fn){windowEvents[name]=fn;}};
 const context={window,document,navigator:{onLine:true},location:{search:'',hash:'#embajadores'},localStorage:{getItem(){},setItem(){},removeItem(){}},URLSearchParams,Intl,Date,crypto,CustomEvent:class{},setInterval(fn,ms){timers.push({fn,ms});},setTimeout};
 let source=fs.readFileSync(__dirname+'/../js/icadem-ambassadors.js','utf8');source=source.replace('window.ICADEMAmbassadors={render:',`window.__sync={load,refresh,acceptsRefresh,earningsMarkup,conversionHistoryMarkup,seedRoot:(r,d,view)=>{notificationRoot=r;notificationData=d;notificationUid=currentUid();activeView=view||'dashboard';},snapshot:()=>({cache,cacheUid,notificationData,activeView})};window.ICADEMAmbassadors={render:`);
 vm.runInNewContext(source,context);return {context,window,document,documentEvents,windowEvents,timers,root,...window.__sync};
}
test('ambassador cache belongs to current UID and a late account A fetch is discarded',async()=>{
 let calls=0,resolve;const a=app(()=>++calls===1?Promise.resolve(fixture({marker:'a'})):calls===2?new Promise(r=>resolve=r):Promise.resolve(fixture({marker:'b'})));
 assert.equal((await a.load()).marker,'a');await a.load();assert.equal(calls,1);
 const late=a.load(true);a.window.__currentUser={uid:'owner-b'};assert.equal((await a.load()).marker,'b');resolve(fixture({marker:'late-a'}));await assert.rejects(late,/sesión/);assert.equal(a.snapshot().cache.marker,'b');assert.equal(a.snapshot().cacheUid,'owner-b');
});
test('session ending clears private DOM/cache and invalidates all pending responses',async()=>{
 let resolve;const a=app(()=>new Promise(r=>resolve=r));a.seedRoot(a.root,fixture());const pending=a.load(true);a.window.__sessionEnding=true;a.documentEvents['icadem:session-ending']();assert.equal(a.root.innerHTML,'');assert.equal(a.snapshot().cache,null);assert.equal(a.snapshot().notificationData,null);resolve(fixture());await assert.rejects(pending,/sesión/);assert.equal(a.snapshot().cache,null);
});
test('visible/online/60-second refresh is active-route only and protects typing and dialogs',async()=>{
 let calls=0;const a=app(async()=>{calls++;return fixture();});a.seedRoot(a.root,fixture());assert.equal(a.timers[0].ms,60000);
 for(const guard of ['hidden','offline','modal','dirty','focused','route']){
  a.document.visibilityState=guard==='hidden'?'hidden':'visible';a.context.navigator.onLine=guard!=='offline';a.document.modal=guard==='modal';a.root.dirty=guard==='dirty';a.root.focused=guard==='focused';a.document.activeElement=guard==='focused'?{matches:()=>true}:null;a.context.location.hash=guard==='route'?'#cursos':'#embajadores';await a.refresh();assert.equal(calls,0,guard);
 }
 a.context.location.hash='#embajadores';a.document.activeElement=null;a.root.focused=false;await a.refresh();assert.equal(calls,1);assert.match(a.root.innerHTML,/Mis ganancias/);
 a.document.visibilityState='hidden';a.documentEvents.visibilitychange();await new Promise(setImmediate);assert.equal(calls,1);a.document.visibilityState='visible';a.documentEvents.visibilitychange();await new Promise(setImmediate);assert.equal(calls,2);a.windowEvents.online();await new Promise(setImmediate);assert.equal(calls,3);
});
test('late background refresh does not reset a form started while data was loading',async()=>{
 let resolve;const a=app(()=>new Promise(r=>resolve=r));a.seedRoot(a.root,fixture());const refreshing=a.refresh();a.root.dirty=true;a.root.innerHTML='draft phone';resolve(fixture({wallet:{availableCents:99900}}));await refreshing;assert.equal(a.root.innerHTML,'draft phone');assert.equal(a.snapshot().cache.wallet.availableCents,99900);
});
test('background refresh keeps withdrawals view and conversions stay in both financial histories',async()=>{
 const record={id:'owner-a__safe-id',amountCents:10000,credits:100,createdAt:'2026-11-09T18:00:00Z'},a=app(async()=>fixture({conversions:[record]}));a.seedRoot(a.root,fixture(),'withdrawals');await a.refresh();assert.equal(a.snapshot().activeView,'withdrawals');assert.match(a.root.innerHTML,/Retiros y cuenta bancaria/);assert.match(a.root.innerHTML,/Conversiones a créditos/);assert.match(a.root.innerHTML,/100 créditos/);assert.match(a.root.innerHTML,/100 MXN/);
 const html=a.earningsMarkup(fixture({wallet:{availableCents:50}}));assert.match(html,/data-amb-convert disabled/);assert.match(html,/data-amb-view="withdrawals"/);
});
