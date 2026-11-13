'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const load=()=>import(pathToFileURL(path.join(__dirname,'../ciudad/js/ui/preview.js')).href);
function resources(group){const geometries=new Set(),owned=new Set(),shared=new Set();group.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]) (m.userData.shared?shared:owned).add(m);});return {geometries,owned,shared};}
function observe(values){const disposed=new Set();for(const value of values)value.addEventListener('dispose',()=>disposed.add(value));return disposed;}
async function fixture(run){
 const saved={document:global.document,cancelAnimationFrame:global.cancelAnimationFrame};
 const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),save(){},restore(){},setTransform(){},drawImage(){},putImageData(){}};
 global.document={createElement:()=>({setAttribute(){},addEventListener(){},getContext:()=>context,toDataURL:()=> 'data:image/png;base64,fixture'})};global.cancelAnimationFrame=()=>{};
 const renderer={target:{name:'game-target'},getRenderTarget(){return this.target;},setRenderTarget(t){this.target=t;},render(){},readRenderTargetPixels(){}};
 try{const {AvatarPreview}=await load();await run(new AvatarPreview(renderer,{width:16,height:16}),renderer);}finally{global.document=saved.document;global.cancelAnimationFrame=saved.cancelAnimationFrame;}
}
test('changing and closing a preview releases owned resources, preserves shared game materials and is idempotent',async()=>fixture(async preview=>{
 preview.show({hairStyle:'bun',accessories:['glasses']});const old=resources(preview.avatar.group),geometries=observe(old.geometries),owned=observe(old.owned),shared=observe(old.shared);
 preview.show({hairStyle:'short',accessories:['cap']});assert.equal(geometries.size,old.geometries.size);assert.equal(owned.size,old.owned.size);assert.equal(shared.size,0,'cached materials remain usable by game and other previews');
 const current=resources(preview.scene),remaining=observe(current.geometries),target=observe([preview.target]);preview.stop();assert.equal(remaining.size,current.geometries.size);assert.equal(target.size,1);assert.equal(preview.scene.children.length,0);preview.stop();assert.equal(target.size,1);assert.equal(shared.size,0);
}));
test('thumbnail snapshots release temporary avatars and restore the game render target even when rendering fails',async()=>fixture(async(preview,renderer)=>{
 preview.show({hairStyle:'long'});const keep=preview.avatar,gameTarget=renderer.target;let temporary,disposed;
 renderer.render=scene=>{const group=scene.children.find(n=>n.isGroup&&n!==keep.group);temporary=resources(group);disposed=observe(temporary.geometries);};
 assert.match(preview.still({hairStyle:'bun'}),/^data:image/);assert.equal(disposed.size,temporary.geometries.size);assert.equal(preview.avatar,keep);assert(preview.scene.children.includes(keep.group));assert.equal(renderer.target,gameTarget);
 renderer.render=scene=>{const group=scene.children.find(n=>n.isGroup&&n!==keep.group);temporary=resources(group);disposed=observe(temporary.geometries);throw Error('controlled GPU failure');};
 assert.throws(()=>preview.still({hairStyle:'short'}),/controlled GPU failure/);assert.equal(disposed.size,temporary.geometries.size);assert.equal(renderer.target,gameTarget);assert.deepEqual(preview.scene.children.filter(n=>n.isGroup),[keep.group]);preview.stop();
}));
