import {
  formatBytes,
  iconForEntry,
  imageObjectUrl,
  queryDirectoryPermission,
  readDirectory
} from './filesystem.js';
import {
  cloneSource,
  defaultColourForSource,
  physicalSource,
  sourcePathLabel,
  sourceTitle
} from './state.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fuzzyMatch(value, query) {
  const haystack = value.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase().trim();
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  let position = 0;
  for (const character of needle) {
    position = haystack.indexOf(character, position);
    if (position === -1) return false;
    position += 1;
  }
  return true;
}

export class Workspace {
  constructor({ state, onStateChange, onLocationOpened, onRequestPermission, onAddToLibrary, onOpenSource, onToast, onCommand }) {
    this.state = state;
    this.onStateChange = onStateChange;
    this.onLocationOpened = onLocationOpened;
    this.onRequestPermission = onRequestPermission;
    this.onAddToLibrary = onAddToLibrary;
    this.onOpenSource = onOpenSource;
    this.onToast = onToast;
    this.onCommand = onCommand;
    this.viewport = document.getElementById('workspace-viewport');
    this.world = document.getElementById('workspace-world');
    this.emptyState = document.getElementById('workspace-empty-state');
    this.contextMenu = document.getElementById('context-menu');
    this.zCounter = 10;

    this.bindWorkspacePanning();
    this.bindContextMenu();
    this.applyWorkspaceTransform();
  }

  bindWorkspacePanning() {
    let pan = null;
    this.viewport.addEventListener('pointerdown', (event) => {
      const isCanvas = event.target === this.viewport || event.target === this.world;
      if (!isCanvas || (event.button !== 1 && !event.shiftKey)) return;
      event.preventDefault();
      pan = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, initialX: this.state.workspace.panX, initialY: this.state.workspace.panY };
      this.viewport.setPointerCapture(event.pointerId);
      this.viewport.classList.add('panning');
    });
    this.viewport.addEventListener('pointermove', (event) => {
      if (!pan || event.pointerId !== pan.pointerId) return;
      this.state.workspace.panX = pan.initialX + event.clientX - pan.startX;
      this.state.workspace.panY = pan.initialY + event.clientY - pan.startY;
      this.applyWorkspaceTransform();
    });
    const finish = (event) => {
      if (!pan || event.pointerId !== pan.pointerId) return;
      try { this.viewport.releasePointerCapture(event.pointerId); } catch (_) { /* no-op */ }
      pan = null;
      this.viewport.classList.remove('panning');
      this.onStateChange();
    };
    this.viewport.addEventListener('pointerup', finish);
    this.viewport.addEventListener('pointercancel', finish);
  }

  bindContextMenu() {
    document.addEventListener('pointerdown', (event) => {
      if (!this.contextMenu.contains(event.target)) this.hideContextMenu();
    });
    window.addEventListener('blur', () => this.hideContextMenu());
    this.contextMenu.addEventListener('click', (event) => {
      const command = event.target.closest('button')?.dataset.command;
      const windowId = Number(this.contextMenu.dataset.windowId);
      const entryId = this.contextMenu.dataset.entryId;
      const windowRecord = this.state.windows.get(windowId);
      if (!command || !windowRecord) return;
      const entry = entryId ? windowRecord.items.find((item) => item.id === entryId) : null;
      this.hideContextMenu();
      if (command === 'add-to-library' && entry?.kind === 'directory') {
        this.onAddToLibrary(windowRecord, physicalSource(windowRecord.source.mountId, [...windowRecord.source.pathSegments, entry.name]));
        return;
      }
      const entries = entry ? this.getSelectedEntries(windowRecord) : this.getSelectedEntries(windowRecord);
      this.onCommand(command, { windowRecord, entries, entry });
    });
  }

  applyWorkspaceTransform() {
    this.world.style.transform = `translate(${this.state.workspace.panX}px, ${this.state.workspace.panY}px)`;
  }

  syncEmptyState() {
    this.emptyState.hidden = this.state.windows.size > 0;
  }

  getWindow(id) {
    return this.state.windows.get(id) || null;
  }

  getSelectedEntries(windowRecord) {
    return windowRecord.items.filter((entry) => windowRecord.selectedIds.has(entry.id));
  }

  selectAll(windowRecord) {
    if (!windowRecord || windowRecord.source.kind !== 'physical') return;
    windowRecord.selectedIds = new Set(windowRecord.items.map((entry) => entry.id));
    windowRecord.lastSelectedIndex = windowRecord.items.length - 1;
    this.renderWindow(windowRecord);
  }

  clearSelection(windowRecord) {
    if (windowRecord.selectedIds.size === 0) return;
    windowRecord.selectedIds.clear();
    windowRecord.lastSelectedIndex = -1;
    this.renderWindow(windowRecord);
  }

  addWindow(windowRecord) {
    this.state.windows.set(windowRecord.id, windowRecord);
    this.renderWindowShell(windowRecord);
    this.focusWindow(windowRecord.id);
    this.loadWindow(windowRecord).catch((error) => {
      console.error(error);
      windowRecord.error = error.message || 'Could not open this location.';
      windowRecord.loading = false;
      this.renderWindow(windowRecord);
    });
    this.syncEmptyState();
  }

  destroyWindow(windowRecord) {
    this.cleanupObjectUrls(windowRecord);
    windowRecord.element?.remove();
    this.state.windows.delete(windowRecord.id);
    if (this.state.activeWindowId === windowRecord.id) this.state.activeWindowId = null;
    this.syncEmptyState();
    this.onStateChange();
  }

  focusWindow(id) {
    const windowRecord = this.state.windows.get(id);
    if (!windowRecord) return;
    this.zCounter += 1;
    for (const record of this.state.windows.values()) record.element?.classList.remove('active');
    windowRecord.element?.classList.add('active');
    if (windowRecord.element) windowRecord.element.style.zIndex = String(this.zCounter);
    this.state.activeWindowId = id;
  }

  renderWindowShell(windowRecord) {
    const root = element('section', 'folder-window');
    root.dataset.windowId = String(windowRecord.id);
    root.style.setProperty('--window-colour', windowRecord.colour);
    root.style.left = `${windowRecord.x}px`;
    root.style.top = `${windowRecord.y}px`;
    root.style.width = `${windowRecord.width}px`;
    root.style.height = `${windowRecord.height}px`;

    const header = element('header', 'window-header');
    const titleRow = element('div', 'window-title-row');
    titleRow.append(element('span', 'window-index', `#${windowRecord.id}`));
    const title = element('span', 'window-title', windowRecord.nickname);
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.setAttribute('aria-label', 'Window nickname');
    titleRow.append(title);
    const actions = element('div', 'window-actions');
    const addLibrary = this.button('☆', 'icon-button', 'Add current folder to Library');
    addLibrary.dataset.action = 'library';
    const colour = this.button('●', 'icon-button', 'Change window colour');
    colour.dataset.action = 'colour';
    const close = this.button('×', 'icon-button close', 'Close window');
    close.dataset.action = 'close';
    actions.append(addLibrary, colour, close);
    header.append(titleRow, actions);

    const toolbar = element('div', 'window-toolbar');
    const left = element('div', 'toolbar-left');
    const back = this.button('←', 'toolbar-button', 'Back'); back.dataset.action = 'back';
    const forward = this.button('→', 'toolbar-button', 'Forward'); forward.dataset.action = 'forward';
    const up = this.button('↑', 'toolbar-button', 'Go up one folder'); up.dataset.action = 'up';
    const refresh = this.button('↻', 'toolbar-button', 'Refresh folder'); refresh.dataset.action = 'refresh';
    const newFolder = this.button('＋', 'toolbar-button', 'Create new folder'); newFolder.dataset.command = 'new-folder';
    const breadcrumbs = element('div', 'breadcrumbs');
    left.append(back, forward, up, refresh, newFolder, breadcrumbs);
    const right = element('div', 'toolbar-right');
    const filter = document.createElement('input');
    filter.className = 'folder-filter';
    filter.placeholder = 'Filter folder…';
    filter.type = 'search';
    filter.setAttribute('aria-label', 'Filter the current folder');
    const toggle = element('div', 'view-toggle');
    const grid = this.button('▦', 'view-button', 'Thumbnail grid view'); grid.dataset.viewMode = 'grid';
    const list = this.button('☷', 'view-button', 'List view'); list.dataset.viewMode = 'list';
    toggle.append(grid, list);
    right.append(filter, toggle);
    toolbar.append(left, right);

    const main = element('div', 'window-main');
    const sidebar = element('aside', 'window-sidebar');
    sidebar.setAttribute('aria-label', 'Folder navigation');
    const content = element('div', 'window-content');
    main.append(sidebar, content);
    const footer = element('footer', 'window-footer');
    footer.append(element('span', 'selection-summary'), element('span', 'window-status'));
    const resize = element('div', 'resize-handle');
    resize.setAttribute('aria-label', 'Resize window');
    root.append(header, toolbar, main, footer, resize);
    this.world.append(root);
    windowRecord.element = root;

    this.bindWindowEvents(windowRecord, { header, title, actions, back, forward, up, refresh, newFolder, filter, grid, list, content, resize });
  }

  button(label, className, title) {
    const button = element('button', className, label);
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    return button;
  }

  bindWindowEvents(windowRecord, controls) {
    const { header, title, actions, back, forward, up, refresh, newFolder, filter, grid, list, content, resize } = controls;
    windowRecord.element.addEventListener('pointerdown', () => this.focusWindow(windowRecord.id));

    title.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); title.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); title.textContent = windowRecord.nickname; title.blur(); }
    });
    title.addEventListener('blur', () => {
      const value = title.textContent.trim();
      windowRecord.nickname = value || sourceTitle(this.state, windowRecord.source);
      title.textContent = windowRecord.nickname;
      this.onStateChange();
    });

    this.bindDragWindow(windowRecord, header);
    this.bindResizeWindow(windowRecord, resize);

    actions.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'close') this.destroyWindow(windowRecord);
      if (action === 'library') this.onAddToLibrary(windowRecord, windowRecord.source);
      if (action === 'colour') this.rotateColour(windowRecord);
    });

    back.addEventListener('click', () => this.moveHistory(windowRecord, -1));
    forward.addEventListener('click', () => this.moveHistory(windowRecord, 1));
    up.addEventListener('click', () => {
      if (windowRecord.source.kind !== 'physical' || windowRecord.source.pathSegments.length === 0) return;
      this.navigateWindow(windowRecord, physicalSource(windowRecord.source.mountId, windowRecord.source.pathSegments.slice(0, -1)));
    });
    refresh.addEventListener('click', () => this.loadWindow(windowRecord));
    newFolder.addEventListener('click', () => this.onCommand('new-folder', { windowRecord, entries: [] }));
    filter.addEventListener('input', () => { windowRecord.filter = filter.value; this.renderWindow(windowRecord); });
    grid.addEventListener('click', () => this.setViewMode(windowRecord, 'grid'));
    list.addEventListener('click', () => this.setViewMode(windowRecord, 'list'));

    content.addEventListener('click', (event) => {
      if (event.target === content || event.target.classList.contains('empty-folder')) this.clearSelection(windowRecord);
    });
    content.addEventListener('contextmenu', (event) => {
      if (event.target === content || event.target.closest('.empty-folder')) {
        event.preventDefault();
        this.showContextMenu(event, windowRecord, null);
      }
    });
    content.addEventListener('dragover', (event) => this.dragOverWindow(event, windowRecord));
    content.addEventListener('dragleave', () => windowRecord.element.classList.remove('drag-target'));
    content.addEventListener('drop', (event) => this.dropOnWindow(event, windowRecord));
  }

  bindDragWindow(windowRecord, header) {
    let drag = null;
    header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button, [contenteditable="true"]')) return;
      event.preventDefault();
      this.focusWindow(windowRecord.id);
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: windowRecord.x, y: windowRecord.y };
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const step = 20;
      windowRecord.x = Math.max(-2000, Math.round((drag.x + event.clientX - drag.startX) / step) * step);
      windowRecord.y = Math.max(-2000, Math.round((drag.y + event.clientY - drag.startY) / step) * step);
      windowRecord.element.style.left = `${windowRecord.x}px`;
      windowRecord.element.style.top = `${windowRecord.y}px`;
    });
    const finish = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { header.releasePointerCapture(event.pointerId); } catch (_) { /* no-op */ }
      drag = null;
      this.onStateChange();
    };
    header.addEventListener('pointerup', finish);
    header.addEventListener('pointercancel', finish);
  }

  bindResizeWindow(windowRecord, resize) {
    let resizing = null;
    resize.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      resizing = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: windowRecord.width, height: windowRecord.height };
      resize.setPointerCapture(event.pointerId);
    });
    resize.addEventListener('pointermove', (event) => {
      if (!resizing || event.pointerId !== resizing.pointerId) return;
      const step = 20;
      windowRecord.width = Math.max(470, Math.round((resizing.width + event.clientX - resizing.startX) / step) * step);
      windowRecord.height = Math.max(300, Math.round((resizing.height + event.clientY - resizing.startY) / step) * step);
      windowRecord.element.style.width = `${windowRecord.width}px`;
      windowRecord.element.style.height = `${windowRecord.height}px`;
    });
    const finish = (event) => {
      if (!resizing || event.pointerId !== resizing.pointerId) return;
      try { resize.releasePointerCapture(event.pointerId); } catch (_) { /* no-op */ }
      resizing = null;
      this.onStateChange();
    };
    resize.addEventListener('pointerup', finish);
    resize.addEventListener('pointercancel', finish);
  }

  rotateColour(windowRecord) {
    const colours = ['#e0a360', '#4b84bf', '#449e92', '#9a2f4f', '#d27d6c', '#896b49'];
    const index = colours.indexOf(windowRecord.colour);
    windowRecord.colour = colours[(index + 1) % colours.length];
    windowRecord.element.style.setProperty('--window-colour', windowRecord.colour);
    this.onStateChange();
  }

  setViewMode(windowRecord, mode) {
    if (windowRecord.viewMode === mode) return;
    windowRecord.viewMode = mode;
    this.renderWindow(windowRecord);
    this.onStateChange();
  }

  async moveHistory(windowRecord, delta) {
    const nextIndex = windowRecord.historyIndex + delta;
    if (nextIndex < 0 || nextIndex >= windowRecord.history.length) return;
    windowRecord.historyIndex = nextIndex;
    windowRecord.source = cloneSource(windowRecord.history[nextIndex]);
    await this.loadWindow(windowRecord);
    this.onStateChange();
  }

  async navigateWindow(windowRecord, source, { history = true } = {}) {
    if (history) {
      const stack = windowRecord.history.slice(0, windowRecord.historyIndex + 1);
      stack.push(cloneSource(source));
      windowRecord.history = stack;
      windowRecord.historyIndex = stack.length - 1;
    }
    windowRecord.source = cloneSource(source);
    windowRecord.selectedIds.clear();
    windowRecord.lastSelectedIndex = -1;
    await this.loadWindow(windowRecord);
    this.onStateChange();
  }

  async loadWindow(windowRecord) {
    windowRecord.loading = true;
    windowRecord.error = null;
    windowRecord.permissionRequired = false;
    this.renderWindow(windowRecord);
    try {
      if (windowRecord.source.kind === 'library') {
        windowRecord.items = this.buildLibraryEntries();
      } else if (windowRecord.source.kind === 'recents') {
        windowRecord.items = this.buildRecentEntries();
      } else {
        const mount = this.state.mounts.get(windowRecord.source.mountId);
        if (!mount) throw new Error('This mounted location is no longer available.');
        mount.permission = await queryDirectoryPermission(mount.handle);
        if (mount.permission !== 'granted') {
          windowRecord.permissionRequired = true;
          windowRecord.items = [];
        } else {
          const result = await readDirectory(mount.handle, windowRecord.source.pathSegments);
          windowRecord.items = result.entries;
          mount.lastOpenedAt = Date.now();
          await this.onLocationOpened(windowRecord.source);
        }
      }
    } catch (error) {
      windowRecord.error = error?.message || 'Could not read this folder.';
      windowRecord.items = [];
    } finally {
      windowRecord.loading = false;
      this.renderWindow(windowRecord);
    }
  }

  buildLibraryEntries() {
    return this.state.library.map((entry) => ({
      id: entry.id,
      kind: 'shortcut',
      source: physicalSource(entry.mountId, entry.pathSegments),
      name: entry.name,
      emoji: entry.emoji,
      colour: entry.colour,
      subtitle: sourcePathLabel(this.state, physicalSource(entry.mountId, entry.pathSegments))
    }));
  }

  buildRecentEntries() {
    return this.state.recents.map((entry) => ({
      id: entry.id,
      kind: 'shortcut',
      source: physicalSource(entry.mountId, entry.pathSegments),
      name: entry.name || sourceTitle(this.state, physicalSource(entry.mountId, entry.pathSegments)),
      emoji: '📁',
      colour: entry.colour || defaultColourForSource(this.state, physicalSource(entry.mountId, entry.pathSegments)),
      subtitle: sourcePathLabel(this.state, physicalSource(entry.mountId, entry.pathSegments))
    }));
  }

  renderWindow(windowRecord) {
    if (!windowRecord.element) return;
    this.cleanupObjectUrls(windowRecord);
    const root = windowRecord.element;
    root.style.setProperty('--window-colour', windowRecord.colour);
    const filter = root.querySelector('.folder-filter');
    if (filter.value !== windowRecord.filter) filter.value = windowRecord.filter;
    root.querySelector('[data-action="library"]').disabled = windowRecord.source.kind !== 'physical';
    root.querySelector('[data-action="up"]').disabled = windowRecord.source.kind !== 'physical' || windowRecord.source.pathSegments.length === 0;
    root.querySelector('[data-action="back"]').disabled = windowRecord.historyIndex <= 0;
    root.querySelector('[data-action="forward"]').disabled = windowRecord.historyIndex >= windowRecord.history.length - 1;
    root.querySelector('[data-command="new-folder"]').disabled = windowRecord.source.kind !== 'physical';
    root.querySelectorAll('[data-view-mode]').forEach((button) => button.classList.toggle('active', button.dataset.viewMode === windowRecord.viewMode));
    this.renderBreadcrumbs(windowRecord);
    this.renderSidebar(windowRecord);
    this.renderContent(windowRecord);
    this.renderFooter(windowRecord);
  }

  renderBreadcrumbs(windowRecord) {
    const container = windowRecord.element.querySelector('.breadcrumbs');
    container.replaceChildren();
    const source = windowRecord.source;
    if (source.kind === 'library' || source.kind === 'recents') {
      container.append(element('span', '', source.kind === 'library' ? 'Library drive' : 'Recent locations'));
      return;
    }
    const mount = this.state.mounts.get(source.mountId);
    if (!mount) { container.append(element('span', '', 'Missing mounted location')); return; }
    const addCrumb = (label, segments) => {
      const crumb = element('button', 'breadcrumb', label);
      crumb.type = 'button';
      crumb.addEventListener('click', () => this.navigateWindow(windowRecord, physicalSource(source.mountId, segments)));
      container.append(crumb);
    };
    addCrumb(mount.nickname || mount.name, []);
    source.pathSegments.forEach((segment, index) => {
      container.append(element('span', 'breadcrumb-separator', '/'));
      addCrumb(segment, source.pathSegments.slice(0, index + 1));
    });
  }

  renderSidebar(windowRecord) {
    const sidebar = windowRecord.element.querySelector('.window-sidebar');
    sidebar.replaceChildren();
    const section = (label) => {
      const block = element('div', 'nav-section');
      block.append(element('div', 'nav-heading', label));
      sidebar.append(block);
      return block;
    };
    const quick = section('Quick access');
    quick.append(this.navButton('▣', 'Library', windowRecord.source.kind === 'library', () => this.navigateWindow(windowRecord, { kind: 'library' })));
    quick.append(this.navButton('◷', 'Recents', windowRecord.source.kind === 'recents', () => this.navigateWindow(windowRecord, { kind: 'recents' })));
    const drives = section('Mounted folders');
    if (this.state.mounts.size === 0) {
      drives.append(element('div', 'nav-empty', 'No folders mounted'));
    } else {
      for (const mount of this.state.mounts.values()) {
        const active = windowRecord.source.kind === 'physical' && windowRecord.source.mountId === mount.id && windowRecord.source.pathSegments.length === 0;
        drives.append(this.navButton('▰', mount.nickname || mount.name, active, () => this.navigateWindow(windowRecord, physicalSource(mount.id, [])), mount.colour));
      }
    }
  }

  navButton(symbol, label, active, action, colour) {
    const button = element('button', `nav-button${active ? ' active' : ''}`);
    button.type = 'button';
    const icon = element('span', 'nav-icon', symbol);
    if (colour) icon.style.color = colour;
    button.append(icon, element('span', 'nav-label', label));
    button.addEventListener('click', action);
    return button;
  }

  renderContent(windowRecord) {
    const content = windowRecord.element.querySelector('.window-content');
    content.replaceChildren();
    if (windowRecord.loading) {
      const loading = element('div', 'loading-state');
      loading.append(element('span', 'spinner'), element('span', '', 'Reading folder…'));
      content.append(loading);
      return;
    }
    if (windowRecord.permissionRequired) {
      const mount = this.state.mounts.get(windowRecord.source.mountId);
      const state = element('div', 'permission-state');
      state.append(element('span', 'empty-symbol', '◌'), element('strong', '', 'Folder permission needed'), element('span', '', `Capsularius needs permission to reopen ${mount?.nickname || mount?.name || 'this folder'}.`));
      const reconnect = this.button('Reconnect folder', 'retry-button', 'Request permission to reopen this folder');
      reconnect.addEventListener('click', () => this.onRequestPermission(windowRecord.source.mountId, windowRecord));
      state.append(reconnect);
      content.append(state);
      return;
    }
    if (windowRecord.error) {
      const state = element('div', 'failure-state');
      state.append(element('span', 'empty-symbol', '!'), element('strong', '', 'Could not open this location'), element('span', '', windowRecord.error));
      const retry = this.button('Retry', 'retry-button', 'Retry opening this location');
      retry.addEventListener('click', () => this.loadWindow(windowRecord));
      state.append(retry);
      content.append(state);
      return;
    }
    const entries = windowRecord.items.filter((entry) => fuzzyMatch(`${entry.name} ${entry.subtitle || ''}`, windowRecord.filter));
    if (entries.length === 0) {
      const empty = element('div', 'empty-folder');
      empty.append(element('span', 'empty-symbol', windowRecord.filter ? '⌕' : '□'), element('strong', '', windowRecord.filter ? 'No matching items' : 'This folder is empty'), element('span', '', windowRecord.filter ? 'Try a different filter.' : 'Right-click here to create a folder or paste items.'));
      content.append(empty);
      return;
    }
    const list = element('div', windowRecord.viewMode === 'grid' ? 'item-grid' : 'item-list');
    entries.forEach((entry, index) => list.append(this.renderItem(windowRecord, entry, index, entries)));
    content.append(list);
  }

  renderItem(windowRecord, entry, index, visibleEntries) {
    const node = element('div', `file-item ${windowRecord.viewMode}`);
    node.dataset.entryId = entry.id;
    node.tabIndex = 0;
    if (entry.kind === 'file' || entry.kind === 'directory') node.draggable = true;
    node.classList.toggle('selected', windowRecord.selectedIds.has(entry.id));
    const main = element('div', 'file-item-main');
    const icon = element('span', 'file-icon', iconForEntry(entry));
    main.append(icon);
    const name = element('div', 'file-name-wrap');
    name.append(element('span', 'file-name', entry.name));
    if (entry.kind === 'shortcut') name.append(element('span', 'file-subtitle', entry.subtitle));
    main.append(name);
    node.append(main);
    if (entry.kind === 'file') node.append(element('span', 'file-meta', formatBytes(entry.size)));
    if (entry.kind === 'shortcut') {
      const dot = element('span', 'folder-colour-dot');
      dot.style.setProperty('--entry-colour', entry.colour || '#e0a360');
      node.append(dot);
    }
    if (windowRecord.viewMode === 'grid' && entry.kind === 'file' && entry.fileType === 'image') this.attachImageThumbnail(windowRecord, entry, icon);
    node.addEventListener('click', (event) => this.selectEntry(windowRecord, entry, index, visibleEntries, event));
    node.addEventListener('dblclick', () => this.openEntry(windowRecord, entry));
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.openEntry(windowRecord, entry);
      if (event.key === ' ') { event.preventDefault(); this.selectEntry(windowRecord, entry, index, visibleEntries, event); }
    });
    node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!windowRecord.selectedIds.has(entry.id)) {
        windowRecord.selectedIds = new Set([entry.id]);
        windowRecord.lastSelectedIndex = index;
        this.renderWindow(windowRecord);
      }
      this.showContextMenu(event, windowRecord, entry);
    });
    node.addEventListener('dragstart', (event) => {
      if (!windowRecord.selectedIds.has(entry.id)) {
        windowRecord.selectedIds = new Set([entry.id]);
        windowRecord.lastSelectedIndex = index;
      }
      const selected = this.getSelectedEntries(windowRecord);
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('application/x-capsularius-source', JSON.stringify({ windowId: windowRecord.id, count: selected.length }));
    });
    return node;
  }

  async attachImageThumbnail(windowRecord, entry, icon) {
    try {
      const url = await imageObjectUrl(entry.handle);
      if (!windowRecord.element?.isConnected || !icon.isConnected) { URL.revokeObjectURL(url); return; }
      windowRecord.objectUrls.add(url);
      const image = document.createElement('img');
      image.className = 'item-thumbnail'; image.alt = ''; image.src = url;
      icon.replaceWith(image);
    } catch (_) { /* keep icon */ }
  }

  selectEntry(windowRecord, entry, index, visibleEntries, event) {
    if (event.shiftKey && windowRecord.lastSelectedIndex >= 0) {
      const start = Math.min(windowRecord.lastSelectedIndex, index);
      const end = Math.max(windowRecord.lastSelectedIndex, index);
      for (let cursor = start; cursor <= end; cursor += 1) windowRecord.selectedIds.add(visibleEntries[cursor].id);
    } else if (event.ctrlKey || event.metaKey) {
      if (windowRecord.selectedIds.has(entry.id)) windowRecord.selectedIds.delete(entry.id);
      else windowRecord.selectedIds.add(entry.id);
      windowRecord.lastSelectedIndex = index;
    } else {
      windowRecord.selectedIds = new Set([entry.id]);
      windowRecord.lastSelectedIndex = index;
    }
    this.renderWindow(windowRecord);
  }

  async openEntry(windowRecord, entry) {
    if (entry.kind === 'directory') {
      await this.navigateWindow(windowRecord, physicalSource(windowRecord.source.mountId, [...windowRecord.source.pathSegments, entry.name]));
      return;
    }
    if (entry.kind === 'shortcut') {
      this.onOpenSource(entry.source, { nickname: entry.name, colour: entry.colour });
      return;
    }
    this.onToast('File previews arrive in Step 4.', 'info');
  }

  dragOverWindow(event, targetWindow) {
    if (targetWindow.source.kind !== 'physical') return;
    if (!event.dataTransfer.types.includes('application/x-capsularius-source')) return;
    event.preventDefault();
    targetWindow.element.classList.add('drag-target');
    event.dataTransfer.dropEffect = event.shiftKey ? 'move' : 'copy';
  }

  dropOnWindow(event, targetWindow) {
    event.preventDefault();
    targetWindow.element.classList.remove('drag-target');
    if (targetWindow.source.kind !== 'physical') return;
    const raw = event.dataTransfer.getData('application/x-capsularius-source');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      const sourceWindow = this.state.windows.get(Number(payload.windowId));
      if (!sourceWindow || sourceWindow.source.kind !== 'physical') return;
      const entries = this.getSelectedEntries(sourceWindow);
      this.onCommand('transfer', { sourceWindow, targetWindow, entries, mode: event.shiftKey ? 'move' : 'copy' });
    } catch (_) {
      this.onToast('That drag operation could not be read.', 'error');
    }
  }

  showContextMenu(event, windowRecord, entry) {
    const physical = windowRecord.source.kind === 'physical';
    const selected = this.getSelectedEntries(windowRecord);
    this.contextMenu.replaceChildren();
    const addItem = (label, command, disabled = false) => {
      const button = element('button', 'context-item', label);
      button.type = 'button';
      button.dataset.command = command;
      button.disabled = disabled;
      this.contextMenu.append(button);
    };
    if (entry) {
      addItem('Copy', 'copy', !physical || selected.length === 0);
      addItem('Cut', 'cut', !physical || selected.length === 0);
      addItem('Rename', 'rename', !physical || selected.length !== 1);
      addItem('Permanently delete', 'delete', !physical || selected.length === 0);
      if (entry.kind === 'directory') addItem('Add to Library', 'add-to-library', !physical);
    } else {
      addItem('Paste', 'paste', !physical);
      addItem('New folder', 'new-folder', !physical);
      addItem('Refresh', 'refresh', false);
    }
    this.contextMenu.dataset.windowId = String(windowRecord.id);
    this.contextMenu.dataset.entryId = entry?.id || '';
    this.contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 230)}px`;
    this.contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 220)}px`;
    this.contextMenu.hidden = false;
  }

  hideContextMenu() {
    this.contextMenu.hidden = true;
    this.contextMenu.replaceChildren();
  }

  renderFooter(windowRecord) {
    const summary = windowRecord.element.querySelector('.selection-summary');
    const status = windowRecord.element.querySelector('.window-status');
    const count = windowRecord.items.length;
    summary.textContent = windowRecord.selectedIds.size ? `${windowRecord.selectedIds.size} selected` : `${count} item${count === 1 ? '' : 's'}`;
    status.textContent = windowRecord.source.kind === 'physical' ? 'Real folder' : 'Virtual drive';
  }

  cleanupObjectUrls(windowRecord) {
    for (const url of windowRecord.objectUrls) URL.revokeObjectURL(url);
    windowRecord.objectUrls.clear();
  }

  async refreshWindows() {
    for (const windowRecord of this.state.windows.values()) {
      await this.loadWindow(windowRecord);
    }
  }

  refreshSpecialWindows() {
    for (const windowRecord of this.state.windows.values()) {
      if (windowRecord.source.kind === 'library' || windowRecord.source.kind === 'recents') this.loadWindow(windowRecord);
      else this.renderSidebar(windowRecord);
    }
  }
}
