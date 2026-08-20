process.env.TEST_MODE = 'true';
process.env.NO_AUTO_OPEN = 'true';

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const licenseServerApp = require('../license-server/server');
const licenseServerDb = require('../license-server/db');

const {
  deleteStoredLicense,
  saveStoredLicense,
  createSignature,
  getStoredLicense,
  checkLocalLicense
} = require('../src/utils/license-client');
const { getHwid } = require('../src/utils/hwid');

const botApp = require('../src/server/index');

const LICENSE_SERVER_PORT = 4088;
const BOT_SERVER_PORT = 3088;

let licServer;
let botServer;

function fetchUrl(port, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const isPost = options.method === 'POST';
    const postData = isPost ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body || {})) : '';

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
        ...(isPost ? {
          'Content-Type': options.contentType || 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    }, res => {
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

    req.on('error', reject);
    if (isPost && postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('======================================================');
  console.log('   TEST SUITE: FASE L3 — UI & MIDDLEWARE INTEGRATION  ');
  console.log('======================================================\n');

  // Start both test servers
  await new Promise(resolve => { licServer = licenseServerApp.listen(LICENSE_SERVER_PORT, resolve); });
  await new Promise(resolve => { botServer = botApp.listen(BOT_SERVER_PORT, resolve); });

  console.log(`[Setup] License Server aktif di port ${LICENSE_SERVER_PORT}`);
  console.log(`[Setup] Bot Web Controller aktif di port ${BOT_SERVER_PORT}`);

  try {
    const testKey = 'WABOT-BIZ-TEST-UI-9999';
    const serverUrl = `http://127.0.0.1:${LICENSE_SERVER_PORT}`;

    // Buat lisensi di license server
    licenseServerDb.createLicense({
      licenseKey: testKey,
      edition: 'bisnis',
      maxDevices: 1,
      buyerEmail: 'budi@lynk.id',
      buyerName: 'Budi Santoso'
    });

    // 1. Test Unlicensed Guard: Akses /dashboard harus diarahkan ke /setup/license
    console.log('\n[Test 1] Pengujian Guard Tanpa Lisensi (Akses /dashboard)...');
    deleteStoredLicense();
    const resUnlic = await fetchUrl(BOT_SERVER_PORT, '/dashboard');
    assert.strictEqual(resUnlic.statusCode, 302, 'Harus redirect 302');
    assert.strictEqual(resUnlic.headers.location, '/setup/license', 'Harus redirect ke /setup/license');
    console.log('  ✅ Guard Berhasil: /dashboard diarahkan ke /setup/license');

    // 2. Test Unlicensed Guard: Akses /setup/step-1 harus diarahkan ke /setup/license
    console.log('\n[Test 2] Pengujian Guard Tanpa Lisensi (Akses /setup/step-1)...');
    const resStep1Unlic = await fetchUrl(BOT_SERVER_PORT, '/setup/step-1');
    assert.strictEqual(resStep1Unlic.statusCode, 302);
    assert.strictEqual(resStep1Unlic.headers.location, '/setup/license');
    console.log('  ✅ Guard Berhasil: /setup/step-1 diarahkan ke /setup/license');

    // 3. Test Render Halaman Aktivasi /setup/license
    console.log('\n[Test 3] Memuat Halaman Aktivasi Lisensi (/setup/license)...');
    const resLicPage = await fetchUrl(BOT_SERVER_PORT, '/setup/license');
    assert.strictEqual(resLicPage.statusCode, 200);
    assert.ok(resLicPage.body.includes('Aktivasi Lisensi'), 'Harus memuat kata kunci Aktivasi Lisensi');
    assert.ok(resLicPage.body.includes('Hardware ID (HWID)'), 'Harus menampilkan HWID');
    console.log('  ✅ Halaman Aktivasi /setup/license berhasil di-render (HTTP 200)');

    // 4. Test Submit Aktivasi Lisensi via Form POST /setup/license
    console.log('\n[Test 4] Mengirim Form Aktivasi POST /setup/license...');
    const postBody = new URLSearchParams({
      license_key: testKey,
      server_url: serverUrl
    }).toString();

    const resActivate = await fetchUrl(BOT_SERVER_PORT, '/setup/license', {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      body: postBody
    });
    assert.strictEqual(resActivate.statusCode, 302, 'Harus redirect setelah aktivasi sukses');
    assert.strictEqual(resActivate.headers.location, '/setup/step-1', 'Harus redirect ke /setup/step-1');

    const localLic = checkLocalLicense();
    assert.strictEqual(localLic.isValid, true, 'Lisensi lokal harus valid setelah aktivasi');
    assert.strictEqual(localLic.data.licenseKey, testKey);
    console.log(`  ✅ Aktivasi Berhasil: Lisensi ${localLic.data.licenseKey} terdaftar sah untuk HWID perangkat ini`);

    // 5. Test Akses /setup/step-1 setelah Berlisensi Sah
    console.log('\n[Test 5] Mengakses /setup/step-1 setelah Berlisensi Sah...');
    const resStep1Lic = await fetchUrl(BOT_SERVER_PORT, '/setup/step-1');
    assert.strictEqual(resStep1Lic.statusCode, 200, 'Harus diizinkan masuk ke step-1 (HTTP 200)');
    console.log('  ✅ Akses Berhasil: User berlisensi dapat melanjutkan wizard');

    // 6. Test Deaktivasi / Lepas Lisensi
    console.log('\n[Test 6] Deaktivasi Lisensi via POST /setup/license/deactivate...');
    const deactBody = new URLSearchParams({
      server_url: serverUrl
    }).toString();

    const resDeact = await fetchUrl(BOT_SERVER_PORT, '/setup/license/deactivate', {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      body: deactBody
    });
    assert.strictEqual(resDeact.statusCode, 302);
    assert.strictEqual(resDeact.headers.location, '/setup/license');

    const checkAfterDeact = checkLocalLicense();
    assert.strictEqual(checkAfterDeact.isValid, false, 'Lisensi harus sudah tidak ada/tidak valid');
    console.log('  ✅ Deaktivasi Berhasil: Lisensi dilepas dan perangkat terkunci kembali');

    console.log('\n======================================================');
    console.log('  🎉 SEMUA 6 TEST FASE L3 BERHASIL (100% PASSED)!      ');
    console.log('======================================================\n');
  } finally {
    deleteStoredLicense();
    licServer.close();
    botServer.close();
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  if (licServer) licServer.close();
  if (botServer) botServer.close();
  deleteStoredLicense();
  process.exit(1);
});
