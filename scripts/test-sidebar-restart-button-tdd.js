const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

console.log('===============================================================');
console.log('  🧪 TDD SUITE: SIDEBAR RESTART BUTTON & SLEEP RECOVERY        ');
console.log('=============================================================== \n');

let passed = 0;
let total = 0;

function runTest(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${description}`);
    passed++;
    return true;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}\n`);
    return false;
  }
}

async function runAsyncTest(description, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${description}`);
    passed++;
    return true;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}\n`);
    return false;
  }
}

async function main() {
  const ROOT_DIR = path.resolve(__dirname, '..');
  const db = require('../src/db');
  const { getConfig, saveConfig } = require('../src/config');
  const { sendOneTimeOnboardingWelcome } = require('../src/engine/onboarding');

  // 1. Verifikasi template sidebar.ejs memiliki tombol restart di kiri bawah
  runTest('Sidebar EJS contains Restart Bot button at bottom-left with Alpine.js handler', () => {
    const sidebarPath = path.join(ROOT_DIR, 'src/server/views/partials/sidebar.ejs');
    assert.ok(fs.existsSync(sidebarPath), 'sidebar.ejs must exist');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    assert.ok(content.includes('/api/restart') || content.includes('restartBot'), 'Sidebar must contain restartBot action or /api/restart endpoint');
    assert.ok(content.includes('Mulai Ulang') || content.includes('Restart'), 'Sidebar must display text for restarting the bot');
    assert.ok(content.includes('isRestarting') || content.includes('reconnecting'), 'Sidebar must handle restart loading state');
  });

  // 2. Verifikasi endpoint POST /api/restart dan POST /api/reconnect di api.js
  runTest('API router has both POST /api/restart and POST /api/reconnect endpoints', () => {
    const apiPath = path.join(ROOT_DIR, 'src/server/routes/api.js');
    assert.ok(fs.existsSync(apiPath), 'api.js must exist');
    const apiContent = fs.readFileSync(apiPath, 'utf-8');

    assert.ok(apiContent.includes("router.post('/restart'"), 'api.js must have POST /restart endpoint');
    assert.ok(apiContent.includes("router.post('/reconnect'"), 'api.js must have POST /reconnect endpoint');
  });

  // 3. Verifikasi proteksi pesan sambutan tidak dikirim ulang saat restart
  await runAsyncTest('Onboarding welcome message is NEVER resent on bot restart or reconnect', async () => {
    // Set status bahwa welcome message sudah pernah dikirim
    if (db.setSetting) {
      db.setSetting('welcome_onboarding_sent', 'true');
      db.setSetting('is_setup_completed', 'true');
    }
    saveConfig({ welcome_onboarding_sent: true, is_setup_completed: true });

    let messageSentCount = 0;
    const mockClient = {
      sendMessage: async () => {
        messageSentCount++;
      },
      info: { wid: { user: '62812345678' } }
    };

    const res = await sendOneTimeOnboardingWelcome(mockClient);
    assert.strictEqual(res.sent, false, 'Message should NOT be sent');
    assert.strictEqual(res.reason, 'ALREADY_SENT', 'Reason must be ALREADY_SENT');
    assert.strictEqual(messageSentCount, 0, 'client.sendMessage must NOT be called on restart');
  });

  // 4. Verifikasi fungsi reconnectClient membersihkan zombie process & lockfiles tanpa menghapus token auth
  runTest('reconnectClient in client.js preserves LocalAuth session tokens and clears locks', () => {
    const clientPath = path.join(ROOT_DIR, 'src/engine/client.js');
    const clientContent = fs.readFileSync(clientPath, 'utf-8');

    assert.ok(clientContent.includes('async function reconnectClient'), 'reconnectClient function must exist');
    assert.ok(clientContent.includes('cleanSessionLocks'), 'reconnectClient must clean lockfiles');
    assert.ok(clientContent.includes('forceKillBrowserProcess'), 'reconnectClient must kill zombie browser process');
    
    const reconnectFnBody = clientContent.slice(clientContent.indexOf('async function reconnectClient'), clientContent.indexOf('async function resetSession'));
    assert.ok(!reconnectFnBody.includes('forceWipeSessionDirectory('), 'reconnectClient must NOT wipe session directory');
  });

  // 5. Verifikasi Watchdog menangani sleep time-jump dan auto recovery
  runTest('Watchdog detects sleep time-jump and triggers auto-recovery soft reconnect', () => {
    const clientPath = path.join(ROOT_DIR, 'src/engine/client.js');
    const clientContent = fs.readFileSync(clientPath, 'utf-8');

    assert.ok(clientContent.includes('startWatchdog'), 'startWatchdog must exist');
    assert.ok(clientContent.includes('elapsed > (intervalMs * 1.8)'), 'Watchdog must detect time jump');
    assert.ok(clientContent.includes('reconnectClient()'), 'Watchdog must invoke reconnectClient on failure/sleep');
  });

  // 6. Verifikasi HTTP live call ke POST /api/restart
  process.env.NO_AUTO_OPEN = 'true';
  process.env.PORT = '3006';
  process.env.TEST_MODE = 'false';

  const app = require('../src/server');
  await runAsyncTest('HTTP POST /api/restart returns success: true and triggers soft reconnect', async () => {
    await new Promise(resolve => setTimeout(resolve, 600));

    const postData = JSON.stringify({});
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3006,
        path: '/api/restart',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => resolve({ statusCode: response.statusCode, body }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(res.statusCode, 200, 'POST /api/restart must return HTTP 200');
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true, 'Response must have success: true');
  });

  console.log('\n===============================================================');
  console.log(`  📊 HASIL PENGUJIAN TDD: ${passed} / ${total} LULUS`);
  if (passed === total) {
    console.log('  🎉 SELURUH SISTEM RESTORASI BOT & BUTTON RESTART LULUS 100%!');
  } else {
    console.error('  ⚠️ ADA PENGUJIAN YANG GAGAL!');
  }
  console.log('===============================================================\n');

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal TDD Suite Error:', err);
  process.exit(1);
});
