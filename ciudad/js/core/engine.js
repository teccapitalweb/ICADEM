// Motor: renderizador, calidad gráfica y ciclo principal.
import * as THREE from '../three.js';
import { isTouchDevice } from './input.js';

export const QUALITY = Object.freeze({
  low: { label: 'Baja', pixelRatio: 1, shadows: false, shadowSize: 0, far: 150 },
  medium: { label: 'Media', pixelRatio: 1.5, shadows: true, shadowSize: 1024, far: 220 },
  high: { label: 'Alta', pixelRatio: 2, shadows: true, shadowSize: 2048, far: 260 }
});

export function detectQuality() {
  const coarse = isTouchDevice();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (coarse) return mem <= 2 || cores <= 2 ? 'low' : 'medium';
  return cores >= 8 ? 'high' : 'medium';
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.updaters = [];
    this.running = false;
    this.elapsed = 0;
    this.quality = 'medium';
    this.fps = 0;
    this._frames = 0; this._fpsTime = 0;
    this.setQuality('medium');
    this.resize();
    addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(canvas.parentElement || canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clock.getDelta(); });
  }

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.medium;
    this.quality = QUALITY[name] ? name : 'medium';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.camera.far = q.far;
    this.camera.updateProjectionMatrix();
    this.scene.traverse(o => {
      if (o.isDirectionalLight && o.castShadow !== undefined) {
        o.castShadow = q.shadows && o.userData.wantsShadow === true;
        if (o.castShadow && o.shadow.mapSize.x !== q.shadowSize) {
          o.shadow.mapSize.set(q.shadowSize, q.shadowSize);
          o.shadow.map?.dispose(); o.shadow.map = null;
        }
      }
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; });
    });
    this.resize();
    return this.quality;
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // En vertical se abre el campo de visión para no perder contexto en celular.
    this.camera.fov = w / h < 0.8 ? 68 : w / h < 1.2 ? 60 : 55;
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) { this.updaters.push(fn); }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.elapsed += dt;
      for (const fn of this.updaters) fn(dt, this.elapsed);
      this.renderer.render(this.scene, this.camera);
      this._frames++; this._fpsTime += dt;
      if (this._fpsTime >= 1) { this.fps = Math.round(this._frames / this._fpsTime); this._frames = 0; this._fpsTime = 0; }
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
}

/** Libera geometrías, materiales y texturas de un grupo al cambiar de escenario. */
export function disposeTree(root) {
  root.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.userData.shared) continue;
      for (const key of ['map', 'emissiveMap', 'alphaMap']) if (m[key] && !m[key].userData.shared) m[key].dispose();
      m.dispose();
    }
  });
}
