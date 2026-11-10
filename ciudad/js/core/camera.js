// Cámara en tercera persona: orbita alrededor del jugador y lo sigue con suavizado.
import * as THREE from '../three.js';

const tmp = new THREE.Vector3();
const target = new THREE.Vector3();

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;          // 0 = la cámara mira hacia -Z (detrás de un jugador que mira a -Z)
    this.pitch = 0.42;
    this.distance = 6.5;
    this.minDistance = 2.4;
    this.maxDistance = 11;
    this.height = 1.45;
    this.sensitivity = 1;
    this.invertY = false;
    this.focus = new THREE.Vector3();
    this.turned = 0;       // giro acumulado, lo usa el tutorial
    this.box = null;       // límites del interior (la cámara no atraviesa paredes ni techo)
    this.override = null;  // { position, lookAt, t } para encuadres (espejo, diálogos)
  }

  configure({ distance, minDistance, maxDistance, pitch, yaw, box }) {
    if (minDistance !== undefined) this.minDistance = minDistance;
    if (maxDistance !== undefined) this.maxDistance = maxDistance;
    if (distance !== undefined) this.distance = distance;
    if (pitch !== undefined) this.pitch = pitch;
    if (yaw !== undefined) this.yaw = yaw;
    this.box = box || null;
  }

  /** Dirección "adelante" de la cámara sobre el suelo. */
  forward(out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  snap(playerPos) {
    this.focus.set(playerPos.x, playerPos.y + this.height, playerPos.z);
    this.#place(1);
  }

  frame(position, lookAt, seconds = 2.2) { this.override = { position: position.clone(), lookAt: lookAt.clone(), t: seconds }; }
  release() { this.override = null; }

  update(dt, playerPos, look, zoom) {
    const s = 0.0042 * this.sensitivity;
    this.yaw -= look.dx * s;
    this.pitch += look.dy * s * (this.invertY ? -1 : 1);
    this.pitch = Math.max(0.06, Math.min(1.25, this.pitch));
    this.turned += Math.abs(look.dx * s);
    if (zoom) this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + zoom * 0.7));

    tmp.set(playerPos.x, playerPos.y + this.height, playerPos.z);
    this.focus.lerp(tmp, 1 - Math.exp(-dt * 14));

    if (this.override) {
      this.override.t -= dt;
      this.camera.position.lerp(this.override.position, 1 - Math.exp(-dt * 5));
      target.lerp(this.override.lookAt, 1 - Math.exp(-dt * 6));
      this.camera.lookAt(target);
      if (this.override.t <= 0) this.override = null;
      return;
    }
    this.#place(1 - Math.exp(-dt * 12));
  }

  #place(alpha) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let d = this.distance;
    let x = this.focus.x + Math.sin(this.yaw) * cp * d;
    let y = this.focus.y + sp * d;
    let z = this.focus.z + Math.cos(this.yaw) * cp * d;
    if (this.box) {
      // Acerca la cámara hasta que quede dentro del cuarto.
      const b = this.box;
      for (let i = 0; i < 12 && (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || y > b.maxY); i++) {
        d *= 0.86;
        x = this.focus.x + Math.sin(this.yaw) * cp * d;
        y = this.focus.y + sp * d;
        z = this.focus.z + Math.cos(this.yaw) * cp * d;
      }
    }
    tmp.set(x, Math.max(0.35, y), z);
    this.camera.position.lerp(tmp, alpha);
    target.copy(this.focus);
    this.camera.lookAt(this.focus);
  }
}
