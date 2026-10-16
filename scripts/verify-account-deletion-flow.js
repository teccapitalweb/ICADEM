'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const panel = read('vip-panel.html');
const auth = read('vip-auth.html');
const platform = read('js/icadem-platform-v2.js');
const serviceWorker = read('sw.js');

assert.match(platform, /async function handleAccountDeleted\(\)/);
assert.match(platform, /await handleAccountDeleted\(\)/);
assert.match(platform, /error\?\.status === 410 && error\?\.data\?\.code === 'account-deleted'/);
assert.match(platform, /cache: 'no-store'/);
assert.match(platform, /await user\.getIdToken\(true\)/);
assert.match(platform, /method === 'GET' && response\.status === 410/);
assert.match(platform, /document\.querySelector\('\.credit-wallet-modal'\)\?\.remove\(\)/);
assert.match(platform, /window\.location\.replace\('vip-auth\.html\?tab=register&deleted=1'\)/);

assert.match(auth, /window\.__icademDeletedAccountRecovery = true/);
assert.match(auth, /await setPersistence\(auth, browserLocalPersistence\)/);
assert.match(auth, /await auth\.authStateReady\(\)/);
assert.match(auth, /window\.__icademDeletedAccountRecovery && auth\.currentUser/);
assert.match(auth, /await signOut\(auth\)/);
assert.match(auth, /await syncCentralIdentity\(user\);[\s\S]*await ensureMiembroDoc\(user/);
assert.match(auth, /response\.status === 410|error\?\.status === 410/);

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
assert.match(panel, /vip-auth\.html\?tab=register&deleted=1/);
assert.match(panel, /membership\/\$\{user\.uid\}[\s\S]*cache:'no-store'/);
assert.match(panel, /confetti\(s\.tipo === 'cierre'\)/);
assert.match(panel, /@keyframes bnvFinale/);

const platformVersion = panel.match(/icadem-platform-v2\.js\?v=(\d+)/)?.[1];
assert.ok(platformVersion, 'falta versionar icadem-platform-v2.js');
assert.ok(serviceWorker.includes(`icadem-platform-v2.js?v=${platformVersion}`), 'la versión del panel y la precaché no coinciden');

console.log('OK: la cuenta eliminada sale del panel, limpia la sesión persistida y permite registrarse desde cero.');
