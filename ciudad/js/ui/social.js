// Capa social: frases rápidas con gesto, burbujas sobre los avatares, nombres de los jugadores
// reales conectados, indicador de conexión y lista de jugadores con silenciar y reportar.
// No hay texto libre: solo la lista cerrada de social/phrases.js.
import * as THREE from '../three.js';
import { PHRASES, phraseById, createRateLimiter, SAY_RADIUS, BUBBLE_SECONDS } from '../social/phrases.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const v = new THREE.Vector3();

export class Social {
  constructor(api, remotes) {
    this.api = api; this.remotes = remotes; this.allow = createRateLimiter();
    this.bubbles = new Map();   // clave ('me' o pid) → { el, left }
    this.tags = new Map();      // pid → elemento con el nombre
    const hud = document.getElementById('hud');
    this.layer = h('div', 'social-layer'); this.layer.setAttribute('aria-hidden', 'true');
    this.button = h('button', 'say-btn'); this.button.type = 'button'; this.button.id = 'btn-say'; this.button.setAttribute('aria-label', 'Frases y gestos'); this.button.setAttribute('aria-expanded', 'false');
    this.button.append(h('span', 'say-btn__icon', '💬'), h('span', 'say-btn__text', 'Frases'), h('kbd', null, 'T'));
    this.menu = h('div', 'say-menu'); this.menu.id = 'say-menu'; this.menu.hidden = true;
    PHRASES.forEach((p, i) => { const b = h('button', null); b.type = 'button'; b.dataset.id = p.id; b.append(h('kbd', null, String(i + 1)), h('span', null, p.text)); b.addEventListener('click', () => { this.say(p.id); this.toggle(false); }); this.menu.append(b); });
    this.chip = h('button', 'net-chip'); this.chip.type = 'button'; this.chip.id = 'net-chip'; this.chip.hidden = true;
    this.chip.addEventListener('click', () => this.openPlayers());
    this.button.addEventListener('click', () => this.toggle());
    hud.append(this.layer, this.button, this.menu, this.chip);
    this.live = h('div', 'sr-only'); this.live.setAttribute('aria-live', 'polite'); hud.append(this.live);

    api.net.on('say', ({ pid, id }) => { if (this.muted.includes(pid)) return; const p = phraseById(id); if (p) { this.#bubble(pid, p.text); this.live.textContent = `${api.net.nameOf(pid)}: ${p.text}`; } });
    api.net.on('status', s => this.#status(s));
    api.net.on('leave', ({ pid }) => { this.#clear(pid); });
    api.net.on('join', p => { if (api.net.isOnline && this.announce) api.ui.toast(`${p.name} entró a la ciudad.`, 2200); });
    api.net.on('fix', () => {});
    this.announce = false; setTimeout(() => { this.announce = true; }, 2500);
  }

  get muted() { return this.api.store.state.settings.muted || []; }

  toggle(force) { const open = force ?? this.menu.hidden; this.menu.hidden = !open; this.button.setAttribute('aria-expanded', String(open)); }

  /** Frase por número (teclas 1–6). */
  sayIndex(i) { const p = PHRASES[i]; if (p) this.say(p.id); }

  say(id) {
    const p = phraseById(id), api = this.api; if (!p || api.ui.isBlocking) return false;
    if (!this.allow(performance.now())) { api.ui.toast('Espera un momento antes de enviar otra frase.', 1800); return false; }
    api.player.emote(p.emote, 1.9);
    this.#bubble('me', p.text);
    api.net.say(id);   // sin conexión no hace nada: la burbuja solo la ves tú
    return true;
  }

  #bubble(key, text) {
    let b = this.bubbles.get(key);
    if (!b) { b = { el: h('div', 'bubble' + (key === 'me' ? ' bubble--me' : '')), left: 0 }; this.layer.append(b.el); this.bubbles.set(key, b); }
    b.el.textContent = text; b.left = BUBBLE_SECONDS; b.el.classList.remove('is-in'); void b.el.offsetWidth; b.el.classList.add('is-in');
  }

  #clear(pid) { const b = this.bubbles.get(pid); if (b) { b.el.remove(); this.bubbles.delete(pid); } const t = this.tags.get(pid); if (t) { t.remove(); this.tags.delete(pid); } }

  #status(s) {
    const online = s.status === 'online';
    this.chip.hidden = false;
    this.chip.className = 'net-chip is-' + s.status;
    const others = this.api.net.roster ? this.api.net.roster.size : 0;
    this.chip.textContent = online ? `En línea · ${others + 1} ${others ? 'jugadores' : 'jugador'}${s.latency != null ? ` · ${s.latency} ms` : ''}`
      : s.status === 'closed' ? (s.detail === 'sesion-en-otro-lugar' ? 'Sesión abierta en otro dispositivo' : 'Sin conexión') : s.status === 'connecting' ? 'Conectando…' : 'Reconectando…';
    if (s.status !== this.lastStatus) {
      if (this.lastStatus === 'online' && s.status === 'reconnecting') this.api.ui.toast('Se perdió la conexión. Reconectando…', 2600);
      if (this.lastStatus === 'reconnecting' && online) this.api.ui.toast('Conexión recuperada.', 2200);
      this.lastStatus = s.status;
    }
  }

  /** Lista de jugadores de la instancia, con silenciar y reportar. */
  openPlayers() {
    const api = this.api, net = api.net, wrap = h('div', 'players');
    const row = (name, note) => { const r = h('div', 'players__row'); const who = h('div', 'players__who'); who.append(h('strong', null, name)); if (note) who.append(h('small', null, note)); r.append(who); return r; };
    wrap.append(row(api.playerName, 'Tú'));
    const list = [...(net.roster ? net.roster.values() : [])];
    for (const p of list) {
      const r = row(p.name, this.muted.includes(p.pid) ? 'Silenciado' : 'Jugador conectado');
      const mute = h('button', 'btn', this.muted.includes(p.pid) ? 'Quitar silencio' : 'Silenciar'); mute.type = 'button';
      mute.addEventListener('click', () => {
        const s = api.store.state.settings, set = new Set(s.muted || []);
        if (set.has(p.pid)) set.delete(p.pid); else { set.add(p.pid); this.#clear(p.pid); }
        s.muted = [...set]; api.store.save();
        mute.textContent = set.has(p.pid) ? 'Quitar silencio' : 'Silenciar'; r.querySelector('small').textContent = set.has(p.pid) ? 'Silenciado' : 'Jugador conectado';
      });
      const rep = h('button', 'btn', 'Reportar'); rep.type = 'button';
      rep.addEventListener('click', () => { if (net.report && net.report(p.pid, 'conducta')) { rep.disabled = true; rep.textContent = 'Reportado'; api.ui.toast('Reporte enviado a moderación.'); } });
      r.append(mute, rep); wrap.append(r);
    }
    if (!list.length) wrap.append(h('p', 'players__empty', 'Por ahora no hay otros jugadores en tu instancia.'));
    wrap.append(h('p', 'players__note', 'Aquí solo aparecen personas reales conectadas. Entre jugadores solo se pueden enviar frases predefinidas.'));
    return api.ui.modal({ eyebrow: net.instance ? 'Instancia ' + net.instance : 'Jugadores', title: 'Jugadores conectados', content: wrap });
  }

  #project(x, y, z, el) {
    const cam = this.api.engine.camera;
    v.set(x, y, z);
    const dist = v.distanceTo(cam.position);
    v.project(cam);
    const show = v.z > -1 && v.z < 1 && dist < SAY_RADIUS + 6;
    el.style.display = show ? '' : 'none';
    if (show) el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px)`;
  }

  update(dt) {
    const api = this.api, p = api.player.position;
    // nombres de los jugadores remotos visibles
    for (const pid of this.tags.keys()) if (!this.remotes.head(pid)) this.#clear(pid);
    for (const r of this.remotes.map.values()) {
      let tag = this.tags.get(r.pid);
      if (!tag) { tag = h('div', 'nametag', api.net.nameOf(r.pid)); this.layer.append(tag); this.tags.set(r.pid, tag); }
      const head = this.remotes.head(r.pid); this.#project(head.x, head.y, head.z, tag);
    }
    for (const [key, b] of this.bubbles) {
      b.left -= dt;
      if (b.left <= 0) { b.el.remove(); this.bubbles.delete(key); continue; }
      b.el.classList.toggle('is-out', b.left < 0.4);
      const head = key === 'me' ? { x: p.x, y: p.y + 2.2, z: p.z } : this.remotes.head(key);
      if (!head) { b.el.style.display = 'none'; continue; }
      this.#project(head.x, head.y + (key === 'me' ? 0 : 0.34), head.z, b.el);
    }
  }
}
