const db = require('../connection');

/**
 * Mengambil reminder berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getReminderById(id) {
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) || null;
}

/**
 * Mengambil semua reminder.
 * @returns {Array<object>}
 */
function getAllReminders() {
  return db.prepare('SELECT * FROM reminders ORDER BY trigger_at ASC').all();
}

/**
 * Mengambil reminder yang belum terkirim dan sudah waktunya dijalankan.
 * @param {string} [currentDateTime] Format ISO atau YYYY-MM-DD HH:MM:SS (default datetime('now', 'localtime'))
 * @returns {Array<object>}
 */
function getPendingReminders(currentDateTime) {
  if (currentDateTime) {
    return db.prepare(`
      SELECT * FROM reminders 
      WHERE sent = 0 AND (
        datetime(trigger_at) <= datetime(?)
        OR datetime(trigger_at, 'localtime') <= datetime(?, 'localtime')
        OR trigger_at <= ?
      )
      ORDER BY trigger_at ASC
    `).all(currentDateTime, currentDateTime, currentDateTime);
  }
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE sent = 0 AND (
      datetime(trigger_at) <= datetime('now')
      OR datetime(trigger_at, 'localtime') <= datetime('now', 'localtime')
      OR trigger_at <= datetime('now', 'localtime')
      OR trigger_at <= datetime('now')
    )
    ORDER BY trigger_at ASC
  `).all();
}

/**
 * Membuat reminder baru.
 * @param {object} reminder 
 * @param {string} reminder.message 
 * @param {string} reminder.trigger_at Format DATETIME
 * @param {boolean|number} [reminder.is_recurring] 
 * @param {string|null} [reminder.cron_pattern] 
 * @param {boolean|number} [reminder.sent] 
 * @returns {number} ID reminder
 */
function createReminder({ message, trigger_at, is_recurring = 0, cron_pattern = null, sent = 0 }) {
  const stmt = db.prepare(`
    INSERT INTO reminders (message, trigger_at, is_recurring, cron_pattern, sent)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    message.trim(),
    trigger_at,
    is_recurring ? 1 : 0,
    cron_pattern,
    sent ? 1 : 0
  );
  return result.lastInsertRowid;
}

/**
 * Menandai reminder satu kali jalan sebagai sudah terkirim.
 * @param {number} id 
 * @returns {boolean}
 */
function markReminderSent(id) {
  const stmt = db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Memperbarui data reminder.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateReminder(id, { message, trigger_at, is_recurring = 0, cron_pattern = null, sent = 0 }) {
  const stmt = db.prepare(`
    UPDATE reminders 
    SET message = ?, trigger_at = ?, is_recurring = ?, cron_pattern = ?, sent = ?
    WHERE id = ?
  `);
  const result = stmt.run(
    message.trim(),
    trigger_at,
    is_recurring ? 1 : 0,
    cron_pattern,
    sent ? 1 : 0,
    id
  );
  return result.changes > 0;
}

/**
 * Menghapus reminder berdasarkan ID.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteReminder(id) {
  const result = db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  getReminderById,
  getAllReminders,
  getPendingReminders,
  createReminder,
  markReminderSent,
  updateReminder,
  deleteReminder
};
