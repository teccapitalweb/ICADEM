'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function summary(extra={}){
 const record={id:'sale-a',status:'pending',commissionCents:17501,paidAt:'2026-11-24T10:00:00.000Z',plan:'mensual'};
 return {registered:true,category:'vip',ambassador:{active:true,code:'TES-ABCDE'},config:{validationDays:7},wallet:{availableCents:12345,pendingCents:17501,debtCents:0},analytics:{},referrals:[],withdrawals:[],commissions:[record],commissionCelebrations:[{id:'commission-sale-a',type:'commission-earned',commissionId:'sale-a',amountCents:17501,validationDays:7}],...extra};
}
function app(initial=summary()){
 const documentEvents=new Map(),windowEvents=new Map(),timers=new Map(),requests=[],shows=[],renders=[],cancels=[];let data=initial,timerId=0;
 const on=(map,name,fn)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(fn);};
 const emit=(map,name,detail)=>{for(const fn of map.get(name)||[])fn({type:name,detail});};
 class Node{constructor(){this.isConnected=true;this.dataset={};this.handlers={};this.hidden=false;this.tagName='DIV';}addEventListener(name,fn){this.handlers[name]=fn;}setAttribute(){}getAttribute(){return null;}removeAttribute(){}querySelector(){return null;}querySelectorAll(){return [];}contains(){return false;}closest(){return null;}getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()];}focus(){document.activeElement=this;}scrollIntoView(){}getBoundingClientRect(){return {x:20,y:150,left:20,top:150,right:220,bottom:230,width:200,height:80};}}
 const target=new Node(),heading=new Node(),presentation=new Node(),root=new Node();let html='';Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;}});
 root.querySelector=selector=>selector.includes('data-amb-dirty')?null:selector.includes('data-amb-presentation')?presentation:selector.includes('data-amb-heading')?heading:selector.includes('data-amb-wallet')||selector.includes('amb-earnings__balance')||selector.includes('data-vip-kpi')?target:null;
 const blocker=new Node(),hiddenBlocker=new Node();hiddenBlocker.hidden=true;
 const document={visibilityState:'visible',activeElement:null,blocker:false,hiddenBlocker:false,body:{classList:{toggle(){},remove(){}}},addEventListener(name,fn){on(documentEvents,name,fn);},querySelector(selector){if(this.blocker&&!selector.includes('amb-commission-celebration__'))return blocker;if(this.hiddenBlocker)return hiddenBlocker;return null;},querySelectorAll(){return this.blocker?[blocker]:this.hiddenBlocker?[hiddenBlocker]:[];}};
 const window={__currentUser:{uid:'owner-a'},addEventListener(name,fn){on(windowEvents,name,fn);},ICADEMPlatform:{async request(path,options={}){requests.push({path,method:options.method||'GET',body:options.body});if(path==='/api/ambassadors/me')return data;if(/^\/api\/ambassadors\/notifications\/[^/]+\/read$/.test(path)){data={...data,commissionCelebrations:data.commissionCelebrations.filter(x=>path!==`/api/ambassadors/notifications/${encodeURIComponent(x.id)}/read`)};return {ok:true};}throw Error('Unexpected endpoint '+path);}},ICADEMCommissionCelebration:{show(options){const instance={options,cancel(){cancels.push(instance);options.onDismiss?.('cancelled');}};shows.push(instance);return instance;}},ICADEMAmbassadorsVIP:{render(value){renders.push(value);return '<div data-vip-dashboard><h1 data-amb-heading>Embajadores</h1></div>';},bind(){}}};
 const context={window,document,navigator:{onLine:true},location:{search:'',hash:'#embajadores'},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},Intl,Date,URLSearchParams,CustomEvent:class{},setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);},setInterval(){},clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-ambassadors.js','utf8'),context);
 async function scheduled(){await flush();const batch=[...timers.entries()];for(const [id,timer]of batch){timers.delete(id);timer.fn();}await flush();}
 async function render(){await window.ICADEMAmbassadors.render(root);await scheduled();}
 return {context,window,document,root,target,presentation,requests,shows,renders,cancels,render,scheduled,setData:value=>{data=value;},getData:()=>data,emitDocument:(name,detail)=>emit(documentEvents,name,detail),emitWindow:(name,detail)=>emit(windowEvents,name,detail)};
}

test('commission celebration is backed by an exact eligible server record and never a registration or wallet delta',async()=>{
 const base=summary(),invalid=[
  summary({commissionCelebrations:[],commissions:[],referrals:[{status:'registered'}]}),
  summary({registered:false}),
  summary({commissionCelebrations:[{...base.commissionCelebrations[0],amountCents:0}]}),
  summary({commissionCelebrations:[{...base.commissionCelebrations[0],amountCents:17500}]}),
  summary({commissionCelebrations:[{...base.commissionCelebrations[0],id:'commission-other'}]}),
  summary({commissionCelebrations:[{...base.commissionCelebrations[0],type:'referral-registered'}]}),
  summary({commissionCelebrations:[{...base.commissionCelebrations[0],seen:true}]}),
  summary({commissionCelebrations:[{...base.commissionCelebrations[0],amountCents:'17501'}]}),
  summary({commissions:[{...base.commissions[0],commissionCents:17501.5}],commissionCelebrations:[{...base.commissionCelebrations[0],amountCents:17501.5}]}),
  summary({commissions:[]}),
  ...['reversed','ineligible','paid','unknown'].map(status=>summary({commissions:[{...base.commissions[0],status}]}))
 ];
 for(const data of invalid){const ui=app(data);await ui.render();assert.equal(ui.shows.length,0,JSON.stringify(data));assert(ui.requests.every(r=>r.method==='GET'),'no acknowledgement or money writes for invalid event');}
 const ui=app();await ui.render();assert.equal(ui.shows.length,1);assert.equal(ui.shows[0].options.amountCents,17501);assert.equal(ui.shows[0].options.status,'pending');assert.equal(ui.renders.at(-1).wallet.availableCents,12345);assert(ui.requests.every(r=>r.method==='GET'));
});

test('collect refreshes authoritative data, preserves actual wallet values and acknowledges only the notification',async()=>{
 const ui=app();await ui.render();const shown=ui.shows[0],fresh=summary({wallet:{availableCents:20000,pendingCents:17501,debtCents:0}});ui.setData(fresh);
 const result=await shown.options.onCollect();assert.equal(result.status,'pending');assert.equal(result.amountCents,17501);assert.equal(result.target,ui.target);assert.equal(ui.renders.at(-1).wallet.availableCents,20000,'render server value rather than old wallet plus animation');
 shown.options.onDismiss('collected');await flush();const writes=ui.requests.filter(r=>r.method!=='GET');assert.deepEqual(writes,[{path:'/api/ambassadors/notifications/commission-sale-a/read',method:'POST',body:undefined}]);
 await ui.render();assert.equal(ui.shows.length,1,'same server notification does not replay after read');
});

test('reversal before collecting suppresses flight and never fabricates an available balance',async()=>{
 const ui=app();await ui.render();const base=summary();ui.setData(summary({wallet:{availableCents:500,pendingCents:0,debtCents:0},commissions:[{...base.commissions[0],status:'reversed'}]}));
 const result=await ui.shows[0].options.onCollect();assert.equal(result.skip,true);assert.equal(ui.renders.at(-1).wallet.availableCents,500);assert(ui.requests.every(r=>r.method==='GET'));
});

test('available uses its server status and amount rather than current category benefits or an optimistic wallet increment',async()=>{
 const base=summary(),ui=app(summary({category:'free',benefits:{directCommissionCents:10000},commissions:[{...base.commissions[0],status:'available'}]}));await ui.render();
 const shown=ui.shows[0];assert.equal(shown.options.status,'available');assert.equal(shown.options.amountCents,17501);await shown.options.onCollect();assert.equal(ui.renders.at(-1).wallet.availableCents,12345);
});

test('account and navigation changes cancel the old owner celebration without acknowledging it',async()=>{
 for(const change of ['account','route']){
  const ui=app();await ui.render();const shown=ui.shows[0];
  if(change==='account'){ui.window.__currentUser={uid:'owner-b'};ui.emitDocument('icadem:session-ending');}
  else{ui.context.location.hash='#inicio';ui.emitWindow('icadem:navigation',{section:'inicio'});}
  assert(ui.cancels.length>0,change+' cancels visual lifecycle');assert.equal(shown.options.canContinue(),false);shown.options.onDismiss('collected');await flush();assert(ui.requests.every(r=>r.method==='GET'),change+' cannot mark another or abandoned event read');
 }
});

test('another modal defers a notification without consuming it and presentation mode suppresses it',async()=>{
 const ui=app();ui.document.blocker=true;await ui.render();assert.equal(ui.shows.length,0);ui.document.blocker=false;await ui.render();assert.equal(ui.shows.length,1,'event is still available after blocker closes');
 const protectedUi=app();await protectedUi.window.ICADEMAmbassadors.render(protectedUi.root);protectedUi.presentation.handlers.click();await protectedUi.scheduled();assert.equal(protectedUi.shows.length,0,'presentation blocks financial celebration');assert(protectedUi.requests.every(r=>r.method==='GET'));
});

test('an inactive hidden tour container does not permanently suppress legitimate commission notices',async()=>{
 const ui=app();ui.document.hiddenBlocker=true;await ui.render();assert.equal(ui.shows.length,1);assert(ui.requests.every(r=>r.method==='GET'));
});

test('pending to available uses the fresh target and a zero available balance with debt remains zero',async()=>{
 const ui=app();await ui.render();const base=summary(),fresh=summary({wallet:{availableCents:0,pendingCents:0,debtCents:17501},commissions:[{...base.commissions[0],status:'available'}]});ui.setData(fresh);
 const result=await ui.shows[0].options.onCollect();assert.equal(result.status,'available');assert.equal(result.amountCents,17501);assert.equal(result.target,ui.target);assert.equal(ui.renders.at(-1).wallet.availableCents,0);assert.equal(ui.renders.at(-1).wallet.debtCents,17501);assert(ui.requests.every(r=>r.method==='GET'));
});

test('an old owner collect response cannot render over the new session or consume its event',async()=>{
 const ui=app();await ui.render();const shown=ui.shows[0],old=summary();let release;const original=ui.window.ICADEMPlatform.request;
 ui.window.ICADEMPlatform.request=(path,options)=>path==='/api/ambassadors/me'?new Promise(resolve=>{release=()=>resolve(old);}):original(path,options);
 const pending=shown.options.onCollect();await flush();const count=ui.renders.length;ui.window.__currentUser={uid:'owner-b'};ui.emitDocument('icadem:session-ending');release();await assert.rejects(pending,/sesión/);assert.equal(ui.renders.length,count);shown.options.onDismiss('collected');await flush();assert(ui.requests.every(r=>r.method==='GET'));
});

test('invalid first events do not starve a valid commission and deduplication is scoped to its authenticated owner',async()=>{
 const base=summary(),ui=app(summary({commissionCelebrations:[{id:'commission-missing',type:'commission-earned',amountCents:99999},...base.commissionCelebrations]}));await ui.render();assert.equal(ui.shows.length,1);assert.equal(ui.shows[0].options.amountCents,17501);ui.shows[0].options.onDismiss('dismissed');await flush();
 ui.window.__currentUser={uid:'owner-b'};ui.setData(summary());ui.emitDocument('icadem:user-ready');await flush();await ui.render();assert.equal(ui.shows.length,2,'the other account has its own legitimate event');assert.equal(ui.shows[1].options.amountCents,17501);assert.equal(ui.requests.filter(r=>r.method==='POST').length,1,'only the old owner dismissal has been acknowledged');
});

test('a failed automatic refresh leaves the notice unread and eligible for the next existing refresh',async()=>{
 const ui=app();await ui.render();assert.equal(ui.shows.length,1);
 ui.shows[0].options.onDismiss('failed');await flush();assert(ui.requests.every(r=>r.method==='GET'),'failed visual attempt does not consume the server notice');
 await ui.render();assert.equal(ui.shows.length,2,'the same valid notice can retry after a later panel refresh');
 const result=await ui.shows[1].options.onCollect();assert.equal(result.amountCents,17501);assert.equal(ui.renders.at(-1).wallet.availableCents,12345);
 ui.shows[1].options.onDismiss('collected');await flush();assert.equal(ui.requests.filter(r=>r.method==='POST').length,1,'only the completed retry marks the notification read');
 await ui.render();assert.equal(ui.shows.length,2,'completed retry remains deduplicated');
});

test('interaction during the automatic fresh GET defers decoration without replacing the focused panel',async()=>{
 const ui=app();await ui.render();const shown=ui.shows[0],snapshot=summary(),original=ui.window.ICADEMPlatform.request;let release;
 ui.window.ICADEMPlatform.request=(path,options)=>path==='/api/ambassadors/me'?new Promise(resolve=>{release=()=>resolve(snapshot);}):original(path,options);
 const pending=shown.options.onCollect();await flush();const rendersBefore=ui.renders.length,focused={matches:()=>true};ui.document.activeElement=focused;ui.root.contains=node=>node===focused;
 release();const result=await pending;assert.equal(result.defer,true);assert.equal(ui.renders.length,rendersBefore,'automatic refresh cannot replace a newly focused control');assert.equal(ui.document.activeElement,focused,'focus stays on the existing control');
 shown.options.onDismiss('deferred');await flush();assert(ui.requests.every(r=>r.method==='GET'),'deferred notice remains unread');
 ui.document.activeElement=null;ui.window.ICADEMPlatform.request=original;await ui.render();assert.equal(ui.shows.length,2,'same notice can play after interaction has ended');
});
