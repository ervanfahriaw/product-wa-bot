const assert = require('assert');
const http = require('http');
const app = require('../license-server/server');
const db = require('../license-server/db');

const TEST_PORT = 4055;
let server;

function requestApi(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (_) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('======================================================');
  console.log('   TEST SUITE: FASE L2 — LICENSE SERVER & ACTIVATION  ');
  console.log('======================================================\n');

  // Start Server
  await new Promise(resolve => {
    server = app.listen(TEST_PORT, resolve);
  });
  console.log(`[Setup] License Server berjalan di port uji ${TEST_PORT}.`);

  try {
    const testKey = 'WABOT-BIZ-TEST-FAS2-AAAA';
    const hwidA = 'HWID_LAPTOP_PEMBELI_A_11111111111111111111111111111111111111111111';
    const hwidB = 'HWID_LAPTOP_ORANG_LAIN_22222222222222222222222222222222222222222222';

    // 1. Buat Lisensi 1 Device
    console.log('\n[Test 1] Membuat lisensi uji (Maks 1 Perangkat)...');
    const lic = db.createLicense({
      licenseKey: testKey,
      edition: 'bisnis',
      maxDevices: 1,
      buyerEmail: 'pembeli1@lynk.id',
      buyerName: 'Pembeli Asli'
    });
    assert.strictEqual(lic.license_key, testKey);
    console.log(`  ✅ Lisensi dibuat: ${lic.license_key} (Max: ${lic.max_devices} PC)`);

    // 2. Aktivasi Perangkat A
    console.log('\n[Test 2] Aktivasi Perangkat A (Komputer Pertama Pembeli)...');
    const actRes1 = await requestApi('/api/activate', {
      licenseKey: testKey,
      hwid: hwidA,
      deviceName: 'Laptop-Budi',
      platform: 'win32',
      edition: 'bisnis'
    });
    assert.strictEqual(actRes1.status, 200);
    assert.strictEqual(actRes1.data.success, true);
    assert.strictEqual(actRes1.data.data.devicesUsed, 1);
    console.log(`  ✅ Aktivasi Berhasil: ${actRes1.data.message} (Device: ${actRes1.data.data.devicesUsed}/${actRes1.data.data.maxDevices})`);

    // 3. Aktivasi Ulang Perangkat A (Idempotent)
    console.log('\n[Test 3] Aktivasi Ulang Perangkat A (Sama HWID)...');
    const actResSame = await requestApi('/api/activate', {
      licenseKey: testKey,
      hwid: hwidA,
      deviceName: 'Laptop-Budi',
      platform: 'win32',
      edition: 'bisnis'
    });
    assert.strictEqual(actResSame.status, 200);
    assert.strictEqual(actResSame.data.data.devicesUsed, 1, 'Tidak boleh menambah kuota device');
    console.log('  ✅ Idempotency Terjaga: Kuota tetap 1/1');

    // 4. Simulasi Pembajakan: Perangkat B Mencoba Memakai Lisensi yang Sama
    console.log('\n[Test 4] Simulasi Pembajakan: Perangkat B (Komputer Lain) Mencoba Memakai Lisensi...');
    const actResPirate = await requestApi('/api/activate', {
      licenseKey: testKey,
      hwid: hwidB,
      deviceName: 'Komputer-Pembajak',
      platform: 'win32',
      edition: 'bisnis'
    });
    assert.strictEqual(actResPirate.status, 403, 'Harus ditolak dengan HTTP 403 Forbidden');
    assert.strictEqual(actResPirate.data.success, false);
    console.log(`  ✅ Proteksi Server Berhasil Menolak: "${actResPirate.data.message}"`);

    // 5. Verifikasi Status Lisensi
    console.log('\n[Test 5] Pengujian Endpoint /api/verify...');
    const verResA = await requestApi('/api/verify', { licenseKey: testKey, hwid: hwidA });
    assert.strictEqual(verResA.status, 200);
    assert.strictEqual(verResA.data.success, true);

    const verResB = await requestApi('/api/verify', { licenseKey: testKey, hwid: hwidB });
    assert.strictEqual(verResB.status, 403);
    console.log('  ✅ Verifikasi Berhasil: Perangkat A Sah, Perangkat B Ditolak');

    // 6. Deaktivasi Perangkat A (Pindah Perangkat)
    console.log('\n[Test 6] Deaktivasi Perangkat A (Pindah Laptop)...');
    const deactRes = await requestApi('/api/deactivate', { licenseKey: testKey, hwid: hwidA });
    assert.strictEqual(deactRes.status, 200);
    assert.strictEqual(deactRes.data.success, true);
    console.log(`  ✅ Deaktivasi Berhasil: ${deactRes.data.message}`);

    // 7. Aktivasi Perangkat B setelah Kuota Bebas
    console.log('\n[Test 7] Aktivasi Perangkat B setelah Kuota Bebas...');
    const actRes2 = await requestApi('/api/activate', {
      licenseKey: testKey,
      hwid: hwidB,
      deviceName: 'Laptop-Baru-Budi',
      platform: 'win32',
      edition: 'bisnis'
    });
    assert.strictEqual(actRes2.status, 200);
    assert.strictEqual(actRes2.data.success, true);
    assert.strictEqual(actRes2.data.data.devicesUsed, 1);
    console.log('  ✅ Pindah Perangkat Sukses: Perangkat B kini terdaftar resmi (1/1)');

    // 8. Webhook Lynk.id Order Test
    console.log('\n[Test 8] Pengujian Webhook Pembelian Otomatis Lynk.id...');
    const webhookRes = await requestApi('/api/webhook/lynkid', {
      customer_email: 'buyer.lynk@gmail.com',
      customer_name: 'Sarah Wijaya',
      product_name: 'WA Bot Bisnis AI Full Source'
    });
    assert.strictEqual(webhookRes.status, 200);
    assert.strictEqual(webhookRes.data.success, true);
    assert.ok(webhookRes.data.data.license_key.startsWith('WABOT-BIZ-'));
    console.log(`  ✅ Webhook Berhasil Menerbitkan Key Baru: ${webhookRes.data.data.license_key}`);

    console.log('\n======================================================');
    console.log('  🎉 SEMUA 8 TEST FASE L2 BERHASIL (100% PASSED)!      ');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
