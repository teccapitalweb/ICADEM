/* Presentation only: account access, demo countdown and checkout stay in the panel. */
(() => {
  'use strict';
  let mode, timer, index = 0, paused = false, slides = [], generation = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const byId = id => document.getElementById(id);
  const stop = () => { window.clearInterval(timer); timer = null; };

  async function paint(animate = false) {
    const text = byId('fomo-banner-text');
    if (!text || !slides.length) return;
    const frame = ++generation;
    text.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    if (animate && !motion.matches && !paused) {
      try {
        await text.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-5px)' }],
          { duration: 180, easing: 'ease-in' }).finished;
      } catch (_) { return; }
      if (frame !== generation) return;
    }
    const title = document.createElement('strong');
    title.append(slides[index][0] + ' ');
    const accent = document.createElement('em');
    accent.textContent = slides[index][1];
    title.append(accent);
    const detail = document.createElement('span');
    detail.textContent = slides[index][2];
    text.replaceChildren(title, detail);
    byId('fomo-banner-dots')?.querySelectorAll('i').forEach((dot, n) => {
      dot.classList.toggle('is-current', n === index);
    });
    if (animate && !motion.matches && !paused) {
      [title, detail].forEach((element, i) => element.animate([
        { opacity: 0, transform: 'translateY(8px)', filter: 'blur(2px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }
      ], { duration: 650, delay: i * 75, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' }));
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
        [originalTitle, '', originalDetail],
        ['Tu próxima meta,', 'más cerca.', 'Explora cursos y encuentra tu siguiente paso.'],
        ['Conocimiento que', 'te impulsa.', 'Descubre tu espacio de formación profesional.']
      ] : [
        ['Empieza con hasta', '4 clases gratis.', 'Descubre lo que puedes lograr con ICADEM.'],
        ['Lo que aprendes hoy,', 'te impulsa mañana.', 'Formación práctica para tu siguiente reto.'],
        ['Tu talento merece', 'el siguiente nivel.', 'Activa VIP y continúa tu formación profesional.']
      ];
      byId('fomo-banner-label').textContent = demo ? 'EXPLORA ICADEM' : 'TU SIGUIENTE NIVEL';
      const control = byId('fomo-banner-motion');
      if (control) control.onclick = () => { paused = !paused; if (paused) paint(); schedule(); };
      paint();
      schedule();
    }
  };
  motion.addEventListener('change', () => { if (motion.matches) { index = 0; paint(); } schedule(); });
  document.addEventListener('visibilitychange', schedule);
})();
