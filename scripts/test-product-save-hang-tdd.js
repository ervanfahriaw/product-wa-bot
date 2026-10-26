/**
 * TDD Test Suite: Product Save Request & Multipart Parsing Reliability
 * 
 * Menguji:
 * 1. Warm-up Express route
 * 2. POST /dashboard/products dengan form multipart (Browser default submit tanpa file) -> Respon cepat, 302 redirect, data tersimpan
 * 3. POST /dashboard/products dengan file biner gambar -> Respon cepat, 302 redirect, gambar tersimpan di uploads/
 * 4. POST /dashboard/products/:id/edit -> Respon cepat, 302 redirect, data terupdate
 * 5. POST /dashboard/products dengan Accept: application/json (AJAX fetch) -> Respon JSON 200 { success: true }
 * 6. POST /dashboard/products tanpa nama produk -> Validasi error (400 JSON / redirect error)
 * 7. POST /dashboard/products/:id/delete -> Berhasil hapus
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.NO_DELAY = 'true';
process.env.NO_AUTO_OPEN = 'true';

const db = require('../src/db');
const { saveConfig } = require('../src/config');
const app = require('../src/server/index');

let server = null;
let serverPort = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

function sendMultipartPost(urlPath, fields, fileField = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const parts = [];

    // Fields
    for (const [key, val] of Object.entries(fields)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}`);
    }

    // File field jika ada
    if (fileField) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType || 'image/jpeg'}\r\n\r\n${fileField.data.toString('binary')}`);
    } else {
      // Browser selalu mengirimkan field file kosong jika tidak memilih file
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename=""\r\nContent-Type: application/octet-stream\r\n\r\n`);
    }

    const payload = Buffer.from(parts.join('\r\n') + `\r\n--${boundary}--\r\n`, 'binary');

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
      ...extraHeaders
    };

    const req = http.request({
      hostname: 'localhost',
      port: serverPort,
      path: urlPath,
      method: 'POST',
      headers,
      timeout: 3000 // Maksimal 3 detik sebelum dianggap timeout / HANG
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('REQUEST_TIMEOUT: Server hang dan tidak merespon dalam batas waktu.'));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function warmUpServer() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: serverPort,
      path: '/dashboard/products',
      method: 'GET'
    }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', resolve);
    req.end();
  });
}

async function main() {
  console.log('======================================================');
  console.log('   🧪 TDD: VERIFIKASI SIMPAN PRODUK & CEK SERVER HANG');
  console.log('======================================================\n');

  saveConfig({
    mode: 'bisnis',
    is_setup_completed: true
  });
  db.setSetting('mode', 'bisnis');
  db.setSetting('is_setup_completed', 'true');

  // Start Express server pada ephemeral port
  server = app.listen(0);
  serverPort = server.address().port;
  console.log(`Server test berjalan di http://localhost:${serverPort}`);

  // Warmup router dan inisialisasi awal
  await warmUpServer();

  // ------------------------------------------------------------------------
  // TEST 1: POST /dashboard/products tanpa upload file (Browser default submit)
  // ------------------------------------------------------------------------
  await runAsyncTest('TC-SAVE-01: POST /dashboard/products tanpa upload file harus merespon cepat (tidak hang)', async () => {
    const startTime = Date.now();
    const res = await sendMultipartPost('/dashboard/products', {
      sku: 'FG-TDD-01',
      name: 'Guppy Full Gold TDD Live',
      category: 'Ikan Guppy',
      price: '850000',
      stock: '15',
      media_url: 'https://drive.google.com/drive/folders/test123',
      description: 'Deskripsi uji coba',
      product_knowledge: 'Knowledge uji coba',
      related_products: ''
    });

    const elapsed = Date.now() - startTime;
    console.log(`     Waktu respon: ${elapsed}ms, Status: ${res.statusCode}`);
    assert.strictEqual(res.statusCode, 302, 'Harus redirect 302 setelah simpan');
    assert.ok(elapsed < 1000, `Respon harus cepat (< 1000ms), didapat ${elapsed}ms`);

    const created = db.searchProducts('Guppy Full Gold TDD Live')[0];
    assert.ok(created, 'Produk harus berhasil tersimpan di SQLite');
    assert.strictEqual(created.sku, 'FG-TDD-01');
    assert.strictEqual(created.price, 850000);
    assert.strictEqual(created.media_url, 'https://drive.google.com/drive/folders/test123');
  });

  // ------------------------------------------------------------------------
  // TEST 2: POST /dashboard/products dengan file biner gambar
  // ------------------------------------------------------------------------
  await runAsyncTest('TC-SAVE-02: POST /dashboard/products dengan file gambar harus merespon cepat & menyimpan gambar', async () => {
    const startTime = Date.now();
    const dummyImageBuffer = Buffer.from('FAKE_JPEG_IMAGE_BINARY_DATA');
    const res = await sendMultipartPost('/dashboard/products', {
      sku: 'AFR-TDD-02',
      name: 'Guppy AFR TDD Live File',
      category: 'Ikan Guppy',
      price: '250000',
      stock: '8',
      media_url: 'https://photos.app.goo.gl/testAFR',
      description: 'AFR kualitas jos',
      product_knowledge: 'Genetik stabil',
      related_products: ''
    }, {
      name: 'image',
      filename: 'afr_live.jpg',
      contentType: 'image/jpeg',
      data: dummyImageBuffer
    });

    const elapsed = Date.now() - startTime;
    console.log(`     Waktu respon: ${elapsed}ms, Status: ${res.statusCode}`);
    assert.strictEqual(res.statusCode, 302, 'Harus redirect 302');
    assert.ok(elapsed < 1000, `Respon harus cepat (< 1000ms), didapat ${elapsed}ms`);

    const created = db.searchProducts('Guppy AFR TDD Live File')[0];
    assert.ok(created, 'Produk dengan file harus tersimpan');
    assert.ok(created.image_path, 'image_path harus terisi');
    assert.ok(fs.existsSync(created.image_path), 'File gambar harus ada di disk uploads/');
  });

  // ------------------------------------------------------------------------
  // TEST 3: POST /dashboard/products/:id/edit
  // ------------------------------------------------------------------------
  await runAsyncTest('TC-SAVE-03: POST /dashboard/products/:id/edit harus mengupdate data tanpa hang', async () => {
    const created = db.searchProducts('Guppy Full Gold TDD Live')[0];
    assert.ok(created, 'Produk harus ada');

    const startTime = Date.now();
    const res = await sendMultipartPost(`/dashboard/products/${created.id}/edit`, {
      sku: 'FG-TDD-UPDATED',
      name: 'Guppy Full Gold TDD Live Updated',
      category: 'Ikan Guppy Kontes',
      price: '900000',
      stock: '20',
      media_url: 'https://drive.google.com/drive/folders/updatedLink',
      description: 'Deskripsi diperbarui',
      product_knowledge: 'Knowledge diperbarui',
      related_products: ''
    });

    const elapsed = Date.now() - startTime;
    console.log(`     Waktu respon: ${elapsed}ms, Status: ${res.statusCode}`);
    assert.strictEqual(res.statusCode, 302);
    assert.ok(elapsed < 1000, `Respon harus cepat (< 1000ms), didapat ${elapsed}ms`);

    const updated = db.getProductById(created.id);
    assert.strictEqual(updated.name, 'Guppy Full Gold TDD Live Updated');
    assert.strictEqual(updated.price, 900000);
    assert.strictEqual(updated.stock, 20);
    assert.strictEqual(updated.media_url, 'https://drive.google.com/drive/folders/updatedLink');
  });

  // ------------------------------------------------------------------------
  // TEST 4: POST /dashboard/products dengan Accept: application/json (AJAX fetch)
  // ------------------------------------------------------------------------
  await runAsyncTest('TC-SAVE-04: POST /dashboard/products dengan Accept: application/json harus merespon JSON 200', async () => {
    const startTime = Date.now();
    const res = await sendMultipartPost('/dashboard/products', {
      sku: 'AJAX-01',
      name: 'Guppy Dumbo Mosaic AJAX',
      category: 'Ikan Guppy',
      price: '350000',
      stock: '5',
      media_url: 'https://drive.google.com/testAjax',
      description: 'Deskripsi AJAX',
      product_knowledge: '',
      related_products: ''
    }, null, { 'Accept': 'application/json' });

    const elapsed = Date.now() - startTime;
    console.log(`     Waktu respon: ${elapsed}ms, Status: ${res.statusCode}`);
    assert.strictEqual(res.statusCode, 200, 'Harus status 200 OK untuk JSON request');
    assert.ok(elapsed < 1000, `Respon harus cepat (< 1000ms), didapat ${elapsed}ms`);

    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.ok(json.id, 'Harus mengembalikan id produk baru');

    const created = db.getProductById(json.id);
    assert.ok(created);
    assert.strictEqual(created.name, 'Guppy Dumbo Mosaic AJAX');
  });

  // ------------------------------------------------------------------------
  // TEST 5: POST /dashboard/products dengan nama kosong (Validasi Error)
  // ------------------------------------------------------------------------
  await runAsyncTest('TC-SAVE-05: POST /dashboard/products dengan nama kosong harus ditolak (400 Bad Request)', async () => {
    const res = await sendMultipartPost('/dashboard/products', {
      sku: '',
      name: '   ',
      category: 'Umum',
      price: '10000',
      stock: '1'
    }, null, { 'Accept': 'application/json' });

    assert.strictEqual(res.statusCode, 400);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.message, 'Nama produk wajib diisi');
  });

  // ------------------------------------------------------------------------
  // TEST 6: POST /dashboard/products/:id/delete
  // ------------------------------------------------------------------------
  await runAsyncTest('TC-SAVE-06: POST /dashboard/products/:id/delete harus menghapus produk', async () => {
    const target = db.searchProducts('Guppy Dumbo Mosaic AJAX')[0];
    assert.ok(target, 'Produk harus ada');

    const res = await sendMultipartPost(`/dashboard/products/${target.id}/delete`, {}, null, { 'Accept': 'application/json' });
    assert.strictEqual(res.statusCode, 200);

    const deleted = db.getProductById(target.id);
    assert.strictEqual(deleted, null, 'Produk harus sudah terhapus dari SQLite');
  });

  // Cleanup test products from DB
  try {
    const testItems = db.db.prepare("SELECT id FROM products WHERE sku LIKE '%TDD%' OR name LIKE '%TDD%'").all();
    for (const item of testItems) {
      db.deleteProduct(item.id);
    }
  } catch (_) {}

  // Cleanup
  if (server) {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN TDD:`);
  console.log(`     Total: ${passedTests + failedTests}`);
  console.log(`     ✅ Lulus: ${passedTests}`);
  console.log(`     ❌ Gagal: ${failedTests}`);
  console.log('======================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test:', err);
  if (server) server.close();
  process.exit(1);
});
