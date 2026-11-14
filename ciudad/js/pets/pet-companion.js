// Ciudad ICADEM 2.0 · comportamiento de una mascota que acompaña a un jugador (propio o remoto).
//
// Sigue al dueño sin atravesar paredes (usa las colisiones del escenario), se sienta, explora,
// duerme, juega con la pelota y reacciona a lo que pasa. Las aves vuelan a un lado (sin tapar la
// cámara) y se posan en el hombro; el dragoncito flota; el gran dragón camina detrás y espera fuera
// de los interiores. Si se queda atrás o atrapada, reaparece de forma discreta junto al dueño.
// Todo es local y visual: la mascota no da ventajas y su posición no se envía por la red.
import * as THREE from '../three.js';
import { createPetModel } from './pet-model.js';
import { PET_SCENES, breedById } from './pet-catalog.js';
import { groundHeight } from '../core/platforms.js';

const TAU = Math.PI * 2;
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const INDOOR = new Set(['room', 'casa', 'vet']);
export const LEASH_LENGTH = 2.2;

/** Bolita para jugar: vuela con un arco y rebota; la mascota la trae de vuelta. */
const BALL_GEO = new THREE.SphereGeometry(0.075, 12, 10), BALL_MAT = new THREE.MeshStandardMaterial({ color: 0xd9ff3d, roughness: 0.6 });
BALL_GEO.userData.shared = true; BALL_MAT.userData.shared = true;

export class PetCompanion {
  /**
   * owner: { position: Vector3, yaw, speed, hand?: () => Vector3 } (se lee en cada cuadro)
   * env:   { parent: Object3D, scene: () => escenario actual, sceneName: () => nombre }
   */
  constructor({ breed, acc = {}, owner, env, leash = false, local = false }) {
    this.breed = breedById(breed); this.acc = { ...acc }; this.owner = owner; this.env = env; this.local = local;
    this.model = createPetModel(breed, acc); this.group = this.model.group; env.parent.add(this.group);
    const sp = this.breed.species, form = this.breed.form;
    this.kind = sp === 'ave' ? 'bird' : form === 'dragon' ? (this.breed.mount ? 'bigdragon' : 'dragon') : 'quad';
    this.radius = this.kind === 'bigdragon' ? 0.75 : this.kind === 'bird' ? 0.12 : Math.max(0.18, 0.24 * this.breed.size);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.speed = 0; this.air = 0;
    this.action = null; this.actionT = 0; this.idleT = 0; this.wander = null; this.wanderT = 2 + Math.random() * 3;
    this.stuckT = 0; this.appear = 0; this.ball = null; this.carry = null; this.queue = [];
    this.perched = false; this.lastScene = null; this.lastOwnerSpeed = 0;
    this.leash = null; this.setLeash(leash);
    this.place(true);
  }

  get visible() { return this.group.visible; }
  get scene() { return this.env.sceneName(); }

  /** ¿Puede estar en este escenario? (el gran dragón espera afuera de los interiores). */
  allowed(name = this.scene) { return PET_SCENES.includes(name) && !(this.kind === 'bigdragon' && INDOOR.has(name)); }

  /** Coloca a la mascota junto al dueño (al entrar a un escenario o al reaparecer). */
  place(instant = false) {
    const o = this.owner, back = this.kind === 'bigdragon' ? 2.6 : 1.1, side = this.kind === 'bird' ? -0.6 : 0.55;
    const x = o.position.x - Math.sin(o.yaw) * back + Math.cos(o.yaw) * side, z = o.position.z - Math.cos(o.yaw) * back - Math.sin(o.yaw) * side;
    const s = this.env.scene(); const p = s && s.collision ? s.collision.resolve(x, z, this.radius) : { x, z };
    this.pos.set(p.x, this.ground(p.x, p.z), p.z); this.yaw = o.yaw; this.stuckT = 0; this.wander = null;
    if (!instant) this.appear = 0.001;
    this.sync();
  }
  ground(x, z) { const s = this.env.scene(); return s && s.platforms ? groundHeight(s.platforms, x, z, this.pos.y || 0) : 0; }

  setLeash(on) {
    on = Boolean(on && this.breed.species === 'perro' && this.acc.leash);
    if (on && !this.leash) {
      const color = { 'correa-roja': 0xe2483d, 'correa-azul': 0x2f6fd8, 'correa-verde': 0x2fa865, 'correa-morada': 0x8a5fd0, 'correa-reflejante': 0xd9ff3d, 'correa-arcoiris': 0xff7ab8 }[this.acc.leash] || 0x2f9e8f;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
      this.leash = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, linewidth: 2 })); this.leash.frustumCulled = false; this.leash.userData.dynamic = true;
      if (this.acc.leash === 'correa-arcoiris') { const c = new Float32Array(16 * 3), col = new THREE.Color(); for (let i = 0; i < 16; i++) { col.setHSL(i / 16, 0.8, 0.6); c.set([col.r, col.g, col.b], i * 3); } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); this.leash.material.vertexColors = true; this.leash.material.color.set(0xffffff); }
      this.env.parent.add(this.leash);
    } else if (!on && this.leash) { this.env.parent.remove(this.leash); this.leash.geometry.dispose(); this.leash.material.dispose(); this.leash = null; }
    this.leashed = on;
  }

  /* ---------- reacciones (las llama el juego) ---------- */
  react(kind) {
    const quad = this.kind === 'quad', cat = this.breed.species === 'gato', bird = this.kind === 'bird', dragon = this.kind !== 'quad' && !bird;
    const seq = {
      food: [['eat', 1.6], ['dance', 1.4]], cariño: quad ? [['wag', 1.6], ['jump', 0.7]] : [['dance', 1.2]], saludo: cat ? [['speak', 0.9], ['wag', 1.2]] : [['jump', 0.8], ['wag', 1.2]],
      mision: dragon ? [['dance', 1.2], ['fire', 1.4]] : [['dance', 1.6]], casa: [['wag', 1.4], ['jump', 0.6]], parque: quad && !cat ? [['play', 1.2], ['wag', 1]] : [['dance', 1]],
      correr: quad && !cat ? [['speak', 0.6]] : [], otra: quad ? [['wag', 1.2], ['speak', 0.5]] : [['speak', 0.8]], descanso: [['sit', 2]]
    }[kind] || [];
    if (!seq.length) return;
    this.queue = seq.slice(1); this.setAction(seq[0][0], seq[0][1]); this.idleT = 0; this.perched = false;
  }
  setAction(a, t) { this.action = a; this.actionT = t; }

  /** Lanza la pelota hacia donde mira el dueño (perros y fantásticos de cuatro patas). */
  throwBall() {
    if (this.kind !== 'quad' || this.breed.species === 'gato' || this.ball || !this.visible) return false;
    const o = this.owner, s = this.env.scene(), dist = 5 + Math.random() * 2;
    let tx = o.position.x + Math.sin(o.yaw) * dist, tz = o.position.z + Math.cos(o.yaw) * dist;
    if (s && s.collision) { const p = s.collision.resolve(tx, tz, 0.3); tx = p.x; tz = p.z; }
    const m = new THREE.Mesh(BALL_GEO, BALL_MAT); m.castShadow = true; m.userData.dynamic = true; this.env.parent.add(m);
    const from = new THREE.Vector3(o.position.x, o.position.y + 1.2, o.position.z);
    this.ball = { mesh: m, from, to: new THREE.Vector3(tx, this.ground(tx, tz) + 0.075, tz), t: 0, dur: 0.9, state: 'air' };
    this.action = null; this.queue = []; this.idleT = 0;
    return true;
  }
  #dropBall() { if (!this.ball) return; this.env.parent.remove(this.ball.mesh); this.ball = null; }

  /* ---------- cuadro a cuadro ---------- */
  update(dt) {
    const name = this.scene;
    if (name !== this.lastScene) { this.lastScene = name; this.#dropBall(); this.perched = false; if (this.allowed(name)) this.place(); }
    const show = this.allowed(name); this.group.visible = show; if (this.leash) this.leash.visible = show && this.leashed;
    if (!show) return;
    const o = this.owner, ox = o.position.x, oz = o.position.z, ownerSpeed = o.speed || 0;
    if (this.action) { this.actionT -= dt; if (this.actionT <= 0) { const n = this.queue.shift(); if (n) this.setAction(n[0], n[1]); else this.action = null; } }
    if (ownerSpeed > 5 && this.lastOwnerSpeed <= 5 && Math.random() < 0.35) this.react('correr');
    this.lastOwnerSpeed = ownerSpeed;
    const dx = ox - this.pos.x, dz = oz - this.pos.z, dist = Math.hypot(dx, dz);
    // muy lejos (atajo, salto, escalera) o atrapada: reaparece discretamente junto al dueño
    if (dist > (this.kind === 'bigdragon' ? 18 : 13) || this.stuckT > 2.2) { this.#dropBall(); this.place(); }
    if (this.kind === 'bird') this.#bird(dt, ownerSpeed);
    else if (this.kind === 'dragon') this.#hover(dt, ownerSpeed, dist);
    else this.#walker(dt, ownerSpeed, dist);
    if (this.appear > 0) { this.appear = Math.min(1, this.appear + dt * 3.5); this.group.scale.setScalar(this.appear < 1 ? 0.2 + this.appear * 0.8 : 1); if (this.appear >= 1) this.appear = 0; }
    this.model.update(dt, { speed: this.speed, action: this.action || this.idleAction, air: this.air });
    this.sync(); this.#drawLeash();
  }

  sync() { this.group.position.copy(this.pos); this.group.position.y += this.air; this.group.rotation.y = this.yaw; }

  #move(tx, tz, want, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const target = d < 0.05 ? 0 : want;
    this.speed += (target - this.speed) * Math.min(1, dt * 6);
    if (this.speed < 0.02 || d < 0.05) { this.speed = Math.max(0, this.speed); return; }
    const step = Math.min(d, this.speed * dt), nx = this.pos.x + dx / d * step, nz = this.pos.z + dz / d * step;
    const s = this.env.scene(), p = s && s.collision ? s.collision.resolve(nx, nz, this.radius) : { x: nx, z: nz };
    const progressed = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    this.stuckT = want > 0.5 && progressed < step * 0.25 && d > 1.2 ? this.stuckT + dt : Math.max(0, this.stuckT - dt);
    this.pos.x = p.x; this.pos.z = p.z; this.pos.y += (this.ground(p.x, p.z) - this.pos.y) * Math.min(1, dt * 12);
    this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 9);
  }

  /** Perros, gatos, fantásticos de cuatro patas y el gran dragón. */
  #walker(dt, ownerSpeed, dist) {
    const o = this.owner, big = this.kind === 'bigdragon', cat = this.breed.species === 'gato';
    this.air = 0; this.idleAction = null;
    // pelota: va, la recoge, la trae
    if (this.ball) {
      const b = this.ball;
      if (b.state === 'air') { b.t += dt / b.dur; const k = Math.min(1, b.t); b.mesh.position.lerpVectors(b.from, b.to, k); b.mesh.position.y += Math.sin(k * Math.PI) * 1.4; if (k >= 1) b.state = 'ground'; }
      if (b.state !== 'carry') { this.#move(b.to.x, b.to.z, 5.2, dt); if (Math.hypot(b.to.x - this.pos.x, b.to.z - this.pos.z) < 0.45 && b.state === 'ground') { b.state = 'carry'; } return; }
      const hp = new THREE.Vector3(); this.model.head.getWorldPosition(hp); b.mesh.position.copy(hp).add(new THREE.Vector3(Math.sin(this.yaw) * 0.12, -0.05, Math.cos(this.yaw) * 0.12));
      this.#move(o.position.x, o.position.z, 4.5, dt);
      if (dist < 1.1) { this.#dropBall(); this.react('cariño'); }
      return;
    }
    const follow = big ? 3.0 : this.leashed ? 1.2 : 1.5;
    if (dist > follow) {
      this.idleT = 0; this.wander = null; this.perched = false;
      // a un costado y apenas atrás: así se ve en la cámara de tercera persona (detrás quedaría oculta)
      const behind = big ? 2.4 : this.leashed ? 0.25 : 0.55, side = big ? 1.2 : this.leashed ? 0.85 : 0.75;
      const tx = o.position.x - Math.sin(o.yaw) * behind + Math.cos(o.yaw) * side, tz = o.position.z - Math.cos(o.yaw) * behind - Math.sin(o.yaw) * side;
      const want = Math.max(1.4, Math.min(7.2, ownerSpeed * 1.08 + (dist - follow) * 1.6));
      this.#move(tx, tz, want, dt);
      // la correa nunca se estira de más: si se pasa, la mascota alcanza al dueño
      if (this.leashed) { const ddx = this.pos.x - o.position.x, ddz = this.pos.z - o.position.z, dd = Math.hypot(ddx, ddz); if (dd > LEASH_LENGTH) { const s = this.env.scene(), k = LEASH_LENGTH / dd, p = s && s.collision ? s.collision.resolve(o.position.x + ddx * k, o.position.z + ddz * k, this.radius) : { x: o.position.x + ddx * k, z: o.position.z + ddz * k }; this.pos.x = p.x; this.pos.z = p.z; } }
      if (this.action === 'sit' || this.action === 'sleep') this.action = null;
      return;
    }
    // quieto junto al dueño: se voltea hacia él y, con el tiempo, se sienta, explora o duerme
    this.idleT += dt;
    if (this.wander) {
      this.#move(this.wander.x, this.wander.z, 1.2, dt);
      if (Math.hypot(this.wander.x - this.pos.x, this.wander.z - this.pos.z) < 0.3 || (this.wanderT -= dt) < -4) { this.wander = null; this.wanderT = 3 + Math.random() * 5; if (!this.action) this.setAction(cat ? (Math.random() < 0.5 ? 'groom' : 'stretch') : 'wag', 1.6); }
      return;
    }
    this.#move(this.pos.x, this.pos.z, 0, dt);
    this.yaw += angleDelta(this.yaw, Math.atan2(o.position.x - this.pos.x, o.position.z - this.pos.z)) * Math.min(1, dt * 3);
    if (this.action) return;
    if (this.idleT > 40) this.idleAction = 'sleep';
    else if (this.idleT > 4) {
      this.idleAction = 'sit';
      if ((this.wanderT -= dt) < 0 && !this.leashed && !big) {
        const a = Math.random() * TAU, r = 1.2 + Math.random() * 1.8, tx = o.position.x + Math.cos(a) * r, tz = o.position.z + Math.sin(a) * r, s = this.env.scene();
        if (!s || !s.collision || s.collision.isFree(tx, tz, this.radius)) this.wander = { x: tx, z: tz }; else this.wanderT = 1.5;
      }
      if (Math.random() < dt * 0.04) this.setAction(cat ? 'speak' : 'wag', 1);
    }
  }

  /** Aves: vuelan a un lado del dueño y se posan en su hombro cuando se queda quieto. */
  #bird(dt, ownerSpeed) {
    const o = this.owner; this.idleAction = null;
    if (ownerSpeed < 0.2) this.idleT += dt; else { this.idleT = 0; this.perched = false; }
    if (this.idleT > 2.5 && !this.action) this.perched = true;
    const hand = o.shoulder ? o.shoulder() : null;
    if (this.perched && hand) {
      const k = Math.min(1, dt * 8); this.pos.x += (hand.x - this.pos.x) * k; this.pos.z += (hand.z - this.pos.z) * k; this.pos.y = this.ground(this.pos.x, this.pos.z);
      this.air += (hand.y - this.pos.y - this.air) * k;
      this.yaw += angleDelta(this.yaw, o.yaw) * Math.min(1, dt * 8); this.speed = 0;
      this.idleAction = Math.abs(this.pos.y + this.air - hand.y) > 0.08 ? 'land' : (this.idleT > 45 ? 'sleep' : null);
      if (!this.action && Math.random() < dt * 0.05) this.setAction('speak', 0.8);
      return;
    }
    // vuelo: al lado izquierdo, un poco arriba del hombro, nunca entre la cámara y el avatar
    const t = performance.now() / 1000, side = -0.95, back = -0.2;
    const tx = o.position.x - Math.sin(o.yaw) * back + Math.cos(o.yaw) * side + Math.sin(t * 0.9) * 0.25;
    const tz = o.position.z - Math.cos(o.yaw) * back - Math.sin(o.yaw) * side + Math.cos(t * 0.7) * 0.25;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const want = Math.min(9, Math.max(ownerSpeed, d * 3));
    this.speed += (want - this.speed) * Math.min(1, dt * 5);
    if (d > 0.02) { const step = Math.min(d, this.speed * dt); this.pos.x += dx / d * step; this.pos.z += dz / d * step; this.yaw += angleDelta(this.yaw, d > 0.3 ? Math.atan2(dx, dz) : o.yaw) * Math.min(1, dt * 6); }
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    const targetAir = (o.position.y - this.pos.y) + 1.75 + Math.sin(t * 2.3) * 0.1;
    this.air += (targetAir - this.air) * Math.min(1, dt * 4);
    this.idleAction = 'fly';
  }

  /** Dragoncito: flota a la altura del hombro, aletea y a veces lanza fuego mágico (solo visual). */
  #hover(dt, ownerSpeed, dist) {
    const o = this.owner, t = performance.now() / 1000; this.idleAction = 'fly';
    const tx = o.position.x - Math.sin(o.yaw) * 0.7 + Math.cos(o.yaw) * 0.85, tz = o.position.z - Math.cos(o.yaw) * 0.7 - Math.sin(o.yaw) * 0.85;
    const s = this.env.scene(), dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const want = Math.min(8, Math.max(ownerSpeed, d * 2.6)); this.speed += (want - this.speed) * Math.min(1, dt * 5);
    if (d > 0.03) { const step = Math.min(d, this.speed * dt); const p = s && s.collision ? s.collision.resolve(this.pos.x + dx / d * step, this.pos.z + dz / d * step, this.radius) : { x: this.pos.x + dx / d * step, z: this.pos.z + dz / d * step }; this.pos.x = p.x; this.pos.z = p.z; }
    this.yaw += angleDelta(this.yaw, d > 0.4 ? Math.atan2(dx, dz) : o.yaw) * Math.min(1, dt * 5);
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    this.air += ((o.position.y - this.pos.y) + 1.0 + Math.sin(t * 2) * 0.12 - this.air) * Math.min(1, dt * 4);
    this.stuckT = dist > 4 && this.speed > 1 && d > 3 ? this.stuckT + dt * 0.5 : 0;
    if (ownerSpeed < 0.2) { this.idleT += dt; if (!this.action && this.idleT > 6 && Math.random() < dt * 0.05) this.setAction('fire', 1.2); } else this.idleT = 0;
  }

  #drawLeash() {
    if (!this.leash || !this.leashed || !this.model.leashAnchor || !this.owner.hand) return;
    const a = new THREE.Vector3(), b = this.owner.hand(); this.model.leashAnchor.getWorldPosition(a);
    const arr = this.leash.geometry.attributes.position.array, span = a.distanceTo(b), sag = Math.max(0, LEASH_LENGTH - span) * 0.35 + 0.05;
    for (let i = 0; i < 16; i++) { const k = i / 15; arr[i * 3] = b.x + (a.x - b.x) * k; arr[i * 3 + 1] = b.y + (a.y - b.y) * k - Math.sin(k * Math.PI) * sag; arr[i * 3 + 2] = b.z + (a.z - b.z) * k; }
    this.leash.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.#dropBall(); this.setLeash(false);
    this.env.parent.remove(this.group); this.model.dispose();
  }
}
