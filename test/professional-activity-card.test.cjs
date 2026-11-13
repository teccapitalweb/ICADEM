'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/icadem-professional-activity.js','utf8');
const handlers=source.slice(source.indexOf('  function postHref('),source.indexOf('  function viewer('));
function fixture(options={}){
 const opened=[],selected={isCollapsed:true},link={dataset:{activityOpen:'original-post-7'},contains:node=>node==='selected-card-text'},control=options.internal?{matches:selector=>options.internal==='link'&&selector==='a[href]'}:link;
 const window={getSelection:()=>selected,ICADEMProfessionalNavigation:{openActivityPost:id=>opened.push(id)}};
 const context={window,URL,location:{href:'https://www.icademx.com/vip-panel.html?profesional=real-author&editar=basicos#directorio-actividad'}};
 vm.runInNewContext(handlers,context);
 let prevented=0;const event={currentTarget:link,target:{closest:()=>control},detail:1,button:0,defaultPrevented:false,preventDefault(){prevented++;this.defaultPrevented=true;},...options.event};
 return {opened,selected,event,click:()=>context.openCard(event),href:id=>context.postHref(id),prevented:()=>prevented};
}
test('activity card native link points at exactly the original post without profile or editor intent',()=>{
 const f=fixture(),url=new URL(f.href('original-post-7'));
 assert.equal(url.href,'https://www.icademx.com/vip-panel.html?publicacion=original-post-7#foro');
 assert.equal(url.searchParams.has('profesional'),false);assert.equal(url.searchParams.has('editar'),false);
});
test('normal pointer and native Enter activation each use the existing history-aware navigator once',()=>{
 for(const detail of [0,1]){const f=fixture({event:{detail}});f.click();assert.deepEqual(f.opened,['original-post-7']);assert.equal(f.prevented(),1);}
});
test('modified and non-primary clicks keep native link behavior',()=>{
 for(const event of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}]){
   const f=fixture({event});f.click();assert.deepEqual(f.opened,[]);assert.equal(f.prevented(),0);
 }
});
test('an internal control never also triggers the original-publication navigation',()=>{
 const f=fixture({internal:true});f.click();assert.deepEqual(f.opened,[]);assert.equal(f.prevented(),1);
});
test('an internal native link keeps its destination without triggering the publication link',()=>{
 for(const event of [{},{ctrlKey:true},{metaKey:true},{button:1}]){
   const f=fixture({internal:'link',event});f.click();assert.deepEqual(f.opened,[]);assert.equal(f.prevented(),0);assert.equal(f.event.defaultPrevented,false);
 }
});
test('selecting card text does not open it; selection elsewhere and keyboard activation still work',()=>{
 const f=fixture();Object.assign(f.selected,{isCollapsed:false,anchorNode:'selected-card-text'});f.click();assert.deepEqual(f.opened,[]);assert.equal(f.prevented(),1);
 const elsewhere=fixture();Object.assign(elsewhere.selected,{isCollapsed:false,anchorNode:'other-text'});elsewhere.click();assert.deepEqual(elsewhere.opened,['original-post-7']);
 const keyboard=fixture({event:{detail:0}});Object.assign(keyboard.selected,{isCollapsed:false,anchorNode:'selected-card-text'});keyboard.click();assert.deepEqual(keyboard.opened,['original-post-7']);
});
