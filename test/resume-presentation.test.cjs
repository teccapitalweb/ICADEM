'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={ICADEMDirectory:{appearance:p=>({color:p.portadaColor||'#244B64',image:p.portadaUrl||''})},__avatarSrc:(url,v)=>url+'?version='+v};
vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-professional-profile.js','utf8'),{window});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,icon:()=>'<svg></svg>',safeUrl:v=>/^https?:\/\//.test(v||'')?v:'',contactMarkup:c=>c.email?esc(c.email):'',actionMarkup:()=>'<button data-connect>Conectar</button>'};
const render=p=>window.ICADEMProfessionalProfile.markup({uid:'fake',nombre:'Persona de prueba',contacts:{},...p},helpers);
test('CV accent and cover stay independent, current author version reaches the photo helper',()=>{
 const html=render({isVip:true,portadaColor:'#123456',foto:'https://example.test/avatar',photoVersion:'new',cv:{estilo:{color:'#E9BC43'}}});
 assert.match(html,/--pp-cover:#123456/);assert.match(html,/--pp-accent:#E9BC43/);assert.match(html,/avatar\?version=new/);
});
test('all populated sections render as a CV, preserving row order and declaring certificates without verification claims',()=>{
 const html=render({cv:{resumen:'Resumen real',presentacion:'Presentación real',objetivo:'Objetivo real',experiencia:[{cargo:'Primero',empresa:'Empresa A',inicio:'2024-03',actual:true,logros:'Resultado registrado'},{cargo:'Segundo',empresa:'Empresa B',periodo:'2020–2023'}],formacion:[{titulo:'Grado',institucion:'Institución',area:'Área',estado:'Finalizado',descripcion:'Estudios registrados'}],idiomas:[{idioma:'Inglés',nivel:'B2'}],habilidadesTecnicas:['Programación'],herramientas:['Editor'],competencias:['Comunicación'],certificaciones:[{nombre:'Certificación',institucion:'Emisor',identificador:'ID-1',fecha:'2025-01',url:'https://example.test/cert'}],proyectos:[{nombre:'Proyecto',descripcion:'Descripción',participacion:'Participación',url:'https://example.test/project'}],enlaces:[{nombre:'Sitio profesional',url:'https://example.test/'}]}});
 for(const value of ['about','experience','education','languages','specialties','certifications','projects','links'])assert.match(html,new RegExp('data-profile-section="'+value+'"'));
 assert.ok(html.indexOf('Primero')<html.indexOf('Segundo'));assert.match(html,/mar 2024 — Actualidad/);assert.match(html,/No implican verificación de ICADEM/);assert.match(html,/noopener noreferrer/);
});
test('private projected sections cannot reappear through stale biography or hidden links',()=>{
 const html=render({bio:'PRIVATE OLD BIO',cv:{idiomas:[],proyectos:[],certificaciones:[{nombre:'Visible certificate',url:''}],enlaces:[{nombre:'Hidden web',url:''}]}});
 assert.ok(!html.includes('PRIVATE OLD BIO'));assert.ok(!html.includes('data-profile-section="about"'));assert.ok(!html.includes('data-profile-section="links"'));assert.ok(!html.includes('data-profile-section="languages"'));assert.ok(!html.includes('data-profile-section="projects"'));
});
test('preview exposes no edit/connection actions; owner has the same CV with owner actions only',()=>{
 const preview=render({preview:true,own:false,cv:{resumen:'Draft'}});assert.ok(!preview.includes('data-connect'));assert.ok(!preview.includes('data-edit-cv'));assert.match(preview,/Vista previa del borrador público/);
 const own=render({own:true,cv:{}});assert.match(own,/Completar mi currículum/);assert.ok(!own.includes('data-connect'));
 const filled=render({own:true,cv:{idiomas:[{idioma:'Español',nivel:'Nativo'}]}});assert.match(filled,/Editar mi currículum/);
});
test('text, arbitrary colors, and external hrefs cannot inject markup or JavaScript',()=>{
 const html=render({nombre:'<img src=x onerror=alert(1)>',portadaColor:'red;url(evil)',cv:{resumen:'<script>bad()</script>',estilo:{color:'red;--x:evil'},certificaciones:[{nombre:'<b>Cert</b>',url:'javascript:alert(1)'}],enlaces:[{nombre:'Unsafe',url:'http://example.test'}]}});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('url(evil)'));assert.ok(!html.includes('href="http:'));assert.match(html,/&lt;script&gt;/);assert.match(html,/--pp-accent:#244B64/);
});
