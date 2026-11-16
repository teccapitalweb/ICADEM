// Ciudad ICADEM 2.0 · puesto de aguas frescas de la plaza (versión FUNCIONAL; Codex diseña la final).
//   Opción A · Prepara tu agua: vaso → agua → ingredientes → hielo → servir (el servidor revisa la receta).
//   Opción B · Pídesela a Don Chema: eliges sabor, pagas 5 monedas del juego y te la sirve.
import { FLAVORS, INGREDIENTS, DRINK_PRICE, flavorById } from '../economy/catalog.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const VENDOR = 'Don Chema';
const openStands = new WeakSet();

export async function openAguas(api) {
  if (api.ui.isBlocking || openStands.has(api)) return;
  openStands.add(api);
  try {
  const pending = api.vivo.pendingTransactions?.().find(p => p.op === 'drink');
  if (pending) return await recoverWater(api, pending);
  const pick = await api.ui.choice({ speaker: VENDOR, text: '¡Buenas! ¿Le sirvo una agua fresca o prefiere prepararla usted?', options: [
    { id: 'buy', label: 'Pedirle un agua a Don Chema', hint: `${DRINK_PRICE} monedas del juego`, primary: true },
    { id: 'self', label: 'Preparar mi propia agua', hint: 'Sigue la receta paso a paso' }, { id: 'x', label: 'Ahora no' }] });
  if (pick === 'x') return;
  if (!api.vivo.online) return api.ui.toast('El puesto necesita conexión con la ciudad.', 3000);
  const flavor = await api.ui.choice({ speaker: VENDOR, text: pick === 'buy' ? `Cada agua cuesta ${DRINK_PRICE} monedas. Tienes ${api.vivo.coins}. ¿De qué sabor?` : 'Elige tu sabor y sigue la receta, sin gastar monedas.', options: [...FLAVORS.map(f => ({ id: f.id, label: `${f.icon} ${f.name}`, hint: f.ingredients.map(id => INGREDIENTS[id]).join(' · ') })), { id: 'x', label: 'Cancelar' }] });
  if (flavor === 'x') return;
  const f = flavorById(flavor);
  if (!f) return;
  if (pick === 'buy') {
    if (api.vivo.coins < DRINK_PRICE) return api.ui.toast(`Te faltan ${DRINK_PRICE - api.vivo.coins} monedas para el agua.`, 3000);
    const ok = await api.ui.choice({ speaker: VENDOR, text: `Un agua de ${f.name.toLowerCase()} son ${DRINK_PRICE} monedas. ¿Se la sirvo?`, options: [{ id: 'si', label: 'Sí, por favor', primary: true }, { id: 'no', label: 'Mejor no' }] });
    if (ok !== 'si') return;
    api.ui.toast('Don Chema está preparando tu agua…', 1800);
    let r;
    do {
      try { r = await api.vivo.drink(f.id, 'buy'); } catch { r = { ok: false, message: 'No se pudo confirmar la compra. Revisa tu conexión y tu saldo.' }; }
      if (!r.ok) {
        const retry = await api.ui.choice({ speaker: VENDOR, text: r.message || 'No se pudo confirmar la compra de tu agua.', options: [{ id: 'retry', label: 'Reintentar confirmación', hint: 'Consulta la misma compra, sin iniciar otra' }, { id: 'x', label: 'Salir', primary: true }] });
        if (retry !== 'retry') return;
      }
    } while (!r.ok);
    api.ui.toast(`${VENDOR} te sirve un agua de ${f.name.toLowerCase()}. ¡Salud!`, 2800);
    api.events.emit('aguas-servida', f.id);
    return drink(api, f);
  }
  return await prepare(api, f);
  } finally { openStands.delete(api); }
}

function drink(api, f) { setTimeout(() => { api.player.emote('drink', 3, f.color); api.pets.react('saludo'); }, 250); }

/** Recuperación explícita de una operación original que perdió su confirmación. */
async function recoverWater(api, pending) {
  const f = flavorById(pending.payload.flavor), prepared = pending.payload.mode === 'self';
  let message = `Falta confirmar ${prepared ? 'tu preparación' : 'tu compra'} de agua${f ? ' de ' + f.name.toLowerCase() : ''}. Consulta la misma solicitud antes de pedir otra.`;
  while (true) {
    const pick = await api.ui.choice({ speaker: VENDOR, text: message, options: [{ id: 'retry', label: 'Recuperar confirmación', hint: 'La misma solicitud; sin repetir el cobro ni el premio', primary: true }, { id: 'x', label: 'Ahora no' }] });
    if (pick !== 'retry') return;
    if (!api.vivo.online) return api.ui.toast('Necesitas conexión para recuperar tu agua. La solicitud sigue pendiente.', 3200);
    let r; try { r = await api.vivo.retryTransaction(pending.key); } catch { r = { ok: false, message: 'No se pudo confirmar todavía. La solicitud sigue pendiente.' }; }
    if (!r.ok) { message = r.message || 'No se pudo confirmar todavía. Puedes consultar la misma solicitud otra vez.'; if (!api.vivo.pendingTransactions().some(p => p.key === pending.key)) return api.ui.toast(message, 3200); continue; }
    api.ui.toast(`Tu ${prepared ? 'preparación' : 'compra'} de agua quedó confirmada.` + (prepared && r.coins ? ` +${r.coins} monedas (una vez al día).` : ''), 3200);
    if (f) { if (!prepared) api.events.emit('aguas-servida', f.id); drink(api, f); }
    return r;
  }
}

/** Prepara tu agua: los botones se habilitan en orden; un ingrediente que no va se explica y no se agrega. */
function prepare(api, f) {
  const steps = [], need = new Set(f.ingredients), wrap = h('div', 'aguas'), glass = h('div', 'aguas__glass'), fill = h('i', 'aguas__fill'), log = h('ol', 'aguas__log'), hint = h('p', 'aguas__hint'), progress = h('div', 'aguas__progress');
  let done = false, pending = false, closed = false;
  hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite'); hint.setAttribute('aria-atomic', 'true');
  glass.setAttribute('aria-hidden', 'true'); log.setAttribute('aria-label', 'Pasos de tu preparación'); progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', 'Preparación del agua'); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', String(f.ingredients.length + 4));
  fill.style.setProperty('--c', '#' + f.color.toString(16).padStart(6, '0')); glass.append(fill);
  const extras = ['arroz', 'canela', 'flor-jamaica', 'limon', 'tamarindo', 'sandia', 'mango', 'azucar'].filter(x => !need.has(x)).sort(() => Math.random() - 0.5).slice(0, 3);
  const pantry = [...f.ingredients, ...extras].sort(() => Math.random() - 0.5);
  const buttons = h('div', 'aguas__steps');
  const stage = () => steps.length === 0 ? 'vaso' : steps.length === 1 ? 'agua' : [...need].every(x => steps.includes(x)) ? (steps.includes('hielo') ? 'servir' : 'hielo') : 'ingredientes';
  const say = (t, bad) => { hint.textContent = t; hint.classList.toggle('is-bad', Boolean(bad)); };
  const step = (id, label) => { steps.push(id); log.append(h('li', null, label)); fill.style.height = Math.min(92, steps.length / (f.ingredients.length + 4) * 100) + '%'; render(); };
  const add = (id, label) => {
    const want = stage();
    if (id === 'vaso' || id === 'agua' || id === 'hielo' || id === 'servir') { if (want !== id) return say(want === 'ingredientes' ? 'Antes faltan ingredientes.' : `Primero: ${{ vaso: 'toma un vaso', agua: 'agrega agua', hielo: 'agrega el hielo', servir: 'sirve el agua' }[want]}.`, true); return step(id, label); }
    if (want !== 'ingredientes') return say(want === 'vaso' ? 'Primero toma un vaso.' : want === 'agua' ? 'Primero agrega el agua.' : 'Los ingredientes ya están listos.', true);
    if (!need.has(id)) return say(`${INGREDIENTS[id]} no va en el agua de ${f.name.toLowerCase()}. ¡Intenta con otro!`, true);
    if (steps.includes(id)) return say('Eso ya lo agregaste.', true);
    step(id, INGREDIENTS[id]);
  };
  function render() {
    const focused = buttons.contains(document.activeElement) ? document.activeElement.dataset.ingredient : null;
    buttons.replaceChildren();
    const mk = (id, label, icon) => { const b = h('button', 'btn aguas__btn' + (steps.includes(id) ? ' is-done' : '')); b.type = 'button'; b.dataset.ingredient = id; const pictogram = h('span', null, steps.includes(id) ? '✓' : icon); pictogram.setAttribute('aria-hidden', 'true'); b.append(pictogram, h('small', null, label)); b.disabled = pending || steps.includes(id); b.setAttribute('aria-label', label + (steps.includes(id) ? ', listo' : '')); b.addEventListener('click', () => add(id, label)); buttons.append(b); };
    mk('vaso', 'Tomar un vaso', '🥛'); mk('agua', 'Agregar agua', '💧');
    for (const ing of pantry) mk(ing, INGREDIENTS[ing], '🧺');
    mk('hielo', 'Agregar hielo', '🧊'); mk('servir', 'Servir', '🍹');
    const st = stage(); say({ vaso: 'Paso 1: toma un vaso limpio.', agua: 'Paso 2: agrega agua purificada.', ingredientes: `Paso 3: agrega los ingredientes del agua de ${f.name.toLowerCase()}.`, hielo: 'Paso 4: unos hielos para que esté fresca.', servir: 'Último paso: ¡sirve tu agua!' }[st]);
    progress.style.setProperty('--progress', `${Math.min(100, steps.length / (f.ingredients.length + 4) * 100)}%`); progress.setAttribute('aria-valuenow', String(steps.length)); progress.setAttribute('aria-valuetext', `${steps.length} de ${f.ingredients.length + 4} pasos listos`);
    if (focused && steps.at(-1) !== 'servir') { const next = [...buttons.querySelectorAll('button')].find(b => !b.disabled && (st === 'ingredientes' ? need.has(b.dataset.ingredient) : b.dataset.ingredient === st)); next?.focus({ preventScroll: true }); }
    if (steps.at(-1) === 'servir') finish();
  }
  async function finish() {
    if (done || closed) return; done = true; pending = true; wrap.querySelector('.aguas__retry')?.remove(); wrap.setAttribute('aria-busy', 'true'); buttons.querySelectorAll('button').forEach(b => { b.disabled = true; }); say('Confirmando tu preparación con la ciudad…');
    let r; try { r = await api.vivo.drink(f.id, 'self', [...steps]); } catch { r = { ok: false, message: 'No se pudo confirmar tu preparación. Revisa tu conexión antes de intentarlo otra vez.' }; }
    pending = false; wrap.setAttribute('aria-busy', 'false');
    if (closed || !wrap.isConnected) return;
    if (!r.ok) { done = false; say(r.message || 'No se pudo registrar tu agua. Tu receta permanece aquí.', true); const retry = h('button', 'btn aguas__retry', 'Reintentar confirmación'); retry.type = 'button'; retry.addEventListener('click', finish); wrap.append(retry); return; }
    // Cierra únicamente este diálogo: una respuesta tardía nunca debe cerrar otra pantalla.
    wrap.closest('#modal')?.querySelector('#modal-x')?.click();
    api.ui.toast(`¡Preparaste un agua de ${f.name.toLowerCase()}!` + (r.coins ? ` +${r.coins} monedas (una vez al día).` : ' Sin desperdiciar nada.'), 3200);
    drink(api, f);
  }
  wrap.append(glass, h('div', 'aguas__side', null), progress, buttons, hint);
  wrap.querySelector('.aguas__side').append(h('small', 'aguas__eyebrow', 'Tu receta · sin costo'), h('strong', null, `${f.icon} ${f.name}`), h('p', 'aguas__recipe', f.ingredients.map(id => INGREDIENTS[id]).join(' · ')), log);
  render();
  return api.ui.modal({ eyebrow: 'Aguas frescas', title: 'Prepara tu agua', content: wrap, wide: true, actions: [{ id: 'x', label: 'Salir' }], onClose: () => { closed = true; } });
}
