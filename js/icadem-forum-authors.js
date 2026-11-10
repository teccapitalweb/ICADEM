/* Current public author identity only. Posts/comments retain their author UID;
   their historical snapshots never select the active photograph. */
(function(){
  'use strict';
  var authors=new Map(),pending=new Map(),generation=0;
  function viewer(){return String((window.__auth?window.__auth.currentUser?.uid:window.UserState?.uid)||'');}
  function valid(uid){return /^[A-Za-z0-9_-]{1,128}$/.test(String(uid||''));}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function photo(value){var raw=String(value||'');return /^(https:\/\/|assets\/|\.\/|\/(?!\/))/i.test(raw)&&!/[\u0000-\u001f]/.test(raw)?raw:'';}
  function current(uid,epoch){return !window.__sessionEnding&&viewer()===uid&&generation===epoch;}
  function own(uid){
    var state=window.UserState;
    return !window.__sessionEnding&&viewer()&&uid===viewer()&&state?.identityReady?{uid:uid,nombre:state.displayName||state.nombre||'Miembro ICADEM',iniciales:state.iniciales||'MI',foto:photo(state.photoURL),photoSource:state.photoSource,photoVersion:state.photoVersion}:null;
  }
  function author(item){var uid=String(item?.uid||'');return own(uid)||authors.get(uid)?.data||{uid:uid,nombre:item?.nombre||'Miembro ICADEM',iniciales:item?.iniciales||'MI',foto:''};}
  function image(data){var url=photo(data.foto);return url?'<img src="'+esc(window.__avatarSrc?.(url,data.photoVersion)||url)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':esc(data.iniciales||'MI');}
  function markup(item,kind){
    var data=author(item),uid=String(item?.uid||''),avatar=kind==='avatar',className=avatar?'post__avatar':kind==='comment-avatar'?'com__avatar':kind==='comment-name'?'com__author':'post__author';
    avatar=avatar||kind==='comment-avatar';
    var url=valid(uid)?window.ICADEMProfessionalNavigation?.profileHref(uid)||'vip-panel.html?profesional='+encodeURIComponent(uid)+'#directorio-perfil':'';
    var content=avatar?image(data):esc(data.nombre),classes=className+(avatar&&data.foto?' has-photo':'')+(url?' foro-author-link':'');
    return '<'+(url?'a':'span')+' class="'+classes+'"'+(url?' href="'+esc(url)+'" data-foro-author="'+esc(uid)+'" data-foro-author-kind="'+(avatar?'avatar':'name')+'" aria-label="Ver perfil de '+esc(data.nombre)+'"':'')+'>'+content+'</'+(url?'a':'span')+'>';
  }
  function patch(root){
    (root||document).querySelectorAll('[data-foro-author]').forEach(function(node){
      var uid=node.dataset.foroAuthor,data=own(uid)||authors.get(uid)?.data;if(!data)return;
      if(node.dataset.foroAuthorKind==='avatar'){node.classList.toggle('has-photo',Boolean(data.foto));node.innerHTML=image(data);}else node.textContent=data.nombre;
      node.setAttribute('aria-label','Ver perfil de '+data.nombre);
    });
  }
  function bind(root){
    root.querySelectorAll('[data-foro-author]').forEach(function(node){
      if(node.dataset.foroAuthorBound)return;node.dataset.foroAuthorBound='true';
      node.addEventListener('click',function(event){if(event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        if(window.ICADEMProfessionalNavigation?.openProfile(node.dataset.foroAuthor))event.preventDefault();
      });
    });
  }
  function hydrate(items,force){
    var uid=viewer(),epoch=generation;
    if(!uid||window.__sessionEnding||!window.ICADEMPlatform?.request)return Promise.resolve([]);
    var ids=[...new Set((items||[]).map(function(item){return String(item?.uid||'');}).filter(valid))];
    var loads=[],missing=ids.filter(function(id){if(pending.has(id)){loads.push(pending.get(id).promise);return false;}return force||!authors.has(id)||Date.now()-authors.get(id).at>30000;});
    for(var index=0;index<missing.length;index+=100){
      (function(batch){
        var ticket={promise:null};
        ticket.promise=window.ICADEMPlatform.request('/api/community/authors?uids='+encodeURIComponent(batch.join(','))).then(function(data){
          if(!current(uid,epoch)||data?.ok!==true||!Array.isArray(data.authors))return [];
          var returned=new Map(data.authors.filter(function(item){return batch.includes(item.uid);}).map(function(item){return [item.uid,{uid:item.uid,nombre:String(item.nombre||'Miembro ICADEM'),iniciales:String(item.iniciales||'MI'),foto:photo(item.foto),photoSource:item.photoSource,photoVersion:item.photoVersion}];}));
          batch.forEach(function(id){authors.set(id,{at:Date.now(),data:returned.get(id)||{uid:id,nombre:'Miembro ICADEM',iniciales:'MI',foto:''}});});patch();return data.authors;
        }).catch(function(){return [];}).finally(function(){batch.forEach(function(id){if(pending.get(id)===ticket)pending.delete(id);});});
        batch.forEach(function(id){pending.set(id,ticket);});loads.push(ticket.promise);
      })(missing.slice(index,index+100));
    }
    patch();return Promise.all(loads);
  }
  function reset(){generation++;authors.clear();pending.clear();}
  function refresh(){if(location.hash==='#foro'&&document.visibilityState!=='hidden')hydrate([...document.querySelectorAll('[data-foro-author]')].map(function(node){return {uid:node.dataset.foroAuthor};}),true);}
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:user-ready',function(){
    reset();var epoch=generation;
    // Wait for the platform's user-ready handlers to finish replacing their
    // request scope, then recover authors already rendered by the forum.
    Promise.resolve().then(function(){if(epoch===generation)refresh();});
  });
  document.addEventListener('icadem:identity-ready',function(event){if(event.detail?.profile?.uid===viewer())patch();});
  document.addEventListener('visibilitychange',refresh);
  if(typeof setInterval==='function')setInterval(refresh,60000);
  window.ICADEMForumAuthors={markup:markup,bind:bind,hydrate:hydrate,patch:patch};
})();
