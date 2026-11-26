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
const controls = carousel.querySelector('.review-controls');
const dots = [...controls.querySelectorAll('[data-review-dot]')];
const autoplay = controls.querySelector('[data-review-autoplay]');
const reviewStatus = controls.querySelector('[data-review-status]');
let first = 0;
let cycle = 0;
let step = 0;
let active = -1;
let position = 0;
let visible = false;
let playing = !reducedMotion.matches;
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
controls.hidden = false;

function normalize(left) {
  const offset = left - first;
  return first + ((offset % cycle + cycle) % cycle);
}

function indicate(review) {
  const index = (review % cards.length + cards.length) % cards.length;
  if (active !== index) {
    active = index;
    for (const [candidate, dot] of dots.entries()) dot.classList.toggle('is-current', candidate === index);
  }
  return index;
}

function measureTrack() {
  const progress = cycle ? (normalize(track.scrollLeft) - first) / cycle : 0;
  first = cards[0].offsetLeft;
  cycle = following[0].offsetLeft - first;
  step = cycle / cards.length;
  position = first + progress * cycle;
  track.scrollLeft = position;
  if (step) indicate(Math.round((position - first) / step));
}

function move(now) {
  const elapsed = previousTime === undefined ? 0 : Math.min(now - previousTime, 48);
  previousTime = now;
  position = normalize(position + .046 * elapsed);
  track.scrollLeft = position;
  indicate(Math.round((position - first) / step));
  frame = requestAnimationFrame(move);
}

function updatePlayback() {
  autoplay.hidden = reducedMotion.matches;
  autoplay.textContent = playing ? 'Pausar' : 'Reproducir';
  autoplay.setAttribute('aria-label', playing ? 'Pausar reproducción automática' : 'Activar reproducción automática');
  const focusIsReading = carousel.matches(':focus-within') && document.activeElement !== autoplay;
  const canPlay = visible && cycle && playing && !document.hidden && !track.matches(':hover') && !focusIsReading;
  if (!canPlay) {
    cancelAnimationFrame(frame);
    frame = undefined;
  } else if (frame === undefined) {
    position = track.scrollLeft;
    previousTime = undefined;
    frame = requestAnimationFrame(move);
  }
}

function stopPlayback() {
  playing = false;
  updatePlayback();
}

function showReview(direction) {
  if (!step) return;
  stopPlayback();
  const review = Math.round((track.scrollLeft - first) / step) + direction;
  track.scrollTo({
    left: first + review * step,
    behavior: reducedMotion.matches ? 'instant' : 'smooth',
  });
  reviewStatus.textContent = 'Opinión ' + (indicate(review) + 1) + ' de ' + cards.length;
}

for (const [selector, direction] of [['[data-review-prev]', -1], ['[data-review-next]', 1]]) {
  controls.querySelector(selector).addEventListener('click', () => showReview(direction));
}
autoplay.addEventListener('click', () => {
  playing = !playing;
  updatePlayback();
  if (!playing && step) {
    const review = Math.round((track.scrollLeft - first) / step);
    track.scrollLeft = normalize(first + review * step);
    indicate(review);
  }
});
track.addEventListener('keydown', event => {
  if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  showReview(event.key === 'ArrowRight' ? 1 : -1);
});
track.addEventListener('pointerdown', stopPlayback);
track.addEventListener('wheel', event => {
  if (event.shiftKey || event.deltaX) stopPlayback();
}, { passive: true });
track.addEventListener('scroll', () => {
  if (frame !== undefined || !step) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (frame !== undefined) return;
    const left = track.scrollLeft;
    const normalized = normalize(left);
    if (Math.abs(left - normalized) > 1) track.scrollLeft = normalized;
    indicate(Math.round((normalized - first) / step));
  }, 130);
}, { passive: true });
for (const event of ['mouseenter', 'mouseleave']) {
  track.addEventListener(event, updatePlayback);
}
carousel.addEventListener('focusin', updatePlayback);
carousel.addEventListener('focusout', () => requestAnimationFrame(updatePlayback));
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', () => {
  playing = !reducedMotion.matches;
  updatePlayback();
});
measureTrack();
if ('ResizeObserver' in window) new ResizeObserver(measureTrack).observe(track);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }, { threshold: 0.12 }).observe(track);
}
updatePlayback();
