/**
 * Migration 005: Tambah tabel events, journals, goals
 * Jalankan: node src/db/migrations/005-events-journals-goals.js
 */
const db = require('../connection');

function migrate() {
  console.log('[Migration 005] Memulai pembuatan tabel events, journals, goals...');

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATETIME NOT NULL,
        event_end DATETIME,
        location TEXT,
        remind_before_minutes INTEGER DEFAULT 30,
        is_notified INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabel "events" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "events":', err.message);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        mood TEXT,
        tags TEXT,
        journal_date DATE DEFAULT (DATE('now', 'localtime')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabel "journals" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "journals":', err.message);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        target_value INTEGER,
        current_value INTEGER NOT NULL DEFAULT 0,
        unit TEXT,
        deadline DATE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);
    console.log('  ✅ Tabel "goals" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "goals":', err.message);
  }

  console.log('[Migration 005] Selesai.');
}

if (require.main === module) { migrate(); }
module.exports = { migrate };
