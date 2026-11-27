const carousel = document.querySelector('[data-rh-reviews]');
const track = carousel.querySelector('.rh-review-track');
const cards = [...track.querySelectorAll('.rh-review-card')];
const controls = carousel.querySelector('.rh-review-controls');
const rotation = controls.querySelector('[data-review-rotation]');
const status = carousel.querySelector('[data-review-status]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !reducedMotion.matches;
let visible = !('IntersectionObserver' in window);
let hovered = false;
let timeout;

function move(direction, announce = false) {
  const step = cards[1].offsetLeft - cards[0].offsetLeft;
  const current = Math.round(track.scrollLeft / step);
  const target = (current + direction + cards.length) % cards.length;
  track.scrollTo({
    left: cards[target].offsetLeft - cards[0].offsetLeft,
    behavior: reducedMotion.matches ? 'instant' : 'smooth'
  });
  if (announce) status.textContent = `Reseña ${target + 1} de ${cards.length}`;
}

function schedule() {
  clearTimeout(timeout);
  if (!playing || !visible || hovered || document.hidden) return;
  timeout = setTimeout(() => {
    move(1);
    schedule();
  }, 5500);
}

function setPlaying(value) {
  playing = value && !reducedMotion.matches;
  rotation.textContent = playing ? 'Pausar' : 'Reproducir';
  rotation.setAttribute('aria-label', playing ? 'Pausar carrusel' : 'Reproducir carrusel');
  schedule();
}

function navigate(direction) {
  setPlaying(false);
  move(direction, true);
}

rotation.addEventListener('click', () => setPlaying(!playing));
controls.querySelectorAll('[data-review-direction]').forEach(button => {
  button.addEventListener('click', () => navigate(Number(button.dataset.reviewDirection)));
});
track.addEventListener('keydown', event => {
  if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  navigate(event.key === 'ArrowLeft' ? -1 : 1);
});
track.addEventListener('pointerdown', () => setPlaying(false), { passive: true });
track.addEventListener('wheel', event => {
  if (event.deltaX || event.shiftKey) setPlaying(false);
}, { passive: true });
carousel.addEventListener('focusin', event => {
  if (event.target !== rotation || event.target.matches(':focus-visible')) setPlaying(false);
});
carousel.addEventListener('pointerenter', event => {
  if (event.pointerType !== 'mouse') return;
  hovered = true;
  schedule();
});
carousel.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'mouse') return;
  hovered = false;
  schedule();
});
document.addEventListener('visibilitychange', schedule);
reducedMotion.addEventListener('change', () => {
  rotation.hidden = reducedMotion.matches;
  if (reducedMotion.matches) setPlaying(false);
});
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= .25;
    schedule();
  }, { threshold: .25 });
  observer.observe(carousel);
}
rotation.hidden = reducedMotion.matches;
controls.hidden = false;
schedule();
