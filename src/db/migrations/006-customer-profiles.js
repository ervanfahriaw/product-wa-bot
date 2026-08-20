/**
 * Migration 006: Tabel customer_profiles (CRM Pelanggan untuk Mode Bisnis)
 * 
 * Menyimpan profil, preferensi, dan riwayat pelanggan agar bot bisa
 * "mengingat" pelanggan lintas sesi percakapan.
 */

const db = require('../connection');

function up() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_profiles (
      contact TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_status TEXT DEFAULT 'new',
      tags TEXT,
      favorite_products TEXT,
      notes TEXT,
      total_orders INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      first_contact_at DATETIME,
      last_contact_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    const tableInfo = db.prepare("PRAGMA table_info(customer_profiles)").all();
    const existingCols = new Set(tableInfo.map(c => c.name));
    if (!existingCols.has('tags')) db.exec("ALTER TABLE customer_profiles ADD COLUMN tags TEXT");
    if (!existingCols.has('customer_status')) db.exec("ALTER TABLE customer_profiles ADD COLUMN customer_status TEXT DEFAULT 'new'");
    if (!existingCols.has('favorite_products')) db.exec("ALTER TABLE customer_profiles ADD COLUMN favorite_products TEXT");
    if (!existingCols.has('notes')) db.exec("ALTER TABLE customer_profiles ADD COLUMN notes TEXT");
    if (!existingCols.has('total_orders')) db.exec("ALTER TABLE customer_profiles ADD COLUMN total_orders INTEGER DEFAULT 0");
    if (!existingCols.has('total_spent')) db.exec("ALTER TABLE customer_profiles ADD COLUMN total_spent INTEGER DEFAULT 0");
    if (!existingCols.has('first_contact_at')) db.exec("ALTER TABLE customer_profiles ADD COLUMN first_contact_at DATETIME");
    if (!existingCols.has('last_contact_at')) db.exec("ALTER TABLE customer_profiles ADD COLUMN last_contact_at DATETIME");
    if (!existingCols.has('created_at')) db.exec("ALTER TABLE customer_profiles ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    if (!existingCols.has('updated_at')) db.exec("ALTER TABLE customer_profiles ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  } catch (_) {}

  console.log('[Migration 006] Tabel customer_profiles berhasil dibuat/dimigrasi.');
}

function down() {
  db.exec('DROP TABLE IF EXISTS customer_profiles;');
  console.log('[Migration 006] Tabel customer_profiles dihapus.');
}

// Auto-run saat di-require
up();

module.exports = { up, down };
