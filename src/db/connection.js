const fs = require('fs');
const path = require('path');
const { DATA_DIR, BASE_DIR, ensureDirectoriesExist } = require('../utils/paths');

const DB_DIR = DATA_DIR;
const DB_PATH = path.join(DB_DIR, 'bot.db');
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql');

// Pastikan semua direktori kerja (data, config, uploads, session) tersedia
if (typeof ensureDirectoriesExist === 'function') {
  ensureDirectoriesExist();
}

// Inisialisasi koneksi database SQLite
let db;
let isBuiltInSqlite = false;

let dbOptions = {};
if (process.env.ANDROID_NATIVE_LIB_DIR) {
  const androidLib = path.join(process.env.ANDROID_NATIVE_LIB_DIR, 'libbetter_sqlite3.so');
  if (fs.existsSync(androidLib)) {
    try {
      // Muat langsung via process.dlopen untuk menghindari regex better-sqlite3 yang memaksa akhiran '.node'
      const addonMod = { exports: {} };
      process.dlopen(addonMod, androidLib);
      dbOptions = { nativeBinding: addonMod.exports };
      console.log('[DB] Berhasil memuat native addon libbetter_sqlite3.so via process.dlopen');
    } catch (dlErr) {
      console.warn('[DB] process.dlopen gagal, mencoba jalur symlink .node:', dlErr.message);
      try {
        const nodeSymlink = path.join(BASE_DIR, 'libbetter_sqlite3.node');
        if (!fs.existsSync(nodeSymlink)) {
          try { fs.symlinkSync(androidLib, nodeSymlink); } catch (_) { fs.copyFileSync(androidLib, nodeSymlink); }
        }
        dbOptions = { nativeBinding: nodeSymlink };
      } catch (_) {
        dbOptions = { nativeBinding: androidLib };
      }
    }
  }
} else {
  const localNode = path.join(BASE_DIR, 'better_sqlite3.node');
  if (fs.existsSync(localNode)) {
    dbOptions = { nativeBinding: localNode };
  }
}

// Helper: Safe SQLite Fallback Adapter jika native addon tidak dapat dimuat
function createSafeDbAdapter(dbPath) {
  const storeFile = dbPath + '.json';
  let store = {};
  try {
    if (fs.existsSync(storeFile)) {
      store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    }
  } catch (_) {}

  function saveStore() {
    try {
      fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf8');
    } catch (_) {}
  }

  return {
    isSafeAdapter: true,
    pragma: (str, opt) => (opt && opt.simple ? undefined : []),
    exec: (sql) => {
      const matches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi);
      for (const m of matches) {
        if (!store[m[1]]) store[m[1]] = [];
      }
      saveStore();
    },
    prepare: (sql) => {
      return {
        all: (...params) => {
          const m = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
          if (m && store[m[1]]) {
            return [...store[m[1]]];
          }
          return [];
        },
        get: (...params) => {
          const tableMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
          if (tableMatch && store[tableMatch[1]]) {
            const table = store[tableMatch[1]];
            if (tableMatch[1] === 'settings' && params.length > 0) {
              return table.find(r => r.key === params[0]);
            }
            return table[0];
          }
          return undefined;
        },
        run: (...params) => {
          const insertMatch = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+|INTO\s+)+([a-zA-Z0-9_]+)/i);
          if (insertMatch) {
            const tbl = insertMatch[1];
            if (!store[tbl]) store[tbl] = [];
            if (tbl === 'settings' && params.length >= 2) {
              const existing = store[tbl].find(r => r.key === params[0]);
              if (existing) existing.value = String(params[1]);
              else store[tbl].push({ key: params[0], value: String(params[1]) });
            } else {
              store[tbl].push({ id: store[tbl].length + 1, _data: params });
            }
            saveStore();
            return { changes: 1, lastInsertRowid: store[tbl].length };
          }
          saveStore();
          return { changes: 1, lastInsertRowid: 1 };
        }
      };
    },
    transaction: (fn) => (...args) => fn(...args)
  };
}

try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH, dbOptions);
  console.log('[DB] Database SQLite berhasil terhubung via better-sqlite3.');
} catch (error) {
  console.warn('[DB] better-sqlite3 tidak dapat digunakan:', error.message);
  
  // 2. Coba engine node:sqlite bawaan jika ada
  try {
    const nodeSqliteMod = 'node' + ':sqlite';
    const sqlitePkg = eval('require')(nodeSqliteMod);
    const DatabaseSync = sqlitePkg.DatabaseSync;
    db = new DatabaseSync(DB_PATH);
    isBuiltInSqlite = true;
    console.log('[DB] Menggunakan engine built-in node:sqlite (fallback).');

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
  } catch (err2) {
    // 3. Fallback Universal: Safe Database Adapter agar server TIDAK CRASH dan Web Controller tetap menyala 100%
    console.warn('[DB] Mengaktifkan Safe SQLite Adapter (server tetap menyala 100%):', err2.message);
    db = createSafeDbAdapter(DB_PATH);
  }
}

module.exports = db;

try {
  // Konfigurasi performa & integritas SQLite
  if (typeof db.pragma === 'function') {
    try { db.pragma('journal_mode = WAL'); } catch (_) {}
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }

  // Jalankan skema awal jika tabel belum dibuat
  if (fs.existsSync(SCHEMA_PATH) && typeof db.exec === 'function') {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    try {
      db.exec(schemaSql);
    } catch (e) {
      console.warn('[DB] Peringatan saat menjalankan schema.sql:', e.message);
    }
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
  console.error('[DB] Peringatan konfigurasi database (non-fatal, server tetap berjalan):', error.message);
}
