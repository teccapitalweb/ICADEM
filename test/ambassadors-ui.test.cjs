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
    .replace('window.ICADEMAmbassadors={render:', 'window.__ui={dashboardMarkup,withdrawalPageMarkup,analyticsMarkup,shareMessage,shareTo,bind};window.ICADEMAmbassadors={render:');
  vm.runInNewContext(source, context);
  return { ...context.window.__ui, context, listeners, clipboard, opened };
}

function fixture(extra = {}) {
  return { registered: true, ambassador: { active: true, code: 'BRI-TEST2', referralUrl: 'https://www.icademx.com/vip-auth.html?ref=BRI-TEST2' },
    wallet: { availableCents: 15000, pendingCents: 15000, reservedCents: 0, debtCents: 0, totalEarnedCents: 15000 },
    config: { commissionCents: 15000, discountCents: 25000, minimumWithdrawalCents: 10000 },
    bank: { holderName: 'Persona de prueba', bank: 'Banco de prueba', last4: '1234' },
    analytics: { uniqueVisits: 10, registeredVisitors: 4, paidVisitors: 2, visitorsWithoutPurchase: 8, paidReferrals: 2 },
    referrals: [], commissions: [], withdrawals: [], ...extra };
}

test('dashboard keeps banking forms and withdrawal history in a separate view', () => {
  const ui = app(), data = fixture(), dashboard = ui.dashboardMarkup(data), withdrawals = ui.withdrawalPageMarkup(data);
  assert.match(dashboard, /data-amb-view="withdrawals"/);
  assert.doesNotMatch(dashboard, /data-amb-bank(?:\s|>)/);
  assert.doesNotMatch(dashboard, /Historial de retiros/);
  assert.match(withdrawals, /data-amb-bank/);
  assert.match(withdrawals, /data-amb-withdraw/);
  assert.match(withdrawals, /Historial de retiros/);
  assert.match(withdrawals, /data-amb-view="dashboard"/);
});

test('dashboard derives current reward and discount from server config', () => {
  const html = app().dashboardMarkup(fixture({ config: { commissionCents: 17500, discountCents: 27500 } }));
  assert.match(html, /\$175 MXN/);
  assert.match(html, /\$275 MXN/);
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
