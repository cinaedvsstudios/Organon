const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'svg']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'mid', 'midi']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);
const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl', 'dae']);
const ARCHIVE_EXTENSIONS = new Set(['zip']);
const CODE_EXTENSIONS = new Set(['txt', 'md', 'json', 'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'xml', 'yaml', 'yml', 'csv', 'py', 'java', 'cs', 'cpp', 'c', 'h', 'php', 'sql', 'sh', 'bat', 'ps1']);

export function makeId(prefix = 'caps') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function extensionOf(name) {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === name.length - 1) return '';
  return name.slice(lastDot + 1).toLowerCase();
}

export function typeForFile(name, mimeType = '') {
  const extension = extensionOf(name);
  if (IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith('image/')) return 'image';
  if (AUDIO_EXTENSIONS.has(extension) || mimeType.startsWith('audio/')) return 'audio';
  if (VIDEO_EXTENSIONS.has(extension) || mimeType.startsWith('video/')) return 'video';
  if (MODEL_EXTENSIONS.has(extension)) return 'model';
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive';
  if (CODE_EXTENSIONS.has(extension) || mimeType.startsWith('text/')) return 'code';
  return 'file';
}

export function iconForEntry(entry) {
  if (entry.kind === 'directory') return entry.emoji || '📁';
  if (entry.kind === 'shortcut') return entry.emoji || '📁';
  switch (entry.fileType) {
    case 'image': return '🖼️';
    case 'audio': return '🎵';
    case 'video': return '🎥';
    case 'model': return '📐';
    case 'archive': return '📦';
    case 'code': return '⚙️';
    default: return '📄';
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export async function queryDirectoryPermission(handle, mode = 'readwrite') {
  if (!handle || typeof handle.queryPermission !== 'function') return 'denied';
  return handle.queryPermission({ mode });
}

export async function requestDirectoryPermission(handle, mode = 'readwrite') {
  if (!handle || typeof handle.requestPermission !== 'function') return 'denied';
  return handle.requestPermission({ mode });
}

export async function resolveDirectory(rootHandle, segments = []) {
  let current = rootHandle;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment);
  }
  return current;
}

export async function readDirectory(rootHandle, segments = []) {
  const directoryHandle = await resolveDirectory(rootHandle, segments);
  const rawEntries = [];

  for await (const [name, handle] of directoryHandle.entries()) {
    rawEntries.push({ name, handle });
  }

  const entries = await Promise.all(rawEntries.map(async ({ name, handle }) => {
    if (handle.kind === 'directory') {
      return {
        id: `directory:${name}`,
        name,
        kind: 'directory',
        handle,
        fileType: 'directory',
        size: null,
        lastModified: null
      };
    }

    const file = await handle.getFile();
    return {
      id: `file:${name}`,
      name,
      kind: 'file',
      handle,
      fileType: typeForFile(name, file.type),
      size: file.size,
      lastModified: file.lastModified,
      mimeType: file.type
    };
  }));

  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { directoryHandle, entries };
}

export async function handlesAreSame(first, second) {
  if (!first || !second || typeof first.isSameEntry !== 'function') return false;
  return first.isSameEntry(second);
}

export async function imageObjectUrl(fileHandle) {
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}
