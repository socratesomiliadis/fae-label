const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('faethonDesktop', {
  chooseImport: () => ipcRenderer.invoke('desktop:choose-import'),
  postgresDownload: () => ipcRenderer.invoke('desktop:postgres-download'),
  setupLocal: request => ipcRenderer.invoke('desktop:setup-local', request),
  setupRemote: request => ipcRenderer.invoke('desktop:setup-remote', request),
  open: () => ipcRenderer.invoke('desktop:open'),
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),
  saveSettings: values => ipcRenderer.invoke('desktop:save-settings', values)
});
