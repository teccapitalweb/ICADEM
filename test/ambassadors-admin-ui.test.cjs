'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function ui() {
  const source = fs.readFileSync(__dirname + '/../js/icadem-ambassadors-admin.js', 'utf8')
    .replace('window.ICADEMAmbassadorsAdmin={mount:mount};', 'window.__ui={ambassadorsRows,withdrawalRows,proposalCard};window.ICADEMAmbassadorsAdmin={mount:mount};');
  const context = { window: { dispatchEvent() {} }, CustomEvent: class {}, Intl, Date };
  vm.runInNewContext(source, context);
  return context.window.__ui;
}

test('administración muestra categoría, patrocinador y contacto válido sin revelar CLABE', () => {
  const view = ui();
  const ambassador = { id: 'user1', name: 'Persona de prueba', code: 'PER-ABCDE', status: 'active', category: 'vip', sponsorCode: 'BRI-ABCDE', whatsapp: '+525512345678', stats: { attributed: 2 } };
  const row = view.ambassadorsRows([ambassador]);
  assert.match(row, /Persona de prueba/);
  assert.match(row, /BRI-ABCDE/);
  assert.match(row, /VIP/);
  assert.match(row, /https:\/\/wa\.me\/525512345678/);
  const withdrawal = view.withdrawalRows([{ id: 'w1', uid: 'user1', amountCents: 10000, bank: 'Banco', bankLast4: '1234', status: 'pending' }], [ambassador]);
  assert.match(withdrawal, /https:\/\/wa\.me\/525512345678/);
  assert.doesNotMatch(withdrawal, /CLABE interbancaria/);
});

test('la propuesta indirecta aparece desactivada con los siete niveles y presupuesto', () => {
  const html = ui().proposalCard({ indirectProposal: { enabled: false, vipCents: [2000,1000,500,300,200,100], freeCents: [1000,500,300,200,100,100], maxTotalMonthlyCents: 0, maxTotalAnnualCents: 0 } });
  assert.match(html, /no se generan ni pagan comisiones indirectas/);
  assert.match(html, /Nivel 7 VIP/);
  assert.match(html, /Presupuesto máximo mensual/);
  assert.doesNotMatch(html, /name="enabled"/);
});
