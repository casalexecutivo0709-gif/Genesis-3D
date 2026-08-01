import http from 'node:http';
import https from 'node:https';
import {createReadStream, existsSync} from 'node:fs';
import {mkdir, readFile, writeFile, rename, readdir, unlink} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {randomBytes} from 'node:crypto';

const ROOT=dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const CONFIG_PATH=join(ROOT,'config.json');
const DEFAULT_ORIGIN='https://casalexecutivo0709-gif.github.io';

async function atomicWrite(path,data){
  await mkdir(dirname(path),{recursive:true});
  const temp=path+'.tmp-'+randomBytes(5).toString('hex');
  await writeFile(temp,data);
  try{await unlink(path)}catch{}
  await rename(temp,path);
}
async function loadConfig(){
  if(!existsSync(CONFIG_PATH)){
    const initial={
      host:'0.0.0.0',port:8765,dataDir:'./GenesisData',
      accessToken:randomBytes(24).toString('base64url'),
      allowedOrigins:[DEFAULT_ORIGIN],
      tls:{pfxPath:'',passphrase:''}
    };
    await atomicWrite(CONFIG_PATH,JSON.stringify(initial,null,2));
    console.log('Configuração criada em:',CONFIG_PATH);
    console.log('Código de pareamento:',initial.accessToken);
    console.log('Configure tls.pfxPath antes de conectar pelo iPhone.');
    return initial;
  }
  return JSON.parse(await readFile(CONFIG_PATH,'utf8'));
}
const config=await loadConfig();
const DATA_DIR=resolve(ROOT,config.dataDir||'./GenesisData');
const SNAPSHOT_DIR=join(DATA_DIR,'snapshots');
const IMAGE_DIR=join(DATA_DIR,'images');
await mkdir(SNAPSHOT_DIR,{recursive:true});await mkdir(IMAGE_DIR,{recursive:true});

function cleanId(value){
  const id=basename(String(value||'')).replace(/[^a-zA-Z0-9._-]/g,'');
  return id.length>=3&&id.length<=160?id:'';
}
function allowedOrigin(req){
  const origin=String(req.headers.origin||'');
  return !origin||(config.allowedOrigins||[DEFAULT_ORIGIN]).includes(origin);
}
function cors(req){
  const origin=String(req.headers.origin||DEFAULT_ORIGIN);
  return {
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,X-Genesis-Token,X-Genesis-Source-Type',
    'Access-Control-Max-Age':'86400','Vary':'Origin'
  };
}
function sendJson(req,res,status,payload){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors(req)});
  res.end(JSON.stringify(payload));
}
function authorized(req){
  const supplied=String(req.headers['x-genesis-token']||'');
  const expected=String(config.accessToken||'');
  if(!expected||supplied.length!==expected.length)return false;
  let diff=0;for(let i=0;i<supplied.length;i++)diff|=supplied.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}
async function readBody(req,limit){
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;if(size>limit)throw Object.assign(new Error('Arquivo maior que o limite.'),{status:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function imagePaths(id){
  return {data:join(IMAGE_DIR,id+'.bin'),meta:join(IMAGE_DIR,id+'.json')};
}
async function pruneSnapshots(){
  const files=(await readdir(SNAPSHOT_DIR)).filter(x=>/^snapshot-\d+\.json$/.test(x)).sort().reverse();
  for(const file of files.slice(30))try{await unlink(join(SNAPSHOT_DIR,file))}catch{}
}
async function handler(req,res){
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,cors(req));res.end();return}
    if(!allowedOrigin(req)){sendJson(req,res,403,{ok:false,error:'Origem não permitida.'});return}
    if(!authorized(req)){sendJson(req,res,401,{ok:false,error:'Código de pareamento inválido.'});return}
    const url=new URL(req.url,'https://genesis.local');
    if(req.method==='GET'&&url.pathname==='/health'){
      sendJson(req,res,200,{ok:true,service:'Genesis 3D Local Storage',version:1,time:new Date().toISOString()});return;
    }
    if(req.method==='POST'&&url.pathname==='/v1/snapshots'){
      const body=await readBody(req,12*1024*1024);
      const parsed=JSON.parse(body.toString('utf8'));
      if(!parsed||typeof parsed!=='object')throw Object.assign(new Error('Cópia inválida.'),{status:400});
      const envelope=Buffer.from(JSON.stringify({savedAt:new Date().toISOString(),data:parsed},null,2));
      await atomicWrite(join(SNAPSHOT_DIR,'latest.json'),envelope);
      await atomicWrite(join(SNAPSHOT_DIR,`snapshot-${Date.now()}.json`),envelope);
      await pruneSnapshots();
      sendJson(req,res,200,{ok:true,savedAt:new Date().toISOString()});return;
    }
    if(req.method==='GET'&&url.pathname==='/v1/snapshots/latest'){
      const file=join(SNAPSHOT_DIR,'latest.json');
      if(!existsSync(file)){sendJson(req,res,404,{ok:false,error:'Ainda não existe cópia no computador.'});return}
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors(req)});
      createReadStream(file).pipe(res);return;
    }
    const imageMatch=url.pathname.match(/^\/v1\/images\/([^/]+)$/);
    if(imageMatch){
      const id=cleanId(decodeURIComponent(imageMatch[1]));if(!id){sendJson(req,res,400,{ok:false,error:'ID de imagem inválido.'});return}
      const paths=imagePaths(id);
      if(req.method==='POST'){
        const body=await readBody(req,25*1024*1024);
        const mime=String(req.headers['content-type']||'application/octet-stream').split(';')[0].slice(0,100);
        if(!mime.startsWith('image/')){sendJson(req,res,415,{ok:false,error:'O arquivo não é uma imagem.'});return}
        await atomicWrite(paths.data,body);
        await atomicWrite(paths.meta,JSON.stringify({id,mime,size:body.length,sourceType:String(req.headers['x-genesis-source-type']||''),savedAt:new Date().toISOString()},null,2));
        sendJson(req,res,200,{ok:true,id,size:body.length});return;
      }
      if(req.method==='GET'){
        if(!existsSync(paths.data)){sendJson(req,res,404,{ok:false,error:'Imagem não encontrada.'});return}
        let meta={mime:'application/octet-stream'};try{meta=JSON.parse(await readFile(paths.meta,'utf8'))}catch{}
        res.writeHead(200,{'Content-Type':meta.mime||'application/octet-stream','Cache-Control':'no-store',...cors(req)});
        createReadStream(paths.data).pipe(res);return;
      }
    }
    sendJson(req,res,404,{ok:false,error:'Endpoint inexistente.'});
  }catch(error){
    console.error(new Date().toISOString(),error);
    sendJson(req,res,error.status||500,{ok:false,error:error.status?error.message:'Falha interna no servidor local.'});
  }
}

let server;
const pfxPath=String(config.tls?.pfxPath||'').trim();
const certPath=String(config.tls?.certPath||'').trim();
const keyPath=String(config.tls?.keyPath||'').trim();
const hasPem=Boolean(certPath&&keyPath);
if(pfxPath){
  const pfx=await readFile(resolve(ROOT,pfxPath));
  server=https.createServer({pfx,passphrase:String(config.tls?.passphrase||'')},handler);
}else if(hasPem){
  const [cert,key]=await Promise.all([
    readFile(resolve(ROOT,certPath)),
    readFile(resolve(ROOT,keyPath))
  ]);
  server=https.createServer({cert,key},handler);
}else{
  server=http.createServer(handler);
}
server.listen(Number(config.port)||8765,String(config.host||'0.0.0.0'),()=>{
  const protocol=(pfxPath||hasPem)?'https':'http';
  console.log(`Genesis 3D Local Storage ativo em ${protocol}://${config.host||'0.0.0.0'}:${Number(config.port)||8765}`);
  console.log('Pasta dos dados:',DATA_DIR);
  console.log('Código de pareamento:',config.accessToken);
  if(!pfxPath)console.warn('ATENÇÃO: o iPhone exige HTTPS. Configure tls.pfxPath no config.json.');
});
