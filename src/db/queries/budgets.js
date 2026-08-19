const db = require('../connection');

/**
 * Set atau update budget untuk kategori tertentu.
 * Jika kategori sudah ada, update limit-nya. Jika belum, buat baru.
 * @param {object} budget
 * @param {string} budget.category
 * @param {number} budget.monthly_limit
 * @param {number} [budget.alert_at_percent]
 * @returns {number} ID budget
 */
function setBudget({ category, monthly_limit, alert_at_percent = 80 }) {
  const existing = db.prepare('SELECT id FROM budgets WHERE LOWER(category) = LOWER(?)').get(category.trim());
  
  if (existing) {
    db.prepare(`
      UPDATE budgets SET monthly_limit = ?, alert_at_percent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(monthly_limit, alert_at_percent, existing.id);
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO budgets (category, monthly_limit, alert_at_percent)
    VALUES (?, ?, ?)
  `).run(category.trim(), monthly_limit, alert_at_percent);
  return result.lastInsertRowid;
}

/**
 * Ambil budget berdasarkan kategori (case-insensitive).
 * @param {string} category
 * @returns {object|null}
 */
function getBudgetByCategory(category) {
  return db.prepare('SELECT * FROM budgets WHERE LOWER(category) = LOWER(?) AND is_active = 1').get(category.trim()) || null;
}

/**
 * Ambil semua budget aktif.
 * @returns {Array<object>}
 */
function getAllBudgets() {
  return db.prepare('SELECT * FROM budgets WHERE is_active = 1 ORDER BY category ASC').all();
}

/**
 * Update budget.
 * @param {number} id
 * @param {object} updates
 * @returns {boolean}
 */
function updateBudget(id, { monthly_limit, alert_at_percent }) {
  const stmt = db.prepare(`
    UPDATE budgets SET monthly_limit = ?, alert_at_percent = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(monthly_limit, alert_at_percent || 80, id).changes > 0;
}

/**
 * Hapus budget.
 * @param {number} id
 * @returns {boolean}
 */
function deleteBudget(id) {
  return db.prepare('DELETE FROM budgets WHERE id = ?').run(id).changes > 0;
}

/**
 * Nonaktifkan budget.
 * @param {number} id
 * @returns {boolean}
 */
function deactivateBudget(id) {
  return db.prepare('UPDATE budgets SET is_active = 0 WHERE id = ?').run(id).changes > 0;
}

module.exports = {
  setBudget,
  createBudget: setBudget,
  getBudgetByCategory,
  getAllBudgets,
  updateBudget,
  deleteBudget,
  deactivateBudget
};
