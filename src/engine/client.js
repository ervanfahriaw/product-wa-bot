const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const {
  ENGINE_STATUS,
  setStatus,
  setQrCode,
  resetStatus
} = require('./status');
const { handleIncomingMessage } = require('./handlers/message-handler');
const { startReminderScheduler, stopReminderScheduler } = require('./reminder-scheduler');

const SESSION_DIR = path.resolve(__dirname, 'session');

// Pastikan folder session ada
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Tangkap exception uncaught yang berasal dari whatsapp-web.js (LocalAuth.logout) saat EBUSY pada Windows
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EBUSY' || (err.message && err.message.includes('EBUSY'))) && (err.stack && err.stack.includes('session-wa-bot-main'))) {
    console.warn('[Engine] Warning: Berkas sesi teruji/terkunci saat cleanup logout (EBUSY). Server tetap berjalan.');
    return;
  }
  console.error('[UncaughtException]', err);
  process.exit(1);
});


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
    'SingletonCookie'
  ];

  for (const file of lockFiles) {
    const fullPath = path.join(sessionPath, file);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (_) {}
  }
}

let clientInstance = null;
let isInitializing = false;

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

  if (isInitializing) {
    return clientInstance;
  }

  cleanSessionLocks();
  isInitializing = true;
  setStatus(ENGINE_STATUS.CONNECTING);

  try {
    clientInstance = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_DIR,
        clientId: 'wa-bot-main'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        ...customPuppeteerOptions
      }
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
    });

    // Event: Disconnected
    clientInstance.on('disconnected', (reason) => {
      console.warn(`[Engine] Sesi WhatsApp terputus. Alasan: ${reason}`);
      stopReminderScheduler();
      resetStatus(`Terputus: ${reason}`);
      clientInstance = null;
      isInitializing = false;
    });

    // Event: Incoming Message
    clientInstance.on('message', async (msg) => {
      await handleIncomingMessage(msg, clientInstance);
    });

    // Jalankan inisialisasi puppeteer & client
    clientInstance.initialize().catch(async (err) => {
      console.error('[Engine] Gagal menjalankan inisialisasi client:', err.message);
      stopReminderScheduler();
      try {
        if (clientInstance) await clientInstance.destroy();
      } catch (_) {}
      clientInstance = null;
      isInitializing = false;
      cleanSessionLocks();
      resetStatus(err.message);
    });

  } catch (error) {
    console.error('[Engine] Exception saat inisialisasi client:', error.message);
    stopReminderScheduler();
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
  if (clientInstance) {
    try {
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
 * Reset total sesi WhatsApp (menghapus folder session lokal).
 */
async function resetSession() {
  await destroyClient();
  try {
    const sessionPath = path.join(SESSION_DIR, 'session-wa-bot-main');
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log('[Engine] Folder sesi lama berhasil dibersihkan.');
    }
  } catch (err) {
    console.error('[Engine] Gagal menghapus folder session:', err.message);
  }
  return initClient({}, true);
}

module.exports = {
  initClient,
  getClient,
  destroyClient,
  resetSession
};
