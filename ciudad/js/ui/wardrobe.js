// Ciudad ICADEM · Vestidor: personajes iniciales, profesiones y skins especiales, con vista previa 3D,
// requisitos reales de desbloqueo (los mismos que comprueba el servidor) y estilo (atuendo, sombrero
// y tono de piel). También es la selección de personaje de la primera vez (`first: true`).
import { AVATARS, AVATAR_CATEGORIES, avatarById } from '../characters/catalog.js';
import { AVATAR_UNLOCKS, OUTFIT_COLORS, HAT_OPTIONS, SKIN_TONES, isAvatarUnlocked, applyCustom, unlockProgress } from '../progress/rules.js';
import { AvatarPreview } from './preview.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const icon = kind => {
  const paths = { person: ['M12 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8', 'M5 21v-2a7 7 0 0 1 14 0v2z'], palette: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4a1.2 1.2 0 0 1 .8-2.1H17A4 4 0 0 0 21 11a8.5 8.5 0 0 0-9-8', 'M7 10h.01M10 6h.01M15 6h.01M18 10h.01'], cube: ['M12 2l9 5v10l-9 5l-9-5V7z', 'M3 7l9 5l9-5M12 12v10'] };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'vest__icon'); svg.setAttribute('aria-hidden', 'true');
  for (const d of paths[kind] || []) { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.append(path); } return svg;
};

/**
 * `first: true` → selección inicial (solo personajes gratuitos y botón «Comenzar»).
 * Los cambios se guardan con api.setAvatar: con conexión los autoriza y guarda el servidor.
 */
export function openWardrobe(ui, { first = false } = {}) {
  if (ui.isBlocking) return Promise.resolve('blocked');
  const api = ui.api, st = api.store.state, hex = n => '#' + n.toString(16).padStart(6, '0');
  const wrap = h('div', 'vest vest--studio' + (first ? ' is-first' : '')), stage = h('div', 'vest__stage'), panel = h('div', 'vest__panel');
  let preview = null, thumbs = null, thumbnailRun = 0;
  try { preview = new AvatarPreview(api.engine.renderer, { width: 320, height: 390 }); thumbs = new AvatarPreview(api.engine.renderer, { width: 150, height: 190 }); thumbs.camera.position.set(0, 1.15, 3.4); thumbs.camera.lookAt(0, 0.95, 0); preview.scene.background.setHex(0xeaeafa); thumbs.scene.background.setHex(0xf1f2fc); } catch (_) { preview = thumbs = null; }
  let viewing = first ? (AVATARS.find(a => a.id === st.avatarId && a.category === 'inicial') || AVATARS[0]).id : st.avatarId;
  let cat = first ? 'inicial' : (avatarById(viewing).category || 'inicial'), tab = 'personajes', query = '', availability = 'all';
  const lookOf = (id, custom = st.custom) => applyCustom(avatarById(id).look, custom);
  const shots = new Map();
  const thumbnails = queue => {
    const run = ++thumbnailRun;
    const next = () => { const job = queue.shift(); if (!job || !wrap.isConnected || run !== thumbnailRun) return; if (job.img.isConnected) { const url = shot(job.id, job.custom); if (url) job.img.src = url; } requestAnimationFrame(next); };
    requestAnimationFrame(next);
  };

  /* escenario: personaje en 3D + estado */
  const tag = h('span', 'vest__tag'), name = h('strong', 'vest__name'), status = h('div', 'vest__status');
  const paintStage = () => {
    const a = avatarById(viewing), open = isAvatarUnlocked(a.id, st), on = a.id === st.avatarId && !first;
    if (preview) { preview.show(lookOf(a.id)); preview.canvas.setAttribute('aria-label', 'Vista previa 3D de ' + a.name); }
    tag.textContent = (AVATAR_CATEGORIES.find(c => c.id === a.category) || {}).name || ''; tag.dataset.cat = a.category;
    name.textContent = a.name; status.replaceChildren();
    if (first) { status.append(h('span', 'vest__hint', 'Gratuito · podrás cambiarlo cuando quieras en el Vestidor')); return; }
    if (on) status.append(h('span', 'pill pill--ok', 'Es tu personaje'));
    else if (open) { const b = h('button', 'btn btn--primary', 'Usar este personaje'); b.type = 'button'; b.addEventListener('click', () => { if (api.setAvatar(a.id, st.custom)) { ui.toast('Personaje guardado: ' + a.name); paintStage(); paintCards(); } }); status.append(b); }
    else {
      const [now, goal] = unlockProgress(a.id, st), meter = h('i', 'meter'), fill = h('i'); fill.style.width = Math.round(100 * now / goal) + '%'; meter.append(fill);
      status.append(h('span', 'vest__lock', '🔒 ' + AVATAR_UNLOCKS[a.id].text), meter, h('small', null, goal > 1 ? `Llevas ${now} de ${goal}` : 'Aún no lo consigues'));
    }
  };
  const stageTop = h('div', 'vest__stage-top'), badge3d = h('span', 'vest__3d', '3D'); badge3d.prepend(icon('cube')); stageTop.append(badge3d, h('small', 'vest__tip', '↻ Arrastra para girar')); stage.append(stageTop);
  if (preview) {
    const frame = h('div', 'vest__preview-frame'), zoom = h('div', 'vest__zoom'); frame.append(preview.canvas, zoom); stage.append(frame); preview.start();
    const updateZoom = distance => { preview.camera.position.set(0, 1.25, Math.max(3.2, Math.min(6, distance))); preview.camera.lookAt(0, 0.9, 0); };
    for (const [id, label, mark] of [['in', 'Acercar avatar', '+'], ['out', 'Alejar avatar', '−'], ['reset', 'Restablecer vista', '↻']]) {
      const b = h('button', '', mark); b.type = 'button'; b.dataset.zoom = id; b.title = label; b.setAttribute('aria-label', label);
      b.addEventListener('click', () => { if (id === 'reset') { updateZoom(4.6); preview.yaw = 0.4; } else updateZoom(preview.camera.position.z + (id === 'in' ? -0.4 : 0.4)); }); zoom.append(b);
    }
  } else { stage.classList.add('is-off'); stage.append(h('p', 'vest__fallback', 'La vista 3D no está disponible. Puedes elegir tu personaje en el catálogo.')); }
  const info = h('div', 'vest__info'); info.append(tag, name, status); stage.append(info);
  const customize = h('button', 'vest__customize', 'Personalizar estilo'); customize.type = 'button'; customize.prepend(icon('palette')); customize.addEventListener('click', () => show('estilo')); stage.append(customize);

  /* tarjetas */
  const cards = h('div', 'vest__cards'), cats = h('div', 'vest__cats'), tools = h('div', 'vest__tools'), search = h('label', 'vest__search'), searchInput = h('input'), filter = h('select', 'vest__availability'), resultCount = h('small', 'vest__result-count');
  searchInput.type = 'search'; searchInput.placeholder = 'Buscar personaje…'; searchInput.setAttribute('aria-label', 'Buscar personaje'); search.append(searchInput);
  filter.setAttribute('aria-label', 'Disponibilidad de personajes');
  for (const [value, label] of [['all', 'Todos'], ['available', 'Disponibles'], ['locked', 'Por desbloquear'], ['equipped', 'Equipado']]) { if (first && ['locked', 'equipped'].includes(value)) continue; const o = h('option', '', label); o.value = value; filter.append(o); }
  searchInput.addEventListener('input', () => { query = searchInput.value; paintCards(); }); filter.addEventListener('change', () => { availability = filter.value; paintCards(); }); tools.append(search, filter); resultCount.setAttribute('role', 'status');
  const shot = (id, custom = st.custom) => { if (!thumbs) return null; const key = id + JSON.stringify(custom); if (!shots.has(key)) shots.set(key, thumbs.still(lookOf(id, custom))); return shots.get(key); };
  const paintCards = () => {
    cats.replaceChildren(); cards.replaceChildren();
    for (const c of AVATAR_CATEGORIES) {
      if (first && c.id !== 'inicial') continue;
      const list = AVATARS.filter(a => a.category === c.id), got = list.filter(a => isAvatarUnlocked(a.id, st)).length;
      const b = h('button', c.id === cat ? 'is-on' : '', null); b.type = 'button'; b.setAttribute('aria-pressed', String(c.id === cat)); b.append(h('span', null, c.name), h('small', null, `${got}/${list.length}`));
      b.addEventListener('click', () => { cat = c.id; paintCards(); }); cats.append(b);
    }
    const match = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), needle = match(query.trim());
    const list = AVATARS.filter(a => a.category === cat && (!needle || match(a.name + ' ' + a.route).includes(needle)) && (availability === 'all' || availability === 'available' && isAvatarUnlocked(a.id, st) || availability === 'locked' && !isAvatarUnlocked(a.id, st) || availability === 'equipped' && a.id === st.avatarId)), queue = [];
    resultCount.textContent = `${list.length} ${list.length === 1 ? 'personaje' : 'personajes'} · ${AVATAR_CATEGORIES.find(c => c.id === cat)?.name || ''}`;
    for (const a of list) {
      const open = isAvatarUnlocked(a.id, st), card = h('button', 'vcard' + (open ? '' : ' is-locked') + (a.id === viewing ? ' is-view' : '') + (a.id === st.avatarId && !first ? ' is-worn' : ''));
      card.type = 'button'; card.dataset.id = a.id; card.setAttribute('aria-pressed', String(a.id === viewing)); card.setAttribute('aria-label', `${a.name}${a.id === st.avatarId && !first ? ' (equipado)' : open ? '' : ' (bloqueado: ' + AVATAR_UNLOCKS[a.id].text + ')'}`);
      const pic = h('span', 'vcard__pic'); pic.style.setProperty('--c', hex(a.look.top)); const img = h('img'); img.alt = ''; pic.append(img);
      if (!open) pic.append(h('span', 'vcard__lock', '🔒'));
      if (a.id === st.avatarId && !first) pic.append(h('span', 'vcard__worn', '✓'));
      const category = h('span', 'vcard__category', AVATAR_CATEGORIES.find(c => c.id === a.category)?.name || ''); category.dataset.cat = a.category;
      const state = h('span', 'vcard__state', a.id === st.avatarId && !first ? 'Equipado' : open ? 'Disponible' : 'Por desbloquear'); state.dataset.state = a.id === st.avatarId && !first ? 'worn' : open ? 'open' : 'locked';
      card.append(pic, category, h('strong', null, a.name), h('small', null, open ? a.route : AVATAR_UNLOCKS[a.id].text), state);
      card.addEventListener('click', () => { viewing = a.id; paintStage(); cards.querySelectorAll('.vcard').forEach(x => { const on = x === card; x.classList.toggle('is-view', on); x.setAttribute('aria-pressed', String(on)); }); });
      cards.append(card); queue.push({ id: a.id, img, custom: { ...st.custom } });
    }
    // miniaturas 3D poco a poco, sin trabar la animación
    if (!list.length) cards.append(h('p', 'vest__empty', 'No hay personajes con estos filtros. Prueba otra categoría o búsqueda.'));
    thumbnails(queue);
  };

  /* estilo: atuendo, sombrero y tono (todo gratuito) */
  const style = h('div', 'vest__style');
  const paintStyle = () => {
    style.replaceChildren(); const queue = [];
    const group = (label, key, options, swatch) => {
      const f = h('section', 'field vest__style-group'), head = h('div', 'vest__style-head'), row = h('div', 'chips' + (swatch ? ' chips--swatch' : '') + ' vest__' + key + '-options'); head.append(h('h3', null, label), h('small', null, 'Gratuito')); f.append(head, row);
      options.forEach(o => {
        const on = st.custom[key] === o.id, b = h('button', (on ? 'is-on ' : '') + (key === 'tone' ? 'vest__tone' : 'voption')); b.type = 'button'; b.dataset[key] = o.id; b.title = o.name; b.setAttribute('aria-label', `${label}: ${o.name}`); b.setAttribute('aria-pressed', String(on));
        if (o.color !== null && o.color !== undefined) b.style.setProperty('--dot', hex(o.color)); else if (swatch) b.classList.add('is-base');
        if (key !== 'tone') {
          const pic = h('span', 'voption__pic'), img = h('img'), copy = h('span', 'voption__copy'); img.alt = ''; img.decoding = 'async'; pic.append(img); copy.append(h('strong', null, o.name), h('small', null, on ? 'Aplicado' : key === 'hat' ? 'Sombrero' : 'Color de atuendo')); b.append(pic, copy);
          if (on) pic.append(h('span', 'voption__check', '✓'));
          queue.push({ id: first ? viewing : st.avatarId, custom: { ...st.custom, [key]: o.id }, img });
        } else b.append(h('span', 'vest__tone-dot'), h('span', 'vest__tone-name', o.name));
        b.addEventListener('click', () => { const c = { ...st.custom, [key]: o.id }; if (first) { st.custom = c; paintStyle(); paintStage(); } else if (api.setAvatar(st.avatarId, c)) { viewing = st.avatarId; paintStyle(); paintStage(); } });
        row.append(b);
      });
      return f;
    };
    style.append(group('Color del atuendo', 'outfit', OUTFIT_COLORS, true), group('Sombrero', 'hat', HAT_OPTIONS), group('Tono de piel', 'tone', SKIN_TONES, true),
      h('p', 'note', first ? 'Todo es gratuito y lo puedes cambiar después.' : 'Se aplica a tu personaje actual y se guarda en tu cuenta.'));
    thumbnails(queue);
  };

  const tabs = h('div', 'tabs vest__tabs'), body = h('div', 'vest__body');
  const show = id => { tab = id; tabs.querySelectorAll('button').forEach(b => { const on = b.dataset.id === id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); }); body.replaceChildren(); customize.classList.toggle('is-on', id === 'estilo'); if (id === 'personajes') { body.append(cats, tools, resultCount, cards); paintCards(); } else { if (!first) { viewing = st.avatarId; paintStage(); } body.append(style); paintStyle(); } };
  [['personajes', first ? 'Personajes' : 'Personajes y skins'], ['estilo', 'Estilo']].forEach(([id, t]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.id = id; b.prepend(icon(id === 'estilo' ? 'palette' : 'person')); b.addEventListener('click', () => show(id)); tabs.append(b); });
  const owned = AVATARS.filter(a => isAvatarUnlocked(a.id, st)).length;
  panel.append(tabs, body);
  const collection = h('div', 'vest__collection'); collection.append(h('span', null, first ? 'TU PRIMER PERSONAJE' : 'TU COLECCIÓN'), h('strong', null, first ? 'El comienzo de tu aventura' : `${owned} de ${AVATARS.length} personajes`)); panel.append(collection, h('p', 'vest__collection-note', 'Se consiguen jugando. Todos son cosméticos: no dan ventaja ni se compran.'));
  wrap.append(stage, panel); paintStage(); show('personajes');

  const stop = () => { thumbnailRun++; preview && preview.stop(); thumbs && thumbs.stop(); };
  if (first) {
    return ui.modal({ eyebrow: 'Bienvenida a Ciudad ICADEM', title: 'Elige tu personaje', content: wrap, wide: true, onClose: stop,
      actions: [{ id: 'ok', label: 'Comenzar con este personaje', primary: true }] })
      .then(id => { api.setAvatar(viewing, st.custom); return id; });
  }
  return ui.modal({ eyebrow: 'Ciudad ICADEM · Avatar Studio', title: 'Mi avatar', content: wrap, wide: true, onClose: stop });
}
