import { GoogleDriveService } from './google-drive.js';
import { readDirectory } from './filesystem.js';
import { googleDriveSource, librarySource, physicalSource, recentsSource, sourceKey, sourceTitle } from './state.js';
import { persistence } from './persistence.js';

const icon = { library: '📚', recents: '🕘', drive: '☁️', folder: '📁', reconnect: '🔗' };

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function driveFor(workspace) {
  if (workspace.googleDrive) return workspace.googleDrive;
  workspace.googleDrive = new GoogleDriveService({ state: workspace.state, persistence });
  workspace.googleDrive.ready.then(() => {
    for (const record of workspace.state.windows.values()) workspace.renderSidebar(record);
  }).catch(console.error);
  return workspace.googleDrive;
}

function sameSource(one, two) { return sourceKey(one) === sourceKey(two); }
function sortName(one, two) { return one.name.localeCompare(two.name, undefined, { numeric: true, sensitivity: 'base' }); }

function menu(event, options) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelector('.drive-account-menu')?.remove();
  const root = el('div', 'drive-account-menu');
  options.forEach(({ label, action, danger }) => {
    const button = el('button', danger ? 'danger' : '', label);
    button.type = 'button';
    button.addEventListener('click', async () => { root.remove(); await action(); });
    root.append(button);
  });
  root.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - 230))}px`;
  root.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - 190))}px`;
  document.body.append(root);
  setTimeout(() => document.addEventListener('pointerdown', (outside) => { if (!root.contains(outside.target)) root.remove(); }, { once: true }), 0);
}

function driveCrumbs(source) {
  const chain = [];
  for (let current = source; current; current = current.parent) chain.unshift(current);
  if (!chain.length || chain[0].node !== 'root') chain.unshift(googleDriveSource('root'));
  return chain;
}

export function installTree(Workspace) {
  if (Workspace.prototype.__capsulariusTreeInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusTreeInstalled', { value: true });

  const original = {
    sidebar: Workspace.prototype.renderSidebar,
    load: Workspace.prototype.loadWindow,
    navigate: Workspace.prototype.navigateWindow,
    breadcrumbs: Workspace.prototype.renderBreadcrumbs,
    open: Workspace.prototype.openEntry,
    footer: Workspace.prototype.renderFooter,
    item: Workspace.prototype.renderItem,
    shell: Workspace.prototype.renderWindowShell
  };

  Workspace.prototype.googleDrive = function getGoogleDrive() { return driveFor(this); };
  Workspace.prototype.refreshGoogleDrive = async function refreshGoogleDrive() {
    for (const record of this.state.windows.values()) {
      for (const key of [...record.treeChildren.keys()]) if (key.startsWith('google-drive:')) record.treeChildren.delete(key);
      this.renderSidebar(record);
      if (record.source.kind === 'google-drive') await this.loadWindow(record);
    }
  };
  Workspace.prototype.addGoogleDrive = async function addGoogleDrive() {
    try {
      const result = await driveFor(this).addAccount();
      await this.refreshGoogleDrive();
      this.onStateChange();
      this.onToast(result.alreadyKnown ? `${result.account.label} reconnected.` : `${result.account.label} added to Capsularius.`, 'success');
    } catch (error) {
      this.onToast(error?.message || 'Google Drive could not be added.', 'error');
    }
  };
  Workspace.prototype.reconnectGoogleDrive = async function reconnectGoogleDrive(accountId) {
    try {
      const account = await driveFor(this).reconnectAccount(accountId);
      await this.refreshGoogleDrive();
      this.onToast(`${account.label} reconnected.`, 'success');
    } catch (error) {
      this.onToast(error?.message || 'Google Drive could not reconnect.', 'error');
    }
  };
  Workspace.prototype.openGoogleSource = async function openGoogleSource(record, source) {
    const drive = driveFor(this);
    if (source.node === 'root' && !drive.accounts().length) return this.addGoogleDrive();
    if (source.node === 'connect' || (source.node === 'account' && !drive.isConnected(source.accountId))) return this.reconnectGoogleDrive(source.accountId);
    if (source.node === 'account') return this.navigateWindow(record, googleDriveSource('my-drive', { accountId: source.accountId, folderId: 'root', parent: source }));
    if (source.node === 'root') {
      const first = drive.accounts()[0];
      if (first) return this.navigateWindow(record, googleDriveSource('account', { accountId: first.id, parent: source }));
      return;
    }
    return this.navigateWindow(record, source);
  };

  Workspace.prototype.virtualTreeChildren = function virtualTreeChildren(source) {
    if (source.kind === 'library') return this.buildLibraryEntries().map((entry) => ({ name: entry.name, source: entry.source, colour: entry.colour, icon: entry.emoji || icon.folder, subtitle: entry.subtitle })).sort(sortName);
    if (source.kind === 'recents') return this.buildRecentEntries().map((entry) => ({ name: entry.name, source: entry.source, colour: entry.colour, icon: icon.recents, subtitle: entry.subtitle }));
    return [];
  };
  Workspace.prototype.treeChildren = async function treeChildren(record, source) {
    const key = sourceKey(source);
    if (record.treeChildren.has(key)) return record.treeChildren.get(key);
    if (record.treeLoading.has(key)) return [];
    if (source.kind === 'library' || source.kind === 'recents') return this.virtualTreeChildren(source);
    record.treeLoading.add(key);
    this.renderSidebar(record);
    try {
      let children;
      if (source.kind === 'google-drive') {
        children = (await driveFor(this).listTreeChildren(source)).map((entry) => ({ ...entry, icon: entry.icon || icon.folder }));
      } else {
        const mount = this.state.mounts.get(source.mountId);
        if (!mount || mount.permission !== 'granted') return [];
        const result = await readDirectory(mount.handle, source.pathSegments);
        children = result.entries.filter((entry) => entry.kind === 'directory').sort(sortName).map((entry) => ({
          name: entry.name,
          source: physicalSource(source.mountId, [...source.pathSegments, entry.name]),
          colour: mount.colour,
          icon: icon.folder
        }));
      }
      record.treeChildren.set(key, children);
      return children;
    } catch (error) {
      record.treeChildren.set(key, []);
      this.onToast('Capsularius could not read child folders.', 'error');
      return [];
    } finally {
      record.treeLoading.delete(key);
      this.renderSidebar(record);
    }
  };
  Workspace.prototype.toggleTree = async function toggleTree(record, source) {
    const key = sourceKey(source);
    if (record.treeExpanded.has(key)) record.treeExpanded.delete(key);
    else { record.treeExpanded.add(key); await this.treeChildren(record, source); }
    this.renderSidebar(record);
    this.onStateChange();
  };
  Workspace.prototype.expandPhysicalTree = async function expandPhysicalTree(record, source) {
    if (source.kind !== 'physical') return;
    for (let depth = 0; depth < source.pathSegments.length; depth += 1) {
      const parent = physicalSource(source.mountId, source.pathSegments.slice(0, depth));
      record.treeExpanded.add(sourceKey(parent));
      await this.treeChildren(record, parent);
    }
  };

  Workspace.prototype.renderTreeNode = function renderTreeNode(record, source, label, colour, depth, options = {}) {
    const key = sourceKey(source);
    const expanded = record.treeExpanded.has(key);
    const loading = record.treeLoading.has(key);
    const children = source.kind === 'library' || source.kind === 'recents' ? this.virtualTreeChildren(source) : record.treeChildren.get(key);
    const empty = Array.isArray(children) && !children.length;
    const wrapper = el('div', 'tree-node-wrap');
    const row = el('div', `tree-node${sameSource(record.source, source) ? ' active' : ''}`);
    row.style.setProperty('--tree-depth', String(depth));
    const expander = el('button', `tree-expander${expanded ? ' expanded' : ''}${loading ? ' loading' : ''}`, loading ? '·' : expanded ? '▾' : '▸');
    expander.type = 'button';
    if (options.noExpander || (empty && !loading)) { expander.disabled = true; expander.classList.add('empty'); expander.textContent = ''; }
    else expander.addEventListener('click', (event) => { event.stopPropagation(); this.toggleTree(record, source); });
    const glyph = el('span', 'tree-folder-icon', options.icon || icon.folder);
    glyph.style.color = colour || 'var(--stone)';
    const button = el('button', 'tree-label', label); button.type = 'button'; button.title = options.subtitle ? `${label} — ${options.subtitle}` : label;
    button.addEventListener('click', () => source.kind === 'google-drive' ? this.openGoogleSource(record, source) : this.navigateWindow(record, source));
    row.append(expander, glyph, button);
    if (options.reconnect) {
      const reconnect = el('button','tree-access-state',icon.reconnect); reconnect.type='button'; reconnect.title='Reconnect';
      reconnect.addEventListener('click',(event)=>{event.stopPropagation();if(source.kind==='google-drive')this.reconnectGoogleDrive(source.accountId);else this.onRequestPermission(source.mountId,record);});
      row.append(reconnect);
    }
    wrapper.append(row);
    if (options.menu) wrapper.addEventListener('contextmenu', options.menu);
    if (expanded) {
      if (loading) wrapper.append(el('div','tree-loading','Reading folders…'));
      else if (children) children.forEach((child) => wrapper.append(this.renderTreeNode(record, child.source, child.name, child.colour || colour, depth + 1, { icon: child.icon || icon.folder, subtitle: child.subtitle })));
    }
    return wrapper;
  };

  Workspace.prototype.renderSidebar = function renderSidebar(record) {
    const sidebar = record.element?.querySelector('.window-sidebar');
    if (!sidebar) return original.sidebar.call(this, record);
    sidebar.replaceChildren();
    const section = (name) => { const node = el('div','nav-section'); node.append(el('div','nav-heading',name)); sidebar.append(node); return node; };
    const quick = section('Quick access');
    quick.append(this.renderTreeNode(record, librarySource(), 'Library', '#e0a360', 0, { icon:icon.library }));
    quick.append(this.renderTreeNode(record, recentsSource(), 'Recents', '#4b84bf', 0, { icon:icon.recents }));
    const cloud = section('Google Drives');
    const drive = driveFor(this); const accounts = drive.accounts();
    const root = googleDriveSource('root');
    cloud.append(this.renderTreeNode(record, root, accounts.length === 1 ? accounts[0].label : accounts.length ? 'Google Drives' : 'Google Drive', '#4285f4', 0, {
      icon:icon.drive,
      reconnect:accounts.length === 1 && !drive.isConnected(accounts[0].id),
      menu:(event) => menu(event, [{ label:'＋ Add Google Drive', action:() => this.addGoogleDrive() }])
    }));
    const mounts = section('Mounted folders');
    if (!this.state.mounts.size) mounts.append(el('div','nav-empty','No folders mounted'));
    for (const mount of this.state.mounts.values()) mounts.append(this.renderTreeNode(record, physicalSource(mount.id, []), mount.nickname || mount.name, mount.colour, 0, { icon:icon.folder, reconnect:mount.permission !== 'granted' }));
  };

  Workspace.prototype.loadWindow = async function loadWindow(record, ...args) {
    if (record.source.kind === 'google-drive') {
      record.loading = true; record.error = null; record.permissionRequired = false; this.renderWindow(record);
      try { record.items = await driveFor(this).listSource(record.source); }
      catch (error) { record.error = error?.message || 'Google Drive could not be opened.'; record.items = []; }
      finally { record.loading = false; this.renderWindow(record); this.renderSidebar(record); }
      return;
    }
    const value = await original.load.call(this, record, ...args);
    if (record.source.kind === 'physical') this.expandPhysicalTree(record, record.source).catch(console.error);
    else this.renderSidebar(record);
    return value;
  };
  Workspace.prototype.navigateWindow = async function navigateWindow(record, source, options = {}) {
    const value = await original.navigate.call(this, record, source, options);
    if (source.kind === 'physical') await this.expandPhysicalTree(record, source);
    this.renderSidebar(record);
    return value;
  };
  Workspace.prototype.renderBreadcrumbs = function renderBreadcrumbs(record) {
    if (record.source.kind !== 'google-drive') return original.breadcrumbs.call(this, record);
    const holder = record.element.querySelector('.breadcrumbs'); holder.replaceChildren();
    driveCrumbs(record.source).forEach((source, index, chain) => {
      const crumb = el('button','breadcrumb',sourceTitle(this.state,source)); crumb.type='button'; crumb.addEventListener('click',()=>this.openGoogleSource(record,source)); holder.append(crumb);
      if(index<chain.length-1)holder.append(el('span','breadcrumb-separator','/'));
    });
  };
  Workspace.prototype.openEntry = async function openEntry(record, entry) {
    if (record.source.kind === 'google-drive' && entry.cloudSource) return this.openGoogleSource(record, entry.cloudSource);
    return original.open.call(this, record, entry);
  };
  Workspace.prototype.renderFooter = function renderFooter(record) {
    original.footer.call(this, record);
    if (record.source.kind === 'google-drive') {
      const account = driveFor(this).account(record.source.accountId);
      record.element.querySelector('.window-status').textContent = account ? `${account.label} · ${driveFor(this).isConnected(account.id) ? 'read-only' : 'reconnect required'}` : 'Google Drive · read-only';
    }
  };
  Workspace.prototype.renderItem = function renderItem(record, entry, index, entries) {
    const node = original.item.call(this, record, entry, index, entries);
    if (record.source.kind === 'google-drive') { node.draggable = false; node.classList.add('cloud-file-item'); }
    return node;
  };
  Workspace.prototype.renderWindowShell = function renderWindowShell(record) {
    original.shell.call(this, record);
    record.element.querySelector('[data-action="up"]')?.addEventListener('click', () => {
      if (record.source.kind === 'google-drive' && record.source.parent) this.openGoogleSource(record, record.source.parent);
    });
  };
}
