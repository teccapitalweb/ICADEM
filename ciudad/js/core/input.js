// Entrada unificada: teclado + mouse en computadora, joystick y arrastre táctil en celular.

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run'
};
const PRESS_MAP = { Space: 'jump', KeyE: 'interact', Enter: 'interact', KeyM: 'map', Escape: 'back', KeyP: 'passport' };

/** Detección de pantalla táctil que no depende de una sola señal (algunos navegadores incrustados fallan en `pointer: coarse`). */
export function isTouchDevice() {
  try {
    if (matchMedia('(pointer: coarse)').matches) return true;
    if ((navigator.maxTouchPoints || 0) > 0 && !matchMedia('(hover: hover)').matches) return true;
    return 'ontouchstart' in window && Math.min(screen.width, screen.height) < 820;
  } catch (_) { return false; }
}

export class Input {
  constructor(canvas, els) {
    this.canvas = canvas;
    this.enabled = true;
    this.keys = new Set();
    this.presses = new Set();
    this.move = { x: 0, z: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.runToggle = false;
    this.touch = isTouchDevice();
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookPointer = null;
    this.els = els || {};
    this.#bindKeyboard();
    this.#bindPointer();
  }

  #bindKeyboard() {
    addEventListener('keydown', e => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select')) return;
      if (PRESS_MAP[e.code]) {
        if (!e.repeat) this.presses.add(PRESS_MAP[e.code]);
        if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
      }
      if (KEY_MAP[e.code]) { this.keys.add(KEY_MAP[e.code]); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    });
    addEventListener('keyup', e => { if (KEY_MAP[e.code]) this.keys.delete(KEY_MAP[e.code]); });
    addEventListener('blur', () => { this.keys.clear(); this.#releaseStick(); });
  }

  #bindPointer() {
    const c = this.canvas;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch') {
        this.touch = true;
        document.documentElement.classList.add('is-touch');
        const r = c.getBoundingClientRect();
        const inStickZone = (e.clientX - r.left) < r.width * 0.42 && (e.clientY - r.top) > r.height * 0.35;
        if (inStickZone && this.stick.id === null) {
          this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
          this.#drawStick(e.clientX - r.left, e.clientY - r.top, 0, 0, true);
        } else if (this.lookPointer === null) {
          this.lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }
      } else {
        this.lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
        c.classList.add('is-dragging');
      }
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
    });
    c.addEventListener('pointermove', e => {
      if (this.stick.id === e.pointerId) {
        const max = 56;
        let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
        const len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        this.stick.x = dx / max; this.stick.y = dy / max;
        const r = c.getBoundingClientRect();
        this.#drawStick(this.stick.ox - r.left, this.stick.oy - r.top, dx, dy, true);
      } else if (this.lookPointer && this.lookPointer.id === e.pointerId) {
        const k = e.pointerType === 'touch' ? 1.5 : 1;
        this.look.dx += (e.clientX - this.lookPointer.x) * k;
        this.look.dy += (e.clientY - this.lookPointer.y) * k;
        this.lookPointer.x = e.clientX; this.lookPointer.y = e.clientY;
      }
    });
    const end = e => {
      if (this.stick.id === e.pointerId) this.#releaseStick();
      if (this.lookPointer && this.lookPointer.id === e.pointerId) { this.lookPointer = null; c.classList.remove('is-dragging'); }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', e => { if (this.enabled) { this.zoom += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
  }

  #releaseStick() {
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.#drawStick(0, 0, 0, 0, false);
  }

  #drawStick(x, y, dx, dy, visible) {
    const base = this.els.stick, knob = this.els.knob;
    if (!base || !knob) return;
    base.classList.toggle('is-on', visible);
    if (visible) { base.style.left = x + 'px'; base.style.top = y + 'px'; knob.style.transform = `translate(${dx}px, ${dy}px)`; }
  }

  /** Botones en pantalla (saltar, interactuar, correr). */
  press(name) { if (this.enabled) this.presses.add(name); }
  toggleRun() { this.runToggle = !this.runToggle; return this.runToggle; }

  /** Llamar una vez por cuadro. */
  update() {
    let x = 0, z = 0;
    if (this.enabled) {
      if (this.keys.has('left')) x -= 1;
      if (this.keys.has('right')) x += 1;
      if (this.keys.has('up')) z += 1;
      if (this.keys.has('down')) z -= 1;
      if (this.stick.id !== null) { x += this.stick.x; z -= this.stick.y; }
    }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    this.move.x = x; this.move.z = z;
  }

  get running() { return this.enabled && (this.keys.has('run') || this.runToggle || (this.stick.id !== null && Math.hypot(this.stick.x, this.stick.y) > 0.92)); }

  consume(name) { if (this.presses.has(name)) { this.presses.delete(name); return true; } return false; }

  consumeLook() { const l = { dx: this.look.dx, dy: this.look.dy }; this.look.dx = 0; this.look.dy = 0; return l; }

  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.keys.clear(); this.presses.clear(); this.#releaseStick(); this.lookPointer = null; this.look.dx = 0; this.look.dy = 0; }
  }
}
