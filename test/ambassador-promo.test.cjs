'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const DAY = 86400000;
const config = { enabled:true, commissionCents:15000, discountCents:25000, minimumPaidCents:20000, minimumWithdrawalCents:10000, validationDays:7, attributionDays:30, eligiblePlans:['mensual','anual'] };
const fixture = () => ({ registered:false, config:{...config} });
function app(options = {}) {
  const stored = new Map(), session = new Map(), timers = new Map(), events = {}, windowEvents = {}, roots = {}, dialogs = [], queued = [], navigated = [];
  let timerId = 0, home = true;
  for (const id of ['ambassador-home-promo','ambassador-profile-promo']) roots[id] = {hidden:true,innerHTML:'',replaceChildren(){this.innerHTML='';}};
  const focus = {isConnected:true,focus(){this.restored=true;}};
  const document = { readyState:'loading', visibilityState:'visible', activeElement:focus,
    body:{classList:{contains:()=>home},append(root){dialogs.push(root);}},
    addEventListener(name,fn){events[name]=fn;},getElementById:id=>roots[id],querySelectorAll:()=>options.blocker ? [options.blocker] : [],
    createElement(){const listeners={};return {dataset:{},open:false,optout:{checked:false},setAttribute(){},
      addEventListener(name,fn){listeners[name]=fn;},listeners,showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},
      querySelector(selector){return selector==='[data-amb-optout]' ? this.optout : {focus(){}};}};}
  };
  const context = {document,Intl,Date,location:{},setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},
    localStorage:{getItem:key=>stored.get(key),setItem(key,value){if(options.storageFail)throw Error('denied');stored.set(key,value);}},
    sessionStorage:{getItem:key=>session.get(key),setItem:(key,value)=>session.set(key,value)},
    window:{UserState:{uid:'user-a'},__isDemoMode:!!options.demo,addEventListener(name,fn){windowEvents[name]=fn;},getComputedStyle:element=>element.style,
      ICADEMAmbassadors:{getSummary:options.load || (async()=>fixture())},ICADEMExperience:{enqueue:id=>queued.push(id)},navigateToSection:id=>navigated.push(id)}
  };
  const source = fs.readFileSync(__dirname+'/../js/icadem-ambassador-promo.js','utf8').replace('window.ICADEMAmbassadorPromo =', 'window.__test = {autoAllowed,validConfig,popupMarkup,cardMarkup,refresh,show,closeDialog,openInfo,init,readState}; window.ICADEMAmbassadorPromo =');
  vm.runInNewContext(source,context);
  return {...context.window.__test,context,stored,session,timers,events,windowEvents,roots,dialogs,queued,navigated,focus,setHome:value=>{home=value;}};
}
test('automatic invitation respects membership, seven-day cooldown, session and opt-out', () => {
  const ui=app(), data=fixture(), now=20*DAY;
  assert.equal(ui.autoAllowed(data,{},false,now),true);
  assert.equal(ui.autoAllowed(data,{lastShown:now-7*DAY},false,now),true);
  for(const state of [{lastShown:now-6*DAY},{lastShown:now+DAY},{disabled:true}]) assert.equal(ui.autoAllowed(data,state,false,now),false);
  assert.equal(ui.autoAllowed(data,{},true,now),false);
  assert.equal(ui.autoAllowed({...data,registered:true},{},false,now),false);
  assert.equal(ui.autoAllowed({...data,registered:undefined},{},false,now),false);
});
test('disabled, missing or invalid program configuration never promotes a guessed reward', () => {
  const ui=app();
  for(const data of [null,{}, {config:{...config,enabled:false}}, {config:{...config,commissionCents:NaN}}, {config:{...config,eligiblePlans:['unknown']}}]) assert.equal(ui.validConfig(data),false);
  assert.doesNotMatch(ui.popupMarkup(null,0), /\$150|\$250/);
});
test('copy uses server amounts, validation, eligible plans and withdrawal conditions', () => {
  const ui=app(), data={registered:false,config:{...config,commissionCents:17500,discountCents:27500,validationDays:9,eligiblePlans:['anual']}};
  const html=ui.popupMarkup(data,0);
  assert.match(html,/\$175/);assert.match(html,/\$275/);assert.match(html,/9 días de validación/);assert.match(html,/membresía anual elegible/);
  assert.doesNotMatch(html,/membresía mensual/);assert.match(html,/Retiro mínimo/);assert.match(html,/contracargos/);
  assert.notEqual(html,ui.popupMarkup(data,1));
});
test('existing ambassadors get a dashboard entry instead of an enrollment invitation', () => {
  const html=app().cardMarkup({...fixture(),registered:true,ambassador:{active:true}},'home');
  assert.match(html,/Ir a mi panel/);assert.doesNotMatch(html,/Quiero ser embajador|Para tu invitado/);
});
test('failed loading hides both cards, and stale account responses cannot repaint them', async () => {
  const failed=app({load:async()=>{throw Error('offline');}});await failed.refresh();
  assert.equal(failed.roots['ambassador-home-promo'].hidden,true);
  let resolve;const ui=app({load:()=>new Promise(done=>{resolve=done;})}),pending=ui.refresh();
  ui.context.window.UserState.uid='user-b';resolve(fixture());await pending;
  assert.equal(ui.roots['ambassador-home-promo'].hidden,true);
});
test('automatic dialog requires visible Inicio, available storage and no competing dialog', async () => {
  const ui=app();ui.setHome(false);assert.equal(await ui.context.window.ICADEMAmbassadorPromo.openAutomatic(),'not-home');
  ui.setHome(true);ui.context.document.visibilityState='hidden';assert.equal(await ui.show(fixture(),true),'ineligible');
  assert.equal(await app({storageFail:true}).show(fixture(),true),'storage-unavailable');
  assert.equal(await app({blocker:{style:{display:'block',visibility:'visible',opacity:'1'}}}).show(fixture(),true),'unavailable');
});
test('dismissal resolves experience queue, restores focus and persists opt-out per account', async () => {
  const ui=app(),pending=ui.show(fixture(),true);
  assert.equal(ui.dialogs.length,1);ui.dialogs[0].optout.checked=true;ui.closeDialog();await pending;
  assert.equal(ui.dialogs[0].removed,true);assert.equal(ui.focus.restored,true);assert.equal(ui.readState('user-a').disabled,true);
  assert.equal(await ui.show(fixture(),true),'ineligible');
  assert.equal(ui.readState('user-b').disabled,undefined);
  const manual=ui.show(fixture(),false);assert.equal(ui.dialogs.length,2);ui.closeDialog();await manual;
});
test('scheduler waits 25 seconds and rechecks eligibility before enqueueing', async () => {
  const ui=app();ui.init();await new Promise(resolve=>setImmediate(resolve));
  const timer=[...ui.timers.values()].find(item=>item.delay===25000);assert.ok(timer);
  ui.setHome(false);timer.fn();assert.equal(ui.queued.length,0);
  ui.setHome(true);timer.fn();assert.deepEqual(ui.queued,['ambassador-invite']);
});
test('manual request is discarded if user navigates while its configuration is loading', async () => {
  let resolve;const ui=app({load:()=>new Promise(done=>{resolve=done;})});ui.init();
  const pending=ui.openInfo();const firstResolve=resolve;
  ui.setHome(false);ui.windowEvents['icadem:navigation']();firstResolve(fixture());await pending;
  assert.equal(ui.dialogs.length,0);
});
test('Escape closes invitation and demo never enrolls or schedules a guest automatically', async () => {
  const ui=app({demo:true});ui.init();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.timers.size,0);
  const pending=ui.show(null,false);ui.dialogs[0].listeners.cancel({preventDefault(){}});await pending;
  assert.equal(ui.dialogs[0].removed,true);assert.deepEqual(ui.navigated,[]);
});
