/* Mi ruta de aprendizaje: una vista del catálogo y las prioridades existentes. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const icons = {
    back:'<path d="m14 6-6 6 6 6M8 12h12"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12 4 4L19 6"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    grip:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    up:'<path d="m6 11 6-6 6 6M12 5v14"/>', down:'<path d="m6 13 6 6 6-6M12 5v14"/>',
    remove:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
    route:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.list}</svg>`;
  const uid = () => window.__isDemoMode ? '' : (window.__auth ? window.__auth.currentUser?.uid : window.__currentUser?.uid) || '';
  let generation = 0, loadId = 0, initialId = '', view = null, dialog = null, drag = null, keyboardId = '';
  let state = {uid:'', status:'idle', catalog:[], data:null, order:[], base:[], query:'', category:'', busy:false, error:'', saved:false, conflict:false};
  const scope = () => ({uid:uid(), generation});
  const current = ticket => Boolean(ticket.uid && ticket.uid === uid() && ticket.generation === generation && !window.__sessionEnding);
  const sameOrder = (a,b) => a.length === b.length && a.every((id,i) => id === b[i]);
  const isDirty = () => state.uid === uid() && !sameOrder(state.order,state.base);
  const isBusy = () => state.uid === uid() && state.busy;
  const mounted = () => Boolean(view?.isConnected && state.uid === uid());
  const course = id => state.catalog.find(item => item.id === id) || {id,titulo:'Curso de tu lista',area:'ICADEM'};
  const title = id => course(id).titulo || 'Curso ICADEM';
  const notice = (type,head,message) => window.Toast?.[type]?.(head,message);
  function announce(message) { const live = view?.querySelector('[data-route-live]'); if (live) live.textContent = message; }
  function cover(item, fallback) { return window.__courseCoverICADEM?.(item, Boolean(fallback)) || item.portada || ''; }
  function image(item, className) { return `<img class="${className}" src="${esc(cover(item))}" alt="" loading="lazy" decoding="async" data-route-cover="${esc(item.id)}">`; }
  function bindCovers(root) {
    root.querySelectorAll('[data-route-cover]').forEach(img => img.addEventListener('error', () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = 'true';
      const source = cover(course(img.dataset.routeCover),true);
      if (source && source !== img.getAttribute('src')) img.src = source;
    }, {once:true}));
  }
  function goBack() { if (window.__backToCoursesFromRoute) window.__backToCoursesFromRoute(); else window.navigateToSection?.('cursos'); }
  function shell() {
    if (!view?.isConnected) return;
    view.innerHTML = `<div class="learning-route" data-learning-route><button class="lr-back" type="button" data-route-back>${icon('back')}<span>Volver a Mis cursos</span></button><header class="lr-header"><div><span class="lr-eyebrow">TU APRENDIZAJE, A TU RITMO</span><h1>Mi ruta de aprendizaje</h1><p>Organiza los cursos que quieres estudiar después.</p></div><span class="lr-assurance">${icon('lock')}Organizar no consume desbloqueos</span></header><div data-route-body></div><span class="lr-sr-only" data-route-live role="status" aria-live="polite" aria-atomic="true"></span></div>`;
    view.querySelector('[data-route-back]').addEventListener('click',goBack);
  }
  function paintStatus() {
    const body = view?.querySelector('[data-route-body]'); if (!body) return;
    if (state.status === 'loading') {
      body.innerHTML = `<div class="lr-layout lr-loading" role="status" aria-label="Cargando tu ruta de aprendizaje"><div class="lr-panel"><div class="lr-skeleton lr-skeleton--title"></div><div class="lr-skeleton lr-skeleton--control"></div><div class="lr-explore-grid">${Array.from({length:4}, () => '<div class="lr-skeleton lr-skeleton--card"></div>').join('')}</div></div><div class="lr-panel"><div class="lr-skeleton lr-skeleton--title"></div>${Array.from({length:3}, () => '<div class="lr-skeleton lr-skeleton--row"></div>').join('')}</div></div>`;
      return;
    }
    if (state.status !== 'ready') {
      body.innerHTML = `<section class="lr-state"><span class="lr-state__icon">${icon('route')}</span><h2>${state.status === 'error' ? 'Tu ruta te espera' : 'Tu ruta aún no está disponible'}</h2><p>${esc(state.error || 'Vuelve a Mis cursos para consultar las opciones de tu cuenta.')}</p>${state.status === 'error' ? '<button type="button" class="lr-button lr-button--primary" data-route-retry>Volver a intentar</button>' : ''}</section>`;
      body.querySelector('[data-route-retry]')?.addEventListener('click', () => render(view));
      return;
    }
    const categories = [...new Set(state.catalog.map(c => c.area).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
    body.innerHTML = `<div class="lr-layout"><section class="lr-panel lr-explore" aria-labelledby="lr-explore-title"><div class="lr-section-head"><div><span class="lr-section-kicker">ENCUENTRA TU SIGUIENTE PASO</span><h2 id="lr-explore-title">Explorar cursos</h2></div><span class="lr-result-count" data-route-result-count></span></div><div class="lr-tools"><label class="lr-search"><span class="lr-sr-only">Buscar cursos</span>${icon('search')}<input data-route-search type="search" placeholder="Busca un curso" value="${esc(state.query)}" autocomplete="off"></label><label class="lr-category"><span>Categoría</span><select data-route-category><option value="">Todas las categorías</option>${categories.map(category => `<option value="${esc(category)}" ${state.category === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label></div><div class="lr-explore-grid" data-route-results></div></section><section class="lr-panel lr-priorities" aria-labelledby="lr-priority-title"><div class="lr-section-head"><div><span class="lr-section-kicker">EL ORDEN LO ELIGES TÚ</span><h2 id="lr-priority-title">Mi lista de prioridad <span class="lr-count" data-route-count>0</span></h2></div><span class="lr-list-symbol">${icon('list')}</span></div><p class="lr-list-hint">Arrastra desde los puntos o usa el menú de cada curso.</p><div data-route-order></div><div class="lr-save-area"><p class="lr-save-status" data-route-save-status></p><p class="lr-error" role="alert" data-route-error hidden></p><button type="button" class="lr-button lr-button--primary lr-save" data-route-save>${icon('check')}<span>Guardar cambios</span></button><p class="lr-save-note">Tu lista se sincroniza con tu cuenta.</p></div></section></div>`;
    body.querySelector('[data-route-search]').addEventListener('input',event => { state.query = event.target.value; paintCatalog(); });
    body.querySelector('[data-route-category]').addEventListener('change',event => { state.category = event.target.value; paintCatalog(); });
    body.querySelector('[data-route-save]').addEventListener('click',save);
    const reload = document.createElement('button');
    reload.type = 'button'; reload.className = 'lr-button lr-button--quiet lr-reload'; reload.dataset.routeReload = '';
    reload.textContent = 'Cargar lista actual'; reload.addEventListener('click',reloadLatest);
    body.querySelector('[data-route-save]').insertAdjacentElement('afterend',reload);
    paintCatalog(); paintList();
  }
  function paintCatalog() {
    const root = view?.querySelector('[data-route-results]'); if (!root) return;
    const eligible = new Set(state.data?.eligibleCourseIds || []), selected = new Set(state.order);
    const available = state.catalog.filter(c => eligible.has(c.id) && c.catalogPending !== true);
    const visible = available.filter(c => (!state.category || c.area === state.category) && normalize(c.titulo).includes(normalize(state.query)));
    view.querySelector('[data-route-result-count]').textContent = `${visible.length} curso${visible.length === 1 ? '' : 's'}`;
    root.innerHTML = visible.length ? visible.map(item => `<article class="lr-course${selected.has(item.id) ? ' is-selected' : ''}">${image(item,'lr-course__cover')}<div class="lr-course__body"><span class="lr-course__category">${esc(item.area || 'Curso ICADEM')}</span><h3>${esc(item.titulo)}</h3><button type="button" class="lr-add" data-route-add="${esc(item.id)}" aria-label="${selected.has(item.id) ? 'Agregado:' : 'Agregar a mi lista:'} ${esc(item.titulo)}" ${state.busy || selected.has(item.id) ? 'disabled' : ''}>${icon(selected.has(item.id) ? 'check' : 'plus')}<span>${selected.has(item.id) ? 'Agregado' : 'Agregar'}</span></button></div></article>`).join('') : `<div class="lr-catalog-empty"><span>${icon('search')}</span><h3>${available.length ? 'No encontramos ese curso' : 'Tu catálogo está al día'}</h3><p>${available.length ? 'Prueba con otro nombre o categoría.' : 'Aquí aparecerán los cursos que puedes añadir a tu próxima ruta.'}</p>${available.length && (state.query || state.category) ? '<button type="button" class="lr-button lr-button--quiet" data-route-clear>Limpiar filtros</button>' : ''}</div>`;
    root.querySelectorAll('[data-route-add]').forEach(button => button.addEventListener('click',() => add(button.dataset.routeAdd)));
    root.querySelector('[data-route-clear]')?.addEventListener('click',() => { state.query = ''; state.category = ''; view.querySelector('[data-route-search]').value = ''; view.querySelector('[data-route-category]').value = ''; paintCatalog(); });
    bindCovers(root);
  }
  function paintList(focusId, focusType) {
    const root = view?.querySelector('[data-route-order]'); if (!root) return;
    view.querySelector('.lr-priorities')?.classList.toggle('is-long',state.order.length > 5);
    root.innerHTML = state.order.length ? `<ol class="lr-priority-list">${state.order.map((id,index) => `<li class="lr-priority-item${keyboardId === id ? ' is-keyboard-moving' : ''}" data-route-item="${esc(id)}"><button type="button" class="lr-icon-button lr-drag" data-route-drag="${esc(id)}" aria-label="Mover ${esc(title(id))}. Pulsa espacio y usa las flechas para cambiar la prioridad." aria-pressed="${keyboardId === id}" ${state.busy ? 'disabled' : ''}>${icon('grip')}</button><span class="lr-position" aria-label="Prioridad ${index + 1}">${index + 1}</span>${image(course(id),'lr-priority-cover')}<div class="lr-priority-copy"><span>${esc(course(id).area || 'Curso ICADEM')}</span><h3>${esc(title(id))}</h3></div><div class="lr-menu-wrap"><button type="button" class="lr-icon-button lr-more" data-route-menu="${esc(id)}" aria-label="Opciones de ${esc(title(id))}" aria-haspopup="menu" aria-expanded="false" ${state.busy ? 'disabled' : ''}>${icon('more')}</button><div class="lr-menu" role="menu" aria-label="Prioridad de ${esc(title(id))}" hidden><button type="button" role="menuitem" data-route-action="up" data-id="${esc(id)}" ${index === 0 ? 'disabled' : ''}>${icon('up')}Subir prioridad</button><button type="button" role="menuitem" data-route-action="down" data-id="${esc(id)}" ${index === state.order.length-1 ? 'disabled' : ''}>${icon('down')}Bajar prioridad</button><button type="button" role="menuitem" class="lr-menu-remove" data-route-action="remove" data-id="${esc(id)}">${icon('remove')}Quitar de mi lista</button></div></div></li>`).join('')}</ol>` : `<div class="lr-list-empty"><span>${icon('route')}</span><h3>Aquí empieza tu próxima ruta</h3><p>Añade los cursos que te interesan y pon primero el que más te entusiasma.</p><a href="#lr-explore-title" data-route-explore>Explorar cursos ${icon('down')}</a></div>`;
    root.querySelector('[data-route-explore]')?.addEventListener('click',event => { event.preventDefault(); view.querySelector('.lr-explore').scrollIntoView({behavior:reducedMotion() ? 'auto' : 'smooth',block:'start'}); view.querySelector('[data-route-search]').focus({preventScroll:true}); });
    root.querySelectorAll('[data-route-menu]').forEach(button => {
      button.addEventListener('click',() => toggleMenu(button));
      button.addEventListener('keydown',event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); toggleMenu(button,true,event.key === 'ArrowUp'); } });
    });
    root.querySelectorAll('[data-route-action]').forEach(button => button.addEventListener('click',() => {
      const id = button.dataset.id, action = button.dataset.routeAction;
      if (action === 'remove') remove(id); else move(id,state.order.indexOf(id)+(action === 'up' ? -1 : 1),'menu');
    }));
    root.querySelectorAll('.lr-menu').forEach(menu => menu.addEventListener('keydown',menuKey));
    root.querySelectorAll('[data-route-drag]').forEach(button => { button.addEventListener('pointerdown',startDrag); button.addEventListener('keydown',dragKey); });
    bindCovers(root); paintSave();
    if (focusId) root.querySelectorAll(`[data-route-${focusType || 'menu'}]`).forEach(button => { if (button.dataset[focusType === 'drag' ? 'routeDrag' : 'routeMenu'] === focusId) button.focus({preventScroll:true}); });
  }
  function paintSave() {
    if (!mounted()) return;
    const count = view.querySelector('[data-route-count]'); if (count) count.textContent = state.order.length;
    const status = view.querySelector('[data-route-save-status]'); if (!status) return;
    const dirty = isDirty();
    status.classList.toggle('is-pending',dirty);
    status.textContent = state.busy ? 'Guardando tu ruta…' : state.conflict ? 'Hay una lista más reciente' : dirty ? 'Tienes cambios sin guardar' : state.saved ? 'Todos los cambios guardados' : 'Tu lista está al día';
    const button = view.querySelector('[data-route-save]'); button.disabled = state.busy || state.conflict || !dirty;
    button.querySelector('span').textContent = state.busy ? 'Guardando…' : 'Guardar cambios';
    const error = view.querySelector('[data-route-error]'); error.hidden = !state.error; error.textContent = state.error;
    view.querySelectorAll('[data-route-search],[data-route-category]').forEach(element => { element.disabled = state.busy; });
    view.querySelector('[data-route-back]').disabled = state.busy;
    const reload = view.querySelector('[data-route-reload]'); if (reload) { reload.hidden = !state.conflict; reload.disabled = state.busy; }
  }
  function changed(message, focusId, focusType) { if (!state.conflict) state.error = ''; state.saved = false; paintCatalog(); paintList(focusId,focusType); announce(message); }
  function add(id) {
    if (state.busy || !current(scope()) || state.order.includes(id) || !state.data?.eligibleCourseIds?.includes(id)) return;
    state.order.push(id); changed(`${title(id)} agregado en la prioridad ${state.order.length}.`);
    // Keep keyboard focus in the catalog, on the next available action if possible.
    const cards = [...view.querySelectorAll('[data-route-add]')], index = cards.findIndex(button => button.dataset.routeAdd === id);
    (cards.slice(index + 1).find(button => !button.disabled) || cards.slice(0,index).find(button => !button.disabled) || view.querySelector('[data-route-save]'))?.focus({preventScroll:true});
  }
  function remove(id) {
    if (state.busy) return;
    const index = state.order.indexOf(id); if (index < 0) return;
    state.order.splice(index,1); keyboardId = ''; changed(`${title(id)} quitado de tu lista.`,state.order[Math.min(index,state.order.length-1)]);
    if (!state.order.length) {
      const saveButton = view.querySelector('[data-route-save]');
      (saveButton && !saveButton.disabled ? saveButton : view.querySelector('[data-route-add]:not(:disabled)') || view.querySelector('[data-route-search]'))?.focus({preventScroll:true});
    }
  }
  function move(id,target,method) {
    if (state.busy) return;
    const index = state.order.indexOf(id); if (index < 0 || target < 0 || target >= state.order.length || target === index) return;
    const positions = new Map([...view.querySelectorAll('[data-route-item]')].map(row => [row.dataset.routeItem,row.getBoundingClientRect().top]));
    state.order.splice(index,1); state.order.splice(target,0,id);
    changed(`${title(id)} ahora tiene la prioridad ${target + 1}.`,id,method === 'keyboard' ? 'drag' : 'menu');
    if (!reducedMotion()) view.querySelectorAll('[data-route-item]').forEach(row => {
      const delta = positions.get(row.dataset.routeItem) - row.getBoundingClientRect().top;
      if (delta) row.animate?.([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
    });
  }
  function closeMenus(returnFocus) {
    view?.querySelectorAll('[data-route-menu][aria-expanded="true"]').forEach(button => { button.setAttribute('aria-expanded','false'); button.nextElementSibling.hidden = true; if (returnFocus) button.focus({preventScroll:true}); });
  }
  function toggleMenu(button,force,last) {
    if (state.busy) return;
    const open = force || button.getAttribute('aria-expanded') !== 'true'; closeMenus(false);
    if (open) { button.setAttribute('aria-expanded','true'); const menu = button.nextElementSibling; menu.hidden = false; const enabled = [...menu.querySelectorAll('button:not(:disabled)')]; (last ? enabled.at(-1) : enabled[0])?.focus({preventScroll:true}); }
  }
  function menuKey(event) {
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenus(true); }
    else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index+(event.key === 'ArrowDown' ? 1 : -1)+buttons.length)%buttons.length; buttons[next]?.focus(); }
    else if (event.key === 'Tab') closeMenus(false);
  }
  const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  function dragKey(event) {
    const id = event.currentTarget.dataset.routeDrag;
    if (state.busy) return;
    if ([' ','Enter'].includes(event.key)) { event.preventDefault(); keyboardId = keyboardId === id ? '' : id; paintList(id,'drag'); announce(keyboardId ? `${title(id)} seleccionado. Usa las flechas para cambiar la prioridad y espacio para terminar.` : 'Orden actualizado. Recuerda guardar los cambios.'); }
    else if (keyboardId === id && ['ArrowUp','ArrowDown','Home','End'].includes(event.key)) { event.preventDefault(); move(id,event.key === 'Home' ? 0 : event.key === 'End' ? state.order.length-1 : state.order.indexOf(id)+(event.key === 'ArrowUp' ? -1 : 1),'keyboard'); }
    else if (event.key === 'Escape' && keyboardId) { event.preventDefault(); keyboardId = ''; paintList(id,'drag'); announce('Movimiento terminado.'); }
  }
  function startDrag(event) {
    if (state.busy || event.button !== 0 || drag) return;
    const handle = event.currentTarget, item = handle.closest('[data-route-item]');
    if (!item || state.order.length < 2) return;
    closeMenus(false); keyboardId = '';
    drag = {id:handle.dataset.routeDrag,pointerId:event.pointerId,handle,item,startX:event.clientX,startY:event.clientY,y:event.clientY,target:state.order.indexOf(handle.dataset.routeDrag),active:false,timer:null};
    handle.setPointerCapture?.(event.pointerId);
    handle.addEventListener('pointermove',dragMove); handle.addEventListener('pointerup',endDrag); handle.addEventListener('pointercancel',cancelDrag); handle.addEventListener('lostpointercapture',cancelDrag);
    if (event.pointerType === 'touch') drag.timer = setTimeout(activateDrag,160);
    event.preventDefault();
  }
  function activateDrag() {
    if (!drag || drag.active) return;
    clearTimeout(drag.timer); drag.active = true;
    const rect = drag.item.getBoundingClientRect();
    drag.item.classList.add('is-dragging'); drag.item.style.setProperty('--lr-drag-y','0px');
    drag.ghost = document.createElement('div'); drag.ghost.className = 'lr-drag-preview'; drag.ghost.textContent = title(drag.id); drag.ghost.style.width = `${Math.min(rect.width,380)}px`; document.body.appendChild(drag.ghost);
    announce(`Moviendo ${title(drag.id)}. Suelta sobre la nueva prioridad.`); positionDrag();
  }
  function positionDrag() {
    if (!drag?.active) return;
    drag.ghost.style.left = `${Math.max(8,Math.min(drag.startX + 16,window.innerWidth-drag.ghost.offsetWidth-8))}px`;
    drag.ghost.style.top = `${Math.max(8,Math.min(drag.y + 12,window.innerHeight-60))}px`;
    const items = [...view.querySelectorAll('[data-route-item]')];
    const target = items.reduce((best,item,index) => { const rect = item.getBoundingClientRect(); const distance = Math.abs(drag.y-(rect.top+rect.height/2)); return distance < best.distance ? {index,distance} : best; },{index:drag.target,distance:Infinity});
    drag.target = target.index;
    items.forEach((item,index) => { item.classList.toggle('is-drop-before',index === drag.target && drag.target < state.order.indexOf(drag.id)); item.classList.toggle('is-drop-after',index === drag.target && drag.target > state.order.indexOf(drag.id)); });
    // Native scrolling remains available everywhere except the small drag handle.
    if (drag.y < 75) window.scrollBy?.(0,-9); else if (drag.y > window.innerHeight-95) window.scrollBy?.(0,9);
  }
  function dragMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY) > 5) activateDrag();
    if (drag.active) { event.preventDefault(); positionDrag(); }
  }
  function releaseDrag() {
    if (!drag) return;
    const old = drag; drag = null; clearTimeout(old.timer);
    old.handle.removeEventListener('pointermove',dragMove); old.handle.removeEventListener('pointerup',endDrag); old.handle.removeEventListener('pointercancel',cancelDrag); old.handle.removeEventListener('lostpointercapture',cancelDrag);
    old.handle.releasePointerCapture?.(old.pointerId); old.ghost?.remove(); old.item.classList.remove('is-dragging');
    view?.querySelectorAll('.is-drop-before,.is-drop-after').forEach(item => item.classList.remove('is-drop-before','is-drop-after'));
    return old;
  }
  function endDrag(event) { if (!drag || event.pointerId !== drag.pointerId) return; const old = releaseDrag(); if (old.active) move(old.id,old.target,'pointer'); }
  function cancelDrag() { releaseDrag(); }
  async function render(container) {
    if (!container) return;
    releaseDrag(); view = container; const ticket = scope(), id = ++loadId;
    if (!current(ticket)) { state.status = 'unavailable'; state.error = 'Inicia sesión para organizar tu ruta de aprendizaje.'; shell(); paintStatus(); return; }
    if (state.uid === ticket.uid && state.status === 'ready' && isDirty()) { shell(); paintStatus(); return; }
    state = {...state,uid:ticket.uid,status:'loading',busy:false,error:'',saved:false,conflict:false}; shell(); paintStatus();
    try {
      const [data,catalog] = await Promise.all([window.ICADEMCourseUnlocks?.refresh(),window.__getCourseUnlockCatalog?.()]);
      if (!current(ticket) || id !== loadId || view !== container || !container.isConnected) return;
      if (!data || data.enabled === false) { state.status = 'unavailable'; paintStatus(); return; }
      if (!Array.isArray(catalog)) throw new Error('No pudimos cargar el catálogo de cursos.');
      const eligible = new Set(data.eligibleCourseIds || []);
      const order = [...new Set(data.priorities || [])].filter(id => eligible.has(id));
      state = {...state,status:'ready',data,catalog,base:[...order],order,error:''};
      const pending = initialId; initialId = '';
      if (pending && eligible.has(pending) && catalog.some(item => item.id === pending && item.catalogPending !== true) && !state.order.includes(pending)) state.order.push(pending);
      paintStatus();
      if (pending && state.order.includes(pending)) announce(`${title(pending)} está en tu lista. Guarda los cambios cuando termines.`);
    } catch (error) { if (current(ticket) && id === loadId && view === container && container.isConnected) { state.status = 'error'; state.error = error.message || 'No pudimos cargar tu ruta. Puedes volver a intentarlo.'; paintStatus(); } }
  }
  async function save() {
    if (state.busy || state.conflict || !isDirty() || !current(scope())) return;
    if (!Number.isSafeInteger(state.data?.revision) || state.data.revision < 0) {
      state.conflict = true; state.error = 'Carga la lista actual para confirmar su versión antes de guardar.'; paintSave(); return;
    }
    const ticket = scope(), order = [...state.order]; state.busy = true; state.error = ''; releaseDrag(); closeMenus(false); paintCatalog(); paintList();
    try {
      const result = await window.ICADEMPlatform.request('/api/courses/unlocks/priorities',{method:'PUT',body:{courseIds:order,expectedRevision:state.data.revision}});
      if (!current(ticket)) return;
      if (!result?.ok) throw new Error(result?.error || 'El servidor no pudo confirmar el guardado.');
      window.ICADEMCourseUnlocks.adoptConfirmed?.(result,ticket.uid);
      const confirmed = Array.isArray(result.priorities) ? [...result.priorities] : order;
      state.order = confirmed; state.base = [...confirmed]; state.saved = true;
      state.data = {...state.data,...result};
      let latest;
      try { latest = await window.ICADEMCourseUnlocks.refresh(); } catch (_) { /* The successful PUT already confirmed persistence. */ }
      if (!current(ticket)) return;
      if (latest && (Number(latest.revision) >= Number(result.revision) || result.revision == null)) {
        state.data = latest;
        if (Array.isArray(latest.priorities)) state.order = [...latest.priorities];
        state.base = [...state.order];
      }
      state.busy = false; paintCatalog(); paintList(); announce('Tu ruta de aprendizaje está guardada.');
      notice('success','Ruta guardada','Tus prioridades se sincronizaron con tu cuenta.');
    } catch (error) {
      if (!current(ticket)) return;
      state.conflict = error.status === 409;
      state.busy = false; state.error = error.message || 'No pudimos guardar. Tu borrador sigue aquí; vuelve a intentarlo.'; paintCatalog(); paintList(); announce('No pudimos guardar. Conservamos tus cambios para que puedas volver a intentarlo.');
    }
  }
  function reloadLatest() {
    if (!current(scope()) || state.busy) return;
    const proceed = () => { state.order = [...state.base]; state.conflict = false; render(view); };
    if (requestLeave(proceed,{reload:true}) !== false) proceed();
  }
  function requestLeave(proceed, options) {
    if (isBusy()) { notice('info','Guardando tu ruta','Espera un momento para salir.'); return false; }
    if (!isDirty()) return true;
    if (dialog) return false;
    if (!window.Modal?.open) return false;
    const body = document.createElement('div'); body.className = 'lr-leave-copy'; body.textContent = options?.reload ? 'Se reemplazará tu borrador por la lista actual de tu cuenta. Tu borrador no se guardará.' : 'Los cambios de tu lista todavía no se han guardado. Puedes quedarte para guardarlos o salir y descartarlos.';
    const footer = document.createElement('div'); footer.className = 'lr-leave-actions'; footer.innerHTML = '<button type="button" class="lr-button lr-button--quiet" data-route-stay>Seguir organizando</button><button type="button" class="lr-button lr-button--primary" data-route-discard>Salir sin guardar</button>';
    if (options?.reload) { footer.querySelector('[data-route-stay]').textContent = 'Conservar borrador'; footer.querySelector('[data-route-discard]').textContent = 'Cargar lista actual'; }
    const handle = window.Modal.open({id:'learning-route-leave',title:options?.reload ? '¿Cargar la lista actual?' : '¿Salir sin guardar?',subtitle:'Tu ruta tiene cambios pendientes',icon:'i-book',size:'sm',body,footer,onClose:() => { if (dialog === handle) dialog = null; }});
    dialog = handle;
    footer.querySelector('[data-route-stay]').addEventListener('click',() => dialog?.close());
    footer.querySelector('[data-route-discard]').addEventListener('click',() => { state.order = [...state.base]; state.error = ''; state.saved = false; const handle = dialog; dialog = null; handle?.close(); proceed?.(); });
    return false;
  }
  function reset() {
    generation++; loadId++; initialId = ''; keyboardId = ''; releaseDrag();
    const handle = dialog; dialog = null; handle?.close();
    state = {uid:'',status:'idle',catalog:[],data:null,order:[],base:[],query:'',category:'',busy:false,error:'',saved:false,conflict:false};
    if (view?.isConnected) view.replaceChildren(); view = null;
  }
  document.addEventListener('click',event => { if (!event.target.closest?.('.lr-menu-wrap')) closeMenus(false); });
  window.addEventListener('icadem:navigation',event => { if (event.detail?.section !== 'ruta-aprendizaje') { releaseDrag(); closeMenus(false); keyboardId = ''; } });
  document.addEventListener('icadem:session-ending',reset); document.addEventListener('icadem:session-ended',reset); document.addEventListener('icadem:user-ready',reset);
  window.addEventListener('beforeunload',event => { if (isDirty() || isBusy()) { event.preventDefault(); event.returnValue = ''; } });
  window.ICADEMLearningRoute = {render,isDirty,isBusy,requestLeave,reset,setInitialCourse:id => { initialId = String(id || ''); }};
})();
