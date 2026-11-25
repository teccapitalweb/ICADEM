'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/../js/icadem-panel-sounds.js', 'utf8');

function fixture(stored = {}) {
  const storage = new Map(Object.entries(stored));
  const gesture = { isTrusted: true };
  const eventTarget = () => {
    const events = new Map();
    return {
      addEventListener(type, fn) { events.set(type, fn); },
      emit(type, event = {}) { events.get(type)?.(event); }
    };
  };
  const engines = [];
  const node = () => ({ connect() {}, disconnect() {} });
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.notes = []; engines.push(this); }
    createGain() { return { ...node(), gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createOscillator() { return { ...node(), frequency: {}, start: time => this.notes.push(time), stop() {} }; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const window = { ...eventTarget(), __auth: { currentUser: { uid: 'one' } }, AudioContext };
  const input = { ...eventTarget(), checked: false };
  const document = { ...eventTarget(), visibilityState: 'visible', focus: true, hasFocus() { return this.focus; }, querySelector: () => input };
  vm.runInNewContext(source, { window, document, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } });
  const audio = window.ICADEMPanelSounds;
  audio.mount(document);
  return { audio, input, document, window, gesture, engines, storage, engine: () => engines.at(-1) };
}

test('panel sounds default to off and require a trusted gesture within the correct account', () => {
  const app = fixture();
  assert.equal(app.input.checked, false);
  app.document.emit('click', app.gesture);
  assert.equal(app.engines.length, 0);
  app.input.checked = true;
  app.input.emit('change', { isTrusted: false });
  assert.equal(app.engines.length, 0);
  app.input.emit('change', app.gesture);
  assert.equal(app.storage.get('icadem:panel-sounds:one'), 'on');
  assert.equal(app.audio.confirmed('credit', 'lesson:first', 'one'), true);
  app.engine().currentTime = 1;
  assert.equal(app.audio.confirmed('credit', 'lesson:first', 'one'), false);
  assert.equal(app.audio.confirmed('comment', 'new-comment', 'one'), true);
  assert.equal(app.audio.confirmed('like', null, 'one'), false, 'bursts are limited');
  app.window.__auth.currentUser = { uid: 'two' };
  assert.equal(app.audio.confirmed('credit', 'stale-response', 'one'), false);
  assert.equal(app.engine().state, 'closed');
  app.audio.mount(app.document);
  assert.equal(app.input.checked, false, 'a different account does not inherit consent');
});

test('inbox sounds ignore backlogs, seen items, repeated arrivals and the background', () => {
  const app = fixture({ 'icadem:panel-sounds:one': 'on' });
  const sound = (kind, time, items) => app.audio.inbox(kind, items, time, 'one');
  assert.equal(app.input.checked, true);
  app.document.emit('click', app.gesture);
  const engine = app.engine();
  const old = { id: 'old', createdAtMs: 1 };
  sound('notification', 10, [old]);
  assert.equal(engine.notes.length, 0);
  const arrival = { id: 'new', createdAtMs: 11 };
  sound('notification', 20, [old, arrival, { id: 'seen', seen: true, createdAtMs: 19 }]);
  assert.equal(engine.notes.length, 2);
  engine.currentTime = 1;
  sound('notification', 30, [old, arrival]);
  app.document.focus = false;
  app.window.emit('blur');
  sound('notification', 40, [{ id: 'hidden', createdAtMs: 38 }]);
  app.document.focus = true;
  sound('notification', 50, [{ id: 'hidden', createdAtMs: 38 }]);
  assert.equal(engine.notes.length, 2);
  sound('credit', 50, [{ id: 'gift-old', createdAtMs: 39 }]);
  assert.equal(engine.notes.length, 2, 'credit gifts have their own silent baseline');
  sound('credit', 60, [{ id: 'gift-new', createdAtMs: 59 }]);
  assert.equal(engine.notes.length, 4);
  app.input.checked = false;
  app.input.emit('change', app.gesture);
  engine.currentTime = 2;
  assert.equal(app.audio.confirmed('connection', null, 'one'), false);
});
