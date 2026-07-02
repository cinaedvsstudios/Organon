/* Onda layout controls: persistent layout mode, fullscreen, and player shell state. */
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

    function bindOnce(button, eventName, handler, bindingName) {
        if (!button || button.dataset[bindingName] === '1') return;
        button.addEventListener(eventName, handler);
        button.dataset[bindingName] = '1';
    }

    function initLayoutControls() {
        const transport = document.getElementById('start-controls-pill');
        if (transport) transport.classList.add('onda-transport-pill');

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
