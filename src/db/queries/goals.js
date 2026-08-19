const db = require('../connection');

/**
 * Buat goal baru.
 */
function createGoal({ title, target_value, unit, deadline }) {
  const result = db.prepare(`
    INSERT INTO goals (title, target_value, unit, deadline)
    VALUES (?, ?, ?, ?)
  `).run(title.trim(), target_value || null, unit || null, deadline || null);
  return result.lastInsertRowid;
}

function getGoalById(id) {
  return db.prepare('SELECT * FROM goals WHERE id = ?').get(id) || null;
}

/**
 * Ambil semua goal aktif.
 */
function getActiveGoals() {
  return db.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY deadline ASC, created_at ASC").all();
}

/**
 * Ambil semua goal (termasuk completed).
 */
function getAllGoals(limit = 50) {
  return db.prepare('SELECT * FROM goals ORDER BY status ASC, created_at DESC LIMIT ?').all(limit);
}

/**
 * Update progress goal.
 */
function updateGoalProgress(id, newValue) {
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  if (!goal) return { updated: false };

  db.prepare('UPDATE goals SET current_value = ? WHERE id = ?').run(newValue, id);

  // Auto-complete jika target tercapai
  if (goal.target_value && newValue >= goal.target_value) {
    db.prepare("UPDATE goals SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    return { updated: true, completed: true, goal: { ...goal, current_value: newValue } };
  }

  return { updated: true, completed: false, goal: { ...goal, current_value: newValue } };
}

/**
 * Cari goal by keyword.
 */
function findGoalByKeyword(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  return db.prepare(`
    SELECT * FROM goals WHERE status = 'active' AND LOWER(title) LIKE ?
    ORDER BY created_at ASC LIMIT 1
  `).get(like) || null;
}

/**
 * Selesaikan goal manual.
 */
function completeGoal(id) {
  return db.prepare("UPDATE goals SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(id).changes > 0;
}

function deleteGoal(id) {
  return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0;
}

module.exports = {
  createGoal,
  getGoalById,
  getActiveGoals,
  getAllGoals,
  updateGoalProgress,
  findGoalByKeyword,
  completeGoal,
  deleteGoal
};
