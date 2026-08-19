/**
 * Query module: follow-ups (Gentle Follow-Up Mode Bisnis)
 */

const db = require('../connection');

// Pastikan tabel ada
require('../migrations/009-follow-ups');

/**
 * Membuat data follow-up baru.
 * @param {object} data 
 * @returns {number}
 */
function createFollowUp(data) {
  const stmt = db.prepare(`
    INSERT INTO follow_ups (contact, product_name, inquiry_message, inquiry_at, scheduled_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.contact,
    data.product_name || null,
    data.inquiry_message || null,
    data.inquiry_at || new Date().toISOString(),
    data.scheduled_at,
    data.status || 'scheduled'
  );
  return result.lastInsertRowid;
}

/**
 * Mengambil follow-up berdasarkan ID.
 * @param {number} id 
 * @returns {object|undefined}
 */
function getFollowUpById(id) {
  return db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id);
}

/**
 * Mengambil semua follow-up yang dijadwalkan dan belum terkirim/batal.
 * @returns {Array<object>}
 */
function getScheduledFollowUps() {
  return db.prepare("SELECT * FROM follow_ups WHERE status = 'scheduled' ORDER BY scheduled_at ASC").all();
}

/**
 * Memperbarui status dan alasan pembatalan follow-up.
 * @param {number} id 
 * @param {string} status 
 * @param {string} [reason] 
 */
function updateFollowUpStatus(id, status, reason = null) {
  if (status === 'sent') {
    db.prepare(`
      UPDATE follow_ups 
      SET status = ?, sent_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, id);
  } else {
    db.prepare(`
      UPDATE follow_ups 
      SET status = ?, cancel_reason = ?
      WHERE id = ?
    `).run(status, reason, id);
  }
}

/**
 * Memasukkan kontak ke daftar opt-out follow-up.
 * @param {string} contact 
 */
function addOptOut(contact) {
  const stmt = db.prepare('INSERT OR IGNORE INTO follow_up_optouts (contact) VALUES (?)');
  stmt.run(contact);
}

/**
 * Menghapus kontak dari daftar opt-out follow-up.
 * @param {string} contact
 */
function removeOptOut(contact) {
  db.prepare('DELETE FROM follow_up_optouts WHERE contact = ?').run(contact);
}

/**
 * Memeriksa apakah suatu kontak telah opt-out dari follow-up.
 * @param {string} contact 
 * @returns {boolean}
 */
function isOptedOut(contact) {
  const row = db.prepare('SELECT 1 FROM follow_up_optouts WHERE contact = ?').get(contact);
  return !!row;
}

/**
 * Mengambil riwayat follow-up untuk suatu kontak.
 * @param {string} contact 
 * @param {number} [limit=10]
 * @returns {Array<object>}
 */
function getFollowUpsByContact(contact, limit = 10) {
  if (!contact) return [];
  return db.prepare('SELECT * FROM follow_ups WHERE contact = ? ORDER BY created_at DESC LIMIT ?').all(contact, limit);
}

/**
 * Mengecek apakah suatu kontak telah di-follow up baru-baru ini (dalam N hari terakhir).
 * @param {string} contact 
 * @param {number} [days=7] 
 * @returns {boolean}
 */
function hasRecentFollowUp(contact, days = 7) {
  if (!contact) return false;
  // Cek apakah ada yang berstatus 'sent' dalam N hari terakhir
  const row = db.prepare(`
    SELECT 1 FROM follow_ups 
    WHERE contact = ? 
      AND status = 'sent' 
      AND datetime(sent_at) >= datetime('now', ?)
    LIMIT 1
  `).get(contact, `-${days} days`);
  return !!row;
}

/**
 * Mengambil semua daftar opt-out follow-up.
 * @returns {Array<object>}
 */
function getAllOptOuts() {
  return db.prepare('SELECT * FROM follow_up_optouts ORDER BY opted_out_at DESC').all();
}

module.exports = {
  createFollowUp,
  scheduleFollowUpInDb: createFollowUp,
  getFollowUpById,
  getScheduledFollowUps,
  updateFollowUpStatus,
  addOptOut,
  addFollowUpOptOut: addOptOut,
  removeOptOut,
  removeFollowUpOptOut: removeOptOut,
  isOptedOut,
  isFollowUpOptedOut: isOptedOut,
  getFollowUpsByContact,
  hasRecentFollowUp,
  getAllOptOuts
};
