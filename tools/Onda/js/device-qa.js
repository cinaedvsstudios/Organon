/* Onda read-only device QA report, created only on explicit request.
 * No media access, playback, storage writes, network requests or diagnostics upload. */
(() => {
    'use strict';
    // The device checker may be cached across application releases. Its report
    // must describe the actual loaded app, never a version frozen in this module.
    // Strict validation also prevents arbitrary page data entering exported JSON.
    const APP_VERSION_PATTERN = /^v[0-9]{1,3}\\.[0-9]{1,3}(?:\\.[0-9]{1,3})?$/;
    function currentAppVersion() {
        const value = document.documentElement?.dataset?.ondaVersion;
        return typeof value === 'string' && APP_VERSION_PATTERN.test(value) ? value : 'unavailable';
    }
    const STATUSES = new Set(['not-tested', 'pass', 'fail', 'blocked']);
    const CHECKS = Object.freeze([
        ['saved-audio', 'Saved track plays after reload'],
        ['temporary-audio', 'Quick Play audibly plays a disposable file'],
        ['no-quick-import', 'Quick Play leaves Library, queue and cache unchanged'],
        ['main-playback', 'Main Play stops temporary preview'],
        ['media-session', 'Lock-screen/headphones Play/Pause/Seek work'],
        ['reconnect', 'Saved file reconnect and permission prompts work'],
        ['library-ux', 'Mobile Library search, touch and views work'],
        ['normal-import', 'Normal Add Files still imports and survives reload']
    ]);
    const panel = document.getElementById('onda-device-qa-panel');
    const runButton = document.getElementById('btn-onda-device-qa-run');
    const downloadButton = document.getElementById('btn-onda-device-qa-export');
    const resultsElement = document.getElementById('onda-device-qa-results');
    const manualRoot = document.getElementById('onda-device-qa-manual');
    if (!panel || !runButton || !downloadButton || !resultsElement || !manualRoot) return;

    let lastCapabilities = null;

    function codecHint(mime) {
        try {
            const testAudio = document.createElement('audio');
            const raw = testAudio.canPlayType?.(mime);
            return raw === 'probably' ? 'probably' : (raw === 'maybe' ? 'maybe' : 'no');
        } catch (_) {
            return 'unknown';
        }
    }

    function capabilities() {
        const mediaSession = navigator.mediaSession || null;
        const version = currentAppVersion();
        return {
            loadedVersion: version,
            secureContext: window.isSecureContext === true,
            standalone: Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
            viewport: {
                width: Math.max(0, Math.round(window.innerWidth || 0)),
                height: Math.max(0, Math.round(window.innerHeight || 0))
            },
            browserFeatures: {
                filePicker: typeof window.showOpenFilePicker === 'function',
                folderPicker: typeof window.showDirectoryPicker === 'function',
                mediaSession: Boolean(mediaSession),
                mediaMetadata: typeof window.MediaMetadata === 'function',
                mediaPosition: typeof mediaSession?.setPositionState === 'function',
                storageEstimate: typeof navigator.storage?.estimate === 'function'
            },
            installedAppComponents: {
                quickPlay: typeof window.OndaQuickPlay?.getActiveAudio === 'function',
                sourceDiagnostics: typeof window.OndaDiagnostics?.snapshot === 'function',
                library: Boolean(document.getElementById('library-manager-drawer')),
                player: Boolean(document.getElementById('btn-play'))
            },
            codecHints: {
                mp3: codecHint('audio/mpeg'),
                wav: codecHint('audio/wav'),
                ogg: codecHint('audio/ogg; codecs=vorbis'),
                aac: codecHint('audio/mp4; codecs=mp4a.40.2'),
                flac: codecHint('audio/flac')
            }
        };
    }

    function manualStatuses() {
        const values = {};
        for (const [key] of CHECKS) {
            const raw = document.getElementById('onda-qa-' + key)?.value;
            values[key] = STATUSES.has(raw) ? raw : 'not-tested';
        }
        return values;
    }

    function snapshot() {
        return {
            report: 'onda-device-qa-redacted-v1',
            sourceVersion: currentAppVersion(),
            generatedAtUtc: new Date().toISOString(),
            note: 'Capability presence and codec hints are not proof of working playback, permissions, or lock-screen behaviour.',
            capabilities: lastCapabilities,
            manualChecks: manualStatuses()
        };
    }

    function displayCapabilities(data) {
        resultsElement.textContent = '';
        const list = document.createElement('ul');
        list.className = 'onda-qa-capabilities';
        const append = (name, value) => {
            const item = document.createElement('li');
            item.textContent = name + ': ' + value;
            list.appendChild(item);
        };
        append('Loaded Onda version', data.loadedVersion);
        append('Secure browser context', data.secureContext ? 'yes' : 'no');
        append('Installed/standalone mode', data.standalone ? 'yes' : 'no (normal browser tab)');
        append('Viewport', data.viewport.width + ' × ' + data.viewport.height + ' px');
        const b = data.browserFeatures;
        append('Remember Files picker API', b.filePicker ? 'present; permission persistence untested' : 'unavailable; normal file input still supported');
        append('Remember Folder picker API', b.folderPicker ? 'present; permission persistence untested' : 'unavailable');
        append('Media Session', b.mediaSession ? 'present; screen-lock playback untested' : 'unavailable');
        append('Media Metadata / position APIs', (b.mediaMetadata ? 'metadata present' : 'metadata unavailable') + ' / ' + (b.mediaPosition ? 'position present' : 'position unavailable'));
        append('Browser storage estimate API', b.storageEstimate ? 'present' : 'unavailable');
        const a = data.installedAppComponents;
        append('Quick Play module', a.quickPlay ? 'loaded' : 'not loaded');
        append('Performance diagnostics module', a.sourceDiagnostics ? 'loaded' : 'not loaded');
        append('Library / player controls', (a.library && a.player) ? 'present' : 'one or more missing');
        append('Audio codec hints (not tested playback)',
            Object.entries(data.codecHints).map(([name, value]) => name.toUpperCase() + ': ' + value).join(' · '));
        resultsElement.appendChild(list);
    }

    function buildManualChecklist() {
        if (manualRoot.dataset.ondaChecklistBuilt === '1') return;
        manualRoot.dataset.ondaChecklistBuilt = '1';
        for (const [key, label] of CHECKS) {
            const row = document.createElement('label');
            row.className = 'onda-device-qa-row';
            const caption = document.createElement('span');
            caption.textContent = label;
            const select = document.createElement('select');
            select.id = 'onda-qa-' + key;
            for (const [value, text] of [
                ['not-tested', 'Not tested'], ['pass', 'Pass'], ['fail', 'Fail'], ['blocked', 'Blocked']
            ]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                select.appendChild(option);
            }
            row.append(caption, select);
            manualRoot.appendChild(row);
        }
    }

    function runChecks() {
        lastCapabilities = capabilities();
        displayCapabilities(lastCapabilities);
        downloadButton.disabled = false;
        return lastCapabilities;
    }

    function exportReport() {
        // The schema only contains predetermined keys, booleans, numeric viewport,
        // coarse codec hints, UTC time and fixed manual verdict values.
        const payload = JSON.stringify(snapshot(), null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'onda-device-qa-redacted.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    buildManualChecklist();
    runButton.addEventListener('click', runChecks);
    downloadButton.addEventListener('click', exportReport);
    window.OndaDeviceQA = Object.freeze({
        run: runChecks,
        snapshot
    });
})();
