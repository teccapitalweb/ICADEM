/* Section-based editor for the existing professional profile. The API owns
   validation, visibility, membership checks and revision conflict detection. */
(function () {
  'use strict';
  var active = null, serial = 0;
  var sections = {
    basicos: {title:'Datos profesionales',kind:'shared',description:'Tu identidad, ocupación y presentación breve',fields:[['nombre','Nombre completo','text',80],['profesion','Profesión','text',120],['puesto','Puesto o cargo actual','text',80],['especialidad','Especialidad','text',120],['sector','Sector o industria','text',80],['empresa','Empresa o despacho','text',100],['ubicacion','Ciudad o ubicación','text',100],['bio','Presentación breve de la tarjeta','textarea',240],['areas','Áreas de práctica','textarea',500],['visible','Mostrar mi tarjeta en el directorio','checkbox']]},
    apariencia: {title:'Foto y portada',kind:'appearance',description:'Una identidad visual en toda ICADEM'},
    contactos: {title:'Contacto y privacidad',kind:'shared',description:'Elige tus medios y quién puede consultarlos',fields:[['email','Correo profesional','email',120],['whatsapp','WhatsApp con código de país','tel',30],['linkedin','LinkedIn','url',500],['instagram','Instagram · usuario o enlace','text',180],['web','Sitio web','url',500],['facebook','Facebook','url',300]]},
    sobreMi: {title:'Sobre mí',kind:'object',fields:[['resumen','Resumen profesional','textarea',2400],['presentacion','Presentación personal','textarea',1600],['objetivo','Objetivo profesional · opcional','textarea',1000]]},
    experiencia: {title:'Experiencia laboral',kind:'list',singular:'experiencia',fields:[['empresa','Empresa','text',160],['cargo','Puesto','text',160],['inicio','Fecha de inicio','month'],['fin','Fecha de finalización','month'],['actual','Actualmente trabajo aquí','checkbox'],['descripcion','Responsabilidades','textarea',1600],['logros','Logros','textarea',1200]]},
    formacion: {title:'Formación académica',kind:'list',singular:'formación',fields:[['institucion','Institución','text',180],['titulo','Título o grado','text',180],['area','Área de estudio','text',160],['inicio','Fecha de inicio','month'],['fin','Fecha de finalización','month'],['estado','Estado de estudios','select',['','En curso','Finalizado','Incompleto']],['descripcion','Descripción · opcional','textarea',1200]]},
    idiomas: {title:'Idiomas',kind:'list',singular:'idioma',fields:[['idioma','Idioma','text',80],['sistema','Sistema de evaluación','text',30],['nivel','Nivel','text',30],['acreditacion','¿Cómo acreditas tu nivel?','text',30],['organismo','Organismo emisor · opcional','text',160],['fecha','Fecha · opcional','month'],['resultado','Resultado · opcional','text',160]]},
    habilidades: {title:'Habilidades',kind:'object',fields:[['habilidadesTecnicas','Habilidades técnicas · una por línea','tags',40],['herramientas','Herramientas y software · uno por línea','tags',40],['competencias','Competencias profesionales · una por línea','tags',40]]},
    certificaciones: {title:'Certificaciones',kind:'list',singular:'certificación',fields:[['nombre','Nombre de la certificación','text',180],['institucion','Institución emisora','text',180],['fecha','Fecha','month'],['identificador','Identificador · opcional','text',160],['url','Enlace verificable HTTPS · opcional','url',500]]},
    proyectos: {title:'Proyectos destacados',kind:'list',singular:'proyecto',fields:[['nombre','Nombre del proyecto','text',180],['descripcion','Descripción','textarea',1600],['participacion','Tu participación','textarea',600],['inicio','Fecha de inicio','month'],['fin','Fecha de finalización','month'],['url','Enlace HTTPS · opcional','url',500]]},
    enlaces: {title:'Enlaces profesionales',kind:'list',singular:'enlace',fields:[['nombre','Nombre','text',100],['canal','Canal de contacto','select',['web','linkedin','instagram','facebook']],['url','Enlace HTTPS','url',500]]},
    estilo: {title:'Personaliza tu currículum',kind:'style'}
  };
  var sectionKeys = Object.keys(sections);
  var sharedKeys=['basicos','apariencia','contactos'],channels={email:'Correo profesional',whatsapp:'WhatsApp',linkedin:'LinkedIn',instagram:'Instagram',web:'Sitio web',facebook:'Facebook'};
  function shared(key){return sharedKeys.includes(key);}
  function esc(v){return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function color(v,fallback){return window.ICADEMDirectory?.colorValue?.(v,fallback)||(/^#[0-9a-f]{6}$/i.test(String(v||''))?v:fallback||'#244B64');}
  function palette(profile){return window.ICADEMDirectory?.palette?.(profile)||{defaultVip:'#E9BC43',defaultFree:'#244B64',colors:[]};}
  function languageRules(){return window.ICADEMCVLanguages;}
  function skillLines(value){return [...new Set(String(value||'').split(/\r\n|[\n\r\u2028\u2029]/).map(function(line){return line.trim();}).filter(Boolean))];}
  function skillSnapshot(value){return skillLines(Array.isArray(value)?value.filter(function(item){return typeof item==='string';}).join('\n'):typeof value==='string'?value:'');}
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
    if(key==='habilidades')return {habilidadesTecnicas:skillSnapshot(Object.hasOwn(cv,'habilidadesTecnicas')?cv.habilidadesTecnicas:cv.habilidades||[]),herramientas:skillSnapshot(cv.herramientas),competencias:skillSnapshot(cv.competencias)};
    if(key==='estilo')return {color:color(cv.estilo?.savedColor||cv.estilo?.preferenciaGuardada||cv.estilo?.color,'#244B64').toLowerCase(),reset:false};
    if(key==='idiomas')return (Array.isArray(cv.idiomas)?cv.idiomas:[]).map(function(row){return languageRules().normalize(row);});
    return (Array.isArray(cv[key])?cv[key]:[]).map(function(row){return rowSnapshot(row,sections[key]);});
  }
  function visibility(cv,key){return cv.visibilidad?.[key]||(['sobreMi','experiencia','formacion','habilidades'].includes(key)?'public':'private');}
  function sharedData(profile,key){
    var source=profile.editor?.[key]?.data;
    if(source)return copy(source);
    if(key==='apariencia')return {foto:profile.foto||'',fotoOrigen:profile.photoSource||'',photoVersion:profile.photoVersion||'',portadaUrl:profile.portadaUrl||'',portadaColor:profile.portadaColor||palette(profile).defaultVip,portadaColorPersonalizado:profile.portadaColorPersonalizado===true};
    if(key==='contactos')return {...Object.fromEntries(Object.keys(channels).map(function(channel){return [channel,profile.contacts?.[channel]||''];})),contactScopes:{...Object.fromEntries(Object.keys(channels).map(function(channel){return [channel,profile.contactScopes?.[channel]||'hidden'];}))}};
    var cv=profile.cv||{};return {nombre:profile.nombre||'',profesion:profile.profesion||'',puesto:profile.puesto||'',especialidad:profile.especialidad||'',sector:profile.sector||'',empresa:profile.empresa||'',ubicacion:profile.ubicacion||'',bio:profile.bio||'',areas:cv.areas||'',visible:profile.visible!==false};
  }
  function snapshot(profile){var cv=profile.cv||{},out={};sectionKeys.forEach(function(key){out[key]=shared(key)?{data:sharedData(profile,key),revision:Number(profile.editor?.[key]?.revision)||0,resoluciones:{}}:{data:sectionData(cv,key),visibility:visibility(cv,key),revision:Number(cv.revisiones?.[key])||0};});return out;}
  function valuesIntoCv(cv,key,data){
    if(key==='sobreMi'||key==='habilidades')Object.assign(cv,copy(data));
    else if(key==='estilo')cv.estilo={...(cv.estilo||{}),color:data.reset?'#244B64':data.color};
    else cv[key]=copy(data);
  }
  function previewProfile(state){
    var p=copy(state.profile),cv=p.cv||(p.cv={});
    sectionKeys.filter(function(key){return !shared(key);}).forEach(function(key){var s=state.drafts[key];valuesIntoCv(cv,key,s.data);});
    var basics=state.drafts.basicos.data;Object.assign(p,copy(basics));cv.areas=basics.areas||'';
    ['profesion','especialidad','ubicacion'].forEach(function(field){var conflict=(state.profile.editor?.basicos?.conflicts||[]).find(function(item){return item.campo===field;});if(!conflict||state.drafts.basicos.resoluciones?.[field])cv[field==='ubicacion'?'ciudad':field]=basics[field]||'';});
    var photo=state.drafts.apariencia.data;Object.assign(p,{foto:photo.avatarDataUrl||photo.foto||'',portadaUrl:photo.removeCover?'':photo.coverDataUrl||photo.portadaUrl||'',portadaColor:photo.resetCoverColor?palette(p).defaultVip:photo.portadaColor,portadaColorPersonalizado:photo.resetCoverColor?false:photo.portadaColorPersonalizado||Object.hasOwn(photo,'portadaColor')});
    var hidden={sobreMi:['resumen','presentacion','objetivo'],habilidades:['habilidades','habilidadesTecnicas','herramientas','competencias']};
    sectionKeys.filter(function(key){return !shared(key)&&key!=='estilo'&&state.drafts[key].visibility!=='public';}).forEach(function(key){(hidden[key]||[key]).forEach(function(field){delete cv[field];});});
    // The preview models an ordinary visitor. Explicit URL fields remain subject
    // to the contact policy at the server; never preview owner-only contacts.
    ['certificaciones','proyectos'].forEach(function(key){(cv[key]||[]).forEach(function(row){delete row.url;if(key==='certificaciones'&&/https?:\/\//i.test(String(row.identificador||'')))delete row.identificador;});});
    delete cv.enlaces;delete p.editor;delete p.authEmail;p.contacts={};p.own=false;p.preview=true;p.connection='none';
    if(!p.isVip)cv.estilo={color:'#244B64'};
    return p;
  }
  function current(s){return active===s&&s.root.isConnected&&!window.__sessionEnding&&window.UserState?.uid===s.uid;}
  function photoConfirmedAfter(s,profile,ticket){if((s.photoRevision||0)!==ticket&&s.photoSelection)Object.assign(profile,s.photoSelection);return profile;}
  function isDirty(s){return !!s&&(s.fileReading||s.coverController&&!s.coverController.ready()||sectionKeys.some(function(key){return !!s.drafts[key]&&!!s.saved[key]&&(JSON.stringify(s.drafts[key].data)!==JSON.stringify(s.saved[key].data)||JSON.stringify(s.drafts[key].resoluciones||{})!==JSON.stringify(s.saved[key].resoluciones||{})||s.drafts[key].visibility!==s.saved[key].visibility);}));}
  function message(s,text,error){var el=s.root.querySelector('[data-cve-status]');if(el){el.textContent=text;el.classList.toggle('is-error',!!error);}}
  function statusForm(form,text,error){var el=form.querySelector('[data-cve-section-status]');el.textContent=text;el.classList.toggle('is-error',!!error);}
  function structureReady(s){if(!current(s))return false;if(s.busy||s.fileReading){message(s,'Espera la confirmación de la operación antes de continuar.');return false;}if(s.coverController&&!s.coverController.ready())return false;return true;}
  function lockForm(form,locked){if(locked){form.__cveDisabled=[...form.querySelectorAll('button,input,textarea,select')].map(function(el){var state=[el,el.disabled];el.disabled=true;return state;});}else{(form.__cveDisabled||[]).forEach(function(state){state[0].disabled=state[1];});delete form.__cveDisabled;}}
  function renderPreview(s){return s.options.renderProfile(previewProfile(s));}
  function clear(restore){var s=active;if(!s)return;active=null;serial++;if(restore&&s.root.isConnected&&window.UserState?.uid===s.uid&&!window.__sessionEnding)s.options.onClose?.(s.profile);s.profile=null;s.drafts={};s.saved={};s.coverController=null;}
  function back(s){if(current(s)&&requestLeave())clear(true);}
  function mergeCover(s){
    if(!s.coverController||!s.drafts.apariencia)return;
    var patch=s.coverController.payload(),data=s.drafts.apariencia.data;
    if(patch.coverDataUrl)delete data.removeCover;if(patch.removeCover)delete data.coverDataUrl;
    if(patch.resetCoverColor)delete data.portadaColor;if(patch.portadaColor)delete data.resetCoverColor;
    Object.assign(data,patch);
  }
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
    else if(kind==='textarea'||kind==='tags')control='<textarea id="'+id+'" name="'+name+'" rows="3" '+(kind==='tags'?'aria-describedby="'+id+'-help"':'maxlength="'+field[3]+'"')+'>'+esc(kind==='tags'?(Array.isArray(value)?value.join('\n'):''):value||'')+'</textarea>'+(kind==='tags'?'<small class="cve-help" id="'+id+'-help">Hasta 40 elementos, máximo 60 caracteres por línea.</small>':'');
    else control='<input id="'+id+'" name="'+name+'" type="'+kind+'" '+(field[3]?'maxlength="'+field[3]+'"':'')+' '+(kind==='url'?'placeholder="https://…"':'')+' value="'+esc(value||'')+'">';
    return '<label class="cve-field'+(['textarea','tags'].includes(kind)?' cve-field--wide':'')+'" for="'+id+'"><span>'+label+'</span>'+control+'</label>';
  }
  function collect(form,key,s){
    var config=sections[key],data;
    function rowData(root,previous){var row={...(previous||{})};config.fields.forEach(function(f){var el=root.querySelector('[name="'+f[0]+'"]');row[f[0]]=f[2]==='checkbox'?el.checked:f[2]==='tags'?skillLines(el.value):el.value;});if(row.actual)row.fin='';if(key==='idiomas'){var choice=root.querySelector('[name="languageChoice"]').value;if(choice!=='__other')row.idioma=choice;}return row;}
    if(key==='apariencia'){mergeCover(s);return s.drafts[key];}
    if(config.kind==='list')data=[...form.querySelectorAll('[data-cve-row]')].map(function(root,i){return rowData(root,s.drafts[key].data[i]);});
    else if(config.kind==='object'||config.kind==='shared')data=rowData(form,s.drafts[key].data);
    else data={...s.drafts[key].data,color:String(form.querySelector('[data-cve-color]')?.value||s.drafts[key].data.color).toLowerCase()};
    if(key==='contactos')data.contactScopes=Object.fromEntries(Object.keys(channels).map(function(channel){return [channel,form.querySelector('[name="scope-'+channel+'"]').value];}));
    s.drafts[key].data=data;if(key!=='estilo'&&!shared(key))s.drafts[key].visibility=form.querySelector('[name="visibility"]').value;
    return s.drafts[key];
  }
  function optionsMarkup(options,selected,placeholder){var all=options.slice();if(selected&&!all.some(function(option){return option.value===selected;}))all.unshift({value:selected,label:selected+' · revisa el valor anterior'});return '<option value="">'+esc(placeholder||'Selecciona…')+'</option>'+all.map(function(option){return '<option value="'+esc(option.value)+'" '+(selected===option.value?'selected':'')+'>'+esc(option.label)+'</option>';}).join('');}
  function languageFields(s,row,index){
    var rules=languageRules(),known=rules.catalog.some(function(group){return group.languages.includes(row.idioma);}),manual=s.languageOther?.[row.id]===true||!known&&!!row.idioma,selected=manual?'__other':row.idioma||'',prefix='cve-idiomas-'+index+'-',systemOptions=rules.systems(row.idioma),levelOptions=rules.levels(row.sistema),warning=rules.review(row),certification=row.acreditacion==='certificacion';
    var choices='<option value="">Selecciona un idioma</option>'+rules.catalog.map(function(group){return '<optgroup label="'+esc(group.label)+'">'+group.languages.map(function(name){return '<option value="'+esc(name)+'" '+(selected===name?'selected':'')+'>'+esc(name)+'</option>';}).join('')+'</optgroup>';}).join('')+'<option value="__other" '+(manual?'selected':'')+'>Otro idioma…</option>';
    var accreditation=[{value:'estimado',label:'Nivel estimado por mí'},{value:'en_curso',label:'Formación en curso'},{value:'evaluacion',label:'Evaluación realizada'},{value:'certificacion',label:'Certificación oficial'}];
    return '<label class="cve-field" for="'+prefix+'choice"><span>Idioma</span><select id="'+prefix+'choice" name="languageChoice" data-cve-language-choice>'+choices+'</select></label>'+ (manual?fieldMarkup(['idioma','Nombre del idioma','text',80],row,index,'idiomas'):'<input type="hidden" name="idioma" value="'+esc(row.idioma||'')+'">')+
      '<label class="cve-field" for="'+prefix+'sistema"><span>Sistema de evaluación</span><select id="'+prefix+'sistema" name="sistema" data-cve-language-system>'+optionsMarkup(systemOptions,row.sistema,'Selecciona un sistema')+'</select></label>'+ (levelOptions.length?'<label class="cve-field" for="'+prefix+'nivel"><span>Nivel</span><select id="'+prefix+'nivel" name="nivel">'+optionsMarkup(levelOptions.map(function(level){return {value:level,label:level};}),row.nivel,'Selecciona un nivel')+'</select></label>':'<input type="hidden" name="nivel" value="'+esc(row.nivel||'')+'"><p class="cve-language-state">'+esc(row.sistema==='nativo'?'Nivel nativo':row.sistema==='sin_evaluacion'?'Sin evaluación formal':'Elige un sistema para registrar el nivel.')+'</p>')+
      '<label class="cve-field" for="'+prefix+'acreditacion"><span>¿Cómo acreditas tu nivel? · opcional</span><select id="'+prefix+'acreditacion" name="acreditacion" data-cve-language-accreditation>'+optionsMarkup(accreditation,row.acreditacion,'Sin especificar')+'</select></label>'+ (certification?'<div class="cve-language-cert cve-field--wide"><p class="cve-help">Datos opcionales declarados por ti. ICADEM no los presenta como verificados.</p><div class="cve-fields">'+sections.idiomas.fields.slice(4).map(function(field){if(field[0]==='fecha'){field=field.slice();field[2]=/^\d{4}-\d{2}-\d{2}$/.test(row.fecha||'')?'date':'month';}return fieldMarkup(field,row,index,'idiomas');}).join('')+'</div></div>':sections.idiomas.fields.slice(4).map(function(field){return '<input type="hidden" name="'+field[0]+'" value="'+esc(row[field[0]]||'')+'">';}).join(''))+
      '<p class="cve-language-review cve-field--wide" data-cve-language-review role="status" '+(!warning?'hidden':'')+'>'+esc(warning)+'</p>';
  }
  function sectionValidation(s,form,key){
    if(shared(key)){
      var data=s.drafts[key].data,saved=s.saved[key].data;
      if(key==='basicos'){
        var unresolved=(s.profile.editor?.basicos?.conflicts||[]).find(function(conflict){return data[conflict.campo]!==saved[conflict.campo]&&!s.drafts.basicos.resoluciones?.[conflict.campo];});
        if(unresolved)return 'Tienes dos versiones de '+(unresolved.campo==='ubicacion'?'tu ubicación':unresolved.campo)+'. Elige cuál conservar antes de guardar ese campo.';
        if(data.nombre!==saved.nombre&&(!data.nombre.trim()||data.nombre.trim().length<3))return 'Escribe un nombre completo de al menos 3 caracteres.';
      }
      var invalidField=(sections[key].fields||[]).find(function(field){return typeof field[3]==='number'&&String(data[field[0]]||'').length>field[3]&&data[field[0]]!==saved[field[0]];});
      if(invalidField)return invalidField[1]+': el máximo es de '+invalidField[3]+' caracteres. Tu texto se conserva para corregirlo.';
      return '';
    }
    if(key==='idiomas'){var invalid=s.drafts.idiomas.data.map(function(row,index){var warning=languageRules().review(row);return warning?'Idioma '+(index+1)+': '+warning:'';}).find(Boolean);if(invalid)return invalid;}
    if(key==='habilidades'){
      var invalidMessage='';sections.habilidades.fields.some(function(field){var raw=form.querySelector('[name="'+field[0]+'"]'),lines=String(raw.value||'').split(/\r\n|[\n\r\u2028\u2029]/),label=field[1].split(' · ')[0],bad=lines.findIndex(function(line){return line.trim().length>60;});if(bad>=0){invalidMessage=label+': la línea '+(bad+1)+' supera el máximo de 60 caracteres por habilidad.';raw.setAttribute('aria-invalid','true');return true;}if(skillLines(raw.value).length>40){invalidMessage=label+': agrega como máximo 40 habilidades, una por línea.';raw.setAttribute('aria-invalid','true');return true;}raw.removeAttribute('aria-invalid');return false;});return invalidMessage;
    }
    return '';
  }
  function conflictMarkup(s){return (s.profile.editor?.basicos?.conflicts||[]).map(function(conflict){var key=conflict.campo,label={profesion:'Profesión',especialidad:'Especialidad',ubicacion:'Ubicación'}[key]||key,choice=s.drafts.basicos.resoluciones?.[key]||'';return '<div class="cve-conflict"><strong>'+esc(label)+' · hay dos versiones guardadas</strong><div class="cve-conflict-versions"><div><small>Tarjeta profesional</small><p>'+esc(conflict.directorio||'Sin dato')+'</p></div><div><small>Currículum</small><p>'+esc(conflict.curriculum||'Sin dato')+'</p></div></div><label class="cve-field"><span>¿Qué versión quieres conservar?</span><select data-cve-resolve="'+esc(key)+'"><option value="">Conservar ambas por ahora</option><option value="directorio" '+(choice==='directorio'?'selected':'')+'>Usar la versión de la tarjeta</option><option value="curriculum" '+(choice==='curriculum'?'selected':'')+'>Usar la versión del currículum</option><option value="manual" '+(choice==='manual'?'selected':'')+'>Escribir una versión en el campo de abajo</option></select></label></div>';}).join('');}
  function sharedMarkup(s,key){
    var data=s.drafts[key].data;
    if(key==='apariencia'){
      var url=data.avatarDataUrl||data.foto||'',safe=url&&(/^(https:\/\/|\/|assets\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(url));
      return '<p class="cve-help">Tu foto se utiliza en tu perfil, el directorio y tus publicaciones. Una foto personalizada se conserva hasta que elijas otra fuente.</p><div class="cve-photo"><div class="cve-photo-preview" data-cve-photo-preview>'+ (safe?'<img src="'+esc(url)+'" alt="Tu foto de perfil" referrerpolicy="no-referrer">':'<span aria-hidden="true">'+esc((s.drafts.basicos.data.nombre||'IC').slice(0,2).toUpperCase())+'</span>')+'</div><div class="cve-photo-actions"><button type="button" class="community-secondary" data-cve-photo-pick>Subir fotografía</button><button type="button" class="community-secondary" data-cve-photo-google>Usar mi foto de Google</button><input type="file" accept="image/jpeg,image/png,image/webp" data-cve-photo-file hidden><p class="cve-help">Subir una foto prepara un borrador. La foto de Google se sincroniza inmediatamente cuando lo confirmas.</p></div></div><div class="cve-google-confirm" data-cve-google-confirm hidden><p>¿Usar tu foto actual de Google en ICADEM? Esta acción se guarda inmediatamente. Los demás cambios de tu perfil se conservarán como borrador.</p><button type="button" class="community-primary" data-cve-google-yes>Confirmar foto de Google</button><button type="button" class="community-secondary" data-cve-google-no>Cancelar</button></div>'+(s.profile.isVip?'<div class="cve-cover">'+(window.ICADEMDirectory?.editorMarkup?.()||'<p class="cve-note">El editor de portada no está disponible. Puedes reintentar al recargar.</p>')+'</div>':'<p class="cve-note">Tu foto está disponible para todas las cuentas. La portada y su color personalizado requieren una membresía VIP activa; tus preferencias anteriores se conservan.</p>');
    }
    var intro=key==='basicos'?'<p class="cve-help">Profesión y cargo son datos distintos. La presentación breve aparece en tu tarjeta; tu resumen completo se edita en «Sobre mí».</p>'+ (data.authEmail?'<label class="cve-field cve-account-email"><span>Correo de acceso · solo lectura</span><input type="email" value="'+esc(data.authEmail)+'" readonly aria-readonly="true"><small class="cve-help">El correo profesional de contacto se administra en la sección siguiente.</small></label>':'')+conflictMarkup(s):'<p class="cve-help">Todos los medios son opcionales. Este correo profesional no cambia el correo con el que inicias sesión. Elige el acceso a cada medio; no se muestra a visitantes sin sesión.</p>';
    var fields='<div class="cve-fields">'+sections[key].fields.map(function(field){var html=fieldMarkup(field,data,0,key);if(key==='contactos'){var scope=data.contactScopes?.[field[0]]||'hidden';html='<div class="cve-contact-item">'+html+'<label class="cve-field"><span>Quién puede verlo</span><select name="scope-'+field[0]+'"><option value="hidden" '+(scope==='hidden'?'selected':'')+'>Solo yo</option><option value="connections" '+(scope==='connections'?'selected':'')+'>Conexiones aceptadas</option><option value="vip" '+(scope==='vip'?'selected':'')+'>VIP y conexiones</option></select></label></div>';}return html;}).join('')+'</div>';
    return intro+fields;
  }
  function bodyMarkup(s,key){
    var config=sections[key],draft=s.drafts[key],rows=draft.data;
    if(shared(key))return sharedMarkup(s,key);
    if(config.kind==='style'){
      var editable=s.profile.cv?.estilo?.editable===true||s.profile.isVip===true,p=palette(s.profile);
      return '<p class="cve-help">El tema del currículum es independiente de la portada de tu tarjeta. Usa el mismo selector de color del Directorio.</p>'+(!editable?'<div class="cve-note">El diseño personalizado requiere una membresía VIP activa. Tu información y tu preferencia guardada se conservan.</div>':'')+'<fieldset class="cve-style-controls" '+(!editable?'disabled':'')+'><legend>Elige el color de tu currículum</legend><div class="cve-swatches">'+p.colors.map(function(x){return '<button type="button" class="cve-swatch" style="--swatch:'+color(x.value)+'" data-cve-swatch="'+color(x.value)+'" aria-label="'+esc(x.label)+'" aria-pressed="'+(draft.data.color.toLowerCase()===x.value.toLowerCase()&&!draft.data.reset)+'"></button>';}).join('')+'<label class="cve-custom-color">Color personalizado<input type="color" data-cve-color aria-label="Color de tu currículum" value="'+color(draft.data.color,p.defaultFree)+'"></label></div><button type="button" class="community-secondary" data-cve-reset>Restablecer predeterminado</button></fieldset><p class="cve-help">Vista previa de tu información pública. Los enlaces siguen sujetos a los permisos de contacto.</p><div class="cve-theme-preview" data-cve-theme-preview>'+renderPreview(s)+'</div>';
    }
    var info=key==='idiomas'?'<p class="cve-help">Elige la escala apropiada para cada idioma. HSK y MCER no se convierten entre sí. No necesitas una certificación para registrar tu nivel.</p>':key==='certificaciones'?'<p class="cve-note">Las certificaciones declaradas no se presentan como verificadas por ICADEM. Sus enlaces respetan tus permisos de contacto.</p>':['enlaces','proyectos'].includes(key)?'<p class="cve-note">Los enlaces respetan la privacidad de contacto del Directorio, además de la visibilidad de esta sección.</p>':'';
    var content=config.kind==='object'?'<div class="cve-fields">'+config.fields.map(function(f){return fieldMarkup(f,rows,0,key);}).join('')+'</div>':'<div class="cve-rows">'+rows.map(function(row,index){return '<fieldset class="cve-row" data-cve-row="'+index+'"><legend>'+esc(config.title)+' · '+(index+1)+'</legend><div class="cve-row-tools"><button type="button" data-cve-move="-1" data-index="'+index+'" aria-label="Subir registro '+(index+1)+'" '+(!index?'disabled':'')+'>↑</button><button type="button" data-cve-move="1" data-index="'+index+'" aria-label="Bajar registro '+(index+1)+'" '+(index===rows.length-1?'disabled':'')+'>↓</button><button type="button" data-cve-remove="'+index+'">Eliminar registro</button></div><div class="cve-fields">'+(key==='idiomas'?languageFields(s,row,index):config.fields.map(function(f){return fieldMarkup(f,row,index,key);}).join(''))+'</div></fieldset>';}).join('')+'</div><button type="button" class="community-secondary" data-cve-add>+ Agregar '+esc(config.singular)+'</button>';
    return info+content+'<label class="cve-visibility">Quién puede ver esta sección<select name="visibility"><option value="public" '+(draft.visibility==='public'?'selected':'')+'>Todos los miembros</option><option value="connections" '+(draft.visibility==='connections'?'selected':'')+'>Conexiones aceptadas</option><option value="private" '+(draft.visibility==='private'?'selected':'')+'>Solo yo</option></select></label>';
  }
  function draw(s,expanded){
    if(!current(s))return;s.preview=false;s.coverController=null;
    s.root.innerHTML='<section class="cve" aria-labelledby="cve-title"><header class="cve-header"><div><span class="cve-eyebrow">TU IDENTIDAD PROFESIONAL EN ICADEM</span><h1 id="cve-title" tabindex="-1">Editar mi perfil profesional</h1><p>Tu tarjeta y tu currículum, en un mismo lugar. Completa lo que quieras compartir y guarda cada sección cuando esté lista.</p></div><div class="cve-header-actions"><button type="button" class="community-secondary" data-cve-preview>Vista previa pública</button><button type="button" class="community-secondary" data-cve-basic>Datos profesionales</button><button type="button" class="community-secondary" data-cve-back>Volver a mi perfil</button></div></header><p class="cve-status" data-cve-status role="status" aria-live="polite"></p><div class="cve-leave" data-cve-leave hidden><p>Tienes cambios sin guardar. Los cambios guardados por sección se conservarán.</p><button type="button" class="community-secondary" data-cve-stay>Seguir editando</button><button type="button" class="community-primary" data-cve-discard>Descartar pendientes y continuar</button></div><div class="cve-sections">'+sectionKeys.map(function(key,index){var section=sections[key];return '<details class="cve-section" data-cve-section="'+key+'" '+(expanded===key?'open':'')+'><summary><span class="cve-section-number" aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span><span class="cve-section-label"><strong>'+section.title+'</strong><small>'+ (section.description|| (key==='estilo'?'Color y vista previa':section.kind==='list'?s.drafts[key].data.length+' registros':'Presentación y detalles'))+'</small></span><span class="cve-section-caret" aria-hidden="true">+</span></summary><form data-cve-form="'+key+'">'+bodyMarkup(s,key)+'<div class="cve-section-actions"><button type="submit" class="community-primary" '+(key==='estilo'&&!s.profile.isVip?'disabled':'')+'>'+(key==='estilo'?'Guardar estilo':'Guardar sección')+'</button><button type="button" class="community-secondary" data-cve-cancel>Cancelar cambios</button><button type="button" class="community-secondary" data-cve-reload hidden>Recargar sección</button></div><p class="cve-section-status" data-cve-section-status role="status" aria-live="polite"></p></form></details>';}).join('')+'</div></section>';
    s.root.querySelector('[data-cve-back]').addEventListener('click',function(){captureAll(s);back(s);});
    s.root.querySelector('[data-cve-preview]').addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);showPreview(s);});
    s.root.querySelector('[data-cve-basic]').addEventListener('click',function(){focusSection('basicos');});
    s.root.querySelector('[data-cve-stay]').addEventListener('click',function(){s.leaveProceed=null;s.root.querySelector('[data-cve-leave]').hidden=true;});
    s.root.querySelector('[data-cve-discard]').addEventListener('click',function(){if(s.busy)return;var proceed=s.leaveProceed;if(proceed){clear(false);proceed();}else clear(true);});
    s.root.querySelectorAll('[data-cve-form]').forEach(function(form){bindForm(s,form,form.dataset.cveForm);});
    bindAppearance(s);
  }
  function captureAll(s){s.root.querySelectorAll('[data-cve-form]').forEach(function(form){collect(form,form.dataset.cveForm,s);});}
  function changedData(s,key){
    var draft=s.drafts[key].data,saved=s.saved[key].data,keys=key==='apariencia'?['avatarDataUrl','removeCustomPhoto','coverDataUrl','removeCover','resetCoverColor','portadaColor']:sections[key].fields.map(function(field){return field[0];}).concat(key==='contactos'?['contactScopes']:[]),out={};
    keys.forEach(function(name){if(Object.hasOwn(draft,name)&&JSON.stringify(draft[name])!==JSON.stringify(saved[name]))out[name]=copy(draft[name]);});
    if(key==='basicos')Object.keys(s.drafts.basicos.resoluciones||{}).forEach(function(field){out[field]=draft[field];});
    return out;
  }
  function bindAppearance(s){
    var form=s.root.querySelector('[data-cve-form="apariencia"]');if(!form)return;
    var draft=s.drafts.apariencia.data,coverRoot=form.querySelector('[data-cover-preview]')?.parentNode;
    if(s.profile.isVip&&coverRoot&&window.ICADEMDirectory?.bindEditor){var data={...draft,portadaUrl:draft.removeCover?'':draft.coverDataUrl||draft.portadaUrl,portadaColor:draft.resetCoverColor?palette(s.profile).defaultVip:draft.portadaColor,portadaColorPersonalizado:draft.resetCoverColor?false:draft.portadaColorPersonalizado};s.coverController=window.ICADEMDirectory.bindEditor(coverRoot,data);}
    var file=form.querySelector('[data-cve-photo-file]');
    form.querySelector('[data-cve-photo-pick]').addEventListener('click',function(){if(!s.busy&&!s.fileReading)file.click();});
    file.addEventListener('change',async function(){
      var selected=file.files?.[0];file.value='';if(!selected||!structureReady(s))return;
      if(!['image/jpeg','image/png','image/webp'].includes(selected.type)){statusForm(form,'Elige una fotografía JPEG, PNG o WebP.',true);return;}
      captureAll(s);s.fileReading=true;lockForm(form,true);statusForm(form,'Preparando tu fotografía…');
      try{if(typeof s.options.preparePhoto!=='function')throw Error('El servicio de fotografías no está disponible. Tu foto anterior se conserva.');var data=await s.options.preparePhoto(selected);if(!current(s))return;if(typeof data!=='string'||!/^data:image\/(?:jpeg|png|webp);base64,/i.test(data))throw Error('No pudimos preparar esa fotografía.');s.drafts.apariencia.data.avatarDataUrl=data;delete s.drafts.apariencia.data.removeCustomPhoto;s.fileReading=false;draw(s,'apariencia');statusForm(s.root.querySelector('[data-cve-form="apariencia"]'),'Fotografía preparada. Guarda la sección para aplicarla.');}
      catch(error){s.fileReading=false;if(current(s)){lockForm(form,false);statusForm(form,error.message||'No pudimos preparar la fotografía.',true);}}
    });
    form.querySelector('[data-cve-photo-google]').addEventListener('click',function(){if(!structureReady(s))return;form.querySelector('[data-cve-google-confirm]').hidden=false;form.querySelector('[data-cve-google-yes]').focus();});
    form.querySelector('[data-cve-google-no]').addEventListener('click',function(){form.querySelector('[data-cve-google-confirm]').hidden=true;form.querySelector('[data-cve-photo-google]').focus();});
    form.querySelector('[data-cve-google-yes]').addEventListener('click',async function(){
      if(!structureReady(s))return;captureAll(s);var cover=changedData(s,'apariencia');delete cover.avatarDataUrl;delete cover.removeCustomPhoto;s.busy=true;lockForm(form,true);statusForm(form,'Confirmando tu foto de Google…');
      try{if(typeof s.options.syncGoogle!=='function')throw Error('La vinculación con Google no está disponible.');var response=await s.options.syncGoogle();if(!current(s))return;var p=response?.profile||response;if(p?.uid!==s.uid||p.own!==true)throw Error('No pudimos confirmar la foto de Google.');s.profile=p;s.photoRevision=(s.photoRevision||0)+1;s.photoSelection={foto:p.foto||'',photoVersion:p.photoVersion||'',photoSource:p.photoSource||'google',fotoOrigen:p.photoSource||'google'};var confirmed=snapshot(p).apariencia;s.saved.apariencia=copy(confirmed);s.drafts.apariencia={...copy(confirmed),data:{...copy(confirmed.data),...cover}};s.busy=false;draw(s,'apariencia');statusForm(s.root.querySelector('[data-cve-form="apariencia"]'),'Foto de Google confirmada. Los demás cambios pendientes se conservan.');s.options.onSaved?.(p,'apariencia');}
      catch(error){s.busy=false;if(current(s)){lockForm(form,false);statusForm(form,error.message||'No pudimos sincronizar la foto. Tu fotografía anterior se conserva.',true);}}
    });
  }
  function bindForm(s,form,key){
    var config=sections[key];
    // A partial profile patch validates only the fields actually submitted.
    // Untouched legacy contact values must never prevent an unrelated edit.
    if(shared(key)){form.noValidate=true;form.setAttribute('novalidate','');}
    form.addEventListener('input',function(event){if(current(s)){collect(form,key,s);if(key==='habilidades'){var invalid=sectionValidation(s,form,key);statusForm(form,invalid,!!invalid);}if(key==='idiomas')form.querySelectorAll('[data-cve-row]').forEach(function(row,index){var targetName=event.target?.name;if(['idioma','languageChoice','sistema','nivel'].includes(targetName)&&event.target===row.querySelector('[name="'+targetName+'"]'))delete s.drafts.idiomas.data[index].requiereRevision;var warning=languageRules().review(s.drafts.idiomas.data[index]),note=row.querySelector('[data-cve-language-review]');note.textContent=warning;note.hidden=!warning;});if(key==='estilo'){s.drafts[key].data.reset=false;form.querySelector('[data-cve-theme-preview]').innerHTML=renderPreview(s);form.querySelectorAll('[data-cve-swatch]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.cveSwatch.toLowerCase()===s.drafts[key].data.color.toLowerCase()));});}}});
    if(key==='idiomas')form.querySelectorAll('[data-cve-row]').forEach(function(row,index){
      function update(event){if(!structureReady(s))return;var choice=row.querySelector('[name="languageChoice"]'),id=s.drafts.idiomas.data[index].id;captureAll(s);if(['idioma','languageChoice','sistema','nivel'].includes(event.target?.name))delete s.drafts.idiomas.data[index].requiereRevision;if(event.target===choice){s.languageOther=s.languageOther||{};s.languageOther[id]=choice.value==='__other';}draw(s,'idiomas');}
      ['[data-cve-language-choice]','[data-cve-language-system]','[data-cve-language-accreditation]','[name="idioma"]'].forEach(function(selector){var control=row.querySelector(selector);if(control&&(control.getAttribute?control.getAttribute('type'):control.attributes?.type)!=='hidden')control.addEventListener('change',update);});
    });
    if(key==='basicos')form.querySelectorAll('[data-cve-resolve]').forEach(function(control){control.addEventListener('change',function(){if(!structureReady(s))return;captureAll(s);var field=control.dataset.cveResolve,choice=control.value,conflict=s.profile.editor.basicos.conflicts.find(function(item){return item.campo===field;});if(choice)s.drafts.basicos.resoluciones[field]=choice;else delete s.drafts.basicos.resoluciones[field];if(choice==='directorio'||choice==='curriculum'){s.drafts.basicos.data[field]=conflict[choice]||'';form.querySelector('[name="'+field+'"]').value=s.drafts.basicos.data[field];}statusForm(form,choice?'La versión elegida se aplicará cuando guardes esta sección.':'Las dos versiones anteriores se conservarán hasta que elijas una.');});});
    form.querySelector('[data-cve-cancel]').addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key]=copy(s.saved[key]);draw(s,key);});
    form.querySelector('[data-cve-reload]').addEventListener('click',async function(){await reloadSection(s,key);});
    form.querySelector('[data-cve-add]')?.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);if(s.drafts[key].data.length>=10){statusForm(form,'Puedes registrar hasta 10 elementos en esta sección.',true);return;}s.drafts[key].data.push({id:window.crypto?.randomUUID?.()||'cv-'+Date.now()+'-'+Math.random().toString(36).slice(2)});draw(s,key);});
    form.querySelectorAll('[data-cve-remove]').forEach(function(button){button.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key].data.splice(Number(button.dataset.cveRemove),1);draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Registro retirado de tu borrador. Guarda la sección para confirmar.');});});
    form.querySelectorAll('[data-cve-move]').forEach(function(button){button.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);var rows=s.drafts[key].data,i=Number(button.dataset.index),next=i+Number(button.dataset.cveMove);if(next<0||next>=rows.length)return;[rows[i],rows[next]]=[rows[next],rows[i]];draw(s,key);});});
    form.querySelectorAll('[data-cve-swatch]').forEach(function(button){button.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key].data={color:button.dataset.cveSwatch,reset:false};draw(s,key);});});
    form.querySelector('[data-cve-reset]')?.addEventListener('click',function(){if(!structureReady(s))return;captureAll(s);s.drafts[key].data={color:palette(s.profile).defaultFree,reset:true};draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Vista previa predeterminada. Pulsa Guardar estilo para confirmar.');});
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(!current(s)||s.busy||s.fileReading)return;if(s.coverController&&!s.coverController.ready())return;if(!shared(key)&&form.reportValidity&&!form.reportValidity())return;
      captureAll(s);var validation=sectionValidation(s,form,key);if(validation){statusForm(form,validation,true);return;}var photoTicket=s.photoRevision||0,draft=s.drafts[key],payload={section:key,revision:s.saved[key].revision,data:copy(draft.data)};if(key!=='estilo'&&!shared(key))payload.visibility=draft.visibility;
      if(shared(key)){payload.data=changedData(s,key);if(key==='basicos'&&Object.keys(draft.resoluciones||{}).length)payload.resoluciones=copy(draft.resoluciones);}
      if(key==='idiomas')payload.data=payload.data.map(function(row){if(row.sistema==='nativo')row.nivel='Nativo';if(row.sistema==='sin_evaluacion')row.nivel='';return row;});
      s.busy=true;lockForm(form,true);statusForm(form,'Guardando…');
      try{var save=shared(key)?s.options.saveShared:s.options.save;if(typeof save!=='function')throw Error('El servicio de esta sección no está disponible. Tu borrador se conserva.');var response=await save(payload);if(!current(s))return;if(!response?.profile||response.profile.uid!==s.uid||response.profile.own!==true)throw Error('No se pudo confirmar el perfil.');s.profile=photoConfirmedAfter(s,response.profile,photoTicket);var confirmed=snapshot(response.profile)[key];s.saved[key]=copy(confirmed);s.drafts[key]=copy(confirmed);s.busy=false;draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Cambios guardados y confirmados por el servidor.');s.options.onSaved?.(response.profile,key);}
      catch(error){s.busy=false;if(!current(s))return;lockForm(form,false);statusForm(form,error.status===409?'Esta sección cambió en otra sesión. Recarga la sección antes de volver a guardar.':error.message||'No pudimos guardar. Tu borrador se conserva.',true);if(error.status===409)form.querySelector('[data-cve-reload]').hidden=false;}
    });
  }
  async function reloadSection(s,key){if(!current(s)||s.busy)return;captureAll(s);var photoTicket=s.photoRevision||0,form=s.root.querySelector('[data-cve-form="'+key+'"]');s.busy=true;lockForm(form,true);try{var response=await s.options.load();if(!current(s))return;if(!response?.profile||response.profile.uid!==s.uid||response.profile.own!==true)throw Error('No se pudo confirmar el perfil.');s.profile=photoConfirmedAfter(s,response.profile,photoTicket);var next=snapshot(response.profile)[key];s.saved[key]=copy(next);s.drafts[key]=copy(next);s.busy=false;draw(s,key);statusForm(s.root.querySelector('[data-cve-form="'+key+'"]'),'Sección actualizada desde el servidor.');}catch(error){s.busy=false;if(current(s)){lockForm(form,false);message(s,error.message||'No pudimos actualizar la sección.',true);}}}
  function showPreview(s){s.preview=true;s.root.innerHTML='<section class="cve-preview"><header class="cve-preview-heading"><div><h1 tabindex="-1">Vista previa pública</h1><p>Incluye tu borrador. Los cambios todavía no guardados no están publicados. Se ocultan contactos y enlaces protegidos.</p></div><button type="button" class="community-primary" data-cve-return>Volver al editor</button></header>'+renderPreview(s)+'</section>';s.root.querySelector('[data-cve-return]').addEventListener('click',function(){draw(s);});s.root.querySelector('h1')?.focus();}
  async function open(options){
    clear(false);var root=options.container,uid=window.UserState?.uid;if(!root||!uid||options.profile?.uid!==uid||options.profile.own!==true||window.__sessionEnding)return;
    var s={root,uid,options,profile:options.profile,drafts:{},saved:{},busy:true,id:++serial,photoRevision:0};active=s;
    root.innerHTML='<div class="professional-profile-loading" role="status">Cargando tu perfil profesional…</div>';
    try{var response=await options.load();if(!current(s))return;if(!response?.profile||response.profile.uid!==uid||response.profile.own!==true)throw Error('No se pudo confirmar tu perfil.');s.profile=photoConfirmedAfter(s,response.profile,0);s.saved=snapshot(response.profile);s.drafts=copy(s.saved);s.busy=false;draw(s,sectionKeys.includes(options.section)?options.section:'basicos');root.querySelector('h1')?.focus({preventScroll:true});}
    catch(error){if(current(s)){root.innerHTML='<div class="professional-profile-loading" role="alert"><p>'+esc(error.message||'No pudimos cargar tu perfil profesional.')+'</p><button type="button" class="community-secondary" data-cve-retry>Reintentar</button><button type="button" class="community-secondary" data-cve-close>Volver al perfil</button></div>';root.querySelector('[data-cve-retry]').addEventListener('click',function(){open(options);});root.querySelector('[data-cve-close]').addEventListener('click',function(){clear(true);});}}
  }
  ['icadem:session-ending','icadem:session-ended'].forEach(function(event){document.addEventListener(event,function(){if(active){active.root.replaceChildren();clear(false);}});});
  document.addEventListener('icadem:user-ready',function(){if(active&&active.uid!==window.UserState?.uid){active.root.replaceChildren();clear(false);}});
  window.addEventListener('icadem:navigation',function(){if(active&&(location.hash!=='#directorio-perfil'||window.ICADEMProfessionalNavigation?.currentProfileId?.()!==active.uid))clear(false);});
  window.addEventListener('beforeunload',function(event){if(active){captureAll(active);if(isDirty(active)){event.preventDefault();event.returnValue='';}}});
  function syncPhoto(profile){
    var s=active;
    if(!s||!current(s)||profile?.uid!==s.uid||typeof profile.photoURL!=='string'||!s.profile)return;
    s.photoRevision=(s.photoRevision||0)+1;s.photoSelection={foto:profile.photoURL,photoVersion:profile.photoVersion||'',photoSource:profile.photoSource||'default',fotoOrigen:profile.photoSource||'default'};Object.assign(s.profile,s.photoSelection);
    [s.saved.apariencia,s.drafts.apariencia].forEach(function(item){if(item)Object.assign(item.data,{foto:profile.photoURL,photoVersion:profile.photoVersion||'',fotoOrigen:profile.photoSource||'default'});});
  }
  function focusSection(key){var s=active;if(!s||!sectionKeys.includes(key)||!structureReady(s))return false;if(s.preview)draw(s,key);else captureAll(s);s.root.querySelectorAll('[data-cve-section]').forEach(function(section){if(section.dataset.cveSection===key){section.open=true;section.querySelector('summary')?.focus();section.scrollIntoView?.({block:'start',behavior:'smooth'});}});return true;}
  function requestLeave(proceed){var s=active;if(!s||!current(s))return true;if(!s.preview)captureAll(s);if(s.busy||s.fileReading){message(s,'Espera la confirmación de la operación antes de salir.');return false;}if(!isDirty(s)&&(!s.coverController||s.coverController.ready()))return true;if(s.preview)draw(s);s.leaveProceed=typeof proceed==='function'?proceed:null;var box=s.root.querySelector('[data-cve-leave]');box.hidden=false;box.querySelector('button')?.focus();return false;}
  window.ICADEMResumeEditor={open:open,syncPhoto:syncPhoto,focusSection:focusSection,requestLeave:requestLeave,isBusy:function(){return !!active&&(active.busy||active.fileReading);},isOpen:function(root){return !!active&&current(active)&&(!root||active.root===root||root.contains?.(active.root));},isDirty:function(){if(active&&!active.preview)captureAll(active);return isDirty(active);}};
})();
