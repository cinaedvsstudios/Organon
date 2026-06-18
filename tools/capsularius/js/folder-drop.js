function hasInternalCapsulariusDrag(event) {
  return [...event.dataTransfer.types].includes('application/x-capsularius-source');
}

function hasExternalFileDrop(event) {
  return [...event.dataTransfer.types].includes('Files');
}

async function directoryHandlesFromDrop(dataTransfer) {
  const handles = [];
  const items = [...dataTransfer.items];
  for (const item of items) {
    if (item.kind !== 'file' || typeof item.getAsFileSystemHandle !== 'function') continue;
    const handle = await item.getAsFileSystemHandle();
    if (handle?.kind === 'directory') handles.push(handle);
  }
  return handles;
}

export function installFolderDrop(Workspace, onDirectoryDropped) {
  if (Workspace.prototype.__capsulariusFolderDropInstalled) return;
  Object.defineProperty(Workspace.prototype, '__capsulariusFolderDropInstalled', { value: true });

  const originalRenderWindowShell = Workspace.prototype.renderWindowShell;

  Workspace.prototype.renderWindowShell = function renderWindowShellWithExternalDrop(windowRecord) {
    originalRenderWindowShell.call(this, windowRecord);
    const content = windowRecord.element.querySelector('.window-content');
    let dragDepth = 0;

    const showTarget = () => {
      windowRecord.element.classList.add('external-folder-target');
    };
    const hideTarget = () => {
      windowRecord.element.classList.remove('external-folder-target');
    };

    content.addEventListener('dragenter', (event) => {
      if (hasInternalCapsulariusDrag(event) || !hasExternalFileDrop(event)) return;
      event.preventDefault();
      dragDepth += 1;
      showTarget();
    }, true);

    content.addEventListener('dragover', (event) => {
      if (hasInternalCapsulariusDrag(event) || !hasExternalFileDrop(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      showTarget();
    }, true);

    content.addEventListener('dragleave', (event) => {
      if (hasInternalCapsulariusDrag(event) || !hasExternalFileDrop(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) hideTarget();
    }, true);

    content.addEventListener('drop', async (event) => {
      if (hasInternalCapsulariusDrag(event) || !hasExternalFileDrop(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dragDepth = 0;
      hideTarget();

      try {
        const handles = await directoryHandlesFromDrop(event.dataTransfer);
        if (handles.length === 0) {
          this.onToast('Drop a folder or drive from Explorer. Individual file import comes later.', 'error');
          return;
        }
        if (handles.length > 1) {
          this.onToast('Drop one folder or drive at a time.', 'error');
          return;
        }
        await onDirectoryDropped(handles[0], windowRecord);
      } catch (error) {
        console.error(error);
        this.onToast('Capsularius could not mount that dropped folder.', 'error');
      }
    }, true);
  };
}
