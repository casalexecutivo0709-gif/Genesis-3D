import http from 'node:http';
import https from 'node:https';
import {createReadStream, existsSync} from 'node:fs';
import {mkdir, readFile, writeFile, rename, readdir, unlink, stat} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';

const ROOT=dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH=join(ROOT,'config.json');
const DEFAULT_ORIGIN='https://casalexecutivo0709-gif.github.io';
const SERVER_VERSION=2;
const VARIANTS=new Set(['original','edited','optimized','thumbnail']);
const ALLOWED_MIME=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);

async function atomicWrite(path,data){
  await mkdir(dirname(path),{recursive:true});
  const temp=path+'.tmp-'+randomBytes(5).toString('hex');
  await writeFile(temp,data);
  try{await unlink(path)}catch{}
  await rename(temp,path);
}
async function loadConfig(){
  if(!existsSync(CONFIG_PATH)){
    const initial={host:'0.0.0.0',port:8765,dataDir:'./GenesisData',accessToken:randomBytes(24).toString('base64url'),allowedOrigins:[DEFAULT_ORIGIN],maxImageBytes:26214400,allowOpenFolder:true,tls:{pfxPath:'',passphrase:'',certPath:'',keyPath:''}};
    await atomicWrite(CONFIG_PATH,JSON.stringify(initial,null,2));
    console.log('Configuração criada em:',CONFIG_PATH);
    console.log('Código de pareamento:',initial.accessToken);
    console.log('Configure HTTPS antes de conectar pelo iPhone.');
    return initial;
  }
  return JSON.parse(await readFile(CONFIG_PATH,'utf8'));
}
const config=await loadConfig();
const DATA_DIR=resolve(ROOT,config.dataDir||'./GenesisData');
const SNAPSHOT_DIR=join(DATA_DIR,'snapshots');
const IMAGE_DIR=join(DATA_DIR,'images');
const IMAGE_INDEX=join(IMAGE_DIR,'index.json');
await mkdir(SNAPSHOT_DIR,{recursive:true});await mkdir(IMAGE_DIR,{recursive:true});

function cleanId(value){
  const id=basename(String(value||'')).replace(/[^a-zA-Z0-9._-]/g,'');
  return id.length>=3&&id.length<=160?id:'';
}
function cleanVariant(value){const variant=String(value||'optimized').toLowerCase();return VARIANTS.has(variant)?variant:'';}
function cleanFileName(value){
  const name=basename(String(value||'imagem')).normalize('NFKD').replace(/[^a-zA-Z0-9._ -]/g,'').trim().replace(/\s+/g,'-').slice(0,100);
  return name||'imagem';
}
function allowedOrigin(req){
  const origin=String(req.headers.origin||'');
  if(!origin)return true;
  if((config.allowedOrigins||[DEFAULT_ORIGIN]).includes(origin))return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}
function cors(req){
  const origin=String(req.headers.origin||DEFAULT_ORIGIN);
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Genesis-Token,X-Genesis-Source-Type,X-Genesis-Variant,X-Genesis-File-Name,X-Genesis-Width,X-Genesis-Height,X-Genesis-Entity,X-Genesis-Entity-Id,X-Genesis-Hash','Access-Control-Max-Age':'86400','Vary':'Origin'};
}
function sendJson(req,res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors(req)});res.end(JSON.stringify(payload));}
function authorized(req){
  const supplied=Buffer.from(String(req.headers['x-genesis-token']||''));
  const expected=Buffer.from(String(config.accessToken||''));
  return expected.length>0&&supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
async function readBody(req,limit){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Arquivo maior que o limite.'),{status:413});chunks.push(chunk);}
  return Buffer.concat(chunks);
}
function imageFolder(id){return join(IMAGE_DIR,id);}
function imageMetaPath(id){return join(imageFolder(id),'metadata.json');}
function imageVariantPath(id,variant){return join(imageFolder(id),variant+'.bin');}
function legacyImagePaths(id){return {data:join(IMAGE_DIR,id+'.bin'),meta:join(IMAGE_DIR,id+'.json')};}
function hashBuffer(buffer){return createHash('sha256').update(buffer).digest('hex');}
function validSignature(buffer,mime){
  if(buffer.length<12)return false;
  if(mime==='image/jpeg')return buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
  if(mime==='image/png')return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/webp')return buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  if(mime==='image/heic'||mime==='image/heif')return buffer.toString('ascii',4,8)==='ftyp';
  return false;
}
async function readJson(path,fallback={}){try{return JSON.parse(await readFile(path,'utf8'))}catch{return fallback}}
async function loadImageIndex(){return readJson(IMAGE_INDEX,{version:1,updatedAt:'',images:{}})}
async function saveImageIndex(index){index.updatedAt=new Date().toISOString();await atomicWrite(IMAGE_INDEX,JSON.stringify(index,null,2));}
async function updateImageIndex(meta){const index=await loadImageIndex();index.images[meta.id]=meta;await saveImageIndex(index);}
async function migrateLegacyImageIndex(){
  const index=await loadImageIndex();let changed=false;
  for(const file of (await readdir(IMAGE_DIR).catch(()=>[])).filter(name=>name.endsWith('.bin'))){
    const id=cleanId(file.slice(0,-4));if(!id||index.images[id])continue;
    const paths=legacyImagePaths(id),legacy=await readJson(paths.meta,{}),info=await stat(paths.data).catch(()=>null);if(!info)continue;
    const savedAt=legacy.savedAt||info.mtime.toISOString(),mime=legacy.mime||'application/octet-stream';
    index.images[id]={id,fileName:cleanFileName(legacy.fileName||id),sourceType:legacy.sourceType||'legacy',entity:legacy.entity||'',entityId:cleanId(legacy.entityId||'')||'',width:Number(legacy.width)||0,height:Number(legacy.height)||0,hash:legacy.hash||'',mime,size:Number(legacy.size)||info.size,variants:{optimized:{variant:'optimized',mime,size:Number(legacy.size)||info.size,hash:legacy.hash||'',savedAt,legacy:true}},createdAt:savedAt,updatedAt:savedAt,deleted:false,legacy:true};
    changed=true;
  }
  if(changed)await saveImageIndex(index);
}
await migrateLegacyImageIndex();
async function pruneSnapshots(){const files=(await readdir(SNAPSHOT_DIR)).filter(x=>/^snapshot-\d+\.json$/.test(x)).sort().reverse();for(const file of files.slice(30))try{await unlink(join(SNAPSHOT_DIR,file))}catch{}}
async function folderSize(path){
  let total=0;for(const entry of await readdir(path,{withFileTypes:true}).catch(()=>[])){const target=join(path,entry.name);if(entry.isDirectory())total+=await folderSize(target);else total+=(await stat(target).catch(()=>({size:0}))).size||0;}return total;
}
function requestBase(req){const protocol=req.socket.encrypted?'https':'http';return `${protocol}://${req.headers.host}`;}
async function imageResponse(req,res,id,variant){
  const meta=await readJson(imageMetaPath(id),null)||await readJson(legacyImagePaths(id).meta,{});let target=imageVariantPath(id,variant);
  if(!existsSync(target)&&variant!=='optimized')target=imageVariantPath(id,'optimized');
  if(!existsSync(target))target=imageVariantPath(id,'original');
  if(!existsSync(target))target=legacyImagePaths(id).data;
  if(!existsSync(target)){sendJson(req,res,404,{ok:false,error:'Imagem não encontrada.'});return;}
  const variantMeta=meta.variants?.[variant]||meta.variants?.optimized||meta.variants?.original||meta;
  res.writeHead(200,{'Content-Type':variantMeta.mime||meta.mime||'application/octet-stream','Content-Length':(await stat(target)).size,'Cache-Control':'private, max-age=300','ETag':`"${variantMeta.hash||meta.hash||id}"`,...cors(req)});
  createReadStream(target).pipe(res);
}
async function saveImageVariant(req,id,body){
  const variant=cleanVariant(req.headers['x-genesis-variant']||'optimized');if(!variant)throw Object.assign(new Error('Variante inválida.'),{status:400});
  const mime=String(req.headers['content-type']||'').split(';')[0].toLowerCase();
  if(!ALLOWED_MIME.has(mime)||!validSignature(body,mime))throw Object.assign(new Error('Formato de imagem não permitido ou conteúdo inválido.'),{status:415});
  const now=new Date().toISOString(),hash=hashBuffer(body),folder=imageFolder(id);await mkdir(folder,{recursive:true});
  await atomicWrite(imageVariantPath(id,variant),body);
  const previous=await readJson(imageMetaPath(id),{}),variants=previous.variants||{};
  variants[variant]={variant,mime,size:body.length,hash,savedAt:now};
  const meta={...previous,id,fileName:cleanFileName(req.headers['x-genesis-file-name']||previous.fileName||id),sourceType:String(req.headers['x-genesis-source-type']||previous.sourceType||'').slice(0,80),entity:String(req.headers['x-genesis-entity']||previous.entity||'').slice(0,50),entityId:cleanId(req.headers['x-genesis-entity-id']||previous.entityId||'')||'',width:Math.max(0,Number(req.headers['x-genesis-width'])||Number(previous.width)||0),height:Math.max(0,Number(req.headers['x-genesis-height'])||Number(previous.height)||0),hash:String(req.headers['x-genesis-hash']||previous.hash||hash).slice(0,128),mime:variants.optimized?.mime||variants.original?.mime||mime,size:variants.original?.size||variants.optimized?.size||body.length,variants,createdAt:previous.createdAt||now,updatedAt:now,deleted:false};
  await atomicWrite(imageMetaPath(id),JSON.stringify(meta,null,2));await updateImageIndex(meta);
  return meta;
}
async function openDataFolder(){
  if(config.allowOpenFolder===false)throw Object.assign(new Error('A abertura da pasta está desativada no config.json.'),{status:403});
  if(process.platform==='win32')spawn('explorer.exe',[DATA_DIR],{detached:true,stdio:'ignore',windowsHide:true}).unref();
  else if(process.platform==='darwin')spawn('open',[DATA_DIR],{detached:true,stdio:'ignore'}).unref();
  else spawn('xdg-open',[DATA_DIR],{detached:true,stdio:'ignore'}).unref();
}

async function handler(req,res){
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,cors(req));res.end();return;}
    if(!allowedOrigin(req)){sendJson(req,res,403,{ok:false,error:'Origem não permitida.'});return;}
    if(!authorized(req)){sendJson(req,res,401,{ok:false,error:'Código de pareamento inválido.'});return;}
    const url=new URL(req.url,'https://genesis.local');
    if(req.method==='GET'&&url.pathname==='/health'){sendJson(req,res,200,{ok:true,service:'Genesis 3D Local Storage',version:SERVER_VERSION,capabilities:{snapshots:true,images:true,variants:true,library:true,openFolder:config.allowOpenFolder!==false},time:new Date().toISOString()});return;}
    if(req.method==='GET'&&url.pathname==='/v1/status'){
      const index=await loadImageIndex(),images=Object.values(index.images||{}).filter(item=>!item.deleted),snapshots=(await readdir(SNAPSHOT_DIR).catch(()=>[])).filter(name=>name.endsWith('.json'));
      sendJson(req,res,200,{ok:true,connected:true,url:requestBase(req),imageCount:images.length,bytesUsed:await folderSize(DATA_DIR),lastBackup:(await readJson(join(SNAPSHOT_DIR,'latest.json'),{})).savedAt||'',backupCount:snapshots.length,dataDir:DATA_DIR,time:new Date().toISOString()});return;
    }
    if(req.method==='POST'&&(url.pathname==='/v1/snapshots'||url.pathname==='/v1/backups')){
      const body=await readBody(req,12*1024*1024),parsed=JSON.parse(body.toString('utf8'));if(!parsed||typeof parsed!=='object')throw Object.assign(new Error('Cópia inválida.'),{status:400});
      const savedAt=new Date().toISOString(),envelope=Buffer.from(JSON.stringify({savedAt,data:parsed},null,2));await atomicWrite(join(SNAPSHOT_DIR,'latest.json'),envelope);await atomicWrite(join(SNAPSHOT_DIR,`snapshot-${Date.now()}.json`),envelope);await pruneSnapshots();sendJson(req,res,200,{ok:true,savedAt});return;
    }
    if(req.method==='GET'&&url.pathname==='/v1/snapshots/latest'){
      const file=join(SNAPSHOT_DIR,'latest.json');if(!existsSync(file)){sendJson(req,res,404,{ok:false,error:'Ainda não existe cópia no computador.'});return;}res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors(req)});createReadStream(file).pipe(res);return;
    }
    if(req.method==='GET'&&url.pathname==='/v1/images'){
      const index=await loadImageIndex(),query=String(url.searchParams.get('q')||'').toLowerCase(),origin=String(url.searchParams.get('origin')||'').toLowerCase();
      const images=Object.values(index.images||{}).filter(item=>!item.deleted&&(!query||`${item.fileName||''} ${item.entity||''} ${item.entityId||''}`.toLowerCase().includes(query))&&(!origin||String(item.sourceType||'').toLowerCase()===origin)).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,500).map(item=>({...item,localUrl:`${requestBase(req)}/v1/images/${encodeURIComponent(item.id)}?variant=optimized`,thumbnailUrl:`${requestBase(req)}/v1/images/${encodeURIComponent(item.id)}?variant=thumbnail`}));
      sendJson(req,res,200,{ok:true,images,count:images.length});return;
    }
    const metaMatch=url.pathname.match(/^\/v1\/images\/([^/]+)\/meta$/);
    if(req.method==='GET'&&metaMatch){const id=cleanId(decodeURIComponent(metaMatch[1]));if(!id)throw Object.assign(new Error('ID inválido.'),{status:400});const meta=await readJson(imageMetaPath(id),null)||await readJson(legacyImagePaths(id).meta,null);if(!meta){sendJson(req,res,404,{ok:false,error:'Imagem não encontrada.'});return;}sendJson(req,res,200,{ok:true,image:meta});return;}
    const deleteMatch=url.pathname.match(/^\/v1\/images\/([^/]+)\/delete$/);
    if(req.method==='POST'&&deleteMatch){const id=cleanId(decodeURIComponent(deleteMatch[1]));if(!id)throw Object.assign(new Error('ID inválido.'),{status:400});const meta=await readJson(imageMetaPath(id),{id});meta.deleted=true;meta.updatedAt=new Date().toISOString();await atomicWrite(imageMetaPath(id),JSON.stringify(meta,null,2));await updateImageIndex(meta);sendJson(req,res,200,{ok:true,id,deleted:true});return;}
    const imageMatch=url.pathname.match(/^\/v1\/images\/([^/]+)$/);
    if(imageMatch){
      const id=cleanId(decodeURIComponent(imageMatch[1]));if(!id)throw Object.assign(new Error('ID de imagem inválido.'),{status:400});
      if(req.method==='POST'){const body=await readBody(req,Math.max(1024,Number(config.maxImageBytes)||25*1024*1024));const meta=await saveImageVariant(req,id,body);sendJson(req,res,200,{ok:true,id,hash:meta.hash,size:body.length,local_file_id:id,local_url:`${requestBase(req)}/v1/images/${encodeURIComponent(id)}?variant=optimized`,thumbnail_url:`${requestBase(req)}/v1/images/${encodeURIComponent(id)}?variant=thumbnail`,sync_status:'synced'});return;}
      if(req.method==='GET'){await imageResponse(req,res,id,cleanVariant(url.searchParams.get('variant')||'optimized')||'optimized');return;}
    }
    if(req.method==='POST'&&url.pathname==='/v1/folder/open'){await openDataFolder();sendJson(req,res,200,{ok:true,path:DATA_DIR});return;}
    sendJson(req,res,404,{ok:false,error:'Endpoint inexistente.'});
  }catch(error){console.error(new Date().toISOString(),error);sendJson(req,res,error.status||500,{ok:false,error:error.status?error.message:'Falha interna no servidor local.'});}
}

let server;const pfxPath=String(config.tls?.pfxPath||'').trim(),certPath=String(config.tls?.certPath||'').trim(),keyPath=String(config.tls?.keyPath||'').trim(),hasPem=Boolean(certPath&&keyPath);
if(pfxPath){server=https.createServer({pfx:await readFile(resolve(ROOT,pfxPath)),passphrase:String(config.tls?.passphrase||'')},handler);}
else if(hasPem){const [cert,key]=await Promise.all([readFile(resolve(ROOT,certPath)),readFile(resolve(ROOT,keyPath))]);server=https.createServer({cert,key},handler);}
else server=http.createServer(handler);
server.listen(Number(config.port)||8765,String(config.host||'0.0.0.0'),()=>{const protocol=(pfxPath||hasPem)?'https':'http';console.log(`Genesis 3D Local Storage v${SERVER_VERSION} ativo em ${protocol}://${config.host||'0.0.0.0'}:${Number(config.port)||8765}`);console.log('Pasta dos dados:',DATA_DIR);console.log('Código de pareamento:',config.accessToken);if(!pfxPath&&!hasPem)console.warn('ATENÇÃO: o app hospedado em HTTPS e o iPhone exigem um certificado HTTPS confiável.');});
