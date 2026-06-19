const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capsulariusDesktop', Object.freeze({
  isDesktop: true,
  runtimeInfo: () => ipcRenderer.invoke('capsularius-desktop:runtime-info'),
  chooseFolder: () => ipcRenderer.invoke('capsularius-desktop:choose-folder'),
  approveFolder: (folderPath) => ipcRenderer.invoke('capsularius-desktop:approve-folder', folderPath),
  readDirectory: (folderPath) => ipcRenderer.invoke('capsularius-desktop:read-directory', folderPath)
}));
