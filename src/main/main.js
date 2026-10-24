const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { openDatabase } = require('./database');
const nilaProducts = require('../data/nilaProducts');
const Receipt = require('../shared/receipt');

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
  const settings = Object.fromEntries(['storeName','storePhone'].map(k => [k, store.getSetting(k) || '']));
  const embeddedFont = weight => fs.readFileSync(require.resolve(`@fontsource/poppins/files/poppins-latin-${weight}-normal.woff2`)).toString('base64');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 0; }
    html, body { width: 80mm; margin: 0; padding: 0; background: #fff; }
    body { padding: 3mm 4mm; }
    @font-face { font-family: Poppins; src: url(data:font/woff2;base64,${embeddedFont(400)}) format('woff2'); font-weight: 400; }
    @font-face { font-family: Poppins; src: url(data:font/woff2;base64,${embeddedFont(600)}) format('woff2'); font-weight: 600; }
    @font-face { font-family: Poppins; src: url(data:font/woff2;base64,${embeddedFont(700)}) format('woff2'); font-weight: 700; }
    ${Receipt.css}
    @media print { html, body { width: 80mm; } }
    </style></head><body>${Receipt.markup(bill, settings)}</body></html>`;
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
