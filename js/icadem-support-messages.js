/* Editing and explicit visibility receipts for the existing private support thread. */
(function(){
  'use strict';
  var ui=window.ICADEMSupportUI;
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  function revision(message){return Number.isSafeInteger(message?.revision)&&message.revision>=0?message.revision:0;}
  function attributes(message,mine){return ' data-support-id="'+esc(message.id)+'" data-support-revision="'+revision(message)+'"'+(!mine?' data-support-incoming':'');}
  function meta(message,mine,time){
    var seen=Boolean(message.seenAt&&message.seenRevision===revision(message));
    return '<div class="sp-message-meta">'+(message.editedAt?'<span class="sp-edited" title="'+esc('Última edición: '+new Date(message.editedAt).toLocaleString('es-MX'))+'">Editado</span>':'')+'<time datetime="'+esc(message.createdAt||'')+'">'+esc(time)+'</time>'+(mine?'<span class="sp-receipt '+(seen?'is-seen':'')+'"'+(seen?' title="'+esc(new Date(message.seenAt).toLocaleString('es-MX'))+'"':'')+'>'+ui.icon('check')+(seen?'Visto':'Enviado')+'</span>':'')+(message.canEdit?'<button type="button" class="sp-edit-message" data-support-edit aria-label="Editar tu mensaje" title="Puedes corregir tus mensajes durante 15 minutos">Editar</button>':'')+'</div>'+(!mine?'<span class="sp-read-marker" aria-hidden="true" data-support-read-marker></span>':'');
  }
  function bind(root,options){
    var box=root.querySelector(options.box),records=new Map(),acknowledged=new Set(),disposed=false,reading=false,timer=0,frame=0,editor=null;
    if(!box)return null;
    var active=function(){return !disposed&&root.isConnected&&options.active()&&document.visibilityState==='visible';};
    function reconcile(messages){return messages.map(function(message){
      var old=records.get(message.id);if(old&&revision(old)>revision(message))return old;
      if(old&&revision(old)===revision(message)&&old.seenAt&&old.seenRevision===revision(old)&&message.seenRevision!==revision(message))return Object.assign({},message,{seenAt:old.seenAt,seenRevision:old.seenRevision});
      return message;
    });}
    function visibleMessages(){
      if(!active()||!document.hasFocus()||!box.getClientRects().length)return[];
      var bounds=box.getBoundingClientRect(),viewport=window.visualViewport,height=viewport?viewport.offsetTop+viewport.height:window.innerHeight,top=viewport?.offsetTop||0;
      return Array.from(box.querySelectorAll('[data-support-incoming]')).flatMap(function(node){
        var id=node.getAttribute('data-support-id'),message=records.get(id),version=Number(node.getAttribute('data-support-revision'));
        if(!message||revision(message)!==version||acknowledged.has(id+':'+version)||message.seenAt&&message.seenRevision===version)return[];
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
      var receipt=meta.querySelector('.sp-receipt'),seen=Boolean(message.seenAt&&message.seenRevision===revision(message));
      if(receipt){receipt.classList.toggle('is-seen',seen);receipt.innerHTML=ui.icon('check')+(seen?'Visto':'Enviado');if(seen)receipt.title=new Date(message.seenAt).toLocaleString('es-MX');else receipt.removeAttribute('title');}
      var badge=meta.querySelector('.sp-edited');
      if(message.editedAt){if(!badge){badge=document.createElement('span');badge.className='sp-edited';meta.prepend(badge);}badge.textContent='Editado';badge.title='Última edición: '+new Date(message.editedAt).toLocaleString('es-MX');}
      else badge?.remove();
      var button=meta.querySelector('[data-support-edit]');if(button)button.disabled=!message.canEdit;
    }
    function closeEditor(refresh){
      if(!editor)return;var old=editor;editor=null;
      old.unwatch?.();old.form.remove();old.node.removeAttribute('data-support-editing');
      var text=old.node.querySelector('.support-bubble__text,.support-admin-bubble__text'),message=records.get(old.id);
      if(text){text.hidden=false;if(message)text.textContent=message.text;}
      var button=old.node.querySelector('[data-support-edit]');if(active()&&button?.isConnected)button.focus({preventScroll:true});
      if(refresh)Promise.resolve(options.refresh()).then(function(){if(!active()||editor||document.activeElement!==button&&document.activeElement!==document.body)return;var latest=messageNode(old.id),target=latest?.querySelector('[data-support-edit]')||latest;target?.focus({preventScroll:true});});
    }
    function edit(node){
      var id=node.getAttribute('data-support-id'),message=records.get(id);if(!active()||!message?.canEdit)return;
      if(editor){if(editor.id===id){editor.text.focus();return;}editor.feedback.textContent='Guarda o cancela esta corrección antes de editar otro mensaje.';editor.text.focus();return;}
      var textNode=node.querySelector('.support-bubble__text,.support-admin-bubble__text'),bubble=textNode?.parentNode;if(!bubble)return;
      var form=document.createElement('form');form.className='sp-message-editor';
      form.innerHTML='<label>Corrige tu mensaje<textarea maxlength="3000" rows="3" required aria-label="Editar mensaje de soporte"></textarea></label><div class="sp-edit-bottom"><span data-edit-count></span><div><button type="button" data-edit-cancel>Cancelar</button><button type="submit" data-edit-save>Guardar</button></div></div><p class="sp-edit-feedback" role="status" aria-live="polite"></p><div class="sp-edit-conflict" hidden><strong>Versión actual guardada</strong><p data-edit-current></p><button type="button" data-edit-rebase>Revisé la versión actual; conservar mi corrección</button></div>';
      textNode.hidden=true;node.setAttribute('data-support-editing','');bubble.insertBefore(form,bubble.querySelector('.sp-message-meta'));
      var current={id:id,node:node,form:form,text:form.querySelector('textarea'),revision:revision(message),busy:false,feedback:form.querySelector('.sp-edit-feedback'),conflict:null};editor=current;current.text.value=message.text;current.unwatch=ui.trackTextFocus?.(current.text);
      function update(){form.querySelector('[data-edit-count]').textContent=current.text.value.length+' / 3000';form.querySelector('[data-edit-save]').disabled=current.busy||!current.text.value.trim()||Boolean(current.conflict);form.querySelector('[data-edit-cancel]').disabled=current.busy;}
      current.text.addEventListener('input',update);form.querySelector('[data-edit-cancel]').addEventListener('click',function(){closeEditor(true);});
      current.text.addEventListener('keydown',function(event){if(event.key==='Escape'&&!current.busy){event.preventDefault();closeEditor(true);}});
      form.querySelector('[data-edit-rebase]').addEventListener('click',function(){if(!current.conflict)return;current.revision=revision(current.conflict);current.conflict=null;form.querySelector('.sp-edit-conflict').hidden=true;current.feedback.textContent='Se conserva tu corrección. Revísala y pulsa Guardar para aplicarla.';update();current.text.focus();});
      form.addEventListener('submit',async function(event){
        event.preventDefault();if(current.busy||current.conflict||!active()||editor!==current)return;var sent=current.text.value.trim();if(!sent)return;
        current.busy=true;form.setAttribute('aria-busy','true');current.feedback.textContent='Guardando corrección…';update();
        try{
          var result=await options.edit(id,{message:sent,expectedRevision:current.revision});if(!active()||editor!==current)return;
          var saved=result.message;records.set(id,saved);current.revision=revision(saved);paintMetadata(current.node,saved);
          if(current.text.value.trim()!==sent){current.feedback.textContent='Corrección guardada. Tienes cambios nuevos pendientes.';options.refresh();}
          else{closeEditor(true);}
        }catch(error){
          if(!active()||editor!==current)return;
          if(error.status===409){
            await options.refresh();if(!active()||editor!==current)return;
            var latest=error.data?.currentMessage||records.get(id);current.conflict=latest;
            form.querySelector('[data-edit-current]').textContent=latest?.text||'Actualiza la conversación antes de volver a guardar.';form.querySelector('.sp-edit-conflict').hidden=false;
            current.feedback.textContent='El mensaje cambió en otro dispositivo. Tu corrección se conserva; compara las versiones antes de continuar.';
          }else current.feedback.textContent=error.status===403?'Terminó el plazo de edición o no tienes permiso. Tu corrección se conserva para copiarla y enviarla como aclaración.':'No pudimos guardar. Conservamos tu corrección; puedes reintentar.';
        }finally{current.busy=false;form.removeAttribute('aria-busy');if(form.isConnected)update();}
      });
      update();
      var editorRect=form.getBoundingClientRect(),boxRect=box.getBoundingClientRect();
      if(editorRect.bottom>boxRect.bottom-8)box.scrollTop+=editorRect.bottom-boxRect.bottom+8;
      else if(editorRect.top<boxRect.top+8)box.scrollTop-=boxRect.top-editorRect.top+8;
      current.text.focus({preventScroll:true});
    }
    function click(event){var button=event.target.closest?.('[data-support-edit]');if(button&&root.contains(button))edit(button.closest('[data-support-id]'));}
    root.addEventListener('click',click);box.addEventListener('scroll',scan,{passive:true});window.addEventListener('scroll',scan,{passive:true});window.addEventListener('resize',scan,{passive:true});window.addEventListener('focus',scan);document.addEventListener('visibilitychange',scan);
    return{
      reconcile:reconcile,
      update:function(messages){messages.forEach(function(message){records.set(message.id,message);var node=messageNode(message.id);if(!node)return;paintMetadata(node,message);if(!node.hasAttribute('data-support-editing')){var text=node.querySelector('.support-bubble__text,.support-admin-bubble__text');if(text)text.textContent=message.text;node.setAttribute('data-support-revision',revision(message));}});scan();},
      dispose:function(){disposed=true;editor?.unwatch?.();clearTimeout(timer);cancelAnimationFrame(frame);root.removeEventListener('click',click);box.removeEventListener('scroll',scan);window.removeEventListener('scroll',scan);window.removeEventListener('resize',scan);window.removeEventListener('focus',scan);document.removeEventListener('visibilitychange',scan);records.clear();acknowledged.clear();editor=null;}
    };
  }
  window.ICADEMSupportMessages={attributes:attributes,meta:meta,bind:bind};
})();
