'use strict';

const elements = {
  mountFolder: document.getElementById('mountFolder'),
  refreshFolder: document.getElementById('refreshFolder'),
  includeSubfolders: document.getElementById('includeSubfolders'),
  folderName: document.getElementById('folderName'),
  permissionNote: document.getElementById('permissionNote'),
  driveCount: document.getElementById('driveCount'),
  driveFilter: document.getElementById('driveFilter'),
  driveList: document.getElementById('driveList'),
  pasteList: document.getElementById('pasteList'),
  clearList: document.getElementById('clearList'),
  matchSummary: document.getElementById('matchSummary'),
  requestList: document.getElementById('requestList'),
  actionCount: document.getElementById('actionCount'),
  archiveFiles: document.getElementById('archiveFiles'),
  deleteFiles: document.getElementById('deleteFiles'),
  choiceDialog: document.getElementById('choiceDialog'),
  choicePrompt: document.getElementById('choicePrompt'),
  choiceList: document.getElementById('choiceList'),
  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmCopy: document.getElementById('confirmCopy'),
  confirmAction: document.getElementById('confirmAction'),
  toast: document.getElementById('toast')
};

const state = {
  rootHandle: null,
  files: [],
  requests: [],
  driveFilter: '',
  busy: false
};

function setHubStatus(text) {
  window.parent?.postMessage?.({ type: 'set-status', text }, '*');
}

function clearHubStatus() {
  window.parent?.postMessage?.({ type: 'clear-status' }, '*');
}

function flash(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => elements.toast.classList.remove('show'), 2800);
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .replaceAll('\\', '/')
    .replace(/^file:\/\//i, '')
    .replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, '')
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .trim();
}

function key(value) {
  return normalize(value).toLocaleLowerCase();
}

function basename(path) {
  return normalize(path).split('/').pop() || '';
}

function stem(name) {
  const clean = basename(name);
  const dot = clean.lastIndexOf('.');
  return dot > 0 ? clean.slice(0, dot) : clean;
}

function extension(name) {
  const clean = basename(name);
  const dot = clean.lastIndexOf('.');
  return dot > 0 && dot < clean.length - 1 ? clean.slice(dot + 1).toLocaleLowerCase() : '';
}

async function walkDirectory(directoryHandle, prefix = '') {
  const records = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    if (!prefix && handle.kind === 'directory' && name.toLocaleLowerCase() === 'archive') continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      records.push({ name, path, handle, parentHandle: directoryHandle });
    } else if (elements.includeSubfolders.checked) {
      records.push(...await walkDirectory(handle, path));
    }
  }
  return records;
}

async function scanMountedFolder() {
  if (!state.rootHandle || state.busy) return;
  setBusy(true, 'Scanning folder…');
  try {
    state.files = (await walkDirectory(state.rootHandle)).sort((a, b) =>
      a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' })
    );
    state.requests.forEach(resolveRequest);
    renderAll();
    elements.permissionNote.textContent = `${state.files.length} file${state.files.length === 1 ? '' : 's'} available for comparison. The root archive folder is excluded.`;
    setHubStatus(`Filedeletr scanned ${state.files.length} local files.`);
    setTimeout(clearHubStatus, 2200);
  } catch (error) {
    console.error(error);
    flash('The mounted folder could not be read.');
  } finally {
    setBusy(false);
  }
}

async function mountFolder() {
  if (!('showDirectoryPicker' in window)) {
    elements.permissionNote.textContent = 'This browser cannot safely delete or move local files. Open Organon in current Chrome or Edge.';
    flash('Writable folder access is unavailable in this browser.');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    state.rootHandle = handle;
    elements.folderName.textContent = handle.name;
    elements.folderName.title = handle.name;
    elements.refreshFolder.disabled = false;
    elements.driveFilter.disabled = false;
    await scanMountedFolder();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.error(error);
    flash('Folder access was not granted.');
  }
}

function protectKnownFilenames(rawText) {
  if (!state.files.length) return { text: rawText, values: [] };
  const aliases = [...new Set(state.files.flatMap(file => [file.path, file.name]).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  const values = [];
  let text = rawText;

  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '[\\\\/]');
    const expression = new RegExp(`(^|[\\s,;:\\t\\n\\r"'([{])(${escaped})(?=$|[\\s,;:\\t\\n\\r"')\\]}])`, 'giu');
    text = text.replace(expression, (match, prefix, found) => {
      const index = values.push(found) - 1;
      return `${prefix}\uE000${index}\uE001`;
    });
  }
  return { text, values };
}

function splitUnprotectedSegment(segment, protectedValues) {
  const tokenPattern = /\uE000\d+\uE001|"[^"]+"|'[^']+'|\S+/gu;
  const tokens = segment.match(tokenPattern) || [];
  const output = [];
  let looseWords = [];

  const flushLoose = () => {
    const joined = normalize(looseWords.join(' '));
    if (joined) output.push(joined);
    looseWords = [];
  };

  for (const token of tokens) {
    const protectedMatch = token.match(/^\uE000(\d+)\uE001$/u);
    if (protectedMatch) {
      flushLoose();
      output.push(normalize(protectedValues[Number(protectedMatch[1])]));
      continue;
    }
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      flushLoose();
      output.push(normalize(token.slice(1, -1)));
      continue;
    }
    looseWords.push(token);
    if (/\.[\p{L}\p{N}]{1,12}[)\]}"']?$/u.test(token)) flushLoose();
  }
  flushLoose();
  return output;
}

function smartSplit(rawText) {
  const source = String(rawText || '').replaceAll('\u00a0', ' ').trim();
  if (!source) return [];
  const protectedData = protectKnownFilenames(source);
  let delimiterNormalized = '';
  for (let index = 0; index < protectedData.text.length; index += 1) {
    const character = protectedData.text[index];
    if (character !== ':') {
      delimiterNormalized += character;
      continue;
    }
    const before = protectedData.text[index - 1] || '';
    const after = protectedData.text[index + 1] || '';
    const beforeDrive = protectedData.text[index - 2] || '';
    const isDriveColon = /[A-Za-z]/u.test(before) && /[\\/]/u.test(after) && (index === 1 || /[\s,;\n\r\t]/u.test(beforeDrive));
    delimiterNormalized += isDriveColon ? ':' : '\n';
  }
  const segments = delimiterNormalized.split(/[\n\r\t,;]+/u);
  const names = segments.flatMap(segment => splitUnprotectedSegment(segment.trim(), protectedData.values));
  return names.filter(Boolean);
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function similarity(requested, candidate) {
  const requestedName = key(basename(requested));
  const candidateName = key(basename(candidate));
  const longest = Math.max(requestedName.length, candidateName.length, 1);
  let score = 1 - (levenshtein(requestedName, candidateName) / longest);
  const requestedStem = key(stem(requestedName));
  const candidateStem = key(stem(candidateName));
  if (requestedStem && candidateStem && (requestedStem.includes(candidateStem) || candidateStem.includes(requestedStem))) score += .1;
  if (extension(requestedName) && extension(requestedName) === extension(candidateName)) score += .08;
  return Math.min(score, 1);
}

function candidateFiles(requested) {
  return state.files
    .map(file => ({ file, score: Math.max(similarity(requested, file.name), similarity(requested, file.path)) }))
    .filter(item => item.score >= .58 || levenshtein(key(basename(requested)), key(item.file.name)) <= 3)
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path, undefined, { numeric: true, sensitivity: 'base' }))
    .slice(0, 6)
    .map(item => item.file);
}

function resolveRequest(request) {
  if (request.status === 'done') return request;
  const requestedKey = key(request.original);
  const requestedBase = key(basename(request.original));
  const pathMatches = state.files.filter(file => key(file.path) === requestedKey);
  const nameMatches = state.files.filter(file => key(file.name) === requestedBase);
  const exact = normalize(request.original).includes('/') ? pathMatches : nameMatches;

  request.match = null;
  request.candidates = [];
  request.message = '';

  if (exact.length === 1) {
    request.status = 'waiting';
    request.match = exact[0];
    request.selected = request.selected !== false;
  } else if (exact.length > 1) {
    request.status = 'question';
    request.candidates = exact;
    request.selected = false;
    request.message = 'More than one mounted file has this name.';
  } else {
    request.candidates = candidateFiles(request.original);
    if (request.candidates.length) {
      request.status = 'question';
      request.selected = false;
      request.message = 'No exact match. Choose the intended mounted file.';
    } else {
      request.status = 'missing';
      request.selected = false;
      request.message = 'No matching or sufficiently similar file was found.';
    }
  }
  return request;
}

function makeRequest(name, index) {
  return resolveRequest({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    original: normalize(name),
    status: 'missing',
    selected: true,
    match: null,
    candidates: [],
    message: ''
  });
}

async function pasteList() {
  try {
    const text = await navigator.clipboard.readText();
    const names = smartSplit(text);
    if (!names.length) {
      flash('The clipboard does not contain any filenames.');
      return;
    }
    state.requests = names.map(makeRequest);
    renderAll();
    flash(`${names.length} filename${names.length === 1 ? '' : 's'} pasted and compared.`);
  } catch (error) {
    console.error(error);
    flash('Clipboard access was blocked. Allow clipboard permission and try again.');
  }
}

function statusEmoji(status) {
  return { waiting: '⏳', question: '❓', missing: '❌', done: '✅', error: '⚠️' }[status] || '❌';
}

function renderDriveList() {
  const query = key(state.driveFilter);
  const visible = query ? state.files.filter(file => key(file.path).includes(query)) : state.files;
  elements.driveCount.textContent = `${state.files.length} file${state.files.length === 1 ? '' : 's'}`;
  elements.driveList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.files.length ? 'No mounted files match this filter.' : 'This folder contains no files in the selected scope.';
    elements.driveList.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  visible.forEach(file => {
    const row = document.createElement('div');
    row.className = 'drive-file';
    row.title = file.path;
    if (file.path.includes('/')) {
      const pathParts = file.path.split('/');
      const fileName = pathParts.pop();
      const folder = document.createElement('span');
      folder.className = 'folder-path';
      folder.textContent = `${pathParts.join('/')}/`;
      row.append(folder, fileName);
    } else {
      row.textContent = file.path;
    }
    fragment.append(row);
  });
  elements.driveList.append(fragment);
}

function renderRequestList() {
  elements.requestList.replaceChildren();
  if (!state.requests.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Paste a filename list to compare it automatically.';
    elements.requestList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.requests.forEach(request => {
    const row = document.createElement('div');
    row.className = 'request-row';
    row.dataset.status = request.status;

    const checkbox = document.createElement('input');
    checkbox.className = 'request-check';
    checkbox.type = 'checkbox';
    checkbox.checked = request.selected && request.status === 'waiting';
    checkbox.disabled = request.status !== 'waiting' || state.busy;
    checkbox.setAttribute('aria-label', `Select ${request.original}`);
    checkbox.addEventListener('change', () => {
      request.selected = checkbox.checked;
      renderActions();
    });

    const emoji = document.createElement('span');
    emoji.className = 'status-emoji';
    emoji.textContent = statusEmoji(request.status);
    emoji.title = request.message || request.status;

    const nameWrap = document.createElement('div');
    nameWrap.className = 'request-name-wrap';
    if (request.status === 'question') {
      const nameButton = document.createElement('button');
      nameButton.className = 'question-name';
      nameButton.type = 'button';
      nameButton.textContent = request.original;
      nameButton.title = request.message;
      nameButton.addEventListener('click', () => openChoiceDialog(request));
      nameWrap.append(nameButton);
    } else {
      const name = document.createElement('span');
      name.className = 'request-name';
      name.textContent = request.original;
      name.title = request.original;
      nameWrap.append(name);
    }
    if (request.match) {
      const matchPath = document.createElement('span');
      matchPath.className = 'match-path';
      matchPath.textContent = request.status === 'done' ? request.message : `Matches: ${request.match.path}`;
      matchPath.title = matchPath.textContent;
      nameWrap.append(matchPath);
    } else if (request.message && request.status !== 'question') {
      const message = document.createElement('span');
      message.className = 'match-path';
      message.textContent = request.message;
      nameWrap.append(message);
    }

    const remove = document.createElement('button');
    remove.className = 'row-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Remove this item from the pasted list';
    remove.disabled = state.busy;
    remove.addEventListener('click', () => {
      state.requests = state.requests.filter(item => item.id !== request.id);
      renderAll();
    });

    row.append(checkbox, emoji, nameWrap, remove);
    fragment.append(row);
  });
  elements.requestList.append(fragment);
}

function renderActions() {
  const counts = state.requests.reduce((total, request) => {
    total[request.status] = (total[request.status] || 0) + 1;
    return total;
  }, {});
  elements.matchSummary.innerHTML = `<span><b>⏳ ${counts.waiting || 0}</b> ready</span><span><b>❓ ${counts.question || 0}</b> check</span><span><b>❌ ${counts.missing || 0}</b> absent</span>`;
  const actionable = selectedActionableRequests();
  elements.actionCount.textContent = `${actionable.length} matched file${actionable.length === 1 ? '' : 's'} selected`;
  elements.archiveFiles.disabled = !actionable.length || !state.rootHandle || state.busy;
  elements.deleteFiles.disabled = !actionable.length || !state.rootHandle || state.busy;
  elements.clearList.disabled = !state.requests.length || state.busy;
}

function selectedActionableRequests() {
  const seen = new Set();
  return state.requests.filter(request => {
    if (request.status !== 'waiting' || !request.selected || !request.match) return false;
    const matchKey = key(request.match.path);
    if (seen.has(matchKey)) return false;
    seen.add(matchKey);
    return true;
  });
}

function renderAll() {
  renderDriveList();
  renderRequestList();
  renderActions();
}

function openChoiceDialog(request) {
  elements.choicePrompt.textContent = `“${request.original}” has no single exact match. Choose the actual file you meant:`;
  elements.choiceList.replaceChildren();
  request.candidates.forEach(file => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button choice-button';
    button.textContent = file.path;
    button.addEventListener('click', () => {
      request.match = file;
      request.status = 'waiting';
      request.selected = true;
      request.message = 'Manually matched.';
      elements.choiceDialog.close('chosen');
      renderAll();
    });
    elements.choiceList.append(button);
  });
  elements.choiceDialog.showModal();
}

function requestConfirmation(action, count) {
  return new Promise(resolve => {
    const deleting = action === 'delete';
    elements.confirmDialog.dataset.action = action;
    elements.confirmTitle.textContent = deleting ? 'Delete matched files?' : 'Archive matched files?';
    elements.confirmCopy.textContent = deleting
      ? `${count} selected file${count === 1 ? '' : 's'} will be permanently deleted from “${state.rootHandle.name}”. This cannot be undone by Filedeletr.`
      : `${count} selected file${count === 1 ? '' : 's'} will be moved into “${state.rootHandle.name}/archive”. Existing files will not be overwritten.`;
    elements.confirmAction.textContent = deleting ? 'Delete files' : 'Archive files';
    const closeHandler = () => {
      elements.confirmDialog.removeEventListener('close', closeHandler);
      resolve(elements.confirmDialog.returnValue === 'confirm');
    };
    elements.confirmDialog.addEventListener('close', closeHandler);
    elements.confirmDialog.showModal();
  });
}

async function ensurePermission() {
  if (!state.rootHandle) return false;
  const options = { mode: 'readwrite' };
  if ((await state.rootHandle.queryPermission(options)) === 'granted') return true;
  return (await state.rootHandle.requestPermission(options)) === 'granted';
}

async function existingNames(directoryHandle) {
  const names = new Set();
  for await (const name of directoryHandle.keys()) names.add(name.toLocaleLowerCase());
  return names;
}

function numberedName(original, number) {
  const dot = original.lastIndexOf('.');
  return dot > 0 ? `${original.slice(0, dot)} (${number})${original.slice(dot)}` : `${original} (${number})`;
}

async function uniqueDestinationName(directoryHandle, requestedName) {
  const names = await existingNames(directoryHandle);
  if (!names.has(requestedName.toLocaleLowerCase())) return requestedName;
  let number = 2;
  while (names.has(numberedName(requestedName, number).toLocaleLowerCase())) number += 1;
  return numberedName(requestedName, number);
}

async function archiveFile(file, archiveRoot) {
  const parts = file.path.split('/');
  const sourceName = parts.pop();
  let destinationDirectory = archiveRoot;
  for (const folder of parts) {
    destinationDirectory = await destinationDirectory.getDirectoryHandle(folder, { create: true });
  }
  const destinationName = await uniqueDestinationName(destinationDirectory, sourceName);
  const destinationHandle = await destinationDirectory.getFileHandle(destinationName, { create: true });
  const writable = await destinationHandle.createWritable();
  try {
    await writable.write(await file.handle.getFile());
  } finally {
    await writable.close();
  }
  await file.parentHandle.removeEntry(file.name);
  return parts.length ? `${parts.join('/')}/${destinationName}` : destinationName;
}

async function runAction(action) {
  if (state.busy || !state.rootHandle) return;
  const requests = selectedActionableRequests();
  if (!requests.length || !(await requestConfirmation(action, requests.length))) return;
  if (!(await ensurePermission())) {
    flash('Read/write folder permission was not granted.');
    return;
  }

  setBusy(true, action === 'delete' ? 'Deleting selected files…' : 'Archiving selected files…');
  let completed = 0;
  let failed = 0;
  let archiveRoot = null;
  try {
    if (action === 'archive') archiveRoot = await state.rootHandle.getDirectoryHandle('archive', { create: true });
    for (const request of requests) {
      try {
        if (action === 'delete') {
          await request.match.parentHandle.removeEntry(request.match.name);
          request.message = 'Deleted.';
        } else {
          const destination = await archiveFile(request.match, archiveRoot);
          request.message = `Archived as archive/${destination}`;
        }
        request.status = 'done';
        request.selected = false;
        completed += 1;
      } catch (error) {
        console.error(error);
        request.status = 'error';
        request.selected = false;
        request.message = error?.message || 'The file operation failed.';
        failed += 1;
      }
      renderRequestList();
      renderActions();
    }
    state.files = (await walkDirectory(state.rootHandle)).sort((a, b) =>
      a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' })
    );
    state.requests.forEach(request => {
      if (request.status !== 'done') resolveRequest(request);
    });
    renderAll();
    flash(failed ? `${completed} completed; ${failed} failed.` : `${completed} file${completed === 1 ? '' : 's'} ${action === 'delete' ? 'deleted' : 'archived'}.`);
  } finally {
    setBusy(false);
    elements.permissionNote.textContent = `${state.files.length} file${state.files.length === 1 ? '' : 's'} available for comparison. The root archive folder is excluded.`;
  }
}

function setBusy(isBusy, message = '') {
  state.busy = isBusy;
  elements.mountFolder.disabled = isBusy;
  elements.refreshFolder.disabled = isBusy || !state.rootHandle;
  elements.includeSubfolders.disabled = isBusy;
  elements.pasteList.disabled = isBusy;
  if (message) elements.permissionNote.textContent = message;
  renderActions();
}

elements.mountFolder.addEventListener('click', mountFolder);
elements.refreshFolder.addEventListener('click', scanMountedFolder);
elements.includeSubfolders.addEventListener('change', scanMountedFolder);
elements.driveFilter.addEventListener('input', event => {
  state.driveFilter = event.target.value;
  renderDriveList();
});
elements.pasteList.addEventListener('click', pasteList);
elements.clearList.addEventListener('click', () => {
  state.requests = [];
  renderAll();
});
elements.archiveFiles.addEventListener('click', () => runAction('archive'));
elements.deleteFiles.addEventListener('click', () => runAction('delete'));

const hoverDescriptions = new Map([
  [elements.mountFolder, 'Mount a local folder with read/write permission for Filedeletr.'],
  [elements.refreshFolder, 'Rescan the currently mounted folder.'],
  [elements.pasteList, 'Paste and intelligently separate filenames from the clipboard.'],
  [elements.archiveFiles, 'Move checked matched files into the mounted folder’s archive directory.'],
  [elements.deleteFiles, 'Permanently delete checked matched files after confirmation.']
]);

hoverDescriptions.forEach((description, element) => {
  element.addEventListener('mouseenter', () => setHubStatus(description));
  element.addEventListener('mouseleave', clearHubStatus);
});

if (!('showDirectoryPicker' in window)) {
  elements.permissionNote.textContent = 'Writable folder access requires current Chrome or Edge in a secure Organon page.';
}

renderAll();
