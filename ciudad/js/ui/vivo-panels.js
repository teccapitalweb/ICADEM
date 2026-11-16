// Ciudad ICADEM 2.0 · interfaces de Mundo vivo. El servidor conserva la autoridad sobre cada acción.
import { SPECIES, PET_SLOTS, WALK_SCENES, PET_SCENES, breedById } from '../pets/pet-catalog.js';
import { ITEMS, SHOPS, itemById } from '../economy/catalog.js';
import { PetPreview } from '../pets/pet-preview.js';
import { levelFromXp } from '../core/store.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (label, cls, fn) => { const b = h('button', 'btn ' + (cls || ''), label); b.type = 'button'; b.dataset.vpFocus = label; b.addEventListener('click', fn); return b; };
const closeModal = () => document.getElementById('modal-x')?.click();
const KINDS = { wear: 'Ropa y calzado', petAcc: 'Accesorios', petToy: 'Juguetes de mascota', treat: 'Premios', furniture: 'Muebles', toy: 'Juguetes' };
const money = n => Number(n || 0).toLocaleString('es-MX');
const equalAcc = (a = {}, b = {}) => Object.keys(PET_SLOTS).every(k => (a[k] || null) === (b[k] || null));
function needOnline(api) {
  if (api.vivo.online) return false;
  api.ui.toast('Conéctate a la ciudad para consultar tu colección y su saldo actualizado.', 3600); return true;
}
function input(label, value, onInput, type = 'search') {
  const e = h('input', 'vp__input'); e.type = type; e.value = value; e.setAttribute('aria-label', label); e.placeholder = label; e.dataset.vpFocus = label;
  e.addEventListener('input', () => onInput(e.value)); return e;
}
function chip(label, selected, callback) {
  const e = btn(label, 'vp__chip' + (selected ? ' is-on' : ''), callback); e.setAttribute('aria-pressed', String(selected)); return e;
}
function empty(text) { return h('p', 'vp__empty', text); }
function block(title, ...content) { const e = h('section', 'vp__block'); e.append(h('h4', null, title), ...content); return e; }
function balance(api) {
  const e = h('div', 'vp__balance'); e.append(h('span', null, 'Monedas de la ciudad'), h('strong', null, money(api.vivo.coins))); return e;
}

/** Una intención pendiente por panel. No descuenta monedas ni concede objetos antes de la respuesta. */
function panel(api, cls) {
  const wrap = h('div', 'vp vp--premium ' + cls), status = h('div', 'vp__status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const p = { wrap, status, alive: true, pending: false, uncertain: false, message: '', error: false, render: () => {}, cleanups: [] };
  let renderQueued = false;
  p.update = () => {
    if (!p.alive || renderQueued) return;
    renderQueued = true; queueMicrotask(() => { renderQueued = false; if (!p.alive) return;
      const focused = document.activeElement, key = focused?.dataset.vpFocus, pos = focused?.selectionStart;
      const recoverableOps = cls.includes('pets') ? ['adopt'] : cls.includes('shop') ? ['buy'] : ['buy', 'adopt'];
      const savedIntents = (api.vivo.pendingTransactions?.() || []).filter(t => recoverableOps.includes(t.op));
      if (savedIntents.length) { p.uncertain = true; if (!p.message) { const t = savedIntents[0], name = t.op === 'buy' ? itemById(t.payload.item)?.name : breedById(t.payload.breed)?.name; p.message = `Confirmación pendiente: ${name || 'operación anterior'}${t.payload.qty ? ' ×' + t.payload.qty : ''}. Recupera su resultado antes de continuar.`; } }
      p.render();
      status.replaceChildren(h('span', null, p.pending ? 'Confirmando con la ciudad…' : !api.vivo.online ? 'Sin conexión. Tu colección se conserva; las acciones esperan a la ciudad.' : p.message));
      status.classList.toggle('is-error', p.error); status.hidden = !status.textContent && !p.uncertain;
      if (p.uncertain) {
        const refresh = btn('Actualizar mi colección', '', p.refresh); refresh.disabled = p.pending || !api.vivo.online; status.append(refresh);
        const saved = savedIntents[0];
        if (p.intent || saved) { const recover = btn('Recuperar confirmación', '', () => {
          if (p.pending || !api.vivo.online) return;
          const intent = p.intent; p.uncertain = false;
          if (intent) p.run(intent.fn, intent.success, intent.done, true);
          else p.run(() => api.vivo.retryTransaction(saved.key), 'Confirmación recuperada. Tu colección está actualizada.');
        }); recover.disabled = p.pending || !api.vivo.online; status.append(recover); }
      }
      wrap.setAttribute('aria-busy', String(p.pending));
      wrap.querySelectorAll('[data-vp-write]').forEach(e => { e.disabled = Boolean(e.disabled || p.pending || p.uncertain || !api.vivo.online); });
      if (key) { const target = [...wrap.querySelectorAll('[data-vp-focus]')].find(e => e.dataset.vpFocus === key); if (target) { target.focus({ preventScroll: true }); if (typeof pos === 'number' && target.type !== 'number') { try { target.setSelectionRange(pos, pos); } catch (_) {} } } }
    });
  };
  p.write = (label, cls, fn) => { const e = btn(label, cls, fn); e.dataset.vpWrite = ''; return e; };
  p.run = async (fn, success, done, recoverable = false) => {
    if (!p.alive || p.pending || p.uncertain || !api.vivo.online) return;
    const recovering = Boolean(p.intent);
    p.pending = true; p.message = ''; p.error = false; if (recoverable) p.intent = { fn, success, done }; p.update();
    let r; try { r = await fn(); } catch (_) { r = { ok: false, reason: 'sin-respuesta' }; }
    if (!p.alive) return r;
    p.pending = false; p.error = !r?.ok;
    if (r?.ok) { p.intent = null; p.message = typeof success === 'function' ? success(r) : success || 'Cambio confirmado.'; done?.(r); }
    else { p.uncertain = r?.reason === 'sin-respuesta' || r?.reason === 'pendiente-confirmacion' || (recovering && r?.reason === 'sin-conexion'); if (!p.uncertain) p.intent = null; p.message = p.uncertain ? 'Falta confirmar el resultado. Actualiza tu colección; recuperar la confirmación consulta la misma solicitud.' : r?.message || 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.'; }
    p.update(); return r;
  };
  p.refresh = () => {
    if (!p.alive || p.pending || !api.vivo.online) return;
    p.pending = true; p.update(); let timer, off;
    const finish = ok => { clearTimeout(timer); off?.(); p.pending = false; if (ok && !p.intent) p.uncertain = false;
      p.error = !ok; p.message = ok ? 'Colección actualizada con el servidor.' + (p.intent ? ' Recupera la confirmación de la operación original antes de continuar.' : ' Revisa el resultado antes de repetir una acción.') : 'Todavía no hay respuesta. No repetimos tu compra.'; p.update(); };
    off = api.net.on('profile', m => { if (m.op === 'get' && m.ok && m.profile) finish(true); });
    timer = setTimeout(() => finish(false), 10000); p.cleanups.push(() => { clearTimeout(timer); off?.(); });
    if (!api.net.profile('get')) finish(false);
  };
  p.cleanups.push(api.vivo.on('change', p.update), api.net.on('status', p.update));
  p.close = () => { p.alive = false; p.cleanups.forEach(f => f?.()); };
  return p;
}

/** Miniaturas derivadas de los modelos originales; un solo renderizador y una foto por cuadro. */
function petPictures(api, p) {
  const cache = new Map(), jobs = []; let camera = null, raf = 0;
  function tick() {
    raf = 0; if (!p.alive) return;
    let job; while ((job = jobs.shift()) && !job.image.isConnected) {} if (!job) return;
    try {
      camera ||= new PetPreview(api.engine.renderer, { width: 124, height: 104 });
      camera.show(job.breed, job.acc); camera.avatar.group.rotation.y = 0.45;
      camera.avatar.update(0.016, { speed: 0 }); camera.draw();
      const url = camera.canvas.toDataURL('image/png'); cache.set(job.key, url); job.image.src = url; job.image.hidden = false; job.fallback.hidden = true;
      if (cache.size > 64) cache.delete(cache.keys().next().value);
    } catch (_) { /* El nombre y la especie siguen visibles si el dispositivo no permite una foto. */ }
    if (jobs.length) raf = requestAnimationFrame(tick);
  }
  p.cleanups.push(() => { cancelAnimationFrame(raf); jobs.length = 0; cache.clear(); camera?.stop(); });
  return (breed, acc = {}) => {
    const box = h('span', 'vp__petphoto'), image = h('img'), fallback = h('span', 'vp__petglyph', SPECIES[breedById(breed).species].icon);
    image.alt = ''; image.width = 124; image.height = 104; image.hidden = true; box.append(image, fallback);
    const key = breed + JSON.stringify(acc);
    if (cache.has(key)) { image.src = cache.get(key); image.hidden = false; fallback.hidden = true; }
    else { jobs.push({ breed, acc, image, fallback, key }); if (!raf) raf = requestAnimationFrame(tick); }
    return box;
  };
}

/* ================= Mascotas y paseos ================= */
export function openPets(api, tab = 'mis') {
  if (api.ui.isBlocking || needOnline(api)) return Promise.resolve('blocked');
  const p = panel(api, 'vp--pets'), { wrap, status } = p, stage = h('aside', 'vp__stage'), body = h('div', 'vp__body'), tabs = h('div', 'tabs'), right = h('div', 'vp__panel');
  const caption = h('div', 'vp__caption'); let preview, previewKey = '';
  try { preview = new PetPreview(api.engine.renderer, { width: 280, height: 240 }); stage.append(preview.canvas); } catch (_) {}
  stage.append(caption); const photo = petPictures(api, p);
  p.cleanups.push(() => preview?.stop());
  let selected = api.vivo.activePet?.id || api.vivo.state.pets[0]?.id, species = 'perro', viewing = null, query = '', access = 'todas', confirmAdopt = false;
  const drafts = new Map(), names = new Map(); let adoptName = '';
  tab = tab === 'adoptar' ? tab : 'mis';
  const show = (breed, acc, name, detail) => {
    const key = breed + JSON.stringify(acc); if (preview && key !== previewKey) { preview.show(breed, acc); previewKey = key; }
    caption.replaceChildren(h('small', null, SPECIES[breedById(breed).species].name), h('strong', null, name), h('span', null, detail || ''));
  };
  const go = id => { tab = id; confirmAdopt = false; p.update(); };
  function owned() {
    const s = api.vivo.state, pet = s.pets.find(x => x.id === selected) || s.pets[0];
    if (!pet) { stage.hidden = true; body.append(empty('Tu colección está lista para su primer compañero.'), btn('Ver mascotas para adoptar', 'btn--primary', () => go('adoptar'))); return; }
    stage.hidden = false; selected = pet.id; const breed = breedById(pet.breed), active = pet.id === s.activePet;
    const current = { ...pet.acc, ...drafts.get(pet.id) }, dirty = !equalAcc(current, pet.acc);
    if (!dirty) drafts.delete(pet.id);
    show(pet.breed, current, pet.name, dirty ? 'Vista previa · accesorios sin guardar' : active ? api.vivo.leash ? 'De paseo contigo' : 'Te acompaña' : 'En tu colección');
    const list = h('div', 'vp__owned');
    for (const x of s.pets) {
      const b = chip('', x.id === selected, () => { selected = x.id; p.update(); }); b.classList.add('vp__ownedpet'); b.dataset.vpFocus = 'mascota:' + x.id;
      b.append(photo(x.breed, x.acc), h('strong', null, x.name), h('small', null, breedById(x.breed).name)); if (x.id === s.activePet) b.append(h('span', 'vp__tag', 'Te acompaña')); list.append(b);
    }
    body.append(list);
    const actions = h('div', 'vp__actions');
    actions.append(p.write(active ? 'Que se quede en casa' : 'Que me acompañe', active ? '' : 'btn--primary', () => p.run(() => active ? api.vivo.rest() : api.vivo.setPet(pet.id, { active: true }), active ? 'Tu mascota descansa en casa.' : `${pet.name} te acompaña.`)));
    if (active && breed.species === 'perro') actions.append(p.write(api.vivo.leash ? 'Quitar la correa' : 'Salir a pasear con correa', '', () => {
      if (!api.vivo.leash && !WALK_SCENES.includes(api.sceneName)) return api.ui.toast('Sal a la plaza, al parque o al Distrito para pasear con correa.');
      p.run(() => api.vivo.walk(!api.vivo.leash), r => r.leash ? '¡De paseo! Los demás jugadores ven la correa.' : 'Correa retirada.');
    }));
    if (active && PET_SCENES.includes(api.sceneName)) {
      actions.append(btn('Acariciar', '', () => { closeModal(); setTimeout(() => { api.player.emote('petting', 2.2); api.pets.react('cariño'); }, 150); }));
      if (breed.species === 'perro' || ['fox', 'wolf', 'lion'].includes(breed.form)) actions.append(btn('Lanzar la pelota', '', () => { closeModal(); setTimeout(() => api.actions.ball(), 200); }));
    }
    body.append(actions);
    const accBox = block('Vestir a tu mascota'), compatible = api.vivo.accessoriesFor(pet.id), missingSlots = [];
    for (const [slot, items] of Object.entries(compatible)) {
      if (!items.length && !current[slot]) { missingSlots.push(PET_SLOTS[slot].name.toLocaleLowerCase('es')); continue; }
      const row = h('div', 'vp__slot'), choices = h('div', 'vp__choices'); row.append(h('span', 'vp__slotname', PET_SLOTS[slot].name));
      const choose = id => { drafts.set(pet.id, { ...drafts.get(pet.id), [slot]: id }); p.update(); };
      const none = chip('Ninguno', !current[slot], () => choose(null)); none.dataset.vpFocus = slot + ':none'; none.dataset.vpWrite = ''; choices.append(none);
      for (const it of items) { const c = chip(it.name, current[slot] === it.id, () => choose(it.id)); c.dataset.vpFocus = slot + ':' + it.id; c.dataset.vpWrite = ''; if (it.color != null) { const dot = h('i', 'vp__swatch'); dot.style.backgroundColor = typeof it.color === 'number' ? '#' + it.color.toString(16).padStart(6, '0') : it.color; c.prepend(dot); } choices.append(c); }
      if (!items.length) choices.append(h('small', 'note', 'Los accesorios compatibles que consigas aparecerán aquí.'));
      row.append(choices); accBox.append(row);
    }
    if (missingSlots.length) accBox.append(h('p', 'note', 'En la tienda encontrarás más accesorios compatibles: ' + missingSlots.join(', ') + '.'));
    if (dirty) { const save = h('div', 'vp__actions'); save.append(p.write('Guardar accesorios', 'btn--primary', () => p.run(() => api.vivo.setPet(pet.id, { acc: drafts.get(pet.id) }), 'Accesorios guardados.', () => drafts.delete(pet.id))), p.write('Descartar', '', () => { drafts.delete(pet.id); p.update(); })); accBox.append(save); }
    body.append(accBox);
    const food = block('Cuidar y compartir'), feedMessage = r => r.treat ? `¡A ${pet.name} le encantó!` : `${pet.name} comió sus croquetas.${r.coins ? ' +' + r.coins + ' monedas por cuidarle hoy.' : ''}`;
    const feed = id => p.run(() => api.vivo.feed(pet.id, id), feedMessage, r => { if (active) { api.ui.toast(feedMessage(r), 3000); closeModal(); setTimeout(() => { api.player.emote('petting', 1.4); api.pets.react('food'); }, 150); } });
    food.append(p.write('Croquetas · gratis', '', () => feed('croquetas')));
    for (const t of ITEMS.filter(i => i.kind === 'treat' && i.species.includes(breed.species))) { const b = p.write(`${t.icon} ${t.name} · ${s.inv[t.id] || 0}`, '', () => feed(t.id)); b.disabled = !s.inv[t.id]; food.append(b); }
    body.append(food);
    const name = input('Nombre de la mascota', names.get(pet.id) ?? pet.name, v => names.set(pet.id, v), 'text'); name.maxLength = 16; name.dataset.vpWrite = '';
    const rename = p.write('Cambiar nombre', '', () => p.run(() => api.vivo.setPet(pet.id, { name: name.value }), 'Nombre guardado.', () => names.delete(pet.id)));
    body.append(block('Su nombre', name, rename), h('p', 'note', 'Las mascotas no enferman ni se pierden. Su nombre es privado. Los accesorios de la vista previa se aplican al guardar.'));
  }
  function adoption() {
    stage.hidden = false; const catalog = api.vivo.catalog(), options = h('div', 'vp__filters');
    for (const [id, sp] of Object.entries(SPECIES)) options.append(chip(sp.icon + ' ' + sp.name, species === id, () => { species = id; viewing = null; confirmAdopt = false; p.update(); }));
    const tools = h('div', 'vp__tools'), search = input('Buscar mascota', query, v => { query = v; p.update(); });
    const filter = h('select', 'vp__input'); filter.setAttribute('aria-label', 'Disponibilidad de mascotas'); filter.dataset.vpFocus = 'Disponibilidad';
    for (const [id, name] of [['todas', 'Todas'], ['disponibles', 'Disponibles'], ['coleccion', 'En mi colección']]) { const o = h('option', null, name); o.value = id; filter.append(o); } filter.value = access;
    filter.addEventListener('change', () => { access = filter.value; p.update(); }); tools.append(search, filter);
    const all = catalog.filter(b => b.species === species && b.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')) && (access === 'todas' || (access === 'coleccion' ? b.adopted : b.available && !b.adopted)));
    if (!all.some(b => b.id === viewing)) viewing = (all.find(b => b.free && !b.adopted) || all[0])?.id;
    const list = h('div', 'vp__grid vp__breeds');
    for (const b of all) {
      const card = chip('', b.id === viewing, () => { viewing = b.id; confirmAdopt = false; adoptName = ''; p.update(); }); card.className = 'vp__card' + (b.id === viewing ? ' is-on' : ''); card.dataset.vpFocus = 'raza:' + b.id;
      card.append(photo(b.id), h('b', null, b.name), h('small', null, b.adopted ? 'En tu colección' : b.free ? 'Gratis' : b.requirement.met ? b.cost ? money(b.cost) + ' monedas' : 'Desbloqueada' : b.requirement.text));
      if (!b.requirement.met && b.requirement.progress) { const [n, m] = b.requirement.progress, progress = h('progress'); progress.max = Math.max(1, m); progress.value = n; progress.setAttribute('aria-label', b.requirement.text); card.append(progress); }
      list.append(card);
    }
    body.append(options, tools, h('small', 'vp__count', all.length + ' de ' + catalog.length + ' razas'), list);
    const b = all.find(x => x.id === viewing);
    if (!b) { stage.hidden = true; body.append(empty('No hay mascotas con estos filtros.')); return; }
    show(b.id, {}, b.name, b.personality);
    const detail = block(b.name, h('p', 'note', b.personality));
    if (b.adopted) detail.append(h('span', 'vp__tag', 'Ya forma parte de tu colección'));
    else if (!b.available) detail.append(h('p', 'note', 'Para adoptarla: ' + b.requirement.text));
    else {
      const name = input('Nombre de la nueva mascota', adoptName, v => { adoptName = v; }, 'text'); name.maxLength = 16; name.dataset.vpWrite = '';
      const adopt = () => { const petName = name.value.trim() || b.name.split(' ')[0]; return p.run(() => api.vivo.adopt(b.id, petName), r => r.pet ? `¡${r.pet.name} llegó a tu colección!` : 'Adopción confirmada.', r => { selected = r.pet?.id || selected; confirmAdopt = false; tab = 'mis'; }, true); };
      detail.append(name);
      if (confirmAdopt) detail.append(h('p', 'vp__confirmcopy', `Confirmar adopción de ${b.name} por ${money(b.cost)} monedas de la ciudad.`), p.write('Confirmar adopción', 'btn--primary', adopt), btn('Cancelar', '', () => { confirmAdopt = false; p.update(); }));
      else { const action = p.write(b.cost ? `Adoptar · ${money(b.cost)} monedas` : 'Adoptar gratis', 'btn--primary', () => b.cost ? (confirmAdopt = true, p.update()) : adopt()); action.disabled = b.cost > api.vivo.coins; detail.append(action); if (b.cost > api.vivo.coins) detail.append(h('small', 'note', `Faltan ${money(b.cost - api.vivo.coins)} monedas.`)); }
    }
    body.append(detail, h('p', 'note', 'Compañeros del juego: gratis, por actividades o con monedas de la ciudad. Nunca con dinero real.'));
  }
  const tabButtons = [['mis', 'Mis mascotas'], ['adoptar', 'Adoptar']].map(([id, title]) => { const e = btn(title, '', () => go(id)); e.dataset.id = id; tabs.append(e); return e; });
  right.append(tabs, status, body); wrap.append(stage, right);
  p.render = () => { for (const e of tabButtons) { e.classList.toggle('is-on', e.dataset.id === tab); e.setAttribute('aria-pressed', String(e.dataset.id === tab)); } body.replaceChildren(balance(api)); (tab === 'mis' ? owned : adoption)(); };
  p.update(); const result = api.ui.modal({ eyebrow: 'Mundo vivo', title: 'Mis mascotas', content: wrap, wide: true, onClose: p.close });
  if (preview) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) preview.spin = 0; preview.start(); } return result;
}

/** Equipar conserva el contrato original; el mensaje de éxito espera el perfil confirmado. */
function wear(api, p, item, done) {
  return new Promise(resolve => {
    let timer, off; const finish = r => { clearTimeout(timer); off?.(); if (r.ok) done?.(r.profile.custom); resolve(r); };
    off = api.net.on('profile', m => { if (m.op !== 'avatar') return; if (!m.ok) finish({ ok: false, message: 'El servidor no autorizó esa prenda.' }); else if (m.profile?.custom?.[item.slot] === item.option) finish(m); });
    timer = setTimeout(() => finish({ ok: false, reason: 'sin-respuesta' }), 10000); p.cleanups.push(() => { clearTimeout(timer); off?.(); });
    const st = api.store.state; if (!api.setAvatar(st.avatarId, { ...st.custom, [item.slot]: item.option })) finish({ ok: false, message: 'No se pudo solicitar esa prenda.' });
  });
}
function itemArt(it) { const e = h('span', 'vp__itemart', it.icon || '•'); e.setAttribute('aria-hidden', 'true'); if (it.color != null) e.style.setProperty('--item-color', typeof it.color === 'number' ? '#' + it.color.toString(16).padStart(6, '0') : it.color); return e; }

/* ================= Inventario ================= */
export function openInventory(api) {
  if (api.ui.isBlocking || needOnline(api)) return Promise.resolve('blocked');
  const p = panel(api, 'vp--inv'), { wrap, status } = p, content = h('div', 'vp__body'); let kind = 'all', query = '', custom = { ...api.store.state.custom };
  p.cleanups.push(api.net.on('profile', m => { if (m.ok && m.profile?.custom) { custom = { ...m.profile.custom }; p.update(); } }));
  p.render = () => {
    const s = api.vivo.state, owned = ITEMS.filter(it => s.inv[it.id] > 0), list = h('div', 'vp__inventory'), filters = h('div', 'vp__filters');
    filters.append(chip('Todo · ' + owned.length, kind === 'all', () => { kind = 'all'; p.update(); }));
    for (const [id, label] of Object.entries(KINDS)) if (owned.some(it => it.kind === id)) filters.append(chip(label, kind === id, () => { kind = id; p.update(); }));
    const st = api.store.state, resources = h('div', 'vp__resources'); resources.append(balance(api), block('Experiencia', h('strong', null, money(st.xp) + ' XP')), block('Nivel', h('strong', null, String(levelFromXp(st.xp).level))));
    const items = owned.filter(it => (kind === 'all' || it.kind === kind) && it.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
    for (const it of items) {
      const row = h('div', 'vp__inventoryrow'), copy = h('div', 'rowi__copy'); copy.append(h('strong', null, it.name), h('small', null, (KINDS[it.kind] || SHOPS[it.shop].name) + ' · cantidad ' + s.inv[it.id])); row.append(itemArt(it), copy);
      if (it.kind === 'toy') row.append(btn('Usar', 'btn--primary', () => { closeModal(); setTimeout(() => api.actions.useToy(it.id), 150); }));
      else if (it.kind === 'wear') row.append(custom[it.slot] === it.option ? h('span', 'vp__tag', 'Puesta') : p.write('Ponérmela', '', () => p.run(() => wear(api, p, it, c => { custom = { ...c }; }), 'Prenda confirmada.')));
      else if (['petAcc', 'petToy', 'treat'].includes(it.kind)) row.append(btn('Mis mascotas', '', () => { closeModal(); setTimeout(() => api.actions.pets(), 150); }));
      else if (it.kind === 'furniture') row.append(btn('Mi vivienda', '', () => { closeModal(); setTimeout(() => api.actions.home(), 150); }));
      else row.append(h('span', 'vp__tag', '×' + s.inv[it.id])); list.append(row);
    }
    content.replaceChildren(resources, filters, input('Buscar en mi inventario', query, v => { query = v; p.update(); }), h('small', 'vp__count', items.length + ' artículos'), list);
    if (!items.length) content.append(empty('No hay artículos con estos filtros.'));
    content.append(h('p', 'note', 'Colección y cantidades confirmadas por la ciudad. Las monedas son del juego; no se venden ni se transfieren.'));
  };
  wrap.append(status, content); p.update(); return api.ui.modal({ eyebrow: 'Mundo vivo', title: 'Mi inventario', content: wrap, wide: true, onClose: p.close });
}

/* ================= Tiendas y compras ================= */
export function openShop(api, shopId, { greeting } = {}) {
  if (api.ui.isBlocking || needOnline(api)) return Promise.resolve('blocked');
  const shop = SHOPS[shopId]; if (!shop) return Promise.resolve('x');
  const p = panel(api, 'vp--shop'), { wrap, status } = p, body = h('div', 'vp__body'); let query = '', kind = 'all', selected = null, quantity = 1, custom = { ...api.store.state.custom };
  p.cleanups.push(api.net.on('profile', m => { if (m.ok && m.profile?.custom) { custom = { ...m.profile.custom }; p.update(); } }));
  p.render = () => {
    const all = api.vivo.shop(shopId), kinds = [...new Set(all.map(it => it.kind))], filters = h('div', 'vp__filters'), list = h('div', 'vp__grid vp__products');
    if (kinds.length > 1) { filters.append(chip('Todo', kind === 'all', () => { kind = 'all'; p.update(); })); for (const id of kinds) filters.append(chip(KINDS[id] || id, kind === id, () => { kind = id; p.update(); })); }
    const items = all.filter(it => (kind === 'all' || it.kind === kind) && it.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
    body.replaceChildren(...(greeting ? [h('p', 'vp__greeting', greeting)] : []), balance(api), input('Buscar en ' + shop.name, query, v => { query = v; p.update(); }), filters);
    // La confirmación permanece antes del catálogo para que resulte accesible también en móvil.
    const current = all.find(it => it.id === selected);
    if (current) {
      const detail = block('Confirmar compra', h('strong', null, current.name));
      if (current.unique && current.owned) detail.append(h('p', 'note', 'Este artículo ya está en tu inventario.'));
      else {
        if (current.stack) { const qty = h('select', 'vp__input'); qty.setAttribute('aria-label', 'Cantidad a comprar'); qty.dataset.vpFocus = 'Cantidad a comprar'; qty.dataset.vpWrite = ''; const max = Math.max(1, Math.min(10, 99 - current.owned)); quantity = Math.min(quantity, max); for (let n = 1; n <= max; n++) { const o = h('option', null, String(n)); o.value = n; qty.append(o); } qty.value = quantity; qty.addEventListener('change', () => { quantity = Number(qty.value); p.update(); }); detail.append(qty); }
        else quantity = 1;
        const total = current.price * quantity, buy = p.write(`Confirmar · ${money(total)} monedas`, 'btn--primary', () => { const count = quantity; return p.run(() => api.vivo.buy(current.id, count), r => r.duplicate ? 'La compra ya estaba registrada. Inventario actualizado.' : `Compra confirmada: ${current.name}. Está en tu inventario.`, () => { selected = null; quantity = 1; }, true); });
        buy.disabled = total > api.vivo.coins; detail.append(h('p', 'note', `Tienes ${money(api.vivo.coins)} monedas. Total: ${money(total)}. Se cobra únicamente al confirmar.`), buy);
        if (total > api.vivo.coins) detail.append(h('small', 'note', `Faltan ${money(total - api.vivo.coins)} monedas.`));
      }
      detail.append(btn('Cancelar', '', () => { selected = null; p.update(); })); body.append(detail);
    }
    for (const it of items) {
      const card = h('article', 'vp__card vp__product'), held = it.unique && it.owned; card.append(itemArt(it), h('b', null, it.name), h('small', null, money(it.price) + ' monedas'), h('small', 'vp__quantity', 'En tu inventario: ' + it.owned));
      if (held && it.kind === 'wear') card.append(custom[it.slot] === it.option ? h('span', 'vp__tag', 'Puesta') : p.write('Ponérmela', '', () => p.run(() => wear(api, p, it, c => { custom = { ...c }; }), 'Prenda confirmada.')));
      else if (held) card.append(h('span', 'vp__tag', 'Ya lo tienes'));
      else { const b = p.write('Comprar', 'btn--primary', () => { selected = it.id; quantity = 1; p.update(); requestAnimationFrame(() => { const first = body.querySelector('.vp__block button'); first?.focus({ preventScroll: true }); body.querySelector('.vp__block')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }); }); b.disabled = !it.affordable || (it.kind === 'furniture' && it.owned >= 9) || (it.stack && it.owned >= 99); card.append(b); if (!it.affordable) card.append(h('small', 'note', 'Faltan ' + money(it.price - api.vivo.coins) + ' monedas')); }
      list.append(card);
    }
    body.append(h('small', 'vp__count', items.length + ' artículos'), list); if (!items.length) body.append(empty('No hay artículos con estos filtros.'));
    body.append(h('p', 'note', 'Compras con monedas de Ciudad ICADEM, nunca con dinero real. Los requisitos, cantidades y saldo los valida el servidor.'));
  };
  wrap.append(status, body); p.update(); return api.ui.modal({ eyebrow: shop.icon + ' Tienda', title: shop.name, content: wrap, wide: true, onClose: p.close });
}

/**
 * Acciones del menú rápido del jugador. La interfaz del menú la diseña Codex: estas son las funciones
 * que cada botón debe llamar (una sola navegación, sin un segundo menú).
 */
export function installVivoActions(api) {
  api.actions = Object.freeze({
    avatar: () => api.ui.openPassport('avatar'),
    wardrobe: () => api.ui.openWardrobe(),
    inventory: () => openInventory(api),
    pets: tab => openPets(api, tab),
    home: () => api.goHome ? api.goHome() : api.travel('room', 'default'),
    mounts: () => (api.mounts ? api.mounts.open() : api.ui.toast('Las monturas se desbloquean con el Gran dragón de viaje.')),
    emotes: () => api.social?.toggle(true),
    map: () => api.ui.openMap(),
    missions: () => api.ui.openMissions(),
    games: () => api.games?.open(),
    shop: id => openShop(api, id),
    ball: () => { if (!api.pets.companion || api.pets.companion.ball) return api.ui.toast('Ahora no se puede lanzar la pelota.'); api.player.emote('throw', 0.8); setTimeout(() => { if (!api.pets.throwBall()) api.ui.toast('Ahora no se puede lanzar la pelota.'); }, 380); },
    /** Usar un juguete del inventario (balero, trompo, yoyo, papalote o burbujas). */
    useToy: id => { const it = itemById(id); if (!it || it.kind !== 'toy' || !api.vivo.owns(id)) return api.ui.toast('Ese juguete no está en tu inventario.'); api.player.emote(it.use, it.use === 'papalote' ? 8 : 5, it.color); }
  });
  document.getElementById('btn-pets')?.addEventListener('click', () => api.actions.pets());
  document.getElementById('btn-inventory')?.addEventListener('click', () => api.actions.inventory());
}
