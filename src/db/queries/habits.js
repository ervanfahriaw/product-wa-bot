const db = require('../connection');

// ==================== HABITS ====================

/**
 * Buat habit baru.
 * @param {object} habit
 * @param {string} habit.name
 * @param {string} [habit.frequency] 'daily' | 'weekly'
 * @param {number} [habit.target_per_period]
 * @returns {number} ID habit
 */
function createHabit({ name, frequency = 'daily', target_per_period = 1 }) {
  const result = db.prepare(`
    INSERT INTO habits (name, frequency, target_per_period)
    VALUES (?, ?, ?)
  `).run(name.trim(), frequency, target_per_period);
  return result.lastInsertRowid;
}

/**
 * Ambil habit berdasarkan ID.
 * @param {number} id
 * @returns {object|null}
 */
function getHabitById(id) {
  return db.prepare('SELECT * FROM habits WHERE id = ?').get(id) || null;
}

/**
 * Ambil semua habit aktif.
 * @returns {Array<object>}
 */
function getActiveHabits() {
  return db.prepare('SELECT * FROM habits WHERE is_active = 1 ORDER BY created_at ASC').all();
}

/**
 * Ambil semua habit (termasuk nonaktif).
 * @returns {Array<object>}
 */
function getAllHabits() {
  return db.prepare('SELECT * FROM habits ORDER BY is_active DESC, created_at ASC').all();
}

/**
 * Cari habit by name (LIKE).
 * @param {string} keyword
 * @returns {object|null} Habit pertama yang cocok
 */
function findHabitByName(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  return db.prepare(`
    SELECT * FROM habits WHERE is_active = 1 AND LOWER(name) LIKE ?
    ORDER BY created_at ASC LIMIT 1
  `).get(like) || null;
}

/**
 * Update streak habit.
 * @param {number} id
 * @param {number} current
 * @param {number} best
 * @returns {boolean}
 */
function updateStreak(id, current, best) {
  return db.prepare('UPDATE habits SET streak_current = ?, streak_best = ? WHERE id = ?')
    .run(current, best, id).changes > 0;
}

/**
 * Nonaktifkan habit.
 * @param {number} id
 * @returns {boolean}
 */
function deactivateHabit(id) {
  return db.prepare('UPDATE habits SET is_active = 0 WHERE id = ?').run(id).changes > 0;
}

/**
 * Hapus habit dan semua log-nya.
 * @param {number} id
 * @returns {boolean}
 */
function deleteHabit(id) {
  db.prepare('DELETE FROM habit_logs WHERE habit_id = ?').run(id);
  return db.prepare('DELETE FROM habits WHERE id = ?').run(id).changes > 0;
}

// ==================== HABIT LOGS ====================

/**
 * Catat check-in habit hari ini.
 * @param {number} habitId
 * @param {string} [note]
 * @returns {number} ID log
 */
function logHabitCheckin(habitId, note = null) {
  const result = db.prepare(`
    INSERT INTO habit_logs (habit_id, note) VALUES (?, ?)
  `).run(habitId, note);
  return result.lastInsertRowid;
}

/**
 * Cek apakah habit sudah check-in hari ini.
 * @param {number} habitId
 * @returns {boolean}
 */
function hasCheckedInToday(habitId) {
  const today = new Date().toISOString().substring(0, 10);
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM habit_logs 
    WHERE habit_id = ? AND DATE(logged_at) = DATE(?)
  `).get(habitId, today);
  return (row?.cnt || 0) > 0;
}

/**
 * Ambil jumlah check-in habit dalam periode tertentu.
 * @param {number} habitId
 * @param {number} [days=7] Jumlah hari ke belakang
 * @returns {number}
 */
function getCheckinCount(habitId, days = 7) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM habit_logs 
    WHERE habit_id = ? AND logged_at >= datetime('now', '-${days} days')
  `).get(habitId);
  return row?.cnt || 0;
}

/**
 * Ambil log check-in habit terbaru.
 * @param {number} habitId
 * @param {number} [limit=30]
 * @returns {Array<object>}
 */
function getHabitLogs(habitId, limit = 30) {
  return db.prepare(`
    SELECT * FROM habit_logs WHERE habit_id = ? 
    ORDER BY logged_at DESC LIMIT ?
  `).all(habitId, limit);
}

/**
 * Hitung streak saat ini untuk habit berdasarkan log harian.
 * @param {number} habitId
 * @returns {{current: number, best: number}}
 */
function calculateStreak(habitId) {
  const logs = db.prepare(`
    SELECT DISTINCT DATE(logged_at) as log_date FROM habit_logs 
    WHERE habit_id = ? ORDER BY log_date DESC
  `).all(habitId);

  if (logs.length === 0) return { current: 0, best: 0 };

  let current = 0;
  let best = 0;
  let tempStreak = 1;
  const today = new Date().toISOString().substring(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

  // Cek apakah hari ini atau kemarin ada log
  if (logs[0].log_date !== today && logs[0].log_date !== yesterday) {
    current = 0;
  } else {
    current = 1;
    for (let i = 1; i < logs.length; i++) {
      const prevDate = new Date(logs[i - 1].log_date);
      const currDate = new Date(logs[i].log_date);
      const diff = (prevDate - currDate) / 86400000;
      
      if (diff === 1) {
        current++;
        tempStreak++;
      } else {
        break;
      }
    }
  }

  // Hitung best streak dari semua data
  tempStreak = 1;
  best = 1;
  for (let i = 1; i < logs.length; i++) {
    const prevDate = new Date(logs[i - 1].log_date);
    const currDate = new Date(logs[i].log_date);
    const diff = (prevDate - currDate) / 86400000;
    
    if (diff === 1) {
      tempStreak++;
      if (tempStreak > best) best = tempStreak;
    } else {
      tempStreak = 1;
    }
  }

  if (current > best) best = current;

  return { current, best };
}

module.exports = {
  createHabit,
  getHabitById,
  getActiveHabits,
  getAllHabits,
  findHabitByName,
  updateStreak,
  deactivateHabit,
  deleteHabit,
  logHabitCheckin,
  logHabit: logHabitCheckin,
  hasCheckedInToday,
  getCheckinCount,
  getHabitLogs,
  calculateStreak,
  getHabitStreak: calculateStreak
};
