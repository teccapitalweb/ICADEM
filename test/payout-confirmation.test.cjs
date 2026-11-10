'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  return {
    disabled: false, value: '', checked: false, files: [], isConnected: true,
    listeners: {}, attributes: {}, classList: { add() {}, remove() {} },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    focus() { this.focused = true; },
    remove() { this.removed = true; this.isConnected = false; }
  };
}

function harness(options = {}) {
  const notices = [], calls = [], downloads = [], objects = [];
  let layer;
  const reference = element(), confirmed = element(), receipt = element();
  const form = Object.assign(element(), { elements: { bankReference: reference, confirmed, receipt }, reportValidity: () => true });
  const feedback = element(), submit = element(), cancel = element();
  const controls = [reference, receipt, confirmed, cancel, submit];
  const fields = {
    '[data-amb-payment-form]': form, '[data-amb-payment-feedback]': feedback,
    '[data-amb-payment-confirm]': submit, '[data-amb-payment-cancel]': cancel
  };
  const root = { querySelectorAll: () => [], querySelector: () => null };
  const data = { ambassadors: [{ id: 'owner', name: 'Embajador de prueba' }], withdrawals: [], config: {} };
  const document = {
    activeElement: reference,
    querySelector() { return layer && !layer.removed ? layer : null; },
    body: { appendChild(node) { if (node.tag === 'a') downloads.push(node); else layer = node; } },
    createElement(tag) {
      if (tag === 'a') return Object.assign(element(), { tag, click() { this.clicked = true; } });
      return Object.assign(element(), {
        querySelector: key => fields[key],
        querySelectorAll: () => controls
      });
    }
  };
  const source = fs.readFileSync(__dirname + '/../js/icadem-ambassadors-admin.js', 'utf8').replace(
    'window.ICADEMAmbassadorsAdmin={mount:mount};',
    'window.__paymentUi={showPayConfirmation,paymentMarkup,withdrawalRows,readFile,downloadReceipt,state};window.ICADEMAmbassadorsAdmin={mount:mount};'
  );
  const context = {
    window: { dispatchEvent() {}, Toast: { success(...args) { notices.push(['success', ...args]); }, error(...args) { notices.push(['error', ...args]); } } },
    document, CustomEvent: class {}, Intl, Date, setTimeout() {},
    URL: { createObjectURL(blob) { objects.push(blob); return 'blob:private-receipt'; }, revokeObjectURL() {} },
    FileReader: class { readAsDataURL() { this.result = 'data:application/pdf;base64,JVBERi0='; this.onload(); } },
    async fetch(path, config) {
      calls.push({ path, config });
      if (options.fetch) return options.fetch(path, config);
      return { ok: true, json: async () => data };
    }
  };
  vm.runInNewContext(source, context);
  const ui = context.window.__paymentUi;
  Object.assign(ui.state, { root, data, options: { api: 'https://api.example.test', getToken: async () => 'fixture-token' } });
  return { ui, form, reference, confirmed, receipt, feedback, submit, cancel, controls, notices, calls, getLayer: () => layer, downloads, objects };
}

const withdrawal = { id: 'fixture_withdrawal', uid: 'owner', status: 'approved', amountCents: 75000, bank: 'Banco de prueba', holderName: 'Titular de prueba', bankLast4: '1234' };

test('listado distingue los tres estados y solo ofrece pago para retiros en revisión', () => {
  const { ui } = harness();
  const pending = ui.withdrawalRows([{ ...withdrawal, status: 'pending' }], []);
  const approved = ui.withdrawalRows([withdrawal], []);
  const paid = ui.withdrawalRows([{ ...withdrawal, status: 'paid', hasReceipt: true, bankReference: 'Folio-1' }], []);
  assert.match(pending, /Pendiente/); assert.doesNotMatch(pending, /data-amb-pay=/);
  assert.match(approved, /En revisión/); assert.match(approved, /Marcar como pagada/);
  assert.match(paid, /Pagada/); assert.doesNotMatch(paid, /data-amb-pay=/);
  assert.match(paid, /Folio-1/); assert.match(paid, /data-amb-receipt=/);
  assert.doesNotMatch(paid, /href=.*receipt/);
});

test('confirmación muestra importe y cuenta enmascarada, escapa datos y exige aceptación', () => {
  const { ui } = harness();
  const html = ui.paymentMarkup({ ...withdrawal, holderName: '<script>bad</script>', clabe: '012345678901234567' }, { name: '<img src=x>' });
  assert.match(html, /\$750/); assert.match(html, /•••• 1234/);
  assert.doesNotMatch(html, /012345678901234567|<script>|<img src=x>/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /name="bankReference"[^>]+required/);
  assert.match(html, /name="confirmed"[^>]+required/);
  assert.match(html, /Comprobante <span[^>]+>\(opcional\)/);
});

test('cancelar y Escape cierran sin peticiones y restauran el foco', () => {
  const h = harness(), trigger = element();
  h.ui.showPayConfirmation(withdrawal, trigger);
  h.cancel.listeners.click();
  assert.equal(h.getLayer().removed, true); assert.equal(trigger.focused, true); assert.equal(h.calls.length, 0);
  h.ui.showPayConfirmation(withdrawal, trigger);
  h.getLayer().listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(h.getLayer().removed, true); assert.equal(h.calls.length, 0);
});

test('datos incompletos no envían pago y estados no elegibles no abren la confirmación', async () => {
  const h = harness();
  h.ui.showPayConfirmation({ ...withdrawal, status: 'paid' }); assert.equal(h.getLayer(), undefined);
  h.ui.showPayConfirmation(withdrawal); h.reference.value = '   '; h.confirmed.checked = true;
  await h.form.listeners.submit({ preventDefault() {} });
  assert.equal(h.calls.length, 0); assert.match(h.feedback.textContent, /Escribe la referencia/);
  h.reference.value = 'Folio-1'; h.confirmed.checked = false;
  await h.form.listeners.submit({ preventDefault() {} }); assert.equal(h.calls.length, 0);
});

test('guarda referencia sin comprobante opcional, bloquea doble clic y no anuncia éxito antes de guardar', async () => {
  let resolvePayment;
  const waiting = new Promise(resolve => { resolvePayment = resolve; });
  const h = harness({ fetch(path, config) {
    return config.method === 'POST' ? waiting : Promise.resolve({ ok: true, json: async () => ({ config: {} }) });
  } });
  h.ui.showPayConfirmation(withdrawal); h.reference.value = '  Ref-750  '; h.confirmed.checked = true;
  const saving = h.form.listeners.submit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.length, 1); assert.equal(h.notices.length, 0);
  assert.ok(h.controls.every(control => control.disabled)); assert.equal(h.form.attributes['aria-busy'], 'true');
  h.cancel.listeners.click(); assert.notEqual(h.getLayer().removed, true);
  await h.form.listeners.submit({ preventDefault() {} }); assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(h.calls[0].config.body), { confirmed: true, bankReference: 'Ref-750' });
  resolvePayment({ ok: true, json: async () => ({ ok: true }) }); await saving;
  assert.equal(h.getLayer().removed, true); assert.equal(h.notices[0][0], 'success');
});

test('un error del servidor conserva formulario y referencia, permite reintentar y no simula éxito', async () => {
  const h = harness({ fetch: async () => ({ ok: false, status: 409, json: async () => ({ error: 'La reserva requiere revisión.' }) }) });
  h.ui.showPayConfirmation(withdrawal); h.reference.value = 'Ref-guardada'; h.confirmed.checked = true;
  await h.form.listeners.submit({ preventDefault() {} });
  assert.notEqual(h.getLayer().removed, true); assert.equal(h.reference.value, 'Ref-guardada');
  assert.ok(h.controls.every(control => !control.disabled)); assert.equal(h.notices.length, 0);
  assert.equal(h.feedback.textContent, 'La reserva requiere revisión.');
});

test('comprobante permitido se envía con confirmación, formato inválido y exceso de tamaño se rechazan', async () => {
  const h = harness();
  h.ui.showPayConfirmation(withdrawal); h.reference.value = 'Ref-PDF'; h.confirmed.checked = true;
  h.receipt.files = [{ type: 'application/pdf', size: 100 }];
  await h.form.listeners.submit({ preventDefault() {} });
  assert.match(JSON.parse(h.calls[0].config.body).receiptDataUrl, /^data:application\/pdf/);
  await assert.rejects(h.ui.readFile({ type: 'text/html', size: 100 }), /PDF, PNG o JPG/);
  await assert.rejects(h.ui.readFile({ type: 'application/pdf', size: 2 * 1024 * 1024 + 1 }), /2 MB/);
});

test('comprobante privado se descarga con autorización en vez de exponer un enlace público', async () => {
  const h = harness({ fetch: async () => ({ ok: true, blob: async () => ({ type: 'application/pdf' }) }) });
  const button = element(); await h.ui.downloadReceipt(withdrawal.id, button);
  assert.equal(h.calls[0].path, 'https://api.example.test/admin/ambassadors/withdrawals/fixture_withdrawal/receipt');
  assert.equal(h.calls[0].config.headers.Authorization, 'Bearer fixture-token');
  assert.equal(h.calls[0].config.cache, 'no-store'); assert.equal(h.downloads[0].href, 'blob:private-receipt');
  assert.equal(h.downloads[0].clicked, true); assert.equal(button.disabled, false);
});
