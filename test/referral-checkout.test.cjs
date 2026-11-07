'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const panel = fs.readFileSync(path.join(root, 'vip-panel.html'), 'utf8');
const checkoutSource = panel.slice(panel.indexOf('  async function renderSuscripcionActivar('), panel.indexOf('  /* ─── Estado: ADMIN (cuenta interna'));
const trackerSource = fs.readFileSync(path.join(root, 'js/icadem-referral.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function element() {
  return { innerHTML:'', textContent:'', value:'', hidden:false, disabled:false, handlers:{}, classList:{add(){},remove(){},toggle(){}},
    addEventListener(event, handler) { this.handlers[event]=handler; }, focus(){} };
}
function fixture(responder, search='') {
  const ids = Object.fromEntries(['sub-checkout-mount','sub-referral-form','sub-referral-code','sub-referral-summary','sub-referral-remove'].map(id=>[id,element()]));
  const submit=element();
  ids['sub-referral-form'].querySelector=()=>submit;
  const cards=['mensual','anual'].map(plan=>Object.assign(element(),{dataset:{plan}}));
  cards.forEach(card=>{card.price=element();card.querySelector=()=>card.price;});
  const requests=[], mounts=[], destroyed=[];
  const storage = new Map();
  const win = { __currentUser:{getIdToken:async()=>'test-token'}, ICADEMReferral:{savedCode:()=>'',visitorId:()=> '11111111-2222-4333-8444-555555555555'},
    __stripe:{initEmbeddedCheckout:async({clientSecret})=>({mount:()=>mounts.push(clientSecret),destroy:()=>destroyed.push(clientSecret)})} };
  const context = vm.createContext({ window:win, location:{search}, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:id=>ids[id],querySelectorAll:()=>cards}, URLSearchParams, AbortController, Intl, console:{error(){},warn(){}},
    leerPreciosVIP:async()=>({mes:450,ano:2100}), fmtPrecioVIP:n=>'$'+n,
    escapeHtml:value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    fetch:async(url,options)=>{ const body=JSON.parse(options.body); requests.push(body); return responder(body,requests.length); }
  });
  vm.runInContext(checkoutSource+';this.render=renderSuscripcionActivar;',context);
  return {context,ids,cards,requests,mounts,destroyed,render:()=>context.render(element(),{modo:'gratis'}),
    apply:async code=>{ids['sub-referral-code'].value=code;ids['sub-referral-form'].handlers.submit({preventDefault(){}});await tick();},
    remove:async()=>{ids['sub-referral-remove'].handlers.click();await tick();}};
}
function response(data,status=200){return {ok:status<400,status,json:async()=>data};}

test('aplica código antes de Stripe, muestra descuento real y solo el primer pago',async()=>{
  const f=fixture(body=>response({clientSecret:'cs_'+body.plan,referral:body.ambassadorCode ? {code:body.ambassadorCode,discountCents:25000,originalAmountCents:210000,totalAmountCents:185000}:null}));
  await f.render();await tick();await f.apply('bri-ab234');
  assert.equal(f.requests[1].ambassadorCode,'BRI-AB234');
  assert.equal(f.requests[1].visitorId,'11111111-2222-4333-8444-555555555555');
  assert.match(f.ids['sub-referral-summary'].innerHTML,/1,850/);
  assert.match(f.ids['sub-referral-summary'].innerHTML,/2,100/);
  assert.match(f.ids['sub-referral-summary'].innerHTML,/Primer pago/);
  await f.remove();
  assert.equal(f.requests[2].ignoreAmbassador,true);
  assert.equal(f.requests[2].ambassadorCode,undefined);
});

test('el código explícito reemplaza la promoción y nunca acumula ambos',async()=>{
  const f=fixture(()=>response({clientSecret:'cs_ok'}),'?offer=BIENVENIDA');
  await f.render();await tick();await f.apply('BRI-AB234');
  assert.equal(f.requests[0].promotionCode,'BIENVENIDA');
  assert.equal(f.requests[1].promotionCode,undefined);
  assert.equal(f.requests[1].ambassadorCode,'BRI-AB234');
  await f.remove();
  assert.equal(f.requests[2].promotionCode,'BIENVENIDA');
});

test('el precio vigente confirmado por el servidor actualiza la tarjeta seleccionada',async()=>{
  const f=fixture(body=>response({clientSecret:'cs_'+body.plan,pricing:{originalAmountCents:body.plan==='anual'?230000:50000,currency:'mxn'}}));
  await f.render();await tick();
  assert.equal(f.cards[1].price.textContent,'$2300');
  f.cards[0].handlers.click();await tick();
  assert.equal(f.cards[0].price.textContent,'$500');
});

test('código rechazado detiene checkout sin cobrar silenciosamente precio completo',async()=>{
  const f=fixture(body=>body.ambassadorCode ? response({error:'No puedes usar tu propio código.'},400):response({clientSecret:'cs_original'}));
  await f.render();await tick();await f.apply('BRI-AB234');
  assert.deepEqual(f.mounts,['cs_original']);
  assert.deepEqual(f.destroyed,['cs_original']);
  assert.match(f.ids['sub-referral-summary'].textContent,/propio código/);
  assert.equal(f.ids['sub-referral-remove'].hidden,false);
});

test('un resultado antiguo no reemplaza el plan seleccionado más recientemente',async()=>{
  let resolveAnnual;
  const f=fixture(body=>body.plan==='anual' ? new Promise(resolve=>{resolveAnnual=resolve;}) : response({clientSecret:'cs_monthly'}));
  await f.render();await tick();
  f.cards[0].handlers.click();await tick();
  resolveAnnual(response({clientSecret:'cs_annual_stale'}));await tick();
  assert.deepEqual(f.mounts,['cs_monthly']);
});

test('serializa inicializaciones Stripe y descarta la que quedó obsoleta',async()=>{
  const f=fixture(body=>response({clientSecret:'cs_'+body.plan}));
  let finishAnnual, pending=false, initializations=0;
  f.context.window.__stripe.initEmbeddedCheckout=async({clientSecret})=>{
    assert.equal(pending,false,'Stripe no admite inicializaciones embebidas simultáneas');
    initializations+=1;
    pending=true;
    if(clientSecret==='cs_anual') await new Promise(resolve=>{finishAnnual=resolve;});
    pending=false;
    return {mount:()=>f.mounts.push(clientSecret),destroy:()=>f.destroyed.push(clientSecret)};
  };
  await f.render();await tick();
  f.cards[0].handlers.click();await tick();
  assert.equal(initializations,1);
  finishAnnual();await tick();
  assert.deepEqual(f.destroyed,['cs_anual']);
  assert.deepEqual(f.mounts,['cs_mensual']);
});

test('el seguimiento reutiliza un identificador anónimo y suprime visitas repetidas del día',async()=>{
  const storage=new Map(),requests=[];
  const context=vm.createContext({window:{crypto:{randomUUID:()=> '11111111-2222-4333-8444-555555555555'}},location:{search:'?ref=BRI-AB234'},URLSearchParams,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true};}});
  vm.runInContext(trackerSource,context);await tick();
  await context.window.ICADEMReferral.captureVisit('BRI-AB234');
  assert.equal(requests.length,1);
  assert.deepEqual(JSON.parse(requests[0].options.body),{code:'BRI-AB234',visitorId:'11111111-2222-4333-8444-555555555555'});
  assert.equal(requests[0].options.referrerPolicy,'no-referrer');
  assert.equal(context.window.ICADEMReferral.savedCode(),'BRI-AB234');
});

test('la redirección de acceso conserva la suscripción interna y rechaza destinos ajenos',()=>{
  const authSource=fs.readFileSync(path.join(root,'vip-auth.html'),'utf8');
  const destinationSource=authSource.slice(authSource.indexOf('function destinoSeguro('),authSource.indexOf('async function syncCentralIdentity('));
  const context=vm.createContext({window:{location:{origin:'https://www.icademx.com',search:'?ref=BRI-AB234&redirect='+encodeURIComponent('vip-panel.html#suscripcion')}},URL,URLSearchParams});
  vm.runInContext(destinationSource,context);
  assert.equal(context.destinoSeguro(false),'vip-panel.html#suscripcion');
  context.window.location.search='?ref=BRI-AB234&redirect='+encodeURIComponent('https://external.example/pay');
  assert.equal(context.destinoSeguro(false),'vip-panel.html');
});
