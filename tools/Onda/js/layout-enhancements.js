/* Onda layout and control bindings that run after the main player script. */
(function () {
    'use strict';

    const DESKTOP_MODE_KEY = 'ondaForceDesktopModeV1';

    function safeToast(message) {
        if (typeof window.showToast === 'function') window.showToast(message);
    }

    function applySavedDesktopMode() {
        const enabled = localStorage.getItem(DESKTOP_MODE_KEY) === '1';
        document.body.classList.toggle('onda-force-desktop-mode', enabled);

        const button = document.getElementById('btn-toggle-layout-mode');
        if (button) {
            button.classList.toggle('active', enabled);
            button.textContent = enabled ? '💻' : '📱';
            button.title = enabled
                ? 'Desktop layout forced. Tap for mobile layout.'
                : 'Mobile layout. Tap for desktop layout.';
        }
    }

    function toggleDesktopMode() {
        const next = !document.body.classList.contains('onda-force-desktop-mode');
        localStorage.setItem(DESKTOP_MODE_KEY, next ? '1' : '0');
        applySavedDesktopMode();
        safeToast(next ? 'Desktop layout mode on.' : 'Mobile layout mode on.');
    }

    async function toggleFullscreenMode() {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            safeToast('Fullscreen was blocked by this browser.');
        }
        updateFullscreenButton();
    }

    function updateFullscreenButton() {
        const enabled = !!document.fullscreenElement;
        document.body.classList.toggle('onda-app-fullscreen', enabled);

        const button = document.getElementById('btn-toggle-fullscreen');
        if (button) {
            button.classList.toggle('active', enabled);
            button.textContent = enabled ? '↙' : '⛶';
            button.title = enabled ? 'Exit fullscreen' : 'Enter fullscreen';
        }
    }

    function bindOnce(button, eventName, handler, bindingName, options) {
        if (!button || button.dataset[bindingName] === '1') return;
        button.addEventListener(eventName, handler, options);
        button.dataset[bindingName] = '1';
    }

    function toggleLibrarySelectModeFromControl(event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        try {
            const next = !isLibrarySelectMode;
            isLibrarySelectMode = next;
            if (!next) selectedLibraryIds.clear();
            setLibraryActionPanel('select');
            updateBulkActionUI();
            renderLibraryManager();

            const button = event.currentTarget;
            button.classList.toggle('active', next);
            button.setAttribute('aria-pressed', String(next));
            safeToast(next ? 'Library selection mode on.' : 'Library selection mode off.');
        } catch (error) {
            console.error('Could not change Library selection mode:', error);
            safeToast('Library selection mode could not be changed.');
        }
    }

    function initLayoutControls() {
        const transport = document.getElementById('start-controls-pill');
        if (transport) transport.classList.add('onda-transport-pill');

        // The speed feature remains available through the Settings speed slider only.
        document.getElementById('btn-speed-cycle')?.remove();

        bindOnce(
            document.getElementById('btn-toggle-layout-mode'),
            'click',
            toggleDesktopMode,
            'ondaLayoutBound'
        );
        bindOnce(
            document.getElementById('btn-toggle-fullscreen'),
            'click',
            toggleFullscreenMode,
            'ondaFullscreenBound'
        );
        bindOnce(
            document.getElementById('btn-db-select-mode'),
            'click',
            toggleLibrarySelectModeFromControl,
            'ondaSelectModeBound',
            true
        );

        applySavedDesktopMode();
        updateFullscreenButton();
    }

    document.addEventListener('fullscreenchange', updateFullscreenButton);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLayoutControls);
    } else {
        initLayoutControls();
    }

    window.OndaLayoutControls = {
        applySavedDesktopMode,
        toggleDesktopMode,
        toggleFullscreenMode
    };
})();
