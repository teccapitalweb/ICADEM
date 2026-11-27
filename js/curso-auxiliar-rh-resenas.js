const carousel = document.querySelector('[data-rh-reviews]');
const track = carousel.querySelector('.rh-review-track');
const cards = [...track.querySelectorAll('.rh-review-card')];
const indicators = carousel.querySelector('[data-review-indicators]');
const marks = [...indicators.querySelectorAll('[data-review-indicator]')];
const status = carousel.querySelector('[data-review-status]');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const pointers = new Set();
const touches = new Set();
const pixelsPerSecond = 36;

let visible = !('IntersectionObserver' in window);
let first = 0;
let cycle = 0;
let starts = [];
let position = 0;
let current = -1;
let frame;
let lastTime;
let scrollTimer;

function copyCards() {
  return cards.map(card => {
    const copy = card.cloneNode(true);
    copy.dataset.reviewCopy = '';
    copy.setAttribute('aria-hidden', 'true');
    for (const link of copy.querySelectorAll('a')) {
      link.tabIndex = -1;
      link.addEventListener('mousedown', event => event.preventDefault());
    }
    return copy;
  });
}

const after = copyCards();
track.prepend(...copyCards());
track.append(...after);
track.classList.add('is-looping');

function wrap(left) {
  const offset = left - first;
  return first + ((offset % cycle + cycle) % cycle);
}

function activeReview(left) {
  if (!cycle) return 0;
  const distance = wrap(left);
  let nearest = Math.min(distance - first, first + cycle - distance);
  let selected = 0;
  for (let index = 1; index < starts.length; index++) {
    const gap = Math.abs(distance - starts[index]);
    if (gap < nearest) {
      nearest = gap;
      selected = index;
    }
  }
  return selected;
}

function updateIndicator(left) {
  const index = activeReview(left);
  if (index === current) return;
  current = index;
  marks.forEach((mark, i) => mark.toggleAttribute('data-current', i === current));
}

function animate(time) {
  const elapsed = lastTime === undefined ? 0 : Math.min(time - lastTime, 48);
  lastTime = time;
  position = wrap(position + elapsed * pixelsPerSecond / 1000);
  track.scrollLeft = position;
  updateIndicator(position);
  frame = requestAnimationFrame(animate);
}

function updatePlayback() {
  const canPlay = visible && cycle > 0 && !document.hidden && !motion.matches &&
    !pointers.size && !touches.size && scrollTimer === undefined && !carousel.querySelector(':focus-visible');
  if (!canPlay) {
    cancelAnimationFrame(frame);
    frame = undefined;
    return;
  }
  if (frame === undefined) {
    position = track.scrollLeft;
    lastTime = undefined;
    frame = requestAnimationFrame(animate);
  }
}

function measure() {
  const progress = cycle ? (wrap(track.scrollLeft) - first) / cycle : 0;
  const inset = track.firstElementChild.offsetLeft;
  starts = cards.map(card => card.offsetLeft - inset);
  first = starts[0];
  cycle = after[0].offsetLeft - cards[0].offsetLeft;
  position = first + cycle * progress;
  track.scrollLeft = position;
  updateIndicator(position);
  updatePlayback();
}

function waitForScroll() {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    scrollTimer = undefined;
    updatePlayback();
  }, 180);
  updatePlayback();
}

track.addEventListener('keydown', event => {
  if (event.target !== track || !cycle || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  updatePlayback();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const index = (activeReview(track.scrollLeft) + direction + cards.length) % cards.length;
  track.scrollLeft = starts[index];
  updateIndicator(starts[index]);
  status.textContent = 'Reseña ' + (index + 1) + ' de ' + cards.length;
});

track.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') return;
  pointers.add(event.pointerId);
  updatePlayback();
}, { passive: true });
for (const name of ['pointerup', 'pointercancel']) {
  window.addEventListener(name, event => {
    if (pointers.delete(event.pointerId)) waitForScroll();
  }, { passive: true });
}

// Touch events keep the loop paused while native scrolling takes over the gesture.
track.addEventListener('touchstart', event => {
  for (const touch of event.changedTouches) touches.add(touch.identifier);
  updatePlayback();
}, { passive: true });
for (const name of ['touchend', 'touchcancel']) {
  track.addEventListener(name, event => {
    for (const touch of event.changedTouches) touches.delete(touch.identifier);
    waitForScroll();
  }, { passive: true });
}
track.addEventListener('wheel', event => {
  if (event.deltaX || event.shiftKey) waitForScroll();
}, { passive: true });
track.addEventListener('scroll', () => {
  if (frame === undefined) updateIndicator(track.scrollLeft);
  if (scrollTimer !== undefined) waitForScroll();
}, { passive: true });

carousel.addEventListener('focusin', updatePlayback);
carousel.addEventListener('focusout', () => queueMicrotask(updatePlayback));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pointers.clear();
    touches.clear();
  }
  updatePlayback();
});
window.addEventListener('blur', () => {
  pointers.clear();
  touches.clear();
  updatePlayback();
});
if (motion.addEventListener) motion.addEventListener('change', updatePlayback);
else motion.addListener(updatePlayback);

indicators.hidden = false;
measure();
if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
else window.addEventListener('resize', measure);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }).observe(track);
}
