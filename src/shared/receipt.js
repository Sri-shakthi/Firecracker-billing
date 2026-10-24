(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Receipt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const money = value => Number(value || 0).toFixed(2);

  function dateTime(value) {
    const raw = String(value || '');
    const normalized = raw.replace(' ', 'T') + (raw.endsWith('Z') ? '' : 'Z');
    return new Date(normalized).toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  function markup(bill, settings = {}) {
    const items = bill.items.map(item => `
      <section class="receipt-item">
        <div class="receipt-item-name">${escapeHtml(item.name)}</div>
        <div class="receipt-item-data">
          <span class="receipt-qty">${escapeHtml(item.quantity)}</span>
          <span class="receipt-rate">${money(item.unit_price)}</span>
          <span class="receipt-amount">${money(item.total)}</span>
        </div>
      </section>`).join('');

    return `<article class="thermal-receipt">
      <header class="receipt-store">
        <h1>${escapeHtml(settings.storeName || 'FIRECRACKER STORE')}</h1>
        ${settings.storePhone ? `<p>Phone: ${escapeHtml(settings.storePhone)}</p>` : ''}
      </header>
      <div class="receipt-rule"></div>
      <div class="receipt-meta">
        <p><span>Bill</span><b>${escapeHtml(bill.bill_number)}</b></p>
        <p><span>Date</span><b>${escapeHtml(dateTime(bill.created_at))}</b></p>
        <p><span>Payment</span><b>${escapeHtml(String(bill.payment_method || '').toUpperCase())}</b></p>
      </div>
      <div class="receipt-rule"></div>
      <div class="receipt-columns"><b>Qty</b><b>Rate</b><b>Amount</b></div>
      <div class="receipt-items">${items}</div>
      <div class="receipt-rule"></div>
      <div class="receipt-summary">
        <p><span>Subtotal</span><b>Rs. ${money(bill.subtotal)}</b></p>
        ${Number(bill.discount) ? `<p><span>Discount</span><b>- Rs. ${money(bill.discount)}</b></p>` : ''}
        <p class="receipt-total"><span>TOTAL</span><b>Rs. ${money(bill.total)}</b></p>
      </div>
      <div class="receipt-rule"></div>
      <footer>Thank you. Visit again!</footer>
    </article>`;
  }

  const css = `
    * { box-sizing: border-box; }
    .thermal-receipt { width: 100%; max-width: 72mm; margin: 0 auto; overflow: hidden; color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.28; font-weight: 500; }
    .receipt-store { text-align: center; padding: 1mm 0; }
    .receipt-store h1 { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 18px; line-height: 1.15; font-weight: 800; overflow-wrap: anywhere; }
    .receipt-store p, .receipt-meta p, .receipt-summary p { margin: 2px 0; }
    .receipt-rule { width: 100%; border-top: 1px dashed #000; margin: 7px 0; }
    .receipt-meta p, .receipt-summary p { display: flex; justify-content: space-between; gap: 8px; }
    .receipt-meta p b, .receipt-summary p b { text-align: right; }
    .receipt-columns, .receipt-item-data { display: grid; grid-template-columns: 15% 34% 51%; width: 100%; align-items: baseline; }
    .receipt-columns { padding: 1px 0 3px; border-bottom: 1px solid #000; font-size: 10px; }
    .receipt-columns > *, .receipt-item-data > * { min-width: 0; }
    .receipt-columns > :nth-child(2), .receipt-columns > :nth-child(3), .receipt-rate, .receipt-amount { text-align: right; }
    .receipt-item { padding: 4px 0; border-bottom: 1px dotted #777; page-break-inside: avoid; break-inside: avoid; }
    .receipt-item-name { padding-bottom: 2px; font-size: 11.5px; font-weight: 700; overflow-wrap: anywhere; }
    .receipt-item-data { font-variant-numeric: tabular-nums; }
    .receipt-total { border-top: 1px solid #000; margin-top: 5px !important; padding-top: 5px; font-size: 16px; font-weight: 800; }
    .thermal-receipt footer { padding: 2px 0 4px; text-align: center; font-size: 11px; font-weight: 700; }
  `;

  return { markup, css };
});
