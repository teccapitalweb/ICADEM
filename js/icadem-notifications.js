/* Personal events enrich the existing bell; general announcements keep their listener. */
(function () {
  'use strict';
  var uid = '', generation = 0, timer, busy = false, pendingTarget = null;
  function merge() {
    var state = window.__notifsState;
    if (!state) return;
    state.items = (state.generalItems || []).concat(state.personalItems || [])
      .sort(function (a, b) { return b.createdAtMs - a.createdAtMs; });
    window.actualizarBadgeNotif?.();
  }
  function setGeneral(items) {
    if (!window.__notifsState) return;
    window.__notifsState.generalItems = items;
    merge();
  }
  async function sync() {
    var current = window.__currentUser?.uid || '';
    if (!current || current !== uid || busy || !window.ICADEMPlatform?.request || window.__isDemoMode) return;
    busy = true;
    var run = generation;
    try {
      var response = await window.ICADEMPlatform.request('/api/notifications/personal');
      if (run !== generation || uid !== window.__currentUser?.uid) return;
      window.__notifsState.personalItems = (response.items || []).map(function (item) {
        return Object.assign({}, item, {serverId:item.id, id:'personal-'+item.id, personal:true});
      });
      merge();
    } catch (_) { /* Keep the last confirmed events while offline. */ }
    finally { if (run === generation) busy = false; }
  }
  function start() {
    generation++;
    uid = window.__currentUser?.uid || '';
    busy = false; pendingTarget = null;
    clearInterval(timer);
    if (window.__notifsState) { window.__notifsState.personalItems = []; merge(); }
    if (uid && typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined' && location.hash === '#embajadores') {
      var withdrawal = new URLSearchParams(location.search).get('withdrawal');
      if (/^[A-Za-z0-9_-]{1,220}$/.test(withdrawal || '')) {
        pendingTarget = {section:'embajadores',view:'withdrawals',withdrawalId:withdrawal};
        window.ICADEMAmbassadors?.openNotificationTarget?.();
      }
    }
    sync();
    if (uid) timer = setInterval(function () { if (document.visibilityState === 'visible') sync(); }, 30000);
  }
  async function mark(ids, dismiss) {
    var state = window.__notifsState, run = generation;
    var selected = (state?.personalItems || []).filter(function (item) { return ids.includes(item.id); });
    if (!selected.length) return;
    try {
      await window.ICADEMPlatform.request('/api/notifications/personal/'+(dismiss?'dismiss':'read'),
        {method:'POST', body:{ids:selected.map(function (item) { return item.serverId; })}});
      if (run !== generation) return;
      if (dismiss) state.personalItems = state.personalItems.filter(function (item) { return !ids.includes(item.id); });
      else selected.forEach(function (item) { item.read = true; });
      merge();
      if (document.getElementById('notif-dropdown')) { window.cerrarNotifDropdown?.(); window.toggleNotifDropdown?.(); }
    } catch (_) { window.Toast?.error?.('No se pudo guardar', 'Reintenta cuando tengas conexión.'); }
  }
  function open(item) {
    if (!['directorio', 'embajadores'].includes(item?.target?.section)) return;
    mark([item.id], false);
    window.cerrarNotifDropdown?.();
    pendingTarget = item.target;
    if (window.navigateToSection) window.navigateToSection(item.target.section);
    else if (item.target.section === 'directorio') window.ICADEMCommunity?.openNotificationTarget?.();
    else window.ICADEMAmbassadors?.openNotificationTarget?.();
  }
  function consume(section) {
    if (pendingTarget?.section !== section) return null;
    var value = pendingTarget; pendingTarget = null; return value;
  }
  window.ICADEMNotifications = {setGeneral:setGeneral, sync:sync, mark:mark, open:open, consume:consume};
  document.addEventListener('icadem:user-ready', start);
  document.addEventListener('icadem:session-ending', function () {
    generation++; uid = ''; busy = false; pendingTarget = null; clearInterval(timer);
    if (window.__notifsState) { window.__notifsState.personalItems = []; merge(); }
    window.cerrarNotifDropdown?.();
  });
  document.addEventListener('icadem:session-exit-failed', start);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
  setTimeout(start, 0);
})();
