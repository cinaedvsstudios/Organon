import { persistence } from './persistence.js';
import { makeWindowRecord } from './state.js';

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForNormalBoot(workspace, saved) {
  const expectedMounts = (saved?.mounts || []).filter((mount) => mount?.nativePath).length;
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    const mounted = [...workspace.state.mounts.values()].filter((mount) => mount?.nativePath).length;
    const settled = [...workspace.state.windows.values()].every((record) => !record.loading);
    if (mounted >= expectedMounts && settled) return;
    await wait(100);
  }
}

async function restoreSavedDesktopWindows() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (document.documentElement.dataset.capsulariusMode === 'desktop' && window.__capsulariusWorkspace) break;
    await wait(100);
  }

  const workspace = window.__capsulariusWorkspace;
  if (document.documentElement.dataset.capsulariusMode !== 'desktop' || !workspace) return;

  const saved = await (window.__capsulariusDesktopSavedState || persistence.load());
  const snapshots = Array.isArray(saved?.workspace?.windows) ? saved.workspace.windows : [];
  if (!snapshots.length) return;

  await waitForNormalBoot(workspace, saved);

  const existingIds = new Set(workspace.state.windows.keys());
  let changed = false;

  for (const snapshot of snapshots) {
    const savedId = Number(snapshot?.id);
    if (!snapshot?.source || !Number.isFinite(savedId) || existingIds.has(savedId)) continue;
    if (snapshot.source.kind === 'physical' && !workspace.state.mounts.has(snapshot.source.mountId)) continue;

    const record = makeWindowRecord(workspace.state, snapshot.source, snapshot);
    record.id = savedId;
    workspace.state.nextWindowId = Math.max(workspace.state.nextWindowId, savedId + 1);
    workspace.addWindow(record);
    existingIds.add(savedId);
    changed = true;
  }

  if (changed) await persistence.saveDesktopWorkspaceFromApp(workspace.state);
}

void restoreSavedDesktopWindows().catch((error) => {
  console.error('Capsularius desktop window restore failed.', error);
});
