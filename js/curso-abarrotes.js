import { giftCheckoutData, setGiftCheckout } from './curso-abarrotes-regalo.js?v=2';

const coursePath = '/api/cursos-individuales/administra-tu-tienda-de-abarrotes';
const api = 'https://icadem-webhook-production.up.railway.app' + coursePath;
const stripeKey = 'pk_live_51TMAcSA7If2CqXs9NuKsM1cVT9n5agProkMR8HFiT6QTXzS0g9PtiokZ4cpT1Qo3rk9bbsrZHx9sOUbE9UEOjgGs00n1OM3Y9b';
const promoUrl = '';
const giftVideoHosts = new Set(['storage.googleapis.com', 'icadem-vip.firebasestorage.app']);
const money = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const mxn = amount => '$' + money.format(amount);
const visitId = crypto.randomUUID();
const search = new URLSearchParams(location.search);
const checkoutId = search.get('checkout');
const referrer = document.referrer ? new URL(document.referrer) : null;
const origin = search.get('utm_source') || (referrer && referrer.origin !== location.origin ? referrer.hostname : 'directo');
const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'tableta' :
  /Mobi|iPhone|Android/i.test(navigator.userAgent) ? 'telefono' : 'computadora';
const context = { visitaId: visitId, origen: origin, dispositivo: device };

const offer = document.querySelector('#oferta');
const offerSummary = document.querySelector('#offer-summary');
const paymentMessage = document.querySelector('#payment-message');
const payButton = document.querySelector('#pay');
const checkoutContainer = document.querySelector('#stripe-checkout');
const paymentTitle = document.querySelector('#offer-title');
const paymentSecure = document.querySelector('#payment-secure');
const paymentBack = document.querySelector('#payment-back');
const paymentFinalAmount = document.querySelector('#payment-final-amount');
const paymentSummaryStep = document.querySelector('#payment-step-summary');
const paymentCheckoutStep = document.querySelector('#payment-step-checkout');
const classroom = document.querySelector('#mi-curso');
const content = document.querySelector('#classroom-content');
let currentPrice = 599;
let checkout;
let checkoutAttempt;
let paymentGeneration = 0;
let stripePromise;
let classroomGeneration = 0;
let firebase;
let firebaseReady;
let authUnsubscribe;
let priceRequest;

const times = new Map();
function flush(event) {
  const clock = times.get(event);
  if (!clock) return;
  const seconds = Math.min(14400, Math.floor((clock.elapsed + (clock.start ? performance.now() - clock.start : 0)) / 1000));
  if (seconds === clock.sent) return;
  clock.sent = seconds;
  fetch(api + '/actividad', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ ...context, evento: event, segundos: seconds }),
  }).then(response => {
    if (!response.ok && clock.sent === seconds) clock.sent = null;
  }).catch(() => { if (clock.sent === seconds) clock.sent = null; });
}
function startTime(event) {
  if (!times.has(event)) times.set(event, { elapsed: 0, active: true });
  const clock = times.get(event);
  clock.active = true;
  if (!document.hidden && !clock.start) clock.start = performance.now();
  flush(event);
}
function pauseTime(event, active = false) {
  const clock = times.get(event);
  if (!clock) return;
  if (clock.start) clock.elapsed += performance.now() - clock.start;
  clock.start = null;
  clock.active = active;
  flush(event);
}
startTime('visita');
document.addEventListener('visibilitychange', () => {
  for (const [event, clock] of times) {
    if (!clock.active) continue;
    if (document.hidden) pauseTime(event, true);
    else startTime(event);
  }
});
window.addEventListener('pagehide', () => {
  for (const event of times.keys()) flush(event);
});

function setPrices(course) {
  if (!Number.isInteger(course?.precioNormal) || !Number.isInteger(course?.precioLanzamiento)) return;
  currentPrice = course.precioLanzamiento;
  document.querySelectorAll('[data-normal]').forEach(el => { el.textContent = mxn(course.precioNormal) + ' MXN'; });
  document.querySelectorAll('[data-current]').forEach(el => { el.textContent = mxn(currentPrice); });
  const saving = document.querySelector('[data-saving]');
  const difference = course.precioNormal - currentPrice;
  saving.hidden = difference <= 0;
  saving.textContent = 'Ahorras ' + mxn(difference) + ' MXN';
}
async function json(path = '', options = {}) {
  const response = await fetch(api + path, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status >= 500 || response.status === 404
      ? 'El servicio no está disponible por el momento. Intenta de nuevo.' : 'No pudimos completar la solicitud.';
    throw Object.assign(new Error(data.error || fallback), data);
  }
  return data;
}
function refreshPrices() {
  if (!priceRequest) priceRequest = json().then(setPrices).catch(() => {}).finally(() => { priceRequest = null; });
  return priceRequest;
}
refreshPrices();

const promo = document.querySelector('#promocional');
if (promoUrl) {
  const placeholder = document.querySelector('.media-placeholder');
  const sound = document.querySelector('.media-sound');
  const updateSound = () => { sound.hidden = promo.hidden || (!promo.muted && promo.volume > 0); };
  promo.addEventListener('playing', () => startTime('video'));
  for (const event of ['pause', 'ended', 'waiting']) promo.addEventListener(event, () => pauseTime('video'));
  promo.addEventListener('volumechange', updateSound);
  promo.addEventListener('error', () => {
    pauseTime('video');
    promo.hidden = true;
    placeholder.hidden = false;
    updateSound();
  });
  sound.addEventListener('click', () => {
    if (!promo.volume) promo.volume = 1;
    promo.muted = false;
    promo.play().catch(() => {});
    updateSound();
  });
  promo.autoplay = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  promo.muted = true;
  promo.hidden = false;
  placeholder.hidden = true;
  updateSound();
  promo.src = promoUrl;
}

function loadStripe() {
  if (window.Stripe) return Promise.resolve(window.Stripe(stripeKey));
  if (!stripePromise) stripePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    const timer = setTimeout(() => fail(), 12000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error('No se pudo abrir Stripe. Intenta de nuevo.'));
    }
    script.onload = () => {
      clearTimeout(timer);
      if (window.Stripe) resolve(window.Stripe(stripeKey));
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => { stripePromise = null; throw error; });
  return stripePromise;
}
for (const button of document.querySelectorAll('[data-offer]')) button.addEventListener('click', () => {
  if (offer.open) return;
  showPaymentSummary();
  offer.showModal();
  startTime('oferta');
  refreshPrices();
});
function showPaymentSummary() {
  paymentGeneration++;
  setGiftCheckout(null);
  pauseTime('checkout');
  checkout?.destroy();
  checkout = null;
  checkoutContainer.replaceChildren();
  checkoutContainer.hidden = true;
  paymentSecure.hidden = true;
  offerSummary.hidden = false;
  offer.classList.remove('is-checkout');
  paymentTitle.textContent = 'Inscripción al curso';
  paymentCheckoutStep.removeAttribute('aria-current');
  paymentSummaryStep.setAttribute('aria-current', 'step');
  paymentMessage.textContent = '';
  payButton.disabled = false;
  payButton.textContent = 'Continuar al pago';
  offer.scrollTop = 0;
}
offer.addEventListener('close', () => {
  if (offer.open) return;
  pauseTime('oferta');
  showPaymentSummary();
});
paymentBack.addEventListener('click', () => {
  showPaymentSummary();
  startTime('oferta');
  refreshPrices();
  payButton.focus({ preventScroll: true });
});
payButton.addEventListener('click', async () => {
  const generation = ++paymentGeneration;
  payButton.disabled = true;
  payButton.textContent = 'Abriendo pago…';
  paymentMessage.textContent = '';
  try {
    // The customer must see and accept any change before Stripe is initialized.
    const amountShown = currentPrice;
    const [stripe, { navegadorId, reservationKey }] = await Promise.all([loadStripe(), giftCheckoutData()]);
    if (generation !== paymentGeneration) return;
    if (checkoutAttempt?.price !== amountShown || checkoutAttempt?.reservationKey !== reservationKey) {
      checkoutAttempt = { id: crypto.randomUUID(), price: amountShown, reservationKey };
    }
    const { clientSecret, regaloReservado } = await json('/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...context, intento: checkoutAttempt.id, precio: amountShown, navegadorId }),
    });
    if (generation !== paymentGeneration) return;
    const instance = await stripe.initEmbeddedCheckout({ clientSecret });
    if (generation !== paymentGeneration) {
      instance.destroy();
      return;
    }
    checkout = instance;
    paymentTitle.textContent = 'Completa tu pago';
    paymentFinalAmount.textContent = mxn(amountShown);
    paymentSummaryStep.removeAttribute('aria-current');
    paymentCheckoutStep.setAttribute('aria-current', 'step');
    offer.classList.add('is-checkout');
    paymentSecure.hidden = false;
    checkoutContainer.hidden = false;
    offerSummary.hidden = true;
    setGiftCheckout(regaloReservado);
    checkout.mount(checkoutContainer);
    offer.scrollTop = 0;
    paymentBack.focus({ preventScroll: true });
    pauseTime('oferta');
    startTime('checkout');
  } catch (error) {
    if (generation !== paymentGeneration) return;
    showPaymentSummary();
    if (error.curso) {
      checkoutAttempt = null;
      setPrices(error.curso);
    }
    paymentMessage.textContent = error.curso ? error.message : 'No pudimos abrir Stripe. Revisa tu conexión y vuelve a intentar.';
    payButton.focus({ preventScroll: true });
  }
});

function notice(title, body, buttons = '') {
  content.innerHTML = '<h3></h3><p></p><div class="aula-actions">' + buttons + '</div>';
  content.querySelector('h3').textContent = title;
  content.querySelector('p').textContent = body;
}
function showSignIn() {
  notice('Entra a tu curso', 'Usa el correo con el que hiciste el pago. Si aún no tienes una cuenta ICADEM, puedes crearla con ese correo.', '<a class="button" id="course-login">Iniciar sesión o registrarme</a>');
  const redirect = location.pathname + location.search + '#mi-curso';
  content.querySelector('#course-login').href = 'vip-auth.html?redirect=' + encodeURIComponent(redirect);
}
function renderClassroom(data, user) {
  content.innerHTML = '<div class="aula-hero"><p>ICADEM · Mi aula</p><h3></h3></div>' +
    '<div class="aula-tabs" aria-label="Contenido del aula"><button type="button" aria-pressed="true" data-aula="clases">Clases</button><button type="button" aria-pressed="false" data-aula="materiales">Materiales</button></div>' +
    '<div class="aula-empty"><strong></strong><p></p></div>' +
    '<div class="aula-links"><a href="https://wa.me/522383738143" target="_blank" rel="noopener">Soporte ICADEM</a><button type="button" id="aula-signout">Cerrar sesión</button></div>';
  content.querySelector('h3').textContent = data.curso;
  if (data.regalo) {
    const giftCard = document.createElement('section');
    giftCard.className = 'aula-empty aula-gift';
    giftCard.innerHTML = '<div><span>Tu curso de regalo</span><strong></strong></div><button type="button" class="button button-small">Abrir curso</button>';
    giftCard.querySelector('strong').textContent = data.regalo.titulo;
    giftCard.querySelector('button').addEventListener('click', () => showGiftClassroom(data, user));
    content.querySelector('.aula-hero').after(giftCard);
  } else if (data.regaloPendiente) {
    const pendingGift = document.createElement('p');
    pendingGift.className = 'payment-gift';
    pendingGift.id = 'pending-gift';
    pendingGift.textContent = 'Estamos comprobando el acceso a tu curso de regalo.';
    content.querySelector('.aula-hero').after(pendingGift);
  }
  const actions = [...content.querySelectorAll('[data-aula]')];
  function setAulaTab(key) {
    for (const action of actions) action.setAttribute('aria-pressed', action.dataset.aula === key);
    const media = key === 'materiales';
    content.querySelector('.aula-empty strong').textContent = media ? 'Sin materiales por ahora' : 'Las clases aún no están publicadas';
    content.querySelector('.aula-empty p').textContent = media ? 'Aquí encontrarás los recursos del curso cuando estén disponibles.' : 'Las grabaciones se habilitarán en esta sección.';
  }
  actions.forEach(action => action.addEventListener('click', () => setAulaTab(action.dataset.aula)));
  setAulaTab('clases');
  content.querySelector('#aula-signout').addEventListener('click', signOutCourse);
}

function showGiftClassroom(data, user) {
  const gift = data.regalo;
  content.innerHTML = '<div class="aula-hero"><p>Tu curso de regalo</p><h3></h3></div>' +
    '<div class="aula-tabs" aria-label="Contenido del curso de regalo"><button type="button" aria-pressed="true" data-gift-tab="clase">Clases</button><button type="button" aria-pressed="false" data-gift-tab="material">Materiales</button></div>' +
    '<ul class="aula-gift-list"></ul><div class="aula-gift-view" aria-live="polite"></div>' +
    '<div class="aula-actions"><button type="button" class="button button-light" id="aula-gift-back">Volver a Abarrotes</button></div>';
  content.querySelector('h3').textContent = gift.titulo;
  content.querySelector('#aula-gift-back').addEventListener('click', () => renderClassroom(data, user));
  const tabs = content.querySelectorAll('[data-gift-tab]');
  const list = content.querySelector('.aula-gift-list');
  const result = content.querySelector('.aula-gift-view');
  const generation = classroomGeneration;
  let selection = 0;

  async function openItem(kind, item, button) {
    const id = ++selection;
    result.textContent = kind === 'clase' ? 'Cargando clase…' : 'Preparando archivo…';
    button.disabled = true;
    try {
      const token = await user.getIdToken();
      const itemData = await json('/regalo/' + kind + '/' + encodeURIComponent(item.id), {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!result.isConnected || generation !== classroomGeneration || id !== selection) return;
      const url = new URL(itemData.url);
      if (url.protocol !== 'https:') throw new Error('Enlace inválido');
      if (kind === 'clase') {
        if (itemData.tipo !== 'video/mp4' || !giftVideoHosts.has(url.hostname)) throw new Error('Video inválido');
        const player = document.createElement('video');
        player.controls = true;
        player.playsInline = true;
        player.preload = 'metadata';
        player.setAttribute('aria-label', item.titulo);
        player.addEventListener('error', () => {
          if (player.isConnected && generation === classroomGeneration && id === selection) {
            result.textContent = 'No pudimos cargar el video. Selecciona la clase para volver a intentarlo.';
          }
        }, { once: true });
        player.src = url.href;
        result.replaceChildren(player);
      } else {
        const download = document.createElement('a');
        download.className = 'button button-small';
        download.href = url.href;
        download.target = '_blank';
        download.rel = 'noopener noreferrer';
        download.textContent = 'Abrir ' + item.titulo;
        result.replaceChildren(download);
        download.focus();
      }
    } catch {
      if (result.isConnected && generation === classroomGeneration && id === selection) result.textContent = 'No pudimos abrir este contenido. Intenta de nuevo.';
    } finally {
      button.disabled = false;
    }
  }

  function showItems(kind) {
    selection++;
    result.replaceChildren();
    for (const tab of tabs) tab.setAttribute('aria-pressed', tab.dataset.giftTab === kind);
    const items = kind === 'clase' ? gift.clases : gift.materiales;
    list.replaceChildren(...(items || []).map(item => {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.titulo;
      button.addEventListener('click', () => openItem(kind, item, button));
      row.append(button);
      return row;
    }));
  }

  for (const tab of tabs) tab.addEventListener('click', () => showItems(tab.dataset.giftTab));
  showItems('clase');
}
async function signOutCourse() {
  try { await firebase.signOut(firebase.auth); } catch { showRetry('No se pudo cerrar la sesión. Intenta de nuevo.'); }
}
function showRetry(message) {
  notice('No pudimos cargar el aula', message, '<button class="button" type="button" id="retry-aula">Reintentar</button>');
  content.querySelector('#retry-aula').addEventListener('click', connectClassroom);
}
async function checkAccess(user) {
  const generation = ++classroomGeneration;
  const isCurrent = () => classroom.open && generation === classroomGeneration;
  if (!user) return showSignIn();
  notice('Mi curso', 'Verificando tu acceso…');
  try {
    const token = await user.getIdToken(true);
    const params = new URLSearchParams({ visitaId: visitId });
    if (checkoutId) params.set('checkout', checkoutId);
    const readClassroom = () => json('/aula?' + params, { headers: { Authorization: 'Bearer ' + token } });
    const data = await readClassroom();
    if (isCurrent()) {
      if (checkoutId) {
        const clean = new URL(location.href);
        clean.searchParams.delete('checkout');
        history.replaceState(null, '', clean);
      }
      renderClassroom(data, user);
      if (data.regaloPendiente && !data.regalo) {
        checkPendingGift(readClassroom, isCurrent, user);
      }
    }
  } catch (error) {
    if (!isCurrent()) return;
    if (error.code === 'verificar-correo') {
      notice('Verifica tu correo', 'Confirma tu correo para vincular tu inscripción a esta cuenta.',
        '<button class="button" type="button" id="send-verification">Enviar correo de verificación</button><button class="button button-light" type="button" id="check-verification">Ya lo verifiqué</button><button class="button button-light" type="button" id="change-account">Cambiar de cuenta</button><p class="status" role="status"></p>');
      content.querySelector('#send-verification').addEventListener('click', async event => {
        const button = event.currentTarget;
        const status = content.querySelector('.status');
        button.disabled = true;
        try {
          await firebase.sendEmailVerification(user);
          status.textContent = 'Revisa tu bandeja de entrada y tu correo no deseado.';
        } catch {
          status.textContent = 'No se pudo enviar el correo. Espera un momento y vuelve a intentarlo.';
          button.disabled = false;
        }
      });
      content.querySelector('#check-verification').addEventListener('click', () => checkAccess(user));
    } else if (error.code === 'sin-compra') {
      notice('Inscripción por confirmar', 'Usa el correo que ingresaste al pagar. Si acabas de pagar, puedes volver a comprobar tu acceso.',
        '<button class="button" type="button" id="check-verification">Comprobar acceso</button><button class="button button-light" type="button" id="change-account">Cambiar de cuenta</button><a class="button button-light" href="https://wa.me/522383738143" target="_blank" rel="noopener">Contactar a ICADEM</a>');
      content.querySelector('#check-verification').addEventListener('click', () => checkAccess(user));
    } else {
      return showRetry(error.message);
    }
    content.querySelector('#change-account').addEventListener('click', signOutCourse);
  }
}

async function checkPendingGift(readClassroom, isCurrent, user) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (!isCurrent()) return;
    const data = await readClassroom().catch(() => null);
    if (!isCurrent()) return;
    if (data && (data.regalo || !data.regaloPendiente)) {
      renderClassroom(data, user);
      return;
    }
  }
  const pendingGift = content.querySelector('#pending-gift');
  if (pendingGift) pendingGift.textContent = 'El regalo sigue en revisión. Vuelve a abrir el aula en unos minutos.';
}
async function loadFirebase() {
  const [app, auth] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
  ]);
  const instance = app.getApps()[0] || app.initializeApp({
    apiKey: 'AIzaSyBzPC1wxbzOYutcECtwYBWTTbo76cqrmdA',
    authDomain: 'icadem-vip.firebaseapp.com',
    projectId: 'icadem-vip',
    appId: '1:12508983783:web:b12be6f1fab9bb91fb8d42',
  });
  return { ...auth, auth: auth.getAuth(instance) };
}
async function connectClassroom() {
  const generation = ++classroomGeneration;
  notice('Mi curso', 'Verificando tu acceso…');
  try {
    firebaseReady ||= loadFirebase().catch(error => { firebaseReady = null; throw error; });
    firebase = await firebaseReady;
    if (!classroom.open || generation !== classroomGeneration) return;
    authUnsubscribe?.();
    authUnsubscribe = firebase.onAuthStateChanged(firebase.auth, checkAccess);
  } catch {
    if (classroom.open && generation === classroomGeneration) showRetry('Revisa tu conexión y vuelve a intentarlo.');
  }
}
function openClassroom() {
  if (classroom.open) return;
  if (offer.open) offer.close();
  if (location.hash !== '#mi-curso') history.pushState(null, '', '#mi-curso');
  classroom.showModal();
  startTime('yaPague');
  connectClassroom();
}
classroom.addEventListener('close', () => {
  classroomGeneration++;
  authUnsubscribe?.();
  authUnsubscribe = null;
  pauseTime('yaPague');
  if (location.hash === '#mi-curso') history.replaceState(null, '', location.pathname + location.search);
});
for (const link of document.querySelectorAll('a[href="#mi-curso"]')) link.addEventListener('click', event => {
  event.preventDefault();
  openClassroom();
});
function syncHash() {
  if (location.hash === '#mi-curso') openClassroom();
  else if (classroom.open) classroom.close();
}
window.addEventListener('hashchange', syncHash);
syncHash();
