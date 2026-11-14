// Ciudad ICADEM 2.0 · montura: vuelo controlado en el Gran dragón de viaje (cliente).
//
// El jugador sube al dragón en el Helipuerto de dragones de la plaza, el servidor autoriza el vuelo
// y el dragón recorre la ruta fija de flight.js. Durante el vuelo no hay control libre: el jugador
// mira la ciudad desde arriba y aterriza en el mismo helipuerto. Los demás jugadores lo ven volar.
import * as THREE from '../three.js';
import { createPetModel } from '../pets/pet-model.js';
import { FLIGHTS, MOUNT_BREED, flightPoint, flightYaw } from './flight.js';
import { breedById } from '../pets/pet-catalog.js';

export const RIDE_Y = 0.72;   // altura del jugador sentado sobre el lomo del dragón (por la escala de montura)
export const MOUNT_SCALE = 1.25;

export class Mounts {
  constructor(api) { this.api = api; this.active = null; this.model = null; }

  get owned() { const s = this.api.vivo.state; return Boolean(s && s.pets.some(p => p.breed === MOUNT_BREED)); }
  get dragon() { const s = this.api.vivo.state; return s ? s.pets.find(p => p.breed === MOUNT_BREED) : null; }
  nearPad(id = 'plaza') { const f = FLIGHTS[id], p = this.api.player.position; return this.api.sceneName === f.scene && Math.hypot(p.x - f.pad.x, p.z - f.pad.z) <= f.pad.r + 1.2; }

  /** Lo que hace el botón «Monturas» del menú rápido y el helipuerto. */
  async open() {
    const api = this.api, f = FLIGHTS.plaza, b = breedById(MOUNT_BREED);
    if (!api.vivo.online) return api.ui.toast('Las monturas necesitan conexión con la ciudad.');
    if (!this.owned) return api.ui.choice({ speaker: 'Helipuerto de dragones', text: `Para volar necesitas al ${b.name}. Se adopta en «Mis mascotas» al llegar al nivel ${8} (${b.price} monedas del juego).`, options: [{ id: 'ok', label: 'Entendido', primary: true }] });
    if (!this.nearPad()) {
      if (api.sceneName === 'plaza') { api.setWaypoint({ x: f.pad.x, z: f.pad.z, name: 'Helipuerto de dragones' }); return api.ui.toast('Ve al Helipuerto de dragones (marcado en la plaza) para despegar.', 3400); }
      return api.ui.toast('El Helipuerto de dragones está en la plaza, del lado oeste.', 3400);
    }
    const pick = await api.ui.choice({ speaker: 'Helipuerto de dragones', text: `${f.title}: tu ${this.dragon.name} da una vuelta por encima de la ciudad (${f.seconds} segundos) y regresa aquí mismo.`, options: [{ id: 'go', label: '¡Despegar!', primary: true }, { id: 'no', label: 'Ahora no' }] });
    if (pick === 'go') return this.fly('plaza');
  }

  async fly(id) {
    if (this.active) return { ok: false };
    const api = this.api;
    if (api.net.lastSent) api.net.sendState(api.net.lastSent);   // quieto en el diálogo: el servidor necesita la posición reciente
    const r = await api.net.vivo('fly', { route: id });
    if (!r.ok) { api.ui.toast({ lejos: 'Acércate al centro del helipuerto.', 'sin-dragon': 'Necesitas al Gran dragón de viaje.', ocupado: 'Termina primero tu partida o misión en curso.', espera: 'El dragón descansa un momento. Inténtalo en unos segundos.' }[r.reason] || r.message || 'El vuelo no está disponible ahora.', 3200); return r; }
    const pet = this.dragon;
    this.model = createPetModel(MOUNT_BREED, pet ? pet.acc : {}); this.model.group.scale.setScalar(MOUNT_SCALE); api.engine.scene.add(this.model.group);
    this.active = { id, start: performance.now(), seconds: FLIGHTS[id].seconds };   // reloj real: el servidor mide igual, aunque el equipo dibuje lento
    api.input.setEnabled(false); api.player.seat = null; api.player.vx = api.player.vz = api.player.vy = 0;
    api.pets.companion?.group && (api.pets.hideForMount = true);
    api.ui.toast('¡Agárrate! Disfruta la vista de Ciudad ICADEM.', 3000);
    return r;
  }

  /** Cuadro a cuadro durante el vuelo (lo llama el ciclo principal en lugar del movimiento normal). */
  step(dt) {
    const a = this.active; if (!a) return;
    const api = this.api, p = api.player.position, prev = p.clone();
    const k = Math.min(1, (performance.now() - a.start) / 1000 / a.seconds), pt = flightPoint(a.id, k), yaw = flightYaw(a.id, k);
    p.set(pt.x, pt.y + RIDE_Y * MOUNT_SCALE * (k > 0 && k < 1 ? 1 : 0.85), pt.z); api.player.yaw = yaw; api.player.speed = 0; api.player.grounded = true;
    const g = this.model.group; g.position.set(pt.x, pt.y, pt.z); g.rotation.y = yaw;
    this.model.update(dt, { speed: prev.distanceTo(p) / Math.max(dt, 1e-3), action: pt.y > 0.6 ? 'fly' : null, air: pt.y });
    // cámara de vuelo: detrás y arriba, mirando hacia adelante
    const back = new THREE.Vector3(-Math.sin(yaw) * 7.5, 3.6, -Math.cos(yaw) * 7.5);
    api.camera.frame(p.clone().add(back), p.clone().add(new THREE.Vector3(Math.sin(yaw) * 4, 0.2, Math.cos(yaw) * 4)), 0.4);
    if (k >= 1) this.#land();
  }

  #land() {
    const api = this.api, f = FLIGHTS[this.active.id];
    api.player.position.set(f.pad.x + 1.6, 0, f.pad.z); api.player.yaw = Math.PI / 2;
    api.engine.scene.remove(this.model.group); this.model.dispose(); this.model = null; this.active = null;
    api.pets.hideForMount = false; api.camera.release(); api.input.setEnabled(!api.ui.isBlocking);
    api.ui.toast('¡Aterrizaste en el Helipuerto de dragones!', 2600);
    api.pets.react('mision');
  }
}
