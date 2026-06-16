/* === ONDA DIRECT EDIT V4: working desktop/mobile toggle + fullscreen navigationUI hide === */
        (function () {
            'use strict';

            const MODE_KEY = 'ondaLayoutModeV4';

            function toast(message) {
                if (typeof window.showToast === 'function') window.showToast(message);
                else console.log('[onda-direct-edit-v4] ' + message);
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
                console.log('onda-direct-edit-v4 loaded');
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initV4);
            } else {
                initV4();
            }
        })();
        /* === END ONDA DIRECT EDIT V4 === */
