import { spawnSync } from 'node:child_process';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

function gitValue(args: string[]): string | null {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function resolveBuildId(): string {
  return (
    process.env.HOLDFAST_BUILD_ID?.trim() ||
    gitValue(['rev-parse', '--short=12', 'HEAD']) ||
    'dev-build'
  );
}

function resolveSupabaseHost(): string {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    return '';
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return '';
  }
}

function buildServiceWorkerSource(
  buildId: string,
  precachePaths: string[],
): string {
  return `const BUILD_ID = ${JSON.stringify(buildId)};
const CACHE_NAME = \`holdfast-shell-\${BUILD_ID}\`;
const SHELL_CACHE_KEYS = ['/', '/index.html'];
const PRECACHE = ${JSON.stringify(precachePaths.filter((path) => path !== '/index.html' && path !== '/'))};
const PRECACHE_SET = new Set(PRECACHE);

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

async function cacheShell(cache, response) {
  const normalized = await normalizeShellResponse(response);
  await Promise.all(
    SHELL_CACHE_KEYS.map((key) => cache.put(key, normalized.clone())),
  );
}

async function matchCachedShell(cache) {
  for (const key of SHELL_CACHE_KEYS) {
    const cached = await cache.match(key);
    if (cached) {
      return cached;
    }
  }

  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const shellResponse = await fetch('/', { cache: 'no-store' });
      await Promise.all([
        cacheShell(cache, shellResponse),
        cache.addAll(PRECACHE),
      ]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('holdfast-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'HOLDFAST_GET_METADATA') {
    event.ports[0]?.postMessage({
      buildId: BUILD_ID,
      cacheName: CACHE_NAME,
    });
    return;
  }

  if (event.data?.type === 'HOLDFAST_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request)
        .then(async (response) => {
          const contentType = response.headers.get('content-type') ?? '';
          if (response.ok && contentType.includes('text/html')) {
            event.waitUntil(cacheShell(cache, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cached = await matchCachedShell(cache);
          return cached || Response.error();
        }),
      ),
    );
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await matchCachedShell(cache);
        if (cached) {
          return cached;
        }

        const response = await fetch('/', { cache: 'no-store' });
        await cacheShell(cache, response.clone());
        return response;
      }),
    );
    return;
  }

  if (!PRECACHE_SET.has(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(url.pathname).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, clone)),
          );
        }
        return response;
      });
    }),
  );
});
`;
}

function holdfastServiceWorkerPlugin(buildId: string): Plugin {
  return {
    apply: 'build',
    generateBundle(_options, bundle) {
      const precachePaths = new Set<string>([
        '/index.html',
        '/manifest.webmanifest',
        '/holdfast-mark.svg',
      ]);

      for (const output of Object.values(bundle)) {
        if (output.fileName === 'sw.js' || output.fileName.endsWith('.map')) {
          continue;
        }

        precachePaths.add(`/${output.fileName}`);
      }

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: buildServiceWorkerSource(
          buildId,
          Array.from(precachePaths).sort(),
        ),
      });
    },
    name: 'holdfast-service-worker',
  };
}

const buildId = resolveBuildId();
const supabaseHost = resolveSupabaseHost();

export default defineConfig({
  define: {
    __HOLDFAST_BUILD_ID__: JSON.stringify(buildId),
    __HOLDFAST_SUPABASE_HOST__: JSON.stringify(supabaseHost),
  },
  plugins: [react(), holdfastServiceWorkerPlugin(buildId)],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('@supabase')) {
            return 'supabase';
          }

          if (id.includes('react-router-dom')) {
            return 'router';
          }

          if (id.includes('dexie')) {
            return 'dexie';
          }

          if (id.includes('react')) {
            return 'react';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
