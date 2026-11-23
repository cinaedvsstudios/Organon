/* Organon Storage Manager v1.0 — same-origin data is NEVER automatically assumed to belong to Organon. */
(function () {
  'use strict';

  const appId = 'organon';
  const exact = new Set([
    'organon_force_mobile_view', 'organon_storage_manager_autoclean_v1',
    'palm_speeches', 'palm_fontsize',
    'uiRepositoryBuilderState_v002', 'uiRepositoryUiState_v002', 'uiRepositoryDockState_v002',
    'ui_repo_basket', 'ui_repo_builder', 'ui_repo_ui',
    'ondaCloudSyncConfigV1', 'ondaCloudSyncLastStatusV1', 'ondaCloudSetupDismissedV1',
    'ondaCloudDeviceIdV1', 'onda-cloud-device-id', 'ondaCloudLastSyncV1'
  ]);
  const prefixes = [
    'organon_', 'organon.', 'organon-', 'onda', 'Onda', 'capsularius.',
    'ihy-v', 'locadate_', 'orgavox', 'motori-', 'uiRepository'
  ];
  const knownDatabases = new Set([
    'organon-capsularius', 'OndaMediaPlayerPersistentDB',
    'motori-advanced-media-handles-v1', 'organon-image-calculator-shell'
  ]);
  // Add a source explicitly for each locally edited JSON dataset known to have a published counterpart.
  // Example: { 'my-app:edited-records': { url: '/Organon/path/to/data.json' } }
  // No matching server source is currently configured: do not infer uploads from filenames.
  const serverSources = Object.assign(Object.create(null), window.ORGANON_STORAGE_SYNC_TARGETS || {});
  const disposable = new Set([
    'ondaCloudSyncLastStatusV1', 'ondaLibraryRestoreReportV1',
    'ondaLastLibrarySaveStatusV1', 'ihy-v045-toast'
  ]);
  let entries = [], meta = [], scanBusy = false, selectedCategories = new Set(['Temporary data']);
  let previewed = null;
  const $ = (id) => document.getElementById(id);

  function owns(key) {
    return exact.has(key) || prefixes.some(prefix => key.startsWith(prefix));
  }
  function categoryOf(key) {
    if (disposable.has(key)) return 'Temporary data';
    if (/backup|autosave|draft|project|history|lastgood|library|playlist|speech|media|filemetadata|file-handle|document|track/i.test(key)) return 'Projects & user data';
    if (/setting|config|option|view|zoom|width|height|theme|layout|mode|active|preset|ui|font|toggle|preferences/i.test(key)) return 'Settings & preferences';
    return 'Other app data';
  }
  function isSafe(entry) {
    return entry.owned && entry.category === 'Temporary data' && (entry.type === 'localStorage' || entry.type === 'sessionStorage');
  }
  function bytes(str) {
    try { return new Blob([str]).size; } catch (_) { return String(str).length * 2; }
  }
  function sizeLabel(n) {
    if (!Number.isFinite(n) || n < 0) return 'Unknown';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function note(message, error) {
    const el = $('osm-message');
    if (el) {
      el.textContent = message;
      el.classList.toggle('osm-error', !!error);
    }
  }
  function addStorage(storage, type) {
    try {
      const keys = Object.keys(storage).sort();
      for (const key of keys) {
        const value = storage.getItem(key);
        if (value === null) continue;
        const owned = owns(key), category = owned ? categoryOf(key) : 'Unclassified / other apps';
        entries.push({
          id: type + ':' + key, type, key, value, owned, category,
          size: bytes(key) + bytes(value),
          status: serverSources[key] ? 'Awaiting verification' : 'No server source',
          protected: !owned || !disposable.has(key),
          editable: owned, removable: owned
        });
      }
    } catch (err) {
      meta.push(type + ': not accessible (' + (err.message || String(err)) + ')');
    }
  }
  async function scanDatabases() {
    if (!window.indexedDB) {
      meta.push('IndexedDB: not available');
      return;
    }
    if (typeof indexedDB.databases !== 'function') {
      meta.push('IndexedDB: database listing unsupported; existing databases were not opened');
      return;
    }
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (!db.name) continue;
        const owned = knownDatabases.has(db.name);
        entries.push({
          id: 'IndexedDB:' + db.name, type: 'IndexedDB', key: db.name, owned,
          category: owned ? 'Projects & user data' : 'Unclassified / other apps',
          size: NaN, status: 'Local database (not server-verified)', protected: true,
          editable: false, removable: owned, database: true, version: db.version
        });
      }
    } catch (err) {
      meta.push('IndexedDB: ' + (err.message || String(err)));
    }
  }
  async function scanCaches() {
    if (!('caches' in window)) {
      meta.push('Cache Storage: not supported');
      return;
    }
    try {
      const names = await caches.keys();
      for (const name of names) {
        // Only explicit namespaced caches can be owned: origin-wide service-worker caches
        // can serve multiple repositories and must never be removed by a broad prefix guess.
        const owned = name.startsWith('organon-cache-v') || name.startsWith('organon:cache:');
        entries.push({
          id: 'Cache Storage:' + name, type: 'Cache Storage', key: name, owned,
          category: owned ? 'Cache & previews' : 'Unclassified / other apps',
          size: NaN, status: 'Not server-verified', protected: true,
          editable: false, removable: owned, cache: true
        });
      }
    } catch (err) {
      meta.push('Cache Storage: ' + (err.message || String(err)));
    }
  }
  async function scanOther() {
    if (navigator.storage && navigator.storage.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory();
        let count = 0;
        for await (const handle of root.values()) count++;
        meta.push('OPFS: ' + count + ' origin-wide top-level entries; protected from bulk cleanup');
      } catch (err) {
        meta.push('OPFS: unavailable (' + (err.message || String(err)) + ')');
      }
    } else meta.push('OPFS: unavailable in this browser/context');
    try {
      const count = document.cookie ? document.cookie.split(';').length : 0;
      meta.push('Cookies: ' + count + ' JavaScript-visible origin cookies (contents hidden, never cleared)');
    } catch (_) {
      meta.push('Cookies: inaccessible');
    }
  }
  async function scan() {
    if (scanBusy) return;
    scanBusy = true;
    note('Inspecting browser storage...');
    entries = []; meta = [];
    addStorage(window.localStorage, 'localStorage');
    addStorage(window.sessionStorage, 'sessionStorage');
    await Promise.all([scanDatabases(), scanCaches(), scanOther()]);
    scanBusy = false;
    await render();
    note('Storage scan complete. Unknown and shared entries are never eligible for deletion.');
  }
  function download(filename, body, mime) {
    const blob = new Blob([body], {type: mime || 'application/json'});
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  }
  function backupObject() {
    const local = {}, session = {};
    for (const entry of entries) {
      if (!entry.owned || entry.value === undefined) continue;
      if (entry.type === 'localStorage') local[entry.key] = entry.value;
      else if (entry.type === 'sessionStorage') session[entry.key] = entry.value;
    }
    return {
      format: 'organon-storage-backup-v1', appId, createdAt: new Date().toISOString(),
      note: 'Only known Organon localStorage/sessionStorage. IndexedDB media/files, Cache Storage and OPFS are NOT included.',
      localStorage: local, sessionStorage: session
    };
  }
  async function downloadBackup() {
    await scan();
    const payload = backupObject();
    download('organon-storage-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(payload, null, 2));
    note('Backup file prepared. This export excludes IndexedDB, Cache Storage and OPFS.');
  }
  function parseBackup(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('Invalid backup structure');
    const data = value.format === 'organon-storage-backup-v1' ? value.localStorage : value;
    if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Backup has no localStorage data');
    const allowed = Object.entries(data).filter(([key, val]) => owns(key) && typeof val === 'string');
    const skipped = Object.keys(data).length - allowed.length;
    return {allowed, skipped};
  }
  function importBackup(value, mode) {
    const parsed = parseBackup(value);
    if (!parsed.allowed.length) throw Error('No recognised Organon storage keys in backup');
    const details = parsed.allowed.length + ' recognised entries; ' + parsed.skipped + ' unrelated/invalid entries ignored.';
    if (mode === 'replace') {
      if (!confirm('Replace Organon localStorage entries ONLY?\n\n' + details +
        '\n\nUnsaved local work may be overwritten. IndexedDB and other apps will NOT be changed.')) return false;
      for (const key of Object.keys(localStorage)) if (owns(key)) localStorage.removeItem(key);
    } else if (!confirm('Merge Organon settings and data from this file?\n\n' + details +
      '\nExisting values with matching keys will be overwritten.')) return false;
    for (const [key, value] of parsed.allowed) localStorage.setItem(key, value);
    note('Imported ' + parsed.allowed.length + ' Organon entries. ' + parsed.skipped + ' skipped.');
    return true;
  }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  async function verify(entry) {
    const source = serverSources[entry.key];
    if (!source || !source.url || entry.value === undefined) {
      note('No verified public server source is configured for that record. It remains protected.');
      return false;
    }
    try {
      // Only same-origin sources explicitly configured in source code are eligible.
      const url = new URL(source.url, location.href);
      if (url.origin !== location.origin || url.protocol !== 'https:') throw Error('A same-origin HTTPS source is required');
      const response = await fetch(url.href, {cache: 'no-store'});
      if (!response.ok) throw Error('Server returned ' + response.status);
      const server = await response.json();
      const local = JSON.parse(entry.value);
      if (stable(server) !== stable(local)) {
        entry.status = 'Different / unpublished changes';
        note('Local data differs from published data. No deletion was performed.');
        await render();
        return false;
      }
      entry.status = 'Server verified';
      note('Exact published match verified for ' + entry.key + '.');
      await render();
      const auto = localStorage.getItem('organon_storage_manager_autoclean_v1') === 'true';
      if (auto && source.allowAutomaticRemoval === true) await deleteOne(entry, true);
      return true;
    } catch (err) {
      entry.status = 'Unverified';
      note('Could not verify ' + entry.key + ': ' + (err.message || String(err)) + '. Local copy retained.', true);
      await render();
      return false;
    }
  }
  async function removeDatabase(name) {
    return new Promise(resolve => {
      let settled = false;
      const finish = success => { if (!settled) {settled = true; resolve(success);} };
      try {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
        req.onblocked = () => finish(false);
        setTimeout(() => finish(false), 3500);
      } catch (_) { finish(false); }
    });
  }
  async function deleteOne(entry, verifiedAuto) {
    if (!entry.owned || !entry.removable) return false;
    if (verifiedAuto && entry.status !== 'Server verified') return false;
    if (!verifiedAuto) {
      const warning = entry.protected ? 'This is protected application data and may contain user work.\n\n' : '';
      if (!confirm(warning + 'Delete ' + entry.type + ' entry "' + entry.key + '"?\nThis cannot be undone.')) return false;
    }
    try {
      if (entry.type === 'localStorage') localStorage.removeItem(entry.key);
      else if (entry.type === 'sessionStorage') sessionStorage.removeItem(entry.key);
      else if (entry.type === 'IndexedDB') {if (!await removeDatabase(entry.key)) throw Error('Database busy/blocked');}
      else if (entry.type === 'Cache Storage') {if (!await caches.delete(entry.key)) throw Error('Cache not deleted');}
      else return false;
      await scan();
      note('Deleted ' + entry.key + '.');
      return true;
    } catch (err) {
      note('Deletion failed: ' + (err.message || String(err)), true);
      return false;
    }
  }
  async function quickClean() {
    const safe = entries.filter(isSafe);
    if (!safe.length) return note('No confirmed disposable Organon entries found. Protected entries were not touched.');
    if (!confirm('Remove ' + safe.length + ' confirmed disposable entries (' +
      sizeLabel(safe.reduce((sum, e) => sum + (Number.isFinite(e.size) ? e.size : 0), 0)) +
      ')?\nSettings, projects, drafts and unverified data will be kept.')) return;
    let removed = 0;
    for (const e of safe) {
      try { (e.type === 'sessionStorage' ? sessionStorage : localStorage).removeItem(e.key); removed++; }
      catch (err) { meta.push(e.key + ': ' + (err.message || String(err))); }
    }
    await scan();
    note('Quick Clean removed ' + removed + ' temporary entries. Everything else was preserved.');
  }
  async function clearSelected() {
    const candidates = entries.filter(e => selectedCategories.has(e.category) && isSafe(e));
    if (!candidates.length) return note('Selected categories contain no verified disposable entries. Protected data was not selected.');
    if (!confirm('Remove ' + candidates.length + ' safe entries from the chosen categories?')) return;
    for (const e of candidates) (e.type === 'sessionStorage' ? sessionStorage : localStorage).removeItem(e.key);
    await scan();
    note('Removed ' + candidates.length + ' safe entries. Protected data was not touched.');
  }
  async function clearEverything() {
    const known = entries.filter(e => e.owned && e.removable);
    const protectedCount = known.filter(e => e.protected).length;
    if (!known.length) return note('No confirmed Organon-owned browser storage found.');
    const ok = confirm('RESET ORGANON STORAGE\n\n' + known.length + ' known Organon entries will be removed, including ' +
      protectedCount + ' protected settings/projects/drafts/databases.\n\nNo automatic backup is possible for every IndexedDB/OPFS item. Export work separately first.\n' +
      'Unclassified and other-app entries will be preserved.\n\nContinue?');
    if (!ok) return;
    if (prompt('Type CLEAR ORGANON to confirm removal of user data:') !== 'CLEAR ORGANON') return;
    let removed = 0, failed = [];
    for (const e of known) {
      try {
        if (e.type === 'localStorage') localStorage.removeItem(e.key);
        else if (e.type === 'sessionStorage') sessionStorage.removeItem(e.key);
        else if (e.type === 'IndexedDB' && !(await removeDatabase(e.key))) throw Error('Database blocked');
        else if (e.type === 'Cache Storage' && !(await caches.delete(e.key))) throw Error('Cache blocked');
        removed++;
      } catch (err) { failed.push(e.key + ': ' + (err.message || String(err))); }
    }
    await scan();
    note('Removed ' + removed + ' Organon entries.' +
      (failed.length ? ' Failed: ' + failed.join('; ') : ' Reload the app to reset in-memory settings.'), !!failed.length);
  }
  function formatValue(value) {
    try { return JSON.stringify(JSON.parse(value), null, 2); }
    catch (_) { return value; }
  }
  function selectedEntry() { return entries.find(e => e.id === previewed); }
  function view(entry) {
    previewed = entry.id;
    const box = $('osm-inspector');
    if (!box) return;
    const canEdit = entry.owned && entry.editable;
    box.hidden = false;
    $('osm-inspector-title').textContent = entry.key + ' · ' + entry.type +
      (entry.owned ? ' · Organon-owned' : ' · Shared/unknown: read only');
    $('osm-value').value = entry.value === undefined ? 'No generic editor is available for this storage type.' : formatValue(entry.value);
    $('osm-value').readOnly = !canEdit;
    $('osm-save').disabled = !canEdit;
    $('osm-delete').disabled = !entry.removable;
    $('osm-verify').disabled = !serverSources[entry.key] || entry.value === undefined;
    $('osm-export-entry').disabled = entry.value === undefined;
  }
  async function saveEntry() {
    const entry = selectedEntry();
    if (!entry || !entry.owned || !entry.editable) return;
    const value = $('osm-value').value;
    // Existing JSON records must remain valid JSON; do not rewrite formatting merely for inspection.
    try { JSON.parse(entry.value); JSON.parse(value); }
    catch (_) {
      if (/^\s*[\[{]/.test(entry.value) || /^\s*[\[{]/.test(value)) {
        return note('Invalid JSON. The original entry was not modified.', true);
      }
    }
    if (!confirm('Overwrite ' + entry.key + ' with the edited value?')) return;
    try {
      (entry.type === 'sessionStorage' ? sessionStorage : localStorage).setItem(entry.key, value);
      await scan();
      note('Saved ' + entry.key + '. If this is application state, reload its tool before editing further.');
    } catch (err) { note('Save failed: ' + (err.message || String(err)), true); }
  }
  async function render() {
    const owned = entries.filter(e => e.owned);
    const total = owned.reduce((sum, e) => sum + (Number.isFinite(e.size) ? e.size : 0), 0);
    $('osm-summary').textContent = owned.length + ' recognised Organon entries · ' +
      sizeLabel(total) + ' measurable app data · ' + entries.length + ' origin-wide entries detected';
    const safe = entries.filter(isSafe);
    $('osm-safe').textContent = 'Quick-clean eligible: ' + safe.length + ' (' +
      sizeLabel(safe.reduce((s, e) => s + (e.size || 0), 0)) + ')';
    const categories = [...new Set(entries.filter(e => e.owned).map(e => e.category))];
    const categoryPanel = $('osm-categories');
    categoryPanel.replaceChildren();
    for (const category of categories) {
      const items = entries.filter(e => e.owned && e.category === category);
      const row = document.createElement('label');
      row.className = 'osm-category';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedCategories.has(category);
      checkbox.disabled = !items.some(isSafe);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedCategories.add(category);
        else selectedCategories.delete(category);
      });
      const copy = document.createElement('span');
      copy.textContent = category + ' · ' + items.length + ' entries · ' +
        sizeLabel(items.reduce((s, e) => s + (Number.isFinite(e.size) ? e.size : 0), 0)) +
        (items.some(isSafe) ? ' · confirmed disposable items available' : ' · protected/review only');
      row.append(checkbox, copy);
      categoryPanel.append(row);
    }
    let quota = 'Origin-wide quota unavailable';
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        quota = 'Entire shared origin: ' + sizeLabel(estimate.usage) + ' used / ' + sizeLabel(estimate.quota) +
          ' quota (includes other projects; not an Organon-only measurement)';
      } catch (_) {}
    }
    $('osm-quota').textContent = quota;
    $('osm-technical').textContent = meta.join(' · ') || 'Storage APIs inspected; detailed modification dates are not available for legacy records.';
    const term = $('osm-search').value.toLowerCase().trim();
    const scope = $('osm-filter').value;
    const list = $('osm-list');
    list.replaceChildren();
    let visible = entries.filter(e => (!term || (e.key + ' ' + e.category + ' ' + e.type).toLowerCase().includes(term)) &&
      (scope === 'all' || (scope === 'owned' && e.owned) || (scope === 'unknown' && !e.owned) ||
       (scope === 'safe' && isSafe(e)) || scope === e.type));
    visible.sort((a, b) => (a.owned === b.owned ? a.key.localeCompare(b.key) : a.owned ? -1 : 1));
    for (const e of visible.slice(0, 300)) {
      const row = document.createElement('div');
      row.className = 'osm-record';
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = e.key;
      const sub = document.createElement('small');
      sub.textContent = e.type + ' · ' + e.category + ' · ' + sizeLabel(e.size) + ' · ' +
        (e.protected ? 'Protected' : 'Disposable') + ' · ' + e.status;
      info.append(name, sub);
      const btn = document.createElement('button');
      btn.textContent = 'Inspect';
      btn.className = 'osm-button';
      btn.addEventListener('click', () => view(e));
      row.append(info, btn);
      list.append(row);
    }
    if (visible.length > 300) {
      const more = document.createElement('p');
      more.textContent = (visible.length - 300) + ' more entries. Narrow your search to inspect them.';
      list.append(more);
    }
    if (!visible.length) list.textContent = 'No matching storage entries.';
    const autoBox = $('osm-auto');
    autoBox.checked = localStorage.getItem('organon_storage_manager_autoclean_v1') === 'true';
    autoBox.disabled = !Object.keys(serverSources).length;
    $('osm-auto-explain').textContent = Object.keys(serverSources).length ?
      'Only exact matches from explicitly configured same-origin data sources can be automatically removed.' :
      'Unavailable: no Organon JSON server sources have been configured. Local edits remain protected.';
  }
  function show() {
    if (!$('osm-overlay')) return;
    $('osm-overlay').hidden = false;
    $('osm-overlay').style.display = 'flex';
    $('osm-overlay').classList.add('open');
    $('osm-inspector').hidden = true;
    scan().catch(err => note('Scan failed: ' + (err.message || String(err)), true));
  }
  function hide() {
    const overlay = $('osm-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    overlay.hidden = true;
  }
  function attach() {
    if (!$('osm-overlay')) return;
    $('osm-close').addEventListener('click', hide);
    $('osm-overlay').addEventListener('click', e => { if (e.target.id === 'osm-overlay') hide(); });
    $('osm-refresh').addEventListener('click', scan);
    $('osm-quick').addEventListener('click', quickClean);
    $('osm-clear-selected').addEventListener('click', clearSelected);
    $('osm-clear-all').addEventListener('click', clearEverything);
    $('osm-backup').addEventListener('click', downloadBackup);
    $('osm-search').addEventListener('input', render);
    $('osm-filter').addEventListener('change', render);
    $('osm-inspector-close').addEventListener('click', () => { $('osm-inspector').hidden = true; });
    $('osm-save').addEventListener('click', saveEntry);
    $('osm-delete').addEventListener('click', async () => {
      const e = selectedEntry(); if (e) await deleteOne(e, false);
      $('osm-inspector').hidden = true;
    });
    $('osm-export-entry').addEventListener('click', () => {
      const e = selectedEntry();
      if (e && e.value !== undefined) download('organon-entry-' + e.key.replace(/[^a-z0-9-]/gi, '_') + '.txt', e.value, 'text/plain');
    });
    $('osm-verify').addEventListener('click', async () => { const e = selectedEntry(); if (e) await verify(e); });
    $('osm-verify-all').addEventListener('click', async () => {
      const eligible = entries.filter(e => e.owned && serverSources[e.key] && e.value !== undefined);
      if (!eligible.length) return note('No server verification sources configured for the current storage entries.');
      for (const e of eligible) await verify(e);
    });
    $('osm-auto').addEventListener('change', e => {
      localStorage.setItem('organon_storage_manager_autoclean_v1', e.target.checked ? 'true' : 'false');
      note(e.target.checked ? 'Automatic removal enabled only for explicitly approved, exactly verified duplicates.' : 'Automatic server-verified cleanup disabled.');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('osm-overlay') && !$('osm-overlay').hidden) hide();
    });
  }
  window.OrganonStorageManager = {show, hide, scan, downloadBackup, importBackup, owns};
  window.openOrganonStorageManager = function () {
    if (typeof window.closeSettingsModal === 'function') window.closeSettingsModal();
    show();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
