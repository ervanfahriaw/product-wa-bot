const db = require('../connection');

// Pastikan tabel contact_states dan kolom lead_status sudah dibuat jika database sudah ada sebelumnya
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_states (
      contact TEXT PRIMARY KEY,
      is_paused INTEGER NOT NULL DEFAULT 0,
      paused_until DATETIME,
      pause_reason TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Cek apakah kolom lead_status sudah ada di chat_logs
  const tableInfo = db.prepare("PRAGMA table_info(chat_logs)").all();
  const hasLeadStatus = tableInfo.some(col => col.name === 'lead_status');
  if (!hasLeadStatus) {
    db.exec("ALTER TABLE chat_logs ADD COLUMN lead_status TEXT DEFAULT 'general'");
  }
} catch (_) {}

/**
 * Mengambil status pause dari kontak tertentu.
 * @param {string} contact 
 * @returns {object|null}
 */
function getContactState(contact) {
  if (!contact) return null;
  return db.prepare('SELECT * FROM contact_states WHERE contact = ?').get(contact) || null;
}

/**
 * Menjeda (Mute / Pause) balasan otomatis bot untuk kontak tertentu.
 * @param {string} contact 
 * @param {number} [hours=2] Durasi jeda dalam jam
 * @param {string} [reason='Handover Owner / Nego'] Alasan jeda
 * @returns {boolean}
 */
function pauseContact(contact, hours = 2, reason = 'Handover Owner / Nego') {
  if (!contact) return false;

  const validHours = Math.max(0.1, Number(hours) || 2);
  const stmt = db.prepare(`
    INSERT INTO contact_states (contact, is_paused, paused_until, pause_reason, updated_at)
    VALUES (?, 1, datetime('now', '+' || ? || ' hours'), ?, CURRENT_TIMESTAMP)
    ON CONFLICT(contact) DO UPDATE SET
      is_paused = 1,
      paused_until = datetime('now', '+' || ? || ' hours'),
      pause_reason = ?,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(contact, validHours, reason, validHours, reason);
  return true;
}

/**
 * Melanjutkan kembali (Unpause / Resume) balasan otomatis bot untuk kontak tertentu.
 * @param {string} contact 
 * @returns {boolean}
 */
function resumeContact(contact) {
  if (!contact) return false;

  const stmt = db.prepare(`
    INSERT INTO contact_states (contact, is_paused, paused_until, pause_reason, updated_at)
    VALUES (?, 0, NULL, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT(contact) DO UPDATE SET
      is_paused = 0,
      paused_until = NULL,
      pause_reason = NULL,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(contact);
  return true;
}

/**
 * Memeriksa apakah bot untuk kontak ini sedang dalam keadaan dijeda (Paused).
 * Jika waktu jeda sudah lewat/kadaluarsa, otomatis mengembalikan status aktif.
 * @param {string} contact 
 * @returns {boolean}
 */
function isContactPaused(contact) {
  if (!contact) return false;

  const state = db.prepare(`
    SELECT *, 
           (CASE WHEN paused_until > datetime('now') THEN 1 ELSE 0 END) AS is_active_pause
    FROM contact_states 
    WHERE contact = ?
  `).get(contact);

  if (!state) return false;

  if (state.is_paused === 1) {
    if (state.is_active_pause === 1) {
      return true;
    }
    // Jika durasi jeda sudah kedaluwarsa, kembalikan ke aktif
    resumeContact(contact);
    return false;
  }

  return false;
}

/**
 * Mengambil semua kontak yang saat ini sedang dalam status dijeda (Paused).
 * @returns {Array<object>}
 */
function getAllPausedContacts() {
  return db.prepare(`
    SELECT * FROM contact_states 
    WHERE is_paused = 1 AND paused_until > datetime('now')
    ORDER BY updated_at DESC
  `).all();
}

module.exports = {
  getContactState,
  pauseContact,
  resumeContact,
  unpauseContact: resumeContact,
  isContactPaused,
  getAllPausedContacts
};
