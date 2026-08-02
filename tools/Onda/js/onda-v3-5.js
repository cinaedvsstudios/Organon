/* Onda v3.5 mobile layout, marquee, repeat, and shuffle corrections. */
(function () {
    'use strict';

    const VERSION = 'v3.5';
    const MOBILE_BREAKPOINT = 768;
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

    if (window.OndaV35?.initialized) return;

    let repeatMode = 'off';
    let shuffleEnabled = false;
    let shuffleQueue = [];
    let shuffleSignature = '';
    let marqueeFrame = 0;
    let marqueeResizeTimer = 0;

    function isMobileMode() {
        return document.body.classList.contains('onda-force-mobile-mode')
            || (!document.body.classList.contains('onda-force-desktop-mode') && mobileQuery.matches);
    }

    function getPlaylistTracks() {
        try {
            return Array.isArray(playlistTracks) ? playlistTracks : [];
        } catch (error) {
            return [];
        }
    }

    function getCurrentTrackIndex() {
        try {
            return Number.isInteger(currentTrackIndex) ? currentTrackIndex : -1;
        } catch (error) {
            return -1;
        }
    }

    function getActiveAudio() {
        try {
            return activeAudio || null;
        } catch (error) {
            return null;
        }
    }

    function getPlaylistSignature() {
        return getPlaylistTracks().map((track, index) => {
            if (!track) return `missing:${index}`;
            return String(track.name || track.id || track.url || track.src || index);
        }).join('\u001f');
    }

    function syncLegacyPlaybackState() {
        try { isRepeatOne = repeatMode === 'one'; } catch (error) {}
        try { isRepeatAll = repeatMode === 'all'; } catch (error) {}
        try { isShuffle = shuffleEnabled; } catch (error) {}
    }

    function updatePlaybackButtons() {
        const repeatOneButton = document.getElementById('btn-repeat-one');
        const repeatAllButton = document.getElementById('btn-repeat-all');
        const shuffleButton = document.getElementById('btn-shuffle');
        const repeatOneActive = repeatMode === 'one';
        const repeatAllActive = repeatMode === 'all';

        if (repeatOneButton) {
            repeatOneButton.textContent = '🔂';
            repeatOneButton.dataset.tooltip = 'Repeat current track';
            repeatOneButton.title = 'Repeat current track';
            repeatOneButton.classList.toggle('active-state', repeatOneActive);
            repeatOneButton.setAttribute('aria-pressed', String(repeatOneActive));
        }

        if (repeatAllButton) {
            repeatAllButton.textContent = '🔁';
            repeatAllButton.dataset.tooltip = 'Repeat entire playlist';
            repeatAllButton.title = 'Repeat entire playlist';
            repeatAllButton.classList.toggle('active-state', repeatAllActive);
            repeatAllButton.setAttribute('aria-pressed', String(repeatAllActive));
        }

        if (shuffleButton) {
            shuffleButton.classList.toggle('active-state', shuffleEnabled);
            shuffleButton.setAttribute('aria-pressed', String(shuffleEnabled));
        }

        syncLegacyPlaybackState();
    }

    function shuffleIndexes(indexes) {
        for (let index = indexes.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
        }
        return indexes;
    }

    function resetShuffleQueue(excludeIndex = getCurrentTrackIndex()) {
        const tracks = getPlaylistTracks();
        shuffleSignature = getPlaylistSignature();
        shuffleQueue = shuffleIndexes(
            Array.from({ length: tracks.length }, (_, index) => index)
                .filter((index) => index !== excludeIndex)
        );
    }

    function takeNextShuffleIndex(allowWrap) {
        const tracks = getPlaylistTracks();
        if (tracks.length <= 1) return -1;

        const signature = getPlaylistSignature();
        if (signature !== shuffleSignature) resetShuffleQueue(getCurrentTrackIndex());

        const currentIndex = getCurrentTrackIndex();
        shuffleQueue = shuffleQueue.filter((index) => index !== currentIndex && index < tracks.length);

        if (shuffleQueue.length === 0) {
            if (!allowWrap) return -1;
            resetShuffleQueue(currentIndex);
        }

        return shuffleQueue.shift() ?? -1;
    }

    function switchToTrack(index) {
        const tracks = getPlaylistTracks();
        if (index < 0 || index >= tracks.length) return false;
        try {
            switchTrack(index);
            return true;
        } catch (error) {
            console.error('Onda v3.5 could not switch tracks:', error);
            return false;
        }
    }

    function restartCurrentTrack(audioObject) {
        if (!audioObject) return;
        try {
            audioObject.currentTime = 0;
            playAudio();
        } catch (error) {
            console.error('Onda v3.5 could not repeat the current track:', error);
        }
    }

    function stopAtPlaylistEnd(audioObject) {
        try { pauseAudio(); } catch (error) {}
        if (!audioObject) return;
        try { audioObject.currentTime = 0; } catch (error) {}
    }

    function handleTrackEnded(event) {
        const audioObject = event.currentTarget;
        if (audioObject !== getActiveAudio()) return;

        event.stopImmediatePropagation();
        const tracks = getPlaylistTracks();
        const currentIndex = getCurrentTrackIndex();

        if (repeatMode === 'one') {
            restartCurrentTrack(audioObject);
            return;
        }

        if (shuffleEnabled) {
            const nextIndex = takeNextShuffleIndex(repeatMode === 'all');
            if (nextIndex >= 0) switchToTrack(nextIndex);
            else stopAtPlaylistEnd(audioObject);
            return;
        }

        if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
            switchToTrack(currentIndex + 1);
        } else if (repeatMode === 'all' && tracks.length > 0) {
            switchToTrack(0);
        } else {
            stopAtPlaylistEnd(audioObject);
        }
    }

    function handleNextClick(event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const tracks = getPlaylistTracks();
        if (tracks.length <= 1) return;

        if (shuffleEnabled) {
            const nextIndex = takeNextShuffleIndex(repeatMode === 'all');
            if (nextIndex >= 0) switchToTrack(nextIndex);
            return;
        }

        const nextIndex = getCurrentTrackIndex() + 1;
        if (nextIndex < tracks.length) switchToTrack(nextIndex);
        else if (repeatMode === 'all') switchToTrack(0);
    }

    function handleRepeatOneClick(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        repeatMode = repeatMode === 'one' ? 'off' : 'one';
        updatePlaybackButtons();
    }

    function handleRepeatAllClick(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        repeatMode = repeatMode === 'all' ? 'off' : 'all';
        updatePlaybackButtons();
    }

    function handleShuffleClick(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        shuffleEnabled = !shuffleEnabled;
        if (shuffleEnabled) resetShuffleQueue(getCurrentTrackIndex());
        else {
            shuffleQueue = [];
            shuffleSignature = '';
        }
        updatePlaybackButtons();
    }

    function bindPlaybackControls() {
        document.getElementById('btn-repeat-one')?.addEventListener('click', handleRepeatOneClick, true);
        document.getElementById('btn-repeat-all')?.addEventListener('click', handleRepeatAllClick, true);
        document.getElementById('btn-shuffle')?.addEventListener('click', handleShuffleClick, true);
        document.getElementById('btn-next')?.addEventListener('click', handleNextClick, true);

        try { localAudio.addEventListener('ended', handleTrackEnded, true); } catch (error) {}
        try { streamAudio.addEventListener('ended', handleTrackEnded, true); } catch (error) {}

        updatePlaybackButtons();
    }

    const nativeScrollIntoView = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = function ondaV35ScrollIntoView(options) {
        if (!isMobileMode()) return nativeScrollIntoView.call(this, options);

        if (this.matches?.('#metadata-display-card, #tab-library')) {
            const middlePanel = document.getElementById('organon-middle-panel');
            if (middlePanel && middlePanel.scrollHeight > middlePanel.clientHeight) {
                middlePanel.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        if (this.matches?.('#now-playing-playlist-track-list [data-track-id], #playlist-detail-track-list [data-track-id], .now-playing-current-track')) {
            const scroller = this.closest('#now-playing-playlist-track-list, #playlist-detail-track-list, .now-playing-queue-list, .playlist-detail-track-list');
            if (scroller && scroller.scrollHeight > scroller.clientHeight) {
                const rowRect = this.getBoundingClientRect();
                const scrollerRect = scroller.getBoundingClientRect();
                const top = scroller.scrollTop
                    + (rowRect.top - scrollerRect.top)
                    - ((scroller.clientHeight - this.clientHeight) / 2);
                scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
            return;
        }

        return nativeScrollIntoView.call(this, options);
    };

    function prepareMarqueeTitle(title) {
        let movingText = title.querySelector(':scope > .onda-title-marquee-text');
        if (!movingText) {
            movingText = document.createElement('span');
            movingText.className = 'onda-title-marquee-text';
            movingText.textContent = title.textContent;
            title.replaceChildren(movingText);
        }

        title.classList.remove('is-title-overflowing');
        title.style.removeProperty('--onda-title-shift');
        title.style.removeProperty('--onda-title-duration');

        if (!isMobileMode() || title.clientWidth <= 0) return;
        const overflow = Math.ceil(movingText.scrollWidth - title.clientWidth);
        if (overflow <= 2) return;

        title.style.setProperty('--onda-title-shift', `${overflow + 12}px`);
        title.style.setProperty('--onda-title-duration', `${Math.max(7, Math.min(18, 6 + overflow / 35))}s`);
        title.classList.add('is-title-overflowing');
    }

    function refreshMarquees() {
        document.querySelectorAll('.library-track-title.is-title-overflowing').forEach((title) => {
            title.classList.remove('is-title-overflowing');
        });
        document.querySelectorAll('.now-playing-current-track .library-track-title').forEach(prepareMarqueeTitle);
    }

    function scheduleMarqueeRefresh() {
        if (marqueeFrame) cancelAnimationFrame(marqueeFrame);
        marqueeFrame = requestAnimationFrame(() => {
            marqueeFrame = 0;
            refreshMarquees();
        });
    }

    function installMarqueeObserver() {
        const observer = new MutationObserver(scheduleMarqueeRefresh);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener('resize', () => {
            window.clearTimeout(marqueeResizeTimer);
            marqueeResizeTimer = window.setTimeout(scheduleMarqueeRefresh, 120);
        });
        window.addEventListener('orientationchange', () => {
            window.setTimeout(scheduleMarqueeRefresh, 180);
        });

        if (document.fonts?.ready) document.fonts.ready.then(scheduleMarqueeRefresh).catch(() => {});
        scheduleMarqueeRefresh();
    }

    function announceVersion() {
        const message = `Onda ${VERSION} loaded`;
        window.ONDA_VERSION = VERSION;
        document.documentElement.dataset.ondaVersion = VERSION;
        console.info(message);

        window.setTimeout(() => {
            if (typeof window.showToast === 'function') {
                window.showToast(message);
                return;
            }

            const toast = document.getElementById('toast-notice');
            if (!toast) return;
            toast.textContent = message;
            toast.classList.add('show');
            window.setTimeout(() => toast.classList.remove('show'), 2600);
        }, 260);
    }

    function init() {
        bindPlaybackControls();
        installMarqueeObserver();
        announceVersion();
    }

    window.OndaV35 = {
        initialized: true,
        version: VERSION,
        refreshMarquees: scheduleMarqueeRefresh,
        getRepeatMode: () => repeatMode,
        isShuffleEnabled: () => shuffleEnabled
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
