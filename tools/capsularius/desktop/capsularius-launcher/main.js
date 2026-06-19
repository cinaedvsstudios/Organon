const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const launcherRoot = __dirname;
const capsulariusRoot = path.resolve(launcherRoot, '..', '..');
const capsulariusEntry = path.join(capsulariusRoot, 'index.html');
const approvedRoots = new Set();

function normalisePath(value) {
  return path.resolve(String(value || ''));
}

function isInsideRoot(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function validChildName(name) {
  return typeof name === 'string' && name.length > 0 && name !== '.' && name !== '..' && path.basename(name) === name && !name.includes('\0');
}

function withinApprovedRoot(candidate) {
  return [...approvedRoots].some((root) => isInsideRoot(candidate, root));
}

async function approvedExistingPath(candidate) {
  const realPath = await fs.realpath(normalisePath(candidate));
  if (!withinApprovedRoot(realPath)) throw new Error('This location is outside the folders mounted in Capsularius Desktop.');
  return realPath;
}

async function directoryDescriptor(directoryPath) {
  const realPath = await fs.realpath(directoryPath);
  const stats = await fs.stat(realPath);
  if (!stats.isDirectory()) throw new Error('This location is not a folder.');
  return { path:realPath, name:path.basename(realPath) || realPath, kind:'directory', size:null, createdTime:stats.birthtimeMs || null, modifiedTime:stats.mtimeMs || null };
}

async function itemDescriptor(itemPath) {
  const realPath = await fs.realpath(itemPath);
  if (!withinApprovedRoot(realPath)) throw new Error('This item is outside the folders mounted in Capsularius Desktop.');
  const stats = await fs.stat(realPath);
  return {
    path:realPath,
    name:path.basename(realPath),
    kind:stats.isDirectory() ? 'directory' : 'file',
    size:stats.isFile() ? stats.size : null,
    createdTime:stats.birthtimeMs || null,
    modifiedTime:stats.mtimeMs || null
  };
}

async function approveDirectory(candidate) {
  const descriptor = await directoryDescriptor(candidate);
  approvedRoots.add(descriptor.path);
  return descriptor;
}

async function safeChildPath(parentPath, name) {
  if (!validChildName(name)) throw new Error('That name is not valid for a file or folder.');
  const parent = await approvedExistingPath(parentPath);
  const parentStats = await fs.stat(parent);
  if (!parentStats.isDirectory()) throw new Error('The parent location is not a folder.');
  return path.join(parent, name);
}

async function chooseDirectory() {
  const result = await dialog.showOpenDialog({ title:'Mount folder in Capsularius Desktop', properties:['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  return approveDirectory(result.filePaths[0]);
}

async function resolveChild(parentPath, name, expectedKind, create) {
  const candidate = await safeChildPath(parentPath, name);
  try {
    const descriptor = await itemDescriptor(candidate);
    return descriptor;
  } catch (error) {
    if (error?.code && error.code !== 'ENOENT') throw error;
    if (!create) return null;
  }

  if (expectedKind === 'directory') {
    await fs.mkdir(candidate, { recursive:false });
    return itemDescriptor(candidate);
  }
  await fs.writeFile(candidate, new Uint8Array());
  return itemDescriptor(candidate);
}

function registerBridge() {
  ipcMain.handle('capsularius:choose-directory', chooseDirectory);
  ipcMain.handle('capsularius:restore-directory', async (_event, nativePath) => approveDirectory(nativePath));

  ipcMain.handle('capsularius:list-directory', async (_event, nativePath) => {
    const parent = await approvedExistingPath(nativePath);
    const records = await fs.readdir(parent, { withFileTypes:true });
    const listed = [];
    for (const record of records) {
      if (record.isSymbolicLink()) continue;
      try { listed.push(await itemDescriptor(path.join(parent, record.name))); } catch (_) { /* Skip files which disappeared or are inaccessible during refresh. */ }
    }
    return listed.sort((left, right) => left.kind !== right.kind ? (left.kind === 'directory' ? -1 : 1) : left.name.localeCompare(right.name, undefined, { numeric:true, sensitivity:'base' }));
  });

  ipcMain.handle('capsularius:resolve-child', async (_event, parentPath, name, expectedKind, create) => resolveChild(parentPath, name, expectedKind, create));

  ipcMain.handle('capsularius:remove-entry', async (_event, parentPath, name, recursive) => {
    const target = await safeChildPath(parentPath, name);
    const descriptor = await itemDescriptor(target);
    if (descriptor.kind === 'directory' && !recursive) throw new Error('A folder must be deleted recursively.');
    await fs.rm(descriptor.path, { recursive:descriptor.kind === 'directory', force:false });
  });

  ipcMain.handle('capsularius:read-file', async (_event, nativePath) => {
    const target = await approvedExistingPath(nativePath);
    const stats = await fs.stat(target);
    if (!stats.isFile()) throw new Error('This item is not a file.');
    return { bytes:await fs.readFile(target), modifiedTime:stats.mtimeMs || null };
  });

  ipcMain.handle('capsularius:write-file', async (_event, nativePath, bytes) => {
    const target = await approvedExistingPath(nativePath);
    const stats = await fs.stat(target);
    if (!stats.isFile()) throw new Error('This item is not a file.');
    await fs.writeFile(target, Buffer.from(bytes));
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#1e201c',
    show: false,
    title: 'Capsularius Desktop',
    webPreferences: {
      preload: path.join(launcherRoot, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action:'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const localRootUrl = pathToFileURL(capsulariusRoot + path.sep).href;
    if (!url.startsWith(localRootUrl)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.loadFile(capsulariusEntry);
  return window;
}

app.whenReady().then(async () => {
  try { await fs.access(capsulariusEntry); }
  catch (_) { dialog.showErrorBox('Capsularius files not found', `The launcher could not find:\n${capsulariusEntry}`); app.quit(); return; }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:'Capsularius Desktop', submenu:[{ role:'reload', label:'Reload current local code' }, { role:'toggleDevTools', label:'Developer tools' }, { type:'separator' }, { role:'quit', label:'Quit' }] }
  ]));
  registerBridge();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
