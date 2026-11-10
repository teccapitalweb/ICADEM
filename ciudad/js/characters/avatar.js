// Personaje estilizado original de Ciudad ICADEM: un solo esqueleto para todos los avatares
// y NPC, con animaciones por código (parado, caminar, correr, saltar, saludar, celebrar,
// sentarse e interactuar). Mira hacia +Z.
import * as THREE from '../three.js';
import { mat, mergeStatic } from '../world/kit.js';

const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

function part(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false;
  parent.add(m); return m;
}

export function createAvatar(look = {}) {
  const L = {
    skin: 0xf2c29b, hair: 0x4a2f22, hairStyle: 'short', top: 0x2f80ed, topAccent: 0xffffff, bottom: 0x2a3a5c,
    shoes: 0xfafafa, accessories: [], scale: 1, ...look
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const M = {
    skin: mat(L.skin, { r: 0.7 }), hair: mat(L.hair, { r: 0.85 }), top: mat(L.top, { r: 0.75 }),
    accent: mat(L.topAccent, { r: 0.7 }), bottom: mat(L.bottom, { r: 0.8 }), shoes: mat(L.shoes, { r: 0.6 }),
    dark: mat(0x1d2433, { r: 0.5 }), white: mat(0xffffff, { r: 0.4 })
  };

  /* piernas */
  const legs = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.115, 0.52, 0); body.add(pivot);
    part(new THREE.CapsuleGeometry(0.1, 0.26, 4, 10), M.bottom, 0, -0.23, 0, pivot);
    const shoe = part(new THREE.CapsuleGeometry(0.095, 0.13, 4, 8), M.shoes, 0, -0.455, 0.06, pivot);
    shoe.rotation.x = Math.PI / 2; shoe.scale.set(1.05, 1, 0.82);
    return pivot;
  });

  /* torso */
  const torso = new THREE.Group(); torso.position.set(0, 0.52, 0); body.add(torso);
  const chest = part(new THREE.CapsuleGeometry(0.2, 0.26, 6, 14), M.top, 0, 0.3, 0, torso);
  chest.scale.set(1.12, 1, 0.86);
  const belt = part(new THREE.CylinderGeometry(0.212, 0.205, 0.07, 16), M.bottom, 0, 0.06, 0, torso);
  belt.scale.set(1.1, 1, 0.86);

  /* brazos: el pivote está en el hombro */
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.285, 0.5, 0); torso.add(pivot);
    part(new THREE.CapsuleGeometry(0.068, 0.25, 4, 8), M.top, 0, -0.17, 0, pivot);
    part(new THREE.SphereGeometry(0.078, 12, 10), M.skin, 0, -0.39, 0, pivot);
    return pivot;
  });

  /* cabeza */
  const head = new THREE.Group(); head.position.set(0, 0.63, 0); torso.add(head);
  part(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10), M.skin, 0, 0.02, 0, head);
  const skull = part(new THREE.SphereGeometry(0.265, 24, 18), M.skin, 0, 0.27, 0, head);
  skull.scale.set(1, 0.96, 0.98);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.052, 10, 8), M.skin, s * 0.26, 0.25, 0, head);
  const eyes = [-1, 1].map(s => {
    const e = part(new THREE.SphereGeometry(0.036, 12, 10), M.dark, s * 0.095, 0.285, 0.238, head);
    e.scale.set(1, 1.25, 0.6); e.castShadow = false; e.userData.dynamic = true;
    const shine = part(new THREE.SphereGeometry(0.011, 6, 6), M.white, s * 0.095 + 0.012, 0.3, 0.262, head); shine.castShadow = false;
    return e;
  });
  const smile = part(new THREE.TorusGeometry(0.062, 0.011, 6, 14, Math.PI), M.dark, 0, 0.2, 0.243, head);
  smile.rotation.z = Math.PI; smile.rotation.x = -0.12; smile.castShadow = false;
  for (const s of [-1, 1]) {
    const cheek = part(new THREE.CircleGeometry(0.036, 12), new THREE.MeshBasicMaterial({ color: 0xff9a8b, transparent: true, opacity: 0.55 }), s * 0.165, 0.2, 0.21, head);
    cheek.rotation.y = s * 0.62; cheek.castShadow = false;
  }

  /* cabello */
  if (L.hairStyle !== 'none') {
    const cap = part(new THREE.SphereGeometry(0.278, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), M.hair, 0, 0.285, -0.012, head);
    cap.rotation.x = -0.32;
    if (L.hairStyle === 'bun') part(new THREE.SphereGeometry(0.11, 12, 10), M.hair, 0, 0.52, -0.14, head);
    if (L.hairStyle === 'long') { const back = part(new THREE.CapsuleGeometry(0.2, 0.2, 4, 12), M.hair, 0, 0.14, -0.13, head); back.scale.set(1.12, 1, 0.62); }
    if (L.hairStyle === 'short') { const fr = part(new THREE.SphereGeometry(0.12, 12, 8), M.hair, 0.09, 0.47, 0.16, head); fr.scale.set(1.5, 0.6, 0.9); }
    if (L.hairStyle === 'side') { const fr = part(new THREE.SphereGeometry(0.13, 12, 8), M.hair, -0.1, 0.46, 0.15, head); fr.scale.set(1.6, 0.62, 0.9); }
  }

  /* accesorios */
  const acc = new Set(L.accessories);
  if (acc.has('explorerHat')) {
    const felt = mat(0xc99a52, { r: 0.9 });
    const brim = part(new THREE.CylinderGeometry(0.42, 0.44, 0.035, 24), felt, 0, 0.47, 0, head); brim.rotation.x = -0.06;
    part(new THREE.CylinderGeometry(0.2, 0.26, 0.19, 20), felt, 0, 0.57, -0.01, head);
    part(new THREE.CylinderGeometry(0.265, 0.265, 0.045, 20), mat(0x1f4f8f), 0, 0.5, -0.005, head);
  }
  if (acc.has('backpack')) {
    const bag = mat(0xf2a33a, { r: 0.8 });
    const pack = part(new THREE.CapsuleGeometry(0.15, 0.16, 4, 10), bag, 0, 0.32, -0.22, torso); pack.scale.set(1.2, 1, 0.75);
    part(new THREE.BoxGeometry(0.2, 0.1, 0.05), mat(0xd9862a), 0, 0.26, -0.33, torso);
    for (const s of [-1, 1]) { const strap = part(new THREE.BoxGeometry(0.045, 0.36, 0.025), mat(0xd9862a), s * 0.13, 0.36, 0.165, torso); strap.rotation.x = 0.1; }
  }
  if (acc.has('scarf')) {
    const sc = part(new THREE.TorusGeometry(0.115, 0.045, 8, 16), mat(0xe8483f, { r: 0.8 }), 0, 0.6, 0.01, torso); sc.rotation.x = Math.PI / 2 + 0.2;
    const tail = part(new THREE.BoxGeometry(0.08, 0.16, 0.03), mat(0xe8483f, { r: 0.8 }), 0.09, 0.5, 0.17, torso); tail.rotation.z = -0.25;
  }
  if (acc.has('tie')) {
    part(new THREE.BoxGeometry(0.16, 0.2, 0.02), M.white, 0, 0.47, 0.168, torso);
    const tie = part(new THREE.BoxGeometry(0.055, 0.24, 0.025), M.accent, 0, 0.4, 0.18, torso); tie.rotation.x = 0.06;
  }
  if (acc.has('lapels')) for (const s of [-1, 1]) { const lp = part(new THREE.BoxGeometry(0.07, 0.26, 0.02), M.accent, s * 0.085, 0.42, 0.172, torso); lp.rotation.z = s * 0.3; }
  if (acc.has('badge')) part(new THREE.BoxGeometry(0.07, 0.09, 0.015), mat(0xffd166, { m: 0.5, r: 0.35 }), 0.11, 0.36, 0.175, torso);
  if (acc.has('glasses')) for (const s of [-1, 1]) { const gl = part(new THREE.TorusGeometry(0.058, 0.011, 6, 16), M.dark, s * 0.097, 0.285, 0.245, head); gl.castShadow = false; }
  if (acc.has('apron')) { const ap = part(new THREE.BoxGeometry(0.3, 0.36, 0.02), mat(0xfff6e0), 0, 0.22, 0.175, torso); ap.castShadow = false; }
  if (acc.has('cap')) {
    part(new THREE.SphereGeometry(0.283, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), M.accent, 0, 0.3, 0, head);
    const visor = part(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), M.accent, 0, 0.36, 0.2, head); visor.rotation.y = Math.PI / 2;
  }

  // Menos mallas por personaje: cada articulación fusiona sus piezas del mismo material.
  for (const joint of [head, torso, ...arms, ...legs]) mergeStatic(joint, { deep: false });

  root.scale.setScalar(L.scale);

  /* ---------- animación ---------- */
  const pose = { legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0.08, armRz: -0.08, lean: 0, bodyY: 0, headX: 0, headY: 0, squash: 1 };
  const state = { phase: 0, time: Math.random() * 10, emote: null, emoteTime: 0, anim: 'idle', blink: 2 + Math.random() * 3, lookYaw: 0 };

  function playEmote(name, seconds = 1.6) { state.emote = name; state.emoteTime = seconds; }

  /**
   * @param {number} dt
   * @param {{speed?:number, grounded?:boolean, sitting?:boolean, lookYaw?:number}} s
   */
  function update(dt, s = {}) {
    const speed = s.speed || 0, grounded = s.grounded !== false, moving = speed > 0.25;
    state.time += dt;
    if (state.emoteTime > 0) { state.emoteTime -= dt; if (state.emoteTime <= 0) state.emote = null; }
    const running = speed > 4.2;
    if (moving && grounded) state.phase += dt * (running ? 13.5 : 9.2) * Math.min(1.25, speed / (running ? 6 : 3.2));

    const T = { legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0.08, armRz: -0.08, lean: 0, bodyY: 0, headX: 0, headY: s.lookYaw || 0, squash: 1 };
    let anim = 'idle';
    if (s.sitting) {
      anim = 'sit'; T.legL = T.legR = -1.48; T.bodyY = -0.3; T.armLx = T.armRx = -0.5; T.lean = -0.06;
    } else if (!grounded) {
      anim = 'jump'; T.legL = 0.55; T.legR = -0.4; T.armLz = 1.5; T.armRz = -1.5; T.armLx = T.armRx = -0.4; T.lean = 0.1;
    } else if (moving) {
      anim = running ? 'run' : 'walk';
      const a = running ? 1.05 : 0.62, sw = Math.sin(state.phase);
      T.legL = sw * a; T.legR = -sw * a;
      T.armLx = -sw * a * (running ? 1.1 : 0.85); T.armRx = sw * a * (running ? 1.1 : 0.85);
      T.armLz = running ? 0.22 : 0.1; T.armRz = running ? -0.22 : -0.1;
      T.lean = running ? 0.26 : 0.07;
      T.bodyY = Math.abs(Math.cos(state.phase)) * (running ? 0.07 : 0.035);
    } else {
      const b = Math.sin(state.time * 2.1);
      T.bodyY = b * 0.012; T.armLz = 0.1 + b * 0.025; T.armRz = -0.1 - b * 0.025; T.headX = Math.sin(state.time * 0.7) * 0.04;
    }
    if (state.emote === 'wave') {
      anim = 'wave'; T.armRz = -2.55 + Math.sin(state.time * 11) * 0.32; T.armRx = 0; T.headY += 0.12;
    } else if (state.emote === 'celebrate') {
      anim = 'celebrate'; const hop = Math.abs(Math.sin(state.time * 7.5));
      T.armLz = 2.6 + Math.sin(state.time * 15) * 0.18; T.armRz = -2.6 - Math.sin(state.time * 15) * 0.18;
      T.bodyY = hop * 0.22; T.legL = hop * 0.25; T.legR = -hop * 0.15; T.squash = 1 + hop * 0.03;
    } else if (state.emote === 'interact') {
      anim = 'interact'; T.armRx = -1.25; T.armRz = -0.1; T.lean += 0.1;
    } else if (state.emote === 'talk') {
      T.armRx = -0.55 + Math.sin(state.time * 6) * 0.2; T.armRz = -0.25; T.headX = Math.sin(state.time * 5) * 0.05;
    }
    state.anim = anim;

    const r = anim === 'jump' ? 9 : 14;
    for (const k in T) pose[k] = damp(pose[k], T[k], r, dt);
    legs[0].rotation.x = pose.legL; legs[1].rotation.x = pose.legR;
    arms[0].rotation.x = pose.armLx; arms[1].rotation.x = pose.armRx;
    arms[0].rotation.z = -pose.armLz; arms[1].rotation.z = -pose.armRz;
    torso.rotation.x = pose.lean;
    body.position.y = pose.bodyY;
    body.scale.y = pose.squash;
    head.rotation.x = pose.headX - pose.lean * 0.6;
    head.rotation.y = pose.headY;
    if (s.sitting) { torso.rotation.x = pose.lean; }

    state.blink -= dt;
    const closed = state.blink < 0.11;
    for (const e of eyes) e.scale.y = closed ? 0.15 : 1.25;
    if (state.blink <= 0) state.blink = 2.4 + Math.random() * 3.2;
  }

  return { group: root, update, playEmote, get anim() { return state.anim; }, get emote() { return state.emote; }, head, look: L, height: 1.72 * L.scale };
}
