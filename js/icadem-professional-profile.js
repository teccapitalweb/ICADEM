/* Read-only profile presentation. Identity, cover permissions and contacts come
   from the existing professional network API and directory appearance helper. */
(function () {
  'use strict';

  function markup(profile, helpers) {
    var p = profile || {}, h = helpers, e = h.esc, icon = h.icon;
    var cv = p.cv || {}, appearance = window.ICADEMDirectory.appearance(p, p.isVip);
    var name = String(p.nombre || 'Miembro ICADEM');
    var profession = cv.profesion || p.profesion || p.puesto || '';
    var specialty = cv.especialidad || p.especialidad || p.sector || '';
    var place = cv.ciudad || p.ubicacion || '';
    var summary = cv.resumen || p.bio || '';
    var image = appearance.image && h.safeUrl(appearance.image);
    var photo = p.foto && h.safeUrl(p.foto);
    var color = /^#[0-9a-f]{6}$/i.test(appearance.color || '') ? appearance.color : p.isVip ? '#E9BC43' : '#244B64';
    var actions = p.own
      ? '<button type="button" class="community-primary" data-edit-cv>' + icon('edit') + 'Editar mi perfil</button><button type="button" class="community-secondary" data-edit-card>Foto y tarjeta</button>'
      : p.connection === 'received'
        ? '<span class="community-state">' + icon('users') + 'Solicitud recibida</span><button type="button" class="community-primary" data-network-action="accept" data-uid="' + e(p.uid) + '">' + icon('check') + 'Aceptar</button><button type="button" class="community-secondary" data-network-action="reject" data-uid="' + e(p.uid) + '">Rechazar</button>'
        : h.actionMarkup(p.uid, p.connection, false) + (p.connection === 'sent'
          ? '<button type="button" class="community-secondary" data-network-action="cancel" data-uid="' + e(p.uid) + '">Cancelar solicitud</button>'
          : p.connection === 'connected'
            ? '<button type="button" class="community-secondary" data-network-action="remove" data-uid="' + e(p.uid) + '">Desconectar</button>'
            : '');
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
    var main = '';
    if (summary) main += section('about', 'Sobre mí', 'user', '<p class="pp-copy">' + e(summary) + '</p>');
    if (experience.length) main += section('experience', 'Trayectoria profesional', 'briefcase', '<div class="pp-timeline">' + experience.map(function (x) {
      return '<article class="pp-timeline-item"><span class="pp-timeline-marker" aria-hidden="true"></span><div>' + (x.periodo ? '<span class="pp-period">' + e(x.periodo) + '</span>' : '') +
        (x.cargo ? '<h3>' + e(x.cargo) + '</h3>' : '') + (x.empresa ? '<p class="pp-organization">' + e(x.empresa) + '</p>' : '') +
        (x.descripcion ? '<p class="pp-copy">' + e(x.descripcion) + '</p>' : '') + '</div></article>';
    }).join('') + '</div>');
    if (cv.areas || skills.length) main += section('specialties', 'Especialidades y habilidades', 'tools', (cv.areas ? '<p class="pp-copy">' + e(cv.areas) + '</p>' : '') +
      (skills.length ? '<ul class="pp-skills" aria-label="Habilidades registradas">' + skills.map(function (value) { return '<li>' + e(value) + '</li>'; }).join('') + '</ul>' : ''));
    if (education.length) main += section('education', 'Formación y certificaciones', 'certificate', '<div class="pp-education-list">' + education.map(function (x) {
      return '<article class="pp-education-item"><span class="pp-education-icon" aria-hidden="true">' + icon('book') + '</span><div>' + (x.titulo ? '<h3>' + e(x.titulo) + '</h3>' : '') +
        (x.institucion ? '<p class="pp-organization">' + e(x.institucion) + '</p>' : '') + (x.periodo ? '<span class="pp-period">' + e(x.periodo) + '</span>' : '') + '</div></article>';
    }).join('') + '</div><p class="pp-fine">Información proporcionada por el profesional.</p>');

    var aside = '';
    if (info.length) aside += section('information', 'Información profesional', 'briefcase', '<dl class="pp-information">' + info.map(function (x) {
      return '<div><dt>' + x[0] + '</dt><dd>' + e(x[1]) + '</dd></div>';
    }).join('') + '</dl>');
    aside += section('presence', 'Presencia en ICADEM', 'users', '<div class="pp-presence"><span class="pp-presence-icon" aria-hidden="true">' + icon(p.isVip ? 'crown' : 'users') + '</span><div><strong>' +
      (p.isVip ? 'Membresía VIP activa' : 'Miembro de la comunidad') + '</strong><p>' + (p.perfilCompleto ? 'Tarjeta profesional completa' : 'Perfil en el Directorio Profesional') + '</p></div></div>');
    if (contacts) aside += section('contact', 'Contacto profesional', 'link', '<p class="pp-contact-note">Medios compartidos contigo por este profesional.</p><div class="pp-contacts">' + contacts + '</div>');

    return '<article class="professional-profile-page ' + (p.isVip ? 'pp-is-vip' : 'pp-is-community') + '" aria-labelledby="professional-profile-name">' +
      '<header class="pp-hero"><div class="pp-cover" style="--pp-cover:' + color + '">' + (image ? '<img class="pp-cover-image" src="' + e(image) + '" alt="" decoding="async">' : '') +
      '<span class="pp-membership">' + icon(p.isVip ? 'crown' : 'users') + (p.isVip ? 'Profesional VIP' : 'Comunidad ICADEM') + '</span></div>' +
      '<div class="pp-identity"><div class="pp-avatar">' + (photo ? '<img src="' + e(photo) + '" alt="Foto de ' + e(name) + '" decoding="async">' : '<span aria-hidden="true">' + e(p.iniciales || name.slice(0, 2).toUpperCase()) + '</span>') + '</div>' +
      '<div class="pp-identity-copy"><span class="pp-eyebrow">PERFIL PROFESIONAL</span><h1 id="professional-profile-name" tabindex="-1">' + e(name) + '</h1>' + (profession ? '<p class="pp-profession">' + e(profession) + '</p>' : '') +
      ((p.empresa || place) ? '<div class="pp-meta">' + (p.empresa ? '<span>' + icon('briefcase') + e(p.empresa) + '</span>' : '') + (place ? '<span>' + icon('home') + e(place) + '</span>' : '') + '</div>' : '') + '</div></div>' +
      '<div class="pp-hero-footer"><div class="pp-actions" aria-label="Acciones del perfil">' + actions + '</div>' + (p.own ? '<p class="pp-privacy-note">' + icon('shield-check') + 'Tus contactos se comparten según tus preferencias de privacidad.</p>' : !contacts ? '<p class="pp-privacy-note">' + icon('shield-check') + 'Contactos sujetos a tus permisos y a la privacidad del profesional.</p>' : '') + '</div></header>' +
      '<div class="pp-layout ' + (!main ? 'pp-layout--compact' : '') + '">' + (main ? '<div class="pp-main">' + main + '</div>' : '') + '<aside class="pp-sidebar" aria-label="Información y contactos">' + aside + '</aside></div></article>';
  }

  window.ICADEMProfessionalProfile = { markup: markup };
})();
