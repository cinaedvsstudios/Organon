(function(){
  const saved = repoStorage.readJson(repoStorage.keys.builder, []);
  window.builderState = {
    items: Array.isArray(saved) ? saved : [],
    basketModeActive: false,
    activeId: null,
    selectedIds: new Set(),
    expandedIds: new Set(),
    highlightedIds: new Set(),
    isDocked: repoStorage.readJson(repoStorage.keys.dock, false) === true
  };

  function saveBuilderState() {
    repoStorage.writeJson(repoStorage.keys.builder, window.builderState.items);
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
    showToast(window.builderState.basketModeActive ? 'Basket Mode Active! Click component numbers to add.' : 'Basket Mode Off.');
  }

  function openBuilder() {
    const np = document.getElementById('notepad-window');
    if (!np) return;
    np.classList.remove('hidden');
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
    if (np.classList.contains('hidden')) openBuilder();
    else closeBuilder();
  }

  function insertItem(item) {
    const state = window.builderState;
    if (state.activeId) {
      const idx = state.items.findIndex(i => i.id === state.activeId);
      if (idx > -1) {
        state.items.splice(idx + 1, 0, item);
        state.activeId = item.id;
      } else {
        state.items.push(item);
        state.activeId = item.id;
      }
    } else {
      state.items.push(item);
      state.activeId = item.id;
    }
    saveBuilderState();
    renderBuilder();
  }

  function addToBasket(id) {
    if (!window.builderState.basketModeActive) {
      showToast('Activate Builder Basket first!');
      return;
    }
    const component = getComponentById(id);
    if (!component) return showToast('Component not found.');
    const promptText = getCurrentComponentPrompt(component.id) || component.prompt || '';
    insertItem({ id: createId('component'), type: 'component', compId: component.id, name: component.title, prompt: promptText });
    showToast(`Added [${component.id}] ${component.title} to builder!`);
    syncBasketBadges();
  }

  function addSection(value) {
    if (!value) return;
    insertItem({ id: createId('section'), type: 'section', name: value });
  }

  function addTextPill() {
    const item = { id: createId('text'), type: 'text', text: '' };
    insertItem(item);
    setTimeout(() => {
      const el = document.getElementById(`text-edit-${item.id}`);
      if (!el) return;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }, 40);
  }

  function updateTextPill(id, text) {
    const item = window.builderState.items.find(i => i.id === id);
    if (item) {
      item.text = text;
      saveBuilderState();
    }
  }

  function handleTextPillKeydown(event, id) {
    if (event.key === 'Enter') {
      event.preventDefault();
      updateTextPill(id, event.target.innerText);
      event.target.blur();
    }
  }

  function setActivePill(id) {
    window.builderState.activeId = id;
    renderBuilder();
  }

  function toggleGroupSelection(checkbox, itemId) {
    if (checkbox.checked) window.builderState.selectedIds.add(itemId);
    else window.builderState.selectedIds.delete(itemId);
  }

  function groupSelectedItems() {
    const selected = [...window.builderState.selectedIds];
    if (selected.length === 0) return showToast('Check/select the items to group first.');
    const indices = [];
    window.builderState.items.forEach((item, index) => { if (window.builderState.selectedIds.has(item.id)) indices.push(index); });
    if (!indices.length) return;
    const groupName = prompt('Enter Group Name (e.g. SIDE PANEL):', 'NEW GROUP');
    if (!groupName) return;
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    window.builderState.items.splice(max + 1, 0, { id: createId('group-end'), type: 'group_end', name: groupName.toUpperCase() });
    window.builderState.items.splice(min, 0, { id: createId('group-start'), type: 'group_start', name: groupName.toUpperCase() });
    window.builderState.selectedIds.clear();
    saveBuilderState();
    renderBuilder();
    showToast('Items wrapped in a new Group Block.');
  }

  function removeItem(id) {
    window.builderState.items = window.builderState.items.filter(item => item.id !== id);
    window.builderState.selectedIds.delete(id);
    window.builderState.expandedIds.delete(id);
    window.builderState.highlightedIds.delete(id);
    if (window.builderState.activeId === id) window.builderState.activeId = null;
    saveBuilderState();
    renderBuilder();
    syncBasketBadges();
  }

  function clearBasket() {
    if (!window.builderState.items.length) return showToast('Builder is already empty.');
    if (!confirm('Clear all UI Builder content?')) return;
    window.builderState.items = [];
    window.builderState.activeId = null;
    window.builderState.selectedIds.clear();
    window.builderState.expandedIds.clear();
    window.builderState.highlightedIds.clear();
    saveBuilderState();
    renderBuilder();
    syncBasketBadges();
  }

  function insertTemplate() {
    const template = createBuilderDefaultTemplate();
    if (!window.builderState.items.length) {
      window.builderState.items = template;
      window.builderState.activeId = null;
    } else {
      const ok = confirm('Insert the default template at the active cursor/end? Existing content will not be removed.');
      if (!ok) return;
      const insertAt = window.builderState.activeId ? window.builderState.items.findIndex(i => i.id === window.builderState.activeId) + 1 : window.builderState.items.length;
      window.builderState.items.splice(insertAt, 0, ...template);
    }
    saveBuilderState();
    renderBuilder();
  }

  function toggleExpand(id) {
    const set = window.builderState.expandedIds;
    if (set.has(id)) set.delete(id); else set.add(id);
    renderBuilder();
  }

  function toggleHighlightLine(id) {
    const set = window.builderState.highlightedIds;
    if (set.has(id)) set.delete(id); else set.add(id);
    renderBuilder();
  }

  function syncBasketBadges() {
    const componentIds = new Set(window.builderState.items.filter(i => i.type === 'component').map(i => i.compId));
    document.querySelectorAll('.add-to-basket').forEach(badge => {
      badge.classList.toggle('in-basket', componentIds.has(badge.dataset.componentId));
    });
  }

  function toggleDock() {
    const npWindow = document.getElementById('notepad-window');
    const sidebarContainer = document.getElementById('sidebar-index-container');
    const dockBtn = document.getElementById('btn-dock');
    const dragHeader = document.getElementById('notepad-header');
    if (!npWindow || !sidebarContainer) return;
    if (!window.builderState.isDocked) {
      npWindow.classList.remove('fixed', 'top-24', 'right-8', 'shadow-[0_10px_30px_rgba(0,0,0,0.8)]', 'z-[200]');
      npWindow.classList.add('docked-builder', 'mb-6');
      dragHeader?.classList.remove('cursor-move');
      dragHeader.querySelector('span').innerText = '🛠️ UI BUILDER (DOCKED)';
      sidebarContainer.insertBefore(npWindow, sidebarContainer.firstChild);
      dockBtn.innerText = 'Undock';
      document.body.classList.add('index-collapsed-mode');
      window.builderState.isDocked = true;
      setCategoryCollapseHandlers(true);
    } else {
      npWindow.classList.add('fixed', 'top-24', 'right-8', 'shadow-[0_10px_30px_rgba(0,0,0,0.8)]', 'z-[200]');
      npWindow.classList.remove('docked-builder', 'mb-6');
      dragHeader?.classList.add('cursor-move');
      dragHeader.querySelector('span').innerText = '🛠️ UI BUILDER';
      document.body.appendChild(npWindow);
      dockBtn.innerText = 'Dock';
      document.body.classList.remove('index-collapsed-mode');
      window.builderState.isDocked = false;
      setCategoryCollapseHandlers(false);
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

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('toggle-basket-btn')?.addEventListener('click', toggleBasketMode);
    document.getElementById('open-ui-builder-btn')?.addEventListener('click', toggleBuilder);
    document.getElementById('close-builder-btn')?.addEventListener('click', closeBuilder);
    document.getElementById('template-btn')?.addEventListener('click', insertTemplate);
    document.getElementById('group-selected-btn')?.addEventListener('click', groupSelectedItems);
    document.getElementById('btn-dock')?.addEventListener('click', toggleDock);
    document.getElementById('btn-copy-all')?.addEventListener('click', copyBuilderToClipboard);
    document.getElementById('btn-download')?.addEventListener('click', downloadBuilderTxt);
    document.getElementById('btn-clear')?.addEventListener('click', clearBasket);
    document.getElementById('notepad-section')?.addEventListener('change', (event) => { addSection(event.target.value); event.target.value = ''; });
    document.getElementById('notepad-list')?.addEventListener('click', (event) => { if (event.target.id === 'notepad-list') addTextPill(); });
    setButtonState();
    renderBuilder();
    if (window.builderState.isDocked) {
      window.builderState.isDocked = false;
      toggleDock();
    }
  });

  window.saveBuilderState = saveBuilderState;
  window.toggleBasketMode = toggleBasketMode;
  window.addToBasket = addToBasket;
  window.openBuilder = openBuilder;
  window.openNotepad = toggleBuilder;
  window.toggleNotepad = toggleBuilder;
  window.addSection = addSection;
  window.setActivePill = setActivePill;
  window.toggleGroupSelection = toggleGroupSelection;
  window.groupSelectedItems = groupSelectedItems;
  window.removeItem = removeItem;
  window.clearBasket = clearBasket;
  window.updateTextPill = updateTextPill;
  window.handleTextPillKeydown = handleTextPillKeydown;
  window.toggleExpand = toggleExpand;
  window.toggleHighlightLine = toggleHighlightLine;
  window.syncBasketBadges = syncBasketBadges;
  window.toggleDock = toggleDock;
})();
