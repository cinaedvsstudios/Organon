// Capsularius v0.27.0 — Location Health & File Columns
import { GoogleDriveService } from './google-drive.js';
import { installLocationHealth } from './location-health.js';
import { installFileColumns } from './file-columns.js';
import { persistence } from './persistence.js';
import { googleDriveSource, librarySource, physicalSource, recentsSource, sourceKey, sourceTitle } from './state.js';
import { readDirectory } from './filesystem.js';

const CAPSULARIUS_VERSION = 'v0.27.0 — Location Health & File Columns';

function setCapsulariusVersion() {
  const badge = document.querySelector('.app-badge');
  if (badge) badge.textContent = `Capsularius · ${CAPSULARIUS_VERSION}`;
}

function injectDriveStyles() {
  if (document.getElementById('capsularius-drive-account-styles')) return;
  const style = document.createElement('style');
  style.id = 'capsularius-drive-account-styles';
  style.textContent = `
    .drive-add-button{display:flex;align-items:center;gap:7px;width:100%;margin:6px 0 3px;padding:7px 9px;border:1px dashed rgba(82,139,231,.55);border-radius:7px;background:rgba(66,133,244,.08);color:#a8c8ff;font:inherit;font-size:.76rem;text-align:left;cursor:pointer}.drive-add-button:hover{background:rgba(66,133,244,.18);border-style:solid}.tree-access-state{margin-left:auto;padding:2px 5px;border:1px solid rgba(224,163,96,.42);border-radius:4px;background:rgba(224,163,96,.1);color:#e0a360;font-size:.57rem;line-height:1.1;cursor:pointer}.tree-access-state:hover{background:rgba(224,163,96,.2)}.drive-account-menu{position:fixed;z-index:10000;min-width:188px;padding:5px;border:1px solid rgba(224,163,96,.45);border-radius:8px;background:#231b1d;box-shadow:0 16px 40px rgba(0,0,0,.48)}.drive-account-menu button{display:block;width:100%;border:0;border-radius:5px;padding:8px 10px;background:transparent;color:#eee2d4;font:inherit;font-size:.8rem;text-align:left;cursor:pointer}.drive-account-menu button:hover{background:rgba(224,163,96,.18)}.drive-account-menu button.danger{color:#ffb4aa}.drive-account-dialog{z-index:10001}.drive-account-dialog .modal-card{max-width:420px}.drive-account-dialog label{display:grid;gap:7px;margin:17px 0}.drive-account-dialog input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid rgba(224,163,96,.45);border-radius:6px;background:#181716;color:#f6ecdf;font:inherit}
  `;
  document.head.append(style);
}

function makeElement(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function sameSource(first, second) { return sourceKey(first) === sourceKey(second); }
function compareName(first, second) { return first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' }); }

function driveFor(workspace) {
  if (!workspace.googleDrive) {
    workspace.googleDrive = new GoogleDriveService({ state: workspace.state, persistence });
    workspace.googleDrive.ready.then(() => {
      for (const record of workspace.state.windows.values()) workspace.renderSidebar(record);
    }).catch((error) => console.error(error));
  }
  return workspace.googleDrive;
}

function googleBreadcrumbs(source) {
  const chain = [];
  let current = source;
  while (current) { chain.unshift(current); current = current.parent || null; }
  if (!chain.length || chain[0].node !== 'root') chain.unshift(googleDriveSource('root'));
  return chain;
}

function openDriveDialog({ title, description, initialValue, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const backdrop = makeElement('div', 'modal-backdrop drive-account-dialog');
    const card = makeElement('section', 'modal-card');
    const eyebrow = makeElement('p', 'eyebrow', 'Google Drive');
    const heading = makeElement('h2', '', title);
    const copy = makeElement('p', 'modal-description', description);
    const label = makeElement('label');
    const labelText = makeElement('span', '', 'Display name');
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = 72; input.value = initialValue || ''; input.autocomplete = 'off';
    label.append(labelText, input);
    const actions = makeElement('div', 'modal-actions');
    const confirm = makeElement('button', `action-button ${danger ? '' : 'primary'}`, confirmLabel);
    confirm.type = 'button';
    const cancel = makeElement('button', 'action-button', 'Cancel'); cancel.type = 'button';
    const close = (value) => { backdrop.remove(); resolve(value); };
    confirm.addEventListener('click', () => close(input.value.trim()));
    cancel.addEventListener('click', () => close(null));
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') close(input.value.trim()); if (event.key === 'Escape') close(null); });
    actions.append(confirm, cancel);
    card.append(eyebrow, heading, copy, label, actions); backdrop.append(card); document.getElementById('dialog-layer').append(backdrop);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

function openDriveConfirm({ title, description, confirmLabel }) {
  return new Promise((resolve) => {
    const backdrop = makeElement('div', 'modal-backdrop drive-account-dialog');
    const card = makeElement('section', 'modal-card');
    const eyebrow = makeElement('p', 'eyebrow', 'Google Drive');
    const heading = makeElement('h2', '', title);
    const copy = makeElement('p', 'modal-description', description);
    const actions = makeElement('div', 'modal-actions');
    const confirm = makeElement('button', 'action-button', confirmLabel); confirm.type = 'button';
    const cancel = makeElement('button', 'action-button', 'Cancel'); cancel.type = 'button';
    const close = (value) => { backdrop.remove(); resolve(value); };
    confirm.addEventListener('click', () => close(true)); cancel.addEventListener('click', () => close(false));
    actions.append(confirm, cancel); card.append(eyebrow, heading, copy, actions); backdrop.append(card); document.getElementById('dialog-layer').append(backdrop); setTimeout(() => confirm.focus(), 0);
  });
}

function dismissDriveMenu() { document.querySelector('.drive-account-menu')?.remove(); }
function showDriveMenu(event, build) {
  event.preventDefault(); event.stopPropagation(); dismissDriveMenu();
  const menu = makeElement('div', 'drive-account-menu');
  const addAction = (label, handler, className = '') => {
    const button = makeElement('button', className, label);
    button.type = 'button';
    button.addEventListener('click', async () => { dismissDriveMenu(); await handler(); });
    menu.append(button);
  };
  build(addAction);
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 220)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 190)}px`;
  document.body.append(menu);
  setTimeout(() => document.addEventListener('pointerdown', (outside) => { if (!menu.contains(outside.target)) dismissDriveMenu(); }, { once: true }), 0);
}
function openDriveMenu(workspace, event, account, includeAdd = true) {
  showDriveMenu(event, (addAction) => {
    addAction('Rename Drive', () => workspace.renameGoogleDriveAccount(account.id));
    addAction('Reconnect', () => workspace.reconnectGoogleDriveAccount(account.id));
    if (includeAdd) addAction('＋ Add Google Drive', () => workspace.addGoogleDriveAccount());
    addAction('Remove from Capsularius', () => workspace.removeGoogleDriveAccount(account.id), 'danger');
  });
}
function openGoogleRootMenu(workspace, event) {
  const accounts = driveFor(workspace).accounts();
  if (accounts.length === 1) {
    openDriveMenu(workspace, event, accounts[0], true);
    return;
  }
  showDriveMenu(event, (addAction) => {
    addAction('＋ Add Google Drive', () => workspace.addGoogleDriveAccount());
  });
}

export function installFolderTree(Workspace) {
  setCapsulariusVersion(); injectDriveStyles();
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

  Workspace.prototype.persistMountVerification = function persistMountVerification() {
    const records = {};
    for (const mount of this.state.mounts.values()) records[mount.id] = { name: mount.nickname || mount.name, permission: mount.permission || 'prompt', verifiedAt: Date.now() };
    const fingerprint = JSON.stringify(Object.fromEntries(Object.entries(records).map(([id, record]) => [id, { name: record.name, permission: record.permission }])));
    if (this._mountVerificationFingerprint === fingerprint) return;
    this._mountVerificationFingerprint = fingerprint;
    persistence.saveMountVerification(records).catch((error) => console.error(error));
  };

  Workspace.prototype.getVirtualTreeChildren = function getVirtualTreeChildren(source) {
    if (source.kind === 'library') return this.buildLibraryEntries().map((entry) => ({ id: entry.id, name: entry.name, source: entry.source, colour: entry.colour, icon: entry.emoji || '▰', subtitle: entry.subtitle })).sort(compareName);
    if (source.kind === 'recents') return this.buildRecentEntries().map((entry) => ({ id: entry.id, name: entry.name, source: entry.source, colour: entry.colour, icon: '◷', subtitle: entry.subtitle }));
    return [];
  };

  Workspace.prototype.getGoogleTreeChildren = async function getGoogleTreeChildren(_record, source) { return driveFor(this).listTreeChildren(source); };
  Workspace.prototype.clearGoogleTreeCache = function clearGoogleTreeCache() { for (const record of this.state.windows.values()) for (const key of [...record.treeChildren.keys()]) if (key.startsWith('google-drive:')) record.treeChildren.delete(key); };
  Workspace.prototype.refreshGoogleDriveWindows = async function refreshGoogleDriveWindows() {
    this.clearGoogleTreeCache();
    const reloads = [];
    for (const record of this.state.windows.values()) { this.renderSidebar(record); if (record.source.kind === 'google-drive') reloads.push(this.loadWindow(record)); }
    await Promise.allSettled(reloads);
  };

  Workspace.prototype.addGoogleDriveAccount = async function addGoogleDriveAccount() {
    const drive = driveFor(this);
    try {
      const { account, alreadyKnown } = await drive.addAccount();
      if (!alreadyKnown) {
        const label = await openDriveDialog({ title: 'Name this Google Drive', description: 'This name appears only inside Capsularius. It does not rename the Google account or any Drive files.', initialValue: account.label, confirmLabel: 'Add Google Drive' });
        if (label) await drive.renameAccount(account.id, label);
      }
      await this.refreshGoogleDriveWindows();
      this.onStateChange();
      this.onToast(alreadyKnown ? `${account.label} reconnected.` : `${drive.account(account.id).label} added to Capsularius.`, 'success');
    } catch (error) { console.error(error); this.onToast(error?.message || 'Google Drive could not be added.', 'error'); }
  };

  Workspace.prototype.reconnectGoogleDriveAccount = async function reconnectGoogleDriveAccount(accountId) {
    const drive = driveFor(this);
    try {
      const account = await drive.reconnectAccount(accountId);
      await this.refreshGoogleDriveWindows();
      this.onToast(`${account.label} reconnected — all Google Drive windows refreshed.`, 'success');
    } catch (error) { console.error(error); this.onToast(error?.message || 'Google Drive could not reconnect.', 'error'); }
  };

  Workspace.prototype.renameGoogleDriveAccount = async function renameGoogleDriveAccount(accountId) {
    const drive = driveFor(this); const account = drive.account(accountId); if (!account) return;
    const label = await openDriveDialog({ title: 'Rename Google Drive', description: 'This changes only the label shown in Capsularius.', initialValue: account.label, confirmLabel: 'Save Name' });
    if (!label) return;
    try { const updated = await drive.renameAccount(accountId, label); for (const record of this.state.windows.values()) this.renderSidebar(record); this.onStateChange(); this.onToast(`Google Drive renamed to ${updated.label}.`, 'success'); }
    catch (error) { console.error(error); this.onToast('Google Drive could not be renamed.', 'error'); }
  };

  Workspace.prototype.removeGoogleDriveAccount = async function removeGoogleDriveAccount(accountId) {
    const drive = driveFor(this); const account = drive.account(accountId); if (!account) return;
    const confirmed = await openDriveConfirm({ title: 'Remove Google Drive?', description: `${account.label} will be removed only from Capsularius. It will not delete Google Drive files or disconnect the Google account elsewhere.`, confirmLabel: 'Remove Drive' });
    if (!confirmed) return;
    await drive.removeAccount(accountId);
    for (const record of this.state.windows.values()) {
      if (record.source.kind === 'google-drive' && record.source.accountId === accountId) await this.navigateWindow(record, librarySource());
      this.renderSidebar(record);
    }
    this.onStateChange(); this.onToast(`${account.label} removed from Capsularius.`, 'success');
  };

  Workspace.prototype.handleGoogleTreeOpen = async function handleGoogleTreeOpen(windowRecord, source) {
    const drive = driveFor(this);
    try {
      if (source.node === 'connect' && source.accountId) { await this.reconnectGoogleDriveAccount(source.accountId); await this.navigateWindow(windowRecord, googleDriveSource('my-drive', { accountId: source.accountId, folderId: 'root', parent: googleDriveSource('account', { accountId: source.accountId, parent: googleDriveSource('root') }) })); return; }
      if (source.node === 'connect' || (source.node === 'root' && drive.accounts().length === 0)) { await this.addGoogleDriveAccount(); return; }
      if (source.node === 'account' && !drive.isConnected(source.accountId)) { await this.reconnectGoogleDriveAccount(source.accountId); return; }
      if (source.node === 'account') { await this.navigateWindow(windowRecord, googleDriveSource('my-drive', { accountId: source.accountId, folderId: 'root', parent: source })); return; }
      if (source.node === 'root') { const first = drive.accounts()[0]; if (first) await this.navigateWindow(windowRecord, googleDriveSource('account', { accountId: first.id, parent: source })); return; }
      await this.navigateWindow(windowRecord, source);
    } catch (error) { console.error(error); this.onToast(error?.message || 'Google Drive could not be opened.', 'error'); }
  };

  Workspace.prototype.loadTreeChildren = async function loadTreeChildren(windowRecord, source) {
    const key = sourceKey(source);
    if ((source.kind === 'physical' || source.kind === 'google-drive') && windowRecord.treeChildren.has(key)) return windowRecord.treeChildren.get(key);
    if (windowRecord.treeLoading.has(key)) return [];
    if (source.kind === 'library' || source.kind === 'recents') return this.getVirtualTreeChildren(source);
    if (source.kind === 'google-drive') {
      windowRecord.treeLoading.add(key); this.renderSidebar(windowRecord);
      try { const children = await this.getGoogleTreeChildren(windowRecord, source); windowRecord.treeChildren.set(key, children); return children; }
      catch (error) { console.error(error); this.onToast(error?.message || 'Capsularius could not read Google Drive folders.', 'error'); windowRecord.treeChildren.set(key, []); return []; }
      finally { windowRecord.treeLoading.delete(key); this.renderSidebar(windowRecord); }
    }
    const mount = this.state.mounts.get(source.mountId);
    if (!mount || mount.permission !== 'granted') return [];
    windowRecord.treeLoading.add(key); this.renderSidebar(windowRecord);
    try {
      const { entries } = await readDirectory(mount.handle, source.pathSegments);
      const children = entries.filter((entry) => entry.kind === 'directory').sort(compareName).map((entry) => ({ id: sourceKey(physicalSource(source.mountId, [...source.pathSegments, entry.name])), name: entry.name, source: physicalSource(source.mountId, [...source.pathSegments, entry.name]), colour: mount.colour, icon: '▰' }));
      windowRecord.treeChildren.set(key, children); return children;
    } catch (error) { console.error(error); this.onToast('Capsularius could not read child folders for this tree entry.', 'error'); windowRecord.treeChildren.set(key, []); return []; }
    finally { windowRecord.treeLoading.delete(key); this.renderSidebar(windowRecord); }
  };

  Workspace.prototype.treeChildrenFor = function treeChildrenFor(windowRecord, source) { if (source.kind === 'library' || source.kind === 'recents') return this.getVirtualTreeChildren(source); return windowRecord.treeChildren.get(sourceKey(source)); };
  Workspace.prototype.toggleTreeNode = async function toggleTreeNode(windowRecord, source) { const key = sourceKey(source); if (windowRecord.treeExpanded.has(key)) { windowRecord.treeExpanded.delete(key); this.renderSidebar(windowRecord); this.onStateChange(); return; } windowRecord.treeExpanded.add(key); this.renderSidebar(windowRecord); await this.loadTreeChildren(windowRecord, source); this.onStateChange(); };
  Workspace.prototype.expandTreeToSource = async function expandTreeToSource(windowRecord, source) { if (source.kind !== 'physical') return; for (let depth = 0; depth < source.pathSegments.length; depth += 1) { const ancestor = physicalSource(source.mountId, source.pathSegments.slice(0, depth)); const key = sourceKey(ancestor); if (!windowRecord.treeExpanded.has(key)) windowRecord.treeExpanded.add(key); await this.loadTreeChildren(windowRecord, ancestor); } this.renderSidebar(windowRecord); };

  Workspace.prototype.renderSidebar = function renderTreeSidebar(windowRecord) {
    const sidebar = windowRecord.element?.querySelector('.window-sidebar'); if (!sidebar) return originalRenderSidebar.call(this, windowRecord); sidebar.replaceChildren(); this.persistMountVerification();
    const addSection = (label) => { const section = makeElement('div', 'nav-section'); section.append(makeElement('div', 'nav-heading', label)); sidebar.append(section); return section; };
    const quick = addSection('Quick access');
    quick.append(this.renderTreeNode(windowRecord, librarySource(), 'Library', '#e0a360', 0, { icon: '▣', virtual: true }));
    quick.append(this.renderTreeNode(windowRecord, recentsSource(), 'Recents', '#4b84bf', 0, { icon: '◷', virtual: true }));

    const cloud = addSection('Google Drives'); const drive = driveFor(this); const accounts = drive.accounts();
    const singleAccount = accounts.length === 1 ? accounts[0] : null;
    const rootLabel = singleAccount ? singleAccount.label : (accounts.length ? 'Google Drives' : 'Google Drive');
    cloud.append(this.renderTreeNode(windowRecord, googleDriveSource('root'), rootLabel, '#4285f4', 0, {
      icon: 'G', virtual: true, googleRoot: true,
      status: singleAccount && !drive.isConnected(singleAccount.id) ? 'Reconnect' : ''
    }));
    const addDrive = makeElement('button', 'drive-add-button', '＋ Add Google Drive'); addDrive.type = 'button'; addDrive.addEventListener('click', () => this.addGoogleDriveAccount()); cloud.append(addDrive);

    const mounted = addSection('Mounted folders');
    if (this.state.mounts.size === 0) mounted.append(makeElement('div', 'nav-empty', 'No folders mounted'));
    for (const mount of this.state.mounts.values()) mounted.append(this.renderTreeNode(windowRecord, physicalSource(mount.id, []), mount.nickname || mount.name, mount.colour, 0, { icon: '▰', status: mount.permission === 'granted' ? '' : 'Reconnect', mountId: mount.id }));
  };

  Workspace.prototype.renderTreeNode = function renderTreeNode(windowRecord, source, label, colour, depth, options = {}) {
    const key = sourceKey(source); const expanded = windowRecord.treeExpanded.has(key); const loading = windowRecord.treeLoading.has(key); const children = this.treeChildrenFor(windowRecord, source); const active = sameSource(windowRecord.source, source); const hasKnownEmptyChildren = Array.isArray(children) && children.length === 0;
    const accountForNode = options.googleAccount || (source.kind === 'google-drive' && source.node === 'account' ? driveFor(this).account(source.accountId) : null);
    const wrapper = makeElement('div', 'tree-node-wrap'); const row = makeElement('div', `tree-node${active ? ' active' : ''}${options.virtual ? ' virtual-root' : ''}`); row.style.setProperty('--tree-depth', String(depth));
    const expander = makeElement('button', `tree-expander${expanded ? ' expanded' : ''}${loading ? ' loading' : ''}`, loading ? '·' : expanded ? '▾' : '▸'); expander.type = 'button'; expander.title = expanded ? 'Collapse folder tree' : 'Expand child folders'; expander.setAttribute('aria-label', expander.title);
    if (options.noExpander || (hasKnownEmptyChildren && !loading)) { expander.classList.add('empty'); expander.textContent = ''; expander.disabled = true; }
    else expander.addEventListener('click', (event) => { event.stopPropagation(); this.toggleTreeNode(windowRecord, source); });
    const icon = makeElement('span', 'tree-folder-icon', options.icon || '▰'); icon.style.color = colour || 'var(--stone)';
    const button = makeElement('button', 'tree-label', label); button.type = 'button'; button.title = options.subtitle ? `${label} — ${options.subtitle}` : label;
    button.addEventListener('click', () => { if (source.kind === 'google-drive') this.handleGoogleTreeOpen(windowRecord, source); else this.navigateWindow(windowRecord, source); });
    row.append(expander, icon, button);
    if (options.status) {
      const status = makeElement('button', 'tree-access-state', options.status); status.type = 'button'; status.title = options.status === 'Reconnect' ? 'Reconnect this saved location' : options.status;
      status.addEventListener('click', (event) => {
        event.stopPropagation();
        if (options.mountId) this.onRequestPermission(options.mountId, windowRecord);
        else if (accountForNode) this.reconnectGoogleDriveAccount(accountForNode.id);
      });
      row.append(status);
    }
    if (accountForNode) {
      const openAccountContextMenu = (event) => openDriveMenu(this, event, accountForNode, true);
      wrapper.addEventListener('contextmenu', openAccountContextMenu);
      row.addEventListener('contextmenu', openAccountContextMenu);
      button.addEventListener('contextmenu', openAccountContextMenu);
    } else if (options.googleRoot || (source.kind === 'google-drive' && source.node === 'root')) {
      const openRootContextMenu = (event) => openGoogleRootMenu(this, event);
      wrapper.addEventListener('contextmenu', openRootContextMenu);
      row.addEventListener('contextmenu', openRootContextMenu);
      button.addEventListener('contextmenu', openRootContextMenu);
    }
    wrapper.append(row);
    if (expanded) { if (loading) { const pending = makeElement('div', 'tree-loading', 'Reading folders…'); pending.style.setProperty('--tree-depth', String(depth + 1)); wrapper.append(pending); } else if (children) for (const child of children) wrapper.append(this.renderTreeNode(windowRecord, child.source, child.name, child.colour || colour, depth + 1, { icon: child.icon || '▰', subtitle: child.subtitle })); }
    return wrapper;
  };

  Workspace.prototype.loadWindow = async function loadWindowWithTree(windowRecord) {
    if (windowRecord.source.kind === 'google-drive') {
      windowRecord.loading = true; windowRecord.error = null; windowRecord.permissionRequired = false; this.renderWindow(windowRecord);
      try { windowRecord.items = await driveFor(this).listSource(windowRecord.source); }
      catch (error) { windowRecord.error = error?.message || 'Google Drive could not be opened.'; windowRecord.items = []; }
      finally { windowRecord.loading = false; this.renderWindow(windowRecord); this.renderSidebar(windowRecord); }
      return;
    }
    const result = await originalLoadWindow.call(this, windowRecord); if (windowRecord.source.kind === 'physical') this.expandTreeToSource(windowRecord, windowRecord.source).catch((error) => console.error(error)); else this.renderSidebar(windowRecord); return result;
  };

  Workspace.prototype.navigateWindow = async function navigateWithTree(windowRecord, source, options = {}) { const result = await originalNavigateWindow.call(this, windowRecord, source, options); if (source.kind === 'physical') { await this.expandTreeToSource(windowRecord, source); this.onStateChange(); } else this.renderSidebar(windowRecord); return result; };

  Workspace.prototype.renderBreadcrumbs = function renderGoogleBreadcrumbs(windowRecord) {
    if (windowRecord.source.kind !== 'google-drive') return originalRenderBreadcrumbs.call(this, windowRecord);
    const container = windowRecord.element.querySelector('.breadcrumbs'); container.replaceChildren(); googleBreadcrumbs(windowRecord.source).forEach((source, index, chain) => { const crumb = makeElement('button', 'breadcrumb', sourceTitle(this.state, source)); crumb.type = 'button'; crumb.addEventListener('click', () => this.handleGoogleTreeOpen(windowRecord, source)); container.append(crumb); if (index < chain.length - 1) container.append(makeElement('span', 'breadcrumb-separator', '/')); });
  };

  Workspace.prototype.openEntry = async function openGoogleDriveEntry(windowRecord, entry) { if (windowRecord.source.kind === 'google-drive' && entry.cloudSource) { await this.handleGoogleTreeOpen(windowRecord, entry.cloudSource); return; } return originalOpenEntry.call(this, windowRecord, entry); };
  Workspace.prototype.renderFooter = function renderGoogleDriveFooter(windowRecord) { originalRenderFooter.call(this, windowRecord); if (windowRecord.source.kind === 'google-drive') { const drive = driveFor(this); const account = drive.account(windowRecord.source.accountId); windowRecord.element.querySelector('.window-status').textContent = account ? `${account.label} · ${drive.isConnected(account.id) ? 'read-only' : 'reconnect required'}` : 'Google Drive · read-only'; } };
  Workspace.prototype.renderItem = function renderGoogleDriveItem(windowRecord, entry, index, visibleEntries) { const node = originalRenderItem.call(this, windowRecord, entry, index, visibleEntries); if (windowRecord.source.kind === 'google-drive') { node.draggable = false; node.classList.add('cloud-file-item'); } return node; };
  Workspace.prototype.renderWindowShell = function renderGoogleDriveWindowShell(windowRecord) { originalRenderWindowShell.call(this, windowRecord); const up = windowRecord.element.querySelector('[data-action="up"]'); up.addEventListener('click', () => { if (windowRecord.source.kind === 'google-drive' && windowRecord.source.parent) this.handleGoogleTreeOpen(windowRecord, windowRecord.source.parent); }); };

  installLocationHealth(Workspace);
  installFileColumns(Workspace);
}
