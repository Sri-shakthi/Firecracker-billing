const Database = require('better-sqlite3');
const { getLicenseStatus } = require('../shared/license');

function openDatabase(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      barcode TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL CHECK(price >= 0),
      mrp REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 0,
      stock REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY,
      bill_number TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed'
    );
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id),
      product_id INTEGER REFERENCES products(id),
      barcode TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(created_at);
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
  `);
  const productColumns = db.prepare('PRAGMA table_info(products)').all().map(column => column.name);
  if (!productColumns.includes('unit')) db.exec("ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT ''");
  const billColumns = db.prepare('PRAGMA table_info(bills)').all().map(column => column.name);
  if (!billColumns.includes('discount_percent')) db.exec("ALTER TABLE bills ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0");

  const nextBillNumber = (id) => `FC-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`;
  const saveBill = db.transaction((bill) => {
    const getStock = db.prepare('SELECT name, stock FROM products WHERE id = ?');
    for (const item of bill.lines) {
      if (!item.id) continue;
      const product = getStock.get(item.id);
      if (product?.stock !== null && product?.stock !== undefined && Number(item.quantity) > Number(product.stock)) {
        throw new Error(`${product.name} has only ${product.stock} left in stock`);
      }
    }
    const result = db.prepare(`INSERT INTO bills (bill_number, subtotal, tax, discount, discount_percent, total, payment_method)
      VALUES (NULL, ?, ?, ?, ?, ?, ?)`).run(bill.subtotal, bill.tax, bill.discount, bill.discountPercent, bill.total, bill.paymentMethod);
    const id = Number(result.lastInsertRowid);
    const billNumber = nextBillNumber(id);
    db.prepare('UPDATE bills SET bill_number = ? WHERE id = ?').run(billNumber, id);
    const insertItem = db.prepare(`INSERT INTO bill_items
      (bill_id, product_id, barcode, name, quantity, unit_price, discount, gst_rate, tax, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const updateStock = db.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock IS NOT NULL');
    for (const item of bill.lines) {
      insertItem.run(id, item.id || null, item.barcode, item.name, item.quantity, item.unitPrice, item.discount, item.gstRate, item.tax, item.total);
      if (item.id) updateStock.run(item.quantity, item.id);
    }
    return getBill(id);
  });

  function getBill(id) {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
    if (!bill) return null;
    bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id').all(id);
    return bill;
  }

  const installationDate = db.prepare("SELECT value FROM settings WHERE key='installationDate'").get()?.value;
  if (!installationDate) db.prepare("INSERT INTO settings(key,value) VALUES('installationDate',?)").run(new Date().toISOString());
  function licenseStatus() {
    return getLicenseStatus(db.prepare("SELECT value FROM settings WHERE key='installationDate'").get().value);
  }

  function normalizeProduct(product) {
    const required = ['barcode', 'name'];
    for (const field of required) if (!String(product[field] ?? '').trim()) throw new Error(`${field} is required`);
    const numeric = field => {
      const value = Number(product[field] ?? 0);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be zero or greater`);
      return value;
    };
    return {
      barcode: String(product.barcode).trim(), name: String(product.name).trim(),
      category: String(product.category ?? '').trim(), unit: String(product.unit ?? '').trim(),
      price: numeric('price'), mrp: numeric('mrp'), gst_rate: numeric('gst_rate'),
      stock: product.stock === null || product.stock === '' || product.stock === undefined ? null : numeric('stock'),
      active: product.active === false || product.active === 0 ? 0 : 1
    };
  }

  return {
    findProduct(barcode) { return db.prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(String(barcode).trim()) || null; },
    searchProducts(query) { return db.prepare('SELECT * FROM products WHERE active = 1 AND (name LIKE ? OR barcode LIKE ?) ORDER BY name LIMIT 30').all(`%${query}%`, `%${query}%`); },
    listProducts(query = '') { return db.prepare('SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY active DESC, name LIMIT 1000').all(`%${query}%`, `%${query}%`); },
    saveProduct(product) {
      const row = normalizeProduct(product);
      if (product.id) {
        db.prepare(`UPDATE products SET barcode=@barcode,name=@name,category=@category,unit=@unit,price=@price,mrp=@mrp,
          gst_rate=@gst_rate,stock=@stock,active=@active,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...row, id: Number(product.id) });
        return db.prepare('SELECT * FROM products WHERE id=?').get(Number(product.id));
      }
      const result = db.prepare(`INSERT INTO products(barcode,name,category,unit,price,mrp,gst_rate,stock,active)
        VALUES(@barcode,@name,@category,@unit,@price,@mrp,@gst_rate,@stock,@active)`).run(row);
      return db.prepare('SELECT * FROM products WHERE id=?').get(Number(result.lastInsertRowid));
    },
    archiveProduct(id) { db.prepare('UPDATE products SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(Number(id)); },
    upsertProducts(products) {
      const stmt = db.prepare(`INSERT INTO products (barcode, name, category, unit, price, mrp, gst_rate, stock)
        VALUES (@barcode, @name, @category, @unit, @price, @mrp, @gst_rate, @stock)
        ON CONFLICT(barcode) DO UPDATE SET name=excluded.name, category=excluded.category, unit=excluded.unit, price=excluded.price,
        mrp=excluded.mrp, gst_rate=excluded.gst_rate, stock=excluded.stock, active=1, updated_at=CURRENT_TIMESTAMP`);
      const importAll = db.transaction(rows => rows.forEach(row => stmt.run(row)));
      importAll(products);
      return products.length;
    },
    saveBill(bill) {
      if (!licenseStatus().active) throw new Error('The 30-day billing period has ended. New bills cannot be created.');
      const taxFreeBill = { ...bill, tax: 0, lines: bill.lines.map(item => ({ ...item, gstRate: 0, tax: 0, total: item.taxable })) };
      return saveBill(taxFreeBill);
    },
    getBill,
    listBills({ from, to, query = '' }) {
      return db.prepare(`SELECT id, bill_number, created_at, total, payment_method, status
        FROM bills WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?)
        AND bill_number LIKE ? ORDER BY id DESC LIMIT 500`).all(from, to, `%${query}%`);
    },
    dashboard({ from, to }) {
      const summary = db.prepare(`SELECT COUNT(*) bill_count, COALESCE(SUM(total),0) sales,
        COALESCE(SUM(tax),0) tax, COALESCE(AVG(total),0) average_bill
        FROM bills WHERE status='completed' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?)`).get(from, to);
      const payments = db.prepare(`SELECT payment_method, SUM(total) total FROM bills WHERE status='completed'
        AND date(created_at, 'localtime') BETWEEN date(?) AND date(?) GROUP BY payment_method`).all(from, to);
      const daily = db.prepare(`SELECT date(created_at, 'localtime') day, SUM(total) total FROM bills WHERE status='completed'
        AND date(created_at, 'localtime') BETWEEN date(?) AND date(?) GROUP BY day ORDER BY day`).all(from, to);
      const topProducts = db.prepare(`SELECT bi.name, SUM(bi.quantity) quantity, SUM(bi.total) total FROM bill_items bi
        JOIN bills b ON b.id=bi.bill_id WHERE b.status='completed' AND date(b.created_at, 'localtime') BETWEEN date(?) AND date(?)
        GROUP BY bi.name ORDER BY total DESC LIMIT 10`).all(from, to);
      return { summary, payments, daily, topProducts };
    },
    getSetting(key) { return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? null; },
    setSetting(key, value) { db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value)); },
    licenseStatus,
    close() { db.close(); }
  };
}

module.exports = { openDatabase };
