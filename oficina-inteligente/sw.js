const NAME='oficina-cuba-cifrada-v1';const CORE=['./','index.html','payload.bin','manifest.webmanifest','icon.svg','ai-worker.mjs'];let testOffline=false;
self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{if(e.data?.type==='OFFLINE_TEST')testOffline=e.data.enabled===true;if(['OFFLINE_TEST','OFFLINE_STATE'].includes(e.data?.type))e.ports[0]?.postMessage({testOffline,cache:NAME})});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;let u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(cached=>cached||(testOffline?new Response('Sin conexión',{status:503}):fetch(e.request).then(r=>{if(r.ok&&u.pathname.startsWith(new URL('./',self.location).pathname))caches.open(NAME).then(c=>c.put(e.request,r.clone()));return r}))));});
