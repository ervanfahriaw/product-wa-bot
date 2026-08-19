/**
 * Migration 009: Tabel follow_ups & follow_up_optouts
 * 
 * Untuk mengelola penjadwalan follow-up otomatis secara sopan dan anti-spam.
 */

const db = require('../connection');

function up() {
  // Tabel follow_ups
  db.exec(`
    CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT NOT NULL,
      product_name TEXT,
      inquiry_message TEXT,
      inquiry_at DATETIME NOT NULL,
      scheduled_at DATETIME NOT NULL,
      status TEXT DEFAULT 'scheduled',
      cancel_reason TEXT,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabel follow_up_optouts
  db.exec(`
    CREATE TABLE IF NOT EXISTS follow_up_optouts (
      contact TEXT PRIMARY KEY,
      opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[Migration 009] Tabel follow_ups & follow_up_optouts berhasil dibuat.');
}

function down() {
  db.exec('DROP TABLE IF EXISTS follow_ups;');
  db.exec('DROP TABLE IF EXISTS follow_up_optouts;');
  console.log('[Migration 009] Tabel follow_ups & follow_up_optouts dihapus.');
}

up();

module.exports = { up, down };
