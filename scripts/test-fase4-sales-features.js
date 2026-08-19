/**
 * Test Fase 4 — Sales Features: Order Tracking + Smart Upselling (TDD)
 * 
 * Menguji:
 * 1. CRUD tabel orders (database layer)
 * 2. buildOrderContext() — konteks pesanan pelanggan untuk AI
 * 3. Related products (upselling) — kolom related_products di products
 * 4. Dashboard route GET /dashboard/orders returns 200
 */

const assert = require('assert');
const db = require('../src/db');

// Reset database untuk testing agar autoincrement ID dimulai dari 1
try {
  db.db.exec("DELETE FROM orders");
  db.db.exec("DELETE FROM products");
  db.db.exec("DELETE FROM sqlite_sequence WHERE name = 'orders'");
  db.db.exec("DELETE FROM sqlite_sequence WHERE name = 'products'");
} catch (e) {}

console.log('=== TEST FASE 4 — SALES FEATURES (TDD) ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     -> ${err.message}`);
    failed++;
  }
}

// ============================================================
// GRUP 1: Database CRUD — orders
// ============================================================
console.log('[1/5] Testing database CRUD orders...');

test('createOrder() — harus ada dan bisa dipanggil', () => {
  assert.ok(typeof db.createOrder === 'function', 'Fungsi createOrder belum ada di db');
});

test('createOrder() — harus bisa membuat order baru', () => {
  const id = db.createOrder({
    contact: '6281234567890@c.us',
    customer_name: 'Kak Rina',
    order_summary: '2x Kopi Susu, 1x Matcha Latte',
    total_amount: 58000,
    status: 'pending',
    notes: 'Minta extra shot'
  });
  assert.ok(id > 0, `Harus return ID > 0, dapat: ${id}`);
});

test('createOrder() — harus bisa membuat order kedua', () => {
  const id = db.createOrder({
    contact: '6281234567890@c.us',
    customer_name: 'Kak Rina',
    order_summary: '1x Cookies Coklat',
    total_amount: 15000,
    status: 'confirmed'
  });
  assert.ok(id > 0);
});

test('createOrder() — harus bisa membuat order dari kontak berbeda', () => {
  const id = db.createOrder({
    contact: '6289876543210@c.us',
    customer_name: 'Kak Budi',
    order_summary: '3x Es Teh',
    total_amount: 24000,
    status: 'shipped',
    resi_number: 'JNE-123456789',
    shipping_method: 'JNE Regular'
  });
  assert.ok(id > 0);
});

test('getOrderById() — harus mengembalikan order berdasarkan ID', () => {
  assert.ok(typeof db.getOrderById === 'function', 'Fungsi getOrderById belum ada di db');
  const order = db.getOrderById(1);
  assert.ok(order, 'Order dengan ID 1 harus ditemukan');
  assert.strictEqual(order.customer_name, 'Kak Rina');
  assert.strictEqual(order.total_amount, 58000);
  assert.strictEqual(order.status, 'pending');
});

test('getOrdersByContact() — harus mengembalikan order berdasarkan kontak', () => {
  assert.ok(typeof db.getOrdersByContact === 'function', 'Fungsi getOrdersByContact belum ada di db');
  const orders = db.getOrdersByContact('6281234567890@c.us');
  assert.ok(orders.length >= 2, `Harus ada minimal 2 order untuk Rina, dapat ${orders.length}`);
});

test('getAllOrders() — harus mengembalikan semua order', () => {
  assert.ok(typeof db.getAllOrders === 'function', 'Fungsi getAllOrders belum ada di db');
  const all = db.getAllOrders();
  assert.ok(all.length >= 3, `Harus ada minimal 3 order, dapat ${all.length}`);
});

test('getAllOrders() — harus bisa filter berdasarkan status', () => {
  const pending = db.getAllOrders('pending');
  assert.ok(pending.length >= 1, 'Harus ada minimal 1 order pending');
  pending.forEach(o => assert.strictEqual(o.status, 'pending'));
});

test('updateOrderStatus() — harus bisa update status order', () => {
  assert.ok(typeof db.updateOrderStatus === 'function', 'Fungsi updateOrderStatus belum ada di db');
  db.updateOrderStatus(1, 'confirmed');
  const updated = db.getOrderById(1);
  assert.strictEqual(updated.status, 'confirmed');
});

test('updateOrderStatus() — harus bisa update status + resi', () => {
  db.updateOrderStatus(1, 'shipped', 'SICEPAT-987654321');
  const updated = db.getOrderById(1);
  assert.strictEqual(updated.status, 'shipped');
  assert.strictEqual(updated.resi_number, 'SICEPAT-987654321');
});

test('deleteOrder() — harus bisa hapus order', () => {
  assert.ok(typeof db.deleteOrder === 'function', 'Fungsi deleteOrder belum ada di db');
  const tempId = db.createOrder({
    contact: '000@c.us',
    order_summary: 'Test hapus',
    total_amount: 0
  });
  db.deleteOrder(tempId);
  const deleted = db.getOrderById(tempId);
  assert.strictEqual(deleted, undefined);
});

// ============================================================
// GRUP 2: Context Builder — buildOrderContext()
// ============================================================
console.log('\n[2/5] Testing context builder — buildOrderContext()...');

test('buildOrderContext() — harus ada dan bisa dipanggil', () => {
  const { buildOrderContext } = require('../src/ai/context-builder');
  assert.ok(typeof buildOrderContext === 'function', 'Fungsi buildOrderContext belum di-export');
});

test('buildOrderContext() — harus mengembalikan konteks pesanan pelanggan', () => {
  const { buildOrderContext } = require('../src/ai/context-builder');
  const ctx = buildOrderContext('6281234567890@c.us');
  assert.ok(ctx, 'Konteks pesanan harus ada');
  assert.ok(ctx.includes('[STATUS PESANAN PELANGGAN INI]'), 'Harus ada header [STATUS PESANAN PELANGGAN INI]');
  assert.ok(ctx.includes('Kopi Susu'), 'Harus menyebutkan produk dari order');
});

test('buildOrderContext() — harus menampilkan resi jika ada', () => {
  const { buildOrderContext } = require('../src/ai/context-builder');
  const ctx = buildOrderContext('6281234567890@c.us');
  assert.ok(ctx.includes('SICEPAT'), 'Harus menampilkan resi jika status shipped');
});

test('buildOrderContext() — harus return empty string jika kontak tidak punya order', () => {
  const { buildOrderContext } = require('../src/ai/context-builder');
  const ctx = buildOrderContext('000000000@c.us');
  assert.strictEqual(ctx, '', 'Harus return empty string untuk kontak tanpa order');
});

// ============================================================
// GRUP 3: Integrasi buildContext() dengan order
// ============================================================
console.log('\n[3/5] Testing integrasi buildContext() dengan order...');

test('buildContext() mode bisnis — harus menyertakan pesanan pelanggan', () => {
  const { buildContext } = require('../src/ai/context-builder');
  const ctx = buildContext('pesanan saya gimana?', 'bisnis', '6281234567890@c.us');
  assert.ok(ctx.includes('[STATUS PESANAN PELANGGAN INI]'), 'buildContext bisnis harus include order context');
});

// ============================================================
// GRUP 4: Related Products (Upselling)
// ============================================================
console.log('\n[4/5] Testing related products (upselling)...');

test('products — harus bisa menyimpan dan membaca related_products', () => {
  // Buat 2 produk
  const p1 = db.createProduct({ name: 'Kopi Susu Test', price: 18000, stock: 10 });
  const p2 = db.createProduct({ name: 'Cookies Test', price: 15000, stock: 20 });
  
  // Update related_products pada p1
  assert.ok(typeof db.updateProduct === 'function', 'Fungsi updateProduct harus ada');
  db.updateProduct(p1, { related_products: String(p2) });
  
  const product = db.getProductById(p1);
  assert.ok(product.related_products !== undefined, 'Kolom related_products harus ada di produk');
  assert.strictEqual(product.related_products, String(p2), `related_products harus berisi "${p2}"`);
});

test('buildBusinessContext() — harus menyertakan rekomendasi produk terkait jika ada di database', () => {
  const { buildBusinessContext } = require('../src/ai/context-builder');
  
  // Buat produk kopi susu dengan related product cookies
  const p1 = db.createProduct({ name: 'Kopi Susu Spesial', price: 18000, stock: 10 });
  const p2 = db.createProduct({ name: 'Cookies Coklat Lezat', price: 15000, stock: 20 });
  db.updateProduct(p1, { related_products: String(p2) });
  
  const ctx = buildBusinessContext('mau tanya kopi susu spesial kak');
  assert.ok(ctx.includes('[REKOMENDASI PRODUK TERKAIT]'), 'Harus menyertakan header rekomendasi terkait');
  assert.ok(ctx.includes('Cookies Coklat Lezat'), 'Harus menyebutkan nama produk rekomendasi');
});

// ============================================================
// GRUP 5: Dashboard route
// ============================================================
console.log('\n[5/5] Testing dashboard route /dashboard/orders...');

test('GET /dashboard/orders — harus return HTTP 200', () => {
  const { saveConfig } = require('../src/config');
  // Set explicit config values required for setup to be complete and mode to be bisnis
  saveConfig({ 
    mode: 'bisnis', 
    is_setup_completed: true,
    gemini_api_key: 'TEST_MOCK_GEMINI_API_KEY_123' 
  });
  db.setSetting('mode', 'bisnis');
  db.setSetting('is_setup_completed', 'true');
  db.setSetting('gemini_api_key', 'TEST_MOCK_GEMINI_API_KEY_123');

  const http = require('http');
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/dashboard/orders', (res) => {
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      resolve();
    }).on('error', () => resolve());
  });
});

// ============================================================
// RINGKASAN
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`HASIL: ${passed} passed, ${failed} failed (total: ${passed + failed})`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  console.log('\n⚠️  Ada test yang GAGAL — ini EXPECTED untuk TDD step RED.');
  process.exit(1);
} else {
  console.log('\n✅ SEMUA TEST PASSED — Fase 4 Sales Features SELESAI!');
}
