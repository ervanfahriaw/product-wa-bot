const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.NO_AUTO_OPEN = 'true';
process.env.PORT = '3001';

const { getConfig, saveConfig, CONFIG_PATH } = require('../src/config');

// Reset setup status for first-run testing
saveConfig({
  mode: null,
  business_name: '',
  owner_phone: '',
  gemini_api_key: '',
  grok_api_key: '',
  is_setup_completed: false
});

const app = require('../src/server');

console.log('=== MEMULAI PENGUJIAN WEB SERVER & SETUP WIZARD (FASE 3) ===\n');

function makeRequest(path, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      hostname: '127.0.0.1',
      port: 3001,
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

async function runTests() {
  try {
    // 1. Test first-run redirect to /setup/step-1
    console.log('[1/7] Testing first-run check redirect...');
    const resRoot = await makeRequest('/');
    assert.strictEqual(resRoot.statusCode, 302, 'Root seharusnya redirect (302) saat first-run');
    assert.strictEqual(resRoot.headers.location, '/setup/step-1', 'Redirect seharusnya ke /setup/step-1');
    console.log('  -> OK: Redirect ke /setup/step-1 berhasil');

    // 2. Test GET /setup/step-1
    console.log('[2/7] Testing GET /setup/step-1...');
    const resStep1 = await makeRequest('/setup/step-1');
    assert.strictEqual(resStep1.statusCode, 200);
    assert.ok(resStep1.body.includes('Pilih Mode Bot'), 'Halaman step-1 harus memuat judul');
    console.log('  -> OK: Halaman Step 1 EJS rendered dengan sukses');

    // 3. Test POST /setup/step-1 (Pilih Mode Bisnis)
    console.log('[3/7] Testing POST /setup/step-1 (Mode Bisnis)...');
    const resPostStep1 = await makeRequest('/setup/step-1', { method: 'POST' }, {
      mode: 'bisnis',
      business_name: 'Toko Kopi Uji Coba',
      owner_phone: '628999888777'
    });
    assert.strictEqual(resPostStep1.statusCode, 302);
    assert.strictEqual(resPostStep1.headers.location, '/setup/step-2');
    console.log('  -> OK: Step 1 disimpan, redirect ke /setup/step-2');

    // 4. Test GET /setup/step-2 (QR Page)
    console.log('[4/7] Testing GET /setup/step-2 (Scan QR Page)...');
    const resStep2 = await makeRequest('/setup/step-2');
    assert.strictEqual(resStep2.statusCode, 200);
    assert.ok(resStep2.body.includes('Tautkan Akun WhatsApp'), 'Halaman step-2 harus memuat judul scan QR');
    console.log('  -> OK: Halaman Step 2 EJS rendered dengan sukses');

    // 5. Test POST /setup/step-3 (API Key AI)
    console.log('[5/7] Testing POST /setup/step-3 (Gemini API Key)...');
    const dummyKey = 'AIzaSyD_TEST_KEY_FOR_WIZARD_VALIDATION_12345';
    const resPostStep3 = await makeRequest('/setup/step-3', { method: 'POST' }, {
      gemini_api_key: dummyKey,
      grok_api_key: ''
    });
    assert.strictEqual(resPostStep3.statusCode, 302);
    assert.strictEqual(resPostStep3.headers.location, '/setup/step-4');
    console.log('  -> OK: Step 3 API Key disimpan, redirect ke /setup/step-4');

    // 6. Test POST /setup/step-4 (Data Awal Produk)
    console.log('[6/7] Testing POST /setup/step-4 (Input Produk Awal)...');
    const resPostStep4 = await makeRequest('/setup/step-4', { method: 'POST' }, {
      product_name: 'Espresso Single Origin',
      product_price: '22000',
      product_stock: '40',
      product_description: 'Biji kopi pilihan Arabika Gayo'
    });
    assert.strictEqual(resPostStep4.statusCode, 302);
    assert.strictEqual(resPostStep4.headers.location, '/dashboard');
    console.log('  -> OK: Step 4 selesai, setup complete, redirect ke /dashboard');

    // 7. Test GET /dashboard & Verification of generated config
    console.log('[7/7] Testing GET /dashboard & config.json verification...');
    const resDashboard = await makeRequest('/dashboard');
    assert.strictEqual(resDashboard.statusCode, 200);
    assert.ok(resDashboard.body.includes('Panel Kontrol'), 'Dashboard harus memuat judul');
    assert.ok(resDashboard.body.includes('Mode Bisnis'), 'Dashboard harus memuat badge Mode Bisnis');

    const finalConfig = getConfig();
    assert.strictEqual(finalConfig.mode, 'bisnis');
    assert.strictEqual(finalConfig.business_name, 'Toko Kopi Uji Coba');
    assert.strictEqual(finalConfig.gemini_api_key, dummyKey);
    assert.strictEqual(finalConfig.is_setup_completed, true);
    assert.ok(fs.existsSync(CONFIG_PATH), 'File config/config.json harus ada!');

    console.log('  -> OK: config/config.json berhasil digenerate dan diverifikasi:');
    console.log('    ', JSON.stringify({
      mode: finalConfig.mode,
      business_name: finalConfig.business_name,
      gemini_api_key: 'AIzaSy***(masked)',
      is_setup_completed: finalConfig.is_setup_completed
    }, null, 2));

    console.log('\n=== SEMUA PENGUJIAN FASE 3 BERHASIL 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR DALAM TEST SERVER:', err);
    process.exit(1);
  }
}

runTests();
