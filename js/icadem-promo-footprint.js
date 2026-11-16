/* Preserve the pre-redesign Inicio/Perfil footprint at its real responsive size.
 * This helper has no program authority: no API, storage, code, UID or money write.
 * The legacy public composition is measured synchronously, never painted, then
 * the same modern child nodes/focus/scroll are restored before the browser paints.
 */
(() => {
  'use strict';
  const states = new WeakMap(), live = new Set(), MAX_CACHE = 24;
  const fields = ['enabled', 'commissionCents', 'discountCents', 'minimumPaidCents', 'minimumWithdrawalCents', 'validationDays', 'attributionDays', 'directCommissionVipCents', 'directCommissionFreeCents', 'monthlyDiscountVipCents', 'annualDiscountVipCents', 'monthlyDiscountFreeCents', 'annualDiscountFreeCents'];
  let fontRevision = 0, viewportWidth = window.innerWidth;
  const money = cents => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(cents / 100);
  const icon = name => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  // Only fields already shown publicly in the invitation participate in sizing.
  function publicData(data) {
    const config = data?.config ? Object.fromEntries(fields.map(key => [key, data.config[key]])) : null;
    if (config) config.eligiblePlans = Array.isArray(data.config.eligiblePlans) ? data.config.eligiblePlans.filter(plan => plan === 'mensual' || plan === 'anual') : [];
    return { registered: data?.registered === true, category: data?.category === 'vip' ? 'vip' : 'free', active: Boolean(data?.ambassador?.active), config };
  }
  function validConfig(c) {
    return !!c && c.enabled === true && ['commissionCents', 'discountCents', 'minimumPaidCents', 'minimumWithdrawalCents', 'validationDays', 'attributionDays'].every(key => Number.isInteger(c[key]) && c[key] > 0) && c.eligiblePlans.length > 0;
  }
  const reward = (c, category) => category === 'vip' ? c.directCommissionVipCents : c.directCommissionFreeCents;
  function legacyBenefits(c, category) {
    const monthly = category === 'vip' ? c.monthlyDiscountVipCents : c.monthlyDiscountFreeCents, annual = category === 'vip' ? c.annualDiscountVipCents : c.annualDiscountFreeCents;
    return `<div class="amb-promo-offer"><div class="amb-promo-offer-top"><span>UNA INVITACIÓN · DOS BENEFICIOS</span>${icon('arrow-right')}</div><div class="amb-promo-benefits"><div class="amb-promo-benefit amb-promo-benefit--reward"><span>Tu recompensa</span><strong>${money(reward(c, category))}<small>MXN</small></strong><p>por una primera compra elegible</p><span class="amb-promo-coin" aria-hidden="true"><span>${icon('gift')}</span></span></div><div class="amb-promo-benefit amb-promo-benefit--guest"><span class="amb-promo-guest-icon" aria-hidden="true">${icon('users')}</span><div><span>Para tu invitado</span><strong>${money(monthly)} / ${money(annual)}<small>MXN de descuento</small></strong><p>mensual / anual · solo primer pago</p></div></div></div><span class="amb-promo-offer-seal">Aprender nos lleva más lejos.</span></div>`;
  }
  function legacyCard(data, place) {
    const registered = data.registered, active = registered && data.active, paused = registered && !active, c = validConfig(data.config) ? data.config : null;
    if (place === 'profile') {
      const amount = c ? reward(c, data.category) : null, commission = Number.isSafeInteger(amount) && amount > 0 ? amount : null;
      const title = paused ? 'Tu perfil de embajador está en pausa.' : 'Convierte tus recomendaciones en ingresos.';
      const description = paused ? 'Entra a tu panel para consultar su estado.' : commission !== null ? `Gana <strong>${money(commission)} MXN</strong> por cada compra elegible realizada con tu código.` : 'Conoce el programa y consulta las condiciones de tu invitación.';
      const share = '<svg class="ic amb-promo-share-icon" viewBox="0 0 24 24" aria-hidden="true"></svg>', panel = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"></svg>';
      const primary = active ? `<button type="button" class="amb-promo-primary">${share}<span>Ver mi código y compartir</span><span class="amb-promo-button-arrow">${icon('arrow-right')}</span><span class="amb-promo-button-spinner" aria-hidden="true"></span></button>` : registered ? '' : `<button type="button" class="amb-promo-primary"><span>Activar mi espacio de embajador</span>${icon('arrow-right')}</button>`;
      const secondary = registered ? `<button type="button" class="amb-promo-secondary">${panel}<span>Ir a mi panel</span></button>` : '<button type="button" class="amb-promo-secondary">Cómo funciona</button>';
      const ticket = !paused && commission !== null ? `<strong>${money(commission)} <small>MXN</small></strong><span>por compra elegible</span>` : '<strong class="amb-promo-commission-neutral">Tu espacio<br>de embajador</strong>';
      // An empty vector with the original viewBox has exactly the same CSS box;
      // the decorative paths are unnecessary in a never-painted measurement.
      return `<div class="amb-promo-profile-layout"><div class="amb-promo-copy amb-promo-profile-copy"><span class="amb-promo-eyebrow">${icon('crown')} ${data.category === 'vip' ? 'EMBAJADOR VIP' : 'EMBAJADOR ICADEM'}</span><h2>${title}</h2><p>${description}</p><div class="amb-promo-actions">${primary}${secondary}</div></div><div class="amb-promo-profile-art${paused ? ' is-paused' : ''}" aria-hidden="true"><svg class="amb-promo-megaphone" viewBox="0 0 210 200" aria-hidden="true"></svg><div class="amb-promo-commission-card">${ticket}</div></div></div>`;
    }
    const title = registered ? (active ? 'Tus recomendaciones ya tienen su espacio.' : 'Consulta tu perfil de embajador.') : c ? `Recomienda ICADEM.<em> Gana ${money(reward(c, data.category))} MXN.</em>` : 'Tu recomendación abre <em>nuevas puertas.</em>';
    return `<div class="amb-promo-copy"><span class="amb-promo-eyebrow">${icon('users')} ICADEM EMBAJADORES</span><h2>${title}</h2><p>${registered ? (active ? 'Comparte tu invitación y sigue tus referidos, comisiones y retiros desde tu panel.' : 'Tu perfil está en pausa. Entra a tu panel para consultar su estado.') : 'Invita a alguien a dar su siguiente paso profesional y recibe una recompensa por su primera compra elegible.'}</p><div class="amb-promo-actions"><button type="button" class="amb-promo-primary">${registered ? 'Ir a mi panel' : 'Quiero ser embajador'}${icon('arrow-right')}</button>${registered ? '' : '<button type="button" class="amb-promo-secondary">Cómo funciona</button>'}</div><small class="amb-promo-caption">${registered ? 'Tu código, tus invitaciones y tus movimientos en un solo lugar.' : 'Participa también con tu cuenta gratuita.'}</small></div>${c && !registered ? legacyBenefits(c, data.category) : `<div class="amb-promo-symbol" aria-hidden="true"><span>${icon(registered ? 'gift' : 'users')}</span><b>${registered ? 'Tu comunidad crece contigo' : 'Una invitación. Nuevas oportunidades.'}</b></div>`}`;
  }
  function restoreStyle(style, key, saved) {
    if (saved.value) style.setProperty(key, saved.value, saved.priority); else style.removeProperty(key);
  }
  function measure(root, state) {
    const nodes = [...root.childNodes], focused = root.contains(document.activeElement) ? document.activeElement : null;
    const scroll = [], windowScroll = [window.scrollX, window.scrollY];
    for (let node = root; node; node = node.parentElement) scroll.push([node, node.scrollLeft, node.scrollTop]);
    const oldHeight = { value: root.style.getPropertyValue('height'), priority: root.style.getPropertyPriority('height') }, oldVisibility = { value: root.style.getPropertyValue('visibility'), priority: root.style.getPropertyPriority('visibility') };
    const hidden = root.getAttribute('aria-hidden');
    let height;
    try {
      root.style.setProperty('visibility', 'hidden'); root.setAttribute('aria-hidden', 'true');
      root.removeAttribute('data-amb-modern'); root.style.removeProperty('height');
      root.innerHTML = legacyCard(state.data, state.place);
      height = root.getBoundingClientRect().height;
    } finally {
      root.replaceChildren(...nodes); root.setAttribute('data-amb-modern', '');
      if (hidden === null) root.removeAttribute('aria-hidden'); else root.setAttribute('aria-hidden', hidden);
      restoreStyle(root.style, 'visibility', oldVisibility);
      if (Number.isFinite(height) && height > 0) root.style.height = `${height}px`; else restoreStyle(root.style, 'height', oldHeight);
      if (focused?.isConnected) focused.focus({ preventScroll: true });
      for (const [node, left, top] of scroll) { node.scrollLeft = left; node.scrollTop = top; }
      if (window.scrollX !== windowScroll[0] || window.scrollY !== windowScroll[1]) window.scrollTo({ left: windowScroll[0], top: windowScroll[1], behavior: 'instant' });
    }
    return height;
  }
  function paint(root, state) {
    if (!root.isConnected) { state.observer?.disconnect(); live.delete(root); return; }
    root.setAttribute('data-amb-modern', '');
    if (root.hidden || !root.getClientRects().length) { state.width = -1; return; }
    const width = root.getBoundingClientRect().width, font = getComputedStyle(root);
    const key = [width, window.innerWidth, fontRevision, font.fontFamily, font.fontSize, font.lineHeight, font.letterSpacing, state.signature].join('|');
    state.width = width;
    let height = state.cache.get(key);
    if (height === undefined) {
      height = measure(root, state);
      if (Number.isFinite(height) && height > 0) { state.cache.set(key, height); if (state.cache.size > MAX_CACHE) state.cache.delete(state.cache.keys().next().value); }
    } else { root.setAttribute('data-amb-modern', ''); root.style.height = `${height}px`; }
  }
  function queue(root, state) {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => { state.frame = 0; if (!root.isConnected) { state.observer?.disconnect(); live.delete(root); return; } paint(root, state); });
  }
  function apply(root, data, place) {
    if (!root || !['home', 'profile'].includes(place)) return;
    let state = states.get(root);
    if (!state) {
      state = { cache: new Map(), width: -1, frame: 0, place };
      states.set(root, state); live.add(root);
      if (typeof ResizeObserver === 'function') {
        state.observer = new ResizeObserver(entries => { for (const entry of entries) { if (entry.target !== root) continue; const width = root.getBoundingClientRect().width; if (Math.abs(width - state.width) > .25) { if (state.frame) { cancelAnimationFrame(state.frame); state.frame = 0; } paint(root, state); } } });
        state.observer.observe(root);
      }
    }
    state.place = place; state.data = publicData(data); state.signature = JSON.stringify(state.data);
    paint(root, state);
  }
  function fontsChanged() { fontRevision++; for (const root of live) { const state = states.get(root); if (state) queue(root, state); } }
  document.fonts?.ready?.then(fontsChanged);
  document.fonts?.addEventListener?.('loadingdone', fontsChanged);
  window.addEventListener('resize', () => { if (viewportWidth === window.innerWidth) return; viewportWidth = window.innerWidth; for (const root of live) { const state = states.get(root); if (state) queue(root, state); } });
  window.ICADEMPromoFootprint = { apply };
})();
