'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {openServer}=require('./helpers/ciudad-server.cjs');
const load=relative=>import(pathToFileURL(path.join(__dirname,'..',relative)).href);
const legacy={outfit:'base',hat:'base',tone:'base'};

test('appearance defaults and old profiles retain the exact legacy shape and original looks',async()=>{
 const rules=await load('ciudad/js/progress/rules.js'),{AVATARS}=await load('ciudad/js/characters/catalog.js'),{Store,defaultState}=await load('ciudad/js/core/store.js');
 assert.deepEqual(rules.cleanCustom(null),legacy);assert.deepEqual(defaultState().custom,legacy);assert.deepEqual(rules.emptyProfile().custom,legacy);
 assert.deepEqual(rules.cleanCustom({outfit:'coral',hat:'cap',tone:'t4'}),{outfit:'coral',hat:'cap',tone:'t4'});
 const explicitBase=Object.fromEntries(Object.keys(rules.COSMETIC_OPTIONS).map(key=>[key,'base']));assert.deepEqual(rules.cleanCustom(explicitBase),legacy);
 for(const avatar of AVATARS){const before=JSON.stringify(avatar.look);assert.deepEqual(rules.applyCustom(avatar.look,legacy),avatar.look);assert.equal(JSON.stringify(avatar.look),before);}
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v))};const first=new Store(storage);first.state.custom={outfit:'sol',hat:'cap',tone:'t5'};first.save();assert.deepEqual(new Store(storage).state.custom,first.state.custom);
});

test('every cosmetic slot accepts only catalog IDs, discards payload extras and resets to inherited defaults',async()=>{
 const rules=await load('ciudad/js/progress/rules.js');
 for(const [key,options]of Object.entries(rules.COSMETIC_OPTIONS)){
  assert(Object.isFrozen(options));assert.equal(new Set(options.map(o=>o.id)).size,options.length);assert(options.some(o=>o.id==='base'));
  for(const option of options){assert(Object.isFrozen(option));assert(option.name.length>2);const cleaned=rules.cleanCustom({[key]:option.id,arbitrary:'not-accepted',xp:99999});assert.deepEqual(Object.keys(cleaned).sort(),(option.id==='base'?Object.keys(legacy):[...Object.keys(legacy),key]).sort());assert.equal(cleaned[key],option.id==='base'?undefined:option.id);assert.deepEqual(rules.cleanCustom({...cleaned,[key]:'base'}),legacy);}
  for(const bad of ['inventado','<script>',123,{},[],null])assert.deepEqual(rules.cleanCustom({[key]:bad}),legacy);
 }
 for(const option of rules.HAT_OPTIONS)assert.equal(rules.cleanCustom({hat:option.id}).hat,option.id);
 assert.deepEqual(rules.cleanCustom(JSON.parse('{"__proto__":{"top":"hoodie"},"customColor":"#fff","inventory":["all"],"xp":99999}')),legacy);
});

test('fashion projects real styles and colors without mutating base models or overriding existing outfit/skin choices',async()=>{
 const rules=await load('ciudad/js/progress/rules.js'),{AVATARS}=await load('ciudad/js/characters/catalog.js');
 const look=AVATARS.find(a=>a.id==='explorador').look,before=JSON.stringify(look);
 const custom={top:'denimJacket',bottom:'flare',shoes:'boots',bag:'handbag',hairStyle:'waves',hairColor:'lavanda',necklace:'pearls',hat:'beret',tone:'t5'};
 const dressed=rules.applyCustom(look,custom);
 assert.equal(dressed.topStyle,'denimJacket');assert.equal(dressed.top,0x4f78a9);assert.equal(dressed.bottomStyle,'flare');assert.equal(dressed.bottom,0x4b6f96);assert.equal(dressed.shoeStyle,'boots');assert.equal(dressed.shoes,0x563a2f);assert.equal(dressed.bagStyle,'handbag');assert.equal(dressed.necklaceStyle,'pearls');assert.equal(dressed.hairStyle,'waves');assert.equal(dressed.hair,0x9473c6);assert.equal(dressed.skin,0x6b4129);
 assert(dressed.accessories.includes('beret'));assert(!dressed.accessories.includes('explorerHat'));assert(!dressed.accessories.includes('backpack'));assert(!dressed.accessories.includes('scarf'));
 assert.equal(rules.applyCustom(look,{...custom,outfit:'coral'}).top,0xe86a5c,'the existing selected outfit color takes precedence over the garment default');assert.equal(JSON.stringify(look),before);
 const judge=AVATARS.find(a=>a.id==='juez').look;assert(!rules.applyCustom(judge,{top:'hoodie'}).accessories.includes('robe'));assert(rules.applyCustom(judge,{top:'base'}).accessories.includes('robe'));
 assert.equal(rules.applyCustom(look,{bag:'none'}).bagStyle,'none');assert(!rules.applyCustom(look,{bag:'none'}).accessories.includes('backpack'));
});

test('server profile persistence accepts validated fashion and preserves progression, currency and avatar locks',async()=>{
 const {Profiles,MemoryStorage}=await load('_ciudad-server/profiles.js'),storage=new MemoryStorage(),profiles=new Profiles({storage,missions:new Map()});
 const before=await profiles.get('fashion-owner'),custom={...legacy,top:'cropTop',bottom:'pleatedSkirt',shoes:'chunky',bag:'crossbody',hairStyle:'pigtails',hairColor:'rosa',necklace:'heart',hat:'bucketHat'};
 const accepted=await profiles.setAvatar('fashion-owner','universitaria',{...custom,credits:99999,topStyle:'unvalidated'},{customVersion:2});assert.equal(accepted.ok,true);assert.deepEqual(accepted.profile.custom,custom);
 const restored=await new Profiles({storage,missions:new Map()}).get('fashion-owner');assert.deepEqual(restored.custom,custom);assert.equal(restored.avatarChosen,true);
 for(const key of ['xp','testCredits','missions','visited','play','privacy','chat'])assert.deepEqual(restored[key],before[key],key+' is independent from fashion');
 const blocked=await profiles.setAvatar('fashion-owner','leyenda',{...custom,top:'hoodie'});assert.equal(blocked.ok,false);assert.equal(blocked.reason,'avatar-bloqueado');assert.deepEqual(blocked.profile.custom,custom);
 const reset=await profiles.setAvatar('fashion-owner','universitaria',legacy,{customVersion:2});assert.deepEqual(reset.profile.custom,legacy);
 assert.deepEqual((await profiles.get('other-owner')).custom,legacy);
});

test('legacy saves preserve unknown-to-them fashion while V2 snapshots can reset it deliberately',async()=>{
 const {Profiles,MemoryStorage}=await load('_ciudad-server/profiles.js'),profiles=new Profiles({storage:new MemoryStorage(),missions:new Map()});
 const current={...legacy,top:'cropTop',bottom:'flare',shoes:'chunky',bag:'handbag',hairStyle:'bob',hairColor:'lavanda',necklace:'pearls'};
 await profiles.setAvatar('mixed-clients','universitaria',current,{customVersion:2});
 const oldClient=await profiles.setAvatar('mixed-clients','universitaria',{outfit:'coral',hat:'cap',tone:'t2'});assert.deepEqual(oldClient.profile.custom,{...current,outfit:'coral',hat:'cap',tone:'t2'});
 const oldPartial=await profiles.setAvatar('mixed-clients','universitaria',{tone:'t5'});assert.deepEqual(oldPartial.profile.custom,{...current,tone:'t5'},'omitted old fields still use the original base defaults; only new fields inherit');
 const explicitBase=await profiles.setAvatar('mixed-clients','universitaria',{...legacy,bag:'base',hairStyle:'invented'});const expected={...current};delete expected.bag;delete expected.hairStyle;assert.deepEqual(explicitBase.profile.custom,expected,'explicit values still pass the same finite sanitizer');
 const [fresh,lateOld]=await Promise.all([profiles.setAvatar('mixed-clients','universitaria',current,{customVersion:2}),profiles.setAvatar('mixed-clients','universitaria',{outfit:'cielo'})]);assert.deepEqual(fresh.profile.custom,current);assert.deepEqual(lateOld.profile.custom,{...current,outfit:'cielo'},'a serialized old-client save cannot wipe a new-client outfit');
 await profiles.setAvatar('mixed-clients','universitaria',{...current,hat:'bucketHat'},{customVersion:2});
 const oldUnknownHat=await profiles.setAvatar('mixed-clients','universitaria',{outfit:'coral',hat:'base'});assert.equal(oldUnknownHat.profile.custom.hat,'bucketHat','a legacy normalization of an unknown hat cannot silently erase it');
 const omittedHat=await profiles.setAvatar('mixed-clients','universitaria',{tone:'t4'});assert.equal(omittedHat.profile.custom.hat,'bucketHat');
 const legacyRemove=await profiles.setAvatar('mixed-clients','universitaria',{hat:'none'});assert.equal(legacyRemove.profile.custom.hat,'none','the existing no-hat choice remains functional');
 await profiles.setAvatar('mixed-clients','universitaria',{...current,hat:'fedora'},{customVersion:2});const modernRemove=await profiles.setAvatar('mixed-clients','universitaria',{...current,hat:'base'},{customVersion:2});assert.equal(modernRemove.profile.custom.hat,'base','a V2 original-hat selection deliberately resets a new hat');
 const original=await profiles.setAvatar('mixed-clients','universitaria',legacy,{customVersion:2});assert.deepEqual(original.profile.custom,legacy);
});

test('real socket updates, roster and another session carry the same validated fashion IDs',async t=>{
 const server=await openServer(t);if(!server)return t.skip('npm ci in _ciudad-server enables local socket checks');
 const owner=await server.client('fashion-owner'),observer=await server.client('fashion-observer');
 const custom={...legacy,top:'hoodie',bottom:'cargo',shoes:'sneakers',bag:'tote',hairStyle:'curly',hairColor:'cobrizo',necklace:'goldChain',hat:'beanie'};
 owner.tell({t:'profile',op:'avatar',id:'universitaria',customVersion:2,custom:{...custom,inventory:'all',xp:99999,admin:true}});
 const changed=await owner.wait('profile',m=>m.op==='avatar');assert.equal(changed.ok,true);assert.deepEqual(changed.profile.custom,custom);assert.equal(changed.profile.xp,0);assert.equal(changed.profile.testCredits,0);
 const look=await observer.wait('look',m=>m.pid===owner.welcome.pid);assert.equal(look.avatar,'universitaria');assert.deepEqual(look.custom,custom);
 const anotherSession=await server.client('fashion-owner');assert.deepEqual(anotherSession.welcome.profile.custom,custom);assert.equal(anotherSession.welcome.profile.avatarId,'universitaria');assert.equal(anotherSession.welcome.profile.avatarChosen,true);
 const lateObserver=await server.client('fashion-late-observer'),roster=lateObserver.welcome.roster.find(p=>p.pid===anotherSession.welcome.pid);assert(roster);assert.deepEqual(roster.custom,custom);
 anotherSession.tell({t:'profile',op:'avatar',id:'leyenda',custom});assert.equal((await anotherSession.wait('profile',m=>m.op==='avatar')).reason,'avatar-bloqueado');
 anotherSession.tell({t:'profile',op:'avatar',id:'universitaria',custom:{outfit:'coral',hat:'cap',tone:'t4'}});const legacyUpdate=await anotherSession.wait('profile',m=>m.op==='avatar');assert.deepEqual(legacyUpdate.profile.custom,{...custom,outfit:'coral',hat:'cap',tone:'t4'});assert.deepEqual((await observer.wait('look',m=>m.custom?.outfit==='coral')).custom,legacyUpdate.profile.custom);
 anotherSession.tell({t:'profile',op:'avatar',id:'universitaria',customVersion:2,custom:legacy});assert.deepEqual((await anotherSession.wait('profile',m=>m.op==='avatar')).profile.custom,legacy);assert.deepEqual((await observer.wait('look',m=>!m.custom?.top)).custom,legacy);
});

test('family profiles keep cosmetics separate from the guardian and retain existing child restrictions',async t=>{
 const server=await openServer(t,{family:true});if(!server)return t.skip('npm ci in _ciudad-server enables family socket checks');
 const guardian=await server.client('fashion-guardian');guardian.tell({t:'profile',op:'family',action:'add',alias:'Sofi',band:'6-8',consent:true});const added=await guardian.wait('profile',m=>m.op==='family');assert.equal(added.ok,true);const id=added.family[0].id;
 const {ticket}=await (await server.post('/dev/ticket',{uid:'fashion-guardian',name:'Guardian'})).json(),child=await server.client('ignored',{ticket,kid:id});
 const custom={...legacy,top:'tee',bottom:'straight',shoes:'chunky',bag:'crossbody',hairStyle:'pigtails',hairColor:'rosa',necklace:'heart',hat:'bucketHat'};
 child.tell({t:'profile',op:'avatar',id:'creativa',customVersion:2,custom:{...custom,adultAt:99999,privacy:{listed:true}}});const changed=await child.wait('profile',m=>m.op==='avatar');assert.equal(changed.ok,true);assert.deepEqual(changed.profile.custom,custom);assert.equal(changed.profile.xp,0);assert.equal(changed.profile.testCredits,0);assert.equal(changed.profile.chat.enabled,false);
 guardian.tell({t:'profile',op:'get'});assert.deepEqual((await guardian.wait('profile',m=>m.op==='get')).profile.custom,legacy);
 child.tell({t:'profile',op:'family',action:'list'});assert.equal((await child.wait('profile',m=>m.op==='family')).reason,'no-permitido');
 child.tell({t:'profile',op:'avatar',id:'creativa',custom:{...legacy,outfit:'cielo'}});const legacyChild=await child.wait('profile',m=>m.op==='avatar');const expected={...custom,outfit:'cielo'};assert.deepEqual(legacyChild.profile.custom,expected);
 const freshTicket=(await (await server.post('/dev/ticket',{uid:'fashion-guardian',name:'Guardian'})).json()).ticket;
 const childAgain=await server.client('ignored',{ticket:freshTicket,kid:id});assert.deepEqual(childAgain.welcome.profile.custom,expected);assert.deepEqual(childAgain.welcome.family,{enabled:true,kind:'infantil'});assert.equal(childAgain.welcome.chat.enabled,false);
 childAgain.tell({t:'profile',op:'avatar',id:'creativa',customVersion:2,custom:legacy});assert.deepEqual((await childAgain.wait('profile',m=>m.op==='avatar')).profile.custom,legacy);
});
