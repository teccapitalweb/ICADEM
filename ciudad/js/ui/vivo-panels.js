// Ciudad ICADEM 2.0 · paneles FUNCIONALES de Mundo vivo (mascotas, inventario, tiendas).
//
// Son la versión operativa mientras Codex diseña las interfaces definitivas: usan solo api.vivo y
// api.pets (el contrato de ciudad/MUNDO_VIVO.md), así que reemplazarlos no toca ninguna regla.
import { BREEDS, SPECIES, PET_SLOTS, WALK_SCENES, PET_SCENES, breedById } from '../pets/pet-catalog.js';
import { ITEMS, SHOPS, itemById } from '../economy/catalog.js';
import { PetPreview } from '../pets/pet-preview.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const btn = (label, cls, fn) => { const b = h('button', 'btn ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; };
const closeModal = () => document.getElementById('modal-x')?.click();

function needOnline(api) {
  if (api.vivo.online) return false;
  api.ui.toast('Mundo vivo necesita conexión con la ciudad (tu progreso se guarda en tu cuenta).', 3600);
  return true;
}

/* ================= Mis mascotas ================= */
export function openPets(api, tab = 'mis') {
  if (api.ui.isBlocking || needOnline(api)) return Promise.resolve('blocked');
  const wrap = h('div', 'vp vp--pets'), stage = h('div', 'vp__stage'), body = h('div', 'vp__body'), tabs = h('div', 'tabs');
  let preview = null; try { preview = new PetPreview(api.engine.renderer); stage.append(preview.canvas); preview.start(); } catch (_) { preview = null; }
  const caption = h('p', 'vp__caption'); stage.append(caption);
  let selected = api.vivo.activePet ? api.vivo.activePet.id : (api.vivo.state.pets[0] || {}).id, species = 'perro', viewing = null;
  const show = (breed, acc, text) => { viewing = breed; if (preview) preview.show(breed, acc); caption.textContent = text || ''; };
  const say = (r, ok) => { if (r && r.ok === false && r.message) api.ui.toast(r.message, 3200); else if (ok) api.ui.toast(ok, 2600); };

  const views = {
    mis() {
      const s = api.vivo.state;
      if (!s.pets.length) { body.append(h('p', 'note', 'Todavía no tienes mascotas. Elige una gratis en «Adoptar».'), btn('Ver mascotas para adoptar', 'btn--primary', () => go('adoptar'))); return; }
      const list = h('div', 'vp__list');
      for (const p of s.pets) {
        const b = breedById(p.breed), row = h('button', 'rowi vp__pet' + (p.id === selected ? ' is-on' : '')); row.type = 'button';
        row.append(h('span', 'rowi__icon', SPECIES[b.species].icon), (() => { const c = h('div', 'rowi__copy'); c.append(h('strong', null, p.name), h('span', null, b.name)); return c; })());
        if (p.id === s.activePet) row.append(h('span', 'pill pill--ok', api.vivo.leash ? 'De paseo' : 'Te acompaña'));
        row.addEventListener('click', () => { selected = p.id; render(); });
        list.append(row);
      }
      body.append(list);
      const pet = s.pets.find(p => p.id === selected) || s.pets[0]; selected = pet.id;
      const b = breedById(pet.breed); show(pet.breed, pet.acc, `${pet.name} · ${b.name}`);
      const actions = h('div', 'vp__actions'), active = pet.id === s.activePet, here = api.sceneName;
      actions.append(active ? btn('Que se quede en casa', '', async () => { say(await api.vivo.rest(), 'Tu mascota se quedó en casa.'); render(); })
        : btn('Que me acompañe', 'btn--primary', async () => { say(await api.vivo.setPet(pet.id, { active: true }), `${pet.name} te acompaña.`); render(); }));
      if (active && b.species === 'perro') actions.append(btn(api.vivo.leash ? 'Quitar la correa' : 'Salir a pasear con correa', '', async () => {
        if (!api.vivo.leash && !WALK_SCENES.includes(here)) return api.ui.toast('Sal a la plaza, al parque o al Distrito para pasear con correa.', 3200);
        const r = await api.vivo.walk(!api.vivo.leash); say(r, r.ok ? (r.leash ? '¡A pasear! La correa se ve para los demás jugadores.' : 'Le quitaste la correa.') : null); render();
      }));
      if (active && PET_SCENES.includes(here)) {
        actions.append(btn('Acariciar', '', () => { closeModal(); setTimeout(() => { api.player.emote('petting', 2.2); api.pets.react('cariño'); }, 150); }));
        if (b.species === 'perro' || b.form === 'fox' || b.form === 'wolf' || b.form === 'lion') actions.append(btn('Lanzar la pelota', '', () => { closeModal(); setTimeout(() => api.actions.ball(), 200); }));
      }
      body.append(actions);
      // comida
      const food = h('div', 'vp__block'); food.append(h('h4', null, 'Darle de comer'));
      const treats = ITEMS.filter(i => i.kind === 'treat' && i.species.includes(b.species));
      const feed = async id => { const r = await api.vivo.feed(pet.id, id); if (r.ok) { if (active) { closeModal(); setTimeout(() => { api.player.emote('petting', 1.4); api.pets.react('food'); }, 150); } api.ui.toast(r.treat ? `¡A ${pet.name} le encantó!` : `${pet.name} comió sus croquetas.` + (r.coins ? ` +${r.coins} monedas por cuidarle hoy.` : ''), 3000); } else say(r); render(); };
      food.append(btn('Croquetas (gratis)', '', () => feed('croquetas')));
      for (const t of treats) food.append(btn(`${t.icon} ${t.name} · tienes ${s.inv[t.id] || 0}`, '', () => (s.inv[t.id] ? feed(t.id) : api.ui.toast('Cómpralo en la tienda de mascotas.'))));
      body.append(food);
      // accesorios
      const accBox = h('div', 'vp__block'); accBox.append(h('h4', null, 'Accesorios'));
      const owned = api.vivo.accessoriesFor(pet.id);
      for (const [slot, items] of Object.entries(owned)) {
        const row = h('div', 'vp__slot'); row.append(h('span', 'vp__slotname', PET_SLOTS[slot].name));
        const none = h('button', 'vp__chip' + (!pet.acc[slot] ? ' is-on' : ''), 'Ninguno'); none.type = 'button'; none.addEventListener('click', async () => { say(await api.vivo.setPet(pet.id, { acc: { [slot]: null } })); render(); }); row.append(none);
        for (const it of items) { const c = h('button', 'vp__chip' + (pet.acc[slot] === it.id ? ' is-on' : ''), it.name); c.type = 'button'; c.addEventListener('click', async () => { say(await api.vivo.setPet(pet.id, { acc: { [slot]: it.id } })); render(); }); c.addEventListener('pointerenter', () => show(pet.breed, { ...pet.acc, [slot]: it.id }, `${pet.name} con ${it.name.toLowerCase()}`)); row.append(c); }
        if (!items.length) row.append(h('small', 'note', 'Consíguelos en la tienda de mascotas.'));
        accBox.append(row);
      }
      body.append(accBox);
      // nombre
      const nameBox = h('div', 'vp__block vp__rename'), input = h('input'); input.maxLength = 16; input.value = pet.name; input.setAttribute('aria-label', 'Nombre de la mascota');
      nameBox.append(h('h4', null, 'Nombre'), input, btn('Cambiar nombre', '', async () => { say(await api.vivo.setPet(pet.id, { name: input.value }), 'Nombre guardado.'); render(); }));
      body.append(nameBox, h('p', 'note', 'Tus mascotas no enferman ni se pierden si no entras al juego. Los demás jugadores ven a tu mascota, pero no su nombre.'));
    },
    adoptar() {
      const st = h('div', 'chips'); for (const [id, sp] of Object.entries(SPECIES)) { const c = h('button', 'vp__chip' + (id === species ? ' is-on' : ''), sp.icon + ' ' + sp.name); c.type = 'button'; c.addEventListener('click', () => { species = id; viewing = null; render(); }); st.append(c); }
      body.append(st);
      const list = h('div', 'vp__grid'), all = api.vivo.catalog().filter(b => b.species === species);
      if (!viewing || !all.some(b => b.id === viewing)) viewing = (all.find(b => b.free && !b.adopted) || all[0]).id;
      for (const b of all) {
        const card = h('button', 'vp__card' + (b.id === viewing ? ' is-on' : '') + (b.adopted ? ' is-adopted' : '')); card.type = 'button';
        card.append(h('b', null, b.name), h('small', null, b.adopted ? 'Ya es tuya' : b.free ? 'Gratis' : b.requirement.met ? (b.cost ? `${b.cost} monedas` : 'Desbloqueada') : b.requirement.text));
        if (!b.free && !b.adopted && !b.requirement.met) { const [n, m] = b.requirement.progress, bar = h('i', 'vp__bar'); bar.style.setProperty('--p', Math.round(100 * n / Math.max(1, m)) + '%'); card.append(bar); }
        card.addEventListener('click', () => { viewing = b.id; render(); });
        list.append(card);
      }
      const b = all.find(x => x.id === viewing); show(b.id, {}, `${b.name} · ${b.personality}`);
      const box = h('div', 'vp__block');
      if (b.adopted) box.append(h('p', 'note', 'Esta mascota ya está en tu colección.'));
      else if (!b.available) box.append(h('p', 'note', 'Para adoptarla: ' + b.requirement.text + '.'));
      else {
        const input = h('input'); input.maxLength = 16; input.placeholder = 'Ponle un nombre'; input.setAttribute('aria-label', 'Nombre de la nueva mascota');
        const cost = b.cost ? ` por ${b.cost} monedas` : '';
        box.append(input, btn('Adoptar' + cost, 'btn--primary', async () => {
          if (b.cost && api.vivo.coins < b.cost) return api.ui.toast(`Te faltan ${b.cost - api.vivo.coins} monedas.`);
          const r = await api.vivo.adopt(b.id, input.value || b.name.split(' ')[0]);
          if (r.ok) { selected = r.pet.id; api.ui.toast(`¡${r.pet.name} llegó a tu colección!`, 3000); go('mis'); } else say(r);
        }));
      }
      body.append(list, box, h('p', 'note', 'Las mascotas son del juego: se obtienen gratis, con actividades o con monedas de Ciudad ICADEM, nunca con dinero real. Los animales silvestres aparecen solo como compañeros fantásticos.'));
    }
  };
  const go = id => { tab = id; render(); };
  function render() {
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.id === tab));
    body.replaceChildren(); views[tab]();
  }
  [['mis', 'Mis mascotas'], ['adoptar', 'Adoptar']].forEach(([id, t]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.id = id; b.addEventListener('click', () => go(id)); tabs.append(b); });
  const right = h('div', 'vp__panel'); right.append(tabs, body); wrap.append(stage, right);
  const off = api.vivo.on('change', () => { if (wrap.isConnected) render(); });
  render();
  return api.ui.modal({ eyebrow: 'Mundo vivo', title: 'Mis mascotas', content: wrap, wide: true, onClose: () => { off(); preview?.stop(); } });
}

/* ================= Inventario ================= */
export function openInventory(api) {
  if (api.ui.isBlocking || needOnline(api)) return Promise.resolve('blocked');
  const s = api.vivo.state, wrap = h('div', 'vp vp--inv'), groups = { petAcc: 'Accesorios de mascota', petToy: 'Juguetes de mascota', treat: 'Premios de mascota', furniture: 'Muebles de tu casa', toy: 'Juguetes', wear: 'Ropa' };
  const head = h('div', 'pass__credits'); head.append(h('span', null, 'Monedas de Ciudad ICADEM'), h('b', null, String(s.coins))); wrap.append(head);
  for (const [kind, title] of Object.entries(groups)) {
    const items = ITEMS.filter(i => i.kind === kind && s.inv[i.id]); if (!items.length) continue;
    const box = h('div', 'vp__block'); box.append(h('h4', null, title));
    const rows = h('div', 'rows'); for (const i of items) {
      const r = h('div', 'rowi'); r.append(h('span', 'rowi__icon', i.icon || '•'), (() => { const c = h('div', 'rowi__copy'); c.append(h('strong', null, i.name), h('span', null, SHOPS[i.shop].name)); return c; })());
      if (i.kind === 'toy') r.append(btn('Usar', 'btn--primary', () => { closeModal(); setTimeout(() => api.actions.useToy(i.id), 150); }));
      else if (i.kind === 'wear') { const st = api.store.state, on = st.custom[i.slot] === i.option; r.append(on ? h('span', 'pill pill--ok', 'Puesta') : btn('Ponérmela', 'btn--primary', () => { if (api.setAvatar(st.avatarId, { ...st.custom, [i.slot]: i.option })) { api.ui.toast(i.name + ': lista.'); closeModal(); } })); }
      else r.append(h('span', 'pill', '× ' + s.inv[i.id]));
      rows.append(r);
    }
    box.append(rows); wrap.append(box);
  }
  wrap.append(h('p', 'note', 'Los artículos son del juego y no se pueden vender ni intercambiar con otros jugadores.'));
  return api.ui.modal({ eyebrow: 'Mundo vivo', title: 'Mi inventario', content: wrap, wide: true });
}

/* ================= Tienda ================= */
export function openShop(api, shopId, { greeting } = {}) {
  if (api.ui.isBlocking || needOnline(api)) return Promise.resolve('blocked');
  const shop = SHOPS[shopId]; if (!shop) return Promise.resolve('x');
  const wrap = h('div', 'vp vp--shop'), list = h('div', 'vp__grid'), coins = h('b');
  const head = h('div', 'pass__credits'); head.append(h('span', null, 'Tus monedas'), coins);
  wrap.append(...(greeting ? [h('p', 'vp__greeting', greeting)] : []), head, list, h('p', 'note', 'Se paga con monedas de Ciudad ICADEM (del juego). No hay compras con dinero real.'));
  const render = () => {
    coins.textContent = String(api.vivo.coins); list.replaceChildren();
    for (const it of api.vivo.shop(shopId)) {
      const card = h('div', 'vp__card vp__product'); card.append(h('span', 'vp__icon', it.icon || '•'), h('b', null, it.name), h('small', null, it.price + ' monedas'));
      const owned = it.unique && it.owned, st = api.store.state;
      if (owned && it.kind === 'wear') card.append(st.custom[it.slot] === it.option ? h('span', 'pill pill--ok', 'Puesta') : btn('Ponérmela', 'btn--primary', () => { if (api.setAvatar(st.avatarId, { ...st.custom, [it.slot]: it.option })) { api.ui.toast(it.name + ': lista.'); render(); } }));
      else card.append(owned ? h('span', 'pill pill--ok', 'Ya lo tienes') : btn(it.affordable ? 'Comprar' : 'Faltan ' + (it.price - api.vivo.coins), it.affordable ? 'btn--primary' : '', async () => {
        if (!it.affordable) return;
        const r = await api.vivo.buy(it.id, 1);
        if (r.ok) api.ui.toast(r.duplicate ? 'Esa compra ya estaba registrada.' : `Compraste ${it.name}. Está en tu inventario.`, 2800); else if (r.message) api.ui.toast(r.message, 3200);
        render();
      }));
      if (it.stack && it.owned) card.append(h('small', 'note', 'Tienes ' + it.owned));
      list.append(card);
    }
  };
  render();
  const off = api.vivo.on('change', () => { if (wrap.isConnected) render(); });
  return api.ui.modal({ eyebrow: shop.icon + ' Tienda', title: shop.name, content: wrap, wide: true, onClose: off });
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
