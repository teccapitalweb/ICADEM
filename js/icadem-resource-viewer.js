/* ICADEM · Lector de libros y materiales dentro del panel (como IMFRA y SYNOVA)
   - PDF: lector propio con pdf.js (páginas nítidas, zoom, pantalla completa y
     recuerda la última página que leíste).
   - Word, Excel y PowerPoint: visor de Office incrustado.
   El archivo llega por un enlace temporal firmado del servidor
   (POST /api/resources/open); solo lo recibe quien canjeó el recurso. */
(function () {
  'use strict';

  var PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
  var PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  var OFFICE = 'https://view.officeapps.live.com/op/embed.aspx?src=';
  var pdfjsPromise = null;
  var current = null;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function icon(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var I = {
    close: icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    minus: icon('<line x1="5" y1="12" x2="19" y2="12"/>'),
    plus: icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    full: icon('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    down: icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    book: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    file: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>')
  };
  var FORMATOS = { pdf: 'PDF', docx: 'Documento de Word', xlsx: 'Libro de Excel', pptx: 'Presentación', pptm: 'Presentación' };

  function css() {
    if (document.getElementById('rv-styles')) return;
    var s = document.createElement('style');
    s.id = 'rv-styles';
    s.textContent = [
      '.rv{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;background:#0b1626;color:#eaf2ff;opacity:0;transition:opacity .2s ease;font-family:Inter,system-ui,sans-serif}',
      '.rv.is-open{opacity:1}',
      '.rv__bar{display:flex;align-items:center;gap:12px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top));background:#0f1e33;border-bottom:1px solid rgba(255,255,255,.08);min-height:58px}',
      '.rv__icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(91,146,200,.18);color:#8fbce6;flex:none}.rv__icon svg{width:18px;height:18px}',
      '.rv__id{min-width:0;flex:1}.rv__id strong{display:block;font:700 14.5px/1.25 "Plus Jakarta Sans",Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rv__id small{display:block;font-size:11.5px;color:#9fb1c9;margin-top:2px}',
      '.rv__tools{display:flex;align-items:center;gap:6px;flex:none}',
      '.rv__btn{height:36px;min-width:36px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eaf2ff;display:inline-flex;align-items:center;justify-content:center;gap:6px;font:600 12.5px Inter,sans-serif;cursor:pointer;text-decoration:none}',
      '.rv__btn:hover{background:rgba(255,255,255,.1)}.rv__btn svg{width:16px;height:16px}.rv__btn--close{background:#eaf2ff;color:#0b1626;border-color:#eaf2ff}',
      '.rv__zoom{min-width:52px;text-align:center;font:700 12px "JetBrains Mono",monospace;color:#cfdcef}',
      '.rv__page{font:600 12px "JetBrains Mono",monospace;color:#cfdcef;padding:0 6px;white-space:nowrap}',
      '.rv__stage{flex:1;overflow:auto;position:relative;-webkit-overflow-scrolling:touch;background:#1b2638}',
      '.rv__pages{display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px 12px 40px}',
      '.rv__p{position:relative;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.35);border-radius:3px;overflow:hidden}.rv__p canvas{display:block;width:100%;height:100%}',
      '.rv__p::after{content:attr(data-n);position:absolute;right:8px;bottom:6px;font:600 10px Inter,sans-serif;color:#9aa6b6}',
      '.rv__frame{width:100%;height:100%;border:0;display:block;background:#fff}',
      '.rv__state{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px}.rv__state div{max-width:420px}',
      '.rv__state h3{margin:14px 0 6px;font:700 18px "Plus Jakarta Sans",Inter,sans-serif;color:#fff}.rv__state p{margin:0;color:#aebfd6;font-size:13.5px;line-height:1.55}',
      '.rv__spin{width:34px;height:34px;margin:0 auto;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:#8fbce6;animation:rvspin .8s linear infinite}@keyframes rvspin{to{transform:rotate(360deg)}}',
      '.rv__state .rv__btn{margin-top:16px}',
      '.rv__hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(15,30,51,.92);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 14px;font-size:12px;color:#cfdcef;pointer-events:none;transition:opacity .4s}',
      'body.rv-lock{overflow:hidden}',
      '@media(max-width:700px){.rv__bar{flex-wrap:wrap;gap:8px}.rv__id{flex-basis:calc(100% - 96px)}.rv__tools{width:100%;justify-content:space-between}.rv__btn span{display:none}.rv__pages{padding:10px 4px 30px;gap:8px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function cargarPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS).then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return lib;
      }).catch(function (e) { pdfjsPromise = null; throw e; });
    }
    return pdfjsPromise;
  }

  function claveLectura(id) {
    var uid = (window.__currentUser && window.__currentUser.uid) || 'guest';
    return 'icadem:lector:' + uid + ':' + id;
  }

  function cerrar() {
    if (!current) return;
    var c = current; current = null;
    try { c.destroy && c.destroy(); } catch (_) {}
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen().catch(function () {});
    c.root.classList.remove('is-open');
    document.body.classList.remove('rv-lock');
    document.removeEventListener('keydown', c.onKey);
    setTimeout(function () { c.root.remove(); }, 200);
  }

  function estado(root, html) {
    var stage = root.querySelector('.rv__stage');
    stage.innerHTML = '<div class="rv__state"><div>' + html + '</div></div>';
  }

  function abrir(opts) {
    css();
    if (current) cerrar();
    var esLibro = opts.kind === 'book';
    var root = document.createElement('div');
    root.className = 'rv';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', opts.title || 'Lector ICADEM');
    root.innerHTML = '<header class="rv__bar">' +
      '<span class="rv__icon">' + (esLibro ? I.book : I.file) + '</span>' +
      '<div class="rv__id"><strong>' + esc(opts.title || 'Recurso ICADEM') + '</strong><small data-rv-sub>' + esc(opts.subtitle || (esLibro ? 'Biblioteca ICADEM' : 'Materiales ICADEM')) + '</small></div>' +
      '<div class="rv__tools">' +
      '<span data-rv-pdf hidden style="display:none;align-items:center;gap:6px"><button type="button" class="rv__btn" data-rv-out title="Alejar" aria-label="Alejar">' + I.minus + '</button><span class="rv__zoom" data-rv-zoom>100%</span><button type="button" class="rv__btn" data-rv-in title="Acercar" aria-label="Acercar">' + I.plus + '</button><span class="rv__page" data-rv-page></span></span>' +
      '<a class="rv__btn" data-rv-download hidden title="Descargar" aria-label="Descargar">' + I.down + '<span>Descargar</span></a>' +
      '<button type="button" class="rv__btn" data-rv-full title="Pantalla completa" aria-label="Pantalla completa">' + I.full + '</button>' +
      '<button type="button" class="rv__btn rv__btn--close" data-rv-close aria-label="Cerrar">' + I.close + '<span>Cerrar</span></button>' +
      '</div></header><div class="rv__stage"></div>';
    document.body.appendChild(root);
    document.body.classList.add('rv-lock');
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    var ctx = { root: root, destroy: null };
    ctx.onKey = function (e) { if (e.key === 'Escape' && !document.fullscreenElement) cerrar(); };
    document.addEventListener('keydown', ctx.onKey);
    current = ctx;
    root.querySelector('[data-rv-close]').addEventListener('click', cerrar);
    root.querySelector('[data-rv-full]').addEventListener('click', function () {
      if (!document.fullscreenElement) root.requestFullscreen && root.requestFullscreen().catch(function () {});
      else document.exitFullscreen && document.exitFullscreen();
    });
    estado(root, '<div class="rv__spin"></div><h3>Preparando tu ' + (esLibro ? 'libro' : 'material') + '…</h3><p>Un momento, estamos verificando tu acceso.</p>');

    var pedir = window.ICADEMPlatform && window.ICADEMPlatform.request
      ? window.ICADEMPlatform.request('/api/resources/open', { method: 'POST', body: { kind: opts.kind, id: opts.id } })
      : Promise.reject(new Error('Tu sesión aún no está lista. Intenta de nuevo en unos segundos.'));
    pedir.then(function (data) {
      if (current !== ctx) return;
      var dl = root.querySelector('[data-rv-download]');
      dl.href = data.downloadUrl; dl.hidden = false; dl.setAttribute('download', data.downloadName || '');
      root.querySelector('[data-rv-sub]').textContent = (opts.subtitle ? opts.subtitle + ' · ' : '') + (FORMATOS[data.format] || 'Archivo');
      if (data.viewer === 'pdf') return mostrarPdf(ctx, data, opts);
      if (data.viewer === 'office') return mostrarOffice(ctx, data);
      estado(root, '<h3>Listo para descargar</h3><p>Este tipo de archivo se abre mejor en tu equipo.</p><a class="rv__btn" href="' + esc(data.downloadUrl) + '">' + I.down + '<span>Descargar</span></a>');
    }).catch(function (error) {
      if (current !== ctx) return;
      var pendiente = error && error.data && error.data.code === 'resource-file-pending';
      estado(root, '<h3>' + (pendiente ? 'Archivo en preparación' : 'No pudimos abrirlo') + '</h3><p>' + esc((error && error.message) || 'Intenta de nuevo en unos segundos.') + '</p><button type="button" class="rv__btn" data-rv-retry>Intentar de nuevo</button>');
      var retry = root.querySelector('[data-rv-retry]');
      if (retry) retry.addEventListener('click', function () { abrir(opts); });
    });
  }

  function mostrarOffice(ctx, data) {
    var stage = ctx.root.querySelector('.rv__stage');
    stage.innerHTML = '<div class="rv__state" data-rv-wait><div><div class="rv__spin"></div><h3>Abriendo el visor…</h3><p>Los archivos de Office tardan unos segundos en mostrarse.</p></div></div>' +
      '<iframe class="rv__frame" title="' + esc(data.title || 'Material ICADEM') + '" src="' + esc(OFFICE + encodeURIComponent(data.fileUrl)) + '" allowfullscreen></iframe>';
    var frame = stage.querySelector('iframe');
    var wait = stage.querySelector('[data-rv-wait]');
    frame.style.visibility = 'hidden';
    frame.addEventListener('load', function () { frame.style.visibility = ''; if (wait) wait.remove(); });
  }

  function mostrarPdf(ctx, data, opts) {
    var root = ctx.root;
    var stage = root.querySelector('.rv__stage');
    var tools = root.querySelector('[data-rv-pdf]');
    var zoomEl = root.querySelector('[data-rv-zoom]');
    var pageEl = root.querySelector('[data-rv-page]');
    var doc = null, base = null, zoom = 1, pages = [], observer = null, visibles = new Set(), destroyed = false, renderToken = 0;
    var guardada = 1;
    try { guardada = Math.max(1, parseInt(localStorage.getItem(claveLectura(data.id)) || '1', 10) || 1); } catch (_) {}
    ctx.destroy = function () { destroyed = true; if (observer) observer.disconnect(); if (doc) doc.destroy(); };

    cargarPdfjs().then(function (lib) {
      if (destroyed) return;
      return lib.getDocument({ url: data.fileUrl, disableRange: true, disableStream: true, withCredentials: false }).promise.then(function (pdf) {
        if (destroyed) { pdf.destroy(); return; }
        doc = pdf;
        return pdf.getPage(1).then(function (p1) {
          base = p1.getViewport({ scale: 1 });
          stage.innerHTML = '<div class="rv__pages"></div><div class="rv__hint" data-rv-hint>' + (guardada > 1 ? 'Continuamos en la página ' + guardada : 'Desliza para leer') + '</div>';
          var cont = stage.querySelector('.rv__pages');
          for (var n = 1; n <= pdf.numPages; n++) {
            var el = document.createElement('div');
            el.className = 'rv__p'; el.dataset.n = n;
            cont.appendChild(el); pages.push({ el: el, n: n, scale: 0 });
          }
          tools.hidden = false; tools.style.display = 'inline-flex';
          medir();
          observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
              var n = Number(e.target.dataset.n);
              if (e.isIntersecting) { visibles.add(n); pintar(pages[n - 1]); } else visibles.delete(n);
            });
            actualizarPagina();
          }, { root: stage, rootMargin: '600px 0px' });
          pages.forEach(function (p) { observer.observe(p.el); });
          if (guardada > 1 && guardada <= pdf.numPages) pages[guardada - 1].el.scrollIntoView({ block: 'start' });
          setTimeout(function () { var h = stage.querySelector('[data-rv-hint]'); if (h) h.style.opacity = '0'; }, 2600);
        });
      });
    }).catch(function (e) {
      if (destroyed) return;
      console.error('[lector]', e);
      estado(root, '<h3>No pudimos mostrar el PDF aquí</h3><p>Puedes descargarlo y abrirlo en tu equipo.</p><a class="rv__btn" href="' + esc(data.downloadUrl) + '">' + I.down + '<span>Descargar PDF</span></a>');
    });

    function ancho() { return Math.min(stage.clientWidth - (window.innerWidth < 700 ? 8 : 48), 980) * zoom; }
    function medir() {
      if (!base) return;
      var w = ancho();
      pages.forEach(function (p) { p.el.style.width = w + 'px'; p.el.style.height = (w * base.height / base.width) + 'px'; });
      zoomEl.textContent = Math.round(zoom * 100) + '%';
    }
    function pintar(p) {
      if (!doc || destroyed) return;
      var w = ancho();
      if (p.scale && Math.abs(p.scale - w) < 2) return;
      p.scale = w;
      var token = renderToken;
      doc.getPage(p.n).then(function (page) {
        if (destroyed || token !== renderToken) return;
        var vp1 = page.getViewport({ scale: 1 });
        var ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        var vp = page.getViewport({ scale: (w / vp1.width) * ratio });
        var canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        p.el.style.height = (w * vp1.height / vp1.width) + 'px';
        return page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport: vp }).promise.then(function () {
          if (destroyed || token !== renderToken) return;
          p.el.innerHTML = ''; p.el.appendChild(canvas);
        });
      }).catch(function () { p.scale = 0; });
    }
    function actualizarPagina() {
      if (!pages.length) return;
      var top = stage.getBoundingClientRect().top + 80, actual = 1;
      visibles.forEach(function (n) { var r = pages[n - 1].el.getBoundingClientRect(); if (r.top <= top) actual = Math.max(actual, n); });
      if (!visibles.size) return;
      if (actual === 1) actual = Math.min.apply(null, Array.from(visibles));
      pageEl.textContent = actual + ' / ' + pages.length;
      try { localStorage.setItem(claveLectura(data.id), String(actual)); } catch (_) {}
    }
    function aplicarZoom(z) {
      var antes = stage.scrollTop / Math.max(1, stage.scrollHeight);
      zoom = Math.min(2.5, Math.max(0.5, Math.round(z * 10) / 10));
      renderToken += 1;
      pages.forEach(function (p) { p.scale = 0; });
      medir();
      stage.scrollTop = antes * stage.scrollHeight;
      visibles.forEach(function (n) { pintar(pages[n - 1]); });
    }
    stage.addEventListener('scroll', function () { actualizarPagina(); }, { passive: true });
    root.querySelector('[data-rv-in]').addEventListener('click', function () { aplicarZoom(zoom + 0.2); });
    root.querySelector('[data-rv-out]').addEventListener('click', function () { aplicarZoom(zoom - 0.2); });
    var rt = null;
    window.addEventListener('resize', function onR() {
      if (destroyed) { window.removeEventListener('resize', onR); return; }
      clearTimeout(rt); rt = setTimeout(function () { aplicarZoom(zoom); }, 200);
    });
  }

  window.ICADEMResourceViewer = { open: abrir, close: cerrar };
})();
