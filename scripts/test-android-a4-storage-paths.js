/**
 * TDD Test Suite: FASE A4 - Penyesuaian Path, SQLite Sandbox & Platform Mobile
 * 
 * Memverifikasi:
 * 1. Deteksi lingkungan platform Android (isAndroid).
 * 2. Resolusi BASE_DIR, DATA_DIR, CONFIG_DIR, UPLOADS_DIR, SESSION_DIR ke sandbox Android.
 * 3. Pembuatan otomatis direktori kerja (ensureDirectoriesExist) pada storage internal.
 * 4. Kompatibilitas SQLite (pembacaan/penulisan database bot.db) di dalam direktori sandbox.
 * 5. Penyimpanan dan pembacaan berkas konfigurasi & lisensi pada mobile sandbox.
 * 6. Generasi HWID deterministik di lingkungan Android.
 * 
 * Jalankan: node scripts/test-android-a4-storage-paths.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('  🧪 TDD TEST SUITE: FASE A4 - MOBILE PATHS & SQLITE SANDBOX   ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

async function runTestAsync(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     -> Error: ${err.message}`);
    failedTests++;
  }
}

(async () => {
  // Direktori sandbox simulasi untuk pengujian mobile
  const mockSandboxDir = path.resolve(__dirname, '../data/test-android-sandbox');

  // --- BAGIAN 1: DETEKSI & STRUKTUR PATH DEFAULT ---
  console.log('--- [BAGIAN 1] DETEKSI LINGKUNGAN & PATH DEFAULT ---');

  const defaultPaths = require('../src/utils/paths');

  runTest('Default paths mengekspor fungsi dan konstanta yang lengkap', () => {
    assert.ok('isAndroid' in defaultPaths);
    assert.ok('BASE_DIR' in defaultPaths);
    assert.ok('DATA_DIR' in defaultPaths);
    assert.ok('CONFIG_DIR' in defaultPaths);
    assert.ok('UPLOADS_DIR' in defaultPaths);
    assert.ok('SESSION_DIR' in defaultPaths);
    assert.strictEqual(typeof defaultPaths.ensureDirectoriesExist, 'function');
    assert.strictEqual(typeof defaultPaths.resolveWritablePath, 'function');
  });

  // --- BAGIAN 2: SIMULASI ANDROID DATA DIR & SANDBOX RESOLUTION ---
  console.log('\n--- [BAGIAN 2] SIMULASI ANDROID SANDBOX DIR ---');

  // Siapkan folder sandbox simulasi
  if (fs.existsSync(mockSandboxDir)) {
    fs.rmSync(mockSandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(mockSandboxDir, { recursive: true });

  // Simulasikan ANDROID_DATA_DIR
  process.env.ANDROID_DATA_DIR = mockSandboxDir;

  // Clear require cache agar paths.js dievaluasi ulang dengan env baru
  delete require.cache[require.resolve('../src/utils/paths')];
  const androidPaths = require('../src/utils/paths');

  runTest('isAndroid terdeteksi true saat ANDROID_DATA_DIR disetel', () => {
    assert.strictEqual(androidPaths.isAndroid, true);
    assert.strictEqual(path.resolve(androidPaths.BASE_DIR), path.resolve(mockSandboxDir));
    assert.strictEqual(path.resolve(androidPaths.DATA_DIR), path.resolve(mockSandboxDir, 'data'));
    assert.strictEqual(path.resolve(androidPaths.CONFIG_DIR), path.resolve(mockSandboxDir, 'config'));
  });

  runTest('ensureDirectoriesExist membuat seluruh folder kerja di sandbox Android', () => {
    androidPaths.ensureDirectoriesExist();
    assert.ok(fs.existsSync(androidPaths.DATA_DIR), 'Folder data harus dibuat');
    assert.ok(fs.existsSync(androidPaths.CONFIG_DIR), 'Folder config harus dibuat');
    assert.ok(fs.existsSync(androidPaths.UPLOADS_DIR), 'Folder uploads harus dibuat');
    assert.ok(fs.existsSync(androidPaths.SESSION_DIR), 'Folder session harus dibuat');
  });

  runTest('resolveWritablePath menyelesaikan path relatif di dalam sandbox Android', () => {
    const custom = androidPaths.resolveWritablePath('custom/settings.json');
    assert.strictEqual(path.resolve(custom), path.resolve(mockSandboxDir, 'custom/settings.json'));
  });

  // --- BAGIAN 3: PENGUJIAN DATABASE SQLITE DI SANDBOX MOBILE ---
  console.log('\n--- [BAGIAN 3] SQLITE ENGINE DI DALAM SANDBOX MOBILE ---');

  await runTestAsync('Database SQLite dapat dibuat dan beroperasi di direktori sandbox Android', async () => {
    const sandboxDbPath = path.join(androidPaths.DATA_DIR, 'bot.db');
    let testDb;

    try {
      const Database = require('better-sqlite3');
      testDb = new Database(sandboxDbPath);
    } catch (_) {
      const nodeSqliteMod = 'node' + ':sqlite';
      const sqlitePkg = eval('require')(nodeSqliteMod);
      testDb = new sqlitePkg.DatabaseSync(sandboxDbPath);
    }

    assert.ok(testDb, 'Koneksi SQLite harus berhasil diinisialisasi');

    // Buat tabel uji coba
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS android_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        val TEXT NOT NULL
      );
    `);

    // Insert data
    testDb.prepare("INSERT INTO android_test (key, val) VALUES (?, ?)").run('mobile_status', 'active_on_android');

    // Baca data
    const row = testDb.prepare("SELECT * FROM android_test WHERE key = ?").get('mobile_status');
    assert.ok(row);
    assert.strictEqual(row.val, 'active_on_android');

    if (typeof testDb.close === 'function') {
      testDb.close();
    }
    assert.ok(fs.existsSync(sandboxDbPath), 'Berkas bot.db fisik harus ada di folder sandbox data/');
  });

  // --- BAGIAN 4: FILE CONFIG & LICENSE DI DALAM SANDBOX ---
  console.log('\n--- [BAGIAN 4] CONFIG & LICENSE PERSISTENCE ---');

  runTest('Konfigurasi dan lisensi dapat ditulis dan dibaca dari sandbox mobile', () => {
    const mockConfigPath = path.join(androidPaths.CONFIG_DIR, 'config.json');
    const mockConfig = { mode: 'bisnis', port: 3000, business_name: 'Warung Mobile' };
    fs.writeFileSync(mockConfigPath, JSON.stringify(mockConfig, null, 2), 'utf8');

    assert.ok(fs.existsSync(mockConfigPath));
    const loaded = JSON.parse(fs.readFileSync(mockConfigPath, 'utf8'));
    assert.strictEqual(loaded.business_name, 'Warung Mobile');

    const mockLicensePath = path.join(androidPaths.CONFIG_DIR, 'license.json');
    const mockLicense = { licenseKey: 'TEST-ANDROID-KEY', activatedAt: new Date().toISOString() };
    fs.writeFileSync(mockLicensePath, JSON.stringify(mockLicense, null, 2), 'utf8');

    assert.ok(fs.existsSync(mockLicensePath));
    const loadedLic = JSON.parse(fs.readFileSync(mockLicensePath, 'utf8'));
    assert.strictEqual(loadedLic.licenseKey, 'TEST-ANDROID-KEY');
  });

  // --- BAGIAN 5: GENERASI HWID DI LINGKUNGAN ANDROID ---
  console.log('\n--- [BAGIAN 5] HWID GENERATION DI LINGKUNGAN ANDROID ---');

  runTest('getHwid menghasilkan 64-karakter SHA-256 fingerprint yang konsisten', () => {
    process.env.ANDROID_ID = 'mock_android_device_id_9988';
    const { getHwid } = require('../src/utils/hwid');

    const hwid1 = getHwid();
    const hwid2 = getHwid();

    assert.ok(hwid1, 'HWID tidak boleh kosong');
    assert.strictEqual(hwid1.length, 64, 'HWID harus berupa hash SHA-256 64 karakter hex');
    assert.strictEqual(hwid1, hwid2, 'HWID harus deterministik dan konsisten');
  });

  // Bersihkan environment & direktori pengujian
  delete process.env.ANDROID_DATA_DIR;
  delete process.env.ANDROID_ID;
  delete require.cache[require.resolve('../src/utils/paths')];

  try {
    if (fs.existsSync(mockSandboxDir)) {
      fs.rmSync(mockSandboxDir, { recursive: true, force: true });
    }
  } catch (_) {}

  console.log('\n================================================================');
  console.log(`  📊 HASIL PENGUJIAN FASE A4: ${passedTests} LULUS / ${totalTests} TOTAL`);
  if (failedTests === 0) {
    console.log('  🎉 STATUS: 100% LULUS — FASE A4 SELESAI DENGAN SEMPURNA!');
  } else {
    console.log(`  ⚠️ STATUS: ADA ${failedTests} PENGUJIAN YANG GAGAL.`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
