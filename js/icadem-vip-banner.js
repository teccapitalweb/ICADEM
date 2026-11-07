/* Presentation only: account access, demo countdown and checkout stay in the panel. */
(() => {
  'use strict';
  let mode, timer, index = 0, paused = false, slides = [];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const byId = id => document.getElementById(id);
  const stop = () => { window.clearInterval(timer); timer = null; };

  function paint(animate = false) {
    const text = byId('fomo-banner-text');
    if (!text || !slides.length) return;
    const title = document.createElement('strong');
    title.textContent = slides[index][0];
    const detail = document.createElement('span');
    detail.textContent = slides[index][1];
    text.replaceChildren(title, detail);
    byId('fomo-banner-dots')?.querySelectorAll('i').forEach((dot, n) => {
      dot.classList.toggle('is-current', n === index);
    });
    if (animate && !motion.matches) {
      text.getAnimations().forEach(animation => animation.cancel());
      text.animate([
        { opacity: 0, transform: 'translateY(7px)', filter: 'blur(2px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
      ], { duration: 550, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  }

  function schedule() {
    stop();
    const banner = byId('fomo-banner');
    const still = paused || motion.matches || document.hidden;
    banner?.classList.toggle('vip-ribbon--still', still);
    const control = byId('fomo-banner-motion');
    if (control) {
      control.hidden = motion.matches;
      control.setAttribute('aria-label', paused ? 'Reanudar animación y mensajes' : 'Pausar animación y mensajes');
      control.setAttribute('aria-pressed', String(paused));
      control.classList.toggle('is-paused', paused);
    }
    if (!still && mode && mode !== 'vip') {
      timer = window.setInterval(() => {
        index = (index + 1) % slides.length;
        paint(true);
      }, 7000);
    }
  }

  window.IcademVipBanner = {
    update(nextMode) {
      const banner = byId('fomo-banner');
      const text = byId('fomo-banner-text');
      if (!banner || !text) return;
      if (nextMode === 'vip') { mode = nextMode; stop(); return; }
      if (mode === nextMode) { paint(); return; }
      mode = nextMode;
      index = 0;
      const demo = mode === 'invitado';
      const originalTitle = text.querySelector('strong')?.textContent || 'Conoce ICADEM VIP';
      const originalDetail = text.textContent.replace(originalTitle, '').replace(/^\s*·\s*/, '').trim();
      slides = demo ? [
        [originalTitle, originalDetail],
        ['Tu próxima meta empieza aquí.', 'Explora cursos, recursos y nuevas posibilidades.'],
        ['Conoce tu espacio para crecer.', 'Descubre la experiencia ICADEM VIP.']
      ] : [
        ['Prueba hasta 4 clases gratis.', 'Da el siguiente paso con ICADEM VIP.'],
        ['Aprende hoy. Aplica mañana.', 'Encuentra tu próximo curso y sigue creciendo.'],
        ['Dale impulso a tu talento.', 'Activa tu membresía y continúa tu formación.']
      ];
      byId('fomo-banner-label').textContent = demo ? 'EXPLORA ICADEM' : 'TU SIGUIENTE NIVEL';
      const control = byId('fomo-banner-motion');
      if (control) control.onclick = () => { paused = !paused; schedule(); };
      paint();
      schedule();
    }
  };
  motion.addEventListener('change', () => { if (motion.matches) { index = 0; paint(); } schedule(); });
  document.addEventListener('visibilitychange', schedule);
})();
