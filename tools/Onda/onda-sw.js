/* Onda v3.24 — offline APP SHELL only.
 * Never cache user audio, IndexedDB content, cloud responses, JSON libraries,
 * remote streams, or any other request not explicitly listed below.
 * First visit/update requires an internet connection. Subsequent startups may
 * load the shell offline using the same origin and browser storage profile.
 */
'use strict';

const SHELL_CACHE_PREFIX = 'onda-static-shell-';
const SHELL_CACHE = SHELL_CACHE_PREFIX + 'v3.24';
const SHELL_FILES = [
    './index.html',
    './css/tokens.css?v=3.24',
    './css/base.css?v=3.24',
    './css/layout.css?v=3.24',
    './css/player.css?v=3.24',
    './css/controls.css?v=3.24',
    './css/library.css?v=3.24',
    './css/playlists-now-playing.css?v=3.24',
    './css/modals-settings.css?v=3.24',
    './css/visualizer-tools.css?v=3.24',
    './css/streaming.css?v=3.24',
    './css/responsive.css?v=3.24',
    './css/cloud-sync.css?v=3.24',
    './icons/onda-icon-192.png?v=3.24',
    './icons/onda-icon.svg?v=3.24',
    './manifest.webmanifest?v=3.24',
    './onda-midi.js?v=3.24',
    './js/file-access.js?v=3.24',
    './js/storage-audit.js?v=3.24',
    './js/diagnostics.js?v=3.24',
    './js/app-core.js?v=3.24',
    './js/cloud-sync.js?v=3.24',
    './js/media-session.js?v=3.24',
    './js/quick-play.js?v=3.24',
    './js/device-qa.js?v=3.24'
];

const ROOT_URL = new URL('./', self.registration.scope);
const INDEX_URL = new URL('./index.html', self.registration.scope);
const SHELL_URLS = new Set(SHELL_FILES.map(file =>
    new URL(file, self.registration.scope).href
));

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // All required assets must install before activation. On failure,
        // remove ONLY this incomplete new shell, keeping the active old shell
        // and every unrelated/user cache untouched.
        try {
            await cache.addAll(SHELL_FILES.map(file =>
                new Request(new URL(file, self.registration.scope).href, { cache: 'reload' })
            ));
        } catch (error) {
            await caches.delete(SHELL_CACHE);
            throw error;
        }
        // First install: take control immediately. Upgrades: leave the new
        // worker waiting while older Onda tabs still exist. Do NOT take over
        // an existing player session or delete its live shell prematurely.
        if (!self.registration.active) await self.skipWaiting();
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
