// Ciudad ICADEM · Vestidor: personajes iniciales, profesiones y skins especiales, con vista previa 3D,
// requisitos reales de desbloqueo (los mismos que comprueba el servidor), ropa, cabello y accesorios.
// También es la selección de personaje de la primera vez (`first: true`).
import { AVATARS, AVATAR_CATEGORIES, avatarById } from '../characters/catalog.js';
import { AVATAR_UNLOCKS, OUTFIT_COLORS, HAT_OPTIONS, SKIN_TONES, TOP_OPTIONS, BOTTOM_OPTIONS, SHOE_OPTIONS, BAG_OPTIONS, HAIR_STYLE_OPTIONS, HAIR_COLORS, NECKLACE_OPTIONS, cleanCustom, isAvatarUnlocked, applyCustom, unlockProgress } from '../progress/rules.js';
import { AvatarPreview } from './preview.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const icon = kind => {
  const paths = { person: ['M12 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8', 'M5 21v-2a7 7 0 0 1 14 0v2z'], palette: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4a1.2 1.2 0 0 1 .8-2.1H17A4 4 0 0 0 21 11a8.5 8.5 0 0 0-9-8', 'M7 10h.01M10 6h.01M15 6h.01M18 10h.01'], cube: ['M12 2l9 5v10l-9 5l-9-5V7z', 'M3 7l9 5l9-5M12 12v10'], shirt: ['M8 3L3 6l2 5 3-1v11h8V10l3 1 2-5-5-3', 'M8 3a4 4 0 0 0 8 0'], bag: ['M5 8h14l1 13H4z', 'M8 8V6a4 4 0 0 1 8 0v2'], hair: ['M5 17V10a7 7 0 0 1 14 0v7', 'M5 11c4 0 5-5 5-5s3 5 9 5M8 14v4M12 14v5M16 14v4'] };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'vest__icon'); svg.setAttribute('aria-hidden', 'true');
  for (const d of paths[kind] || []) { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.append(path); } return svg;
};

/**
 * `first: true` → selección inicial (solo personajes gratuitos y botón «Comenzar»).
 * Los cambios se guardan con api.setAvatar: con conexión los autoriza y guarda el servidor.
 */
export function openWardrobe(ui, { first = false, tab: initialTab = 'personajes' } = {}) {
  if (ui.isBlocking) return Promise.resolve('blocked');
  const api = ui.api, st = api.store.state, hex = n => '#' + n.toString(16).padStart(6, '0');
  const wrap = h('div', 'vest vest--studio vest--fashion vest--catalog' + (first ? ' is-first' : '')), stage = h('div', 'vest__stage'), panel = h('div', 'vest__panel');
  let preview = null, thumbs = null, thumbnailRun = 0;
  try { preview = new AvatarPreview(api.engine.renderer, { width: 320, height: 390 }); thumbs = new AvatarPreview(api.engine.renderer, { width: 150, height: 190 }); thumbs.camera.position.set(0, 1.15, 3.4); thumbs.camera.lookAt(0, 0.95, 0); preview.scene.background.setHex(0xeaeafa); thumbs.scene.background.setHex(0xf1f2fc); } catch (_) { preview = thumbs = null; }
  let viewing = first ? (AVATARS.find(a => a.id === st.avatarId && a.category === 'inicial') || AVATARS[0]).id : st.avatarId;
  let cat = first ? 'inicial' : (avatarById(viewing).category || 'inicial'), tab = 'personajes', query = '', availability = 'all';
  let draft = cleanCustom(st.custom), equipped = { id: st.avatarId, custom: cleanCustom(st.custom) }, pendingLook = null, pendingTimer = null, touched = false, feedback = '', offProfile = null, offStatus = null, lastAvatarAck = -1;
  const sameCustom = (a, b) => JSON.stringify(cleanCustom(a)) === JSON.stringify(cleanCustom(b));
  const sameLook = (a, b) => a.id === b.id && sameCustom(a.custom, b.custom);
  const current = () => ({ id: viewing, custom: draft });
  const hasTrial = () => !sameLook(current(), { id: st.avatarId, custom: st.custom });
  const clearPending = () => { if (pendingTimer !== null) clearTimeout(pendingTimer); pendingTimer = null; pendingLook = null; };
  const lookOf = (id, custom = draft) => applyCustom(avatarById(id).look, custom);
  const refreshActions = () => {
    if (first || !wrap.isConnected) return;
    const button = document.getElementById('modal-actions')?.querySelector('[data-action="equip"]');
    if (!button) return;
    button.disabled = !isAvatarUnlocked(viewing, st) || !hasTrial();
    button.textContent = pendingLook && sameLook(current(), pendingLook) ? 'Confirmando…' : 'Equipar selección';
    button.setAttribute('aria-busy', String(Boolean(pendingLook)));
  };
  const applyDraft = () => {
    if (first || !hasTrial() || !isAvatarUnlocked(viewing, st)) return;
    const selection = { id: viewing, custom: cleanCustom(draft) };
    if (!api.setAvatar(selection.id, selection.custom)) return;
    touched = false; feedback = '';
    clearPending();
    if (api.net?.isOnline) {
      pendingLook = selection;
      // Presentation timeout only. The existing main.js queue owns persistence,
      // rollback and retry; a lost reply must not leave this panel spinning.
      pendingTimer = setTimeout(() => { pendingLook = null; pendingTimer = null; touched = true; feedback = 'Sin confirmación. Tu prueba sigue disponible.'; if (wrap.isConnected) { paintStage(); if (tab === 'personajes') paintCards(); else paintStyle(); } }, 12500);
    } else equipped = selection;
    paintStage(); if (tab === 'personajes') paintCards(); else paintStyle();
  };
  const discardTrial = () => { viewing = st.avatarId; draft = cleanCustom(st.custom); touched = false; feedback = ''; paintStage(); if (tab === 'personajes') paintCards(); else paintStyle(); };
  const shots = new Map();
  const thumbnails = queue => {
    const run = ++thumbnailRun;
    const next = () => { const job = queue.shift(); if (!job || !wrap.isConnected || run !== thumbnailRun) return; if (job.img.isConnected) { const url = shot(job.id, job.custom, job.detail); if (url) job.img.src = url; } requestAnimationFrame(next); };
    requestAnimationFrame(next);
  };

  /* escenario: personaje en 3D + estado */
  const tag = h('span', 'vest__tag'), name = h('strong', 'vest__name'), status = h('div', 'vest__status');
  const paintStage = () => {
    const a = avatarById(viewing), open = isAvatarUnlocked(a.id, st), on = sameLook(current(), equipped) && !first;
    if (preview) { preview.show(lookOf(a.id)); preview.canvas.setAttribute('aria-label', 'Vista previa 3D de ' + a.name); }
    tag.textContent = (AVATAR_CATEGORIES.find(c => c.id === a.category) || {}).name || ''; tag.dataset.cat = a.category;
    name.textContent = a.name; status.replaceChildren();
    if (first) { status.append(h('span', 'vest__hint', 'Gratuito · podrás cambiarlo cuando quieras en el Vestidor')); return; }
    if (feedback) status.append(h('span', 'vest__save-feedback', feedback));
    if (pendingLook && sameLook(current(), pendingLook)) status.append(h('span', 'vest__pending', 'Confirmando con tu cuenta…'));
    else if (on) status.append(h('span', 'pill pill--ok', 'Es tu personaje'));
    else if (open) status.append(h('span', 'vest__trial', 'Vista previa · sin equipar'));
    else {
      const [now, goal] = unlockProgress(a.id, st), meter = h('i', 'meter'), fill = h('i'); fill.style.width = Math.round(100 * now / goal) + '%'; meter.append(fill);
      status.append(h('span', 'vest__lock', '🔒 ' + AVATAR_UNLOCKS[a.id].text), meter, h('small', null, goal > 1 ? `Llevas ${now} de ${goal}` : 'Aún no lo consigues'));
    }
    if (hasTrial()) { const discard = h('button', 'vest__discard', 'Descartar prueba'); discard.type = 'button'; discard.dataset.discardTrial = ''; discard.addEventListener('click', discardTrial); status.append(discard); }
    refreshActions();
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
  const customize = h('button', 'vest__customize', 'Vestir a mi avatar'); customize.type = 'button'; customize.prepend(icon('shirt')); customize.addEventListener('click', () => { viewing = st.avatarId; show('ropa'); }); stage.append(customize);

  /* tarjetas */
  const cards = h('div', 'vest__cards'), cats = h('div', 'vest__cats'), tools = h('div', 'vest__tools'), search = h('label', 'vest__search'), searchInput = h('input'), filter = h('select', 'vest__availability'), resultCount = h('small', 'vest__result-count');
  searchInput.type = 'search'; searchInput.placeholder = 'Buscar personaje…'; searchInput.setAttribute('aria-label', 'Buscar personaje'); search.append(searchInput);
  filter.setAttribute('aria-label', 'Disponibilidad de personajes');
  for (const [value, label] of [['all', 'Todos'], ['available', 'Disponibles'], ['locked', 'Por desbloquear'], ['equipped', 'Equipado']]) { if (first && ['locked', 'equipped'].includes(value)) continue; const o = h('option', '', label); o.value = value; filter.append(o); }
  searchInput.addEventListener('input', () => { query = searchInput.value; paintCards(); }); filter.addEventListener('change', () => { availability = filter.value; paintCards(); }); tools.append(search, filter); resultCount.setAttribute('role', 'status');
  const shot = (id, custom = st.custom, detail = 'full') => {
    if (!thumbs) return null;
    const key = id + ':' + detail + JSON.stringify(custom);
    if (!shots.has(key)) {
      // Show small accessories at a useful size, with the same real equipped model.
      const [y, distance] = detail === 'necklace' ? [1.0, 1.55] : detail === 'shoes' ? [.24, 1.8] : ['hairStyle', 'hairColor', 'hat'].includes(detail) ? [1.4, 2.25] : [0.95, 3.4];
      thumbs.camera.position.set(0, y + .2, distance); thumbs.camera.lookAt(0, y, 0);
      if (shots.size >= 128) shots.delete(shots.keys().next().value);
      shots.set(key, thumbs.still(lookOf(id, custom)));
    }
    return shots.get(key);
  };
  const paintCards = () => {
    cats.replaceChildren(); cards.replaceChildren();
    for (const c of AVATAR_CATEGORIES) {
      if (first && c.id !== 'inicial') continue;
      const list = AVATARS.filter(a => a.category === c.id), got = list.filter(a => isAvatarUnlocked(a.id, st)).length;
      const b = h('button', c.id === cat ? 'is-on' : '', null); b.type = 'button'; b.setAttribute('aria-pressed', String(c.id === cat)); b.append(h('span', null, c.name), h('small', null, `${got}/${list.length}`));
      b.addEventListener('click', () => { cat = c.id; paintCards(); }); cats.append(b);
    }
    const match = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), needle = match(query.trim());
    const list = AVATARS.filter(a => a.category === cat && (!needle || match(a.name + ' ' + a.route).includes(needle)) && (availability === 'all' || availability === 'available' && isAvatarUnlocked(a.id, st) || availability === 'locked' && !isAvatarUnlocked(a.id, st) || availability === 'equipped' && a.id === equipped.id)), queue = [];
    resultCount.textContent = `${list.length} ${list.length === 1 ? 'personaje' : 'personajes'} · ${AVATAR_CATEGORIES.find(c => c.id === cat)?.name || ''}`;
    for (const a of list) {
      const open = isAvatarUnlocked(a.id, st), worn = a.id === equipped.id && !first, card = h('button', 'vcard' + (open ? '' : ' is-locked') + (a.id === viewing ? ' is-view' : '') + (worn ? ' is-worn' : ''));
      card.type = 'button'; card.dataset.id = a.id; card.setAttribute('aria-pressed', String(a.id === viewing)); card.setAttribute('aria-label', `${a.name}${worn ? ' (equipado)' : open ? '' : ' (bloqueado: ' + AVATAR_UNLOCKS[a.id].text + ')'}`);
      const pic = h('span', 'vcard__pic'); pic.style.setProperty('--c', hex(a.look.top)); const img = h('img'); img.alt = ''; pic.append(img);
      if (!open) pic.append(h('span', 'vcard__lock', '🔒'));
      if (worn) pic.append(h('span', 'vcard__worn', '✓'));
      const category = h('span', 'vcard__category', AVATAR_CATEGORIES.find(c => c.id === a.category)?.name || ''); category.dataset.cat = a.category;
      const state = h('span', 'vcard__state', worn ? 'Equipado' : open ? 'Disponible' : 'Por desbloquear'); state.dataset.state = worn ? 'worn' : open ? 'open' : 'locked';
      card.append(pic, category, h('strong', null, a.name), h('small', null, open ? a.route : AVATAR_UNLOCKS[a.id].text), state);
      card.addEventListener('click', () => { viewing = a.id; touched = hasTrial(); feedback = ''; paintStage(); cards.querySelectorAll('.vcard').forEach(x => { const on = x === card; x.classList.toggle('is-view', on); x.setAttribute('aria-pressed', String(on)); }); });
      cards.append(card); queue.push({ id: a.id, img, custom: { ...draft } });
    }
    // miniaturas 3D poco a poco, sin trabar la animación
    if (!list.length) cards.append(h('p', 'vest__empty', 'No hay personajes con estos filtros. Prueba otra categoría o búsqueda.'));
    thumbnails(queue);
  };

  /* Opciones cosméticas reales: el mismo catálogo validado por el servidor. */
  const fashionSections = {
    ropa: [
      { key: 'top', label: 'Playeras y chaquetas', options: TOP_OPTIONS },
      { key: 'bottom', label: 'Pantalones y faldas', options: BOTTOM_OPTIONS },
      { key: 'shoes', label: 'Calzado', options: SHOE_OPTIONS }
    ],
    accesorios: [
      { key: 'hat', label: 'Gorras y sombreros', options: HAT_OPTIONS },
      { key: 'bag', label: 'Bolsos', options: BAG_OPTIONS },
      { key: 'necklace', label: 'Collares', options: NECKLACE_OPTIONS }
    ],
    cabello: [
      { key: 'hairStyle', label: 'Peinados y pelucas', options: HAIR_STYLE_OPTIONS },
      { key: 'hairColor', label: 'Color del cabello', options: HAIR_COLORS }
    ]
  };
  const activeGroup = { ropa: 'top', accesorios: 'hat', cabello: 'hairStyle' };
  // Presentation groups contain only identifiers already present in the shared
  // catalog. Missing categories, prices and unlock states are never invented.
  const types = {
    top: [['camisetas', 'Camisetas', ['tee']], ['sudaderas', 'Sudaderas', ['hoodie']], ['chaquetas', 'Chaquetas y blazers', ['denimJacket', 'blazer']], ['tops', 'Tops', ['cropTop']]],
    bottom: [['pantalones', 'Pantalones', ['straight', 'cargo', 'flare']], ['faldas', 'Faldas', ['skirt', 'pleatedSkirt']]],
    shoes: [['tenis', 'Tenis', ['sneakers', 'chunky']], ['botas', 'Botas', ['boots']], ['mocasines', 'Mocasines', ['loafers']]],
    hat: [['gorras', 'Gorras', ['cap']], ['gorros', 'Gorros', ['beanie']], ['sombreros', 'Sombreros', ['explorerHat', 'bucketHat', 'fedora', 'cowboyHat']], ['boinas', 'Boinas', ['beret']]],
    hairStyle: [['peinados', 'Peinados', ['short', 'side', 'long', 'bun', 'ponytail', 'curly', 'pigtails', 'waves']], ['pelucas', 'Pelucas', ['bob']]]
  };
  const filters = new Map(), match = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const colorLabels = new Map([
    [0xf7f5ee, 'Marfil'], [0x8a5fd0, 'Violeta'], [0x4f78a9, 'Azul denim'], [0x374560, 'Azul noche'], [0xd888af, 'Rosa'],
    [0x4272a0, 'Azul'], [0x7f8b66, 'Oliva'], [0x4b6f96, 'Azul denim'], [0x35304b, 'Morado oscuro'], [0x645a87, 'Lavanda'],
    [0xf6f4f0, 'Blanco'], [0xeee9f2, 'Lavanda claro'], [0x563a2f, 'Café'], [0x282637, 'Negro']
  ]);
  for (const option of [...OUTFIT_COLORS, ...HAIR_COLORS, ...SKIN_TONES]) if (typeof option.color === 'number') colorLabels.set(option.color, option.name);
  const colorOf = (key, option) => {
    const field = { top: 'top', outfit: 'top', bottom: 'bottom', shoes: 'shoes', hairColor: 'hair', tone: 'skin' }[key];
    return field ? lookOf(viewing, { ...draft, [key]: option.id })[field] : null;
  };
  const style = h('div', 'vest__style');
  const paintStyle = () => {
    style.replaceChildren(); style.classList.toggle('vest__fashion', Boolean(fashionSections[tab])); const queue = [];
    const group = (label, key, options, swatch) => {
      const f = h('section', 'field vest__style-group'), head = h('div', 'vest__style-head'), row = h('div', 'chips' + (swatch ? ' chips--swatch' : '') + (key === 'tone' ? '' : ' vest__item-options') + ' vest__' + key + '-options'); f.dataset.cosmeticGroup = key; head.append(h('h3', null, label), h('small', null, 'Gratuito')); f.append(head, row);
      if (!filters.has(key)) filters.set(key, { query: '', type: '', color: '', state: '', open: false });
      const selectedFilter = filters.get(key), categories = (types[key] || []).filter(([, , ids]) => options.some(o => ids.includes(o.id))), colors = new Map();
      for (const option of options) { const color = colorOf(key, option); if (typeof color === 'number') colors.set(String(color), colorLabels.get(color) || hex(color).toUpperCase()); }
      if (selectedFilter.color && !colors.has(selectedFilter.color)) selectedFilter.color = '';
      const count = h('small', 'vest__option-count'); count.setAttribute('role', 'status');
      let summary = null;
      const renderOptions = (refresh = false) => {
        row.replaceChildren(); const jobs = [], needle = match(selectedFilter.query.trim());
        const visible = options.filter(o => (!needle || match(o.name).includes(needle)) && (!selectedFilter.type || categories.find(c => c[0] === selectedFilter.type)?.[2].includes(o.id)) && (!selectedFilter.color || String(colorOf(key, o)) === selectedFilter.color) && (selectedFilter.state !== 'equipped' || !first && viewing === equipped.id && (equipped.custom[key] || 'base') === o.id));
        // Real pieces come before reset controls, so accessories are visible on a small screen.
        visible.sort((a, b) => Number(['base', 'none'].includes(a.id)) - Number(['base', 'none'].includes(b.id)));
        count.textContent = `${visible.length} de ${options.length} opciones`;
        if (summary) { const n = [selectedFilter.type, selectedFilter.color, selectedFilter.state].filter(Boolean).length; summary.textContent = 'Filtros' + (n ? ` · ${n}` : ''); }
        visible.forEach(o => {
          const on = (draft[key] || 'base') === o.id, worn = !first && viewing === equipped.id && (equipped.custom[key] || 'base') === o.id;
          const b = h('button', (on ? 'is-on ' : '') + (worn ? 'is-equipped ' : on ? 'is-trying ' : '') + (['base', 'none'].includes(o.id) ? 'is-reset ' : '') + (key === 'tone' ? 'vest__tone' : 'voption')); b.type = 'button'; b.dataset[key] = o.id; b.title = o.name; b.setAttribute('aria-label', `${label}: ${o.name}`); b.setAttribute('aria-pressed', String(on));
          if (o.color !== null && o.color !== undefined) b.style.setProperty('--dot', hex(o.color)); else if (swatch) b.classList.add('is-base');
          if (key !== 'tone') {
            const pic = h('span', 'voption__pic'), img = h('img'), copy = h('span', 'voption__copy'); img.alt = ''; img.decoding = 'async'; pic.append(img); copy.append(h('strong', null, o.name), h('small', null, worn ? 'Equipado' : on ? 'En prueba' : 'Disponible')); b.append(pic, copy);
            if (key === 'hairColor' && o.color !== null) pic.append(h('span', 'vest__hair-swatch'));
            if (on || worn) pic.append(h('span', 'voption__check', worn ? '✓' : '◉'));
            jobs.push({ id: viewing, custom: { ...draft, [key]: o.id }, img, detail: key });
          } else b.append(h('span', 'vest__tone-dot'), h('span', 'vest__tone-name', o.name));
          b.addEventListener('click', () => { draft = cleanCustom({ ...draft, [key]: o.id }); touched = hasTrial(); feedback = ''; paintStyle(); paintStage(); style.querySelector(`[data-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${o.id}"]`)?.focus({ preventScroll: true }); });
          row.append(b);
        });
        if (!visible.length) {
          const empty = h('div', 'vest__catalog-empty'), reset = h('button', 'vest__clear-filters', 'Limpiar filtros'); reset.type = 'button'; empty.append(h('p', null, 'No hay opciones con estos filtros.'), reset); row.append(empty);
          reset.addEventListener('click', () => { Object.assign(selectedFilter, { query: '', type: '', color: '', state: '' }); paintStyle(); });
        }
        if (refresh) thumbnails(jobs); else queue.push(...jobs);
      };
      if (fashionSections[tab]) {
        const controls = h('div', 'vest__catalog-tools'), search = h('label', 'vest__catalog-search'), input = h('input'), detail = h('details', 'vest__filters'), fields = h('div', 'vest__filter-fields');
        input.type = 'search'; input.value = selectedFilter.query; input.placeholder = 'Buscar opción…'; input.setAttribute('aria-label', 'Buscar en ' + label); search.append(input); input.addEventListener('input', () => { selectedFilter.query = input.value; renderOptions(true); });
        summary = h('summary', '', 'Filtros'); detail.open = selectedFilter.open; detail.addEventListener('toggle', () => { selectedFilter.open = detail.open; }); detail.append(summary, fields); controls.append(search, detail);
        const select = (caption, field, values) => {
          const label = h('label', 'vest__filter-field'), control = h('select'); control.setAttribute('aria-label', caption); control.dataset.wardrobeFilter = field;
          for (const [value, text] of values) { const option = h('option', null, text); option.value = value; control.append(option); }
          control.value = selectedFilter[field]; control.addEventListener('change', () => { selectedFilter[field] = control.value; renderOptions(true); }); label.append(h('span', null, caption), control); fields.append(label);
        };
        if (categories.length > 1) select('Tipo', 'type', [['', 'Todos los tipos'], ...categories.map(([id, name]) => [id, name])]);
        if (colors.size > 1) select('Color', 'color', [['', 'Todos los colores'], ...colors]);
        if (!first) select('Estado', 'state', [['', 'Todas las opciones'], ['available', 'Disponibles'], ['equipped', 'Equipado']]);
        f.insertBefore(controls, row); f.append(count);
      }
      renderOptions();
      return f;
    };
    const sections = fashionSections[tab];
    if (sections) {
      const nav = h('div', 'vest__fashion-cats'); nav.setAttribute('aria-label', 'Categorías de ' + tab);
      for (const section of sections) {
        const b = h('button', activeGroup[tab] === section.key ? 'is-on' : '', section.label); b.type = 'button'; b.dataset.fashionGroup = section.key; b.setAttribute('aria-pressed', String(activeGroup[tab] === section.key));
        b.addEventListener('click', () => { activeGroup[tab] = section.key; paintStyle(); style.querySelector('[data-fashion-group="' + section.key + '"]')?.focus({ preventScroll: true }); }); nav.append(b);
      }
      const selected = sections.find(s => s.key === activeGroup[tab]) || sections[0];
      style.append(nav, group(selected.label, selected.key, selected.options, false));
      if (tab === 'cabello') style.append(h('p', 'note', 'Si llevas sombrero, puede cubrir parte del peinado. Puedes cambiarlo en Accesorios.'));
    } else style.append(group('Color del atuendo', 'outfit', OUTFIT_COLORS, true), group('Sombrero', 'hat', HAT_OPTIONS), group('Tono de piel', 'tone', SKIN_TONES, true));
    style.append(h('p', 'note', first ? 'Prueba tu estilo. Lo aplicarás al comenzar.' : 'Prueba y combina. Pulsa Equipar selección para aplicar tu apariencia.'));
    thumbnails(queue);
  };

  const tabs = h('div', 'tabs vest__tabs'), body = h('div', 'vest__body');
  const show = id => { tab = id; tabs.querySelectorAll('button').forEach(b => { const on = b.dataset.id === id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); }); body.replaceChildren(); customize.classList.toggle('is-on', id !== 'personajes'); if (id === 'personajes') { body.append(cats, tools, resultCount, cards); paintCards(); } else { if (!first && !isAvatarUnlocked(viewing, st)) viewing = st.avatarId; body.append(style); paintStyle(); } paintStage(); };
  [['personajes', 'Personajes', 'person'], ['ropa', 'Ropa', 'shirt'], ['accesorios', 'Accesorios', 'bag'], ['cabello', 'Cabello', 'hair'], ['estilo', 'Estilo', 'palette']].forEach(([id, t, symbol]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.id = id; b.prepend(icon(symbol)); b.addEventListener('click', () => show(id)); tabs.append(b); });
  const owned = AVATARS.filter(a => isAvatarUnlocked(a.id, st)).length;
  panel.append(tabs, body);
  const collection = h('div', 'vest__collection'); collection.append(h('span', null, first ? 'TU PRIMER PERSONAJE' : 'TU COLECCIÓN'), h('strong', null, first ? 'El comienzo de tu aventura' : `${owned} de ${AVATARS.length} personajes`)); panel.append(collection, h('p', 'vest__collection-note', 'Se consiguen jugando. Todos son cosméticos: no dan ventaja ni se compran.'));
  wrap.append(stage, panel); show(!first && ['personajes', 'ropa', 'accesorios', 'cabello', 'estilo'].includes(initialTab) ? initialTab : 'personajes');

  const stop = () => { thumbnailRun++; clearPending(); offProfile?.(); offStatus?.(); preview && preview.stop(); thumbs && thumbs.stop(); };
  if (first) {
    // Si el perfil de la cuenta llega tarde (conexión lenta) y ya tiene personaje, esta selección no
    // aplica: se cierra sola y NO se guarda encima del personaje y la ropa que la persona ya tenía.
    const known = setInterval(() => { if (!wrap.isConnected) return clearInterval(known); if (st.avatarChosen) { clearInterval(known); document.getElementById('modal-x')?.click(); ui.toast?.('Recuperamos tu personaje de tu cuenta.', 2600); } }, 300);
    return ui.modal({ eyebrow: 'Bienvenida a Ciudad ICADEM', title: 'Elige tu personaje', content: wrap, wide: true, onClose: stop,
      actions: [{ id: 'ok', label: 'Comenzar con este personaje', primary: true }] })
      .then(id => { clearInterval(known); if (!st.avatarChosen) api.setAvatar(viewing, draft); return id; });
  }
  offProfile = api.net?.on('profile', message => {
    if (!wrap.isConnected || !message.profile) return;
    if (message.op === 'avatar' && Number.isFinite(message.n)) { if (message.n <= lastAvatarAck) return; lastAvatarAck = message.n; }
    const confirmed = { id: message.profile.avatarId, custom: cleanCustom(message.profile.custom) };
    equipped = confirmed;
    if (message.op === 'avatar' && message.ok === false) { clearPending(); touched = true; feedback = 'Cambio no autorizado. Puedes ajustar tu selección.'; }
    else if (pendingLook && sameLook(confirmed, pendingLook)) { clearPending(); feedback = 'Apariencia confirmada'; }
    else if (message.op === 'get' && pendingLook && !sameLook({ id: st.avatarId, custom: st.custom }, pendingLook)) { clearPending(); touched = true; feedback = 'Sin confirmación. Puedes volver a equipar.'; }
    else if (message.op === 'avatar' && message.ok === true && sameLook(confirmed, current())) { feedback = 'Apariencia confirmada'; touched = false; }
    if (!touched && !pendingLook) { viewing = confirmed.id; draft = cleanCustom(confirmed.custom); }
    paintStage(); if (tab === 'personajes') paintCards(); else paintStyle();
  });
  offStatus = api.net?.on('status', message => { if (!wrap.isConnected || message.status === 'online' || !pendingLook) return; clearPending(); touched = true; feedback = 'Sin confirmación. Tu prueba sigue disponible.'; paintStage(); });
  const result = ui.modal({ eyebrow: 'Ciudad ICADEM · Avatar Studio', title: 'Mi avatar', content: wrap, wide: true, onClose: stop,
    actions: [{ id: 'equip', label: 'Equipar selección', primary: true, disabled: true, close: false, onClick: applyDraft }, { id: 'close', label: 'Cerrar' }] });
  requestAnimationFrame(refreshActions);
  return result;
}
