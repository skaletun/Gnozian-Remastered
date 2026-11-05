const VERSION='gnozian-remastered-0.2.0';
const SCOPE=self.registration.scope;
const ASSETS=__PRECACHE_ASSETS__;
const urls=ASSETS.map(p=>new URL(p,SCOPE).href);
const FALLBACK=new URL('index.html',SCOPE).href;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(VERSION);
    // All static assets are cached before offline installation is considered complete.
    for(let i=0;i<urls.length;i+=16)await cache.addAll(urls.slice(i,i+16));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('gnozian-remastered-')&&key!==VERSION)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(resp=>resp.ok?resp:caches.match(FALLBACK)).catch(()=>caches.match(FALLBACK)).then(resp=>resp||Response.error()));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(resp=>{
    if(resp.ok)void caches.open(VERSION).then(cache=>cache.put(req,resp.clone()));
    return resp;
  })));
});
