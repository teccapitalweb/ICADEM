const courses = {
  'auxiliar-de-recursos-humanos': {
    name: 'Auxiliar de Recursos Humanos',
    instructor: 'Mtra. Marilyn de los Ángeles Cabrera Rodríguez',
    cover: '/assets/curso-auxiliar-rh/portada-video.webp',
    modules: [
      'Funciones y objetivos de Recursos Humanos',
      'Salud ocupacional y seguridad laboral',
      'Finiquito',
      'Aguinaldo',
      'Prestaciones de ley y componentes de nómina',
    ],
  },
  'practico-de-auxiliar-contable': {
    name: 'Práctico de Auxiliar Contable',
    instructor: 'C.P. Daniela Patricia Correa Vázquez',
    cover: '/assets/curso-practico-de-auxiliar-contable/portada-video.webp',
    modules: [
      'Fundamentos del auxiliar contable',
      'Registros contables y control de operaciones',
      'Gestión de nóminas y cálculos básicos',
      'Estados financieros y análisis básico',
      'Mejora continua y herramientas digitales para auxiliares contables',
    ],
  },
};
const tabs = { inicio: 'Inicio', clases: 'Clases', materiales: 'Materiales', certificado: 'Certificado' };
const url = new URL(location.href);
const slug = url.searchParams.get('curso');
const course = Object.hasOwn(courses, slug) ? courses[slug] : null;
const checkout = url.searchParams.get('checkout') || '';
let checkoutId = /^cs_(test|live)_[a-zA-Z0-9]{10,150}$/.test(checkout) ? checkout : '';
const api = 'https://icadem-webhook-production.up.railway.app/api/cursos-individuales/';
const byId = id => document.getElementById(id);
const access = byId('access');
const classroom = byId('classroom');
const google = byId('google');
const emailLogin = byId('email-login');
const retry = byId('retry');
const verify = byId('verify');
const changeAccount = access.querySelector('[data-sign-out]');
const account = byId('account');
const accountMenu = byId('account-menu');

let firebase;
let auth;
let attempt = 0;
let request;

function selectedTab() {
  const key = location.hash.slice(1);
  return Object.hasOwn(tabs, key) ? key : 'inicio';
}

function updateLoginLink() {
  const target = new URL('/aula/', location.origin);
  target.searchParams.set('curso', slug);
  if (checkoutId) target.searchParams.set('checkout', checkoutId);
  target.hash = selectedTab();
  emailLogin.href = '/vip-auth.html?' + new URLSearchParams({ redirect: target.pathname + target.search + target.hash });
}

function showAccess(title, description, mode = 'loading') {
  classroom.hidden = true;
  access.hidden = false;
  byId('access-title').textContent = title;
  byId('access-description').textContent = description;
  access.setAttribute('aria-busy', String(mode === 'loading'));
  byId('access-actions').hidden = mode === 'loading';
  byId('access-feedback').hidden = true;
  google.hidden = mode !== 'sign-in' || !firebase;
  emailLogin.hidden = mode !== 'sign-in' && mode !== 'unavailable';
  retry.hidden = !['verify-email', 'no-purchase', 'unavailable', 'retry'].includes(mode);
  retry.textContent = mode === 'verify-email' ? 'Ya verifiqué mi correo' : mode === 'no-purchase' ? 'Comprobar acceso' : 'Reintentar';
  verify.hidden = mode !== 'verify-email';
  changeAccount.hidden = !auth?.currentUser;
}

function showFeedback(message) {
  const output = access.hidden ? byId('classroom-feedback') : byId('access-feedback');
  output.textContent = message;
  output.hidden = false;
}

function toggleAccount(open) {
  accountMenu.hidden = !open;
  account.setAttribute('aria-expanded', String(open));
}

function updateView(focus = false) {
  if (classroom.hidden) return;
  const tab = selectedTab();
  toggleAccount(false);
  byId('topbar-title').textContent = tabs[tab];
  for (const view of document.querySelectorAll('.course-view')) view.hidden = view.id !== tab;
  for (const link of document.querySelectorAll('[data-view]')) {
    if (link.dataset.view === tab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (focus) {
    window.scrollTo(0, 0);
    byId(tab).querySelector('h1').focus({ preventScroll: true });
  }
}

function openClassroom(user) {
  if (url.searchParams.has('checkout')) {
    checkoutId = '';
    url.searchParams.delete('checkout');
    url.hash = location.hash;
    history.replaceState(history.state, '', url);
    updateLoginLink();
  }
  const email = user.email || '';
  byId('account-email').textContent = email;
  byId('account-menu-email').textContent = email;
  account.textContent = (user.displayName?.trim() || email || 'I').slice(0, 1).toUpperCase();
  byId('classroom-feedback').hidden = true;
  access.hidden = true;
  classroom.hidden = false;
  updateView();
}

async function checkAccess(user) {
  const revision = ++attempt;
  request?.abort();
  if (!user) {
    showAccess('Entra a tu curso', 'Usa el mismo correo que registraste al pagar tu inscripción.', 'sign-in');
    return;
  }
  showAccess('Verificando tu acceso', 'Estamos comprobando la inscripción de esta cuenta.');
  const controller = new AbortController();
  request = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const token = await user.getIdToken(true);
    if (revision !== attempt) return;
    const endpoint = new URL(api + slug + '/aula');
    if (checkoutId) endpoint.searchParams.set('checkout', checkoutId);
    const response = await fetch(endpoint, {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await response.json();
    if (revision !== attempt) return;
    if (response.ok && typeof data.curso === 'string' && Array.isArray(data.clases) && Array.isArray(data.materiales)) {
      openClassroom(user);
    } else if (response.status === 403 && data.code === 'verificar-correo') {
      showAccess('Verifica tu correo', 'Confirma tu correo para vincular la compra a esta cuenta.', 'verify-email');
    } else if (response.status === 403 && data.code === 'sin-compra') {
      showAccess('Inscripción por confirmar', 'Usa el correo con el que pagaste. Si terminaste el pago, vuelve a comprobar el acceso.', 'no-purchase');
    } else {
      showAccess('No pudimos comprobar tu inscripción', 'Espera un momento y vuelve a intentarlo.', 'retry');
    }
  } catch {
    if (revision === attempt) showAccess('No pudimos comprobar tu inscripción', 'Revisa tu conexión y vuelve a intentarlo.', 'retry');
  } finally {
    clearTimeout(timeout);
  }
}

async function connectAuth() {
  showAccess('Abriendo el aula', 'Verificamos si ya iniciaste sesión.');
  try {
    const [app, sdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    ]);
    const instance = app.getApps()[0] || app.initializeApp({
      apiKey: 'AIzaSyBzPC1wxbzOYutcECtwYBWTTbo76cqrmdA',
      authDomain: 'icadem-vip.firebaseapp.com',
      projectId: 'icadem-vip',
      appId: '1:12508983783:web:b12be6f1fab9bb91fb8d42',
    });
    auth = sdk.getAuth(instance);
    firebase = sdk;
    sdk.onAuthStateChanged(auth, checkAccess);
  } catch {
    showAccess('No pudimos iniciar el aula', 'Revisa tu conexión o inicia sesión con tu cuenta de ICADEM.', 'unavailable');
  }
}

if (!course) {
  showAccess('Elige tu curso', 'Selecciona el aula a la que quieres entrar.', 'choose');
  byId('access-actions').hidden = true;
  byId('course-options').hidden = false;
} else {
  document.title = course.name + ' · Aula ICADEM';
  for (const title of document.querySelectorAll('[data-course-title]')) title.textContent = course.name;
  for (const link of document.querySelectorAll('[data-landing]')) {
    link.href = '/curso-' + slug + '.html';
    if (link.classList.contains('back-link')) link.textContent = 'Volver a la página del curso';
  }
  access.querySelector('.access-course').hidden = false;
  byId('access-cover').hidden = false;
  byId('access-image').src = course.cover;
  byId('course-image').src = course.cover;
  byId('course-instructor').textContent = course.instructor;
  const modules = course.modules.map((title, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'module-number';
    number.textContent = index + 1;
    number.setAttribute('aria-hidden', 'true');
    item.append(number, title);
    return item;
  });
  byId('module-list').replaceChildren(...modules);
  updateLoginLink();

  google.addEventListener('click', async () => {
    google.disabled = true;
    const provider = new firebase.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await firebase.signInWithPopup(auth, provider);
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showFeedback('No pudimos abrir Google. También puedes ingresar con tu cuenta ICADEM.');
      }
    } finally {
      google.disabled = false;
    }
  });
  retry.addEventListener('click', () => firebase ? checkAccess(auth.currentUser) : connectAuth());
  verify.addEventListener('click', async () => {
    verify.disabled = true;
    try {
      await firebase.sendEmailVerification(auth.currentUser);
      showFeedback('Revisa tu bandeja de entrada o correo no deseado.');
    } catch {
      showFeedback('No pudimos enviar el correo. Intenta de nuevo en unos minutos.');
    } finally {
      verify.disabled = false;
    }
  });
  for (const button of document.querySelectorAll('[data-sign-out]')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await firebase.signOut(auth);
      } catch {
        showFeedback('No pudimos cerrar tu sesión. Intenta de nuevo.');
      } finally {
        button.disabled = false;
      }
    });
  }
  account.addEventListener('click', () => toggleAccount(accountMenu.hidden));
  document.addEventListener('pointerdown', event => {
    if (!accountMenu.contains(event.target) && !account.contains(event.target)) toggleAccount(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !accountMenu.hidden) {
      toggleAccount(false);
      account.focus();
    }
  });
  window.addEventListener('hashchange', () => {
    updateLoginLink();
    updateView(true);
  });
  connectAuth();
}
