/* Decorative only: existing server-confirmed commissions and balances stay authoritative. */
(function () {
  'use strict';
  var active = null;
  function validAmount(value) { return Number.isSafeInteger(value) && value > 0; }
  function validStatus(value) { return value === 'pending' || value === 'available'; }
  function show(options) {
    if (active || !validAmount(options?.amountCents) || !validStatus(options?.status)) return null;
    var state = { finished: false, flying: false, timers: [], animations: [], target: null };
    var motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    var reduced = function () { return Boolean(motion?.matches); };
    var current = function () { return !state.finished && document.visibilityState !== 'hidden' && options.canContinue?.() !== false; };
    var root = document.createElement('div'); root.className = 'amb-commission-celebration';
    var status = document.createElement('p'); status.className = 'amb-commission-celebration__announcement';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    root.appendChild(status);
    function later(fn, ms) { var id = setTimeout(fn, ms); state.timers.push(id); return id; }
    function finish(reason) {
      if (state.finished) return;
      state.finished = true;
      state.timers.forEach(clearTimeout); state.animations.forEach(function (animation) { animation.cancel(); });
      root.remove(); state.target?.classList.remove('amb-commission-wallet-pulse');
      document.removeEventListener('keydown', keys); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize); window.removeEventListener('hashchange', route);
      motion?.removeEventListener?.('change', motionChanged);
      if (active === handle) active = null;
      options.onDismiss?.(reason);
    }
    function keys(event) { if (event.key === 'Escape') finish(root.isConnected ? 'dismissed' : 'cancelled'); }
    function visibility() { if (document.visibilityState === 'hidden') finish('cancelled'); }
    function route() { if (!current()) finish('cancelled'); }
    function resize() { if (state.flying) finish(current() ? 'collected' : 'cancelled'); }
    function motionChanged() { if (state.flying && reduced()) finish(current() ? 'collected' : 'cancelled'); }
    function arrived() {
      if (state.finished || state.arriving) return; state.arriving = true;
      if (!current()) { finish('cancelled'); return; }
      root.querySelector('.amb-commission-flight')?.remove();
      if (state.target?.isConnected && !reduced()) {
        state.target.classList.add('amb-commission-wallet-pulse');
        later(function () { finish('collected'); }, 480);
      } else finish('collected');
    }
    function fly() {
      var layer = document.createElement('div'); layer.className = 'amb-commission-flight'; layer.setAttribute('aria-hidden', 'true');
      root.appendChild(layer); state.flying = true;
      var width = window.innerWidth, height = window.innerHeight;
      var size = width < 600 ? 176 : 216, billHeight = size * 224 / 320;
      var sx = (width - size) / 2, sy = (height - billHeight) / 2;
      var ex = Math.max(sx, width - size / 2 - 24), ey = Math.min(sy, 24 - billHeight / 2);
      var mx = sx + (ex - sx) * .46, my = sy + (ey - sy) * .62;
      var count = width < 600 ? 3 : 4, flights = [];
      for (var i = 0; i < count; i++) {
        var bill = document.createElement('span'); bill.className = 'amb-commission-flight__bill';
        bill.style.width = size + 'px'; bill.style.height = billHeight + 'px';
        bill.innerHTML = '<img src="assets/ambassador-banknotes.svg?v=2" width="320" height="224" alt="">'; layer.appendChild(bill);
        if (typeof bill.animate !== 'function') { layer.remove(); later(function () { finish(current() ? 'collected' : 'cancelled'); }, 1800); return; }
        // Identical geometry for every bundle: one orderly stream, always up/right.
        var frames = [
          { transform: 'translate3d(' + sx + 'px,' + sy + 'px,0) scale(.82)', opacity: 0, easing: 'ease-out' },
          { transform: 'translate3d(' + sx + 'px,' + sy + 'px,0) scale(1)', opacity: 1, offset: .12 },
          { transform: 'translate3d(' + sx + 'px,' + sy + 'px,0) scale(1)', opacity: 1, offset: .30, easing: 'cubic-bezier(.4,0,.65,1)' },
          { transform: 'translate3d(' + mx + 'px,' + my + 'px,0) scale(.65)', opacity: 1, offset: .65, easing: 'cubic-bezier(.15,.45,.4,1)' },
          { transform: 'translate3d(' + ex + 'px,' + ey + 'px,0) scale(.18)', opacity: 0 }
        ];
        var animation = bill.animate(frames, { duration: 1850, delay: i * 170, easing: 'linear', fill: 'both' });
        state.animations.push(animation); flights.push(animation.finished.catch(function () {}));
      }
      Promise.all(flights).then(function () { if (!state.finished) arrived(); });
      later(function () { if (!state.finished) arrived(); }, 2900);
    }
    async function start() {
      try {
        var result = await options.onCollect?.();
        if (state.finished) return;
        if (!current()) { finish('cancelled'); return; }
        if (result?.defer) { finish('deferred'); return; }
        if (!result || result.skip || !validStatus(result.status) || result.amountCents !== options.amountCents) { finish('stale'); return; }
        state.target = result.target?.isConnected ? result.target : null;
        document.body.appendChild(root);
        var money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(result.amountCents / 100);
        later(function () { if (current()) status.textContent = 'Comisión de ' + money + ' MXN ' + (result.status === 'pending' ? 'registrada y en validación. Aún no forma parte del saldo disponible.' : 'validada. Consulta el saldo confirmado de tu panel.'); }, 30);
        if (reduced()) { later(function () { finish(current() ? 'collected' : 'cancelled'); }, 1800); return; }
        fly();
      } catch (_) {
        if (state.finished) return;
        if (!current()) { finish('cancelled'); return; }
        options.onError?.(); finish('failed');
      }
    }
    var handle = { cancel: function () { finish('cancelled'); } }; active = handle;
    document.addEventListener('keydown', keys); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize); window.addEventListener('hashchange', route); motion?.addEventListener?.('change', motionChanged);
    later(start, 0);
    return handle;
  }
  window.ICADEMCommissionCelebration = { show: show, isOpen: function () { return Boolean(active); } };
})();
