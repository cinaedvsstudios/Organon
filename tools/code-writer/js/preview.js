(function () {
    'use strict';

    let previewDebounce = null;
    let visualDebounce = null;

    function getPreviewFrame() {
        return document.getElementById('preview-frame');
    }

    function getActiveTab() {
        return window.CodeWriterStore && window.CodeWriterStore.getActiveTab
            ? window.CodeWriterStore.getActiveTab()
            : null;
    }

    function setPreviewStatus(text) {
        const label = document.getElementById('preview-status-label');
        if (label) label.textContent = text;
    }

    function normalizePreviewHtml(html) {
        if (!html || !html.trim()) {
            return '<!DOCTYPE html><html><head><title>Empty Preview</title></head><body></body></html>';
        }
        return html;
    }

    function isPreviewHidden(tab) {
        return Boolean(tab && tab.previewHidden);
    }

    function isLargeFilePaused(tab) {
        return Boolean(tab && window.CodeWriterState && window.CodeWriterState.largeFileMode);
    }

    function renderPreviewNow(options = {}) {
        const tab = getActiveTab();
        const frame = getPreviewFrame();
        if (!tab || !frame) return;

        if (isPreviewHidden(tab)) {
            setPreviewStatus('preview hidden');
            return;
        }

        if (isLargeFilePaused(tab) && !options.force) {
            setPreviewStatus('large file mode · preview paused');
            return;
        }

        const html = normalizePreviewHtml(tab.content);
        setPreviewStatus(isLargeFilePaused(tab) ? 'rendering large preview…' : 'rendering preview…');

        window.requestAnimationFrame(() => {
            frame.srcdoc = html;
            setPreviewStatus(window.CodeWriterState.visualEditEnabled ? 'visual editing on' : 'live preview');
            frame.addEventListener('load', () => {
                applyVisualEditState();
                setPreviewStatus(window.CodeWriterState.visualEditEnabled ? 'visual editing on' : 'live preview');
            }, { once: true });
        });
    }

    function schedulePreviewRender() {
        const tab = getActiveTab();
        clearTimeout(previewDebounce);

        if (!tab) return;
        if (isPreviewHidden(tab)) {
            setPreviewStatus('preview hidden');
            return;
        }
        if (isLargeFilePaused(tab)) {
            setPreviewStatus('large file mode · preview paused');
            return;
        }

        previewDebounce = setTimeout(() => renderPreviewNow(), 750);
    }

    function applyVisualEditState() {
        const frame = getPreviewFrame();
        const state = window.CodeWriterState;
        if (!frame || !frame.contentDocument || !state) return;

        try {
            const doc = frame.contentDocument;
            if (doc.body) {
                doc.body.contentEditable = state.visualEditEnabled ? 'true' : 'false';
                doc.body.style.outline = state.visualEditEnabled ? '2px dashed rgba(75,132,191,0.55)' : '';
                doc.body.style.outlineOffset = state.visualEditEnabled ? '-6px' : '';
            }
            doc.removeEventListener('input', handleVisualInput);
            if (state.visualEditEnabled) {
                doc.addEventListener('input', handleVisualInput);
            }
        } catch (error) {
            console.warn('Preview visual edit state could not be applied:', error);
        }
    }

    function handleVisualInput() {
        const state = window.CodeWriterState;
        if (!state || state.suppressPreviewSync) return;
        clearTimeout(visualDebounce);
        visualDebounce = setTimeout(() => {
            const frame = getPreviewFrame();
            if (!frame || !frame.contentDocument) return;
            try {
                const doc = frame.contentDocument;
                const nextHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
                state.suppressRawSync = true;
                window.CodeWriterStore.updateActiveContent(nextHtml);
                window.CodeWriterEditor.loadActiveTabIntoEditor({ preserveCursor: false, skipPreview: true });
                state.suppressRawSync = false;
                window.CodeWriterUI.updateEverything({ skipPreview: true });
                window.CodeWriterUI.toast('Preview text edit synced back to Raw View.');
            } catch (error) {
                console.warn('Visual edit sync failed:', error);
            }
        }, 500);
    }

    function setVisualEdit(enabled) {
        window.CodeWriterState.visualEditEnabled = Boolean(enabled);
        const button = document.getElementById('visual-edit-btn');
        if (button) button.textContent = enabled ? 'Visual edit on' : 'Visual edit off';
        setPreviewStatus(enabled ? 'visual editing on' : 'live preview');
        applyVisualEditState();
    }

    window.CodeWriterPreview = {
        renderPreviewNow,
        schedulePreviewRender,
        applyVisualEditState,
        setVisualEdit,
        setPreviewStatus
    };
})();