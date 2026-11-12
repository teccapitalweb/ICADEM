/* Navigation state only. No profiles, contacts or membership data are cached. */
(function () {
  'use strict';
  var SECTION='directorio-perfil', ACTIVITY='directorio-actividad', NETWORK='directorio-red', memory=null, forumMemory=null, activeSection='', restore=false, restoreForum=false, restoreActivity=false, restoreNetwork=false, revision=0;
  var KEY='icadem:directory-return:v1:', MAX_AGE=4*60*60*1000;
  var FORUM_KEY='icadem:forum-return:v1:';
  var DIRECTORY_VIEWS=['directorio','directorio-solicitudes','directorio-conexiones','directorio-vip'],directoryMemory={};
  function directoryTab(section){return section==='directorio-solicitudes'?'requests':section==='directorio-conexiones'?'connections':'directory';}
  var EDIT_SECTIONS=['basicos','apariencia','contactos','sobreMi','experiencia','formacion','idiomas','habilidades','certificaciones','proyectos','enlaces','estilo'];
  var historyIndex=Number.isInteger(history.state?.icademProfessionalIndex)?history.state.icademProfessionalIndex:0,committed=null,restoring=null,acceptedHistory=null;
  function viewer(){return window.UserState?.uid||window.__currentUser?.uid||'';}
  function validUid(uid){return typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);}
  function currentProfileId(){try{return new URL(location.href).searchParams.get('profesional')||'';}catch(_){return '';}}
  function currentEditorSection(){try{var value=new URL(location.href).searchParams.get('editar');return EDIT_SECTIONS.includes(value)?value:'';}catch(_){return '';}}
  function routeLocation(){return location.pathname+location.search+location.hash;}
  function allowNavigation(section,options,proceed){
    if(options?.professionalApproved)return true;
    if(acceptedHistory===routeLocation()){acceptedHistory=null;return true;}
    return window.ICADEMResumeEditor?.requestLeave?.(proceed)!==false;
  }
  function handleHistory(){
    var here=routeLocation();
    if(restoring){
      if(here===committed?.url){var resume=restoring;restoring=null;var leave=function(){acceptedHistory=resume.url;history.go(resume.delta);};if(window.ICADEMResumeEditor?.requestLeave?.(leave)!==false)leave();}
      return true;
    }
    if(acceptedHistory===here)return false;
    var editor=window.ICADEMResumeEditor;
    if(!committed||here===committed.url||!editor?.isOpen?.()||(!editor.isDirty?.()&&!editor.isBusy?.()))return false;
    var target={url:here,state:history.state,index:history.state?.icademProfessionalIndex},delta=Number.isInteger(target.index)?target.index-historyIndex:0;
    if(delta){restoring={url:here,delta:delta};history.go(-delta);return true;}
    // Old/unindexed links still keep the current form and URL when cancelled.
    var destination=new URL(here,location.href),section=destination.hash.slice(1),uid=destination.searchParams.get('profesional'),edit=destination.searchParams.get('editar');
    history.replaceState(committed.state,'',committed.url);
    var proceed=function(){window.navigateToSection?.(section,{reemplazar:true,profileUid:uid,editSection:edit,professionalApproved:true});};
    if(editor.requestLeave(proceed)!==false)proceed();
    return true;
  }
  function profileHref(uid){
    if(!validUid(uid))return '';
    var url=new URL('vip-panel.html',location.href);url.search='';url.searchParams.set('profesional',uid);url.hash=SECTION;return url.href;
  }
  function activityHref(uid){if(!validUid(uid))return '';var url=new URL(profileHref(uid));url.hash=ACTIVITY;return url.href;}
  function networkContext(state){
    if(window.__sessionEnding)return null;
    var value=state?.icademNetwork;
    if(!value||value.viewer!==viewer()||!validUid(value.owner)||!Number.isFinite(value.at)||value.at>Date.now()||Date.now()-value.at>MAX_AGE)return null;
    return {viewer:viewer(),owner:value.owner,at:value.at,tab:value.owner!==viewer()&&value.tab==='mutual'?'mutual':'connections',scroll:value.scroll||null,
      profileIndex:Number.isInteger(value.profileIndex)?value.profileIndex:null,networkIndex:Number.isInteger(value.networkIndex)?value.networkIndex:null,pages:Number.isInteger(value.pages)?Math.max(1,Math.min(20,value.pages)):1};
  }
  function networkTab(){return currentProfileId()!==viewer()&&new URL(location.href).searchParams.get('red')==='mutual'?'mutual':'connections';}
  function activityContext(state){
    var value=state?.icademActivity,at=Number(value?.at);
    if(!value||value.viewer!==viewer()||!validUid(value.owner)||!Number.isFinite(at)||at>Date.now()||Date.now()-at>MAX_AGE)return null;
    var index=function(value){return Number.isInteger(value)&&value>=0?value:null;};
    return {viewer:viewer(),owner:value.owner,at:at,profileIndex:index(value.profileIndex),activityIndex:index(value.activityIndex),scroll:value.scroll||null,pages:Number.isInteger(value.pages)?Math.max(1,Math.min(20,value.pages)):1};
  }
  function scrollPosition(){
    return {window:window.scrollY||0,document:document.documentElement?.scrollTop||0,body:document.body?.scrollTop||0,
      scrolling:document.scrollingElement?.scrollTop||0,main:document.querySelector('main.main')?.scrollTop||0,dynamic:document.getElementById('dynamic-section')?.scrollTop||0};
  }
  function capture(){
    var uid=viewer(),root=document.querySelector('[data-directory-refined]');if(!uid||!root)return;
    var value={uid,at:Date.now(),search:root.querySelector('#dir-search-input')?.value||'',sector:root.querySelector('#dir-sector-select')?.value||'todos',
      tier:root.querySelector('[data-tier][aria-pressed="true"]')?.dataset.tier||'todos',
      tab:activeSection==='directorio'?root.querySelector('[data-community-tab][aria-pressed="true"]')?.dataset.communityTab||'directory':directoryTab(activeSection),scroll:scrollPosition()};
    directoryMemory[activeSection]=value;if(activeSection==='directorio')memory=value;
    try{sessionStorage.setItem(KEY+uid+(activeSection==='directorio'?'':':'+activeSection),JSON.stringify(value));}catch(_){}
  }
  function saved(section){
    section=section||'directorio';
    var uid=viewer(),value=section==='directorio'?memory:directoryMemory[section];
    if(!uid)return null;
    if(!value||value.uid!==uid){try{value=JSON.parse(sessionStorage.getItem(KEY+uid+(section==='directorio'?'':':'+section))||'null');}catch(_){value=null;}}
    if(!value||value.uid!==uid||Date.now()-value.at>MAX_AGE||Date.now()<value.at)return null;
    return {search:String(value.search||'').slice(0,300),sector:String(value.sector||'todos').slice(0,100),tier:value.tier==='vip'?'vip':'todos',
      tab:['directory','requests','connections'].includes(value.tab)?value.tab:'directory',scroll:value.scroll||{}};
  }
  function captureForum(){
    var uid=viewer(),root=document.querySelector('[data-community-forum]');if(!uid||!root)return;
    forumMemory={uid:uid,at:Date.now(),filter:root.querySelector('[data-foro-tab][aria-pressed="true"]')?.dataset.foroTab||'recientes',scroll:scrollPosition()};
    try{sessionStorage.setItem(FORUM_KEY+uid,JSON.stringify(forumMemory));}catch(_){}
  }
  function savedForum(){
    var uid=viewer(),value=forumMemory;if(!uid)return null;
    if(!value||value.uid!==uid){try{value=JSON.parse(sessionStorage.getItem(FORUM_KEY+uid)||'null');}catch(_){value=null;}}
    if(!value||value.uid!==uid||Date.now()-value.at>MAX_AGE||Date.now()<value.at)return null;
    return {filter:['recientes','populares','mios'].includes(value.filter)?value.filter:'recientes',scroll:value.scroll||{}};
  }
  function prepare(section,options){
    options=options||{};revision++;
    if(DIRECTORY_VIEWS.includes(activeSection)&&(section===SECTION||DIRECTORY_VIEWS.includes(section)&&section!==activeSection))capture();
    if(activeSection==='foro'&&section===SECTION)captureForum();
    var url=new URL(location.href),state=Object.assign({},history.state||{}),previous=activeSection;
    var network=networkContext(state);
    if(section===NETWORK){
      var owner=options.profileUid===undefined?currentProfileId():options.profileUid;
      if(!network||network.owner!==owner)network={viewer:viewer(),owner:owner,at:Date.now(),profileIndex:previous===SECTION&&currentProfileId()===owner?historyIndex:null,networkIndex:null,scroll:null,tab:'connections'};
      network.tab=options.networkTab===undefined?(options.fromHistory||options.reemplazar?networkTab():network.tab):options.networkTab==='mutual'?'mutual':'connections';
      if(owner===viewer())network.tab='connections';
      state.icademNetwork=validUid(owner)?network:null;url.searchParams.set('red',network.tab);
    }else{
      url.searchParams.delete('red');
      if(section===SECTION&&network&&previous===NETWORK&&options.networkProfile){state.icademNetwork={...network,tab:networkTab(),scroll:scrollPosition(),networkIndex:historyIndex,at:Date.now()};}
      else if(!network||options.networkOwner||![SECTION,ACTIVITY,'foro'].includes(section)||![NETWORK,SECTION,ACTIVITY,'foro'].includes(previous))delete state.icademNetwork;
    }
    var activity=activityContext(state),activityUid=section===ACTIVITY?(options.profileUid===undefined?currentProfileId():options.profileUid):null;
    if(section===ACTIVITY){
      if(!activity||activity.owner!==activityUid){
        var fromProfile=previous===SECTION&&currentProfileId()===activityUid;
        if(!fromProfile)delete state.icademProfessional;
        activity={viewer:viewer(),owner:activityUid,at:Date.now(),profileIndex:fromProfile?historyIndex:null,activityIndex:null,scroll:null};
      }
      state.icademActivity=validUid(activityUid)?activity:null;
    }else if(section==='foro'&&options.activityPost===true&&previous===ACTIVITY&&validUid(currentProfileId())){
      activity=activity&&activity.owner===currentProfileId()?activity:{viewer:viewer(),owner:currentProfileId(),at:Date.now(),profileIndex:null};
      state.icademActivity=Object.assign({},activity,{activityIndex:historyIndex,scroll:scrollPosition(),at:Date.now()});
    }else if(!(section==='foro'&&activity&&(options.fromHistory||options.reemplazar))){delete state.icademActivity;}
    if(section==='foro'){
      if(options.notificationPost&&/^[A-Za-z0-9_-]{1,180}$/.test(options.notificationPost)){
        url.searchParams.set('publicacion',options.notificationPost);
        if(options.notificationComment&&/^[A-Za-z0-9_-]{1,180}$/.test(options.notificationComment))url.searchParams.set('comentario',options.notificationComment);
        else url.searchParams.delete('comentario');
      }
    }else{url.searchParams.delete('publicacion');url.searchParams.delete('comentario');}
    if(section===SECTION||section===ACTIVITY||section===NETWORK){
      var uid=options.profileUid===undefined?currentProfileId():options.profileUid;
      // Invalid identifiers remain an explicit error view; never guess a user.
      if(validUid(uid))url.searchParams.set('profesional',uid);else url.searchParams.delete('profesional');
      var edit=options.editSection===undefined?(options.reemplazar?currentEditorSection():''):options.editSection;
      if(section===SECTION&&uid===viewer()&&EDIT_SECTIONS.includes(edit))url.searchParams.set('editar',edit);else url.searchParams.delete('editar');
      if(section===SECTION&&!options.reemplazar){
        var prior=state.icademProfessional;
        state.icademProfessional=DIRECTORY_VIEWS.includes(previous)?Object.assign({viewer:viewer(),depth:1},previous!=='directorio'?{origin:previous}:{}):previous==='foro'?{viewer:viewer(),depth:1,origin:'foro'}:
          previous===SECTION&&prior?.viewer===viewer()?Object.assign({viewer:viewer(),depth:Math.min(20,prior.depth+1)},prior.origin?{origin:prior.origin}:{}):null;
      }
    }else{url.searchParams.delete('profesional');url.searchParams.delete('editar');if(!state.icademActivity&&!state.icademNetwork)delete state.icademProfessional;}
    if(DIRECTORY_VIEWS.includes(section)&&section!=='directorio'&&previous==='directorio'&&!options.fromHistory)state.icademDirectoryReturn={viewer:viewer(),index:history.state?.icademProfessionalIndex};
    else if(!DIRECTORY_VIEWS.includes(section)&&section!==SECTION&&section!==ACTIVITY&&section!==NETWORK&&!state.icademActivity&&!state.icademNetwork)delete state.icademDirectoryReturn;
    restore=DIRECTORY_VIEWS.includes(section)&&(previous===SECTION||DIRECTORY_VIEWS.includes(previous)&&previous!==section||options.fromHistory)&&Boolean(saved(section));
    restoreForum=section==='foro'&&previous===SECTION&&Boolean(savedForum());
    restoreActivity=section===ACTIVITY&&Boolean(activityContext(state)?.scroll)&&(previous==='foro'||options.fromHistory||!previous);
    restoreNetwork=section===NETWORK&&Boolean(networkContext(state)?.scroll)&&(previous===SECTION||options.fromHistory||!previous);
    activeSection=section;url.hash=section;
    historyIndex=options.fromHistory&&Number.isInteger(state.icademProfessionalIndex)?state.icademProfessionalIndex:options.reemplazar||url.pathname+url.search+url.hash===routeLocation()?historyIndex:historyIndex+1;
    state.icademProfessionalIndex=historyIndex;
    if(section===ACTIVITY&&state.icademActivity)state.icademActivity.activityIndex=historyIndex;
    if(section===NETWORK&&state.icademNetwork)state.icademNetwork.networkIndex=historyIndex;
    committed={url:url.pathname+url.search+url.hash,state:state};
    return {url:committed.url,historyState:state,restoreDirectory:restore||restoreForum||restoreActivity||restoreNetwork};
  }
  function directoryState(){return restore?saved(activeSection):null;}
  function directoryReady(root,readyTab){
    if(!restore||!DIRECTORY_VIEWS.includes(activeSection)||!root?.isConnected)return;
    var state=saved(activeSection);if(!state)return;
    var tab=activeSection==='directorio'?root.querySelector('[data-community-tab][aria-pressed="true"]')?.dataset.communityTab||'directory':directoryTab(activeSection);
    if(tab!==state.tab||(readyTab&&readyTab!==state.tab))return;
    var position=state.scroll,run=revision;
    requestAnimationFrame(function(){
      if(run!==revision||!restore||!root.isConnected)return;
      restore=false;
      var elements={document:document.documentElement,body:document.body,scrolling:document.scrollingElement,main:document.querySelector('main.main'),dynamic:document.getElementById('dynamic-section')};
      Object.entries(elements).forEach(function(entry){if(entry[1])entry[1].scrollTop=Math.max(0,Number(position[entry[0]])||0);});
      window.scrollTo({top:Math.max(0,Number(position.window)||0),left:0,behavior:'instant'});
    });
  }
  function openProfile(uid){if(!validUid(uid))return false;window.navigateToSection?.(SECTION,{profileUid:uid});return true;}
  function openNetwork(uid){if(!validUid(uid))return false;window.navigateToSection?.(NETWORK,{profileUid:uid});return true;}
  function openNetworkProfile(uid){
    if(!validUid(uid))return false;
    var network=networkContext(history.state);
    if(activeSection===NETWORK&&network){var state={...history.state,icademNetwork:{...network,scroll:scrollPosition(),tab:networkTab(),networkIndex:historyIndex,at:Date.now()}};history.replaceState(state,'',routeLocation());if(committed)committed.state=state;}
    window.navigateToSection?.(SECTION,{profileUid:uid,networkProfile:true});return true;
  }
  function backToNetwork(){var value=networkContext(history.state),index=history.state?.icademProfessionalIndex;if(!value)return false;
    if(Number.isInteger(value.networkIndex)&&Number.isInteger(index)&&index>value.networkIndex&&index-value.networkIndex<=20&&history.length>index-value.networkIndex)history.go(value.networkIndex-index);
    else window.navigateToSection?.(NETWORK,{profileUid:value.owner,networkTab:value.tab,reemplazar:true});return true;}
  function networkOwnerBack(){var value=networkContext(history.state),owner=currentProfileId(),index=history.state?.icademProfessionalIndex;if(!validUid(owner))return false;
    if(value&&Number.isInteger(value.profileIndex)&&Number.isInteger(index)&&index>value.profileIndex&&index-value.profileIndex<=20&&history.length>index-value.profileIndex)history.go(value.profileIndex-index);
    else window.navigateToSection?.(SECTION,{profileUid:owner,networkOwner:true,reemplazar:true});return true;}
  function networkReady(root){if(!restoreNetwork||activeSection!==NETWORK||!root?.isConnected)return;var value=networkContext(history.state),run=revision;if(!value?.scroll)return;
    requestAnimationFrame(()=>{if(!restoreNetwork||run!==revision||!root.isConnected)return;restoreNetwork=false;var p=value.scroll;window.scrollTo({top:Math.max(0,Number(p.window)||0),left:0,behavior:'instant'});
      var els={document:document.documentElement,body:document.body,scrolling:document.scrollingElement,main:document.querySelector('main.main'),dynamic:document.getElementById('dynamic-section')};Object.entries(els).forEach(([key,el])=>{if(el)el.scrollTop=Math.max(0,Number(p[key])||0);});});}
  function openActivity(uid){if(!validUid(uid))return false;window.navigateToSection?.(ACTIVITY,{profileUid:uid});return true;}
  function backToProfile(){
    var value=activityContext(history.state),owner=currentProfileId(),index=history.state?.icademProfessionalIndex;
    if(!validUid(owner))return false;
    if(value?.owner===owner&&Number.isInteger(value.profileIndex)&&Number.isInteger(index)&&index>value.profileIndex&&index-value.profileIndex<=20&&history.length>index-value.profileIndex)history.go(value.profileIndex-index);
    else window.navigateToSection?.(SECTION,{profileUid:owner,reemplazar:true});
    return true;
  }
  function openActivityPost(postId){
    if(activeSection!==ACTIVITY||!validUid(currentProfileId())||typeof postId!=='string'||!/^[A-Za-z0-9_-]{1,180}$/.test(postId))return false;
    var state=Object.assign({},history.state||{}),value=activityContext(state);
    state.icademActivity=Object.assign({},value||{viewer:viewer(),owner:currentProfileId(),profileIndex:null},{activityIndex:historyIndex,scroll:scrollPosition(),at:Date.now()});
    // Preserve scroll on the activity entry itself so browser Back and reload
    // restore it without caching any author, publication or permission data.
    history.replaceState(state,'',routeLocation());if(committed)committed.state=state;
    window.navigateToSection?.('foro',{notificationPost:postId,activityPost:true});return true;
  }
  function activityReturn(){var value=activityContext(history.state);return activeSection==='foro'&&value?{owner:value.owner}:null;}
  function backToActivity(){
    var value=activityContext(history.state),index=history.state?.icademProfessionalIndex;
    if(!value)return false;
    if(Number.isInteger(value.activityIndex)&&Number.isInteger(index)&&index>value.activityIndex&&index-value.activityIndex<=20&&history.length>index-value.activityIndex)history.go(value.activityIndex-index);
    else window.navigateToSection?.(ACTIVITY,{profileUid:value.owner,reemplazar:true});
    return true;
  }
  function activityReady(root){
    if(!restoreActivity||activeSection!==ACTIVITY||!root?.isConnected)return;
    var value=activityContext(history.state),run=revision;
    if(!value?.scroll||value.owner!==currentProfileId())return;
    requestAnimationFrame(function(){
      if(!restoreActivity||run!==revision||!root.isConnected)return;restoreActivity=false;
      var position=value.scroll,elements={document:document.documentElement,body:document.body,scrolling:document.scrollingElement,main:document.querySelector('main.main'),dynamic:document.getElementById('dynamic-section')};
      var offset=function(value){return Number.isFinite(Number(value))?Math.max(0,Math.min(10000000,Number(value))):0;};
      Object.entries(elements).forEach(function(entry){if(entry[1])entry[1].scrollTop=offset(position[entry[0]]);});window.scrollTo({top:offset(position.window),left:0,behavior:'instant'});
    });
  }
  function openEditor(section){
    if(!validUid(viewer()))return false;
    section=EDIT_SECTIONS.includes(section)?section:'basicos';
    if(currentProfileId()===viewer()&&window.ICADEMResumeEditor?.isOpen?.()){
      if(window.ICADEMResumeEditor.focusSection?.(section)===false)return false;
      var url=new URL(location.href);url.searchParams.set('editar',section);
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
      if(committed)committed.url=url.pathname+url.search+url.hash;
      window.__perfilProfesionalEdicionActual=section;return true;
    }
    window.navigateToSection?.(SECTION,{profileUid:viewer(),editSection:section});return true;
  }
  function forumState(){return restoreForum?savedForum():null;}
  function forumReady(root){
    if(!restoreForum||activeSection!=='foro'||!root?.isConnected)return;
    var state=savedForum(),run=revision;if(!state)return;
    requestAnimationFrame(function(){
      if(run!==revision||!restoreForum||!root.isConnected)return;restoreForum=false;
      var position=state.scroll,elements={document:document.documentElement,body:document.body,scrolling:document.scrollingElement,main:document.querySelector('main.main'),dynamic:document.getElementById('dynamic-section')};
      Object.entries(elements).forEach(function(entry){if(entry[1])entry[1].scrollTop=Math.max(0,Number(position[entry[0]])||0);});
      window.scrollTo({top:Math.max(0,Number(position.window)||0),left:0,behavior:'instant'});
    });
  }
  function backLabel(){if(networkContext(history.state))return 'Volver a la red';var source=history.state?.icademProfessional;return source?.viewer===viewer()&&source.origin==='foro'?'Volver a Comunidad ICADEM':source?.viewer===viewer()&&source.origin==='directorio-vip'?'Volver a Profesionales VIP':source?.viewer===viewer()&&source.origin==='directorio-solicitudes'?'Volver a Solicitudes':source?.viewer===viewer()&&source.origin==='directorio-conexiones'?'Volver a Mis conexiones':'Volver al directorio';}
  function backToDirectory(){
    if(activeSection===SECTION&&networkContext(history.state)){backToNetwork();return;}
    if(DIRECTORY_VIEWS.includes(activeSection)&&activeSection!=='directorio'){
      var parent=history.state?.icademDirectoryReturn,index=history.state?.icademProfessionalIndex;
      if(parent?.viewer===viewer()&&Number.isInteger(parent.index)&&Number.isInteger(index)&&index>parent.index&&index-parent.index<=20)history.go(parent.index-index);
      else window.navigateToSection?.('directorio',{reemplazar:true});
      return;
    }
    var source=history.state?.icademProfessional;
    if(source?.viewer===viewer()&&Number.isInteger(source.depth)&&source.depth>=1&&source.depth<=20&&history.length>source.depth)history.go(-source.depth);
    else window.navigateToSection?.(source?.viewer===viewer()&&(source.origin==='foro'||DIRECTORY_VIEWS.includes(source.origin))?source.origin:'directorio',{reemplazar:true});
  }
  function reset(){
    revision++;restore=false;restoreForum=false;restoreActivity=false;restoreNetwork=false;activeSection='';memory=null;directoryMemory={};forumMemory=null;committed=null;restoring=null;acceptedHistory=null;
    if(history.state?.icademNetwork){var state={...history.state};delete state.icademNetwork;history.replaceState(state,'',routeLocation());}
    try{if(viewer()){DIRECTORY_VIEWS.forEach(function(s){sessionStorage.removeItem(KEY+viewer()+(s==='directorio'?'':':'+s));});sessionStorage.removeItem(FORUM_KEY+viewer());}}catch(_){}
  }
  document.addEventListener('icadem:session-ending',reset);
  document.addEventListener('icadem:user-ready',function(){if(memory&&memory.uid!==viewer()||forumMemory&&forumMemory.uid!==viewer())reset();});
  window.ICADEMProfessionalNavigation={validUid:validUid,currentProfileId:currentProfileId,currentEditorSection:currentEditorSection,profileHref:profileHref,prepare:prepare,allowNavigation:allowNavigation,handleHistory:handleHistory,openEditor:openEditor,
    directoryState:directoryState,directoryReady:directoryReady,forumState:forumState,forumReady:forumReady,backLabel:backLabel,openProfile:openProfile,backToDirectory:backToDirectory,
    activityHref:activityHref,openActivity:openActivity,backToProfile:backToProfile,openActivityPost:openActivityPost,activityReturn:activityReturn,backToActivity:backToActivity,activityReady:activityReady,
    openNetwork,openNetworkProfile,backToNetwork,networkOwnerBack,networkTab,networkReady};
})();
