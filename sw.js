// PUNDI service worker — caches the app shell so it still opens without internet.
// Bump CACHE_NAME whenever index.html changes meaningfully so old caches get cleared.
var CACHE_NAME = 'pundi-cache-v1';
var APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  // Only manage same-origin GET requests (the app shell itself). Everything else —
  // CoinGecko price lookups, Firebase/Firestore calls, Google sign-in — needs a real
  // live network round-trip anyway, so let those pass straight through untouched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      // Serve the cached shell instantly if we have it (fast + works offline);
      // refresh the cache in the background whenever a network is available.
      return cached || network;
    })
  );
});
