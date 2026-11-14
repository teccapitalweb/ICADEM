// Ciudad ICADEM 2.0 · puesto de aguas frescas de la plaza (versión FUNCIONAL; Codex diseña la final).
//   Opción A · Prepara tu agua: vaso → agua → ingredientes → hielo → servir (el servidor revisa la receta).
//   Opción B · Pídesela a Don Chema: eliges sabor, pagas 5 monedas del juego y te la sirve.
import { FLAVORS, INGREDIENTS, DRINK_PRICE, flavorById } from '../economy/catalog.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const VENDOR = 'Don Chema';

export async function openAguas(api) {
  if (api.ui.isBlocking) return;
  const pick = await api.ui.choice({ speaker: VENDOR, text: '¡Buenas! ¿Le sirvo una agua fresca o prefiere prepararla usted?', options: [
    { id: 'buy', label: 'Pedirle un agua a Don Chema', hint: `${DRINK_PRICE} monedas del juego`, primary: true },
    { id: 'self', label: 'Preparar mi propia agua', hint: 'Sigue la receta paso a paso' }, { id: 'x', label: 'Ahora no' }] });
  if (pick === 'x') return;
  if (!api.vivo.online) return api.ui.toast('El puesto necesita conexión con la ciudad.', 3000);
  const flavor = await api.ui.choice({ speaker: VENDOR, text: pick === 'buy' ? 'Este es el menú de hoy. ¿De qué sabor?' : '¿Qué agua vas a preparar?', options: [...FLAVORS.map(f => ({ id: f.id, label: `${f.icon} ${f.name}` })), { id: 'x', label: 'Cancelar' }] });
  if (flavor === 'x') return;
  const f = flavorById(flavor);
  if (pick === 'buy') {
    if (api.vivo.coins < DRINK_PRICE) return api.ui.toast(`Te faltan ${DRINK_PRICE - api.vivo.coins} monedas para el agua.`, 3000);
    const ok = await api.ui.choice({ speaker: VENDOR, text: `Un agua de ${f.name.toLowerCase()} son ${DRINK_PRICE} monedas. ¿Se la sirvo?`, options: [{ id: 'si', label: 'Sí, por favor', primary: true }, { id: 'no', label: 'Mejor no' }] });
    if (ok !== 'si') return;
    const r = await api.vivo.drink(f.id, 'buy');
    if (!r.ok) return api.ui.toast(r.message || 'No se pudo comprar el agua.', 3000);
    api.ui.toast(`${VENDOR} te sirve un agua de ${f.name.toLowerCase()}. ¡Salud!`, 2800);
    api.events.emit('aguas-servida', f.id);
    return drink(api, f);
  }
  return prepare(api, f);
}

function drink(api, f) { setTimeout(() => { api.player.emote('drink', 3, f.color); api.pets.react('saludo'); }, 250); }

/** Prepara tu agua: los botones se habilitan en orden; un ingrediente que no va se explica y no se agrega. */
function prepare(api, f) {
  const steps = [], need = new Set(f.ingredients), wrap = h('div', 'aguas'), glass = h('div', 'aguas__glass'), fill = h('i', 'aguas__fill'), log = h('ol', 'aguas__log'), hint = h('p', 'aguas__hint');
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
    buttons.replaceChildren();
    const mk = (id, label, icon) => { const b = h('button', 'btn aguas__btn' + (steps.includes(id) ? ' is-done' : '')); b.type = 'button'; b.append(h('span', null, icon), h('small', null, label)); b.disabled = steps.includes(id); b.addEventListener('click', () => add(id, label)); buttons.append(b); };
    mk('vaso', 'Tomar un vaso', '🥛'); mk('agua', 'Agregar agua', '💧');
    for (const ing of pantry) mk(ing, INGREDIENTS[ing], '🧺');
    mk('hielo', 'Agregar hielo', '🧊'); mk('servir', 'Servir', '🍹');
    const st = stage(); say({ vaso: 'Paso 1: toma un vaso limpio.', agua: 'Paso 2: agrega agua purificada.', ingredientes: `Paso 3: agrega los ingredientes del agua de ${f.name.toLowerCase()}.`, hielo: 'Paso 4: unos hielos para que esté fresca.', servir: 'Último paso: ¡sirve tu agua!' }[st]);
    if (steps.at(-1) === 'servir') finish();
  }
  let done = false;
  async function finish() {
    if (done) return; done = true;
    const r = await api.vivo.drink(f.id, 'self', steps);
    document.getElementById('modal-x')?.click();
    if (!r.ok) return api.ui.toast(r.message || 'No se pudo registrar tu agua.', 3000);
    api.ui.toast(`¡Preparaste un agua de ${f.name.toLowerCase()}!` + (r.coins ? ` +${r.coins} monedas (una vez al día).` : ' Sin desperdiciar nada.'), 3200);
    drink(api, f);
  }
  wrap.append(glass, h('div', 'aguas__side', null), buttons, hint);
  wrap.querySelector('.aguas__side').append(h('strong', null, `Agua de ${f.name.toLowerCase()}`), log);
  render();
  return api.ui.modal({ eyebrow: 'Aguas frescas', title: 'Prepara tu agua', content: wrap, wide: true, actions: [{ id: 'x', label: 'Salir' }] });
}
