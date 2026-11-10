/* Discovery only. Enrollment, consent, attribution and money stay in the existing program. */
(() => {
  'use strict';
  const DELAY = 3000;
  const PREFIX = 'icadem:ambassador-invitation:v1:';
  // Keep saved opt-outs; automatic displays have their own per-tab visit marker.
  const SESSION_PREFIX = 'icadem:ambassador-home-auto:v2:';
  let timer = 0, generation = 0, navigation = 0, refreshSequence = 0, dialog = null, finishDialog = null, currentData = null;
  const shownThisSession = new Set();
  const headlines = ['Compartir conocimiento <em>tiene recompensa.</em>', 'Una buena recomendación. <em>Dos grandes beneficios.</em>'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const money = cents => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2, minimumFractionDigits:0 }).format(cents / 100);
  const icon = name => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function uid() { return !window.__isDemoMode && !window.__sessionEnding ? String(window.UserState?.uid || '') : ''; }
  function homeActive() { return document.body.classList.contains('icadem-home-active'); }
  function validConfig(data) {
    const c = data?.config;
    return !!c && c.enabled === true && ['commissionCents','discountCents','minimumPaidCents','minimumWithdrawalCents','validationDays','attributionDays'].every(key => Number.isInteger(c[key]) && c[key] > 0) && Array.isArray(c.eligiblePlans) && c.eligiblePlans.some(plan => ['mensual','anual'].includes(plan));
  }
  function readState(id) {
    try { return JSON.parse(localStorage.getItem(PREFIX + id) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function writeState(id, patch) {
    try { localStorage.setItem(PREFIX + id, JSON.stringify({ ...readState(id), ...patch })); return true; }
    catch (_) { return false; }
  }
  function autoAllowed(data, state, sessionShown) {
    return validConfig(data) && data.registered === false && !state.disabled && !sessionShown;
  }
  function sessionSeen(id) {
    try { return shownThisSession.has(id) || sessionStorage.getItem(SESSION_PREFIX + id) === '1'; }
    catch (_) { return shownThisSession.has(id); }
  }
  function blocked() {
    return Array.from(document.querySelectorAll('dialog[open],.modal-backdrop.is-open,.ica-tour-root:not([hidden]),.ica-experience,#icadem-credit-gift,#name-modal,#splash-bienvenida,.paywall-modal.is-open,.credit-wallet-modal,.amb-commission-celebration,.mobile-drawer.is-open,#free-course-intro,#visorOverlay,#foro-lightbox,#cf-modal,.learning-game,.practice-picker--v3,#tpl-modal-overlay.tpl-modal-visible')).some(element => {
      const style = window.getComputedStyle(element);
      return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }
  function reward(c, category) { return category === 'vip' ? c.directCommissionVipCents : c.directCommissionFreeCents; }
  function profileRewardArt() {
    return '<svg class="amb-promo-megaphone" viewBox="0 0 210 200" fill="none" focusable="false" aria-hidden="true"><path d="m162 35 11-22m1 45 22-12m-18 41 22 5" stroke="#fff9e9" stroke-width="8" stroke-linecap="round"/><g transform="rotate(-12 92 99)" stroke="#10243e" stroke-width="4" stroke-linejoin="round"><path d="m52 133 15-2 12 40c2 6-1 10-7 11-4 1-8-1-10-5l-16-31Z" fill="#f6c445"/><rect x="25" y="105" width="44" height="33" rx="15" fill="#f6c445"/><path d="m62 105 61-45 28 66-84 13Z" fill="#fffdf4"/><path d="m123 58 30 66c2 5 7 7 11 5 5-2 7-7 5-12l-30-66c-2-5-7-7-11-5-5 2-7 7-5 12Z" fill="#f6c445"/><path d="m34 110-4 12m108-62 22 49" stroke="#fff7dc" stroke-width="3" stroke-linecap="round"/><path d="M145 68c8-1 14 10 11 16" stroke="#10243e" stroke-width="3"/></g></svg>';
  }
  function profileActionIcon(kind) {
    return kind === 'share' ? '<svg class="ic amb-promo-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/></svg>' : '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7m-1-6L10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></svg>';
  }
  function verifiedReward(data) {
    if (!validConfig(data)) return null;
    const amount = reward(data.config, data.category);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
  function benefits(c, category) {
    const monthly = category === 'vip' ? c.monthlyDiscountVipCents : c.monthlyDiscountFreeCents;
    const annual = category === 'vip' ? c.annualDiscountVipCents : c.annualDiscountFreeCents;
    return `<div class="amb-promo-offer"><div class="amb-promo-offer-top"><span>UNA INVITACIÓN · DOS BENEFICIOS</span>${icon('arrow-right')}</div><div class="amb-promo-benefits"><div class="amb-promo-benefit amb-promo-benefit--reward"><span>Tu recompensa</span><strong>${money(reward(c, category))}<small>MXN</small></strong><p>por una primera compra elegible</p><span class="amb-promo-coin" aria-hidden="true"><span>${icon('gift')}</span></span></div><div class="amb-promo-benefit amb-promo-benefit--guest"><span class="amb-promo-guest-icon" aria-hidden="true">${icon('users')}</span><div><span>Para tu invitado</span><strong>${money(monthly)} / ${money(annual)}<small>MXN de descuento</small></strong><p>mensual / anual · solo primer pago</p></div></div></div><span class="amb-promo-offer-seal">Aprender nos lleva más lejos.</span></div>`;
  }
  function cardMarkup(data, place) {
    const registered = data?.registered === true, active = registered && data.ambassador?.active;
    const c = validConfig(data) ? data.config : null;
    if (place === 'profile') {
      const paused = registered && !active;
      const commission = verifiedReward(data);
      const title = paused ? 'Tu perfil de embajador está en pausa.' : 'Convierte tus recomendaciones en ingresos.';
      const description = paused ? 'Entra a tu panel para consultar su estado.' : commission !== null ? `Gana <strong>${money(commission)} MXN</strong> por cada compra elegible realizada con tu código.` : 'Conoce el programa y consulta las condiciones de tu invitación.';
      const primary = active ? `<button type="button" class="amb-promo-primary" data-amb-promo="share">${profileActionIcon('share')}<span>Ver mi código y compartir</span><span class="amb-promo-button-arrow">${icon('arrow-right')}</span><span class="amb-promo-button-spinner" aria-hidden="true"></span></button>` : registered ? '' : `<button type="button" class="amb-promo-primary" data-amb-promo="info"><span>Activar mi espacio de embajador</span>${icon('arrow-right')}</button>`;
      const secondary = registered ? `<button type="button" class="amb-promo-secondary" data-amb-promo="panel">${profileActionIcon('panel')}<span>Ir a mi panel</span></button>` : '<button type="button" class="amb-promo-secondary" data-amb-promo="info">Cómo funciona</button>';
      const ticket = !paused && commission !== null ? `<strong>${money(commission)} <small>MXN</small></strong><span>por compra elegible</span>` : '<strong class="amb-promo-commission-neutral">Tu espacio<br>de embajador</strong>';
      return `<div class="amb-promo-profile-layout"><div class="amb-promo-copy amb-promo-profile-copy"><span class="amb-promo-eyebrow">${icon('crown')} ${data?.category === 'vip' ? 'EMBAJADOR VIP' : 'EMBAJADOR ICADEM'}</span><h2>${title}</h2><p>${description}</p><div class="amb-promo-actions">${primary}${secondary}</div></div><div class="amb-promo-profile-art${paused ? ' is-paused' : ''}" aria-hidden="true">${profileRewardArt()}<div class="amb-promo-commission-card">${ticket}</div></div></div>`;
    }
    const title = registered ? (active ? 'Tus recomendaciones ya tienen su espacio.' : 'Consulta tu perfil de embajador.') : c ? `Recomienda ICADEM.<em> Gana ${money(reward(c, data.category))} MXN.</em>` : 'Tu recomendación abre <em>nuevas puertas.</em>';
    return `<div class="amb-promo-copy"><span class="amb-promo-eyebrow">${icon('users')} ICADEM EMBAJADORES</span><h2>${title}</h2><p>${registered ? (active ? 'Comparte tu invitación y sigue tus referidos, comisiones y retiros desde tu panel.' : 'Tu perfil está en pausa. Entra a tu panel para consultar su estado.') : 'Invita a alguien a dar su siguiente paso profesional y recibe una recompensa por su primera compra elegible.'}</p><div class="amb-promo-actions"><button type="button" class="amb-promo-primary" data-amb-promo="${registered ? 'panel' : 'info'}">${registered ? 'Ir a mi panel' : 'Quiero ser embajador'}${icon('arrow-right')}</button>${registered ? '' : '<button type="button" class="amb-promo-secondary" data-amb-promo="info">Cómo funciona</button>'}</div><small class="amb-promo-caption">${registered ? 'Tu código, tus invitaciones y tus movimientos en un solo lugar.' : 'Participa también con tu cuenta gratuita.'}</small></div>${c && !registered ? benefits(c, data.category) : `<div class="amb-promo-symbol" aria-hidden="true"><span>${icon(registered ? 'gift' : 'users')}</span><b>${registered ? 'Tu comunidad crece contigo' : 'Una invitación. Nuevas oportunidades.'}</b></div>`}`;
  }
  function indicatorMarkup(data) {
    const commission = verifiedReward(data);
    if (!uid() || commission === null || data.registered !== false) return '';
    return `<span class="amb-promo-indicator__gift">${icon('gift')}</span><span class="amb-promo-indicator__copy"><strong>Gana ${money(commission)} MXN</strong><small>Por recomendar ICADEM</small></span><span class="amb-promo-indicator__action">Ver invitación ${icon('arrow-right')}</span><span class="amb-promo-indicator__dot" aria-hidden="true"></span>`;
  }
  function paint(data) {
    currentData = data;
    const indicator = document.getElementById('ambassador-topbar-promo');
    if (indicator) {
      const markup = indicatorMarkup(data);
      indicator.hidden = !markup;
      indicator.innerHTML = markup;
      indicator.setAttribute('aria-label', markup ? `Programa de embajadores: gana ${money(reward(data.config, data.category))} MXN por una primera compra elegible. Ver invitación.` : 'Programa de embajadores');
    }
    for (const [id, place] of [['ambassador-home-promo','home'],['ambassador-profile-promo','profile']]) {
      const root = document.getElementById(id);
      if (!root) continue;
      if (place === 'profile') root.setAttribute('data-amb-category', data?.category === 'vip' ? 'vip' : 'free');
      const visible = window.__isDemoMode || validConfig(data);
      root.hidden = !visible;
      if (visible) root.innerHTML = cardMarkup(data, place);
      else root.replaceChildren();
    }
  }
  async function refresh(force = false) {
    const id = uid(), token = generation, sequence = ++refreshSequence;
    if (window.__isDemoMode) { paint(null); return null; }
    if (!id || !window.ICADEMAmbassadors?.getSummary) { paint(null); return null; }
    try {
      const data = await window.ICADEMAmbassadors.getSummary(force);
      if (token !== generation || id !== uid() || sequence !== refreshSequence) return null;
      paint(data);
      return data;
    } catch (_) { if (token === generation && id === uid() && sequence === refreshSequence) paint(null); return null; }
  }
  function planText(c) {
    return c.eligiblePlans.filter(p => ['mensual','anual'].includes(p)).join(' o ');
  }
  function popupMarkup(data, variant) {
    const c = validConfig(data) ? data.config : null;
    return `<button type="button" class="amb-promo-close" data-amb-close aria-label="Cerrar invitación">${icon('close')}</button><div class="amb-promo-scroll"><div class="amb-promo-story"><div class="amb-promo-sparks" aria-hidden="true"><i></i><i></i></div><div class="amb-promo-dialog-head"><span class="amb-promo-eyebrow">${icon('gift')} ICADEM EMBAJADORES</span><h2 id="amb-promo-title">${c ? 'Comparte lo bueno.<em>Gana con ICADEM.</em>' : headlines[variant % headlines.length]}</h2><p id="amb-promo-description">${c ? (variant % 2 ? 'Conecta a alguien con su siguiente paso profesional. El beneficio es para ambos.' : 'Comparte una oportunidad de crecer. Tú recibes una recompensa y tu invitado empieza pagando menos.') : 'Ayuda a alguien a descubrir ICADEM. Su primera membresía elegible puede convertirse en un beneficio para ambos.'}</p></div>${c ? benefits(c, data.category) : '<div class="amb-promo-demo-note">Inicia sesión para consultar los importes y las condiciones vigentes de tu invitación.</div>'}</div><div class="amb-promo-guide"><div class="amb-promo-dialog-body"><span class="amb-promo-guide-label">CRECE TU COMUNIDAD</span><h3>Tu recomendación.<br> Su siguiente gran paso.</h3><p class="amb-promo-guide-intro">Tres pasos para ganar juntos.</p><ol class="amb-promo-steps"><li><span>01</span><div><strong>Activa tu perfil</strong><p>Revisa las condiciones y obtén tu código y enlace personal.</p></div></li><li><span>02</span><div><strong>Comparte tu invitación</strong><p>Tu invitado abre el enlace o aplica tu código antes de pagar ${c ? 'una nueva membresía ' + esc(planText(c)) + ' elegible' : 'una membresía elegible'}.</p></div></li><li><span>03</span><div><strong>Recibe tu recompensa</strong><p>${c ? `Después del pago confirmado y ${c.validationDays} días de validación, podrás solicitar tu retiro.` : 'Con la compra confirmada y la validación completada, podrás solicitar tu retiro.'}</p></div></li></ol>${c ? `<details class="amb-promo-conditions"><summary>Condiciones que debes conocer</summary><ul><li>El beneficio se permite una vez por cuenta, incluso si antes tuvo VIP, siempre que no tenga una membresía activa ni haya usado un código en una compra pagada. No cuentan renovaciones ni compras con tu propio código.</li><li>El pago después del descuento debe ser de al menos ${money(c.minimumPaidCents)} MXN. No se acumula con otros cupones.</li><li>La atribución dura ${c.attributionDays} días. Reembolsos y contracargos revierten la comisión.</li><li>Retiro mínimo de ${money(c.minimumWithdrawalCents)} MXN mediante transferencia bancaria manual, una vez disponible el saldo.</li></ul></details>` : ''}</div></div></div><div class="amb-promo-dialog-footer"><p class="amb-promo-access">${icon('users')} También puedes participar con tu cuenta gratuita.</p><button type="button" class="amb-promo-primary" data-amb-continue>${c ? 'Quiero ser embajador' : 'Iniciar sesión o crear cuenta'}${icon('arrow-right')}</button><button type="button" class="amb-promo-secondary" data-amb-close>Más tarde</button><label class="amb-promo-optout"><input type="checkbox" data-amb-optout>No volver a mostrar automáticamente</label><small>La invitación seguirá disponible en Inicio y en tu perfil.</small></div>`;
  }
  function closeDialog(reason = 'closed') {
    if (!dialog) return;
    const current = dialog, done = finishDialog;
    dialog = null; finishDialog = null;
    if (current.querySelector('[data-amb-optout]')?.checked && current.dataset.user) writeState(current.dataset.user, { disabled:true });
    if (current.open) current.close();
    current.remove();
    done?.(reason);
  }
  function show(data, automatic) {
    const id = uid(), state = readState(id);
    const count = Number.isSafeInteger(state.count) && state.count >= 0 ? state.count : 0;
    if (dialog || blocked() || (!validConfig(data) && !window.__isDemoMode)) return Promise.resolve('unavailable');
    if (automatic && (!id || !homeActive() || document.visibilityState !== 'visible' || !autoAllowed(data, state, sessionSeen(id)))) return Promise.resolve('ineligible');
    // If persistent storage is blocked, retain the card but skip automatic invitations.
    if (automatic && !writeState(id, { lastShown:Date.now(), count:count + 1 })) return Promise.resolve('storage-unavailable');
    if (id) {
      shownThisSession.add(id);
      try { sessionStorage.setItem(SESSION_PREFIX + id, '1'); } catch (_) {}
    }
    const previousFocus = document.activeElement;
    const root = document.createElement('dialog');
    root.className = 'amb-promo-dialog'; root.dataset.user = id;
    root.setAttribute('aria-labelledby', 'amb-promo-title');
    root.setAttribute('aria-describedby', 'amb-promo-description');
    root.innerHTML = popupMarkup(data, count);
    document.body.append(root); dialog = root;
    root.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    root.addEventListener('click', event => {
      if (event.target.closest('[data-amb-close]')) closeDialog();
      if (event.target === root) {
        const rect = root.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
      }
      if (event.target.closest('[data-amb-continue]')) {
        closeDialog('continue');
        if (uid()) window.navigateToSection?.('embajadores');
        else location.href = 'vip-auth.html?redirect=' + encodeURIComponent('vip-panel.html#embajadores');
      }
    });
    return new Promise(resolve => {
      finishDialog = reason => { if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true}); resolve(reason); };
      try {
        root.showModal();
        root.querySelector('[data-amb-close]').focus({preventScroll:true});
      } catch (_) { closeDialog('unavailable'); }
    });
  }
  async function openInfo() {
    const token = generation, route = navigation;
    const data = await refresh(true);
    if (token !== generation || route !== navigation) return;
    if (data?.registered) { window.navigateToSection?.('embajadores'); return; }
    if (!data && !window.__isDemoMode) { window.Toast?.info?.('Invitación no disponible', 'Vuelve a intentarlo en unos momentos.'); return; }
    return show(data, false);
  }
  async function openAutomatic() {
    if (!uid() || !homeActive() || document.visibilityState !== 'visible') return 'not-home';
    const data = await refresh(true);
    return show(data, true);
  }
  function schedule() {
    clearTimeout(timer);
    if (!homeActive() || !uid()) return;
    timer = setTimeout(() => {
      if (homeActive() && uid() && autoAllowed(currentData, readState(uid()), sessionSeen(uid()))) window.ICADEMExperience?.enqueue('ambassador-invite');
    }, DELAY);
  }
  async function homeChanged() {
    navigation++; clearTimeout(timer); closeDialog('navigation');
    await refresh(homeActive() || location.hash === '#perfil');
    if (homeActive()) schedule();
  }
  function init() {
    for (const event of ['icadem:session-ending','icadem:session-ended']) document.addEventListener(event, () => {
      generation++; clearTimeout(timer); closeDialog('session'); paint(null);
    });
    document.addEventListener('icadem:session-exit-failed', () => homeChanged());
    document.addEventListener('icadem:ambassador-enrolled', () => refresh(true));
    document.addEventListener('click', async event => {
      const action = event.target.closest('[data-amb-promo]');
      if (!action) return;
      if (action.dataset.ambPromo === 'panel') { window.navigateToSection?.('embajadores'); return; }
      if (action.dataset.ambPromo === 'share') {
        if (action.disabled) return;
        const id = uid(), token = generation;
        if (!id) return;
        if (currentData?.registered !== true || currentData.ambassador?.active !== true || !window.ICADEMAmbassadors?.openSharing) { window.navigateToSection?.('embajadores'); return; }
        action.disabled = true; action.setAttribute?.('aria-busy', 'true');
        try { await window.ICADEMAmbassadors.openSharing(); }
        catch (_) { if (token === generation && id === uid()) window.navigateToSection?.('embajadores'); }
        finally { action.disabled = false; action.removeAttribute?.('aria-busy'); }
        return;
      }
      openInfo();
    });
    document.addEventListener('icadem:user-ready', () => { generation++; closeDialog('session'); paint(null); homeChanged(); });
    document.addEventListener('icadem:identity-ready', () => { if (homeActive() || location.hash === '#perfil') homeChanged(); });
    window.addEventListener('icadem:navigation', () => homeChanged());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(); else clearTimeout(timer); });
    window.addEventListener('storage', event => { if (event.key === PREFIX + uid()) schedule(); });
    homeChanged();
  }
  window.ICADEMAmbassadorPromo = { mountProfile:() => refresh(), openAutomatic };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
