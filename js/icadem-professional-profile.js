/* Read-only profile presentation. Identity, cover permissions and contacts come
   from the existing professional network API and directory appearance helper. */
(function () {
  'use strict';

  function markup(profile, helpers) {
    var p = profile || {}, h = helpers, e = h.esc, icon = h.icon;
    var cv = p.cv || {}, appearance = window.ICADEMDirectory.appearance(p, p.isVip);
    var name = String(p.nombre || 'Miembro ICADEM');
    var profession = Object.hasOwn(p,'profesion')?p.profesion:cv.profesion||p.puesto||'';
    var specialty = Object.hasOwn(p,'especialidad')?p.especialidad:cv.especialidad||p.sector||'';
    var place = Object.hasOwn(p,'ubicacion')?p.ubicacion:cv.ciudad||'';
    // A projected CV can deliberately omit private sections. Do not repopulate
    // them from a cached directory biography.
    var summary = cv.resumen || (!p.cv ? p.bio : '') || '';
    var image = appearance.image && h.safeUrl(appearance.image);
    var photo = p.foto && h.safeUrl(p.foto);
    if(photo && window.__avatarSrc) photo=window.__avatarSrc(photo,p.photoVersion);
    var color = /^#[0-9a-f]{6}$/i.test(appearance.color || '') ? appearance.color : p.isVip ? '#E9BC43' : '#244B64';
    var accent = /^#[0-9a-f]{6}$/i.test(cv.estilo?.color || '') ? cv.estilo.color : '#244B64';
    var hasResume=summary||cv.presentacion||cv.objetivo||['experiencia','formacion','idiomas','habilidades','habilidadesTecnicas','herramientas','competencias','certificaciones','proyectos','enlaces'].some(function(key){return cv[key]?.length;});
    var activity = '<button type="button" class="community-primary pp-activity" data-profile-activity data-uid="'+e(p.uid)+'">'+icon('messages')+(p.own?'Ver mi actividad':'Ver actividad')+'</button>';
    var actions = p.preview ? '' : p.own
      ? activity+'<button type="button" class="community-secondary" data-edit-cv>' + icon('edit') + 'Editar mi perfil profesional</button><button type="button" class="community-secondary" data-edit-card>Foto y portada</button>'
      : p.connection === 'received'
        ? '<span class="community-state">' + icon('users') + 'Solicitud recibida</span>'+activity+'<button type="button" class="community-secondary" data-network-action="accept" data-uid="' + e(p.uid) + '">' + icon('check') + 'Aceptar</button><button type="button" class="community-secondary" data-network-action="reject" data-uid="' + e(p.uid) + '">Rechazar</button>'
        : p.connection === 'connected'
          ? '<span class="community-state pp-connected">'+icon('check')+'Conectados</span>'+activity+'<button type="button" class="community-secondary" data-network-action="remove" data-uid="'+e(p.uid)+'">'+icon('users')+'Desconectar</button>'
          : p.connection === 'sent'
            ? '<span class="community-state">Solicitud pendiente</span>'+activity+'<button type="button" class="community-secondary" data-network-action="cancel" data-uid="'+e(p.uid)+'">Cancelar solicitud</button>'
            : (p.connection==='none'?h.actionMarkup(p.uid,p.connection,false):'')+activity;
    var experience = (Array.isArray(cv.experiencia) ? cv.experiencia : []).filter(function (x) {
      return x && [x.cargo, x.empresa, x.periodo, x.descripcion].some(Boolean);
    });
    var education = (Array.isArray(cv.formacion) ? cv.formacion : []).filter(function (x) {
      return x && [x.titulo, x.institucion, x.periodo].some(Boolean);
    });
    var skills = (Array.isArray(cv.habilidades) ? cv.habilidades : []).filter(Boolean);
    var contacts = h.contactMarkup(p.contacts || {});
    var info = [
      ['Profesión', profession], ['Cargo', p.puesto && p.puesto !== profession ? p.puesto : ''],
      ['Especialidad', specialty], ['Empresa', p.empresa], ['Sector', p.sector && p.sector !== specialty ? p.sector : ''], ['Ubicación', place]
    ].filter(function (row) { return row[1]; });
    function section(key, title, symbol, content, extra) {
      return '<section class="pp-section ' + (extra || '') + '" data-profile-section="' + key + '"><header class="pp-section-heading"><span class="pp-section-icon" aria-hidden="true">' + icon(symbol) + '</span><h2>' + title + '</h2></header>' + content + '</section>';
    }
    function month(value){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value||''))return '';return ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][Number(value.slice(5))-1]+' '+value.slice(0,4);}
    function period(row){var start=month(row.inicio),end=row.actual?'Actualidad':month(row.fin);return start||end?[start,end].filter(Boolean).join(' — '):row.periodo||'';}
    function external(url,label){var safe=h.safeUrl(url);return safe&&/^https:\/\//i.test(safe)?'<a class="pp-external" href="'+e(safe)+'" target="_blank" rel="noopener noreferrer">'+e(label||'Ver enlace')+icon('arrow-up-right')+'</a>':'';}
    function tagList(values,label){return values.length?'<div class="pp-skill-group"><h3>'+e(label)+'</h3><ul class="pp-skills">'+values.map(function(value){return '<li>'+e(value)+'</li>';}).join('')+'</ul></div>':'';}
    function languageMarkup(row){
      var description=window.ICADEMCVLanguages?.describe(row)||{label:String(row.nivel||''),accreditation:'',review:false};
      var details=[];
      // These details are declarations from the professional, not a verification
      // badge. The API has already applied the privacy of the entire section.
      if(row.acreditacion==='certificacion'){
        if(row.organismo)details.push(['Organismo indicado',row.organismo]);
        if(row.fecha)details.push(['Fecha indicada',row.fecha.length===7?month(row.fecha):row.fecha]);
        if(row.resultado)details.push(['Resultado declarado',row.resultado]);
      }
      return '<li class="pp-language"><div class="pp-language-content"><div class="pp-language-title"><strong>'+e(row.idioma)+'</strong><span class="pp-language-level">'+e(description.label)+'</span></div>'+
        (description.accreditation?'<p class="pp-language-note">'+e(description.accreditation)+'</p>':'')+
        (details.length?'<dl class="pp-language-details">'+details.map(function(pair){return '<div><dt>'+e(pair[0])+'</dt><dd>'+e(pair[1])+'</dd></div>';}).join('')+'</dl>':'')+
        (row.acreditacion==='certificacion'?'<p class="pp-language-note">Información declarada por el profesional, sin verificación de ICADEM.</p>':'')+
        (p.own&&description.review?'<p class="pp-language-review">Revisa este nivel en el editor antes de confirmar cambios.</p>':'')+'</div></li>';
    }
    var main = '';
    if (summary||cv.presentacion||cv.objetivo) main += section('about', 'Sobre mí', 'user', (summary?'<p class="pp-copy">' + e(summary) + '</p>':'')+(cv.presentacion?'<div class="pp-copy-block"><h3>Presentación</h3><p class="pp-copy">'+e(cv.presentacion)+'</p></div>':'')+(cv.objetivo?'<div class="pp-copy-block"><h3>Objetivo profesional</h3><p class="pp-copy">'+e(cv.objetivo)+'</p></div>':''));
    if (experience.length) main += section('experience', 'Trayectoria profesional', 'briefcase', '<div class="pp-timeline">' + experience.map(function (x) {
      return '<article class="pp-timeline-item"><span class="pp-timeline-marker" aria-hidden="true"></span><div>' + (period(x) ? '<span class="pp-period">' + e(period(x)) + '</span>' : '') +
        (x.cargo ? '<h3>' + e(x.cargo) + '</h3>' : '') + (x.empresa ? '<p class="pp-organization">' + e(x.empresa) + '</p>' : '') +
        (x.descripcion ? '<p class="pp-copy">' + e(x.descripcion) + '</p>' : '') + (x.logros?'<div class="pp-copy-block"><h3>Logros</h3><p class="pp-copy">'+e(x.logros)+'</p></div>':'') + '</div></article>';
    }).join('') + '</div>');
    var groups=tagList(Array.isArray(cv.habilidadesTecnicas)?cv.habilidadesTecnicas:skills,'Habilidades técnicas')+tagList(cv.herramientas||[],'Herramientas y software')+tagList(cv.competencias||[],'Competencias profesionales');
    if (cv.areas || groups) main += section('specialties', 'Especialidades y habilidades', 'tools', (cv.areas ? '<p class="pp-copy">' + e(cv.areas) + '</p>' : '')+groups);
    if (education.length) main += section('education', 'Formación académica', 'certificate', '<div class="pp-education-list">' + education.map(function (x) {
      return '<article class="pp-education-item"><span class="pp-education-icon" aria-hidden="true">' + icon('book') + '</span><div>' + (x.titulo ? '<h3>' + e(x.titulo) + '</h3>' : '') +
        (x.institucion ? '<p class="pp-organization">' + e(x.institucion) + '</p>' : '') + (x.area?'<p class="pp-copy">'+e(x.area)+'</p>':'') + (period(x) ? '<span class="pp-period">' + e(period(x)) + '</span>' : '') + (x.estado?'<p class="pp-period">'+e(x.estado)+'</p>':'') + (x.descripcion?'<p class="pp-copy">'+e(x.descripcion)+'</p>':'') + '</div></article>';
    }).join('') + '</div><p class="pp-fine">Información proporcionada por el profesional.</p>');
    if(cv.idiomas?.length)main+=section('languages','Idiomas','book','<ul class="pp-languages">'+cv.idiomas.map(languageMarkup).join('')+'</ul>');
    if(cv.certificaciones?.length)main+=section('certifications','Certificaciones','certificate','<div class="pp-records">'+cv.certificaciones.map(function(x){return '<article><h3>'+e(x.nombre)+'</h3>'+(x.institucion?'<p class="pp-organization">'+e(x.institucion)+'</p>':'')+(x.fecha?'<span class="pp-period">'+e(month(x.fecha))+'</span>':'')+(x.identificador?'<p class="pp-copy">Identificador: '+e(x.identificador)+'</p>':'')+external(x.url,'Consultar certificación')+'</article>';}).join('')+'</div><p class="pp-fine">Certificaciones declaradas por el profesional. No implican verificación de ICADEM.</p>');
    if(cv.proyectos?.length)main+=section('projects','Proyectos destacados','briefcase','<div class="pp-records">'+cv.proyectos.map(function(x){return '<article><h3>'+e(x.nombre)+'</h3>'+(period(x)?'<span class="pp-period">'+e(period(x))+'</span>':'')+(x.descripcion?'<p class="pp-copy">'+e(x.descripcion)+'</p>':'')+(x.participacion?'<div class="pp-copy-block"><h3>Participación</h3><p class="pp-copy">'+e(x.participacion)+'</p></div>':'')+external(x.url,'Ver proyecto')+'</article>';}).join('')+'</div>');

    var aside = '';
    if (info.length) aside += section('information', 'Información profesional', 'briefcase', '<dl class="pp-information">' + info.map(function (x) {
      return '<div><dt>' + x[0] + '</dt><dd>' + e(x[1]) + '</dd></div>';
    }).join('') + '</dl>');
    aside += section('presence', 'Presencia en ICADEM', 'users', '<div class="pp-presence"><span class="pp-presence-icon" aria-hidden="true">' + icon(p.isVip ? 'crown' : 'users') + '</span><div><strong>' +
      (p.isVip ? 'Membresía VIP activa' : 'Miembro de la comunidad') + '</strong><p>' + (p.perfilCompleto ? 'Tarjeta profesional completa' : 'Perfil en el Directorio Profesional') + '</p></div></div>');
    if (contacts) aside += section('contact', 'Contacto profesional', 'link', '<p class="pp-contact-note">Medios compartidos contigo por este profesional.</p><div class="pp-contacts">' + contacts + '</div>');
    var links=(cv.enlaces||[]).map(function(x){return external(x.url,x.nombre||x.canal||'Enlace profesional');}).filter(Boolean);
    if(links.length)aside+=section('links','Enlaces profesionales','link','<div class="pp-links">'+links.join('')+'</div>');

    return '<article class="professional-profile-page ' + (p.isVip ? 'pp-is-vip' : 'pp-is-community') + '" style="--pp-accent:'+accent+'" aria-labelledby="professional-profile-name">' +
      '<header class="pp-hero"><div class="pp-cover" style="--pp-cover:' + color + '">' + (image ? '<img class="pp-cover-image" src="' + e(image) + '" alt="" decoding="async">' : '') +
      '<span class="pp-membership">' + icon(p.isVip ? 'crown' : 'users') + (p.isVip ? 'Profesional VIP' : 'Comunidad ICADEM') + '</span></div>' +
      '<div class="pp-identity"><div class="pp-avatar">' + (photo ? '<img src="' + e(photo) + '" alt="Foto de ' + e(name) + '" decoding="async">' : '<span aria-hidden="true">' + e(p.iniciales || name.slice(0, 2).toUpperCase()) + '</span>') + '</div>' +
      '<div class="pp-identity-copy"><span class="pp-eyebrow">PERFIL PROFESIONAL</span><h1 id="professional-profile-name" tabindex="-1">' + e(name) + '</h1>' + (profession ? '<p class="pp-profession">' + e(profession) + '</p>' : '') +
      ((p.empresa || place) ? '<div class="pp-meta">' + (p.empresa ? '<span>' + icon('briefcase') + e(p.empresa) + '</span>' : '') + (place ? '<span>' + icon('home') + e(place) + '</span>' : '') + '</div>' : '') + '</div></div>' +
      (p.preview?'':'<div class="pp-network-slot" data-profile-network-slot hidden></div>')+
      '<div class="pp-hero-footer">'+(actions?'<div class="pp-actions" aria-label="Acciones del perfil">' + actions + '</div>':'') + (p.preview?'<p class="pp-privacy-note">'+icon('shield-check')+'Vista previa del borrador público. Contactos protegidos ocultos.</p>':p.own ? '<p class="pp-privacy-note">' + icon('shield-check') + 'Tus contactos se comparten según tus preferencias de privacidad.</p>' : !contacts ? '<p class="pp-privacy-note">' + icon('shield-check') + 'Contactos sujetos a tus permisos y a la privacidad del profesional.</p>' : '') + '</div></header>' +
      '<div class="pp-layout ' + (!main ? 'pp-layout--compact' : '') + '">' + (main ? '<div class="pp-main">' + main + '</div>' : '') + '<aside class="pp-sidebar" aria-label="Información y contactos">' + aside + '</aside></div></article>';
  }

  window.ICADEMProfessionalProfile = { markup: markup };
})();
