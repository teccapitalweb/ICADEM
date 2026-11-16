'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.join(__dirname, '../ciudad/js', file)).href);
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// DOM transport only: production controllers and validation/catalog imports are real.
// These tests do not claim an authenticated server, WebGL render or physical device.
function dom() {
  let document;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.dataset = {}; this.attributes = {}; this.events = {}; this.className = ''; this._text = ''; this.disabled = false; this.open = false; this.scrollTop = 0; this.scrollLeft = 0; this.value = ''; this.style = { values: {}, setProperty(k, v) { this.values[k] = v; } }; this.classList = { contains: n => this.className.split(' ').includes(n), toggle: (n, on) => { const values = new Set(this.className.split(' ').filter(Boolean)); (on === undefined ? !values.has(n) : on) ? values.add(n) : values.delete(n); this.className = [...values].join(' '); } }; }
    set textContent(value) { this._text = value; this.replaceChildren(); }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    replaceChildren(...nodes) { for (const node of this.children) node.parentElement = null; this.children = []; this.append(...nodes); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
    matches(selector) { if (selector.startsWith('.')) return this.classList.contains(selector.slice(1)); if (selector.startsWith('#')) return this.id === selector.slice(1); if (selector === '[data-home-focus]') return this.dataset.homeFocus !== undefined; return this.tagName === selector.toUpperCase(); }
    querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    get isConnected() { return document.body.contains(this); }
    setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
    removeEventListener(name, fn) { this.events[name] = (this.events[name] || []).filter(x => x !== fn); }
    dispatch(name) { for (const fn of this.events[name] || []) fn({ target: this, preventDefault() {}, stopPropagation() {} }); }
    click() { if (!this.disabled) this.dispatch('click'); }
    focus() { document.activeElement = this; }
  }
  document = { createElement: tag => new Element(tag), getElementById(id) { return this.body.querySelector('#' + id); } };
  document.body = new Element('body'); document.activeElement = document.body;
  const game = document.createElement('div'); game.id = 'game'; document.body.append(game);
  global.document = document; global.addEventListener = () => {}; global.removeEventListener = () => {};
  return document;
}
const key = (root, id) => root.querySelectorAll('[data-home-focus]').find(e => e.dataset.homeFocus === id);
async function homeFixture() {
  const doc = dom(), THREE = await load('three.js'), { HomeEditor } = await load('home/home-editor.js'), { DEFAULT_HOME } = await load('home/home-rules.js');
  const inv = {}; DEFAULT_HOME.items.forEach(e => { inv[e.item] = (inv[e.item] || 0) + 1; });
  const state = { home: clone(DEFAULT_HOME), inv, homeRev: 3 }, applied = [], toasts = [], calls = [], inputStates = [];
  const api = { sceneName: 'casa', player: { position: { x: 0, z: 0 } }, engine: { renderer: { domElement: doc.createElement('canvas') }, camera: new THREE.PerspectiveCamera() }, input: { setEnabled: enabled => inputStates.push(enabled) }, camera: { release() {} }, scene: { group: new THREE.Group(), furniture: new THREE.Group(), applyHome: layout => applied.push(clone(layout)) }, ui: { isBlocking: false, toast: text => toasts.push(text), choice: async () => 'keep' }, vivo: { online: true, state, saveHome: async (...args) => { calls.push(args); return { ok: true }; } } };
  const editor = new HomeEditor(api); editor.open(); return { editor, api, doc, state, applied, toasts, calls, inputStates };
}

test('home opens with real validation, inventory groups and accessible keyboard selection; filtering does not rebuild the 3D room', async () => {
  const { editor, applied, state } = await homeFixture();
  assert.match(editor.panel.querySelector('.hed__status').textContent, /11 de 40/);
  assert.equal(editor.panel.querySelector('.hed__status').getAttribute('role'), 'status');
  assert.equal(editor.panel.querySelector('.hed__placed').children.length, state.home.items.length + 1);
  const before = applied.length; key(editor.panel, 'category-Mascotas').click();
  assert.equal(applied.length, before); assert.equal(key(editor.panel, 'category-Mascotas').getAttribute('aria-pressed'), 'true');
  assert(editor.panel.querySelector('.hed__shelf').children.every(e => /mascota|comedero|bebedero/.test(e.dataset.homeFocus)));
  let disposed = 0; editor.ring.geometry.addEventListener('dispose', () => { disposed++; }); editor.ring.material.addEventListener('dispose', () => { disposed++; }); editor.close(); assert.equal(disposed, 2);
});

test('moving retains focus/scroll, invalid previews cannot save, cancel restores confirmed home', async () => {
  const { editor, doc, applied, state } = await homeFixture();
  const initial = clone(state.home); editor.sel = 1; editor.move(0, 0);
  editor.panel.querySelector('.hed__body').scrollTop = 48; key(editor.panel, 'right').focus(); key(editor.panel, 'right').click();
  assert.equal(doc.activeElement.dataset.homeFocus, 'right'); assert.equal(editor.panel.querySelector('.hed__body').scrollTop, 48);
  editor.move(100, 0); assert.equal(key(editor.panel, 'save').disabled, true); assert.equal(editor.panel.querySelector('.hed__status').classList.contains('is-bad'), true);
  editor.close(true); assert.deepEqual(applied.at(-1), initial); assert.equal(editor.panel, null);
});

test('home saves once with captured revision and announces success only after backend confirmation', async () => {
  const f = await homeFixture(), pending = deferred(); f.api.vivo.saveHome = (...args) => { f.calls.push(args); return pending.promise; };
  const save = f.editor.save(); await f.editor.save();
  assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0][1], { expectedHomeRevision: 3 }); assert.equal(f.toasts.length, 0);
  assert.equal(f.editor.panel.getAttribute('aria-busy'), 'true'); assert.equal(key(f.editor.panel, 'cancel').disabled, true);
  pending.resolve({ ok: true }); await save; assert.equal(f.editor.active, false); assert.equal(f.toasts.length, 1);
});

test('save errors preserve draft; conflicts require explicit discard before loading the latest home', async () => {
  const f = await homeFixture(); f.editor.setWall('menta'); const draft = clone(f.editor.draft);
  f.api.vivo.saveHome = async () => ({ ok: false, message: 'Sin conexión' }); await f.editor.save();
  assert.deepEqual(f.editor.draft, draft); assert.equal(f.editor.active, true); assert.equal(f.toasts.length, 0);
  f.state.home = { ...clone(f.state.home), wall: 'lavanda' }; f.state.homeRev = 4;
  f.api.vivo.saveHome = async () => ({ ok: false, reason: 'casa-conflicto' }); await f.editor.save();
  assert.deepEqual(f.editor.draft, draft); assert.equal(f.editor.baseHomeRevision, 3); assert.equal(key(f.editor.panel, 'save'), undefined);
  f.api.ui.choice = async () => { f.api.input.setEnabled(true); return 'keep'; }; key(f.editor.panel, 'reload').click(); await tick(); assert.deepEqual(f.editor.draft, draft); assert.equal(f.inputStates.at(-1), false);
  f.api.ui.choice = async () => 'reload'; key(f.editor.panel, 'reload').click(); await tick();
  assert.equal(f.editor.draft.wall, 'lavanda'); assert.equal(f.editor.baseHomeRevision, 4); assert.equal(f.editor.conflicted, false); f.editor.close();
});

test('a late home-save response cannot close a newly opened editor', async () => {
  const f = await homeFixture(), pending = deferred(); f.api.vivo.saveHome = () => pending.promise;
  const save = f.editor.save(); f.editor.close(); f.editor.open(); const panel = f.editor.panel;
  pending.resolve({ ok: true }); await save; assert.equal(f.editor.panel, panel); assert.equal(f.editor.active, true); assert.equal(f.toasts.length, 0); f.editor.close();
});

async function aguasFixture(picks) {
  const doc = dom(), { openAguas } = await load('ui/aguas.js'), { FLAVORS } = await load('economy/catalog.js');
  const calls = [], toasts = [], choices = []; let current;
  const api = { ui: { isBlocking: false, choice: async options => { choices.push(options); return picks.shift(); }, toast: text => toasts.push(text), modal: options => new Promise(resolve => { const modal = doc.createElement('div'); modal.id = 'modal'; const close = doc.createElement('button'); close.id = 'modal-x'; modal.append(close, options.content); doc.body.append(modal); current = { options, close, modal }; close.addEventListener('click', () => { options.onClose?.(); modal.remove(); resolve('x'); }); }) }, vivo: { online: true, coins: 20, drink: async (...args) => { calls.push(args); return { ok: true }; } }, events: { emit() {} }, player: { emote() {} }, pets: { react() {} } };
  return { doc, api, calls, toasts, choices, FLAVORS, openAguas, get current() { return current; } };
}
function recipe(f) { const wrap = f.current.options.content, flavor = f.FLAVORS[0]; for (const id of ['vaso', 'agua', ...flavor.ingredients, 'hielo', 'servir']) wrap.querySelectorAll('button').find(b => b.dataset.ingredient === id).click(); return wrap; }

test('self-preparation sends the real ordered recipe, preserves a failed recipe and never invents a reward', async () => {
  const catalog = await load('economy/catalog.js'), f = await aguasFixture(['self', catalog.FLAVORS[0].id]), pending = deferred(); f.api.vivo.drink = (...args) => { f.calls.push(args); return pending.promise; };
  const opened = f.openAguas(f.api); await tick(); const wrap = recipe(f);
  assert.deepEqual(f.calls[0], [catalog.FLAVORS[0].id, 'self', ['vaso', 'agua', ...catalog.FLAVORS[0].ingredients, 'hielo', 'servir']]);
  assert.equal(wrap.getAttribute('aria-busy'), 'true'); assert.equal(f.toasts.length, 0); assert(wrap.querySelectorAll('button').every(b => b.disabled));
  pending.resolve({ ok: false, message: 'Servidor no disponible' }); await tick();
  assert.equal(wrap.isConnected, true); assert.equal(wrap.querySelector('.aguas__hint').textContent, 'Servidor no disponible'); assert.equal(f.toasts.length, 0); assert.equal(f.calls.length, 1);
  f.api.vivo.drink = async (...args) => { f.calls.push(args); return { ok: true }; };
  wrap.querySelector('.aguas__retry').click(); await opened;
  assert.equal(f.calls.length, 2); assert.deepEqual(f.calls[1], f.calls[0]); assert.equal(wrap.isConnected, false);
});

test('closing a pending recipe prevents its late response from closing another dialog', async () => {
  const catalog = await load('economy/catalog.js'), f = await aguasFixture(['self', catalog.FLAVORS[0].id]), pending = deferred(); f.api.vivo.drink = () => pending.promise;
  const opened = f.openAguas(f.api); await tick(); recipe(f); f.current.close.click(); await opened;
  const other = f.doc.createElement('div'), close = f.doc.createElement('button'); other.id = 'modal'; close.id = 'modal-x'; other.append(close); f.doc.body.append(other); let closed = 0; close.addEventListener('click', () => { closed++; });
  pending.resolve({ ok: true, coins: 2 }); await tick(); assert.equal(closed, 0); assert.equal(f.toasts.length, 0);
});

test('purchased water uses the real price and confirmed buy contract without duplicate submissions', async () => {
  const catalog = await load('economy/catalog.js'), f = await aguasFixture(['buy', catalog.FLAVORS[0].id, 'si']), pending = deferred(); f.api.vivo.drink = (...args) => { f.calls.push(args); return pending.promise; };
  const opened = f.openAguas(f.api); await tick(); await f.openAguas(f.api);
  assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0], [catalog.FLAVORS[0].id, 'buy']); assert.match(f.choices[1].text, new RegExp(String(catalog.DRINK_PRICE))); assert.equal(f.toasts.some(t => /te sirve/.test(t)), false);
  pending.resolve({ ok: true }); await opened; assert.equal(f.toasts.some(t => /te sirve/.test(t)), true);
});

test('a failed purchased water retries only after explicit confirmation with the identical flavor and mode', async () => {
  const catalog = await load('economy/catalog.js'), f = await aguasFixture(['buy', catalog.FLAVORS[0].id, 'si', 'retry']);
  f.api.vivo.drink = async (...args) => { f.calls.push(args); return f.calls.length === 1 ? { ok: false, message: 'Sin respuesta' } : { ok: true }; };
  await f.openAguas(f.api); assert.equal(f.choices.at(-1).options.some(o => o.id === 'retry'), true); assert.equal(f.calls.length, 2); assert.deepEqual(f.calls[1], f.calls[0]);
});

test('closing and reopening the stand recovers self/buy through real VivoService with the original rid and no extra debit or reward', async () => {
  const catalog = await load('economy/catalog.js'), { VivoService } = await load('vivo/vivo-service.js');
  for (const mode of ['self', 'buy']) {
    const picks = mode === 'self' ? ['self', catalog.FLAVORS[0].id] : ['buy', catalog.FLAVORS[0].id, 'si', 'x'], f = await aguasFixture(picks);
    const wire = [], accepted = new Set(); let debits = 0, rewards = 0;
    f.api.store = { state: { vivo: { coins: 20, inv: {}, pets: [] } } };
    f.api.net = { isOnline: true, on() {}, vivo: async (op, payload) => {
      wire.push({ op, payload: clone(payload) });
      if (!accepted.has(payload.rid)) { accepted.add(payload.rid); if (mode === 'buy') debits += catalog.DRINK_PRICE; else rewards += 2; }
      return wire.length === 1 ? { ok: false, reason: 'sin-respuesta' } : { ok: true, coins: mode === 'self' ? 2 : 0 };
    } };
    f.api.vivo = new VivoService(f.api); const first = f.openAguas(f.api); await tick();
    if (mode === 'self') { recipe(f); await tick(); f.current.close.click(); }
    await first; assert.equal(f.api.vivo.pendingTransactions().length, 1);
    picks.push('retry'); await f.openAguas(f.api);
    assert.equal(wire.length, 2); assert.deepEqual(wire[1], wire[0]); assert.equal(f.api.vivo.pendingTransactions().length, 0);
    assert.equal(debits, mode === 'buy' ? catalog.DRINK_PRICE : 0); assert.equal(rewards, mode === 'self' ? 2 : 0);
    assert.equal(accepted.size, 1); assert.match(f.choices.at(-1).text, /Falta confirmar/);
  }
});
