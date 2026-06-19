import { queryDirectoryPermission, readDirectory, requestDirectoryPermission } from './filesystem.js';
import { fullHddPath, locationForMount, normaliseHddPath, saveLocationForMount } from './location-store.js';

const HEALTH_LABELS = {
  connected: 'Connected',
  'path-required': 'Path needed',
  'permission-required': 'Reconnect',
  unavailable: 'Unavailable',
  'not-checked': 'Not checked'
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function injectStyles() {
  if (document.getElementById('capsularius-location-health-styles')) return;
  const style = document.createElement('style');
  style.id = 'capsularius-location-health-styles';
  style.textContent = `
    .header-button.capsularius-settings-button { white-space: nowrap; }
    .tree-node.mount-unavailable { opacity: .42; filter: grayscale(.7); }
    .tree-node.mount-path-required { opacity: .76; }
    .tree-access-state.mount-health { margin-left: auto; font-size: 9px; letter-spacing: .03em; max-width: 74px; overflow: hidden; text-overflow: ellipsis; }
    .caps-location-backdrop { position: fixed; inset: 0; z-index: 10080; display: grid; place-items: center; padding: 24px; background: rgba(10, 8, 7, .72); backdrop-filter: blur(4px); }
    .caps-location-dialog { width: min(790px, calc(100vw - 32px)); max-height: min(760px, calc(100vh - 32px)); overflow: auto; color: #efe6d5; background: #211717; border: 1px solid #9e7847; border-radius: 13px; box-shadow: 0 24px 90px rgba(0,0,0,.62); }
    .caps-location-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:22px 24px 16px; border-bottom:1px solid rgba(231,204,158,.2); }
    .caps-location-header h2 { margin:4px 0 0; font-size:20px; }
    .caps-location-eyebrow { color:#d9a65d; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.12em; }
    .caps-location-close { border:0; background:transparent; color:#e6d8c2; font-size:26px; cursor:pointer; }
    .caps-location-summary { margin:0; padding:14px 24px; color:#c8bba9; font-size:13px; }
    .caps-location-list { display:grid; gap:10px; padding:0 24px 20px; }
    .caps-location-row { display:grid; grid-template-columns: 12px minmax(0,1fr) auto; gap:12px; align-items:center; padding:14px; border:1px solid rgba(226,191,137,.22); border-radius:9px; background:rgba(255,255,255,.025); }
    .caps-location-dot { width:9px; height:9px; border-radius:50%; background:#8f7654; }
    .caps-location-row[data-health="connected"] .caps-location-dot { background:#5eb785; }
    .caps-location-row[data-health="path-required"] .caps-location-dot { background:#e0a360; }
    .caps-location-row[data-health="permission-required"] .caps-location-dot { background:#d27d6c; }
    .caps-location-row[data-health="unavailable"] .caps-location-dot { background:#9a2f4f; }
    .caps-location-name { font-weight:700; }
    .caps-location-path { margin-top:4px; color:#b9ab9a; font-family: var(--mono-font, monospace); font-size:11px; word-break:break-all; }
    .caps-location-state { margin-top:5px; color:#d7c8b7; font-size:12px; }
    .caps-location-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:7px; }
    .caps-location-actions button, .caps-location-footer button { border:1px solid #8f6d43; border-radius:6px; background:#32221e; color:#f1dfc1; padding:7px 10px; cursor:pointer; font:inherit; font-size:12px; }
    .caps-location-actions button.primary, .caps-location-footer button.primary { background:#a86f2c; color:#22160b; font-weight:800; }
    .caps-location-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px 24px 22px; border-top:1px solid rgba(231,204,158,.18); }
    .caps-location-footer span { color:#b9ab9a; font-size:12px; }
    .caps-mount-menu { position:fixed; z-index:10090; min-width:190px; padding:5px; background:#211717; border:1px solid #9e7847; border-radius:8px; box-shadow:0 14px 40px rgba(0,0,0,.55); }
    .caps-mount-menu button { display:block; width:100%; border:0; background:transparent; color:#f3e5ce; text-align:left; padding:8px 10px; border-radius:5px; cursor:pointer; font:inherit; font-size:12px; }
    .caps-mount-menu button:hover { background:rgba(216,164,94,.18); }
  `;
  document.head.append(style);
}

function setHealth(mount, status, detail = '') {
  const current = locationForMount(mount.id);
  const hddPath = normaliseHddPath(mount.hddPath || current.hddPath || '');
  mount.hddPath = hddPath;
  mount.locationHealth = status;
  mount.locationDetail = detail;
  mount.lastLocationScanAt = Date.now();
  saveLocationForMount(mount.id, {
    hddPath,
    status,
    detail,
    lastChecked: mount.lastLocationScanAt
  });
  return status;
}

async function verifyMount(mount) {
  const existing = locationForMount(mount.id);
  mount.hddPath = normaliseHddPath(mount.hddPath || existing.hddPath || '');
  try {
    mount.permission = await queryDirectoryPermission(mount.handle);
  } catch (error) {
    return setHealth(mount, 'unavailable', error?.message || 'The saved browser folder handle is unavailable.');
  }
  if (mount.permission !== 'granted') {
    return setHealth(mount, 'permission-required', 'Capsularius needs browser permission to reopen this saved folder.');
  }
  try {
    await readDirectory(mount.handle, []);
  } catch (error) {
    return setHealth(mount, 'unavailable', error?.message || 'The folder can no longer be read. It may have been moved, disconnected, or removed.');
  }
  if (!mount.hddPath) return setHealth(mount, 'path-required', 'Add the full Windows path to enable Copy Full HDD Path.');
  return setHealth(mount, 'connected', 'Folder handle and recorded HDD path are both available.');
}

function promptForPath(mount) {
  const current = normaliseHddPath(mount.hddPath || locationForMount(mount.id).hddPath || '');
  const value = window.prompt(
    `Full Windows location for “${mount.nickname || mount.name}”\n\nExample: D:\\Forever Bound\\Assets or E:\\`,
    current
  );
  if (value === null) return false;
  mount.hddPath = normaliseHddPath(value);
  setHealth(mount, mount.hddPath ? 'not-checked' : 'path-required', mount.hddPath ? 'Path updated. Run the scan to verify this mounted folder.' : 'No HDD path recorded.');
  return true;
}

function redraw(workspace) {
  for (const record of workspace.state.windows.values()) workspace.renderWindow(record);
}

function closeMenu() {
  document.querySelector('.caps-mount-menu')?.remove();
}

function openMountMenu(workspace, event, mount) {
  event.preventDefault();
  event.stopPropagation();
  closeMenu();
  const menu = element('div', 'caps-mount-menu');
  const action = (label, handler) => {
    const button = element('button', '', label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      closeMenu();
      await handler();
    });
    menu.append(button);
  };
  action('Edit Full HDD Path', async () => {
    if (promptForPath(mount)) {
      redraw(workspace);
      workspace.onStateChange();
      workspace.onToast('Recorded HDD path updated.', 'success');
    }
  });
  action('Scan This Location', async () => {
    await verifyMount(mount);
    redraw(workspace);
    workspace.onStateChange();
    workspace.onToast(`${mount.nickname || mount.name}: ${HEALTH_LABELS[mount.locationHealth]}.`);
  });
  const x = Math.min(event.clientX, window.innerWidth - 220);
  const y = Math.min(event.clientY, window.innerHeight - 100);
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
  document.body.append(menu);
  window.setTimeout(() => document.addEventListener('pointerdown', closeMenu, { once: true }), 0);
}

function showLocationDialog(workspace) {
  document.querySelector('.caps-location-backdrop')?.remove();
  const backdrop = element('div', 'caps-location-backdrop');
  const dialog = element('section', 'caps-location-dialog');
  const header = element('header', 'caps-location-header');
  const heading = element('div');
  heading.append(element('div', 'caps-location-eyebrow', 'Capsularius settings'), element('h2', '', 'Mounted location health'));
  const close = element('button', 'caps-location-close', '×');
  close.type = 'button';
  close.addEventListener('click', () => backdrop.remove());
  header.append(heading, close);
  const summary = element('p', 'caps-location-summary', 'Scan Mounted Locations checks every saved browser folder handle, records whether it can still be opened, and highlights any missing HDD path used for Copy Full HDD Path.');
  const list = element('div', 'caps-location-list');
  const footer = element('footer', 'caps-location-footer');
  const scan = element('button', 'primary', 'Scan Mounted Locations');
  scan.type = 'button';
  const note = element('span', '', 'Unavailable locations stay visible in the folder tree, greyed out.');
  footer.append(note, scan);
  dialog.append(header, summary, list, footer);
  backdrop.append(dialog);
  document.body.append(backdrop);

  const render = () => {
    list.replaceChildren();
    const mounts = [...workspace.state.mounts.values()];
    if (!mounts.length) {
      list.append(element('div', 'caps-location-row', 'No local folders are mounted yet.'));
      return;
    }
    for (const mount of mounts) {
      const record = locationForMount(mount.id);
      mount.hddPath = normaliseHddPath(mount.hddPath || record.hddPath || '');
      const health = mount.locationHealth || record.status || (mount.hddPath ? 'not-checked' : 'path-required');
      const row = element('article', 'caps-location-row');
      row.dataset.health = health;
      const dot = element('span', 'caps-location-dot');
      const info = element('div', 'caps-location-info');
      info.append(element('div', 'caps-location-name', mount.nickname || mount.name));
      info.append(element('div', 'caps-location-path', mount.hddPath || 'No full Windows path has been recorded yet.'));
      info.append(element('div', 'caps-location-state', `${HEALTH_LABELS[health] || 'Not checked'}${mount.locationDetail ? ` — ${mount.locationDetail}` : ''}`));
      const actions = element('div', 'caps-location-actions');
      const edit = element('button', '', mount.hddPath ? 'Edit path' : 'Add path');
      edit.type = 'button';
      edit.addEventListener('click', () => { if (promptForPath(mount)) render(); });
      actions.append(edit);
      if (health === 'permission-required') {
        const reconnect = element('button', 'primary', 'Reconnect');
        reconnect.type = 'button';
        reconnect.addEventListener('click', async () => {
          try { mount.permission = await requestDirectoryPermission(mount.handle); } catch (_) { mount.permission = 'denied'; }
          await verifyMount(mount);
          redraw(workspace);
          render();
        });
        actions.append(reconnect);
      }
      if (health === 'unavailable') {
        const replacement = element('button', 'primary', 'Choose replacement');
        replacement.type = 'button';
        replacement.addEventListener('click', () => workspace.onToast('Choose replacement folder will be added with the folder-relink pass. Use Mount Folder now, then edit the recorded HDD path here.', 'info'));
        actions.append(replacement);
      }
      row.append(dot, info, actions);
      list.append(row);
    }
  };

  scan.addEventListener('click', async () => {
    scan.disabled = true;
    scan.textContent = 'Scanning…';
    for (const mount of workspace.state.mounts.values()) await verifyMount(mount);
    redraw(workspace);
    workspace.onStateChange();
    scan.disabled = false;
    scan.textContent = 'Scan Mounted Locations';
    render();
  });
  render();
}

export function installLocationHealth(Workspace) {
  if (Workspace.prototype.__capsulariusLocationHealthInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusLocationHealthInstalled', { value: true });
  injectStyles();
  const originalRenderTreeNode = Workspace.prototype.renderTreeNode;

  Workspace.prototype.scanMountedLocations = async function scanMountedLocations() {
    for (const mount of this.state.mounts.values()) await verifyMount(mount);
    redraw(this);
    this.onStateChange();
  };

  Workspace.prototype.renderTreeNode = function renderLocationHealthTreeNode(windowRecord, source, label, colour, depth, options = {}) {
    const wrapper = originalRenderTreeNode.call(this, windowRecord, source, label, colour, depth, options);
    if (source.kind !== 'physical' || source.pathSegments.length !== 0) return wrapper;
    const mount = this.state.mounts.get(source.mountId);
    if (!mount) return wrapper;
    const stored = locationForMount(mount.id);
    mount.hddPath = normaliseHddPath(mount.hddPath || stored.hddPath || '');
    const health = mount.locationHealth || stored.status || (mount.hddPath ? 'not-checked' : 'path-required');
    const row = wrapper.querySelector('.tree-node');
    row?.classList.add(`mount-${health}`);
    if (health === 'unavailable' || health === 'permission-required' || health === 'path-required') {
      const chip = element('button', 'tree-access-state mount-health', HEALTH_LABELS[health]);
      chip.type = 'button';
      chip.title = health === 'path-required' ? 'Add the full HDD path in Settings.' : 'Open Mounted Location Health.';
      chip.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); showLocationDialog(this); });
      row?.append(chip);
    }
    wrapper.addEventListener('contextmenu', (event) => openMountMenu(this, event, mount));
    return wrapper;
  };

  function ensureSettingsButton(workspace) {
    if (document.getElementById('capsularius-settings-button')) return;
    const target = document.querySelector('.header-actions');
    if (!target) return;
    const button = element('button', 'header-button capsularius-settings-button', '⚙ Settings');
    button.id = 'capsularius-settings-button';
    button.type = 'button';
    button.title = 'Mounted locations and folder health';
    button.addEventListener('click', () => showLocationDialog(workspace));
    target.append(button);
  }

  const locationHealthRenderTreeNode = Workspace.prototype.renderTreeNode;
  Workspace.prototype.renderTreeNode = function renderLocationHealthTreeNode(windowRecord, source, label, colour, depth, options = {}) {
    ensureSettingsButton(this);
    return locationHealthRenderTreeNode.call(this, windowRecord, source, label, colour, depth, options);
  };
}

export { fullHddPath };
