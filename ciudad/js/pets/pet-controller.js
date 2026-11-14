// Ciudad ICADEM 2.0 · la mascota propia en el mundo.
//
// Crea la mascota activa (la que el servidor confirma en el perfil), la rehace cuando cambian su
// raza o sus accesorios, mantiene la correa y hace que reaccione a lo que pasa en el juego.
import * as THREE from '../three.js';
import { PetCompanion } from './pet-companion.js';
import { WALK_SCENES, breedById } from './pet-catalog.js';

export class PetController {
  constructor(api) {
    this.api = api; this.companion = null; this.key = '';
    const player = api.player, tmpH = new THREE.Vector3(), tmpS = new THREE.Vector3();
    this.owner = {
      get position() { return player.position; }, get yaw() { return player.yaw; }, get speed() { return player.speed; },
      hand: () => api.avatar.hand ? api.avatar.hand.getWorldPosition(tmpH) : tmpH.set(player.position.x, player.position.y + 1, player.position.z),
      shoulder: () => api.avatar.perch ? api.avatar.perch.getWorldPosition(tmpS) : null
    };
    this.env = { parent: api.engine.scene, scene: () => api.scene, sceneName: () => api.sceneName };
    api.vivo.on('change', () => this.refresh());
    api.events.on('scene', name => this.#arrive(name));
    api.events.on('mission-passed', () => this.companion?.react('mision'));
    api.events.on('game-done', () => this.companion?.react('mision'));
  }

  get pet() { return this.api.vivo.activePet; }

  /** Rehace la mascota si cambió la activa, su raza o sus accesorios. */
  refresh() {
    const pet = this.pet, leash = this.api.vivo.leash, key = pet ? pet.id + ':' + pet.breed + ':' + JSON.stringify(pet.acc) : '';
    if (key !== this.key) {
      this.companion?.dispose(); this.companion = null; this.key = key;
      if (pet && breedById(pet.breed)) this.companion = new PetCompanion({ breed: pet.breed, acc: pet.acc, owner: this.owner, env: this.env, leash, local: true });
    } else this.companion?.setLeash(leash);
    this.api.avatar.setHold?.(Boolean(this.companion && this.companion.leashed));
  }

  #arrive(name) {
    // la correa solo en calles y parques; al entrar a un interior se suelta sola
    if (this.api.vivo.leash && !WALK_SCENES.includes(name)) this.api.vivo.walk(false);
    const c = this.companion; if (!c) return;
    setTimeout(() => { if (name === 'room' || name === 'casa') c.react('casa'); else if (name === 'park') c.react('parque'); }, 700);
  }

  /** Reaparece la mascota junto al jugador (el avatar se reconstruye al cambiar de ropa). */
  rebind() { this.api.avatar.setHold?.(Boolean(this.companion && this.companion.leashed)); }

  update(dt) {
    const c = this.companion; if (!c) return;
    if (this.hideForMount) { c.group.visible = false; if (c.leash) c.leash.visible = false; this.wasHidden = true; return; }   // el jugador va montado en su dragón
    if (this.wasHidden) { this.wasHidden = false; c.place(); }
    c.update(dt);
  }
  react(kind) { this.companion?.react(kind); }
  throwBall() { return this.companion ? this.companion.throwBall() : false; }
}
