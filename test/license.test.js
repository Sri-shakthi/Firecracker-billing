const test = require('node:test');
const assert = require('node:assert/strict');
const { getLicenseStatus } = require('../src/shared/license');

test('billing remains active within 30 days', () => {
  const status = getLicenseStatus('2026-01-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'));
  assert.equal(status.active, true);
  assert.equal(status.daysRemaining, 16);
});

test('billing is blocked after 30 days', () => {
  const status = getLicenseStatus('2026-01-01T00:00:00.000Z', new Date('2026-01-31T00:00:00.000Z'));
  assert.equal(status.active, false);
  assert.equal(status.daysRemaining, 0);
});
