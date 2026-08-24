/**
 * Migration 008: Tabel orders + kolom related_products di products
 * 
 * Menyimpan pesanan pelanggan agar bot bisa memberikan status pesanan
 * dan owner bisa tracking dari dashboard.
 */

const db = require('../connection');

function up() {
  // Tabel orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT,
      customer_name TEXT,
      order_summary TEXT,
      items TEXT,
      total_amount INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      resi_number TEXT,
      shipping_method TEXT,
      shipping_address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Pastikan seluruh kolom tersedia jika tabel dibuat oleh schema sebelumnya
  try {
    const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
    const cols = new Set(tableInfo.map(c => c.name));
    if (!cols.has('order_summary')) {
      db.exec("ALTER TABLE orders ADD COLUMN order_summary TEXT");
    }
    if (!cols.has('items')) {
      db.exec("ALTER TABLE orders ADD COLUMN items TEXT");
    }
    if (!cols.has('resi_number')) {
      db.exec("ALTER TABLE orders ADD COLUMN resi_number TEXT");
    }
    if (!cols.has('shipping_method')) {
      db.exec("ALTER TABLE orders ADD COLUMN shipping_method TEXT");
    }
    if (!cols.has('shipping_address')) {
      db.exec("ALTER TABLE orders ADD COLUMN shipping_address TEXT");
    }
  } catch (_) {}

  // Tambah kolom related_products di products (jika belum ada)
  try {
    db.exec('ALTER TABLE products ADD COLUMN related_products TEXT');
  } catch (_) {
    // Kolom sudah ada — abaikan
  }

  console.log('[Migration 008] Tabel orders + kolom related_products berhasil dibuat/diperbarui.');
}

function down() {
  db.exec('DROP TABLE IF EXISTS orders;');
  console.log('[Migration 008] Tabel orders dihapus.');
}

up();

module.exports = { up, down };

