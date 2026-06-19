// Capsularius v0.25.0 — Google Drive Session Sync
import { typeForFile } from './filesystem.js';
import { googleDriveSource } from './state.js';

const GOOGLE_CLIENT_ID = '102488628137-d4sc4gp34mht0p961umsl4rbkjv87j9b.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const SESSION_KEY = 'organon-capsularius-google-drive-session-v1';
const SESSION_SAFETY_WINDOW_MS = 30000;

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_URL}"]`);
    const script = existing || document.createElement('script');
    const timeout = window.setTimeout(() => {
      reject(new Error('Google sign-in could not load. Check your connection and reload Capsularius.'));
    }, 12000);

    const complete = () => {
      if (!window.google?.accounts?.oauth2) return;
      window.clearTimeout(timeout);
      resolve();
    };

    if (!existing) {
      script.src = GIS_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', () => {
        window.clearTimeout(timeout);
        reject(new Error('Google sign-in could not load.'));
      }, { once: true });
      document.head.append(script);
      return;
    }

    const poll = window.setInterval(() => {
      if (!window.google?.accounts?.oauth2) return;
      window.clearInterval(poll);
      complete();
    }, 50);
  });
}

function clearSavedSession() {
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* Storage may be unavailable. */ }
}

function readSavedSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.accessToken || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) {
      clearSavedSession();
      return null;
    }
    return saved;
  } catch (_) {
    clearSavedSession();
    return null;
  }
}

function saveSession(accessToken, expiresAt) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken, expiresAt }));
  } catch (_) { /* The Drive connection still works for this page. */ }
}

function driveError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseDriveItem(item, parentSource) {
  const isFolder = item.mimeType === GOOGLE_FOLDER_MIME;
  const modified = item.modifiedTime ? Date.parse(item.modifiedTime) : null;
  const size = item.size === undefined ? null : Number(item.size);

  return {
    id: `google-file:${item.id}`,
    name: item.name,
    kind: isFolder ? 'directory' : 'file',
    fileType: isFolder ? 'directory' : typeForFile(item.name, item.mimeType || ''),
    size: Number.isFinite(size) ? size : null,
    lastModified: Number.isFinite(modified) ? modified : null,
    mimeType: item.mimeType || '',
    cloudSource: isFolder
      ? googleDriveSource('folder', {
        folderId: item.id,
        driveId: parentSource.driveId || null,
        name: item.name,
        parent: parentSource
      })
      : null,
    webViewLink: item.webViewLink || null,
    thumbnailLink: item.thumbnailLink || null
  };
}

export class GoogleDriveService {
  constructor({ state }) {
    this.state = state;
    const saved = readSavedSession();
    this.accessToken = saved?.accessToken || null;
    this.expiresAt = saved?.expiresAt || 0;
    this.state.googleDrive.connected = Boolean(this.accessToken && this.expiresAt > Date.now());
  }

  isConnected() {
    const connected = Boolean(this.accessToken && this.expiresAt > Date.now());
    if (!connected && this.accessToken) this.clearSession();
    return connected;
  }

  clearSession() {
    this.accessToken = null;
    this.expiresAt = 0;
    this.state.googleDrive.connected = false;
    clearSavedSession();
  }

  async connect() {
    await loadGoogleIdentity();

    return new Promise((resolve, reject) => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (response) => {
          if (!response || response.error || !response.access_token) {
            reject(driveError(response?.error_description || response?.error || 'Google Drive access was not granted.'));
            return;
          }
          this.accessToken = response.access_token;
          const lifetimeMs = Math.max(60000, Number(response.expires_in || 3600) * 1000);
          this.expiresAt = Date.now() + lifetimeMs - SESSION_SAFETY_WINDOW_MS;
          this.state.googleDrive.connected = true;
          saveSession(this.accessToken, this.expiresAt);
          resolve(response);
        },
        error_callback: (error) => {
          reject(driveError(error?.message || 'Google sign-in could not be opened.'));
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  async request(path, parameters = {}) {
    if (!this.isConnected()) {
      throw driveError('Google Drive is not connected. Click Connect Google Drive first.', 401);
    }

    const url = new URL(`${DRIVE_API}${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (!response.ok) {
      let message = 'Google Drive could not complete this request.';
      try {
        const body = await response.json();
        message = body?.error?.message || message;
      } catch (_) {
        // The standard status message is sufficient when the response is not JSON.
      }
      if (response.status === 401) {
        this.clearSession();
        message = 'Your Google Drive session has expired. Click Google Drive and connect again.';
      }
      throw driveError(message, response.status);
    }

    return response.json();
  }

  async listAll(path, parameters, itemKey) {
    const items = [];
    let pageToken = null;
    do {
      const page = await this.request(path, { ...parameters, pageToken });
      items.push(...(page[itemKey] || []));
      pageToken = page.nextPageToken || null;
    } while (pageToken);
    return items;
  }

  async listFolderContents(source) {
    const parentId = source.node === 'my-drive' ? 'root' : source.folderId;
    if (!parentId) return [];

    const parameters = {
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)',
      pageSize: 100,
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: source.driveId ? 'drive' : 'user',
      driveId: source.driveId || null
    };

    const files = await this.listAll('/files', parameters, 'files');
    return files.map((file) => parseDriveItem(file, source));
  }

  async listSharedWithMe(source) {
    const files = await this.listAll('/files', {
      q: 'sharedWithMe = true and trashed = false',
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)',
      pageSize: 100,
      orderBy: 'sharedWithMeTime desc',
      corpora: 'user',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    }, 'files');
    return files.map((file) => parseDriveItem(file, source));
  }

  async listSharedDrives(source) {
    const drives = await this.listAll('/drives', {
      fields: 'nextPageToken,drives(id,name)',
      pageSize: 100
    }, 'drives');

    return drives.map((drive) => ({
      id: `google-drive:${drive.id}`,
      name: drive.name,
      kind: 'directory',
      fileType: 'directory',
      size: null,
      lastModified: null,
      cloudSource: googleDriveSource('shared-drive', {
        folderId: drive.id,
        driveId: drive.id,
        name: drive.name,
        parent: source
      })
    }));
  }

  async listSource(source) {
    if (!this.isConnected()) {
      if (source.node === 'root') {
        return [{
          id: 'google-connect',
          name: 'Connect Google Drive',
          kind: 'directory',
          fileType: 'directory',
          size: null,
          lastModified: null,
          cloudSource: googleDriveSource('connect', { parent: source })
        }];
      }
      throw driveError('Google Drive is not connected. Click Connect Google Drive first.', 401);
    }

    if (source.node === 'root') {
      return [
        { id: 'google-my-drive', name: 'My Drive', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('my-drive', { folderId: 'root', parent: source }) },
        { id: 'google-shared-with-me', name: 'Shared with me', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('shared-with-me', { parent: source }) },
        { id: 'google-shared-drives', name: 'Shared drives', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('shared-drives', { parent: source }) }
      ];
    }

    if (source.node === 'shared-drives') return this.listSharedDrives(source);
    if (source.node === 'shared-with-me') return this.listSharedWithMe(source);
    if (source.node === 'connect') return [];
    return this.listFolderContents(source);
  }

  async listTreeChildren(source) {
    const items = await this.listSource(source);
    return items
      .filter((item) => item.kind === 'directory')
      .map((item) => ({
        id: item.id,
        name: item.name,
        source: item.cloudSource,
        colour: '#4285f4',
        icon: source.node === 'root' && item.cloudSource.node === 'connect' ? '↗' : '▰'
      }));
  }
}
