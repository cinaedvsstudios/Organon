import { googleDriveSource, sourceTitle } from './state.js';

function breadcrumbChain(source) {
  const chain = [];
  let current = source;
  while (current) {
    chain.unshift(current);
    current = current.parent || null;
  }
  if (!chain.length || chain[0].node !== 'root') chain.unshift(googleDriveSource('root'));
  return chain;
}

export function installGoogleDriveUi(Workspace, drive, notify) {
  if (Workspace.prototype.__googleDriveUi) return;
  Object.defineProperty(Workspace.prototype, '__googleDriveUi', { value: true });

  const loadWindow = Workspace.prototype.loadWindow;
  const renderBreadcrumbs = Workspace.prototype.renderBreadcrumbs;
  const openEntry = Workspace.prototype.openEntry;
  const renderFooter = Workspace.prototype.renderFooter;
  const renderItem = Workspace.prototype.renderItem;

  Workspace.prototype.getGoogleTreeChildren = async function getGoogleTreeChildren(_record, source) {
    return drive.listTreeChildren(source);
  };

  Workspace.prototype.openGoogleDriveSource = async function openGoogleDriveSource(record, source) {
    try {
      if (source.node === 'connect' || (source.node === 'root' && !drive.isConnected())) {
        await drive.connect();
        for (const item of this.state.windows.values()) {
          for (const key of [...item.treeChildren.keys()]) {
            if (key.startsWith('google-drive:')) item.treeChildren.delete(key);
          }
        }
        this.refreshSpecialWindows();
        await this.navigateWindow(record, googleDriveSource('my-drive', { folderId: 'root', parent: googleDriveSource('root') }));
        notify('Google Drive connected for this session.', 'success');
        return;
      }
      if (source.node === 'root') {
        await this.navigateWindow(record, googleDriveSource('my-drive', { folderId: 'root', parent: googleDriveSource('root') }));
        return;
      }
      await this.navigateWindow(record, source);
    } catch (error) {
      console.error(error);
      notify(error?.message || 'Google Drive could not be opened.', 'error');
    }
  };

  Workspace.prototype.handleGoogleTreeOpen = function handleGoogleTreeOpen(record, source) {
    return this.openGoogleDriveSource(record, source);
  };

  Workspace.prototype.loadWindow = async function loadGoogleDriveWindow(record) {
    if (record.source.kind !== 'google-drive') return loadWindow.call(this, record);
    record.loading = true;
    record.error = null;
    record.permissionRequired = false;
    this.renderWindow(record);
    try {
      record.items = await drive.listSource(record.source);
    } catch (error) {
      record.error = error?.message || 'Google Drive could not be opened.';
      record.items = [];
    } finally {
      record.loading = false;
      this.renderWindow(record);
      this.renderSidebar(record);
    }
  };

  Workspace.prototype.renderBreadcrumbs = function renderGoogleDriveBreadcrumbs(record) {
    if (record.source.kind !== 'google-drive') return renderBreadcrumbs.call(this, record);
    const container = record.element.querySelector('.breadcrumbs');
    container.replaceChildren();
    breadcrumbChain(record.source).forEach((source, index, chain) => {
      const crumb = document.createElement('button');
      crumb.type = 'button';
      crumb.className = 'breadcrumb';
      crumb.textContent = sourceTitle(this.state, source);
      crumb.addEventListener('click', () => this.openGoogleDriveSource(record, source));
      container.append(crumb);
      if (index < chain.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '/';
        container.append(separator);
      }
    });
  };

  Workspace.prototype.openEntry = async function openGoogleDriveEntry(record, entry) {
    if (record.source.kind === 'google-drive' && entry.cloudSource) {
      return this.openGoogleDriveSource(record, entry.cloudSource);
    }
    return openEntry.call(this, record, entry);
  };

  Workspace.prototype.renderFooter = function renderGoogleDriveFooter(record) {
    renderFooter.call(this, record);
    if (record.source.kind === 'google-drive') {
      record.element.querySelector('.window-status').textContent = drive.isConnected() ? 'Google Drive · read-only' : 'Google Drive · not connected';
    }
  };

  Workspace.prototype.renderItem = function renderGoogleDriveItem(record, entry, index, entries) {
    const node = renderItem.call(this, record, entry, index, entries);
    if (record.source.kind === 'google-drive') {
      node.draggable = false;
      node.classList.add('cloud-file-item');
    }
    return node;
  };
}
