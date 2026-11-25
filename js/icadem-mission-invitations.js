/* Contextual invitations for confirmed wallet missions. */
(function () {
  'use strict';
  const endpoint = '/api/credits/mission-invitation';
  const actions = {
    'professional-card': 'Completar mi tarjeta',
    'professional-cv': 'Completar mi CV',
    'forum-reply': 'Ir a Comunidad',
    'first-connection': 'Explorar Directorio',
    'referral-activation': 'Ver mis invitaciones'
  };
  const blocking = 'dialog[open],.modal-backdrop.is-open,.paywall-modal.is-open,.ica-tour-overlay,.ica-tour-root:not([hidden]),.ica-experience,.mobile-drawer.is-open,#splash-bienvenida,#name-modal,#icadem-credit-gift,.amb-commission-celebration,.learning-game';
  const mailToggle = '[data-mission-email-toggle]';
  let state = null;
  let observer = null;
  let retry = 0;
  let surface = null;
  let lastSection = section();
  let returningUid = '';

  function account() {
    if (window.__isDemoMode || window.__sessionEnding) return '';
    return (window.__auth ? window.__auth.currentUser : window.__currentUser)?.uid || '';
  }

  function current(entry) {
    return !!entry && state === entry && entry.uid === account();
  }

  function section() {
    return window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('seccion') || 'inicio';
  }

  function visible(element) {
    const rect = element?.getBoundingClientRect();
    return !!rect && rect.width > 0 && rect.height > 0
      && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function interrupted() {
    return document.activeElement?.matches('input,textarea,[contenteditable="true"]')
      || Array.from(document.querySelectorAll(blocking)).some(element => {
        return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
      });
  }

  function dismissKey(uid) {
    return 'icadem:mission-invite-dismiss-pending:' + uid;
  }

  function pendingDismiss(uid) {
    try { return localStorage.getItem(dismissKey(uid)) === '1'; } catch (_) { return false; }
  }

  function post(path, body) {
    return window.ICADEMPlatform.request(endpoint + path, { method: 'POST', body });
  }

  async function sendDismiss(entry) {
    await post('/dismiss', {});
    try { localStorage.removeItem(dismissKey(entry.uid)); } catch (_) {}
  }

  function stopWatching() {
    observer?.disconnect();
    observer = null;
    clearTimeout(retry);
    retry = 0;
  }

  function removeSurface() {
    const old = surface;
    surface = null;
    if (!old) return;
    if (old.open) old.close();
    old.remove();
  }

  function reset() {
    stopWatching();
    removeSurface();
    state = null;
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function renderInvitation(entry, picked, target) {
    const { mission, channel } = picked;
    const modal = channel === 'popup';
    const node = document.createElement(modal ? 'dialog' : 'aside');
    node.className = 'mission-invitation' + (modal ? ' mission-invitation--dialog' : '');
    node.setAttribute('aria-labelledby', 'mission-invitation-title');
    node.setAttribute('aria-describedby', 'mission-invitation-detail');
    node.innerHTML = `<div class="mission-invitation__body">
      <span class="mission-invitation__icon" aria-hidden="true"><svg class="ic"><use href="#i-trophy"/></svg></span>
      <div class="mission-invitation__copy">
        <div class="mission-invitation__title">
          <h2 id="mission-invitation-title">${escapeText(mission.title)}</h2>
          <strong>+${mission.amount} créditos</strong>
        </div>
        <p id="mission-invitation-detail">${escapeText(mission.description || 'Completa esta actividad para sumar créditos a tu cartera.')}</p>
      </div>
      <div class="mission-invitation__actions">
        <button type="button" data-credit-mission="${mission.id}">${actions[mission.id]} <span aria-hidden="true">→</span></button>
        <button type="button" data-mission-dismiss ${modal ? 'autofocus' : ''}>Ahora no</button>
      </div>
    </div>`;
    const dismiss = () => {
      const focused = node.contains(document.activeElement);
      entry.dismissed = true;
      try { localStorage.setItem(dismissKey(entry.uid), '1'); } catch (_) {}
      sendDismiss(entry).catch(() => {});
      removeSurface();
      if (!modal && focused) target.querySelector('[data-credit-wallet-open]')?.focus({ preventScroll: true });
    };
    node.querySelector('[data-mission-dismiss]').addEventListener('click', dismiss);
    node.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    node.querySelector('[data-credit-mission]').addEventListener('click', () => {
      // Let the same delegated action that powers wallet missions take the user there.
      setTimeout(() => { if (surface === node) removeSurface(); }, 0);
    });
    surface = node;
    if (modal) {
      document.body.append(node);
      node.showModal();
    } else target.before(node);
  }

  async function present(entry, target) {
    if (!current(entry) || entry.dismissed || entry.claiming || section() !== 'inicio' || !entry.invitation
        || document.visibilityState !== 'visible' || !document.hasFocus() || !visible(target)) return;
    if (interrupted()) {
      if (!retry && (entry.waits || 0) < 8) {
        entry.waits = (entry.waits || 0) + 1;
        retry = setTimeout(() => { retry = 0; present(entry, target); }, 1500);
      }
      return;
    }
    const picked = entry.invitation;
    if (picked.channel === 'popup' && !entry.seenHomeBefore && returningUid !== entry.uid) return;
    if (picked.channel === 'popup' && typeof window.HTMLDialogElement?.prototype.showModal !== 'function') return;
    if (!entry.claimed) {
      entry.claiming = true;
      try {
        const result = await post('/exposure', { missionId: picked.mission.id, channel: picked.channel });
        if (!current(entry)) return;
        if (result.claimed !== true) {
          entry.invitation = null;
          stopWatching();
          if (!entry.reselected) {
            entry.reselected = true;
            entry.loaded = false;
            // A concurrent wallet reconciliation can already have awarded the suggested mission.
            queueMicrotask(sync);
          }
          return;
        }
        entry.claimed = true;
      } catch (_) {
        return;
      } finally { entry.claiming = false; }
      return present(entry, target);
    }
    entry.invitation = null;
    stopWatching();
    renderInvitation(entry, picked, target);
  }

  function watchHome(entry) {
    const target = document.querySelector('[data-credit-missions-home]');
    if (!target || !entry.invitation || entry.dismissed) return;
    if (entry.seenHomeBefore === undefined) {
      const key = 'icadem:mission-invite-home-visited:' + entry.uid;
      try {
        entry.seenHomeBefore = localStorage.getItem(key) === '1';
        localStorage.setItem(key, '1');
      } catch (_) { entry.seenHomeBefore = false; }
    }
    if (!observer && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(item => item.isIntersecting)) present(entry, target);
      }, { threshold: 0.1 });
      observer.observe(target);
    }
    present(entry, target);
  }

  function paintPreference(entry) {
    const button = document.querySelector(mailToggle);
    if (!button) return;
    button.disabled = !entry || !entry.loaded || entry.saving;
    const enabled = entry?.emailReminderEnabled === true;
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? 'Activado' : 'Desactivado';
  }

  function validInvitation(value) {
    return value && ['inline', 'popup'].includes(value.channel) && Object.hasOwn(actions, value.mission?.id)
      && typeof value.mission.title === 'string' && Number.isSafeInteger(value.mission.amount) && value.mission.amount > 0;
  }

  async function sync() {
    const route = section();
    if (route !== 'inicio') { stopWatching(); removeSurface(); }
    const uid = account();
    if (!uid || !window.ICADEMPlatform || !['inicio', 'perfil'].includes(route)) return;
    if (state?.uid !== uid) {
      reset();
      state = { uid, dismissed: pendingDismiss(uid) };
    }
    const entry = state;
    if (entry.loading) return;
    if (!entry.loaded) {
      entry.loading = true;
      try {
        if (entry.dismissed && pendingDismiss(uid)) await sendDismiss(entry).catch(() => {});
        const data = await window.ICADEMPlatform.request(endpoint);
        if (!current(entry)) return;
        entry.invitation = validInvitation(data.invitation) ? data.invitation : null;
        entry.emailReminderEnabled = data.emailReminderEnabled === true;
        entry.loaded = true;
      } catch (_) {
        const note = document.querySelector('[data-mission-email-status]');
        if (current(entry) && note) note.textContent = 'No pudimos cargar la preferencia. Vuelve a abrir Mi perfil.';
        return;
      } finally { entry.loading = false; }
    }
    if (section() === 'inicio') watchHome(entry);
    if (section() === 'perfil') paintPreference(entry);
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.(mailToggle);
    const entry = state;
    if (!button || !current(entry) || !entry.loaded || entry.saving) return;
    entry.saving = true;
    paintPreference(entry);
    const note = document.querySelector('[data-mission-email-status]');
    try {
      const result = await post('/email-preference', { enabled: !entry.emailReminderEnabled });
      if (!current(entry)) return;
      entry.emailReminderEnabled = result.emailReminderEnabled === true;
      if (note?.isConnected) note.textContent = 'Preferencia guardada.';
    } catch (_) {
      if (current(entry) && note?.isConnected) note.textContent = 'No pudimos guardar tu preferencia. Intenta de nuevo.';
    } finally {
      entry.saving = false;
      if (current(entry)) paintPreference(entry);
    }
  });

  window.addEventListener('icadem:navigation', event => {
    const next = event.detail?.section;
    if (next === 'inicio' && lastSection && lastSection !== 'inicio') returningUid = account();
    lastSection = next;
    if (next !== 'inicio') { stopWatching(); removeSurface(); }
  });
  window.addEventListener('icadem:section-ready', sync);
  document.addEventListener('icadem:user-ready', () => { reset(); sync(); });
  function endSession() {
    returningUid = '';
    lastSection = '';
    reset();
  }
  document.addEventListener('icadem:session-ending', endSession);
  document.addEventListener('icadem:session-ended', endSession);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('online', sync);
  sync();
})();
