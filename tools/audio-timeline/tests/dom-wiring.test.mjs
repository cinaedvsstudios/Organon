import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../advanced.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/advanced-main-v0.24.js', import.meta.url), 'utf8');

test('Advanced controller references only elements present in its own HTML', () => {
    const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x => x[1]);
    assert.equal(new Set(ids).size, ids.length, 'HTML must not duplicate element IDs');
    const referenced = [...main.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(x => x[1]);
    // basin-frame is explicitly an optional ID in Organon's parent document.
    const required = referenced.filter(id => id !== 'basin-frame');
    const missing = required.filter(id => !ids.includes(id));
    assert.deepEqual(missing, [], 'Missing Advanced DOM controls: ' + missing.join(', '));
});

test('independent audio fading controls are range sliders with associated values', () => {
    for (const suffix of ['in', 'out']) {
        const slider = 'audio-fade-' + suffix;
        assert.match(html, new RegExp('<input[^>]+type="range"[^>]+id="' + slider + '"'));
        assert.ok(html.includes('id="' + slider + '-value"'), slider + ' missing value label');
        assert.ok(main.includes('document.getElementById(\'' + slider + '\')'));
    }
});

test('Basic/Advanced navigation controls and fixed-frame export fallback remain accessible', () => {
    assert.ok(html.includes('id="btn-basic-mode"'));
    assert.ok(html.includes('id="btn-export-video"'), 'Real-time export button missing');
    assert.ok(html.includes('id="btn-export-offline"'), 'Fixed-frame beta button missing');
    assert.ok(main.includes("index.html?mode=basic"), 'Advanced->Basic route missing');
});
