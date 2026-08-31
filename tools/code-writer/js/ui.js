(function () {
    'use strict';

    let toastTimer = null;

    function toast(message) {
        const toastEl = document.getElementById('toast-notice');
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2300);
        setHubStatus(message);
    }

    function setHubStatus(text) {
        if (window.parent && window.parent !== window && window.parent.postMessage) {
            window.parent.postMessage({ type: 'set-status', text }, '*');
        }
    }

    function clearHubStatus() {
        if (window.parent && window.parent !== window && window.parent.postMessage) {
            window.parent.postMessage({ type: 'clear-status' }, '*');
        }
    }

    function registerHoverDescription(selector, descriptionText) {
        const element = document.querySelector(selector);
        if (!element) return;
        element.addEventListener('mouseenter', () => setHubStatus(descriptionText));
        element.addEventListener('mouseleave', clearHubStatus);
        element.addEventListener('focus', () => setHubStatus(descriptionText));
        element.addEventListener('blur', clearHubStatus);
    }

    function displayNameForTab(tab) {
        return tab.nickname || tab.filename || 'untitled.html';
    }

    function renderTabs() {
        const row = document.getElementById('tab-row');
        if (!row) return;
        row.innerHTML = '';
        const projectEditing = Boolean(window.CodeWriterState.project && window.CodeWriterState.project.editMode);
        window.CodeWriterState.tabs.forEach(tab => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'file-tab';
            if (tab.id === window.CodeWriterState.activeTabId) button.classList.add('active');
            if (window.CodeWriterStore.isTabUnsaved(tab)) button.classList.add('unsaved');
            button.dataset.tabId = tab.id;
            button.draggable = projectEditing;
            button.title = `${tab.filename}${tab.nickname ? ` · nickname: ${tab.nickname}` : ''}\nDouble-click to rename tab nickname.${projectEditing ? '\nDrag to reorder while Project Edit is on.' : ''}`;

            const dot = document.createElement('span');
            dot.className = 'unsaved-dot';
            button.appendChild(dot);

            const name = document.createElement('span');
            name.className = 'tab-name';
            name.textContent = displayNameForTab(tab);
            button.appendChild(name);

            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'tab-close';
            close.textContent = '×';
            close.title = 'Close tab';
            close.addEventListener('click', event => {
                event.stopPropagation();
                if (window.CodeWriterStore.isTabUnsaved(tab)) {
                    const ok = confirm(`${displayNameForTab(tab)} has unsaved changes in Local Working Save. Close the tab anyway?`);
                    if (!ok) return;
                }
                window.CodeWriterStore.closeTab(tab.id);
                window.CodeWriterEditor.loadActiveTabIntoEditor({ preserveCursor: false });
                updateEverything();
            });
            button.appendChild(close);

            button.addEventListener('click', () => {
                window.CodeWriterStore.setActiveTab(tab.id);
                window.CodeWriterEditor.loadActiveTabIntoEditor({ preserveCursor: false });
                updateEverything();
            });

            button.addEventListener('dblclick', event => {
                event.preventDefault();
                const nextName = prompt('Tab nickname. This does not change the real filename.', tab.nickname || '');
                if (nextName === null) return;
                tab.nickname = nextName.trim();
                tab.updatedAt = Date.now();
                window.CodeWriterStore.saveLocalState();
                updateEverything({ skipPreview: true });
            });

            button.addEventListener('dragstart', event => {
                if (!projectEditing) {
                    event.preventDefault();
                    return;
                }
                window.CodeWriterState.draggingTabId = tab.id;
                button.classList.add('dragging-tab');
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', tab.id);
                }
            });

            button.addEventListener('dragend', () => {
                button.classList.remove('dragging-tab');
                document.querySelectorAll('.drag-over-tab').forEach(el => el.classList.remove('drag-over-tab'));
                window.CodeWriterState.draggingTabId = null;
            });

            button.addEventListener('dragover', event => {
                if (!projectEditing) return;
                event.preventDefault();
                button.classList.add('drag-over-tab');
            });

            button.addEventListener('dragleave', () => {
                button.classList.remove('drag-over-tab');
            });

            button.addEventListener('drop', event => {
                if (!projectEditing) return;
                event.preventDefault();
                button.classList.remove('drag-over-tab');
                const dragId = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || window.CodeWriterState.draggingTabId;
                if (window.CodeWriterStore.reorderTab(dragId, tab.id)) {
                    updateEverything({ skipPreview: true });
                    toast('Project tab order updated.');
                }
            });

            row.appendChild(button);
        });
    }

    function renderProject() {
        const project = window.CodeWriterState.project || {};
        const label = document.getElementById('project-name-label');
        const dot = document.querySelector('.project-color-dot');
        const strip = document.getElementById('project-strip');
        const group = document.getElementById('project-group');
        const collapse = document.getElementById('project-collapse-btn');
        const restore = document.getElementById('project-restore-btn');
        const editToggle = document.getElementById('project-edit-toggle-btn');
        if (label) label.textContent = project.name || 'Project 1';
        if (dot) dot.style.backgroundColor = project.color || '#4B84BF';
        if (group) {
            group.style.borderColor = project.color || '#4B84BF';
            group.style.background = `linear-gradient(90deg, ${project.color || '#4B84BF'}55, rgba(24,25,25,0.66) 35%, rgba(24,25,25,0.42))`;
        }
        if (strip) {
            strip.classList.toggle('project-collapsed', Boolean(project.collapsed));
            strip.classList.toggle('project-hidden', Boolean(project.hidden));
            strip.classList.toggle('project-editing', Boolean(project.editMode));
        }
        if (collapse) {
            collapse.textContent = project.collapsed ? '▸' : '▾';
            collapse.title = project.collapsed ? 'Expand this project' : 'Collapse this project';
        }
        if (restore) restore.classList.toggle('hidden', !project.hidden);
        if (editToggle) editToggle.textContent = project.editMode ? 'Edit off' : 'Edit';
    }

    function renderCounts() {
        const editor = document.getElementById('raw-editor');
        const text = editor ? editor.value : '';
        const lines = text.length ? text.split('\n').length : 1;
        const chars = text.length;
        const lineCount = document.getElementById('line-count-pill');
        const charCount = document.getElementById('char-count-pill');
        const cursor = document.getElementById('cursor-pill');
        if (lineCount) lineCount.textContent = `Lines: ${lines}`;
        if (charCount) charCount.textContent = `Chars: ${chars}`;
        if (cursor) {
            cursor.textContent = `Ln ${window.CodeWriterState.lastCursor.line}, Col ${window.CodeWriterState.lastCursor.column}`;
        }
    }

    function renderBuildingBlocks() {
        const select = document.getElementById('building-block-select');
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Building blocks...</option>';
        window.CodeWriterState.buildingBlocks.forEach(block => {
            const option = document.createElement('option');
            option.value = block.id;
            option.textContent = block.name || block.id;
            option.title = block.description || '';
            select.appendChild(option);
        });
        select.value = current;
    }

    function syncPreviewHiddenState() {
        const app = document.getElementById('app-wrapper');
        const topShowButton = document.getElementById('open-preview-btn');
        const previewHideButton = document.getElementById('preview-hide-btn');
        const tab = window.CodeWriterStore.getActiveTab();
        const hidden = Boolean(tab && tab.previewHidden);
        if (app) app.classList.toggle('preview-hidden', hidden);
        if (topShowButton) topShowButton.classList.toggle('hidden', !hidden);
        if (previewHideButton) previewHideButton.textContent = 'Hide window';
    }

    function syncBookmarkModeState() {
        const button = document.getElementById('bookmark-mode-btn');
        const active = window.CodeWriterState.bookmarkMode;
        if (button) {
            button.classList.toggle('active', active);
            button.textContent = active ? '◆' : '◇';
        }
    }

    function syncExtendedRawState() {
        const app = document.getElementById('app-wrapper');
        const button = document.getElementById('extended-raw-btn');
        const enabled = app && app.classList.contains('extended-raw');
        if (button) button.textContent = enabled ? 'Normal Raw' : 'Extended Raw';
    }

    function updateActiveFileLabel() {
        const tab = window.CodeWriterStore.getActiveTab();
        const label = document.getElementById('active-file-label');
        if (label) label.textContent = tab ? displayNameForTab(tab) : 'no active file';
    }

    function updateEverything(options = {}) {
        renderProject();
        renderTabs();
        renderCounts();
        renderBuildingBlocks();
        syncPreviewHiddenState();
        syncBookmarkModeState();
        syncExtendedRawState();
        updateActiveFileLabel();
        window.CodeWriterEditor.renderLineNumbersAndMarkers();
        if (!options.skipPreview) {
            window.CodeWriterPreview.schedulePreviewRender();
        }
    }

    function openPasteDialog() {
        const dialog = document.getElementById('paste-dialog');
        const buffer = document.getElementById('paste-buffer');
        if (buffer) buffer.value = '';
        if (dialog && dialog.showModal) {
            dialog.showModal();
            setTimeout(() => buffer && buffer.focus(), 60);
        }
    }

    function closePasteDialog() {
        const dialog = document.getElementById('paste-dialog');
        if (dialog && dialog.open) dialog.close();
    }

    function renderReport(issues) {
        const dialog = document.getElementById('check-dialog');
        const summary = document.getElementById('report-summary');
        const list = document.getElementById('report-list');
        const detail = document.getElementById('report-detail');
        if (!list || !summary || !detail) return;

        const errors = issues.filter(issue => issue.type === 'error');
        const warnings = issues.filter(issue => issue.type === 'warning');
        summary.textContent = `${errors.length} error(s), ${warnings.length} warning(s).`;
        list.innerHTML = '';
        detail.innerHTML = issues.length ? 'Select an issue to jump to its line.' : 'No obvious errors or warnings detected.';

        function addGroup(title, group) {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'report-group-title';
            groupTitle.textContent = title;
            list.appendChild(groupTitle);

            if (group.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'report-item';
                empty.textContent = 'None detected.';
                list.appendChild(empty);
                return;
            }

            group.forEach(issue => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `report-item ${issue.type}`;
                item.innerHTML = `<span class="report-line">Line ${issue.line}</span><span class="report-message"></span>`;
                item.querySelector('.report-message').textContent = issue.message;
                item.addEventListener('click', () => {
                    document.querySelectorAll('.report-item.active').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    detail.innerHTML = '';
                    const line = document.createElement('div');
                    line.className = 'report-line';
                    line.textContent = `Line ${issue.line}${issue.section ? ` · ${issue.section}` : ''}`;
                    const msg = document.createElement('p');
                    msg.textContent = issue.message;
                    const code = document.createElement('code');
                    code.className = 'report-code';
                    code.textContent = issue.snippet || '(No line snippet available.)';
                    detail.appendChild(line);
                    detail.appendChild(msg);
                    detail.appendChild(code);
                    window.CodeWriterEditor.jumpToLine(issue.line);
                });
                list.appendChild(item);
            });
        }

        addGroup('Errors', errors);
        const divider = document.createElement('hr');
        divider.style.border = 'none';
        divider.style.borderTop = '1px solid rgba(137,107,73,0.55)';
        divider.style.margin = '12px 0';
        list.appendChild(divider);
        addGroup('Warnings', warnings);

        if (dialog && dialog.showModal) dialog.showModal();
    }

    function setupTopPanelCountdown() {
        const state = window.CodeWriterState;
        const panel = document.getElementById('top-control-panel');
        const circle = document.getElementById('countdown-circle');
        if (!panel || !circle) return;

        function updateCircle() {
            circle.textContent = state.topPanelLocked ? '🔒' : state.topCountdownValue;
        }

        function clearTimer() {
            if (state.topCountdownTimer) clearInterval(state.topCountdownTimer);
            state.topCountdownTimer = null;
        }

        function resetCountdown() {
            clearTimer();
            state.topCountdownValue = 5;
            updateCircle();
        }

        function startCountdown() {
            if (state.topPanelLocked || state.topPanelHovering) return;
            clearTimer();
            state.topCountdownTimer = setInterval(() => {
                state.topCountdownValue -= 1;
                updateCircle();
                if (state.topCountdownValue <= 0) {
                    clearTimer();
                    panel.classList.add('minimized');
                }
            }, 1000);
        }

        panel.addEventListener('mouseenter', () => {
            state.topPanelHovering = true;
            panel.classList.remove('minimized');
            resetCountdown();
        });

        panel.addEventListener('mouseleave', () => {
            state.topPanelHovering = false;
            resetCountdown();
            startCountdown();
        });

        panel.addEventListener('click', () => {
            if (panel.classList.contains('minimized')) {
                panel.classList.remove('minimized');
                resetCountdown();
            }
        });

        circle.addEventListener('dblclick', event => {
            event.preventDefault();
            event.stopPropagation();
            state.topPanelLocked = !state.topPanelLocked;
            updateCircle();
            if (state.topPanelLocked) {
                clearTimer();
                panel.classList.remove('minimized');
                toast('Top controls locked open.');
            } else {
                toast('Top controls unlocked.');
                startCountdown();
            }
        });

        startCountdown();
    }

    function setupHoverDescriptions() {
        registerHoverDescription('#load-sample-btn', 'Load the included sample HTML file into a new Code Writer tab.');
        registerHoverDescription('#paste-html-btn', 'Paste full HTML or a fragment into the editor.');
        registerHoverDescription('#open-file-btn', 'Open a local HTML or text file.');
        registerHoverDescription('#source-save-btn', 'Save over the source file where browser permissions allow it, otherwise export a download.');
        registerHoverDescription('#export-html-btn', 'Export the current tab as an HTML/text file.');
        registerHoverDescription('#copy-html-btn', 'Copy the current raw code to the clipboard.');
        registerHoverDescription('#check-code-btn', 'Run the basic Code Writer structural check and open the report window.');
        registerHoverDescription('#preview-hide-btn', 'Hide the Preview / WYSIWYG window for this file.');
        registerHoverDescription('#open-preview-btn', 'Open the hidden Preview / WYSIWYG window again.');
        registerHoverDescription('#extended-raw-btn', 'Switch between normal split view and a wider Raw View workspace.');
        registerHoverDescription('#add-bookmark-btn', 'Add an editor-only bookmark at the current raw editor line.');
        registerHoverDescription('#insert-block-btn', 'Insert the selected building block at the current raw cursor position.');
        registerHoverDescription('#bottom-panel-handle', 'Open or collapse the bottom action bar.');
        registerHoverDescription('#bottom-lock-btn', 'Lock the bottom action bar open, or unlock it so it collapses again.');
    }

    window.CodeWriterUI = {
        toast,
        setHubStatus,
        clearHubStatus,
        registerHoverDescription,
        displayNameForTab,
        renderTabs,
        renderProject,
        renderCounts,
        renderBuildingBlocks,
        syncPreviewHiddenState,
        syncBookmarkModeState,
        syncExtendedRawState,
        updateActiveFileLabel,
        updateEverything,
        openPasteDialog,
        closePasteDialog,
        renderReport,
        setupTopPanelCountdown,
        setupHoverDescriptions
    };
})();
