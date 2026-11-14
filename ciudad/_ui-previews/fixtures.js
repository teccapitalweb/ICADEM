// LOCAL DESIGN FIXTURES ONLY. No production catalog, balances or game rules.
export const PETS = Object.freeze([
  { id:'dog-sample', name:'Luna', species:'Perro', variant:'Compañera de muestra', kind:'dog', color:'#d5aa72', category:'Perros', owned:true },
  { id:'cat-sample', name:'Milo', species:'Gato', variant:'Compañero de muestra', kind:'cat', color:'#ad9dcc', category:'Gatos', owned:true },
  { id:'fantasy-sample', name:'Brisa', species:'Fantástico', variant:'Diseño de ficha de muestra', kind:'fantasy', color:'#80b8b1', category:'Fantásticos', owned:false }
]);
export const PRODUCTS = Object.freeze([
  {id:'hoodie-sample',name:'Sudadera de muestra',category:'Ropa',icon:'shirt',color:'#9c8bc7',price:180},
  {id:'chair-sample',name:'Sillón de muestra',category:'Muebles',icon:'chair',color:'#90b8ae',price:240},
  {id:'lamp-sample',name:'Lámpara de muestra',category:'Muebles',icon:'lamp',color:'#dbb966',price:120},
  {id:'ball-sample',name:'Pelota de muestra',category:'Juguetes',icon:'ball',color:'#d99caa',price:80},
  {id:'plant-sample',name:'Planta de muestra',category:'Muebles',icon:'plant',color:'#8fb79a',price:90},
  {id:'drink-sample',name:'Bebida de muestra',category:'Alimentos',icon:'cup',color:'#e8ba80',price:30},
  {id:'collar-sample',name:'Collar de muestra',category:'Accesorios',icon:'paw',color:'#98bdb2',price:110},
  {id:'pet-sample',name:'Ficha de compañero de muestra',category:'Mascotas',icon:'cat',color:'#b8a6ce',price:260}
]);
export const GAME_TITLES = Object.freeze(['Carrera del Saber','Manzanas Perdidas','Héroes de la Ciudad','Rescate Responsable','Guardianes del Parque','Veterinarios por un Día','Mercado Justo','Amigos del Agua','Aventura de las Emociones','Expedición del Conocimiento']);
export const GAME_THEMES = Object.freeze([{color:'#9b91c4',icon:'book',tag:'Energía y descubrimiento'},{color:'#cd8e9c',icon:'apple',tag:'Exploración alegre'},{color:'#83a9cb',icon:'city',tag:'Comunidad y colaboración'},{color:'#82b8ad',icon:'shield',tag:'Cuidado y calma'},{color:'#90b591',icon:'leaf',tag:'Naturaleza y equilibrio'},{color:'#8ebacc',icon:'vet',tag:'Cuidado animal'},{color:'#d2b775',icon:'shop',tag:'Intercambio y confianza'},{color:'#80b9c3',icon:'drop',tag:'Agua y bienestar'},{color:'#b39ac9',icon:'heart',tag:'Emociones y expresión'},{color:'#8d9fb8',icon:'compass',tag:'Exploración y conocimiento'}]);
export const FLAVORS = Object.freeze([{id:'limon',name:'Limón',color:'#c5d58a'},{id:'jamaica',name:'Jamaica',color:'#cc8ca1'},{id:'horchata',name:'Horchata',color:'#e7d3ae'}]);
export const initialFixtureModel = () => ({balance:600,ownedIds:[],equippedIds:[],purchases:[],progress:{level:4,xp:180,nextXp:300,rewards:[{id:'reward-sample',label:'Descubrimiento de muestra',amount:15}]},selectedPet:'dog-sample',companion:null,walking:false,paused:false,room:{item:'chair-sample',x:48,y:42,rotation:0,saved:true},water:null});

/** Local demonstration controller. Its actions and result shapes are NOT server contracts. */
export function createFixtureController({failNext=false}={}) {
  let state=initialFixtureModel();
  return { get model(){return structuredClone(state);}, async dispatch(action){
    if(failNext){failNext=false;return {ok:false,error:'Error de muestra. Puedes reintentar sin perder la selección.'};}
    if(!['selectPet','companion','startWalk','pauseWalk','finishWalk','purchase','equipSample','roomMove','roomSave','prepareWater','orderWater','questionAnswer'].includes(action.type))return {ok:false,error:'Acción no definida en este ensayo local.'};
    if(action.type==='selectPet')state.selectedPet=action.id;
    if(action.type==='companion')state.companion=action.active?state.selectedPet:null;
    if(action.type==='startWalk'){state.walking=true;state.paused=false;}
    if(action.type==='pauseWalk')state.paused=!state.paused;
    if(action.type==='finishWalk'){state.walking=false;state.paused=false;}
    if(action.type==='purchase'){
      const item=PRODUCTS.find(p=>p.id===action.id);
      if(!item||state.ownedIds.includes(item.id)||item.price>state.balance)return {ok:false,error:'Esta compra de muestra no está disponible.'};
      state.balance-=item.price;state.ownedIds.push(item.id);state.purchases.push({id:'purchase-'+state.purchases.length,itemId:item.id,name:item.name,amount:item.price,at:'Hoy · muestra'});
    }
    if(action.type==='equipSample'){if(!state.ownedIds.includes(action.id))return {ok:false,error:'Esta muestra aún no está en el inventario local.'};state.equippedIds=action.active?[...new Set([...state.equippedIds,action.id])]:state.equippedIds.filter(id=>id!==action.id);}
    if(action.type==='roomMove'){state.room={...state.room,...action.patch,saved:false};}
    if(action.type==='roomSave')state.room.saved=true;
    if(action.type==='prepareWater'||action.type==='orderWater')state.water={flavor:action.flavor,mode:action.type};
    const feedback=action.type==='questionAnswer'?{correct:action.choice===1,answerIndex:1,explain:'Un cuadrado tiene cuatro esquinas. Esta pregunta es una muestra de composición, sin XP.'}:undefined;
    return {ok:true,model:structuredClone(state),feedback};
  }};
}
