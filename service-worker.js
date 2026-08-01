const STATIC_CACHE='genesis3d-static-v30-sheets-20260801';
const RUNTIME_CACHE='genesis3d-runtime-v30-sheets-20260801';
const SW_VERSION='30-sheets-finance-stability-20260801';
const CORE=['./','./index.html','./corrigido.html','./manifest.json','./genesis-finance.js','./genesis-data.js','./genesis-logo.png','./genesis-192.png','./genesis-512.png','./genesis-hat-mask.png'];
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
  try{
    const response=await fetch(request);
    if(response?.ok){const cache=await caches.open(STATIC_CACHE);await cache.put(request,response.clone());}
    return response;
  }catch(error){return (await caches.match(request))||(await caches.match('./corrigido.html'));}
}

async function staticResponse(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response?.ok){const cache=await caches.open(RUNTIME_CACHE);await cache.put(request,response.clone());await trimRuntimeCache();}
  return response;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(navigationResponse(event.request));return;}
  event.respondWith(staticResponse(event.request));
});
