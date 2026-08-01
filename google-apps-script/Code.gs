/**
 * Genesis 3D — API gratuita para Google Sheets / Google Drive.
 * Execute setupGenesisDatabase() uma vez e depois implante como Aplicativo da Web.
 * Nenhum segredo deve ser escrito neste arquivo: use Script Properties.
 */
const GENESIS_API_VERSION = '2026.08.01.2';
const PROP_SPREADSHEET_ID = 'GENESIS_SPREADSHEET_ID';
const PROP_ACCESS_TOKEN = 'GENESIS_ACCESS_TOKEN';
const PROP_DRIVE_FOLDER_ID = 'GENESIS_DRIVE_FOLDER_ID';

const GENESIS_SCHEMAS = {
  Configuracoes:['id','chave','valor_json','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Produtos:['id','nome','tipo','categoria','ativo','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Filamentos:['id','nome','material','marca','cor','preco_rolo','peso_rolo','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Clientes:['id','nome','telefone','whatsapp','instagram','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Calculos:['id','produto_nome','filamento_id','quantidade','custo_unitario','preco_direto','preco_shopee','image_id','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Orcamentos:['id','numero','cliente_nome','status','valor_total','image_id','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Orcamento_Itens:['id','orcamento_id','produto_id','produto_nome_snapshot','quantidade','valor_unitario','valor_total','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Kits:['id','numero','nome','status','valor_normal','desconto_total','valor_final','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Kit_Itens:['id','kit_id','produto_id','produto_nome_snapshot','quantidade','preco_normal_unitario','custo_unitario_snapshot','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Pedidos:['id','numero','shopee_order_id','cliente_nome','canal','status','valor_total','image_id','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Vendas:['id','venda_id','pedido_id','data','canal','cliente_id','status','valor_bruto_total','taxas_canal_total','valor_recebido_total','faturamento_total','custo_producao_total','lucro_total','margem_total','desconto_total','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Venda_Itens:['id','venda_item_id','venda_id','pedido_id','produto_id','produto_nome_snapshot','quantidade','origem_item','kit_id','kit_nome_snapshot','preco_normal_unitario','percentual_desconto','valor_bruto_alocado','taxas_alocadas','faturamento_alocado','custo_unitario_snapshot','custo_total','lucro','margem','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Custos:['id','calculo_id','produto_nome','energia','maquina','filamento','custo_total','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Imagens:['id','entidade','entidade_id','produto_id','orcamento_id','pedido_id','nome_original','nome_arquivo','tipo_mime','tamanho_bytes','largura','altura','hash','imagem_original_id','imagem_editada_id','thumbnail_id','local_file_id','local_url','drive_file_id','drive_url','versao','principal','origem','created_at','updated_at','sync_status','deleted','dados_json'],
  Sincronizacao:['id','operation_id','entity','entity_id','action','status','attempts','message','created_at','updated_at','version','origem','sync_status','deleted','dados_json'],
  Diagnosticos:['id','nivel','evento','tela','versao_app','created_at','updated_at','version','origem','sync_status','deleted','dados_json']
};

function setupGenesisDatabase(spreadsheetName, accessToken) {
  const props=PropertiesService.getScriptProperties();
  let spreadsheet;
  const existingId=props.getProperty(PROP_SPREADSHEET_ID);
  if(existingId){
    spreadsheet=SpreadsheetApp.openById(existingId);
  }else{
    spreadsheet=SpreadsheetApp.create(spreadsheetName||'Genesis 3D — Banco de Dados');
    props.setProperty(PROP_SPREADSHEET_ID,spreadsheet.getId());
  }
  Object.keys(GENESIS_SCHEMAS).forEach(name=>ensureSheet_(spreadsheet,name));
  const first=spreadsheet.getSheets()[0];
  if(first&&!GENESIS_SCHEMAS[first.getName()]&&spreadsheet.getSheets().length>1)spreadsheet.deleteSheet(first);
  if(accessToken)setGenesisToken(accessToken);
  ensureDriveFolder_();
  return {ok:true,spreadsheet_id:spreadsheet.getId(),spreadsheet_url:spreadsheet.getUrl(),spreadsheet_name:spreadsheet.getName(),api_version:GENESIS_API_VERSION};
}

function setGenesisToken(token) {
  const clean=String(token||'').trim();
  if(clean.length<20)throw new Error('Use um token aleatório com pelo menos 20 caracteres.');
  PropertiesService.getScriptProperties().setProperty(PROP_ACCESS_TOKEN,clean);
  return 'Token configurado com segurança nas propriedades do script.';
}

function setGenesisSpreadsheetId(spreadsheetId) {
  const spreadsheet=SpreadsheetApp.openById(String(spreadsheetId||'').trim());
  PropertiesService.getScriptProperties().setProperty(PROP_SPREADSHEET_ID,spreadsheet.getId());
  Object.keys(GENESIS_SCHEMAS).forEach(name=>ensureSheet_(spreadsheet,name));
  return spreadsheet.getUrl();
}

function doGet(event) {
  try{
    const params=(event&&event.parameter)||{};
    assertToken_(params.token);
    const operation=params.operation||'healthCheck';
    if(operation==='healthCheck')return json_({...healthCheck_(),request_method:'GET'});
    if(operation==='read')return json_(read_({entity:params.entity,id:params.id,include_deleted:params.include_deleted==='true'}));
    if(operation==='readSince')return json_(readSince_({since:params.since||'',entities:params.entities?params.entities.split(','):[]}));
    throw new Error('Operação GET não permitida.');
  }catch(error){return json_({ok:false,error:String(error.message||error),api_version:GENESIS_API_VERSION});}
}

function doPost(event) {
  try{
    const body=parseBody_(event);
    assertToken_(body.token);
    let result;
    switch(body.operation){
      case 'healthCheck':result=healthCheck_();break;
      case 'read':result=read_(body);break;
      case 'readSince':result=readSince_(body);break;
      case 'create':case 'update':case 'upsert':case 'delete':
        result=batchSync_({operations:[{operation_id:body.operation_id||Utilities.getUuid(),entity:body.entity,entity_id:body.entity_id||body.payload&&body.payload.id,action:body.operation,payload:body.payload||{}}]});break;
      case 'batchSync':result=batchSync_(body);break;
      case 'uploadImage':result=uploadImage_(body);break;
      case 'downloadImage':result=downloadImage_(body);break;
      case 'imageMetadata':result=imageMetadata_(body);break;
      default:throw new Error('Operação inválida.');
    }
    return json_(result);
  }catch(error){
    try{writeDiagnostic_('error','api.request.failed',{message:String(error.message||error)});}catch(ignore){}
    return json_({ok:false,error:String(error.message||error),api_version:GENESIS_API_VERSION,server_time:new Date().toISOString()});
  }
}

function batchSync_(body) {
  const operations=Array.isArray(body.operations)?body.operations:[];
  if(!operations.length)return {ok:true,results:[],server_time:new Date().toISOString(),api_version:GENESIS_API_VERSION};
  if(operations.length>100)throw new Error('Envie no máximo 100 operações por lote.');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))throw new Error('A planilha está ocupada. Tente novamente em instantes.');
  try{
    const spreadsheet=getSpreadsheet_(),syncSheet=ensureSheet_(spreadsheet,'Sincronizacao');
    const processed=operationIds_(syncSheet),grouped={};
    operations.forEach(operation=>{
      validateOperation_(operation);
      if(!grouped[operation.entity])grouped[operation.entity]=[];
      grouped[operation.entity].push(operation);
    });
    const results=[],syncRows=[];
    Object.keys(grouped).forEach(entity=>{
      const sheet=ensureSheet_(spreadsheet,entity),headers=GENESIS_SCHEMAS[entity];
      const values=sheet.getDataRange().getValues(),rows=values.length>1?values.slice(1):[],idIndex=headers.indexOf('id'),versionIndex=headers.indexOf('version'),updatedIndex=headers.indexOf('updated_at');
      const rowById=new Map();rows.forEach((row,index)=>{if(row[idIndex])rowById.set(String(row[idIndex]),index);});
      grouped[entity].forEach(operation=>{
        if(processed.has(operation.operation_id)){
          results.push({ok:true,status:'duplicate',operation_id:operation.operation_id,entity,entity_id:operation.entity_id});return;
        }
        const payload=Object.assign({},operation.payload||{},{id:String(operation.entity_id||operation.payload&&operation.payload.id||'')});
        if(operation.action==='delete')payload.deleted=true;
        payload.sync_status='synced';payload.updated_at=payload.updated_at||new Date().toISOString();payload.created_at=payload.created_at||payload.updated_at;payload.version=Math.max(1,Number(payload.version)||1);
        const existingIndex=rowById.get(payload.id),existing=existingIndex===undefined?null:rows[existingIndex];
        if(existing&&isConflict_(existing,payload,versionIndex,updatedIndex)){
          const serverRecord=rowObject_(headers,existing);
          results.push({ok:false,status:'conflict',operation_id:operation.operation_id,entity,entity_id:payload.id,server_record:serverRecord});
          writeDiagnostic_('warn','sync.conflict',{operation_id:operation.operation_id,entity,entity_id:payload.id,server:serverRecord,local:payload});
          syncRows.push(syncRow_(operation,'conflict','Versões local e remota preservadas.'));
          return;
        }
        const next=headers.map(header=>cellValue_(payload[header]));
        if(existingIndex===undefined){rowById.set(payload.id,rows.length);rows.push(next);}else rows[existingIndex]=next;
        results.push({ok:true,status:existing?'updated':'created',operation_id:operation.operation_id,entity,entity_id:payload.id,version:payload.version});
        syncRows.push(syncRow_(operation,'synced',''));
        processed.add(operation.operation_id);
      });
      const previousRowCount=Math.max(0,values.length-1);
      if(previousRowCount||rows.length)sheet.getRange(2,1,Math.max(previousRowCount,rows.length,1),headers.length).clearContent();
      if(rows.length)sheet.getRange(2,1,rows.length,headers.length).setValues(rows);
    });
    if(syncRows.length)syncSheet.getRange(syncSheet.getLastRow()+1,1,syncRows.length,GENESIS_SCHEMAS.Sincronizacao.length).setValues(syncRows);
    SpreadsheetApp.flush();
    return {ok:true,results,server_time:new Date().toISOString(),api_version:GENESIS_API_VERSION};
  }finally{lock.releaseLock();}
}

function read_(body) {
  const entity=String(body.entity||'');validateEntity_(entity);
  const sheet=ensureSheet_(getSpreadsheet_(),entity),headers=GENESIS_SCHEMAS[entity],values=sheet.getDataRange().getValues().slice(1);
  const rows=values.map(row=>rowObject_(headers,row)).filter(row=>body.include_deleted||!truthy_(row.deleted));
  const selected=body.id?rows.filter(row=>String(row.id)===String(body.id)):rows;
  return {ok:true,entity,records:selected.map(payload=>({entity,payload})),server_time:new Date().toISOString(),api_version:GENESIS_API_VERSION};
}

function readSince_(body) {
  const since=body.since?new Date(body.since).getTime():0;
  const entities=(Array.isArray(body.entities)&&body.entities.length?body.entities:Object.keys(GENESIS_SCHEMAS).filter(name=>!['Sincronizacao','Diagnosticos'].includes(name))).filter(name=>GENESIS_SCHEMAS[name]);
  const spreadsheet=getSpreadsheet_(),records=[];
  entities.forEach(entity=>{
    validateEntity_(entity);const sheet=ensureSheet_(spreadsheet,entity),headers=GENESIS_SCHEMAS[entity],updatedIndex=headers.indexOf('updated_at');
    sheet.getDataRange().getValues().slice(1).forEach(row=>{
      const updated=new Date(row[updatedIndex]||0).getTime();
      if(!since||updated>since)records.push({entity,payload:rowObject_(headers,row)});
    });
  });
  return {ok:true,records,server_time:new Date().toISOString(),api_version:GENESIS_API_VERSION};
}

function uploadImage_(body) {
  if(!body.file_name||!body.mime_type||!body.base64)throw new Error('Imagem incompleta.');
  if(String(body.base64).length>6500000)throw new Error('Imagem grande demais para o Apps Script. Comprima antes do envio.');
  const bytes=Utilities.base64Decode(String(body.base64).replace(/^data:[^,]+,/,'')),blob=Utilities.newBlob(bytes,String(body.mime_type),String(body.file_name));
  const file=ensureDriveFolder_().createFile(blob);file.setDescription(`Genesis 3D · ${body.reference_id||''} · image_id=${body.image_id||body.reference_id||''}`);
  if(body.share_mode==='link')file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  const directUrl=body.share_mode==='link'?`https://drive.google.com/uc?export=view&id=${file.getId()}`:'';
  return {ok:true,file_id:file.getId(),url:file.getUrl(),direct_url:directUrl,name:file.getName(),mime_type:file.getMimeType(),size:file.getSize(),server_time:new Date().toISOString()};
}

function downloadImage_(body) {
  const id=String(body.file_id||'').trim();if(!id)throw new Error('file_id obrigatório.');
  const file=DriveApp.getFileById(id),blob=file.getBlob();
  if(blob.getBytes().length>5000000)throw new Error('Use a versão otimizada da imagem, limitada a 5 MB.');
  return {ok:true,file_id:id,file_name:file.getName(),mime_type:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes()),server_time:new Date().toISOString()};
}

function imageMetadata_(body) {
  const id=String(body.file_id||'').trim();if(!id)throw new Error('file_id obrigatório.');
  const file=DriveApp.getFileById(id);
  return {ok:true,file_id:id,name:file.getName(),mime_type:file.getMimeType(),size:file.getSize(),url:file.getUrl(),updated_at:file.getLastUpdated().toISOString(),server_time:new Date().toISOString()};
}

function healthCheck_() {
  const spreadsheet=getSpreadsheet_();
  return {ok:true,service:'Genesis 3D Sheets API',api_version:GENESIS_API_VERSION,spreadsheet_id:spreadsheet.getId(),spreadsheet_name:spreadsheet.getName(),server_time:new Date().toISOString()};
}

function getSpreadsheet_() {
  const id=PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  if(!id)throw new Error('Execute setupGenesisDatabase() antes de implantar a API.');
  return SpreadsheetApp.openById(id);
}
function ensureSheet_(spreadsheet,name) {
  const headers=GENESIS_SCHEMAS[name];if(!headers)throw new Error('Aba não permitida: '+name);
  let sheet=spreadsheet.getSheetByName(name);if(!sheet)sheet=spreadsheet.insertSheet(name);
  const current=sheet.getLastColumn()?sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),headers.length)).getValues()[0]:[];
  if(headers.some((header,index)=>current[index]!==header))sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#24143e').setFontColor('#ffffff');
  return sheet;
}
function ensureDriveFolder_() {
  const props=PropertiesService.getScriptProperties(),existing=props.getProperty(PROP_DRIVE_FOLDER_ID);
  if(existing){try{return DriveApp.getFolderById(existing);}catch(error){}}
  const folder=DriveApp.createFolder('Genesis 3D — Imagens');props.setProperty(PROP_DRIVE_FOLDER_ID,folder.getId());return folder;
}
function assertToken_(provided) {
  const expected=PropertiesService.getScriptProperties().getProperty(PROP_ACCESS_TOKEN);
  if(!expected)throw new Error('Token do backend ainda não configurado. Execute setGenesisToken().');
  if(String(provided||'')!==expected)throw new Error('Acesso não autorizado.');
}
function parseBody_(event) {
  const raw=event&&event.postData&&event.postData.contents;if(!raw)throw new Error('Corpo da requisição ausente.');
  try{return JSON.parse(raw);}catch(error){throw new Error('JSON inválido.');}
}
function validateEntity_(entity){if(!GENESIS_SCHEMAS[entity])throw new Error('Entidade não permitida: '+entity);}
function validateOperation_(operation){
  if(!operation||!operation.operation_id)throw new Error('operation_id obrigatório.');validateEntity_(operation.entity);
  if(!operation.entity_id&&!operation.payload?.id)throw new Error('entity_id obrigatório.');
  if(!['create','update','upsert','delete'].includes(operation.action))throw new Error('Ação inválida.');
}
function operationIds_(sheet){const index=GENESIS_SCHEMAS.Sincronizacao.indexOf('operation_id');return new Set(sheet.getDataRange().getValues().slice(1).map(row=>String(row[index]||'')).filter(Boolean));}
function isConflict_(existing,payload,versionIndex,updatedIndex){
  const serverVersion=Number(existing[versionIndex])||1,clientVersion=Number(payload.version)||1,serverUpdated=new Date(existing[updatedIndex]||0).getTime(),clientUpdated=new Date(payload.updated_at||0).getTime();
  return clientVersion<serverVersion||(clientVersion===serverVersion&&clientUpdated&&serverUpdated>clientUpdated);
}
function syncRow_(operation,status,message){
  const payload={id:operation.operation_id,operation_id:operation.operation_id,entity:operation.entity,entity_id:operation.entity_id,action:operation.action,status,attempts:Number(operation.attempts)||0,message:message||'',created_at:operation.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),version:1,origem:'genesis',sync_status:'synced',deleted:false,dados_json:JSON.stringify({reason:operation.reason||''})};
  return GENESIS_SCHEMAS.Sincronizacao.map(header=>cellValue_(payload[header]));
}
function writeDiagnostic_(level,event,details){
  const sheet=ensureSheet_(getSpreadsheet_(),'Diagnosticos'),now=new Date().toISOString(),payload={id:Utilities.getUuid(),nivel:level,evento:event,tela:'backend',versao_app:GENESIS_API_VERSION,created_at:now,updated_at:now,version:1,origem:'apps_script',sync_status:'synced',deleted:false,dados_json:JSON.stringify(details||{})};
  sheet.appendRow(GENESIS_SCHEMAS.Diagnosticos.map(header=>cellValue_(payload[header])));
}
function rowObject_(headers,row){const output={};headers.forEach((header,index)=>output[header]=row[index]);return output;}
function cellValue_(value){if(value===undefined||value===null)return '';if(value instanceof Date)return value.toISOString();if(typeof value==='object')return JSON.stringify(value);return value;}
function truthy_(value){return value===true||String(value).toLowerCase()==='true'||Number(value)===1;}
function json_(payload){return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);}
