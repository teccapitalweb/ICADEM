'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url'),baseline=require('./fixtures/ciudad-avatar-base-shapes.json');
const load=relative=>import(pathToFileURL(path.join(__dirname,'../ciudad/js',relative)).href);
function signature(avatar){const parts=[];avatar.group.updateMatrixWorld(true);avatar.group.traverse(node=>{if(!node.isMesh)return;parts.push({positions:Array.from(node.geometry.attributes.position.array,n=>Math.round(n*baseline.precision)),normals:Array.from(node.geometry.attributes.normal?.array||[],n=>Math.round(n*baseline.precision)),matrix:node.matrixWorld.elements.map(n=>Math.round(n*baseline.precision)),material:[node.material.color?.getHex(),node.material.roughness,node.material.metalness,node.material.opacity,node.material.transparent]});});return {hash:crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex'),meshes:parts.length};}

test('default equipment preserves the existing geometry, material colours and joint placement of all 22 avatars',async()=>{
 const {createAvatar}=await load('characters/avatar.js'),{AVATARS}=await load('characters/catalog.js'),{applyCustom}=await load('progress/rules.js'),{disposeTree}=await load('core/engine.js');
 assert.equal(AVATARS.length,Object.keys(baseline.records).length);
 for(const item of AVATARS){const model=createAvatar(applyCustom(item.look,{outfit:'base',hat:'base',tone:'base'}));assert.deepEqual(signature(model),baseline.records[item.id],item.id+' base remains the shape from '+baseline.sourceCommit);disposeTree(model.group);}
});

test('each new fashion style creates distinct real geometry while keeping lightweight finite bounds',async()=>{
 const {createAvatar}=await load('characters/avatar.js'),{avatarById}=await load('characters/catalog.js'),{applyCustom}=await load('progress/rules.js'),{disposeTree}=await load('core/engine.js'),THREE=await load('three.js');
 const options={top:['tee','hoodie','denimJacket','blazer','cropTop'],bottom:['straight','cargo','flare','skirt','pleatedSkirt'],shoes:['sneakers','chunky','boots','loafers'],bag:['handbag','tote','crossbody'],hairStyle:['bob','ponytail','curly','pigtails','waves'],hat:['beanie','bucketHat','beret','fedora','cowboyHat'],necklace:['goldChain','pearls','heart']};
 for(const [key,ids]of Object.entries(options)){
  const hashes=new Set();
  for(const id of ids){const model=createAvatar(applyCustom(avatarById('universitaria').look,{[key]:id,hat:key==='hat'?id:'none'})),shape=signature(model),bounds=new THREE.Box3().setFromObject(model.group),size=bounds.getSize(new THREE.Vector3());let vertices=0;
   model.group.traverse(node=>{if(!node.isMesh)return;const array=node.geometry.attributes.position.array;vertices+=array.length/3;assert(Array.from(array).every(Number.isFinite),key+' '+id+' has finite vertices');});
   assert(shape.meshes<65,key+' '+id+' remains bounded in draw meshes');assert(vertices<65000,key+' '+id+' remains lightweight');assert(size.x<1.4&&size.z<1.4&&bounds.max.y<2.1&&bounds.min.y>-.09,key+' '+id+' stays within cosmetic avatar bounds');
   assert.equal(model.height,1.72,'cosmetics preserve the declared avatar height');assert(!hashes.has(shape.hash),key+' '+id+' renders a distinct model, not a renamed duplicate');hashes.add(shape.hash);disposeTree(model.group);
  }
 }
});

test('fashion pieces stay attached to existing joints through all current animation states',async()=>{
 const {createAvatar}=await load('characters/avatar.js'),{avatarById}=await load('characters/catalog.js'),{applyCustom}=await load('progress/rules.js'),{disposeTree}=await load('core/engine.js');
 const create=bag=>createAvatar(applyCustom(avatarById('universitaria').look,{top:'cropTop',bottom:'pleatedSkirt',shoes:'chunky',bag,hairStyle:'pigtails',hairColor:'rosa',hat:'beret',necklace:'heart'}));
 const model=create('handbag'),torso=model.head.parent,bag=model.group.getObjectByName('fashion-bag');
 assert.equal(bag.parent.parent,torso,'handbag follows the existing arm joint');assert.equal(bag.parent.position.x,-.285);assert.equal(bag.parent.position.y,.5);
 assert.equal(model.group.getObjectByName('fashion-skirt').parent,torso);assert.equal(model.group.getObjectByName('fashion-hair').parent,model.head);
 for(const [name,state]of [['idle',{}],['walk',{speed:3}],['run',{speed:6}],['jump',{grounded:false}],['sit',{sitting:true}]]){for(let i=0;i<20;i++)model.update(.016,state);assert.equal(model.anim,name);model.group.updateMatrixWorld(true);model.group.traverse(node=>assert(node.matrixWorld.elements.every(Number.isFinite),name+' has finite transforms'));}
 for(const name of ['wave','celebrate','interact','beckon','clap','point','help','talk']){model.playEmote(name,1);model.update(.016,{grounded:true});assert.equal(model.emote,name);}
 const crossed=create('crossbody');assert.equal(crossed.group.getObjectByName('fashion-bag').parent,crossed.head.parent,'crossbody follows the torso joint');disposeTree(model.group);disposeTree(crossed.group);
});
