import { GoogleDriveService } from './google-drive.js';

const CLIENT_ID = '102488628137-d4sc4gp34mht0p961umsl4rbkjv87j9b.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const SESSION_KEY = 'organon-capsularius-google-drive-sessions-v2';
const SAFETY_WINDOW = 30000;

function waitForGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') || document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('Google sign-in could not load.')), 12000);
    const done = () => {
      if (!window.google?.accounts?.oauth2) return;
      clearTimeout(timeout);
      resolve();
    };
    if (!script.parentNode) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', done, { once:true });
      script.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Google sign-in could not load.')); }, { once:true });
      document.head.append(script);
    } else {
      const timer = setInterval(() => {
        if (!window.google?.accounts?.oauth2) return;
        clearInterval(timer);
        done();
      }, 50);
    }
  });
}

async function rememberedToken(email) {
  await waitForGoogle();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      login_hint: email || undefined,
      callback: (response) => {
        if (!response?.access_token || response.error) {
          reject(new Error(response?.error_description || response?.error || 'Google could not reconnect this account automatically.'));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max(60000, Number(response.expires_in || 3600) * 1000) - SAFETY_WINDOW
        });
      },
      error_callback: (error) => reject(new Error(error?.message || 'Google reconnect could not be started.'))
    });
    client.requestAccessToken({ prompt: '', login_hint: email || undefined });
  });
}

const originalReconnect = GoogleDriveService.prototype.reconnectAccount;
GoogleDriveService.prototype.reconnectAccount = async function reconnectRememberedAccount(accountId) {
  await this.ready;
  const expected = this.account(accountId);
  if (!expected) throw new Error('That saved Google Drive account no longer exists.');
  try {
    const session = await rememberedToken(expected.email);
    const identity = await this.identityFromToken(session.accessToken);
    if (`google:${identity.permissionId}` !== accountId) throw new Error('The remembered Google account did not match this Drive.');
    this.sessions[accountId] = session;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sessions: this.sessions })); } catch (_) { /* session storage is optional */ }
    return expected;
  } catch (_) {
    return originalReconnect.call(this, accountId);
  }
};
