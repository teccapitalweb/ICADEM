(function () {
  'use strict';

  const VERSION = 'v1';
  const STORAGE_PREFIX = 'icadem:onboarding:' + VERSION + ':';
  const MOBILE_BREAKPOINT = 880;
  const steps = [
    {
      title: 'Bienvenido a tu centro de formación',
      text: 'Este es tu punto de partida para organizar el aprendizaje, los recursos y las herramientas que impulsan tu negocio.',
      selectors: ['#inicio-content .banner', '.topbar'],
      mobileSelectors: ['.topbar']
    },
    {
      title: 'Tus cursos, en un solo lugar',
      text: 'En Mis cursos encontrarás formación empresarial, fiscal, financiera y de gestión, junto con tu avance en cada clase.',
      selectors: ['.sidebar .nav-item[data-section="cursos"]', '.mobile-nav__item[data-section="cursos"]']
    },
    {
      title: 'Clases en vivo',
      text: 'Revisa las próximas sesiones con especialistas y participa desde la pestaña Clases en vivo.',
      selectors: ['.sidebar .nav-item[data-section="webinars"]', '.mobile-nav__item[data-section="webinars"]']
    },
    {
      title: 'Biblioteca de materiales',
      text: 'En PDFs y material tendrás plantillas, guías y documentos prácticos para aplicar lo aprendido.',
      selectors: ['.sidebar .nav-item[data-section="pdfs"]', '.mobile-drawer__item[data-section="pdfs"]'],
      mobileDrawer: true
    },
    {
      title: 'Herramientas para tomar decisiones',
      text: 'Accede a plantillas de negocio y calculadoras fiscal, de nómina y de crédito desde el panel de Herramientas Pro.',
      selectors: ['.sidebar .nav-item[data-tool="plantillas"]', '.mobile-drawer__item[data-tool="plantillas"]'],
      mobileDrawer: true
    },
    {
      title: 'Tu perfil y membresía',
      text: 'En Mi perfil administras tus datos y preferencias. La pestaña Suscripción reúne la información de tu plan.',
      selectors: ['.sidebar .nav-item[data-section="perfil"]', '.mobile-drawer__item[data-section="perfil"]'],
      mobileDrawer: true
    },
    {
      title: 'Ya conoces ICADEM',
      text: 'Puedes repetir esta guía en cualquier momento con el botón de ayuda de la barra superior o desde Mi perfil.',
      selectors: ['#icadem-tour-help']
    }
  ];

  let root;
  let spotlight;
  let card;
  let currentTarget = null;
  let stepIndex = 0;
  let running = false;
  let previousFocus = null;
  let renderToken = 0;

  function addStyles() {
    if (document.getElementById('icadem-tour-styles')) return;
    const style = document.createElement('style');
    style.id = 'icadem-tour-styles';
    style.textContent = `
      .ica-tour-root{position:fixed;inset:0;z-index:2147483000;pointer-events:auto;font-family:'Inter',system-ui,sans-serif}
      .ica-tour-root[hidden]{display:none!important}
      .ica-tour-shade{position:absolute;inset:0;background:transparent}
      .ica-tour-spotlight{position:fixed;border:2px solid #8fbce6;border-radius:14px;box-shadow:0 0 0 9999px rgba(5,11,25,.78),0 0 0 5px rgba(91,146,200,.2),0 16px 44px rgba(0,0,0,.34);pointer-events:none;transition:top .2s ease,left .2s ease,width .2s ease,height .2s ease;z-index:1}
      .ica-tour-card{position:fixed;z-index:2;width:min(390px,calc(100vw - 28px));padding:22px;border:1px solid rgba(143,188,230,.3);border-radius:18px;background:linear-gradient(145deg,#18233a,#10192b);color:#f0f4fa;box-shadow:0 24px 70px rgba(0,0,0,.55);outline:none}
      .ica-tour-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:15px}
      .ica-tour-brand{display:flex;align-items:center;gap:9px;color:#8fbce6;font:700 10px/1.2 'JetBrains Mono',monospace;letter-spacing:1.4px;text-transform:uppercase}
      .ica-tour-brand::before{content:'';width:9px;height:9px;border-radius:3px;background:#5b92c8;transform:rotate(45deg);box-shadow:0 0 0 5px rgba(91,146,200,.13)}
      .ica-tour-skip{min-height:36px;padding:7px 9px;border-radius:9px;color:#b6c2d8;font-size:12px}
      .ica-tour-skip:hover,.ica-tour-skip:focus-visible{background:#212e48;color:#fff;outline:2px solid #8fbce6;outline-offset:2px}
      .ica-tour-title{margin:0 0 8px;font:800 clamp(20px,4vw,25px)/1.18 'Plus Jakarta Sans','Inter',sans-serif;letter-spacing:-.5px;color:#fff}
      .ica-tour-text{margin:0;color:#b6c2d8;font-size:14px;line-height:1.65}
      .ica-tour-progress{display:flex;align-items:center;gap:10px;margin:19px 0 17px;color:#8997b0;font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.7px;text-transform:uppercase}
      .ica-tour-track{height:4px;flex:1;overflow:hidden;border-radius:20px;background:#2a3852}
      .ica-tour-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3e6fa8,#8fbce6);transition:width .25s ease}
      .ica-tour-actions{display:flex;justify-content:flex-end;gap:9px}
      .ica-tour-btn{min-height:42px;padding:10px 16px;border-radius:11px;border:1px solid rgba(143,188,230,.22);font-weight:700;font-size:13px}
      .ica-tour-btn:focus-visible{outline:3px solid rgba(143,188,230,.42);outline-offset:2px}
      .ica-tour-prev{margin-right:auto;color:#b6c2d8;background:#10192b}.ica-tour-prev[hidden]{display:none}
      .ica-tour-next{color:#07131f;border-color:transparent;background:linear-gradient(135deg,#8fbce6,#5b92c8);box-shadow:0 8px 24px rgba(91,146,200,.3)}
      .ica-tour-help{position:relative;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
      .ica-tour-profile-btn{display:inline-flex;align-items:center;gap:8px;align-self:flex-start}
      .ica-tour-profile-btn::before{content:'?';display:grid;place-items:center;width:18px;height:18px;border:1px solid currentColor;border-radius:50%;font-size:12px}
      @media (max-width:880px){
        .ica-tour-card{left:14px!important;right:14px!important;bottom:calc(14px + env(safe-area-inset-bottom));top:auto;width:auto;max-height:calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;padding:19px;border-radius:17px}
        .ica-tour-spotlight{border-radius:12px}.ica-tour-title{font-size:20px}.ica-tour-text{font-size:13px;line-height:1.55}.ica-tour-progress{margin:16px 0 14px}
      }
      @media (max-width:380px){.ica-tour-card{left:9px!important;right:9px!important;padding:16px}.ica-tour-actions{gap:6px}.ica-tour-btn{padding:9px 12px}}
      @media (prefers-reduced-motion:reduce){.ica-tour-spotlight,.ica-tour-track span{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function identity() {
    const state = window.UserState || {};
    return state.uid || (state.email && state.email.toLowerCase()) || (state.modo === 'invitado' ? 'invitado' : '');
  }

  function storageKey() {
    return STORAGE_PREFIX + encodeURIComponent(identity() || 'local');
  }

  function wasSeen() {
    try { return localStorage.getItem(storageKey()) === 'complete'; } catch (_) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(storageKey(), 'complete'); } catch (_) {}
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const styles = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
  }

  function firstVisible(selectors) {
    for (const selector of selectors || []) {
      const match = Array.from(document.querySelectorAll(selector)).find(isVisible);
      if (match) return match;
    }
    return null;
  }

  function onMobile() {
    return window.matchMedia('(max-width:' + MOBILE_BREAKPOINT + 'px)').matches;
  }

  function setMobileDrawer(open) {
    if (!onMobile()) return;
    const drawer = document.getElementById('mobile-drawer');
    if (!drawer) return;
    const opened = drawer.classList.contains('is-open');
    if (open && !opened) document.getElementById('mobile-nav-more')?.click();
    if (!open && opened) document.getElementById('mobile-drawer-close')?.click();
  }

  function createRoot() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'ica-tour-root';
    root.hidden = true;
    root.innerHTML = `
      <div class="ica-tour-shade" aria-hidden="true"></div>
      <div class="ica-tour-spotlight" aria-hidden="true"></div>
      <section class="ica-tour-card" role="dialog" aria-modal="true" aria-labelledby="ica-tour-title" aria-describedby="ica-tour-text" tabindex="-1">
        <div class="ica-tour-top">
          <div class="ica-tour-brand">ICADEM · Primeros pasos</div>
          <button class="ica-tour-skip" type="button" data-tour-action="skip">Omitir</button>
        </div>
        <h2 class="ica-tour-title" id="ica-tour-title"></h2>
        <p class="ica-tour-text" id="ica-tour-text"></p>
        <div class="ica-tour-progress" aria-live="polite">
          <span data-tour-count></span>
          <div class="ica-tour-track" aria-hidden="true"><span></span></div>
        </div>
        <div class="ica-tour-actions">
          <button class="ica-tour-btn ica-tour-prev" type="button" data-tour-action="prev">Anterior</button>
          <button class="ica-tour-btn ica-tour-next" type="button" data-tour-action="next">Siguiente</button>
        </div>
      </section>`;
    document.body.appendChild(root);
    spotlight = root.querySelector('.ica-tour-spotlight');
    card = root.querySelector('.ica-tour-card');
    root.addEventListener('click', function (event) {
      const action = event.target.closest('[data-tour-action]')?.dataset.tourAction;
      if (action === 'skip') stop(true);
      if (action === 'prev') go(stepIndex - 1);
      if (action === 'next') stepIndex === steps.length - 1 ? stop(true) : go(stepIndex + 1);
    });
  }

  function place() {
    if (!running || !card || !spotlight) return;
    const gap = 16;
    if (!currentTarget || !isVisible(currentTarget)) {
      spotlight.style.cssText = 'display:none';
      card.style.bottom = 'auto';
      card.style.maxHeight = '';
      card.style.left = Math.max(14, (innerWidth - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(14, (innerHeight - card.offsetHeight) / 2) + 'px';
      return;
    }
    const raw = currentTarget.getBoundingClientRect();
    const pad = 8;
    const rect = {
      left: Math.max(6, raw.left - pad), top: Math.max(6, raw.top - pad),
      width: Math.min(innerWidth - 12, raw.width + pad * 2),
      height: Math.min(innerHeight - 12, raw.height + pad * 2)
    };
    spotlight.style.display = 'block';
    spotlight.style.left = rect.left + 'px'; spotlight.style.top = rect.top + 'px';
    spotlight.style.width = rect.width + 'px'; spotlight.style.height = rect.height + 'px';
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    if (onMobile()) {
      const targetInLowerHalf = rect.top + (rect.height / 2) >= innerHeight / 2;
      if (targetInLowerHalf) {
        const spaceAbove = Math.max(96, Math.floor(rect.top - gap - 12));
        const top = Math.max(12, Math.floor(rect.top - Math.min(cardHeight, spaceAbove) - gap));
        card.style.bottom = 'auto';
        card.style.top = `max(${top}px, calc(12px + env(safe-area-inset-top)))`;
        card.style.maxHeight = `min(${spaceAbove}px, calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))`;
      } else {
        const spaceBelow = Math.max(96, Math.floor(innerHeight - rect.top - rect.height - gap - 12));
        card.style.top = 'auto';
        card.style.bottom = 'calc(12px + env(safe-area-inset-bottom))';
        card.style.maxHeight = `min(${spaceBelow}px, calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))`;
      }
      return;
    }
    card.style.bottom = 'auto';
    card.style.maxHeight = '';
    let left = rect.left;
    let top = rect.top + rect.height + gap;
    if (left + cardWidth > innerWidth - 14) left = innerWidth - cardWidth - 14;
    if (top + cardHeight > innerHeight - 14) top = rect.top - cardHeight - gap;
    if (top < 14) {
      left = rect.left + rect.width + gap;
      top = Math.min(Math.max(14, rect.top), innerHeight - cardHeight - 14);
      if (left + cardWidth > innerWidth - 14) left = Math.max(14, rect.left - cardWidth - gap);
    }
    card.style.left = Math.max(14, left) + 'px';
    card.style.top = Math.max(14, top) + 'px';
  }

  function go(nextIndex) {
    if (!running) return;
    stepIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
    const token = ++renderToken;
    const step = steps[stepIndex];
    setMobileDrawer(Boolean(step.mobileDrawer));
    window.setTimeout(function () {
      if (!running || token !== renderToken) return;
      currentTarget = firstVisible(onMobile() && step.mobileSelectors ? step.mobileSelectors : step.selectors);
      if (currentTarget) currentTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      card.querySelector('#ica-tour-title').textContent = step.title;
      card.querySelector('#ica-tour-text').textContent = step.text;
      card.querySelector('[data-tour-count]').textContent = (stepIndex + 1) + ' de ' + steps.length;
      card.querySelector('.ica-tour-track span').style.width = (((stepIndex + 1) / steps.length) * 100) + '%';
      card.querySelector('[data-tour-action="prev"]').hidden = stepIndex === 0;
      card.querySelector('[data-tour-action="next"]').textContent = stepIndex === steps.length - 1 ? 'Finalizar' : 'Siguiente';
      window.setTimeout(place, 40);
    }, onMobile() ? 190 : 20);
  }

  function focusable() {
    return Array.from(card.querySelectorAll('button:not([hidden]):not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(isVisible);
  }

  function onKeydown(event) {
    if (!running) return;
    if (event.key === 'Escape') {
      event.preventDefault(); stop(true); return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusable();
    if (!nodes.length) return;
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function start(options) {
    options = options || {};
    if (running || (!options.force && wasSeen())) return;
    if (typeof window.navigateToSection === 'function') window.navigateToSection('inicio');
    previousFocus = document.activeElement;
    running = true;
    root.hidden = false;
    document.documentElement.classList.add('ica-tour-active');
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    go(0);
    window.setTimeout(function () { card?.focus(); }, 80);
  }

  function stop(remember) {
    if (!running) return;
    running = false; renderToken += 1;
    if (remember) markSeen();
    setMobileDrawer(false);
    root.hidden = true;
    document.documentElement.classList.remove('ica-tour-active');
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    currentTarget = null;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  function installEntryPoints() {
    const topbar = document.querySelector('.topbar__right');
    if (topbar && !document.getElementById('icadem-tour-help')) {
      const button = document.createElement('button');
      button.id = 'icadem-tour-help';
      button.className = 'icon-btn ica-tour-help';
      button.type = 'button'; button.textContent = '?';
      button.title = 'Recorrido por ICADEM';
      button.setAttribute('aria-label', 'Repetir recorrido guiado');
      button.addEventListener('click', function () { start({ force: true }); });
      topbar.insertBefore(button, topbar.firstChild);
    }
    const profile = document.querySelector('.perfil-hero');
    if (profile && !document.getElementById('icadem-tour-profile')) {
      const button = document.createElement('button');
      button.id = 'icadem-tour-profile';
      button.className = 'btn btn--ghost ica-tour-profile-btn';
      button.type = 'button'; button.textContent = 'Repetir recorrido';
      button.addEventListener('click', function () { start({ force: true }); });
      profile.appendChild(button);
    }
  }

  function userReady() {
    const state = window.UserState;
    return Boolean(state && state.modo && state.modo !== 'cargando' && identity());
  }

  function blockingDialogOpen() {
    return Boolean(document.querySelector(
      '#splash-bienvenida,.modal-backdrop.is-open,.paywall-modal.is-open,#icadem-install-pop.show:not([hidden]),#tpl-modal-overlay.tpl-modal-visible'
    ));
  }

  function autoStart() {
    installEntryPoints();
    if (!userReady()) {
      window.setTimeout(autoStart, 250);
      return;
    }
    if (wasSeen()) return;
    if (blockingDialogOpen()) {
      window.setTimeout(autoStart, 250);
      return;
    }
    start();
  }

  function init() {
    addStyles(); createRoot(); installEntryPoints();
    const dynamic = document.getElementById('dynamic-section');
    if (dynamic) new MutationObserver(installEntryPoints).observe(dynamic, { childList: true, subtree: true });
    window.IcademGuidedTour = { start: function () { start({ force: true }); }, stop: stop };
    window.setTimeout(autoStart, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
