import { canCopyImageToClipboard, copyImageToClipboard } from './image-clipboard.js';
import { copySavedLocation as copySavedLocationValue } from './location-clipboard.js';

export function canOpenInPixlr(record, entry) {
  return canCopyImageToClipboard(entry);
}

export async function openInPixlr(workspace, record, entry) {
  return copyImageToClipboard(workspace, entry);
}

export async function copySavedLocation(workspace, record, entry) {
  return copySavedLocationValue(workspace, record, entry);
}
