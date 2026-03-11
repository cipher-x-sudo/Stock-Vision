const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  close: () => ipcRenderer.invoke('window-close'),
  openPath: (pathStr) => ipcRenderer.invoke('open-path', pathStr),
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),
});

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  divideVideosIntoBatches: (payload) => ipcRenderer.invoke('divide-videos-into-batches', payload),
});

// Update system (only used when running in packaged Electron app)
contextBridge.exposeInMainWorld('updater', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartToInstall: () => ipcRenderer.invoke('restart-to-install'),
  isUpdateReady: () => ipcRenderer.invoke('is-update-ready'),
  onChecking: (cb) => { ipcRenderer.on('update-checking', () => cb()); },
  onUpdateAvailable: (cb) => { ipcRenderer.on('update-available', (_, info) => cb(info)); },
  onUpdateNotAvailable: (cb) => { ipcRenderer.on('update-not-available', (_, info) => cb(info)); },
  onDownloadProgress: (cb) => { ipcRenderer.on('update-download-progress', (_, progress) => cb(progress)); },
  onUpdateDownloaded: (cb) => { ipcRenderer.on('update-downloaded', (_, info) => cb(info)); },
  onUpdateError: (cb) => { ipcRenderer.on('update-error', (_, message) => cb(message)); },
});
