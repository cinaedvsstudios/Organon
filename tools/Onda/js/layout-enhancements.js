/* Onda layout enhancement layer: bottom bar, layout mode, fullscreen, row actions. */
        (function () {
            'use strict';

            const LAYOUT_LAYER = 'onda-layout-enhancements';

            function all(selector, root = document) {
                return Array.from(root.querySelectorAll(selector));
            }

            function clean(value) {
                return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
            }

            function safeToast(message) {
                if (typeof window.showToast === 'function') window.showToast(message);
                else console.log('[' + LAYOUT_LAYER + '] ' + message);
            }

            function setupBottomBarEnhancements() {
                const bar = document.getElementById('organon-bottom-panel');
                const lib = document.getElementById('btn-database-engine');
                if (!bar || !lib) return;

                bar.classList.add('onda-bottom-bar-v3');
                lib.innerHTML = '📚 Library';
                lib.title = 'Open Library';

                if (!document.getElementById('btn-toggle-layout-mode')) {
                    const layoutBtn = document.createElement('button');
                    layoutBtn.id = 'btn-toggle-layout-mode';
                    layoutBtn.type = 'button';
                    layoutBtn.className = 'btn-pill onda-bottom-mini-pill';
                    layoutBtn.title = 'Toggle mobile / desktop layout';
                    layoutBtn.textContent = '📱';
                    layoutBtn.addEventListener('click', toggleDesktopMode);
                    bar.appendChild(layoutBtn);
                }

                if (!document.getElementById('btn-toggle-fullscreen')) {
                    const fullBtn = document.createElement('button');
                    fullBtn.id = 'btn-toggle-fullscreen';
                    fullBtn.type = 'button';
                    fullBtn.className = 'btn-pill onda-bottom-mini-pill';
                    fullBtn.title = 'Toggle fullscreen';
                    fullBtn.textContent = '⛶';
                    fullBtn.addEventListener('click', toggleFullscreenMode);
                    bar.appendChild(fullBtn);
                }

                applySavedDesktopMode();
                updateFullscreenButton();
            }

            function applySavedDesktopMode() {
                const on = localStorage.getItem('ondaForceDesktopModeV1') === '1';
                document.body.classList.toggle('onda-force-desktop-mode', on);
                const btn = document.getElementById('btn-toggle-layout-mode');
                if (btn) {
                    btn.classList.toggle('active', on);
                    btn.textContent = on ? '💻' : '📱';
                    btn.title = on ? 'Desktop layout forced. Tap for mobile layout.' : 'Mobile layout. Tap for desktop layout.';
                }
            }

            function toggleDesktopMode() {
                const next = !document.body.classList.contains('onda-force-desktop-mode');
                localStorage.setItem('ondaForceDesktopModeV1', next ? '1' : '0');
                applySavedDesktopMode();
                safeToast(next ? 'Desktop layout mode on.' : 'Mobile layout mode on.');
            }

            async function toggleFullscreenMode() {
                try {
                    if (!document.fullscreenElement) {
                        await document.documentElement.requestFullscreen();
                        document.body.classList.add('onda-app-fullscreen');
                        safeToast('Fullscreen mode on.');
                    } else {
                        await document.exitFullscreen();
                    }
                } catch (error) {
                    console.warn('Fullscreen failed:', error);
                    safeToast('Fullscreen was blocked by this browser.');
                }
                updateFullscreenButton();
            }

            function updateFullscreenButton() {
                const on = !!document.fullscreenElement;
                document.body.classList.toggle('onda-app-fullscreen', on);
                const btn = document.getElementById('btn-toggle-fullscreen');
                if (btn) {
                    btn.classList.toggle('active', on);
                    btn.textContent = on ? '↙' : '⛶';
                    btn.title = on ? 'Exit fullscreen' : 'Enter fullscreen';
                }
            }

            function addTransportClass() {
                const pill = document.getElementById('start-controls-pill');
                if (pill) pill.classList.add('onda-transport-pill');
            }

            function trackIdFrom(el) {
                if (!el) return '';
                return el.dataset.trackId ||
                    el.dataset.historyTrackId ||
                    el.closest?.('[data-track-id]')?.dataset.trackId ||
                    el.closest?.('[data-history-track-id]')?.dataset.historyTrackId ||
                    '';
            }

            function getOrCreateActions(row) {
                let actions = row.querySelector('.library-row-buttons');
                if (!actions) {
                    actions = document.createElement('div');
                    actions.className = 'library-row-buttons onda-row-actions';
                    const main = row.querySelector('.library-row-main');
                    (main || row).appendChild(actions);
                }
                return actions;
            }

            function markRowText(row) {
                const explicitPlaylistText = row.matches('.playlist-detail-track-row')
                    ? Array.from(row.children).find(child => !child.classList.contains('history-list-number') && !child.classList.contains('library-row-buttons'))
                    : null;

                const libraryText = row.querySelector('.library-row-main > .library-track-text-wrap')
                    || Array.from(row.querySelectorAll('.library-row-main > *')).find(child => {
                        return !child.classList.contains('selection-indicator')
                            && !child.classList.contains('library-row-buttons')
                            && !child.classList.contains('onda-row-actions');
                    });

                [
                    explicitPlaylistText,
                    row.querySelector('.playlist-row-content'),
                    libraryText,
                    row.querySelector('.onda-track-text-wrap')
                ].filter(Boolean).forEach(el => el.classList.add('onda-track-text-wrap'));
            }

            function ensurePlayButton(row, id, actions) {
                let button = row.querySelector('.btn-db-play-track, .btn-history-play, .btn-detail-play-track, .btn-now-play-track, .btn-onda-row-play');
                if (button) {
                    button.classList.add('btn-onda-row-play');
                    button.dataset.trackId = button.dataset.trackId || id;
                    button.textContent = 'Play';
                    return;
                }

                button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn-pill btn-onda-row-play';
                button.dataset.trackId = id;
                button.textContent = 'Play';
                actions.prepend(button);
            }

            function ensureAddPlaylistButton(row, id, actions) {
                if (row.querySelector('.btn-onda-add-playlist')) return;

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn-pill btn-onda-add-playlist';
                button.dataset.trackId = id;
                button.textContent = '+ Playlist';
                actions.appendChild(button);
            }

            function enhanceTrackRow(row) {
                const id = trackIdFrom(row);
                if (!id) return;

                row.dataset.trackId = id;
                row.classList.add('onda-track-row-enhanced');
                markRowText(row);

                const actions = getOrCreateActions(row);
                ensurePlayButton(row, id, actions);
                ensureAddPlaylistButton(row, id, actions);
            }

            function enhanceTrackRows(root = document) {
                const selector = [
                    '.library-result-row[data-track-id]',
                    '.library-mini-row[data-track-id]',
                    '.history-list-row[data-history-track-id]',
                    '.history-list-row[data-track-id]'
                ].join(',');
                all(selector, root).forEach(enhanceTrackRow);
            }

            function playTrack(id) {
                if (!id) return false;

                if (typeof window.addTrackToQueueFromLibrary === 'function') {
                    window.addTrackToQueueFromLibrary(id, true);
                    setTimeout(refreshLayoutEnhancements, 80);
                    return true;
                }

                const escaped = CSS.escape(id);
                const row = document.querySelector('[data-track-id="' + escaped + '"], [data-history-track-id="' + escaped + '"]');
                if (row) {
                    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    setTimeout(refreshLayoutEnhancements, 120);
                    return true;
                }

                safeToast('Could not play that row.');
                return false;
            }

            function addTrackToPlaylistByPrompt(id) {
                if (!id) return;

                const playlistName = prompt('Add this track to which playlist? Type an existing or new playlist name:');
                if (playlistName === null) return;

                const cleanName = playlistName.trim();
                if (!cleanName) {
                    safeToast('No playlist name entered.');
                    return;
                }

                if (typeof window.addTrackIdToPlaylist === 'function') {
                    window.addTrackIdToPlaylist(id, cleanName);
                    ['syncAllTrackPlaylistMetadata', 'renderPlaylistsList', 'renderLibraryManager', 'updateMetadataUI'].forEach(fn => {
                        if (typeof window[fn] === 'function') window[fn]();
                    });
                    if (typeof window.saveActiveLibraryState === 'function') window.saveActiveLibraryState('direct-row-add-to-playlist');
                    safeToast('Added to playlist: ' + cleanName);
                    setTimeout(refreshLayoutEnhancements, 120);
                    return;
                }

                safeToast('Playlist add function was not available.');
            }

            function nowPanelLabel(title, sub) {
                const label = document.createElement('div');
                label.className = 'onda-now-panel-label';
                label.innerHTML = '<span>' + title + '</span>' + (sub ? '<span class="onda-now-panel-sub">' + sub + '</span>' : '');
                return label;
            }

            function decoratePlaylistNowPlaying(panel) {
                panel.classList.add('onda-now-panel', 'onda-now-playlist-mode');
                panel.classList.remove('onda-now-history-mode');

                const list = document.getElementById('now-playing-playlist-track-list');
                if (!list) return false;

                if (!panel.querySelector('.onda-now-panel-label')) {
                    const label = nowPanelLabel('Playlist Queue', 'Each song has its own Play button');
                    const divider = panel.querySelector('.now-playing-divider');
                    if (divider && divider.nextSibling) divider.parentNode.insertBefore(label, divider.nextSibling);
                    else panel.prepend(label);
                }

                list.classList.add('onda-now-playlist-list');
                all('.playlist-detail-track-row[data-track-id]', list).forEach(enhanceTrackRow);
                enhanceTrackRows(panel);
                return true;
            }

            function buildIndividualHistoryNowPlaying(panel) {
                const nowPlayingTitle = document.getElementById('now-playing');
                const currentTitle = clean(nowPlayingTitle ? nowPlayingTitle.textContent.replace(/\|.*$/, '') : '');

                if (!currentTitle || currentTitle === 'no track loaded') return;

                const historyRows = all('#history-list [data-history-track-id], #history-list [data-track-id]')
                    .filter(row => {
                        const rowTitle = clean(row.querySelector('.library-track-title')?.textContent || '');
                        return rowTitle && rowTitle !== currentTitle;
                    })
                    .slice(0, 50);

                panel.hidden = false;
                panel.classList.add('onda-now-panel', 'onda-now-history-mode');
                panel.classList.remove('onda-now-playlist-mode');
                panel.innerHTML = '';

                const divider = document.createElement('hr');
                divider.className = 'now-playing-divider';
                panel.appendChild(divider);
                panel.appendChild(nowPanelLabel('Previously Played', 'Individual track history'));

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
                        const id = trackIdFrom(row);
                        clone.dataset.trackId = id;
                        clone.classList.remove('history-list-row');
                        clone.classList.add('library-result-row');
                        clone.removeAttribute('data-history-track-id');
                        list.appendChild(clone);
                    });
                }

                panel.appendChild(list);
                enhanceTrackRows(panel);
            }

            function refreshNowPlayingPanel() {
                // V7: the core updateNowPlayingPlaylistPanel renderer owns the Now Playing queue.
                // Do not rebuild/decorate this panel from the add-on layer; it caused blank queue rows.
                if (typeof updateNowPlayingPlaylistPanel === 'function') updateNowPlayingPlaylistPanel();
            }

            function refreshLayoutEnhancements() {
                setupBottomBarEnhancements();
                addTransportClass();
                enhanceTrackRows(document);
                refreshNowPlayingPanel();
            }

            let refreshTimer = null;
            function scheduleRefresh() {
                clearTimeout(refreshTimer);
                refreshTimer = setTimeout(refreshLayoutEnhancements, 80);
            }

            document.addEventListener('fullscreenchange', updateFullscreenButton);

            document.addEventListener('click', function (event) {
                const addButton = event.target.closest('.btn-onda-add-playlist');
                if (addButton) {
                    event.preventDefault();
                    event.stopPropagation();
                    addTrackToPlaylistByPrompt(trackIdFrom(addButton));
                    return;
                }

                const playButton = event.target.closest('.btn-onda-row-play');
                if (playButton) {
                    if (playButton.classList.contains('btn-now-play-track') || playButton.classList.contains('btn-detail-play-track')) {
                        return;
                    }
                    const didPlay = playTrack(trackIdFrom(playButton));
                    if (didPlay) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }
            }, true);

            function initLayoutEnhancements() {
                refreshLayoutEnhancements();

                const observer = new MutationObserver(scheduleRefresh);
                [
                    'organon-bottom-panel',
                    'db-library-results',
                    'db-recent-list',
                    'history-list',
                    'now-playing-playlist-panel',
                    'metadata-display-card'
                ].map(id => document.getElementById(id)).filter(Boolean).forEach(node => {
                    observer.observe(node, { childList: true, subtree: true, attributes: true });
                });

                setInterval(refreshLayoutEnhancements, 1500);
                window.OndaLayoutEnhancements = {
                    refresh: refreshLayoutEnhancements,
                    toggleDesktopMode,
                    toggleFullscreenMode
                };
                console.log('onda layout enhancements loaded');
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initLayoutEnhancements);
            } else {
                initLayoutEnhancements();
            }
        })();
        


/* Onda layout mode controller. */
        (function () {
            'use strict';

            const MODE_KEY = 'ondaLayoutModeV4';

            function toast(message) {
                if (typeof window.showToast === 'function') window.showToast(message);
                else console.log('[onda-layout-mode] ' + message);
            }

            function naturalMode() {
                return window.matchMedia && window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop';
            }

            function savedMode() {
                const stored = localStorage.getItem(MODE_KEY);
                return stored === 'mobile' || stored === 'desktop' ? stored : naturalMode();
            }

            function applyLayoutMode(mode) {
                const chosen = mode === 'mobile' || mode === 'desktop' ? mode : naturalMode();
                document.body.classList.toggle('onda-force-mobile-mode', chosen === 'mobile');
                document.body.classList.toggle('onda-force-desktop-mode', chosen === 'desktop');
                localStorage.setItem(MODE_KEY, chosen);
                localStorage.setItem('ondaForceDesktopModeV1', chosen === 'desktop' ? '1' : '0');

                const layoutBtn = document.getElementById('btn-toggle-layout-mode');
                if (layoutBtn) {
                    layoutBtn.classList.toggle('active', chosen === 'desktop');
                    layoutBtn.textContent = chosen === 'desktop' ? '💻' : '📱';
                    layoutBtn.title = chosen === 'desktop'
                        ? 'Desktop layout is active. Tap to switch to mobile layout.'
                        : 'Mobile layout is active. Tap to switch to desktop layout.';
                }

                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            }

            function toggleLayoutMode(event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                const current = document.body.classList.contains('onda-force-mobile-mode') ? 'mobile' : 'desktop';
                const next = current === 'mobile' ? 'desktop' : 'mobile';
                applyLayoutMode(next);
                toast(next === 'mobile' ? 'Mobile layout mode on.' : 'Desktop layout mode on.');
            }

            async function requestTrueFullscreen() {
                const root = document.documentElement;
                if (!root.requestFullscreen) throw new Error('Fullscreen API is not available in this browser.');
                try {
                    await root.requestFullscreen({ navigationUI: 'hide' });
                } catch (firstError) {
                    await root.requestFullscreen();
                }
            }

            async function toggleFullscreen(event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                try {
                    if (!document.fullscreenElement) {
                        await requestTrueFullscreen();
                        document.body.classList.add('onda-app-fullscreen');
                        toast('Fullscreen requested. Browser chrome should hide if this browser allows it.');
                    } else {
                        await document.exitFullscreen();
                    }
                } catch (error) {
                    console.warn('Fullscreen failed:', error);
                    document.body.classList.toggle('onda-app-fullscreen');
                    toast('Browser blocked true fullscreen. Compact app mode toggled instead.');
                }

                updateFullscreenButton();
            }

            function updateFullscreenButton() {
                const on = !!document.fullscreenElement || document.body.classList.contains('onda-app-fullscreen');
                const fullBtn = document.getElementById('btn-toggle-fullscreen');
                if (fullBtn) {
                    fullBtn.classList.toggle('active', on);
                    fullBtn.textContent = on ? '↙' : '⛶';
                    fullBtn.title = on ? 'Exit fullscreen / compact mode' : 'Enter fullscreen';
                }
            }

            function replaceButton(id, fallbackText) {
                let btn = document.getElementById(id);
                if (!btn) return null;
                const clone = btn.cloneNode(true);
                clone.textContent = fallbackText;
                btn.replaceWith(clone);
                return clone;
            }

            function ensureBottomButtons() {
                const bar = document.getElementById('organon-bottom-panel');
                const libraryButton = document.getElementById('btn-database-engine');
                if (!bar || !libraryButton) return;

                bar.classList.add('onda-bottom-bar-v3');
                libraryButton.innerHTML = '📚 Library';
                libraryButton.title = 'Open Library';

                let layoutButton = document.getElementById('btn-toggle-layout-mode');
                if (!layoutButton) {
                    layoutButton = document.createElement('button');
                    layoutButton.id = 'btn-toggle-layout-mode';
                    layoutButton.type = 'button';
                    layoutButton.className = 'btn-pill onda-bottom-mini-pill';
                    bar.appendChild(layoutButton);
                }
                layoutButton = replaceButton('btn-toggle-layout-mode', '📱');
                if (layoutButton) {
                    layoutButton.classList.add('btn-pill', 'onda-bottom-mini-pill');
                    layoutButton.addEventListener('click', toggleLayoutMode, true);
                }

                let fullButton = document.getElementById('btn-toggle-fullscreen');
                if (!fullButton) {
                    fullButton = document.createElement('button');
                    fullButton.id = 'btn-toggle-fullscreen';
                    fullButton.type = 'button';
                    fullButton.className = 'btn-pill onda-bottom-mini-pill';
                    bar.appendChild(fullButton);
                }
                fullButton = replaceButton('btn-toggle-fullscreen', '⛶');
                if (fullButton) {
                    fullButton.classList.add('btn-pill', 'onda-bottom-mini-pill');
                    fullButton.addEventListener('click', toggleFullscreen, true);
                }

                applyLayoutMode(savedMode());
                updateFullscreenButton();
            }

            function initV4() {
                ensureBottomButtons();
                document.addEventListener('fullscreenchange', updateFullscreenButton);
                window.addEventListener('resize', () => {
                    if (!localStorage.getItem(MODE_KEY)) applyLayoutMode(naturalMode());
                });
                window.OndaNowPlayingControlsV8 = {
            toggleSongInfo: () => setNowPlayingVisibilityToggle('song-info'),
            togglePlaylist: () => setNowPlayingVisibilityToggle('playlist'),
            scrollCurrent: () => scrollCurrentTrackRowsIntoView('manual-console'),
            getState: () => ({
                hideSongInfo: nowPlayingHideSongInfo,
                hidePlaylist: nowPlayingHidePlaylist,
                currentTrack: currentFile?.name || null,
                playlist: getCurrentPlaybackPlaylistName()
            })
        };
        window.OndaLayoutControlsV4 = {
                    setMobile: () => applyLayoutMode('mobile'),
                    setDesktop: () => applyLayoutMode('desktop'),
                    toggleLayoutMode,
                    toggleFullscreen,
                    refresh: ensureBottomButtons
                };
                console.log('onda layout mode loaded');
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initV4);
            } else {
                initV4();
            }
        })();
        
