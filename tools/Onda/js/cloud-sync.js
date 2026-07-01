(function () {
    'use strict';

    const CONFIG_KEY = 'ondaCloudSyncConfigV1';
    const STATUS_KEY = 'ondaCloudSyncLastStatusV1';
    const DISMISSED_KEY = 'ondaCloudSetupDismissedV1';
    const DEFAULT_ENDPOINT = '/.netlify/functions/onda-sync';
    const REQUEST_TIMEOUT_MS = 15000;
    const CREDENTIAL_ID = 'onda-cloud-sync';
    const CREDENTIAL_NAME = 'Onda Cloud Sync';

    let selectedDeviceId = '';
    let knownDevices = [];
    let sessionSecret = '';
    let attemptedCredentialRestore = false;

    const byId = (id) => document.getElementById(id);

    function parseJson(value, fallback) {
        try {
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeDeviceId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
    }

    function readRawConfig() {
        return parseJson(localStorage.getItem(CONFIG_KEY), {}) || {};
    }

    function readConfig() {
        const raw = readRawConfig();
        return {
            endpoint: raw.endpoint || DEFAULT_ENDPOINT,
            deviceId: raw.deviceId || '',
            deviceLabel: raw.deviceLabel || '',
            autoCheckOnStartup: raw.autoCheckOnStartup !== false
        };
    }

    function writeConfig(changes) {
        const raw = readRawConfig();
        const next = {
            ...raw,
            ...changes,
            endpoint: changes?.endpoint || raw.endpoint || DEFAULT_ENDPOINT,
            updatedAt: new Date().toISOString()
        };
        delete next.secret;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
        updateStatusSummary();
        return readConfig();
    }

    function readLegacySecret() {
        const secret = readRawConfig().secret;
        return typeof secret === 'string' ? secret.trim() : '';
    }

    function clearLegacySecret() {
        const raw = readRawConfig();
        if (!Object.prototype.hasOwnProperty.call(raw, 'secret')) return;
        delete raw.secret;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(raw));
    }

    function secretInput() {
        return byId('onda-cloud-secret-input');
    }

    function rememberSecretForSession(value) {
        const secret = String(value || '').trim();
        if (secret) sessionSecret = secret;
        return sessionSecret;
    }

    function currentSecret() {
        const typed = secretInput()?.value || '';
        if (typed.trim()) return rememberSecretForSession(typed);
        if (sessionSecret) return sessionSecret;
        const legacy = readLegacySecret();
        if (legacy) return rememberSecretForSession(legacy);
        return '';
    }

    function preparePasswordField() {
        const input = secretInput();
        if (!input) return;
        input.name = 'onda-cloud-secret';
        input.autocomplete = 'current-password';
        input.removeAttribute('data-1p-ignore');
        input.removeAttribute('data-bwignore');
        input.removeAttribute('data-form-type');
        input.removeAttribute('data-lpignore');
        input.addEventListener('input', () => rememberSecretForSession(input.value));
    }

    async function restoreSecretFromPasswordManager() {
        if (currentSecret() || attemptedCredentialRestore) return currentSecret();
        attemptedCredentialRestore = true;
        if (!navigator.credentials || typeof window.PasswordCredential !== 'function') return '';

        try {
            const credential = await navigator.credentials.get({ password: true, mediation: 'optional' });
            if (!credential || credential.id !== CREDENTIAL_ID || !credential.password) return '';
            if (secretInput()) secretInput().value = credential.password;
            return rememberSecretForSession(credential.password);
        } catch (error) {
            return '';
        }
    }

    async function storeSecretInPasswordManager(secret) {
        if (!secret || !navigator.credentials || typeof window.PasswordCredential !== 'function') return false;
        try {
            const credential = new window.PasswordCredential({
                id: CREDENTIAL_ID,
                name: CREDENTIAL_NAME,
                password: secret
            });
            await navigator.credentials.store(credential);
            return true;
        } catch (error) {
            return false;
        }
    }

    async function requireSecret() {
        const alreadyKnown = currentSecret();
        if (alreadyKnown) return alreadyKnown;
        const restored = await restoreSecretFromPasswordManager();
        if (restored) return restored;
        throw new Error('Enter the Onda sync secret first. Save Setup asks Chrome to remember it.');
    }

    function setStatus(message, isError) {
        const status = {
            message: String(message || ''),
            isError: !!isError,
            at: new Date().toISOString()
        };
        localStorage.setItem(STATUS_KEY, JSON.stringify(status));

        const popup = byId('onda-cloud-status-box');
        if (popup) {
            popup.innerHTML = `${status.isError ? '⚠️' : '☁️'} ${escapeHtml(status.message)}<br><span class="onda-cloud-status-time">${new Date(status.at).toLocaleString()}</span>`;
            popup.classList.toggle('is-error', status.isError);
        }

        const settingsStatus = byId('settings-cloud-status');
        if (settingsStatus) {
            settingsStatus.textContent = `${status.isError ? 'Cloud error: ' : 'Cloud status: '}${status.message}`;
            settingsStatus.classList.toggle('is-error', status.isError);
        }

        updateStatusSummary();
        if (typeof window.showToast === 'function') window.showToast(status.message);
    }

    function updateStatusSummary() {
        const config = readConfig();
        const last = parseJson(localStorage.getItem(STATUS_KEY), null);
        const device = config.deviceId ? `${config.deviceLabel || config.deviceId} (${config.deviceId})` : 'not set';
        const lastText = last ? `${last.message} · ${new Date(last.at).toLocaleString()}` : 'No cloud sync yet.';

        document.querySelectorAll('[data-onda-cloud-status-line]').forEach((element) => {
            element.innerHTML = `Device: <strong>${escapeHtml(device)}</strong><br>Last cloud action: ${escapeHtml(lastText)}`;
        });

        const settingsStatus = byId('settings-cloud-status');
        if (settingsStatus && !last) settingsStatus.textContent = `Cloud device: ${device}`;
    }

    async function request(action, payload) {
        const config = readConfig();
        const secret = payload?.secret || await requireSecret();
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(config.endpoint || DEFAULT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload, secret }),
                signal: controller.signal
            });
            const text = await response.text();
            const data = parseJson(text, null);
            if (!response.ok || !data || data.ok === false) {
                throw new Error(data?.error || `Cloud request failed with HTTP ${response.status}. Confirm Netlify is deploying tools/Onda and its function bundle.`);
            }
            return data;
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error('Cloud request timed out. Check the connection and try again.');
            throw error;
        } finally {
            window.clearTimeout(timer);
        }
    }

    function getBackupPayload() {
        if (typeof window.saveLocalUiStateCheckpoint === 'function') window.saveLocalUiStateCheckpoint('cloud-sync-before-build');
        if (typeof window.buildEverythingExport === 'function') return window.buildEverythingExport();
        if (typeof window.buildLibraryExport === 'function') {
            return {
                app: 'Onda Media Player',
                type: 'onda-full-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                library: window.buildLibraryExport({ streamingOnly: false })
            };
        }
        throw new Error('This Onda build does not expose a backup builder.');
    }

    function applyBackupPayload(payload) {
        if (!payload || typeof payload !== 'object') throw new Error('Cloud profile had no usable backup JSON.');
        if (typeof window.applyImportedSettingsJson === 'function') {
            window.applyImportedSettingsJson(payload);
        } else if (payload.library && typeof window.importOndaLibrary === 'function') {
            window.importOndaLibrary(payload.library);
        } else if (payload.type === 'onda-library' && typeof window.importOndaLibrary === 'function') {
            window.importOndaLibrary(payload);
        } else {
            throw new Error('This Onda build does not expose an import function.');
        }
        if (typeof window.saveActiveLibraryState === 'function') window.saveActiveLibraryState('cloud-load-device');
        if (typeof window.flushActiveLibraryState === 'function') window.flushActiveLibraryState('cloud-load-device-flush');
    }

    function trackCount() {
        try {
            if (window.virtualLibrary && typeof window.virtualLibrary === 'object') return Object.keys(window.virtualLibrary).length;
        } catch (error) {}
        const raw = localStorage.getItem('ondaActiveLibraryV1') || localStorage.getItem('ondaActiveLibraryLastGoodV1') || localStorage.getItem('ondaActiveLibraryBackupV1');
        const parsed = parseJson(raw, null);
        const tracks = parsed?.library?.tracks || parsed?.tracks;
        return tracks && typeof tracks === 'object' ? Object.keys(tracks).length : 0;
    }

    function hasLocalState() {
        return [
            'ondaActiveLibraryV1',
            'ondaActiveLibraryBackupV1',
            'ondaActiveLibraryLastGoodV1',
            'ondaVisualizerPresetsV1',
            'ondaActiveVisualizerStackV1',
            CONFIG_KEY
        ].some((key) => !!localStorage.getItem(key)) || trackCount() > 0;
    }

    async function openSetupWizard(reason) {
        const config = readConfig();
        selectedDeviceId = config.deviceId || selectedDeviceId || '';
        if (byId('onda-cloud-device-id')) byId('onda-cloud-device-id').value = config.deviceId || '';
        if (byId('onda-cloud-device-label')) byId('onda-cloud-device-label').value = config.deviceLabel || '';

        const warning = byId('onda-cloud-startup-warning');
        if (warning) {
            warning.classList.toggle('u-hidden', !reason);
            warning.textContent = reason || '';
        }

        byId('onda-cloud-modal-overlay')?.classList.add('open');
        byId('onda-cloud-setup-modal')?.classList.add('open');
        updateStatusSummary();
        await restoreSecretFromPasswordManager();
    }

    function closeSetupWizard() {
        byId('onda-cloud-modal-overlay')?.classList.remove('open');
        byId('onda-cloud-setup-modal')?.classList.remove('open');
        localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    }

    function renderDeviceList(devices) {
        const list = byId('onda-cloud-device-list');
        if (!list) return;
        knownDevices = Array.isArray(devices) ? devices : [];

        if (!knownDevices.length) {
            list.innerHTML = '<div class="onda-cloud-device-meta">No cloud device profiles found yet. Create one below, for example phone, laptop, or work-laptop.</div>';
            return;
        }

        list.innerHTML = '';
        knownDevices.forEach((device) => {
            const id = sanitizeDeviceId(device.id || device.deviceId || '');
            if (!id) return;
            const label = String(device.label || device.deviceLabel || id);
            const date = device.lastSync || device.updatedAt || device.savedAt || '';
            const count = Number.isFinite(Number(device.trackCount)) ? `${device.trackCount} tracks` : 'track count unknown';
            const row = document.createElement('div');
            row.className = `onda-cloud-device-row${selectedDeviceId === id ? ' selected' : ''}`;
            row.innerHTML = `
                <div class="onda-cloud-device-marker">◉</div>
                <div>
                    <div class="onda-cloud-device-name">${escapeHtml(label)}</div>
                    <div class="onda-cloud-device-meta">${escapeHtml(id)} · ${escapeHtml(count)}${date ? ` · ${escapeHtml(new Date(date).toLocaleString())}` : ''}</div>
                </div>
                <button type="button" class="btn-pill">Use</button>
            `;
            row.addEventListener('click', () => chooseDevice(id, label));
            row.querySelector('button')?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                chooseDevice(id, label);
            });
            list.appendChild(row);
        });
    }

    function chooseDevice(id, label) {
        selectedDeviceId = sanitizeDeviceId(id);
        if (!selectedDeviceId) return;
        const deviceLabel = String(label || selectedDeviceId).trim() || selectedDeviceId;
        if (byId('onda-cloud-device-id')) byId('onda-cloud-device-id').value = selectedDeviceId;
        if (byId('onda-cloud-device-label')) byId('onda-cloud-device-label').value = deviceLabel;
        writeConfig({ deviceId: selectedDeviceId, deviceLabel });
        renderDeviceList(knownDevices);
        setStatus(`Selected cloud device ${deviceLabel}.`);
    }

    async function listDevices() {
        try {
            const secret = await requireSecret();
            const result = await request('list-devices', { secret });
            renderDeviceList(result.devices || []);
            setStatus(`Loaded ${result.devices?.length || 0} cloud device profile(s).`);
        } catch (error) {
            setStatus(error.message || String(error), true);
        }
    }

    async function saveSetup({ announce = true } = {}) {
        try {
            const secret = await requireSecret();
            const deviceId = sanitizeDeviceId(byId('onda-cloud-device-id')?.value || selectedDeviceId);
            const deviceLabel = String(byId('onda-cloud-device-label')?.value || deviceId).trim() || deviceId;
            if (!deviceId) throw new Error('Choose or type a device profile id first.');

            selectedDeviceId = deviceId;
            const savedToPasswordManager = await storeSecretInPasswordManager(secret);
            if (savedToPasswordManager) clearLegacySecret();
            writeConfig({ deviceId, deviceLabel });

            if (announce) {
                setStatus(savedToPasswordManager
                    ? `Setup saved for ${deviceLabel}. Chrome password storage was requested.`
                    : `Setup saved for ${deviceLabel}. This browser did not confirm password-manager storage yet.`);
            }
            return readConfig();
        } catch (error) {
            setStatus(error.message || String(error), true);
            return null;
        }
    }

    async function testConnection() {
        try {
            const secret = await requireSecret();
            const result = await request('test', { secret });
            setStatus(result.message || 'Connection OK.');
        } catch (error) {
            setStatus(error.message || String(error), true);
        }
    }

    async function saveDevice() {
        try {
            const config = await saveSetup({ announce: false });
            if (!config?.deviceId) {
                await openSetupWizard('Choose a device profile before saving to cloud.');
                return;
            }
            const data = getBackupPayload();
            const count = data?.library?.tracks ? Object.keys(data.library.tracks).length : trackCount();
            const result = await request('save-device', {
                deviceId: config.deviceId,
                deviceLabel: config.deviceLabel || config.deviceId,
                data,
                trackCount: count,
                createSnapshot: true
            });
            renderDeviceList(result.devices || knownDevices);
            setStatus(`Saved ${config.deviceLabel || config.deviceId} to cloud · ${result.trackCount ?? count} tracks.`);
        } catch (error) {
            setStatus(error.message || String(error), true);
        }
    }

    async function loadDevice() {
        try {
            const secret = await requireSecret();
            const config = readConfig();
            const deviceId = sanitizeDeviceId(byId('onda-cloud-device-id')?.value || selectedDeviceId || config.deviceId);
            const deviceLabel = String(byId('onda-cloud-device-label')?.value || config.deviceLabel || deviceId).trim() || deviceId;
            if (!deviceId) {
                await openSetupWizard('Choose a device profile before loading from cloud.');
                return;
            }

            writeConfig({ deviceId, deviceLabel });
            const result = await request('load-device', { deviceId, secret });
            if (!result.data) throw new Error('No backup exists for that device profile yet.');

            const confirmed = window.confirm(`Load cloud library for ${deviceLabel}? This restores catalogue, playlists, settings and artwork references. Audio files stay local to this device and may need relinking.`);
            if (!confirmed) return;

            applyBackupPayload(result.data);
            setStatus(`Loaded ${deviceLabel} from cloud. Local audio files were not transferred.`);
            closeSetupWizard();
        } catch (error) {
            setStatus(error.message || String(error), true);
        }
    }

    function maybePromptOnStartup() {
        const config = readConfig();
        const dismissedAt = Date.parse(localStorage.getItem(DISMISSED_KEY) || '');
        const dismissedRecently = Number.isFinite(dismissedAt) && (Date.now() - dismissedAt < 18 * 60 * 60 * 1000);

        if (!config.deviceId && !dismissedRecently) {
            openSetupWizard('First setup: choose this browser device profile and enter the sync secret. Onda uploads JSON library data only; audio stays local.');
            return;
        }
        if (config.deviceId && !hasLocalState() && !dismissedRecently) {
            openSetupWizard('No local Onda library/settings were found in this browser. Load the selected cloud profile or continue empty.');
            return;
        }
        if (config.deviceId && trackCount() === 0 && !dismissedRecently) {
            openSetupWizard('This browser currently has 0 library tracks. You can load the selected device profile from cloud before continuing.');
        }
    }

    function bindEvents() {
        byId('onda-cloud-close-setup')?.addEventListener('click', closeSetupWizard);
        byId('onda-cloud-modal-overlay')?.addEventListener('click', closeSetupWizard);
        byId('onda-cloud-test-btn')?.addEventListener('click', testConnection);
        byId('onda-cloud-list-btn')?.addEventListener('click', listDevices);
        byId('onda-cloud-save-setup-btn')?.addEventListener('click', async () => {
            if (await saveSetup()) closeSetupWizard();
        });
        byId('onda-cloud-save-device-btn')?.addEventListener('click', saveDevice);
        byId('onda-cloud-load-device-btn')?.addEventListener('click', loadDevice);
        byId('onda-cloud-continue-local-btn')?.addEventListener('click', closeSetupWizard);
        byId('onda-cloud-toggle-secret-btn')?.addEventListener('click', () => {
            const input = secretInput();
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
            byId('onda-cloud-toggle-secret-btn').textContent = input.type === 'password' ? 'Show Secret' : 'Hide Secret';
        });

        byId('btn-open-cloud-setup-from-settings')?.addEventListener('click', () => openSetupWizard(''));
        byId('btn-settings-cloud-save')?.addEventListener('click', saveDevice);
        byId('btn-db-save-cloud')?.addEventListener('click', saveDevice);
        byId('btn-db-load-cloud')?.addEventListener('click', () => {
            if (!readConfig().deviceId) openSetupWizard('Choose a cloud device profile before loading.');
            else loadDevice();
        });

        byId('onda-cloud-device-id')?.addEventListener('input', (event) => {
            selectedDeviceId = sanitizeDeviceId(event.target.value);
        });
    }

    function init() {
        preparePasswordField();
        selectedDeviceId = readConfig().deviceId || '';
        bindEvents();
        updateStatusSummary();
        renderDeviceList([]);
        window.setTimeout(maybePromptOnStartup, 1400);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.OndaCloudSync = {
        openSetupWizard,
        listDevices,
        saveDevice,
        loadDevice,
        readConfig,
        chooseDevice
    };
})();
