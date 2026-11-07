/* ICADEM Embajadores · experiencia del miembro. Los importes siempre vienen
   del backend; este archivo no calcula ni escribe saldos directamente. */
(function(){
  'use strict';

  var REF_KEY='icadem:ambassador:ref';
  var cache=null;
  var cacheAt=0;

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function money(cents){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0,maximumFractionDigits:2}).format((Number(cents)||0)/100);}
  function date(value){if(!value)return '—';var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});}
  function request(path,options){if(!window.ICADEMPlatform?.request)return Promise.reject(new Error('Tu sesión todavía no está lista.'));return window.ICADEMPlatform.request(path,options||{});}
  function toast(type,title,message){if(window.Toast?.[type])window.Toast[type](title,message);}
  function statusLabel(status){return({registered:'Registrado sin compra',purchase_confirmed:'Compra confirmada',purchase_not_eligible:'Compra no elegible',pending:'En validación',available:'Disponible',paid:'Pagado',reversed:'Revertida',ineligible:'No elegible',approved:'Aprobado',rejected:'Rechazado'}[status]||status||'Registrado');}
  function captureRef(){try{var code=String(new URLSearchParams(location.search).get('ref')||'').trim().toUpperCase();if(/^[A-Z0-9]{3,8}-[A-Z0-9]{4,8}$/.test(code))localStorage.setItem(REF_KEY,JSON.stringify({code:code,capturedAt:Date.now()}));}catch(_){}}
  async function claimStoredRef(){
    try{
      var saved=JSON.parse(localStorage.getItem(REF_KEY)||'null');
      if(!saved?.code||Date.now()-Number(saved.capturedAt||0)>30*86400000){if(saved)localStorage.removeItem(REF_KEY);return;}
      await request('/api/ambassadors/attribute',{method:'POST',body:{code:saved.code,source:'member-panel'}});
      localStorage.removeItem(REF_KEY);
    }catch(error){if([400,404,409].includes(error.status))localStorage.removeItem(REF_KEY);}
  }

  async function load(force){
    if(!force&&cache&&Date.now()-cacheAt<15000)return cache;
    cache=await request('/api/ambassadors/me');cacheAt=Date.now();return cache;
  }

  function setMemberNav(visible){document.querySelectorAll('#nav-ambassadors,#drawer-nav-ambassadors').forEach(function(item){item.hidden=!visible;});}
  async function syncMemberNav(){if(window.__isDemoMode)return;try{var data=await load();setMemberNav(Boolean(data.registered));}catch(_){}}

  function loading(root){root.innerHTML='<div class="amb-loading"><div><div class="amb-loading__spin"></div><strong>Sincronizando ICADEM Embajadores…</strong></div></div>';}

  function enrollMarkup(data){
    var c=data.config||{};
    return '<div class="amb-shell fade-up"><div class="sec-hero"><span class="sec-hero__eyebrow">Programa de referidos</span><h1 class="sec-hero__title">ICADEM Embajadores</h1><p class="sec-hero__sub">Comparte ICADEM y recibe una comisión por cada nueva membresía elegible y confirmada.</p></div><div class="amb-enroll">'+
      '<section class="amb-enroll__lead"><div class="amb-hero__eyebrow">PROGRAMA ICADEM EMBAJADORES</div><h2>Recomienda ICADEM y gana '+money(c.commissionCents)+'</h2><p>Tu código identifica el referido, pero no altera el precio de la membresía. Stripe confirma el pago y la comisión permanece '+esc(c.validationDays)+' días en validación.</p><div class="amb-steps">'+
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

  function dashboardMarkup(data){
    var a=data.ambassador||{},w=data.wallet||{},bank=data.bank,c=data.config||{};
    return '<div class="amb-shell fade-up"><div class="sec-hero"><span class="sec-hero__eyebrow">Programa de referidos</span><h1 class="sec-hero__title">Mi panel de Embajador</h1><p class="sec-hero__sub">Consulta tus referidos, ganancias y solicitudes de retiro.</p></div>'+
      '<section class="amb-hero"><div><div class="amb-hero__eyebrow">ICADEM EMBAJADORES · PERFIL ACTIVO</div><h2>Comparte conocimiento. Genera oportunidades.</h2><p>Recibes '+money(c.commissionCents)+' por la primera compra elegible de cada nuevo miembro referido.</p></div><div class="amb-code"><small>Tu código personal</small><strong>'+esc(a.code)+'</strong><div class="amb-code__actions"><button type="button" data-amb-copy="'+esc(a.referralUrl)+'">Copiar enlace</button><button type="button" data-amb-share="'+esc(a.referralUrl)+'">Compartir</button></div></div></section>'+
      '<div class="amb-kpis"><div class="amb-kpi"><div class="amb-kpi__label">Saldo disponible</div><div class="amb-kpi__value">'+money(w.availableCents)+'</div><div class="amb-kpi__meta">Listo para solicitar</div></div><div class="amb-kpi"><div class="amb-kpi__label">Comisiones pendientes</div><div class="amb-kpi__value">'+money(w.pendingCents)+'</div><div class="amb-kpi__meta">En validación</div></div><div class="amb-kpi"><div class="amb-kpi__label">Referidos pagados</div><div class="amb-kpi__value">'+esc((data.commissions||[]).filter(function(x){return ['pending','available'].includes(x.status);}).length)+'</div><div class="amb-kpi__meta">Compras elegibles</div></div><div class="amb-kpi"><div class="amb-kpi__label">Total ganado</div><div class="amb-kpi__value">'+money(w.totalEarnedCents)+'</div><div class="amb-kpi__meta">Histórico liberado</div></div></div>'+
      '<div class="amb-grid"><section class="amb-card"><div class="amb-card__head"><div><h3>Referidos</h3><p>Identidad protegida y estados confirmados por el servidor.</p></div></div><div class="amb-card__body amb-table-wrap"><table class="amb-table"><thead><tr><th>Referido</th><th>Registro</th><th>Estado</th><th>Comisión</th><th>Disponibilidad</th></tr></thead><tbody>'+referralsRows(data.referrals)+'</tbody></table></div></section>'+
      '<div class="amb-shell"><section class="amb-card"><div class="amb-card__head"><div><h3>Cuenta para transferencias</h3><p>Solo mostramos los últimos cuatro dígitos.</p></div></div><div class="amb-card__body">'+(bank?'<div class="amb-bank-summary"><div><strong>'+esc(bank.holderName||'Titular registrado')+'</strong><span>'+esc(bank.bank)+' · •••• '+esc(bank.last4)+'</span></div><button type="button" class="amb-btn amb-btn--ghost" data-amb-bank-edit>Actualizar</button></div>':'')+'<form class="amb-form" data-amb-bank '+(bank?'hidden':'')+'><div class="amb-field"><label>Nombre completo del titular</label><input name="holderName" maxlength="120" required autocomplete="name"></div><div class="amb-field"><label>Banco</label><input name="bank" maxlength="80" required placeholder="Nombre del banco"></div><div class="amb-field"><label>CLABE interbancaria</label><input name="clabe" inputmode="numeric" minlength="18" maxlength="18" pattern="[0-9]{18}" required placeholder="18 dígitos" autocomplete="off"></div><button class="amb-btn" type="submit">Guardar cuenta cifrada</button></form><div class="amb-note" style="margin-top:11px">Nunca solicitaremos NIP, CVV, contraseñas ni códigos bancarios.</div></div></section>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Solicitar retiro</h3><p>Mínimo '+money(c.minimumWithdrawalCents)+' · transferencia manual.</p></div></div><div class="amb-card__body"><form class="amb-form" data-amb-withdraw><div class="amb-field"><label>Monto en MXN</label><input name="amount" type="number" min="'+(Number(c.minimumWithdrawalCents||0)/100)+'" max="'+(Number(w.availableCents||0)/100)+'" step="0.01" value="'+(Number(w.availableCents||0)/100||'')+'" required '+(!bank||!w.availableCents?'disabled':'')+'></div><button class="amb-btn" type="submit" '+(!bank||!w.availableCents?'disabled':'')+'>Solicitar transferencia</button></form></div></section></div></div>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Movimientos de comisiones</h3><p>Compra real, comisión y estado de validación.</p></div></div><div class="amb-card__body amb-table-wrap"><table class="amb-table"><thead><tr><th>Referido</th><th>Plan</th><th>Compra</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>'+commissionRows(data.commissions)+'</tbody></table></div></section>'+
      '<section class="amb-card"><div class="amb-card__head"><div><h3>Historial de retiros</h3><p>La liberación de comisión y la transferencia son procesos separados.</p></div></div><div class="amb-card__body">'+withdrawalsMarkup(data.withdrawals)+'</div></section></div>';
  }

  async function render(root){
    if(!root)return;loading(root);
    if(window.__isDemoMode){root.innerHTML='<div class="amb-empty"><div><strong>Inicia sesión para participar</strong><p>El programa necesita una cuenta real para generar tu código y proteger tus comisiones.</p></div></div>';return;}
    try{var data=await load(true);root.innerHTML=data.registered?dashboardMarkup(data):enrollMarkup(data);bind(root,data);}catch(error){root.innerHTML='<div class="amb-empty"><div><strong>No pudimos cargar Embajadores</strong><p>'+esc(error.message)+'</p><button class="amb-btn" type="button" data-amb-retry>Reintentar</button></div></div>';root.querySelector('[data-amb-retry]')?.addEventListener('click',function(){render(root);});}
  }

  function bind(root,data){
    root.querySelector('[data-amb-enroll]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/register',{method:'POST',body:{acceptTerms:form.terms.checked,acceptPrivacy:form.privacy.checked}});cache=null;setMemberNav(true);toast('success','Perfil activado','Tu código de Embajador ya está listo.');await render(root);}catch(error){toast('error','No pudimos activar tu perfil',error.message);button.disabled=false;}});
    root.querySelectorAll('[data-amb-copy]').forEach(function(button){button.addEventListener('click',async function(){try{await navigator.clipboard.writeText(button.dataset.ambCopy);toast('success','Enlace copiado','Ya puedes compartirlo.');}catch(_){toast('info','Copia tu enlace',button.dataset.ambCopy);}});});
    root.querySelectorAll('[data-amb-share]').forEach(function(button){button.addEventListener('click',async function(){var url=button.dataset.ambShare;if(navigator.share){await navigator.share({title:'Conoce ICADEM',text:'Te invito a conocer ICADEM.',url:url}).catch(function(){});}else{await navigator.clipboard.writeText(url);toast('success','Enlace copiado','Pégalo donde quieras compartirlo.');}});});
    root.querySelector('[data-amb-bank-edit]')?.addEventListener('click',function(){root.querySelector('[data-amb-bank]')?.removeAttribute('hidden');});
    root.querySelector('[data-amb-bank]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await request('/api/ambassadors/bank',{method:'PUT',body:{holderName:form.holderName.value,bank:form.bank.value,clabe:form.clabe.value}});cache=null;toast('success','Cuenta protegida','La CLABE quedó cifrada y solo mostraremos sus últimos dígitos.');await render(root);}catch(error){toast('error',error.data?.code==='reauth-required'?'Vuelve a iniciar sesión':'No pudimos guardar la cuenta',error.message);button.disabled=false;}});
    root.querySelector('[data-amb-withdraw]')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button'),amount=Math.round(Number(form.amount.value)*100);if(!amount)return;button.disabled=true;try{var requestId=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));await request('/api/ambassadors/withdrawals',{method:'POST',body:{amountCents:amount,requestId:requestId}});cache=null;toast('success','Solicitud registrada','El saldo quedó reservado para que administración procese la transferencia.');await render(root);}catch(error){toast('error','No pudimos solicitar el retiro',error.message);button.disabled=false;}});
  }

  async function syncInvite(container){
    var button=container?.querySelector('#btn-ambassador-interest');if(!button||window.__isDemoMode)return;
    try{var data=await load();if(data.registered){button.firstChild.textContent='Ir a mi panel de Embajador ';button.dataset.registered='1';setMemberNav(true);}}catch(_){}
  }

  function showInfo(){
    if(!window.Modal)return;
    Modal.open({id:'ambassador-how-it-works',title:'¿Cómo funciona?',subtitle:'Condiciones reales del programa',icon:'i-info',size:'sm',body:'<div style="color:var(--text-2);font-size:12.5px;line-height:1.65"><ol style="margin:0;padding-left:18px;display:grid;gap:8px"><li>Activas tu perfil y recibes un código y enlace únicos.</li><li>Una persona nueva se registra mediante tu enlace.</li><li>La primera compra elegible se confirma directamente con Stripe.</li><li>La comisión permanece 7 días en validación y se revierte ante reembolso o contracargo.</li><li>Cuando esté disponible, solicitas una transferencia bancaria manual.</li></ol><p style="margin:13px 0 0;padding-top:12px;border-top:1px solid var(--line);font-size:11px">El código identifica al referido y no agrega descuentos. Las promociones existentes se respetan; la compra debe alcanzar el mínimo configurado para generar comisión.</p></div>',footer:'<button class="btn btn--accent" onclick="Modal.close(\'ambassador-how-it-works\')">Entendido</button>'});
  }

  captureRef();
  document.addEventListener('icadem:user-ready',function(){claimStoredRef();syncMemberNav();});
  window.ICADEMAmbassadors={render:render,syncInvite:syncInvite,showInfo:showInfo,claimStoredRef:claimStoredRef};
})();
