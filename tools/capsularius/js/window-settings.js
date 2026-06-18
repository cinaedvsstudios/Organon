import { sourceKey } from './state.js';

function normaliseOption(option = {}) {
  return {
    viewMode: option.viewMode === 'list' ? 'list' : 'grid',
    sortBy: ['name', 'type', 'size', 'modified'].includes(option.sortBy) ? option.sortBy : 'name',
    sortDirection: option.sortDirection === 'desc' ? 'desc' : 'asc'
  };
}

function compareValues(first, second, direction) {
  const multiplier = direction === 'desc' ? -1 : 1;
  if (typeof first === 'string') return first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
  return (first - second) * multiplier;
}

function entryType(entry) {
  if (entry.kind === 'directory') return 'Folder';
  if (entry.kind === 'shortcut') return 'Location';
  return entry.fileType || 'File';
}

function sortEntries(entries, settings) {
  return [...entries].sort((first, second) => {
    if (first.kind !== second.kind) {
      if (first.kind === 'directory') return -1;
      if (second.kind === 'directory') return 1;
    }
    if (settings.sortBy === 'type') return compareValues(entryType(first), entryType(second), settings.sortDirection) || compareValues(first.name, second.name, 'asc');
    if (settings.sortBy === 'size') return compareValues(first.size || 0, second.size || 0, settings.sortDirection) || compareValues(first.name, second.name, 'asc');
    if (settings.sortBy === 'modified') return compareValues(first.lastModified || 0, second.lastModified || 0, settings.sortDirection) || compareValues(first.name, second.name, 'asc');
    return compareValues(first.name, second.name, settings.sortDirection);
  });
}

export function installWindowSettings(Workspace, openSettingsDialog) {
  if (Workspace.prototype.__capsulariusWindowSettingsInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusWindowSettingsInstalled', { value: true });

  const originalRenderWindowShell = Workspace.prototype.renderWindowShell;
  const originalRenderWindow = Workspace.prototype.renderWindow;
  const originalRenderContent = Workspace.prototype.renderContent;

  Workspace.prototype.getWindowSettings = function getWindowSettings(windowRecord) {
    const settings = windowRecord.settings || { scope: 'window', window: {}, folders: {} };
    const fallback = normaliseOption(settings.window);
    if (settings.scope === 'window') return fallback;
    return normaliseOption(settings.folders?.[sourceKey(windowRecord.source)] || fallback);
  };

  Workspace.prototype.applyWindowSettings = function applyWindowSettings(windowRecord, values, applyToWindow) {
    const settings = windowRecord.settings || { scope: 'window', window: {}, folders: {} };
    const option = normaliseOption(values);
    settings.window = normaliseOption(settings.window);
    settings.folders = settings.folders && typeof settings.folders === 'object' ? settings.folders : {};
    if (applyToWindow) {
      settings.scope = 'window';
      settings.window = option;
    } else {
      settings.scope = 'folder';
      settings.folders[sourceKey(windowRecord.source)] = option;
    }
    windowRecord.settings = settings;
    windowRecord.viewMode = this.getWindowSettings(windowRecord).viewMode;
    this.renderWindow(windowRecord);
    this.onStateChange();
  };

  Workspace.prototype.renderWindowShell = function renderWindowShellWithSettings(windowRecord) {
    originalRenderWindowShell.call(this, windowRecord);
    const actions = windowRecord.element.querySelector('.window-actions');
    const minimise = actions.querySelector('.minimise-window');
    const settingsButton = this.button('⚙', 'icon-button settings-window', 'Window settings');
    settingsButton.dataset.action = 'settings';
    if (minimise) minimise.before(settingsButton);
    else actions.prepend(settingsButton);
    settingsButton.addEventListener('click', () => openSettingsDialog(windowRecord, this));
  };

  Workspace.prototype.renderWindow = function renderWindowWithSettings(windowRecord) {
    const effective = this.getWindowSettings(windowRecord);
    windowRecord.viewMode = effective.viewMode;
    windowRecord.sortBy = effective.sortBy;
    windowRecord.sortDirection = effective.sortDirection;
    return originalRenderWindow.call(this, windowRecord);
  };

  Workspace.prototype.renderContent = function renderContentWithSettings(windowRecord) {
    const originalItems = windowRecord.items;
    windowRecord.items = sortEntries(originalItems, this.getWindowSettings(windowRecord));
    try {
      return originalRenderContent.call(this, windowRecord);
    } finally {
      windowRecord.items = originalItems;
    }
  };

  Workspace.prototype.setViewMode = function setViewModeFromToolbar(windowRecord, mode) {
    const current = this.getWindowSettings(windowRecord);
    this.applyWindowSettings(windowRecord, { ...current, viewMode: mode }, windowRecord.settings?.scope === 'window');
  };
}
