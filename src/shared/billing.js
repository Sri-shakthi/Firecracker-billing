function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateLine(item) {
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
  const discount = Math.max(0, Number(item.discount) || 0);
  const gross = money(quantity * unitPrice);
  const discountAmount = money(Math.min(gross, discount));
  const taxable = money(gross - discountAmount);
  const tax = 0;
  return { ...item, gstRate: 0, quantity, unitPrice, discount: discountAmount, gross, taxable, tax, total: taxable };
}

function calculateBill(items, billDiscount = 0) {
  const lines = items.map(calculateLine);
  const subtotal = money(lines.reduce((sum, line) => sum + line.taxable, 0));
  const tax = 0;
  const discount = money(Math.min(subtotal + tax, Math.max(0, Number(billDiscount) || 0)));
  const total = money(subtotal + tax - discount);
  return { lines, subtotal, tax, discount, total, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0) };
}

if (typeof module !== 'undefined') module.exports = { money, calculateLine, calculateBill };
if (typeof window !== 'undefined') window.BillingMath = { money, calculateLine, calculateBill };
