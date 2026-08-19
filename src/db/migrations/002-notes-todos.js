/**
 * Migration 002: Tambah tabel notes dan todos
 * 
 * Jalankan: node src/db/migrations/002-notes-todos.js
 */

const db = require('../connection');

function migrate() {
  console.log('[Migration 002] Memulai pembuatan tabel notes dan todos...');

  // Tabel Notes
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabel "notes" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "notes":', err.message);
  }

  // Tabel Todos
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        is_done INTEGER NOT NULL DEFAULT 0,
        due_date DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Tabel "todos" berhasil dibuat/sudah ada.');
  } catch (err) {
    console.error('  ❌ Gagal membuat tabel "todos":', err.message);
  }

  console.log('[Migration 002] Selesai.');
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
