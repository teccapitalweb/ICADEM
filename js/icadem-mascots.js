/* ICADEM mascots: shared mapping and interaction helpers. */
(() => {
  'use strict';

  const BASE = 'assets/mascotas/retos/iconos/';
  const MAP = Object.freeze({
    veredicto: Object.freeze({ file: '01_veredicto_expres_criterio_juridico.png', motion: 'veredicto' }),
    criterio: Object.freeze({ file: '02_decide_con_criterio_desafio_aplicado.png', motion: 'criterio' }),
    memoria: Object.freeze({ file: '03_memoria_tecnica_repaso.png', motion: 'memoria' }),
    juegos: Object.freeze({ file: '04_juegos_icadem_arcade.png', motion: 'juegos' }),
    puzzle: Object.freeze({ file: '05_rompecabezas_profesional.png', motion: 'puzzle' }),
    hazard: Object.freeze({ file: '06_encuentra_la_irregularidad.png', motion: 'hazard' }),
    spot: Object.freeze({ file: '07_senala_en_la_escena.png', motion: 'spot' }),
    document: Object.freeze({ file: '08_revisa_el_documento.png', motion: 'document' }),
    calc: Object.freeze({ file: '09_calcula_y_comprueba.png', motion: 'calc' }),
    vmemory: Object.freeze({ file: '10_memorama_visual.png', motion: 'vmemory' }),
    order: Object.freeze({ file: '11_ordena_el_proceso.png', motion: 'order' })
  });

  function mascotMarkup(key, slotClass = '') {
    const mascot = MAP[key];
    if (!mascot) return '';
    const cleanClass = String(slotClass).replace(/[^a-z0-9_-]/gi, '');
    return `<span class="icadem-mascot icadem-mascot--${mascot.motion}${cleanClass ? ` ${cleanClass}` : ''}" data-icadem-mascot="${key}" aria-hidden="true"><span class="icadem-mascot__motion"><img class="icadem-mascot__image" src="${BASE}${mascot.file}" alt="" width="1254" height="1254" loading="lazy" decoding="async" fetchpriority="low" draggable="false"></span></span>`;
  }

  const reactionTimers = new WeakMap();
  function react(host) {
    const priorTimer = reactionTimers.get(host);
    if (priorTimer) window.clearTimeout(priorTimer);
    host.classList.remove('is-mascot-reacting');
    // Restart the short interaction animation on repeated taps without moving layout.
    void host.offsetWidth;
    host.classList.add('is-mascot-reacting');
    reactionTimers.set(host, window.setTimeout(() => {
      host.classList.remove('is-mascot-reacting');
      reactionTimers.delete(host);
    }, 760));
  }

  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const host = event.target.closest('.reto-card, .practice-card');
    if (host?.querySelector('[data-icadem-mascot]')) react(host);
  }, { passive: true });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const host = event.target.closest('.reto-card, .practice-card');
    if (host?.querySelector('[data-icadem-mascot]')) react(host);
  });

  window.ICADEMMascots = Object.freeze({ map: MAP, markup: mascotMarkup });
})();
