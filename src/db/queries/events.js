const db = require('../connection');

/**
 * Buat event baru.
 */
function createEvent({ title, description, event_date, event_end, location, remind_before_minutes = 30 }) {
  const result = db.prepare(`
    INSERT INTO events (title, description, event_date, event_end, location, remind_before_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description || null, event_date, event_end || null, location || null, remind_before_minutes);
  return result.lastInsertRowid;
}

function getEventById(id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id) || null;
}

/**
 * Ambil event yang akan datang.
 */
function getUpcomingEvents(limit = 20) {
  return db.prepare(`
    SELECT * FROM events WHERE event_date >= datetime('now', 'localtime')
    ORDER BY event_date ASC LIMIT ?
  `).all(limit);
}

/**
 * Ambil event hari ini.
 */
function getTodayEvents() {
  return db.prepare(`
    SELECT * FROM events WHERE DATE(event_date) = DATE('now', 'localtime')
    ORDER BY event_date ASC
  `).all();
}

/**
 * Ambil event yang perlu dinotifikasi (belum notified, waktunya sudah dekat).
 */
function getEventsToNotify() {
  return db.prepare(`
    SELECT * FROM events 
    WHERE is_notified = 0 
    AND event_date >= datetime('now', 'localtime')
    AND event_date <= datetime('now', 'localtime', '+' || remind_before_minutes || ' minutes')
    ORDER BY event_date ASC
  `).all();
}

function markEventNotified(id) {
  return db.prepare('UPDATE events SET is_notified = 1 WHERE id = ?').run(id).changes > 0;
}

function deleteEvent(id) {
  return db.prepare('DELETE FROM events WHERE id = ?').run(id).changes > 0;
}

/**
 * Cari event by keyword.
 */
function findEventByKeyword(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  return db.prepare(`
    SELECT * FROM events WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ?
    ORDER BY event_date ASC LIMIT 1
  `).get(like, like) || null;
}

module.exports = {
  createEvent,
  getEventById,
  getUpcomingEvents,
  getTodayEvents,
  getEventsToNotify,
  markEventNotified,
  deleteEvent,
  findEventByKeyword
};
