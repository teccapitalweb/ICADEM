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

document.querySelector('[data-open-content="temario"]').addEventListener('click', () => showTab(programTab, { instant: true }));
if (location.hash === '#temario') showTab(programTab, { instant: true });

const figures = [...document.querySelectorAll('[data-count]')].map(element => {
  const decimals = Number(element.dataset.decimals || 0);
  const formatter = new Intl.NumberFormat('es-MX', {
    useGrouping: 'always', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
  const output = element.querySelector('[data-count-value]') || element;
  const units = 10 ** decimals;
  const target = Math.round(Number(element.dataset.count) * units);
  const prefix = element.dataset.prefix || '';
  return { target, write: value => { output.textContent = prefix + formatter.format(value / units); } };
});

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  for (const figure of figures) figure.write(0);
  const counterObserver = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio < .18) return;
    counterObserver.disconnect();
    const started = performance.now();
    const animate = now => {
      let finished = true;
      for (const [index, figure] of figures.entries()) {
        const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (now - started - index * 85) / 1450));
        figure.write(Math.floor(figure.target * (1 - (1 - progress) ** 3)));
        if (progress < 1) finished = false;
      }
      if (!finished) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, { threshold: .18 });
  counterObserver.observe(document.querySelector('.course-facts'));
}

const certificate = document.querySelector('#certificado');
document.querySelector('[data-certificate-open]').addEventListener('click', () => certificate.showModal());

const carousel = document.querySelector('.review-carousel');
const track = carousel.querySelector('.review-track');
const cards = [...track.children];
const reviewStatus = carousel.querySelector('[data-review-status]');
const pressedPointers = new Set();
const activeTouches = new Set();
let first = 0;
let cycle = 0;
let step = 0;
let position = 0;
let visible = !('IntersectionObserver' in window);
let mouseOverTrack = false;
let frame;
let previousTime;
let scrollTimer;

function copyReviews() {
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

const following = copyReviews();
track.prepend(...copyReviews());
track.append(...following);
track.classList.add('is-looping');

function normalize(left) {
  const offset = left - first;
  return first + ((offset % cycle + cycle) % cycle);
}

function measureTrack() {
  const progress = cycle ? (normalize(track.scrollLeft) - first) / cycle : 0;
  first = cards[0].offsetLeft;
  cycle = following[0].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
  step = cycle / cards.length;
  position = first + progress * cycle;
  track.scrollLeft = position;
  updatePlayback();
}

function move(now) {
  const elapsed = previousTime === undefined ? 0 : Math.min(now - previousTime, 48);
  previousTime = now;
  position = normalize(position + elapsed * 36 / 1000);
  track.scrollLeft = position;
  frame = requestAnimationFrame(move);
}

function updatePlayback() {
  const canPlay = visible && cycle > 0 && !reducedMotion.matches && !document.hidden && !mouseOverTrack &&
    !pressedPointers.size && !activeTouches.size && scrollTimer === undefined && !carousel.querySelector(':focus-visible');
  if (!canPlay) {
    cancelAnimationFrame(frame);
    frame = undefined;
  } else if (frame === undefined) {
    position = track.scrollLeft;
    previousTime = undefined;
    frame = requestAnimationFrame(move);
  }
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
  updatePlayback();
  if (!step || event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const review = Math.round((track.scrollLeft - first) / step) + direction;
  const index = (review % cards.length + cards.length) % cards.length;
  track.scrollLeft = first + index * step;
  reviewStatus.textContent = `Opinión ${index + 1} de ${cards.length}`;
});

for (const event of ['pointerenter', 'pointerleave']) {
  track.addEventListener(event, pointer => {
    if (pointer.pointerType !== 'mouse') return;
    mouseOverTrack = event === 'pointerenter';
    updatePlayback();
  });
}
track.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') return;
  pressedPointers.add(event.pointerId);
  updatePlayback();
});
for (const event of ['pointerup', 'pointercancel']) {
  window.addEventListener(event, pointer => {
    if (pressedPointers.delete(pointer.pointerId)) waitForScroll();
  });
}

// Touch pointer events can be canceled as native scrolling takes over a drag.
track.addEventListener('touchstart', event => {
  for (const touch of event.changedTouches) activeTouches.add(touch.identifier);
  updatePlayback();
}, { passive: true });
for (const event of ['touchend', 'touchcancel']) {
  track.addEventListener(event, touchEvent => {
    for (const touch of touchEvent.changedTouches) activeTouches.delete(touch.identifier);
    waitForScroll();
  }, { passive: true });
}
track.addEventListener('wheel', event => {
  if (event.shiftKey || event.deltaX) waitForScroll();
}, { passive: true });
track.addEventListener('scroll', () => {
  if (scrollTimer !== undefined) waitForScroll();
}, { passive: true });

carousel.addEventListener('focusin', updatePlayback);
carousel.addEventListener('focusout', () => queueMicrotask(updatePlayback));
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', updatePlayback);
measureTrack();
if ('ResizeObserver' in window) new ResizeObserver(measureTrack).observe(track);
else window.addEventListener('resize', measureTrack);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }, { threshold: 0.12 }).observe(track);
}
