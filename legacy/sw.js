const CACHE_NAME = 'basketkids-v10';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './public/index.html',
    './css/styles.css',
    './js/supabase-config.js',
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
    // Config: Network First for HTML, JS, CSS, JSON (App Shell & Logic)
    // Cache First for Images/Fonts (Optional, but let's keep it simple: Network First for critical)

    const requestURL = new URL(event.request.url);

    // Filter for our assets or navigation
    if (event.request.mode === 'navigate' ||
        requestURL.pathname.endsWith('.js') ||
        requestURL.pathname.endsWith('.css') ||
        requestURL.pathname.endsWith('.html')) {

        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Update cache with new version if successful
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(event.request);
                })
        );
    } else {
        // Default Cache First for others (images, etc) or unknown
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || fetch(event.request);
                })
        );
    }
});
