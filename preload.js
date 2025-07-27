// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () => ipcRenderer.send('select-excel-file'),
  startAutomation: (excelPath) => ipcRenderer.send('start-automation', excelPath),
  onFileSelected: (callback) => ipcRenderer.on('excel-file-selected', (_event, value) => callback(value)),
  onPythonMessage: (callback) => ipcRenderer.on('from-python', (_event, value) => callback(value)),
  sendToPython: (data) => ipcRenderer.send('to-python', data)
}); 