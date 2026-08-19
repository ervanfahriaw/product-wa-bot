const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'bot.db');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

// Pastikan folder data/ ada
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Inisialisasi koneksi database SQLite
let db;
let isBuiltInSqlite = false;

try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
} catch (error) {
  // Fallback ke built-in node:sqlite jika better-sqlite3 diblokir oleh Application Control Policy
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    isBuiltInSqlite = true;
    console.log('[DB] Menggunakan engine built-in node:sqlite (fallback) karena better-sqlite3 terblokir atau tidak dapat dimuat.');

    // Polyfill method pragma agar kompatibel dengan better-sqlite3
    db.pragma = function (pragmaString, options) {
      const simple = options && options.simple;
      const stmt = this.prepare(`PRAGMA ${pragmaString}`);
      const rows = stmt.all();
      if (simple) {
        if (rows.length === 0) return undefined;
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        return keys.length > 0 ? firstRow[keys[0]] : undefined;
      }
      return rows;
    };
  } catch (err) {
    console.error('[DB] Gagal menginisialisasi database SQLite (baik better-sqlite3 maupun built-in node:sqlite):', error.message);
    throw error;
  }
}

try {
  // Konfigurasi performa & integritas SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Jalankan skema awal jika tabel belum dibuat
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
  }
} catch (error) {
  console.error('[DB] Gagal mengonfigurasi database SQLite atau menjalankan skema:', error.message);
  throw error;
}

module.exports = db;
