// Vista previa 3D de una mascota (catálogo de adopción y accesorios). Usa el mismo renderizador del
// juego que la vista previa del avatar; los modelos comparten geometrías, así que solo se retiran.
import { AvatarPreview } from '../ui/preview.js';
import { createPetModel } from './pet-model.js';
import { breedById } from './pet-catalog.js';

export class PetPreview extends AvatarPreview {
  constructor(renderer, size = {}) { super(renderer, { width: 240, height: 200, ...size }); this.canvas.setAttribute('aria-label', 'Vista previa de la mascota'); this.action = null; }
  show(breed, acc = {}) {
    if (this.avatar) { this.scene.remove(this.avatar.group); this.avatar.dispose(); this.avatar = null; }
    const b = breedById(breed); if (!b) return;
    const m = createPetModel(breed, acc), h = Math.max(0.35, m.height);
    this.avatar = m; this.scene.add(m.group);
    // encuadre según el tamaño de la raza
    this.camera.position.set(0, h * 0.75 + 0.15, h * 2.6 + 0.9); this.camera.lookAt(0, h * 0.42, 0);
    if (b.species === 'ave') m.group.position.y = 0.05;
    this.action = b.form === 'dragon' ? 'fire' : b.species === 'ave' ? 'dance' : 'wag';
    this.actionT = 1.6;
  }
  start() {
    const tick = t => {
      if (!this.canvas.isConnected) return this.stop();
      const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016); this.last = t;
      if (this.avatar) { this.yaw += this.spin * dt; this.avatar.group.rotation.y = this.yaw; this.actionT -= dt; this.avatar.update(dt, { speed: 0, action: this.actionT > 0 ? this.action : null }); }
      this.draw(); this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { if (this.avatar && !this.disposed) { this.scene.remove(this.avatar.group); this.avatar.dispose(); this.avatar = null; } super.stop(); }
}
