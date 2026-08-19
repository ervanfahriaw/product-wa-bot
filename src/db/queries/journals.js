const db = require('../connection');

/**
 * Buat journal entry.
 */
function createJournal({ content, mood, tags }) {
  const result = db.prepare(`
    INSERT INTO journals (content, mood, tags) VALUES (?, ?, ?)
  `).run(content.trim(), mood || null, tags || null);
  return result.lastInsertRowid;
}

function getJournalById(id) {
  return db.prepare('SELECT * FROM journals WHERE id = ?').get(id) || null;
}

/**
 * Ambil jurnal hari ini.
 */
function getTodayJournal() {
  return db.prepare(`
    SELECT * FROM journals WHERE journal_date = DATE('now', 'localtime')
    ORDER BY created_at DESC LIMIT 1
  `).get() || null;
}

/**
 * Ambil semua jurnal, terbaru dulu.
 */
function getAllJournals(limit = 30) {
  return db.prepare('SELECT * FROM journals ORDER BY journal_date DESC, created_at DESC LIMIT ?').all(limit);
}

/**
 * Cari jurnal by keyword atau mood.
 */
function searchJournals(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  return db.prepare(`
    SELECT * FROM journals 
    WHERE LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(mood) LIKE ?
    ORDER BY journal_date DESC LIMIT 20
  `).all(like, like, like);
}

/**
 * Ambil jurnal by tanggal spesifik.
 */
function getJournalByDate(date) {
  return db.prepare('SELECT * FROM journals WHERE journal_date = ? ORDER BY created_at DESC').all(date);
}

function deleteJournal(id) {
  return db.prepare('DELETE FROM journals WHERE id = ?').run(id).changes > 0;
}

/**
 * Hitung streak journal (berapa hari berturut-turut nulis jurnal).
 */
function getJournalStreak() {
  const journals = db.prepare(`
    SELECT DISTINCT journal_date FROM journals ORDER BY journal_date DESC
  `).all();

  if (journals.length === 0) return 0;

  const today = new Date().toISOString().substring(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

  if (journals[0].journal_date !== today && journals[0].journal_date !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < journals.length; i++) {
    const prev = new Date(journals[i - 1].journal_date);
    const curr = new Date(journals[i].journal_date);
    const diff = (prev - curr) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

module.exports = {
  createJournal,
  getJournalById,
  getTodayJournal,
  getAllJournals,
  searchJournals,
  getJournalByDate,
  deleteJournal,
  getJournalStreak
};
