// Personajes no jugables: de pie, sentados o caminando una ruta. Voltean a ver al jugador cuando se acerca.
import { createAvatar } from './avatar.js';

const TAU = Math.PI * 2;
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export class Npc {
  /**
   * @param {object} o { look, x, z, yaw, sitting, seatY, route:[[x,z],...], speed, pause }
   */
  constructor(o) {
    this.avatar = createAvatar(o.look);
    this.group = this.avatar.group;
    this.group.userData.dynamic = true;
    this.sitting = Boolean(o.sitting);
    this.baseYaw = o.yaw || 0;
    this.yaw = this.baseYaw;
    this.route = o.route || null;
    this.speed = o.speed || 1.25;
    this.pause = o.pause ?? 1.5;
    this.wait = 0;
    this.leg = 0;
    this.moving = 0;
    this.talking = false;
    this.group.position.set(o.x, o.seatY || 0, o.z);
    this.group.rotation.y = this.yaw;
    if (this.route) { this.group.position.set(this.route[0][0], 0, this.route[0][1]); this.leg = 1 % this.route.length; }
  }

  update(dt, playerPos) {
    const p = this.group.position;
    let speed = 0, headYaw = 0;
    const dx = playerPos ? playerPos.x - p.x : 99, dz = playerPos ? playerPos.z - p.z : 99;
    const near = dx * dx + dz * dz < 12;
    if (this.approach) {
      // Se acerca al jugador para proponerle un reto: camina hasta quedar a distancia de plática,
      // rodeando obstáculos con el mundo de colisiones del escenario.
      const a = this.approach, ex = a.x - p.x, ez = a.z - p.z, d = Math.hypot(ex, ez);
      if (d > a.stop) {
        // Si una banca, un poste o una pared le cierra el paso, prueba desviarse hacia el mismo lado
        // (sin titubear de izquierda a derecha) hasta encontrar por dónde avanzar.
        const step = Math.min(d - a.stop, this.speed * 1.25 * dt), base = Math.atan2(ex, ez), side = a.side || 1;
        let best = null;
        for (const off of [0, side * 0.6, side * 1.2, side * 1.75, -side * 0.6, -side * 1.2, -side * 1.75]) {
          let nx = p.x + Math.sin(base + off) * step, nz = p.z + Math.cos(base + off) * step;
          if (a.collision) { const r = a.collision.resolve(nx, nz, 0.35); nx = r.x; nz = r.z; }
          const moved = Math.hypot(nx - p.x, nz - p.z), gain = d - Math.hypot(a.x - nx, a.z - nz);
          if (!best || moved > best.moved + 1e-4) best = { nx, nz, moved, off };
          // de frente solo si de verdad acerca; desviado basta con poder avanzar
          if (off === 0 ? gain >= step * 0.5 : moved >= step * 0.6) { best = { nx, nz, moved, off }; break; }
        }
        if (best.off && !a.side) a.side = Math.sign(best.off);   // elige un lado y lo sostiene
        a.moved = best.moved; a.stuck = best.moved < step * 0.2 ? (a.stuck || 0) + dt : 0;
        p.x = best.nx; p.z = best.nz; speed = best.moved > 1e-3 ? this.speed * 1.25 : 0;
        this.yaw += angleDelta(this.yaw, base + best.off) * Math.min(1, dt * 7);
      } else { a.arrived = true; a.moved = 0; a.stuck = 0; this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6); }
    } else if (this.route && !this.talking) {
      if (this.wait > 0) this.wait -= dt;
      else {
        const [tx, tz] = this.route[this.leg];
        const ex = tx - p.x, ez = tz - p.z, d = Math.hypot(ex, ez);
        if (d < 0.15) { this.leg = (this.leg + 1) % this.route.length; this.wait = this.pause; }
        else {
          const step = Math.min(d, this.speed * dt);
          p.x += ex / d * step; p.z += ez / d * step; speed = this.speed;
          this.yaw += angleDelta(this.yaw, Math.atan2(ex, ez)) * Math.min(1, dt * 7);
        }
      }
    } else if (near && !this.sitting) {
      this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 4);
    } else if (!this.route) {
      this.yaw += angleDelta(this.yaw, this.baseYaw) * Math.min(1, dt * 2);
    }
    if (near && this.sitting) headYaw = Math.max(-0.9, Math.min(0.9, angleDelta(this.yaw, Math.atan2(dx, dz))));
    this.group.rotation.y = this.yaw;
    if (this.talking && this.avatar.emote !== 'talk') this.avatar.playEmote('talk', 0.6);
    this.avatar.update(dt, { speed, grounded: true, sitting: this.sitting, lookYaw: headYaw });
  }
}
