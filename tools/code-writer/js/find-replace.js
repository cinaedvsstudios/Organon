(function () {
    'use strict';

    const state = {
        matches: [],
        currentIndex: -1,
        lastQuery: '',
        settings: {
            matchCase: false,
            wholeWord: false,
            selectionOnly: false,
            fuzzy: false,
            fuzzyLevel: 'light'
        }
    };

    function getEditor() {
        return window.CodeWriterEditor && window.CodeWriterEditor.getEditor
            ? window.CodeWriterEditor.getEditor()
            : document.getElementById('raw-editor');
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function isWordChar(char) {
        return /[A-Za-z0-9_]/.test(char || '');
    }

    function isWholeWordMatch(text, start, end) {
        return !isWordChar(text[start - 1]) && !isWordChar(text[end]);
    }

    function createPanel() {
        if (document.getElementById('find-replace-panel')) return;
        const rawPane = document.getElementById('raw-pane');
        const header = rawPane && rawPane.querySelector('.pane-header');
        if (!rawPane || !header) return;

        const panel = document.createElement('div');
        panel.id = 'find-replace-panel';
        panel.className = 'find-replace-panel hidden';
        panel.innerHTML = `
            <div class="find-main-row">
                <input id="find-query" class="find-field" type="text" placeholder="Find..." autocomplete="off" spellcheck="false">
                <input id="replace-query" class="find-field" type="text" placeholder="Replace with..." autocomplete="off" spellcheck="false">
                <span id="find-count" class="find-count">0 / 0</span>
                <button type="button" class="micro-btn" id="find-prev-btn">Prev</button>
                <button type="button" class="micro-btn" id="find-next-btn">Next</button>
                <button type="button" class="micro-btn" id="replace-one-btn">Replace</button>
                <button type="button" class="micro-btn" id="replace-all-btn">Replace all</button>
                <button type="button" class="micro-btn" id="find-settings-btn" title="Find settings">⚙</button>
                <button type="button" class="micro-btn" id="find-close-btn">×</button>
            </div>
            <div id="find-settings-panel" class="find-settings-panel hidden">
                <label><input type="checkbox" id="find-match-case"> Match case</label>
                <label><input type="checkbox" id="find-whole-word"> Whole word</label>
                <label><input type="checkbox" id="find-selection-only"> Selection only</label>
                <label><input type="checkbox" id="find-fuzzy"> Fuzzy search</label>
                <label class="find-fuzzy-level">Fuzzy level
                    <select id="find-fuzzy-level">
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="loose">Loose</option>
                    </select>
                </label>
                <span class="find-settings-note">Fuzzy search is local and safe, but fuzzy Replace all asks for confirmation.</span>
            </div>
        `;
        header.insertAdjacentElement('afterend', panel);
        wirePanel();
    }

    function getPanel() {
        createPanel();
        return document.getElementById('find-replace-panel');
    }

    function normalizeTextForFuzzy(text, level) {
        const chars = [];
        const map = [];
        const source = String(text || '');
        for (let i = 0; i < source.length; i += 1) {
            let ch = source[i];
            const lower = state.settings.matchCase ? ch : ch.toLowerCase();
            let keep = true;
            if (level === 'light') keep = !/\s/.test(ch);
            if (level === 'medium') keep = /[A-Za-z0-9_]/.test(ch);
            if (level === 'loose') keep = /[A-Za-z0-9]/.test(ch);
            if (keep) {
                chars.push(lower);
                map.push(i);
            }
        }
        return { text: chars.join(''), map };
    }

    function currentSearchScope(editor) {
        const value = editor.value || '';
        if (state.settings.selectionOnly && editor.selectionStart !== editor.selectionEnd) {
            return {
                text: value.slice(editor.selectionStart, editor.selectionEnd),
                offset: editor.selectionStart
            };
        }
        return { text: value, offset: 0 };
    }

    function findExactMatches(query, scope) {
        const matches = [];
        if (!query) return matches;
        const haystack = state.settings.matchCase ? scope.text : scope.text.toLowerCase();
        const needle = state.settings.matchCase ? query : query.toLowerCase();
        let index = haystack.indexOf(needle);
        while (index !== -1) {
            const start = scope.offset + index;
            const end = start + query.length;
            if (!state.settings.wholeWord || isWholeWordMatch(scope.text, index, index + query.length)) {
                matches.push({ start, end, fuzzy: false });
            }
            index = haystack.indexOf(needle, index + Math.max(1, needle.length));
            if (matches.length > 5000) break;
        }
        return matches;
    }

    function findFuzzyMatches(query, scope) {
        const matches = [];
        if (!query) return matches;
        const normalizedQuery = normalizeTextForFuzzy(query, state.settings.fuzzyLevel).text;
        const normalizedScope = normalizeTextForFuzzy(scope.text, state.settings.fuzzyLevel);
        if (!normalizedQuery) return matches;
        let index = normalizedScope.text.indexOf(normalizedQuery);
        while (index !== -1) {
            const start = scope.offset + normalizedScope.map[index];
            const endMapIndex = index + normalizedQuery.length - 1;
            const end = scope.offset + normalizedScope.map[endMapIndex] + 1;
            matches.push({ start, end, fuzzy: true });
            index = normalizedScope.text.indexOf(normalizedQuery, index + Math.max(1, normalizedQuery.length));
            if (matches.length > 1000) break;
        }
        return matches;
    }

    function updateCount() {
        const count = document.getElementById('find-count');
        if (!count) return;
        if (!state.matches.length) {
            count.textContent = '0 / 0';
            return;
        }
        count.textContent = `${state.currentIndex + 1} / ${state.matches.length}`;
    }

    function selectCurrentMatch() {
        const editor = getEditor();
        if (!editor || !state.matches.length || state.currentIndex < 0) {
            updateCount();
            return;
        }
        const match = state.matches[state.currentIndex];
        editor.focus();
        editor.setSelectionRange(match.start, match.end);
        const before = editor.value.slice(0, match.start);
        const line = before.split('\n').length;
        editor.scrollTop = Math.max(0, (line - 5) * 20);
        if (window.CodeWriterEditor && window.CodeWriterEditor.cursorLineColumn) {
            const cursor = window.CodeWriterEditor.cursorLineColumn(editor.value, match.start);
            window.CodeWriterState.lastCursor = {
                start: match.start,
                end: match.end,
                line: cursor.line,
                column: cursor.column
            };
            window.CodeWriterUI.renderCounts();
        }
        updateCount();
    }

    function refreshMatches(preserveClosest = true) {
        const editor = getEditor();
        const input = document.getElementById('find-query');
        if (!editor || !input) return;
        const query = input.value || '';
        state.lastQuery = query;
        const oldStart = editor.selectionStart || 0;
        const scope = currentSearchScope(editor);
        state.matches = state.settings.fuzzy
            ? findFuzzyMatches(query, scope)
            : findExactMatches(query, scope);

        if (!state.matches.length) {
            state.currentIndex = -1;
            updateCount();
            return;
        }

        if (preserveClosest) {
            const next = state.matches.findIndex(match => match.start >= oldStart);
            state.currentIndex = next === -1 ? 0 : next;
        } else if (state.currentIndex >= state.matches.length) {
            state.currentIndex = 0;
        } else if (state.currentIndex < 0) {
            state.currentIndex = 0;
        }
        selectCurrentMatch();
    }

    function moveMatch(direction) {
        if (!state.matches.length) {
            refreshMatches(false);
            return;
        }
        state.currentIndex += direction;
        if (state.currentIndex < 0) state.currentIndex = state.matches.length - 1;
        if (state.currentIndex >= state.matches.length) state.currentIndex = 0;
        selectCurrentMatch();
    }

    function notifyChanged() {
        if (window.CodeWriterEditor && window.CodeWriterEditor.handleRawInput) {
            window.CodeWriterEditor.handleRawInput();
        } else {
            const editor = getEditor();
            editor && editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function replaceCurrent() {
        const editor = getEditor();
        const replacement = document.getElementById('replace-query');
        if (!editor || !replacement) return;
        if (!state.matches.length) refreshMatches(false);
        if (!state.matches.length || state.currentIndex < 0) {
            window.CodeWriterUI.toast('No find match to replace.');
            return;
        }
        const match = state.matches[state.currentIndex];
        editor.value = editor.value.slice(0, match.start) + replacement.value + editor.value.slice(match.end);
        const nextPos = match.start + replacement.value.length;
        editor.setSelectionRange(nextPos, nextPos);
        notifyChanged();
        refreshMatches(false);
        window.CodeWriterUI.toast('Replaced current match.');
    }

    function replaceAll() {
        const editor = getEditor();
        const replacement = document.getElementById('replace-query');
        if (!editor || !replacement) return;
        refreshMatches(false);
        if (!state.matches.length) {
            window.CodeWriterUI.toast('No find matches to replace.');
            return;
        }
        if (state.settings.fuzzy) {
            const ok = confirm(`Replace ${state.matches.length} fuzzy match(es)? Fuzzy replacement can affect near matches, so check the file afterwards.`);
            if (!ok) return;
        }
        let value = editor.value;
        const replaceValue = replacement.value;
        [...state.matches].sort((a, b) => b.start - a.start).forEach(match => {
            value = value.slice(0, match.start) + replaceValue + value.slice(match.end);
        });
        editor.value = value;
        editor.setSelectionRange(0, 0);
        notifyChanged();
        const count = state.matches.length;
        refreshMatches(false);
        window.CodeWriterUI.toast(`Replaced ${count} match(es).`);
    }

    function syncSettingsFromPanel() {
        const matchCase = document.getElementById('find-match-case');
        const wholeWord = document.getElementById('find-whole-word');
        const selectionOnly = document.getElementById('find-selection-only');
        const fuzzy = document.getElementById('find-fuzzy');
        const fuzzyLevel = document.getElementById('find-fuzzy-level');
        state.settings.matchCase = Boolean(matchCase && matchCase.checked);
        state.settings.wholeWord = Boolean(wholeWord && wholeWord.checked);
        state.settings.selectionOnly = Boolean(selectionOnly && selectionOnly.checked);
        state.settings.fuzzy = Boolean(fuzzy && fuzzy.checked);
        state.settings.fuzzyLevel = fuzzyLevel ? fuzzyLevel.value : 'light';
        refreshMatches(true);
    }

    function wirePanel() {
        const query = document.getElementById('find-query');
        const replace = document.getElementById('replace-query');
        const prev = document.getElementById('find-prev-btn');
        const next = document.getElementById('find-next-btn');
        const replaceOne = document.getElementById('replace-one-btn');
        const replaceEvery = document.getElementById('replace-all-btn');
        const settings = document.getElementById('find-settings-btn');
        const settingsPanel = document.getElementById('find-settings-panel');
        const close = document.getElementById('find-close-btn');
        const settingInputs = ['find-match-case', 'find-whole-word', 'find-selection-only', 'find-fuzzy', 'find-fuzzy-level'];

        let inputTimer = null;
        if (query) {
            query.addEventListener('input', () => {
                clearTimeout(inputTimer);
                inputTimer = setTimeout(() => refreshMatches(true), state.settings.fuzzy ? 260 : 80);
            });
            query.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    moveMatch(event.shiftKey ? -1 : 1);
                }
                if (event.key === 'Escape') closePanel();
            });
        }
        if (replace) {
            replace.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    replaceCurrent();
                }
                if (event.key === 'Escape') closePanel();
            });
        }
        if (prev) prev.addEventListener('click', () => moveMatch(-1));
        if (next) next.addEventListener('click', () => moveMatch(1));
        if (replaceOne) replaceOne.addEventListener('click', replaceCurrent);
        if (replaceEvery) replaceEvery.addEventListener('click', replaceAll);
        if (settings) settings.addEventListener('click', () => settingsPanel && settingsPanel.classList.toggle('hidden'));
        if (close) close.addEventListener('click', closePanel);
        settingInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', syncSettingsFromPanel);
        });
    }

    function openPanel() {
        const panel = getPanel();
        const editor = getEditor();
        if (!panel) return;
        panel.classList.remove('hidden');
        const query = document.getElementById('find-query');
        if (query) {
            const selected = editor && editor.selectionStart !== editor.selectionEnd
                ? editor.value.slice(editor.selectionStart, editor.selectionEnd)
                : '';
            if (selected && selected.length < 160 && !selected.includes('\n')) {
                query.value = selected;
            }
            query.focus();
            query.select();
        }
        refreshMatches(true);
    }

    function closePanel() {
        const panel = document.getElementById('find-replace-panel');
        if (panel) panel.classList.add('hidden');
        const editor = getEditor();
        if (editor) editor.focus();
    }

    document.addEventListener('DOMContentLoaded', () => {
        createPanel();
        document.addEventListener('keydown', event => {
            const key = String(event.key || '').toLowerCase();
            if ((event.ctrlKey || event.metaKey) && key === 'f') {
                event.preventDefault();
                openPanel();
            }
            if ((event.ctrlKey || event.metaKey) && key === 'h') {
                event.preventDefault();
                openPanel();
                const replace = document.getElementById('replace-query');
                if (replace) replace.focus();
            }
        });
    });

    window.CodeWriterFind = {
        open: openPanel,
        close: closePanel,
        refresh: refreshMatches,
        next: () => moveMatch(1),
        previous: () => moveMatch(-1),
        replaceCurrent,
        replaceAll
    };
})();