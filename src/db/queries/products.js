const db = require('../connection');

/**
 * Mengambil produk berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
}

/**
 * Mengambil seluruh data produk.
 * @returns {Array<object>}
 */
function getAllProducts() {
  return db.prepare('SELECT * FROM products ORDER BY name ASC').all();
}

/**
 * Mencari produk berdasarkan kata kunci (untuk RAG ringan bot).
 * @param {string} keyword 
 * @returns {Array<object>}
 */
function searchProducts(keyword) {
  const query = `%${keyword}%`;
  return db.prepare(`
    SELECT * FROM products 
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name ASC
  `).all(query, query);
}

/**
 * Menambahkan produk baru.
 * @param {object} product 
 * @param {string} product.name 
 * @param {string} [product.description] 
 * @param {number} [product.price] 
 * @param {number} [product.stock] 
 * @param {string} [product.image_path] 
 * @returns {number} ID produk yang baru dibuat
 */
function createProduct({ name, description = '', price = 0, stock = 0, image_path = null }) {
  const stmt = db.prepare(`
    INSERT INTO products (name, description, price, stock, image_path, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(name, description, Number(price) || 0, Number(stock) || 0, image_path);
  return result.lastInsertRowid;
}

/**
 * Memperbarui data produk secara penuh.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateProduct(id, { name, description, price, stock, image_path }) {
  const stmt = db.prepare(`
    UPDATE products
    SET name = ?, description = ?, price = ?, stock = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(name, description, Number(price) || 0, Number(stock) || 0, image_path, id);
  return result.changes > 0;
}

/**
 * Memperbarui jumlah stok produk.
 * @param {number} id 
 * @param {number} stock 
 * @returns {boolean}
 */
function updateProductStock(id, stock) {
  const stmt = db.prepare(`
    UPDATE products
    SET stock = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(Number(stock) || 0, id);
  return result.changes > 0;
}

/**
 * Menghapus produk berdasarkan ID.
 * @param {number} id 
 * @returns {boolean}
 */
function deleteProduct(id) {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  getProductById,
  getAllProducts,
  searchProducts,
  createProduct,
  updateProduct,
  updateProductStock,
  deleteProduct
};
