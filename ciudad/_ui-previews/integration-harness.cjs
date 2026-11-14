'use strict';
// Optional QA interface, NOT game methods/endpoints/payloads. No bundled live adapter or connection.
const path=require('node:path'),{pathToFileURL}=require('node:url'),{isDeepStrictEqual}=require('node:util');
const AREAS=Object.freeze(['pets','walk','shop','inventory','home','water','games']);
const GATES=Object.freeze(['canonical-games','expected-revision','independent-session-refresh','repeat-identity','ack-recovery','permission','ephemeral-contract']);
class QAError extends Error {}
function check(condition,message){if(!condition)throw new QAError(message);}
function same(a,b,message){check(isDeepStrictEqual(a,b),message);}
function snapshot(value,area,{revision=false}={}){
  check(value&&typeof value.subjectKey==='string'&&value.subjectKey.length>0,area+': falta el UID opaco de la sesión.');
  if(revision)check(['string','number'].includes(typeof value.revision),area+': falta revisión autoritativa para el caso de concurrencia.');
  check(Object.hasOwn(value,'value'),area+': falta proyección autoritativa.');
  check(value.protected&&typeof value.protected==='object'&&Object.keys(value.protected).length>0,area+': falta proyección de invariantes protegidas.');
  return structuredClone(value);
}
function consistent(a,b,area){same(a.subjectKey,b.subjectKey,area+': las sesiones no pertenecen al mismo UID.');same(a.value,b.value,area+': las sesiones muestran estados diferentes.');same(a.protected,b.protected,area+': las invariantes difieren.');if(a.revision!==undefined&&b.revision!==undefined)same(a.revision,b.revision,area+': falta recuperar la revisión confirmada.');}
function protectedState(before,after,area){same(before.subjectKey,after.subjectKey,area+': cambió el UID.');same(before.protected,after.protected,area+': una acción alteró invariantes protegidas.');}
function receipt(value,area){check(value?.accepted===true,area+': el cambio no fue confirmado.');return value;}
function method(scenario,name,area){check(typeof scenario?.[name]==='function',area+': falta mapeo QA '+name+'.');}
async function runIntegrationChecks(adapter,{allowUnit=false}={}){
  check(adapter&&typeof adapter.createScenario==='function','Falta un adaptador externo explícito; no se ejecutó ninguna integración.');
  const m=adapter.metadata;
  check(m?.production===false,'El harness no admite producción. Utiliza cuentas y datos exclusivos de prueba.');
  check(['local-service','staging',...(allowUnit?['unit']:[])].includes(m?.mode),'Declara un entorno local/staging; una unidad simulada no acredita backend real.');
  check(m.independentSessions===true,'Se requieren sesiones independientes.');
  for(const area of AREAS)check(Array.isArray(m.contractReferences?.[area])&&m.contractReferences[area].length>0&&m.contractReferences[area].every(ref=>typeof ref==='string'&&ref.trim()),area+': documenta archivo/versión/contrato canónico.');
  const report={mode:m.mode,production:false,status:'complete',scope:'Sólo las proyecciones y operaciones mapeadas por el adaptador revisado.',areas:[]};
  for(const area of AREAS){
    const pending=m.pendingContracts?.[area]||[];check(Array.isArray(pending)&&pending.every(g=>GATES.includes(g)),area+': puerta QA desconocida.');
    if(pending.length){report.status='pending';report.areas.push({area,status:'pending',gates:[...pending]});continue;}
    let s,phase='prepare';
    try{
      s=await adapter.createScenario(area);method(s,'cleanup',area);
      if(area==='walk'){
        // Real contract: leash is per session. Reload/disconnect resets it; it is not persisted.
        method(s,'lifecycle',area);phase='session-lifecycle';const e=await s.lifecycle();
        check(e?.before?.leash===false&&e.active?.confirmed===true&&e.active.leash===true&&e.active.observerLeash===true,area+': falta confirmación y observación independiente de la correa.');
        check(e.reset?.leash===false&&['reload','disconnect'].includes(e.reset.trigger),area+': la correa debe reiniciarse según el ciclo de sesión.');
        check(e.before.protected&&Object.keys(e.before.protected).length>0,area+': faltan invariantes.');same(e.before.protected,e.active.protected,area+': el paseo cambió propiedad o saldo.');same(e.before.protected,e.reset.protected,area+': el cierre cambió propiedad o saldo.');
        report.areas.push({area,status:'complete',checks:['acknowledged-leash','independent-observer','session-reset'],persistence:'not-applicable'});continue;
      }
      const policy=s.policy||{};
      check(['atomic','revision'].includes(policy.concurrency),area+': declara la estrategia real; no se presupone CAS.');
      if(area==='home')check(policy.concurrency==='revision',area+': resolver conflicto de borradores de vivienda o declarar expected-revision pendiente.');
      check(['request-key','idempotent-state','not-applicable'].includes(policy.replay),area+': declara si corresponde repetición segura.');
      check(['server-event','explicit-refresh'].includes(policy.sync),area+': declara evento o lectura explícita; no son equivalentes.');
      for(const name of ['snapshot','commitFrom','waitForReplica','rejectUnauthorized','recoverInterrupted','reload','reauthenticate'])method(s,name,area);
      const read=async session=>snapshot(await s.snapshot(session),area,{revision:policy.concurrency==='revision'}),before=await read('A');consistent(before,await read('B'),area);
      phase='confirm-A';const first=receipt(await s.commitFrom('A'),area),afterA=await read('A');protectedState(before,afterA,area);if(first.revision!==undefined)same(afterA.revision,first.revision,area+': confirmación inconsistente.');check(!isDeepStrictEqual(before.value,afterA.value),area+': la fixture necesita un cambio observable.');
      if(policy.concurrency==='revision')check(!isDeepStrictEqual(before.revision,afterA.revision),area+': la revisión debe cambiar al confirmar un nuevo contenido.');
      phase='replica-B';await s.waitForReplica('B',afterA.revision);consistent(afterA,await read('B'),area);let prior=afterA;
      if(policy.replay!=='not-applicable'){
        method(s,'replayCommitted',area);phase='safe-replay';const replay=receipt(await s.replayCommitted(),area);check(typeof first.identity==='string'&&first.identity.length>0,area+': falta identidad del intento.');same(replay.identity,first.identity,area+': no se repitió el mismo intento.');prior=await read('A');same(prior.value,afterA.value,area+': repetir produjo otro efecto, entrega o cargo.');protectedState(before,prior,area);await s.waitForReplica('B',prior.revision);consistent(prior,await read('B'),area);
      }
      phase='confirm-B';const second=receipt(await s.commitFrom('B'),area),afterB=await read('B');protectedState(before,afterB,area);if(second.revision!==undefined)same(afterB.revision,second.revision,area+': confirmación B inconsistente.');check(!isDeepStrictEqual(prior.value,afterB.value),area+': B necesita un cambio distinto.');
      if(policy.concurrency==='revision')check(!isDeepStrictEqual(prior.revision,afterB.revision),area+': la revisión debe cambiar al confirmar un nuevo contenido.');
      await s.waitForReplica('A',afterB.revision);consistent(afterB,await read('A'),area);
      if(policy.concurrency==='revision'){method(s,'rejectStale',area);phase='stale-conflict';const stale=await s.rejectStale(before.revision);check(stale?.accepted===false&&stale.category==='conflict',area+': una revisión antigua no fue rechazada como conflicto.');consistent(afterB,await read('A'),area);}
      phase='permission';const denied=await s.rejectUnauthorized();check(denied?.accepted===false&&denied.category==='permission',area+': falta rechazo de una acción no autorizada.');consistent(afterB,await read('A'),area);
      phase='recovery';const recovery=await s.recoverInterrupted();check(recovery?.interrupted===true&&recovery.settled===true&&recovery.automaticRetries===0&&['committed','not-committed'].includes(recovery.outcome),area+': falta recuperación autoritativa sin reintentos automáticos.');const recovered=await read('A');protectedState(before,recovered,area);if(recovery.outcome==='not-committed')same(recovered.value,afterB.value,area+': un intento no recibido cambió el estado.');await s.waitForReplica('B',recovered.revision);consistent(recovered,await read('B'),area);
      phase='reload';await s.reload('A');consistent(recovered,await read('A'),area);phase='reauthentication';await s.reauthenticate('B');consistent(recovered,await read('B'),area);
      report.areas.push({area,status:'complete',policy,checks:['confirm-A','replica-B','confirm-B','replica-A','permission','recovery','reload','reauthentication',...(policy.replay==='not-applicable'?[]:['safe-replay']),...(policy.concurrency==='revision'?['stale-conflict']:[])]});
    }catch(error){throw new QAError(area+' / '+phase+': '+(error instanceof QAError?error.message:'Falló el adaptador externo; revisa su diagnóstico local redactado.'));}
    finally{if(typeof s?.cleanup==='function')await s.cleanup();}
  }
  return report;
}
async function loadExternalAdapter(filename){
  check(typeof filename==='string'&&path.isAbsolute(filename),'PENDIENTE: indica una ruta absoluta en ICADEM_MUNDO_ADAPTER. No hay adaptador configurado.');
  const module=await import(pathToFileURL(filename).href),create=module.createIntegrationAdapter||module.default?.createIntegrationAdapter;check(typeof create==='function','Exporta createIntegrationAdapter(); es una interfaz QA, no una API del juego.');return create();
}
module.exports={AREAS,GATES,runIntegrationChecks,loadExternalAdapter};
if(require.main===module)(async()=>{if(!process.env.ICADEM_MUNDO_ADAPTER){process.stderr.write('PENDIENTE: adaptador externo y puertas de Claude. No se verificó backend, permisos ni persistencia.\n');process.exitCode=2;return;}try{const report=await runIntegrationChecks(await loadExternalAdapter(process.env.ICADEM_MUNDO_ADAPTER));process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.status!=='complete')process.exitCode=2;}catch(error){process.stderr.write('No completado: '+(error instanceof QAError?error.message:'Falló el adaptador externo; revisa su diagnóstico local redactado.')+'\n');process.exitCode=1;}})();
