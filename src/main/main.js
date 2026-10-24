const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { openDatabase } = require('./database');
const nilaProducts = require('../data/nilaProducts');

let mainWindow;
let store;
const appIconPath = path.join(__dirname, '../../build/app-icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: '#f4f1ea',
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerHandlers() {
  ipcMain.handle('product:find', (_, barcode) => store.findProduct(barcode));
  ipcMain.handle('product:search', (_, query) => store.searchProducts(String(query || '')));
  ipcMain.handle('product:list', (_, query) => store.listProducts(String(query || '')));
  ipcMain.handle('product:save', (_, product) => store.saveProduct(product));
  ipcMain.handle('product:archive', (_, id) => store.archiveProduct(id));
  ipcMain.handle('bill:save', (_, bill) => store.saveBill(bill));
  ipcMain.handle('bill:list', (_, filters) => store.listBills(filters));
  ipcMain.handle('bill:get', (_, id) => store.getBill(id));
  ipcMain.handle('dashboard:get', (_, filters) => store.dashboard(filters));
  ipcMain.handle('printer:list', async () => mainWindow.webContents.getPrintersAsync());
  ipcMain.handle('printer:save', (_, name) => store.setSetting('printerName', name));
  ipcMain.handle('settings:get', () => ({ printerName: store.getSetting('printerName') || '', storeName: store.getSetting('storeName') || '', storePhone: store.getSetting('storePhone') || '' }));
  ipcMain.handle('settings:save-store', (_, settings) => {
    const storeName = String(settings.storeName || '').trim();
    const storePhone = String(settings.storePhone || '').trim();
    if (!storeName) throw new Error('Store name is required');
    store.setSetting('storeName', storeName);
    store.setSetting('storePhone', storePhone);
    return { storeName, storePhone };
  });
  ipcMain.handle('license:get', () => store.licenseStatus());
  ipcMain.handle('bill:print', async (_, id) => printBill(id));
}

async function printBill(id) {
  const bill = store.getBill(id);
  if (!bill) throw new Error('Bill not found');
  const printerName = store.getSetting('printerName');
  if (!printerName) return { printed: false, reason: 'no-printer' };
  const receipt = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  const receiptPath = path.join(app.getPath('temp'), `firecracker-receipt-${id}.html`);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const settings = Object.fromEntries(['storeName','storePhone'].map(k => [k, store.getSetting(k) || '']));
  const rows = bill.items.map(i => `<tr><td>${esc(i.name)}<small>${esc(i.barcode)}</small></td><td>${i.quantity}</td><td>${i.unit_price.toFixed(2)}</td><td>${i.total.toFixed(2)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{font:11px Arial;margin:0;color:#000}.center{text-align:center}h1{font-size:18px;margin:0 0 4px}p{margin:2px 0}.rule{border-top:1px dashed #000;margin:7px 0}table{width:100%;border-collapse:collapse}th,td{padding:3px 1px;text-align:right}th:first-child,td:first-child{text-align:left}small{display:block}.total{font-size:15px;font-weight:bold}.foot{margin-top:10px;text-align:center}</style></head><body>
    <div class="center"><h1>${esc(settings.storeName || 'FIRECRACKER STORE')}</h1><p>${esc(settings.storePhone)}</p></div><div class="rule"></div>
    <p>Bill: <b>${esc(bill.bill_number)}</b></p><p>Date: ${new Date(bill.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-IN')}</p><p>Payment: ${esc(bill.payment_method.toUpperCase())}</p><div class="rule"></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="rule"></div>
    <table><tr><td>Subtotal</td><td>₹${bill.subtotal.toFixed(2)}</td></tr>${bill.discount ? `<tr><td>Discount</td><td>-₹${bill.discount.toFixed(2)}</td></tr>` : ''}<tr class="total"><td>TOTAL</td><td>₹${bill.total.toFixed(2)}</td></tr></table>
    <div class="rule"></div><p class="foot">Thank you. Visit again!</p></body></html>`;
  fs.writeFileSync(receiptPath, html);
  await receipt.loadFile(receiptPath);
  return new Promise((resolve, reject) => receipt.webContents.print({ silent: Boolean(printerName), deviceName: printerName, printBackground: true, margins: { marginType: 'none' } }, (success, reason) => {
    receipt.destroy();
    try { fs.unlinkSync(receiptPath); } catch {}
    success ? resolve({ printed: true }) : reject(new Error(reason || 'Printing failed'));
  }));
}

app.whenReady().then(() => {
  app.setName('Firecracker Billing');
  if (process.platform === 'darwin') app.dock.setIcon(nativeImage.createFromPath(appIconPath));
  store = openDatabase(path.join(app.getPath('userData'), 'firecracker-billing.db'));
  if (store.listProducts().length === 0) store.upsertProducts(nilaProducts);
  registerHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => store?.close());
