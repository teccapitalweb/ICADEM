'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const panel=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
const contactSource=panel.slice(panel.indexOf('const ICADEM_CONTACT = {'),panel.indexOf('window.ICADEM_CONTACT = ICADEM_CONTACT;'));
const renderSource=panel.slice(panel.indexOf('  function renderCanal(container){'),panel.indexOf('  /* ============================ MI PERFIL'));
const ctx={window:{}};vm.runInNewContext(contactSource+'\n'+renderSource+'\nwindow.contacts=ICADEM_CONTACT;window.render=renderCanal;',ctx);
function rendered(){const root={innerHTML:''};ctx.window.render(root);return root.innerHTML;}

test('Contactos ICADEM keeps the original canal route in both menus without redundant mobile support',()=>{
  const menus=[...panel.matchAll(/<a href="#canal"[^>]*data-section="canal"[^>]*>(.*?)<\/a>/gs)];
  assert.equal(menus.length,2);for(const menu of menus)assert.match(menu[1],/Contactos ICADEM/);
  const drawer=panel.slice(panel.indexOf('id="mobile-drawer"'),panel.indexOf('// ═════',panel.indexOf('id="mobile-drawer"')));
  assert.doesNotMatch(drawer,/<a[^>]*id="drawer-whatsapp-support"/);
  assert.match(panel,/<a href="#soporte" class="mobile-drawer__item"[^>]*>[\s\S]*?Soporte privado<\/a>/);
  assert.match(panel,/canal:'Contactos ICADEM'/);
  assert.match(panel,/canal:renderCanal/);
});

test('all existing official contact destinations are retained',()=>{
  const c=ctx.window.contacts;
  assert.equal(c.canal,'https://whatsapp.com/channel/0029VbBz1u58kyyIK258Rw2g');
  assert.equal(c.instagram,'https://www.instagram.com/icadem3/');
  assert.equal(c.facebook,'https://www.facebook.com/profile.php?id=61561475492930&locale=es_LA');
  assert.equal(c.whatsapp,'522383738143');assert.equal(c.director,'522361112213');
  const support=new URL(c.waLink(c.msgSoporte()));
  assert.equal(support.origin+support.pathname,'https://wa.me/522383738143');
  assert.equal(support.searchParams.get('text'),c.msgSoporte());
  const share=new URL(c.shareInvitacion());
  assert.equal(share.origin+share.pathname,'https://wa.me/');
  assert.ok(share.searchParams.get('text').includes(c.canal));assert.ok(share.searchParams.get('text').includes(c.sitio));
});

test('support and both social contacts remain prominent with real destination fallbacks',()=>{
  const html=rendered();
  assert.match(html,/<h1[^>]*>Contactos ICADEM<\/h1>/);
  for(const destination of [ctx.window.contacts.waLink(ctx.window.contacts.msgSoporte()),ctx.window.contacts.instagram,ctx.window.contacts.facebook])assert.ok(html.includes('href="'+destination+'"'));
  assert.equal((html.match(/class="social-card /g)||[]).length,3);
  assert.ok(html.indexOf('id="btn-wa-support"')<html.indexOf('class="wa-stats"'));
  assert.ok(html.indexOf('social-card--fb')<html.indexOf('class="wa-stats"'));
  assert.match(html,/id="btn-wa-support"[^>]*target="_blank"[^>]*rel="noopener"/);
});

test('channel, invitation sharing and support keep their existing action handlers',()=>{
  const html=rendered();
  for(const id of ['btn-wa-canal-open','btn-wa-canal-share','btn-wa-support'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(panel,/t\.closest\('#btn-wa-canal-open'\)[\s\S]*?window\.open\(ICADEM_CONTACT\.canal,'_blank'\)/);
  assert.match(panel,/t\.closest\('#btn-wa-support'\)[\s\S]*?window\.open\(ICADEM_CONTACT\.waLink\(ICADEM_CONTACT\.msgSoporte\(\)\),'_blank','noopener'\)/);
  assert.match(panel,/t\.closest\('#btn-wa-canal-share'\)[\s\S]*?window\.open\(ICADEM_CONTACT\.shareInvitacion\(\),'_blank'\)/);
});

test('all three community advantages and the existing rules remain available',()=>{
  const html=rendered();
  for(const text of ['Comunidad','Profesionales de distintas áreas','Cercana','Conversación entre miembros','Activa','Aprendizaje y networking','Respeto siempre.','Comparte casos reales.','Nada de spam.','Confidencialidad.'])assert.ok(html.includes(text),text);
  assert.equal((html.match(/class="wa-stat"/g)||[]).length,3);
  assert.match(html,/aria-labelledby="contacts-channel-title"/);assert.match(html,/id="contacts-channel-title"/);
});
