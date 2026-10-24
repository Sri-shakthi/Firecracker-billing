const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLine, calculateBill } = require('../src/shared/billing');

test('calculates tax-free line after item discount', () => {
  assert.deepEqual(calculateLine({ quantity: 2, unitPrice: 100, discount: 20, gstRate: 18 }), {
    quantity: 2, unitPrice: 100, discount: 20, gstRate: 0, gross: 200, taxable: 180, tax: 0, total: 180
  });
});

test('calculates percentage discount and clamps it to 100 percent', () => {
  const result = calculateBill([{ quantity: 3, unitPrice: 10, discount: 0, gstRate: 5 }], 99);
  assert.equal(result.subtotal, 30);
  assert.equal(result.tax, 0);
  assert.equal(result.discountPercent, 99);
  assert.equal(result.discount, 29.7);
  assert.equal(result.total, 0.3);
  assert.equal(result.itemCount, 3);
  assert.equal(calculateBill([{ quantity: 1, unitPrice: 50 }], 150).total, 0);
});
