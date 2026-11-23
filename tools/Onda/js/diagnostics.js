// Onda v3.18 — optional, in-memory, redacted performance sampling.
// Off by default. Never reads or exports filenames, IDs, paths, URLs or secrets.
(() => {
    'use strict';
    const NEXT_LOAD_KEY = 'ondaDiagnosticsNextLoadV1';
    const MAX_EVENTS = 200;
    const EVENTS = new Set([
        'core-init', 'restore-local', 'restore-indexeddb', 'restore-total',
        'library-render', 'cache-inventory', 'cache-write-batch',
        'import-prepare', 'track-resolve', 'audio-play', 'search-render', 'visualizer-frame'
    ]);
    const NUMERIC_FIELDS = new Set(['trackCount', 'visibleCount', 'savedCount', 'skippedCount', 'failedCount', 'cachedCount']);
    let enabled = false;
    let entries = [];
    let nextMarkerId = 0;
    let statusNode = null;
    const sessionStart = performance.now();

    // A one-use sessionStorage flag is set ONLY by the explicit Reload button.
    try {
        enabled = sessionStorage.getItem(NEXT_LOAD_KEY) === '1';
        sessionStorage.removeItem(NEXT_LOAD_KEY);
    } catch (_) { /* browser storage may be blocked */ }

    function sanitizeCounts(counts) {
        const safe = {};
        if (!counts || typeof counts !== 'object') return safe;
        for (const [key, value] of Object.entries(counts)) {
            if (!NUMERIC_FIELDS.has(key) || typeof value !== 'number' || !Number.isFinite(value)) continue;
            safe[key] = Math.max(0, Math.min(1e9, Math.round(value)));
        }
        return safe;
    }

    function record(name, durationMs, counts = {}) {
        if (!enabled || !EVENTS.has(name)) return false;
        if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return false;
        const entry = {
            event: name,
            afterLoadMs: Math.max(0, Math.round(performance.now() - sessionStart)),
            durationMs: Math.max(0, Math.round(durationMs * 100) / 100),
            ...sanitizeCounts(counts)
        };
        entries.push(entry);
        if (entries.length > MAX_EVENTS) entries.shift();
        updateStatus();
        return true;
    }

    function begin(name) {
        if (!enabled || !EVENTS.has(name)) return null;
        const started = performance.now();
        const marker = 'onda-perf-' + String(++nextMarkerId);
        try { performance.mark(marker + '-start'); } catch (_) {}
        let finished = false;
        return (counts = {}) => {
            if (finished) return;
            finished = true;
            const duration = performance.now() - started;
            try {
                performance.mark(marker + '-end');
                performance.measure('onda:' + name, marker + '-start', marker + '-end');
                performance.clearMarks(marker + '-start');
                performance.clearMarks(marker + '-end');
                // No indefinite PerformanceEntry growth on long-running sessions.
                performance.clearMeasures('onda:' + name);
            } catch (_) {}
            record(name, duration, counts);
        };
    }

    function snapshot() {
        // Whitelist the *entire* output schema; never stringify app state.
        return {
            app: 'Onda Media Player',
            format: 'onda-redacted-performance-v1',
            version: 'v3.18',
            capturedAtUtc: new Date().toISOString(),
            capture: enabled ? 'enabled' : 'stopped',
            viewport: {
                width: Math.max(0, Math.round(window.innerWidth || 0)),
                height: Math.max(0, Math.round(window.innerHeight || 0))
            },
            maximumSamples: MAX_EVENTS,
            samples: entries.map(sample => ({
                event: sample.event,
                afterLoadMs: sample.afterLoadMs,
                durationMs: sample.durationMs,
                ...sanitizeCounts(sample)
            }))
        };
    }

    function updateStatus() {
        statusNode = statusNode || document.getElementById('onda-diagnostics-status');
        const toggle = document.getElementById('btn-onda-diagnostics-toggle');
        if (statusNode) statusNode.textContent = (enabled ? 'Recording this session' : 'Not recording') + ' · ' + entries.length + ' samples (max 200). No file names, URLs, IDs or passwords collected.';
        if (toggle) {
            toggle.textContent = enabled ? 'Stop recording' : 'Start recording';
            toggle.setAttribute('aria-pressed', String(enabled));
        }
    }

    function exportJson() {
        const data = JSON.stringify(snapshot(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'onda-performance-redacted.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function attachControls() {
        const toggle = document.getElementById('btn-onda-diagnostics-toggle');
        const reload = document.getElementById('btn-onda-diagnostics-reload');
        const exportButton = document.getElementById('btn-onda-diagnostics-export');
        const clear = document.getElementById('btn-onda-diagnostics-clear');
        if (toggle) toggle.addEventListener('click', () => {
            enabled = !enabled;
            updateStatus();
        });
        if (reload) reload.addEventListener('click', () => {
            // Explicit reload is necessary to capture initial app startup costs.
            try {
                sessionStorage.setItem(NEXT_LOAD_KEY, '1');
                window.location.reload();
            } catch (_) {
                if (statusNode) statusNode.textContent = 'Reload unavailable in this browser; start recording for other actions instead.';
            }
        });
        if (exportButton) exportButton.addEventListener('click', exportJson);
        if (clear) clear.addEventListener('click', () => { entries = []; updateStatus(); });
        updateStatus();
    }

    window.OndaDiagnostics = Object.freeze({
        begin, record, snapshot, isEnabled: () => enabled
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachControls, { once: true });
    else attachControls();
})();
