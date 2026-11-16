// Ciudad ICADEM 2.0 · editor FUNCIONAL de «Mi casa» (Codex diseña la versión visual definitiva).
//
// Trabaja sobre un borrador: colocar, mover, girar y quitar muebles, y cambiar paredes y piso. Cada
// cambio se valida con las mismas reglas del servidor (checkLayout) y se ve en la sala al momento.
// «Guardar» lo envía a la cuenta; «Cancelar» devuelve la casa a como estaba.
import * as THREE from '../three.js';
import { HOME, WALL_COLORS, FLOORS, HOME_REASONS, checkLayout, wallSnap } from './home-rules.js';
import { ITEMS, itemById } from '../economy/catalog.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const btn = (label, cls, fn, title) => { const b = h('button', 'btn ' + (cls || ''), label); b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); } b.addEventListener('click', fn); return b; };
const STEP = 0.25;
const furnitureGroup = it => it.layer === 'rug' ? 'Alfombras' : it.layer === 'pet' ? 'Mascotas' : it.light ? 'Iluminación' : /^cama-/.test(it.id) ? 'Camas' : /^(sillon|sofa)$/.test(it.id) ? 'Sillones' : /^(mesa-centro|comedor|silla|escritorio)$/.test(it.id) ? 'Mesas y sillas' : /^(planta-|cactus)/.test(it.id) ? 'Plantas' : 'Decoración';

export class HomeEditor {
  constructor(api) { this.api = api; this.active = false; this.draft = null; this.sel = -1; this.panel = null; this.ring = null; this.category = 'Todo'; this.saving = false; this.conflicted = false; }

  open() {
    const api = this.api;
    if (this.active) return;
    if (api.sceneName !== 'casa') return api.goHome();
    if (!api.vivo.online) return api.ui.toast('Para decorar necesitas conexión: la casa se guarda en tu cuenta.', 3400);
    const s = api.vivo.state; this.saved = JSON.parse(JSON.stringify(s.home)); this.draft = JSON.parse(JSON.stringify(s.home)); this.baseHomeRevision = s.homeRev; this.sel = -1; this.active = true; this.category = 'Todo'; this.saving = false; this.conflicted = false;
    api.input.setEnabled(false);
    this.#panel(); this.#marker(); this.#pointer(true); this.#refresh();
  }

  /* ---------- operaciones del borrador ---------- */
  available(id) { const used = this.draft.items.filter(e => e.item === id).length; return (this.api.vivo.state.inv[id] || 0) - used; }
  add(id) {
    const def = itemById(id); if (!def || def.kind !== 'furniture' || this.available(id) <= 0) return false;
    const p = this.api.player.position;
    let e = { item: id, x: Math.round(Math.max(HOME.minX + 1, Math.min(HOME.maxX - 1, p.x)) / STEP) * STEP, z: Math.round(Math.max(HOME.minZ + 3.4, Math.min(HOME.maxZ - 1, p.z + 1.6)) / STEP) * STEP, r: 0 };
    if (def.layer === 'wall') e = { item: id, ...wallSnap(e.x, HOME.maxZ) };
    this.draft.items.push(e); this.sel = this.draft.items.length - 1; this.#refresh(); return true;
  }
  move(dx, dz) { const e = this.draft.items[this.sel]; if (!e) return; e.x = +(e.x + dx).toFixed(2); e.z = +(e.z + dz).toFixed(2); if (itemById(e.item).layer === 'wall') Object.assign(e, wallSnap(e.x, e.z)); this.#refresh(); }
  rotate() { const e = this.draft.items[this.sel]; if (!e || itemById(e.item).layer === 'wall') return; e.r = (e.r + 1) % 4; this.#refresh(); }
  remove() { if (this.sel < 0) return; this.draft.items.splice(this.sel, 1); this.sel = -1; this.#refresh(); }
  setWall(id) { this.draft.wall = id; this.#refresh(); }
  setFloor(id) { this.draft.floor = id; this.#refresh(); }
  check() { return checkLayout(this.draft, this.api.vivo.state.inv); }

  async save() {
    if (this.saving || this.conflicted || !this.active) return;
    const c = this.check(); if (!c.ok) { this.#status(HOME_REASONS[c.reason] || 'Revisa la distribución.', true); return c; }
    const panel = this.panel; this.saving = true; this.#renderPanel(); this.#status('Guardando en tu cuenta…');
    let r;
    try { r = await this.api.vivo.saveHome(c.layout, { expectedHomeRevision: this.baseHomeRevision }); }
    catch { r = { ok: false, message: 'No se pudo confirmar el guardado. Conservamos tu borrador.' }; }
    if (!this.active || this.panel !== panel) return r;
    this.saving = false;
    if (!r.ok) { this.conflicted = r.reason === 'casa-conflicto'; this.#renderPanel(); this.#status(this.conflicted ? 'Tu casa cambió en otra sesión. Conservamos este borrador; carga la casa guardada para continuar.' : r.message || 'No se pudo guardar. Conservamos tu borrador.', true); return r; }
    this.api.ui.toast('¡Tu casa quedó guardada en tu cuenta!', 2800); this.close(false); return r;
  }
  close(revert = true) {
    if (!this.active) return;
    this.active = false; this.#pointer(false);
    if (revert) this.api.scene?.applyHome?.(this.conflicted ? this.api.vivo.state.home : this.saved); else this.api.scene?.applyHome?.(this.api.vivo.state.home);
    this.panel?.remove(); this.panel = null; this.ring?.parent?.remove(this.ring); this.ring?.geometry.dispose(); this.ring?.material.dispose(); this.ring = null;
    this.api.camera.release(); this.api.input.setEnabled(!this.api.ui.isBlocking);
  }

  /* ---------- vista ---------- */
  update() {
    if (!this.active) return;
    this.api.camera.frame(new THREE.Vector3(0, 11.5, 8.2), new THREE.Vector3(0, 0, 0.6), 0.3);   // vista de planta inclinada
    const e = this.draft.items[this.sel];
    if (this.ring) { this.ring.visible = Boolean(e); if (e) { this.ring.position.set(e.x, 0.04, e.z); this.ring.scale.setScalar(Math.max(...itemById(e.item).size) * 0.62); } }
  }
  #marker() {
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    this.api.scene.group.add(this.ring);
  }
  #refresh() {
    const c = this.check();
    this.api.scene.applyHome(c.ok ? c.layout : { ...this.draft, items: this.draft.items.filter((_, i) => !(c.reason === 'no-lo-tienes' && i === c.index)) });
    if (this.ring) this.ring.material.color.setHex(c.ok || c.index !== this.sel ? 0xffc93c : 0xe2483d);
    this.#renderPanel();
    if (this.conflicted) this.#status('Tu casa cambió en otra sesión. Conservamos este borrador; carga la casa guardada para continuar.', true);
    else if (c.ok) this.#status(`${this.draft.items.length} de ${HOME.maxItems} objetos · borrador sin guardar`); else this.#status(HOME_REASONS[c.reason] || 'Revisa la distribución.', true);
  }
  #status(text, bad = false) { const s = this.panel?.querySelector('.hed__status'); if (s) { s.textContent = text; s.classList.toggle('is-bad', bad); } }

  async #reloadSaved() {
    const panel = this.panel;
    const pick = await this.api.ui.choice({ speaker: 'Mi casa', text: 'La casa cambió en otra sesión. ¿Descartas este borrador y cargas la versión guardada en tu cuenta?', options: [{ id: 'keep', label: 'Conservar mi borrador', primary: true }, { id: 'reload', label: 'Descartar borrador y cargar casa' }] });
    if (!this.active || this.panel !== panel) return;
    this.api.input.setEnabled(false);
    if (pick !== 'reload') return;
    const s = this.api.vivo.state; this.saved = JSON.parse(JSON.stringify(s.home)); this.draft = JSON.parse(JSON.stringify(s.home)); this.baseHomeRevision = s.homeRev; this.sel = -1; this.conflicted = false; this.#refresh();
  }

  #panel() {
    this.panel = h('div', 'hed'); this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-label', 'Decorar mi casa');
    this.panel.addEventListener('keydown', e => { if (e.key === 'Escape' && !this.saving) { e.preventDefault(); e.stopPropagation(); this.close(true); } });
    document.getElementById('game').append(this.panel);
  }
  #renderPanel() {
    const p = this.panel; if (!p) return; const s = this.api.vivo.state;
    const focused = p.contains(document.activeElement) ? document.activeElement?.dataset.homeFocus : null;
    const bodyTop = p.querySelector('.hed__body')?.scrollTop || 0, shelfLeft = p.querySelector('.hed__shelf')?.scrollLeft || 0, categoriesLeft = p.querySelector('.hed__categories')?.scrollLeft || 0;
    const oldStatus = p.querySelector('.hed__status'), status = oldStatus?.textContent || '', bad = oldStatus?.classList.contains('is-bad');
    const control = (label, cls, fn, key, title) => { const b = btn(label, cls, fn, title); b.dataset.homeFocus = key; b.disabled = this.saving; return b; };
    const head = h('div', 'hed__head'), identity = h('div', 'hed__identity'), statusEl = h('span', 'hed__status'); statusEl.setAttribute('role', 'status'); statusEl.setAttribute('aria-live', 'polite'); statusEl.setAttribute('aria-atomic', 'true');
    identity.append(h('small', 'hed__eyebrow', 'Mi casa'), h('strong', null, 'Decora a tu manera')); head.append(identity, statusEl);
    const body = h('div', 'hed__body');
    const sel = this.draft.items[this.sel], tools = h('div', 'hed__tools');
    const placed = h('select', 'hed__placed'); placed.setAttribute('aria-label', 'Seleccionar un objeto colocado'); placed.dataset.homeFocus = 'placed'; placed.disabled = this.saving;
    const placeholder = h('option', null, 'Selecciona un mueble de la sala'); placeholder.value = '-1'; placed.append(placeholder);
    this.draft.items.forEach((e, i) => { const o = h('option', null, `${i + 1}. ${itemById(e.item).name}`); o.value = String(i); placed.append(o); }); placed.value = String(this.sel);
    placed.addEventListener('change', () => { this.sel = Number(placed.value); this.#refresh(); }); tools.append(placed);
    if (sel) {
      const moves = h('div', 'hed__moves');
      moves.append(control('←', '', () => this.move(-STEP, 0), 'left', 'Mover a la izquierda'), control('↑', '', () => this.move(0, -STEP), 'back', 'Mover al fondo'), control('↓', '', () => this.move(0, STEP), 'front', 'Mover al frente'), control('→', '', () => this.move(STEP, 0), 'right', 'Mover a la derecha'));
      if (itemById(sel.item).layer !== 'wall') moves.append(control('⟳', '', () => this.rotate(), 'rotate', 'Girar el mueble'));
      moves.append(control('Quitar', 'hed__remove', () => this.remove(), 'remove', 'Devolver el mueble al inventario')); tools.append(moves);
    } else tools.append(h('small', 'note', 'Toca un mueble para moverlo o elige uno de tu inventario.'));
    const owned = ITEMS.filter(i => i.kind === 'furniture' && s.inv[i.id]), groups = ['Todo', ...new Set(owned.map(furnitureGroup))];
    if (!groups.includes(this.category)) this.category = 'Todo';
    const categories = h('div', 'hed__categories'); categories.setAttribute('role', 'group'); categories.setAttribute('aria-label', 'Filtrar muebles del inventario');
    for (const group of groups) { const b = control(group, 'hed__category' + (group === this.category ? ' is-on' : ''), () => { this.category = group; this.#renderPanel(); }, 'category-' + group); b.setAttribute('aria-pressed', String(group === this.category)); categories.append(b); }
    const shelf = h('div', 'hed__shelf');
    shelf.setAttribute('aria-label', 'Muebles de tu inventario');
    for (const it of owned.filter(i => this.category === 'Todo' || furnitureGroup(i) === this.category)) {
      const left = this.available(it.id), b = h('button', 'hed__item', null); b.type = 'button'; b.disabled = this.saving || left <= 0; b.dataset.homeFocus = 'item-' + it.id; b.setAttribute('aria-label', `${it.name}: ${left} disponibles para colocar`);
      const icon = h('span', 'hed__item-icon', it.icon); icon.setAttribute('aria-hidden', 'true');
      b.append(icon, h('small', 'hed__item-name', it.name), h('small', 'hed__quantity', left > 0 ? `${left} disponible${left === 1 ? '' : 's'}` : 'En la sala')); b.addEventListener('click', () => this.add(it.id)); shelf.append(b);
    }
    if (!owned.length) shelf.append(h('p', 'note', 'Todavía no tienes muebles en el inventario.'));
    const looks = h('details', 'hed__looks'); looks.open = Boolean(p.querySelector('.hed__looks')?.open); looks.append(h('summary', null, 'Paredes y piso'));
    const chips = (list, cur, fn, label) => { const row = h('div', 'hed__chips'); row.append(h('small', null, label)); for (const o of list) { const c = h('button', 'hed__chip' + (o.id === cur ? ' is-on' : '')); c.type = 'button'; c.disabled = this.saving; c.dataset.homeFocus = label + '-' + o.id; c.title = o.name; c.setAttribute('aria-label', label + ': ' + o.name); c.setAttribute('aria-pressed', String(o.id === cur)); c.style.setProperty('--swatch', '#' + o.color.toString(16).padStart(6, '0')); c.append(h('span', null, o.id === cur ? '✓' : '')); c.addEventListener('click', () => fn(o.id)); row.append(c); } return row; };
    looks.append(chips(WALL_COLORS, this.draft.wall, id => this.setWall(id), 'Paredes'), chips(FLOORS, this.draft.floor, id => this.setFloor(id), 'Piso'));
    const foot = h('div', 'hed__foot'), save = control(this.saving ? 'Guardando…' : 'Guardar cambios', 'btn--primary', () => this.save(), 'save'); save.disabled = this.saving || this.conflicted || !this.check().ok;
    foot.append(control('Cancelar', '', () => this.close(true), 'cancel'));
    if (this.conflicted) foot.append(control('Cargar casa guardada', '', () => this.#reloadSaved(), 'reload'));
    else foot.append(save);
    body.append(tools, categories, shelf, looks); p.replaceChildren(head, body, foot); p.setAttribute('aria-busy', String(this.saving)); this.#status(status, bad);
    body.scrollTop = bodyTop; shelf.scrollLeft = shelfLeft; categories.scrollLeft = categoriesLeft;
    if (focused) [...p.querySelectorAll('[data-home-focus]')].find(e => e.dataset.homeFocus === focused && !e.disabled)?.focus({ preventScroll: true });
  }

  /* ---------- tocar la sala: seleccionar y arrastrar ---------- */
  #pointer(on) {
    const el = this.api.engine.renderer.domElement;
    if (!on) { el.removeEventListener('pointerdown', this.onDown); el.removeEventListener('pointermove', this.onMove); removeEventListener('pointerup', this.onUp); return; }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const at = ev => { const r = el.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, this.api.engine.camera); return ray.ray.intersectPlane(floor, hit) ? hit.clone() : null; };
    let drag = null;
    this.onDown = ev => {
      if (this.saving) return;
      const p = at(ev); if (!p) return;
      // el mueble más cercano al punto tocado (dentro de su huella)
      let best = -1, bd = 1e9; this.draft.items.forEach((e, i) => { const d = itemById(e.item), half = Math.max(...d.size) / 2 + 0.2, dist = Math.hypot(p.x - e.x, p.z - e.z); if (dist < half && dist < bd) { bd = dist; best = i; } });
      this.sel = best; drag = best >= 0 ? { start: p, x: this.draft.items[best].x, z: this.draft.items[best].z } : null; this.#refresh();
    };
    this.onMove = ev => { if (!drag || this.saving) return; const p = at(ev); if (!p) return; const e = this.draft.items[this.sel]; e.x = Math.round((drag.x + p.x - drag.start.x) / 0.05) * 0.05; e.z = Math.round((drag.z + p.z - drag.start.z) / 0.05) * 0.05; if (itemById(e.item).layer === 'wall') Object.assign(e, wallSnap(e.x, e.z)); const m = this.api.scene.furniture.children[this.sel]; if (m) { m.position.set(e.x, 0, e.z); m.rotation.y = e.r * Math.PI / 2; } };   // al soltar se valida y se reconstruye
    this.onUp = () => { if (drag) { drag = null; if (!this.saving) this.#refresh(); } };
    el.addEventListener('pointerdown', this.onDown); el.addEventListener('pointermove', this.onMove); addEventListener('pointerup', this.onUp);
  }
}
