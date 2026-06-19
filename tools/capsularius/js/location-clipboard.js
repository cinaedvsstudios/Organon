import { sourcePathLabel } from './state.js';

function recordedWindowsPath(workspace, record, entry) {
  if (record?.source?.kind !== 'physical') return '';
  const mount = workspace.state.mounts.get(record.source.mountId);
  const root = String(mount?.windowsPath || mount?.hddPath || mount?.recordedPath || '').trim();
  if (!root) return '';
  return [root.replace(/[\\/]+$/,''), ...record.source.pathSegments, entry?.name || ''].filter(Boolean).join('\\');
}

export async function copySavedLocation(workspace, record, entry) {
  const path = recordedWindowsPath(workspace, record, entry) || `${sourcePathLabel(workspace.state, record.source)}${entry?.name ? ` / ${entry.name}` : ''}`;
  if (!navigator.clipboard?.writeText) throw new Error('This browser cannot copy text to the clipboard.');
  await navigator.clipboard.writeText(path);
  workspace.onToast(recordedWindowsPath(workspace, record, entry) ? 'HDD path copied to the clipboard.' : 'Capsularius location copied to the clipboard.', 'success');
}
