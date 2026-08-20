/**
 * Migration 007: Tabel FAQs (Auto FAQ untuk Mode Bisnis)
 * 
 * Pertanyaan berulang dijawab langsung dari database tanpa memanggil AI,
 * menghemat biaya token API 40-60%.
 */

const db = require('../connection');

function up() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_keywords TEXT NOT NULL,
      question_label TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT DEFAULT 'Umum',
      match_count INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    const tableInfo = db.prepare("PRAGMA table_info(faqs)").all();
    const existingCols = new Set(tableInfo.map(c => c.name));
    if (!existingCols.has('category')) {
      db.exec("ALTER TABLE faqs ADD COLUMN category TEXT DEFAULT 'Umum'");
    }
  } catch (_) {}

  console.log('[Migration 007] Tabel faqs berhasil dibuat/dimigrasi.');
}

function down() {
  db.exec('DROP TABLE IF EXISTS faqs;');
  console.log('[Migration 007] Tabel faqs dihapus.');
}

up();

module.exports = { up, down };
