const CACHE_VERSION = 'v4';
const APP_CACHE = `shiyu-app-${CACHE_VERSION}`;
const STATIC_CACHE = `shiyu-static-${CACHE_VERSION}`;
const FONT_CACHE = `shiyu-fonts-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

const CACHE_NAMES = [APP_CACHE, STATIC_CACHE, FONT_CACHE];
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.gif',
  '.ico',
  '.json',
  '.woff',
  '.woff2',
];

function isCacheableResponse(response) {
  return response && (response.ok || response.type === 'opaque');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate'
    || (request.destination === 'document' && request.headers.get('accept')?.includes('text/html'));
}

function isGoogleFontRequest(url) {
  return url.origin === 'https://fonts.googleapis.com'
    || url.origin === 'https://fonts.gstatic.com';
}

function isStaticRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/assets/')) return true;
  if (['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return true;
  return STATIC_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));
}

async function putCache(cacheName, request, response) {
  if (!isCacheableResponse(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function networkFirstNavigation(request) {
  const appCache = await caches.open(APP_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await appCache.put(request, response.clone());
      await appCache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await appCache.match(request))
      || (await appCache.match('/index.html'))
      || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => !CACHE_NAMES.includes(key))
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isGoogleFontRequest(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (isStaticRequest(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        putCache(STATIC_CACHE, request, response);
        return response;
      })
      .catch(() => caches.match(request))
  );
});
