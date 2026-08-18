const db = require('../connection');

/**
 * Mengambil ringkasan data log percakapan untuk analisis bisnis.
 * @param {number} [days=30]
 * @returns {Array<object>}
 */
function getLogsForAnalytics(days = 30) {
  try {
    return db.prepare(`
      SELECT id, contact, message_in, message_out, handled_by, created_at
      FROM chat_logs
      WHERE datetime(created_at, 'localtime') >= datetime('now', 'localtime', ?)
      ORDER BY created_at ASC
    `).all(`-${days} days`);
  } catch (err) {
    // Fallback: ambil semua jika query date bermasalah
    return db.prepare('SELECT id, contact, message_in, message_out, handled_by, created_at FROM chat_logs ORDER BY created_at ASC').all();
  }
}

/**
 * Mengambil total pesan unik dan statistik penanganan.
 * @returns {object}
 */
function getGeneralChatStats() {
  try {
    const totalLogs = db.prepare('SELECT COUNT(*) as count FROM chat_logs').get()?.count || 0;
    const uniqueContacts = db.prepare('SELECT COUNT(DISTINCT contact) as count FROM chat_logs').get()?.count || 0;
    const aiHandled = db.prepare("SELECT COUNT(*) as count FROM chat_logs WHERE handled_by = 'ai'").get()?.count || 0;
    const humanHandled = db.prepare("SELECT COUNT(*) as count FROM chat_logs WHERE handled_by = 'human'").get()?.count || 0;
    const totalHandovers = db.prepare('SELECT COUNT(*) as count FROM manual_handovers').get()?.count || 0;

    return {
      totalLogs,
      uniqueContacts,
      aiHandled,
      humanHandled,
      totalHandovers
    };
  } catch (_) {
    return {
      totalLogs: 0,
      uniqueContacts: 0,
      aiHandled: 0,
      humanHandled: 0,
      totalHandovers: 0
    };
  }
}

module.exports = {
  getLogsForAnalytics,
  getGeneralChatStats
};
