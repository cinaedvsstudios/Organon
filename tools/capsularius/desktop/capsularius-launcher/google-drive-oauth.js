const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { safeStorage } = require('electron');

const GOOGLE_CLIENT_ID = '102488628137-fsgdn04bu1s49adovtbpstbdnqp3smj5.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName,emailAddress)';
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

function oauthError(message) {
  return new Error(message);
}

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function randomToken(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

function codeChallenge(verifier) {
  return base64Url(crypto.createHash('sha256').update(verifier).digest());
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) { /* The status is still meaningful. */ }
  if (!response.ok) throw oauthError(payload?.error_description || payload?.error || 'Google OAuth could not complete the token request.');
  return payload || {};
}

async function identityFromAccessToken(accessToken) {
  const response = await fetch(GOOGLE_DRIVE_ABOUT_URL, { headers: { Authorization:`Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.user?.permissionId) throw oauthError('Google Drive did not return the selected account identity.');
  return {
    permissionId: payload.user.permissionId,
    displayName: payload.user.displayName || '',
    email: payload.user.emailAddress || ''
  };
}

function startLoopbackListener() {
  const state = randomToken();
  const verifier = randomToken(64);
  let complete;
  let fail;
  let settled = false;
  let timeout;
  const result = new Promise((resolve, reject) => { complete = resolve; fail = reject; });

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname !== '/oauth2/callback') {
      response.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
      response.end('Capsularius OAuth callback not found.');
      return;
    }

    const receivedState = requestUrl.searchParams.get('state');
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    const errorDescription = requestUrl.searchParams.get('error_description');

    response.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' });
    response.end('<!doctype html><meta charset="utf-8"><title>Capsularius</title><body style="font-family:system-ui;background:#1e201c;color:#f6f0df;padding:32px"><h2>Google Drive connected</h2><p>You can close this tab and return to Capsularius.</p></body>');

    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    server.close();
    if (receivedState !== state) {
      fail(oauthError('Google OAuth returned an invalid state value. Please try connecting again.'));
      return;
    }
    if (error || !code) {
      fail(oauthError(errorDescription || error || 'Google Drive access was not granted.'));
      return;
    }
    complete({ code, verifier, redirectUri });
  });

  let redirectUri = '';
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      redirectUri = `http://127.0.0.1:${address.port}/oauth2/callback`;
      timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        server.close();
        fail(oauthError('Google Drive sign-in timed out. Please try again.'));
      }, OAUTH_TIMEOUT_MS);
      resolve({ state, verifier, redirectUri, result });
    });
  });

  return ready;
}

function sessionFromToken(token) {
  const lifetime = Math.max(60000, Number(token.expires_in || 3600) * 1000);
  return { accessToken:token.access_token, expiresAt:Date.now() + lifetime - 30000 };
}

function createTokenStore(app) {
  const storePath = path.join(app.getPath('userData'), 'capsularius-google-drive-tokens.bin');

  function ensureEncryption() {
    if (!safeStorage.isEncryptionAvailable()) throw oauthError('Windows encryption is unavailable, so Capsularius cannot safely save Google Drive sign-in tokens.');
  }

  async function read() {
    ensureEncryption();
    try {
      const encrypted = await fs.readFile(storePath);
      const text = safeStorage.decryptString(encrypted);
      const parsed = JSON.parse(text);
      return parsed?.accounts && typeof parsed.accounts === 'object' ? parsed : { accounts:{} };
    } catch (error) {
      if (error?.code === 'ENOENT') return { accounts:{} };
      throw oauthError('Capsularius could not read its encrypted Google Drive sign-in store.');
    }
  }

  async function write(value) {
    ensureEncryption();
    await fs.mkdir(path.dirname(storePath), { recursive:true });
    const encrypted = safeStorage.encryptString(JSON.stringify(value));
    const temporaryPath = `${storePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, encrypted);
    await fs.rename(temporaryPath, storePath);
  }

  return {
    async get(accountId) {
      const store = await read();
      return store.accounts[accountId] || null;
    },
    async set(accountId, refreshToken) {
      const store = await read();
      store.accounts[accountId] = { refreshToken, updatedAt:Date.now() };
      await write(store);
    },
    async remove(accountId) {
      const store = await read();
      delete store.accounts[accountId];
      await write(store);
    }
  };
}

function createGoogleDriveOAuth({ app, shell }) {
  const tokenStore = createTokenStore(app);

  async function refresh(accountId) {
    const saved = await tokenStore.get(accountId);
    if (!saved?.refreshToken) return null;
    try {
      const token = await postForm(GOOGLE_TOKEN_URL, {
        client_id: GOOGLE_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: saved.refreshToken
      });
      if (!token.access_token) throw oauthError('Google did not return an access token.');
      return sessionFromToken(token);
    } catch (error) {
      if (/invalid_grant|revoked|expired/i.test(error.message || '')) await tokenStore.remove(accountId).catch(() => undefined);
      return null;
    }
  }

  async function restore(accountIds) {
    const result = {};
    for (const accountId of Array.isArray(accountIds) ? accountIds : []) {
      const session = await refresh(accountId);
      if (session) result[accountId] = session;
    }
    return result;
  }

  async function requestInteractive(expectedAccountId = null) {
    const listener = await startLoopbackListener();
    const authorization = new URL(GOOGLE_AUTH_URL);
    authorization.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authorization.searchParams.set('redirect_uri', listener.redirectUri);
    authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('scope', GOOGLE_DRIVE_SCOPE);
    authorization.searchParams.set('access_type', 'offline');
    authorization.searchParams.set('prompt', 'select_account consent');
    authorization.searchParams.set('state', listener.state);
    authorization.searchParams.set('code_challenge', codeChallenge(listener.verifier));
    authorization.searchParams.set('code_challenge_method', 'S256');

    await shell.openExternal(authorization.toString());
    const callback = await listener.result;
    const token = await postForm(GOOGLE_TOKEN_URL, {
      client_id: GOOGLE_CLIENT_ID,
      code: callback.code,
      code_verifier: callback.verifier,
      grant_type: 'authorization_code',
      redirect_uri: callback.redirectUri
    });
    if (!token.access_token) throw oauthError('Google did not return an access token.');

    const identity = await identityFromAccessToken(token.access_token);
    const accountId = `google:${identity.permissionId}`;
    if (expectedAccountId && accountId !== expectedAccountId) {
      throw oauthError(`You selected ${identity.email || identity.displayName || 'a different account'}. Choose the saved Google Drive account instead.`);
    }
    if (!token.refresh_token) throw oauthError('Google did not return a reusable desktop sign-in token. Remove Capsularius from Google Account access and connect the account again.');

    await tokenStore.set(accountId, token.refresh_token);
    return { ...sessionFromToken(token), identity, accountId };
  }

  return {
    async request({ accountId = null } = {}) {
      if (accountId) {
        const session = await refresh(accountId);
        if (session) return { ...session, accountId, identity:null };
      }
      return requestInteractive(accountId);
    },
    restore,
    forget: (accountId) => tokenStore.remove(accountId)
  };
}

module.exports = { createGoogleDriveOAuth };
