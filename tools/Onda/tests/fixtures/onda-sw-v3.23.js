/* Onda v3.23 — offline APP SHELL only.
 * Never cache user audio, IndexedDB content, cloud responses, JSON libraries,
 * remote streams, or any other request not explicitly listed below.
 * First visit/update requires an internet connection. Subsequent startups may
 * load the shell offline using the same origin and browser storage profile.
 */
'use strict';

const SHELL_CACHE_PREFIX = 'onda-static-shell-';
const SHELL_CACHE = SHELL_CACHE_PREFIX + 'v3.23';
const SHELL_FILES = [
    './index.html',
    './manifest.webmanifest?v=1',
    './icons/onda-icon.svg?v=1',
    './icons/onda-icon-192.png?v=1',
    './css/tokens.css',
    './css/base.css',
    './css/layout.css?v=3.10',
    './css/player.css',
    './css/controls.css',
    './css/library.css?v=3.16',
    './css/playlists-now-playing.css?v=3.15',
    './css/modals-settings.css?v=3.20',
    './css/visualizer-tools.css',
    './css/streaming.css',
    './css/responsive.css?v=3.19',
    './css/cloud-sync.css',
    './onda-midi.js',
    './js/file-access.js?v=3.13',
    './js/storage-audit.js?v=3.14',
    './js/diagnostics.js?v=3.18',
    './js/app-core.js?v=3.23',
    './js/cloud-sync.js',
    './js/media-session.js?v=3.19',
    './js/quick-play.js?v=3.19',
    './js/device-qa.js?v=3.22'
];

const ROOT_URL = new URL('./', self.registration.scope);
const INDEX_URL = new URL('./index.html', self.registration.scope);
const SHELL_URLS = new Set(SHELL_FILES.map(file =>
    new URL(file, self.registration.scope).href
));

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // Atomic installation: if any essential file is missing, the browser
        // retains its previous worker rather than activating an incomplete shell.
        await cache.addAll(SHELL_FILES.map(file =>
            new Request(new URL(file, self.registration.scope).href, { cache: 'reload' })
        ));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        // Only previous Onda APP SHELL caches; never music/user/data caches.
        await Promise.all(names.filter(name =>
            name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE
        ).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    // Restrict all interception to the worker's own published directory.
    if (!url.href.startsWith(self.registration.scope)) return;

    // Network-first ONLY for the app entry page. Offline fallback is the
    // fully installed shell; do not cache arbitrary navigation destinations.
    const appNavigation = request.mode === 'navigate' &&
        (url.pathname === ROOT_URL.pathname || url.pathname === INDEX_URL.pathname);
    if (appNavigation) {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) return response;
                throw new Error('App entry unavailable');
            } catch (_) {
                const cache = await caches.open(SHELL_CACHE);
                const fallback = await cache.match(INDEX_URL.href);
                return fallback || Response.error();
            }
        })());
        return;
    }

    // All static shell files are cached at the EXACT versioned URL. Requests
    // to newer/unknown assets go to the network, never stale script fallbacks.
    if (!SHELL_URLS.has(url.href)) return;
    event.respondWith((async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        return cached || fetch(request);
    })());
});
