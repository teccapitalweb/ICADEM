/* Commission conversions use the same authenticated credit wallet as purchases. */
(function(){
  'use strict';
  var active=null,attempts=new Map(),generation=0;
  function uid(){return String((window.__auth?window.__auth.currentUser:window.__currentUser)?.uid||'');}
  function validSession(owner,epoch){return Boolean(owner&&uid()===owner&&!window.__sessionEnding&&epoch===generation);}
  function money(cents){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(cents/100);}
  function quantity(value){return new Intl.NumberFormat('es-MX').format(value);}
  function amount(value,max,retry){var text=String(value).trim();if(!/^\d+$/.test(text))return 0;var pesos=Number(text);return Number.isSafeInteger(pesos)&&pesos>=1&&Number.isSafeInteger(pesos*100)&&(retry||pesos<=max)?pesos*100:0;}
  function requestId(){return window.crypto?.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);}
  function notify(type,title,message){window.Toast?.[type]?.(title,message);}
  function isOpen(){return Boolean(active);}
  function hasPending(){return Boolean(attempts.get(uid())?.uncertain);}
  async function open(options){
    options=options||{};if(active||!window.Modal||window.__sessionEnding)return;
    var owner=uid(),epoch=generation;if(!owner)return;
    if(navigator.onLine===false){notify('error','Sin conexión','Conéctate para consultar tu saldo disponible.');return;}
    var ticket={owner:owner,loading:true};active=ticket;
    var data;
    try{data=await window.ICADEMAmbassadors.getSummary(true);}catch(error){if(validSession(owner,epoch))notify('error','No pudimos consultar tu saldo',error.message);if(active===ticket)active=null;return;}
    if(!validSession(owner,epoch)){if(active===ticket)active=null;return;}
    var wallet=data.wallet||{},available=Number(wallet.availableCents)||0,max=Math.floor(available/100),previous=attempts.get(owner),retry=Boolean(previous?.uncertain);
    if(!data.registered||!data.ambassador?.active||Number(wallet.debtCents)>0||(!max&&!retry)){active=null;notify('info','Conversión no disponible',Number(wallet.debtCents)>0?'Hay un ajuste de saldo pendiente. Contacta a soporte.':'Necesitas al menos $1 MXN de comisiones disponibles para convertir.');return;}
    var initial=retry?previous.amountCents/100:'',saving=false,closed=false,id='amb-commission-conversion',handle;
    ticket.loading=false;
    handle=window.Modal.open({id:id,title:'Convierte tus ganancias en créditos',subtitle:'Utiliza tus ganancias dentro de ICADEM',icon:'i-gift',size:'sm',closeOnBackdrop:false,beforeClose:function(){return !saving||!validSession(owner,epoch);},onClose:function(){closed=true;if(active===ticket)active=null;if(validSession(owner,epoch))window.ICADEMAmbassadors.refresh?.();},
      body:'<form class="acc-form" data-commission-conversion novalidate><div class="acc-balance"><span>Comisiones disponibles</span><strong>'+money(available)+' <small>MXN</small></strong></div><div class="acc-rate">$1 MXN = 1 crédito ICADEM</div><label class="acc-label" for="acc-amount">Monto a convertir en MXN</label><div class="acc-input-row"><input id="acc-amount" name="amount" type="number" inputmode="numeric" min="1" step="1" max="'+max+'" placeholder="Ej. 100" value="'+initial+'" autocomplete="off" aria-describedby="acc-help acc-error" '+(retry?'readonly':'')+'><button type="button" class="acc-all" data-convert-all '+(retry?'disabled':'')+'>Convertir todo mi saldo</button></div><p class="acc-help" id="acc-help">Solo pesos enteros.'+(available%100?' Los '+money(available%100)+' MXN de centavos permanecen en tus comisiones.':'')+'</p><div class="acc-preview" aria-live="polite"><div><span>Recibirás</span><strong data-convert-credits>0 créditos</strong></div><div><span>Saldo restante en comisiones</span><strong data-convert-remaining>'+money(available)+' MXN</strong></div></div><p class="acc-warning">La conversión es definitiva. Los créditos se pueden utilizar dentro de ICADEM; no se pueden retirar ni volver a convertir en dinero.</p><p class="acc-error" id="acc-error" role="alert">'+(retry?'Hay una solicitud sin confirmar. Reintenta para consultar su resultado sin duplicar la conversión.':'')+'</p><div class="acc-actions"><button type="button" class="amb-btn amb-btn--ghost" data-convert-cancel>Cancelar</button><button type="submit" class="amb-btn acc-confirm" data-convert-submit disabled>Confirmar conversión</button></div></form>'});
    var root=document.querySelector('[data-modal-id="'+id+'"]'),form=root?.querySelector('[data-commission-conversion]');
    if(!form){handle.close();active=null;return;}
    var input=form.querySelector('#acc-amount'),submit=form.querySelector('[data-convert-submit]'),all=form.querySelector('[data-convert-all]'),cancel=form.querySelector('[data-convert-cancel]'),errorNode=form.querySelector('#acc-error');
    function current(){return !closed&&root.isConnected&&validSession(owner,epoch);}
    function preview(clearError){var cents=amount(input.value,max,retry);form.querySelector('[data-convert-credits]').textContent=quantity(cents/100)+' créditos';form.querySelector('[data-convert-remaining]').textContent=retry?'Se verificará con el servidor':money(available-cents)+' MXN';submit.disabled=saving||!cents;input.setAttribute('aria-invalid',String(Boolean(input.value)&&!cents));if(!retry&&(clearError||input.value&&!cents))errorNode.textContent=input.value&&!cents?'Ingresa un monto en pesos enteros entre $1 y '+money(max*100)+' MXN.':'';}
    input.addEventListener('input',function(){preview(true);});
    all.addEventListener('click',function(){if(saving||retry)return;input.value=String(max);preview(true);input.focus();});
    cancel.addEventListener('click',function(){if(!saving)handle.close();});
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(saving||!current())return;
      var cents=amount(input.value,max,retry);if(!cents){preview();return;}
      if(navigator.onLine===false){errorNode.textContent='No hay conexión. Tu saldo no se modificó; vuelve a intentarlo cuando tengas internet.';return;}
      var operation=attempts.get(owner);if(!operation||operation.amountCents!==cents){operation={amountCents:cents,requestId:requestId(),uncertain:false};attempts.set(owner,operation);}
      saving=true;input.disabled=true;all.disabled=true;cancel.disabled=true;submit.disabled=true;submit.textContent='Convirtiendo…';errorNode.textContent='';root.setAttribute('aria-busy','true');
      try{
        var result=await window.ICADEMPlatform.request('/api/ambassadors/conversions',{method:'POST',body:{amountCents:cents,requestId:operation.requestId}});
        if(!validSession(owner,epoch))return;
        if(!result.converted||!result.credits||!Number.isSafeInteger(result.conversion?.credits))throw new Error('No recibimos una confirmación válida. Reintenta para verificar la solicitud.');
        attempts.delete(owner);retry=false;saving=false;
        try{window.ICADEMPlatform.syncCreditSnapshot?.(result.credits,{source:'ambassador-conversion'});}catch(_){}
        try{window.ICADEMAmbassadors.acceptConversion?.(result);}catch(_){}
        if(current())handle.close();
        notify('success','Conversión confirmada',quantity(result.conversion.credits)+' créditos añadidos a tu monedero ICADEM.');
        // A confirmed transaction stays successful even if an ancillary refresh fails.
        await Promise.allSettled([window.ICADEMPlatform.loadCreditWallet?.(true),window.ICADEMAmbassadors.refresh?.()]);
      }catch(error){
        if(!validSession(owner,epoch))return;
        operation.uncertain=!error.status||error.status>=500;
        if(!operation.uncertain)attempts.delete(owner);retry=operation.uncertain;
        if(current())errorNode.textContent=retry?'No pudimos confirmar la respuesta. Reintenta esta misma solicitud; no se duplicará.':error.message;
      }finally{
        saving=false;if(current()){input.disabled=false;input.readOnly=retry;all.disabled=retry;cancel.disabled=false;submit.textContent=retry?'Verificar conversión':'Confirmar conversión';root.removeAttribute('aria-busy');preview();}
      }
    });
    preview();input.focus();
  }
  function reset(){generation+=1;attempts.clear();active=null;document.querySelector('[data-modal-id="amb-commission-conversion"] .modal__body')?.replaceChildren?.();window.Modal?.close('amb-commission-conversion');}
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:user-ready',reset);
  window.ICADEMCommissionConversion={open:open,isOpen:isOpen,hasPending:hasPending};
})();
