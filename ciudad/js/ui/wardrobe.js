// Ciudad ICADEM · Vestidor: personajes iniciales, profesiones y skins especiales, con vista previa 3D,
// requisitos reales de desbloqueo (los mismos que comprueba el servidor) y estilo (atuendo, sombrero
// y tono de piel). También es la selección de personaje de la primera vez (`first: true`).
import { AVATARS, AVATAR_CATEGORIES, avatarById } from '../characters/catalog.js';
import { AVATAR_UNLOCKS, OUTFIT_COLORS, HAT_OPTIONS, SKIN_TONES, isAvatarUnlocked, applyCustom, unlockProgress } from '../progress/rules.js';
import { AvatarPreview } from './preview.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };

/**
 * `first: true` → selección inicial (solo personajes gratuitos y botón «Comenzar»).
 * Los cambios se guardan con api.setAvatar: con conexión los autoriza y guarda el servidor.
 */
export function openWardrobe(ui, { first = false } = {}) {
  if (ui.isBlocking) return Promise.resolve('blocked');
  const api = ui.api, st = api.store.state, hex = n => '#' + n.toString(16).padStart(6, '0');
  const wrap = h('div', 'vest' + (first ? ' is-first' : '')), stage = h('div', 'vest__stage'), panel = h('div', 'vest__panel');
  let preview = null, thumbs = null;
  try { preview = new AvatarPreview(api.engine.renderer, { width: 260, height: 330 }); thumbs = new AvatarPreview(api.engine.renderer, { width: 150, height: 190 }); } catch (_) { preview = thumbs = null; }
  let viewing = first ? (AVATARS.find(a => a.id === st.avatarId && a.category === 'inicial') || AVATARS[0]).id : st.avatarId;
  let cat = first ? 'inicial' : (avatarById(viewing).category || 'inicial'), tab = 'personajes';
  const lookOf = id => applyCustom(avatarById(id).look, st.custom);
  const shots = new Map();

  /* escenario: personaje en 3D + estado */
  const tag = h('span', 'vest__tag'), name = h('strong', 'vest__name'), status = h('div', 'vest__status');
  const paintStage = () => {
    const a = avatarById(viewing), open = isAvatarUnlocked(a.id, st), on = a.id === st.avatarId && !first;
    if (preview) preview.show(lookOf(a.id));
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
  if (preview) { stage.append(preview.canvas); preview.start(); } else stage.classList.add('is-off');
  const info = h('div', 'vest__info'); info.append(tag, name, status); stage.append(info, h('small', 'vest__tip', 'Arrastra para girar'));

  /* tarjetas */
  const cards = h('div', 'vest__cards'), cats = h('div', 'vest__cats');
  const shot = id => { if (!thumbs) return null; const key = id + JSON.stringify(st.custom); if (!shots.has(key)) shots.set(key, thumbs.still(lookOf(id))); return shots.get(key); };
  const paintCards = () => {
    cats.replaceChildren(); cards.replaceChildren();
    for (const c of AVATAR_CATEGORIES) {
      if (first && c.id !== 'inicial') continue;
      const list = AVATARS.filter(a => a.category === c.id), got = list.filter(a => isAvatarUnlocked(a.id, st)).length;
      const b = h('button', c.id === cat ? 'is-on' : '', null); b.type = 'button'; b.append(h('span', null, c.name), h('small', null, `${got}/${list.length}`));
      b.addEventListener('click', () => { cat = c.id; paintCards(); }); cats.append(b);
    }
    const list = AVATARS.filter(a => a.category === cat), queue = [];
    for (const a of list) {
      const open = isAvatarUnlocked(a.id, st), card = h('button', 'vcard' + (open ? '' : ' is-locked') + (a.id === viewing ? ' is-view' : '') + (a.id === st.avatarId && !first ? ' is-worn' : ''));
      card.type = 'button'; card.dataset.id = a.id; card.setAttribute('aria-label', `${a.name}${open ? '' : ' (bloqueado: ' + AVATAR_UNLOCKS[a.id].text + ')'}`);
      const pic = h('span', 'vcard__pic'); pic.style.setProperty('--c', hex(a.look.top)); const img = h('img'); img.alt = ''; pic.append(img);
      if (!open) pic.append(h('span', 'vcard__lock', '🔒'));
      if (a.id === st.avatarId && !first) pic.append(h('span', 'vcard__worn', '✓'));
      card.append(pic, h('strong', null, a.name), h('small', null, open ? a.route : AVATAR_UNLOCKS[a.id].text));
      card.addEventListener('click', () => { viewing = a.id; paintStage(); cards.querySelectorAll('.vcard').forEach(x => x.classList.toggle('is-view', x === card)); });
      cards.append(card); queue.push([a.id, img]);
    }
    // miniaturas 3D poco a poco, sin trabar la animación
    const next = () => { const job = queue.shift(); if (!job || !wrap.isConnected) return; const url = shot(job[0]); if (url) job[1].src = url; requestAnimationFrame(next); };
    requestAnimationFrame(next);
  };

  /* estilo: atuendo, sombrero y tono (todo gratuito) */
  const style = h('div', 'vest__style');
  const paintStyle = () => {
    style.replaceChildren();
    const group = (label, key, options, swatch) => {
      const f = h('div', 'field'), row = h('div', 'chips' + (swatch ? ' chips--swatch' : '')); f.append(h('span', null, label), row);
      options.forEach(o => {
        const b = h('button', st.custom[key] === o.id ? 'is-on' : '', swatch ? '' : o.name); b.type = 'button'; b.dataset[key] = o.id; b.title = o.name; b.setAttribute('aria-label', `${label}: ${o.name}`);
        if (o.color !== null && o.color !== undefined) b.style.setProperty('--dot', hex(o.color)); else if (swatch) b.classList.add('is-base');
        b.addEventListener('click', () => { const c = { ...st.custom, [key]: o.id }; if (first) { st.custom = c; paintStyle(); paintStage(); } else if (api.setAvatar(st.avatarId, c)) { viewing = st.avatarId; paintStyle(); paintStage(); } });
        row.append(b);
      });
      return f;
    };
    style.append(group('Tono de piel', 'tone', SKIN_TONES, true), group('Color del atuendo', 'outfit', OUTFIT_COLORS, true), group('Sombrero', 'hat', HAT_OPTIONS),
      h('p', 'note', first ? 'Todo es gratuito y lo puedes cambiar después.' : 'Se aplica a tu personaje actual y se guarda en tu cuenta.'));
  };

  const tabs = h('div', 'tabs vest__tabs'), body = h('div', 'vest__body');
  const show = id => { tab = id; tabs.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.id === id)); body.replaceChildren(); if (id === 'personajes') { body.append(cats, cards); paintCards(); } else { body.append(style); paintStyle(); } };
  [['personajes', first ? 'Personajes' : 'Personajes y skins'], ['estilo', 'Estilo']].forEach(([id, t]) => { const b = h('button', null, t); b.type = 'button'; b.dataset.id = id; b.addEventListener('click', () => show(id)); tabs.append(b); });
  const owned = AVATARS.filter(a => isAvatarUnlocked(a.id, st)).length;
  panel.append(tabs, body);
  if (!first) panel.append(h('p', 'note', `Tienes ${owned} de ${AVATARS.length} personajes. Se consiguen jugando; todos son cosméticos y ninguno da ventaja ni se compra.`));
  wrap.append(stage, panel); paintStage(); show('personajes');

  const stop = () => { preview && preview.stop(); thumbs && thumbs.stop(); };
  if (first) {
    return ui.modal({ eyebrow: 'Bienvenida a Ciudad ICADEM', title: 'Elige tu personaje', content: wrap, wide: true, onClose: stop,
      actions: [{ id: 'ok', label: 'Comenzar con este personaje', primary: true }] })
      .then(id => { api.setAvatar(viewing, st.custom); return id; });
  }
  return ui.modal({ eyebrow: 'Vestidor', title: 'Mi avatar', content: wrap, wide: true, onClose: stop });
}
