// A versão também faz parte da URL para o Safari não reutilizar um import antigo.
importScripts('./genesis-version.js?v=20260815.1');

const APP_VERSION=self.GenesisVersion.APP_VERSION;
const CACHE_VERSION=self.GenesisVersion.CACHE_VERSION;
const STATIC_CACHE=`genesis3d-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE=`genesis3d-runtime-v${CACHE_VERSION}`;
const SW_VERSION=APP_VERSION;
const CORE=['./','./index.html','./corrigido.html','./manifest.json','./genesis-version.js','./genesis-finance.js','./genesis-sync-core.js','./genesis-data.js','./genesis-realtime-core.js','./genesis-realtime.js','./genesis-workspace.js','./genesis-sync-status.js','./genesis-workspace.css','./genesis-logo.png','./genesis-192.png','./genesis-512.png','./genesis-hat-mask.png'];
const CORE_PATHS=new Set(CORE.map(path=>new URL(path,self.location.href).pathname));
const MAX_RUNTIME_ENTRIES=60;

self.addEventListener('install',event=>event.waitUntil(
  caches.open(STATIC_CACHE).then(cache=>Promise.all(CORE.map(url=>cache.add(url).catch(error=>console.warn('[Genesis cache]',url,error)))))
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('genesis3d-')&&!([STATIC_CACHE,RUNTIME_CACHE].includes(key))).map(key=>caches.delete(key))))
));

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_VERSION')event.source?.postMessage({type:'GENESIS_SW_VERSION',version:SW_VERSION});
});

async function trimRuntimeCache(){
  const cache=await caches.open(RUNTIME_CACHE),keys=await cache.keys();
  if(keys.length<=MAX_RUNTIME_ENTRIES)return;
  await Promise.all(keys.slice(0,keys.length-MAX_RUNTIME_ENTRIES).map(request=>cache.delete(request)));
}

async function navigationResponse(request){
  const cache=await caches.open(STATIC_CACHE),cached=await cache.match('./corrigido.html');
  if(cached)return cached;
  try{
    const response=await fetch(request);
    if(response?.ok)await cache.put('./corrigido.html',response.clone());
    return response;
  }catch(error){return (await caches.match(request))||(await caches.match('./corrigido.html'));}
}

async function staticResponse(request){
  const url=new URL(request.url),isCore=CORE_PATHS.has(url.pathname),cache=await caches.open(isCore?STATIC_CACHE:RUNTIME_CACHE);
  const cached=await cache.match(request,{ignoreSearch:isCore});
  if(cached)return cached;
  const response=await fetch(request);
  if(response?.ok){await cache.put(request,response.clone());if(!isCore)await trimRuntimeCache();}
  return response;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(navigationResponse(event.request));return;}
  event.respondWith(staticResponse(event.request));
});
