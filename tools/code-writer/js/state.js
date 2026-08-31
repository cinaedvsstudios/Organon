(function () {
    'use strict';

    const STORAGE_KEY = 'organon-code-writer-v002-state';

    function makeId(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function defaultHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Untitled Organon Document</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            margin: 40px;
            background: #181919;
            color: #f5f0db;
        }
        .card {
            border: 1px solid #896b49;
            border-radius: 18px;
            padding: 20px;
            background: #292a24;
        }
    </style>
</head>
<body>
    <main class="card">
        <h1>Hello from Code Writer</h1>
        <p>Paste or open HTML, edit Raw View, and watch Preview update live.</p>
    </main>
</body>
</html>`;
    }

    function createTab(options = {}) {
        const now = Date.now();
        const content = typeof options.content === 'string' ? options.content : defaultHtml();
        const filename = options.filename || 'untitled.html';
        return {
            id: options.id || makeId('tab'),
            projectId: options.projectId || 'project-1',
            filename,
            nickname: options.nickname || '',
            content,
            originalContent: typeof options.originalContent === 'string' ? options.originalContent : content,
            previewHidden: Boolean(options.previewHidden),
            bookmarks: Array.isArray(options.bookmarks) ? options.bookmarks : [],
            issues: Array.isArray(options.issues) ? options.issues : [],
            sourceWritable: false,
            fileHandle: null,
            createdAt: options.createdAt || now,
            updatedAt: options.updatedAt || now,
            lastSavedAt: options.lastSavedAt || null
        };
    }

    const state = {
        version: '0.02',
        storageKey: STORAGE_KEY,
        tabs: [],
        activeTabId: null,
        project: {
            id: 'project-1',
            name: 'Project 1',
            color: '#4B84BF',
            collapsed: false,
            hidden: false,
            editMode: false
        },
        rawWidth: 52,
        visualEditEnabled: false,
        bookmarkMode: false,
        currentReport: [],
        suppressPreviewSync: false,
        suppressRawSync: false,
        topPanelLocked: false,
        topPanelHovering: false,
        topCountdownValue: 5,
        topCountdownTimer: null,
        buildingBlocks: [],
        lastCursor: {
            start: 0,
            end: 0,
            line: 1,
            column: 1
        }
    };

    function getActiveTab() {
        return state.tabs.find(tab => tab.id === state.activeTabId) || null;
    }

    function setActiveTab(tabId) {
        const exists = state.tabs.some(tab => tab.id === tabId);
        if (!exists) return null;
        state.activeTabId = tabId;
        saveLocalState();
        return getActiveTab();
    }

    function addTab(options = {}) {
        const tab = createTab(options);
        state.tabs.push(tab);
        state.activeTabId = tab.id;
        saveLocalState();
        return tab;
    }

    function closeTab(tabId) {
        if (state.tabs.length <= 1) return false;
        const index = state.tabs.findIndex(tab => tab.id === tabId);
        if (index === -1) return false;
        state.tabs.splice(index, 1);
        if (state.activeTabId === tabId) {
            const nextTab = state.tabs[Math.max(0, index - 1)] || state.tabs[0];
            state.activeTabId = nextTab.id;
        }
        saveLocalState();
        return true;
    }

    function reorderTab(dragTabId, targetTabId) {
        if (!dragTabId || !targetTabId || dragTabId === targetTabId) return false;
        const fromIndex = state.tabs.findIndex(tab => tab.id === dragTabId);
        const toIndex = state.tabs.findIndex(tab => tab.id === targetTabId);
        if (fromIndex === -1 || toIndex === -1) return false;
        const [moved] = state.tabs.splice(fromIndex, 1);
        const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        state.tabs.splice(adjustedToIndex, 0, moved);
        saveLocalState();
        return true;
    }

    function updateActiveContent(content) {
        const tab = getActiveTab();
        if (!tab) return;
        tab.content = content;
        tab.updatedAt = Date.now();
        saveLocalState();
    }

    function isTabUnsaved(tab) {
        return Boolean(tab && tab.content !== tab.originalContent);
    }

    function getSerializableState() {
        return {
            version: state.version,
            activeTabId: state.activeTabId,
            project: state.project,
            rawWidth: state.rawWidth,
            bookmarkMode: state.bookmarkMode,
            tabs: state.tabs.map(tab => ({
                id: tab.id,
                projectId: tab.projectId,
                filename: tab.filename,
                nickname: tab.nickname,
                content: tab.content,
                originalContent: tab.originalContent,
                previewHidden: tab.previewHidden,
                bookmarks: tab.bookmarks,
                issues: tab.issues,
                createdAt: tab.createdAt,
                updatedAt: tab.updatedAt,
                lastSavedAt: tab.lastSavedAt
            }))
        };
    }

    function saveLocalState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()));
        } catch (error) {
            console.warn('Local Working Save failed:', error);
        }
    }

    function loadLocalState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return false;
            const parsed = JSON.parse(saved);
            if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return false;
            state.version = parsed.version || state.version;
            state.project = parsed.project || state.project;
            state.rawWidth = Number(parsed.rawWidth) || state.rawWidth;
            state.bookmarkMode = Boolean(parsed.bookmarkMode);
            state.tabs = parsed.tabs.map(tab => createTab(tab));
            state.activeTabId = parsed.activeTabId && state.tabs.some(tab => tab.id === parsed.activeTabId)
                ? parsed.activeTabId
                : state.tabs[0].id;
            return true;
        } catch (error) {
            console.warn('Local Working Save restore failed:', error);
            return false;
        }
    }

    function initializeState() {
        const loaded = loadLocalState();
        if (!loaded) {
            addTab({ filename: 'untitled.html', content: defaultHtml() });
        }
    }

    window.CodeWriterState = state;
    window.CodeWriterStore = {
        makeId,
        createTab,
        defaultHtml,
        getActiveTab,
        setActiveTab,
        addTab,
        closeTab,
        reorderTab,
        updateActiveContent,
        isTabUnsaved,
        saveLocalState,
        loadLocalState,
        initializeState
    };
})();
