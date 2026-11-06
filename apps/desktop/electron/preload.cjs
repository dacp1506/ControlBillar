const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('receiptApi', {
  savePdf: (receipt) => ipcRenderer.invoke('receipt:pdf', receipt),
  print: (receipt) => ipcRenderer.invoke('receipt:print', receipt)
});
