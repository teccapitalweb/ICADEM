// Cámara en tercera persona con "brazo" retráctil.
//  · Orbita alrededor del jugador con giro suavizado (mouse o dedo).
//  · El brazo se acorta al instante si un edificio o el límite del interior quedaría entre la
//    cámara y el jugador, y vuelve a estirarse poco a poco: nunca queda dentro de un muro.
//  · Lo que sí queda en medio (árboles, columnas, muebles) se vuelve translúcido en el
//    sombreador de materiales (ver CUTOUT en world/kit.js).
import * as THREE from '../three.js';

const tmp = new THREE.Vector3();
const target = new THREE.Vector3();
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;          // 0 = la cámara mira hacia -Z (detrás de un jugador que mira a -Z)
    this.pitch = 0.42;
    this.distance = 6.5;   // distancia deseada (rueda del mouse)
    this.arm = 6.5;        // distancia real, ya ajustada por obstáculos
    this.armH = 6; this.armV = 2.6; // sus componentes horizontal y vertical
    this.minDistance = 2.4;
    this.maxDistance = 11;
    this.height = 1.45;
    this.sensitivity = 1;
    this.invertY = false;
    this.focus = new THREE.Vector3();
    this.turned = 0;       // giro acumulado, lo usa el tutorial
    this.box = null;       // límites del interior (la cámara no atraviesa paredes ni techo)
    this.world = null;     // colisiones de la escena: los edificios altos acortan el brazo
    this.override = null;  // { position, lookAt, t } para encuadres (espejo, diálogos)
    this.pending = { yaw: 0, pitch: 0 }; // giro pendiente de aplicar (suavizado)
    this.blocked = false;
    this.ease = 0;         // segundos de transición suave al volver de un encuadre
  }

  configure({ distance, minDistance, maxDistance, pitch, yaw, box, world }) {
    if (minDistance !== undefined) this.minDistance = minDistance;
    if (maxDistance !== undefined) this.maxDistance = maxDistance;
    if (distance !== undefined) this.distance = distance;
    if (pitch !== undefined) this.pitch = pitch;
    if (yaw !== undefined) this.yaw = yaw;
    this.box = box || null;
    this.world = world || null;
    this.pending.yaw = 0; this.pending.pitch = 0;
  }

  /** Dirección "adelante" de la cámara sobre el suelo. */
  forward(out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  snap(playerPos) {
    this.focus.set(playerPos.x, playerPos.y + this.height, playerPos.z);
    this.#settle();
    this.#place();
  }

  frame(position, lookAt, seconds = 2.2) { this.override = { position: position.clone(), lookAt: lookAt.clone(), t: seconds }; }
  release() { if (this.override) { this.override = null; this.ease = 0.7; this.#settle(); } }

  /**
   * Posición libre de la cámara para una distancia deseada: { h, v } = separación horizontal y
   * vertical respecto al foco. Si un muro o edificio limita la horizontal, la cámara sube
   * pegada al obstáculo (vista más cenital) en vez de meterse en el avatar.
   */
  reach(wanted) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ux = Math.sin(this.yaw), uz = Math.cos(this.yaw), f = this.focus;
    const H = Math.max(1e-4, cp * wanted);
    let h = H, v = sp * wanted, top = Infinity;
    if (this.box) {
      const b = this.box, margin = 0.2;
      if (ux > 1e-6) h = Math.min(h, (b.maxX - f.x) / ux - margin); else if (ux < -1e-6) h = Math.min(h, (b.minX - f.x) / ux - margin);
      if (uz > 1e-6) h = Math.min(h, (b.maxZ - f.z) / uz - margin); else if (uz < -1e-6) h = Math.min(h, (b.minZ - f.z) / uz - margin);
      if (b.maxY !== undefined) top = b.maxY - f.y - margin;
    }
    if (this.world && h > 0) {
      const t = this.world.segmentHit(f.x, f.z, f.x + ux * h, f.z + uz * h, k => f.y + v * (k * h / H));
      if (t < 1) h = h * t - 0.3;
    }
    h = Math.max(0.25, h);
    if (h < H - 1e-3) v = Math.sqrt(Math.max(v * v, wanted * wanted - h * h));
    v = Math.max(0, Math.min(v, top));
    return { h, v };
  }

  update(dt, playerPos, look, zoom) {
    const s = 0.0042 * this.sensitivity;
    // El giro se reparte en unos cuadros: quita el temblor del arrastre táctil sin sentirse lento.
    this.pending.yaw -= look.dx * s;
    this.pending.pitch += look.dy * s * (this.invertY ? -1 : 1);
    const k = damp(26, dt), stepYaw = this.pending.yaw * k, stepPitch = this.pending.pitch * k;
    this.pending.yaw -= stepYaw; this.pending.pitch -= stepPitch;
    this.yaw += stepYaw;
    this.pitch = Math.max(0.06, Math.min(1.25, this.pitch + stepPitch));
    this.turned += Math.abs(look.dx * s);
    if (zoom) this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + zoom * 0.7));

    // El foco sigue al jugador; en vertical más despacio para que un salto no sacuda la imagen.
    const kh = damp(16, dt), kv = damp(7, dt);
    this.focus.x += (playerPos.x - this.focus.x) * kh;
    this.focus.z += (playerPos.z - this.focus.z) * kh;
    this.focus.y += (playerPos.y + this.height - this.focus.y) * kv;

    if (this.override) {
      this.override.t -= dt;
      this.camera.position.lerp(this.override.position, damp(5, dt));
      target.lerp(this.override.lookAt, damp(6, dt));
      this.camera.lookAt(target);
      if (this.override.t <= 0) this.release();
      return;
    }

    const free = this.reach(this.distance);
    this.blocked = free.h < Math.cos(this.pitch) * this.distance - 0.05;
    if (free.h < this.armH) this.armH = free.h;                   // acercar: inmediato (nunca cruza el muro)
    else this.armH += (free.h - this.armH) * damp(4.5, dt);       // alejar: gradual
    this.armV += (free.v - this.armV) * damp(9, dt);
    this.arm = Math.hypot(this.armH, this.armV);
    this.#place(dt);
  }

  #place(dt = 0) {
    tmp.set(
      this.focus.x + Math.sin(this.yaw) * this.armH,
      Math.max(0.35, this.focus.y + this.armV),
      this.focus.z + Math.cos(this.yaw) * this.armH
    );
    if (this.ease > 0 && dt > 0) { this.ease -= dt; this.camera.position.lerp(tmp, damp(9, dt)); }
    else this.camera.position.copy(tmp);
    target.copy(this.focus);
    this.camera.lookAt(this.focus);
  }

  #settle() { const free = this.reach(this.distance); this.armH = free.h; this.armV = free.v; this.arm = Math.hypot(free.h, free.v); }
}
