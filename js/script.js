const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
const year = document.getElementById('year');
const counters = document.querySelectorAll('[data-count]');
const parallaxItems = document.querySelectorAll('.parallax');
const filterButtons = document.querySelectorAll('.filter-chip');
const courseCards = document.querySelectorAll('.course-card[data-category]');

if (year) year.textContent = new Date().getFullYear();

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.16 });

document.querySelectorAll('.reveal, .reveal-delay').forEach((item) => revealObserver.observe(item));

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    const element = entry.target;
    const target = Number(element.dataset.count || 0);
    const duration = 1300;
    const startTime = performance.now();

    function updateCount(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.floor(eased * target);
      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        element.textContent = `${target}+`;
      }
    }

    requestAnimationFrame(updateCount);
    counterObserver.unobserve(element);
  });
}, { threshold: 0.45 });

counters.forEach((counter) => counterObserver.observe(counter));

window.addEventListener('scroll', () => {
  const offset = window.scrollY;
  parallaxItems.forEach((item) => {
    const speed = Number(item.dataset.speed || 0.1);
    item.style.transform = `translateY(${offset * speed}px)`;
  });
}, { passive: true });

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });

    button.classList.add('active');
    button.setAttribute('aria-selected', 'true');

    courseCards.forEach((card) => {
      const category = card.dataset.category;
      const matches = filter === 'all' || category === filter;
      card.classList.toggle('is-hidden', !matches);
    });
  });
});

function sendToWhatsApp(event) {
  event.preventDefault();

  const name = document.getElementById('name').value.trim();
  const service = document.getElementById('service').value.trim();
  const message = document.getElementById('message').value.trim();

  const text = `Hola ICADEM, mi nombre es ${name}. Me interesa: ${service}. Mensaje: ${message}`;
  const url = `https://wa.me/522383738143?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

window.sendToWhatsApp = sendToWhatsApp;
