import { readDirectory, resolveDirectory } from './filesystem.js';

class OperationCancelled extends Error {
  constructor() {
    super('Operation cancelled.');
    this.name = 'OperationCancelled';
  }
}

function fileNameParts(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, extension: '' };
  return { base: name.slice(0, dot), extension: name.slice(dot) };
}

function suggestedName(name, attempt = 2) {
  const { base, extension } = fileNameParts(name);
  return `${base} (${attempt})${extension}`;
}

async function existingEntry(directoryHandle, name) {
  try {
    return { kind: 'file', handle: await directoryHandle.getFileHandle(name) };
  } catch (fileError) {
    if (fileError?.name !== 'TypeMismatchError' && fileError?.name !== 'NotFoundError') throw fileError;
  }
  try {
    return { kind: 'directory', handle: await directoryHandle.getDirectoryHandle(name) };
  } catch (directoryError) {
    if (directoryError?.name === 'NotFoundError') return null;
    throw directoryError;
  }
}

async function nextDuplicateName(directoryHandle, originalName) {
  let attempt = 2;
  while (await existingEntry(directoryHandle, suggestedName(originalName, attempt))) attempt += 1;
  return suggestedName(originalName, attempt);
}

async function countEntries(entries) {
  const totals = { items: 0, files: 0, bytes: 0 };
  async function visit(entry) {
    totals.items += 1;
    if (entry.kind === 'file') {
      const file = await entry.handle.getFile();
      totals.files += 1;
      totals.bytes += file.size;
      return;
    }
    const { entries: children } = await readDirectory(entry.handle, []);
    for (const child of children) await visit(child);
  }
  for (const entry of entries) await visit(entry);
  return totals;
}

export class OperationManager {
  constructor({ ui, onRefresh, onToast }) {
    this.ui = ui;
    this.onRefresh = onRefresh;
    this.onToast = onToast;
    this.active = null;
  }

  async copyOrMove({ mode, entries, sourceDirectory, targetDirectory, sourceLabel, targetLabel, sourcePathSegments, targetPathSegments, sameMount }) {
    if (!entries.length) return false;
    if (mode === 'move' && sameMount && sourcePathSegments.join('/') === targetPathSegments.join('/')) {
      this.onToast('The source and destination are the same folder.', 'error');
      return false;
    }
    for (const entry of entries) {
      if (entry.kind === 'directory' && sameMount) {
        const sourceFolder = [...sourcePathSegments, entry.name];
        const destinationInsideSource = targetPathSegments.length >= sourceFolder.length && sourceFolder.every((segment, index) => targetPathSegments[index] === segment);
        if (destinationInsideSource) {
          this.onToast('A folder cannot be copied or moved into itself.', 'error');
          return false;
        }
      }
    }

    const action = mode === 'move' ? 'Move' : 'Copy';
    const confirmed = await this.ui.confirm({
      badge: action,
      message: `${action} ${entries.length} item${entries.length === 1 ? '' : 's'} to “${targetLabel}”?`,
      detail: `From: “${sourceLabel}”`,
      confirmLabel: `Confirm ${action}`
    });
    if (!confirmed) return false;

    const controller = this.begin(`${action} preparation…`);
    try {
      controller.totals = await countEntries(entries);
      controller.update(`${action}ing 0 of ${controller.totals.files || controller.totals.items} items`);
      for (const entry of entries) {
        this.throwIfCancelled(controller);
        await this.copyEntry(entry, targetDirectory, controller, { mode, root: true });
        if (mode === 'move') {
          this.throwIfCancelled(controller);
          await sourceDirectory.removeEntry(entry.name, { recursive: entry.kind === 'directory' });
        }
      }
      controller.complete();
      this.onRefresh();
      this.onToast(`${mode === 'move' ? 'Moved' : 'Copied'} ${entries.length} item${entries.length === 1 ? '' : 's'} to “${targetLabel}”.`, 'success');
      return true;
    } catch (error) {
      controller.complete();
      if (error instanceof OperationCancelled) this.onToast('Operation cancelled. Completed items were left in place.', 'info');
      else {
        console.error(error);
        this.onToast(error?.message || 'The file operation could not be completed.', 'error');
      }
      return false;
    }
  }

  async rename({ entry, parentDirectory, parentLabel }) {
    const nextName = await this.ui.rename({
      title: 'Rename item',
      oldName: entry.name,
      suggestedName: entry.name,
      confirmLabel: 'Confirm Rename'
    });
    if (!nextName || nextName === entry.name) return false;

    const controller = this.begin(`Renaming “${entry.name}”…`);
    try {
      await this.copyEntry(entry, parentDirectory, controller, { mode: 'move', forcedName: nextName, root: true });
      await parentDirectory.removeEntry(entry.name, { recursive: entry.kind === 'directory' });
      controller.complete();
      this.onRefresh();
      this.onToast(`Renamed to “${nextName}”.`, 'success');
      return true;
    } catch (error) {
      controller.complete();
      if (error instanceof OperationCancelled) this.onToast('Rename cancelled.', 'info');
      else {
        console.error(error);
        this.onToast(error?.message || 'The item could not be renamed.', 'error');
      }
      return false;
    }
  }

  async duplicate({ entry, parentDirectory, parentLabel }) {
    if (!entry || entry.kind !== 'file') return false;
    const confirmed = await this.ui.confirm({
      badge: 'Duplicate',
      message: `Duplicate “${entry.name}”?`,
      detail: `In: “${parentLabel}”`,
      confirmLabel: 'Duplicate File'
    });
    if (!confirmed) return false;

    const controller = this.begin(`Preparing duplicate of “${entry.name}”…`);
    try {
      controller.totals = await countEntries([entry]);
      const targetName = await nextDuplicateName(parentDirectory, entry.name);
      controller.update(`Duplicating 0 of ${controller.totals.files || 1}: ${targetName}`);
      await this.copyEntry(entry, parentDirectory, controller, { mode:'copy', forcedName:targetName, root:true });
      controller.complete();
      this.onRefresh();
      this.onToast(`Duplicated as “${targetName}”.`, 'success');
      return true;
    } catch (error) {
      controller.complete();
      if (error instanceof OperationCancelled) this.onToast('Duplicate cancelled.', 'info');
      else {
        console.error(error);
        this.onToast(error?.message || 'The file could not be duplicated.', 'error');
      }
      return false;
    }
  }

  async createFolder({ directoryHandle, label }) {
    const name = await this.ui.rename({
      title: 'New folder',
      oldName: '',
      suggestedName: 'New folder',
      confirmLabel: 'Create Folder'
    });
    if (!name) return false;
    try {
      const exists = await existingEntry(directoryHandle, name);
      if (exists) {
        this.onToast(`“${name}” already exists in “${label}”.`, 'error');
        return false;
      }
      await directoryHandle.getDirectoryHandle(name, { create: true });
      this.onRefresh();
      this.onToast(`Created “${name}”.`, 'success');
      return true;
    } catch (error) {
      console.error(error);
      this.onToast(error?.message || 'The folder could not be created.', 'error');
      return false;
    }
  }

  async delete({ entries, parentDirectory, parentLabel }) {
    if (!entries.length) return false;
    const confirmed = await this.ui.confirm({
      badge: 'Delete',
      message: `Permanently delete ${entries.length} item${entries.length === 1 ? '' : 's'}?`,
      detail: `From: “${parentLabel}”`,
      confirmLabel: `Delete ${entries.length} Item${entries.length === 1 ? '' : 's'}`,
      destructive: true
    });
    if (!confirmed) return false;

    const controller = this.begin(`Deleting 0 of ${entries.length} items`);
    try {
      for (let index = 0; index < entries.length; index += 1) {
        this.throwIfCancelled(controller);
        const entry = entries[index];
        controller.update(`Deleting ${index + 1} of ${entries.length}: ${entry.name}`);
        await parentDirectory.removeEntry(entry.name, { recursive: entry.kind === 'directory' });
      }
      controller.complete();
      this.onRefresh();
      this.onToast(`Deleted ${entries.length} item${entries.length === 1 ? '' : 's'} from “${parentLabel}”.`, 'success');
      return true;
    } catch (error) {
      controller.complete();
      if (error instanceof OperationCancelled) this.onToast('Delete cancelled. Completed deletions cannot be undone.', 'info');
      else {
        console.error(error);
        this.onToast(error?.message || 'The selected item could not be deleted.', 'error');
      }
      return false;
    }
  }

  begin(initialMessage) {
    if (this.active) throw new Error('Another file operation is already running.');
    const progress = this.ui.progress(initialMessage);
    const controller = {
      cancelled: false,
      totals: { items: 0, files: 0, bytes: 0 },
      completedFiles: 0,
      completedBytes: 0,
      update: (message) => progress.update(message),
      complete: () => {
        progress.close();
        if (this.active === controller) this.active = null;
      }
    };
    progress.onCancel(() => { controller.cancelled = true; });
    this.active = controller;
    return controller;
  }

  throwIfCancelled(controller) {
    if (controller.cancelled) throw new OperationCancelled();
  }

  async resolveTargetName(directoryHandle, requestedName, sourceKind, controller) {
    let name = requestedName;
    let attempt = 2;
    while (true) {
      this.throwIfCancelled(controller);
      const existing = await existingEntry(directoryHandle, name);
      if (!existing) return { name, existing: null };
      if (sourceKind === 'directory' && existing.kind === 'directory') return { name, existing };
      const choice = await this.ui.conflict({ name, destinationName: name, sourceKind, targetKind: existing.kind });
      if (choice === 'cancel') throw new OperationCancelled();
      if (choice === 'replace') {
        await directoryHandle.removeEntry(name, { recursive: existing.kind === 'directory' });
        return { name, existing: null };
      }
      const renamed = await this.ui.rename({
        title: 'Rename conflicting item',
        oldName: requestedName,
        suggestedName: suggestedName(requestedName, attempt),
        confirmLabel: 'Confirm Rename'
      });
      if (!renamed) throw new OperationCancelled();
      name = renamed;
      attempt += 1;
    }
  }

  async copyEntry(entry, destinationDirectory, controller, { mode, forcedName, root = false }) {
    this.throwIfCancelled(controller);
    const requestedName = forcedName || entry.name;
    const target = await this.resolveTargetName(destinationDirectory, requestedName, entry.kind, controller);

    if (entry.kind === 'directory') {
      const targetDirectory = target.existing?.kind === 'directory'
        ? target.existing.handle
        : await destinationDirectory.getDirectoryHandle(target.name, { create: true });
      const { entries: children } = await readDirectory(entry.handle, []);
      if (children.length === 0) controller.update(`Creating folder: ${target.name}`);
      for (const child of children) await this.copyEntry(child, targetDirectory, controller, { mode, root: false });
      return;
    }

    const sourceFile = await entry.handle.getFile();
    controller.update(`${mode === 'move' ? 'Moving' : 'Copying'} ${controller.completedFiles + 1} of ${controller.totals.files || 1}: ${target.name}`);
    const targetFileHandle = await destinationDirectory.getFileHandle(target.name, { create: true });
    const writable = await targetFileHandle.createWritable();
    try {
      const reader = sourceFile.stream().getReader();
      while (true) {
        this.throwIfCancelled(controller);
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        controller.completedBytes += value.byteLength;
        const totalBytes = controller.totals.bytes;
        const byteText = totalBytes > 0 ? ` · ${this.formatProgress(controller.completedBytes)} of ${this.formatProgress(totalBytes)}` : '';
        controller.update(`${mode === 'move' ? 'Moving' : 'Copying'} ${controller.completedFiles + 1} of ${controller.totals.files || 1}: ${target.name}${byteText}`);
      }
      await writable.close();
      controller.completedFiles += 1;
    } catch (error) {
      try { await writable.abort(); } catch (_) { /* no-op */ }
      throw error;
    }
  }

  formatProgress(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
  }
}

export async function directoryForSource(state, source) {
  if (source.kind !== 'physical') throw new Error('Choose a real folder first.');
  const mount = state.mounts.get(source.mountId);
  if (!mount) throw new Error('This mounted folder is unavailable.');
  return resolveDirectory(mount.handle, source.pathSegments);
}
