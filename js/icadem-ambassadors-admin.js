/* ICADEM Embajadores · consola administrativa. Todos los importes y estados
   proceden del backend; esta vista no calcula ni modifica saldos localmente. */
(function(){
  'use strict';

  var state={root:null,options:null,data:null,busy:false};
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});}
  function money(cents){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0,maximumFractionDigits:2}).format((Number(cents)||0)/100);}
  function date(value){if(!value)return '—';var d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});}
  function label(value){return({active:'Activo',suspended:'Suspendido',pending:'En validación',available:'Disponible',approved:'Aprobado',paid:'Pagado',reversed:'Revertida',rejected:'Rechazado',ineligible:'No elegible'}[value]||value||'—');}
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
    if(!items?.length)return '<tr><td colspan="5" class="amb-admin__empty">Aún no hay perfiles de Embajador.</td></tr>';
    return items.map(function(item){
      var next=item.status==='active'?'suspended':'active';
      return '<tr><td><strong>'+esc(item.code||'Sin código')+'</strong><div class="amb-admin__code">'+esc(item.id.slice(0,16))+'…</div></td><td>'+date(item.activatedAt)+'</td><td>'+(Number(item.stats?.attributed)||0)+'</td><td><span class="amb-admin__status amb-admin__status--'+esc(item.status)+'">'+esc(label(item.status))+'</span></td><td><div class="amb-admin__actions"><button class="amb-admin__btn '+(next==='suspended'?'amb-admin__btn--danger':'')+'" data-amb-status="'+esc(item.id)+'" data-next="'+next+'">'+(next==='suspended'?'Suspender':'Reactivar')+'</button></div></td></tr>';
    }).join('');
  }

  function commissionRows(items){
    if(!items?.length)return '<tr><td colspan="7" class="amb-admin__empty">Aún no hay compras atribuidas.</td></tr>';
    return items.slice(0,200).map(function(item){return '<tr><td><strong>'+esc(item.buyer)+'</strong></td><td class="amb-admin__code">'+esc((item.ambassadorUid||'—').slice(0,12))+'</td><td>'+esc(String(item.plan||'—').toUpperCase())+'</td><td>'+money(item.amountPaidCents)+'</td><td>'+money(item.commissionCents)+'</td><td><span class="amb-admin__status amb-admin__status--'+esc(item.status)+'">'+esc(label(item.status))+'</span></td><td>'+date(item.paidAt)+'</td></tr>';}).join('');
  }

  function withdrawalRows(items){
    if(!items?.length)return '<tr><td colspan="7" class="amb-admin__empty">No hay solicitudes de retiro.</td></tr>';
    return items.map(function(item){
      var actions='<button class="amb-admin__btn" data-amb-bank="'+esc(item.id)+'">Ver CLABE</button>';
      if(item.status==='pending')actions+='<button class="amb-admin__btn amb-admin__btn--primary" data-amb-withdraw="approve" data-id="'+esc(item.id)+'">Aprobar</button><button class="amb-admin__btn amb-admin__btn--danger" data-amb-withdraw="reject" data-id="'+esc(item.id)+'">Rechazar</button>';
      if(item.status==='approved')actions+='<button class="amb-admin__btn amb-admin__btn--primary" data-amb-pay="'+esc(item.id)+'">Adjuntar y pagar</button><button class="amb-admin__btn amb-admin__btn--danger" data-amb-withdraw="reject" data-id="'+esc(item.id)+'">Rechazar</button>';
      if(item.receiptUrl)actions+='<a class="amb-admin__btn" href="'+esc(item.receiptUrl)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">Comprobante</a>';
      return '<tr><td><strong>'+money(item.amountCents)+'</strong><div class="amb-admin__code">'+esc((item.uid||'—').slice(0,12))+'</div></td><td>'+esc(item.bank||'Banco')+' · •••• '+esc(item.bankLast4||'—')+'</td><td>'+date(item.requestedAt)+'</td><td><span class="amb-admin__status amb-admin__status--'+esc(item.status)+'">'+esc(label(item.status))+'</span></td><td colspan="3"><div class="amb-admin__actions">'+actions+'</div></td></tr>';
    }).join('');
  }

  function configCard(config){
    return '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Reglas del programa</h2><p>Los cambios aplican a atribuciones futuras; no reescriben comisiones existentes.</p></div></div><div class="amb-admin__card-body"><form class="amb-admin__form" id="amb-admin-config"><div class="amb-admin__form-grid">'+
      '<div class="amb-admin__field"><label>Comisión por compra elegible (MXN)</label><input name="commission" type="number" min="1" step="1" value="'+esc(Number(config.commissionCents||0)/100)+'" required></div>'+
      '<div class="amb-admin__field"><label>Descuento al invitado · primer pago (MXN)</label><input name="discount" type="number" min="1" step="1" value="'+esc(Number(config.discountCents||0)/100)+'" required></div>'+
      '<div class="amb-admin__field"><label>Compra mínima elegible (MXN)</label><input name="minimumPaid" type="number" min="1" step="1" value="'+esc(Number(config.minimumPaidCents||0)/100)+'" required></div>'+
      '<div class="amb-admin__field"><label>Días de validación</label><input name="validationDays" type="number" min="1" max="90" value="'+esc(config.validationDays)+'" required></div>'+
      '<div class="amb-admin__field"><label>Días de atribución</label><input name="attributionDays" type="number" min="1" max="180" value="'+esc(config.attributionDays)+'" required></div>'+
      '<div class="amb-admin__field"><label>Retiro mínimo (MXN)</label><input name="minimumWithdrawal" type="number" min="1" step="1" value="'+esc(Number(config.minimumWithdrawalCents||0)/100)+'" required></div>'+
      '<div class="amb-admin__field"><label>Versión de términos</label><input name="termsVersion" maxlength="60" value="'+esc(config.termsVersion)+'" required></div></div>'+
      '<div class="amb-admin__checks"><label><input type="checkbox" name="enabled" '+(config.enabled?'checked':'')+'> Programa habilitado</label><label><input type="checkbox" name="monthly" '+(config.eligiblePlans?.includes('mensual')?'checked':'')+'> Plan mensual elegible</label><label><input type="checkbox" name="annual" '+(config.eligiblePlans?.includes('anual')?'checked':'')+'> Plan anual elegible</label></div>'+
      '<div class="amb-admin__note">El descuento se resta del precio vigente de cada plan solo en el primer pago. Las renovaciones conservan su precio normal. La comisión usa la compra confirmada por Stripe.</div><button class="amb-admin__btn amb-admin__btn--primary" type="submit">Guardar reglas</button></form><form id="amb-admin-verify" class="amb-admin__form" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)"><div class="amb-admin__field"><label for="amb-verify-code">Verificar código y precios en Stripe</label><input id="amb-verify-code" name="code" maxlength="24" placeholder="Código de embajador (opcional)"></div><button class="amb-admin__btn" type="submit">Comprobar ambos planes</button><p class="amb-admin__note">Comprueba los importes vigentes sin cobrar ni crear membresías.</p><div id="amb-verify-result" role="status" aria-live="polite"></div></form></div></section>';
  }

  function render(){
    var data=state.data||{},reports=data.reports||{};
    state.root.innerHTML='<div class="amb-admin fade-up"><div class="amb-admin__hero"><div><div class="amb-admin__eyebrow">Programa ICADEM Embajadores</div><h1>Control, comisiones y retiros</h1><p>Administración segura del programa. Stripe confirma las compras; el servidor conserva la atribución, valida reembolsos y protege los datos bancarios.</p></div><div class="amb-admin__toolbar"><button class="amb-admin__btn" id="amb-admin-refresh">Actualizar</button><button class="amb-admin__btn amb-admin__btn--primary" id="amb-admin-release">Validar comisiones vencidas</button></div></div>'+kpis(reports)+'<div class="amb-admin__grid"><div class="amb-admin__stack">'+
      '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Solicitudes de retiro</h2><p>Revela la CLABE solo al procesar una transferencia. Cada acceso queda auditado.</p></div></div><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Monto / cuenta</th><th>Destino</th><th>Solicitud</th><th>Estado</th><th>Acciones</th><th></th><th></th></tr></thead><tbody>'+withdrawalRows(data.withdrawals)+'</tbody></table></div></section>'+
      '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Comisiones</h2><p>Importes reales pagados y estados determinados por el backend.</p></div></div><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Referido</th><th>Embajador</th><th>Plan</th><th>Compra</th><th>Comisión</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>'+commissionRows(data.commissions)+'</tbody></table></div></section>'+
      '<section class="amb-admin__card"><div class="amb-admin__card-head"><div><h2>Embajadores</h2><p>La suspensión desactiva el código sin borrar el historial económico.</p></div></div><div class="amb-admin__table-wrap"><table class="amb-admin__table"><thead><tr><th>Código / UID</th><th>Alta</th><th>Atribuidos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+ambassadorsRows(data.ambassadors)+'</tbody></table></div></section></div><div class="amb-admin__stack">'+configCard(data.config||{})+'</div></div></div>';
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

  function readFile(file){return new Promise(function(resolve,reject){if(!file)return reject(new Error('Selecciona un comprobante.'));if(file.size>2*1024*1024)return reject(new Error('El comprobante no puede superar 2 MB.'));var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(new Error('No se pudo leer el comprobante.'));};reader.readAsDataURL(file);});}

  function showBank(bank){
    var layer=document.createElement('div');layer.className='amb-admin__secure';layer.innerHTML='<div class="amb-admin__secure-card" role="dialog" aria-modal="true"><h3>Cuenta bancaria protegida</h3><p>Utiliza estos datos solo para esta transferencia. La consulta quedó registrada en auditoría.</p><div class="amb-admin__bank-line"><span>Titular</span><strong>'+esc(bank.holderName)+'</strong></div><div class="amb-admin__bank-line"><span>Banco</span><strong>'+esc(bank.bank)+'</strong></div><div class="amb-admin__bank-line"><span>CLABE</span><strong class="amb-admin__code">'+esc(bank.clabe)+'</strong></div><button class="amb-admin__btn amb-admin__btn--primary" type="button">Cerrar</button></div>';document.body.appendChild(layer);var close=function(){layer.remove();};layer.querySelector('button').addEventListener('click',close);layer.addEventListener('click',function(event){if(event.target===layer)close();});setTimeout(close,90000);
  }

  function bind(){
    state.root.querySelector('#amb-admin-verify')?.addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button'),result=state.root.querySelector('#amb-verify-result');button.disabled=true;result.textContent='Validando importes directamente con Stripe…';try{var data=await api('/admin/ambassadors/verify-checkout',{method:'POST',body:JSON.stringify({code:form.code.value.trim()})});result.innerHTML='<div class="amb-admin__note">'+data.plans.map(function(p){return '<p><strong>'+esc(p.plan==='anual'?'Plan anual':'Plan mensual')+': '+money(p.originalAmountCents)+' − '+money(p.discountCents)+' = '+money(p.totalAmountCents)+' MXN</strong><br>Confirmado por Stripe · primer pago</p>';}).join('')+'Sin cobros. Las sesiones de comprobación quedaron cerradas.<p>'+ (data.webhook?.ready?'Eventos de compra y devolución: configurados.':'Revisar eventos Stripe: '+esc((data.webhook?.missing||[]).join(', '))) +'</p></div>';}catch(error){result.textContent=error.message;}finally{button.disabled=false;}});
    state.root.querySelector('#amb-admin-refresh')?.addEventListener('click',function(){load();});
    state.root.querySelector('#amb-admin-release')?.addEventListener('click',function(event){action(event.currentTarget,function(){return api('/admin/ambassadors/release',{method:'POST'});},'La validación terminó correctamente.');});
    state.root.querySelector('#amb-admin-config')?.addEventListener('submit',function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button[type=submit]'),plans=[];if(form.monthly.checked)plans.push('mensual');if(form.annual.checked)plans.push('anual');if(!plans.length){toast('error','Selecciona un plan','Debe existir al menos un plan elegible.');return;}var body={enabled:form.enabled.checked,commissionCents:Math.round(Number(form.commission.value)*100),discountCents:Math.round(Number(form.discount.value)*100),minimumPaidCents:Math.round(Number(form.minimumPaid.value)*100),validationDays:Number(form.validationDays.value),attributionDays:Number(form.attributionDays.value),minimumWithdrawalCents:Math.round(Number(form.minimumWithdrawal.value)*100),termsVersion:form.termsVersion.value,eligiblePlans:plans};action(button,function(){return api('/admin/ambassadors/config',{method:'PUT',body:JSON.stringify(body)});},'Las reglas futuras quedaron actualizadas.');});
    state.root.querySelectorAll('[data-amb-status]').forEach(function(button){button.addEventListener('click',function(){var next=button.dataset.next;if(!confirm((next==='suspended'?'Suspender':'Reactivar')+' este perfil de Embajador?'))return;action(button,function(){return api('/admin/ambassadors/'+encodeURIComponent(button.dataset.ambStatus)+'/status',{method:'PATCH',body:JSON.stringify({status:next})});},next==='suspended'?'El código quedó suspendido.':'El código volvió a estar activo.');});});
    state.root.querySelectorAll('[data-amb-withdraw]').forEach(function(button){button.addEventListener('click',function(){var type=button.dataset.ambWithdraw,id=button.dataset.id,body={};if(type==='reject'){var reason=prompt('Motivo del rechazo (será parte de la auditoría):');if(reason===null)return;if(!reason.trim()){toast('error','Escribe un motivo','No se rechazó la solicitud.');return;}body.reason=reason.trim();}else if(!confirm('¿Aprobar esta solicitud para preparar la transferencia?'))return;action(button,function(){return api('/admin/ambassadors/withdrawals/'+encodeURIComponent(id)+'/'+type,{method:'POST',body:JSON.stringify(body)});},type==='approve'?'Solicitud aprobada; ahora adjunta el comprobante al pagar.':'Solicitud rechazada y saldo devuelto.');});});
    state.root.querySelectorAll('[data-amb-bank]').forEach(function(button){button.addEventListener('click',async function(){button.disabled=true;try{var data=await api('/admin/ambassadors/withdrawals/'+encodeURIComponent(button.dataset.ambBank)+'/bank');showBank(data.bank);}catch(error){toast('error','No se pudo revelar la cuenta',error.message);}finally{button.disabled=false;}});});
    state.root.querySelectorAll('[data-amb-pay]').forEach(function(button){button.addEventListener('click',function(){var input=document.createElement('input');input.type='file';input.accept='application/pdf,image/png,image/jpeg';input.addEventListener('change',async function(){if(!input.files?.[0])return;try{var receipt=await readFile(input.files[0]);if(!confirm('¿Confirmas que la transferencia ya fue realizada y este es su comprobante?'))return;action(button,function(){return api('/admin/ambassadors/withdrawals/'+encodeURIComponent(button.dataset.ambPay)+'/pay',{method:'POST',body:JSON.stringify({receiptDataUrl:receipt})});},'El retiro quedó pagado y el comprobante fue registrado.');}catch(error){toast('error','Comprobante inválido',error.message);}});input.click();});});
  }

  function mount(root,options){state.root=root;state.options=options;state.data=null;load();}
  window.ICADEMAmbassadorsAdmin={mount:mount};
  window.dispatchEvent(new CustomEvent('icadem:ambassadors-admin-ready'));
})();
