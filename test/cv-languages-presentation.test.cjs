'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={ICADEMDirectory:{appearance:()=>({color:'#244B64',image:''})}};
const scope={window};for(const file of ['icadem-cv-languages.js','icadem-professional-profile.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../js/'+file,'utf8'),scope);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,icon:()=>'',safeUrl:()=>'',contactMarkup:()=>'',actionMarkup:()=>''};
const render=(cv,own=false)=>window.ICADEMProfessionalProfile.markup({uid:'qa-owner',nombre:'Profesional QA',own,cv},helpers);
test('public languages represent MCER, HSK, native and no formal evaluation without equivalences',()=>{
 const html=render({idiomas:[{idioma:'Inglés',nivel:'B2'},{idioma:'Francés',nivel:'A1',sistema:'mcer'},{idioma:'Chino mandarín',nivel:'HSK 1',sistema:'hsk',acreditacion:'estimado'},{idioma:'Español',nivel:'Nativo'},{idioma:'Otro idioma',nivel:'',sistema:'sin_evaluacion'}]});
 for(const text of ['B2 (MCER)','A1 (MCER)','HSK 1 (nivel declarado)','Nativo','Sin evaluación formal'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/MCER/g)||[]).length,2);assert.doesNotMatch(html,/equivalente|verificado|certificado/i);
});
test('declared certification details remain text and never imply verified credentials',()=>{
 const html=render({idiomas:[{idioma:'Chino mandarín',nivel:'HSK 9',sistema:'hsk',acreditacion:'certificacion',organismo:'Entidad <b>QA</b>',fecha:'2025-06',resultado:'Resultado declarado <script>bad()</script>',verified:true}]});
 assert.match(html,/Acreditación declarada por el profesional/);assert.match(html,/sin verificación de ICADEM/);assert.match(html,/jun 2025/);assert.match(html,/&lt;b&gt;QA/);assert.doesNotMatch(html,/<script>|<b>|Verificado|Certificado/);
 const hidden=render({idiomas:[{idioma:'Inglés',nivel:'B2',sistema:'mcer',acreditacion:'estimado',organismo:'STALE-PRIVATE-METADATA',fecha:'2025-01',resultado:'HIDDEN-RESULT'}]});
 assert.ok(!hidden.includes('STALE-PRIVATE-METADATA'));assert.ok(!hidden.includes('HIDDEN-RESULT'));
});
test('omitted private languages stay absent while legacy values and unrelated skill categories stay visible',()=>{
 const privateHtml=render({habilidadesTecnicas:['Desarrollo web asistido por IA','Diseño de interfaces de usuario','Automatización de procesos','Ingeniería de prompts'],herramientas:['Excel','Power BI'],competencias:['Comunicación','Trabajo en equipo']});
 assert.ok(!privateHtml.includes('data-profile-section="languages"'));
 for(const item of ['Desarrollo web asistido por IA','Diseño de interfaces de usuario','Automatización de procesos','Ingeniería de prompts','Excel','Power BI','Comunicación','Trabajo en equipo'])assert.ok(privateHtml.includes('<li>'+item+'</li>'));
 const legacy=render({idiomas:[{idioma:'Lengua de señas mexicana',nivel:'B1'}]});assert.match(legacy,/Lengua de señas mexicana/);assert.match(legacy,/B1 \(MCER\)/);
});
test('an incompatible earlier scale is preserved as declared information and the owner is asked to review it',()=>{
 const cv={idiomas:[{idioma:'Francés',nivel:'HSK 2',sistema:'hsk',requiereRevision:true}]};
 const publicHtml=render(cv),own=render(cv,true);assert.match(publicHtml,/HSK 2 \(nivel declarado\)/);assert.ok(!publicHtml.includes('Revisa este nivel'));assert.match(own,/Revisa este nivel/);
});
test('the language helper loads before both CV consumers and changed assets use matching cache keys',()=>{
 const html=fs.readFileSync(__dirname+'/../vip-panel.html','utf8'),sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
 const helper=html.indexOf('js/icadem-cv-languages.js?v=1');assert.ok(helper>0);assert.ok(helper<html.indexOf('js/icadem-professional-profile.js?v=5'));assert.ok(helper<html.indexOf('js/icadem-resume-editor.js?v=4'));
 for(const asset of ['js/icadem-cv-languages.js?v=1','js/icadem-professional-profile.js?v=5','js/icadem-resume-editor.js?v=4','css/icadem-professional-profile.css?v=3','css/icadem-resume-editor.css?v=3']){assert.ok(html.includes(asset));assert.ok(sw.includes(asset));}
});
