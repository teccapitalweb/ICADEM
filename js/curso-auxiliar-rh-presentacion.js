const details = document.querySelector('#conoce-el-curso');
const tabList = details.querySelector('[data-course-tabs]');
const tabs = [...tabList.querySelectorAll('[role="tab"]')];
const panels = new Map(tabs.map(tab => {
  const id = tab.getAttribute('aria-controls');
  return [tab, document.getElementById(id)];
}));

function selectTab(tab, focus = false) {
  for (const [button, panel] of panels) {
    const active = button === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
  }
  if (focus) tab.focus({ preventScroll: true });
  const start = tab.offsetLeft;
  const end = start + tab.offsetWidth;
  if (start < tabList.scrollLeft) tabList.scrollLeft = start;
  else if (end > tabList.scrollLeft + tabList.clientWidth) tabList.scrollLeft = end - tabList.clientWidth;
}

function tabFromHash(hash) {
  return tabs.find(tab => '#' + panels.get(tab).id === hash);
}

tabList.hidden = false;
const initialTab = tabFromHash(location.hash);
selectTab(initialTab || tabs[0]);
if (initialTab) requestAnimationFrame(() => details.scrollIntoView({ behavior: 'instant' }));

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const next = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next], true);
  });
}

for (const link of document.querySelectorAll('a[href^="#"]')) {
  const tab = tabFromHash(link.hash);
  if (!tab) continue;
  link.addEventListener('click', event => {
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    selectTab(tab, true);
    details.scrollIntoView({ block: 'start' });
  });
}

window.addEventListener('hashchange', () => {
  const tab = tabFromHash(location.hash);
  if (!tab) return;
  selectTab(tab);
  details.scrollIntoView({ block: 'start' });
});

const metrics = document.querySelector('.course-metrics');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const values = [...metrics.querySelectorAll('[data-count]')].map(element => {
    const decimals = Number(element.dataset.decimals || 0);
    const units = 10 ** decimals;
    const formatter = new Intl.NumberFormat('es-MX', {
      useGrouping: 'always', minimumFractionDigits: decimals, maximumFractionDigits: decimals
    });
    const target = Math.round(Number(element.dataset.count) * units);
    const value = element.querySelector('[data-count-value]') || element;
    return { target, write: amount => { value.textContent = (element.dataset.prefix || '') + formatter.format(amount / units); } };
  });

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    const start = performance.now();
    const animate = now => {
      const elapsed = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - start) / 1150));
      const progress = 1 - (1 - elapsed) ** 3;
      for (const { target, write } of values) write(Math.round(target * progress));
      if (elapsed < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, { threshold: 0.28 });
  observer.observe(metrics);
}
