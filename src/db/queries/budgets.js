const db = require('../connection');
const { normalizeCategory } = require('../../utils/categories');

/**
 * Set atau update budget untuk kategori tertentu.
 * Jika kategori sudah ada (berdasarkan pencocokan kanonikal), update limit-nya.
 * @param {object} budget
 * @param {string} budget.category
 * @param {number} budget.monthly_limit
 * @param {number} [budget.alert_at_percent]
 * @returns {number} ID budget
 */
function setBudget({ category, monthly_limit, alert_at_percent = 80 }) {
  const normCat = normalizeCategory(category);
  const existing = getBudgetByCategory(category) || getBudgetByCategory(normCat);
  
  if (existing) {
    db.prepare(`
      UPDATE budgets SET category = ?, monthly_limit = ?, alert_at_percent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(normCat, monthly_limit, alert_at_percent, existing.id);
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO budgets (category, monthly_limit, alert_at_percent)
    VALUES (?, ?, ?)
  `).run(normCat, monthly_limit, alert_at_percent);
  return result.lastInsertRowid;
}

/**
 * Ambil budget berdasarkan kategori (dengan pencocokan kanonikal dan case-insensitive).
 * @param {string} category
 * @returns {object|null}
 */
function getBudgetByCategory(category) {
  if (!category) return null;
  const normCat = normalizeCategory(category);
  const rawCat = category.trim();

  // 1. Cek langsung dengan nama kanonikal atau raw input
  const direct = db.prepare(`
    SELECT * FROM budgets 
    WHERE (LOWER(category) = LOWER(?) OR LOWER(category) = LOWER(?)) 
      AND is_active = 1
    ORDER BY id DESC LIMIT 1
  `).get(rawCat, normCat);

  if (direct) return direct;

  // 2. Cek apakah ada budget aktif yang namanya cocok secara kanonikal
  const allActive = getAllBudgets();
  for (const b of allActive) {
    if (normalizeCategory(b.category) === normCat) {
      return b;
    }
  }

  return null;
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
