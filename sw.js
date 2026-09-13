self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let data={title:'KLEOSFIT',body:'Hai una nuova notifica.'};try{if(event.data)data={...data,...event.data.json()}}catch(e){try{data.body=event.data.text()}catch(_e){}}event.waitUntil(self.registration.showNotification(data.title||'KLEOSFIT',{body:data.body||'',icon:'/icon-192.png',badge:'/icon-192.png',data:data.url||'/'}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow(event.notification.data||'/'));});
