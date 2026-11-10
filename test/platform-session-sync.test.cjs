'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../js/icadem-platform-v2.js', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const copy = value => JSON.parse(JSON.stringify(value));

// Each app runs the complete production module in a separate browser context.
// Only transport, DOM and the clock are faked; the caches/publishers are real.
function app(server) {
  const docListeners = new Map(), winListeners = new Map(), intervals = new Map(), requests = [], events = [], elements = [];
  let now = 100000, timerId = 0;
  const classes = () => ({ values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); }, toggle(value, enabled) { enabled ? this.add(value) : this.remove(value); }, contains(value) { return this.values.has(value); } });
  class Element {
    constructor() { this.classList = classes(); this.isConnected = false; this.attributes = new Map(); this.children = []; this.style = {}; this.innerHTML = ''; this.body = null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    matches() { return false; }
    addEventListener() {}
    getClientRects() { return [1]; }
    focus() {}
    contains() { return false; }
    querySelectorAll() { return []; }
    querySelector(selector) { if (selector === '.credit-wallet-modal__body') return this.body ||= new Element(); return null; }
    remove() { this.isConnected = false; }
    appendChild(element) { element.isConnected = true; this.children.push(element); elements.push(element); return element; }
  }
  const document = {
    body: new Element(), visibilityState: 'visible', activeElement: null,
    createElement: () => new Element(), querySelectorAll: () => [], getElementById: () => null,
    querySelector: selector => selector === '.credit-wallet-modal' ? elements.find(element => element.className === 'credit-wallet-modal' && element.isConnected) || null : null,
    addEventListener(name, listener) { if (!docListeners.has(name)) docListeners.set(name, new Set()); docListeners.get(name).add(listener); },
    removeEventListener(name, listener) { docListeners.get(name)?.delete(listener); },
    dispatchEvent(event) { events.push(event); for (const listener of [...docListeners.get(event.type) || []]) listener(event); }
  };
  const window = {
    __auth: { currentUser: null }, UserState: { credits: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 } }, navigator: { onLine: true },
    addEventListener(name, listener) { if (!winListeners.has(name)) winListeners.set(name, new Set()); winListeners.get(name).add(listener); },
    location: { replace() {} }, __mergeServerProgress: courses => { window.confirmedProgress = copy(courses); }
  };
  class ClockDate extends Date { static now() { return now; } }
  const context = {
    window, document, Date: ClockDate, Intl, URLSearchParams, HTMLElement: Element,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    console: { warn() {} }, setTimeout: () => ++timerId, clearTimeout() {},
    setInterval: (fn, duration) => { intervals.set(++timerId, { fn, duration }); return timerId; }, clearInterval: id => intervals.delete(id),
    requestAnimationFrame: fn => fn(), localStorage: { getItem: () => null, setItem() {} },
    fetch: (url, config) => new Promise((resolve, reject) => {
      const item = { path: new URL(url).pathname, uid: config.headers.Authorization?.slice('Bearer token:'.length), body:config.body?JSON.parse(config.body):null, reject,
        respond: (data, status = 200) => resolve({ ok: status >= 200 && status < 300, status, json: async () => copy(data) }) };
      requests.push(item);
      if (server) Promise.resolve().then(() => server(item)).then(data => item.respond(data), reject);
    })
  };
  vm.runInNewContext(source, context);
  function authenticate(uid, ready = false) {
    const user = uid ? { uid, getIdToken: async () => 'token:' + uid } : null;
    window.__auth.currentUser = user; window.__currentUser = user; window.__sessionEnding = false;
    window.UserState = { uid, modo: 'sin-membresia', credits: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 } };
    if (ready) document.dispatchEvent({ type: 'icadem:user-ready' });
  }
  return { window, document, api: window.ICADEMPlatform, authenticate, requests, events, intervals, elements,
    emit: type => document.dispatchEvent({ type }),
    online: () => { for (const listener of winListeners.get('online') || []) listener({ type: 'online' }); },
    advance: amount => { now += amount; }, tick: () => { for (const interval of [...intervals.values()]) interval.fn(); } };
}
const credits = balance => ({ balance, lifetimeEarned: balance + 10, lifetimeSpent: 10 });
const identity = (uid, name, balance) => ({ profile: { uid, displayName: name }, directory: { uid, nombre: name }, membership: { active: false }, credits: credits(balance) });

test('fulfilled identity and wallet caches cannot cross accounts, even before user-ready fires', async () => {
  const a = app(); a.authenticate('a');
  let pending = a.api.syncIdentity(false, { progress: false }); await flush(); a.requests.at(-1).respond(identity('a', 'Alice', 100)); await pending;
  pending = a.api.loadCreditWallet(); await flush(); a.requests.at(-1).respond({ credits: credits(100), recentMovements: [{ id: 'private-a' }] }); await pending;
  a.authenticate('b');
  pending = a.api.syncIdentity(false, { progress: false }); await flush(); assert.equal(a.requests.at(-1).uid, 'b'); a.requests.at(-1).respond(identity('b', 'Britney', 25)); await pending;
  pending = a.api.loadCreditWallet(); await flush(); assert.equal(a.requests.at(-1).uid, 'b'); a.requests.at(-1).respond({ credits: credits(25), recentMovements: [{ id: 'private-b' }] });
  assert.equal((await pending).recentMovements[0].id, 'private-b'); assert.equal(a.window.UserState.nombre, 'Britney'); assert.equal(a.window.UserState.credits.balance, 25);
  assert.equal(a.requests.length, 4);
});

test('forced wallet requests resolve to the newest balance when responses arrive backwards', async () => {
  const a = app(); a.authenticate('a');
  const first = a.api.loadCreditWallet(true); await flush(); const old = a.requests.at(-1);
  const second = a.api.loadCreditWallet(true); await flush(); const latest = a.requests.at(-1);
  latest.respond({ credits: credits(250) }); await second;
  old.respond({ credits: credits(100) }); assert.equal((await first).credits.balance, 250);
  assert.equal((await a.api.loadCreditWallet()).credits.balance, 250); assert.equal(a.requests.length, 2);
});

test('an older finally cannot erase a newer in-flight wallet promise', async () => {
  const a = app(); a.authenticate('a');
  const first = a.api.loadCreditWallet(true); await flush(); const old = a.requests.at(-1);
  const second = a.api.loadCreditWallet(true); await flush(); const latest = a.requests.at(-1);
  old.respond({ credits: credits(100) }); await flush();
  const third = a.api.loadCreditWallet(); await flush(); assert.equal(a.requests.length, 2);
  latest.respond({ credits: credits(150) }); assert.deepEqual((await Promise.all([first, second, third])).map(result => result.credits.balance), [150, 150, 150]);
});

test('forced identity requests cannot repaint an older profile or balance', async () => {
  const a = app(); a.authenticate('a');
  const first = a.api.syncIdentity(true, { progress: false }); await flush(); const old = a.requests.at(-1);
  const second = a.api.syncIdentity(true, { progress: false }); await flush(); a.requests.at(-1).respond(identity('a', 'Nombre confirmado', 125)); await second;
  old.respond(identity('a', 'Nombre anterior', 100)); await first;
  assert.equal(a.window.UserState.nombre, 'Nombre confirmado'); assert.equal(a.window.UserState.credits.balance, 125);
  assert.equal(a.events.filter(event => event.type === 'icadem:identity-ready').length, 1);
});

test('a confirmed conversion/rating snapshot invalidates older identity, progress and wallet reads', async () => {
  const a = app(); a.authenticate('a');
  const profile = a.api.syncIdentity(true, { progress: false }); const progress = a.api.loadLearningProgress(); const wallet = a.api.loadCreditWallet(true);
  await flush(); const before = [...a.requests];
  a.api.syncCreditSnapshot(credits(175), { source: 'course-rating', uid: 'a' });
  before.find(item => item.path === '/api/identity/sync').respond(identity('a', 'Alice', 100));
  before.find(item => item.path === '/api/learning/progress').respond({ courses: { course: { courseCompleted: true } }, credits: credits(100) });
  before.find(item => item.path === '/api/credits/wallet').respond({ credits: credits(100) });
  await Promise.all([profile, progress]); await flush();
  assert.equal(a.window.UserState.credits.balance, 175); assert.equal(a.requests.length, 4);
  a.requests.at(-1).respond({ credits: credits(175), recentMovements: [{ type: 'course-rating', amount: 25 }] });
  assert.equal((await wallet).credits.balance, 175); assert.equal(a.window.UserState.credits.lifetimeEarned, 185);
});

test('removing and returning to the same UID invalidates its old request generation', async () => {
  const a = app(); a.authenticate('a');
  const pending = a.api.loadCreditWallet(true); await flush(); const old = a.requests.at(-1);
  const rejected = assert.rejects(pending, { code: 'session-ended' });
  a.window.__sessionEnding = true; a.emit('icadem:session-ending');
  a.authenticate('a', true); await flush();
  old.respond({ credits: credits(999) }); await rejected;
  assert.equal(a.window.UserState.credits.balance, 0);
  a.requests.find(item => item !== old).respond(identity('a', 'Alice', 50)); await flush();
  a.requests.find(item => item.path === '/api/learning/progress').respond({ courses: {}, credits: credits(50) }); await flush();
  assert.equal(a.window.UserState.credits.balance, 50);
});

test('a wallet closes on session-ending and its late response cannot restore private content', async () => {
  const a = app(); a.authenticate('a'); const pending = a.api.openCreditWallet(); await flush();
  const modal = a.document.querySelector('.credit-wallet-modal'); assert.ok(modal);
  a.window.__sessionEnding = true; a.emit('icadem:session-ending');
  assert.equal(a.document.querySelector('.credit-wallet-modal'), null); assert.equal(a.document.body.classList.contains('has-credit-wallet'), false);
  a.requests.at(-1).respond({ credits: credits(999), recentMovements: [{ id: 'private' }] }); await pending;
  assert.equal(modal.isConnected, false); assert.ok(!modal.body?.innerHTML.includes('private'));
});

test('two independent sessions refresh confirmed balance and completed lessons on immediate visibility/online return', async () => {
  const state = { balance: 100, courses: { course: { completedLessons: [1] } } };
  const server = item => item.path === '/api/identity/sync' ? identity(item.uid, 'Alice', state.balance) : item.path === '/api/learning/progress' ? { courses: state.courses, credits: credits(state.balance) } : { credits: credits(state.balance), recentMovements: [] };
  const first = app(server), second = app(server); first.authenticate('a'); second.authenticate('a');
  await Promise.all([first.api.syncIdentity(true), second.api.syncIdentity(true), first.api.loadCreditWallet(), second.api.loadCreditWallet()]);
  assert.equal(second.window.UserState.credits.balance, 100);
  state.balance = 125; state.courses.course.completedLessons = [1, 2];
  first.api.syncCreditSnapshot(credits(125), { source: 'course-rating' });
  const previous = second.requests.length; second.advance(1000); second.emit('visibilitychange'); second.online(); await flush(); await flush();
  assert.equal(second.requests.length - previous, 3); assert.equal(second.window.UserState.credits.balance, 125);
  assert.deepEqual(second.window.confirmedProgress.course.completedLessons, [1, 2]);
  assert.equal(second.events.filter(event => event.type === 'icadem:identity-ready').length, 1, 'unchanged identity must not rebuild class inputs');
});

test('offline failures preserve confirmed credits and progress; online refresh recovers them', async () => {
  let offline = false, balance = 80;
  const a = app(item => {
    if (offline) throw Error('offline');
    return item.path === '/api/identity/sync' ? identity('a', 'Alice', balance) : item.path === '/api/learning/progress' ? { courses: { course: { completedLessons: [1] } }, credits: credits(balance) } : { credits: credits(balance) };
  }); a.authenticate('a'); await a.api.syncIdentity(true); await a.api.loadCreditWallet();
  offline = true; a.emit('visibilitychange'); await flush(); await flush();
  assert.equal(a.window.UserState.credits.balance, 80); assert.deepEqual(a.window.confirmedProgress.course.completedLessons, [1]);
  a.window.navigator.onLine = false; const count = a.requests.length; a.emit('visibilitychange'); a.online(); await flush(); assert.equal(a.requests.length, count);
  offline = false; balance = 105; a.window.navigator.onLine = true; a.online(); await flush(); await flush(); assert.equal(a.window.UserState.credits.balance, 105);
});

test('visible authenticated polling is bounded to 60 seconds and stops while hidden or logged out', async () => {
  const a = app(item => item.path === '/api/identity/sync' ? identity('a', 'Alice', 10) : item.path === '/api/learning/progress' ? { courses: {}, credits: credits(10) } : { credits: credits(10) });
  a.authenticate('a', true); await flush(); await flush(); assert.equal(a.intervals.size, 1); assert.equal([...a.intervals.values()][0].duration, 60000);
  a.emit('visibilitychange'); await flush(); await flush(); const count = a.requests.length;
  a.advance(59000); a.tick(); await flush(); assert.equal(a.requests.length, count);
  a.advance(1000); a.tick(); await flush(); await flush(); assert.equal(a.requests.length, count + 3);
  a.document.visibilityState = 'hidden'; a.advance(60000); a.tick(); await flush(); assert.equal(a.requests.length, count + 3);
  a.window.__sessionEnding = true; a.emit('icadem:session-ended'); assert.equal(a.intervals.size, 0);
});

test('invalid or wrong-account snapshots cannot reset confirmed balance and partial snapshots preserve lifetime counters', () => {
  const a = app(); a.authenticate('a'); a.api.syncCreditSnapshot(credits(150), { source: 'confirmed' });
  a.api.syncCreditSnapshot({ balance: undefined }); a.api.syncCreditSnapshot({ balance: -10 }); a.api.syncCreditSnapshot(credits(900), { uid: 'b' });
  assert.equal(a.window.UserState.credits.balance, 150);
  a.api.syncCreditSnapshot({ balance: 175 }); assert.equal(a.window.UserState.credits.lifetimeEarned, 160); assert.equal(a.window.UserState.credits.lifetimeSpent, 10);
});

 test('canonical custom photographs win over provider refreshes and synchronize across independent devices',()=>{
  const payload={profile:{uid:'a',displayName:'Alice',photoURL:'https://images.test/custom-v2.jpg',authPhotoURL:'https://googleusercontent.com/provider.jpg',photoSource:'custom',photoVersion:'2026-11-10T19:00:00Z'},directory:{uid:'a',foto:'https://images.test/custom-v2.jpg'},membership:{active:true}};
  for(const device of[app(),app()]){device.authenticate('a');device.window.UserState.authPhotoURL='https://googleusercontent.com/provider-old.jpg';device.api.applyIdentity(payload);
    assert.equal(device.window.UserState.photoURL,payload.profile.photoURL);assert.equal(device.window.UserState.photoSource,'custom');assert.equal(device.window.UserState.photoVersion,payload.profile.photoVersion);
    assert.equal(device.window.UserState.authPhotoURL,payload.profile.authPhotoURL);assert.equal(device.events.at(-1).type,'icadem:identity-ready');
  }
 });

 test('a confirmed empty canonical photo clears old images rather than restoring Google or directory snapshots',()=>{
  const a=app();a.authenticate('a');a.window.UserState.photoURL='https://images.test/old.jpg';a.window.UserState.authPhotoURL='https://googleusercontent.com/provider.jpg';
  a.api.applyIdentity({profile:{uid:'a',displayName:'Alice',photoURL:'',photoSource:'default'},directory:{uid:'a',foto:'https://images.test/stale.jpg'}});
  assert.equal(a.window.UserState.photoURL,'');assert.equal(a.window.UserState.photoSource,'default');
 });

 test('only an explicit Google preference is sent, and the active photo changes after server confirmation',async()=>{
  const a=app();a.authenticate('a');a.window.UserState.photoURL='https://images.test/custom.jpg';a.window.UserState.photoSource='custom';a.window.__auth.currentUser.providerData=[{providerId:'google.com',photoURL:'https://googleusercontent.com/new.jpg'}];
  const automatic=a.api.syncIdentity(true,{progress:false});await flush();assert.equal(a.requests.at(-1).body.photoPreference,undefined);assert.equal(a.window.UserState.photoURL,'https://images.test/custom.jpg');
  a.requests.at(-1).respond({profile:{uid:'a',photoURL:'https://images.test/custom.jpg',photoSource:'custom'}});await automatic;
  const explicit=a.api.syncIdentity(true,{photoPreference:'google',progress:false});await flush();assert.equal(a.requests.at(-1).body.photoPreference,'google');assert.equal(a.window.UserState.photoSource,'custom');
  a.requests.at(-1).respond({profile:{uid:'a',photoURL:'https://googleusercontent.com/new.jpg',photoSource:'google'}});await explicit;
  assert.equal(a.window.UserState.photoURL,'https://googleusercontent.com/new.jpg');assert.equal(a.window.UserState.photoSource,'google');
  const failed=a.api.syncIdentity(true,{photoPreference:'google',progress:false});await flush();a.requests.at(-1).respond({error:'No disponible'},503);await failed;
  assert.equal(a.window.UserState.photoURL,'https://googleusercontent.com/new.jpg');
 });

 test('passive identity refresh cannot supersede an explicit Google choice while its acknowledgement is pending',async()=>{
  const a=app();a.authenticate('a');a.window.UserState.photoURL='https://images.test/custom.jpg';
  const older=a.api.syncIdentity(true,{progress:false});await flush();const old=a.requests.at(-1);
  const selection=a.api.syncIdentity(true,{photoPreference:'google',progress:false});await flush();const selected=a.requests.at(-1);
  const automatic=a.api.syncIdentity(true,{progress:false});await flush();assert.equal(a.requests.length,2);
  selected.respond({profile:{uid:'a',photoURL:'https://googleusercontent.com/confirmed.jpg',photoSource:'google'}});await selection;await automatic;
  old.respond({profile:{uid:'a',photoURL:'https://images.test/custom.jpg',photoSource:'custom'}});await older;
  assert.equal(a.window.UserState.photoURL,'https://googleusercontent.com/confirmed.jpg');assert.equal(a.window.UserState.photoSource,'google');
 });
