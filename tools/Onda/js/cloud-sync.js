(function () {
    'use strict';

    const CONFIG_KEY = 'ondaCloudSyncConfigV1';
    const STATUS_KEY = 'ondaCloudSyncLastStatusV1';
    const DISMISSED_KEY = 'ondaCloudSetupDismissedV1';
    const LEGACY_DEVICE_KEY = 'ondaCloudDeviceIdV1';
    const LEGACY_DEVICE_FIELD_KEY = 'onda-cloud-device-id';
    const LEGACY_LAST_SYNC_KEY = 'ondaCloudLastSyncV1';
    const ENDPOINT = '/.netlify/functions/onda-sync';
    const TIMEOUT_MS = 15000;
    const CREDENTIAL_ID = 'onda-cloud-sync';
    const CREDENTIAL_NAME = 'Onda Cloud Sync';

    let selectedDeviceId = '';
    let knownDevices = [];
    let sessionSecret = '';
    let passwordRestoreAttempted = false;

    const $ = (id) => document.getElementById(id);

    function parseJson(value, fallback) {
        try { return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; }
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
        return String(value || '').trim().toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
    }

    function rawConfig() {
        return parseJson(localStorage.getItem(CONFIG_KEY), {}) || {};
    }

    function config() {
        const raw = rawConfig();
        return {
            endpoint: raw.endpoint || ENDPOINT,
            deviceId: raw.deviceId || localStorage.getItem(LEGACY_DEVICE_KEY) || '',
            deviceLabel: raw.deviceLabel || '',
            autoCheckOnStartup: raw.autoCheckOnStartup !== false
        };
    }

    function saveConfig(changes = {}) {
        const current = rawConfig();
        const next = {
            ...current,
            ...changes,
            endpoint: changes.endpoint || current.endpoint || ENDPOINT,
            updatedAt: new Date().toISOString()
        };
        delete next.secret;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
        localStorage.setItem(LEGACY_DEVICE_KEY, next.deviceId || '');
        localStorage.setItem(LEGACY_DEVICE_FIELD_KEY, next.deviceId || '');
        updateStatusSummary();
        return config();
    }

    function legacySecret() {
        const secret = rawConfig().secret;
        return typeof secret === 'string' ? secret.trim() : '';
    }

    function removeLegacySecret() {
        const raw = rawConfig();
        if (!Object.prototype.hasOwnProperty.call(raw, 'secret')) return;
        delete raw.secret;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(raw));
    }

    function secretInput() {
        return $('onda-cloud-secret-input');
    }

    function setSessionSecret(value) {
        const secret = String(value || '').trim();
        if (secret) sessionSecret = secret;
        return sessionSecret;
    }

    function savedOrTypedSecret() {
        const typed = secretInput()?.value || '';
        if (typed.trim()) return setSessionSecret(typed);
        if (sessionSecret) return sessionSecret;
        if (legacySecret()) return setSessionSecret(legacySecret());
        return '';
    }

    function enablePasswordManager() {
        const input = secretInput();
        if (!input) return;
        input.name = 'onda-cloud-secret';
        input.autocomplete = 'current-password';
        input.removeAttribute('data-1p-ignore');
        input.removeAttribute('data-bwignore');
        input.removeAttribute('data-form-type');
        input.removeAttribute('data-lpignore');
        input.addEventListener('input', () => setSessionSecret(input.value));
    }

    async function restorePasswordSecret() {
        if (savedOrTypedSecret() || passwordRestoreAttempted) return savedOrTypedSecret();
        passwordRestoreAttempted = true;
        if (!navigator.credentials || typeof window.PasswordCredential !== 'function') return '';
        try {
            const credential = await navigator.credentials.get({ password: true, mediation: 'optional' });
            if (!credential || credential.id !== CREDENTIAL_ID || !credential.password) return '';
            if (secretInput()) secretInput().value = credential.password;
            return setSessionSecret(credential.password);
        } catch (error) {
            return '';
        }
    }

    async function savePasswordSecret(secret) {
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
        const immediate = savedOrTypedSecret();
        if (immediate) return immediate;
        const restored = await restorePasswordSecret();
        if (restored) return restored;
        throw new Error('Enter the Onda sync secret first. Save Setup asks Chrome to remember it.');
    }

    function setStatus(message, isError = false) {
        const status = { message: String(message || ''), isError: !!isError, at: new Date().toISOString() };
        localStorage.setItem(STATUS_KEY, JSON.stringify(status));
        if (!status.isError) localStorage.setItem(LEGACY_LAST_SYNC_KEY, new Date(status.at).toLocaleString());

        const modalStatus = $('onda-cloud-status-box');
        if (modalStatus) {
            modalStatus.innerHTML = `${status.isError ? '⚠️' : '☁️'} ${escapeHtml(status.message)}<br><span class="onda-cloud-status-time">${new Date(status.at).toLocaleString()}</span>`;
            modalStatus.classList.toggle('is-error', status.isError);
        }

        const settingsStatus = $('settings-cloud-status');
        if (settingsStatus) {
            settingsStatus.textContent = `${status.isError ? 'Cloud error: ' : 'Cloud status: '}${status.message}`;
            settingsStatus.classList.toggle('is-error', status.isError);
        }

        updateStatusSummary();
        if (typeof window.showToast === 'function') window.showToast(status.message);
    }

    function updateStatusSummary() {
        const current = config();
        const last = parseJson(localStorage.getItem(STATUS_KEY), null);
        const deviceText = current.deviceId ? `${current.deviceLabel || current.deviceId} (${current.deviceId})` : 'not set';
        const lastText = last ? `${last.message} · ${new Date(last.at).toLocaleString()}` : 'No cloud sync yet.';
        document.querySelectorAll('[data-onda-cloud-status-line]').forEach((element) => {
            element.innerHTML = `Device: <strong>${escapeHtml(deviceText)}</strong><br>Last cloud action: ${escapeHtml(lastText)}`;
        });
        const settingsStatus = $('settings-cloud-status');
        if (settingsStatus && !last) settingsStatus.textContent = `Cloud device: ${deviceText}`;
    }

    async function cloudRequest(action, body = {}) {
        const current = config();
        const secret = body.secret || await requireSecret();
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(current.endpoint || ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...body, secret }),
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

    function backupPayload() {
        if (typeof window.saveLocalUiStateCheckpoint === 'function') window.saveLocalUiStateCheckpoint('cloud-sync-before-build');
        if (typeof window.buildEverythingExport === 'function') return window.buildEverythingExport();
        if (typeof window.buildLibraryExport === 'function') {
            return { app: 'Onda Media Player', type: 'onda-full-backup', version: 1, exportedAt: new Date().toISOString(), library: window.buildLibraryExport({ streamingOnly: false }) };
        }
        throw new Error('This Onda build does not expose a backup builder.');
    }

    function applyBackup(payload) {
        if (!payload || typeof payload !== 'object') throw new Error('Cloud profile had no usable backup JSON.');
        if (typeof window.applyImportedSettingsJson === 'function') window.applyImportedSettingsJson(payload);
        else if (payload.library && typeof window.importOndaLibrary === 'function') window.importOndaLibrary(payload.library);
        else if (payload.type === 'onda-library' && typeof window.importOndaLibrary === 'function') window.importOndaLibrary(payload);
        else throw new Error('This Onda build does not expose an import function.');
        if (typeof window.saveActiveLibraryState === 'function') window.saveActiveLibraryState('cloud-load-device');
        if (typeof window.flushActiveLibraryState === 'function') window.flushActiveLibraryState('cloud-load-device-flush');
    }

    function libraryTrackCount() {
        try {
            if (window.virtualLibrary && typeof window.virtualLibrary === 'object') return Object.keys(window.virtualLibrary).length;
        } catch (error) {}
        const raw = localStorage.getItem('ondaActiveLibraryV1') || localStorage.getItem('ondaActiveLibraryLastGoodV1') || localStorage.getItem('ondaActiveLibraryBackupV1');
        const tracks = parseJson(raw, null)?.library?.tracks || parseJson(raw, null)?.tracks;
        return tracks && typeof tracks === 'object' ? Object.keys(tracks).length : 0;
    }

    function hasLocalState() {
        return ['ondaActiveLibraryV1', 'ondaActiveLibraryBackupV1', 'ondaActiveLibraryLastGoodV1', 'ondaVisualizerPresetsV1', 'ondaActiveVisualizerStackV1', CONFIG_KEY]
            .some((key) => !!localStorage.getItem(key)) || libraryTrackCount() > 0;
    }

    async function openSetupWizard(reason = '') {
        const current = config();
        selectedDeviceId = current.deviceId || selectedDeviceId || '';
        if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = current.deviceId || '';
        if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = current.deviceLabel || '';
        const warning = $('onda-cloud-startup-warning');
        if (warning) {
            warning.classList.toggle('u-hidden', !reason);
            warning.textContent = reason;
        }
        $('onda-cloud-modal-overlay')?.classList.add('open');
        $('onda-cloud-setup-modal')?.classList.add('open');
        updateStatusSummary();
        await restorePasswordSecret();
    }

    function closeSetupWizard() {
        $('onda-cloud-modal-overlay')?.classList.remove('open');
        $('onda-cloud-setup-modal')?.classList.remove('open');
        localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    }

    function renderDevices(devices = knownDevices) {
        const list = $('onda-cloud-device-list');
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
            const updatedAt = device.lastSync || device.updatedAt || device.savedAt || '';
            const count = Number.isFinite(Number(device.trackCount)) ? `${device.trackCount} tracks` : 'track count unknown';
            const row = document.createElement('div');
            row.className = `onda-cloud-device-row${selectedDeviceId === id ? ' selected' : ''}`;
            row.innerHTML = `<div class="onda-cloud-device-marker">◉</div><div><div class="onda-cloud-device-name">${escapeHtml(label)}</div><div class="onda-cloud-device-meta">${escapeHtml(id)} · ${escapeHtml(count)}${updatedAt ? ` · ${escapeHtml(new Date(updatedAt).toLocaleString())}` : ''}</div></div><button type="button" class="btn-pill">Use</button>`;
            row.addEventListener('click', () => chooseDevice(id, label));
            row.querySelector('button')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); chooseDevice(id, label); });
            list.appendChild(row);
        });
    }

    function chooseDevice(id, label = '') {
        selectedDeviceId = sanitizeDeviceId(id);
        if (!selectedDeviceId) return;
        const deviceLabel = String(label || selectedDeviceId).trim() || selectedDeviceId;
        if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = selectedDeviceId;
        if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = deviceLabel;
        saveConfig({ deviceId: selectedDeviceId, deviceLabel });
        renderDevices();
        setStatus(`Selected cloud device ${deviceLabel}.`);
    }

    async function listDevices() {
        try {
            const result = await cloudRequest('list-devices', { secret: await requireSecret() });
            renderDevices(result.devices || []);
            setStatus(`Loaded ${result.devices?.length || 0} cloud device profile(s).`);
        } catch (error) { setStatus(error.message || String(error), true); }
    }

    async function saveSetup({ announce = true } = {}) {
        try {
            const secret = await requireSecret();
            const deviceId = sanitizeDeviceId($('onda-cloud-device-id')?.value || selectedDeviceId || '');
            const deviceLabel = String($('onda-cloud-device-label')?.value || deviceId).trim() || deviceId;
            if (!deviceId) throw new Error('Choose or type a device profile id first.');
            selectedDeviceId = deviceId;
            const passwordStored = await savePasswordSecret(secret);
            if (passwordStored) removeLegacySecret();
            saveConfig({ deviceId, deviceLabel });
            if (announce) setStatus(passwordStored ? `Setup saved for ${deviceLabel}. Chrome password storage was requested.` : `Setup saved for ${deviceLabel}. This browser did not confirm password-manager storage yet.`);
            return config();
        } catch (error) {
            setStatus(error.message || String(error), true);
            return null;
        }
    }

    async function testConnection() {
        try {
            const result = await cloudRequest('test', { secret: await requireSecret() });
            setStatus(result.message || 'Connection OK.');
        } catch (error) { setStatus(error.message || String(error), true); }
    }

    async function saveDevice() {
        try {
            const current = await saveSetup({ announce: false });
            if (!current?.deviceId) { await openSetupWizard('Choose a device profile before saving to cloud.'); return; }
            const data = backupPayload();
            const count = data?.library?.tracks ? Object.keys(data.library.tracks).length : libraryTrackCount();
            const result = await cloudRequest('save-device', { deviceId: current.deviceId, deviceLabel: current.deviceLabel || current.deviceId, data, trackCount: count, createSnapshot: true });
            renderDevices(result.devices || knownDevices);
            setStatus(`Saved ${current.deviceLabel || current.deviceId} to cloud · ${result.trackCount ?? count} tracks.`);
        } catch (error) { setStatus(error.message || String(error), true); }
    }

    async function loadDevice() {
        try {
            const secret = await requireSecret();
            const current = config();
            const deviceId = sanitizeDeviceId($('onda-cloud-device-id')?.value || selectedDeviceId || current.deviceId);
            const deviceLabel = String($('onda-cloud-device-label')?.value || current.deviceLabel || deviceId).trim() || deviceId;
            if (!deviceId) { await openSetupWizard('Choose a device profile before loading from cloud.'); return; }
            saveConfig({ deviceId, deviceLabel });
            const result = await cloudRequest('load-device', { deviceId, secret });
            if (!result.data) throw new Error('No backup exists for that device profile yet.');
            if (!window.confirm(`Load cloud library for ${deviceLabel}? This restores catalogue, playlists, settings and artwork references. Audio files stay local to this device and may need relinking.`)) return;
            applyBackup(result.data);
            setStatus(`Loaded ${deviceLabel} from cloud. Local audio files were not transferred.`);
            closeSetupWizard();
        } catch (error) { setStatus(error.message || String(error), true); }
    }

    function maybePromptOnStartup() {
        const current = config();
        const dismissedAt = Date.parse(localStorage.getItem(DISMISSED_KEY) || '');
        const dismissedRecently = Number.isFinite(dismissedAt) && (Date.now() - dismissedAt < 18 * 60 * 60 * 1000);
        if (!current.deviceId && !dismissedRecently) {
            openSetupWizard('First setup: choose this browser device profile and enter the sync secret. Onda uploads JSON library data only; audio stays local.');
        } else if (current.deviceId && !hasLocalState() && !dismissedRecently) {
            openSetupWizard('No local Onda library/settings were found in this browser. Load the selected cloud profile or continue empty.');
        } else if (current.deviceId && libraryTrackCount() === 0 && !dismissedRecently) {
            openSetupWizard('This browser currently has 0 library tracks. You can load the selected device profile from cloud before continuing.');
        }
    }

    function bindEvents() {
        $('onda-cloud-close-setup')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-modal-overlay')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-test-btn')?.addEventListener('click', testConnection);
        $('onda-cloud-list-btn')?.addEventListener('click', listDevices);
        $('onda-cloud-save-setup-btn')?.addEventListener('click', async () => { if (await saveSetup()) closeSetupWizard(); });
        $('onda-cloud-save-device-btn')?.addEventListener('click', saveDevice);
        $('onda-cloud-load-device-btn')?.addEventListener('click', loadDevice);
        $('onda-cloud-continue-local-btn')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-toggle-secret-btn')?.addEventListener('click', () => {
            const input = secretInput();
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
            $('onda-cloud-toggle-secret-btn').textContent = input.type === 'password' ? 'Show Secret' : 'Hide Secret';
        });
        $('btn-open-cloud-setup-from-settings')?.addEventListener('click', () => openSetupWizard(''));
        $('btn-settings-cloud-save')?.addEventListener('click', saveDevice);
        $('btn-db-save-cloud')?.addEventListener('click', saveDevice);
        $('btn-db-load-cloud')?.addEventListener('click', () => config().deviceId ? loadDevice() : openSetupWizard('Choose a cloud device profile before loading.'));
        $('onda-cloud-device-id')?.addEventListener('input', (event) => { selectedDeviceId = sanitizeDeviceId(event.target.value); });
    }

    function init() {
        enablePasswordManager();
        selectedDeviceId = config().deviceId || '';
        bindEvents();
        updateStatusSummary();
        renderDevices([]);
        window.setTimeout(maybePromptOnStartup, 1400);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.OndaCloudSync = { openSetupWizard, listDevices, saveDevice, loadDevice, config, chooseDevice };
})();
