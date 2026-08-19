const db = require('../connection');

/**
 * Membuat tugas baru.
 * @param {object} todo
 * @param {string} todo.task
 * @param {string} [todo.priority] 'urgent', 'normal', 'low'
 * @param {string} [todo.due_date] Format DATETIME
 * @returns {number} ID tugas
 */
function createTodo({ task, priority = 'normal', due_date = null }) {
  const stmt = db.prepare(`
    INSERT INTO todos (task, priority, due_date)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    task.trim(),
    ['urgent', 'normal', 'low'].includes(priority) ? priority : 'normal',
    due_date || null
  );
  return result.lastInsertRowid;
}

/**
 * Mengambil tugas berdasarkan ID.
 * @param {number} id
 * @returns {object|null}
 */
function getTodoById(id) {
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id) || null;
}

/**
 * Mengambil semua tugas yang belum selesai.
 * @returns {Array<object>}
 */
function getActiveTodos() {
  return db.prepare(`
    SELECT * FROM todos 
    WHERE is_done = 0 
    ORDER BY 
      CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
      created_at ASC
  `).all();
}

/**
 * Mengambil semua tugas (termasuk yang sudah selesai).
 * @param {number} [limit=100]
 * @returns {Array<object>}
 */
function getAllTodos(limit = 100) {
  return db.prepare(`
    SELECT * FROM todos 
    ORDER BY is_done ASC,
      CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
      created_at ASC
    LIMIT ?
  `).all(limit);
}

/**
 * Menandai tugas selesai berdasarkan keyword.
 * Cari task yang LIKE keyword DAN is_done=0, lalu tandai selesai.
 * @param {string} keyword
 * @returns {{completed: number, todo: object|null}}
 */
function completeTodoByKeyword(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  const found = db.prepare(`
    SELECT * FROM todos 
    WHERE is_done = 0 AND LOWER(task) LIKE ?
    ORDER BY created_at ASC LIMIT 1
  `).get(like);

  if (!found) return { completed: 0, todo: null };

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare(`
    UPDATE todos SET is_done = 1, completed_at = ? WHERE id = ?
  `).run(now, found.id);

  return { completed: 1, todo: found };
}

/**
 * Menandai tugas selesai berdasarkan ID.
 * @param {number} id
 * @returns {boolean}
 */
function completeTodoById(id) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const result = db.prepare(`
    UPDATE todos SET is_done = 1, completed_at = ? WHERE id = ?
  `).run(now, id);
  return result.changes > 0;
}

/**
 * Mengembalikan tugas ke status belum selesai.
 * @param {number} id
 * @returns {boolean}
 */
function uncompleteTodoById(id) {
  const result = db.prepare(`
    UPDATE todos SET is_done = 0, completed_at = NULL WHERE id = ?
  `).run(id);
  return result.changes > 0;
}

/**
 * Menghapus tugas berdasarkan ID.
 * @param {number} id
 * @returns {boolean}
 */
function deleteTodoById(id) {
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Menghapus tugas berdasarkan keyword.
 * @param {string} keyword
 * @returns {{deleted: number, todo: object|null}}
 */
function deleteTodoByKeyword(keyword) {
  const like = `%${keyword.toLowerCase().trim()}%`;
  const found = db.prepare(`
    SELECT * FROM todos 
    WHERE LOWER(task) LIKE ?
    ORDER BY is_done ASC, created_at ASC LIMIT 1
  `).get(like);

  if (!found) return { deleted: 0, todo: null };

  db.prepare('DELETE FROM todos WHERE id = ?').run(found.id);
  return { deleted: 1, todo: found };
}

/**
 * Toggle status selesai/belum dari suatu tugas.
 * @param {number} id 
 * @returns {boolean}
 */
function toggleTodo(id) {
  const todo = getTodoById(id);
  if (!todo) return false;
  if (todo.is_done) {
    return uncompleteTodoById(id);
  } else {
    return completeTodoById(id);
  }
}

module.exports = {
  createTodo,
  getTodoById,
  getActiveTodos,
  getAllTodos,
  completeTodoByKeyword,
  completeTodoById,
  uncompleteTodoById,
  toggleTodo,
  deleteTodoById,
  deleteTodo: deleteTodoById,
  deleteTodoByKeyword
};
