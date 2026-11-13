'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const load = relative => import(pathToFileURL(path.join(__dirname, '..', relative)).href);

test('default timers keep the browser global receiver rather than the save queue receiver', () => {
  const source = fs.readFileSync(path.join(__dirname, '../ciudad/js/progress/appearance-saves.js'), 'utf8').replace('export class AppearanceSaves', 'class AppearanceSaves');
  const result = vm.runInNewContext(`
    const timers = new Map(), sent = []; let sequence = 0;
    globalThis.setTimeout = function(fn, ms) {
      if (this !== globalThis) throw Error('Illegal invocation: setTimeout');
      const id = ++sequence; timers.set(id, fn); return id;
    };
    globalThis.clearTimeout = function(id) {
      if (this !== globalThis) throw Error('Illegal invocation: clearTimeout');
      timers.delete(id);
    };
    ${source}
    const saves = new AppearanceSaves({send: request => { sent.push(request); return true; }, onFailure: () => { throw Error('unexpected failure'); }});
    saves.save('universitaria', {top:'hoodie'});
    saves.receive({op:'avatar',ok:true,n:sent[0].n});
    saves.save('universitaria', {bottom:'flare'});
    saves.clear();
    JSON.stringify({sent:sent.length,timers:timers.size,pending:saves.pending});
  `);
  assert.deepEqual(JSON.parse(result), {sent:2,timers:0,pending:null});
});

// Run the actual main.js avatar functions and registered network handlers without
// creating a renderer. ACK timing is controlled independently from user clicks.
async function client() {
  const { AppearanceSaves } = await load('ciudad/js/progress/appearance-saves.js');
  const rules = await load('ciudad/js/progress/rules.js'), { Store } = await load('ciudad/js/core/store.js');
  const source = fs.readFileSync(path.join(__dirname, '../ciudad/js/main.js'), 'utf8');
  const begin = source.indexOf('  let confirmedAvatar = null;'), end = source.indexOf('  /* misiones:', begin);
  const wire = source.indexOf("    net.on('status', st => { if (st.status !== 'online')"), wireEnd = source.indexOf("    net.on('party'", wire);
  assert(begin > 0 && end > begin && wire > 0 && wireEnd > wire);
  const memory = new Map(), storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const store = new Store(storage), sent = [], toasts = [], handlers = {}, timers = new Map();
  let timerId = 0, mode = 'send', builds = 0;
  const net = {
    isOnline: true, name: 'Prueba',
    profile(op, payload) { if (mode === 'throw') throw Error('socket cerrado'); if (mode === 'fail') return false; sent.push(structuredClone({ op, ...payload })); return true; },
    on(event, handler) { handlers[event] = handler; }
  };
  const api = { ui: { toast: value => toasts.push(value), refreshHud() {} }, missions: {} };
  class TimedSaves extends AppearanceSaves {
    constructor(options) { super({ ...options, setTimer: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimer: id => timers.delete(id) }); }
  }
  const functions = new Function('AppearanceSaves', 'cleanCustom', 'isAvatarUnlocked', 'store', 'net', 'api', 'rebuildAvatar',
    source.slice(begin, end) + source.slice(wire, wireEnd) + 'return {setAvatar,applyProfile};'
  )(TimedSaves, rules.cleanCustom, rules.isAvatarUnlocked, store, net, api, () => builds++);
  const profile = (custom = {}, changes = {}) => ({ ...rules.emptyProfile(), avatarId: 'universitaria', avatarChosen: true, custom: rules.cleanCustom(custom), ...changes });
  const emit = message => handlers.profile(message);
  const status = value => { net.isOnline = value === 'online'; handlers.status({ status: value }); };
  functions.applyProfile(profile());
  return { ...functions, store, sent, toasts, timers, profile, emit, status, net,
    choose: custom => functions.setAvatar(store.state.avatarId, { ...store.state.custom, ...custom }),
    ack: (request, changes = {}) => emit({ op: 'avatar', n: request.n, ok: true, profile: profile(request.custom), ...changes }),
    expire: () => { for (const fn of [...timers.values()]) fn(); }, mode: value => { mode = value; },
    reload: () => new Store(storage).state, builds: () => builds
  };
}

test('main keeps the newest outfit through interleaved ACKs while applying authoritative progress', async () => {
  const c = await client();
  c.choose({ top: 'hoodie' }); const a = c.sent[0];
  c.choose({ bottom: 'flare' });
  assert.equal(c.sent.length, 1, 'only one cosmetic request is in flight');
  c.ack(a);
  assert.equal(c.sent.length, 2); const b = c.sent[1];
  assert.equal(c.store.state.custom.bottom, 'flare', 'ACK A does not replace the later local choice');
  c.emit({ op: 'mission', ok: true, profile: c.profile(a.custom, { xp: 40, testCredits: 25, visited: ['banco'] }) });
  assert.equal(c.store.state.xp, 40); assert.equal(c.store.state.economy.balance, 25); assert.deepEqual(c.store.state.visited, ['banco']);
  assert.equal(c.store.state.custom.bottom, 'flare', 'unrelated profile responses preserve the pending outfit');
  c.choose({ hairColor: 'rosa' }); c.choose({ necklace: 'heart' });
  assert.equal(c.sent.length, 2, 'rapid subsequent changes coalesce into the latest snapshot');
  c.ack(b); const last = c.sent[2];
  assert.equal(last.custom.top, 'hoodie'); assert.equal(last.custom.bottom, 'flare'); assert.equal(last.custom.hairColor, 'rosa'); assert.equal(last.custom.necklace, 'heart');
  c.ack(last, { profile: c.profile(last.custom, { xp: 40, testCredits: 25 }) });
  assert.deepEqual(c.store.state.custom, last.custom); assert.deepEqual(c.reload().custom, last.custom); assert.equal(c.timers.size, 0);
  for (const request of c.sent) { assert.equal(request.customVersion, 2); assert(Number.isInteger(request.n)); }
  assert(new Set(c.sent.map(request => request.n)).size === c.sent.length);
  c.ack(a);
  assert.deepEqual(c.store.state.custom, last.custom, 'a late duplicate ACK cannot restore an earlier appearance');
});

test('a server rejection drops queued cosmetics, rolls back and retains avatar restrictions', async () => {
  const c = await client();
  assert.equal(c.setAvatar('leyenda', { top: 'hoodie' }), false); assert.equal(c.sent.length, 0);
  c.choose({ top: 'hoodie' }); const first = c.sent[0]; c.choose({ bottom: 'skirt' });
  c.ack(first, { ok: false, reason: 'avatar-bloqueado', profile: c.profile({ hat: 'cap' }, { xp: 10 }) });
  assert.equal(c.sent.length, 1, 'a rejected save never sends its queued successor'); assert.equal(c.timers.size, 0);
  assert.deepEqual(c.store.state.custom, c.profile({ hat: 'cap' }).custom); assert.equal(c.store.state.xp, 10);
  assert(c.toasts.includes('El servidor no autorizó ese avatar.'));
  c.choose({ bag: 'handbag' }); assert.equal(c.sent.length, 2, 'the next valid choice can save normally'); c.ack(c.sent[1]);
});

test('disconnect discards pending saves and reconnect accepts the server without replaying stale cosmetics', async () => {
  const c = await client(); c.choose({ top: 'hoodie' }); const old = c.sent[0]; c.choose({ bottom: 'flare' });
  c.status('reconnecting'); assert.equal(c.timers.size, 0);
  c.emit({ op: 'get', ok: true, profile: c.profile({ bag: 'tote' }, { xp: 80 }) }); c.status('online');
  assert.deepEqual(c.store.state.custom, c.profile({ bag: 'tote' }).custom); assert.equal(c.store.state.xp, 80); assert.equal(c.sent.length, 1);
  c.choose({ shoes: 'boots' }); const fresh = c.sent[1];
  c.ack(old); assert.equal(c.store.state.custom.shoes, 'boots'); assert.equal(c.sent.length, 2, 'old socket ACK cannot advance the fresh queue');
  c.ack(fresh); assert.equal(c.store.state.custom.bag, 'tote'); assert.equal(c.store.state.custom.shoes, 'boots');
});

test('a missing ACK or socket send failure releases the queue and restores the last confirmed appearance only', async () => {
  const c = await client();
  c.emit({ op: 'get', ok: true, profile: c.profile({ hat: 'beret' }, { xp: 40, testCredits: 50 }) });
  c.choose({ top: 'cropTop' }); const old = c.sent[0]; c.choose({ bottom: 'flare' });
  c.expire(); assert.equal(c.timers.size, 0); assert.deepEqual(c.store.state.custom, c.profile({ hat: 'beret' }).custom);
  assert.equal(c.store.state.xp, 40); assert.equal(c.store.state.economy.balance, 50); assert.equal(c.sent[1].op, 'get'); assert.equal(c.toasts.length, 1);
  c.expire(); assert.equal(c.toasts.length, 1, 'an expired request does not repeatedly report failure');
  c.ack(old); assert.deepEqual(c.store.state.custom, c.profile({ hat: 'beret' }).custom);
  c.choose({ bag: 'handbag' }); c.ack(c.sent[2]); assert.equal(c.store.state.custom.bag, 'handbag');
  for (const mode of ['fail', 'throw']) { c.mode(mode); c.choose({ necklace: 'pearls' }); assert.equal(c.timers.size, 0); assert.equal(c.store.state.custom.necklace, undefined); }
});

test('returning to the in-flight appearance avoids a duplicate save and offline changes remain local', async () => {
  const c = await client(); c.choose({ top: 'hoodie' }); const first = c.sent[0];
  c.choose({ bottom: 'flare' }); c.choose({ bottom: 'base' }); c.ack(first);
  assert.equal(c.sent.length, 1); assert.deepEqual(c.store.state.custom, first.custom); assert.equal(c.timers.size, 0);
  c.status('closed'); c.choose({ hairStyle: 'bob' }); assert.equal(c.sent.length, 1); assert.equal(c.reload().custom.hairStyle, 'bob');
});
