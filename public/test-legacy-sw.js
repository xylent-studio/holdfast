self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('holdfast-shell-v1').then(async (cache) => {
      const response = await fetch('/index.html', { cache: 'no-store' });
      await cache.put('/index.html', response);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'HOLDFAST_GET_METADATA') {
    event.ports[0]?.postMessage({
      buildId: 'legacy-test-build',
      cacheName: 'holdfast-shell-v1',
    });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    caches.match('/index.html').then((cached) => cached || fetch(event.request)),
  );
});
