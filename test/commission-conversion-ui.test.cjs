'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../js/icadem-commission-conversion.js','utf8');
function element(){return {value:'',disabled:false,readOnly:false,isConnected:true,textContent:'',listeners:{},attributes:{},addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},focus(){},fire(name){return this.listeners[name]?.({preventDefault(){}});}};}
function app(options={}){
 const listeners={},posts=[],snapshots=[],notifications=[],summaries=[],nodes={},window={__currentUser:{uid:'owner-a'},crypto};
 const form=element(),root=element();form.querySelector=selector=>nodes[selector]||(nodes[selector]=element());root.querySelector=selector=>selector==='[data-commission-conversion]'?form:null;
 const data={registered:true,ambassador:{active:true},wallet:{availableCents:45050,debtCents:0}};
 let cfg;
 window.Toast=Object.fromEntries(['success','error','info'].map(type=>[type,(title,message)=>notifications.push({type,title,message})]));
 window.ICADEMAmbassadors={async getSummary(force){summaries.push(force);return options.summary?options.summary():data;},refresh:async()=>{},acceptConversion:r=>snapshots.push(['ambassador',r])};
 window.ICADEMPlatform={async request(path,opts){posts.push({path,...opts});return options.request?options.request(path,opts):{converted:true,conversion:{credits:opts.body.amountCents/100},credits:{balance:10+opts.body.amountCents/100},wallet:{availableCents:45050-opts.body.amountCents}};},syncCreditSnapshot:c=>snapshots.push(['credits',c]),loadCreditWallet:async force=>snapshots.push(['wallet',force])};
 window.Modal={open(config){cfg=config;nodes['#acc-amount']=element();nodes['#acc-amount'].value=config.body.match(/placeholder="Ej\. 100" value="([^"]*)"/)[1];root.isConnected=true;return {close(){if(config.beforeClose&&!config.beforeClose())return;root.isConnected=false;config.onClose();}};},close(){if(cfg&&(!cfg.beforeClose||cfg.beforeClose())){root.isConnected=false;cfg.onClose();}}};
 const context={window,navigator:{onLine:true},document:{addEventListener(name,fn){listeners[name]=fn;},querySelector(){return root;}},Intl,Date,Map,Number,Promise};
 vm.runInNewContext(source,context);
 return {window,context,nodes,form,root,posts,snapshots,notifications,summaries,listeners,api:window.ICADEMCommissionConversion,get cfg(){return cfg;},async open(){await window.ICADEMCommissionConversion.open();},async input(value){nodes['#acc-amount'].value=value;await nodes['#acc-amount'].fire('input');},async submit(){await form.fire('submit');}};
}
test('conversion gets fresh server balance, previews whole MXN, and posts only amount and idempotency key',async()=>{
 const a=app();await a.open();assert.deepEqual(a.summaries,[true]);assert.match(a.cfg.body,/\$1 MXN = 1 crédito/);assert.match(a.cfg.body,/\$0\.50 MXN de centavos/);assert.match(a.cfg.body,/conversión es definitiva/);
 assert.equal(a.nodes['[data-convert-submit]'].disabled,true);
 for(const value of ['1.5','0','-2','1e2','451','9007199254740991']){await a.input(value);await a.submit();assert.equal(a.posts.length,0,value);}
 await a.input('100');assert.equal(a.nodes['[data-convert-credits]'].textContent,'100 créditos');assert.equal(a.nodes['[data-convert-remaining]'].textContent,'$350.50 MXN');
 await a.submit();assert.equal(a.posts.length,1);assert.equal(a.posts[0].path,'/api/ambassadors/conversions');assert.equal(a.posts[0].method,'POST');assert.equal(a.posts[0].body.amountCents,10000);assert.deepEqual(Object.keys(a.posts[0].body).sort(),['amountCents','requestId']);assert.ok(a.posts[0].body.requestId.length>=12);
 assert.equal(a.snapshots[0][0],'credits');assert.equal(a.snapshots[0][1].balance,110);assert.ok(a.snapshots.some(s=>s[0]==='wallet'&&s[1]===true));assert.equal(a.notifications.at(-1).type,'success');
});
test('all converts only whole pesos and cancel never sends a conversion',async()=>{
 const a=app();await a.open();await a.nodes['[data-convert-all]'].fire('click');assert.equal(a.nodes['#acc-amount'].value,'450');assert.equal(a.nodes['[data-convert-remaining]'].textContent,'$0.50 MXN');await a.nodes['[data-convert-cancel]'].fire('click');assert.equal(a.posts.length,0);assert.equal(a.api.isOpen(),false);
});
test('offline opening and offline submit never update wallets or claim success',async()=>{
 const a=app();a.context.navigator.onLine=false;await a.open();assert.equal(a.cfg,undefined);assert.equal(a.summaries.length,0);a.context.navigator.onLine=true;await a.open();await a.input('25');a.context.navigator.onLine=false;await a.submit();assert.equal(a.posts.length,0);assert.equal(a.snapshots.length,0);assert.match(a.nodes['#acc-error'].textContent,/No hay conexión/);assert.ok(!a.notifications.some(n=>n.type==='success'));
});
test('response lost keeps the same request id after closing and reopening with zero remaining balance',async()=>{
 let calls=0,available=45000;const a=app({summary:()=>({registered:true,ambassador:{active:true},wallet:{availableCents:available,debtCents:0}}),request(path,opts){if(++calls===1){available=0;throw Error('connection lost');}return {converted:true,duplicate:true,conversion:{credits:450},credits:{balance:460},wallet:{availableCents:0}};}});
 await a.open();await a.input('450');await a.submit();assert.equal(a.snapshots.length,0);assert.equal(a.api.hasPending(),true);assert.equal(a.nodes['#acc-amount'].readOnly,true);await a.nodes['[data-convert-cancel]'].fire('click');await a.open();assert.equal(a.nodes['#acc-amount'].value,'450');await a.submit();assert.equal(a.posts[0].body.requestId,a.posts[1].body.requestId);assert.equal(a.posts[1].body.amountCents,45000);assert.equal(a.api.hasPending(),false);assert.equal(a.snapshots[0][1].balance,460);
});
test('server rejection stays visible, leaves balances intact and frees close controls',async()=>{
 const a=app({request(){throw Object.assign(Error('Saldo insuficiente'),{status:409});}});await a.open();await a.input('100');await a.submit();assert.match(a.nodes['#acc-error'].textContent,/Saldo insuficiente/);assert.equal(a.nodes['[data-convert-cancel]'].disabled,false);assert.equal(a.cfg.beforeClose(),true);assert.equal(a.api.hasPending(),false);assert.equal(a.snapshots.length,0);
});
test('logout/account switch while POST is pending cannot publish old-account balances',async()=>{
 let resolve;const a=app({request:()=>new Promise(r=>resolve=r)});await a.open();await a.input('100');const pending=a.submit();assert.equal(a.cfg.beforeClose(),false);a.window.__sessionEnding=true;a.listeners['icadem:session-ending']();assert.equal(a.root.isConnected,false);a.window.__currentUser={uid:'owner-b'};a.window.__sessionEnding=false;resolve({converted:true,conversion:{credits:100},credits:{balance:9999},wallet:{availableCents:0}});await pending;assert.equal(a.snapshots.length,0);assert.ok(!a.notifications.some(n=>n.type==='success'));assert.equal(a.api.hasPending(),false);
});
test('late balance response for account A cannot clear or populate an account B modal',async()=>{
 let resolve,count=0;const a=app({summary:()=>++count===1?new Promise(r=>resolve=r):{registered:true,ambassador:{active:true},wallet:{availableCents:15000}}});const pending=a.open();a.window.__currentUser={uid:'owner-b'};a.listeners['icadem:user-ready']();await a.open();assert.equal(a.api.isOpen(),true);resolve({registered:true,ambassador:{active:true},wallet:{availableCents:9999999}});await pending;assert.equal(a.api.isOpen(),true);assert.match(a.cfg.body,/\$150\.00/);assert.doesNotMatch(a.cfg.body,/99,999/);
});
