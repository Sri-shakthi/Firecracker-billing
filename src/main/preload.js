const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pos', {
  findProduct: barcode => ipcRenderer.invoke('product:find', barcode),
  searchProducts: query => ipcRenderer.invoke('product:search', query),
  listProducts: query => ipcRenderer.invoke('product:list', query),
  saveProduct: product => ipcRenderer.invoke('product:save', product),
  archiveProduct: id => ipcRenderer.invoke('product:archive', id),
  saveBill: bill => ipcRenderer.invoke('bill:save', bill),
  listBills: filters => ipcRenderer.invoke('bill:list', filters),
  getBill: id => ipcRenderer.invoke('bill:get', id),
  printBill: id => ipcRenderer.invoke('bill:print', id),
  dashboard: filters => ipcRenderer.invoke('dashboard:get', filters),
  getPrinters: () => ipcRenderer.invoke('printer:list'),
  savePrinter: name => ipcRenderer.invoke('printer:save', name),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveStoreSettings: settings => ipcRenderer.invoke('settings:save-store', settings),
  getLicense: () => ipcRenderer.invoke('license:get')
});
