/* Discovery only. Enrollment, consent, attribution and money stay in the existing program. */
(() => {
  'use strict';
  const DELAY = 3000;
  const PREFIX = 'icadem:ambassador-invitation:v1:';
  // Keep saved opt-outs; automatic displays have their own per-tab visit marker.
  const SESSION_PREFIX = 'icadem:ambassador-home-auto:v2:';
  let timer = 0, generation = 0, navigation = 0, dialog = null, finishDialog = null, currentData = null;
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
    return '<svg viewBox="0 0 96 88" fill="none" focusable="false"><defs><linearGradient id="amb-profile-lid" x1="18" y1="27" x2="72" y2="51" gradientUnits="userSpaceOnUse"><stop stop-color="#ffe4a0"/><stop offset="1" stop-color="#d89525"/></linearGradient><linearGradient id="amb-profile-front" x1="16" y1="49" x2="74" y2="77" gradientUnits="userSpaceOnUse"><stop stop-color="#ffd978"/><stop offset="1" stop-color="#e0a432"/></linearGradient></defs><path d="M11 80h76" stroke="#9a641c" stroke-opacity=".2" stroke-width="2" stroke-linecap="round"/><path d="m14 15 1.7 4.3L20 21l-4.3 1.7L14 27l-1.7-4.3L8 21l4.3-1.7Z" fill="#fff1cb"/><circle cx="65" cy="18" r="12" fill="#ffe7a8" stroke="#99601c" stroke-width="1.5"/><circle cx="65" cy="18" r="8.5" stroke="#c18a36" stroke-width="1"/><path d="M65 12v12m3-9c-3-3-8 1-3 3s1 6-3 3" stroke="#99601c" stroke-width="1.4" stroke-linecap="round"/><path d="M18 49V43c0-13 10-22 26-22s26 9 26 22v6" fill="url(#amb-profile-lid)" stroke="#915b19" stroke-width="1.5"/><path d="M38 22h12v27H38Z" fill="#ffdf8c" stroke="#a16b20" stroke-width="1.2"/><rect x="16" y="47" width="57" height="30" rx="5" fill="#b77d27" stroke="#915b19" stroke-width="1.5"/><rect x="14" y="46" width="57" height="29" rx="5" fill="url(#amb-profile-front)" stroke="#915b19" stroke-width="1.5"/><path d="M19 51h47" stroke="#ffe9b3" stroke-width="1.5" stroke-linecap="round"/><path d="M39 47h11v17H39Z" fill="#ffe7a3" stroke="#915b19" stroke-width="1.4"/><circle cx="44.5" cy="53.5" r="2" fill="#915b19"/><path d="M44.5 55v3" stroke="#915b19" stroke-width="1.5" stroke-linecap="round"/><circle cx="22" cy="64" r="1.2" fill="#a77122"/><circle cx="64" cy="64" r="1.2" fill="#a77122"/><path d="M70 68v8c0 3 19 3 19 0v-8" fill="#d2982d" stroke="#915b19" stroke-width="1.2"/><ellipse cx="79.5" cy="68" rx="9.5" ry="3.4" fill="#ffe5a0" stroke="#915b19" stroke-width="1.2"/><path d="M73 61v7c0 3 17 3 17 0v-7" fill="#e4ad3c" stroke="#915b19" stroke-width="1.2"/><ellipse cx="81.5" cy="61" rx="8.5" ry="3.2" fill="#fff0bd" stroke="#915b19" stroke-width="1.2"/></svg>';
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
      const commission = c ? reward(c, data.category) : null;
      const title = paused ? 'Tu perfil de embajador está en pausa.' : 'Gana dinero recomendando ICADEM.';
      const description = paused ? '<p>Entra a tu panel para consultar su estado.</p>' : Number.isSafeInteger(commission) && commission > 0 ? `<p class="amb-promo-profile-reward"><strong>${money(commission)} <small>MXN</small></strong><span>por compra elegible</span></p>` : '<p>Conoce el programa y consulta las condiciones de tu invitación.</p>';
      return `<div class="amb-promo-copy amb-promo-profile-copy"><span class="amb-promo-eyebrow">${icon('crown')} ${data?.category === 'vip' ? 'EMBAJADOR VIP' : 'EMBAJADOR'}</span><h2>${title}</h2>${description}<div class="amb-promo-actions"><button type="button" class="amb-promo-primary" data-amb-promo="${registered ? 'panel' : 'info'}">${registered ? (paused ? 'Ir a mi panel' : 'Ver mi código y compartir') : 'Quiero ser embajador'}${icon('arrow-right')}</button>${registered ? '' : '<button type="button" class="amb-promo-secondary" data-amb-promo="info">Cómo funciona</button>'}</div></div><span class="amb-promo-profile-art${paused ? ' is-paused' : ''}" aria-hidden="true">${profileRewardArt()}</span>`;
    }
    const title = registered ? (active ? 'Tus recomendaciones ya tienen su espacio.' : 'Consulta tu perfil de embajador.') : c ? `Recomienda ICADEM.<em> Gana ${money(reward(c, data.category))} MXN.</em>` : 'Tu recomendación abre <em>nuevas puertas.</em>';
    return `<div class="amb-promo-copy"><span class="amb-promo-eyebrow">${icon('users')} ICADEM EMBAJADORES</span><h2>${title}</h2><p>${registered ? (active ? 'Comparte tu invitación y sigue tus referidos, comisiones y retiros desde tu panel.' : 'Tu perfil está en pausa. Entra a tu panel para consultar su estado.') : 'Invita a alguien a dar su siguiente paso profesional y recibe una recompensa por su primera compra elegible.'}</p><div class="amb-promo-actions"><button type="button" class="amb-promo-primary" data-amb-promo="${registered ? 'panel' : 'info'}">${registered ? 'Ir a mi panel' : 'Quiero ser embajador'}${icon('arrow-right')}</button>${registered ? '' : '<button type="button" class="amb-promo-secondary" data-amb-promo="info">Cómo funciona</button>'}</div><small class="amb-promo-caption">${registered ? 'Tu código, tus invitaciones y tus movimientos en un solo lugar.' : 'Participa también con tu cuenta gratuita.'}</small></div>${c && !registered ? benefits(c, data.category) : `<div class="amb-promo-symbol" aria-hidden="true"><span>${icon(registered ? 'gift' : 'users')}</span><b>${registered ? 'Tu comunidad crece contigo' : 'Una invitación. Nuevas oportunidades.'}</b></div>`}`;
  }
  function indicatorMarkup(data) {
    if (!uid() || !validConfig(data) || data.registered !== false) return '';
    return `<span class="amb-promo-indicator__gift">${icon('gift')}</span><span class="amb-promo-indicator__copy"><strong>Gana ${money(reward(data.config, data.category))} MXN</strong><small>Por recomendar ICADEM</small></span><span class="amb-promo-indicator__action">Ver invitación ${icon('arrow-right')}</span><span class="amb-promo-indicator__dot" aria-hidden="true"></span>`;
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
    const id = uid(), token = generation;
    if (window.__isDemoMode) { paint(null); return null; }
    if (!id || !window.ICADEMAmbassadors?.getSummary) { paint(null); return null; }
    try {
      const data = await window.ICADEMAmbassadors.getSummary(force);
      if (token !== generation || id !== uid()) return null;
      paint(data);
      return data;
    } catch (_) { if (token === generation) paint(null); return null; }
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
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-amb-promo]');
      if (!action) return;
      if (action.dataset.ambPromo === 'panel') window.navigateToSection?.('embajadores');
      else openInfo();
    });
    document.addEventListener('icadem:user-ready', () => { generation++; closeDialog('session'); paint(null); homeChanged(); });
    document.addEventListener('icadem:identity-ready', () => { if (homeActive()) homeChanged(); });
    window.addEventListener('icadem:navigation', () => homeChanged());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(); else clearTimeout(timer); });
    window.addEventListener('storage', event => { if (event.key === PREFIX + uid()) schedule(); });
    homeChanged();
  }
  window.ICADEMAmbassadorPromo = { mountProfile:() => refresh(), openAutomatic };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
