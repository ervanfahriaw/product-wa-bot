const db = require('../connection');

/**
 * Mengambil nilai setting berdasarkan key.
 * @param {string} key 
 * @returns {string|null}
 */
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Mengambil semua setting dalam bentuk key-value object.
 * @returns {Object.<string, string>}
 */
function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

/**
 * Menyimpan atau memperbarui nilai setting (upsert).
 * @param {string} key 
 * @param {string} value 
 * @returns {boolean}
 */
function setSetting(key, value) {
  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const result = stmt.run(key, stringValue);
  return result.changes > 0;
}

/**
 * Menghapus setting berdasarkan key.
 * @param {string} key 
 * @returns {boolean}
 */
function deleteSetting(key) {
  const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  return result.changes > 0;
}

module.exports = {
  getSetting,
  getAllSettings,
  setSetting,
  deleteSetting
};
