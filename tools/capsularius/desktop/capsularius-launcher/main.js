const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

const launcherRoot = __dirname;
const capsulariusRoot = path.resolve(launcherRoot, '..', '..');
const capsulariusEntry = path.join(capsulariusRoot, 'index.html');

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#1e201c',
    title: 'Capsularius Desktop',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(capsulariusEntry);
  return window;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Capsularius Desktop', submenu: [{ role: 'reload', label: 'Reload current local code' }, { role: 'quit', label: 'Quit' }] }
  ]));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
