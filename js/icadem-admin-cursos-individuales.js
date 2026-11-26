(function () {
  const tabs = [['resumen', 'Resumen'], ['inscripciones', 'Inscripciones'], ['visitas', 'Visitas'],
    ['video', 'Video'], ['pagos', 'Pagos'], ['precios', 'Precios']];
  const labels = { telefono: 'Teléfono', computadora: 'Computadora', tableta: 'Tableta', desconocido: 'Sin dato' };
  const colors = ['#1c56cf', '#527edb', '#087c70', '#8c9bb3'];
  const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
  const datetime = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
  const day = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const integer = new Intl.NumberFormat('es-MX');
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const count = value => integer.format(Number(value) || 0);
  const amount = cents => currency.format((Number(cents) || 0) / 100);
  const when = value => value && !isNaN(new Date(value)) ? datetime.format(new Date(value)) : '—';
  const source = value => value === 'directo' ? 'Página directa' : value || 'Sin dato';
  const duration = value => {
    const seconds = Math.max(0, Math.floor(value || 0));
    return seconds < 60 ? seconds + ' s' : Math.floor(seconds / 60) + ' min ' + seconds % 60 + ' s';
  };
  const metric = (title, value, note = '') => '<article class="ci-card ci-metric"><h3>' + safe(title) +
    '</h3><strong>' + safe(value) + '</strong>' + (note ? '<small>' + safe(note) + '</small>' : '') + '</article>';
  const event = (data, key, title) => {
    const known = data.identificados[key] || 0;
    return metric(title, count(data.totales[key]), count(known) + ' identificadas · ' +
      count(data.totales[key] - known) + ' anónimas · ' + duration(data.tiempos[key]));
  };

  function devices(data) {
    const keys = Object.keys(labels);
    const values = keys.map(key => Number(data.dispositivos[key]) || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    let end = 0;
    const arcs = values.map((value, index) => {
      const start = end;
      end += total ? value / total * 100 : 0;
      return colors[index] + ' ' + start + '% ' + end + '%';
    });
    return '<section class="ci-card"><h3>Visitas por dispositivo</h3><div class="ci-device">' +
      '<div class="ci-ring" style="--ci-ring:' + (total ? 'conic-gradient(' + arcs.join(',') + ')' : 'var(--border)') +
      '" aria-hidden="true"><div><b>' + count(total) + '</b><small>visitas</small></div></div>' +
      '<ul>' + keys.map((key, i) => '<li><span class="ci-dot" style="background:' + colors[i] +
        '"></span><span>' + labels[key] + '</span><b>' + count(values[i]) + '</b><small>' +
        (total ? (values[i] / total * 100).toFixed(1) : '0') + '%</small></li>').join('') + '</ul></div></section>';
  }

  function breakdown(data, columns) {
    const rows = Object.entries(data.dias).sort(([first], [second]) => second.localeCompare(first));
    return '<details class="ci-card ci-breakdown"' + (rows.length ? ' open' : '') +
      '><summary>Ver desglose por día</summary><p>Horario de Ciudad de México.</p>' +
      (rows.length ? '<div class="ci-table"><table><thead><tr><th>Día</th>' +
        columns.map(([, label]) => '<th>' + safe(label) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(([date, values]) => '<tr><th scope="row">' + safe(day.format(new Date(date + 'T00:00:00Z'))) +
          '</th>' + columns.map(([key]) => '<td>' + count(values[key]) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>' : '<p>Sin actividad registrada en este periodo.</p>') + '</details>';
  }

  function enrollmentRows(rows) {
    if (!rows.length) return '<tr><td colspan="6">Sin inscripciones para mostrar.</td></tr>';
    return rows.slice(0, 250).map(row => '<tr><td>' + safe(when(row.fecha)) + '</td><td><b>' +
      safe(row.nombre || 'Sin nombre') + '</b><small>' + safe(row.email || '—') + '</small></td><td>' +
      safe(row.telefono || '—') + '</td><td>' + safe(source(row.origen)) + '<small>' +
      safe(labels[row.dispositivo] || 'Sin dato') + '</small></td><td>' + safe(amount(row.monto)) +
      '</td><td><span class="ci-badge' + (row.estado === 'pagado' ? ' ci-paid' : '') + '">' +
      (row.estado === 'pagado' ? 'Confirmado' : 'Reembolsado') + '</span></td></tr>').join('');
  }

  function downloadRows(course, rows) {
    const csvCell = value => {
      const text = String(value ?? '');
      return '"' + (/^\s*[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
    };
    const headings = ['Fecha', 'Alumno', 'Correo', 'WhatsApp', 'Curso', 'Origen', 'Monto MXN', 'Estado'];
    const records = rows.map(row => [when(row.fecha), row.nombre, row.email, row.telefono, course.nombre,
      source(row.origen), (row.monto / 100).toFixed(2), row.estado]);
    const value = [headings, ...records].map(record => record.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + value], { type: 'text/csv;charset=utf-8;' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'inscripciones-cursos-individuales.csv' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderEnrollments(body, data) {
    body.innerHTML = '<div class="ci-metrics">' + metric('Compras confirmadas', count(data.pagos)) +
      metric('Cobrado en el periodo', amount(data.ingreso)) + metric('Reembolsos totales', count(data.inscripciones.filter(row => row.estado === 'reembolsado').length)) +
      '</div><section class="ci-card"><h3>Historial de inscripciones</h3><div class="ci-search">' +
      '<label>Buscar<input type="search" placeholder="Nombre, correo o teléfono"></label>' +
      '<button class="ci-button ci-secondary" type="button" data-ci-export>Descargar CSV</button></div>' +
      '<p class="ci-results" aria-live="polite"></p><div class="ci-table"><table><thead><tr><th>Fecha y hora</th>' +
      '<th>Alumno</th><th>Teléfono</th><th>Origen</th><th>Importe</th><th>Estado</th></tr></thead><tbody></tbody></table></div></section>';
    const search = body.querySelector('input');
    const rows = body.querySelector('tbody');
    const result = body.querySelector('.ci-results');
    const visible = () => data.inscripciones.filter(row => [row.nombre, row.email, row.telefono].join(' ').toLowerCase().includes(search.value.trim().toLowerCase()));
    const render = () => {
      const filtered = visible();
      rows.innerHTML = enrollmentRows(filtered);
      result.textContent = count(filtered.length) + ' resultados' + (filtered.length > 250 ? ' · Primeros 250 en pantalla' : '');
    };
    search.addEventListener('input', render);
    body.querySelector('[data-ci-export]').addEventListener('click', () => downloadRows(data.curso, visible()));
    render();
  }

  function renderPrices(body, course, request) {
    body.innerHTML = '<section class="ci-card"><h3>Precios de los cursos</h3>' +
      '<p>El precio normal se muestra tachado. El de lanzamiento se aplica a las compras nuevas.</p>' +
      '<form class="ci-price"><h4>' + safe(course.nombre) + '</h4>' +
      '<label>Precio normal (MXN)<input name="precioNormal" type="number" min="10" max="100000" step="1" required value="' + Number(course.precioNormal) + '"></label>' +
      '<label>Precio de lanzamiento (MXN)<input name="precioLanzamiento" type="number" min="10" max="100000" step="1" required value="' + Number(course.precioLanzamiento) + '"></label>' +
      '<button class="ci-button" type="submit">Guardar precios</button><p class="ci-results" role="status"></p></form></section>';
    const form = body.querySelector('form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const button = form.querySelector('button');
      const status = form.querySelector('[role="status"]');
      const values = new FormData(form);
      button.disabled = true;
      status.textContent = 'Guardando…';
      try {
        const saved = await request('/' + encodeURIComponent(course.slug) + '/precio', {
          method: 'PUT', body: JSON.stringify({ precioNormal: Number(values.get('precioNormal')), precioLanzamiento: Number(values.get('precioLanzamiento')) }),
        });
        Object.assign(course, saved);
        status.textContent = 'Precios actualizados.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }

  function mount(root, { getToken, api }) {
    root.innerHTML = '<section class="ci-admin" aria-labelledby="ci-title"><header><p>Administración</p>' +
      '<h1 id="ci-title">Cursos individuales</h1><span>Actividad, inscripciones y precios de cada curso.</span></header>' +
      '<div class="ci-tabs" aria-label="Vistas de cursos individuales">' + tabs.map(([key, title]) =>
        '<button type="button" data-ci-tab="' + key + '" aria-pressed="' + (key === 'resumen') + '">' + title + '</button>').join('') + '</div>' +
      '<form class="ci-card ci-filters"><label>Curso<select name="curso"><option value="">Todos los cursos</option></select></label>' +
      '<label>Origen<select name="origen"><option value="">Todos los orígenes</option></select></label>' +
      '<label>Periodo<select name="dias"><option value="7">Últimos 7 días</option><option selected value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option></select></label>' +
      '<button type="submit" class="ci-button ci-secondary">Aplicar</button></form><div class="ci-body" aria-live="polite"></div></section>';
    const view = root.querySelector('.ci-admin');
    const filter = view.querySelector('form');
    const body = view.querySelector('.ci-body');
    const buttons = [...view.querySelectorAll('[data-ci-tab]')];
    let selected = 'resumen';
    let generation = 0;
    const reports = new Map();
    const request = async (suffix = '', options = {}) => {
      const token = await getToken();
      const response = await fetch(api + '/admin/cursos-individuales' + suffix, {
        cache: 'no-store', ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar Cursos individuales.');
      return data;
    };
    async function refresh(force = false) {
      const current = ++generation;
      body.textContent = 'Cargando actividad…';
      const params = new URLSearchParams(new FormData(filter));
      try {
        if (selected === 'precios') {
          const course = await request('/precios');
          if (generation === current && root.contains(view)) renderPrices(body, course, request);
          return;
        }
        const key = params.toString();
        const cached = reports.get(key);
        const data = !force && cached && cached.expires > Date.now() ? cached.data : await request('?' + key);
        if (generation !== current || !root.contains(view)) return;
        if (data !== cached?.data) reports.set(key, { data, expires: Date.now() + 30000 });
        const courses = filter.elements.curso;
        if (courses.options.length === 1) courses.add(new Option(data.curso.nombre, data.curso.slug));
        const origins = filter.elements.origen;
        const activeOrigin = params.get('origen');
        origins.replaceChildren(new Option('Todos los orígenes', ''));
        for (const key of new Set([...data.origenes, activeOrigin].filter(Boolean))) origins.add(new Option(source(key), key));
        origins.value = activeOrigin;
        render(data);
      } catch (error) {
        if (generation !== current || !root.contains(view)) return;
        body.innerHTML = '<section class="ci-card"><p></p><button class="ci-button ci-secondary" type="button">Reintentar</button></section>';
        body.querySelector('p').textContent = error.message;
        body.querySelector('button').addEventListener('click', () => refresh(true));
      }
    }
    function render(data) {
      if (selected === 'inscripciones') return renderEnrollments(body, data);
      let cards;
      let detail;
      if (selected === 'visitas') {
        cards = event(data, 'visita', 'Visitas a la página') + event(data, 'oferta', 'Aperturas de oferta') + event(data, 'yaPague', 'Aperturas de «Ya pagué»');
        detail = devices(data) + breakdown(data, [['visita', 'Visitas'], ['oferta', 'Oferta'], ['yaPague', 'Ya pagué']]);
      } else if (selected === 'video') {
        cards = event(data, 'video', 'Reproducciones del video');
        detail = (data.totales.video ? '' : '<section class="ci-card"><p>Sin reproducciones registradas en este periodo.</p></section>') +
          breakdown(data, [['video', 'Reproducciones']]);
      } else if (selected === 'pagos') {
        cards = metric('Sesiones de Stripe creadas', count(data.checkouts),
          count(data.pendientes) + ' pendientes · ' + count(data.noCompletados) + ' sin completar') +
          event(data, 'checkout', 'Visitas con formulario de pago abierto') +
          metric('Pagos confirmados', count(data.pagos), 'Ingresos · ' + amount(data.ingreso));
        detail = breakdown(data, [['checkout', 'Formularios abiertos'], ['pagos', 'Pagos confirmados']]);
      } else {
        cards = event(data, 'visita', 'Visitas a la página') + metric('Inscripciones confirmadas', count(data.pagos)) +
          metric('Ingresos del periodo', amount(data.ingreso));
        detail = devices(data) + breakdown(data, [['visita', 'Visitas'], ['oferta', 'Oferta'], ['video', 'Video'], ['pagos', 'Pagos confirmados']]);
      }
      body.innerHTML = '<div class="ci-metrics">' + cards + '</div>' + detail +
        (data.truncado ? '<p>Se muestran los registros más recientes. Reduce el periodo para ampliar el detalle.</p>' : '');
    }
    filter.addEventListener('submit', e => { e.preventDefault(); refresh(true); });
    buttons.forEach(button => button.addEventListener('click', () => {
      selected = button.dataset.ciTab;
      buttons.forEach(item => item.setAttribute('aria-pressed', item === button));
      filter.hidden = selected === 'precios';
      refresh();
    }));
    refresh();
  }
  window.ICADEMCursosIndividuales = { mount };
  window.dispatchEvent(new Event('icadem:cursos-individuales-ready'));
})();
