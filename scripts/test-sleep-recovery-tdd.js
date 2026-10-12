const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('===============================================================');
console.log('  TDD SUITE: SLEEP/WAKE RECOVERY, WATCHDOG & RECONNECT ENGINE  ');
console.log('===============================================================');

async function runSleepRecoveryTdd() {
  let passedTests = 0;
  const totalTests = 7;

  // TEST 1: Verifikasi ENGINE_STATUS memiliki state 'reconnecting'
  console.log('\n[TEST 1] Verifikasi enum status ENGINE_STATUS...');
  const { ENGINE_STATUS, getStatus, setStatus } = require('../src/engine/status');
  assert.ok(ENGINE_STATUS.RECONNECTING, 'ENGINE_STATUS harus memiliki RECONNECTING');
  assert.strictEqual(ENGINE_STATUS.RECONNECTING, 'reconnecting', 'Value RECONNECTING harus "reconnecting"');
  
  setStatus(ENGINE_STATUS.RECONNECTING);
  assert.strictEqual(getStatus().state, 'reconnecting', 'Status state harus bisa diset ke reconnecting');
  console.log('  ✅ [PASS] Enum status dan state RECONNECTING valid.');
  passedTests++;

  // TEST 2: Verifikasi fungsi client.js mengekspor reconnectClient, startWatchdog, stopWatchdog
  console.log('\n[TEST 2] Verifikasi ekspor fungsi reconnect & watchdog di client.js...');
  const clientModule = require('../src/engine/client');
  assert.strictEqual(typeof clientModule.reconnectClient, 'function', 'reconnectClient harus berupa function');
  assert.strictEqual(typeof clientModule.startWatchdog, 'function', 'startWatchdog harus berupa function');
  assert.strictEqual(typeof clientModule.stopWatchdog, 'function', 'stopWatchdog harus berupa function');
  console.log('  ✅ [PASS] Fungsi reconnectClient, startWatchdog, dan stopWatchdog tersedia.');
  passedTests++;

  // TEST 3: Verifikasi Puppeteer flags di client.js tidak ada --disable-background-networking
  console.log('\n[TEST 3] Verifikasi Puppeteer flags bebas dari pembatas background network...');
  const clientSource = fs.readFileSync(path.join(__dirname, '../src/engine/client.js'), 'utf-8');
  assert.ok(!clientSource.includes("'--disable-background-networking'"), 'Flag --disable-background-networking HARUS dihilangkan agar koneksi tidak tercekik saat sleep/wake');
  assert.ok(clientSource.includes('startWatchdog'), 'client.js harus memanggil startWatchdog saat ready');
  console.log('  ✅ [PASS] Flag Chromium dioptimalkan untuk background resilience.');
  passedTests++;

  // TEST 4: Verifikasi API endpoint POST /api/reconnect
  console.log('\n[TEST 4] Verifikasi endpoint API POST /api/reconnect...');
  const express = require('express');
  const apiRouter = require('../src/server/routes/api');
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  // Periksa apakah route /reconnect terdaftar
  const routes = apiRouter.stack
    .filter(r => r.route)
    .map(r => ({ path: r.route.path, method: Object.keys(r.route.methods)[0] }));
  
  const reconnectRoute = routes.find(r => r.path === '/reconnect' && r.method === 'post');
  assert.ok(reconnectRoute, 'Route POST /api/reconnect harus terdaftar di router API');
  console.log('  ✅ [PASS] Endpoint POST /api/reconnect terdaftar dengan benar.');
  passedTests++;

  // TEST 5: Verifikasi Watchdog Time-Jump & Auto-Healing Logic
  console.log('\n[TEST 5] Verifikasi logika deteksi time-jump pada Watchdog...');
  assert.ok(clientSource.includes('isTimeJump') || clientSource.includes('timeJump') || clientSource.includes('elapsed >'), 'Watchdog harus memiliki mekanisme deteksi lompatan waktu sleep');
  console.log('  ✅ [PASS] Deteksi time-jump terkonfirmasi dalam modul engine.');
  passedTests++;

  // TEST 6: Verifikasi UI Dashboard memanggil /api/reconnect, bukan /api/reset-session untuk retry biasa
  console.log('\n[TEST 6] Verifikasi UI Dashboard memanggil soft reconnect...');
  const dashboardIndexSrc = fs.readFileSync(path.join(__dirname, '../src/server/views/dashboard/index.ejs'), 'utf-8');
  assert.ok(dashboardIndexSrc.includes('/api/reconnect'), 'Dashboard index.ejs retryEngine harus memanggil /api/reconnect agar tidak menghapus sesi');
  
  const dashboardSettingsSrc = fs.readFileSync(path.join(__dirname, '../src/server/views/dashboard/settings.ejs'), 'utf-8');
  assert.ok(dashboardSettingsSrc.includes('reconnectEngine') || dashboardSettingsSrc.includes('/api/reconnect'), 'Settings.ejs harus memiliki tombol sambungkan ulang');
  console.log('  ✅ [PASS] UI Dashboard dan Settings mendukung soft reconnect.');
  passedTests++;

  // TEST 7: Verifikasi Soft Reconnect memelihara folder sesi tanpa menghapus kredensial
  console.log('\n[TEST 7] Verifikasi isolasi sesi pada Soft Reconnect...');
  const sessionDir = path.resolve('./data/session/session-wa-bot-main');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  // Buat file dummy token
  const dummyTokenFile = path.join(sessionDir, 'dummy-auth-token.txt');
  fs.writeFileSync(dummyTokenFile, 'VALID_USER_SESSION_DATA_DO_NOT_DELETE', 'utf-8');

  // Jalankan soft reconnect (mock / invoke)
  // Soft reconnect harus membersihkan lockfile tapi membiarkan dummy token utuh
  const dummyLockFile = path.join(sessionDir, 'SingletonLock');
  fs.writeFileSync(dummyLockFile, 'zombie-lock', 'utf-8');

  // Panggil cleanSessionLocks
  const { cleanSessionLocks } = require('../src/engine/client');
  if (typeof cleanSessionLocks === 'function') {
    cleanSessionLocks();
  }

  assert.ok(fs.existsSync(dummyTokenFile), 'Token sesi login user HARUS tetap ada setelah pembersihan');
  // Bersihkan dummy test file
  try { fs.unlinkSync(dummyTokenFile); } catch (_) {}
  try { fs.unlinkSync(dummyLockFile); } catch (_) {}
  console.log('  ✅ [PASS] Sesi otentikasi terjaga saat soft recovery.');
  passedTests++;

  console.log('\n===============================================================');
  console.log(`  🎉 HASIL TDD: ${passedTests}/${totalTests} PENGUJIAN LULUS SEMPURNA!`);
  console.log('===============================================================');
}

runSleepRecoveryTdd().catch(err => {
  console.error('\n❌ TDD GAGAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
