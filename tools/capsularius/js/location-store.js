const STORAGE_KEY = 'organon-capsularius-mount-location-v1';

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeAll(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('Capsularius could not persist location metadata.', error);
  }
}

export function normaliseHddPath(value) {
  const raw = String(value || '').trim().replaceAll('/', '\\');
  if (!raw) return '';
  if (/^[A-Za-z]:\\?$/.test(raw)) return raw.slice(0, 2).toUpperCase() + '\\';
  return raw.replace(/\\+$/, '');
}

export function locationForMount(mountId) {
  const entry = readAll()[mountId];
  return entry && typeof entry === 'object' ? entry : {};
}

export function saveLocationForMount(mountId, patch) {
  const all = readAll();
  all[mountId] = { ...(all[mountId] || {}), ...patch, updatedAt: Date.now() };
  writeAll(all);
  return all[mountId];
}

export function removeLocationForMount(mountId) {
  const all = readAll();
  delete all[mountId];
  writeAll(all);
}

export function fullHddPath(mount, pathSegments = []) {
  const stored = locationForMount(mount?.id || '');
  const root = normaliseHddPath(mount?.hddPath || stored.hddPath || '');
  if (!root) return '';
  const tail = pathSegments.filter(Boolean).join('\\');
  if (!tail) return root;
  return root.endsWith('\\') ? `${root}${tail}` : `${root}\\${tail}`;
}
