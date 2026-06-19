import { extensionOf } from './filesystem.js';
import { physicalSource, zipSource } from './state.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isZipFile(entry) {
  return entry?.kind === 'file' && extensionOf(entry.name) === 'zip';
}

function archiveCrumbs(source) {
  const path = String(source.zipPath || '').replace(/\/$/, '');
  return path ? path.split('/').filter(Boolean) : [];
}

function addMenuItem(menu, label, command, disabled = false, position = 'append') {
  const button = el('button','context-item',label);
  button.type = 'button';
  button.dataset.command = command;
  button.disabled = disabled;
  if (position === 'start') menu.prepend(button);
  else menu.append(button);
  return button;
}

export function installArchiveWorkspace(Workspace) {
  if (Workspace.prototype.__capsulariusArchiveInstalled) return;
  Object.defineProperty(Workspace.prototype,'__capsulariusArchiveInstalled',{ value:true });
  const base = {
    load:Workspace.prototype.loadWindow,
    open:Workspace.prototype.openEntry,
    breadcrumbs:Workspace.prototype.renderBreadcrumbs,
    footer:Workspace.prototype.renderFooter,
    render:Workspace.prototype.renderWindow,
    shell:Workspace.prototype.renderWindowShell,
    context:Workspace.prototype.showContextMenu,
    selectAll:Workspace.prototype.selectAll,
    drop:Workspace.prototype.dropOnWindow
  };

  Workspace.prototype.loadWindow = async function loadWindow(record, ...args) {
    if (record.source.kind !== 'zip') return base.load.call(this,record,...args);
    record.loading = true;
    record.error = null;
    record.permissionRequired = false;
    this.renderWindow(record);
    try {
      if (!this.archiveService) throw new Error('ZIP archive support is not ready.');
      record.items = await this.archiveService.listSource(record.source);
    } catch (error) {
      record.error = error?.message || 'This ZIP archive could not be opened.';
      record.items = [];
    } finally {
      record.loading = false;
      this.renderWindow(record);
    }
  };

  Workspace.prototype.openEntry = async function openEntry(record, entry) {
    if (record.source.kind === 'physical' && isZipFile(entry)) return this.navigateWindow(record,zipSource(record.source.mountId,record.source.pathSegments,entry.name));
    if (record.source.kind === 'zip' && entry.kind === 'directory') return this.navigateWindow(record,this.archiveService.childSource(record.source,entry));
    return base.open.call(this,record,entry);
  };

  Workspace.prototype.renderBreadcrumbs = function renderBreadcrumbs(record) {
    if (record.source.kind !== 'zip') return base.breadcrumbs.call(this,record);
    const source = record.source;
    const container = record.element.querySelector('.breadcrumbs');
    container.replaceChildren();
    const mount = this.state.mounts.get(source.mountId);
    if (!mount) { container.append(el('span','','Missing mounted location')); return; }
    const addSeparator = () => container.append(el('span','breadcrumb-separator','/'));
    const addPhysical = (label,segments) => { const button=el('button','breadcrumb',label);button.type='button';button.addEventListener('click',()=>this.navigateWindow(record,physicalSource(source.mountId,segments)));container.append(button); };
    const addZip = (label,zipPath) => { const button=el('button','breadcrumb',label);button.type='button';button.addEventListener('click',()=>this.navigateWindow(record,zipSource(source.mountId,source.parentPathSegments,source.archiveName,zipPath)));container.append(button); };
    addPhysical(mount.nickname || mount.name,[]);
    source.parentPathSegments.forEach((segment,index)=>{ addSeparator(); addPhysical(segment,source.parentPathSegments.slice(0,index+1)); });
    addSeparator();addZip(source.archiveName,'');
    const pieces=archiveCrumbs(source);
    pieces.forEach((piece,index)=>{ addSeparator(); addZip(piece,`${pieces.slice(0,index+1).join('/')}/`); });
  };

  Workspace.prototype.renderFooter = function renderFooter(record) {
    base.footer.call(this,record);
    if (record.source.kind === 'zip') record.element.querySelector('.window-status').textContent = 'ZIP archive · read-only';
  };

  Workspace.prototype.renderWindow = function renderWindow(record) {
    base.render.call(this,record);
    if (record.source.kind !== 'zip') return;
    const up = record.element.querySelector('[data-action="up"]');
    if (up) up.disabled = false;
  };

  Workspace.prototype.renderWindowShell = function renderWindowShell(record) {
    base.shell.call(this,record);
    const up = record.element.querySelector('[data-action="up"]');
    if (!up || up.dataset.archiveUpBound) return;
    up.dataset.archiveUpBound = 'true';
    up.addEventListener('click',()=>{ if (record.source.kind === 'zip') this.navigateWindow(record,this.archiveService.parentSource(record.source)); });
  };

  Workspace.prototype.selectAll = function selectAll(record) {
    if (record?.source?.kind === 'zip') {
      record.selectedIds = new Set(record.items.map((entry)=>entry.id));
      record.lastSelectedIndex = record.items.length - 1;
      this.renderWindow(record);
      return;
    }
    return base.selectAll.call(this,record);
  };

  Workspace.prototype.dropOnWindow = function dropOnWindow(event,targetWindow) {
    if (targetWindow.source.kind !== 'physical') return base.drop.call(this,event,targetWindow);
    const raw = event.dataTransfer.getData('application/x-capsularius-source');
    if (!raw) return base.drop.call(this,event,targetWindow);
    try {
      const payload = JSON.parse(raw);
      const sourceWindow = this.state.windows.get(Number(payload.windowId));
      if (sourceWindow?.source?.kind === 'zip') {
        event.preventDefault();
        targetWindow.element.classList.remove('drag-target');
        this.onCommand('transfer',{ sourceWindow,targetWindow,entries:this.getSelectedEntries(sourceWindow),mode:'copy' });
        return;
      }
    } catch (_) { /* fall through to base drop handling */ }
    return base.drop.call(this,event,targetWindow);
  };

  Workspace.prototype.showContextMenu = function showContextMenu(event, record, entry) {
    base.context.call(this,event,record,entry);
    const menu = this.contextMenu;
    if (record.source.kind === 'physical' && entry && this.getSelectedEntries(record).length && !menu.querySelector('[data-command="create-zip"]')) addMenuItem(menu,'🗜️ Create ZIP','create-zip',false,'start');
    if (record.source.kind === 'zip' && entry) {
      const selected = this.getSelectedEntries(record);
      const copy = menu.querySelector('[data-command="copy"]');
      if (copy) { copy.disabled = selected.length === 0; copy.textContent = '📂 Copy selected to folder'; }
      ['cut','rename','delete','add-to-library'].forEach((command)=>{
        const item = menu.querySelector(`[data-command="${command}"]`);
        if (item) item.hidden = true;
      });
    }
  };
}
