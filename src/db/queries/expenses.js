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
 * Mengambil ringkasan pengeluaran bulan ini (total nominal, jumlah transaksi, breakdown per kategori).
 * @param {number|string} [year]
 * @param {number|string} [month]
 * @returns {{ total: number, count: number, byCategory: Array<object> }}
 */
function getMonthSummary(year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
  const formattedMonth = String(month).padStart(2, '0');
  const pattern = `${year}-${formattedMonth}-%`;
  
  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
    FROM expenses 
    WHERE created_at LIKE ?
  `).get(pattern);

  const byCategory = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count 
    FROM expenses 
    WHERE created_at LIKE ?
    GROUP BY category 
    ORDER BY total DESC
  `).all(pattern);

  return {
    total: totalRow ? totalRow.total : 0,
    count: totalRow ? totalRow.count : 0,
    byCategory: byCategory || []
  };
}

const { normalizeCategory } = require('../../utils/categories');

/**
 * Mencatat pengeluaran baru dengan kategori yang dinormalisasi.
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

  const normalizedCat = normalizeCategory(category);

  if (created_at) {
    const stmt = db.prepare(`
      INSERT INTO expenses (category, amount, note, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(normalizedCat, parsedAmount, note, created_at);
    return result.lastInsertRowid;
  }

  const stmt = db.prepare(`
    INSERT INTO expenses (category, amount, note, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(normalizedCat, parsedAmount, note);
  return result.lastInsertRowid;
}

/**
 * Memperbarui catatan pengeluaran.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateExpense(id, { category, amount, note }) {
  const current = getExpenseById(id);
  if (!current) return false;

  const parsedAmount = amount !== undefined ? Math.round(Number(amount)) : current.amount;
  const newCat = category ? normalizeCategory(category) : current.category;
  const newNote = note !== undefined ? note : current.note;

  const stmt = db.prepare(`
    UPDATE expenses 
    SET category = ?, amount = ?, note = ?
    WHERE id = ?
  `);
  const result = stmt.run(newCat, parsedAmount, newNote, id);
  return result.changes > 0;
}

/**
 * Memindahkan seluruh transaksi dari satu kategori ke kategori lain (Rekategorisasi).
 * @param {string} fromCategory 
 * @param {string} toCategory 
 * @returns {{ affected: number, from: string, to: string }}
 */
function recategorizeExpenses(fromCategory, toCategory) {
  const targetCategory = normalizeCategory(toCategory);
  
  // Ambil semua transaksi yang cocok dengan nama kategori awal (secara longgar atau persis)
  const rows = db.prepare(`
    SELECT id, category FROM expenses
    WHERE LOWER(category) = LOWER(?) OR LOWER(category) LIKE LOWER(?)
  `).all(fromCategory.trim(), `%${fromCategory.trim()}%`);

  if (!rows || rows.length === 0) {
    return { affected: 0, from: fromCategory, to: targetCategory };
  }

  const stmt = db.prepare('UPDATE expenses SET category = ? WHERE id = ?');
  let affected = 0;
  for (const r of rows) {
    if (r.category !== targetCategory) {
      stmt.run(targetCategory, r.id);
      affected++;
    }
  }

  return { affected, from: fromCategory, to: targetCategory };
}

/**
 * Mengambil transaksi pengeluaran paling terakhir dicatat.
 * @returns {object|null}
 */
function getLastExpense() {
  return db.prepare('SELECT * FROM expenses ORDER BY id DESC LIMIT 1').get() || null;
}

/**
 * Menghapus transaksi pengeluaran paling terakhir dicatat.
 * @returns {{ success: boolean, deletedExpense: object|null }}
 */
function deleteLastExpense() {
  const last = getLastExpense();
  if (!last) return { success: false, deletedExpense: null };
  const deleted = deleteExpense(last.id);
  return { success: deleted, deletedExpense: last };
}

/**
 * Menghapus catatan pengeluaran berdasarkan keyword atau nominal tertentu.
 * @param {object} filter
 * @param {string} [filter.keyword]
 * @param {number} [filter.amount]
 * @param {string} [filter.category]
 * @returns {{ success: boolean, count: number, deletedExpenses: Array<object> }}
 */
function deleteExpenseByKeywordOrAmount({ keyword, amount, category }) {
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];

  if (amount && Number(amount) > 0) {
    query += ' AND (amount = ? OR amount = ?)';
    params.push(Math.round(Number(amount)), Number(amount));
  }

  if (category) {
    const norm = normalizeCategory(category);
    query += ' AND (LOWER(category) = LOWER(?) OR LOWER(category) = LOWER(?))';
    params.push(category.trim(), norm);
  }

  if (keyword && keyword.trim()) {
    query += ' AND (LOWER(note) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))';
    params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`);
  }

  query += ' ORDER BY id DESC LIMIT 5';
  const matched = db.prepare(query).all(...params);

  if (!matched || matched.length === 0) {
    return { success: false, count: 0, deletedExpenses: [] };
  }

  const deleteStmt = db.prepare('DELETE FROM expenses WHERE id = ?');
  for (const exp of matched) {
    deleteStmt.run(exp.id);
  }

  return { success: true, count: matched.length, deletedExpenses: matched };
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
  const defaultCats = ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan & Utilitas', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Lain-lain'];
  const dbCats = rows.map(r => r.category);
  return Array.from(new Set([...defaultCats, ...dbCats]));
}

/**
 * Mengambil catatan pengeluaran terbaru dengan limit.
 * @param {number} [limit=10]
 * @returns {Array<object>}
 */
function getRecentExpenses(limit = 10) {
  return db.prepare('SELECT * FROM expenses ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
}

module.exports = {
  getExpenseById,
  getAllExpenses,
  getRecentExpenses,
  getExpensesByDateRange,
  getMonthlyExpenses,
  getMonthSummary,
  createExpense,
  updateExpense,
  recategorizeExpenses,
  getLastExpense,
  deleteLastExpense,
  deleteExpenseByKeywordOrAmount,
  deleteExpense,
  getExpenseCategories
};
