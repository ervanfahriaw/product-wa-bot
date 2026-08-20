const express = require('express');
const path = require('path');

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

const { UPLOADS_DIR } = require('../utils/paths');
const { checkLocalLicense } = require('../utils/license-client');

// Body Parser & Static Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware: License & First-Run Guard
app.use((req, res, next) => {
  const isStatic = req.path.startsWith('/public') || req.path.startsWith('/uploads') || req.path === '/favicon.ico';
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

// Jalankan Server & Inisialisasi WhatsApp Engine
let server = null;
if (!process.env.TEST_MODE) {
  server = app.listen(PORT, async () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n======================================================`);
    console.log(`  🚀 WA Bot Web Controller berjalan di ${url}`);
    console.log(`======================================================\n`);

    // Inisialisasi WhatsApp client & Auto-Sync Google Sheets di latar belakang
    console.log('[Server] Menyiapkan WhatsApp Engine...');
    initClient();
    startAutoSyncScheduler();

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
process.on('SIGINT', async () => {
  console.log('\nMematikan Web Controller & WhatsApp Engine...');
  await destroyClient();
  if (server) {
    server.close(() => {
      console.log('Server berhasil dihentikan.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

module.exports = app;
