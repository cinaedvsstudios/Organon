import { hydrateFileEntry } from './filesystem.js';
import { Workspace } from './workspace.js';

const VERSION = 'v0.32.0 — Background Loading';
const BATCH_SIZE = 8;

function idle(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 350 });
  } else {
    window.setTimeout(() => callback({ timeRemaining: () => 8, didTimeout: false }), 24);
  }
}

function installSameTextGuard() {
  if (window.__capsulariusSameTextGuard) return;
  window.__capsulariusSameTextGuard = true;

  let prototype = Node.prototype;
  let descriptor = null;
  while (prototype && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(prototype, 'textContent') || null;
    prototype = Object.getPrototypeOf(prototype);
  }
  if (!descriptor?.get || !descriptor?.set) return;

  Object.defineProperty(Node.prototype, 'textContent', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() { return descriptor.get.call(this); },
    set(value) {
      const next = value == null ? '' : String(value);
      if (descriptor.get.call(this) === next) return;
      descriptor.set.call(this, next);
    }
  });
}

function scheduleHydration(workspace, windowRecord, token) {
  const pending = windowRecord.items.filter((entry) => entry?.kind === 'file' && entry.metadataPending);
  if (!pending.length) return;

  let cursor = 0;
  const process = async () => {
    if (windowRecord.__capsulariusBackgroundToken !== token || !windowRecord.element?.isConnected) return;
    const batch = pending.slice(cursor, cursor + BATCH_SIZE);
    cursor += batch.length;
    await Promise.allSettled(batch.map((entry) => hydrateFileEntry(entry)));

    if (windowRecord.__capsulariusBackgroundToken !== token || !windowRecord.element?.isConnected) return;
    // One redraw per small batch means the folder remains responsive while
    // size/date/type values arrive after the names have already painted.
    workspace.renderWindow(windowRecord);

    if (cursor < pending.length) idle(process);
  };
  idle(process);
}

function installBackgroundWindowLoading() {
  if (Workspace.prototype.__capsulariusBackgroundLoadingInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusBackgroundLoadingInstalled', { value: true });

  const originalLoadWindow = Workspace.prototype.loadWindow;
  Workspace.prototype.loadWindow = async function backgroundLoadWindow(windowRecord, ...args) {
    const token = (windowRecord.__capsulariusBackgroundToken || 0) + 1;
    windowRecord.__capsulariusBackgroundToken = token;

    const result = await originalLoadWindow.call(this, windowRecord, ...args);
    if (windowRecord.source?.kind === 'physical' && !windowRecord.loading && !windowRecord.error && !windowRecord.permissionRequired) {
      scheduleHydration(this, windowRecord, token);
    }
    return result;
  };
}

function updateVersion() {
  const badge = document.querySelector('.app-badge');
  if (badge && badge.textContent !== VERSION) badge.textContent = VERSION;
}

installSameTextGuard();
installBackgroundWindowLoading();
window.setTimeout(updateVersion, 0);
