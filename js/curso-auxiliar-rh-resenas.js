const carousel = document.querySelector('[data-rh-reviews]');
const track = carousel.querySelector('.rh-review-track');
const cards = [...track.querySelectorAll('.rh-review-card')];
const indicators = carousel.querySelector('[data-review-indicators]');
const marks = [...indicators.querySelectorAll('[data-review-indicator]')];
const status = carousel.querySelector('[data-review-status]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const supportsFocusVisible = window.CSS && CSS.supports('selector(:focus-visible)');
const reviewDelay = 5000;
let visible = !('IntersectionObserver' in window);
let activePointer = null;
let timer;
let scrollFrame;
let slideFrame;

function currentIndex() {
  const position = track.scrollLeft + cards[0].offsetLeft;
  return cards.reduce((closest, card, index) => {
    const distance = Math.abs(position - card.offsetLeft);
    return distance < Math.abs(position - cards[closest].offsetLeft) ? index : closest;
  }, 0);
}

function finishSlide() {
  if (slideFrame === undefined) return;
  cancelAnimationFrame(slideFrame);
  slideFrame = undefined;
  track.style.removeProperty('scroll-snap-type');
}

function move(direction, announce = false) {
  finishSlide();
  const target = (currentIndex() + direction + cards.length) % cards.length;
  const start = track.scrollLeft;
  const end = cards[target].offsetLeft - cards[0].offsetLeft;
  if (announce) status.textContent = `Reseña ${target + 1} de ${cards.length}`;

  if (reducedMotion.matches) {
    track.scrollLeft = end;
    return;
  }

  // WebKit puede cancelar el desplazamiento programado si el ajuste por tarjeta sigue activo.
  track.style.scrollSnapType = 'none';
  const startTime = performance.now();
  const animate = now => {
    const progress = Math.min(1, (now - startTime) / 410);
    track.scrollLeft = start + (end - start) * (1 - (1 - progress) ** 3);
    if (progress < 1) {
      slideFrame = requestAnimationFrame(animate);
      return;
    }
    finishSlide();
    schedule();
  };
  slideFrame = requestAnimationFrame(animate);
}

function hasKeyboardFocus(element) {
  return element && carousel.contains(element) &&
    (!supportsFocusVisible || element.matches(':focus-visible'));
}

function canRotate() {
  return visible && activePointer === null && !document.hidden && !reducedMotion.matches &&
    !hasKeyboardFocus(document.activeElement);
}

function schedule() {
  clearTimeout(timer);
  if (!canRotate()) return;
  timer = setTimeout(() => {
    if (canRotate()) move(1);
  }, reviewDelay);
}

track.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    const current = currentIndex();
    marks.forEach((mark, index) => mark.toggleAttribute('data-current', current === index));
    if (slideFrame === undefined) schedule();
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
  finishSlide();
  schedule();
}, { passive: true });
track.addEventListener('wheel', event => {
  if (!event.deltaX && !event.shiftKey) return;
  finishSlide();
  schedule();
}, { passive: true });

function finishGesture(event) {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  schedule();
}

window.addEventListener('pointerup', finishGesture, { passive: true });
window.addEventListener('pointercancel', finishGesture, { passive: true });
carousel.addEventListener('focusin', event => {
  if (hasKeyboardFocus(event.target)) finishSlide();
  schedule();
});
carousel.addEventListener('focusout', () => queueMicrotask(schedule));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    activePointer = null;
    finishSlide();
  }
  schedule();
});

function updateMotionPreference() {
  if (reducedMotion.matches) finishSlide();
  schedule();
}

if (reducedMotion.addEventListener) {
  reducedMotion.addEventListener('change', updateMotionPreference);
} else {
  reducedMotion.addListener(updateMotionPreference);
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.intersectionRatio >= .2;
    schedule();
  }, { threshold: .2 });
  observer.observe(track);
}

indicators.hidden = false;
schedule();
