'use strict';
// Real presentation module, controlled configuration only; no backend or money writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const config={enabled:true,commissionCents:15000,discountCents:25000,directCommissionVipCents:15000,directCommissionFreeCents:10000,monthlyDiscountVipCents:25000,annualDiscountVipCents:30000,monthlyDiscountFreeCents:20000,annualDiscountFreeCents:25000,minimumPaidCents:20000,minimumWithdrawalCents:10000,validationDays:7,attributionDays:30,eligiblePlans:['mensual','anual']};
function markup(data){const window={},document={readyState:'loading',addEventListener(){}};let source=fs.readFileSync(__dirname+'/../js/icadem-ambassador-promo.js','utf8');source=source.replace('window.ICADEMAmbassadorPromo =','window.__popup = popupMarkup; window.ICADEMAmbassadorPromo =');vm.runInNewContext(source,{window,document,Intl,Date});return window.__popup(data,0);}
const text=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
test('modern popup preserves the real free and VIP financial amounts and the existing conditions',()=>{
 for(const [category,amounts]of [['free',['$100','$200','$250']],['vip',['$150','$250','$300']]]){
  const html=markup({registered:false,category,config}),copy=text(html);assert(copy.includes('Comparte ICADEM y gana'));
  for(const amount of amounts)assert(copy.includes(amount));
  for(const copyPart of ['Activa tu perfil','Comparte tu enlace','Recibe tu recompensa','7 días de validación','30 días','Retiro mínimo','contracargos','No volver a mostrar automáticamente'])assert(copy.includes(copyPart));
  assert.match(html,/data-amb-continue/);assert.match(html,/data-amb-optout/);assert.match(html,/data-amb-close/);assert.match(html,/Más tarde/);
 }
 const copy=text(markup({registered:false,category:'vip',config:{...config,directCommissionVipCents:17500,monthlyDiscountVipCents:27500,annualDiscountVipCents:32500,validationDays:9}}));
 for(const amount of ['$175','$275','$325','9 días de validación'])assert(copy.includes(amount));assert(!copy.includes('$150'));
});
test('modern popup never fabricates a category reward when server amounts are missing',()=>{
 for(const category of ['free','vip'])for(const value of [undefined,NaN,0,-100,1.5]){
  const field=category==='vip'?'directCommissionVipCents':'directCommissionFreeCents';const copy=text(markup({registered:false,category,config:{...config,[field]:value}}));
  assert(!/\$NaN|Tu recompensa|Tu invitado ahorra/.test(copy));assert(copy.includes('Consulta los beneficios y las condiciones vigentes'));
 }
 assert(!/\$100|\$150|\$NaN/.test(text(markup(null))));
});
