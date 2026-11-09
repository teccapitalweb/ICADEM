'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const now=Date.parse('2026-11-09T18:00:00Z');
function app(vip=true){
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context={window:{},document:{addEventListener(){},querySelectorAll(){return [];}},location:{search:''},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},Intl,Date:Clock,URLSearchParams,crypto:require('node:crypto')};
  if(vip)vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-ambassadors-vip.js','utf8').replace('window.ICADEMAmbassadorsVIP={render:render,bind:bind};','window.__vip={periodModel,filterRecords,distribution};window.ICADEMAmbassadorsVIP={render:render,bind:bind};'),context);
  vm.runInNewContext(fs.readFileSync(__dirname+'/../js/icadem-ambassadors.js','utf8').replace('window.ICADEMAmbassadors={render:','window.__core={dashboardMarkup,setPresentation:value=>{presentationMode=value;}};window.ICADEMAmbassadors={render:'),context);
  return{context,model:context.window.__vip?.periodModel,filter:context.window.__vip?.filterRecords,markup:context.window.__core.dashboardMarkup,setPresentation:context.window.__core.setPresentation};
}
function data(extra={}){return{registered:true,category:'vip',ambassador:{active:true,code:'REA-ABCDE',name:'Nombre Privado',whatsapp:{registered:true,masked:'+52 ••• ••• 9821'}},wallet:{availableCents:15000,pendingCents:30000,reservedCents:10000,paidCents:20000,totalEarnedCents:45000},benefits:{directCommissionCents:17500,monthlyDiscountCents:27500,annualDiscountCents:32500},config:{validationDays:7,attributionDays:30},analytics:{uniqueVisits:10,registeredVisitors:4,paidVisitors:2,visitorsWithoutPurchase:8,paidReferrals:3},commissions:[{buyer:'Referido ABCDEF',status:'pending',paidAt:'2026-11-09T18:00:00Z',amountPaidCents:20000,commissionCents:15000,plan:'mensual'}],referrals:[{buyer:'Referido ABCDEF',registeredAt:'2026-11-08T18:00:00Z',status:'pending',commissionCents:15000}],network:{directAmbassadors:[],generations:[],indirectCommissionsEnabled:false},...extra};}

test('periodos usan fechas reales en México y no mezclan comisiones con el importe de la compra',()=>{
  const ui=app(),value=data({commissions:[...data().commissions,{status:'reversed',paidAt:'2026-11-08',commissionCents:90000},{status:'ineligible',paidAt:'2026-11-08',commissionCents:80000},{status:'paid',paidAt:'2026-05-02T18:00:00Z',commissionCents:15000},{status:'pending',commissionCents:50000}],referrals:[...data().referrals,{registeredAt:'2026-11-10T04:00:00Z'},{buyer:'Sin fecha'}]});
  for(const [period,length] of [['7d',7],['30d',30],['3m',3],['6m',6],['12m',12]])assert.equal(ui.model(value,period,now).buckets.length,length);
  const result=ui.model(value,'7d',now);
  assert.equal(result.totalMoney,15000);assert.equal(result.totalSales,1);assert.equal(result.totalRegistrations,2);
  assert.equal(result.buckets.at(-1).key,'2026-11-09');assert.equal(result.buckets.at(-1).cumulativeRegistrations,2);
  assert.equal(result.undatedCommissions,1);assert.equal(result.undatedReferrals,1);
  assert.equal(ui.model(value,'12m',now).totalMoney,30000);
});

test('filtros de tablas conservan estados y excluyen fechas fuera del periodo',()=>{
  const ui=app(),items=[{status:'pending',paidAt:'2026-11-09T18:00:00Z'},{status:'paid',paidAt:'2026-01-10T18:00:00Z'},{status:'reversed',paidAt:'2026-11-09T18:00:00Z'}];
  assert.equal(ui.filter(items,'confirmed','7d','paidAt',now).length,1);
  assert.equal(ui.filter(items,'paid','all','paidAt',now).length,1);
  assert.equal(ui.filter(items,'reversed','7d','paidAt',now).length,1);
  assert.equal(items.length,3);
});

test('VIP respeta el orden, código y beneficios reales y reutiliza todas las acciones',()=>{
  const ui=app(),html=ui.markup(data());
  let previous=-1;for(const section of ['hero','summary','share','analysis','network','referrals','commissions','withdrawals']){const index=html.indexOf('data-vip-section="'+section+'"');assert.ok(index>previous,section);previous=index;}
  assert.match(html,/REA-ABCDE/);assert.match(html,/\$175/);assert.match(html,/\$275/);assert.match(html,/\$325/);
  for(const action of ['data-amb-copy="REA-ABCDE"','data-amb-share','data-amb-social="whatsapp"','data-amb-social="facebook"','data-amb-social="messenger"','data-amb-social="instagram"','data-amb-social="native"','data-amb-copy-message','data-amb-view="withdrawals"'])assert.ok(html.includes(action),action);
  assert.match(html,/av-line-chart/);assert.match(html,/av-bar-chart/);assert.match(html,/av-stacked/);assert.match(html,/av-ring/);
  assert.match(html,/Las visitas se reciben como acumulado/);assert.match(html,/no entrega las compras de otros niveles/);
  assert.doesNotMatch(html,/data-amb-bank(?:\s|>)|data-amb-whatsapp/);
});

test('los estados vacíos no dibujan barras ni crecimiento ficticio y se informa el límite de datos',()=>{
  const ui=app(),html=ui.markup(data({analytics:{uniqueVisits:0,registeredVisitors:0,paidVisitors:0,visitorsWithoutPurchase:0,paidReferrals:0},commissions:[],referrals:[],wallet:{availableCents:0,pendingCents:0,reservedCents:0,paidCents:0,totalEarnedCents:0}}));
  assert.match(html,/av-ring--empty/);assert.match(html,/No hay comisiones generadas en este periodo/);
  assert.doesNotMatch(html,/class="av-bar-chart"|class="av-line-chart"|NaN|Infinity/);
  const partial=ui.markup(data({commissions:Array.from({length:250},()=>data().commissions[0])}));assert.match(partial,/límite de 250 registros/);
});

test('distribución usa bolsas distintas del monedero sin volver a sumar el reservado como disponible',()=>{
  const ui=app();ui.markup(data());
  const html=ui.context.window.__vip.distribution({wallet:{availableCents:10000,pendingCents:10000,paidCents:10000,reservedCents:10000}});
  assert.equal((html.match(/width:25%/g)||[]).length,4);assert.match(html,/Reservadas para retiro/);
});

test('modo presentación protege nombres y códigos de la red y conserva indicadores',()=>{
  const ui=app();ui.setPresentation(true);const html=ui.markup(data({network:{directAmbassadors:[{code:'PER-XXXXX',active:true}],generations:[{level:1,ambassadors:1}]}}));
  assert.doesNotMatch(html,/Nombre Privado|PER-XXXXX|9821/);assert.match(html,/Saldo disponible/);assert.match(html,/REA-ABCDE/);
});

test('la misma respuesta gratuita genera exactamente la vista anterior',()=>{
  const input=data({category:'free'});assert.equal(app(true).markup(input),app(false).markup(input));
});

test('cambiar periodo y tipo de gráfica modifica solo la presentación de los registros recibidos',()=>{
  const ui=app(),input=data(),before=JSON.stringify(input);ui.markup(input);
  const chart={innerHTML:''},period={addEventListener(name,fn){this.change=fn;}},metric={dataset:{vipMetric:'sales'},addEventListener(name,fn){this.click=fn;},focus(){}};
  const root={querySelector(selector){return selector==='[data-vip-dashboard]'?{}:selector==='[data-vip-period]'?period:selector==='[data-vip-charts]'?chart:selector==='[data-vip-metric="sales"]'?metric:null;},querySelectorAll(selector){return selector==='[data-vip-metric]'?[metric]:[];}};
  ui.context.window.ICADEMAmbassadorsVIP.bind(root,input);period.change({target:{value:'7d'}});assert.match(chart.innerHTML,/7 días/);metric.click();assert.match(chart.innerHTML,/Evolución de mis ventas/);assert.match(chart.innerHTML,/1<\/strong><span>Compras elegibles/);assert.equal(JSON.stringify(input),before);
});
