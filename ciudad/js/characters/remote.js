// Jugadores remotos: avatares de OTROS usuarios reales conectados a la misma instancia.
// Solo existen si el servidor los envía; aquí nunca se inventa ni se simula a nadie.
// El movimiento se dibuja ~150 ms en el pasado, interpolando entre dos estados recibidos,
// para que se vea fluido aunque la red entregue 10 estados por segundo.
import { createAvatar } from './avatar.js';
import { avatarById } from './catalog.js';
import { decodeState } from '../net/network.js';
import { applyCustom } from '../progress/rules.js';

const DELAY = 0.15, TAU = Math.PI * 2, EMOTES = new Set(['wave', 'celebrate', 'interact', 'beckon', 'clap', 'point', 'help']);
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export class RemotePlayers {
  constructor(parent, net) {
    this.parent = parent; this.net = net; this.map = new Map(); this.clock = 0; this.last = 0; this.scene = null;
    net.on('snap', list => this.#snap(list));
    net.on('leave', ({ pid }) => this.#drop(pid));
    net.on('look', ({ pid }) => this.#drop(pid));   // se vuelve a crear con su nueva apariencia en la siguiente fotografía
  }

  setScene(name) { if (name !== this.scene) { this.scene = name; [...this.map.keys()].forEach(pid => this.#drop(pid)); } }

  #drop(pid) {
    const r = this.map.get(pid); if (!r) return;
    this.parent.remove(r.avatar.group);
    r.avatar.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.map.delete(pid);
  }

  #snap(list) {
    const seen = new Set();
    for (const [pid, encoded] of list) {
      const s = decodeState(encoded); if (!s || s.scene !== this.scene) continue;
      seen.add(pid);
      let r = this.map.get(pid);
      if (!r) {
        const info = this.net.roster.get(pid) || {};
        const avatar = createAvatar(applyCustom(avatarById(info.avatar).look, info.custom));
        avatar.group.userData.dynamic = true; avatar.group.position.set(s.x, s.y, s.z); avatar.group.rotation.y = s.yaw;
        this.parent.add(avatar.group);
        r = { pid, avatar, samples: [], speed: 0, x: s.x, y: s.y, z: s.z, yaw: s.yaw };
        this.map.set(pid, r);
      }
      r.samples.push({ t: performance.now() / 1000, ...s });
      if (r.samples.length > 12) r.samples.shift();
    }
    // Quien ya no viene en la fotografía cambió de escenario o salió del alcance.
    for (const pid of [...this.map.keys()]) if (!seen.has(pid)) this.#drop(pid);
  }

  update(dt) {
    // Reloj real (no el del dibujo): si el equipo va lento, los demás jugadores no se retrasan.
    const now = performance.now() / 1000, real = this.last ? Math.min(0.5, Math.max(1e-3, now - this.last)) : dt;
    this.last = now; this.clock = now;
    const at = this.clock - DELAY;
    for (const r of this.map.values()) {
      const q = r.samples; let a = q[0], b = q[q.length - 1];
      for (let i = q.length - 1; i > 0; i--) if (q[i - 1].t <= at) { a = q[i - 1]; b = q[i]; break; }
      const span = Math.max(1e-3, b.t - a.t), k = Math.max(0, Math.min(1, (at - a.t) / span));
      const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, z = a.z + (b.z - a.z) * k;
      const moved = Math.hypot(x - r.x, z - r.z);
      r.speed += (moved / real - r.speed) * Math.min(1, real * 10);
      r.x = x; r.y = y; r.z = z; r.yaw += angleDelta(r.yaw, a.yaw + angleDelta(a.yaw, b.yaw) * k) * Math.min(1, real * 14);
      r.avatar.group.position.set(x, y, z); r.avatar.group.rotation.y = r.yaw;
      const anim = b.anim;
      if (EMOTES.has(anim) && r.avatar.emote !== anim) r.avatar.playEmote(anim, 0.6);
      r.avatar.update(dt, { speed: r.speed < 0.3 ? 0 : r.speed, grounded: y < 0.05, sitting: anim === 'sit' });
    }
  }

  /** Posición de la cabeza de un jugador remoto (para su nombre y sus burbujas). */
  head(pid) { const r = this.map.get(pid); return r ? { x: r.x, y: r.y + 2.05, z: r.z } : null; }
  get count() { return this.map.size; }
}
