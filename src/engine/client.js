let Client = null;
let LocalAuth = null;
try {
  const wwebjs = require('whatsapp-web.js');
  Client = wwebjs.Client;
  LocalAuth = wwebjs.LocalAuth;
} catch (_) {}
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const {
  ENGINE_STATUS,
  setStatus,
  setQrCode,
  resetStatus
} = require('./status');
const { handleIncomingMessage } = require('./handlers/message-handler');
const { startReminderScheduler, stopReminderScheduler } = require('./reminder-scheduler');
const { SESSION_DIR } = require('../utils/paths');
const { findSystemBrowserExecutable } = require('../utils/browser-locator');

// Pastikan folder session ada
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Tangani exception dan unhandled rejection agar Web Controller tetap hidup 100%
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EBUSY' || (err.message && err.message.includes('EBUSY'))) && (err.stack && err.stack.includes('session-wa-bot-main'))) {
    console.warn('[Engine] Warning: Berkas sesi teruji/terkunci saat cleanup logout (EBUSY). Server tetap berjalan.');
    return;
  }
  console.error('[Engine Process Error (Non-Fatal)]', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Engine Unhandled Rejection (Non-Fatal)]', reason);
});

/**
 * Membunuh proses browser Chromium/Edge yang mungkin masih mengunci folder sesi pada Windows
 */
function forceKillBrowserProcess() {
  if (process.platform === 'win32') {
    try {
      if (clientInstance && clientInstance.pupBrowser) {
        try {
          const proc = clientInstance.pupBrowser.process();
          if (proc && proc.pid) {
            execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
          }
        } catch (_) {}
      }

      // Bunuh SEMUA proses browser zombie sisa yang menggunakan session-wa-bot-main pada Windows
      try {
        const psCmd = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe' -or $_.Name -eq 'chromium.exe') -and ($_.CommandLine -like '*session-wa-bot-main*' -or $_.CommandLine -like '*data*session*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { stdio: 'ignore', timeout: 5000 });
      } catch (_) {}
    } catch (_) {}
  } else {
    // Platform Linux (VPS) & macOS: Bunuh proses browser zombie yang mengunci folder sesi
    try {
      execSync(`pkill -f 'session-wa-bot-main'`, { stdio: 'ignore' });
    } catch (_) {}
  }
}

/**
 * Membersihkan file lock sisa proses Chromium sebelumnya yang macet
 */
function cleanSessionLocks() {
  const sessionPath = path.join(SESSION_DIR, 'session-wa-bot-main');
  if (!fs.existsSync(sessionPath)) return;

  const lockFiles = [
    'DevToolsActivePort',
    'lockfile',
    'SingletonLock',
    'SingletonSocket',
    'SingletonCookie',
    'CrashpadMetrics-active.pma'
  ];

  const targetDirs = [
    sessionPath,
    path.join(sessionPath, 'Default'),
    path.join(sessionPath, 'Crashpad')
  ];

  for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (lockFiles.includes(file) || file.startsWith('Singleton') || file.endsWith('.pma') || file.endsWith('.lock')) {
            const fullPath = path.join(dir, file);
            try {
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  }
}

/**
 * Menghapus folder sesi lama secara tuntas dengan mekanisme toleran terhadap Windows lock
 */
async function forceWipeSessionDirectory() {
  const sessionPath = path.join(SESSION_DIR, 'session-wa-bot-main');
  if (!fs.existsSync(sessionPath)) return;

  forceKillBrowserProcess();
  cleanSessionLocks();

  function safeDeleteDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    try {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isDirectory()) {
            safeDeleteDirectory(fullPath);
            try { fs.rmdirSync(fullPath); } catch (_) {}
          } else {
            try { fs.unlinkSync(fullPath); } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  for (let i = 0; i < 3; i++) {
    try {
      if (fs.existsSync(sessionPath)) {
        safeDeleteDirectory(sessionPath);
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (_) {}
        console.log('[Engine] Folder sesi lama berhasil dibersihkan.');
      }
      break;
    } catch (err) {
      if (i < 2) {
        forceKillBrowserProcess();
        cleanSessionLocks();
        await new Promise(r => setTimeout(r, 250));
      }
    }
  }
}

let clientInstance = null;
let isInitializing = false;
let initRetryCount = 0;
let watchdogTimer = null;
let lastHeartbeatTime = Date.now();
let isPerformingAutoRecovery = false;

/**
 * Memulai watchdog heartbeat untuk memantau kesehatan koneksi WhatsApp secara berkala
 * dan mendeteksi kondisi komputer sleep / suspend / network drop.
 * @param {number} [intervalMs=20000]
 */
function startWatchdog(intervalMs = 20000) {
  stopWatchdog();
  lastHeartbeatTime = Date.now();

  watchdogTimer = setInterval(async () => {
    const now = Date.now();
    const elapsed = now - lastHeartbeatTime;
    lastHeartbeatTime = now;

    // Deteksi time-jump jika sistem baru saja bangun dari Sleep/Hibernation
    const isTimeJump = elapsed > (intervalMs * 1.8);
    if (isTimeJump) {
      console.log(`[Engine:Watchdog] ⏰ Terdeteksi sistem baru aktif dari sleep/suspend (jeda ${Math.round(elapsed / 1000)}s). Memverifikasi kesehatan koneksi WhatsApp...`);
    }

    if (!clientInstance || isInitializing || isPerformingAutoRecovery) {
      return;
    }

    const currentSt = getStatus();
    // Hanya periksa jika status internal tercatat READY atau AUTHENTICATED
    if (currentSt.state !== ENGINE_STATUS.READY && currentSt.state !== ENGINE_STATUS.AUTHENTICATED) {
      return;
    }

    try {
      // Ping ke konteks halaman Chromium di dalam Puppeteer
      const pingPromise = (async () => {
        if (clientInstance.pupPage && !clientInstance.pupPage.isClosed()) {
          await clientInstance.pupPage.evaluate(() => typeof window !== 'undefined');
          if (typeof clientInstance.getState === 'function') {
            const state = await clientInstance.getState();
            return state;
          }
          return 'CONNECTED';
        }
        throw new Error('Halaman Puppeteer tertutup atau tidak tersedia');
      })();

      // Beri batas waktu ping 7 detik
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Watchdog Ping Timeout (7s)')), 7000)
      );

      const state = await Promise.race([pingPromise, timeoutPromise]);
      if (state === 'DISCONNECTED' || state === 'UNPAIRED' || state === 'CONFLICT') {
        throw new Error(`Status WhatsApp Web: ${state}`);
      }
    } catch (pingErr) {
      console.warn(`[Engine:Watchdog] ⚠️ Health-check koneksi WhatsApp gagal (${pingErr.message}). Melakukan auto-recovery soft reconnect...`);
      isPerformingAutoRecovery = true;
      try {
        await reconnectClient();
      } catch (recErr) {
        console.error('[Engine:Watchdog] Gagal auto-recovery soft reconnect:', recErr.message);
      } finally {
        isPerformingAutoRecovery = false;
      }
    }
  }, intervalMs);

  if (watchdogTimer.unref) watchdogTimer.unref();
}

/**
 * Menghentikan watchdog heartbeat.
 */
function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

/**
 * Menginisialisasi WhatsApp Client dengan strategi LocalAuth.
 * @param {object} [customPuppeteerOptions] 
 * @param {boolean} [forceReinit=false] 
 * @returns {Client}
 */
function initClient(customPuppeteerOptions = {}, forceReinit = false) {
  if (clientInstance && !forceReinit) {
    return clientInstance;
  }

  if (isInitializing && !forceReinit) {
    return clientInstance;
  }

  // Pembersihan agresif sebelum inisialisasi
  forceKillBrowserProcess();
  cleanSessionLocks();

  // Tunggu sebentar agar OS melepas file locks setelah kill
  // (sinkron karena initClient dipanggil secara fire-and-forget)
  try { require('child_process').execSync('ping -n 1 127.0.0.1 > nul', { stdio: 'ignore', timeout: 1500 }); } catch (_) {}
  cleanSessionLocks(); // sekali lagi setelah delay

  isInitializing = true;
  setStatus(ENGINE_STATUS.CONNECTING, {
    qrCodeDataUrl: null,
    rawQr: null,
    errorMessage: null
  });

  try {
    const detectedExecutable = findSystemBrowserExecutable();
    if (detectedExecutable) {
      console.log(`[Engine] Menggunakan browser sistem: ${detectedExecutable}`);
    } else {
      console.warn('[Engine] Perhatian: Chrome/Edge tidak ditemukan di path standar, mencoba fallback internal.');
    }

    const puppeteerConfig = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-sync',
        '--disable-features=msEdgeStartupBoost,msEdgeBackgroundMode,OptimizationHints,Translate,BackForwardCache,MediaRouter',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      ...(detectedExecutable ? { executablePath: detectedExecutable } : {}),
      ...customPuppeteerOptions
    };

    clientInstance = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_DIR,
        clientId: 'wa-bot-main'
      }),
      puppeteer: puppeteerConfig
    });

    // Event: QR Code Generated
    clientInstance.on('qr', async (qr) => {
      try {
        const qrDataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 6 });
        setQrCode(qr, qrDataUrl);
        console.log('[Engine] QR Code WhatsApp berhasil dibuat. Silakan scan melalui antarmuka.');
      } catch (err) {
        console.error('[Engine] Gagal mengonversi QR Code ke Data URL:', err.message);
      }
    });

    // Event: Authenticated
    clientInstance.on('authenticated', () => {
      console.log('[Engine] Autentikasi sesi WhatsApp berhasil.');
      setStatus(ENGINE_STATUS.AUTHENTICATED);
    });

    // Event: Auth Failure
    clientInstance.on('auth_failure', (msg) => {
      console.error('[Engine] Gagal autentikasi sesi WhatsApp:', msg);
      resetStatus(`Gagal autentikasi: ${msg}`);
      stopReminderScheduler();
      stopWatchdog();
      clientInstance = null;
      isInitializing = false;
    });

    // Event: Ready
    clientInstance.on('ready', () => {
      isInitializing = false;
      const info = clientInstance.info || {};
      console.log(`[Engine] WhatsApp Bot SIAP (Ready) - Tersambung sebagai: ${info.pushname || 'User'} (${info.wid ? info.wid.user : ''})`);
      setStatus(ENGINE_STATUS.READY, {
        qrCodeDataUrl: null,
        rawQr: null,
        info: {
          pushname: info.pushname || '',
          phone: info.wid ? info.wid.user : '',
          platform: info.platform || ''
        }
      });
      // Aktifkan scheduler reminder otomatis
      startReminderScheduler(clientInstance);
      // Aktifkan watchdog pemantau kesehatan koneksi
      startWatchdog(20000);

      // Kirim pesan sambutan & panduan pertama kali jika setup sudah selesai dan belum pernah dikirim
      try {
        const { sendOneTimeOnboardingWelcome } = require('./onboarding');
        sendOneTimeOnboardingWelcome(clientInstance).catch(err => {
          console.warn('[Engine] Onboarding welcome error on ready:', err.message);
        });
      } catch (_) {}
    });

    // Event: Disconnected
    clientInstance.on('disconnected', (reason) => {
      console.warn(`[Engine] Sesi WhatsApp terputus. Alasan: ${reason}`);
      stopReminderScheduler();
      stopWatchdog();
      resetStatus(`Terputus: ${reason}`);
      clientInstance = null;
      isInitializing = false;
    });

    // Event: Incoming Message
    clientInstance.on('message', async (msg) => {
      await handleIncomingMessage(msg, clientInstance);
    });

    // Jalankan inisialisasi puppeteer & client
    clientInstance.initialize().then(() => {
      initRetryCount = 0; // Reset counter saat berhasil
    }).catch(async (err) => {
      console.error('[Engine] Gagal menjalankan inisialisasi client:', err.message);
      stopReminderScheduler();
      stopWatchdog();
      try {
        if (clientInstance) await clientInstance.destroy();
      } catch (_) {}
      clientInstance = null;
      isInitializing = false;
      cleanSessionLocks();

      // AUTO-RECOVERY: Jika terdeteksi browser lock / already running / launch fail
      const isRecoverableError = err.message && (
        err.message.includes('already running') ||
        err.message.includes('userDataDir') ||
        err.message.includes('Singleton') ||
        err.message.includes('EBUSY') ||
        err.message.includes('Failed to launch')
      );

      if (isRecoverableError && initRetryCount < 3) {
        initRetryCount++;
        console.log(`[Engine] ⚡ Terdeteksi error inisialisasi (percobaan ${initRetryCount}/3), melakukan pembersihan paksa & auto-recovery...`);
        forceKillBrowserProcess();
        cleanSessionLocks();
        await forceWipeSessionDirectory();
        
        // Retry inisialisasi otomatis setelah jeda pembersihan
        setTimeout(() => {
          console.log('[Engine] 🔄 Mencoba inisialisasi ulang WhatsApp Client...');
          initClient({}, true);
        }, 2000);
        return;
      }

      // Semua percobaan habis atau error non-recoverable
      console.error(`[Engine] ❌ Inisialisasi gagal total setelah ${initRetryCount} percobaan. Dashboard tetap bisa diakses.`);
      initRetryCount = 0;
      resetStatus(err.message);
    });

  } catch (error) {
    console.error('[Engine] Exception saat inisialisasi client:', error.message);
    stopReminderScheduler();
    stopWatchdog();
    clientInstance = null;
    isInitializing = false;
    cleanSessionLocks();
    resetStatus(error.message);
  }

  return clientInstance;
}

/**
 * Mengambil instance WhatsApp Client aktif.
 * @returns {Client|null}
 */
function getClient() {
  return clientInstance;
}

/**
 * Menghentikan dan membersihkan instance client jika perlu.
 */
async function destroyClient() {
  stopReminderScheduler();
  stopWatchdog();
  if (clientInstance) {
    try {
      if (clientInstance.pupBrowser) {
        try {
          const proc = clientInstance.pupBrowser.process();
          if (proc && proc.pid) {
            if (process.platform === 'win32') {
              execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
            } else {
              proc.kill('SIGKILL');
            }
          }
        } catch (_) {}
      }
      await clientInstance.destroy();
    } catch (err) {
      console.error('[Engine] Gagal menghancurkan client instance:', err.message);
    } finally {
      clientInstance = null;
      isInitializing = false;
      cleanSessionLocks();
      resetStatus();
    }
  }
}

/**
 * Melakukan penyambungan ulang (Soft Reconnect) tanpa menghapus sesi login WhatsApp.
 * @param {object} [customPuppeteerOptions]
 * @returns {Promise<Client>}
 */
async function reconnectClient(customPuppeteerOptions = {}) {
  console.log('[Engine] 🔄 Memulai proses penyambungan ulang / restart bot (Soft Reconnect)...');
  stopReminderScheduler();
  stopWatchdog();
  
  setStatus(ENGINE_STATUS.RECONNECTING, {
    errorMessage: null
  });

  try {
    if (clientInstance) {
      try {
        if (clientInstance.pupBrowser) {
          const proc = clientInstance.pupBrowser.process();
          if (proc && proc.pid) {
            if (process.platform === 'win32') {
              execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
            } else {
              proc.kill('SIGKILL');
            }
          }
        }
        await clientInstance.destroy();
      } catch (_) {}
    }
  } catch (_) {} finally {
    clientInstance = null;
    isInitializing = false;
    forceKillBrowserProcess();
    cleanSessionLocks();
  }

  // Jeda sejenak agar OS melepaskan lock file
  await new Promise(r => setTimeout(r, 600));
  cleanSessionLocks();

  // Inisialisasi ulang dengan sesi yang sudah tersimpan di disk (tanpa hapus folder auth)
  return initClient(customPuppeteerOptions, true);
}

/**
 * Reset total sesi WhatsApp (menghapus folder session lokal).
 */
async function resetSession() {
  console.log('[Engine] Memulai proses reset sesi total...');
  stopReminderScheduler();
  stopWatchdog();

  setStatus(ENGINE_STATUS.CONNECTING, {
    qrCodeDataUrl: null,
    rawQr: null,
    errorMessage: null
  });

  await destroyClient();
  await forceWipeSessionDirectory();
  await new Promise(r => setTimeout(r, 600));

  return initClient({}, true);
}

module.exports = {
  initClient,
  getClient,
  destroyClient,
  reconnectClient,
  resetSession,
  startWatchdog,
  stopWatchdog,
  cleanSessionLocks,
  forceKillBrowserProcess
};
