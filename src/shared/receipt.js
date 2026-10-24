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
    const discountPercent = Number(bill.discount_percent ?? bill.discountPercent) || (Number(bill.subtotal) ? Number(bill.discount) / Number(bill.subtotal) * 100 : 0);
    const items = bill.items.map(item => `
      <section class="receipt-item">
        <div class="receipt-item-name">${escapeHtml(item.name)}</div>
        <div class="receipt-item-data">
          <span>Qty <b>${escapeHtml(item.quantity)}</b></span>
          <span>Rate <b>Rs. ${money(item.unit_price)}</b></span>
          <span>Amount <b>Rs. ${money(item.total)}</b></span>
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
      <div class="receipt-section-title">ITEMS</div>
      <div class="receipt-items">${items}</div>
      <div class="receipt-rule"></div>
      <div class="receipt-summary">
        <p><span>Subtotal</span><b>Rs. ${money(bill.subtotal)}</b></p>
        ${Number(bill.discount) ? `<p><span>Discount (${money(discountPercent).replace(/\.00$/, '')}%)</span><b>- Rs. ${money(bill.discount)}</b></p>` : ''}
        <p class="receipt-total"><span>TOTAL</span><b>Rs. ${money(bill.total)}</b></p>
      </div>
      <div class="receipt-rule"></div>
      <footer>Thank you. Visit again!</footer>
    </article>`;
  }

  const css = `
    * { box-sizing: border-box; }
    .thermal-receipt { width: 100%; max-width: 64mm; margin: 0 auto; overflow: hidden; color: #000; background: #fff; font-family: Poppins, Arial, sans-serif; font-size: 12px; line-height: 1.34; font-weight: 400; }
    .receipt-store { text-align: center; padding: 1mm 0; }
    .receipt-store h1 { margin: 0; font-family: Poppins, Arial, sans-serif; font-size: 19px; line-height: 1.2; font-weight: 700; overflow-wrap: anywhere; }
    .receipt-store p, .receipt-meta p, .receipt-summary p { margin: 2px 0; }
    .receipt-rule { width: 100%; border-top: 1px dashed #000; margin: 7px 0; }
    .receipt-meta p, .receipt-summary p { display: flex; justify-content: space-between; gap: 8px; }
    .receipt-meta p b, .receipt-summary p b { text-align: right; }
    .receipt-section-title { padding: 1px 0 4px; border-bottom: 1px solid #000; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
    .receipt-item { padding: 6px 0; border-bottom: 1px dotted #777; page-break-inside: avoid; break-inside: avoid; }
    .receipt-item-name { padding-bottom: 4px; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
    .receipt-item-data { display: grid; grid-template-columns: 16% 34% 50%; width: calc(100% - 4mm); font-size: 10.5px; font-variant-numeric: tabular-nums; }
    .receipt-item-data span { min-width: 0; white-space: nowrap; }
    .receipt-item-data span:nth-child(2), .receipt-item-data span:nth-child(3) { text-align: right; }
    .receipt-total { border-top: 1px solid #000; margin-top: 5px !important; padding-top: 5px; font-size: 17px; font-weight: 700; }
    .receipt-summary p b { margin-right: 5mm; }
    .thermal-receipt footer { padding: 2px 0 4px; text-align: center; font-size: 12px; font-weight: 600; }
  `;

  return { markup, css };
});
