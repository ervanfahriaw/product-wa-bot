const db = require('../connection');

// Pastikan tabel manual_handovers tersedia
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS manual_handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT NOT NULL,
      customer_name TEXT,
      trigger_message TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (_) {}

/**
 * Mengambil daftar antrean tiket handover manual.
 * @param {string} [statusFilter] - 'pending', 'resolved', atau null untuk semua
 * @returns {Array<object>}
 */
function getAllHandovers(statusFilter = null) {
  if (statusFilter && statusFilter !== 'all') {
    return db.prepare('SELECT * FROM manual_handovers WHERE status = ? ORDER BY id DESC').all(statusFilter);
  }
  return db.prepare('SELECT * FROM manual_handovers ORDER BY id DESC').all();
}

/**
 * Menghitung jumlah tiket handover yang masih berstatus 'pending'.
 * @returns {number}
 */
function getPendingHandoverCount() {
  const row = db.prepare("SELECT COUNT(*) as count FROM manual_handovers WHERE status = 'pending'").get();
  return row ? row.count : 0;
}

/**
 * Menambahkan tiket handover manual baru.
 * @param {object} ticket
 * @param {string} ticket.contact
 * @param {string} [ticket.customer_name]
 * @param {string} ticket.trigger_message
 * @param {string} ticket.reason
 * @returns {number}
 */
function createHandoverTicket({ contact, customer_name = null, trigger_message, reason }) {
  const stmt = db.prepare(`
    INSERT INTO manual_handovers (contact, customer_name, trigger_message, reason, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(contact, customer_name, trigger_message, reason);
  return result.lastInsertRowid;
}

/**
 * Menambahkan atau memperbarui pesan pada tiket handover yang sedang aktif (pending).
 * @param {string} contact 
 * @param {string} newMessage 
 * @param {string} [reason] 
 * @returns {number} ID tiket
 */
function appendOrUpdateHandoverTicket(contact, newMessage, reason = 'Pesan Tambahan dari Pelanggan') {
  const existing = db.prepare("SELECT * FROM manual_handovers WHERE contact = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(contact);
  if (existing) {
    const updatedMessage = `${existing.trigger_message}\n💬 ${newMessage}`;
    db.prepare("UPDATE manual_handovers SET trigger_message = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?").run(updatedMessage, existing.id);
    return existing.id;
  }
  return createHandoverTicket({
    contact,
    trigger_message: newMessage,
    reason
  });
}

/**
 * Menyelesaikan / menutup tiket handover manual.
 * @param {number} id 
 * @returns {boolean}
 */
function resolveHandoverTicket(id) {
  const stmt = db.prepare(`
    UPDATE manual_handovers 
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Menghapus tiket handover.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteHandoverTicket(id) {
  const result = db.prepare('DELETE FROM manual_handovers WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  getAllHandovers,
  getPendingHandoverCount,
  createHandoverTicket,
  appendOrUpdateHandoverTicket,
  resolveHandoverTicket,
  deleteHandoverTicket
};
