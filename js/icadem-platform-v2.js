/* ICADEM · identidad y aprendizaje v2
   La identidad y los premios se validan en el backend. Este archivo conserva
   los renderizadores históricos del panel y añade una capa progresiva. */
(function () {
  'use strict';
  window.__platformV2LoadedAt = Date.now();

  const API = window.WEBHOOK_URL || 'https://icadem-webhook-production.up.railway.app';
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const GAME_LABELS = {
    crossword: 'Crucigrama', memory: 'Memoria', wordsearch: 'Sopa de letras',
    puzzle: 'Rompecabezas', guess: 'Adivina el concepto', classify: 'Clasifica'
  };
  const GAME_ICONS = {
    crossword: '⌗', memory: '◫', wordsearch: '⌕', puzzle: '◇', guess: '?', classify: '≡'
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f\s]/g, '').toUpperCase();
  }

  function initials(value) {
    const parts = String(value || '').trim().split(/[\s@.]+/).filter(Boolean);
    return `${parts[0]?.[0] || 'I'}${parts[1]?.[0] || parts[0]?.[1] || 'N'}`.toUpperCase();
  }

  async function token() {
    const user = window.__auth?.currentUser || window.__currentUser;
    return user ? user.getIdToken() : '';
  }

  async function request(path, options) {
    const authToken = await token();
    const config = { method: options?.method || 'GET', headers: { Accept: 'application/json' } };
    if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
    if (options?.body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(options.body);
    }
    const response = await fetch(`${API}${path}`, config);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'No pudimos completar la solicitud.');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function announce(message) {
    let live = document.getElementById('icadem-platform-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'icadem-platform-live';
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
  }

  function showNotice(title, message, kind) {
    const old = document.querySelector('.platform-notice');
    old?.remove();
    const el = document.createElement('div');
    el.className = `platform-notice platform-notice--${kind || 'info'}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<strong>${esc(title)}</strong><span>${esc(message || '')}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function applyIdentity(payload) {
    if (!payload?.profile || !window.UserState) return;
    const profile = payload.profile;
    const directory = payload.directory || {};
    const state = window.UserState;
    state.nombre = profile.displayName || state.nombre;
    state.displayName = state.nombre;
    state.photoURL = profile.photoURL || directory.foto || '';
    state.iniciales = directory.iniciales || initials(state.nombre);
    state.providerIds = profile.providerIds || [];
    state.credits = payload.credits || state.credits || { balance: 0 };
    state.directoryProfile = directory;
    if (payload.membership?.active && state.modo !== 'vip') state.modo = 'vip';

    const paintAvatar = element => {
      if (!element) return;
      element.classList.toggle('has-photo', Boolean(state.photoURL));
      element.innerHTML = state.photoURL
        ? `<img src="${esc(state.photoURL)}" alt="Foto de ${esc(state.nombre)}" referrerpolicy="no-referrer">`
        : esc(state.iniciales);
    };
    document.querySelectorAll('.avatar__circle,.perfil-hero__avatar,.foro-composer__avatar').forEach(paintAvatar);
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = state.nombre; });
    document.querySelectorAll('[data-credit-balance]').forEach(el => { el.textContent = String(state.credits.balance || 0); });
    window.__applyUserState?.();
    document.dispatchEvent(new CustomEvent('icadem:identity-ready', { detail: payload }));
  }

  let identityPromise = null;
  async function syncIdentity(force) {
    if (window.__isDemoMode) return null;
    if (identityPromise && !force) return identityPromise;
    identityPromise = request('/api/identity/sync', { method: 'POST', body: {} })
      .then(data => { applyIdentity(data); return data; })
      .catch(error => {
        console.warn('[ICADEM identity]', error.message);
        identityPromise = null;
        return null;
      });
    return identityPromise;
  }

  async function loadDirectory(filters) {
    const params = new URLSearchParams({ pageSize: '100', ...(filters || {}) });
    const data = await request(`/api/directory?${params}`);
    return data.items || [];
  }

  async function loadRanking() {
    const data = await request('/api/ranking');
    return data;
  }

  async function saveProfile(profile) {
    const data = await request('/api/profile', { method: 'PATCH', body: profile });
    applyIdentity(data);
    return data;
  }

  function localChallenge(type, title) {
    const selected = type || ['crossword', 'memory', 'wordsearch', 'puzzle', 'guess', 'classify'][Math.floor(Math.random() * 6)];
    const words = ['CRITERIO', 'PROCESO', 'CONTROL'];
    const pairs = [
      { id: 'a', left: 'Criterio', right: 'Decidir con fundamento' },
      { id: 'b', left: 'Proceso', right: 'Secuencia ordenada de acciones' },
      { id: 'c', left: 'Control', right: 'Medida que reduce errores' }
    ];
    const local = {
      ok: true, local: true, challengeId: `practice-${Date.now()}`, type: selected,
      title: title || GAME_LABELS[selected], objective: 'Resuelve la actividad y comprueba tu criterio.',
      instructions: ['Observa la consigna', 'Resuelve con calma', 'Comprueba tu respuesta'], reward: 5,
      balance: Number(localStorage.getItem('icadem:demo:credits') || 0)
    };
    if (selected === 'crossword' || selected === 'guess') {
      local.content = { clue: 'Capacidad de decidir con fundamento', length: 8, maxAttempts: 3 };
      local.solution = { answer: 'CRITERIO' };
    } else if (selected === 'memory') {
      local.content = { pairs };
      local.solution = { pairs: pairs.map(p => p.id).sort() };
    } else if (selected === 'classify') {
      const assignments = { c1: 'Concepto', a1: 'Aplicación', c2: 'Concepto', a2: 'Aplicación' };
      local.content = { categories: ['Concepto', 'Aplicación'], items: [
        { id: 'a1', label: 'Comparar registros para explicar diferencias' },
        { id: 'c2', label: 'Flujo de efectivo' },
        { id: 'c1', label: 'Conciliación' },
        { id: 'a2', label: 'Medir entradas y salidas de dinero' }
      ] };
      local.solution = { assignments };
    } else if (selected === 'puzzle') {
      local.content = { size: 3, title: title || 'Criterio profesional', image: '' };
      local.solution = { order: [0,1,2,3,4,5,6,7,8] };
    } else {
      const size = 11;
      const grid = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => 'ABCDEFGHIJ'[(row * 3 + col * 7) % 10]));
      words.forEach((word, index) => {
        const row = 1 + index * 3;
        [...word].forEach((letter, col) => { grid[row][col + 1] = letter; });
      });
      local.content = { grid, words, size };
      local.solution = { words: words.slice().sort() };
    }
    return local;
  }

  function modalShell(challenge, onClose) {
    document.querySelector('.learning-game')?.remove();
    const modal = document.createElement('div');
    modal.className = 'learning-game';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'learning-game-title');
    modal.innerHTML = `
      <div class="learning-game__veil"></div>
      <section class="learning-game__panel">
        <header class="learning-game__header">
          <div class="learning-game__brand"><span>ICADEM</span><small>Actividad de cierre</small></div>
          <div class="learning-game__step" aria-label="Progreso"><i class="is-current"></i><i></i><i></i></div>
          <button class="learning-game__close" type="button" aria-label="Cerrar actividad">×</button>
        </header>
        <div class="learning-game__content" id="learning-game-content"></div>
      </section>`;
    document.body.appendChild(modal);
    document.body.classList.add('has-learning-game');
    const close = () => {
      modal.remove();
      document.body.classList.remove('has-learning-game');
      onClose?.();
    };
    modal.querySelector('.learning-game__close').addEventListener('click', close);
    modal.querySelector('.learning-game__close').focus();
    return { modal, content: modal.querySelector('#learning-game-content'), close };
  }

  function setStep(modal, step) {
    modal.querySelectorAll('.learning-game__step i').forEach((el, index) => {
      el.classList.toggle('is-current', index === step - 1);
      el.classList.toggle('is-done', index < step - 1);
    });
  }

  function introView(challenge, shell, start) {
    const typeLabel = GAME_LABELS[challenge.type] || 'Actividad';
    shell.content.innerHTML = `
      <div class="game-intro">
        <span class="game-intro__icon" aria-hidden="true">${GAME_ICONS[challenge.type] || '◇'}</span>
        <span class="game-kicker">${esc(typeLabel)}</span>
        <h2 id="learning-game-title">${esc(challenge.title || 'Cierre de clase')}</h2>
        <p>${esc(challenge.objective || 'Completa la actividad para continuar.')}</p>
        <ol>${(challenge.instructions || []).slice(0, 3).map((line, i) => `<li><b>0${i + 1}</b><span>${esc(line)}</span></li>`).join('')}</ol>
        <div class="game-intro__reward"><span>Recompensa</span><strong>${challenge.reward ? `+${challenge.reward} créditos` : 'Práctica libre'}</strong></div>
        <button class="game-primary" type="button" data-game-start>Comenzar</button>
      </div>`;
    shell.content.querySelector('[data-game-start]').addEventListener('click', start);
  }

  function gameFrame(challenge, shell, inner) {
    setStep(shell.modal, 2);
    shell.content.innerHTML = `
      <div class="game-run">
        <div class="game-run__heading">
          <span class="game-kicker">${esc(GAME_LABELS[challenge.type])}</span>
          <h2 id="learning-game-title">${esc(challenge.title)}</h2>
        </div>
        <div class="game-status" aria-live="polite"></div>
        <div class="game-board">${inner}</div>
        <div class="game-actions"><button class="game-secondary" type="button" data-game-reset>Reiniciar</button><button class="game-primary" type="button" data-game-check>Comprobar</button></div>
      </div>`;
    return {
      board: shell.content.querySelector('.game-board'),
      status: shell.content.querySelector('.game-status'),
      check: shell.content.querySelector('[data-game-check]'),
      reset: shell.content.querySelector('[data-game-reset]')
    };
  }

  function runTextGame(challenge, shell, submit) {
    const c = challenge.content || {};
    const frame = gameFrame(challenge, shell, `
      <div class="concept-game">
        <span class="concept-game__label">Pista</span>
        <blockquote>${esc(c.clue || 'Concepto central de la clase')}</blockquote>
        <label for="concept-answer">Tu respuesta · ${Number(c.length) || ''} letras</label>
        <input id="concept-answer" autocomplete="off" autocapitalize="characters" maxlength="40" placeholder="Escribe el concepto">
        <div class="concept-game__slots" aria-hidden="true">${Array.from({length: Math.min(14, Number(c.length) || 8)}, () => '<i></i>').join('')}</div>
      </div>`);
    const input = frame.board.querySelector('input');
    frame.check.addEventListener('click', () => submit({ answer: input.value }, frame));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') frame.check.click(); });
    frame.reset.addEventListener('click', () => { input.value = ''; frame.status.textContent = ''; input.focus(); });
    input.focus();
  }

  function runMemory(challenge, shell, submit) {
    const cards = [];
    (challenge.content?.pairs || []).forEach(pair => {
      cards.push({ key: `${pair.id}-left`, id: pair.id, text: pair.left });
      cards.push({ key: `${pair.id}-right`, id: pair.id, text: pair.right });
    });
    cards.sort(() => Math.random() - .5);
    const frame = gameFrame(challenge, shell, `<div class="memory-grid">${cards.map(card => `<button type="button" class="memory-card" data-key="${esc(card.key)}" data-pair="${esc(card.id)}" aria-label="Carta oculta"><span class="memory-card__back">ICA</span><span class="memory-card__front">${esc(card.text)}</span></button>`).join('')}</div>`);
    let open = [], matched = [];
    frame.board.querySelectorAll('.memory-card').forEach(card => card.addEventListener('click', () => {
      if (card.classList.contains('is-open') || card.classList.contains('is-matched') || open.length === 2) return;
      card.classList.add('is-open'); card.setAttribute('aria-label', card.textContent.trim()); open.push(card);
      if (open.length === 2) {
        if (open[0].dataset.pair === open[1].dataset.pair) {
          const id = open[0].dataset.pair;
          setTimeout(() => { open.forEach(x => x.classList.add('is-matched')); matched.push(id); open = []; announce('Pareja encontrada'); }, 260);
        } else setTimeout(() => { open.forEach(x => x.classList.remove('is-open')); open = []; }, 650);
      }
    }));
    frame.check.addEventListener('click', () => submit({ pairs: [...new Set(matched)] }, frame));
    frame.reset.addEventListener('click', () => runMemory(challenge, shell, submit));
  }

  function wordAt(grid, start, end) {
    const dr = Math.sign(end[0] - start[0]), dc = Math.sign(end[1] - start[1]);
    const distance = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]));
    if (!dr && !dc) return { word: grid[start[0]][start[1]], cells: [start.join('-')] };
    if (dr && dc && Math.abs(end[0] - start[0]) !== Math.abs(end[1] - start[1])) return null;
    if (!dr && start[0] !== end[0] || !dc && start[1] !== end[1]) return null;
    const cells = [], chars = [];
    for (let i = 0; i <= distance; i++) { const r = start[0] + dr * i, c = start[1] + dc * i; cells.push(`${r}-${c}`); chars.push(grid[r][c]); }
    return { word: chars.join(''), cells };
  }

  function runWordsearch(challenge, shell, submit) {
    const grid = challenge.content?.grid || [];
    const words = challenge.content?.words || [];
    const frame = gameFrame(challenge, shell, `
      <div class="wordsearch"><div class="wordsearch__list">${words.map(w => `<span data-word="${esc(w)}">${esc(w)}</span>`).join('')}</div>
      <div class="wordsearch__grid" style="--grid:${grid.length || 10}">${grid.flatMap((row,r) => row.map((letter,c) => `<button type="button" data-cell="${r}-${c}" aria-label="Fila ${r+1}, columna ${c+1}, ${esc(letter)}">${esc(letter)}</button>`)).join('')}</div></div>`);
    let start = null, found = [];
    const select = cell => {
      const pos = cell.dataset.cell.split('-').map(Number);
      if (!start) { start = pos; cell.classList.add('is-start'); return; }
      const result = wordAt(grid, start, pos); start = null;
      frame.board.querySelectorAll('.is-start').forEach(x => x.classList.remove('is-start'));
      if (!result) { frame.status.textContent = 'Elige una línea horizontal, vertical o diagonal.'; return; }
      const forward = normalize(result.word), backward = [...forward].reverse().join('');
      const match = words.find(w => !found.includes(w) && (normalize(w) === forward || normalize(w) === backward));
      if (!match) { frame.status.textContent = 'Esa secuencia no corresponde a un término pendiente.'; return; }
      found.push(match); result.cells.forEach(id => frame.board.querySelector(`[data-cell="${id}"]`)?.classList.add('is-found'));
      frame.board.querySelector(`[data-word="${CSS.escape(match)}"]`)?.classList.add('is-found');
      frame.status.textContent = `${found.length} de ${words.length} términos encontrados.`;
    };
    let dragStart = null, suppressClick = false;
    frame.board.querySelectorAll('[data-cell]').forEach(cell => cell.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      select(cell);
    }));
    const gridEl = frame.board.querySelector('.wordsearch__grid');
    gridEl.addEventListener('pointerdown', event => {
      const cell = event.target.closest('[data-cell]');
      if (cell) dragStart = cell.dataset.cell.split('-').map(Number);
    });
    gridEl.addEventListener('pointerup', event => {
      const endCell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]');
      if (!dragStart || !endCell || dragStart.join('-') === endCell.dataset.cell) { dragStart = null; return; }
      start = dragStart; dragStart = null; suppressClick = true; select(endCell);
    });
    frame.check.addEventListener('click', () => submit({ words: found.slice().sort() }, frame));
    frame.reset.addEventListener('click', () => runWordsearch(challenge, shell, submit));
  }

  function runPuzzle(challenge, shell, submit) {
    const size = Number(challenge.content?.size) || 3;
    const order = Array.from({ length: size * size }, (_, i) => i).sort(() => Math.random() - .5);
    if (order.every((n, i) => n === i)) [order[0], order[1]] = [order[1], order[0]];
    const image = challenge.content?.image || '';
    const frame = gameFrame(challenge, shell, `<div class="puzzle-grid" style="--puzzle-size:${size}"></div><p class="game-hint">Toca dos piezas para intercambiarlas.</p>`);
    let selected = null;
    const paint = () => {
      const grid = frame.board.querySelector('.puzzle-grid');
      grid.innerHTML = order.map((piece, pos) => {
        const x = (piece % size) * 100 / Math.max(1, size - 1), y = Math.floor(piece / size) * 100 / Math.max(1, size - 1);
        const style = image ? `background-image:url('${encodeURI(image).replace(/'/g,'%27')}');background-position:${x}% ${y}%;background-size:${size * 100}% ${size * 100}%` : '';
        return `<button type="button" data-pos="${pos}" class="puzzle-piece${selected === pos ? ' is-selected' : ''}" style="${style}" aria-label="Pieza ${piece + 1}">${image ? '' : piece + 1}</button>`;
      }).join('');
      grid.querySelectorAll('[data-pos]').forEach(btn => btn.addEventListener('click', () => {
        const pos = Number(btn.dataset.pos);
        if (selected == null) selected = pos;
        else { [order[selected], order[pos]] = [order[pos], order[selected]]; selected = null; }
        paint();
      }));
    };
    paint();
    frame.check.addEventListener('click', () => submit({ order }, frame));
    frame.reset.addEventListener('click', () => runPuzzle(challenge, shell, submit));
  }

  function runClassify(challenge, shell, submit) {
    const content = challenge.content || { categories: [], items: [] };
    const assignments = {};
    const frame = gameFrame(challenge, shell, `
      <div class="classify"><div class="classify__items">${(content.items || []).map(item => `<button type="button" draggable="true" data-item="${esc(item.id)}">${esc(item.label)}</button>`).join('')}</div>
      <div class="classify__zones">${(content.categories || []).map(cat => `<section data-category="${esc(cat)}"><h3>${esc(cat)}</h3><div></div></section>`).join('')}</div></div>`);
    let selected = null;
    const assign = (item, category) => {
      assignments[item.dataset.item] = category;
      const zone = frame.board.querySelector(`[data-category="${CSS.escape(category)}"] div`);
      zone.appendChild(item); item.classList.add('is-assigned'); selected = null;
      frame.status.textContent = `${Object.keys(assignments).length} de ${content.items.length} tarjetas clasificadas.`;
    };
    frame.board.querySelectorAll('[data-item]').forEach(item => {
      item.addEventListener('click', () => { selected = item; frame.board.querySelectorAll('[data-item]').forEach(x => x.classList.toggle('is-selected', x === item)); });
      item.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', item.dataset.item));
    });
    frame.board.querySelectorAll('[data-category]').forEach(zone => {
      zone.addEventListener('click', () => { if (selected) assign(selected, zone.dataset.category); });
      zone.addEventListener('dragover', event => event.preventDefault());
      zone.addEventListener('drop', event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const item = frame.board.querySelector(`[data-item="${CSS.escape(id)}"]`); if (item) assign(item, zone.dataset.category); });
    });
    frame.check.addEventListener('click', () => submit({ assignments }, frame));
    frame.reset.addEventListener('click', () => runClassify(challenge, shell, submit));
  }

  function successView(challenge, shell, result, onComplete, onContinue) {
    setStep(shell.modal, 3);
    onComplete?.(result);
    const previous = Number(result.previousBalance ?? challenge.balance ?? 0);
    const reward = Number(result.reward ?? challenge.reward ?? 0);
    const next = Number(result.newBalance ?? previous + reward);
    shell.content.innerHTML = `
      <div class="game-success">
        <span class="game-kicker">Actividad superada</span>
        <h2 id="learning-game-title">${challenge.scope === 'reto' ? 'Reto superado' : 'Clase completada'}</h2>
        <p>${challenge.scope === 'reto' ? 'Tu resultado y tus créditos ya quedaron guardados.' : 'Tu avance ya quedó guardado.'}</p>
        <button class="reward-chest" type="button" data-open-chest aria-label="Abrir recompensa"><span class="reward-chest__lid"></span><span class="reward-chest__box">ICA</span></button>
        <div class="reward-summary" hidden>
          <span>Recompensa</span><strong>+<b data-reward-count>0</b> créditos</strong>
          <div><small>Saldo anterior <b>${previous}</b></small><i>→</i><small>Nuevo saldo <b>${next}</b></small></div>
        </div>
        <button class="game-primary" type="button" data-game-continue disabled>${result.nextLessonNumber ? 'Continuar a la siguiente clase' : (challenge.scope === 'reto' ? 'Volver a Retos' : 'Volver al curso')}</button>
      </div>`;
    const chest = shell.content.querySelector('[data-open-chest]');
    const summary = shell.content.querySelector('.reward-summary');
    const continueButton = shell.content.querySelector('[data-game-continue]');
    chest.addEventListener('click', () => {
      if (chest.classList.contains('is-open')) return;
      chest.classList.add('is-open'); summary.hidden = false; continueButton.disabled = false;
      const counter = shell.content.querySelector('[data-reward-count]');
      if (REDUCED_MOTION?.matches || reward <= 0) counter.textContent = String(reward);
      else {
        let value = 0;
        const interval = setInterval(() => { value += 1; counter.textContent = String(Math.min(reward, value)); if (value >= reward) clearInterval(interval); }, 110);
      }
      if (window.UserState?.credits) window.UserState.credits.balance = next;
      document.querySelectorAll('[data-credit-balance]').forEach(el => { el.textContent = String(next); });
      announce(`Ganaste ${reward} créditos. Nuevo saldo: ${next}.`);
    });
    continueButton.addEventListener('click', () => { shell.close(); onContinue?.(result); });
    chest.focus();
  }

  function startChallenge(challenge, options) {
    return new Promise(resolve => {
      const shell = modalShell(challenge, () => resolve({ closed: true }));
      const submit = async (proof, frame) => {
        frame.check.disabled = true;
        frame.status.textContent = 'Comprobando…';
        try {
          let result;
          if (challenge.local) {
            let correct = false;
            if (challenge.type === 'crossword' || challenge.type === 'guess') correct = normalize(proof.answer) === challenge.solution.answer;
            else if (challenge.type === 'memory') correct = JSON.stringify((proof.pairs || []).slice().sort()) === JSON.stringify(challenge.solution.pairs);
            else if (challenge.type === 'wordsearch') correct = JSON.stringify((proof.words || []).slice().sort()) === JSON.stringify(challenge.solution.words);
            else if (challenge.type === 'puzzle') correct = JSON.stringify(proof.order || []) === JSON.stringify(challenge.solution.order);
            else if (challenge.type === 'classify') correct = Object.keys(challenge.solution.assignments).every(key => proof.assignments?.[key] === challenge.solution.assignments[key]);
            if (!correct) { const error = new Error('Aún no está correcto. Revisa la actividad e inténtalo otra vez.'); error.status = 422; throw error; }
            const previousBalance = Number(localStorage.getItem('icadem:demo:credits') || challenge.balance || 0);
            const reward = Number(challenge.reward) || 5;
            const newBalance = previousBalance + reward;
            localStorage.setItem('icadem:demo:credits', String(newBalance));
            result = { ok: true, reward, previousBalance, newBalance, nextLessonNumber: null, practice: true };
          } else result = await request(challenge.completePath || '/api/learning/complete', { method: 'POST', body: { challengeId: challenge.challengeId, proof } });
          successView(challenge, shell, result, options?.onComplete, resultData => { options?.onContinue?.(resultData); resolve(resultData); });
        } catch (error) {
          frame.status.textContent = error.message;
          frame.status.classList.add('is-error');
          frame.check.disabled = false;
          if (error.status !== 422) showNotice('No se perdió tu avance', 'Revisa tu conexión y vuelve a comprobar.', 'error');
        }
      };
      const start = () => {
        if (challenge.type === 'memory') runMemory(challenge, shell, submit);
        else if (challenge.type === 'wordsearch') runWordsearch(challenge, shell, submit);
        else if (challenge.type === 'puzzle') runPuzzle(challenge, shell, submit);
        else if (challenge.type === 'classify') runClassify(challenge, shell, submit);
        else runTextGame(challenge, shell, submit);
      };
      introView(challenge, shell, start);
    });
  }

  async function startLessonChallenge(options) {
    const courseId = String(options?.courseId || '');
    const lessonNumber = Number(options?.lessonNumber);
    let challenge;
    try {
      if (window.__isDemoMode) {
        const types = Object.keys(GAME_LABELS);
        let hash = 0; for (const char of `${courseId}:${lessonNumber}`) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        challenge = localChallenge(types[Math.abs(hash) % types.length], options?.title || `Clase ${lessonNumber}`);
      }
      else challenge = await request('/api/learning/challenge', { method: 'POST', body: {
        courseId, lessonNumber, legacyCompletedLessons: options?.legacyCompletedLessons || []
      }});
      return startChallenge(challenge, options);
    } catch (error) {
      showNotice('No pudimos abrir la actividad', error.message, 'error');
      throw error;
    }
  }

  async function startRetoChallenge(options) {
    const type = options?.type === 'pulse' ? 'guess' : String(options?.type || 'guess');
    const experienceId = String(options?.experienceId || type);
    let challenge;
    try {
      if (window.__isDemoMode) {
        challenge = localChallenge(type, options?.title || GAME_LABELS[type]);
        challenge.scope = 'reto';
        challenge.experienceId = experienceId;
      } else {
        challenge = await request('/api/retos/challenge', {
          method: 'POST',
          body: { experienceId, gameType: type }
        });
      }
      challenge.scope = 'reto';
      challenge.completePath = challenge.completePath || '/api/retos/complete';
      return startChallenge(challenge, {
        onComplete: result => {
          options?.onComplete?.(result);
          document.dispatchEvent(new CustomEvent('icadem:reto-completed', { detail: result }));
          const page = document.querySelector('.retos-page');
          if (page) mountRetosStatus(page);
        },
        onContinue: result => {
          options?.onContinue?.(result);
          const page = document.querySelector('.retos-page');
          if (page) mountRetosStatus(page);
        }
      });
    } catch (error) {
      const alreadyPlayed = error.data?.code === 'reto-already-played';
      showNotice(alreadyPlayed ? 'Reto ya completado' : 'No pudimos abrir el reto', error.message, alreadyPlayed ? 'info' : 'error');
      throw error;
    }
  }

  function openPractice(type, title) {
    return startRetoChallenge({ experienceId: 'catalog', type, title });
  }

  function openPracticePicker() {
    const existing = document.querySelector('.practice-picker'); existing?.remove();
    const root = document.createElement('div'); root.className = 'practice-picker'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="practice-picker__box"><button type="button" class="practice-picker__close" aria-label="Cerrar">×</button><span class="game-kicker">Juegos ICADEM</span><h2>Elige cómo practicar</h2><p>Seis dinámicas breves con contenido profesional.</p><div>${Object.keys(GAME_LABELS).map(type => `<button type="button" data-practice="${type}"><span>${GAME_ICONS[type]}</span><strong>${GAME_LABELS[type]}</strong></button>`).join('')}</div></div>`;
    document.body.appendChild(root); document.body.classList.add('has-learning-game');
    root.querySelector('.practice-picker__close').addEventListener('click', () => { root.remove(); document.body.classList.remove('has-learning-game'); });
    root.querySelectorAll('[data-practice]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.practice;
      root.remove();
      document.body.classList.remove('has-learning-game');
      startRetoChallenge({ experienceId: 'catalog', type, title: GAME_LABELS[type] }).catch(() => {});
    }));
  }

  async function mountRetosStatus(target) {
    const root = typeof target === 'string' ? document.getElementById(target) : target;
    if (!root) return;
    let data;
    if (window.__isDemoMode) {
      data = { isAdmin: false, used: [], dailyUsedToday: false, catalogUsedCount: 0, balance: Number(localStorage.getItem('icadem:demo:credits') || 0), reward: 5 };
    } else {
      try { data = await request('/api/retos/status'); }
      catch (error) {
        root.querySelector('[data-retos-access]')?.replaceChildren(document.createTextNode('Estado no disponible'));
        return;
      }
    }
    document.querySelectorAll('[data-credit-balance]').forEach(el => { el.textContent = String(data.balance || 0); });
    const used = new Set(data.used || []);
    root.querySelectorAll('[data-reto-key]').forEach(card => {
      const key = card.dataset.retoKey;
      const isCatalog = key === 'catalog';
      const completed = !data.isAdmin && (isCatalog ? Number(data.catalogUsedCount) >= 6 : key === 'daily' ? data.dailyUsedToday : used.has(key));
      card.classList.toggle('is-used', completed);
      card.setAttribute('aria-disabled', completed ? 'true' : 'false');
      const state = card.querySelector('[data-card-state]');
      if (state && isCatalog && !completed && Number(data.catalogUsedCount) > 0) {
        state.innerHTML = `<span>6 juegos</span><span>${Number(data.catalogUsedCount)}/6 completados</span>`;
      }
      const cta = card.querySelector('.retos-tile__cta');
      if (cta && completed) cta.innerHTML = 'Ya completado <span aria-hidden="true">✓</span>';
    });
    const access = root.querySelector('[data-retos-access]');
    if (access) access.textContent = data.isAdmin ? 'Administrador · intentos ilimitados' : 'Un intento por reto';
  }

  async function mountRanking(target) {
    const root = typeof target === 'string' ? document.getElementById(target) : target;
    if (!root) return;
    root.innerHTML = '<div class="ranking-loading">Cargando clasificación…</div>';
    try {
      const data = window.__isDemoMode ? {
        currentUid: 'demo',
        items: [
          { position: 1, uid: 'demo-1', nombre: 'Mariana López', iniciales: 'ML', nivel: 'Profesional', xp: 860, isVip: true },
          { position: 2, uid: 'demo-2', nombre: 'Carlos Méndez', iniciales: 'CM', nivel: 'Técnico', xp: 620, isVip: true },
          { position: 3, uid: 'demo', nombre: 'Tu posición', iniciales: 'TÚ', nivel: 'Aprendiz', xp: 0, isVip: false }
        ]
      } : await loadRanking();
      const current = data.currentUid;
      const items = data.items || [];
      root.innerHTML = `<section class="ranking-card"><header><div><span class="game-kicker">Comunidad ICADEM</span><h2>Clasificación</h2></div><small>XP verificado</small></header><div class="ranking-list">${items.slice(0, 10).map(item => `<article class="ranking-row${item.uid === current ? ' is-me' : ''}"><b class="ranking-row__pos">${item.position}</b><span class="ranking-row__avatar">${item.foto ? `<img src="${esc(item.foto)}" alt="">` : esc(item.iniciales)}</span><span class="ranking-row__name"><strong>${esc(item.nombre)}</strong><small>${esc(item.nivel)}${item.isVip ? ' · VIP' : ''}</small></span><strong class="ranking-row__xp">${item.xp} XP</strong></article>`).join('') || '<p class="ranking-empty">Aún no hay actividad para mostrar.</p>'}</div></section>`;
    } catch (error) {
      root.innerHTML = `<div class="ranking-error"><strong>No pudimos cargar la clasificación.</strong><button type="button">Reintentar</button></div>`;
      root.querySelector('button')?.addEventListener('click', () => mountRanking(root));
    }
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-platform-game]');
    if (!trigger) return;
    event.preventDefault();
    if (trigger.getAttribute('aria-disabled') === 'true') {
      showNotice('Reto ya completado', 'Cada usuario puede superar este reto una sola vez.', 'info');
      return;
    }
    const type = trigger.dataset.platformGame;
    if (type === 'catalog') openPracticePicker();
    else startRetoChallenge({
      experienceId: trigger.dataset.retoKey || type,
      type,
      title: trigger.dataset.gameTitle || trigger.textContent.trim()
    }).catch(() => {});
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-lesson-complete]');
    if (!button || button.classList.contains('is-complete') || button.dataset.gameBusy === '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const courseId = button.dataset.courseId;
    const lessonNumber = Number(button.dataset.lessonNumber);
    const nextIndex = Number(button.dataset.nextIndex);
    if (!courseId || !lessonNumber) return;
    let legacyCompletedLessons = [];
    try {
      const uid = window.UserState?.uid || 'demo';
      const progress = JSON.parse(localStorage.getItem(`icadem_progress_${uid}`) || '{}');
      legacyCompletedLessons = progress[courseId]?.clasesVistas || [];
    } catch (_) {}
    button.dataset.gameBusy = '1';
    button.disabled = true;
    button.textContent = 'Preparando actividad…';
    startLessonChallenge({
      courseId,
      lessonNumber,
      title: button.dataset.lessonTitle || `Clase ${lessonNumber}`,
      legacyCompletedLessons,
      onComplete: () => window.marcarClaseVista?.(courseId, lessonNumber),
      onContinue: () => {
        if (nextIndex >= 0) window.abrirClaseICADEM?.(courseId, nextIndex);
        else window.__volverACurso?.(courseId);
      }
    }).then(result => {
      if (!result?.closed || !button.isConnected) return;
      button.dataset.gameBusy = '';
      button.disabled = false;
      button.textContent = 'Marcar vista y seguir';
    }).catch(() => {
      button.dataset.gameBusy = '';
      button.disabled = false;
      button.textContent = 'Marcar vista y seguir';
    });
  }, true);
  document.addEventListener('keydown', event => {
    const trigger = event.target.closest?.('[data-platform-game]');
    if (!trigger || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault(); trigger.click();
  });
  document.addEventListener('icadem:user-ready', () => syncIdentity());
  if (window.__currentUser) syncIdentity();

  window.ICADEMPlatform = {
    request, syncIdentity, applyIdentity, loadDirectory, loadRanking, mountRanking,
    saveProfile, startLessonChallenge, startRetoChallenge, openPractice, openPracticePicker, mountRetosStatus
  };
})();
