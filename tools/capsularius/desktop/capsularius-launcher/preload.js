const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capsulariusDesktop', Object.freeze({
  isDesktop: true,
  chooseDirectory: () => ipcRenderer.invoke('capsularius:choose-directory'),
  restoreDirectory: (nativePath) => ipcRenderer.invoke('capsularius:restore-directory', nativePath),
  listDirectory: (nativePath) => ipcRenderer.invoke('capsularius:list-directory', nativePath),
  resolveChild: (parentPath, name, kind, create) => ipcRenderer.invoke('capsularius:resolve-child', parentPath, name, kind, Boolean(create)),
  removeEntry: (parentPath, name, recursive) => ipcRenderer.invoke('capsularius:remove-entry', parentPath, name, Boolean(recursive)),
  readFile: (nativePath) => ipcRenderer.invoke('capsularius:read-file', nativePath),
  writeFile: (nativePath, bytes) => ipcRenderer.invoke('capsularius:write-file', nativePath, bytes)
}));
