const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}
const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.18 });
revealItems.forEach(item => revealObserver.observe(item));
const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    const suffix = target === 100 ? '%' : '+';
    const duration = 1400;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(counter => counterObserver.observe(counter));
document.querySelectorAll('.filter-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('is-active'));
    button.classList.add('is-active');
    const filter = button.dataset.filter;
    document.querySelectorAll('.course-card').forEach(card => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden-course', !show);
    });
  });
});
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox?.querySelector('img');
const closeBtn = lightbox?.querySelector('.lightbox-close');
document.querySelectorAll('[data-image]').forEach(item => {
  item.addEventListener('click', () => {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = item.dataset.image;
    lightbox.showModal();
  });
});
closeBtn?.addEventListener('click', () => lightbox.close());
lightbox?.addEventListener('click', (event) => {
  const rect = lightbox.getBoundingClientRect();
  const clickedInDialog = rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
  if (!clickedInDialog) lightbox.close();
});
const heroMedia = document.querySelector('.parallax-media img');
window.addEventListener('scroll', () => {
  if (!heroMedia || window.innerWidth < 900) return;
  const offset = window.scrollY * 0.08;
  heroMedia.style.transform = `translateY(${offset}px) scale(1.06)`;
}, { passive: true });
const form = document.getElementById('contact-form');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const nombre = document.getElementById('nombre').value.trim();
  const medio = document.getElementById('medio').value.trim();
  const servicio = document.getElementById('servicio').value.trim();
  const mensaje = document.getElementById('mensaje').value.trim();
  const text = `Hola ICADEM, quiero información.%0A%0ANombre: ${encodeURIComponent(nombre)}%0AMedio de contacto: ${encodeURIComponent(medio)}%0AServicio de interés: ${encodeURIComponent(servicio)}%0AMensaje: ${encodeURIComponent(mensaje)}`;
  window.open(`https://wa.me/522383738143?text=${text}`, '_blank', 'noopener');
});
document.getElementById('year').textContent = new Date().getFullYear();
