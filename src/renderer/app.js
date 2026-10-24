const $ = selector => document.querySelector(selector);
const receiptStyles = document.createElement('style');
receiptStyles.textContent = Receipt.css;
document.head.appendChild(receiptStyles);
const state = { cart: [], bill: null, licenseActive: true };
let settingsProducts = [];
const currency = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value || 0);
const dateString = date => date.toISOString().slice(0, 10);

function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message; node.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.className = 'toast', 2800);
}

function renderCart() {
  const result = BillingMath.calculateBill(state.cart, $('#billDiscount').value);
  state.bill = result;
  $('#cartBody').innerHTML = result.lines.map((item, index) => `<tr><td class="item-name"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.barcode)}</small></td><td>${currency(item.unitPrice)}</td><td><div class="qty"><button data-action="minus" data-index="${index}">−</button><b>${item.quantity}</b><button data-action="plus" data-index="${index}">+</button></div></td><td><b>${currency(item.total)}</b></td><td><button class="remove" data-action="remove" data-index="${index}">×</button></td></tr>`).join('');
  $('#emptyCart').classList.toggle('hidden', state.cart.length > 0);
  $('.cart-table').classList.toggle('hidden', state.cart.length === 0);
  $('#itemCount').textContent = result.itemCount;
  $('#subtotal').textContent = currency(result.subtotal);
  $('#grandTotal').textContent = currency(result.total);
  $('#settleBtn').disabled = state.cart.length === 0 || !state.licenseActive;
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function renderSalesChart(rows) {
  if (!rows.length) return '<div class="chart-empty"><b>No sales yet</b><span>Completed bills will appear here.</span></div>';
  const data = rows.slice(-14);
  const width = 680, height = 210, left = 52, right = 18, top = 22, bottom = 38;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = Math.max(...data.map(row => Number(row.total)), 1);
  const x = index => data.length === 1 ? left + plotWidth / 2 : left + index * plotWidth / (data.length - 1);
  const y = value => top + plotHeight - (Number(value) / max) * plotHeight;
  const points = data.map((row, index) => `${x(index)},${y(row.total)}`).join(' ');
  const area = `${left},${top + plotHeight} ${points} ${left + plotWidth},${top + plotHeight}`;
  const grid = [0, .5, 1].map(level => { const gy = top + plotHeight * level; const label = currency(max * (1 - level)).replace('.00', ''); return `<line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}"/><text x="${left - 8}" y="${gy + 4}" text-anchor="end">${label}</text>`; }).join('');
  const labels = data.map((row, index) => index === 0 || index === data.length - 1 || (data.length > 5 && index === Math.floor(data.length / 2)) ? `<text x="${x(index)}" y="${height - 10}" text-anchor="middle">${new Date(`${row.day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>` : '').join('');
  const dots = data.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.total)}" r="4"><title>${row.day}: ${currency(row.total)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Sales trend">${grid}<polygon points="${area}"/><polyline points="${points}"/>${dots}${labels}</svg>`;
}

function receiptMarkup(bill, settings = {}) {
  return Receipt.markup(bill, settings);
}

async function showReceiptPreview(id) {
  const [bill, settings] = await Promise.all([window.pos.getBill(id), window.pos.getSettings()]);
  $('#receiptPaper').innerHTML = receiptMarkup(bill, settings);
  $('#printReceipt').dataset.billId = id;
  $('#receiptDialog').showModal();
}
function addProduct(product) {
  const found = state.cart.find(item => item.barcode === product.barcode);
  if (found) found.quantity += 1;
  else state.cart.push({ id: product.id, barcode: product.barcode, name: product.name, unitPrice: product.price, discount: 0, quantity: 1 });
  renderCart(); $('#barcodeInput').value = ''; $('#searchResults').classList.add('hidden'); $('#barcodeInput').focus();
}

async function scanOrSearch(value, force = false) {
  value = ScannerInput.normalizeScannerValue(value); if (!value) return;
  const exact = await window.pos.findProduct(value);
  if (exact) return addProduct(exact);
  const results = await window.pos.searchProducts(value);
  if (force && results.length === 1) return addProduct(results[0]);
  $('#searchResults').innerHTML = results.length ? results.map((p, i) => `<button data-product="${i}"><span><b>${escapeHtml(p.name)}</b><small> &nbsp; ${escapeHtml(p.barcode)}</small></span><b>${currency(p.price)}</b></button>`).join('') : '<button disabled>No matching product</button>';
  $('#searchResults').classList.remove('hidden');
  $('#searchResults').querySelectorAll('[data-product]').forEach(btn => btn.onclick = () => addProduct(results[Number(btn.dataset.product)]));
}

$('#barcodeInput').addEventListener('input', event => { clearTimeout(scanOrSearch.timer); scanOrSearch.timer = setTimeout(() => scanOrSearch(event.target.value), 180); });
$('#barcodeInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); scanOrSearch(event.target.value, true); } });
$('#cartBody').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  const index = Number(button.dataset.index); const item = state.cart[index];
  if (button.dataset.action === 'plus') item.quantity++;
  if (button.dataset.action === 'minus') item.quantity = Math.max(1, item.quantity - 1);
  if (button.dataset.action === 'remove') state.cart.splice(index, 1);
  renderCart(); $('#barcodeInput').focus();
});
$('#billDiscount').addEventListener('input', renderCart);
$('#clearBtn').onclick = () => { state.cart = []; $('#billDiscount').value = 0; renderCart(); $('#barcodeInput').focus(); };

async function settle() {
  if (!state.cart.length || $('#settleBtn').disabled) return;
  $('#settleBtn').disabled = true;
  try {
    const calculated = BillingMath.calculateBill(state.cart, $('#billDiscount').value);
    const paymentMethod = document.querySelector('[name=payment]:checked').value;
    const bill = await window.pos.saveBill({ ...calculated, paymentMethod });
    state.cart = []; $('#billDiscount').value = 0; renderCart();
    toast(`${bill.bill_number} saved. Printing…`);
    try {
      const printResult = await window.pos.printBill(bill.id);
      toast(printResult.printed ? `${bill.bill_number} printed successfully` : `${bill.bill_number} saved — configure a printer in Settings to print`);
    } catch (error) { toast(`${bill.bill_number} saved, but printing failed: ${error.message}`, true); }
  } catch (error) { toast(error.message, true); renderCart(); }
  $('#barcodeInput').focus();
}
$('#settleBtn').onclick = settle;
document.addEventListener('keydown', event => { if (event.key === 'F2') { event.preventDefault(); settle(); } });

document.querySelectorAll('.nav').forEach(button => button.onclick = () => {
  document.querySelectorAll('.nav,.view').forEach(node => node.classList.remove('active'));
  button.classList.add('active'); $(`#${button.dataset.view}View`).classList.add('active');
  if (button.dataset.view === 'dashboard') loadDashboard();
  else if (button.dataset.view === 'settings') loadSettings();
  else $('#barcodeInput').focus();
});

async function loadSettings() {
  try {
    const [products, printers, settings] = await Promise.all([window.pos.listProducts($('#productSearch').value), window.pos.getPrinters(), window.pos.getSettings()]);
    settingsProducts = products;
    $('#productsBody').innerHTML = products.map((product, index) => `<tr><td><b>${escapeHtml(product.name)}</b><br><small>${escapeHtml(product.unit || product.category || '')}</small></td><td>${escapeHtml(product.barcode)}</td><td>${currency(product.price)}</td><td>${product.stock ?? 'Not tracked'}</td><td><span class="status ${product.active ? '' : 'inactive'}">${product.active ? 'Active' : 'Inactive'}</span></td><td><button data-edit-product="${index}">Edit</button>${product.active ? `<button data-archive-product="${product.id}">Disable</button>` : ''}</td></tr>`).join('');
    $('#settingsPrinterSelect').innerHTML = `<option value="">Select a printer</option>${printers.map(p => `<option value="${escapeHtml(p.name)}" ${p.name === settings.printerName ? 'selected' : ''}>${escapeHtml(p.displayName || p.name)}</option>`).join('')}`;
    $('#printerStatus').textContent = settings.printerName ? `Current printer: ${settings.printerName}` : 'No printer selected';
    $('#storeName').value = settings.storeName || '';
    $('#storePhone').value = settings.storePhone || '';
    $('#productsBody').querySelectorAll('[data-edit-product]').forEach(button => button.onclick = () => openProduct(settingsProducts[Number(button.dataset.editProduct)]));
    $('#productsBody').querySelectorAll('[data-archive-product]').forEach(button => button.onclick = async () => { await window.pos.archiveProduct(Number(button.dataset.archiveProduct)); toast('Product disabled'); loadSettings(); });
  } catch (error) { toast(error.message, true); }
}

function openProduct(product = null) {
  $('#productDialogTitle').textContent = product ? 'Edit product' : 'Add product';
  $('#productId').value = product?.id || ''; $('#productName').value = product?.name || ''; $('#productBarcode').value = product?.barcode || '';
  $('#productCategory').value = product?.category || ''; $('#productUnit').value = product?.unit || ''; $('#productPrice').value = product?.price ?? '';
  $('#productMrp').value = product?.mrp ?? ''; $('#productStock').value = product?.stock ?? '';
  $('#productActive').checked = product ? Boolean(product.active) : true; $('#productDialog').showModal();
}

$('#newProductBtn').onclick = () => openProduct();
$('#cancelProduct').onclick = () => $('#productDialog').close();
$('#productForm').onsubmit = async event => {
  event.preventDefault();
  try {
    await window.pos.saveProduct({ id: $('#productId').value || null, name: $('#productName').value, barcode: $('#productBarcode').value, category: $('#productCategory').value, unit: $('#productUnit').value, price: $('#productPrice').value, mrp: $('#productMrp').value || $('#productPrice').value, stock: $('#productStock').value, active: $('#productActive').checked });
    $('#productDialog').close(); toast('Product saved'); loadSettings();
  } catch (error) { toast(error.message.includes('UNIQUE') ? 'That barcode already exists' : error.message, true); }
};
$('#productSearch').addEventListener('input', () => { clearTimeout(loadSettings.timer); loadSettings.timer = setTimeout(loadSettings, 220); });
$('#settingsSavePrinter').onclick = async () => { await window.pos.savePrinter($('#settingsPrinterSelect').value); toast('Receipt printer saved'); loadSettings(); };
$('#saveStoreSettings').onclick = async () => { try { await window.pos.saveStoreSettings({ storeName: $('#storeName').value, storePhone: $('#storePhone').value }); toast('Store details saved'); } catch (error) { toast(error.message, true); } };

async function loadDashboard() {
  const filters = { from: $('#fromDate').value, to: $('#toDate').value };
  try {
    const [data, bills] = await Promise.all([window.pos.dashboard(filters), window.pos.listBills({ ...filters, query: $('#billSearch').value })]);
    const cashSales = data.payments.find(payment => payment.payment_method === 'cash')?.total || 0;
    $('#metricSales').textContent = currency(data.summary.sales); $('#metricBills').textContent = data.summary.bill_count; $('#metricAverage').textContent = currency(data.summary.average_bill); $('#metricCash').textContent = currency(cashSales);
    $('#salesChart').innerHTML = renderSalesChart(data.daily);
    $('#paymentList').innerHTML = data.payments.length ? data.payments.map(p => `<div class="payment-item"><b>${escapeHtml(p.payment_method)}</b><strong>${currency(p.total)}</strong></div>`).join('') : '<p>No payments yet</p>';
    $('#topProducts').innerHTML = data.topProducts.length ? data.topProducts.map((p, i) => `<div class="product-item"><span>${i + 1}. ${escapeHtml(p.name)}</span><b>${p.quantity} sold</b><strong>${currency(p.total)}</strong></div>`).join('') : '<p>No product sales yet</p>';
    $('#billList').innerHTML = bills.length ? bills.map(b => `<div class="bill-item"><b>${escapeHtml(b.bill_number)}</b><span>${new Date(b.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-IN')}</span><strong>${currency(b.total)}</strong><span><button data-preview="${b.id}">View</button><button data-print="${b.id}">Print</button></span></div>`).join('') : '<p>No bills found</p>';
    $('#billList').querySelectorAll('[data-preview]').forEach(btn => btn.onclick = () => showReceiptPreview(Number(btn.dataset.preview)));
    $('#billList').querySelectorAll('[data-print]').forEach(btn => btn.onclick = async () => { try { const result = await window.pos.printBill(Number(btn.dataset.print)); toast(result.printed ? 'Bill printed' : 'Configure a printer in Settings first', !result.printed); } catch (e) { toast(e.message, true); } });
  } catch (error) { toast(error.message, true); }
}

const today = new Date(); const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
$('#fromDate').value = dateString(monthStart); $('#toDate').value = dateString(today);
$('#refreshDashboard').onclick = loadDashboard;
$('#billSearch').addEventListener('input', () => { clearTimeout(loadDashboard.timer); loadDashboard.timer = setTimeout(loadDashboard, 250); });
$('#closeReceipt').onclick = () => $('#receiptDialog').close();
$('#printReceipt').onclick = async () => { const result = await window.pos.printBill(Number($('#printReceipt').dataset.billId)); toast(result.printed ? 'Bill printed' : 'Configure a printer in Settings first', !result.printed); };
setInterval(() => $('#clock').textContent = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), 1000);

async function loadLicense() {
  const license = await window.pos.getLicense();
  state.licenseActive = license.active;
  $('#licenseStatus').textContent = license.active ? `${license.daysRemaining} billing days remaining` : 'Billing period ended';
  $('#licenseStatus').classList.toggle('expired', !license.active);
  if (!license.active) $('#settleBtn span').textContent = 'Billing period ended';
  renderCart();
}

renderCart(); loadLicense(); $('#barcodeInput').focus();
