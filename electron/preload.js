// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__electronBridge', {
  // Get persisted settings (serverUrl, etc.)
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // Save settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Is this running in Electron?
  isElectron: true,
});
