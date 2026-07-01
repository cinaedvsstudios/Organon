'use strict';

const STORE_NAME = 'onda-sync';
const MANIFEST_KEY = 'devices/index';
const SHARED_KEYS = new Set(['stream-library', 'metadata-overlay', 'visualiser-presets', 'visualizer-presets']);

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}

function sanitizeDeviceId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function sanitizeSharedKey(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return SHARED_KEYS.has(key) ? key : '';
}

function getTrackCountFromBackup(data) {
  const tracks = data?.library?.tracks || data?.library?.library?.tracks || data?.tracks || null;
  return tracks && typeof tracks === 'object' ? Object.keys(tracks).length : 0;
}

async function getBlobStore() {
  const { getStore } = await import('@netlify/blobs');

  const siteID = process.env.ONDA_NETLIFY_SITE_ID || process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '';
  const token = process.env.ONDA_NETLIFY_TOKEN || process.env.NETLIFY_AUTH_TOKEN || '';

  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }

  try {
    return getStore(STORE_NAME);
  } catch (error) {
    const hint = 'Automatic Netlify Blobs context was not available. Add ONDA_NETLIFY_SITE_ID and ONDA_NETLIFY_TOKEN as environment variables, then redeploy.';
    error.message = `${error.message} ${hint}`;
    throw error;
  }
}

async function getJson(store, key, fallback = null) {
  const value = await store.get(key, { type: 'json' });
  return value || fallback;
}

async function setJson(store, key, value) {
  await store.setJSON(key, value);
}

async function getManifest(store) {
  const manifest = await getJson(store, MANIFEST_KEY, { devices: [] });
  if (!manifest || !Array.isArray(manifest.devices)) return { devices: [] };
  return manifest;
}

async function saveManifest(store, manifest) {
  const clean = {
    version: 1,
    updatedAt: new Date().toISOString(),
    devices: Array.isArray(manifest.devices) ? manifest.devices : []
  };
  await setJson(store, MANIFEST_KEY, clean);
  return clean;
}

async function listDevicesFromBlobs(store) {
  const listed = await store.list({ prefix: 'devices/' });
  const blobs = Array.isArray(listed?.blobs) ? listed.blobs : [];
  const ids = new Set();

  blobs.forEach((blob) => {
    const key = blob.key || '';
    const match = key.match(/^devices\/([^/]+)\/full-backup$/);
    if (match && match[1] !== 'index') ids.add(match[1]);
  });

  return Array.from(ids).map((id) => ({ id, label: id, key: `devices/${id}/full-backup` }));
}

async function upsertDeviceManifest(store, { id, label, trackCount }) {
  const manifest = await getManifest(store);
  const now = new Date().toISOString();
  const devices = manifest.devices.filter((device) => device.id !== id);

  devices.push({
    id,
    label: label || id,
    key: `devices/${id}/full-backup`,
    trackCount: Number.isFinite(Number(trackCount)) ? Number(trackCount) : 0,
    lastSync: now,
    updatedAt: now
  });

  devices.sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));
  return saveManifest(store, { devices });
}

async function verifyBlobStore(store) {
  // A store object can be created even when the deployed function lacks usable
  // Blob credentials. A real read is required before reporting success.
  await store.get(MANIFEST_KEY, { type: 'json' });
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { ok: false, error: 'Use POST.' });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return response(400, { ok: false, error: 'Request body must be valid JSON.' });
  }

  const expectedSecret = process.env.ONDA_SYNC_SECRET || '';
  if (!expectedSecret) {
    return response(500, { ok: false, error: 'ONDA_SYNC_SECRET is not configured in Netlify environment variables.' });
  }

  if (!body.secret || body.secret !== expectedSecret) {
    return response(401, { ok: false, error: 'Invalid Onda sync secret.' });
  }

  const action = String(body.action || '').trim();
  let store;
  try {
    store = await getBlobStore();
  } catch (error) {
    return response(500, { ok: false, error: `Could not open Netlify Blob store: ${error.message}` });
  }

  try {
    if (action === 'test') {
      await verifyBlobStore(store);
      return response(200, { ok: true, message: 'Onda cloud sync function and Blob store are connected.' });
    }

    if (action === 'list-devices') {
      const manifest = await getManifest(store);
      const fallbackDevices = manifest.devices.length ? [] : await listDevicesFromBlobs(store);
      const devices = manifest.devices.length ? manifest.devices : fallbackDevices;
      return response(200, { ok: true, devices });
    }

    if (action === 'save-device') {
      const deviceId = sanitizeDeviceId(body.deviceId);
      if (!deviceId) return response(400, { ok: false, error: 'Missing or invalid deviceId.' });
      if (!body.data || typeof body.data !== 'object') return response(400, { ok: false, error: 'Missing backup data.' });

      const now = new Date().toISOString();
      const trackCount = Number.isFinite(Number(body.trackCount)) ? Number(body.trackCount) : getTrackCountFromBackup(body.data);
      const envelope = {
        ...body.data,
        cloud: {
          ...(body.data.cloud || {}),
          deviceId,
          deviceLabel: body.deviceLabel || deviceId,
          savedAt: now,
          trackCount
        }
      };

      const key = `devices/${deviceId}/full-backup`;
      await setJson(store, key, envelope);

      let snapshotKey = null;
      if (body.createSnapshot) {
        const safeTimestamp = now.replace(/[:.]/g, '-');
        snapshotKey = `snapshots/${deviceId}/${safeTimestamp}`;
        await setJson(store, snapshotKey, envelope);
      }

      const manifest = await upsertDeviceManifest(store, {
        id: deviceId,
        label: body.deviceLabel || deviceId,
        trackCount
      });

      return response(200, {
        ok: true,
        key,
        snapshotKey,
        trackCount,
        devices: manifest.devices,
        savedAt: now
      });
    }

    if (action === 'load-device') {
      const deviceId = sanitizeDeviceId(body.deviceId);
      if (!deviceId) return response(400, { ok: false, error: 'Missing or invalid deviceId.' });
      const key = `devices/${deviceId}/full-backup`;
      const data = await getJson(store, key, null);
      if (!data) return response(404, { ok: false, error: `No cloud backup found for ${deviceId}.` });
      return response(200, { ok: true, key, data, trackCount: getTrackCountFromBackup(data) });
    }

    if (action === 'delete-device') {
      const deviceId = sanitizeDeviceId(body.deviceId);
      if (!deviceId) return response(400, { ok: false, error: 'Missing or invalid deviceId.' });
      await store.delete(`devices/${deviceId}/full-backup`);
      const manifest = await getManifest(store);
      manifest.devices = manifest.devices.filter((device) => device.id !== deviceId);
      await saveManifest(store, manifest);
      return response(200, { ok: true, deleted: deviceId, devices: manifest.devices });
    }

    if (action === 'save-shared') {
      const sharedKey = sanitizeSharedKey(body.sharedKey);
      if (!sharedKey) return response(400, { ok: false, error: 'Invalid sharedKey.' });
      if (!body.data || typeof body.data !== 'object') return response(400, { ok: false, error: 'Missing shared data.' });
      const key = `shared/${sharedKey}`;
      await setJson(store, key, { ...body.data, cloudUpdatedAt: new Date().toISOString() });
      return response(200, { ok: true, key });
    }

    if (action === 'load-shared') {
      const sharedKey = sanitizeSharedKey(body.sharedKey);
      if (!sharedKey) return response(400, { ok: false, error: 'Invalid sharedKey.' });
      const key = `shared/${sharedKey}`;
      const data = await getJson(store, key, null);
      if (!data) return response(404, { ok: false, error: `No shared JSON found for ${sharedKey}.` });
      return response(200, { ok: true, key, data });
    }

    return response(400, { ok: false, error: `Unknown action: ${action || '(empty)'}` });
  } catch (error) {
    return response(500, { ok: false, error: error.message || String(error) });
  }
};
