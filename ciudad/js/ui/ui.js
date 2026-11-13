// Interfaz del juego: HUD, diálogos, ventanas, avisos, mapa, pasaporte, misiones, armario y ajustes.
import { levelFromXp } from '../core/store.js';
import { QUALITY } from '../core/engine.js';
import { AVATARS, AVATAR_CATEGORIES, avatarById } from '../characters/catalog.js';
import { AVATAR_UNLOCKS, OUTFIT_COLORS, HAT_OPTIONS, SKIN_TONES, isAvatarUnlocked, applyCustom, unlockProgress } from '../progress/rules.js';
import { openWardrobe } from './wardrobe.js';
import { GAME_LIST } from '../edu/games.js';
import { BUILDINGS, doorPoint, footprint } from '../world/buildings.js';
import { placeByBuilding } from '../world/places.js';
import { REWARDS } from '../economy/economy.js';
import { isTouchDevice } from '../core/input.js';

const $ = id => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const icon = (name, cls = 'ic') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#ci-' + name); s.append(u); return s; };

export const ACHIEVEMENTS = [
  { id: 'primeros-pasos', name: 'Primeros pasos', text: 'Completa el tutorial.' },
  { id: 'primera-mision', name: 'Primera misión', text: 'Completa tu primera misión.' },
  { id: 'toga-y-mazo', name: 'Toga y mazo', text: 'Completa «Tú eres el juez».' },
  { id: 'decision-impecable', name: 'Decisión impecable', text: 'Obtén 100 puntos en una misión.' },
  { id: 'explorador-urbano', name: 'Explorador urbano', text: 'Visita la puerta de todos los edificios.' },
  { id: 'mente-curiosa', name: 'Mente curiosa', text: 'Responde bien 10 retos de los personajes de la ciudad.' },
  { id: 'poliglota', name: 'Políglota', text: 'Obtén 80 o más en Aventura de idiomas.' },
  { id: 'memoria-de-oro', name: 'Memoria de oro', text: 'Obtén 90 o más en Memoria ICADEM.' },
  { id: 'calculadora-humana', name: 'Calculadora humana', text: 'Obtén 90 o más en Matemáticas contra reloj.' },
  { id: 'gran-clasificador', name: 'Gran clasificador', text: 'Obtén 80 o más en Clasificación inteligente.' },
  { id: 'atleta-icadem', name: 'Atleta ICADEM', text: 'Termina la Carrera del conocimiento.' },
  { id: 'cazatesoros', name: 'Cazatesoros', text: 'Encuentra todos los tesoros de la plaza.' },
  { id: 'cientifico', name: 'Mente científica', text: 'Obtén 80 o más en el Laboratorio de experimentos.' },
  { id: 'escapista', name: 'Escapista', text: 'Abre los tres candados de la Sala de escape.' },
  { id: 'laberintista', name: 'Guardián del saber', text: 'Cruza el Laberinto del conocimiento.' },
  { id: 'trotamundos', name: 'Trotamundos', text: 'Descubre todos los sitios de la Ruta del explorador.' }
];

export const GAMES = [
  { id: 'banco', n: 1, name: 'Banco ICADEM', mission: 'El crédito correcto', missionId: 'banco-credito-correcto', ready: true },
  { id: 'supermercado', n: 2, name: 'Supermercado', mission: 'Rescate de inventario' },
  { id: 'hospital', n: 3, name: 'Hospital ICADEM', mission: 'Turno de decisiones' },
  { id: 'obra', n: 4, name: 'Obra en construcción', mission: 'Inspector de seguridad' },
  { id: 'veterinaria', n: 5, name: 'Clínica Veterinaria', mission: 'Guardianes del bienestar' },
  { id: 'invernadero', n: 6, name: 'Invernadero', mission: 'Cultivo inteligente' },
  { id: 'restaurante', n: 7, name: 'Restaurante', mission: 'Cocina contra reloj' },
  { id: 'oficina', n: 8, name: 'Oficina ICADEM', mission: 'El expediente perdido' },
  { id: 'tribunal', n: 9, name: 'Tribunal ICADEM', mission: 'Tú eres el juez', missionId: 'tribunal-tu-eres-el-juez', ready: true },
  { id: 'torre', n: 10, name: 'Torre ICADEM', mission: 'Desafío de equipos' }
];

const PLACES_ORDER = ['banco', 'tribunal', 'hospital', 'supermercado', 'obra', 'veterinaria', 'restaurante', 'invernadero', 'oficina', 'torre'];

export class UI {
  constructor(api) {
    this.api = api;
    this.blocking = 0;
    this.queue = Promise.resolve();
    this.trackerData = null;
    $('btn-map').addEventListener('click', () => this.openMap());
    $('btn-games')?.addEventListener('click', () => this.api.games?.open());
    $('btn-pass').addEventListener('click', () => this.openPassport());
    $('btn-player').addEventListener('click', () => this.openPassport());
    // Menú «Más»: Ajustes y Salir quedan a un toque, sin ocupar la pantalla.
    const more = $('more-menu'), moreBtn = $('btn-more');
    const setMore = open => { more.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open)); more.parentElement.classList.toggle('is-menu-open', open);   // el menú queda sobre la tarjeta del tutorial
      if (open) more.querySelector('button:not([hidden])')?.focus(); };
    moreBtn.addEventListener('click', e => { e.stopPropagation(); setMore(more.hidden); });
    more.addEventListener('click', () => setMore(false));
    document.addEventListener('pointerdown', e => { if (!more.hidden && !more.contains(e.target) && e.target !== moreBtn && !moreBtn.contains(e.target)) setMore(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !more.hidden) { setMore(false); moreBtn.focus(); } });
    $('btn-settings').addEventListener('click', () => this.openSettings());
    $('btn-wardrobe').addEventListener('click', () => this.openWardrobe());
    $('btn-exit').addEventListener('click', () => api.exit());
    $('interact').addEventListener('click', () => api.input.press('interact'));
    $('pad-jump').addEventListener('pointerdown', e => { e.preventDefault(); api.input.press('jump'); });
    $('pad-run').addEventListener('click', () => $('pad-run').classList.toggle('is-on', api.input.toggleRun()));
    $('tracker-toggle').addEventListener('click', () => {
      // En pantallas chicas el rastreador muestra solo el paso actual y se expande al tocarlo; en grandes se puede plegar.
      const t = $('tracker'), small = matchMedia('(max-width: 720px), (max-height: 480px)').matches;
      const open = small ? t.classList.toggle('is-open') : !t.classList.toggle('is-closed');
      $('tracker-toggle').setAttribute('aria-expanded', String(open));
    });
    $('waypoint').addEventListener('click', () => api.setWaypoint(null));
    if (isTouchDevice()) document.documentElement.classList.add('is-touch');
    if (api.embedded) $('btn-exit').hidden = false;
  }

  get isBlocking() { return this.blocking > 0; }
  #block(on) { this.blocking = Math.max(0, this.blocking + (on ? 1 : -1)); this.api.input.setEnabled(this.blocking === 0); if (this.blocking) this.setInteract(null); }

  /* ---------- HUD ---------- */
  showHud() { $('hud').hidden = false; this.refreshHud(); }
  refreshHud() {
    const s = this.api.store.state, lv = levelFromXp(s.xp), name = this.api.playerName;
    $('player-name').textContent = name;
    $('player-face').textContent = name.trim().slice(0, 1).toUpperCase() || 'E';
    $('player-level').textContent = lv.level;
    $('player-xp').style.width = Math.round(lv.progress * 100) + '%';
    $('credits-value').textContent = s.economy.balance;
  }
  setInteract(label) {
    const b = $('interact');
    if (!label || this.isBlocking) { b.hidden = true; return; }
    if ($('interact-label').textContent !== label) $('interact-label').textContent = label;
    b.hidden = false;
  }
  setPlace(title) {
    const p = $('place'); p.textContent = title; p.hidden = false;
    clearTimeout(this._placeT); this._placeT = setTimeout(() => { p.hidden = true; }, 2600);
  }
  setWaypoint(info) {
    const w = $('waypoint');
    if (!info) { w.hidden = true; return; }
    w.hidden = false; $('waypoint-text').textContent = info.text;
    $('waypoint-arrow').style.transform = `rotate(${info.angle}rad)`;
  }
  toast(text, ms = 3200) {
    const t = h('div', 'toast', text); $('toasts').append(t);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 320); }, ms);
  }
  setTracker(data) {
    this.trackerData = data;
    const t = $('tracker');
    if (!data) { t.hidden = true; return; }
    t.hidden = false;
    $('tracker-title').textContent = data.title; $('tracker-badge').textContent = data.badge || '';
    const ol = $('tracker-steps'); ol.replaceChildren();
    data.steps.forEach(s => { const li = h('li', s.done ? 'is-done' : s.active ? 'is-active' : '', s.text); if (s.detail) li.append(h('b', null, s.detail)); ol.append(li); });
  }
  /** Fundido entre escenarios; con `card` muestra el nombre del lugar y su misión mientras dura. */
  async fade(on, card) {
    const c = $('fade').querySelector('.fade__card');
    if (on && c) { $('fade-title').textContent = card ? card.title : ''; $('fade-sub').textContent = card && card.sub ? card.sub : ''; c.classList.toggle('has-text', Boolean(card)); }
    $('fade').classList.toggle('is-on', on);
    await new Promise(r => setTimeout(r, card && on ? 650 : 300));
  }

  /* ---------- diálogo ---------- */
  dialog({ speaker, lines }) {
    const run = () => new Promise(resolve => {
      const box = $('dialog'), text = $('dialog-text'), next = $('dialog-next');
      let i = 0, typing = null, full = '';
      this.#block(true); box.hidden = false; $('dialog-speaker').textContent = speaker;
      const show = () => {
        full = lines[i]; text.textContent = ''; let n = 0;
        next.textContent = i === lines.length - 1 ? 'Cerrar' : 'Continuar';
        clearInterval(typing);
        typing = setInterval(() => { n += 2; text.textContent = full.slice(0, n); if (n >= full.length) { clearInterval(typing); typing = null; } }, 18);
      };
      const advance = () => {
        if (typing) { clearInterval(typing); typing = null; text.textContent = full; return; }
        if (++i >= lines.length) { cleanup(); resolve(); } else show();
      };
      const key = e => { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); advance(); } };
      const cleanup = () => { clearInterval(typing); next.removeEventListener('click', advance); removeEventListener('keydown', key, true); box.hidden = true; this.#block(false); };
      next.addEventListener('click', advance); addEventListener('keydown', key, true);
      show(); next.focus({ preventScroll: true });
    });
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  /**
   * Hoja de opciones: aparece abajo y deja ver el escenario (audiencias, decisiones rápidas).
   * options: [{ id, label, hint?, disabled?, done?, primary? }] → devuelve el id elegido.
   */
  choice({ speaker = '', text = '', options }) {
    const run = () => new Promise(resolve => {
      let sheet = $('choice');
      if (!sheet) { sheet = h('div', 'choice'); sheet.id = 'choice'; sheet.hidden = true; sheet.append(h('div', 'choice__card')); $('game').append(sheet); }
      const card = sheet.firstChild, list = h('div', 'choice__list');
      card.replaceChildren(h('small', 'choice__speaker', speaker), h('p', 'choice__text', text), list);
      const done = id => { removeEventListener('keydown', key, true); sheet.hidden = true; this.#block(false); resolve(id); };
      const enabled = options.filter(o => !o.disabled);
      const key = e => { const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (n && enabled[n[1] - 1]) { e.preventDefault(); e.stopPropagation(); done(enabled[n[1] - 1].id); } };
      options.forEach(o => {
        const b = h('button', 'choice__opt' + (o.primary ? ' is-primary' : '') + (o.done ? ' is-done' : '')); b.type = 'button'; b.dataset.id = o.id; b.disabled = Boolean(o.disabled);
        const i = enabled.indexOf(o); if (i >= 0 && i < 9) b.append(h('kbd', null, String(i + 1)));
        const copy = h('span'); copy.append(h('strong', null, o.label)); if (o.hint) copy.append(h('small', null, o.hint)); b.append(copy);
        b.addEventListener('click', () => done(o.id)); list.append(b);
      });
      this.#block(true); sheet.hidden = false; addEventListener('keydown', key, true);
      (list.querySelector('.is-primary:not(:disabled)') || list.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
    });
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  /* ---------- ventana genérica ---------- */
  modal({ eyebrow = '', title, content, actions = [{ id: 'ok', label: 'Cerrar', primary: true }], validate, wide = false, hint = '', onClose }) {
    const run = () => new Promise(resolve => {
      const m = $('modal'), card = m.querySelector('.modal__card'), body = $('modal-body'), foot = $('modal-actions');
      this.#block(true); m.hidden = false; card.classList.toggle('is-wide', wide);
      $('modal-eyebrow').textContent = eyebrow; $('modal-title').textContent = title;
      body.replaceChildren(content); body.scrollTop = 0; $('modal-hint').textContent = ''; $('modal-hint').dataset.base = hint;
      const score = content.querySelector?.('.result__score'); if (score) score.style.setProperty('--p', score.querySelector('b').textContent);
      foot.replaceChildren();
      const done = id => {
        const problem = validate ? validate(id) : null;
        if (problem && id !== 'x') { $('modal-hint').textContent = problem; return; }
        m.hidden = true; $('modal-x').removeEventListener('click', onX); removeEventListener('keydown', key, true);
        this.#block(false); onClose?.(); resolve(id);
      };
      const onX = () => done('x');
      const key = e => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); done('x'); } };
      actions.forEach(a => { const b = h('button', 'btn' + (a.primary ? ' btn--primary' : ''), a.label); b.type = 'button'; b.addEventListener('click', () => done(a.id)); foot.append(b); });
      $('modal-x').addEventListener('click', onX); addEventListener('keydown', key, true);
      foot.querySelector('.btn--primary')?.focus({ preventScroll: true });
    });
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  /* ---------- mapa interactivo ---------- */
  openMap() {
    if (this.isBlocking) return;
    const api = this.api, st = api.store.state, wrap = h('div', 'map'), side = h('div', 'map__side'), cv = h('canvas'), info = h('div', 'map__info'), list = h('div', 'map__list');
    const HALF = 48, S = 520; cv.width = cv.height = S;
    const g = cv.getContext('2d'), k = S / (HALF * 2), mx = x => (x + HALF) * k, mz = z => (z + HALF) * k;
    // Lugares del mapa: los edificios (su misión y si ya la completaste) y las actividades al aire libre.
    const missionDone = b => { const pl = placeByBuilding(b.id), m = pl && api.missions && api.missions[pl.scene]; const id = m && m.def && m.def.id; return Boolean(id && st.missions[id] && st.missions[id].completed); };
    const items = [
      ...BUILDINGS.map(b => ({ kind: 'building', id: b.id, icon: b.icon, name: b.name, text: b.status === 'open' ? 'Misión: ' + b.mission : 'Próximamente', x: b.x, z: b.z, b, done: missionDone(b), open: b.status === 'open', way: doorPoint(b, 2.2) })),
      { kind: 'activity', id: 'parque', icon: '🏃', name: 'Parque de retos', text: 'Carrera del conocimiento: arcos, plataformas y meta. Entrada al norte de la plaza.', x: 0, z: 38.5, open: true, way: { x: 0, z: 34.5 } },
      { kind: 'activity', id: 'fuente', icon: '⛲', name: 'Punto de encuentro', text: 'La fuente de la plaza: aquí se reúne tu equipo y empieza la Búsqueda del tesoro.', x: 0, z: 0, open: true, way: { x: 0, z: 6 } },
      { kind: 'activity', id: 'distrito', icon: '🧪', name: 'Distrito del Saber', text: 'Laberinto del conocimiento, Laboratorio de experimentos, Sala de escape, anfiteatro y jardines. Entrada al sur de la plaza.', x: 0, z: -38.5, open: true, way: { x: 0, z: -34.5 } }
    ];
    let selected = null;
    const here = api.sceneName === 'plaza' ? api.player.position : null;
    const disc = (x, y, r, fill, stroke, lw = 2) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
    const draw = () => {
      g.fillStyle = '#c7e9b2'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#eadcc0'; g.fillRect(mx(-44), mz(-23), 88 * k, 5 * k); g.fillRect(mx(-44), mz(18), 88 * k, 5 * k); g.fillRect(mx(-29), mz(-18), 5 * k, 36 * k); g.fillRect(mx(24), mz(-18), 5 * k, 36 * k);
      g.fillStyle = '#7b8496'; g.fillRect(mx(-3.5), 0, 7 * k, S); g.fillRect(0, mz(-3.5), S, 7 * k);
      g.fillStyle = '#f4e3c3'; g.beginPath(); g.arc(mx(0), mz(0), 15 * k, 0, 7); g.fill();
      g.fillStyle = '#7fd8f4'; g.beginPath(); g.arc(mx(0), mz(0), 4.2 * k, 0, 7); g.fill();
      g.fillStyle = '#a8dc8f'; g.fillRect(mx(-9), mz(36), 18 * k, 11 * k);   // parque
      for (const b of BUILDINGS) {
        const f = footprint(b), on = selected && selected.id === b.id;
        g.fillStyle = b.wall; g.strokeStyle = on ? '#0f1f3d' : 'rgba(15,31,61,.35)'; g.lineWidth = on ? 4 : 1.5;
        g.beginPath(); if (g.roundRect) g.roundRect(mx(b.x - f.w / 2), mz(b.z - f.d / 2), f.w * k, f.d * k, 7); else g.rect(mx(b.x - f.w / 2), mz(b.z - f.d / 2), f.w * k, f.d * k); g.fill(); g.stroke();
      }
      if (api.waypoint) { g.strokeStyle = '#2f9e8f'; g.lineWidth = 3; g.setLineDash([6, 5]); if (here) { g.beginPath(); g.moveTo(mx(here.x), mz(here.z)); g.lineTo(mx(api.waypoint.x), mz(api.waypoint.z)); g.stroke(); } g.setLineDash([]); disc(mx(api.waypoint.x), mz(api.waypoint.z), 6, '#2f9e8f', '#fff'); }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '21px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      for (const it of items) {
        const x = mx(it.x), y = mz(it.z), on = selected && selected.id === it.id;
        disc(x, y, on ? 19 : 17, '#ffffff', on ? '#0f1f3d' : it.kind === 'activity' ? '#2f9e8f' : 'rgba(15,31,61,.55)', on ? 3 : 2);
        g.fillStyle = '#000'; g.fillText(it.icon, x, y + 1);
        if (it.done) { disc(x + 13, y - 13, 7.5, '#1f7a55', '#fff', 1.5); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 9.5, y - 13); g.lineTo(x + 12.5, y - 10); g.lineTo(x + 16.5, y - 15.5); g.stroke(); }
      }
      if (here) { g.save(); g.translate(mx(here.x), mz(here.z)); g.rotate(-api.player.yaw + Math.PI); g.fillStyle = '#e8483f'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4.5); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    };
    const renderInfo = () => {
      info.replaceChildren();
      if (!selected) info.append(h('h4', null, here ? 'Tú estás en la plaza' : 'Estás en un interior'), h('p', null, here ? 'La flecha roja eres tú. Toca un lugar del mapa o de la lista para ver qué hay y marcarlo como destino.' : 'Sal a la ciudad para ver tu posición; desde aquí ya puedes marcar un destino.'));
      else {
        const head = h('div', 'map__head'); head.append(h('span', 'map__icon', selected.icon), h('h4', null, selected.name)); info.append(head, h('p', null, selected.text));
        const pills = h('div', 'map__pills');
        pills.append(h('span', 'pill ' + (selected.open ? 'pill--ok' : 'pill--soon'), selected.kind === 'activity' ? 'Actividad' : selected.open ? 'Disponible' : 'Próximamente'));
        if (selected.done) pills.append(h('span', 'pill pill--done', 'Completada'));
        info.append(pills);
        const go = h('button', 'btn btn--primary', 'Marcar como destino'); go.type = 'button';
        go.addEventListener('click', () => { api.setWaypoint({ x: selected.way.x, z: selected.way.z, name: selected.name }); this.toast('Destino marcado: ' + selected.name); draw(); });
        info.append(go);
      }
      list.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', Boolean(selected) && b.dataset.id === selected.id));
    };
    for (const it of items) {
      const btn = h('button'); btn.type = 'button'; btn.dataset.id = it.id;
      const name = h('span', null, it.name); name.style.flex = '1';
      btn.append(h('i', 'map__emoji', it.icon), name, h('small', it.done ? 'is-done' : null, it.done ? 'Completada' : it.kind === 'activity' ? 'Actividad' : it.open ? 'Abierto' : 'Pronto'));
      btn.addEventListener('click', () => { selected = it; draw(); renderInfo(); });
      list.append(btn);
    }
    cv.addEventListener('click', e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * HALF * 2 - HALF, z = (e.clientY - r.top) / r.height * HALF * 2 - HALF;
      selected = items.find(it => Math.hypot(x - it.x, z - it.z) < 3.4) || BUILDINGS.map(b => items.find(it => it.id === b.id)).find(it => { const f = footprint(it.b); return Math.abs(x - it.x) <= f.w / 2 + 1 && Math.abs(z - it.z) <= f.d / 2 + 1; }) || null;
      draw(); renderInfo();
    });
    const legend = h('div', 'map__legend');
    legend.append(h('span', null, '➤ Tú'), h('span', 'is-done', '✓ Completada'), h('span', 'is-act', '● Actividad'));
    const left = h('div', 'map__canvas'); left.append(cv, legend);
    side.append(info, list); wrap.append(left, side); draw(); renderInfo();
    api.events.emit('map-opened');
    return this.modal({ eyebrow: 'Mapa', title: 'Ciudad ICADEM', content: wrap, wide: true });
  }

  /* ---------- pasaporte ---------- */
  /** Identificador de la misión del edificio (sale de los juegos realmente cargados). */
  missionIdOf(buildingId) { const pl = placeByBuilding(buildingId), m = pl && this.api.missions && this.api.missions[pl.scene]; return (m && m.def && m.def.id) || null; }

  openPassport(tab = 'resumen') {
    if (this.isBlocking) return;
    const api = this.api, s = api.store.state, lv = levelFromXp(s.xp), wrap = h('div', 'passport'), tabs = h('div', 'tabs'), body = h('div');
    const missions = PLACES_ORDER.map(id => ({ b: BUILDINGS.find(x => x.id === id), mid: this.missionIdOf(id) })).filter(x => x.b && x.mid);
    const doneM = missions.filter(x => s.missions[x.mid] && s.missions[x.mid].completed), act = (s.play && s.play.act) || {};
    const doneG = GAME_LIST.filter(gm => act[gm.id] && act[gm.id].done);
    const bar = (value, max) => { const t = h('i', 'meter'), f = h('i'); f.style.width = Math.round(100 * Math.min(1, max ? value / max : 0)) + '%'; t.append(f); return t; };
    const views = {
      resumen: () => {
        const hero = h('div', 'pass__hero'), ring = h('div', 'pass__ring'), copy = h('div', 'pass__copy');
        ring.style.setProperty('--p', String(Math.round(lv.progress * 100)));
        ring.append(h('b', null, String(lv.level)), h('small', null, 'nivel'));
        const av = avatarById(s.avatarId);
        copy.append(h('strong', null, api.playerName), h('span', null, `${av.name} · ${s.xp} XP`), bar(s.xp - lv.base, lv.next ? lv.next - lv.base : 1),
          h('small', null, lv.next ? `${lv.next - s.xp} XP para el nivel ${lv.level + 1}` : 'Nivel máximo alcanzado'));
        hero.append(ring, copy);
        const grid = h('div', 'pass__grid');
        [['Misiones', doneM.length, missions.length], ['Minijuegos', doneG.length, GAME_LIST.length], ['Logros', s.achievements.length, ACHIEVEMENTS.length], ['Edificios', s.visited.length, BUILDINGS.length]].forEach(([t, v, m]) => {
          const c = h('div', 'pass__card'); c.append(h('span', null, t), h('b', null, `${v}/${m}`), bar(v, m)); grid.append(c);
        });
        const next = h('div', 'pass__next'); next.append(h('h4', null, 'Para seguir avanzando'));
        const pend = [...missions.filter(x => !doneM.includes(x)).slice(0, 3).map(x => ({ icon: x.b.icon, text: `Misión: ${x.b.mission}`, sub: x.b.name, go: () => { const p = doorPoint(x.b, 2.2); api.setWaypoint({ x: p.x, z: p.z, name: x.b.name }); this.toast('Destino marcado: ' + x.b.name); document.getElementById('modal-x').click(); } })),
          ...GAME_LIST.filter(gm => !doneG.includes(gm)).slice(0, 2).map(gm => ({ icon: gm.icon, text: gm.title, sub: 'Minijuego', go: () => { document.getElementById('modal-x').click(); setTimeout(() => api.games && api.games.open(), 80); } }))];
        if (!pend.length) next.append(h('p', 'note', '¡Completaste todas las misiones y minijuegos! Puedes repetirlos para mejorar tu puntuación.'));
        pend.forEach(p => { const r = h('button', 'pass__todo'); r.type = 'button'; r.append(h('span', 'pass__todo-ic', p.icon), h('span', null, p.text), h('small', null, p.sub)); r.addEventListener('click', p.go); next.append(r); });
        const credits = h('div', 'pass__credits'); credits.append(h('span', null, 'Créditos de prueba'), h('b', null, String(s.economy.balance)));
        body.append(hero, grid, next, credits,
          h('p', 'note', 'Tu pasaporte registra el avance dentro del juego' + (api.net && api.net.isOnline ? ', guardado en tu cuenta.' : ' (sin conexión: guardado en este dispositivo).') + ' Los créditos de prueba no forman parte de tu cartera ICADEM; rangos y logros no son títulos académicos.'));
      },
      logros: () => { const rows = h('div', 'rows'); ACHIEVEMENTS.forEach(a => { const on = s.achievements.includes(a.id), r = h('div', 'rowi'), ic = h('span', 'rowi__icon' + (on ? '' : ' is-off')); ic.append(icon(on ? 'trophy' : 'lock')); const c = h('div', 'rowi__copy'); c.append(h('strong', null, a.name), h('span', null, a.text)); r.append(ic, c, h('span', 'pill ' + (on ? 'pill--ok' : 'pill--soon'), on ? 'Obtenido' : 'Pendiente')); rows.append(r); }); body.append(rows); },
      avatar: () => {
        const av = avatarById(s.avatarId), outfit = OUTFIT_COLORS.find(o => o.id === s.custom.outfit) || OUTFIT_COLORS[0], hat = HAT_OPTIONS.find(o => o.id === s.custom.hat) || HAT_OPTIONS[0];
        const rows = h('div', 'rows');
        [['Avatar', av.name], ['Atuendo', outfit.name], ['Sombrero', hat.name], ['Avatares desbloqueados', `${AVATARS.filter(a => isAvatarUnlocked(a.id, s)).length} de ${AVATARS.length}`]].forEach(([k, v]) => { const r = h('div', 'rowi'), c = h('div', 'rowi__copy'); c.append(h('strong', null, v), h('span', null, k)); r.append(c); rows.append(r); });
        const go = h('button', 'btn btn--primary', 'Abrir el vestidor'); go.type = 'button'; go.addEventListener('click', () => { document.getElementById('modal-x').click(); setTimeout(() => this.openWardrobe(), 80); });
        body.append(rows, go);
      },
      movimientos: () => {
        const rows = h('div', 'rows'); const led = [...s.economy.ledger].reverse();
        if (!led.length) rows.append(h('p', 'note', 'Todavía no hay movimientos. Completa el tutorial o una misión.'));
        led.forEach(e => { const r = h('div', 'rowi'), ic = h('span', 'rowi__icon'); ic.append(icon('coin')); const c = h('div', 'rowi__copy'); c.append(h('strong', null, e.reason || e.key), h('span', null, new Date(e.at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }))); r.append(ic, c, h('span', 'pill pill--gold', '+' + e.amount)); rows.append(r); });
        body.append(rows, h('p', 'note', 'Son créditos de prueba del juego: no forman parte de tu cartera ICADEM.'));
      }
    };
    const show = id => { tabs.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.id === id)); body.replaceChildren(); views[id](); };
    [['resumen', 'Resumen'], ['logros', 'Logros'], ['avatar', 'Avatar'], ['movimientos', 'Movimientos']].forEach(([id, t]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.id = id; b.addEventListener('click', () => show(id)); tabs.append(b); });
    wrap.append(tabs, body); show(views[tab] ? tab : 'resumen');
    return this.modal({ eyebrow: 'Pasaporte ICADEM', title: api.playerName, content: wrap });
  }

  /* ---------- tablero de misiones ---------- */
  openMissions() {
    if (this.isBlocking) return;
    const s = this.api.store.state, rows = h('div', 'rows');
    GAMES.map(gm => { const mid = this.missionIdOf(gm.id); return { ...gm, missionId: mid, ready: Boolean(mid) }; }).forEach(gm => {
      const rec = gm.missionId ? s.missions[gm.missionId] : null, r = h('div', 'rowi'), ic = h('span', 'rowi__icon' + (gm.ready ? '' : ' is-off'));
      ic.append(gm.ready ? icon(rec?.completed ? 'check' : 'pin') : icon('lock'));
      const c = h('div', 'rowi__copy'); c.append(h('strong', null, `${gm.n}. ${gm.mission}`), h('span', null, gm.name + (rec?.completed ? ` · mejor puntuación ${rec.bestScore}` : gm.ready ? ` · +${(this.api.missionService.rewardFor(gm.missionId) || REWARDS[gm.missionId]).amount} créditos de prueba` : '')));
      r.append(ic, c);
      if (gm.ready) { const go = h('button', 'btn btn--primary', 'Ir'); go.type = 'button'; go.addEventListener('click', () => { const b = BUILDINGS.find(x => x.id === gm.id), p = doorPoint(b, 2.2); this.api.setWaypoint({ x: p.x, z: p.z, name: b.name }); this.toast('Destino marcado: ' + b.name + '. Sal por la puerta.'); document.getElementById('modal-x').click(); }); r.append(go); }
      else r.append(h('span', 'pill pill--soon', 'Próximamente'));
      rows.append(r);
    });
    const wrap = h('div'); wrap.append(rows, h('p', 'note', 'Las diez misiones están abiertas. Los créditos de prueba se dan la primera vez; repetir sirve para mejorar tu puntuación y suma XP de práctica una vez al día.'));
    return this.modal({ eyebrow: 'Escritorio de misiones', title: 'Las diez misiones', content: wrap });
  }

  /* ---------- vestidor (ui/wardrobe.js) ---------- */
  openWardrobe(o) { return openWardrobe(this, o); }

  /* ---------- ajustes ---------- */
  /** Modo familiar: perfiles infantiles supervisados. Solo funciona si el servidor lo tiene activo. */
  #familyField() {
    const api = this.api, net = api.net, box = h('div', 'family');
    if (api.store.state.profileKind === 'infantil') { box.append(h('p', 'note', 'Estás jugando con un perfil infantil supervisado. Para cambiar de perfil, sal del juego y vuelve a entrar.')); return box; }
    if (!net.isOnline || !net.family || !net.family.enabled) {
      box.append(h('p', 'note', 'En preparación. Los perfiles infantiles supervisados (alias, avatar y progreso propios, sin chat ni contacto con desconocidos) se activarán cuando concluya la revisión de privacidad y consentimiento.'));
      return box;
    }
    const list = h('div', 'players'), render = kids => {
      list.replaceChildren();
      (kids || []).forEach(k => {
        const row = h('div', 'players__row'), who = h('div', 'players__who'); who.append(h('strong', null, k.alias), h('small', null, k.band + ' años')); row.append(who);
        const play = h('button', 'btn btn--primary', 'Jugar con este perfil'); play.type = 'button'; play.addEventListener('click', () => { const u = new URL(location.href); u.searchParams.set('perfil', k.id); location.replace(u.toString()); });
        const del = h('button', 'btn', 'Quitar'); del.type = 'button'; del.addEventListener('click', () => net.profile('family', { action: 'remove', id: k.id }));
        row.append(play, del); list.append(row);
      });
      if (!(kids || []).length) list.append(h('p', 'players__empty', 'Aún no hay perfiles infantiles.'));
    };
    const off = net.on('profile', m => { if (m.op !== 'family') return; if (m.ok === false) this.toast({ 'falta-consentimiento': 'Confirma que eres la persona adulta responsable.', 'alias-invalido': 'Usa un alias de 2 a 16 letras o números (sin datos personales).', 'familia-llena': 'Máximo 4 perfiles infantiles.', 'alias-repetido': 'Ya existe un perfil con ese alias.' }[m.reason] || 'No se pudo guardar.', 3200); else render(m.family); });
    const alias = h('input', 'lobby__code'); alias.maxLength = 16; alias.placeholder = 'Alias (no el nombre real)'; alias.style.letterSpacing = '0'; alias.style.textTransform = 'none';
    const band = document.createElement('select'); [['6-8', '6 a 8 años'], ['9-12', '9 a 12 años'], ['13-17', '13 a 17 años']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; band.append(o); });
    const consent = h('label', 'social__privacy'), cb = document.createElement('input'); cb.type = 'checkbox'; consent.append(cb, h('span', null, 'Soy madre, padre o tutor de este menor y autorizo su perfil supervisado.'));
    const add = h('button', 'btn btn--primary', 'Agregar perfil infantil'); add.type = 'button';
    add.addEventListener('click', () => net.profile('family', { action: 'add', alias: alias.value, band: band.value, consent: cb.checked }));
    const row = h('div', 'lobby__join'); row.append(alias, band);
    box.append(list, row, consent, add, h('p', 'note', 'Solo se guarda un alias, un avatar y el rango de edad. Los perfiles infantiles no tienen chat, no ven ni son vistos por personas fuera de tu equipo familiar y no ven el Directorio Profesional.'));
    net.profile('family', { action: 'list' });
    setTimeout(() => { const obs = new MutationObserver(() => { if (!document.body.contains(box)) { off(); obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true }); }, 0);
    return box;
  }

  openSettings() {
    if (this.isBlocking) return;
    const api = this.api, st = api.store.state.settings, wrap = h('div');
    const field = (label, node) => { const f = h('label', 'field'); f.append(h('span', null, label), node); return f; };
    const seg = h('div', 'seg');
    [['auto', 'Automática'], ['low', QUALITY.low.label], ['medium', QUALITY.medium.label], ['high', QUALITY.high.label]].forEach(([id, t]) => { const b = h('button', st.quality === id ? 'is-on' : '', t); b.type = 'button'; b.addEventListener('click', () => { st.quality = id; api.store.save(); api.applySettings(); seg.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); }); seg.append(b); });
    const sens = h('input'); sens.type = 'range'; sens.min = '0.4'; sens.max = '2'; sens.step = '0.1'; sens.value = String(st.sensitivity);
    sens.addEventListener('input', () => { st.sensitivity = Number(sens.value); api.store.save(); api.applySettings(); });
    const inv = h('div', 'seg'); [[false, 'Normal'], [true, 'Invertida']].forEach(([v, t]) => { const b = h('button', st.invertY === v ? 'is-on' : '', t); b.type = 'button'; b.addEventListener('click', () => { st.invertY = v; api.store.save(); api.applySettings(); inv.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); }); inv.append(b); });
    const npc = h('div', 'seg'); [[true, 'Activados'], [false, 'Desactivados']].forEach(([v, t]) => { const b = h('button', (st.npcQuiz !== false) === v ? 'is-on' : '', t); b.type = 'button'; b.addEventListener('click', () => { st.npcQuiz = v; api.store.save(); npc.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); }); npc.append(b); });
    const fam = this.#familyField();
    const keys = h('dl', 'keys');
    (document.documentElement.classList.contains('is-touch')
      ? [['Mover', 'Arrastra en la parte izquierda de la pantalla'], ['Cámara', 'Arrastra en el resto de la pantalla'], ['Interactuar', 'Botón amarillo que aparece al acercarte'], ['Saltar / correr', 'Botones de la derecha']]
      : [['W A S D', 'Mover (también flechas)'], ['Mouse', 'Arrastra para girar la cámara; rueda para acercar'], ['E', 'Interactuar'], ['Espacio', 'Saltar'], ['Shift', 'Correr'], ['M', 'Mapa']]
    ).forEach(([k, v]) => keys.append(h('dt', null, k), h('dd', null, v)));
    const tut = h('button', 'btn', 'Repetir tutorial'); tut.type = 'button'; tut.addEventListener('click', () => { document.getElementById('modal-x').click(); api.startTutorial(true); });
    const reset = h('button', 'btn', 'Borrar datos de prueba'); reset.type = 'button'; reset.addEventListener('click', () => { if (reset.dataset.sure) { api.store.reset(); location.reload(); } else { reset.dataset.sure = '1'; reset.textContent = 'Toca otra vez para confirmar'; } });
    const acts = h('div', 'seg'); acts.append(tut, reset);
    wrap.append(field('Calidad gráfica', seg), field('Sensibilidad de la cámara', sens), field('Cámara vertical', inv), field('Retos de los personajes de la ciudad', npc), field('Modo familiar', fam), field('Controles', keys), acts,
      h('p', 'note', `Calidad activa: ${QUALITY[api.engine.quality].label} · ${api.engine.fps || '—'} cuadros por segundo. ${api.net && api.net.isOnline ? 'Tu progreso se guarda en tu cuenta.' : 'Sin conexión: tu progreso se guarda en este dispositivo.'}`));
    return this.modal({ eyebrow: 'Ajustes', title: 'Juego y controles', content: wrap });
  }
}
