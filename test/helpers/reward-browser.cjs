'use strict';
const fs = require('node:fs'), vm = require('node:vm');
const base = __dirname + '/../..';
const flush = () => new Promise(resolve => setImmediate(resolve));

function browser(modules = []) {
  const observers = new Set(), timers = new Map(), intervals = new Map(), requests = [], jobs = [], publications = [], storage = new Map();
  let timerId = 0, uuid = 0, releases = 0;
  class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
    removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
    emit(name, detail) { const event = { type: name, target: this, detail, preventDefault() {}, stopPropagation() {} }; return Promise.all([...this.listeners.get(name) || []].map(fn => fn(event))); }
    dispatchEvent(event) { for (const fn of [...this.listeners.get(event.type) || []]) fn(event); }
  }
  function matches(element, selector) {
    if (selector === 'form' || selector === 'textarea' || selector === 'button') return element.tagName.toLowerCase() === selector;
    if (selector.startsWith('#')) return element.id === selector.slice(1);
    if (selector.startsWith('.')) return element.className.split(/\s+/).includes(selector.slice(1));
    const attribute = /^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attribute) { const key = attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return key in element.dataset && (attribute[2] === undefined || element.dataset[key] === attribute[2]); }
    return false;
  }
  class Element extends Events {
    constructor(tag = 'div') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.dataset = {}; this.style = {}; this.className = ''; this.id = ''; this.hidden = false; this.disabled = false; this._html = ''; this._text = ''; this._value = ''; this.valueWrites = 0;
      this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].filter(Boolean).join(' '); }, remove: name => { this.className = this.className.split(/\s+/).filter(value => value !== name).join(' '); }, contains: name => this.className.split(/\s+/).includes(name), toggle: (name, enabled) => enabled ? this.classList.add(name) : this.classList.remove(name) };
    }
    get isConnected() { return this === document.body || this === document.head || !!this.parentNode?.isConnected; }
    set value(value) { this._value = String(value); this.valueWrites++; } get value() { return this._value; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this.replaceChildren(); this._html = String(value);
      // Parse only the existing rating controls, then execute their real handlers.
      if (this._html.includes('<form class="course-rating__form">')) {
        const form = new Element('form'); form.className = 'course-rating__form'; this.append(form);
        for (let rating = 1; rating <= 5; rating++) { const star = new Element('button'); star.dataset.rating = String(rating); form.append(star); }
        const textarea = new Element('textarea'); const text = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(this._html); textarea.value = text?.[1] || ''; form.append(textarea);
        for (const name of ['save', 'state', 'count', 'selection']) { const element = new Element(name === 'save' ? 'button' : 'span'); element.className = 'course-rating__' + name; form.append(element); }
      }
    }
    append(...elements) { elements.forEach(element => this.appendChild(element)); }
    appendChild(element) { element.remove(); element.parentNode = this; this.children.push(element); return element; }
    prepend(element) { element.remove(); element.parentNode = this; this.children.unshift(element); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    replaceChildren(...elements) { this.children.forEach(child => child.parentNode = null); this.children = []; this._html = ''; this._text = ''; this.append(...elements); }
    querySelectorAll(selector) { const selectors = selector.split(',').map(value => value.trim()), found = []; const visit = node => node.children.forEach(child => { if (selectors.some(value => matches(child, value))) found.push(child); visit(child); }); visit(this); return found; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    setAttribute(name, value) { if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
    getAttribute() { return null; } focus() {} getClientRects() { return [1]; }
  }
  const document = new Events(); document.body = new Element('body'); document.body.style = { overflow: 'auto', paddingRight: '' }; document.head = new Element('head'); document.hidden = false; document.documentElement = { clientWidth: 1200 };
  document.querySelectorAll = selector => [...document.body.querySelectorAll(selector), ...document.head.querySelectorAll(selector)]; document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  document.getElementById = id => document.querySelector('#' + id); document.createElement = tag => new Element(tag); document.createTextNode = text => { const node = new Element('text'); node.textContent = text; return node; };
  const location = { hash: '#cursos' }, window = new Events();
  Object.assign(window, { __auth: { currentUser: null }, location, innerWidth: 1200,
    ICADEMExperience: { enqueue: (id, payload) => { jobs.push({ id, payload }); } },
    ICADEMPlatform: { syncCreditSnapshot: (...args) => publications.push(args) },
    ICADEMDialogFocus: { activate() {}, release() { releases++; } }
  });
  class Observer { constructor(fn) { this.fn = fn; } observe() { observers.add(this); } disconnect() { observers.delete(this); } }
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const context = vm.createContext({ window, document, location, Node: Element, HTMLElement: Element, MutationObserver: Observer, getComputedStyle: element => ({ display: element.hidden ? 'none' : 'block' }), localStorage, sessionStorage: localStorage,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout: (fn, duration) => { timers.set(++timerId, { fn, duration }); return timerId; }, clearTimeout: id => timers.delete(id), setInterval: (fn, duration) => { intervals.set(++timerId, { fn, duration }); return timerId; }, clearInterval: id => intervals.delete(id), requestAnimationFrame: fn => fn(), console,
    fetch: (url, options = {}) => new Promise((resolve, reject) => { const request = { path: new URL(url).pathname, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null, done: false,
      respond(data, status = 200) { this.done = true; resolve({ ok: status >= 200 && status < 300, json: async () => JSON.parse(JSON.stringify(data)) }); }, reject(error) { this.done = true; reject(error); } }; requests.push(request); })
  });
  const panel = fs.readFileSync(base + '/vip-panel.html', 'utf8');
  const modal = panel.slice(panel.indexOf('const Modal=(function(){'), panel.indexOf('function openToolPlaceholder'));
  vm.runInContext(modal, context);
  for (const name of modules) vm.runInContext(fs.readFileSync(base + '/js/' + name, 'utf8'), context);
  return { window, document, context, location, jobs, requests, publications, storage, timers, intervals, Element,
    run(code) { return vm.runInContext(code, context); },
    signin(uid = 'a', ready = true) { window.__sessionEnding = false; window.__auth.currentUser = { uid, getIdToken: async () => 'token:' + uid }; if (ready) document.dispatchEvent({ type: 'icadem:user-ready' }); },
    ending() { window.__sessionEnding = true; document.dispatchEvent({ type: 'icadem:session-ending' }); },
    mutation() { for (const observer of [...observers]) observer.fn(); },
    runTimers(duration) { const selected = [...timers].filter(([, timer]) => timer.duration === duration); selected.forEach(([id]) => timers.delete(id)); selected.forEach(([, timer]) => timer.fn()); },
    pending(path, method) { return requests.find(request => !request.done && request.path === path && (!method || request.method === method)); },
    get releases() { return releases; }
  };
}
module.exports = { browser, flush };
