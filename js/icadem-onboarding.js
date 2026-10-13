(function () {
  'use strict';

  const VERSION = 'v3';
  const MOBILE_BREAKPOINT = 1200;
  const STORAGE_PREFIX = `icadem:experience:${VERSION}:`;
  const TOUR_EXPERIENCE = { id:'panel-tour', version:'v3' };
  const CREDIT_EXPERIENCE = { id:'welcome-credits', version:'v1' };
  const experienceClaims = new Map();
  const steps = [
    { icon:'✦', title:name=>`¡Bienvenido/a, ${name}!`, text:'Te mostramos lo esencial de ICADEM en menos de 30 segundos. Después podrás explorar a tu ritmo.', selectors:['#inicio-content .banner','.topbar'] },
    { icon:'▤', title:'Tu ruta de cursos', text:'En Mis cursos eliges tu ruta de inicio, retomas clases y consultas tu avance y materiales.', selectors:['.sidebar .nav-item[data-section="cursos"]','.mobile-nav__item[data-section="cursos"]'] },
    { icon:'✓', title:'Retos aplicados', text:'Practica con dinámicas breves, suma créditos verificados y refuerza lo aprendido sin perder tu avance.', selectors:['.sidebar .nav-item[data-section="retos"]','.mobile-nav__item[data-section="retos"]'] },
    { icon:'◎', title:'Tu red profesional', text:'Encuentra a otros integrantes de ICADEM y administra con claridad qué datos compartes en el Directorio VIP.', selectors:['.sidebar .nav-item[data-section="directorio"]','.mobile-nav__item[data-section="directorio"]'] },
    { icon:'⌁', title:'Recursos profesionales', text:'Usa calculadoras, plantillas y la biblioteca para resolver decisiones fiscales, legales y de negocio.', selectors:['.sidebar .nav-item[data-section="herramientas"]','.mobile-drawer__item[data-section="herramientas"]'], mobileDrawer:true },
    { icon:'✓', title:'¡Listo para empezar!', text:'Tu panel quedó preparado. Puedes repetir este recorrido cuando quieras desde el botón de ayuda de la barra superior.', selectors:[], final:true }
  ];

  let root, spotlight, card, currentTarget = null, previousFocus = null, resolveTour = null;
  let stepIndex = 0, renderToken = 0, running = false, previousOverflow = '';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  }
  function identity() {
    const state = window.UserState || {};
    return state.uid || (state.email && state.email.toLowerCase()) || (window.__isDemoMode ? 'demo' : 'local');
  }
  function key(name) { return STORAGE_PREFIX + encodeURIComponent(identity()) + ':' + name; }
  function read(name, fallback) { try { return localStorage.getItem(key(name)) ?? fallback; } catch (_) { return fallback; } }
  function write(name, value) { try { localStorage.setItem(key(name), String(value)); } catch (_) {} }
  function tourWasSeen() { return read('tour', '') === 'complete'; }
  function markTourSeen() { write('tour', 'complete'); }
  function creditGiftWasSeen() { return read('credit-gift', '') === 'complete'; }
  function markCreditGiftSeen() { write('credit-gift', 'complete'); }
  function claimExperience(experience) {
    if (window.__isDemoMode) return Promise.resolve({ claimed:true, demo:true });
    const claimKey=`${experience.id}:${experience.version}`;
    if (experienceClaims.has(claimKey)) return experienceClaims.get(claimKey);
    const claim=window.ICADEMPlatform?.claimExperience;
    if(typeof claim!=='function') return Promise.reject(new Error('La sincronización de experiencias aún no está disponible'));
    const promise=Promise.resolve(claim(experience.id,experience.version))
      .then(result=>{if(!result)throw new Error('El servidor no confirmó la experiencia');return result;})
      .catch(error=>{experienceClaims.delete(claimKey);throw error;});
    experienceClaims.set(claimKey,promise);
    return promise;
  }
  function migrateLocalExperience(name, experience) {
    if (read(name, '') !== 'complete' || window.__isDemoMode) return;
    claimExperience(experience).catch(error=>console.warn(`[ICADEM ${experience.id}] Sincronización pendiente`,error.message));
  }
  function freeCourseDeferredThisSession() {
    try { return sessionStorage.getItem(key('free-course-deferred-session')) === '1'; }
    catch (_) { return false; }
  }
  function deferFreeCourseForSession() {
    try { sessionStorage.setItem(key('free-course-deferred-session'), '1'); }
    catch (_) {}
  }
  function canOfferFreeCourse() {
    const state=window.UserState;
    return Boolean(state && state.modo !== 'vip' && !state.freeCourseId && !freeCourseDeferredThisSession() && (window.__isDemoMode || state.identityReady === true));
  }
  function userReady() { const state=window.UserState; return Boolean(state && state.modo && state.modo !== 'cargando'); }
  function firstName() { return String(window.UserState?.displayName || window.UserState?.nombre || 'colega').trim().split(/\s+/)[0] || 'colega'; }
  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const styles=getComputedStyle(element), rect=element.getBoundingClientRect();
    return styles.display!=='none' && styles.visibility!=='hidden' && rect.width>1 && rect.height>1;
  }
  function firstVisible(selectors) {
    for (const selector of selectors || []) { const match=Array.from(document.querySelectorAll(selector)).find(isVisible); if (match) return match; }
    return null;
  }
  function onMobile() { return window.matchMedia(`(max-width:${MOBILE_BREAKPOINT}px)`).matches; }
  function setMobileDrawer(open) {
    if (!onMobile()) return;
    const drawer=document.getElementById('mobile-drawer'); if (!drawer) return;
    const opened=drawer.classList.contains('is-open');
    if (open && !opened) document.getElementById('mobile-nav-more')?.click();
    if (!open && opened) document.getElementById('mobile-drawer-close')?.click();
  }

  function addStyles() {
    if (document.getElementById('icadem-experience-styles')) return;
    const style=document.createElement('style'); style.id='icadem-experience-styles';
    style.textContent=`
      .ica-tour-root,.ica-experience{position:fixed;inset:0;z-index:2147483000;font-family:'Inter',system-ui,sans-serif}.ica-tour-root[hidden],.ica-experience[hidden]{display:none!important}
      .ica-tour-shade{position:absolute;inset:0;background:transparent}
      .ica-experience__shade{position:absolute;inset:0;background:rgba(5,12,18,.74)}
      .ica-tour-spotlight{position:fixed;z-index:1;border:2px solid #d0a853;border-radius:13px;box-shadow:0 0 0 9999px rgba(5,12,18,.76),0 0 0 4px rgba(208,168,83,.18);pointer-events:none;transition:top .18s ease,left .18s ease,width .18s ease,height .18s ease}
      .ica-tour-card{position:absolute;z-index:3;top:50%;left:50%;width:min(470px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;transform:translate(-50%,-50%);border:1px solid rgba(20,52,72,.18);border-top:4px solid #c79a43;border-radius:18px;background:#fffdfa;color:#142238;box-shadow:0 32px 100px rgba(3,14,23,.42);outline:none}
      .ica-tour-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 26px 8px}.ica-tour-brand{color:#9c6d17;font:800 9px/1.2 'JetBrains Mono',monospace;letter-spacing:1.6px;text-transform:uppercase}.ica-tour-skip{min-height:34px;padding:6px 2px;border:0;color:#69737a;background:transparent;font-size:12px;font-weight:700;cursor:pointer}.ica-tour-skip:hover,.ica-tour-skip:focus-visible{color:#173b56;text-decoration:underline;text-underline-offset:4px;outline:none}
      .ica-tour-body{padding:8px 26px 0}.ica-tour-icon{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 17px;border-radius:19px;color:#fff;background:linear-gradient(145deg,#24536e,#12354b);box-shadow:0 12px 28px rgba(23,59,86,.2);font:800 25px/1 'Plus Jakarta Sans',sans-serif}.ica-tour-card.is-final .ica-tour-icon{background:linear-gradient(145deg,#28ad70,#188c57);box-shadow:0 12px 28px rgba(26,143,89,.24)}
      .ica-tour-title{margin:0 0 8px;color:#111c2e;font:800 24px/1.17 'Plus Jakarta Sans','Inter',sans-serif;letter-spacing:-.65px;text-align:center}.ica-tour-text{max-width:400px;margin:0 auto;color:#5f6a72;font-size:14px;line-height:1.58;text-align:center}.ica-tour-progress{display:flex;align-items:center;gap:12px;margin:22px 0 18px;color:#68737a;font:700 9px/1 'JetBrains Mono',monospace;letter-spacing:.8px;text-transform:uppercase}.ica-tour-track{height:4px;flex:1;overflow:hidden;border-radius:20px;background:#e9e8e3}.ica-tour-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#c79a43,#e3bc64);transition:width .24s ease}
      .ica-tour-actions{display:flex;justify-content:flex-end;gap:9px;padding:0 26px 24px}.ica-tour-btn{min-height:42px;padding:10px 17px;border-radius:11px;border:1px solid #dce0df;font-size:12.5px;font-weight:800;cursor:pointer}.ica-tour-btn:focus-visible{outline:3px solid rgba(199,154,67,.3);outline-offset:2px}.ica-tour-prev{margin-right:auto;color:#58646b;background:#fff}.ica-tour-prev[hidden]{display:none}.ica-tour-next{color:#fff;border-color:#173b56;background:#173b56;box-shadow:0 8px 20px rgba(23,59,86,.18)}.ica-tour-card.is-final .ica-tour-next{border-color:#178b56;background:#178b56}.ica-tour-help{position:relative;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}.ica-tour-profile-btn{display:inline-flex;align-items:center;gap:8px;align-self:flex-start}.ica-tour-profile-btn::before{content:'?';display:grid;place-items:center;width:18px;height:18px;border:1px solid currentColor;border-radius:50%;font-size:12px}
      .ica-experience{display:grid;place-items:center;padding:20px}.ica-experience__dialog{position:relative;z-index:2;width:min(780px,100%);max-height:calc(100dvh - 40px);overflow:auto;border:1px solid rgba(20,52,72,.18);border-top:4px solid #c79a43;border-radius:20px;background:#fffdfa;color:#142238;box-shadow:0 32px 100px rgba(3,14,23,.42)}.ica-experience__head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px 17px;border-bottom:1px solid #e8e7e2}.ica-experience__head span{display:block;margin-bottom:7px;color:#9c6d17;font:800 9px/1 'JetBrains Mono',monospace;letter-spacing:1.5px;text-transform:uppercase}.ica-experience__head h2{margin:0;color:#111c2e;font:800 24px/1.15 'Plus Jakarta Sans',sans-serif;letter-spacing:-.7px}.ica-experience__close{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border:1px solid #dce0df;border-radius:50%;color:#59656c;background:#fff;cursor:pointer;font-size:20px}
      .ica-course-picker__intro{margin:0;padding:18px 24px 4px;color:#5f6a72;font-size:13.5px;line-height:1.55}.ica-course-picker__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 24px}.ica-course-option{display:grid;grid-template-columns:92px minmax(0,1fr);min-width:0;overflow:hidden;border:1px solid #dce2e2;border-radius:15px;background:#fff;text-align:left;cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.ica-course-option:hover,.ica-course-option:focus-visible{transform:translateY(-2px);border-color:#568da2;box-shadow:0 12px 28px rgba(21,55,75,.1);outline:none}.ica-course-option:disabled{opacity:.65;cursor:wait}.ica-course-option img{width:92px;height:100%;min-height:128px;object-fit:cover;background:#eaf1f2}.ica-course-option__copy{display:grid;align-content:center;gap:6px;padding:15px}.ica-course-option__copy em{color:#2c7187;font:800 8px/1.2 'JetBrains Mono',monospace;letter-spacing:1.15px;text-transform:uppercase;font-style:normal}.ica-course-option__copy strong{color:#172438;font:800 14px/1.25 'Plus Jakarta Sans',sans-serif}.ica-course-option__copy small{color:#718087;font-size:10.5px;line-height:1.45}.ica-course-option__copy b{color:#956c1d;font-size:10px}.ica-course-picker__status{min-height:18px;margin:0 24px;color:#a34f3d;font-size:11.5px}.ica-experience__foot{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 24px 22px}.ica-experience__foot p{max-width:440px;margin:0;color:#7a858a;font-size:10.5px;line-height:1.45}.ica-experience__later{min-height:40px;padding:8px 13px;border:1px solid #dce0df;border-radius:10px;color:#5f6a72;background:#fff;font-weight:750;cursor:pointer}
      .ica-install-card{width:min(460px,100%)}.ica-install-body{padding:26px;text-align:center}.ica-install-icon{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 17px;border-radius:19px;color:#fff;background:linear-gradient(145deg,#24536e,#12354b);font-size:28px}.ica-install-body h2{margin:0 0 9px;color:#111c2e;font:800 23px/1.16 'Plus Jakarta Sans',sans-serif}.ica-install-body p{margin:0;color:#647078;font-size:13.5px;line-height:1.6}.ica-install-actions{display:flex;gap:9px;justify-content:center;padding:0 26px 25px}.ica-install-actions button{min-height:43px;padding:10px 17px;border-radius:11px;font-weight:800;cursor:pointer}.ica-install-primary{border:1px solid #173b56;color:#fff;background:#173b56}.ica-install-secondary{border:1px solid #dce0df;color:#5f6a72;background:#fff}
      .ica-credit-gift{position:relative;width:min(470px,100%);overflow:hidden;border:1px solid rgba(237,195,91,.42);border-top:0;background:radial-gradient(110% 70% at 50% 0%,rgba(68,165,194,.38),transparent 62%),linear-gradient(155deg,#123f5c,#0b2d46 70%,#0b2539);color:#fff;text-align:center;box-shadow:0 34px 100px rgba(2,14,23,.52)}
      .ica-credit-gift::before{content:'';position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#e8bd55,#f7dd8b,#e8bd55)}.ica-credit-gift__close{position:absolute;z-index:3;top:13px;right:14px;display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(255,255,255,.14);border-radius:50%;color:#b9ced8;background:rgba(255,255,255,.06);font-size:21px;cursor:pointer}.ica-credit-gift__body{position:relative;padding:34px 30px 20px}.ica-credit-gift__coin{position:relative;display:grid;place-items:center;width:86px;height:86px;margin:0 auto 19px;border-radius:26px;color:#173b56;background:radial-gradient(circle at 28% 20%,#fff7ce,transparent 38%),linear-gradient(145deg,#f8dc82,#d7a932 70%,#bd8620);box-shadow:0 18px 40px rgba(229,180,58,.28),inset 0 1px rgba(255,255,255,.7)}.ica-credit-gift__coin svg{width:38px;height:38px}.ica-credit-gift__coin b{position:absolute;right:-12px;bottom:-6px;padding:6px 9px;border:3px solid #123f5c;border-radius:999px;color:#173b56;background:#fff7d3;font:850 12px/1 'JetBrains Mono',monospace}.ica-credit-gift__kicker{display:block;margin-bottom:9px;color:#efd074;font:800 9px/1 'JetBrains Mono',monospace;letter-spacing:1.6px;text-transform:uppercase}.ica-credit-gift h2{max-width:390px;margin:0 auto 10px;color:#fff;font:800 27px/1.16 'Plus Jakarta Sans',sans-serif;letter-spacing:-.8px}.ica-credit-gift h2 em{color:#f3cf6d;font-style:normal}.ica-credit-gift__body>p{max-width:390px;margin:0 auto;color:#c4d5dc;font-size:13.5px;line-height:1.6}.ica-credit-gift__balance{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:22px 0 0;padding:13px 15px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:rgba(255,255,255,.07);text-align:left}.ica-credit-gift__balance span{color:#a9c0cb;font-size:11px}.ica-credit-gift__balance strong{color:#fff;font:850 21px/1 'JetBrains Mono',monospace}.ica-credit-gift__balance small{font-size:9px;color:#efd074}.ica-credit-gift__actions{display:flex;gap:9px;padding:0 30px 28px}.ica-credit-gift__actions button{min-height:45px;padding:10px 16px;border-radius:11px;font-weight:850;cursor:pointer}.ica-credit-gift__later{flex:0 0 auto;border:1px solid rgba(255,255,255,.18);color:#c6d7de;background:transparent}.ica-credit-gift__cta{flex:1;border:1px solid #fff;color:#123b54;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.18)}
      html[data-theme="night"] .ica-tour-card,html[data-theme="night"] .ica-experience__dialog{border-color:#345363;background:#152631;color:#edf3f5}html[data-theme="night"] .ica-tour-title,html[data-theme="night"] .ica-experience__head h2,html[data-theme="night"] .ica-install-body h2{color:#f0f5f6}html[data-theme="night"] .ica-tour-text,html[data-theme="night"] .ica-course-picker__intro,html[data-theme="night"] .ica-install-body p{color:#b8c5ca}html[data-theme="night"] .ica-course-option{border-color:#34505e;background:#1b303c}html[data-theme="night"] .ica-course-option__copy strong{color:#eff5f6}html[data-theme="night"] .ica-tour-prev,html[data-theme="night"] .ica-experience__later,html[data-theme="night"] .ica-install-secondary,html[data-theme="night"] .ica-experience__close{border-color:#3c5561;color:#c2cdd1;background:#1b303c}
      @media(max-width:720px){.ica-tour-card{width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 24px)}.ica-tour-top{padding:17px 20px 7px}.ica-tour-body{padding:7px 20px 0}.ica-tour-actions{padding:0 20px 20px}.ica-tour-icon{width:56px;height:56px;margin-bottom:14px;border-radius:16px}.ica-tour-title{font-size:21px}.ica-tour-text{font-size:13px}.ica-tour-progress{margin:18px 0 15px}.ica-experience{padding:10px}.ica-experience__dialog{max-height:calc(100dvh - 20px);border-radius:16px}.ica-course-picker__grid{grid-template-columns:1fr;padding:14px 16px}.ica-experience__head{padding:19px 17px 15px}.ica-experience__head h2{font-size:21px}.ica-course-picker__intro{padding:16px 17px 2px}.ica-course-picker__status{margin:0 17px}.ica-experience__foot{align-items:stretch;flex-direction:column;padding:12px 17px 18px}.ica-experience__later{width:100%}.ica-course-option{grid-template-columns:82px minmax(0,1fr)}.ica-course-option img{width:82px;min-height:116px}.ica-course-option__copy{padding:13px}.ica-install-actions{flex-direction:column}.ica-install-actions button{width:100%}.ica-credit-gift__body{padding:30px 20px 18px}.ica-credit-gift h2{font-size:23px}.ica-credit-gift__actions{flex-direction:column-reverse;padding:0 20px 22px}.ica-credit-gift__actions button{width:100%}.ica-credit-gift__balance{align-items:flex-start;flex-direction:column}.ica-credit-gift__balance strong{font-size:19px}}
      @media(max-width:380px){.ica-tour-brand{max-width:210px}.ica-tour-actions{gap:6px}.ica-tour-btn{padding:9px 12px}.ica-course-option__copy small{display:none}}@media(prefers-reduced-motion:reduce){.ica-tour-spotlight,.ica-tour-track span,.ica-course-option{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function createRoot() {
    if (root) return;
    root=document.createElement('div'); root.className='ica-tour-root'; root.hidden=true;
    root.innerHTML=`<div class="ica-tour-shade" aria-hidden="true"></div><div class="ica-tour-spotlight" aria-hidden="true"></div><section class="ica-tour-card" role="dialog" aria-modal="true" aria-labelledby="ica-tour-title" aria-describedby="ica-tour-text" tabindex="-1"><div class="ica-tour-top"><div class="ica-tour-brand">Recorrido ICADEM</div><button class="ica-tour-skip" type="button" data-tour-action="skip">Omitir</button></div><div class="ica-tour-body"><div class="ica-tour-icon" aria-hidden="true"></div><h2 class="ica-tour-title" id="ica-tour-title"></h2><p class="ica-tour-text" id="ica-tour-text"></p><div class="ica-tour-progress" aria-live="polite"><div class="ica-tour-track" aria-hidden="true"><span></span></div><span data-tour-count></span></div></div><div class="ica-tour-actions"><button class="ica-tour-btn ica-tour-prev" type="button" data-tour-action="prev">Anterior</button><button class="ica-tour-btn ica-tour-next" type="button" data-tour-action="next">Siguiente</button></div></section>`;
    document.body.appendChild(root); spotlight=root.querySelector('.ica-tour-spotlight'); card=root.querySelector('.ica-tour-card');
    root.addEventListener('click',event=>{ const action=event.target.closest('[data-tour-action]')?.dataset.tourAction; if(action==='skip')stop('skip'); if(action==='prev')go(stepIndex-1); if(action==='next')stepIndex===steps.length-1?stop('finish'):go(stepIndex+1); });
  }
  function placeSpotlight() {
    if(!running||!spotlight)return; const shade=root.querySelector('.ica-tour-shade');
    if(!currentTarget||!isVisible(currentTarget)){spotlight.style.display='none';shade.style.background='rgba(5,12,18,.72)';return;}
    shade.style.background='transparent'; const raw=currentTarget.getBoundingClientRect(),pad=7; spotlight.style.display='block'; spotlight.style.left=Math.max(5,raw.left-pad)+'px'; spotlight.style.top=Math.max(5,raw.top-pad)+'px'; spotlight.style.width=Math.min(innerWidth-10,raw.width+pad*2)+'px'; spotlight.style.height=Math.min(innerHeight-10,raw.height+pad*2)+'px';
  }
  function go(nextIndex) {
    if(!running)return; stepIndex=Math.max(0,Math.min(steps.length-1,nextIndex)); const token=++renderToken,step=steps[stepIndex]; setMobileDrawer(Boolean(step.mobileDrawer));
    setTimeout(()=>{if(!running||token!==renderToken)return;currentTarget=firstVisible(step.selectors);const title=typeof step.title==='function'?step.title(firstName()):step.title;card.classList.toggle('is-final',Boolean(step.final));card.querySelector('.ica-tour-icon').textContent=step.icon;card.querySelector('#ica-tour-title').textContent=title;card.querySelector('#ica-tour-text').textContent=step.text;card.querySelector('[data-tour-count]').textContent=`${stepIndex+1} de ${steps.length}`;card.querySelector('.ica-tour-track span').style.width=`${((stepIndex+1)/steps.length)*100}%`;card.querySelector('[data-tour-action="prev"]').hidden=stepIndex===0;card.querySelector('[data-tour-action="next"]').textContent=step.final?'Finalizar':'Siguiente';placeSpotlight();},onMobile()?180:20);
  }
  function focusables(){return Array.from(card.querySelectorAll('button:not([hidden]):not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(isVisible);}
  function onKeydown(event){if(!running)return;if(event.key==='Escape'){event.preventDefault();stop('skip');return;}if(event.key==='ArrowRight'){event.preventDefault();stepIndex===steps.length-1?stop('finish'):go(stepIndex+1);return;}if(event.key==='ArrowLeft'){event.preventDefault();go(stepIndex-1);return;}if(event.key!=='Tab')return;const nodes=focusables();if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  async function start(options){options=options||{};if(running)return'already-running';if(!options.force){if(tourWasSeen()){migrateLocalExperience('tour',TOUR_EXPERIENCE);return'seen';}let claim;try{claim=await claimExperience(TOUR_EXPERIENCE);}catch(error){console.warn('[ICADEM panel tour]',error.message);return'unavailable';}markTourSeen();if(claim?.claimed!==true)return'seen';}window.navigateToSection?.('inicio');previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';running=true;root.hidden=false;document.documentElement.classList.add('ica-tour-active');document.addEventListener('keydown',onKeydown);window.addEventListener('resize',placeSpotlight);window.addEventListener('scroll',placeSpotlight,true);go(0);setTimeout(()=>card?.focus(),80);return new Promise(resolve=>{resolveTour=resolve;});}
  function stop(reason){if(!running)return;running=false;renderToken+=1;markTourSeen();setMobileDrawer(false);root.hidden=true;document.body.style.overflow=previousOverflow;document.documentElement.classList.remove('ica-tour-active');document.removeEventListener('keydown',onKeydown);window.removeEventListener('resize',placeSpotlight);window.removeEventListener('scroll',placeSpotlight,true);currentTarget=null;if(previousFocus&&previousFocus.isConnected)previousFocus.focus();document.dispatchEvent(new CustomEvent('icadem:tour-ended',{detail:{reason}}));const done=resolveTour;resolveTour=null;done?.(reason);}

  function installEntryPoints(){const topbar=document.querySelector('.topbar__right');if(topbar&&!document.getElementById('icadem-tour-help')){const button=document.createElement('button');button.id='icadem-tour-help';button.className='icon-btn ica-tour-help';button.type='button';button.textContent='?';button.title='Recorrido por ICADEM';button.setAttribute('aria-label','Repetir recorrido guiado');button.addEventListener('click',()=>Experience.enqueue('tour',{force:true},{priority:1000,unique:false}));topbar.insertBefore(button,topbar.firstChild);}const profile=document.querySelector('.perfil-hero');if(profile&&!document.getElementById('icadem-tour-profile')){const button=document.createElement('button');button.id='icadem-tour-profile';button.className='btn btn--ghost ica-tour-profile-btn';button.type='button';button.textContent='Repetir recorrido';button.addEventListener('click',()=>Experience.enqueue('tour',{force:true},{priority:1000,unique:false}));profile.appendChild(button);}}
  function blockingDialogOpen(){
    const selectors = [
      '#splash-bienvenida','#name-modal','#icadem-credit-gift',
      '.modal-backdrop.is-open','.paywall-modal.is-open','.credit-wallet-modal',
      '.learning-game','.practice-picker--v3','#tpl-modal-overlay.tpl-modal-visible',
      '.mobile-drawer.is-open','#visorOverlay','#foro-lightbox','#cf-modal',
      '#splash-completado','#cancel-success-splash','#cancel-sub-modal'
    ].join(',');
    return Array.from(document.querySelectorAll(selectors)).some(element => {
      if (element.hidden) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }
  function waitForGone(selector){return new Promise(resolve=>{let observed=false;const observer=new MutationObserver(()=>{if(document.querySelector(selector))observed=true;if(observed&&!document.querySelector(selector)){observer.disconnect();resolve();}});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});if(document.querySelector(selector))observed=true;setTimeout(()=>{if(!observed){observer.disconnect();resolve();}},700);});}
  function visitCount(){const sessionKey=key('visit-session');try{if(!sessionStorage.getItem(sessionKey)){const next=Number(read('visits','0'))+1;write('visits',next);sessionStorage.setItem(sessionKey,'1');return next;}}catch(_){}return Number(read('visits','1'))||1;}

  async function openFreeCourseChooser(){
    if(!canOfferFreeCourse())return'not-needed';let courses=[];try{courses=await window.__getCursosGratisICADEM?.();}catch(_){}if(!Array.isArray(courses)||!courses.length)return'unavailable';
    return new Promise(resolve=>{const modal=document.createElement('div');modal.className='ica-experience ica-course-picker';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ica-free-course-title');modal.innerHTML=`<div class="ica-experience__shade"></div><section class="ica-experience__dialog"><header class="ica-experience__head"><div><span>Tu primera ruta</span><h2 id="ica-free-course-title">Elige dónde quieres empezar</h2></div><button class="ica-experience__close" type="button" aria-label="Elegir después">×</button></header><p class="ica-course-picker__intro">El curso que elijas guardará <strong>sus primeras 4 clases y el primer material gratis</strong> en tu cuenta. Esta elección se realiza una sola vez.</p><div class="ica-course-picker__grid">${courses.slice(0,8).map(course=>`<button type="button" class="ica-course-option" data-free-course="${esc(course.id)}"><img src="${esc(course.portada)}" alt="" loading="lazy"><span class="ica-course-option__copy"><em>${esc(course.area)}</em><strong>${esc(course.titulo)}</strong><small>${esc(course.descripcion||`${course.sesiones} clases disponibles`)}</small><b>Elegir este curso →</b></span></button>`).join('')}</div><p class="ica-course-picker__status" aria-live="polite"></p><footer class="ica-experience__foot"><p>Podrás activar la membresía cuando quieras para abrir el programa completo y los cursos siguientes.</p><button class="ica-experience__later" type="button">Elegir después</button></footer></section>`;document.body.appendChild(modal);const previous=document.activeElement,savedOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const close=result=>{modal.remove();document.body.style.overflow=savedOverflow;previous?.isConnected&&previous.focus();resolve(result);};const later=()=>{deferFreeCourseForSession();close('deferred');};modal.querySelector('.ica-experience__close').addEventListener('click',later);modal.querySelector('.ica-experience__later').addEventListener('click',later);modal.querySelectorAll('[data-free-course]').forEach(button=>button.addEventListener('click',async()=>{const status=modal.querySelector('.ica-course-picker__status');modal.querySelectorAll('button').forEach(item=>{item.disabled=true;});status.textContent='Guardando tu elección…';try{const result=await window.ICADEMPlatform?.selectFreeCourse(button.dataset.freeCourse);if(!result?.courseId)throw new Error('No pudimos confirmar el curso.');window.UserState.freeCourseId=result.courseId;window.UserState.freeCourseOfferSeen=true;write('free-course-selected',result.courseId);write('free-course-offer-seen','complete');await window.__reloadCourseCatalog?.();window.Toast?.success?.('Curso gratuito guardado','Ya puedes comenzar sus primeras 4 clases');close('selected');setTimeout(()=>window.navigateToSection?.('cursos'),80);}catch(error){status.textContent=error.message||'No pudimos guardar tu elección. Intenta nuevamente.';modal.querySelectorAll('button').forEach(item=>{item.disabled=false;});}}));modal.querySelector('[data-free-course]')?.focus();});
  }

  async function openWelcomeCreditGift(){
    if(creditGiftWasSeen()){migrateLocalExperience('credit-gift',CREDIT_EXPERIENCE);return'seen';}
    if(document.getElementById('icadem-credit-gift'))return'seen';
    if(window.UserState?.modo==='invitado')return'not-available';
    let wallet;
    try{wallet=await window.ICADEMPlatform?.loadCreditWallet?.(true);}catch(error){console.warn('[ICADEM welcome credits]',error);return'unavailable';}
    if(!wallet)return'unavailable';
    const welcomeRule=(wallet.earnRules||[]).find(rule=>rule.id==='welcome');
    const welcomeMovement=(wallet.recentMovements||[]).find(item=>item.type==='welcome-bonus');
    const amount=Math.max(0,Number(welcomeMovement?.amount||welcomeRule?.amount||(window.__isDemoMode?200:0))||0);
    const balance=Math.max(0,Number(wallet.credits?.balance)||0);
    if(!amount)return'unavailable';
    let claim;
    try{claim=await claimExperience(CREDIT_EXPERIENCE);}catch(error){console.warn('[ICADEM welcome credits claim]',error.message);return'unavailable';}
    markCreditGiftSeen();
    if(claim?.claimed!==true)return'seen';
    return new Promise(resolve=>{
      const modal=document.createElement('div');
      modal.id='icadem-credit-gift';modal.className='ica-experience';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','icadem-credit-gift-title');
      modal.innerHTML=`<div class="ica-experience__shade" data-credit-gift-close></div><section class="ica-experience__dialog ica-credit-gift"><button class="ica-credit-gift__close" type="button" aria-label="Cerrar aviso" data-credit-gift-close>×</button><div class="ica-credit-gift__body"><div class="ica-credit-gift__coin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 8 12 8s2.5-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg><b>+${amount.toLocaleString('es-MX')}</b></div><span class="ica-credit-gift__kicker">Regalo de bienvenida</span><h2 id="icadem-credit-gift-title">¡Recibiste <em>${amount.toLocaleString('es-MX')} créditos</em> de bienvenida!</h2><p>Este fue tu regalo único por unirte a ICADEM. Ya está incluido en tu saldo y puedes sumar más al completar retos y juegos para canjear materiales prácticos desde tus primeros créditos.</p><div class="ica-credit-gift__balance"><span>Tu saldo actual</span><strong>${balance.toLocaleString('es-MX')} <small>créditos</small></strong></div></div><div class="ica-credit-gift__actions"><button class="ica-credit-gift__later" type="button" data-credit-gift-close>Más tarde</button><button class="ica-credit-gift__cta" type="button">Ver materiales para canjear →</button></div></section>`;
      const previous=document.activeElement,savedOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.body.appendChild(modal);
      let closed=false;
      const onKey=event=>{if(event.key==='Escape'){event.preventDefault();close('later');}};
      const close=result=>{if(closed)return;closed=true;document.removeEventListener('keydown',onKey,true);modal.remove();document.body.style.overflow=savedOverflow;previous?.isConnected&&previous.focus();resolve(result);};
      modal.querySelectorAll('[data-credit-gift-close]').forEach(button=>button.addEventListener('click',()=>close('later')));
      modal.querySelector('.ica-credit-gift__cta').addEventListener('click',()=>{close('materials');setTimeout(()=>window.navigateToSection?.('materiales'),80);});
      document.addEventListener('keydown',onKey,true);setTimeout(()=>modal.querySelector('.ica-credit-gift__cta')?.focus(),80);
    });
  }

  function openInstallInvitation(){const installButton=document.getElementById('install-app-btn');if(!installButton||installButton.hidden||read('install-invited','')==='1')return Promise.resolve('not-available');return new Promise(resolve=>{const modal=document.createElement('div');modal.className='ica-experience';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.innerHTML=`<div class="ica-experience__shade"></div><section class="ica-experience__dialog ica-install-card"><div class="ica-install-body"><div class="ica-install-icon" aria-hidden="true">⇩</div><h2>Ten ICADEM siempre a la mano</h2><p>Instala el panel en tu teléfono o tableta para entrar más rápido, con una experiencia limpia y sin la barra del navegador.</p></div><div class="ica-install-actions"><button class="ica-install-secondary" type="button">Ahora no</button><button class="ica-install-primary" type="button">Instalar ICADEM</button></div></section>`;document.body.appendChild(modal);const close=result=>{write('install-invited','1');modal.remove();resolve(result);};modal.querySelector('.ica-install-secondary').addEventListener('click',()=>close('later'));modal.querySelector('.ica-install-primary').addEventListener('click',()=>{installButton.click();close('install');});modal.querySelector('.ica-install-primary').focus();});}

  const Experience=(()=>{
    const queue=[];
    let busy=false,activeId='',sequence=0;
    const priorities={'membership-welcome':120,tour:100,'credit-gift':90,'free-course':80,'profile-name':50,install:30};
    const retryDelays=[1200,3000,7000,15000];
    function enqueue(id,payload,options){
      options=options||{};
      const unique=options.unique!==false;
      if(unique&&(activeId===id||queue.some(item=>item.id===id)))return;
      queue.push({id,payload:payload||{},priority:options.priority??priorities[id]??10,sequence:sequence++});
      queue.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);
      pump();
    }
    function retry(job){
      const attempt=Number(job.payload?.retryAttempt||0);
      if(attempt>=retryDelays.length)return;
      setTimeout(()=>enqueue(job.id,{...job.payload,retryAttempt:attempt+1}),retryDelays[attempt]);
    }
    async function run(job){
      if(job.id==='membership-welcome'){
        if(typeof window.__showWelcomeSplash!=='function')return;
        let payload=job.payload||{};
        if(payload.fromNotif&&!window.__isDemoMode){
          const claim=window.ICADEMPlatform?.markMembershipWelcomeSeen;
          if(typeof claim!=='function'){retry(job);return;}
          let result;
          try{result=await claim();}
          catch(error){console.warn('[ICADEM bienvenida claim]',error.message);retry(job);return;}
          if(result?.marked!==true)return;
          payload={...payload,fromNotif:false,serverClaimed:true};
        }
        window.__showWelcomeSplash(payload);
        await waitForGone('#splash-bienvenida');
        return;
      }
      if(job.id==='tour'){
        const result=await start({force:job.payload.force===true});
        if(result==='unavailable'){if(job.payload.force!==true)retry(job);return;}
        if(!creditGiftWasSeen())enqueue('credit-gift');
        if(canOfferFreeCourse())enqueue('free-course');
        return;
      }
      if(job.id==='credit-gift'){
        if(!tourWasSeen())return;
        const result=await openWelcomeCreditGift();
        if(result==='unavailable')retry(job);
        return;
      }
      if(job.id==='free-course'){if(!tourWasSeen())return;await openFreeCourseChooser();return;}
      if(job.id==='profile-name'){
        if(!tourWasSeen()||visitCount()<2)return;
        if(window.UserState?.modo!=='vip'&&!window.UserState?.freeCourseId)return;
        window.__maybeAskName?.();
        await waitForGone('#name-modal');
        return;
      }
      if(job.id==='install'){if(!tourWasSeen()||visitCount()<3)return;await openInstallInvitation();}
    }
    async function pump(){
      if(busy||!userReady()||!queue.length)return;
      if(blockingDialogOpen()){setTimeout(pump,400);return;}
      busy=true;
      const job=queue.shift();
      activeId=job.id;
      try{await run(job);}
      catch(error){console.warn('[ICADEM experience]',job.id,error);}
      finally{activeId='';busy=false;setTimeout(pump,500);}
    }
    return{enqueue,pump};
  })();
  let scheduleTimer=0;
  function scheduleAutomatic(){if(scheduleTimer){clearTimeout(scheduleTimer);scheduleTimer=0;}if(!userReady()||(!window.__isDemoMode&&window.UserState?.identityReady!==true)){scheduleTimer=setTimeout(scheduleAutomatic,250);return;}visitCount();if(tourWasSeen())migrateLocalExperience('tour',TOUR_EXPERIENCE);else Experience.enqueue('tour');if(creditGiftWasSeen())migrateLocalExperience('credit-gift',CREDIT_EXPERIENCE);else if(tourWasSeen())Experience.enqueue('credit-gift');if(tourWasSeen()&&canOfferFreeCourse())Experience.enqueue('free-course');Experience.enqueue('profile-name');if(document.getElementById('install-app-btn')?.hidden===false)Experience.enqueue('install');Experience.pump();}
  function init(){addStyles();createRoot();installEntryPoints();const dynamic=document.getElementById('dynamic-section');if(dynamic)new MutationObserver(installEntryPoints).observe(dynamic,{childList:true,subtree:true});const pending=Array.isArray(window.__icademExperiencePending)?window.__icademExperiencePending.splice(0):[];window.__scheduleExperience=(id,payload)=>Experience.enqueue(id,payload);pending.forEach(item=>Experience.enqueue(item.id,item.payload));window.IcademGuidedTour={start:()=>Experience.enqueue('tour',{force:true},{priority:1000,unique:false}),stop};window.ICADEMExperience=Experience;document.addEventListener('icadem:user-ready',scheduleAutomatic);document.addEventListener('icadem:identity-ready',event=>{const profile=event.detail?.profile||{};window.UserState.identityReady=true;if(profile.freeCourseId)window.UserState.freeCourseId=profile.freeCourseId;if(profile.freeCourseOfferSeen===true)window.UserState.freeCourseOfferSeen=true;scheduleAutomatic();});document.addEventListener('icadem:install-available',()=>Experience.enqueue('install'));setTimeout(scheduleAutomatic,650);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
