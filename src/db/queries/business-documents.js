const db = require('../connection');

// Pastikan tabel business_documents tersedia
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      extracted_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (_) {}

/**
 * Mengambil semua dokumen knowledge base bisnis.
 * @returns {Array<object>}
 */
function getAllBusinessDocuments() {
  return db.prepare('SELECT * FROM business_documents ORDER BY id DESC').all();
}

/**
 * Mengambil dokumen berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getBusinessDocumentById(id) {
  return db.prepare('SELECT * FROM business_documents WHERE id = ?').get(id) || null;
}

/**
 * Menambahkan dokumen baru ke knowledge base.
 * @param {object} doc
 * @param {string} doc.original_filename
 * @param {string} doc.file_path
 * @param {string} [doc.file_type]
 * @param {string} doc.extracted_text
 * @returns {number}
 */
function createBusinessDocument({ original_filename, file_path, file_type = 'text/plain', extracted_text }) {
  const stmt = db.prepare(`
    INSERT INTO business_documents (original_filename, file_path, file_type, extracted_text, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(original_filename, file_path, file_type, extracted_text.trim());
  return result.lastInsertRowid;
}

/**
 * Menghapus dokumen dari knowledge base.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteBusinessDocument(id) {
  const result = db.prepare('DELETE FROM business_documents WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  getAllBusinessDocuments,
  getBusinessDocumentById,
  createBusinessDocument,
  deleteBusinessDocument
};
