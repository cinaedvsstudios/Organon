// --- CORE DUAL AUDIO ENGINE SETUP ---
        // Using two elements solves WebAudio Context blocking CORS streams while preserving local file visualizers
        const localAudio = new Audio();
        const streamAudio = new Audio();

        localAudio.preload = 'metadata';
        streamAudio.preload = 'metadata';
        
        // Ensure elements exist in the DOM (hidden) to prevent browser pipeline suspension bugs
        localAudio.hidden = true;
        streamAudio.hidden = true;
        localAudio.classList.add('onda-hidden-audio');
        streamAudio.classList.add('onda-hidden-audio');
        document.body.appendChild(localAudio);
        document.body.appendChild(streamAudio);

        let activeAudio = localAudio;
        
        let audioCtx = null;
        let gainNode = null;
        let analyser = null;
        let localSource = null;
        let isPlaying = false;
        let visualizerRunning = false;
        
        // Multi-track Active Playlist queue
        let playlistTracks = [];
        let currentTrackIndex = -1;
        let currentFile = null;
        let isSeeking = false;

        // Custom Play Speed cycles ⚡
        const speedCycles = [1.0, 1.5, 2.0, 2.5];
        let currentSpeedIdx = 0;

        let playButtonHoldTimeout;
        let isHoldingPlay = false;
        let preHoldSpeed = 1.0;
        let ignoreNextPlayClick = false;

        let lastPrevClickTime = 0;
        let visualizerStyle = "bars";
        const VISUALIZER_STORAGE_KEY = "ondaVisualizerPresetsV1";
        const VISUALIZER_ACTIVE_STACK_KEY = "ondaActiveVisualizerStackV1";
        const ACTIVE_WORKSPACE_TAB_KEY = "ondaActiveWorkspaceTabV1";
        const LIBRARY_MOBILE_VIEW_KEY = "ondaLibraryMobileViewV1";
        const MOBILE_DB_ICON_STORAGE_KEY = "ondaMobileLibraryIconDisplayV1";
        const LOCAL_UI_SAVE_EVENT_KEY = "ondaLastLocalUiSaveV1";
        const LIBRARY_AUTOSAVE_KEY = "ondaActiveLibraryV1";
        const LIBRARY_DRAWER_HEIGHT_KEY = "ondaLibraryDrawerHeightV1";
        const LIBRARY_DRAWER_WIDTH_KEY = "ondaLibraryDrawerWidthV1";
        const LIBRARY_AUTOSAVE_BACKUP_KEY = "ondaActiveLibraryBackupV1";
        const LIBRARY_LAST_GOOD_KEY = "ondaLastGoodLibraryV1";
        const LIBRARY_RESTORE_REPORT_KEY = "ondaLibraryRestoreReportV1";
        const ONDA_IDB_NAME = "OndaMediaPlayerPersistentDB";
        const ONDA_IDB_VERSION = 2;
        const ONDA_IDB_STORE = "state";
        const ONDA_IDB_AUDIO_STORE = "audioFiles";
        const ONDA_IDB_ACTIVE_LIBRARY_KEY = "activeLibrary";
        const ONDA_LAST_LIBRARY_SAVE_KEY = "ondaLastLibrarySaveStatusV1";
        let libraryStorageReady = false;
        let libraryRestorePending = true;
        let lastActiveLibrarySavePayload = null;
        let pendingActiveLibrarySaveTimer = null;
        let visualizerLayers = loadActiveVisualizerStack();
        let savedVisualizerPresets = loadVisualizerPresets();

        let isRepeatOne = false;
        let isRepeatAll = false;
        let isShuffle = false;

        // Start with no hardcoded playlists.
        // User-created/imported playlists should be the only playlists shown.
        let playlists = {};
        let playlistMeta = {};
        let activePlaylistView = null;
        let currentPlaybackPlaylistName = null;
        const NOW_PLAYING_HIDE_SONG_KEY = "ondaNowPlayingHideSongInfoV1";
        const NOW_PLAYING_HIDE_PLAYLIST_KEY = "ondaNowPlayingHidePlaylistV1";
        let nowPlayingHideSongInfo = localStorage.getItem(NOW_PLAYING_HIDE_SONG_KEY) === "1";
        let nowPlayingHidePlaylist = localStorage.getItem(NOW_PLAYING_HIDE_PLAYLIST_KEY) === "1";
        let editingPlaylistName = null;
        let virtualLibrary = {};
        let nowPlayingEditMode = false;
        let isLibrarySelectMode = false;
        let selectedLibraryIds = new Set();
        let visibleLibraryIds = [];
        const FUZZY_SEARCH_STORAGE_KEY = "ondaLibraryFuzzySearchV1";
        let librarySearchFuzziness = Math.max(0, Math.min(4, parseInt(localStorage.getItem(FUZZY_SEARCH_STORAGE_KEY) || "1", 10) || 0));
        let searchHoldTimer = null;
        let searchHoldTriggered = false;

        // UI Element mappings
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const folderInput = document.getElementById('folder-input');
        const btnPlay = document.getElementById('btn-play');
        const btnPause = document.getElementById('btn-pause');
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const btnSpeedCycle = document.getElementById('btn-speed-cycle');
        const seekBar = document.getElementById('seek-bar');
        const timeCurrent = document.getElementById('time-current');
        const timeTotal = document.getElementById('time-total');
        
        const volSlider = document.getElementById('vol-slider');
        const speedSlider = document.getElementById('speed-slider');
        const btnToggleAdvanced = document.getElementById('btn-toggle-advanced');
        const advancedControls = document.getElementById('settings-popup');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const miniMetaBox = document.getElementById('mini-meta-box');
        const miniMetaSize = document.getElementById('mini-meta-size');
        const tagsBar = document.getElementById('scrollable-tags-bar');
        const visualizerLayerList = document.getElementById('visualizer-layer-list');
        const visualizerPresetSelect = document.getElementById('visualizer-preset-select');
        const btnAddVisualLayer = document.getElementById('btn-add-visual-layer');
        const btnSaveVisualStackMain = document.getElementById('btn-save-visual-stack-main');
        const libraryNameInput = document.getElementById('library-name-input');
        const libraryDrawer = document.getElementById('library-manager-drawer');
        const btnDatabaseEngine = document.getElementById('btn-database-engine');
        const btnCloseLibraryManager = document.getElementById('btn-close-library-manager');
        let isLibraryDrawerResizing = false;
        let libraryDrawerResizeStartY = 0;
        let libraryDrawerResizeStartHeight = 0;
        let isLibraryDrawerCornerResizing = false;
        let libraryDrawerResizeStartX = 0;
        let libraryDrawerResizeStartWidth = 0;
        let libraryDrawerCornerResizeSide = "right";
        let suppressLibraryDrawerToggleClick = false;
        const dbLibrarySearch = document.getElementById('db-library-search');
        const dbClearSearch = document.getElementById('btn-db-clear-search');
        const dbLibraryFilter = document.getElementById('db-library-filter');
        const dbLibraryResults = document.getElementById('db-library-results');
        const dbRecentList = document.getElementById('db-recent-list');
        const dbPlaylistList = document.getElementById('db-playlist-list');
        const dbBulkActions = document.getElementById('db-bulk-actions');
        const dbSelectionSummary = document.getElementById('db-selection-summary');
        const btnDbSelectMode = document.getElementById('btn-db-select-mode');
        const mobileIconHelpList = document.getElementById('mobile-icon-help-list');
        const btnResetMobileIcons = document.getElementById('btn-reset-mobile-icons');
        const historyCardGrid = document.getElementById('history-card-grid');
        const historyList = document.getElementById('history-list');
        const HISTORY_STORAGE_KEY = "ondaTrackHistoryV1";
        let recentTrackIds = loadRecentTrackIds();
        const LAST_PLAYED_TRACK_KEY = 'ondaLastPlayedTrackId';
        const LAST_PLAYED_PLAYLIST_KEY = 'ondaLastPlayedPlaylistName';

        const overlay = document.getElementById('modal-overlay');

        // --- 0. DATA + VISUALISER COMPOSER HELPERS ---
        function createDefaultVisualizerLayer(layerNumber = 1) {
            return {
                id: 'vis_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
                style: 'bars',
                layer: layerNumber,
                blend: 'source-over',
                gradient: 'horizontal',
                align: 'center',
                hPosition: 0,
                vPosition: 0,
                amplitude: 1,
                spacing: 0,
                rotate: 0,
                flipH: false,
                flipV: false,
                randomize: false,
                mirror: true,
                hidden: false,
                drawMode: 'fill',
                matrixCharacters: 'japanese',
                matrixSpawn: 'default',
                colors: ['#00d8ff', '#75b2de', '#ff4fa3', '#ffb84d', '#000000', '#000000']
            };
        }

        function loadVisualizerPresets() {
            try {
                return JSON.parse(localStorage.getItem(VISUALIZER_STORAGE_KEY) || '{}');
            } catch (err) {
                console.warn('Could not read visualizer presets:', err);
                return {};
            }
        }

        function saveVisualizerPresets() {
            localStorage.setItem(VISUALIZER_STORAGE_KEY, JSON.stringify(savedVisualizerPresets));
        }

        function loadActiveVisualizerStack() {
            try {
                const raw = localStorage.getItem(VISUALIZER_ACTIVE_STACK_KEY);
                if (!raw) return [createDefaultVisualizerLayer(1)];
                const parsed = JSON.parse(raw);
                const storedLayers = Array.isArray(parsed) ? parsed : parsed.layers;
                if (!Array.isArray(storedLayers) || storedLayers.length === 0) return [createDefaultVisualizerLayer(1)];
                return storedLayers.map((layer, index) => ({
                    ...normalizeVisualizerLayer(layer, index + 1),
                    id: 'vis_' + Date.now().toString(36) + '_' + index + '_' + Math.random().toString(36).slice(2, 5)
                }));
            } catch (err) {
                console.warn('Could not read active visualizer stack:', err);
                return [createDefaultVisualizerLayer(1)];
            }
        }

        function saveActiveVisualizerStack() {
            try {
                const payload = {
                    app: 'Onda Media Player',
                    type: 'onda-active-visualizer-stack',
                    version: 1,
                    savedAt: new Date().toISOString(),
                    layers: visualizerLayers.map((layer, index) => {
                        const normal = normalizeVisualizerLayer(layer, index + 1);
                        return {
                            style: normal.style,
                            layer: normal.layer,
                            blend: normal.blend,
                            gradient: normal.gradient,
                            align: normal.align,
                            hPosition: normal.hPosition,
                            vPosition: normal.vPosition,
                            amplitude: normal.amplitude,
                            spacing: normal.spacing,
                            rotate: normal.rotate,
                            flipH: normal.flipH,
                            flipV: normal.flipV,
                            randomize: normal.randomize,
                            mirror: normal.mirror,
                            hidden: normal.hidden,
                            drawMode: normal.drawMode,
                            matrixCharacters: normal.matrixCharacters,
                            matrixSpawn: normal.matrixSpawn,
                            colors: (normal.colors || []).map(sanitizeHexColor).slice(0, 6)
                        };
                    })
                };
                localStorage.setItem(VISUALIZER_ACTIVE_STACK_KEY, JSON.stringify(payload));
            } catch (err) {
                console.warn('Could not save active visualizer stack:', err);
                showToast('Could not save visualiser settings. Browser storage may be blocked.');
            }
        }

        function syncVisibleVisualizerCardsToState() {
            document.querySelectorAll('.visual-layer-card').forEach(card => {
                try {
                    syncVisualizerLayerFromCard(card);
                } catch (err) {
                    console.warn('Could not sync visualiser layer before local save:', err);
                }
            });
        }

        function saveLocalUiStateCheckpoint(reason = 'checkpoint') {
            try {
                syncVisibleVisualizerCardsToState();
                saveActiveVisualizerStack();
                if (typeof saveActiveLibraryState === 'function') saveActiveLibraryState(`ui:${reason}`);

                const activeTab = document.querySelector('.viewport-content.active-content')?.id;
                if (activeTab) localStorage.setItem(ACTIVE_WORKSPACE_TAB_KEY, activeTab);
                if (libraryDrawer) localStorage.setItem(LIBRARY_MOBILE_VIEW_KEY, libraryDrawer.dataset.mobileView || 'results');

                localStorage.setItem(LOCAL_UI_SAVE_EVENT_KEY, JSON.stringify({
                    reason,
                    savedAt: new Date().toISOString()
                }));
            } catch (err) {
                console.warn('Could not save local UI checkpoint:', err);
            }
        }

        function restoreLocalUiScreen() {
            try {
                const savedMobileView = localStorage.getItem(LIBRARY_MOBILE_VIEW_KEY);
                if (savedMobileView && ['results', 'recents', 'playlists', 'help'].includes(savedMobileView)) {
                    setMobileLibraryView(savedMobileView);
                }

                const savedTab = localStorage.getItem(ACTIVE_WORKSPACE_TAB_KEY);
                if (savedTab && document.getElementById(savedTab)) {
                    switchWorkspaceTab(savedTab);
                }
            } catch (err) {
                console.warn('Could not restore local UI screen:', err);
            }
        }

        function cloneVisualizerLayer(layer) {
            const normalized = normalizeVisualizerLayer(layer, (parseInt(layer.layer, 10) || 1) + 1);
            return {
                ...normalized,
                id: 'vis_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
                layer: (parseInt(layer.layer, 10) || 1) + 1,
                colors: Array.isArray(layer.colors) ? [...layer.colors].slice(0, 6) : ['#00d8ff', '#75b2de', '#000000', '#000000', '#000000', '#000000']
            };
        }

        function clampNumber(value, min, max, fallback = min) {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallback;
            return Math.min(max, Math.max(min, number));
        }

        function normalizeVisualizerLayer(layer = {}, fallbackLayerNumber = 1) {
            const base = createDefaultVisualizerLayer(fallbackLayerNumber);
            const colors = Array.isArray(layer.colors) ? layer.colors.map(sanitizeHexColor).slice(0, 6) : base.colors;
            while (colors.length < 6) colors.push('#000000');
            return {
                ...base,
                ...layer,
                id: layer.id || base.id,
                style: layer.style || base.style,
                layer: Math.max(1, parseInt(layer.layer, 10) || fallbackLayerNumber),
                blend: layer.blend || base.blend,
                gradient: ['horizontal', 'vertical', 'radial', 'random'].includes(layer.gradient) ? layer.gradient : base.gradient,
                align: ['left', 'center', 'right'].includes(layer.align) ? layer.align : base.align,
                hPosition: clampNumber(layer.hPosition ?? layer.positionH, -5, 5, 0),
                vPosition: clampNumber(layer.vPosition ?? layer.positionV, -5, 5, 0),
                amplitude: clampNumber(layer.amplitude, 0.25, 5, 1),
                spacing: clampNumber(layer.spacing, 0, 3, 0),
                rotate: [0, 90, 180, 270].includes(parseInt(layer.rotate, 10)) ? parseInt(layer.rotate, 10) : 0,
                flipH: Boolean(layer.flipH),
                flipV: Boolean(layer.flipV),
                randomize: Boolean(layer.randomize || layer.randomise || layer.randomizePoints),
                mirror: layer.mirror === false ? false : true,
                hidden: Boolean(layer.hidden),
                drawMode: ['fill', 'outline', 'line'].includes(layer.drawMode) ? layer.drawMode : base.drawMode,
                matrixCharacters: ['japanese', 'runes', 'alien'].includes(layer.matrixCharacters) ? layer.matrixCharacters : (layer.characterSet === 'runes' ? 'runes' : (layer.characterSet === 'alien' ? 'alien' : 'japanese')),
                matrixSpawn: ['default', 'center', 'semi', 'random'].includes(layer.matrixSpawn) ? layer.matrixSpawn : (layer.spawnPoint || 'default'),
                colors
            };
        }

        function sanitizeHexColor(value) {
            return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000';
        }

        function colorIsBlank(value) {
            const c = sanitizeHexColor(value).toLowerCase();
            return c === '#000000';
        }



        const MATRIX_CHARACTER_SETS = {
            japanese: 'ｦ ｧ ｨ ｩ ｪ ｫ ｬ ｭ ｮ ｯ ｱ ｲ ｳ ｴ ｵ ｶ ｷ ｸ ｹ ｺ ｻ ｼ ｽ ｾ ｿ'.split(/\s+/),
            runes: 'ᚠ ᚥ ᚦ ᚨ ᚩ ᚬ ᚱ ᚲ ᚷ ᚹ ᚺ ᚼ ᚾ ᛁ ᛃ ᛅ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛟ'.split(/\s+/),
            alien: '∀ ∁ ∂ ∃ ∄ ∅ ∇ ∈ ∉ ∋ ∌ ∏ ∐ ∑ ∝ ∞ ∟ ∠ ∡ ∢ ∧ ∨ ∩ ∪ ∫'.split(/\s+/)
        };

        const VISUAL_COLOR_PALETTE_GROUPS = [
            ['#d8a8cc', '#af63a5', '#a80084', '#79005b', '#50002f'],
            ['#d7a4b1', '#b05d78', '#a7002a', '#760016', '#520007'],
            ['#d8bea8', '#b37e62', '#a33f00', '#783d00', '#513000'],
            ['#e7d99a', '#c2a146', '#c38200', '#8b7800', '#585500'],
            ['#d0d9a8', '#a5ad63', '#78a000', '#446f00', '#234700'],
            ['#a8c8d9', '#6399ad', '#00669c', '#00436f', '#00264f'],
            ['#bca8d8', '#7c62ad', '#4b00a0', '#3d006f', '#2d004f']
        ];

        function buildVisualPaletteHtml(currentColor = '#00d8ff') {
            const swatches = [];
            swatches.push(`<button type="button" class="vis-palette-swatch blank-swatch" data-color="#000000" title="Blank / ignore this colour"></button>`);
            let swatchIndex = 0;
            VISUAL_COLOR_PALETTE_GROUPS.forEach(group => {
                group.forEach(color => {
                    swatches.push(`<button type="button" class="vis-palette-swatch vis-palette-swatch-${swatchIndex}" data-color="${color}" title="${color}"></button>`);
                    swatchIndex += 1;
                });
            });
            return `${swatches.join('')}<div class="visual-custom-color-row"><span>Custom colour</span><input type="color" class="vis-custom-color-input" value="${sanitizeHexColor(currentColor) === '#000000' ? '#00d8ff' : sanitizeHexColor(currentColor)}"></div>`;
        }

        function setVisualColorChip(chip, color) {
            const safe = sanitizeHexColor(color);
            chip.dataset.color = safe;
            chip.classList.add('visual-color-chip');
            chip.style.setProperty('--visual-chip-color', safe);
            chip.setAttribute('data-color', safe);
            chip.title = safe === '#000000' ? 'Blank / ignored' : safe;
        }

        function openVisualColorPalette(card, chip) {
            const palette = card.querySelector('.visual-color-palette');
            if (!palette || !chip) return;
            const wasOpenForSame = palette.dataset.colorIndex === chip.dataset.colorIndex && !palette.hidden;
            if (wasOpenForSame) {
                palette.hidden = true;
                palette.dataset.colorIndex = '';
                return;
            }
            palette.dataset.colorIndex = chip.dataset.colorIndex;
            palette.innerHTML = buildVisualPaletteHtml(chip.dataset.color || '#00d8ff');
            palette.hidden = false;
        }

        function getLayerColors(layer) {
            const colors = (layer.colors || []).map(sanitizeHexColor).filter(c => !colorIsBlank(c));
            return colors.length ? colors : ['#75b2de', '#e0a360', '#ff4fa3'];
        }

        let activeVisualLayerForDraw = null;

        function pickColor(colors, index, sample = null) {
            if (!colors || colors.length === 0) return '#75b2de';
            const layer = activeVisualLayerForDraw;
            const mode = layer?.gradient || 'horizontal';
            let pickedIndex = index;

            if (mode === 'vertical') {
                const level = sample === null ? (index % colors.length) / Math.max(1, colors.length - 1) : clampNumber(sample, 0, 1, 0);
                pickedIndex = Math.floor(level * Math.max(0, colors.length - 1));
            } else if (mode === 'radial') {
                const waveCount = 32;
                const distance = Math.abs((index % waveCount) - (waveCount / 2)) / (waveCount / 2);
                pickedIndex = Math.floor(distance * Math.max(0, colors.length - 1));
            } else if (mode === 'random') {
                pickedIndex = Math.abs(Math.floor(Math.sin((index + 1) * 91.345) * 10000));
            }

            return colors[Math.abs(pickedIndex) % colors.length];
        }

        function hexToRgba(hex, alpha = 1) {
            const clean = sanitizeHexColor(hex).slice(1);
            const r = parseInt(clean.slice(0, 2), 16);
            const g = parseInt(clean.slice(2, 4), 16);
            const b = parseInt(clean.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        function renderVisualizerPresetSelect() {
            if (!visualizerPresetSelect) return;
            const current = visualizerPresetSelect.value;
            visualizerPresetSelect.innerHTML = '<option value="">Load saved custom visualiser...</option>';
            Object.keys(savedVisualizerPresets).sort().forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = `⭐ ${name}`;
                visualizerPresetSelect.appendChild(option);
            });
            visualizerPresetSelect.value = current && savedVisualizerPresets[current] ? current : '';
        }

        function renderVisualizerLayerCards() {
            if (!visualizerLayerList) return;
            visualizerLayerList.innerHTML = '';
            visualizerLayers = visualizerLayers.map((layer, index) => normalizeVisualizerLayer(layer, index + 1));
            visualizerLayers
                .slice()
                .sort((a, b) => (parseInt(a.layer, 10) || 1) - (parseInt(b.layer, 10) || 1))
                .forEach((layer, index) => {
                    const card = document.createElement('div');
                    card.className = 'visual-layer-card';
                    if (layer.hidden) card.classList.add('is-hidden');
                    card.dataset.id = layer.id;

                    const safeColors = [...(layer.colors || [])];
                    while (safeColors.length < 6) safeColors.push('#000000');

                    card.innerHTML = `
                        <div class="visual-layer-head">
                            <span class="visual-layer-title">Equaliser Layer ${index + 1}${layer.hidden ? ' · hidden' : ''}</span>
                            <div class="visual-layer-actions">
                                <button class="tiny-icon-btn btn-hide-layer" title="Show/hide this layer">${layer.hidden ? '◎' : '◉'}</button>
                                <button class="tiny-icon-btn btn-remove-layer" title="Remove this layer">×</button>
                            </div>
                        </div>
                        <div class="visual-field">
                            <label>Wave style</label>
                            <select class="vis-layer-style">
                                <option value="bars">Classic Columns</option>
                                <option value="mountain">Smooth Mountain</option>
                                <option value="led">Retro LED Blocks</option>
                                <option value="symmetric">Pulse Burst</option>
                                <option value="waveline">Neon Waveform</option>
                                <option value="orbs">Orb Chain</option>
                                <option value="ribbon">Layered Ribbon</option>
                                <option value="heartbeat">Heartbeat Line</option>
                                <option value="pixelwave">Pixel Matrix</option>
                                <option value="islands">Floating Islands</option>
                                <option value="matrixcode">Matrix Code Rain</option>
                                <option value="comb">Comb Teeth Lines</option>
                                <option value="gridwarp">Warped Audio Grid</option>
                            </select>
                        </div>
                        <div>
                            <div class="composer-help composer-help-tight">Colours 1–6. Black = ignored / blank.</div>
                            <div class="visual-color-row">
                                ${safeColors.slice(0, 6).map((color, i) => `<button type="button" class="vis-color-chip vis-layer-color visual-color-chip" data-color-index="${i}" data-color="${sanitizeHexColor(color)}" title="Colour ${i + 1}; black means blank"></button>`).join('')}
                            </div>
                            <div class="visual-color-palette" hidden></div>
                        </div>
                        <div class="visual-grid-two">
                            <div class="visual-field">
                                <label>Layer</label>
                                <input type="number" class="vis-layer-order" min="1" max="99" step="1" value="${parseInt(layer.layer, 10) || 1}">
                            </div>
                            <div class="visual-field">
                                <label>Blend</label>
                                <select class="vis-layer-blend">
                                    <option value="source-over">Normal</option>
                                    <option value="lighter">Add Glow</option>
                                    <option value="screen">Screen</option>
                                    <option value="overlay">Overlay</option>
                                    <option value="soft-light">Soft Light</option>
                                    <option value="multiply">Multiply</option>
                                    <option value="color-dodge">Colour Dodge</option>
                                    <option value="difference">Difference</option>
                                </select>
                            </div>
                        </div>
                        <div class="visual-grid-two">
                            <div class="visual-field">
                                <label>Colour blend direction</label>
                                <select class="vis-layer-gradient">
                                    <option value="horizontal">Horizontal</option>
                                    <option value="vertical">Vertical / height</option>
                                    <option value="radial">Radial / centre</option>
                                    <option value="random">Random sparkle</option>
                                </select>
                            </div>
                            <div class="visual-field">
                                <label>Align wave</label>
                                <select class="vis-layer-align">
                                    <option value="left">Left</option>
                                    <option value="center">Centre</option>
                                    <option value="right">Right</option>
                                </select>
                            </div>
                        </div>
                        <div class="visual-grid-two">
                            <div class="visual-field">
                                <label>Position H</label>
                                <input type="number" class="vis-layer-hpos" min="-5" max="5" step="1" value="${clampNumber(layer.hPosition, -5, 5, 0)}">
                            </div>
                            <div class="visual-field">
                                <label>Position V</label>
                                <input type="number" class="vis-layer-vpos" min="-5" max="5" step="1" value="${clampNumber(layer.vPosition, -5, 5, 0)}">
                            </div>
                        </div>
                        <div class="visual-grid-two">
                            <div class="visual-field">
                                <label>Rotate</label>
                                <select class="vis-layer-rotate">
                                    <option value="0">0°</option>
                                    <option value="90">90°</option>
                                    <option value="180">180°</option>
                                    <option value="270">270°</option>
                                </select>
                            </div>
                            <div class="visual-field">
                                <label>Draw mode</label>
                                <select class="vis-layer-drawmode">
                                    <option value="fill">Solid fill</option>
                                    <option value="outline">Outline only</option>
                                    <option value="line">Thin line / comb</option>
                                </select>
                            </div>
                        </div>
                        <div class="matrix-extra-settings">
                            <div class="visual-field">
                                <label>Characters</label>
                                <select class="vis-layer-matrix-chars">
                                    <option value="japanese">Japanese</option>
                                    <option value="runes">Runes</option>
                                    <option value="alien">Alien</option>
                                </select>
                            </div>
                            <div class="visual-check-row matrix-spawn-row">
                                <span class="spawn-point-label">Spawn point</span>
                                <label><input type="radio" class="vis-layer-matrix-spawn" name="matrix-spawn-${layer.id}" value="default" ${layer.matrixSpawn === 'default' ? 'checked' : ''}> Default</label>
                                <label><input type="radio" class="vis-layer-matrix-spawn" name="matrix-spawn-${layer.id}" value="center" ${layer.matrixSpawn === 'center' ? 'checked' : ''}> Center Circle</label>
                                <label><input type="radio" class="vis-layer-matrix-spawn" name="matrix-spawn-${layer.id}" value="semi" ${layer.matrixSpawn === 'semi' ? 'checked' : ''}> Semi Circle</label>
                                <label><input type="radio" class="vis-layer-matrix-spawn" name="matrix-spawn-${layer.id}" value="random" ${layer.matrixSpawn === 'random' ? 'checked' : ''}> Random</label>
                            </div>
                        </div>
                        <div class="visual-field">
                            <label>Amplitude multiplier</label>
                            <div class="visual-range-row">
                                <input type="range" class="vis-layer-amplitude" min="0.25" max="5" step="0.05" value="${clampNumber(layer.amplitude, 0.25, 5, 1)}">
                                <span class="visual-range-readout vis-layer-amplitude-readout">${clampNumber(layer.amplitude, 0.25, 5, 1).toFixed(2)}×</span>
                            </div>
                        </div>
                        <div class="visual-field">
                            <label>Spacing</label>
                            <div class="visual-range-row">
                                <input type="range" class="vis-layer-spacing" min="0" max="3" step="0.1" value="${clampNumber(layer.spacing, 0, 3, 0)}">
                                <span class="visual-range-readout vis-layer-spacing-readout">${clampNumber(layer.spacing, 0, 3, 0).toFixed(1)}</span>
                            </div>
                        </div>
                        <div class="visual-check-row">
                            <label><input type="checkbox" class="vis-layer-mirror" ${layer.mirror !== false ? 'checked' : ''}> Mirror</label>
                            <label><input type="checkbox" class="vis-layer-fliph" ${layer.flipH ? 'checked' : ''}> Flip H</label>
                            <label><input type="checkbox" class="vis-layer-flipv" ${layer.flipV ? 'checked' : ''}> Flip V</label>
                            <label><input type="checkbox" class="vis-layer-randomize" ${layer.randomize ? 'checked' : ''}> Randomise</label>
                        </div>
                        <div class="visual-layer-footer">
                            <button class="tiny-icon-btn btn-duplicate-layer" title="Duplicate this layer below">＋</button>
                            <button class="btn-pill btn-save-visual-stack" title="Save current visualiser stack">💾 Save</button>
                        </div>
                    `;

                    visualizerLayerList.appendChild(card);
                    card.querySelectorAll('.vis-layer-color').forEach((chip, i) => setVisualColorChip(chip, safeColors[i] || '#000000'));
                    card.querySelector('.vis-layer-style').value = layer.style || 'bars';
                    card.querySelector('.vis-layer-blend').value = layer.blend || 'source-over';
                    card.querySelector('.vis-layer-gradient').value = layer.gradient || 'horizontal';
                    card.querySelector('.vis-layer-align').value = layer.align || 'center';
                    card.querySelector('.vis-layer-rotate').value = String(layer.rotate || 0);
                    card.querySelector('.vis-layer-drawmode').value = layer.drawMode || 'fill';
                    card.querySelector('.vis-layer-matrix-chars').value = layer.matrixCharacters || 'japanese';
                    updateMatrixExtraVisibility(card);
                });
        }


        function updateMatrixExtraVisibility(card) {
            const style = card?.querySelector('.vis-layer-style')?.value || '';
            if (card) card.classList.toggle('matrix-active', style === 'matrixcode');
        }

        function syncVisualizerLayerFromCard(card) {
            const layer = visualizerLayers.find(item => item.id === card.dataset.id);
            if (!layer) return;
            layer.style = card.querySelector('.vis-layer-style')?.value || 'bars';
            layer.layer = Math.max(1, parseInt(card.querySelector('.vis-layer-order')?.value, 10) || 1);
            layer.blend = card.querySelector('.vis-layer-blend')?.value || 'source-over';
            layer.gradient = card.querySelector('.vis-layer-gradient')?.value || 'horizontal';
            layer.align = card.querySelector('.vis-layer-align')?.value || 'center';
            layer.hPosition = clampNumber(card.querySelector('.vis-layer-hpos')?.value, -5, 5, 0);
            layer.vPosition = clampNumber(card.querySelector('.vis-layer-vpos')?.value, -5, 5, 0);
            layer.rotate = parseInt(card.querySelector('.vis-layer-rotate')?.value, 10) || 0;
            layer.drawMode = card.querySelector('.vis-layer-drawmode')?.value || 'fill';
            layer.matrixCharacters = card.querySelector('.vis-layer-matrix-chars')?.value || 'japanese';
            layer.matrixSpawn = card.querySelector('.vis-layer-matrix-spawn:checked')?.value || 'default';
            updateMatrixExtraVisibility(card);
            layer.amplitude = clampNumber(card.querySelector('.vis-layer-amplitude')?.value, 0.25, 5, 1);
            layer.spacing = clampNumber(card.querySelector('.vis-layer-spacing')?.value, 0, 3, 0);
            layer.mirror = Boolean(card.querySelector('.vis-layer-mirror')?.checked);
            layer.flipH = Boolean(card.querySelector('.vis-layer-fliph')?.checked);
            layer.flipV = Boolean(card.querySelector('.vis-layer-flipv')?.checked);
            layer.randomize = Boolean(card.querySelector('.vis-layer-randomize')?.checked);
            layer.colors = Array.from(card.querySelectorAll('.vis-layer-color')).map(chip => sanitizeHexColor(chip.dataset.color || chip.value));
            const ampReadout = card.querySelector('.vis-layer-amplitude-readout');
            if (ampReadout) ampReadout.textContent = `${layer.amplitude.toFixed(2)}×`;
            const spacingReadout = card.querySelector('.vis-layer-spacing-readout');
            if (spacingReadout) spacingReadout.textContent = `${layer.spacing.toFixed(1)}`;
            visualizerStyle = layer.style;
            saveActiveVisualizerStack();
        }

        function saveCurrentVisualizerStack() {
            const name = prompt('Name this custom visualiser stack:');
            if (!name || !name.trim()) return;
            const cleanedName = name.trim();
            savedVisualizerPresets[cleanedName] = {
                name: cleanedName,
                savedAt: new Date().toISOString(),
                layers: visualizerLayers.map((layer, index) => {
                    const normal = normalizeVisualizerLayer(layer, index + 1);
                    return {
                        style: normal.style,
                        layer: normal.layer,
                        blend: normal.blend,
                        gradient: normal.gradient,
                        align: normal.align,
                        hPosition: normal.hPosition,
                        vPosition: normal.vPosition,
                        amplitude: normal.amplitude,
                        spacing: normal.spacing,
                        rotate: normal.rotate,
                        flipH: normal.flipH,
                        flipV: normal.flipV,
                        randomize: normal.randomize,
                        mirror: normal.mirror,
                        hidden: normal.hidden,
                        drawMode: normal.drawMode,
                        matrixCharacters: normal.matrixCharacters,
                        matrixSpawn: normal.matrixSpawn,
                        colors: (normal.colors || []).map(sanitizeHexColor).slice(0, 6)
                    };
                })
            };
            saveVisualizerPresets();
            saveActiveVisualizerStack();
            renderVisualizerPresetSelect();
            showToast(`Saved visualiser: ${cleanedName}`);
        }

        function loadVisualizerPreset(name) {
            const preset = savedVisualizerPresets[name];
            if (!preset || !Array.isArray(preset.layers)) return;
            visualizerLayers = preset.layers.map((layer, index) => ({
                ...normalizeVisualizerLayer(layer, index + 1),
                id: 'vis_' + Date.now().toString(36) + '_' + index + '_' + Math.random().toString(36).slice(2, 5)
            }));
            if (visualizerLayers.length === 0) visualizerLayers = [createDefaultVisualizerLayer(1)];
            renderVisualizerLayerCards();
            saveActiveVisualizerStack();
            showToast(`Loaded visualiser: ${name}`);
        }

        function initVisualizerComposerUI() {
            renderVisualizerPresetSelect();
            renderVisualizerLayerCards();

            if (visualizerLayerList) {
                visualizerLayerList.addEventListener('input', (e) => {
                    const card = e.target.closest('.visual-layer-card');
                    if (!card) return;
                    if (e.target.classList.contains('vis-custom-color-input')) {
                        const palette = e.target.closest('.visual-color-palette');
                        const chip = card.querySelector(`.vis-color-chip[data-color-index="${palette?.dataset.colorIndex}"]`);
                        if (chip) setVisualColorChip(chip, e.target.value || '#00d8ff');
                    }
                    syncVisualizerLayerFromCard(card);
                });
                visualizerLayerList.addEventListener('change', (e) => {
                    const card = e.target.closest('.visual-layer-card');
                    if (card) syncVisualizerLayerFromCard(card);
                    saveLocalUiStateCheckpoint('visualiser-field-change');
                });
                visualizerLayerList.addEventListener('focusout', (e) => {
                    const card = e.target.closest('.visual-layer-card');
                    if (card) syncVisualizerLayerFromCard(card);
                    saveLocalUiStateCheckpoint('visualiser-field-blur');
                });
                visualizerLayerList.addEventListener('click', (e) => {
                    const card = e.target.closest('.visual-layer-card');
                    if (!card) return;
                    const layer = visualizerLayers.find(item => item.id === card.dataset.id);
                    if (!layer) return;

                    if (e.target.classList.contains('vis-color-chip')) {
                        e.preventDefault();
                        openVisualColorPalette(card, e.target);
                        return;
                    }

                    if (e.target.classList.contains('vis-palette-swatch')) {
                        e.preventDefault();
                        const palette = e.target.closest('.visual-color-palette');
                        const chip = card.querySelector(`.vis-color-chip[data-color-index="${palette?.dataset.colorIndex}"]`);
                        if (chip) {
                            setVisualColorChip(chip, e.target.dataset.color || '#000000');
                            syncVisualizerLayerFromCard(card);
                        }
                        if (palette) palette.hidden = true;
                        return;
                    }

                    if (e.target.classList.contains('btn-hide-layer')) {
                        syncVisualizerLayerFromCard(card);
                        layer.hidden = !layer.hidden;
                        saveActiveVisualizerStack();
                        renderVisualizerLayerCards();
                        return;
                    }

                    if (e.target.classList.contains('btn-remove-layer')) {
                        if (visualizerLayers.length <= 1) {
                            showToast('Keep at least one visualiser layer.');
                            return;
                        }
                        visualizerLayers = visualizerLayers.filter(item => item.id !== layer.id);
                        saveActiveVisualizerStack();
                        renderVisualizerLayerCards();
                    }

                    if (e.target.classList.contains('btn-duplicate-layer')) {
                        syncVisualizerLayerFromCard(card);
                        visualizerLayers.push(cloneVisualizerLayer(layer));
                        saveActiveVisualizerStack();
                        renderVisualizerLayerCards();
                    }

                    if (e.target.classList.contains('btn-save-visual-stack')) {
                        syncVisualizerLayerFromCard(card);
                        saveCurrentVisualizerStack();
                    }
                });
            }

            if (btnSaveVisualStackMain) {
                btnSaveVisualStackMain.addEventListener('click', () => {
                    document.querySelectorAll('.visual-layer-card').forEach(card => syncVisualizerLayerFromCard(card));
                    saveCurrentVisualizerStack();
                });
            }

            if (btnAddVisualLayer) {
                btnAddVisualLayer.addEventListener('click', () => {
                    const lastLayer = visualizerLayers[visualizerLayers.length - 1] || createDefaultVisualizerLayer(1);
                    visualizerLayers.push(cloneVisualizerLayer(lastLayer));
                    saveActiveVisualizerStack();
                    renderVisualizerLayerCards();
                });
            }

            if (visualizerPresetSelect) {
                visualizerPresetSelect.addEventListener('change', (e) => {
                    if (e.target.value) loadVisualizerPreset(e.target.value);
                });
            }
        }

        function createTrackIdFromParts(parts) {
            const input = parts.filter(Boolean).join('|');
            let hash = 2166136261;
            for (let i = 0; i < input.length; i++) {
                hash ^= input.charCodeAt(i);
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            }
            return 'trk_' + (hash >>> 0).toString(36);
        }

        function createPlayableTrackFromMeta(meta) {
            return {
                name: meta.id,
                libraryId: meta.id,
                fileName: meta.fileName || meta.title || meta.id,
                sourceType: meta.sourceType || (meta.streamUrl ? 'stream' : 'local'),
                streamUrl: meta.streamUrl || null,
                blobFile: meta.blobFile || null,
                needsRelink: (meta.sourceType !== 'stream' && !meta.blobFile)
            };
        }

        function sanitizeTrackForExport(meta) {
            const copy = { ...meta };
            delete copy.blobFile;
            return copy;
        }

        function normalisePlaylistToIds(value) {
            if (Array.isArray(value)) {
                return value.map(item => typeof item === 'string' ? item : item.name || item.libraryId || item.id).filter(Boolean);
            }
            if (value && Array.isArray(value.trackIds)) return value.trackIds.filter(Boolean);
            if (value && Array.isArray(value.tracks)) return value.tracks.map(item => typeof item === 'string' ? item : item.name || item.libraryId || item.id).filter(Boolean);
            return [];
        }

        function playlistIdsToTrackObjects(trackIds) {
            return trackIds
                .map(id => virtualLibrary[id] ? createPlayableTrackFromMeta(virtualLibrary[id]) : null)
                .filter(Boolean);
        }

        function getTrackId(trackLike) {
            return typeof trackLike === 'string' ? trackLike : (trackLike?.name || trackLike?.libraryId || trackLike?.id || null);
        }

        function getTrackPlaylistNames(trackId) {
            return Object.entries(playlists)
                .filter(([, tracks]) => Array.isArray(tracks) && tracks.some(track => getTrackId(track) === trackId))
                .map(([name]) => name);
        }

        function ensurePlaylistMeta(name) {
            if (!playlistMeta[name]) playlistMeta[name] = { imageUrl: '', imageData: '', description: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            if (!playlistMeta[name].createdAt) playlistMeta[name].createdAt = new Date().toISOString();
            return playlistMeta[name];
        }
        const STARTER_PLAYLIST_NAMES_TO_PURGE = new Set(['Favorites', 'Favourites', 'Chill Vocals', 'Work Focus']);

        function purgeEmptyStarterPlaylists() {
            let changed = false;
            STARTER_PLAYLIST_NAMES_TO_PURGE.forEach(name => {
                if (!Object.prototype.hasOwnProperty.call(playlists, name)) return;
                const trackIds = normalisePlaylistToIds(playlists[name]);
                const meta = playlistMeta[name] || {};
                const hasCustomMeta = Boolean(meta.imageUrl || meta.imageData || meta.description);
                if (trackIds.length === 0 && !hasCustomMeta) {
                    delete playlists[name];
                    delete playlistMeta[name];
                    if (activePlaylistView === name) activePlaylistView = null;
                    changed = true;
                }
            });
            return changed;
        }



        function getDefaultArtworkSrc() {
            return 'placeholder.jpg';
        }

        function imageHtmlOrFallback(src, altText = 'Artwork') {
            const safeSrc = escapeHtml(src || getDefaultArtworkSrc());
            const safeAlt = escapeHtml(altText || 'Artwork');
            return `<img src="${safeSrc}" alt="${safeAlt}" onerror="this.onerror=null;this.parentElement.textContent='NO IMAGE';">`;
        }

        function getPlaylistArtwork(name) {
            const meta = ensurePlaylistMeta(name);
            return meta.imageData || meta.imageUrl || '';
        }

        function playlistThumbHtml(name, large = false) {
            const art = getPlaylistArtwork(name);
            const initials = (name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '▤';
            const className = large ? 'playlist-thumb-large' : 'playlist-thumb';
            return `<div class="${className}">${imageHtmlOrFallback(art || getDefaultArtworkSrc(), `${name} artwork`) }</div>`;
        }

        function getTrackArtwork(meta) {
            if (!meta) return '';
            if (meta.imageData || meta.imageUrl) return meta.imageData || meta.imageUrl;
            const firstPlaylist = getTrackPlaylistNames(meta.id)[0];
            return firstPlaylist ? getPlaylistArtwork(firstPlaylist) : '';
        }

        function addTrackIdToPlaylist(trackId, playlistName) {
            if (!trackId || !virtualLibrary[trackId] || !playlistName) return false;
            if (!playlists[playlistName]) playlists[playlistName] = [];
            ensurePlaylistMeta(playlistName);
            const exists = playlists[playlistName].some(track => getTrackId(track) === trackId);
            if (!exists) playlists[playlistName].push(createPlayableTrackFromMeta(virtualLibrary[trackId]));
            syncTrackPlaylistMetadata(trackId);
            return !exists;
        }

        function removeTrackIdFromAllPlaylists(trackId) {
            Object.keys(playlists).forEach(name => {
                playlists[name] = normalisePlaylistToIds(playlists[name])
                    .filter(id => id !== trackId)
                    .map(id => virtualLibrary[id] ? createPlayableTrackFromMeta(virtualLibrary[id]) : id);
            });
        }

        function syncTrackPlaylistMetadata(trackId) {
            if (!trackId || !virtualLibrary[trackId]) return;
            virtualLibrary[trackId].playlists = getTrackPlaylistNames(trackId);
        }

        function syncAllTrackPlaylistMetadata() {
            Object.keys(virtualLibrary).forEach(syncTrackPlaylistMetadata);
        }

        function loadRecentTrackIds() {
            try {
                const parsed = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
                return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 50) : [];
            } catch (err) {
                console.warn('Could not load Onda history:', err);
                return [];
            }
        }

        function saveRecentTrackIds() {
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(recentTrackIds.slice(0, 50)));
                if (typeof saveActiveLibraryState === 'function') saveActiveLibraryState('history-update');
            } catch (err) {
                console.warn('Could not save Onda history:', err);
            }
        }

        function rememberRecentTrack(trackId) {
            if (!trackId) return;
            const existingIndex = recentTrackIds.indexOf(trackId);
            if (existingIndex !== -1) recentTrackIds.splice(existingIndex, 1);
            recentTrackIds.unshift(trackId);
            while (recentTrackIds.length > 50) recentTrackIds.pop();
            saveRecentTrackIds();
            renderHistoryTab();
        }

        function getDisplayTitle(meta) {
            return meta?.nickname || meta?.title || meta?.fileName || meta?.id || 'Unknown Track';
        }

        function sourceStatus(meta) {
            if (!meta) return 'unknown';
            if (meta.sourceType === 'stream' || meta.streamUrl) return 'stream';
            if (meta.sourceType === 'midi') return meta.blobFile ? 'MIDI ready' : 'MIDI needs relink';
            if (meta.blobFile) return 'local ready';
            return 'needs relink';
        }

        function addTrackToQueueFromLibrary(trackId, playNow = true) {
            const meta = virtualLibrary[trackId];
            if (!meta) return;
            const track = createPlayableTrackFromMeta(meta);
            const existingIndex = playlistTracks.findIndex(item => getTrackId(item) === trackId);
            if (existingIndex === -1) {
                playlistTracks.push(track);
                if (playNow) switchTrack(playlistTracks.length - 1);
            } else if (playNow) {
                switchTrack(existingIndex);
            }
            showToast(`Queued: ${getDisplayTitle(meta)}`);
        }

        function buildTrackRow(trackId, compact = false) {
            const meta = virtualLibrary[trackId];
            if (!meta) return null;
            const row = document.createElement('div');
            row.className = compact ? 'library-mini-row' : 'library-result-row';
            if (!compact && selectedLibraryIds.has(trackId)) row.classList.add('selected');
            row.dataset.trackId = trackId;
            const playlistsForTrack = getTrackPlaylistNames(trackId);
            const tags = Array.isArray(meta.tags) ? meta.tags.slice(0, compact ? 2 : 6) : [];
            const selectIndicator = (!compact)
                ? `<span class="selection-indicator">${selectedLibraryIds.has(trackId) ? '✓' : ''}</span>`
                : '';
            row.innerHTML = `
                <div class="library-row-main">
                    ${selectIndicator}
                    <div class="library-track-text-wrap">
                        <div class="library-track-title">${escapeHtml(getDisplayTitle(meta))}</div>
                        <div class="library-track-meta library-file-line">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>
                        ${compact ? '' : `<div class="library-track-meta library-playlist-line">${escapeHtml(playlistsForTrack.length ? playlistsForTrack.join(' / ') : 'No playlist assigned')}</div>`}
                    </div>
                    ${compact ? '' : `<div class="library-row-buttons"><button class="btn-pill btn-db-play-track" data-track-id="${trackId}" title="Play">▶️</button><button class="btn-pill btn-db-info-track" data-track-id="${trackId}" title="Info">ℹ️</button><button class="btn-pill btn-onda-add-playlist" data-track-id="${trackId}" title="Add to playlist">➕</button></div>`}
                </div>
                ${tags.length ? `<div class="library-row-tags">${tags.map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            `;
            return row;
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function buildHistorySquareCard(trackId, index) {
            const meta = virtualLibrary[trackId];
            if (!meta) return null;
            const playlistsForTrack = getTrackPlaylistNames(trackId);
            const tags = Array.isArray(meta.tags) ? meta.tags.slice(0, 2) : [];
            const card = document.createElement('div');
            card.className = 'history-square-card';
            card.dataset.historyTrackId = trackId;
            card.title = 'Play this recent track';
            card.innerHTML = `
                <div class="history-card-index">${index + 1}</div>
                <div class="history-card-title">${escapeHtml(getDisplayTitle(meta))}</div>
                <div>
                    <div class="history-card-meta">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>
                    ${playlistsForTrack.length ? `<div class="history-card-meta">${escapeHtml(playlistsForTrack.slice(0, 2).join(' / '))}</div>` : ''}
                    ${tags.length ? `<div class="library-row-tags">${tags.map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                </div>
            `;
            return card;
        }

        function buildHistoryListRow(trackId, index) {
            const meta = virtualLibrary[trackId];
            if (!meta) return null;
            const row = document.createElement('div');
            row.className = 'library-result-row history-list-row';
            row.dataset.historyTrackId = trackId;
            const tags = Array.isArray(meta.tags) ? meta.tags.slice(0, 4) : [];
            row.innerHTML = `
                <div class="history-list-number">${index + 1}</div>
                <div class="onda-track-text-wrap">
                    <div class="library-track-title">${escapeHtml(getDisplayTitle(meta))}</div>
                    <div class="library-track-meta">${escapeHtml(meta.fileName || meta.id)} · ${escapeHtml(sourceStatus(meta))}</div>
                    ${tags.length ? `<div class="library-row-tags">${tags.map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                </div>
                <div class="library-row-buttons">
                    <button class="btn-pill btn-history-play btn-onda-row-play" data-track-id="${trackId}">Play</button>
                    <button class="btn-pill btn-history-info" data-track-id="${trackId}">Info</button>
                    <button class="btn-pill btn-onda-add-playlist" data-track-id="${trackId}">+ Playlist</button>
                </div>
            `;
            return row;
        }

        function renderHistoryTab() {
            const validHistory = recentTrackIds.filter(id => virtualLibrary[id]).slice(0, 50);

            if (historyList) {
                historyList.innerHTML = '';
                if (!validHistory.length) {
                    historyList.innerHTML = '<div class="library-track-meta">No recent tracks yet. Play a file, stream, or playlist track and it will appear here.</div>';
                } else {
                    validHistory.forEach((id, index) => {
                        const row = buildHistoryListRow(id, index);
                        if (row) historyList.appendChild(row);
                    });
                }
            }
        }

        function handleHistoryTrackClick(e) {
            const target = e.target.closest('[data-history-track-id]');
            const trackId = e.target.dataset.trackId || target?.dataset.historyTrackId;
            if (!trackId || !virtualLibrary[trackId]) return;

            if (e.target.classList.contains('btn-history-info')) {
                currentFile = createPlayableTrackFromMeta(virtualLibrary[trackId]);
                currentFile.name = trackId;
                switchWorkspaceTab('tab-library');
                updateMetadataUI();
                return;
            }

            addTrackToQueueFromLibrary(trackId, true);
        }

        function updateBulkActionUI() {
            if (btnDbSelectMode) btnDbSelectMode.textContent = isLibrarySelectMode ? 'Exit Select' : 'Select Multiple';
            if (dbBulkActions) dbBulkActions.classList.toggle('bulk-open', isLibrarySelectMode);
            if (dbSelectionSummary) dbSelectionSummary.textContent = `${selectedLibraryIds.size} selected`;

            const dbPlaylistStrip = document.getElementById('db-playlist-strip');
            if (dbPlaylistStrip) {
                const names = Object.keys(playlists).sort();
                dbPlaylistStrip.innerHTML = `
                    <div class="library-playlist-strip-title">Playlists</div>
                    <div class="library-playlist-strip-grid">
                        ${names.length ? names.map(name => {
                            ensurePlaylistMeta(name);
                            const isActive = activePlaylistView === name;
                            return `<div class="library-playlist-shortcut ${isActive ? 'active' : ''}" data-playlist-name="${escapeHtml(name)}">
                                <div>
                                    <div class="library-track-title">${escapeHtml(name)}</div>
                                    <div class="library-track-meta">${normalisePlaylistToIds(playlists[name] || []).length} tracks</div>
                                </div>
                                <button type="button" class="btn-pill btn-library-view-playlist" data-playlist-name="${escapeHtml(name)}">${isActive ? 'Viewing' : 'View'}</button>
                            </div>`;
                        }).join('') : '<div class="library-track-meta">No playlists yet.</div>'}
                    </div>
                `;
                dbPlaylistStrip.querySelectorAll('[data-playlist-name]').forEach(item => {
                    item.addEventListener('click', () => {
                        const name = item.dataset.playlistName;
                        if (!name) return;
                        activePlaylistView = name;
                        renderPlaylistsList();
                        renderLibraryManager();
                    });
                });
            }

        }

        function toggleLibrarySelectMode(force = null) {
            isLibrarySelectMode = false;
            setLibraryActionPanel('select');
            updateBulkActionUI();
            renderLibraryManager();
        }

        function setLibraryActionPanel(action = 'select') {
            const safeAction = action === 'settings' ? 'settings' : 'select';
            document.querySelectorAll('[data-library-action-panel]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.libraryActionPanel === safeAction);
            });
            document.querySelectorAll('[data-library-action-section]').forEach(section => {
                section.classList.toggle('active', section.dataset.libraryActionSection === safeAction);
            });
            try { localStorage.setItem('ondaLibraryActionPanel', safeAction); } catch (err) {}
        }

        function toggleSelectedTrack(trackId) {
            if (!trackId || !virtualLibrary[trackId]) return;
            if (selectedLibraryIds.has(trackId)) selectedLibraryIds.delete(trackId);
            else selectedLibraryIds.add(trackId);
            updateBulkActionUI();
            renderLibraryManager();
        }

        function getSelectedTrackIds() {
            return Array.from(selectedLibraryIds).filter(id => virtualLibrary[id]);
        }

        function requireSelection() {
            const ids = getSelectedTrackIds();
            if (!ids.length) {
                showToast('Select at least one library item first.');
                return [];
            }
            return ids;
        }

        function exportSelectedLibraryJson() {
            const ids = requireSelection();
            if (!ids.length) return;
            const tracks = {};
            ids.forEach(id => { tracks[id] = sanitizeTrackForExport(virtualLibrary[id]); });
            const idSet = new Set(ids);
            const selectedPlaylists = {};
            Object.entries(playlists).forEach(([name, value]) => {
                const contained = normalisePlaylistToIds(value).filter(id => idSet.has(id));
                if (contained.length) {
                    selectedPlaylists[name] = { name, ...(playlistMeta[name] || {}), trackIds: contained };
                }
            });
            const data = {
                app: 'Onda Media Player',
                type: 'onda-library',
                version: 1,
                libraryName: `${(libraryNameInput?.value || 'Onda Library').trim() || 'Onda Library'} — selected`,
                libraryKind: 'selected-export',
                exportedAt: new Date().toISOString(),
                tracks,
                playlists: selectedPlaylists,
                playlistMeta,
                visualizerPresets: savedVisualizerPresets
            };
            downloadJsonFile(`${slugifyFileName(data.libraryName)}.json`, data);
            showToast(`Exported ${ids.length} selected tracks.`);
        }

        function openBulkAddPlaylistModal() {
            const ids = requireSelection();
            if (!ids.length) return;
            const count = document.getElementById('bulk-add-count');
            const list = document.getElementById('bulk-playlist-checklist');
            const newInput = document.getElementById('input-bulk-new-playlist');
            if (count) count.textContent = `${ids.length} tracks selected.`;
            if (newInput) newInput.value = '';
            if (list) {
                list.innerHTML = '';
                Object.keys(playlists).sort().forEach(name => {
                    const label = document.createElement('label');
                    label.innerHTML = `<input type="checkbox" value="${escapeHtml(name)}"> <span>${escapeHtml(name)}</span>`;
                    list.appendChild(label);
                });
                if (!Object.keys(playlists).length) list.innerHTML = '<div class="library-track-meta">No playlists yet. Type a new one below.</div>';
            }
            showModal('modal-bulk-add-playlist');
        }

        function applyBulkPlaylistAdd() {
            const ids = requireSelection();
            if (!ids.length) return;
            const checked = Array.from(document.querySelectorAll('#bulk-playlist-checklist input[type="checkbox"]:checked')).map(cb => cb.value);
            const newName = (document.getElementById('input-bulk-new-playlist')?.value || '').trim();
            const targets = [...checked];
            if (newName) {
                if (!playlists[newName]) playlists[newName] = [];
                ensurePlaylistMeta(newName);
                targets.push(newName);
            }
            if (!targets.length) { showToast('Choose or create a playlist first.'); return; }
            let added = 0;
            ids.forEach(id => targets.forEach(name => { if (addTrackIdToPlaylist(id, name)) added++; }));
            syncAllTrackPlaylistMetadata();
            closeModal('modal-bulk-add-playlist');
            renderPlaylistsList();
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            showToast(`Added ${ids.length} tracks to ${targets.length} playlist(s).`);
        }

        function createPlaylistForSelected() {
            const ids = requireSelection();
            if (!ids.length) return;
            const name = prompt('New playlist name:');
            if (!name || !name.trim()) return;
            const clean = name.trim();
            if (!playlists[clean]) playlists[clean] = [];
            ensurePlaylistMeta(clean);
            ids.forEach(id => addTrackIdToPlaylist(id, clean));
            renderPlaylistsList();
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            showToast(`Created playlist and added ${ids.length} tracks: ${clean}`);
        }

        function openBulkAttributesModal() {
            const ids = requireSelection();
            if (!ids.length) return;
            const count = document.getElementById('bulk-attribute-count');
            if (count) count.textContent = `${ids.length} tracks selected.`;
            const addInput = document.getElementById('input-bulk-add-tags');
            const removeInput = document.getElementById('input-bulk-remove-tags');
            if (addInput) addInput.value = '';
            if (removeInput) removeInput.value = '';
            showModal('modal-bulk-attributes');
        }

        function parseCommaTags(value) {
            return (value || '').split(',').map(tag => tag.trim()).filter(Boolean);
        }

        function applyBulkAttributes() {
            const ids = requireSelection();
            if (!ids.length) return;
            const addTags = parseCommaTags(document.getElementById('input-bulk-add-tags')?.value || '');
            const removeTags = parseCommaTags(document.getElementById('input-bulk-remove-tags')?.value || '').map(t => t.toLowerCase());
            if (!addTags.length && !removeTags.length) { showToast('No tag changes entered.'); return; }
            ids.forEach(id => {
                const meta = virtualLibrary[id];
                const current = Array.isArray(meta.tags) ? meta.tags.slice() : [];
                const lowerSet = new Set(current.map(tag => tag.toLowerCase()));
                addTags.forEach(tag => { if (!lowerSet.has(tag.toLowerCase())) current.push(tag); });
                const filtered = current.filter(tag => !removeTags.includes(tag.toLowerCase()));
                meta.tags = filtered;
            });
            closeModal('modal-bulk-attributes');
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            showToast(`Updated tags on ${ids.length} tracks.`);
        }

        function deleteSelectedFromLibrary() {
            const ids = requireSelection();
            if (!ids.length) return;
            const ok = confirm(`Remove ${ids.length} selected track listing(s) from the library JSON? This does not delete actual music files.`);
            if (!ok) return;
            ids.forEach(id => {
                delete virtualLibrary[id];
                removeTrackIdFromAllPlaylists(id);
            });
            playlistTracks = playlistTracks.filter(track => !selectedLibraryIds.has(getTrackId(track)));
            recentTrackIds = recentTrackIds.filter(id => !selectedLibraryIds.has(id));
            if (currentFile && selectedLibraryIds.has(currentFile.name)) {
                pauseAudio();
                currentFile = null;
                document.getElementById('now-playing').innerText = 'No Track Loaded';
                document.getElementById('track-nickname-label').innerText = '';
            }
            selectedLibraryIds.clear();
            updateBulkActionUI();
            renderPlaylistsList();
            renderLibraryManager();
            renderHistoryTab();
            showToast('Selected library listing(s) removed.');
        }

        function levenshteinDistance(a, b, limit = 2) {
            if (a === b) return 0;
            if (!a || !b) return Math.max(a.length, b.length);
            if (Math.abs(a.length - b.length) > limit) return limit + 1;
            let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
            for (let i = 1; i <= a.length; i++) {
                const curr = [i];
                let rowMin = curr[0];
                for (let j = 1; j <= b.length; j++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
                    curr[j] = val;
                    rowMin = Math.min(rowMin, val);
                }
                if (rowMin > limit) return limit + 1;
                prev = curr;
            }
            return prev[b.length];
        }

        function matchesLibrarySearch(haystack, search) {
            if (!search) return true;
            if (haystack.includes(search)) return true;
            const fuzz = Math.max(0, Math.min(4, librarySearchFuzziness || 0));
            if (!fuzz) return false;
            const hayTokens = haystack.split(/[^a-z0-9]+/i).filter(Boolean);
            const terms = search.split(/\s+/).filter(Boolean);
            return terms.every(term => {
                if (term.length <= 2) return haystack.includes(term);
                return hayTokens.some(token => {
                    if (token.includes(term) || term.includes(token)) return true;
                    if (Math.abs(token.length - term.length) > fuzz) return false;
                    return levenshteinDistance(token, term, fuzz) <= fuzz;
                });
            });
        }

        const MOBILE_DB_ICON_DEFINITIONS = [
            { key: 'results', icon: '🔎', label: 'Results', description: 'Shows the current library search results.' },
            { key: 'recents', icon: '🕘', label: 'Recents', description: 'Shows the most recently played or loaded tracks.' },
            { key: 'playlists', icon: '📜', label: 'Playlists', description: 'Shows saved playlists and playlist edit controls.' },
            { key: 'help', icon: '?', label: 'Icon Guide', description: 'Explains these mobile buttons and lets you change their display symbols.' },
            { key: 'select', icon: '☑️', label: 'Select Multiple', description: 'Turns on multi-select for bulk playlist/tag/library actions.' },
            { key: 'saveLocal', icon: '💾', label: 'Save Local Now', description: 'Force-saves the current library catalogue and settings to browser storage.' },
            { key: 'exportEverything', icon: '🧰', label: 'Export Everything', description: 'Exports one full backup JSON with library, playlists, history, settings and visualisers.' },
            { key: 'folder', icon: '📁', label: 'Add Folder', description: 'Adds all playable media files from a selected local folder.' },
            { key: 'import', icon: '📥', label: 'Import JSON', description: 'Imports an Onda library, stream add-on, playlist, or presets JSON.' },
            { key: 'export', icon: '📤', label: 'Export Full', description: 'Exports the current full library JSON.' },
            { key: 'streams', icon: '☁️', label: 'Export Streams', description: 'Exports only online stream records as an add-on library.' },
            { key: 'playlistExport', icon: '🧾', label: 'Export Playlist', description: 'Exports a selected playlist JSON.' },
            { key: 'check', icon: '✅', label: 'Check Files', description: 'Checks streams and reports which local files need relinking.' }
        ];

        function getMobileIconDefaults() {
            return Object.fromEntries(MOBILE_DB_ICON_DEFINITIONS.map(item => [item.key, item.icon]));
        }

        function loadMobileIconSettings() {
            try {
                const parsed = JSON.parse(localStorage.getItem(MOBILE_DB_ICON_STORAGE_KEY) || '{}');
                return { ...getMobileIconDefaults(), ...(parsed && typeof parsed === 'object' ? parsed : {}) };
            } catch (err) {
                console.warn('Could not read mobile library icon settings:', err);
                return getMobileIconDefaults();
            }
        }

        function saveMobileIconSettings(settings) {
            try {
                localStorage.setItem(MOBILE_DB_ICON_STORAGE_KEY, JSON.stringify(settings || getMobileIconDefaults()));
                saveLocalUiStateCheckpoint('mobile-icon-settings-save');
            } catch (err) {
                console.warn('Could not save mobile library icon settings:', err);
                showToast('Could not save mobile icon settings.');
            }
        }

        function normalizeMobileIconValue(value, fallback) {
            const clean = String(value || '').trim();
            return clean ? clean.slice(0, 8) : fallback;
        }

        function applyMobileIconSettings() {
            const settings = loadMobileIconSettings();
            MOBILE_DB_ICON_DEFINITIONS.forEach(def => {
                const btn = document.querySelector(`.mobile-db-icon-btn[data-mobile-icon-key="${def.key}"]`);
                if (!btn) return;
                btn.textContent = normalizeMobileIconValue(settings[def.key], def.icon);
                btn.title = `${def.label}: ${def.description}`;
            });
            renderMobileIconHelpPanel(settings);
        }

        function renderMobileIconHelpPanel(settings = loadMobileIconSettings()) {
            if (!mobileIconHelpList) return;
            mobileIconHelpList.innerHTML = '';
            MOBILE_DB_ICON_DEFINITIONS.forEach(def => {
                const value = normalizeMobileIconValue(settings[def.key], def.icon);
                const row = document.createElement('div');
                row.className = 'mobile-icon-help-row';
                row.innerHTML = `
                    <div class="mobile-icon-help-preview" data-icon-preview-key="${def.key}">${escapeHtml(value)}</div>
                    <div>
                        <div class="mobile-icon-help-name">${escapeHtml(def.label)}</div>
                        <div class="mobile-icon-help-desc">${escapeHtml(def.description)}</div>
                    </div>
                    <input class="mobile-icon-edit-input" data-icon-edit-key="${def.key}" value="${escapeHtml(value)}" maxlength="8" inputmode="text" aria-label="Change ${escapeHtml(def.label)} icon">
                `;
                mobileIconHelpList.appendChild(row);
            });
        }

        function updateMobileIconSetting(key, value) {
            const def = MOBILE_DB_ICON_DEFINITIONS.find(item => item.key === key);
            if (!def) return;
            const settings = loadMobileIconSettings();
            settings[key] = normalizeMobileIconValue(value, def.icon);
            saveMobileIconSettings(settings);
            applyMobileIconSettings();
            showToast(`${def.label} icon updated.`);
        }

        function resetMobileIconSettings() {
            saveMobileIconSettings(getMobileIconDefaults());
            applyMobileIconSettings();
            showToast('Mobile library icons reset.');
        }

        function setMobileLibraryView(view = 'results') {
            if (!libraryDrawer) return;
            const safeView = ['results', 'recents', 'playlists', 'help'].includes(view) ? view : 'results';
            libraryDrawer.dataset.mobileView = safeView;
            document.querySelectorAll('.mobile-db-icon-btn[data-mobile-view]').forEach(btn => {
                btn.classList.toggle('active-mobile-view', btn.dataset.mobileView === safeView);
            });
            try {
                localStorage.setItem(LIBRARY_MOBILE_VIEW_KEY, safeView);
                saveLocalUiStateCheckpoint(`mobile-library-view:${safeView}`);
            } catch (err) {
                console.warn('Could not save mobile library view:', err);
            }
        }

        function promptSearchFuzziness() {
            const current = Math.max(0, Math.min(4, librarySearchFuzziness || 0));
            const raw = prompt('Fuzzy search tolerance: 0 = exact, 1 = small typos, 2+ = looser matches.', String(current));
            if (raw === null) return;
            const next = Math.max(0, Math.min(4, parseInt(raw, 10) || 0));
            librarySearchFuzziness = next;
            localStorage.setItem(FUZZY_SEARCH_STORAGE_KEY, String(next));
            showToast(`Fuzzy search set to ±${next}.`);
            renderLibraryManager();
        }

        function renderLibraryManager() {
            if (!dbLibraryResults) return;
            syncAllTrackPlaylistMetadata();
            updateBulkActionUI();
            const search = (dbLibrarySearch?.value || '').trim().toLowerCase();
            const filter = dbLibraryFilter?.value || 'all';
            const entries = Object.entries(virtualLibrary)
                .filter(([id, meta]) => {
                    const playlistsForTrack = getTrackPlaylistNames(id);
                    const haystack = [
                        id,
                        meta.fileName,
                        meta.title,
                        meta.nickname,
                        meta.sourceType,
                        meta.streamUrl,
                        meta.localPath,
                        meta.phonePath,
                        meta.desktopPath,
                        ...(Array.isArray(meta.tags) ? meta.tags : []),
                        ...playlistsForTrack
                    ].filter(Boolean).join(' ').toLowerCase();
                    if (search && !matchesLibrarySearch(haystack, search)) return false;
                    if (filter === 'stream') return meta.sourceType === 'stream' || !!meta.streamUrl;
                    if (filter === 'local') return !(meta.sourceType === 'stream' || meta.streamUrl);
                    if (filter === 'missing') return !(meta.sourceType === 'stream' || meta.streamUrl) && !meta.blobFile;
                    return true;
                })
                .sort((a, b) => getDisplayTitle(a[1]).localeCompare(getDisplayTitle(b[1])));

            visibleLibraryIds = entries.map(([id]) => id);
            selectedLibraryIds = new Set(Array.from(selectedLibraryIds).filter(id => virtualLibrary[id]));
            if (dbSelectionSummary) dbSelectionSummary.textContent = `${selectedLibraryIds.size} selected`;

            dbLibraryResults.innerHTML = entries.length ? '' : '<div class="library-track-meta">No matching tracks in this library yet.</div>';
            entries.forEach(([id]) => {
                const row = buildTrackRow(id, false);
                if (row) dbLibraryResults.appendChild(row);
            });

            if (dbRecentList) {
                dbRecentList.innerHTML = '';
                const validRecent = recentTrackIds.filter(id => virtualLibrary[id]).slice(0, 6);
                if (!validRecent.length) dbRecentList.innerHTML = '<div class="library-track-meta">No recent tracks yet.</div>';
                validRecent.forEach(id => {
                    const row = buildTrackRow(id, true);
                    if (row) dbRecentList.appendChild(row);
                });
            }

            if (dbPlaylistList) dbPlaylistList.innerHTML = '';
            renderHistoryTab();
        }

        function getLibraryDrawerSavedHeight() {
            try {
                const raw = parseInt(localStorage.getItem(LIBRARY_DRAWER_HEIGHT_KEY) || '', 10);
                return Number.isFinite(raw) && raw > 0 ? raw : null;
            } catch (err) {
                return null;
            }
        }

        function getLibraryDrawerBottomOffset() {
            const bottomPanel = document.getElementById('organon-bottom-panel');
            if (!bottomPanel) return window.matchMedia('(max-width: 768px)').matches ? 62 : 70;
            return Math.max(48, Math.ceil(window.innerHeight - bottomPanel.getBoundingClientRect().top + 8));
        }

        function getLibraryDrawerMinimumTop() {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const topPanel = document.getElementById('organon-top-panel');
            if (!isMobile) return Math.max(28, Math.round(window.innerHeight * 0.08));
            return topPanel ? Math.ceil(topPanel.getBoundingClientRect().bottom + 10) : 178;
        }

        function clampLibraryDrawerHeight(value) {
            const bottomOffset = getLibraryDrawerBottomOffset();
            const minTop = getLibraryDrawerMinimumTop();
            const maxHeight = Math.max(260, window.innerHeight - bottomOffset - minTop);
            const minHeight = Math.min(320, Math.max(220, Math.round(window.innerHeight * 0.28)));
            const fallback = Math.min(Math.round(window.innerHeight * 0.72), 680);
            const raw = Number.isFinite(Number(value)) ? Number(value) : fallback;
            return Math.round(Math.max(minHeight, Math.min(maxHeight, raw)));
        }

        function getCurrentLibraryDrawerHeight() {
            if (!libraryDrawer) return Math.min(Math.round(window.innerHeight * 0.72), 680);
            const rect = libraryDrawer.getBoundingClientRect();
            if (rect.height > 0) return rect.height;
            const saved = getLibraryDrawerSavedHeight();
            return saved || Math.min(Math.round(window.innerHeight * 0.72), 680);
        }

        function getLibraryDrawerSavedWidth() {
            try {
                const raw = parseInt(localStorage.getItem(LIBRARY_DRAWER_WIDTH_KEY) || '', 10);
                return Number.isFinite(raw) && raw > 0 ? raw : null;
            } catch (err) {
                return null;
            }
        }

        function clampLibraryDrawerWidth(value) {
            const minWidth = Math.min(640, Math.max(340, Math.round(window.innerWidth * 0.52)));
            const maxWidth = Math.max(minWidth, window.innerWidth - 80);
            const fallback = Math.min(1320, Math.max(minWidth, window.innerWidth - 280));
            const raw = Number.isFinite(Number(value)) ? Number(value) : fallback;
            return Math.round(Math.max(minWidth, Math.min(maxWidth, raw)));
        }

        function getCurrentLibraryDrawerWidth() {
            if (!libraryDrawer) return Math.min(1320, window.innerWidth - 280);
            const rect = libraryDrawer.getBoundingClientRect();
            if (rect.width > 0) return rect.width;
            const saved = getLibraryDrawerSavedWidth();
            return saved || Math.min(1320, window.innerWidth - 280);
        }

        function applyLibraryDrawerWidth(width, { persist = false } = {}) {
            if (!libraryDrawer) return;
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            libraryDrawer.classList.toggle('drawer-custom-width', !isMobile);
            if (isMobile) {
                document.documentElement.style.removeProperty('--library-drawer-width');
                document.documentElement.style.removeProperty('--library-drawer-left');
                return;
            }
            const safeWidth = clampLibraryDrawerWidth(width);
            document.documentElement.style.setProperty('--library-drawer-width', `${safeWidth}px`);
            document.documentElement.style.setProperty('--library-drawer-left', `${Math.round((window.innerWidth - safeWidth) / 2)}px`);
            if (persist) {
                try { localStorage.setItem(LIBRARY_DRAWER_WIDTH_KEY, String(safeWidth)); } catch (err) {}
                saveLocalUiStateCheckpoint('library-drawer-corner-resize');
            }
        }

        function applyLibraryDrawerHeight(height, { persist = false } = {}) {
            if (!libraryDrawer) return;
            const safeHeight = clampLibraryDrawerHeight(height);
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            document.documentElement.style.setProperty('--library-drawer-height', `${safeHeight}px`);

            if (isMobile) {
                const bottomOffset = getLibraryDrawerBottomOffset();
                const minTop = getLibraryDrawerMinimumTop();
                const topEdge = Math.max(minTop, window.innerHeight - bottomOffset - safeHeight);
                document.documentElement.style.setProperty('--mobile-library-drawer-top', `${Math.ceil(topEdge)}px`);
                document.documentElement.style.setProperty('--mobile-library-drawer-bottom', `${bottomOffset}px`);
            }

            if (persist) {
                try { localStorage.setItem(LIBRARY_DRAWER_HEIGHT_KEY, String(safeHeight)); } catch (err) {}
                saveLocalUiStateCheckpoint('library-drawer-resize');
            }
        }

        function syncMobileLibraryDrawerBounds() {
            if (!libraryDrawer) return;
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const savedHeight = getLibraryDrawerSavedHeight();

            if (!isMobile) {
                document.documentElement.style.removeProperty('--mobile-library-drawer-top');
                document.documentElement.style.removeProperty('--mobile-library-drawer-bottom');
                const savedWidth = getLibraryDrawerSavedWidth();
                if (savedWidth) applyLibraryDrawerWidth(savedWidth, { persist: false });
                if (savedHeight) applyLibraryDrawerHeight(savedHeight, { persist: false });
                return;
            }

            if (savedHeight) {
                applyLibraryDrawerHeight(savedHeight, { persist: false });
                return;
            }

            const topPanel = document.getElementById('organon-top-panel');
            const bottomEdge = getLibraryDrawerBottomOffset();
            const topEdge = topPanel ? Math.ceil(topPanel.getBoundingClientRect().bottom + 10) : 178;
            document.documentElement.style.setProperty('--mobile-library-drawer-top', `${topEdge}px`);
            document.documentElement.style.setProperty('--mobile-library-drawer-bottom', `${bottomEdge}px`);
        }

        function startLibraryDrawerResize(e) {
            if (!libraryDrawer || !libraryDrawer.classList.contains('drawer-open')) return;
            if (e.button !== undefined && e.button !== 0) return;
            isLibraryDrawerResizing = true;
            suppressLibraryDrawerToggleClick = false;
            libraryDrawerResizeStartY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
            libraryDrawerResizeStartHeight = getCurrentLibraryDrawerHeight();
            document.body.classList.add('is-resizing-library-drawer');
            try { btnDatabaseEngine?.setPointerCapture?.(e.pointerId); } catch (err) {}
            e.preventDefault();
        }

        function moveLibraryDrawerResize(e) {
            if (!isLibraryDrawerResizing) return;
            const currentY = e.clientY || (e.touches && e.touches[0]?.clientY) || libraryDrawerResizeStartY;
            const distance = libraryDrawerResizeStartY - currentY;
            if (Math.abs(distance) > 4) suppressLibraryDrawerToggleClick = true;
            applyLibraryDrawerHeight(libraryDrawerResizeStartHeight + distance, { persist: false });
            e.preventDefault();
        }

        function endLibraryDrawerResize(e) {
            if (!isLibraryDrawerResizing) return;
            isLibraryDrawerResizing = false;
            document.body.classList.remove('is-resizing-library-drawer');
            applyLibraryDrawerHeight(getCurrentLibraryDrawerHeight(), { persist: true });
            try { btnDatabaseEngine?.releasePointerCapture?.(e.pointerId); } catch (err) {}
            if (suppressLibraryDrawerToggleClick) {
                setTimeout(() => { suppressLibraryDrawerToggleClick = false; }, 80);
            }
        }

        function startLibraryDrawerCornerResize(e) {
            if (!libraryDrawer || !libraryDrawer.classList.contains('drawer-open')) return;
            if (e.button !== undefined && e.button !== 0) return;
            isLibraryDrawerCornerResizing = true;
            suppressLibraryDrawerToggleClick = true;
            libraryDrawerCornerResizeSide = e.currentTarget?.dataset?.resizeCorner === 'left' ? 'left' : 'right';
            libraryDrawerResizeStartX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
            libraryDrawerResizeStartY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
            libraryDrawerResizeStartWidth = getCurrentLibraryDrawerWidth();
            libraryDrawerResizeStartHeight = getCurrentLibraryDrawerHeight();
            document.body.classList.add('is-resizing-library-drawer-corner');
            try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch (err) {}
            e.preventDefault();
            e.stopPropagation();
        }

        function moveLibraryDrawerCornerResize(e) {
            if (!isLibraryDrawerCornerResizing) return;
            const currentX = e.clientX || (e.touches && e.touches[0]?.clientX) || libraryDrawerResizeStartX;
            const currentY = e.clientY || (e.touches && e.touches[0]?.clientY) || libraryDrawerResizeStartY;
            const dx = currentX - libraryDrawerResizeStartX;
            const dy = libraryDrawerResizeStartY - currentY;
            const widthDelta = libraryDrawerCornerResizeSide === 'left' ? (-dx * 2) : (dx * 2);
            applyLibraryDrawerWidth(libraryDrawerResizeStartWidth + widthDelta, { persist: false });
            applyLibraryDrawerHeight(libraryDrawerResizeStartHeight + dy, { persist: false });
            e.preventDefault();
        }

        function endLibraryDrawerCornerResize(e) {
            if (!isLibraryDrawerCornerResizing) return;
            isLibraryDrawerCornerResizing = false;
            document.body.classList.remove('is-resizing-library-drawer-corner');
            applyLibraryDrawerWidth(getCurrentLibraryDrawerWidth(), { persist: true });
            applyLibraryDrawerHeight(getCurrentLibraryDrawerHeight(), { persist: true });
            try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch (err) {}
            setTimeout(() => { suppressLibraryDrawerToggleClick = false; }, 120);
        }

        function toggleLibraryDrawer(forceOpen = null) {
            if (!libraryDrawer) return;
            const wasOpen = libraryDrawer.classList.contains('drawer-open');
            const shouldOpen = forceOpen === null ? !wasOpen : !!forceOpen;
            if (wasOpen && !shouldOpen) saveLocalUiStateCheckpoint('library-drawer-close');
            if (shouldOpen) syncMobileLibraryDrawerBounds();
            libraryDrawer.classList.toggle('drawer-open', shouldOpen);
            libraryDrawer.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
            if (btnDatabaseEngine) btnDatabaseEngine.classList.toggle('drawer-resize-ready', shouldOpen);
            if (shouldOpen) {
                const savedHeight = getLibraryDrawerSavedHeight();
                const savedWidth = getLibraryDrawerSavedWidth();
                if (savedWidth) applyLibraryDrawerWidth(savedWidth, { persist: false });
                if (savedHeight) applyLibraryDrawerHeight(savedHeight, { persist: false });
                setMobileLibraryView(libraryDrawer.dataset.mobileView || localStorage.getItem(LIBRARY_MOBILE_VIEW_KEY) || 'results');
                renderLibraryManager();
            }
            saveLocalUiStateCheckpoint(shouldOpen ? 'library-drawer-open' : 'library-drawer-closed');
        }

        function exportPlaylistJson(playlistName) {
            const name = playlistName || activePlaylistView || prompt('Export which playlist? Type the exact playlist name:');
            if (!name || !playlists[name]) {
                showToast('No matching playlist to export.');
                return;
            }
            const trackIds = normalisePlaylistToIds(playlists[name]);
            const tracks = {};
            trackIds.forEach(id => {
                if (virtualLibrary[id]) tracks[id] = sanitizeTrackForExport(virtualLibrary[id]);
            });
            const data = {
                app: 'Onda Media Player',
                type: 'onda-playlist',
                version: 1,
                playlistName: name,
                requiredLibraryName: (libraryNameInput?.value || 'Onda Library').trim() || 'Onda Library',
                exportedAt: new Date().toISOString(),
                trackIds,
                tracks,
                ...(playlistMeta[name] || {})
            };
            downloadJsonFile(`${slugifyFileName(name)}-playlist.json`, data);
            showToast(`Exported playlist JSON: ${name}`);
        }

        function renderActiveTrackPlaylistEditor() {
            const container = document.getElementById('meta-playlist-membership');
            if (!container) return;
            container.innerHTML = '';
            if (!currentFile) {
                container.innerHTML = '<div class="library-track-meta">No active track.</div>';
                return;
            }
            const trackId = currentFile.name;
            Object.keys(playlists).sort().forEach(name => {
                const checked = playlists[name].some(track => getTrackId(track) === trackId);
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${escapeHtml(name)}" ${checked ? 'checked' : ''}> <span>${escapeHtml(name)}</span>`;
                container.appendChild(label);
            });
            if (!Object.keys(playlists).length) container.innerHTML = '<div class="library-track-meta">No playlists yet. Create one below.</div>';
        }

        function saveActiveTrackPlaylistMembership() {
            if (!currentFile) return;
            const trackId = currentFile.name;
            const checkboxes = document.querySelectorAll('#meta-playlist-membership input[type="checkbox"]');
            checkboxes.forEach(cb => {
                const name = cb.value;
                if (!playlists[name]) playlists[name] = [];
            ensurePlaylistMeta(name);
                const idx = playlists[name].findIndex(track => getTrackId(track) === trackId);
                if (cb.checked && idx === -1) playlists[name].push(createPlayableTrackFromMeta(virtualLibrary[trackId]));
                if (!cb.checked && idx !== -1) playlists[name].splice(idx, 1);
            });
            syncTrackPlaylistMetadata(trackId);
            renderPlaylistsList();
            renderLibraryManager();
            updateMetadataUI();
            saveActiveLibraryState('track-playlist-membership');
            showToast('Track playlist membership saved.');
        }

        function saveActiveTrackInlineTags() {
            if (!currentFile) return;
            const input = document.getElementById('input-inline-tags');
            virtualLibrary[currentFile.name].tags = (input?.value || '').split(',').map(tag => tag.trim()).filter(Boolean);
            updateMetadataUI();
            renderLibraryManager();
            saveActiveLibraryState('track-tags-save');
            showToast('Tags saved.');
        }

        function createPlaylistFromActiveTrack() {
            const input = document.getElementById('input-inline-new-playlist');
            const name = (input?.value || '').trim();
            if (!name) return;
            if (!playlists[name]) playlists[name] = [];
            if (currentFile && !playlists[name].some(track => getTrackId(track) === currentFile.name)) {
                playlists[name].push(createPlayableTrackFromMeta(virtualLibrary[currentFile.name]));
            }
            if (input) input.value = '';
            if (currentFile) syncTrackPlaylistMetadata(currentFile.name);
            saveLastPlayedTrack('metadata-update');
            renderPlaylistsList();
            renderLibraryManager();
            updateMetadataUI();
            saveActiveLibraryState('create-playlist-from-track');
            showToast(`Playlist ready: ${name}`);
        }

        function buildLibraryExport({ streamingOnly = false } = {}) {
            const allTracks = Object.values(virtualLibrary).map(meta => sanitizeTrackForExport(meta));
            const filteredTracks = streamingOnly ? allTracks.filter(meta => meta.sourceType === 'stream' || !!meta.streamUrl) : allTracks;
            const allowedIds = new Set(filteredTracks.map(meta => meta.id));
            const tracksObject = {};
            filteredTracks.forEach(meta => { tracksObject[meta.id] = meta; });

            const playlistsObject = {};
            Object.entries(playlists).forEach(([name, value]) => {
                const ids = normalisePlaylistToIds(value).filter(id => allowedIds.has(id));
                if (!streamingOnly || ids.length > 0) {
                    playlistsObject[name] = {
                        name,
                        ...(playlistMeta[name] || {}),
                        trackIds: ids
                    };
                }
            });

            return {
                app: 'Onda Media Player',
                type: 'onda-library',
                version: 1,
                libraryName: (libraryNameInput?.value || 'Onda Library').trim() || 'Onda Library',
                libraryKind: streamingOnly ? 'streaming-addon' : 'device-library',
                exportedAt: new Date().toISOString(),
                tracks: tracksObject,
                playlists: playlistsObject,
                playlistMeta,
                visualizerPresets: savedVisualizerPresets
            };
        }

        function downloadJsonFile(filename, data) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function slugifyFileName(value) {
            return (value || 'onda-library').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'onda-library';
        }

        function serializeVisualizerLayersForJson() {
            return visualizerLayers.map((layer, index) => {
                const normal = normalizeVisualizerLayer(layer, index + 1);
                return {
                    style: normal.style,
                    layer: normal.layer,
                    blend: normal.blend,
                    gradient: normal.gradient,
                    align: normal.align,
                    hPosition: normal.hPosition,
                    vPosition: normal.vPosition,
                    amplitude: normal.amplitude,
                    spacing: normal.spacing,
                    rotate: normal.rotate,
                    flipH: normal.flipH,
                    flipV: normal.flipV,
                    randomize: normal.randomize,
                    mirror: normal.mirror,
                    hidden: normal.hidden,
                    drawMode: normal.drawMode,
                    colors: (normal.colors || []).map(sanitizeHexColor).slice(0, 6)
                };
            });
        }

        function buildSettingsExport({ includePlaylists = false } = {}) {
            saveLocalUiStateCheckpoint(includePlaylists ? 'settings-playlists-backup-export' : 'settings-export');

            const settings = {
                libraryName: (libraryNameInput?.value || 'Onda Library').trim() || 'Onda Library',
                volumeBoost: parseFloat(volSlider?.value || '1') || 1,
                playbackSpeed: parseFloat(speedSlider?.value || activeAudio?.playbackRate || '1') || 1,
                speedCycleIndex: currentSpeedIdx || 0,
                activeWorkspaceTab: document.querySelector('.viewport-content.active-content')?.id || localStorage.getItem(ACTIVE_WORKSPACE_TAB_KEY) || 'tab-files',
                mobileLibraryView: libraryDrawer?.dataset.mobileView || localStorage.getItem(LIBRARY_MOBILE_VIEW_KEY) || 'results',
                libraryFuzzySearch: librarySearchFuzziness,
                mobileLibraryIcons: loadMobileIconSettings()
            };

            const payload = {
                app: 'Onda Media Player',
                type: includePlaylists ? 'onda-settings-playlists-backup' : 'onda-settings',
                version: 1,
                exportedAt: new Date().toISOString(),
                settings,
                visualizer: {
                    activeStack: serializeVisualizerLayersForJson(),
                    presets: savedVisualizerPresets || {}
                }
            };

            if (includePlaylists) {
                payload.playlists = playlists || {};
                payload.playlistMeta = playlistMeta || {};
            }

            return payload;
        }

        function buildEverythingExport() {
            saveLocalUiStateCheckpoint('export-everything');
            syncAllTrackPlaylistMetadata();
            const settingsBackup = buildSettingsExport({ includePlaylists: true });
            const libraryBackup = buildLibraryExport({ streamingOnly: false });
            return {
                app: 'Onda Media Player',
                type: 'onda-full-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                note: 'This file saves app data only. It does not contain actual audio/music file data.',
                settings: settingsBackup.settings,
                visualizer: settingsBackup.visualizer,
                library: libraryBackup,
                playlists: libraryBackup.playlists,
                playlistMeta: playlistMeta || {},
                history: { recentTrackIds: recentTrackIds || [] },
                queue: {
                    trackIds: playlistTracks.map(getTrackId).filter(Boolean),
                    currentTrackId: currentFile?.name || null,
                    activePlaylistView: activePlaylistView || null
                },
                mobileLibraryIcons: loadMobileIconSettings()
            };
        }

        function applyImportedSettingsJson(data) {
            if (!data || typeof data !== 'object') {
                showToast('Import failed: invalid settings JSON.');
                return;
            }

            if (data.type === 'onda-full-backup' && data.library) {
                importOndaLibrary(data.library);
                if (data.history && Array.isArray(data.history.recentTrackIds)) {
                    recentTrackIds = data.history.recentTrackIds.filter(id => data.library?.tracks?.[id]).slice(0, 50);
                    saveRecentTrackIds();
                }
                if (data.queue && Array.isArray(data.queue.trackIds)) {
                    playlistTracks = data.queue.trackIds
                        .map(id => virtualLibrary[id] ? createPlayableTrackFromMeta(virtualLibrary[id]) : null)
                        .filter(Boolean);
                    activePlaylistView = data.queue.activePlaylistView || activePlaylistView;
                }
            } else if (data.type === 'onda-library' || data.tracks) {
                importOndaLibrary(data);
                return;
            }

            const settings = data.settings || {};
            if (settings.libraryName && libraryNameInput) libraryNameInput.value = settings.libraryName;

            if (typeof settings.volumeBoost !== 'undefined' && volSlider) {
                const val = Math.max(0, Math.min(2, parseFloat(settings.volumeBoost) || 1));
                volSlider.value = String(val);
                if (gainNode) gainNode.gain.value = val;
                streamAudio.volume = Math.min(1, Math.max(0, val));
                const volReadout = document.getElementById('vol-readout');
                if (volReadout) volReadout.innerText = Math.round(val * 100) + '%';
            }

            if (typeof settings.playbackSpeed !== 'undefined' && speedSlider) {
                const speed = Math.max(0.5, Math.min(3, parseFloat(settings.playbackSpeed) || 1));
                speedSlider.value = String(speed);
                if (activeAudio) activeAudio.playbackRate = speed;
                const speedReadout = document.getElementById('speed-readout');
                if (speedReadout) speedReadout.innerText = speed.toFixed(1) + 'x';
                if (btnSpeedCycle) btnSpeedCycle.innerText = `🚀${speed.toFixed(1).replace('.0', '')}`;
            }

            if (Number.isInteger(settings.speedCycleIndex)) {
                currentSpeedIdx = Math.max(0, Math.min(speedCycles.length - 1, settings.speedCycleIndex));
            }

            if (settings.activeWorkspaceTab) localStorage.setItem(ACTIVE_WORKSPACE_TAB_KEY, settings.activeWorkspaceTab);
            if (settings.mobileLibraryView) localStorage.setItem(LIBRARY_MOBILE_VIEW_KEY, settings.mobileLibraryView);

            if (typeof settings.libraryFuzzySearch !== 'undefined') {
                librarySearchFuzziness = Math.max(0, Math.min(4, parseInt(settings.libraryFuzzySearch, 10) || 0));
                localStorage.setItem(FUZZY_SEARCH_STORAGE_KEY, String(librarySearchFuzziness));
            }

            if (settings.mobileLibraryIcons && typeof settings.mobileLibraryIcons === 'object') {
                saveMobileIconSettings({ ...getMobileIconDefaults(), ...settings.mobileLibraryIcons });
            }

            const incomingPresets = data.visualizer?.presets || data.visualizerPresets;
            if (incomingPresets && typeof incomingPresets === 'object') {
                savedVisualizerPresets = { ...savedVisualizerPresets, ...incomingPresets };
                saveVisualizerPresets();
                renderVisualizerPresetSelect();
            }

            const incomingStack = data.visualizer?.activeStack || data.activeStack || data.layers;
            if (Array.isArray(incomingStack) && incomingStack.length) {
                visualizerLayers = incomingStack.map((layer, index) => ({
                    ...normalizeVisualizerLayer(layer, index + 1),
                    id: 'vis_' + Date.now().toString(36) + '_' + index + '_' + Math.random().toString(36).slice(2, 5)
                }));
                saveActiveVisualizerStack();
                renderVisualizerLayerCards();
            }

            if (data.playlists && typeof data.playlists === 'object') {
                Object.entries(data.playlists).forEach(([name, value]) => {
                    const trackIds = Array.isArray(value) ? value : (Array.isArray(value?.trackIds) ? value.trackIds : []);
                    playlists[name] = [...new Set(trackIds.filter(Boolean))];

                    const inlineMeta = (!Array.isArray(value) && typeof value === 'object') ? { ...value } : {};
                    delete inlineMeta.trackIds;
                    delete inlineMeta.name;
                    playlistMeta[name] = {
                        ...(playlistMeta[name] || {}),
                        ...(data.playlistMeta?.[name] || {}),
                        ...inlineMeta
                    };
                });
                renderPlaylistsList();
                renderLibraryManager();
            }

            applyMobileIconSettings();
            restoreLocalUiScreen();
            saveLocalUiStateCheckpoint('settings-json-import');
            saveActiveLibraryState('settings-json-import');
            showToast(data.type === 'onda-full-backup' ? 'Imported full Onda backup.' : (data.playlists ? 'Imported settings and playlists backup.' : 'Imported settings JSON.'));
        }

        function importOndaLibrary(data) {
            if (!data || typeof data !== 'object') throw new Error('JSON is not an object.');

            if (data.type === 'onda-playlist') {
                if (data.tracks && typeof data.tracks === 'object') {
                    Object.entries(data.tracks).forEach(([key, rawMeta]) => {
                        const id = rawMeta.id || key;
                        virtualLibrary[id] = { ...(virtualLibrary[id] || {}), ...rawMeta, id };
                    });
                }
                const name = data.playlistName || data.name || 'Imported Playlist';
                playlists[name] = playlistIdsToTrackObjects(data.trackIds || []);
                playlistMeta[name] = { ...(playlistMeta[name] || {}), imageUrl: data.imageUrl || '', imageData: data.imageData || '', description: data.description || '' };
                renderPlaylistsList();
                renderLibraryManager();
                saveActiveLibraryState('import-playlist-json');
                showToast(`Imported playlist: ${name}`);
                return;
            }

            if (data.type !== 'onda-library') throw new Error('This is not an Onda library JSON file.');

            if (data.libraryName && libraryNameInput) libraryNameInput.value = data.libraryName;

            const importedTracks = data.tracks || {};
            Object.entries(importedTracks).forEach(([key, rawMeta]) => {
                const id = rawMeta.id || key;
                const existing = virtualLibrary[id] || {};
                virtualLibrary[id] = {
                    ...existing,
                    ...rawMeta,
                    id,
                    fileName: rawMeta.fileName || rawMeta.title || existing.fileName || id,
                    nickname: rawMeta.nickname || existing.nickname || '',
                    lyrics: rawMeta.lyrics || existing.lyrics || '',
                    tags: Array.isArray(rawMeta.tags) ? rawMeta.tags : (existing.tags || []),
                    playlists: Array.isArray(rawMeta.playlists) ? rawMeta.playlists : (existing.playlists || []),
                    sourceType: rawMeta.sourceType || (rawMeta.streamUrl ? 'stream' : 'local'),
                    size: rawMeta.size || existing.size || '',
                    streamUrl: rawMeta.streamUrl || existing.streamUrl || null,
                    localPath: rawMeta.localPath || existing.localPath || null,
                    phonePath: rawMeta.phonePath || existing.phonePath || null,
                    desktopPath: rawMeta.desktopPath || existing.desktopPath || null,
                    imageUrl: rawMeta.imageUrl || existing.imageUrl || null,
                    imageData: rawMeta.imageData || existing.imageData || null,
                    notes: rawMeta.notes || existing.notes || ''
                };
            });

            if (data.playlists && typeof data.playlists === 'object') {
                Object.entries(data.playlists).forEach(([name, value]) => {
                    playlists[name] = playlistIdsToTrackObjects(normalisePlaylistToIds(value));
                    playlistMeta[name] = {
                        ...(playlistMeta[name] || {}),
                        ...(value && typeof value === 'object' ? {
                            imageUrl: value.imageUrl || '',
                            imageData: value.imageData || '',
                            description: value.description || ''
                        } : {})
                    };
                });
            }

            if (data.playlistMeta && typeof data.playlistMeta === 'object') {
                playlistMeta = { ...playlistMeta, ...data.playlistMeta };
            }

            purgeEmptyStarterPlaylists();

            if (data.visualizerPresets && typeof data.visualizerPresets === 'object') {
                savedVisualizerPresets = { ...savedVisualizerPresets, ...data.visualizerPresets };
                saveVisualizerPresets();
                renderVisualizerPresetSelect();
            }

            const importedPlayableStreams = Object.values(virtualLibrary)
                .filter(meta => meta.sourceType === 'stream' && meta.streamUrl)
                .map(createPlayableTrackFromMeta);

            if (playlistTracks.length === 0 && importedPlayableStreams.length > 0) {
                playlistTracks = importedPlayableStreams;
                switchTrack(0);
            }

            renderPlaylistsList();
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            saveActiveLibraryState('import-library-json');
            showToast(`Imported ${Object.keys(importedTracks).length} library tracks.`);
        }

        function getCurrentTrackCountForStorage() {
            return Object.keys(virtualLibrary || {}).length;
        }

        function getPayloadTrackCount(payload) {
            const data = payload?.library || payload;
            return data?.tracks && typeof data.tracks === 'object' ? Object.keys(data.tracks).length : 0;
        }

        function getPayloadSavedAtMs(payload) {
            const stamp = payload?.savedAt || payload?.library?.exportedAt || payload?.exportedAt || '';
            const ms = Date.parse(stamp);
            return Number.isFinite(ms) ? ms : 0;
        }

        function formatBytes(bytes) {
            if (!Number.isFinite(bytes)) return 'unknown size';
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }

        function updateLibrarySaveStatusLine(status = null) {
            const line = document.getElementById('library-save-status-line');
            if (!line) return;
            let data = status;
            if (!data) {
                try { data = JSON.parse(localStorage.getItem(ONDA_LAST_LIBRARY_SAVE_KEY) || 'null'); } catch (err) { data = null; }
            }
            if (!data) {
                line.textContent = 'Last local save: not yet saved in this browser.';
                return;
            }
            const savedAt = data.savedAt ? new Date(data.savedAt) : null;
            const dateLabel = savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt.toLocaleString() : 'unknown time';
            const idbLabel = data.indexedDbSaved ? 'IndexedDB + localStorage' : 'localStorage only';
            const warning = data.warning ? ` · ${data.warning}` : '';
            line.textContent = `Last local save: ${dateLabel} · ${data.trackCount || 0} tracks · ${formatBytes(data.bytes || 0)} · ${idbLabel}${warning}`;
        }

        function recordLibrarySaveStatus({ reason, payloadText = '', indexedDbSaved = false, warning = '' } = {}) {
            const status = {
                reason: reason || 'library-save',
                savedAt: new Date().toISOString(),
                trackCount: getCurrentTrackCountForStorage(),
                bytes: payloadText ? new Blob([payloadText]).size : 0,
                indexedDbSaved,
                warning
            };
            try { localStorage.setItem(ONDA_LAST_LIBRARY_SAVE_KEY, JSON.stringify(status)); } catch (err) {}
            updateLibrarySaveStatusLine(status);
        }

        function safeSetLocalStorage(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (err) {
                console.warn(`Could not write ${key} to localStorage:`, err);
                return false;
            }
        }

        function safeGetLocalStorageJson(key) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch (err) {
                console.warn(`Could not parse ${key} from localStorage:`, err);
                return null;
            }
        }

        function getLibraryPayloadObject(candidate) {
            if (!candidate || typeof candidate !== 'object') return null;
            if (candidate.type === 'onda-active-library-autosave' && candidate.library?.type === 'onda-library') return candidate;
            if (candidate.type === 'onda-full-backup' && candidate.library?.type === 'onda-library') {
                return {
                    app: 'Onda Media Player',
                    type: 'onda-active-library-autosave',
                    version: 2,
                    savedAt: candidate.exportedAt || new Date().toISOString(),
                    reason: 'recovered-from-full-backup',
                    library: candidate.library,
                    queueIds: candidate.queue?.trackIds || [],
                    currentTrackId: candidate.queue?.currentTrackId || null,
                    activePlaylistView: candidate.queue?.activePlaylistView || null,
                    recentTrackIds: candidate.history?.recentTrackIds || []
                };
            }
            if (candidate.type === 'onda-library' && candidate.tracks) {
                return {
                    app: 'Onda Media Player',
                    type: 'onda-active-library-autosave',
                    version: 2,
                    savedAt: candidate.exportedAt || new Date().toISOString(),
                    reason: 'recovered-from-library-json',
                    library: candidate,
                    queueIds: [],
                    currentTrackId: null,
                    activePlaylistView: null,
                    recentTrackIds: []
                };
            }
            return null;
        }

        function findBestLocalStorageLibraryCandidate() {
            const candidates = [];
            const priorityKeys = [LIBRARY_AUTOSAVE_KEY, LIBRARY_AUTOSAVE_BACKUP_KEY, LIBRARY_LAST_GOOD_KEY];

            priorityKeys.forEach((key, index) => {
                const candidate = getLibraryPayloadObject(safeGetLocalStorageJson(key));
                if (candidate) candidates.push({ key, payload: candidate, priority: 100 - index });
            });

            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!key || !key.toLowerCase().includes('onda')) continue;
                    if (priorityKeys.includes(key)) continue;
                    const candidate = getLibraryPayloadObject(safeGetLocalStorageJson(key));
                    if (candidate) candidates.push({ key, payload: candidate, priority: 0 });
                }
            } catch (err) {
                console.warn('Could not scan localStorage for Onda library candidates:', err);
            }

            const withTracks = candidates
                .map(item => ({ ...item, trackCount: getPayloadTrackCount(item.payload), savedAt: getPayloadSavedAtMs(item.payload) }))
                .filter(item => item.trackCount > 0)
                .sort((a, b) => (b.trackCount - a.trackCount) || (b.savedAt - a.savedAt) || (b.priority - a.priority));

            return withTracks[0] || null;
        }

        function writeActiveLibraryPayloadEverywhere(payload, payloadText) {
            let localOk = false;
            localOk = safeSetLocalStorage(LIBRARY_AUTOSAVE_KEY, payloadText) || localOk;
            localOk = safeSetLocalStorage(LIBRARY_AUTOSAVE_BACKUP_KEY, payloadText) || localOk;
            if (getPayloadTrackCount(payload) > 0) {
                localOk = safeSetLocalStorage(LIBRARY_LAST_GOOD_KEY, payloadText) || localOk;
            }
            return localOk;
        }

        function describeStartupStorageState() {
            const primary = safeGetLocalStorageJson(LIBRARY_AUTOSAVE_KEY);
            const backup = safeGetLocalStorageJson(LIBRARY_AUTOSAVE_BACKUP_KEY);
            const lastGood = safeGetLocalStorageJson(LIBRARY_LAST_GOOD_KEY);
            return {
                checkedAt: new Date().toISOString(),
                localStoragePrimaryTracks: getPayloadTrackCount(primary),
                localStorageBackupTracks: getPayloadTrackCount(backup),
                localStorageLastGoodTracks: getPayloadTrackCount(lastGood),
                restoredTracks: getCurrentTrackCountForStorage()
            };
        }

        function openOndaIndexedDb() {
            return new Promise((resolve, reject) => {
                if (!('indexedDB' in window)) {
                    reject(new Error('IndexedDB is not available in this browser/context.'));
                    return;
                }
                const request = indexedDB.open(ONDA_IDB_NAME, ONDA_IDB_VERSION);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(ONDA_IDB_STORE)) db.createObjectStore(ONDA_IDB_STORE);
                    if (!db.objectStoreNames.contains(ONDA_IDB_AUDIO_STORE)) db.createObjectStore(ONDA_IDB_AUDIO_STORE);
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
                request.onblocked = () => reject(new Error('IndexedDB open was blocked by another tab.'));
            });
        }

        async function idbSetState(key, value) {
            const db = await openOndaIndexedDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(ONDA_IDB_STORE, 'readwrite');
                tx.objectStore(ONDA_IDB_STORE).put(value, key);
                tx.oncomplete = () => { db.close(); resolve(true); };
                tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB write failed.')); };
            });
        }

        async function idbGetState(key) {
            const db = await openOndaIndexedDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(ONDA_IDB_STORE, 'readonly');
                const request = tx.objectStore(ONDA_IDB_STORE).get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('IndexedDB read failed.'));
                tx.oncomplete = () => db.close();
                tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB transaction failed.')); };
            });
        }

        async function idbSetAudioFile(trackId, file, meta = {}) {
            if (!trackId || !file) return false;
            const db = await openOndaIndexedDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(ONDA_IDB_AUDIO_STORE, 'readwrite');
                tx.objectStore(ONDA_IDB_AUDIO_STORE).put({
                    trackId,
                    file,
                    savedAt: new Date().toISOString(),
                    fileName: meta.fileName || file.name || trackId,
                    localPath: meta.localPath || file.webkitRelativePath || file.name || '',
                    sizeBytes: meta.sizeBytes || file.size || 0,
                    lastModified: file.lastModified || null,
                    type: file.type || ''
                }, trackId);
                tx.oncomplete = () => { db.close(); resolve(true); };
                tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB audio write failed.')); };
            });
        }

        async function idbGetAudioFile(trackId) {
            if (!trackId) return null;
            const db = await openOndaIndexedDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(ONDA_IDB_AUDIO_STORE, 'readonly');
                const request = tx.objectStore(ONDA_IDB_AUDIO_STORE).get(trackId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('IndexedDB audio read failed.'));
                tx.oncomplete = () => db.close();
                tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB audio transaction failed.')); };
            });
        }

        async function idbDeleteAudioFile(trackId) {
            if (!trackId) return false;
            const db = await openOndaIndexedDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(ONDA_IDB_AUDIO_STORE, 'readwrite');
                tx.objectStore(ONDA_IDB_AUDIO_STORE).delete(trackId);
                tx.oncomplete = () => { db.close(); resolve(true); };
                tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB audio delete failed.')); };
            });
        }

        async function persistLocalAudioFilesToIndexedDb(tracks) {
            const localTracks = (tracks || []).filter(track => track && track.blobFile && (track.sourceType || 'local') !== 'stream');
            if (!localTracks.length) return { saved: 0, failed: 0 };
            let saved = 0;
            let failed = 0;
            for (const track of localTracks) {
                const trackId = getTrackId(track);
                const meta = virtualLibrary[trackId] || track;
                try {
                    await idbSetAudioFile(trackId, track.blobFile, meta);
                    saved += 1;
                } catch (err) {
                    failed += 1;
                    console.warn('Could not persist audio file to IndexedDB:', track.fileName || trackId, err);
                }
            }
            return { saved, failed };
        }

        async function hydrateLocalAudioBlob(trackId) {
            const meta = virtualLibrary[trackId];
            if (!meta || meta.sourceType === 'stream' || meta.streamUrl) return null;
            if (meta.blobFile) return meta.blobFile;
            try {
                const record = await idbGetAudioFile(trackId);
                const file = record?.file || record?.blob || null;
                if (file) {
                    meta.blobFile = file;
                    meta.needsRelink = false;
                    meta.localPath = meta.localPath || record.localPath || record.fileName || meta.fileName || trackId;
                    return file;
                }
            } catch (err) {
                console.warn('Could not hydrate local audio file from IndexedDB:', trackId, err);
            }
            return null;
        }

        function buildActiveLibraryAutosavePayload(reason = 'library-autosave') {
            syncAllTrackPlaylistMetadata();
            return {
                app: 'Onda Media Player',
                type: 'onda-active-library-autosave',
                version: 2,
                savedAt: new Date().toISOString(),
                reason,
                library: buildLibraryExport({ streamingOnly: false }),
                queueIds: playlistTracks.map(getTrackId).filter(Boolean),
                currentTrackId: currentFile?.name || null,
                activePlaylistView: activePlaylistView || null,
                recentTrackIds: recentTrackIds || []
            };
        }

        async function mirrorActiveLibraryPayloadToIndexedDb(payload, payloadText, reason) {
            try {
                await idbSetState(ONDA_IDB_ACTIVE_LIBRARY_KEY, payload);
                recordLibrarySaveStatus({ reason, payloadText, indexedDbSaved: true });
                return true;
            } catch (err) {
                console.warn('Could not mirror active library to IndexedDB:', err);
                recordLibrarySaveStatus({ reason, payloadText, indexedDbSaved: false, warning: 'IndexedDB mirror failed' });
                return false;
            }
        }

        function saveActiveLibraryState(reason = 'library-autosave') {
            try {
                const isUserLibraryAction = /add|import|playlist|track|tag|lyrics|delete|bulk|folder|stream|manual|export|settings-json-import|modal-tags-save/i.test(reason || '');
                if (libraryRestorePending && !isUserLibraryAction && getCurrentTrackCountForStorage() === 0) {
                    console.warn('Skipped empty library autosave while restore was still pending:', reason);
                    return false;
                }

                const payload = buildActiveLibraryAutosavePayload(reason);
                const payloadText = JSON.stringify(payload);
                lastActiveLibrarySavePayload = payload;

                const localOk = writeActiveLibraryPayloadEverywhere(payload, payloadText);
                recordLibrarySaveStatus({
                    reason,
                    payloadText,
                    indexedDbSaved: false,
                    warning: localOk ? '' : 'localStorage failed; trying IndexedDB'
                });

                if (pendingActiveLibrarySaveTimer) clearTimeout(pendingActiveLibrarySaveTimer);
                pendingActiveLibrarySaveTimer = setTimeout(() => {
                    mirrorActiveLibraryPayloadToIndexedDb(payload, payloadText, reason);
                    pendingActiveLibrarySaveTimer = null;
                }, 20);

                return true;
            } catch (err) {
                console.warn('Could not autosave library catalogue:', err);
                recordLibrarySaveStatus({ reason, warning: 'autosave failed before payload was created' });
                return false;
            }
        }

        async function flushActiveLibraryState(reason = 'flush-library-autosave') {
            const payload = lastActiveLibrarySavePayload || buildActiveLibraryAutosavePayload(reason);
            const payloadText = JSON.stringify(payload);
            writeActiveLibraryPayloadEverywhere(payload, payloadText);
            try { await idbSetState(ONDA_IDB_ACTIVE_LIBRARY_KEY, payload); recordLibrarySaveStatus({ reason, payloadText, indexedDbSaved: true }); } catch (err) { console.warn('IndexedDB flush failed:', err); recordLibrarySaveStatus({ reason, payloadText, indexedDbSaved: false, warning: 'IndexedDB flush failed' }); }
        }

        function applyActiveLibraryPayload(saved, source = 'unknown') {
            const data = saved?.library || saved;
            if (!data || data.type !== 'onda-library') return false;

            if (data.libraryName && libraryNameInput) libraryNameInput.value = data.libraryName;

            Object.entries(data.tracks || {}).forEach(([key, rawMeta]) => {
                if (!rawMeta || typeof rawMeta !== 'object') return;
                const id = rawMeta.id || key;
                const existing = virtualLibrary[id] || {};
                virtualLibrary[id] = {
                    ...existing,
                    ...rawMeta,
                    id,
                    fileName: rawMeta.fileName || rawMeta.title || existing.fileName || id,
                    nickname: rawMeta.nickname || existing.nickname || '',
                    lyrics: rawMeta.lyrics || existing.lyrics || '',
                    tags: Array.isArray(rawMeta.tags) ? rawMeta.tags : (existing.tags || []),
                    playlists: Array.isArray(rawMeta.playlists) ? rawMeta.playlists : (existing.playlists || []),
                    sourceType: rawMeta.sourceType || (rawMeta.streamUrl ? 'stream' : 'local'),
                    size: rawMeta.size || existing.size || '',
                    streamUrl: rawMeta.streamUrl || existing.streamUrl || null,
                    localPath: rawMeta.localPath || existing.localPath || null,
                    phonePath: rawMeta.phonePath || existing.phonePath || null,
                    desktopPath: rawMeta.desktopPath || existing.desktopPath || null,
                    imageUrl: rawMeta.imageUrl || existing.imageUrl || null,
                    imageData: rawMeta.imageData || existing.imageData || null,
                    notes: rawMeta.notes || existing.notes || '',
                    stats: rawMeta.stats || existing.stats || {}
                };
                delete virtualLibrary[id].blobFile;
            });

            if (data.playlists && typeof data.playlists === 'object') {
                Object.entries(data.playlists).forEach(([name, value]) => {
                    playlists[name] = playlistIdsToTrackObjects(normalisePlaylistToIds(value));
                    if (value && typeof value === 'object') {
                        playlistMeta[name] = {
                            ...(playlistMeta[name] || {}),
                            imageUrl: value.imageUrl || playlistMeta[name]?.imageUrl || '',
                            imageData: value.imageData || playlistMeta[name]?.imageData || '',
                            description: value.description || playlistMeta[name]?.description || ''
                        };
                    }
                });
            }

            if (data.playlistMeta && typeof data.playlistMeta === 'object') {
                playlistMeta = { ...playlistMeta, ...data.playlistMeta };
            }

            purgeEmptyStarterPlaylists();

            if (Array.isArray(saved.recentTrackIds)) {
                recentTrackIds = saved.recentTrackIds.filter(id => virtualLibrary[id]).slice(0, 50);
            }

            if (Array.isArray(saved.queueIds)) {
                playlistTracks = saved.queueIds
                    .map(id => virtualLibrary[id] ? createPlayableTrackFromMeta(virtualLibrary[id]) : null)
                    .filter(Boolean);
            }

            activePlaylistView = saved.activePlaylistView || activePlaylistView;
            syncAllTrackPlaylistMetadata();
            renderPlaylistsList();
            renderLibraryManager();
            if (typeof renderHistoryTab === 'function') renderHistoryTab();
            updateLibrarySaveStatusLine();
            console.info(`Restored Onda library from ${source}: ${getPayloadTrackCount(saved)} tracks.`);
            return true;
        }

        function restoreActiveLibraryState() {
            try {
                const best = findBestLocalStorageLibraryCandidate();
                if (!best) return false;
                const didRestore = applyActiveLibraryPayload(best.payload, `localStorage:${best.key}`);
                if (didRestore) {
                    const text = JSON.stringify(best.payload);
                    writeActiveLibraryPayloadEverywhere(best.payload, text);
                    recordLibrarySaveStatus({ reason: `restore:${best.key}`, payloadText: text, indexedDbSaved: false });
                }
                return didRestore;
            } catch (err) {
                console.warn('Could not restore autosaved library catalogue from localStorage:', err);
                return false;
            }
        }

        async function restoreActiveLibraryStateFromIndexedDb() {
            try {
                const saved = await idbGetState(ONDA_IDB_ACTIVE_LIBRARY_KEY);
                if (!saved) return false;

                const currentCount = getCurrentTrackCountForStorage();
                const storedCount = getPayloadTrackCount(saved);
                const currentLocalRaw = localStorage.getItem(LIBRARY_AUTOSAVE_KEY);
                let localSavedAt = 0;
                try { localSavedAt = currentLocalRaw ? getPayloadSavedAtMs(JSON.parse(currentLocalRaw)) : 0; } catch (err) {}
                const idbSavedAt = getPayloadSavedAtMs(saved);

                if (storedCount > 0 && (currentCount === 0 || idbSavedAt >= localSavedAt)) {
                    const didRestore = applyActiveLibraryPayload(saved, 'IndexedDB');
                    if (didRestore) {
                        writeActiveLibraryPayloadEverywhere(saved, JSON.stringify(saved));
                    }
                    return didRestore;
                }
                return false;
            } catch (err) {
                console.warn('Could not restore autosaved library catalogue from IndexedDB:', err);
                return false;
            }
        }

        function normaliseGithubJsonUrl(url) {
            const clean = String(url || '').trim();
            if (!clean) return '';
            const blobMatch = clean.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
            if (blobMatch) {
                return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}/${blobMatch[4]}`;
            }
            return clean;
        }

        function openStartupRecoveryModal(message = '') {
            const detail = document.getElementById('startup-recovery-detail');
            if (detail) {
                const state = describeStartupStorageState();
                detail.textContent = message || `Primary localStorage: ${state.localStoragePrimaryTracks} tracks · Backup key: ${state.localStorageBackupTracks} tracks · Last good key: ${state.localStorageLastGoodTracks} tracks · Restored now: ${state.restoredTracks} tracks`;
            }
            showModal('modal-startup-recovery');
        }

        function closeStartupRecoveryModal() {
            closeModal('modal-startup-recovery');
        }

        async function importOndaJsonFromUrl(url) {
            const fetchUrl = normaliseGithubJsonUrl(url);
            if (!fetchUrl) {
                showToast('Paste a JSON URL first.');
                return false;
            }
            try {
                const response = await fetch(fetchUrl, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                applyImportedSettingsJson(data);
                await flushActiveLibraryState('startup-online-json-import');
                closeStartupRecoveryModal();
                showToast('Imported online Onda JSON.');
                return true;
            } catch (err) {
                console.error('Online library import failed:', err);
                showToast('Could not load online JSON. Use a raw/public JSON URL.');
                return false;
            }
        }

        function shouldShowStartupRecovery(restoredFromLocal, restoredFromIdb) {
            if (getCurrentTrackCountForStorage() > 0) return false;
            const hasSomeSettings = [
                VISUALIZER_STORAGE_KEY,
                VISUALIZER_ACTIVE_STACK_KEY,
                ACTIVE_WORKSPACE_TAB_KEY,
                LIBRARY_MOBILE_VIEW_KEY,
                MOBILE_DB_ICON_STORAGE_KEY,
                LOCAL_UI_SAVE_EVENT_KEY,
                ONDA_LAST_LIBRARY_SAVE_KEY
            ].some(key => {
                try { return !!localStorage.getItem(key); } catch (err) { return false; }
            });
            return !(restoredFromLocal || restoredFromIdb) || !hasSomeSettings;
        }

        async function initialisePersistentLibraryStorage() {
            libraryRestorePending = true;
            const restoredFromLocal = restoreActiveLibraryState();
            const restoredFromIdb = await restoreActiveLibraryStateFromIndexedDb();
            libraryStorageReady = true;
            libraryRestorePending = false;
            updateLibrarySaveStatusLine();

            const report = {
                ...describeStartupStorageState(),
                restoredFromLocal,
                restoredFromIdb
            };
            try { localStorage.setItem(LIBRARY_RESTORE_REPORT_KEY, JSON.stringify(report)); } catch (err) {}

            if ((restoredFromLocal || restoredFromIdb) && getCurrentTrackCountForStorage() > 0) {
                saveActiveLibraryState('post-restore-confirmation');
            } else if (shouldShowStartupRecovery(restoredFromLocal, restoredFromIdb)) {
                setTimeout(() => openStartupRecoveryModal(), 350);
            }
        }

        const persistentLibraryReady = initialisePersistentLibraryStorage();

        async function probeStreamUrl(url, timeoutMs = 3500) {
            return new Promise(resolve => {
                const probe = new Audio();
                let settled = false;
                const finish = (status) => {
                    if (settled) return;
                    settled = true;
                    probe.removeAttribute('src');
                    probe.load();
                    resolve(status);
                };
                const timer = setTimeout(() => finish('UNKNOWN/TIMEOUT'), timeoutMs);
                probe.addEventListener('canplay', () => { clearTimeout(timer); finish('OK'); }, { once: true });
                probe.addEventListener('loadedmetadata', () => { clearTimeout(timer); finish('OK'); }, { once: true });
                probe.addEventListener('error', () => { clearTimeout(timer); finish('ERROR/UNAVAILABLE'); }, { once: true });
                probe.preload = 'metadata';
                probe.src = url;
                probe.load();
            });
        }

        async function checkLibraryFiles() {
            const lines = [];
            const tracks = Object.values(virtualLibrary);
            lines.push(`Onda Library Check — ${new Date().toLocaleString()}`);
            lines.push(`Tracks: ${tracks.length}`);
            lines.push('');

            for (const meta of tracks) {
                const label = meta.nickname || meta.fileName || meta.id;
                if (meta.sourceType === 'stream' && meta.streamUrl) {
                    const result = await probeStreamUrl(meta.streamUrl);
                    lines.push(`[STREAM] ${label}`);
                    lines.push(`  URL: ${meta.streamUrl}`);
                    lines.push(`  Check: ${result}`);
                } else {
                    const hasLoadedFile = !!meta.blobFile;
                    lines.push(`[${meta.sourceType === 'midi' ? 'MIDI' : 'LOCAL'}] ${label}`);
                    lines.push(`  Recorded path/name: ${meta.localPath || meta.desktopPath || meta.phonePath || meta.fileName || 'No path stored'}`);
                    lines.push(`  Check: ${hasLoadedFile ? 'OK — file is loaded in this session' : 'NEEDS RELINK — browser cannot verify saved local paths without the user selecting the file/folder again'}`);
                }
                lines.push('');
            }

            document.getElementById('library-report-output').value = lines.join('\n');
            showModal('modal-library-report');
        }

        // --- 1. WEB AUDIO API INIT ---
        async function initAudioEngine() {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                showToast("WebAudio is not supported in this browser.");
                return null;
            }

            if (!audioCtx) {
                audioCtx = new AudioContext();
                gainNode = audioCtx.createGain();
                gainNode.gain.value = parseFloat(volSlider.value) || 1;

                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.78;

                // IMPORTANT: createMediaElementSource can only be called once per element.
                // Keep this attached to local files only. Remote streams often cannot be analysed unless CORS allows it.
                localSource = audioCtx.createMediaElementSource(localAudio);
                localSource.connect(gainNode);
                gainNode.connect(analyser);
                analyser.connect(audioCtx.destination);
            }

            if (audioCtx.state === 'suspended') {
                try {
                    await audioCtx.resume();
                } catch (err) {
                    console.warn('AudioContext resume failed:', err);
                }
            }

            return audioCtx;
        }

        // Bind playback timeline events robustly to both dual-engine elements
        function attachAudioEvents(audioObj) {
            audioObj.addEventListener('loadedmetadata', (e) => {
                if (e.target !== activeAudio) return;
                seekBar.max = audioObj.duration;
                timeTotal.innerText = formatTime(audioObj.duration);
            });

            audioObj.addEventListener('timeupdate', (e) => {
                if (e.target !== activeAudio) return;
                if (!isSeeking) {
                    seekBar.value = audioObj.currentTime;
                    timeCurrent.innerText = formatTime(audioObj.currentTime);
                }
            });

            audioObj.addEventListener('ended', (e) => {
                if (e.target !== activeAudio) return;
                if (isRepeatOne) {
                    audioObj.currentTime = 0;
                    playAudio();
                } else {
                    if (isShuffle) {
                        switchTrack(Math.floor(Math.random() * playlistTracks.length));
                    } else if (currentTrackIndex < playlistTracks.length - 1) {
                        switchTrack(currentTrackIndex + 1);
                    } else if (isRepeatAll) {
                        switchTrack(0);
                    } else {
                        pauseAudio();
                        audioObj.currentTime = 0;
                    }
                }
            });
        }
        attachAudioEvents(localAudio);
        attachAudioEvents(streamAudio);

        [localAudio, streamAudio].forEach(audioObj => {
            audioObj.addEventListener('pause', (e) => {
                if (e.target === activeAudio) {
                    isPlaying = false;
                    btnPlay.textContent = '🧿';
                    btnPlay.classList.remove('active-state');
                }
            });
            audioObj.addEventListener('play', (e) => {
                if (e.target === activeAudio) {
                    isPlaying = true;
                    btnPlay.textContent = '🧿';
                    btnPlay.classList.add('active-state');
                }
            });
        });

        // --- 2. MULTI-FILE INTAKE LOADING SYSTEM ---
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) handleUploadedFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleUploadedFiles(e.target.files);
        });
        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                    handleUploadedFiles(files);
                }
                folderInput.value = '';
            });
        }

        async function handleUploadedFiles(files) {
            const playableFiles = Array.from(files).filter(file => {
                return Boolean(window.OndaMidi?.isMidiFile(file)) || file.type.startsWith('audio/') || file.type.startsWith('video/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac|mp4|webm|mid|midi)$/i);
            });

            if (playableFiles.length === 0) {
                showToast("No playable media files detected.");
                return;
            }

            const newTracks = [];
            const refreshedTracks = [];
            let queueDuplicates = 0;

            playableFiles.forEach(file => {
                const isMidi = Boolean(window.OndaMidi?.isMidiFile(file)) || /\.(mid|midi)$/i.test(file.name || '');
                const localSourceType = isMidi ? 'midi' : 'local';
                const defaultLocalTag = isMidi ? 'MIDI File' : 'Local File';
                const relativePath = file.webkitRelativePath || file.name;
                const nextId = createTrackIdFromParts(['local', relativePath, file.name, file.size, file.lastModified || '']);
                const legacyId = createTrackIdFromParts(['local', file.name, file.size, file.lastModified || '']);
                const id = virtualLibrary[nextId] ? nextId : (virtualLibrary[legacyId] ? legacyId : nextId);
                const alreadyInLibrary = Boolean(virtualLibrary[id]);
                const existing = virtualLibrary[id] || {};

                const track = {
                    name: id,
                    libraryId: id,
                    fileName: file.name,
                    sourceType: localSourceType,
                    blobFile: file,
                    sizeBytes: file.size,
                    localPath: relativePath
                };

                virtualLibrary[id] = {
                    ...existing,
                    id,
                    fileName: file.name,
                    title: existing.title || file.name.replace(/\.[^/.]+$/, ''),
                    nickname: existing.nickname || '',
                    lyrics: existing.lyrics || '',
                    tags: Array.isArray(existing.tags) && existing.tags.length ? existing.tags : [defaultLocalTag],
                    playlists: Array.isArray(existing.playlists) ? existing.playlists : [],
                    size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                    sizeBytes: file.size,
                    duration: existing.duration || null,
                    sourceType: localSourceType,
                    localPath: relativePath || existing.localPath || file.name,
                    streamUrl: null,
                    blobFile: file
                };

                if (alreadyInLibrary) refreshedTracks.push(track);
                else newTracks.push(track);
            });

            const wasEmpty = playlistTracks.length === 0;
            const allIncomingTracks = [...newTracks, ...refreshedTracks];
            const queuedIds = new Set(playlistTracks.map(getTrackId).filter(Boolean));
            const tracksToQueue = [];
            allIncomingTracks.forEach(track => {
                const trackId = getTrackId(track);
                if (queuedIds.has(trackId)) {
                    queueDuplicates += 1;
                    return;
                }
                queuedIds.add(trackId);
                tracksToQueue.push(track);
            });
            playlistTracks = [...playlistTracks, ...tracksToQueue];

            const summary = `${playableFiles.length} scanned · ${newTracks.length} new · ${refreshedTracks.length} refreshed${queueDuplicates ? ` · ${queueDuplicates} already in queue` : ''}`;
            renderLibraryManager();
            saveActiveLibraryState('add-local-files-immediate');
            showToast(summary);

            persistLocalAudioFilesToIndexedDb(allIncomingTracks).then(cacheResult => {
                if (cacheResult.failed > 0) {
                    showToast(`${summary} · ${cacheResult.failed} audio cache failures`);
                }
                saveActiveLibraryState('add-local-files-cache-complete');
            }).catch(err => {
                console.warn('Folder/audio cache failed after library metadata save:', err);
                showToast(`${summary} · audio cache failed, catalogue saved`);
                saveActiveLibraryState('add-local-files-cache-failed');
            });

            if (wasEmpty && playlistTracks.length) switchTrack(0);
            renderLibraryManager();
            saveActiveLibraryState('add-local-files-final');
        }

        function switchTrack(index) {
            if (index < 0 || index >= playlistTracks.length) return;
            currentTrackIndex = index;
            loadTrack(playlistTracks[currentTrackIndex]);
        }

        async function loadTrack(file) {
            currentFile = file;

            if (window.OndaMidi) window.OndaMidi.stopForTrackChange();
            localAudio.pause();
            streamAudio.pause();

            const key = file.name || file.libraryId || file.id;
            const fileLooksMidi = Boolean(window.OndaMidi?.isMidiTrack(file)) || /\.(mid|midi)$/i.test(String(file.fileName || file.name || ''));
            if (!virtualLibrary[key]) {
                virtualLibrary[key] = {
                    id: key,
                    fileName: file.fileName || file.name || 'Unknown Track',
                    nickname: '',
                    lyrics: '',
                    tags: file.streamUrl ? ['URL Stream'] : (fileLooksMidi ? ['MIDI File'] : ['Local File']),
                    playlists: [],
                    size: file.streamUrl ? 'URL Stream' : '',
                    sourceType: file.streamUrl ? 'stream' : (fileLooksMidi ? 'midi' : 'local'),
                    streamUrl: file.streamUrl || null,
                    localPath: file.localPath || file.fileName || null
                };
            }

            const meta = virtualLibrary[key];
            const isMidi = fileLooksMidi || meta.sourceType === 'midi' || Boolean(window.OndaMidi?.isMidiTrack(meta));
            currentFile.name = key;
            rememberRecentTrack(key);

            if (isMidi) {
                if (!window.OndaMidi?.audio) {
                    updateMetadataUI();
                    pauseAudio();
                    startVisualizer();
                    showToast('MIDI support module is missing. Check that onda-midi.js is deployed beside index.html.');
                    return;
                }
                activeAudio = window.OndaMidi.audio;
                let blob = file.blobFile || meta.blobFile;
                if (!blob) {
                    showToast('Restoring cached MIDI file...');
                    blob = await hydrateLocalAudioBlob(key);
                    if (blob) {
                        file.blobFile = blob;
                        meta.blobFile = blob;
                    }
                }
                if (!blob) {
                    updateMetadataUI();
                    pauseAudio();
                    startVisualizer();
                    showToast('MIDI metadata is saved, but the file needs to be reselected before it can play.');
                    return;
                }
                try {
                    await window.OndaMidi.load(blob, meta);
                } catch (err) {
                    console.error('MIDI load failed:', err);
                    updateMetadataUI();
                    pauseAudio();
                    startVisualizer();
                    showToast(`Could not read MIDI file: ${err.message || 'unknown MIDI error'}`);
                    return;
                }
            } else if ((file.streamUrl || meta.streamUrl) && (file.sourceType === 'stream' || meta.sourceType === 'stream')) {
                activeAudio = streamAudio;
                activeAudio.src = file.streamUrl || meta.streamUrl;
            } else {
                activeAudio = localAudio;
                let blob = file.blobFile || meta.blobFile;
                if (!blob) {
                    showToast('Restoring cached local audio...');
                    blob = await hydrateLocalAudioBlob(key);
                    if (blob) {
                        file.blobFile = blob;
                        meta.blobFile = blob;
                    }
                }
                if (!blob) {
                    updateMetadataUI();
                    pauseAudio();
                    startVisualizer();
                    showToast('Local file metadata is saved, but Chrome no longer has the audio file. Use Add Folder / Relink Folder to play it again.');
                    return;
                }
                if (activeAudio.src && activeAudio.src.startsWith('blob:')) {
                    URL.revokeObjectURL(activeAudio.src);
                }
                activeAudio.src = URL.createObjectURL(blob);
                initAudioEngine();
            }

            activeAudio.playbackRate = parseFloat(speedSlider.value);
            updateMetadataUI();
            startVisualizer();
            playAudio();
        }

        function getCurrentPlaybackPlaylistName() {
            if (!currentPlaybackPlaylistName || !playlists[currentPlaybackPlaylistName] || !currentFile) return '';
            const ids = normalisePlaylistToIds(playlists[currentPlaybackPlaylistName] || []);
            return ids.includes(currentFile.name) ? currentPlaybackPlaylistName : '';
        }

        function setNowPlayingVisibilityToggle(toggle) {
            if (toggle === 'song-info') {
                nowPlayingHideSongInfo = !nowPlayingHideSongInfo;
                try { localStorage.setItem(NOW_PLAYING_HIDE_SONG_KEY, nowPlayingHideSongInfo ? "1" : "0"); } catch (err) {}
            }
            if (toggle === 'playlist') {
                nowPlayingHidePlaylist = !nowPlayingHidePlaylist;
                try { localStorage.setItem(NOW_PLAYING_HIDE_PLAYLIST_KEY, nowPlayingHidePlaylist ? "1" : "0"); } catch (err) {}
            }
            updateNowPlayingPlaylistPanel();
        }

        function setNowPlayingMode(mode = 'both') {
            if (mode === 'jump') {
                jumpToPlayingSongInPlaylist();
                return;
            }
            nowPlayingHideSongInfo = mode === 'playlist';
            nowPlayingHidePlaylist = mode === 'song';
            try {
                localStorage.setItem(NOW_PLAYING_HIDE_SONG_KEY, nowPlayingHideSongInfo ? "1" : "0");
                localStorage.setItem(NOW_PLAYING_HIDE_PLAYLIST_KEY, nowPlayingHidePlaylist ? "1" : "0");
            } catch (err) {}
            updateNowPlayingPlaylistPanel();
        }

        function scrollCurrentTrackRowsIntoView(reason = 'track-change') {
            if (!currentFile || !currentFile.name) return;
            const safeId = CSS.escape(currentFile.name);
            window.clearTimeout(window.OndaActiveTrackScrollTimer);
            window.OndaActiveTrackScrollTimer = window.setTimeout(() => {
                const selectors = [
                    `#now-playing-playlist-track-list [data-track-id="${safeId}"]`,
                    `#playlist-detail-track-list [data-track-id="${safeId}"]`
                ];
                selectors.forEach(selector => {
                    const row = document.querySelector(selector);
                    if (!row || row.offsetParent === null) return;
                    row.classList.add('jump-focus-pulse');
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => row.classList.remove('jump-focus-pulse'), 1100);
                });
                window.OndaDebug = window.OndaDebug || {};
        window.OndaDebug.activeTrackScroll = {
                    reason,
                    trackId: currentFile.name,
                    matchedRows: selectors.map(selector => document.querySelector(selector)).filter(Boolean).length
                };
            }, 140);
        }

        
        function updateNowPlayingPlaylistPanel() {
            const card = document.getElementById('metadata-display-card');
            const panel = document.getElementById('now-playing-playlist-panel');
            const pills = document.getElementById('now-playing-mode-pills');
            const lyricsViewer = document.getElementById('lyrics-viewer');
            const name = getCurrentPlaybackPlaylistName();

            if (!card || !panel) return;

            card.classList.remove('now-playing-song-only', 'now-playing-playlist-only', 'now-playing-basic', 'lyrics-collapsed', 'now-playing-hide-song-info', 'now-playing-hide-playlist', 'now-playing-no-playlist');
            card.classList.toggle('now-playing-hide-song-info', nowPlayingHideSongInfo);
            card.classList.toggle('now-playing-hide-playlist', nowPlayingHidePlaylist);
            card.classList.add('lyrics-collapsed');

            if (pills) {
                pills.classList.remove('u-hidden');
                pills.classList.add('is-open');
                const songBtn = pills.querySelector('[data-now-toggle="song-info"]');
                const playlistBtn = pills.querySelector('[data-now-toggle="playlist"]');
                if (songBtn) {
                    songBtn.textContent = nowPlayingHideSongInfo ? 'Show song info' : 'Hide song info';
                    songBtn.classList.toggle('active-now-mode', nowPlayingHideSongInfo);
                }
                if (playlistBtn) {
                    playlistBtn.textContent = nowPlayingHidePlaylist ? 'Show playlist' : 'Hide playlist';
                    playlistBtn.classList.toggle('active-now-mode', nowPlayingHidePlaylist);
                    playlistBtn.disabled = !name || !playlists[name];
                    playlistBtn.classList.toggle('is-disabled-soft', !name || !playlists[name]);
                }
            }

            if (!name || !playlists[name]) {
                panel.hidden = true;
                panel.innerHTML = '';
                card.classList.add('now-playing-no-playlist');
                return;
            }

            let ids = normalisePlaylistToIds(playlists[name] || []);

            // Fallback: if playlist metadata is temporarily stale, use the live queue.
            if (!ids.length && currentPlaybackPlaylistName === name && Array.isArray(playlistTracks) && playlistTracks.length) {
                ids = playlistTracks.map(getTrackId).filter(Boolean);
            }

            const index = currentFile ? ids.indexOf(currentFile.name) : -1;
            const meta = playlistMeta[name] || {};
            const art = getPlaylistArtwork(name);

            panel.hidden = false;
            panel.innerHTML = '';

            const divider = document.createElement('hr');
            divider.className = 'now-playing-divider';
            panel.appendChild(divider);

            const header = document.createElement('div');
            header.className = 'playlist-detail-header now-playing-queue-header';
            header.innerHTML = `
                <div class="playlist-detail-art">${imageHtmlOrFallback(art || getDefaultArtworkSrc(), `${name} artwork`)}</div>
                <div class="playlist-detail-title-block">
                    <div class="playlist-detail-title">${escapeHtml(name)}</div>
                </div>
                <div class="playlist-row-tools">
                    <button type="button" class="btn-pill btn-jump-playlist" onclick="jumpToPlayingSongInPlaylist()" title="Jump to playing track">🎯</button>
                    <button type="button" class="btn-pill btn-edit-playlist" onclick="openPlaylistEditModal('${escapeHtml(name).replace(/'/g, "\'")}')" title="Edit playlist">✏️</button>
                </div>
                <div class="playlist-detail-meta-row">
                    <span class="mini-tag">Track ${index >= 0 ? index + 1 : '?'} of ${ids.length}</span>
                    <span class="mini-tag">Created: ${escapeHtml(getPlaylistCreatedLabel(name))}</span>
                    <span class="mini-tag">Updated: ${escapeHtml(getPlaylistUpdatedLabel(name))}</span>
                </div>
                ${meta.description ? `<div class="library-track-meta playlist-detail-description">${escapeHtml(meta.description)}</div>` : ''}
            `;
            panel.appendChild(header);

            const list = document.createElement('div');
            list.id = 'now-playing-playlist-track-list';
            list.className = 'now-playing-queue-list';

            if (!ids.length) {
                list.innerHTML = '<div class="library-track-meta">This playlist has no tracks yet.</div>';
            } else {
                ids.forEach((id, idx) => {
                    const trackMeta = virtualLibrary[id];
                    const active = currentFile && id === currentFile.name;
                    const row = document.createElement('div');
                    row.className = `now-playing-queue-row library-result-row${active ? ' active-track now-playing-current-track' : ''}`;
                    row.dataset.trackId = id;

                    if (!trackMeta) {
                        row.innerHTML = `
                            <div class="history-list-number">${idx + 1}</div>
                            <div class="onda-track-text-wrap">
                                <div class="library-track-title">Missing track record</div>
                                <div class="library-track-meta">${escapeHtml(id)}</div>
                            </div>
                            <div class="library-row-buttons"></div>
                        `;
                    } else {
                        row.innerHTML = `
                            <div class="history-list-number">${idx + 1}</div>
                            <div class="onda-track-text-wrap">
                                <div class="library-track-title">${active ? '▶ ' : ''}${escapeHtml(getDisplayTitle(trackMeta))}</div>
                                <div class="library-track-meta">${escapeHtml(trackMeta.fileName || trackMeta.id)} · ${escapeHtml(sourceStatus(trackMeta))}</div>
                            </div>
                            <div class="library-row-buttons">
                                <button type="button" class="btn-pill btn-now-play-track btn-onda-row-play" data-track-id="${escapeHtml(id)}" title="Play">▶️</button>
                                <button type="button" class="btn-pill btn-now-info-track" data-track-id="${escapeHtml(id)}" title="Info">ℹ️</button>
                                <button type="button" class="btn-pill btn-onda-add-playlist" data-track-id="${escapeHtml(id)}" title="Add to playlist">➕</button>
                            </div>
                        `;
                    }

                    list.appendChild(row);
                });
            }

            list.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                const clickedId = button?.dataset.trackId || e.target.closest('[data-track-id]')?.dataset.trackId;
                if (!clickedId || !virtualLibrary[clickedId]) return;

                if (button?.classList.contains('btn-now-info-track')) {
                    currentFile = createPlayableTrackFromMeta(virtualLibrary[clickedId]);
                    currentFile.name = clickedId;
                    switchWorkspaceTab('tab-library');
                    updateMetadataUI();
                    return;
                }

                if (button?.classList.contains('btn-now-play-track')) {
                    const queueIds = normalisePlaylistToIds(playlists[name] || []);
                    playlistTracks = queueIds.map(trackId => virtualLibrary[trackId] ? createPlayableTrackFromMeta(virtualLibrary[trackId]) : null).filter(Boolean);
                    currentPlaybackPlaylistName = name;
                    const targetIndex = playlistTracks.findIndex(track => getTrackId(track) === clickedId);
                    switchTrack(targetIndex >= 0 ? targetIndex : 0);
                    updateNowPlayingPlaylistPanel();
                }
            });

            panel.appendChild(list);

            // Expose a quick debug count for checking from the browser console.
            window.OndaDebug = window.OndaDebug || {};
        window.OndaDebug.nowPlayingQueue = {
                playlist: name,
                count: ids.length,
                renderedRows: list.querySelectorAll('[data-track-id]').length,
                activeTrack: currentFile?.name || null
            };
            scrollCurrentTrackRowsIntoView('now-playing-queue-render');
        }

        function setNowPlayingEditMode(on) {
            nowPlayingEditMode = !!on;
            const panel = document.getElementById('now-playing-edit-panel');
            const btn = document.getElementById('btn-now-playing-edit');
            if (panel) panel.classList.toggle('edit-open', nowPlayingEditMode);
            if (btn) btn.textContent = nowPlayingEditMode ? '×' : '✎';
        }

        function updateMetadataUI() {
            if (!currentFile) return;
            const meta = virtualLibrary[currentFile.name];
            if (!meta) return;
            syncTrackPlaylistMetadata(currentFile.name);
            const playlistNames = getTrackPlaylistNames(currentFile.name);
            const displayName = meta.nickname ? meta.nickname : meta.fileName;
            const nowPlayingTitle = document.getElementById('now-playing');
            const activePlName = getCurrentPlaybackPlaylistName();
            if (nowPlayingTitle) {
                nowPlayingTitle.innerHTML = `${escapeHtml(displayName)}${activePlName ? ` <span class="playlist-now-playing-label">| ${escapeHtml(activePlName)}</span>` : ''}`;
            }
            document.getElementById('track-nickname-label').innerText = meta.nickname ? `Original: ${meta.fileName}` : "";

            const sizeInMb = parseFloat(meta.size) || 0.0;
            miniMetaSize.innerText = sizeInMb.toFixed(1) + "M";

            document.getElementById('meta-file-size').innerText = meta.size || '';
            document.getElementById('meta-nickname').innerText = meta.nickname || meta.title || meta.fileName || "No Custom Name Assigned";
            const originalFile = document.getElementById('meta-original-file');
            if (originalFile) originalFile.innerText = meta.fileName || meta.id || '';

            const artBox = document.getElementById('now-playing-art');
            if (artBox) {
                const art = getTrackArtwork(meta);
                artBox.innerHTML = imageHtmlOrFallback(art || getDefaultArtworkSrc(), `${displayName} artwork`);
            }

            const sourceTypeEl = document.getElementById('meta-source-type');
            const sourceDetailEl = document.getElementById('meta-source-detail');
            if (sourceTypeEl) sourceTypeEl.innerText = meta.sourceType === 'stream' || meta.streamUrl ? 'Stream / online source' : (meta.sourceType === 'midi' ? 'MIDI sequence file' : 'Local file metadata');
            if (sourceDetailEl) sourceDetailEl.innerText = meta.streamUrl || meta.localPath || meta.desktopPath || meta.phonePath || meta.fileName || 'No location recorded';
            const playlistsDisplay = document.getElementById('meta-playlists-display');
            if (playlistsDisplay) playlistsDisplay.innerText = playlistNames.length ? playlistNames.join(' / ') : 'No playlists assigned.';

            const tagContainer = document.getElementById('meta-tags-list');
            tagContainer.innerHTML = "";
            if (meta.tags && meta.tags.length) {
                (meta.tags || []).forEach(tag => {
                    const badge = document.createElement('span');
                    badge.className = 'tag-badge';
                    badge.innerText = tag;
                    tagContainer.appendChild(badge);
                });
            } else {
                tagContainer.innerHTML = '<span class="library-track-meta">No tags.</span>';
            }
            const inlineTags = document.getElementById('input-inline-tags');
            if (inlineTags) inlineTags.value = (meta.tags || []).join(', ');
            const inlineName = document.getElementById('input-inline-nickname');
            if (inlineName) inlineName.value = meta.nickname || '';
            const trackImage = document.getElementById('input-track-image-url');
            if (trackImage) trackImage.value = meta.imageUrl || '';

            if (meta.tags && meta.tags.length > 0) {
                tagsBar.classList.add('is-open');
                tagsBar.innerHTML = "";
                meta.tags.forEach(tag => {
                    const badge = document.createElement('span');
                    badge.className = 'tag-badge';
                    badge.innerText = `# ${tag}`;
                    tagsBar.appendChild(badge);
                });
            } else {
                tagsBar.classList.remove('is-open');
            }

            renderActiveTrackPlaylistEditor();

            const lyricsViewer = document.getElementById('lyrics-viewer');
            lyricsViewer.innerText = meta.lyrics || "No lyrics stored yet. Click the ♫ icon on the player utility pill to edit.";
            updateNowPlayingPlaylistPanel();
            renderPlaylistDetailPanel();
            renderLibraryManager();
            scrollCurrentTrackRowsIntoView('metadata-update');
        }

        // --- 3. WORKSPACE VIEWPORT TABS ROUTER ---
        function switchWorkspaceTab(tabId) {
            saveLocalUiStateCheckpoint(`screen-change-before:${tabId}`);

            const targetTab = document.getElementById(tabId);
            if (!targetTab) return;

            if (libraryDrawer && libraryDrawer.classList.contains('drawer-open')) {
                toggleLibraryDrawer(false);
            }

            document.querySelectorAll('.mode-tab-btn').forEach(btn => btn.classList.remove('tab-active'));
            const btnEl = document.getElementById(`tab-btn-${tabId.replace('tab-', '')}`);
            if (btnEl) btnEl.classList.add('tab-active');

            document.querySelectorAll('.viewport-content').forEach(card => card.classList.remove('active-content'));
            targetTab.classList.add('active-content');

            if (tabId === "tab-playlists") renderPlaylistsList();
            if (tabId === "tab-history") renderHistoryTab();

            try {
                localStorage.setItem(ACTIVE_WORKSPACE_TAB_KEY, tabId);
            } catch (err) {
                console.warn('Could not save active workspace tab:', err);
            }
            saveLocalUiStateCheckpoint(`screen-change-after:${tabId}`);
        }

        function saveLastPlayedTrack(reason = 'track-change') {
            if (!currentFile || !currentFile.name || !virtualLibrary[currentFile.name]) return;
            try {
                localStorage.setItem(LAST_PLAYED_TRACK_KEY, currentFile.name);
                const playlistName = getCurrentPlaybackPlaylistName();
                if (playlistName) localStorage.setItem(LAST_PLAYED_PLAYLIST_KEY, playlistName);
            } catch (err) {
                console.warn('Could not save last played track:', err);
            }
        }

        function restoreLastPlayedTrack() {
            const lastId = localStorage.getItem(LAST_PLAYED_TRACK_KEY);
            if (!lastId || !virtualLibrary[lastId]) return false;
            addTrackToQueueFromLibrary(lastId, true);
            return true;
        }

        // --- 4. PLAYBACK TRANSPORT DECKS CONTROLS ---
        async function playAudio() {
            if (!currentFile) return;

            if (activeAudio === localAudio) {
                await initAudioEngine();
            }

            try {
                await activeAudio.play();
                isPlaying = true;
                btnPlay.textContent = '🧿';
                btnPlay.classList.add('active-state');
            } catch (err) {
                isPlaying = false;
                btnPlay.textContent = '🧿';
                btnPlay.classList.remove('active-state');
                console.warn('Playback failed:', err);
                showToast('Playback blocked or failed. Click Play again.');
            }
        }

        function pauseAudio() {
            activeAudio.pause();
            isPlaying = false;
            btnPlay.textContent = '🧿';
            btnPlay.classList.remove('active-state');
        }

        function togglePrimaryPlayControl() {
            if (!currentFile && !restoreLastPlayedTrack()) return;
            if (ignoreNextPlayClick) {
                ignoreNextPlayClick = false;
                return;
            }
            if (isPlaying && !activeAudio.paused) pauseAudio();
            else playAudio();
        }

        btnPlay.addEventListener('click', togglePrimaryPlayControl);

        if (btnPause) {
            btnPause.addEventListener('click', () => {
                if (!currentFile) return;
                pauseAudio();
            });
        }

        // --- PLAY BUTTON HOLD-TO-FAST-FORWARD LOGIC ---
        function startPlayHold() {
            if (!currentFile) return;
            isHoldingPlay = false;
            preHoldSpeed = parseFloat(speedSlider.value);
            
            playButtonHoldTimeout = setTimeout(() => {
                isHoldingPlay = true;
                activeAudio.playbackRate = 1.5;
                if (!isPlaying) activeAudio.play();
                showToast("⚡ Fast Forwarding (1.5x) ⚡");
            }, 300);
        }

        function releasePlayHold() {
            clearTimeout(playButtonHoldTimeout);
            if (isHoldingPlay) {
                activeAudio.playbackRate = preHoldSpeed;
                if (!isPlaying) activeAudio.pause();
                isHoldingPlay = false;
                ignoreNextPlayClick = true;
                setTimeout(() => { ignoreNextPlayClick = false; }, 350);
            }
        }

        btnPlay.addEventListener('mousedown', startPlayHold);
        btnPlay.addEventListener('mouseup', releasePlayHold);
        btnPlay.addEventListener('mouseleave', () => { if (isHoldingPlay) releasePlayHold(); });
        btnPlay.addEventListener('touchstart', (e) => { e.preventDefault(); startPlayHold(); }, { passive: false });
        btnPlay.addEventListener('touchend', (e) => {
            e.preventDefault();
            const wasHolding = isHoldingPlay;
            releasePlayHold();
            if (!wasHolding) togglePrimaryPlayControl();
        }, { passive: false });
        btnPlay.addEventListener('touchcancel', (e) => { e.preventDefault(); releasePlayHold(); }, { passive: false });

        // --- ⏮ SKIP / RESTART NAVIGATION ACTION ---
        btnPrev.addEventListener('click', () => {
            if (!currentFile) return;
            const now = Date.now();
            if (now - lastPrevClickTime < 350) {
                skipToPreviousTrack();
            } else {
                if (activeAudio.currentTime > 3.0) {
                    activeAudio.currentTime = 0;
                    showToast("Restarting Track");
                } else {
                    skipToPreviousTrack();
                }
            }
            lastPrevClickTime = now;
        });

        function skipToPreviousTrack() {
            if (playlistTracks.length <= 1) { activeAudio.currentTime = 0; return; }
            let prevIndex = currentTrackIndex - 1;
            if (prevIndex < 0) prevIndex = isRepeatAll ? playlistTracks.length - 1 : 0;
            switchTrack(prevIndex);
        }

        btnNext.addEventListener('click', skipToNextTrack);

        function skipToNextTrack() {
            if (playlistTracks.length === 0) return;
            if (playlistTracks.length === 1 && !isRepeatAll && !isRepeatOne) {
                activeAudio.currentTime = 0;
                pauseAudio();
                return;
            }

            let nextIndex = currentTrackIndex + 1;
            if (isShuffle) {
                nextIndex = Math.floor(Math.random() * playlistTracks.length);
            } else if (nextIndex >= playlistTracks.length) {
                nextIndex = isRepeatAll ? 0 : playlistTracks.length - 1;
            }
            switchTrack(nextIndex);
        }

        btnSpeedCycle.addEventListener('click', () => {
            currentSpeedIdx = (currentSpeedIdx + 1) % speedCycles.length;
            const chosenSpeed = speedCycles[currentSpeedIdx];
            
            activeAudio.playbackRate = chosenSpeed;
            speedSlider.value = chosenSpeed;
            document.getElementById('speed-readout').innerText = chosenSpeed.toFixed(1) + "x";
            
            btnSpeedCycle.innerText = `🚀${chosenSpeed.toFixed(1).replace('.0', '')}`;
            showToast(`Speed set to ${chosenSpeed.toFixed(1)}x`);
        });

        function formatTime(seconds) {
            if (isNaN(seconds)) return "0:00";
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        }

        seekBar.addEventListener('input', () => {
            isSeeking = true;
            timeCurrent.innerText = formatTime(seekBar.value);
        });

        seekBar.addEventListener('change', () => {
            isSeeking = false;
            activeAudio.currentTime = seekBar.value;
        });

        // --- 5. DRAGGABLE + RESIZABLE SETTINGS POPUP ENGINE LOGIC ---
        let isDraggingPopup = false;
        let isResizingPopup = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let resizeStartX = 0;
        let resizeStartY = 0;
        let resizeStartWidth = 0;
        let resizeStartHeight = 0;
        const dragHandle = document.getElementById('settings-drag-handle');
        const resizeHandle = document.getElementById('settings-resize-handle');

        function resetSettingsPopupPosition() {
            document.documentElement.style.setProperty('--settings-popup-left', '50%');
            document.documentElement.style.setProperty('--settings-popup-top', '30%');
            document.documentElement.style.setProperty('--settings-popup-transform', 'translate(-50%, -30%)');
            document.documentElement.style.setProperty('--settings-popup-width', '430px');
            document.documentElement.style.setProperty('--settings-popup-height', 'auto');
        }

        function setSettingsPopupPosition(x, y) {
            const maxX = Math.max(8, window.innerWidth - advancedControls.offsetWidth - 8);
            const maxY = Math.max(8, window.innerHeight - 48);
            const safeX = Math.min(Math.max(8, x), maxX);
            const safeY = Math.min(Math.max(8, y), maxY);
            document.documentElement.style.setProperty('--settings-popup-left', `${safeX}px`);
            document.documentElement.style.setProperty('--settings-popup-top', `${safeY}px`);
            document.documentElement.style.setProperty('--settings-popup-transform', 'none');
        }

        function setSettingsPopupSize(width, height) {
            const safeWidth = Math.min(Math.max(360, width), Math.max(360, window.innerWidth - 24));
            const safeHeight = Math.min(Math.max(360, height), Math.max(360, window.innerHeight - 24));
            document.documentElement.style.setProperty('--settings-popup-width', `${safeWidth}px`);
            document.documentElement.style.setProperty('--settings-popup-height', `${safeHeight}px`);
        }

        function beginSettingsPopupDrag(clientX, clientY) {
            const rect = advancedControls.getBoundingClientRect();
            document.documentElement.style.setProperty('--settings-popup-left', `${rect.left}px`);
            document.documentElement.style.setProperty('--settings-popup-top', `${rect.top}px`);
            document.documentElement.style.setProperty('--settings-popup-transform', 'none');
            isDraggingPopup = true;
            dragStartX = clientX - rect.left;
            dragStartY = clientY - rect.top;
        }

        btnToggleAdvanced.addEventListener('click', () => {
            const willOpen = !advancedControls.classList.contains('is-open');
            advancedControls.classList.toggle('is-open', willOpen);
            btnToggleAdvanced.classList.toggle('active-state', willOpen);
            if (willOpen) resetSettingsPopupPosition();
        });

        btnCloseSettings.addEventListener('click', () => {
            advancedControls.classList.remove('is-open');
            btnToggleAdvanced.classList.remove('active-state');
            saveLocalUiStateCheckpoint('settings-popup-close');
            flushActiveLibraryState('settings-popup-close-flush');
        });

        dragHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            beginSettingsPopupDrag(e.clientX, e.clientY);
            document.addEventListener('mousemove', onPopupDragMove);
            document.addEventListener('mouseup', onPopupDragEnd);
        });

        function onPopupDragMove(e) {
            if (!isDraggingPopup) return;
            setSettingsPopupPosition(e.clientX - dragStartX, e.clientY - dragStartY);
        }

        function onPopupDragEnd() {
            isDraggingPopup = false;
            document.removeEventListener('mousemove', onPopupDragMove);
            document.removeEventListener('mouseup', onPopupDragEnd);
        }

        dragHandle.addEventListener('touchstart', (e) => {
            if (!e.touches || !e.touches.length) return;
            const touch = e.touches[0];
            beginSettingsPopupDrag(touch.clientX, touch.clientY);
            document.addEventListener('touchmove', onPopupTouchMove, { passive: false });
            document.addEventListener('touchend', onPopupTouchEnd);
        }, { passive: true });

        function onPopupTouchMove(e) {
            if (!isDraggingPopup || !e.touches || !e.touches.length) return;
            e.preventDefault();
            const touch = e.touches[0];
            setSettingsPopupPosition(touch.clientX - dragStartX, touch.clientY - dragStartY);
        }

        function onPopupTouchEnd() {
            isDraggingPopup = false;
            document.removeEventListener('touchmove', onPopupTouchMove);
            document.removeEventListener('touchend', onPopupTouchEnd);
        }

        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = advancedControls.getBoundingClientRect();
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                resizeStartWidth = rect.width;
                resizeStartHeight = rect.height;
                isResizingPopup = true;
                document.body.classList.add('is-resizing-settings-popup');
                document.addEventListener('mousemove', onSettingsResizeMove);
                document.addEventListener('mouseup', onSettingsResizeEnd);
            });
        }

        function onSettingsResizeMove(e) {
            if (!isResizingPopup) return;
            setSettingsPopupSize(resizeStartWidth + (e.clientX - resizeStartX), resizeStartHeight + (e.clientY - resizeStartY));
        }

        function onSettingsResizeEnd() {
            isResizingPopup = false;
            document.body.classList.remove('is-resizing-settings-popup');
            document.removeEventListener('mousemove', onSettingsResizeMove);
            document.removeEventListener('mouseup', onSettingsResizeEnd);
        }

        volSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 1;
            if (gainNode) gainNode.gain.value = val;
            // Streams are not routed through WebAudio by default, so boost is capped to normal HTMLAudio volume.
            streamAudio.volume = Math.min(1, Math.max(0, val));
            document.getElementById('vol-readout').innerText = Math.round(val * 100) + "%";
        });

        if (speedSlider) speedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            activeAudio.playbackRate = val;
            const speedReadout = document.getElementById('speed-readout');
            if (speedReadout) speedReadout.innerText = val.toFixed(1) + "x";
            if (btnSpeedCycle) btnSpeedCycle.innerText = `🚀${val.toFixed(1).replace('.0', '')}`;
        });

        initVisualizerComposerUI();
        restoreLocalUiScreen();

        safeBind('btn-export-everything-json', 'click', () => {
            const data = buildEverythingExport();
            downloadJsonFile(`${slugifyFileName(data.settings?.libraryName || 'onda')}-everything-backup.json`, data);
            showToast('Exported everything backup JSON.');
        });



        // --- 5D. MISSING INFO EXPORT / METADATA OVERLAY MERGE ---
        function hasMissingMetadata(meta = {}) { return (!meta.artist && !meta.album && !meta.genre && !meta.year) || (!meta.bpm && !meta.key) || !meta.lyrics; }
        function buildMissingInfoExport() {
            const tracks = Object.values(virtualLibrary || {}).filter(Boolean).filter(hasMissingMetadata).map(meta => ({ id: meta.id || '', fileName: meta.fileName || '', title: meta.title || meta.nickname || meta.fileName || '', nickname: meta.nickname || '', sourceType: meta.sourceType || '', streamUrl: meta.streamUrl || '', referenceUrl: meta.referenceUrl || '', provider: meta.provider || '', duration: meta.duration || '', size: meta.size || '', currentTags: meta.tags || [], missing: { artist: !meta.artist, album: !meta.album, genre: !meta.genre, year: !meta.year, bpm: !meta.bpm, key: !meta.key, lyrics: !meta.lyrics } }));
            return { app: 'Onda Media Player', type: 'onda-missing-info-request', version: 1, exportedAt: new Date().toISOString(), instructions: 'Use this to research/fill missing metadata. Return an onda-metadata-overlay JSON. Do not change local paths, stream URLs, play stats, or playlist membership unless explicitly requested.', tracks };
        }
        function normaliseMatchText(value = '') { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
        function findTrackForOverlayRecord(record = {}) {
            const match = record.match || record;
            const directIds = [match.id, match.trackId, record.id, record.trackId].filter(Boolean);
            for (const id of directIds) if (virtualLibrary[id]) return id;
            const fileName = normaliseMatchText(match.fileName || record.fileName || '');
            const title = normaliseMatchText(match.title || record.title || '');
            const artist = normaliseMatchText(match.artist || record.artist || '');
            const entries = Object.entries(virtualLibrary || {});
            if (fileName) { const found = entries.find(([, meta]) => normaliseMatchText(meta.fileName) === fileName || normaliseMatchText(meta.localPath).endsWith(fileName)); if (found) return found[0]; }
            if (title) { const found = entries.find(([, meta]) => { const metaTitle = normaliseMatchText(meta.title || meta.nickname || meta.fileName); const metaArtist = normaliseMatchText(meta.artist || ''); return metaTitle === title && (!artist || metaArtist === artist || !metaArtist); }); if (found) return found[0]; }
            return '';
        }
        function mergeMetadataOverlay(data = {}) {
            const records = Array.isArray(data.tracks) ? data.tracks : Array.isArray(data.items) ? data.items : [];
            let matched = 0, unmatched = 0;
            const safeScalarFields = ['artist','album','albumArtist','genre','year','bpm','key','mood','energy','rating','notes','lyrics','imageUrl','visualizerPreset','composer','isrc','musicbrainzId'];
            records.forEach(record => { const id = findTrackForOverlayRecord(record); if (!id || !virtualLibrary[id]) { unmatched++; return; } const details = record.details || record.metadata || record; const meta = virtualLibrary[id]; safeScalarFields.forEach(field => { if (typeof details[field] !== 'undefined' && details[field] !== null && details[field] !== '') meta[field] = details[field]; }); if (Array.isArray(details.tags)) meta.tags = Array.from(new Set([...(meta.tags || []), ...details.tags])); if (Array.isArray(details.moods)) meta.moods = Array.from(new Set([...(meta.moods || []), ...details.moods])); meta.updatedAt = new Date().toISOString(); matched++; });
            syncAllTrackPlaylistMetadata(); renderLibraryManager(); updateMetadataUI(); saveActiveLibraryState('metadata-overlay-import'); showToast(`Metadata overlay merged: ${matched} matched, ${unmatched} unmatched.`);
        }
        function importMetadataOverlayFile(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { mergeMetadataOverlay(JSON.parse(reader.result)); } catch (err) { showToast('Metadata overlay import failed: invalid JSON.'); } }; reader.readAsText(file); }
        function updateSettingsHealthPanel() {
            const grid = document.getElementById('settings-health-grid'); if (!grid) return;
            const trackCount = Object.keys(virtualLibrary || {}).length;
            const playlistCount = Object.keys(playlists || {}).length;
            const missingRelink = Object.values(virtualLibrary || {}).filter(meta => meta && meta.sourceType !== 'stream' && meta.sourceType !== 'reference' && !meta.blobFile).length;
            const noLyrics = Object.values(virtualLibrary || {}).filter(meta => meta && !meta.lyrics).length;
            const noTags = Object.values(virtualLibrary || {}).filter(meta => meta && (!meta.tags || !meta.tags.length)).length;
            const device = localStorage.getItem('ondaCloudDeviceIdV1') || localStorage.getItem('onda-cloud-device-id') || 'not set';
            const lastCloud = localStorage.getItem('ondaCloudLastSyncV1') || 'not recorded';
            grid.innerHTML = [['Tracks',trackCount],['Playlists',playlistCount],['Needs relink',missingRelink],['Missing lyrics',noLyrics],['No tags',noTags],['Device profile',device],['Last cloud sync',lastCloud]].map(([label,value]) => `<div class="settings-health-item"><div class="settings-health-label">${escapeHtml(label)}</div><div class="settings-health-value">${escapeHtml(value)}</div></div>`).join('');
        }
        function exportMissingInfoJson() { const data = buildMissingInfoExport(); downloadJsonFile(`onda-missing-info-${new Date().toISOString().slice(0,10)}.json`, data); showToast(`Exported ${data.tracks.length} tracks with missing info.`); }
        safeBind('btn-export-missing-info','click',exportMissingInfoJson);
        safeBind('btn-db-export-missing-info','click',exportMissingInfoJson);
        safeBind('btn-import-metadata-overlay-settings','click',() => document.getElementById('metadata-overlay-file-input')?.click());
        safeBind('btn-db-import-metadata-overlay','click',() => document.getElementById('metadata-overlay-file-input')?.click());
        document.getElementById('metadata-overlay-file-input')?.addEventListener('change', e => { importMetadataOverlayFile(e.target.files?.[0]); e.target.value = ''; });

        safeBind('btn-save-local-now', 'click', async () => {
            await flushActiveLibraryState('manual-settings-save-local-now');
            showToast('Saved local library now.');
        });

        safeBind('btn-export-settings-json', 'click', () => {
            const data = buildSettingsExport({ includePlaylists: false });
            downloadJsonFile(`${slugifyFileName(data.settings?.libraryName || 'onda-settings')}-settings.json`, data);
            showToast('Exported settings JSON.');
        });

        safeBind('btn-backup-settings-playlists', 'click', () => {
            const data = buildSettingsExport({ includePlaylists: true });
            downloadJsonFile(`${slugifyFileName(data.settings?.libraryName || 'onda')}-settings-playlists-backup.json`, data);
            showToast('Exported settings + playlists backup.');
        });

        safeBind('btn-import-settings-json', 'click', () => {
            document.getElementById('settings-json-file-input')?.click();
        });

        document.getElementById('settings-json-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const raw = await file.text();
                const data = JSON.parse(raw);
                applyImportedSettingsJson(data);
            } catch (err) {
                console.error(err);
                showToast('Import failed: invalid settings/backup JSON.');
            }
            e.target.value = '';
        });

        safeBind('btn-startup-upload-backup', 'click', () => document.getElementById('startup-backup-file-input')?.click());
        safeBind('btn-startup-use-online', 'click', () => importOndaJsonFromUrl(document.getElementById('startup-online-library-url')?.value || ''));
        safeBind('btn-startup-continue-empty', 'click', () => {
            closeStartupRecoveryModal();
            saveActiveLibraryState('startup-continue-empty');
        });
        safeBind('btn-startup-recovery-close', 'click', closeStartupRecoveryModal);

        document.getElementById('startup-backup-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const raw = await file.text();
                const data = JSON.parse(raw);
                applyImportedSettingsJson(data);
                await flushActiveLibraryState('startup-backup-json-import');
                closeStartupRecoveryModal();
                showToast('Imported backup JSON.');
            } catch (err) {
                console.error(err);
                showToast('Import failed: invalid backup JSON.');
            }
            e.target.value = '';
        });

        document.getElementById('btn-import-json').addEventListener('click', () => {
            document.getElementById('json-file-input').click();
        });

        document.getElementById('json-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const raw = await file.text();
                const data = JSON.parse(raw);
                importOndaLibrary(data);
            } catch (err) {
                console.error(err);
                showToast('Import failed: invalid or unsupported JSON.');
            }
            e.target.value = "";
        });

        document.getElementById('btn-export-library').addEventListener('click', () => {
            const data = buildLibraryExport({ streamingOnly: false });
            downloadJsonFile(`${slugifyFileName(data.libraryName)}.json`, data);
            showToast('Exported full library JSON.');
        });

        document.getElementById('btn-export-streams').addEventListener('click', () => {
            const data = buildLibraryExport({ streamingOnly: true });
            downloadJsonFile(`${slugifyFileName(data.libraryName)}-streams.json`, data);
            showToast('Exported streaming add-on library JSON.');
        });

        document.getElementById('btn-check-library').addEventListener('click', () => {
            checkLibraryFiles();
        });

        safeBind('btn-db-add-folder', 'click', () => {
            if (!folderInput) {
                showToast('Folder picker is not available in this browser.');
                return;
            }
            folderInput.click();
        });
        safeBind('btn-db-save-local-now', 'click', async () => {
            await flushActiveLibraryState('manual-library-drawer-save');
            showToast('Saved local library now.');
        });
        safeBind('btn-db-export-everything', 'click', () => {
            const data = buildEverythingExport();
            downloadJsonFile(`${slugifyFileName(data.settings?.libraryName || 'onda')}-everything-backup.json`, data);
            showToast('Exported everything backup JSON.');
        });
        safeBind('btn-db-import-json', 'click', () => document.getElementById('json-file-input').click());
        safeBind('btn-db-export-library', 'click', () => {
            const data = buildLibraryExport({ streamingOnly: false });
            downloadJsonFile(`${slugifyFileName(data.libraryName)}.json`, data);
            showToast('Exported full library JSON.');
        });
        safeBind('btn-db-export-streams', 'click', () => {
            const data = buildLibraryExport({ streamingOnly: true });
            downloadJsonFile(`${slugifyFileName(data.libraryName)}-streams.json`, data);
            showToast('Exported streaming add-on library JSON.');
        });
        safeBind('btn-db-export-playlist', 'click', () => exportPlaylistJson());
        safeBind('btn-db-check-library', 'click', () => checkLibraryFiles());
        safeBind('btn-database-engine', 'click', () => {
            if (suppressLibraryDrawerToggleClick) return;
            toggleLibraryDrawer();
        });
        if (btnDatabaseEngine) {
            btnDatabaseEngine.addEventListener('pointerdown', startLibraryDrawerResize);
            window.addEventListener('pointermove', moveLibraryDrawerResize, { passive: false });
            window.addEventListener('pointerup', endLibraryDrawerResize);
            window.addEventListener('pointercancel', endLibraryDrawerResize);
        }
        document.querySelectorAll('.library-drawer-resize-handle').forEach(handle => {
            handle.addEventListener('pointerdown', startLibraryDrawerCornerResize);
        });
        window.addEventListener('pointermove', moveLibraryDrawerCornerResize, { passive: false });
        window.addEventListener('pointerup', endLibraryDrawerCornerResize);
        window.addEventListener('pointercancel', endLibraryDrawerCornerResize);
        safeBind('btn-close-library-manager', 'click', () => toggleLibraryDrawer(false));

        safeBind('btn-db-clear-search', 'click', () => {
            if (!dbLibrarySearch) return;
            dbLibrarySearch.value = '';
            renderLibraryManager();
            dbLibrarySearch.focus();
        });
        document.querySelectorAll('.mobile-db-icon-btn[data-mobile-view]').forEach(btn => {
            btn.addEventListener('click', () => setMobileLibraryView(btn.dataset.mobileView || 'results'));
        });
        document.querySelectorAll('.mobile-db-icon-btn[data-proxy-click]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.proxyClick);
                if (target) target.click();
            });
        });
        if (mobileIconHelpList) {
            mobileIconHelpList.addEventListener('change', (e) => {
                if (!e.target.matches('.mobile-icon-edit-input')) return;
                updateMobileIconSetting(e.target.dataset.iconEditKey, e.target.value);
            });
            mobileIconHelpList.addEventListener('keydown', (e) => {
                if (!e.target.matches('.mobile-icon-edit-input')) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    updateMobileIconSetting(e.target.dataset.iconEditKey, e.target.value);
                    e.target.blur();
                }
            });
        }
        safeBind('btn-reset-mobile-icons', 'click', resetMobileIconSettings);
        applyMobileIconSettings();
        if (dbLibrarySearch) {
            const startSearchHold = () => {
                searchHoldTriggered = false;
                clearTimeout(searchHoldTimer);
                searchHoldTimer = setTimeout(() => {
                    searchHoldTriggered = true;
                    promptSearchFuzziness();
                }, 650);
            };
            const cancelSearchHold = () => clearTimeout(searchHoldTimer);
            dbLibrarySearch.addEventListener('touchstart', startSearchHold, { passive: true });
            dbLibrarySearch.addEventListener('mousedown', startSearchHold);
            ['touchend', 'touchcancel', 'mouseup', 'mouseleave', 'blur'].forEach(evt => dbLibrarySearch.addEventListener(evt, cancelSearchHold));
            dbLibrarySearch.addEventListener('contextmenu', (e) => {
                if (searchHoldTriggered) e.preventDefault();
            });
        }
        safeBind('btn-db-select-mode', 'click', () => toggleLibrarySelectMode());
        safeBind('btn-db-settings-mode', 'click', () => setLibraryActionPanel('settings'));
        safeBind('btn-mobile-select-mode', 'click', () => setLibraryActionPanel('select'));
        safeBind('btn-mobile-settings-mode', 'click', () => setLibraryActionPanel('settings'));
        setLibraryActionPanel(localStorage.getItem('ondaLibraryActionPanel') || 'select');
        safeBind('btn-db-select-visible', 'click', () => {
            visibleLibraryIds.forEach(id => selectedLibraryIds.add(id));
            updateBulkActionUI();
            renderLibraryManager();
        });
        safeBind('btn-db-clear-selection', 'click', () => {
            selectedLibraryIds.clear();
            updateBulkActionUI();
            renderLibraryManager();
        });
        safeBind('btn-db-invert-selection', 'click', () => {
            visibleLibraryIds.forEach(id => {
                if (selectedLibraryIds.has(id)) selectedLibraryIds.delete(id);
                else selectedLibraryIds.add(id);
            });
            updateBulkActionUI();
            renderLibraryManager();
        });
        safeBind('btn-db-bulk-add-playlist', 'click', openBulkAddPlaylistModal);
        safeBind('btn-db-bulk-create-playlist', 'click', createPlaylistForSelected);
        safeBind('btn-db-bulk-attributes', 'click', openBulkAttributesModal);
        safeBind('btn-db-bulk-export', 'click', exportSelectedLibraryJson);
        safeBind('btn-db-bulk-delete', 'click', deleteSelectedFromLibrary);
        safeBind('btn-apply-bulk-playlists', 'click', applyBulkPlaylistAdd);
        safeBind('btn-apply-bulk-attributes', 'click', applyBulkAttributes);
        safeBind('btn-save-playlist-edit', 'click', savePlaylistEdit);
        safeBind('btn-playlist-remove-selected', 'click', removeSelectedTracksFromEditingPlaylist);
        safeBind('btn-playlist-clear-tracks', 'click', clearEditingPlaylistTracks);
        const playlistEditTrackList = document.getElementById('playlist-edit-track-list');
        if (playlistEditTrackList) {
            playlistEditTrackList.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.btn-playlist-edit-remove');
                if (removeBtn) {
                    const id = removeBtn.dataset.trackId;
                    if (removeTrackIdFromPlaylistOnly(editingPlaylistName, id)) {
                        renderPlaylistEditTracks(editingPlaylistName);
                        renderPlaylistsList();
                        renderLibraryManager();
                        if (currentFile) updateMetadataUI();
                        saveActiveLibraryState('playlist-edit-remove-one');
                        showToast('Track removed from playlist.');
                    }
                    return;
                }
                const playBtn = e.target.closest('.btn-playlist-edit-play');
                if (playBtn) {
                    addTrackToQueueFromLibrary(playBtn.dataset.trackId, true);
                }
            });
        }
        const playlistImageFileInput = document.getElementById('input-playlist-image-file');
        if (playlistImageFileInput) {
            playlistImageFileInput.addEventListener('change', () => {
                const file = playlistImageFileInput.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => updatePlaylistImagePreview(reader.result);
                reader.readAsDataURL(file);
            });
        }
        const playlistImageUrlInput = document.getElementById('input-playlist-image-url');
        if (playlistImageUrlInput) playlistImageUrlInput.addEventListener('input', () => updatePlaylistImagePreview(playlistImageUrlInput.value.trim()));
        if (dbLibrarySearch) dbLibrarySearch.addEventListener('input', renderLibraryManager);
        if (dbLibraryFilter) dbLibraryFilter.addEventListener('change', renderLibraryManager);
        if (dbLibraryResults) {
            dbLibraryResults.addEventListener('click', (e) => {
                const trackId = e.target.dataset.trackId || e.target.closest('[data-track-id]')?.dataset.trackId || e.target.closest('.library-result-row')?.dataset.trackId;
                if (!trackId) return;

                if (e.target.closest('.btn-db-play-track')) {
                    addTrackToQueueFromLibrary(trackId, true);
                    return;
                }

                if (e.target.closest('.btn-db-info-track')) {
                    currentFile = createPlayableTrackFromMeta(virtualLibrary[trackId]);
                    currentFile.name = trackId;
                    switchWorkspaceTab('tab-library');
                    updateMetadataUI();
                    return;
                }

                if (e.target.closest('.btn-onda-add-playlist')) {
                    const playlistName = prompt('Add this track to which playlist? Type an existing or new playlist name:');
                    if (playlistName && playlistName.trim()) {
                        addTrackIdToPlaylist(trackId, playlistName.trim());
                        syncAllTrackPlaylistMetadata();
                        renderPlaylistsList();
                        renderLibraryManager();
                        updateMetadataUI();
                        saveActiveLibraryState('library-row-add-to-playlist');
                        showToast(`Added to playlist: ${playlistName.trim()}`);
                    }
                    return;
                }

                toggleSelectedTrack(trackId);
            });
        }
        if (dbRecentList) {
            dbRecentList.addEventListener('click', (e) => {
                const trackId = e.target.closest('.library-mini-row')?.dataset.trackId;
                if (trackId) addTrackToQueueFromLibrary(trackId, true);
            });
        }
        if (historyCardGrid) historyCardGrid.addEventListener('click', handleHistoryTrackClick);
        if (historyList) historyList.addEventListener('click', handleHistoryTrackClick);
        if (dbPlaylistList) {
            dbPlaylistList.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-db-edit-playlist');
                if (editBtn) {
                    openPlaylistEditModal(editBtn.dataset.playlistName);
                    return;
                }
                const name = e.target.closest('.library-mini-row')?.dataset.playlistName;
                if (!name) return;
                activePlaylistView = name;
                switchWorkspaceTab('tab-playlists');
                renderPlaylistsList();
                renderLibraryManager();
            });
        }
        safeBind('btn-inline-tags-save', 'click', saveActiveTrackInlineTags);
        safeBind('btn-inline-playlists-save', 'click', saveActiveTrackPlaylistMembership);
        safeBind('btn-inline-create-playlist', 'click', createPlaylistFromActiveTrack);

        const nowPlayingModePills = document.getElementById('now-playing-mode-pills');
        if (nowPlayingModePills) {
            nowPlayingModePills.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-now-toggle]');
                if (!btn || btn.disabled) return;
                setNowPlayingVisibilityToggle(btn.dataset.nowToggle);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllModals();
        });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.organon-modal .btn-pill');
            if (!btn) return;
            if ((btn.textContent || '').trim().toLowerCase() === 'cancel') {
                closeAllModals();
            }
        }, true);

        // --- 6. LOAD FROM URL / GOOGLE DRIVE LINK CONVERTER (TAB 2) ---
        const urlInputBox = document.getElementById('url-input-box');
        const btnLoadUrl = document.getElementById('btn-load-url');

        function convertDriveLinkToStream(driveUrl) {
            if (driveUrl.includes('uc?export=download')) return driveUrl;
            const regex = /\/d\/([a-zA-Z0-9_-]+)/;
            const match = driveUrl.match(regex);
            if (match && match[1]) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
            const idRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
            const idMatch = driveUrl.match(idRegex);
            if (idMatch && idMatch[1]) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
            return driveUrl; 
        }

        if (btnLoadUrl) btnLoadUrl.addEventListener('click', () => {
            const rawUrl = urlInputBox.value.trim();
            if (!rawUrl) { showToast("Please enter a valid URL stream!"); return; }

            const streamUrl = convertDriveLinkToStream(rawUrl);
            let parsedName = "Remote Stream";
            try {
                const urlObj = new URL(rawUrl);
                const pathParts = urlObj.pathname.split('/');
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && lastPart.includes('.')) parsedName = decodeURIComponent(lastPart);
                else if (rawUrl.includes("drive.google.com")) parsedName = "Google Drive Stream File";
            } catch (err) {}

            const id = createTrackIdFromParts(['stream', streamUrl]);
            const newTrackFile = {
                name: id,
                libraryId: id,
                fileName: parsedName,
                sourceType: 'stream',
                streamUrl
            };

            if (!virtualLibrary[id]) {
                virtualLibrary[id] = {
                    id,
                    fileName: parsedName,
                    title: parsedName,
                    nickname: parsedName,
                    lyrics: "",
                    tags: ["URL Stream"],
                    playlists: [],
                    size: "URL Stream",
                    sourceType: "stream",
                    streamUrl,
                    localPath: null,
                    phonePath: null,
                    desktopPath: null,
                    imageUrl: null,
                    imageData: null
                };
                playlistTracks.push(newTrackFile);
            } else {
                virtualLibrary[id].streamUrl = streamUrl;
                if (!playlistTracks.some(track => track.name === id)) playlistTracks.push(newTrackFile);
            }

            urlInputBox.value = "";
            renderLibraryManager();
            saveActiveLibraryState('add-url-stream');
            showToast("Direct URL saved to library.");
            if (playlistTracks.length === 1) switchTrack(0);
        });



        // --- 6B. SIMPLE YOUTUBE SEARCH / EMBED PANEL ---
        const youtubeSearchBox = document.getElementById('youtube-search-box');
        const youtubeUrlBox = document.getElementById('youtube-url-box');
        const youtubeFrame = document.getElementById('youtube-frame');

        function extractYouTubeVideoId(value = '') {
            try {
                const url = new URL(value.trim());
                if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
                if (url.searchParams.get('v')) return url.searchParams.get('v');
                const parts = url.pathname.split('/').filter(Boolean);
                const embedIndex = parts.indexOf('embed');
                if (embedIndex !== -1 && parts[embedIndex + 1]) return parts[embedIndex + 1];
                const shortsIndex = parts.indexOf('shorts');
                if (shortsIndex !== -1 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];
                const liveIndex = parts.indexOf('live');
                if (liveIndex !== -1 && parts[liveIndex + 1]) return parts[liveIndex + 1];
            } catch (err) {}
            return '';
        }

        function setYouTubeFrame(src) {
            if (!youtubeFrame) return;
            youtubeFrame.src = src || 'about:blank';
        }

        function searchYouTubeInPanel() {
            const query = (youtubeSearchBox?.value || '').trim();
            if (!query) { showToast('Type a YouTube search first.'); return; }
            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank', 'noopener');
            showToast('Opened YouTube search results. Paste a specific video URL to embed it.');
        }

        function openYouTubeResults() {
            const query = (youtubeSearchBox?.value || '').trim();
            if (!query) { showToast('Type a YouTube search first.'); return; }
            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank', 'noopener');
        }

        function playYouTubeUrlInPanel() {
            const raw = (youtubeUrlBox?.value || '').trim();
            const id = extractYouTubeVideoId(raw);
            if (!id) { showToast('Paste a valid YouTube video URL.'); return; }
            setYouTubeFrame(`https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`);
        }

        safeBind('btn-youtube-search', 'click', searchYouTubeInPanel);
        safeBind('btn-youtube-open-results', 'click', openYouTubeResults);
        safeBind('btn-youtube-load-url', 'click', playYouTubeUrlInPanel);
        safeBind('btn-youtube-clear', 'click', () => setYouTubeFrame('about:blank'));


        // --- 6C. STREAMING PROVIDER CLEANUP / DIRECT URL / REFERENCES ---
        const streamingProviderSelect = document.getElementById('streaming-provider-select');
        const streamingProviderStatus = document.getElementById('streaming-provider-status');
        const streamingProviderMessages = {
            direct: 'Playable in Onda when the URL is a direct audio file or stream.',
            soundcloud: 'Embedded player. Save as a library reference; SoundCloud controls playback inside its own widget.',
            youtube: 'Search opens YouTube results. Specific videos embed only if the uploader allows embedding.',
            spotify: 'Embed/reference only for now. Full browser playback requires Spotify account/Premium work later.',
            apple: 'Reference only for now. Full playback needs MusicKit/account/developer-token work later.'
        };
        function setStreamingProvider(provider = 'direct') {
            document.querySelectorAll('.streaming-provider-card').forEach(card => card.classList.toggle('active', card.dataset.streamProvider === provider));
            if (streamingProviderStatus) streamingProviderStatus.textContent = streamingProviderMessages[provider] || '';
        }
        function normaliseStreamingReferenceTitle(url, fallback = 'Streaming Reference') {
            try { const u = new URL(url); const last = decodeURIComponent((u.pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ')); return last || u.hostname || fallback; } catch (err) { return fallback; }
        }
        function addReferenceToLibrary(provider, url, title = '') {
            const cleanUrl = (url || '').trim();
            if (!cleanUrl) { showToast('Paste a URL first.'); return; }
            const id = createTrackIdFromParts(['reference', provider, cleanUrl]);
            const displayTitle = title || normaliseStreamingReferenceTitle(cleanUrl, `${provider} reference`);
            virtualLibrary[id] = { ...(virtualLibrary[id] || {}), id, fileName: displayTitle, title: displayTitle, nickname: displayTitle, lyrics: virtualLibrary[id]?.lyrics || '', tags: Array.from(new Set([...(virtualLibrary[id]?.tags || []), 'Streaming Reference', provider])), playlists: virtualLibrary[id]?.playlists || [], size: 'Reference only', sourceType: 'reference', streamUrl: null, referenceUrl: cleanUrl, provider, localPath: null, phonePath: null, desktopPath: null, imageUrl: virtualLibrary[id]?.imageUrl || null, imageData: virtualLibrary[id]?.imageData || null, updatedAt: new Date().toISOString() };
            if (!playlistTracks.some(track => track.name === id)) playlistTracks.push({ name: id, libraryId: id, fileName: displayTitle, sourceType: 'reference', referenceUrl: cleanUrl });
            renderLibraryManager(); saveActiveLibraryState(`add-${provider}-reference`); showToast(`Saved ${provider} reference to library.`);
        }
        function previewDirectStreamUrl() {
            const rawUrl = (urlInputBox?.value || '').trim();
            if (!rawUrl) { showToast('Paste a direct audio URL first.'); return; }
            const streamUrl = convertDriveLinkToStream(rawUrl);
            activeAudio = streamAudio; streamAudio.pause(); streamAudio.src = streamUrl;
            currentFile = { name: '__preview_stream__', fileName: normaliseStreamingReferenceTitle(rawUrl, 'Direct URL Preview'), sourceType: 'stream', streamUrl };
            updateMetadataUI(); startVisualizer(); playAudio(); showToast('Previewing direct URL. Use Add to Library to save it.');
        }
        function embedSoundCloudUrl() { const url = (document.getElementById('soundcloud-url-box')?.value || '').trim(); if (!url) { showToast('Paste a SoundCloud URL first.'); return; } setYouTubeFrame(`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&show_teaser=false`); }
        function spotifyEmbedUrl(url = '') { try { const u = new URL(url.trim()); if (!u.hostname.includes('spotify.com')) return ''; const parts = u.pathname.split('/').filter(Boolean); const type = parts[0]; const id = parts[1]; if (!type || !id) return ''; return `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}`; } catch (err) { return ''; } }
        function embedSpotifyUrl() { const url = (document.getElementById('spotify-url-box')?.value || '').trim(); const embed = spotifyEmbedUrl(url); if (!embed) { showToast('Paste a valid Spotify URL.'); return; } setYouTubeFrame(embed); }
        function openAppleMusicUrl() { const url = (document.getElementById('apple-url-box')?.value || '').trim(); if (!url) { showToast('Paste an Apple Music URL first.'); return; } window.open(url, '_blank', 'noopener'); }
        streamingProviderSelect?.addEventListener('change', () => setStreamingProvider(streamingProviderSelect.value));
        safeBind('btn-stream-preview-url', 'click', previewDirectStreamUrl);
        safeBind('btn-soundcloud-embed', 'click', embedSoundCloudUrl);
        safeBind('btn-soundcloud-add-reference', 'click', () => addReferenceToLibrary('soundcloud', document.getElementById('soundcloud-url-box')?.value || ''));
        safeBind('btn-youtube-add-reference', 'click', () => addReferenceToLibrary('youtube', document.getElementById('youtube-url-box')?.value || document.getElementById('youtube-search-box')?.value || ''));
        safeBind('btn-spotify-embed', 'click', embedSpotifyUrl);
        safeBind('btn-spotify-add-reference', 'click', () => addReferenceToLibrary('spotify', document.getElementById('spotify-url-box')?.value || ''));
        safeBind('btn-apple-open', 'click', openAppleMusicUrl);
        safeBind('btn-apple-add-reference', 'click', () => addReferenceToLibrary('apple', document.getElementById('apple-url-box')?.value || ''));
        setStreamingProvider('direct');

        if (youtubeSearchBox) {
            youtubeSearchBox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') searchYouTubeInPanel();
            });
        }
        if (youtubeUrlBox) {
            youtubeUrlBox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') playYouTubeUrlInPanel();
            });
        }

        // --- 7. VIRTUAL PLAYLIST MANAGEMENT SYSTEM (TAB 3) ---
        const btnCreatePlaylistTrigger = document.getElementById('btn-create-playlist-trigger');
        const btnDeletePlaylistTrigger = document.getElementById('btn-delete-playlist-trigger');
        const playlistChecklistContainer = document.getElementById('playlists-checklist');

        function updatePlaylistImagePreview(src = '') {
            const preview = document.getElementById('playlist-image-preview');
            if (!preview) return;
            preview.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="Playlist preview">` : 'No playlist image';
        }

        function openPlaylistEditModal(name) {
            if (!name || !playlists[name]) return;
            editingPlaylistName = name;
            const meta = ensurePlaylistMeta(name);
            document.getElementById('input-playlist-edit-original-name').value = name;
            document.getElementById('input-playlist-edit-name').value = name;
            document.getElementById('input-playlist-image-url').value = meta.imageUrl || '';
            document.getElementById('input-playlist-image-file').value = '';
            updatePlaylistImagePreview(meta.imageData || meta.imageUrl || '');
            renderPlaylistEditTracks(name);
            showModal('modal-playlist-edit');
        }

        function renderPlaylistEditTracks(name = editingPlaylistName) {
            const list = document.getElementById('playlist-edit-track-list');
            const count = document.getElementById('playlist-edit-track-count');
            if (!list || !count) return;
            if (!name || !playlists[name]) {
                count.textContent = '0 tracks';
                list.innerHTML = '<div class="library-track-meta">Playlist not found.</div>';
                return;
            }
            const ids = normalisePlaylistToIds(playlists[name]).filter(Boolean);
            count.textContent = `${ids.length} track${ids.length === 1 ? '' : 's'}`;
            if (!ids.length) {
                list.innerHTML = '<div class="library-track-meta">No tracks in this playlist.</div>';
                return;
            }
            list.innerHTML = '';
            ids.forEach((trackId, index) => {
                const meta = virtualLibrary[trackId];
                const row = document.createElement('div');
                row.className = 'library-result-row playlist-edit-row';
                row.dataset.trackId = trackId;
                row.innerHTML = `
                    <div class="library-row-main">
                        <div class="library-row-main playlist-edit-row-main">
                            <input type="checkbox" class="playlist-edit-track-check" data-track-id="${escapeHtml(trackId)}">
                            <div>
                                <div class="library-track-title">${index + 1}. ${escapeHtml(meta ? getDisplayTitle(meta) : trackId)}</div>
                                <div class="library-track-meta">${escapeHtml(meta?.fileName || 'Missing library record')} · ${escapeHtml(meta ? sourceStatus(meta) : 'missing')}</div>
                            </div>
                        </div>
                        <div class="library-row-buttons">
                            ${meta ? `<button type="button" class="btn-pill btn-playlist-edit-play" data-track-id="${escapeHtml(trackId)}">Play</button>` : ''}
                            <button type="button" class="btn-pill btn-playlist-edit-remove btn-danger" data-track-id="${escapeHtml(trackId)}">Remove</button>
                        </div>
                    </div>`;
                list.appendChild(row);
            });
        }

        function removeTrackIdFromPlaylistOnly(playlistName, trackId) {
            if (!playlistName || !playlists[playlistName] || !trackId) return false;
            const before = normalisePlaylistToIds(playlists[playlistName]);
            const after = before.filter(id => id !== trackId);
            playlists[playlistName] = after.map(id => virtualLibrary[id] ? createPlayableTrackFromMeta(virtualLibrary[id]) : id);
            if (virtualLibrary[trackId]) syncTrackPlaylistMetadata(trackId);
            return after.length !== before.length;
        }

        function removeSelectedTracksFromEditingPlaylist() {
            if (!editingPlaylistName || !playlists[editingPlaylistName]) return;
            const selected = Array.from(document.querySelectorAll('#playlist-edit-track-list .playlist-edit-track-check:checked')).map(cb => cb.dataset.trackId).filter(Boolean);
            if (!selected.length) {
                showToast('Select playlist tracks to remove first.');
                return;
            }
            selected.forEach(id => removeTrackIdFromPlaylistOnly(editingPlaylistName, id));
            renderPlaylistEditTracks(editingPlaylistName);
            renderPlaylistsList();
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            saveActiveLibraryState('playlist-edit-remove-selected');
            showToast(`Removed ${selected.length} track${selected.length === 1 ? '' : 's'} from ${editingPlaylistName}.`);
        }

        function clearEditingPlaylistTracks() {
            if (!editingPlaylistName || !playlists[editingPlaylistName]) return;
            const ids = normalisePlaylistToIds(playlists[editingPlaylistName]);
            if (!ids.length) {
                showToast('This playlist is already empty.');
                return;
            }
            const ok = confirm(`Remove all ${ids.length} track${ids.length === 1 ? '' : 's'} from "${editingPlaylistName}"? The playlist itself and the library tracks will stay.`);
            if (!ok) return;
            playlists[editingPlaylistName] = [];
            ensurePlaylistMeta(editingPlaylistName).updatedAt = new Date().toISOString();
            ids.forEach(id => { if (virtualLibrary[id]) syncTrackPlaylistMetadata(id); });
            renderPlaylistEditTracks(editingPlaylistName);
            renderPlaylistsList();
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            saveActiveLibraryState('playlist-edit-clear-tracks');
            showToast(`Cleared tracks from ${editingPlaylistName}.`);
        }

        function savePlaylistEdit() {
            const original = document.getElementById('input-playlist-edit-original-name')?.value || editingPlaylistName;
            const newName = (document.getElementById('input-playlist-edit-name')?.value || '').trim();
            if (!original || !playlists[original]) { showToast('Playlist not found.'); return; }
            if (!newName) { showToast('Playlist name cannot be blank.'); return; }
            if (newName !== original && playlists[newName]) { showToast('A playlist with that name already exists.'); return; }
            const oldMeta = ensurePlaylistMeta(original);
            const imageUrl = (document.getElementById('input-playlist-image-url')?.value || '').trim();
            const fileInput = document.getElementById('input-playlist-image-file');
            const commit = (imageDataValue = oldMeta.imageData || '') => {
                const newMeta = { ...oldMeta, imageUrl, imageData: imageDataValue, updatedAt: new Date().toISOString() };
                if (newName !== original) {
                    playlists[newName] = playlists[original];
                    delete playlists[original];
                    playlistMeta[newName] = newMeta;
                    delete playlistMeta[original];
                    Object.values(virtualLibrary).forEach(track => {
                        if (Array.isArray(track.playlists)) track.playlists = track.playlists.map(n => n === original ? newName : n);
                    });
                    if (activePlaylistView === original) activePlaylistView = newName;
                } else {
                    playlistMeta[original] = newMeta;
                }
                closeModal('modal-playlist-edit');
                editingPlaylistName = null;
                renderPlaylistsList();
                renderLibraryManager();
                if (currentFile) updateMetadataUI();
                showToast('Playlist updated.');
            };
            const file = fileInput?.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => commit(reader.result);
                reader.onerror = () => { showToast('Could not read playlist image.'); };
                reader.readAsDataURL(file);
            } else {
                commit(oldMeta.imageData || '');
            }
        }

        function renderPlaylistsList() {
            syncAllTrackPlaylistMetadata();
            const removedStarterPlaylists = purgeEmptyStarterPlaylists();
            if (removedStarterPlaylists && typeof saveActiveLibraryState === 'function') {
                saveActiveLibraryState('purge-empty-starter-playlists');
            }
            const container = document.getElementById('playlists-explorer-group');
            if (!container) return;
            container.innerHTML = "";

            Object.keys(playlists).sort().forEach(plName => {
                ensurePlaylistMeta(plName);
                const row = document.createElement('div');
                row.className = "playlist-row";
                row.classList.toggle("is-active", activePlaylistView === plName);
                row.dataset.playlistName = plName;
                row.innerHTML = `
                    <div class="playlist-row-content">
                        ${playlistThumbHtml(plName, false)}
                        <div>
                            <div class="playlist-row-title">▤ ${escapeHtml(plName)}</div>
                            <div class="playlist-row-count">${normalisePlaylistToIds(playlists[plName] || []).length} tracks</div>
                        </div>
                    </div>
                    <div class="playlist-row-tools">
                        <button type="button" class="btn-pill btn-view-playlist${activePlaylistView === plName ? ' is-active' : ''}">
                            ${activePlaylistView === plName ? 'Viewing' : 'View'}
                        </button>
                    </div>
                `;

                row.addEventListener('click', (e) => {
                    activePlaylistView = plName;
                    renderPlaylistsList();
                });
                container.appendChild(row);
            });
            renderPlaylistDetailPanel();
            renderActiveTrackPlaylistEditor();
            renderLibraryManager();
        }

        function getPlaylistCreatedLabel(name) {
            const meta = ensurePlaylistMeta(name);
            return meta.createdAt ? new Date(meta.createdAt).toLocaleString() : 'Not stored yet';
        }

        function getPlaylistUpdatedLabel(name) {
            const meta = ensurePlaylistMeta(name);
            return meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : 'Not stored yet';
        }

        function getPlaylistTotalDurationLabel(name) {
            const ids = normalisePlaylistToIds(playlists[name] || []);
            const totalSeconds = ids.reduce((sum, id) => sum + (Number(virtualLibrary[id]?.duration) || 0), 0);
            return totalSeconds > 0 ? formatTime(totalSeconds) : 'Unknown';
        }

        function renderPlaylistDetailPanel() {
            const panel = document.getElementById('playlist-detail-panel');
            if (!panel) return;
            const name = activePlaylistView;
            if (!name || !playlists[name]) {
                panel.classList.remove('is-open');
                panel.innerHTML = '';
                return;
            }
            ensurePlaylistMeta(name);
            const ids = normalisePlaylistToIds(playlists[name] || []);
            const meta = playlistMeta[name] || {};
            const art = getPlaylistArtwork(name);
            const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '▤';
            panel.classList.add('is-open');
            panel.innerHTML = `
                <div class="playlist-detail-header">
                    <div class="playlist-detail-art">${imageHtmlOrFallback(art || getDefaultArtworkSrc(), `${name} artwork`) }</div>
                    <div class="playlist-detail-title-block">
                        <div class="playlist-detail-title">${escapeHtml(name)}</div>
                    </div>
                    <div class="playlist-row-tools">
                        <button type="button" class="btn-pill btn-play-playlist" id="btn-detail-play-playlist" title="Play playlist">▶️</button>
                        <button type="button" class="btn-pill btn-shuffle-playlist" id="btn-detail-shuffle-playlist" title="Shuffle playlist">🔀</button>
                        <button type="button" class="btn-pill btn-edit-playlist" id="btn-detail-edit-playlist" title="Edit playlist">✏️</button>
                    </div>
                    <div class="playlist-detail-meta-row">
                        <span class="mini-tag">${ids.length} track${ids.length === 1 ? '' : 's'}</span>
                        <span class="mini-tag">Created: ${escapeHtml(getPlaylistCreatedLabel(name))}</span>
                        <span class="mini-tag">Updated: ${escapeHtml(getPlaylistUpdatedLabel(name))}</span>
                        <span class="mini-tag">Duration: ${escapeHtml(getPlaylistTotalDurationLabel(name))}</span>
                    </div>
                    ${meta.description ? `<div class="library-track-meta playlist-detail-description">${escapeHtml(meta.description)}</div>` : ''}
                </div>
                <div class="playlist-detail-track-list" id="playlist-detail-track-list">
                    ${ids.length ? ids.map((id, index) => {
                        const track = virtualLibrary[id];
                        const isCurrent = currentFile?.name === id;
                        return `<div class="library-result-row playlist-detail-track-row${isCurrent ? ' active-track now-playing-current-track' : ''}" data-track-id="${escapeHtml(id)}">
                            <div class="history-list-number">${index + 1}</div>
                            <div class="onda-track-text-wrap">
                                <div class="library-track-title">${isCurrent ? '▶ ' : ''}${escapeHtml(track ? getDisplayTitle(track) : id)}</div>
                                <div class="library-track-meta">${escapeHtml(track?.fileName || 'Missing library record')} · ${escapeHtml(track ? sourceStatus(track) : 'missing')}</div>
                            </div>
                            <div class="library-row-buttons">
                                ${track ? `<button type="button" class="btn-pill btn-detail-play-track" data-track-id="${escapeHtml(id)}" title="Play">▶️</button>` : ''}
                                <button type="button" class="btn-pill btn-detail-info-track" data-track-id="${escapeHtml(id)}" title="Info">ℹ️</button>
                                ${track ? `<button type="button" class="btn-pill btn-onda-add-playlist" data-track-id="${escapeHtml(id)}" title="Add to playlist">➕</button>` : ''}
                            </div>
                        </div>`;
                    }).join('') : '<div class="library-track-meta">This playlist has no tracks yet.</div>'}
                </div>
            `;
            const playBtn = document.getElementById('btn-detail-play-playlist');
            if (playBtn) playBtn.addEventListener('click', () => loadPlaylistQueue(name));
            const shuffleBtn = document.getElementById('btn-detail-shuffle-playlist');
            if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
                isShuffle = true;
                loadPlaylistQueue(name);
                showToast(`Shuffle play: ${name}`);
            });
            const editBtn = document.getElementById('btn-detail-edit-playlist');
            if (editBtn) editBtn.addEventListener('click', () => openPlaylistEditModal(name));
            const list = document.getElementById('playlist-detail-track-list');
            if (list) list.addEventListener('click', (e) => {
                const id = e.target.dataset.trackId || e.target.closest('[data-track-id]')?.dataset.trackId;
                if (!id) return;
                if (e.target.classList.contains('btn-detail-info-track')) {
                    currentFile = createPlayableTrackFromMeta(virtualLibrary[id] || { id, fileName: id });
                    currentFile.name = id;
                    switchWorkspaceTab('tab-library');
                    updateMetadataUI();
                    return;
                }
                if (e.target.classList.contains('btn-detail-play-track')) {
                    const ids = normalisePlaylistToIds(playlists[name] || []);
                    playlistTracks = ids.map(trackId => virtualLibrary[trackId] ? createPlayableTrackFromMeta(virtualLibrary[trackId]) : null).filter(Boolean);
                    currentPlaybackPlaylistName = name;
                    const targetIndex = playlistTracks.findIndex(track => getTrackId(track) === id);
                    switchTrack(targetIndex >= 0 ? targetIndex : 0);
                }
            });
            scrollCurrentTrackRowsIntoView('playlist-detail-render');
        }

        function loadPlaylistQueue(playlistName) {
            const ids = normalisePlaylistToIds(playlists[playlistName] || []);
            const tracksInPl = ids.map(id => virtualLibrary[id] ? createPlayableTrackFromMeta(virtualLibrary[id]) : null).filter(Boolean);
            if (tracksInPl.length === 0) { showToast(`Playlist ${playlistName} is empty or needs relink!`); return; }
            activePlaylistView = playlistName;
            currentPlaybackPlaylistName = playlistName;
            playlistTracks = tracksInPl;
            switchTrack(0);
            renderPlaylistDetailPanel();
            showToast(`Loaded ${playlistName} playlist queue.`);
        }

        btnCreatePlaylistTrigger.addEventListener('click', () => showModal('modal-playlist-create'));
        
        function createPlaylistAction() {
            const plInput = document.getElementById('input-playlist-name').value.trim();
            if (!plInput) return;
            if (playlists[plInput]) { showToast("Playlist folder already exists!"); return; }
            playlists[plInput] = [];
            ensurePlaylistMeta(plInput);
            closeModal('modal-playlist-create');
            document.getElementById('input-playlist-name').value = "";
            renderPlaylistsList();
            renderLibraryManager();
            showToast(`Created folder directory: ${plInput}`);
        }

        btnDeletePlaylistTrigger.addEventListener('click', () => {
            if (!activePlaylistView) { showToast("Please open a playlist folder to delete first."); return; }
            delete playlists[activePlaylistView];
            delete playlistMeta[activePlaylistView];
            activePlaylistView = null;
            syncAllTrackPlaylistMetadata();
            renderPlaylistsList();
            renderLibraryManager();
            if (currentFile) updateMetadataUI();
            showToast("Playlist folder deleted.");
        });

        // --- 8. DIRECT INLINE DISPLAY NAME TYPE-OVER (TAB 4) ---
        const btnInlineEdit = document.getElementById('btn-inline-nickname-edit');
        const nicknameDisplayMode = document.getElementById('nickname-display-mode');
        const nicknameEditMode = document.getElementById('nickname-edit-mode');
        const inputInlineNickname = document.getElementById('input-inline-nickname');
        const btnInlineSave = document.getElementById('btn-inline-save');
        const btnInlineCancel = document.getElementById('btn-inline-cancel');

        function activateInlineRename() {
            if (!currentFile) return;
            setNowPlayingEditMode(true);
            inputInlineNickname.value = virtualLibrary[currentFile.name].nickname || "";
            inputInlineNickname.focus();
        }

        if (btnInlineEdit) btnInlineEdit.addEventListener('click', activateInlineRename);

        btnInlineCancel.addEventListener('click', () => setNowPlayingEditMode(false));

        function saveInlineNickname() {
            if (!currentFile) return;
            const meta = virtualLibrary[currentFile.name];
            meta.nickname = inputInlineNickname.value.trim();
            const trackImageInput = document.getElementById('input-track-image-url');
            if (trackImageInput) meta.imageUrl = trackImageInput.value.trim();
            const inlineTags = document.getElementById('input-inline-tags');
            if (inlineTags) meta.tags = parseCommaTags(inlineTags.value);
            saveActiveTrackPlaylistMembership();
            updateMetadataUI();
            renderLibraryManager();
            saveActiveLibraryState('track-info-save');
            showToast("Track info saved!");
        }

        btnInlineSave.addEventListener('click', saveInlineNickname);
        inputInlineNickname.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveInlineNickname(); });
        safeBind('btn-now-playing-edit', 'click', () => {
            if (!currentFile) { showToast('No active track to edit.'); return; }
            setNowPlayingEditMode(!nowPlayingEditMode);
        });

        function triggerMetaEdit() {
            if (!currentFile) return;
            switchWorkspaceTab('tab-library');
            const metadataCard = document.getElementById('metadata-display-card') || document.getElementById('tab-library');
            if (metadataCard) {
                metadataCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            activateInlineRename();
        }

        // --- 9. MINI METADATA BOX ACTION ENGINE ---
        miniMetaBox.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentFile) { showToast("No active track loaded to copy metadata."); return; }
            const meta = virtualLibrary[currentFile.name];
            const cleanMetaString = `[Onda Player Metadata]\nFilename: ${meta.fileName}\nNickname: ${meta.nickname || 'None'}\nTrack Size: ${meta.size}\nTags: ${meta.tags.join(', ')}\nPlaylists: ${meta.playlists.join(', ') || 'None'}`;
            copyToClipboard(cleanMetaString);
        });

        miniMetaBox.addEventListener('contextmenu', (e) => {
            e.preventDefault(); 
            triggerMetaEdit();
        });

        let metaTouchTimer;
        let isMetaTouchDragging = false;

        miniMetaBox.addEventListener('touchstart', (e) => {
            isMetaTouchDragging = false;
            metaTouchTimer = setTimeout(() => {
                triggerMetaEdit();
                isMetaTouchDragging = true; 
            }, 500); 
        });
        miniMetaBox.addEventListener('touchmove', () => {
            clearTimeout(metaTouchTimer);
            isMetaTouchDragging = true;
        });
        miniMetaBox.addEventListener('touchend', (e) => {
            clearTimeout(metaTouchTimer);
            if (!isMetaTouchDragging) {
                e.preventDefault(); 
                if (!currentFile) { showToast("No active track loaded to copy metadata."); return; }
                const meta = virtualLibrary[currentFile.name];
                copyToClipboard(`[Onda Player Metadata]\nFilename: ${meta.fileName}\nNickname: ${meta.nickname || 'None'}\nTrack Size: ${meta.size}\nTags: ${meta.tags.join(', ')}\nPlaylists: ${meta.playlists.join(', ') || 'None'}`);
            }
        });


        function safeBind(id, eventName, handler) {
            const el = document.getElementById(id);
            if (!el) {
                console.warn(`Missing element #${id}; skipped ${eventName} binding.`);
                return null;
            }
            el.addEventListener(eventName, handler);
            return el;
        }

        // --- 10. RE-ROUTING METADATA UTILITY DISPATCH ---
        
        document.getElementById('btn-repeat-one').addEventListener('click', () => {
            isRepeatOne = !isRepeatOne;
            document.getElementById('btn-repeat-one').classList.toggle('active-state', isRepeatOne);
            if (isRepeatOne) {
                isRepeatAll = false;
                document.getElementById('btn-repeat-all').classList.remove('active-state');
            }
        });

        document.getElementById('btn-repeat-all').addEventListener('click', () => {
            isRepeatAll = !isRepeatAll;
            document.getElementById('btn-repeat-all').classList.toggle('active-state', isRepeatAll);
            if (isRepeatAll) {
                isRepeatOne = false;
                document.getElementById('btn-repeat-one').classList.remove('active-state');
            }
        });

        document.getElementById('btn-shuffle').addEventListener('click', () => {
            isShuffle = !isShuffle;
            document.getElementById('btn-shuffle').classList.toggle('active-state', isShuffle);
        });

        safeBind('btn-lyrics-modal', 'click', () => {
            if (!currentFile) return;
            document.getElementById('input-lyrics').value = virtualLibrary[currentFile.name].lyrics || "";
            showModal('modal-lyrics');
        });

        safeBind('btn-playlist', 'click', () => {
            if (!currentFile) return;
            playlistChecklistContainer.innerHTML = "";
            Object.keys(playlists).forEach(pl => {
                const isAssigned = playlists[pl].some(track => track.name === currentFile.name);
                const label = document.createElement('label');
                label.className = "playlist-check-label";
                label.innerHTML = `<input type="checkbox" class="playlist-check-input" value="${pl}" ${isAssigned ? 'checked' : ''}> ⭐ ${pl}`;
                playlistChecklistContainer.appendChild(label);
            });
            showModal('modal-playlist');
        });

        safeBind('btn-tags', 'click', () => {
            if (!currentFile) return;
            document.getElementById('input-tags').value = virtualLibrary[currentFile.name].tags.join(', ');
            showModal('modal-tags');
        });

        function showModal(id) {
            overlay.classList.add('is-open');
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add('is-open');
                const body = modal.querySelector('.modal-body');
                if (body) body.scrollTop = 0;
            }
        }
        function closeModal(id) {
            saveLocalUiStateCheckpoint(`modal-close:${id}`);
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('is-open');
            if (!document.querySelector('.organon-modal.is-open')) overlay.classList.remove('is-open');
            saveLocalUiStateCheckpoint(`modal-closed:${id}`);
        }
        function closeAllModals() {
            saveLocalUiStateCheckpoint('modal-close-all');
            document.querySelectorAll('.organon-modal').forEach(m => m.classList.remove('is-open'));
            overlay.classList.remove('is-open');
            saveLocalUiStateCheckpoint('modal-closed-all');
        }

        function saveLyrics() {
            if (!currentFile) return;
            virtualLibrary[currentFile.name].lyrics = document.getElementById('input-lyrics').value.trim();
            updateMetadataUI();
            renderLibraryManager();
            closeModal('modal-lyrics');
            showToast("Lyrics updated.");
        }

        function saveTags() {
            if (!currentFile) return;
            const tagsRaw = document.getElementById('input-tags').value;
            virtualLibrary[currentFile.name].tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
            updateMetadataUI();
            renderLibraryManager();
            closeModal('modal-tags');
            saveActiveLibraryState('modal-tags-save');
            showToast("Tags updated.");
        }

        function savePlaylists() {
            if (!currentFile) return;
            const checkBoxes = playlistChecklistContainer.querySelectorAll('input[type="checkbox"]');
            checkBoxes.forEach(cb => {
                const plName = cb.value;
                const inListIdx = playlists[plName].findIndex(track => track.name === currentFile.name);
                if (cb.checked) {
                    if (inListIdx === -1) playlists[plName].push(currentFile);
                } else {
                    if (inListIdx !== -1) playlists[plName].splice(inListIdx, 1);
                }
            });
            syncTrackPlaylistMetadata(currentFile.name);
            updateMetadataUI();
            renderPlaylistsList();
            renderLibraryManager();
            closeModal('modal-playlist');
            showToast("Saved track playlists mapping.");
        }

        function copyToClipboard(text) {
            const clipboardArea = document.createElement('textarea');
            clipboardArea.value = text;
            clipboardArea.classList.add('offscreen-copy-field');
            document.body.appendChild(clipboardArea);
            clipboardArea.select();
            try { document.execCommand('copy'); showToast("Copied to clipboard!"); } catch (err) {}
            document.body.removeChild(clipboardArea);
        }

        function showToast(message) {
            const toast = document.getElementById('toast-notice');
            toast.innerText = message;
            toast.classList.add('is-open');
            clearTimeout(showToast.hideTimer);
            showToast.hideTimer = setTimeout(() => { toast.classList.remove('is-open'); }, 2200);
        }

        // --- 11. DYNAMIC VISUALIZER OPTIONS SYSTEM ---
        const canvas = document.getElementById('audio-visualizer');
        const canvasCtx = canvas.getContext('2d');

        function resizeCanvas() {
            const rect = canvas.parentElement.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        let dragScrollDown = false;
        let dragScrollStartX;
        let scrollLeftTags;

        tagsBar.addEventListener('mousedown', (e) => {
            dragScrollDown = true;
            tagsBar.classList.add('is-dragging');
            dragScrollStartX = e.pageX - tagsBar.offsetLeft;
            scrollLeftTags = tagsBar.scrollLeft;
        });
        tagsBar.addEventListener('mouseleave', () => { dragScrollDown = false; tagsBar.classList.remove('is-dragging'); });
        tagsBar.addEventListener('mouseup', () => { dragScrollDown = false; tagsBar.classList.remove('is-dragging'); });
        tagsBar.addEventListener('mousemove', (e) => {
            if (!dragScrollDown) return;
            e.preventDefault();
            const x = e.pageX - tagsBar.offsetLeft;
            const walk = (x - dragScrollStartX) * 2;
            tagsBar.scrollLeft = scrollLeftTags - walk;
        });

        function startVisualizer() {
            if (visualizerRunning) return;
            visualizerRunning = true;
            drawVisualizer();
        }

        function drawIdleOrStreamVisualizer(label = '') {
            const t = performance.now() / 1000;
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const layer = visualizerLayers[0] || createDefaultVisualizerLayer(1);
            const colors = getLayerColors(layer);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const sideCount = 18;
            const laneWidth = (canvas.width / 2) / sideCount;
            const pulse = isPlaying ? ((Math.sin(t * 3.2) + 1) * 0.5) : 0.22;
            const amp = isPlaying ? 10 + (pulse * 22) : 8;

            canvasCtx.shadowBlur = 16;
            canvasCtx.shadowColor = hexToRgba(pickColor(colors, 0), 0.72);
            canvasCtx.fillStyle = hexToRgba(pickColor(colors, 0), 0.58);

            for (let i = 0; i < sideCount; i++) {
                const height = (Math.sin((i * 0.7) + (t * 2.4)) * 0.5 + 0.5) * amp + 4;
                const slot = laneWidth * 0.58;
                const leftX = centerX - ((i + 1) * laneWidth) + (laneWidth - slot) / 2;
                const rightX = centerX + (i * laneWidth) + (laneWidth - slot) / 2;
                canvasCtx.fillRect(leftX, centerY - height / 2, slot, height);
                canvasCtx.fillRect(rightX, centerY - height / 2, slot, height);
            }

            canvasCtx.shadowBlur = 0;

            if (label) {
                canvasCtx.font = 'bold 11px system-ui, -apple-system, sans-serif';
                canvasCtx.fillStyle = hexToRgba(pickColor(colors, 1), 0.82);
                canvasCtx.textAlign = 'right';
                canvasCtx.fillText(label, canvas.width - 18, canvas.height - 18);
            }
        }

        function getFrequencyData() {
            if (!analyser) return null;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            return dataArray;
        }

        function getMirroredSideSamples(dataArray, sideCount = 32) {
            const samples = [];
            if (!dataArray || dataArray.length === 0) return Array(sideCount).fill(0);
            const maxIndex = Math.max(8, Math.floor(dataArray.length * 0.85));
            for (let i = 0; i < sideCount; i++) {
                const pos = i / Math.max(1, sideCount - 1);
                const idx = Math.min(maxIndex - 1, Math.floor(Math.pow(pos, 1.15) * maxIndex));
                const normalized = dataArray[idx] / 255;
                samples.push(Math.pow(normalized, 0.86));
            }
            return samples;
        }

        function buildMirroredLinePoints(sideSamples, totalPoints = 120) {
            const centerOut = [];
            for (let i = 0; i < totalPoints / 2; i++) {
                const idx = Math.min(sideSamples.length - 1, Math.floor((i / Math.max(1, (totalPoints / 2) - 1)) * sideSamples.length));
                centerOut.push(sideSamples[idx]);
            }
            const leftHalf = [...centerOut].reverse();
            return [...leftHalf, ...centerOut];
        }

        function applyAmplitudeToSamples(samples, layer) {
            const amp = clampNumber(layer?.amplitude, 0.25, 5, 1);
            return samples.map(value => Math.max(0, value * amp));
        }

        function buildMirroredSamples(samples, totalPoints = 120, mirror = true) {
            if (!mirror) {
                const points = [];
                for (let i = 0; i < totalPoints; i++) {
                    const idx = Math.min(samples.length - 1, Math.floor((i / Math.max(1, totalPoints - 1)) * samples.length));
                    points.push(samples[idx] || 0);
                }
                return points;
            }
            return buildMirroredLinePoints(samples, totalPoints);
        }

        function setupGlowForLayer(colors, index = 0, alpha = 0.92, blur = 16, sample = null) {
            const c = pickColor(colors, index, sample);
            canvasCtx.shadowBlur = blur;
            canvasCtx.shadowColor = hexToRgba(c, Math.min(1, alpha));
            canvasCtx.strokeStyle = hexToRgba(c, alpha);
            canvasCtx.fillStyle = hexToRgba(c, alpha * 0.78);
        }

        function applyLayerCanvasTransform(layer) {
            const w = canvas.width;
            const h = canvas.height;
            const align = layer?.align || 'center';
            if (align === 'left') canvasCtx.translate(-w * 0.16, 0);
            if (align === 'right') canvasCtx.translate(w * 0.16, 0);
            const hPos = clampNumber(layer?.hPosition, -5, 5, 0);
            const vPos = clampNumber(layer?.vPosition, -5, 5, 0);
            canvasCtx.translate(hPos * w * 0.055, vPos * h * 0.055);

            canvasCtx.translate(w / 2, h / 2);
            const rotate = parseInt(layer?.rotate, 10) || 0;
            if (rotate) canvasCtx.rotate((rotate * Math.PI) / 180);
            if (rotate === 90 || rotate === 270) {
                const ratio = Math.min(1.65, Math.max(0.55, h / Math.max(1, w)));
                canvasCtx.scale(ratio, 1 / ratio);
            }
            canvasCtx.scale(layer?.flipH ? -1 : 1, layer?.flipV ? -1 : 1);
            canvasCtx.translate(-w / 2, -h / 2);
        }

        function drawVisualRect(x, y, w, h) {
            const mode = activeVisualLayerForDraw?.drawMode || 'fill';
            if (mode === 'outline') {
                canvasCtx.lineWidth = Math.max(1.2, Math.min(3, Math.abs(w) * 0.16));
                canvasCtx.strokeRect(x, y, w, h);
            } else if (mode === 'line') {
                canvasCtx.lineWidth = 1.4;
                canvasCtx.beginPath();
                canvasCtx.moveTo(x + w / 2, y);
                canvasCtx.lineTo(x + w / 2, y + h);
                canvasCtx.stroke();
            } else {
                canvasCtx.fillRect(x, y, w, h);
            }
        }

        function drawVisualPath() {
            const mode = activeVisualLayerForDraw?.drawMode || 'fill';
            if (mode === 'outline' || mode === 'line') {
                canvasCtx.lineWidth = mode === 'line' ? 1.4 : 2.2;
                canvasCtx.stroke();
            } else {
                canvasCtx.fill();
            }
        }

        function drawVisualCircle(x, y, radius) {
            const mode = activeVisualLayerForDraw?.drawMode || 'fill';
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
            if (mode === 'outline' || mode === 'line') {
                canvasCtx.lineWidth = mode === 'line' ? 1.2 : 2;
                canvasCtx.stroke();
            } else {
                canvasCtx.fill();
            }
        }

        function drawMirroredBars(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const centerX = canvas.width / 2;
            const maxBarHeight = canvas.height * 0.80;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / sideSamples.length;
            const spacing = getVisualSpacing(activeVisualLayerForDraw);
            const barWidth = Math.max(1.5, laneWidth * Math.max(0.16, 0.68 - spacing * 0.14));

            sideSamples.forEach((sample, i) => {
                const color = pickColor(colors, i, Math.min(1, sample));
                canvasCtx.shadowBlur = 14;
                canvasCtx.shadowColor = hexToRgba(color, 0.82);
                canvasCtx.fillStyle = hexToRgba(color, 0.72);
                canvasCtx.strokeStyle = hexToRgba(color, 0.9);
                const barHeight = Math.max(5, sample * maxBarHeight);
                if (mirror) {
                    const leftX = centerX - ((i + 1) * laneWidth) + (laneWidth - barWidth) / 2;
                    const rightX = centerX + (i * laneWidth) + (laneWidth - barWidth) / 2;
                    drawVisualRect(leftX, canvas.height - barHeight, barWidth, barHeight);
                    drawVisualRect(rightX, canvas.height - barHeight, barWidth, barHeight);
                } else {
                    const x = (i * laneWidth) + (laneWidth - barWidth) / 2;
                    drawVisualRect(x, canvas.height - barHeight, barWidth, barHeight);
                }
            });
            canvasCtx.shadowBlur = 0;
        }

        function drawMirroredMountain(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const points = buildMirroredSamples(sideSamples, 140, mirror);
            const step = canvas.width / (points.length - 1);
            const baseY = canvas.height * 0.88;
            const maxHeight = canvas.height * 0.72;

            canvasCtx.beginPath();
            canvasCtx.moveTo(0, baseY);
            for (let i = 0; i < points.length; i++) {
                const x = i * step;
                const y = baseY - (points[i] * maxHeight);
                canvasCtx.lineTo(x, y);
            }
            canvasCtx.lineTo(canvas.width, baseY);
            canvasCtx.closePath();

            const grad = createVisualizerGradient(colors, activeVisualLayerForDraw, 0.86, 0.24);
            canvasCtx.shadowBlur = 18;
            canvasCtx.shadowColor = hexToRgba(pickColor(colors, 0), 0.72);
            canvasCtx.fillStyle = grad;
            canvasCtx.strokeStyle = hexToRgba(pickColor(colors, 0), 0.92);
            drawVisualPath();
            canvasCtx.shadowBlur = 0;
        }

        function createVisualizerGradient(colors, layer, alphaTop = 0.86, alphaBottom = 0.28) {
            let grad;
            const direction = layer?.gradient || 'horizontal';
            if (direction === 'vertical') grad = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
            else if (direction === 'radial') grad = canvasCtx.createRadialGradient(canvas.width / 2, canvas.height / 2, 4, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.55);
            else grad = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);

            if (direction === 'random') {
                colors.forEach((color, i) => grad.addColorStop(i / Math.max(1, colors.length - 1), hexToRgba(color, i % 2 ? alphaBottom : alphaTop)));
            } else if (colors.length === 1) {
                grad.addColorStop(0, hexToRgba(colors[0], alphaTop));
                grad.addColorStop(1, hexToRgba(colors[0], alphaBottom));
            } else {
                colors.forEach((color, i) => {
                    const t = i / Math.max(1, colors.length - 1);
                    const alpha = alphaTop - ((alphaTop - alphaBottom) * t);
                    grad.addColorStop(t, hexToRgba(color, alpha));
                });
            }
            return grad;
        }

        function drawMirroredLed(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / sideSamples.length;
            const columnWidth = Math.max(3, laneWidth * 0.62);
            const blockHeight = activeVisualLayerForDraw?.drawMode === 'line' ? 3 : 6;
            const blockGap = 2;
            const halfHeight = canvas.height * 0.34;

            canvasCtx.shadowBlur = 12;

            sideSamples.forEach((sample, i) => {
                const blocks = Math.max(1, Math.floor((sample * halfHeight) / (blockHeight + blockGap)));
                const leftX = centerX - ((i + 1) * laneWidth) + (laneWidth - columnWidth) / 2;
                const rightX = centerX + (i * laneWidth) + (laneWidth - columnWidth) / 2;
                const singleX = (i * laneWidth) + (laneWidth - columnWidth) / 2;

                for (let j = 0; j < blocks; j++) {
                    const color = pickColor(colors, j > 9 ? 2 : j > 5 ? 1 : 0, sample);
                    canvasCtx.shadowColor = hexToRgba(color, 0.72);
                    canvasCtx.fillStyle = hexToRgba(color, 0.76);
                    canvasCtx.strokeStyle = hexToRgba(color, 0.92);
                    const yUp = centerY - ((j + 1) * (blockHeight + blockGap));
                    const yDown = centerY + (j * (blockHeight + blockGap));
                    if (mirror) {
                        drawVisualRect(leftX, yUp, columnWidth, blockHeight);
                        drawVisualRect(rightX, yUp, columnWidth, blockHeight);
                        drawVisualRect(leftX, yDown, columnWidth, blockHeight);
                        drawVisualRect(rightX, yDown, columnWidth, blockHeight);
                    } else {
                        drawVisualRect(singleX, canvas.height - ((j + 1) * (blockHeight + blockGap)), columnWidth, blockHeight);
                    }
                }
            });
            canvasCtx.shadowBlur = 0;
        }

        function drawPulseBurst(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / sideSamples.length;
            const barWidth = Math.max(2, laneWidth * 0.6);
            const maxAmp = canvas.height * 0.35;

            sideSamples.forEach((sample, i) => {
                const color = pickColor(colors, i, sample);
                canvasCtx.shadowBlur = 16;
                canvasCtx.shadowColor = hexToRgba(color, 0.8);
                canvasCtx.fillStyle = hexToRgba(color, 0.72);
                canvasCtx.strokeStyle = hexToRgba(color, 0.95);
                const amplitude = Math.max(4, sample * maxAmp);
                if (mirror) {
                    const leftX = centerX - ((i + 1) * laneWidth) + (laneWidth - barWidth) / 2;
                    const rightX = centerX + (i * laneWidth) + (laneWidth - barWidth) / 2;
                    drawVisualRect(leftX, centerY - amplitude, barWidth, amplitude * 2);
                    drawVisualRect(rightX, centerY - amplitude, barWidth, amplitude * 2);
                } else {
                    const x = (i * laneWidth) + (laneWidth - barWidth) / 2;
                    drawVisualRect(x, centerY - amplitude, barWidth, amplitude * 2);
                }
            });

            canvasCtx.strokeStyle = hexToRgba(pickColor(colors, 1), 0.82);
            canvasCtx.lineWidth = 1.4;
            canvasCtx.beginPath();
            canvasCtx.moveTo(0, centerY);
            canvasCtx.lineTo(canvas.width, centerY);
            canvasCtx.stroke();
            canvasCtx.shadowBlur = 0;
        }

        function drawWaveLine(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const points = buildMirroredSamples(sideSamples, 150, mirror);
            const step = canvas.width / (points.length - 1);
            const centerY = canvas.height / 2;
            const maxAmp = canvas.height * 0.29;

            setupGlowForLayer(colors, 0, 0.95, 22);
            canvasCtx.lineWidth = activeVisualLayerForDraw?.drawMode === 'line' ? 1.5 : 4;
            canvasCtx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const x = i * step;
                const y = centerY + (Math.sin(i * 0.18) * 0.18 + (points[i] * 2 - 1)) * maxAmp;
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
            canvasCtx.stroke();
            canvasCtx.shadowBlur = 0;
        }

        function drawOrbChain(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / sideSamples.length;

            sideSamples.forEach((sample, i) => {
                const color = pickColor(colors, i, sample);
                const radius = Math.max(3, sample * 31);
                const offset = sample * canvas.height * 0.18;
                const leftX = centerX - ((i + 0.5) * laneWidth);
                const rightX = centerX + ((i + 0.5) * laneWidth);
                const singleX = (i + 0.5) * laneWidth;
                canvasCtx.shadowBlur = 17;
                canvasCtx.shadowColor = hexToRgba(color, 0.78);
                canvasCtx.fillStyle = hexToRgba(color, 0.78);
                canvasCtx.strokeStyle = hexToRgba(color, 0.95);

                const xs = mirror ? [leftX, rightX] : [singleX];
                xs.forEach(x => {
                    drawVisualCircle(x, centerY - offset, radius);
                    drawVisualCircle(x, centerY + offset, Math.max(2, radius * 0.55));
                });
            });
            canvasCtx.shadowBlur = 0;
        }

        function drawRibbon(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const points = buildMirroredSamples(sideSamples, 120, mirror);
            const step = canvas.width / (points.length - 1);
            const centerY = canvas.height / 2;
            const maxAmp = canvas.height * 0.24;

            canvasCtx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const x = i * step;
                const y = centerY - (points[i] * maxAmp) - (Math.cos(i * 0.22) * 6);
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
            for (let i = points.length - 1; i >= 0; i--) {
                const x = i * step;
                const y = centerY + (points[i] * maxAmp) + (Math.cos(i * 0.22) * 6);
                canvasCtx.lineTo(x, y);
            }
            canvasCtx.closePath();

            const grad = createVisualizerGradient(colors, activeVisualLayerForDraw, 0.88, 0.46);
            canvasCtx.shadowBlur = 18;
            canvasCtx.shadowColor = hexToRgba(pickColor(colors, 1), 0.72);
            canvasCtx.fillStyle = grad;
            canvasCtx.strokeStyle = hexToRgba(pickColor(colors, 0), 0.95);
            drawVisualPath();
            canvasCtx.shadowBlur = 0;
        }

        function drawHeartbeat(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const points = buildMirroredSamples(sideSamples, 96, mirror);
            const step = canvas.width / (points.length - 1);
            const centerY = canvas.height / 2;
            const maxAmp = canvas.height * 0.27;

            setupGlowForLayer(colors, 0, 0.98, 20);
            canvasCtx.lineWidth = activeVisualLayerForDraw?.drawMode === 'line' ? 1.5 : 5;
            canvasCtx.lineJoin = 'round';
            canvasCtx.lineCap = 'round';
            canvasCtx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const x = i * step;
                const spike = (i % 6 === 0) ? 1.0 : 0.45;
                const y = centerY - ((points[i] * 2 - 1) * maxAmp * spike);
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
            canvasCtx.stroke();
            canvasCtx.shadowBlur = 0;
        }

        function drawPixelWave(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / sideSamples.length;
            const cellSize = Math.max(4, laneWidth * 0.44);
            const cellGap = 2;
            const maxRows = Math.max(4, Math.floor((canvas.height * 0.34) / (cellSize + cellGap)));

            sideSamples.forEach((sample, i) => {
                const rows = Math.max(1, Math.floor(sample * maxRows));
                const leftX = centerX - ((i + 1) * laneWidth) + (laneWidth - cellSize) / 2;
                const rightX = centerX + (i * laneWidth) + (laneWidth - cellSize) / 2;
                const singleX = (i * laneWidth) + (laneWidth - cellSize) / 2;
                for (let j = 0; j < rows; j++) {
                    const color = pickColor(colors, i + j, sample);
                    canvasCtx.shadowBlur = 12;
                    canvasCtx.shadowColor = hexToRgba(color, 0.7);
                    canvasCtx.fillStyle = hexToRgba(color, Math.max(0.28, 0.86 - (j * 0.035)));
                    canvasCtx.strokeStyle = hexToRgba(color, 0.92);
                    if (mirror) {
                        const yUp = centerY - ((j + 1) * (cellSize + cellGap));
                        const yDown = centerY + (j * (cellSize + cellGap));
                        drawVisualRect(leftX, yUp, cellSize, cellSize);
                        drawVisualRect(rightX, yUp, cellSize, cellSize);
                        drawVisualRect(leftX, yDown, cellSize, cellSize);
                        drawVisualRect(rightX, yDown, cellSize, cellSize);
                    } else {
                        const y = canvas.height - ((j + 1) * (cellSize + cellGap));
                        drawVisualRect(singleX, y, cellSize, cellSize);
                    }
                }
            });
            canvasCtx.shadowBlur = 0;
        }

        function drawFloatingIslands(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const points = buildMirroredSamples(sideSamples, 110, mirror);
            const step = canvas.width / (points.length - 1);
            const baseY = canvas.height * 0.86;

            const layers = [
                { scale: 0.95, color: pickColor(colors, 0), offset: 0, alpha: 0.84 },
                { scale: 0.62, color: pickColor(colors, 1), offset: 16, alpha: 0.60 },
                { scale: 0.42, color: pickColor(colors, 2), offset: 28, alpha: 0.48 }
            ];

            layers.forEach(layer => {
                canvasCtx.beginPath();
                canvasCtx.moveTo(0, baseY);
                for (let i = 0; i < points.length; i++) {
                    const x = i * step;
                    const shaped = Math.max(0, points[i] - 0.1);
                    const y = baseY - (shaped * canvas.height * 0.38 * layer.scale) - layer.offset - Math.sin(i * 0.35) * 2;
                    canvasCtx.lineTo(x, y);
                }
                canvasCtx.lineTo(canvas.width, baseY);
                canvasCtx.closePath();
                canvasCtx.shadowBlur = 12;
                canvasCtx.shadowColor = hexToRgba(layer.color, 0.62);
                canvasCtx.fillStyle = hexToRgba(layer.color, layer.alpha);
                canvasCtx.strokeStyle = hexToRgba(layer.color, 0.82);
                drawVisualPath();
            });
            canvasCtx.shadowBlur = 0;
        }

        function getMatrixGlyphs(layer) {
            const key = layer?.matrixCharacters || 'japanese';
            return MATRIX_CHARACTER_SETS[key] || MATRIX_CHARACTER_SETS.japanese;
        }

        function drawMatrixGlyph(char, x, y, color, alpha = 0.9) {
            canvasCtx.shadowBlur = 10;
            canvasCtx.shadowColor = hexToRgba(color, 0.85);
            canvasCtx.fillStyle = hexToRgba(color, Math.max(0.18, alpha));
            canvasCtx.strokeStyle = hexToRgba(color, 0.82);
            if (activeVisualLayerForDraw?.drawMode === 'outline') canvasCtx.strokeText(char, x, y);
            else canvasCtx.fillText(char, x, y);
        }

        function drawMatrixCode(sideSamples, colors) {
            const layer = activeVisualLayerForDraw || {};
            const mirror = layer.mirror !== false;
            const glyphs = getMatrixGlyphs(layer);
            const spawn = layer.matrixSpawn || 'default';
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / Math.max(1, sideSamples.length);
            const fontSize = Math.max(8, Math.min(18, laneWidth * 1.3));
            const rowStep = fontSize * 1.05;
            const t = Math.floor(performance.now() / 120);
            canvasCtx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
            canvasCtx.textAlign = 'center';
            canvasCtx.textBaseline = 'middle';

            if (spawn === 'center' || spawn === 'semi' || spawn === 'random') {
                sideSamples.forEach((sample, i) => {
                    const bursts = Math.max(1, Math.floor(1 + sample * 9));
                    for (let j = 0; j < bursts; j++) {
                        const color = pickColor(colors, i + j, sample);
                        const char = glyphs[Math.abs((i * 7 + j * 5 + t) % glyphs.length)];
                        let x = centerX;
                        let y = centerY;
                        const scalar = (j + 1) / Math.max(1, bursts);
                        const radius = Math.max(10, sample * scalar * Math.min(canvas.width, canvas.height) * 0.62);

                        if (spawn === 'center') {
                            const angle = ((i / Math.max(1, sideSamples.length)) * Math.PI * 2) + (j * 0.41) + (t * 0.025);
                            x = centerX + Math.cos(angle) * radius;
                            y = centerY + Math.sin(angle) * radius;
                        } else if (spawn === 'semi') {
                            const angle = Math.PI + ((i / Math.max(1, sideSamples.length - 1)) * Math.PI) + (j * 0.08);
                            x = centerX + Math.cos(angle) * radius;
                            y = canvas.height - 18 + Math.sin(angle) * radius;
                        } else {
                            const edge = Math.abs((i + j + t) % 4);
                            const drift = sample * Math.max(canvas.width, canvas.height) * (0.18 + scalar * 0.62);
                            const pos = ((i * 37 + j * 19 + t * 3) % 1000) / 1000;
                            if (edge === 0) { x = pos * canvas.width; y = -fontSize + drift; }
                            if (edge === 1) { x = canvas.width + fontSize - drift; y = pos * canvas.height; }
                            if (edge === 2) { x = pos * canvas.width; y = canvas.height + fontSize - drift; }
                            if (edge === 3) { x = -fontSize + drift; y = pos * canvas.height; }
                        }
                        if (x > -fontSize && x < canvas.width + fontSize && y > -fontSize && y < canvas.height + fontSize) {
                            drawMatrixGlyph(char, x, y, color, Math.max(0.24, 0.96 - j * 0.055));
                        }
                    }
                });
                canvasCtx.shadowBlur = 0;
                return;
            }

            sideSamples.forEach((sample, i) => {
                const rows = Math.max(1, Math.floor(sample * canvas.height * 0.86 / rowStep));
                const xs = mirror
                    ? [centerX - ((i + 0.5) * laneWidth), centerX + ((i + 0.5) * laneWidth)]
                    : [(i + 0.5) * laneWidth];
                for (let j = 0; j < rows; j++) {
                    const color = pickColor(colors, i + j, sample);
                    const char = glyphs[Math.abs((i * 7 + j * 3 + t) % glyphs.length)];
                    xs.forEach(x => {
                        const y = canvas.height - (j + 1) * rowStep;
                        drawMatrixGlyph(char, x, y, color, Math.max(0.25, 0.92 - j * 0.035));
                    });
                }
            });
            canvasCtx.shadowBlur = 0;
        }

        function drawCombTeeth(sideSamples, colors) {
            const mirror = activeVisualLayerForDraw?.mirror !== false;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const totalWidth = mirror ? canvas.width / 2 : canvas.width;
            const laneWidth = totalWidth / sideSamples.length;
            const toothGap = Math.max(3, laneWidth * 0.45);
            sideSamples.forEach((sample, i) => {
                const color = pickColor(colors, i, sample);
                const height = Math.max(6, sample * canvas.height * 0.82);
                const xs = mirror
                    ? [centerX - ((i + 0.5) * laneWidth), centerX + ((i + 0.5) * laneWidth)]
                    : [(i + 0.5) * laneWidth];
                canvasCtx.shadowBlur = 10;
                canvasCtx.shadowColor = hexToRgba(color, 0.78);
                canvasCtx.strokeStyle = hexToRgba(color, 0.88);
                canvasCtx.lineWidth = activeVisualLayerForDraw?.drawMode === 'outline' ? 2.2 : 1.2;
                xs.forEach(x => {
                    canvasCtx.beginPath();
                    for (let y = canvas.height - height; y < canvas.height; y += toothGap) {
                        canvasCtx.moveTo(x, y);
                        canvasCtx.lineTo(x, y + toothGap * 0.55);
                    }
                    if (mirror) {
                        for (let y = centerY - height / 2; y < centerY + height / 2; y += toothGap) {
                            canvasCtx.moveTo(x + laneWidth * 0.2, y);
                            canvasCtx.lineTo(x + laneWidth * 0.2, y + toothGap * 0.5);
                        }
                    }
                    canvasCtx.stroke();
                });
            });
            canvasCtx.shadowBlur = 0;
        }

        function drawWarpedGrid(sideSamples, colors) {
            const points = buildMirroredSamples(sideSamples, 80, activeVisualLayerForDraw?.mirror !== false);
            const cols = 22;
            const rows = 12;
            const cellW = canvas.width / cols;
            const cellH = canvas.height / rows;
            canvasCtx.shadowBlur = 8;
            canvasCtx.lineWidth = activeVisualLayerForDraw?.drawMode === 'line' ? 0.8 : 1.4;
            for (let r = 0; r <= rows; r++) {
                const color = pickColor(colors, r, r / rows);
                canvasCtx.strokeStyle = hexToRgba(color, 0.55);
                canvasCtx.shadowColor = hexToRgba(color, 0.5);
                canvasCtx.beginPath();
                for (let c = 0; c <= cols; c++) {
                    const idx = Math.min(points.length - 1, Math.floor((c / cols) * points.length));
                    const bend = (points[idx] || 0) * canvas.height * 0.14 * Math.sin((r / rows) * Math.PI);
                    const x = c * cellW;
                    const y = r * cellH + Math.sin(c * 0.7 + performance.now() / 340) * bend;
                    if (c === 0) canvasCtx.moveTo(x, y);
                    else canvasCtx.lineTo(x, y);
                }
                canvasCtx.stroke();
            }
            for (let c = 0; c <= cols; c++) {
                const color = pickColor(colors, c, c / cols);
                canvasCtx.strokeStyle = hexToRgba(color, 0.45);
                canvasCtx.beginPath();
                for (let r = 0; r <= rows; r++) {
                    const idx = Math.min(points.length - 1, Math.floor((c / cols) * points.length));
                    const bend = (points[idx] || 0) * canvas.width * 0.055 * Math.cos((r / rows) * Math.PI);
                    const x = c * cellW + bend;
                    const y = r * cellH;
                    if (r === 0) canvasCtx.moveTo(x, y);
                    else canvasCtx.lineTo(x, y);
                }
                canvasCtx.stroke();
            }
            canvasCtx.shadowBlur = 0;
        }

        function getVisualSpacing(layer) {
            return clampNumber(layer?.spacing, 0, 3, 0);
        }

        function applySpacingToSamples(samples, layer) {
            const spacing = getVisualSpacing(layer);
            if (spacing <= 0.02 || !samples || samples.length < 8) return samples;
            const targetLen = Math.max(6, Math.round(samples.length / (1 + spacing * 0.32)));
            const spaced = [];
            for (let i = 0; i < targetLen; i++) {
                const idx = Math.min(samples.length - 1, Math.round((i / Math.max(1, targetLen - 1)) * (samples.length - 1)));
                spaced.push(samples[idx]);
            }
            return spaced;
        }

        function applyRandomizeToSamples(samples, layer) {
            if (!layer?.randomize || !samples || samples.length < 2) return samples;
            const t = Math.floor(performance.now() / 135);
            return samples.map((value, i) => {
                const noise = Math.sin((i + 1) * 12.9898 + t * 0.73) * 43758.5453;
                const pick = Math.abs(Math.floor(noise)) % samples.length;
                const jitter = (Math.abs(noise) % 1) * 0.28;
                return Math.max(0, Math.min(5, (value * 0.58) + ((samples[pick] || 0) * 0.34) + jitter));
            });
        }

        function processLayerSamples(sideSamples, layer) {
            const amplified = applyAmplitudeToSamples(sideSamples, layer);
            const randomized = applyRandomizeToSamples(amplified, layer);
            return applySpacingToSamples(randomized, layer);
        }

        function drawLayerByStyle(style, sideSamples, colors, layer) {
            const processedSamples = processLayerSamples(sideSamples, layer);
            if (style === "bars") drawMirroredBars(processedSamples, colors);
            else if (style === "mountain") drawMirroredMountain(processedSamples, colors);
            else if (style === "led") drawMirroredLed(processedSamples, colors);
            else if (style === "symmetric") drawPulseBurst(processedSamples, colors);
            else if (style === "waveline") drawWaveLine(processedSamples, colors);
            else if (style === "orbs") drawOrbChain(processedSamples, colors);
            else if (style === "ribbon") drawRibbon(processedSamples, colors);
            else if (style === "heartbeat") drawHeartbeat(processedSamples, colors);
            else if (style === "pixelwave") drawPixelWave(processedSamples, colors);
            else if (style === "islands") drawFloatingIslands(processedSamples, colors);
            else if (style === "matrixcode") drawMatrixCode(processedSamples, colors);
            else if (style === "comb") drawCombTeeth(processedSamples, colors);
            else if (style === "gridwarp") drawWarpedGrid(processedSamples, colors);
            else drawMirroredBars(processedSamples, colors);
        }

        function drawVisualizer() {
            requestAnimationFrame(drawVisualizer);
            resizeCanvas();
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            if (activeAudio === streamAudio) {
                drawIdleOrStreamVisualizer('URL STREAM');
                return;
            }

            if (!analyser) {
                drawIdleOrStreamVisualizer('READY');
                return;
            }

            const dataArray = getFrequencyData();
            const peak = dataArray ? dataArray.reduce((max, value) => Math.max(max, value), 0) : 0;
            if (!isPlaying || peak < 2) {
                drawIdleOrStreamVisualizer(isPlaying ? 'LISTENING' : 'PAUSED');
                return;
            }

            const sideSamples = getMirroredSideSamples(dataArray, 32);
            const orderedLayers = visualizerLayers
                .map((layer, index) => normalizeVisualizerLayer(layer, index + 1))
                .filter(layer => !layer.hidden)
                .sort((a, b) => (parseInt(a.layer, 10) || 1) - (parseInt(b.layer, 10) || 1));

            orderedLayers.forEach(layer => {
                canvasCtx.save();
                applyLayerCanvasTransform(layer);
                canvasCtx.globalCompositeOperation = layer.blend || 'source-over';
                activeVisualLayerForDraw = layer;
                drawLayerByStyle(layer.style || 'bars', sideSamples, getLayerColors(layer), layer);
                activeVisualLayerForDraw = null;
                canvasCtx.restore();
            });

            canvasCtx.globalCompositeOperation = 'source-over';
            canvasCtx.shadowBlur = 0;
            activeVisualLayerForDraw = null;
        }

        startVisualizer();



        // --- 8B. SETTINGS TABS / MENU HOUSEKEEPING ---
        function setSettingsTab(tab = 'audio') {
            document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.settingsTab === tab));
            document.querySelectorAll('[data-settings-card]').forEach(card => card.classList.toggle('active', card.dataset.settingsCard === tab));
            if (tab === 'storage') updateSettingsHealthPanel();
        }


        // Mobile fix pass 2: bind workspace mode buttons through JS as real buttons.
        // This keeps mobile tab switching reliable even when labels are visually hidden
        // and prevents the active viewport from stealing tap focus.
        function bindWorkspaceModeButtons() {
            document.querySelectorAll('.mode-tab-btn[id^="tab-btn-"]').forEach((btn) => {
                if (btn.dataset.ondaBoundWorkspaceTab === '1') return;
                btn.dataset.ondaBoundWorkspaceTab = '1';
                btn.type = 'button';
                const tabId = 'tab-' + btn.id.replace(/^tab-btn-/, '');
                btn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (document.getElementById(tabId)) switchWorkspaceTab(tabId);
                }, true);
                btn.addEventListener('touchend', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (document.getElementById(tabId)) switchWorkspaceTab(tabId);
                }, { capture: true, passive: false });
            });
        }
        bindWorkspaceModeButtons();

        document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.addEventListener('click', () => setSettingsTab(btn.dataset.settingsTab || 'audio')));
        setSettingsTab('audio');
        document.addEventListener('click', (e) => { document.querySelectorAll('.library-action-group[open]').forEach(menu => { if (!menu.contains(e.target)) menu.removeAttribute('open'); }); }, true);
        safeBind('btn-open-cloud-setup-from-settings', 'click', () => { if (typeof openOndaCloudSetup === 'function') openOndaCloudSetup(false); else document.getElementById('onda-cloud-setup-modal')?.classList.add('open'); });
        safeBind('btn-settings-cloud-save', 'click', () => { const btn = document.getElementById('onda-cloud-save-current'); if (btn) btn.click(); else showToast('Cloud setup is not ready yet.'); });

        window.addEventListener('resize', () => {
            saveLocalUiStateCheckpoint('screen-resize');
            if (libraryDrawer?.classList.contains('drawer-open')) syncMobileLibraryDrawerBounds();
        });
        window.addEventListener('orientationchange', () => {
            saveLocalUiStateCheckpoint('screen-orientation-change');
            setTimeout(() => {
                if (libraryDrawer?.classList.contains('drawer-open')) syncMobileLibraryDrawerBounds();
                saveLocalUiStateCheckpoint('screen-orientation-change-settled');
            }, 180);
        });
        window.addEventListener('pagehide', () => {
            saveLocalUiStateCheckpoint('pagehide');
            flushActiveLibraryState('pagehide-flush');
        });
        window.addEventListener('beforeunload', () => {
            saveLocalUiStateCheckpoint('beforeunload');
            flushActiveLibraryState('beforeunload-flush');
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                saveLocalUiStateCheckpoint('visibility-hidden');
                flushActiveLibraryState('visibility-hidden-flush');
            }
        });
