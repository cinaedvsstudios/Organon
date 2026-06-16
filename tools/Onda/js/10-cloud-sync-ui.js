(function () {
    'use strict';

    const CLOUD_CONFIG_KEY = 'ondaCloudSyncConfigV1';
    const CLOUD_LAST_STATUS_KEY = 'ondaCloudSyncLastStatusV1';
    const CLOUD_SETUP_DISMISSED_KEY = 'ondaCloudSetupDismissedV1';
    const DEFAULT_ENDPOINT = '/.netlify/functions/onda-sync';

    let selectedCloudDeviceId = '';
    let lastDeviceList = [];

    function $(id) { return document.getElementById(id); }

    function safeJsonParse(raw, fallback = null) {
        try { return raw ? JSON.parse(raw) : fallback; } catch (err) { return fallback; }
    }

    function loadCloudConfig() {
        const config = safeJsonParse(localStorage.getItem(CLOUD_CONFIG_KEY), {}) || {};
        return {
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            deviceId: config.deviceId || '',
            deviceLabel: config.deviceLabel || '',
            secret: config.secret || '',
            autoCheckOnStartup: config.autoCheckOnStartup !== false
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
        localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(merged));
        updateCloudStatusLine();
        return merged;
    }

    function sanitizeDeviceId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
    }

    function setCloudStatus(message, isError = false) {
        const status = {
            message,
            isError: !!isError,
            at: new Date().toISOString()
        };
        localStorage.setItem(CLOUD_LAST_STATUS_KEY, JSON.stringify(status));
        const box = $('onda-cloud-status-box');
        if (box) {
            box.innerHTML = `${isError ? '⚠️' : '☁️'} ${escapeHtml(message)}<br><span style="opacity:.7">${new Date(status.at).toLocaleString()}</span>`;
            box.style.color = isError ? 'var(--terracotta-peach, #d27d6c)' : 'var(--water-spray, #75b2de)';
        }
        updateCloudStatusLine();
        if (typeof showToast === 'function') showToast(message);
    }

    function updateCloudStatusLine() {
        const config = loadCloudConfig();
        const last = safeJsonParse(localStorage.getItem(CLOUD_LAST_STATUS_KEY), null);
        const labels = document.querySelectorAll('[data-onda-cloud-status-line]');
        const device = config.deviceId ? `${config.deviceLabel || config.deviceId} (${config.deviceId})` : 'not set';
        const lastText = last ? `${last.message} · ${new Date(last.at).toLocaleString()}` : 'No cloud sync yet.';
        labels.forEach(el => {
            el.innerHTML = `Device: <strong>${escapeHtml(device)}</strong><br>Last cloud action: ${escapeHtml(lastText)}`;
        });
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function cloudRequest(action, extra = {}) {
        const config = loadCloudConfig();
        const secret = extra.secret ?? config.secret;
        if (!secret) throw new Error('No sync secret saved yet. Run setup first.');
        const response = await fetch(config.endpoint || DEFAULT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, secret, ...extra })
        });
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (err) { data = { ok: false, error: text || 'Non-JSON response from sync function.' }; }
        if (!response.ok || !data || data.ok === false) {
            throw new Error(data?.error || `Sync failed with HTTP ${response.status}`);
        }
        return data;
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
        } catch (err) {}
        try {
            const raw = localStorage.getItem('ondaActiveLibraryV1') || localStorage.getItem('ondaActiveLibraryLastGoodV1') || localStorage.getItem('ondaActiveLibraryBackupV1');
            const parsed = safeJsonParse(raw, null);
            const tracks = parsed?.library?.tracks || parsed?.tracks || null;
            return tracks && typeof tracks === 'object' ? Object.keys(tracks).length : 0;
        } catch (err) { return 0; }
    }

    function hasAnyLocalOndaState() {
        const importantKeys = [
            'ondaActiveLibraryV1',
            'ondaActiveLibraryBackupV1',
            'ondaActiveLibraryLastGoodV1',
            'ondaVisualizerPresetsV1',
            'ondaActiveVisualizerStackV1',
            'ondaCloudSyncConfigV1'
        ];
        return importantKeys.some(key => !!localStorage.getItem(key)) || getLibraryTrackCount() > 0;
    }

    function openSetupWizard(reason = '') {
        const overlay = $('onda-cloud-modal-overlay');
        const modal = $('onda-cloud-setup-modal');
        const config = loadCloudConfig();
        selectedCloudDeviceId = config.deviceId || selectedCloudDeviceId || '';
        if ($('onda-cloud-secret-input')) $('onda-cloud-secret-input').value = config.secret || '';
        if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = config.deviceId || '';
        if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = config.deviceLabel || '';
        const warning = $('onda-cloud-startup-warning');
        if (warning) {
            if (reason) {
                warning.style.display = 'block';
                warning.textContent = reason;
            } else {
                warning.style.display = 'none';
                warning.textContent = '';
            }
        }
        if (overlay) overlay.classList.add('open');
        if (modal) modal.classList.add('open');
        updateCloudStatusLine();
    }

    function closeSetupWizard() {
        const overlay = $('onda-cloud-modal-overlay');
        const modal = $('onda-cloud-setup-modal');
        if (overlay) overlay.classList.remove('open');
        if (modal) modal.classList.remove('open');
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
        lastDeviceList.forEach(device => {
            const id = sanitizeDeviceId(device.id || device.deviceId || '');
            const label = device.label || device.deviceLabel || id;
            const updated = device.lastSync || device.updatedAt || device.savedAt || '';
            const tracks = Number.isFinite(Number(device.trackCount)) ? `${device.trackCount} tracks` : 'track count unknown';
            const row = document.createElement('div');
            row.className = 'onda-cloud-device-row' + (selectedCloudDeviceId === id ? ' selected' : '');
            row.dataset.deviceId = id;
            row.dataset.deviceLabel = label;
            row.innerHTML = `
                <div style="font-size:1.2rem; color:var(--stone-ochre, #e0a360);">◉</div>
                <div>
                    <div class="onda-cloud-device-name">${escapeHtml(label)}</div>
                    <div class="onda-cloud-device-meta">${escapeHtml(id)} · ${escapeHtml(tracks)}${updated ? ' · ' + escapeHtml(new Date(updated).toLocaleString()) : ''}</div>
                </div>
                <button class="btn-pill" data-use-cloud-device="${escapeHtml(id)}">Use</button>
            `;
            row.addEventListener('click', () => chooseDevice(id, label));
            list.appendChild(row);
        });
    }

    function chooseDevice(id, label = '') {
        selectedCloudDeviceId = sanitizeDeviceId(id);
        if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = selectedCloudDeviceId;
        if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = label || selectedCloudDeviceId;
        renderDeviceList(lastDeviceList);
    }

    async function listCloudDevices() {
        try {
            const secret = $('onda-cloud-secret-input')?.value || loadCloudConfig().secret;
            if (!secret) { setCloudStatus('Enter the sync secret first.', true); return; }
            const result = await cloudRequest('list-devices', { secret });
            renderDeviceList(result.devices || []);
            setCloudStatus(`Loaded ${result.devices?.length || 0} cloud device profile(s).`);
        } catch (err) {
            setCloudStatus(err.message || String(err), true);
        }
    }

    function saveSetupFromFields() {
        const secret = $('onda-cloud-secret-input')?.value || '';
        const deviceId = sanitizeDeviceId($('onda-cloud-device-id')?.value || selectedCloudDeviceId || '');
        const deviceLabel = ($('onda-cloud-device-label')?.value || deviceId).trim() || deviceId;
        if (!secret) { setCloudStatus('Enter the sync secret before saving setup.', true); return null; }
        if (!deviceId) { setCloudStatus('Choose or type a device profile id first.', true); return null; }
        selectedCloudDeviceId = deviceId;
        const config = saveCloudConfig({ secret, deviceId, deviceLabel });
        setCloudStatus(`Setup saved for ${deviceLabel} (${deviceId}).`);
        return config;
    }

    async function testCloudConnection() {
        try {
            const secret = $('onda-cloud-secret-input')?.value || loadCloudConfig().secret;
            if (!secret) { setCloudStatus('Enter the sync secret first.', true); return; }
            const result = await cloudRequest('test', { secret });
            setCloudStatus(result.message || 'Connection OK.');
        } catch (err) {
            setCloudStatus(err.message || String(err), true);
        }
    }

    async function saveCurrentDeviceToCloud() {
        const config = saveSetupFromFields() || loadCloudConfig();
        if (!config.secret || !config.deviceId) { openSetupWizard('Choose a device profile before saving to cloud.'); return; }
        try {
            const payload = getCurrentBackupPayload();
            const trackCount = payload?.library?.tracks ? Object.keys(payload.library.tracks).length : getLibraryTrackCount();
            const result = await cloudRequest('save-device', {
                deviceId: config.deviceId,
                deviceLabel: config.deviceLabel || config.deviceId,
                data: payload,
                trackCount,
                createSnapshot: true
            });
            setCloudStatus(`Saved ${config.deviceLabel || config.deviceId} to cloud · ${result.trackCount ?? trackCount} tracks.`);
        } catch (err) {
            setCloudStatus(err.message || String(err), true);
        }
    }

    async function loadSelectedDeviceFromCloud() {
        const fieldDevice = sanitizeDeviceId($('onda-cloud-device-id')?.value || selectedCloudDeviceId || loadCloudConfig().deviceId);
        const fieldLabel = ($('onda-cloud-device-label')?.value || fieldDevice).trim() || fieldDevice;
        const secret = $('onda-cloud-secret-input')?.value || loadCloudConfig().secret;
        if (!secret || !fieldDevice) { openSetupWizard('Enter your sync secret and choose a device profile before loading from cloud.'); return; }
        saveCloudConfig({ secret, deviceId: fieldDevice, deviceLabel: fieldLabel });
        try {
            const result = await cloudRequest('load-device', { deviceId: fieldDevice, secret });
            if (!result.data) throw new Error('No backup exists for that device profile yet.');
            const ok = confirm(`Load cloud backup for ${fieldLabel}? This will merge/restore the JSON data into this browser.`);
            if (!ok) return;
            applyCloudBackupPayload(result.data);
            setCloudStatus(`Loaded ${fieldLabel} from cloud.`);
            closeSetupWizard();
        } catch (err) {
            setCloudStatus(err.message || String(err), true);
        }
    }

    function insertCloudPanels() {
        const popupBody = document.querySelector('#settings-popup .popup-body');
        if (popupBody && !document.getElementById('onda-cloud-settings-card')) {
            const card = document.createElement('div');
            card.id = 'onda-cloud-settings-card';
            card.className = 'onda-cloud-card';
            card.innerHTML = `
                <div class="onda-cloud-title">☁ Onda Cloud Sync</div>
                <div class="onda-cloud-help">Device profiles stay separate: phone, laptop, work-laptop, etc. The cloud save stores JSON data only, not actual audio files.</div>
                <div class="onda-cloud-status" data-onda-cloud-status-line>No cloud sync yet.</div>
                <div class="onda-cloud-grid">
                    <button id="onda-cloud-open-setup-btn" class="btn-pill">Run Setup Wizard</button>
                    <button id="onda-cloud-save-now-btn" class="btn-pill">Save Device to Cloud</button>
                    <button id="onda-cloud-load-now-btn" class="btn-pill">Load Device from Cloud</button>
                    <button id="onda-cloud-refresh-devices-btn" class="btn-pill">Refresh Devices</button>
                </div>
            `;
            const firstSettingsCard = popupBody.querySelector('.settings-json-tools-card');
            if (firstSettingsCard) popupBody.insertBefore(card, firstSettingsCard.nextSibling);
            else popupBody.prepend(card);
        }

        // Cloud controls belong inside Settings, not in the Library toolbar/header.
        // Static buttons btn-db-save-cloud and btn-db-load-cloud are rendered inside the Settings action panel.
    }

    function bindCloudEvents() {
        $('onda-cloud-close-setup')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-modal-overlay')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-test-btn')?.addEventListener('click', testCloudConnection);
        $('onda-cloud-list-btn')?.addEventListener('click', listCloudDevices);
        $('onda-cloud-save-setup-btn')?.addEventListener('click', () => { if (saveSetupFromFields()) closeSetupWizard(); });
        $('onda-cloud-save-device-btn')?.addEventListener('click', saveCurrentDeviceToCloud);
        $('onda-cloud-load-device-btn')?.addEventListener('click', loadSelectedDeviceFromCloud);
        $('onda-cloud-continue-local-btn')?.addEventListener('click', closeSetupWizard);
        $('onda-cloud-toggle-secret-btn')?.addEventListener('click', () => {
            const input = $('onda-cloud-secret-input');
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
            $('onda-cloud-toggle-secret-btn').textContent = input.type === 'password' ? 'Show Secret' : 'Hide Secret';
        });

        document.addEventListener('click', (event) => {
            const id = event.target?.id;
            if (id === 'onda-cloud-open-setup-btn') openSetupWizard('');
            if (id === 'onda-cloud-save-now-btn' || id === 'btn-db-save-cloud' || id === 'onda-mobile-save-cloud') saveCurrentDeviceToCloud();
            if (id === 'onda-cloud-load-now-btn' || id === 'btn-db-load-cloud' || id === 'onda-mobile-load-cloud') {
                const config = loadCloudConfig();
                if (!config.deviceId || !config.secret) openSetupWizard('Run setup first, then choose which cloud profile this device should use.');
                else {
                    if ($('onda-cloud-secret-input')) $('onda-cloud-secret-input').value = config.secret;
                    if ($('onda-cloud-device-id')) $('onda-cloud-device-id').value = config.deviceId;
                    if ($('onda-cloud-device-label')) $('onda-cloud-device-label').value = config.deviceLabel || config.deviceId;
                    loadSelectedDeviceFromCloud();
                }
            }
            if (id === 'onda-cloud-refresh-devices-btn') {
                openSetupWizard('');
                listCloudDevices();
            }
        });

        $('onda-cloud-device-id')?.addEventListener('input', (event) => {
            const id = sanitizeDeviceId(event.target.value);
            selectedCloudDeviceId = id;
        });
    }

    function maybeShowSetupOnStartup() {
        const config = loadCloudConfig();
        const hasConfig = !!(config.secret && config.deviceId);
        const hasState = hasAnyLocalOndaState();
        const trackCount = getLibraryTrackCount();
        const dismissedAt = Date.parse(localStorage.getItem(CLOUD_SETUP_DISMISSED_KEY) || '');
        const dismissedRecently = Number.isFinite(dismissedAt) && (Date.now() - dismissedAt < 1000 * 60 * 60 * 18);

        if (!hasConfig && !dismissedRecently) {
            openSetupWizard('First setup: choose this device profile and enter the sync secret you created in Netlify.');
            return;
        }
        if (hasConfig && !hasState && !dismissedRecently) {
            openSetupWizard('Warning: no local Onda library/settings were found in this browser. Load a cloud backup, upload a local backup, or continue empty.');
            return;
        }
        if (hasConfig && trackCount === 0 && !dismissedRecently) {
            openSetupWizard('Warning: this browser currently has 0 library tracks. You can load this device profile from Netlify before continuing.');
        }
    }

    function initCloudSyncUI() {
        insertCloudPanels();
        bindCloudEvents();
        updateCloudStatusLine();
        renderDeviceList([]);
        setTimeout(maybeShowSetupOnStartup, 1400);
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
        loadCloudConfig
    };
})();
