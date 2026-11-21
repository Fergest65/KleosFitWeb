// KleosFit Web Push Service Worker V18.8.39
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let data={title:'KLEOSFIT',body:'Hai una nuova notifica.'};try{if(event.data)data={...data,...event.data.json()}}catch(e){try{data.body=event.data.text()}catch(_e){}}event.waitUntil(self.registration.showNotification(data.title||'KLEOSFIT',{body:data.body||'',icon:'/icon-192.png',badge:'/icon-192.png',data:data.url||'/'}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow(event.notification.data||'/'));});

const sheetsCache='kleos-txt-pages-v4';
const sheetPaths=['schede-txt.html','monitor-circuito.html','schede-txt-cloud.js'];
const sheetUrls=sheetPaths.map(path=>new URL(path,self.registration.scope).href);

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(sheetsCache).then(cache=>
  cache.addAll(sheetUrls.map(url=>new Request(url,{cache:'reload'})))
 ));
});

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 url.search='';
 if(!sheetUrls.includes(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(sheetsCache);
  try{
   const response=await fetch(event.request,{cache:'no-cache'});
   if(response.ok)await cache.put(url.href,response.clone()).catch(()=>{});
   return response;
  }catch(error){
   const response=await cache.match(url.href);
   if(response)return response;
   throw error;
  }
 })());
});
