const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NO_AUTO_OPEN = 'true';
process.env.PORT = '3005';
process.env.TEST_MODE = 'false';

const app = require('../src/server');
const db = require('../src/db');
const { getConfig, saveConfig, isSetupComplete } = require('../src/config');
const { saveStoredLicense } = require('../src/utils/license-client');
const { getHwid } = require('../src/utils/hwid');

console.log('======================================================');
console.log('  🧪 TDD TEST: FULL WIZARD & DASHBOARD RESILIENCE     ');
console.log('======================================================\n');

function makeRequest(reqPath, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    let formattedData = null;
    const headers = options.headers || {};

    if (postData) {
      if (typeof postData === 'object' && !headers['Content-Type']) {
        formattedData = new URLSearchParams(postData).toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        formattedData = postData;
      }
      headers['Content-Length'] = Buffer.byteLength(formattedData);
    }

    const defaultOptions = {
      hostname: '127.0.0.1',
      port: 3005,
      path: reqPath,
      method: options.method || 'GET',
      headers
    };

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
    if (formattedData) req.write(formattedData);
    req.end();
  });
}

async function runWizardTests() {
  let passed = 0;
  let total = 0;

  // 1. Simpan lisensi valid agar tidak tertahan di activation screen
  const currentHwid = getHwid();
  const crypto = require('crypto');
  const CLIENT_SIGNING_SECRET = 'WABOT_COMMERCIAL_LICENSE_SECRET_KEY_v1_2026';
  const payload = {
    licenseKey: 'LYNK-TEST-WIZARD-2026',
    edition: 'bisnis',
    hwid: currentHwid,
    buyerEmail: 'tester@wabot.com',
    activatedAt: new Date().toISOString()
  };
  const dataString = `${payload.licenseKey}:${payload.edition}:${payload.hwid}:${payload.buyerEmail || ''}:${payload.activatedAt}`;
  payload.signature = crypto.createHmac('sha256', CLIENT_SIGNING_SECRET).update(dataString).digest('hex');
  saveStoredLicense(payload);

  // Reset config ke awal
  saveConfig({
    mode: 'bisnis',
    business_name: '',
    owner_phone: '',
    gemini_api_key: '',
    is_setup_completed: false
  });
  db.setSetting('is_setup_completed', 'false');

  // Tunggu sejenak agar server express ready
  await new Promise(r => setTimeout(r, 600));

  // TEST 1: GET / -> redirect to /setup/step-1
  total++;
  try {
    const res = await makeRequest('/');
    assert.strictEqual(res.statusCode, 302, 'Root request must redirect 302');
    assert.strictEqual(res.headers.location, '/setup/step-1', 'Must redirect to /setup/step-1');
    console.log('  ✅ [TEST 1] Root route redirect to /setup/step-1 saat setup belum selesai');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 1] Root redirect failed:', err.message);
  }

  // TEST 2: POST /setup/step-1 -> Profil Bisnis
  total++;
  try {
    const res = await makeRequest('/setup/step-1', { method: 'POST' }, {
      mode: 'bisnis',
      business_name: 'Toko Kopi Herbal Nusantara',
      owner_phone: '081234567890'
    });
    assert.strictEqual(res.statusCode, 302, 'POST step-1 must redirect');
    assert.strictEqual(res.headers.location, '/setup/step-2', 'Must redirect to /setup/step-2');
    console.log('  ✅ [TEST 2] Step 1 (Profil Bisnis) berhasil disimpan dan redirect ke Step 2');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 2] Step 1 POST failed:', err.message);
  }

  // TEST 3: GET /setup/step-2 -> QR Screen
  total++;
  try {
    const res = await makeRequest('/setup/step-2');
    assert.strictEqual(res.statusCode, 200, 'GET step-2 must return 200');
    assert.ok(res.body.includes('Sambungkan WhatsApp') || res.body.includes('Scan QR'), 'Must contain QR screen title');
    console.log('  ✅ [TEST 3] Step 2 (Scan QR) berhasil dimuat dengan benar');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 3] Step 2 GET failed:', err.message);
  }

  // TEST 4: POST /setup/step-3 -> Input API Key AI
  total++;
  try {
    const sampleApiKey = 'AIzaSyA_B123_SecureGeminiKeyExample4567890';
    const res = await makeRequest('/setup/step-3', { method: 'POST' }, {
      gemini_api_key: sampleApiKey
    });
    assert.strictEqual(res.statusCode, 302, 'POST step-3 must redirect 302');
    assert.strictEqual(res.headers.location, '/setup/step-4', 'Must redirect to /setup/step-4');

    const updatedConf = getConfig();
    assert.strictEqual(updatedConf.gemini_api_key, sampleApiKey, 'API Key must be properly saved');
    console.log('  ✅ [TEST 4] Step 3 (Input API Key) berhasil disimpan tanpa crash dan redirect ke Step 4');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 4] Step 3 POST failed:', err.message);
  }

  // TEST 5: GET /setup/step-4 -> Data Awal
  total++;
  try {
    const res = await makeRequest('/setup/step-4');
    assert.strictEqual(res.statusCode, 200, 'GET step-4 must return 200');
    assert.ok(res.body.includes('Contoh Produk') || res.body.includes('Katalog'), 'Must show initial data screen');
    console.log('  ✅ [TEST 5] Step 4 (Data Awal) berhasil di-render');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 5] Step 4 GET failed:', err.message);
  }

  // TEST 6: POST /setup/step-4 -> Submit Katalog & Complete Setup
  total++;
  try {
    const res = await makeRequest('/setup/step-4', { method: 'POST' }, {
      product_name: 'Kopi Robusta Asli',
      product_price: '25000',
      product_stock: '100',
      product_description: 'Kopi robusta kualitas terbaik'
    });
    assert.strictEqual(res.statusCode, 302, 'POST step-4 must redirect 302');
    assert.strictEqual(res.headers.location, '/dashboard', 'Must redirect to /dashboard');
    assert.strictEqual(isSetupComplete(), true, 'Setup must be marked complete');
    console.log('  ✅ [TEST 6] Step 4 selesai, setup selesai, dan redirect ke /dashboard');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 6] Step 4 POST failed:', err.message);
  }

  // TEST 7: GET /dashboard & GET /dashboard/settings -> Pastikan dashboard tetap online & responsif
  total++;
  try {
    const resDash = await makeRequest('/dashboard');
    assert.strictEqual(resDash.statusCode, 200, 'Dashboard overview must respond 200');

    const resSet = await makeRequest('/dashboard/settings');
    assert.strictEqual(resSet.statusCode, 200, 'Dashboard settings must respond 200');
    console.log('  ✅ [TEST 7] Dashboard Overview dan Settings dapat diakses dengan sukses (HTTP 200)');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 7] Dashboard GET failed:', err.message);
  }

  // TEST 8: POST /dashboard/settings -> Update API Key di dashboard
  total++;
  try {
    const newApiKey = 'AIzaSyUpdatedKeyFromDashboard_778899';
    const res = await makeRequest('/dashboard/settings', { method: 'POST' }, {
      gemini_api_key: newApiKey,
      business_name: 'Toko Kopi Herbal Nusantara',
      mode: 'bisnis'
    });
    assert.strictEqual(res.statusCode, 302, 'POST settings must redirect 302');
    
    const resAfter = await makeRequest('/dashboard/settings');
    assert.strictEqual(resAfter.statusCode, 200, 'Dashboard settings must still respond 200 after update');
    console.log('  ✅ [TEST 8] Update API Key dari menu Pengaturan berjalan mulus dan server tetap stabil');
    passed++;
  } catch (err) {
    console.error('  ❌ [TEST 8] Settings POST failed:', err.message);
  }

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN WIZARD & DASHBOARD: ${passed} / ${total} LULUS`);
  if (passed === total) {
    console.log('  🎉 SELURUH ALUR INPUT API KEY & DASHBOARD STABIL 100%!');
  } else {
    console.error('  ⚠️ ADA PENGUJIAN YANG GAGAL!');
  }
  console.log('======================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runWizardTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
