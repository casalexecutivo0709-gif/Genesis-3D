/* Genesis 3D — desktop, biblioteca e pipeline resiliente de imagens. */
(function(){
  'use strict';
  const VIEW_KEY='genesis3d:viewMode';
  const VALID_IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
  const state={context:'calc',actionImageId:null,editor:null,editorUrl:'',previewUrl:'',previewTimer:0,pullBusy:false,lastMenuOpen:0};
  const coreMediaPutBlob=mediaPutBlob;
  const coreImportImageFileToMedia=importImageFileToMedia;
  const coreLocalMirrorImage=genesisLocalMirrorImage;

  function idbRequest(storeName,mode,callback){
    return openMediaDb().then(db=>new Promise(resolve=>{
      if(!db||!db.objectStoreNames.contains(storeName)){resolve(null);return;}
      try{
        const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName),request=callback(store);
        if(request&&'onsuccess' in request){request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>resolve(null);}
        else{tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}
      }catch(error){resolve(null);}
    }));
  }
  const imageQueueAll=()=>idbRequest(IMAGE_QUEUE_STORE,'readonly',store=>store.getAll()).then(rows=>rows||[]);
  const imageQueuePut=row=>idbRequest(IMAGE_QUEUE_STORE,'readwrite',store=>store.put(row));
  const imageQueueDelete=id=>idbRequest(IMAGE_QUEUE_STORE,'readwrite',store=>store.delete(id));
  const imageVersionPut=row=>idbRequest(IMAGE_VERSION_STORE,'readwrite',store=>store.put(row));
  const imageVersionAll=()=>idbRequest(IMAGE_VERSION_STORE,'readonly',store=>store.getAll()).then(rows=>rows||[]);

  function safeName(value){return String(value||'imagem').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._ -]+/gi,'').trim().replace(/\s+/g,'-').slice(0,90)||'imagem';}
  function nowIso(){return new Date().toISOString();}
  function imageEntity(id){return imageEntities.find(item=>item.id===id)||null;}
  function upsertImageEntity(id,patch={}){
    if(!id)return null;
    let item=imageEntity(id),created=!item;
    if(!item){item={id,createdAt:Date.now(),created_at:nowIso(),versao:1,principal:true,deleted:false};imageEntities.unshift(item);}
    Object.assign(item,patch,{id,updatedAt:Date.now(),updated_at:nowIso()});
    item.created_at=item.created_at||nowIso();item.sync_status=item.sync_status||'pending';item.deleted=!!item.deleted;
    saveImages();
    if(created)genesisLog('image.entity.created',{imageId:id,origin:item.origem,size:item.tamanho_bytes});
    return item;
  }
  async function sha256(blob){
    try{const bytes=await blob.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
    catch(error){let hash=2166136261;for(const byte of new Uint8Array(await blob.arrayBuffer())){hash^=byte;hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);}
  }
  async function decodeImage(blob){
    if('createImageBitmap' in window){try{return await createImageBitmap(blob,{imageOrientation:'from-image'});}catch(error){}}
    return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Formato de imagem não suportado neste navegador.'))};img.src=url;});
  }
  function closeDecoded(image){try{image?.close?.();}catch(error){}}
  async function imageDimensions(blob){const image=await decodeImage(blob);const size={width:image.naturalWidth||image.width||0,height:image.naturalHeight||image.height||0};closeDecoded(image);return size;}
  async function canvasBlob(canvas,type='image/webp',quality=.86){
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
    if(!blob&&type!=='image/jpeg')blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    return blob;
  }
  async function createOptimizedVariant(blob,maxDim=1600,quality=.86){
    const image=await decodeImage(blob);let width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    const scale=Math.min(1,maxDim/Math.max(width,height));width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:true});ctx.drawImage(image,0,0,width,height);closeDecoded(image);
    const type=blob.type==='image/png'?'image/png':'image/webp',result=await canvasBlob(canvas,type,quality);canvas.width=1;canvas.height=1;
    if(!result)throw new Error('Não foi possível otimizar a imagem.');return {blob:result,width,height};
  }
  async function updateMediaRecord(id,patch){
    const db=await openMediaDb();if(!db)return false;
    const row=await mediaGetRecord(id);if(!row)return false;Object.assign(row,patch);
    return new Promise(resolve=>{try{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).put(row);tx.oncomplete=()=>{const old=mediaObjectUrlCache.get(id);if(old){URL.revokeObjectURL(old);mediaObjectUrlCache.delete(id);}resolve(true)};tx.onerror=()=>resolve(false);}catch(error){resolve(false)}});
  }
  function currentProductName(context){
    if(context==='quote')return document.getElementById('qProduct')?.value.trim()||'';
    if(context==='order')return document.getElementById('oProduct')?.value.trim()||'';
    return document.getElementById('inProduto')?.value.trim()||'';
  }
  function contextRecord(context){
    if(context==='quote'&&quoteEditId)return quotes.find(item=>item.id===quoteEditId)||null;
    if(context==='order'&&orderEditId)return orders.find(item=>item.id===orderEditId)||null;
    return null;
  }
  async function contextImageId(context){
    if(context==='quote')return activeQuoteImageId||null;
    if(context==='order')return activeOrderImageId||null;
    return currentPhotoImageId||null;
  }
  async function setContextImage(context,imageId,{toast=true}={}){
    const url=imageId?await mediaGetObjectUrl(imageId):'';
    if(context==='quote'){activeQuoteImageId=imageId||null;activeQuoteDraftPhotoDataUrl=null;await refreshQuotePhotoEditor();refreshQuoteUI();}
    else if(context==='order'){activeOrderImageId=imageId||null;activeOrderDraftPhotoDataUrl=null;await refreshOrderPhotoEditor();refreshOrderForm();}
    else{setPhoto(url||null,imageId||null);persistLastCalc();recalc();}
    const record=contextRecord(context),entity=context==='quote'?'orcamento':context==='order'?'pedido':'calculo';
    if(imageId)upsertImageEntity(imageId,{entidade:entity,entidade_id:record?.id||'',orcamento_id:context==='quote'?record?.id||'':'',pedido_id:context==='order'?record?.id||'':'',nome_produto:currentProductName(context),principal:true});
    saveActiveDraft('image-context-change');
    updateImageStatusBadges();scheduleLiveQuotePreview();
    if(toast)showToast(imageId?'Imagem vinculada ao item atual':'Imagem removida do item atual',true);
  }
  async function persistRichImage(file,{existingId=null,sourceType='manual',sourceUrl='',context=state.context}={}){
    if(!file)throw new Error('Selecione uma imagem.');
    const mime=String(file.type||'').toLowerCase();
    if(!VALID_IMAGE_TYPES.has(mime))throw new Error('Use JPEG, PNG, WebP ou HEIC compatível.');
    if(Number(file.size)>25*1024*1024)throw new Error('A imagem excede o limite de 25 MB.');
    const hash=await sha256(file),duplicate=imageEntities.find(item=>item.hash===hash&&!item.deleted);
    if(duplicate&&!existingId&&await mediaGetBlob(duplicate.id)){await setContextImage(context,duplicate.id,{toast:false});return {imageId:duplicate.id,previewUrl:await mediaGetObjectUrl(duplicate.id),blob:await mediaGetBlob(duplicate.id),deduplicated:true};}
    const imageId=await coreMediaPutBlob(file,existingId||undefined,{sourceType,sourceUrl,size:file.size,imageMimeType:mime});
    const [optimized,thumbnail,dimensions]=await Promise.all([createOptimizedVariant(file,1800,.88),createOptimizedVariant(file,360,.8),imageDimensions(file)]);
    await updateMediaRecord(imageId,{blob:optimized.blob,originalBlob:file,optimizedBlob:optimized.blob,thumbnailBlob:thumbnail.blob,imageMimeType:optimized.blob.type,originalMimeType:mime,size:optimized.blob.size,originalSize:file.size,width:dimensions.width,height:dimensions.height,thumbnailWidth:thumbnail.width,thumbnailHeight:thumbnail.height,fileName:safeName(file.name),hash,sourceType,sourceUrl,updatedAt:Date.now()});
    const record=contextRecord(context),entity=context==='quote'?'orcamento':context==='order'?'pedido':'calculo';
    upsertImageEntity(imageId,{entidade:entity,entidade_id:record?.id||'',orcamento_id:context==='quote'?record?.id||'':'',pedido_id:context==='order'?record?.id||'':'',nome_original:file.name||'imagem',nome_arquivo:`${imageId}.${optimized.blob.type.includes('png')?'png':'webp'}`,tipo_mime:optimized.blob.type,tamanho_bytes:file.size,largura:dimensions.width,altura:dimensions.height,hash,imagem_original_id:imageId,imagem_editada_id:'',thumbnail_id:imageId,versao:1,origem:sourceType,sourceType,sourceUrl,sync_status:'pending',principal:true,deleted:false});
    await enqueueImageSync(imageId);void flushImageQueue({silent:true});
    return {imageId,previewUrl:await mediaGetObjectUrl(imageId),blob:optimized.blob,imageMimeType:optimized.blob.type,size:optimized.blob.size,sourceType,sourceUrl};
  }
  mediaPutBlob=async function(blob,id,metadata={}){
    if(!blob)return null;
    const hash=metadata.hash||await sha256(blob),duplicate=!id?imageEntities.find(item=>item.hash===hash&&!item.deleted):null;
    if(duplicate&&await mediaGetBlob(duplicate.id))return duplicate.id;
    const imageId=await coreMediaPutBlob(blob,id,metadata),dimensions=await imageDimensions(blob).catch(()=>({width:0,height:0}));
    upsertImageEntity(imageId,{nome_original:metadata.fileName||'',nome_arquivo:metadata.fileName||`${imageId}.${blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg'}`,tipo_mime:blob.type||metadata.imageMimeType||'',tamanho_bytes:blob.size||0,largura:dimensions.width,altura:dimensions.height,hash,imagem_original_id:imageId,thumbnail_id:metadata.thumbnailId||'',origem:metadata.sourceType||'imported',sourceType:metadata.sourceType||'imported',sourceUrl:metadata.sourceUrl||'',sync_status:'pending'});
    await enqueueImageSync(imageId);return imageId;
  };
  importImageFileToMedia=async function(file,options={}){
    const source=String(options.sourceType||''),context=options.context||(source.includes('quote')?'quote':source.includes('order')?'order':'calc');
    return persistRichImage(file,{...options,existingId:null,context});
  };

  function imageQueueId(target,imageId){return `${target}:${imageId}`;}
  async function enqueueImageSync(imageId){
    if(!imageId)return;
    const local=loadLocalComputerConfig();
    if(local.enabled)await imageQueuePut({id:imageQueueId('local',imageId),target:'local',imageId,status:'pending',attempts:0,createdAt:Date.now(),updatedAt:Date.now(),nextAttemptAt:0});
    if(cfg.images?.driveSync)await imageQueuePut({id:imageQueueId('drive',imageId),target:'drive',imageId,status:'pending',attempts:0,createdAt:Date.now(),updatedAt:Date.now(),nextAttemptAt:0});
    updateLocalServerPanel();
  }
  function imageUploadHeaders(entity,row,variant){return {'X-Genesis-Variant':variant,'X-Genesis-File-Name':safeName(entity?.nome_original||row.fileName||entity?.nome_arquivo||'imagem'),'X-Genesis-Width':String(entity?.largura||row.width||0),'X-Genesis-Height':String(entity?.altura||row.height||0),'X-Genesis-Entity':String(entity?.entidade||''),'X-Genesis-Entity-Id':String(entity?.entidade_id||''),'X-Genesis-Hash':String(entity?.hash||row.hash||''),'X-Genesis-Source-Type':String(entity?.origem||row.sourceType||'')};}
  async function uploadImageLocal(imageId){
    const local=loadLocalComputerConfig();if(!local.enabled)throw new Error('Servidor local desativado.');
    const row=await mediaGetRecord(imageId);if(!row?.blob)throw new Error('Imagem não encontrada neste dispositivo.');
    const entity=imageEntity(imageId),variants=[['original',row.originalBlob||row.blob],['edited',row.editedBlob],['optimized',row.optimizedBlob||row.blob],['thumbnail',row.thumbnailBlob]].filter(([,blob])=>blob);
    let responseData=null;
    for(const [variant,blob] of variants){const response=await localComputerFetch('/v1/images/'+encodeURIComponent(imageId),{method:'POST',contentType:blob.type||'image/jpeg',headers:imageUploadHeaders(entity,row,variant),body:blob});responseData=await response.json();}
    upsertImageEntity(imageId,{local_file_id:imageId,local_url:responseData?.local_url||'',thumbnail_url:responseData?.thumbnail_url||entity?.thumbnail_url||'',sync_status:cfg.images?.driveSync&&!entity?.drive_file_id?'pending':'synced',local_synced_at:nowIso()});return true;
  }
  async function uploadImageDrive(imageId){
    if(!cfg.images?.driveSync)throw new Error('Google Drive desativado.');
    if(!window.genesisSheetsConfigured?.())throw new Error('Configure o Google Apps Script para usar o Drive.');
    const row=await mediaGetRecord(imageId),blob=row?.optimizedBlob||row?.blob;if(!blob)throw new Error('Imagem otimizada não encontrada.');
    const dataUrl=await blobToDataUrl(blob),entity=imageEntity(imageId);
    const result=await window.genesisSheetsApi('uploadImage',{image_id:imageId,reference_id:entity?.entidade_id||imageId,file_name:entity?.nome_arquivo||`${imageId}.webp`,mime_type:blob.type||'image/webp',base64:String(dataUrl||'').split(',')[1]||'',share_mode:cfg.images?.driveShareMode==='link'?'link':'private'});
    upsertImageEntity(imageId,{drive_file_id:result.file_id||'',drive_url:result.direct_url||result.url||'',sync_status:'synced',drive_synced_at:nowIso()});return true;
  }
  async function flushImageQueue({silent=false}={}){
    const rows=(await imageQueueAll()).filter(item=>item.status!=='synced'&&(!item.nextAttemptAt||item.nextAttemptAt<=Date.now())).sort((a,b)=>a.createdAt-b.createdAt);
    let done=0,failed=0;
    for(const item of rows){
      try{item.status='syncing';item.updatedAt=Date.now();await imageQueuePut(item);if(item.target==='local')await uploadImageLocal(item.imageId);else await uploadImageDrive(item.imageId);await imageQueueDelete(item.id);done++;}
      catch(error){item.status='failed';item.attempts=(item.attempts||0)+1;item.lastError=String(error.message||error).slice(0,300);item.nextAttemptAt=Date.now()+Math.min(300000,3000*Math.pow(2,item.attempts));item.updatedAt=Date.now();await imageQueuePut(item);failed++;genesisLog('image.sync.failed',{imageId:item.imageId,target:item.target,error},'warn');}
    }
    await updateLocalServerPanel();updateImageStatusBadges();
    if(!silent)showToast(failed?`${done} imagem(ns) sincronizada(s) · ${failed} aguardando nova tentativa`:`${done} imagem(ns) sincronizada(s)`,failed===0);
    return {done,failed};
  }
  genesisLocalMirrorImage=async function(imageId){await enqueueImageSync(imageId);setTimeout(()=>flushImageQueue({silent:true}),200);return true;};

  function linkImageToRecord(imageId,entity,record){
    if(!imageId||!record)return;
    upsertImageEntity(imageId,{entidade:entity,entidade_id:record.id,produto_id:record.productId||record.internalSnapshot?.modelId||'',orcamento_id:entity==='orcamento'?record.id:(record.originQuoteId||''),pedido_id:entity==='pedido'?record.id:'',nome_produto:record.productName||'',principal:true});
  }
  const coreSaveQuote=saveQuoteFromComposer;
  saveQuoteFromComposer=async function(...args){const record=await coreSaveQuote(...args);if(record){linkImageToRecord(record.imageId,'orcamento',record);await enqueueImageSync(record.imageId);}return record;};
  const coreSaveOrder=saveOrderFromForm;
  saveOrderFromForm=async function(...args){const record=await coreSaveOrder(...args);if(record){linkImageToRecord(record.imageId,'pedido',record);await enqueueImageSync(record.imageId);}return record;};

  function preferredView(){const saved=store.get(VIEW_KEY)||'automatic';return ['automatic','mobile','desktop'].includes(saved)?saved:'automatic';}
  function resolvedView(preference=preferredView()){if(preference==='mobile'||preference==='desktop')return preference;return matchMedia('(min-width: 900px)').matches?'desktop':'mobile';}
  function applyViewMode(preference,{announce=false}={}){
    const resolved=resolvedView(preference);store.set(VIEW_KEY,preference);document.documentElement.dataset.genesisView=resolved;document.documentElement.dataset.genesisViewPreference=preference;
    document.querySelectorAll('[data-genesis-view-option]').forEach(button=>button.classList.toggle('active',button.dataset.genesisViewOption===preference));
    document.querySelectorAll('.genesis-desktop-nav [data-screen]').forEach(button=>button.classList.toggle('active',document.getElementById('screen-'+button.dataset.screen)?.classList.contains('active')));
    if(announce)showToast(`Visualização ${preference==='automatic'?'automática':preference==='mobile'?'celular':'desktop'} ativada`,true);
    scheduleLiveQuotePreview();
  }
  window.addEventListener('resize',()=>{
    if(preferredView()!=='automatic')return;
    clearTimeout(state.viewResizeTimer);
    state.viewResizeTimer=setTimeout(()=>applyViewMode('automatic'),120);
  },{passive:true});
  function injectViewSettings(){
    const settings=document.getElementById('screen-settings');if(!settings||document.getElementById('genesisViewSettings'))return;
    const section=document.createElement('div');section.id='genesisViewSettings';section.className='card genesis-view-settings';section.innerHTML='<p class="card-label">Modo de visualização</p><div class="seg"><button type="button" data-genesis-view-option="automatic">Automático</button><button type="button" data-genesis-view-option="mobile">Celular</button><button type="button" data-genesis-view-option="desktop">Desktop</button></div><small>Altera somente a organização visual. A tela, o rascunho e os dados atuais permanecem abertos.</small>';
    settings.prepend(section);section.querySelectorAll('[data-genesis-view-option]').forEach(button=>button.addEventListener('click',()=>applyViewMode(button.dataset.genesisViewOption,{announce:true})));applyViewMode(preferredView());
  }
  function injectDesktopSidebar(){
    if(document.getElementById('genesisDesktopSidebar'))return;
    const sidebar=document.createElement('aside');sidebar.id='genesisDesktopSidebar';sidebar.className='genesis-desktop-sidebar';
    sidebar.innerHTML='<div class="genesis-desktop-brand"><img src="genesis-192.png" alt=""><div><strong>Genesis 3D</strong><small>Genesis Prototipagem</small></div></div><nav class="genesis-desktop-nav"><button data-screen="calc">▦ <span>Calculadora</span></button><button data-screen="quotes">▤ <span>Orçamentos</span></button><button data-screen="orders">▣ <span>Pedidos</span></button><button data-screen="kits">◇ <span>Kits</span></button><button data-screen="insights">⌁ <span>Insights</span></button><button data-screen="models">◉ <span>Modelos</span></button><button data-screen="filaments">◌ <span>Filamentos</span></button><button data-screen="settings">⚙ <span>Configurações</span></button></nav><div class="genesis-desktop-footer">Mesmo Genesis, mesmos dados e sincronização.<br><span id="genesisDesktopServerText">Servidor local não testado</span></div>';
    document.body.appendChild(sidebar);sidebar.querySelectorAll('[data-screen]').forEach(button=>button.addEventListener('click',()=>{showScreen(button.dataset.screen,true,{direct:true});sidebar.querySelectorAll('[data-screen]').forEach(item=>item.classList.toggle('active',item===button));}));
    document.addEventListener('click',event=>{const nav=event.target.closest('.navbtn[data-screen]');if(nav)sidebar.querySelectorAll('[data-screen]').forEach(item=>item.classList.toggle('active',item.dataset.screen===nav.dataset.screen));},true);
  }
  function enhanceCalculatorDesktop(){
    const screen=document.getElementById('screen-calc');if(!screen||screen.querySelector('.genesis-desktop-calc-main'))return;
    const main=document.createElement('div');main.className='genesis-desktop-calc-main';while(screen.firstChild)main.appendChild(screen.firstChild);screen.appendChild(main);
    const side=document.createElement('aside');side.className='genesis-desktop-calc-side';side.innerHTML='<div class="card"><p class="card-label">Imagem e prévia</p><div id="genesisDesktopCurrentImage" class="genesis-library-empty" style="padding:18px">Adicione uma imagem para visualizar aqui.</div><div class="genesis-image-tools"><button class="btn btn-secondary btn-sm" type="button" data-genesis-library="calc">Biblioteca</button><button class="btn btn-secondary btn-sm" type="button" data-genesis-edit-current="calc">Editar imagem</button></div><div id="genesisDesktopImageStatus"></div></div><div class="card"><p class="card-label">Resumo em tempo real</p><div class="detail-row"><span>Produto</span><b id="genesisDesktopProduct">—</b></div><div class="detail-row"><span>Tempo</span><b id="genesisDesktopTime">—</b></div><div class="detail-row"><span>Peso</span><b id="genesisDesktopWeight">—</b></div><div class="detail-row"><span>Preço direto</span><b id="genesisDesktopDirect">—</b></div><div class="detail-row"><span>Lucro direto</span><b id="genesisDesktopProfit">—</b></div></div>';
    screen.appendChild(side);
  }
  function enhanceQuoteComposerDesktop(){
    const sheet=document.getElementById('sheetCopy');if(!sheet||sheet.querySelector('.genesis-composer-layout'))return;
    const layout=document.createElement('div');layout.className='genesis-composer-layout';const form=document.createElement('div');form.className='genesis-composer-form';while(sheet.firstChild)form.appendChild(sheet.firstChild);
    const preview=document.createElement('aside');preview.className='genesis-live-preview';preview.innerHTML='<div class="preview-status" id="genesisLivePreviewStatus">Prévia atualizada em tempo real</div><img id="genesisLiveQuoteImage" alt="Prévia visual do orçamento">';layout.append(form,preview);sheet.appendChild(layout);
    sheet.addEventListener('input',scheduleLiveQuotePreview,true);sheet.addEventListener('change',scheduleLiveQuotePreview,true);
  }
  async function updateDesktopSummary(){
    const product=document.getElementById('genesisDesktopProduct');if(!product)return;
    product.textContent=(inProduto.value||'').trim()||'—';document.getElementById('genesisDesktopTime').textContent=lastResult?.ok?formatMinutes(Math.round(Number(lastResult.T||0)*60)):'—';document.getElementById('genesisDesktopWeight').textContent=inPeso.value?`${inPeso.value} g`:'—';document.getElementById('genesisDesktopDirect').textContent=lastResult?.ok?fmtBRL(getEffectiveDirectUnit()):'—';document.getElementById('genesisDesktopProfit').textContent=lastResult?.ok?fmtBRL(lastResult.lucroDiretoUnit||0):'—';
    const imageBox=document.getElementById('genesisDesktopCurrentImage'),imageId=currentPhotoImageId;if(!imageBox)return;
    if(imageId){const url=await mediaGetObjectUrl(imageId);imageBox.innerHTML=url?`<img src="${url}" alt="Imagem atual" style="width:100%;max-height:420px;object-fit:contain;border-radius:13px;background:#05070c">`:'Imagem indisponível neste dispositivo.';}else imageBox.innerHTML='Adicione, arraste ou cole uma imagem para visualizar aqui.';
  }
  function scheduleLiveQuotePreview(){
    clearTimeout(state.previewTimer);state.previewTimer=setTimeout(async()=>{
      if(document.documentElement.dataset.genesisView!=='desktop'||!document.getElementById('sheetCopy')?.classList.contains('open'))return;
      const image=document.getElementById('genesisLiveQuoteImage'),status=document.getElementById('genesisLivePreviewStatus');if(!image)return;
      try{status.textContent='Atualizando prévia…';const canvas=await createIndividualQuoteCanvas(quoteSnapshotFromComposer()),blob=await canvasBlob(canvas,'image/jpeg',.82);canvas.width=1;canvas.height=1;if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);state.previewUrl=URL.createObjectURL(blob);image.src=state.previewUrl;status.textContent='Prévia atualizada em tempo real';}
      catch(error){status.textContent='Preencha os dados para gerar a prévia.';}
    },280);
  }
  function installDesktopSummaryHooks(){document.getElementById('screen-calc')?.addEventListener('input',()=>setTimeout(updateDesktopSummary,0),true);document.getElementById('screen-calc')?.addEventListener('change',()=>setTimeout(updateDesktopSummary,0),true);}

  function injectImageSettings(){
    const anchor=document.getElementById('settingsSheetsAnchor');if(!anchor||document.getElementById('genesisImageCloudSettings'))return;
    cfg.images=Object.assign({driveSync:false,driveShareMode:'private'},cfg.images||{});
    const card=document.createElement('div');card.id='genesisImageCloudSettings';card.className='card';card.innerHTML='<p class="card-label">Sincronização opcional de imagens</p><label class="checkbox-row"><input type="checkbox" id="genesisDriveImageSync"><span>Enviar versão otimizada ao Google Drive</span></label><div class="field" style="margin-top:10px"><label>Acesso fora da rede local</label><select id="genesisDriveShareMode"><option value="private">Privado — baixar pela API autenticada</option><option value="link">Link de visualização — acesso mais simples no celular</option></select></div><small class="genesis-server-note">Usa apenas o espaço gratuito da sua própria conta. Ao atingir a cota, a imagem permanece no IndexedDB e no computador, sem cobrança automática.</small>';
    anchor.parentNode.insertBefore(card,anchor);card.querySelector('#genesisDriveImageSync').checked=!!cfg.images.driveSync;card.querySelector('#genesisDriveShareMode').value=cfg.images.driveShareMode||'private';
    card.addEventListener('change',()=>{cfg.images.driveSync=card.querySelector('#genesisDriveImageSync').checked;cfg.images.driveShareMode=card.querySelector('#genesisDriveShareMode').value;saveConfig();if(cfg.images.driveSync)imageEntities.forEach(item=>enqueueImageSync(item.id));});
  }
  function localCard(){return document.getElementById('localServerUrl')?.closest('.card')||null;}
  function injectLocalServerControls(){
    const card=localCard();if(!card||document.getElementById('genesisServerStats'))return;
    const panel=document.createElement('div');panel.innerHTML='<div class="genesis-server-stats" id="genesisServerStats"><div class="genesis-server-stat"><span>Último contato</span><b id="genesisServerLastContact">—</b></div><div class="genesis-server-stat"><span>Imagens locais</span><b id="genesisServerImageCount">—</b></div><div class="genesis-server-stat"><span>Espaço utilizado</span><b id="genesisServerBytes">—</b></div><div class="genesis-server-stat"><span>Aguardando envio</span><b id="genesisServerPending">0</b></div><div class="genesis-server-stat"><span>Último backup</span><b id="genesisServerBackup">—</b></div><div class="genesis-server-stat"><span>Versão</span><b id="genesisServerVersion">—</b></div></div><div class="genesis-server-actions"><button class="btn btn-secondary btn-sm" id="btnGenesisSyncImages" type="button">Sincronizar imagens</button><button class="btn btn-secondary btn-sm" id="btnGenesisOpenImageFolder" type="button">Abrir pasta de imagens</button><button class="btn btn-secondary btn-sm" id="btnGenesisBackupNow" type="button">Fazer backup agora</button><button class="btn btn-secondary btn-sm" id="btnGenesisImageLibrary" type="button">Biblioteca de imagens</button></div>';
    card.appendChild(panel);panel.querySelector('#btnGenesisSyncImages').addEventListener('click',async()=>{for(const entity of imageEntities.filter(item=>!item.deleted))await enqueueImageSync(entity.id);await flushImageQueue({silent:false});});
    panel.querySelector('#btnGenesisOpenImageFolder').addEventListener('click',async()=>{try{await localComputerFetch('/v1/folder/open',{method:'POST'});showToast('Pasta de imagens aberta no computador',true);}catch(error){showToast(error.message||'Não foi possível abrir a pasta.');}});
    panel.querySelector('#btnGenesisBackupNow').addEventListener('click',async()=>{try{await genesisLocalSyncSnapshot(false);showToast('Backup concluído',true);await updateLocalServerPanel();}catch(error){showToast(error.message||'Não foi possível fazer o backup.');}});
    panel.querySelector('#btnGenesisImageLibrary').addEventListener('click',()=>openImageLibrary('calc'));
  }
  function formatBytes(bytes){const value=Number(bytes)||0;if(value<1024)return value+' B';if(value<1048576)return (value/1024).toFixed(1)+' KB';if(value<1073741824)return (value/1048576).toFixed(1)+' MB';return (value/1073741824).toFixed(2)+' GB';}
  async function updateLocalServerPanel(){
    const queue=await imageQueueAll(),pending=queue.filter(item=>item.status!=='synced').length;const pendingEl=document.getElementById('genesisServerPending');if(pendingEl)pendingEl.textContent=String(pending);
    const local=loadLocalComputerConfig();if(!local.enabled||!local.serverUrl)return;
    try{const health=await (await localComputerFetch('/health')).json(),status=await (await localComputerFetch('/v1/status')).json();document.getElementById('genesisServerLastContact').textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});document.getElementById('genesisServerImageCount').textContent=String(status.imageCount||0);document.getElementById('genesisServerBytes').textContent=formatBytes(status.bytesUsed);document.getElementById('genesisServerBackup').textContent=status.lastBackup?new Date(status.lastBackup).toLocaleString('pt-BR'):'Nenhum';document.getElementById('genesisServerVersion').textContent='v'+(health.version||1);document.getElementById('genesisDesktopServerText').textContent='Servidor local conectado';setLocalComputerStatus('ok','Computador conectado · biblioteca disponível');}
    catch(error){const desktop=document.getElementById('genesisDesktopServerText');if(desktop)desktop.textContent='Servidor local desconectado';setLocalComputerStatus('bad','Servidor desconectado · dados preservados neste dispositivo');}
  }

  function modalTemplate(id,className,title,subtitle,body){return `<div class="genesis-modal-layer ${className||''}" id="${id}" aria-hidden="true"><div class="genesis-modal-card"><div class="genesis-modal-head"><div><h2>${title}</h2><p>${subtitle||''}</p></div><button class="genesis-modal-close" type="button" data-close-genesis-modal="${id}" aria-label="Fechar">×</button></div>${body}</div></div>`;}
  function injectImageModals(){
    if(document.getElementById('genesisImageLibraryModal'))return;
    const wrapper=document.createElement('div');wrapper.innerHTML=
      modalTemplate('genesisImageActionModal','genesis-action-menu','Ações da imagem','Original preservado; alterações criam novas versões.','<div class="genesis-action-grid" id="genesisImageActionGrid"></div>')+
      modalTemplate('genesisImageLibraryModal','','Biblioteca de imagens','Reutilize a mesma imagem sem gerar uma nova cópia.','<div class="genesis-library-toolbar"><input id="genesisLibrarySearch" type="text" placeholder="Pesquisar produto ou arquivo"><select id="genesisLibraryOrigin"><option value="">Todas as origens</option><option value="manual">Enviadas manualmente</option><option value="makerworld">MakerWorld</option><option value="server">Servidor local</option><option value="drive">Google Drive</option><option value="edited">Editadas</option></select></div><div class="genesis-library-grid" id="genesisLibraryGrid"></div>')+
      modalTemplate('genesisImageEditorModal','','Editor de imagem','Recorte, gire, espelhe e ajuste sem alterar o arquivo original.','<div class="genesis-editor-layout"><div class="genesis-editor-stage" id="genesisEditorStage"><canvas id="genesisEditorCanvas" width="900" height="700"></canvas></div><div class="genesis-editor-controls"><div class="control-group"><label>Proporção do recorte</label><select id="genesisEditorRatio"><option value="free">Livre</option><option value="1">Quadrada 1:1</option><option value="1.174">Card do orçamento</option></select></div><div class="control-group"><label>Zoom</label><input id="genesisEditorZoom" type="range" min="1" max="4" step="0.01" value="1"></div><div class="control-group"><label>Ajustes</label><div class="genesis-editor-buttons"><button class="btn btn-secondary" data-editor-action="left">↶ Girar esquerda</button><button class="btn btn-secondary" data-editor-action="right">↷ Girar direita</button><button class="btn btn-secondary" data-editor-action="flip-x">↔ Espelhar H</button><button class="btn btn-secondary" data-editor-action="flip-y">↕ Espelhar V</button><button class="btn btn-secondary" data-editor-action="center">Centralizar</button><button class="btn btn-secondary" data-editor-action="reset">Redefinir</button><button class="btn btn-secondary" data-editor-action="undo">Desfazer</button><button class="btn btn-secondary" data-editor-action="redo">Refazer</button></div></div><div class="genesis-editor-actions"><button class="btn btn-secondary" id="genesisEditorCancel" type="button">Cancelar</button><button class="btn btn-primary" id="genesisEditorSave" type="button">Salvar edição</button></div></div></div>')+
      modalTemplate('genesisPasteModal','genesis-paste-preview','Confirmar imagem colada','A imagem atual só será substituída depois da confirmação.','<img id="genesisPasteImage" alt="Prévia da imagem colada"><div class="btn-row"><button class="btn btn-secondary" id="genesisPasteCancel" type="button">Cancelar</button><button class="btn btn-primary" id="genesisPasteConfirm" type="button">Usar esta imagem</button></div>')+
      modalTemplate('genesisImageVersionsModal','','Versões da imagem','Restaure o original ou uma edição anterior.','<div class="genesis-library-grid" id="genesisImageVersionsGrid"></div>');
    while(wrapper.firstChild)document.body.appendChild(wrapper.firstChild);
    document.querySelectorAll('[data-close-genesis-modal]').forEach(button=>button.addEventListener('click',()=>closeGenesisModal(button.dataset.closeGenesisModal)));
    document.querySelectorAll('.genesis-modal-layer').forEach(layer=>layer.addEventListener('click',event=>{if(event.target===layer)closeGenesisModal(layer.id);}));
  }
  function openGenesisModal(id){const modal=document.getElementById(id);if(!modal)return;modal.classList.add('open');modal.setAttribute('aria-hidden','false');saveActiveDraft('before-image-modal');}
  function closeGenesisModal(id){const modal=document.getElementById(id);if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');if(id==='genesisImageEditorModal'){void clearEditorDraft();cleanupEditor();}}

  async function hydrateImageFromFallback(entity){
    if(!entity)return '';
    let url=await mediaGetObjectUrl(entity.id);if(url)return url;
    try{
      if(entity.local_file_id&&loadLocalComputerConfig().enabled){const response=await localComputerFetch('/v1/images/'+encodeURIComponent(entity.local_file_id)+'?variant=optimized'),blob=await response.blob();await coreMediaPutBlob(blob,entity.id,{sourceType:'server',sourceUrl:entity.local_url||''});return await mediaGetObjectUrl(entity.id);}
      if(entity.drive_file_id&&window.genesisSheetsConfigured?.()){const result=await window.genesisSheetsApi('downloadImage',{file_id:entity.drive_file_id}),bytes=atob(result.base64||''),array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);await coreMediaPutBlob(new Blob([array],{type:result.mime_type||entity.tipo_mime||'image/webp'}),entity.id,{sourceType:'drive',sourceUrl:entity.drive_url||''});return await mediaGetObjectUrl(entity.id);}
      if(entity.drive_url)return entity.drive_url;
    }catch(error){genesisLog('image.fallback.failed',{imageId:entity.id,error},'warn');}
    return '';
  }
  async function refreshLocalImageLibraryIndex(){
    const local=loadLocalComputerConfig();if(!local.enabled||!local.serverUrl)return 0;
    try{
      const response=await localComputerFetch('/v1/images'),payload=await response.json(),rows=Array.isArray(payload.images)?payload.images:[];let changed=false;
      for(const row of rows){
        if(!row?.id)continue;let entity=imageEntity(row.id);
        if(!entity){entity={id:row.id,createdAt:new Date(row.createdAt||Date.now()).getTime(),created_at:row.createdAt||nowIso(),versao:1,principal:false,deleted:false};imageEntities.push(entity);changed=true;}
        const patch={local_file_id:row.id,local_url:row.localUrl||'',thumbnail_url:row.thumbnailUrl||entity.thumbnail_url||'',nome_original:row.fileName||entity.nome_original||row.id,nome_arquivo:row.fileName||entity.nome_arquivo||row.id,tipo_mime:row.mime||entity.tipo_mime||'',tamanho_bytes:Number(row.size)||entity.tamanho_bytes||0,largura:Number(row.width)||entity.largura||0,altura:Number(row.height)||entity.altura||0,hash:row.hash||entity.hash||'',origem:entity.origem||row.sourceType||'server',sourceType:entity.sourceType||row.sourceType||'server',local_synced_at:row.updatedAt||nowIso(),sync_status:entity.drive_file_id||!cfg.images?.driveSync?'synced':'pending',updatedAt:new Date(row.updatedAt||Date.now()).getTime(),updated_at:row.updatedAt||nowIso()};
        for(const [key,value] of Object.entries(patch)){if(entity[key]!==value){entity[key]=value;changed=true;}}
      }
      if(changed)saveImages();return rows.length;
    }catch(error){genesisLog('image.library.local_index_failed',{error},'warn');return 0;}
  }
  async function renderImageLibrary(){
    const grid=document.getElementById('genesisLibraryGrid');if(!grid)return;const query=mwNormalizeText(document.getElementById('genesisLibrarySearch').value),origin=document.getElementById('genesisLibraryOrigin').value;
    let items=imageEntities.filter(item=>!item.deleted&&(!query||mwNormalizeText(`${item.nome_produto||''} ${item.nome_original||''} ${item.nome_arquivo||''}`).includes(query)));
    if(origin==='manual')items=items.filter(item=>/manual|photo|paste|drop/i.test(item.origem||''));else if(origin==='makerworld')items=items.filter(item=>/maker/i.test(item.origem||''));else if(origin==='server')items=items.filter(item=>item.local_file_id);else if(origin==='drive')items=items.filter(item=>item.drive_file_id);else if(origin==='edited')items=items.filter(item=>Number(item.versao)>1);
    items.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));grid.innerHTML=items.length?'':'<div class="genesis-library-empty">Nenhuma imagem encontrada.</div>';
    for(const item of items.slice(0,300)){
      const button=document.createElement('button');button.type='button';button.className='genesis-library-item';button.innerHTML='<div class="genesis-library-placeholder" style="aspect-ratio:1.18;display:grid;place-items:center;color:#7d748e">Carregando…</div><div><strong>'+escapeHtml(item.nome_produto||item.nome_original||item.nome_arquivo||'Imagem')+'</strong><small>'+escapeHtml(item.origem||'Genesis')+' · versão '+(Number(item.versao)||1)+'</small></div>';grid.appendChild(button);
      hydrateImageFromFallback(item).then(url=>{if(url){const placeholder=button.querySelector('.genesis-library-placeholder'),img=document.createElement('img');img.loading='lazy';img.src=url;img.alt='';placeholder.replaceWith(img);}else button.querySelector('.genesis-library-placeholder').textContent='Imagem fora deste dispositivo';});
      button.addEventListener('click',async()=>{await setContextImage(state.context,item.id);closeGenesisModal('genesisImageLibraryModal');});
      button.addEventListener('contextmenu',event=>{event.preventDefault();openImageActionMenu(state.context,item.id);});
    }
  }
  async function openImageLibrary(context='calc'){state.context=context;const grid=document.getElementById('genesisLibraryGrid');if(grid)grid.innerHTML='<div class="genesis-library-empty">Carregando biblioteca…</div>';openGenesisModal('genesisImageLibraryModal');await refreshLocalImageLibraryIndex();await renderImageLibrary();setTimeout(()=>document.getElementById('genesisLibrarySearch')?.focus(),80);}

  async function downloadImage(imageId){const blob=await mediaGetBlob(imageId);if(!blob){showToast('A imagem original não está disponível neste dispositivo.');return;}const entity=imageEntity(imageId),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=entity?.nome_original||entity?.nome_arquivo||`${imageId}.jpg`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  async function restoreOriginal(imageId){
    const row=await mediaGetRecord(imageId);if(!row?.originalBlob){showToast('A imagem original não está disponível neste dispositivo.');return;}
    const entity=imageEntity(imageId),version=(Number(entity?.versao)||1)+1;await imageVersionPut({id:`${imageId}:v${version-1}`,imageId,version:version-1,blob:row.blob,edit:entity?.edicao||null,createdAt:Date.now()});await updateMediaRecord(imageId,{blob:row.originalBlob,editedBlob:null,updatedAt:Date.now()});upsertImageEntity(imageId,{versao:version,imagem_editada_id:'',edicao:null,origem:entity?.origem||'manual',sync_status:'pending'});await enqueueImageSync(imageId);await setContextImage(state.context,imageId);showToast('Imagem original restaurada',true);
  }
  async function openImageVersions(imageId){
    state.actionImageId=imageId;const grid=document.getElementById('genesisImageVersionsGrid');grid.innerHTML='';const original=document.createElement('button');original.className='genesis-library-item';original.type='button';original.innerHTML='<div style="padding:28px;text-align:center;font-size:30px">↺</div><div><strong>Imagem original</strong><small>Arquivo preservado</small></div>';original.onclick=async()=>{await restoreOriginal(imageId);closeGenesisModal('genesisImageVersionsModal');};grid.appendChild(original);
    const versions=(await imageVersionAll()).filter(item=>item.imageId===imageId).sort((a,b)=>b.version-a.version);for(const item of versions){const button=document.createElement('button');button.className='genesis-library-item';button.type='button';button.innerHTML='<div style="padding:28px;text-align:center;font-size:28px">◫</div><div><strong>Versão '+item.version+'</strong><small>'+new Date(item.createdAt).toLocaleString('pt-BR')+'</small></div>';button.onclick=async()=>{await updateMediaRecord(imageId,{blob:item.blob,editedBlob:item.blob,updatedAt:Date.now()});upsertImageEntity(imageId,{versao:(Number(imageEntity(imageId)?.versao)||1)+1,edicao:item.edit||null,sync_status:'pending'});await enqueueImageSync(imageId);await setContextImage(state.context,imageId);closeGenesisModal('genesisImageVersionsModal');showToast('Versão restaurada',true);};grid.appendChild(button);}
    openGenesisModal('genesisImageVersionsModal');
  }
  async function openImageActionMenu(context,imageId){
    const now=Date.now();if(now-state.lastMenuOpen<450)return;state.lastMenuOpen=now;state.context=context;state.actionImageId=imageId||await contextImageId(context);if(!state.actionImageId){openImageLibrary(context);return;}
    const actions=[['Editar imagem','edit'],['Recortar','crop'],['Girar 90° à esquerda','left'],['Girar 90° à direita','right'],['Espelhar horizontalmente','flip-x'],['Espelhar verticalmente','flip-y'],['Ajustar enquadramento','fit'],['Substituir imagem','replace'],['Escolher da biblioteca','library'],['Definir como principal','primary'],['Restaurar original','restore'],['Versões anteriores','versions'],['Baixar imagem','download'],['Remover imagem','remove','danger'],['Cancelar','cancel']];
    const grid=document.getElementById('genesisImageActionGrid');grid.innerHTML=actions.map(([label,action,kind])=>`<button type="button" class="btn btn-secondary ${kind||''}" data-genesis-image-action="${action}">${label}</button>`).join('');grid.querySelectorAll('[data-genesis-image-action]').forEach(button=>button.addEventListener('click',()=>handleImageAction(button.dataset.genesisImageAction)));openGenesisModal('genesisImageActionModal');
  }
  async function handleImageAction(action){
    closeGenesisModal('genesisImageActionModal');const id=state.actionImageId;if(action==='cancel')return;if(action==='library'){openImageLibrary(state.context);return;}if(action==='replace'){document.querySelector(`[data-genesis-workspace-file="${state.context}"]`)?.click();return;}if(action==='download'){await downloadImage(id);return;}if(action==='restore'){await restoreOriginal(id);return;}if(action==='versions'){await openImageVersions(id);return;}if(action==='primary'){upsertImageEntity(id,{principal:true});showToast('Imagem definida como principal',true);return;}if(action==='remove'){showConfirm('Remover imagem','A imagem será desvinculada deste item. O original continuará preservado na biblioteca e nos registros anteriores.',async()=>{await setContextImage(state.context,null);},'Remover');return;}await openImageEditor(state.context,id,{initialAction:action});
  }

  function editorSnapshot(){const editor=state.editor;return {rotation:editor.rotation,flipX:editor.flipX,flipY:editor.flipY,zoom:editor.zoom,panX:editor.panX,panY:editor.panY,ratio:editor.ratio};}
  function applyEditorSnapshot(snapshot){Object.assign(state.editor,snapshot);document.getElementById('genesisEditorZoom').value=state.editor.zoom;document.getElementById('genesisEditorRatio').value=String(state.editor.ratio);renderEditor();scheduleEditorDraft();}
  function pushEditorHistory(){const editor=state.editor,current=JSON.stringify(editorSnapshot());if(editor.history.at(-1)!==current)editor.history.push(current);if(editor.history.length>40)editor.history.shift();editor.future=[];}
  function editorCropRect(){
    const canvas=document.getElementById('genesisEditorCanvas'),margin=46,maxW=canvas.width-margin*2,maxH=canvas.height-margin*2,editor=state.editor;let ratio=editor.ratio==='free'?editor.imageWidth/editor.imageHeight:Number(editor.ratio)||1;
    let width=maxW,height=width/ratio;if(height>maxH){height=maxH;width=height*ratio;}return {x:(canvas.width-width)/2,y:(canvas.height-height)/2,width,height,ratio};
  }
  function drawEditorImage(ctx,crop,output=false){
    const editor=state.editor,image=editor.image,rotation=((editor.rotation%360)+360)%360,swaps=rotation===90||rotation===270,rotWidth=swaps?editor.imageHeight:editor.imageWidth,rotHeight=swaps?editor.imageWidth:editor.imageHeight;
    const base=Math.max(crop.width/rotWidth,crop.height/rotHeight),scale=base*editor.zoom,panScale=output?crop.width/editor.stageCropWidth:1;
    ctx.save();ctx.beginPath();ctx.rect(crop.x,crop.y,crop.width,crop.height);ctx.clip();ctx.translate(crop.x+crop.width/2+editor.panX*panScale,crop.y+crop.height/2+editor.panY*panScale);ctx.rotate(rotation*Math.PI/180);ctx.scale((editor.flipX?-1:1)*scale,(editor.flipY?-1:1)*scale);ctx.drawImage(image,-editor.imageWidth/2,-editor.imageHeight/2,editor.imageWidth,editor.imageHeight);ctx.restore();
  }
  function renderEditor(){
    const editor=state.editor,canvas=document.getElementById('genesisEditorCanvas');if(!editor||!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#05070d';ctx.fillRect(0,0,canvas.width,canvas.height);const crop=editorCropRect();editor.stageCropWidth=crop.width;editor.stageCropHeight=crop.height;drawEditorImage(ctx,crop,false);ctx.save();ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);ctx.rect(crop.x,crop.y,crop.width,crop.height);ctx.fill('evenodd');ctx.strokeStyle='#b463ff';ctx.lineWidth=3;ctx.strokeRect(crop.x,crop.y,crop.width,crop.height);ctx.setLineDash([8,7]);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.moveTo(crop.x+crop.width/3,crop.y);ctx.lineTo(crop.x+crop.width/3,crop.y+crop.height);ctx.moveTo(crop.x+crop.width*2/3,crop.y);ctx.lineTo(crop.x+crop.width*2/3,crop.y+crop.height);ctx.moveTo(crop.x,crop.y+crop.height/3);ctx.lineTo(crop.x+crop.width,crop.y+crop.height/3);ctx.moveTo(crop.x,crop.y+crop.height*2/3);ctx.lineTo(crop.x+crop.width,crop.y+crop.height*2/3);ctx.stroke();ctx.restore();
  }
  async function openImageEditor(context,imageId,{initialAction='edit'}={}){
    const row=await mediaGetRecord(imageId),blob=row?.blob;if(!blob){showToast('A imagem não está disponível para edição.');return;}cleanupEditor();const url=URL.createObjectURL(blob),image=await new Promise((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=reject;element.src=url;});
    state.context=context;state.actionImageId=imageId;state.editor={imageId,image,row,imageWidth:image.naturalWidth||image.width,imageHeight:image.naturalHeight||image.height,rotation:0,flipX:false,flipY:false,zoom:1,panX:0,panY:0,ratio:initialAction==='crop'?'1.174':'free',history:[],future:[],drag:null,originalUrl:url,stageCropWidth:800,stageCropHeight:600};
    if(initialAction==='left')state.editor.rotation=-90;if(initialAction==='right')state.editor.rotation=90;if(initialAction==='flip-x')state.editor.flipX=true;if(initialAction==='flip-y')state.editor.flipY=true;if(initialAction==='fit')state.editor.zoom=1;
    document.getElementById('genesisEditorZoom').value=state.editor.zoom;document.getElementById('genesisEditorRatio').value=String(state.editor.ratio);pushEditorHistory();openGenesisModal('genesisImageEditorModal');renderEditor();await saveEditorDraft();
  }
  function cleanupEditor(){if(state.editor?.originalUrl)URL.revokeObjectURL(state.editor.originalUrl);state.editor=null;idbRequest(DRAFT_STORE,'readwrite',store=>store.delete('image-editor'));}
  function editorAction(action){
    const editor=state.editor;if(!editor)return;
    if(action==='undo'){if(editor.history.length<=1)return;editor.future.push(editor.history.pop());applyEditorSnapshot(JSON.parse(editor.history.at(-1)));return;}
    if(action==='redo'){if(!editor.future.length)return;const next=editor.future.pop();editor.history.push(next);applyEditorSnapshot(JSON.parse(next));return;}
    if(action==='left')editor.rotation-=90;if(action==='right')editor.rotation+=90;if(action==='flip-x')editor.flipX=!editor.flipX;if(action==='flip-y')editor.flipY=!editor.flipY;if(action==='center'){editor.panX=0;editor.panY=0;}if(action==='reset'){Object.assign(editor,{rotation:0,flipX:false,flipY:false,zoom:1,panX:0,panY:0,ratio:'free'});document.getElementById('genesisEditorRatio').value='free';document.getElementById('genesisEditorZoom').value='1';}
    pushEditorHistory();renderEditor();scheduleEditorDraft();
  }
  async function saveEditedImage(){
    const editor=state.editor;if(!editor)return;const crop=editorCropRect(),ratio=crop.ratio,max=1600;let width=ratio>=1?max:Math.round(max*ratio),height=ratio>=1?Math.round(max/ratio):max;width=Math.max(320,width);height=Math.max(320,height);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);drawEditorImage(ctx,{x:0,y:0,width,height},true);const blob=await canvasBlob(canvas,'image/webp',.9);canvas.width=1;canvas.height=1;if(!blob)throw new Error('Não foi possível salvar a edição.');
    const row=await mediaGetRecord(editor.imageId),entity=imageEntity(editor.imageId),currentVersion=Number(entity?.versao)||1;await imageVersionPut({id:`${editor.imageId}:v${currentVersion}`,imageId:editor.imageId,version:currentVersion,blob:row.blob,edit:entity?.edicao||null,createdAt:Date.now()});
    const edit={rotacao:editor.rotation,espelhamento_horizontal:editor.flipX,espelhamento_vertical:editor.flipY,posicao_recorte:{x:editor.panX,y:editor.panY},zoom:editor.zoom,proporcao:editor.ratio,largura_final:width,altura_final:height};await updateMediaRecord(editor.imageId,{blob,editedBlob:blob,originalBlob:row.originalBlob||row.blob,optimizedBlob:blob,edit,updatedAt:Date.now()});upsertImageEntity(editor.imageId,{versao:currentVersion+1,imagem_editada_id:`${editor.imageId}:v${currentVersion+1}`,tipo_mime:blob.type,tamanho_bytes:blob.size,largura:width,altura:height,edicao:edit,dados_json:{edicao:edit},sync_status:'pending'});await enqueueImageSync(editor.imageId);await setContextImage(state.context,editor.imageId,{toast:false});closeGenesisModal('genesisImageEditorModal');void flushImageQueue({silent:true});showToast('Edição salva; imagem original preservada',true);
  }
  let editorDraftTimer=0;function scheduleEditorDraft(){clearTimeout(editorDraftTimer);editorDraftTimer=setTimeout(saveEditorDraft,280);}
  function clearEditorDraft(){clearTimeout(editorDraftTimer);editorDraftTimer=0;return idbRequest(DRAFT_STORE,'readwrite',store=>store.delete('image-editor'));}
  async function saveEditorDraft(){if(!state.editor)return;await idbRequest(DRAFT_STORE,'readwrite',store=>store.put({id:'image-editor',imageId:state.editor.imageId,context:state.context,state:editorSnapshot(),updatedAt:Date.now()}));}
  async function restoreEditorDraft(){const draft=await idbRequest(DRAFT_STORE,'readonly',store=>store.get('image-editor'));if(!draft||Date.now()-Number(draft.updatedAt)>7*86400000)return;await openImageEditor(draft.context||'calc',draft.imageId);applyEditorSnapshot(draft.state||{});showToast('Edição de imagem restaurada',true);}

  function detectContext(){if(document.getElementById('sheetCopy')?.classList.contains('open'))return 'quote';if(document.getElementById('sheetOrderForm')?.classList.contains('open'))return 'order';return 'calc';}
  async function acceptImageFile(file,context,sourceType){
    state.context=context;setGenesisImageLoading(context,true);try{const asset=await persistRichImage(file,{sourceType,context});await setContextImage(context,asset.imageId,{toast:false});showToast('Imagem adicionada com sucesso',true);}
    catch(error){genesisLog('image.rich-import.failed',{context,sourceType,error},'error');showToast(error.message||'Não foi possível carregar essa imagem.');}finally{setGenesisImageLoading(context,false);}
  }
  function addImageTools(context,container){
    if(!container||container.querySelector(`[data-genesis-workspace-tools="${context}"]`))return;
    const block=document.createElement('div');block.dataset.genesisWorkspaceTools=context;block.innerHTML=`<div class="genesis-drop-zone" data-genesis-drop="${context}"><strong>Arraste uma imagem para cá</strong><small>ou cole com Ctrl + V</small></div><div class="genesis-image-tools"><button class="btn btn-secondary btn-sm" type="button" data-genesis-library="${context}">Biblioteca</button><button class="btn btn-secondary btn-sm" type="button" data-genesis-edit-current="${context}">Ações da imagem</button><label class="btn btn-secondary btn-sm">Selecionar imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-genesis-workspace-file="${context}" hidden></label></div><div data-genesis-image-status="${context}"></div>`;container.appendChild(block);
    const input=block.querySelector('[data-genesis-workspace-file]');input.addEventListener('change',()=>{const file=input.files?.[0];if(file)acceptImageFile(file,context,'manual-desktop');input.value='';});
    const zone=block.querySelector('[data-genesis-drop]');['dragenter','dragover'].forEach(name=>zone.addEventListener(name,event=>{event.preventDefault();zone.classList.add('dragging');}));['dragleave','drop'].forEach(name=>zone.addEventListener(name,event=>{event.preventDefault();zone.classList.remove('dragging');}));zone.addEventListener('drop',event=>{const file=[...(event.dataTransfer?.files||[])].find(item=>item.type.startsWith('image/'));if(file)acceptImageFile(file,context,'drag-drop');});
  }
  function injectImageTools(){
    addImageTools('calc',document.getElementById('photoPreviewWrap')?.parentElement);addImageTools('quote',document.getElementById('qPhotoManager'));addImageTools('order',document.getElementById('oPhotoManager'));
    document.querySelectorAll('[data-genesis-library]').forEach(button=>button.addEventListener('click',()=>openImageLibrary(button.dataset.genesisLibrary)));document.querySelectorAll('[data-genesis-edit-current]').forEach(button=>button.addEventListener('click',async()=>openImageActionMenu(button.dataset.genesisEditCurrent,await contextImageId(button.dataset.genesisEditCurrent))));
    [['photoPreview','calc'],['qPhotoEditorPreview','quote'],['oPhotoPreview','order']].forEach(([id,context])=>{const image=document.getElementById(id);if(!image)return;let hold=0,moved=false;const openCurrent=async()=>openImageActionMenu(context,await contextImageId(context));image.tabIndex=0;image.addEventListener('pointerdown',()=>{moved=false;hold=setTimeout(()=>{hold=0;openCurrent();},550)});image.addEventListener('pointermove',()=>{moved=true;if(hold){clearTimeout(hold);hold=0;}});image.addEventListener('pointerup',()=>{if(hold){clearTimeout(hold);hold=0;if(!moved)openCurrent();}});image.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCurrent();}});image.addEventListener('contextmenu',event=>{event.preventDefault();openCurrent();});});
  }
  let pendingPaste=null,pendingPasteUrl='';function cancelPaste(){if(pendingPasteUrl)URL.revokeObjectURL(pendingPasteUrl);pendingPaste=null;pendingPasteUrl='';closeGenesisModal('genesisPasteModal');}
  function installPasteHandler(){
    document.addEventListener('paste',event=>{if(document.getElementById('genesisImageEditorModal')?.classList.contains('open'))return;const item=[...(event.clipboardData?.items||[])].find(entry=>entry.type.startsWith('image/'));if(!item)return;const file=item.getAsFile();if(!file)return;event.preventDefault();pendingPaste={file,context:detectContext()};if(pendingPasteUrl)URL.revokeObjectURL(pendingPasteUrl);pendingPasteUrl=URL.createObjectURL(file);document.getElementById('genesisPasteImage').src=pendingPasteUrl;openGenesisModal('genesisPasteModal');});
    document.getElementById('genesisPasteCancel').addEventListener('click',cancelPaste);document.getElementById('genesisPasteConfirm').addEventListener('click',async()=>{const pending=pendingPaste;cancelPaste();if(pending)await acceptImageFile(pending.file,pending.context,'clipboard');});
  }
  function installEditorEvents(){
    document.getElementById('genesisEditorRatio').addEventListener('change',event=>{if(!state.editor)return;state.editor.ratio=event.target.value;pushEditorHistory();renderEditor();scheduleEditorDraft();});document.getElementById('genesisEditorZoom').addEventListener('input',event=>{if(!state.editor)return;state.editor.zoom=Number(event.target.value)||1;renderEditor();scheduleEditorDraft();});document.getElementById('genesisEditorZoom').addEventListener('change',pushEditorHistory);
    document.querySelectorAll('[data-editor-action]').forEach(button=>button.addEventListener('click',()=>editorAction(button.dataset.editorAction)));document.getElementById('genesisEditorCancel').addEventListener('click',()=>closeGenesisModal('genesisImageEditorModal'));document.getElementById('genesisEditorSave').addEventListener('click',()=>saveEditedImage().catch(error=>showToast(error.message||'Não foi possível salvar a edição.')));
    const canvas=document.getElementById('genesisEditorCanvas');canvas.addEventListener('pointerdown',event=>{if(!state.editor)return;pushEditorHistory();state.editor.drag={x:event.clientX,y:event.clientY,panX:state.editor.panX,panY:state.editor.panY};canvas.setPointerCapture(event.pointerId);});canvas.addEventListener('pointermove',event=>{const drag=state.editor?.drag;if(!drag)return;const rect=canvas.getBoundingClientRect(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;state.editor.panX=drag.panX+(event.clientX-drag.x)*scaleX;state.editor.panY=drag.panY+(event.clientY-drag.y)*scaleY;renderEditor();});canvas.addEventListener('pointerup',event=>{if(!state.editor?.drag)return;state.editor.drag=null;pushEditorHistory();scheduleEditorDraft();try{canvas.releasePointerCapture(event.pointerId)}catch(error){}});canvas.addEventListener('wheel',event=>{if(!state.editor)return;event.preventDefault();state.editor.zoom=Math.max(1,Math.min(4,state.editor.zoom+(event.deltaY<0?.08:-.08)));document.getElementById('genesisEditorZoom').value=state.editor.zoom;renderEditor();scheduleEditorDraft();},{passive:false});
  }
  async function updateImageStatusBadges(){
    for(const context of ['calc','quote','order']){const root=document.querySelector(`[data-genesis-image-status="${context}"]`);if(!root)continue;const id=await contextImageId(context),entity=imageEntity(id);if(!id){root.innerHTML='';continue;}let status=entity?.sync_status||'pending',label=status==='synced'?'Imagem sincronizada':entity?.drive_file_id?'Imagem salva no Drive':entity?.local_file_id?'Imagem salva localmente':'Imagem aguardando sincronização';if(status==='failed')label='Falha no envio · imagem preservada neste dispositivo';root.innerHTML=`<span class="genesis-image-sync-badge ${status}">${escapeHtml(label)}</span>`;}
  }

  async function migrateImageMetadata(){
    const rows=await idbRequest(MEDIA_STORE,'readonly',store=>store.getAll())||[],references=new Map();
    const add=(record,entity)=>{if(record?.imageId&&!references.has(record.imageId))references.set(record.imageId,{record,entity});};
    savedModels.forEach(item=>add(item,'produto'));history.forEach(item=>add(item,'calculo'));quotes.forEach(item=>add(item,'orcamento'));orders.forEach(item=>add(item,'pedido'));kits.forEach(kit=>(kit.items||[]).forEach(item=>add(item,'kit')));
    for(const row of rows){
      if(imageEntity(row.id))continue;const reference=references.get(row.id),record=reference?.record||{},dimensions={width:row.width||0,height:row.height||0};
      upsertImageEntity(row.id,{entidade:reference?.entity||'',entidade_id:record.id||'',produto_id:reference?.entity==='produto'?record.id:'',orcamento_id:reference?.entity==='orcamento'?record.id:(record.originQuoteId||''),pedido_id:reference?.entity==='pedido'?record.id:'',nome_produto:record.productName||record.title||record.name||'',nome_original:row.fileName||'',nome_arquivo:row.fileName||`${row.id}.bin`,tipo_mime:row.imageMimeType||row.blob?.type||'',tamanho_bytes:row.originalSize||row.size||row.blob?.size||0,largura:dimensions.width,altura:dimensions.height,hash:row.hash||'',imagem_original_id:row.id,imagem_editada_id:row.editedBlob?`${row.id}:v1`:'',thumbnail_id:row.thumbnailBlob?row.id:'',versao:row.editedBlob?2:1,origem:row.sourceType||'legacy',sourceType:row.sourceType||'legacy',sourceUrl:row.sourceUrl||'',sync_status:row.localSynced?'synced':'pending',principal:true,deleted:false});
    }
    try{localStorage.removeItem(KEYS.IMAGES);}catch(error){}
  }
  function installProductImageGuard(){
    let initialKey='',initialImageId=null,timer=0;const input=document.getElementById('inProduto');if(!input)return;
    input.addEventListener('focus',()=>{initialKey=mwNormalizeText(input.value);initialImageId=currentPhotoImageId;});
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{const next=mwNormalizeText(input.value);if(genesisCalculatorEditContext||!initialImageId||initialImageId!==currentPhotoImageId||!initialKey||!next||next===initialKey)return;await setContextImage('calc',null,{toast:false});showToast('A foto anterior foi retirada. Adicione ou busque a imagem do novo item.');initialKey=next;initialImageId=null;},420);});
  }
  function installPullToRefresh(){
    if(document.getElementById('genesisPullIndicator'))return;const indicator=document.createElement('div');indicator.id='genesisPullIndicator';indicator.className='genesis-pull-indicator';indicator.textContent='Puxe para atualizar';document.body.appendChild(indicator);let startY=0,distance=0,tracking=false;
    document.addEventListener('touchstart',event=>{if(window.scrollY>2||document.querySelector('.genesis-modal-layer.open,.sheet.open'))return;startY=event.touches[0].clientY;distance=0;tracking=true;},{passive:true});
    document.addEventListener('touchmove',event=>{if(!tracking)return;distance=Math.max(0,Math.min(120,event.touches[0].clientY-startY));if(distance>18){indicator.classList.add('show');indicator.style.transform=`translate(-50%,${Math.min(0,distance-72)}px)`;indicator.textContent=distance>=72?'Solte para atualizar':'Puxe para atualizar';}},{passive:true});
    document.addEventListener('touchend',()=>{if(!tracking)return;tracking=false;indicator.style.removeProperty('transform');if(distance>=72)refreshGenesisData();else indicator.classList.remove('show');distance=0;},{passive:true});
  }
  async function refreshGenesisData(){
    if(state.pullBusy)return;state.pullBusy=true;const indicator=document.getElementById('genesisPullIndicator');indicator.classList.add('show','refreshing');indicator.textContent='Atualizando…';const scrollY=window.scrollY;
    try{saveActiveDraft('pull-to-refresh');await persistStateSnapshot('pull-to-refresh');const tasks=[flushImageQueue({silent:true}),updateLocalServerPanel()];if(window.genesisSheetsConfigured?.())tasks.push(window.genesisSheetsSync({silent:true}));await Promise.allSettled(tasks);renderFilamentSelect();renderFilamentList();renderHistoryList();renderQuoteList();renderOrders();renderSavedModels();renderKitComposer();refreshMoreCounts();await updateDesktopSummary();await updateImageStatusBadges();indicator.textContent='Atualizado';showToast('Dados e imagens atualizados',true);}
    catch(error){indicator.textContent='Não foi possível atualizar agora';genesisLog('pull-refresh.failed',{error},'warn');}
    finally{window.scrollTo({top:scrollY,behavior:'instant'});setTimeout(()=>indicator.classList.remove('show','refreshing'),850);state.pullBusy=false;}
  }
  function installSettingsAndSyncHooks(){
    document.getElementById('btnLocalTest')?.addEventListener('click',()=>setTimeout(updateLocalServerPanel,250));window.addEventListener('online',()=>{flushImageQueue({silent:true});updateLocalServerPanel();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){flushImageQueue({silent:true});updateLocalServerPanel();}});setInterval(()=>{if(document.visibilityState==='visible'){flushImageQueue({silent:true});updateLocalServerPanel();}},60000);
    matchMedia('(min-width: 900px)').addEventListener?.('change',()=>{if(preferredView()==='automatic')applyViewMode('automatic');});
  }
  function installImageOwnerRefresh(){
    const coreSetPhoto=setPhoto;setPhoto=function(...args){const result=coreSetPhoto(...args);setTimeout(()=>{updateDesktopSummary();updateImageStatusBadges();},0);return result;};
    const coreRefreshQuote=refreshQuotePhotoEditor;refreshQuotePhotoEditor=async function(...args){const result=await coreRefreshQuote(...args);await updateImageStatusBadges();scheduleLiveQuotePreview();return result;};
    const coreRefreshOrder=refreshOrderPhotoEditor;refreshOrderPhotoEditor=async function(...args){const result=await coreRefreshOrder(...args);await updateImageStatusBadges();return result;};
  }
  function fixAsyncImageMenuHooks(){
    [['photoPreview','calc'],['qPhotoEditorPreview','quote'],['oPhotoPreview','order']].forEach(([id,context])=>{const image=document.getElementById(id);if(!image||image.dataset.genesisAsyncMenu==='1')return;image.dataset.genesisAsyncMenu='1';image.addEventListener('click',async event=>{event.preventDefault();event.stopImmediatePropagation();await openImageActionMenu(context,await contextImageId(context));},true);});
  }
  async function initWorkspace(){
    try{
      injectDesktopSidebar();enhanceCalculatorDesktop();enhanceQuoteComposerDesktop();injectViewSettings();injectImageSettings();injectLocalServerControls();injectImageModals();injectImageTools();installEditorEvents();installPasteHandler();installDesktopSummaryHooks();installProductImageGuard();installPullToRefresh();installSettingsAndSyncHooks();installImageOwnerRefresh();fixAsyncImageMenuHooks();applyViewMode(preferredView());refreshGenesisCalculatorEditBanner();
      document.getElementById('genesisLibrarySearch').addEventListener('input',renderImageLibrary);document.getElementById('genesisLibraryOrigin').addEventListener('change',renderImageLibrary);
      await migrateImageMetadata();await updateDesktopSummary();await updateImageStatusBadges();await updateLocalServerPanel();void flushImageQueue({silent:true});
      const editorDraft=await idbRequest(DRAFT_STORE,'readonly',store=>store.get('image-editor'));if(editorDraft&&Date.now()-Number(editorDraft.updatedAt)<24*60*60*1000)setTimeout(()=>restoreEditorDraft(),500);
      genesisLog('workspace.ready',{view:resolvedView(),images:imageEntities.length,version:GENESIS_APP_VERSION});
    }catch(error){genesisLog('workspace.init.failed',{error},'error');console.error('[Genesis Workspace]',error);}
  }
  window.GenesisWorkspace={applyViewMode,openImageLibrary,openImageEditor,openImageActionMenu,flushImageQueue,refresh:refreshGenesisData,updateLocalServerPanel};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initWorkspace,250),{once:true});else setTimeout(initWorkspace,250);
})();
