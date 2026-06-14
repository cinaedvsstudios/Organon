/* Onda mobile transport + shared Library / Now Playing row patch.
   Load this after tools/Onda/index.html's built-in script. */
(function () {
    'use strict';

    const PATCH_NAME = 'onda-mobile-library-patch-v1';

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function normaliseText(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function safeToast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        } else {
            console.log(`[${PATCH_NAME}] ${message}`);
        }
    }

    function addTransportClass() {
        const playButton = document.getElementById('btn-play');
        const pill = playButton ? playButton.closest('.utility-pill') : null;
        if (pill) pill.classList.add('onda-transport-pill');
    }

    function getTrackId(rowOrButton) {
        if (!rowOrButton) return '';
        return rowOrButton.dataset.trackId ||
               rowOrButton.dataset.historyTrackId ||
               rowOrButton.closest('[data-track-id]')?.dataset.trackId ||
               rowOrButton.closest('[data-history-track-id]')?.dataset.historyTrackId ||
               '';
    }

    function getOrCreateActionArea(row) {
        let actions = row.querySelector('.library-row-buttons');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'library-row-buttons onda-row-actions';

            const main = row.querySelector('.library-row-main');
            if (main) {
                main.appendChild(actions);
            } else {
                row.appendChild(actions);
            }
        }
        return actions;
    }

    function markTextBlocks(row) {
        const title = row.querySelector('.library-track-title');
        const meta = row.querySelector('.library-track-meta');

        if (title) title.classList.add('onda-track-text-line');
        if (meta) meta.classList.add('onda-track-text-line');

        const likelyTextContainers = [
            row.querySelector('.playlist-row-content'),
            row.querySelector('.library-row-main > div:first-child'),
            row.querySelector('.playlist-detail-track-row > div:nth-child(2)')
        ].filter(Boolean);

        likelyTextContainers.forEach(el => el.classList.add('onda-track-text-wrap'));
    }

    function ensurePlayButton(row, trackId, actions) {
        let playButton = row.querySelector('.btn-db-play-track, .btn-history-play, .btn-onda-row-play');

        if (playButton) {
            playButton.classList.add('btn-onda-row-play');
            playButton.dataset.ondaPlay = trackId;
            playButton.dataset.trackId = playButton.dataset.trackId || trackId;
            playButton.textContent = 'Play';
            return;
        }

        playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'btn-pill btn-onda-row-play';
        playButton.dataset.ondaPlay = trackId;
        playButton.dataset.trackId = trackId;
        playButton.textContent = 'Play';
        actions.prepend(playButton);
    }

    function ensureAddPlaylistButton(row, trackId, actions) {
        if (row.querySelector('.btn-onda-add-playlist')) return;

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'btn-pill btn-onda-add-playlist';
        addButton.dataset.trackId = trackId;
        addButton.textContent = '+ Playlist';
        actions.appendChild(addButton);
    }

    function enhanceTrackRow(row) {
        const trackId = getTrackId(row);
        if (!trackId) return;

        row.dataset.trackId = trackId;
        row.classList.add('onda-track-row-enhanced');

        markTextBlocks(row);

        const actions = getOrCreateActionArea(row);
        ensurePlayButton(row, trackId, actions);
        ensureAddPlaylistButton(row, trackId, actions);
    }

    function enhanceAllTrackRows(root = document) {
        const selector = [
            '.library-result-row[data-track-id]',
            '.library-mini-row[data-track-id]',
            '.playlist-detail-track-row[data-track-id]',
            '.history-list-row[data-history-track-id]',
            '.history-list-row[data-track-id]'
        ].join(',');

        $all(selector, root).forEach(enhanceTrackRow);
    }

    function playTrack(trackId) {
        if (!trackId) return false;

        if (typeof window.addTrackToQueueFromLibrary === 'function') {
            window.addTrackToQueueFromLibrary(trackId, true);
            setTimeout(refreshAll, 60);
            return true;
        }

        return false;
    }

    function addTrackToPlaylist(trackId) {
        if (!trackId) return;

        const playlistName = prompt('Add this track to which playlist? Type an existing or new playlist name:');
        if (playlistName === null) return;

        const cleanName = playlistName.trim();
        if (!cleanName) {
            safeToast('No playlist name entered.');
            return;
        }

        if (typeof window.addTrackIdToPlaylist === 'function') {
            window.addTrackIdToPlaylist(trackId, cleanName);

            if (typeof window.syncAllTrackPlaylistMetadata === 'function') window.syncAllTrackPlaylistMetadata();
            if (typeof window.renderPlaylistsList === 'function') window.renderPlaylistsList();
            if (typeof window.renderLibraryManager === 'function') window.renderLibraryManager();
            if (typeof window.updateMetadataUI === 'function') window.updateMetadataUI();
            if (typeof window.saveActiveLibraryState === 'function') window.saveActiveLibraryState('row-add-to-playlist');

            safeToast(`Added to playlist: ${cleanName}`);
            setTimeout(refreshAll, 80);
            return;
        }

        safeToast('Playlist add function was not available in this Onda build.');
    }

    function createNowPlayingLabel(mode, subText) {
        const label = document.createElement('div');
        label.className = 'onda-now-panel-label';
        label.innerHTML = `<span>${mode}</span>${subText ? `<span class="onda-now-panel-sub">${subText}</span>` : ''}`;
        return label;
    }

    function decoratePlaylistNowPlaying(panel) {
        panel.classList.add('onda-now-panel', 'onda-now-playlist-mode');
        panel.classList.remove('onda-now-history-mode');

        const list = document.getElementById('now-playing-playlist-track-list');
        if (!list) return false;

        if (!panel.querySelector('.onda-now-panel-label')) {
            const label = createNowPlayingLabel('Playlist Queue', 'Tap Play or add tracks to another playlist');
            const divider = panel.querySelector('.now-playing-divider');
            if (divider && divider.nextSibling) {
                divider.parentNode.insertBefore(label, divider.nextSibling);
            } else {
                panel.prepend(label);
            }
        }

        list.classList.add('onda-now-playlist-list');
        enhanceAllTrackRows(panel);
        return true;
    }

    function buildHistoryNowPlaying(panel) {
        const nowPlayingTitle = document.getElementById('now-playing');
        const currentTitle = normaliseText(nowPlayingTitle ? nowPlayingTitle.textContent.replace(/\|.*$/, '') : '');

        if (!currentTitle || currentTitle === 'no track loaded') {
            return;
        }

        const historyRows = $all('#history-list [data-history-track-id], #history-list [data-track-id]')
            .filter(row => {
                const rowTitle = normaliseText(row.querySelector('.library-track-title')?.textContent || '');
                return rowTitle && rowTitle !== currentTitle;
            })
            .slice(0, 10);

        panel.hidden = false;
        panel.classList.add('onda-now-panel', 'onda-now-history-mode');
        panel.classList.remove('onda-now-playlist-mode');
        panel.dataset.ondaInjected = 'history';

        panel.innerHTML = '';
        panel.appendChild(document.createElement('hr')).className = 'now-playing-divider';
        panel.appendChild(createNowPlayingLabel('Previously Played', 'Individual track history'));

        const list = document.createElement('div');
        list.className = 'onda-now-history-list';

        if (!historyRows.length) {
            const empty = document.createElement('div');
            empty.className = 'library-track-meta';
            empty.textContent = 'No previous tracks yet. Play another song and it will appear here.';
            list.appendChild(empty);
        } else {
            historyRows.forEach(row => {
                const clone = row.cloneNode(true);
                const trackId = getTrackId(row);
                clone.dataset.trackId = trackId;
                clone.classList.remove('history-list-row');
                clone.classList.add('library-result-row');
                clone.removeAttribute('data-history-track-id');
                list.appendChild(clone);
            });
        }

        panel.appendChild(list);
        enhanceAllTrackRows(panel);
    }

    function refreshNowPlayingPanel() {
        const panel = document.getElementById('now-playing-playlist-panel');
        if (!panel) return;

        const hasPlaylistList = Boolean(panel.querySelector('#now-playing-playlist-track-list, .playlist-detail-track-row'));
        if (hasPlaylistList) {
            decoratePlaylistNowPlaying(panel);
            return;
        }

        buildHistoryNowPlaying(panel);
    }

    function refreshAll() {
        addTransportClass();
        enhanceAllTrackRows(document);
        refreshNowPlayingPanel();
    }

    let refreshTimer = null;
    function scheduleRefresh() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshAll, 80);
    }

    document.addEventListener('click', (event) => {
        const addButton = event.target.closest('.btn-onda-add-playlist');
        if (addButton) {
            event.preventDefault();
            event.stopPropagation();
            addTrackToPlaylist(getTrackId(addButton));
            return;
        }

        const playButton = event.target.closest('.btn-onda-row-play');
        if (playButton) {
            const played = playTrack(getTrackId(playButton));
            if (played) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }, true);

    window.addEventListener('DOMContentLoaded', () => {
        refreshAll();

        const observer = new MutationObserver(scheduleRefresh);
        [
            document.getElementById('db-library-results'),
            document.getElementById('db-recent-list'),
            document.getElementById('history-list'),
            document.getElementById('now-playing-playlist-panel'),
            document.getElementById('metadata-display-card')
        ].filter(Boolean).forEach(node => observer.observe(node, { childList: true, subtree: true, attributes: true }));

        setInterval(refreshAll, 1500);
    });
})();
