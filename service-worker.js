const CACHE_NAME = 'lunch-tray-no-tailwind-cdn-v2-dessert-position';

const REQUIRED_APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const OPTIONAL_APP_SHELL = [
  './env.js'
];

async function cacheOptionalFiles(cache) {
  await Promise.all(
    OPTIONAL_APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response && response.ok) {
          await cache.put(url, response.clone());
        }
      } catch (error) {
        // env.js는 GitHub Actions 배포 시 생성됩니다.
        // 로컬 테스트 등에서 없더라도 서비스 워커 설치가 실패하지 않게 둡니다.
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(REQUIRED_APP_SHELL);
        await cacheOptionalFiles(cache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  // Firebase/Firestore, NEIS, 외부 이미지 같은 다른 출처 요청은 서비스 워커가 건드리지 않습니다.
  if (!isSameOrigin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok && isSameOrigin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        if (response && response.ok && isSameOrigin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
