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
      order_summary TEXT NOT NULL,
      total_amount INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      resi_number TEXT,
      shipping_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tambah kolom related_products di products (jika belum ada)
  try {
    db.exec('ALTER TABLE products ADD COLUMN related_products TEXT');
  } catch (_) {
    // Kolom sudah ada — abaikan
  }

  console.log('[Migration 008] Tabel orders + kolom related_products berhasil dibuat.');
}

function down() {
  db.exec('DROP TABLE IF EXISTS orders;');
  console.log('[Migration 008] Tabel orders dihapus.');
}

up();

module.exports = { up, down };
