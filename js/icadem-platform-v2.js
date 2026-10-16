/* ICADEM · identidad y aprendizaje v2
   La identidad y los premios se validan en el backend. Este archivo conserva
   los renderizadores históricos del panel y añade una capa progresiva. */
(function () {
  'use strict';
  window.__platformV2LoadedAt = Date.now();

  const API = window.WEBHOOK_URL || 'https://icadem-webhook-production.up.railway.app';
  // Créditos (iguales a IMFRA y Synova; el servidor es quien los acredita).
  const CLASS_CREDITS = 10;
  const RETO_CREDITS = 30;
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const PRACTICE_TYPES = ['crossword', 'memory', 'wordsearch', 'puzzle', 'guess', 'classify'];
  const GAME_LABELS = {
    crossword: 'Crucigrama', memory: 'Memoria', wordsearch: 'Sopa de letras',
    puzzle: 'Rompecabezas', guess: 'Veredicto exprés', classify: 'Clasifica', quiz: 'Quiz profesional',
    order: 'Ordena el proceso', hazard: 'Encuentra la irregularidad', spot: 'Señala en la escena',
    document: 'Revisa el documento', calc: 'Calcula y comprueba', vmemory: 'Memorama visual'
  };
  const PRO_TYPES = ['puzzle', 'hazard', 'spot', 'document', 'calc', 'vmemory', 'order'];
  const GAME_ICONS = {
    crossword: '⌗', memory: '◫', wordsearch: '⌕', puzzle: '◇', guess: '?', classify: '≡', quiz: '12',
    order: '↕', hazard: '!', spot: '⌖', document: '✎', calc: '∑', vmemory: '◫'
  };
  const GAME_META = {
    crossword: { eyebrow: 'Precisión', title: 'Crucigrama técnico', description: 'Completa el concepto a partir de una pista profesional.', duration: '2 min', icon: 'i-edit' },
    memory: { eyebrow: 'Memoria', title: 'Conecta conceptos', description: 'Relaciona cada término con su aplicación correcta.', duration: '2–3 min', icon: 'i-book' },
    wordsearch: { eyebrow: 'Enfoque', title: 'Sopa de conceptos', description: 'Encuentra términos clave dentro del tablero.', duration: '3 min', icon: 'i-search' },
    puzzle: { eyebrow: 'Percepción', title: 'Rompecabezas profesional', description: 'Reconstruye una escena real de tu profesión pieza por pieza.', duration: '2 min', icon: 'i-image' },
    order: { eyebrow: 'Procedimiento', title: 'Ordena el proceso', description: 'Acomoda los pasos de un trámite real en su orden correcto.', duration: '2 min', icon: 'i-chart-bar' },
    hazard: { eyebrow: 'Ojo profesional', title: 'Encuentra la irregularidad', description: 'Detecta las cuatro fallas escondidas en una escena real.', duration: '2 min', icon: 'i-alert-circle' },
    spot: { eyebrow: 'Ubicación', title: 'Señala en la escena', description: 'Ubica cada área clave en una vista real desde arriba.', duration: '2 min', icon: 'i-gauge' },
    document: { eyebrow: 'Revisión', title: 'Revisa el documento', description: 'Encuentra los errores de una factura, contrato o pedimento.', duration: '3 min', icon: 'i-clipboard-check' },
    calc: { eyebrow: 'Cálculo', title: 'Calcula y comprueba', description: 'Resuelve un caso real con números y valida tu resultado.', duration: '3 min', icon: 'i-calculator' },
    vmemory: { eyebrow: 'Memoria visual', title: 'Memorama visual', description: 'Une cada imagen con su concepto profesional.', duration: '2 min', icon: 'i-book-2' },
    guess: { eyebrow: 'Criterio jurídico', title: 'Veredicto exprés', description: 'Identifica el concepto legal y decide con fundamento.', duration: '60 s', icon: 'i-scale' },
    classify: { eyebrow: 'Criterio', title: 'Decide con criterio', description: 'Clasifica conceptos y aplicaciones profesionales.', duration: '3 min', icon: 'i-briefcase' },
    quiz: { eyebrow: 'Reto diario', title: '12 preguntas clave', description: 'Comprueba tu criterio con preguntas de seis áreas profesionales.', duration: '5 min', icon: 'i-calendar' }
  };

  const DEMO_QUIZ = [
    { id:'dq01', area:'Fiscal', question:'¿Cuál es la tasa general del IVA?', options:['0%','8%','11%','16%'], answer:3 },
    { id:'dq02', area:'Fiscal', question:'¿Con qué frecuencia se actualiza la UMA?', options:['Mensualmente','Trimestralmente','Anualmente','Cada sexenio'], answer:2 },
    { id:'dq03', area:'Legal', question:'¿Cuál es la prima dominical mínima?', options:['15%','20%','25%','50%'], answer:2 },
    { id:'dq04', area:'Nómina', question:'¿Cuántos días de aguinaldo mínimo establece la LFT?', options:['10','12','15','20'], answer:2 },
    { id:'dq05', area:'Nómina', question:'¿Qué salario se usa como base para el aguinaldo?', options:['Integrado','Diario ordinario','Mínimo general','SBC'], answer:1 },
    { id:'dq06', area:'Contabilidad', question:'¿Qué NIF regula el flujo de efectivo?', options:['NIF A-1','NIF B-2','NIF B-3','NIF C-3'], answer:1 },
    { id:'dq07', area:'Contabilidad', question:'Un cheque emitido y no cobrado se clasifica como:', options:['Depósito en tránsito','Cheque en circulación','Error bancario','Nota de cargo'], answer:1 },
    { id:'dq08', area:'Finanzas', question:'¿Qué indicador mide la capacidad de pago de corto plazo?', options:['Endeudamiento','Razón corriente','Rotación','Margen operativo'], answer:1 },
    { id:'dq09', area:'Finanzas', question:'El pago de dividendos es una actividad de:', options:['Operación','Inversión','Financiamiento','Impuestos'], answer:2 },
    { id:'dq10', area:'RH', question:'¿En cuántos días hábiles se da de alta a un trabajador ante el IMSS?', options:['3','5','10','15'], answer:1 },
    { id:'dq11', area:'Legal', question:'¿Qué regula el artículo 47 de la LFT?', options:['Jornada','Rescisión sin responsabilidad para el patrón','Vacaciones','PTU'], answer:1 },
    { id:'dq12', area:'RH', question:'¿Qué deja evidencia del alta laboral?', options:['Una llamada','El expediente con acuses','Un mensaje','Solo el contrato'], answer:1 }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f\s]/g, '').toUpperCase();
  }

  function initials(value) {
    const parts = String(value || '').trim().split(/[\s@.]+/).filter(Boolean);
    return `${parts[0]?.[0] || 'I'}${parts[1]?.[0] || parts[0]?.[1] || 'N'}`.toUpperCase();
  }

  async function token() {
    // El demo debe ser una sesión estrictamente anónima. Un navegador que ya
    // tenga Firebase Auth no puede heredar permisos ni mutaciones de esa cuenta.
    if (window.__isDemoMode) return '';
    const user = window.__auth?.currentUser || window.__currentUser;
    return user ? user.getIdToken() : '';
  }

  // Si el servidor indica que esta sesión pertenece a una cuenta eliminada,
  // se cierra esa sesión y se abre directamente el registro. La pantalla de
  // acceso vuelve a cerrar cualquier sesión persistida antes de escuchar Auth,
  // así que una credencial vieja nunca puede devolver al usuario al panel.
  let accountDeletedHandled = false;
  async function handleAccountDeleted() {
    if (accountDeletedHandled || window.__isDemoMode) return false;
    accountDeletedHandled = true;

    document.querySelector('.credit-wallet-modal')?.remove();
    document.body.classList.remove('has-credit-wallet');

    try { sessionStorage.setItem('icadem:account-deleted', '1'); } catch (_) {}

    try {
      if (typeof window.__signOut === 'function') await window.__signOut();
      else if (typeof window.__auth?.signOut === 'function') await window.__auth.signOut();
    } catch (_) {
      // El acceso repite el cierre antes de registrar el listener de Firebase.
    }
    window.location.replace('vip-auth.html?tab=register&deleted=1');
    return true;
  }

  async function request(path, options) {
    const method = options?.method || 'GET';
    const perform = async authToken => {
      const config = {
        method,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      };
      if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
      if (options?.body !== undefined) {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(options.body);
      }
      const response = await fetch(`${API}${path}`, config);
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    let authToken = await token();
    let { response, data } = await perform(authToken);

    // Los 410 son almacenables por algunos navegadores. Antes de invalidar una
    // sesión nueva, confirmamos una vez más con token renovado y sin caché.
    if (method === 'GET' && response.status === 410 && data.code === 'account-deleted' && !window.__isDemoMode) {
      const user = window.__auth?.currentUser || window.__currentUser;
      if (user) authToken = await user.getIdToken(true).catch(() => authToken);
      ({ response, data } = await perform(authToken));
    }
    if (!response.ok) {
      if (response.status === 410 && data.code === 'account-deleted') await handleAccountDeleted();
      const error = new Error(data.error || 'No pudimos completar la solicitud.');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function announce(message) {
    let live = document.getElementById('icadem-platform-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'icadem-platform-live';
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
  }

  function mexicoDateKey(value) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(value || new Date()).reduce((all, part) => ({ ...all, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function activateDialogA11y(root, onEscape) {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inerted = Array.from(document.body.children).filter(element => element !== root && element.id !== 'icadem-platform-live' && !element.matches('script,style,link') && !element.hasAttribute('inert'));
    inerted.forEach(element => element.setAttribute('inert', ''));
    const focusables = () => Array.from(root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(element => !element.hidden && element.getClientRects().length);
    const onKeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onEscape(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('keydown', onKeydown);
      inerted.forEach(element => element.removeAttribute('inert'));
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }

  function showNotice(title, message, kind) {
    const old = document.querySelector('.platform-notice');
    old?.remove();
    const el = document.createElement('div');
    el.className = `platform-notice platform-notice--${kind || 'info'}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<strong>${esc(title)}</strong><span>${esc(message || '')}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function applyIdentity(payload) {
    if (!payload?.profile || !window.UserState) return;
    const profile = payload.profile;
    const directory = payload.directory || {};
    const state = window.UserState;
    state.nombre = profile.displayName || state.nombre;
    state.displayName = state.nombre;
    state.authPhotoURL = profile.authPhotoURL || state.authPhotoURL || '';
    state.photoURL = state.authPhotoURL || profile.photoURL || directory.foto || state.photoURL || '';
    state.iniciales = directory.iniciales || initials(state.nombre);
    state.providerIds = profile.providerIds || [];
    state.customName = profile.customName || state.customName || '';
    state.profileComplete = profile.profileComplete === true;
    state.freeCourseId = profile.freeCourseId || state.freeCourseId || '';
    state.freeCourseOfferSeen = profile.freeCourseOfferSeen === true;
    state.profileIntakeSeen = profile.profileIntakeSeen === true || state.profileIntakeSeen === true;
    state.hasWhatsapp = profile.hasWhatsapp === true;
    state.theme = profile.theme === 'night' || profile.theme === 'day' ? profile.theme : '';
    state.identityReady = true;
    state.credits = payload.credits || state.credits || { balance: 0 };
    state.directoryProfile = directory;
    window.__refreshAvatarCache?.();
    if (payload.membership && state.modo !== 'invitado') {
      state.modo = payload.membership.active ? 'vip' : 'sin-membresia';
      state.plan = payload.membership.active ? (payload.membership.plan || state.plan || 'mensual') : null;
      state.membership = { ...(state.membership || {}), activo: payload.membership.active === true, plan: payload.membership.plan || null };
    }

    const paintAvatar = element => {
      if (!element) return;
      element.classList.toggle('has-photo', Boolean(state.photoURL));
      element.innerHTML = state.photoURL
        ? `<img src="${esc(window.__avatarSrc?.(state.photoURL) || state.photoURL)}" alt="Foto de ${esc(state.nombre)}" referrerpolicy="no-referrer">`
        : esc(state.iniciales);
    };
    document.querySelectorAll('.avatar__circle,.perfil-hero__avatar,.foro-composer__avatar').forEach(paintAvatar);
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = state.nombre; });
    document.querySelectorAll('[data-credit-balance]').forEach(el => { el.textContent = String(state.credits.balance || 0); });
    window.__applyUserState?.();
    document.dispatchEvent(new CustomEvent('icadem:identity-ready', { detail: payload }));
  }

  let lastProgressLoad = 0;
  async function loadLearningProgress() {
    if (window.__isDemoMode) return null;
    lastProgressLoad = Date.now();
    const data = await request('/api/learning/progress');
    if (typeof window.__mergeServerProgress === 'function') window.__mergeServerProgress(data.courses || {});
    else window.__pendingServerProgress = data.courses || {};
    if (data.credits && window.UserState) {
      window.UserState.credits = { ...(window.UserState.credits || {}), ...data.credits };
    }
    document.dispatchEvent(new CustomEvent('icadem:progress-ready', { detail: data }));
    return data;
  }

  let identityPromise = null;
  async function syncIdentity(force) {
    if (window.__isDemoMode) return null;
    if (identityPromise && !force) return identityPromise;
    const currentUser = window.__auth?.currentUser || window.__currentUser;
    const googleProvider = (currentUser?.providerData || []).find(provider => provider.providerId === 'google.com');
    identityPromise = request('/api/identity/sync', { method: 'POST', body: { googlePhotoURL: googleProvider?.photoURL || '' } })
      .then(async data => {
        applyIdentity(data);
        // El avance se reintenta si falla (red móvil inestable): sin él, otro
        // dispositivo no vería las clases completadas.
        for (const wait of [0, 2500, 6000]) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          try { await loadLearningProgress(); break; }
          catch (error) { console.warn('[ICADEM progress]', error.message); }
        }
        return data;
      })
      .catch(error => {
        console.warn('[ICADEM identity]', error.message);
        identityPromise = null;
        return null;
      });
    return identityPromise;
  }

  async function loadDirectory(filters) {
    const params = new URLSearchParams({ pageSize: '100', ...(filters || {}) });
    return request(`/api/directory?${params}`);
  }

  async function loadRanking() {
    const data = await request('/api/ranking');
    return data;
  }

  async function loadCourseCatalog() {
    return request('/api/courses/catalog');
  }

  async function loadLibrary() {
    return request('/api/library');
  }

  async function redeemBook(bookId) {
    const data = await request('/api/library/redeem', {
      method: 'POST',
      body: { bookId: String(bookId || '') }
    });
    const nextBalance = Number(data.balance ?? data.newBalance);
    if (window.UserState?.credits && Number.isFinite(nextBalance)) {
      publishCredits({ ...window.UserState.credits, balance: nextBalance }, { source: 'library-redemption' });
    }
    creditWalletCache = null;
    return data;
  }

  async function loadMaterials() {
    return request('/api/materials');
  }

  function syncCreditSnapshot(credits, meta) {
    return publishCredits(credits, meta);
  }

  async function redeemMaterial(materialId) {
    const data = await request('/api/materials/redeem', {
      method: 'POST',
      body: { materialId: String(materialId || '') }
    });
    const nextBalance = Number(data.balance ?? data.newBalance ?? data.credits?.balance);
    if (window.UserState?.credits && Number.isFinite(nextBalance)) {
      publishCredits({ ...window.UserState.credits, balance: nextBalance }, { source: 'material-redemption' });
    }
    creditWalletCache = null;
    return data;
  }

  async function selectFreeCourse(courseId) {
    const selectedId = String(courseId || '').trim();
    if (!selectedId) throw new Error('Elige un curso para continuar.');
    if (window.__isDemoMode) {
      localStorage.setItem('icadem:demo:free-course', selectedId);
      if (window.UserState) { window.UserState.freeCourseId = selectedId; window.UserState.freeCourseOfferSeen = true; }
      document.dispatchEvent(new CustomEvent('icadem:free-course-selected', { detail: { courseId: selectedId, demo: true } }));
      return { ok: true, courseId: selectedId, newlySelected: true, demo: true, freeClasses: 4, freeMaterials: 1 };
    }
    const data = await request('/api/free-course', { method: 'POST', body: { courseId: selectedId } });
    if (window.UserState) { window.UserState.freeCourseId = data.courseId; window.UserState.freeCourseOfferSeen = true; }
    document.dispatchEvent(new CustomEvent('icadem:free-course-selected', { detail: data }));
    return data;
  }

  async function markFreeCourseOfferSeen() {
    if (window.UserState) window.UserState.freeCourseOfferSeen = true;
    if (window.__isDemoMode) return { ok: true, offerSeen: true, demo: true };
    return request('/api/free-course/offer-seen', { method: 'POST', body: {} });
  }

  async function claimExperience(experience, version) {
    if (window.__isDemoMode) {
      return { ok: true, claimed: true, experience, version, demo: true };
    }
    return request('/api/credits/experience/claim', {
      method: 'POST',
      body: { experience: String(experience || ''), version: String(version || '') }
    });
  }

  async function markMembershipWelcomeSeen() {
    if (window.__isDemoMode) return { ok: true, demo: true };
    return request('/api/membership/welcome-seen', { method: 'POST', body: {} });
  }

  async function deleteForumPost(postId) {
    const id = String(postId || '').trim();
    if (!id) throw new Error('Publicación inválida.');
    return request(`/api/forum/posts/${encodeURIComponent(id)}/delete`, { method: 'POST', body: {} });
  }

  async function toggleForumLike(postId) {
    const id = String(postId || '').trim();
    if (!id) throw new Error('Publicación inválida.');
    return request(`/api/forum/posts/${encodeURIComponent(id)}/like`, { method: 'POST', body: {} });
  }

  async function createForumPost(post) {
    return request('/api/forum/posts', {
      method: 'POST',
      body: {
        texto: String(post?.texto || '').trim(),
        imagen: typeof post?.imagen === 'string' ? post.imagen : null
      }
    });
  }

  async function createForumComment(postId, comment) {
    const id = String(postId || '').trim();
    if (!id) throw new Error('Publicación inválida.');
    return request(`/api/forum/posts/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: { texto: String(comment?.texto || '').trim() }
    });
  }

  async function deleteForumComment(postId, commentId) {
    const post = String(postId || '').trim();
    const comment = String(commentId || '').trim();
    if (!post || !comment) throw new Error('Comentario inválido.');
    return request(`/api/forum/posts/${encodeURIComponent(post)}/comments/${encodeURIComponent(comment)}/delete`, {
      method: 'POST',
      body: {}
    });
  }

  function demoCreditLedgerKey() {
    const account = window.UserState?.uid || window.UserState?.email || 'guest';
    return `icadem:demo:credit-ledger:${account}`;
  }

  function demoCreditIdsKey() {
    const account = window.UserState?.uid || window.UserState?.email || 'guest';
    return `icadem:demo:credit-ids:${account}`;
  }

  function demoCreditStatsKey() {
    const account = window.UserState?.uid || window.UserState?.email || 'guest';
    return `icadem:demo:credit-stats:${account}`;
  }

  function readDemoCreditLedger() {
    try {
      const items = JSON.parse(localStorage.getItem(demoCreditLedgerKey()) || '[]');
      return Array.isArray(items) ? items.slice(0, 40) : [];
    } catch (_) { return []; }
  }

  function readDemoCreditIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(demoCreditIdsKey()) || 'null');
      if (Array.isArray(saved)) return saved;
    } catch (_) {}
    const migrated = readDemoCreditLedger().map(item => item.id).filter(Boolean);
    try { localStorage.setItem(demoCreditIdsKey(), JSON.stringify(migrated)); } catch (_) {}
    return migrated;
  }

  function readDemoCreditStats() {
    try {
      const saved = JSON.parse(localStorage.getItem(demoCreditStatsKey()) || 'null');
      if (saved && typeof saved === 'object') return { earned: Number(saved.earned) || 0, spent: Number(saved.spent) || 0 };
    } catch (_) {}
    const ledger = readDemoCreditLedger();
    const migrated = {
      earned: ledger.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0),
      spent: ledger.reduce((sum, item) => sum + Math.max(0, -(Number(item.amount) || 0)), 0)
    };
    try { localStorage.setItem(demoCreditStatsKey(), JSON.stringify(migrated)); } catch (_) {}
    return migrated;
  }

  function publishCredits(credits, meta) {
    const normalized = {
      balance: Number(credits?.balance) || 0,
      lifetimeEarned: Number(credits?.lifetimeEarned) || 0,
      lifetimeSpent: Number(credits?.lifetimeSpent) || 0
    };
    if (window.UserState) window.UserState.credits = { ...(window.UserState.credits || {}), ...normalized };
    document.querySelectorAll('[data-credit-balance]').forEach(element => {
      element.textContent = String(normalized.balance);
    });
    document.dispatchEvent(new CustomEvent('icadem:credits-changed', { detail: { credits: normalized, ...(meta || {}) } }));
    return normalized;
  }

  function applyDemoCreditMovement(amount, details) {
    const numericAmount = Number(amount) || 0;
    const ledger = readDemoCreditLedger();
    const rewardedIds = readDemoCreditIds();
    const movementId = String(details?.id || `demo:${Date.now()}`);
    const existing = ledger.find(item => item.id === movementId);
    const previousBalance = Number(localStorage.getItem('icadem:demo:credits') || 200);
    if (rewardedIds.includes(movementId)) return { awarded: false, reward: 0, previousBalance, newBalance: previousBalance, movement: existing || null };
    if (numericAmount < 0 && previousBalance + numericAmount < 0) throw new Error('Créditos insuficientes para completar este canje.');
    const newBalance = previousBalance + numericAmount;
    const movement = {
      id: movementId,
      amount: numericAmount,
      direction: numericAmount < 0 ? 'spend' : 'earn',
      type: String(details?.type || 'demo-credit'),
      label: String(details?.label || (numericAmount < 0 ? 'Canje de recompensa' : 'Créditos obtenidos')),
      detail: String(details?.detail || ''),
      createdAt: new Date().toISOString()
    };
    ledger.unshift(movement);
    localStorage.setItem(demoCreditLedgerKey(), JSON.stringify(ledger.slice(0, 40)));
    localStorage.setItem(demoCreditIdsKey(), JSON.stringify([movementId, ...rewardedIds].slice(0, 500)));
    localStorage.setItem('icadem:demo:credits', String(newBalance));
    const stats = readDemoCreditStats();
    const nextStats = { earned: stats.earned + Math.max(0, numericAmount), spent: stats.spent + Math.max(0, -numericAmount) };
    localStorage.setItem(demoCreditStatsKey(), JSON.stringify(nextStats));
    publishCredits({
      balance: newBalance,
      lifetimeEarned: nextStats.earned,
      lifetimeSpent: nextStats.spent
    }, { source: movement.type, movement });
    creditWalletCache = null;
    return { awarded: true, reward: Math.max(0, numericAmount), charged: Math.max(0, -numericAmount), previousBalance, newBalance, movement };
  }

  let creditWalletCache = null;
  let creditWalletPromise = null;

  function demoCreditWallet() {
    const ledger = readDemoCreditLedger();
    const balance = Number(localStorage.getItem('icadem:demo:credits') || 200);
    const stats = readDemoCreditStats();
    return {
      ok: true,
      credits: { balance, lifetimeEarned: stats.earned, lifetimeSpent: stats.spent },
      recentMovements: ledger.slice(0, 12),
      earnRules: [
        { id: 'welcome', label: 'Regalo de bienvenida', amount: 200, note: 'Se acredita una sola vez al crear tu cuenta.' },
        { id: 'retos', label: 'Supera un reto', amount: RETO_CREDITS, note: 'Una recompensa por reto.' },
        { id: 'class-games', label: 'Completa un juego de clase', amount: CLASS_CREDITS, note: 'Una sola recompensa por clase.' },
        { id: 'arcade', label: 'Entrena en Juegos ICADEM', amount: RETO_CREDITS, note: 'Una recompensa por dinámica.' }
      ],
      destinations: [
        { id: 'materials', label: 'Materiales profesionales', description: 'Canjea herramientas descargables por 100 créditos cada una.', available: true, section: 'materiales', count: 7 },
        { id: 'library', label: 'Biblioteca profesional', description: 'Canjea referencias que conservarás en tu cuenta.', available: true, section: 'libros', count: 6 }
      ],
      redemptions: { books: 0, materials: 0 },
      demo: true
    };
  }

  async function loadCreditWallet(force) {
    if (window.__isDemoMode) {
      const data = demoCreditWallet();
      publishCredits(data.credits, { source: 'wallet-demo' });
      return data;
    }
    const fresh = creditWalletCache && Date.now() - creditWalletCache.at < 15000;
    if (fresh && !force) return creditWalletCache.data;
    if (creditWalletPromise && !force) return creditWalletPromise;
    creditWalletPromise = request('/api/credits/wallet').then(data => {
      creditWalletCache = { at: Date.now(), data };
      publishCredits(data.credits, { source: 'wallet' });
      return data;
    }).finally(() => { creditWalletPromise = null; });
    return creditWalletPromise;
  }

  function formatMovementDate(value) {
    if (!value) return 'Reciente';
    try {
      return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    } catch (_) { return 'Reciente'; }
  }

  function walletMarkup(data) {
    const credits = data?.credits || { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    const movements = Array.isArray(data?.recentMovements) ? data.recentMovements : [];
    const rules = Array.isArray(data?.earnRules) ? data.earnRules : [];
    const destinations = Array.isArray(data?.destinations) ? data.destinations : [];
    return `<div class="credit-wallet-modal__grid">
      <section class="credit-vault">
        <span class="credit-vault__gem credit-vault__gem--bag" aria-hidden="true"><img src="assets/mascotas/cartera-creditos.webp?v=1" alt="" width="320" height="320" decoding="async" draggable="false"></span>
        <div class="credit-vault__copy"><small>Mi cartera ICADEM</small><strong><b data-credit-balance>${Number(credits.balance) || 0}</b><em> créditos</em></strong><p>Tu saldo profesional, validado y listo para canjear.</p></div>
        <div class="credit-vault__stats"><span><b>${Number(credits.lifetimeEarned) || 0}</b> ganados</span><span><b>${Number(credits.lifetimeSpent) || 0}</b> canjeados</span></div>
      </section>
      <section class="credit-wallet-panel credit-wallet-panel--earn"><header><span>Cómo sumar créditos</span><small>Cada premio se valida una sola vez</small></header><div>${rules.map(rule => `<article><i>+${Number(rule.amount) || 0}</i><span><strong>${esc(rule.label)}</strong><small>${esc(rule.note)}</small></span></article>`).join('')}</div></section>
      <section class="credit-wallet-panel credit-wallet-panel--rewards"><header><span>Recompensas</span><small>Tu saldo, tus elecciones</small></header><div>${destinations.map(item => `<button type="button" ${item.available ? `data-wallet-destination="${esc(item.section || '')}"` : 'disabled'}><span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span><em>${item.available ? 'Explorar' : 'Próximamente'}</em></button>`).join('')}</div></section>
      <section class="credit-wallet-panel credit-wallet-panel--history"><header><span>Movimientos recientes</span><small>${movements.length ? `${movements.length} registrados` : 'Sin movimientos todavía'}</small></header><div>${movements.length ? movements.map(item => `<article><span class="credit-movement__icon credit-movement__icon--${Number(item.amount) < 0 ? 'spend' : 'earn'}">${Number(item.amount) < 0 ? '−' : '+'}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.detail || '')} · ${esc(formatMovementDate(item.createdAt))}</small></span><b class="credit-movement__amount credit-movement__amount--${Number(item.amount) < 0 ? 'spend' : 'earn'}">${Number(item.amount) > 0 ? '+' : ''}${Number(item.amount) || 0}</b></article>`).join('') : '<p class="credit-wallet-empty">Supera un reto o un juego de clase y aquí verás el movimiento.</p>'}</div></section>
    </div>`;
  }

  async function openCreditWallet() {
    document.querySelector('.credit-wallet-modal')?.remove();
    const root = document.createElement('div');
    root.className = 'credit-wallet-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'credit-wallet-title');
    root.innerHTML = `<div class="credit-wallet-modal__veil" data-credit-wallet-close></div><section class="credit-wallet-modal__shell"><header><div><span>Créditos ICADEM</span><h2 id="credit-wallet-title">Tu cartera profesional</h2></div><button type="button" data-credit-wallet-close aria-label="Cerrar cartera">×</button></header><div class="credit-wallet-modal__body"><div class="credit-wallet-loading">Sincronizando tu saldo…</div></div></section>`;
    document.body.appendChild(root);
    document.body.classList.add('has-credit-wallet');
    let releaseA11y = () => {};
    const close = () => { root.remove(); document.body.classList.remove('has-credit-wallet'); releaseA11y(); };
    releaseA11y = activateDialogA11y(root, close);
    root.querySelectorAll('[data-credit-wallet-close]').forEach(button => button.addEventListener('click', close));
    root.querySelector('[data-credit-wallet-close]:not(.credit-wallet-modal__veil)')?.focus();
    try {
      const data = await loadCreditWallet(true);
      if (!root.isConnected) return;
      root.querySelector('.credit-wallet-modal__body').innerHTML = walletMarkup(data);
      root.querySelectorAll('[data-wallet-destination]').forEach(button => button.addEventListener('click', () => {
        const section = button.dataset.walletDestination;
        close();
        if (section) location.hash = `#${section}`;
      }));
    } catch (error) {
      if (!root.isConnected) return;
      if (error?.status === 410 && error?.data?.code === 'account-deleted') { close(); return; }
      root.querySelector('.credit-wallet-modal__body').innerHTML = `<div class="credit-wallet-error"><strong>No pudimos sincronizar tu cartera.</strong><span>${esc(error.message)}</span><button type="button" data-wallet-retry>Reintentar</button></div>`;
      root.querySelector('[data-wallet-retry]')?.addEventListener('click', () => { close(); openCreditWallet(); });
    }
  }

  async function markProfileIntakeSeen() {
    if (window.__isDemoMode) return { ok: true };
    return request('/api/profile/intake-seen', { method: 'POST', body: {} });
  }

  async function saveProfile(profile) {
    const data = await request('/api/profile', { method: 'PATCH', body: profile });
    applyIdentity(data);
    return data;
  }

  function localChallenge(type, title) {
    const selected = type || PRACTICE_TYPES[Math.floor(Math.random() * PRACTICE_TYPES.length)];
    const words = ['CRITERIO', 'PROCESO', 'CONTROL'];
    const pairs = [
      { id: 'a', left: 'Criterio', right: 'Decidir con fundamento' },
      { id: 'b', left: 'Proceso', right: 'Secuencia ordenada de acciones' },
      { id: 'c', left: 'Control', right: 'Medida que reduce errores' }
    ];
    const local = {
      ok: true, local: true, challengeId: `practice-${Date.now()}`, type: selected,
      title: title || GAME_LABELS[selected], objective: 'Resuelve la actividad y comprueba tu criterio.',
      instructions: ['Observa la consigna', 'Resuelve con calma', 'Comprueba tu respuesta'], reward: 5,
      balance: Number(localStorage.getItem('icadem:demo:credits') || 200)
    };
    if (DEMO_PRO[selected]) {
      const board = DEMO_PRO[selected]();
      local.content = board.content;
      local.solution = board.solution;
      return local;
    }
    if (selected === 'quiz') {
      local.content = { questions: DEMO_QUIZ.map(({ answer, ...question }) => question), passingScore: 70, bankSize: 20 };
      local.solution = { answers: Object.fromEntries(DEMO_QUIZ.map(question => [question.id, question.answer])), minCorrect: 9, total: 12 };
    } else if (selected === 'crossword' || selected === 'guess') {
      local.content = { clue: 'Capacidad de decidir con fundamento', length: 8, maxAttempts: 3 };
      local.solution = { answer: 'CRITERIO' };
    } else if (selected === 'memory') {
      local.content = { pairs };
      local.solution = { pairs: pairs.map(p => p.id).sort() };
    } else if (selected === 'classify') {
      const assignments = { c1: 'Concepto', a1: 'Aplicación', c2: 'Concepto', a2: 'Aplicación' };
      local.content = { categories: ['Concepto', 'Aplicación'], items: [
        { id: 'a1', label: 'Comparar registros para explicar diferencias' },
        { id: 'c2', label: 'Flujo de efectivo' },
        { id: 'c1', label: 'Conciliación' },
        { id: 'a2', label: 'Medir entradas y salidas de dinero' }
      ] };
      local.solution = { assignments };
    } else if (selected === 'puzzle') {
      local.content = { size: 3, title: title || 'Criterio profesional', image: '' };
      local.solution = { order: [0,1,2,3,4,5,6,7,8] };
    } else {
      const size = 11;
      const grid = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => 'ABCDEFGHIJ'[(row * 3 + col * 7) % 10]));
      words.forEach((word, index) => {
        const row = 1 + index * 3;
        [...word].forEach((letter, col) => { grid[row][col + 1] = letter; });
      });
      local.content = { grid, words, size };
      local.solution = { words: words.slice().sort() };
    }
    return local;
  }

  function demoRetoStatusKey() {
    const account = window.UserState?.uid || window.UserState?.email || 'guest';
    return `icadem:demo:reto-status:${account}`;
  }

  function readDemoRetoStatus() {
    try {
      const raw = JSON.parse(localStorage.getItem(demoRetoStatusKey()) || '{}');
      return {
        used: Array.isArray(raw.used) ? raw.used : [],
        dailyDate: String(raw.dailyDate || ''),
        catalogTypes: Array.isArray(raw.catalogTypes) ? raw.catalogTypes : []
      };
    } catch (_) {
      return { used: [], dailyDate: '', catalogTypes: [] };
    }
  }

  function recordDemoReto(challenge) {
    if (challenge?.scope !== 'reto') return;
    const status = readDemoRetoStatus();
    const experienceId = String(challenge.experienceId || challenge.type || '');
    if (experienceId === 'pro') return;
    if (experienceId === 'catalog') {
      if (!status.catalogTypes.includes(challenge.type)) status.catalogTypes.push(challenge.type);
    } else if (experienceId === 'daily') {
      status.dailyDate = mexicoDateKey();
    } else if (experienceId && !status.used.includes(experienceId)) {
      status.used.push(experienceId);
    }
    localStorage.setItem(demoRetoStatusKey(), JSON.stringify(status));
  }

  function demoRetoAlreadyUsed(experienceId, type) {
    const status = readDemoRetoStatus();
    const today = mexicoDateKey();
    if (experienceId === 'catalog') return status.catalogTypes.includes(type);
    if (experienceId === 'pro') { try { return JSON.parse(localStorage.getItem(demoProStatusKey()) || '[]').includes(type); } catch (_) { return false; } }
    if (experienceId === 'daily') return status.dailyDate === today;
    return status.used.includes(experienceId);
  }

  function modalShell(challenge, onClose) {
    document.querySelector('.learning-game')?.remove();
    const modal = document.createElement('div');
    modal.className = 'learning-game learning-game--v3';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'learning-game-title');
    modal.setAttribute('aria-label', challenge?.scope === 'reto' ? 'Reto profesional ICADEM' : 'Actividad de cierre ICADEM');
    modal.innerHTML = `
      <div class="learning-game__veil" data-game-close></div>
      <section class="learning-game__panel">
        <header class="learning-game__header">
          <div class="learning-game__brand"><span>ICADEM</span><small>${challenge?.scope === 'reto' ? 'Reto profesional' : 'Actividad de cierre'}</small></div>
          <div class="learning-game__step" aria-label="Progreso"><i class="is-current"></i><i></i><i></i></div>
          <button class="learning-game__close" type="button" aria-label="Cerrar actividad">×</button>
        </header>
        <div class="learning-game__content" id="learning-game-content"></div>
      </section>`;
    document.body.appendChild(modal);
    document.body.classList.add('has-learning-game');
    let releaseA11y = () => {};
    const close = () => {
      modal.remove();
      document.body.classList.remove('has-learning-game');
      releaseA11y();
      onClose?.();
    };
    releaseA11y = activateDialogA11y(modal, close);
    modal.querySelector('.learning-game__close').addEventListener('click', close);
    modal.querySelector('[data-game-close]')?.addEventListener('click', close);
    modal.querySelector('.learning-game__close').focus();
    return { modal, content: modal.querySelector('#learning-game-content'), close };
  }

  function setStep(modal, step) {
    modal.querySelectorAll('.learning-game__step i').forEach((el, index) => {
      el.classList.toggle('is-current', index === step - 1);
      el.classList.toggle('is-done', index < step - 1);
    });
  }

  function introView(challenge, shell, start) {
    const typeLabel = GAME_LABELS[challenge.type] || 'Actividad';
    const meta = GAME_META[challenge.type] || { eyebrow: typeLabel, icon: 'i-trophy', duration: '2 min' };
    shell.content.innerHTML = `
      <div class="game-intro">
        <section class="game-intro__main">
          <span class="game-intro__icon" aria-hidden="true"><svg class="ic"><use href="#${esc(meta.icon)}"/></svg></span>
          <span class="game-kicker">${esc(meta.eyebrow || typeLabel)}</span>
          <h2 id="learning-game-title">${esc(challenge.title || meta.title || 'Cierre de clase')}</h2>
          <p>${esc(challenge.objective || 'Completa la actividad para continuar.')}</p>
          <div class="game-intro__facts"><span>${esc(meta.duration || '2 min')}</span><span>${esc(typeLabel)}</span></div>
          <button class="game-primary" type="button" data-game-start>Comenzar reto <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></button>
        </section>
        <aside class="game-intro__brief">
          <header><small>Antes de empezar</small><strong>Tu ruta en 3 pasos</strong></header>
          <ol>${(challenge.instructions || []).slice(0, 3).map((line, i) => `<li><b>0${i + 1}</b><span>${esc(line)}</span></li>`).join('')}</ol>
          <div class="game-intro__reward"><span>Recompensa verificada</span><strong>${challenge.reward ? `+${challenge.reward} créditos` : 'Práctica libre'}</strong></div>
        </aside>
      </div>`;
    const startButton = shell.content.querySelector('[data-game-start]');
    startButton.addEventListener('click', start);
    requestAnimationFrame(() => startButton.focus());
  }

  function gameFrame(challenge, shell, inner) {
    setStep(shell.modal, 2);
    shell.content.innerHTML = `
      <div class="game-run">
        <div class="game-run__heading">
          <span><span class="game-kicker">${esc(GAME_LABELS[challenge.type])}</span><h2 id="learning-game-title" tabindex="-1">${esc(challenge.title)}</h2></span>
          <small>Resuelve con calma · la ayuda completa un paso sin penalización</small>
        </div>
        <section class="game-stage">
          <div class="game-status" aria-live="polite"></div>
          <div class="game-board">${inner}</div>
          <div class="game-assist" data-game-assist hidden><span>¿Te atoraste? Te ayudamos a cerrar esta actividad sin perder tu avance.</span><button class="game-secondary" type="button" data-game-help>Ayúdame a continuar</button></div>
          <div class="game-actions"><button class="game-secondary" type="button" data-game-reset>Reiniciar</button><button class="game-primary" type="button" data-game-check>Comprobar <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></button></div>
        </section>
      </div>`;
    const heading = shell.content.querySelector('#learning-game-title');
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !shell.content.contains(active)) heading?.focus();
    });
    return {
      board: shell.content.querySelector('.game-board'),
      status: shell.content.querySelector('.game-status'),
      check: shell.content.querySelector('[data-game-check]'),
      reset: shell.content.querySelector('[data-game-reset]'),
      assist: shell.content.querySelector('[data-game-assist]'),
      help: shell.content.querySelector('[data-game-help]')
    };
  }

  function localStepHint(type, solution, proof, hintIndex) {
    const list = value => Array.isArray(value) ? value.map(String) : [];
    if (type === 'crossword' && solution.answers) {
      for (const [wordId, answer] of Object.entries(solution.answers)) {
        const given = normalize(proof.answers?.[wordId]);
        if (given === answer) continue;
        let index = 0; while (index < answer.length && given[index] === answer[index]) index++;
        return { kind: 'crossword-letter', wordId, index: Math.min(index, answer.length - 1), letter: answer[Math.min(index, answer.length - 1)] };
      }
    }
    if ((type === 'crossword' || type === 'guess') && solution.answer) {
      const answer = normalize(solution.answer), given = normalize(proof.answer);
      let index = 0; while (index < answer.length && given[index] === answer[index]) index++;
      if (index < answer.length) return { kind: 'answer-letter', index, letter: answer[index], length: answer.length };
    }
    if (type === 'memory' || type === 'vmemory') {
      const done = new Set(list(proof.pairs)); const pair = solution.pairs?.find(id => !done.has(String(id)));
      if (pair != null) return { kind: 'memory-pair', pair: String(pair) };
    }
    if (type === 'wordsearch') {
      const done = new Set(list(proof.words).map(normalize)); const word = solution.words?.find(item => !done.has(normalize(item)));
      if (word) return { kind: 'wordsearch-word', word };
    }
    if (type === 'puzzle') {
      const order = list(proof.order).map(Number), slot = solution.order?.findIndex((piece, i) => order[i] !== Number(piece));
      if (slot >= 0) return { kind: 'puzzle-piece', slot, piece: Number(solution.order[slot]) };
    }
    if (type === 'order') {
      const order = list(proof.order), slot = solution.order?.findIndex((step, i) => order[i] !== String(step));
      if (slot >= 0) return { kind: 'order-step', slot, stepId: String(solution.order[slot]) };
    }
    if (type === 'classify' && solution.assignments) {
      const itemId = Object.keys(solution.assignments).find(id => proof.assignments?.[id] !== solution.assignments[id]);
      if (itemId) return { kind: 'classification', itemId, category: solution.assignments[itemId] };
    }
    if (type === 'quiz' && solution.answers) {
      const questionId = Object.keys(solution.answers).find(id => Number(proof.answers?.[id]) !== Number(solution.answers[id]));
      if (questionId) return { kind: 'quiz-answer', questionId, optionIndex: Number(solution.answers[questionId]) };
    }
    if (type === 'document') {
      const flagged = new Set(list(proof.flagged));
      const missing = solution.errors?.find(id => !flagged.has(String(id)));
      if (missing) return { kind: 'document-error', fieldId: String(missing) };
      const extra = [...flagged].find(id => !solution.errors.includes(id));
      if (extra) return { kind: 'document-remove', fieldId: String(extra) };
    }
    if (type === 'hazard') {
      const found = new Set(list(proof.found)); const itemId = solution.found?.find(id => !found.has(String(id)));
      if (itemId) return { kind: 'hazard-item', itemId: String(itemId) };
    }
    if (type === 'spot') {
      const answers = list(proof.answers), round = Math.min(answers.length, Math.max(0, (solution.answers?.length || 1) - 1));
      if (solution.answers?.[round] != null) return { kind: 'spot-zone', round, zone: String(solution.answers[round]) };
    }
    if (type === 'calc') {
      const steps = Array.isArray(solution.steps) ? solution.steps : [];
      return hintIndex < steps.length ? { kind: 'calc-step', text: String(steps[hintIndex]) } : { kind: 'calc-answer', value: String(solution.value), unit: String(solution.unit || '') };
    }
    return null;
  }

  function localCheckStep(type, solution, action) {
    const kind = String(action?.kind || '');
    if (type === 'classify' && kind === 'classification') {
      const correctCategory = solution.assignments?.[action.itemId];
      if (!correctCategory) return null;
      const correct = String(action.category) === String(correctCategory);
      return { kind, itemId: String(action.itemId), correct, ...(correct ? {} : { correctCategory }) };
    }
    if (type === 'crossword' && kind === 'crossword-letter') {
      const answer = solution.answers?.[action.wordId], index = Number(action.index);
      if (!answer || !Number.isInteger(index) || index < 0 || index >= answer.length) return null;
      return { kind, wordId: String(action.wordId), index, correct: normalize(action.letter).slice(0, 1) === answer[index] };
    }
    if (type === 'quiz' && kind === 'quiz-answer') {
      const correctOption = Number(solution.answers?.[action.questionId]);
      if (!Number.isInteger(correctOption)) return null;
      const correct = Number(action.optionIndex) === correctOption;
      return { kind, questionId: String(action.questionId), correct, ...(correct ? {} : { correctOption }) };
    }
    if (type === 'order' && kind === 'order') {
      const order = Array.isArray(action.order) ? action.order.map(String) : [];
      const positions = (solution.order || []).map((step, index) => order[index] === String(step));
      return { kind, correct: positions.every(Boolean), positions, correctCount: positions.filter(Boolean).length, total: positions.length };
    }
    if (type === 'document' && kind === 'document-field') {
      const fieldId = String(action.fieldId || ''), correct = (solution.errors || []).includes(fieldId);
      const tip = correct ? solution.tips?.find(item => String(item.id) === fieldId)?.tip : '';
      return { kind, fieldId, correct, ...(tip ? { tip } : {}) };
    }
    if (type === 'calc' && kind === 'calc-answer') {
      let raw = String(action.value || '').trim();
      if (!raw.includes('.') && /^-?\d+,\d{1,2}$/.test(raw)) raw = raw.replace(',', '.');
      const value = Number(raw.replace(/[$,\s]/g, ''));
      const correct = Number.isFinite(value) && Math.abs(value - Number(solution.value)) <= Number(solution.tolerance || 0);
      return { kind, correct, ...(correct ? {} : { hint: String(solution.steps?.[0] || 'Revisa los datos y la operación.') }) };
    }
    if (type === 'guess' && kind === 'answer') {
      const answer = normalize(action.answer), target = normalize(solution.answer);
      const exactPositions = Array.from(target).filter((letter, index) => answer[index] === letter).length;
      return { kind, correct: answer === target, exactPositions, length: target.length };
    }
    return null;
  }

  async function checkGameStep(challenge, action) {
    if (challenge.local) {
      const result = localCheckStep(challenge.type, challenge.solution || {}, action);
      if (!result) throw new Error('No pudimos revisar esta jugada.');
      return result;
    }
    return request('/api/games/check-step', { method: 'POST', body: { challengeId: challenge.challengeId, action } });
  }

  function enableStepHelp(challenge, frame, getProof, applyHint, label) {
    if (!frame.assist || !frame.help) return;
    let localHintIndex = 0;
    frame.assist.hidden = false;
    frame.assist.dataset.stepHelp = '1';
    const copy = frame.assist.querySelector('span');
    if (copy) copy.textContent = '¿Te atoraste? Cada toque completa un solo paso y no te quita avance ni créditos.';
    frame.help.textContent = `✦ ${label || 'Ayúdame'}`;
    frame.help.onclick = async () => {
      if (frame.help.disabled) return;
      frame.help.disabled = true;
      const previousStatus = frame.status.textContent;
      frame.status.classList.remove('is-error');
      frame.status.textContent = 'Preparando una ayuda…';
      try {
        const proof = getProof();
        const response = challenge.local
          ? { hint: localStepHint(challenge.type, challenge.solution || {}, proof, localHintIndex++) }
          : await request('/api/games/hint', { method: 'POST', body: { challengeId: challenge.challengeId, proof } });
        if (!response?.hint) throw new Error('Ya no hay más pasos por revelar. Comprueba tu respuesta.');
        applyHint(response.hint);
      } catch (error) {
        frame.status.textContent = error.message || previousStatus || 'No pudimos preparar la ayuda.';
        frame.status.classList.add('is-error');
      } finally {
        frame.help.disabled = false;
      }
    };
  }

  function runTextGame(challenge, shell, submit) {
    const c = challenge.content || {};
    const frame = gameFrame(challenge, shell, `
      <div class="concept-game">
        <span class="concept-game__label">Pista</span>
        <blockquote>${esc(c.clue || 'Concepto central de la clase')}</blockquote>
        <label for="concept-answer">Tu respuesta · ${Number(c.length) || ''} letras</label>
        <input id="concept-answer" autocomplete="off" autocapitalize="characters" maxlength="40" placeholder="Escribe el concepto">
        <div class="concept-game__slots" aria-hidden="true">${Array.from({length: Math.min(14, Number(c.length) || 8)}, () => '<i></i>').join('')}</div>
      </div>`);
    const input = frame.board.querySelector('input');
    let checking = false;
    frame.check.addEventListener('click', async () => {
      if (checking) return;
      const answer = input.value.trim();
      if (!answer) { frame.status.textContent = 'Escribe una respuesta antes de comprobar.'; frame.status.classList.add('is-error'); input.focus(); return; }
      checking = true; frame.check.disabled = true; input.classList.remove('is-answer-wrong', 'is-answer-correct');
      try {
        const result = await checkGameStep(challenge, { kind: 'answer', answer });
        if (!result.correct) {
          input.classList.add('is-answer-wrong');
          frame.status.textContent = `${result.exactPositions || 0} de ${result.length || c.length || 0} letras están en la posición correcta. Corrige e inténtalo otra vez.`;
          frame.status.classList.add('is-error');
          input.select();
          return;
        }
        input.classList.add('is-answer-correct'); frame.status.classList.remove('is-error'); frame.status.textContent = '¡Concepto correcto! Validando tu avance…';
        submit({ answer }, frame);
      } catch (error) {
        frame.status.textContent = error.message || 'No pudimos revisar la respuesta.'; frame.status.classList.add('is-error');
      } finally { checking = false; frame.check.disabled = false; }
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') frame.check.click(); });
    frame.reset.addEventListener('click', () => { input.value = ''; input.classList.remove('is-answer-wrong', 'is-answer-correct'); frame.status.textContent = ''; frame.status.classList.remove('is-error'); input.focus(); });
    enableStepHelp(challenge, frame, () => ({ answer: input.value }), hint => {
      if (hint.kind !== 'answer-letter') return;
      const chars = Array.from(normalize(input.value));
      chars[Number(hint.index) || 0] = hint.letter;
      input.value = chars.join('');
      frame.status.classList.remove('is-error');
      frame.status.textContent = `Colocamos la letra ${hint.letter}. Puedes pedir otra ayuda si la necesitas.`;
      input.focus();
    }, 'Revelar una letra');
    input.focus();
  }

  function runMemory(challenge, shell, submit) {
    const cards = [];
    (challenge.content?.pairs || []).forEach(pair => {
      cards.push({ key: `${pair.id}-left`, id: pair.id, text: pair.left });
      cards.push({ key: `${pair.id}-right`, id: pair.id, text: pair.right });
    });
    cards.sort(() => Math.random() - .5);
    const frame = gameFrame(challenge, shell, `<div class="memory-grid">${cards.map(card => `<button type="button" class="memory-card" data-key="${esc(card.key)}" data-pair="${esc(card.id)}" aria-label="Carta oculta"><span class="memory-card__back">ICA</span><span class="memory-card__front">${esc(card.text)}</span></button>`).join('')}</div>`);
    const pairColors = ['#e49b24','#2f82c7','#199b78','#815fc4','#d95778','#c5a012','#1695a7','#d66b35'];
    let open = [], matched = [], busy = false, submitted = false;
    const finish = () => {
      frame.status.classList.remove('is-error');
      frame.status.textContent = `${matched.length} de ${challenge.content.pairs.length} parejas encontradas.`;
      if (matched.length === challenge.content.pairs.length && !submitted) {
        submitted = true; frame.check.disabled = true;
        setTimeout(() => submit({ pairs: [...new Set(matched)] }, frame), 420);
      }
    };
    const completePair = (id, assisted) => {
      if (matched.includes(id)) return;
      const color = pairColors[matched.length % pairColors.length];
      open.forEach(x => x.classList.remove('is-open', 'is-wrong')); open = [];
      frame.board.querySelectorAll(`[data-pair="${CSS.escape(id)}"]`).forEach(card => {
        card.style.setProperty('--pair-color', color);
        card.classList.add('is-open', 'is-matched'); card.disabled = true;
        card.setAttribute('aria-label', `Pareja encontrada: ${card.textContent.trim()}`);
      });
      matched.push(id); announce(assisted ? 'Pareja encontrada con ayuda' : 'Pareja encontrada'); finish();
    };
    frame.board.querySelectorAll('.memory-card').forEach(card => card.addEventListener('click', () => {
      if (busy || card.classList.contains('is-open') || card.classList.contains('is-matched') || open.length === 2) return;
      card.classList.add('is-open'); card.setAttribute('aria-label', card.textContent.trim()); open.push(card);
      if (open.length === 2) {
        if (open[0].dataset.pair === open[1].dataset.pair) {
          const id = open[0].dataset.pair;
          setTimeout(() => completePair(id, false), 260);
        } else {
          busy = true; open.forEach(x => x.classList.add('is-wrong'));
          frame.status.textContent = 'Esas dos cartas no forman pareja. Intenta con otra combinación.'; frame.status.classList.add('is-error');
          setTimeout(() => { open.forEach(x => { x.classList.remove('is-open', 'is-wrong'); x.setAttribute('aria-label', 'Carta oculta'); }); open = []; busy = false; }, 760);
        }
      }
    }));
    frame.check.addEventListener('click', () => {
      if (matched.length < challenge.content.pairs.length) { frame.status.textContent = `Te faltan ${challenge.content.pairs.length - matched.length} parejas.`; frame.status.classList.add('is-error'); return; }
      submit({ pairs: [...new Set(matched)] }, frame);
    });
    frame.reset.addEventListener('click', () => runMemory(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ pairs: [...new Set(matched)] }), hint => {
      if (hint.kind === 'memory-pair') { completePair(String(hint.pair), true); frame.status.textContent = 'Pareja encontrada con ayuda. Puedes pedir otra cuando quieras.'; }
    }, 'Encontrar una pareja');
    finish();
  }

  function wordAt(grid, start, end) {
    const dr = Math.sign(end[0] - start[0]), dc = Math.sign(end[1] - start[1]);
    const distance = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]));
    if (!dr && !dc) return { word: grid[start[0]][start[1]], cells: [start.join('-')] };
    if (dr && dc && Math.abs(end[0] - start[0]) !== Math.abs(end[1] - start[1])) return null;
    if (!dr && start[0] !== end[0] || !dc && start[1] !== end[1]) return null;
    const cells = [], chars = [];
    for (let i = 0; i <= distance; i++) { const r = start[0] + dr * i, c = start[1] + dc * i; cells.push(`${r}-${c}`); chars.push(grid[r][c]); }
    return { word: chars.join(''), cells };
  }

  function runWordsearch(challenge, shell, submit) {
    const grid = (challenge.content?.grid || []).map(row => Array.from(row || ''));
    const words = (challenge.content?.words || []).map(String);
    const frame = gameFrame(challenge, shell, `
      <div class="wordsearch"><div class="wordsearch__list">${words.map((w, i) => `<span data-word-index="${i}"><i></i>${esc(w)}</span>`).join('')}</div>
      <div class="wordsearch__grid" style="--grid:${grid.length || 10}">${grid.flatMap((row,r) => Array.from(row || '').map((letter,c) => `<button type="button" data-cell="${r}-${c}" aria-label="Fila ${r+1}, columna ${c+1}, ${esc(letter)}">${esc(letter)}</button>`)).join('')}</div></div>`);
    let start = null, found = [], dragStart = null, suppressClick = false, submitted = false;
    const placementFor = rawWord => {
      const target = normalize(rawWord), directions = [[0,1],[1,0],[1,1],[-1,1],[0,-1],[1,-1],[-1,0],[-1,-1]];
      for (let r = 0; r < grid.length; r++) for (let c = 0; c < (grid[r]?.length || 0); c++) for (const [dr, dc] of directions) {
        const er = r + dr * (target.length - 1), ec = c + dc * (target.length - 1);
        if (er < 0 || er >= grid.length || ec < 0 || ec >= (grid[er]?.length || 0)) continue;
        const chars = [], cells = [];
        for (let i = 0; i < target.length; i++) { chars.push(grid[r + dr * i][c + dc * i]); cells.push(`${r + dr * i}-${c + dc * i}`); }
        if (normalize(chars.join('')) === target) return { word: rawWord, cells };
      }
      return null;
    };
    const placements = new Map(words.map(word => [normalize(word), placementFor(word)]));
    const clearPreview = () => frame.board.querySelectorAll('.is-select,.is-start').forEach(x => x.classList.remove('is-select', 'is-start'));
    const flashWrongCells = cells => {
      const elements = cells.map(id => frame.board.querySelector(`[data-cell="${id}"]`)).filter(Boolean);
      elements.forEach(cell => { cell.classList.remove('is-wrong-path'); void cell.offsetWidth; cell.classList.add('is-wrong-path'); });
      setTimeout(() => elements.forEach(cell => cell.classList.remove('is-wrong-path')), 820);
    };
    const preview = (from, to) => {
      frame.board.querySelectorAll('.is-select').forEach(x => x.classList.remove('is-select'));
      const result = wordAt(grid, from, to); if (!result) return;
      result.cells.forEach(id => frame.board.querySelector(`[data-cell="${id}"]`)?.classList.add('is-select'));
    };
    const finish = () => {
      frame.status.classList.remove('is-error');
      frame.status.textContent = `${found.length} de ${words.length} términos encontrados.`;
      if (found.length === words.length && !submitted) {
        submitted = true; frame.check.disabled = true;
        frame.status.textContent = '¡Encontraste todos los términos! Validando tu avance…';
        setTimeout(() => submit({ words: found.slice().sort() }, frame), 480);
      }
    };
    const markWord = (word, cells, assisted) => {
      const index = words.findIndex(item => normalize(item) === normalize(word));
      if (index < 0 || found.some(item => normalize(item) === normalize(words[index]))) return;
      const actual = words[index], color = index % 8;
      found.push(actual);
      cells.forEach(id => {
        const cell = frame.board.querySelector(`[data-cell="${id}"]`);
        if (cell) { cell.classList.add('is-found', `found-${color}`); cell.style.setProperty('--word-index', color); }
      });
      frame.board.querySelector(`[data-word-index="${index}"]`)?.classList.add('is-found', `found-${color}`);
      clearPreview(); announce(assisted ? `Término ${actual} encontrado con ayuda` : `Término ${actual} encontrado`); finish();
    };
    const select = cell => {
      const pos = cell.dataset.cell.split('-').map(Number);
      if (!start) { start = pos; cell.classList.add('is-start'); return; }
      const result = wordAt(grid, start, pos); start = null;
      clearPreview();
      if (!result) { frame.status.textContent = 'Elige una línea horizontal, vertical o diagonal.'; frame.status.classList.add('is-error'); return; }
      const forward = normalize(result.word), backward = [...forward].reverse().join('');
      const match = words.find(w => !found.some(item => normalize(item) === normalize(w)) && (normalize(w) === forward || normalize(w) === backward));
      if (!match) { flashWrongCells(result.cells); frame.status.textContent = 'Esa línea no forma un término pendiente. La marcamos en rojo para que pruebes otra dirección.'; frame.status.classList.add('is-error'); return; }
      frame.status.classList.remove('is-error'); markWord(match, result.cells, false);
    };
    frame.board.querySelectorAll('[data-cell]').forEach(cell => cell.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      select(cell);
    }));
    const gridEl = frame.board.querySelector('.wordsearch__grid');
    gridEl.addEventListener('pointerdown', event => {
      const cell = event.target.closest('[data-cell]');
      if (!cell) return;
      dragStart = cell.dataset.cell.split('-').map(Number);
      clearPreview(); cell.classList.add('is-start', 'is-select');
      try { gridEl.setPointerCapture(event.pointerId); } catch (_) {}
    });
    gridEl.addEventListener('pointermove', event => {
      if (!dragStart) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]');
      if (cell) preview(dragStart, cell.dataset.cell.split('-').map(Number));
    });
    gridEl.addEventListener('pointerup', event => {
      const endCell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]');
      try { gridEl.releasePointerCapture(event.pointerId); } catch (_) {}
      if (!dragStart || !endCell || dragStart.join('-') === endCell.dataset.cell) { dragStart = null; clearPreview(); return; }
      start = dragStart; dragStart = null; suppressClick = true; select(endCell);
    });
    gridEl.addEventListener('pointercancel', () => { dragStart = null; clearPreview(); });
    frame.check.addEventListener('click', () => {
      if (found.length < words.length) { frame.status.textContent = `Aún faltan ${words.length - found.length} términos. Puedes usar Ayúdame.`; frame.status.classList.add('is-error'); return; }
      submit({ words: found.slice().sort() }, frame);
    });
    frame.reset.addEventListener('click', () => runWordsearch(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ words: found.slice().sort() }), hint => {
      if (hint.kind !== 'wordsearch-word') return;
      const placement = placements.get(normalize(hint.word));
      if (placement) { markWord(hint.word, placement.cells, true); if (!submitted) frame.status.textContent = `Marcamos ${hint.word}. Puedes pedir otra ayuda si la necesitas.`; }
    }, 'Marcar una palabra');
    finish();
  }

  function runPuzzle(challenge, shell, submit) {
    const size = Number(challenge.content?.size) || 3;
    const order = Array.from({ length: size * size }, (_, i) => i).sort(() => Math.random() - .5);
    if (order.every((n, i) => n === i)) [order[0], order[1]] = [order[1], order[0]];
    const image = challenge.content?.image || '';
    const frame = gameFrame(challenge, shell, `<div class="puzzle-wrap${image ? ' has-ref' : ''}"><div class="puzzle-grid" style="--puzzle-size:${size}"></div>${image ? `<figure class="puzzle-ref"><img src="${encodeURI(image).replace(/'/g, '%27')}" alt="" decoding="async"><figcaption>Imagen de referencia</figcaption></figure>` : ''}</div><p class="game-hint">Toca dos piezas para intercambiarlas. En computadora también puedes arrastrarlas.</p>`);
    let selected = null, dragPos = null, moves = 0, submitted = false;
    const solvedCount = () => order.filter((piece, pos) => piece === pos).length;
    const finishIfReady = () => {
      const solved = solvedCount();
      frame.status.classList.remove('is-error');
      frame.status.textContent = `${solved} de ${order.length} piezas en su lugar · ${moves} movimientos.`;
      if (solved === order.length && !submitted) {
        submitted = true; frame.check.disabled = true;
        frame.status.textContent = '¡Escena reconstruida! Validando tu avance…';
        setTimeout(() => submit({ order: order.slice() }, frame), 480);
      }
    };
    const swap = (a, b) => {
      if (a === b || a < 0 || b < 0) return;
      [order[a], order[b]] = [order[b], order[a]]; moves += 1; selected = null; paint(); finishIfReady();
    };
    const paint = () => {
      const grid = frame.board.querySelector('.puzzle-grid');
      grid.innerHTML = order.map((piece, pos) => {
        const x = (piece % size) * 100 / Math.max(1, size - 1), y = Math.floor(piece / size) * 100 / Math.max(1, size - 1);
        const style = image ? `background-image:url('${encodeURI(image).replace(/'/g,'%27')}');background-position:${x}% ${y}%;background-size:${size * 100}% ${size * 100}%` : '';
        return `<button type="button" draggable="true" data-pos="${pos}" class="puzzle-piece${selected === pos ? ' is-selected' : ''}${piece === pos ? ' is-correct' : ''}" style="${style}" aria-label="Pieza ${piece + 1}${piece === pos ? ', en posición correcta' : ''}">${image ? '' : piece + 1}</button>`;
      }).join('');
      grid.querySelectorAll('[data-pos]').forEach(btn => btn.addEventListener('click', () => {
        const pos = Number(btn.dataset.pos);
        if (selected == null) selected = pos;
        else { swap(selected, pos); return; }
        paint();
      }));
      grid.querySelectorAll('[data-pos]').forEach(btn => {
        btn.addEventListener('dragstart', event => { dragPos = Number(btn.dataset.pos); event.dataTransfer?.setData('text/plain', btn.dataset.pos); });
        btn.addEventListener('dragover', event => event.preventDefault());
        btn.addEventListener('drop', event => { event.preventDefault(); const from = dragPos == null ? Number(event.dataTransfer?.getData('text/plain')) : dragPos; dragPos = null; swap(from, Number(btn.dataset.pos)); });
        btn.addEventListener('dragend', () => { dragPos = null; });
      });
    };
    paint();
    frame.check.addEventListener('click', () => {
      if (solvedCount() < order.length) { frame.status.textContent = `Hay ${order.length - solvedCount()} piezas fuera de lugar. Las verdes ya están correctas.`; frame.status.classList.add('is-error'); return; }
      submit({ order: order.slice() }, frame);
    });
    frame.reset.addEventListener('click', () => runPuzzle(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ order: order.slice() }), hint => {
      if (hint.kind !== 'puzzle-piece') return;
      const slot = Number(hint.slot), source = order.indexOf(Number(hint.piece));
      if (source >= 0 && source !== slot) swap(source, slot);
      if (!submitted) frame.status.textContent = 'Colocamos una pieza. Las piezas verdes ya están en su lugar.';
    }, 'Colocar una pieza');
    finishIfReady();
  }

  function runClassify(challenge, shell, submit) {
    const content = challenge.content || { categories: [], items: [] };
    const assignments = {};
    const frame = gameFrame(challenge, shell, `
      <div class="classify classify--guided">
        <div class="classify__progress"><span data-classify-step></span><i><b data-classify-bar></b></i></div>
        <div class="classify__active"><small>Tarjeta activa</small><button type="button" draggable="true" data-classify-card></button><span>Toca o arrastra hacia su categoría</span></div>
        <div class="classify__zones">${(content.categories || []).map(cat => `<section data-category="${esc(cat)}" role="button" tabindex="0" aria-label="Asignar la tarjeta a ${esc(cat)}"><h3>${esc(cat)}</h3><small data-category-count>0 elementos</small><div></div></section>`).join('')}</div>
      </div>`);
    let remaining = (content.items || []).slice(), locked = false, submitted = false;
    const card = frame.board.querySelector('[data-classify-card]');
    const activeItem = () => remaining[0] || null;
    const clearMarks = () => frame.board.querySelectorAll('[data-category]').forEach(zone => zone.classList.remove('is-wrong', 'is-good', 'is-hint', 'is-checking'));
    const paint = () => {
      const done = Object.keys(assignments).length, total = content.items.length, item = activeItem();
      frame.board.querySelector('[data-classify-step]').textContent = item ? `Tarjeta ${done + 1} de ${total}` : `${total} de ${total} clasificadas`;
      frame.board.querySelector('[data-classify-bar]').style.width = `${total ? done / total * 100 : 100}%`;
      if (!item) {
        card.textContent = '¡Todas clasificadas!'; card.disabled = true; card.removeAttribute('draggable');
        if (!submitted) { submitted = true; frame.check.disabled = true; frame.status.classList.remove('is-error'); frame.status.textContent = '¡Clasificación completada! Validando tu avance…'; setTimeout(() => submit({ assignments: { ...assignments } }, frame), 520); }
        return;
      }
      card.disabled = false; card.draggable = true; card.dataset.item = item.id; card.textContent = item.label;
      card.classList.remove('is-wrong', 'is-correct', 'is-fly');
      frame.status.classList.remove('is-error'); frame.status.textContent = `${done} de ${total} tarjetas clasificadas.`;
    };
    const placeCorrect = (item, category, assisted) => {
      assignments[item.id] = category;
      remaining = remaining.filter(entry => entry.id !== item.id);
      const zone = frame.board.querySelector(`[data-category="${CSS.escape(category)}"]`);
      const chip = document.createElement('span'); chip.className = 'classify__placed'; chip.textContent = item.label; zone?.querySelector('div')?.appendChild(chip);
      const count = zone?.querySelectorAll('.classify__placed').length || 0;
      if (zone) { zone.querySelector('[data-category-count]').textContent = `${count} ${count === 1 ? 'elemento' : 'elementos'}`; zone.classList.add('is-good'); }
      card.classList.add('is-correct', 'is-fly');
      frame.status.classList.remove('is-error'); frame.status.textContent = assisted ? `Te ayudamos: “${item.label}” va en ${category}.` : `¡Correcto! “${item.label}” va en ${category}.`;
      announce(assisted ? 'Tarjeta clasificada con ayuda' : 'Clasificación correcta');
      setTimeout(() => { clearMarks(); locked = false; paint(); }, 540);
    };
    const tryCategory = async category => {
      const item = activeItem(); if (!item || locked) return;
      locked = true; clearMarks();
      const selectedZone = frame.board.querySelector(`[data-category="${CSS.escape(category)}"]`); selectedZone?.classList.add('is-checking');
      try {
        const result = await checkGameStep(challenge, { kind: 'classification', itemId: item.id, category });
        selectedZone?.classList.remove('is-checking');
        if (result.correct) { placeCorrect(item, category, false); return; }
        selectedZone?.classList.add('is-wrong'); card.classList.remove('is-wrong'); void card.offsetWidth; card.classList.add('is-wrong');
        const correctZone = frame.board.querySelector(`[data-category="${CSS.escape(String(result.correctCategory || ''))}"]`); correctZone?.classList.add('is-hint');
        frame.status.textContent = `Esa tarjeta no va en ${category}. La categoría correcta quedó marcada en verde.`; frame.status.classList.add('is-error');
        announce('Categoría incorrecta. Revisa la opción marcada en verde.');
        setTimeout(() => { selectedZone?.classList.remove('is-wrong'); locked = false; }, 760);
      } catch (error) {
        selectedZone?.classList.remove('is-checking'); locked = false; frame.status.textContent = error.message || 'No pudimos revisar la tarjeta.'; frame.status.classList.add('is-error');
      }
    };
    card.addEventListener('dragstart', event => { const item = activeItem(); if (item) event.dataTransfer?.setData('text/plain', item.id); });
    frame.board.querySelectorAll('[data-category]').forEach(zone => {
      zone.addEventListener('click', () => tryCategory(zone.dataset.category));
      zone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tryCategory(zone.dataset.category); } });
      zone.addEventListener('dragover', event => event.preventDefault());
      zone.addEventListener('drop', event => { event.preventDefault(); if (event.dataTransfer?.getData('text/plain') === activeItem()?.id) tryCategory(zone.dataset.category); });
    });
    const proof = () => ({ assignments: { ...assignments } });
    frame.check.hidden = true;
    frame.reset.addEventListener('click', () => runClassify(challenge, shell, submit));
    enableStepHelp(challenge, frame, proof, hint => {
      if (hint.kind !== 'classification') return;
      const item = remaining.find(entry => entry.id === String(hint.itemId));
      if (item) { locked = true; clearMarks(); placeCorrect(item, String(hint.category), true); }
    }, 'Clasificar una tarjeta');
    paint();
  }

  function runQuiz(challenge, shell, submit) {
    const questions = Array.isArray(challenge.content?.questions) ? challenge.content.questions : [];
    const answers = {}, validated = {}, marks = {};
    let index = 0, checking = false, submitted = false;
    const frame = gameFrame(challenge, shell, '<div class="quiz-game"></div>');
    const paint = (focusOption) => {
      const question = questions[index];
      if (!question) {
        frame.board.innerHTML = '<p class="game-hint">No hay preguntas disponibles en este momento.</p>';
        frame.check.disabled = true;
        return;
      }
      const selected = answers[question.id];
      const progress = Math.round(((index + 1) / questions.length) * 100);
      frame.board.innerHTML = `<div class="quiz-game">
        <div class="quiz-game__progress"><span>Pregunta ${index + 1} de ${questions.length}</span><i><b style="width:${progress}%"></b></i><em>${progress}%</em></div>
        <span class="quiz-game__area">${esc(question.area || 'ICADEM')}</span>
        <h3 tabindex="-1">${esc(question.question)}</h3>
        <div class="quiz-game__options" role="radiogroup" aria-label="Opciones de respuesta">${(question.options || []).map((option, optionIndex) => {
          const mark = marks[question.id];
          const classes = [selected === optionIndex ? 'is-selected' : '', mark?.selected === optionIndex && !mark.correct ? 'is-wrong' : '', mark && optionIndex === mark.correctOption ? 'is-correct' : ''].filter(Boolean).join(' ');
          return `<button type="button" role="radio" aria-checked="${selected === optionIndex}" tabindex="${selected == null ? (optionIndex === 0 ? 0 : -1) : (selected === optionIndex ? 0 : -1)}" class="${classes}" data-quiz-option="${optionIndex}" ${validated[question.id] ? 'disabled' : ''}><b>${String.fromCharCode(65 + optionIndex)}</b><span>${esc(option)}</span></button>`;
        }).join('')}</div>
        <div class="quiz-game__nav"><button type="button" data-quiz-prev ${index === 0 ? 'disabled' : ''}>Pregunta anterior</button><small>${Object.keys(answers).length} respondidas</small></div>
      </div>`;
      frame.check.innerHTML = `Comprobar respuesta <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>`;
      frame.status.textContent = validated[question.id] ? 'Respuesta correcta.' : (marks[question.id] && !marks[question.id].correct ? 'Corrige la respuesta marcada en rojo.' : (selected == null ? 'Elige una respuesta para continuar.' : 'Respuesta seleccionada. Ahora compruébala.'));
      frame.status.classList.toggle('is-error', Boolean(marks[question.id] && !marks[question.id].correct && !validated[question.id]));
      const optionButtons = Array.from(frame.board.querySelectorAll('[data-quiz-option]'));
      const choose = button => { if (validated[question.id] || checking) return; answers[question.id] = Number(button.dataset.quizOption); delete marks[question.id]; paint(true); };
      optionButtons.forEach((button, buttonIndex) => {
        button.addEventListener('click', () => choose(button));
        button.addEventListener('keydown', event => {
          const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          let next = buttonIndex;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (buttonIndex + 1) % optionButtons.length;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (buttonIndex - 1 + optionButtons.length) % optionButtons.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = optionButtons.length - 1;
          choose(optionButtons[next]);
        });
      });
      frame.board.querySelector('[data-quiz-prev]')?.addEventListener('click', () => { index = Math.max(0, index - 1); paint(); });
      if (focusOption) frame.board.querySelector(`[data-quiz-option="${answers[question.id]}"]`)?.focus();
      else frame.board.querySelector('h3')?.focus();
    };
    frame.check.addEventListener('click', async () => {
      const question = questions[index];
      if (!question || answers[question.id] == null) {
        frame.status.textContent = 'Selecciona una respuesta antes de continuar.';
        frame.status.classList.add('is-error');
        return;
      }
      if (checking || submitted) return;
      checking = true; frame.check.disabled = true;
      try {
        const result = await checkGameStep(challenge, { kind: 'quiz-answer', questionId: question.id, optionIndex: answers[question.id] });
        marks[question.id] = { selected: answers[question.id], correct: result.correct, correctOption: result.correct ? answers[question.id] : Number(result.correctOption) };
        if (!result.correct) {
          frame.status.textContent = 'Esa respuesta no es correcta. La opción correcta quedó marcada en verde para que puedas aprender y continuar.';
          frame.status.classList.add('is-error'); paint(true); return;
        }
        validated[question.id] = true; frame.status.classList.remove('is-error'); frame.status.textContent = '¡Correcto!'; paint(true);
        setTimeout(() => {
          if (index < questions.length - 1) { index += 1; frame.check.disabled = false; paint(); return; }
          submitted = true; frame.check.disabled = true; frame.status.textContent = '¡Respuestas completadas! Validando tu avance…'; submit({ answers }, frame);
        }, 520);
      } catch (error) {
        frame.status.textContent = error.message || 'No pudimos revisar la respuesta.'; frame.status.classList.add('is-error');
      } finally { checking = false; if (!submitted && !validated[question.id]) frame.check.disabled = false; }
    });
    frame.reset.addEventListener('click', () => runQuiz(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ answers: { ...answers } }), hint => {
      if (hint.kind !== 'quiz-answer') return;
      const questionIndex = questions.findIndex(question => question.id === hint.questionId);
      if (questionIndex < 0) return;
      index = questionIndex; answers[hint.questionId] = Number(hint.optionIndex); validated[hint.questionId] = true; marks[hint.questionId] = { selected: Number(hint.optionIndex), correct: true, correctOption: Number(hint.optionIndex) }; paint(true);
      frame.status.classList.remove('is-error'); frame.status.textContent = 'Marcamos una respuesta correcta. Continúa a tu ritmo.';
      frame.check.disabled = true;
      setTimeout(() => {
        if (questionIndex < questions.length - 1) { index = questionIndex + 1; frame.check.disabled = false; paint(); return; }
        if (!submitted) { submitted = true; submit({ answers }, frame); }
      }, 560);
    }, 'Resolver una pregunta');
    paint();
  }

  // ─── Dinámicas profesionales v4 ───────────────────────────────────────
  const IMG_BASE = 'assets/juegos/';
  function imgUrl(path) { return encodeURI(String(path || '')).replace(/'/g, '%27'); }
  function shuffleLocal(list) { const out = list.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }

  function runCrosswordGrid(challenge, shell, submit) {
    const c = challenge.content || {};
    const words = Array.isArray(c.words) ? c.words : [];
    const cellsOf = w => Array.from({ length: w.len }, (_, k) => `${w.r + (w.dir === 'v' ? k : 0)}-${w.c + (w.dir === 'h' ? k : 0)}`);
    const used = new Map(), numbers = new Map();
    words.forEach(w => { cellsOf(w).forEach(k => used.set(k, true)); numbers.set(`${w.r}-${w.c}`, w.num); });
    let grid = '';
    for (let r = 0; r < c.rows; r++) for (let col = 0; col < c.cols; col++) {
      const k = `${r}-${col}`;
      grid += used.has(k)
        ? `<label class="cw4__cell">${numbers.has(k) ? `<small>${numbers.get(k)}</small>` : ''}<input data-k="${k}" maxlength="1" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Casilla"></label>`
        : '<span class="cw4__void"></span>';
    }
    const clues = dir => words.filter(w => w.dir === dir).sort((a, b) => a.num - b.num)
      .map(w => `<li data-clue="${esc(w.id)}"><b>${w.num}</b><span>${esc(w.clue)}</span><em>${w.len}</em></li>`).join('');
    const frame = gameFrame(challenge, shell, `<div class="cw4${c.image ? ' has-photo' : ''}">
      ${c.image ? `<figure class="cw4__photo"><img src="${imgUrl(c.image)}" alt="" decoding="async"></figure>` : ''}
      <div class="cw4__board"><div class="cw4__grid" style="--cols:${Number(c.cols) || 1}">${grid}</div></div>
      <div class="cw4__clues">${words.some(w => w.dir === 'h') ? `<span>Horizontales</span><ol>${clues('h')}</ol>` : ''}${words.some(w => w.dir === 'v') ? `<span>Verticales</span><ol>${clues('v')}</ol>` : ''}</div>
    </div>`);
    const input = k => frame.board.querySelector(`input[data-k="${k}"]`);
    let active = words[0]?.id, submitted = false, autoTimer = 0, pendingValidations = 0;
    const cellResults = new Map(), validationVersions = new Map();
    const wordById = id => words.find(w => w.id === id);
    const highlight = () => {
      frame.board.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
      const w = wordById(active); if (!w) return;
      cellsOf(w).forEach(k => input(k)?.parentElement.classList.add('is-active'));
      frame.board.querySelector(`[data-clue="${CSS.escape(w.id)}"]`)?.classList.add('is-active');
    };
    const wordsAt = k => words.filter(w => cellsOf(w).includes(k));
    const updateProgress = () => {
      const all = [...frame.board.querySelectorAll('.cw4__cell input')];
      const filled = all.filter(el => el.value).length, correct = all.filter(el => cellResults.get(el.dataset.k) === true).length;
      frame.status.classList.remove('is-error');
      frame.status.textContent = filled ? `${correct} correctas · ${filled} de ${all.length} casillas completadas.` : `0 de ${all.length} casillas completadas.`;
    };
    const maybeSubmit = () => {
      clearTimeout(autoTimer);
      const all = [...frame.board.querySelectorAll('.cw4__cell input')];
      updateProgress();
      if (!all.length || all.some(el => !el.value) || pendingValidations > 0 || all.some(el => cellResults.get(el.dataset.k) !== true) || submitted) return;
      autoTimer = setTimeout(() => {
        if (submitted) return;
        submitted = true; frame.check.disabled = true;
        frame.status.textContent = 'Crucigrama completo. Validando tus respuestas…';
        submit({ answers: collect() }, frame);
      }, 650);
    };
    frame.board.querySelectorAll('input').forEach(el => {
      el.addEventListener('focus', () => { const opts = wordsAt(el.dataset.k); if (!opts.some(w => w.id === active)) active = opts[0].id; highlight(); });
      el.addEventListener('click', () => { const opts = wordsAt(el.dataset.k); if (opts.length > 1) { active = (opts.find(w => w.id !== active) || opts[0]).id; highlight(); } });
      el.addEventListener('input', async () => {
        el.value = normalize(el.value).replace(/[^A-Z]/g, '').slice(-1);
        el.parentElement.classList.remove('is-revealed', 'is-letter-correct', 'is-letter-wrong');
        const currentValue = el.value, key = el.dataset.k;
        if (!currentValue) { cellResults.delete(key); updateProgress(); return; }
        const word = wordById(active), cells = cellsOf(word), letterIndex = cells.indexOf(key);
        const version = (validationVersions.get(key) || 0) + 1; validationVersions.set(key, version); pendingValidations += 1;
        try {
          const result = await checkGameStep(challenge, { kind: 'crossword-letter', wordId: word.id, index: letterIndex, letter: currentValue });
          if (validationVersions.get(key) !== version || el.value !== currentValue) return;
          cellResults.set(key, result.correct === true);
          el.parentElement.classList.toggle('is-letter-correct', result.correct === true);
          el.parentElement.classList.toggle('is-letter-wrong', result.correct !== true);
          if (!result.correct) {
            frame.status.textContent = 'Esa letra no corresponde. Quedó marcada en rojo para que la corrijas.'; frame.status.classList.add('is-error'); el.focus(); return;
          }
          frame.status.classList.remove('is-error');
          const next = cells[letterIndex + 1]; if (next) input(next)?.focus();
        } catch (error) {
          cellResults.delete(key); frame.status.textContent = error.message || 'No pudimos revisar esa letra.'; frame.status.classList.add('is-error');
        } finally { pendingValidations = Math.max(0, pendingValidations - 1); if (validationVersions.get(key) === version && cellResults.get(key) === true) maybeSubmit(); }
      });
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); frame.check.click(); return; }
        if (event.key !== 'Backspace' || el.value) return;
        const list = cellsOf(wordById(active)); const prev = list[list.indexOf(el.dataset.k) - 1];
        if (prev) { event.preventDefault(); const p = input(prev); if (p) { p.value = ''; p.focus(); } }
      });
    });
    frame.board.querySelectorAll('[data-clue]').forEach(li => li.addEventListener('click', () => {
      active = li.dataset.clue; const w = wordById(active);
      const first = cellsOf(w).find(k => !input(k)?.value) || cellsOf(w)[0];
      input(first)?.focus(); highlight();
    }));
    const collect = () => Object.fromEntries(words.map(w => [w.id, cellsOf(w).map(k => input(k)?.value || '').join('')]));
    frame.check.addEventListener('click', () => {
      const answers = collect();
      if (words.some(w => answers[w.id].length !== w.len)) { frame.status.textContent = 'Completa todas las casillas antes de comprobar.'; frame.status.classList.add('is-error'); return; }
      if (pendingValidations) { frame.status.textContent = 'Estamos revisando las últimas letras…'; return; }
      const wrong = [...frame.board.querySelectorAll('.cw4__cell input')].filter(el => cellResults.get(el.dataset.k) !== true).length;
      if (wrong) { frame.status.textContent = `Corrige ${wrong === 1 ? 'la casilla marcada en rojo' : `las ${wrong} casillas marcadas en rojo`}.`; frame.status.classList.add('is-error'); return; }
      submitted = true;
      submit({ answers }, frame);
    });
    frame.reset.addEventListener('click', () => runCrosswordGrid(challenge, shell, submit));
    enableStepHelp(challenge, frame, collect, hint => {
      if (hint.kind !== 'crossword-letter') return;
      const word = wordById(String(hint.wordId));
      const key = word ? cellsOf(word)[Number(hint.index) || 0] : '';
      const target = key ? input(key) : null;
      if (!target) return;
      target.value = String(hint.letter || '').slice(0, 1);
      target.parentElement.classList.add('is-revealed', 'is-letter-correct');
      target.parentElement.classList.remove('is-letter-wrong'); cellResults.set(key, true);
      active = word.id; highlight(); maybeSubmit();
      if (!submitted) frame.status.textContent = `Colocamos la letra ${target.value}. Puedes pedir todas las ayudas que necesites.`;
      target.focus();
    }, 'Revelar una letra');
    updateProgress();
    highlight();
  }

  function runOrder(challenge, shell, submit) {
    const c = challenge.content || {};
    let steps = (c.steps || []).slice(), lastPositions = null, checking = false;
    const frame = gameFrame(challenge, shell, `<div class="ord4"><p class="ord4__prompt">${esc(c.prompt || 'Ordena el proceso')}</p><ol class="ord4__list"></ol></div>`);
    const list = frame.board.querySelector('.ord4__list');
    const paint = focusId => {
      list.innerHTML = steps.map((s, i) => `<li data-step="${esc(s.id)}" class="${lastPositions ? (lastPositions[i] ? 'is-ok' : 'is-bad') : ''}"><b>${i + 1}</b><span>${esc(s.text)}</span><div class="ord4__moves"><button type="button" data-move="-1" aria-label="Subir paso" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" aria-label="Bajar paso" ${i === steps.length - 1 ? 'disabled' : ''}>↓</button></div></li>`).join('');
      if (focusId) list.querySelector(`[data-step="${CSS.escape(focusId.id)}"] [data-move="${focusId.dir}"]:not(:disabled)`)?.focus();
    };
    list.addEventListener('click', event => {
      const btn = event.target.closest('[data-move]'); if (!btn) return;
      const id = btn.closest('[data-step]').dataset.step; const i = steps.findIndex(s => s.id === id); const j = i + Number(btn.dataset.move);
      if (j < 0 || j >= steps.length) return;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      lastPositions = null;
      frame.status.textContent = ''; frame.status.classList.remove('is-error');
      paint({ id, dir: btn.dataset.move });
    });
    paint();
    const proof = () => ({ order: steps.map(s => s.id) });
    frame.check.addEventListener('click', async () => {
      if (checking) return; checking = true; frame.check.disabled = true;
      try {
        const result = await checkGameStep(challenge, { kind: 'order', order: proof().order });
        if (result.correct) { frame.status.classList.remove('is-error'); frame.status.textContent = '¡El proceso está en el orden correcto!'; submit(proof(), frame); return; }
        lastPositions = Array.isArray(result.positions) ? result.positions : null; paint();
        frame.status.textContent = `${Number(result.correctCount) || 0} de ${Number(result.total) || steps.length} pasos están en su lugar. Los verdes están correctos; mueve los rojos.`; frame.status.classList.add('is-error');
      } catch (error) { frame.status.textContent = error.message || 'No pudimos revisar el orden.'; frame.status.classList.add('is-error'); }
      finally { checking = false; frame.check.disabled = false; }
    });
    frame.reset.addEventListener('click', () => runOrder(challenge, shell, submit));
    enableStepHelp(challenge, frame, proof, hint => {
      if (hint.kind !== 'order-step') return;
      const target = Number(hint.slot), source = steps.findIndex(step => step.id === hint.stepId);
      if (target < 0 || source < 0) return;
      const [step] = steps.splice(source, 1); steps.splice(target, 0, step); lastPositions = null; paint();
      frame.status.classList.remove('is-error'); frame.status.textContent = 'Colocamos el siguiente paso. Puedes continuar o pedir otra ayuda.';
    }, 'Acomodar un paso');
  }

  function pointPercent(el, event) { const r = el.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width * 100, y: (event.clientY - r.top) / r.height * 100 }; }

  function runHazard(challenge, shell, submit) {
    const c = challenge.content || {};
    const items = Array.isArray(c.items) ? c.items : [];
    const found = []; let submitted = false;
    const frame = gameFrame(challenge, shell, `<div class="hz4"><div class="hz4__scene" data-scene><img src="${imgUrl(c.image)}" alt="${esc(c.scene || 'Escena')}" draggable="false" decoding="async"><div class="hz4__marks" data-marks></div></div>
      <aside class="hz4__side"><span>Irregularidades · <b data-hz-count>0/${items.length}</b></span><ol>${items.map((_, i) => `<li data-hz-slot="${i}"><b>${i + 1}</b><span>Por encontrar</span></li>`).join('')}</ol><p>Toca en la imagen cada condición incorrecta. Observa el piso, los equipos, las personas y los documentos.</p></aside></div>`);
    const scene = frame.board.querySelector('[data-scene]'), marks = frame.board.querySelector('[data-marks]');
    const pad = 2.5;
    const reveal = it => {
      found.push(it.id); const n = found.length;
      const ring = document.createElement('span'); ring.className = 'hz4__ring';
      ring.style.cssText = `left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%`; ring.innerHTML = `<b>${n}</b>`; marks.appendChild(ring);
      const slot = frame.board.querySelector(`[data-hz-slot="${n - 1}"]`);
      if (slot) { slot.classList.add('is-found'); slot.innerHTML = `<b>${n}</b><span><strong>${esc(it.label)}</strong>${esc(it.tip)}</span>`; }
      frame.board.querySelector('[data-hz-count]').textContent = `${n}/${items.length}`;
      frame.status.classList.remove('is-error');
      frame.status.textContent = n === items.length ? '¡Encontraste todas! Validando tu avance…' : `¡Bien visto! ${it.label}.`;
      announce(it.label);
      if (n === items.length && !submitted) { submitted = true; frame.check.disabled = true; setTimeout(() => submit({ found: found.slice() }, frame), 520); }
    };
    scene.addEventListener('click', event => {
      const p = pointPercent(scene, event);
      const hit = items.find(it => !found.includes(it.id) && p.x >= it.x - pad && p.x <= it.x + it.w + pad && p.y >= it.y - pad && p.y <= it.y + it.h + pad);
      if (hit) { reveal(hit); return; }
      if (items.some(it => found.includes(it.id) && p.x >= it.x && p.x <= it.x + it.w && p.y >= it.y && p.y <= it.y + it.h)) return;
      const miss = document.createElement('span'); miss.className = 'hz4__miss'; miss.style.left = `${p.x}%`; miss.style.top = `${p.y}%`; marks.appendChild(miss);
      setTimeout(() => miss.remove(), 900);
      frame.status.textContent = 'Ahí no hay una irregularidad. Observa con calma.'; frame.status.classList.add('is-error');
    });
    frame.check.addEventListener('click', () => {
      if (found.length < items.length) { frame.status.textContent = `Te faltan ${items.length - found.length} por encontrar.`; frame.status.classList.add('is-error'); return; }
      submit({ found: found.slice() }, frame);
    });
    frame.reset.addEventListener('click', () => runHazard(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ found: found.slice() }), hint => {
      if (hint.kind !== 'hazard-item') return;
      const item = items.find(entry => entry.id === hint.itemId);
      if (item && !found.includes(item.id)) { reveal(item); if (!submitted) frame.status.textContent = `Te señalamos: ${item.label}. ${item.tip || ''}`; }
    }, 'Señalar una irregularidad');
  }

  function runSpot(challenge, shell, submit) {
    const c = challenge.content || {};
    const zones = Array.isArray(c.zones) ? c.zones : [], rounds = Array.isArray(c.rounds) ? c.rounds : [];
    const answers = []; let round = 0, locked = false, misses = 0;
    const frame = gameFrame(challenge, shell, `<div class="sp4"><p class="sp4__q" data-sp-q></p><div class="sp4__frame"><div class="sp4__map" data-sp-map><img src="${imgUrl(c.image)}" alt="Vista de la escena" draggable="false" decoding="async">${zones.map((z, i) => `<button type="button" class="sp4__hit" data-zone="${esc(z.id)}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%" aria-label="Área ${i + 1}"></button><span class="sp4__label" data-zone-label="${esc(z.id)}" style="left:${z.x + z.w / 2}%;top:${z.y + z.h / 2}%">${esc(z.label)}</span>`).join('')}</div></div></div>`);
    const map = frame.board.querySelector('[data-sp-map]'), q = frame.board.querySelector('[data-sp-q]');
    const show = () => {
      misses = 0; map.querySelectorAll('.is-hint').forEach(el => el.classList.remove('is-hint'));
      if (round >= rounds.length) { q.innerHTML = '<span>Listo</span>Ubicaste todas las áreas. Pulsa Comprobar.'; return; }
      q.innerHTML = `<span>Situación ${round + 1} de ${rounds.length}</span>${esc(rounds[round].q)}`;
    };
    map.addEventListener('click', event => {
      const btn = event.target.closest('[data-zone]'); if (!btn || locked || round >= rounds.length) return;
      const r = rounds[round];
      if (btn.dataset.zone === r.zone) {
        locked = true; answers.push(r.zone); btn.classList.remove('is-hint'); btn.classList.add('is-correct');
        map.querySelectorAll(`[data-zone-label="${CSS.escape(r.zone)}"]`).forEach(el => el.classList.add('is-visible'));
        frame.status.classList.remove('is-error'); frame.status.textContent = r.tip || '¡Correcto!';
        round += 1;
        if (round >= rounds.length) { setTimeout(() => submit({ answers: answers.slice() }, frame), 520); return; }
        setTimeout(() => { locked = false; show(); }, 900); return;
      }
      btn.classList.remove('is-wrong'); void btn.offsetWidth; btn.classList.add('is-wrong'); misses += 1;
      frame.status.classList.add('is-error');
      if (misses >= 2) { map.querySelector(`[data-zone="${CSS.escape(r.zone)}"]`)?.classList.add('is-hint'); frame.status.textContent = 'El área correcta está iluminada. Tócala para continuar.'; }
      else frame.status.textContent = 'Esa no es el área correcta. Lee de nuevo la situación.';
    });
    show();
    frame.check.addEventListener('click', () => {
      if (answers.length < rounds.length) { frame.status.textContent = `Resuelve las ${rounds.length} situaciones antes de comprobar.`; frame.status.classList.add('is-error'); return; }
      submit({ answers: answers.slice() }, frame);
    });
    frame.reset.addEventListener('click', () => runSpot(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ answers: answers.slice() }), hint => {
      if (hint.kind !== 'spot-zone' || Number(hint.round) !== round) return;
      const button = map.querySelector(`[data-zone="${CSS.escape(String(hint.zone))}"]`);
      if (button) { button.click(); if (round < rounds.length) frame.status.textContent = 'Resolvimos esta situación contigo. Puedes pedir ayuda de nuevo.'; }
    }, 'Resolver esta situación');
  }

  function runDocument(challenge, shell, submit) {
    const c = challenge.content || {};
    const fields = Array.isArray(c.fields) ? c.fields : [];
    const flagged = new Set(), checking = new Set(); let submitted = false;
    const frame = gameFrame(challenge, shell, `<div class="doc4"><p class="doc4__intro">Este documento tiene <b>${Number(c.errorCount) || 3} errores</b>. Toca los datos incorrectos para marcarlos.</p>
      <article class="doc4__paper"><header><small>${esc(c.docType || 'Documento')}</small><strong>${esc(c.title || '')}</strong>${c.subtitle ? `<em>${esc(c.subtitle)}</em>` : ''}</header>
      <div class="doc4__fields">${fields.map(f => `<button type="button" class="doc4__field" data-field="${esc(f.id)}" aria-pressed="false"><span>${esc(f.label)}</span><b>${esc(f.value)}</b><i aria-hidden="true">!</i></button>`).join('')}</div></article>
      <p class="doc4__count"><span data-doc-count>0</span> de ${Number(c.errorCount) || 3} marcados</p></div>`);
    const finishIfReady = () => {
      frame.board.querySelector('[data-doc-count]').textContent = String(flagged.size);
      if (flagged.size >= (Number(c.errorCount) || 3) && !submitted) {
        submitted = true; frame.check.disabled = true; frame.status.classList.remove('is-error'); frame.status.textContent = '¡Encontraste todos los errores! Validando tu avance…';
        setTimeout(() => submit({ flagged: [...flagged] }, frame), 520);
      }
    };
    const markCorrect = (btn, tip, assisted) => {
      const id = btn.dataset.field;
      if (flagged.has(id)) return;
      flagged.add(id); btn.classList.add('is-flagged', 'is-correct'); btn.setAttribute('aria-pressed', 'true'); btn.disabled = true;
      frame.status.classList.remove('is-error'); frame.status.textContent = assisted ? 'Marcamos un dato incorrecto contigo.' : `¡Bien detectado!${tip ? ` ${tip}` : ''}`;
      finishIfReady();
    };
    frame.board.querySelectorAll('[data-field]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.dataset.field; if (flagged.has(id) || checking.has(id) || submitted) return;
      checking.add(id); btn.classList.add('is-checking');
      try {
        const result = await checkGameStep(challenge, { kind: 'document-field', fieldId: id });
        btn.classList.remove('is-checking');
        if (result.correct) { markCorrect(btn, result.tip, false); return; }
        btn.classList.remove('is-wrong'); void btn.offsetWidth; btn.classList.add('is-wrong');
        frame.status.textContent = 'Ese dato es correcto. Lo marcamos en rojo un momento para que pruebes con otro.'; frame.status.classList.add('is-error');
      } catch (error) { btn.classList.remove('is-checking'); frame.status.textContent = error.message || 'No pudimos revisar ese dato.'; frame.status.classList.add('is-error'); }
      finally { checking.delete(id); }
    }));
    frame.check.addEventListener('click', () => {
      if (flagged.size < (Number(c.errorCount) || 3)) { frame.status.textContent = `Te ${flagged.size + 1 === (Number(c.errorCount) || 3) ? 'falta 1 error' : `faltan ${(Number(c.errorCount) || 3) - flagged.size} errores`} por encontrar.`; frame.status.classList.add('is-error'); return; }
      submit({ flagged: [...flagged] }, frame);
    });
    frame.reset.addEventListener('click', () => runDocument(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ flagged: [...flagged] }), hint => {
      if (!['document-error', 'document-remove'].includes(hint.kind)) return;
      const button = frame.board.querySelector(`[data-field="${CSS.escape(String(hint.fieldId))}"]`);
      if (button && hint.kind === 'document-error') markCorrect(button, '', true);
      frame.status.classList.remove('is-error');
      if (!submitted) frame.status.textContent = hint.kind === 'document-error' ? 'Marcamos un dato incorrecto. Revisa por qué no corresponde.' : 'Ese dato no debía marcarse.';
    }, 'Revisar un dato');
  }

  function runCalc(challenge, shell, submit) {
    const c = challenge.content || {};
    const unit = String(c.unit || '');
    const money = unit === 'MXN';
    const frame = gameFrame(challenge, shell, `<div class="calc4"><section class="calc4__case"><small>Caso práctico</small><strong>${esc(c.title || 'Calcula')}</strong><p>${esc(c.scenario || '')}</p>
      <dl>${(c.data || []).map(d => `<div><dt>${esc(d.label)}</dt><dd>${esc(d.value)}</dd></div>`).join('')}</dl></section>
      <section class="calc4__answer"><label for="calc4-input">${esc(c.question || 'Resultado')}</label><div class="calc4__field">${money ? '<span>$</span>' : ''}<input id="calc4-input" inputmode="decimal" autocomplete="off" placeholder="0.00">${!money && unit ? `<span>${esc(unit)}</span>` : ''}</div>
      <small>${money ? 'Escribe la cantidad en pesos, con o sin centavos.' : 'Escribe solo el número.'}</small></section></div>`);
    const input = frame.board.querySelector('input');
    const field = frame.board.querySelector('.calc4__field'); let checking = false;
    input.addEventListener('keydown', event => { if (event.key === 'Enter') frame.check.click(); });
    frame.check.addEventListener('click', async () => {
      const raw = input.value.trim();
      if (!raw) { frame.status.textContent = 'Escribe tu resultado antes de comprobar.'; frame.status.classList.add('is-error'); return; }
      if (checking) return; checking = true; frame.check.disabled = true; field.classList.remove('is-wrong', 'is-correct');
      const value = raw.replace(/[^0-9.,-]/g, '');
      try {
        const result = await checkGameStep(challenge, { kind: 'calc-answer', value });
        if (!result.correct) { field.classList.add('is-wrong'); frame.status.textContent = `Aún no es el resultado. Pista: ${result.hint || 'revisa los datos y la operación.'}`; frame.status.classList.add('is-error'); input.select(); return; }
        field.classList.add('is-correct'); frame.status.classList.remove('is-error'); frame.status.textContent = '¡Cálculo correcto! Validando tu avance…'; submit({ value }, frame);
      } catch (error) { frame.status.textContent = error.message || 'No pudimos revisar el cálculo.'; frame.status.classList.add('is-error'); }
      finally { checking = false; frame.check.disabled = false; }
    });
    frame.reset.addEventListener('click', () => { input.value = ''; field.classList.remove('is-wrong', 'is-correct'); frame.status.textContent = ''; frame.status.classList.remove('is-error'); input.focus(); });
    enableStepHelp(challenge, frame, () => ({ value: input.value }), hint => {
      frame.status.classList.remove('is-error');
      if (hint.kind === 'calc-step') frame.status.textContent = `Pista: ${hint.text}`;
      if (hint.kind === 'calc-answer') { input.value = hint.value; frame.status.textContent = `Resultado colocado: ${hint.value}${hint.unit ? ` ${hint.unit}` : ''}.`; input.focus(); }
    }, 'Mostrar el siguiente paso');
  }

  function runVisualMemory(challenge, shell, submit) {
    const cards = [];
    (challenge.content?.pairs || []).forEach(pair => {
      cards.push({ key: `${pair.id}-img`, id: pair.id, image: pair.image });
      cards.push({ key: `${pair.id}-txt`, id: pair.id, text: pair.label });
    });
    const deck = shuffleLocal(cards);
    const frame = gameFrame(challenge, shell, `<div class="vm4">${deck.map(card => `<button type="button" class="vm4__card" data-pair="${esc(card.id)}" aria-label="Carta oculta"><span class="vm4__back">ICA</span><span class="vm4__front${card.image ? ' is-image' : ''}">${card.image ? `<img src="${imgUrl(card.image)}" alt="" decoding="async">` : esc(card.text)}</span></button>`).join('')}</div>`);
    let open = [], matched = [], busy = false, submitted = false;
    const completePair = (id, assisted) => {
      if (matched.includes(id)) return;
      open.forEach(x => x.classList.remove('is-open', 'is-wrong')); open = [];
      frame.board.querySelectorAll(`[data-pair="${CSS.escape(id)}"]`).forEach(x => { x.classList.add('is-open', 'is-matched'); x.disabled = true; });
      matched.push(id); frame.status.classList.remove('is-error'); frame.status.textContent = `${matched.length} de ${challenge.content.pairs.length} parejas.`;
      announce(assisted ? 'Pareja encontrada con ayuda' : 'Pareja encontrada');
      if (matched.length === challenge.content.pairs.length && !submitted) { submitted = true; frame.check.disabled = true; setTimeout(() => submit({ pairs: [...new Set(matched)] }, frame), 480); }
    };
    frame.board.querySelectorAll('.vm4__card').forEach(card => card.addEventListener('click', () => {
      if (busy || card.classList.contains('is-open') || card.classList.contains('is-matched') || open.length === 2) return;
      card.classList.add('is-open'); open.push(card);
      if (open.length < 2) return;
      if (open[0].dataset.pair === open[1].dataset.pair) {
        const id = open[0].dataset.pair;
        setTimeout(() => completePair(id, false), 280);
      } else { busy = true; open.forEach(x => x.classList.add('is-wrong')); frame.status.textContent = 'No forman pareja. Recuerda su posición y vuelve a intentarlo.'; frame.status.classList.add('is-error'); setTimeout(() => { open.forEach(x => x.classList.remove('is-open', 'is-wrong')); open = []; busy = false; }, 800); }
    }));
    frame.check.addEventListener('click', () => {
      if (matched.length < challenge.content.pairs.length) { frame.status.textContent = `Te faltan ${challenge.content.pairs.length - matched.length} parejas.`; frame.status.classList.add('is-error'); return; }
      submit({ pairs: [...new Set(matched)] }, frame);
    });
    frame.reset.addEventListener('click', () => runVisualMemory(challenge, shell, submit));
    enableStepHelp(challenge, frame, () => ({ pairs: [...new Set(matched)] }), hint => {
      if (hint.kind === 'memory-pair') { completePair(String(hint.pair), true); if (!submitted) frame.status.textContent = 'Pareja encontrada con ayuda. Puedes pedir otra cuando quieras.'; }
    }, 'Encontrar una pareja');
  }

  function debriefMarkup(debrief) {
    if (!debrief || !Array.isArray(debrief.items) || !debrief.items.length) return '';
    return `<section class="game-debrief"><strong>${esc(debrief.title || 'Repaso')}</strong><ul>${debrief.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>`;
  }

  // Validación local (solo modo invitado): mismas reglas que el servidor.
  function localProofOk(type, solution, proof) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const word = value => normalize(value);
    if (type === 'crossword' && solution.answers) return Object.entries(solution.answers).every(([id, w]) => word(proof.answers?.[id]) === w);
    if (type === 'vmemory') return same([...(proof.pairs || [])].sort(), solution.pairs);
    if (type === 'order') return same(proof.order || [], solution.order);
    if (type === 'document') return same([...new Set(proof.flagged || [])].sort(), solution.errors);
    if (type === 'hazard') return same([...new Set(proof.found || [])].sort(), solution.found);
    if (type === 'spot') return same(proof.answers || [], solution.answers);
    if (type === 'calc') { let t = String(proof.value || '').trim(); if (!t.includes('.') && /^-?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.'); const v = Number(t.replace(/,/g, '')); return Number.isFinite(v) && Math.abs(v - solution.value) <= solution.tolerance; }
    return null;
  }

  // Tableros de demostración para el modo invitado (sin servidor).
  const DEMO_PRO = {
    puzzle: () => ({ content: { image: IMG_BASE + 'foto-fiscal.webp', size: 3, title: 'Arma la escena profesional' }, solution: { order: [0, 1, 2, 3, 4, 5, 6, 7, 8] } }),
    hazard: () => ({ content: { image: IMG_BASE + 'riesgo-oficina.webp', scene: 'Oficina contable', items: [
      { id: 'nota', x: 13, y: 26, w: 8, h: 9, label: 'Contraseña en una nota adhesiva', tip: 'Las contraseñas no se anotan a la vista.' },
      { id: 'sesion', x: 78, y: 31, w: 12, h: 20, label: 'Equipo desbloqueado y sin vigilancia', tip: 'Al levantarte se bloquea la sesión.' },
      { id: 'basura', x: 56, y: 70, w: 17, h: 28, label: 'Documentos con datos en la basura', tip: 'La información confidencial se tritura.' },
      { id: 'usb', x: 72, y: 50, w: 6, h: 9, label: 'Memoria USB desconocida conectada', tip: 'Un USB desconocido puede instalar malware.' }] }, solution: { found: ['basura', 'nota', 'sesion', 'usb'] } }),
    spot: () => ({ content: { image: IMG_BASE + 'escena-oficina.webp', zones: [
      { id: 'recepcion', label: 'Recepción', x: 13, y: 71, w: 25, h: 16 }, { id: 'juntas', label: 'Sala de juntas', x: 36, y: 2, w: 25, h: 21 },
      { id: 'archivo', label: 'Archivo', x: 77, y: 24, w: 18, h: 25 }, { id: 'servidores', label: 'Site de servidores', x: 79, y: 51, w: 18, h: 24 },
      { id: 'operacion', label: 'Área operativa', x: 33, y: 36, w: 34, h: 20 }], rounds: [
      { q: 'Llega un visitante. ¿Dónde se registra su entrada?', zone: 'recepcion', tip: 'La recepción controla el acceso.' },
      { q: '¿Dónde se resguardan los expedientes físicos?', zone: 'archivo', tip: 'El archivo tiene acceso controlado.' },
      { q: '¿Dónde viven los respaldos de la contabilidad?', zone: 'servidores', tip: 'El site debe tener acceso restringido.' },
      { q: 'Se reúne el comité directivo. ¿A qué área va?', zone: 'juntas', tip: 'La sala de juntas da privacidad.' }] }, solution: { answers: ['recepcion', 'archivo', 'servidores', 'juntas'] } }),
    document: () => ({ content: { docType: 'CFDI 4.0 · Factura de ingreso', title: 'Factura F-1842', subtitle: 'Despacho Contable Alfa, S.C. → Laura Méndez Ortiz', errorCount: 3, fields: [
      { id: 'tipo', label: 'Tipo de comprobante', value: 'I · Ingreso' }, { id: 'rfc', label: 'RFC del receptor', value: 'MEOL850214K73' },
      { id: 'cp', label: 'Código postal del receptor', value: '7240' }, { id: 'uso', label: 'Uso del CFDI', value: 'G03 · Gastos en general' },
      { id: 'metodo', label: 'Método de pago', value: 'PPD · Pago en parcialidades o diferido' }, { id: 'forma', label: 'Forma de pago', value: '03 · Transferencia electrónica' },
      { id: 'tasa', label: 'Tasa de IVA trasladado', value: '18%' }] }, solution: { errors: ['cp', 'forma', 'tasa'] } }),
    calc: () => ({ content: { title: 'IVA a pagar del mes', scenario: 'Determina el IVA a pagar del mes. Los importes no incluyen IVA.', data: [{ label: 'Ventas del mes', value: '$250,000.00' }, { label: 'Compras con IVA acreditable', value: '$140,000.00' }, { label: 'Tasa', value: '16%' }], question: 'IVA a pagar', unit: 'MXN' }, solution: { value: 17600, tolerance: 1 } }),
    vmemory: () => ({ content: { pairs: [['contenedor', 'Contenedor sellado: integridad de la carga'], ['buque', 'Transporte marítimo de gran volumen'], ['avion', 'Carga aérea urgente o de alto valor'], ['camion', 'Autotransporte terrestre'], ['tarima', 'Unidad de carga paletizada'], ['rayosx', 'Revisión no intrusiva en aduana']].map(([img, label], i) => ({ id: `v${i + 1}`, image: `${IMG_BASE}objeto-${img}.webp`, label })) }, solution: { pairs: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'] } }),
    order: () => { const steps = ['Recibir la notificación en el buzón tributario', 'Identificar el plazo y lo que se solicita', 'Reunir CFDI, contabilidad y estados de cuenta', 'Conciliar la información contra lo declarado', 'Entregar la respuesta con su soporte'].map((text, i) => ({ id: `s${i + 1}`, text })); return { content: { prompt: 'Ordena la atención de una revisión del SAT.', steps: [steps[2], steps[0], steps[4], steps[1], steps[3]] }, solution: { order: steps.map(s => s.id) } }; }
  };

  // Cofre de monedas (mismo patrón que IMFRA y Synova): aparece solo cuando
  // el servidor confirmó créditos, cuenta el monto y muestra el saldo total.
  const CHEST_COIN = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#c98a12"/><circle cx="20" cy="20" r="15" fill="#f4c64d"/><circle cx="20" cy="20" r="11.5" fill="none" stroke="#b97a0c" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-family="Plus Jakarta Sans,Inter,sans-serif" font-size="13" font-weight="800" fill="#8a5a06">C</text></svg>';
  const CHEST_SVG = `<svg class="cc-chest" viewBox="0 0 200 170" aria-hidden="true">
    <defs>
      <linearGradient id="ica-cc-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5c86"/><stop offset="1" stop-color="#143651"/></linearGradient>
      <linearGradient id="ica-cc-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a74a3"/><stop offset="1" stop-color="#1d4a6e"/></linearGradient>
      <linearGradient id="ica-cc-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe39a"/><stop offset=".55" stop-color="#e3a62a"/><stop offset="1" stop-color="#b9780c"/></linearGradient>
      <radialGradient id="ica-cc-inner" cx=".5" cy=".2" r=".9"><stop offset="0" stop-color="#ffe7a1"/><stop offset="1" stop-color="#c88915"/></radialGradient>
    </defs>
    <ellipse cx="100" cy="164" rx="78" ry="6" fill="rgba(0,0,0,.28)"/>
    <rect x="32" y="74" width="136" height="86" rx="12" fill="url(#ica-cc-wood)"/>
    <rect x="34" y="70" width="132" height="14" rx="5" fill="url(#ica-cc-inner)"/>
    <g class="cc-pile"><ellipse cx="78" cy="72" rx="15" ry="7" fill="#f4c64d"/><ellipse cx="100" cy="68" rx="17" ry="8" fill="#ffd96e"/><ellipse cx="122" cy="72" rx="15" ry="7" fill="#f0b934"/><ellipse cx="100" cy="74" rx="40" ry="6" fill="#e9aa2c"/></g>
    <rect x="32" y="96" width="136" height="9" fill="url(#ica-cc-gold)" opacity=".95"/>
    <rect x="50" y="74" width="12" height="86" fill="url(#ica-cc-gold)"/>
    <rect x="138" y="74" width="12" height="86" fill="url(#ica-cc-gold)"/>
    <rect x="86" y="90" width="28" height="32" rx="6" fill="url(#ica-cc-gold)" stroke="#9a6409" stroke-width="1.5"/>
    <circle cx="100" cy="103" r="4" fill="#5b3a05"/><rect x="98.3" y="104" width="3.4" height="9" rx="1.5" fill="#5b3a05"/>
    <g class="cc-lid">
      <path d="M30 76 Q30 30 100 28 Q170 30 170 76 Z" fill="url(#ica-cc-lid)"/>
      <path d="M48 76 Q50 36 62 33 L62 76 Z" fill="url(#ica-cc-gold)"/>
      <path d="M152 76 Q150 36 138 33 L138 76 Z" fill="url(#ica-cc-gold)"/>
      <rect x="28" y="70" width="144" height="10" rx="4" fill="url(#ica-cc-gold)"/>
      <text x="100" y="60" text-anchor="middle" font-family="Plus Jakarta Sans,Inter,sans-serif" font-size="15" font-weight="800" fill="#ffe7a1" letter-spacing="1">ICADEM</text>
    </g>
  </svg>`;
  function showCoinChest(options) {
    const amount = Math.max(0, Number(options?.amount) || 0);
    if (!amount) return;
    document.querySelector('.cc-overlay')?.remove();
    const coins = Math.min(8, Math.max(3, Math.ceil(amount / 4)));
    const total = Number(options?.total);
    const overlay = document.createElement('div');
    overlay.className = 'cc-overlay';
    overlay.setAttribute('role', 'status');
    overlay.innerHTML = `<div class="cc-card">
      <div class="cc-stage">
        <div class="cc-rays" aria-hidden="true"></div>
        ${Array.from({ length: coins }, (_, i) => `<span class="cc-coin" style="--i:${i};--x:${(i % 2 ? 1 : -1) * (8 + (i * 7) % 26)}px">${CHEST_COIN}</span>`).join('')}
        ${CHEST_SVG}
        ${Array.from({ length: 6 }, (_, i) => `<i class="cc-spark" style="--a:${i * 60}deg"></i>`).join('')}
      </div>
      <span class="cc-kicker">${esc(options?.title || '¡Créditos ganados!')}</span>
      <strong class="cc-amount">+<b data-cc-count>0</b> créditos</strong>
      <span class="cc-total">Se sumaron a tu saldo${Number.isFinite(total) ? ` · Total <b>${total.toLocaleString('es-MX')}</b>` : ''}</span>
      <small class="cc-hint">Toca para continuar</small>
    </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const counter = overlay.querySelector('[data-cc-count]');
    if (REDUCED_MOTION?.matches) counter.textContent = String(amount);
    else {
      const startAt = performance.now() + 650; const duration = Math.max(600, coins * 260);
      const tick = now => { const t = Math.min(1, Math.max(0, (now - startAt) / duration)); counter.textContent = String(Math.round(amount * t)); if (t < 1 && overlay.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    let closed = false;
    const close = () => { if (closed) return; closed = true; overlay.classList.add('is-closing'); setTimeout(() => overlay.remove(), 380); };
    overlay.addEventListener('click', close);
    setTimeout(close, 3800);
  }
  window.ICADEMCoinChest = { show: showCoinChest };

  function celebrate(big) {
    if (REDUCED_MOTION?.matches) return;
    const wrap = document.createElement('div');
    wrap.className = 'ica-confetti' + (big ? ' is-big' : '');
    const colors = ['#1f6f8b', '#245b74', '#e3a62a', '#ffd96e', '#34d399', '#8fbce6', '#ffffff'];
    wrap.innerHTML = Array.from({ length: big ? 64 : 36 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}vw;--d:${(Math.random() * .5).toFixed(2)}s;--r:${(Math.random() * 720 - 360) | 0}deg;--t:${(1.8 + Math.random() * 1.2).toFixed(2)}s;--c:${colors[i % colors.length]}"></i>`).join('');
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3600);
  }

  function clockText(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function successView(challenge, shell, result, onComplete, onContinue, stats) {
    setStep(shell.modal, 3);
    const completeCourseOnContinue = challenge.scope !== 'reto' && result.courseCompleted === true;
    if (!completeCourseOnContinue) onComplete?.(result);
    const previous = Number(result.previousBalance ?? challenge.balance ?? 0);
    const reward = Number(result.reward ?? challenge.reward ?? 0);
    const next = Number(result.newBalance ?? previous + reward);
    const hasReward = reward > 0;
    const isReto = challenge.scope === 'reto';
    const seconds = Math.max(1, Math.round(stats?.seconds || 0));
    const mistakes = Math.max(0, Number(stats?.mistakes) || 0);
    const par = challenge.type === 'quiz' ? 240 : 120;
    const stars = mistakes === 0 && seconds <= par ? 3 : mistakes <= 1 && seconds <= par * 2 ? 2 : 1;
    const bonus = Math.max(0, (par - seconds) * 2);
    const points = 100 * stars + bonus;
    const titles = ['', '¡Reto resuelto!', '¡Muy bien hecho!', '¡Excelente!'];
    const kicker = isReto ? 'Reto superado' : 'Clase superada';
    const gameName = GAME_META[challenge.type]?.title || GAME_LABELS[challenge.type] || 'Actividad';
    const subtitle = [challenge.displayTitle || challenge.title, isReto ? '' : gameName].filter((v, i, all) => v && all.indexOf(v) === i).join(' · ');
    const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="currentColor"/></svg>';
    const rewardLine = hasReward
      ? `<span class="gw-coin" aria-hidden="true">${CHEST_COIN}</span><span class="gw-reward__copy"><span><b>+${reward} créditos</b> ${isReto ? 'sumados a tu saldo' : 'por superar la clase'}</span><small>Saldo total: <b>${next.toLocaleString('es-MX')}</b> créditos</small></span>`
      : `<span>${isReto ? 'Modo práctica · este reto ya estaba registrado, sin créditos' : 'Modo práctica · esta clase ya había sumado sus créditos'}</span>`;
    const primaryLabel = result.nextLessonNumber ? 'Abrir siguiente clase' : (isReto ? 'Volver a Retos' : (result.courseCompleted ? 'Ver mi certificado' : 'Volver al curso'));
    const anotherLabel = isReto && challenge.experienceId === 'pro' ? 'Elegir otra dinámica' : isReto && challenge.experienceId === 'catalog' ? 'Elegir otro juego' : '';
    shell.modal.classList.add('is-won');
    shell.content.innerHTML = `
      <div class="game-success gw" data-stars="${stars}">
        <div class="gw-stars" aria-label="${stars} de 3 estrellas">${[1, 2, 3].map(n => `<span class="${n <= stars ? 'is-on' : ''}" style="--d:${n * 180}ms">${star}</span>`).join('')}</div>
        <span class="game-kicker gw-kicker">${kicker}</span>
        <h2 id="learning-game-title">${titles[stars]}</h2>
        <p class="gw-sub">${esc(subtitle)}</p>
        <div class="gw-stats">
          <div><span>Tiempo</span><b>${clockText(seconds)}</b></div>
          <div><span>Puntos</span><b>${points}</b>${bonus ? `<small>+${bonus} por rapidez</small>` : ''}</div>
          <div><span>Errores</span><b>${mistakes}</b></div>
        </div>
        <div class="gw-reward${hasReward ? ' is-earned' : ''}" data-reward>${rewardLine}</div>
        ${result.assisted ? '<p class="gw-assisted">Actividad completada con apoyo. Tu clase quedó acreditada y puedes continuar.</p>' : ''}
        ${result.courseCompleted ? `<div class="gw-course"><span aria-hidden="true">🎓</span><div><b>¡Curso completado!</b><small>${result.certificate?.folio ? `Certificado ${esc(result.certificate.folio)} listo para consultar.` : (result.certificatePending ? 'Estamos terminando de emitir tu certificado verificable.' : 'Tu certificado verificable ya está disponible.')}</small></div></div>` : ''}
        ${debriefMarkup(result.debrief)}
        <div class="gw-actions${anotherLabel ? '' : ' is-single'}">
          ${anotherLabel ? `<button class="game-secondary gw-btn" type="button" data-game-another>${anotherLabel}</button>` : ''}
          <button class="game-primary gw-btn gw-btn--primary" type="button" data-game-continue>${primaryLabel} <span aria-hidden="true">→</span></button>
        </div>
      </div>`;
    const continueButton = shell.content.querySelector('[data-game-continue]');
    publishCredits({ ...(window.UserState?.credits || {}), balance: next }, { source: hasReward ? (isReto ? 'reto-game' : 'lesson-game') : 'practice' });
    if (hasReward) {
      creditWalletCache = null;
      celebrate(result.courseCompleted || stars === 3);
      setTimeout(() => showCoinChest({ amount: reward, total: next, title: isReto ? '¡Reto superado!' : '¡Mini juego superado!' }), 450);
      announce(`Ganaste ${reward} créditos. Nuevo saldo: ${next}.`);
    } else {
      celebrate(false);
      announce(`Actividad completada. Tu saldo permanece en ${next} créditos.`);
    }
    continueButton.addEventListener('click', () => {
      shell.close();
      if (completeCourseOnContinue) onComplete?.(result);
      onContinue?.(result);
    });
    shell.content.querySelector('[data-game-another]')?.addEventListener('click', () => {
      shell.close(); onContinue?.(result);
      if (challenge.experienceId === 'pro') openProPicker(); else openPracticePicker();
    });
    continueButton.focus();
  }

  // Abre la ventana del juego al instante (mismo fondo y panel) mientras el
  // servidor prepara el reto; así nunca se ve la página detrás entre clics.
  function openLoadingShell(scope) {
    document.querySelector('.learning-game')?.remove();
    const modal = document.createElement('div');
    modal.className = 'learning-game learning-game--v3 learning-game--loading';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-busy', 'true');
    modal.setAttribute('aria-label', scope === 'reto' ? 'Preparando reto ICADEM' : 'Preparando actividad ICADEM');
    modal.innerHTML = `
      <div class="learning-game__veil" data-game-close></div>
      <section class="learning-game__panel">
        <header class="learning-game__header">
          <div class="learning-game__brand"><span>ICADEM</span><small>${scope === 'reto' ? 'Reto profesional' : 'Actividad de cierre'}</small></div>
          <div class="learning-game__step" aria-hidden="true"><i class="is-current"></i><i></i><i></i></div>
          <button class="learning-game__close" type="button" aria-label="Cancelar">×</button>
        </header>
        <div class="learning-game__content"><div class="lg-loading" role="status"><span class="lg-loading__spin" aria-hidden="true"></span><strong>Preparando tu reto…</strong><div class="lg-loading__sk" aria-hidden="true"><i></i><i></i><i></i></div></div></div>
      </section>`;
    document.body.appendChild(modal);
    document.body.classList.add('has-learning-game');
    const cancel = () => { modal.remove(); if (!document.querySelector('.learning-game, .practice-picker')) document.body.classList.remove('has-learning-game'); };
    modal.querySelector('.learning-game__close').addEventListener('click', cancel);
    modal.querySelector('[data-game-close]').addEventListener('click', cancel);
    return { modal, cancelled: () => !modal.isConnected, done: cancel };
  }

  function startChallenge(challenge, options) {
    return new Promise(resolve => {
      const shell = modalShell(challenge, () => resolve({ closed: true }));
      const playStats = { startedAt: 0, mistakes: 0 };
      const submit = async (proof, frame, submitOptions = {}) => {
        frame.check.disabled = true;
        if (frame.help) frame.help.disabled = true;
        frame.status.textContent = 'Comprobando…';
        try {
          let result;
          if (challenge.local) {
            let correct = false;
            let quizScore = null;
            const proLocal = localProofOk(challenge.type, challenge.solution || {}, proof || {});
            if (typeof proLocal === 'boolean') correct = proLocal;
            else if (challenge.type === 'crossword' || challenge.type === 'guess') correct = normalize(proof.answer) === challenge.solution.answer;
            else if (challenge.type === 'memory') correct = JSON.stringify((proof.pairs || []).slice().sort()) === JSON.stringify(challenge.solution.pairs);
            else if (challenge.type === 'wordsearch') correct = JSON.stringify((proof.words || []).slice().sort()) === JSON.stringify(challenge.solution.words);
            else if (challenge.type === 'puzzle') correct = JSON.stringify(proof.order || []) === JSON.stringify(challenge.solution.order);
            else if (challenge.type === 'classify') correct = Object.keys(challenge.solution.assignments).every(key => proof.assignments?.[key] === challenge.solution.assignments[key]);
            else if (challenge.type === 'quiz') {
              const correctAnswers = Object.entries(challenge.solution.answers || {}).filter(([id, answer]) => {
                const value = proof.answers?.[id];
                return Number.isInteger(value) && value >= 0 && value <= 3 && value === answer;
              }).length;
              quizScore = Math.round((correctAnswers / Math.max(1, Number(challenge.solution.total) || 12)) * 100);
              correct = correctAnswers >= Number(challenge.solution.minCorrect || 0);
            }
            if (!correct) { const error = new Error(quizScore == null ? 'Aún no está correcto. Revisa la actividad e inténtalo otra vez.' : `Obtuviste ${quizScore}%. Necesitas al menos 70%; revisa tus respuestas e inténtalo otra vez.`); error.status = 422; throw error; }
            const reward = Number(challenge.reward) || (challenge.scope === 'reto' ? RETO_CREDITS : CLASS_CREDITS);
            const today = mexicoDateKey();
            const movementId = challenge.demoRewardId || (challenge.scope === 'reto'
              ? challenge.experienceId === 'daily'
                ? `reto:daily:${today}`
                : challenge.experienceId === 'catalog'
                  ? `reto:catalog:${challenge.type}`
                  : challenge.experienceId === 'pro'
                  ? `reto:pro:${challenge.type}:${demoProStatusKey()}`
                  : `reto:${challenge.experienceId}`
              : `practice:${challenge.challengeId}`);
            const demoResult = applyDemoCreditMovement(reward, {
              id: movementId,
              type: challenge.scope === 'reto' ? 'reto-game' : 'lesson-game',
              label: challenge.scope === 'reto' ? 'Reto ICADEM superado' : 'Juego de clase completado',
              detail: challenge.title || GAME_LABELS[challenge.type]
            });
            recordDemoReto(challenge);
            result = { ok: true, reward: demoResult.reward, previousBalance: demoResult.previousBalance, newBalance: demoResult.newBalance, nextLessonNumber: null, practice: true, awarded: demoResult.awarded };
          } else result = await request(challenge.completePath || '/api/learning/complete', {
            method: 'POST',
            body: { challengeId: challenge.challengeId, proof, assisted: submitOptions.assisted === true }
          });
          successView(challenge, shell, result, options?.onComplete, resultData => { options?.onContinue?.(resultData); resolve(resultData); }, { seconds: (Date.now() - (playStats.startedAt || Date.now())) / 1000, mistakes: playStats.mistakes });
        } catch (error) {
          frame.status.textContent = error.message;
          frame.status.classList.add('is-error');
          frame.check.disabled = false;
          if (frame.help) frame.help.disabled = false;
          if (error.status === 422) playStats.mistakes += 1;
          if (error.data?.code === 'challenge-too-fast' && Number(error.data?.retryAfterMs) > 0) {
            const waitMs = Math.max(250, Number(error.data.retryAfterMs) + 120);
            frame.check.disabled = true;
            if (frame.help) frame.help.disabled = true;
            frame.status.classList.remove('is-error');
            frame.status.textContent = 'Guardando tu resultado…';
            setTimeout(() => submit(proof, frame, submitOptions), waitMs);
            return;
          }
          if (challenge.scope !== 'reto' && error.status === 422 && error.data?.assistanceAvailable && frame.assist && frame.help && frame.assist.dataset.stepHelp !== '1') {
            frame.assist.hidden = false;
            frame.help.onclick = () => submit(proof, frame, { assisted: true });
          }
          if (error.data?.code === 'vip-challenge-required') { shell.close(); showRetoPaywall(); return; }
          if (error.data?.code === 'challenge-too-fast') showNotice('Un momento', error.message, 'info');
          else if (error.status !== 422) showNotice('No se perdió tu avance', 'Revisa tu conexión y vuelve a comprobar.', 'error');
        }
      };
      const start = () => {
        playStats.startedAt = Date.now();
        if (challenge.type === 'memory') runMemory(challenge, shell, submit);
        else if (challenge.type === 'crossword' && Array.isArray(challenge.content?.words)) runCrosswordGrid(challenge, shell, submit);
        else if (challenge.type === 'order') runOrder(challenge, shell, submit);
        else if (challenge.type === 'hazard') runHazard(challenge, shell, submit);
        else if (challenge.type === 'spot') runSpot(challenge, shell, submit);
        else if (challenge.type === 'document') runDocument(challenge, shell, submit);
        else if (challenge.type === 'calc') runCalc(challenge, shell, submit);
        else if (challenge.type === 'vmemory') runVisualMemory(challenge, shell, submit);
        else if (challenge.type === 'wordsearch') runWordsearch(challenge, shell, submit);
        else if (challenge.type === 'puzzle') runPuzzle(challenge, shell, submit);
        else if (challenge.type === 'classify') runClassify(challenge, shell, submit);
        else if (challenge.type === 'quiz') runQuiz(challenge, shell, submit);
        else runTextGame(challenge, shell, submit);
      };
      introView(challenge, shell, start);
    });
  }

  async function startLessonChallenge(options) {
    const courseId = String(options?.courseId || '');
    const lessonNumber = Number(options?.lessonNumber);
    let challenge;
    const loader = openLoadingShell('lesson');
    try {
      if (window.__isDemoMode) {
        const types = [...PRACTICE_TYPES, 'quiz'];
        let hash = 0; for (const char of `${courseId}:${lessonNumber}`) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        challenge = localChallenge(types[Math.abs(hash) % types.length], options?.title || `Clase ${lessonNumber}`);
        challenge.reward = CLASS_CREDITS;
        challenge.demoRewardId = `lesson:${courseId}:${lessonNumber}`;
      }
      else challenge = await request('/api/learning/challenge', { method: 'POST', body: { courseId, lessonNumber } });
      if (loader.cancelled()) return { closed: true };
      return startChallenge(challenge, options);
    } catch (error) {
      loader.done();
      showNotice('No pudimos abrir la actividad', error.message, 'error');
      throw error;
    }
  }

  async function startRetoChallenge(options) {
    const type = options?.type === 'pulse' ? 'guess' : String(options?.type || 'guess');
    const experienceId = String(options?.experienceId || type);
    let challenge;
    const loader = openLoadingShell('reto');
    try {
      if (window.__isDemoMode) {
        if (demoRetoAlreadyUsed(experienceId, type)) {
          const error = new Error('Este reto ya fue completado. Cada usuario puede ganarlo una sola vez.');
          error.status = 409;
          error.data = { code: 'reto-already-played' };
          throw error;
        }
        challenge = localChallenge(type, options?.title || GAME_LABELS[type]);
        challenge.reward = RETO_CREDITS;
        challenge.scope = 'reto';
        challenge.experienceId = experienceId;
      } else {
        challenge = await request('/api/retos/challenge', {
          method: 'POST',
          body: { experienceId, gameType: type }
        });
      }
      challenge.scope = 'reto';
      if (options?.title) challenge.displayTitle = options.title;
      challenge.completePath = challenge.completePath || '/api/retos/complete';
      if (loader.cancelled()) return { closed: true };
      return startChallenge(challenge, {
        onComplete: result => {
          options?.onComplete?.(result);
          document.dispatchEvent(new CustomEvent('icadem:reto-completed', { detail: result }));
          const page = document.querySelector('.retos-page');
          if (page) mountRetosStatus(page);
        },
        onContinue: result => {
          options?.onContinue?.(result);
          const page = document.querySelector('.retos-page');
          if (page) mountRetosStatus(page);
        }
      });
    } catch (error) {
      loader.done();
      if (error.data?.code === 'vip-challenge-required') { showRetoPaywall(); throw error; }
      const alreadyPlayed = error.data?.code === 'reto-already-played';
      showNotice(alreadyPlayed ? 'Reto ya completado' : 'No pudimos abrir el reto', error.message, alreadyPlayed ? 'info' : 'error');
      throw error;
    }
  }

  function showRetoPaywall() {
    const title = 'Tu partida gratuita ya terminó';
    const sub = 'Hazte VIP para seguir jugando en Retos ICADEM, practicar sin límites y ganar créditos en cada reto.';
    if (typeof window.__showPaywallModal === 'function') window.__showPaywallModal({ title, sub });
    else showNotice(title, sub, 'info');
    const page = document.querySelector('.retos-page');
    if (page) mountRetosStatus(page);
  }

  function openPractice(type, title) {
    return startRetoChallenge({ experienceId: 'catalog', type, title });
  }

  // Íconos 3D de Juegos ICADEM (assets/mascotas/juegos/).
  const JUEGOS_ICONS = { crossword: '01_crucigrama_tecnico', memory: '02_conecta_conceptos', wordsearch: '03_sopa_de_conceptos', puzzle: '04_rompecabezas_profesional', guess: '05_veredicto_expres', classify: '06_decide_con_criterio' };
  function openPracticePicker() {
    const existing = document.querySelector('.practice-picker'); existing?.remove();
    const liveStatus = window.__icademRetoStatus || {};
    const demoStatus = window.__isDemoMode ? readDemoRetoStatus() : null;
    const usedTypes = new Set(window.__isDemoMode ? demoStatus.catalogTypes : (liveStatus.catalogUsedTypes || []));
    const isAdmin = liveStatus.isAdmin === true;
    const root = document.createElement('div'); root.className = 'practice-picker practice-picker--v3 practice-picker--juegos'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'practice-picker-title');
    root.innerHTML = `<div class="practice-picker__veil" data-practice-close></div><section class="practice-picker__box"><header class="practice-picker__head"><div><span class="game-kicker">Juegos ICADEM</span><h2 id="practice-picker-title">Entrena a tu manera</h2><p>Seis dinámicas profesionales, una recompensa validada por juego.</p></div><button type="button" class="practice-picker__close" data-practice-close aria-label="Cerrar">×</button></header><div class="practice-picker__grid">${PRACTICE_TYPES.map((type, index) => {
      const meta = GAME_META[type] || { eyebrow: 'Práctica', title: GAME_LABELS[type], description: 'Actividad profesional ICADEM.', duration: '2 min', icon: 'i-trophy' };
      const used = !isAdmin && usedTypes.has(type);
      return `<button type="button" class="practice-card${used ? ' is-complete' : ''}" data-practice="${type}" ${used ? 'disabled' : ''}><span class="practice-card__number">0${index + 1}</span><span class="practice-card__icon">${JUEGOS_ICONS[type] ? `<img class="practice-card__art" src="assets/mascotas/juegos/${JUEGOS_ICONS[type]}.webp" alt="" width="256" height="256" decoding="async" draggable="false">` : `<svg class="ic" aria-hidden="true"><use href="#${esc(meta.icon)}"/></svg>`}</span><span class="practice-card__copy"><small>${esc(meta.eyebrow)}</small><strong>${esc(meta.title)}</strong><em>${esc(meta.description)}</em></span><span class="practice-card__foot"><i>${esc(meta.duration)}</i><b>${used ? 'Completado' : `+${RETO_CREDITS} créditos`}</b><svg class="ic" aria-hidden="true"><use href="#${used ? 'i-check' : 'i-arrow-right'}"/></svg></span></button>`;
    }).join('')}</div></section>`;
    document.body.appendChild(root); document.body.classList.add('has-learning-game');
    let releaseA11y = () => {};
    const close = () => { root.remove(); document.body.classList.remove('has-learning-game'); releaseA11y(); };
    releaseA11y = activateDialogA11y(root, close);
    root.querySelectorAll('[data-practice-close]').forEach(button => button.addEventListener('click', close));
    root.querySelectorAll('[data-practice]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.practice;
      close();
      startRetoChallenge({ experienceId: 'catalog', type, title: GAME_LABELS[type] }).catch(() => {});
    }));
    root.querySelector('.practice-card:not(:disabled)')?.focus();
  }

  // Práctica profesional: siete dinámicas visuales y de casos reales; cada
  // una da créditos una vez por semana y su tablero cambia cada semana.
  function demoProStatusKey() { return `icadem:demo:pro:${mexicoDateKey().slice(0, 7)}`; }
  function openProPicker() {
    document.querySelector('.practice-picker')?.remove();
    const liveStatus = window.__icademRetoStatus || {};
    let demoUsed = [];
    if (window.__isDemoMode) { try { demoUsed = JSON.parse(localStorage.getItem(demoProStatusKey()) || '[]'); } catch (_) { demoUsed = []; } }
    const usedTypes = new Set(window.__isDemoMode ? demoUsed : (liveStatus.proUsedTypes || []));
    const isAdmin = liveStatus.isAdmin === true;
    const root = document.createElement('div'); root.className = 'practice-picker practice-picker--v3 practice-picker--pro'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'pro-picker-title');
    root.innerHTML = `<div class="practice-picker__veil" data-practice-close></div><section class="practice-picker__box"><header class="practice-picker__head"><div><span class="game-kicker">Práctica profesional</span><h2 id="pro-picker-title">Practica como en tu trabajo</h2><p>Siete dinámicas con escenas, documentos y casos reales. Cada una da +${RETO_CREDITS} créditos por semana y su tablero cambia cada lunes.</p></div><button type="button" class="practice-picker__close" data-practice-close aria-label="Cerrar">×</button></header><div class="practice-picker__grid">${PRO_TYPES.map((type, index) => {
      const meta = GAME_META[type];
      const used = !isAdmin && usedTypes.has(type);
      const mascot = window.ICADEMMascots?.markup?.(type, 'practice-card__mascot');
      const art = mascot || `<svg class="ic" aria-hidden="true"><use href="#${esc(meta.icon)}"/></svg>`;
      return `<button type="button" class="practice-card${used ? ' is-complete' : ''}" data-pro-type="${type}" ${used ? 'disabled' : ''}><span class="practice-card__number">0${index + 1}</span><span class="practice-card__icon">${art}</span><span class="practice-card__copy"><small>${esc(meta.eyebrow)}</small><strong>${esc(meta.title)}</strong><em>${esc(meta.description)}</em></span><span class="practice-card__foot"><i>${esc(meta.duration)}</i><b>${used ? 'Hecho esta semana' : `+${RETO_CREDITS} créditos`}</b><svg class="ic" aria-hidden="true"><use href="#${used ? 'i-check' : 'i-arrow-right'}"/></svg></span></button>`;
    }).join('')}</div></section>`;
    document.body.appendChild(root); document.body.classList.add('has-learning-game');
    let releaseA11y = () => {};
    const close = () => { root.remove(); document.body.classList.remove('has-learning-game'); releaseA11y(); };
    releaseA11y = activateDialogA11y(root, close);
    root.querySelectorAll('[data-practice-close]').forEach(button => button.addEventListener('click', close));
    root.querySelectorAll('[data-pro-type]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.proType;
      close();
      startRetoChallenge({ experienceId: 'pro', type, title: GAME_META[type].title, onComplete: () => {
        if (!window.__isDemoMode) return;
        try { const list = JSON.parse(localStorage.getItem(demoProStatusKey()) || '[]'); if (!list.includes(type)) list.push(type); localStorage.setItem(demoProStatusKey(), JSON.stringify(list)); } catch (_) {}
      } }).catch(() => {});
    }));
    root.querySelector('.practice-card:not(:disabled)')?.focus();
  }

  async function mountRetosStatus(target) {
    const root = typeof target === 'string' ? document.getElementById(target) : target;
    if (!root) return;
    if (!window.__icademJuegosPreload) { window.__icademJuegosPreload = Object.values(JUEGOS_ICONS).map(name => { const img = new Image(); img.decoding = 'async'; img.src = `assets/mascotas/juegos/${name}.webp`; return img; }); }
    let data;
    if (window.__isDemoMode) {
      const demoStatus = readDemoRetoStatus();
      const today = mexicoDateKey();
      data = { isAdmin: false, used: demoStatus.used, dailyUsedToday: demoStatus.dailyDate === today, catalogUsedCount: demoStatus.catalogTypes.length, catalogUsedTypes: demoStatus.catalogTypes, proUsedTypes: (() => { try { return JSON.parse(localStorage.getItem(demoProStatusKey()) || '[]'); } catch (_) { return []; } })(), balance: Number(localStorage.getItem('icadem:demo:credits') || 200), reward: 5 };
    } else {
      try { data = await request('/api/retos/status'); }
      catch (error) {
        root.querySelector('[data-retos-access]')?.replaceChildren(document.createTextNode('Estado no disponible'));
        return;
      }
    }
    window.__icademRetoStatus = data;
    publishCredits({ ...(window.UserState?.credits || {}), balance: Number(data.balance) || 0 }, { source: 'retos-status' });
    const used = new Set(data.used || []);
    root.querySelectorAll('[data-reto-key]').forEach(card => {
      const key = card.dataset.retoKey;
      const isCatalog = key === 'catalog';
      const isPro = key === 'pro';
      const proDone = Array.isArray(data.proUsedTypes) ? data.proUsedTypes.length : 0;
      const completed = !data.isAdmin && (isPro ? proDone >= PRO_TYPES.length : isCatalog ? Number(data.catalogUsedCount) >= 6 : key === 'daily' ? data.dailyUsedToday : used.has(key));
      if (isPro) {
        const state = card.querySelector('[data-card-state]');
        if (state) state.innerHTML = `<span>7 dinámicas</span><span>${completed ? 'Completada esta semana' : `${proDone}/7 esta semana`}</span>`;
      }
      card.classList.toggle('is-used', completed);
      card.setAttribute('aria-disabled', completed ? 'true' : 'false');
      const state = card.querySelector('[data-card-state]');
      if (state && isCatalog && !completed && Number(data.catalogUsedCount) > 0) {
        state.innerHTML = `<span>6 juegos</span><span>${Number(data.catalogUsedCount)}/6 completados</span>`;
      } else if (state && completed && key === 'daily') {
        state.innerHTML = '<span>12 preguntas</span><span>Completado hoy</span>';
      } else if (state && completed && !isCatalog && !isPro) {
        state.innerHTML = state.classList.contains('retos-tile__state')
          ? '<i></i>Completado'
          : `<span>Reto verificado</span><span>+${RETO_CREDITS} créditos</span>`;
      }
      const cta = card.querySelector('.retos-tile__cta');
      if (cta && completed) {
        cta.disabled = true;
        cta.setAttribute('aria-label', 'Ya completado');
        cta.innerHTML = '<span>Ya completado</span><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>';
      }
    });
    const access = root.querySelector('[data-retos-access]');
    const trial = data.trial || 'vip';
    if (access) {
      access.textContent = data.isAdmin ? 'Administrador · intentos ilimitados'
        : trial === 'available' ? 'Tu primera partida es gratis'
        : trial === 'active' ? 'Partida gratuita en curso'
        : trial === 'used' ? 'Partida gratuita usada · Hazte VIP'
        : 'Un intento por reto';
      access.classList.toggle('is-locked', trial === 'used');
    }
    const note = root.querySelector('[data-retos-access-note]');
    if (note) {
      note.hidden = trial === 'vip';
      note.textContent = trial === 'available' ? `Tienes 1 partida gratis que sí da créditos (+${RETO_CREDITS}). Después, solo VIP.`
        : trial === 'active' ? 'Termina tu partida gratis para ganar tus créditos.'
        : trial === 'used' ? 'Ya usaste tu partida gratis. Hazte VIP para seguir jugando.'
        : '';
    }
    root.classList.toggle('has-access-note', trial !== 'vip');
  }

  async function mountRanking(target) {
    const root = typeof target === 'string' ? document.getElementById(target) : target;
    if (!root) return;
    root.innerHTML = '<div class="ranking-loading">Cargando clasificación…</div>';
    try {
      const data = window.__isDemoMode ? {
        currentUid: 'demo',
        items: [
          { position: 1, uid: 'demo-1', nombre: 'Mariana López', iniciales: 'ML', nivel: 'Profesional', xp: 860, isVip: true },
          { position: 2, uid: 'demo-2', nombre: 'Carlos Méndez', iniciales: 'CM', nivel: 'Técnico', xp: 620, isVip: true },
          { position: 3, uid: 'demo', nombre: 'Tu posición', iniciales: 'TÚ', nivel: 'Aprendiz', xp: 285, isVip: false },
          { position: 4, uid: 'demo-4', nombre: 'Daniela Ramírez', iniciales: 'DR', nivel: 'Técnico', xp: 210, isVip: true },
          { position: 5, uid: 'demo-5', nombre: 'Edgar Hernández', iniciales: 'EH', nivel: 'Aprendiz', xp: 175, isVip: false },
          { position: 6, uid: 'demo-6', nombre: 'Edna Martínez', iniciales: 'EM', nivel: 'Aprendiz', xp: 140, isVip: true },
          { position: 7, uid: 'demo-7', nombre: 'Jesús Mateos', iniciales: 'JM', nivel: 'Aprendiz', xp: 95, isVip: true },
          { position: 8, uid: 'demo-8', nombre: 'Leslie López', iniciales: 'LL', nivel: 'Aprendiz', xp: 65, isVip: false }
        ]
      } : await loadRanking();
      const current = data.currentUid;
      const items = data.items || [];
      const avatar = (item, className) => `<span class="${className}">${item.foto ? `<img src="${esc(item.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc(item.iniciales || '?')}</span>`;
      const badge = item => `<span class="ranking-badge ranking-badge--${item.isVip ? 'vip' : 'member'}">${item.isVip ? '★ VIP' : 'Miembro'}</span>`;
      const podium = items.slice(0, 3);
      const visibleRows = items.slice(3, 10);
      const currentItem = items.find(item => item.uid === current);
      if (currentItem && currentItem.position > 10) visibleRows.push(currentItem);
      root.innerHTML = `<section class="ranking-card ranking-card--club">
        <header class="ranking-head">
          <span class="game-kicker">Avance verificado</span>
          <h2>Clasificación del club</h2>
          <p>Todo tu avance desde que entraste a ICADEM. Gana XP en Retos: cada reto o juego completado suma <strong>+5</strong>.</p>
        </header>
        ${podium.length ? `<div class="ranking-podium" aria-label="Los tres primeros lugares">${podium.map(item => `<article class="ranking-podium__card ranking-podium__card--${item.position}${item.uid === current ? ' is-me' : ''}">
          <b class="ranking-podium__position">#${item.position}</b>
          ${avatar(item, 'ranking-podium__avatar')}
          <strong class="ranking-podium__name">${esc(item.nombre)}</strong>
          ${badge(item)}
          <small>${esc(item.nivel)}</small>
          <b class="ranking-podium__xp">${Number(item.xp) || 0} XP</b>
        </article>`).join('')}</div>` : '<p class="ranking-empty">Aún no hay actividad para mostrar.</p>'}
        ${visibleRows.length ? `<div class="ranking-list">${visibleRows.map(item => `<article class="ranking-row${item.uid === current ? ' is-me' : ''}"><b class="ranking-row__pos">#${item.position}</b>${avatar(item, 'ranking-row__avatar')}<span class="ranking-row__name"><strong>${esc(item.nombre)}</strong><small>${esc(item.nivel)}</small></span>${badge(item)}<strong class="ranking-row__xp">${Number(item.xp) || 0} XP</strong></article>`).join('')}</div>` : ''}
        <footer class="ranking-foot"><span aria-hidden="true">♢</span> Solo mostramos nombre, foto y avance; nunca datos de contacto.</footer>
      </section>`;
    } catch (error) {
      root.innerHTML = `<div class="ranking-error"><strong>No pudimos cargar la clasificación.</strong><button type="button">Reintentar</button></div>`;
      root.querySelector('button')?.addEventListener('click', () => mountRanking(root));
    }
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-credit-wallet-open]');
    if (!trigger) return;
    event.preventDefault();
    openCreditWallet();
  });

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-platform-game]');
    if (!trigger) return;
    event.preventDefault();
    if (trigger.getAttribute('aria-disabled') === 'true') {
      showNotice('Reto ya completado', 'Cada usuario puede superar este reto una sola vez.', 'info');
      return;
    }
    const type = trigger.dataset.platformGame;
    if (type === 'catalog') openPracticePicker();
    else if (type === 'pro') openProPicker();
    else startRetoChallenge({
      experienceId: trigger.dataset.retoKey || type,
      type,
      title: trigger.dataset.gameTitle || trigger.textContent.trim()
    }).catch(() => {});
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-lesson-complete]');
    if (!button || button.classList.contains('is-complete') || button.dataset.gameBusy === '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const courseId = button.dataset.courseId;
    const lessonNumber = Number(button.dataset.lessonNumber);
    if (!courseId || !lessonNumber) return;
    button.dataset.gameBusy = '1';
    button.disabled = true;
    button.textContent = 'Preparando actividad…';
    startLessonChallenge({
      courseId,
      lessonNumber,
      title: button.dataset.lessonTitle || `Clase ${lessonNumber}`,
      onComplete: result => {
        window.marcarClaseVista?.(courseId, lessonNumber);
        loadLearningProgress().catch(() => {});
        document.dispatchEvent(new CustomEvent('icadem:lesson-completed', { detail: { courseId, lessonNumber, result } }));
      },
      onContinue: result => window.__continuarTrasJuegoClase?.(courseId, lessonNumber, result)
    }).then(result => {
      if (!result?.closed || !button.isConnected) return;
      button.dataset.gameBusy = '';
      button.disabled = false;
      button.textContent = 'Marcar vista y seguir';
    }).catch(() => {
      button.dataset.gameBusy = '';
      button.disabled = false;
      button.textContent = 'Marcar vista y seguir';
    });
  }, true);
  document.addEventListener('keydown', event => {
    const trigger = event.target.closest?.('[data-platform-game]');
    if (!trigger || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault(); trigger.click();
  });
  document.addEventListener('icadem:user-ready', () => syncIdentity());
  let lastVisibleIdentitySync = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !window.__isDemoMode && window.__currentUser) {
      loadCreditWallet(true).catch(() => {});
      if (Date.now() - lastVisibleIdentitySync > 5 * 60 * 1000) {
        lastVisibleIdentitySync = Date.now();
        syncIdentity(true).catch(() => {});
      } else if (Date.now() - lastProgressLoad > 45 * 1000) {
        // Al volver a la pestaña (p. ej. tras avanzar en la PC) trae el avance real.
        loadLearningProgress().catch(() => {});
      }
    }
  });
  if (window.__currentUser) syncIdentity();

  window.ICADEMPlatform = {
    request, syncIdentity, applyIdentity, loadDirectory, loadRanking, loadCourseCatalog, loadLibrary, redeemBook, loadMaterials, redeemMaterial, selectFreeCourse, markFreeCourseOfferSeen, claimExperience, markMembershipWelcomeSeen,
    createForumPost, deleteForumPost, toggleForumLike, createForumComment, deleteForumComment, mountRanking,
    loadLearningProgress,
    loadCreditWallet, openCreditWallet, applyDemoCreditMovement, syncCreditSnapshot,
    saveProfile, markProfileIntakeSeen, startLessonChallenge, startRetoChallenge, openPractice, openPracticePicker, openProPicker, mountRetosStatus
  };
})();
