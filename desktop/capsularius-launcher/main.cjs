const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const launcherRoot = __dirname;
const repositoryRoot = path.resolve(launcherRoot, '..', '..');
const capsulariusEntry = path.join(repositoryRoot, 'tools', 'capsularius', 'index.html');
const approvedRoots = new Set();

function normalisePath(value) {
  return path.resolve(String(value || ''));
}

function isInsideRoot(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isApproved(candidate) {
  const fullPath = normalisePath(candidate);
  return [...approvedRoots].some((root) => isInsideRoot(fullPath, root));
}

function assertApproved(candidate) {
  if (!isApproved(candidate)) throw new Error('Choose this folder in Capsularius before it can be opened through the desktop bridge.');
  return normalisePath(candidate);
}

async function toDirectoryItem(parentPath, entry) {
  const fullPath = path.join(parentPath, entry.name);
  const details = await fs.stat(fullPath);
  return {
    name: entry.name,
    path: fullPath,
    kind: details.isDirectory() ? 'directory' : 'file',
    size: details.isFile() ? details.size : null,
    createdTime: details.birthtimeMs || null,
    modifiedTime: details.mtimeMs || null
  };
}

async function chooseFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Mount folder in Capsularius Desktop',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const folderPath = normalisePath(result.filePaths[0]);
  approvedRoots.add(folderPath);
  return { path:folderPath, name:path.basename(folderPath) || folderPath };
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
      preload: path.join(launcherRoot, 'preload.cjs'),
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
    const localRootUrl = pathToFileURL(repositoryRoot + path.sep).href;
    if (!url.startsWith(localRootUrl)) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.loadFile(capsulariusEntry).catch((error) => {
    dialog.showErrorBox('Capsularius Desktop could not start', `The launcher could not open:\n${capsulariusEntry}\n\n${error.message}`);
  });
  return window;
}

function registerBridge() {
  ipcMain.handle('capsularius-desktop:runtime-info', async () => ({
    isDesktop: true,
    repositoryRoot,
    capsulariusEntry
  }));

  ipcMain.handle('capsularius-desktop:choose-folder', chooseFolder);

  ipcMain.handle('capsularius-desktop:read-directory', async (_event, folderPath) => {
    const approvedPath = assertApproved(folderPath);
    const entries = await fs.readdir(approvedPath, { withFileTypes:true });
    const listed = await Promise.all(entries.map((entry) => toDirectoryItem(approvedPath, entry)));
    return listed.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { numeric:true, sensitivity:'base' });
    });
  });

  ipcMain.handle('capsularius-desktop:approve-folder', async (_event, folderPath) => {
    const fullPath = normalisePath(folderPath);
    const details = await fs.stat(fullPath);
    if (!details.isDirectory()) throw new Error('This path is not a folder.');
    approvedRoots.add(fullPath);
    return { path:fullPath, name:path.basename(fullPath) || fullPath };
  });
}

app.whenReady().then(async () => {
  try {
    await fs.access(capsulariusEntry);
  } catch (_) {
    dialog.showErrorBox('Capsularius files not found', `Expected the local Organon checkout at:\n${repositoryRoot}\n\nThe launcher must stay in desktop\\capsularius-launcher inside that checkout.`);
    app.quit();
    return;
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Capsularius Desktop',
      submenu: [
        { role:'reload', label:'Reload current local code' },
        { role:'toggleDevTools', label:'Developer tools' },
        { type:'separator' },
        { role:'quit', label:'Quit' }
      ]
    }
  ]));
  registerBridge();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
