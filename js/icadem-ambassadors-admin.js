/* ICADEM Embajadores · consola administrativa. Todos los importes y estados
   proceden del backend; esta vista no calcula ni modifica saldos localmente. */
(function(){
  'use strict';

  var state={root:null,options:null,data:null,busy:false};
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function money(cents){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0,maximumFractionDigits:2}).format((Number(cents)||0)/100);}
  function date(value){if(!value)return '—';var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});}
  function label(value){return({active:'Activo',suspended:'Suspendido',pending:'En validación',available:'Disponible',approved:'Aprobado',paid:'Pagado',reversed:'Revertida',rejected:'Rechazado',ineligible:'No elegible'}[value]||value||'—');}
  function withdrawalLabel(value){return({pending:'Pendiente',approved:'En revisión',paid:'Pagada',rejected:'Rechazada'}[value]||label(value));}
  function toast(type,title,message){if(window.Toast?.[type])window.Toast[type](title,message);}

  async function api(path,options){
    var token=await state.options.getToken();
    var config=Object.assign({cache:'no-store'},options||{});
    config.headers=Object.assign({Authorization:'Bearer '+token},config.headers||{});
    if(config.body&&!config.headers['Content-Type'])config.headers['Content-Type']='application/json';
    var response=await fetch(state.options.api+path,config);
    var data=await response.json().catch(function(){return{};});
    if(!response.ok){var error=new Error(data.error||'No se pudo completar la operación.');error.status=response.status;throw error;}
    return data;
  }

  function loading(){state.root.innerHTML='<div class="amb-admin__loading"><div><div class="amb-admin__spin"></div>Sincronizando el programa de Embajadores…</div></div>';}

  function kpis(reports){
    var items=[
      ['Embajadores activos',reports.activeAmbassadors||0,'Perfiles habilitados'],
      ['Referidos confirmados',reports.confirmedReferrals||0,(reports.attributed||0)+' atribuciones registradas'],
      ['Ingresos referidos',money(reports.referredIncomeCents),'Pago real confirmado'],
      ['Comisiones pendientes',money(reports.pendingCommissionCents),(reports.pendingWithdrawals||0)+' retiros por procesar'],
      ['Retiros pagados',money(reports.paidWithdrawalCents),'Transferencias registradas']
    ];
    return '<div class="amb-admin__kpis">'+items.map(function(item){return '<div class="amb-admin__kpi"><small>'+esc(item[0])+'</small><strong>'+esc(item[1])+'</strong><span>'+esc(item[2])+'</span></div>';}).join('')+'</div>';
  }

  function ambassadorsRows(items){
    if(!items?.length)return '<tr><td colspan="8" class="amb-admin__empty">No hay perfiles para este filtro.</td></tr>';
    return items.map(function(item){
      var next=item.status==='active'?'suspended':'active';
      var phone=String(item.whatsapp||''),contact=/^\+[1-9]\d{7,14}$/.test(phone)?'<a class="amb-admin__btn" href="https://wa.me/'+esc(phone.slice(1))+'" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>':'<span class="amb-admin__code">Sin número</span>';
      return '<tr><td><strong>'+esc(item.name||item.code||'Sin nombre')+'</strong><div class="amb-admin__code">'+esc(item.code||'Sin código')+'</div></td><td>'+esc(item.category==='vip'?'VIP':'Gratuito')+'</td><td>'+esc(item.sponsorCode||'—')+'</td><td>'+date(item.activatedAt)+'</td><td>'+(Number(item.stats?.attributed)||0)+'</td><td><span class="amb-admin__status amb-admin__status--'+esc(item.status)+'">'+esc(label(item.status))+'</span></td><td>'+esc(phone||'—')+'</td><td><div class="amb-admin__actions">'+contact+'<button class="amb-admin__btn" data-amb-detail="'+esc(item.id)+'">Detalle</button><button class="amb-admin__btn '+(next==='suspended'?'amb-admin__btn--danger':'')+'" data-amb-status="'+esc(item.id)+'" data-next="'+next+'">'+(next==='suspended'?'Suspender':'Reactivar')+'</button></div></td></tr>';
    }).join('');
  }

  function commissionRows(items){
    if(!items?.length)return '<tr><td colspan="7" class="amb-admin__empty">Aún no hay compras atribuidas.</td></tr>';
    return items.slice(0,200).map(function(item){return '<tr><td><strong>'+esc(item.buyer)+'</strong></td><td class="amb-admin__code">'+esc((item.ambassadorUid||'—').slice(0,12))+'</td><td>'+esc(String(item.plan||'—').toUpperCase())+'</td><td>'+money(item.amountPaidCents)+'</td><td>'+money(item.commissionCents)+'</td><td><span class="amb-admin__status amb-admin__status--'+esc(item.status)+'">'+esc(label(item.status))+'</span></td><td>'+date(item.paidAt)+'</td></tr>';}).join('');
  }

  function withdrawalRows(items,ambassadors){
    if(!items?.length)return '<tr><td colspan="7" class="amb-admin__empty">No hay solicitudes de retiro.</td></tr>';
    return items.map(function(item){
      var actions='<button class="amb-admin__btn" data-amb-bank="'+esc(item.id)+'">Ver CLABE</button>';
      var ambassador=(ambassadors||[]).find(function(a){return a.id===item.uid;})||{},phone=String(ambassador.whatsapp||'');
      if(/^\+[1-9]\d{7,14}$/.test(phone))actions+='<a class="amb-admin__btn" href="https://wa.me/'+esc(phone.slice(1))+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>';
      if(item.status==='pending')actions+='<button class="amb-admin__btn amb-admin__btn--primary" data-amb-withdraw="approve" data-id="'+esc(item.id)+'">Revisar solicitud</button><button class="amb-admin__btn amb-admin__btn--danger" data-amb-withdraw="reject" data-id="'+esc(item.id)+'">Rechazar</button>';
      if(item.status==='approved')actions+='<button class="amb-admin__btn amb-admin__btn--success" data-amb-pay="'+esc(item.id)+'">Marcar como pagada</button><button class="amb-admin__btn amb-admin__btn--danger" data-amb-withdraw="reject" data-id="'+esc(item.id)+'">Rechazar</button>';
      if(item.hasReceipt||item.receiptUrl)actions+='<button class="amb-admin__btn" type="button" data-amb-receipt="'+esc(item.id)+'">Comprobante</button>';
      return '<tr><td><strong>'+money(item.amountCents)+'</strong><div class="amb-admin__withdrawal-name">'+esc(ambassador.name||item.uid||'Embajador')+'</div><div class="amb-admin__code">ID: '+esc(item.id)+'</div></td><td>'+esc(item.bank||'Banco')+' · •••• '+esc(item.bankLast4||'—')+'<div class="amb-admin__withdrawal-name">'+esc(item.holderName||'Titular en vista protegida')+'</div></td><td>'+date(item.requestedAt)+(item.bankReference?'<div class="amb-admin__reference">Ref. '+esc(item.bankReference)+'</div>':'')+'</td><td><span class="amb-admin__status amb-admin__status--'+esc(item.status)+'">'+esc(withdrawalLabel(item.status))+'</span></td><td colspan="3"><div class="amb-admin__actions">'+actions+'</div></td></tr>';
    }).join('');
  }

  function configCard(config){
    return '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Reglas del programa</h2><p>Los cambios aplican a atribuciones futuras; no reescriben comisiones existentes.</p></div></div><div class="amb-admin__card-body"><form class="amb-admin__form" id="amb-admin-config"><div class="amb-admin__form-grid">'+
      [['Comisión directa VIP','directCommissionVipCents'],['Comisión directa gratuita','directCommissionFreeCents'],['Descuento mensual VIP','monthlyDiscountVipCents'],['Descuento anual VIP','annualDiscountVipCents'],['Descuento mensual gratuito','monthlyDiscountFreeCents'],['Descuento anual gratuito','annualDiscountFreeCents']].map(function(field){return '<div class="amb-admin__field"><label>'+field[0]+' (MXN)</label><input name="'+field[1]+'" type="number" min="1" step="1" value="'+esc(Number(config[field[1]]||0)/100)+'" required></div>';}).join('')+
      '<div class="amb-admin__field"><label>Compra mínima elegible (MXN)</label><input name="minimumPaid" type="number" min="1" step="1" value="'+esc(Number(config.minimumPaidCents||0)/100)+'" required></div>'+
      '<div class="amb-admin__field"><label>Días de validación</label><input name="validationDays" type="number" min="1" max="90" value="'+esc(config.validationDays)+'" required></div>'+
      '<div class="amb-admin__field"><label>Días de atribución</label><input name="attributionDays" type="number" min="1" max="180" value="'+esc(config.attributionDays)+'" required></div>'+
      '<div class="amb-admin__field"><label>Retiro mínimo (MXN)</label><input name="minimumWithdrawal" type="number" min="1" step="1" value="'+esc(Number(config.minimumWithdrawalCents||0)/100)+'" required></div>'+
      '<div class="amb-admin__field"><label>Versión de términos</label><input name="termsVersion" maxlength="60" value="'+esc(config.termsVersion)+'" required></div></div>'+
      '<div class="amb-admin__checks"><label><input type="checkbox" name="enabled" '+(config.enabled?'checked':'')+'> Programa habilitado</label><label><input type="checkbox" name="monthly" '+(config.eligiblePlans?.includes('mensual')?'checked':'')+'> Plan mensual elegible</label><label><input type="checkbox" name="annual" '+(config.eligiblePlans?.includes('anual')?'checked':'')+'> Plan anual elegible</label></div>'+
      '<div class="amb-admin__note">El descuento se resta del precio vigente de cada plan solo en el primer pago. Las renovaciones conservan su precio normal. La comisión usa la compra confirmada por Stripe.</div><button class="amb-admin__btn amb-admin__btn--primary" type="submit">Guardar reglas</button></form><form id="amb-admin-verify" class="amb-admin__form" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)"><div class="amb-admin__field"><label for="amb-verify-code">Verificar código y precios en Stripe</label><input id="amb-verify-code" name="code" maxlength="24" placeholder="Código de embajador (opcional)"></div><button class="amb-admin__btn" type="submit">Comprobar ambos planes</button><p class="amb-admin__note">Comprueba los importes vigentes sin cobrar ni crear membresías.</p><div id="amb-verify-result" role="status" aria-live="polite"></div></form></div></section>';
  }

  function proposalCard(config){
    var proposal=config.indirectProposal||{},vip=proposal.vipCents||[2000,1000,500,300,200,100],free=proposal.freeCents||[1000,500,300,200,100,100];
    return '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Red indirecta · propuesta</h2><p>Los niveles 2 al 7 se registran como propuesta. Actualmente no se generan ni pagan comisiones indirectas.</p></div></div><div class="amb-admin__card-body"><form id="amb-admin-proposal" class="amb-admin__form"><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Nivel</th><th>VIP · MXN</th><th>Gratuito · MXN</th></tr></thead><tbody>'+vip.map(function(value,i){return '<tr><td>'+(i+2)+'</td><td><input aria-label="Nivel '+(i+2)+' VIP" name="vip'+i+'" type="number" min="0" step="1" value="'+esc(value/100)+'" required></td><td><input aria-label="Nivel '+(i+2)+' gratuito" name="free'+i+'" type="number" min="0" step="1" value="'+esc((free[i]||0)/100)+'" required></td></tr>';}).join('')+'</tbody></table></div><div class="amb-admin__form-grid"><div class="amb-admin__field"><label>Presupuesto máximo mensual por venta (MXN)</label><input name="maxTotalMonthly" type="number" min="0" step="1" value="'+esc(Number(proposal.maxTotalMonthlyCents||0)/100)+'" required></div><div class="amb-admin__field"><label>Presupuesto máximo anual por venta (MXN)</label><input name="maxTotalAnnual" type="number" min="0" step="1" value="'+esc(Number(proposal.maxTotalAnnualCents||0)/100)+'" required></div></div><div class="amb-admin__note">Estado: desactivado. Los presupuestos y montos son preparatorios; su captura no activa pagos. Antes de cualquier activación se requiere aprobación y una validación de rentabilidad contra el importe realmente pagado.</div><button class="amb-admin__btn" type="submit">Guardar propuesta sin activar</button></form></div></section>';
  }

  function render(){
    var data=state.data||{},reports=data.reports||{};
    state.root.innerHTML='<div class="amb-admin fade-up"><div class="amb-admin__hero"><div><div class="amb-admin__eyebrow">Programa ICADEM Embajadores</div><h1>Control, comisiones y retiros</h1><p>Administración segura del programa. Stripe confirma las compras; el servidor conserva la atribución, valida reembolsos y protege los datos bancarios.</p></div><div class="amb-admin__toolbar"><button class="amb-admin__btn" id="amb-admin-refresh">Actualizar</button><button class="amb-admin__btn amb-admin__btn--primary" id="amb-admin-release">Validar comisiones vencidas</button></div></div>'+kpis(reports)+'<div class="amb-admin__grid"><div class="amb-admin__stack">'+
      '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Solicitudes de retiro</h2><p>Revela la CLABE solo al procesar una transferencia. Cada acceso queda auditado.</p></div></div><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Monto / cuenta</th><th>Destino</th><th>Solicitud</th><th>Estado</th><th>Acciones</th><th></th><th></th></tr></thead><tbody>'+withdrawalRows(data.withdrawals,data.ambassadors)+'</tbody></table></div></section>'+
      '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Comisiones</h2><p>Importes reales pagados y estados determinados por el backend.</p></div></div><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Referido</th><th>Embajador</th><th>Plan</th><th>Compra</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>'+commissionRows(data.commissions)+'</tbody></table></div></section>'+
      '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Embajadores</h2><p>Categoría actual, patrocinador, contacto y estado. La suspensión conserva el historial económico.</p></div><div class="amb-admin__actions"><select id="amb-admin-category" aria-label="Filtrar categoría"><option value="all">Todas las categorías</option><option value="vip">VIP</option><option value="free">Gratuitos</option></select><select id="amb-admin-status" aria-label="Filtrar estado"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="suspended">Suspendidos</option></select></div></div><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Embajador / código</th><th>Categoría</th><th>Patrocinador</th><th>Alta</th><th>Atribuidos</th><th>Estado</th><th>WhatsApp</th><th>Acción</th></tr></thead><tbody id="amb-admin-ambassadors">'+ambassadorsRows(data.ambassadors)+'</tbody></table></div></section></div><div class="amb-admin__stack">'+configCard(data.config||{})+proposalCard(data.config||{})+'</div></div></div>';
    bind();
  }

  async function load(silent){
    if(state.busy)return;state.busy=true;if(!silent)loading();
    try{var payload=await api('/admin/ambassadors');state.data=payload;render();}
    catch(error){state.root.innerHTML='<div class="amb-admin__loading"><div><strong>No pudimos cargar Embajadores</strong><p>'+esc(error.message)+'</p><button class="amb-admin__btn amb-admin__btn--primary" id="amb-admin-retry">Reintentar</button></div></div>';state.root.querySelector('#amb-admin-retry')?.addEventListener('click',function(){load();});toast('error','Embajadores',error.message);}
    finally{state.busy=false;}
  }

  async function action(button,task,success){
    if(button)button.disabled=true;
    try{await task();toast('success','Embajadores',success);await load(true);}catch(error){toast('error','No se pudo completar',error.message);if(button)button.disabled=false;}
  }

  function readFile(file){return new Promise(function(resolve,reject){if(!file)return reject(new Error('Selecciona un comprobante.'));if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return reject(new Error('Utiliza un comprobante PDF, PNG o JPG.'));if(file.size>2*1024*1024)return reject(new Error('El comprobante no puede superar 2 MB.'));var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(new Error('No se pudo leer el comprobante.'));};reader.readAsDataURL(file);});}

  function paymentMarkup(item,ambassador){
    return '<div class="amb-admin__secure-card amb-admin__payment-card" role="dialog" aria-modal="true" aria-labelledby="amb-payment-title" aria-describedby="amb-payment-description"><div class="amb-admin__payment-heading"><span class="amb-admin__payment-icon" aria-hidden="true">✓</span><span>Confirmación administrativa</span></div><h3 id="amb-payment-title">Registrar transferencia realizada</h3><p id="amb-payment-description">¿Confirmas que ya realizaste esta transferencia bancaria?</p><div class="amb-admin__payment-amount"><small>Importe de la solicitud</small><strong>'+money(item.amountCents)+' <span>MXN</span></strong></div><div class="amb-admin__payment-summary"><div class="amb-admin__bank-line"><span>Embajador</span><strong>'+esc(ambassador.name||item.uid||'Embajador')+'</strong></div><div class="amb-admin__bank-line"><span>Titular</span><strong>'+esc(item.holderName||'Consultar vista protegida')+'</strong></div><div class="amb-admin__bank-line"><span>Banco</span><strong>'+esc(item.bank||'Banco no registrado')+'</strong></div><div class="amb-admin__bank-line"><span>CLABE</span><strong>•••• '+esc(item.bankLast4||'—')+'</strong></div><div class="amb-admin__bank-line"><span>Solicitud</span><strong class="amb-admin__code">'+esc(item.id)+'</strong></div></div><form class="amb-admin__form" data-amb-payment-form><div class="amb-admin__field"><label for="amb-payment-reference">Referencia bancaria</label><input id="amb-payment-reference" name="bankReference" maxlength="120" autocomplete="off" placeholder="Referencia o folio del pago realizado" required></div><div class="amb-admin__field"><label for="amb-payment-receipt">Comprobante <span class="amb-admin__optional">(opcional)</span></label><input id="amb-payment-receipt" name="receipt" type="file" accept="application/pdf,image/png,image/jpeg" aria-describedby="amb-payment-file-help"><small id="amb-payment-file-help">PDF, PNG o JPG · máximo 2 MB · acceso privado</small></div><label class="amb-admin__payment-check"><input name="confirmed" type="checkbox" required><span>Confirmo que la transferencia bancaria ya fue realizada.</span></label><div class="amb-admin__payment-feedback" data-amb-payment-feedback role="status" aria-live="polite"></div><p class="amb-admin__payment-note">Este registro confirma un pago manual. ICADEM no envía dinero desde este botón.</p><div class="amb-admin__payment-actions"><button class="amb-admin__btn" type="button" data-amb-payment-cancel>Cancelar</button><button class="amb-admin__btn amb-admin__btn--success" type="submit" data-amb-payment-confirm>Confirmar pago realizado</button></div></form></div>';
  }

  function showPayConfirmation(item,trigger){
    if(!item||item.status!=='approved'||document.querySelector('.amb-admin__payment'))return;
    var ambassador=(state.data?.ambassadors||[]).find(function(a){return a.id===item.uid;})||{};
    var layer=document.createElement('div');layer.className='amb-admin__secure amb-admin__payment';layer.innerHTML=paymentMarkup(item,ambassador);document.body.appendChild(layer);
    var form=layer.querySelector('[data-amb-payment-form]'),feedback=layer.querySelector('[data-amb-payment-feedback]'),submit=layer.querySelector('[data-amb-payment-confirm]'),busy=false;
    var close=function(){if(busy)return;layer.remove();if(trigger?.isConnected)trigger.focus();};
    layer.querySelector('[data-amb-payment-cancel]').addEventListener('click',close);
    layer.addEventListener('click',function(event){if(event.target===layer)close();});
    layer.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){var targets=Array.from(layer.querySelectorAll('input:not(:disabled),button:not(:disabled)')),first=targets[0],last=targets[targets.length-1];if(!targets.length){event.preventDefault();return;}if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(busy)return;
      var reference=form.elements.bankReference.value.trim();
      if(!form.reportValidity())return;
      if(!reference||!form.elements.confirmed.checked){feedback.textContent='Escribe la referencia y confirma que el pago ya se realizó.';return;}
      busy=true;form.setAttribute('aria-busy','true');layer.querySelectorAll('input,button').forEach(function(control){control.disabled=true;});submit.textContent='Guardando confirmación…';feedback.classList.remove('is-error');feedback.textContent='Espera mientras el servidor registra el pago.';
      try{
        var body={confirmed:true,bankReference:reference},file=form.elements.receipt.files?.[0];
        if(file)body.receiptDataUrl=await readFile(file);
        await api('/admin/ambassadors/withdrawals/'+encodeURIComponent(item.id)+'/pay',{method:'POST',body:JSON.stringify(body)});
        busy=false;close();toast('success','Transferencia registrada','La solicitud está pagada. El historial y la notificación del embajador se actualizaron.');await load(true);
      }catch(error){busy=false;form.removeAttribute('aria-busy');layer.querySelectorAll('input,button').forEach(function(control){control.disabled=false;});submit.textContent='Confirmar pago realizado';feedback.classList.add('is-error');feedback.textContent=error.message;}
    });
    form.elements.bankReference.focus();
  }

  async function downloadReceipt(id,button){
    button.disabled=true;
    try{
      var token=await state.options.getToken(),response=await fetch(state.options.api+'/admin/ambassadors/withdrawals/'+encodeURIComponent(id)+'/receipt',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
      if(!response.ok){var error=await response.json().catch(function(){return{};});throw new Error(error.error||'No se pudo consultar el comprobante.');}
      var blob=await response.blob(),extension=blob.type==='application/pdf'?'pdf':blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':'';
      if(!extension)throw new Error('El archivo no tiene un formato de comprobante válido.');
      var url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='comprobante-'+id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.'+extension;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},60000);
    }catch(error){toast('error','Comprobante protegido',error.message);}finally{button.disabled=false;}
  }

  function showBank(bank){
    var layer=document.createElement('div');layer.className='amb-admin__secure';layer.innerHTML='<div class="amb-admin__secure-card" role="dialog" aria-modal="true"><h3>Cuenta bancaria protegida</h3><p>Utiliza estos datos solo para esta transferencia. La consulta quedó registrada en auditoría.</p><div class="amb-admin__bank-line"><span>Titular</span><strong>'+esc(bank.holderName)+'</strong></div><div class="amb-admin__bank-line"><span>Banco</span><strong>'+esc(bank.bank)+'</strong></div><div class="amb-admin__bank-line"><span>CLABE</span><strong class="amb-admin__code">'+esc(bank.clabe)+'</strong></div><button class="amb-admin__btn amb-admin__btn--primary" type="button">Cerrar</button></div>';document.body.appendChild(layer);var close=function(){layer.remove();};layer.querySelector('button').addEventListener('click',close);layer.addEventListener('click',function(event){if(event.target===layer)close();});setTimeout(close,90000);
  }

  function showAmbassadorDetail(item){
    var data=state.data||{},commissions=(data.commissions||[]).filter(function(c){return c.ambassadorUid===item.id;}),withdrawals=(data.withdrawals||[]).filter(function(w){return w.uid===item.id;}),wallet=item.wallet||{},phone=String(item.whatsapp||'');
    var contact=/^\+[1-9]\d{7,14}$/.test(phone)?'<a class="amb-admin__btn" href="https://wa.me/'+esc(phone.slice(1))+'" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>':'';
    var layer=document.createElement('div');layer.className='amb-admin__secure';layer.innerHTML='<div class="amb-admin__secure-card" role="dialog" aria-modal="true" aria-label="Detalle del embajador"><h3>'+esc(item.name||'Embajador')+'</h3><p>'+esc(item.category==='vip'?'Embajador VIP':'Embajador gratuito')+' · '+esc(label(item.status))+'</p><div class="amb-admin__bank-line"><span>Código</span><strong>'+esc(item.code)+'</strong></div><div class="amb-admin__bank-line"><span>Patrocinador</span><strong>'+esc(item.sponsorCode||'Sin patrocinador registrado')+'</strong></div><div class="amb-admin__bank-line"><span>WhatsApp</span><strong>'+esc(phone||'No registrado')+'</strong></div><div class="amb-admin__bank-line"><span>Ventas directas confirmadas</span><strong>'+esc(item.stats?.paidReferrals||0)+'</strong></div><div class="amb-admin__bank-line"><span>Comisiones en validación</span><strong>'+money(wallet.pendingCents)+'</strong></div><div class="amb-admin__bank-line"><span>Saldo disponible</span><strong>'+money(wallet.availableCents)+'</strong></div><div class="amb-admin__bank-line"><span>Retiros registrados</span><strong>'+withdrawals.length+'</strong></div><div class="amb-admin__bank-line"><span>Movimientos de comisión visibles</span><strong>'+commissions.length+'</strong></div><div class="amb-admin__actions">'+contact+'<button class="amb-admin__btn amb-admin__btn--primary" type="button" data-close>Volver al listado</button></div></div>';document.body.appendChild(layer);
    var close=function(){layer.remove();};layer.querySelector('[data-close]').addEventListener('click',close);layer.addEventListener('click',function(event){if(event.target===layer)close();});layer.addEventListener('keydown',function(event){if(event.key==='Escape')close();});layer.querySelector('[data-close]').focus();
  }

  function bindStatusActions(){
    state.root.querySelectorAll('[data-amb-detail]').forEach(function(button){button.addEventListener('click',function(){var item=(state.data?.ambassadors||[]).find(function(a){return a.id===button.dataset.ambDetail;});if(item)showAmbassadorDetail(item);});});
    state.root.querySelectorAll('[data-amb-status]').forEach(function(button){button.addEventListener('click',function(){var next=button.dataset.next;if(!confirm((next==='suspended'?'Suspender':'Reactivar')+' este perfil de Embajador?'))return;action(button,function(){return api('/admin/ambassadors/'+encodeURIComponent(button.dataset.ambStatus)+'/status',{method:'PATCH',body:JSON.stringify({status:next})});},next==='suspended'?'El código quedó suspendido.':'El código volvió a estar activo.');});});
  }

  function bind(){
    ['amb-admin-category','amb-admin-status'].forEach(function(id){state.root.querySelector('#'+id)?.addEventListener('change',function(){var category=state.root.querySelector('#amb-admin-category').value,status=state.root.querySelector('#amb-admin-status').value;var items=(state.data?.ambassadors||[]).filter(function(item){return(category==='all'||item.category===category)&&(status==='all'||item.status===status);});state.root.querySelector('#amb-admin-ambassadors').innerHTML=ambassadorsRows(items);bindStatusActions();});});
    state.root.querySelector('#amb-admin-verify')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button'),result=state.root.querySelector('#amb-verify-result');button.disabled=true;result.textContent='Validando importes directamente con Stripe…';try{var data=await api('/admin/ambassadors/verify-checkout',{method:'POST',body:JSON.stringify({code:form.code.value.trim()})});result.innerHTML='<div class="amb-admin__note">'+data.plans.map(function(p){return '<p><strong>'+esc(p.plan==='anual'?'Plan anual':'Plan mensual')+': '+money(p.originalAmountCents)+' − '+money(p.discountCents)+' = '+money(p.totalAmountCents)+' MXN</strong><br>Confirmado por Stripe · primer pago</p>';}).join('')+'Sin cobros. Las sesiones de comprobación quedaron cerradas.<p>'+ (data.webhook?.ready?'Eventos de compra y devolución: configurados.':'Revisar eventos Stripe: '+esc((data.webhook?.missing||[]).join(', '))) +'</p></div>';}catch(error){result.textContent=error.message;}finally{button.disabled=false;}});
    state.root.querySelector('#amb-admin-refresh')?.addEventListener('click',function(){load();});
    state.root.querySelector('#amb-admin-release')?.addEventListener('click',function(event){action(event.currentTarget,function(){return api('/admin/ambassadors/release',{method:'POST'});},'La validación terminó correctamente.');});
    state.root.querySelector('#amb-admin-config')?.addEventListener('submit',function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button[type=submit]'),plans=[];if(form.monthly.checked)plans.push('mensual');if(form.annual.checked)plans.push('anual');if(!plans.length){toast('error','Selecciona un plan','Debe existir al menos un plan elegible.');return;}var body={enabled:form.enabled.checked,minimumPaidCents:Math.round(Number(form.minimumPaid.value)*100),validationDays:Number(form.validationDays.value),attributionDays:Number(form.attributionDays.value),minimumWithdrawalCents:Math.round(Number(form.minimumWithdrawal.value)*100),termsVersion:form.termsVersion.value,eligiblePlans:plans};['directCommissionVipCents','directCommissionFreeCents','monthlyDiscountVipCents','annualDiscountVipCents','monthlyDiscountFreeCents','annualDiscountFreeCents'].forEach(function(key){body[key]=Math.round(Number(form.elements[key].value)*100);});action(button,function(){return api('/admin/ambassadors/config',{method:'PUT',body:JSON.stringify(body)});},'Las reglas futuras quedaron actualizadas.');});
    state.root.querySelector('#amb-admin-proposal')?.addEventListener('submit',function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button[type=submit]'),vip=[],free=[];for(var i=0;i<6;i++){vip.push(Math.round(Number(form.elements['vip'+i].value)*100));free.push(Math.round(Number(form.elements['free'+i].value)*100));}var indirectProposal={enabled:false,vipCents:vip,freeCents:free,maxTotalMonthlyCents:Math.round(Number(form.maxTotalMonthly.value)*100),maxTotalAnnualCents:Math.round(Number(form.maxTotalAnnual.value)*100)};action(button,function(){return api('/admin/ambassadors/config',{method:'PUT',body:JSON.stringify({indirectProposal:indirectProposal})});},'La propuesta quedó guardada; los pagos indirectos permanecen desactivados.');});
    bindStatusActions();
    state.root.querySelectorAll('[data-amb-withdraw]').forEach(function(button){button.addEventListener('click',function(){var type=button.dataset.ambWithdraw,id=button.dataset.id,body={};if(type==='reject'){var reason=prompt('Motivo del rechazo (será parte de la auditoría):');if(reason===null)return;if(!reason.trim()){toast('error','Escribe un motivo','No se rechazó la solicitud.');return;}body.reason=reason.trim();}else if(!confirm('¿Pasar esta solicitud a revisión para preparar la transferencia manual?'))return;action(button,function(){return api('/admin/ambassadors/withdrawals/'+encodeURIComponent(id)+'/'+type,{method:'POST',body:JSON.stringify(body)});},type==='approve'?'Solicitud en revisión. Registra el pago únicamente después de realizar la transferencia.':'Solicitud rechazada y saldo devuelto.');});});
    state.root.querySelectorAll('[data-amb-bank]').forEach(function(button){button.addEventListener('click',async function(){button.disabled=true;try{var data=await api('/admin/ambassadors/withdrawals/'+encodeURIComponent(button.dataset.ambBank)+'/bank');showBank(data.bank);}catch(error){toast('error','No se pudo revelar la cuenta',error.message);}finally{button.disabled=false;}});});
    state.root.querySelectorAll('[data-amb-pay]').forEach(function(button){button.addEventListener('click',function(){var item=(state.data?.withdrawals||[]).find(function(w){return w.id===button.dataset.ambPay;});showPayConfirmation(item,button);});});
    state.root.querySelectorAll('[data-amb-receipt]').forEach(function(button){button.addEventListener('click',function(){downloadReceipt(button.dataset.ambReceipt,button);});});
  }

  function mount(root,options){state.root=root;state.options=options;state.data=null;load();}
  window.ICADEMAmbassadorsAdmin={mount:mount};
  window.dispatchEvent(new CustomEvent('icadem:ambassadors-admin-ready'));
})();
