// Ciudad ICADEM · arranque del juego y ciclo principal.
import * as THREE from './three.js';
import { Engine, detectQuality, disposeTree } from './core/engine.js';
import { Input } from './core/input.js';
import { ThirdPersonCamera } from './core/camera.js';
import { Store } from './core/store.js';
import { createEconomy } from './economy/economy.js';
import { OfflineAdapter, StateSync } from './net/network.js';
import { createAvatar } from './characters/avatar.js';
import { avatarById } from './characters/catalog.js';
import { buildRoom } from './world/room.js';
import { buildPlaza } from './world/plaza.js';
import { buildBank } from './world/bank.js';
import { BUILDINGS, doorPoint } from './world/buildings.js';
import { marker } from './world/kit.js';
import { BankCreditMission } from './missions/bank-credit.js';
import { UI } from './ui/ui.js';
import { Tutorial } from './ui/tutorial.js';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const SCENES = { room: buildRoom, plaza: buildPlaza, bank: buildBank };
const PLAYER_RADIUS = 0.36, WALK = 3.5, RUN = 6.4, JUMP = 7.4, GRAVITY = 21;

function emitter() {
  const map = new Map();
  return { on(e, fn) { (map.get(e) || map.set(e, new Set()).get(e)).add(fn); }, emit(e, p) { map.get(e)?.forEach(fn => fn(p)); } };
}

// Salida al panel disponible desde el primer momento (también si el juego no logra cargar).
if (window.parent !== window) document.querySelectorAll('[data-exit]').forEach(b => {
  b.hidden = false;
  b.addEventListener('click', () => { try { window.parent.postMessage({ type: 'ciudad:exit' }, location.origin); } catch (_) {} });
});

async function boot() {
  const splash = (text, pct) => { $('splash-text').textContent = text; $('splash-bar').style.width = pct + '%'; };
  const params = new URLSearchParams(location.search);
  const embedded = window.parent !== window;

  const store = new Store();
  const engine = new Engine($('stage'));
  const input = new Input($('stage'), { stick: $('stick'), knob: $('stick-knob') });
  const camera = new ThirdPersonCamera(engine.camera);
  const events = emitter();
  const economy = createEconomy(store, 'test');
  const net = new OfflineAdapter();
  const sync = new StateSync(net);
  await net.connect();

  /* jugador */
  const avatar = createAvatar(avatarById(store.state.avatarId).look);
  engine.scene.add(avatar.group);
  const player = {
    position: avatar.group.position, yaw: Math.PI, vy: 0, grounded: true, speed: 0, seat: null,
    emote(name, seconds) { avatar.playEmote(name, seconds); }
  };

  const api = {
    engine, input, camera, store, economy, events, net, embedded, player,
    playerName: 'Explorador', sceneName: null, scene: null, waypoint: null,
    stats: { walked: 0, interactions: 0, maps: 0 },
    missions: {},
    travel, sit, mirror, setWaypoint, applySettings, startTutorial, exit
  };
  api.ui = new UI(api);
  api.missions.bank = new BankCreditMission(api);
  const tutorial = new Tutorial(api);
  events.on('map-opened', () => { api.stats.maps++; });

  /* identidad: solo lectura, viene del panel cuando el juego está incrustado */
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'ciudad:identity') return;
    const name = String(e.data.name || '').trim().slice(0, 28);
    if (name) { api.playerName = name; api.ui.refreshHud(); }
  });
  if (embedded) try { window.parent.postMessage({ type: 'ciudad:ready' }, location.origin); } catch (_) {}

  /* marcadores e interacción */
  const markers = new THREE.Group(); engine.scene.add(markers);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x2fe0c4, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  beam.visible = false; engine.scene.add(beam);
  let current = null, busyTravel = false, lastFpsCheck = 0, slowSeconds = 0;

  function applySettings() {
    const s = store.state.settings;
    engine.setQuality(s.quality === 'auto' ? detectQuality() : s.quality);
    camera.sensitivity = s.sensitivity; camera.invertY = s.invertY;
  }

  function mountScene(name, spawnKey) {
    if (api.scene) { engine.scene.remove(api.scene.group); disposeTree(api.scene.group); if (api.sceneName === 'bank') api.missions.bank.leave(); }
    disposeTree(markers); markers.clear(); current = null;
    const scene = SCENES[name](api);
    api.scene = scene; api.sceneName = name;
    engine.scene.add(scene.group);
    engine.scene.background = new THREE.Color(scene.background);
    engine.scene.fog = scene.fog ? new THREE.Fog(scene.fog.color, scene.fog.near, scene.fog.far) : null;
    for (const it of scene.interactables) { const m = marker(it.color ?? 0xffc93c); m.position.set(it.x, (it.y ?? 1.4) + 0.75, it.z); m.userData.it = it; m.userData.baseY = m.position.y; markers.add(m); }
    const sp = scene.spawns[spawnKey] || scene.spawns.default;
    player.position.set(sp.x, 0, sp.z); player.yaw = sp.yaw; player.vy = 0; player.grounded = true; player.seat = null;
    avatar.group.rotation.y = player.yaw;
    camera.configure({ ...scene.camera, yaw: sp.yaw + Math.PI });
    camera.release(); camera.snap(player.position);
    engine.setQuality(engine.quality);
    if (name === 'bank') api.missions.bank.enter();
    beam.visible = Boolean(api.waypoint) && name === 'plaza';
    api.ui.setPlace(scene.title);
  }

  async function travel(name, spawnKey = 'default') {
    if (busyTravel) return;
    busyTravel = true; input.setEnabled(false);
    await api.ui.fade(true);
    try { mountScene(name, spawnKey); } finally {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await api.ui.fade(false);
      input.setEnabled(!api.ui.isBlocking); busyTravel = false;
    }
  }

  function sit(spot) {
    player.seat = spot; player.position.set(spot.x, spot.seatY || 0, spot.z); player.yaw = spot.yaw;
    api.ui.toast('Descansando. Muévete para levantarte.', 2200);
  }

  function mirror(mirrorPos, stand) {
    const p = player.position;
    // El avatar se coloca frente al espejo y la cámara lo ve desde el cristal.
    const spot = api.scene.collision.resolve(stand.x, stand.z, PLAYER_RADIUS);
    p.set(spot.x, 0, spot.z); player.seat = null;
    player.yaw = Math.atan2(mirrorPos.x - p.x, mirrorPos.z - p.z);
    camera.frame(new THREE.Vector3(mirrorPos.x, 1.25, mirrorPos.z), new THREE.Vector3(p.x, 0.92, p.z), 3.6);
    player.emote('wave', 2.8);
    api.ui.toast(`${avatarById(store.state.avatarId).name}: así te ven en la ciudad.`, 3000);
  }

  function setWaypoint(w) {
    api.waypoint = w;
    beam.visible = Boolean(w) && api.sceneName === 'plaza';
    if (w) beam.position.set(w.x, 13, w.z);
    if (!w) api.ui.setWaypoint(null);
  }

  function startTutorial(force) { if (force || !store.state.tutorialDone) { if (api.sceneName !== 'room') travel('room').then(() => tutorial.start()); else tutorial.start(); } }

  function exit() { if (embedded) try { window.parent.postMessage({ type: 'ciudad:exit' }, location.origin); } catch (_) {} }

  /* ---------- ciclo ---------- */
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  engine.onUpdate((dt, t) => {
    const scene = api.scene; if (!scene) return;
    input.update();
    if (input.consume('map')) api.ui.openMap();
    if (input.consume('passport')) api.ui.openPassport();

    /* movimiento relativo a la cámara */
    camera.forward(fwd); camera.right(right);
    let dx = fwd.x * input.move.z + right.x * input.move.x, dz = fwd.z * input.move.z + right.z * input.move.x;
    const mag = Math.min(1, Math.hypot(dx, dz));
    const p = player.position;
    if (player.seat) {
      if (mag > 0.2 || input.presses.has('jump')) { const s = player.seat; player.seat = null; p.y = 0; const out = scene.collision.resolve(s.x + Math.sin(s.yaw) * 0.9, s.z + Math.cos(s.yaw) * 0.9, PLAYER_RADIUS); p.x = out.x; p.z = out.z; input.consume('jump'); }
      player.speed = 0;
    } else {
      if (mag > 0.05) {
        const speed = (input.running ? RUN : WALK) * mag;
        const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
        const nx = p.x + dx * speed * dt, nz = p.z + dz * speed * dt;
        const out = scene.collision.resolve(nx, nz, PLAYER_RADIUS);
        const moved = Math.hypot(out.x - p.x, out.z - p.z);
        api.stats.walked += moved;
        player.speed = moved / Math.max(dt, 1e-4);
        p.x = out.x; p.z = out.z;
        player.yaw += angleDelta(player.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 13);
        if (camera.override && moved > 0.01) camera.release();
      } else player.speed = 0;
      if (input.consume('jump') && player.grounded) { player.vy = JUMP; player.grounded = false; }
      if (!player.grounded) { player.vy -= GRAVITY * dt; p.y += player.vy * dt; if (p.y <= 0) { p.y = 0; player.vy = 0; player.grounded = true; } }
    }
    avatar.group.rotation.y = player.yaw;
    avatar.update(dt, { speed: player.speed, grounded: player.grounded, sitting: Boolean(player.seat) });

    for (const n of scene.npcs) n.update(dt, p);
    scene.update(dt, t, p);

    /* interacción más cercana */
    let best = null, bestScore = Infinity;
    if (!api.ui.isBlocking && !busyTravel) for (const it of scene.interactables) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > it.radius) continue;
      const score = d - (it.highlight?.() ? 1.2 : 0);
      if (score < bestScore) { bestScore = score; best = it; }
    }
    current = best;
    api.ui.setInteract(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
    if (input.consume('interact') && best) { api.stats.interactions++; avatar.playEmote('interact', 0.45); best.action(); }
    for (const m of markers.children) {
      const it = m.userData.it, hot = it.highlight ? it.highlight() : false, isCurrent = it === current;
      m.position.y = m.userData.baseY + Math.sin(t * 2.6 + it.x) * 0.1;
      m.rotation.y = t * 1.6;
      const s = (hot ? 1.5 : 1) * (isCurrent ? 1.25 : 1);
      m.scale.setScalar(m.scale.x + (s - m.scale.x) * Math.min(1, dt * 8));
      // Oculta los rombos que quedan entre la cámara y el jugador para que no tapen la vista.
      const camToMarker = engine.camera.position.distanceTo(m.position), camToPlayer = engine.camera.position.distanceTo(p);
      m.visible = camToMarker > camToPlayer * 0.78 && (!player.seat || !isCurrent);
    }

    camera.update(dt, p, input.consumeLook(), input.consumeZoom());

    /* edificios descubiertos y destino */
    if (api.sceneName === 'plaza') {
      for (const b of BUILDINGS) {
        if (store.state.visited.includes(b.id)) continue;
        const d = doorPoint(b, 2.5);
        if (Math.hypot(d.x - p.x, d.z - p.z) < 5.5 && store.visit(b.id)) {
          store.addXp(10); api.ui.toast(`Edificio descubierto: ${b.name} (+10 XP)`); api.ui.refreshHud();
          if (store.state.visited.length === BUILDINGS.length && store.unlock('explorador-urbano')) api.ui.toast('Logro desbloqueado: Explorador urbano');
        }
      }
      const w = api.waypoint;
      if (w) {
        const ddx = w.x - p.x, ddz = w.z - p.z, dist = Math.hypot(ddx, ddz);
        if (dist < 3.2) { api.ui.toast('Llegaste a ' + w.name + '.'); setWaypoint(null); }
        else {
          // ángulo del destino respecto a hacia dónde mira la cámara (0 = de frente)
          const angle = Math.atan2(ddx * right.x + ddz * right.z, ddx * fwd.x + ddz * fwd.z);
          api.ui.setWaypoint({ text: `${w.name} · ${Math.round(dist)} m`, angle });
          beam.material.opacity = 0.24 + Math.sin(t * 3) * 0.08;
        }
      }
    } else if (api.waypoint) api.ui.setWaypoint({ text: `${api.waypoint.name} · sal a la ciudad`, angle: 0 });

    tutorial.update();

    /* calidad automática: si el equipo no alcanza, baja un nivel en vez de trabarse */
    if (store.state.settings.quality === 'auto' && engine.fps && t - lastFpsCheck > 1) {
      lastFpsCheck = t;
      slowSeconds = engine.fps < 24 ? slowSeconds + 1 : 0;
      if (slowSeconds >= 4 && engine.quality !== 'low') {
        slowSeconds = 0;
        engine.setQuality(engine.quality === 'high' ? 'medium' : 'low');
        api.ui.toast('Ajustamos la calidad gráfica para que el juego corra más fluido.');
      }
    }
    sync.update(dt, () => ({ scene: api.sceneName, x: p.x, y: p.y, z: p.z, yaw: player.yaw, anim: avatar.anim }));
  });

  /* ---------- arranque ---------- */
  splash('Cargando tipografías…', 25);
  try { await Promise.race([document.fonts.load('800 48px Outfit'), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
  splash('Construyendo tu habitación…', 55);
  await new Promise(r => setTimeout(r, 30));
  applySettings();
  const startScene = SCENES[params.get('scene')] ? params.get('scene') : 'room';
  mountScene(startScene, params.get('spawn') || 'default');
  engine.start();
  splash('Listo', 100);
  api.ui.showHud();
  if (params.get('debug') === '1') window.__ciudad = { api, tutorial, avatar, mountScene };

  const enter = () => {
    $('splash').classList.add('is-out'); setTimeout(() => { $('splash').hidden = true; }, 520);
    $('stage').focus({ preventScroll: true });
    if (!store.state.tutorialDone && startScene === 'room' && params.get('tutorial') !== '0') tutorial.start();
  };
  if (params.get('autostart') === '1') enter();
  else { $('splash-go').hidden = false; $('splash-go').addEventListener('click', enter, { once: true }); $('splash-go').focus({ preventScroll: true }); }
}

// El juego se abre desde la pestaña del panel. Si alguien entra directo a la dirección del juego
// en producción, se le manda al panel (no es una medida de seguridad: aquí no hay datos reales).
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const STANDALONE = window.parent === window && !LOCAL && new URLSearchParams(location.search).get('debug') !== '1';

if (STANDALONE) {
  $('splash-text').textContent = 'Ciudad ICADEM se juega desde tu panel ICADEM.';
  $('splash-bar').parentElement.hidden = true;
  const go = $('splash-go');
  go.textContent = 'Ir a mi panel'; go.hidden = false;
  go.addEventListener('click', () => { location.href = '../vip-panel.html#ciudad'; });
} else boot().catch(error => {
  console.error('[Ciudad ICADEM]', error);
  $('splash').hidden = true; $('fatal').hidden = false;
  $('fatal-text').textContent = /WebGL|context/i.test(String(error?.message))
    ? 'Tu navegador no pudo iniciar los gráficos 3D. Prueba con otro navegador o actívalos en la configuración.'
    : 'Ocurrió un error al cargar el juego. Recarga la página; si continúa, avísale a soporte.';
});
