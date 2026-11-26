const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tabList = document.querySelector('.content-tabs');
const tabs = [...tabList.querySelectorAll('[role="tab"]')];
const programTab = document.querySelector('#tab-temario');

function showTab(tab, { focus = false, instant = false } = {}) {
  for (const other of tabs) {
    const active = other === tab;
    other.tabIndex = active ? 0 : -1;
    other.setAttribute('aria-selected', active);
    document.getElementById(other.getAttribute('aria-controls')).hidden = !active;
  }
  if (focus) tab.focus({ preventScroll: true });
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  if (left < tabList.scrollLeft || right > tabList.scrollLeft + tabList.clientWidth) {
    tabList.scrollTo({
      left: left + (tab.offsetWidth - tabList.clientWidth) / 2,
      behavior: instant || reducedMotion.matches ? 'instant' : 'smooth',
    });
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => showTab(tab));
  tab.addEventListener('keydown', event => {
    const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    showTab(tabs[next], { focus: true });
  });
}

function showLinkedProgram() {
  if (location.hash === '#temario') showTab(programTab, { instant: true });
}
window.addEventListener('hashchange', showLinkedProgram);
document.querySelector('[data-open-content="temario"]').addEventListener('click', () => showTab(programTab, { instant: true }));
showLinkedProgram();

const figures = [...document.querySelectorAll('[data-count]')].map(element => ({
  element,
  value: Number(element.dataset.count),
  prefix: element.dataset.prefix || '',
}));

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  for (const { element, prefix } of figures) element.textContent = prefix + '0';
  const counterObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    counterObserver.disconnect();
    const started = performance.now();
    const animate = now => {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (now - started) / 1150);
      const eased = 1 - (1 - progress) ** 3;
      for (const { element, value, prefix } of figures) element.textContent = prefix + Math.floor(value * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, { threshold: 0.25 });
  counterObserver.observe(document.querySelector('.course-facts'));
}

const carousel = document.querySelector('.review-carousel');
const track = carousel.querySelector('.review-track');
const cards = [...track.children];
const controls = carousel.querySelector('.review-controls');
const dots = [...controls.querySelectorAll('[data-review-dot]')];
const autoplay = controls.querySelector('[data-review-autoplay]');
const reviewStatus = controls.querySelector('[data-review-status]');
let index = 0;
let visible = false;
let playing = !reducedMotion.matches;
let timer;
let scrollTimer;
controls.hidden = false;

function showReview(next, announce = false) {
  index = (next + cards.length) % cards.length;
  track.scrollTo({ left: index * track.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  for (const [position, dot] of dots.entries()) dot.classList.toggle('is-current', position === index);
  if (announce) reviewStatus.textContent = 'Opinión ' + (index + 1) + ' de ' + cards.length;
}

function updatePlayback() {
  clearTimeout(timer);
  autoplay.hidden = reducedMotion.matches;
  autoplay.textContent = playing ? 'Pausar' : 'Reproducir';
  autoplay.setAttribute('aria-label', playing ? 'Pausar reproducción automática' : 'Activar reproducción automática');
  if (visible && playing && !document.hidden && !carousel.matches(':hover, :focus-within')) {
    timer = setTimeout(() => {
      showReview(index + 1);
      updatePlayback();
    }, 6500);
  }
}

for (const [selector, direction] of [['[data-review-prev]', -1], ['[data-review-next]', 1]]) {
  controls.querySelector(selector).addEventListener('click', () => showReview(index + direction, true));
}
autoplay.addEventListener('click', () => {
  playing = !playing;
  updatePlayback();
});
track.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (!track.clientWidth) return;
    index = Math.min(cards.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)));
    for (const [position, dot] of dots.entries()) dot.classList.toggle('is-current', position === index);
  }, 140);
}, { passive: true });
for (const event of ['mouseenter', 'mouseleave', 'focusin', 'focusout']) {
  carousel.addEventListener(event, () => requestAnimationFrame(updatePlayback));
}
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', () => {
  playing = !reducedMotion.matches;
  updatePlayback();
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }, { threshold: 0.35 }).observe(carousel);
}
updatePlayback();
