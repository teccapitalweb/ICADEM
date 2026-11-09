'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

function app(options = {}) {
  const listeners = {};
  const clipboard = [];
  const opened = [];
  const context = {
    window: { ICADEMPlatform: { request: options.request || (async () => ({ registered: false, config: {} })) },
      open(url) { const popup = { location: { href: url }, opener: null }; opened.push(popup); return popup; } },
    navigator: { clipboard: { async writeText(text) { clipboard.push(text); } }, ...options.navigator },
    document: { addEventListener(name, fn) { listeners[name] = fn; }, querySelectorAll() { return []; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { search: '' }, URLSearchParams, Intl, Date, crypto
  };
  const source = fs.readFileSync(__dirname + '/../js/icadem-ambassadors.js', 'utf8')
    .replace('window.ICADEMAmbassadors={render:', 'window.__ui={enrollMarkup,dashboardMarkup,withdrawalPageMarkup,analyticsMarkup,shareMessage,shareTo,bind,normalizeClabe,normalizePhone,clabeError,phoneError,setPresentationMode:value=>{presentationMode=value;}};window.ICADEMAmbassadors={render:');
  vm.runInNewContext(source, context);
  return { ...context.window.__ui, context, listeners, clipboard, opened };
}

function fixture(extra = {}) {
  return { registered: true, ambassador: { active: true, code: 'BRI-TEST2', whatsapp: '+525512345678', referralUrl: 'https://www.icademx.com/vip-auth.html?ref=BRI-TEST2' },
    wallet: { availableCents: 15000, pendingCents: 15000, reservedCents: 0, debtCents: 0, totalEarnedCents: 15000 },
    category: 'vip', benefits: { directCommissionCents: 15000, monthlyDiscountCents: 25000, annualDiscountCents: 30000 },
    config: { commissionCents: 15000, discountCents: 25000, minimumWithdrawalCents: 10000 },
    bank: { holderName: 'Persona de prueba', bank: 'Banco de prueba', last4: '1234' },
    analytics: { uniqueVisits: 10, registeredVisitors: 4, paidVisitors: 2, visitorsWithoutPurchase: 8, paidReferrals: 2 },
    referrals: [], commissions: [], withdrawals: [], ...extra };
}

test('dashboard keeps banking forms and withdrawal history in a separate view', () => {
  const ui = app(), data = fixture(), dashboard = ui.dashboardMarkup(data), withdrawals = ui.withdrawalPageMarkup(data);
  assert.match(dashboard, /data-amb-view="withdrawals"/);
  assert.doesNotMatch(dashboard, /data-amb-bank(?:\s|>)/);
  assert.doesNotMatch(dashboard, /data-amb-whatsapp/);
  assert.doesNotMatch(dashboard, /Historial de retiros/);
  assert.match(withdrawals, /data-amb-bank/);
  assert.match(withdrawals, /data-amb-whatsapp/);
  assert.match(withdrawals, /data-amb-withdraw/);
  assert.match(withdrawals, /Historial de retiros/);
  assert.match(withdrawals, /data-amb-view="dashboard"/);
});

test('contact fields normalize separators without truncating pasted digits', () => {
  const ui = app(), html = ui.withdrawalPageMarkup(fixture({ ambassador: { active: true, whatsapp: '' } }));
  assert.doesNotMatch(html.match(/<input id="amb-whatsapp"[^>]+>/)[0], /maxlength|pattern=/);
  assert.doesNotMatch(html.match(/<input id="amb-bank-clabe"[^>]+>/)[0], /maxlength|pattern=/);
  for(const value of ['+52 238 147 9821','+52-238-147-9821','(+52) 238 147 9821','+5212381479821']){
    assert.equal(ui.normalizePhone(value),'+522381479821');
    assert.equal(ui.phoneError(ui.normalizePhone(value)),'');
  }
  assert.notEqual(ui.phoneError(ui.normalizePhone('2381479821')),'');
  for(const value of ['012345678901234567','0123 4567 8901 2345 67','0123-4567-8901-2345-67','0123\n4567\n8901234567'])assert.equal(ui.normalizeClabe(value),'012345678901234567');
  assert.match(html, /Guarda tu WhatsApp en esta página/);
  assert.doesNotMatch(ui.dashboardMarkup(fixture()), /WhatsApp de contacto/);
});

test('input handlers clean a complete paste and preserve initial zeroes and excess digits for validation', () => {
  const ui=app(),counter={},error={},field={value:'',selectionStart:null,handlers:{},setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;}};
  const root={querySelectorAll(){return [];},querySelector(selector){return selector==='#amb-bank-clabe'?field:selector==='#amb-clabe-count'?counter:selector==='#amb-clabe-error'?error:null;}};
  ui.bind(root,fixture());
  field.value='0123 4567 8901 2345 67';field.handlers.input();
  assert.equal(field.value,'012345678901234567');assert.equal(counter.textContent,'18 de 18 dígitos');
  field.value='0123 4567 8901 2345 678';field.handlers.input();
  assert.equal(field.value.length,19);assert.match(ui.clabeError(field.value),/Sobran 1/);
  assert.match(ui.clabeError('0123'),/Faltan 14/);
  assert.match(ui.clabeError('012345678901234567'),/verificador/);
});

test('actualizar abre un teléfono vacío y Guardar envía el número normalizado al servidor', async () => {
  const requests=[],ui=app({request:async(path,options)=>{requests.push({path,body:options.body});throw new Error('Offline');}});
  const field={value:'dato anterior',selectionStart:null,handlers:{},focus(){},setAttribute(){},addEventListener(event,fn){this.handlers[event]=fn;}};
  const button={},edit={addEventListener(event,fn){this.click=fn;}},summary={setAttribute(name){this.hidden=name==='hidden';}},error={};
  const form={hidden:true,elements:{namedItem:()=>field},querySelector:selector=>selector==='input'?field:button,removeAttribute(){this.hidden=false;},reportValidity:()=>true,addEventListener(event,fn){this.submit=fn;}};
  const root={querySelectorAll(){return [];},querySelector(selector){return selector==='#amb-whatsapp'?field:selector==='[data-amb-whatsapp]'?form:selector==='[data-amb-phone-edit]'?edit:selector==='[data-amb-phone-summary]'?summary:selector==='#amb-phone-error'?error:null;}};
  ui.bind(root,fixture());edit.click();assert.equal(field.value,'');assert.equal(form.hidden,false);assert.equal(summary.hidden,true);
  field.value='(+52) 238 147-9821';field.handlers.input();assert.equal(field.value,'+522381479821');
  await form.submit({preventDefault(){},currentTarget:form});
  assert.equal(requests[0].path,'/api/ambassadors/whatsapp');assert.equal(requests[0].body.whatsapp,'+522381479821');
});

test('saved phone is masked, update form is empty and presentation excludes personal and banking information', () => {
  const ui=app(),data=fixture({ambassador:{active:true,code:'BRI-TEST2',name:'Persona Privada',whatsapp:{registered:true,masked:'+52 ••• ••• 9821',last4:'9821'}},bank:{holderName:'Titular Privado',bank:'Banco Privado',last4:'0563'},referrals:[{buyer:'Cliente Privado',status:'registered'}],commissions:[{buyer:'cliente@correo.test',commissionCents:15000}],network:{directAmbassadors:[{code:'RED-ABCDE',active:true}]},withdrawals:[{amountCents:10000,bank:'Banco Privado',bankLast4:'0563',receiptUrl:'https://private.test/receipt',status:'paid'}]});
  let html=ui.withdrawalPageMarkup(data);
  assert.match(html,/\+52 ••• ••• 9821/);assert.match(html,/Número guardado correctamente/);
  assert.match(html,/data-amb-phone-edit/);assert.match(html,/<input id="amb-whatsapp"[^>]+value=""/);
  assert.match(html,/<input id="amb-bank-clabe"[^>]+value=""/);
  assert.doesNotMatch(html,/\+522381479821/);
  assert.doesNotMatch(ui.dashboardMarkup(data),/Cliente Privado|cliente@correo.test/);
  ui.setPresentationMode(true);
  html=ui.withdrawalPageMarkup(data)+ui.dashboardMarkup(data);
  assert.doesNotMatch(html,/Persona Privada|Titular Privado|Banco Privado|0563|9821|private.test|RED-ABCDE|Cliente Privado|cliente@correo.test/);
  assert.doesNotMatch(html,/data-amb-whatsapp|data-amb-bank(?:\s|>)/);
  assert.match(html,/aria-checked="true"/);assert.match(html,/Saldo disponible/);assert.match(html,/\$150/);
  const css=fs.readFileSync(__dirname+'/../css/ambassadors.css','utf8');
  for(const surface of ['#btn-avatar','#notif-dropdown','.toast-container','.modal-backdrop'])assert.ok(css.includes('body.amb-presentation-active '+surface));
});

test('enrollment back button returns to the previous section or profile', () => {
  const ui = app(), button = { addEventListener(_name, callback) { this.click = callback; } };
  const root = { querySelector(selector) { return selector === '[data-amb-back]' ? button : null; }, querySelectorAll() { return []; } };
  const visited = [];
  assert.match(ui.enrollMarkup(fixture({registered:false})), /data-amb-back/);
  ui.bind(root, {registered:false});
  ui.context.window.navigateToSection = section => visited.push(section);
  ui.context.window.__seccionAnteriorVIP = 'cursos';
  button.click();
  ui.context.window.__seccionAnteriorVIP = 'curso-detalle';
  button.click();
  ui.context.window.__seccionAnteriorVIP = null;
  button.click();
  assert.deepEqual(visited, ['cursos', 'cursos', 'perfil']);
});

test('dashboard derives current category benefits from server', () => {
  const html = app().dashboardMarkup(fixture({ benefits: { directCommissionCents: 17500, monthlyDiscountCents: 27500, annualDiscountCents: 32500 } }));
  assert.match(html, /\$175 MXN/);
  assert.match(html, /\$275 MXN/);
  assert.match(html, /\$325 MXN/);
  assert.doesNotMatch(html, /Tú recibes \$(100|150) MXN/);
});

test('charts show known real totals and a neutral zero or unavailable state', () => {
  const ui = app();
  assert.match(ui.analyticsMarkup(fixture()), /20%/);
  assert.match(ui.analyticsMarkup(fixture()), /2 visitas con compra y 8 sin compra/);
  const empty = ui.analyticsMarkup({ analytics: { uniqueVisits: 0, registeredVisitors: 0, paidVisitors: 0, visitorsWithoutPurchase: 0 } });
  assert.match(empty, /Aún no hay visitas registradas/);
  assert.doesNotMatch(empty, /NaN|Infinity/);
  assert.match(ui.analyticsMarkup({}), /estadísticas todavía no están disponibles/);
});

test('suspended or under-minimum accounts cannot submit a withdrawal', () => {
  const ui = app();
  assert.match(ui.withdrawalPageMarkup(fixture({ ambassador: { active: false } })), /type="submit" disabled/);
  assert.match(ui.withdrawalPageMarkup(fixture({ wallet: { availableCents: 5000 } })), /type="submit" disabled/);
  assert.doesNotMatch(ui.withdrawalPageMarkup(fixture()), /type="submit" disabled/);
});

test('predefined message carries the real code and referral link to WhatsApp', async () => {
  const ui = app(), data = fixture(), root = { querySelector() { return null; } };
  await ui.shareTo(root, data.ambassador, 'whatsapp');
  const url = new URL(ui.opened[0].location.href);
  assert.equal(url.hostname, 'web.whatsapp.com');
  assert.equal(url.searchParams.get('text'), ui.shareMessage(data.ambassador));
  assert.match(url.searchParams.get('text'), /BRI-TEST2/);
  assert.match(url.searchParams.get('text'), /primer pago de tu membresía mensual o anual/);
  for (const emoji of ['🤩','💖','🎁','💝','🥳','🎉']) assert.ok(url.searchParams.get('text').includes(emoji));
  assert.doesNotMatch(url.searchParams.get('text'), /\uFFFD/);
  assert.ok(url.searchParams.get('text').length < 600);
});

test('mobile shares original Unicode directly and cancellation does not open another application', async () => {
  const shared=[], root={querySelector(){return null;}};
  const ui=app({navigator:{userAgent:'iPhone',share:async payload=>shared.push(payload)}});
  await ui.shareTo(root,fixture().ambassador,'whatsapp');
  assert.equal(shared[0].text,ui.shareMessage(fixture().ambassador));
  assert.equal(ui.opened.length,0);
  const cancelled=app({navigator:{userAgent:'Android',share:async()=>{throw Object.assign(new Error(),{name:'AbortError'});}}});
  await cancelled.shareTo(root,fixture().ambassador,'whatsapp');
  assert.equal(cancelled.opened.length,0);
});

test('unsupported mobile sharing uses a readable message without emoji', async () => {
  const ui=app({navigator:{userAgent:'Android'}}), root={querySelector(){return null;}};
  await ui.shareTo(root,fixture().ambassador,'whatsapp');
  const url=new URL(ui.opened[0].location.href);
  assert.equal(url.hostname,'api.whatsapp.com');
  assert.equal(url.searchParams.get('text'),ui.shareMessage(fixture().ambassador,false));
  assert.doesNotMatch(url.searchParams.get('text'), /\p{Extended_Pictographic}|\uFFFD/u);
});

test('Facebook copies the complete text and shares a compact invitation with the original referral code', async () => {
  const ui=app(),help={},root={querySelector(){return help;}};
  await ui.shareTo(root,fixture().ambassador,'facebook');
  const url=new URL(ui.opened[0].location.href), invitation=new URL(url.searchParams.get('u'));
  assert.equal(invitation.pathname,'/invitacion.html');
  assert.equal(invitation.searchParams.get('ref'),'BRI-TEST2');
  assert.equal(ui.clipboard[0],ui.shareMessage(fixture().ambassador));
  assert.ok(ui.clipboard[0].includes(invitation.href));
  assert.doesNotMatch(ui.clipboard[0], /\*|\uFFFD/);
  assert.match(help.textContent,/Pégalo en tu publicación/);
});

test('compact invitation passes the valid code through registration and rejects injected destinations', () => {
  const html=fs.readFileSync(__dirname+'/../invitacion.html','utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(html, /<img\b|property="og:(?:image|url)"|name="twitter:image"|rel="canonical"/);
  for(const [search,expected] of [['?ref=BRI-TEST2','vip-auth.html?tab=register&ref=BRI-TEST2'],['?ref=bad&redirect=https://evil.test','vip-auth.html?tab=register']]){
    let destination;const link={};
    vm.runInNewContext(script,{URLSearchParams,location:{search,replace(value){destination=value;}},document:{getElementById(){return link;}}});
    assert.equal(destination,expected);assert.equal(link.href,expected);
  }
});

test('Messenger and Instagram fall back to copying the complete invitation', async () => {
  const ui = app(), data = fixture(), help = {}, root = { querySelector() { return help; } };
  await ui.shareTo(root, data.ambassador, 'messenger');
  assert.equal(ui.clipboard[0], ui.shareMessage(data.ambassador));
  assert.match(help.textContent, /Abre Messenger/);
  await ui.shareTo(root, data.ambassador, 'instagram');
  assert.equal(ui.clipboard[1], ui.shareMessage(data.ambassador));
  assert.match(help.textContent, /Abre Instagram/);
});

test('a failed withdrawal retry preserves its idempotency key', async () => {
  const bodies = [], ui = app({ request: async (path, options) => { bodies.push(options.body); throw new Error('Network lost'); } });
  const button = {}, form = { dataset: {}, amount: { value: '150' }, querySelector() { return button; }, addEventListener(type, callback) { this.submit = callback; } };
  const root = { querySelectorAll() { return []; }, querySelector(selector) { return selector === '[data-amb-withdraw]' ? form : null; } };
  ui.bind(root, fixture());
  await form.submit({ preventDefault() {}, currentTarget: form });
  await form.submit({ preventDefault() {}, currentTarget: form });
  assert.equal(bodies[0].requestId, bodies[1].requestId);
  assert.equal(bodies[0].amountCents, 15000);
});

test('member-controlled strings are escaped in the dashboard', () => {
  const data = fixture(); data.ambassador.code = '<script>alert(1)</script>';
  const html = app().dashboardMarkup(data);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
