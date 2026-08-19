process.env.NODE_ENV = 'test';
const assert = require('assert');
const http = require('http');

process.env.NO_AUTO_OPEN = 'true';
process.env.PORT = '3002';

const app = require('../src/server');
const db = require('../src/db');
const { getConfig, saveConfig } = require('../src/config');

console.log('=== MEMULAI PENGUJIAN TDD: DASHBOARD MANAGEMENT (FASE 7) ===\n');

function makeRequest(path, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      hostname: '127.0.0.1',
      port: 3002,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (postData) {
      if (typeof postData === 'object' && !defaultOptions.headers['Content-Type']) {
        postData = new URLSearchParams(postData).toString();
        defaultOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      defaultOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(defaultOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runDashboardTddTests() {
  let failed = false;

  // Set initial completed setup for testing dashboard
  saveConfig({
    mode: 'bisnis',
    business_name: 'Toko Dashboard Test',
    gemini_api_key: 'AIzaSyD_TEST_KEY_FOR_DASHBOARD',
    is_setup_completed: true
  });
  db.setSetting('is_setup_completed', 'true');
  db.setSetting('mode', 'bisnis');

  // Test 1: Main Dashboard Page with Sidebar
  console.log('[Test 1/5] Memeriksa Halaman Utama Dashboard (GET /dashboard)...');
  try {
    const res = await makeRequest('/dashboard');
    assert.strictEqual(res.statusCode, 200, 'GET /dashboard harus return 200');
    assert.ok(res.body.includes('Panel Kontrol') || res.body.includes('Dashboard'), 'Dashboard harus memuat judul');
    assert.ok(res.body.includes('Produk') || res.body.includes('Chat Log'), 'Sidebar navigasi harus ada');
    console.log('  -> OK: Halaman Dashboard & Sidebar navigasi dimuat dengan sukses.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 1:', err.message);
    failed = true;
  }

  // Test 2: Products CRUD (Mode Bisnis)
  console.log('\n[Test 2/5] Memeriksa Produk CRUD (GET, POST Create, POST Edit, POST Delete)...');
  try {
    // 2a. GET /dashboard/products
    const resList = await makeRequest('/dashboard/products');
    assert.strictEqual(resList.statusCode, 200, 'GET /dashboard/products harus return 200');

    // 2b. POST Create
    const resCreate = await makeRequest('/dashboard/products', { method: 'POST' }, {
      name: 'Kopi Arabika Toraja TDD',
      price: '30000',
      stock: '50',
      description: 'Arabika single origin Toraja'
    });
    assert.strictEqual(resCreate.statusCode, 302, 'Create product harus redirect');

    const createdProd = db.searchProducts('Toraja TDD')[0];
    assert.ok(createdProd, 'Produk harus tersimpan di SQLite');
    assert.strictEqual(createdProd.price, 30000);

    // 2c. POST Edit
    const resEdit = await makeRequest(`/dashboard/products/${createdProd.id}/edit`, { method: 'POST' }, {
      name: 'Kopi Arabika Toraja TDD Updated',
      price: '32000',
      stock: '45',
      description: 'Updated description'
    });
    assert.strictEqual(resEdit.statusCode, 302, 'Edit product harus redirect');
    const updatedProd = db.getProductById(createdProd.id);
    assert.strictEqual(updatedProd.name, 'Kopi Arabika Toraja TDD Updated');
    assert.strictEqual(updatedProd.price, 32000);

    // 2d. POST Delete
    const resDelete = await makeRequest(`/dashboard/products/${createdProd.id}/delete`, { method: 'POST' });
    assert.strictEqual(resDelete.statusCode, 302, 'Delete product harus redirect');
    const deletedProd = db.getProductById(createdProd.id);
    assert.strictEqual(deletedProd, null, 'Produk harus terhapus dari database');

    console.log('  -> OK: Siklus Produk CRUD (Create, Read, Update, Delete) berhasil 100%.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 2:', err.message);
    failed = true;
  }

  // Test 3: Expenses CRUD (Mode Personal)
  console.log('\n[Test 3/5] Memeriksa Pengeluaran CRUD (GET, POST Create, POST Edit, POST Delete)...');
  try {
    // Ubah mode ke personal agar halaman expenses tidak di-redirect ke /dashboard
    saveConfig({ mode: 'personal' });
    db.setSetting('mode', 'personal');

    // 3a. GET /dashboard/expenses
    const resExpList = await makeRequest('/dashboard/expenses');
    assert.strictEqual(resExpList.statusCode, 200, 'GET /dashboard/expenses harus return 200');

    // 3b. POST Create Expense
    const resExpCreate = await makeRequest('/dashboard/expenses', { method: 'POST' }, {
      category: 'Makan & Minum',
      amount: '40000',
      note: 'Makan malam sate ayam'
    });
    assert.strictEqual(resExpCreate.statusCode, 302);

    const allExpenses = db.getAllExpenses();
    const createdExp = allExpenses.find(e => e.note === 'Makan malam sate ayam');
    assert.ok(createdExp, 'Expense harus tersimpan di SQLite');
    assert.strictEqual(createdExp.amount, 40000);

    // 3c. POST Edit Expense
    const resExpEdit = await makeRequest(`/dashboard/expenses/${createdExp.id}/edit`, { method: 'POST' }, {
      category: 'Makan & Minum',
      amount: '45000',
      note: 'Makan malam sate ayam + es jeruk'
    });
    assert.strictEqual(resExpEdit.statusCode, 302);
    const updatedExp = db.getExpenseById(createdExp.id);
    assert.strictEqual(updatedExp.amount, 45000);

    // 3d. POST Delete Expense
    const resExpDelete = await makeRequest(`/dashboard/expenses/${createdExp.id}/delete`, { method: 'POST' });
    assert.strictEqual(resExpDelete.statusCode, 302);
    assert.strictEqual(db.getExpenseById(createdExp.id), null);

    console.log('  -> OK: Siklus Pengeluaran CRUD (Create, Read, Update, Delete) berhasil 100%.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 3:', err.message);
    failed = true;
  }

  // Test 4: Chat Logs Management (GET /dashboard/chat-logs)
  console.log('\n[Test 4/5] Memeriksa Halaman Chat Log & Filter Kontak...');
  try {
    // Create sample log
    db.createChatLog({
      contact: '628999111222',
      message_in: 'Halo apakah ada promo?',
      message_out: 'Halo kak, sedang ada promo diskon!',
      handled_by: 'ai'
    });

    const resLogs = await makeRequest('/dashboard/chat-logs?contact=628999111222');
    assert.strictEqual(resLogs.statusCode, 200, 'GET /dashboard/chat-logs harus return 200');
    assert.ok(resLogs.body.includes('Riwayat Percakapan') || resLogs.body.includes('Chat Log'));
    assert.ok(resLogs.body.includes('628999111222'));
    console.log('  -> OK: Halaman Chat Logs & Filter kontak berfungsi dengan baik.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 4:', err.message);
    failed = true;
  }

  // Test 5: Settings Page & Live "Test Koneksi" API Key
  console.log('\n[Test 5/5] Memeriksa Halaman Pengaturan & Endpoint Test API Key...');
  try {
    // 5a. GET /dashboard/settings
    const resSettings = await makeRequest('/dashboard/settings');
    assert.strictEqual(resSettings.statusCode, 200, 'GET /dashboard/settings harus return 200');
    assert.ok(resSettings.body.includes('Pengaturan'));

    // 5b. POST /dashboard/settings/test-key
    const resTestKey = await makeRequest('/dashboard/settings/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      provider: 'gemini',
      apiKey: 'INVALID_TEST_KEY'
    }));
    assert.strictEqual(resTestKey.statusCode, 200);
    const jsonTestKey = JSON.parse(resTestKey.body);
    assert.strictEqual(jsonTestKey.success, true);
    assert.strictEqual(jsonTestKey.valid, false, 'Key palsu harus menghasilkan valid: false');

    // 5c. POST /dashboard/settings (Save new settings)
    const resSave = await makeRequest('/dashboard/settings', { method: 'POST' }, {
      business_name: 'Toko Baru Terupdate',
      owner_phone: '6281122334455',
      working_hours: '08:00 - 21:00'
    });
    assert.strictEqual(resSave.statusCode, 302);
    const savedConfig = getConfig();
    assert.strictEqual(savedConfig.business_name, 'Toko Baru Terupdate');
    assert.strictEqual(savedConfig.owner_phone, '6281122334455');

    console.log('  -> OK: Pengaturan tersimpan dan validasi Test API Key bekerja secara live.');
  } catch (err) {
    console.error('  ❌ Gagal pada Test 5:', err.message);
    failed = true;
  }

  if (failed) {
    console.log('\n❌ STATUS TDD: RED (Implementasi Dashboard Management belum lengkap)');
    process.exit(1);
  } else {
    console.log('\n✅ STATUS TDD: GREEN (Semua Fitur Dashboard Management Lulus Pengujian 100%)');
    process.exit(0);
  }
}

runDashboardTddTests();
