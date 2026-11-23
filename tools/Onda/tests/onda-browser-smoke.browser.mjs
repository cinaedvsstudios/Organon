// Actual headless Chromium checks against a local, disposable Onda origin.
// This is NOT an Android hardware/lock-screen test, and never touches user music.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon', '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};
function handler(request, response) {
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); }
    catch { response.writeHead(400).end(); return; }
    let path;
    try { path = resolve(root, '.' + decodeURIComponent(url.pathname)); }
    catch { response.writeHead(400).end(); return; }
    if (path !== root && !path.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
    }
    (async () => {
        let finalPath = path;
        if ((await stat(finalPath).catch(() => null))?.isDirectory()) {
            finalPath = resolve(finalPath, 'index.html');
        }
        const bytes = await readFile(finalPath);
        response.writeHead(200, {
            'Content-Type': mime[extname(finalPath)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        response.end(bytes);
    })().catch(() => response.writeHead(404).end('Not found'));
}
function wavTone(seconds = 3) {
    const rate = 12000;
    const frames = rate * seconds;
    const wav = Buffer.alloc(44 + frames * 2);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++) {
        wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 6000), 44 + i * 2);
    }
    return wav;
}
async function cachedAudioCount(page) {
    return page.evaluate(async () => {
        const stores = await indexedDB.databases();
        const existing = stores.find(x => x.name === 'OndaMediaPlayerPersistentDB');
        if (!existing) return 0;
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(existing.name);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        try {
            if (!db.objectStoreNames.contains('audioFiles')) return 0;
            const tx = db.transaction('audioFiles', 'readonly');
            return await new Promise((resolve, reject) => {
                const req = tx.objectStore('audioFiles').count();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } finally {
            db.close();
        }
    });
}
async function expectLoaded(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => Boolean(
        document.documentElement.dataset.ondaVersion &&
        window.OndaQuickPlay?.getActiveAudio &&
        window.OndaDeviceQA?.run &&
        window.OndaQuickPlayBridge?.addToLibrary
    ), { timeout: 15000 });
    const version = await page.evaluate(() => document.documentElement.dataset.ondaVersion);
    assert.match(version, /^v\d+\.\d+(?:\.\d+)?$/, 'valid current version');
    assert.equal(await page.locator('#btn-play').textContent(), '🧿');
    assert.equal(await page.locator('#btn-prev').textContent(), '⏮');
    assert.equal(await page.locator('#btn-next').textContent(), '⏭');
    return version;
}
async function desktopSmoke(browser, baseUrl) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
        const version = await expectLoaded(page, baseUrl);
        console.log('desktop: app started as ' + version);
        await page.locator('#btn-toggle-advanced').click();
        await page.locator('.settings-tab-btn[data-settings-tab="storage"]').click();
        await page.locator('#onda-device-qa-panel summary').click();
        await page.locator('#btn-onda-device-qa-run').click();
        const report = await page.evaluate(() => window.OndaDeviceQA.snapshot());
        assert.equal(report.sourceVersion, version);
        assert.equal(report.capabilities.loadedVersion, version);
        assert.equal(report.capabilities.secureContext, true);
        assert.equal(report.capabilities.installedAppComponents.quickPlay, true);
        assert.ok(Object.values(report.manualChecks).every(x => x === 'not-tested'));
        // Capture diagnostics without changing Onda's actual download logic.
        await page.evaluate(() => {
            window.__ondaExportProbe = { blobs: [], linkClicks: [], errors: [] };
            const originalCreate = URL.createObjectURL.bind(URL);
            URL.createObjectURL = blob => {
                const uri = originalCreate(blob);
                window.__ondaExportProbe.blobs.push({ type: blob.type, size: blob.size });
                return uri;
            };
            const originalClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function (...args) {
                window.__ondaExportProbe.linkClicks.push({
                    download: this.download, hrefIsBlob: this.href.startsWith('blob:')
                });
                return originalClick.apply(this, args);
            };
            window.addEventListener('error', error => {
                window.__ondaExportProbe.errors.push(String(error.message || 'unknown'));
            });
        });
        const pendingDownload = page.waitForEvent('download', { timeout: 9000 });
        await page.locator('#btn-onda-device-qa-export').click();
        let download;
        try {
            download = await pendingDownload;
        } catch (error) {
            const probe = await page.evaluate(() => ({
                ...window.__ondaExportProbe,
                exportDisabled: document.getElementById('btn-onda-device-qa-export').disabled,
                uaActive: navigator.userActivation?.isActive ?? null,
                reportAvailable: Boolean(window.OndaDeviceQA?.snapshot?.())
            }));
            console.error('desktop QA export diagnostic:', JSON.stringify(probe));
            throw error;
        }
        const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
        assert.equal(exported.sourceVersion, version);
        assert.equal(exported.capabilities.loadedVersion, version);
        assert.ok(Object.values(exported.manualChecks).every(x => x === 'not-tested'));
        assert.doesNotMatch(JSON.stringify(exported), /fileName|userAgent|password|localPath|secret/i);
        console.log('desktop: QA panel + redacted browser download confirmed');
        // Close the settings overlay before auditioning a disposable file.
        await page.locator('#btn-close-settings').click();

        const before = await cachedAudioCount(page);
        assert.equal(before, 0, 'new temporary browser must begin with no cached audio');
        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-synthetic-check.wav',
            mimeType: 'audio/wav',
            buffer: wavTone()
        });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio()));
        assert.equal(await page.locator('#onda-quick-play-panel').isVisible(), true);
        await page.waitForFunction(() => {
            const audio = document.getElementById('onda-quick-play-audio');
            return Number.isFinite(audio.duration) && audio.duration >= 2;
        }, { timeout: 10000 });
        // Real decoder and currentTime motion, not a fake audio element.
        await page.waitForFunction(() => document.getElementById('onda-quick-play-audio').currentTime > 0.08, { timeout: 10000 });
        assert.equal(await cachedAudioCount(page), before, 'preview cannot populate persistent audio cache');
        console.log('desktop: synthetic WAV decoded and played; no cache write during preview');
        await page.locator('#btn-onda-quick-discard').click();
        assert.equal(await page.evaluate(() => window.OndaQuickPlay.getActiveAudio()), null);
        assert.equal(await page.locator('#onda-quick-play-panel').isVisible(), false);
        assert.equal(await cachedAudioCount(page), before, 'discard does not write cache');

        // Explicit Add is a separate user action; test with the same synthetic WAV.
        await page.locator('#onda-quick-play-input').setInputFiles({
            name: 'onda-synthetic-check.wav',
            mimeType: 'audio/wav',
            buffer: wavTone()
        });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio()));
        await page.locator('#btn-onda-quick-import').click();
        await page.waitForFunction(async () => {
            const databases = await indexedDB.databases();
            const found = databases.some(x => x.name === 'OndaMediaPlayerPersistentDB');
            if (!found) return false;
            return true;
        });
        // Cache writes run asynchronously after imported metadata enters the Library.
        await page.waitForFunction(async () => {
            const databases = await indexedDB.databases();
            if (!databases.some(x => x.name === 'OndaMediaPlayerPersistentDB')) return false;
            const req = indexedDB.open('OndaMediaPlayerPersistentDB');
            const db = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            try {
                if (!db.objectStoreNames.contains('audioFiles')) return false;
                return await new Promise((resolve, reject) => {
                    const request = db.transaction('audioFiles', 'readonly').objectStore('audioFiles').count();
                    request.onsuccess = () => resolve(request.result > 0);
                    request.onerror = () => reject(request.error);
                });
            } finally { db.close(); }
        }, { timeout: 15000 });
        const importedCount = await cachedAudioCount(page);
        assert.ok(importedCount >= 1, 'explicit Add creates an audio cache entry');
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => Boolean(window.OndaQuickPlay?.getActiveAudio));
        assert.equal(await cachedAudioCount(page), importedCount, 'browser reload preserves explicitly cached audio');
        console.log('desktop: explicit import + browser cache persistence after reload confirmed');
    } finally {
        await context.close();
    }
}
async function mobileSmoke(browser, baseUrl) {
    // Browser device emulation does not establish actual Android lock-screen results.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true, hasTouch: true, deviceScaleFactor: 2,
        serviceWorkers: 'block'
    });
    const page = await context.newPage();
    try {
        const version = await expectLoaded(page, baseUrl);
        console.log('mobile-emulated: app started as ' + version);
        await page.locator('#btn-database-engine').click();
        await page.waitForFunction(() => document.getElementById('library-manager-drawer')?.classList.contains('drawer-open'));
        assert.equal(await page.locator('#db-library-search').isVisible(), true);
        await page.locator('#db-library-search').fill('disposable-preview');
        assert.equal(await page.locator('#db-library-search').inputValue(), 'disposable-preview');
        assert.equal(await cachedAudioCount(page), 0);
        console.log('mobile-emulated: Library drawer and touch search operate');
    } finally {
        await context.close();
    }
}
const server = createServer(handler);
let browser;
try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    browser = await chromium.launch({
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
    });
    const baseUrl = 'http://127.0.0.1:' + port + '/';
    await desktopSmoke(browser, baseUrl);
    await mobileSmoke(browser, baseUrl);
    console.log('PASS: actual Chrome desktop + mobile-emulated Onda smoke tests');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
