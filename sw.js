// Caches the game so it can be played with no network connection.
var CACHE = 'dino-runner-v3';
var FILES = ['./', 'index.html', 'style.css?v=3', 'game.js?v=3', 'manifest.json', 'icon.svg'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Network first so updates show up, falling back to the cache when offline.
// cache: 'no-cache' makes the browser revalidate with the server instead of
// reusing its HTTP cache, so a new index.html is never paired with an old
// game.js right after a deploy.
function fresh(request) {
  // A navigation request can't be copied with options, so rebuild it from the URL.
  if (request.mode === 'navigate') {
    return new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  }
  return new Request(request, { cache: 'no-cache' });
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(fresh(event.request)).then(function (response) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
      return response;
    }).catch(function () {
      return caches.match(event.request, { ignoreSearch: true });
    })
  );
});
