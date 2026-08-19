/**
 * Migration 004: Tambah tabel habits dan habit_logs
 * Jalankan: node src/db/migrations/004-habits.js
 */
const db = require('../connection');

function migrate() {
  console.log('[Migration 004] Memulai pembuatan tabel habits dan habit_logs...');

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'daily',
        target_per_period INTEGER NOT NULL DEFAULT 1,
        streak_current INTEGER NOT NULL DEFAULT 0,
        streak_best INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabel "habits" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "habits":', err.message);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✅ Tabel "habit_logs" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "habit_logs":', err.message);
  }

  console.log('[Migration 004] Selesai.');
}

if (require.main === module) { migrate(); }
module.exports = { migrate };
