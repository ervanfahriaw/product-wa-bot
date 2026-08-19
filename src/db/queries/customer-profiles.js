/**
 * Query module: customer_profiles (CRM Pelanggan Mode Bisnis)
 * 
 * Fungsi CRUD untuk tabel customer_profiles — menyimpan dan mengambil
 * data profil pelanggan agar bot bisa "mengingat" lintas sesi.
 */

const db = require('../connection');

// Pastikan tabel ada dan kolom customer_status tersedia
require('../migrations/006-customer-profiles');
try {
  const tableInfo = db.prepare("PRAGMA table_info(customer_profiles)").all();
  const existingCols = new Set(tableInfo.map(c => c.name));
  if (!existingCols.has('customer_status')) {
    db.exec("ALTER TABLE customer_profiles ADD COLUMN customer_status TEXT DEFAULT 'new'");
  }
} catch (_) {}

/**
 * Mengambil profil pelanggan berdasarkan nomor kontak.
 * @param {string} contact 
 * @returns {object|undefined}
 */
function getCustomerProfile(contact) {
  if (!contact) return undefined;
  return db.prepare('SELECT * FROM customer_profiles WHERE contact = ?').get(contact);
}

/**
 * Membuat atau memperbarui profil pelanggan (UPSERT).
 * Hanya field yang disediakan yang akan diupdate — field yang tidak disediakan tetap.
 * @param {string} contact 
 * @param {object} data 
 */
function upsertCustomerProfile(contact, data = {}) {
  if (!contact) return;

  const existing = getCustomerProfile(contact);

  if (!existing) {
    // INSERT baru
    const stmt = db.prepare(`
      INSERT INTO customer_profiles (contact, customer_name, tags, favorite_products, notes, total_orders, total_spent, first_contact_at, last_contact_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(
      contact,
      data.customer_name || null,
      data.tags || null,
      data.favorite_products || null,
      data.notes || null,
      data.total_orders || 0,
      data.total_spent || 0
    );
  } else {
    // UPDATE hanya field yang disediakan
    const updates = [];
    const values = [];

    if (typeof data.customer_name !== 'undefined') { updates.push('customer_name = ?'); values.push(data.customer_name); }
    if (typeof data.tags !== 'undefined') { updates.push('tags = ?'); values.push(data.tags); }
    if (typeof data.favorite_products !== 'undefined') { updates.push('favorite_products = ?'); values.push(data.favorite_products); }
    if (typeof data.notes !== 'undefined') { updates.push('notes = ?'); values.push(data.notes); }
    if (typeof data.total_orders !== 'undefined') { updates.push('total_orders = ?'); values.push(data.total_orders); }
    if (typeof data.total_spent !== 'undefined') { updates.push('total_spent = ?'); values.push(data.total_spent); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(contact);
      db.prepare(`UPDATE customer_profiles SET ${updates.join(', ')} WHERE contact = ?`).run(...values);
    }
  }
}

/**
 * Update timestamp terakhir chat untuk pelanggan.
 * @param {string} contact 
 */
function updateLastContact(contact) {
  if (!contact) return;

  const existing = getCustomerProfile(contact);
  if (existing) {
    db.prepare('UPDATE customer_profiles SET last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE contact = ?').run(contact);
  } else {
    // Auto-create minimal profile jika belum ada
    db.prepare(`
      INSERT INTO customer_profiles (contact, first_contact_at, last_contact_at)
      VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(contact);
  }
}

/**
 * Mengambil semua profil pelanggan, diurutkan berdasarkan last_contact_at desc.
 * @param {number} [limit=50]
 * @returns {Array<object>}
 */
function getAllCustomerProfiles(limit = 50) {
  return db.prepare('SELECT * FROM customer_profiles ORDER BY last_contact_at DESC LIMIT ?').all(limit);
}

/**
 * Mencari profil pelanggan berdasarkan nama atau tag.
 * @param {string} query 
 * @param {number} [limit=20]
 * @returns {Array<object>}
 */
function searchCustomerProfiles(query, limit = 20) {
  if (!query) return [];
  const pattern = `%${query}%`;
  return db.prepare(`
    SELECT * FROM customer_profiles 
    WHERE customer_name LIKE ? OR tags LIKE ? OR contact LIKE ?
    ORDER BY last_contact_at DESC
    LIMIT ?
  `).all(pattern, pattern, pattern, limit);
}

/**
 * Update status loyalitas pelanggan ('new' | 'loyal' | 'vip' | 'inactive').
 * @param {string} contact 
 * @param {string} status 
 */
function updateCustomerStatus(contact, status) {
  if (!contact) return;
  db.prepare('UPDATE customer_profiles SET customer_status = ?, updated_at = CURRENT_TIMESTAMP WHERE contact = ?').run(status, contact);
}

module.exports = {
  getCustomerProfile,
  upsertCustomerProfile,
  updateLastContact,
  getAllCustomerProfiles,
  searchCustomerProfiles,
  updateCustomerStatus
};
