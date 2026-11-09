/* Directory presentation only. Membership, ordering and profile writes remain authoritative. */
(function(){
  'use strict';
  var GOLD='#E9BC43',BLUE='#244B64',LEGACY='#173b56';
  function safeUrl(value){var raw=String(value||'');return /^(https:\/\/|assets\/|\.\/|\/(?!\/))/i.test(raw)&&!/[\u0000-\u001f]/.test(raw)?raw:'';}
  function appearance(card,vip){var color=String(card.portadaColor||'');return{color:vip&&/^#[0-9a-f]{6}$/i.test(color)&&(card.portadaColorPersonalizado===true||color.toLowerCase()!==LEGACY)?color:vip?GOLD:BLUE,image:vip?safeUrl(card.portadaUrl):''};}
  function cropRect(width,height,zoom,x,y){var w=Math.min(width,height*4)/Math.max(1,Math.min(3,Number(zoom)||1)),h=w/4;return{x:(width-w)*Math.max(0,Math.min(100,Number(x)))/100,y:(height-h)*Math.max(0,Math.min(100,Number(y)))/100,width:w,height:h};}
  function editorMarkup(){return '<section class="dir-cover-editor" id="dirf-cover-editor"><div class="dir-form__sep">Portada VIP</div><div class="dir-cover-preview" data-cover-preview><img data-cover-image alt="Vista previa de tu portada" hidden></div><label class="dir-form__lbl" for="dirf-cover-color">Color de portada</label><div class="dir-cover-color-row"><input class="dir-form__in" id="dirf-cover-color" type="color" aria-label="Color de portada"><button type="button" class="btn btn--ghost btn--sm" data-cover-reset>Restablecer color original</button></div><div class="dir-cover-actions"><button type="button" class="btn btn--ghost btn--sm" data-cover-pick>Subir imagen de portada</button><button type="button" class="btn btn--ghost btn--sm" data-cover-remove>Quitar imagen</button><input type="file" id="dirf-cover-file" accept="image/jpeg,image/png,image/webp" hidden></div><p class="dir-cover-help">JPEG, PNG o WebP · máximo 2 MB. Mantén el detalle principal en el centro.</p><div class="dir-cover-crop" data-cover-crop hidden><strong>Ajusta el encuadre</strong><canvas width="1400" height="350" data-cover-canvas aria-label="Vista previa del encuadre"></canvas><label>Acercamiento<input type="range" min="1" max="3" step="0.05" value="1" data-cover-zoom></label><label>Posición horizontal<input type="range" min="0" max="100" value="50" data-cover-x></label><label>Posición vertical<input type="range" min="0" max="100" value="50" data-cover-y></label><div class="dir-cover-actions"><button type="button" class="btn btn--accent btn--sm" data-cover-confirm>Usar este encuadre</button><button type="button" class="btn btn--ghost btn--sm" data-cover-cancel>Cancelar</button></div></div><progress data-cover-progress aria-label="Guardando portada" hidden></progress><p class="dir-cover-status" data-cover-status role="status" aria-live="polite"></p></section>';}
  function bindEditor(root,data){
    if(!root)return null;var color=root.querySelector('#dirf-cover-color'),file=root.querySelector('#dirf-cover-file'),preview=root.querySelector('[data-cover-preview]'),image=root.querySelector('[data-cover-image]'),crop=root.querySelector('[data-cover-crop]'),canvas=root.querySelector('canvas'),status=root.querySelector('[data-cover-status]'),progress=root.querySelector('progress'),initial=appearance(data,true),pending,changed=false,reset=false,source=null,reading=false;
    color.value=initial.color;
    function message(text,error){status.textContent=text;status.classList.toggle('is-error',Boolean(error));}
    function paint(){var url=pending===undefined?initial.image:pending||'';preview.style.backgroundColor=color.value;image.hidden=!url;if(url)image.src=url;else image.removeAttribute('src');root.querySelector('[data-cover-remove]').disabled=!url;}
    function draw(){if(!source)return;var r=cropRect(source.naturalWidth,source.naturalHeight,root.querySelector('[data-cover-zoom]').value,root.querySelector('[data-cover-x]').value,root.querySelector('[data-cover-y]').value);canvas.getContext('2d').drawImage(source,r.x,r.y,r.width,r.height,0,0,1400,350);}
    color.addEventListener('input',function(){changed=true;reset=false;paint();message('Color preparado. Guarda tu tarjeta para aplicarlo.');});
    root.querySelector('[data-cover-reset]').addEventListener('click',function(){color.value=GOLD;changed=true;reset=true;paint();message('Color original preparado. La imagen, si existe, se conserva hasta que la quites.');});
    root.querySelector('[data-cover-remove]').addEventListener('click',function(){pending=null;paint();message('Imagen retirada de la vista previa. Guarda tu tarjeta para confirmar.');});
    root.querySelector('[data-cover-pick]').addEventListener('click',function(){file.click();});
    file.addEventListener('change',async function(){
      var selected=file.files?.[0];file.value='';if(!selected)return;
      if(!['image/jpeg','image/png','image/webp'].includes(selected.type)){message('Usa una imagen JPEG, PNG o WebP.',true);return;}
      if(selected.size>2*1024*1024){message('La portada debe pesar menos de 2 MB.',true);return;}
      reading=true;message('Preparando imagen…');
      try{
        var dataUrl=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=reject;reader.readAsDataURL(selected);});
        source=await new Promise(function(resolve,reject){var img=new Image();img.onload=function(){resolve(img);};img.onerror=reject;img.src=dataUrl;});
        if(source.naturalWidth*source.naturalHeight>40000000)throw Error('Imagen demasiado grande');
        root.querySelector('[data-cover-zoom]').value='1';root.querySelector('[data-cover-x]').value='50';root.querySelector('[data-cover-y]').value='50';crop.hidden=false;draw();message('Ajusta el encuadre y confirma o cancela. Todavía no se ha guardado.');root.querySelector('[data-cover-zoom]').focus();
      }catch(error){source=null;crop.hidden=true;message('No pudimos leer esa imagen. Elige otro archivo válido de hasta 40 megapíxeles.',true);}
      finally{reading=false;}
    });
    root.querySelectorAll('input[type=range]').forEach(function(input){input.addEventListener('input',draw);});
    root.querySelector('[data-cover-confirm]').addEventListener('click',function(){if(!source)return;var quality=.84,result=canvas.toDataURL('image/jpeg',quality);while(result.length>650000&&quality>.44){quality-=.08;result=canvas.toDataURL('image/jpeg',quality);}pending=result;source=null;crop.hidden=true;paint();message('Portada preparada. Guarda tu tarjeta para aplicarla.');root.querySelector('[data-cover-pick]').focus();});
    root.querySelector('[data-cover-cancel]').addEventListener('click',function(){source=null;crop.hidden=true;message('Encuadre cancelado. Tu portada anterior se conserva.');root.querySelector('[data-cover-pick]').focus();});
    paint();
    return{ready:function(){if(reading||!crop.hidden){message('Confirma o cancela el encuadre antes de guardar.',true);return false;}return true;},payload:function(){var p={};if(changed){if(reset)p.resetCoverColor=true;else p.portadaColor=color.value;}if(pending===null)p.removeCover=true;else if(typeof pending==='string')p.coverDataUrl=pending;return p;},saving:function(active){progress.hidden=!active;if(active)message(pending?'Subiendo portada y guardando perfil…':'Guardando perfil…');root.querySelectorAll('button,input').forEach(function(control){control.disabled=active;});if(!active)paint();},error:function(text){message(text||'No pudimos guardar la portada. Puedes volver a intentarlo.',true);}};
  }
  window.ICADEMDirectory={appearance:appearance,cropRect:cropRect,editorMarkup:editorMarkup,bindEditor:bindEditor};
})();
