// Ciudad ICADEM 2.0 · «Mi casa»: sala privada personalizable junto a la habitación.
// Paredes, piso y muebles salen de la distribución guardada en la cuenta (home-rules.js). Las
// mascotas que no acompañan al jugador viven aquí: duermen en su camita, comen y juegan.
import * as THREE from '../three.js';
import { CollisionWorld } from '../core/collision.js';
import { mat, box, cyl, plane, sign, sunLight } from './kit.js';
import { HOME, WALL_COLORS, FLOORS, DEFAULT_HOME, footprint } from '../home/home-rules.js';
import { buildFurniture, disposeFurniture } from '../home/furniture.js';
import { itemById } from '../economy/catalog.js';
import { PetCompanion } from '../pets/pet-companion.js';
import { breedById } from '../pets/pet-catalog.js';

const W = HOME.maxX - HOME.minX, D = HOME.maxZ - HOME.minZ, H = 3.3;
export const HOME_MAX_PETS = 5;   // mascotas que pasean por la casa a la vez (rendimiento)

function floorTexture(f) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), hex = '#' + f.color.toString(16).padStart(6, '0');
  x.fillStyle = hex; x.fillRect(0, 0, 256, 256);
  if (f.pattern === 'planks') { x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.strokeRect(-4, i * 64, 264, 64); x.beginPath(); x.moveTo((i % 2) * 128 + 60, i * 64); x.lineTo((i % 2) * 128 + 60, i * 64 + 64); x.stroke(); } }
  else if (f.pattern === 'tiles') { x.strokeStyle = 'rgba(0,0,0,.14)'; x.lineWidth = 4; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); } }
  else if (f.pattern === 'talavera') { x.fillStyle = '#f6f1e4'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58); x.fillStyle = hex; x.beginPath(); x.arc(i * 64 + 32, j * 64 + 32, 14, 0, 7); x.fill(); for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(i * 64 + 32 + Math.cos(k * 1.57) * 22, j * 64 + 32 + Math.sin(k * 1.57) * 22, 6, 0, 7); x.fill(); } x.fillStyle = '#f6f1e4'; } }
  else { x.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 400; i++) x.fillRect((i * 97) % 256, (i * 61) % 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 2, D / 2); return t;
}

export function buildCasa(api) {
  const g = new THREE.Group();
  const col = new CollisionWorld().setBounds(HOME.minX, HOME.minZ, HOME.maxX, HOME.maxZ);
  /* estructura (paredes de una sola cara para que la cámara pueda salir) */
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfde9c9, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
  const floor = plane(W, D, floorMat, 0, 0, 0, g, { rx: -Math.PI / 2 }); floor.receiveShadow = true; floor.name = 'casa-floor';
  plane(W, H, wallMat, 0, H / 2, HOME.minZ, g); plane(W, H, wallMat, 0, H / 2, HOME.maxZ, g, { ry: Math.PI });
  plane(D, H, wallMat, HOME.minX, H / 2, 0, g, { ry: Math.PI / 2 }); plane(D, H, wallMat, HOME.maxX, H / 2, 0, g, { ry: -Math.PI / 2 });
  const trim = mat(0xffffff, { r: 0.6 });
  box(W, 0.14, 0.05, trim, 0, 0, HOME.minZ + 0.025, g, { cast: false }); box(W, 0.14, 0.05, trim, 0, 0, HOME.maxZ - 0.025, g, { cast: false });
  box(0.05, 0.14, D, trim, HOME.minX + 0.025, 0, 0, g, { cast: false }); box(0.05, 0.14, D, trim, HOME.maxX - 0.025, 0, 0, g, { cast: false });
  // ventanas con vista a la ciudad
  for (const [x, z, ry] of [[3.4, HOME.maxZ - 0.03, Math.PI], [-3.4, HOME.maxZ - 0.03, Math.PI], [HOME.maxX - 0.03, 0, -Math.PI / 2]]) {
    const win = new THREE.Group(); win.position.set(x, 0, z); win.rotation.y = ry; g.add(win);
    box(1.9, 1.4, 0.06, mat(0xffffff, { r: 0.5 }), 0, 1.0, 0, win, { cast: false });
    plane(1.7, 1.2, new THREE.MeshBasicMaterial({ color: 0x9fd4ff, toneMapped: false }), 0, 1.7, 0.035, win);
    box(0.05, 1.2, 0.04, mat(0xffffff), 0, 1.1, 0.05, win, { cast: false });
  }
  // puerta a la habitación (pared norte)
  const door = box(1.08, 2.14, 0.08, mat(0x2f9e8f, { r: 0.55, own: true }), HOME.door.x, 0, HOME.minZ + 0.05, g, { cast: false });
  box(1.28, 2.3, 0.06, trim, HOME.door.x, 0, HOME.minZ + 0.02, g, { cast: false });
  const s1 = sign('MI HABITACIÓN', 1.3, 0.26, { bg: '#2f9e8f', fg: '#ffffff' }); s1.position.set(HOME.door.x, 2.52, HOME.minZ + 0.07); g.add(s1);
  // lámpara de techo y luces
  cyl(0.5, 0.5, 0.04, mat(0xfff3c2, { e: 0xfff3c2, ei: 0.8 }), 0, H - 0.05, 0, g, { seg: 24, cast: false });
  g.add(new THREE.HemisphereLight(0xfff4de, 0xb98a5a, 1.3));
  const sun = sunLight(g, { x: -5, y: 9, z: 6, intensity: 1.6, color: 0xfff0d0, area: 10 }); sun.target.position.set(0, 0, 0);

  /* muebles y colisiones a partir de la distribución */
  const furn = new THREE.Group(); furn.userData.dynamic = true; g.add(furn);
  const baseBoxes = col.boxes.length;
  let applied = null;
  function applyHome(layout) {
    const L = layout && Array.isArray(layout.items) ? layout : DEFAULT_HOME;
    const wc = WALL_COLORS.find(w => w.id === L.wall) || WALL_COLORS[0], fl = FLOORS.find(f => f.id === L.floor) || FLOORS[0];
    wallMat.color.setHex(wc.color);
    if (!applied || applied.floor !== fl.id) { floorMat.map?.dispose(); floorMat.map = floorTexture(fl); floorMat.needsUpdate = true; }
    for (const ch of [...furn.children]) { furn.remove(ch); disposeFurniture(ch); }
    col.boxes.length = baseBoxes;
    for (const e of L.items) {
      const def = itemById(e.item); if (!def) continue;
      const m = buildFurniture(e.item); m.position.set(e.x, 0, e.z); m.rotation.y = (e.r || 0) * Math.PI / 2; m.userData.entry = e; furn.add(m);
      const f = footprint(e); if (f && (def.layer === 'floor' || (def.layer === 'pet' && def.petUse === 'perch'))) col.addBox(f.minX + 0.04, f.minZ + 0.04, f.maxX - 0.04, f.maxZ - 0.04);
    }
    applied = { wall: wc.id, floor: fl.id, items: L.items.map(e => ({ ...e })) };
    homePets.forEach(p => p.anchor && p.c.place(true));
  }

  /* mascotas en casa: duermen en su camita, comen en el comedero y pasean */
  const homePets = [];
  function spots(use) { return (applied ? applied.items : []).filter(e => itemById(e.item)?.petUse === use).map(e => ({ x: e.x, z: e.z })); }
  function syncPets() {
    for (const p of homePets.splice(0)) p.c.dispose();
    const v = api.store.state.vivo; if (!v) return;
    const list = v.pets.filter(p => p.id !== v.activePet && breedById(p.breed) && !breedById(p.breed).mount).slice(0, HOME_MAX_PETS);   // el gran dragón espera afuera
    list.forEach((pet, i) => {
      const perch = new THREE.Vector3(), anchor = { position: new THREE.Vector3(-3 + i * 1.4, 0, 1.5), yaw: 0, speed: 0, home: true, perchOn: false, shoulder: () => (anchor.perchOn ? perch : null) };
      anchor.perch = perch;
      const c = new PetCompanion({ breed: pet.breed, acc: pet.acc, owner: anchor, env: { parent: g, scene: () => sceneObj, sceneName: () => 'casa' } });
      homePets.push({ c, anchor, t: 4 + i * 3, plan: null });
    });
  }
  function routine(p, dt) {
    p.t -= dt; if (p.t > 0) return;
    const r = Math.random(), beds = spots('sleep'), bowls = spots('eat'), perches = spots('perch');
    const bird = p.c.kind === 'bird';
    let to = null, act = null, stay = 8 + Math.random() * 10;
    p.anchor.perchOn = false;
    if (r < 0.35 && (bird ? perches : beds).length) { to = (bird ? perches : beds)[Math.floor(Math.random() * (bird ? perches : beds).length)]; act = bird ? null : 'sleep'; stay = 18; if (bird) { p.anchor.perch.set(to.x, 1.18, to.z); p.anchor.perchOn = true; } }
    else if (r < 0.55 && bowls.length && !bird) { to = bowls[Math.floor(Math.random() * bowls.length)]; act = 'eat'; stay = 6; }
    else { const s = sceneObj.collision; for (let k = 0; k < 6 && !to; k++) { const x = HOME.minX + 1 + Math.random() * (W - 2), z = HOME.minZ + 3 + Math.random() * (D - 4); if (s.isFree(x, z, 0.4)) to = { x, z }; } act = Math.random() < 0.4 ? 'play' : null; }
    if (to) { p.anchor.position.set(to.x, 0, to.z + (act === 'eat' ? 0.55 : 0)); p.plan = { act, at: performance.now() / 1000 }; }
    p.t = stay;
  }

  const interactables = [
    { id: 'door', x: HOME.door.x, y: 1.2, z: HOME.minZ + 0.7, radius: 1.5, label: 'Volver a mi habitación', color: 0x2f9e8f, action: () => api.travel('room', 'casa') },
    { id: 'decorar', x: -HOME.door.x - 2.2, y: 1.2, z: HOME.minZ + 1.0, radius: 1.6, label: 'Decorar mi casa', color: 0xffc93c, action: () => api.homeEditor.open() }
  ];
  const sceneObj = {
    name: 'casa', title: 'Mi casa', group: g, collision: col, interactables, npcs: [],
    background: 0x2a2233, fog: null,
    spawns: { default: { x: HOME.door.x, z: HOME.minZ + 1.4, yaw: 0 } },
    camera: { distance: 5.4, minDistance: 2.2, maxDistance: 7.5, pitch: 0.55, yaw: 0, box: { minX: -7.6, maxX: 7.6, minZ: -6.6, maxZ: 7.4, maxY: 6 } },
    applyHome, get layout() { return applied; }, furniture: furn,
    update(dt, t) {
      door.material.emissive.setHex(0x0f2a26); door.material.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.3;
      for (const p of homePets) {
        routine(p, dt); p.c.update(dt);
        const close = Math.hypot(p.c.pos.x - p.anchor.position.x, p.c.pos.z - p.anchor.position.z) < 0.5;
        if (close && p.plan && p.plan.act && !p.c.action) p.c.setAction(p.plan.act, p.plan.act === 'sleep' ? 14 : 3.5), p.plan.act = null;
      }
    }
  };
  applyHome(api.store.state.vivo ? api.store.state.vivo.home : DEFAULT_HOME);
  syncPets();
  sceneObj.syncPets = syncPets;
  return sceneObj;
}
