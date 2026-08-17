const Database = require('better-sqlite3');
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

try {
  db = new Database(DB_PATH);
  
  // Konfigurasi performa & integritas SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Jalankan skema awal jika tabel belum dibuat
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
  }
} catch (error) {
  console.error('[DB] Gagal menginisialisasi database SQLite:', error.message);
  throw error;
}

module.exports = db;
