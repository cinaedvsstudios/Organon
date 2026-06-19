import { GoogleDriveService } from './google-drive.js';
import { googleDriveSource, librarySource, physicalSource, recentsSource, sourceKey, sourceTitle } from './state.js';
import { readDirectory } from './filesystem.js';

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sameSource(first, second) {
  return sourceKey(first) === sourceKey(second);
}

function compareName(first, second) {
  return first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' });
}

function driveFor(workspace) {
  if (!workspace.googleDrive) workspace.googleDrive = new GoogleDriveService({ state: workspace.state });
  return workspace.googleDrive;
}

function googleBreadcrumbs(source) {
  const chain = [];
  let current = source;
  while (current) {
    chain.unshift(current);
    current = current.parent || null;
  }
  if (!chain.length || chain[0].node !== 'root') chain.unshift(googleDriveSource('root'));
  return chain;
}

export function installFolderTree(Workspace) {
  if (Workspace.prototype.__capsulariusFolderTreeInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusFolderTreeInstalled', { value: true });

  const originalRenderSidebar = Workspace.prototype.renderSidebar;
  const originalNavigateWindow = Workspace.prototype.navigateWindow;
  const originalLoadWindow = Workspace.prototype.loadWindow;
  const originalRenderBreadcrumbs = Workspace.prototype.renderBreadcrumbs;
  const originalOpenEntry = Workspace.prototype.openEntry;
  const originalRenderFooter = Workspace.prototype.renderFooter;
  const originalRenderItem = Workspace.prototype.renderItem;
  const originalRenderWindowShell = Workspace.prototype.renderWindowShell;

  Workspace.prototype.getVirtualTreeChildren = function getVirtualTreeChildren(source) {
    if (source.kind === 'library') {
      return this.buildLibraryEntries()
        .map((entry) => ({ id: entry.id, name: entry.name, source: entry.source, colour: entry.colour, icon: entry.emoji || '▰', subtitle: entry.subtitle }))
        .sort(compareName);
    }
    if (source.kind === 'recents') {
      return this.buildRecentEntries()
        .map((entry) => ({ id: entry.id, name: entry.name, source: entry.source, colour: entry.colour, icon: '◷', subtitle: entry.subtitle }));
    }
    return [];
  };

  Workspace.prototype.getGoogleTreeChildren = async function getGoogleTreeChildren(_windowRecord, source) {
    return driveFor(this).listTreeChildren(source);
  };

  Workspace.prototype.clearGoogleTreeCache = function clearGoogleTreeCache() {
    for (const record of this.state.windows.values()) {
      for (const key of [...record.treeChildren.keys()]) {
        if (key.startsWith('google-drive:')) record.treeChildren.delete(key);
      }
    }
  };

  Workspace.prototype.handleGoogleTreeOpen = async function handleGoogleTreeOpen(windowRecord, source) {
    const drive = driveFor(this);
    try {
      if (source.node === 'connect' || (source.node === 'root' && !drive.isConnected())) {
        await drive.connect();
        this.clearGoogleTreeCache();
        this.refreshSpecialWindows();
        await this.navigateWindow(windowRecord, googleDriveSource('my-drive', { folderId: 'root', parent: googleDriveSource('root') }));
        this.onToast('Google Drive connected for this Capsularius session.', 'success');
        return;
      }
      if (source.node === 'root') {
        await this.navigateWindow(windowRecord, googleDriveSource('my-drive', { folderId: 'root', parent: googleDriveSource('root') }));
        return;
      }
      await this.navigateWindow(windowRecord, source);
    } catch (error) {
      console.error(error);
      this.onToast(error?.message || 'Google Drive could not be opened.', 'error');
    }
  };

  Workspace.prototype.loadTreeChildren = async function loadTreeChildren(windowRecord, source) {
    const key = sourceKey(source);
    if ((source.kind === 'physical' || source.kind === 'google-drive') && windowRecord.treeChildren.has(key)) return windowRecord.treeChildren.get(key);
    if (windowRecord.treeLoading.has(key)) return [];
    if (source.kind === 'library' || source.kind === 'recents') return this.getVirtualTreeChildren(source);

    if (source.kind === 'google-drive') {
      windowRecord.treeLoading.add(key);
      this.renderSidebar(windowRecord);
      try {
        const children = await this.getGoogleTreeChildren(windowRecord, source);
        windowRecord.treeChildren.set(key, children);
        return children;
      } catch (error) {
        console.error(error);
        this.onToast(error?.message || 'Capsularius could not read Google Drive folders.', 'error');
        windowRecord.treeChildren.set(key, []);
        return [];
      } finally {
        windowRecord.treeLoading.delete(key);
        this.renderSidebar(windowRecord);
      }
    }

    const mount = this.state.mounts.get(source.mountId);
    if (!mount || mount.permission !== 'granted') return [];
    windowRecord.treeLoading.add(key);
    this.renderSidebar(windowRecord);
    try {
      const { entries } = await readDirectory(mount.handle, source.pathSegments);
      const children = entries
        .filter((entry) => entry.kind === 'directory')
        .sort(compareName)
        .map((entry) => ({
          id: sourceKey(physicalSource(source.mountId, [...source.pathSegments, entry.name])),
          name: entry.name,
          source: physicalSource(source.mountId, [...source.pathSegments, entry.name]),
          colour: mount.colour,
          icon: '▰'
        }));
      windowRecord.treeChildren.set(key, children);
      return children;
    } catch (error) {
      console.error(error);
      this.onToast('Capsularius could not read child folders for this tree entry.', 'error');
      windowRecord.treeChildren.set(key, []);
      return [];
    } finally {
      windowRecord.treeLoading.delete(key);
      this.renderSidebar(windowRecord);
    }
  };

  Workspace.prototype.treeChildrenFor = function treeChildrenFor(windowRecord, source) {
    if (source.kind === 'library' || source.kind === 'recents') return this.getVirtualTreeChildren(source);
    return windowRecord.treeChildren.get(sourceKey(source));
  };

  Workspace.prototype.toggleTreeNode = async function toggleTreeNode(windowRecord, source) {
    const key = sourceKey(source);
    if (windowRecord.treeExpanded.has(key)) {
      windowRecord.treeExpanded.delete(key);
      this.renderSidebar(windowRecord);
      this.onStateChange();
      return;
    }
    windowRecord.treeExpanded.add(key);
    this.renderSidebar(windowRecord);
    await this.loadTreeChildren(windowRecord, source);
    this.onStateChange();
  };

  Workspace.prototype.expandTreeToSource = async function expandTreeToSource(windowRecord, source) {
    if (source.kind !== 'physical') return;
    for (let depth = 0; depth < source.pathSegments.length; depth += 1) {
      const ancestor = physicalSource(source.mountId, source.pathSegments.slice(0, depth));
      const key = sourceKey(ancestor);
      if (!windowRecord.treeExpanded.has(key)) windowRecord.treeExpanded.add(key);
      await this.loadTreeChildren(windowRecord, ancestor);
    }
    this.renderSidebar(windowRecord);
  };

  Workspace.prototype.renderSidebar = function renderTreeSidebar(windowRecord) {
    const sidebar = windowRecord.element?.querySelector('.window-sidebar');
    if (!sidebar) return originalRenderSidebar.call(this, windowRecord);
    sidebar.replaceChildren();

    const addSection = (label) => {
      const section = makeElement('div', 'nav-section');
      section.append(makeElement('div', 'nav-heading', label));
      sidebar.append(section);
      return section;
    };

    const quick = addSection('Quick access');
    quick.append(this.renderTreeNode(windowRecord, librarySource(), 'Library', '#e0a360', 0, { icon: '▣', virtual: true }));
    quick.append(this.renderTreeNode(windowRecord, recentsSource(), 'Recents', '#4b84bf', 0, { icon: '◷', virtual: true }));
    quick.append(this.renderTreeNode(windowRecord, googleDriveSource('root'), 'Google Drive', '#4285f4', 0, { icon: 'G', virtual: true }));

    const mounted = addSection('Mounted folders');
    if (this.state.mounts.size === 0) {
      mounted.append(makeElement('div', 'nav-empty', 'No folders mounted'));
      return;
    }
    for (const mount of this.state.mounts.values()) {
      mounted.append(this.renderTreeNode(windowRecord, physicalSource(mount.id, []), mount.nickname || mount.name, mount.colour, 0, { icon: '▰' }));
    }
  };

  Workspace.prototype.renderTreeNode = function renderTreeNode(windowRecord, source, label, colour, depth, options = {}) {
    const key = sourceKey(source);
    const expanded = windowRecord.treeExpanded.has(key);
    const loading = windowRecord.treeLoading.has(key);
    const children = this.treeChildrenFor(windowRecord, source);
    const active = sameSource(windowRecord.source, source);
    const hasKnownEmptyChildren = Array.isArray(children) && children.length === 0;

    const wrapper = makeElement('div', 'tree-node-wrap');
    const row = makeElement('div', `tree-node${active ? ' active' : ''}${options.virtual ? ' virtual-root' : ''}`);
    row.style.setProperty('--tree-depth', String(depth));

    const expander = makeElement('button', `tree-expander${expanded ? ' expanded' : ''}${loading ? ' loading' : ''}`, loading ? '·' : expanded ? '▾' : '▸');
    expander.type = 'button';
    expander.title = expanded ? 'Collapse folder tree' : 'Expand child folders';
    expander.setAttribute('aria-label', expander.title);
    if (hasKnownEmptyChildren && !loading) {
      expander.classList.add('empty');
      expander.textContent = '';
      expander.disabled = true;
    } else {
      expander.addEventListener('click', (event) => {
        event.stopPropagation();
        this.toggleTreeNode(windowRecord, source);
      });
    }

    const icon = makeElement('span', 'tree-folder-icon', options.icon || '▰');
    icon.style.color = colour || 'var(--stone)';
    const button = makeElement('button', 'tree-label', label);
    button.type = 'button';
    button.title = options.subtitle ? `${label} — ${options.subtitle}` : label;
    button.addEventListener('click', () => {
      if (source.kind === 'google-drive') this.handleGoogleTreeOpen(windowRecord, source);
      else this.navigateWindow(windowRecord, source);
    });
    row.append(expander, icon, button);
    wrapper.append(row);

    if (expanded) {
      if (loading) {
        const pending = makeElement('div', 'tree-loading', 'Reading folders…');
        pending.style.setProperty('--tree-depth', String(depth + 1));
        wrapper.append(pending);
      } else if (children) {
        for (const child of children) {
          wrapper.append(this.renderTreeNode(windowRecord, child.source, child.name, child.colour || colour, depth + 1, { icon: child.icon || '▰', subtitle: child.subtitle }));
        }
      }
    }
    return wrapper;
  };

  Workspace.prototype.loadWindow = async function loadWindowWithTree(windowRecord) {
    if (windowRecord.source.kind === 'google-drive') {
      windowRecord.loading = true;
      windowRecord.error = null;
      windowRecord.permissionRequired = false;
      this.renderWindow(windowRecord);
      try {
        windowRecord.items = await driveFor(this).listSource(windowRecord.source);
      } catch (error) {
        windowRecord.error = error?.message || 'Google Drive could not be opened.';
        windowRecord.items = [];
      } finally {
        windowRecord.loading = false;
        this.renderWindow(windowRecord);
        this.renderSidebar(windowRecord);
      }
      return;
    }

    const result = await originalLoadWindow.call(this, windowRecord);
    if (windowRecord.source.kind === 'physical') this.expandTreeToSource(windowRecord, windowRecord.source).catch((error) => console.error(error));
    else this.renderSidebar(windowRecord);
    return result;
  };

  Workspace.prototype.navigateWindow = async function navigateWithTree(windowRecord, source, options = {}) {
    const result = await originalNavigateWindow.call(this, windowRecord, source, options);
    if (source.kind === 'physical') {
      await this.expandTreeToSource(windowRecord, source);
      this.onStateChange();
    } else {
      this.renderSidebar(windowRecord);
    }
    return result;
  };

  Workspace.prototype.renderBreadcrumbs = function renderGoogleBreadcrumbs(windowRecord) {
    if (windowRecord.source.kind !== 'google-drive') return originalRenderBreadcrumbs.call(this, windowRecord);
    const container = windowRecord.element.querySelector('.breadcrumbs');
    container.replaceChildren();
    googleBreadcrumbs(windowRecord.source).forEach((source, index, chain) => {
      const crumb = makeElement('button', 'breadcrumb', sourceTitle(this.state, source));
      crumb.type = 'button';
      crumb.addEventListener('click', () => this.handleGoogleTreeOpen(windowRecord, source));
      container.append(crumb);
      if (index < chain.length - 1) container.append(makeElement('span', 'breadcrumb-separator', '/'));
    });
  };

  Workspace.prototype.openEntry = async function openGoogleDriveEntry(windowRecord, entry) {
    if (windowRecord.source.kind === 'google-drive' && entry.cloudSource) {
      await this.handleGoogleTreeOpen(windowRecord, entry.cloudSource);
      return;
    }
    return originalOpenEntry.call(this, windowRecord, entry);
  };

  Workspace.prototype.renderFooter = function renderGoogleDriveFooter(windowRecord) {
    originalRenderFooter.call(this, windowRecord);
    if (windowRecord.source.kind === 'google-drive') {
      windowRecord.element.querySelector('.window-status').textContent = driveFor(this).isConnected() ? 'Google Drive · read-only' : 'Google Drive · not connected';
    }
  };

  Workspace.prototype.renderItem = function renderGoogleDriveItem(windowRecord, entry, index, visibleEntries) {
    const node = originalRenderItem.call(this, windowRecord, entry, index, visibleEntries);
    if (windowRecord.source.kind === 'google-drive') {
      node.draggable = false;
      node.classList.add('cloud-file-item');
    }
    return node;
  };

  Workspace.prototype.renderWindowShell = function renderGoogleDriveWindowShell(windowRecord) {
    originalRenderWindowShell.call(this, windowRecord);
    const up = windowRecord.element.querySelector('[data-action="up"]');
    up.addEventListener('click', () => {
      if (windowRecord.source.kind === 'google-drive' && windowRecord.source.parent) this.handleGoogleTreeOpen(windowRecord, windowRecord.source.parent);
    });
  };
}
