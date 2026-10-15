const db = require('../connection');

/**
 * Mengambil log chat berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getChatLogById(id) {
  return db.prepare('SELECT * FROM chat_logs WHERE id = ?').get(id) || null;
}

/**
 * Mengambil seluruh log chat dengan pagination.
 * @param {number} [limit=100] 
 * @param {number} [offset=0] 
 * @returns {Array<object>}
 */
function getAllChatLogs(limit = 100, offset = 0) {
  return db.prepare(`
    SELECT * FROM chat_logs 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

/**
 * Mengambil log chat berdasarkan nomor kontak lawan bicara (mendukung penyatuan @lid & @c.us).
 * @param {string} contact 
 * @param {number} [limit=50] 
 * @returns {Array<object>}
 */
function getChatLogsByContact(contact, limit = 50) {
  if (!contact) return [];
  
  const targetJids = new Set([contact]);

  // Cari padanan ID (@lid atau @c.us) dari tabel customer_profiles jika ada
  try {
    const cleanNum = contact.replace(/[^0-9]/g, '');
    if (cleanNum && cleanNum.length >= 9) {
      targetJids.add(`${cleanNum}@c.us`);
    }
    
    const profileRows = db.prepare(`
      SELECT contact, lid_jid, phone_number FROM customer_profiles
      WHERE contact = ? OR lid_jid = ? OR phone_number = ? OR phone_number = ?
      LIMIT 2
    `).all(contact, contact, cleanNum, contact.replace('@c.us', ''));

    if (profileRows && profileRows.length > 0) {
      for (const row of profileRows) {
        if (row.contact) targetJids.add(row.contact);
        if (row.lid_jid) targetJids.add(row.lid_jid);
        if (row.phone_number) {
          targetJids.add(row.phone_number);
          targetJids.add(`${row.phone_number}@c.us`);
        }
      }
    }
  } catch (_) {}

  const jidList = Array.from(targetJids);
  if (jidList.length === 1) {
    return db.prepare(`
      SELECT * FROM chat_logs 
      WHERE contact = ?
      ORDER BY created_at DESC, id DESC 
      LIMIT ?
    `).all(jidList[0], limit);
  }

  const placeholders = jidList.map(() => '?').join(', ');
  return db.prepare(`
    SELECT * FROM chat_logs 
    WHERE contact IN (${placeholders})
    ORDER BY created_at DESC, id DESC 
    LIMIT ?
  `).all(...jidList, limit);
}

// Pastikan kolom tokens_used tersedia di chat_logs
try {
  const tableInfo = db.prepare("PRAGMA table_info(chat_logs)").all();
  if (tableInfo && !tableInfo.some(c => c.name === 'tokens_used')) {
    db.exec("ALTER TABLE chat_logs ADD COLUMN tokens_used INTEGER DEFAULT 0");
  }
} catch (_) {}

/**
 * Mencatat interaksi chat masuk / keluar.
 * @param {object} log 
 * @param {string} log.contact 
 * @param {string} [log.message_in] 
 * @param {string} [log.message_out] 
 * @param {string} [log.handled_by] 'ai' | 'human' | 'ai_handover'
 * @param {number} [log.tokens_used]
 * @returns {number} ID log
 */
function createChatLog({ contact, message_in = null, message_out = null, handled_by = 'ai', tokens_used = 0 }) {
  const stmt = db.prepare(`
    INSERT INTO chat_logs (contact, message_in, message_out, handled_by, tokens_used, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(contact, message_in, message_out, handled_by, Number(tokens_used) || 0);
  return result.lastInsertRowid;
}

/**
 * Menghapus satu log chat berdasarkan ID.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteChatLog(id) {
  const result = db.prepare('DELETE FROM chat_logs WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Mengosongkan seluruh riwayat chat log.
 * @returns {boolean}
 */
function clearAllChatLogs() {
  const result = db.prepare('DELETE FROM chat_logs').run();
  return result.changes >= 0;
}

/**
 * Menghitung jumlah pesan AI yang diproses hari ini (untuk monitoring quota/token).
 * Hanya menghitung pesan yang benar-benar diproses oleh AI (bukan sistem/faq/human).
 * @returns {number}
 */
function getTodayAiMessageCount() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM chat_logs 
      WHERE (handled_by = 'ai' OR handled_by = 'ai_handover')
        AND date(created_at, 'localtime') = date('now', 'localtime')
    `).get();
    return row ? (row.count || 0) : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Menghitung total pemakaian token AI hari ini berdasarkan metadata API real.
 * @returns {number}
 */
function getTodayAiTokenCount() {
  try {
    const row = db.prepare(`
      SELECT SUM(COALESCE(tokens_used, 0)) as total FROM chat_logs 
      WHERE (handled_by = 'ai' OR handled_by = 'ai_handover')
        AND date(created_at, 'localtime') = date('now', 'localtime')
    `).get();
    return row ? (row.total || 0) : 0;
  } catch (_) {
    return 0;
  }
}

module.exports = {
  getChatLogById,
  getAllChatLogs,
  getChatLogsByContact,
  createChatLog,
  deleteChatLog,
  clearAllChatLogs,
  getTodayAiMessageCount,
  getTodayAiTokenCount
};
