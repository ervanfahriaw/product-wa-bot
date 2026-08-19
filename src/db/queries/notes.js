const db = require('../connection');

/**
 * Membuat catatan baru.
 * @param {object} note
 * @param {string} [note.title]
 * @param {string} note.content
 * @param {string} [note.tags] Comma-separated tags
 * @returns {number} ID catatan
 */
function createNote({ title = null, content, tags = null }) {
  const stmt = db.prepare(`
    INSERT INTO notes (title, content, tags)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    title ? title.trim() : null,
    content.trim(),
    tags ? tags.trim().toLowerCase() : null
  );
  return result.lastInsertRowid;
}

/**
 * Mengambil catatan berdasarkan ID.
 * @param {number} id
 * @returns {object|null}
 */
function getNoteById(id) {
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) || null;
}

/**
 * Mengambil semua catatan, urutkan dari terbaru.
 * @param {number} [limit=50]
 * @returns {Array<object>}
 */
function getAllNotes(limit = 50) {
  return db.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT ?').all(limit);
}

/**
 * Mencari catatan berdasarkan keyword di title, content, dan tags.
 * @param {string} keyword
 * @returns {Array<object>}
 */
function searchNotes(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  return db.prepare(`
    SELECT * FROM notes 
    WHERE LOWER(title) LIKE ? 
       OR LOWER(content) LIKE ? 
       OR LOWER(tags) LIKE ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(like, like, like);
}

/**
 * Mengupdate catatan.
 * @param {number} id
 * @param {object} updates
 * @returns {boolean}
 */
function updateNote(id, { title, content, tags }) {
  const stmt = db.prepare(`
    UPDATE notes 
    SET title = ?, content = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(
    title ? title.trim() : null,
    content.trim(),
    tags ? tags.trim().toLowerCase() : null,
    id
  );
  return result.changes > 0;
}

/**
 * Menghapus catatan berdasarkan ID.
 * @param {number} id
 * @returns {boolean}
 */
function deleteNoteById(id) {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Menghapus catatan berdasarkan keyword (cari yang cocok lalu hapus).
 * @param {string} keyword
 * @returns {{deleted: number, note: object|null}}
 */
function deleteNoteByKeyword(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  const found = db.prepare(`
    SELECT * FROM notes 
    WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?
    ORDER BY created_at DESC LIMIT 1
  `).get(like, like, like);

  if (!found) return { deleted: 0, note: null };

  db.prepare('DELETE FROM notes WHERE id = ?').run(found.id);
  return { deleted: 1, note: found };
}

module.exports = {
  createNote,
  getNoteById,
  getAllNotes,
  searchNotes,
  updateNote,
  deleteNoteById,
  deleteNote: deleteNoteById,
  deleteNoteByKeyword
};
