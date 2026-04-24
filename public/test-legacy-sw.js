const CACHE_NAME = 'holdfast-shell-v1';
const SHELL_CACHE_KEYS = ['/', '/index.html'];

async function normalizeShellResponse(response) {
  const html = await response.text();
  const headers = new Headers(response.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'text/html; charset=utf-8');
  }

  return new Response(html, {
    headers,
    status: 200,
    statusText: 'OK',
  });
}

async function cacheShell(cache) {
  const response = await fetch('/', { cache: 'no-store' });
  const normalized = await normalizeShellResponse(response);
  await Promise.all(
    SHELL_CACHE_KEYS.map((key) => cache.put(key, normalized.clone())),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cacheShell(cache)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'HOLDFAST_GET_METADATA') {
    event.ports[0]?.postMessage({
      buildId: 'legacy-test-build',
      cacheName: CACHE_NAME,
    });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached =
        (await cache.match('/')) ?? (await cache.match('/index.html'));
      return cached || fetch(event.request);
    }),
  );
});
