// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStore', {
  get: (key) => ipcRenderer.invoke('store-get', key),
  set: (key, value) => ipcRenderer.invoke('store-set', key, value),
  delete: (key) => ipcRenderer.invoke('store-delete', key),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printBill: (htmlContent, copies, printerName) => ipcRenderer.invoke('print-bill', htmlContent, copies, printerName),
});
