// Presentation only: shortcuts call existing UI actions. No travel, inventory,
// purchase, progression or new expansion endpoint is implemented here.
import { mapDestinations } from './city-map.js';

const h = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const icon = name => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ic'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#ci-' + name); svg.append(use); return svg;
};

export function installQuickMenu(ui) {
  const api = ui.api, panel = document.getElementById('more-menu'), trigger = document.getElementById('btn-more');
  if (!panel || !trigger || panel.classList.contains('quick-menu')) return;
  panel.classList.add('quick-menu'); panel.setAttribute('aria-label', 'Accesos de Ciudad ICADEM');
  trigger.classList.add('quick-trigger'); trigger.setAttribute('aria-label', 'Accesos rápidos'); trigger.setAttribute('aria-controls', panel.id); trigger.title = 'Accesos rápidos';
  trigger.querySelector('span').textContent = 'Accesos';
  trigger.addEventListener('keydown', event => { if (event.key === 'Enter' || event.code === 'Space') event.stopPropagation(); });
  trigger.addEventListener('click', () => { if (!panel.hidden) api.social?.toggle(false); });
  const toolbar = trigger.closest('.toolbar'); toolbar?.classList.add('toolbar--quick');
  const head = h('div', 'quick-menu__heading'), grid = h('div', 'quick-menu__grid'), utility = h('div', 'quick-menu__utility');
  head.append(h('span', null, 'EXPLORA A TU RITMO'), h('strong', null, 'Tu ciudad, a un toque'));
  head.setAttribute('role', 'presentation'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Explorar y personalizar'); utility.setAttribute('role', 'group'); utility.setAttribute('aria-label', 'Tu cuenta y ajustes');
  let active = null;
  const prepare = (button, id, name, symbol, detail) => {
    button.className = 'quick-menu__item'; button.type = 'button'; button.dataset.quickAction = id; button.setAttribute('role', 'menuitem'); button.setAttribute('aria-label', name); button.title = name;
    const copy = h('span'); copy.append(h('strong', null, name)); if (detail) copy.append(h('small', null, detail)); button.replaceChildren(icon(symbol), copy);
    button.addEventListener('click', () => { active = id; }); return button;
  };
  const existing = (elementId, id, name, symbol, detail, target = grid) => { const button = document.getElementById(elementId); if (button) target.append(prepare(button, id, name, symbol, detail)); };
  const action = (id, name, symbol, detail, run) => { const button = prepare(h('button'), id, name, symbol, detail); button.addEventListener('click', run); grid.append(button); };
  existing('btn-wardrobe', 'avatar', 'Mi avatar', 'person', 'Personajes');
  action('wardrobe', 'Vestidor', 'shirt', 'Ropa y accesorios', () => ui.openWardrobe({ tab: 'ropa' }));
  action('home', 'Mi casa', 'home', 'Marcar la entrada', () => {
    if (api.sceneName === 'room') { ui.toast('Ya estás en tu casa.'); return; }
    const home = mapDestinations(api).find(item => item.id === 'casa'); if (!home) return;
    api.setWaypoint({ ...home.way, name: home.name }); ui.toast('Entrada de tu casa marcada en la plaza.');
  });
  existing('btn-map', 'map', 'Mapa', 'map', 'Destinos de la ciudad');
  existing('btn-games', 'games', 'Juegos', 'games', 'Explora los retos');
  action('emotes', 'Frases y gestos', 'hand', 'Exprésate en la ciudad', () => api.social?.toggle(true));
  existing('btn-pass', 'passport', 'Pasaporte', 'pass', 'Nivel y logros', utility);
  existing('btn-settings', 'settings', 'Ajustes', 'gear', null, utility);
  existing('btn-exit', 'exit', 'Salir al panel', 'exit', null, utility);
  panel.replaceChildren(head, grid, utility);
  document.getElementById('hud')?.classList.add('has-quick-menu');
  panel.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.code === 'Space') { event.stopPropagation(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...panel.querySelectorAll('button:not([hidden])')], index = buttons.indexOf(document.activeElement); if (index < 0) return;
    event.preventDefault(); event.stopPropagation();
    const step = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + step + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true }); buttons[next].scrollIntoView({ block: 'nearest' });
  });
  // Reflect an actual open modal, rather than leaving a shortcut permanently active.
  const modal = document.getElementById('modal');
  const reflect = () => { panel.querySelectorAll('[data-quick-action]').forEach(button => button.classList.toggle('is-active', !modal.hidden && button.dataset.quickAction === active)); if (modal.hidden) active = null; };
  const observer = new MutationObserver(reflect); if (modal) observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  return { destroy() { observer.disconnect(); } };
}
