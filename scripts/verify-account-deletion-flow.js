'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const panel = read('vip-panel.html');
const platform = read('js/icadem-platform-v2.js');
const serviceWorker = read('sw.js');

assert.match(platform, /async function handleAccountDeleted\(\)/);
assert.match(platform, /icadem:account-deleted-signout/);
assert.match(platform, /await handleAccountDeleted\(\)/);
assert.match(platform, /error\?\.status === 410 && error\?\.data\?\.code === 'account-deleted'/);
assert.match(platform, /document\.querySelector\('\.credit-wallet-modal'\)\?\.remove\(\)/);
assert.match(platform, /window\.location\.replace\('vip-auth\.html'\)/);

for (const code of [
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found'
]) {
  assert.ok(panel.includes(code), `falta recuperar el error ${code}`);
}
assert.match(panel, /await signOut\(auth\)/);
assert.match(panel, /sessionStorage\.setItem\('icadem:account-deleted', '1'\)/);

const platformVersion = panel.match(/icadem-platform-v2\.js\?v=(\d+)/)?.[1];
assert.ok(platformVersion, 'falta versionar icadem-platform-v2.js');
assert.ok(serviceWorker.includes(`icadem-platform-v2.js?v=${platformVersion}`), 'la versión del panel y la precaché no coinciden');

console.log('OK: la cuenta eliminada sale del panel sin mostrar el error de cartera ni crear un ciclo de acceso.');
