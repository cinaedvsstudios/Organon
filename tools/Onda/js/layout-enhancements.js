/* Onda layout controls and lightweight Settings tab routing. */
(function () {
    'use strict';

    const DESKTOP_MODE_KEY = 'ondaForceDesktopModeV1';
    const MOBILE_BREAKPOINT = 768;

    function safeToast(message) {
        if (typeof window.showToast === 'function') window.showToast(message);
    }

    function isNaturallyMobile() {
        return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
    }

    function applySavedLayoutMode() {
        const desktopForced = localStorage.getItem(DESKTOP_MODE_KEY) === '1';
        const mobileActive = !desktopForced && isNaturallyMobile();

        document.body.classList.toggle('onda-force-desktop-mode', desktopForced);
        document.body.classList.toggle('onda-force-mobile-mode', mobileActive);

        const button = document.getElementById('btn-toggle-layout-mode');
        if (button) {
            button.classList.toggle('active', desktopForced);
            button.textContent = desktopForced ? '💻' : '📱';
            button.title = desktopForced
                ? 'Desktop layout forced. Tap for normal responsive layout.'
                : 'Responsive layout active. Tap to force desktop layout.';
        }
    }

    function toggleDesktopMode() {
        const next = !document.body.classList.contains('onda-force-desktop-mode');
        localStorage.setItem(DESKTOP_MODE_KEY, next ? '1' : '0');
        applySavedLayoutMode();
        safeToast(next ? 'Desktop layout mode on.' : 'Responsive layout restored.');
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

    function activateSettingsTab(tabName) {
        const wanted = String(tabName || 'audio');
        const tabs = Array.from(document.querySelectorAll('.settings-tab-btn[data-settings-tab]'));
        const cards = Array.from(document.querySelectorAll('.settings-card[data-settings-card]'));
        const knownTab = tabs.some((tab) => tab.dataset.settingsTab === wanted) ? wanted : 'audio';

        tabs.forEach((tab) => {
            const active = tab.dataset.settingsTab === knownTab;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));
        });

        cards.forEach((card) => {
            const active = card.dataset.settingsCard === knownTab;
            card.classList.toggle('active', active);
            card.hidden = !active;
        });
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

        document.querySelectorAll('.settings-tab-btn[data-settings-tab]').forEach((tab) => {
            bindOnce(
                tab,
                'click',
                () => activateSettingsTab(tab.dataset.settingsTab),
                'ondaSettingsTabBound'
            );
        });

        applySavedLayoutMode();
        activateSettingsTab(document.querySelector('.settings-tab-btn.active')?.dataset.settingsTab || 'audio');
        updateFullscreenButton();
    }

    document.addEventListener('fullscreenchange', updateFullscreenButton);
    window.addEventListener('resize', applySavedLayoutMode);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLayoutControls);
    } else {
        initLayoutControls();
    }

    window.OndaLayoutControls = {
        applySavedLayoutMode,
        toggleDesktopMode,
        toggleFullscreenMode,
        activateSettingsTab
    };
})();
