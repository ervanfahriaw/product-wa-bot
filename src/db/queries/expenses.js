const db = require('../connection');

/**
 * Mengambil catatan pengeluaran berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getExpenseById(id) {
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) || null;
}

/**
 * Mengambil semua catatan pengeluaran, diurutkan dari yang terbaru.
 * @returns {Array<object>}
 */
function getAllExpenses() {
  return db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all();
}

/**
 * Mengambil pengeluaran berdasarkan rentang tanggal.
 * @param {string} startDate Format YYYY-MM-DD
 * @param {string} endDate Format YYYY-MM-DD
 * @returns {Array<object>}
 */
function getExpensesByDateRange(startDate, endDate) {
  return db.prepare(`
    SELECT * FROM expenses 
    WHERE created_at >= ? AND created_at <= ?
    ORDER BY created_at ASC
  `).all(startDate, `${endDate} 23:59:59`);
}

/**
 * Mengambil total dan daftar pengeluaran bulan tertentu (untuk rekap on-demand bot).
 * @param {number|string} year Contoh: 2026
 * @param {number|string} month Contoh: '08' atau 8
 * @returns {Array<object>}
 */
function getMonthlyExpenses(year, month) {
  const formattedMonth = String(month).padStart(2, '0');
  const pattern = `${year}-${formattedMonth}-%`;
  return db.prepare(`
    SELECT * FROM expenses 
    WHERE created_at LIKE ?
    ORDER BY created_at ASC
  `).all(pattern);
}

/**
 * Mencatat pengeluaran baru.
 * @param {object} expense 
 * @param {string} expense.category 
 * @param {number} expense.amount 
 * @param {string} [expense.note] 
 * @param {string} [expense.created_at] 
 * @returns {number} ID pengeluaran yang baru dibuat
 */
function createExpense({ category, amount, note = '', created_at = null }) {
  const parsedAmount = Math.round(Number(amount));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Jumlah pengeluaran harus berupa angka positif.');
  }

  if (created_at) {
    const stmt = db.prepare(`
      INSERT INTO expenses (category, amount, note, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(category.trim(), parsedAmount, note, created_at);
    return result.lastInsertRowid;
  }

  const stmt = db.prepare(`
    INSERT INTO expenses (category, amount, note, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(category.trim(), parsedAmount, note);
  return result.lastInsertRowid;
}

/**
 * Memperbarui catatan pengeluaran.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateExpense(id, { category, amount, note }) {
  const parsedAmount = Math.round(Number(amount));
  const stmt = db.prepare(`
    UPDATE expenses 
    SET category = ?, amount = ?, note = ?
    WHERE id = ?
  `);
  const result = stmt.run(category.trim(), parsedAmount, note, id);
  return result.changes > 0;
}

/**
 * Menghapus catatan pengeluaran berdasarkan ID.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteExpense(id) {
  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Mengambil daftar kategori pengeluaran unik yang pernah dicatat.
 * @returns {Array<string>}
 */
function getExpenseCategories() {
  const rows = db.prepare("SELECT DISTINCT category FROM expenses WHERE category IS NOT NULL AND category != '' ORDER BY category ASC").all();
  const defaultCats = ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan & Utilitas', 'Hiburan', 'Lain-lain'];
  const dbCats = rows.map(r => r.category);
  return Array.from(new Set([...defaultCats, ...dbCats]));
}

module.exports = {
  getExpenseById,
  getAllExpenses,
  getExpensesByDateRange,
  getMonthlyExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories
};
