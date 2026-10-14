const NAME='oficina-cuba-cifrada-v9-completa';
const CORE=['./','index.html','payload.bin?v=9','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','ai-worker.mjs','chatgpt-bridge.js?v=9','downloads.js?v=9','auth.js?v=9','gate.js?v=9','pdf-lib.min.js','pdf.min.mjs','pdf.worker.min.mjs','tesseract.min.js','ocr-worker.min.js','tesseract-core-lstm.wasm.js','ocr-data/spa.traineddata.gz','ocr-data/eng.traineddata.gz','manual.html'];
let testOffline=false;
self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('oficina-cuba-cifrada-')&&k!==NAME).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('message',e=>{if(e.data?.type==='OFFLINE_TEST')testOffline=e.data.enabled===true;if(['OFFLINE_TEST','OFFLINE_STATE'].includes(e.data?.type))e.ports[0]?.postMessage({testOffline,cache:NAME})});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(new URL('./',self.location).pathname))return;e.respondWith(caches.open(NAME).then(async cache=>{if(e.request.mode==='navigate'){if(!testOffline){try{const live=await fetch(e.request);if(live.ok){await cache.put('./',live.clone());return live}}catch{}}return await cache.match('./')||await cache.match('index.html')||new Response('Sin conexión',{status:503})}const cached=await cache.match(e.request);if(cached)return cached;if(testOffline)return new Response('Sin conexión',{status:503});const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response}))});


