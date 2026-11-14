// Jugadores remotos: avatares de OTROS usuarios reales conectados a la misma instancia.
// Solo existen si el servidor los envía; aquí nunca se inventa ni se simula a nadie.
// El movimiento se dibuja ~150 ms en el pasado, interpolando entre dos estados recibidos,
// para que se vea fluido aunque la red entregue 10 estados por segundo.
import { createAvatar } from './avatar.js';
import { avatarById } from './catalog.js';
import { decodeState } from '../net/network.js';
import { applyCustom } from '../progress/rules.js';
import { PetCompanion } from '../pets/pet-companion.js';
import { breedById } from '../pets/pet-catalog.js';
import { createPetModel } from '../pets/pet-model.js';
import { MOUNT_BREED } from '../vivo/flight.js';
import { MOUNT_SCALE, RIDE_Y } from '../vivo/mounts.js';

/** Mascotas de otros jugadores que se dibujan a la vez (las demás no se muestran, por rendimiento). */
export const MAX_REMOTE_PETS = 6;

const DELAY = 0.15, TAU = Math.PI * 2, EMOTES = new Set(['wave', 'celebrate', 'interact', 'beckon', 'clap', 'point', 'help']);
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export class RemotePlayers {
  constructor(parent, net) {
    this.parent = parent; this.net = net; this.map = new Map(); this.clock = 0; this.last = 0; this.scene = null;
    net.on('snap', list => this.#snap(list));
    net.on('leave', ({ pid }) => this.#drop(pid));
    net.on('look', ({ pid }) => this.#drop(pid));   // se vuelve a crear con su nueva apariencia en la siguiente fotografía
    net.on('pet', ({ pid, pet }) => { const r = this.map.get(pid); if (r) this.#pet(r, pet); });
    this.getScene = () => null;   // main.js lo conecta con el escenario actual (colisiones de las mascotas)
  }

  /** Mascota que acompaña a un jugador remoto: solo apariencia; su movimiento se calcula aquí. */
  #pet(r, pet) {
    r.pet?.dispose(); r.pet = null; r.avatar.setHold?.(false);
    if (!pet || !breedById(pet.breed) || [...this.map.values()].filter(x => x.pet).length >= MAX_REMOTE_PETS) return;
    const owner = { position: r.avatar.group.position, get yaw() { return r.yaw; }, get speed() { return r.speed; },
      hand: () => r.avatar.hand.getWorldPosition(r.handV || (r.handV = r.avatar.group.position.clone())), shoulder: () => r.avatar.perch.getWorldPosition(r.perchV || (r.perchV = r.avatar.group.position.clone())) };
    r.pet = new PetCompanion({ breed: pet.breed, acc: pet.acc || {}, owner, env: { parent: this.parent, scene: () => this.getScene(), sceneName: () => this.scene }, leash: pet.leash });
    r.avatar.setHold?.(r.pet.leashed);
  }

  setScene(name) { if (name !== this.scene) { this.scene = name; [...this.map.keys()].forEach(pid => this.#drop(pid)); } }

  #drop(pid) {
    const r = this.map.get(pid); if (!r) return;
    r.pet?.dispose(); r.pet = null;
    if (r.mount) { this.parent.remove(r.mount.group); r.mount.dispose(); r.mount = null; }
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
        r = { pid, avatar, samples: [], speed: 0, x: s.x, y: s.y, z: s.z, yaw: s.yaw, pet: null };
        this.map.set(pid, r);
        if (info.pet) this.#pet(r, info.pet);
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
      // montado en su dragón: se dibuja el dragón bajo el avatar (y su mascota-dragón no se duplica)
      const riding = anim === 'ride';
      if (riding && !r.mount) { r.mount = createPetModel(MOUNT_BREED, (this.net.roster.get(r.pid)?.pet?.breed === MOUNT_BREED && this.net.roster.get(r.pid).pet.acc) || {}); r.mount.group.scale.setScalar(MOUNT_SCALE); this.parent.add(r.mount.group); }
      if (!riding && r.mount) { this.parent.remove(r.mount.group); r.mount.dispose(); r.mount = null; if (r.pet) r.pet.place(); }
      if (r.mount) { r.mount.group.position.set(x, Math.max(0, y - RIDE_Y * MOUNT_SCALE), z); r.mount.group.rotation.y = r.yaw; r.mount.update(dt, { speed: r.speed, action: y > 2 ? 'fly' : null, air: y }); }
      r.avatar.update(dt, { speed: riding ? 0 : (r.speed < 0.3 ? 0 : r.speed), grounded: riding || y < 0.05, sitting: anim === 'sit' || riding });
      if (r.pet) { if (riding && r.pet.breed.id === MOUNT_BREED) { r.pet.group.visible = false; if (r.pet.leash) r.pet.leash.visible = false; } else r.pet.update(dt); }
    }
  }

  /** Posición de la cabeza de un jugador remoto (para su nombre y sus burbujas). */
  head(pid) { const r = this.map.get(pid); return r ? { x: r.x, y: r.y + 2.05, z: r.z } : null; }
  get count() { return this.map.size; }
}
