const db = require('../connection');

// Pastikan kolom baru (sku, category, product_knowledge) tersedia di tabel products
try {
  const tableInfo = db.prepare("PRAGMA table_info(products)").all();
  const existingCols = new Set(tableInfo.map(c => c.name));

  if (!existingCols.has('sku')) {
    db.exec("ALTER TABLE products ADD COLUMN sku TEXT");
  }
  if (!existingCols.has('category')) {
    db.exec("ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'Umum'");
  }
  if (!existingCols.has('product_knowledge')) {
    db.exec("ALTER TABLE products ADD COLUMN product_knowledge TEXT");
  }
} catch (_) {}

/**
 * Mengambil produk berdasarkan ID.
 * @param {number} id 
 * @returns {object|null}
 */
function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
}

/**
 * Mengambil produk berdasarkan SKU.
 * @param {string} sku 
 * @returns {object|null}
 */
function getProductBySku(sku) {
  if (!sku) return null;
  return db.prepare('SELECT * FROM products WHERE sku = ?').get(sku.trim()) || null;
}

/**
 * Mengambil seluruh data produk.
 * @returns {Array<object>}
 */
function getAllProducts() {
  return db.prepare('SELECT * FROM products ORDER BY name ASC').all();
}

/**
 * Mencari produk berdasarkan kata kunci (untuk RAG bot bisnis).
 * @param {string} keyword 
 * @returns {Array<object>}
 */
function searchProducts(keyword) {
  const query = `%${keyword}%`;
  return db.prepare(`
    SELECT * FROM products 
    WHERE name LIKE ? 
       OR description LIKE ? 
       OR category LIKE ? 
       OR sku LIKE ?
       OR product_knowledge LIKE ?
    ORDER BY name ASC
  `).all(query, query, query, query, query);
}

/**
 * Menambahkan produk baru.
 * @param {object} product 
 * @param {string} [product.sku]
 * @param {string} product.name 
 * @param {string} [product.category]
 * @param {string} [product.description] 
 * @param {string} [product.product_knowledge]
 * @param {number} [product.price] 
 * @param {number} [product.stock] 
 * @param {string} [product.image_path] 
 * @returns {number} ID produk yang baru dibuat
 */
function createProduct({ sku = null, name, category = 'Umum', description = '', product_knowledge = '', price = 0, stock = 0, image_path = null }) {
  const stmt = db.prepare(`
    INSERT INTO products (sku, name, category, description, product_knowledge, price, stock, image_path, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(
    sku ? sku.trim() : null,
    name.trim(),
    category ? category.trim() : 'Umum',
    description ? description.trim() : '',
    product_knowledge ? product_knowledge.trim() : '',
    Number(price) || 0,
    Number(stock) || 0,
    image_path
  );
  return result.lastInsertRowid;
}

/**
 * Memperbarui data produk secara penuh.
 * @param {number} id 
 * @param {object} updates 
 * @returns {boolean}
 */
function updateProduct(id, { sku, name, category, description, product_knowledge, price, stock, image_path }) {
  const stmt = db.prepare(`
    UPDATE products
    SET sku = ?, name = ?, category = ?, description = ?, product_knowledge = ?, price = ?, stock = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(
    sku ? sku.trim() : null,
    name.trim(),
    category ? category.trim() : 'Umum',
    description ? description.trim() : '',
    product_knowledge ? product_knowledge.trim() : '',
    Number(price) || 0,
    Number(stock) || 0,
    image_path,
    id
  );
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
 * Menyimpan / memperbarui produk dari hasil sinkronisasi spreadsheet (Upsert by SKU atau Nama).
 * @param {object} product
 * @returns {{action: 'added'|'updated', id: number}}
 */
function upsertProductFromSheet({ sku, name, category, description, product_knowledge, price, stock, image_path }) {
  let existing = null;
  if (sku && sku.trim()) {
    existing = getProductBySku(sku.trim());
  }
  if (!existing && name && name.trim()) {
    existing = db.prepare('SELECT * FROM products WHERE LOWER(name) = LOWER(?)').get(name.trim());
  }

  if (existing) {
    updateProduct(existing.id, {
      sku: sku || existing.sku,
      name: name || existing.name,
      category: category || existing.category,
      description: description || existing.description,
      product_knowledge: product_knowledge || existing.product_knowledge,
      price: typeof price !== 'undefined' ? Number(price) : existing.price,
      stock: typeof stock !== 'undefined' ? Number(stock) : existing.stock,
      image_path: image_path || existing.image_path
    });
    return { action: 'updated', id: existing.id };
  } else {
    const newId = createProduct({
      sku,
      name,
      category,
      description,
      product_knowledge,
      price,
      stock,
      image_path
    });
    return { action: 'added', id: newId };
  }
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
  getProductBySku,
  getAllProducts,
  searchProducts,
  createProduct,
  updateProduct,
  updateProductStock,
  upsertProductFromSheet,
  deleteProduct
};
