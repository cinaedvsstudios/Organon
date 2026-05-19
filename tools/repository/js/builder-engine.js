(function(){
  const saved = repoStorage.readJson(repoStorage.keys.builder, []);

  function isContainer(item) { return item && (item.type === 'group' || item.type === 'section'); }
  function isLeaf(item) { return item && (item.type === 'component' || item.type === 'text'); }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    if (items.some(i => i && (i.type === 'group_start' || i.type === 'group_end'))) return migrateFlatItems(items);
    return items.map(item => {
      if (isContainer(item)) item.children = normalizeItems(item.children || []);
      return item;
    }).filter(Boolean);
  }

  function migrateFlatItems(items) {
    const root = [];
    const stack = [{ children: root }];
    let currentSection = null;
    for (const item of items) {
      if (!item) continue;
      if (item.type === 'group_start') {
        const group = { id: createId('group'), type: 'group', name: item.name || nextGroupName(root), children: [] };
        stack[stack.length - 1].children.push(group);
        stack.push(group);
        currentSection = null;
      } else if (item.type === 'group_end') {
        if (stack.length > 1) stack.pop();
        currentSection = null;
      } else if (item.type === 'section') {
        const section = { id: item.id || createId('section'), type: 'section', name: item.name || 'SECTION', children: [] };
        stack[stack.length - 1].children.push(section);
        currentSection = section;
      } else {
        const cleaned = { ...item };
        if (currentSection && stack[stack.length - 1] !== currentSection) currentSection.children.push(cleaned);
        else stack[stack.length - 1].children.push(cleaned);
      }
    }
    return root;
  }

  window.builderState = {
    items: normalizeItems(saved),
    basketModeActive: false,
    activeId: null,
    selectedIds: new Set(),
    expandedIds: new Set(),
    highlightedRows: new Set(),
    highlightedIds: new Set(),
    isDocked: repoStorage.readJson(repoStorage.keys.dock, false) === true,
    draggedIds: [],
    dragSourceId: null,
    lastSelectedId: null,
    ui: repoStorage.readJson(repoStorage.keys.ui, {}) || {}
  };

  function saveBuilderState() { repoStorage.writeJson(repoStorage.keys.builder, window.builderState.items); }
  function saveUiState() { repoStorage.writeJson(repoStorage.keys.ui, window.builderState.ui); }

  function walkItems(items, callback, parent = null, list = null) {
    const arr = list || items;
    for (let index = 0; index < arr.length; index++) {
      const item = arr[index];
      const result = callback(item, { parent, list: arr, index });
      if (result === false) return false;
      if (isContainer(item)) {
        const childResult = walkItems(items, callback, item, item.children || []);
        if (childResult === false) return false;
      }
    }
  }

  function flattenItems(includeContainers = true) {
    const flat = [];
    walkItems(window.builderState.items, (item, meta) => {
      if (includeContainers || isLeaf(item)) flat.push({ item, ...meta });
    });
    return flat;
  }

  function findItem(id) {
    let found = null;
    walkItems(window.builderState.items, (item, meta) => {
      if (item.id === id) { found = { item, ...meta }; return false; }
    });
    return found;
  }

  function removeById(id) {
    const found = findItem(id);
    if (!found) return null;
    const [removed] = found.list.splice(found.index, 1);
    return removed;
  }

  function insertAfterActive(item) {
    const state = window.builderState;
    if (state.activeId) {
      const active = findItem(state.activeId);
      if (active) {
        if (isContainer(active.item)) {
          active.item.children = active.item.children || [];
          active.item.children.push(item);
        } else {
          active.list.splice(active.index + 1, 0, item);
        }
        state.activeId = item.id;
        saveBuilderState();
        renderBuilder();
        return;
      }
    }
    state.items.push(item);
    state.activeId = item.id;
    saveBuilderState();
    renderBuilder();
  }

  function nextGroupName() {
    let count = 0;
    walkItems(window.builderState.items, (item) => { if (item.type === 'group') count++; });
    return `GROUP ${count + 1}`;
  }

  function setButtonState() {
    const basketBtn = document.getElementById('toggle-basket-btn');
    if (basketBtn) {
      if (window.builderState.basketModeActive) {
        basketBtn.textContent = '🛒 DEACTIVATE BUILDER BASKET';
        basketBtn.className = 'w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded transition shadow-[0_0_15px_#22c55e] border border-green-400 animate-pulse';
      } else {
        basketBtn.textContent = '🛒 ACTIVATE BUILDER BASKET';
        basketBtn.className = 'w-full py-2.5 bg-repo-blue hover:bg-repo-lightblue text-repo-white font-bold text-xs rounded transition shadow-[0_0_10px_#5185c5] border border-repo-blue';
      }
    }
    setBuilderOpenButtonState();
  }

  function setBuilderOpenButtonState() {
    const btn = document.getElementById('open-ui-builder-btn');
    const np = document.getElementById('notepad-window');
    if (!btn || !np) return;
    const isOpen = !np.classList.contains('hidden');
    if (isOpen) {
      btn.textContent = '📝 UI BUILDER OPEN';
      btn.className = 'w-full py-2.5 bg-red-600 shadow-[0_0_15px_#dc2626] animate-pulse text-white font-bold text-xs rounded transition border border-red-500';
    } else {
      btn.textContent = '📝 OPEN UI BUILDER';
      btn.className = 'w-full py-2.5 bg-repo-maroon hover:bg-repo-magenta text-white font-bold text-xs rounded transition shadow-lg border border-repo-salmon/30';
    }
  }

  function toggleBasketMode() {
    window.builderState.basketModeActive = !window.builderState.basketModeActive;
    document.body.classList.toggle('basket-mode-active', window.builderState.basketModeActive);
    setButtonState();
    showToast(window.builderState.basketModeActive ? 'Basket mode active. Click component badges to add.' : 'Basket mode off.');
  }

  function applyBuilderPosition() {
    const np = document.getElementById('notepad-window');
    if (!np || window.builderState.isDocked) return;
    const pos = window.builderState.ui.builderPosition;
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      np.style.left = `${Math.max(8, Math.min(pos.left, window.innerWidth - 100))}px`;
      np.style.top = `${Math.max(8, Math.min(pos.top, window.innerHeight - 80))}px`;
      np.style.right = 'auto';
    }
  }

  function openBuilder() {
    const np = document.getElementById('notepad-window');
    if (!np) return;
    np.classList.remove('hidden');
    applyBuilderPosition();
    setBuilderOpenButtonState();
    renderBuilder();
  }

  function closeBuilder() {
    const np = document.getElementById('notepad-window');
    if (!np) return;
    np.classList.add('hidden');
    setBuilderOpenButtonState();
  }

  function toggleBuilder() {
    const np = document.getElementById('notepad-window');
    if (!np) return;
    if (np.classList.contains('hidden')) openBuilder(); else closeBuilder();
  }

  function addToBasket(id) {
    if (!window.builderState.basketModeActive) return showToast('Activate Builder Basket first.');
    const component = getComponentById(id);
    if (!component) return showToast('Component not found.');
    const promptText = getCurrentComponentPrompt(component.id) || component.prompt || '';
    insertAfterActive({ id: createId('component'), type: 'component', compId: component.id, name: component.title, prompt: promptText });
    showToast(`Added [${component.id}] ${component.title}.`);
    syncBasketBadges();
  }

  function addSection(name) {
    if (!name) return;
    insertAfterActive({ id: createId('section'), type: 'section', name: String(name).toUpperCase(), children: [] });
  }

  function createGroup() { insertAfterActive({ id: createId('group'), type: 'group', name: nextGroupName(), children: [] }); }

  function addTextPill() {
    const item = { id: createId('text'), type: 'text', text: '' };
    insertAfterActive(item);
    setTimeout(() => focusTextPill(item.id), 40);
  }

  function focusTextPill(id) {
    const el = document.getElementById(`text-edit-${id}`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function updateTextPill(id, text) {
    const found = findItem(id);
    if (found && found.item.type === 'text') {
      found.item.text = text;
      saveBuilderState();
      renderBuilder();
    }
  }

  function updateContainerName(id, text) {
    const found = findItem(id);
    if (found && isContainer(found.item)) {
      found.item.name = String(text || found.item.name || '').trim().toUpperCase() || found.item.name;
      saveBuilderState();
      renderBuilder();
    }
  }

  function handleTextPillKeydown(event, id) {
    if (event.key === 'Enter') {
      event.preventDefault();
      updateTextPill(id, event.target.innerText);
      event.target.blur();
    }
  }

  function selectPill(id, event) {
    const state = window.builderState;
    const flat = flattenItems(false).map(x => x.item.id);
    if (event && event.shiftKey && state.lastSelectedId && flat.includes(state.lastSelectedId) && flat.includes(id)) {
      const a = flat.indexOf(state.lastSelectedId);
      const b = flat.indexOf(id);
      const [from, to] = [Math.min(a,b), Math.max(a,b)];
      for (let i = from; i <= to; i++) state.selectedIds.add(flat[i]);
    } else {
      if (state.selectedIds.has(id)) state.selectedIds.delete(id); else state.selectedIds.add(id);
      state.lastSelectedId = id;
    }
    state.activeId = id;
    renderBuilder();
  }

  function setActiveContainer(id) {
    window.builderState.activeId = id;
    renderBuilder();
  }

  function removeItem(id) {
    const removed = removeById(id);
    if (!removed) return;
    window.builderState.selectedIds.delete(id);
    window.builderState.expandedIds.delete(id);
    if (window.builderState.activeId === id) window.builderState.activeId = null;
    saveBuilderState();
    renderBuilder();
    syncBasketBadges();
  }

  function showBuilderConfirm({ title = 'Confirm action', message = 'Continue?', okText = 'Confirm', onConfirm }) {
    const existing = document.getElementById('builder-confirm-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'builder-confirm-overlay';
    overlay.className = 'builder-confirm-overlay';
    overlay.innerHTML = `<div class="builder-confirm-panel" role="dialog" aria-modal="true"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><div class="builder-confirm-actions"><button class="builder-confirm-cancel" type="button">Cancel</button><button class="builder-confirm-ok" type="button">${escapeHtml(okText)}</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.builder-confirm-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.builder-confirm-ok').addEventListener('click', () => { overlay.remove(); onConfirm?.(); });
  }

  function removeContainer(id) {
    const found = findItem(id);
    if (!found || !isContainer(found.item)) return;
    showBuilderConfirm({
      title: 'Delete whole container?',
      message: `This will delete ${found.item.name || 'this container'} and everything inside it.`,
      okText: 'Delete',
      onConfirm: () => removeItem(id)
    });
  }

  function clearBasket() {
    if (!window.builderState.items.length) return showToast('Builder is already empty.');
    showBuilderConfirm({
      title: 'Clear UI Builder?',
      message: 'This removes all groups, sections, notes, and component pills from the builder.',
      okText: 'Clear',
      onConfirm: () => {
        window.builderState.items = [];
        window.builderState.activeId = null;
        window.builderState.selectedIds.clear();
        window.builderState.expandedIds.clear();
        saveBuilderState();
        renderBuilder();
        syncBasketBadges();
      }
    });
  }

  function insertTemplate() { showToast('Templates are coming soon.'); }

  function toggleExpand(id) {
    const set = window.builderState.expandedIds;
    if (set.has(id)) set.delete(id); else set.add(id);
    renderBuilder();
  }

  function toggleHighlightRow(rowNumber) {
    const set = window.builderState.highlightedRows;
    if (set.has(rowNumber)) set.delete(rowNumber); else set.add(rowNumber);
    renderBuilder();
  }

  function syncBasketBadges() {
    const componentIds = new Set();
    walkItems(window.builderState.items, (item) => { if (item.type === 'component') componentIds.add(item.compId); });
    document.querySelectorAll('.add-to-basket').forEach(badge => badge.classList.toggle('in-basket', componentIds.has(badge.dataset.componentId)));
  }

  function toggleDock() {
    const npWindow = document.getElementById('notepad-window');
    const sidebarContainer = document.getElementById('sidebar-index-container');
    const dockBtn = document.getElementById('btn-dock');
    const dragHeader = document.getElementById('notepad-header');
    if (!npWindow || !sidebarContainer || !dockBtn) return;
    if (!window.builderState.isDocked) {
      npWindow.classList.remove('fixed', 'top-24', 'right-8', 'shadow-[0_10px_30px_rgba(0,0,0,0.8)]', 'z-[200]');
      npWindow.style.left = '';
      npWindow.style.top = '';
      npWindow.style.right = '';
      npWindow.classList.add('docked-builder', 'mb-6');
      dragHeader?.classList.remove('cursor-move');
      const span = dragHeader?.querySelector('span'); if (span) span.innerText = '🛠️ UI BUILDER (DOCKED)';
      sidebarContainer.insertBefore(npWindow, sidebarContainer.firstChild);
      dockBtn.innerText = 'Undock';
      document.body.classList.add('index-collapsed-mode');
      window.builderState.isDocked = true;
      setCategoryCollapseHandlers(true);
    } else {
      npWindow.classList.add('fixed', 'top-24', 'right-8', 'shadow-[0_10px_30px_rgba(0,0,0,0.8)]', 'z-[200]');
      npWindow.classList.remove('docked-builder', 'mb-6');
      dragHeader?.classList.add('cursor-move');
      const span = dragHeader?.querySelector('span'); if (span) span.innerText = '🛠️ UI BUILDER';
      document.body.appendChild(npWindow);
      dockBtn.innerText = 'Dock';
      document.body.classList.remove('index-collapsed-mode');
      window.builderState.isDocked = false;
      setCategoryCollapseHandlers(false);
      applyBuilderPosition();
    }
    repoStorage.writeJson(repoStorage.keys.dock, window.builderState.isDocked);
  }

  function setCategoryCollapseHandlers(enabled) {
    document.querySelectorAll('#catalog-nav .category-heading').forEach(heading => {
      heading.onclick = enabled ? function() {
        let next = this.nextElementSibling;
        while (next && !next.classList.contains('category-heading')) {
          if (next.tagName === 'A') next.classList.toggle('expanded');
          next = next.nextElementSibling;
        }
      } : null;
    });
  }

  function setupSectionDropdown() {
    const btn = document.getElementById('section-dropdown-btn');
    const menu = document.getElementById('section-dropdown-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', (event) => { event.stopPropagation(); menu.classList.toggle('hidden'); });
    menu.querySelectorAll('[data-section-name]').forEach(option => option.addEventListener('click', (event) => {
      event.stopPropagation();
      addSection(option.dataset.sectionName);
      menu.classList.add('hidden');
    }));
    document.addEventListener('click', (event) => { if (!menu.contains(event.target) && event.target !== btn) menu.classList.add('hidden'); });
  }

  function setupBuilderDrag() {
    const header = document.getElementById('notepad-header');
    const win = document.getElementById('notepad-window');
    if (!header || !win) return;
    let dragging = false, offsetX = 0, offsetY = 0;
    header.addEventListener('pointerdown', (event) => {
      if (window.builderState.isDocked || event.target.closest('button')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      win.classList.add('fixed');
      win.style.left = `${rect.left}px`;
      win.style.top = `${rect.top}px`;
      win.style.right = 'auto';
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const left = Math.max(8, Math.min(event.clientX - offsetX, window.innerWidth - 80));
      const top = Math.max(8, Math.min(event.clientY - offsetY, window.innerHeight - 50));
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.style.right = 'auto';
    });
    header.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      const rect = win.getBoundingClientRect();
      window.builderState.ui.builderPosition = { left: rect.left, top: rect.top };
      saveUiState();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('toggle-basket-btn')?.addEventListener('click', toggleBasketMode);
    document.getElementById('open-ui-builder-btn')?.addEventListener('click', toggleBuilder);
    document.getElementById('close-builder-btn')?.addEventListener('click', closeBuilder);
    document.getElementById('template-btn')?.addEventListener('click', insertTemplate);
    document.getElementById('group-selected-btn')?.addEventListener('click', createGroup);
    document.getElementById('btn-dock')?.addEventListener('click', toggleDock);
    document.getElementById('btn-copy-all')?.addEventListener('click', copyBuilderToClipboard);
    document.getElementById('btn-download')?.addEventListener('click', downloadBuilderTxt);
    document.getElementById('btn-clear')?.addEventListener('click', clearBasket);
    document.getElementById('notepad-list')?.addEventListener('click', (event) => { if (event.target.id === 'notepad-list') addTextPill(); });
    setupSectionDropdown();
    setupBuilderDrag();
    setButtonState();
    renderBuilder();
    if (window.builderState.isDocked) { window.builderState.isDocked = false; toggleDock(); }
  });

  window.saveBuilderState = saveBuilderState;
  window.walkBuilderItems = (callback) => walkItems(window.builderState.items, callback);
  window.findBuilderItem = findItem;
  window.removeBuilderItemById = removeById;
  window.toggleBasketMode = toggleBasketMode;
  window.addToBasket = addToBasket;
  window.openBuilder = openBuilder;
  window.openNotepad = toggleBuilder;
  window.toggleNotepad = toggleBuilder;
  window.addSection = addSection;
  window.createGroup = createGroup;
  window.setActiveContainer = setActiveContainer;
  window.selectPill = selectPill;
  window.removeItem = removeItem;
  window.removeContainer = removeContainer;
  window.clearBasket = clearBasket;
  window.updateTextPill = updateTextPill;
  window.updateContainerName = updateContainerName;
  window.handleTextPillKeydown = handleTextPillKeydown;
  window.toggleExpand = toggleExpand;
  window.toggleHighlightRow = toggleHighlightRow;
  window.syncBasketBadges = syncBasketBadges;
  window.toggleDock = toggleDock;
  window.isBuilderContainer = isContainer;
})();
