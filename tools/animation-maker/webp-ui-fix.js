(() => {
    'use strict';

    function updateRealWebPControls() {
        const format = document.getElementById('opt-format');
        const overlay = document.getElementById('webp-overlay');
        const gifSettings = document.getElementById('gif-specific-settings');
        const advancedCard = document.getElementById('advanced-webp-card');
        const playText = document.getElementById('play-btn-text');
        if (!format) return;
        const webp = format.value === 'webp';
        if (overlay) overlay.hidden = true;
        if (advancedCard) advancedCard.hidden = !webp;
        if (gifSettings) {
            gifSettings.style.opacity = '1';
            gifSettings.style.pointerEvents = 'auto';
            const irrelevantControls = gifSettings.querySelectorAll('.checkbox-container:first-of-type, .slider-row');
            irrelevantControls.forEach((control) => { control.style.display = webp ? 'none' : ''; });
        }
        if (playText) playText.textContent = webp ? 'PLAY WebP' : 'PLAY GIF';
    }

    function install() {
        const format = document.getElementById('opt-format');
        if (!format) return;
        format.addEventListener('change', () => window.setTimeout(updateRealWebPControls, 0));
        window.setTimeout(updateRealWebPControls, 0);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();
