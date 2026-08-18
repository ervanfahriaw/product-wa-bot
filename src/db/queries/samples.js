const db = require('../connection');

// Pastikan tabel conversation_samples tersedia
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_sample TEXT NOT NULL,
      bot_sample TEXT NOT NULL,
      tag TEXT DEFAULT 'umum',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (_) {}

/**
 * Mengambil semua contoh percakapan training.
 * @param {boolean} [onlyActive=false] 
 * @returns {Array<object>}
 */
function getAllSamples(onlyActive = false) {
  if (onlyActive) {
    return db.prepare('SELECT * FROM conversation_samples WHERE is_active = 1 ORDER BY id ASC').all();
  }
  return db.prepare('SELECT * FROM conversation_samples ORDER BY id DESC').all();
}

/**
 * Mengambil sampel berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getSampleById(id) {
  return db.prepare('SELECT * FROM conversation_samples WHERE id = ?').get(id) || null;
}

/**
 * Menambahkan contoh percakapan baru.
 * @param {object} sample
 * @param {string} sample.user_sample
 * @param {string} sample.bot_sample
 * @param {string} [sample.tag='umum']
 * @param {number} [sample.is_active=1]
 * @returns {number}
 */
function createSample({ user_sample, bot_sample, tag = 'umum', is_active = 1 }) {
  const stmt = db.prepare(`
    INSERT INTO conversation_samples (user_sample, bot_sample, tag, is_active, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(user_sample.trim(), bot_sample.trim(), tag ? tag.trim() : 'umum', is_active ? 1 : 0);
  return result.lastInsertRowid;
}

/**
 * Memperbarui contoh percakapan yang ada.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateSample(id, { user_sample, bot_sample, tag, is_active }) {
  const stmt = db.prepare(`
    UPDATE conversation_samples 
    SET user_sample = ?, bot_sample = ?, tag = ?, is_active = ?
    WHERE id = ?
  `);
  const result = stmt.run(
    user_sample.trim(), 
    bot_sample.trim(), 
    tag ? tag.trim() : 'umum', 
    typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : 1, 
    id
  );
  return result.changes > 0;
}

/**
 * Mengubah status aktif/nonaktif sampel dialog.
 * @param {number} id 
 * @returns {boolean}
 */
function toggleSampleActive(id) {
  const stmt = db.prepare(`
    UPDATE conversation_samples 
    SET is_active = (CASE WHEN is_active = 1 THEN 0 ELSE 1 END)
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Menghapus contoh percakapan berdasarkan ID.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteSample(id) {
  const result = db.prepare('DELETE FROM conversation_samples WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  getAllSamples,
  getSampleById,
  createSample,
  updateSample,
  toggleSampleActive,
  deleteSample
};
