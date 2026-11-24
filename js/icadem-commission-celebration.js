/* Presentation only. Server-confirmed commissions enter through the existing
 * ambassador controller; this module never requests or changes a balance. */
(function () {
  'use strict';
  var active = null;
  function validAmount(value) { return Number.isSafeInteger(value) && value > 0; }
  function validStatus(value) { return value === 'pending' || value === 'available'; }
  function show(options) {
    if (active || !validAmount(options?.amountCents) || !validStatus(options?.status)) return null;
    var state = { finished: false, busy: false, flying: false, timers: [], animations: [], target: null };
    var before = document.activeElement, motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    var reduced = function () { return Boolean(motion?.matches); };
    var current = function () { return !state.finished && document.visibilityState !== 'hidden' && options.canContinue?.() !== false; };
    var money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(options.amountCents / 100);
    var root = document.createElement('div');
    root.className = 'amb-commission-celebration'; root.dataset.phase = 'presented';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'amb-commission-title'); root.setAttribute('aria-describedby', 'amb-commission-description');
    root.innerHTML = '<div class="amb-commission-celebration__shade" data-amb-celebration-close></div>' +
      '<section class="amb-commission-celebration__dialog" role="document"><button class="amb-commission-celebration__close" type="button" aria-label="Cerrar aviso de comisión" data-amb-celebration-close>×</button>' +
      '<div class="amb-commission-celebration__art" aria-hidden="true"><img src="assets/ambassador-banknotes.svg" width="320" height="224" alt=""></div>' +
      '<p class="amb-commission-celebration__eyebrow">' + (options.status === 'pending' ? 'NUEVA COMISIÓN REGISTRADA' : 'COMISIÓN VALIDADA') + '</p>' +
      '<h2 id="amb-commission-title">¡Tu invitación se convirtió en una membresía VIP!</h2>' +
      '<div class="amb-commission-celebration__amount">' + money + '<small>MXN</small></div>' +
      '<div class="amb-commission-celebration__status" data-state="' + options.status + '">' + (options.status === 'pending' ? 'En validación' : 'Validada') + '</div>' +
      '<p id="amb-commission-description">' + (options.status === 'pending' ? 'Tu comisión quedó registrada. Aún no forma parte del saldo disponible.' : 'Consulta el saldo confirmado de tu cuenta de embajador.') + '</p>' +
      '<p class="amb-commission-celebration__feedback" role="status" aria-live="polite" hidden></p>' +
      '<div class="amb-commission-celebration__actions"><button class="amb-btn" type="button" data-amb-collect>' + (options.status === 'pending' ? 'Ver comisión' : 'Ver saldo') + '</button></div></section>';
    var collect = root.querySelector('[data-amb-collect]'), feedback = root.querySelector('.amb-commission-celebration__feedback');
    function later(fn, ms) { var id = setTimeout(fn, ms); state.timers.push(id); return id; }
    function focus(node) {
      if (!node?.isConnected || typeof node.focus !== 'function' || node === document.body || node === document.documentElement) return false;
      node.focus({ preventScroll: true }); return document.activeElement === node;
    }
    function finish(reason, target) {
      if (state.finished) return;
      var mayFocus = document.visibilityState !== 'hidden' && options.canContinue?.() !== false;
      state.finished = true;
      state.timers.forEach(clearTimeout); state.animations.forEach(function (animation) { animation.cancel(); });
      root.remove(); state.layer?.remove(); state.target?.classList.remove('amb-commission-wallet-pulse');
      document.removeEventListener('keydown', keys, true); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize); window.removeEventListener('hashchange', route);
      motion?.removeEventListener?.('change', motionChanged);
      if (active === handle) active = null;
      if (mayFocus && !focus(target) && !focus(before)) focus(options.returnFocus?.());
      options.onDismiss?.(reason);
    }
    function keys(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish('dismissed'); return; }
      if (event.key !== 'Tab' || state.flying) return;
      var buttons = Array.from(root.querySelectorAll('button:not([disabled])'));
      if (!buttons.length) return;
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (!root.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); focus(event.shiftKey ? last : first);
      }
    }
    function visibility() { if (document.visibilityState === 'hidden') finish('cancelled'); }
    function route() { if (!current()) finish('cancelled'); }
    function resize() { if (state.flying) finish(current() ? 'collected' : 'cancelled', state.target); }
    function motionChanged() { if (state.flying && reduced()) finish(current() ? 'collected' : 'cancelled', state.target); }
    function arrived() {
      if(state.finished||state.arriving)return;state.arriving=true;
      if (!current()) { finish('cancelled'); return; }
      state.layer?.remove();
      if (state.target?.isConnected && !reduced()) {
        state.target.classList.add('amb-commission-wallet-pulse');
        later(function () { finish('collected', state.target); }, 480);
      } else finish('collected', state.target);
    }
    function fly(target, source) {
      state.target = target?.isConnected ? target : null;
      if (state.target) {
        var r = state.target.getBoundingClientRect();
        if (r.top < 12 || r.bottom > window.innerHeight - 84 || r.left < 0 || r.right > window.innerWidth) state.target.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      root.remove(); document.removeEventListener('keydown', keys, true);
      if (!current()) { finish('cancelled'); return; }
      if (reduced() || !state.target) { finish('collected', state.target); return; }
      var rect = state.target.getBoundingClientRect(), width = window.innerWidth, height = window.innerHeight;
      if (!rect.width || !rect.height || rect.right < 0 || rect.left > width || rect.bottom < 0 || rect.top > height) { finish('collected', state.target); return; }
      var layer = document.createElement('div'); layer.className = 'amb-commission-flight'; layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer); state.layer = layer; state.flying = true;
      var count = width < 600 ? 6 : 8, flights = [];
      for (var i = 0; i < count; i++) {
        var bill = document.createElement('span'); bill.className = 'amb-commission-flight__bill';
        bill.innerHTML = '<img src="assets/ambassador-banknote.svg" width="120" height="70" alt="">'; layer.appendChild(bill);
        if (typeof bill.animate !== 'function') { finish('collected', state.target); return; }
        var bw = bill.getBoundingClientRect().width, bh = bill.getBoundingClientRect().height;
        var clamp = function (n, max) { return Math.max(4, Math.min(max - 4, n)); };
        var sx = clamp(source.x + (i - count / 2) * 6 - bw / 2, width - bw), sy = clamp(source.y + i % 3 * 5 - bh / 2, height - bh);
        var ex = clamp(rect.left + rect.width / 2 - bw / 2, width - bw), ey = clamp(rect.top + rect.height / 2 - bh / 2, height - bh);
        var mx = clamp((sx + ex) / 2 + (i % 2 ? 28 : -28), width - bw), my = clamp(Math.min(sy, ey) - 45 - i * 3, height - bh);
        var frames = [
          { transform: 'translate3d(' + sx + 'px,' + sy + 'px,0) rotate(' + (i * 7 - 22) + 'deg) scale(1)', opacity: 0 },
          { transform: 'translate3d(' + sx + 'px,' + sy + 'px,0) rotate(' + (i * 7 - 22) + 'deg) scale(1)', opacity: 1, offset: .12 },
          { transform: 'translate3d(' + mx + 'px,' + my + 'px,0) rotate(' + (i % 2 ? 16 : -16) + 'deg) scale(.75)', opacity: 1, offset: .55 },
          { transform: 'translate3d(' + ex + 'px,' + ey + 'px,0) rotate(0deg) scale(.12)', opacity: 0 }
        ];
        var animation = bill.animate(frames, { duration: 880, delay: i * 45, easing: 'cubic-bezier(.25,.65,.35,1)', fill: 'both' });
        state.animations.push(animation); flights.push(animation.finished.catch(function () {}));
      }
      focus(state.target);
      Promise.all(flights).then(function () { if (!state.finished) arrived(); });
      later(function () { if (!state.finished) arrived(); }, 1600);
    }
    collect.addEventListener('click', async function () {
      if (state.busy || !current()) return;
      state.busy = true; collect.disabled = true; collect.textContent = 'Actualizando…'; collect.setAttribute('aria-busy', 'true'); feedback.hidden = true;
      try {
        var result = await options.onCollect?.();
        if (state.finished) return;
        if (!current()) { finish('cancelled'); return; }
        if (!result || result.skip || !validStatus(result.status) || result.amountCents !== options.amountCents) { finish('stale'); return; }
        var box = root.querySelector('.amb-commission-celebration__art').getBoundingClientRect();
        fly(result.target, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
      } catch (_) {
        if (state.finished) return;
        if (!current()) { finish('cancelled'); return; }
        feedback.hidden = false; feedback.textContent = 'No pudimos actualizar tu saldo. Conservamos el aviso; puedes reintentar.';
        state.busy = false; collect.disabled = false; collect.textContent = 'Reintentar'; collect.removeAttribute('aria-busy');
      }
    });
    root.querySelectorAll('[data-amb-celebration-close]').forEach(function (node) { node.addEventListener('click', function () { finish('dismissed'); }); });
    var handle = { cancel: function () { finish('cancelled'); } }; active = handle;
    document.body.appendChild(root);
    document.addEventListener('keydown', keys, true); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize); window.addEventListener('hashchange', route); motion?.addEventListener?.('change', motionChanged);
    later(function () { if (current()) focus(root.querySelector('.amb-commission-celebration__close')); else finish('cancelled'); }, 0);
    return handle;
  }
  window.ICADEMCommissionCelebration = { show: show, isOpen: function () { return Boolean(active); } };
})();
