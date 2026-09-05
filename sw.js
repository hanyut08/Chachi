const CACHE = 'chachi-v2';
const ASSETS = ['./index.html','./style.css','./app.js','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', (e)=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', (e)=>{
  e.respondWith(
    fetch(e.request).catch(()=> caches.match(e.request))
  );
});

self.addEventListener('notificationclick', (e)=>{
  const action = e.action; // 'done' | 'snooze' | ''
  const id = e.notification.data && e.notification.data.id;
  e.notification.close();

  e.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(async (clients)=>{
      if(action === 'snooze'){
        clients.forEach(c=> c.postMessage({type:'snooze', reminderId:id}));
      } else if(action === 'done'){
        clients.forEach(c=> c.postMessage({type:'done', reminderId:id}));
      }
      const existing = clients.find(c=>'focus' in c);
      if(existing){ existing.focus(); }
      else { self.clients.openWindow('./index.html'); }
    })
  );
});
