'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));
function member(extra = {}) {
  return { registered: true, category: 'free', ambassador: { active: true, code: 'TES-ABCDE' }, config: { directCommissionFreeCents: 10000, directCommissionVipCents: 15000, minimumWithdrawalCents: 10000 }, wallet: {}, analytics: {}, referrals: [], commissions: [], withdrawals: [], ...extra };
}
function app() {
  const windowEvents = new Map(), documentEvents = new Map(), requests = [], renders = [], navigations = [], timers = new Map(), scrolls = [], sent = [], clipboard = [];
  let timerId = 0;
  const on = (map, name, fn) => { if (!map.has(name)) map.set(name, []); map.get(name).push(fn); };
  const emit = (map, name, detail) => { for (const fn of map.get(name) || []) fn({ type: name, detail }); };
  class Node {
    constructor() { this.handlers = {}; this.dataset = {}; this.isConnected = true; this.open = false; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute() {} removeAttribute() {} querySelector() { return null; } querySelectorAll() { return []; }
    focus() { document.activeElement = this; } scrollIntoView(options) { scrolls.push({ node: this, options }); }
  }
  const document = { visibilityState: 'visible', activeElement: null, overlayOpen: false, body: { classList: { toggle() {}, remove() {} } },
    addEventListener(name, fn) { on(documentEvents, name, fn); }, querySelector(selector) { return this.overlayOpen && selector.includes('.modal-backdrop.is-open') ? {} : null; }, querySelectorAll() { return []; } };
  const root = new Node(); let html = '', section = null, heading = null, enroll = null, retry = null;
  Object.defineProperty(root, 'innerHTML', { get() { return html; }, set(value) {
    html = value; section = null; heading = value.includes('data-amb-heading') ? new Node() : null; enroll = value.includes('data-amb-enroll') ? new Node() : null; retry = value.includes('data-amb-retry') ? new Node() : null;
    const markup = /<section\b[^>]*data-amb-sharing[^>]*>([\s\S]*?)<\/section>/.exec(value)?.[1];
    if (!markup) return;
    section = new Node(); section.markup = markup; section.message = new Node();
    section.social = [...markup.matchAll(/data-amb-social="([^"]+)"/g)].map(match => { const node = new Node(); node.dataset.ambSocial = match[1]; return node; });
    section.copy = [...markup.matchAll(/data-amb-copy="([^"]+)"/g)].map(match => { const node = new Node(); node.dataset.ambCopy = match[1]; return node; });
    section.querySelector = selector => selector === '.amb-message' ? section.message : selector === '[data-amb-copy]' ? section.copy[0] || null : selector === 'button' ? section.social[0] || section.copy[0] || null : null;
  } });
  root.querySelector = selector => selector === '[data-amb-sharing]' ? section : selector === '[data-amb-heading]' ? heading : selector === '[data-amb-enroll]' ? enroll : selector === '[data-amb-retry]' ? retry : null;
  root.querySelectorAll = selector => selector === '[data-amb-social]' ? section?.social || [] : selector === '[data-amb-copy]' ? section?.copy || [] : [];
  const location = { search: '', hash: '#perfil' };
  const window = { __currentUser: { uid: 'owner-a' }, addEventListener(name, fn) { on(windowEvents, name, fn); },
    ICADEMPlatform: { request(path, options = {}) { return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })); } },
    open(...args) { sent.push(args); }, matchMedia() { return { matches: true }; } };
  const navigate = sectionName => { navigations.push(sectionName); location.hash = '#' + sectionName; emit(windowEvents, 'icadem:navigation', { section: sectionName }); if (sectionName === 'embajadores') renders.push(window.ICADEMAmbassadors.render(root)); };
  window.navigateToSection = navigate;
  const context = { window, document, location, navigator: { onLine: true, clipboard: { writeText(text) { clipboard.push(text); return Promise.resolve(); } }, share(data) { sent.push(data); return Promise.resolve(); } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, URLSearchParams, Intl, Date,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); }, setInterval() {} };
  vm.createContext(context);
  for (const name of ['icadem-ambassadors-vip.js', 'icadem-ambassadors.js']) vm.runInContext(fs.readFileSync(__dirname + '/../js/' + name, 'utf8'), context);
  return { window, document, root, location, requests, renders, navigations, scrolls, sent, clipboard, timers, navigate,
    loadPromo() {
      const roots = Object.fromEntries(['ambassador-profile-promo', 'ambassador-home-promo', 'ambassador-topbar-promo'].map(id => [id, { hidden: true, innerHTML: '', setAttribute() {}, replaceChildren() { this.innerHTML = ''; } }]));
      window.UserState = { uid: window.__currentUser.uid }; document.readyState = 'loading'; document.getElementById = id => roots[id]; document.body.classList.contains = () => false;
      vm.runInContext(fs.readFileSync(__dirname + '/../js/icadem-ambassador-promo.js', 'utf8'), context); return roots;
    },
    get section() { return section; }, emitDocument(name) { emit(documentEvents, name); },
    runTimers(ms) { for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); } } };
}
async function complete(app, data) { app.requests.at(-1).resolve(data); await app.renders.at(-1); app.runTimers(140); }

test('profile sharing entry opens the existing dashboard and free promotion tools with the original code, without sending', async () => {
  const a = app(), opening = a.window.ICADEMAmbassadors.openSharing(); await flush();
  assert.deepEqual(a.navigations, ['embajadores']); assert.equal(a.scrolls.length, 0);
  assert.equal(a.requests.length, 1); assert.equal(a.requests[0].path, '/api/ambassadors/me'); assert.equal(a.requests[0].options.method, undefined);
  await complete(a, member()); assert.equal(await opening, true);
  assert.match(a.section.markup, /TES-ABCDE/); assert.equal(a.section.message.open, true);
  assert.equal(a.scrolls[0].node, a.section); assert.equal(a.scrolls[0].options.block, 'start'); assert.equal(a.scrolls[0].options.behavior, 'auto');
  assert.equal(a.document.activeElement, a.section.social[0]); assert.equal(a.sent.length, 0); assert.equal(a.clipboard.length, 0);
});

test('VIP entry reuses its actual code and sharing section without opening a native share or copying', async () => {
  const a = app(), opening = a.window.ICADEMAmbassadors.openSharing(); await flush();
  await complete(a, member({ category: 'vip' })); assert.equal(await opening, true);
  assert.match(a.root.innerHTML, /Centro de Embajadores VIP/); assert.match(a.section.markup, /Código: <strong>TES-ABCDE<\/strong>/);
  assert.equal(a.section.message.open, false); assert.equal(a.document.activeElement, a.section.copy[0]);
  assert.equal(a.sent.length, 0); assert.equal(a.clipboard.length, 0);
});

test('not configured and paused accounts retain the existing activation or paused panel and never auto-register', async () => {
  for (const data of [member({ registered: false, ambassador: null }), member({ ambassador: { active: false, code: 'TES-ABCDE' } })]) {
    const a = app(), opening = a.window.ICADEMAmbassadors.openSharing(); await flush(); await complete(a, data);
    assert.equal(await opening, false); assert.equal(a.scrolls.length, 0); assert.equal(a.document.activeElement, null);
    assert.match(a.root.innerHTML, data.registered ? /Tu perfil está en pausa/ : /data-amb-enroll/);
    assert.equal(a.requests.length, 1); assert.equal(a.requests[0].path, '/api/ambassadors/me'); assert.equal(a.sent.length, 0); assert.equal(a.clipboard.length, 0);
  }
});

test('navigation away cancels an unfinished sharing entry and its later scroll', async () => {
  for (const afterRender of [false, true]) {
    const a = app(), opening = a.window.ICADEMAmbassadors.openSharing(); await flush();
    if (afterRender) { a.requests[0].resolve(member()); await a.renders[0]; }
    a.navigate('cursos'); assert.equal(await opening, false);
    if (!afterRender) { a.requests[0].resolve(member()); await a.renders[0]; }
    a.runTimers(140); assert.equal(a.scrolls.length, 0); assert.equal(a.document.activeElement, null);
  }
});

test('account changes and session ending discard sharing intents and late acknowledgements', async () => {
  for (const reset of [false, true]) {
    const a = app(), opening = a.window.ICADEMAmbassadors.openSharing(); await flush();
    if (reset) { a.window.__sessionEnding = true; a.emitDocument('icadem:session-ending'); } else a.window.__currentUser = { uid: 'owner-b' };
    a.requests[0].resolve(member()); await a.renders[0]; a.runTimers(140);
    assert.equal(await opening, false); assert.equal(a.scrolls.length, 0); assert.equal(a.document.activeElement, null); assert.equal(a.sent.length, 0);
  }
});

test('a failed load, detached view or open modal cannot leave a late sharing focus', async () => {
  for (const mode of ['failure', 'detached', 'modal']) {
    const a = app(), opening = a.window.ICADEMAmbassadors.openSharing(); await flush();
    if (mode === 'failure') a.requests[0].reject(new Error('Red no disponible'));
    else { if (mode === 'detached') a.root.isConnected = false; if (mode === 'modal') a.document.overlayOpen = true; a.requests[0].resolve(member()); }
    await a.renders[0]; a.runTimers(140); assert.equal(await opening, false); assert.equal(a.scrolls.length, 0); assert.equal(a.document.activeElement, null);
    if (mode === 'failure') assert.match(a.root.innerHTML, /No pudimos cargar Embajadores/);
  }
});

test('a newer sharing action shares the in-flight summary and only its current render focuses', async () => {
  const a = app(), first = a.window.ICADEMAmbassadors.openSharing(); await flush();
  const second = a.window.ICADEMAmbassadors.openSharing(); await flush(); assert.equal(await first, false);
  assert.equal(a.requests.length, 1); a.requests[0].resolve(member()); await a.renders[0];
  assert.doesNotMatch(a.root.innerHTML, /No pudimos cargar Embajadores/);
  await a.renders[1]; a.runTimers(140);
  assert.equal(await second, true); assert.equal(a.scrolls.length, 1); assert.equal(a.sent.length, 0); assert.equal(a.clipboard.length, 0);
});

test('missing session, demo and unavailable navigation never trigger a share request or create a code', async () => {
  for (const mode of ['signed-out', 'demo', 'no-navigation']) {
    const a = app(); if (mode === 'signed-out') a.window.__currentUser = null; if (mode === 'demo') a.window.__isDemoMode = true; if (mode === 'no-navigation') delete a.window.navigateToSection;
    assert.equal(await a.window.ICADEMAmbassadors.openSharing(), false); assert.equal(a.requests.length, 0); assert.equal(a.navigations.length, 0); assert.equal(a.sent.length, 0);
  }
});

test('a reused panel root showing Mi perfil cannot be treated as a stable ambassador view after a failed entry', async () => {
  const a = app(), first = a.window.ICADEMAmbassadors.openSharing(); await flush(); await complete(a, member()); assert.equal(await first, true);
  a.navigate('perfil'); a.root.innerHTML = '<h1>Mi perfil</h1><p>Otros datos del perfil.</p>';
  const opening = a.window.ICADEMAmbassadors.openSharing(); await flush();
  a.requests.at(-1).reject(new Error('Red no disponible')); await a.renders.at(-1); assert.equal(await opening, false);
  assert.equal(a.location.hash, '#embajadores'); assert.doesNotMatch(a.root.innerHTML, /Mi perfil|Otros datos del perfil/);
  assert.match(a.root.innerHTML, /No pudimos cargar Embajadores/);
  const retry = a.root.querySelector('[data-amb-retry]'); assert.ok(retry); retry.handlers.click(); await flush();
  a.requests.at(-1).resolve(member()); await flush();
  assert.match(a.root.innerHTML, /Mi panel de Embajador/); assert.match(a.section.markup, /TES-ABCDE/);
  assert.equal(a.sent.length, 0); assert.equal(a.clipboard.length, 0);
});

test('three concurrent forced summary readers and the actual profile promotion share one authoritative request', async () => {
  const a = app(), readers = [true, true, true].map(force => a.window.ICADEMAmbassadors.getSummary(force)), roots = a.loadPromo();
  const promotion = a.window.ICADEMAmbassadorPromo.mountProfile(); await flush(); assert.equal(a.requests.length, 1);
  const data = member({ config: { enabled: true, commissionCents: 15000, discountCents: 25000, minimumPaidCents: 20000, minimumWithdrawalCents: 10000, validationDays: 7, attributionDays: 30, directCommissionVipCents: 15000, directCommissionFreeCents: 10000, eligiblePlans: ['mensual', 'anual'] } });
  a.requests[0].resolve(data); const results = await Promise.all(readers); await promotion;
  assert.ok(results.every(result => result === data));
  assert.equal(roots['ambassador-profile-promo'].hidden, false); assert.match(roots['ambassador-profile-promo'].innerHTML, /\$100/);
  assert.match(roots['ambassador-profile-promo'].innerHTML, /Ver mi código y compartir/); assert.equal(roots['ambassador-topbar-promo'].hidden, true);
  assert.equal(a.requests.length, 1); assert.equal(a.sent.length, 0); assert.equal(a.clipboard.length, 0);
});

test('shared summary failures remain retryable instead of poisoning the next profile mount', async () => {
  const a = app(), readers = [true, true, true].map(force => a.window.ICADEMAmbassadors.getSummary(force));
  const rejected = Promise.allSettled(readers); await flush(); assert.equal(a.requests.length, 1);
  a.requests[0].reject(new Error('Red interrumpida')); assert.ok((await rejected).every(result => result.status === 'rejected'));
  const retry = a.window.ICADEMAmbassadors.getSummary(true); await flush(); assert.equal(a.requests.length, 2);
  a.requests[1].resolve(member()); assert.equal((await retry).ambassador.code, 'TES-ABCDE');
});

test('a confirmed conversion invalidates only prior reads and no older summary can overwrite its acknowledged wallet', async () => {
  const a = app(), initial = a.window.ICADEMAmbassadors.getSummary(true); a.requests[0].resolve(member({ wallet: { availableCents: 15000 } })); await initial;
  const older = a.window.ICADEMAmbassadors.getSummary(true), discarded = assert.rejects(older, /datos cambiaron/);
  const conversion = { id: 'confirmed-conversion', amountCents: 10000, credits: 100 }, wallet = { availableCents: 5000 };
  a.window.ICADEMAmbassadors.acceptConversion({ wallet, conversion });
  assert.equal((await a.window.ICADEMAmbassadors.getSummary()).wallet.availableCents, 5000);
  const fresh = a.window.ICADEMAmbassadors.getSummary(true); await flush(); assert.equal(a.requests.length, 3);
  a.requests[1].resolve(member({ wallet: { availableCents: 15000 } })); await discarded;
  a.requests[2].resolve(member({ wallet, conversions: [conversion] })); assert.equal((await fresh).wallet.availableCents, 5000);
  assert.equal((await a.window.ICADEMAmbassadors.getSummary()).conversions[0].id, 'confirmed-conversion');
  assert.ok(a.requests.every(request => request.path === '/api/ambassadors/me' && !request.options.method));
});
