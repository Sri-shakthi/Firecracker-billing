const BILLING_PERIOD_DAYS = 30;

function getLicenseStatus(startedAt, now = new Date()) {
  const start = new Date(startedAt);
  const expires = new Date(start.getTime() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const remainingMs = Math.max(0, expires.getTime() - now.getTime());
  return {
    active: now.getTime() < expires.getTime(),
    startedAt: start.toISOString(),
    expiresAt: expires.toISOString(),
    daysRemaining: Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  };
}

module.exports = { BILLING_PERIOD_DAYS, getLicenseStatus };
