/* Genesis 3D — camada local IndexedDB, sincronização Google Sheets e finanças normalizadas. */
(function(){
  const SHEETS_CONFIG_KEY='genesis3d:sheetsConfig';
  const DEVICE_ID_KEY='genesis3d:deviceId';
  const SyncCore=window.GenesisSyncCore;
  const COLLECTIONS={
    config:{kind:'object',get:()=>cfg,set:value=>{cfg=Object.assign(JSON.parse(JSON.stringify(DEFAULT_CONFIG)),value||{});}},
    filaments:{kind:'array',get:()=>filaments,set:value=>{filaments=value;}},
    history:{kind:'array',get:()=>history,set:value=>{history=value;}},
    quotes:{kind:'array',get:()=>quotes,set:value=>{quotes=value;}},
    orders:{kind:'array',get:()=>orders,set:value=>{orders=value;}},
    kits:{kind:'array',get:()=>kits,set:value=>{kits=value;}},
    savedModels:{kind:'array',get:()=>savedModels,set:value=>{savedModels=value;}},
    makerWorldCache:{kind:'object',get:()=>makerWorldCache,set:value=>{makerWorldCache=value||{};}},
    shopeeCatalog:{kind:'array',get:()=>shopeeCatalog,set:value=>{shopeeCatalog=value;}},
    shopeeLearnedAliases:{kind:'object',get:()=>shopeeLearnedAliases,set:value=>{shopeeLearnedAliases=value||{};}},
    images:{kind:'array',get:()=>imageEntities,set:value=>{imageEntities=Array.isArray(value)?value:[];}},
    counters:{kind:'object',get:()=>counters,set:value=>{counters=Object.assign({quote:0,order:0,kit:0},value||{});}},
    uiState:{kind:'object',get:()=>uiState,set:value=>{uiState=value||{};}}
  };
  const LARGE_LOCAL_KEYS=()=>[
    KEYS.FILAMENTS,KEYS.HISTORY,KEYS.QUOTES,KEYS.ORDERS,KEYS.KITS,KEYS.MODELS,
    KEYS.MW_CACHE,KEYS.SHOPEE_CATALOG,KEYS.SHOPEE_ALIASES,KEYS.IMAGES
  ];
  const COLLECTION_LOCAL_KEYS={filaments:()=>KEYS.FILAMENTS,history:()=>KEYS.HISTORY,quotes:()=>KEYS.QUOTES,orders:()=>KEYS.ORDERS,kits:()=>KEYS.KITS,savedModels:()=>KEYS.MODELS,makerWorldCache:()=>KEYS.MW_CACHE,shopeeCatalog:()=>KEYS.SHOPEE_CATALOG,shopeeLearnedAliases:()=>KEYS.SHOPEE_ALIASES,images:()=>KEYS.IMAGES};
  let sheetsConfig={url:'',token:'',enabled:false,lastSyncAt:'',lastSuccessAt:''};
  let sheetsSyncBusy=false,sheetsApplying=false,sheetsQueueTimer=0,sheetsRetryTimer=0,syncMutationSource='local';
  let rawWriteTimers=new Map(),genericDraftTimer=0;
  try{sheetsConfig=Object.assign(sheetsConfig,JSON.parse(store.get(SHEETS_CONFIG_KEY)||'{}'));}catch(error){}
  let sheetsDeviceId=String(store.get(DEVICE_ID_KEY)||'').trim();
  if(!sheetsDeviceId){sheetsDeviceId=`device-${Date.now().toString(36)}-${stableHash(Math.random())}`;store.set(DEVICE_ID_KEY,sheetsDeviceId);}

  function dbAll(storeName){
    return openMediaDb().then(db=>new Promise(resolve=>{
      if(!db||!db.objectStoreNames.contains(storeName)){resolve([]);return;}
      try{const request=db.transaction(storeName,'readonly').objectStore(storeName).getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>resolve([]);}catch(error){resolve([]);}
    }));
  }
  function dbGet(storeName,key){
    return openMediaDb().then(db=>new Promise(resolve=>{
      if(!db||!db.objectStoreNames.contains(storeName)){resolve(null);return;}
      try{const request=db.transaction(storeName,'readonly').objectStore(storeName).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);}catch(error){resolve(null);}
    }));
  }
  function dbPut(storeName,value){
    return openMediaDb().then(db=>new Promise(resolve=>{
      if(!db||!db.objectStoreNames.contains(storeName)){resolve(false);return;}
      try{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).put(value);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch(error){resolve(false);}
    }));
  }
  function dbDelete(storeName,key){
    return openMediaDb().then(db=>new Promise(resolve=>{
      if(!db||!db.objectStoreNames.contains(storeName)){resolve(false);return;}
      try{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).delete(key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);}catch(error){resolve(false);}
    }));
  }
  async function dbReplaceCollection(name,value){
    const descriptor=COLLECTIONS[name],db=await openMediaDb();
    if(!descriptor||!db)return false;
    const values=descriptor.kind==='array'?(Array.isArray(value)?value:[]):[value||{}];
    values.forEach((item,index)=>{
      if(descriptor.kind==='array'&&item&&!item.id)item.id=uid(name.replace(/s$/,'')||'record');
    });
    const rows=values.map((payload,index)=>({
      key:`${name}:${descriptor.kind==='array'?(payload.id||index):'singleton'}`,
      collection:name,id:descriptor.kind==='array'?(payload.id||String(index)):'singleton',
      position:index,payload,updatedAt:Date.now()
    }));
    const existing=(await dbAll(RECORD_STORE)).filter(row=>row.collection===name);
    const wanted=new Set(rows.map(row=>row.key));
    return new Promise(resolve=>{
      try{
        const tx=db.transaction([RECORD_STORE,META_STORE],'readwrite'),records=tx.objectStore(RECORD_STORE);
        existing.forEach(row=>{if(!wanted.has(row.key))records.delete(row.key);});
        rows.forEach(row=>records.put(row));
        tx.objectStore(META_STORE).put({id:`collection:${name}`,collection:name,ids:rows.map(row=>row.id),count:rows.length,updatedAt:Date.now()});
        tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);
      }catch(error){resolve(false);}
    });
  }
  function scheduleRawCollection(name){
    clearTimeout(rawWriteTimers.get(name));
    rawWriteTimers.set(name,setTimeout(async()=>{
      rawWriteTimers.delete(name);
      const descriptor=COLLECTIONS[name];if(!descriptor)return;
      const ok=await dbReplaceCollection(name,descriptor.get());
      if(ok&&COLLECTION_LOCAL_KEYS[name])try{localStorage.removeItem(COLLECTION_LOCAL_KEYS[name]());}catch(error){}
    },120));
  }
  async function restoreRawCollections(){
    const rows=await dbAll(RECORD_STORE),metas=await dbAll(META_STORE);
    const known=new Set(metas.filter(meta=>String(meta.id||'').startsWith('collection:')).map(meta=>meta.collection));
    for(const [name,descriptor] of Object.entries(COLLECTIONS)){
      if(!known.has(name))continue;
      const selected=rows.filter(row=>row.collection===name).sort((a,b)=>(Number(a.position)||0)-(Number(b.position)||0)||String(a.id).localeCompare(String(b.id)));
      descriptor.set(descriptor.kind==='array'?selected.map(row=>row.payload):selected[0]?.payload||{});
    }
    return known.size>0;
  }
  async function persistAllRawCollections(){
    for(const [name,descriptor] of Object.entries(COLLECTIONS))await dbReplaceCollection(name,descriptor.get());
  }
  async function validateRawMigration(){
    const metas=await dbAll(META_STORE);
    return Object.entries(COLLECTIONS).every(([name,descriptor])=>{
      const meta=metas.find(item=>item.id===`collection:${name}`);
      const expected=descriptor.kind==='array'?(descriptor.get()||[]).length:1;
      return meta&&Number(meta.count)===expected;
    });
  }
  async function migrateLegacyStorage(){
    const marker=await dbGet(META_STORE,'local-migration-v23');
    if(marker?.status==='complete')return true;
    const backup={id:`legacy-v23-${Date.now()}`,createdAt:Date.now(),schemaVersion:SCHEMA_VERSION,data:genesisCoreSnapshot()};
    if(!await dbPut(LEGACY_BACKUP_STORE,backup))return false;
    await persistAllRawCollections();
    const valid=await validateRawMigration();
    if(!valid){genesisLog('indexeddb.migration.validation_failed',{},'error');return false;}
    await dbPut(META_STORE,{id:'local-migration-v23',status:'complete',backupId:backup.id,updatedAt:Date.now()});
    try{LARGE_LOCAL_KEYS().forEach(key=>localStorage.removeItem(key));}catch(error){}
    genesisLog('indexeddb.migration.complete',{backupId:backup.id,quotes:quotes.length,orders:orders.length,kits:kits.length});
    return true;
  }

  function safeIso(value){
    const date=value instanceof Date?value:new Date(typeof value==='number'?value:(value||0));
    return Number.isNaN(date.getTime())?new Date(0).toISOString():date.toISOString();
  }
  function stableHash(value){
    let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);
  }
  function sanitize(value,depth=0){
    if(depth>7)return null;
    if(value===null||value===undefined||['string','number','boolean'].includes(typeof value))return value;
    if(Array.isArray(value))return value.slice(0,300).map(item=>sanitize(item,depth+1));
    if(typeof Blob!=='undefined'&&value instanceof Blob)return undefined;
    if(typeof value!=='object')return String(value);
    const output={};
    Object.entries(value).forEach(([key,item])=>{
      if(/password|senha|token|anonkey|secret|imageDataUrl|photoDataUrl|dataUrl|imageBlob|blob|rawText|ocrText|screenshots/i.test(key))return;
      const clean=sanitize(item,depth+1);if(clean!==undefined)output[key]=clean;
    });
    return output;
  }
  function jsonCell(value){
    const text=JSON.stringify(sanitize(value));
    return text.length>48000?JSON.stringify({truncated:true,id:value?.id||'',summary:String(value?.productName||value?.name||'').slice(0,500)}):text;
  }
  function commonRecord(id,record={},origin='genesis'){
    return {id:String(id),created_at:safeIso(record.createdAt||record.created_at),updated_at:safeIso(record.updatedAt||record.updated_at||record.createdAt||record.created_at),version:Math.max(1,Number(record.version)||1),origem:record.source||record.origem||origin,sync_status:'pending',deleted:!!record.deleted};
  }
  function clientRecords(){
    const map=new Map();
    [...quotes,...orders].forEach(record=>{
      const client=record.client||{},name=String(client.name||'').trim(),phone=String(client.whatsapp||client.phone||'').replace(/\D/g,''),instagram=String(client.instagram||'').trim();
      if(!name&&!phone&&!instagram)return;
      const id=client.id||`client-${stableHash(phone||instagram.toLowerCase()||name.toLowerCase())}`;
      const existing=map.get(id)||{};
      map.set(id,{...commonRecord(id,record),nome:name||existing.nome||'',telefone:client.phone||existing.telefone||'',whatsapp:client.whatsapp||existing.whatsapp||'',instagram:instagram||existing.instagram||'',dados_json:jsonCell(client)});
    });
    return [...map.values()];
  }
  function normalizedSales(){return GenesisFinance.deduplicateOrders(orders).map(order=>GenesisFinance.normalizeSale(order)).filter(Boolean);}
  function buildSheetsEntities(){
    const sales=normalizedSales(),products=[
      ...savedModels.map(model=>({...model,_type:'modelo'})),
      ...shopeeCatalog.map(product=>({...product,_type:'catalogo_shopee'}))
    ];
    const result={
      Configuracoes:[{...commonRecord('genesis-config',cfg),chave:'genesis_config',valor_json:jsonCell(cfg),dados_json:jsonCell(cfg)}],
      Produtos:products.map(product=>({...commonRecord(product.id,product),nome:product.name||product.productName||'',tipo:product._type,categoria:product.category||product.commercial?.category||'',ativo:product.deleted!==true,dados_json:jsonCell(product)})),
      Filamentos:filaments.map(item=>({...commonRecord(item.id,item),nome:item.name||'',material:item.material||'',marca:item.brand||'',cor:item.color||'',preco_rolo:Number(item.rollPrice)||0,peso_rolo:Number(item.rollWeight)||0,dados_json:jsonCell(item)})),
      Clientes:clientRecords(),
      Calculos:history.map(item=>({...commonRecord(item.id,item),produto_nome:item.productName||'',filamento_id:item.filamentId||'',quantidade:Number(item.qty)||1,custo_unitario:Number(item.custoUnitario)||0,preco_direto:Number(item.precoDiretoUnit)||0,preco_shopee:Number(item.precoShopeeUnit)||0,image_id:item.imageId||'',dados_json:jsonCell(item)})),
      Orcamentos:quotes.map(item=>({...commonRecord(item.id,item),numero:item.seq||'',cliente_nome:item.client?.name||'',status:item.status||'',valor_total:Number(item.total)||0,image_id:item.imageId||'',dados_json:jsonCell(item)})),
      Orcamento_Itens:quotes.map(item=>({...commonRecord(`quote-item-${item.id}`,item),orcamento_id:item.id,produto_id:item.productId||item.internalSnapshot?.modelId||'',produto_nome_snapshot:item.productName||'',quantidade:Number(item.qty)||1,valor_unitario:Number(item.unitPrice)||0,valor_total:Number(item.total)||0,dados_json:jsonCell({availableColors:item.availableColors,imageId:item.imageId})})),
      Kits:kits.map(item=>({...commonRecord(item.id,item),numero:item.seq||'',nome:item.name||'',status:item.status||'',valor_normal:Number(item.totals?.individual)||0,desconto_total:Number(item.totals?.customerSaving)||0,valor_final:Number(item.totals?.final)||0,dados_json:jsonCell(item)})),
      Kit_Itens:kits.flatMap(kit=>(kit.items||[]).map((item,index)=>({...commonRecord(item.id||`${kit.id}-item-${index+1}`,item),kit_id:kit.id,produto_id:item.sourceId||'',produto_nome_snapshot:item.name||'',quantidade:Number(item.qty)||1,preco_normal_unitario:Number(item.unitPrice)||0,custo_unitario_snapshot:Number(item.unitCost)||0,dados_json:jsonCell(item)}))),
      Pedidos:orders.map(item=>({...commonRecord(item.id,item),numero:item.seq||'',shopee_order_id:item.shopeeOrderId||item.shopee?.number||'',cliente_nome:item.client?.name||'',canal:item.channel||'',status:item.status||'',valor_total:Number(item.total)||0,image_id:item.imageId||'',dados_json:jsonCell(item)})),
      Vendas:sales.map(sale=>({...commonRecord(sale.id,{createdAt:sale.date,updatedAt:sale.date},'venda_normalizada'),venda_id:sale.id,pedido_id:sale.orderId,data:safeIso(sale.date),canal:sale.channel,cliente_id:sale.clientId,status:sale.status,valor_bruto_total:sale.gross,taxas_canal_total:sale.fees,valor_recebido_total:sale.received,faturamento_total:sale.revenue,custo_producao_total:sale.cost,lucro_total:sale.profit,margem_total:sale.margin,desconto_total:sale.discount,dados_json:jsonCell(sale)})),
      Venda_Itens:sales.flatMap(sale=>sale.items.map(item=>({...commonRecord(`${sale.id}-${item.id}`,{createdAt:sale.date,updatedAt:sale.date},'venda_normalizada'),venda_item_id:`${sale.id}-${item.id}`,venda_id:sale.id,pedido_id:sale.orderId,produto_id:item.productId,produto_nome_snapshot:item.productName,quantidade:item.qty,origem_item:item.originItem,kit_id:item.kitId,kit_nome_snapshot:item.kitName,preco_normal_unitario:item.normalUnitPrice,percentual_desconto:item.discountPercent,valor_bruto_alocado:item.gross,taxas_alocadas:item.fees,faturamento_alocado:item.revenue,custo_unitario_snapshot:item.costUnit,custo_total:item.cost,lucro:item.profit,margem:item.margin,dados_json:jsonCell(item)}))),
      Custos:history.map(item=>({...commonRecord(`cost-${item.id}`,item),calculo_id:item.id,produto_nome:item.productName||'',energia:Number(item.custoEnergia)||0,maquina:Number(item.custoMaquina)||0,filamento:Number(item.custoFilamento)||0,custo_total:Number(item.custoUnitario)||0,dados_json:jsonCell(item)})),
      Imagens:imageEntities.map(item=>({...commonRecord(item.id,item,item.origem||item.sourceType||'genesis'),entidade:item.entidade||'',entidade_id:item.entidade_id||'',produto_id:item.produto_id||'',orcamento_id:item.orcamento_id||'',pedido_id:item.pedido_id||'',nome_original:item.nome_original||'',nome_arquivo:item.nome_arquivo||'',tipo_mime:item.tipo_mime||'',tamanho_bytes:Number(item.tamanho_bytes)||0,largura:Number(item.largura)||0,altura:Number(item.altura)||0,hash:item.hash||'',imagem_original_id:item.imagem_original_id||item.id||'',imagem_editada_id:item.imagem_editada_id||'',thumbnail_id:item.thumbnail_id||'',local_file_id:item.local_file_id||'',local_url:item.local_url||'',drive_file_id:item.drive_file_id||'',drive_url:item.drive_url||'',versao:Number(item.versao)||1,principal:item.principal!==false,origem:item.origem||item.sourceType||'',sync_status:item.sync_status||'pending',deleted:!!item.deleted,dados_json:jsonCell(item),thumbnail_drive_file_id:item.thumbnail_drive_file_id||'',thumbnail_drive_url:item.thumbnail_drive_url||''})),
      Diagnosticos:(()=>{try{return JSON.parse(store.get(GENESIS_ERROR_LOG_KEY)||'[]').slice(-100).map((item,index)=>({...commonRecord(`diag-${stableHash(item.at+'-'+item.event+'-'+index)}`,{createdAt:item.at,updatedAt:item.at},'app'),nivel:item.level||'',evento:item.event||'',tela:item.screen||'',versao_app:item.appVersion||'',dados_json:jsonCell(item)}));}catch(error){return [];}})()
    };
    return result;
  }
  function fingerprint(record){
    const copy={...record};delete copy.updated_at;delete copy.sync_status;delete copy.version;return stableHash(JSON.stringify(copy));
  }
  async function backupSheetsQueue(queue,reason){
    const backup={id:`sync-queue-${Date.now()}-${stableHash(reason)}`,createdAt:Date.now(),schemaVersion:SCHEMA_VERSION,type:'sync-queue-backup',reason,queue:sanitize(queue)};
    if(!await dbPut(LEGACY_BACKUP_STORE,backup))throw new Error('Não foi possível criar o backup da fila.');
    const saved=await dbGet(LEGACY_BACKUP_STORE,backup.id);
    if(!saved||!Array.isArray(saved.queue)||saved.queue.length!==queue.length)throw new Error('O backup da fila não passou na validação.');
    return backup.id;
  }
  async function diagnoseSheetsQueue({persist=true}={}){
    const queue=await dbAll(SYNC_QUEUE_STORE),report=SyncCore.diagnoseQueue(queue);
    if(persist)await dbPut(META_STORE,{id:'sheets-queue-diagnosis',report,updatedAt:Date.now()});
    return report;
  }
  async function repairSheetsQueue({silent=false,reason='manual'}={}){
    const queue=await dbAll(SYNC_QUEUE_STORE),result=SyncCore.repairQueue(queue),removed=result.report.before-result.report.after;
    let backupId='';
    if(removed>0){
      backupId=await backupSheetsQueue(queue,reason);
      const keepIds=new Set(result.queue.map(item=>item.operation_id));
      for(const item of queue){if(!keepIds.has(item.operation_id))await dbDelete(SYNC_QUEUE_STORE,item.operation_id);}
      for(const item of result.queue)await dbPut(SYNC_QUEUE_STORE,item);
      const validation=SyncCore.diagnoseQueue(await dbAll(SYNC_QUEUE_STORE));
      if(validation.total!==result.report.after||validation.duplicates!==0)throw new Error('A fila reparada não passou na validação.');
    }
    const report={...result.report,backupId,removed,reason,updatedAt:Date.now()};
    await dbPut(META_STORE,{id:'sheets-queue-last-repair',report,updatedAt:Date.now()});
    if(!silent)showToast(removed?`Fila reparada: ${removed} duplicata(s) consolidada(s).`:'A fila já está consistente.',true);
    await refreshSheetsStatus();return report;
  }
  function parseConflictData(payload){
    let value=payload?.dados_json??payload?.valor_json??payload;
    try{value=typeof value==='string'?JSON.parse(value):value;}catch(error){value={};}
    return value&&typeof value==='object'?value:{};
  }
  function conflictDiffs(localPayload,serverPayload){
    const local=parseConflictData(localPayload),server=parseConflictData(serverPayload),ignore=new Set(['updatedAt','updated_at','version','sync_status']);
    return [...new Set([...Object.keys(local),...Object.keys(server)])].filter(key=>!ignore.has(key)&&JSON.stringify(local[key])!==JSON.stringify(server[key])).map(key=>({field:key,local:local[key],server:server[key]}));
  }
  function conflictValue(value){
    if(value===undefined)return '—';if(value===null)return 'null';
    const text=typeof value==='object'?JSON.stringify(value):String(value);return text.length>260?text.slice(0,257)+'…':text;
  }
  async function markConflictResolved(item,resolution){
    const id=`conflict-${item.operation_id}`,row=await dbGet(DIAGNOSTIC_STORE,id)||{id,createdAt:Date.now(),type:'sync-conflict',details:{entity:item.entity,entity_id:item.entity_id,local:item.payload,server:item.server_record}};
    row.resolvedAt=Date.now();row.resolution=resolution;row.deviceId=sheetsDeviceId;row.type='sync-conflict-resolved';await dbPut(DIAGNOSTIC_STORE,row);
  }
  async function queueConflictResolution(item,payload,resolution){
    const serverVersion=Number(item.server_record?.version)||1,localVersion=Number(payload?.version)||Number(item.version)||1,version=Math.max(serverVersion,localVersion)+1,updatedAt=new Date().toISOString();
    const finalPayload={...payload,version,updated_at:updatedAt},fp=fingerprint(finalPayload),operationId=SyncCore.operationId({entity:item.entity,entityId:item.entity_id,action:item.action||'upsert',version,fingerprint:fp,deviceId:sheetsDeviceId});
    const operation={...item,operation_id:operationId,operationId,payload:finalPayload,payload_fingerprint:fp,version,status:'pending',source:'conflict-resolution',reason:resolution,device_id:sheetsDeviceId,deviceId:sheetsDeviceId,created_at:updatedAt,updated_at:updatedAt,attempts:0,last_error:''};
    delete operation.server_record;delete operation.conflict_created_at;
    await dbDelete(SYNC_QUEUE_STORE,item.operation_id);await dbPut(SYNC_QUEUE_STORE,operation);await markConflictResolved(item,resolution);return operation;
  }
  async function resolveConflictKeepLocal(item){
    await queueConflictResolution(item,item.payload,'keep-local');await renderSyncConflicts();await refreshSheetsStatus();scheduleSheetsRetry(300);showToast('Versão deste dispositivo preservada',true);
  }
  async function resolveConflictKeepRemote(item){
    if(!item.server_record){showToast('A versão remota não está disponível neste diagnóstico.');return;}
    await applyRemoteRecords([{entity:item.entity,payload:item.server_record}],{ignoreQueued:true});await dbDelete(SYNC_QUEUE_STORE,item.operation_id);await markConflictResolved(item,'keep-remote');await renderSyncConflicts();await refreshSheetsStatus();showToast('Versão do Google Sheets aplicada',true);
  }
  function closeConflictMerge(){document.getElementById('genesisConflictMergeModal')?.classList.remove('open');}
  function openConflictMerge(item){
    const modal=document.getElementById('genesisConflictMergeModal'),list=document.getElementById('genesisConflictMergeFields'),diffs=conflictDiffs(item.payload,item.server_record);
    if(!modal||!list)return;
    if(!diffs.length){showToast('As versões não possuem campos diferentes para mesclar.');return;}
    list.innerHTML=diffs.map((diff,index)=>`<div class="genesis-conflict-field"><strong>${escapeHtml(diff.field)}</strong><label><input type="radio" name="conflictField${index}" value="local" checked> Dispositivo: ${escapeHtml(conflictValue(diff.local))}</label><label><input type="radio" name="conflictField${index}" value="remote"> Sheets: ${escapeHtml(conflictValue(diff.server))}</label></div>`).join('');
    modal.classList.add('open');
    document.getElementById('genesisConflictMergeSave').onclick=async()=>{
      const local=parseConflictData(item.payload),server=parseConflictData(item.server_record),merged={...server,...local};
      diffs.forEach((diff,index)=>{const choice=list.querySelector(`input[name="conflictField${index}"]:checked`)?.value||'local';merged[diff.field]=choice==='remote'?diff.server:diff.local;});
      const version=Math.max(Number(item.payload?.version)||1,Number(item.server_record?.version)||1)+1,mergedPayload={...item.server_record,...item.payload,dados_json:JSON.stringify(merged),version,updated_at:new Date().toISOString()};
      await applyRemoteRecords([{entity:item.entity,payload:mergedPayload}],{ignoreQueued:true});
      const current=(buildSheetsEntities()[item.entity]||[]).find(record=>String(record.id)===String(item.entity_id))||mergedPayload;
      await queueConflictResolution(item,current,'merge-explicit');closeConflictMerge();await renderSyncConflicts();await refreshSheetsStatus();scheduleSheetsRetry(300);showToast('Versões mescladas com suas escolhas',true);
    };
  }
  function installConflictPanel(){
    if(document.getElementById('genesisSyncConflictModal'))return;
    const style=document.createElement('style');style.textContent='.genesis-conflict-list{display:grid;gap:12px;max-height:min(68vh,620px);overflow:auto}.genesis-conflict-card,.genesis-conflict-field{padding:13px;border:1px solid rgba(255,193,82,.24);border-radius:14px;background:rgba(42,30,12,.24)}.genesis-conflict-card h3{margin:0 0 5px;font-size:15px}.genesis-conflict-meta{font-size:11px;color:#9ba4b5}.genesis-conflict-diffs{display:grid;gap:7px;margin:10px 0}.genesis-conflict-diff{display:grid;grid-template-columns:90px 1fr;gap:8px;font-size:11px}.genesis-conflict-diff span{color:#9ba4b5}.genesis-conflict-actions{display:flex;flex-wrap:wrap;gap:7px}.genesis-conflict-field{display:grid;gap:7px;margin-bottom:8px}.genesis-conflict-field label{display:flex;gap:7px;align-items:flex-start;font-size:11px;overflow-wrap:anywhere}.genesis-conflict-field input{width:auto;min-height:0}';document.head.appendChild(style);
    const panel=document.createElement('div');panel.id='genesisSyncConflictModal';panel.className='genesis-modal-layer';panel.innerHTML='<div class="genesis-modal-card" style="max-width:760px"><div class="genesis-modal-head"><div><h3>Conflitos de sincronização</h3><p>Nenhuma versão é descartada sem sua escolha.</p></div><button type="button" id="genesisConflictClose">×</button></div><div id="genesisConflictList" class="genesis-conflict-list"></div></div>';document.body.appendChild(panel);
    const merge=document.createElement('div');merge.id='genesisConflictMergeModal';merge.className='genesis-modal-layer';merge.style.zIndex='19100';merge.innerHTML='<div class="genesis-modal-card" style="max-width:680px"><div class="genesis-modal-head"><div><h3>Mesclar versões</h3><p>Escolha explicitamente qual valor manter em cada campo diferente.</p></div><button type="button" id="genesisConflictMergeClose">×</button></div><div id="genesisConflictMergeFields" style="max-height:58vh;overflow:auto"></div><div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" id="genesisConflictMergeSave" type="button">Salvar mesclagem</button><button class="btn btn-secondary" id="genesisConflictMergeCancel" type="button">Cancelar</button></div></div>';document.body.appendChild(merge);
    document.getElementById('genesisConflictClose').onclick=()=>panel.classList.remove('open');document.getElementById('genesisConflictMergeClose').onclick=closeConflictMerge;document.getElementById('genesisConflictMergeCancel').onclick=closeConflictMerge;
  }
  async function renderSyncConflicts(){
    installConflictPanel();const queue=await dbAll(SYNC_QUEUE_STORE),conflicts=queue.filter(item=>item.status==='conflict'),list=document.getElementById('genesisConflictList');
    if(!list)return conflicts;
    list.innerHTML=conflicts.length?'':'<div class="secondary-note">Nenhum conflito aguardando decisão.</div>';
    conflicts.forEach(item=>{
      const card=document.createElement('article'),diffs=conflictDiffs(item.payload,item.server_record);card.className='genesis-conflict-card';
      card.innerHTML=`<h3>${escapeHtml(item.entity)} · ${escapeHtml(item.entity_id)}</h3><div class="genesis-conflict-meta">Dispositivo: ${escapeHtml(item.payload?.updated_at||'—')} · Google Sheets: ${escapeHtml(item.server_record?.updated_at||'—')}</div><div class="genesis-conflict-diffs">${diffs.slice(0,8).map(diff=>`<div class="genesis-conflict-diff"><strong>${escapeHtml(diff.field)}</strong><div><span>Dispositivo:</span> ${escapeHtml(conflictValue(diff.local))}<br><span>Sheets:</span> ${escapeHtml(conflictValue(diff.server))}</div></div>`).join('')||'<span class="secondary-note">Metadados de versão diferentes.</span>'}</div><div class="genesis-conflict-actions"><button class="btn btn-secondary btn-sm" data-resolution="local">Manter este dispositivo</button><button class="btn btn-secondary btn-sm" data-resolution="remote">Manter Google Sheets</button><button class="btn btn-primary btn-sm" data-resolution="merge">Mesclar versões</button></div>`;
      card.querySelector('[data-resolution="local"]').onclick=()=>resolveConflictKeepLocal(item);card.querySelector('[data-resolution="remote"]').onclick=()=>resolveConflictKeepRemote(item);card.querySelector('[data-resolution="merge"]').onclick=()=>openConflictMerge(item);list.appendChild(card);
    });
    const button=document.getElementById('btnSheetsConflicts');if(button)button.textContent=`Resolver conflitos${conflicts.length?` (${conflicts.length})`:''}`;return conflicts;
  }
  async function openSyncConflicts(){await renderSyncConflicts();document.getElementById('genesisSyncConflictModal')?.classList.add('open');}
  function nextOperationVersion(record,meta,previous){
    return Math.max(1,Number(record?.version)||1,(Number(meta?.version)||0)+1,Number(previous?.version)||0);
  }
  function makeOperation({entity,record,action='upsert',previous=null,meta=null,reason='change',source='local'}){
    const now=new Date().toISOString(),entityId=String(record.id),fp=fingerprint(record),version=nextOperationVersion(record,meta,previous);
    const payload={...record,updated_at:now,version};
    const operationId=previous&&previous.payload_fingerprint===fp
      ? previous.operation_id
      : SyncCore.operationId({entity,entityId,action,version,fingerprint:fp,deviceId:sheetsDeviceId});
    return {operation_id:operationId,operationId,entity,entityType:entity,entity_id:entityId,entityId,action,operationType:action,payload,payload_fingerprint:fp,version,device_id:sheetsDeviceId,deviceId:sheetsDeviceId,source,status:'pending',created_at:previous?.created_at||now,createdAt:previous?.createdAt||previous?.created_at||now,updated_at:now,updatedAt:now,attempts:Number(previous?.attempts)||0,last_error:'',reason};
  }
  async function enqueueSheetsRecords(reason='change',force=false){
    if(sheetsApplying||!['local','migration','conflict-resolution'].includes(syncMutationSource))return 0;
    await repairSheetsQueue({silent:true,reason:'before-enqueue'});
    const entities=buildSheetsEntities(),queue=await dbAll(SYNC_QUEUE_STORE),metaRows=await dbAll(META_STORE);
    const metaMap=new Map(metaRows.map(item=>[item.id,item]));
    const existingQueue=new Map(queue.filter(item=>['pending','failed','syncing','conflict'].includes(item.status)).map(item=>[`${item.entity}:${item.entity_id}:${item.action||'upsert'}`,SyncCore.normalizeOperation(item)]));
    let count=0;
    for(const [entity,records] of Object.entries(entities)){
      const currentIds=new Set(records.map(record=>String(record.id)));
      const knownMeta=metaMap.get(`sheets-ids:${entity}`),knownIds=new Set(knownMeta?.ids||[]);
      for(const record of records){
        const key=`${entity}:${record.id}`,fp=fingerprint(record),fpMeta=metaMap.get(`sheets-fp:${key}`);
        if(fpMeta?.fingerprint===fp)continue;
        const queueKey=`${key}:upsert`,previous=existingQueue.get(queueKey);
        if(previous?.status==='conflict'){
          previous.payload={...record,updated_at:new Date().toISOString(),version:Math.max(Number(previous.version)||1,Number(record.version)||1)};
          previous.payload_fingerprint=fp;previous.updated_at=new Date().toISOString();previous.last_error='Conflito preservado; a versão local mais recente foi anexada.';
          await dbPut(SYNC_QUEUE_STORE,previous);continue;
        }
        if(previous?.payload_fingerprint===fp)continue;
        const operation=makeOperation({entity,record,previous,meta:fpMeta,reason,source:force?'migration':'local'});
        if(previous&&previous.operation_id!==operation.operation_id)await dbDelete(SYNC_QUEUE_STORE,previous.operation_id);
        await dbPut(SYNC_QUEUE_STORE,operation);existingQueue.set(queueKey,operation);count++;
      }
      for(const missing of knownIds){
        if(currentIds.has(String(missing)))continue;
        const key=`${entity}:${missing}`,queueKey=`${key}:delete`,previous=existingQueue.get(queueKey),record={id:String(missing),deleted:true};
        if(previous?.status==='conflict'||previous?.payload_fingerprint===fingerprint(record))continue;
        const operation=makeOperation({entity,record,action:'delete',previous,meta:metaMap.get(`sheets-fp:${key}`),reason,source:force?'migration':'local'});
        if(previous&&previous.operation_id!==operation.operation_id)await dbDelete(SYNC_QUEUE_STORE,previous.operation_id);
        await dbPut(SYNC_QUEUE_STORE,operation);existingQueue.set(queueKey,operation);count++;
      }
      await dbPut(META_STORE,{id:`sheets-ids:${entity}`,ids:[...currentIds],updatedAt:Date.now()});
    }
    await refreshSheetsStatus();
    if(sheetsConfig.enabled&&navigator.onLine)scheduleSheetsRetry(350);
    return count;
  }
  function scheduleSheetsQueue(reason='change',source=syncMutationSource){
    if(!['local','migration','conflict-resolution'].includes(source))return;
    clearTimeout(sheetsQueueTimer);sheetsQueueTimer=setTimeout(()=>{
      const previousSource=syncMutationSource;syncMutationSource=source;
      enqueueSheetsRecords(reason).catch(error=>genesisLog('sheets.queue.error',{error},'error')).finally(()=>{syncMutationSource=previousSource;});
    },700);
  }

  function saveSheetsConfig(){store.set(SHEETS_CONFIG_KEY,JSON.stringify(sheetsConfig));}
  function sheetsConfigured(){return /^https:\/\/script\.google\.com\/macros\/s\//i.test(String(sheetsConfig.url||''))&&!!String(sheetsConfig.token||'').trim();}
  function setSheetsStatus(state,text,details={}){
    const dot=document.getElementById('sheetsStatusDot'),label=document.getElementById('sheetsStatusText');
    if(dot)dot.className='integration-dot '+(state==='ok'?'ok':state==='bad'?'bad':'');
    if(label)label.textContent=text;
    const syncState=details.syncState||(state==='bad'?'error':state==='ok'?'connected':/sincronizando|testando|criando backup/i.test(text)?'syncing':'idle');
    window.dispatchEvent(new CustomEvent('genesis:sheets-status',{detail:{status:syncState,text,configured:sheetsConfigured(),enabled:!!sheetsConfig.enabled,busy:sheetsSyncBusy,...details}}));
  }
  function renderQueueReport(report,title='Diagnóstico da fila'){
    const box=document.getElementById('sheetsQueueReport');if(!box||!report)return;
    box.style.display='block';
    box.innerHTML=`<strong>${title}</strong><br>Antes: ${Number(report.before??report.total)||0} · Duplicadas: ${Number(report.duplicates)||0} · Reais: ${Number(report.real??report.total)||0} · Depois: ${Number(report.after??report.total)||0} · Conflitos: ${Number(report.conflictsPreserved??report.conflicts)||0}`;
  }
  async function sheetsApi(operation,payload={}){
    if(!sheetsConfigured())throw new Error('Informe a URL e o token do Google Apps Script.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(sheetsConfig.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({token:sheetsConfig.token,operation,...payload}),signal:controller.signal,redirect:'follow'});
      const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch(error){throw new Error('Resposta inválida do Google Apps Script.');}
      if(!response.ok||data.ok===false)throw new Error(data.error||`Google Apps Script respondeu ${response.status}`);
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('Tempo limite ao acessar o Google Sheets.');throw error;}finally{clearTimeout(timer);}
  }
  async function refreshSheetsStatus(message){
    const queue=await dbAll(SYNC_QUEUE_STORE),pending=queue.filter(item=>item.status!=='synced').length,conflicts=queue.filter(item=>item.status==='conflict').length;
    const details=document.getElementById('sheetsSyncDetails');
    if(details)details.textContent=`${pending} alteração(ões) pendente(s)${conflicts?` · ${conflicts} conflito(s) preservado(s)`:''}${sheetsConfig.lastSuccessAt?` · último envio ${new Date(sheetsConfig.lastSuccessAt).toLocaleString('pt-BR')}`:''}.`;
    const statusDetails={pending,conflicts};
    if(message){
      if(conflicts)return setSheetsStatus('bad','Conflito preservado · revise o diagnóstico',{...statusDetails,syncState:'conflict'});
      if(message.state==='bad')return setSheetsStatus(message.state,message.text,{...statusDetails,syncState:'error'});
      if(pending)return setSheetsStatus('',`${pending} alteração(ões) aguardando envio`,{...statusDetails,syncState:'syncing'});
      return setSheetsStatus(message.state,message.text,{...statusDetails,syncState:'connected'});
    }
    if(!navigator.onLine)setSheetsStatus('','Offline · dados protegidos neste aparelho',{...statusDetails,syncState:'offline'});
    else if(!sheetsConfigured())setSheetsStatus('','Google Sheets não configurado',{...statusDetails,syncState:sheetsConfig.enabled?'error':'disabled'});
    else if(conflicts)setSheetsStatus('bad','Conflito preservado · revise o diagnóstico',{...statusDetails,syncState:'conflict'});
    else if(pending)setSheetsStatus('',`${pending} alteração(ões) aguardando envio`,{...statusDetails,syncState:'syncing'});
    else setSheetsStatus('ok','Sincronizado',{...statusDetails,syncState:'connected'});
    return pending;
  }
  function scheduleSheetsRetry(delay=1500){
    clearTimeout(sheetsRetryTimer);
    if(!sheetsConfig.enabled||!sheetsConfigured()||!navigator.onLine||document.visibilityState==='hidden')return;
    sheetsRetryTimer=setTimeout(()=>syncSheets({silent:true}).catch(()=>{}),delay);
  }
  async function applyRemoteRecords(records,{ignoreQueued=false}={}){
    if(!Array.isArray(records)||!records.length)return 0;
    const blocked=new Set();
    if(!ignoreQueued){
      const queue=await dbAll(SYNC_QUEUE_STORE),pending=queue.filter(item=>['pending','failed','syncing','conflict'].includes(item.status));
      for(const remote of records){
        const entity=remote.entity,payload=remote.payload||{},id=String(payload.id||''),item=pending.find(row=>row.entity===entity&&String(row.entity_id)===id);
        if(!item||fingerprint(item.payload)===fingerprint(payload))continue;
        item.status='conflict';item.server_record=payload;item.conflict_created_at=item.conflict_created_at||new Date().toISOString();item.last_error='Conflito detectado ao receber uma versão remota; as duas cópias foram preservadas.';await dbPut(SYNC_QUEUE_STORE,item);
        await dbPut(DIAGNOSTIC_STORE,{id:`conflict-${item.operation_id}`,createdAt:Date.now(),type:'sync-conflict',details:{entity,entity_id:id,server:payload,local:item.payload}});blocked.add(`${entity}:${id}`);
      }
      if(blocked.size){await renderSyncConflicts();await refreshSheetsStatus();}
    }
    records=records.filter(remote=>!blocked.has(`${remote.entity}:${String(remote.payload?.id||'')}`));
    if(!records.length)return 0;
    const map={Filamentos:'filaments',Calculos:'history',Orcamentos:'quotes',Kits:'kits',Pedidos:'orders',Imagens:'images'};
    const grouped=new Map();let applied=0;
    for(const remote of records){
      if(remote.entity==='Configuracoes'){
        let configRaw=remote.payload?.dados_json??remote.payload?.valor_json;
        try{configRaw=typeof configRaw==='string'?JSON.parse(configRaw):configRaw;}catch(error){configRaw=null;}
        if(configRaw&&!configRaw.truncated){cfg=Object.assign(JSON.parse(JSON.stringify(DEFAULT_CONFIG)),configRaw);await dbReplaceCollection('config',cfg);applied++;}
        continue;
      }
      if(remote.entity==='Produtos'){
        let productRaw=remote.payload?.dados_json;
        try{productRaw=typeof productRaw==='string'?JSON.parse(productRaw):productRaw;}catch(error){productRaw=null;}
        if(productRaw&&!productRaw.truncated&&productRaw.id){
          const target=productRaw._type==='catalogo_shopee'?'shopeeCatalog':'savedModels';
          if(!grouped.has(target))grouped.set(target,[]);grouped.get(target).push(productRaw);
        }
        continue;
      }
      const name=map[remote.entity];if(!name)continue;
      if(remote.payload?.deleted===true||String(remote.payload?.deleted).toLowerCase()==='true'){
        if(!grouped.has(name))grouped.set(name,[]);grouped.get(name).push({id:String(remote.payload.id),_remoteDeleted:true,updatedAt:new Date(remote.payload.updated_at||0).getTime()||Date.now()});continue;
      }
      let raw=remote.payload?.dados_json??remote.dados_json;
      try{raw=typeof raw==='string'?JSON.parse(raw):raw;}catch(error){continue;}
      if(!raw||raw.truncated||!raw.id)continue;
      if(!grouped.has(name))grouped.set(name,[]);grouped.get(name).push(raw);
    }
    const previousSource=syncMutationSource;sheetsApplying=true;syncMutationSource='remote';
    try{
      for(const [name,incoming] of grouped){
        const descriptor=COLLECTIONS[name],current=Array.isArray(descriptor.get())?descriptor.get():[],byId=new Map(current.map(item=>[String(item.id),item]));
        incoming.forEach(item=>{const existing=byId.get(String(item.id));if(item._remoteDeleted){if(existing){byId.delete(String(item.id));applied++;}return;}if(!existing||Number(item.updatedAt||0)>=Number(existing.updatedAt||0)){byId.set(String(item.id),item);applied++;}});
        descriptor.set([...byId.values()]);await dbReplaceCollection(name,descriptor.get());
      }
      const currentEntities=buildSheetsEntities();
      const receivedByEntity=new Map();
      for(const remote of records){
        const entity=remote.entity,payload=remote.payload||{},id=String(payload.id||'');if(!entity||!id)continue;
        const current=(currentEntities[entity]||[]).find(item=>String(item.id)===id),fp=current?fingerprint(current):fingerprint(payload);
        await dbPut(META_STORE,{id:`sheets-fp:${entity}:${id}`,fingerprint:fp,version:Math.max(1,Number(payload.version)||1),updatedAt:Date.now(),source:'remote'});
        if(!receivedByEntity.has(entity))receivedByEntity.set(entity,new Set());receivedByEntity.get(entity).add(id);
      }
      for(const [entity,ids] of receivedByEntity){
        const currentIds=(currentEntities[entity]||[]).map(item=>String(item.id));
        await dbPut(META_STORE,{id:`sheets-ids:${entity}`,ids:[...new Set([...currentIds,...ids])],updatedAt:Date.now(),source:'remote'});
      }
    }finally{sheetsApplying=false;syncMutationSource=previousSource;}
    if(applied){
      window.genesisRefreshVisibleScreen?.({includeCalc:true});
      await persistStateSnapshot('sheets-pull');
    }
    return applied;
  }
  async function pullSheetsUpdates(){
    const response=await sheetsApi('readSince',{since:sheetsConfig.lastSyncAt||'',entities:['Configuracoes','Produtos','Filamentos','Calculos','Orcamentos','Kits','Pedidos','Imagens']});
    const applied=await applyRemoteRecords(response.records||[]);
    sheetsConfig.lastSyncAt=response.server_time||new Date().toISOString();saveSheetsConfig();
    return applied;
  }
  async function pullSheetsEntity(entity,id){
    if(!sheetsConfigured()||!navigator.onLine)return false;
    const response=await sheetsApi('read',{entity,id,include_deleted:true});
    return applyRemoteRecords(response.records||[]);
  }
  async function sheetsEntityVersion(entity,id){
    const meta=await dbGet(META_STORE,`sheets-fp:${entity}:${id}`),queue=(await dbAll(SYNC_QUEUE_STORE)).filter(item=>item.entity===entity&&String(item.entity_id)===String(id));
    return Math.max(Number(meta?.version)||0,...queue.map(item=>Number(item.version)||Number(item.payload?.version)||0));
  }
  async function syncDiagnostics(){
    let queue=[],indexedDb=true;try{queue=await dbAll(SYNC_QUEUE_STORE);}catch(error){indexedDb=false;}
    return {internet:navigator.onLine,indexedDb,sheets:{enabled:!!sheetsConfig.enabled,configured:sheetsConfigured(),busy:sheetsSyncBusy,lastSuccessAt:sheetsConfig.lastSuccessAt||'',pending:queue.filter(item=>item.status!=='synced'&&item.status!=='conflict').length,conflicts:queue.filter(item=>item.status==='conflict').length,failed:queue.filter(item=>item.status==='failed').length}};
  }
  async function syncSheets({silent=false}={}){
    if(sheetsSyncBusy)return false;
    if(!navigator.onLine){await refreshSheetsStatus();if(!silent)showToast('Sem internet. As alterações continuam salvas no aparelho.');return false;}
    if(!sheetsConfigured()){await refreshSheetsStatus();if(!silent)showToast('Configure a URL e o token do Google Apps Script.');return false;}
    sheetsSyncBusy=true;setSheetsStatus('','Sincronizando com Google Sheets…',{syncState:'syncing'});
    try{
      await enqueueSheetsRecords('sync');
      let queue=(await dbAll(SYNC_QUEUE_STORE)).filter(item=>['pending','failed','syncing'].includes(item.status)&&(!item.next_attempt_at||item.next_attempt_at<=Date.now())).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
      while(queue.length){
        const batch=queue.slice(0,60);for(const item of batch){item.status='syncing';await dbPut(SYNC_QUEUE_STORE,item);}
        let response;
        try{response=await sheetsApi('batchSync',{operations:batch});}
        catch(error){
          for(const item of batch){item.status='failed';item.attempts=(Number(item.attempts)||0)+1;item.last_error=String(error.message||error).slice(0,500);item.next_attempt_at=Date.now()+Math.min(300000,Math.pow(2,item.attempts)*3000);await dbPut(SYNC_QUEUE_STORE,item);}
          throw error;
        }
        const results=new Map((response.results||[]).map(result=>[result.operation_id,result]));
        for(const item of batch){
          const result=results.get(item.operation_id);
          if(result?.status==='conflict'){
            item.status='conflict';item.server_record=result.server_record||null;item.conflict_created_at=new Date().toISOString();item.last_error='Conflito de versão: as duas cópias foram preservadas.';await dbPut(SYNC_QUEUE_STORE,item);
            await dbPut(DIAGNOSTIC_STORE,{id:`conflict-${item.operation_id}`,createdAt:Date.now(),type:'sync-conflict',details:{entity:item.entity,entity_id:item.entity_id,server:result.server_record,local:item.payload}});
          }else if(result&&result.ok!==false){
            await dbDelete(SYNC_QUEUE_STORE,item.operation_id);
            await dbPut(META_STORE,{id:`sheets-fp:${item.entity}:${item.entity_id}`,fingerprint:fingerprint(item.payload),version:Number(item.payload.version)||1,updatedAt:Date.now()});
            await dbPut(META_STORE,{id:`sheets-ack:${item.operation_id}`,entity:item.entity,entity_id:item.entity_id,version:Number(item.payload.version)||1,confirmedAt:Date.now()});
            Promise.resolve(window.GenesisRealtime?.publish?.({operationId:item.operation_id,entityType:item.entity,entityId:item.entity_id,version:Number(item.payload.version)||1,updatedAt:item.payload.updated_at||new Date().toISOString(),deviceId:sheetsDeviceId,eventType:item.action||'upsert'})).catch(error=>genesisLog('realtime.publish.failed',{error,operationId:item.operation_id},'warn'));
          }else{
            item.status='failed';item.attempts=(Number(item.attempts)||0)+1;item.last_error=String(result?.error||'Resposta não confirmou esta operação').slice(0,500);item.next_attempt_at=Date.now()+Math.min(300000,Math.pow(2,item.attempts)*3000);await dbPut(SYNC_QUEUE_STORE,item);
          }
        }
        queue=queue.slice(batch.length);
      }
      const applied=await pullSheetsUpdates();
      sheetsConfig.lastSuccessAt=new Date().toISOString();saveSheetsConfig();await refreshSheetsStatus({state:'ok',text:'Sincronizado com Google Sheets'});
      if(!silent)showToast(`Sincronização concluída${applied?` · ${applied} atualização(ões) recebida(s)`:''}`,true);
      return true;
    }catch(error){genesisLog('sheets.sync.failed',{error},'error');await refreshSheetsStatus({state:'bad',text:'Falha ao sincronizar · dados preservados'});if(!silent)showToast(error.message||'Falha ao sincronizar.');scheduleSheetsRetry(15000);return false;}
    finally{sheetsSyncBusy=false;}
  }
  async function testSheets(){
    readSheetsSettings();setSheetsStatus('','Testando conexão…');
    try{const result=await sheetsApi('healthCheck');setSheetsStatus('ok',`Conectado · ${result.spreadsheet_name||'Genesis 3D'}`);showToast('Google Sheets conectado',true);}catch(error){setSheetsStatus('bad','Não foi possível conectar');showToast(error.message||'Falha na conexão.');}
  }
  function readSheetsSettings(){
    sheetsConfig.url=String(document.getElementById('sheetsApiUrl')?.value||'').trim().replace(/\/$/,'');
    sheetsConfig.token=String(document.getElementById('sheetsApiToken')?.value||'').trim();
    sheetsConfig.enabled=!!document.getElementById('sheetsSyncEnabled')?.checked;saveSheetsConfig();
  }
  function populateSheetsSettings(){
    const url=document.getElementById('sheetsApiUrl'),token=document.getElementById('sheetsApiToken'),enabled=document.getElementById('sheetsSyncEnabled');
    if(url)url.value=sheetsConfig.url||'';if(token)token.value=sheetsConfig.token||'';if(enabled)enabled.checked=!!sheetsConfig.enabled;refreshSheetsStatus();
    dbGet(META_STORE,'sheets-queue-last-repair').then(row=>{if(row?.report)renderQueueReport(row.report,'Último reparo seguro');});
  }
  async function prepareSheetsMigration(){
    readSheetsSettings();setSheetsStatus('','Criando backup antes da migração…');
    try{
      await persistStateSnapshot('before-sheets-migration');
      if(loadLocalComputerConfig().enabled)await genesisLocalSyncAll().catch(error=>genesisLog('local.backup.before_sheets_failed',{error},'warn'));
      await persistAllRawCollections();const count=await enqueueSheetsRecords('migration',true);
      await dbPut(META_STORE,{id:'sheets-migration-v1',status:'prepared',records:count,updatedAt:Date.now()});
      await refreshSheetsStatus();showToast(`${count} registro(s) preparado(s), sem apagar o histórico`,true);
      if(sheetsConfigured()&&sheetsConfig.enabled)await syncSheets({silent:false});
    }catch(error){setSheetsStatus('bad','Falha ao preparar · dados originais mantidos');showToast(error.message||'Falha ao preparar dados.');}
  }

  function captureGenericDraft(){
    const roots=[document.querySelector('.screen.active'),...document.querySelectorAll('.sheet.open')].filter(Boolean),values={};
    roots.forEach(root=>root.querySelectorAll('input,textarea,select').forEach(element=>{
      if(!element.id||element.type==='file'||element.type==='password'||/token|senha|password/i.test(element.id))return;
      values[element.id]=element.type==='checkbox'?!!element.checked:element.value;
    }));
    return {id:'active-form',updatedAt:Date.now(),screen:typeof currentPrimaryScreen==='function'?currentPrimaryScreen():'',values};
  }
  async function persistDraft(reason='autosave'){
    const raw=store.get(GENESIS_DRAFT_KEY);let appDraft=null;try{appDraft=raw?JSON.parse(raw):null;}catch(error){}
    return dbPut(DRAFT_STORE,{...captureGenericDraft(),reason,appDraft});
  }
  function scheduleGenericDraft(reason='input'){
    clearTimeout(genericDraftTimer);genericDraftTimer=setTimeout(()=>persistDraft(reason).catch(()=>{}),420);
  }
  async function restoreIndexedDraft(){
    const draft=await dbGet(DRAFT_STORE,'active-form');if(!draft||Date.now()-Number(draft.updatedAt||0)>7*86400000)return false;
    if(draft.appDraft){
      let current=null;try{current=JSON.parse(store.get(GENESIS_DRAFT_KEY)||'null');}catch(error){}
      if(!current||Number(draft.appDraft.updatedAt||0)>Number(current.updatedAt||0))store.set(GENESIS_DRAFT_KEY,JSON.stringify(draft.appDraft));
    }
    Object.entries(draft.values||{}).forEach(([id,value])=>{const element=document.getElementById(id);if(element&&element.type!=='password'){if(element.type==='checkbox')element.checked=!!value;else element.value=value==null?'':String(value);}});
    return true;
  }

  function installRecoveryPanel(){
    if(document.getElementById('genesisRecoveryPanel'))return;
    const style=document.createElement('style');style.textContent='#genesisRecoveryPanel{position:fixed;inset:0;z-index:20000;background:rgba(1,3,10,.94);display:none;align-items:center;justify-content:center;padding:22px}#genesisRecoveryPanel.show{display:flex}#genesisRecoveryPanel .recovery-card{width:min(100%,430px);background:#0d1220;border:1px solid rgba(151,75,255,.55);border-radius:22px;padding:22px;color:#fff;box-shadow:0 24px 80px #000}#genesisRecoveryPanel .recovery-card h2{margin:0 0 8px}#genesisRecoveryPanel .recovery-card p{color:#aeb5c8;line-height:1.45}';document.head.appendChild(style);
    const panel=document.createElement('div');panel.id='genesisRecoveryPanel';panel.innerHTML='<div class="recovery-card"><h2>O Genesis protegeu seus dados</h2><p id="genesisRecoveryMessage">Ocorreu uma falha, mas seu rascunho e seu histórico continuam salvos.</p><small id="genesisRecoveryId"></small><div class="btn-row" style="margin-top:18px"><button class="btn btn-primary" id="genesisRecoveryRetry">Tentar novamente</button><button class="btn btn-secondary" id="genesisRecoveryDraft">Restaurar rascunho</button></div><div class="btn-row" style="margin-top:8px"><button class="btn btn-secondary" id="genesisRecoveryHome">Voltar ao início</button><button class="btn btn-ghost" id="genesisRecoveryExport">Exportar diagnóstico</button></div></div>';document.body.appendChild(panel);
    document.getElementById('genesisRecoveryRetry').onclick=()=>{panel.classList.remove('show');genesisRecoverUi('recovery-retry');};
    document.getElementById('genesisRecoveryDraft').onclick=async()=>{await restoreIndexedDraft();await restoreActiveDraft({reopen:true});panel.classList.remove('show');showToast('Rascunho restaurado',true);};
    document.getElementById('genesisRecoveryHome').onclick=()=>{panel.classList.remove('show');resetModalState({preserveOpen:false,reason:'recovery-home'});showScreen('calc');};
    document.getElementById('genesisRecoveryExport').onclick=exportGenesisErrorReport;
  }
  function showRecovery(error){
    const panel=document.getElementById('genesisRecoveryPanel');if(!panel)return;
    const errorId=`ERR-${Date.now().toString(36).toUpperCase()}`;document.getElementById('genesisRecoveryId').textContent=`Identificador: ${errorId}`;panel.classList.add('show');persistDraft('recovery-error');genesisLog('recovery.panel',{errorId,error},'error');
  }

  function installFinanceSourceOfTruth(){
    if(!window.GenesisFinance)return;
    validSaleOrder=order=>GenesisFinance.isRealized(order);
    insightOrderRevenue=order=>GenesisFinance.normalizeSale(order)?.revenue||0;
    orderFinancial=order=>{
      const sale=GenesisFinance.normalizeSale(order,{includeUnrealized:true});
      if(!sale)return null;
      if(!GenesisFinance.isRealized(order))return {...sale,revenue:0,profit:null};
      return sale;
    };
    orderProfit=order=>{const sale=GenesisFinance.normalizeSale(order);return sale?sale.profit:null;};
    orderCost=order=>{const sale=GenesisFinance.normalizeSale(order,{includeUnrealized:true});return sale?sale.cost:null;};
    orderFees=order=>{const sale=GenesisFinance.normalizeSale(order);return sale?sale.fees:null;};
    buildOrderFinancialSnapshot=order=>{
      const sale=GenesisFinance.normalizeSale(order,{includeUnrealized:true});if(!sale)return null;
      const realized=GenesisFinance.isRealized(order),internal=order.internalSnapshot||{};
      return {grossRevenue:sale.gross,revenue:realized?sale.revenue:0,cost:sale.cost,fees:sale.fees,profit:realized?sale.profit:null,margin:realized?sale.margin:0,items:sale.items,createdAt:Date.now(),basis:'genesis_finance_v1',timeHours:Number(internal.timeHours)>0?GenesisFinance.round2(Number(internal.timeHours)*(Number(order.qty)||1)):null,weightGrams:Number(internal.pesoG)>0?GenesisFinance.round2(Number(internal.pesoG)*(Number(order.qty)||1)):null,filamentName:internal.filamentName||'',filamentCost:Number(internal.custoFilamento)>0?GenesisFinance.round2(Number(internal.custoFilamento)*(Number(order.qty)||1)):null,unitCost:Number(internal.custoUnitario)||null};
    };
    aggregateInsightOrders=list=>{
      const aggregate=GenesisFinance.aggregateInsights(list),out={orders:aggregate.orders,gross:aggregate.gross,revenue:aggregate.revenue,profit:aggregate.profit,profitKnown:aggregate.orders,cost:aggregate.cost,costKnown:aggregate.orders,fees:aggregate.fees,feesKnown:aggregate.orders,printHours:0,printHoursKnown:0,weightG:0,weightKnown:0};
      list.forEach(order=>{const hours=orderPrintHours(order),weight=orderWeight(order);if(hours!=null){out.printHours+=hours;out.printHoursKnown++;}if(weight!=null){out.weightG+=weight;out.weightKnown++;}});
      out.ticket=out.orders?out.revenue/out.orders:0;out.margin=out.revenue?out.profit/out.revenue*100:0;out.profitHour=out.printHours>0?out.profit/out.printHours:null;return out;
    };
    insightProductRows=list=>{
      const map=new Map();
      GenesisFinance.deduplicateOrders(list).forEach(order=>{
        const sale=GenesisFinance.normalizeSale(order);if(!sale)return;
        sale.items.forEach(item=>{
          const key=mwNormalizeText(item.productName),row=map.get(key)||{key,name:item.productName,qty:0,orders:new Set(),revenue:0,profit:0,profitKnown:0,cost:0,costKnown:0,hours:0,hoursKnown:0,channels:new Set()};
          row.qty+=item.qty;row.orders.add(order.id);row.revenue+=item.revenue;row.profit+=item.profit;row.profitKnown++;row.cost+=item.cost;row.costKnown++;row.hours+=Number(item.timeHours)||0;if(item.timeHours)row.hoursKnown++;row.channels.add(sale.channel);map.set(key,row);
        });
      });
      return [...map.values()].map(row=>({...row,orderCount:row.orders.size,profitHour:row.hours>0?row.profit/row.hours:null,margin:row.revenue>0?row.profit/row.revenue*100:0}));
    };
    const costSourceForName=name=>{
      const normalized=mwNormalizeText(name||'');
      return history.filter(item=>mwNormalizeText(item.productName||'')===normalized&&Number(item.custoUnitario)>=0).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0]||null;
    };
    const ensureOrderSnapshots=order=>{
      if(!order)return order;
      const itemList=Array.isArray(order.kitItems)&&order.kitItems.length?order.kitItems:(Array.isArray(order.items)?order.items:[]);
      itemList.forEach(item=>{
        if(Number.isFinite(Number(item.costUnit??item.unitCost??item.custoUnitario)))return;
        const source=costSourceForName(item.productName||item.name||order.productName);if(!source)return;
        item.costUnit=Number(source.custoUnitario)||0;item.timeHours=Number(source.T)||Number(source.timeHours)||0;item.weightG=Number(source.pesoG)||0;item.filamentName=source.filamentName||'';item.costSnapshotSourceId=source.id;
      });
      if(order.financialSnapshot?.cost==null){
        const itemCost=itemList.reduce((sum,item)=>sum+(Number(item.costUnit??item.unitCost??item.custoUnitario)||0)*Math.max(1,Number(item.qty)||1),0);
        if(itemCost>0){order.internalSnapshot=Object.assign({},order.internalSnapshot||{},{custoUnitario:itemCost/Math.max(1,Number(order.qty)||1)});}
      }
      const snapshot=buildOrderFinancialSnapshot(order);
      if(!order.financialSnapshot||order.financialSnapshot.cost==null)order.financialSnapshot=snapshot;
      return order;
    };
    window.genesisEnsureOrderSnapshots=ensureOrderSnapshots;
    if(typeof upsert==='function'){
      const originalUpsert=upsert;upsert=function(group){return ensureOrderSnapshots(originalUpsert(group));};
    }
    if(typeof upsertLegacy==='function'){
      const originalUpsertLegacy=upsertLegacy;upsertLegacy=function(group){return ensureOrderSnapshots(originalUpsertLegacy(group));};
    }
    if(typeof convertKitToOrder==='function'){
      const originalConvertKit=convertKitToOrder;convertKitToOrder=async function(kit){const result=await originalConvertKit(kit);const order=orders.find(item=>item.id===kit.orderId);if(order){ensureOrderSnapshots(order);saveOrders();}return result;};
    }
  }

  function installPersistenceHooks(){
    const changed=(name,smallKey,value)=>{
      if(smallKey)store.set(smallKey,JSON.stringify(value));
      const source=syncMutationSource;
      scheduleRawCollection(name);scheduleStateSnapshot(name);scheduleSheetsQueue(name,source);
    };
    saveConfig=function(){changed('config',KEYS.CONFIG,cfg);};
    saveFilaments=function(){changed('filaments');};
    saveHistory=function(){changed('history');};
    saveQuotes=function(){changed('quotes');};
    saveOrders=function(){changed('orders');};
    saveKits=function(){changed('kits');};
    saveModels=function(){changed('savedModels');};
    saveMakerWorldCache=function(){changed('makerWorldCache');};
    saveShopeeCatalog=function(){changed('shopeeCatalog');};
    saveShopeeAliases=function(){changed('shopeeLearnedAliases');};
    saveImages=function(){changed('images');};
    saveCounters=function(){changed('counters',KEYS.COUNTERS,counters);};
    saveUI=function(){changed('uiState',KEYS.UI,uiState);};
    persistGenesisCoreToLocalStorage=function(){
      store.set(KEYS.CONFIG,JSON.stringify(cfg));store.set(KEYS.COUNTERS,JSON.stringify(counters));store.set(KEYS.UI,JSON.stringify(uiState));
      Object.keys(COLLECTIONS).forEach(scheduleRawCollection);
    };
    scheduleStateSnapshot=function(reason='change'){
      clearTimeout(stateSnapshotTimer);stateSnapshotTimer=setTimeout(()=>persistStateSnapshot(reason).catch(error=>genesisLog('state.snapshot.error',{error},'error')),5000);
    };
    const originalSaveDraft=saveActiveDraft;
    saveActiveDraft=function(reason='autosave'){originalSaveDraft(reason);persistDraft(reason).catch(()=>{});};
    const originalRestoreDraft=restoreActiveDraft;
    restoreActiveDraft=async function(options={}){await restoreIndexedDraft();return originalRestoreDraft(options);};
    const originalClearDraft=clearActiveDraft;
    clearActiveDraft=function(){originalClearDraft();dbDelete(DRAFT_STORE,'active-form');};
    const originalLog=genesisLog;
    genesisLog=function(event,details={},level='info'){
      originalLog(event,details,level);
      dbPut(DIAGNOSTIC_STORE,{id:`diag-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,createdAt:Date.now(),event,level,screen:document.querySelector('.screen.active')?.id||'boot',appVersion:GENESIS_APP_VERSION,details:sanitize(details)}).catch(()=>{});
    };
  }

  async function dataLayerRestore(){return restoreRawCollections();}
  async function dataLayerInit(){
    await migrateLegacyStorage();
    await repairSheetsQueue({silent:true,reason:'app-init'});
    let repairedSnapshots=false;
    if(typeof window.genesisEnsureOrderSnapshots==='function')orders.forEach(order=>{const before=order.financialSnapshot?.cost;window.genesisEnsureOrderSnapshots(order);if(before==null&&order.financialSnapshot?.cost!=null)repairedSnapshots=true;});
    if(repairedSnapshots)saveOrders();
    await restoreIndexedDraft();installRecoveryPanel();populateSheetsSettings();await refreshSheetsStatus();
    document.getElementById('btnSheetsTest')?.addEventListener('click',testSheets);
    document.getElementById('btnSheetsSync')?.addEventListener('click',()=>{readSheetsSettings();syncSheets({silent:false});});
    document.getElementById('btnSheetsMigrate')?.addEventListener('click',prepareSheetsMigration);
    document.getElementById('btnSheetsDiagnoseQueue')?.addEventListener('click',async()=>{const report=await diagnoseSheetsQueue();renderQueueReport(report);showToast('Diagnóstico da fila atualizado',true);});
    document.getElementById('btnSheetsRepairQueue')?.addEventListener('click',()=>showConfirm('Reparar fila de sincronização','O Genesis fará um backup e consolidará somente operações duplicadas ou superadas. Conflitos serão preservados.',async()=>{const report=await repairSheetsQueue({reason:'manual'});renderQueueReport(report,'Reparo concluído');},'Reparar fila'));
    document.getElementById('btnSheetsConflicts')?.addEventListener('click',openSyncConflicts);
    await renderSyncConflicts();
    ['sheetsApiUrl','sheetsApiToken','sheetsSyncEnabled'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{readSheetsSettings();refreshSheetsStatus();if(sheetsConfig.enabled)scheduleSheetsRetry();}));
    document.addEventListener('input',event=>{if(event.target.closest('.screen,.sheet'))scheduleGenericDraft('input');},true);
    document.addEventListener('change',event=>{if(event.target.closest('.screen,.sheet'))scheduleGenericDraft('change');},true);
    window.addEventListener('online',()=>{refreshSheetsStatus();scheduleSheetsRetry(500);});window.addEventListener('offline',refreshSheetsStatus);
    window.addEventListener('error',event=>{if(!event.message?.includes('ResizeObserver'))showRecovery(event.error||event.message);});
    window.addEventListener('unhandledrejection',event=>showRecovery(event.reason));
    if(sheetsConfig.enabled)scheduleSheetsRetry(1000);
    runFinancialAcceptanceTests();
  }
  function runFinancialAcceptanceTests(){
    const direct=GenesisFinance.calculateSaleTotals({channel:'direct',gross:100,cost:30});
    const shopee=GenesisFinance.calculateSaleTotals({channel:'shopee',gross:100,received:78,cost:30});
    const kitOrder={id:'test-kit',status:'concluido',channel:'direct',productTotal:108,kitId:'kit',productName:'Kit',payment:{status:'paid',paid:108,balance:0},financialSnapshot:{cost:0},kitItems:[{id:'a',name:'A',qty:1,unitPrice:30},{id:'b',name:'B',qty:1,unitPrice:40},{id:'c',name:'C',qty:1,unitPrice:50}]};
    const kit=GenesisFinance.normalizeSale(kitOrder),kitShopee=GenesisFinance.normalizeSale({...kitOrder,id:'test-kit-shopee',channel:'shopee',shopee:{finance:{grossProductRevenue:108,netRevenueReceived:86.4,financialStatus:'received'}}});
    const tests=[direct.revenue===100&&direct.profit===70&&direct.margin===70,shopee.fees===22&&shopee.revenue===78&&shopee.profit===48&&shopee.margin===61.54,kit?.items.map(item=>item.gross).join('|')==='27|36|45'&&GenesisFinance.validateSale(kit).ok,kitShopee?.revenue===86.4&&GenesisFinance.validateSale(kitShopee).ok];
    if(tests.some(value=>!value))genesisLog('finance.acceptance.failed',{tests},'error');else genesisLog('finance.acceptance.ok',{tests:tests.length});
  }

  installFinanceSourceOfTruth();installPersistenceHooks();
  window.genesisDataLayerRestore=dataLayerRestore;
  window.genesisDataLayerInit=dataLayerInit;
  window.genesisPersistDraftToIndexedDb=persistDraft;
  window.populateSheetsSettings=populateSheetsSettings;
  window.genesisSheetsSync=syncSheets;
  window.genesisSheetsApi=sheetsApi;
  window.genesisSheetsConfigured=sheetsConfigured;
  window.genesisSheetsQueueDiagnose=diagnoseSheetsQueue;
  window.genesisSheetsQueueRepair=repairSheetsQueue;
  window.genesisOpenSyncConflicts=openSyncConflicts;
  window.genesisSheetsSyncBusy=()=>sheetsSyncBusy;
  window.genesisSheetsDeviceId=()=>sheetsDeviceId;
  window.genesisSheetsPullEntity=pullSheetsEntity;
  window.genesisGetEntityVersion=sheetsEntityVersion;
  window.genesisSyncDiagnostics=syncDiagnostics;
  let dataLayerStarted=false;
  async function bootDataLayer(){
    if(dataLayerStarted)return;dataLayerStarted=true;
    try{await dataLayerRestore();await dataLayerInit();window.genesisRefreshVisibleScreen?.({includeCalc:true});}
    catch(error){dataLayerStarted=false;genesisLog('data-layer.boot.failed',{error},'error');}
  }
  if(window.genesisAppReady)setTimeout(bootDataLayer,0);else window.addEventListener('genesis:app-ready',()=>setTimeout(bootDataLayer,0),{once:true});
})();
