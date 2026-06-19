import { sourcePathLabel } from './state.js';

function browserPath(workspace, record, entry) {
  if (record?.source?.kind !== 'physical') return '';
  const mount = workspace.state.mounts.get(record.source.mountId);
  const root = String(mount?.windowsPath || mount?.hddPath || mount?.recordedPath || '').trim();
  if (!root) return '';
  return [root.replace(/[\\/]+$/,''), ...record.source.pathSegments, entry?.name || ''].filter(Boolean).join('\\');
}

function logicalLocation(workspace, record, entry) {
  const base = sourcePathLabel(workspace.state, record.source);
  return entry?.name ? `${base} / ${entry.name}` : base;
}

async function writeText(text) {
  if (!navigator.clipboard?.writeText) throw new Error('This browser cannot copy text to the clipboard.');
  await navigator.clipboard.writeText(text);
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name || 'image';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function savedLocationFor(workspace, record, entry) {
  const hddPath = browserPath(workspace, record, entry);
  return {
    hddPath,
    logicalPath:logicalLocation(workspace, record, entry)
  };
}

export function canOpenInPixlr(record, entry) {
  return Boolean(record?.source?.kind === 'physical' && entry?.kind === 'file' && entry?.fileType === 'image' && entry?.handle?.getFile);
}

export async function copySavedLocation(workspace, record, entry) {
  const { hddPath, logicalPath } = savedLocationFor(workspace, record, entry);
  const value = hddPath || logicalPath;
  await writeText(value);
  workspace.onToast(hddPath ? 'HDD path copied to the clipboard.' : 'Capsularius location copied to the clipboard.', 'success');
}

export async function openInPixlr(workspace, record, entry) {
  if (!canOpenInPixlr(record, entry)) {
    workspace.onToast('Pixlr is available for one local image file at a time.', 'error');
    return false;
  }
  const tab = window.open('https://pixlr.com/e/', '_blank', 'noopener,noreferrer');
  try {
    const file = await entry.handle.getFile();
    const mime = file.type || 'image/png';
    if (navigator.clipboard?.write && globalThis.ClipboardItem && mime.startsWith('image/')) {
      await navigator.clipboard.write([new ClipboardItem({ [mime]:file })]);
      workspace.onToast('Pixlr opened. Press Ctrl+V in the Pixlr tab to paste the image.', 'success');
      return true;
    }
    downloadFile(file);
    workspace.onToast('Pixlr opened and the image downloaded. Drag it into the Pixlr tab to edit it.', 'info');
    return true;
  } catch (error) {
    if (!tab) workspace.onToast('The browser blocked the Pixlr tab. Allow pop-ups, then try again.', 'error');
    else workspace.onToast('Pixlr opened, but this browser could not copy the image. Download the image and drag it into Pixlr.', 'info');
    return false;
  }
}
