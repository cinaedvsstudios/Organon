(function () {
    'use strict';

    let inputDebounce = null;

    function getEditor() {
        return document.getElementById('raw-editor');
    }

    function splitLines(text) {
        return String(text || '').split('\n');
    }

    function cursorLineColumn(text, position) {
        const before = text.slice(0, position);
        const parts = before.split('\n');
        return {
            line: parts.length,
            column: parts[parts.length - 1].length + 1
        };
    }

    function lineStartIndex(lines, targetLine) {
        let index = 0;
        const max = Math.max(1, Math.min(targetLine, lines.length));
        for (let i = 0; i < max - 1; i += 1) {
            index += lines[i].length + 1;
        }
        return index;
    }

    function loadActiveTabIntoEditor(options = {}) {
        const editor = getEditor();
        const tab = window.CodeWriterStore.getActiveTab();
        if (!editor || !tab) return;

        const oldStart = editor.selectionStart || 0;
        const oldEnd = editor.selectionEnd || oldStart;
        editor.value = tab.content;
        if (options.preserveCursor) {
            const nextStart = Math.min(oldStart, editor.value.length);
            const nextEnd = Math.min(oldEnd, editor.value.length);
            editor.setSelectionRange(nextStart, nextEnd);
        } else {
            editor.setSelectionRange(0, 0);
            editor.scrollTop = 0;
            editor.scrollLeft = 0;
        }
        updateCursorState();
        renderLineNumbersAndMarkers();
        if (!options.skipPreview) {
            window.CodeWriterPreview.renderPreviewNow();
        }
    }

    function handleRawInput() {
        const editor = getEditor();
        if (!editor || window.CodeWriterState.suppressRawSync) return;
        window.CodeWriterStore.updateActiveContent(editor.value);
        updateCursorState();
        clearTimeout(inputDebounce);
        inputDebounce = setTimeout(() => {
            window.CodeWriterUI.updateEverything();
        }, 120);
    }

    function handlePlainTextPaste(event) {
        const editor = getEditor();
        if (!editor) return;
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;
        editor.value = value.slice(0, start) + text + value.slice(end);
        const nextCursor = start + text.length;
        editor.setSelectionRange(nextCursor, nextCursor);
        handleRawInput();
        window.CodeWriterUI.toast('Pasted as plain text.');
    }

    function handleScrollSync() {
        const editor = getEditor();
        const lineNumbers = document.getElementById('line-numbers');
        const markerGutter = document.getElementById('marker-gutter');
        if (!editor) return;
        const offset = `translateY(${-editor.scrollTop}px)`;
        if (lineNumbers) lineNumbers.style.transform = offset;
        if (markerGutter) markerGutter.style.transform = offset;
    }

    function updateCursorState() {
        const editor = getEditor();
        if (!editor) return;
        const cursor = cursorLineColumn(editor.value, editor.selectionStart || 0);
        window.CodeWriterState.lastCursor = {
            start: editor.selectionStart || 0,
            end: editor.selectionEnd || editor.selectionStart || 0,
            line: cursor.line,
            column: cursor.column
        };
        window.CodeWriterUI.renderCounts();
    }

    function markersForLine(line, lineNumber, tab, lines) {
        const markers = [];
        const lower = line.toLowerCase();
        const issue = (tab.issues || []).find(item => item.line === lineNumber);
        const bookmarks = (tab.bookmarks || []).filter(bookmark => bookmark.line === lineNumber);

        if (issue) markers.push({ label: issue.type === 'error' ? 'ERR' : 'WARN', type: issue.type === 'error' ? 'error' : 'warning', title: issue.message });
        bookmarks.forEach(bookmark => markers.push({ label: 'BM', type: 'bookmark', title: bookmark.name || `Bookmark line ${lineNumber}` }));

        if (/<title[\s>]/i.test(line) || /<\/title>/i.test(line)) markers.push({ label: 'TITLE', type: 'title', title: 'Title tag marker' });
        if (/<table[\s>]/i.test(line) || /<\/table>/i.test(line)) markers.push({ label: 'TABLE', type: 'table', title: 'Table marker' });
        if (/<hr\b/i.test(line)) markers.push({ label: 'HR', type: 'comment', title: 'Horizontal rule marker' });
        if (/<img\b/i.test(line)) {
            const src = line.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
            markers.push({ label: 'IMG', type: 'img', title: src ? `Image: ${src[2]}` : 'Image marker' });
        }
        if (/<style[\s>]/i.test(line) || /<\/style>/i.test(line)) markers.push({ label: 'CSS', type: 'css', title: 'Style block marker' });
        if (/<script[\s>]/i.test(line) || /<\/script>/i.test(line)) markers.push({ label: 'JS', type: 'script', title: 'Script block marker' });
        if (/<!--/.test(line) || /-->/.test(line)) markers.push({ label: 'NOTE', type: 'comment', title: 'HTML comment marker' });

        const originalLine = tab.originalContent ? splitLines(tab.originalContent)[lineNumber - 1] : undefined;
        if (originalLine !== undefined && originalLine !== line) {
            markers.push({ label: 'MOD', type: 'unsaved', title: 'Line differs from the current source/original version.' });
        }

        if (markers.length > 3) return markers.slice(0, 3);
        return markers;
    }

    function renderLineNumbersAndMarkers() {
        const editor = getEditor();
        const numberEl = document.getElementById('line-numbers');
        const markerEl = document.getElementById('marker-gutter');
        const tab = window.CodeWriterStore.getActiveTab();
        if (!editor || !numberEl || !markerEl || !tab) return;

        const lines = splitLines(editor.value);
        const numberFragment = document.createDocumentFragment();
        const markerFragment = document.createDocumentFragment();

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const num = document.createElement('div');
            num.className = 'line-number';
            num.textContent = lineNumber;
            numberFragment.appendChild(num);

            const markerLine = document.createElement('div');
            markerLine.className = 'marker-line';
            markersForLine(line, lineNumber, tab, lines).forEach(marker => {
                const tag = document.createElement('span');
                tag.className = `marker-tag marker-${marker.type}`;
                tag.textContent = marker.label;
                tag.title = marker.title || marker.label;
                markerLine.appendChild(tag);
            });
            markerFragment.appendChild(markerLine);
        });

        numberEl.innerHTML = '';
        markerEl.innerHTML = '';
        numberEl.appendChild(numberFragment);
        markerEl.appendChild(markerFragment);
        handleScrollSync();
    }

    function insertAtCursor(text) {
        const editor = getEditor();
        if (!editor) return;
        const start = editor.selectionStart || 0;
        const end = editor.selectionEnd || start;
        editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
        const next = start + text.length;
        editor.focus();
        editor.setSelectionRange(next, next);
        handleRawInput();
        window.CodeWriterUI.toast('Inserted at cursor.');
    }

    function addBookmarkAtCursor() {
        const editor = getEditor();
        const tab = window.CodeWriterStore.getActiveTab();
        if (!editor || !tab) return;
        updateCursorState();
        const line = window.CodeWriterState.lastCursor.line;
        const lineText = splitLines(editor.value)[line - 1] || '';
        const name = prompt('Bookmark name', `Line ${line}`);
        if (name === null) return;
        const bookmark = {
            id: window.CodeWriterStore.makeId('bookmark'),
            name: name.trim() || `Line ${line}`,
            line,
            fingerprint: lineText.trim().slice(0, 120),
            createdAt: Date.now()
        };
        tab.bookmarks.push(bookmark);
        window.CodeWriterStore.saveLocalState();
        renderLineNumbersAndMarkers();
        window.CodeWriterUI.toast(`Bookmark added on line ${line}.`);
    }

    function jumpToLine(lineNumber) {
        const editor = getEditor();
        if (!editor) return;
        const lines = splitLines(editor.value);
        const line = Math.max(1, Math.min(lineNumber, lines.length));
        const index = lineStartIndex(lines, line);
        editor.focus();
        editor.setSelectionRange(index, index);
        const approxTop = Math.max(0, (line - 4) * 20);
        editor.scrollTop = approxTop;
        handleScrollSync();
        updateCursorState();
    }

    function navigatePage(direction) {
        const editor = getEditor();
        const tab = window.CodeWriterStore.getActiveTab();
        if (!editor || !tab) return;

        if (window.CodeWriterState.bookmarkMode && tab.bookmarks && tab.bookmarks.length) {
            updateCursorState();
            const sorted = [...tab.bookmarks].sort((a, b) => a.line - b.line);
            const current = window.CodeWriterState.lastCursor.line;
            let target;
            if (direction < 0) {
                target = [...sorted].reverse().find(bookmark => bookmark.line < current) || sorted[sorted.length - 1];
            } else {
                target = sorted.find(bookmark => bookmark.line > current) || sorted[0];
            }
            if (target) {
                jumpToLine(target.line);
                window.CodeWriterUI.toast(`Bookmark: ${target.name}`);
            }
            return;
        }

        const jump = Math.max(240, editor.clientHeight * 0.82);
        editor.scrollTop = Math.max(0, editor.scrollTop + (direction * jump));
        handleScrollSync();
    }

    function selectAllRaw() {
        const editor = getEditor();
        if (!editor) return;
        editor.focus();
        editor.select();
        updateCursorState();
    }

    function runCodeCheck() {
        const tab = window.CodeWriterStore.getActiveTab();
        if (!tab) return;
        const issues = window.CodeWriterCheck.runCheck(tab.content);
        tab.issues = issues;
        window.CodeWriterState.currentReport = issues;
        window.CodeWriterStore.saveLocalState();
        renderLineNumbersAndMarkers();
        window.CodeWriterUI.renderReport(issues);
        window.CodeWriterUI.toast(`Check Code complete: ${issues.length} issue(s).`);
    }

    function setupSplitter() {
        const splitter = document.getElementById('splitter');
        const workspace = document.getElementById('workspace');
        if (!splitter || !workspace) return;

        let dragging = false;

        function move(clientX) {
            if (!dragging) return;
            const rect = workspace.getBoundingClientRect();
            const percent = ((clientX - rect.left) / rect.width) * 100;
            const clamped = Math.max(28, Math.min(74, percent));
            window.CodeWriterState.rawWidth = clamped;
            document.documentElement.style.setProperty('--raw-width', `${clamped}%`);
        }

        splitter.addEventListener('pointerdown', event => {
            dragging = true;
            splitter.classList.add('dragging');
            document.body.classList.add('dragging-splitter');
            splitter.setPointerCapture(event.pointerId);
        });

        splitter.addEventListener('pointermove', event => move(event.clientX));

        splitter.addEventListener('pointerup', event => {
            if (!dragging) return;
            dragging = false;
            splitter.classList.remove('dragging');
            document.body.classList.remove('dragging-splitter');
            try { splitter.releasePointerCapture(event.pointerId); } catch (error) { /* ignore */ }
            window.CodeWriterStore.saveLocalState();
        });
    }

    function setupPasteDialogActions() {
        const buffer = document.getElementById('paste-buffer');
        const replace = document.getElementById('paste-replace-btn');
        const newTab = document.getElementById('paste-new-tab-btn');
        if (replace) {
            replace.addEventListener('click', () => {
                const tab = window.CodeWriterStore.getActiveTab();
                if (!tab || !buffer) return;
                tab.content = buffer.value;
                tab.updatedAt = Date.now();
                window.CodeWriterStore.saveLocalState();
                loadActiveTabIntoEditor({ preserveCursor: false });
                window.CodeWriterUI.closePasteDialog();
                window.CodeWriterUI.updateEverything();
                window.CodeWriterUI.toast('Active tab replaced from paste buffer.');
            });
        }
        if (newTab) {
            newTab.addEventListener('click', () => {
                if (!buffer) return;
                window.CodeWriterStore.addTab({
                    filename: 'pasted-html.html',
                    nickname: 'Pasted HTML',
                    content: buffer.value,
                    originalContent: buffer.value
                });
                loadActiveTabIntoEditor({ preserveCursor: false });
                window.CodeWriterUI.closePasteDialog();
                window.CodeWriterUI.updateEverything();
                window.CodeWriterUI.toast('Created new tab from paste buffer.');
            });
        }
    }

    function setPreviewHidden(hidden) {
        const tab = window.CodeWriterStore.getActiveTab();
        if (!tab) return;
        tab.previewHidden = Boolean(hidden);
        window.CodeWriterStore.saveLocalState();
        window.CodeWriterUI.updateEverything();
        window.CodeWriterUI.toast(tab.previewHidden ? 'Preview hidden for this file.' : 'Preview window opened.');
    }

    function hideProjectMenu() {
        const menu = document.getElementById('project-menu');
        if (menu) menu.classList.add('hidden');
    }

    function setupProjectControls() {
        const project = window.CodeWriterState.project;
        const chip = document.getElementById('project-chip');
        const group = document.getElementById('project-group');
        const menu = document.getElementById('project-menu');
        const collapse = document.getElementById('project-collapse-btn');
        const hide = document.getElementById('project-hide-btn');
        const restore = document.getElementById('project-restore-btn');
        const editToggle = document.getElementById('project-edit-toggle-btn');
        const rename = document.getElementById('project-rename-btn');
        const properties = document.getElementById('project-properties-btn');

        function openMenu(event) {
            if (!menu) return;
            event.preventDefault();
            menu.style.left = `${Math.min(event.clientX, window.innerWidth - 180)}px`;
            menu.style.top = `${Math.min(event.clientY, window.innerHeight - 150)}px`;
            menu.classList.remove('hidden');
        }

        if (chip) chip.addEventListener('contextmenu', openMenu);
        if (group) group.addEventListener('contextmenu', openMenu);

        if (collapse) collapse.addEventListener('click', event => {
            event.stopPropagation();
            project.collapsed = !project.collapsed;
            window.CodeWriterStore.saveLocalState();
            window.CodeWriterUI.updateEverything({ skipPreview: true });
            window.CodeWriterUI.toast(project.collapsed ? 'Project collapsed.' : 'Project expanded.');
        });

        if (hide) hide.addEventListener('click', event => {
            event.stopPropagation();
            project.hidden = true;
            project.editMode = false;
            window.CodeWriterStore.saveLocalState();
            window.CodeWriterUI.updateEverything({ skipPreview: true });
            window.CodeWriterUI.toast('Project strip hidden.');
        });

        if (restore) restore.addEventListener('click', () => {
            project.hidden = false;
            window.CodeWriterStore.saveLocalState();
            window.CodeWriterUI.updateEverything({ skipPreview: true });
            window.CodeWriterUI.toast('Project strip restored.');
        });

        if (editToggle) editToggle.addEventListener('click', () => {
            project.editMode = !project.editMode;
            window.CodeWriterStore.saveLocalState();
            window.CodeWriterUI.updateEverything({ skipPreview: true });
            hideProjectMenu();
            window.CodeWriterUI.toast(project.editMode ? 'Project edit mode on. Tabs can be dragged.' : 'Project edit mode off. Tabs are locked.');
        });

        if (rename) rename.addEventListener('click', () => {
            const nextName = prompt('Rename project', project.name || 'Project 1');
            if (nextName !== null && nextName.trim()) {
                project.name = nextName.trim();
                window.CodeWriterStore.saveLocalState();
                window.CodeWriterUI.updateEverything({ skipPreview: true });
                window.CodeWriterUI.toast('Project renamed.');
            }
            hideProjectMenu();
        });

        if (properties) properties.addEventListener('click', () => {
            const changedCount = window.CodeWriterState.tabs.filter(tab => window.CodeWriterStore.isTabUnsaved(tab)).length;
            window.CodeWriterUI.toast(`${project.name || 'Project'}: ${window.CodeWriterState.tabs.length} tab(s), ${changedCount} changed.`);
            hideProjectMenu();
        });

        document.addEventListener('click', event => {
            if (!menu || menu.classList.contains('hidden')) return;
            if (menu.contains(event.target)) return;
            hideProjectMenu();
        });
    }

    function setupBottomPanelControls() {
        const panel = document.getElementById('bottom-control-panel');
        const handle = document.getElementById('bottom-panel-handle');
        const lock = document.getElementById('bottom-lock-btn');
        if (!panel) return;

        if (handle) handle.addEventListener('click', () => {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                handle.textContent = 'Actions ▼';
            } else {
                handle.textContent = 'Actions ▲';
            }
        });

        if (lock) lock.addEventListener('click', () => {
            panel.classList.toggle('locked');
            const locked = panel.classList.contains('locked');
            lock.textContent = locked ? '🔒' : '🔓';
            if (handle) handle.textContent = locked ? 'Actions ▼' : 'Actions ▲';
            window.CodeWriterUI.toast(locked ? 'Bottom action bar locked open.' : 'Bottom action bar unlocked.');
        });
    }

    function setupMainEvents() {
        const editor = getEditor();
        const app = document.getElementById('app-wrapper');
        const workspace = document.getElementById('workspace');

        if (editor) {
            editor.addEventListener('input', handleRawInput);
            editor.addEventListener('paste', handlePlainTextPaste);
            editor.addEventListener('scroll', handleScrollSync);
            editor.addEventListener('keyup', updateCursorState);
            editor.addEventListener('click', updateCursorState);
            editor.addEventListener('select', updateCursorState);
            editor.addEventListener('keydown', event => {
                if (event.key === 'Tab') {
                    event.preventDefault();
                    insertAtCursor('    ');
                }
            });
        }

        const newTab = document.getElementById('new-tab-btn');
        if (newTab) newTab.addEventListener('click', () => {
            window.CodeWriterStore.addTab({ filename: 'untitled.html' });
            loadActiveTabIntoEditor({ preserveCursor: false });
            window.CodeWriterUI.updateEverything();
            window.CodeWriterUI.toast('New blank tab created.');
        });

        const loadSample = document.getElementById('load-sample-btn');
        if (loadSample) loadSample.addEventListener('click', window.CodeWriterFiles.loadSample);

        const pasteButton = document.getElementById('paste-html-btn');
        if (pasteButton) pasteButton.addEventListener('click', window.CodeWriterUI.openPasteDialog);

        const openButton = document.getElementById('open-file-btn');
        if (openButton) openButton.addEventListener('click', window.CodeWriterFiles.openLocalFile);

        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.addEventListener('change', window.CodeWriterFiles.handleClassicFileInput);

        const saveButton = document.getElementById('source-save-btn');
        if (saveButton) saveButton.addEventListener('click', window.CodeWriterFiles.saveToSourceOrExport);

        const exportButton = document.getElementById('export-html-btn');
        if (exportButton) exportButton.addEventListener('click', window.CodeWriterFiles.exportActiveHtml);

        const copyButton = document.getElementById('copy-html-btn');
        if (copyButton) copyButton.addEventListener('click', window.CodeWriterFiles.copyActiveHtml);

        const checkButton = document.getElementById('check-code-btn');
        if (checkButton) checkButton.addEventListener('click', runCodeCheck);

        const copyReport = document.getElementById('copy-report-btn');
        if (copyReport) copyReport.addEventListener('click', async () => {
            const text = window.CodeWriterCheck.reportText(window.CodeWriterState.currentReport || []);
            try {
                await navigator.clipboard.writeText(text);
                window.CodeWriterUI.toast('Report copied.');
            } catch (error) {
                window.CodeWriterUI.toast('Clipboard copy blocked by browser.');
            }
        });

        const previewHide = document.getElementById('preview-hide-btn');
        if (previewHide) previewHide.addEventListener('click', () => setPreviewHidden(true));

        const openPreview = document.getElementById('open-preview-btn');
        if (openPreview) openPreview.addEventListener('click', () => setPreviewHidden(false));

        const togglePreview = document.getElementById('toggle-preview-btn');
        if (togglePreview) togglePreview.addEventListener('click', () => {
            const tab = window.CodeWriterStore.getActiveTab();
            setPreviewHidden(!(tab && tab.previewHidden));
        });

        const mobileToggle = document.getElementById('mobile-view-toggle');
        if (mobileToggle && workspace) mobileToggle.addEventListener('click', () => {
            const current = workspace.dataset.mobileView || 'raw';
            workspace.dataset.mobileView = current === 'raw' ? 'preview' : 'raw';
            window.CodeWriterUI.toast(workspace.dataset.mobileView === 'raw' ? 'Mobile Raw View.' : 'Mobile Preview View.');
        });

        const extendedRaw = document.getElementById('extended-raw-btn');
        if (extendedRaw && app) extendedRaw.addEventListener('click', () => {
            app.classList.toggle('extended-raw');
            window.CodeWriterUI.syncExtendedRawState();
            window.CodeWriterUI.toast(app.classList.contains('extended-raw') ? 'Extended Raw View enabled.' : 'Split View restored.');
        });

        const visualEdit = document.getElementById('visual-edit-btn');
        if (visualEdit) visualEdit.addEventListener('click', () => {
            window.CodeWriterPreview.setVisualEdit(!window.CodeWriterState.visualEditEnabled);
            window.CodeWriterUI.toast(window.CodeWriterState.visualEditEnabled ? 'Visual editing enabled.' : 'Visual editing disabled.');
        });

        const refreshPreview = document.getElementById('refresh-preview-btn');
        if (refreshPreview) refreshPreview.addEventListener('click', () => {
            window.CodeWriterPreview.renderPreviewNow();
            window.CodeWriterUI.toast('Preview refreshed.');
        });

        const selectAll = document.getElementById('select-all-btn');
        if (selectAll) selectAll.addEventListener('click', selectAllRaw);

        const findFocus = document.getElementById('find-focus-btn');
        if (findFocus) findFocus.addEventListener('click', () => {
            window.CodeWriterUI.toast('Find/replace is listed for the next Phase 1 pass.');
        });

        const insertBlock = document.getElementById('insert-block-btn');
        if (insertBlock) insertBlock.addEventListener('click', () => {
            const select = document.getElementById('building-block-select');
            if (!select || !select.value) {
                window.CodeWriterUI.toast('Choose a building block first.');
                return;
            }
            const block = window.CodeWriterState.buildingBlocks.find(item => item.id === select.value);
            if (!block) return;
            insertAtCursor(block.content || '');
        });

        const addBookmark = document.getElementById('add-bookmark-btn');
        if (addBookmark) addBookmark.addEventListener('click', addBookmarkAtCursor);

        const bookmarkMode = document.getElementById('bookmark-mode-btn');
        if (bookmarkMode) bookmarkMode.addEventListener('click', () => {
            window.CodeWriterState.bookmarkMode = !window.CodeWriterState.bookmarkMode;
            window.CodeWriterStore.saveLocalState();
            window.CodeWriterUI.syncBookmarkModeState();
            window.CodeWriterUI.toast(window.CodeWriterState.bookmarkMode ? 'Bookmark navigation on.' : 'Page navigation on.');
        });

        const pageUp = document.getElementById('page-up-btn');
        if (pageUp) pageUp.addEventListener('click', () => navigatePage(-1));

        const pageDown = document.getElementById('page-down-btn');
        if (pageDown) pageDown.addEventListener('click', () => navigatePage(1));

        const repository = document.getElementById('repository-btn');
        if (repository) repository.addEventListener('click', () => {
            window.open('../../repository/index.html', '_blank', 'noopener,noreferrer');
        });

        setupProjectControls();
        setupBottomPanelControls();
        setupPasteDialogActions();
        setupSplitter();
    }

    function init() {
        window.CodeWriterStore.initializeState();
        document.documentElement.style.setProperty('--raw-width', `${window.CodeWriterState.rawWidth}%`);
        if (window.__organonDirectOpen) {
            const badge = document.getElementById('direct-open-badge');
            if (badge) badge.classList.remove('hidden');
        }
        setupMainEvents();
        window.CodeWriterUI.setupTopPanelCountdown();
        window.CodeWriterUI.setupHoverDescriptions();
        window.CodeWriterFiles.loadDefaultBuildingBlocks();
        loadActiveTabIntoEditor({ preserveCursor: false });
        window.CodeWriterUI.updateEverything();
        window.CodeWriterUI.toast('Code Writer v0.02 ready.');
    }

    window.CodeWriterEditor = {
        getEditor,
        splitLines,
        cursorLineColumn,
        loadActiveTabIntoEditor,
        handleRawInput,
        renderLineNumbersAndMarkers,
        insertAtCursor,
        addBookmarkAtCursor,
        jumpToLine,
        navigatePage,
        runCodeCheck,
        init
    };

    document.addEventListener('DOMContentLoaded', init);
})();
