const CACHE='kleosfit-shell-v18-6';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/icon.png','/kleosfit-login-bg.jpeg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET') return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin) return;
 event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/index.html'))));
});
