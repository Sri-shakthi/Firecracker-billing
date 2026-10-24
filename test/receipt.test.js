const test = require('node:test');
const assert = require('node:assert/strict');
const Receipt = require('../src/shared/receipt');

test('printed and preview receipts include store, item columns and totals', () => {
  const html = Receipt.markup({
    bill_number: 'FC-2026-000002', created_at: '2026-10-24 13:22:00', payment_method: 'cash',
    subtotal: 120, discount: 10, total: 110,
    items: [{ name: 'Flower Pots Big', quantity: 2, unit_price: 60, total: 120 }]
  }, { storeName: 'Nila Crackers', storePhone: '9876543210' });

  for (const text of ['Nila Crackers', '9876543210', 'Qty', 'Rate', 'Amount', 'Flower Pots Big', '60.00', '120.00', 'Subtotal', 'TOTAL', '110.00']) {
    assert.match(html, new RegExp(text));
  }
  assert.match(Receipt.css, /grid-template-columns/);
});
