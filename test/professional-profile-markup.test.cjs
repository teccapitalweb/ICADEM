'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const root = __dirname + '/../';
function fixture() {
  const context = {window:{}, URL, location:{origin:'https://example.test'}};
  vm.runInNewContext(fs.readFileSync(root+'js/icadem-directory.js','utf8'), context);
  vm.runInNewContext(fs.readFileSync(root+'js/icadem-professional-profile.js','utf8'), context);
  const e = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const calls = {actions:[], contacts:[]};
  const helpers = {
    esc:e,
    icon:name=>'<svg class="ic" aria-hidden="true"><use href="#i-'+name+'"/></svg>',
    safeUrl:value=>{try{const url=new URL(value,'https://example.test');return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return ''; }},
    contactMarkup:contacts=>{calls.contacts.push(contacts);return Object.entries(contacts).map(([key,value])=>'<a class="community-contact">'+e(key)+': '+e(value)+'</a>').join('');},
    actionMarkup:(uid,state,compact)=>{calls.actions.push({uid,state,compact});return '<button class="community-connect" data-connect="'+e(uid)+'" data-state="'+e(state)+'">'+e({none:'Conectar',sent:'Solicitud enviada',connected:'Conectados'}[state]||state)+'</button>';}
  };
  return {markup:p=>context.window.ICADEMProfessionalProfile.markup(p,helpers), calls};
}
const full = {
  uid:'member', nombre:'María de la Luz Pérez', isVip:true, connection:'none', foto:'https://example.test/photo.jpg',
  profesion:'Abogada',puesto:'Directora jurídica',empresa:'Firma profesional',sector:'Legal',ubicacion:'Puebla',perfilCompleto:true,
  portadaColor:'#365742',portadaColorPersonalizado:true,portadaUrl:'https://example.test/cover.jpg',
  cv:{resumen:'Experiencia en asesoría jurídica.\nAtención profesional.',profesion:'Abogada',especialidad:'Derecho laboral',ciudad:'Puebla',areas:'Litigio y consultoría',habilidades:['Mediación','Negociación'],experiencia:[{cargo:'Asesora jurídica',empresa:'Despacho',periodo:'2020–2026',descripcion:'Consultoría para empresas.'}],formacion:[{titulo:'Licenciatura en Derecho',institucion:'Universidad',periodo:'2018'}]},
  contacts:{email:'public@example.test'}
};
test('the full professional curriculum uses the existing saved appearance and renders real populated sections',()=>{
  const {markup,calls}=fixture(),html=markup(full);
  assert.match(html,/class="professional-profile-page pp-is-vip"/);
  assert.match(html,/id="professional-profile-name"/);
  assert.match(html,/--pp-cover:#365742/);
  assert.match(html,/https:\/\/example.test\/cover.jpg/);
  for(const key of ['about','experience','specialties','education','information','presence','contact'])assert.ok(html.includes('data-profile-section="'+key+'"'));
  for(const text of ['Asesora jurídica','Despacho','2020–2026','Mediación','Licenciatura en Derecho','Información proporcionada por el profesional.'])assert.ok(html.includes(text));
  assert.equal(calls.contacts[0],full.contacts);
  assert.deepEqual(calls.actions,[{uid:'member',state:'none',compact:false}]);
  assert.ok(!html.includes('role="dialog"'));
});
test('a sparse profile has no placeholder experience, education, about or contact cards',()=>{
  const html=fixture().markup({uid:'sparse',nombre:'Persona registrada',isVip:false,connection:'none',cv:{experiencia:[{}],formacion:[{}]},contacts:{}});
  for(const key of ['about','experience','specialties','education','information','contact'])assert.ok(!html.includes('data-profile-section="'+key+'"'));
  assert.match(html,/pp-layout--compact/);
  assert.match(html,/data-profile-section="presence"/);
  assert.ok(!html.includes('Información todavía no compartida'));
  assert.ok(!html.includes('aún no ha'));
});
test('free membership retains the institutional cover even when stale custom appearance fields remain',()=>{
  const html=fixture().markup({...full,isVip:false});
  assert.match(html,/--pp-cover:#244B64/);
  assert.ok(!html.includes('cover.jpg'));
  assert.match(html,/Comunidad ICADEM/);
  assert.ok(!html.includes('Profesional VIP'));
  const vip=fixture().markup({...full,portadaColor:'#173b56',portadaColorPersonalizado:false,portadaUrl:''});
  assert.match(vip,/--pp-cover:#E9BC43/);
});
test('only server-authorized contacts enter the renderer; private progress and unrelated account fields are not published',()=>{
  const {markup,calls}=fixture();
  const html=markup({...full,contacts:{},email:'secret@example.test',whatsapp:'+525555555555',clabe:'000000000000000000',certificados:[{folio:'PRIVATE-CERT'}],progreso:{cursos:'PRIVATE-PROGRESS'},cv:{resumen:'Resumen público',credentialSecret:'PRIVATE-CV'}});
  assert.equal(Object.keys(calls.contacts[0]).length,0);
  for(const secret of ['secret@example.test','525555555555','000000000000000000','PRIVATE-CERT','PRIVATE-PROGRESS','PRIVATE-CV'])assert.ok(!html.includes(secret));
  assert.ok(!html.includes('data-profile-section="contact"'));
  assert.match(html,/privacidad del profesional/);
});
test('existing connection and owner editor actions remain available for every state',()=>{
  for(const [state,labels] of [['none',['Conectar']],['sent',['Solicitud pendiente','Cancelar solicitud']],['received',['Solicitud recibida','Aceptar','Rechazar']],['connected',['Conectados','Desconectar']]]){
    const html=fixture().markup({...full,connection:state});
    for(const label of labels)assert.ok(html.includes(label));
    assert.match(html,/data-profile-activity/);
    if(state==='connected'){assert.match(html,/<span class="community-state pp-connected">/);assert.ok(!html.includes('data-connect='));}
    if(state==='received'){assert.match(html,/data-network-action="accept" data-uid="member"/);assert.match(html,/data-network-action="reject"/);}
  }
  const own=fixture().markup({...full,own:true,connection:'self'});
  assert.match(own,/data-edit-cv/);assert.match(own,/data-edit-card/);assert.ok(!own.includes('data-connect='));assert.ok(!own.includes('data-network-action='));
});
test('profile text and image attributes cannot inject HTML and rendering never mutates existing data',()=>{
  const input=JSON.parse(JSON.stringify({...full,nombre:'<img src=x onerror=alert(1)>',foto:'javascript:alert(1)',cv:{...full.cv,resumen:'<script>alert(1)</script>',experiencia:[{cargo:'<button onclick=bad()>Cargo</button>'}],habilidades:['<svg onload=bad()>'],formacion:[{titulo:'" onmouseover="bad()'}]}}));
  const before=JSON.stringify(input),html=fixture().markup(input);
  assert.equal(JSON.stringify(input),before);
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('src="javascript:'));
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;svg onload=bad\(\)&gt;/);assert.match(html,/&quot; onmouseover=&quot;bad\(\)/);
});
