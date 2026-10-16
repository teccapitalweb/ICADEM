'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const admin = fs.readFileSync(path.join(root, 'vip-admin.html'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'vip-panel.html'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'js', 'icadem-analytics.js'), 'utf8');
const marketing = fs.readFileSync(path.join(root, 'js', 'icadem-admin-marketing.js'), 'utf8');
const metrics = fs.readFileSync(path.join(root, 'js', 'icadem-admin-metrics.js'), 'utf8');

for (const section of ['encuestas', 'metricas', 'correos']) {
  assert.ok(admin.includes(`data-section="${section}"`) || section === 'metricas', `falta Marketing/${section}`);
}
assert.ok(admin.includes('icadem-admin-marketing.js') && admin.includes('icadem-admin-marketing.css'));
assert.ok(marketing.includes('/admin/index-experience?dias=') && marketing.includes('/admin/conversion-emails/test'));
assert.ok(marketing.includes('12 h → 12 h → 24 h'));
assert.ok(metrics.includes('data-mk-go="encuestas"') && metrics.includes('data-mk-go="correos"'));
assert.ok(panel.includes('promotionCode: offerCode || undefined'));
assert.ok(panel.includes('se aplicará automáticamente al pago'));
assert.ok(!analytics.includes('/api/trial/activity') && !analytics.includes('sendTrialActivity'));

console.log('OK: Marketing tiene Encuestas, Métricas y Correos; la campaña antigua ya no recibe actividad.');
