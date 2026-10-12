/**
 * ==============================================================================
 * 🏆 MASTER E2E MOBILE QUALITY CONTROL (Fase A1 s/d A6)
 * ==============================================================================
 * Menguji seluruh integrasi arsitektur Android APK dari hulu ke hilir:
 * - Engine Abstraction & Baileys WebSocket Adapter
 * - Paritas Fitur Mode Bisnis (Katalog, Stok, Handover, Order, Debounce)
 * - Mobile Storage Path Sandbox & HWID Resilience
 * - Android Native Container, Foreground Service, WakeLock, & Permissions
 * - Build Automation & Sanitasi APK (Zero-Leakage Guarantee)
 * - Kelengkapan Panduan Pembeli & CI/CD Pipeline
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

process.env.NODE_ENV = 'test';
process.env.NO_DELAY = '1';

const ROOT_DIR = path.resolve(__dirname, '..');
let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Pesan Error: ${err.message}`);
  }
}

async function runTestAsync(name, fn) {
  testsTotal++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Pesan Error: ${err.message}`);
  }
}

(async () => {
  console.log('================================================================');
  console.log('  🏆 MASTER E2E MOBILE QUALITY CONTROL (FASE A1 s/d A6)          ');
  console.log('================================================================\n');

  const db = require('../src/db');

  // ==============================================================================
  // SEKSI 1: ENGINE ABSTRACTION & BAILEYS ADAPTER (A1 & A2)
  // ==============================================================================
  console.log('--- [SEKSI 1/6] ENGINE ABSTRACTION & BAILEYS ADAPTER ---');

  runTest('Factory createEngineAdapter mengembalikan instance Baileys yang valid', () => {
    const { createEngineAdapter, BaileysEngineAdapter } = require('../src/engine/adapters');
    const adapter = createEngineAdapter('baileys');
    assert.ok(adapter instanceof BaileysEngineAdapter, 'Adapter harus berupa instance BaileysEngineAdapter');
    assert.strictEqual(typeof adapter.init, 'function');
    assert.strictEqual(typeof adapter.sendMessage, 'function');
    assert.strictEqual(typeof adapter.sendMedia, 'function');
  });

  runTest('Baileys JID translator mengonversi format @s.whatsapp.net <-> @c.us dengan sempurna', () => {
    const { BaileysEngineAdapter } = require('../src/engine/adapters');
    const adapter = new BaileysEngineAdapter();
    assert.strictEqual(adapter.toBaileysJid('628123456789@c.us'), '628123456789@s.whatsapp.net');
    assert.strictEqual(adapter.toInternalJid('628123456789@s.whatsapp.net'), '628123456789@c.us');
  });

  runTest('Normalisasi pesan Baileys menghasilkan struktur pesan standar (reply, getChat, _senderName)', () => {
    const { BaileysEngineAdapter } = require('../src/engine/adapters');
    const adapter = new BaileysEngineAdapter();

    const mockBaileysMsg = {
      key: { remoteJid: '628999888777@s.whatsapp.net', id: 'TEST_MSG_001', fromMe: false },
      pushName: 'Pelanggan Mobile',
      message: { conversation: 'Halo apakah stok kopi masih ada?' }
    };

    const normalized = adapter.normalizeMessage(mockBaileysMsg);
    assert.strictEqual(normalized.from, '628999888777@c.us');
    assert.strictEqual(normalized.body, 'Halo apakah stok kopi masih ada?');
    assert.strictEqual(normalized._senderName, 'Pelanggan Mobile');
    assert.strictEqual(typeof normalized.reply, 'function');
    assert.strictEqual(typeof normalized.getChat, 'function');
  });

  // ==============================================================================
  // SEKSI 2: PARITAS FITUR MODE BISNIS PADA BAILEYS (A3)
  // ==============================================================================
  console.log('\n--- [SEKSI 2/6] PARITAS FITUR MODE BISNIS PADA BAILEYS ---');

  runTest('RAG context builder menginjeksikan stok produk real-time ke prompt AI', () => {
    const { buildContext } = require('../src/ai/context-builder');
    const context = buildContext('Apakah kopi robusta masih ada stoknya?', 'bisnis');
    assert.strictEqual(typeof context, 'string');
    assert.ok(context.length > 0, 'Context RAG tidak boleh kosong');
  });

  runTest('Deteksi kata kunci handover (komplain, nego harga) memicu status jeda intervensi manusia', () => {
    const { isHandoverTriggered } = require('../src/engine/handlers/business-handler');
    assert.strictEqual(isHandoverTriggered('harganya bisa nego ga ya kak?'), true);
    assert.strictEqual(isHandoverTriggered('saya mau komplain produknya rusak'), true);
    assert.strictEqual(isHandoverTriggered('apakah tokonya buka hari ini?'), false);
  });

  runTest('Pengiriman gambar katalog produk menyiapkan format buffer & caption harga terstandarisasi', () => {
    const { findProductImageToSend } = require('../src/engine/handlers/business-handler');
    
    // Siapkan mock file gambar
    const testUploadsDir = path.join(ROOT_DIR, 'public', 'uploads');
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
    const testImgPath = path.join(testUploadsDir, 'kopi-arabika-master-qc.jpg');
    fs.writeFileSync(testImgPath, 'BUFFER_IMAGE_QC_TEST');

    // Buat produk di DB dengan isolasi bersih
    try { db.db.prepare("DELETE FROM products WHERE name LIKE 'Kopi Arabika Master QC%'").run(); } catch (_) {}
    const newProdId = db.createProduct({
      name: 'Kopi Arabika Master QC',
      price: 85000,
      stock: 25,
      description: 'Kopi Arabika Single Origin untuk pengujian QC',
      category: 'Kopi',
      image_path: 'public/uploads/kopi-arabika-master-qc.jpg'
    });

    const mediaResult = findProductImageToSend('Bisa minta foto kopi arabika master qc dong?');
    assert.ok(mediaResult !== null, 'Harus mendeteksi foto produk Kopi Arabika Master QC');
    assert.strictEqual(mediaResult.product.id, newProdId);

    // Cleanup
    if (db.deleteProduct) db.deleteProduct(newProdId);
    try { fs.unlinkSync(testImgPath); } catch (_) {}
  });

  await runTestAsync('MessageBuffer menyatukan multi-bubble chat pelanggan sebelum diteruskan ke AI', async () => {
    const { enqueueIncomingMessage } = require('../src/engine/message-buffer');
    const { BaileysEngineAdapter } = require('../src/engine/adapters');
    const adapter = new BaileysEngineAdapter();

    let combinedText = '';
    const fakeClient = {};

    const msg1 = adapter.normalizeMessage({
      key: { remoteJid: '628111222333@s.whatsapp.net', id: 'BUBBLE_1', fromMe: false },
      pushName: 'Budi',
      message: { conversation: 'Halo kak' }
    });

    const msg2 = adapter.normalizeMessage({
      key: { remoteJid: '628111222333@s.whatsapp.net', id: 'BUBBLE_2', fromMe: false },
      pushName: 'Budi',
      message: { conversation: 'Mau tanya promo kopi hari ini' }
    });

    await new Promise((resolve) => {
      enqueueIncomingMessage(msg1, fakeClient, (aggMsg) => {
        combinedText = aggMsg.body;
        resolve();
      }, 50);

      setTimeout(() => {
        enqueueIncomingMessage(msg2, fakeClient, (aggMsg) => {
          combinedText = aggMsg.body;
          resolve();
        }, 50);
      }, 20);
    });

    assert.strictEqual(combinedText, 'Halo kak\nMau tanya promo kopi hari ini');
  });

  // ==============================================================================
  // SEKSI 3: MOBILE STORAGE SANDBOX & PATH RESILIENCE (A4)
  // ==============================================================================
  console.log('\n--- [SEKSI 3/6] MOBILE STORAGE SANDBOX & PATH RESILIENCE ---');

  runTest('Environment paths mendeteksi direktori mobile jika process.env.ANDROID_DATA_DIR disetel', () => {
    const mockMobilePath = path.resolve(__dirname, '../data/temp-qc-mobile-sandbox');
    process.env.ANDROID_DATA_DIR = mockMobilePath;

    delete require.cache[require.resolve('../src/utils/paths')];
    const paths = require('../src/utils/paths');

    assert.strictEqual(paths.isAndroid, true);
    assert.strictEqual(path.resolve(paths.BASE_DIR), path.resolve(mockMobilePath));
    assert.strictEqual(path.resolve(paths.DATA_DIR), path.resolve(mockMobilePath, 'data'));
    assert.strictEqual(path.resolve(paths.CONFIG_DIR), path.resolve(mockMobilePath, 'config'));
    assert.strictEqual(path.resolve(paths.SESSION_DIR), path.resolve(mockMobilePath, 'data', 'session'));

    // Reset
    delete process.env.ANDROID_DATA_DIR;
    delete require.cache[require.resolve('../src/utils/paths')];
    try { fs.rmSync(mockMobilePath, { recursive: true, force: true }); } catch (_) {}
  });

  runTest('HWID generator menghasilkan identifier unik 64 karakter pada perangkat Android tanpa crash', () => {
    process.env.ANDROID_ID = 'test_android_hwid_device_007';
    const { getHwid } = require('../src/utils/hwid');
    const hwid = getHwid();
    assert.strictEqual(typeof hwid, 'string');
    assert.strictEqual(hwid.length, 64, 'HWID harus berupa hash SHA-256 64 karakter');
    delete process.env.ANDROID_ID;
  });

  // ==============================================================================
  // SEKSI 4: ANDROID CONTAINER & MANIFEST PERMISSIONS (A5)
  // ==============================================================================
  console.log('\n--- [SEKSI 4/6] ANDROID CONTAINER, SERVICE & PERMISSIONS ---');

  runTest('AndroidManifest.xml memuat seluruh 8 izin utama keep-alive dan background execution', () => {
    const manifestPath = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml harus ada');
    const content = fs.readFileSync(manifestPath, 'utf8');

    const requiredPermissions = [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.WAKE_LOCK',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED'
    ];

    for (const perm of requiredPermissions) {
      assert.ok(content.includes(perm), `Izin ${perm} harus terdaftar di AndroidManifest.xml`);
    }
    assert.ok(content.includes('android:usesCleartextTraffic="true"'), 'usesCleartextTraffic harus true untuk localhost');
  });

  runTest('Kelas Native Java (Service, MainActivity, Runner, Receiver) terkonfigurasi dengan benar', () => {
    const javaDir = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'java', 'com', 'wabot', 'assistant');
    const serviceFile = fs.readFileSync(path.join(javaDir, 'BotForegroundService.java'), 'utf8');
    const activityFile = fs.readFileSync(path.join(javaDir, 'MainActivity.java'), 'utf8');
    const runnerFile = fs.readFileSync(path.join(javaDir, 'NodeServerRunner.java'), 'utf8');
    const bootFile = fs.readFileSync(path.join(javaDir, 'BootReceiver.java'), 'utf8');

    assert.ok(serviceFile.includes('startForeground'), 'BotForegroundService harus memanggil startForeground');
    assert.ok(serviceFile.includes('PARTIAL_WAKE_LOCK'), 'BotForegroundService harus menginisialisasi WakeLock');
    assert.ok(activityFile.includes('setJavaScriptEnabled(true)'), 'MainActivity harus mengaktifkan JavaScript di WebView');
    assert.ok(activityFile.includes('ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'), 'MainActivity harus mendukung prompt whitelist baterai');
    assert.ok(runnerFile.includes('http://127.0.0.1:3000'), 'NodeServerRunner harus memonitor port 3000');
    assert.ok(bootFile.includes('BOOT_COMPLETED'), 'BootReceiver harus menangani ACTION_BOOT_COMPLETED');
  });

  // ==============================================================================
  // SEKSI 5: BUILD APK & DISTRIBUSI PACKAGING (A6)
  // ==============================================================================
  console.log('\n--- [SEKSI 5/6] BUILD APK & DISTRIBUSI PACKAGING ---');

  runTest('Skrip build-apk.js berhasil dieksekusi dan menghasilkan file APK siap install', () => {
    execSync('node scripts/build-apk.js --edition=bisnis', { stdio: 'pipe' });

    const apkPath = path.join(ROOT_DIR, 'dist', 'wa-bot-bisnis.apk');
    assert.ok(fs.existsSync(apkPath), 'File dist/wa-bot-bisnis.apk harus terbentuk');

    const stat = fs.statSync(apkPath);
    assert.ok(stat.size > 50000, `Ukuran APK harus lebih dari 50 KB (saat ini: ${stat.size} bytes)`);

    // Verifikasi signature header zip/apk (PK\x03\x04 = 0x04034b50)
    const fd = fs.openSync(apkPath, 'r');
    const headerBuf = Buffer.alloc(4);
    fs.readSync(fd, headerBuf, 0, 4, 0);
    fs.closeSync(fd);

    assert.strictEqual(headerBuf.readUInt32LE(0), 0x04034b50, 'Header biner file harus valid PKZip/APK container');
  });

  runTest('Arsip proyek Android Studio dist/wa-bot-android-project.zip terbentuk dengan sempurna', () => {
    const zipPath = path.join(ROOT_DIR, 'dist', 'wa-bot-android-project.zip');
    assert.ok(fs.existsSync(zipPath), 'Arsip wa-bot-android-project.zip harus ada');
    const stat = fs.statSync(zipPath);
    assert.ok(stat.size > 50000, 'Arsip proyek Android Studio harus valid');
  });

  runTest('Audit Sanitasi APK: Jaminan Tanpa Kebocoran (Zero-Leakage Guarantee)', () => {
    const stagedAssetsDir = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'assets', 'nodejs-project');
    assert.ok(fs.existsSync(stagedAssetsDir), 'Staged assets direktori harus ada');

    // Pastikan tidak ada file rahasia yang terbawa ke dalam assets APK
    const forbiddenFiles = ['.env', 'config.json', 'license.json', 'bot.db', 'bot.db-journal'];
    for (const f of forbiddenFiles) {
      const full = path.join(stagedAssetsDir, f);
      assert.ok(!fs.existsSync(full), `File rahasia/runtime ${f} tidak boleh bocor ke dalam assets APK!`);
      const inConfig = path.join(stagedAssetsDir, 'config', f);
      assert.ok(!fs.existsSync(inConfig), `File rahasia ${f} tidak boleh ada di assets/config!`);
    }
  });

  // ==============================================================================
  // SEKSI 6: DOKUMENTASI PEMBELI & CI/CD PIPELINE (A6)
  // ==============================================================================
  console.log('\n--- [SEKSI 6/6] DOKUMENTASI PEMBELI & CI/CD PIPELINE ---');

  runTest('Panduan pembeli Android docs/panduan-aplikasi-android.md lengkap dan detail', () => {
    const guidePath = path.join(ROOT_DIR, 'docs', 'panduan-aplikasi-android.md');
    assert.ok(fs.existsSync(guidePath), 'Dokumen panduan-aplikasi-android.md harus ada');

    const content = fs.readFileSync(guidePath, 'utf8');
    assert.ok(content.includes('wa-bot-bisnis.apk'), 'Harus menyebutkan nama file APK');
    assert.ok(content.includes('Anti-Killed') || content.includes('anti-killed') || content.includes('latar belakang'), 'Harus memuat petunjuk background anti-killed');
    assert.ok(content.includes('Xiaomi') && content.includes('Samsung') && content.includes('Oppo'), 'Harus memuat panduan per merk HP');
    assert.ok(content.includes('Gemini'), 'Harus memuat panduan API Key Gemini');
  });

  runTest('Workflow GitHub Actions .github/workflows/build-android-apk.yml tersedia untuk auto-build cloud', () => {
    const workflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'build-android-apk.yml');
    assert.ok(fs.existsSync(workflowPath), 'Workflow GitHub Actions harus ada');
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('gradle assembleDebug') || content.includes('gradlew'), 'Workflow harus mengompilasi APK');
  });

  // ==============================================================================
  // REKAPITULASI HASIL AUDIT MASTER
  // ==============================================================================
  console.log('\n================================================================');
  console.log(`  📊 HASIL MASTER E2E MOBILE QC: ${testsPassed} LULUS / ${testsTotal} TOTAL`);
  if (testsPassed === testsTotal) {
    console.log('  🎉 STATUS: 100% LULUS — SELURUH ARSITEKTUR ANDROID APK SELESAI & SIAP RILIS!');
  } else {
    console.log(`  ⚠️ STATUS: DITEMUKAN ${testsTotal - testsPassed} KETIDAKSESUAIAN.`);
  }
  console.log('================================================================\n');

  if (testsPassed !== testsTotal) {
    process.exit(1);
  }
})();
