const fs = require('fs');
const path = require('path');
const express = require('express');

// Pastikan proses selalu berjalan dengan working directory di root proyek bot
try {
  const projectRoot = path.resolve(__dirname, '../..');
  process.chdir(projectRoot);
} catch (_) {}

// 0. Polyfill TextDecoder untuk Node.js non-ICU (mengatasi error fatal option is not supported on Android libnode.so)
const OrigTextDecoder = globalThis.TextDecoder;
if (OrigTextDecoder) {
  let isFatalSupported = true;
  try {
    new OrigTextDecoder('utf-8', { fatal: true });
  } catch (_) {
    isFatalSupported = false;
  }

  if (!isFatalSupported) {
    class SafeTextDecoder extends OrigTextDecoder {
      constructor(label = 'utf-8', options = {}) {
        const safeOpts = { ...options };
        delete safeOpts.fatal;
        super(label, safeOpts);
      }
    }
    globalThis.TextDecoder = SafeTextDecoder;
    try {
      const util = require('util');
      if (util && util.TextDecoder) {
        util.TextDecoder = SafeTextDecoder;
      }
    } catch (_) {}
  }
}

// 0b. Polyfill Global Crypto untuk Node 18 & Android embedded environment
const nodeCrypto = require('crypto');
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
}
if (!globalThis.crypto.subtle && nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
  globalThis.crypto.subtle = nodeCrypto.webcrypto.subtle;
}

// 0b. Mode Non-SIMD WebAssembly untuk jaminan kompatibilitas CPU Android (ARM/x86/Emulator)
process.env.WHATSAPP_RUST_BRIDGE_FORCE_NOSIMD = 'true';

// 0c. Bypass pemeriksaan root CA cert yang tidak ada di struktur direktori Android (/etc/ssl/certs)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Pengaman runtime host Android: mencegah process.exit() mematikan proses aplikasi Android & logging diagnostik
if (process.env.ANDROID_DATA_DIR) {
  const logFile = path.join(process.env.ANDROID_DATA_DIR, 'node_server.log');
  const errFile = path.join(process.env.ANDROID_DATA_DIR, 'startup_error.txt');

  function writeAndroidLog(tag, msg) {
    try {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] [${tag}] ${msg}\n`);
    } catch (_) {}
  }

  writeAndroidLog('BOOT', 'Memulai runtime Node.js ' + process.version + ' di Android');

  process.on('uncaughtException', (err) => {
    const text = err && err.stack ? err.stack : String(err);
    console.error('[Android Host SafeGuard] Uncaught Exception:', text);
    writeAndroidLog('UNCAUGHT_EXCEPTION', text);
    try { fs.writeFileSync(errFile, text, 'utf-8'); } catch (_) {}
  });

  process.on('unhandledRejection', (reason) => {
    const text = reason && reason.stack ? reason.stack : String(reason);
    console.error('[Android Host SafeGuard] Unhandled Rejection:', text);
    writeAndroidLog('UNHANDLED_REJECTION', text);
  });

  process.exit = function(code) {
    console.warn('[Android Host SafeGuard] process.exit(' + code + ') dicegah demi menjaga kestabilan aplikasi Android.');
    writeAndroidLog('PREVENT_EXIT', 'process.exit(' + code + ') dicegah.');
  };

  // DNS Fallback untuk runtime Android (mengatasi c-ares yang tidak menemukan /etc/resolv.conf)
  try {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
    writeAndroidLog('DNS', 'DNS fallback diaktifkan (8.8.8.8, 1.1.1.1, ipv4first)');
  } catch (_) {}

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = function(...args) {
    origLog.apply(console, args);
    writeAndroidLog('LOG', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };
  console.warn = function(...args) {
    origWarn.apply(console, args);
    writeAndroidLog('WARN', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };
  console.error = function(...args) {
    origError.apply(console, args);
    writeAndroidLog('ERROR', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };

  // Heartbeat timer: Menjaga event loop Node.js tetap aktif agar tidak drain / terminate mandiri
  setInterval(() => {
    writeAndroidLog('HEARTBEAT', 'Event loop aktif');
  }, 45000);
}

const { getConfig, isSetupComplete } = require('../config');
const { initClient, destroyClient } = require('../engine');
const setupRouter = require('./routes/setup');
const dashboardRouter = require('./routes/dashboard');
const apiRouter = require('./routes/api');

const { startAutoSyncScheduler } = require('../engine/sheets-sync');

const app = express();
const config = getConfig();
const PORT = process.env.PORT || config.port || 3000;

// Setup View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const { UPLOADS_DIR, ensureDirectoriesExist } = require('../utils/paths');
const { checkLocalLicense } = require('../utils/license-client');

ensureDirectoriesExist();

// Body Parser & Static Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
const rootPublicDir = path.resolve(__dirname, '../../public');
if (fs.existsSync(rootPublicDir)) {
  app.use(express.static(rootPublicDir));
  app.use('/public', express.static(rootPublicDir));
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware: License & First-Run Guard
app.use((req, res, next) => {
  const isStatic = req.path.startsWith('/public') || 
                   req.path.startsWith('/uploads') || 
                   req.path === '/favicon.ico' || 
                   req.path === '/logo.svg' ||
                   req.path.endsWith('.svg') || 
                   req.path.endsWith('.png') || 
                   req.path.endsWith('.jpg');
  const isApi = req.path.startsWith('/api');
  const isLicenseRoute = req.path === '/setup/license' || req.path === '/setup/license/deactivate';

  if (isStatic || isApi) {
    return next();
  }

  // 1. Verifikasi status lisensi perangkat
  const lic = checkLocalLicense();
  if (!lic.isValid && !isLicenseRoute) {
    return res.redirect('/setup/license');
  }

  // 2. Jika lisensi valid, periksa kelengkapan wizard
  const isSetupRoute = req.path.startsWith('/setup');
  if (!isSetupComplete() && !isSetupRoute) {
    return res.redirect('/setup/step-1');
  }

  next();
});

// Mount Routes
app.use('/setup', setupRouter);
app.use('/dashboard', dashboardRouter);
app.use('/api', apiRouter);

// Root Route
app.get('/', (req, res) => {
  const lic = checkLocalLicense();
  if (!lic.isValid) {
    return res.redirect('/setup/license');
  }
  if (!isSetupComplete()) {
    return res.redirect('/setup/step-1');
  }
  return res.redirect('/dashboard');
});

// Global Express Error Handler (Mencegah web controller crash jika ada kesalahan render / database)
app.use((err, req, res, next) => {
  console.error('[Web Controller Error]', err.stack || err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
  return res.status(500).send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Panel Kontrol - Sedang Memproses</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F7F8; color: #18181B; margin: 0; padding: 40px 16px; display: flex; align-items: center; justify-content: center; min-height: 80vh; }
        .card { background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.03); text-align: center; }
        h2 { font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 8px; }
        p { font-size: 13px; color: #71717A; line-height: 1.5; margin-bottom: 24px; }
        .btn { display: inline-block; padding: 10px 24px; background: #18181B; color: #FFFFFF; font-size: 12px; font-weight: 600; border-radius: 99px; text-decoration: none; transition: background 0.2s; }
        .btn:hover { background: #27272A; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>⚡ Sedang Menyesuaikan Pengaturan</h2>
        <p>Web controller tetap aktif. Silakan kembali ke halaman utama dashboard untuk melanjutkan:</p>
        <a href="/dashboard" class="btn">Buka Dashboard &rarr;</a>
      </div>
    </body>
    </html>
  `);
});

// Jalankan Server & Inisialisasi WhatsApp Engine
let server = null;
const isTestMode = process.env.TEST_MODE === 'true' || process.env.TEST_MODE === '1';
if (!isTestMode) {
  const HOST = process.env.HOST || '127.0.0.1';
  server = app.listen(PORT, HOST, async () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n======================================================`);
    console.log(`  🚀 WA Bot Web Controller berjalan di ${url}`);
    console.log(`======================================================\n`);

    if (process.env.ANDROID_DATA_DIR) {
      try {
        const errFile = path.join(process.env.ANDROID_DATA_DIR, 'startup_error.txt');
        if (fs.existsSync(errFile)) fs.unlinkSync(errFile);
        fs.writeFileSync(path.join(process.env.ANDROID_DATA_DIR, 'server_ready.txt'), 'READY', 'utf-8');
      } catch (_) {}
    }

    // Inisialisasi WhatsApp client & Auto-Sync Google Sheets di latar belakang
    // Delayed agar server HTTP sudah 100% ready sebelum engine init
    // Dashboard harus bisa diakses MESKIPUN engine gagal total
    setTimeout(() => {
      console.log('[Server] Menyiapkan WhatsApp Engine...');
      try {
        initClient();
      } catch (err) {
        console.error('[Server] Engine init error (non-fatal, dashboard tetap aktif):', err.message);
      }
      startAutoSyncScheduler();
    }, 500);

    // Tulis file PID untuk kemudahan shutdown mandiri
    try {
      const { DATA_DIR } = require('../utils/paths');
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, 'bot.pid'), process.pid.toString(), 'utf-8');
    } catch (_) {}

    // Auto-open browser jika dijalankan secara lokal
    if (!process.env.NO_AUTO_OPEN) {
      try {
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          exec(`start "" "${url}"`);
        } else {
          const openModule = await import('open');
          const openFn = openModule.default || openModule;
          await openFn(url);
        }
      } catch (err) {
        console.log(`Buka browser Anda di: ${url}`);
      }
    }
  });
}

// Penanganan penghentian server
const handleShutdown = async () => {
  console.log('\nMematikan Web Controller & WhatsApp Engine...');
  try {
    const { DATA_DIR } = require('../utils/paths');
    const pidFile = path.join(DATA_DIR, 'bot.pid');
    if (fs.existsSync(pidFile)) {
      try { fs.unlinkSync(pidFile); } catch (_) {}
    }
  } catch (_) {}

  try {
    await destroyClient();
  } catch (_) {}
  if (server) {
    server.close(() => {
      console.log('Server berhasil dihentikan.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

module.exports = app;
