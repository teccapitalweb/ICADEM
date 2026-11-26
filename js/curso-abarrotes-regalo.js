const endpoint = 'https://icadem-webhook-production.up.railway.app/api/cursos-individuales/administra-tu-tienda-de-abarrotes/regalo/apartar';
const gift = document.querySelector('#regalo-curso');
const giftTrigger = document.querySelector('[data-gift-open]');
const claim = gift.querySelector('[data-gift-claim]');
const description = gift.querySelector('#gift-description');
const giftDescription = description.innerHTML;
const giftTime = gift.querySelector('#gift-time');
const banner = document.querySelector('#gift-banner');
const summary = document.querySelector('#gift-summary');
const checkoutNotice = document.querySelector('#gift-checkout');
const giftClocks = document.querySelectorAll('[data-gift-clock]');
const shownKey = 'icadem:abarrotes:oferta-regalo-v2';
const browserKey = 'icadem:abarrotes:navegador-regalo';
const launchKey = 'icadem:abarrotes:cierre-lanzamiento';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const twoDigits = n => String(n).padStart(2, '0');

let shown = read('sessionStorage', shownKey) === 'yes';
let browserId;
let reservation;
let pending;
let unavailable = false;
let checkoutReservedUntil = 0;
let tickTimer;

function read(storage, key) {
  try { return window[storage].getItem(key); } catch { return null; }
}

function remember(storage, key, value) {
  try { window[storage].setItem(key, value); } catch {}
}

function getBrowserId() {
  if (browserId) return browserId;
  const saved = read('localStorage', browserKey);
  browserId = uuid.test(saved || '') ? saved : crypto.randomUUID();
  remember('localStorage', browserKey, browserId);
  return browserId;
}

function giftRemaining() {
  return reservation
    ? Math.max(0, Math.min(reservation.wallDeadline - Date.now(), reservation.monoDeadline - performance.now())) : 0;
}

function updateGift() {
  clearTimeout(tickTimer);
  const remaining = giftRemaining();
  const seconds = Math.ceil(remaining / 1000);
  const text = twoDigits(Math.floor(seconds / 60)) + ':' + twoDigits(seconds % 60);
  for (const clock of giftClocks) clock.textContent = text;
  banner.hidden = !seconds || gift.open || isReturning();
  summary.hidden = !seconds;
  checkoutNotice.hidden = !seconds || checkoutReservedUntil !== reservation?.expires;
  giftTime.hidden = !seconds;
  claim.hidden = !seconds;
  if (reservation && !seconds) giftTrigger.hidden = true;
  if (seconds || gift.open) {
    if (seconds && description.innerHTML !== giftDescription) description.innerHTML = giftDescription;
    if (!seconds) description.textContent = reservation ? 'El plazo para recibir este regalo terminó.' : 'El regalo no está disponible en este momento.';
  }
  if (seconds) tickTimer = setTimeout(updateGift, Math.min(1000, remaining));
}

function isReturning() {
  return location.hash === '#mi-curso' || new URLSearchParams(location.search).has('checkout');
}

async function fetchReservation() {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4200);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ navegadorId: getBrowserId() }),
    });
    if (response.status === 404) {
      unavailable = true;
      giftTrigger.hidden = true;
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    const expires = Date.parse(data.venceEn);
    const duration = expires - Date.parse(data.ahora);
    if (!data.cursoRegaloSlug || !Number.isFinite(duration) || duration > 3600000) return;
    reservation = { expires, wallDeadline: Date.now() + duration, monoDeadline: start + duration };
    if (duration <= 0) giftTrigger.hidden = true;
    updateGift();
  } catch {
    // El pago permanece disponible cuando la consulta del regalo no responde.
  } finally {
    clearTimeout(timeout);
  }
}

function prepareGift() {
  if (reservation || unavailable || isReturning()) return Promise.resolve();
  pending ||= fetchReservation().finally(() => { pending = null; });
  return pending;
}

export async function giftCheckoutData() {
  await prepareGift();
  return { navegadorId: getBrowserId(), reservationKey: giftRemaining() ? reservation.expires : null };
}

export function setGiftCheckout(giftReservation) {
  checkoutReservedUntil = Date.parse(giftReservation?.venceEn);
  updateGift();
}

async function showGift(automatic = false) {
  if (isReturning() || document.querySelector('dialog[open]')) return;
  await prepareGift();
  if (isReturning() || document.querySelector('dialog[open]') || unavailable) return;
  if (automatic && (shown || !giftRemaining())) return;
  gift.showModal();
  shown = true;
  remember('sessionStorage', shownKey, 'yes');
  updateGift();
}

function showAutomatically() {
  if (isReturning()) return;
  if (document.hidden) {
    document.addEventListener('visibilitychange', showAutomatically, { once: true });
    return;
  }
  if (shown) prepareGift();
  else showGift(true);
}

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('#gift-celebration')) return;
  const canvas = document.createElement('canvas');
  const paint = canvas.getContext('2d');
  if (!paint) return;
  canvas.id = 'gift-celebration';
  canvas.setAttribute('aria-hidden', 'true');
  const scale = Math.min(devicePixelRatio || 1, 2);
  const width = innerWidth;
  const height = innerHeight;
  canvas.width = width * scale;
  canvas.height = height * scale;
  paint.scale(scale, scale);
  document.body.append(canvas);
  const colors = ['#154ac8', '#69a1ff', '#f7b945', '#f9d56f', '#fff'];
  const pieces = Array.from({ length: 120 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      x: side === 1 ? 0 : width, y: height * (.78 + Math.random() * .14),
      dx: side * (width * (.23 + Math.random() * .45)), dy: -height * (.58 + Math.random() * .68),
      spin: (Math.random() - .5) * 23, size: 4 + Math.random() * 7, color: colors[i % colors.length],
    };
  });
  const start = performance.now();
  function frame(now) {
    const time = (now - start) / 1000;
    if (time >= 3.1) { canvas.remove(); return; }
    paint.clearRect(0, 0, width, height);
    paint.globalAlpha = Math.min(1, (3.1 - time) / .6);
    for (const piece of pieces) {
      paint.save();
      paint.translate(piece.x + piece.dx * time, piece.y + piece.dy * time + height * .47 * time * time);
      paint.rotate(piece.spin * time);
      paint.fillStyle = piece.color;
      paint.fillRect(-piece.size / 2, 0, piece.size, piece.size * .66);
      paint.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const launch = document.querySelector('#launch-clock');
const savedDeadline = Number(read('localStorage', launchKey));
const savedLaunch = Number.isFinite(savedDeadline) && savedDeadline > 0;
const launchDeadline = savedLaunch ? savedDeadline : Date.now() + 12 * 3600000;
if (!savedLaunch) remember('localStorage', launchKey, String(launchDeadline));
const launchHour = launch.querySelector('[data-launch-hour]');
const launchMinute = launch.querySelector('[data-launch-minute]');
const launchSecond = launch.querySelector('[data-launch-second]');
function updateLaunch() {
  const seconds = Math.ceil((launchDeadline - Date.now()) / 1000);
  launch.hidden = seconds <= 0;
  if (seconds <= 0) return;
  launchHour.textContent = twoDigits(Math.floor(seconds / 3600));
  launchMinute.textContent = twoDigits(Math.floor(seconds % 3600 / 60));
  launchSecond.textContent = twoDigits(seconds % 60);
  setTimeout(updateLaunch, 1000);
}

giftTrigger.addEventListener('click', () => showGift());
for (const button of document.querySelectorAll('[data-offer]')) {
  button.addEventListener('click', prepareGift);
}
claim.addEventListener('click', () => {
  if (claim.hidden) return;
  gift.close();
  celebrate();
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
gift.addEventListener('close', updateGift);
window.addEventListener('hashchange', () => {
  if (location.hash === '#regalo-curso') showGift();
  else if (reservation) updateGift();
});
if (location.hash === '#regalo-curso') showGift();
updateLaunch();
setTimeout(showAutomatically, 1900);
