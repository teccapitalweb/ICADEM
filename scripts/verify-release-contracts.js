'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const panel = read('vip-panel.html');
const onboarding = read('js/icadem-onboarding.js');
const platform = read('js/icadem-platform-v2.js');
const serviceWorker = read('sw.js');
const panelMinimal = read('css/panel-minimal.css');
const verifier = read('verificar.html');
const courseRules = read('firestore.courses.rules.fragment');

for (const [section, label] of [
  ['inicio', 'Inicio'], ['cursos', 'Cursos'], ['retos', 'Retos'], ['directorio', 'Directorio']
]) {
  assert.match(panel, new RegExp(`mobile-nav__item[^>]+data-section="${section}"[^>]*>[\\s\\S]*?${label}<\\/button>`));
}
assert.match(panel, /id="mobile-nav-more"[\s\S]*?>Más<\/button>/);
assert.doesNotMatch(panel, /mobile-nav__item[^>]+data-section="(?:webinars|suscripcion)"/);
assert.match(panel, /nav-item" data-section="materiales"/);
assert.match(panel, /mobile-drawer__item" data-section="materiales"/);
assert.match(panel, /materiales:renderMateriales/);
const materialsRenderer = panel.slice(panel.indexOf('function renderMateriales'), panel.indexOf('// RENDER CLASE DETALLE'));
assert.ok(materialsRenderer.length > 0, 'falta renderer de Materiales');
assert.doesNotMatch(materialsRenderer, /toolEsVIP|modo\s*!==?\s*['"]vip['"]/, 'Materiales no debe exigir membresía VIP');
assert.match(materialsRenderer, /data\.content \|\| data\.contenido/);
assert.match(materialsRenderer, /__seccionActualVIP !== 'materiales'/);
assert.match(materialsRenderer, /const anyRedemptionBusy = Boolean\(state\.busy \|\| state\.syncing\)/);
assert.match(materialsRenderer, /!__materialsUiState\.syncing/);
assert.match(materialsRenderer, /stateForRequest\.syncRevision !== requestRevision/);
assert.doesNotMatch(materialsRenderer, /if \(state\.balance < cost\)/);
assert.doesNotMatch(panel, /<button class="club-search-btn"/);
assert.doesNotMatch(panel, /id="(?:cur-search|dir-buscar|tpl-search-input)"/);
assert.match(panelMinimal, /\.sec-hero__eyebrow,[\s\S]*?\.directory-hero__eyebrow \{ display:none!important; \}/);

assert.match(panel, /@media \(min-width:881px\) and \(max-width:1200px\)/);
assert.match(panel, /@media \(max-width: 1380px\)\{[\s\S]*?grid-template-columns: 220px minmax\(0, 1fr\) !important;[\s\S]*?\.aside/);
assert.match(panel, /id="icadem-wide-shell-fix"[\s\S]*?@media \(min-width:1201px\) and \(max-width:1380px\)[\s\S]*?grid-template-columns:220px minmax\(0,1fr\)!important/);
assert.match(panel, /@media \(max-width: 900px\)\{[\s\S]*?\.course-detail-layout\{ grid-template-columns: minmax\(0,1fr\) !important;/);
assert.match(panel, /\.course-detail-progress\{ position: static; grid-column: 1; grid-row: 1; \}/);
assert.match(panel, /\['curso-detalle','clase-detalle'\]\.includes\(section\) \? 'cursos'/);
assert.match(panel, /const cursoGratis = window\.UserState\?\.modo !== 'vip'/);
assert.match(panel, /font-size:16px!important/);
assert.match(panel, /id="theme-toggle"[^>]+aria-label="Cambiar a modo noche"/);
assert.match(panel, /toggle\.setAttribute\('aria-label',`Cambiar a modo \$\{next\}`\)/);

assert.match(onboarding, /claimExperience\(TOUR_EXPERIENCE\)/);
assert.match(onboarding, /claimExperience\(CREDIT_EXPERIENCE\)/);
assert.match(onboarding, /sessionStorage\.setItem\(key\('free-course-deferred-session'\), '1'\)/);
assert.doesNotMatch(onboarding, /markFreeCourseOfferSeen/);
assert.match(onboarding, /selectFreeCourse\(button\.dataset\.freeCourse\)[\s\S]*?write\('free-course-offer-seen','complete'\)/);
assert.match(panel, /window\.__elegirCursoGratis = async function/);
assert.match(panel, /data-free-course-cta=/);
assert.match(panel, /course-detail-lock__cta--free/);
for (const selector of ['#visorOverlay', '#foro-lightbox', '#cf-modal', '#splash-completado', '#cancel-success-splash', '#cancel-sub-modal']) {
  assert.ok(onboarding.includes(selector), `falta coordinar el diálogo ${selector}`);
}

assert.doesNotMatch(panel, /'notificacionPendiente\.mostrada': true/);
assert.match(panel, /if \(np && !np\.mostrada\)/);
assert.doesNotMatch(panel, /if \(isCheckoutSuccess && window\.UserState\.modo === 'vip'\)/);
assert.match(platform, /\/api\/membership\/welcome-seen/);
assert.match(platform, /request\('\/api\/courses\/catalog'\)/);
assert.match(platform, /request\('\/api\/materials'\)/);
assert.match(platform, /function syncCreditSnapshot\(credits, meta\)/);
assert.match(materialsRenderer, /source:\s*'materials-sync'/);
assert.match(platform, /request\('\/api\/materials\/redeem'/);
assert.match(onboarding, /navigateToSection\?\.\('materiales'\)/);
assert.match(panel, /data-news-cover data-fallback=/);
assert.match(panel, /\^https:\\\/\\\//);
assert.ok(panel.includes("const safeColor = /^#[0-9a-f]{3,8}$/i.test"), 'falta validar el color de las portadas');
assert.match(panel, /image\.onerror = \(\) => \{ image\.onerror = null; image\.src = image\.dataset\.fallback; \}/);
assert.match(platform, /if \(window\.__isDemoMode\) return '';/);
assert.match(panel, /const user = window\.__isDemoMode \? null : \(window\.__auth\?\.currentUser \|\| window\.__currentUser\);/);
assert.match(onboarding, /result\?\.marked!==true/);
assert.match(onboarding, /serverClaimed:true/);
assert.match(platform, /\/api\/forum\/posts\/\$\{encodeURIComponent\(id\)\}\/delete/);
assert.match(platform, /\/api\/forum\/posts\/\$\{encodeURIComponent\(id\)\}\/like/);
assert.match(platform, /request\('\/api\/forum\/posts',/);
assert.match(platform, /\/comments`,/);
assert.match(platform, /\/comments\/\$\{encodeURIComponent\(comment\)\}\/delete/);
assert.match(panel, /ICADEMPlatform\.createForumPost/);
assert.match(panel, /ICADEMPlatform\.createForumComment/);
assert.match(panel, /ICADEMPlatform\.deleteForumComment/);
assert.doesNotMatch(panel, /fs\.deleteDoc\(fs\.doc\(fs\.db,'posts',postId\)\)/);
assert.doesNotMatch(panel, /fs\.addDoc\(fs\.collection\(fs\.db,'posts'/);
assert.doesNotMatch(panel, /fs\.deleteDoc\(fs\.doc\(fs\.db,'posts'/);

assert.match(panel, /pedirCatalogoCursos/);
assert.match(panel, /\/api\/courses\/catalog/);
assert.match(panel, /curso\.access\?\.unlocked === true/);
assert.match(panel, /session\?\.accessible === true/);
assert.match(panel, /return mat\?\.accessible === true/);
assert.match(panel, /if \(!claseDesbloqueada\(cursoId, sesionIdx, sesiones\)\)/);
assert.match(panel, /window\.__reloadCourseCatalog/);
assert.doesNotMatch(panel, /fs\.collection\(db, 'cursos'\)/);
assert.doesNotMatch(panel, /fs\.collection\(fs\.db, 'cursos'\)/);
assert.match(courseRules, /match \/cursos\/\{courseId\}/);
assert.match(courseRules, /match \/cursos\/\{courseId\}\/\{nestedDocument=\*\*\}/);
assert.match(courseRules, /allow read, create, update, delete: if isIcademCourseAdmin\(\)/);

assert.match(platform, /state\.customName = profile\.customName/);
assert.match(panel, /icadem_name_confirmed:\$\{account\}/);
assert.match(panel, /ICADEMPlatform\.saveProfile\(\{ nombre: val \}\)/);
assert.doesNotMatch(panel, /localStorage\.getItem\('icadem_name_confirmed'\)/);

assert.match(panel, /if \(window\.__isDemoMode\) emitirCertificadoFirestore\(curso\)/);
assert.match(panel, /if \(!window\.__isDemoMode\) return;/);
assert.match(panel, /if \(window\.__isDemoMode\) \{[\s\S]*?const yaEnFs = new Set/);
assert.match(panel, /if \(x\.serverIssued !== true\) return;/);

assert.match(verifier, /\/api\/certificates\/verify\?folio=/);
assert.match(verifier, /response\.status === 404/);
assert.match(verifier, /if \(!response\.ok\) throw/);
assert.doesNotMatch(verifier, /firebase(?:-app|-firestore)|getFirestore|getDoc\(/);

const platformVersion = panel.match(/icadem-platform-v2\.js\?v=(\d+)/)?.[1];
const onboardingVersion = panel.match(/icadem-onboarding\.js\?v=(\d+)/)?.[1];
const panelMinimalVersion = panel.match(/panel-minimal\.css\?v=(\d+)/)?.[1];
assert.ok(platformVersion && onboardingVersion && panelMinimalVersion, 'faltan versiones de assets');
assert.ok(serviceWorker.includes(`icadem-platform-v2.js?v=${platformVersion}`), 'versión platform desalineada');
assert.ok(serviceWorker.includes(`icadem-onboarding.js?v=${onboardingVersion}`), 'versión onboarding desalineada');
assert.ok(serviceWorker.includes(`panel-minimal.css?v=${panelMinimalVersion}`), 'versión panel minimal desalineada');
assert.doesNotMatch(panel, /data-theme="dark"/);

console.log('OK: contratos de navegación, Materiales, noticias, tablet, experiencias, foro y certificados verificados.');
