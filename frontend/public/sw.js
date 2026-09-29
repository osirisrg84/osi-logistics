const CACHE = 'osi-v3';
const PRECACHE = ['/', '/index.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Required for Chrome to recognize PWA as installable.
//
// Network-first, not cache-first: esta era la causa real de que el celular
// del conductor siguiera corriendo JS viejo despues de cada deploy, sin
// importar cuantas veces cerrara y volviera a abrir la app -- con
// cache-first, la primera vez que el navegador guarda index.html + el
// bundle, se queda sirviendo ESA version para siempre (el archivo sw.js no
// habia cambiado de bytes, asi que el navegador nunca detectaba que habia
// una version nueva que instalar). Ahora siempre intenta la red primero, y
// solo cae al cache guardado si de plano no hay conexion.
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin or cached assets
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Let API calls go straight to network
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'OSI Logistics', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || ('driver-online-' + (data.driverId || Date.now())),
      renotify: true,
      requireInteraction: !!data.requireInteraction,
      data: { url: data.url || '/tracking' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const url = event.notification.data?.url || '/';
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
