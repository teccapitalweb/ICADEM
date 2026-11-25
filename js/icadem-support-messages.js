/* Message editing, withdrawal and read receipts for private support. */
(function(){
  'use strict';
  var ui=window.ICADEMSupportUI;
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  function revision(message){return Number.isSafeInteger(message?.revision)&&message.revision>=0?message.revision:0;}
  function bodyText(message){return message.withdrawn===true?'Mensaje retirado':message.text||'';}
  function attributes(message,mine){
    return ' data-support-id="'+esc(message.id)+'" data-support-revision="'+revision(message)+'"'
      +(mine?' data-support-own':' data-support-incoming')+(message.withdrawn===true?' data-support-withdrawn':'');
  }
  function actionMarkup(message,mine){
    if(!mine)return '';
    if(message.withdrawn===true)return message.canRestore
      ?'<button type="button" class="sp-edit-message" data-support-restore aria-label="Recuperar tu mensaje">Recuperar</button>':'';
    return (message.canEdit?'<button type="button" class="sp-edit-message" data-support-edit aria-label="Editar tu mensaje" title="Puedes corregir tus mensajes durante 15 minutos">Editar</button>':'')
      +(message.canWithdraw?'<button type="button" class="sp-edit-message" data-support-withdraw aria-label="Retirar tu mensaje">Retirar</button>':'');
  }
  function actionState(message,mine){
    if(!mine)return '';
    if(message.withdrawn===true)return message.canRestore?'restore':'';
    return (message.canEdit?'edit':'')+(message.canWithdraw?'withdraw':'');
  }
  function editedMarkup(message){
    return message.editedAt&&message.withdrawn!==true?'<span class="sp-edited" title="'+esc('Última edición: '+new Date(message.editedAt).toLocaleString('es-MX'))+'">Editado</span>':'';
  }
  function receiptMarkup(message,mine){
    if(!mine||message.withdrawn===true)return '';
    var seen=Boolean(message.seenAt&&message.seenRevision===revision(message));
    return '<span class="sp-receipt '+(seen?'is-seen':'')+'"'+(seen?' title="'+esc(new Date(message.seenAt).toLocaleString('es-MX'))+'"':'')+'>'+ui.icon('check')+(seen?'Visto':'Enviado')+'</span>';
  }
  var markerMarkup='<span class="sp-read-marker" aria-hidden="true" data-support-read-marker></span>';
  function meta(message,mine,time){
    return '<div class="sp-message-meta">'+editedMarkup(message)+'<time datetime="'+esc(message.createdAt||'')+'">'+esc(time)+'</time>'
      +receiptMarkup(message,mine)+'<div class="sp-message-actions" data-support-actions="'+actionState(message,mine)+'">'+actionMarkup(message,mine)+'</div></div>'
      +(!mine&&message.withdrawn!==true?markerMarkup:'');
  }
  function bind(root,options){
    var box=root.querySelector(options.box),records=new Map(),acknowledged=new Set(),disposed=false,reading=false,timer=0,frame=0,editor=null,visibility=null;
    if(!box)return null;
    var attached=function(){return !disposed&&root.isConnected&&options.active();};
    var active=function(){return attached()&&document.visibilityState==='visible';};
    function currentRecord(message){
      var old=records.get(message.id);if(old&&revision(old)>revision(message))return old;
      if(message.withdrawn!==true&&old&&revision(old)===revision(message)&&old.seenAt&&old.seenRevision===revision(old)&&message.seenRevision!==revision(message))return Object.assign({},message,{seenAt:old.seenAt,seenRevision:old.seenRevision});
      return message;
    }
    function reconcile(messages){return messages.map(currentRecord);}
    function visibleMessages(){
      if(!active()||!document.hasFocus()||!box.getClientRects().length)return[];
      var bounds=box.getBoundingClientRect(),viewport=window.visualViewport,height=viewport?viewport.offsetTop+viewport.height:window.innerHeight,top=viewport?.offsetTop||0;
      return Array.from(box.querySelectorAll('[data-support-incoming]')).flatMap(function(node){
        var id=node.getAttribute('data-support-id'),message=records.get(id),version=Number(node.getAttribute('data-support-revision'));
        if(!message||message.withdrawn===true||revision(message)!==version||acknowledged.has(id+':'+version)||message.seenAt&&message.seenRevision===version)return[];
        var marker=node.querySelector('[data-support-read-marker]');if(!marker)return[];
        var r=marker.getBoundingClientRect();
        if(r.width<=0||r.height<=0||r.top<Math.max(bounds.top,top)||r.bottom>Math.min(bounds.bottom,height)||r.left<0||r.right>window.innerWidth)return[];
        var hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return hit&&node.contains(hit)?[{id:id,revision:version}]:[];
      }).slice(0,100);
    }
    async function markVisible(){
      timer=0;if(reading)return;var messages=visibleMessages();if(!messages.length)return;reading=true;var accepted=0;
      try{
        var result=await options.read({messages:messages});if(!active())return;
        (result.read||[]).forEach(function(item){acknowledged.add(item.id+':'+item.revision);});
        options.readResult?.(result);accepted=(result.read||[]).length;
      }catch(_){}finally{reading=false;if(accepted>0&&active()&&visibleMessages().length)schedule();}
    }
    function schedule(){if(disposed||timer||reading)return;timer=setTimeout(markVisible,260);}
    function scan(){if(frame||disposed)return;frame=requestAnimationFrame(function(){frame=0;schedule();});}
    function messageNode(id){return Array.from(box.querySelectorAll('[data-support-id]')).find(function(node){return node.getAttribute('data-support-id')===id;});}
    function paintMetadata(node,message){
      var meta=node.querySelector('.sp-message-meta');if(!meta)return;
      var mine=node.hasAttribute('data-support-own'),receipt=meta.querySelector('.sp-receipt');
      var badge=meta.querySelector('.sp-edited'),actions=meta.querySelector('[data-support-actions]');
      var receiptHtml=receiptMarkup(message,mine),badgeHtml=editedMarkup(message),state=actionState(message,mine);
      if(receipt&&receipt.outerHTML!==receiptHtml){if(receiptHtml)receipt.outerHTML=receiptHtml;else receipt.remove();}
      else if(!receipt&&receiptHtml)actions?.insertAdjacentHTML('beforebegin',receiptHtml);
      if(badge&&badge.outerHTML!==badgeHtml){if(badgeHtml)badge.outerHTML=badgeHtml;else badge.remove();}
      else if(!badge&&badgeHtml)meta.insertAdjacentHTML('afterbegin',badgeHtml);
      if(actions&&actions.getAttribute('data-support-actions')!==state){
        var focused=actions.contains(document.activeElement);
        actions.setAttribute('data-support-actions',state);actions.innerHTML=actionMarkup(message,mine);
        if(focused&&active())focusActions(node);
      }
    }
    function focusActions(node,selector){
      var target=(selector&&node.querySelector(selector))||node.querySelector('[data-support-withdraw],[data-support-restore],[data-support-edit]')||node;
      target.focus?.({preventScroll:true});
    }
    function paintMessage(node,message){
      var withdrawn=message.withdrawn===true,text=node.querySelector('.support-bubble__text,.support-admin-bubble__text');
      node.setAttribute('data-support-revision',revision(message));
      if(withdrawn)node.setAttribute('data-support-withdrawn','');else node.removeAttribute?.('data-support-withdrawn');
      var marker=node.querySelector('[data-support-read-marker]');
      if(withdrawn)marker?.remove?.();
      else if(node.hasAttribute('data-support-incoming')&&!marker)node.querySelector('.sp-message-meta')?.insertAdjacentHTML('afterend',markerMarkup);
      if(text){text.textContent=bodyText(message);text.hidden=!withdrawn&&node.hasAttribute('data-support-editing');}
      paintMetadata(node,message);
      if(withdrawn&&editor?.id===message.id&&!editor.withdrawn){
        if(editor.text.value===editor.original)closeEditor(false);
        else{
          editor.withdrawn=true;editor.text.readOnly=true;editor.form.querySelector('.sp-edit-conflict').hidden=true;
          editor.feedback.textContent='El mensaje se retiró. Puedes copiar tu corrección antes de cerrar.';
          editor.update();
        }
      }
    }
    function remember(message){
      var latest=currentRecord(message);
      records.set(latest.id,latest);
      var node=messageNode(latest.id);
      if(node)paintMessage(node,latest);
      return latest;
    }
    function closeEditor(refresh){
      if(!editor)return;var old=editor;editor=null;
      old.unwatch?.();old.form.remove();old.node.removeAttribute('data-support-editing');
      var text=old.node.querySelector('.support-bubble__text,.support-admin-bubble__text'),message=records.get(old.id);
      if(text){text.hidden=false;if(message)text.textContent=bodyText(message);}
      var button=old.node.querySelector('[data-support-edit],[data-support-restore]')||old.node;if(active()&&button?.isConnected)button.focus({preventScroll:true});
      if(refresh)Promise.resolve(options.refresh()).then(function(){if(!active()||editor||document.activeElement!==button&&document.activeElement!==document.body)return;var latest=messageNode(old.id),target=latest?.querySelector('[data-support-edit]')||latest;target?.focus({preventScroll:true});});
    }
    function edit(node){
      var id=node.getAttribute('data-support-id'),message=records.get(id);if(!active()||!message?.canEdit||message.withdrawn===true||visibility?.busy)return;
      if(visibility)closeVisibility(false);
      if(editor){if(editor.id===id){editor.text.focus();return;}editor.feedback.textContent='Guarda o cancela esta corrección antes de editar otro mensaje.';editor.text.focus();return;}
      var textNode=node.querySelector('.support-bubble__text,.support-admin-bubble__text'),bubble=textNode?.parentNode;if(!bubble)return;
      var form=document.createElement('form');form.className='sp-message-editor';
      form.innerHTML='<label>Corrige tu mensaje<textarea maxlength="3000" rows="3" required aria-label="Editar mensaje de soporte"></textarea></label><div class="sp-edit-bottom"><span data-edit-count></span><div><button type="button" data-edit-cancel>Cancelar</button><button type="submit" data-edit-save>Guardar</button></div></div><p class="sp-edit-feedback" role="status" aria-live="polite"></p><div class="sp-edit-conflict" hidden><strong>Versión actual guardada</strong><p data-edit-current></p><button type="button" data-edit-rebase>Revisé la versión actual; conservar mi corrección</button></div>';
      textNode.hidden=true;node.setAttribute('data-support-editing','');bubble.insertBefore(form,bubble.querySelector('.sp-message-meta'));
      var current={id:id,node:node,form:form,text:form.querySelector('textarea'),revision:revision(message),original:message.text,busy:false,feedback:form.querySelector('.sp-edit-feedback'),conflict:null,update:update};editor=current;current.text.value=message.text;current.unwatch=ui.trackTextFocus?.(current.text);
      function update(){form.querySelector('[data-edit-count]').textContent=current.text.value.length+' / 3000';form.querySelector('[data-edit-save]').disabled=current.busy||current.withdrawn||!current.text.value.trim()||Boolean(current.conflict);form.querySelector('[data-edit-cancel]').disabled=current.busy;}
      current.text.addEventListener('input',update);form.querySelector('[data-edit-cancel]').addEventListener('click',function(){closeEditor(true);});
      current.text.addEventListener('keydown',function(event){if(event.key==='Escape'&&!current.busy){event.preventDefault();closeEditor(true);}});
      form.querySelector('[data-edit-rebase]').addEventListener('click',function(){if(!current.conflict)return;current.revision=revision(current.conflict);current.conflict=null;form.querySelector('.sp-edit-conflict').hidden=true;current.feedback.textContent='Se conserva tu corrección. Revísala y pulsa Guardar para aplicarla.';update();current.text.focus();});
      form.addEventListener('submit',async function(event){
        event.preventDefault();if(current.busy||current.withdrawn||current.conflict||!active()||editor!==current)return;var sent=current.text.value.trim();if(!sent)return;
        current.busy=true;form.setAttribute('aria-busy','true');current.feedback.textContent='Guardando corrección…';update();
        try{
          var result=await options.edit(id,{message:sent,expectedRevision:current.revision});if(!active()||editor!==current)return;
          var saved=remember(result.message);if(editor!==current||current.withdrawn)return;
          current.revision=revision(saved);current.original=saved.text;
          if(current.text.value.trim()!==sent){current.feedback.textContent='Corrección guardada. Tienes cambios nuevos pendientes.';options.refresh();}
          else{closeEditor(true);}
        }catch(error){
          if(!active()||editor!==current)return;
          if(error.status===409){
            await options.refresh();if(!active()||editor!==current)return;
            var latest=error.data?.currentMessage?remember(error.data.currentMessage):records.get(id);
            if(editor!==current||current.withdrawn)return;
            current.conflict=latest;
            form.querySelector('[data-edit-current]').textContent=latest?.text||'Actualiza la conversación antes de volver a guardar.';form.querySelector('.sp-edit-conflict').hidden=false;
            current.feedback.textContent='El mensaje cambió en otro dispositivo. Tu corrección se conserva; compara las versiones antes de continuar.';
          }else current.feedback.textContent=error.status===403?'Terminó el plazo de edición o no tienes permiso. Tu corrección se conserva para copiarla y enviarla como aclaración.':'No pudimos guardar. Conservamos tu corrección; puedes reintentar.';
        }finally{current.busy=false;form.removeAttribute('aria-busy');if(form.isConnected)update();}
      });
      update();fitAction(form);
      current.text.focus({preventScroll:true});
    }
    function fitAction(element){
      var panelRect=element.getBoundingClientRect(),boxRect=box.getBoundingClientRect();
      if(panelRect.bottom>boxRect.bottom-8)box.scrollTop+=panelRect.bottom-boxRect.bottom+8;
      else if(panelRect.top<boxRect.top+8)box.scrollTop-=boxRect.top-panelRect.top+8;
    }
    function closeVisibility(focus){
      if(!visibility)return;
      var old=visibility;visibility=null;
      old.panel.remove();old.node.removeAttribute('data-support-changing');
      old.button.removeAttribute('aria-expanded');old.button.disabled=false;
      if(focus&&active())focusActions(old.node,old.withdrawn?'[data-support-withdraw]':'[data-support-restore]');
    }
    async function changeVisibility(operation){
      if(!active()||operation.busy||visibility!==operation)return;
      var message=records.get(operation.id);
      if(!message||revision(message)!==operation.revision||!(operation.withdrawn?message.canWithdraw:message.canRestore)){
        operation.feedback.textContent='El mensaje cambió. Revisa su estado actualizado.';
        operation.confirm?.setAttribute('disabled','');
        options.refresh();
        return;
      }
      operation.busy=true;operation.button.disabled=true;
      operation.panel.setAttribute('aria-busy','true');
      operation.panel.querySelectorAll('button').forEach(function(control){control.disabled=true;});
      operation.feedback.textContent=operation.withdrawn?'Retirando mensaje…':'Recuperando mensaje…';
      try{
        var result=await options.visibility(operation.id,{withdrawn:operation.withdrawn,expectedRevision:operation.revision});
        if(!attached()||visibility!==operation)return;
        if(result.message?.id!==operation.id)throw new Error('No se recibió el mensaje actualizado.');
        var latest=remember(result.message);
        closeVisibility(false);
        if(active()&&(operation.node.contains(document.activeElement)||document.activeElement===document.body)){
          focusActions(operation.node,latest.withdrawn===true?'[data-support-restore]':'[data-support-withdraw]');
        }
        options.refresh();
      }catch(error){
        if(!attached()||visibility!==operation)return;
        if(error.status===409||error.status===403){
          if(error.data?.currentMessage?.id===operation.id)remember(error.data.currentMessage);
          operation.feedback.textContent=error.status===409?'El mensaje cambió. Revisa su estado actualizado.':'Terminó el plazo de 15 minutos o ya no tienes permiso.';
          operation.blocked=true;
          options.refresh();
        }else operation.feedback.textContent=operation.withdrawn?'No pudimos retirar el mensaje. Vuelve a intentarlo.':'No pudimos recuperar el mensaje. Vuelve a intentarlo.';
      }finally{
        operation.busy=false;operation.button.disabled=false;
        operation.panel.removeAttribute('aria-busy');
        if(visibility===operation){
          operation.panel.querySelector('[data-support-withdraw-cancel]').disabled=false;
          if(operation.confirm)operation.confirm.disabled=Boolean(operation.blocked);
          if(active()&&(!root.contains(document.activeElement)||document.activeElement===operation.button)){
            (operation.blocked?operation.panel.querySelector('[data-support-withdraw-cancel]'):operation.confirm||operation.button).focus({preventScroll:true});
          }
        }
      }
    }
    function beginVisibility(button,node,withdrawn){
      var id=node?.getAttribute('data-support-id'),message=records.get(id);
      if(!active()||visibility?.busy||typeof options.visibility!=='function')return;
      if(editor?.id===id){
        editor.feedback.textContent='Guarda o cancela tu corrección para cambiar la visibilidad del mensaje.';
        editor.text.focus();return;
      }
      if(!(withdrawn?message?.canWithdraw:message?.canRestore))return;
      closeVisibility(false);
      var panel=document.createElement('div');panel.className='sp-visibility-action';panel.setAttribute('role','group');
      panel.setAttribute('aria-label',withdrawn?'Confirmar retiro del mensaje':'Recuperar mensaje');
      panel.innerHTML=(withdrawn?'<p>Se mostrará como «Mensaje retirado» para ambas partes. Podrás recuperarlo dentro de los 15 minutos desde el envío.</p>':'')+
        '<div class="sp-visibility-buttons"><button type="button" data-support-withdraw-cancel>'+(withdrawn?'Cancelar':'Cerrar')+'</button>'+
        (withdrawn?'<button type="button" data-support-withdraw-confirm>Retirar mensaje</button>':'')+'</div>'+
        '<p class="sp-visibility-feedback" role="status" aria-live="polite"></p>';
      var operation={id:id,node:node,panel:panel,button:button,withdrawn:withdrawn,revision:revision(message),
        confirm:panel.querySelector('[data-support-withdraw-confirm]'),feedback:panel.querySelector('.sp-visibility-feedback')};
      visibility=operation;node.setAttribute('data-support-changing','');button.setAttribute('aria-expanded','true');
      node.querySelector('.sp-message-meta').insertAdjacentElement('afterend',panel);
      fitAction(panel);
      if(withdrawn)panel.querySelector('[data-support-withdraw-cancel]').focus({preventScroll:true});
      else changeVisibility(operation);
    }
    function click(event){
      var button=event.target.closest?.('[data-support-edit],[data-support-withdraw],[data-support-restore],[data-support-withdraw-confirm],[data-support-withdraw-cancel]');
      if(!button||!root.contains(button))return;
      var node=button.closest('[data-support-id]');
      if(button.hasAttribute('data-support-edit'))edit(node);
      else if(button.hasAttribute('data-support-withdraw'))beginVisibility(button,node,true);
      else if(button.hasAttribute('data-support-restore'))beginVisibility(button,node,false);
      else if(visibility?.node===node&&!visibility.busy){
        if(button.hasAttribute('data-support-withdraw-confirm'))changeVisibility(visibility);
        else closeVisibility(true);
      }
    }
    function keydown(event){
      if(event.key==='Escape'&&visibility&&!visibility.busy&&visibility.node.contains(event.target)){
        event.preventDefault();closeVisibility(true);
      }
    }
    root.addEventListener('click',click);root.addEventListener('keydown',keydown);box.addEventListener('scroll',scan,{passive:true});window.addEventListener('scroll',scan,{passive:true});window.addEventListener('resize',scan,{passive:true});window.addEventListener('focus',scan);document.addEventListener('visibilitychange',scan);
    return{
      reconcile:reconcile,
      update:function(messages){messages.forEach(remember);scan();},
      dispose:function(){disposed=true;closeVisibility(false);editor?.unwatch?.();clearTimeout(timer);cancelAnimationFrame(frame);root.removeEventListener('click',click);root.removeEventListener('keydown',keydown);box.removeEventListener('scroll',scan);window.removeEventListener('scroll',scan);window.removeEventListener('resize',scan);window.removeEventListener('focus',scan);document.removeEventListener('visibilitychange',scan);records.clear();acknowledged.clear();editor=null;}
    };
  }
  window.ICADEMSupportMessages={attributes:attributes,bodyText:bodyText,meta:meta,bind:bind};
})();
