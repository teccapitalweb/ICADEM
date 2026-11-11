'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8');
function helper(){const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-directory.js','utf8'),ctx);return ctx.window.ICADEMDirectory;}
test('VIP cover priority is image, preserved custom color, then gold; free cards ignore stored VIP appearance',()=>{
  const ui=helper(),saved={portadaColor:'#123456',portadaColorPersonalizado:true,portadaUrl:'https://example.test/cover.jpg'};
  assert.equal(ui.appearance(saved,true).image,saved.portadaUrl);assert.equal(ui.appearance(saved,true).color,saved.portadaColor);
  assert.equal(ui.appearance({portadaColor:'#173b56'},true).color,'#E9BC43');assert.equal(ui.appearance({portadaColor:'#173b56',portadaColorPersonalizado:true},true).color,'#173b56');
  assert.equal(ui.appearance(saved,false).color,'#244B64');assert.equal(ui.appearance(saved,false).image,'');assert.equal(ui.appearance(saved,true).image,saved.portadaUrl);
  assert.equal(ui.appearance({portadaUrl:'javascript:alert(1)'},true).image,'');assert.equal(ui.appearance({portadaColor:'#fff;display:none'},true).color,'#E9BC43');
});
test('crop geometry stays within portrait/landscape bounds and exports a consistent 4:1 frame',()=>{
  const ui=helper();for(const [w,h] of [[800,1200],[1400,350],[2000,300],[300,300]])for(const zoom of [1,2,3])for(const x of [0,50,100])for(const y of [0,50,100]){const r=ui.cropRect(w,h,zoom,x,y);assert.equal(r.width/r.height,4);assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=w+.001&&r.y+r.height<=h+.001);}
});
function render(cards,{tier='todos',sector='todos',search='',uid='free-owner'}={}){
  const grid={innerHTML:'',querySelectorAll:()=>[]},counter={},ctx={window:{UserState:{uid},ICADEMDirectory:helper()},document:{getElementById:id=>id==='dir-results'?grid:counter,querySelectorAll:()=>[]},_dirCards:cards,_dirFiltroTier:tier,_dirFiltroSector:sector,_dirBusqueda:search,escapeHtml:s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),dirFotoSrc:c=>c.foto,dirInstagramPerfil:()=>'',dirNormalizarBusqueda:s=>s.toLowerCase()};
  const start=html.indexOf('  function dirPintar(){'),end=html.indexOf('  function dirVerDetalle(',start);vm.runInNewContext(html.slice(start,end)+';dirPintar();',ctx);return grid.innerHTML;
}
const rows=[{id:'free-owner',nombre:'Ana',isVip:false,perfilCompleto:true,sector:'Legal'},{id:'vip-z',nombre:'Zoe',isVip:true,perfilCompleto:false,sector:'Legal'},{id:'vip-a',nombre:'Alma',isVip:true,perfilCompleto:true,sector:'Fiscal'}];
test('the unchanged frontend comparator/groups keep VIP first through filters and membership updates',()=>{
  const ids=s=>[...s.matchAll(/data-dircard="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(ids(render(rows)),['vip-a','vip-z','free-owner']);
  assert.deepEqual(ids(render(rows,{sector:'Legal'})),['vip-z','free-owner']);assert.deepEqual(ids(render(rows,{search:'ana'})),['free-owner']);assert.deepEqual(ids(render(rows,{tier:'vip'})),['vip-a','vip-z']);
  assert.deepEqual(ids(render(rows.map(x=>x.id==='free-owner'?{...x,isVip:true}:x))),['free-owner','vip-a','vip-z']);assert.deepEqual(ids(render(rows)),['vip-a','vip-z','free-owner']);
});
test('long names and bios remain available in the existing full-profile action; no original records are mutated',()=>{
  const input=[{...rows[1],nombre:'Nombre profesional muy largo '.repeat(10),bio:'Descripción profesional extensa '.repeat(20),portadaUrl:'https://example.test/a.jpg'}],before=JSON.stringify(input),markup=render(input);
  assert.ok(markup.includes(input[0].nombre));assert.ok(markup.includes(input[0].bio));assert.match(markup,/network-view-profile/);assert.match(markup,/dir-card__cover-image/);assert.equal(JSON.stringify(input),before);
});
test('directory assets are loaded once in the real head and cover edits still use the authenticated profile service',()=>{
  const head=html.slice(0,html.indexOf('</head>'));assert.match(head,/icadem-directory\.css\?v=2/);assert.match(head,/js\/icadem-directory\.js\?v=\d+/);assert.equal((html.match(/href="css\/icadem-directory\.css/g)||[]).length,1);
  const community=fs.readFileSync(__dirname+'/../js/icadem-community.js','utf8'),editor=fs.readFileSync(__dirname+'/../js/icadem-resume-editor.js','utf8');
  assert.match(community,/ICADEMPlatform\.saveProfile\(payload\)/);assert.match(editor,/ICADEMDirectory\?\.bindEditor/);assert.match(editor,/coverController\.payload\(\)/);
});

 test('CV consumers reuse the existing cover defaults and unrestricted hexadecimal picker without mutating cover preferences',()=>{
  const ui=helper(),card={portadaColor:'#316789',portadaColorPersonalizado:true},before=JSON.stringify(card),shared=ui.palette(card);
  assert.equal(shared.mode,'custom-hex');assert.equal(shared.defaultVip,ui.appearance({},true).color);assert.equal(shared.defaultFree,ui.appearance({},false).color);assert.equal(shared.selected,card.portadaColor);
  assert.deepEqual(Array.from(shared.colors,x=>x.value),['#E9BC43','#244B64']);assert.match(ui.editorMarkup(),/type="color"/);
  assert.equal(ui.colorValue('#a1b2c3'),'#a1b2c3');assert.equal(ui.colorValue('javascript:alert(1)',shared.defaultFree),'#244B64');assert.equal(ui.colorValue('bad','url(evil)'),'#E9BC43');assert.equal(JSON.stringify(card),before);
 });
