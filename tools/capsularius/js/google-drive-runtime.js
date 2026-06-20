import { GoogleDriveService as BrowserGoogleDriveService } from './google-drive.js';

function desktopApi() {
  return window.capsulariusDesktop?.isDesktop ? window.capsulariusDesktop : null;
}

function validSession(session) {
  return Boolean(session?.accessToken && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now());
}

export class GoogleDriveService extends BrowserGoogleDriveService {
  async loadAccounts() {
    const accounts = await super.loadAccounts();
    const desktop = desktopApi();
    if (!desktop?.restoreGoogleDriveSessions || accounts.length === 0) return accounts;

    try {
      const sessions = await desktop.restoreGoogleDriveSessions(accounts.map((account) => account.id));
      for (const [accountId, session] of Object.entries(sessions || {})) {
        if (validSession(session)) this.sessions[accountId] = session;
      }
    } catch (error) {
      console.error('Capsularius could not restore saved Google Drive desktop sessions.', error);
    }
    return accounts;
  }

  async requestToken({ accountId = null } = {}) {
    const desktop = desktopApi();
    if (!desktop?.requestGoogleDriveToken) return super.requestToken();
    const response = await desktop.requestGoogleDriveToken({ accountId });
    if (!validSession(response)) throw new Error('Google Drive did not return a usable desktop session.');
    return response;
  }

  async reconnectAccount(accountId) {
    await this.ready;
    const expected = this.account(accountId);
    if (!expected) throw new Error('That saved Google Drive account no longer exists.');

    const session = await this.requestToken({ accountId });
    const identity = session.identity || await this.identityFromToken(session.accessToken);
    const selectedId = `google:${identity.permissionId}`;
    if (selectedId !== accountId) {
      throw new Error(`You selected ${identity.email || identity.displayName || 'a different account'}. Use Add Google Drive for that account, or choose ${expected.label}.`);
    }
    this.sessions[accountId] = { accessToken:session.accessToken, expiresAt:session.expiresAt };
    return expected;
  }

  async removeAccount(accountId) {
    await super.removeAccount(accountId);
    const desktop = desktopApi();
    if (desktop?.forgetGoogleDriveAccount) await desktop.forgetGoogleDriveAccount(accountId);
  }

  async request(accountId, path, parameters = {}) {
    const desktop = desktopApi();
    if (desktop?.requestGoogleDriveToken && !validSession(this.sessions[accountId])) {
      const session = await this.requestToken({ accountId });
      this.sessions[accountId] = { accessToken:session.accessToken, expiresAt:session.expiresAt };
    }
    return super.request(accountId, path, parameters);
  }
}
