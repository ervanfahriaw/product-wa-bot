const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../utils/paths');

const DB_DIR = DATA_DIR;
const DB_PATH = path.join(DB_DIR, 'bot.db');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

// Pastikan folder data/ ada
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Inisialisasi koneksi database SQLite
let db;
let isBuiltInSqlite = false;

const { BASE_DIR } = require('../utils/paths');
const nativeBindingPath = path.join(BASE_DIR, 'better_sqlite3.node');

try {
  const Database = require('better-sqlite3');
  const options = fs.existsSync(nativeBindingPath) ? { nativeBinding: nativeBindingPath } : {};
  db = new Database(DB_PATH, options);
} catch (error) {
  console.warn('[DB] better-sqlite3 gagal dimuat dengan default:', error.message);
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH, { nativeBinding: nativeBindingPath });
  } catch (error2) {
    // Fallback ke built-in node:sqlite jika tersedia
    try {
      const nodeSqliteMod = 'node' + ':sqlite';
      const sqlitePkg = eval('require')(nodeSqliteMod);
      const DatabaseSync = sqlitePkg.DatabaseSync;
      db = new DatabaseSync(DB_PATH);
      isBuiltInSqlite = true;
      console.log('[DB] Menggunakan engine built-in node:sqlite (fallback).');

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
      console.error('[DB] Gagal menginisialisasi database SQLite:', error.message);
      throw error;
    }
  }
}

module.exports = db;

try {
  // Konfigurasi performa & integritas SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Jalankan skema awal jika tabel belum dibuat
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
  }

  // Jalankan migrasi secara statis agar aman di dalam pkg snapshot
  const migrations = [
    { name: '001-reminders-upgrade', mod: require('./migrations/001-reminders-upgrade') },
    { name: '002-notes-todos', mod: require('./migrations/002-notes-todos') },
    { name: '003-budgets', mod: require('./migrations/003-budgets') },
    { name: '004-habits', mod: require('./migrations/004-habits') },
    { name: '005-events-journals-goals', mod: require('./migrations/005-events-journals-goals') },
    { name: '006-customer-profiles', mod: require('./migrations/006-customer-profiles') },
    { name: '007-faqs', mod: require('./migrations/007-faqs') },
    { name: '008-orders', mod: require('./migrations/008-orders') },
    { name: '009-follow-ups', mod: require('./migrations/009-follow-ups') }
  ];

  for (const { name, mod } of migrations) {
    try {
      if (typeof mod.migrate === 'function') {
        mod.migrate();
      } else if (typeof mod.up === 'function') {
        mod.up();
      }
    } catch (mErr) {
      console.warn(`[DB] Peringatan saat menjalankan migrasi ${name}:`, mErr.message);
    }
  }
} catch (error) {
  console.error('[DB] Gagal mengonfigurasi database SQLite atau menjalankan skema:', error.message);
  throw error;
}
