/**
 * Query module: orders (Order Tracking Mode Bisnis)
 * 
 * CRUD pesanan pelanggan. Status flow: pending → confirmed → shipped → completed / cancelled.
 */

const db = require('../connection');

// Pastikan tabel ada
require('../migrations/008-orders');

/**
 * Membuat order baru.
 * @param {object} data 
 * @returns {number}
 */
function createOrder(data) {
  const stmt = db.prepare(`
    INSERT INTO orders (contact, customer_name, order_summary, total_amount, status, resi_number, shipping_method, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const summary = data.order_summary || data.items || '';
  const result = stmt.run(
    data.contact || null,
    data.customer_name || null,
    summary,
    data.total_amount || 0,
    data.status || 'pending',
    data.resi_number || null,
    data.shipping_method || null,
    data.notes || null
  );
  return result.lastInsertRowid;
}

/**
 * Mengambil order berdasarkan ID.
 * @param {number} id 
 * @returns {object|undefined}
 */
function getOrderById(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

/**
 * Mengambil order berdasarkan kontak pelanggan.
 * @param {string} contact 
 * @param {number} [limit=10]
 * @returns {Array<object>}
 */
function getOrdersByContact(contact, limit = 10) {
  if (!contact) return [];
  return db.prepare('SELECT * FROM orders WHERE contact = ? ORDER BY created_at DESC LIMIT ?').all(contact, limit);
}

/**
 * Mengambil semua order, opsional filter status.
 * @param {string} [status] — 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'
 * @param {number} [limit=50]
 * @returns {Array<object>}
 */
function getAllOrders(status, limit = 50) {
  if (status) {
    return db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit);
  }
  return db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit);
}

/**
 * Update status order (dan opsional resi).
 * @param {number} id 
 * @param {string} status 
 * @param {string} [resiNumber]
 */
function updateOrderStatus(id, status, resiNumber) {
  if (resiNumber) {
    db.prepare('UPDATE orders SET status = ?, resi_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, resiNumber, id);
  } else {
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  }
}

/**
 * Menghapus order.
 * @param {number} id 
 */
function deleteOrder(id) {
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByContact,
  getAllOrders,
  getOrdersByStatus: getAllOrders,
  updateOrderStatus,
  deleteOrder
};
