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
  function shareMessage(ambassador){var e={grad:emoji('1F393'),fire:emoji('1F525'),sparkles:emoji('2728'),gift:emoji('1F381'),check:emoji('2705'),key:emoji('1F511'),link:emoji('1F517'),rocket:emoji('1F680')};return e.grad+e.fire+' *¡TENGO UN DESCUENTO ESPECIAL PARA TI EN ICADEM!*\n\n¿Te gustaría seguir preparándote profesionalmente y aprender nuevas habilidades?\n\n'+e.sparkles+' Con *ICADEM* puedes acceder a cursos de diferentes especialidades, clases, materiales de estudio y certificados digitales.\n\n'+e.gift+' *¡Y tengo un beneficio exclusivo para ti!*\n\nUtiliza mi código de invitación y obtén un *DESCUENTO ESPECIAL* al contratar tu membresía:\n\n'+e.check+' Plan mensual\n'+e.check+' Plan anual\n\n'+e.key+' *TU CÓDIGO DE DESCUENTO:* '+String(ambassador.code||'')+'\n\n'+e.link+' *Activa tu beneficio aquí:*\n'+String(ambassador.referralUrl||'')+'\n\n'+e.rocket+' *¡Aprovecha tu descuento y comienza a invertir en tu crecimiento profesional!*';}
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
    var c=data.config||{};
    return '<div class="amb-shell fade-up"><div class="sec-hero"><span class="sec-hero__eyebrow">Programa de referidos</span><h1 class="sec-hero__title">ICADEM Embajadores</h1><p class="sec-hero__sub">Comparte ICADEM y recibe una comisión por cada nueva membresía elegible y confirmada.</p></div><div class="amb-enroll">'+
      '<section class="amb-enroll__lead"><div class="amb-hero__eyebrow">PROGRAMA ICADEM EMBAJADORES</div><h2>Recomienda ICADEM y gana '+money(c.commissionCents)+' MXN</h2><p>Tu invitado recibe '+money(c.discountCents)+' MXN de descuento en su primera compra elegible de un plan mensual o anual. Tú recibes una comisión cuando el pago se confirma, con '+esc(c.validationDays)+' días de validación.</p><div class="amb-steps">'+
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
    return '<section class="amb-card amb-sharing" data-amb-sharing><div class="amb-card__head"><div><h3>Invita a conocer ICADEM</h3><p>Comparte este código de referido e invita a las personas a conocer ICADEM. Tu mensaje ya incluye el código y el enlace para activar su beneficio.</p></div></div><div class="amb-card__body"><div class="amb-share-actions"><button class="amb-btn amb-btn--whatsapp" type="button" data-amb-social="whatsapp">WhatsApp ↗</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="facebook">Facebook ↗</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="messenger">Messenger</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="instagram">Instagram</button><button class="amb-btn amb-btn--ghost" type="button" data-amb-social="native">Más opciones</button></div><details class="amb-message"><summary>Ver mensaje listo para compartir</summary><textarea class="amb-message__preview" aria-label="Mensaje de invitación con tu código y enlace" readonly>'+esc(shareMessage(ambassador))+'</textarea><button type="button" class="amb-btn amb-btn--ghost" data-amb-copy-message>Copiar mensaje completo</button></details><p class="amb-share-help" data-amb-share-help aria-live="polite">En Messenger e Instagram, elige la aplicación al compartir o pega el mensaje en una conversación.</p></div></section>';
  }

  function dashboardMarkup(data){
    var a=data.ambassador||{},w=data.wallet||{},c=data.config||{},stats=data.analytics||{};
    var paidReferrals=count(stats.paidReferrals);
    return '<div class="amb-shell"><div class="amb-page-head"><div class="sec-hero"><span class="sec-hero__eyebrow">Programa de referidos</span><h1 class="sec-hero__title" tabindex="-1" data-amb-heading>Mi panel de Embajador</h1><p class="sec-hero__sub">Conoce el alcance de tus invitaciones y sigue tus ganancias.</p></div><button class="amb-btn amb-btn--ghost" type="button" data-amb-view="withdrawals">Retiros y cuenta bancaria →</button></div>'+
      '<section class="amb-hero"><div><div class="amb-hero__eyebrow">ICADEM EMBAJADORES · '+(a.active?'PERFIL ACTIVO':'PERFIL EN PAUSA')+'</div><h2>Comparte conocimiento. Genera oportunidades.</h2><p>Tu invitado ahorra '+money(c.discountCents)+' MXN. Tú recibes '+money(c.commissionCents)+' MXN por su primera compra elegible de una membresía VIP.</p>'+(a.active?'':'<p class="amb-hero__alert">Tu perfil está en pausa. Contacta a soporte para revisar su estado antes de compartir tu código.</p>')+'</div><div class="amb-code"><small>Tu código de descuento</small><strong>'+esc(a.code)+'</strong><div class="amb-code__actions"><button type="button" data-amb-copy="'+esc(a.code)+'" data-copy-label="Código">Copiar código</button><button type="button" data-amb-copy="'+esc(a.referralUrl)+'" data-copy-label="Enlace">Copiar enlace</button></div><button type="button" class="amb-code__share" data-amb-share>Compartir mi invitación ↗</button></div></section>'+
      '<div class="amb-kpis"><div class="amb-kpi"><div class="amb-kpi__label">Saldo disponible</div><div class="amb-kpi__value">'+money(w.availableCents)+'</div><div class="amb-kpi__meta">Listo para solicitar</div></div><div class="amb-kpi"><div class="amb-kpi__label">Comisiones pendientes</div><div class="amb-kpi__value">'+money(w.pendingCents)+'</div><div class="amb-kpi__meta">En validación</div></div><div class="amb-kpi"><div class="amb-kpi__label">Compras elegibles</div><div class="amb-kpi__value">'+number(paidReferrals)+'</div><div class="amb-kpi__meta">Referidos con comisión</div></div><div class="amb-kpi"><div class="amb-kpi__label">Total ganado</div><div class="amb-kpi__value">'+money(w.totalEarnedCents)+'</div><div class="amb-kpi__meta">Histórico liberado</div></div></div>'+
      analyticsMarkup(data)+shareMarkup(a)+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Referidos</h3><p>Registros y compras asociados a tu código. Los nombres se muestran parcialmente para proteger su privacidad.</p></div></div><div class="amb-card__body amb-table-wrap"><table class="amb-table"><thead><tr><th>Referido</th><th>Registro</th><th>Estado</th><th>Comisión</th><th>Disponibilidad</th></tr></thead><tbody>'+referralsRows(data.referrals)+'</tbody></table></div></section>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Movimientos de comisiones</h3><p>Compra real, comisión y estado de validación.</p></div></div><div class="amb-card__body amb-table-wrap"><table class="amb-table"><thead><tr><th>Referido</th><th>Plan</th><th>Compra</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>'+commissionRows(data.commissions)+'</tbody></table></div></section></div>';
  }

  function withdrawalPageMarkup(data){
    var w=data.wallet||{},bank=data.bank,c=data.config||{},active=data.ambassador?.active;
    var allowed=Boolean(active&&bank&&Number(w.availableCents)>=Number(c.minimumWithdrawalCents)&&!Number(w.debtCents));
    var reason=!active?'Tu perfil está en pausa. Contacta a soporte.':!bank?'Registra primero tu cuenta para recibir transferencias.':Number(w.debtCents)?'Hay un ajuste de saldo pendiente; contacta a soporte antes de solicitar otro retiro.':!allowed?'Podrás solicitar un retiro al alcanzar el mínimo de '+money(c.minimumWithdrawalCents)+' MXN.':'';
    return '<div class="amb-shell"><div class="amb-page-head"><div class="sec-hero"><span class="sec-hero__eyebrow">Mi panel de Embajador</span><h1 class="sec-hero__title" tabindex="-1" data-amb-heading>Retiros y cuenta bancaria</h1><p class="sec-hero__sub">Administra dónde recibes tus ganancias y consulta tus transferencias.</p></div><button class="amb-btn amb-btn--ghost" type="button" data-amb-view="dashboard">← Volver a mi panel</button></div><div class="amb-withdrawal-summary"><div><span>Saldo disponible</span><strong>'+money(w.availableCents)+' <small>MXN</small></strong></div><p>En validación: <b>'+money(w.pendingCents)+'</b><br>Reservado para retiros: <b>'+money(w.reservedCents)+'</b></p></div><div class="amb-withdrawal-grid">'+
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
    var message=shareMessage(ambassador),url=String(ambassador.referralUrl||'');
    if(platform==='whatsapp'){window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');return;}
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
    root.querySelectorAll('[data-amb-view]').forEach(function(button){button.addEventListener('click',function(){activeView=button.dataset.ambView==='withdrawals'?'withdrawals':'dashboard';renderData(root,data);var heading=root.querySelector('[data-amb-heading]');heading?.scrollIntoView({block:'start',behavior:'auto'});heading?.focus({preventScroll:true});});});
    root.querySelector('[data-amb-enroll]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/register',{method:'POST',body:{acceptTerms:form.terms.checked,acceptPrivacy:form.privacy.checked}});cache=null;setMemberNav(true);toast('success','Perfil activado','Tu código de Embajador ya está listo.');await render(root);}catch(error){toast('error','No pudimos activar tu perfil',error.message);button.disabled=false;}});
    root.querySelectorAll('[data-amb-copy]').forEach(function(button){button.addEventListener('click',async function(){var copied=await copyText(button.dataset.ambCopy);toast(copied?'success':'info',copied?(button.dataset.copyLabel||'Texto')+' copiado':'Copia este texto',copied?'Ya puedes compartirlo.':button.dataset.ambCopy);});});
    root.querySelector('[data-amb-share]')?.addEventListener('click',function(){var section=root.querySelector('[data-amb-sharing]');section?.scrollIntoView({behavior:'smooth',block:'center'});section?.querySelector('button')?.focus({preventScroll:true});});
    root.querySelectorAll('[data-amb-social]').forEach(function(button){button.addEventListener('click',function(){shareTo(root,data.ambassador||{},button.dataset.ambSocial).catch(function(){shareHelp(root,'No se pudo abrir la aplicación. Usa «Copiar mensaje completo» y pégalo para compartir.');});});});
    root.querySelector('[data-amb-copy-message]')?.addEventListener('click',function(){copyMessage(root,data.ambassador||{});});
    root.querySelector('[data-amb-bank-edit]')?.addEventListener('click',function(){var form=root.querySelector('[data-amb-bank]');form?.removeAttribute('hidden');form?.querySelector('input')?.focus();});
    root.querySelector('[data-amb-bank]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/bank',{method:'PUT',body:{holderName:form.holderName.value,bank:form.bank.value,clabe:form.clabe.value}});cache=null;toast('success','Cuenta protegida','La CLABE quedó cifrada y solo mostraremos sus últimos dígitos.');await render(root);}catch(error){toast('error',error.data?.code==='reauth-required'?'Vuelve a iniciar sesión':'No pudimos guardar la cuenta',error.message);button.disabled=false;}});
    root.querySelector('[data-amb-withdraw]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button'),amount=Math.round(Number(form.amount.value)*100);if(!amount)return;button.disabled=true;try{if(!form.dataset.requestId||form.dataset.requestAmount!==String(amount)){form.dataset.requestId=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));form.dataset.requestAmount=String(amount);}await request('/api/ambassadors/withdrawals',{method:'POST',body:{amountCents:amount,requestId:form.dataset.requestId}});cache=null;toast('success','Solicitud registrada','El saldo quedó reservado para que administración procese la transferencia.');await render(root);}catch(error){toast('error','No pudimos solicitar el retiro',error.message);button.disabled=false;}});
  }

  async function syncInvite(container){
    var button=container?.querySelector('#btn-ambassador-interest');if(!button||window.__isDemoMode)return;
    try{var data=await load(),c=data.config||{},title=container.querySelector('[data-amb-profile-title]'),description=container.querySelector('[data-amb-profile-description]');if(title)title.textContent='Recomienda ICADEM y gana '+money(c.commissionCents)+' MXN';if(description)description.textContent='Comparte tu código: tu invitado ahorra '+money(c.discountCents)+' MXN en su primera membresía elegible y tú recibes una recompensa.';if(data.registered){button.firstChild.textContent='Ir a mi panel de Embajador ';button.dataset.registered='1';setMemberNav(true);}}catch(_){}
  }

  async function showInfo(){
    if(!window.Modal)return;
    try{var data=await load(),c=data.config||{};Modal.open({id:'ambassador-how-it-works',title:'¿Cómo funciona?',subtitle:'Beneficios para ti y para tus invitados',icon:'i-info',size:'sm',body:'<div style="color:var(--text-2);font-size:12.5px;line-height:1.65"><ol style="margin:0;padding-left:18px;display:grid;gap:8px"><li>Activas tu perfil y recibes un código de descuento y enlace únicos.</li><li>Una persona nueva abre tu enlace o aplica tu código al elegir su plan.</li><li>Recibe '+money(c.discountCents)+' MXN de descuento sobre el precio vigente de su primera compra elegible mensual o anual. El total se muestra antes de pagar.</li><li>Por esa compra confirmada recibes '+money(c.commissionCents)+' MXN. La comisión permanece '+esc(c.validationDays)+' días en validación y se revierte ante reembolso o contracargo.</li><li>Cuando esté disponible, puedes solicitar una transferencia desde «Retiros y cuenta bancaria».</li></ol><p style="margin:13px 0 0;padding-top:12px;border-top:1px solid var(--line);font-size:11px">La atribución dura '+esc(c.attributionDays)+' días. Solo cuenta la primera compra de un miembro nuevo; no cuentan las renovaciones ni las compras con tu propio código. La compra debe alcanzar el mínimo vigente de '+money(c.minimumPaidCents)+' MXN después del descuento. El descuento de embajador no se acumula con otro cupón.</p></div>',footer:'<button class="btn btn--accent" onclick="Modal.close(\'ambassador-how-it-works\')">Entendido</button>'});}catch(error){toast('error','No pudimos cargar las condiciones',error.message);}
  }

  captureRef();
  document.addEventListener('icadem:user-ready',function(){sessionGeneration+=1;cache=null;cacheAt=0;activeView='dashboard';setMemberNav(false);claimStoredRef();syncMemberNav();});
  window.ICADEMAmbassadors={render:render,syncInvite:syncInvite,showInfo:showInfo,claimStoredRef:claimStoredRef};
})();
