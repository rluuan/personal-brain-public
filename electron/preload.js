import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('updater', {
  version: process.env.APP_VERSION || '',
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('install-update'),
})
