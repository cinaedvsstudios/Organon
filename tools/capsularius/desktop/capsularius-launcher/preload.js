const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capsulariusDesktop', Object.freeze({
  isDesktop: true,
  loadDesktopState: () => ipcRenderer.invoke('capsularius:load-desktop-state'),
  saveDesktopState: (state) => ipcRenderer.invoke('capsularius:save-desktop-state', state),
  getDesktopPreference: (key) => ipcRenderer.invoke('capsularius:get-desktop-preference', key),
  setDesktopPreference: (key, value) => ipcRenderer.invoke('capsularius:set-desktop-preference', key, value),
  requestGoogleDriveToken: (options = {}) => ipcRenderer.invoke('capsularius:request-google-drive-token', options),
  restoreGoogleDriveSessions: (accountIds) => ipcRenderer.invoke('capsularius:restore-google-drive-sessions', accountIds),
  forgetGoogleDriveAccount: (accountId) => ipcRenderer.invoke('capsularius:forget-google-drive-account', accountId),
  chooseDirectory: () => ipcRenderer.invoke('capsularius:choose-directory'),
  restoreDirectory: (nativePath) => ipcRenderer.invoke('capsularius:restore-directory', nativePath),
  listDirectory: (nativePath) => ipcRenderer.invoke('capsularius:list-directory', nativePath),
  resolveChild: (parentPath, name, kind, create) => ipcRenderer.invoke('capsularius:resolve-child', parentPath, name, kind, Boolean(create)),
  removeEntry: (parentPath, name, recursive) => ipcRenderer.invoke('capsularius:remove-entry', parentPath, name, Boolean(recursive)),
  readFile: (nativePath) => ipcRenderer.invoke('capsularius:read-file', nativePath),
  writeFile: (nativePath, bytes) => ipcRenderer.invoke('capsularius:write-file', nativePath, bytes),
  setZoomFactor: (factor) => ipcRenderer.invoke('capsularius:set-zoom-factor', factor)
}));
