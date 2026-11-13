// Vista previa 3D del avatar (armario y selección). Usa el MISMO renderizador del juego para no abrir
// un segundo contexto WebGL (en celulares eso falla): dibuja una escena pequeña en una textura fuera
// de pantalla y copia el resultado a un lienzo 2D. Solo trabaja mientras la ventana está abierta.
import * as THREE from '../three.js';
import { createAvatar } from '../characters/avatar.js';

export class AvatarPreview {
  constructor(renderer, { width = 220, height = 280 } = {}) {
    this.renderer = renderer; this.w = width; this.h = height;
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.canvas.className = 'preview3d'; this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', 'Vista previa de tu avatar');
    this.ctx = this.canvas.getContext('2d');
    this.flip = document.createElement('canvas'); this.flip.width = width; this.flip.height = height; this.fctx = this.flip.getContext('2d');
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xeef3fb);
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
    this.camera.position.set(0, 1.25, 4.6); this.camera.lookAt(0, 0.9, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c6dd, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 4, 3); this.scene.add(key);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0xd8e2f2, roughness: 0.8 }));
    base.position.y = -0.06; this.scene.add(base);
    this.target = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.pixels = new Uint8Array(width * height * 4); this.image = this.ctx.createImageData(width, height);
    this.avatar = null; this.spin = 0.55; this.yaw = 0.4; this.raf = 0; this.last = 0; this.drag = null;
    this.canvas.addEventListener('pointerdown', e => { this.drag = e.clientX; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => { if (this.drag === null) return; this.yaw += (e.clientX - this.drag) * 0.012; this.drag = e.clientX; this.spin = 0; });
    const up = () => { this.drag = null; }; this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);
  }

  /** Cambia el personaje mostrado (misma apariencia que en el juego). */
  show(look) {
    if (this.avatar) { this.scene.remove(this.avatar.group); }
    this.avatar = createAvatar(look); this.scene.add(this.avatar.group);
    this.avatar.playEmote && this.avatar.playEmote('wave', 1.4);
  }

  start() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) this.spin = 0;
    const tick = t => {
      if (!this.canvas.isConnected) return this.stop();   // la ventana se cerró
      const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016); this.last = t;
      if (this.avatar) { this.yaw += this.spin * dt; this.avatar.group.rotation.y = this.yaw; this.avatar.update(dt, { speed: 0, grounded: true }); }
      this.draw(); this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  draw() {
    const r = this.renderer, prev = r.getRenderTarget();   // sin luces que proyecten sombra: no cambia sombreadores
    r.setRenderTarget(this.target); r.render(this.scene, this.camera); r.setRenderTarget(prev);
    r.readRenderTargetPixels(this.target, 0, 0, this.w, this.h, this.pixels);
    this.image.data.set(this.pixels); this.fctx.putImageData(this.image, 0, 0);
    this.ctx.save(); this.ctx.setTransform(1, 0, 0, -1, 0, this.h); this.ctx.drawImage(this.flip, 0, 0); this.ctx.restore();   // WebGL entrega las filas de abajo hacia arriba
  }

  /** Foto fija de un personaje (miniaturas de las tarjetas). */
  still(look, yaw = 0.45) {
    const keep = this.avatar; if (keep) this.scene.remove(keep.group);
    const a = createAvatar(look); a.group.rotation.y = yaw; a.update(0.016, { speed: 0, grounded: true }); this.scene.add(a.group);
    this.draw(); const url = this.canvas.toDataURL('image/png');
    this.scene.remove(a.group); if (keep) this.scene.add(keep.group);
    return url;
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.target.dispose(); }
}
