/* Métricas ICADEM · sección del panel de administración.
   Mismo diseño y lógica que IMFRA y Synova (tarjetas, gráfica diaria, horas
   pico, secciones y "Quiénes entran más") más detalles propios de ICADEM:
   en línea ahora, engagement, cursos más vistos, actividad real (retos,
   clases, canjes, certificados), dispositivos, fuentes de tráfico,
   campañas, días de la semana y páginas web. */
(function () {
  'use strict';

  var SECTION_NAMES = {
    inicio: 'Inicio', cursos: 'Mis cursos', 'curso-detalle': 'Detalle de curso', 'clase-detalle': 'Clases (video y juego)',
    webinars: 'Clases en vivo', retos: 'Retos', logros: 'Mis logros', certificados: 'Certificados',
    herramientas: 'Herramientas', libros: 'Libros', materiales: 'Materiales', foro: 'Foro VIP',
    directorio: 'Directorio VIP', canal: 'Canal WhatsApp', suscripcion: 'Membresía', perfil: 'Mi perfil',
    'tool-calc-fiscal': 'Calculadora fiscal', 'tool-calc-nomina': 'Calculadora de nómina', 'tool-calc-credito': 'Calculadora de crédito',
    'tool-plantillas': 'Plantillas de negocio', 'tool-reporte': 'Generador de reportes',
    acceso: 'Inicio de sesión / registro', verificar: 'Verificar certificado', index: 'Página principal'
  };
  var RETO_NAMES = {
    daily: '12 preguntas clave · diario', pulse: 'Veredicto exprés', applied: 'Decide con criterio', memory: 'Memoria técnica',
    'pro:puzzle': 'Rompecabezas profesional', 'pro:hazard': 'Encuentra la irregularidad', 'pro:spot': 'Señala en la escena',
    'pro:document': 'Revisa el documento', 'pro:calc': 'Calcula y comprueba', 'pro:vmemory': 'Memorama visual', 'pro:order': 'Ordena el proceso',
    'catalog:crossword': 'Crucigrama técnico', 'catalog:memory': 'Conecta conceptos', 'catalog:wordsearch': 'Sopa de conceptos',
    'catalog:puzzle': 'Rompecabezas · Juegos ICADEM', 'catalog:guess': 'Veredicto exprés · Juegos ICADEM', 'catalog:classify': 'Decide con criterio · Juegos ICADEM'
  };
  var DEVICE = { movil: ['Celular', 'phone'], tablet: ['Tableta', 'tablet'], escritorio: ['Computadora', 'desktop'] };
  var OS = { android: 'Android', ios: 'iPhone / iPad', windows: 'Windows', macos: 'Mac', linux: 'Linux', chromeos: 'Chromebook', otro: 'Otro' };
  var BROWSER = { chrome: 'Chrome', safari: 'Safari', edge: 'Edge', firefox: 'Firefox', samsung: 'Samsung Internet', opera: 'Opera', 'facebook-app': 'Dentro de Facebook', 'instagram-app': 'Dentro de Instagram', 'tiktok-app': 'Dentro de TikTok', otro: 'Otro' };
  var SOURCE = {
    facebook: ['Facebook', '#1877F2'], instagram: ['Instagram', '#E1306C'], whatsapp: ['WhatsApp', '#25D366'], google: ['Google', '#EA4335'],
    buscadores: ['Otros buscadores', '#8B5CF6'], youtube: ['YouTube', '#FF0000'], tiktok: ['TikTok', '#111827'], linkedin: ['LinkedIn', '#0A66C2'],
    x: ['X / Twitter', '#334155'], email: ['Correo', '#F59E0B'], campana: ['Campaña (utm)', '#14B8A6'], 'otros-sitios': ['Otros sitios', '#94A3B8'],
    directo: ['Directo / sin origen', '#64748B']
  };
  var WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var WEEK_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function num(n) { return Number(n || 0).toLocaleString('es-MX'); }
  function duration(n) { n = Math.round(n || 0); return n < 60 ? n + ' min' : Math.floor(n / 60) + ' h' + (n % 60 ? ' ' + (n % 60) + ' min' : ''); }
  function average(n) { return !n ? '0 min' : n < 1 ? Math.round(n * 60) + ' s' : String(n).replace('.', ',') + ' min'; }
  function decimal(n) { return String(n || 0).replace('.', ','); }
  function shortDate(d) { return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  function ago(iso) {
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return 'En línea';
    if (m < 60) return 'Hace ' + m + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'Hace ' + h + ' h';
    var d = Math.round(h / 24); return d === 1 ? 'Ayer' : 'Hace ' + d + ' días';
  }
  function sectionName(s) {
    s = String(s || '');
    return SECTION_NAMES[s] || (s.indexOf('tool-') === 0 ? 'Herramienta · ' + s.slice(5).replace(/-/g, ' ') : s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '));
  }
  function retoName(k) {
    if (RETO_NAMES[k]) return RETO_NAMES[k];
    var p = String(k || '').split(':');
    return p[1] ? p[1] : (k || 'Reto');
  }
  function pct(part, total) { return total ? Math.round(part / total * 100) : 0; }
  function maxOf(list, fn) { return Math.max.apply(null, [1].concat(list.map(fn))); }
  function avatar(u) {
    var name = u.nombre || u.email || (u.eliminado ? 'Cuenta eliminada' : 'Miembro');
    var initial = esc(name.trim().slice(0, 2).toUpperCase());
    return /^https:\/\/[^\s"'<>]+$/i.test(u.foto || '') ? '<img src="' + esc(u.foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span>' + initial + '</span>';
  }
  function memberName(u) { return u.nombre || u.email || (u.eliminado ? 'Cuenta eliminada' : (u.uid ? 'Miembro sin nombre' : 'Visitante')); }
  function icon(name) {
    var paths = {
      phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/>',
      tablet: '<rect x="4" y="3" width="16" height="18" rx="2.4"/><path d="M11 18h2"/>',
      desktop: '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
      bolt: '<path d="M13 2 4.5 13.5H12l-1 8.5 8.5-11.5H12z"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 21V5.5"/>',
      gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5V21h14v-8.5M12 8v13M12 8S9.5 3.5 7.5 5 9.5 8 12 8zm0 0s2.5-4.5 4.5-3S14.5 8 12 8z"/>',
      award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.6 13.4-1.6 7.6 5-2.6 5 2.6-1.6-7.6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
      coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2A3 3 0 0 0 12 8c-1.7 0-3 1-3 2.2 0 2.8 6 1.4 6 4.2 0 1.2-1.3 2.1-3 2.1a3.3 3.3 0 0 1-2.8-1.4M12 6.5V8m0 8.5V18"/>'
    };
    return '<svg class="mx-ic" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  function mount(container, opts) {
    var days = 30, order = 'tiempo', tableView = false, data = null, loading = false;
    var mountId = (container.__mxMount = (container.__mxMount || 0) + 1);
    function alive() { return container.__mxMount === mountId && container.isConnected && container.querySelector('.mx-page'); }
    var tip = document.createElement('div'); tip.className = 'mx-tip'; tip.hidden = true;
    window.addEventListener('scroll', function () { tip.hidden = true; }, { capture: true, passive: true });

    function card(title, c) {
      return '<article class="mx-card"><span class="mx-card__label">' + title + '</span><strong class="mx-card__value">' + num(c.visitantes) + '</strong>' +
        '<span class="mx-card__sub">visitantes · ' + num(c.sesiones) + ' visitas</span>' +
        '<div class="mx-card__split"><span><i class="mx-dot mx-dot--panel"></i>Panel ' + num(c.panel) + '</span><span><i class="mx-dot mx-dot--web"></i>Web ' + num(c.web) + '</span></div></article>';
    }
    function miniCard(label, value, sub, extra) {
      return '<article class="mx-card mx-card--mini"><span class="mx-card__label">' + label + '</span><strong class="mx-card__value">' + value + '</strong><span class="mx-card__sub">' + sub + '</span>' + (extra || '') + '</article>';
    }
    function panel(kicker, title, body, head) {
      return '<section class="mx-panel"><header class="mx-panel__head"><div><span class="mx-kicker">' + kicker + '</span><h3>' + title + '</h3></div>' + (head || '') + '</header>' + body + '</section>';
    }
    function empty(text) { return '<p class="mx-muted">' + text + '</p>'; }

    function engagement(d) {
      var e = d.engagement || {}, v = d.visitantes || { total: 0, nuevos: 0, recurrentes: 0 };
      var nuevosPct = pct(v.nuevos, v.total);
      return '<div class="mx-cards mx-cards--mini">' +
        miniCard('Miembros activos', num(e.miembrosActivos), 'entraron al panel en ' + d.dias + ' días',
          '<div class="mx-card__split"><span><span class="mx-badge mx-badge--vip">★ VIP</span> ' + num(e.miembrosVip) + '</span><span><span class="mx-badge">Gratis</span> ' + num(e.miembrosGratis) + '</span></div>') +
        miniCard('Visitantes nuevos', num(v.nuevos), nuevosPct + '% del total · ' + num(v.recurrentes) + ' regresaron',
          '<div class="mx-meter" title="Nuevos ' + nuevosPct + '%"><i style="width:' + nuevosPct + '%"></i></div>') +
        miniCard('Secciones por visita', decimal(e.seccionesPorVisita), 'en el panel · ' + decimal(e.visitasPorVisitante) + ' visitas por persona',
          '<div class="mx-card__split"><span>Rebote ' + num(e.rebotePct) + '%</span></div>') +
        miniCard('Usan la app instalada', num(e.appPct) + '%', 'de las visitas abren ICADEM como app',
          '<div class="mx-meter mx-meter--app"><i style="width:' + Math.min(100, e.appPct || 0) + '%"></i></div>') +
        '</div>';
    }

    function daily(d) {
      var max = maxOf(d.porDia, function (x) { return x.panel + x.web; }), top = Math.max(4, Math.ceil(max / 4) * 4);
      var step = d.porDia.length > 31 ? 7 : d.porDia.length > 10 ? 5 : 1;
      var bars = d.porDia.map(function (x, i) {
        var total = x.panel + x.web;
        return '<div class="mx-col" data-tip="' + esc(shortDate(x.dia)) + '|' + x.panel + '|' + x.web + '|' + x.minutos + '" tabindex="0"><div class="mx-col__stack" style="height:' + (total / top * 100) + '%">' +
          (x.web ? '<span class="mx-seg mx-seg--web" style="flex:' + x.web + '"></span>' : '') + (x.panel ? '<span class="mx-seg mx-seg--panel" style="flex:' + x.panel + '"></span>' : '') +
          '</div><span class="mx-col__x">' + ((i % step === 0 || i === d.porDia.length - 1) ? esc(shortDate(x.dia)) : '') + '</span></div>';
      }).join('');
      var lines = [1, 0.75, 0.5, 0.25].map(function (f) { return '<div class="mx-grid__line" style="bottom:' + (f * 100) + '%"><span>' + num(Math.round(top * f)) + '</span></div>'; }).join('');
      var rows = d.porDia.slice().reverse().map(function (x) { return '<tr><td>' + esc(shortDate(x.dia)) + '</td><td class="mx-num">' + num(x.panel) + '</td><td class="mx-num">' + num(x.web) + '</td><td class="mx-num">' + num(x.sesiones) + '</td><td class="mx-num">' + duration(x.minutos) + '</td></tr>'; }).join('');
      var legend = '<div class="mx-legend"><span><i class="mx-dot mx-dot--panel"></i>Panel VIP</span><span><i class="mx-dot mx-dot--web"></i>Página web</span><button type="button" class="mx-link" data-mx-table>' + (tableView ? 'Ver gráfica' : 'Ver tabla') + '</button></div>';
      return panel('Visitantes por día', 'Últimos ' + d.dias + ' días',
        tableView ? '<div class="mx-table-wrap"><table class="mx-table"><thead><tr><th>Día</th><th>Panel VIP</th><th>Página web</th><th>Visitas</th><th>Tiempo</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="mx-chart"><div class="mx-grid">' + lines + '</div><div class="mx-cols">' + bars + '</div></div>', legend);
    }

    function online(d) {
      var list = d.enLineaDetalle || [];
      if (!list.length) return '';
      var items = list.map(function (o) {
        var dev = DEVICE[o.dispositivo] || DEVICE.escritorio;
        var where = o.area === 'panel' ? sectionName(o.seccion) + (o.curso ? ' · ' + o.curso : '') : (o.area === 'auth' ? 'Iniciando sesión' : 'Página web · ' + sectionName(o.seccion));
        return '<li><span class="mx-avatar">' + (o.uid ? avatar(o) : '<span>' + icon(dev[1]) + '</span>') + '</span><div><strong>' + esc(o.uid ? memberName(o) : 'Visitante anónimo') + (o.vip ? ' <span class="mx-badge mx-badge--vip">★ VIP</span>' : '') + '</strong><small>' + esc(where) + '</small></div><span class="mx-online__dev" title="' + esc(dev[0]) + '">' + icon(dev[1]) + '</span></li>';
      }).join('');
      return panel('En vivo', num(list.length) + (list.length === 1 ? ' persona en línea ahora' : ' personas en línea ahora'), '<ul class="mx-online">' + items + '</ul>', '<span class="mx-live mx-live--inline"><i></i>Últimos 2 minutos</span>');
    }

    function hours(d) {
      var max = maxOf(d.porHora, function (n) { return n; }), peakVal = Math.max.apply(null, d.porHora), peak = d.porHora.indexOf(peakVal);
      return panel('Horas pico · hora de México', peakVal ? 'Más visitas a las ' + peak + ':00' : 'Sin datos todavía',
        '<div class="mx-hours">' + d.porHora.map(function (n, h) { return '<div class="mx-hour' + (h === peak && peakVal ? ' is-peak' : '') + '" data-tip="' + h + ':00|' + n + '" tabindex="0"><span style="height:' + (n / max * 100) + '%"></span><small>' + (h % 6 === 0 ? h + 'h' : '') + '</small></div>'; }).join('') + '</div>');
    }
    function weekdays(d) {
      var list = d.porDiaSemana || [0, 0, 0, 0, 0, 0, 0], max = maxOf(list, function (n) { return n; }), peakVal = Math.max.apply(null, list), peak = list.indexOf(peakVal);
      return panel('Días de la semana', peakVal ? 'El ' + WEEK_FULL[peak] + ' entra más gente' : 'Sin datos todavía',
        '<div class="mx-hours mx-hours--week">' + list.map(function (n, i) { return '<div class="mx-hour' + (i === peak && peakVal ? ' is-peak' : '') + '" data-tip="' + WEEK_FULL[i] + '|' + n + '" tabindex="0"><span style="height:' + (n / max * 100) + '%"></span><small>' + WEEK[i] + '</small></div>'; }).join('') + '</div>');
    }

    function rank(list, nameFn, valueFn, subFn, barFn) {
      var max = maxOf(list, barFn);
      return '<ol class="mx-rank">' + list.map(function (s) {
        return '<li><div class="mx-rank__top"><span>' + nameFn(s) + '</span><b>' + valueFn(s) + '</b></div><div class="mx-rank__bar"><i style="width:' + Math.max(2, barFn(s) / max * 100) + '%"></i></div><small>' + subFn(s) + '</small></li>';
      }).join('') + '</ol>';
    }
    function sections(d) {
      return panel('Panel VIP', 'Secciones más vistas', d.secciones.length ? rank(d.secciones, function (s) { return esc(sectionName(s.seccion)); }, function (s) { return duration(s.minutos); }, function (s) { return num(s.sesiones) + ' visitas'; }, function (s) { return s.minutos; }) : empty('Aún no hay visitas al panel en este periodo.'));
    }
    function courses(d) {
      var list = d.cursos || [];
      return panel('Contenido', 'Cursos más vistos', list.length ? rank(list, function (c) { return esc(c.titulo || 'Curso ' + c.cursoId); }, function (c) { return duration(c.minutos); }, function (c) { return num(c.visitantes) + (c.visitantes === 1 ? ' persona' : ' personas') + ' · ' + num(c.sesiones) + ' visitas'; }, function (c) { return c.minutos; }) : empty('Todavía nadie abrió un curso en este periodo.'));
    }

    function activity(d) {
      var a = d.actividad;
      if (!a) return '';
      var r = a.resumen || {};
      var tiles = [
        ['bolt', 'Retos ganados', r.retosGanados, '+30 créditos c/u'],
        ['book', 'Clases superadas', r.clasesSuperadas, 'juego de cierre de clase'],
        ['gift', 'Canjes', (r.canjesLibros || 0) + (r.canjesMateriales || 0), num(r.canjesLibros) + ' libros · ' + num(r.canjesMateriales) + ' materiales'],
        ['award', 'Certificados', r.certificados, 'emitidos en el periodo'],
        ['user', 'Registros nuevos', r.nuevosRegistros, 'cuentas que recibieron su bienvenida'],
        ['coin', 'Créditos ganados', r.creditosGanados, num(r.creditosCanjeados) + ' canjeados']
      ].map(function (t) { return '<div class="mx-stat"><span class="mx-stat__ic">' + icon(t[0]) + '</span><div><strong>' + num(t[2]) + '</strong><span>' + t[1] + '</span><small>' + t[3] + '</small></div></div>'; }).join('');
      var series = a.porDia || [], top = maxOf(series, function (x) { return x.retos + x.clases; });
      var step = series.length > 31 ? 7 : series.length > 10 ? 5 : 1;
      var bars = series.map(function (x, i) {
        var total = x.retos + x.clases;
        return '<div class="mx-col" data-tip="' + esc(shortDate(x.dia)) + '|' + x.retos + '|' + x.clases + '|act" tabindex="0"><div class="mx-col__stack" style="height:' + (total / top * 100) + '%">' +
          (x.clases ? '<span class="mx-seg mx-seg--clases" style="flex:' + x.clases + '"></span>' : '') + (x.retos ? '<span class="mx-seg mx-seg--retos" style="flex:' + x.retos + '"></span>' : '') +
          '</div><span class="mx-col__x">' + ((i % step === 0 || i === series.length - 1) ? esc(shortDate(x.dia)) : '') + '</span></div>';
      }).join('');
      var legend = '<div class="mx-legend"><span><i class="mx-dot mx-dot--retos"></i>Retos ganados</span><span><i class="mx-dot mx-dot--clases"></i>Clases superadas</span></div>';
      return panel('Lo que hacen los miembros · ' + d.dias + ' días', 'Actividad real',
        '<div class="mx-stats">' + tiles + '</div><div class="mx-chart mx-chart--short"><div class="mx-cols mx-cols--plain">' + bars + '</div></div>', legend);
    }
    function activityDetail(d) {
      var a = d.actividad;
      if (!a) return '';
      var retos = panel('Retos', 'Los más ganados', a.retos.length ? rank(a.retos, function (x) { return esc(retoName(x.clave)); }, function (x) { return num(x.ganados); }, function () { return 'veces ganado'; }, function (x) { return x.ganados; }) : empty('Aún no se gana ningún reto en este periodo.'));
      var cursos = panel('Cursos', 'Clases superadas por curso', a.cursos.length ? rank(a.cursos, function (x) { return esc(x.titulo || 'Curso ' + x.cursoId); }, function (x) { return num(x.clases); }, function (x) { return num(x.alumnos) + (x.alumnos === 1 ? ' alumno' : ' alumnos'); }, function (x) { return x.clases; }) : empty('Todavía no hay clases superadas en este periodo.'));
      var canjes = panel('Recompensas', 'Lo más canjeado', a.canjes.length ? rank(a.canjes, function (x) { return '<em class="mx-tag">' + (x.tipo === 'libro' ? 'Libro' : 'Material') + '</em> ' + esc(x.titulo || 'Sin título'); }, function (x) { return num(x.canjes); }, function () { return 'canjes'; }, function (x) { return x.canjes; }) : empty('Aún no hay canjes de libros o materiales en este periodo.'));
      var players = a.jugadores.length ? '<ol class="mx-people">' + a.jugadores.map(function (j, i) {
        return '<li><span class="mx-people__n">' + (i + 1) + '</span><span class="mx-avatar">' + avatar(j) + '</span><div><strong>' + esc(memberName(j)) + (j.vip ? ' <span class="mx-badge mx-badge--vip">★ VIP</span>' : '') + '</strong><small>' + num(j.retos) + ' retos · ' + num(j.clases) + ' clases</small></div><b>+' + num(j.creditos) + '</b></li>';
      }).join('') + '</ol>' : empty('Aún no hay actividad en retos o clases.');
      return '<div class="mx-two">' + retos + cursos + '</div><div class="mx-two">' + canjes + panel('Ranking del periodo', 'Los más activos', players) + '</div>';
    }

    function share(list, labelFn, colorFn) {
      var total = list.reduce(function (a, x) { return a + x.sesiones; }, 0);
      if (!total) return empty('Sin datos todavía.');
      var bar = '<div class="mx-stackbar">' + list.map(function (x) { return '<i style="flex:' + x.sesiones + ';background:' + colorFn(x) + '" title="' + esc(labelFn(x)) + ' ' + pct(x.sesiones, total) + '%"></i>'; }).join('') + '</div>';
      return bar + '<ul class="mx-share">' + list.map(function (x) {
        return '<li><i class="mx-dot" style="background:' + colorFn(x) + '"></i><span>' + labelFn(x) + '</span><b>' + pct(x.sesiones, total) + '%</b><small>' + num(x.visitantes) + (x.visitantes === 1 ? ' persona' : ' personas') + '</small></li>';
      }).join('') + '</ul>';
    }
    var PALETTE = ['#1f5f99', '#2bb3a3', '#e3a62a', '#8b5cf6', '#ef6f6c', '#64748b', '#0ea5e9', '#a3a3a3'];
    function audience(d) {
      var devColor = { movil: 'var(--mx-panel)', tablet: '#e3a62a', escritorio: 'var(--mx-web)' };
      var devices = panel('Audiencia', 'Dispositivos', share(d.dispositivos || [], function (x) { return (DEVICE[x.clave] || [x.clave])[0]; }, function (x) { return devColor[x.clave] || '#94a3b8'; }));
      var sources = panel('Adquisición', 'De dónde llegan', share(d.fuentes || [], function (x) { return (SOURCE[x.clave] || [x.clave])[0]; }, function (x) { return (SOURCE[x.clave] || [0, '#94a3b8'])[1]; }));
      var tech = panel('Tecnología', 'Sistema y navegador',
        '<div class="mx-sub">Sistema</div>' + share((d.sistemas || []).slice(0, 6), function (x) { return OS[x.clave] || x.clave; }, function (x) { return PALETTE[(d.sistemas || []).indexOf(x) % PALETTE.length]; }) +
        '<div class="mx-sub">Navegador</div>' + share((d.navegadores || []).slice(0, 6), function (x) { return BROWSER[x.clave] || x.clave; }, function (x) { return PALETTE[(d.navegadores || []).indexOf(x) % PALETTE.length]; }));
      return '<div class="mx-three">' + devices + sources + tech + '</div>';
    }
    function webAndCampaigns(d) {
      var camps = d.campanas || [];
      var campaigns = panel('Campañas', 'Campañas que traen gente', camps.length ? rank(camps, function (x) { return esc(x.clave); }, function (x) { return num(x.visitantes); }, function (x) { return num(x.sesiones) + ' visitas · ' + duration(x.minutos); }, function (x) { return x.visitantes; }) :
        empty('Aún no llegan visitas con campaña. Agrega <code>?utm_source=facebook&amp;utm_campaign=nombre</code> a los enlaces de tus anuncios para verlas aquí.'));
      var web = panel('Página web', 'Páginas más vistas', (d.paginasWeb || []).length ? rank(d.paginasWeb, function (s) { return esc(sectionName(s.seccion)); }, function (s) { return num(s.sesiones) + ' visitas'; }, function (s) { return duration(s.minutos) + ' en total'; }, function (s) { return s.sesiones; }) : empty('Sin visitas a la página web en este periodo.'));
      var entries = panel('Primer paso', 'Por dónde entran', (d.entradas || []).length ? rank(d.entradas, function (x) { var p = String(x.clave).split(':'); return esc((p[0] === 'panel' ? 'Panel · ' : 'Web · ') + sectionName(p[1])); }, function (x) { return num(x.sesiones); }, function (x) { return num(x.visitantes) + ' personas'; }, function (x) { return x.sesiones; }) : empty('Sin datos todavía.'));
      return '<div class="mx-three">' + campaigns + web + entries + '</div>';
    }

    function users(d) {
      var list = d.usuarios.slice().sort(function (a, b) { return order === 'visitas' ? b.sesiones - a.sesiones || b.minutos - a.minutos : b.minutos - a.minutos || b.sesiones - a.sesiones; });
      var rows = list.map(function (u, i) {
        var name = memberName(u), dev = DEVICE[u.dispositivo] || null;
        return '<tr><td class="mx-num">' + (i + 1) + '</td><td><div class="mx-user"><span class="mx-avatar">' + avatar(u) + '</span><div><strong>' + esc(name) + '</strong>' + (u.email && u.nombre ? '<small>' + esc(u.email) + '</small>' : '') + '</div></div></td>' +
          '<td>' + (u.vip ? '<span class="mx-badge mx-badge--vip">★ VIP</span>' : u.eliminado ? '<span class="mx-badge">Eliminada</span>' : '<span class="mx-badge">Gratis</span>') + '</td>' +
          '<td class="mx-num">' + num(u.sesiones) + '</td><td class="mx-num">' + num(u.diasActivos) + '</td><td class="mx-num"><b>' + duration(u.minutos) + '</b></td>' +
          '<td class="mx-fav">' + esc(u.seccionFavorita ? sectionName(u.seccionFavorita) : '—') + '</td>' +
          '<td class="mx-devcell" title="' + esc(dev ? dev[0] : '') + '">' + (dev ? icon(dev[1]) : '') + '</td>' +
          '<td class="mx-when">' + esc(ago(u.ultimaVisita)) + '</td></tr>';
      }).join('');
      var toggle = '<div class="mx-seg-ctrl"><button type="button" data-mx-order="tiempo" class="' + (order === 'tiempo' ? 'is-active' : '') + '">Por tiempo</button><button type="button" data-mx-order="visitas" class="' + (order === 'visitas' ? 'is-active' : '') + '">Por visitas</button></div>';
      return panel('Panel VIP · últimos ' + d.dias + ' días', 'Quiénes entran más',
        list.length ? '<div class="mx-table-wrap"><table class="mx-table"><thead><tr><th>#</th><th>Miembro</th><th>Plan</th><th>Visitas</th><th>Días activos</th><th>Tiempo total</th><th>Lo que más usa</th><th>Equipo</th><th>Última visita</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : empty('Aún no hay miembros con visitas en este periodo.'), toggle);
    }

    function bindTips(scope) {
      scope.querySelectorAll('[data-tip]').forEach(function (el) {
        function show() {
          var p = (el.dataset.tip || '').split('|');
          if (p[3] === 'act') tip.innerHTML = '<b>' + esc(p[0]) + '</b><span><i class="mx-dot mx-dot--retos"></i>Retos <strong>' + num(+p[1]) + '</strong></span><span><i class="mx-dot mx-dot--clases"></i>Clases <strong>' + num(+p[2]) + '</strong></span>';
          else if (p.length === 4) tip.innerHTML = '<b>' + esc(p[0]) + '</b><span><i class="mx-dot mx-dot--panel"></i>Panel <strong>' + num(+p[1]) + '</strong></span><span><i class="mx-dot mx-dot--web"></i>Web <strong>' + num(+p[2]) + '</strong></span><span>Tiempo <strong>' + duration(+p[3]) + '</strong></span>';
          else tip.innerHTML = '<b>' + esc(p[0]) + '</b><span>Visitas <strong>' + num(+p[1]) + '</strong></span>';
          tip.hidden = false;
          var r = el.getBoundingClientRect(), w = tip.offsetWidth;
          tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)) + 'px';
          tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + 'px';
        }
        el.addEventListener('mouseenter', show); el.addEventListener('focus', show);
        el.addEventListener('mouseleave', function () { tip.hidden = true; }); el.addEventListener('blur', function () { tip.hidden = true; });
      });
    }

    function paint() {
      var body = container.querySelector('[data-mx-body]');
      if (!body || !data) return;
      body.classList.remove('is-loading'); tip.hidden = true;
      var d = data, emptyAll = !d.tarjetas.mes.sesiones && !(d.actividad && (d.actividad.resumen.retosGanados || d.actividad.resumen.clasesSuperadas));
      body.innerHTML = (emptyAll ? '<div class="mx-note"><strong>Las métricas empiezan a registrarse desde hoy.</strong> Las nuevas visitas aparecerán automáticamente.</div>' : '') +
        '<div class="mx-cards">' + card('Hoy', d.tarjetas.hoy) + card('Últimos 7 días', d.tarjetas.semana) + card('Últimos 30 días', d.tarjetas.mes) +
        '<article class="mx-card"><span class="mx-card__label">Tiempo por visita</span><strong class="mx-card__value">' + average(d.tarjetas.mes.promedioMin) + '</strong><span class="mx-card__sub">promedio · 30 días</span><div class="mx-card__split"><span>Total ' + duration(d.tarjetas.mes.minutos) + '</span></div></article></div>' +
        engagement(d) + daily(d) + online(d) +
        '<div class="mx-two">' + hours(d) + weekdays(d) + '</div>' +
        '<div class="mx-two">' + sections(d) + courses(d) + '</div>' +
        activity(d) + activityDetail(d) + audience(d) + webAndCampaigns(d) + users(d) +
        '<p class="mx-foot">Actualizado ' + new Date(d.generado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) + ' · No se cuentan las visitas de administradores ni de buscadores. No se guarda la IP de nadie.</p>';
      container.querySelector('[data-mx-live]').textContent = num(d.enLinea) + ' en línea ahora';
      var tbtn = body.querySelector('[data-mx-table]');
      if (tbtn) tbtn.addEventListener('click', function () { tableView = !tableView; paint(); });
      body.querySelectorAll('[data-mx-order]').forEach(function (b) { b.addEventListener('click', function () { order = b.dataset.mxOrder; paint(); }); });
      bindTips(body);
    }

    async function load() {
      if (loading) return;
      loading = true;
      var body = container.querySelector('[data-mx-body]');
      if (body) body.classList.add('is-loading');
      try {
        var token = await opts.getToken();
        var r = await fetch(opts.api + '/admin/metricas?dias=' + days, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
        var json = await r.json().catch(function () { return {}; });
        if (!r.ok || !json.ok) throw new Error(json.error || 'No se pudieron cargar las métricas');
        if (!alive()) return;
        data = json; paint();
      } catch (e) {
        body = container.querySelector('[data-mx-body]');
        if (body) {
          body.classList.remove('is-loading');
          body.innerHTML = '<div class="mx-empty"><strong>No pudimos cargar las métricas</strong><p>' + esc(e.message) + '</p><button type="button" class="mx-btn" data-mx-retry>Reintentar</button></div>';
          var retry = body.querySelector('[data-mx-retry]'); if (retry) retry.addEventListener('click', load);
        }
      } finally { loading = false; }
    }

    container.innerHTML = '<div class="mx-page fade-up"><div class="sec-hero"><span class="sec-hero__eyebrow">Actividad real</span><h1 class="sec-hero__title">Métricas</h1>' +
      '<p class="sec-hero__sub">Visitas al panel VIP y al sitio público, tiempo de permanencia, recorridos, lo que más usan los miembros y de dónde llegan.</p></div>' +
      '<div class="mx-toolbar"><div class="mx-seg-ctrl" role="group" aria-label="Periodo">' + [7, 30, 90].map(function (n) { return '<button type="button" data-mx-days="' + n + '" class="' + (n === days ? 'is-active' : '') + '">' + n + ' días</button>'; }).join('') + '</div>' +
      '<span class="mx-live"><i></i><span data-mx-live>— en línea ahora</span></span><button type="button" class="mx-btn" data-mx-refresh>Actualizar</button></div>' +
      '<div data-mx-body class="is-loading"><div class="mx-empty"><span class="mx-spin"></span>Cargando métricas…</div></div></div>';
    container.appendChild(tip);
    container.querySelectorAll('[data-mx-days]').forEach(function (b) {
      b.addEventListener('click', function () {
        days = Number(b.dataset.mxDays);
        container.querySelectorAll('[data-mx-days]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        load();
      });
    });
    container.querySelector('[data-mx-refresh]').addEventListener('click', load);
    load();
    // Se actualiza solo cada 60 s mientras la sección esté abierta.
    var timer = setInterval(function () {
      if (!alive()) { clearInterval(timer); return; }
      if (document.visibilityState === 'visible') load();
    }, 60000);
  }

  window.ICADEMMetricsAdmin = { mount: mount };
  window.dispatchEvent(new CustomEvent('icadem:metrics-admin-ready'));
})();
