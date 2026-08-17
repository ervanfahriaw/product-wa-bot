const express = require('express');
const path = require('path');
const open = require('open');

const { getConfig, isSetupComplete } = require('../config');
const { initClient, destroyClient } = require('../engine');
const setupRouter = require('./routes/setup');
const dashboardRouter = require('./routes/dashboard');
const apiRouter = require('./routes/api');

const app = express();
const config = getConfig();
const PORT = process.env.PORT || config.port || 3000;

// Setup View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser & Static Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Middleware: First-Run Check
app.use((req, res, next) => {
  const isStatic = req.path.startsWith('/public') || req.path === '/favicon.ico';
  const isApi = req.path.startsWith('/api');
  const isSetupRoute = req.path.startsWith('/setup');

  if (isStatic || isApi) {
    return next();
  }

  // Jika setup wizard belum selesai dan bukan mengakses /setup, arahkan ke wizard
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
  if (!isSetupComplete()) {
    return res.redirect('/setup/step-1');
  }
  return res.redirect('/dashboard');
});

// Jalankan Server & Inisialisasi WhatsApp Engine
const server = app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`  🚀 WA Bot Web Controller berjalan di ${url}`);
  console.log(`======================================================\n`);

  // Inisialisasi WhatsApp client di latar belakang
  console.log('[Server] Menyiapkan WhatsApp Engine...');
  initClient();

  // Auto-open browser jika dijalankan secara lokal
  try {
    if (process.env.NODE_ENV !== 'production' && !process.env.NO_AUTO_OPEN) {
      await open(url);
    }
  } catch (err) {
    console.log(`Buka browser Anda di: ${url}`);
  }
});

// Penanganan penghentian server
process.on('SIGINT', async () => {
  console.log('\nMematikan Web Controller & WhatsApp Engine...');
  await destroyClient();
  server.close(() => {
    console.log('Server berhasil dihentikan.');
    process.exit(0);
  });
});

module.exports = app;
