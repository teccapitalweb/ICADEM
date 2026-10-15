const toggle = document.querySelector('.menu-toggle') || document.querySelector('.nav-toggle');
const menu = document.querySelector('#main-nav') || document.querySelector('.nav-menu');

// Menú móvil: mientras está abierto la página de fondo queda quieta y se
// cierra al tocar fuera, al elegir una opción o con Esc.
if (toggle && menu) {
  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);
  const root = document.documentElement;
  const blockScroll = event => {
    if (!menu.classList.contains('open')) return;
    if (!menu.contains(event.target)) event.preventDefault();
  };

  function setMenu(open) {
    menu.classList.toggle('open', open);
    backdrop.classList.toggle('is-visible', open);
    root.classList.toggle('nav-locked', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  backdrop.addEventListener('click', () => setMenu(false));
  document.addEventListener('click', event => {
    if (menu.classList.contains('open') && !menu.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); } });
  // iOS ignora a veces overflow:hidden; se bloquea el arrastre fuera del menú.
  document.addEventListener('touchmove', blockScroll, { passive: false });
  document.addEventListener('wheel', blockScroll, { passive: false });
  window.addEventListener('resize', () => { if (window.innerWidth > 780 && menu.classList.contains('open')) setMenu(false); });

  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const value = btn.dataset.filter;
    document.querySelectorAll('.course-card[data-category]').forEach(card => {
      card.style.display = (value === 'all' || card.dataset.category === value) ? '' : 'none';
    });
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
