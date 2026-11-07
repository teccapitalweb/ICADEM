/* Referral visits are anonymous browser counts, never a directory of visitors. */
(function () {
  'use strict';
  var REF_KEY = 'icadem:ambassador:ref';
  var VISITOR_KEY = 'icadem:ambassador:visitor';
  var pending = Object.create(null);
  var memoryId = '';
  function codeOf(value) {
    var code = String(value || '').trim().toUpperCase();
    return /^[A-Z0-9]{3,8}-[A-Z0-9]{4,8}$/.test(code) ? code : '';
  }
  function visitorId() {
    try {
      var saved = localStorage.getItem(VISITOR_KEY);
      if (/^[a-zA-Z0-9-]{20,80}$/.test(saved || '')) return saved;
      if (!memoryId && window.crypto?.randomUUID) memoryId = window.crypto.randomUUID();
      if (!memoryId && window.crypto?.getRandomValues) memoryId = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), function (v) { return v.toString(16).padStart(2, '0'); }).join('');
      if (memoryId) localStorage.setItem(VISITOR_KEY, memoryId);
    } catch (_) {}
    return memoryId || undefined;
  }
  function savedCode() {
    try {
      var saved = JSON.parse(localStorage.getItem(REF_KEY) || 'null');
      return saved && Date.now() - Number(saved.capturedAt || 0) <= 30 * 86400000 ? codeOf(saved.code) : '';
    } catch (_) { return ''; }
  }
  function captureVisit(value) {
    var code = codeOf(value), id = visitorId();
    if (!code || !id) return Promise.resolve(false);
    var key = 'icadem:ambassador:visit:' + code;
    try { if (Date.now() - Number(localStorage.getItem(key) || 0) < 86400000) return Promise.resolve(true); } catch (_) {}
    if (pending[code]) return pending[code];
    pending[code] = fetch((window.WEBHOOK_URL || 'https://icadem-webhook-production.up.railway.app') + '/api/ambassadors/visit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, visitorId: id }), keepalive: true,
      credentials: 'omit', referrerPolicy: 'no-referrer'
    }).then(function (response) {
      if (!response.ok) return false;
      try { localStorage.setItem(key, String(Date.now())); } catch (_) {}
      return true;
    }).catch(function () { return false; }).finally(function () { delete pending[code]; });
    return pending[code];
  }
  window.ICADEMReferral = { visitorId: visitorId, captureVisit: captureVisit, savedCode: savedCode };
  try {
    var code = codeOf(new URLSearchParams(location.search).get('ref'));
    if (code) {
      localStorage.setItem(REF_KEY, JSON.stringify({ code: code, capturedAt: Date.now() }));
      captureVisit(code);
    }
  } catch (_) {}
})();
