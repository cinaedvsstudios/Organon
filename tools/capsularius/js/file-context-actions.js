import { canCopyImageToClipboard, copyImageToClipboard } from './image-clipboard.js';

export function canOpenInPixlr(record, entry) {
  return canCopyImageToClipboard(entry);
}

export async function openInPixlr(workspace, record, entry) {
  return copyImageToClipboard(workspace, entry);
}

export async function copySavedLocation(workspace, record, entry) {
  workspace.onToast('Copy saved location is temporarily unavailable.', 'info');
}
