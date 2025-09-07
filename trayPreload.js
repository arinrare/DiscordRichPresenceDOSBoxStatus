const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onDosboxStatus: (callback) => ipcRenderer.on('dosbox-status', (event, running) => callback(running)),
  hideTrayWindow: () => ipcRenderer.send('hide-tray-window')
});