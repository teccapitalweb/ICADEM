'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const load = name => import(pathToFileURL(path.join(__dirname, '../ciudad/js', name)).href);
const copy = value => JSON.parse(JSON.stringify(value));

// A DOM transport for the real wardrobe module. It exercises the actual event
// handlers; browser layout and real 3D pixels are checked in separate browser QA.
async function studio(options = {}, initial = {}) {
  const rules = await load('progress/rules.js'), catalog = await load('characters/catalog.js');
  const frames = [], intervals = new Map(), timers = new Map(), handlers = new Map(), sent = [], previews = [], toasts = [];
  let timerId = 0, modal = null;
  const document = { activeElement: null };
  const datasetKey = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = {}; this.listeners = new Map(); this._text = ''; this._value = ''; this.disabled = false; this.open = false;
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        toggle: (name, on) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); if (on ?? !set.has(name)) set.add(name); else set.delete(name); this.className = [...set].join(' '); return set.has(name); },
        add: (...names) => names.forEach(name => this.classList.toggle(name, true)), remove: (...names) => names.forEach(name => this.classList.toggle(name, false))
      };
    }
    get className() { return this.attributes.class || ''; } set className(value) { this.attributes.class = String(value); }
    get isConnected() { return this === document.body || Boolean(this.parentNode?.isConnected); }
    get parentElement() { return this.parentNode; }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
    prepend(...nodes) { for (const node of [...nodes].reverse()) { node.remove(); node.parentNode = this; this.children.unshift(node); } }
    insertBefore(node, before) { node.remove(); node.parentNode = this; const at = this.children.indexOf(before); this.children.splice(at < 0 ? this.children.length : at, 0, node); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
    replaceChildren(...nodes) { for (const node of this.children) node.parentNode = null; this.children = []; this._text = ''; this.append(...nodes); }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); } set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get value() { return this._value || (this.tagName === 'select' ? this.children[0]?.value || '' : ''); } set value(value) { this._value = String(value); }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith('data-')) this.dataset[datasetKey(name)] = String(value); }
    getAttribute(name) { return name.startsWith('data-') ? this.dataset[datasetKey(name)] ?? null : this.attributes[name] ?? null; }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
    focus() { document.activeElement = this; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }
    scrollIntoView() { this.scrollCalls = (this.scrollCalls || 0) + 1; }
    matches(selector) {
      const attr = /\[([^=\]]+)(?:="([^"]*)")?\]/.exec(selector);
      if (attr && (this.getAttribute(attr[1]) === null || attr[2] !== undefined && this.getAttribute(attr[1]) !== attr[2])) return false;
      const base = selector.replace(/\[[^\]]+\]/g, '');
      const tag = /^[a-z][\w-]*/.exec(base)?.[0]; if (tag && this.tagName !== tag) return false;
      return [...base.matchAll(/\.([\w-]+)/g)].every(m => this.classList.contains(m[1])) && (!base.startsWith('#') || this.id === base.slice(1));
    }
    querySelectorAll(selector) {
      const result = [], branches = selector.split(',').map(s => s.trim().split(/\s+/));
      const matches = (node, parts) => { if (!node.matches(parts.at(-1))) return false; let ancestor = node.parentNode; for (let i = parts.length - 2; i >= 0; i--) { while (ancestor && !ancestor.matches(parts[i])) ancestor = ancestor.parentNode; if (!ancestor) return false; ancestor = ancestor.parentNode; } return true; };
      const visit = node => { for (const child of node.children) { if (branches.some(parts => matches(child, parts))) result.push(child); visit(child); } }; visit(this); return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    emit(name) { for (const fn of this.listeners.get(name) || []) fn({ target: this, preventDefault() {} }); }
    click() { if (!this.disabled) this.emit('click'); }
  }
  document.body = new Element('body');
  document.createElement = tag => new Element(tag); document.createElementNS = (_, tag) => new Element(tag);
  const foot = new Element('footer'), closeButton = new Element('button'); foot.id = 'modal-actions'; closeButton.id = 'modal-x'; document.body.append(foot, closeButton);
  document.getElementById = id => document.body.querySelector('#' + id);
  class AvatarPreview {
    constructor() { this.canvas = new Element('canvas'); this.scene = { background: { setHex() {} } }; this.camera = { position: { set() {} }, lookAt() {} }; previews.push(this); }
    show(look) { this.look = copy(look); } start() {} stop() { this.stopped = true; } still() { return 'data:image/png;base64,transport'; }
  }
  const state = { ...rules.emptyProfile(), avatarId: 'universitaria', avatarChosen: true, synced: true, economy: { balance: 100 }, ...initial };
  state.custom = rules.cleanCustom(initial.custom);
  const net = { isOnline: true, on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); return () => handlers.get(name).delete(fn); } };
  const api = { store: { state }, engine: { renderer: {} }, net, setAvatar(id, custom) { sent.push({ id, custom: copy(custom) }); state.avatarId = id; state.custom = rules.cleanCustom(custom); state.avatarChosen = true; return true; } };
  const ui = {
    api, isBlocking: false, toast: text => toasts.push(text),
    modal(settings) { let resolve; const result = new Promise(r => resolve = r); document.body.append(settings.content); foot.replaceChildren(); modal = { settings, close(id = 'close') { settings.onClose?.(); settings.content.remove(); foot.replaceChildren(); resolve(id); } };
      for (const action of settings.actions || [{ id: 'ok', label: 'Cerrar' }]) { const b = new Element('button'); b.dataset.action = action.id; b.textContent = action.label; b.disabled = Boolean(action.disabled); b.addEventListener('click', () => { action.onClick?.(); if (action.close !== false) modal.close(action.id); }); foot.append(b); }
      return result;
    }
  };
  closeButton.addEventListener('click', () => modal?.close('x'));
  const source = fs.readFileSync(path.join(__dirname, '../ciudad/js/ui/wardrobe.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function openWardrobe', 'function openWardrobe');
  const context = vm.createContext({ ...rules, ...catalog, AvatarPreview, document, requestAnimationFrame: fn => { frames.push(fn); }, setInterval: fn => { const id = ++timerId; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id), setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(source + '\nglobalThis.openWardrobe = openWardrobe;', context);
  const result = context.openWardrobe(ui, options);
  const flush = () => { let n = 0; while (frames.length && n++ < 400) frames.shift()(); assert(n < 400, 'finite thumbnail work'); };
  flush();
  const find = selector => document.body.querySelector(selector), click = selector => { const node = find(selector); assert(node, 'exists: ' + selector); node.click(); flush(); return node; };
  const emit = message => { for (const fn of [...handlers.get('profile') || []]) fn(message); flush(); };
  return { state, before: copy(state), sent, previews, toasts, document, net, result, find, click, flush, handlers, emit,
    select(selector, value, event = 'change') { const node = find(selector); assert(node); node.value = value; node.emit(event); flush(); return node; },
    ack(extra = {}) { const request = sent.at(-1); assert(request); emit({ op: 'avatar', ok: true, n: sent.length, profile: { avatarId: request.id, custom: request.custom }, ...extra }); },
    remote(id, custom) { state.avatarId = id; state.custom = rules.cleanCustom(custom); state.avatarChosen = true; emit({ op: 'get', ok: true, profile: { avatarId: id, custom: state.custom } }); },
    close: id => modal.close(id), tick: () => { for (const fn of [...intervals.values()]) fn(); }, intervals, timers,
    expire: () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); } }
  };
}

test('cosmetics stay in a local multi-piece preview until explicit Equipar and closing discards the preview', async () => {
  const a = await studio({ tab: 'ropa' }), original = copy(a.state);
  a.click('[data-top="hoodie"]'); a.click('[data-fashion-group="bottom"]'); a.click('[data-bottom="flare"]');
  a.click('.vest__tabs [data-id="accesorios"]'); a.click('[data-fashion-group="bag"]'); a.click('[data-bag="handbag"]');
  assert.deepEqual(a.state, original); assert.equal(a.sent.length, 0);
  assert.equal(a.previews[0].look.topStyle, 'hoodie'); assert.equal(a.previews[0].look.bottomStyle, 'flare'); assert.equal(a.previews[0].look.bagStyle, 'handbag');
  assert.equal(a.find('[data-action="equip"]').disabled, false);
  a.close(); await a.result;
  assert.deepEqual(a.state, original); assert(a.previews.every(p => p.stopped)); assert([...a.handlers.values()].every(s => s.size === 0));
});

test('Equipar uses the existing avatar API once, shows confirmation pending, and keeps the modal open', async () => {
  const a = await studio({ tab: 'ropa' }); a.click('[data-top="hoodie"]'); a.click('[data-fashion-group="bottom"]'); a.click('[data-bottom="cargo"]');
  assert.match(a.find('[data-bottom="cargo"]').getAttribute('aria-label'), /en prueba/); assert.equal(a.find('.vest__status').getAttribute('role'), 'status');
  a.click('[data-action="equip"]'); assert.equal(a.sent.length, 1); assert.equal(a.sent[0].custom.top, 'hoodie'); assert.equal(a.sent[0].custom.bottom, 'cargo');
  assert(a.find('.vest--catalog')); assert.match(a.find('.vest__status').textContent, /Confirmando/); assert.doesNotMatch(a.find('.vest__status').textContent, /confirmada/);
  assert.equal(a.find('[data-action="equip"]').disabled, true); a.click('[data-action="equip"]'); assert.equal(a.sent.length, 1);
  assert.equal(a.find('[data-action="equip"]').getAttribute('aria-busy'), 'true'); assert.doesNotMatch(a.find('[data-bottom="cargo"]').getAttribute('aria-label'), /equipado/);
  a.ack(); assert.match(a.find('.vest__status').textContent, /Apariencia confirmada/); assert.doesNotMatch(a.find('.vest__status').textContent, /Confirmando/);
  assert.equal(a.find('[data-action="equip"]').getAttribute('aria-busy'), 'false'); assert.match(a.find('[data-bottom="cargo"]').getAttribute('aria-label'), /equipado/);
  assert.equal(a.find('[data-bottom="cargo"]').classList.contains('is-equipped'), true); a.close(); await a.result;
});

test('character equipped badges also wait for confirmation rather than reflecting the optimistic Store write', async () => {
  const a = await studio(); a.click('.vcard[data-id="exploradora"]'); a.click('[data-action="equip"]');
  assert.equal(a.find('.vcard[data-id="universitaria"]').classList.contains('is-worn'), true); assert.equal(a.find('.vcard[data-id="exploradora"]').classList.contains('is-worn'), false);
  a.ack(); assert.equal(a.find('.vcard[data-id="exploradora"]').classList.contains('is-worn'), true); a.close(); await a.result;
});

test('real catalog filters narrow type, visible color, search and equipped state without changing any appearance', async () => {
  const a = await studio({ tab: 'ropa' }), original = copy(a.state);
  assert.equal(a.find('.vest__top-options').children.length, 12);   // 6 de Codex + 6 de la colección Mundo vivo
  assert.equal(a.find('.vest__top-options').children[0].dataset.top, 'tee', 'real pieces precede reset controls on mobile');
  a.select('[data-wardrobe-filter="type"]', 'sudaderas'); assert.deepEqual(a.find('.vest__top-options').children.map(n => n.dataset.top), ['hoodie']);
  a.select('[data-wardrobe-filter="type"]', '');
  const search = a.select('.vest__catalog-search input', 'denim', 'input'); assert.equal(a.find('.vest__catalog-search input'), search, 'typing preserves the focused input node'); assert.deepEqual(a.find('.vest__top-options').children.map(n => n.dataset.top), ['denimJacket']);
  a.select('.vest__catalog-search input', '', 'input'); a.select('[data-wardrobe-filter="color"]', String(0xd888af)); assert.deepEqual(a.find('.vest__top-options').children.map(n => n.dataset.top), ['cropTop']);
  a.select('[data-wardrobe-filter="color"]', ''); a.select('[data-wardrobe-filter="state"]', 'equipped'); assert.deepEqual(a.find('.vest__top-options').children.map(n => n.dataset.top), ['base']);
  assert.deepEqual(a.state, original); assert.equal(a.sent.length, 0); a.close(); await a.result;
});

test('catalog filters never fabricate unsupported categories, locks, prices or new items', async () => {
  const a = await studio({ tab: 'cabello' });
  a.select('[data-wardrobe-filter="type"]', 'pelucas'); assert.deepEqual(a.find('.vest__hairStyle-options').children.map(n => n.dataset.hairStyle), ['bob']);
  const typeNames = a.find('[data-wardrobe-filter="type"]').children.map(n => n.textContent);
  assert.deepEqual(typeNames, ['Todos', 'Peinados', 'Pelucas']);
  assert(!a.find('[data-wardrobe-filter="style"]')); assert.doesNotMatch(a.find('.vest__style').textContent, /Comprar|Desbloquear|Nuevo|Montura|Vestidos|Shorts|Capris/);
  a.close(); await a.result;
});

test('discarding the trial returns to equipped pieces and a late initial profile cannot be overwritten', async () => {
  const a = await studio({ tab: 'ropa' }); a.click('[data-top="cropTop"]'); a.click('[data-discard-trial]');
  assert.equal(a.previews[0].look.topStyle, undefined); assert.equal(a.find('[data-action="equip"]').disabled, true); assert.equal(a.sent.length, 0); a.close(); await a.result;
  const first = await studio({ first: true }, { avatarChosen: false, avatarId: 'explorador' });
  first.click('.vest__tabs [data-id="ropa"]'); first.click('[data-top="hoodie"]'); assert.equal(first.state.custom.top, undefined, 'initial styling is also a preview');
  first.remote('universitaria', { bottom: 'skirt', hairColor: 'rosa' }); first.tick(); await first.result;
  assert.equal(first.sent.length, 0); assert.equal(first.state.avatarId, 'universitaria'); assert.equal(first.state.custom.bottom, 'skirt'); assert.equal(first.intervals.size, 0);
});

test('a server profile refresh preserves an unsent outfit trial and blocked characters stay un-equippable', async () => {
  const a = await studio({ tab: 'ropa' }); a.click('[data-top="hoodie"]'); a.remote('universitaria', { bottom: 'skirt' });
  assert.equal(a.previews[0].look.topStyle, 'hoodie'); assert.equal(a.sent.length, 0, 'receiving a profile never sends the draft');
  a.click('.vest__tabs [data-id="personajes"]');
  const rules = await load('progress/rules.js'), { AVATARS } = await load('characters/catalog.js');
  const locked = AVATARS.find(avatar => !rules.isAvatarUnlocked(avatar.id, a.state)); assert(locked);
  const category = locked.category;
  // Choose its actual category by its catalog text, then the locked avatar itself.
  const button = a.find('.vest__cats').children.find(n => n.textContent.startsWith(category === 'profesion' ? 'Profesiones' : 'Especiales')); button.click(); a.flush();
  a.click('.vcard[data-id="' + locked.id + '"]'); assert.equal(a.find('[data-action="equip"]').disabled, true); assert.equal(a.sent.length, 0);
  a.click('.vest__tabs [data-id="ropa"]'); a.click('[data-top="tee"]'); assert.equal(a.find('[data-action="equip"]').disabled, false, 'clothing returns to the actual unlocked avatar after viewing a locked skin'); a.click('[data-action="equip"]'); assert.equal(a.sent[0].id, 'universitaria');
  a.close(); await a.result;
});

test('server rejection keeps the attempted preview for adjustment and replayed old ACKs cannot replace a confirmed look', async () => {
  const a = await studio({ tab: 'ropa' }); a.click('[data-top="hoodie"]'); a.click('[data-action="equip"]');
  a.state.custom = { outfit: 'base', hat: 'base', tone: 'base' };
  a.emit({ op: 'avatar', ok: false, n: 1, profile: { avatarId: 'universitaria', custom: a.state.custom } });
  assert.equal(a.previews[0].look.topStyle, 'hoodie'); assert.match(a.find('.vest__status').textContent, /no autorizado/); assert.equal(a.find('[data-action="equip"]').disabled, false);
  a.click('[data-action="equip"]'); a.ack(); assert.match(a.find('.vest__status').textContent, /confirmada/);
  a.emit({ op: 'avatar', ok: true, n: 1, profile: { avatarId: 'universitaria', custom: {} } });
  assert.equal(a.previews[0].look.topStyle, 'hoodie'); assert.equal(a.find('[data-top="hoodie"]').classList.contains('is-equipped'), true);
  a.close(); await a.result;
});

test('authoritative recovery after an unconfirmed save leaves a retryable preview rather than a permanent saving label', async () => {
  const a = await studio({ tab: 'ropa' }); a.click('[data-top="hoodie"]'); a.click('[data-action="equip"]');
  a.state.custom = { outfit: 'base', hat: 'base', tone: 'base' };
  a.emit({ op: 'get', ok: true, profile: { avatarId: 'universitaria', custom: a.state.custom } });
  assert.equal(a.previews[0].look.topStyle, 'hoodie'); assert.match(a.find('.vest__status').textContent, /Sin confirmación/); assert.doesNotMatch(a.find('.vest__status').textContent, /Confirmando/); assert.equal(a.find('[data-action="equip"]').disabled, false);
  a.close(); await a.result;
});

test('a completely lost response has bounded presentation and the timer does not mutate Store or survive closing', async () => {
  const a = await studio({ tab: 'ropa' }); a.click('[data-top="hoodie"]'); a.click('[data-action="equip"]');
  const stored = copy(a.state); assert.equal(a.timers.size, 1); assert.equal([...a.timers.values()][0].ms, 12500);
  a.expire(); assert.deepEqual(a.state, stored); assert.equal(a.sent.length, 1, 'presentation timer never retries a write'); assert.match(a.find('.vest__status').textContent, /Sin confirmación/); assert.doesNotMatch(a.find('.vest__status').textContent, /Confirmando/);
  a.click('[data-top="tee"]'); a.click('[data-action="equip"]'); assert.equal(a.timers.size, 1); a.close(); await a.result; assert.equal(a.timers.size, 0);
});

test('profile refreshes preserve the active catalog control, search cursor and keyboard category focus', async () => {
  const a = await studio({ tab: 'ropa' });
  const input = a.select('.vest__catalog-search input', 'denim', 'input'); input.focus(); input.setSelectionRange(2, 4, 'forward');
  a.remote('universitaria', { bottom: 'skirt' });
  let focused = a.document.activeElement;
  assert.equal(focused, a.find('.vest__catalog-search input')); assert.equal(focused.value, 'denim'); assert.equal(focused.selectionStart, 2); assert.equal(focused.selectionEnd, 4);
  const filter = a.find('[data-wardrobe-filter="state"]'); filter.focus(); a.remote('universitaria', { bottom: 'skirt', hairColor: 'rosa' });
  assert.equal(a.document.activeElement, a.find('[data-wardrobe-filter="state"]'));
  const detail = a.find('.vest__filters'); detail.open = true; detail.emit('toggle'); a.flush(); assert.equal(a.find('.vest__filter-fields').scrollCalls, 1, 'opening brings the panel into view');
  a.remote('universitaria', { bottom: 'skirt' }); a.find('.vest__filters').emit('toggle'); a.flush(); assert.equal(a.find('.vest__filter-fields').scrollCalls, undefined, 'repainting an open filter does not move the page');
  a.select('.vest__catalog-search input', 'noexiste', 'input'); a.find('.vest__clear-filters').focus(); a.remote('universitaria', { bottom: 'skirt' });
  assert.equal(a.document.activeElement, a.find('.vest__clear-filters'), 'empty-result recovery keeps its focused reset control');
  a.click('.vest__tabs [data-id="personajes"]');
  const category = a.find('.vest__cats').children[1]; category.focus(); category.click(); a.flush();
  assert.equal(a.document.activeElement, a.find('.vest__cats').children[1]);
  a.close(); await a.result;
});
