/* Onda v3.35 — offline APP SHELL only.
 * Never cache user audio, IndexedDB content, cloud responses, JSON libraries,
 * remote streams, or any other request not explicitly listed below.
 * First visit/update requires an internet connection. Subsequent startups may
 * load the shell offline using the same origin and browser storage profile.
 */
'use strict';

const SHELL_CACHE_PREFIX = 'onda-static-shell-';
const SHELL_CACHE = SHELL_CACHE_PREFIX + 'v3.35';
// Kept outside SHELL_CACHE_PREFIX: the shipped v3.23 worker deletes old
// active-shell caches during activation and must never delete a pending upgrade.
const STAGED_SHELL_CACHE = 'onda-staged-shell-v3.35';
const SHELL_FILES = [
    './index.html',
    './css/tokens.css?v=3.35',
    './css/base.css?v=3.35',
    './css/layout.css?v=3.35',
    './css/player.css?v=3.35',
    './css/controls.css?v=3.35',
    './css/library.css?v=3.35',
    './css/playlists-now-playing.css?v=3.35',
    './css/modals-settings.css?v=3.35',
    './css/visualizer-tools.css?v=3.35',
    './css/streaming.css?v=3.35',
    './css/responsive.css?v=3.35',
    './css/cloud-sync.css?v=3.35',
    './icons/onda-icon-192.png?v=3.35',
    './icons/onda-icon.svg?v=3.35',
    './manifest.webmanifest?v=3.35',
    './onda-midi.js?v=3.35',
    './js/file-access.js?v=3.35',
    './js/storage-audit.js?v=3.35',
    './js/diagnostics.js?v=3.35',
    './js/app-core.js?v=3.35',
    './js/cloud-sync.js?v=3.35',
    './js/media-session.js?v=3.35',
    './js/quick-play.js?v=3.35',
    './js/device-qa.js?v=3.35'
];

const ROOT_URL = new URL('./', self.registration.scope);
const INDEX_URL = new URL('./index.html', self.registration.scope);
const SHELL_URLS = new Set(SHELL_FILES.map(file =>
    new URL(file, self.registration.scope).href
));

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        // Stage first. This name is deliberately INVISIBLE to the older
        // v3.23 worker's active-shell cleanup, even if that worker finishes
        // its own activation while an update is being downloaded.
        const stage = await caches.open(STAGED_SHELL_CACHE);
        await stage.addAll(SHELL_FILES.map(file =>
            new Request(new URL(file, self.registration.scope).href, { cache: 'reload' })
        ));
        // First install: take control immediately. Upgrades: leave the new
        // worker waiting while older Onda tabs still exist. Do NOT take over
        // an existing player session or delete its live shell prematurely.
        if (!self.registration.active) await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        // Promote a fully installed staging cache only AFTER old playback
        // tabs are closed. A missing staged file must never trigger deletion
        // of the previously usable offline shell or any user data.
        const stage = await caches.open(STAGED_SHELL_CACHE);
        const urls = SHELL_FILES.map(file => new URL(file, self.registration.scope).href);
        const staged = [];
        for (const url of urls) {
            const response = await stage.match(url);
            if (!response || !response.ok) {
                throw new Error('Onda offline upgrade missing staged shell asset: ' + url);
            }
            staged.push([url, response]);
        }
        const shell = await caches.open(SHELL_CACHE);
        for (const [url, response] of staged) {
            await shell.put(url, response);
        }
        // Only after the new complete shell is in place, delete previous
        // Onda active-shell generations and this release's staging cache.
        const names = await caches.keys();
        await Promise.all(names.filter(name =>
            name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE
        ).map(name => caches.delete(name)));
        await caches.delete(STAGED_SHELL_CACHE);
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
                const response = await fetch(request, { cache: 'no-store' });
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
