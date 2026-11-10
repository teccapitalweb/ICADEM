// Interfaz del juego: HUD, diálogos, ventanas, avisos, mapa, pasaporte, misiones, armario y ajustes.
import { levelFromXp } from '../core/store.js';
import { QUALITY } from '../core/engine.js';
import { AVATARS, avatarById } from '../characters/catalog.js';
import { BUILDINGS, doorPoint, footprint } from '../world/buildings.js';
import { REWARDS } from '../economy/economy.js';
import { isTouchDevice } from '../core/input.js';

const $ = id => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const icon = (name, cls = 'ic') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', cls); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#ci-' + name); s.append(u); return s; };

export const ACHIEVEMENTS = [
  { id: 'primeros-pasos', name: 'Primeros pasos', text: 'Completa el tutorial.' },
  { id: 'primera-mision', name: 'Primera misión', text: 'Completa «El crédito correcto».' },
  { id: 'decision-impecable', name: 'Decisión impecable', text: 'Obtén 100 puntos en una misión.' },
  { id: 'explorador-urbano', name: 'Explorador urbano', text: 'Visita la puerta de todos los edificios.' }
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
  { id: 'tribunal', n: 9, name: 'Tribunal ICADEM', mission: 'Tú eres el juez' },
  { id: 'torre', n: 10, name: 'Torre ICADEM', mission: 'Desafío de equipos' }
];

export class UI {
  constructor(api) {
    this.api = api;
    this.blocking = 0;
    this.queue = Promise.resolve();
    this.trackerData = null;
    $('btn-map').addEventListener('click', () => this.openMap());
    $('btn-pass').addEventListener('click', () => this.openPassport());
    $('btn-player').addEventListener('click', () => this.openPassport());
    $('btn-settings').addEventListener('click', () => this.openSettings());
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
  async fade(on) { $('fade').classList.toggle('is-on', on); await new Promise(r => setTimeout(r, 300)); }

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
    const api = this.api, wrap = h('div', 'map'), cv = h('canvas'), info = h('div', 'map__info'), list = h('div', 'map__list');
    const HALF = 48, S = 480; cv.width = cv.height = S;
    const g = cv.getContext('2d'), k = S / (HALF * 2), mx = x => (x + HALF) * k, mz = z => (z + HALF) * k;
    let selected = null;
    const here = api.sceneName === 'plaza' ? api.player.position : null;
    const draw = () => {
      g.fillStyle = '#bfe6a8'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#eadcc0'; g.fillRect(mx(-44), mz(-23), 88 * k, 5 * k); g.fillRect(mx(-44), mz(18), 88 * k, 5 * k); g.fillRect(mx(-29), mz(-18), 5 * k, 36 * k); g.fillRect(mx(24), mz(-18), 5 * k, 36 * k);
      g.fillStyle = '#6f7889'; g.fillRect(mx(-3.5), 0, 7 * k, S); g.fillRect(0, mz(-3.5), S, 7 * k);
      g.fillStyle = '#f4e3c3'; g.beginPath(); g.arc(mx(0), mz(0), 15 * k, 0, 7); g.fill();
      g.fillStyle = '#6fd3f2'; g.beginPath(); g.arc(mx(0), mz(0), 4.2 * k, 0, 7); g.fill();
      g.fillStyle = '#e86a5c'; g.beginPath(); g.arc(mx(35), mz(9), 4 * k, 0, 7); g.fill();
      for (const b of BUILDINGS) {
        const f = footprint(b), on = selected && selected.id === b.id;
        g.fillStyle = b.wall; g.strokeStyle = on ? '#0f1f3d' : 'rgba(15,31,61,.45)'; g.lineWidth = on ? 4 : 1.5;
        g.beginPath(); if (g.roundRect) g.roundRect(mx(b.x - f.w / 2), mz(b.z - f.d / 2), f.w * k, f.d * k, 6); else g.rect(mx(b.x - f.w / 2), mz(b.z - f.d / 2), f.w * k, f.d * k); g.fill(); g.stroke();
        if (b.status === 'open') { g.fillStyle = '#0f1f3d'; g.beginPath(); g.arc(mx(b.x), mz(b.z), 5, 0, 7); g.fill(); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(mx(b.x), mz(b.z), 2.5, 0, 7); g.fill(); }
      }
      if (api.waypoint) { g.strokeStyle = '#2f9e8f'; g.lineWidth = 3; g.setLineDash([6, 5]); if (here) { g.beginPath(); g.moveTo(mx(here.x), mz(here.z)); g.lineTo(mx(api.waypoint.x), mz(api.waypoint.z)); g.stroke(); } g.setLineDash([]); g.fillStyle = '#2f9e8f'; g.beginPath(); g.arc(mx(api.waypoint.x), mz(api.waypoint.z), 6, 0, 7); g.fill(); }
      if (here) { g.save(); g.translate(mx(here.x), mz(here.z)); g.rotate(-api.player.yaw + Math.PI); g.fillStyle = '#e8483f'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    };
    const renderInfo = () => {
      info.replaceChildren();
      if (!selected) { info.append(h('h4', null, 'Ciudad ICADEM'), h('p', null, here ? 'Toca un edificio para ver su misión y marcarlo como destino. La flecha roja eres tú.' : 'Estás en un interior. Sal a la ciudad para ver tu posición; desde aquí ya puedes marcar un destino.')); }
      else {
        const open = selected.status === 'open';
        info.append(h('h4', null, selected.name), h('p', null, 'Misión: ' + selected.mission), h('span', 'pill ' + (open ? 'pill--ok' : 'pill--soon'), open ? 'Disponible' : 'Próximamente'));
        const go = h('button', 'btn btn--primary', 'Marcar como destino'); go.type = 'button'; go.style.marginTop = '6px';
        go.addEventListener('click', () => { const p = doorPoint(selected, 2.2); api.setWaypoint({ x: p.x, z: p.z, name: selected.name }); this.toast('Destino marcado: ' + selected.name); draw(); });
        info.append(go);
      }
      info.append(list);
      list.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', selected && b.dataset.id === selected.id));
    };
    for (const b of BUILDINGS) {
      const btn = h('button'); btn.type = 'button'; btn.dataset.id = b.id;
      const sw = h('i'); sw.style.background = b.wall; const name = h('span', null, b.name); name.style.flex = '1';
      btn.append(sw, name, h('small', null, b.status === 'open' ? 'Abierto' : 'Pronto'));
      btn.addEventListener('click', () => { selected = b; draw(); renderInfo(); });
      list.append(btn);
    }
    cv.addEventListener('click', e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * HALF * 2 - HALF, z = (e.clientY - r.top) / r.height * HALF * 2 - HALF;
      selected = BUILDINGS.find(b => { const f = footprint(b); return Math.abs(x - b.x) <= f.w / 2 + 1 && Math.abs(z - b.z) <= f.d / 2 + 1; }) || null;
      draw(); renderInfo();
    });
    wrap.append(cv, info); draw(); renderInfo();
    api.events.emit('map-opened');
    return this.modal({ eyebrow: 'Mapa', title: 'Ciudad ICADEM', content: wrap, wide: true });
  }

  /* ---------- pasaporte ---------- */
  openPassport(tab = 'resumen') {
    if (this.isBlocking) return;
    const s = this.api.store.state, lv = levelFromXp(s.xp), wrap = h('div'), tabs = h('div', 'tabs'), body = h('div');
    const done = Object.values(s.missions).filter(m => m.completed).length;
    const views = {
      resumen: () => {
        const st = h('div', 'stats');
        [[lv.level, 'Nivel'], [s.xp, 'XP'], [`${done}/10`, 'Misiones'], [`${s.visited.length}/${BUILDINGS.length}`, 'Edificios'], [`${s.achievements.length}/${ACHIEVEMENTS.length}`, 'Logros'], [s.economy.balance, 'Créditos de prueba']].forEach(([v, t]) => { const d = h('div'); d.append(h('b', null, String(v)), h('span', null, t)); st.append(d); });
        body.append(st, h('p', 'note', lv.next ? `Te faltan ${lv.next - s.xp} XP para el nivel ${lv.level + 1}.` : 'Nivel máximo del prototipo.'),
          h('p', 'note', 'El pasaporte registra tu avance dentro del juego. Los rangos y logros son parte del videojuego: no son títulos ni certificados académicos.'));
      },
      logros: () => { const rows = h('div', 'rows'); ACHIEVEMENTS.forEach(a => { const on = s.achievements.includes(a.id), r = h('div', 'rowi'), ic = h('span', 'rowi__icon' + (on ? '' : ' is-off')); ic.append(icon(on ? 'trophy' : 'lock')); const c = h('div', 'rowi__copy'); c.append(h('strong', null, a.name), h('span', null, a.text)); r.append(ic, c, h('span', 'pill ' + (on ? 'pill--ok' : 'pill--soon'), on ? 'Obtenido' : 'Pendiente')); rows.append(r); }); body.append(rows); },
      movimientos: () => {
        const rows = h('div', 'rows'); const led = [...s.economy.ledger].reverse();
        if (!led.length) rows.append(h('p', 'note', 'Todavía no hay movimientos. Completa el tutorial o una misión.'));
        led.forEach(e => { const r = h('div', 'rowi'), ic = h('span', 'rowi__icon'); ic.append(icon('coin')); const c = h('div', 'rowi__copy'); c.append(h('strong', null, e.reason || e.key), h('span', null, new Date(e.at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }))); r.append(ic, c, h('span', 'pill pill--gold', '+' + e.amount)); rows.append(r); });
        body.append(rows, h('p', 'note', 'Estos son créditos de prueba del prototipo, guardados solo en este dispositivo. No forman parte de tu cartera ICADEM.'));
      }
    };
    const show = id => { tabs.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.id === id)); body.replaceChildren(); views[id](); };
    [['resumen', 'Resumen'], ['logros', 'Logros'], ['movimientos', 'Movimientos']].forEach(([id, t]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.id = id; b.addEventListener('click', () => show(id)); tabs.append(b); });
    wrap.append(tabs, body); show(views[tab] ? tab : 'resumen');
    return this.modal({ eyebrow: 'Pasaporte', title: this.api.playerName, content: wrap });
  }

  /* ---------- tablero de misiones ---------- */
  openMissions() {
    if (this.isBlocking) return;
    const s = this.api.store.state, rows = h('div', 'rows');
    GAMES.forEach(gm => {
      const rec = gm.missionId ? s.missions[gm.missionId] : null, r = h('div', 'rowi'), ic = h('span', 'rowi__icon' + (gm.ready ? '' : ' is-off'));
      ic.append(gm.ready ? icon(rec?.completed ? 'check' : 'pin') : icon('lock'));
      const c = h('div', 'rowi__copy'); c.append(h('strong', null, `${gm.n}. ${gm.mission}`), h('span', null, gm.name + (rec?.completed ? ` · mejor puntuación ${rec.bestScore}` : gm.ready ? ` · +${REWARDS[gm.missionId].amount} créditos de prueba` : '')));
      r.append(ic, c);
      if (gm.ready) { const go = h('button', 'btn btn--primary', 'Ir'); go.type = 'button'; go.addEventListener('click', () => { const b = BUILDINGS.find(x => x.id === gm.id), p = doorPoint(b, 2.2); this.api.setWaypoint({ x: p.x, z: p.z, name: b.name }); this.toast('Destino marcado: ' + b.name + '. Sal por la puerta.'); document.getElementById('modal-x').click(); }); r.append(go); }
      else r.append(h('span', 'pill pill--soon', 'Próximamente'));
      rows.append(r);
    });
    const wrap = h('div'); wrap.append(rows, h('p', 'note', 'En esta fase está jugable la misión 1. Las otras nueve ya tienen su edificio en la ciudad y se irán activando una por una.'));
    return this.modal({ eyebrow: 'Escritorio de misiones', title: 'Las diez misiones', content: wrap });
  }

  /* ---------- armario ---------- */
  openWardrobe() {
    if (this.isBlocking) return;
    const current = avatarById(this.api.store.state.avatarId), rows = h('div', 'rows');
    AVATARS.forEach(a => {
      const r = h('div', 'rowi'), sw = h('span', 'swatch'); sw.style.background = '#' + a.look.top.toString(16).padStart(6, '0');
      const c = h('div', 'rowi__copy'); c.append(h('strong', null, a.name), h('span', null, 'Ruta: ' + a.route));
      r.append(sw, c, h('span', 'pill ' + (a.id === current.id ? 'pill--ok' : 'pill--soon'), a.id === current.id ? 'Puesto' : 'Fase 4'));
      rows.append(r);
    });
    const wrap = h('div'); wrap.append(rows, h('p', 'note', 'El Explorador es gratuito y es el avatar de esta fase. Los otros nueve se podrán conseguir con créditos o logros cuando se active la tienda; ninguno da ventaja en el juego.'));
    return this.modal({ eyebrow: 'Armario', title: 'Tus avatares', content: wrap });
  }

  /* ---------- ajustes ---------- */
  openSettings() {
    if (this.isBlocking) return;
    const api = this.api, st = api.store.state.settings, wrap = h('div');
    const field = (label, node) => { const f = h('label', 'field'); f.append(h('span', null, label), node); return f; };
    const seg = h('div', 'seg');
    [['auto', 'Automática'], ['low', QUALITY.low.label], ['medium', QUALITY.medium.label], ['high', QUALITY.high.label]].forEach(([id, t]) => { const b = h('button', st.quality === id ? 'is-on' : '', t); b.type = 'button'; b.addEventListener('click', () => { st.quality = id; api.store.save(); api.applySettings(); seg.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); }); seg.append(b); });
    const sens = h('input'); sens.type = 'range'; sens.min = '0.4'; sens.max = '2'; sens.step = '0.1'; sens.value = String(st.sensitivity);
    sens.addEventListener('input', () => { st.sensitivity = Number(sens.value); api.store.save(); api.applySettings(); });
    const inv = h('div', 'seg'); [[false, 'Normal'], [true, 'Invertida']].forEach(([v, t]) => { const b = h('button', st.invertY === v ? 'is-on' : '', t); b.type = 'button'; b.addEventListener('click', () => { st.invertY = v; api.store.save(); api.applySettings(); inv.querySelectorAll('button').forEach(o => o.classList.toggle('is-on', o === b)); }); inv.append(b); });
    const keys = h('dl', 'keys');
    (document.documentElement.classList.contains('is-touch')
      ? [['Mover', 'Arrastra en la parte izquierda de la pantalla'], ['Cámara', 'Arrastra en el resto de la pantalla'], ['Interactuar', 'Botón amarillo que aparece al acercarte'], ['Saltar / correr', 'Botones de la derecha']]
      : [['W A S D', 'Mover (también flechas)'], ['Mouse', 'Arrastra para girar la cámara; rueda para acercar'], ['E', 'Interactuar'], ['Espacio', 'Saltar'], ['Shift', 'Correr'], ['M', 'Mapa']]
    ).forEach(([k, v]) => keys.append(h('dt', null, k), h('dd', null, v)));
    const tut = h('button', 'btn', 'Repetir tutorial'); tut.type = 'button'; tut.addEventListener('click', () => { document.getElementById('modal-x').click(); api.startTutorial(true); });
    const reset = h('button', 'btn', 'Borrar datos de prueba'); reset.type = 'button'; reset.addEventListener('click', () => { if (reset.dataset.sure) { api.store.reset(); location.reload(); } else { reset.dataset.sure = '1'; reset.textContent = 'Toca otra vez para confirmar'; } });
    const acts = h('div', 'seg'); acts.append(tut, reset);
    wrap.append(field('Calidad gráfica', seg), field('Sensibilidad de la cámara', sens), field('Cámara vertical', inv), field('Controles', keys), acts,
      h('p', 'note', `Calidad activa: ${QUALITY[api.engine.quality].label} · ${api.engine.fps || '—'} cuadros por segundo. El progreso del prototipo se guarda solo en este dispositivo.`));
    return this.modal({ eyebrow: 'Ajustes', title: 'Juego y controles', content: wrap });
  }
}
