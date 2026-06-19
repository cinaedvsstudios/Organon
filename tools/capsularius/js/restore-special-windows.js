import { persistence } from './persistence.js';
import { makeWindowRecord } from './state.js';

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForBootRestore(workspace, saved) {
  const requiredDesktopMounts = saved.mounts.filter((mount) => mount?.nativePath).length;
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    const restoredDesktopMounts = [...workspace.state.mounts.values()].filter((mount) => mount?.nativePath).length;
    const windowsAreSettled = [...workspace.state.windows.values()].every((record) => !record.loading);
    if (restoredDesktopMounts >= requiredDesktopMounts && windowsAreSettled) return;
    await wait(120);
  }
}

async function restoreSavedWindowsSkippedByBoot() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (document.documentElement.dataset.capsulariusMode === 'desktop' && window.__capsulariusWorkspace) break;
    await wait(100);
  }

  const workspace = window.__capsulariusWorkspace;
  if (document.documentElement.dataset.capsulariusMode !== 'desktop' || !workspace) return;

  const saved = await persistence.load();
  const snapshots = Array.isArray(saved.workspace?.windows) ? saved.workspace.windows : [];
  if (!snapshots.length) return;

  await waitForBootRestore(workspace, saved);

  const existingIds = new Set(workspace.state.windows.keys());
  let restoredAny = false;

  for (const snapshot of snapshots) {
    const savedId = Number(snapshot?.id);
    if (!snapshot?.source || !Number.isFinite(savedId) || existingIds.has(savedId)) continue;
    if (snapshot.source.kind === 'physical' && !workspace.state.mounts.has(snapshot.source.mountId)) continue;

    const record = makeWindowRecord(workspace.state, snapshot.source, snapshot);
    record.id = savedId;
    workspace.state.nextWindowId = Math.max(workspace.state.nextWindowId, savedId + 1);
    workspace.addWindow(record);
    existingIds.add(savedId);
    restoredAny = true;
  }

  if (restoredAny) await persistence.saveDesktopWorkspaceFromApp(workspace.state);
}

void restoreSavedWindowsSkippedByBoot().catch((error) => {
  console.error('Capsularius could not restore all saved desktop windows.', error);
});
