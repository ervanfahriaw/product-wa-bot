/**
 * Migration 010: Menambahkan kolom media_url pada tabel products
 * 
 * Kolom ini menampung tautan URL eksternal (Google Drive, Dropbox, video YouTube/TikTok, dll)
 * untuk kumpulan foto dan video produk yang lebih banyak dan lengkap.
 */

const db = require('../connection');

function up() {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    const cols = new Set(tableInfo.map(c => c.name));
    if (!cols.has('media_url')) {
      db.exec("ALTER TABLE products ADD COLUMN media_url TEXT");
      console.log('[Migration 010] Kolom media_url berhasil ditambahkan ke tabel products.');
    }
  } catch (err) {
    console.warn('[Migration 010] Peringatan saat menambahkan kolom media_url:', err.message);
  }
}

module.exports = {
  up,
  migrate: up
};
