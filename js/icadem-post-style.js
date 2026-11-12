/* One fixed palette for composer, feed, original posts and activity. No CSS input. */
(function(){
 'use strict';
 const palette=[['default','Predeterminado','#DCE5E5'],['gold','Dorado','#C5A15B'],['blue','Azul','#78A6BE'],['mint','Menta','#8AB9AC'],['lavender','Lavanda','#ADA0C6'],['coral','Coral','#D8A293']];
 let scope=null,capability=null,capOwner='',capTime=0,capRequest=null,epoch=0,dialog=null,timer,styleVersion=0;
 const confirmed=new Map();
 const viewer=()=>window.__currentUser?.uid||window.__auth?.currentUser?.uid||'';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const accent=style=>palette.some(p=>p[0]===style?.accent)?style.accent:'default';
 const allowed=()=>capOwner===viewer()&&capability?.canCustomize===true&&capability?.isVip===true;
 const api=(path,options)=>window.ICADEMPlatform.request('/api/forum'+path,options);
 const sourceKey=post=>String(post.uid||'')+':'+String(post.createdAtMs||post.createdAt?.toDate?.().getTime()||'');
 function current(c){return scope===c&&c.uid===viewer()&&c.root.isConnected&&!window.__sessionEnding;}
 function picker(selected){return '<div class="post-accent-options" role="radiogroup" aria-label="Color del borde superior">'+palette.map(([key,label,color])=>'<button type="button" role="radio" data-post-accent="'+key+'" aria-checked="'+(key===selected)+'" aria-label="'+label+'" title="'+label+'"><span style="--swatch:'+color+'">'+(key===selected?'✓':'')+'</span><small>'+(key==='default'?'Original':label)+'</small></button>').join('')+'</div>';}
 function preview(text,key){return '<article class="post-style-preview" data-post-style-preview data-post-accent="'+key+'"><strong>Vista previa</strong><p>'+esc(String(text||'Así se verá el borde de tu publicación.').slice(0,180))+'</p></article>';}
 function choose(root,key){if(!root)return;root.querySelectorAll('[role=radio]').forEach(button=>{const chosen=button.dataset.postAccent===key;button.setAttribute('aria-checked',String(chosen));button.querySelector('span').textContent=chosen?'✓':'';});root.querySelector('[data-post-style-preview]')?.setAttribute('data-post-accent',key);}
 function wirePicker(root,onSelect){root.querySelectorAll('[role=radio]').forEach((b,index,buttons)=>{b.addEventListener('click',()=>{choose(root,b.dataset.postAccent);onSelect(b.dataset.postAccent);});b.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();}});});}
 async function capabilities(force){
  const uid=viewer();if(!uid||!window.ICADEMPlatform?.request)return false;
  if(!force&&capOwner===uid&&capability&&Date.now()-capTime<30000)return allowed();
  if(capRequest?.uid===uid)return capRequest.promise;
  const run=epoch,promise=api('/style-capabilities').then(data=>{
   if(run!==epoch||viewer()!==uid||!data?.ok)return false;
   capOwner=uid;capability={canCustomize:data.canCustomize===true,isVip:data.isVip===true,isAdmin:data.isAdmin===true};capTime=Date.now();return allowed();
  }).catch(()=>false).finally(()=>{if(capRequest?.promise===promise)capRequest=null;});
  capRequest={uid,promise};return promise;
 }
 function composer(c){
  if(!current(c))return;const slot=c.root.querySelector('[data-post-style-slot]');if(!slot)return;
  if(!allowed()){slot.replaceChildren();slot.hidden=true;c.selected='default';return;}
  if(slot.querySelector('[data-post-style-picker]'))return;
  slot.hidden=false;slot.innerHTML='<details class="post-style-picker" data-post-style-picker><summary>Estilo de publicación <span>VIP</span></summary>'+picker(c.selected)+preview(c.root.querySelector('#foro-text')?.value,c.selected)+'</details>';
  wirePicker(slot,key=>{c.selected=key;});
 }
 function decorate(posts,list){
  if(!list)return;for(const post of posts||[]){const row=[...list.querySelectorAll('[data-post]')].find(r=>r.dataset.post===post.id);if(!row)continue;
   const cached=confirmed.get(post.id);row.setAttribute('data-post-accent',cached?.sourceKey===sourceKey(post)?accent(cached.style):'default');
   const existing=row.querySelector('[data-post-style-edit]');
   if(!allowed()||post.uid!==viewer()){existing?.remove();continue;}
   if(existing)continue;
   const button=document.createElement('button');button.type='button';button.className='post-style-edit';button.dataset.postStyleEdit=post.id;button.textContent='Estilo';button.title='Cambiar el borde de esta publicación';button.setAttribute('aria-label','Cambiar el borde de mi publicación');
   button.addEventListener('click',()=>edit(post.id));row.querySelector('.post__header')?.append(button);
  }
 }
 async function hydrate(c,force){
  if(!current(c)||!c.posts.length)return;
  if(c.hydrating){c.hydrateAgain=true;return;}
  const wanted=c.posts.filter(p=>{const cached=confirmed.get(p.id);return force||!cached||cached.sourceKey!==sourceKey(p)||cached.hint!==p.styleRevision||Date.now()-cached.at>300000;});
  if(!wanted.length)return;c.hydrating=true;const run=epoch,before=styleVersion;
  try{for(let offset=0;offset<wanted.length;offset+=100){const chunk=wanted.slice(offset,offset+100),response=await api('/post-styles/read',{method:'POST',body:{postIds:chunk.map(p=>p.id)}});
    if(run!==epoch||!current(c))return;if(before!==styleVersion){c.hydrateAgain=true;return;}
    if(!response?.ok||!Array.isArray(response.items))throw Error('No pudimos confirmar los estilos.');
    const byId=new Map(response.items.map(item=>[item.postId,item]));
    for(const p of chunk){const item=byId.get(p.id);confirmed.set(p.id,{style:{accent:accent(item?.style)},styleRevision:Number.isSafeInteger(item?.styleRevision)?item.styleRevision:0,sourceKey:sourceKey(p),hint:p.styleRevision,at:Date.now()});}
   }
   if(current(c))decorate(c.posts,c.root.querySelector('#foro-list'));
  }catch(_){/* Unconfirmed source fields never select a color. */}
  finally{c.hydrating=false;if(current(c)&&c.hydrateAgain){c.hydrateAgain=false;hydrate(c,true);}}
 }
 function apply(post){if(!scope||!current(scope))return;styleVersion++;const source=scope.posts.find(p=>p.id===post.id);
  if(source)confirmed.set(post.id,{style:post.style,styleRevision:post.styleRevision,sourceKey:sourceKey(source),hint:post.styleRevision,at:Date.now()});
  scope.posts=scope.posts.map(p=>p.id===post.id?{...p,styleRevision:post.styleRevision}:p);scope.onSaved?.(post);decorate(scope.posts,scope.root.querySelector('#foro-list'));}
 async function edit(postId){
  const c=scope,owner=viewer(),run=epoch;if(!c||!current(c)||!allowed()||!/^[A-Za-z0-9_-]{1,180}$/.test(postId))return;
  try{
   const result=await api('/posts/'+encodeURIComponent(postId));if(owner!==viewer()||run!==epoch||!current(c)||!allowed())return;
   const post=result?.post;if(!result.ok||post?.uid!==owner||post.id!==postId)throw Error('No pudimos abrir tu publicación.');
   if(dialog)dialog.close();const node=document.createElement('dialog');dialog=node;node.className='post-style-dialog';node.setAttribute('aria-labelledby','post-style-dialog-title');
   let selected=accent(post.style),busy=false;
   node.innerHTML='<h2 id="post-style-dialog-title">Estilo de publicación</h2><p class="post-style-hint">Cambia únicamente el borde superior.</p><div data-post-style-picker>'+picker(selected)+preview(post.texto,selected)+'</div><p class="post-style-error" role="alert" hidden></p><div class="post-style-actions"><button type="button" data-post-style-cancel>Cancelar</button><button type="button" data-post-style-save>Guardar color</button></div>';
   wirePicker(node,key=>{selected=key;});node.querySelector('[data-post-style-cancel]').addEventListener('click',()=>node.close());
   node.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
   node.addEventListener('close',()=>{node.remove();if(dialog===node)dialog=null;scope?.root.querySelector('[data-post-style-edit="'+CSS.escape(postId)+'"]')?.focus({preventScroll:true});});
   node.querySelector('[data-post-style-save]').addEventListener('click',async()=>{
    if(busy)return;busy=true;node.querySelectorAll('button').forEach(b=>b.disabled=true);const error=node.querySelector('[role=alert]');error.hidden=true;
    try{const response=await api('/posts/'+encodeURIComponent(postId)+'/style',{method:'PATCH',body:{accent:selected,expectedRevision:Number.isSafeInteger(post.styleRevision)?post.styleRevision:0}});
     if(owner!==viewer()||run!==epoch||!current(c)){node.close();return;}
     if(response?.ok!==true||response.postId!==postId||accent(response.style)!==selected)throw Error('No pudimos confirmar el color guardado.');
     apply({id:postId,style:response.style,styleRevision:response.styleRevision});node.close();window.Toast?.success?.('Color guardado','El contenido y la caducidad permanecen iguales.');
    }catch(e){if(!node.isConnected)return;error.textContent=e.message||'No pudimos guardar el color. Reintenta cuando tengas conexión.';error.hidden=false;
     if(e.status===409){error.textContent='El estilo cambió en otra sesión. Cierra y vuelve a abrir el editor para consultar el color actual.';node.querySelector('[data-post-style-save]').dataset.conflict='true';}
     if(e.status===403)capabilities(true).then(()=>{if(scope){composer(scope);decorate(scope.posts,scope.root.querySelector('#foro-list'));}});
    }finally{busy=false;if(node.isConnected)node.querySelectorAll('button').forEach(b=>b.disabled=b.dataset.conflict==='true');}
   });
   document.body.append(node);node.showModal();
  }catch(e){if(owner===viewer()&&run===epoch&&current(c))window.Toast?.error?.('No se pudo abrir el estilo',e.message||'Intenta de nuevo.');}
 }
 function mount(root,onSaved){
  scope={root,uid:viewer(),selected:'default',posts:[],onSaved};const c=scope;
  root.querySelector('#foro-text')?.addEventListener('input',()=>{const p=root.querySelector('[data-post-style-preview] p');if(p)p.textContent=String(root.querySelector('#foro-text').value||'Así se verá el borde de tu publicación.').slice(0,180);});
  capabilities().then(()=>{if(current(c)){composer(c);decorate(c.posts,root.querySelector('#foro-list'));hydrate(c,false);}});
  clearInterval(timer);timer=setInterval(refresh,30000);
 }
 function posts(items,list){if(scope&&current(scope)){scope.posts=items;decorate(items,list);hydrate(scope,false);}}
 function selected(){return scope&&current(scope)&&allowed()?scope.selected:'default';}
 function resetComposer(){if(scope){scope.selected='default';choose(scope.root.querySelector('[data-post-style-slot]'),'default');const p=scope.root.querySelector('[data-post-style-preview] p');if(p)p.textContent='Así se verá el borde de tu publicación.';}}
 function reset(){epoch++;styleVersion++;confirmed.clear();clearInterval(timer);if(dialog)dialog.close();scope=null;capability=null;capOwner='';capTime=0;capRequest=null;}
 function refresh(event){if(scope&&current(scope)&&document.visibilityState!=='hidden')capabilities(true).then(()=>{if(scope&&current(scope)){composer(scope);decorate(scope.posts,scope.root.querySelector('#foro-list'));hydrate(scope,!!event);}});}
 document.addEventListener('icadem:session-ending',reset);document.addEventListener('icadem:user-ready',()=>{if((scope&&scope.uid!==viewer())||(capOwner&&capOwner!==viewer()))reset();});
 window.addEventListener('icadem:navigation',event=>{if(event.detail?.section!=='foro'){clearInterval(timer);scope=null;if(dialog)dialog.close();}});
 document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
 window.ICADEMPostStyle={accent,mount,posts,selected,resetComposer,refresh};
})();
