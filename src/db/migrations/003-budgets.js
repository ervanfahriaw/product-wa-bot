/**
 * Migration 003: Tambah tabel budgets
 * Jalankan: node src/db/migrations/003-budgets.js
 */
const db = require('../connection');

function migrate() {
  console.log('[Migration 003] Memulai pembuatan tabel budgets...');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL UNIQUE,
        monthly_limit INTEGER NOT NULL,
        alert_at_percent INTEGER NOT NULL DEFAULT 80,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabel "budgets" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "budgets":', err.message);
  }
  console.log('[Migration 003] Selesai.');
}

if (require.main === module) { migrate(); }
module.exports = { migrate };
