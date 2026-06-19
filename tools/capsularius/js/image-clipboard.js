function relabelImageContextAction() {
  const action = document.querySelector('#context-menu [data-command="open-pixlr"]');
  if (!action) return;
  action.textContent = '📋 Copy image to clipboard';
  action.title = 'Copy image to clipboard';
}

function imageToPngBlob(file) {
  return new Promise(async (resolve, reject) => {
    try {
      if (file.type === 'image/png') {
        resolve(file);
        return;
      }
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close?.();
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The image could not be converted for the clipboard.'));
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

export function canCopyImageToClipboard(entry) {
  queueMicrotask(relabelImageContextAction);
  return Boolean(entry?.kind === 'file' && entry?.fileType === 'image' && entry?.handle?.getFile && navigator.clipboard?.write && globalThis.ClipboardItem);
}

export async function copyImageToClipboard(workspace, entry) {
  if (!canCopyImageToClipboard(entry)) {
    workspace.onToast('This browser cannot copy this image to the clipboard.', 'error');
    return false;
  }
  try {
    const file = await entry.handle.getFile();
    const png = await imageToPngBlob(file);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png':png })]);
    workspace.onToast('Image copied to the clipboard.', 'success');
    return true;
  } catch (error) {
    workspace.onToast(error?.message || 'The image could not be copied to the clipboard.', 'error');
    return false;
  }
}
