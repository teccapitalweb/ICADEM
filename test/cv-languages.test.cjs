'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-cv-languages.js','utf8'),{window});const rules=window.ICADEMCVLanguages;
const plain=value=>JSON.parse(JSON.stringify(value));
test('English and French legacy MCER records remain unchanged while their system is inferred',()=>{
 for(const idioma of ['Inglés','Francés'])for(const nivel of ['A1','A2','B1','B2','C1','C2']){const row={id:'old',idioma,nivel};assert.equal(rules.normalize(row).sistema,'mcer');assert.equal(rules.review(row),'');assert.equal(rules.label(row),nivel+' (MCER)');assert.deepEqual(row,{id:'old',idioma,nivel});}
 assert.equal(rules.normalize({idioma:'Español',nivel:'Nativo'}).sistema,'nativo');assert.equal(rules.label({idioma:'Español',nivel:'Nativo'}),'Nativo');
});
test('Mandarin allows HSK 1 through 9 and MCER without any cross-scale conversion',()=>{
 for(const idioma of ['Chino mandarín','Mandarín','Chino (mandarín)','Chino(mandarín)','Chino ( mandarín )','Mandarin Chinese','chino-mandarín','chino_mandarin','  CHINO (MANDARÍN)  ']){
  assert.ok(rules.systems(idioma).some(x=>x.value==='hsk'));
  for(let level=1;level<=9;level++){const row={idioma,sistema:'hsk',nivel:'HSK '+level};assert.equal(rules.review(row),'');assert.equal(rules.label(row),'HSK '+level+' (nivel declarado)');}
  assert.equal(rules.review({idioma,sistema:'mcer',nivel:'B2'}),'');
 }
 assert.match(rules.review({idioma:'Chino mandarín',sistema:'mcer',nivel:'HSK 1'}),/no se convierte/);
 assert.match(rules.review({idioma:'Inglés',sistema:'hsk',nivel:'HSK 1'}),/Revisa el idioma o el sistema/);
 assert.ok(!rules.systems('Cantonés').some(x=>x.value==='hsk'));
});
test('Native and no-formal-assessment need no certificate; empty and incompatible previous levels are not assigned defaults',()=>{
 for(const sistema of ['nativo','sin_evaluacion'])assert.equal(rules.review({idioma:'Lengua de señas mexicana',sistema,nivel:'',acreditacion:''}),'');
 assert.equal(rules.normalize({idioma:'Inglés'}).nivel,'');assert.equal(rules.normalize({idioma:'Inglés'}).sistema,'');
 const old={idioma:'Francés',nivel:'Avanzado anterior',requiereRevision:true};assert.equal(rules.normalize(old).nivel,old.nivel);assert.ok(rules.review(old));assert.equal(rules.label(old),'Avanzado anterior (nivel declarado)');
});
test('User-declared accreditation never produces a verification assertion or an automatic certification',()=>{
 assert.equal(rules.describe({idioma:'Inglés',nivel:'B2',acreditacion:''}).accreditation,'');
 assert.equal(rules.describe({idioma:'Chino mandarín',sistema:'hsk',nivel:'HSK 1',acreditacion:'certificacion'}).accreditation,'Acreditación declarada por el profesional');
 assert.deepEqual(plain(rules.levels('hsk')),Array.from({length:9},(_,i)=>'HSK '+(i+1)));assert.deepEqual(plain(rules.levels('mcer')),['A1','A2','B1','B2','C1','C2']);
});

test('inconsistent native and unassessed saved levels remain declared text until explicitly reviewed',()=>{
 for(const sistema of ['nativo','sin_evaluacion']){
  const saved={idioma:'Inglés',sistema,nivel:'B2',requiereRevision:true};assert.equal(rules.label(saved),'B2 (nivel declarado)');assert.match(rules.review(saved),/nivel anterior.*B2.*antes de guardar/);
  const draft={...saved};delete draft.requiereRevision;assert.equal(rules.review(draft),'');assert.equal(rules.label(draft),'B2 (nivel declarado)');assert.equal(saved.nivel,'B2');
 }
});
