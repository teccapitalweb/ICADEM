/* Discovery only. Enrollment, consent, attribution and money stay in the existing program. */
(() => {
  'use strict';
  const DAY = 86400000, COOLDOWN = 7 * DAY, DELAY = 25000;
  const PREFIX = 'icadem:ambassador-invitation:v1:';
  let timer = 0, generation = 0, navigation = 0, dialog = null, finishDialog = null, currentData = null;
  const shownThisSession = new Set();
  const headlines = ['Compartir conocimiento <em>tiene recompensa.</em>', 'Una buena recomendación. <em>Dos grandes beneficios.</em>'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const money = cents => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2, minimumFractionDigits:0 }).format(cents / 100);
  const icon = name => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function uid() { return !window.__isDemoMode ? String(window.UserState?.uid || '') : ''; }
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
  function autoAllowed(data, state, sessionShown, now = Date.now()) {
    return validConfig(data) && data.registered === false && !state.disabled && !sessionShown && (!state.lastShown || now - Number(state.lastShown) >= COOLDOWN);
  }
  function sessionSeen(id) {
    try { return shownThisSession.has(id) || sessionStorage.getItem(PREFIX + id) === '1'; }
    catch (_) { return shownThisSession.has(id); }
  }
  function blocked() {
    return Array.from(document.querySelectorAll('dialog[open],.modal-backdrop.is-open,.ica-tour-root:not([hidden]),.ica-experience,#icadem-credit-gift,#name-modal,#splash-bienvenida,.paywall-modal.is-open,.credit-wallet-modal,.amb-commission-celebration,.mobile-drawer.is-open,#free-course-intro,#visorOverlay,#foro-lightbox,#cf-modal,.learning-game,.practice-picker--v3,#tpl-modal-overlay.tpl-modal-visible')).some(element => {
      const style = window.getComputedStyle(element);
      return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }
  function benefits(c) {
    return `<div class="amb-promo-offer"><div class="amb-promo-offer-top"><span>UNA INVITACIÓN · DOS BENEFICIOS</span>${icon('arrow-right')}</div><div class="amb-promo-benefits"><div class="amb-promo-benefit amb-promo-benefit--reward"><span>Tu recompensa</span><strong>${money(c.commissionCents)}<small>MXN</small></strong><p>por una primera compra elegible</p><span class="amb-promo-coin" aria-hidden="true"><span>${icon('gift')}</span></span></div><div class="amb-promo-benefit amb-promo-benefit--guest"><span class="amb-promo-guest-icon" aria-hidden="true">${icon('users')}</span><div><span>Para tu invitado</span><strong>${money(c.discountCents)}<small>MXN de descuento</small></strong><p>en su primer pago elegible</p></div></div></div><span class="amb-promo-offer-seal">Aprender nos lleva más lejos.</span></div>`;
  }
  function cardMarkup(data, place) {
    const registered = data?.registered === true, active = registered && data.ambassador?.active;
    const c = validConfig(data) ? data.config : null;
    const title = registered ? (active ? 'Tus recomendaciones ya tienen su espacio.' : 'Consulta tu perfil de embajador.') : 'Tu recomendación abre <em>nuevas puertas.</em>';
    return `<div class="amb-promo-copy"><span class="amb-promo-eyebrow">${icon('users')} ICADEM EMBAJADORES</span><h2>${title}</h2><p>${registered ? (active ? 'Comparte tu invitación y sigue tus referidos, comisiones y retiros desde tu panel.' : 'Tu perfil está en pausa. Entra a tu panel para consultar su estado.') : 'Invita a alguien a dar su siguiente paso profesional y recibe una recompensa por su primera compra elegible.'}</p><div class="amb-promo-actions"><button type="button" class="amb-promo-primary" data-amb-promo="${registered ? 'panel' : 'info'}">${registered ? 'Ir a mi panel' : 'Quiero ser embajador'}${icon('arrow-right')}</button>${registered ? '' : '<button type="button" class="amb-promo-secondary" data-amb-promo="info">Cómo funciona</button>'}</div><small class="amb-promo-caption">${registered ? 'Tu código, tus invitaciones y tus movimientos en un solo lugar.' : 'Participa también con tu cuenta gratuita.'}</small></div>${c && !registered ? benefits(c) : `<div class="amb-promo-symbol" aria-hidden="true"><span>${icon(registered ? 'gift' : 'users')}</span><b>${registered ? 'Tu comunidad crece contigo' : 'Una invitación. Nuevas oportunidades.'}</b></div>`}`;
  }
  function paint(data) {
    currentData = data;
    for (const [id, place] of [['ambassador-home-promo','home'],['ambassador-profile-promo','profile']]) {
      const root = document.getElementById(id);
      if (!root) continue;
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
    return `<button type="button" class="amb-promo-close" data-amb-close aria-label="Cerrar invitación">${icon('close')}</button><div class="amb-promo-story"><div class="amb-promo-dialog-head"><span class="amb-promo-eyebrow">${icon('gift')} PROGRAMA ICADEM EMBAJADORES</span><h2 id="amb-promo-title">${headlines[variant % headlines.length]}</h2><p id="amb-promo-description">Ayuda a alguien a descubrir ICADEM. Su primera membresía elegible puede convertirse en un beneficio para ambos.</p></div>${c ? benefits(c) : '<div class="amb-promo-demo-note">Inicia sesión para consultar los importes y las condiciones vigentes de tu invitación.</div>'}</div><div class="amb-promo-guide"><div class="amb-promo-dialog-body"><span class="amb-promo-guide-label">TU PRÓXIMO PASO</span><h3>Haz que tu recomendación cuente.</h3><p class="amb-promo-guide-intro">Tres pasos para formar parte.</p><ol class="amb-promo-steps"><li><span>01</span><div><strong>Activa tu perfil</strong><p>Revisa las condiciones del programa y obtén tu código y enlace personal.</p></div></li><li><span>02</span><div><strong>Comparte tu invitación</strong><p>Tu invitado abre el enlace o aplica tu código antes de pagar ${c ? 'su primera membresía ' + esc(planText(c)) + ' elegible' : 'una membresía elegible'}.</p></div></li><li><span>03</span><div><strong>Recibe tu recompensa</strong><p>${c ? `Después del pago confirmado y ${c.validationDays} días de validación, podrás solicitar tu retiro.` : 'Con la compra confirmada y la validación completada, podrás solicitar tu retiro.'}</p></div></li></ol>${c ? `<details class="amb-promo-conditions"><summary>Condiciones que debes conocer</summary><ul><li>Solo cuenta la primera compra elegible de un miembro nuevo. No cuentan renovaciones ni compras con tu propio código.</li><li>El pago después del descuento debe ser de al menos ${money(c.minimumPaidCents)} MXN. No se acumula con otros cupones.</li><li>La atribución dura ${c.attributionDays} días. Reembolsos y contracargos revierten la comisión.</li><li>Retiro mínimo de ${money(c.minimumWithdrawalCents)} MXN mediante transferencia bancaria manual, una vez disponible el saldo.</li></ul></details>` : ''}</div><div class="amb-promo-dialog-footer"><button type="button" class="amb-promo-primary" data-amb-continue>${c ? 'Quiero ser embajador' : 'Iniciar sesión o crear cuenta'}${icon('arrow-right')}</button><button type="button" class="amb-promo-secondary" data-amb-close>Más tarde</button><label class="amb-promo-optout"><input type="checkbox" data-amb-optout>No volver a mostrar automáticamente</label><small>La invitación seguirá disponible en Inicio y en tu perfil.</small></div></div>`;
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
      try { sessionStorage.setItem(PREFIX + id, '1'); } catch (_) {}
      if (!automatic) writeState(id, { lastShown:Date.now() });
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
    if (homeActive() || location.hash === '#perfil') await refresh(true);
    if (homeActive()) schedule();
  }
  function init() {
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
