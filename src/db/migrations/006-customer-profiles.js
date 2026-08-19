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
  console.log('[Migration 006] Tabel customer_profiles berhasil dibuat.');
}

function down() {
  db.exec('DROP TABLE IF EXISTS customer_profiles;');
  console.log('[Migration 006] Tabel customer_profiles dihapus.');
}

// Auto-run saat di-require
up();

module.exports = { up, down };
