/* Inicio: presentation and navigation only. Existing widgets keep their DOM and listeners. */
(() => {
  'use strict';
  function mount() {
    const home = document.getElementById('inicio-content');
    const aside = document.querySelector('.app > .aside');
    if (!home || !aside) return;
    const destinations = [
      ['.widget--next', 'home-live-slot'],
      ['.widget--wa', 'home-community-slot'],
      ['.widget--disc', 'home-benefits-slot'],
      ['.widget--cert', 'home-directory-slot'],
      ['#act-cursos-count', 'home-activity-slot']
    ];
    const widgets = destinations.map(([selector, target]) => {
      const found = aside.querySelector(selector);
      const node = found?.closest('.widget');
      const slot = document.getElementById(target);
      if (!node || !slot) return null;
      const anchor = document.createComment('home-widget-original-position');
      node.before(anchor);
      return { node, slot, anchor };
    }).filter(Boolean);

    function setSection(section) {
      const active = section === 'inicio';
      document.body.classList.toggle('icadem-home-active', active);
      widgets.forEach(({ node, slot, anchor }) => {
        if (active) slot.append(node);
        else anchor.after(node);
      });
    }
    window.addEventListener('icadem:navigation', event => setSection(event.detail?.section));
    const initial = location.hash.slice(1) || new URLSearchParams(location.search).get('seccion') || 'inicio';
    setSection(initial);
    // The guest path skips authenticated hydration; use the existing public/demo loaders.
    if (window.__isDemoMode && initial === 'inicio') window.__actualizarWidgetsActividad?.();
    home.addEventListener('click', event => {
      const action = event.target.closest('[data-home-go]');
      if (action && home.contains(action)) window.navigateToSection?.(action.dataset.homeGo);
    });
    // Reveal each block once. Content stays visible if observers or motion are unavailable.
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reveal = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          target.classList.add('home-reveal');
          target.addEventListener('animationend', () => target.classList.remove('home-reveal'), { once:true });
          reveal.unobserve(target);
        });
      }, { threshold:0.12 });
      home.querySelectorAll('.home-feature-grid, .home-path, .home-personal, .home-news').forEach(node => reveal.observe(node));
    }
    const date = document.getElementById('home-today');
    if (date) {
      const now = new Date();
      date.textContent = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric'
      }).format(now);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
})();
