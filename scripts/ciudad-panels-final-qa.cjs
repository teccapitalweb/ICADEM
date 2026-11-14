'use strict';
// Finite visual QA of the real offline game: map, passport and the existing
// minigame menu. No seeded progress, fabricated authentication or game starts.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..'), pw = require(process.argv[2]), OUT = process.argv[3];
const sizes = [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }];
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => { const file = path.resolve(ROOT, '.' + new URL(req.url, 'http://local').pathname); if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); } fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'missing' : data); }); });
const records = [], issues = [], fatal = [], writes = [], sockets = [];
let browser, page, context;
const check = (ok, description, detail) => { if (!ok) issues.push({ description, detail }); };
async function capture(name) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled' }); }
async function close() { await page.locator('#modal-x').click(); await page.locator('#modal').waitFor({ state: 'hidden' }); check(await page.evaluate(() => document.activeElement.id === 'btn-more'), 'closing restores quick-menu trigger focus'); }
async function open(id) { await page.locator('#btn-more').click(); await page.locator('[data-quick-action="' + id + '"]').click(); await page.locator('#modal:not([hidden])').waitFor(); }
async function inspect(panel, size) {
  const result = await page.evaluate(() => {
    const card = document.querySelector('.modal__card'), r = card.getBoundingClientRect(), body = document.getElementById('modal-body');
    return { documentWidth: document.documentElement.scrollWidth, viewport: { width: innerWidth, height: innerHeight }, modal: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, body: { width: body.clientWidth, scrollWidth: body.scrollWidth }, targets: [...card.querySelectorAll('button')].filter(n => n.getClientRects().length && !n.disabled).map(n => { const r = n.getBoundingClientRect(); return { text: n.getAttribute('aria-label') || n.textContent.trim(), width: r.width, height: r.height }; }) };
  });
  check(result.documentWidth <= size.width + 1 && result.body.scrollWidth <= result.body.width + 1, panel + ' no horizontal overflow at ' + size.width, result);
  check(result.modal.left >= -1 && result.modal.right <= size.width + 1 && result.modal.top >= -1 && result.modal.bottom <= size.height + 1, panel + ' fits viewport at ' + size.width, result.modal);
  check(result.targets.every(t => t.width >= 43.5 && t.height >= 43.5), panel + ' targets >=44px at ' + size.width, result.targets.filter(t => t.width < 43.5 || t.height < 43.5));
  await page.locator('#modal-actions button').last().focus(); await page.keyboard.press('Tab'); check(await page.evaluate(() => document.querySelector('.modal__card').contains(document.activeElement)), panel + ' focus stays inside modal');
  return result;
}
const protectedState = () => page.evaluate(() => { const s = window.__ciudad.api.store.state; return JSON.stringify({ avatar: s.avatarId, custom: s.custom, xp: s.xp, economy: s.economy, missions: s.missions, play: s.play, achievements: s.achievements }); });
(async () => {
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = 'http://127.0.0.1:' + server.address().port;
    browser = await pw.chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] });
    context = await browser.newContext({ viewport: sizes[0], hasTouch: true, isMobile: true, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' }); page = await context.newPage(); page.setDefaultTimeout(30000);
    await context.route('**/*', route => { const r = route.request(), u = new URL(r.url()); if (!['GET', 'HEAD'].includes(r.method())) { writes.push(r.url()); return route.abort(); } return [base, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(u.origin) ? route.continue() : route.abort(); });
    page.on('pageerror', e => fatal.push(e.message)); page.on('websocket', s => sockets.push(s.url()));
    await page.goto(base + '/ciudad/index.html?debug=1&autostart=1&tutorial=0&avatar=0', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__ciudad?.api && document.getElementById('splash').hidden);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => { window.__ciudad.api.engine.stop(); resolve(); })));
    assert.equal(await page.evaluate(() => window.__ciudad.api.net.constructor.name), 'OfflineAdapter'); const before = await protectedState();
    const gameIds = await page.evaluate(async () => (await import('./js/edu/games.js')).GAME_LIST.map(g => g.id)); assert.equal(gameIds.length, 9);
    for (const size of sizes) {
      console.log('PANELS ' + size.width); await page.setViewportSize(size); const record = { size };
      await open('map'); record.map = await inspect('map', size); await page.locator('.map__list [data-id="banco"]').press('Enter'); check(await page.locator('.map__list [data-id="banco"]').getAttribute('aria-pressed') === 'true', 'map keyboard selection is exposed');
      await page.locator('[data-map-zoom="in"]').press('Enter'); check(await page.locator('[data-map-scale]').innerText() === '125 %', 'map zoom works'); await page.locator('[data-map-zoom="reset"]').press('Enter');
      await page.locator('.map__list button').last().scrollIntoViewIfNeeded(); check(await page.locator('.map__list button').last().evaluate(n => { const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }), 'last map destination reachable');
      await page.locator('#modal-body').evaluate(n => { n.scrollTop = 0; }); await capture('map-' + size.width); await close();
      await open('passport'); record.passport = await inspect('passport', size); record.passportViews = {};
      for (const id of ['resumen', 'logros', 'avatar', 'movimientos']) { await page.locator('.passport .tabs [data-id="' + id + '"]').press('Enter'); check(await page.locator('.passport .tabs [data-id="' + id + '"]').getAttribute('aria-pressed') === 'true', 'passport selected tab exposed at ' + size.width + ':' + id); record.passportViews[id] = await inspect('passport ' + id, size); }
      await page.locator('.passport .tabs [data-id="resumen"]').click(); await page.locator('#modal-body').evaluate(n => { n.scrollTop = 0; }); await capture('passport-' + size.width); await close();
      await open('games'); record.games = await inspect('games', size); assert.deepEqual(await page.locator('.arcade__card').evaluateAll(ns => ns.map(n => n.dataset.game)), gameIds);
      record.gameDetails = await page.locator('.arcade__card').evaluateAll(ns => ns.map(n => ({ id: n.dataset.game, iconVisible: Boolean(n.querySelector('.arcade__icon').getClientRects().length), bestVisible: Boolean(n.querySelector('.arcade__best').getClientRects().length) })));
      check(record.gameDetails.every(g => g.iconVisible && g.bestVisible), 'game icon and current status visible at ' + size.width, record.gameDetails);
      await page.locator('.arcade__card').last().scrollIntoViewIfNeeded(); check(await page.locator('.arcade__card').last().evaluate(n => { const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }), 'last minigame reachable');
      await page.locator('#modal-body').evaluate(n => { n.scrollTop = 0; }); await capture('games-' + size.width); await close();
      assert.equal(await protectedState(), before, 'read-only panels never change progress, credits or appearance'); records.push(record);
    }
    check(fatal.length === 0, 'no fatal JavaScript', fatal); check(writes.length === 0 && sockets.length === 0, 'offline test has no backend mutations or sockets', { writes, sockets });
    fs.writeFileSync(path.join(OUT, 'panel-metrics.json'), JSON.stringify({ mode: 'local-real-game-offline', physicalDevices: false, fontSourcesUnmodified: true, noGameStarted: true, records, issues, fatal, writes, sockets }, null, 2));
    console.log(JSON.stringify({ cases: records.length, issues }, null, 2)); if (issues.length) process.exitCode = 1;
  } finally { await context?.close(); await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
