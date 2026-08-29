const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { findSystemBrowserExecutable } = require('../src/utils/browser-locator');
const { initClient, destroyClient, getStatus } = require('../src/engine');

async function testAlreadyRunningStress() {
  console.log('===========================================================');
  console.log('  TEST: RECOVERY DARI KONDISI "ALREADY RUNNING" & ZOMBIE  ');
  console.log('===========================================================');

  const browserPath = findSystemBrowserExecutable();
  console.log('1. Menggunakan browser:', browserPath);
  
  const sessionDir = path.resolve('./data/session/session-wa-bot-main');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // LANGKAH 1: Sengaja spawn proses browser zombie di background yang mengunci folder session
  console.log('2. Sengaja menyalakan proses browser zombie untuk mengunci folder session...');
  const zombieProcess = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    `--user-data-dir=${sessionDir}`,
    'about:blank'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  zombieProcess.unref();

  // Buat file lock palsu untuk menguji pembersihan lockfile
  fs.writeFileSync(path.join(sessionDir, 'DevToolsActivePort'), '9999\n/devtools/browser/fake-id\n');
  fs.writeFileSync(path.join(sessionDir, 'SingletonLock'), 'fake-lock');
  fs.writeFileSync(path.join(sessionDir, 'lockfile'), 'fake-lockfile');

  console.log('3. Folder sesi berhasil dikunci oleh zombie PID:', zombieProcess.pid);
  console.log('   File lock sengaja dibuat: DevToolsActivePort, SingletonLock, lockfile');

  // Tunggu 1 detik agar proses zombie benar-benar memegang file lock di Windows
  await new Promise(r => setTimeout(r, 1000));

  // LANGKAH 2: Panggil initClient() dari engine bot kita
  console.log('4. Memanggil initClient() — Sistem HARUS otomatis mematikan zombie & membersihkan lock...');
  
  let qrReceived = false;
  
  const client = initClient({}, true);

  const qrPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout 30 detik menunggu QR code'));
    }, 30000);

    client.on('qr', (qr) => {
      clearTimeout(timeout);
      qrReceived = true;
      console.log('✅ BERHASIL: Event QR Code WhatsApp muncul! Panjang:', qr.length);
      resolve(qr);
    });

    client.on('auth_failure', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Auth failure: ${err}`));
    });
  });

  try {
    await qrPromise;
    console.log('===========================================================');
    console.log('🎉 HASIL: 100% SUKSES! Engine berhasil self-healing dari');
    console.log('   kondisi browser zombie & file lock yang terbengkalai!');
    console.log('===========================================================');
  } finally {
    await destroyClient();
  }
}

testAlreadyRunningStress().catch(async (err) => {
  console.error('❌ Test GAGAL:', err.message);
  await destroyClient();
  process.exit(1);
});
