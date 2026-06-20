function desktopApi() {
  if (!window.capsulariusDesktop?.isDesktop) throw new Error('Capsularius Desktop is not available in this window.');
  return window.capsulariusDesktop;
}

function nativeError(message, name = 'NotFoundError') {
  return new DOMException(message, name);
}

function asUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new Uint8Array();
}

function mimeTypeForName(name) {
  const extension = String(name).split('.').pop()?.toLowerCase() || '';
  return ({ png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', mp4:'video/mp4', webm:'video/webm', json:'application/json', txt:'text/plain', html:'text/html', css:'text/css', js:'text/javascript' })[extension] || '';
}

function descriptorToHandle(descriptor) {
  if (!descriptor?.path) throw nativeError('The selected item no longer exists.');
  return descriptor.kind === 'directory' ? new DesktopDirectoryHandle(descriptor) : new DesktopFileHandle(descriptor);
}

export class DesktopFileHandle {
  constructor(descriptor) {
    this.kind = 'file';
    this.name = descriptor.name;
    this.nativePath = descriptor.path;
    this.size = Number.isFinite(descriptor.size) ? descriptor.size : null;
    this.lastModified = Number.isFinite(descriptor.modifiedTime) ? descriptor.modifiedTime : null;
    this.createdTime = Number.isFinite(descriptor.createdTime) ? descriptor.createdTime : null;
  }

  async getFile() {
    const result = await desktopApi().readFile(this.nativePath);
    const bytes = asUint8Array(result?.bytes);
    return new File([bytes], this.name, {
      type: mimeTypeForName(this.name),
      lastModified: Number(result?.modifiedTime) || this.lastModified || Date.now()
    });
  }

  async createWritable() {
    const chunks = [];
    let closed = false;
    return {
      write: async (chunk) => {
        if (closed) throw new Error('This file writer is already closed.');
        if (chunk instanceof Blob) {
          chunks.push(new Uint8Array(await chunk.arrayBuffer()));
          return;
        }
        chunks.push(asUint8Array(chunk));
      },
      close: async () => {
        if (closed) return;
        closed = true;
        const blob = new Blob(chunks);
        await desktopApi().writeFile(this.nativePath, new Uint8Array(await blob.arrayBuffer()));
      },
      abort: async () => {
        closed = true;
        chunks.length = 0;
      }
    };
  }

  async isSameEntry(other) {
    return Boolean(other?.nativePath && String(other.nativePath).toLowerCase() === String(this.nativePath).toLowerCase());
  }
}

export class DesktopDirectoryHandle {
  constructor(descriptor) {
    this.kind = 'directory';
    this.name = descriptor.name;
    this.nativePath = descriptor.path;
    this.lastModified = Number.isFinite(descriptor.modifiedTime) ? descriptor.modifiedTime : null;
    this.createdTime = Number.isFinite(descriptor.createdTime) ? descriptor.createdTime : null;
  }

  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }

  async *entries() {
    const entries = await desktopApi().listDirectory(this.nativePath);
    for (const entry of entries) yield [entry.name, descriptorToHandle(entry)];
  }

  async getDirectoryHandle(name, options = {}) {
    const descriptor = await desktopApi().resolveChild(this.nativePath, name, 'directory', Boolean(options.create));
    if (!descriptor) throw nativeError(`Folder “${name}” was not found.`);
    if (descriptor.kind !== 'directory') throw nativeError(`“${name}” is not a folder.`, 'TypeMismatchError');
    return descriptorToHandle(descriptor);
  }

  async getFileHandle(name, options = {}) {
    const descriptor = await desktopApi().resolveChild(this.nativePath, name, 'file', Boolean(options.create));
    if (!descriptor) throw nativeError(`File “${name}” was not found.`);
    if (descriptor.kind !== 'file') throw nativeError(`“${name}” is not a file.`, 'TypeMismatchError');
    return descriptorToHandle(descriptor);
  }

  async removeEntry(name, options = {}) {
    await desktopApi().removeEntry(this.nativePath, name, Boolean(options.recursive));
  }

  async isSameEntry(other) {
    return Boolean(other?.nativePath && String(other.nativePath).toLowerCase() === String(this.nativePath).toLowerCase());
  }
}

export function isDesktopDirectoryHandle(handle) {
  return Boolean(handle?.kind === 'directory' && handle.nativePath);
}

export async function chooseDesktopDirectory() {
  const descriptor = await desktopApi().chooseDirectory();
  return descriptor ? descriptorToHandle(descriptor) : null;
}

export async function restoreDesktopDirectory(nativePath) {
  const descriptor = await desktopApi().restoreDirectory(nativePath);
  return descriptor ? descriptorToHandle(descriptor) : null;
}

export async function loadDesktopWorkspaceState() {
  return desktopApi().loadDesktopState();
}

export async function saveDesktopWorkspaceState(state) {
  return desktopApi().saveDesktopState(state);
}
