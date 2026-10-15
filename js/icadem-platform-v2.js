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

  async function request(path, options) {
    const authToken = await token();
    const config = { method: options?.method || 'GET', headers: { Accept: 'application/json' } };
    if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
    if (options?.body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(options.body);
    }
    const response = await fetch(`${API}${path}`, config);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
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
        { id: 'materials', label: 'Materiales profesionales', description: 'Canjea formatos prácticos desde 25 créditos.', available: true, section: 'materiales', count: 6 },
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
        <span class="credit-vault__gem" aria-hidden="true"><i></i></span>
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
          <small>Resuelve con calma · tu avance se valida al comprobar</small>
        </div>
        <section class="game-stage">
          <div class="game-status" aria-live="polite"></div>
          <div class="game-board">${inner}</div>
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
      reset: shell.content.querySelector('[data-game-reset]')
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
    frame.check.addEventListener('click', () => submit({ answer: input.value }, frame));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') frame.check.click(); });
    frame.reset.addEventListener('click', () => { input.value = ''; frame.status.textContent = ''; frame.status.classList.remove('is-error'); input.focus(); });
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
    let open = [], matched = [];
    frame.board.querySelectorAll('.memory-card').forEach(card => card.addEventListener('click', () => {
      if (card.classList.contains('is-open') || card.classList.contains('is-matched') || open.length === 2) return;
      card.classList.add('is-open'); card.setAttribute('aria-label', card.textContent.trim()); open.push(card);
      if (open.length === 2) {
        if (open[0].dataset.pair === open[1].dataset.pair) {
          const id = open[0].dataset.pair;
          setTimeout(() => { open.forEach(x => { x.classList.add('is-matched'); x.disabled = true; x.setAttribute('aria-label', `Pareja encontrada: ${x.textContent.trim()}`); }); matched.push(id); open = []; announce('Pareja encontrada'); }, 260);
        } else setTimeout(() => { open.forEach(x => { x.classList.remove('is-open'); x.setAttribute('aria-label', 'Carta oculta'); }); open = []; }, 650);
      }
    }));
    frame.check.addEventListener('click', () => submit({ pairs: [...new Set(matched)] }, frame));
    frame.reset.addEventListener('click', () => runMemory(challenge, shell, submit));
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
    const grid = challenge.content?.grid || [];
    const words = challenge.content?.words || [];
    const frame = gameFrame(challenge, shell, `
      <div class="wordsearch"><div class="wordsearch__list">${words.map(w => `<span data-word="${esc(w)}">${esc(w)}</span>`).join('')}</div>
      <div class="wordsearch__grid" style="--grid:${grid.length || 10}">${grid.flatMap((row,r) => row.map((letter,c) => `<button type="button" data-cell="${r}-${c}" aria-label="Fila ${r+1}, columna ${c+1}, ${esc(letter)}">${esc(letter)}</button>`)).join('')}</div></div>`);
    let start = null, found = [];
    const select = cell => {
      const pos = cell.dataset.cell.split('-').map(Number);
      if (!start) { start = pos; cell.classList.add('is-start'); return; }
      const result = wordAt(grid, start, pos); start = null;
      frame.board.querySelectorAll('.is-start').forEach(x => x.classList.remove('is-start'));
      if (!result) { frame.status.textContent = 'Elige una línea horizontal, vertical o diagonal.'; return; }
      const forward = normalize(result.word), backward = [...forward].reverse().join('');
      const match = words.find(w => !found.includes(w) && (normalize(w) === forward || normalize(w) === backward));
      if (!match) { frame.status.textContent = 'Esa secuencia no corresponde a un término pendiente.'; return; }
      found.push(match); result.cells.forEach(id => frame.board.querySelector(`[data-cell="${id}"]`)?.classList.add('is-found'));
      frame.board.querySelector(`[data-word="${CSS.escape(match)}"]`)?.classList.add('is-found');
      frame.status.textContent = `${found.length} de ${words.length} términos encontrados.`;
    };
    let dragStart = null, suppressClick = false;
    frame.board.querySelectorAll('[data-cell]').forEach(cell => cell.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      select(cell);
    }));
    const gridEl = frame.board.querySelector('.wordsearch__grid');
    gridEl.addEventListener('pointerdown', event => {
      const cell = event.target.closest('[data-cell]');
      if (cell) dragStart = cell.dataset.cell.split('-').map(Number);
    });
    gridEl.addEventListener('pointerup', event => {
      const endCell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]');
      if (!dragStart || !endCell || dragStart.join('-') === endCell.dataset.cell) { dragStart = null; return; }
      start = dragStart; dragStart = null; suppressClick = true; select(endCell);
    });
    frame.check.addEventListener('click', () => submit({ words: found.slice().sort() }, frame));
    frame.reset.addEventListener('click', () => runWordsearch(challenge, shell, submit));
  }

  function runPuzzle(challenge, shell, submit) {
    const size = Number(challenge.content?.size) || 3;
    const order = Array.from({ length: size * size }, (_, i) => i).sort(() => Math.random() - .5);
    if (order.every((n, i) => n === i)) [order[0], order[1]] = [order[1], order[0]];
    const image = challenge.content?.image || '';
    const frame = gameFrame(challenge, shell, `<div class="puzzle-wrap${image ? ' has-ref' : ''}"><div class="puzzle-grid" style="--puzzle-size:${size}"></div>${image ? `<figure class="puzzle-ref"><img src="${encodeURI(image).replace(/'/g, '%27')}" alt="" decoding="async"><figcaption>Imagen de referencia</figcaption></figure>` : ''}</div><p class="game-hint">Toca dos piezas para intercambiarlas.</p>`);
    let selected = null;
    const paint = () => {
      const grid = frame.board.querySelector('.puzzle-grid');
      grid.innerHTML = order.map((piece, pos) => {
        const x = (piece % size) * 100 / Math.max(1, size - 1), y = Math.floor(piece / size) * 100 / Math.max(1, size - 1);
        const style = image ? `background-image:url('${encodeURI(image).replace(/'/g,'%27')}');background-position:${x}% ${y}%;background-size:${size * 100}% ${size * 100}%` : '';
        return `<button type="button" data-pos="${pos}" class="puzzle-piece${selected === pos ? ' is-selected' : ''}" style="${style}" aria-label="Pieza ${piece + 1}">${image ? '' : piece + 1}</button>`;
      }).join('');
      grid.querySelectorAll('[data-pos]').forEach(btn => btn.addEventListener('click', () => {
        const pos = Number(btn.dataset.pos);
        if (selected == null) selected = pos;
        else { [order[selected], order[pos]] = [order[pos], order[selected]]; selected = null; }
        paint();
      }));
    };
    paint();
    frame.check.addEventListener('click', () => submit({ order }, frame));
    frame.reset.addEventListener('click', () => runPuzzle(challenge, shell, submit));
  }

  function runClassify(challenge, shell, submit) {
    const content = challenge.content || { categories: [], items: [] };
    const assignments = {};
    const frame = gameFrame(challenge, shell, `
      <div class="classify"><div class="classify__items">${(content.items || []).map(item => `<button type="button" draggable="true" data-item="${esc(item.id)}">${esc(item.label)}</button>`).join('')}</div>
      <div class="classify__zones">${(content.categories || []).map(cat => `<section data-category="${esc(cat)}" role="group" tabindex="0" aria-label="Asignar tarjeta seleccionada a ${esc(cat)}"><h3>${esc(cat)}</h3><div></div></section>`).join('')}</div></div>`);
    let selected = null;
    const assign = (item, category) => {
      assignments[item.dataset.item] = category;
      const zone = frame.board.querySelector(`[data-category="${CSS.escape(category)}"] div`);
      zone.appendChild(item); item.classList.add('is-assigned'); item.classList.remove('is-selected'); selected = null;
      frame.status.textContent = `${Object.keys(assignments).length} de ${content.items.length} tarjetas clasificadas.`;
    };
    frame.board.querySelectorAll('[data-item]').forEach(item => {
      item.addEventListener('click', event => {
        // Con otra tarjeta seleccionada, tocar una ya clasificada equivale a tocar su categoría.
        if (selected && selected !== item && item.classList.contains('is-assigned')) return;
        event.stopPropagation();
        selected = item; frame.board.querySelectorAll('[data-item]').forEach(x => x.classList.toggle('is-selected', x === item));
      });
      item.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', item.dataset.item));
    });
    frame.board.querySelectorAll('[data-category]').forEach(zone => {
      zone.addEventListener('click', () => { if (selected) assign(selected, zone.dataset.category); });
      zone.addEventListener('keydown', event => { if (selected && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); assign(selected, zone.dataset.category); } });
      zone.addEventListener('dragover', event => event.preventDefault());
      zone.addEventListener('drop', event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const item = frame.board.querySelector(`[data-item="${CSS.escape(id)}"]`); if (item) assign(item, zone.dataset.category); });
    });
    frame.check.addEventListener('click', () => {
      const pending = (content.items || []).length - Object.keys(assignments).length;
      if (pending > 0) { frame.status.textContent = `Te ${pending === 1 ? 'falta 1 tarjeta' : `faltan ${pending} tarjetas`} por clasificar.`; frame.status.classList.add('is-error'); return; }
      submit({ assignments }, frame);
    });
    frame.reset.addEventListener('click', () => runClassify(challenge, shell, submit));
  }

  function runQuiz(challenge, shell, submit) {
    const questions = Array.isArray(challenge.content?.questions) ? challenge.content.questions : [];
    const answers = {};
    let index = 0;
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
        <div class="quiz-game__options" role="radiogroup" aria-label="Opciones de respuesta">${(question.options || []).map((option, optionIndex) => `<button type="button" role="radio" aria-checked="${selected === optionIndex}" tabindex="${selected == null ? (optionIndex === 0 ? 0 : -1) : (selected === optionIndex ? 0 : -1)}" class="${selected === optionIndex ? 'is-selected' : ''}" data-quiz-option="${optionIndex}"><b>${String.fromCharCode(65 + optionIndex)}</b><span>${esc(option)}</span></button>`).join('')}</div>
        <div class="quiz-game__nav"><button type="button" data-quiz-prev ${index === 0 ? 'disabled' : ''}>Pregunta anterior</button><small>${Object.keys(answers).length} respondidas</small></div>
      </div>`;
      frame.check.innerHTML = `${index === questions.length - 1 ? 'Comprobar resultado' : 'Siguiente pregunta'} <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>`;
      frame.status.textContent = selected == null ? 'Elige una respuesta para continuar.' : 'Respuesta guardada.';
      frame.status.classList.remove('is-error');
      const optionButtons = Array.from(frame.board.querySelectorAll('[data-quiz-option]'));
      const choose = button => { answers[question.id] = Number(button.dataset.quizOption); paint(true); };
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
    frame.check.addEventListener('click', () => {
      const question = questions[index];
      if (!question || answers[question.id] == null) {
        frame.status.textContent = 'Selecciona una respuesta antes de continuar.';
        frame.status.classList.add('is-error');
        return;
      }
      if (index < questions.length - 1) { index += 1; paint(); return; }
      submit({ answers }, frame);
    });
    frame.reset.addEventListener('click', () => { Object.keys(answers).forEach(key => delete answers[key]); index = 0; paint(); });
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
    let active = words[0]?.id;
    const wordById = id => words.find(w => w.id === id);
    const highlight = () => {
      frame.board.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
      const w = wordById(active); if (!w) return;
      cellsOf(w).forEach(k => input(k)?.parentElement.classList.add('is-active'));
      frame.board.querySelector(`[data-clue="${CSS.escape(w.id)}"]`)?.classList.add('is-active');
    };
    const wordsAt = k => words.filter(w => cellsOf(w).includes(k));
    frame.board.querySelectorAll('input').forEach(el => {
      el.addEventListener('focus', () => { const opts = wordsAt(el.dataset.k); if (!opts.some(w => w.id === active)) active = opts[0].id; highlight(); });
      el.addEventListener('click', () => { const opts = wordsAt(el.dataset.k); if (opts.length > 1) { active = (opts.find(w => w.id !== active) || opts[0]).id; highlight(); } });
      el.addEventListener('input', () => {
        el.value = normalize(el.value).replace(/[^A-Z]/g, '').slice(-1);
        if (!el.value) return;
        const list = cellsOf(wordById(active)); const next = list[list.indexOf(el.dataset.k) + 1];
        if (next) input(next)?.focus();
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
      submit({ answers }, frame);
    });
    frame.reset.addEventListener('click', () => runCrosswordGrid(challenge, shell, submit));
    highlight();
  }

  function runOrder(challenge, shell, submit) {
    const c = challenge.content || {};
    let steps = (c.steps || []).slice();
    const frame = gameFrame(challenge, shell, `<div class="ord4"><p class="ord4__prompt">${esc(c.prompt || 'Ordena el proceso')}</p><ol class="ord4__list"></ol></div>`);
    const list = frame.board.querySelector('.ord4__list');
    const paint = focusId => {
      list.innerHTML = steps.map((s, i) => `<li data-step="${esc(s.id)}"><b>${i + 1}</b><span>${esc(s.text)}</span><div class="ord4__moves"><button type="button" data-move="-1" aria-label="Subir paso" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" aria-label="Bajar paso" ${i === steps.length - 1 ? 'disabled' : ''}>↓</button></div></li>`).join('');
      if (focusId) list.querySelector(`[data-step="${CSS.escape(focusId.id)}"] [data-move="${focusId.dir}"]:not(:disabled)`)?.focus();
    };
    list.addEventListener('click', event => {
      const btn = event.target.closest('[data-move]'); if (!btn) return;
      const id = btn.closest('[data-step]').dataset.step; const i = steps.findIndex(s => s.id === id); const j = i + Number(btn.dataset.move);
      if (j < 0 || j >= steps.length) return;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      frame.status.textContent = ''; frame.status.classList.remove('is-error');
      paint({ id, dir: btn.dataset.move });
    });
    paint();
    frame.check.addEventListener('click', () => submit({ order: steps.map(s => s.id) }, frame));
    frame.reset.addEventListener('click', () => runOrder(challenge, shell, submit));
  }

  function pointPercent(el, event) { const r = el.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width * 100, y: (event.clientY - r.top) / r.height * 100 }; }

  function runHazard(challenge, shell, submit) {
    const c = challenge.content || {};
    const items = Array.isArray(c.items) ? c.items : [];
    const found = [];
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
      frame.status.textContent = n === items.length ? '¡Encontraste todas! Pulsa Comprobar.' : `¡Bien visto! ${it.label}.`;
      announce(it.label);
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
        round += 1; setTimeout(() => { locked = false; show(); }, 900); return;
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
  }

  function runDocument(challenge, shell, submit) {
    const c = challenge.content || {};
    const fields = Array.isArray(c.fields) ? c.fields : [];
    const flagged = new Set();
    const frame = gameFrame(challenge, shell, `<div class="doc4"><p class="doc4__intro">Este documento tiene <b>${Number(c.errorCount) || 3} errores</b>. Toca los datos incorrectos para marcarlos.</p>
      <article class="doc4__paper"><header><small>${esc(c.docType || 'Documento')}</small><strong>${esc(c.title || '')}</strong>${c.subtitle ? `<em>${esc(c.subtitle)}</em>` : ''}</header>
      <div class="doc4__fields">${fields.map(f => `<button type="button" class="doc4__field" data-field="${esc(f.id)}" aria-pressed="false"><span>${esc(f.label)}</span><b>${esc(f.value)}</b><i aria-hidden="true">!</i></button>`).join('')}</div></article>
      <p class="doc4__count"><span data-doc-count>0</span> de ${Number(c.errorCount) || 3} marcados</p></div>`);
    frame.board.querySelectorAll('[data-field]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.field;
      if (flagged.has(id)) flagged.delete(id); else flagged.add(id);
      btn.classList.toggle('is-flagged', flagged.has(id)); btn.setAttribute('aria-pressed', String(flagged.has(id)));
      frame.board.querySelector('[data-doc-count]').textContent = String(flagged.size);
      frame.status.textContent = ''; frame.status.classList.remove('is-error');
    }));
    frame.check.addEventListener('click', () => {
      if (!flagged.size) { frame.status.textContent = 'Marca al menos un dato antes de comprobar.'; frame.status.classList.add('is-error'); return; }
      submit({ flagged: [...flagged] }, frame);
    });
    frame.reset.addEventListener('click', () => runDocument(challenge, shell, submit));
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
    input.addEventListener('keydown', event => { if (event.key === 'Enter') frame.check.click(); });
    frame.check.addEventListener('click', () => {
      const raw = input.value.trim();
      if (!raw) { frame.status.textContent = 'Escribe tu resultado antes de comprobar.'; frame.status.classList.add('is-error'); return; }
      submit({ value: raw.replace(/[^0-9.,-]/g, '') }, frame);
    });
    frame.reset.addEventListener('click', () => { input.value = ''; frame.status.textContent = ''; frame.status.classList.remove('is-error'); input.focus(); });
  }

  function runVisualMemory(challenge, shell, submit) {
    const cards = [];
    (challenge.content?.pairs || []).forEach(pair => {
      cards.push({ key: `${pair.id}-img`, id: pair.id, image: pair.image });
      cards.push({ key: `${pair.id}-txt`, id: pair.id, text: pair.label });
    });
    const deck = shuffleLocal(cards);
    const frame = gameFrame(challenge, shell, `<div class="vm4">${deck.map(card => `<button type="button" class="vm4__card" data-pair="${esc(card.id)}" aria-label="Carta oculta"><span class="vm4__back">ICA</span><span class="vm4__front${card.image ? ' is-image' : ''}">${card.image ? `<img src="${imgUrl(card.image)}" alt="" decoding="async">` : esc(card.text)}</span></button>`).join('')}</div>`);
    let open = [], matched = [];
    frame.board.querySelectorAll('.vm4__card').forEach(card => card.addEventListener('click', () => {
      if (card.classList.contains('is-open') || card.classList.contains('is-matched') || open.length === 2) return;
      card.classList.add('is-open'); open.push(card);
      if (open.length < 2) return;
      if (open[0].dataset.pair === open[1].dataset.pair) {
        const id = open[0].dataset.pair;
        setTimeout(() => { open.forEach(x => { x.classList.add('is-matched'); x.disabled = true; }); matched.push(id); open = []; frame.status.textContent = `${matched.length} de ${challenge.content.pairs.length} parejas.`; announce('Pareja encontrada'); }, 280);
      } else setTimeout(() => { open.forEach(x => x.classList.remove('is-open')); open = []; }, 800);
    }));
    frame.check.addEventListener('click', () => submit({ pairs: [...new Set(matched)] }, frame));
    frame.reset.addEventListener('click', () => runVisualMemory(challenge, shell, submit));
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

  function successView(challenge, shell, result, onComplete, onContinue) {
    setStep(shell.modal, 3);
    onComplete?.(result);
    const previous = Number(result.previousBalance ?? challenge.balance ?? 0);
    const reward = Number(result.reward ?? challenge.reward ?? 0);
    const next = Number(result.newBalance ?? previous + reward);
    const hasReward = reward > 0;
    shell.content.innerHTML = `
      <div class="game-success">
        <span class="game-kicker">Actividad superada</span>
        <h2 id="learning-game-title">${challenge.scope === 'reto' ? 'Reto superado' : 'Clase completada'}</h2>
        <p>${hasReward ? (challenge.scope === 'reto' ? 'Tu resultado y tus créditos ya quedaron guardados.' : 'Tu avance y tu recompensa ya quedaron guardados.') : 'Práctica completada. Este intento no modifica tus créditos ni la clasificación.'}</p>
        ${debriefMarkup(result.debrief)}
        ${hasReward ? `
          <button class="reward-chest" type="button" data-open-chest aria-label="Abrir recompensa"><span class="reward-chest__lid"></span><span class="reward-chest__box">ICA</span></button>
          <div class="reward-summary" hidden>
            <span>Recompensa</span><strong>+<b data-reward-count>0</b> créditos</strong>
            <div><small>Saldo anterior <b>${previous}</b></small><i>→</i><small>Nuevo saldo <b>${next}</b></small></div>
          </div>` : `
          <div class="reward-summary reward-summary--practice">
            <span>Modo práctica</span><strong>Sesión completada</strong>
            <div><small>Tu saldo permanece en</small><small><b>${next}</b> créditos</small></div>
          </div>`}
        <button class="game-primary" type="button" data-game-continue${hasReward ? ' disabled' : ''}>${result.nextLessonNumber ? 'Continuar a la siguiente clase' : (challenge.scope === 'reto' ? 'Volver a Retos' : 'Volver al curso')}</button>
      </div>`;
    const chest = shell.content.querySelector('[data-open-chest]');
    const summary = shell.content.querySelector('.reward-summary');
    const continueButton = shell.content.querySelector('[data-game-continue]');
    if (!hasReward) {
      publishCredits({ ...(window.UserState?.credits || {}), balance: next }, { source: 'practice' });
      announce(`Práctica completada. Tu saldo permanece en ${next} créditos.`);
      continueButton.focus();
    } else chest.addEventListener('click', () => {
      if (chest.classList.contains('is-open')) return;
      chest.classList.add('is-open'); summary.hidden = false; continueButton.disabled = false;
      const counter = shell.content.querySelector('[data-reward-count]');
      if (REDUCED_MOTION?.matches || reward <= 0) counter.textContent = String(reward);
      else {
        let value = 0;
        const interval = setInterval(() => { value += Math.max(1, Math.ceil(reward / 12)); counter.textContent = String(Math.min(reward, value)); if (value >= reward) clearInterval(interval); }, 70);
      }
      publishCredits({ ...(window.UserState?.credits || {}), balance: next }, { source: challenge.scope === 'reto' ? 'reto-game' : 'lesson-game' });
      creditWalletCache = null;
      announce(`Ganaste ${reward} créditos. Nuevo saldo: ${next}.`);
    });
    continueButton.addEventListener('click', () => { shell.close(); onContinue?.(result); });
    if (hasReward) chest.focus();
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
      const submit = async (proof, frame) => {
        frame.check.disabled = true;
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
          } else result = await request(challenge.completePath || '/api/learning/complete', { method: 'POST', body: { challengeId: challenge.challengeId, proof } });
          successView(challenge, shell, result, options?.onComplete, resultData => { options?.onContinue?.(resultData); resolve(resultData); });
        } catch (error) {
          frame.status.textContent = error.message;
          frame.status.classList.add('is-error');
          frame.check.disabled = false;
          if (error.data?.code === 'challenge-too-fast') showNotice('Un momento', error.message, 'info');
          else if (error.status !== 422) showNotice('No se perdió tu avance', 'Revisa tu conexión y vuelve a comprobar.', 'error');
        }
      };
      const start = () => {
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
      const alreadyPlayed = error.data?.code === 'reto-already-played';
      showNotice(alreadyPlayed ? 'Reto ya completado' : 'No pudimos abrir el reto', error.message, alreadyPlayed ? 'info' : 'error');
      throw error;
    }
  }

  function openPractice(type, title) {
    return startRetoChallenge({ experienceId: 'catalog', type, title });
  }

  function openPracticePicker() {
    const existing = document.querySelector('.practice-picker'); existing?.remove();
    const liveStatus = window.__icademRetoStatus || {};
    const demoStatus = window.__isDemoMode ? readDemoRetoStatus() : null;
    const usedTypes = new Set(window.__isDemoMode ? demoStatus.catalogTypes : (liveStatus.catalogUsedTypes || []));
    const isAdmin = liveStatus.isAdmin === true;
    const root = document.createElement('div'); root.className = 'practice-picker practice-picker--v3'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'practice-picker-title');
    root.innerHTML = `<div class="practice-picker__veil" data-practice-close></div><section class="practice-picker__box"><header class="practice-picker__head"><div><span class="game-kicker">Juegos ICADEM</span><h2 id="practice-picker-title">Entrena a tu manera</h2><p>Seis dinámicas profesionales, una recompensa validada por juego.</p></div><button type="button" class="practice-picker__close" data-practice-close aria-label="Cerrar">×</button></header><div class="practice-picker__grid">${PRACTICE_TYPES.map((type, index) => {
      const meta = GAME_META[type] || { eyebrow: 'Práctica', title: GAME_LABELS[type], description: 'Actividad profesional ICADEM.', duration: '2 min', icon: 'i-trophy' };
      const used = !isAdmin && usedTypes.has(type);
      return `<button type="button" class="practice-card${used ? ' is-complete' : ''}" data-practice="${type}" ${used ? 'disabled' : ''}><span class="practice-card__number">0${index + 1}</span><span class="practice-card__icon"><svg class="ic" aria-hidden="true"><use href="#${esc(meta.icon)}"/></svg></span><span class="practice-card__copy"><small>${esc(meta.eyebrow)}</small><strong>${esc(meta.title)}</strong><em>${esc(meta.description)}</em></span><span class="practice-card__foot"><i>${esc(meta.duration)}</i><b>${used ? 'Completado' : `+${RETO_CREDITS} créditos`}</b><svg class="ic" aria-hidden="true"><use href="#${used ? 'i-check' : 'i-arrow-right'}"/></svg></span></button>`;
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
    if (access) access.textContent = data.isAdmin ? 'Administrador · intentos ilimitados' : 'Un intento por reto';
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
    const nextIndex = Number(button.dataset.nextIndex);
    if (!courseId || !lessonNumber) return;
    button.dataset.gameBusy = '1';
    button.disabled = true;
    button.textContent = 'Preparando actividad…';
    startLessonChallenge({
      courseId,
      lessonNumber,
      title: button.dataset.lessonTitle || `Clase ${lessonNumber}`,
      onComplete: () => window.marcarClaseVista?.(courseId, lessonNumber),
      onContinue: () => {
        if (nextIndex >= 0) window.abrirClaseICADEM?.(courseId, nextIndex);
        else window.__volverACurso?.(courseId);
      }
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
