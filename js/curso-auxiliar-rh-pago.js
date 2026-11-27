const courseApi = 'https://icadem-webhook-production.up.railway.app/api/cursos-individuales/auxiliar-de-recursos-humanos';
const stripeKey = 'pk_live_51TMAcSA7If2CqXs9NuKsM1cVT9n5agProkMR8HFiT6QTXzS0g9PtiokZ4cpT1Qo3rk9bbsrZHx9sOUbE9UEOjgGs00n1OM3Y9b';
const price = 650;

const search = new URLSearchParams(location.search);
const checkoutId = search.get('checkout');
const referrer = document.referrer && new URL(document.referrer);
const source = search.get('utm_source') || (referrer && referrer.origin !== location.origin ? referrer.hostname : 'directo');
const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'tableta' :
  /Mobi|iPhone|Android/i.test(navigator.userAgent) ? 'telefono' : 'computadora';
const payment = document.querySelector('#rh-payment');
const mount = payment.querySelector('[data-rh-checkout-mount]');
const checkoutStatus = payment.querySelector('[data-rh-checkout-status]');
const retry = payment.querySelector('[data-rh-retry]');
const result = document.querySelector('[data-rh-payment-status]');
const countdowns = [...document.querySelectorAll('[data-rh-countdown]')];

let stripeRequest;
let visitId;
let attempt;
let opening;
let checkout;
let canStartPayment = !checkoutId;

async function request(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(courseApi + path, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw Object.assign(new Error('Course request failed'), { status: response.status });
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function loadStripe() {
  if (window.Stripe) return Promise.resolve(window.Stripe(stripeKey));
  if (!stripeRequest) {
    stripeRequest = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(failed, 12000);

      function failed() {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Stripe.js could not load'));
      }

      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.addEventListener('load', () => {
        if (!window.Stripe) return failed();
        clearTimeout(timeout);
        resolve(window.Stripe(stripeKey));
      }, { once: true });
      script.addEventListener('error', failed, { once: true });
      document.head.append(script);
    }).catch(error => {
      stripeRequest = undefined;
      throw error;
    });
  }
  return stripeRequest;
}

async function showCheckout() {
  if (!payment.open || opening || checkout) return;
  const current = Symbol();
  opening = current;
  retry.hidden = true;
  checkoutStatus.hidden = false;
  checkoutStatus.textContent = 'Preparando el pago seguro con Stripe…';

  try {
    const stripe = await loadStripe();
    if (opening !== current || !payment.open) return;
    visitId ||= crypto.randomUUID();
    attempt ||= crypto.randomUUID();
    const { clientSecret } = await request('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitaId: visitId,
        intento: attempt,
        precio: price,
        origen: source,
        dispositivo: device,
      }),
    });
    if (opening !== current || !payment.open) return;
    if (!clientSecret) throw new Error('Missing Checkout client secret');
    const instance = await stripe.initEmbeddedCheckout({ clientSecret });
    if (opening !== current || !payment.open) {
      instance.destroy();
      return;
    }
    checkout = instance;
    mount.hidden = false;
    instance.mount(mount);
    checkoutStatus.hidden = true;
  } catch {
    if (opening !== current || !payment.open) return;
    checkout?.destroy();
    checkout = undefined;
    mount.hidden = true;
    checkoutStatus.textContent = 'El formulario de pago no se pudo abrir. Intenta de nuevo en un momento.';
    retry.hidden = false;
  } finally {
    if (opening === current) opening = undefined;
  }
}

for (const button of document.querySelectorAll('[data-rh-buy]')) {
  button.addEventListener('click', event => {
    if (!canStartPayment) {
      event.preventDefault();
      result.scrollIntoView({ block: 'center' });
      return;
    }
    if (typeof payment.showModal !== 'function') return;
    event.preventDefault();
    if (!payment.open) payment.showModal();
    showCheckout();
  });
}

retry.addEventListener('click', showCheckout);
payment.addEventListener('close', () => {
  opening = undefined;
  checkout?.destroy();
  checkout = undefined;
  mount.hidden = true;
});

const states = {
  pagado: 'Pago confirmado. Tu inscripción quedó registrada con el correo que ingresaste en Stripe.',
  pendiente: 'Tu pago sigue pendiente de confirmación. Puedes volver a consultar el estado recargando esta página.',
  expirado: 'La sesión de pago venció. Selecciona «Inscribirme» para iniciar otra.',
  reembolsado: 'El pago de esta inscripción se reembolsó.',
};

async function checkPayment() {
  result.hidden = false;
  result.textContent = 'Estamos verificando tu pago con Stripe…';
  try {
    const params = new URLSearchParams({ checkout: checkoutId });
    const { estado } = await request('/inscripcion?' + params, { cache: 'no-store' });
    canStartPayment = estado === 'expirado' || estado === 'reembolsado';
    result.toggleAttribute('data-confirmed', estado === 'pagado');
    result.textContent = states[estado] || 'El estado del pago aún no está disponible.';
  } catch (error) {
    canStartPayment = error.status === 404;
    result.textContent = canStartPayment
      ? 'La sesión de pago no está disponible. Selecciona «Inscribirme» para abrir el formulario.'
      : 'No pudimos verificar el pago. Recarga esta página para consultar su estado.';
  }
}

function startCountdown({ lanzamientoHasta, ahora }) {
  const deadline = Date.parse(lanzamientoHasta);
  if (!Number.isFinite(deadline)) return;
  const serverTime = Date.parse(ahora);
  const timeOffset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
  const labels = ['h', 'min', 'seg'];
  const clocks = countdowns.map(countdown => {
    const clock = countdown.querySelector('[data-rh-time]');
    return labels.map(label => {
      const part = document.createElement('span');
      const value = document.createTextNode('');
      const unit = document.createElement('small');
      unit.textContent = label;
      part.append(value, unit);
      clock.append(part);
      return value;
    });
  });

  function tick() {
    const remaining = Math.ceil((deadline - Date.now() - timeOffset) / 1000);
    for (const countdown of countdowns) countdown.hidden = remaining <= 0;
    if (remaining <= 0) return;
    const parts = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60];
    for (const clock of clocks) {
      clock.forEach((value, index) => { value.data = String(parts[index]).padStart(2, '0'); });
    }
    setTimeout(tick, 1000);
  }

  tick();
}

request('', { cache: 'no-store' }).then(startCountdown).catch(() => {});
if (checkoutId) checkPayment();
