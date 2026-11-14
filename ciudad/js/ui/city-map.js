// Presentation of the existing plaza. Coordinates, destinations and mission
// completion come from the game; this view only selects an existing waypoint.
import { BUILDINGS, doorPoint, footprint } from '../world/buildings.js';
import { placeByBuilding, SCENE_TITLES } from '../world/places.js';

const h = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const HALF = 48, SIZE = 800, K = SIZE / (HALF * 2);
const at = value => (value + HALF) * K;
const rgba = (hex, amount) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${amount})`; };

/** A read-only projection of the same destinations previously in UI.openMap. */
export function mapDestinations(api) {
  const st = api.store.state;
  const completed = building => {
    const place = placeByBuilding(building.id), mission = place && api.missions && api.missions[place.scene];
    const id = mission && mission.def && mission.def.id;
    return Boolean(id && st.missions[id] && st.missions[id].completed);
  };
  return [
    ...BUILDINGS.map(b => ({ kind: 'building', id: b.id, icon: b.icon, name: b.name, text: b.status === 'open' ? 'Misión: ' + b.mission : 'Próximamente', x: b.x, z: b.z, b, done: completed(b), open: b.status === 'open', way: doorPoint(b, 2.2) })),
    { kind: 'activity', id: 'parque', icon: '🏃', name: 'Parque de retos', text: 'Carrera del conocimiento: arcos, plataformas y meta. Entrada al norte de la plaza.', x: 0, z: 38.5, open: true, way: { x: 0, z: 34.5 } },
    { kind: 'activity', id: 'fuente', icon: '⛲', name: 'Punto de encuentro', text: 'La fuente de la plaza: aquí se reúne tu equipo y empieza la Búsqueda del tesoro.', x: 0, z: 0, open: true, way: { x: 0, z: 6 } },
    { kind: 'activity', id: 'distrito', icon: '🧪', name: 'Distrito del Saber', text: 'Laberinto del conocimiento, Laboratorio de experimentos, Sala de escape, anfiteatro y jardines. Entrada al sur de la plaza.', x: 0, z: -38.5, open: true, way: { x: 0, z: -34.5 } },
    { kind: 'activity', id: 'comercio', icon: '🛍️', name: 'Paseo comercial', text: 'Ropa, zapatería, accesorios, mascotas, muebles, juguetes y artículos especiales. Se paga con monedas del juego. Entrada al este de la plaza.', x: 45.2, z: 0, open: true, way: { x: 41.5, z: 0 } },
    { kind: 'activity', id: 'aguas', icon: '🥤', name: 'Aguas frescas', text: 'Don Chema te sirve un agua o la preparas tú mismo siguiendo la receta.', x: -17.5, z: 12.5, open: true, way: { x: -16.6, z: 13.8 } },
    { kind: 'activity', id: 'dragones', icon: '🐉', name: 'Helipuerto de dragones', text: 'Vuelo panorámico sobre la ciudad con el Gran dragón de viaje.', x: -20, z: 0, open: true, way: { x: -17.4, z: 0 } }
  ];
}

export function createCityMap(ui) {
  const api = ui.api, items = mapDestinations(api);
  const here = api.sceneName === 'plaza' ? api.player.position : null;
  const wrap = h('div', 'map map--premium'), left = h('section', 'map__canvas'), side = h('section', 'map__side');
  const stage = h('div', 'city-map__stage'), surface = h('div', 'city-map__surface'), cv = h('canvas');
  const info = h('div', 'map__info'), list = h('div', 'map__list');
  const heading = h('div', 'city-map__heading');
  const title = h('div'); title.append(h('h3', null, 'Destinos de la ciudad'), h('p', null, 'Elige un lugar y márcalo para orientarte.'));
  heading.append(title, h('span', 'city-map__total', String(items.length)));
  cv.width = cv.height = SIZE * 2;
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Plano de Ciudad ICADEM. Los destinos también están disponibles en la lista.');
  surface.dataset.mapSurface = ''; surface.append(cv); stage.append(surface);
  const g = cv.getContext('2d'); g.scale(2, 2);
  let selected = null, zoom = 1, dx = 0, dy = 0, drag = null, moved = false, labelHits = [];

  const rounded = (x, y, w, hh, r, fill, stroke, line = 1) => {
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, hh, r); else g.rect(x, y, w, hh); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = line; g.stroke(); }
  };
  const disc = (x, y, r, fill, stroke, line = 1) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = line; g.stroke(); }
  };
  const tree = (x, z, size = 1) => {
    const xx = at(x), yy = at(z), r = 8 * size;
    disc(xx + 2, yy + 4, r + 1, 'rgba(36,85,54,.13)');
    rounded(xx - 1.7, yy, 3.4, 8, 1, '#a78658');
    disc(xx, yy - 2, r, '#55a56c'); disc(xx - 2, yy - 5, r * .72, '#8acc88');
  };
  const drawBuilding = b => {
    const f = footprint(b), x = at(b.x), y = at(b.z), w = f.w * K, d = f.d * K;
    const lift = Math.min(29, b.h * 1.6), roof = '#' + b.roof.toString(16).padStart(6, '0');
    g.save();
    g.shadowColor = 'rgba(31,55,69,.2)'; g.shadowBlur = 12; g.shadowOffsetY = 9;
    rounded(x - w / 2 - 3, y - d / 2 + 5, w + 6, d + 6, 9, '#e1dbc4');
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    rounded(x - w / 2, y - d / 2 - lift, w, d + lift, 6, b.trim);
    const facade = g.createLinearGradient(x, y - d / 2, x, y + d / 2);
    facade.addColorStop(0, '#ffffff'); facade.addColorStop(.18, b.wall); facade.addColorStop(1, b.wall);
    rounded(x - w / 2 + 2, y - d / 2, w - 4, d, 4, facade);
    rounded(x - w / 2 - 2, y - d / 2 - lift, w + 4, d - 9, 6, roof, rgba(b.trim, .35));
    rounded(x - w / 2 + 5, y - d / 2 - lift + 4, w - 10, d - 18, 3, b.wall);
    g.fillStyle = rgba(b.trim, .26); g.fillRect(x - w / 2 + 10, y - d / 2 - lift + 9, w - 20, Math.max(8, d - 28));
    // Facade windows use the actual building's materials; this is an illustrated
    // footprint, never another model or a modification to the 3D scene.
    const cols = Math.min(6, Math.max(3, b.cols || 4));
    for (let i = 0; i < cols; i++) {
      const wx = x - w / 2 + 10 + i * (w - 20) / cols;
      rounded(wx, y + d / 2 - 22, Math.max(6, (w - 20) / cols - 5), 12, 2, b.glass || '#d6ebf3');
    }
    rounded(x - 6, y + d / 2 - 18, 12, 18, 3, b.trim);
    if (b.style === 'bank' || b.style === 'court') {
      g.fillStyle = b.style === 'bank' ? '#f8efcf' : '#e8e2d7';
      g.beginPath(); g.moveTo(x - w / 2 - 4, y - d / 2 + 2); g.lineTo(x, y - d / 2 - 20); g.lineTo(x + w / 2 + 4, y - d / 2 + 2); g.closePath(); g.fill();
      for (const sign of [-1, 1]) rounded(x + sign * (w / 2 - 11) - 3, y + d / 2 - 28, 6, 25, 2, '#f3eddc');
    }
    if (b.style === 'hospital') {
      rounded(x - 3, y - d / 2 - lift + 9, 6, 23, 1, '#ed7880'); rounded(x - 11.5, y - d / 2 - lift + 17.5, 23, 6, 1, '#ed7880');
    }
    if (b.style === 'tower') {
      rounded(x - w / 2 + 12, y - d / 2 - lift - 14, w - 24, 24, 5, '#737cda');
      rounded(x - 1.5, y - d / 2 - lift - 29, 3, 20, 1, '#f7f5ff');
    }
    if (b.style === 'restaurant') {
      for (let i = 0; i < 8; i++) rounded(x - w / 2 + i * w / 8, y + d / 2 - 29, w / 8, 8, 1, i % 2 ? '#fffaf0' : '#e68270');
    }
    if (b.style === 'greenhouse') {
      for (let i = 0; i < 4; i++) rounded(x - w / 2 + 7 + i * (w - 14) / 4, y - d / 2 - lift + 7, (w - 14) / 4 - 3, d - 23, 2, '#b6e1d4');
    }
    g.restore();
  };
  const nameLines = name => {
    const words = name.split(' '), lines = [''];
    for (const word of words) { const i = lines.length - 1, next = (lines[i] + ' ' + word).trim(); if (g.measureText(next).width > 118 && lines[i]) lines.push(word); else lines[i] = next; }
    return lines;
  };
  const marker = it => {
    const x = at(it.x), y = at(it.z), on = selected?.id === it.id, activity = it.kind === 'activity';
    const cy = y - (it.b ? 8 : 0);
    if (on) disc(x, cy, 33, 'rgba(47,158,143,.17)', '#72c8b8', 2);
    g.save(); g.shadowColor = 'rgba(18,39,70,.23)'; g.shadowBlur = 9; g.shadowOffsetY = 5;
    disc(x, cy, 24, '#fff', on ? '#249c86' : activity ? '#8bc6b6' : '#d1d9e8', on ? 3 : 1.5);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.font = '24px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#132a4b'; g.fillText(it.icon, x, cy + 1);
    if (it.done) { disc(x + 19, cy - 19, 9, '#208764', '#fff', 2); g.font = 'bold 12px sans-serif'; g.fillStyle = '#fff'; g.fillText('✓', x + 19, cy - 19); }
    g.font = '700 13px "Outfit","Segoe UI",sans-serif';
    const lines = nameLines(it.name), w = Math.min(140, Math.max(72, ...lines.map(line => g.measureText(line).width + 20))), height = lines.length * 15 + 10;
    rounded(x - w / 2, cy + 28, w, height, 8, on ? '#e5f7ef' : '#ffffff', on ? '#40ad95' : 'rgba(122,143,157,.23)', on ? 2 : 1);
    labelHits.push({ item: it, x: x - w / 2, y: cy + 28, w, h: height });
    g.fillStyle = '#23384d'; lines.forEach((line, i) => g.fillText(line, x, cy + 40 + i * 15));
    g.restore();
  };
  const draw = () => {
    labelHits = [];
    g.clearRect(0, 0, SIZE, SIZE);
    const grass = g.createLinearGradient(0, 0, SIZE, SIZE); grass.addColorStop(0, '#d6e9c0'); grass.addColorStop(1, '#bcdcbf');
    rounded(0, 0, SIZE, SIZE, 22, grass);
    // The same two avenues and four pavements as the existing plaza.
    g.fillStyle = '#f0e5ce'; g.fillRect(at(-44), at(-23), 88 * K, 5 * K); g.fillRect(at(-44), at(18), 88 * K, 5 * K); g.fillRect(at(-29), at(-18), 5 * K, 36 * K); g.fillRect(at(24), at(-18), 5 * K, 36 * K);
    g.fillStyle = '#e2dfce'; g.fillRect(at(-4.7), 0, 9.4 * K, SIZE); g.fillRect(0, at(-4.7), SIZE, 9.4 * K);
    const road = g.createLinearGradient(0, 0, SIZE, SIZE); road.addColorStop(0, '#8595a0'); road.addColorStop(1, '#657b8b');
    g.fillStyle = road; g.fillRect(at(-3.5), 0, 7 * K, SIZE); g.fillRect(0, at(-3.5), SIZE, 7 * K);
    g.strokeStyle = '#f6edce'; g.lineWidth = 2; g.setLineDash([12, 12]);
    g.beginPath(); g.moveTo(SIZE / 2, 0); g.lineTo(SIZE / 2, SIZE); g.moveTo(0, SIZE / 2); g.lineTo(SIZE, SIZE / 2); g.stroke(); g.setLineDash([]);
    disc(at(0) + 2, at(0) + 7, 15.8 * K, 'rgba(37,76,60,.15)');
    disc(at(0), at(0), 15.3 * K, '#85b2a6', '#f6e8ce', 5);
    disc(at(0), at(0), 14.4 * K, '#f4e8d6', '#e9d4ae', 3);
    disc(at(0), at(0), 10.6 * K, '#f8f1e5', '#e2b6a0', 5);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      const x = at(Math.cos(a) * 12.4), y = at(Math.sin(a) * 12.4);
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); rounded(-10, -3, 20, 6, 2, '#bd9771'); g.restore();
    }
    disc(at(0), at(0), 4.5 * K, '#e2e7df', '#fff', 3); disc(at(0), at(0), 3.8 * K, '#8bd4e5'); disc(at(0), at(0), 1.4 * K, '#c4f0f6');
    // Small vegetation marks follow the plaza's existing edge/pavement zones.
    for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2; const x = Math.cos(a) * 45.3, z = Math.sin(a) * 45.3; if (Math.abs(x) > 5 && Math.abs(z) > 5) tree(x, z, .9 + i % 3 * .12); }
    for (const [x, z] of [[-22, -21.5], [-4.5, -22], [4.5, -22], [22, -22], [-22, 22], [-4.5, 22], [4.5, 22], [22, 22], [-27, -17], [-27, 17], [27, -17], [27, 17]]) tree(x, z, .95);
    rounded(at(-9), at(36), 18 * K, 11 * K, 14, '#acd5a9', '#75ad8c', 2);
    for (const b of BUILDINGS) drawBuilding(b);
    if (api.waypoint) {
      g.strokeStyle = '#249b85'; g.lineWidth = 4; g.setLineDash([8, 8]);
      if (here) { g.beginPath(); g.moveTo(at(here.x), at(here.z)); g.lineTo(at(api.waypoint.x), at(api.waypoint.z)); g.stroke(); }
      g.setLineDash([]); disc(at(api.waypoint.x), at(api.waypoint.z), 9, '#1c927b', '#fff', 3);
    }
    for (const it of items) marker(it);
    if (here) {
      g.save(); g.translate(at(here.x), at(here.z)); g.rotate(-api.player.yaw + Math.PI);
      disc(0, 0, 21, 'rgba(234,90,78,.15)'); g.fillStyle = '#e85950'; g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  };

  const renderInfo = () => {
    info.replaceChildren();
    info.classList.toggle('has-selection', Boolean(selected));
    if (!selected) {
      const head = h('div', 'map__head'); head.append(h('span', 'map__icon', here ? '➤' : '⌂'), h('h4', null, here ? 'Estás en la plaza' : SCENE_TITLES[api.sceneName] || 'Estás en un interior'));
      info.append(head, h('p', null, here ? 'La flecha coral indica tu posición. Selecciona un lugar para conocer su actividad.' : 'Puedes marcar un destino desde aquí. Sal a la plaza para ver tu posición.'));
    } else {
      const head = h('div', 'map__head'); head.append(h('span', 'map__icon', selected.icon), h('h4', null, selected.name));
      const pills = h('div', 'map__pills');
      pills.append(h('span', 'pill ' + (selected.open ? 'pill--ok' : 'pill--soon'), selected.kind === 'activity' ? 'Actividad' : selected.open ? 'Disponible' : 'Próximamente'));
      if (selected.done) pills.append(h('span', 'pill pill--done', 'Completada'));
      const go = h('button', 'btn btn--primary', 'Marcar como destino'); go.type = 'button';
      go.addEventListener('click', () => { api.setWaypoint({ x: selected.way.x, z: selected.way.z, name: selected.name }); ui.toast('Destino marcado: ' + selected.name); draw(); });
      info.append(head, h('p', null, selected.text), pills, go);
    }
    for (const button of list.querySelectorAll('button')) { const on = selected?.id === button.dataset.id; button.classList.toggle('is-on', on); button.setAttribute('aria-pressed', String(on)); }
  };
  const select = item => { selected = item; draw(); renderInfo(); };
  for (const it of items) {
    const button = h('button'); button.type = 'button'; button.dataset.id = it.id;
    const copy = h('span', 'city-map__place-copy'); copy.append(h('strong', null, it.name), h('span', null, it.kind === 'activity' ? 'Actividad en la plaza' : it.b.mission));
    const status = h('small', it.done ? 'is-done' : it.open ? 'is-open' : 'is-soon', it.done ? '✓ Completada' : it.kind === 'activity' ? 'Actividad' : it.open ? 'Abierto' : 'Pronto');
    button.append(h('i', 'map__emoji', it.icon), copy, status);
    button.addEventListener('click', () => select(it)); list.append(button);
  }
  stage.addEventListener('click', event => {
    if (moved) { moved = false; return; }
    const r = cv.getBoundingClientRect(), px = (event.clientX - r.left) / r.width * SIZE, py = (event.clientY - r.top) / r.height * SIZE, x = px / K - HALF, z = py / K - HALF;
    const item = items.find(it => Math.hypot(x - it.x, z - it.z) < 3.4) || labelHits.find(hit => px >= hit.x && px <= hit.x + hit.w && py >= hit.y && py <= hit.y + hit.h)?.item || BUILDINGS.map(b => items.find(it => it.id === b.id)).find(it => { const f = footprint(it.b); return Math.abs(x - it.x) <= f.w / 2 + 1 && Math.abs(z - it.z) <= f.d / 2 + 1; }) || null;
    select(item);
  });
  const tools = h('div', 'city-map__tools'), scale = h('output', 'city-map__scale', '100 %'); scale.dataset.mapScale = '';
  const transform = () => {
    // Fractions of the viewport stay bounded when a phone rotates/resizes.
    const edge = (zoom - 1) / 2;
    dx = Math.max(-edge, Math.min(edge, dx)); dy = Math.max(-edge, Math.min(edge, dy));
    surface.style.transform = `translate(${dx * 100}%,${dy * 100}%) scale(${zoom})`;
    scale.textContent = Math.round(zoom * 100) + ' %'; stage.classList.toggle('can-pan', zoom > 1);
    tools.querySelector('[data-map-zoom="in"]').disabled = zoom >= 2;
    tools.querySelector('[data-map-zoom="out"]').disabled = zoom <= 1;
  };
  for (const [id, label, text] of [['out', 'Alejar mapa', '−'], ['reset', 'Restablecer mapa', '⌖'], ['in', 'Acercar mapa', '+']]) {
    const button = h('button', null, text); button.type = 'button'; button.dataset.mapZoom = id; button.setAttribute('aria-label', label); button.title = label;
    button.addEventListener('click', () => { zoom = id === 'reset' ? 1 : Math.max(1, Math.min(2, zoom + (id === 'in' ? .25 : -.25))); if (zoom === 1) dx = dy = 0; transform(); }); tools.append(button);
  }
  stage.addEventListener('pointerdown', event => {
    moved = false;
    if (zoom <= 1 || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx, dy };
    stage.setPointerCapture(event.pointerId); stage.classList.add('is-panning');
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.x, y = event.clientY - drag.y;
    if (Math.hypot(x, y) > 5) moved = true;
    dx = drag.dx + x / stage.clientWidth; dy = drag.dy + y / stage.clientHeight; transform();
  });
  const stopDrag = event => { if (drag && drag.id === event.pointerId) { drag = null; stage.classList.remove('is-panning'); } };
  stage.addEventListener('pointerup', stopDrag); stage.addEventListener('pointercancel', stopDrag); stage.addEventListener('lostpointercapture', stopDrag);
  const top = h('div', 'city-map__viewbar'); top.append(h('span', null, 'Ciudad ICADEM'), scale, tools);
  const legend = h('div', 'map__legend'); legend.append(h('span', 'city-map__you', '➤ Tú'), h('span', 'is-done', '✓ Completada'), h('span', 'is-act', '● Actividad'));
  const hint = h('p', 'city-map__gesture', 'Acerca el mapa para arrastrarlo.');
  left.append(top, stage, legend, hint); side.append(heading, list, info); wrap.append(left, side); draw(); renderInfo(); transform();
  return wrap;
}
