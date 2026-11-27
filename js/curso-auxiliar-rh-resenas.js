const carousel = document.querySelector('[data-rh-reviews]');
const track = carousel.querySelector('.rh-review-track');
const cards = [...track.querySelectorAll('.rh-review-card')];
const indicators = carousel.querySelector('[data-review-indicators]');
const marks = [...indicators.querySelectorAll('[data-review-indicator]')];
const status = carousel.querySelector('[data-review-status]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reviewDelay = 6000;
let visible = !('IntersectionObserver' in window);
let hovered = false;
let activePointer = null;
let timer;
let scrollFrame;

function currentIndex() {
  const position = track.scrollLeft + cards[0].offsetLeft;
  return cards.reduce((closest, card, index) => {
    const distance = Math.abs(position - card.offsetLeft);
    return distance < Math.abs(position - cards[closest].offsetLeft) ? index : closest;
  }, 0);
}

function move(direction, announce = false) {
  const target = (currentIndex() + direction + cards.length) % cards.length;
  track.scrollTo({
    left: cards[target].offsetLeft - cards[0].offsetLeft,
    behavior: reducedMotion.matches ? 'instant' : 'smooth'
  });
  if (announce) status.textContent = `Reseña ${target + 1} de ${cards.length}`;
}

function schedule() {
  clearTimeout(timer);
  if (!visible || hovered || activePointer !== null || document.hidden || reducedMotion.matches || carousel.matches(':focus-within')) return;
  timer = setTimeout(() => {
    move(1);
    schedule();
  }, reviewDelay);
}

track.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    const current = currentIndex();
    marks.forEach((mark, index) => mark.toggleAttribute('data-current', current === index));
    schedule();
  });
}, { passive: true });

track.addEventListener('keydown', event => {
  if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
  const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction, true);
});
track.addEventListener('pointerdown', event => {
  activePointer = event.pointerId;
  schedule();
}, { passive: true });

function finishGesture(event) {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  schedule();
}

window.addEventListener('pointerup', finishGesture, { passive: true });
window.addEventListener('pointercancel', finishGesture, { passive: true });
carousel.addEventListener('focusin', schedule);
carousel.addEventListener('focusout', () => queueMicrotask(schedule));
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
reducedMotion.addEventListener('change', schedule);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.intersectionRatio >= .35;
    schedule();
  }, { threshold: .35 });
  observer.observe(carousel);
}

indicators.hidden = false;
schedule();
