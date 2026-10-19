const CACHE='mindforge-v28-traffic-20261019';
const CORE=['./','./index.html','./manifest.webmanifest','./assets/icon.svg','./visuals.css','./visuals.js','./arcade/','./arcade/index.html','./arcade/3d/','./arcade/3d/index.html','./arcade/sudoku/','./arcade/sudoku/index.html','./arcade/traffic/','./arcade/traffic/index.html','./arcade/sound-kit.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return res;})))});
