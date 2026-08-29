const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { SESSION_DIR } = require('../src/utils/paths');
const {
  initClient,
  getClient,
  destroyClient,
  resetSession,
  getStatus,
  statusEmitter,
  ENGINE_STATUS
} = require('../src/engine');

console.log('================================================================');
console.log('🧪 STRESS TEST & HARD TEST: WHATSAPP SESSION & RECOVERY ENGINE');
console.log('================================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // 1. Uji pembersihan berkas lock dan crashpad PMA
  test('1. Simulasi berkas lockfile & CrashpadMetrics-active.pma', () => {
    const sessionPath = path.join(SESSION_DIR, 'session-wa-bot-main');
    const defaultPath = path.join(sessionPath, 'Default');
    const crashpadPath = path.join(sessionPath, 'Crashpad');

    fs.mkdirSync(defaultPath, { recursive: true });
    fs.mkdirSync(crashpadPath, { recursive: true });

    // Buat file-file lock tiruan yang sering mengunci Chromium di Windows
    fs.writeFileSync(path.join(sessionPath, 'SingletonLock'), 'lock1');
    fs.writeFileSync(path.join(sessionPath, 'SingletonCookie'), 'cookie');
    fs.writeFileSync(path.join(sessionPath, 'DevToolsActivePort'), '12345');
    fs.writeFileSync(path.join(sessionPath, 'CrashpadMetrics-active.pma'), 'dummy-pma');
    fs.writeFileSync(path.join(defaultPath, 'SingletonLock'), 'lock2');
    fs.writeFileSync(path.join(crashpadPath, 'metrics.pma'), 'dummy-pma-2');

    assert.ok(fs.existsSync(path.join(sessionPath, 'CrashpadMetrics-active.pma')));
    assert.ok(fs.existsSync(path.join(sessionPath, 'SingletonLock')));
  });

  // 2. Uji resetSession membersihkan semua lockfile dan folder sesi
  await testAsync('2. Eksekusi resetSession membersihkan folder sesi & lockfile total', async () => {
    // Kita set TEST_MODE agar tidak memicu headless browser beneran di environment test jika tidak ada display
    process.env.TEST_MODE = '1';
    
    await resetSession();

    const sessionPath = path.join(SESSION_DIR, 'session-wa-bot-main');
    // Folder sesi lama harus sudah terhapus / ter-reset
    const pmaFile = path.join(sessionPath, 'CrashpadMetrics-active.pma');
    assert.strictEqual(fs.existsSync(pmaFile), false, 'CrashpadMetrics PMA harus bersih 100%');
    
    delete process.env.TEST_MODE;
  });

  // 3. Uji status transition saat resetSession
  await testAsync('3. Verifikasi Transisi Status & Emitter saat resetSession', async () => {
    let receivedStates = [];
    const handler = (s) => receivedStates.push(s.state);
    statusEmitter.on('change', handler);

    process.env.TEST_MODE = '1';
    await resetSession();
    delete process.env.TEST_MODE;

    statusEmitter.off('change', handler);
    assert.ok(receivedStates.includes(ENGINE_STATUS.CONNECTING) || receivedStates.includes(ENGINE_STATUS.DISCONNECTED));
  });

  // 4. Uji simulasi concurrent multi-reset
  await testAsync('4. Concurrency Stress Test: 5x resetSession serentak', async () => {
    process.env.TEST_MODE = '1';
    const promises = [
      resetSession(),
      resetSession(),
      resetSession(),
      resetSession(),
      resetSession()
    ];

    await Promise.all(promises);
    delete process.env.TEST_MODE;

    const status = getStatus();
    assert.ok(status !== null);
  });

  console.log('\n================================================================');
  console.log(`🎉 SEMUA PENGUJIAN STRESS TEST SESI WHATSAPP LULUS! (${passed}/${total})`);
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ STRESS TEST GAGAL:', err);
  process.exit(1);
});
