/* Mis desbloqueos: el servidor conserva y consume todos los derechos. */
(function () {
  'use strict';
  let generation = 0, summary = null, summaryUid = '', pending = null, dialog = null;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const owner = () => window.__isDemoMode ? '' : (window.__auth ? window.__auth.currentUser?.uid : window.__currentUser?.uid) || '';
  const scope = () => ({ uid: owner(), generation });
  const current = ticket => Boolean(ticket.uid && ticket.uid === owner() && ticket.generation === generation && !window.__sessionEnding);
  const state = () => summaryUid === owner() ? summary : null;
  const getPriorities = () => { const data = state(); return owner() && !window.__sessionEnding && data && data.enabled !== false && Array.isArray(data.priorities) ? [...data.priorities] : []; };
  const getSummary = () => { const data = state(); return owner() && !window.__sessionEnding && data ? JSON.parse(JSON.stringify(data)) : null; };
  const count = value => Math.max(0, Math.floor(Number(value) || 0));
  const date = value => { const d = new Date(value); return value && Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'}).replace(/\./g, '') : ''; };
  const notice = (type, title, message) => { if (typeof Toast !== 'undefined') Toast[type]?.(title, message); };
  function ended() { return Object.assign(new Error('La sesión cambió. Vuelve a abrir Mis cursos.'), {code:'session-ended'}); }
  async function request(path, options, ticket) {
    if (!current(ticket)) throw ended();
    const data = await window.ICADEMPlatform.request(path, options);
    if (!current(ticket)) throw ended();
    if (!data?.ok) throw new Error(data?.error || 'No pudimos confirmar tus desbloqueos.');
    return data;
  }
  function apply(data, ticket) {
    if (!current(ticket)) return;
    if (summaryUid === ticket.uid && Number.isFinite(Number(data.revision)) && Number.isFinite(Number(summary?.revision)) && Number(data.revision) < Number(summary.revision)) return;
    const previous = getPriorities();
    summary = data; summaryUid = ticket.uid;
    const priorities = getPriorities(), prioritiesChanged = previous.length !== priorities.length || previous.some((id,index) => id !== priorities[index]);
    document.querySelectorAll('[data-course-unlocks]').forEach(paint);
    document.querySelectorAll('#cur-list').forEach(decorate);
    document.dispatchEvent(new CustomEvent('icadem:unlocks-updated', { detail: { available:count(data.available), prioritiesChanged, revision:data.revision } }));
  }
  function adoptConfirmed(data, uid) {
    const ticket = scope();
    if (!current(ticket) || uid !== ticket.uid || data?.ok !== true || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.priorities)) return false;
    apply(data,ticket);
    return state() === data;
  }
  async function load(force) {
    const ticket = scope();
    if (!current(ticket) || !window.ICADEMPlatform?.request) return null;
    if (!force && state()) return state();
    if (pending && current(pending.ticket)) return pending.promise;
    const entry = { ticket };
    entry.promise = request('/api/courses/unlocks', undefined, ticket).then(data => {
      apply(data, ticket); return data.enabled === false ? null : state();
    }).finally(() => { if (pending === entry) pending = null; });
    pending = entry; return entry.promise;
  }
  function paint(host) {
    const data = state();
    if (!host?.isConnected) return;
    if (!data || data.enabled === false) { host.hidden = true; host.replaceChildren(); return; }
    const available = count(data.available), active = data.active === true, next = date(data.nextUnlockAt);
    const free = window.UserState?.freeCourseId;
    let headline = active ? (available ? `${available} curso${available === 1 ? '' : 's'} por elegir` : next ? `Próximo cupo: ${next}` : 'Tu ruta está al día') : free ? 'Tu curso gratuito sigue disponible' : 'Elige tu curso gratuito';
    if (!active && (count(data.vipSlots) || available)) headline = 'Desbloqueos guardados · Reactiva VIP';
    if (data.isAdmin) headline = 'Acceso a todos los cursos';
    host.hidden = false;
    host.innerHTML = `<section class="course-unlocks" aria-labelledby="course-unlocks-title" tabindex="-1"><div class="course-unlocks__copy"><span class="course-unlocks__icon" aria-hidden="true"><svg class="ic"><use href="#i-shield-check"/></svg></span><div class="course-unlocks__content"><h2 id="course-unlocks-title">Mis desbloqueos</h2><span class="course-unlocks__status${active && available && !data.isAdmin ? ' has-choices' : ''}" aria-live="polite">${esc(headline)}</span><span data-unlock-priority hidden></span></div></div><div class="course-unlocks__actions">${data.isAdmin ? '<button type="button" class="cu-btn cu-btn--primary" data-unlock-explore>Explorar cursos</button>' : active ? `<button type="button" class="cu-btn cu-btn--primary" data-unlock-choose ${!available ? 'disabled' : ''}>Elegir cursos</button>` : `<button type="button" class="cu-btn cu-btn--primary" data-unlock-vip>Conocer VIP</button>`}${data.isAdmin ? '' : '<button type="button" class="cu-btn cu-btn--quiet" data-unlock-organize>Organizar lista</button>'}</div></section>`;
    host.querySelector('[data-unlock-choose]')?.addEventListener('click', () => open('choose'));
    host.querySelector('[data-unlock-organize]')?.addEventListener('click', () => open('priorities'));
    host.querySelector('[data-unlock-vip]')?.addEventListener('click', () => window.navigateToSection?.('suscripcion'));
    host.querySelector('[data-unlock-explore]')?.addEventListener('click', () => { document.getElementById('cur-list')?.scrollIntoView({behavior:'smooth',block:'start'}); });
    const ticket = scope();
    Promise.resolve(window.__getCourseUnlockCatalog?.()).then(courses => {
      if (!current(ticket) || state() !== data || !host.isConnected || !Array.isArray(courses)) return;
      const eligible = new Set(data.eligibleCourseIds || []), selected = new Set(data.selectedCourseIds || []);
      const first = (data.priorities || []).map(id => courses.find(c => c.id === id)).find(course => course && eligible.has(course.id) && !selected.has(course.id) && course.access?.unlocked !== true && course.catalogPending !== true);
      const hint = host.querySelector('[data-unlock-priority]');
      if (hint && first) {
        const label = `Primero en tu lista: ${first.titulo}`;
        hint.className = 'course-unlocks__priority'; hint.dataset.priorityCourse = first.id;
        hint.innerHTML = `<strong>Primero en tu lista:</strong><span>${esc(first.titulo)}</span>`;
        hint.hidden = false; hint.setAttribute('title',label); hint.setAttribute('aria-label',label);
        host.querySelector('[data-unlock-organize]')?.setAttribute('title',label);
      }
    }).catch(() => {});
  }
  async function mount(host) {
    if (!host) return;
    const ticket = scope();
    paint(host);
    try { await load(true); }
    catch (error) {
      if (error.code === 'session-ended' || [404,503].includes(error.status)) return;
      if (!host.isConnected || !current(ticket)) return;
      if (!state()) {
        host.hidden = false;
        host.innerHTML = '<div class="course-unlocks course-unlocks--retry" role="status"><p>No pudimos consultar tus desbloqueos.</p><button type="button" class="cu-btn">Reintentar</button></div>';
        host.querySelector('button').addEventListener('click', () => mount(host));
      }
    }
  }
  function decorate(list) {
    const data = state();
    list?.querySelectorAll('[data-unlock-context]').forEach(node => node.remove());
    if (!data || data.isAdmin || data.enabled === false) return;
    const eligible = new Set(data.eligibleCourseIds || []), positions = new Map();
    getPriorities().forEach((id,index) => { if (!positions.has(id)) positions.set(id,index + 1); });
    list?.querySelectorAll('.curso-card[data-cid]').forEach(card => {
      const id = card.dataset.cid, rank = positions.get(id), canChoose = data.active === true && eligible.has(id) && count(data.available) > 0;
      if (!rank && (data.active !== true || !eligible.has(id))) return;
      const title = card.querySelector('.curso-card__title')?.textContent?.trim() || 'este curso';
      const context = document.createElement('div'); context.className = 'course-unlock-context'; context.dataset.unlockContext = id;
      if (rank) {
        context.innerHTML = `<button type="button" class="course-priority-link" data-unlock-organize-course="${esc(id)}" aria-label="Prioridad #${rank}. Organizar ${esc(title)} en mi lista" title="${rank === 1 ? 'Primero en tu lista. ' : ''}Organizar prioridades"><span class="course-priority-badge${rank === 1 ? ' is-first' : ''}" data-course-priority="${rank}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5.75 3.25h8.5v13.5L10 13.5l-4.25 3.25z"/></svg>Prioridad #${rank}</span><span class="course-priority-link__label">Organizar</span></button>${canChoose ? `<button type="button" class="course-unlock-context__action" data-unlock-select-course="${esc(id)}" aria-label="Elegir ${esc(title)} para desbloquear">Elegir</button>` : ''}`;
        context.querySelector('[data-unlock-organize-course]').addEventListener('click',event => { event.stopPropagation(); open('priorities'); });
      } else {
        context.innerHTML = `<button type="button" class="course-unlock-context__action" ${canChoose ? 'data-unlock-select-course' : 'data-unlock-add-course'}="${esc(id)}" aria-label="${canChoose ? `Elegir ${esc(title)} para desbloquear` : `Agregar ${esc(title)} a mi lista`}">${canChoose ? 'Elegir para desbloquear' : 'Agregar a mi lista'}</button>`;
      }
      context.querySelector('[data-unlock-select-course]')?.addEventListener('click',event => { event.stopPropagation(); open('choose',id); });
      context.querySelector('[data-unlock-add-course]')?.addEventListener('click',event => { event.stopPropagation(); open('priorities',id); });
      card.querySelector('.curso-card__body')?.appendChild(context);
    });
  }
  async function open(mode, initialId) {
    const ticket = scope();
    if (!current(ticket) || dialog) return;
    if (mode === 'priorities') { window.__openLearningRoute?.(initialId); return; }
    let data, courses;
    try { [data, courses] = await Promise.all([load(true), window.__getCourseUnlockCatalog?.()]); }
    catch (error) { if (current(ticket)) notice('error', 'No pudimos abrir tu ruta', error.message); return; }
    if (!current(ticket) || !data || !Array.isArray(courses) || typeof Modal === 'undefined' || dialog) return;
    const eligible = new Set(data.eligibleCourseIds || []), catalog = courses.filter(c => eligible.has(c.id) && c.catalogPending !== true);
    if (mode === 'choose' && (!data.active || !count(data.available))) return;
    const selected = new Set(mode === 'priorities' ? (data.priorities || []).filter(id => eligible.has(id)) : []);
    if (initialId && eligible.has(initialId) && (mode === 'priorities' || count(data.available))) selected.add(initialId);
    let order = [...selected], query = '', category = '', busy = false, confirmation = false, operation = null;
    const body = document.createElement('div'); body.className = 'course-unlock-picker';
    const footer = document.createElement('div'); footer.className = 'course-unlock-picker__footer';
    const modalId = 'course-unlock-picker';
    const handle = Modal.open({id:modalId,title:mode === 'choose' ? 'Elige qué aprender primero' : 'Organizar mis próximos cursos',subtitle:mode === 'choose' ? 'Puedes elegir ahora o volver después. Tus derechos se conservan.' : 'Empieza con tres si quieres. Puedes añadir más; esta lista no utiliza desbloqueos.',icon:'i-book',size:'lg',body,footer,beforeClose:() => !busy || !current(ticket),onClose:() => { if (dialog?.handle === handle) dialog = null; }});
    dialog = {handle,ticket};
    const categories = [...new Set(catalog.map(c => c.area).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
    body.innerHTML = `<div class="course-unlock-picker__tools"><label><span>Buscar cursos</span><input type="search" data-unlock-search placeholder="Nombre del curso" autocomplete="off"></label><label><span>Categoría</span><select data-unlock-category><option value="">Todas las categorías</option>${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label></div><div data-unlock-order></div><div class="course-unlock-picker__results" data-unlock-results></div><p class="course-unlock-picker__error" data-unlock-error role="alert" hidden></p>`;
    const errorHost = body.querySelector('[data-unlock-error]');
    function showError(message) { errorHost.hidden = !message; errorHost.textContent = message || ''; }
    function changed() { confirmation = false; operation = null; showError(''); render(); }
    function render() {
      if (!current(ticket)) { handle.close(); return; }
      const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const currentlyEligible = new Set(data.eligibleCourseIds || []);
      const visible = catalog.filter(c => currentlyEligible.has(c.id) && (!category || c.area === category) && normalized(c.titulo).includes(normalized(query)));
      const results = body.querySelector('[data-unlock-results]');
      results.innerHTML = visible.length ? visible.map(c => `<button type="button" class="course-unlock-option ${selected.has(c.id) ? 'is-selected' : ''}" data-unlock-pick="${esc(c.id)}" aria-pressed="${selected.has(c.id)}" ${busy || (!selected.has(c.id) && mode === 'choose' && selected.size >= count(data.available)) ? 'disabled' : ''}><span class="course-unlock-option__check" aria-hidden="true">${selected.has(c.id) ? '✓' : '+'}</span><span class="course-unlock-option__copy"><small>${esc(c.area || 'Curso ICADEM')}</small><strong>${esc(c.titulo)}</strong><em>${c.sesiones?.length || c.sessionCount || 0} clases</em></span></button>`).join('') : '<p class="course-unlock-picker__empty">No hay cursos elegibles para esta búsqueda.</p>';
      results.querySelectorAll('[data-unlock-pick]').forEach(button => button.addEventListener('click', () => {
        if (busy) return;
        const id = button.dataset.unlockPick;
        if (selected.has(id)) { selected.delete(id); order = order.filter(item => item !== id); }
        else if (mode === 'priorities' || selected.size < count(data.available)) { selected.add(id); order.push(id); }
        changed();
      }));
      const ordered = body.querySelector('[data-unlock-order]');
      ordered.hidden = mode !== 'priorities';
      ordered.innerHTML = mode === 'priorities' ? `<h3>Mi lista · ${order.length}</h3>${order.length ? `<ol class="course-unlock-order">${order.map((id,index) => `<li><span>${esc(catalog.find(c => c.id === id)?.titulo || id)}</span><div><button type="button" data-order-up="${esc(id)}" aria-label="Subir ${esc(catalog.find(c => c.id === id)?.titulo || 'curso')}" ${busy || !index ? 'disabled' : ''}>↑</button><button type="button" data-order-down="${esc(id)}" aria-label="Bajar ${esc(catalog.find(c => c.id === id)?.titulo || 'curso')}" ${busy || index === order.length-1 ? 'disabled' : ''}>↓</button><button type="button" data-order-remove="${esc(id)}" aria-label="Quitar ${esc(catalog.find(c => c.id === id)?.titulo || 'curso')}" ${busy ? 'disabled' : ''}>×</button></div></li>`).join('')}</ol>` : '<p class="course-unlock-picker__empty">Tu lista está vacía. Añade los cursos que te interesen.</p>'}` : '';
      ordered.querySelectorAll('[data-order-up],[data-order-down],[data-order-remove]').forEach(button => button.addEventListener('click', () => {
        if (busy) return;
        const id = button.dataset.orderUp || button.dataset.orderDown || button.dataset.orderRemove, index = order.indexOf(id);
        if (button.dataset.orderRemove) { selected.delete(id); order.splice(index,1); }
        else { const target = index + (button.dataset.orderUp ? -1 : 1); [order[index],order[target]] = [order[target],order[index]]; }
        changed();
      }));
      footer.innerHTML = `<div class="course-unlock-picker__summary" aria-live="polite">${mode === 'choose' ? confirmation ? `Vas a desbloquear ${selected.size} curso${selected.size === 1 ? '' : 's'}. ¿Deseas continuar?` : `${selected.size} de ${count(data.available)} desbloqueos seleccionados` : 'Tu lista no consume desbloqueos.'}</div><div class="course-unlock-picker__buttons"><button type="button" class="cu-btn cu-btn--quiet" data-unlock-cancel ${busy ? 'disabled' : ''}>${confirmation ? 'Volver' : mode === 'choose' ? 'Elegir después' : 'Cancelar'}</button><button type="button" class="cu-btn cu-btn--primary" data-unlock-submit ${busy || (mode === 'choose' && !selected.size) ? 'disabled' : ''}>${busy ? 'Guardando…' : mode === 'priorities' ? 'Guardar lista' : confirmation ? 'Confirmar desbloqueo' : 'Continuar'}</button></div>`;
      footer.querySelector('[data-unlock-cancel]').addEventListener('click', () => { if (confirmation) { confirmation = false; render(); } else handle.close(); });
      footer.querySelector('[data-unlock-submit]').addEventListener('click', submit);
      body.querySelectorAll('input,select').forEach(element => { element.disabled = busy; });
    }
    async function submit() {
      if (busy || !current(ticket)) return;
      if (mode === 'choose' && !confirmation) { confirmation = true; render(); return; }
      busy = true; showError(''); render();
      // Reusing the key after a transport failure makes a retry the same operation.
      operation = operation || (window.crypto?.randomUUID?.() || `choose-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      try {
        const result = await request(`/api/courses/unlocks/${mode === 'choose' ? 'select' : 'priorities'}`, {method:mode === 'choose' ? 'POST' : 'PUT',body:mode === 'choose' ? {courseIds:[...selected],requestId:operation} : {courseIds:order}}, ticket);
        apply(result, ticket);
        busy = false; handle.close();
        if (mode === 'choose') {
          if (result.freeCourseId && window.UserState) window.UserState.freeCourseId = result.freeCourseId;
          await window.__reloadCourseCatalog?.();
          if (!current(ticket)) return;
          document.dispatchEvent(new CustomEvent('icadem:course-unlocks-changed'));
        }
        if (current(ticket)) notice('success', mode === 'choose' ? 'Cursos desbloqueados' : 'Lista guardada', mode === 'choose' ? 'Ya puedes comenzar desde Mis cursos.' : 'Tú decides cuándo utilizar tus próximos desbloqueos.');
      } catch (error) {
        busy = false;
        if (!current(ticket)) { handle.close(); return; }
        if (error.status === 409) {
          try {
            const latest = await load(true);
            if (!current(ticket)) { handle.close(); return; }
            if (latest) {
              data = latest;
              const eligibleNow = new Set(data.eligibleCourseIds || []);
              for (const id of selected) if (!eligibleNow.has(id)) selected.delete(id);
              while (mode === 'choose' && selected.size > count(data.available)) selected.delete([...selected].at(-1));
              order = order.filter(id => selected.has(id));
              operation = null; confirmation = false;
            }
          } catch (_) { /* Retain the failed choice; a later retry is still server-validated. */ }
        }
        showError(error.message || 'No pudimos guardar. Puedes volver a intentarlo.'); render();
      }
    }
    body.querySelector('[data-unlock-search]').addEventListener('input', event => { query = event.target.value; render(); });
    body.querySelector('[data-unlock-category]').addEventListener('change', event => { category = event.target.value; render(); });
    render();
  }
  function focus() {
    window.navigateToSection?.('cursos');
    setTimeout(() => { const card = document.querySelector('.course-unlocks'); card?.scrollIntoView({behavior:'smooth',block:'center'}); card?.focus({preventScroll:true}); }, 120);
  }
  function reset() {
    generation++; summary = null; summaryUid = ''; pending = null;
    if (dialog) { const old = dialog; dialog = null; old.handle.close(); }
    document.querySelectorAll('[data-course-unlocks]').forEach(host => { host.hidden = true; host.replaceChildren(); });
    document.querySelectorAll('[data-unlock-context]').forEach(node => node.remove());
    document.dispatchEvent(new CustomEvent('icadem:unlocks-updated', {detail:{available:0,prioritiesChanged:true,reset:true}}));
  }
  document.addEventListener('icadem:session-ending', reset);
  document.addEventListener('icadem:session-ended', reset);
  document.addEventListener('icadem:user-ready', reset);
  document.addEventListener('visibilitychange', () => { if (!window.ICADEMCourseSync && document.visibilityState === 'visible' && document.querySelector('[data-course-unlocks]')) load(true).catch(() => {}); });
  window.addEventListener('online', () => { if (!window.ICADEMCourseSync && document.querySelector('[data-course-unlocks]')) load(true).catch(() => {}); });
  window.ICADEMCourseUnlocks = {mount,decorate,focus,open,getPriorities,getSummary,adoptConfirmed,refresh:() => load(true)};
})();
