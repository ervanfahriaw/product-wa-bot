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
 * Mengambil semua reminder yang masih aktif (belum di-cancel).
 * @returns {Array<object>}
 */
function getActiveReminders() {
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE is_active = 1 
    ORDER BY trigger_at ASC
  `).all();
}

/**
 * Mengambil reminder yang belum terkirim, aktif, dan sudah waktunya dijalankan.
 * Memperhitungkan snoozed_until — jika di-snooze, baru trigger setelah snooze habis.
 * @param {string} [currentDateTime] Format ISO atau YYYY-MM-DD HH:MM:SS
 * @returns {Array<object>}
 */
function getPendingReminders(currentDateTime) {
  const nowClause = currentDateTime
    ? `datetime('${currentDateTime}')`
    : `datetime('now', 'localtime')`;

  return db.prepare(`
    SELECT * FROM reminders 
    WHERE is_active = 1 
      AND (sent = 0 OR recurrence_type IS NOT NULL)
      AND (
        datetime(trigger_at) <= ${nowClause}
        OR datetime(trigger_at, 'localtime') <= ${nowClause}
        OR trigger_at <= ${nowClause}
      )
      AND (
        snoozed_until IS NULL 
        OR datetime(snoozed_until) <= ${nowClause}
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
 * @param {string|null} [reminder.label] Label untuk identifikasi/pencarian
 * @param {string|null} [reminder.recurrence_type] 'daily', 'weekly', 'monthly', atau null
 * @returns {number} ID reminder
 */
function createReminder({ message, trigger_at, is_recurring = 0, cron_pattern = null, sent = 0, label = null, recurrence_type = null }) {
  const stmt = db.prepare(`
    INSERT INTO reminders (message, trigger_at, is_recurring, cron_pattern, sent, label, recurrence_type, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(
    message.trim(),
    trigger_at,
    is_recurring || recurrence_type ? 1 : 0,
    cron_pattern,
    sent ? 1 : 0,
    label || message.trim().toLowerCase().substring(0, 100),
    recurrence_type || null
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
 * Update trigger_at ke waktu berikutnya untuk recurring reminder.
 * @param {number} id 
 * @param {string} nextTriggerAt Format DATETIME
 * @returns {boolean}
 */
function updateNextTrigger(id, nextTriggerAt) {
  const stmt = db.prepare(`
    UPDATE reminders 
    SET trigger_at = ?, sent = 0, snoozed_until = NULL 
    WHERE id = ?
  `);
  const result = stmt.run(nextTriggerAt, id);
  return result.changes > 0;
}

/**
 * Snooze (tunda) reminder untuk durasi tertentu dari sekarang.
 * @param {number} id 
 * @param {number} durationMinutes Durasi tunda dalam menit
 * @returns {boolean}
 */
function snoozeReminder(id, durationMinutes = 30) {
  const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  const isoString = snoozeUntil.toISOString().replace('T', ' ').substring(0, 19);
  const stmt = db.prepare(`
    UPDATE reminders 
    SET snoozed_until = ?, sent = 0 
    WHERE id = ?
  `);
  const result = stmt.run(isoString, id);
  return result.changes > 0;
}

/**
 * Batalkan (nonaktifkan) reminder berdasarkan ID.
 * @param {number} id 
 * @returns {boolean}
 */
function cancelReminderById(id) {
  const stmt = db.prepare('UPDATE reminders SET is_active = 0 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Batalkan (nonaktifkan) reminder berdasarkan label/keyword.
 * Cari reminder aktif yang label-nya cocok (LIKE) lalu nonaktifkan.
 * @param {string} label Kata kunci pencarian
 * @returns {{cancelled: number, reminder: object|null}}
 */
function cancelReminderByLabel(label) {
  const keyword = `%${label.toLowerCase().trim()}%`;
  const found = db.prepare(`
    SELECT * FROM reminders 
    WHERE is_active = 1 AND LOWER(label) LIKE ? 
    ORDER BY trigger_at ASC LIMIT 1
  `).get(keyword);

  if (!found) return { cancelled: 0, reminder: null };

  db.prepare('UPDATE reminders SET is_active = 0 WHERE id = ?').run(found.id);
  return { cancelled: 1, reminder: found };
}

/**
 * Ambil reminder terakhir yang dikirim (untuk konteks snooze tanpa label).
 * @returns {object|null}
 */
function getLastSentReminder() {
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE is_active = 1 AND sent = 1 
    ORDER BY trigger_at DESC LIMIT 1
  `).get() || null;
}

/**
 * Cari reminder berdasarkan label/keyword.
 * @param {string} keyword 
 * @returns {Array<object>}
 */
function searchRemindersByLabel(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  return db.prepare(`
    SELECT * FROM reminders 
    WHERE is_active = 1 AND LOWER(label) LIKE ? 
    ORDER BY trigger_at ASC
  `).all(like);
}

/**
 * Memperbarui data reminder.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateReminder(id, { message, trigger_at, is_recurring = 0, cron_pattern = null, sent = 0, label = null, recurrence_type = null }) {
  const stmt = db.prepare(`
    UPDATE reminders 
    SET message = ?, trigger_at = ?, is_recurring = ?, cron_pattern = ?, sent = ?, label = ?, recurrence_type = ?
    WHERE id = ?
  `);
  const result = stmt.run(
    message.trim(),
    trigger_at,
    is_recurring || recurrence_type ? 1 : 0,
    cron_pattern,
    sent ? 1 : 0,
    label || message.trim().toLowerCase().substring(0, 100),
    recurrence_type || null,
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
  getActiveReminders,
  getPendingReminders,
  createReminder,
  markReminderSent,
  updateNextTrigger,
  snoozeReminder,
  cancelReminderById,
  cancelReminderByLabel,
  getLastSentReminder,
  searchRemindersByLabel,
  updateReminder,
  deleteReminder
};
