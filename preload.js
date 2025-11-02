// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () => ipcRenderer.send('select-excel-file'),
  startAutomation: (excelPath) => ipcRenderer.send('start-automation', excelPath),
  onFileSelected: (callback) => ipcRenderer.on('excel-file-selected', (_event, value) => callback(value)),
  onPythonMessage: (callback) => ipcRenderer.on('from-python', (_event, value) => callback(value)),
  sendToPython: (data) => ipcRenderer.send('to-python', data),

  // API per versione app
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // API per aggiornamenti
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, value) => callback(value)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, value) => callback(value)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (_event, value) => callback(value)),
  
  // API per gestione backend
  downloadBackend: () => ipcRenderer.send('download-backend'),
  checkBackend: () => ipcRenderer.send('check-backend'),
  onBackendDownloadStart: (callback) => ipcRenderer.on('backend-download-start', (_event) => callback()),
  onBackendDownloadProgress: (callback) => ipcRenderer.on('backend-download-progress', (_event, value) => callback(value)),
  onBackendDownloadComplete: (callback) => ipcRenderer.on('backend-download-complete', (_event) => callback()),
  onBackendExtractStart: (callback) => ipcRenderer.on('backend-extract-start', (_event) => callback()),
  onBackendExtractComplete: (callback) => ipcRenderer.on('backend-extract-complete', (_event) => callback()),
  onBackendReady: (callback) => ipcRenderer.on('backend-ready', (_event) => callback()),
  onBackendError: (callback) => ipcRenderer.on('backend-error', (_event, value) => callback(value)),
  onBackendStatus: (callback) => ipcRenderer.on('backend-status', (_event, value) => callback(value)),
  onBackendInitializing: (callback) => ipcRenderer.on('backend-initializing', (_event, value) => callback(value))
}); 