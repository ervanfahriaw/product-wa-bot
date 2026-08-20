/**
 * Integration & Route QC Suite (TDD)
 * Menguji seluruh endpoint HTTP web controller (Wizard, Guard, Dashboard Bisnis, Dashboard Personal, API)
 */
const assert = require('assert');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.NO_AUTO_OPEN = 'true';
process.env.PORT = '3005';

const app = require('../src/server/index');
const db = require('../src/db');
const { saveConfig } = require('../src/config');
const { saveStoredLicense, createSignature, getHwid } = require('../src/utils/license-client');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    });
}

function makeGet(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

async function startRouteSuite() {
  console.log('\n======================================================');
  console.log('       🌐 MEMULAI ROUTE & ENDPOINT QC SUITE          ');
  console.log('======================================================\n');

  // 1. Simpan lisensi aktif
  const mockHwid = getHwid();
  const mockLicense = {
    licenseKey: 'WABOT-TEST-ROUTE-1234',
    edition: 'all',
    buyerEmail: 'qc@tester.com',
    buyerName: 'QC Tester',
    hwid: mockHwid,
    activatedAt: new Date().toISOString()
  };
  mockLicense.signature = createSignature(mockLicense);
  saveStoredLicense(mockLicense);

  console.log('📌 [Grup 1] Setup Wizard Routes & Security Guard');
  
  // Guard Test: saat setup belum selesai, /dashboard wajib redirect (302) ke /setup/step-1
  saveConfig({ is_setup_completed: false, gemini_api_key: '' });
  await runTest('TC-GRD-01: /dashboard redirect 302 ke /setup/step-1 saat setup belum selesai', async () => {
    const res = await makeGet(app, '/dashboard');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/setup/step-1');
  });

  await runTest('TC-WIZ-01: GET /setup/license mengembalikan HTTP 200', async () => {
    const res = await makeGet(app, '/setup/license');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Aktivasi Lisensi'));
  });

  await runTest('TC-WIZ-02: GET /setup/step-1 mengembalikan HTTP 200', async () => {
    const res = await makeGet(app, '/setup/step-1');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Mode Bot'));
  });

  await runTest('TC-WIZ-03: GET /setup/step-2 mengembalikan HTTP 200', async () => {
    const res = await makeGet(app, '/setup/step-2');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('WhatsApp'));
  });

  await runTest('TC-WIZ-04: GET /setup/step-3 mengembalikan HTTP 200', async () => {
    const res = await makeGet(app, '/setup/step-3');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('AI') || res.body.includes('Gemini'));
  });

  console.log('\n📌 [Grup 2] API & Status Endpoints');
  await runTest('TC-API-01: GET /api/status mengembalikan JSON status engine', async () => {
    const res = await makeGet(app, '/api/status');
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.ok(json.data && json.data.state);
  });

  console.log('\n📌 [Grup 3] Dashboard Routes (Mode Bisnis & Personal)');
  // Set is_setup_completed = true untuk membuka akses dashboard penuh
  saveConfig({ 
    is_setup_completed: true, 
    mode: 'bisnis', 
    gemini_api_key: 'AIzaSyTestApiKey1234567890' 
  });

  await runTest('TC-DSH-01: GET /setup/step-4 mengembalikan HTTP 200 saat setup selesai', async () => {
    const res = await makeGet(app, '/setup/step-4');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Selesai') || res.body.includes('Dashboard'));
  });

  await runTest('TC-DSH-02: GET /dashboard mengembalikan HTTP 200 (Dashboard Bisnis)', async () => {
    const res = await makeGet(app, '/dashboard');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Dashboard') || res.body.includes('Status WhatsApp'));
  });

  await runTest('TC-DSH-03: GET /dashboard/products mengembalikan HTTP 200 (Katalog Bisnis)', async () => {
    const res = await makeGet(app, '/dashboard/products');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-04: GET /dashboard/settings mengembalikan HTTP 200 (Pengaturan Bisnis)', async () => {
    const res = await makeGet(app, '/dashboard/settings');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Pengaturan'));
  });

  await runTest('TC-DSH-05: GET /dashboard/customers mengembalikan HTTP 200 (CRM Leads Pelanggan)', async () => {
    const res = await makeGet(app, '/dashboard/customers');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-06: GET /dashboard/crm redirect 302 ke /dashboard/customers', async () => {
    const res = await makeGet(app, '/dashboard/crm');
    assert.strictEqual(res.status, 302);
  });

  await runTest('TC-DSH-07: GET /dashboard/faqs mengembalikan HTTP 200 (Auto FAQ)', async () => {
    const res = await makeGet(app, '/dashboard/faqs');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-08: GET /dashboard/handover-inbox mengembalikan HTTP 200 (Inbox Handover)', async () => {
    const res = await makeGet(app, '/dashboard/handover-inbox');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-09: GET /dashboard/inbox redirect 302 ke /dashboard/handover-inbox', async () => {
    const res = await makeGet(app, '/dashboard/inbox');
    assert.strictEqual(res.status, 302);
  });

  await runTest('TC-DSH-10: GET /dashboard/analytics mengembalikan HTTP 200 (Bisnis Analytics)', async () => {
    const res = await makeGet(app, '/dashboard/analytics');
    assert.strictEqual(res.status, 200);
  });

  // Switch ke Mode Personal
  saveConfig({ mode: 'personal' });

  await runTest('TC-DSH-09: GET /dashboard mengembalikan HTTP 200 (Dashboard Personal)', async () => {
    const res = await makeGet(app, '/dashboard');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-10: GET /dashboard/expenses mengembalikan HTTP 200 (Rekap Keuangan)', async () => {
    const res = await makeGet(app, '/dashboard/expenses');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-11: GET /dashboard/reminders mengembalikan HTTP 200 (Daftar Pengingat)', async () => {
    const res = await makeGet(app, '/dashboard/reminders');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-12: GET /dashboard/notes mengembalikan HTTP 200 (Catatan & Todos)', async () => {
    const res = await makeGet(app, '/dashboard/notes');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-13: GET /dashboard/habits mengembalikan HTTP 200 (Habits Tracker)', async () => {
    const res = await makeGet(app, '/dashboard/habits');
    assert.strictEqual(res.status, 200);
  });

  await runTest('TC-DSH-14: GET /dashboard/budgets mengembalikan HTTP 200 (Anggaran Finansial)', async () => {
    const res = await makeGet(app, '/dashboard/budgets');
    assert.strictEqual(res.status, 200);
  });

  console.log('\n======================================================');
  console.log(`  📊 HASIL PENGUJIAN ROUTE & ENDPOINT QC:`);
  console.log(`     Total Pengujian: ${passed + failed}`);
  console.log(`     ✅ Lulus (PASS):  ${passed}`);
  console.log(`     ❌ Gagal (FAIL):  ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

startRouteSuite().catch(err => {
  console.error('Fatal Route Test Suite Error:', err);
  process.exit(1);
});
