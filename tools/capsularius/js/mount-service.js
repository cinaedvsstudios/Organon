import { handlesAreSame, queryDirectoryPermission } from './filesystem.js';
import { createMount, physicalSource } from './state.js';
import { normaliseHddPath, saveLocationForMount } from './location-store.js';

function needsDisplayName(handle) {
  const name = String(handle?.name || '').trim();
  return !name || name === '\\' || name === '/';
}

function suggestedRootPath(handle, displayName) {
  const name = String(handle?.name || '').trim();
  if (name === '\\' || name === '/') return 'E:\\';
  return `D:\\${displayName || name || 'Mounted folder'}`;
}

function askForHddPath(handle, displayName) {
  const answer = window.prompt(
    `Optional but recommended: enter the full Windows location for “${displayName}”.\n\nCapsularius uses this only for Copy Full HDD Path.\nExamples: D:\\Forever Bound\\Assets or E:\\`,
    suggestedRootPath(handle, displayName)
  );
  return normaliseHddPath(answer || '');
}

export function createMountService({ state, workspace, toast, scheduleSave, openSource, askForLabel }) {
  async function mountDirectory(handle, { targetWindow = null, source = 'picker' } = {}) {
    if (!handle || handle.kind !== 'directory') {
      toast('Drop a folder or drive, not an individual file.', 'error');
      return null;
    }

    for (const existing of state.mounts.values()) {
      if (await handlesAreSame(existing.handle, handle)) {
        existing.permission = await queryDirectoryPermission(existing.handle);
        const mountedSource = physicalSource(existing.id, []);
        if (targetWindow) await workspace.navigateWindow(targetWindow, mountedSource);
        else openSource(mountedSource);
        workspace.refreshSpecialWindows();
        scheduleSave();
        toast(`${existing.nickname || existing.name} is already mounted.`);
        return existing;
      }
    }

    let displayName = String(handle.name || '').trim();
    if (needsDisplayName(handle)) {
      displayName = await askForLabel({ rawName: handle.name, suggestedLabel: 'Mounted drive' });
      if (!displayName) return null;
    }

    const colours = ['#e0a360', '#4b84bf', '#449e92', '#9a2f4f', '#d27d6c', '#896b49'];
    const mount = createMount(handle, colours[state.mounts.size % colours.length]);
    mount.nickname = displayName || 'Mounted folder';
    mount.permission = await queryDirectoryPermission(handle);
    mount.hddPath = askForHddPath(handle, mount.nickname);
    mount.locationHealth = mount.hddPath ? 'not-checked' : 'path-required';
    saveLocationForMount(mount.id, { hddPath: mount.hddPath, status: mount.locationHealth, lastChecked: null });
    state.mounts.set(mount.id, mount);

    const mountedSource = physicalSource(mount.id, []);
    if (targetWindow) await workspace.navigateWindow(targetWindow, mountedSource);
    else openSource(mountedSource);
    workspace.refreshSpecialWindows();
    scheduleSave();
    window.dispatchEvent(new CustomEvent('capsularius:mount-location-changed'));
    toast(`${mount.nickname} mounted from ${source === 'drop' ? 'drop' : 'folder picker'}.`, 'success');
    return mount;
  }

  return { mountDirectory };
}
