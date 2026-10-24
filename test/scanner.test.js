const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeScannerValue: normalize } = require('../src/shared/scanner');

test('converts scanner shift-symbol output to numeric barcode values', () => {
  assert.equal(normalize('&^'), '76');
  assert.equal(normalize('$#'), '43');
  assert.equal(normalize('($'), '94');
  assert.equal(normalize('^('), '69');
});

test('does not alter normal barcode or product search input', () => {
  assert.equal(normalize('76'), '76');
  assert.equal(normalize('Flower Pots'), 'Flower Pots');
});
