/**
 * Export Utility — Generate CSV/JSON export dari data personal assistant.
 * Digunakan oleh dashboard route untuk download data.
 */
const db = require('../db');

/**
 * Generate CSV string dari array of objects.
 * @param {Array<object>} data
 * @param {Array<string>} columns Kolom yang mau di-export
 * @returns {string} CSV content
 */
function toCSV(data, columns) {
  if (!data || data.length === 0) return columns.join(',') + '\n';

  const header = columns.join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
      // Escape commas and quotes in CSV
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  });

  return header + '\n' + rows.join('\n') + '\n';
}

/**
 * Export pengeluaran (expenses).
 * @param {string} [startDate] Format YYYY-MM-DD
 * @param {string} [endDate] Format YYYY-MM-DD
 * @returns {string} CSV
 */
function exportExpenses(startDate, endDate) {
  let data;
  if (startDate && endDate) {
    data = db.getExpensesByDateRange ? db.getExpensesByDateRange(startDate, endDate) : [];
  } else {
    data = db.getAllExpenses ? db.getAllExpenses() : [];
  }
  return toCSV(data, ['id', 'category', 'amount', 'note', 'created_at']);
}

/**
 * Export catatan (notes).
 * @returns {string} CSV
 */
function exportNotes() {
  const data = db.getAllNotes ? db.getAllNotes(1000) : [];
  return toCSV(data, ['id', 'title', 'content', 'tags', 'created_at']);
}

/**
 * Export tugas (todos).
 * @returns {string} CSV
 */
function exportTodos() {
  const data = db.getAllTodos ? db.getAllTodos(1000) : [];
  return toCSV(data, ['id', 'task', 'priority', 'is_done', 'due_date', 'completed_at', 'created_at']);
}

/**
 * Export budgets.
 * @returns {string} CSV
 */
function exportBudgets() {
  const data = db.getAllBudgets ? db.getAllBudgets() : [];
  return toCSV(data, ['id', 'category', 'monthly_limit', 'alert_at_percent', 'is_active']);
}

/**
 * Export habits + stats.
 * @returns {string} CSV
 */
function exportHabits() {
  const habits = db.getActiveHabits ? db.getActiveHabits() : [];
  const enriched = habits.map(h => {
    const streak = db.calculateStreak ? db.calculateStreak(h.id) : { current: 0, best: 0 };
    return { ...h, streak_current: streak.current, streak_best: streak.best };
  });
  return toCSV(enriched, ['id', 'name', 'frequency', 'streak_current', 'streak_best', 'created_at']);
}

/**
 * Export journals.
 * @returns {string} CSV
 */
function exportJournals() {
  const data = db.getAllJournals ? db.getAllJournals(1000) : [];
  return toCSV(data, ['id', 'content', 'mood', 'tags', 'journal_date', 'created_at']);
}

/**
 * Export goals.
 * @returns {string} CSV
 */
function exportGoals() {
  const data = db.getAllGoals ? db.getAllGoals(1000) : [];
  return toCSV(data, ['id', 'title', 'target_value', 'current_value', 'unit', 'deadline', 'status', 'completed_at']);
}

/**
 * Export events.
 * @returns {string} CSV
 */
function exportEvents() {
  const data = db.getUpcomingEvents ? db.getUpcomingEvents(1000) : [];
  return toCSV(data, ['id', 'title', 'event_date', 'location', 'description', 'remind_before_minutes']);
}

/**
 * Generate ringkasan bulanan untuk AI summary intent.
 * @returns {object}
 */
function generateMonthlySummary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthName = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  // Expenses
  const expenses = db.getMonthlyExpenses ? db.getMonthlyExpenses(year, month) : [];
  const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const categoryTotals = {};
  expenses.forEach(e => {
    const cat = e.category || 'Lainnya';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
  });
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Budgets
  const budgets = db.getAllBudgets ? db.getAllBudgets() : [];
  const budgetStatus = budgets.map(b => {
    const spent = expenses.filter(e => e.category && e.category.toLowerCase() === b.category.toLowerCase())
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { category: b.category, limit: b.monthly_limit, spent, percent: b.monthly_limit > 0 ? Math.round(spent / b.monthly_limit * 100) : 0 };
  });

  // Todos
  const allTodos = db.getAllTodos ? db.getAllTodos(500) : [];
  const activeTodos = allTodos.filter(t => !t.is_done).length;
  const doneTodos = allTodos.filter(t => t.is_done).length;

  // Habits
  const habits = db.getActiveHabits ? db.getActiveHabits() : [];
  const habitStats = habits.map(h => {
    const streak = db.calculateStreak ? db.calculateStreak(h.id) : { current: 0, best: 0 };
    return { name: h.name, streak: streak.current, best: streak.best };
  });

  // Goals
  const goals = db.getActiveGoals ? db.getActiveGoals() : [];
  const completedGoals = (db.getAllGoals ? db.getAllGoals(500) : []).filter(g => g.status === 'completed').length;

  // Journal
  const journalStreak = db.getJournalStreak ? db.getJournalStreak() : 0;
  const journalCount = (db.getAllJournals ? db.getAllJournals(500) : []).length;

  // Notes
  const noteCount = (db.getAllNotes ? db.getAllNotes(500) : []).length;

  return {
    monthName,
    expenses: { total: totalExpense, count: expenses.length, topCategories },
    budgets: budgetStatus,
    todos: { active: activeTodos, done: doneTodos },
    habits: habitStats,
    goals: { active: goals.length, completed: completedGoals },
    journal: { streak: journalStreak, count: journalCount },
    notes: { count: noteCount }
  };
}

module.exports = {
  toCSV,
  exportExpenses,
  exportNotes,
  exportTodos,
  exportBudgets,
  exportHabits,
  exportJournals,
  exportGoals,
  exportEvents,
  generateMonthlySummary
};
