/* UI return state for the existing panel router. No course access is stored here. */
(function () {
  'use strict';
  const SECTION = 'ruta-aprendizaje', KEY = 'icadem:courses-return:v1:', MAX_AGE = 4 * 60 * 60 * 1000;
  const courseViews = new Set(['cursos-disponibles','cursos-progreso','cursos-completados','cursos-bloqueados','cursos-proximamente','cursos-regalo']);
  let active = '', memory = null, restore = false, revision = 0, committed = null, restoring = null, accepted = null;
  const viewer = () => (window.__auth ? window.__auth.currentUser?.uid : window.UserState?.uid || window.__currentUser?.uid) || '';
  const here = () => location.pathname + location.search + location.hash;
  function position() {
    return {window:window.scrollY || 0, document:document.documentElement?.scrollTop || 0, body:document.body?.scrollTop || 0,
      scrolling:document.scrollingElement?.scrollTop || 0, main:document.querySelector('main.main')?.scrollTop || 0,
      dynamic:document.getElementById('dynamic-section')?.scrollTop || 0};
  }
  function capture() {
    const uid = viewer(), root = document.querySelector('.courses-page--premium');
    if (!uid || !root) return;
    memory = {uid, at:Date.now(), search:root.querySelector('#cur-search')?.value || '', area:root.querySelector('#cur-area')?.value || 'todas',
      nivel:root.querySelector('#cur-level')?.value || 'todos', orden:root.querySelector('#cur-sort')?.value || 'proximos',
      estado:root.querySelector('[data-course-filter][aria-pressed="true"]')?.dataset.courseFilter || 'todos',
      tabs:root.querySelector('.courses-status-filters')?.scrollLeft || 0, scroll:position()};
    try { sessionStorage.setItem(KEY + uid, JSON.stringify(memory)); } catch (_) {}
  }
  function saved() {
    const uid = viewer(); let value = memory;
    if (!uid) return null;
    if (!value || value.uid !== uid) { try { value = JSON.parse(sessionStorage.getItem(KEY + uid) || 'null'); } catch (_) { value = null; } }
    if (!value || value.uid !== uid || Date.now() - value.at > MAX_AGE || Date.now() < value.at) return null;
    return {search:String(value.search || '').slice(0,300), area:String(value.area || 'todas').slice(0,150), nivel:String(value.nivel || 'todos').slice(0,100),
      orden:['proximos','prioridades','nombre','progreso','recientes'].includes(value.orden) ? value.orden : 'proximos',
      estado:['todos','disponibles','progreso','completados','bloqueados','proximamente','regalo'].includes(value.estado) ? value.estado : 'todos',
      tabs:Math.max(0, Number(value.tabs) || 0), scroll:value.scroll || {}};
  }
  function allowNavigation(section, options, proceed) {
    if (options?.learningApproved) return true;
    if (accepted === here()) { accepted = null; return true; }
    if (active !== SECTION) return true;
    return window.ICADEMLearningRoute?.requestLeave?.(proceed) !== false;
  }
  function handleHistory() {
    const url = here();
    if (restoring) {
      if (url === committed?.url) {
        const target = restoring; restoring = null;
        const proceed = () => { accepted = target.url; history.go(target.delta); };
        if (window.ICADEMLearningRoute?.requestLeave?.(proceed) !== false) proceed();
      }
      return true;
    }
    if (accepted === url) return false;
    const route = window.ICADEMLearningRoute;
    if (active !== SECTION || !committed || url === committed.url || (!route?.isDirty?.() && !route?.isBusy?.())) return false;
    const index = history.state?.icademProfessionalIndex, previous = committed.state?.icademProfessionalIndex;
    const delta = Number.isInteger(index) && Number.isInteger(previous) ? index - previous : 0;
    if (delta) { restoring = {url, delta}; history.go(-delta); return true; }
    const destination = new URL(url, location.href);
    history.replaceState(committed.state, '', committed.url);
    const proceed = () => window.navigateToSection?.(destination.hash.slice(1), {reemplazar:true, learningApproved:true});
    if (route.requestLeave(proceed) !== false) proceed();
    return true;
  }
  function prepare(section, options, route) {
    revision++;
    if (active === 'cursos' && (section === SECTION || courseViews.has(section))) capture();
    restore = section === 'cursos' && (active === SECTION || courseViews.has(active) || Boolean(options?.fromHistory && history.state?.icademLearningCourses)) && Boolean(saved());
    if (route?.historyState) {
      const state = route.historyState;
      if (section === SECTION && active === 'cursos') state.icademLearningReturn = {uid:viewer(), index:history.state?.icademProfessionalIndex};
      else if (section !== SECTION) delete state.icademLearningReturn;
      if (courseViews.has(section) && active === 'cursos' && !options?.fromHistory) state.icademCourseViewReturn = {uid:viewer(), index:history.state?.icademProfessionalIndex};
      else if (!courseViews.has(section)) delete state.icademCourseViewReturn;
      if (section === 'cursos') state.icademLearningCourses = true;
      else delete state.icademLearningCourses;
    }
    active = section;
    return {restoreCourses:restore};
  }
  function coursesState() { return restore ? saved() : null; }
  function coursesReady(root) {
    if (!restore || active !== 'cursos' || !root?.isConnected) return;
    const state = saved(), run = revision, uid = viewer(); if (!state) return;
    requestAnimationFrame(() => {
      if (run !== revision || uid !== viewer() || !restore || !root.isConnected) return;
      restore = false;
      const elements = {document:document.documentElement, body:document.body, scrolling:document.scrollingElement,
        main:document.querySelector('main.main'), dynamic:document.getElementById('dynamic-section')};
      Object.entries(elements).forEach(([key, element]) => { if (element) element.scrollTop = Math.max(0, Number(state.scroll[key]) || 0); });
      const tabs = root.querySelector('.courses-status-filters'); if (tabs) tabs.scrollLeft = state.tabs;
      window.scrollTo({top:Math.max(0, Number(state.scroll.window) || 0), left:0, behavior:'instant'});
    });
  }
  function back() {
    const source = history.state?.icademLearningReturn, index = history.state?.icademProfessionalIndex;
    if (source?.uid === viewer() && Number.isInteger(source.index) && Number.isInteger(index) && index > source.index && index - source.index <= 20) history.go(source.index - index);
    else window.navigateToSection?.('cursos', {reemplazar:true});
  }
  function reset() {
    const uid = memory?.uid || viewer();
    revision++; restore = false; active = ''; memory = null; committed = null; restoring = null; accepted = null;
    try { if (uid) sessionStorage.removeItem(KEY + uid); } catch (_) {}
  }
  window.addEventListener('icadem:navigation', () => { committed = {url:here(), state:history.state}; });
  document.addEventListener('icadem:session-ending', reset);
  document.addEventListener('icadem:user-ready', () => { if (memory && memory.uid !== viewer()) reset(); });
  function backToCourses() {
    const source = history.state?.icademCourseViewReturn, index = history.state?.icademProfessionalIndex;
    if (source?.uid === viewer() && Number.isInteger(source.index) && Number.isInteger(index) && index > source.index && index - source.index <= 20) history.go(source.index - index);
    else window.navigateToSection?.('cursos', {reemplazar:true});
  }
  window.ICADEMLearningNavigation = {allowNavigation, handleHistory, prepare, coursesState, coursesReady, back, backToCourses};
  window.__backToCoursesFromRoute = back;
  window.__openLearningRoute = id => { window.ICADEMLearningRoute?.setInitialCourse?.(id); window.navigateToSection?.(SECTION); };
})();
