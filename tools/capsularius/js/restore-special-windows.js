import { persistence } from './persistence.js';
import { makeWindowRecord } from './state.js';

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function restoreSavedWindowsSkippedByBoot() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (document.documentElement.dataset.capsulariusMode === 'desktop' && window.__capsulariusWorkspace) break;
    await wait(100);
  }

  const workspace = window.__capsulariusWorkspace;
  if (document.documentElement.dataset.capsulariusMode !== 'desktop' || !workspace) return;

  // app.js finishes its normal restore before this pass compares the saved JSON.
  await wait(500);

  const saved = await persistence.load();
  const snapshots = Array.isArray(saved.workspace?.windows) ? saved.workspace.windows : [];
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

  if (restoredAny) workspace.onStateChange();
}

void restoreSavedWindowsSkippedByBoot().catch((error) => {
  console.error('Capsularius could not restore all saved desktop windows.', error);
});
