(function () {
    'use strict';

    const CLOUD_CONFIG_KEY = 'ondaCloudSyncConfigV1';
    const CLOUD_LAST_STATUS_KEY = 'ondaCloudSyncLastStatusV1';
    const CLOUD_SETUP_DISMISSED_KEY = 'ondaCloudSetupDismissedV1';
    const DEFAULT_ENDPOINT = '/.netlify/functions/onda-sync';
    const REQUEST_TIMEOUT_MS = 15000;
    const PASSWORD_CREDENTIAL_ID = 'onda-cloud-sync';
    const PASSWORD_CREDENTIAL_NAME = 'Onda Cloud Sync';

    let selectedCloudDeviceId = '';
    let lastDeviceList = [];
    let sessionSecret = '';
    let credentialRestoreAttempted = false;

    function $(id) {
        return document.getElementById(id);
    }

    function safeJsonParse(raw, fallback = null) {
        try {
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function sanitizeDeviceId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getRawCloudConfig() {
        return safeJsonParse(localStorage.getItem(CLOUD_CONFIG_KEY), {}) || {};
    }

    function loadCloudConfig() {
        const rawConfig = getRawCloudConfig();
        const legacySecret = typeof rawConfig.secret === 'string' ? rawConfig.secret.trim() : '';

        // Old Onda versions stored the server secret in localStorage. Keep it for
        // this tab only so existing users are not immediately locked out, then
        // remove it from persistent browser storage.
        if (legacySecret && !sessionSecret) {
            sessionSecret = legacySecret;
            const migrated = { ...rawConfig };
            delete migrated.secret;
            localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(migrated));
        }

        return {
            endpoint: rawConfig.endpoint || DEFAULT_ENDPOINT,
            deviceId: rawConfig.deviceId || '',
            deviceLabel: rawConfig.deviceLabel || '',
            autoCheckOnStartup: rawConfig.autoCheckOnStartup !== false,
            updatedAt: rawConfig.updatedAt || ''
        };
    }

    function saveCloudConfig(nextConfig = {}) {
        const current = loadCloudConfig();
        const merged = {
            ...current,
            ...nextConfig,
            endpoint: nextConfig.endpoint || current.endpoint || DEFAULT_ENDPOINT,
            updatedAt: new Date().toISOString()
        };
        delete merged.secret;
        localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(merged));
        updateCloudStatusLine();
        return merged;
    }

    function getSecretInput() {
        return $('onda-cloud-secret-input');
    }

    function setSessionSecret(value) {
        const secret = String(value || '').trim();
        if (secret) sessionSecret = secret;
        return sessionSecret;
    }

    function getSessionSecret() {
        const inputValue = getSecretInput()?.value || '';
        if (inputValue.trim()) setSessionSecret(inputValue);
        return sessionSecret;
    }

    function configurePasswordManagerField() {
        const input = getSecretInput();
        if (!input) return;

        input.name = 'onda-cloud-secret';
        input.autocomplete = 'current-password';
        input.removeAttribute('data-1p-ignore');
        input.removeAttribute('data-bwignore');
        input.removeAttribute('data-form-type');
        input.removeAttribute('data-lpignore');
        input.setAttribute('aria-label', 'Onda Cloud Sync secret');

        input.addEventListener('input', () => {
            setSessionSecret(input.value);
        });
    }

    async function restoreSecretFromPasswordManager() {
        const input = getSecretInput();
        if (input?.value?.trim()) return setSessionSecret(input.value);
        if (sessionSecret) return sessionSecret;
        if (credentialRestoreAttempted) return '';
        credentialRestoreAttempted = true;

        if (!navigator.credentials || typeof window.PasswordCredential !== 'function') return '';

        try {
            const credential = await navigator.credentials.get({ password: true, mediation: 'optional' });
            if (!credential || credential.id !== PASSWORD_CREDENTIAL_ID || !credential.password) return '';
            if (input) input.value = credential.password;
            return setSessionSecret(credential.password);
        } catch (error) {
            return '';
        }
    }

    async function rememberSecretInPasswordManager(secret) {
        if (!secret || !navigator.credentials || typeof window.PasswordCredential !== 'function') return false;

        try {
            const credential = new window.PasswordCredential({
                id: PASSWORD_CREDENTIAL_ID,
                name: PASSWORD_CREDENTIAL_NAME,
                password: secret
            });
            await navigator.credentials.store(credential);
            return true;
        } catch (error) {
            return false;
        }
    }

    async function requireCloudSecret() {
        const immediate = getSessionSecret();
        if (immediate) return immediate;
        const restored = await restoreSecretFromPasswordManager();
        if (restored) return restored;
        throw new Error('Enter the Onda sync secret first. Chrome can save it after you choose Save Setup.');
    }

    function setCloudStatus(message, isError = false) {
        const status = {
            message: String(message || ''),
            isError: !!isError,
            at: new Date().toISOString()
        };

        localStorage.setItem(CLOUD_LAST_STATUS_KEY, JSON.stringify(status));
        const popupBox = $('onda-cloud-status-box');
        if (popupBox) {
            popupBox.innerHTML = `${isError ? '⚠️' : '☁️'} ${escapeHtml(status.message)}<br><span class="onda-cloud-status-time">${new Date(status.at).toLocaleString()}</span>`;
            popupBox.classList.toggle('is-error', status.isError);
        }

        const settingsBox = $('settings-cloud-status');
        if (settingsBox) {
            settingsBox.textContent = `${isError ? 'Cloud error: ' : 'Cloud status: '}${status.message}`;
            settingsBox.classList.toggle('is-error', status.isError);
        }

        updateCloudStatusLine();
        if (typeof showToast === 'function') showToast(status.message);
    }

    function updateCloudStatusLine() {
        const config = loadCloudConfig();
        const last = safeJsonParse(localStorage.getItem(CLOUD_LAST_STATUS_KEY), null);
        const device = config.deviceId ? `${config.deviceLabel || config.deviceId} (${config.deviceId})` : 'not set';
        const lastText = last ? `${last.message} · ${new Date(last.at).toLocaleString()}` : 'No cloud sync yet.';

        document.querySelectorAll('[data-onda-cloud-status-line]').forEach((element) => {
            element.innerHTML = `Device: <strong>${escapeHtml(device)}</strong><br>Last cloud action: ${escapeHtml(lastText)}`;
        });

        const settingsBox = $('settings-cloud-status');
        if (settingsBox && !last) settingsBox.textContent = `Cloud device: ${device}`;
    }

    async function cloudRequest(action, extra = {}) {
        const config = loadCloudConfig();
        const secret = extra.secret || await requireCloudSecret();
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(config.endpoint || DEFAULT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extra, secret }),
                signal: controller.signal
            });
            const text = await response.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch (error) {
                data = null;
            }

            if (!response.ok || !data || data.ok === false) {
                if (!data) {
                    throw new Error(`Cloud endpoint returned an invalid response (HTTP ${response.status}). Confirm the Netlify site is deploying tools/Onda and its function bundle.`);
                }
                throw new Error(data.error || `Cloud request failed with HTTP ${response.status}.`);
            }

            return data;
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('Cloud request timed out. Check your connection, then try again.');
            }
            throw error;
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function getCurrentBackupPayload() {
        if (typeof saveLocalUiStateCheckpoint === 'function') saveLocalUiStateCheckpoint('cloud-sync-before-build');
        if (typeof buildEverythingExport === 'function') return buildEverythingExport();
        if (typeof buildLibraryExport === 'function') {
            return {
                app: 'Onda Media Player',
                type: 'onda-full-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                library: buildLibraryExport({ streamingOnly: false })
            };
        }
        throw new Error('This Onda build does not expose a backup builder.');
    }

    function applyCloudBackupPayload(payload) {
        if (!payload || typeof payload !== 'object') throw new Error('Cloud profile had no usable backup JSON.');
        if (typeof applyImportedSettingsJson === 'function') {
            applyImportedSettingsJson(payload);
        } else if (payload.library && typeof importOndaLibrary === 'function') {
            importOndaLibrary(payload.library);
        } else if (payload.type === 'onda-library' && typeof importOndaLibrary === 'function') {
            importOndaLibrary(payload);
        } else {
            throw new Error('This Onda build does not expose an import function.');
        }
        if (typeof saveActiveLibraryState === 'function') saveActiveLibraryState('cloud-load-device');
        if (typeof flushActiveLibraryState === 'function') flushActiveLibraryState('cloud-load-device-flush');
    }

    function getLibraryTrackCount() {
        try {
            if (window.virtualLibrary && typeof window.virtualLibrary === 'object') return Object.keys(window.virtualLibrary).length;
        } catch (error) {}
        try {
            const raw = localStorage.getItem('ondaActiveLibraryV1') || localStorage.getItem('ondaActiveLibraryLastGoodV1') || localStorage.getItem('ondaActiveLibraryBackupV1');
            const parsed = safeJsonParse(raw, null);
            const tracks = parsed?.library?.tracks || parsed?.tracks || null;
            return tracks && typeof tracks === 'object' ? Object.keys(tracks).length : 0;
        } catch (error) {
            return 0;
        }
    }

    function hasAnyLocalOndaState() {
        const importantKeys = [
            'ondaActiveLibraryV1',
            'ondaActiveLibraryBackupV1',
            'ondaActiveLibraryLastGoodV1',
            'ondaVisualizerPresetsV1',
            'ondaActiveVisualizerStackV1',
            CLOUD_CONFIG_KEY
        ];
        return importantKeys.some((key) => !!localStorage.getItem(key)) || getLibraryTrackCount() > 0;
    }

    async function openSetupWizard(reason = '') {
        const overlay = $('onda-cloud-modal-overlay');
        const modal = $('onda-cloud-setup-modal');
        const config = loadCloudConfig();
        selectedCloudDeviceId = config.deviceId || selectedCloudDeviceId || '';

        if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = config.deviceId || '';
        if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = config.deviceLabel || '';

        const warning = $('onda-cloud-startup-warning');
        if (warning) {
            warning.classList.toggle('u-hidden', !reason);
            warning.textContent = reason || '';
        }

        if (overlay) overlay.classList.add('open');
        if (modal) modal.classList.add('open');
        updateCloudStatusLine();
        await restoreSecretFromPasswordManager();
    }

    function closeSetupWizard() {
        $('onda-cloud-modal-overlay')?.classList.remove('open');
        $('onda-cloud-setup-modal')?.classList.remove('open');
        localStorage.setItem(CLOUD_SETUP_DISMISSED_KEY, new Date().toISOString());
    }

    function renderDeviceList(devices = lastDeviceList) {
        const list = $('onda-cloud-device-list');
        if (!list) return;

        lastDeviceList = Array.isArray(devices) ? devices : [];
        if (!lastDeviceList.length) {
            list.innerHTML = '<div class="onda-cloud-device-meta">No cloud device profiles found yet. Create one below, for example phone, laptop, or work-laptop.</div>';
            return;
        }

        list.innerHTML = '';
        lastDeviceList.forEach((device) => {
            const id = sanitizeDeviceId(device.id || device.deviceId || '');
            if (!id) return;
            const label = device.label || device.deviceLabel || id;
            const updated = device.lastSync || device.updatedAt || device.savedAt || '';
            const tracks = Number.isFinite(Number(device.trackCount)) ? `${device.trackCount} tracks` : 'track count unknown';
            const row = document.createElement('div');
            row.className = `onda-cloud-device-row${selectedCloudDeviceId === id ? ' selected' : ''}`;
            row.dataset.deviceId = id;
            row.dataset.deviceLabel = label;
            row.innerHTML = `
                <div class="onda-cloud-device-marker">◉</div>
                <div>
                    <div class="onda-cloud-device-name">${escapeHtml(label)}</div>
                    <div class="onda-cloud-device-meta">${escapeHtml(id)} · ${escapeHtml(tracks)}${updated ? ` · ${escapeHtml(new Date(updated).toLocaleString())}` : ''}</div>
                </div>
                <button class="btn-pill" type="button">Use</button>
            `;
            const useButton = row.querySelector('button');
            useButton?.addEventListener('click', (event) => {
                event.stopPropagation();
                chooseDevice(id, label);
            });
            row.addEventListener('click', () => chooseDevice(id, label));
            list.appendChild(row);
        });
    }

    function chooseDevice(id, label = '') {
        selectedCloudDeviceId = sanitizeDeviceId(id);
        const deviceLabel = String(label || selectedCloudDeviceId).trim() || selectedCloudDeviceId;
        if (!selectedCloudDeviceId) return;

        if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = selectedCloudDeviceId;
        if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = deviceLabel;
        saveCloudConfig({ deviceId: selectedCloudDeviceId, deviceLabel });
        renderDeviceList(lastDeviceList);
        setCloudStatus(`Selected cloud device ${deviceLabel}.`);
    }

    async function listCloudDevices() {
        try {
            const secret = await requireCloudSecret();
            const result = await cloudRequest('list-devices', { secret });
            renderDeviceList(result.devices || []);
            setCloudStatus(`Loaded ${result.devices?.length || 0} cloud device profile(s).`);
        } catch (error) {
            setCloudStatus(error.message || String(error), true);
        }
    }

    async function saveSetupFromFields({ announce = true } = {}) {
        try {
            const secret = await requireCloudSecret();
            const deviceId = sanitizeDeviceId($('onda-cloud-device-id')?.value || selectedCloudDeviceId || '');
            const deviceLabel = ($('onda-cloud-device-label')?.value || deviceId).trim() || deviceId;

            if (!deviceId) {
                setCloudStatus('Choose or type a device profile id first.', true);
                return null;
            }

            selectedCloudDeviceId = deviceId;
            const config = saveCloudConfig({ deviceId, deviceLabel });
            const passwordSaved = await rememberSecretInPasswordManager(secret);
            if (announce) {
                setCloudStatus(passwordSaved
                    ? `Setup saved for ${deviceLabel}. Chrome password storage was requested.`
                    : `Setup saved for ${deviceLabel}. Chrome may offer to save the secret when you submit the field.`);
            }
            return config;
        } catch (error) {
            setCloudStatus(error.message || String(error), true);
            return null;
        }
    }

    async function testCloudConnection() {
        try {
            const secret = await requireCloudSecret();
            const result = await cloudRequest('test', { secret });
            setCloudStatus(result.message || 'Connection OK.');
        } catch (error) {
            setCloudStatus(error.message || String(error), true);
        }
    }

    async function saveCurrentDeviceToCloud() {
        try {
            const config = await saveSetupFromFields({ announce: false });
            if (!config?.deviceId) {
                await openSetupWizard('Choose a device profile before saving to cloud.');
                return;
            }

            const payload = getCurrentBackupPayload();
            const trackCount = payload?.library?.tracks ? Object.keys(payload.library.tracks).length : getLibraryTrackCount();
            const result = await cloudRequest('save-device', {
                deviceId: config.deviceId,
                deviceLabel: config.deviceLabel || config.deviceId,
                data: payload,
                trackCount,
                createSnapshot: true
            });
            renderDeviceList(result.devices || lastDeviceList);
            setCloudStatus(`Saved ${config.deviceLabel || config.deviceId} to cloud · ${result.trackCount ?? trackCount} tracks.`);
        } catch (error) {
            setCloudStatus(error.message || String(error), true);
        }
    }

    async function loadSelectedDeviceFromCloud() {
        try {
            const secret = await requireCloudSecret();
            const fieldDevice = sanitizeDeviceId($('onda-cloud-device-id')?.value || selectedCloudDeviceId || loadCloudConfig().deviceId);
            const fieldLabel = ($('onda-cloud-device-label')?.value || fieldDevice).trim() || fieldDevice;
            if (!fieldDevice) {
                await openSetupWizard('Choose a device profile before loading from cloud.');
                return;
            }

            saveCloudConfig({ deviceId: fieldDevice, deviceLabel: fieldLabel });
            const result = await cloudRequest('load-device', { deviceId: fieldDevice, secret });
            if (!result.data) throw new Error('No backup exists for that device profile yet.');
            const ok = window.confirm(`Load cloud library for ${fieldLabel}? This restores the catalogue, playlists, settings and artwork references. Audio files stay local to this device and may need relinking.`);
            if (!ok) return;

            applyCloudBackupPayload(result.data);
            setCloudStatus(`Loaded ${fieldLabel} from cloud. Local audio files were not transferred.`);
            closeSetupWizard();
        } catch (error) {
            setCloudStatus(error.message || String(error), true);
        }
    }

    function maybeShowSetupOnStartup() {
        const config = loadCloudConfig();
        const hasConfig = !!config.deviceId;
        const hasState = hasAnyLocalOndaState();
        const trackCount = getLibraryTrackCount();
        const dismissedAt = Date.parse(localStorage.getItem(CLOUD_SETUP_DISMISSED_KEY) || '');
        const dismissedRecently = Number.isFinite(dismissedAt) && (Date.now() - dismissedAt < 1000 * 60 * 60 * 18);

        if (!hasConfig && !dismissedRecently) {
            openSetupWizard('First setup: choose this browser device profile and enter the sync secret. Onda uploads JSON library data only; audio stays local.');
            return;
        }
        if (hasConfig && !hasState && !dismissedRecently) {
            openSetupWizard('No local Onda library/settings were found in this browser. You can load the selected cloud device profile or continue empty.');
            return;
        }
        if (hasConfig && trackCount === 0 && !dismissedRecently) {
            openSetupWizard('This browser currently has 0 library tracks. You can load the selected device profile from cloud before continuing.');
        }
    }

    function openSetupFromAnywhere(reason = '') {
        openSetupWizard(reason);
    }

    function bindCloudEvents() {
        $('onda-cloud-close-setup')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-modal-overlay')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-test-btn')?.addEventListener('click', testCloudConnection);
        $('onda-cloud-list-btn')?.addEventListener('click', listCloudDevices);
        $('onda-cloud-save-setup-btn')?.addEventListener('click', async () => {
            const config = await saveSetupFromFields();
            if (config) closeSetupWizard();
        });
        $('onda-cloud-save-device-btn')?.addEventListener('click', saveCurrentDeviceToCloud);
        $('onda-cloud-load-device-btn')?.addEventListener('click', loadSelectedDeviceFromCloud);
        $('onda-cloud-continue-local-btn')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-toggle-secret-btn')?.addEventListener('click', () => {
            const input = getSecretInput();
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
            $('onda-cloud-toggle-secret-btn').textContent = input.type === 'password' ? 'Show Secret' : 'Hide Secret';
        });

        $('btn-open-cloud-setup-from-settings')?.addEventListener('click', () => openSetupFromAnywhere(''));
        $('btn-settings-cloud-save')?.addEventListener('click', saveCurrentDeviceToCloud);
        $('btn-db-save-cloud')?.addEventListener('click', saveCurrentDeviceToCloud);
        $('btn-db-load-cloud')?.addEventListener('click', () => {
            const config = loadCloudConfig();
            if (!config.deviceId) openSetupFromAnywhere('Choose a cloud device profile before loading.');
            else loadSelectedDeviceFromCloud();
        });

        $('onda-cloud-device-id')?.addEventListener('input', (event) => {
            selectedCloudDeviceId = sanitizeDeviceId(event.target.value);
        });
    }

    function initCloudSyncUI() {
        configurePasswordManagerField();
        const config = loadCloudConfig();
        selectedCloudDeviceId = config.deviceId || '';
        bindCloudEvents();
        updateCloudStatusLine();
        renderDeviceList([]);
        window.setTimeout(maybeShowSetupOnStartup, 1400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCloudSyncUI);
    } else {
        initCloudSyncUI();
    }

    window.OndaCloudSync = {
        openSetupWizard,
        listCloudDevices,
        saveCurrentDeviceToCloud,
        loadSelectedDeviceFromCloud,
        loadCloudConfig,
        chooseDevice
    };
})();
