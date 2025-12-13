const CACHE_NAME = 'basketkids-v8';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './public/index.html',
    './css/styles.css',
    './js/firebase-config.js',
    './js/load-header.js',
    './img/favicon.ico',
    './img/logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Force activation
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all clients immediately
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found, else fetch from network
                return response || fetch(event.request);
            })
    );
});
