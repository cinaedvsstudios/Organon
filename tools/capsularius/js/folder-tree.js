import { librarySource, physicalSource, recentsSource, sourceKey } from './state.js';
import { readDirectory } from './filesystem.js';

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sameSource(first, second) {
  return first?.kind === second?.kind
    && (first?.kind !== 'physical' || (
      first.mountId === second.mountId
      && first.pathSegments.join('/') === second.pathSegments.join('/')
    ));
}

function compareName(first, second) {
  return first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function installFolderTree(Workspace) {
  if (Workspace.prototype.__capsulariusFolderTreeInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusFolderTreeInstalled', { value: true });

  const originalRenderSidebar = Workspace.prototype.renderSidebar;
  const originalNavigateWindow = Workspace.prototype.navigateWindow;
  const originalLoadWindow = Workspace.prototype.loadWindow;

  Workspace.prototype.getVirtualTreeChildren = function getVirtualTreeChildren(source) {
    if (source.kind === 'library') {
      return this.buildLibraryEntries()
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          source: entry.source,
          colour: entry.colour,
          icon: entry.emoji || '▰',
          subtitle: entry.subtitle
        }))
        .sort(compareName);
    }
    if (source.kind === 'recents') {
      return this.buildRecentEntries()
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          source: entry.source,
          colour: entry.colour,
          icon: '◷',
          subtitle: entry.subtitle
        }));
    }
    return [];
  };

  Workspace.prototype.loadTreeChildren = async function loadTreeChildren(windowRecord, source) {
    if (source.kind !== 'physical') return this.getVirtualTreeChildren(source);
    const key = sourceKey(source);
    if (windowRecord.treeChildren.has(key)) return windowRecord.treeChildren.get(key);
    if (windowRecord.treeLoading.has(key)) return [];

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
    if (source.kind !== 'physical') return this.getVirtualTreeChildren(source);
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

    const mounted = addSection('Mounted folders');
    if (this.state.mounts.size === 0) {
      mounted.append(makeElement('div', 'nav-empty', 'No folders mounted'));
      return;
    }

    for (const mount of this.state.mounts.values()) {
      const rootSource = physicalSource(mount.id, []);
      mounted.append(this.renderTreeNode(windowRecord, rootSource, mount.nickname || mount.name, mount.colour, 0, { icon: '▰' }));
    }
  };

  Workspace.prototype.renderTreeNode = function renderTreeNode(windowRecord, source, label, colour, depth, options = {}) {
    const key = sourceKey(source);
    const expanded = windowRecord.treeExpanded.has(key);
    const loading = source.kind === 'physical' && windowRecord.treeLoading.has(key);
    const children = this.treeChildrenFor(windowRecord, source);
    const active = sameSource(windowRecord.source, source);
    const hasKnownEmptyChildren = Array.isArray(children) && children.length === 0;
    const isVirtual = Boolean(options.virtual);

    const wrapper = makeElement('div', 'tree-node-wrap');
    const row = makeElement('div', `tree-node${active ? ' active' : ''}${isVirtual ? ' virtual-root' : ''}`);
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
    button.addEventListener('click', () => this.navigateWindow(windowRecord, source));
    row.append(expander, icon, button);
    wrapper.append(row);

    if (expanded) {
      if (loading) {
        const pending = makeElement('div', 'tree-loading', 'Reading folders…');
        pending.style.setProperty('--tree-depth', String(depth + 1));
        wrapper.append(pending);
      } else if (children) {
        for (const child of children) {
          wrapper.append(this.renderTreeNode(windowRecord, child.source, child.name, child.colour || colour, depth + 1, {
            icon: child.icon || '▰',
            subtitle: child.subtitle
          }));
        }
      }
    }
    return wrapper;
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

  Workspace.prototype.loadWindow = async function loadWindowWithTree(windowRecord) {
    const result = await originalLoadWindow.call(this, windowRecord);
    if (windowRecord.source.kind === 'physical') {
      this.expandTreeToSource(windowRecord, windowRecord.source).catch((error) => console.error(error));
    } else {
      this.renderSidebar(windowRecord);
    }
    return result;
  };
}
