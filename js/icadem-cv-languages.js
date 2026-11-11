/* Shared vocabulary for the existing CV language section. These scales are
   independent declarations; no HSK/MCER equivalence or verification is inferred. */
(function(){
  'use strict';
  var catalog=[
    {label:'Idiomas habituales',languages:['Español','Inglés','Francés','Portugués','Alemán','Italiano','Chino mandarín']},
    {label:'Otros idiomas',languages:['Árabe','Coreano','Griego','Hebreo','Hindi','Japonés','Neerlandés','Polaco','Ruso','Sueco','Tailandés','Turco','Ucraniano','Vietnamita']}
  ];
  var mcer=['A1','A2','B1','B2','C1','C2'],hsk=Array.from({length:9},function(_,i){return 'HSK '+(i+1);});
  var systemsLabels={mcer:'MCER',hsk:'HSK',nativo:'Nativo',sin_evaluacion:'Sin evaluación formal'};
  var accreditationLabels={estimado:'Nivel estimado por mí',en_curso:'Formación en curso',evaluacion:'Evaluación realizada (declarada)',certificacion:'Acreditación declarada por el profesional'};
  function isMandarin(name){return ['chino mandarin','mandarin','mandarin chinese','chinese mandarin'].includes(String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[()_-]/g,' ').replace(/\s+/g,' ').trim());}
  function normalize(row){
    var result={...(row&&typeof row==='object'?row:{})};
    ['idioma','nivel','sistema','acreditacion','organismo','fecha','resultado'].forEach(function(key){result[key]=result[key]==null?'':String(result[key]);});
    if(!result.sistema){if(mcer.includes(result.nivel))result.sistema='mcer';else if(result.nivel==='Nativo')result.sistema='nativo';else if(isMandarin(result.idioma)&&hsk.includes(result.nivel))result.sistema='hsk';}
    return result;
  }
  function systems(language){return ['mcer'].concat(isMandarin(language)?['hsk']:[]).concat(['nativo','sin_evaluacion']).map(function(value){return {value:value,label:systemsLabels[value]};});}
  function levels(system){return (system==='mcer'?mcer:system==='hsk'?hsk:[]).slice();}
  function review(value){
    var row=normalize(value);
    if(!row.idioma.trim())return 'Selecciona un idioma o escribe su nombre.';
    if(!Object.hasOwn(systemsLabels,row.sistema))return 'Selecciona el sistema de evaluación de este idioma.';
    if(row.sistema==='hsk'&&!isMandarin(row.idioma))return 'HSK corresponde a Chino mandarín. Revisa el idioma o el sistema; conservamos tu nivel anterior.';
    if(['mcer','hsk'].includes(row.sistema)&&!levels(row.sistema).includes(row.nivel))return row.nivel?'El nivel anterior «'+row.nivel+'» no corresponde a '+systemsLabels[row.sistema]+'. Elige un nivel de esa escala; no se convierte automáticamente.':'Elige un nivel de '+systemsLabels[row.sistema]+'.';
    if(row.requiereRevision===true&&((row.sistema==='nativo'&&row.nivel&&row.nivel!=='Nativo')||(row.sistema==='sin_evaluacion'&&row.nivel)))return 'El nivel anterior «'+row.nivel+'» no corresponde a '+systemsLabels[row.sistema]+'. Revisa el idioma o cambia el sistema antes de guardar.';
    if(row.acreditacion&&!Object.hasOwn(accreditationLabels,row.acreditacion))return 'Revisa cómo acreditas este nivel.';
    return '';
  }
  function label(value){
    var row=normalize(value);
    if(row.sistema==='nativo'&&(!row.nivel||row.nivel==='Nativo'))return 'Nativo';
    if(row.sistema==='sin_evaluacion'&&!row.nivel)return 'Sin evaluación formal';
    if(row.sistema==='mcer'&&mcer.includes(row.nivel))return row.nivel+' (MCER)';
    return row.nivel?row.nivel+' (nivel declarado)':'Nivel no especificado';
  }
  function describe(row){row=normalize(row);return {label:label(row),accreditation:accreditationLabels[row.acreditacion]||'',review:review(row)};}
  window.ICADEMCVLanguages={catalog:catalog,normalize:normalize,isMandarin:isMandarin,systems:systems,levels:levels,review:review,label:label,describe:describe};
})();
