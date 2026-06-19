import { extensionOf, readDirectory, resolveDirectory, typeForFile } from './filesystem.js';
import { zipSource } from './state.js';

function archiveError(message) {
  return new Error(message);
}

function requireJsZip() {
  if (globalThis.JSZip) return globalThis.JSZip;
  throw archiveError('ZIP support could not load. Check the network connection and refresh Capsularius.');
}

function zipKey(source) {
  return `${source.mountId}:${source.parentPathSegments.join('/')}:${source.archiveName}`;
}

function normalisePath(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function folderPath(value = '') {
  const path = normalisePath(value);
  return path && !path.endsWith('/') ? `${path}/` : path;
}

function directChild(path, prefix) {
  if (!path.startsWith(prefix)) return null;
  const remainder = path.slice(prefix.length);
  if (!remainder) return null;
  const slash = remainder.indexOf('/');
  return slash === -1
    ? { name:remainder, isDirectory:false, path:`${prefix}${remainder}` }
    : { name:remainder.slice(0,slash), isDirectory:true, path:`${prefix}${remainder.slice(0,slash + 1)}` };
}

function safeSize(zipObject) {
  const size = Number(zipObject?._data?.uncompressedSize ?? zipObject?._data?.compressedSize);
  return Number.isFinite(size) ? size : null;
}

function mimeFor(name) {
  const extension = extensionOf(name);
  if (extension === 'txt' || extension === 'md' || extension === 'csv' || extension === 'json') return 'text/plain';
  if (extension === 'html' || extension === 'htm') return 'text/html';
  if (extension === 'css') return 'text/css';
  if (extension === 'js' || extension === 'mjs' || extension === 'cjs') return 'text/javascript';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'ogg') return 'audio/ogg';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function fileNameParts(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base:name, extension:'' };
  return { base:name.slice(0,dot), extension:name.slice(dot) };
}

function suggestedName(name, attempt = 2) {
  const { base, extension } = fileNameParts(name);
  return `${base} (${attempt})${extension}`;
}

async function existingEntry(directoryHandle, name) {
  try {
    return { kind:'file', handle:await directoryHandle.getFileHandle(name) };
  } catch (error) {
    if (error?.name !== 'NotFoundError' && error?.name !== 'TypeMismatchError') throw error;
  }
  try {
    return { kind:'directory', handle:await directoryHandle.getDirectoryHandle(name) };
  } catch (error) {
    if (error?.name === 'NotFoundError') return null;
    throw error;
  }
}

export class ArchiveService {
  constructor({ state, ui, onToast, onRefresh }) {
    this.state = state;
    this.ui = ui;
    this.onToast = onToast;
    this.onRefresh = onRefresh;
    this.cache = new Map();
  }

  async archiveHandle(source) {
    const mount = this.state.mounts.get(source.mountId);
    if (!mount) throw archiveError('The mounted folder containing this ZIP is unavailable.');
    const directory = await resolveDirectory(mount.handle, source.parentPathSegments);
    return directory.getFileHandle(source.archiveName);
  }

  async archiveFor(source) {
    const key = zipKey(source);
    const handle = await this.archiveHandle(source);
    const file = await handle.getFile();
    const existing = this.cache.get(key);
    if (existing && existing.size === file.size && existing.lastModified === file.lastModified) return existing;
    const JSZip = requireJsZip();
    let zip;
    try {
      zip = await JSZip.loadAsync(file,{ createFolders:true });
    } catch (error) {
      throw archiveError(error?.message || 'This ZIP archive could not be opened.');
    }
    const archive = { zip, size:file.size, lastModified:file.lastModified, file };
    this.cache.set(key,archive);
    return archive;
  }

  virtualFileHandle(source, path, name) {
    const service = this;
    return {
      kind:'file',
      name,
      async getFile() {
        const archive = await service.archiveFor(source);
        const object = archive.zip.files[path];
        if (!object || object.dir) throw archiveError(`“${name}” is no longer available in this ZIP.`);
        const blob = await object.async('blob');
        return new File([blob],name,{ type:mimeFor(name), lastModified:object.date?.getTime?.() || archive.lastModified || Date.now() });
      }
    };
  }

  virtualDirectoryHandle(source, path, name) {
    const service = this;
    return {
      kind:'directory',
      name,
      async *entries() {
        const children = await service.listSource(zipSource(source.mountId,source.parentPathSegments,source.archiveName,path,{ parent:source }));
        for (const child of children) yield [child.name,child.handle];
      }
    };
  }

  async listSource(source) {
    const archive = await this.archiveFor(source);
    const prefix = folderPath(source.zipPath);
    const children = new Map();
    for (const [rawPath,object] of Object.entries(archive.zip.files)) {
      const path = normalisePath(rawPath);
      const child = directChild(path,prefix);
      if (!child || !child.name) continue;
      const current = children.get(child.name);
      if (!current || child.isDirectory) children.set(child.name,child);
      if (object.dir && path === `${prefix}${child.name}/`) children.set(child.name,{ name:child.name, isDirectory:true, path:`${prefix}${child.name}/` });
    }
    return [...children.values()].map((child)=>{
      if (child.isDirectory) return {
        id:`zip:${zipKey(source)}:${child.path}`,
        name:child.name,
        kind:'directory',
        fileType:'directory',
        size:null,
        lastModified:null,
        mimeType:'',
        metadataPending:false,
        zipPath:child.path,
        handle:this.virtualDirectoryHandle(source,child.path,child.name)
      };
      const object = archive.zip.files[child.path];
      return {
        id:`zip:${zipKey(source)}:${child.path}`,
        name:child.name,
        kind:'file',
        fileType:typeForFile(child.name,mimeFor(child.name)),
        size:safeSize(object),
        lastModified:object?.date?.getTime?.() || archive.lastModified || null,
        mimeType:mimeFor(child.name),
        metadataPending:true,
        zipPath:child.path,
        handle:this.virtualFileHandle(source,child.path,child.name)
      };
    }).sort((one,two)=>{
      if (one.kind !== two.kind) return one.kind === 'directory' ? -1 : 1;
      return one.name.localeCompare(two.name,undefined,{ numeric:true, sensitivity:'base' });
    });
  }

  childSource(source, entry) {
    return zipSource(source.mountId,source.parentPathSegments,source.archiveName,folderPath(entry.zipPath),{ parent:source });
  }

  parentSource(source) {
    const current = folderPath(source.zipPath).replace(/\/$/,'');
    if (!current) return { kind:'physical', mountId:source.mountId, pathSegments:[...source.parentPathSegments] };
    const pieces = current.split('/').filter(Boolean);
    pieces.pop();
    return zipSource(source.mountId,source.parentPathSegments,source.archiveName,pieces.length ? `${pieces.join('/')}/` : '');
  }

  async createZip({ entries, directoryHandle, label }) {
    if (!entries?.length) return false;
    const first = entries[0]?.name || 'Archive';
    const initial = entries.length === 1 ? `${fileNameParts(first).base}.zip` : 'Archive.zip';
    let name = await this.ui.rename({ title:'Create ZIP archive', oldName:'', suggestedName:initial, confirmLabel:'Create ZIP' });
    if (!name) return false;
    if (!name.toLowerCase().endsWith('.zip')) name = `${name}.zip`;

    let existing = await existingEntry(directoryHandle,name);
    let attempt = 2;
    while (existing) {
      const choice = await this.ui.conflict({ name, sourceKind:'file', targetKind:existing.kind });
      if (choice === 'cancel') return false;
      if (choice === 'replace') {
        await directoryHandle.removeEntry(name,{ recursive:existing.kind === 'directory' });
        break;
      }
      name = suggestedName(name,attempt++);
      existing = await existingEntry(directoryHandle,name);
    }

    const confirmed = await this.ui.confirm({ badge:'Create ZIP', message:`Create “${name}” from ${entries.length} selected item${entries.length === 1 ? '' : 's'}?`, detail:`In: “${label}”`, confirmLabel:'Create ZIP' });
    if (!confirmed) return false;

    const JSZip = requireJsZip();
    const zip = new JSZip();
    const progress = this.ui.progress('Preparing files for ZIP…');
    let cancelled = false;
    progress.onCancel(()=>{ cancelled=true; });
    const checkCancelled = () => { if (cancelled) throw archiveError('ZIP creation cancelled.'); };
    let fileCount = 0;
    const addEntry = async (entry,prefix = '') => {
      checkCancelled();
      if (entry.kind === 'directory') {
        zip.folder(`${prefix}${entry.name}`);
        const children = await readDirectory(entry.handle,[]);
        for (const child of children.entries) await addEntry(child,`${prefix}${entry.name}/`);
        return;
      }
      const file = await entry.handle.getFile();
      fileCount += 1;
      progress.update(`Adding ${fileCount}: ${prefix}${entry.name}`);
      zip.file(`${prefix}${entry.name}`,file,{ date:new Date(file.lastModified) });
    };

    try {
      for (const entry of entries) await addEntry(entry);
      checkCancelled();
      const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level:6 }, streamFiles:true },(detail)=>{
        if (!cancelled) progress.update(`Compressing ${detail.percent.toFixed(0)}%${detail.currentFile ? `: ${detail.currentFile}` : ''}`);
      });
      checkCancelled();
      progress.update(`Writing ${name}…`);
      const target = await directoryHandle.getFileHandle(name,{ create:true });
      const writable = await target.createWritable();
      try { await writable.write(blob); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch (_) { /* no-op */ } throw error; }
      progress.close();
      this.onRefresh();
      this.onToast(`Created “${name}”.`,'success');
      return true;
    } catch (error) {
      progress.close();
      if (error?.message === 'ZIP creation cancelled.') this.onToast('ZIP creation cancelled.','info');
      else this.onToast(error?.message || 'The ZIP archive could not be created.','error');
      return false;
    }
  }
}
