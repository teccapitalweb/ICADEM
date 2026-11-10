/* One server-authoritative inbox enriches the existing bell. */
(function () {
  'use strict';
  var uid = '', generation = 0, timer, expiryTimer, busy = false, syncAgain = false, version = 0, pendingTarget = null, serverClock = null;
  var retention = 15 * 24 * 60 * 60 * 1000;
  function elapsedClock() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function serverNow() { return serverClock ? serverClock.server + Math.max(0, elapsedClock() - serverClock.received) : Infinity; }
  function state() { return window.__notifsState; }
  function visibleItems() {
    return (state()?.items || []).filter(function (item) { return window.__isDemoMode || item.expiresAtMs > serverNow(); });
  }
  function merge() {
    var current = state();
    if (!current) return;
    current.items = (current.generalItems || []).concat(current.personalItems || []).filter(function (item) {
      return window.__isDemoMode || item.expiresAtMs > serverNow();
    }).sort(function (a, b) { return b.createdAtMs - a.createdAtMs; });
    clearTimeout(expiryTimer);
    if (!window.__isDemoMode && current.items.length) {
      var next = Math.min.apply(null, current.items.map(function (item) { return item.expiresAtMs; }));
      expiryTimer = setTimeout(function () { merge(); window.refreshNotifDropdown?.(); }, Math.max(1, next - serverNow()));
    }
    window.actualizarBadgeNotif?.();
  }
  function setGeneral(items) {
    if (window.__isDemoMode && state()) { state().generalItems = items; state().loaded = true; merge(); }
    else sync(); // Firestore invalidates the inbox; it never bypasses the server filter.
  }
  function checkedResponse(response) {
    if (!Array.isArray(response?.items) || !Number.isFinite(response.serverNowMs) || response.serverNowMs <= 0) throw new Error('Invalid inbox');
    return response.items.map(function (item) {
      if (!['general','personal'].includes(item.source) || !/^[A-Za-z0-9_-]{1,240}$/.test(item.serverId || '') || item.id !== item.source + '-' + item.serverId ||
          !Number.isFinite(item.createdAtMs) || item.createdAtMs <= 0 || item.createdAtMs > response.serverNowMs ||
          item.expiresAtMs !== item.createdAtMs + retention || item.expiresAtMs <= response.serverNowMs) throw new Error('Invalid notification');
      return Object.assign({}, item, {read:item.read === true});
    });
  }
  async function migrateLegacy(run, owner) {
    // Only this authenticated user's old preferences and server-confirmed general IDs.
    // Browser storage never determines visible rows or the unread count.
    if (window.UserState?.uid && window.UserState.uid !== owner) return;
    var readKey = 'icadem_notif_read_' + owner, dismissedKey = 'icadem_notif_deleted_' + owner, reads, dismissed;
    try { reads = JSON.parse(localStorage.getItem(readKey) || '[]'); dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]'); }
    catch (_) { return; }
    var general = state()?.generalItems || [];
    var readIds = general.filter(function (item) { return Array.isArray(reads) && reads.includes(item.serverId); }).map(function (item) { return item.id; });
    var dismissedIds = general.filter(function (item) { return Array.isArray(dismissed) && dismissed.includes(item.serverId); }).map(function (item) { return item.id; });
    if (readIds.length && !await mark(readIds, false)) return;
    if (run !== generation || owner !== uid) return;
    if (dismissedIds.length && !await mark(dismissedIds, true)) return;
    if (run !== generation || owner !== uid) return;
    try { localStorage.removeItem(readKey); localStorage.removeItem(dismissedKey); } catch (_) {}
  }
  async function sync() {
    var current = window.__currentUser?.uid || '';
    if (!current || current !== uid || !state() || !window.ICADEMPlatform?.request || window.__isDemoMode) return;
    if (busy) { syncAgain = true; return; }
    busy = true;
    var run = generation, owner = uid, before = version;
    try {
      var response = await window.ICADEMPlatform.request('/api/notifications'), items = checkedResponse(response);
      if (run !== generation || owner !== window.__currentUser?.uid) return;
      if (before !== version) { syncAgain = true; return; }
      serverClock = {server:response.serverNowMs, received:elapsedClock()};
      state().generalItems = items.filter(function (item) { return item.source === 'general'; });
      state().personalItems = items.filter(function (item) { return item.source === 'personal'; });
      state().loaded = true; state().error = false; state().source = 'server';
      merge();
      await migrateLegacy(run, owner);
      window.refreshNotifDropdown?.();
    } catch (_) {
      if (run === generation && owner === uid) { state().error = true; merge(); window.refreshNotifDropdown?.(); }
    } finally {
      if (run === generation) { busy = false; if (syncAgain) { syncAgain = false; sync(); } }
    }
  }
  function start() {
    generation++; uid = window.__currentUser?.uid || '';
    busy = false; syncAgain = false; pendingTarget = null; serverClock = null; version++;
    clearInterval(timer); clearTimeout(expiryTimer);
    if (state()) { state().generalItems = []; state().personalItems = []; state().loaded = false; state().error = false; merge(); }
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
  function applyMarked(ids, dismiss) {
    var current = state();
    for (var key of ['generalItems','personalItems']) {
      if (dismiss) current[key] = (current[key] || []).filter(function (item) { return !ids.includes(item.id); });
      else (current[key] || []).forEach(function (item) { if (ids.includes(item.id)) item.read = true; });
    }
    version++; if (busy) syncAgain = true; merge();
  }
  async function mark(ids, dismiss) {
    var run = generation, owner = uid;
    var selected = visibleItems().filter(function (item) { return ids.includes(item.id) && (dismiss || !item.read); });
    if (!selected.length) return true;
    if (window.__isDemoMode) { applyMarked(ids, dismiss); return true; }
    if (!owner || owner !== window.__currentUser?.uid) return false;
    try {
      for (var offset = 0; offset < selected.length; offset += 100) {
        var chunk = selected.slice(offset, offset + 100);
        var response = await window.ICADEMPlatform.request('/api/notifications/' + (dismiss ? 'dismiss' : 'read'),
          {method:'POST',body:{items:chunk.map(function (item) { return {source:item.source,id:item.serverId}; })}});
        if (run !== generation || owner !== window.__currentUser?.uid) return false;
        if (!response?.ok) throw new Error('Not persisted');
        applyMarked(chunk.map(function (item) { return item.id; }), dismiss);
      }
      return true;
    } catch (_) { window.Toast?.error?.('No se pudo guardar', 'Reintenta cuando tengas conexión.'); return false; }
  }
  function open(item) {
    if (!['directorio','embajadores','webinars','cursos','certificados','logros','foro','materiales','perfil'].includes(item?.target?.section)) return;
    mark([item.id], false); window.cerrarNotifDropdown?.(); pendingTarget = item.target;
    if (window.navigateToSection) window.navigateToSection(item.target.section);
    else if (item.target.section === 'directorio') window.ICADEMCommunity?.openNotificationTarget?.();
    else if (item.target.section === 'embajadores') window.ICADEMAmbassadors?.openNotificationTarget?.();
  }
  function consume(section) {
    if (pendingTarget?.section !== section) return null;
    var value = pendingTarget; pendingTarget = null; return value;
  }
  window.ICADEMNotifications = {setGeneral:setGeneral,sync:sync,start:start,mark:mark,open:open,consume:consume,visibleItems:visibleItems};
  document.addEventListener('icadem:user-ready', start);
  document.addEventListener('icadem:session-ending', function () {
    generation++; uid = ''; busy = false; syncAgain = false; pendingTarget = null; serverClock = null;
    clearInterval(timer); clearTimeout(expiryTimer);
    if (state()) { state().generalItems = []; state().personalItems = []; state().loaded = false; merge(); }
    window.cerrarNotifDropdown?.();
  });
  document.addEventListener('icadem:session-exit-failed', start);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
  setTimeout(start, 0);
})();
