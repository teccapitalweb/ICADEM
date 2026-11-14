// Chat libre de Ciudad ICADEM · panel del cliente.
//
// Computadora: ventana compacta abajo a la izquierda (historial + caja de texto, Enter envía,
// C o / para escribir, Esc para volver al juego). Celular y tablet: botón de chat con aviso de
// mensajes nuevos que abre un panel arriba, sin tapar el joystick ni los botones.
//
// El navegador solo PROPONE: quién escribe, qué texto pasa y quién lo recibe lo decide el servidor
// (ver _ciudad-server/chat.js). Aquí se avisa antes de enviar con las mismas reglas, se pintan las
// burbujas sobre los avatares y se ofrecen silenciar, bloquear y reportar. El historial vive solo
// en memoria durante la sesión: no se guarda en el dispositivo.
import { checkMessage, CHAT_MAX, CHAT_HISTORY, CHAT_REASONS, CHAT_RULES, CHAT_BUBBLE_SECONDS } from '../social/chat-rules.js';
import { PHRASES } from '../social/phrases.js';

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const hue = key => { let n = 0; for (const c of String(key)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n % 360; };
const clock = at => new Date(at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export class ChatPanel {
  constructor(api, social) {
    this.api = api; this.social = social; this.net = api.net;
    this.log = []; this.rows = new Map(); this.unread = 0; this.open = false; this.state = null; this.pending = new Map(); this.seq = 0; this.view = 0; this.editRevision = 0;
    const hud = document.getElementById('hud');

    // botón (celular/tablet o ventana minimizada)
    this.fab = h('button', 'chat-fab'); this.fab.type = 'button'; this.fab.id = 'btn-chat'; this.fab.hidden = true;
    this.fab.setAttribute('aria-label', 'Abrir chat'); this.fab.append(h('span', 'chat-fab__icon', '💬'), h('span', 'chat-fab__text', 'Chat'), this.badge = h('b', 'chat-fab__badge'));
    this.badge.hidden = true;
    this.fab.addEventListener('click', e => { this.toggle(true); if (this.touch && e.detail === 0) this.box.focus({ preventScroll: true }); });

    // ventana
    this.box = h('section', 'chat'); this.box.id = 'chat'; this.box.hidden = true; this.box.setAttribute('aria-label', 'Chat de la ciudad'); this.box.tabIndex = -1;
    const head = h('header', 'chat__head');
    const title = h('div', 'chat__title'); title.append(h('strong', null, 'Chat de la ciudad'), this.sub = h('small', null, ''));
    this.menuBtn = h('button', 'chat__icon'); this.menuBtn.type = 'button'; this.menuBtn.setAttribute('aria-label', 'Opciones del chat'); this.menuBtn.textContent = '⋯';
    this.menuBtn.addEventListener('click', () => this.options());
    const close = h('button', 'chat__icon chat__close'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar chat'); close.title = 'Cerrar chat'; close.textContent = '×';
    close.addEventListener('click', () => { this.toggle(false); this.#returnFocus(); });
    head.append(title, this.menuBtn, close);
    this.list = h('ol', 'chat__log'); this.list.setAttribute('role', 'log'); this.list.setAttribute('aria-live', 'polite');
    this.gate = h('div', 'chat__gate');
    this.quick = h('div', 'chat__quick');
    PHRASES.forEach(p => { const b = h('button', null, p.text); b.type = 'button'; b.addEventListener('click', () => { this.social.say(p.id); }); this.quick.append(b); });
    this.form = h('form', 'chat__form'); this.form.autocomplete = 'off';
    this.input = h('input', 'chat__input'); this.input.type = 'text'; this.input.maxLength = CHAT_MAX; this.input.id = 'chat-input';
    this.input.setAttribute('aria-label', 'Escribe un mensaje'); this.input.setAttribute('enterkeyhint', 'send'); this.input.setAttribute('aria-describedby', 'chat-delivery'); this.input.spellcheck = true;
    this.count = h('span', 'chat__count'); this.count.hidden = true;
    this.send = h('button', 'chat__send'); this.send.type = 'submit'; this.send.setAttribute('aria-label', 'Enviar'); this.send.title = 'Enviar mensaje'; this.send.textContent = '➤';
    this.form.append(this.input, this.count, this.send);
    const footer = h('div', 'chat__delivery');
    this.notice = h('small', 'chat__notice'); this.notice.id = 'chat-delivery'; this.notice.setAttribute('role', 'status'); this.notice.setAttribute('aria-live', 'polite');
    this.afterLabel = h('label', 'chat__after'); this.after = h('input'); this.after.type = 'checkbox'; this.after.checked = true;
    this.afterLabel.append(this.after, h('span', null, 'Cerrar al enviar')); footer.append(this.notice, this.afterLabel);
    this.box.append(head, this.list, this.gate, this.quick, this.form, footer);
    hud.append(this.box, this.fab);

    this.form.addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    this.input.addEventListener('input', () => { this.editRevision++; this.#count(); if (!this.sending) this.#notice(''); });
    this.input.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); this.input.blur(); if (this.touch) { this.toggle(false); this.#returnFocus(); } } if (e.isComposing && e.key === 'Enter') e.preventDefault(); e.stopPropagation(); });
    this.input.addEventListener('compositionstart', () => { this.composing = true; });
    this.input.addEventListener('compositionend', () => { this.composing = false; });
    this.input.addEventListener('focus', () => { this.box.classList.add('is-active'); this.api.input.keys.clear(); });
    this.input.addEventListener('blur', () => { this.box.classList.remove('is-active'); this.#idle(); });
    this.box.addEventListener('pointerenter', () => this.box.classList.remove('is-idle'));
    this.box.addEventListener('pointerleave', () => this.#idle());
    // Let native button activation run, without Enter/Space also interacting or
    // jumping in the world. Input's window listener otherwise prevents it.
    const buttonKeys = e => { if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') && (e.target === this.box || e.target.closest?.('button'))) e.stopPropagation(); };
    this.box.addEventListener('keydown', buttonKeys); this.fab.addEventListener('keydown', buttonKeys);
    // Keep the keyboard until a touch button's click has actually run. Native
    // pointer focus can otherwise resize the visual viewport between down/up.
    this.box.addEventListener('pointerdown', e => { if (this.touch && e.target.closest?.('button,.chat__after')) e.preventDefault(); });
    // No backdrop: a tap on the world closes this sheet and remains usable by
    // the camera/joystick. A tap inside, on its opener or in another dialog does not.
    document.addEventListener('pointerdown', e => {
      if (this.touch && this.open && !this.api.ui.isBlocking && !this.box.contains(e.target) && !this.fab.contains(e.target)) this.toggle(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.touch && this.open && !this.api.ui.isBlocking) { this.toggle(false); this.#returnFocus(); }
    });
    const viewport = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      this.box.style.setProperty('--chat-viewport-height', height + 'px');
      this.box.style.setProperty('--chat-viewport-top', (vv ? vv.offsetTop : 0) + 'px');
      this.box.classList.toggle('is-viewport-compact', this.touch && height <= 380);
      this.box.classList.toggle('is-viewport-tight', this.touch && height <= 320);
    };
    window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport); window.addEventListener('resize', viewport); viewport();

    this.net.on('chat', m => this.#onChat(m));
    this.net.on('profile', m => { if (m.profile && m.profile.chat) { this.state = m.profile.chat; this.render(); } });
    this.net.on('status', s => this.#onStatus(s));
    this.render();
  }

  get touch() { return document.documentElement.classList.contains('is-touch') || this.api.input.touch; }
  /** ¿El servidor ofrece chat libre a esta sesión? (sin red, perfil infantil o apagado: no). */
  get available() { return Boolean(this.net.isOnline && this.net.chatAvailable); }
  get enabled() { return Boolean(this.available && this.state && this.state.enabled); }
  get sending() { return [...this.pending.values()].some(p => p.sending); }

  #returnFocus() { if (!this.fab.hidden) this.fab.focus({ preventScroll: true }); }
  #count() { const n = this.input.value.length; this.count.hidden = n < CHAT_MAX - 30; this.count.textContent = `${n}/${CHAT_MAX}`; }
  #notice(text, kind = '') { this.notice.textContent = text; this.notice.dataset.state = kind; }
  #delivery() { this.send.disabled = this.sending || !this.enabled; this.form.setAttribute('aria-busy', String(this.sending)); this.afterLabel.hidden = !this.touch || !this.enabled; }

  #idle() { clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { if (document.activeElement !== this.input) this.box.classList.add('is-idle'); }, 9000); }

  #onStatus(s) {
    if (s.status !== 'online' && this.sending) {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.sending = false; }
      this.#notice('Se perdió la conexión. Conservamos tu texto; revisa el historial antes de volver a enviarlo.', 'error');
      this.api.ui.toast('Sin conexión: no se pudo confirmar el mensaje. Tu texto sigue en el chat.', 3400);
    }
    if (s.status === 'online' && this.wasOffline && this.log.length) this.#system('Conexión recuperada.');
    this.wasOffline = s.status !== 'online';
    this.render();
  }

  /** Abre/cierra la ventana. En computadora "cerrada" = minimizada al botón. */
  toggle(force) {
    const next = force ?? !this.open; if (next !== this.open) this.view++; this.open = next;
    if (!this.open) this.input.blur();
    if (this.open) { this.unread = 0; this.minimized = false; } else if (!this.touch) this.minimized = true;
    this.render();
    if (this.open && this.enabled && !this.touch) this.input.focus({ preventScroll: true });
  }

  /** Atajo de teclado (C o /): lleva el foco a la caja de texto. */
  focus() {
    if (!this.available || this.api.ui.isBlocking) return;
    this.open = true; this.minimized = false; this.unread = 0; this.render();
    if (this.enabled) this.input.focus({ preventScroll: true }); else this.askAccept();
  }

  render() {
    const show = this.available;
    const desktopOpen = !this.touch && !this.minimized;
    this.box.hidden = !show || !(this.touch ? this.open : desktopOpen);
    this.fab.hidden = !show || (!this.touch && desktopOpen) || (this.touch && this.open);
    this.box.classList.toggle('is-sheet', this.touch);
    this.fab.setAttribute('aria-expanded', String(!this.box.hidden)); this.fab.setAttribute('aria-controls', 'chat');
    this.#delivery();
    this.badge.hidden = !this.unread; this.badge.textContent = this.unread > 9 ? '9+' : String(this.unread);
    this.fab.setAttribute('aria-label', this.unread ? `Abrir chat, ${this.unread} ${this.unread === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : 'Abrir chat');
    if (!show) return;
    const pr = this.net.presence, others = pr ? Math.max(0, pr.instance - 1) : this.net.roster.size;
    this.sub.textContent = others ? `${others} ${others === 1 ? 'persona' : 'personas'} en tu ciudad` : 'Por ahora estás solo en tu ciudad';
    // sin aceptar las normas: tarjeta para activar (las frases rápidas siguen disponibles)
    const ready = this.enabled;
    this.form.hidden = !ready; this.gate.hidden = ready;
    const paused = Boolean(this.state && this.state.accepted && this.state.off), mode = ready ? 'ready' : paused ? 'paused' : 'gate';
    if (mode !== this.gateMode) {   // solo se redibuja si cambia: un botón que se rehace a cada rato pierde toques
      this.gateMode = mode; this.gate.replaceChildren();
      if (ready) return this.#placeholder();
      this.gate.append(h('p', null, paused ? 'Pausaste el chat: no envías ni recibes mensajes libres.' : 'Escribe tus propios mensajes y conversa con otras personas de la ciudad. Solo para mayores de 18 años.'));
      const b = h('button', 'btn btn--primary', paused ? 'Reanudar chat' : 'Activar chat'); b.type = 'button';
      b.addEventListener('click', () => paused ? this.net.chat('pause', { off: false }) : this.askAccept());
      this.gate.append(b);
    }
    this.#placeholder();
  }

  #placeholder() {
    this.input.placeholder = this.touch ? 'Escribe un mensaje…' : 'Escribe un mensaje… (Enter para enviar, Esc para volver)';
  }

  /** Aceptación única (queda en la cuenta, en todos los dispositivos): mayoría de edad y normas. */
  async askAccept() {
    const api = this.api, wrap = h('div', 'chat-terms');
    wrap.append(h('p', 'chat-terms__lead', 'El chat libre es para personas adultas. Antes de activarlo, revisa las normas:'));
    const ul = h('ul', 'chat-terms__rules'); CHAT_RULES.forEach(r => ul.append(h('li', null, r))); wrap.append(ul);
    const check = (id, text) => { const l = h('label', 'chat-terms__check'), c = h('input'); c.type = 'checkbox'; c.id = id; l.append(c, h('span', null, text)); wrap.append(l); return c; };
    const adult = check('chat-adult', 'Confirmo que tengo 18 años o más.'), rules = check('chat-rules', 'Acepto las normas del chat.');
    wrap.append(h('p', 'chat-terms__note', 'Los mensajes se revisan automáticamente. Quien incumpla las normas pierde el chat por un tiempo. Puedes pausarlo cuando quieras desde ⋯.'));
    const id = await api.ui.modal({ eyebrow: 'Chat de la ciudad', title: 'Activar chat libre', content: wrap,
      actions: [{ id: 'no', label: 'Ahora no' }, { id: 'ok', label: 'Activar chat', primary: true }],
      validate: id => id === 'ok' && !(adult.checked && rules.checked) ? 'Marca las dos casillas para activar el chat.' : null });
    if (id === 'ok') this.net.chat('accept', { adult: true, rules: true });
  }

  submit() {
    const api = this.api, raw = this.input.value;
    if (this.composing || this.sending) return;
    if (!this.enabled) { this.#notice('El chat no está disponible para enviar ahora.', 'error'); return; }
    if (!raw.trim()) { this.input.blur(); return; }
    const c = checkMessage(raw);
    if (!c.ok) { const message = CHAT_REASONS[c.reason] || 'No se pudo enviar.'; this.#notice(message, 'error'); api.ui.toast(message, 2600); return; }
    const n = ++this.seq;
    const pending = { raw, text: c.text, sending: true, close: this.touch && this.after.checked, view: this.view, editRevision: this.editRevision, timer: null };
    this.pending.set(n, pending);
    this.#notice('Enviando…', 'pending'); this.#delivery();
    let sent = false; try { sent = this.net.chat('send', { text: raw, n }); } catch (_) { /* the socket may close before its status event */ }
    if (!sent) { this.pending.delete(n); this.#notice('Sin conexión. Tu mensaje sigue aquí.', 'error'); this.#delivery(); api.ui.toast('Sin conexión: el mensaje no se envió.', 2200); return; }
    // No automatic retry: this protocol has no message-idempotency operation.
    // Keep a bounded record so a late acknowledgement can still settle its text.
    if (this.pending.get(n) === pending) pending.timer = setTimeout(() => {
      pending.sending = false; this.#notice('No llegó la confirmación. Revisa el historial antes de volver a enviar.', 'error'); this.#delivery();
    }, 12000);
    if (this.pending.size > 16) { const first = this.pending.keys().next().value; clearTimeout(this.pending.get(first).timer); this.pending.delete(first); }
    if (this.touch) this.input.blur();
  }

  #onChat(m) {
    const api = this.api;
    if (m.op === 'msg') {
      if (this.social.muted.includes(m.pid)) return;
      this.#push({ id: m.id, pid: m.pid, name: m.name, text: m.text, at: m.at });
      if (m.near) this.social.bubble(m.pid, m.text, CHAT_BUBBLE_SECONDS);
      const visible = !this.box.hidden;
      if (!visible) { this.unread++; this.render(); }
      return;
    }
    if (m.op === 'send') {
      const pending = this.pending.get(m.n); if (pending) clearTimeout(pending.timer); this.pending.delete(m.n); this.#delivery();
      if (!m.ok) {
        const message = m.reason === 'restringido' && m.wait ? `${CHAT_REASONS.restringido} Podrás escribir en ${Math.ceil(m.wait / 60)} min.` : CHAT_REASONS[m.reason] || 'No se pudo enviar el mensaje.';
        if (pending && m.n === this.seq) { if (!this.input.value) this.input.value = pending.raw; this.#count(); this.#notice(message, 'error'); }
        api.ui.toast(message, 3400); return;
      }
      this.#push({ id: m.id, pid: 'me', name: 'Tú', text: m.text, at: m.at, mine: true }, Boolean(pending?.sending && m.n === this.seq));
      this.social.bubble('me', m.text, CHAT_BUBBLE_SECONDS);
      if (!m.heard) this.#system('Nadie más te lee ahora: acércate a otras personas o invita a alguien.', 'heard');
      if (pending) {
        if (m.n === this.seq && this.editRevision === pending.editRevision && this.input.value === pending.raw) this.input.value = ''; this.#count();
        if (m.n === this.seq && !this.sending) this.#notice('Mensaje enviado', 'sent');
        if (m.n === this.seq && pending.close && this.touch && this.open && pending.view === this.view && !this.input.value) this.toggle(false);
        if (m.n === this.seq && this.box.hidden) api.ui.toast('Mensaje enviado. Puedes verlo al abrir el chat.', 2400);
      }
      return;
    }
    if (m.op === 'accept' && m.ok) { api.ui.toast('Chat activado. ¡Saluda a la ciudad!', 2400); this.open = true; this.minimized = false; this.render(); if (!this.touch) setTimeout(() => this.input.focus({ preventScroll: true }), 60); }
    else if (m.op === 'pause' && m.ok) api.ui.toast(m.profile && m.profile.chat.off ? 'Chat pausado.' : 'Chat reanudado.', 2000);
    else if (m.op === 'block' && m.ok) { this.log = this.log.filter(x => x.pid !== m.pid); this.#paint(); api.ui.toast('Persona bloqueada: ya no verán sus mensajes entre ustedes.', 3000); }
    else if (m.op === 'unblock' && m.ok) api.ui.toast('Desbloqueo hecho.', 2000);
    else if (m.ok === false) api.ui.toast(CHAT_REASONS[m.reason] || 'No se pudo completar.', 3000);
  }

  #system(text, tag = null) {
    if (tag && this.log.length && this.log[this.log.length - 1].tag === tag) return;   // sin repetir el mismo aviso
    this.#push({ system: true, text, at: Date.now(), tag });
  }

  #push(entry, forceFollow = false) { if (entry.id && this.log.some(e => !e.system && e.id === entry.id)) return; this.log.push(entry); if (this.log.length > CHAT_HISTORY) this.log.shift(); this.#paint(forceFollow); this.box.classList.remove('is-idle'); this.#idle(); }

  #paint(forceFollow = false) {
    const follow = forceFollow || !this.list.clientHeight || this.list.scrollHeight - this.list.clientHeight - this.list.scrollTop <= 24;
    const scrollTop = this.list.scrollTop, kept = new Set(this.log);
    // Reading older messages must survive an arrival, including its focused
    // author button. Reuse rows instead of removing and recreating the log.
    const anchor = follow ? null : [...this.rows].find(([e, row]) => kept.has(e) && row.getBoundingClientRect().bottom > this.list.getBoundingClientRect().top)?.[1];
    const anchorTop = anchor?.getBoundingClientRect().top;
    for (const [e, row] of this.rows) if (!kept.has(e)) { row.remove(); this.rows.delete(e); }
    for (const e of this.log) {
      if (this.rows.has(e)) continue;
      const li = h('li', 'chat__row' + (e.system ? ' is-system' : '') + (e.mine ? ' is-mine' : ''));
      if (e.system) li.textContent = e.text;
      else {
        const who = h(e.mine ? 'span' : 'button', 'chat__who', e.name);
        if (!e.mine) { who.type = 'button'; who.style.setProperty('--h', hue(e.pid)); who.title = 'Opciones para ' + e.name; who.addEventListener('click', () => this.actions(e)); }
        li.append(who, h('span', 'chat__text', e.text), h('time', null, clock(e.at)));
      }
      this.rows.set(e, li); this.list.append(li);
    }
    if (follow) this.list.scrollTop = this.list.scrollHeight;
    else if (anchor) this.list.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    else this.list.scrollTop = scrollTop;
  }

  /** Silenciar (solo en este dispositivo), bloquear (en la cuenta) o reportar el mensaje. */
  async actions(e) {
    const api = this.api;
    const pick = await api.ui.choice({ speaker: e.name, text: `«${e.text}»`, options: [
      { id: 'mute', label: 'Silenciar', hint: 'Dejas de ver sus mensajes y frases en este dispositivo' },
      { id: 'block', label: 'Bloquear', hint: 'Ninguno de los dos verá los mensajes del otro, en ningún dispositivo' },
      { id: 'report', label: 'Reportar este mensaje', hint: 'Se envía a moderación con el registro del servidor' },
      { id: 'no', label: 'Cancelar' }] });
    if (pick === 'mute') {
      const s = api.store.state.settings, set = new Set(s.muted || []); set.add(e.pid); s.muted = [...set]; api.store.save();
      this.log = this.log.filter(x => x.pid !== e.pid); this.#paint(); api.ui.toast(`${e.name} quedó silenciado.`, 2200);
    } else if (pick === 'block') this.net.chat('block', { pid: e.pid });
    else if (pick === 'report') { if (this.net.report(e.pid, 'chat', e.id)) api.ui.toast('Reporte enviado a moderación. Gracias por avisar.', 2800); }
  }

  /** Menú ⋯: normas, pausa y bloqueados. */
  async options() {
    const api = this.api, st = this.state || { blocked: [] }, wrap = h('div', 'chat-terms');
    const ul = h('ul', 'chat-terms__rules'); CHAT_RULES.forEach(r => ul.append(h('li', null, r))); wrap.append(h('h4', null, 'Normas'), ul);
    wrap.append(h('h4', null, `Personas bloqueadas (${st.blocked.length})`));
    if (!st.blocked.length) wrap.append(h('p', 'chat-terms__note', 'No has bloqueado a nadie.'));
    st.blocked.forEach(b => { const r = h('div', 'players__row'), who = h('div', 'players__who'); who.append(h('strong', null, b.name)); const u = h('button', 'btn', 'Desbloquear'); u.type = 'button'; u.addEventListener('click', () => { this.net.chat('unblock', { key: b.key }); r.remove(); }); r.append(who, u); wrap.append(r); });
    if (st.accepted) wrap.append(h('h4', null, 'Privacidad'), h('p', 'chat-terms__note', 'Al pausar no envías ni recibes mensajes libres. Las frases rápidas siguen disponibles. Silenciar a alguien solo aplica en este dispositivo; bloquear aplica en toda tu cuenta.'));
    const actions = st.accepted ? [{ id: 'pause', label: st.off ? 'Reanudar chat' : 'Pausar chat' }, { id: 'ok', label: 'Cerrar', primary: true }] : undefined;
    const id = await api.ui.modal({ eyebrow: 'Chat de la ciudad', title: 'Opciones del chat', content: wrap, actions });
    if (id === 'pause') this.net.chat('pause', { off: !st.off });
  }
}
