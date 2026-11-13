// Ciudad ICADEM · arranque del juego y ciclo principal.
import * as THREE from './three.js';
import { Engine, detectQuality, disposeTree } from './core/engine.js';
import { Input } from './core/input.js';
import { ThirdPersonCamera } from './core/camera.js';
import { Store } from './core/store.js';
import { createEconomy, REWARDS } from './economy/economy.js';
import { OfflineAdapter, StateSync } from './net/network.js';
import { WsAdapter, devTicketProvider, askPanelForServer, panelTicketProvider } from './net/ws-adapter.js';
import { RemotePlayers } from './characters/remote.js';
import { Social } from './ui/social.js';
import { ChatPanel } from './ui/chat.js';
import { createAvatar } from './characters/avatar.js';
import { avatarById } from './characters/catalog.js';
import { applyCustom, cleanCustom, isAvatarUnlocked } from './progress/rules.js';
import { buildRoom } from './world/room.js';
import { buildPlaza } from './world/plaza.js';
import { buildBank } from './world/bank.js';
import { buildCourt } from './world/court.js';
import { buildMarket } from './world/market.js';
import { buildSite } from './world/site.js';
import { buildHospital } from './world/hospital.js';
import { buildVet } from './world/vet.js';
import { VetWelfareMission } from './missions/vet-welfare.js';
import { VET_WELFARE_MISSION } from './missions/vet-welfare-logic.js';
import { buildRestaurant } from './world/restaurant.js';
import { KitchenRushMission } from './missions/kitchen-rush.js';
import { KITCHEN_RUSH_MISSION } from './missions/kitchen-rush-logic.js';
import { buildGreenhouse } from './world/greenhouse.js';
import { GreenhouseMission } from './missions/greenhouse.js';
import { GREENHOUSE_MISSION } from './missions/greenhouse-logic.js';
import { buildOffice } from './world/office.js';
import { LostFileMission } from './missions/lost-file.js';
import { LOST_FILE_MISSION } from './missions/lost-file-logic.js';
import { buildTower } from './world/tower.js';
import { TowerChallengeMission } from './missions/tower-challenge.js';
import { TOWER_CHALLENGE_MISSION } from './missions/tower-challenge-logic.js';
import { placeByScene, SCENE_TITLES } from './world/places.js';
import { COOP_MISSIONS } from './net/scenes.js';
import { groundHeight, pushOut } from './core/platforms.js';
import { EduService } from './edu/service.js';
import { NpcQuiz } from './edu/npc-quiz.js';
import { Games } from './edu/games.js';
import { buildPark } from './world/park.js';
import { buildDistrito } from './world/distrito.js';
import { District } from './edu/district.js';
import { BUILDINGS, doorPoint } from './world/buildings.js';
import { marker, CUTOUT } from './world/kit.js';
import { BankCreditMission } from './missions/bank-credit.js';
import { BANK_CREDIT_MISSION } from './missions/bank-credit-logic.js';
import { CourtJudgeMission } from './missions/court-judge.js';
import { MarketInventoryMission } from './missions/market-inventory.js';
import { SiteInspectorMission } from './missions/site-inspector.js';
import { HospitalShiftMission } from './missions/hospital-shift.js';
import { COURT_JUDGE_MISSION } from './missions/court-judge-logic.js';
import { MARKET_INVENTORY_MISSION } from './missions/market-inventory-logic.js';
import { SITE_INSPECTOR_MISSION } from './missions/site-inspector-logic.js';
import { HOSPITAL_SHIFT_MISSION } from './missions/hospital-shift-logic.js';
import { defineMission, MissionRegistry, MissionService } from './missions/engine.js';
import { UI } from './ui/ui.js';
import { Tutorial } from './ui/tutorial.js';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const angleDelta = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const SCENES = { room: buildRoom, plaza: buildPlaza, bank: buildBank, court: buildCourt, market: buildMarket, site: buildSite, hospital: buildHospital , vet: buildVet , restaurant: buildRestaurant , greenhouse: buildGreenhouse , office: buildOffice , tower: buildTower, park: buildPark, distrito: buildDistrito };
const PLAYER_RADIUS = 0.36, WALK = 3.3, RUN = 6.4, JUMP = 7.4, GRAVITY = 21;
const ACCEL = 30, BRAKE = 38, AIR_CONTROL = 9, JUMP_BUFFER = 0.14;

function decodeFix(s) { return Array.isArray(s) && s.length >= 4 ? { scene: String(s[0]), x: s[1] * 0.01, y: s[2] * 0.01, z: s[3] * 0.01 } : null; }

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

  // Perfil infantil supervisado (?perfil=kXXXXXXXX): solo funciona si el servidor tiene activo el modo familiar.
  const kidProfile = /^k[0-9a-f]{8}$/.test(params.get('perfil') || '') ? params.get('perfil') : null;
  const store = new Store(undefined, { profile: kidProfile });
  store.state.profileKind = kidProfile ? 'infantil' : 'adulto';
  const engine = new Engine($('stage'));
  const input = new Input($('stage'), { stick: $('stick'), knob: $('stick-knob') });
  const camera = new ThirdPersonCamera(engine.camera);
  const events = emitter();
  const economy = createEconomy(store, 'test');
  /* Red: en producción el juego sigue sin conexión (OfflineAdapter). El multijugador solo se
     activa en pruebas locales, con ?mp=ws://127.0.0.1:PUERTO, contra el servidor de prueba. */
  const mpUrl = LOCAL ? params.get('mp') : null;
  // En el panel: solo hay red si el panel declara un servidor; la identidad la certifica ese servidor.
  const panelWs = !mpUrl && embedded ? await askPanelForServer() : null;
  const net = mpUrl && /^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(mpUrl)
    ? new WsAdapter({ url: mpUrl, avatar: store.state.avatarId, kid: kidProfile, getTicket: devTicketProvider(mpUrl, (params.get('uid') || 'local').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'local', (params.get('name') || 'Jugador de prueba').slice(0, 28)) })
    : (panelWs ? new WsAdapter({ url: panelWs, getTicket: panelTicketProvider(), kid: kidProfile }) : new OfflineAdapter());
  const sync = new StateSync(net);

  /* jugador */
  const lookNow = () => applyCustom(avatarById(store.state.avatarId).look, store.state.custom);
  let avatar = createAvatar(lookNow());
  engine.scene.add(avatar.group);
  const player = {
    position: avatar.group.position, yaw: Math.PI, vx: 0, vz: 0, vy: 0, grounded: true, speed: 0, seat: null, jumpBuffer: 0,
    emote(name, seconds) { avatar.playEmote(name, seconds); }
  };

  const api = {
    engine, input, camera, store, economy, events, net, embedded, player,
    playerName: 'Explorador', sceneName: null, scene: null, waypoint: null,
    stats: { walked: 0, interactions: 0, maps: 0 },
    missions: {},
    travel, sit, mirror, setWaypoint, applySettings, startTutorial, exit, setAvatar, applyProfile,
    get avatar() { return avatar; }
  };

  /* avatar y equipamiento: un solo esqueleto; cambiar de personaje es cambiar su apariencia */
  function rebuildAvatar() {
    const old = avatar, next = createAvatar(lookNow());
    next.group.position.copy(old.group.position); next.group.rotation.y = old.group.rotation.y;
    engine.scene.remove(old.group); old.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    engine.scene.add(next.group); avatar = next; player.position = next.group.position;
  }
  /** Cambia avatar o equipamiento. Con conexión lo autoriza el servidor; sin ella, las reglas locales. */
  function setAvatar(id, custom) {
    const c = cleanCustom(custom ?? store.state.custom);
    if (!isAvatarUnlocked(id, store.state)) { api.ui.toast('Ese avatar todavía está bloqueado.'); return false; }
    store.state.avatarId = id; store.state.custom = c; store.state.avatarChosen = true; store.save(); rebuildAvatar(); api.ui.refreshHud();
    if (net.isOnline) net.profile('avatar', { id, custom: c });
    return true;
  }
  /** El servidor es la fuente del progreso cuando hay conexión: lo recibido sustituye a lo local. */
  function applyProfile(profile) {
    if (!profile || typeof profile !== 'object') return;
    const st = store.state, look = st.avatarId + JSON.stringify(st.custom);
    st.xp = profile.xp; st.missions = { ...profile.missions }; st.visited = [...profile.visited]; st.discovered = Array.isArray(profile.discovered) ? [...profile.discovered] : (st.discovered || []); st.achievements = [...profile.achievements];
    st.tutorialDone = st.tutorialDone || profile.tutorialDone; st.avatarId = profile.avatarId; st.custom = cleanCustom(profile.custom); st.avatarChosen = Boolean(st.avatarChosen || profile.avatarChosen);
    st.economy.balance = profile.testCredits; st.synced = true; if (profile.play) st.play = profile.play; if (profile.privacy) st.privacyListed = profile.privacy.listed !== false; store.save();
    if (look !== st.avatarId + JSON.stringify(st.custom)) rebuildAvatar();
    api.ui.refreshHud(); Object.values(api.missions).forEach(m => m.refreshTracker && m.refreshTracker());
  }
  /* misiones: un solo motor para todos los juegos; cada edificio registra la suya */
  const registry = new MissionRegistry();
  const bankDef = registry.register(defineMission(BANK_CREDIT_MISSION));
  api.missionService = new MissionService({
    registry, economy, rewards: REWARDS,
    progress: {
      get: id => store.state.missions[id],
      set: (id, record) => { store.state.missions[id] = record; store.save(); },
      addXp: xp => store.addXp(xp)
    }
  });
  api.ui = new UI(api);
  api.missions.bank = new BankCreditMission(api, bankDef);
  api.missions.court = new CourtJudgeMission(api, registry.register(defineMission(COURT_JUDGE_MISSION)));
  api.missions.market = new MarketInventoryMission(api, registry.register(defineMission(MARKET_INVENTORY_MISSION)));
  api.missions.site = new SiteInspectorMission(api, registry.register(defineMission(SITE_INSPECTOR_MISSION)));
  api.missions.hospital = new HospitalShiftMission(api, registry.register(defineMission(HOSPITAL_SHIFT_MISSION)));
  api.missions.vet = new VetWelfareMission(api, registry.register(defineMission(VET_WELFARE_MISSION)));
  api.missions.restaurant = new KitchenRushMission(api, registry.register(defineMission(KITCHEN_RUSH_MISSION)));
  api.missions.greenhouse = new GreenhouseMission(api, registry.register(defineMission(GREENHOUSE_MISSION)));
  api.missions.office = new LostFileMission(api, registry.register(defineMission(LOST_FILE_MISSION)));
  api.missions.tower = new TowerChallengeMission(api, registry.register(defineMission(TOWER_CHALLENGE_MISSION)));
  api.edu = new EduService(api); api.npcQuiz = new NpcQuiz(api); api.games = new Games(api); api.district = new District(api);
  const remotes = new RemotePlayers(engine.scene, net);
  const social = new Social(api, remotes);
  api.remotes = remotes; api.social = social;
  const chat = new ChatPanel(api, social); api.chat = chat;
  if (net instanceof WsAdapter) {
    net.on('status', st => { if (st.status === 'online' && net.name) { api.playerName = net.name; api.ui.refreshHud(); } });   // el nombre lo dicta el servidor
    net.on('profile', m => { if (m.profile) applyProfile(m.profile); if (m.op === 'avatar' && m.ok === false) api.ui.toast('El servidor no autorizó ese avatar.'); });
    net.on('party', m => { if (m.op === 'rally') { api.ui.toast(`${m.by} reúne al equipo en la plaza.`, 3600); if (api.sceneName !== 'plaza' && !api.ui.isBlocking) travel('plaza', (placeByScene(api.sceneName) || { spawn: 'home' }).spawn); } });
    /* misiones en equipo: el servidor guarda el intento; aquí solo se refleja y se muestra */
    const COOP_ERRORS = { 'no-es-tu-rol': 'Ese paso le toca a otro rol del equipo.', 'faltan-aprobaciones': 'Falta que todo el equipo apruebe.', 'no-procede': 'Ese paso todavía no procede.', 'sin-intento': 'No hay una misión en equipo en curso.', 'bitacora-llena': 'El intento llegó a su límite de acciones.' };
    const ACTION_TEXT = { brief: 'recibió el reto', budget: 'envió el presupuesto', permits: 'envió los permisos', schedule: 'envió el calendario', message: 'envió el aviso a vecinos', reopen: 'pidió rehacer una parte', approve: 'aprobó el plan', present: 'presentó el plan',
      takeCase: 'tomó el expediente', readBackground: 'leyó los antecedentes', examineExhibit: 'examinó una prueba', openHearing: 'abrió la audiencia', hearParty: 'presentó a su parte', ruleObjection: 'resolvió una objeción', examineWitness: 'subió al estrado', askWitness: 'interrogó al testigo', confront: 'confrontó declaraciones', weigh: 'valoró una prueba', rule: 'dictó sentencia' };
    const coopOf = id => Object.values(api.missions).find(c => c.id === id);
    net.on('coop', m => {
      if (m.op === 'none') { Object.values(api.missions).forEach(c => { if (c.coop && !c.coop.result) c.leaveCoop(); }); return; }
      const c = coopOf(m.mission), spec = COOP_MISSIONS[m.mission]; if (!c || !spec) return;
      if (m.op === 'done') { c.coopDone(m); c.closeFromTeam(); return; }
      const role = m.roles ? m.roles[net.pid] : null; if (!role) return;
      if (m.op === 'start' || !c.coop || c.coop.session !== m.session) {
        if (c.joinCoop(m, role)) {
          api.ui.toast(`Misión en equipo: ${spec.title}. Tu rol: ${c.coopRoleName}.`, 4200);
          const place = placeByScene(spec.scene); if (place && api.sceneName !== spec.scene) setTimeout(() => api.ui.toast(`Reúnanse en ${place.title}.`, 3600), 4300);
        }
      } else c.syncCoop(m);
      if (m.op === 'rejected') api.ui.toast(COOP_ERRORS[m.reason] || 'El servidor no aceptó esa acción.', 2800);
      else if (m.op === 'state' && m.last && m.last.pid !== net.pid) api.ui.toast(`${m.last.name} (${c.coopRoleNameOf(m.last.role)}) ${ACTION_TEXT[m.last.type] || 'avanzó'}.`, 2400);
    });
    net.on('room', () => {
      const room = net.roomState;
      Object.values(api.missions).forEach(c => { if (c.coop && !c.coop.result && !c.coop.finishing && (!room || room.session !== c.coop.session)) { c.leaveCoop(); api.ui.toast('La misión en equipo terminó.', 3000); } });
    });
    net.on('fix', m => { const f = decodeFix(m.s); if (f && f.scene === api.sceneName) { player.position.set(f.x, f.y, f.z); player.vx = player.vz = 0; } });
  }
  /* perfil infantil sin modo familiar activo en el servidor: se vuelve al perfil del adulto */
  if (kidProfile) net.on('status', st => { if (st.status === 'closed' && (st.detail === 'familia-desactivada' || st.detail === 'perfil-infantil-invalido')) { api.ui.toast('Los perfiles infantiles todavía no están activos. Entrarás con tu perfil.', 3600); setTimeout(() => { const u = new URL(location.href); u.searchParams.delete('perfil'); location.replace(u.toString()); }, 2500); } });
  /* invitación por enlace (?unirme=CÓDIGO): se pregunta antes y se canjea con la sesión propia */
  const inviteCode = String(params.get('unirme') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-HJ-NP-Z2-9]{8}$/.test(inviteCode)) {
    let asked = false;
    const offInvite = net.on('status', async st => {
      if (asked) return;
      if (st.status === 'closed') { asked = true; offInvite(); setTimeout(() => api.ui.toast('Para unirte a un equipo con código necesitas acceso al multijugador de Ciudad ICADEM.', 4200), 1500); return; }
      if (st.status !== 'online') return;
      asked = true; offInvite();
      await new Promise(r => setTimeout(r, 1200));
      const pick = await api.ui.choice({ speaker: 'Invitación', text: `Abriste una invitación a un equipo (código ${inviteCode.slice(0, 4)}-${inviteCode.slice(4)}). ¿Quieres unirte?`, options: [{ id: 'si', label: 'Unirme al equipo', hint: 'Entrarás a la misma ciudad que quien te invitó', primary: true }, { id: 'no', label: 'Ahora no' }] });
      if (pick === 'si') net.code('redeem', { code: inviteCode });
    });
  }
  net.connect();
  const tutorial = new Tutorial(api); api.tutorial = tutorial;
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
    if (api.scene) { engine.scene.remove(api.scene.group); disposeTree(api.scene.group); api.missions[api.sceneName]?.leave(); }
    disposeTree(markers); markers.clear(); current = null;
    const scene = SCENES[name](api);
    api.scene = scene; api.sceneName = name; api.remotes?.setScene(name); api.npcQuiz?.reset();
    engine.scene.add(scene.group);
    engine.scene.background = new THREE.Color(scene.background);
    engine.scene.fog = scene.fog ? new THREE.Fog(scene.fog.color, scene.fog.near, scene.fog.far) : null;
    for (const it of scene.interactables) { const m = marker(it.color ?? 0xffc93c); m.position.set(it.x, (it.y ?? 1.4) + 0.75, it.z); m.userData.it = it; m.userData.baseY = m.position.y; markers.add(m); }
    const sp = scene.spawns[spawnKey] || scene.spawns.default;
    player.position.set(sp.x, 0, sp.z); player.yaw = sp.yaw; player.vx = player.vz = player.vy = 0; player.grounded = true; player.seat = null;
    avatar.group.rotation.y = player.yaw;
    camera.configure({ ...scene.camera, world: scene.collision, yaw: sp.yaw + Math.PI });
    camera.override = null; camera.ease = 0; camera.snap(player.position);
    engine.setQuality(engine.quality);
    api.missions[name]?.enter();
    beam.visible = Boolean(api.waypoint) && name === 'plaza';
    api.ui.setPlace(scene.title);
  }

  async function travel(name, spawnKey = 'default') {
    if (busyTravel) return;
    busyTravel = true; input.setEnabled(false);
    const mission = api.missions[name];
    await api.ui.fade(true, SCENE_TITLES[name] ? { title: SCENE_TITLES[name], sub: mission ? 'Misión · ' + mission.def.title : (name === 'plaza' ? 'Plaza principal' : '') } : null);
    try { mountScene(name, spawnKey); } finally {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await api.ui.fade(false);
      input.setEnabled(!api.ui.isBlocking); busyTravel = false;
    }
  }

  function sit(spot, quiet) {
    player.seat = spot; player.position.set(spot.x, spot.seatY || 0, spot.z); player.yaw = spot.yaw; player.vx = player.vz = 0;
    if (!quiet) api.ui.toast('Descansando. Muévete para levantarte.', 2200);
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
    if (input.consume('say')) social.toggle();
    if (input.consume('chat')) chat.focus();
    for (let i = 0; i < 6; i++) if (input.consume('say' + (i + 1))) { social.sayIndex(i); social.toggle(false); }

    /* movimiento relativo a la cámara */
    camera.forward(fwd); camera.right(right);
    let dx = fwd.x * input.move.z + right.x * input.move.x, dz = fwd.z * input.move.z + right.z * input.move.x;
    const mag = Math.min(1, Math.hypot(dx, dz));
    const p = player.position;
    if (player.seat) {
      if (mag > 0.2 || input.presses.has('jump')) { const s = player.seat; player.seat = null; p.y = 0; const out = scene.collision.resolve(s.x + Math.sin(s.yaw) * 0.9, s.z + Math.cos(s.yaw) * 0.9, PLAYER_RADIUS); p.x = out.x; p.z = out.z; input.consume('jump'); }
      player.speed = 0; player.vx = player.vz = 0;
    } else {
      /* velocidad con aceleración y frenado: arranca y se detiene sin saltos ni deslizamientos */
      let tx = 0, tz = 0;
      if (mag > 0.05) { const len = Math.hypot(dx, dz) || 1, top = (input.running ? RUN : WALK) * mag; tx = dx / len * top; tz = dz / len * top; }
      const rate = (player.grounded ? (mag > 0.05 ? ACCEL : BRAKE) : AIR_CONTROL) * dt;
      const ex = tx - player.vx, ez = tz - player.vz, el = Math.hypot(ex, ez);
      if (el <= rate) { player.vx = tx; player.vz = tz; } else { player.vx += ex / el * rate; player.vz += ez / el * rate; }
      if (Math.hypot(player.vx, player.vz) > 0.02) {
        const out = scene.collision.resolve(p.x + player.vx * dt, p.z + player.vz * dt, PLAYER_RADIUS);
        const mx = out.x - p.x, mz = out.z - p.z, moved = Math.hypot(mx, mz), safeDt = Math.max(dt, 1e-4);
        api.stats.walked += moved;
        // La velocidad real es la que quedó tras chocar: contra un muro el avatar no "camina en su lugar".
        player.vx = mx / safeDt; player.vz = mz / safeDt; player.speed = moved / safeDt;
        p.x = out.x; p.z = out.z;
        if (camera.override && moved > 0.01) camera.release();
      } else { player.vx = player.vz = 0; player.speed = 0; }
      if (mag > 0.05) player.yaw += angleDelta(player.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      /* salto con margen: si se pide justo antes de tocar el suelo, sale al aterrizar */
      if (input.consume('jump')) player.jumpBuffer = JUMP_BUFFER; else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
      if (player.jumpBuffer > 0 && player.grounded) { player.vy = JUMP; player.grounded = false; player.jumpBuffer = 0; }
      if (scene.platforms && pushOut(scene.platforms, p, PLAYER_RADIUS)) { player.vx *= 0.3; player.vz *= 0.3; }   // las plataformas altas son muro
      // Piso: el suelo (0) o la cara de una plataforma (Parque de retos). Al salir por la orilla, se cae.
      const floor = scene.platforms ? groundHeight(scene.platforms, p.x, p.z, p.y) : 0;
      if (player.grounded && p.y > floor + 0.05) player.grounded = false;
      if (!player.grounded) { player.vy -= GRAVITY * dt; p.y += player.vy * dt; if (p.y <= floor) { p.y = floor; player.vy = 0; player.grounded = true; } }
    }
    avatar.group.rotation.y = player.yaw;
    avatar.update(dt, { speed: player.speed, grounded: player.grounded, sitting: Boolean(player.seat) });

    for (const n of scene.npcs) n.update(dt, p);
    api.npcQuiz.update(dt); api.games.update(dt, t); api.district.update(dt, t);
    remotes.update(dt);
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
      m.visible = !camera.override && camToMarker > camToPlayer * 0.78 && (!player.seat || !isCurrent);
    }

    camera.update(dt, p, input.consumeLook(), input.consumeZoom());
    /* obstáculos translúcidos entre la cámara y el jugador; si la cámara queda pegada, se oculta el avatar */
    engine.camera.updateMatrixWorld();
    CUTOUT.player.value.set(p.x, p.y + 1.12, p.z).applyMatrix4(engine.camera.matrixWorldInverse);
    CUTOUT.radius.value = camera.override ? 0 : 0.72;
    avatar.group.visible = Boolean(camera.override) || camera.arm > 0.95;
    social.update(dt);

    /* edificios descubiertos y destino */
    if (api.sceneName === 'plaza') {
      for (const b of BUILDINGS) {
        if (store.state.visited.includes(b.id)) continue;
        const d = doorPoint(b, 2.5);
        if (Math.hypot(d.x - p.x, d.z - p.z) < 5.5 && store.visit(b.id)) {
          if (net.isOnline) net.profile('visit', { id: b.id });
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
  if (params.get('debug') === '1') window.__ciudad = { api, tutorial, get avatar() { return avatar; }, mountScene, remotes, social };

  // Primera vez: elegir personaje (gratuito) antes del tutorial. Con conexión se espera un momento al
  // perfil del servidor: si ya eligió en otro dispositivo, no se le vuelve a preguntar.
  const waitProfile = () => new Promise(resolve => {
    if (!(net instanceof WsAdapter) || store.state.synced) return resolve();
    const t0 = performance.now(), poll = () => (store.state.synced || net.status === 'closed' || performance.now() - t0 > 3500) ? resolve() : setTimeout(poll, 120); poll();
  });
  const needsPick = () => !store.state.avatarChosen && !store.state.tutorialDone && params.get('tutorial') !== '0' && params.get('avatar') !== '0';
  const enter = async () => {
    $('splash').classList.add('is-out'); setTimeout(() => { $('splash').hidden = true; }, 520);
    $('stage').focus({ preventScroll: true });
    await waitProfile();
    if (needsPick()) await api.ui.openWardrobe({ first: true });
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
