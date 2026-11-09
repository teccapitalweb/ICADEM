/* ICADEM Embajadores · experiencia del miembro. Los importes siempre vienen
   del backend; este archivo no calcula ni escribe saldos directamente. */
(function(){
  'use strict';

  var REF_KEY='icadem:ambassador:ref';
  var cache=null;
  var cacheAt=0;
  var activeView='dashboard';
  var sessionGeneration=0;
  var shownCelebrations=new Set();

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function money(cents){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0,maximumFractionDigits:2}).format((Number(cents)||0)/100);}
  function date(value){if(!value)return '—';var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});}
  function request(path,options){if(!window.ICADEMPlatform?.request)return Promise.reject(new Error('Tu sesión todavía no está lista.'));return window.ICADEMPlatform.request(path,options||{});}
  function toast(type,title,message){if(window.Toast?.[type])window.Toast[type](title,message);}
  function statusLabel(status){return({registered:'Registrado sin compra',purchase_confirmed:'Compra confirmada',purchase_not_eligible:'Compra no elegible',pending:'En validación',available:'Disponible',paid:'Pagado',reversed:'Revertida',ineligible:'No elegible',approved:'Aprobado',rejected:'Rechazado'}[status]||status||'Registrado');}
  function count(value){return value!==undefined&&value!==null&&Number.isFinite(Number(value))&&Number(value)>=0?Math.floor(Number(value)):null;}
  function number(value){var result=count(value);return result===null?'—':new Intl.NumberFormat('es-MX').format(result);}
  function emoji(code){return String.fromCodePoint.apply(String,code.split('-').map(function(part){return parseInt(part,16);}));}
  function invitationUrl(ambassador){
    // A text-only sharing page keeps the referral code in the URL and avoids
    // Facebook's cached large photo on the sign-in page.
    var code=String(ambassador.code||'').trim().toUpperCase();
    return /^[A-Z0-9]{3,8}-[A-Z0-9]{4,8}$/.test(code)?'https://www.icademx.com/invitacion.html?ref='+encodeURIComponent(code):String(ambassador.referralUrl||'');
  }
  function shareMessage(ambassador,withEmoji){
    var decorate=function(code){return withEmoji===false?'':emoji(code)+' ';};
    return decorate('1F929-1F496')+'¡Te invito a conocer ICADEM!\n\nCursos de diferentes especialidades, clases, materiales de estudio y certificados digitales para seguir creciendo profesionalmente.\n\n'+decorate('1F381-1F49D')+'Usa mi código y recibe un descuento en el primer pago de tu membresía mensual o anual.\n\nCódigo de invitación: '+String(ambassador.code||'')+'\nActiva tu beneficio: '+invitationUrl(ambassador)+'\n\n'+decorate('1F973-1F389')+'¡Da el siguiente paso en tu desarrollo profesional!';
  }
  function isMobileShare(){return navigator.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1);}
  function captureRef(){try{var code=String(new URLSearchParams(location.search).get('ref')||'').trim().toUpperCase();if(/^[A-Z0-9]{3,8}-[A-Z0-9]{4,8}$/.test(code)){localStorage.setItem(REF_KEY,JSON.stringify({code:code,capturedAt:Date.now()}));window.ICADEMReferral?.captureVisit(code);}}catch(_){}}
  async function claimStoredRef(){
    try{
      var saved=JSON.parse(localStorage.getItem(REF_KEY)||'null');
      if(!saved?.code||Date.now()-Number(saved.capturedAt||0)>30*86400000){if(saved)localStorage.removeItem(REF_KEY);return;}
      await request('/api/ambassadors/attribute',{method:'POST',body:{code:saved.code,source:'member-panel',visitorId:window.ICADEMReferral?.visitorId()||undefined}});
      localStorage.removeItem(REF_KEY);
    }catch(error){if([400,404,409].includes(error.status))localStorage.removeItem(REF_KEY);}
  }

  async function load(force){
    if(!force&&cache&&Date.now()-cacheAt<15000)return cache;
    var generation=sessionGeneration,data=await request('/api/ambassadors/me');
    if(generation!==sessionGeneration)throw new Error('La sesión cambió. Vuelve a abrir el panel para actualizar tus datos.');
    cache=data;cacheAt=Date.now();return cache;
  }

  function setMemberNav(visible){document.querySelectorAll('#nav-ambassadors,#drawer-nav-ambassadors').forEach(function(item){item.hidden=!visible;});}
  async function syncMemberNav(){if(window.__isDemoMode)return;try{var data=await load();setMemberNav(Boolean(data.registered));}catch(_){}}

  function loading(root){root.innerHTML='<div class="amb-loading"><div><div class="amb-loading__spin"></div><strong>Sincronizando ICADEM Embajadores…</strong></div></div>';}

  function enrollMarkup(data){
    var c=data.config||{},vip=data.category==='vip',commission=vip?c.directCommissionVipCents:c.directCommissionFreeCents,monthly=vip?c.monthlyDiscountVipCents:c.monthlyDiscountFreeCents,annual=vip?c.annualDiscountVipCents:c.annualDiscountFreeCents;
    return '<div class="amb-shell fade-up"><div class="sec-hero"><button class="amb-back" type="button" data-amb-back aria-label="Volver a la sección anterior"><span aria-hidden="true">←</span> Volver</button><span class="sec-hero__eyebrow">Programa de referidos</span><h1 class="sec-hero__title">ICADEM Embajadores</h1><p class="sec-hero__sub">Comparte ICADEM y recibe una comisión por cada nueva membresía elegible y confirmada.</p></div><div class="amb-enroll">'+
      '<section class="amb-enroll__lead"><div class="amb-hero__eyebrow">PROGRAMA ICADEM EMBAJADORES · '+(vip?'VIP':'GRATUITO')+'</div><h2>Recomienda ICADEM y gana '+money(commission)+' MXN</h2><p>Por cada primera compra elegible confirmada. Tu invitado ahorra '+money(monthly)+' MXN en el plan mensual o '+money(annual)+' MXN en el anual, solo en su primer pago. La comisión tiene '+esc(c.validationDays)+' días de validación.</p><div class="amb-steps">'+
      '<div class="amb-step"><span>01</span><div><strong>Obtén tu código</strong><small>Generaremos un código y enlace exclusivos vinculados a tu cuenta.</small></div></div>'+
      '<div class="amb-step"><span>02</span><div><strong>Comparte tu enlace</strong><small>La atribución se conserva hasta '+esc(c.attributionDays)+' días y se valida en el servidor.</small></div></div>'+
      '<div class="amb-step"><span>03</span><div><strong>Compra confirmada</strong><small>Solo la primera compra elegible genera comisión; las renovaciones no cuentan.</small></div></div>'+
      '<div class="amb-step"><span>04</span><div><strong>Solicita tu retiro</strong><small>Después de la validación, podrás solicitar una transferencia bancaria manual.</small></div></div></div></section>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Activar mi perfil</h3><p>Disponible también para cuentas gratuitas.</p></div></div><div class="amb-card__body"><form class="amb-form" data-amb-enroll><div class="amb-note">La compra debe ser inicial, pertenecer a un plan elegible y alcanzar el mínimo vigente de '+money(c.minimumPaidCents)+'. Reembolsos y contracargos revierten la comisión.</div><div class="amb-agreements"><label><input type="checkbox" name="terms" required><span>Acepto los términos del Programa ICADEM Embajadores, versión '+esc(c.termsVersion)+'.</span></label><label><input type="checkbox" name="privacy" required><span>Acepto el tratamiento de mis datos conforme al aviso de privacidad, incluidos los datos bancarios cifrados que decida registrar.</span></label></div><button class="amb-btn" type="submit">Quiero ser embajador →</button></form></div></section></div></div>';
  }

  function referralsRows(items){
    if(!items?.length)return '<tr><td colspan="5" class="amb-empty-row">Aún no hay referidos atribuidos a tu código.</td></tr>';
    return items.map(function(item){return '<tr><td><strong>'+esc(item.buyer)+'</strong></td><td>'+date(item.registeredAt)+'</td><td><span class="amb-status amb-status--'+esc(item.status)+'">'+esc(statusLabel(item.status))+'</span></td><td>'+money(item.commissionCents)+'</td><td>'+date(item.releaseAt)+'</td></tr>';}).join('');
  }

  function commissionRows(items){
    if(!items?.length)return '<tr><td colspan="6" class="amb-empty-row">Las compras elegibles aparecerán aquí después de la confirmación de Stripe.</td></tr>';
    return items.map(function(item){return '<tr><td><strong>'+esc(item.buyer)+'</strong></td><td>'+esc(String(item.plan||'—').toUpperCase())+'</td><td>'+money(item.amountPaidCents)+'</td><td>'+money(item.commissionCents)+'</td><td><span class="amb-status amb-status--'+esc(item.status)+'">'+esc(statusLabel(item.status))+'</span></td><td>'+date(item.paidAt)+'</td></tr>';}).join('');
  }

  function withdrawalsMarkup(items){
    if(!items?.length)return '<div class="amb-note">Todavía no has solicitado transferencias.</div>';
    return '<div class="amb-history">'+items.map(function(item){return '<div class="amb-history__item"><div><strong>'+money(item.amountCents)+' · '+esc(statusLabel(item.status))+'</strong><small>'+date(item.requestedAt)+' · '+esc(item.bank||'Banco')+' •••• '+esc(item.bankLast4||'—')+'</small></div>'+(item.receiptUrl?'<a class="amb-btn amb-btn--ghost" style="min-height:34px;display:inline-flex;align-items:center" href="'+esc(item.receiptUrl)+'" target="_blank" rel="noopener">Comprobante</a>':'')+'</div>';}).join('')+'</div>';
  }

  function analyticsMarkup(data){
    var stats=data.analytics||{},visits=count(stats.uniqueVisits),registered=count(stats.registeredVisitors),paid=count(stats.paidVisitors),unpaid=count(stats.visitorsWithoutPurchase);
    var ready=visits!==null&&paid!==null&&unpaid!==null,hasVisits=ready&&visits>0;
    var percent=hasVisits?Math.min(100,Math.max(0,paid/visits*100)):0;
    var rate=hasVisits?new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(percent)+'%':'—';
    var steps=[{label:'Visitas a tu enlace',value:visits,className:'visits'},{label:'Personas registradas',value:registered,className:'registered'},{label:'Compras VIP confirmadas',value:paid,className:'paid'}];
    var max=Math.max.apply(null,steps.map(function(step){return step.value||0;}));
    return '<section class="amb-card"><div class="amb-card__head"><div><h3>El alcance de tus invitaciones</h3><p>De la primera visita a una nueva membresía VIP.</p></div><span class="amb-metric-tag">Datos reales</span></div><div class="amb-card__body"><div class="amb-analytics">'+
      '<div class="amb-donut-group"><div class="amb-donut '+(!hasVisits?'amb-donut--empty':'')+'" style="--amb-conversion:'+percent.toFixed(3)+'%" role="img" aria-label="'+esc(hasVisits?number(paid)+' visitas con compra y '+number(unpaid)+' sin compra confirmada. Conversión: '+rate:ready?'Aún no hay visitas registradas.':'Las estadísticas todavía no están disponibles.')+'"><div class="amb-donut__center"><strong>'+rate+'</strong><span>Conversión a VIP</span></div></div><div class="amb-chart-legend"><span><i class="amb-dot amb-dot--paid"></i>Con compra <strong>'+number(paid)+'</strong></span><span><i class="amb-dot amb-dot--visits"></i>Sin compra <strong>'+number(unpaid)+'</strong></span></div></div>'+
      '<div class="amb-funnel">'+steps.map(function(step){var width=max&&step.value!==null?Math.max(0,Math.min(100,step.value/max*100)):0;return '<div class="amb-funnel__step"><div><span>'+step.label+'</span><strong>'+number(step.value)+'</strong></div><div class="amb-funnel__track"><span class="amb-funnel__fill amb-funnel__fill--'+step.className+'" style="width:'+width.toFixed(3)+'%"></span></div></div>';}).join('')+'<p class="amb-analytics__caption">'+(hasVisits?'Cada visita única corresponde a un navegador; una misma persona puede usar varios dispositivos.':ready?'Tu gráfica comenzará a crecer cuando alguien abra tu enlace.':'Estamos preparando las estadísticas de tu enlace; actualiza el panel en unos momentos.')+'</p></div></div><div class="amb-analytics__foot">'+(stats.since?'Medición desde '+date(stats.since)+'. ':'La medición comienza al activar estas estadísticas. ')+'No incluye visitas anteriores. Las visitas anónimas se muestran como totales, sin nombres ni datos personales. Los registros hechos únicamente con el código pueden no tener una visita asociada.</div></div></section>';
  }

  function shareMarkup(ambassador){
    return '<section class="amb-card amb-sharing" data-amb-sharing><div class="amb-card__head"><div><h3>Invita a conocer ICADEM</h3><p>Tu invitación incluye un mensaje breve, tu código y el enlace para activar el beneficio.</p></div></div><div class="amb-card__body"><div class="amb-share-actions"><button class="amb-btn amb-btn--whatsapp" type="button" data-amb-social="whatsapp">WhatsApp ↗</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="facebook">Facebook · copiar y abrir ↗</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="messenger">Messenger</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="instagram">Instagram</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="native">Más opciones</button></div><p class="amb-share-help">Facebook: el botón copia tu texto y abre la publicación. Pégalo en «¿Qué estás pensando?» antes de publicar.</p><details class="amb-message"><summary>Ver mensaje listo para compartir</summary><textarea class="amb-message__preview" aria-label="Mensaje de invitación con tu código y enlace" readonly>'+esc(shareMessage(ambassador))+'</textarea><button type="button" class="amb-btn amb-btn--ghost" data-amb-copy-message>Copiar mensaje completo</button></details><p class="amb-share-help" data-amb-share-help aria-live="polite">En el móvil, elige WhatsApp, Messenger o Instagram en el menú para compartir. También puedes copiar y pegar el mensaje.</p></div></section>';
  }

  function profileMarkup(ambassador){
    return '<section class="amb-card amb-contact"><div class="amb-card__body"><div class="amb-contact__intro"><div><h3>WhatsApp de contacto</h3><p>Solo administración usará este número para gestionar tus transferencias.</p></div></div><form class="amb-form amb-profile-form" data-amb-whatsapp><div class="amb-field"><label for="amb-whatsapp">Número con código de país</label><input id="amb-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" pattern="[+][1-9][0-9]{7,14}" title="Escribe el signo + y de 8 a 15 dígitos, por ejemplo +5212381479821" placeholder="+5212381479821" value="'+esc(ambassador.whatsapp||'')+'" required></div><button class="amb-btn" type="submit">Guardar número</button></form></div></section>';
  }

  function networkMarkup(network){
    var people=network?.directAmbassadors||[],generations=network?.generations||[];
    return '<section class="amb-card"><div class="amb-card__head"><div><h3>Mi red de embajadores</h3><p>Personas que activaron su perfil después de llegar con tu invitación.</p></div><span class="amb-metric-tag">'+number(people.length)+' directos</span></div><div class="amb-card__body">'+(people.length?'<div class="amb-network-list">'+people.map(function(person){return '<div><strong>'+esc(person.code)+'</strong><span>'+(person.active?'Perfil activo':'Perfil en pausa')+'</span></div>';}).join('')+'</div>':'<div class="amb-note">Tu red aparecerá cuando una persona invitada active su propio perfil de embajador.</div>')+(generations.length?'<div class="amb-network-generations">'+generations.filter(function(g){return g.ambassadors>0;}).map(function(g){return '<span>Generación '+esc(g.level)+': <strong>'+number(g.ambassadors)+'</strong></span>';}).join('')+'</div>':'')+'<p class="amb-share-help">Las comisiones indirectas todavía no están habilitadas. Activar un perfil no genera comisión; solo las compras válidas producen la comisión directa vigente.'+(network?.partial?' El recuento de generaciones puede estar incompleto; consulta a soporte para una revisión.':'')+'</p></div></section>';
  }

  function freeUpgradeMarkup(){
    return '<section class="amb-upgrade"><div><small>BENEFICIOS VIP</small><h3>Amplía tus beneficios al hacerte VIP</h3><p>Una membresía VIP activa aumenta tu comisión directa y el descuento para tus invitados. Tu código y tu historial permanecen contigo.</p></div><button class="amb-btn amb-btn--ghost" type="button" data-amb-upgrade>Conocer beneficios VIP →</button></section>';
  }

  function vipPerformanceMarkup(data){
    var today=new Date(),months=[],items=(data.commissions||[]).filter(function(item){return ['pending','available','paid'].includes(item.status)&&item.paidAt;});
    for(var i=5;i>=0;i--){var d=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-i,1)),key=d.toISOString().slice(0,7);months.push({key:key,label:d.toLocaleDateString('es-MX',{month:'short',timeZone:'UTC'}),count:items.filter(function(item){return String(item.paidAt).slice(0,7)===key;}).length});}
    var max=Math.max(1,...months.map(function(month){return month.count;}));
    return '<section class="amb-card amb-vip-performance"><div class="amb-card__head"><div><h3>Rendimiento de ventas directas</h3><p>Primeras compras confirmadas durante los últimos seis meses.</p></div><span class="amb-metric-tag">Historial real</span></div><div class="amb-card__body"><div class="amb-month-chart" role="img" aria-label="'+esc(months.map(function(m){return m.label+': '+m.count+' compras';}).join(', '))+'">'+months.map(function(month){return '<div class="amb-month-chart__item"><strong>'+number(month.count)+'</strong><span class="amb-month-chart__bar" style="height:'+Math.round(month.count/max*100)+'%"></span><small>'+esc(month.label)+'</small></div>';}).join('')+'</div><p class="amb-share-help">El historial muestra hasta 250 movimientos recientes. Las comisiones pendientes siguen en validación; la red indirecta no genera pagos todavía.</p></div></section>';
  }

  function dashboardMarkup(data){
    var a=data.ambassador||{},w=data.wallet||{},c=data.config||{},stats=data.analytics||{},vip=data.category==='vip',b=data.benefits||{directCommissionCents:vip?c.directCommissionVipCents:c.directCommissionFreeCents,monthlyDiscountCents:vip?c.monthlyDiscountVipCents:c.monthlyDiscountFreeCents,annualDiscountCents:vip?c.annualDiscountVipCents:c.annualDiscountFreeCents};
    var paidReferrals=count(stats.paidReferrals);
    return '<div class="amb-shell '+(vip?'amb-shell--vip':'amb-shell--free')+'"><div class="amb-page-head"><div class="sec-hero"><span class="sec-hero__eyebrow">Programa de referidos</span><h1 class="sec-hero__title" tabindex="-1" data-amb-heading>'+(vip?'Centro de Embajadores VIP':'Mi panel de Embajador')+'</h1><p class="sec-hero__sub">Conoce el alcance de tus invitaciones y sigue tus ganancias.</p></div><button class="amb-btn amb-btn--ghost" type="button" data-amb-view="withdrawals">Retiros y cuenta bancaria →</button></div>'+
      '<section class="amb-hero"><div><div class="amb-hero__eyebrow">EMBAJADOR '+(vip?'VIP':'GRATUITO')+' · '+(a.active?'PERFIL ACTIVO':'PERFIL EN PAUSA')+(vip&&data.vipExpiresAt?' · VIGENTE HASTA '+esc(date(data.vipExpiresAt)):'')+'</div><h2>'+(vip?'Bienvenido a tu espacio VIP'+(a.name?', '+esc(a.name):'')+'.':'Comparte conocimiento. Genera oportunidades.')+'</h2><p>Recibes '+money(b.directCommissionCents)+' MXN por cada primera compra elegible confirmada. Tus invitados ahorran '+money(b.monthlyDiscountCents)+' MXN en mensual o '+money(b.annualDiscountCents)+' MXN en anual, solo en el primer pago.</p>'+(a.active?'':'<p class="amb-hero__alert">Tu perfil está en pausa. Contacta a soporte para revisar su estado antes de compartir tu código.</p>')+'</div><div class="amb-code"><small>Tu código de descuento</small><strong>'+esc(a.code)+'</strong><div class="amb-code__actions"><button type="button" data-amb-copy="'+esc(a.code)+'" data-copy-label="Código">Copiar código</button><button type="button" data-amb-copy="'+esc(invitationUrl(a))+'" data-copy-label="Enlace">Copiar enlace</button></div><button type="button" class="amb-code__share" data-amb-share>Compartir mi invitación ↗</button></div></section>'+
      '<div class="amb-kpis"><div class="amb-kpi"><div class="amb-kpi__label">Saldo disponible</div><div class="amb-kpi__value">'+money(w.availableCents)+'</div><div class="amb-kpi__meta">Listo para solicitar</div></div><div class="amb-kpi"><div class="amb-kpi__label">Comisiones pendientes</div><div class="amb-kpi__value">'+money(w.pendingCents)+'</div><div class="amb-kpi__meta">En validación</div></div><div class="amb-kpi"><div class="amb-kpi__label">Compras elegibles</div><div class="amb-kpi__value">'+number(paidReferrals)+'</div><div class="amb-kpi__meta">Referidos con comisión</div></div><div class="amb-kpi"><div class="amb-kpi__label">Total ganado</div><div class="amb-kpi__value">'+money(w.totalEarnedCents)+'</div><div class="amb-kpi__meta">Histórico liberado</div></div></div>'+
      (vip?vipPerformanceMarkup(data):freeUpgradeMarkup())+analyticsMarkup(data)+shareMarkup(a)+networkMarkup(data.network)+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Referidos</h3><p>Registros y compras asociados a tu código. Los nombres se muestran parcialmente para proteger su privacidad.</p></div></div><div class="amb-card__body amb-table-wrap"><table class="amb-table"><thead><tr><th>Referido</th><th>Registro</th><th>Estado</th><th>Comisión</th><th>Disponibilidad</th></tr></thead><tbody>'+referralsRows(data.referrals)+'</tbody></table></div></section>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Movimientos de comisiones</h3><p>Compra real, comisión y estado de validación.</p></div></div><div class="amb-card__body amb-table-wrap"><table class="amb-table"><thead><tr><th>Referido</th><th>Plan</th><th>Compra</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>'+commissionRows(data.commissions)+'</tbody></table></div></section></div>';
  }

  function withdrawalPageMarkup(data){
    var w=data.wallet||{},bank=data.bank,c=data.config||{},active=data.ambassador?.active;
    var hasWhatsApp=Boolean(data.ambassador?.whatsapp);
    var allowed=Boolean(active&&bank&&hasWhatsApp&&Number(w.availableCents)>=Number(c.minimumWithdrawalCents)&&!Number(w.debtCents));
    var reason=!active?'Tu perfil está en pausa. Contacta a soporte.':!hasWhatsApp?'Guarda tu WhatsApp en esta página antes de solicitar una transferencia.':!bank?'Registra primero tu cuenta para recibir transferencias.':Number(w.debtCents)?'Hay un ajuste de saldo pendiente; contacta a soporte antes de solicitar otro retiro.':!allowed?'Podrás solicitar un retiro al alcanzar el mínimo de '+money(c.minimumWithdrawalCents)+' MXN.':'';
    return '<div class="amb-shell"><div class="amb-page-head"><div class="sec-hero"><span class="sec-hero__eyebrow">Mi panel de Embajador</span><h1 class="sec-hero__title" tabindex="-1" data-amb-heading>Retiros y cuenta bancaria</h1><p class="sec-hero__sub">Administra dónde recibes tus ganancias y consulta tus transferencias.</p></div><button class="amb-btn amb-btn--ghost" type="button" data-amb-view="dashboard">← Volver a mi panel</button></div><div class="amb-withdrawal-summary"><div><span>Saldo disponible</span><strong>'+money(w.availableCents)+' <small>MXN</small></strong></div><p>En validación: <b>'+money(w.pendingCents)+'</b><br>Reservado para retiros: <b>'+money(w.reservedCents)+'</b></p></div>'+profileMarkup(data.ambassador||{})+'<div class="amb-withdrawal-grid">'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Cuenta para transferencias</h3><p>Tu CLABE se guarda cifrada. Solo mostramos sus últimos cuatro dígitos.</p></div></div><div class="amb-card__body">'+(bank?'<div class="amb-bank-summary"><div><strong>'+esc(bank.holderName||'Titular registrado')+'</strong><span>'+esc(bank.bank)+' · •••• '+esc(bank.last4)+'</span></div><button type="button" class="amb-btn amb-btn--ghost" data-amb-bank-edit>Actualizar</button></div>':'')+'<form class="amb-form" data-amb-bank '+(bank?'hidden':'')+'><div class="amb-field"><label for="amb-bank-holder">Nombre completo del titular</label><input id="amb-bank-holder" name="holderName" maxlength="120" required autocomplete="name"></div><div class="amb-field"><label for="amb-bank-name">Banco</label><input id="amb-bank-name" name="bank" maxlength="80" required placeholder="Nombre del banco"></div><div class="amb-field"><label for="amb-bank-clabe">CLABE interbancaria</label><input id="amb-bank-clabe" name="clabe" inputmode="numeric" minlength="18" maxlength="18" pattern="[0-9]{18}" required placeholder="18 dígitos" autocomplete="off"></div><button class="amb-btn" type="submit">Guardar cuenta cifrada</button></form><div class="amb-note amb-bank-note">Nunca solicitaremos NIP, CVV, contraseñas ni códigos bancarios.</div></div></section>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Solicitar retiro</h3><p>Mínimo '+money(c.minimumWithdrawalCents)+' MXN · transferencia manual.</p></div></div><div class="amb-card__body"><form class="amb-form" data-amb-withdraw><div class="amb-field"><label for="amb-withdrawal-amount">Monto en MXN</label><input id="amb-withdrawal-amount" name="amount" type="number" min="'+(Number(c.minimumWithdrawalCents||0)/100)+'" max="'+(Number(w.availableCents||0)/100)+'" step="0.01" value="'+(Number(w.availableCents||0)/100||'')+'" required '+(!allowed?'disabled':'')+'></div><button class="amb-btn" type="submit" '+(!allowed?'disabled':'')+'>Solicitar transferencia</button>'+(reason?'<div class="amb-note">'+esc(reason)+'</div>':'')+'</form></div></section></div>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Historial de retiros</h3><p>Revisa el estado de cada solicitud y descarga su comprobante cuando esté disponible.</p></div></div><div class="amb-card__body">'+withdrawalsMarkup(data.withdrawals)+'</div></section></div>';
  }

  async function render(root){
    if(!root)return;var route=location.hash,generation=sessionGeneration;loading(root);
    if(window.__isDemoMode){root.innerHTML='<div class="amb-empty"><div><strong>Inicia sesión para participar</strong><p>El programa necesita una cuenta real para generar tu código y proteger tus comisiones.</p></div></div>';return;}
    try{var data=await load(true);if(location.hash===route&&generation===sessionGeneration)renderData(root,data);}catch(error){if(location.hash!==route||generation!==sessionGeneration)return;root.innerHTML='<div class="amb-empty"><div><strong>No pudimos cargar Embajadores</strong><p>'+esc(error.message)+'</p><button class="amb-btn" type="button" data-amb-retry>Reintentar</button></div></div>';root.querySelector('[data-amb-retry]')?.addEventListener('click',function(){render(root);});}
  }

  function acknowledgeCelebration(id){if(!id)return;request('/api/ambassadors/notifications/'+encodeURIComponent(id)+'/read',{method:'POST'}).catch(function(){});}

  function showCommissionCelebration(item){
    if(!item?.id||shownCelebrations.has(item.id))return;
    shownCelebrations.add(item.id);
    document.querySelector('.amb-commission-celebration')?.remove();
    var amount=money(item.amountCents),days=Number(item.validationDays)||7,root=document.createElement('div');
    root.className='amb-commission-celebration';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','amb-commission-title');
    root.innerHTML='<div class="amb-commission-celebration__shade" data-amb-celebration-close></div><section class="amb-commission-celebration__dialog" role="document"><div class="amb-commission-celebration__coins" aria-hidden="true">'+Array.from({length:18},function(_,index){return '<span style="--i:'+index+'">'+emoji('1FA99')+'</span>';}).join('')+'</div><button class="amb-commission-celebration__close" type="button" aria-label="Cerrar" data-amb-celebration-close>×</button><div class="amb-commission-celebration__icon" aria-hidden="true">'+emoji('1FA99')+'</div><p class="amb-commission-celebration__eyebrow">NUEVA COMISIÓN REGISTRADA</p><h2 id="amb-commission-title">¡Tu recomendación se convirtió en una membresía VIP!</h2><p><strong>+'+esc(amount)+'</strong> quedó registrada en tu cuenta de embajador. Está en validación y se liberará después de '+esc(days)+' días.</p><button class="amb-btn" type="button" data-amb-celebration-close>Ver mi panel</button></section>';
    document.body.appendChild(root);
    function close(){if(!root.isConnected)return;root.remove();acknowledgeCelebration(item.id);}
    root.querySelectorAll('[data-amb-celebration-close]').forEach(function(button){button.addEventListener('click',close);});
    root.addEventListener('keydown',function(event){if(event.key==='Escape')close();});
    setTimeout(function(){root.querySelector('.amb-commission-celebration__close')?.focus();},0);
  }

  function renderData(root,data){root.innerHTML=data.registered?(activeView==='withdrawals'?withdrawalPageMarkup(data):dashboardMarkup(data)):enrollMarkup(data);bind(root,data);if(activeView==='dashboard'&&data.commissionCelebrations?.length)setTimeout(function(){showCommissionCelebration(data.commissionCelebrations[0]);},80);}

  async function copyText(value){
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return true;}catch(_){}}
    var field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(field);field.select();
    var copied=false;try{copied=document.execCommand('copy');}catch(_){}field.remove();return copied;
  }

  function shareHelp(root,message){var help=root.querySelector('[data-amb-share-help]');if(help)help.textContent=message;}

  async function copyMessage(root,ambassador){
    if(await copyText(shareMessage(ambassador))){toast('success','Invitación copiada','El mensaje incluye tu código y tu enlace.');return true;}
    var details=root.querySelector('.amb-message'),field=root.querySelector('.amb-message__preview');if(details)details.open=true;if(field){field.focus();field.select();}
    shareHelp(root,'Selecciona y copia el mensaje de invitación para pegarlo en la aplicación que prefieras.');return false;
  }

  async function shareTo(root,ambassador,platform){
    var message=shareMessage(ambassador),url=invitationUrl(ambassador);
    if(platform==='whatsapp'){
      var mobile=isMobileShare();
      if(mobile&&navigator.share){
        try{await navigator.share({title:'Tu invitación a ICADEM',text:message});return;}catch(error){if(error.name==='AbortError')return;}
      }
      // wa.me currently replaces supplementary Unicode characters with U+FFFD.
      // Desktop goes straight to Web. Older mobile browsers get plain text on
      // the app landing page, whose preview also corrupts emoji characters.
      var payload=mobile?shareMessage(ambassador,false):message;
      window.open((mobile?'https://api.whatsapp.com/send?text=':'https://web.whatsapp.com/send?text=')+encodeURIComponent(payload),'_blank','noopener,noreferrer');
      shareHelp(root,mobile?'Se preparó una versión sin emojis para que este navegador comparta el mensaje correctamente.':'El mensaje se abre en WhatsApp Web. También puedes usar «Copiar mensaje completo».');
      return;
    }
    if(platform==='facebook'){
      var popup=window.open('about:blank','_blank');
      if(popup)popup.opener=null;
      var copied=await copyMessage(root,ambassador);
      if(popup)popup.location.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
      shareHelp(root,!popup?'El navegador bloqueó la ventana. Abre Facebook y pega el mensaje de invitación.':copied?'Mensaje copiado. Pégalo en tu publicación de Facebook para incluir tu código de descuento.':'Facebook comparte tu enlace. Puedes copiar el mensaje que aparece debajo para añadirlo a tu publicación.');
      return;
    }
    if(navigator.share){
      try{await navigator.share({title:'Tu descuento especial en ICADEM',text:message});return;}catch(error){if(error.name==='AbortError')return;}
    }
    var success=await copyMessage(root,ambassador);
    if(success){var name=platform==='instagram'?'Instagram':platform==='messenger'?'Messenger':'la aplicación que prefieras';shareHelp(root,'Mensaje completo copiado. Abre '+name+' y pégalo en una conversación para compartir tu invitación.');}
  }

  function bind(root,data){
    root.querySelector('[data-amb-back]')?.addEventListener('click',function(){var previous=window.__seccionAnteriorVIP;if(!previous||previous==='embajadores'||previous==='clase-detalle'||previous==='curso-detalle')previous=previous?.includes('detalle')?'cursos':'perfil';if(typeof window.navigateToSection==='function')window.navigateToSection(previous);else document.querySelector('[data-section="'+previous+'"]')?.click();});
    root.querySelector('[data-amb-upgrade]')?.addEventListener('click',function(){if(typeof window.navigateToSection==='function')window.navigateToSection('suscripcion');else document.querySelector('[data-section="suscripcion"]')?.click();});
    root.querySelectorAll('[data-amb-view]').forEach(function(button){button.addEventListener('click',function(){activeView=button.dataset.ambView==='withdrawals'?'withdrawals':'dashboard';renderData(root,data);var heading=root.querySelector('[data-amb-heading]');heading?.scrollIntoView({block:'start',behavior:'auto'});heading?.focus({preventScroll:true});});});
    root.querySelector('[data-amb-enroll]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/register',{method:'POST',body:{acceptTerms:form.terms.checked,acceptPrivacy:form.privacy.checked}});cache=null;setMemberNav(true);document.dispatchEvent(new CustomEvent('icadem:ambassador-enrolled'));toast('success','Perfil activado','Tu código de Embajador ya está listo.');await render(root);}catch(error){toast('error','No pudimos activar tu perfil',error.message);button.disabled=false;}});
    root.querySelectorAll('[data-amb-copy]').forEach(function(button){button.addEventListener('click',async function(){var copied=await copyText(button.dataset.ambCopy);toast(copied?'success':'info',copied?(button.dataset.copyLabel||'Texto')+' copiado':'Copia este texto',copied?'Ya puedes compartirlo.':button.dataset.ambCopy);});});
    root.querySelector('[data-amb-share]')?.addEventListener('click',function(){var section=root.querySelector('[data-amb-sharing]');section?.scrollIntoView({behavior:'smooth',block:'center'});section?.querySelector('button')?.focus({preventScroll:true});});
    root.querySelectorAll('[data-amb-social]').forEach(function(button){button.addEventListener('click',function(){shareTo(root,data.ambassador||{},button.dataset.ambSocial).catch(function(){shareHelp(root,'No se pudo abrir la aplicación. Usa «Copiar mensaje completo» y pégalo para compartir.');});});});
    root.querySelector('[data-amb-copy-message]')?.addEventListener('click',function(){copyMessage(root,data.ambassador||{});});
    root.querySelector('[data-amb-whatsapp]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/whatsapp',{method:'PUT',body:{whatsapp:form.elements.namedItem('whatsapp').value.trim()}});cache=null;toast('success','WhatsApp guardado','Administración ya puede contactarte sobre tus transferencias.');await render(root);}catch(error){toast('error','No pudimos guardar el número',error.message);button.disabled=false;}});
    root.querySelector('[data-amb-bank-edit]')?.addEventListener('click',function(){var form=root.querySelector('[data-amb-bank]');form?.removeAttribute('hidden');form?.querySelector('input')?.focus();});
    root.querySelector('[data-amb-bank]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/bank',{method:'PUT',body:{holderName:form.holderName.value,bank:form.bank.value,clabe:form.clabe.value}});cache=null;toast('success','Cuenta protegida','La CLABE quedó cifrada y solo mostraremos sus últimos dígitos.');await render(root);}catch(error){toast('error',error.data?.code==='reauth-required'?'Vuelve a iniciar sesión':'No pudimos guardar la cuenta',error.message);button.disabled=false;}});
    root.querySelector('[data-amb-withdraw]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button'),amount=Math.round(Number(form.amount.value)*100);if(!amount)return;button.disabled=true;try{if(!form.dataset.requestId||form.dataset.requestAmount!==String(amount)){form.dataset.requestId=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));form.dataset.requestAmount=String(amount);}await request('/api/ambassadors/withdrawals',{method:'POST',body:{amountCents:amount,requestId:form.dataset.requestId}});cache=null;toast('success','Solicitud registrada','El saldo quedó reservado para que administración procese la transferencia.');await render(root);}catch(error){toast('error','No pudimos solicitar el retiro',error.message);button.disabled=false;}});
  }

  async function syncInvite(container){
    return window.ICADEMAmbassadorPromo?.mountProfile(container);
  }

  async function showInfo(){
    if(!window.Modal)return;
    try{var data=await load(),c=data.config||{},vip=data.category==='vip';Modal.open({id:'ambassador-how-it-works',title:'¿Cómo funciona?',subtitle:'Beneficios para ti y para tus invitados',icon:'i-info',size:'sm',body:'<div style="color:var(--text-2);font-size:12.5px;line-height:1.65"><ol style="margin:0;padding-left:18px;display:grid;gap:8px"><li>Activas tu perfil y recibes un código de descuento y enlace únicos.</li><li>Una persona sin VIP activo abre tu enlace o aplica tu código al elegir su plan.</li><li>Recibe '+money(vip?c.monthlyDiscountVipCents:c.monthlyDiscountFreeCents)+' MXN de descuento en mensual o '+money(vip?c.annualDiscountVipCents:c.annualDiscountFreeCents)+' MXN en anual, solo en su primer pago. El total se muestra antes de pagar.</li><li>Por esa compra confirmada recibes '+money(vip?c.directCommissionVipCents:c.directCommissionFreeCents)+' MXN. La comisión permanece '+esc(c.validationDays)+' días en validación y se revierte ante reembolso o contracargo.</li><li>Cuando esté disponible, puedes solicitar una transferencia desde «Retiros y cuenta bancaria».</li></ol><p style="margin:13px 0 0;padding-top:12px;border-top:1px solid var(--line);font-size:11px">La atribución dura '+esc(c.attributionDays)+' días. El beneficio se permite una vez por cuenta, incluso si antes tuvo VIP; no cuentan las renovaciones ni las compras con tu propio código. La compra debe alcanzar el mínimo vigente de '+money(c.minimumPaidCents)+' MXN después del descuento. El descuento de embajador no se acumula con otro cupón.</p></div>',footer:'<button class="btn btn--accent" onclick="Modal.close(\'ambassador-how-it-works\')">Entendido</button>'});}catch(error){toast('error','No pudimos cargar las condiciones',error.message);}
  }

  captureRef();
  document.addEventListener('icadem:user-ready',function(){sessionGeneration+=1;cache=null;cacheAt=0;activeView='dashboard';setMemberNav(false);claimStoredRef();syncMemberNav();});
  window.ICADEMAmbassadors={render:render,syncInvite:syncInvite,showInfo:showInfo,claimStoredRef:claimStoredRef,getSummary:load};
})();
