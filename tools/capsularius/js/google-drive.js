// Capsularius v0.26.0 — Drive Accounts & Persistent Mount Verification
import { typeForFile } from './filesystem.js';
import { googleDriveSource } from './state.js';
import { persistence as defaultPersistence } from './persistence.js';

const GOOGLE_CLIENT_ID = '102488628137-d4sc4gp34mht0p961umsl4rbkjv87j9b.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const SESSION_KEY = 'organon-capsularius-google-drive-sessions-v2';
const LEGACY_SESSION_KEY = 'organon-capsularius-google-drive-session-v1';
const SESSION_SAFETY_WINDOW_MS = 30000;

function driveError(message, status) { const error = new Error(message); error.status = status; return error; }

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_URL}"]`);
    const script = existing || document.createElement('script');
    const timeout = window.setTimeout(() => reject(driveError('Google sign-in could not load. Check your connection and reload Capsularius.')), 12000);
    const complete = () => { if (!window.google?.accounts?.oauth2) return; window.clearTimeout(timeout); resolve(); };
    if (!existing) {
      script.src = GIS_URL; script.async = true; script.defer = true;
      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', () => { window.clearTimeout(timeout); reject(driveError('Google sign-in could not load.')); }, { once: true });
      document.head.append(script);
      return;
    }
    const poll = window.setInterval(() => { if (!window.google?.accounts?.oauth2) return; window.clearInterval(poll); complete(); }, 50);
  });
}

function validSession(value) { return Boolean(value?.accessToken && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()); }
function readSessionStore() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const sessions = parsed?.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {};
    const legacyRaw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (validSession(legacy) && !sessions.legacy) sessions.legacy = legacy;
    for (const [id, session] of Object.entries(sessions)) if (!validSession(session)) delete sessions[id];
    return sessions;
  } catch (_) { return {}; }
}
function writeSessionStore(sessions) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sessions })); sessionStorage.removeItem(LEGACY_SESSION_KEY); } catch (_) { /* session persistence is optional */ }
}
function uniqueLabel(accounts, desired, exceptId = null) {
  const base = String(desired || 'Google Drive').trim() || 'Google Drive';
  const labels = new Set(accounts.filter((account) => account.id !== exceptId).map((account) => account.label.toLocaleLowerCase()));
  if (!labels.has(base.toLocaleLowerCase())) return base;
  let number = 2;
  while (labels.has(`${base} (${number})`.toLocaleLowerCase())) number += 1;
  return `${base} (${number})`;
}

function parseDriveItem(item, parentSource) {
  const isFolder = item.mimeType === GOOGLE_FOLDER_MIME;
  const modified = item.modifiedTime ? Date.parse(item.modifiedTime) : null;
  const size = item.size === undefined ? null : Number(item.size);
  return {
    id: `google-file:${parentSource.accountId}:${item.id}`,
    name: item.name,
    kind: isFolder ? 'directory' : 'file',
    fileType: isFolder ? 'directory' : typeForFile(item.name, item.mimeType || ''),
    size: Number.isFinite(size) ? size : null,
    lastModified: Number.isFinite(modified) ? modified : null,
    mimeType: item.mimeType || '',
    cloudSource: isFolder ? googleDriveSource('folder', { accountId: parentSource.accountId, folderId: item.id, driveId: parentSource.driveId || null, name: item.name, parent: parentSource }) : null,
    webViewLink: item.webViewLink || null,
    thumbnailLink: item.thumbnailLink || null
  };
}

export class GoogleDriveService {
  constructor({ state, persistence = defaultPersistence }) {
    this.state = state;
    this.persistence = persistence;
    this.sessions = readSessionStore();
    this.ready = this.loadAccounts();
  }

  async loadAccounts() {
    const saved = await this.persistence.loadGoogleDriveAccounts();
    this.state.googleDrive.accounts = (Array.isArray(saved) ? saved : [])
      .filter((account) => account?.id && account?.label)
      .map((account) => ({ id: account.id, label: account.label, email: account.email || '', displayName: account.displayName || account.label, createdAt: Number(account.createdAt) || Date.now(), updatedAt: Number(account.updatedAt) || Date.now() }));
    this.state.googleDrive.ready = true;
    if (this.state.googleDrive.accounts.length === 0 && validSession(this.sessions.legacy)) {
      try {
        const identity = await this.identityFromToken(this.sessions.legacy.accessToken);
        const account = this.makeAccount(identity);
        this.sessions[account.id] = this.sessions.legacy;
        delete this.sessions.legacy;
        writeSessionStore(this.sessions);
        this.state.googleDrive.accounts = [account];
        await this.persistAccounts();
      } catch (_) { /* Existing token may already be expired or offline. */ }
    }
    return this.accounts();
  }

  accounts() { return [...this.state.googleDrive.accounts].sort((a, b) => a.createdAt - b.createdAt); }
  account(accountId) { return this.state.googleDrive.accounts.find((account) => account.id === accountId) || null; }
  isConnected(accountId) { return validSession(this.sessions[accountId]); }
  isAnyConnected() { return this.accounts().some((account) => this.isConnected(account.id)); }

  async persistAccounts() { await this.persistence.saveGoogleDriveAccounts(this.accounts()); }

  makeAccount(identity) {
    const id = `google:${identity.permissionId}`;
    const existing = this.account(id);
    return existing || {
      id,
      label: uniqueLabel(this.accounts(), identity.displayName || identity.email || 'Google Drive'),
      email: identity.email || '',
      displayName: identity.displayName || identity.email || 'Google Drive',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  async identityFromToken(accessToken) {
    const response = await fetch(`${DRIVE_API}/about?fields=user(permissionId,displayName,emailAddress)`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw driveError('Capsularius could not identify the Google Drive account.', response.status);
    const body = await response.json();
    const user = body?.user || {};
    if (!user.permissionId) throw driveError('Google did not return an account identity for this Drive session.');
    return { permissionId: user.permissionId, displayName: user.displayName || '', email: user.emailAddress || '' };
  }

  async requestToken() {
    await loadGoogleIdentity();
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (response) => {
          if (!response || response.error || !response.access_token) {
            reject(driveError(response?.error_description || response?.error || 'Google Drive access was not granted.'));
            return;
          }
          const lifetime = Math.max(60000, Number(response.expires_in || 3600) * 1000);
          resolve({ accessToken: response.access_token, expiresAt: Date.now() + lifetime - SESSION_SAFETY_WINDOW_MS });
        },
        error_callback: (error) => reject(driveError(error?.message || 'Google sign-in could not be opened.'))
      });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }

  async addAccount() {
    await this.ready;
    const session = await this.requestToken();
    const identity = await this.identityFromToken(session.accessToken);
    const account = this.makeAccount(identity);
    const alreadyKnown = Boolean(this.account(account.id));
    this.sessions[account.id] = session;
    writeSessionStore(this.sessions);
    if (!alreadyKnown) {
      this.state.googleDrive.accounts.push(account);
      await this.persistAccounts();
    }
    return { account: this.account(account.id) || account, alreadyKnown };
  }

  async reconnectAccount(accountId) {
    await this.ready;
    const expected = this.account(accountId);
    if (!expected) throw driveError('That saved Google Drive account no longer exists.');
    const session = await this.requestToken();
    const identity = await this.identityFromToken(session.accessToken);
    const selectedId = `google:${identity.permissionId}`;
    if (selectedId !== accountId) {
      throw driveError(`You selected ${identity.email || identity.displayName || 'a different account'}. Use Add Google Drive for that account, or choose ${expected.label}.`);
    }
    this.sessions[accountId] = session;
    writeSessionStore(this.sessions);
    return expected;
  }

  async renameAccount(accountId, requestedLabel) {
    await this.ready;
    const account = this.account(accountId);
    if (!account) throw driveError('That Google Drive account no longer exists.');
    account.label = uniqueLabel(this.accounts(), requestedLabel, accountId);
    account.updatedAt = Date.now();
    await this.persistAccounts();
    return account;
  }

  async removeAccount(accountId) {
    await this.ready;
    this.state.googleDrive.accounts = this.state.googleDrive.accounts.filter((account) => account.id !== accountId);
    delete this.sessions[accountId];
    writeSessionStore(this.sessions);
    await this.persistAccounts();
  }

  clearExpiredSessions() {
    let changed = false;
    for (const [id, session] of Object.entries(this.sessions)) {
      if (validSession(session)) continue;
      delete this.sessions[id];
      changed = true;
    }
    if (changed) writeSessionStore(this.sessions);
  }

  async request(accountId, path, parameters = {}) {
    this.clearExpiredSessions();
    const session = this.sessions[accountId];
    if (!validSession(session)) throw driveError('This Google Drive account needs reconnecting. Right-click it and choose Reconnect.', 401);
    const url = new URL(`${DRIVE_API}${path}`);
    for (const [key, value] of Object.entries(parameters)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    if (!response.ok) {
      let message = 'Google Drive could not complete this request.';
      try { message = (await response.json())?.error?.message || message; } catch (_) { /* message is sufficient */ }
      if (response.status === 401) {
        delete this.sessions[accountId];
        writeSessionStore(this.sessions);
        message = 'Your Google Drive session has expired. Right-click the Drive and choose Reconnect.';
      }
      throw driveError(message, response.status);
    }
    return response.json();
  }

  async listAll(accountId, path, parameters, itemKey) {
    const items = [];
    let pageToken = null;
    do {
      const page = await this.request(accountId, path, { ...parameters, pageToken });
      items.push(...(page[itemKey] || []));
      pageToken = page.nextPageToken || null;
    } while (pageToken);
    return items;
  }

  childrenForAccount(source) {
    const parent = googleDriveSource('account', { accountId: source.accountId, parent: googleDriveSource('root') });
    if (!this.isConnected(source.accountId)) return [{ id: `google-connect:${source.accountId}`, name: 'Connect Google Drive', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('connect', { accountId: source.accountId, parent }) }];
    return [
      { id: `google-my-drive:${source.accountId}`, name: 'My Drive', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('my-drive', { accountId: source.accountId, folderId: 'root', parent }) },
      { id: `google-shared-with-me:${source.accountId}`, name: 'Shared with me', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('shared-with-me', { accountId: source.accountId, parent }) },
      { id: `google-shared-drives:${source.accountId}`, name: 'Shared drives', kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('shared-drives', { accountId: source.accountId, parent }) }
    ];
  }

  async listFolderContents(source) {
    const parentId = source.node === 'my-drive' ? 'root' : source.folderId;
    if (!parentId) return [];
    const files = await this.listAll(source.accountId, '/files', {
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)',
      pageSize: 100,
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: source.driveId ? 'drive' : 'user',
      driveId: source.driveId || null
    }, 'files');
    return files.map((file) => parseDriveItem(file, source));
  }

  async listSharedWithMe(source) {
    const files = await this.listAll(source.accountId, '/files', {
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
    const drives = await this.listAll(source.accountId, '/drives', { fields: 'nextPageToken,drives(id,name)', pageSize: 100 }, 'drives');
    return drives.map((drive) => ({
      id: `google-drive:${source.accountId}:${drive.id}`,
      name: drive.name,
      kind: 'directory', fileType: 'directory', size: null, lastModified: null,
      cloudSource: googleDriveSource('shared-drive', { accountId: source.accountId, folderId: drive.id, driveId: drive.id, name: drive.name, parent: source })
    }));
  }

  async listSource(source) {
    await this.ready;
    if (source.node === 'root') return this.accounts().map((account) => ({ id: `google-account:${account.id}`, name: account.label, kind: 'directory', fileType: 'directory', size: null, lastModified: null, cloudSource: googleDriveSource('account', { accountId: account.id, name: account.label, parent: source }) }));
    if (!source.accountId) throw driveError('Choose Add Google Drive to connect an account.');
    if (source.node === 'account') return this.childrenForAccount(source);
    if (source.node === 'connect') return [];
    if (!this.isConnected(source.accountId)) throw driveError('This Google Drive account needs reconnecting. Right-click it and choose Reconnect.', 401);
    if (source.node === 'shared-drives') return this.listSharedDrives(source);
    if (source.node === 'shared-with-me') return this.listSharedWithMe(source);
    return this.listFolderContents(source);
  }

  async listTreeChildren(source) {
    const items = await this.listSource(source);
    return items.filter((item) => item.kind === 'directory').map((item) => ({ id: item.id, name: item.name, source: item.cloudSource, colour: '#4285f4', icon: item.cloudSource.node === 'connect' ? '↗' : '▰' }));
  }
}
