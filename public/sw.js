/* Stock Manager AI — Service Worker offline-first v4 */
const CACHE_NAME = 'maquis-shell-v4';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/login',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API distantes : réseau uniquement (pas de cache trompeur)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) return;

  // Navigation : offline → shell index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => {
            c.put('/index.html', clone);
            c.put('/', clone);
          });
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((r) => r || caches.match('/') || caches.match('/login'))
        )
    );
    return;
  }

  // Assets même origine : cache d'abord puis réseau
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
  }
});
