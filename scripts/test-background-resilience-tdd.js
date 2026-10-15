/**
 * TDD Test Suite: Background Resilience, Zero-Reload Launch, and Upfront Permissions
 * 
 * Menguji:
 * 1. SingleTask Launch Mode & Instant Re-entry (Zero Reload):
 *    - AndroidManifest.xml memiliki android:launchMode="singleTask" untuk MainActivity.
 *    - MainActivity mendeteksi jika server sudah siap (NodeServerRunner.isServerReady()) saat start/re-entry
 *      sehingga tidak menampilkan loading screen berulang dan tidak reload halaman dari awal.
 *    - MainActivity mengimplementasikan onNewIntent untuk menangani pembukaan ulang dari recent apps / launcher.
 * 
 * 2. Background Keep-Alive & Anti-Sleep Resilience (seperti WhatsApp / IG / FB):
 *    - BotForegroundService.onTaskRemoved menggunakan PendingIntent.getForegroundService (Android 8+)
 *      dan AlarmManager.setExactAndAllowWhileIdle (RTC_WAKEUP) agar tidak crash / diabaikan OS.
 *    - BotForegroundService mempertahankan WakeLock (CPU) dan WifiLock (Jaringan) tanpa batas waktu.
 *    - NodeServerRunner memvalidasi jika server sudah berjalan agar tidak terjadi duplicate thread / conflict.
 * 
 * 3. Alur Perizinan Lengkap di Awal (Upfront Permissions Onboarding):
 *    - MainActivity memiliki metode setup perizinan awal saat pertama kali dibuka.
 *    - Memeriksa dan memfasilitasi 4 izin wajib:
 *      a) POST_NOTIFICATIONS (Notifikasi foreground service di Android 13+)
 *      b) READ_MEDIA_IMAGES / READ_EXTERNAL_STORAGE (Akses foto produk & dokumen SOP)
 *      c) ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (Pengecualian hemat baterai / Doze mode)
 *      d) ACTION_APPLICATION_DETAILS_SETTINGS (Menu Info Aplikasi untuk mode 'Tanpa Pembatasan' & Autostart)
 * 
 * 4. Baileys Network Reconnection & Watchdog Heartbeat:
 *    - baileys-adapter.js memiliki loop auto-reconnect dengan retry backoff (tidak berhenti setelah 1x gagal).
 *    - baileys-adapter.js memiliki watchdog heartbeat pemantau koneksi socket berkala.
 *    - src/engine/index.js mengintegrasikan startWatchdog/stopWatchdog untuk mode Baileys.
 * 
 * Jalankan: node scripts/test-background-resilience-tdd.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('  🧪 TDD TEST SUITE: BACKGROUND RESILIENCE & ZERO-RELOAD AUDIT   ');
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

const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
const mainActivityPath = path.join(rootDir, 'android/app/src/main/java/com/wabot/assistant/MainActivity.java');
const servicePath = path.join(rootDir, 'android/app/src/main/java/com/wabot/assistant/BotForegroundService.java');
const runnerPath = path.join(rootDir, 'android/app/src/main/java/com/wabot/assistant/NodeServerRunner.java');
const baileysAdapterPath = path.join(rootDir, 'src/engine/adapters/baileys-adapter.js');
const engineIndexPath = path.join(rootDir, 'src/engine/index.js');

// --- SEKSI 1: SINGLE-TASK & INSTANT ZERO-RELOAD ---
console.log('--- [SEKSI 1] SINGLE-TASK & INSTANT ZERO-RELOAD ---');

runTest('AndroidManifest.xml harus menetapkan launchMode="singleTask" untuk MainActivity', () => {
  const content = fs.readFileSync(manifestPath, 'utf8');
  assert.ok(
    content.includes('android:launchMode="singleTask"'),
    'MainActivity harus dikonfigurasi dengan android:launchMode="singleTask" agar activity tidak dibuat ulang saat user membuka dari home/recent apps'
  );
});

runTest('MainActivity.java harus mendeteksi server sudah siap sebelum menampilkan loading layout', () => {
  const content = fs.readFileSync(mainActivityPath, 'utf8');
  assert.ok(
    content.includes('NodeServerRunner.isServerReady()'),
    'MainActivity harus memeriksa NodeServerRunner.isServerReady() saat start'
  );
  assert.ok(
    content.includes('onNewIntent'),
    'MainActivity harus meng-override onNewIntent() untuk menangani pemanggilan ulang tanpa reload'
  );
});

// --- SEKSI 2: BACKGROUND KEEP-ALIVE & ONTASKREMOVED RESILIENCE ---
console.log('\n--- [SEKSI 2] BACKGROUND KEEP-ALIVE & ONTASKREMOVED RESILIENCE ---');

runTest('BotForegroundService.java harus menggunakan PendingIntent.getForegroundService di Android 8+', () => {
  const content = fs.readFileSync(servicePath, 'utf8');
  assert.ok(
    content.includes('PendingIntent.getForegroundService'),
    'onTaskRemoved harus menggunakan PendingIntent.getForegroundService untuk Android 8+ agar tidak dilempar BackgroundServiceStartNotAllowedException'
  );
});

runTest('BotForegroundService.java harus menggunakan AlarmManager dengan setExactAndAllowWhileIdle untuk anti-Doze wake', () => {
  const content = fs.readFileSync(servicePath, 'utf8');
  assert.ok(
    content.includes('setExactAndAllowWhileIdle'),
    'onTaskRemoved harus menggunakan setExactAndAllowWhileIdle agar alarm pemulihan tetap aktif menembus mode Doze/Sleep'
  );
});

runTest('NodeServerRunner.java harus menjaga agar startServer tidak menduplikasi proses jika server port 3000 sudah siap', () => {
  const content = fs.readFileSync(runnerPath, 'utf8');
  assert.ok(
    content.includes('isServerReady()') && content.includes('isRunning'),
    'startServer() harus memeriksa isServerReady() atau isRunning agar tidak memanggil libnode ganda'
  );
});

// --- SEKSI 3: UPFRONT COMPREHENSIVE PERMISSIONS FLOW ---
console.log('\n--- [SEKSI 3] UPFRONT COMPREHENSIVE PERMISSIONS FLOW ---');

runTest('MainActivity.java harus memiliki alur inisialisasi perizinan awal (Initial Permissions Onboarding)', () => {
  const content = fs.readFileSync(mainActivityPath, 'utf8');
  assert.ok(
    content.includes('checkAndRequestInitialPermissions') || content.includes('showInitialPermissionsDialog'),
    'MainActivity harus memiliki fungsi perizinan awal lengkap saat user pertama kali membuka aplikasi'
  );
  assert.ok(
    content.includes('READ_MEDIA_IMAGES') || content.includes('READ_EXTERNAL_STORAGE'),
    'Alur perizinan awal harus mencakup izin akses berkas dan foto'
  );
  assert.ok(
    content.includes('POST_NOTIFICATIONS'),
    'Alur perizinan awal harus mencakup izin notifikasi latar belakang'
  );
  assert.ok(
    content.includes('ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'),
    'Alur perizinan awal harus memfasilitasi penonaktifan penghemat baterai'
  );
});

// --- SEKSI 4: BAILEYS AUTO-RECONNECT LOOP & WATCHDOG HEARTBEAT ---
console.log('\n--- [SEKSI 4] BAILEYS AUTO-RECONNECT & WATCHDOG HEARTBEAT ---');

runTest('baileys-adapter.js harus memiliki loop retry reconnect dengan backoff (tidak berhenti setelah 1x gagal)', () => {
  const content = fs.readFileSync(baileysAdapterPath, 'utf8');
  assert.ok(
    content.includes('scheduleAutoReconnect') || content.includes('reconnectAttempts'),
    'baileys-adapter.js harus memiliki mekanisme penjadwalan ulang reconnect berkala jika percobaan pertama gagal'
  );
});

runTest('baileys-adapter.js harus mengimplementasikan heartbeat watchdog untuk mendeteksi socket mati / sleep resume', () => {
  const content = fs.readFileSync(baileysAdapterPath, 'utf8');
  assert.ok(
    content.includes('startWatchdog') && content.includes('stopWatchdog'),
    'baileys-adapter.js harus memiliki metode startWatchdog dan stopWatchdog'
  );
});

runTest('src/engine/index.js harus mengaktifkan startWatchdog untuk adapter Baileys', () => {
  const content = fs.readFileSync(engineIndexPath, 'utf8');
  assert.ok(
    !content.includes('startWatchdog: (...args) => isBaileysMode() ? null'),
    'src/engine/index.js tidak boleh menonaktifkan startWatchdog untuk Baileys (tidak boleh me-return null)'
  );
});

console.log('\n================================================================');
console.log(`  📊 HASIL TDD TEST: ${passedTests} LULUS / ${totalTests} TOTAL`);
if (failedTests === 0) {
  console.log('  🎉 STATUS: SEMUA KRITERIA TDD BERHASIL LULUS 100%!');
} else {
  console.log(`  ⚠️ STATUS: ${failedTests} TEST MASIH GAGAL — SIAP DI-IMPLEMENTASIKAN!`);
}
console.log('================================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
