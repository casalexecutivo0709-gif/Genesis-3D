import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=path.join(root,'genesis-local-server','config.json');

if(!existsSync(configPath)){
  console.log('Servidor local ao vivo: ignorado (config.json local ausente)');
  process.exit(0);
}

const config=JSON.parse(await readFile(configPath,'utf8'));
const tls=Boolean(config.tls?.pfxPath||(config.tls?.certPath&&config.tls?.keyPath));
const base=new URL(`${tls?'https':'http'}://127.0.0.1:${Number(config.port)||8765}`);
const origin='https://casalexecutivo0709-gif.github.io';

function request(pathname,{method='GET',token=config.accessToken,requestOrigin=origin,headers={},body=null}={}){
  return new Promise((resolve,reject)=>{
    const target=new URL(pathname,base),client=target.protocol==='https:'?https:http;
    const payload=body==null?null:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
    const req=client.request({hostname:target.hostname,port:target.port,path:target.pathname+target.search,method,rejectUnauthorized:false,headers:{Origin:requestOrigin,'X-Genesis-Token':token||'',...(payload?{'Content-Type':'application/json','Content-Length':payload.length}:{}),...headers}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });
    req.setTimeout(5000,()=>req.destroy(new Error('timeout')));req.on('error',reject);if(payload)req.write(payload);req.end();
  });
}

let health;
try{health=await request('/health');}
catch(error){console.log('Servidor local ao vivo: ignorado (servidor indisponível)');process.exit(0);}

assert.equal(health.status,200);
const healthJson=JSON.parse(health.body.toString('utf8'));
assert.equal(healthJson.ok,true);
assert.equal(healthJson.version,3);
assert.equal(healthJson.requestOrigin,origin);
assert.equal(healthJson.capabilities.images,true);
assert.equal(healthJson.capabilities.snapshots,true);

const status=await request('/v1/status');
assert.equal(status.status,200);
const statusJson=JSON.parse(status.body.toString('utf8'));
assert.equal(statusJson.ok,true);
assert.ok(Number.isFinite(Number(statusJson.imageCount)));

const images=await request('/v1/images');
assert.equal(images.status,200);
const imagesJson=JSON.parse(images.body.toString('utf8'));
assert.equal(imagesJson.ok,true);
assert.ok(Array.isArray(imagesJson.images));
if(imagesJson.images.length){
  const first=imagesJson.images.find(item=>item?.id);
  if(first){
    const meta=await request(`/v1/images/${encodeURIComponent(first.id)}/meta`);
    assert.equal(meta.status,200);
    assert.equal(JSON.parse(meta.body.toString('utf8')).ok,true);
  }
}

const invalidToken=await request('/health',{token:'invalid-token-for-regression'});
assert.equal(invalidToken.status,401);
assert.equal(JSON.parse(invalidToken.body.toString('utf8')).code,'invalid_pairing_code');

const invalidOrigin=await request('/health',{requestOrigin:'https://invalid.example'});
assert.equal(invalidOrigin.status,403);
assert.equal(JSON.parse(invalidOrigin.body.toString('utf8')).code,'origin_not_allowed');

const preflight=await request('/health',{method:'OPTIONS',token:'',headers:{'Access-Control-Request-Method':'GET','Access-Control-Request-Private-Network':'true'}});
assert.equal(preflight.status,204);
assert.equal(preflight.headers['access-control-allow-origin'],origin);
assert.equal(preflight.headers['access-control-allow-private-network'],'true');

const latest=await request('/v1/snapshots/latest');
assert.ok([200,404].includes(latest.status));
if(latest.status===200){
  const envelope=JSON.parse(latest.body.toString('utf8'));
  assert.ok(envelope&&typeof envelope.data==='object');
  const backup=await request('/v1/backups',{method:'POST',body:envelope.data});
  assert.equal(backup.status,200);
  assert.equal(JSON.parse(backup.body.toString('utf8')).ok,true);
  const restored=await request('/v1/snapshots/latest');
  assert.equal(restored.status,200);
  assert.deepEqual(JSON.parse(restored.body.toString('utf8')).data,envelope.data);
}

console.log(`Servidor local ao vivo: HTTPS=${tls?'sim':'não'}, autenticação, CORS, imagens, backup e restauração OK`);
