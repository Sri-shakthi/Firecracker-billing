# Firecracker Billing

An offline-first Windows desktop POS for barcode billing, 80 mm receipt printing, and local sales reporting.

## Development

```bash
npm install
npm start
```

Data is stored in Electron's local application-data directory as `firecracker-billing.db`.

## Products

The 101 Nila Crackers products are included and automatically added to a new local database. Use **Settings → Products** to add missing products or edit barcode, name, category, unit, selling price, MRP, stock, and active status.

New billing is available for 30 days from the first launch of a fresh installation. After that, previous bills and reports remain available, but settlement is blocked.

## Printer setup

Install the Helett BillQuick Lite Windows driver, connect the printer, and select it once under **Printer setup**. Settlement saves the bill before attempting to print, so a printer error cannot lose a sale. Use the Dashboard to reprint a saved bill.

## Windows installer

```bash
npm run dist:win
```
