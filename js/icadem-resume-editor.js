/* Section-based editor for the existing professional profile. The API owns
   validation, visibility, membership checks and revision conflict detection. */
(function () {
  'use strict';
  var active = null, serial = 0;
  var sections = {
    sobreMi: {title:'Sobre mí',kind:'object',fields:[['resumen','Resumen profesional','textarea',1200],['presentacion','Presentación personal','textarea',1200],['objetivo','Objetivo profesional · opcional','textarea',600]]},
    experiencia: {title:'Experiencia laboral',kind:'list',singular:'experiencia',fields:[['empresa','Empresa','text',160],['cargo','Puesto','text',160],['inicio','Fecha de inicio','month'],['fin','Fecha de finalización','month'],['actual','Actualmente trabajo aquí','checkbox'],['descripcion','Responsabilidades','textarea',1600],['logros','Logros','textarea',1200]]},
    formacion: {title:'Formación académica',kind:'list',singular:'formación',fields:[['institucion','Institución','text',180],['titulo','Título o grado','text',180],['area','Área de estudio','text',160],['inicio','Fecha de inicio','month'],['fin','Fecha de finalización','month'],['estado','Estado de estudios','select',['','En curso','Finalizado','Incompleto']],['descripcion','Descripción · opcional','textarea',1200]]},
    idiomas: {title:'Idiomas',kind:'list',singular:'idioma',fields:[['idioma','Idioma','text',80],['nivel','Nivel','select',['A1','A2','B1','B2','C1','C2','Nativo']]]},
    habilidades: {title:'Habilidades',kind:'object',fields:[['habilidadesTecnicas','Habilidades técnicas · una por línea','tags',40],['herramientas','Herramientas y software · uno por línea','tags',40],['competencias','Competencias profesionales · una por línea','tags',40]]},
    certificaciones: {title:'Certificaciones',kind:'list',singular:'certificación',fields:[['nombre','Nombre de la certificación','text',180],['institucion','Institución emisora','text',180],['fecha','Fecha','month'],['identificador','Identificador · opcional','text',160],['url','Enlace verificable HTTPS · opcional','url',500]]},
    proyectos: {title:'Proyectos destacados',kind:'list',singular:'proyecto',fields:[['nombre','Nombre del proyecto','text',180],['descripcion','Descripción','textarea',1600],['participacion','Tu participación','textarea',600],['inicio','Fecha de inicio','month'],['fin','Fecha de finalización','month'],['url','Enlace HTTPS · opcional','url',500]]},
    enlaces: {title:'Enlaces profesionales',kind:'list',singular:'enlace',fields:[['nombre','Nombre','text',100],['canal','Canal de contacto','select',['web','linkedin','instagram','facebook']],['url','Enlace HTTPS','url',500]]},
    estilo: {title:'Personaliza tu currículum',kind:'style'}
  };
  var sectionKeys = Object.keys(sections);
  function esc(v){return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function color(v,fallback){return window.ICADEMDirectory?.colorValue?.(v,fallback)||(/^#[0-9a-f]{6}$/i.test(String(v||''))?v:fallback||'#244B64');}
  function palette(profile){return window.ICADEMDirectory?.palette?.(profile)||{defaultVip:'#E9BC43',defaultFree:'#244B64',colors:[]};}
  function rowSnapshot(row,config){
    var result={...(row&&typeof row==='object'?row:{})};
    config.fields.forEach(function(field){var name=field[0],value=result[name];
      if(field[2]==='checkbox')result[name]=value===true;
      else if(field[2]==='tags')result[name]=Array.isArray(value)?copy(value):[];
      else if(field[2]==='select')result[name]=value==null||value===''&&!field[3].includes('')?field[3][0]:String(value);
      else result[name]=value==null?'':String(value);
    });
    if(result.actual)result.fin='';
    return result;
  }
  function sectionData(cv,key){
    if(key==='sobreMi')return {resumen:cv.resumen||'',presentacion:cv.presentacion||'',objetivo:cv.objetivo||''};
    if(key==='habilidades')return {habilidadesTecnicas:copy(Array.isArray(cv.habilidadesTecnicas)?cv.habilidadesTecnicas:cv.habilidades||[]),herramientas:copy(cv.herramientas||[]),competencias:copy(cv.competencias||[])};
    if(key==='estilo')return {color:color(cv.estilo?.savedColor||cv.estilo?.preferenciaGuardada||cv.estilo?.color,'#244B64').toLowerCase(),reset:false};
    return (Array.isArray(cv[key])?cv[key]:[]).map(function(row){return rowSnapshot(row,sections[key]);});
  }
  function visibility(cv,key){return cv.visibilidad?.[key]||(['sobreMi','experiencia','formacion','habilidades'].includes(key)?'public':'private');}
  function snapshot(profile){var cv=profile.cv||{},out={};sectionKeys.forEach(function(key){out[key]={data:sectionData(cv,key),visibility:visibility(cv,key),revision:Number(cv.revisiones?.[key])||0};});return out;}
  function valuesIntoCv(cv,key,data){
    if(key==='sobreMi'||key==='habilidades')Object.assign(cv,copy(data));
    else if(key==='estilo')cv.estilo={...(cv.estilo||{}),color:data.reset?'#244B64':data.color};
    else cv[key]=copy(data);
  }
  function previewProfile(state){
    var p=copy(state.profile),cv=p.cv||(p.cv={});
    sectionKeys.forEach(function(key){var s=state.drafts[key];valuesIntoCv(cv,key,s.data);});
    var hidden={sobreMi:['resumen','presentacion','objetivo'],habilidades:['habilidades','habilidadesTecnicas','herramientas','competencias']};
    sectionKeys.filter(function(key){return key!=='estilo'&&state.drafts[key].visibility!=='public';}).forEach(function(key){(hidden[key]||[key]).forEach(function(field){delete cv[field];});});
    // The preview models an ordinary visitor. Explicit URL fields remain subject
    // to the contact policy at the server; never preview owner-only contacts.
    ['certificaciones','proyectos'].forEach(function(key){(cv[key]||[]).forEach(function(row){delete row.url;if(key==='certificaciones'&&/https?:\/\//i.test(String(row.identificador||'')))delete row.identificador;});});
    delete cv.enlaces;p.contacts={};p.own=false;p.preview=true;p.connection='none';
    if(!p.isVip)cv.estilo={color:'#244B64'};
    return p;
  }
  function current(s){return active===s&&s.root.isConnected&&!window.__sessionEnding&&window.UserState?.uid===s.uid;}
  function isDirty(s){return !!s&&sectionKeys.some(function(key){return !!s.drafts[key]&&!!s.saved[key]&&(JSON.stringify(s.drafts[key].data)!==JSON.stringify(s.saved[key].data)||s.drafts[key].visibility!==s.saved[key].visibility);});}
  function message(s,text,error){var el=s.root.querySelector('[data-cve-status]');if(el){el.textContent=text;el.classList.toggle('is-error',!!error);}}
  function statusForm(form,text,error){var el=form.querySelector('[data-cve-section-status]');el.textContent=text;el.classList.toggle('is-error',!!error);}
  function structureReady(s){if(!current(s))return false;if(s.busy){message(s,'Espera la confirmación del guardado antes de cambiar la estructura.');return false;}return true;}
  function lockForm(form,locked){if(locked){form.__cveDisabled=[...form.querySelectorAll('button,input,textarea,select')].map(function(el){var state=[el,el.disabled];el.disabled=true;return state;});}else{(form.__cveDisabled||[]).forEach(function(state){state[0].disabled=state[1];});delete form.__cveDisabled;}}
  function renderPreview(s){return s.options.renderProfile(previewProfile(s));}
  function clear(restore){var s=active;if(!s)return;active=null;serial++;if(restore&&s.root.isConnected&&window.UserState?.uid===s.uid&&!window.__sessionEnding)s.options.onClose(s.profile);s.profile=null;s.drafts={};s.saved={};}
  function back(s){if(!current(s))return;if(s.busy){message(s,'Espera la confirmación del guardado antes de salir.');return;}if(isDirty(s)){var box=s.root.querySelector('[data-cve-leave]');box.hidden=false;box.querySelector('button').focus();return;}clear(true);}
  function fieldMarkup(field,row,index,key){
    var name=field[0],label=field[1],kind=field[2],value=row[name],id='cve-'+key+'-'+index+'-'+name;
    if(kind==='checkbox')return '<label class="cve-check"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'><span>'+label+'</span></label>';
    var control;
    if(kind==='select'){
      var choices=field[3].slice(),selected=value==null?'':String(value);
      // Preserve valid legacy text supplied by the server, even when it is not
      // one of today's suggestions. Merely opening the editor must not erase it.
      if(value!=null&&!choices.includes(selected))choices.unshift(selected);
      control='<select id="'+id+'" name="'+name+'">'+choices.map(function(option){return '<option value="'+esc(option)+'" '+(selected===option?'selected':'')+'>'+esc(option||'Selecciona…')+'</option>';}).join('')+'</select>';
    }
    else if(kind==='textarea'||kind==='tags')control='<textarea id="'+id+'" name="'+name+'" rows="3" maxlength="'+(kind==='tags'?2000:field[3])+'">'+esc(kind==='tags'?(Array.isArray(value)?value.join('\n'):''):value||'')+'</textarea>';
    else control='<input id="'+id+'" name="'+name+'" type="'+kind+'" '+(field[3]?'maxlength="'+field[3]+'"':'')+' '+(kind==='url'?'placeholder="https://…"':'')+' value="'+esc(value||'')+'">';
    return '<label class="cve-field'+(['textarea','tags'].includes(kind)?' cve-field--wide':'')+'" for="'+id+'"><span>'+label+'</span>'+control+'</label>';
  }
  function collect(form,key,s){
    var config=sections[key],data;
    function rowData(root,previous){var row={...(previous||{})};config.fields.forEach(function(f){var el=root.querySelector('[name="'+f[0]+'"]');row[f[0]]=f[2]==='checkbox'?el.checked:f[2]==='tags'?[...new Set(el.value.split(/[\n,]/).map(function(x){return x.trim();}).filter(Boolean))]:el.value;});if(row.actual)row.fin='';return row;}
    if(config.kind==='list')data=[...form.querySelectorAll('[data-cve-row]')].map(function(root,i){return rowData(root,s.drafts[key].data[i]);});
    else if(config.kind==='object')data=rowData(form,s.drafts[key].data);
    else data={...s.drafts[key].data,color:String(form.querySelector('[data-cve-color]')?.value||s.drafts[key].data.color).toLowerCase()};
    s.drafts[key].data=data;if(key!=='estilo')s.drafts[key].visibility=form.querySelector('[name="visibility"]').value;
    return s.drafts[key];
  }
  function bodyMarkup(s,key){
    var config=sections[key],draft=s.drafts[key],rows=draft.data;
    if(config.kind==='style'){
      var editable=s.profile.cv?.estilo?.editable===true||s.profile.isVip===true,p=palette(s.profile);
      return '<p class="cve-help">El tema del currículum es independiente de la portada de tu tarjeta. Usa el mismo selector de color del Directorio.</p>'+(!editable?'<div class="cve-note">El diseño personalizado requiere una membresía VIP activa. Tu información y tu preferencia guardada se conservan.</div>':'')+'<fieldset class="cve-style-controls" '+(!editable?'disabled':'')+'><legend>Elige el color de tu currículum</legend><div class="cve-swatches">'+p.colors.map(function(x){return '<button type="button" class="cve-swatch" style="--swatch:'+color(x.value)+'" data-cve-swatch="'+color(x.value)+'" aria-label="'+esc(x.label)+'" aria-pressed="'+(draft.data.color.toLowerCase()===x.value.toLowerCase()&&!draft.data.reset)+'"></button>';}).join('')+'<label class="cve-custom-color">Color personalizado<input type="color" data-cve-color aria-label="Color de tu currículum" value="'+color(draft.data.color,p.defaultFree)+'"></label></div><button type="button" class="community-secondary" data-cve-reset>Restablecer predeterminado</button></fieldset><p class="cve-help">Vista previa de tu información pública. Los enlaces siguen sujetos a los permisos de contacto.</p><div class="cve-theme-preview" data-cve-theme-preview>'+renderPreview(s)+'</div>';
    }
    var info=key==='certificaciones'?'<p class="cve-note">Las certificaciones declaradas no se presentan como verificadas por ICADEM. Sus enlaces respetan tus permisos de contacto.</p>':['enlaces','proyectos'].includes(key)?'<p class="cve-note">Los enlaces respetan la privacidad de contacto del Directorio, además de la visibilidad de esta sección.</p>':'';
    var content=config.kind==='object'?'<div class="cve-fields">'+config.fields.map(function(f){return fieldMarkup(f,rows,0,key);}).join('')+'</div>':'<div class="cve-rows">'+rows.map(function(row,index){return '<fieldset class="cve-row" data-cve-row="'+index+'"><legend>'+esc(config.title)+' · '+(index+1)+'</legend><div class="cve-row-tools"><button type="button" data-cve-move="-1" data-index="'+index+'" aria-label="Subir registro '+(index+1)+'" '+(!index?'disabled':'')+'>↑</button><button type="button" data-cve-move="1" data-index="'+index+'" aria-label="Bajar registro '+(index+1)+'" '+(index===rows.length-1?'disabled':'')+'>↓</button><button type="button" data-cve-remove="'+index+'">Eliminar registro</button></div><div class="cve-fields">'+config.fields.map(function(f){return fieldMarkup(f,row,index,key);}).join('')+'</div></fieldset>';}).join('')+'</div><button type="button" class="community-secondary" data-cve-add>+ Agregar '+esc(config.singular)+'</button>';
    return info+content+'<label class="cve-visibility">Quién puede ver esta sección<select name="visibility"><option value="public" '+(draft.visibility==='public'?'selected':'')+'>Todos los miembros</option><option value="connections" '+(draft.visibility==='connections'?'selected':'')+'>Conexiones aceptadas</option><option value="private" '+(draft.visibility==='private'?'selected':'')+'>Solo yo</option></select></label>';
  }
  function draw(s,expanded){
    if(!current(s))return;s.preview=false;
    s.root.innerHTML='<section class="cve" aria-labelledby="cve-title"><header class="cve-header"><div><span class="cve-eyebrow">TU TRAYECTORIA, A TU RITMO</span><h1 id="cve-title" tabindex="-1">Tu currículum profesional</h1><p>Completa solo lo que quieras compartir. Cada sección se guarda por separado.</p></div><div class="cve-header-actions"><button type="button" class="community-secondary" data-cve-preview>Vista previa pública</button><button type="button" class="community-secondary" data-cve-basic>Datos básicos y contactos</button><button type="button" class="community-secondary" data-cve-back>Volver a mi perfil</button></div></header><p class="cve-status" data-cve-status role="status" aria-live="polite"></p><div class="cve-leave" data-cve-leave hidden><p>Tienes cambios sin guardar. Los cambios guardados por sección se conservarán.</p><button type="button" class="community-secondary" data-cve-stay>Seguir editando</button><button type="button" class="community-primary" data-cve-discard>Descartar pendientes y volver</button></div><div class="cve-sections">'+sectionKeys.map(function(key){var section=sections[key];return '<details class="cve-section" data-cve-section="'+key+'" '+(expanded===key?'open':'')+'><summary><span><strong>'+section.title+'</strong><small>'+ (key==='estilo'?'Color y vista previa':section.kind==='list'?s.drafts[key].data.length+' registros':'Presentación y detalles')+'</small></span><span class="cve-section-caret" aria-hidden="true">+</span></summary><form data-cve-form="'+key+'">'+bodyMarkup(s,key)+'<div class="cve-section-actions"><button type="submit" class="community-primary" '+(key==='estilo'&&!s.profile.isVip?'disabled':'')+'>'+(key==='estilo'?'Guardar estilo':'Guardar sección')+'</button><button type="button" class="community-secondary" data-cve-cancel>Cancelar cambios</button><button type="button" class="community-secondary" data-cve-reload hidden>Recargar sección</button></div><p class="cve-section-status" data-cve-section-status role="status" aria-live="polite"></p></form></details>';}).join('')+'</div></section>';
    s.root.querySelector('[data-cve-back]').addEventListener('click',function(){captureAll(s);back(s);});
    s.root.querySelector('[data-cve-preview]').addEventListener('click',function(){if(s.busy)return;captureAll(s);showPreview(s);});
    s.root.querySelector('[data-cve-basic]').addEventListener('click',function(){if(s.busy)return;captureAll(s);if(isDirty(s)){message(s,'Guarda o cancela tus cambios antes de abrir los datos básicos.',true);return;}var p=s.profile;clear(true);s.options.onBasic?.(p);});
    s.root.querySelector('[data-cve-stay]').addEventListener('click',function(){s.root.querySelector('[data-cve-leave]').hidden=true;});
    s.root.querySelector('[data-cve-discard]').addEventListener('click',function(){if(!s.busy)clear(true);});
    s.root.querySelectorAll('[data-cve-form]').forEach(function(form){bindForm(s,form,form.dataset.cveForm);});
  }
  function captureAll(s){s.root.querySelectorAll('[data-cve-form]').forEach(function(form){collect(form,form.dataset.cveForm,s);});}
  function bindForm(s,form,key){
    var config=sections[key];
    form.addEventListener('input',function(){if(current(s)){collect(form,key,s);if(key==='estilo'){s.drafts[key].data.reset=false;form.querySelector('[data-cve-theme-preview]').innerHTML=renderPreview(s);form.querySelectorAll('[data-cve-swatch]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.cveSwatch.toLowerCase()===s.drafts[key].data.color.toLowerCase()));});}}});
    form.querySelector('[data-cve-cancel]').addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key]=copy(s.saved[key]);draw(s,key);});
    form.querySelector('[data-cve-reload]').addEventListener('click',async function(){await reloadSection(s,key);});
    form.querySelector('[data-cve-add]')?.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);if(s.drafts[key].data.length>=10){statusForm(form,'Puedes registrar hasta 10 elementos en esta sección.',true);return;}s.drafts[key].data.push({id:window.crypto?.randomUUID?.()||'cv-'+Date.now()+'-'+Math.random().toString(36).slice(2)});draw(s,key);});
    form.querySelectorAll('[data-cve-remove]').forEach(function(button){button.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key].data.splice(Number(button.dataset.cveRemove),1);draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Registro retirado de tu borrador. Guarda la sección para confirmar.');});});
    form.querySelectorAll('[data-cve-move]').forEach(function(button){button.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);var rows=s.drafts[key].data,i=Number(button.dataset.index),next=i+Number(button.dataset.cveMove);if(next<0||next>=rows.length)return;[rows[i],rows[next]]=[rows[next],rows[i]];draw(s,key);});});
    form.querySelectorAll('[data-cve-swatch]').forEach(function(button){button.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key].data={color:button.dataset.cveSwatch,reset:false};draw(s,key);});});
    form.querySelector('[data-cve-reset]')?.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key].data={color:palette(s.profile).defaultFree,reset:true};draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Vista previa predeterminada. Pulsa Guardar estilo para confirmar.');});
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(!current(s)||s.busy)return;if(form.reportValidity&&!form.reportValidity())return;
      captureAll(s);var draft=s.drafts[key],payload={section:key,revision:s.saved[key].revision,data:copy(draft.data)};if(key!=='estilo')payload.visibility=draft.visibility;
      s.busy=true;lockForm(form,true);statusForm(form,'Guardando…');
      try{var response=await s.options.save(payload);if(!current(s))return;if(!response?.profile||response.profile.uid!==s.uid||response.profile.own!==true)throw Error('No se pudo confirmar el perfil.');s.profile=response.profile;var confirmed=snapshot(response.profile)[key];s.saved[key]=copy(confirmed);s.drafts[key]=copy(confirmed);s.busy=false;draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Cambios guardados y confirmados por el servidor.');}
      catch(error){s.busy=false;if(!current(s))return;lockForm(form,false);statusForm(form,error.status===409?'Esta sección cambió en otra sesión. Recarga la sección antes de volver a guardar.':error.message||'No pudimos guardar. Tu borrador se conserva.',true);if(error.status===409)form.querySelector('[data-cve-reload]').hidden=false;}
    });
  }
  async function reloadSection(s,key){if(!current(s)||s.busy)return;captureAll(s);var form=s.root.querySelector('[data-cve-form="'+key+'"]');s.busy=true;lockForm(form,true);try{var response=await s.options.load();if(!current(s))return;if(!response?.profile||response.profile.uid!==s.uid||response.profile.own!==true)throw Error('No se pudo confirmar el perfil.');s.profile=response.profile;var next=snapshot(response.profile)[key];s.saved[key]=copy(next);s.drafts[key]=copy(next);s.busy=false;draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Sección actualizada desde el servidor.');}catch(error){s.busy=false;if(current(s)){lockForm(form,false);message(s,error.message||'No pudimos actualizar la sección.',true);}}}
  function showPreview(s){s.preview=true;s.root.innerHTML='<section class="cve-preview"><header class="cve-preview-heading"><div><h1 tabindex="-1">Vista previa pública</h1><p>Incluye tu borrador. Los cambios todavía no guardados no están publicados. Se ocultan contactos y enlaces protegidos.</p></div><button type="button" class="community-primary" data-cve-return>Volver al editor</button></header>'+renderPreview(s)+'</section>';s.root.querySelector('[data-cve-return]').addEventListener('click',function(){draw(s);});s.root.querySelector('h1')?.focus();}
  async function open(options){
    clear(false);var root=options.container,uid=window.UserState?.uid;if(!root||!uid||options.profile?.uid!==uid||options.profile.own!==true||window.__sessionEnding)return;
    var s={root,uid,options,profile:options.profile,drafts:{},saved:{},busy:true,id:++serial};active=s;
    root.innerHTML='<div class="professional-profile-loading" role="status">Cargando tu currículum…</div>';
    try{var response=await options.load();if(!current(s))return;if(!response?.profile||response.profile.uid!==uid||response.profile.own!==true)throw Error('No se pudo confirmar tu perfil.');s.profile=response.profile;s.saved=snapshot(response.profile);s.drafts=copy(s.saved);s.busy=false;draw(s,'sobreMi');root.querySelector('h1')?.focus({preventScroll:true});}
    catch(error){if(current(s)){root.innerHTML='<div class="professional-profile-loading" role="alert"><p>'+esc(error.message||'No pudimos cargar tu currículum.')+'</p><button type="button" class="community-secondary" data-cve-retry>Reintentar</button><button type="button" class="community-secondary" data-cve-close>Volver al perfil</button></div>';root.querySelector('[data-cve-retry]').addEventListener('click',function(){open(options);});root.querySelector('[data-cve-close]').addEventListener('click',function(){clear(true);});}}
  }
  ['icadem:session-ending','icadem:session-ended','icadem:user-ready'].forEach(function(event){document.addEventListener(event,function(){if(active){active.root.replaceChildren();clear(false);}});});
  window.addEventListener('icadem:navigation',function(){if(active&&(location.hash!=='#directorio-perfil'||window.ICADEMProfessionalNavigation?.currentProfileId?.()!==active.uid))clear(false);});
  window.addEventListener('beforeunload',function(event){if(active){captureAll(active);if(isDirty(active)){event.preventDefault();event.returnValue='';}}});
  window.ICADEMResumeEditor={open:open,isOpen:function(root){return !!active&&current(active)&&(!root||active.root===root||root.contains?.(active.root));},isDirty:function(){if(active&&!active.preview)captureAll(active);return isDirty(active);}};
})();
