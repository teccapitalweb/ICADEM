'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.join(__dirname, '../ciudad/js', file)).href);

test('passport tabs expose exactly the selected view without altering progression or appearance', async () => {
  // Execute the real method with a DOM transport; browser QA separately measures
  // layout, native keyboard activation, touch targets and focus containment.
  const source = fs.readFileSync(path.join(__dirname, '../ciudad/js/ui/ui.js'), 'utf8');
  const start = source.indexOf("  openPassport(tab = 'resumen')"), end = source.indexOf('  /* ---------- tablero de misiones', start);
  assert(start >= 0 && end > start);
  class Element {
    constructor(tag, cls, text) { this.tag = tag; this.className = cls || ''; this.textContent = text || ''; this.children = []; this.dataset = {}; this.attributes = {}; this.style = { setProperty() {} }; this.events = {}; this.classList = { toggle: (name, on) => { const values = new Set(this.className.split(' ').filter(Boolean)); on ? values.add(name) : values.delete(name); this.className = [...values].join(' '); } }; }
    append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = String(value); } getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(name, fn) { this.events[name] = fn; } click() { this.events.click?.(); }
    querySelectorAll(tag) { return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]); }
  }
  const h = (tag, cls, text) => new Element(tag, cls, text), catalog = await load('characters/catalog.js'), rules = await load('progress/rules.js'), { GAME_LIST } = await load('edu/games.js');
  const state = { ...rules.emptyProfile(), economy: { balance: 0, ledger: [] }, custom: rules.cleanCustom({}) }, before = JSON.stringify(state);
  let modal;
  const ui = { isBlocking: false, api: { store: { state }, playerName: 'Explorador', net: { isOnline: false } }, missionIdOf: () => null, modal: settings => { modal = settings; return Promise.resolve(); } };
  const method = vm.runInNewContext('({' + source.slice(start, end).trim() + '}).openPassport', { h, icon: () => h('svg'), ...catalog, ...rules, GAME_LIST, levelFromXp: () => ({ level: 1, progress: 0, base: 0, next: 80 }), PLACES_ORDER: [], BUILDINGS: [], ACHIEVEMENTS: [] });
  method.call(ui); const tabs = modal.content.children[0].children;
  assert.deepEqual(tabs.map(button => button.dataset.id), ['resumen', 'logros', 'avatar', 'movimientos']);
  for (const selected of tabs) { selected.click(); assert.equal(selected.getAttribute('aria-pressed'), 'true'); assert.equal(tabs.filter(button => button.getAttribute('aria-pressed') === 'true').length, 1); for (const other of tabs.filter(button => button !== selected)) assert.equal(other.getAttribute('aria-pressed'), 'false'); }
  assert.equal(JSON.stringify(state), before);
});
